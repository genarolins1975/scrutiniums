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

from pesquisa import auditor
from pesquisa import fatos_conjuntura as fc
from pesquisa import metricas
from pesquisa import nota as nt
from pesquisa import orquestrador as oq
from pesquisa import registro
from pesquisa import sentinela
from pesquisa import sentinela_semantica as ss
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
CONSTITUCIONAL = "C1: ok\nC2: ok\nC3: ok\nC4: ok\nC5: ok\nDECISÃO: aprovar\n"
DEVOLVE = "ITEM [grave]: trecho | problema | solução\nDECISÃO: devolver\n"


def backend_simulado(chamadas, devolver_revisor_rodadas=()):
    """Rodada 0: a revisão sai com adjetivo proibido (validador mecânico devolve). Rodada 1:
    nota limpa; os revisores aprovam, salvo o terceiro nas rodadas listadas."""
    def backend(etapa, sistema, usuario, papel_cfg, ciclo=None, nome=None):
        chamadas.append((nome or etapa, etapa, usuario, sistema))
        rodada = int(nome.rsplit("_", 1)[1]) if nome and nome != etapa else 0
        if etapa.startswith("analista"):
            texto = ANALISTA
        elif etapa == "replicador":
            texto = REPLICADOR
        elif etapa == "critico":
            texto = "SEM OBJEÇÕES"
        elif etapa == "validador_constitucional":
            texto = CONSTITUCIONAL
        elif etapa in ("revisor_independente", "terceiro_revisor"):
            texto = DEVOLVE if etapa == "terceiro_revisor" and rodada in devolver_revisor_rodadas else "DECISÃO: aprovar\n"
        elif etapa == "revisao" and rodada == 0:
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

    def _json(self, rel):
        with open(os.path.join(self.ciclo, rel), encoding="utf-8") as f:
            return json.load(f)

    def test_aprovada_por_unanimidade_depois_de_uma_devolucao_mecanica(self):
        chamadas = []
        e = oq.executar(self.ciclo, backend_simulado(chamadas), GOLD_FIXA)
        self.assertEqual(e["decisao_final"], "aprovada")
        self.assertEqual(e["devolucoes"], 1)
        self.assertEqual([r["validador_mecanico"] for r in e["rodadas"]], ["devolver", "aprovar"])
        for arq in ("pacote.json", "nota.md", "nota_final.md", "validador.json", "manifesto.json", "decisao.json",
                    "metricas.json", "validacao_mecanica_1.json", "saidas/revisao_1.md", "saidas/terceiro_revisor_1.md"):
            self.assertTrue(os.path.exists(os.path.join(self.ciclo, arq)), arq)
        self.assertFalse(os.path.exists(os.path.join(self.ciclo, "editor.json")))
        d = self._json("decisao.json")
        self.assertFalse(d["revisao_humana"])
        self.assertEqual(set(d["revisores"]), set(oq.REVISORES))
        m = self._json("metricas.json")
        self.assertEqual(m["revisores"]["decisao_final"], "aprovada")
        self.assertEqual(m["uso"]["total"]["input_tokens"], 1000 * 10)  # 5 iniciais + 2 revisões + 3 revisores
        self.assertFalse(m["revisores"]["independencia_comprometida"])
        self.assertEqual(m["concordancia"]["familias"]["jaccard_destaques"], round(3 / 7, 4))

    def test_devolucao_de_um_revisor_volta_a_revisao(self):
        e = oq.executar(self.ciclo, backend_simulado([], devolver_revisor_rodadas=(1,)), GOLD_FIXA)
        self.assertEqual(e["decisao_final"], "aprovada")
        self.assertEqual(e["rodadas"][1]["terceiro_revisor"], "devolver")
        self.assertTrue(e["rodadas"][2]["unanime"])
        with open(os.path.join(self.ciclo, "prompts", "revisao_2.md"), encoding="utf-8") as f:
            self.assertIn("ITEM [grave]", f.read())  # a devolução chega à revisão seguinte

    def test_sem_unanimidade_no_limite_a_nota_e_rejeitada(self):
        e = oq.executar(self.ciclo, backend_simulado([], devolver_revisor_rodadas=(0, 1, 2)), GOLD_FIXA)
        self.assertEqual(e["decisao_final"], "rejeitada")
        self.assertEqual(self._json("decisao.json")["publicacao"], "rejeitada: não é publicada")

    def test_isolamento_e_evidencias_diferentes_por_revisor(self):
        chamadas = []
        oq.executar(self.ciclo, backend_simulado(chamadas), GOLD_FIXA)
        prim = {}
        for nome, etapa, usuario, sistema in chamadas:
            prim.setdefault(etapa, (usuario, sistema))
        self.assertNotIn("DESTAQUES:", prim["replicador"][0])
        self.assertIn("LEITURA_EMPRESAS", prim["revisao"][0])
        for r in oq.REVISORES:
            usuario, sistema = prim[r]
            for alheio in ("DESTAQUES", "SEM OBJEÇÕES", "LEITURA_", "Rascunho"):
                self.assertNotIn(alheio, usuario, f"{r} viu {alheio}")
            self.assertIn("Regras comuns aos revisores", sistema)
            self.assertNotIn("Você nunca escreve número", sistema)
        self.assertIn("| id | fato |", prim["validador_constitucional"][0])
        self.assertIn('"fatos": [', prim["revisor_independente"][0])
        self.assertNotIn("| id | fato |", prim["revisor_independente"][0])
        self.assertIn("Histórico publicado na gold", prim["terceiro_revisor"][0])
        self.assertNotIn("| id | fato |", prim["terceiro_revisor"][0])
        self.assertNotIn('"fatos": [', prim["terceiro_revisor"][0])

    def test_configuracao_versionada_cumpre_a_independencia(self):
        cfg = oq._config()
        self.assertEqual(oq.verificar_independencia(cfg), [])
        modelos = [cfg["papeis"][r]["modelo"] for r in oq.REVISORES]
        self.assertEqual(len(set(modelos)), 3)

    def test_configuracao_sem_independencia_e_recusada(self):
        cfg = copy.deepcopy(oq._config())
        cfg["papeis"]["terceiro_revisor"] = dict(cfg["papeis"]["revisor_independente"])
        self.assertTrue(oq.verificar_independencia(cfg))
        original = oq._config
        oq._config = lambda: cfg
        try:
            with self.assertRaises(ValueError):
                oq.executar(self.ciclo, backend_simulado([]), GOLD_FIXA)
        finally:
            oq._config = original

    def test_modo_manual_para_na_primeira_etapa_e_retoma(self):
        e = oq.executar(self.ciclo, oq.backend_manual, GOLD_FIXA)
        self.assertEqual(e["pendente"], "analista_familias")
        with open(os.path.join(self.ciclo, "saidas", "analista_familias.md"), "w", encoding="utf-8") as f:
            f.write(ANALISTA)
        e = oq.executar(self.ciclo, oq.backend_manual, GOLD_FIXA)
        self.assertEqual(e["pendente"], "analista_empresas")

    def test_escrita_fora_de_notas_recusada(self):
        with self.assertRaises(PermissionError):
            oq.preparar(os.path.join(fc.RAIZ, "public", "obs", "data", "gold", "x"), GOLD_FIXA)
        with self.assertRaises(PermissionError):
            oq._gravar(self.ciclo, "../../../pipeline/x.py", "x")

    def test_parecer_sem_decisao_conta_como_devolucao(self):
        self.assertEqual(oq.decisao_do_parecer("tudo certo"), "sem_decisao")
        self.assertEqual(oq.decisao_do_parecer("ITEM [leve]: a | b | c\nDECISÃO: aprovar"), "aprovar")


class Auditor(unittest.TestCase):
    def setUp(self):
        os.makedirs(oq.NOTAS, exist_ok=True)
        self.base = tempfile.mkdtemp(prefix="teste_", dir=oq.NOTAS)
        self.ciclo = os.path.join(self.base, "2026-07")
        oq.executar(self.ciclo, backend_simulado([]), GOLD_FIXA)

    def tearDown(self):
        shutil.rmtree(self.base, ignore_errors=True)

    def test_nota_aprovada_integra_passa(self):
        r = auditor.auditar_ciclo(self.ciclo)
        self.assertEqual(r["erros_factuais"], [])
        self.assertEqual(r["fatos_revisados_pela_fonte"] is None or r["fatos_revisados_pela_fonte"] >= 0, True)

    def test_texto_editado_a_mao_e_erro(self):
        path = os.path.join(self.ciclo, "nota_final.md")
        with open(path, encoding="utf-8") as f:
            t = f.read()
        with open(path, "w", encoding="utf-8") as f:
            f.write(t.replace("4,88%", "4,98%"))
        r = auditor.auditar_ciclo(self.ciclo)
        self.assertTrue(any("renderização" in e["problema"] for e in r["erros_factuais"]))

    def test_fato_que_nao_reproduz_na_gold_e_erro_e_vira_errata(self):
        pp = os.path.join(self.ciclo, "pacote.json")
        with open(pp, encoding="utf-8") as f:
            p = json.load(f)
        next(x for x in p["fatos"] if x["id"] == "inad_total.nivel")["valor"] = 4.99
        p["sha256_fatos"] = fc.sha256_fatos(p["fatos"])
        with open(pp, "w", encoding="utf-8") as f:
            json.dump(p, f)
        r = auditor.auditar_ciclo(self.ciclo)
        self.assertTrue(any(e.get("fato") == "inad_total.nivel" for e in r["erros_factuais"]))
        reg = os.path.join(self.base, "registro.json")
        with open(reg, "w", encoding="utf-8") as f:
            json.dump({"erros": []}, f)
        novos = auditor.registrar(self.ciclo, r, reg)
        self.assertTrue(novos)
        self.assertTrue(os.path.exists(os.path.join(self.ciclo, "errata.md")))
        self.assertTrue(registro.erro_relevante_publicado(registro.carregar(reg), "conjuntura"))
        self.assertEqual(auditor.registrar(self.ciclo, r, reg), [])  # não duplica

    def test_nota_rejeitada_nao_e_auditada(self):
        d = os.path.join(self.ciclo, "decisao.json")
        with open(d, encoding="utf-8") as f:
            x = json.load(f)
        x["decisao"] = "rejeitada"
        with open(d, "w", encoding="utf-8") as f:
            json.dump(x, f)
        self.assertFalse(auditor.auditar_ciclo(self.ciclo)["auditavel"])


class Degrau(unittest.TestCase):
    SEM = {"recall_painel": 0.95, "rejeicao_indevida": 0}

    def _m(self, base, erros=0, retro=False, aprovada=True, comprometida=False):
        return {"data_base": base, "retrospectivo": retro,
                "revisores": {"decisao_final": "aprovada" if aprovada else "rejeitada", "independencia_comprometida": comprometida},
                "auditoria": {"auditado": True, "erros_factuais": erros},
                "sentinelas": {"recall_numerico": 1, "falso_bloqueio": 0, "n_casos": 35}}

    def test_tres_ciclos_limpos_com_bateria_semantica_promovem(self):
        ms = [self._m(f"2026-{i:02d}", retro=i < 3) for i in range(1, 4)]
        self.assertEqual(metricas.degrau(ms, {"erros": []}, semantica=self.SEM)["degrau"], 2)

    def test_sem_bateria_semantica_nao_promove(self):
        ms = [self._m(f"2026-{i:02d}") for i in range(1, 5)]
        self.assertEqual(metricas.degrau(ms, {"erros": []})["degrau"], 1)

    def test_erro_do_auditor_zera_a_contagem(self):
        ms = [self._m(f"2026-{i:02d}") for i in range(1, 6)]
        ms[3] = self._m("2026-04", erros=1)
        d = metricas.degrau(ms, {"erros": []}, semantica=self.SEM)
        self.assertEqual((d["degrau"], d["ciclos_limpos_consecutivos"]), (1, 1))

    def test_rejeitada_nao_conta_nem_quebra(self):
        ms = [self._m("2026-01"), self._m("2026-02", aprovada=False), self._m("2026-03"), self._m("2026-04")]
        self.assertEqual(metricas.degrau(ms, {"erros": []}, semantica=self.SEM)["ciclos_limpos_consecutivos"], 3)

    def test_independencia_comprometida_nao_conta_como_limpo(self):
        ms = [self._m(f"2026-{i:02d}", comprometida=i == 3) for i in range(1, 4)]
        self.assertEqual(metricas.degrau(ms, {"erros": []}, semantica=self.SEM)["degrau"], 1)

    def test_erro_relevante_publicado_rebaixa(self):
        ms = [self._m(f"2026-{i:02d}") for i in range(1, 5)]
        reg = {"erros": [{"tipo_nota": "conjuntura", "gravidade": "relevante", "publicado": True}]}
        self.assertEqual(metricas.degrau(ms, reg, semantica=self.SEM)["degrau"], 1)


class BateriaSemantica(unittest.TestCase):
    def test_nota_base_passa_no_validador_mecanico(self):
        with open(os.path.join(ss.DIR, "nota_base.md"), encoding="utf-8") as f:
            self.assertEqual(vd.validar(f.read(), PACOTE)["decisao"], "aprovar")

    def test_casos_aplicam_uma_vez_e_nao_criam_numero(self):
        """O renderizador garante os números: caso que cria ou troca número mede erro que não existe."""
        from collections import Counter
        final, _ = ss.base()
        num = lambda t: Counter(__import__("re").findall(r"\d+(?:,\d+)?", t))
        for c in ss.casos():
            nota = ss.aplicar(c, final)
            self.assertNotEqual(nota, final, c["id"])
            self.assertFalse(num(nota) - num(final), c["id"])

    def test_atribuicao_exige_citar_o_trecho_plantado(self):
        final, _ = ss.base()
        caso = {"id": "X", "substituir": [["A inadimplência acima de noventa dias", "A inadimplência acima de sessenta dias"]]}
        self.assertTrue(ss.atribuido(caso, 'ITEM [grave]: "acima de sessenta dias" | x | y', final))
        self.assertFalse(ss.atribuido(caso, "ITEM [grave]: outra frase qualquer da nota | x | y", final))
        omissao = {"id": "Y", "substituir": [["Os fatos do pacote não identificam a causa. ", ""]]}
        self.assertIsNone(ss.atribuido(omissao, "qualquer parecer", final))

    def test_trecho_ambiguo_falha_alto(self):
        with self.assertRaises(ValueError):
            ss.aplicar({"id": "X", "substituir": [["no mês", "em doze meses"]]}, ss.base()[0])

    def test_avaliar_mede_recall_rejeicao_indevida_e_erro_correlacionado(self):
        tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, tmp)
        os.makedirs(os.path.join(tmp, "saidas"))
        casos = ss.casos()
        erros = [c["id"] for c in casos if c["esperado"] == "devolver"]
        limpos = [c["id"] for c in casos if c["esperado"] == "aprovar"]
        perdido, meio = erros[0], erros[1]
        for c in casos:
            for r in oq.REVISORES:
                if c["id"] == perdido or c["id"] in limpos:
                    d = "aprovar"
                elif c["id"] == meio:
                    d = "devolver" if r == oq.REVISORES[2] else "aprovar"
                else:
                    d = "devolver"
                texto = "ITEM [grave]: x | y | z\n" if d == "devolver" else ""
                with open(os.path.join(tmp, "saidas", f"{c['id']}__{r}.md"), "w", encoding="utf-8") as f:
                    f.write(texto + f"DECISÃO: {d}\n")
        # um controle sem decisão conta como devolução indevida
        with open(os.path.join(tmp, "saidas", f"{limpos[0]}__{oq.REVISORES[0]}.md"), "w", encoding="utf-8") as f:
            f.write("texto sem linha de decisão\n")
        r = ss.avaliar(tmp)
        self.assertEqual(r["respostas_faltando"], [])
        self.assertEqual(r["recall_painel"], round((len(erros) - 1) / len(erros), 4))
        self.assertEqual(len(r["perdidos_por_todos"]), 1)
        self.assertTrue(r["perdidos_por_todos"][0].startswith(perdido))
        self.assertEqual(r["rejeicao_indevida"], 1)
        self.assertEqual(r["por_revisor"][oq.REVISORES[0]]["sem_decisao"], 1)
        self.assertEqual(r["por_revisor"][oq.REVISORES[2]]["recall"], round((len(erros) - 1) / len(erros), 4))
        self.assertTrue(os.path.exists(os.path.join(tmp, "resultado.json")))

    def test_resposta_faltando_nao_entra_no_painel(self):
        tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, tmp)
        os.makedirs(os.path.join(tmp, "saidas"))
        r = ss.avaliar(tmp)
        self.assertEqual(len(r["respostas_faltando"]), len(ss.casos()) * len(oq.REVISORES))
        self.assertIsNone(r["recall_painel"])
        self.assertFalse(metricas.degrau([], {"erros": []}, semantica=r)["degrau"] == 2)


if __name__ == "__main__":
    unittest.main()
