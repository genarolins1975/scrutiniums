"""Gold judicial.json: a camada nacional não sai parcial.

Execução de 17/10/2026 (run 39033304284): o silver tinha sido semeado de novo em
15/10 (sem as tabelas jud_*), e o orçamento de 600 s do coletor acabou no meio do
TJSP. O builder publicou 1 tribunal e 2 categorias (sem garantias e cobrança, sem
ramo trabalhista, total trabalhista 0) contra 15 tribunais e 7 categorias na
publicação de 24/09. O teste de conteúdo reteve a gold do dia inteira.

Contrato: faltando qualquer par tribunal × categoria da taxonomia, o builder grava o
stub declarado (`disponivel: False`, com as lacunas); a sentinela de gold mantém a
última publicação íntegra e a declara em meta.json `restaurados`.
"""
import sqlite3
import unittest
from unittest.mock import patch

from pipeline import judicial
from pipeline.sources import judicial as fonte

AGORA = "2026-10-17T14:18:13+00:00"


def _silver(pares):
    """Silver mínimo: um código por par (tribunal, categoria) pedido."""
    con = sqlite3.connect(":memory:")
    fonte._ensure(con)
    con.executescript("""
        CREATE TABLE institutions(cod_inst TEXT, name TEXT);
        CREATE TABLE institution_metrics(cod_inst TEXT, anomes TEXT, metric TEXT, value REAL);""")
    taxonomia = {**fonte.TAXONOMIA_CIVEL, **fonte.TAXONOMIA_TRABALHISTA}
    for trib, cat in pares:
        ramo = "civel" if trib in fonte.TRIBUNAIS_CIVEL else "trabalhista"
        cod, nome = next(iter(taxonomia[cat]["codigos"].items()))
        con.execute("INSERT INTO jud_assunto VALUES(?,?,?,?,?,?,?,?)",
                    (trib, ramo, cat, cod, nome, 1000, 900, AGORA))
        con.execute("INSERT OR REPLACE INTO jud_tribunal VALUES(?,?,?,?,?)",
                    (trib, ramo, fonte.UF_DO_TRIBUNAL[trib], 10000, AGORA))
    # TST presente: o builder não recorre à publicação anterior para a camada nominal
    con.execute("INSERT INTO jud_tst_ranking VALUES('Junho de 2026',1,'Banco X S.A.',100,1,NULL,'media',?)", (AGORA,))
    con.commit()
    return con


def _todos_os_pares():
    return ([(t, c) for t in fonte.TRIBUNAIS_CIVEL for c in fonte.TAXONOMIA_CIVEL]
            + [(t, c) for t in fonte.TRIBUNAIS_TRABALHO for c in fonte.TAXONOMIA_TRABALHISTA])


def _build(con):
    gravados = {}
    with patch.object(judicial.common, "write_gold", lambda nome, p: gravados.__setitem__(nome, p)):
        r = judicial.build(con, {})
    return r, gravados["judicial.json"]


class CoberturaDaCamadaNacional(unittest.TestCase):
    def test_coleta_de_17_10_vira_stub_declarado(self):
        # o silver real de 17/10: só o TJSP, revisionais e indenizatórias
        con = _silver([("tjsp", "revisionais"), ("tjsp", "indenizatorias")])
        r, gold = _build(con)
        self.assertFalse(r["ok"])
        self.assertIs(gold["disponivel"], False)          # a sentinela reconhece o stub
        self.assertIn("tjsp/garantias_cobranca", gold["lacunas"])
        self.assertIn("trt2/rescisao", gold["lacunas"])
        self.assertEqual(len(gold["lacunas"]), 50 - 2)
        self.assertNotIn("camada_nacional", gold)          # nada de total parcial ou zero

    def test_um_par_faltando_basta_para_nao_publicar(self):
        pares = [p for p in _todos_os_pares() if p != ("tjce", "garantias_cobranca")]
        r, gold = _build(_silver(pares))
        self.assertIs(gold["disponivel"], False)
        self.assertEqual(gold["lacunas"], ["tjce/garantias_cobranca"])

    def test_cobertura_completa_publica_as_sete_categorias(self):
        r, gold = _build(_silver(_todos_os_pares()))
        self.assertTrue(r["ok"])
        cn = gold["camada_nacional"]
        self.assertEqual(cn["n_tribunais"], 15)
        self.assertIn("garantias_cobranca", [c["categoria"] for c in cn["categorias"]])
        self.assertEqual(len(cn["categorias"]), 7)
        self.assertGreater(cn["total_trabalhista_casos"], 0)


if __name__ == "__main__":
    unittest.main()
