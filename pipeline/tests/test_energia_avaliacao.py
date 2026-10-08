"""Testes da avaliação dos painéis (P071): a rubrica de scripts/energia_avaliacao.py e a gold publicada.

Cada teste tenta pegar um erro concreto: nota arredondada para cima, teto que não limita, dimensão
sem evidência que vira nota, média ponderada que conta a dimensão não aplicável como zero, defeito
agrupado errado, gold publicada que não sai das entradas versionadas."""
import importlib.util
import json
import os
import sys
import unittest

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_spec = importlib.util.spec_from_file_location("energia_avaliacao", os.path.join(RAIZ, "scripts", "energia_avaliacao.py"))
ea = importlib.util.module_from_spec(_spec)
sys.modules["energia_avaliacao"] = ea
sys.path.insert(0, os.path.join(RAIZ, "scripts"))
_spec.loader.exec_module(ea)

GOLD = os.path.join(RAIZ, "public", "energia", "gold", "avaliacao.json")
ENT = os.path.join(RAIZ, "docs", "observatorios", "energia", "avaliacao")


def medicao(**kw):
    base = {"largura": 1440, "modo": "entender", "status": 200, "carga_ms": 800, "bytes": {"html": 100_000, "js": 400_000, "css": 40_000, "dados": 0, "outros": 0},
            "erros_console": [], "falhas_rede": [], "axe": [], "rolagem_horizontal": False, "transbordo": [], "titulo": "Página", "lang": "pt-BR",
            "h1": ["Pergunta?"], "h2": 3, "marcos": {"main": True, "nav": 2, "banner": True, "rodape": True}, "dom_nos": 2000,
            "anomalias": {"datas_cruas": [], "nan_undefined": [], "marcador_de_obra": [], "hoje": [], "hoje_com_numero": []},
            "marcadores": {"resposta": 1, "paineis": 1, "comprove": 2, "interpretar": 1, "nao_concluir": 1, "baixar": 1, "copiar_link": 1, "proxima": 1, "fonte": 1,
                           "referencia": 1, "tabelas": 1, "figuras": 1, "glossario": 1, "externo": 1, "conferido": 0, "relacionados": 1, "recorte": 3, "lead": 120},
            "paineis": [{"id": "p001", "quatro_blocos": True, "fonte": True, "baixar": True}],
            "alvos": {"total": 30, "menores_24": 0, "menores_44": 0},
            "teclado": {"primeiro": "Pular para o conteúdo", "alcancados": 40, "sem_indicador": 0, "exemplos_sem_indicador": [], "foco_invisivel": 0, "preso_nos_primeiros_passos": False},
            "links": {"internos": 20, "quebrados": [], "ancoras_ausentes": []},
            "controles": {"encontrados": 5, "exercitados": 4, "falhas": 0, "sem_efeito": 0, "com_erro_depois": 0, "rolagem_depois": 0,
                          "detalhe": [{"rotulo": "a", "grupo": "", "ok": True, "mudou_url": True, "mudou_dom": True, "erros_depois": 0, "rolagem_horizontal_depois": False}]},
            "comprove": {"botoes": 2, "aberta": True, "sha256": True, "formula": True, "fonte": True, "reproducao": True, "fecha_com_esc": True},
            "copiar_link": {"botoes": 1, "ok": True, "mensagem": "Copiado"}, "modo_profundidade": {"presente": True, "coerente": True, "falhas": []}}
    base.update(kw)
    return base


def contexto(**kw):
    t = {"vitest_total": 20, "vitest_falhas": 0, "pytest_total": 30, "pytest_falhas": 0}
    ev = {"fichas": 10, "reconciliadas": 5, "controles": 4, "ressalva": 1, "divergencia": 0, "pendencia": 0, "fichas_sem_teste": 0, "golds_reprovadas": [], "golds_ressalva": [],
          "golds_integras": 29, "golds_total": 29, "csv_aprovados": 100, "csv_ressalva": 0, "csv_reprovados": 0}
    c = {"rota": "/setor-eletrico/x", "tipo": "painel", "modulo": "pld", "medicoes": [medicao(), medicao(largura=390), medicao(modo="auditar")],
         "golds": ["pld_detalhe.json"], "titulo": "Página", "titulo_repetido": False, "revisao": {}, "jornadas_pagina": [{"id": "J1", "resultado": "cumprida"}],
         "evidencia_golds": ev, "manifesto": {"pld_detalhe.json"}, "conjuntos": [], "testes_modulo": t, "testes_falha": 3, "doc_modulo": True, "verbete_conferido": None,
         "perguntas": "1 de 1", "fracao_pergunta": 1.0, "paineis_ids": ["p001"]}
    c.update(kw)
    return c


class Truncamento(unittest.TestCase):
    def test_nota_nunca_e_arredondada_para_cima(self):
        self.assertEqual(ea.piso1(9.99), 9.9)
        self.assertEqual(ea.piso1(8.0499999), 8.0)
        self.assertEqual(ea.piso1(9.0), 9.0)
        self.assertEqual(ea.piso1(0.09), 0.0)

    def test_pesos_da_secao_15_somam_cem(self):
        self.assertEqual(sum(d["peso"] for d in ea.DIMENSOES), 100)
        self.assertEqual({d["id"]: d["peso"] for d in ea.DIMENSOES}["didatismo"], 15)
        self.assertEqual({d["id"]: d["peso"] for d in ea.DIMENSOES}["correcao"], 15)

    def test_deducoes_e_teto(self):
        n = ea.Nota()
        n.deduz(1.5, "x")
        n.deduz(2.0, "y")
        n.teto(7.0, "limite")
        r = n.resultado()
        self.assertEqual(r["nota"], 3.5)  # parte do teto 7,0 e desconta 3,5
        self.assertEqual(r["partida"], 7.0)
        self.assertEqual(r["tetos"][0]["valor"], 7.0)
        n2 = ea.Nota()
        n2.teto(7.5, "sem ficha")
        self.assertEqual(n2.resultado()["nota"], 7.5)
        self.assertEqual(n2.resultado()["tetos"][0]["motivo"], "sem ficha")
        n3 = ea.Nota()
        for _ in range(6):
            n3.deduz(3.0, "z")
        self.assertEqual(n3.resultado()["nota"], 0.0)


class Dimensoes(unittest.TestCase):
    def test_acessibilidade_tem_teto_e_axe_serio_tira_dois(self):
        limpa = ea.d_acessibilidade(contexto())
        self.assertEqual(limpa["nota"], 9.0)
        self.assertTrue(any("leitor de tela" in t["motivo"] for t in limpa["tetos"]))
        ms = [medicao(axe=[{"id": "scrollable-region-focusable", "impacto": "serious", "n": 2, "exemplo": "#x"}]), medicao(largura=390)]
        r = ea.d_acessibilidade(contexto(medicoes=ms))
        self.assertEqual(r["nota"], 7.0)  # parte do teto 9,0 e desconta 2,0
        self.assertTrue(any(d["codigo"].startswith("axe:") for d in r["defeitos"]))

    def test_mesma_regra_axe_em_varias_larguras_conta_uma_vez(self):
        axe = [{"id": "color-contrast", "impacto": "serious", "n": 1, "exemplo": "p"}]
        ms = [medicao(axe=axe), medicao(largura=390, axe=axe), medicao(modo="auditar", axe=axe)]
        self.assertEqual(ea.d_acessibilidade(contexto(medicoes=ms))["nota"], 7.0)

    def test_defeito_pequeno_nao_some_atras_do_teto(self):
        m = medicao()
        m["alvos"] = {"total": 30, "menores_24": 2, "menores_44": 2}
        limpa = ea.d_acessibilidade(contexto())["nota"]
        com = ea.d_acessibilidade(contexto(medicoes=[medicao(), medicao(largura=390) | {"alvos": m["alvos"]}]))["nota"]
        self.assertLess(com, limpa)

    def test_correcao_sem_ficha_com_teste_tem_teto_75(self):
        ev = contexto()["evidencia_golds"] | {"fichas": 0, "reconciliadas": 0, "controles": 0, "ressalva": 0, "fichas_sem_teste": 27}
        r = ea.d_correcao(contexto(evidencia_golds=ev))
        self.assertEqual(r["nota"], 7.5)  # o teto 7,5 já representa a falta de ficha com teste; não desconta de novo
        ev2 = ev | {"fichas_sem_teste": 0}
        self.assertEqual(ea.d_correcao(contexto(evidencia_golds=ev2))["nota"], 7.5)

    def test_correcao_teto_de_acuracia_depende_da_reconciliacao(self):
        ev = contexto()["evidencia_golds"] | {"fichas": 10, "reconciliadas": 10, "controles": 0, "ressalva": 0}
        self.assertEqual(ea.d_correcao(contexto(evidencia_golds=ev))["nota"], 9.5)
        ev0 = ev | {"reconciliadas": 0, "controles": 10}
        self.assertEqual(ea.d_correcao(contexto(evidencia_golds=ev0))["nota"], 8.5)

    def test_correcao_nunca_chega_a_dez(self):
        for rec in range(0, 11):
            ev = contexto()["evidencia_golds"] | {"fichas": 10, "reconciliadas": rec, "controles": 10 - rec, "ressalva": 0}
            self.assertLess(ea.d_correcao(contexto(evidencia_golds=ev))["nota"], 10.0)

    def test_teste_do_modulo_falhando_limita_a_correcao(self):
        t = {"vitest_total": 20, "vitest_falhas": 1, "pytest_total": 30, "pytest_falhas": 0}
        self.assertLessEqual(ea.d_correcao(contexto(testes_modulo=t))["nota"], 6.0)

    def test_verbete_pendente_declarado_vale_menos_que_o_conferido(self):
        c = contexto(tipo="verbete", modulo="aprenda", verbete_conferido=True)
        p = contexto(tipo="verbete", modulo="aprenda", verbete_conferido=False)
        self.assertEqual(ea.d_correcao(c)["nota"], 9.0)
        self.assertEqual(ea.d_correcao(p)["nota"], 6.0)
        self.assertEqual(ea.d_correcao(contexto(tipo="verbete", modulo="aprenda", verbete_conferido=None))["estado"], "nao_avaliada")

    def test_sem_revisao_didatismo_e_visual_ficam_nao_avaliados(self):
        self.assertEqual(ea.d_didatismo_visual("didatismo", contexto())["estado"], "nao_avaliada")
        self.assertIsNone(ea.d_didatismo_visual("visual", contexto())["nota"])

    def test_revisao_com_defeito_nao_passa_de_nove(self):
        c = contexto(revisao={"visual": {"nota": 9.5, "observacoes": ["a"], "defeitos": ["rótulo cortado"], "revisor": "R1"}})
        r = ea.d_didatismo_visual("visual", c)
        self.assertEqual(r["nota"], 9.0)

    def test_rolagem_horizontal_limita_a_qualidade_visual(self):
        ms = [medicao(rolagem_horizontal=True)]
        c = contexto(medicoes=ms, revisao={"visual": {"nota": 9.5, "observacoes": ["a"], "defeitos": [], "revisor": "R1"}})
        self.assertEqual(ea.d_didatismo_visual("visual", c)["nota"], 6.0)

    def test_pagina_sem_controle_e_nao_aplicavel_na_interatividade(self):
        ms = [medicao(controles={"encontrados": 0, "exercitados": 0, "falhas": 0, "sem_efeito": 0, "com_erro_depois": 0, "rolagem_depois": 0, "detalhe": []},
                      comprove={"botoes": 0}, copiar_link={"botoes": 0}, modo_profundidade={"presente": False, "coerente": False})]
        self.assertEqual(ea.d_interatividade(contexto(medicoes=ms))["estado"], "nao_aplicavel")

    def test_controle_que_nao_aciona_e_erro_depois_da_acao_pesam(self):
        det = [{"rotulo": "a", "grupo": "", "ok": False, "motivo": "timeout"}, {"rotulo": "b", "grupo": "", "ok": True, "mudou_url": True, "mudou_dom": True, "erros_depois": 1}]
        ms = [medicao(controles={"encontrados": 2, "exercitados": 1, "falhas": 1, "sem_efeito": 0, "com_erro_depois": 1, "rolagem_depois": 0, "detalhe": det})]
        r = ea.d_interatividade(contexto(medicoes=ms))
        self.assertLessEqual(r["nota"], 5.5)  # 10 - 1,5 (não aciona) - 3 (erro depois)
        self.assertGreaterEqual(len(r["defeitos"]), 2)

    def test_pagina_sem_conjunto_e_nao_aplicavel_na_atualidade(self):
        self.assertEqual(ea.d_atualidade(contexto(conjuntos=[]))["estado"], "nao_aplicavel")

    def test_atualidade_pune_atraso_e_limita_pelo_sem_sla(self):
        cj = [{"id": "a", "situacao": "ATRASADO", "dias_atraso": 367, "falha_recente": False, "atras_da_fonte": False},
              {"id": "b", "situacao": "SEM SLA", "dias_atraso": 0, "falha_recente": False, "atras_da_fonte": False},
              {"id": "c", "situacao": "EM DIA", "dias_atraso": 0, "falha_recente": True, "atras_da_fonte": False}]
        r = ea.d_atualidade(contexto(conjuntos=cj))
        self.assertEqual(r["nota"], 6.8)  # teto 8,6 (um terço sem SLA) menos 1,5 e 0,3
        self.assertTrue(any(d["codigo"] == "conjunto_atrasado" for d in r["defeitos"]))

    def test_frase_com_numero_e_hoje_sem_data_pesa_na_atualidade(self):
        cj = [{"id": "c", "situacao": "EM DIA", "dias_atraso": 0, "falha_recente": False, "atras_da_fonte": False}]
        m = medicao()
        m["anomalias"]["hoje_com_numero"] = ["16,4 GW em implantação no RALIE hoje"]
        r = ea.d_atualidade(contexto(conjuntos=cj, medicoes=[m]))
        self.assertEqual(r["nota"], 8.5)  # teto 9,0 menos 0,5

    def test_link_quebrado_e_ancora_ausente(self):
        m = medicao(links={"internos": 10, "quebrados": ["/x → 404"], "ancoras_ausentes": ["/y#z"]})
        r = ea.d_navegacao(contexto(medicoes=[m]))
        self.assertEqual(r["nota"], 7.5)  # 10 - 2 - 0,5
        self.assertTrue(any(d["severidade"] == "critico" for d in r["defeitos"]))

    def test_status_diferente_de_200_zera_a_navegacao(self):
        r = ea.d_navegacao(contexto(medicoes=[medicao(status=404)]))
        self.assertEqual(r["nota"], 0.0)

    def test_navegacao_sem_jornada_tem_teto_9(self):
        r = ea.d_navegacao(contexto(jornadas_pagina=[]))
        self.assertEqual(r["nota"], 9.0)
        r2 = ea.d_navegacao(contexto(jornadas_pagina=[{"id": "J2", "resultado": "interrompida"}]))
        self.assertEqual(r2["nota"], 8.0)

    def test_completude_de_painel_incompleto(self):
        m = medicao()
        m["marcadores"].update({"proxima": 0, "comprove": 0, "baixar": 0, "copiar_link": 0})
        r = ea.d_completude(contexto(medicoes=[m]))
        self.assertLess(r["nota"], 8.0)
        self.assertEqual(r["itens"]["proxima"], 0.0)
        self.assertEqual(r["itens"]["comprove"], 0.0)

    def test_titulo_em_pergunta_nao_medido_nao_vira_item_ausente(self):
        r = ea.d_completude(contexto(perguntas="não medido", fracao_pergunta=0.0))
        self.assertNotIn("pergunta", r["itens"])
        self.assertFalse(any("pergunta como título" in d["descricao"] for d in r["defeitos"]))
        self.assertTrue(any("fora do cálculo" in e for e in r["evidencias"]))
        medido = ea.d_completude(contexto(perguntas="0 de 1", fracao_pergunta=0.0))
        self.assertEqual(medido["itens"]["pergunta"], 0.0)
        self.assertTrue(any("pergunta como título" in d["descricao"] for d in medido["defeitos"]))

    def test_completude_editorial_usa_outra_lista(self):
        c = contexto(tipo="verbete")
        r = ea.d_completude(c)
        self.assertEqual(set(r["itens"]), {k for k, _ in ea.ITENS_EDITORIAL})

    def test_dado_cru_na_pagina_reprova_o_item_de_conteudo(self):
        m = medicao()
        m["anomalias"]["datas_cruas"] = ["2026-09-01T11:00"]
        r = ea.d_completude(contexto(tipo="editorial", medicoes=[m]))
        self.assertEqual(r["itens"]["conteudo"], 0.0)

    def test_rastreabilidade_pune_comprove_sem_hash(self):
        m = medicao(comprove={"botoes": 2, "aberta": True, "sha256": False, "formula": True, "fonte": True, "reproducao": True, "fecha_com_esc": True})
        r = ea.d_rastreabilidade(contexto(medicoes=[m]))
        self.assertEqual(r["nota"], 8.0)  # teto 9,5 menos 1,5

    def test_ficha_que_nao_abriu_nao_pune_a_rastreabilidade_por_falta_de_hash(self):
        m = medicao(comprove={"botoes": 1, "aberta": False, "fecha_com_esc": True})
        r = ea.d_rastreabilidade(contexto(medicoes=[m]))
        self.assertEqual(r["nota"], 9.5)
        self.assertTrue(any("não abriu" in e for e in r["evidencias"]))
        # e a Interatividade registra a falha de abrir
        self.assertLess(ea.d_interatividade(contexto(medicoes=[m]))["nota"], 10.0)

    def test_regra_do_modelo_sem_numero_vale_da_r6_em_diante(self):
        self.assertFalse(ea.regra_modelo_sem_numero_ativa("2026-10-07-r5"))
        self.assertFalse(ea.regra_modelo_sem_numero_ativa(None))
        self.assertTrue(ea.regra_modelo_sem_numero_ativa("2026-10-08-r6"))
        self.assertTrue(ea.regra_modelo_sem_numero_ativa("2026-11-02-r7"))

    def test_modelo_sem_numero_vem_do_registro_e_nao_do_texto_da_pagina(self):
        def ficha(cod, estado, ref):
            return {"codigo": cod, "aprovacao": {"estado": estado, "referencia_experimental": ref}}
        fichas = [ficha("B0", "PESQUISA", True), ficha("C1", "PESQUISA", False), ficha("C2-P", "PESQUISA", False), ficha("X", "PRODUCAO", False)]
        r = lambda s: f"/setor-eletrico/pld/modelos/{s}"
        self.assertTrue(ea.modelo_sem_numero(r("c1"), fichas))
        self.assertTrue(ea.modelo_sem_numero(r("c2-p"), fichas))
        self.assertFalse(ea.modelo_sem_numero(r("b0"), fichas))      # referência experimental publicada emite número
        self.assertFalse(ea.modelo_sem_numero(r("x"), fichas))       # em produção emite a previsão principal
        self.assertFalse(ea.modelo_sem_numero(r("nao-existe"), fichas))  # fora do registro segue cobrado
        self.assertFalse(ea.modelo_sem_numero("/setor-eletrico/pld", fichas))
        self.assertFalse(ea.modelo_sem_numero(r("c1"), []))
        self.assertFalse(ea.modelo_sem_numero(r("c1"), [{"codigo": "C1"}]))  # sem aprovação declarada, cobrado

    def test_gold_publicada_marca_c1_c2_e_s0_sem_numero_e_b0_com_numero(self):
        with open(os.path.join(RAIZ, "public", "energia", "gold", "previsoes_desempenho.json"), encoding="utf-8") as f:
            fichas = json.load(f)["fichas"]
        for s in ("c1", "c2-h", "c2-p", "s0"):
            self.assertTrue(ea.modelo_sem_numero(f"/setor-eletrico/pld/modelos/{s}", fichas), s)
        self.assertFalse(ea.modelo_sem_numero("/setor-eletrico/pld/modelos/b0", fichas))

    def test_modelo_sem_numero_nao_perde_nota_por_falta_de_comprove_mas_painel_com_numero_perde(self):
        m = medicao()
        m["marcadores"]["comprove"] = 0
        sem = contexto(medicoes=[m], sem_numero_a_comprovar=True)
        com = contexto(medicoes=[m], sem_numero_a_comprovar=False)
        a, b = ea.d_rastreabilidade(sem), ea.d_rastreabilidade(com)
        self.assertEqual(a["nota"], 9.5)
        self.assertEqual(b["nota"], 7.5)
        self.assertFalse(any(d["codigo"] == "sem_comprove" for d in a["defeitos"]))
        self.assertTrue(any(d["codigo"] == "sem_comprove" for d in b["defeitos"]))
        self.assertTrue(any("não há número a comprovar" in e for e in a["evidencias"]))
        # a completude também tira o item da conta, em vez de contá-lo como ausente
        ca, cb = ea.d_completude(sem), ea.d_completude(com)
        self.assertNotIn("comprove", ca["itens"])
        self.assertEqual(cb["itens"]["comprove"], 0.0)
        self.assertGreater(ca["nota"], cb["nota"])
        self.assertFalse(any("Comprove este número" in d["descricao"] for d in ca["defeitos"]))

    def test_download_continua_cobrado_na_ficha_de_modelo_sem_numero(self):
        m = medicao()
        m["marcadores"]["comprove"] = 0
        m["marcadores"]["baixar"] = 0
        r = ea.d_rastreabilidade(contexto(medicoes=[m], sem_numero_a_comprovar=True))
        self.assertTrue(any(d["codigo"] == "sem_download" for d in r["defeitos"]))

    def test_gold_fora_do_manifesto_pesa_tres(self):
        r = ea.d_rastreabilidade(contexto(manifesto=set()))
        self.assertEqual(r["nota"], 6.5)

    def test_desempenho_html_grande(self):
        m = medicao(bytes={"html": 700 * 1024, "js": 400_000, "css": 1, "dados": 0, "outros": 0})
        self.assertEqual(ea.d_desempenho(contexto(medicoes=[m]))["nota"], 7.0)
        m2 = medicao(bytes={"html": 1100 * 1024, "js": 400_000, "css": 1, "dados": 0, "outros": 0})
        self.assertEqual(ea.d_desempenho(contexto(medicoes=[m2]))["nota"], 5.0)


class Conjuntos(unittest.TestCase):
    def test_ficha_de_conjunto_usa_so_a_integracao_do_proprio_conjunto(self):
        g = {"conjuntos": [
            {"id": "a/aneel_scs", "slug": "aneel-scs", "golds": ["publicacao.json"], "atualidade": {"situacao": "ATRASADO", "dias_atraso": 367}, "coleta": {}, "capturas": {}},
            {"id": "b/ibge", "slug": "ibge-pof-6715", "golds": ["publicacao.json"], "atualidade": {"situacao": "SEM DADO"}, "coleta": {}, "capturas": {}}]}
        so_scs = ea.conjuntos_da_pagina(g, ["publicacao.json"], "aneel-scs")
        self.assertEqual([c["id"] for c in so_scs], ["a/aneel_scs"])
        self.assertEqual(so_scs[0]["dias_atraso"], 367)
        todos = ea.conjuntos_da_pagina(g, ["publicacao.json"])
        self.assertEqual(len(todos), 2)


class Agregacao(unittest.TestCase):
    def pagina(self, notas):
        dims = {}
        for d in ea.PESOS:
            v = notas.get(d, 9.0)
            if v is None:
                dims[d] = ea.nao_aplicavel("n")
            elif v == "n":
                dims[d] = ea.nao_avaliada("n")
            else:
                dims[d] = {"nota": v, "estado": "avaliada", "evidencias": ["e"], "deducoes": [], "tetos": [], "defeitos": []}
        return {"rota": "/x", "dimensoes": dims}

    def test_dimensao_nao_aplicavel_nao_entra_como_zero(self):
        p = ea.agrega([self.pagina({"atualidade": None, "interatividade": None})])[0]
        self.assertEqual(p["nota_ponderada"], 9.0)

    def test_dimensao_nao_avaliada_impede_a_meta_mesmo_com_notas_altas(self):
        p = ea.agrega([self.pagina({"didatismo": "n", "visual": "n", **{d: 9.8 for d in ea.PESOS if d not in ("didatismo", "visual")}})])[0]
        self.assertFalse(p["atende_meta"])
        self.assertFalse(p["completa"])
        self.assertIn("didatismo não avaliada", p["abaixo_da_meta"])

    def test_meta_de_didatismo_e_visual_e_95(self):
        notas = {d: 9.0 for d in ea.PESOS}
        p = ea.agrega([self.pagina(notas)])[0]
        self.assertFalse(p["atende_meta"])
        notas.update({"didatismo": 9.5, "visual": 9.5})
        self.assertTrue(ea.agrega([self.pagina(notas)])[0]["atende_meta"])

    def test_defeito_critico_impede_a_meta(self):
        pg = self.pagina({d: 9.8 for d in ea.PESOS})
        pg["dimensoes"]["navegacao"]["defeitos"] = [{"codigo": "link_quebrado", "severidade": "critico", "descricao": "x"}]
        self.assertFalse(ea.agrega([pg])[0]["atende_meta"])

    def test_media_ponderada_usa_os_pesos(self):
        notas = {d: 10.0 for d in ea.PESOS}
        notas["didatismo"] = 0.0  # peso 15
        p = ea.agrega([self.pagina(notas)])[0]
        self.assertEqual(p["nota_ponderada"], 8.5)

    def test_defeitos_iguais_em_paginas_diferentes_viram_um_grupo(self):
        def pg(rota):
            x = self.pagina({})
            x["rota"] = rota
            x["dimensoes"]["acessibilidade"]["defeitos"] = [{"codigo": "axe:color-contrast", "severidade": "alto", "descricao": f"axe color-contrast: {rota}"}]
            return x
        lista, _ = ea.agrega_defeitos([pg("/a"), pg("/b")], [], {"rodadas": []})
        self.assertEqual(len(lista), 1)
        self.assertEqual(lista[0]["n_paginas"], 2)

    def test_jornada_interrompida_vira_defeito_e_corrigido_some(self):
        j = [{"id": "J7", "resultado": "interrompida", "paginas_visitadas": ["/setor-eletrico/territorio"], "passos": [{"descricao": "Tab até o mapa", "resultado": "falhou", "observado": "120 Tabs"}]}]
        lista, corrigidos = ea.agrega_defeitos([], j, {"rodadas": [{"id": "r1", "defeitos": [{"chave": "antigo", "severidade": "alto", "dimensao": "x", "descricao": "d", "n_paginas": 1}]}]})
        self.assertEqual(len(lista), 1)
        self.assertEqual([c["chave"] for c in corrigidos], ["antigo"])


class Rotas(unittest.TestCase):
    def test_tipos_e_modulos(self):
        P = ea.PREFIXO
        self.assertEqual(ea.tipo_da_rota(P), "home")
        self.assertEqual(ea.tipo_da_rota(f"{P}/aprenda/acl"), "verbete")
        self.assertEqual(ea.tipo_da_rota(f"{P}/aprenda/trilhas/x"), "editorial")
        self.assertEqual(ea.tipo_da_rota(f"{P}/dados/ccee-pld-horario"), "ficha")
        self.assertEqual(ea.tipo_da_rota(f"{P}/dados/saude"), "painel")
        self.assertEqual(ea.tipo_da_rota(f"{P}/empresas/cemig-d"), "ficha")
        self.assertEqual(ea.tipo_da_rota(f"{P}/empresas/ativos"), "painel")
        self.assertEqual(ea.modulo_da_rota(f"{P}/metodologia/avaliacao"), "dados")
        self.assertEqual(ea.modulo_da_rota(f"{P}/pld/historico"), "pld")

    def test_toda_gold_da_tabela_existe_e_cobre_as_metricas_publicadas(self):
        gold_dir = os.path.join(RAIZ, "public", "energia", "gold")
        for _, golds in ea.GOLDS_POR_PREFIXO:
            for g in golds:
                self.assertTrue(os.path.exists(os.path.join(gold_dir, g)), g)
        with open(os.path.join(gold_dir, "metricas.json"), encoding="utf-8") as f:
            metricas = json.load(f)["metricas"]
        for m in metricas:
            if not os.path.exists(os.path.join(gold_dir, m["gold"])):
                continue  # gold interna, não publicada
            for pg in m.get("paginas", []):
                if pg.startswith(f"{ea.PREFIXO}/dados") or pg.startswith(f"{ea.PREFIXO}/metodologia"):
                    continue
                self.assertIn(m["gold"], ea.golds_da_rota(pg), f"{m['id']} em {pg}")


class RegistroDeRodada(unittest.TestCase):
    def saida(self, ajustes=None):
        return {"rodada": {"id": "x-r9", "data_inspecao": "2026-10-07", "ajustes_do_metodo": ajustes or []}, "versao_codigo": "abc",
                "resumo": {"paginas": 2, "nota_ponderada_media": 8.0, "atendem_meta": 0, "defeitos": {"por_severidade": {"critico": 0, "alto": 0, "medio": 1, "baixo": 0}},
                           "por_dimensao": {"didatismo": {"media": 7.0}}, "jornadas": {"cumpridas": 10}},
                "defeitos": [{"chave": "k", "severidade": "medio", "dimensao": "didatismo", "descricao": "d", "n_paginas": 1}]}

    def test_rodada_reprocessada_guarda_o_motivo_e_a_original_nao(self):
        com = ea.registro_rodada(self.saida(), "o item não medido saiu do cálculo")
        sem = ea.registro_rodada(self.saida())
        self.assertEqual(com["reprocessada"], "o item não medido saiu do cálculo")
        self.assertIsNone(sem["reprocessada"])

    def test_ajustes_do_metodo_seguem_para_o_registro(self):
        r = ea.registro_rodada(self.saida(["o instrumento passou a medir X"]))
        self.assertEqual(r["ajustes_do_metodo"], ["o instrumento passou a medir X"])
        self.assertEqual(ea.registro_rodada(self.saida())["ajustes_do_metodo"], [])


@unittest.skipUnless(os.path.exists(GOLD), "avaliacao.json ainda não gerado")
class GoldPublicada(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(GOLD, encoding="utf-8") as f:
            cls.a = json.load(f)

    def test_nenhuma_nota_sem_evidencia_ou_acima_do_teto(self):
        for p in self.a["paginas"]:
            for d, x in p["dimensoes"].items():
                if x["estado"] == "avaliada":
                    self.assertTrue(x["evidencias"], f"{p['rota']} {d}")
                    self.assertEqual(x["nota"], ea.piso1(x["nota"]), f"{p['rota']} {d}")
                    self.assertGreaterEqual(x["nota"], 0.0)
                    self.assertLessEqual(x["nota"], 10.0)
                    for t in x["tetos"]:
                        self.assertLessEqual(x["nota"], t["valor"] + 1e-9, f"{p['rota']} {d}")
                else:
                    self.assertIsNone(x["nota"], f"{p['rota']} {d}")

    def test_acessibilidade_e_correcao_nunca_chegam_a_dez(self):
        for p in self.a["paginas"]:
            for d in ("acessibilidade", "correcao", "rastreabilidade", "atualidade", "desempenho"):
                x = p["dimensoes"][d]
                if x["estado"] == "avaliada":
                    self.assertLess(x["nota"], 10.0, f"{p['rota']} {d}")

    def test_didatismo_e_visual_so_existem_com_revisao_registrada(self):
        caminho_rev = os.path.join(ENT, "revisao_visual.json")
        rev = {"paginas": {}}
        if os.path.exists(caminho_rev):
            with open(caminho_rev, encoding="utf-8") as f:
                rev = json.load(f)
        for p in self.a["paginas"]:
            for d, k in (("didatismo", "didatismo"), ("visual", "visual")):
                x = p["dimensoes"][d]
                if x["estado"] == "avaliada":
                    self.assertIn(k, rev["paginas"].get(p["rota"], {}), f"{p['rota']} {d}: nota sem revisão registrada")

    def test_nota_ponderada_confere_com_as_dimensoes(self):
        pesos = ea.PESOS
        for p in self.a["paginas"]:
            av = [(pesos[d], x["nota"]) for d, x in p["dimensoes"].items() if x["estado"] == "avaliada"]
            esperado = ea.piso1(sum(w * n for w, n in av) / sum(w for w, _ in av)) if av else None
            self.assertEqual(p["nota_ponderada"], esperado, p["rota"])

    def test_atende_meta_so_com_tudo_avaliado_e_sem_defeito_critico(self):
        ids_criticos = {d["id"] for d in self.a["defeitos"] if d["severidade"] == "critico"}
        for p in self.a["paginas"]:
            if p["atende_meta"]:
                self.assertTrue(p["completa"], p["rota"])
                self.assertFalse(set(p["defeitos"]) & ids_criticos, p["rota"])
                for d, x in p["dimensoes"].items():
                    if x["estado"] == "avaliada":
                        meta = self.a["rubrica"]["metas"]["didatismo" if d == "didatismo" else "visual" if d == "visual" else "geral"]
                        self.assertGreaterEqual(x["nota"], meta, f"{p['rota']} {d}")

    def test_resumo_confere_com_as_paginas(self):
        r = self.a["resumo"]
        self.assertEqual(r["paginas"], len(self.a["paginas"]))
        self.assertEqual(r["atendem_meta"], sum(1 for p in self.a["paginas"] if p["atende_meta"]))
        self.assertEqual(r["defeitos"]["abertos"], len(self.a["defeitos"]))
        for sev, n in r["defeitos"]["por_severidade"].items():
            self.assertEqual(n, sum(1 for d in self.a["defeitos"] if d["severidade"] == sev))

    def test_toda_pagina_mapeia_para_uma_entrega_conhecida(self):
        ids = {m["id"] for m in self.a["modulos"]}
        for p in self.a["paginas"]:
            self.assertIn(p["modulo"], ids, p["rota"])
            self.assertEqual(p["tipo"], ea.tipo_da_rota(p["rota"]))

    def test_gold_sai_das_entradas_versionadas(self):
        """Regenerar das entradas em docs/.../avaliacao/ reproduz as notas publicadas."""
        class Args:
            rodada = self.a["rodada"]["id"]
        nova, _ = ea.monta_saida(Args)
        for chave in ("paginas", "modulos", "defeitos"):
            self.assertEqual(json.loads(json.dumps(nova[chave])), self.a[chave], chave)
        self.assertEqual(nova["resumo"], self.a["resumo"])

    def test_jornadas_sao_dez_e_nao_se_chamam_teste_com_usuarios(self):
        self.assertEqual(len(self.a["jornadas"]), 10)
        texto = json.dumps(self.a["limites"], ensure_ascii=False)
        self.assertIn("não é teste com pessoas", texto)
        self.assertNotRegex(json.dumps(self.a["metodo"], ensure_ascii=False), r"teste com usuários reais")

    def test_evidencias_do_comprove_conferem_com_o_resumo(self):
        ev = self.a["evidencias"]
        self.assertEqual(ev["atendem_meta"]["valor_calculo"], self.a["resumo"]["atendem_meta"])
        self.assertEqual(ev["defeitos"]["valor_calculo"], self.a["resumo"]["defeitos"]["abertos"])
        self.assertEqual(ev["nota_media"]["valor_calculo"], self.a["resumo"]["nota_ponderada_media"])
        for e in ev.values():
            self.assertTrue(all(t["resultado"] == "aprovado" for t in e["testes"]), e["indicador"])


if __name__ == "__main__":
    unittest.main()
