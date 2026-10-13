import copy
import unittest
from .despesas import mapear, COLUNA
from .consolidar import consolidar

class DespesasTest(unittest.TestCase):
    def setUp(self):
        self.linhas=[dict(cod_conta=k,coluna=COLUNA,valor=v) for k,v in dict(PessoalEEncargosSociais=40,JurosEEncargosDaDivida=5,OutrasDespesasCorrentes=25,Investimentos=15,InversoesFinanceiras=5,AmortizacaoDaDivida=10,DespesasCorrentes=70,DespesasDeCapital=30).items()]
    def test_reconciliacao_nacional(self):
        dados=consolidar()['rreo']
        self.assertEqual(len(dados),27)
        for d in dados:
            c=d['composicao_despesa']
            self.assertAlmostEqual(sum(p['valor'] for p in c['partes']),d['valores']['liquidada'],places=2)
            self.assertAlmostEqual(sum(p['percentual'] for p in c['partes']),100,places=8)
    def test_nao_soma_detalhes_ou_intra(self):
        linhas=self.linhas+[dict(cod_conta='InvestimentosIntra',coluna=COLUNA,valor=999),dict(cod_conta='DemaisDespesasCorrentes',coluna=COLUNA,valor=25)]
        self.assertEqual(sum(p['valor'] for p in mapear(linhas,100)['partes']),100)
    def test_ausencia_duplicidade_e_zero(self):
        with self.assertRaises(ValueError):mapear(self.linhas[1:],100)
        with self.assertRaises(ValueError):mapear(self.linhas+[self.linhas[0]],100)
        linhas=copy.deepcopy(self.linhas);linhas[1]['valor']=0;linhas[6]['valor']=65
        self.assertEqual(mapear(linhas,95)['partes'][1]['valor'],0)
    def test_nao_corrige_divergencia(self):
        for total in (99,0,float('nan')):
            with self.assertRaises(ValueError):mapear(self.linhas,total)
        linhas=copy.deepcopy(self.linhas);linhas[6]['valor']=71
        with self.assertRaises(ValueError):mapear(linhas,101)
    def test_invalido_nao_vira_zero(self):
        for v in (None,-1,True,float('inf'),float('nan')):
            linhas=copy.deepcopy(self.linhas);linhas[0]['valor']=v
            with self.assertRaises(ValueError):mapear(linhas,100)
