"""Funding e captação — gold funding.json.

Três fontes, três réguas, declaradas separadamente e nunca somadas entre si:
1. **Sistema** (BCB/SGS, meios de pagamento amplos): saldos de fim de mês, em poder do
   público, dos instrumentos com que o sistema financeiro se financia: depósitos à
   vista, poupança, depósitos a prazo, letras financeiras, letras de crédito (LCI e
   LCA), outros títulos privados, compromissadas com títulos privados, quotas de
   fundos monetários e títulos federais. É a foto macro, mensal, em R$ (o SGS publica
   em R$ mil; aqui convertido).
2. **Bancos** (BCB/IF.data, relatório Passivo): as mesmas captações abertas por
   instituição, trimestre a trimestre, no corte de conglomerados prudenciais e
   instituições independentes. Três grupos declarados: varejo (à vista, poupança, a
   prazo, LCI, LCA, outros depósitos), mercado (interfinanceiro, compromissadas,
   letras financeiras, TVM no exterior, demais títulos) e repasses (obrigações por
   empréstimos e repasses). Os três somam as captações do relatório.
3. **Fundos** (CVM/CDA, bloco 5): quanto de letra financeira, CDB e DPGE de cada
   emissor está nas carteiras dos fundos, mês a mês, com o vínculo gestor-emissor
   declarado pela própria classe. É QUEM financia cada banco pelo mercado, não o
   quanto o banco capta (isso é o IF.data).

Regras: ausência é nulo; o mês corrente do CDA é parcial até que o número de classes
com posição chegue a 90% do mês anterior; a razão "CDA ÷ letras financeiras do IF.data"
cruza datas diferentes (mensal × trimestral) e é publicada como indicativa; nomes de
emissor vêm do cadastro do IF.data pelo CNPJ raiz, nunca do texto livre da CVM.
"""
from pipeline import common
from pipeline.fmt import _r, _share, _mes_menos, _mil, _dec

FONTES = {
    "sgs": {"nome": "BCB — Meios de pagamento amplos e depósitos de poupança (SGS 27789 a 27816, 1835, 7836)",
            "url": "https://api.bcb.gov.br/dados/serie/bcdata.sgs.27815/dados?formato=json",
            "catalogo": "https://dadosabertos.bcb.gov.br/dataset/27815-sgs",
            "licenca": "dados abertos do BCB", "nivel": "A — estatística monetária oficial, mensal"},
    "ifdata": {"nome": "BCB — IF.data, relatório Passivo por instituição (API Olinda, conglomerados prudenciais e independentes)",
               "url": "https://olinda.bcb.gov.br/olinda/servico/IFDATA/versao/v1/odata/",
               "catalogo": "https://www3.bcb.gov.br/ifdata/",
               "licenca": "dados abertos do BCB", "nivel": "A — informação contábil regulatória, trimestral"},
    "cda": {"nome": "CVM — Composição e diversificação das aplicações dos fundos (CDA), bloco 5: depósitos a prazo e outros títulos de IF",
            "url": "https://dados.cvm.gov.br/dados/FI/DOC/CDA/DADOS/",
            "catalogo": "https://dados.cvm.gov.br/dataset/fi-doc-cda",
            "licenca": "dados abertos da CVM", "nivel": "A — informe regulatório por classe de fundo, mensal, posição a posição"},
}
# (chave SGS, id, nome, cor) — a ordem é a das camadas do gráfico
SISTEMA = [
    ("fd_vista", "vista", "Depósitos à vista", "#1d4e89"),
    ("fd_poupanca", "poupanca", "Poupança", "#0e7c7b"),
    ("fd_prazo", "prazo", "Depósitos a prazo (CDB/RDB)", "#2f7d4f"),
    ("fd_lf", "lf", "Letras financeiras", "#6b46a3"),
    ("fd_letras_credito", "letras_credito", "Letras de crédito (LCI e LCA)", "#b45309"),
    ("fd_outros_titulos", "outros_titulos", "Outros títulos privados", "#8d5a2b"),
    ("fd_compromissadas", "compromissadas", "Compromissadas com títulos privados", "#9aa3ad"),
    ("fd_fundos_monetarios", "fundos_monetarios", "Quotas de fundos monetários", "#c0392b"),
    ("fd_titulos_federais", "titulos_federais", "Títulos federais (Selic)", "#555"),
]
AGREGADOS = [("fd_m2", "m2", "M2"), ("fd_m3", "m3", "M3"), ("fd_m4", "m4", "M4")]
# IF.data: grupos declarados; a soma dos três é "captacoes" do relatório
ITENS_IFDATA = [
    ("dep_vista", "Depósitos à vista", "varejo", "#1d4e89"),
    ("dep_poupanca", "Poupança", "varejo", "#0e7c7b"),
    ("dep_prazo", "Depósitos a prazo", "varejo", "#2f7d4f"),
    ("lci", "LCI", "varejo", "#b45309"),
    ("lca", "LCA", "varejo", "#d97706"),
    ("dep_outros", "Outros depósitos e contas pré-pagas", "varejo", "#7cb342"),
    ("dep_interfin", "Depósitos interfinanceiros", "mercado", "#9aa3ad"),
    ("compromissadas", "Operações compromissadas", "mercado", "#6b7280"),
    ("lf", "Letras financeiras", "mercado", "#6b46a3"),
    ("tvm_exterior", "Títulos no exterior", "mercado", "#8d5a2b"),
    ("outros_titulos", "Demais instrumentos de dívida", "mercado", "#a78bfa"),
    ("emprestimos_repasses", "Empréstimos e repasses", "repasses", "#c0392b"),
]
GRUPOS = {"varejo": "Varejo e depósitos", "mercado": "Mercado", "repasses": "Empréstimos e repasses"}
PISO_COBERTURA_CDA = 0.90
PISO_DEPOSITOS_LTD = 0.10   # LTD só faz sentido onde depósitos são ao menos 10% das captações
TOP_INSTITUICOES = 40
TOP_EMISSORES = 30
SERIE_MESES = 120
MIL = 1e3  # SGS publica em R$ mil


def _var(v, v0):
    return _r((v / v0 - 1) * 100) if v is not None and v0 else None


def _hhi(vals):
    tot = sum(vals)
    return _r(sum((v / tot * 100) ** 2 for v in vals), 0) if tot else None


def _sgs(con, key):
    return {d[:7]: v * MIL for d, v in common.get_series(con, key)}


def _bi(v):
    return f"R$ {_dec(v / 1e9, 1)} bi" if abs(v) < 1e12 else f"R$ {_dec(v / 1e12, 2)} tri"


# ---------------------------------------------------------------- sistema (SGS)
def _sistema(con):
    series = {key: _sgs(con, key) for key, *_ in SISTEMA}
    agg = {key: _sgs(con, key) for key, *_ in AGREGADOS}
    if not agg.get("fd_m4"):
        return None
    meses = sorted(agg["fd_m4"])
    mes = meses[-1]
    ant12 = _mes_menos(mes, 12)
    m4 = agg["fd_m4"][mes]
    comps = []
    for key, cid, nome, cor in SISTEMA:
        s = series[key]
        v = s.get(mes)
        comps.append({"id": cid, "nome": nome, "cor": cor, "valor": v, "share_m4": _share(v, m4),
                      "var_12m_pct": _var(v, s.get(ant12)), "var_mes_pct": _var(v, s.get(_mes_menos(mes, 1)))})
    agregados = [{"id": cid, "nome": nome, "valor": agg[key].get(mes), "var_12m_pct": _var(agg[key].get(mes), agg[key].get(ant12))} for key, cid, nome in AGREGADOS]
    serie = []
    for m in meses[-SERIE_MESES:]:
        p = {"ref": m, "m4": agg["fd_m4"].get(m)}
        for key, cid, *_ in SISTEMA:
            p[cid] = series[key].get(m)
        serie.append(p)
    sbpe = _sgs(con, "fd_poupanca_sbpe")
    ms = max(sbpe) if sbpe else None
    return {"mes": mes, "componentes": comps, "agregados": agregados, "serie": serie,
            "poupanca_sbpe": {"mes": ms, "valor": sbpe.get(ms), "var_12m_pct": _var(sbpe.get(ms), sbpe.get(_mes_menos(ms, 12)))} if ms else None,
            "nota": "Saldos em poder do público (M4 e componentes), fim de período. Letras financeiras e depósitos a prazo aqui excluem o que está com outras instituições financeiras; por isso não fecham com o IF.data."}


# ---------------------------------------------------------------- bancos (IF.data)
def _passivo(con, anomes):
    rows = con.execute("SELECT cod_inst, item, value FROM ifdata_passivo WHERE anomes=?", (anomes,)).fetchall()
    por = {}
    for cod, item, v in rows:
        por.setdefault(cod, {})[item] = v
    return por


def _grupos(d):
    g = {"varejo": 0.0, "mercado": 0.0, "repasses": 0.0}
    for item, _n, grupo, _c in ITENS_IFDATA:
        g[grupo] += d.get(item) or 0.0
    return g


def _bancos(con):
    anomes_list = [r[0] for r in con.execute("SELECT DISTINCT anomes FROM ifdata_passivo ORDER BY anomes DESC").fetchall()]
    if not anomes_list:
        return None
    anomes = anomes_list[0]
    ano_ant = f"{int(anomes[:4]) - 1}{anomes[4:]}"
    por = _passivo(con, anomes)
    por_ant = _passivo(con, ano_ant) if ano_ant in anomes_list else {}
    cad = {r[0]: {"nome": r[1], "tcb": r[2], "sr": r[3]} for r in con.execute("SELECT cod_inst, name, tcb, sr FROM institutions").fetchall()}
    cart = {r[0]: r[1] for r in con.execute("SELECT cod_inst, value FROM institution_metrics WHERE anomes=? AND metric='carteira_credito'", (anomes,)).fetchall()}
    # agregado do sistema (soma das instituições do corte)
    agg = {}
    for d in por.values():
        for item, v in d.items():
            agg[item] = agg.get(item, 0.0) + (v or 0.0)
    agg_ant = {}
    for d in por_ant.values():
        for item, v in d.items():
            agg_ant[item] = agg_ant.get(item, 0.0) + (v or 0.0)
    cap = agg.get("captacoes") or 0.0
    composicao = [{"item": item, "nome": nome, "grupo": grupo, "cor": cor, "valor": agg.get(item), "share": _share(agg.get(item), cap),
                   "var_12m_pct": _var(agg.get(item), agg_ant.get(item))} for item, nome, grupo, cor in ITENS_IFDATA]
    g = _grupos(agg)
    grupos = [{"id": k, "nome": GRUPOS[k], "valor": v, "share": _share(v, cap)} for k, v in g.items()]
    cart_total = sum(cart.get(c) or 0.0 for c in por)
    indicadores = {"varejo_share": _share(g["varejo"], cap), "mercado_share": _share(g["mercado"], cap), "repasses_share": _share(g["repasses"], cap),
                   "ltd": _r(cart_total / agg["depositos"], 3) if agg.get("depositos") else None,
                   "soma_grupos_vs_captacoes_pct": _share(sum(g.values()), cap)}

    def ficha(cod, d):
        c = cad.get(cod, {})
        capi = d.get("captacoes") or 0.0
        gi = _grupos(d)
        comp = {item: _share(d.get(item), capi) for item, *_ in ITENS_IFDATA}
        da = por_ant.get(cod, {})
        return {"cod_inst": cod, "nome": (c.get("nome") or cod).replace(" - PRUDENCIAL", "").strip(), "sr": c.get("sr"), "tcb": c.get("tcb"),
                "captacoes": capi, "share_sfn": _share(capi, cap), "var_12m_pct": _var(capi, da.get("captacoes")),
                "depositos": d.get("depositos"), "pl": d.get("pl"), "passivo_total": d.get("passivo_total"),
                "composicao": comp, "varejo_share": _share(gi["varejo"], capi), "mercado_share": _share(gi["mercado"], capi), "repasses_share": _share(gi["repasses"], capi),
                "ltd": _r(cart[cod] / d["depositos"], 3) if cart.get(cod) and d.get("depositos") and d["depositos"] >= PISO_DEPOSITOS_LTD * capi else None,
                "lf": d.get("lf"), "dep_prazo": d.get("dep_prazo")}
    fichas = [ficha(cod, d) for cod, d in por.items() if (d.get("captacoes") or 0) > 0]
    fichas.sort(key=lambda x: -x["captacoes"])
    top = fichas[:TOP_INSTITUICOES]
    # por segmento prudencial e por tipo (TCB)
    def agrupa(chave, rotulo):
        grp = {}
        for f in fichas:
            k = f.get(chave) or "n/d"
            a = grp.setdefault(k, {"chave": k, "n": 0, "captacoes": 0.0, "varejo": 0.0, "mercado": 0.0, "repasses": 0.0, "depositos": 0.0, "carteira": 0.0})
            a["n"] += 1
            a["captacoes"] += f["captacoes"]
            gi = _grupos(por[f["cod_inst"]])
            for kk in ("varejo", "mercado", "repasses"):
                a[kk] += gi[kk]
            a["depositos"] += por[f["cod_inst"]].get("depositos") or 0.0
            a["carteira"] += cart.get(f["cod_inst"]) or 0.0
        out = []
        for a in sorted(grp.values(), key=lambda x: -x["captacoes"]):
            out.append({rotulo: a["chave"], "n": a["n"], "captacoes": a["captacoes"], "share_sfn": _share(a["captacoes"], cap),
                        "varejo_share": _share(a["varejo"], a["captacoes"]), "mercado_share": _share(a["mercado"], a["captacoes"]), "repasses_share": _share(a["repasses"], a["captacoes"]),
                        "ltd": _r(a["carteira"] / a["depositos"], 3) if a["depositos"] else None})
        return out
    # série trimestral agregada
    serie = []
    for am in sorted(anomes_list):
        a = {}
        for d in _passivo(con, am).values():
            for item, v in d.items():
                a[item] = a.get(item, 0.0) + (v or 0.0)
        p = {"anomes": am, "captacoes": a.get("captacoes")}
        for item, *_ in ITENS_IFDATA:
            p[item] = a.get(item)
        gg = _grupos(a)
        p["varejo_share"] = _share(gg["varejo"], a.get("captacoes")); p["mercado_share"] = _share(gg["mercado"], a.get("captacoes"))
        serie.append(p)
    hhi = _hhi([f["captacoes"] for f in fichas])
    top5 = _share(sum(f["captacoes"] for f in fichas[:5]), cap)
    return {"anomes": anomes, "anomes_anterior": ano_ant if por_ant else None, "n_instituicoes": len(fichas),
            "agregado": {k: agg.get(k) for k in ("captacoes", "depositos", "pl", "passivo_total")},
            "composicao": composicao, "grupos": grupos, "indicadores": indicadores,
            "concentracao": {"hhi": hhi, "top5_share": top5},
            "por_segmento": agrupa("sr", "sr"), "por_tcb": agrupa("tcb", "tcb"),
            "instituicoes": top, "serie": serie,
            "nota": ("Corte de conglomerados prudenciais e instituições independentes (o mesmo das demais abas do IF.data). "
                     "Depósitos a prazo incluem CDBs de institucionais; 'varejo' é o rótulo do instrumento, não do cliente. "
                     "A série trimestral atravessa três planos contábeis (2016, 2023 e 2025): os itens foram casados pelo nome "
                     "da coluna e a mudança é declarada, nunca escondida.")}


# ---------------------------------------------------------------- fundos (CVM CDA)
def _fundos(con):
    col = {r[0]: r for r in con.execute("SELECT mes, n_classes_blc5, n_classes_pl, pl_total, valor_blc5, valor_sigilo, sigilo_ate FROM cda_coleta ORDER BY mes").fetchall()}
    if not col:
        return None
    meses = sorted(col)
    parcial = {}
    for i, m in enumerate(meses):
        # referência: o maior número de classes dos 3 meses anteriores (o sigilo derruba
        # dois ou três meses seguidos; comparar só com o mês anterior mascararia o segundo)
        ref = max([col[x][1] or 0 for x in meses[max(0, i - 3):i]] or [0])
        parcial[m] = bool(ref) and (col[m][1] or 0) < PISO_COBERTURA_CDA * ref
    fechados = [m for m in meses if not parcial[m]]
    if not fechados:
        return None
    mes = fechados[-1]
    ant12 = _mes_menos(f"{mes[:4]}-{mes[4:]}", 12).replace("-", "")
    rows = con.execute("SELECT cnpj_raiz, emissor, tp_ativo, ligado, n_classes, n_posicoes, valor, valor_venc_12m FROM cda_if WHERE mes=?", (mes,)).fetchall()
    rows_ant = con.execute("SELECT cnpj_raiz, SUM(valor) FROM cda_if WHERE mes=? GROUP BY cnpj_raiz", (ant12,)).fetchall() if ant12 in col else []
    ant_por = dict(rows_ant)
    cad = {r[0]: {"nome": r[1], "tcb": r[2], "sr": r[3], "congl": r[4]} for r in con.execute("SELECT cod_inst, name, tcb, sr, cod_congl_prud FROM institutions").fetchall()}
    # IF.data do trimestre mais recente, para a razão indicativa CDA ÷ LF
    am = con.execute("SELECT MAX(anomes) FROM ifdata_passivo").fetchone()[0]
    pas = _passivo(con, am) if am else {}
    # O relatório é publicado por conglomerado FINANCEIRO (código C..., ex.: "BRADESCO") e
    # cada CNPJ do cadastro aponta o conglomerado PRUDENCIAL (outro código C...). A ponte
    # é: CNPJ raiz do emissor → prudencial → o código financeiro presente no relatório.
    por_prud = {}
    for cod, c in cad.items():
        if cod in pas and c.get("congl"):
            por_prud.setdefault(c["congl"], []).append(cod)

    def chave_de(raiz):
        if raiz in pas:
            return raiz
        congl = (cad.get(raiz) or {}).get("congl")
        if congl and congl in por_prud:
            return sorted(por_prud[congl], key=lambda x: (not x.startswith("C"), x))[0]
        if congl and congl in pas:
            return congl
        return raiz
    total = sum(r[6] for r in rows)
    por_tipo = {}
    por_em = {}
    for raiz, emissor, tp, lig, ncl, npos, v, v12 in rows:
        t = por_tipo.setdefault(tp, {"tipo": tp, "valor": 0.0, "n_posicoes": 0, "ligado": 0.0, "venc_12m": 0.0})
        t["valor"] += v; t["n_posicoes"] += npos; t["venc_12m"] += v12
        if lig == "S":
            t["ligado"] += v
        chave = chave_de(raiz)
        e = por_em.setdefault(chave, {"chave": chave, "cnpj_raizes": [], "emissor_cvm": emissor, "valor": 0.0, "lf": 0.0, "cdb": 0.0, "dpge": 0.0, "outros": 0.0, "ligado": 0.0, "venc_12m": 0.0, "n_classes": 0, "n_posicoes": 0})
        if raiz not in e["cnpj_raizes"]:
            e["cnpj_raizes"].append(raiz)
        e["valor"] += v; e["venc_12m"] += v12; e["n_posicoes"] += npos; e["n_classes"] = max(e["n_classes"], ncl)
        if lig == "S":
            e["ligado"] += v
        if tp.startswith("Letra Financeira"):
            e["lf"] += v
        elif tp.startswith("CDB"):
            e["cdb"] += v
        elif tp.startswith("DPGE"):
            e["dpge"] += v
        else:
            e["outros"] += v
    tipos = [{"tipo": t["tipo"], "valor": t["valor"], "share": _share(t["valor"], total), "n_posicoes": t["n_posicoes"],
              "ligado_share": _share(t["ligado"], t["valor"]), "venc_12m_share": _share(t["venc_12m"], t["valor"])}
             for t in sorted(por_tipo.values(), key=lambda x: -x["valor"])]
    ant_por_chave = {}
    for raiz, v in ant_por.items():
        k = chave_de(raiz)
        ant_por_chave[k] = ant_por_chave.get(k, 0.0) + (v or 0.0)
    emissores = []
    for e in sorted(por_em.values(), key=lambda x: -x["valor"]):
        chave = e["chave"]
        c = cad.get(chave) or cad.get(e["cnpj_raizes"][0]) or {}
        nome = (c.get("nome") or e["emissor_cvm"] or chave).replace(" - PRUDENCIAL", "").strip()
        p = pas.get(chave) or {}
        # letras financeiras subordinadas e perpétuas ficam em "instrumentos de dívida elegíveis
        # a capital" (h), fora de (c3); o denominador soma os dois para não inflar a razão
        lf_if = (p.get("lf") or 0.0) + (p.get("divida_capital") or 0.0) if p else None
        emissores.append({**{k: v for k, v in e.items() if k not in ("ligado", "venc_12m", "chave")},
                          "cnpj_raiz": e["cnpj_raizes"][0], "cod_inst": chave if chave in cad else None, "nome": nome, "sr": c.get("sr"), "tcb": c.get("tcb"),
                          "share": _share(e["valor"], total), "ligado_share": _share(e["ligado"], e["valor"]), "venc_12m_share": _share(e["venc_12m"], e["valor"]),
                          "var_12m_pct": _var(e["valor"], ant_por_chave.get(chave)),
                          "lf_ifdata": lf_if or None, "lf_cda_sobre_ifdata_pct": _share(e["lf"], lf_if) if lf_if else None})
    serie = []
    for m in meses:
        r = con.execute("SELECT SUM(valor), COUNT(DISTINCT cnpj_raiz), SUM(CASE WHEN tp_ativo LIKE 'Letra Financeira%' THEN valor ELSE 0 END), SUM(CASE WHEN tp_ativo LIKE 'CDB%' THEN valor ELSE 0 END), SUM(CASE WHEN ligado='S' THEN valor ELSE 0 END) FROM cda_if WHERE mes=?", (m,)).fetchone()
        serie.append({"mes": f"{m[:4]}-{m[4:]}", "valor": r[0], "n_emissores": r[1], "lf": r[2], "cdb": r[3], "ligado_share": _share(r[4], r[0]), "n_classes": col[m][1], "parcial": parcial[m],
                      "sob_sigilo": col[m][5], "sigilo_ate": col[m][6]})
    hhi = _hhi([e["valor"] for e in emissores])
    top5 = _share(sum(e["valor"] for e in emissores[:5]), total)
    ligado_total = sum(e["ligado"] for e in por_em.values())
    parciais = [m for m in meses if parcial[m]]
    return {"mes": f"{mes[:4]}-{mes[4:]}", "mes_parcial_excluido": f"{meses[-1][:4]}-{meses[-1][4:]}" if parcial[meses[-1]] else None,
            "meses_parciais": [f"{m[:4]}-{m[4:]}" for m in parciais],
            "sigilo": {"mes": f"{meses[-1][:4]}-{meses[-1][4:]}", "valor": col[meses[-1]][5], "liberacao_ate": col[meses[-1]][6]} if col[meses[-1]][5] else None,
            "cobertura": {"classes_com_papel_bancario": col[mes][1], "classes_com_pl": col[mes][2], "pl_total": col[mes][3]},
            "total": {"valor": total, "share_pl": _share(total, col[mes][3]), "ligado_share": _share(ligado_total, total),
                      "venc_12m_share": _share(sum(e["venc_12m"] for e in por_em.values()), total), "n_emissores": len(emissores)},
            "por_tipo": tipos, "emissores": emissores[:TOP_EMISSORES], "concentracao": {"hhi": hhi, "top5_share": top5},
            "anomes_ifdata_razao": am, "serie": serie,
            "nota": ("Posições diretas das classes de fundos (a classe que compra a cota de outra classe aparece como cota, "
                     "não como papel, então não há dupla contagem do título). 'Ligado' é a marcação da própria classe de que o "
                     "emissor é ligado ao gestor. A razão CDA ÷ LF do IF.data cruza um mês com um trimestre e é indicativa.")}


# ---------------------------------------------------------------- build
def _seguro(fn, con):
    """Fonte ausente na silver (tabela ainda não criada) é nulo, nunca erro do painel inteiro."""
    try:
        return fn(con)
    except Exception as e:  # sqlite3.OperationalError em tabela inexistente, entre outros
        print(f"  [funding] {fn.__name__} indisponível: {str(e)[:120]}")
        return None


def build(con, cfg=None):
    sistema = _seguro(_sistema, con)
    bancos = _seguro(_bancos, con)
    fundos = _seguro(_fundos, con)
    if not (sistema or bancos or fundos):
        return {"disponivel": False, "motivo": "nenhuma das três fontes está na silver — rode bcb_sgs (fd_*), ifdata_passivo e cvm_cda"}
    partes = []
    if sistema:
        m4 = next(a for a in sistema["agregados"] if a["id"] == "m4")
        top = sorted([c for c in sistema["componentes"] if c["valor"]], key=lambda c: -(c["var_12m_pct"] or -1e9))
        partes.append(f"O público tinha {_bi(m4['valor'])} aplicados no sistema financeiro em {sistema['mes']} (M4, {'+' if m4['var_12m_pct'] >= 0 else ''}{_dec(m4['var_12m_pct'])}% em 12 meses); "
                      f"o instrumento que mais cresceu foi {top[0]['nome'].lower()} ({'+' if top[0]['var_12m_pct'] >= 0 else ''}{_dec(top[0]['var_12m_pct'])}%) e o que menos, {top[-1]['nome'].lower()} ({'+' if top[-1]['var_12m_pct'] >= 0 else ''}{_dec(top[-1]['var_12m_pct'])}%).")
    if bancos:
        i = bancos["indicadores"]
        partes.append(f"Nos balanços de {bancos['anomes'][:4]}-{bancos['anomes'][4:]}, as {_mil(bancos['n_instituicoes'])} instituições do corte captavam {_bi(bancos['agregado']['captacoes'])}: "
                      f"{_dec(i['varejo_share'], 0)}% em depósitos e letras de varejo, {_dec(i['mercado_share'], 0)}% em mercado e {_dec(i['repasses_share'], 0)}% em repasses; "
                      f"as cinco maiores respondem por {_dec(bancos['concentracao']['top5_share'], 0)}% das captações.")
    if fundos:
        e0 = fundos["emissores"][0] if fundos["emissores"] else None
        partes.append(f"Os fundos carregavam {_bi(fundos['total']['valor'])} em papéis bancários em {fundos['mes']} ({_dec(fundos['total']['share_pl'])}% do PL das classes), "
                      f"{_dec(next((t['share'] for t in fundos['por_tipo'] if t['tipo'].startswith('Letra')), 0), 0)}% em letras financeiras"
                      + (f"; o maior emissor é {e0['nome']} ({_bi(e0['valor'])}, {_dec(e0['share'], 0)}% do total)." if e0 else "."))
    return {
        "disponivel": True, "tipo": "DADO OBSERVADO (saldos, balanços, posições) + CALCULADO (shares, variações, razões, concentração)",
        "fontes": FONTES, "sistema": sistema, "bancos": bancos, "fundos": fundos,
        "sintese": " ".join(partes),
        "metodo": ("Sistema: saldos de fim de mês dos componentes de M4 (SGS), convertidos de R$ mil para R$; shares sobre M4; variações a/a. "
                   "Bancos: relatório Passivo do IF.data por instituição; captações = depósitos + compromissadas + títulos emitidos + empréstimos e repasses; "
                   "grupos varejo, mercado e repasses somam as captações; LTD = carteira de crédito ÷ depósitos; HHI sobre as captações das instituições do corte. "
                   "Fundos: bloco 5 do CDA agregado por emissor (CNPJ raiz) e tipo de papel; nome pelo cadastro do IF.data; conglomerado prudencial quando o CNPJ pertence a um; "
                   "mês com menos de 90% das classes com papel bancário do máximo dos três meses anteriores é parcial e fica fora (efeito do sigilo de até 90 dias que o gestor pode pedir para uma posição: nesse período a CVM publica o valor sem o emissor); vencimento em 12 meses a partir da data de competência."),
        "limitacoes": ("As três fontes não fecham entre si por construção: o SGS mede o que está com o público, o IF.data o que está no balanço (inclui o que outras "
                       "instituições financeiras carregam) e o CDA só o que está em fundos. O IF.data é trimestral com defasagem de um trimestre; o CDA é mensal com "
                       "defasagem de um mês, e os dois ou três meses mais recentes carregam posições sob sigilo (valor publicado sem emissor), por isso o mês de referência é o último com cobertura plena. Não há custo de captação por instrumento nas fontes abertas por instituição."),
        "cautelas": [
            "Dependência de mercado alta não é fragilidade por si: bancos de atacado captam assim por desenho. A leitura é relativa ao modelo de negócio e ao segmento.",
            "Ordenar instituições por captação é descrever tamanho, não conduta; as listas aqui são por valor porque a pergunta é 'de onde vem o dinheiro'.",
            "A razão CDA ÷ letras financeiras cruza datas diferentes (mês do CDA contra trimestre do IF.data) e o balanço não separa LF sênior de subordinada; acima de 100% aponta diferença de data ou de perímetro, não fato.",
            "'Ligado' vem da própria classe de fundo; a CVM não audita a marcação neste arquivo.",
        ],
        "catalogo": [
            {"nome": "M4 e componentes", "definicao": "saldos de fim de mês em poder do público, por instrumento", "unidade": "R$", "fonte": "BCB/SGS", "limitacoes": "exclui posições de instituições financeiras"},
            {"nome": "Captações (IF.data)", "definicao": "depósitos + compromissadas + títulos emitidos + empréstimos e repasses, por instituição", "unidade": "R$", "fonte": "BCB/IF.data Passivo", "limitacoes": "trimestral; três planos contábeis na série"},
            {"nome": "Varejo, mercado, repasses", "definicao": "grupos declarados de instrumentos; somam as captações", "unidade": "% das captações", "fonte": "calculado", "limitacoes": "rótulo do instrumento, não do cliente"},
            {"nome": "LTD", "definicao": "carteira de crédito ÷ depósitos totais", "unidade": "razão", "fonte": "calculado (IF.data)", "limitacoes": "carteira do Resumo; depósitos do Passivo; só onde depósitos são ao menos 10% das captações"},
            {"nome": "Papel bancário em fundos", "definicao": "valor a mercado de LF, CDB, DPGE e afins por emissor nas classes de fundos", "unidade": "R$", "fonte": "CVM/CDA bloco 5", "limitacoes": "só fundos; mês corrente parcial"},
            {"nome": "HHI", "definicao": "soma dos quadrados das participações (0 a 10.000)", "unidade": "pontos", "fonte": "calculado", "limitacoes": "sobre o corte, não sobre o universo"},
        ],
    }
