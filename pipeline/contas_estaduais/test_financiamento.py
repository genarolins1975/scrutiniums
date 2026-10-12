import copy
import json
import unittest
from pipeline.contas_estaduais.consolidar import RAW, consolidar, ler, mapear_rreo
from pipeline.contas_estaduais.financiamento import mapear, CAMPOS


class FinanciamentoTest(unittest.TestCase):
    def setUp(self):
        registros=json.loads((RAW/'anual/manifesto.json').read_text())['registros']
        r=next(r for r in registros if r['uf']=='PE' and r['fonte']=='rreo')
        self.itens,_=ler(r,RAW/'anual')
        self.total=next(r['valor'] for r in self.itens if r['cod_conta']=='ReceitasExcetoIntraOrcamentarias' and r['coluna']=='Até o Bimestre (c)')

    def test_reproducao_de_todas_as_ufs(self):
        d=consolidar()
        self.assertEqual(d['cobertura']['observacoes'],216)
        for r in d['rreo']:
            f=r['financiamento'];v=f['valores']
            self.assertAlmostEqual(v['receitas_correntes']+v['receitas_capital'],r['valores']['receita_arrecadada'],places=2)
            self.assertAlmostEqual(v['tributaria']+v['contribuicoes']+v['transferencias_correntes']+v['demais_correntes_agrupadas'],v['receitas_correntes'],places=2)
            self.assertAlmostEqual(r['indicadores']['CE-10'],100*(v['receitas_correntes']-v['despesas_correntes'])/v['receitas_correntes'])
            self.assertAlmostEqual(r['indicadores']['CE-14'],100*v['transferencias_correntes']/v['receitas_correntes'])

    def test_sentinela_pe(self):
        f=mapear(self.itens,self.total)
        self.assertAlmostEqual(f['indicadores']['CE-10'],6.90,places=2)
        self.assertAlmostEqual(f['indicadores']['CE-14'],41.01,places=2)

    def test_ausencia_e_duplicata_nao_viram_zero(self):
        for conta,coluna in CAMPOS.values():
            r=next(r for r in self.itens if r['cod_conta']==conta and r['coluna']==coluna)
            with self.subTest(conta=conta):
                with self.assertRaisesRegex(ValueError,'ausente ou duplicado'):
                    mapear([x for x in self.itens if x is not r],self.total)
                with self.assertRaisesRegex(ValueError,'ausente ou duplicado'):
                    mapear(self.itens+[r],self.total)

    def test_intra_nao_entra_no_numerador(self):
        r=copy.deepcopy(self.itens[0]);r.update(cod_conta='TransferenciasCorrentesIntra',coluna='Até o Bimestre (c)',valor=1e12)
        self.assertEqual(mapear(self.itens,self.total),mapear(self.itens+[r],self.total))

    def test_margem_negativa_e_preservada(self):
        itens=copy.deepcopy(self.itens)
        rc=mapear(itens,self.total)['valores']['receitas_correntes']
        for r in itens:
            if r['cod_conta']=='DespesasCorrentes' and r['coluna']=='DESPESAS LIQUIDADAS ATÉ O BIMESTRE (h)': r['valor']=rc*1.1
        self.assertAlmostEqual(mapear(itens,self.total)['indicadores']['CE-10'],-10)

    def test_desvio_no_fechamento_bloqueia(self):
        with self.assertRaisesRegex(ValueError,'não reconciliam'):
            mapear(self.itens,self.total+1)

    def test_zero_de_transferencias_e_real(self):
        itens=copy.deepcopy(self.itens)
        for r in itens:
            if r['cod_conta']=='TransferenciasCorrentes' and r['coluna']=='Até o Bimestre (c)': r['valor']=0
        self.assertEqual(mapear(itens,self.total)['indicadores']['CE-14'],0)

    def test_perimetro_continua_exigido_pelo_consolidador(self):
        itens=copy.deepcopy(self.itens);itens[0]['esfera']='M'
        with self.assertRaisesRegex(ValueError,'Identidade'):
            mapear_rreo(itens,'PE',2025)


if __name__=='__main__':
    unittest.main()
