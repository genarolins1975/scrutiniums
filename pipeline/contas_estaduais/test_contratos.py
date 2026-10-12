import json
import tempfile
import unittest
from pathlib import Path
from pipeline.contas_estaduais.coletar import mapear_rgf, paginas, parametros, CONTAS

class ContratosSiconfi(unittest.TestCase):
    def linhas(self, dcl=-10, rcl=100):
        valores = dict(dcl=dcl, rcl_ajustada=rcl, percentual_declarado=-10)
        return [dict(cod_conta=codigo, coluna="Até o 3º Quadrimestre", uf="PE",
                     exercicio=2025, cod_ibge=26, periodo=3, valor=valores[campo])
                for codigo, campo in CONTAS.items()]

    def test_nao_substitui_rcl_ajustada(self):
        itens = self.linhas()
        itens[1]["cod_conta"] = "RGF2ReceitaCorrenteLiquida"
        self.assertEqual(mapear_rgf(itens,"PE",2025,3)["status"], "campos_ausentes")

    def test_divida_negativa_e_denominador_invalido(self):
        self.assertEqual(mapear_rgf(self.linhas(),"PE",2025,3)["percentual_calculado"], -10)
        for rcl in (0,-1):
            self.assertEqual(mapear_rgf(self.linhas(rcl=rcl),"PE",2025,3)["status"],"denominador_invalido")

    def test_duplicata_e_ente_incorreto_bloqueiam(self):
        itens = self.linhas()
        with self.assertRaises(ValueError): mapear_rgf(itens + itens[:1],"PE",2025,3)
        itens[0]["uf"] = "SP"
        with self.assertRaises(ValueError): mapear_rgf(itens,"PE",2025,3)

    def test_periodo_nao_solicitado_nao_vira_dado(self):
        itens = self.linhas()
        itens[0]["periodo"] = 1
        with self.assertRaises(ValueError): mapear_rgf(itens,"PE",2025,3)

    def test_paginacao_e_hash_dos_bytes(self):
        respostas = iter([b'{"items":[{"valor":0}],"hasMore":true}',b'{"items":[{"valor":1}],"hasMore":false}'])
        urls=[]
        def fetch(url):
            urls.append(url)
            return next(respostas)
        with tempfile.TemporaryDirectory() as pasta:
            itens, arquivos = paginas("rgf", parametros("PE",2025,"rgf"), Path(pasta), fetch)
            self.assertEqual(len(itens),2)
            self.assertEqual(len(arquivos),2)
            self.assertIn("offset=1",urls[1])
            self.assertTrue(all((Path(pasta)/a["arquivo"]).exists() for a in arquivos))

    def test_resposta_incompleta_nao_e_ausencia(self):
        with tempfile.TemporaryDirectory() as pasta:
            for resposta in [b'{"items":[]}',b'{"items":[],"hasMore":true}',b'{"erro":"fora do ar"}']:
                with self.assertRaises(ValueError):
                    paginas("rgf",{},Path(pasta),lambda _: resposta)

    def test_zero_linhas_com_paginacao_final_e_distinto(self):
        with tempfile.TemporaryDirectory() as pasta:
            itens, arquivos=paginas("rgf",{},Path(pasta),lambda _: b'{"items":[],"hasMore":false}')
            self.assertEqual(itens,[])
            self.assertEqual(len(arquivos),1)

if __name__ == "__main__":
    unittest.main()
