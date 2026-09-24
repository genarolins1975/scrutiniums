"""Nota, validador, sentinelas, registro de erros, verificador de fonte, orquestrador e métricas.

Tudo sobre insumos congelados (pesquisa/sentinelas/gold e pacote.json): nada depende da gold do
dia nem de rede. Rodar: python3 -m unittest discover -s pesquisa/tests -t .
"""
import copy
import json
import os
import shutil
import tempfile
import unittest

from pesquisa import fatos_conjuntura as fc
from pesquisa import metricas
from pesquisa import nota as nt
from pesquisa import orquestrador as oq
from pesquisa import registro
from pesquisa import sentinela
from pesquisa import validador as vd
from pesquisa import verificador_fonte as vf

DIR = sentinela.DIR
GOLD_FIXA = os.path.join(DIR, "gold")


def _ler(nome):
    with open(os.path.join(DIR, nome), encoding="utf-8") as f:
        return f.read()


PACOTE = json.loads(_ler("pacote.json"))
LIMPA = _ler("nota_limpa.md")


class InsumosCongelados(unittest.TestCase):
    def test_pacote_das_sentinelas_deriva_da_gold_congelada(self):
        self.assertEqual(fc.construir(GOLD_FIXA)["sha256_fatos"], PACOTE["sha256_fatos"])
        self.assertEqual(fc.verificar(PACOTE, GOLD_FIXA), [])


class Nota(unittest.TestCase):
    def test_renderizacao_deterministica_e_sem_marcador_residual(self):
        a, b = nt.renderizar(LIMPA, PACOTE), nt.renderizar(LIMPA, PACOTE)
        self.assertEqual(a, b)
        self.assertNotIn("{{", a)
        self.assertNotIn("p.p..", a)
        self.assertIn("R$ 7,37 trilhões", a)
        self.assertIn("jun/2026", a)  # fato defasado com a própria data
        self.assertIn(nt.FRASE_REVISAO, a)

    def test_forma_sem_sinal_e_data(self):
        self.assertEqual(nt.substituir("{{taxa_total.delta_mes_pp|abs}}", PACOTE), "1,25 p.p.")
        self.assertEqual(nt.substituir("{{taxa_total.delta_mes_pp}}", PACOTE), "−1,25 p.p.")
        self.assertEqual(nt.substituir("{{data:endividamento.nivel}} {{fonte:inad_total.nivel}}", PACOTE),
                         "jun/2026 BCB/SGS 21082")

    def test_tabela_de_fontes_cobre_todo_fato_citado(self):
        final = nt.renderizar(LIMPA, PACOTE)
        fatos = {f["id"]: f for f in PACOTE["fatos"]}
        for b in nt.ler_nota(LIMPA)[1]:
            for _i, _f, modo, fid, _a in nt.marcadores(b["texto"]):
                if fid in fatos:
                    self.assertIn(f"| {fatos[fid]['rotulo']} |", final)

    def test_manifesto_amarra_gold_fatos_constituicao_e_texto(self):
        v = vd.validar(LIMPA, PACOTE)
        m = nt.manifesto(PACOTE, LIMPA, nt.renderizar(LIMPA, PACOTE), v)
        self.assertEqual(m["sha256_fatos"], PACOTE["sha256_fatos"])
        self.assertEqual(m["gold"], PACOTE["gold"])
        self.assertEqual(len(m["constituicao_sha256"]), 64)
        self.assertEqual(m["validador"]["decisao"], "aprovar")


class Validador(unittest.TestCase):
    def test_nota_limpa_aprovada(self):
        r = vd.validar(LIMPA, PACOTE)
        self.assertEqual((r["decisao"], r["itens"]), ("aprovar", []))

    def test_bateria_sentinela_recall_total_e_zero_falso_bloqueio(self):
        r = sentinela.rodar()
        erros = [x for x in r["resultados"] if not x["acerto"]]
        self.assertEqual(erros, [])
        self.assertGreaterEqual(r["n_casos"], 30)
        self.assertEqual(r["falso_bloqueio"], 0)

    def test_toda_checagem_tem_ao_menos_um_caso_sentinela(self):
        casos = json.loads(_ler("casos.json"))["casos"]
        cobertos = {c for x in casos for c in x["esperado"]["codigos"]}
        self.assertEqual(cobertos, {f"M{i}" for i in range(1, 12)})

    def test_caso_invalido_falha_alto(self):
        with self.assertRaises(ValueError):
            sentinela.aplicar({"id": "X", "substituir": [["trecho que não existe", "y"]]}, LIMPA, PACOTE)

    def test_m1_confere_contra_a_gold(self):
        p = copy.deepcopy(PACOTE)
        next(f for f in p["fatos"] if f["id"] == "inad_total.nivel")["valor"] = 4.99
        p["sha256_fatos"] = fc.sha256_fatos(p["fatos"])
        texto = sentinela._cabecalho(LIMPA, {"pacote_sha256": p["sha256_fatos"]})
        self.assertEqual(vd.validar(texto, p)["decisao"], "aprovar")  # sem gold, o hash novo passa
        r = vd.validar(texto, p, GOLD_FIXA)
        self.assertEqual(r["decisao"], "bloquear")
        self.assertIn("M1", r["falhas"])

    def test_bloqueio_prevalece_sobre_devolucao(self):
        caso = {"id": "X", "substituir": [["acima de noventa dias", "acima de 90 dias"],
                                          ["com alta de {{concessoes_total.var_12m_pct|abs}}", "com forte alta de {{concessoes_total.var_12m_pct|abs}}"]]}
        t, p = sentinela.aplicar(caso, LIMPA, PACOTE)
        r = vd.validar(t, p)
        self.assertEqual(r["decisao"], "bloquear")
        self.assertEqual(r["falhas"], ["M3", "M7"])


class Registro(unittest.TestCase):
    def test_registro_versionado_valido(self):
        self.assertEqual(registro.validar(registro.carregar()), [])

    def test_validacao_acusa_defeitos(self):
        reg = {"erros": [{"id": "E1", "gravidade": "grave", "canal_deteccao": "x", "tipo": "numero",
                          "data_publicacao": "2026-09-10", "data_deteccao": "2026-09-01"}]}
        prob = " ".join(registro.validar(reg))
        for trecho in ("fora do padrão", "gravidade inválida", "canal inválido", "detectado antes", "ausente"):
            self.assertIn(trecho, prob)

    def test_erro_relevante_em_nota_rebaixa(self):
        reg = {"erros": [{"tipo_nota": "conjuntura", "gravidade": "relevante", "publicado": True}]}
        self.assertTrue(registro.erro_relevante_publicado(reg, "conjuntura"))
        self.assertFalse(registro.erro_relevante_publicado(registro.carregar(), "conjuntura"))


class VerificadorFonte(unittest.TestCase):
    def _gold(self):
        return vf.valores_da_gold(PACOTE, GOLD_FIXA)

    def test_conferido_quando_a_fonte_bate(self):
        g = self._gold()
        serie_por_codigo = {s["codigo"]: k for k, s in vf.pontos_por_serie(PACOTE).items()}
        r = vf.verificar(PACOTE, buscar=lambda cod, ini, fim: g[serie_por_codigo[cod]], valores_gold=g)
        self.assertEqual(r["resumo"], {"conferido": 18, "divergente": 0, "nao_verificado": 0})

    def test_divergencia_e_falha_de_rede(self):
        g = self._gold()
        serie_por_codigo = {s["codigo"]: k for k, s in vf.pontos_por_serie(PACOTE).items()}

        def buscar(cod, ini, fim):
            serie = serie_por_codigo[cod]
            if serie == "credito_pib":
                raise OSError("HTTP Error 502: Bad Gateway")
            dados = dict(g[serie])
            if serie == "inad_total":
                dados["2026-06-01"] = 4.68  # a fonte revisou (ou a gold errou)
            return dados
        r = vf.verificar(PACOTE, buscar=buscar, valores_gold=g)
        self.assertEqual(r["series"]["credito_pib"]["estado"], "nao_verificado")
        self.assertEqual(r["series"]["inad_total"]["estado"], "divergente")
        self.assertEqual(r["resumo"], {"conferido": 16, "divergente": 1, "nao_verificado": 1})


# ---------------------------------------------------------------- orquestrador

ANALISTA = """[EVIDÊNCIA] A inadimplência das pessoas físicas ficou em {{inad_pf.nivel}}.

DESTAQUES: inad_pf.delta_mes_pp, saldo_pf.var_mes_pct, taxa_pf.delta_mes_pp, spread_pf.delta_mes_pp, comprometimento.delta_mes_pp
LEITURA: deterioração
"""
REPLICADOR = """DESTAQUES_FAMILIAS: inad_pf.delta_mes_pp, saldo_pf.var_mes_pct, taxa_pf.delta_mes_pp, concessoes_pf.var_12m_pct, endividamento.nivel
LEITURA_FAMILIAS: deterioração
DESTAQUES_EMPRESAS: inad_pj.delta_mes_pp, saldo_pj.var_mes_pct, taxa_pj.delta_mes_pp, spread_pj.delta_mes_pp, credito_pib.delta_mes_pp
LEITURA_EMPRESAS: misto
"""
CONSTITUCIONAL = "C1: ok\nC2: ok\nC3: ok\nC4: ok\nDECISÃO: aprovar\n"


def backend_simulado(chamadas):
    """Primeira revisão devolve nota com adjetivo proibido; a segunda corrige."""
    def backend(etapa, sistema, usuario, papel_cfg, ciclo=None):
        chamadas.append((etapa, usuario))
        if etapa.startswith("analista"):
            texto = ANALISTA
        elif etapa == "replicador":
            texto = REPLICADOR
        elif etapa == "critico":
            texto = "SEM OBJEÇÕES"
        elif etapa == "validador_constitucional":
            texto = CONSTITUCIONAL
        elif etapa == "revisao" and sum(1 for e, _ in chamadas if e == "revisao") == 1:
            texto = LIMPA.replace("com alta de {{concessoes_total.var_12m_pct|abs}}", "com forte alta de {{concessoes_total.var_12m_pct|abs}}")
        else:
            texto = LIMPA
        return texto, {"modelo_pedido": papel_cfg["modelo"], "modelo_respondeu": papel_cfg["modelo"],
                       "fallback": False, "input_tokens": 1000, "output_tokens": 200}
    return backend


class Orquestrador(unittest.TestCase):
    def setUp(self):
        os.makedirs(oq.NOTAS, exist_ok=True)
        self.base = tempfile.mkdtemp(prefix="teste_", dir=oq.NOTAS)
        self.ciclo = os.path.join(self.base, "2026-07")

    def tearDown(self):
        shutil.rmtree(self.base, ignore_errors=True)

    def test_ciclo_completo_com_uma_devolucao(self):
        chamadas = []
        e = oq.executar(self.ciclo, backend_simulado(chamadas), GOLD_FIXA)
        self.assertNotIn("pendente", e)
        self.assertEqual(e["devolucoes"], 1)
        self.assertEqual(e["decisao_constitucional"], "aprovar")
        for arq in ("pacote.json", "nota.md", "nota_final.md", "validador.json", "manifesto.json",
                    "metricas.json", "editor.json", "prompts/replicador.md", "saidas/revisao_1.md", "uso/revisao_1.json"):
            self.assertTrue(os.path.exists(os.path.join(self.ciclo, arq)), arq)
        with open(os.path.join(self.ciclo, "metricas.json"), encoding="utf-8") as f:
            m = json.load(f)
        self.assertEqual(m["validador_mecanico"]["decisao_final"], "aprovar")
        self.assertEqual(m["concordancia"]["familias"]["jaccard_destaques"], round(3 / 7, 4))
        self.assertTrue(m["concordancia"]["familias"]["leitura_concorda"])
        self.assertEqual(m["uso"]["total"]["input_tokens"], 1000 * 8)
        self.assertIsNone(m["editor"]["minutos"])

    def test_isolamento_das_entradas(self):
        chamadas = []
        oq.executar(self.ciclo, backend_simulado(chamadas), GOLD_FIXA)
        por_etapa = {}
        for etapa, usuario in chamadas:
            por_etapa.setdefault(etapa, usuario)
        self.assertNotIn("DESTAQUES:", por_etapa["replicador"])        # não vê os analistas
        self.assertNotIn("LEITURA_FAMILIAS", por_etapa["consolidador"])  # não vê o replicador na primeira versão
        self.assertNotIn("DESTAQUES", por_etapa["validador_constitucional"])  # só a nota renderizada
        self.assertNotIn("SEM OBJEÇÕES", por_etapa["validador_constitucional"])
        self.assertIn("LEITURA_EMPRESAS", por_etapa["revisao"])          # a revisão vê a divergência

    def test_modo_manual_para_na_primeira_etapa_e_retoma(self):
        e = oq.executar(self.ciclo, oq.backend_manual, GOLD_FIXA)
        self.assertEqual(e["pendente"], "analista_familias")
        self.assertTrue(os.path.exists(os.path.join(self.ciclo, "prompts", "analista_familias.md")))
        with open(os.path.join(self.ciclo, "saidas", "analista_familias.md"), "w", encoding="utf-8") as f:
            f.write(ANALISTA)
        e = oq.executar(self.ciclo, oq.backend_manual, GOLD_FIXA)
        self.assertEqual(e["pendente"], "analista_empresas")

    def test_escrita_fora_de_notas_recusada(self):
        with self.assertRaises(PermissionError):
            oq.preparar(os.path.join(fc.RAIZ, "public", "obs", "data", "gold", "x"), GOLD_FIXA)
        with self.assertRaises(PermissionError):
            oq._gravar(self.ciclo, "../../../pipeline/x.py", "x")

    def test_prompt_de_sistema_traz_constituicao_e_regras(self):
        s = oq.sistema_do_papel("analista_familias")
        self.assertIn("Constituição editorial", s)
        self.assertIn("Você nunca escreve número", s)


class Degrau(unittest.TestCase):
    def _m(self, base, limpo=True, retro=False, sentinela_ok=True):
        return {"data_base": base, "retrospectivo": retro,
                "editor": {"preenchido": True, "erros_factuais_encontrados": 0 if limpo else 1},
                "validador_mecanico": {"decisao_final": "aprovar"},
                "sentinelas": {"recall_numerico": 1 if sentinela_ok else 0.9, "falso_bloqueio": 0, "n_casos": 60}}

    def test_seis_ciclos_limpos_promovem(self):
        ms = [self._m(f"2026-{i:02d}") for i in range(1, 7)]
        self.assertEqual(metricas.degrau(ms, {"erros": []})["degrau"], 2)

    def test_erro_zera_a_contagem_e_retro_nao_conta(self):
        ms = [self._m(f"2026-{i:02d}") for i in range(1, 7)]
        ms[3] = self._m("2026-04", limpo=False)
        ms.append(self._m("2025-12", retro=True))
        d = metricas.degrau(ms, {"erros": []})
        self.assertEqual((d["degrau"], d["ciclos_limpos_consecutivos"]), (1, 2))

    def test_erro_relevante_publicado_rebaixa(self):
        ms = [self._m(f"2026-{i:02d}") for i in range(1, 8)]
        reg = {"erros": [{"tipo_nota": "conjuntura", "gravidade": "relevante", "publicado": True}]}
        self.assertEqual(metricas.degrau(ms, reg)["degrau"], 1)

    def test_bateria_pequena_ou_incompleta_nao_promove(self):
        ms = [self._m(f"2026-{i:02d}", sentinela_ok=False) for i in range(1, 8)]
        self.assertEqual(metricas.degrau(ms, {"erros": []})["degrau"], 1)


if __name__ == "__main__":
    unittest.main()
