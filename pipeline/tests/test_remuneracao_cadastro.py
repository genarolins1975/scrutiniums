"""Remuneração (FRE) só lista companhias do cadastro de instituições da mesma gold.

Em 22/11/2026 o FRE passou a trazer o Banco Votorantim, fora do cadastro, e o grupo
operacional ficou retido porque a página não tinha com o que ligar a linha (inst-listada.test.ts).
"""
import sqlite3
import unittest

from pipeline import operacional


def _con():
    con = sqlite3.connect(":memory:")
    con.execute("CREATE TABLE rem_total_orgao (cnpj8, nome, exercicio, orgao, fre_ano, total, membros, composicao)")
    con.execute("CREATE TABLE rem_max_min_media (cnpj8, nome, exercicio, orgao, maior, media)")
    for c8, nome in (("11111111", "BANCO LISTADO S.A."), ("22222222", "BANCO FORA DO CADASTRO S.A.")):
        con.execute("INSERT INTO rem_total_orgao VALUES (?,?,?,?,?,?,?,?)",
                    (c8, nome, "2025-12-31", "Diretoria Estatutária", "2026", 1000000.0, 10, "{}"))
    return con


class RemuneracaoSoDoCadastro(unittest.TestCase):
    def test_sem_filtro_mantem_todas(self):
        r = operacional._bloco_remuneracao(_con())
        self.assertEqual(len(r["empresas"]), 2)
        self.assertEqual(r["fora_do_cadastro"], [])

    def test_filtra_pelo_cadastro_e_declara_quem_ficou_fora(self):
        r = operacional._bloco_remuneracao(_con(), {"11111111"})
        self.assertEqual([e["cnpj8"] for e in r["empresas"]], ["11111111"])
        self.assertEqual(r["fora_do_cadastro"], ["BANCO FORA DO CADASTRO S.A."])

    def test_cadastro_sem_nenhuma_companhia_do_fre_devolve_none(self):
        self.assertIsNone(operacional._bloco_remuneracao(_con(), {"99999999"}))


if __name__ == "__main__":
    unittest.main()
