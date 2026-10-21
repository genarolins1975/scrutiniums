"""Conferência agendada das Contas Estaduais (pipeline/contas_estaduais/conferir.py), sem rede."""
import contextlib
import datetime as dt
import io
import json
import unittest
from urllib.parse import parse_qs, urlparse

from pipeline.contas_estaduais import conferir as C


def _arquivadas():
    """Respostas arquivadas de verdade (public/contas-estaduais/evidencias), lidas como o Siconfi as serviu."""
    respostas = {}
    for pasta, registro in C.manifestos():
        for pagina in registro["paginas"]:
            respostas[pagina["url"]] = (pasta / (registro["uf"] + "-" + registro["fonte"]) / pagina["arquivo"]).read_bytes()
    return respostas


class Siconfi:
    """Siconfi falso: serve as respostas arquivadas e, para períodos não integrados, o que o teste mandar."""

    def __init__(self, arquivadas, novos=None, falhar=()):
        self.arquivadas, self.novos, self.falhar = dict(arquivadas), novos or {}, set(falhar)

    def __call__(self, url):
        q = parse_qs(urlparse(url).query)
        uf = next(k for k, v in C.UFS.items() if str(v) == q["id_ente"][0])
        if uf in self.falhar:
            raise TimeoutError("tempo esgotado")
        if url in self.arquivadas:
            return self.arquivadas[url]
        chave = (urlparse(url).path.rsplit("/", 1)[1], int(q["an_exercicio"][0]), int(q["nr_periodo"][0]))
        itens = [{"uf": uf}] if uf in self.novos.get(chave, ()) else []
        return json.dumps({"items": itens, "hasMore": False}).encode()


class Conferencia(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.arquivadas = _arquivadas()
        cls.registros = C.manifestos()

    def test_respostas_iguais_e_nenhum_periodo_novo_e_silencio(self):
        div, nv, n = C.conferir_arquivadas(self.registros, Siconfi(self.arquivadas))
        self.assertEqual((div, nv), ([], []))
        self.assertEqual(n, len(self.arquivadas))
        sond = C.sondar(C.candidatos(self.registros, dt.date(2026, 10, 19)), Siconfi(self.arquivadas))
        self.assertIsNone(C.corpo(div, nv, n, sond))

    def test_conteudo_diferente_do_arquivado_e_acusado(self):
        url = next(u for u in self.arquivadas if "id_ente=42" in u and "an_exercicio=2026" in u)
        alterado = dict(self.arquivadas)
        alterado[url] = json.dumps({"items": [], "hasMore": False}).encode()
        div, _, _ = C.conferir_arquivadas(self.registros, Siconfi(alterado))
        self.assertEqual(len(div), 1)
        self.assertIn("SC RGF 2026", div[0])
        self.assertIn("0 servidas hoje", div[0])

    def test_ordem_das_chaves_nao_e_divergencia(self):
        url = next(iter(self.arquivadas))
        pagina = json.loads(self.arquivadas[url])
        pagina["items"] = [dict(reversed(list(i.items()))) for i in pagina["items"]]
        reordenado = dict(self.arquivadas)
        reordenado[url] = json.dumps(pagina).encode()
        div, _, _ = C.conferir_arquivadas(self.registros, Siconfi(reordenado))
        self.assertEqual(div, [])

    def test_candidatos_seguem_o_calendario(self):
        self.assertEqual(C.candidatos(self.registros, dt.date(2026, 10, 19)),
                         [("rgf", 2026, 2), ("rgf", 2026, 3), ("rreo", 2026, 6)])
        self.assertIn(("rgf", 2027, 1), C.candidatos(self.registros, dt.date(2027, 6, 5)))

    def test_periodo_novo_e_falha_viram_corpo_da_issue(self):
        siconfi = Siconfi(self.arquivadas, novos={("rgf", 2026, 2): {"PE", "SP"}}, falhar={"AC"})
        div, nv, n = C.conferir_arquivadas(self.registros, siconfi)
        sond = C.sondar(C.candidatos(self.registros, dt.date(2026, 10, 19)), siconfi)
        texto = C.corpo(div, nv, n, sond)
        self.assertIn("RGF 2026, período 2: 2 de 27 UFs com registro (PE, SP)", texto)
        self.assertIn("Não verificado", texto)
        self.assertIn("AC", texto)
        self.assertRegex(texto, r"\nAssinatura: [0-9a-f]{16}\n$")
        # a mesma situação gera a mesma assinatura (sem comentário repetido no mês seguinte)
        self.assertEqual(texto.splitlines()[-1], C.corpo(div, nv, n, sond).splitlines()[-1])

    def test_conferencia_cega_falha(self):
        tudo = {u for u in C.UFS}
        with contextlib.redirect_stdout(io.StringIO()):
            codigo = C.main([], buscar=Siconfi(self.arquivadas, falhar=tudo), hoje=dt.date(2026, 10, 19))
        self.assertEqual(codigo, 1)

    def test_contrato_de_saida(self):
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(C.main([], buscar=Siconfi(self.arquivadas), hoje=dt.date(2026, 10, 19)), 0)
            novos = Siconfi(self.arquivadas, novos={("rgf", 2026, 2): {"PE"}})
            self.assertEqual(C.main([], buscar=novos, hoje=dt.date(2026, 10, 19)), 3)


if __name__ == "__main__":
    unittest.main()
