"""Testes sem rede, incluindo sinais oficiais e proteção dos denominadores."""
import unittest
from pipeline.eficiencia_mobilidade.censo import valor_censo, razao, resultados, TOTAL
from pipeline.eficiencia_mobilidade.normalizar import numero

class MobilidadeTest(unittest.TestCase):
    def test_zero_absoluto(self):
        self.assertEqual(valor_censo('-'), (0.0,'observado'))
        self.assertEqual(valor_censo('0'), (0.0,'observado'))
    def test_sinais_distintos(self):
        for raw,state in [('X','suprimido'),('..','nao_aplicavel'),('...','nao_disponivel'),('', 'nao_informado')]:
            self.assertEqual(valor_censo(raw),(None,state))
    def test_invalido(self):
        for raw in ['NaN','inf','-1','abc']:
            self.assertEqual(valor_censo(raw),(None,'invalido'))
    def test_razao_zero(self):
        self.assertEqual(razao(0,'observado',10,'observado'),(0.0,'observado'))
        self.assertEqual(razao(0,'observado',0,'observado'),(None,'nao_aplicavel'))
    def test_razao_limites(self):
        self.assertEqual(razao(11,'observado',10,'observado'),(None,'invalido'))
        self.assertEqual(razao(None,'suprimido',10,'observado'),(None,'suprimido'))
        self.assertEqual(razao(2,'observado',None,'nao_informado'),(None,'nao_informado'))
    def test_porcentagem(self):
        self.assertEqual(razao(1,'observado',4,'observado'),(25.0,'observado'))
    def test_pemob_numeros(self):
        self.assertEqual(numero('1.234,50','s',False,'R$'),(1234.5,'observado'))
        self.assertEqual(numero('0','n'),(0.0,'observado'))
        self.assertEqual(numero(None),(None,'nao_informado'))
        self.assertEqual(numero('101','n',False,'%'),(None,'invalido'))
    def test_variavel_errada(self):
        with self.assertRaises(ValueError): resultados([{'id':10}], '537')
    def payload(self):
        return [{'id':'13376','resultados':[{'classificacoes':[{'id':k,'categoria':{v:'Total'}} for k,v in TOTAL.items()], 'series':[{'localidade':{'id':'1','nome':'Brasil','nivel':{'id':'N1'}},'serie':{'2022':'100'}}]}]}]
    def test_parse(self):
        self.assertEqual(resultados(self.payload(),'537')[('1','31609')]['raw'],'100')
    def test_duplicata(self):
        p=self.payload(); p[0]['resultados']*=2
        with self.assertRaises(ValueError): resultados(p,'537')
    def test_perimetro(self):
        p=self.payload(); p[0]['resultados'][0]['classificacoes'][1]['categoria']={'79208':'Ônibus'}
        with self.assertRaises(ValueError): resultados(p,'537')

if __name__=='__main__': unittest.main()
