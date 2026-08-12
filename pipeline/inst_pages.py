"""Páginas individuais de instituições (entrega inicial: 3 pilotos, §22 do módulo).

Princípios aplicados: ausência ≠ zero (indicadores indisponíveis são declarados como tais,
com o motivo); nível de consolidação único e explícito (conglomerado prudencial — IF.data
tipo 2); classificação da origem de cada dado; síntese frase a frase com base declarada;
mediana dos pares como benchmark; sem exposição nominal inferida.
"""
import json
import re
import unicodedata

from pipeline import common
from pipeline.indicators import PEER_GROUP_LABELS, carteira_profile

PERIODOS_LBL = {"202603": "2026-T1", "202512": "2025-T4", "202509": "2025-T3",
                "202506": "2025-T2", "202503": "2025-T1"}

INDISPONIVEIS = [
    ("LCR / NSFR", "Relatórios de Pilar 3 por instituição ainda não integrados (fase futura); indisponível no IF.data via API."),
    ("Margem financeira / índice de eficiência", "Exigem o DRE detalhado por conglomerado (relatório 116-118 da interface IF.data) — mapeado, não integrado."),
    ("Atrasos 15-90d, inadimplência por IF, provisões, cobertura", "O corte público do IF.data tipo 2 não expõe qualidade de carteira por instituição."),
    ("Ratings e documentos (ITR/DFP/Pilar 3/fatos relevantes)", "Pipelines de CVM/agências/RI não integrados — arquitetura prevista no backlog."),
]


def _sem_acento(s):
    return unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().upper()


def _match_alias(nome, aliases):
    up = _sem_acento(nome)
    return any(_sem_acento(a) in up or up in _sem_acento(a) for a in aliases)


def _metric_series(con, cod, metric):
    rows = con.execute("""SELECT anomes, value FROM institution_metrics
                          WHERE cod_inst=? AND metric=? ORDER BY anomes""", (cod, metric)).fetchall()
    return [(a, v) for a, v in rows]


def _indicador(con, cod, metric, nome, unit, fonte, status, peers_vals=None, transform=None):
    s = _metric_series(con, cod, metric)
    if not s:
        return None
    vals = [(a, transform(v) if transform else v) for a, v in s]
    atual = vals[-1]
    d_tri = round(atual[1] - vals[-2][1], 4) if len(vals) > 1 else None
    d_ano = round(atual[1] - vals[0][1], 4) if len(vals) >= 5 else None
    out = {"nome": nome, "valor": round(atual[1], 4), "periodo": PERIODOS_LBL.get(atual[0], atual[0]),
           "d_tri": d_tri, "d_ano": d_ano, "unit": unit, "fonte": fonte, "status": status,
           "historico": [{"p": PERIODOS_LBL.get(a, a), "v": round(v, 4)} for a, v in vals]}
    if peers_vals:
        sv = sorted(peers_vals)
        below = sum(1 for x in sv if x < atual[1])
        out["mediana_pares"] = round(sv[len(sv) // 2], 4)
        out["percentil_pares"] = round(below / max(len(sv) - 1, 1) * 100, 1)
    return out


def build(con, cfg, inst_gold, of_gold, quality_avg):
    pcfg = cfg.get("inst_pages", {})
    pilotos = pcfg.get("pilotos", [])
    inst_by_cod = {i["cod_inst"]: i for i in inst_gold.get("instituicoes", [])}
    anomes = inst_gold.get("anomes")

    # totais do sistema (participação)
    tot_carteira = sum(i["carteira_brl"] for i in inst_gold.get("instituicoes", []))

    paginas = []
    for p in pilotos:
        cod = p["cod_inst"]
        row = con.execute("SELECT name, tcb, uf, municipio, sr, cod_congl_prud FROM institutions WHERE cod_inst=?",
                          (cod,)).fetchone()
        if not row:
            continue
        name, tcb, uf, mun, sr, congl = row
        ig = inst_by_cod.get(cod, {})
        peers_cods = [i["cod_inst"] for i in inst_gold.get("instituicoes", []) if i.get("grupo_pares") == (ig.get("grupo_pares"))]

        def peer_vals(metric, transform=None):
            out = []
            for c2 in peers_cods:
                s = _metric_series(con, c2, metric)
                if s:
                    v = s[-1][1]
                    out.append(transform(v) if transform else v)
            return out

        # indicadores principais (só o que é observável — o resto vai em 'indisponiveis')
        F_IF = "BCB IF.data (Olinda, conglomerado prudencial)"
        F_CAP = "BCB IF.data (interface, Informações de Capital)"
        inds = [x for x in [
            _indicador(con, cod, "ativo_total", "Ativos totais", "R$", F_IF, "observado regulatório", peer_vals("ativo_total")),
            _indicador(con, cod, "patrimonio_liquido", "Patrimônio líquido", "R$", F_IF, "observado regulatório", peer_vals("patrimonio_liquido")),
            _indicador(con, cod, "carteira_credito", "Carteira de crédito", "R$", F_IF, "observado regulatório", peer_vals("carteira_credito")),
            _indicador(con, cod, "lucro_liquido", "Lucro líquido (acumulado no ano IF.data — não é 12m móvel)", "R$", F_IF, "observado regulatório", peer_vals("lucro_liquido")),
            _indicador(con, cod, "indice_basileia", "Índice de Basileia", "%", F_CAP, "observado regulatório", peer_vals("indice_basileia", lambda v: v * 100), lambda v: v * 100),
            _indicador(con, cod, "indice_capital_principal", "Capital principal", "%", F_CAP, "observado regulatório", peer_vals("indice_capital_principal", lambda v: v * 100), lambda v: v * 100),
            _indicador(con, cod, "razao_alavancagem", "Razão de alavancagem", "%", F_CAP, "observado regulatório", peer_vals("razao_alavancagem", lambda v: v * 100), lambda v: v * 100),
            _indicador(con, cod, "rwa", "Ativos ponderados pelo risco (RWA)", "R$", F_CAP, "observado regulatório", peer_vals("rwa")),
        ] if x]
        # razões calculadas
        m_now = {m: s[-1][1] for m in ("ativo_total", "patrimonio_liquido", "carteira_credito", "lucro_liquido", "captacoes")
                 for s in [_metric_series(con, cod, m)] if s}
        calculados = []
        if m_now.get("patrimonio_liquido"):
            calculados.append({"nome": "ROE do período (lucro acumulado ÷ PL)", "valor": round(m_now["lucro_liquido"] / m_now["patrimonio_liquido"] * 100, 2),
                               "unit": "%", "fonte": F_IF, "status": "calculado",
                               "nota": "Não anualizado; métrica padronizada do Observatório (difere de ROE ajustado divulgado pela administração)."})
        if m_now.get("captacoes") and m_now["captacoes"] > 0:
            calculados.append({"nome": "Carteira ÷ captações", "valor": round(m_now["carteira_credito"] / m_now["captacoes"] * 100, 1),
                               "unit": "%", "fonte": F_IF, "status": "calculado",
                               "nota": "Captações do Resumo IF.data ≠ depósitos: rótulo mantido fiel à fonte."})
        if tot_carteira:
            calculados.append({"nome": "Participação na carteira (universo top-30)", "valor": round(m_now.get("carteira_credito", 0) / tot_carteira * 100, 2),
                               "unit": "%", "fonte": F_IF, "status": "calculado",
                               "nota": "Denominador = soma dos 30 maiores conglomerados, não o SFN total."})

        # carteira (composição real)
        met_all = {m: v for m, v in con.execute(
            "SELECT metric, value FROM institution_metrics WHERE cod_inst=? AND anomes=?", (cod, anomes)).fetchall()}
        perfil = carteira_profile(met_all)

        # open finance (match real)
        of_entry = None
        if of_gold and not of_gold.get("demo", True):
            for r2 in of_gold.get("ranking", []):
                if _match_alias(r2["organisation"], p["aliases"]):
                    of_entry = r2
                    break

        # reclamações (match por nome nas 4 janelas)
        recl = []
        try:
            for ano, tri, cnpj, nome_r, indice, nrecl, cli, pos in con.execute(
                    "SELECT * FROM reclamacoes ORDER BY ano DESC, trimestre DESC").fetchall():
                if _match_alias(nome_r, p["aliases"]):
                    recl.append({"periodo": f"{ano}-T{tri}", "indice": indice, "posicao": pos,
                                 "reclamacoes": nrecl, "clientes": cli, "cnpj": cnpj, "nome_fonte": nome_r})
        except Exception:
            pass
        cnpj_bcb = recl[0]["cnpj"] if recl else None

        # citações em recuperações judiciais (exposição OBSERVADA em publicações)
        rj_cit = 0
        try:
            for (bancos,) in con.execute("SELECT bancos FROM rj_credores").fetchall():
                if any(_match_alias(b["nome"], p["aliases"]) for b in json.loads(bancos or "[]")):
                    rj_cit += 1
        except Exception:
            pass

        # alertas da instituição (quantitativos, com justificativa)
        alertas = []
        bas = _metric_series(con, cod, "indice_basileia")
        if len(bas) > 1 and (bas[-1][1] - bas[-2][1]) * 100 < -0.5:
            alertas.append({"severidade": "atencao", "indicador": "Índice de Basileia",
                            "valor": round(bas[-1][1] * 100, 2), "benchmark": round(bas[-2][1] * 100, 2),
                            "periodo": PERIODOS_LBL.get(bas[-1][0]), "fonte": F_CAP,
                            "justificativa": "Queda superior a 0,5 p.p. no trimestre."})
        cart = _metric_series(con, cod, "carteira_credito")
        if len(cart) >= 5 and cart[0][1] > 0 and (cart[-1][1] / cart[0][1] - 1) * 100 > 30:
            alertas.append({"severidade": "atencao", "indicador": "Crescimento da carteira (4 trim.)",
                            "valor": round((cart[-1][1] / cart[0][1] - 1) * 100, 1), "benchmark": 30,
                            "periodo": "12m", "fonte": F_IF,
                            "justificativa": "Crescimento acima de 30% em 4 trimestres — checar apetite de risco."})
        if ig.get("score_delta") is not None and ig["score_delta"] > 10:
            alertas.append({"severidade": "atencao", "indicador": "Score de risco relativo",
                            "valor": ig["score"], "benchmark": ig.get("score_anterior"),
                            "periodo": anomes, "fonte": "Observatório (calculado)",
                            "justificativa": f"Alta de {ig['score_delta']} pontos no trimestre dentro do grupo de pares."})

        # síntese factual frase a frase
        sintese = []
        if m_now:
            sintese.append({"frase": f"{p['nome_comercial']} é um conglomerado prudencial {PEER_GROUP_LABELS.get(sr, sr)} com ativos de R$ {m_now.get('ativo_total', 0)/1e9:.1f} bi e carteira de R$ {m_now.get('carteira_credito', 0)/1e9:.1f} bi ({PERIODOS_LBL.get(anomes)}).",
                            "base": f"IF.data {anomes}; observado regulatório", "status": "observado regulatório"})
        if perfil and perfil.get("top_cnae"):
            # "concentrada em: outros" é um contrassenso — o residual sai da
            # enumeração e vira menção própria, com a fatia declarada
            setores_id = [(k, v) for k, v in perfil["top_cnae"] if k != "outros"][:3]
            outros_pct = next((v for k, v in perfil["top_cnae"] if k == "outros"), None)
            sintese.append({"frase": "Setores identificados na carteira PJ: " + ", ".join(f"{k.replace('_', ' ')} ({v}%)" for k, v in setores_id) + (f" — {outros_pct}% da carteira não é setorialmente individualizado pela fonte ('outros')" if outros_pct is not None else "") + (f"; HHI setorial (piso) {perfil.get('hhi_setorial')}" if perfil.get("hhi_setorial") else "") + ".",
                            "base": "IF.data carteiras por CNAE (observado); shares calculadas", "status": "calculado"})
        if perfil and perfil.get("pme_share_pct") is not None:
            sintese.append({"frase": f"Micro e pequenas empresas representam {perfil['pme_share_pct']}% da carteira PJ classificada por porte.",
                            "base": "IF.data carteira por porte (observado)", "status": "calculado"})
        if bas:
            sintese.append({"frase": f"Basileia de {bas[-1][1]*100:.2f}% em {PERIODOS_LBL.get(bas[-1][0])} ({'alta' if len(bas)>1 and bas[-1][1]>=bas[-2][1] else 'queda'} vs. trimestre anterior).",
                            "base": "IF.data Informações de Capital (observado regulatório)", "status": "observado regulatório"})
        if ig.get("vulnerabilidade"):
            v = ig["vulnerabilidade"]
            sintese.append({"frase": f"Em cenário severamente adverso, a Basileia ficaria entre {v['basileia_pos_choque_pct'][0]}% e {v['basileia_pos_choque_pct'][1]}% (intervalo, condicional às hipóteses).",
                            "base": "Cenário do Observatório (elasticidades empíricas + LGD 45% ÷ RWA)", "status": "cenário"})
        if ig.get("captacao"):
            cap = ig["captacao"]
            sintese.append({"frase": f"Custo de captação estimado em {cap['custo_aa_pct']}% a.a. ({cap['formula']}) — estimativa sobre estoques de ponta, não saldo médio diário.",
                            "base": "IF.data UI (passivo + DRE); cálculo do Observatório com fórmula declarada", "status": "calculado"})
        if ig.get("modelo_negocio") and ig["modelo_negocio"].get("receita_servicos_pct") is not None:
            sintese.append({"frase": f"Receitas de serviços respondem por {ig['modelo_negocio']['receita_servicos_pct']}% da receita operacional (serviços ÷ intermediação + serviços, DRE IF.data).",
                            "base": "IF.data UI (DRE); cálculo do Observatório", "status": "calculado"})
        if ig.get("modelo_negocio") and ig["modelo_negocio"].get("eficiencia_pct") is not None:
            sintese.append({"frase": f"Índice de eficiência de {ig['modelo_negocio']['eficiencia_pct']}% (pessoal + administrativas ÷ receita operacional do mesmo período — quanto menor, mais eficiente).",
                            "base": "IF.data UI (DRE); cálculo do Observatório", "status": "calculado"})
        if recl:
            sintese.append({"frase": f"No Ranking de Reclamações do BCB ({recl[0]['periodo']}), índice {recl[0]['indice'] if recl[0]['indice'] is not None else 'n/d'} (posição {recl[0]['posicao']} do arquivo) — indicador operacional/reputacional, não de solvência.",
                            "base": "BCB rdrweb (observado regulatório)", "status": "observado regulatório"})
        if rj_cit:
            sintese.append({"frase": f"Citado como credor em {rj_cit} processos de RJ/falência com publicação recente (exposição observada em listas de credores; não mede exposição total).",
                            "base": "CNJ/DJEN, janela de 60 dias (observado)", "status": "observado"})
        if of_entry:
            fam_txt = (f" e publica {of_entry['familias_api']} famílias de API"
                       if of_entry.get("familias_api") else "")
            sintese.append({"frase": f"No Open Finance, responde por {of_entry['share_pct']}% das chamadas transacionais{fam_txt}.",
                            "base": "Dashboard do Cidadão + diretório oficial (observado)", "status": "observado"})
        sintese.append({"frase": "Dados de qualidade de carteira, liquidez regulatória (LCR/NSFR) e eficiência não estão disponíveis nas fontes públicas integradas — nenhuma conclusão é oferecida sobre essas dimensões.",
                        "base": "Política da plataforma: ausência não é zero", "status": "limitação"})

        paginas.append({
            "cod_inst": cod, "caso": p["caso"],
            "cabecalho": {
                "nome_comercial": p["nome_comercial"], "razao_social_fonte_bcb": name,
                "cnpj": cnpj_bcb or "não disponível nas fontes integradas",
                "codigo_bcb": cod, "tipo_tcb": tcb, "sede": f"{mun or ''}/{uf or ''}",
                "segmento_prudencial": sr, "grupo_pares": PEER_GROUP_LABELS.get(sr, sr),
                "conglomerado_prudencial": congl, "capital": p["capital"], "modelo": p["modelo"],
                "consolidacao": "Conglomerado prudencial (IF.data tipo 2) — visões 'instituição individual' e 'conglomerado financeiro' não integradas nesta versão (sem alternância simulada)",
                "data_base": PERIODOS_LBL.get(anomes, anomes), "atualizado_em": common.now_utc(),
                "aviso_pares": p.get("aviso_pares"),
            },
            "indicadores": inds, "calculados": calculados,
            "indisponiveis": [{"indicador": a, "motivo": b} for a, b in INDISPONIVEIS],
            "carteira_perfil": perfil,
            "score_ref": {k: ig.get(k) for k in ("score", "score_delta", "faixa", "dimensoes",
                                                 "historico_score", "vulnerabilidade", "dimensoes_disponiveis",
                                                 "captacao", "modelo_negocio")} if ig else None,
            "openfinance": of_entry,
            "reclamacoes": recl[:4],
            "rj_citacoes": {"casos": rj_cit, "nota": "presença em listas de credores publicadas (janela 60d) — não mede exposição total"},
            "alertas": alertas,
            "sintese": sintese,
        })

    # relatório de cobertura (universo top-30) — exigido antes de escalar (§22)
    cober = {}
    top30 = [i["cod_inst"] for i in inst_gold.get("instituicoes", [])]
    def cov(fn):
        return round(sum(1 for c in top30 if fn(c)) / max(len(top30), 1) * 100)
    cober["basileia_pct"] = cov(lambda c: bool(_metric_series(con, c, "indice_basileia")))
    cober["carteira_detalhada_pct"] = cov(lambda c: any(m.startswith("cart_") for m, in con.execute(
        "SELECT DISTINCT metric FROM institution_metrics WHERE cod_inst=? AND anomes=?", (c, anomes)).fetchall()))
    cober["historico_5t_pct"] = cov(lambda c: len(_metric_series(con, c, "ativo_total")) >= 5)
    try:
        recl_nomes = [r[0] for r in con.execute("SELECT DISTINCT nome FROM reclamacoes").fetchall()]
    except Exception:
        recl_nomes = []
    nomes30 = {c: (con.execute("SELECT name FROM institutions WHERE cod_inst=?", (c,)).fetchone() or [""])[0] for c in top30}
    cober["reclamacoes_match_pct"] = cov(lambda c: any(_match_alias(n, [nomes30[c]]) for n in recl_nomes))
    of_names = [r["organisation"] for r in (of_gold.get("ranking", []) if of_gold else [])]
    cober["openfinance_match_pct"] = cov(lambda c: any(_match_alias(n, [nomes30[c]]) for n in of_names))

    return {
        "ok": True, "gerado_em": common.now_utc(),
        "nota": pcfg.get("nota"), "paginas": paginas,
        "cobertura_top30": cober,
        "hierarquia_fontes": ["Banco Central (IF.data/SGS/rdrweb)", "CNJ (DataJud/DJEN)",
                              "Open Finance Brasil", "BrasilAPI/Receita",
                              "— não integrados: CVM, Pilar 3, RI, agências de rating, imprensa"],
        "metodo": "Consolidação única (conglomerado prudencial); cada dado classificado por origem; "
                  "benchmark = mediana do grupo prudencial; indicadores indisponíveis declarados com motivo.",
    }
