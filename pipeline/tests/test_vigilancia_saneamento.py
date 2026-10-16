import copy
import json
import unittest
import urllib.error
from datetime import date

from scripts import vigilancia_saneamento as v

PAGINA = v.json.loads(v.META.read_text(encoding="utf-8"))["sinisa"]["pagina"]
HOJE = date(2026, 10, 16)


def html(*links):
    return "<html>" + "".join(f'<a href="{l}">x</a>' for l in links) + "</html>"


class RedeFalsa:
    """Rede sem rede: respostas por URL, tudo o mais é 404."""

    def __init__(self, meta, snapshot_links, edicao_seguinte=404, cadunico="202610"):
        self.meta = meta
        self.textos = {PAGINA: (200, html(*snapshot_links))}
        proxima = PAGINA.replace("sinisa-2025", "sinisa-2026")
        self.textos[proxima] = (edicao_seguinte, "")
        self.tamanhos = {}
        for z in meta["sinisa"]["zips"].values():
            self.tamanhos[z["url"]] = (206, z["bytes"], None)
        for a in v._arquivos_sisagua(meta):
            self.tamanhos[a["url"]] = (206, a["bytes"], a["last_modified"])
        self.cadunico = cadunico

    def tamanho(self, url):
        r = self.tamanhos.get(url, (404, None, None))
        if isinstance(r, Exception):
            raise r
        return r

    def texto(self, url):
        r = self.textos.get(url, (404, ""))
        if isinstance(r, Exception):
            raise r
        return r

    def json(self, url, params):
        if self.cadunico is None:
            return {"response": {"docs": []}}
        return {"response": {"docs": [{"anomes_s": self.cadunico}]}}


class VigiliaSaneamento(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.meta = json.loads(v.META.read_text(encoding="utf-8"))
        cls.links = sorted(
            {l.strip() for l in v.SNAPSHOT_LINKS.read_text(encoding="utf-8").splitlines() if l.strip()}
        )

    def novo(self, **kw):
        return RedeFalsa(copy.deepcopy(self.meta), self.links, **kw)

    def rodar(self, rede, snapshot=None, hoje=HOJE):
        return v.verificar(rede, hoje, self.meta, set(self.links) if snapshot is None else snapshot)

    def test_snapshot_versionado_e_a_secao_do_sinisa(self):
        self.assertGreaterEqual(len(self.links), 5)
        for l in self.links:
            self.assertIn(v.SINISA_SECAO, l)

    def test_silencio_quando_nada_mudou(self):
        self.assertEqual(self.rodar(self.novo()), [])

    def test_link_novo_do_sinisa_acusa(self):
        rede = self.novo()
        novo = self.links[0].rsplit("/", 1)[0] + "/SINISA_NOVO_2026.zip"
        rede.textos[PAGINA] = (200, html(*self.links, novo))
        linhas = self.rodar(rede)
        self.assertEqual(len([l for l in linhas if "link novo" in l]), 1)
        self.assertIn("SINISA_NOVO_2026.zip", "\n".join(linhas))

    def test_link_fora_da_secao_do_sinisa_e_ignorado(self):
        rede = self.novo()
        rede.textos[PAGINA] = (200, html(*self.links, "https://www.gov.br/cidades/pt-br/outro-tema/planilha.xlsx"))
        self.assertEqual(self.rodar(rede), [])

    def test_pagina_sem_links_e_vigia_cego(self):
        rede = self.novo()
        rede.textos[PAGINA] = (200, "<html>sem arquivos</html>")
        linhas = self.rodar(rede)
        self.assertEqual(len(linhas), 1)
        self.assertIn("cega", linhas[0])

    def test_pagina_fora_do_ar_e_nao_verificado_nunca_silencio(self):
        rede = self.novo()
        rede.textos[PAGINA] = (503, "")
        linhas = self.rodar(rede)
        self.assertTrue(any("não verificado" in l and "SINISA" in l for l in linhas))
        # as outras fontes continuam sendo vigiadas
        rede = self.novo(cadunico="202701")
        rede.textos[PAGINA] = (503, "")
        self.assertTrue(any("CadÚnico" in l for l in self.rodar(rede)))

    def test_edicao_seguinte_publicada_acusa_e_404_nao(self):
        self.assertEqual(self.rodar(self.novo(edicao_seguinte=404)), [])
        linhas = self.rodar(self.novo(edicao_seguinte=200))
        self.assertTrue(any("edição seguinte está publicada" in l for l in linhas))

    def test_zip_com_tamanho_diferente_acusa(self):
        rede = self.novo()
        z = rede.meta["sinisa"]["zips"]["agua"]
        rede.tamanhos[z["url"]] = (206, z["bytes"] + 1000, None)
        linhas = self.rodar(rede)
        self.assertEqual(len(linhas), 1)
        self.assertIn("retificação", linhas[0])
        self.assertIn(z["arquivo"], linhas[0])

    def test_zip_fora_do_ar_e_nao_verificado(self):
        rede = self.novo()
        z = rede.meta["sinisa"]["zips"]["esgoto"]
        rede.tamanhos[z["url"]] = (403, None, None)
        linhas = self.rodar(rede)
        self.assertEqual(len(linhas), 1)
        self.assertIn("não verificado", linhas[0])

    def test_sisagua_reescrito_dentro_da_tolerancia_nao_acusa(self):
        rede = self.novo()
        a = next(iter(v._arquivos_sisagua(rede.meta)))
        rede.tamanhos[a["url"]] = (206, a["bytes"] + 5000, "Sat, 25 Apr 2026 02:36:24 GMT")  # 28 dias depois
        self.assertEqual(self.rodar(rede), [])

    def test_sisagua_reescrito_alem_da_tolerancia_acusa(self):
        rede = self.novo()
        a = next(iter(v._arquivos_sisagua(rede.meta)))
        rede.tamanhos[a["url"]] = (206, a["bytes"] + 5000, "Mon, 15 Jun 2026 02:36:24 GMT")  # 79 dias depois
        linhas = self.rodar(rede)
        self.assertEqual(len(linhas), 2)
        self.assertIn("SISAGUA", linhas[0])
        self.assertIn(a["url"].rsplit("/", 1)[1], linhas[1])

    def test_sisagua_arquivo_fora_do_ar_e_nao_verificado(self):
        rede = self.novo()
        a = next(iter(v._arquivos_sisagua(rede.meta)))
        rede.tamanhos[a["url"]] = (500, None, None)
        linhas = self.rodar(rede)
        self.assertEqual(len(linhas), 1)
        self.assertIn("não verificado", linhas[0])

    def test_sisagua_ano_novo_so_depois_de_marco_do_ano_seguinte(self):
        ano = max(self.meta["sisagua"]["anos"]) + 1
        rede = self.novo()
        for conjunto in ("controle_mensal_parametros_basicos", "vigilancia_parametros_basicos"):
            rede.tamanhos[f"{v.S3_SISAGUA}{conjunto}_{ano}_csv.zip"] = (206, 1000, "Mon, 15 Jun 2026 02:36:24 GMT")
        self.assertEqual(self.rodar(rede, hoje=date(ano + 1, 2, 28)), [])
        linhas = self.rodar(rede, hoje=date(ano + 1, 3, 1))
        self.assertEqual(len(linhas), 2)
        self.assertIn(str(ano), linhas[0])

    def test_cadunico_ignora_mes_futuro_e_acusa_distancia(self):
        da_gold = self.meta["cadunico"]["mes_mais_recente"]
        self.assertEqual(self.rodar(self.novo(cadunico=da_gold)), [])
        self.assertEqual(self.rodar(self.novo(cadunico="202610")), [])  # 1 mês: dentro do limite
        linhas = self.rodar(self.novo(cadunico="202612"))  # 3 meses
        self.assertEqual(len(linhas), 1)
        self.assertIn("CadÚnico", linhas[0])

    def test_cadunico_sem_resposta_e_nao_verificado(self):
        linhas = self.rodar(self.novo(cadunico=None))
        self.assertEqual(len(linhas), 1)
        self.assertIn("não verificado", linhas[0])

    def test_excecao_de_rede_em_uma_fonte_nao_cala_as_outras(self):
        rede = self.novo(cadunico="202612")
        rede.textos[PAGINA] = urllib.error.URLError("sem rede")
        linhas = self.rodar(rede)
        self.assertTrue(any("SINISA" in l and "não verificado" in l for l in linhas))
        self.assertTrue(any("CadÚnico" in l and "mês" in l for l in linhas))

    def test_corpo_cita_edicao_e_o_que_fazer(self):
        c = v.corpo(["- x"], self.meta)
        self.assertIn(self.meta["sinisa"]["edicao"], c)
        self.assertIn("O que fazer", c)
        self.assertIn("saneamento_sinisa_links.txt", c)


if __name__ == "__main__":
    unittest.main()
