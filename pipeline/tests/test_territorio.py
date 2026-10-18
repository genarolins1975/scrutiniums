"""Testes do pipeline do Território e Clima (queimadas), sem rede."""
import io
import json
import os
import tempfile
import unittest
import zipfile
from datetime import date
from pathlib import Path
from unittest import mock

from pipeline.territorio import queimadas, run

CAB_ANUAL = 'id_bdq,foco_id,lat,lon,data_pas,pais,estado,municipio,bioma\n'
CAB_MENSAL = 'id,lat,lon,data_hora_gmt,satelite,municipio,estado,pais,municipio_id,estado_id,pais_id,numero_dias_sem_chuva,precipitacao,risco_fogo,bioma,frp\n'


def _anual(linhas):
    """Zip anual do satélite de referência com as linhas (data, estado, bioma)."""
    corpo = CAB_ANUAL + ''.join(f'{i},{i},0,0,{d} 15:00:00,Brasil,{e},X,{b}\n' for i, (d, e, b) in enumerate(linhas))
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w') as z:
        z.writestr('focos.csv', corpo)
    return buf.getvalue()


def _mensal(linhas):
    """CSV mensal de todos os satélites com as linhas (data, satélite, estado, bioma)."""
    return (CAB_MENSAL + ''.join(f'{i},0,0,{d} 15:00:00,{s},X,{e},Brasil,1,1,33,0,0,0,{b},1\n' for i, (d, s, e, b) in enumerate(linhas))).encode()


class FonteFalsa:
    """Servidor COIDS em memória: listagens e arquivos."""

    def __init__(self, anuais, mensais):
        self.anuais, self.mensais = anuais, mensais
        self.pasta = tempfile.mkdtemp()

    def listar(self, url):
        nomes = self.anuais if url == queimadas.ANUAL_REF else self.mensais
        return [{'nome': n, 'modificado': '', 'tamanho': ''} for n in nomes]

    def baixar(self, url, cache=None):
        nome = url.rsplit('/', 1)[1]
        dados = self.anuais.get(nome) or self.mensais.get(nome)
        caminho = os.path.join(self.pasta, nome)
        Path(caminho).write_bytes(dados)
        return caminho, {'url': url, 'sha256': 'a' * 64, 'bytes': len(dados), 'lastModified': None}


def _montar(anuais, mensais, hoje):
    f = FonteFalsa(anuais, mensais)
    with mock.patch.object(queimadas, 'listar', f.listar), mock.patch.object(queimadas, 'baixar', f.baixar):
        return queimadas.montar(hoje, cache='x')  # cache evita apagar os arquivos falsos


class TestQueimadas(unittest.TestCase):
    def test_serie_recortes_e_parcial(self):
        anuais = {
            'focos_br_ref_2024.zip': _anual([('2024-03-01', 'PARÁ', 'Amazônia')] * 2),
            'focos_br_ref_2025.zip': _anual([('2025-01-10', 'PARÁ', 'Amazônia'), ('2025-02-03', 'MARANHÃO', 'Cerrado'), ('2025-03-03', 'BAHIA', 'Caatinga')]),
        }
        mensais = {
            'focos_mensal_br_202601.csv': _mensal([('2026-01-05', 'AQUA_M-T', 'PARÁ', 'Amazônia'), ('2026-01-06', 'NOAA-20', 'PARÁ', 'Amazônia')]),
            'focos_mensal_br_202602.csv': _mensal([('2026-02-05', 'AQUA_M-T', 'TOCANTINS', 'Cerrado'), ('2026-02-07', 'AQUA_M-T', 'TOCANTINS', 'Cerrado')]),
            'focos_mensal_br_202603.csv': _mensal([('2026-03-02', 'AQUA_M-T', 'BAHIA', 'Caatinga')]),
        }
        d = _montar(anuais, mensais, date(2026, 3, 15))
        anual = {a['ano']: a for a in d['anual']}
        self.assertEqual(anual[2024]['focos'], 2)
        self.assertEqual(anual[2025]['focos'], 3)
        self.assertTrue(anual[2026]['parcial'])
        # outro satélite não entra; o mês corrente é parcial e fica fora do acumulado
        self.assertEqual([m['focos'] for m in d['mensal']['2026']], [1, 2, 1])
        self.assertTrue(d['mensal']['2026'][-1]['parcial'])
        recortes = {r['rotulo']: r for r in d['recortes']}
        self.assertEqual(recortes['acumuladoAnoCorrente']['focos'], 3)
        self.assertEqual(recortes['mesmoPeriodoAnoAnterior']['focos'], 2)
        self.assertEqual(recortes['acumuladoAnoCorrente']['periodo']['fim'], '2026-02-28')
        run.validar_queimadas(d)
        g = run.gold_queimadas(d)
        self.assertEqual(g['comparacao']['variacaoPct'], 50.0)

    def test_mes_sem_arquivo_e_ausencia_nunca_zero(self):
        anuais = {'focos_br_ref_2025.zip': _anual([('2025-01-10', 'PARÁ', 'Amazônia')])}
        mensais = {'focos_mensal_br_202602.csv': _mensal([('2026-02-05', 'AQUA_M-T', 'PARÁ', 'Amazônia')])}
        d = _montar(anuais, mensais, date(2026, 3, 10))
        jan = d['mensal']['2026'][0]
        self.assertIsNone(jan['focos'])
        recortes = {r['rotulo']: r for r in d['recortes']}
        self.assertIsNone(recortes['acumuladoAnoCorrente']['focos'])
        self.assertIsNone(run.gold_queimadas(d)['comparacao'])

    def test_satelite_de_referencia_ausente_falha(self):
        anuais = {'focos_br_ref_2025.zip': _anual([('2025-01-10', 'PARÁ', 'Amazônia')])}
        mensais = {'focos_mensal_br_202601.csv': _mensal([('2026-01-05', 'NPP-375', 'PARÁ', 'Amazônia')])}
        with self.assertRaises(ValueError):
            _montar(anuais, mensais, date(2026, 2, 10))

    def test_foco_de_outro_mes_no_arquivo_mensal_falha(self):
        anuais = {'focos_br_ref_2025.zip': _anual([('2025-01-10', 'PARÁ', 'Amazônia')])}
        mensais = {'focos_mensal_br_202601.csv': _mensal([('2026-02-05', 'AQUA_M-T', 'PARÁ', 'Amazônia')])}
        with self.assertRaises(ValueError):
            _montar(anuais, mensais, date(2026, 2, 10))

    def test_janeiro_sem_consolidado_do_ano_anterior(self):
        """Antes de o INPE publicar o consolidado, o ano encerrado sai dos mensais, preliminar, sem buraco na série."""
        anuais = {'focos_br_ref_2025.zip': _anual([('2025-05-10', 'PARÁ', 'Amazônia')])}
        mensais = {f'focos_mensal_br_2026{m:02d}.csv': _mensal([(f'2026-{m:02d}-05', 'AQUA_M-T', 'MATO GROSSO', 'Cerrado')] * m) for m in range(1, 13)}
        mensais['focos_mensal_br_202701.csv'] = _mensal([('2027-01-03', 'AQUA_M-T', 'PARÁ', 'Amazônia')])
        d = _montar(anuais, mensais, date(2027, 1, 20))
        anual = {a['ano']: a for a in d['anual']}
        self.assertEqual(sorted(anual), [2025, 2026, 2027])
        self.assertEqual(anual[2026]['focos'], sum(range(1, 13)))
        self.assertTrue(anual[2026]['preliminar'])
        self.assertFalse(anual[2026]['parcial'])
        self.assertEqual([m['focos'] for m in d['mensal']['2026']], list(range(1, 13)))
        run.validar_queimadas(d)

    def test_janeiro_sem_consolidado_e_sem_um_mensal_retem(self):
        anuais = {'focos_br_ref_2025.zip': _anual([('2025-05-10', 'PARÁ', 'Amazônia')])}
        mensais = {f'focos_mensal_br_2026{m:02d}.csv': _mensal([(f'2026-{m:02d}-05', 'AQUA_M-T', 'PARÁ', 'Amazônia')]) for m in range(1, 12)}
        with self.assertRaises(ValueError):
            _montar(anuais, mensais, date(2027, 1, 20))

    def test_seed_e_gold_versionados(self):
        """A gold publicada é exatamente a do seed, e o seed respeita as invariantes."""
        self.assertEqual(run.main(['--check']), 0)
        seed = json.loads((run.SEED / 'queimadas.json').read_text(encoding='utf-8'))
        run.validar_queimadas(seed)
        self.assertEqual(seed['sateliteReferencia']['id'], 'AQUA_M-T')
        fechados = [a for a in seed['anual'] if not a['parcial']]
        self.assertEqual(fechados[0]['ano'], 2003)
        for r in seed['recortes']:
            if r['focos'] is not None:
                self.assertEqual(len(r['porUF']), 27 + (1 if any(x['id'] == queimadas.SEM for x in r['porUF']) else 0))
        self.assertIn('Provisório', seed['areaQueimada']['maturidade'])


if __name__ == '__main__':
    unittest.main()
