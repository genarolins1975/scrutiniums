"""Crédito rural (MDCR/Sicor): as travas da pane de 03 a 13/10/2026.

1. A coleta roda os recursos pesados (município primeiro) ANTES da cauda histórica
   dos leves, com orçamento próprio: a recarga da história nunca mais deixa a janela
   publicada sem município.
2. A janela publicada só termina num mês que existe no nacional E no municipal;
   o recuo é declarado no payload e nas cautelas.
3. O HTTP 500 intermitente da Olinda é retentado com espera curta, e a mensagem
   de falha no log preserva a causa.
"""
import sqlite3
import unittest
from datetime import date
from unittest import mock

from pipeline import rural
from pipeline.sources import sicor


def _mes(delta):
    """Mês-calendário `delta` meses antes do corrente, como 'AAAA-MM'."""
    hoje = date.today()
    y, m = hoje.year, hoje.month - delta
    while m <= 0:
        y, m = y - 1, m + 12
    return f"{y}-{m:02d}"


class OrdemDaColeta(unittest.TestCase):
    def test_pesados_antes_da_cauda_historica_dos_leves(self):
        con = sqlite3.connect(":memory:")
        ordem = []

        def fake(recurso):
            def fn(_con, mes):
                ordem.append((recurso, mes))
                raise RuntimeError("HTTP Error 500")  # falha não pode travar a ordem
            return fn

        alvos = {f"_coleta_{r}": fake(r) for r in ("uf", "fonte", "faixa", "genero", "if", "mun", "produto")}
        alvos["_coleta_nomes"] = lambda _con, _mes: (0, {})
        with mock.patch.multiple(sicor, **alvos), mock.patch.object(sicor, "CAP_LEVES", 8):
            sicor.collect(con, {})
        recursos = [r for r, _ in ordem]
        self.assertEqual(recursos[0], "mun", "o municipal é o primeiro recurso coletado")
        ultimo_pesado = max(i for i, r in enumerate(recursos) if r in ("mun", "if", "produto"))
        primeiro_leve = min(i for i, r in enumerate(recursos) if r in ("uf", "fonte", "faixa", "genero"))
        self.assertLess(ultimo_pesado, primeiro_leve, "nenhum leve antes de esgotar os pesados")
        # a janela do municipal cobre o atraso de até dois meses da Olinda
        meses_mun = [m for r, m in ordem if r == "mun"]
        self.assertIn(_mes(15), meses_mun)

    def test_orcamentos_separados(self):
        self.assertGreater(sicor.ORCAMENTO_PESADOS_S, 0)
        self.assertGreater(sicor.ORCAMENTO_S, 0)
        # recarga do municipal: 16 meses a cerca de 80 s cada precisam caber nos pesados
        self.assertGreaterEqual(sicor.ORCAMENTO_PESADOS_S, sicor.MESES_MUN * 80)
        # a coleta de 13/10/2026 levou 131 min (26 de SICOR) contra o teto de 150 min
        # de run.py: o SICOR pode crescer no máximo 12,5 min sem pular os coletores seguintes
        self.assertLessEqual(sicor.ORCAMENTO_PESADOS_S + sicor.ORCAMENTO_S, 1500 + 750)


class OlindaIntermitente(unittest.TestCase):
    """13/10/2026: HTTP 500 "Erro desconhecido" em ~1 s, intermitente, nos 16 meses
    do municipal; com 2 tentativas o rural.json saiu sem UFs e municípios."""

    URL_500 = "Falha ao coletar https://olinda.bcb.gov.br/" + "x" * 320 + ": HTTP Error 500: Internal Server Error"

    def _get_com(self, respostas):
        chamadas = []

        def http_get(url, timeout, retries):
            chamadas.append(retries)
            r = respostas.pop(0)
            if isinstance(r, Exception):
                raise r
            return b'{"value": [{"a": 1}]}', {"url": url}

        with mock.patch.object(sicor.common, "http_get", side_effect=http_get), \
                mock.patch.object(sicor._time, "sleep") as dorme:
            try:
                return sicor._get("Recurso", "AnoEmissao eq '2026'"), chamadas, dorme, None
            except RuntimeError as e:
                return None, chamadas, dorme, e

    def test_500_rapido_e_retentado_ate_o_sucesso(self):
        falhas = [RuntimeError(self.URL_500)] * 6
        res, chamadas, dorme, erro = self._get_com(falhas + [None])
        self.assertIsNone(erro)
        rows, meta = res
        self.assertEqual(rows, [{"a": 1}])
        self.assertEqual(meta["attempt"], 7)
        self.assertEqual(len(chamadas), 7)
        self.assertEqual(dorme.call_count, 6)

    def test_500_persistente_desiste_no_limite(self):
        _, chamadas, _, erro = self._get_com([RuntimeError(self.URL_500)] * (sicor.TENTATIVAS_500 + 5))
        self.assertEqual(len(chamadas), sicor.TENTATIVAS_500)
        self.assertIn(f"após {sicor.TENTATIVAS_500} tentativas", str(erro))
        # o limite de espera por mês é curto: não consome o orçamento dos pesados
        # cada tentativa custa ~1 s de resposta, 2 s de espera do http_get e ESPERA_500_S
        self.assertLessEqual(sicor.TENTATIVAS_500 * (sicor.ESPERA_500_S + 3), 200)

    def test_outros_erros_mantem_duas_tentativas(self):
        _, chamadas, _, erro = self._get_com([RuntimeError("Falha ao coletar u: timed out")] * 5)
        self.assertEqual(len(chamadas), 2)
        self.assertIn("timed out", str(erro))

    def test_mensagem_de_falha_preserva_a_causa(self):
        msg = sicor._resumo_erro(RuntimeError(self.URL_500))
        self.assertLessEqual(len(msg), 300)
        self.assertIn("HTTP Error 500", msg)
        self.assertTrue(msg.startswith("Falha ao coletar https://olinda"))


def _linha(mes, valor):
    return (valor, valor, 0, 0.0, 0, 0.0, 0, 0.0)


class JanelaAlinhadaAoMunicipal(unittest.TestCase):
    def _con(self, meses_fonte, meses_mun):
        con = sqlite3.connect(":memory:")
        sicor._ensure(con)
        for m in meses_fonte:
            con.execute("INSERT INTO sicor_fonte VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
                        (m, "RECURSOS LIVRES", "0001", "0", "1", 1, 100.0, 0, 0.0, 0, 0.0, 0, 0.0))
        for m in meses_mun:
            con.execute("INSERT INTO sicor_mun VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                        (m, "3550308", "0001", "0430", "1", 1, 100.0, 0, 0.0, 0, 0.0, 0, 0.0, 0.0, 0.0))
        return con

    def _build(self, con):
        with mock.patch.object(rural.common, "ler_gold_opcional", return_value={}):
            return rural.build(con)

    def test_municipal_atrasado_recua_a_janela_e_declara(self):
        fonte = [_mes(d) for d in range(30, -1, -1)]          # nacional até o mês corrente
        mun = [_mes(d) for d in range(30, 2, -1)]             # municipal parado 3 meses atrás
        g = self._build(self._con(fonte, mun))
        self.assertEqual(g["mes_fechado"], _mes(3))
        self.assertEqual(g["janela"]["fim"], _mes(3))
        self.assertEqual(g["janela_recuada"], {"fim_nacional": _mes(2), "fim_municipal": _mes(3)})
        self.assertTrue(any("recorte municipal" in c and _mes(2) in c for c in g["cautelas"]))
        self.assertEqual(g["municipios_meta"]["janela"]["meses"], 12)

    def test_buraco_no_meio_do_municipal_recua_ate_janela_inteira(self):
        fonte = [_mes(d) for d in range(30, -1, -1)]
        mun = [_mes(d) for d in range(30, 1, -1) if d != 6]   # falta um mês no meio
        g = self._build(self._con(fonte, mun))
        # a primeira janela de 12 meses inteiros nos dois recortes termina antes do buraco
        self.assertEqual(g["janela"]["fim"], _mes(7))
        self.assertEqual(g["janela_recuada"], {"fim_nacional": _mes(2), "fim_municipal": _mes(7)})
        self.assertEqual(g["municipios_meta"]["janela"]["meses"], 12)
        self.assertEqual(len(g["ufs"]), 1)

    def test_sem_atraso_nada_muda(self):
        fonte = [_mes(d) for d in range(30, -1, -1)]
        g = self._build(self._con(fonte, fonte))
        self.assertEqual(g["janela"]["fim"], _mes(2))
        self.assertIsNone(g["janela_recuada"])
        self.assertFalse(any("recorte municipal da MDCR ainda" in c for c in g["cautelas"]))


if __name__ == "__main__":
    unittest.main()
