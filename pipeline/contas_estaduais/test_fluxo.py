import copy
import json
import unittest
from pipeline.contas_estaduais.consolidar import ler
from pipeline.contas_estaduais.fluxo import (ANUAL, OUT, RAW, consolidar, montar, funcoes, _registros,
                                             FUNDEB, REPASSE, DOZE_MESES, EMPENHADA_02, EXCETO_INTRA_02)


def anexos(uf):
    a01 = next(r for r in _registros(ANUAL) if r['uf'] == uf and r['fonte'] == 'rreo' and r['ano'] == 2025)
    novos = {r['fonte']: r for r in _registros(RAW) if r['uf'] == uf}
    return ler(a01, ANUAL)[0], ler(novos['rreo02'], RAW)[0], ler(novos['rreo03'], RAW)[0]


class FluxoEstadualTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base = consolidar()
        cls.pe = anexos('PE')

    def test_publicado_reproduz_os_bytes_arquivados(self):
        self.assertEqual(OUT.read_text(), json.dumps(self.base, ensure_ascii=False, indent=1) + '\n')

    def test_cada_no_fecha_nas_27_ufs(self):
        self.assertEqual(len(self.base['ufs']), 27)
        for u in self.base['ufs']:
            with self.subTest(uf=u['uf']):
                self.assertAlmostEqual(sum(f['valor'] for f in u['fontes']), u['arrecadacao'], places=2)
                self.assertAlmostEqual(u['repasse'] + u['fundeb'] + u['diferenca_receita'] + u['receita_disponivel'],
                                       u['arrecadacao'], delta=1.0)
                self.assertAlmostEqual(sum(a['valor'] for a in u['usos']) + u['diferenca_gasto'], u['gasto'], delta=1.0)
                self.assertAlmostEqual(u['receita_disponivel'] - u['gasto'], u['resultado'], places=2)
                for a in u['usos']:
                    if a['partes']:
                        self.assertAlmostEqual(sum(p[1] for p in a['partes']), a['valor'], places=2)

    def test_cota_municipal_registrada_como_despesa_sai_dos_dois_lados(self):
        sp = next(u for u in self.base['ufs'] if u['uf'] == 'SP')
        self.assertEqual(sp['registro_repasse'], 'despesa')
        self.assertAlmostEqual(sp['gasto'], sp['totais_fonte']['despesa_anexo01'] - sp['repasse'], places=2)
        self.assertAlmostEqual(sp['receita_disponivel'], sp['totais_fonte']['receita_anexo01'] - sp['repasse'], places=2)

    def test_distrito_federal_sem_municipios_tem_repasse_zero(self):
        df = next(u for u in self.base['ufs'] if u['uf'] == 'DF')
        self.assertEqual(df['repasse'], 0.0)

    def test_ausencia_nao_vira_zero(self):
        a01, a02, a03 = copy.deepcopy(self.pe)
        for conta in (FUNDEB, REPASSE):
            with self.subTest(conta=conta):
                sem = [r for r in a03 if not (r['cod_conta'] == conta and r['coluna'] == DOZE_MESES)]
                with self.assertRaisesRegex(ValueError, 'ausente'):
                    montar('PE', a01, a02, sem)

    def test_duplicata_bloqueia(self):
        a01, a02, a03 = copy.deepcopy(self.pe)
        r = next(r for r in a03 if r['cod_conta'] == FUNDEB and r['coluna'] == DOZE_MESES)
        with self.assertRaisesRegex(ValueError, 'duplicada'):
            montar('PE', a01, a02, a03 + [r])

    def test_funcao_alterada_quebra_a_soma_do_anexo_02(self):
        a01, a02, a03 = copy.deepcopy(self.pe)
        r = next(r for r in a02 if r['conta'] == 'Saúde' and r['coluna'] == EMPENHADA_02 and r['rotulo'] == EXCETO_INTRA_02)
        r['valor'] += 1e6
        with self.assertRaisesRegex(ValueError, 'não somam'):
            montar('PE', a01, a02, a03)

    def test_subfuncao_nao_entra_como_funcao(self):
        _, a02, _ = self.pe
        total, por_funcao = funcoes(a02)
        self.assertNotIn('Atenção Básica', por_funcao)
        self.assertAlmostEqual(sum(por_funcao.values()), total, places=2)


if __name__ == '__main__':
    unittest.main()
