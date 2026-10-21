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

from pipeline.territorio import desastres, queimadas, run

CAB_ANUAL = 'id_bdq,foco_id,lat,lon,data_pas,pais,estado,municipio,bioma\n'
CAB_MENSAL = 'id,lat,lon,data_hora_gmt,satelite,municipio,estado,pais,municipio_id,estado_id,pais_id,numero_dias_sem_chuva,precipitacao,risco_fogo,bioma,frp\n'


# Município padrão das linhas sintéticas: a capital do estado (as contagens municipais
# precisam casar com a lista do IBGE; um nome fictício cai em "sem município").
CAPITAL = {'PARÁ': 'BELÉM', 'MARANHÃO': 'SÃO LUÍS', 'BAHIA': 'SALVADOR', 'TOCANTINS': 'PALMAS',
           'MATO GROSSO': 'CUIABÁ', 'PIAUÍ': 'TERESINA', 'AMAZONAS': 'MANAUS', 'GOIÁS': 'GOIÂNIA'}


def _anual(linhas):
    """Zip anual do satélite de referência com as linhas (data, estado, bioma[, município])."""
    corpo = CAB_ANUAL + ''.join(f'{i},{i},0,0,{l[0]} 15:00:00,Brasil,{l[1]},{l[3] if len(l) > 3 else CAPITAL[l[1]]},{l[2]}\n' for i, l in enumerate(linhas))
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w') as z:
        z.writestr('focos.csv', corpo)
    return buf.getvalue()


def _mensal(linhas):
    """CSV mensal de todos os satélites com as linhas (data, satélite, estado, bioma[, município, código IBGE])."""
    def linha(i, l):
        m, cod = (l[4], l[5]) if len(l) > 5 else (CAPITAL[l[2]], '1')
        return f'{i},0,0,{l[0]} 15:00:00,{l[1]},{m},{l[2]},Brasil,{cod},1,33,0,0,0,{l[3]},1\n'
    return (CAB_MENSAL + ''.join(linha(i, l) for i, l in enumerate(linhas))).encode()


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


class TestMunicipios(unittest.TestCase):
    def test_nome_do_anual_casa_com_o_ibge_e_equivalencias_declaradas(self):
        _, por_id, por_nome = queimadas.referencia_ibge()
        # lista atual do IBGE: os 5.570 do Censo 2022 mais Boa Esperança do Norte, sem área
        self.assertEqual(len(por_id), 5571)
        self.assertEqual([c for c, m in por_id.items() if m['areaKm2'] is None], ['5101837'])
        cont = {'PA|SÃO FÉLIX DO XINGU': 5, "RO|ALTA FLORESTA D'OESTE": 2, 'RN|AÇU': 3, 'id:1500602': 4, 'PA|LUGAR INEXISTENTE': 1, '': 2}
        focos, sem, usadas = queimadas.resolver_municipios(cont, por_id, por_nome)
        self.assertEqual(focos['1507300'], 5)  # São Félix do Xingu
        self.assertEqual(focos['1100015'], 2)  # apóstrofo normalizado
        self.assertEqual(focos['2400208'], 3)  # Açu -> Assú, por equivalência
        self.assertEqual(focos['1500602'], 4)  # código vindo do mensal
        self.assertEqual(usadas, ['RN|ACU'])
        # o que não casa fica declarado com o nome da fonte; nada some
        self.assertEqual(sem, {'PA|LUGAR INEXISTENTE': 1, queimadas.SEM: 2})
        self.assertEqual(sum(focos.values()) + sum(sem.values()), sum(cont.values()))

    def test_toda_equivalencia_aponta_para_municipio_da_mesma_uf(self):
        _, por_id, por_nome = queimadas.referencia_ibge()
        for chave, cod in queimadas.EQUIVALENCIAS.items():
            self.assertEqual(por_id[cod]['uf'], chave.split('|')[0], chave)
            self.assertNotIn(chave, por_nome, f'{chave} já casa direto; a equivalência é desnecessária')

    def test_municipios_por_periodo_reconciliam_e_ausencia_e_nula(self):
        anuais = {'focos_br_ref_2025.zip': _anual([
            ('2025-01-10', 'PARÁ', 'Amazônia', 'ALTAMIRA'), ('2025-01-11', 'PARÁ', 'Amazônia', 'ALTAMIRA'),
            ('2025-02-03', 'MARANHÃO', 'Cerrado', 'MIRADOR'), ('2025-08-03', 'BAHIA', 'Caatinga', 'NOME SEM PAR'),
        ])}
        mensais = {
            'focos_mensal_br_202601.csv': _mensal([('2026-01-05', 'AQUA_M-T', 'PARÁ', 'Amazônia', 'ALTAMIRA', '1500602'),
                                                   ('2026-01-06', 'NOAA-20', 'PARÁ', 'Amazônia', 'ALTAMIRA', '1500602')]),
            'focos_mensal_br_202602.csv': _mensal([('2026-02-05', 'AQUA_M-T', 'TOCANTINS', 'Cerrado', 'PALMAS', '1721000')]),
            'focos_mensal_br_202603.csv': _mensal([('2026-03-02', 'AQUA_M-T', 'BAHIA', 'Caatinga', 'SALVADOR', '2927408')]),
        }
        # um foco sem par em quatro passaria do limite de 1% da coleta real; aqui o teste é a declaração
        with mock.patch.object(queimadas, 'LIMITE_SEM_MUNICIPIO', 0.5):
            d = _montar(anuais, mensais, date(2026, 3, 15))
        m = d['municipios']
        linhas = {l[0]: dict(zip(m['campos'], l)) for l in m['linhas']}
        self.assertEqual(linhas['1500602']['focos_ultimoAnoCompleto'], 2)
        self.assertEqual(linhas['1500602']['focos_acumuladoAnoCorrente'], 1)  # outro satélite não entra
        self.assertEqual(linhas['1500602']['focos_mesmoPeriodoAnoAnterior'], 2)
        self.assertEqual(linhas['1721000']['focos_ultimoAnoCompleto'], 0)  # arquivo lido inteiro: zero observado
        self.assertNotIn('2927408', linhas)  # março é o mês corrente, fora do acumulado
        self.assertEqual(m['semMunicipio']['ultimoAnoCompleto'], {'focos': 1, 'nomesNaFonte': {'BA|NOME SEM PAR': 1}})
        self.assertEqual(m['linhas'][0][0], '1500602')  # ordenado pelo último ano completo
        run.validar_queimadas(d)
        g = run.gold_queimadas_municipios(d)
        self.assertEqual(g['gold'], 'queimadas_municipios')
        self.assertNotIn('municipios', run.gold_queimadas(d))
        # mexer numa contagem quebra a reconciliação e bloqueia a publicação
        m['linhas'][0][4] += 1
        with self.assertRaises(ValueError):
            run.validar_queimadas(d)

    def test_coluna_de_municipio_ausente_retem_a_coleta(self):
        sem_coluna = io.BytesIO()
        with zipfile.ZipFile(sem_coluna, 'w') as z:
            z.writestr('focos.csv', 'id_bdq,foco_id,lat,lon,data_pas,pais,estado,bioma\n1,1,0,0,2025-01-10 15:00:00,Brasil,PARÁ,Amazônia\n')
        with self.assertRaisesRegex(ValueError, 'municipio'):
            _montar({'focos_br_ref_2025.zip': sem_coluna.getvalue()}, {}, date(2026, 1, 10))
        mensal = (CAB_MENSAL.replace(',municipio_id', '') + '1,0,0,2026-01-05 15:00:00,AQUA_M-T,ALTAMIRA,PARÁ,Brasil,1,33,0,0,0,Amazônia,1\n').encode()
        with self.assertRaisesRegex(ValueError, 'municipio_id'):
            _montar({'focos_br_ref_2025.zip': _anual([('2025-01-10', 'PARÁ', 'Amazônia', 'ALTAMIRA')])}, {'focos_mensal_br_202601.csv': mensal}, date(2026, 2, 10))

    def test_muitos_focos_sem_municipio_retem_a_coleta(self):
        # malha ou grafia nova na fonte: a seção municipal não sai com a maioria em "sem município"
        anuais = {'focos_br_ref_2025.zip': _anual([('2025-01-10', 'PARÁ', 'Amazônia', 'NOME NOVO')] * 3 + [('2025-01-11', 'PARÁ', 'Amazônia', 'ALTAMIRA')])}
        with self.assertRaisesRegex(ValueError, 'sem município'):
            _montar(anuais, {}, date(2026, 1, 10))

    def test_periodo_sem_arquivo_fica_nulo_nos_municipios(self):
        anuais = {'focos_br_ref_2025.zip': _anual([('2025-01-10', 'PARÁ', 'Amazônia', 'ALTAMIRA')])}
        mensais = {'focos_mensal_br_202602.csv': _mensal([('2026-02-05', 'AQUA_M-T', 'PARÁ', 'Amazônia', 'ALTAMIRA', '1500602')])}
        d = _montar(anuais, mensais, date(2026, 3, 10))
        m = d['municipios']
        self.assertIsNone(m['periodos']['acumuladoAnoCorrente'])
        self.assertIsNone(m['semMunicipio']['acumuladoAnoCorrente'])
        col = m['campos'].index('focos_acumuladoAnoCorrente')
        self.assertTrue(all(l[col] is None for l in m['linhas']))
        run.validar_queimadas(d)


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


COLS_DANOS = list(desastres.DANOS.values())
CAB_ATLAS = ['Protocolo_S2iD', 'Data_Evento', 'Data_Registro', 'Sigla_UF', 'Cod_IBGE_Mun', 'Cod_Cobrade', 'Status'] + COLS_DANOS


def _atlas(linhas, pasta):
    """CSV do Atlas (separador ;, latin1) com linhas (protocolo, data, uf, município, cobrade, status, óbitos)."""
    corpo = ';'.join(CAB_ATLAS) + '\n'
    for prot, dia, uf, mun, cob, status, obitos in linhas:
        danos = [str(obitos)] + ['0'] * (len(COLS_DANOS) - 1)
        corpo += ';'.join([prot, dia, dia, uf, mun, cob, status] + danos) + '\n'
    caminho = os.path.join(pasta, 'BD_Atlas_teste.csv')
    Path(caminho).write_bytes(corpo.encode('latin-1'))
    return caminho


class TestDesastres(unittest.TestCase):
    def _montar(self, linhas, hoje=date(2026, 10, 18)):
        pasta = tempfile.mkdtemp()
        caminho = _atlas(linhas, pasta)
        originais = {'atlas_csv': {'url': 'x', 'arquivo': os.path.basename(caminho), 'sha256': 'b' * 64, 'bytes': 10, 'last_modified': None, 'capturado_em': '2026-10-18T00:00:00+00:00'}}
        return desastres.montar(originais, [], pasta, hoje)

    def test_unidade_grupos_e_municipios_distintos(self):
        d = self._montar([
            ('PE-F-1', '10/03/2025', 'PE', '2600054', '14110', 'Reconhecido', 0),
            ('PE-F-2', '20/05/2025', 'PE', '2600054', '12100', 'Reconhecido', 2),
            ('RS-F-3', '01/06/2025', 'RS', '4300034', '11321', 'Reconhecido', 0),
            ('RS-F-4', '30/12/2025', 'RS', '4300042', '13310', 'Registro', 1),
            ('BA-F-5', '05/02/2002', 'BA', '2900108', '14110', 'Registro', 0),
        ])
        a = {x['ano']: x for x in d['serie_anual']}
        self.assertEqual(a[2025]['registros_reconhecidos'], 3)
        self.assertEqual(a[2025]['municipios_distintos_com_reconhecimento'], 2)
        self.assertEqual(a[2025]['por_grupo_reconhecidos'], {'secas_estiagens': 1, 'chuvas_inundacoes_enxurradas_alagamentos': 1, 'movimentos_de_massa': 1, 'outros': 0})
        # antes de 2003 a contagem de reconhecidos não existe: nulo, nunca zero
        self.assertIsNone(a[2002]['registros_reconhecidos'])
        # o ano corrente fora da base fica indisponível com motivo
        self.assertFalse(d['por_uf']['ano_corrente']['disponivel'])
        self.assertIsNone(d['por_uf']['ano_corrente']['ufs'])
        # a série sintética pula de 2002 para 2025: a validação recusa o buraco em vez de supor zero
        with self.assertRaises(ValueError):
            run.validar_desastres(d)
        d['serie_anual'] = [x for x in d['serie_anual'] if x['ano'] == 2025]
        run.validar_desastres(d)
        # a cobertura declarada sai da base coletada, não de texto fixo
        self.assertIn('1991 a 2025', d['fonte']['cadencia'])
        d2027 = self._montar([('PE-F-1', '10/03/2027', 'PE', '2600054', '14110', 'Reconhecido', 0)], hoje=date(2028, 3, 1))
        self.assertIn('1991 a 2027', d2027['fonte']['cadencia'])

    def test_protocolo_repetido_falha(self):
        with self.assertRaises(RuntimeError):
            self._montar([('PE-F-1', '10/03/2025', 'PE', '2600054', '14110', 'Reconhecido', 0)] * 2)

    def test_status_desconhecido_falha(self):
        with self.assertRaises(RuntimeError):
            self._montar([('PE-F-1', '10/03/2025', 'PE', '2600054', '14110', 'Pendente', 0)])

    def test_seed_versionado(self):
        seed = json.loads((run.SEED / 'desastres.json').read_text(encoding='utf-8'))
        run.validar_desastres(seed)
        self.assertEqual(seed['serie_anual'][0]['ano'], 1991)
        self.assertTrue(all(x['registros_reconhecidos'] is None for x in seed['serie_anual'] if x['ano'] < 2003))



class TestEmissoes(unittest.TestCase):
    def _seed(self):
        return json.loads((run.SEED / 'emissoes.json').read_text(encoding='utf-8'))

    def test_seed_versionado(self):
        seed = self._seed()
        run.validar_emissoes(seed)
        self.assertEqual(seed['anoInicial'], 1990)
        self.assertIn('GWP AR5', seed['metrica'])
        g = run.gold_emissoes(seed)
        self.assertEqual(round(sum(g['derivados']['participacaoUltimoAnoPct'].values())), 100)

    def test_setores_que_nao_somam_o_total_bloqueiam(self):
        seed = self._seed()
        seed['anos'][5]['setores']['energia'] += 5000
        with self.assertRaises(ValueError):
            run.validar_emissoes(seed)

    def test_serie_sem_2005_bloqueia(self):
        seed = self._seed()
        seed['anos'] = [a for a in seed['anos'] if a['ano'] >= 2006]
        with self.assertRaises(ValueError):
            run.validar_emissoes(seed)

    def test_edicao_anterior_a_versionada_e_recusada(self):
        anterior = self._seed()
        novo = dict(anterior, edicao='NIR 2026 (1990-2024)', anoFinal=2024)
        run.nao_retroceder_emissoes(novo, anterior)
        run.nao_retroceder_emissoes(anterior, anterior)
        run.nao_retroceder_emissoes(anterior, None)
        # painel de descoberta fora do ar depois de coletada uma edição nova: as URLs fixas trariam a antiga
        with self.assertRaises(ValueError):
            run.nao_retroceder_emissoes(anterior, novo)

    def test_coleta_que_retrocede_nao_grava_o_seed(self):
        from pipeline.territorio import emissoes
        versionado = self._seed()
        mais_novo = dict(versionado, edicao='NIR 2026 (1990-2024)', anoFinal=2024)
        with tempfile.TemporaryDirectory() as d:
            seed_dir = Path(d)
            (seed_dir / 'emissoes.json').write_text(json.dumps(mais_novo), encoding='utf-8')
            with mock.patch.object(run, 'SEED', seed_dir), mock.patch.object(emissoes, 'coletar', return_value=versionado), mock.patch.object(run, 'validar_emissoes'):
                with self.assertRaises(ValueError):
                    run.main(['--coleta', 'emissoes', '--cache', d])
            self.assertEqual(json.loads((seed_dir / 'emissoes.json').read_text(encoding='utf-8'))['edicao'], 'NIR 2026 (1990-2024)')

    def test_tabela_le_celula_vazia_como_nulo(self):
        from pipeline.territorio import emissoes
        _, anos, corpo = emissoes.tabela([['Emissões (kt)', '1990', '1991'], ['Total', '10', ''], ['1. Energia', 'NO', '3']])
        self.assertEqual(anos, [1990, 1991])
        self.assertIsNone(corpo[0][1][1991])
        self.assertIsNone(corpo[1][1][1990])


if __name__ == '__main__':
    unittest.main()
