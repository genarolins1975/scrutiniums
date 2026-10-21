"""Crédito rural (MDCR/Sicor): as travas da pane de 03 a 13/10/2026.

1. A coleta roda os recursos pesados (município primeiro) ANTES da cauda histórica
   dos leves, com orçamento próprio: a recarga da história nunca mais deixa a janela
   publicada sem município.
2. A janela publicada só termina num mês que existe no nacional E no municipal;
   o recuo é declarado no payload e nas cautelas.
3. O HTTP 500 intermitente da Olinda é retentado com espera curta, e a mensagem
   de falha no log preserva a causa.
4. O nacional (FonteRecursos) de um mês nunca é de fotografia anterior à do municipal.
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


class FotografiaAlinhada(unittest.TestCase):
    """14/10/2026: municipal recoletado inteiro, nacional de coletas anteriores; as UFs
    (municipal) ficaram R$ 731,8 mi acima do total (FonteRecursos) e a gold foi retida."""

    def _silver(self, registros):
        con = sqlite3.connect(":memory:")
        sicor._ensure(con)
        con.executemany("INSERT INTO sicor_coleta VALUES(?,?,?,?,1)",
                        [(rec, mes, quando, 1) for rec, mes, quando in registros])
        return con

    def _coleta(self, con):
        ordem = []

        def fake(recurso):
            def fn(_con, mes):
                ordem.append((recurso, mes))
                return 0, {}
            return fn

        alvos = {f"_coleta_{r}": fake(r) for r in ("uf", "fonte", "faixa", "genero", "if", "mun", "produto")}
        alvos["_coleta_nomes"] = lambda _con, _mes: (0, {})
        with mock.patch.multiple(sicor, **alvos), mock.patch.object(sicor, "CAP_LEVES", 40), \
                mock.patch.object(sicor, "CAP_PESADOS", 0), mock.patch.object(sicor.common, "record_lineage"):
            sicor.collect(con, {})
        return [x for x in ordem if x[0] in ("uf", "fonte", "faixa", "genero")]

    def test_nacional_anterior_ao_municipal_e_recoletado_primeiro(self):
        m = _mes(4)
        con = self._silver([("mun", m, "2026-10-14T15:00:00+00:00"),
                            ("fonte", m, "2026-10-04T15:00:00+00:00"),
                            ("faixa", m, "2026-10-04T15:00:00+00:00"),
                            ("uf", m, "2026-10-04T15:00:00+00:00"),
                            ("genero", m, "2026-10-04T15:00:00+00:00")])
        self.assertEqual(sicor._desalinhados(con), [("fonte", m)])
        leves = self._coleta(con)
        self.assertEqual(leves[0], ("fonte", m), "o alinhamento vem antes de qualquer leve")
        for outro in ("uf", "faixa", "genero"):
            self.assertNotIn((outro, m), leves, "só o nacional que fecha ao centavo com o municipal é refeito")
        self.assertEqual(sicor._desalinhados(con), [], "depois da coleta, os dois recortes são da mesma fotografia")

    def test_nacional_posterior_ao_municipal_fica(self):
        m = _mes(4)
        con = self._silver([("mun", m, "2026-10-14T15:00:00+00:00"),
                            ("fonte", m, "2026-10-14T15:20:00+00:00")])
        self.assertEqual(sicor._desalinhados(con), [])
        self.assertNotIn(("fonte", m), self._coleta(con))

    def test_mes_sem_municipal_nao_forca_nada(self):
        con = self._silver([("fonte", _mes(4), "2026-10-04T15:00:00+00:00")])
        self.assertEqual(sicor._desalinhados(con), [])


class FotografiaPeloValor(unittest.TestCase):
    """17/10/2026: UFs (municipal) R$ 60.975.420,30 acima do total (FonteRecursos), com o
    nacional coletado DEPOIS do municipal em todos os meses. Por mês: 2026-08 +71.056.736,54
    (municipal 15/10 16:00, FonteRecursos 15/10 16:17 idêntico ao centavo à medição de 14/10);
    2026-06 -9.982.816,24 (o municipal é que veio igual ao de 14/10); 2026-02 -98.500,00
    (FonteRecursos um dia depois do municipal). A hora da coleta não prova a fotografia."""

    def _silver(self, mes, vm, vf, quando_mun, quando_fonte):
        con = sqlite3.connect(":memory:")
        sicor._ensure(con)
        self._grava(con, mes, vm, vf)
        con.executemany("INSERT INTO sicor_coleta VALUES(?,?,?,?,1)",
                        [("mun", mes, quando_mun, 1), ("fonte", mes, quando_fonte, 1)])
        return con

    @staticmethod
    def _grava(con, mes, vm=None, vf=None):
        if vm is not None:
            con.execute("DELETE FROM sicor_mun WHERE mes=?", (mes,))
            con.execute("INSERT INTO sicor_mun VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                        (mes, "5101837", "0001", "0430", "1", 1, vm, 0, 0.0, 0, 0.0, 0, 0.0, 0.0, 0.0))
        if vf is not None:
            con.execute("DELETE FROM sicor_fonte WHERE mes=?", (mes,))
            con.execute("INSERT INTO sicor_fonte VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
                        (mes, "RECURSOS LIVRES", "0001", "0", "1", 1, vf, 0, 0.0, 0, 0.0, 0, 0.0))

    def _coleta(self, con, valor_hoje):
        """Coleta com a Olinda servindo a mesma fotografia aos dois recortes."""
        ordem = []

        def fake(recurso):
            def fn(c, mes):
                ordem.append((recurso, mes))
                if recurso == "mun":
                    self._grava(c, mes, vm=valor_hoje)
                elif recurso == "fonte":
                    self._grava(c, mes, vf=valor_hoje)
                return 1, {}
            return fn

        alvos = {f"_coleta_{r}": fake(r) for r in ("uf", "fonte", "faixa", "genero", "if", "mun", "produto")}
        alvos["_coleta_nomes"] = lambda _con, _mes: (0, {})
        with mock.patch.multiple(sicor, **alvos), mock.patch.object(sicor, "CAP_LEVES", 40), \
                mock.patch.object(sicor.common, "record_lineage"):
            sicor.collect(con, {})
        return ordem

    def test_mesma_execucao_valores_diferentes_refaz_o_par(self):
        m = _mes(2)  # 2026-08 em 17/10: o mês final da janela
        con = self._silver(m, 34_476_964_402.59, 34_405_907_666.05,
                           "2026-10-15T16:00:13+00:00", "2026-10-15T16:17:14+00:00")
        self.assertEqual(sicor._desalinhados(con), [], "pela hora, o par parecia alinhado")
        ordem = self._coleta(con, 34_519_397_258.41)
        self.assertIn(("mun", m), ordem, "mês fechado que não fecha ao centavo volta a ser coletado")
        self.assertGreater(ordem.index(("fonte", m)), ordem.index(("mun", m)), "o nacional vem depois do municipal")
        self.assertEqual(sicor._divergentes(con), [], "depois da coleta, os dois recortes fecham ao centavo")

    def test_nacional_de_outro_dia_com_valor_diferente_refaz_o_par(self):
        m = _mes(8)  # 2026-02 em 17/10
        con = self._silver(m, 19_914_865_304.34, 19_914_963_804.34,
                           "2026-10-15T16:13:07+00:00", "2026-10-16T14:45:03+00:00")
        self.assertIn(("mun", m), self._coleta(con, 19_914_963_804.34))
        self.assertEqual(sicor._divergentes(con), [])

    def test_par_que_fecha_nao_e_refeito(self):
        m = _mes(5)
        con = self._silver(m, 31_833_696_093.82, 31_833_696_093.82,
                           "2026-10-15T16:09:39+00:00", "2026-10-15T16:29:37+00:00")
        ordem = self._coleta(con, 1.0)
        self.assertNotIn(("mun", m), ordem, "mês fechado que fecha ao centavo não custa requisição pesada")
        self.assertNotIn(("fonte", m), ordem)


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
