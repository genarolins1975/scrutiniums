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
        c = meta.get("cvm")
        if c:
            self.tamanhos[c["fonte"]] = (206, c["zip"]["bytes"], c["zip"]["last_modified"])
        sim = (meta.get("saude") or {}).get("definicoes", {}).get("sim")
        if sim:
            self.textos[sim["url"]] = (200, "<html>Dados finais dispon\ufffdveis at\ufffd 2024 - data de extra\ufffd\ufffdo 02/12/2025.</html>")

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

    def test_zip_sem_tamanho_na_resposta_e_nao_verificado(self):
        rede = self.novo()
        z = rede.meta["sinisa"]["zips"]["agua"]
        rede.tamanhos[z["url"]] = (200, None, None)  # servidor ignorou o Range e não informou Content-Length
        linhas = self.rodar(rede)
        self.assertEqual(len(linhas), 1)
        self.assertIn("sem tamanho", linhas[0])
        self.assertIn("não verificado", linhas[0])

    def test_sisagua_sem_tamanho_nem_data_e_nao_verificado(self):
        rede = self.novo()
        a = next(iter(v._arquivos_sisagua(rede.meta)))
        rede.tamanhos[a["url"]] = (200, None, None)
        linhas = self.rodar(rede)
        self.assertEqual(len(linhas), 1)
        self.assertIn("não verificado", linhas[0])

    def test_orcamento_de_tempo_esgotado_reporta_todas_as_fontes(self):
        chamadas = []
        rede = self.novo()
        rede.tamanho = lambda url: chamadas.append(url) or (206, 1, None)
        linhas = v.verificar(rede, HOJE, self.meta, set(self.links), orcamento=-1)
        self.assertEqual(chamadas, [])  # nenhuma consulta depois do teto
        for fonte in ("SINISA", "SISAGUA", "CadÚnico", "CVM", "DATASUS"):
            self.assertTrue(any(fonte in l and "não verificado" in l and "orçamento" in l for l in linhas), fonte)

    def test_pior_caso_de_rede_cabe_no_job_de_10_minutos(self):
        # teto total + a última consulta (3 tentativas) tem de ficar abaixo dos 10 minutos do workflow
        self.assertLess(v.ORCAMENTO_SEGUNDOS + 3 * v.TIMEOUT_REQUISICAO, 10 * 60)

    def test_cvm_so_acusa_arquivo_atualizado_depois_da_captura_quando_ela_ja_tem_90_dias(self):
        cvm = self.meta["cvm"]
        rede = self.novo()
        rede.tamanhos[cvm["fonte"]] = (206, cvm["zip"]["bytes"] + 10, "Wed, 20 Jan 2027 10:00:00 GMT")
        # 16 dias depois da captura: a CVM recebe versões o ano todo, sem acusar
        self.assertEqual([l for l in self.rodar(rede, hoje=date(2026, 11, 1)) if "CVM" in l], [])
        linhas = [l for l in self.rodar(rede, hoje=date(2027, 2, 1)) if "CVM" in l]
        self.assertEqual(len(linhas), 1)
        self.assertIn("20/01/2027", linhas[0])
        self.assertIn("defasada", linhas[0])
        # arquivo que não mudou depois da captura não acusa, por mais velha que ela esteja
        parado = self.novo()
        self.assertEqual([l for l in self.rodar(parado, hoje=date(2027, 2, 1)) if "CVM" in l], [])

    def test_cvm_do_ano_seguinte_publicado_acusa_a_partir_de_junho(self):
        cvm = self.meta["cvm"]
        proximo = cvm["fonte"].replace(f"_{cvm['ano']}.zip", f"_{cvm['ano'] + 1}.zip")
        rede = self.novo()
        rede.tamanhos[proximo] = (206, 1000, "Mon, 08 Jun 2027 10:00:00 GMT")
        self.assertEqual([l for l in self.rodar(rede, hoje=date(2027, 5, 31)) if "CVM" in l], [])
        linhas = [l for l in self.rodar(rede, hoje=date(2027, 6, 8)) if "CVM" in l]
        self.assertEqual(len(linhas), 1)
        self.assertIn(str(cvm["ano"] + 1), linhas[0])

    def test_cvm_fora_do_ar_ou_sem_last_modified_e_nao_verificado(self):
        cvm = self.meta["cvm"]
        rede = self.novo()
        rede.tamanhos[cvm["fonte"]] = (503, None, None)
        linhas = [l for l in self.rodar(rede) if "CVM" in l]
        self.assertEqual(len(linhas), 1)
        self.assertIn("não verificado", linhas[0])
        rede.tamanhos[cvm["fonte"]] = (206, 10, None)
        self.assertIn("sem Last-Modified", [l for l in self.rodar(rede) if "CVM" in l][0])

    def test_datasus_acusa_dados_finais_alem_da_janela_e_vigia_cego_sem_a_nota(self):
        sim = self.meta["saude"]["definicoes"]["sim"]["url"]
        fim = max(self.meta["saude"]["periodo"])
        rede = self.novo()
        rede.textos[sim] = (200, f"<html>Dados finais dispon\ufffdveis at\ufffd {fim + 1} - data de extra\ufffd\ufffdo 01/12/2026.</html>")
        linhas = [l for l in self.rodar(rede) if "DATASUS" in l]
        self.assertEqual(len(linhas), 1)
        self.assertIn(f"até {fim + 1}", linhas[0])
        rede.textos[sim] = (200, "<html>sem nota</html>")
        self.assertIn("cega", [l for l in self.rodar(rede) if "DATASUS" in l][0])
        rede.textos[sim] = (503, "")
        self.assertIn("não verificado", [l for l in self.rodar(rede) if "DATASUS" in l][0])

    def test_corpo_cita_edicao_e_o_que_fazer(self):
        c = v.corpo(["- x"], self.meta)
        self.assertIn(self.meta["sinisa"]["edicao"], c)
        self.assertIn("O que fazer", c)
        self.assertIn("saneamento_sinisa_links.txt", c)


if __name__ == "__main__":
    unittest.main()
