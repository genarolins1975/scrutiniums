"""Reclamações do consignado (consumidor.gov.br): a pane de 15 a 17/10/2026.

Em 15/10/2026 o cache do estado não foi encontrado e o silver foi semeado de novo; o
coletor estban, que carrega `ibge_municipios`, falhou por tempo esgotado no IBGE, e o
`reclamacoes_consig` rodou logo depois com o índice municipal vazio. Nenhuma linha casou
com município, as 12 competências foram gravadas em `reclam_consig_coleta` com
municipios = 0 e, por serem idempotentes por competência, nunca mais foram recoletadas.
O gold saiu com `reclamacoes: {}` e a publicação de 17/10 foi retida pelos testes de
conteúdo.

Travas:
1. Sem o índice do IBGE o coletor falha e não marca competência nenhuma como absorvida.
2. Competência com reclamação de consignado do INSS e nenhum município casado é falha,
   não absorção.
3. Competência gravada sem município (estado herdado da pane) é recoletada.
4. Competência sem nenhuma reclamação da categoria continua absorvida (sem recoleta diária).
"""
import sqlite3
import unittest
from unittest import mock

from pipeline import consignado
from pipeline.sources import reclamacoes_consig as rc

ASSUNTO = "Crédito Consignado / Cartão de Crédito Consignado (para beneficiários do INSS)"


def _db(municipios=True):
    con = sqlite3.connect(":memory:")
    con.execute("CREATE TABLE ibge_municipios(cod_ibge TEXT PRIMARY KEY, nome TEXT, "
                "nome_norm TEXT, uf TEXT, regiao TEXT)")
    if municipios:
        linhas = [("3550308", "São Paulo", "SP"), ("3304557", "Rio de Janeiro", "RJ")]
        linhas += [(f"99{i:05d}", f"Municipio {i}", "ZZ") for i in range(5568)]
        con.executemany("INSERT INTO ibge_municipios VALUES(?,?,?,?,?)",
                        [(c, n, rc._norm(n), uf, None) for c, n, uf in linhas])
    return con


def _linha(cidade, uf, assunto=ASSUNTO):
    return {"Assunto": assunto, "UF": uf, "Cidade": cidade, "Faixa Etária": "mais de 70 anos",
            "Respondida": "S", "Avaliação Reclamação": "Resolvida",
            "Nome Fantasia": "Banco X", "Nota do Consumidor": "4"}


LINHAS = [_linha("São Paulo", "SP"), _linha("SAO PAULO", "SP"), _linha("Rio de Janeiro", "RJ")]


def _coleta(con, linhas=LINHAS, comps=("2026-09",)):
    pubs = [(c, f"cod{c}") for c in comps]
    with mock.patch.object(rc, "_publicacoes", return_value=(pubs, {})), \
            mock.patch.object(rc.common, "http_get", return_value=(b"zip", {})), \
            mock.patch.object(rc.common, "save_bronze", return_value=(None, "sha")), \
            mock.patch.object(rc.common, "record_lineage"), \
            mock.patch.object(rc, "_linhas_do_zip", side_effect=lambda _b: iter(list(linhas))):
        return rc.collect(con)


def _absorvidas(con):
    return [r[0] for r in con.execute("SELECT competencia FROM reclam_consig_coleta")]


class IndiceMunicipalAusente(unittest.TestCase):
    def test_sem_ibge_falha_e_nao_absorve(self):
        con = _db(municipios=False)
        res = _coleta(con)
        self.assertFalse(any(r.get("ok") for r in res), res)
        self.assertEqual(_absorvidas(con), [], "competência gravada sem índice municipal")

    def test_rodada_seguinte_com_ibge_publica_o_bloco(self):
        con = _db(municipios=False)
        _coleta(con)
        con.executemany("INSERT INTO ibge_municipios VALUES(?,?,?,?,?)",
                        [("3550308", "São Paulo", "sao paulo", "SP", "SE"),
                         ("3304557", "Rio de Janeiro", "rio de janeiro", "RJ", "SE")]
                        + [(f"99{i:05d}", f"Municipio {i}", f"municipio {i}", "ZZ", None)
                           for i in range(5568)])
        res = _coleta(con)
        self.assertTrue(all(r.get("ok") for r in res), res)
        rec_mun, bloco = consignado._reclamacoes(con)
        self.assertEqual(bloco.get("selo"), "observado")
        self.assertEqual(bloco.get("total"), 3)
        self.assertEqual(bloco.get("municipios"), 2)
        self.assertEqual(rec_mun["3550308"]["t"], 2)

    def test_nenhum_municipio_casado_e_falha(self):
        con = _db()
        res = _coleta(con, linhas=[_linha("Cidade Renomeada", "SP")])
        self.assertFalse(any(r.get("ok") for r in res), res)
        self.assertEqual(_absorvidas(con), [])


class EstadoHerdadoDaPane(unittest.TestCase):
    def test_competencia_gravada_sem_municipio_e_recoletada(self):
        con = _db()
        rc._ensure(con)
        # o que a rodada de 15/10/2026 deixou no silver: 12.720 reclamações, 0 municípios
        con.execute("INSERT INTO reclam_consig_coleta VALUES('2026-09', 358865, 12720, 0, 1956, 'x')")
        con.execute("INSERT INTO reclam_consig_if VALUES('2026-09', 'Banco X', 12720, 0, 0, 0, NULL)")
        res = _coleta(con)
        self.assertEqual([r.get("key") for r in res], ["reclamacoes_consig:2026-09"], res)
        self.assertEqual(con.execute("SELECT SUM(total) FROM reclam_consig_mun").fetchone()[0], 3)
        self.assertEqual(con.execute(
            "SELECT municipios FROM reclam_consig_coleta WHERE competencia='2026-09'").fetchone()[0], 2)
        self.assertEqual(con.execute("SELECT total FROM reclam_consig_if").fetchall(), [(3,)])

    def test_competencia_sem_reclamacao_da_categoria_segue_absorvida(self):
        # 2026-05 é publicada como .7z dentro do ZIP: 0 reclamações da categoria. Não pode
        # virar recoleta diária.
        con = _db()
        rc._ensure(con)
        con.execute("INSERT INTO reclam_consig_coleta VALUES('2026-05', 39108, 0, 0, 0, 'x')")
        res = _coleta(con, comps=("2026-05",))
        self.assertEqual(res, [{"key": "reclamacoes_consig", "ok": True,
                                "note": "competências já absorvidas"}])


if __name__ == "__main__":
    unittest.main()
