"""Páginas individuais para TODO o universo de conglomerados prudenciais (v0.14).

Formato inspirado no mockup aprovado: cabeçalho com chips, cartão de score, fileira de
KPIs com sparkline, destaques, composição da carteira (doações reais PF/PJ e modalidades),
tabela de capital com comparação aos pares, evolução base-100, histograma do grupo de
pares e reclamações. Blocos sem dado público (receita, LCR/NSFR, qualidade por IF,
notícias, documentos) são declarados indisponíveis com motivo — nunca preenchidos.

Arquitetura: um JSON por instituição em data/gold/inst/{cod}.json (carregado sob demanda)
+ índice de busca inst_index.json. Pares = grupo prudencial COMPLETO (todas as IFs com
dados, não só o top-30).
"""
import json
import re
import unicodedata

from pipeline import common
from pipeline.indicators import PEER_GROUP_LABELS, carteira_profile
from pipeline.products import TAXONOMY as PROD_TAXONOMY, venc_key as prod_venc_key

PERIODOS_LBL = {"202603": "2026-T1", "202512": "2025-T4", "202509": "2025-T3",
                "202506": "2025-T2", "202503": "2025-T1"}
GENERIC_TOKENS = {"BANCO", "BCO", "BRASIL", "BRASILEIRO", "NACIONAL", "S.A", "S.A.", "SA",
                  "LTDA", "CREDITO", "CRÉDITO", "COOPERATIVA", "COOPERATIVO", "CENTRAL",
                  "INSTITUICAO", "PAGAMENTO", "PAGAMENTOS", "FINANCEIRA", "FINANCIAMENTO",
                  "INVESTIMENTO", "INVESTIMENTOS", "SOCIEDADE", "GRUPO", "PRUDENCIAL",
                  "CONGLOMERADO", "MULTIPLO", "COMERCIAL", "DE", "DO", "DA", "DOS", "DAS", "E"}

INDISPONIVEIS = [
    ("Qualidade da carteira (inadimplência, atrasos, provisões, cobertura)", "Não exposta por instituição no corte público do IF.data."),
    ("LCR / NSFR e composição de funding", "Exigem Pilar 3 por instituição — não integrado."),
    ("Composição de receita, margem e eficiência", "Exigem o DRE detalhado (templates 116-118 do IF.data) — mapeado, não integrado."),
    ("Notícias, ratings e documentos (ITR/DFP/Pilar 3)", "Pipelines de CVM/RI/agências/imprensa não integrados."),
]


def _sem_acento(s):
    return unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().upper()


def _tokens(nome):
    return [t for t in re.findall(r"[A-Z0-9]{3,}", _sem_acento(nome)) if t not in GENERIC_TOKENS]


def _match_nome(alvo_tokens, candidato_nome):
    if not alvo_tokens:
        return False
    cu = _sem_acento(candidato_nome)
    return all(t in cu for t in alvo_tokens[:2])


def _pctl(vals, v):
    if not vals or v is None:
        return None
    below = sum(1 for x in vals if x < v)
    return round(below / max(len(vals) - 1, 1) * 100, 1)


def _mediana(vals):
    if not vals:
        return None
    sv = sorted(vals)
    return sv[len(sv) // 2]


def build_all(con, cfg, inst_gold, of_gold):
    pilotos = {p["cod_inst"]: p for p in cfg.get("inst_pages", {}).get("pilotos", [])}
    cur = con.execute("SELECT DISTINCT anomes FROM institution_metrics WHERE metric='ativo_total' ORDER BY anomes DESC")
    periods = [r[0] for r in cur.fetchall()][:5]
    if not periods:
        return {"ok": False}
    anomes = periods[0]

    # carrega tudo em memória (1 query)
    hist = {}   # cod -> metric -> [(anomes, v)]
    for cod, a, m, v in con.execute(
            "SELECT cod_inst, anomes, metric, value FROM institution_metrics ORDER BY anomes").fetchall():
        hist.setdefault(cod, {}).setdefault(m, []).append((a, v))
    cad = {r[0]: {"name": r[1], "tcb": r[2], "uf": r[3], "mun": r[4], "sr": r[5] or "S?", "congl": r[6]}
           for r in con.execute("SELECT cod_inst, name, tcb, uf, municipio, sr, cod_congl_prud FROM institutions").fetchall()}

    def now(cod, m):
        s = hist.get(cod, {}).get(m, [])
        return s[-1][1] if s and s[-1][0] == anomes else None

    universo = [c for c in hist if now(c, "ativo_total") and now(c, "patrimonio_liquido")]

    # razões por instituição + grupos de pares completos
    ratios = {}
    for c in universo:
        pl, at = now(c, "patrimonio_liquido"), now(c, "ativo_total")
        r = {"ativo": at, "pl": pl, "carteira": now(c, "carteira_credito"),
             "lucro": now(c, "lucro_liquido")}
        r["roe"] = (r["lucro"] / pl * 100) if (r["lucro"] is not None and pl) else None
        r["alav"] = at / pl if pl else None
        bas = now(c, "indice_basileia")
        r["basileia"] = bas * 100 if bas else None
        ratios[c] = r
    grupos = {}
    for c in universo:
        grupos.setdefault(cad.get(c, {}).get("sr", "S?"), []).append(c)
    gstats = {}
    for g, membros in grupos.items():
        gstats[g] = {}
        for met in ("roe", "alav", "basileia", "carteira", "ativo"):
            vals = [ratios[m][met] for m in membros if ratios[m].get(met) is not None]
            gstats[g][met] = {"vals": vals, "mediana": _mediana(vals)}

    # ---- atraso ≥15d por produto: estatísticas do universo (mediana/quartis/percentil) ----
    def at_anomes(cod, met, a):
        for aa, v in hist.get(cod, {}).get(met, []):
            if aa == a:
                return v
        return None

    prod_atraso_stats = {}
    for slug, (pkey, pnome, pseg, _nat, _defi, _nota) in PROD_TAXONOMY.items():
        pcts = []
        for c in hist:
            cart = at_anomes(c, pkey, anomes)
            venc = at_anomes(c, prod_venc_key(pkey), anomes)
            if cart and cart > 0 and venc is not None:
                pcts.append(venc / cart * 100)
        if len(pcts) >= 10:
            prod_atraso_stats[slug] = sorted(pcts)

    recl_rows = []
    try:
        recl_rows = con.execute("""SELECT ano, trimestre, nome, indice, reclamacoes_reguladas,
                                          clientes, posicao FROM reclamacoes
                                   ORDER BY ano DESC, trimestre DESC""").fetchall()
    except Exception:
        pass
    rj_bancos = []
    try:
        for (bancos,) in con.execute("SELECT bancos FROM rj_credores").fetchall():
            rj_bancos.append([b["nome"] for b in json.loads(bancos or "[]")])
    except Exception:
        pass
    of_rank = of_gold.get("ranking", []) if of_gold and not of_gold.get("demo", True) else []
    inst_by_cod = {i["cod_inst"]: i for i in inst_gold.get("instituicoes", [])}

    F_IF = "BCB IF.data (Olinda)"
    F_CAP = "BCB IF.data (Informações de Capital)"
    index = []
    n_pages = 0
    for cod in universo:
        c0 = cad.get(cod, {})
        nome = c0.get("name") or cod
        sr = c0.get("sr", "S?")
        toks = _tokens(nome)
        piloto = pilotos.get(cod, {})
        r = ratios[cod]
        gs = gstats.get(sr, {})

        def kpi(metric, label, unit, transform=None):
            s = hist.get(cod, {}).get(metric, [])
            if not s:
                return None
            vals = [(a, transform(v) if transform else v) for a, v in s if a in periods]
            if not vals:
                return None
            atual = vals[-1][1]
            d_tri = None
            # lucro é acumulado no ano-calendário do IF.data: variação trimestral seria
            # artefato da virada de ano — suprimida (ausência ≠ zero)
            if len(vals) > 1 and metric != "lucro_liquido":
                prev = vals[-2][1]
                d_tri = round((atual / prev - 1) * 100, 1) if unit == "R$" and prev else round(atual - prev, 2)
            return {"label": label, "v": atual, "unit": unit, "d_tri": d_tri,
                    "d_tri_tipo": "%" if unit == "R$" else "p.p.",
                    "hist": [round(v, 4) for _, v in vals], "fonte": F_IF if unit == "R$" else F_CAP}

        kpis = [k for k in [
            kpi("ativo_total", "Ativos totais", "R$"),
            kpi("patrimonio_liquido", "Patrimônio líquido", "R$"),
            kpi("carteira_credito", "Carteira de crédito", "R$"),
            kpi("lucro_liquido", "Lucro líquido (acum. ano IF.data)", "R$"),
            kpi("indice_basileia", "Índice de Basileia", "%", lambda v: v * 100),
        ] if k]
        if r.get("roe") is not None:
            kpis.append({"label": "ROE do período (padronizado)", "v": round(r["roe"], 2), "unit": "%",
                         "d_tri": None, "d_tri_tipo": "p.p.", "hist": [], "fonte": "calculado"})

        # comparação com pares (vs. mediana)
        def vs(met, higher_bad=None):
            med = gs.get(met, {}).get("mediana")
            v = r.get(met)
            if med is None or v is None:
                return None
            return "acima" if v > med else "abaixo" if v < med else "na média"

        cap_table = []
        for met, label, unit in (("basileia", "Índice de Basileia", "%"), ("alav", "Ativo ÷ PL (alavancagem contábil)", "×"),
                                 ("roe", "ROE do período", "%")):
            if r.get(met) is None:
                continue
            s5 = hist.get(cod, {}).get({"basileia": "indice_basileia"}.get(met, ""), [])
            d_tri = None
            if met == "basileia" and len(s5) > 1:
                d_tri = round((s5[-1][1] - s5[-2][1]) * 100, 2)
            cap_table.append({"indicador": label, "valor": round(r[met], 2), "unit": unit,
                              "d_tri": d_tri, "vs_pares": vs(met),
                              "mediana_grupo": round(gs[met]["mediana"], 2) if gs.get(met, {}).get("mediana") is not None else None,
                              "percentil": _pctl(gs.get(met, {}).get("vals", []), r.get(met))})

        atraso_itens = []
        for slug, (pkey, pnome, pseg, _nat, _defi, _nota) in PROD_TAXONOMY.items():
            cart = now(cod, pkey)
            if not cart or cart <= 0:
                continue
            venc = at_anomes(cod, prod_venc_key(pkey), anomes)
            pct = venc / cart * 100 if venc is not None else None
            stats = prod_atraso_stats.get(slug, [])
            serie_at = []
            for a in sorted(periods):
                ca, va = at_anomes(cod, pkey, a), at_anomes(cod, prod_venc_key(pkey), a)
                if ca and ca > 0 and va is not None:
                    serie_at.append({"p": PERIODOS_LBL.get(a, a), "pct": round(va / ca * 100, 2)})
            atraso_itens.append({
                "slug": slug, "produto": pnome, "seg": pseg.upper(),
                "carteira_brl": cart,
                "atraso15_pct": round(pct, 2) if pct is not None else None,
                "mediana_produto_pct": round(_mediana(stats), 2) if stats else None,
                "percentil_no_produto": _pctl(stats, pct) if (stats and pct is not None) else None,
                "n_universo": len(stats),
                "serie": serie_at,
            })
        atraso_itens.sort(key=lambda x: -x["carteira_brl"])

        met_all = {m: s[-1][1] for m, s in hist.get(cod, {}).items() if s and s[-1][0] == anomes}
        perfil = carteira_profile(met_all)
        pf_total = met_all.get("cart_pf_mod:total_da_carteira_de_pessoa_fisica")
        pj_total = met_all.get("cart_pj:total_da_carteira_de_pessoa_juridica")
        donut_cliente = None
        if pf_total or pj_total:
            donut_cliente = [x for x in [
                {"label": "Pessoa Física", "v": pf_total or 0},
                {"label": "Pessoa Jurídica", "v": pj_total or 0}] if x["v"] > 0]

        # evolução base-100
        evolucao = {}
        for met, label in (("ativo_total", "Ativos"), ("carteira_credito", "Carteira"),
                           ("patrimonio_liquido", "PL")):
            s = [(a, v) for a, v in hist.get(cod, {}).get(met, []) if a in periods]
            if len(s) >= 3 and s[0][1]:
                evolucao[label] = [{"p": PERIODOS_LBL.get(a, a), "v": round(v / s[0][1] * 100, 1)} for a, v in s]

        # reclamações / OF / RJ (matching conservador por tokens distintivos)
        recl = [{"periodo": f"{a}-T{t}", "indice": i2, "reclamacoes": nr, "clientes": cl,
                 "posicao_arquivo": pos, "nome_fonte": n2}
                for a, t, n2, i2, nr, cl, pos in recl_rows if _match_nome(toks, n2)][:4]
        of_entry = next((o for o in of_rank if _match_nome(toks, o["organisation"])), None)
        rj_cit = sum(1 for bancos in rj_bancos if any(_match_nome(toks, b) for b in bancos)) if toks else 0

        # destaques rule-based
        dest = []
        if r.get("basileia") is not None and gs.get("basileia", {}).get("mediana") is not None:
            ok = r["basileia"] >= gs["basileia"]["mediana"]
            dest.append({"tipo": "ok" if ok else "warn",
                         "texto": f"Basileia de {r['basileia']:.1f}% ({'acima' if ok else 'abaixo'} da mediana do grupo {sr}: {gs['basileia']['mediana']:.1f}%).",
                         "base": F_CAP})
        s_cart = [(a, v) for a, v in hist.get(cod, {}).get("carteira_credito", []) if a in periods]
        if len(s_cart) >= 5 and s_cart[0][1]:
            g4 = (s_cart[-1][1] / s_cart[0][1] - 1) * 100
            dest.append({"tipo": "warn" if g4 > 30 else "ok",
                         "texto": f"Carteira {'cresceu' if g4 >= 0 else 'caiu'} {abs(g4):.1f}% em 4 trimestres" + (" — acima de 30%, checar apetite de risco." if g4 > 30 else "."),
                         "base": F_IF})
        if r.get("roe") is not None:
            dest.append({"tipo": "warn" if r["roe"] < 0 else "ok",
                         "texto": f"ROE do período de {r['roe']:.1f}%" + (" — resultado negativo no acumulado." if r["roe"] < 0 else "."),
                         "base": "calculado sobre IF.data"})
        if perfil and perfil.get("hhi_setorial") and perfil["hhi_setorial"] > 3000:
            dest.append({"tipo": "warn", "texto": f"Concentração setorial elevada na carteira PJ (HHI {perfil['hhi_setorial']}).",
                         "base": "IF.data carteiras por CNAE"})
        if recl and recl[0]["indice"] is not None:
            meds = [x for _, _, n2, x, *_ in recl_rows if x is not None]
            med_r = _mediana(meds)
            if med_r:
                bad = recl[0]["indice"] > med_r
                dest.append({"tipo": "warn" if bad else "ok",
                             "texto": f"Índice de reclamações {recl[0]['indice']:.1f} ({'acima' if bad else 'abaixo'} da mediana do ranking {med_r:.1f}) — indicador operacional, não de solvência.",
                             "base": "BCB rdrweb"})

        ig = inst_by_cod.get(cod)

        # resumo executivo em 5 blocos (§8.3): frases curtas, cada uma com base
        fortes = [d for d in dest if d["tipo"] == "ok"][:4]
        atencao = [d for d in dest if d["tipo"] == "warn"][:4]
        mudancas_rec = []
        for k in kpis:
            if k.get("d_tri") is not None and abs(k["d_tri"]) >= (3 if k["unit"] == "R$" else 0.3):
                mudancas_rec.append({"texto": f"{k['label']}: {'+' if k['d_tri'] > 0 else ''}{k['d_tri']}{k['d_tri_tipo']} no trimestre.", "base": k["fonte"]})
        if ig and ig.get("score_delta") is not None and abs(ig["score_delta"]) >= 3:
            mudancas_rec.append({"texto": f"Score relativo {'subiu' if ig['score_delta'] > 0 else 'caiu'} {abs(ig['score_delta'])} pontos no grupo de pares.", "base": "Observatório (calculado)"})
        n_dims_score = len((ig or {}).get("dimensoes", {})) if ig else 0
        aval = None
        if r.get("basileia") is not None and gs.get("basileia", {}).get("mediana") is not None:
            pos_b = "acima" if r["basileia"] >= gs["basileia"]["mediana"] else "abaixo"
            pos_r = ("acima" if (r.get("roe") or 0) >= (gs.get("roe", {}).get("mediana") or 0) else "abaixo") if r.get("roe") is not None else None
            aval = (f"Capitalização {pos_b} da mediana do grupo {sr}" +
                    (f", rentabilidade do período {pos_r} da mediana" if pos_r else "") + ".")
        else:
            aval = "Avaliação limitada: capital regulatório não reportado neste corte."
        resumo_exec = {
            "avaliacao_geral": {"texto": aval, "base": f"{F_CAP} + medianas do grupo {sr}"},
            "pontos_fortes": fortes, "pontos_atencao": atencao,
            "mudancas_recentes": mudancas_rec[:4],
            "limitacoes_informacionais": [i[0] for i in INDISPONIVEIS],
        }

        # composição do grupo de pares (§8.10)
        membros = grupos.get(sr, [])
        maiores = sorted(membros, key=lambda m: -(ratios[m].get("ativo") or 0))[:15]
        grupo_comp = {
            "criterio": "Segmento prudencial (Res. CMN 4.553) — corte por porte/relevância sistêmica; NÃO diferencia modelo de negócio",
            "quantidade": len(membros),
            "maiores_membros": [{"cod": m, "nome": (cad.get(m, {}).get("name") or m)[:40]} for m in maiores],
            "quartis_basileia": (lambda vals: {"q1": round(sorted(vals)[len(vals)//4], 1), "mediana": round(_mediana(vals), 1), "q3": round(sorted(vals)[3*len(vals)//4], 1)} if len(vals) >= 8 else None)(gs.get("basileia", {}).get("vals", [])),
            "estabilidade": "Composição varia trimestralmente conforme entrada/saída de dados no IF.data.",
        }

        # score: cobertura e confiança (§8.11)
        score_meta = None
        if ig:
            cobertura_pct = round(n_dims_score / 6 * 100)
            score_meta = {"cobertura_dados_pct": cobertura_pct,
                          "confianca": "moderada" if cobertura_pct >= 80 else "baixa",
                          "confianca_motivo": f"{n_dims_score}/6 dimensões com dado; sem liquidez/qualidade de carteira por IF; faixas não calibradas empiricamente",
                          "versao_metodologica": "score v3 (v0.5.0 da plataforma)"}

        page = {
            "cod_inst": cod, "caso": piloto.get("caso"),
            "cabecalho": {
                "nome_comercial": piloto.get("nome_comercial") or nome.title(),
                "razao_social_fonte_bcb": nome, "codigo_bcb": cod, "tcb": c0.get("tcb"),
                "sede": f"{c0.get('mun') or ''}/{c0.get('uf') or ''}",
                "segmento": sr, "grupo_pares": PEER_GROUP_LABELS.get(sr, sr),
                "n_pares": len(grupos.get(sr, [])),
                "conglomerado_prudencial": c0.get("congl"),
                "capital": piloto.get("capital", "não classificado"),
                "modelo": piloto.get("modelo"),
                "consolidacao": "Conglomerado prudencial (IF.data tipo 2)",
                "data_base": PERIODOS_LBL.get(anomes, anomes), "atualizado_em": common.now_utc(),
                "aviso_pares": piloto.get("aviso_pares"),
                "cnpj": "não disponível nas fontes integradas",
                "participante_open_finance": bool(of_entry) or None,
            },
            "resumo_executivo": resumo_exec, "grupo_pares_composicao": grupo_comp,
            "score_meta": score_meta,
            "kpis": kpis, "destaques": dest, "capital_tabela": cap_table,
            "carteira": {"donut_cliente": donut_cliente, "perfil": perfil,
                         "total_pf": pf_total, "total_pj": pj_total},
            "evolucao_base100": evolucao,
            "comparacao_grupo": {met: {"valores": [round(x, 2) for x in gs.get(met, {}).get("vals", [])][:400],
                                       "meu": round(r[met], 2) if r.get(met) is not None else None,
                                       "mediana": round(gs[met]["mediana"], 2) if gs.get(met, {}).get("mediana") is not None else None}
                                 for met in ("roe", "basileia", "alav") if r.get(met) is not None},
            "score_ref": ({k: ig.get(k) for k in ("score", "score_delta", "faixa", "dimensoes",
                                                  "historico_score", "vulnerabilidade", "dimensoes_disponiveis")}
                          if ig else {"indisponivel": "Score calculado apenas para o corte dos 30 maiores nesta versão."}),
            "atraso_produtos": ({
                "data_base": PERIODOS_LBL.get(anomes, anomes),
                "fonte": "BCB IF.data — subcoluna 'Vencido a Partir de 15 Dias' dos relatórios 123 (PF) / 128 (PJ), por modalidade × instituição",
                "nota": ("Atraso ≥15 dias da modalidade (vencido ÷ carteira). Conceito de ATRASO — não é a inadimplência "
                         ">90d (Res. 4.966), que a fonte pública não decompõe por modalidade. Percentil dentro do universo "
                         "de instituições que reportam o produto (percentil alto = mais atraso que os pares do produto)."),
                "itens": atraso_itens} if atraso_itens else None),
            "openfinance": of_entry,
            "reclamacoes": recl,
            "rj_citacoes": {"casos": rj_cit,
                            "nota": "presença em listas de credores publicadas (DJEN, 60d); matching por tokens distintivos do nome — não mede exposição total"},
            "indisponiveis": [{"indicador": a, "motivo": b} for a, b in INDISPONIVEIS],
        }
        common.write_gold(f"inst/{cod}.json", page)
        n_pages += 1
        index.append({"cod": cod, "nome": page["cabecalho"]["nome_comercial"],
                      "razao": nome, "sr": sr, "ativo_brl": r["ativo"],
                      "piloto": cod in pilotos})
    index.sort(key=lambda x: -(x["ativo_brl"] or 0))
    common.write_gold("inst_index.json", {
        "gerado_em": common.now_utc(), "paginas": n_pages, "anomes": anomes,
        "instituicoes": index,
        "nota": "Uma página por conglomerado prudencial com dados no IF.data; pares = grupo prudencial completo; "
                "matching de reclamações/Open Finance/RJ por tokens distintivos do nome (nome da fonte sempre exibido).",
    })
    return {"ok": True, "paginas": n_pages}
