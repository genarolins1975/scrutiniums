"""Vigília de frescor por domínio (scripts/vigilancia_frescor.py).

A regra é a mesma da faixa de frescor das páginas (src/lib/frescor/regras.ts):
os casos de src/lib/frescor/casos.json são conferidos aqui e no vitest. O
resto testa a vigília com arquivos e um gh sintéticos: domínio em dia não abre
issue, atrasado abre, issue aberta recebe comentário em vez de duplicata, sem
data também acusa e domínio que volta a ficar em dia fecha a issue.
"""
import json
import unittest
from datetime import datetime, timezone
from pathlib import Path

from scripts import vigilancia, vigilancia_frescor as v

RAIZ = Path(__file__).resolve().parents[2]
CASOS = json.loads((RAIZ / "src" / "lib" / "frescor" / "casos.json").read_text(encoding="utf-8"))
LIMIARES = v.carregar_limiares()
AGORA = datetime(2026, 10, 19, 12, 0, tzinfo=timezone.utc)


def quando(iso):
    return datetime.fromisoformat(iso.replace("Z", "+00:00"))


def iso_ms(t):
    t = t.astimezone(timezone.utc)
    return t.strftime("%Y-%m-%dT%H:%M:%S.") + f"{t.microsecond // 1000:03d}Z"


class CasosCompartilhados(unittest.TestCase):
    def test_situacao(self):
        for c in CASOS["situacao"]:
            with self.subTest(c["nome"]):
                s = v.situacao(LIMIARES, c["dados"], quando(c["agora"]))
                self.assertEqual({k: s[k] for k in c["esperado"]}, c["esperado"])

    def test_campos(self):
        for c in CASOS["campos"]:
            with self.subTest(c["campo"]):
                self.assertEqual(v.valores_no_campo(c["objeto"], c["campo"]), c["valores"])

    def test_instantes(self):
        for c in CASOS["instantes"]:
            with self.subTest(repr(c["valor"])):
                t = v.instante(c["valor"])
                self.assertEqual(iso_ms(t) if t else None, c["iso"])

    def test_referencias(self):
        for c in CASOS["referencias"]:
            with self.subTest(repr(c["valor"])):
                self.assertEqual(v.referencia_normal(c["valor"]), c["normal"])

    def test_extracao(self):
        for c in CASOS["extracao"]:
            with self.subTest(c["nome"]):
                def ler(arquivo, arquivos=c["arquivos"]):
                    if arquivo not in arquivos:
                        raise FileNotFoundError(arquivo)
                    return arquivos[arquivo]
                self.assertEqual(v.extrair(LIMIARES, c["dominio"], ler), c["esperado"])


class Limiares(unittest.TestCase):
    def test_cada_dominio_tem_cadencia_conhecida_e_origens(self):
        for nome, d in LIMIARES["dominios"].items():
            with self.subTest(nome):
                self.assertIn(d["cadencia"], LIMIARES["cadencias"])
                self.assertTrue(d["publicacao"] and d["referencia"])
                for o in d["publicacao"] + d.get("partes", []) + d["referencia"]:
                    self.assertTrue((RAIZ / o["arquivo"]).exists(), o["arquivo"])

    def test_limiar_nunca_menor_que_o_intervalo(self):
        for nome, c in LIMIARES["cadencias"].items():
            with self.subTest(nome):
                self.assertGreaterEqual(c["limite"], c["intervalo"])

    def test_a_vigilia_do_credito_usa_o_mesmo_limiar(self):
        # publicação semanal desde 01/11/2026: cadência semanal, limiar de 8 dias
        self.assertEqual(vigilancia.LIMITE_DIAS, LIMIARES["cadencias"]["semanal"]["limite"])
        self.assertEqual(vigilancia.LIMITE_DIAS, 8)

    def test_arquivos_publicados_trazem_data_em_todo_dominio(self):
        # um campo renomeado no pipeline viraria "data não informada" na página: aqui reprova antes
        for nome in LIMIARES["dominios"]:
            with self.subTest(nome):
                dados = v.extrair(LIMIARES, nome, v.ler_do_checkout)
                self.assertIsNotNone(dados["publicadoEm"])
                self.assertIsNotNone(dados["referencia"])


class GhFalso:
    """Registra as chamadas; responde à listagem com as issues abertas que conhece."""

    def __init__(self, abertas=None):
        self.abertas = dict(abertas or {})
        self.chamadas = []

    def __call__(self, args):
        self.chamadas.append(args)
        if args[:2] == ["issue", "list"]:
            return json.dumps([{"number": n, "title": t} for t, n in self.abertas.items()])
        return ""

    def de(self, acao):
        return [c for c in self.chamadas if c[:2] == ["issue", acao]]


def limiares_so(*dominios):
    return {**LIMIARES, "dominios": {k: LIMIARES["dominios"][k] for k in dominios}}


META_CREDITO = "public/obs/data/gold/meta.json"


def leitor(arquivos):
    def ler(arquivo):
        if arquivo not in arquivos:
            raise FileNotFoundError(arquivo)
        return arquivos[arquivo]
    return ler


class Vigiar(unittest.TestCase):
    def test_em_dia_nao_abre_issue(self):
        gh = GhFalso()
        r = v.vigiar(limiares_so("credito"), leitor({META_CREDITO: {"gerado_em": "2026-10-19T09:30:00+00:00", "vintages": {"sgs": "2026-08"}}}), AGORA, "dono/repo", "dono", gh)
        self.assertEqual(r, ["credito: em dia"])
        self.assertEqual(gh.de("create") + gh.de("comment") + gh.de("close"), [])

    def test_atrasado_abre_uma_issue_com_responsavel(self):
        gh = GhFalso()
        r = v.vigiar(limiares_so("credito"), leitor({META_CREDITO: {"gerado_em": "2026-09-24T15:25:15+00:00", "vintages": {"sgs": "2026-08"}}}), AGORA, "dono/repo", "dono", gh)
        self.assertEqual(r, ["credito: atrasado; issue aberta"])
        [criar] = gh.de("create")
        self.assertIn("Vigília de frescor: Crédito", criar)
        self.assertEqual(criar[criar.index("--assignee") + 1], "dono")
        corpo = criar[criar.index("--body") + 1]
        self.assertIn("Atualização atrasada há 17 dias", corpo)
        self.assertIn("24/09/2026", corpo)
        self.assertIn("src/lib/frescor/limiares.json", corpo)

    def test_issue_aberta_recebe_comentario_e_nao_duplica(self):
        titulo = v.titulo_issue(LIMIARES, "credito")
        gh = GhFalso({titulo: 412, "Vigília de frescor: Crédito (antiga, outro título)": 7})
        r = v.vigiar(limiares_so("credito"), leitor({META_CREDITO: {"gerado_em": "2026-09-24T15:25:15+00:00"}}), AGORA, "dono/repo", "dono", gh)
        self.assertEqual(r, ["credito: atrasado; comentário na issue #412"])
        self.assertEqual(gh.de("create"), [])
        [comentario] = gh.de("comment")
        self.assertEqual(comentario[2], "412")

    def test_sem_data_tambem_acusa(self):
        gh = GhFalso()
        r = v.vigiar(limiares_so("gas"), leitor({}), AGORA, "dono/repo", None, gh)
        self.assertEqual(r, ["gas: sem-data; issue aberta"])
        [criar] = gh.de("create")
        self.assertNotIn("--assignee", criar)
        self.assertIn("Sem data de publicação legível", criar[criar.index("--body") + 1])

    def test_retida_em_parte_acusa_com_as_duas_datas(self):
        gh = GhFalso()
        meta = {"gerado_em": "2026-09-24T15:25:15+00:00", "grupos": {"pulse": {"gerado_em": "2026-10-18T15:09:35+00:00"}, "juros": {"gerado_em": "2026-09-24T15:25:15+00:00"}}}
        r = v.vigiar(limiares_so("credito"), leitor({META_CREDITO: meta}), AGORA, "dono/repo", "dono", gh)
        self.assertEqual(r, ["credito: retida; issue aberta"])
        corpo = gh.de("create")[0][-3]
        self.assertIn("Publicação retida em parte há 17 dias", corpo)
        self.assertIn("18/10/2026", corpo)

    def test_volta_em_dia_comenta_e_fecha(self):
        titulo = v.titulo_issue(LIMIARES, "credito")
        gh = GhFalso({titulo: 412})
        r = v.vigiar(limiares_so("credito"), leitor({META_CREDITO: {"gerado_em": "2026-10-19T09:30:00+00:00"}}), AGORA, "dono/repo", "dono", gh)
        self.assertEqual(r, ["credito: em dia; issue #412 fechada"])
        self.assertEqual(gh.de("comment")[0][2], "412")
        self.assertEqual(gh.de("close")[0][2], "412")

    def test_um_titulo_por_dominio(self):
        titulos = [v.titulo_issue(LIMIARES, d) for d in LIMIARES["dominios"]]
        self.assertEqual(len(titulos), len(set(titulos)))


if __name__ == "__main__":
    unittest.main()


class VigiliaDoCreditoSemanal(unittest.TestCase):
    """Publicação semanal (01/11/2026): gold com 7 dias não acusa; a produção atrás do main só acusa depois da
    publicação semanal (segunda, 16:07 UTC) mais a folga do deploy."""

    def _frescor(self, gerado_main, gerado_prod, agora):
        from unittest import mock

        def baixa(url, timeout=60):
            g = gerado_prod if url == vigilancia.META_PRODUCAO else gerado_main
            return json.dumps({"gerado_em": g, "vintages": {}}).encode()

        class Relogio(datetime):
            @classmethod
            def now(cls, tz=None):
                return agora

        with mock.patch.object(vigilancia, "_baixa", baixa), mock.patch.object(vigilancia, "datetime", Relogio):
            return vigilancia.frescor()

    def test_gold_com_sete_dias_nao_acusa_e_com_oito_acusa(self):
        segunda = datetime(2026, 11, 9, 18, 0, tzinfo=timezone.utc)
        self.assertEqual(self._frescor("2026-11-02T11:00:00+00:00", "2026-11-02T11:00:00+00:00", segunda), 0)
        self.assertEqual(self._frescor("2026-11-02T11:00:00+00:00", "2026-11-02T11:00:00+00:00",
                                       datetime(2026, 11, 10, 11, 0, tzinfo=timezone.utc)), vigilancia.ACUSA)

    def test_producao_atras_do_main_antes_da_publicacao_semanal_nao_acusa(self):
        # coleta de segunda gravou o main às 11:00; a publicação é às 16:07: às 15:00 a produção atrás é o normal
        self.assertEqual(self._frescor("2026-11-09T11:00:00+00:00", "2026-11-02T11:00:00+00:00",
                                       datetime(2026, 11, 9, 15, 0, tzinfo=timezone.utc)), 0)
        # gold do main gravado numa quarta (disparo manual) fica para a publicação seguinte
        self.assertEqual(self._frescor("2026-11-11T11:00:00+00:00", "2026-11-09T11:00:00+00:00",
                                       datetime(2026, 11, 13, 12, 0, tzinfo=timezone.utc)), 0)

    def test_producao_atras_depois_da_publicacao_e_da_folga_acusa(self):
        self.assertEqual(self._frescor("2026-11-09T11:00:00+00:00", "2026-11-02T11:00:00+00:00",
                                       datetime(2026, 11, 9, 19, 30, tzinfo=timezone.utc)), vigilancia.ACUSA)
        self.assertEqual(self._frescor("2026-11-09T11:00:00+00:00", "2026-11-02T11:00:00+00:00",
                                       datetime(2026, 11, 9, 18, 0, tzinfo=timezone.utc)), 0)

    def test_ultima_publicacao_semanal(self):
        u = vigilancia.ultima_publicacao_semanal
        self.assertEqual(u(datetime(2026, 11, 9, 16, 7, tzinfo=timezone.utc)), datetime(2026, 11, 9, 16, 7, tzinfo=timezone.utc))
        self.assertEqual(u(datetime(2026, 11, 9, 16, 6, tzinfo=timezone.utc)), datetime(2026, 11, 2, 16, 7, tzinfo=timezone.utc))
        self.assertEqual(u(datetime(2026, 11, 15, 23, 0, tzinfo=timezone.utc)), datetime(2026, 11, 9, 16, 7, tzinfo=timezone.utc))

    def test_restaurado_e_vintage_toleram_a_coleta_semanal(self):
        self.assertEqual(vigilancia.RESTAURADO_MAX_DIAS, 8)
        self.assertEqual(vigilancia.ATRASO_COLETA_SEMANAL_DIAS, 7)
