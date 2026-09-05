"""Crédito direcionado e BNDES — gold bndes.json.

Três réguas, declaradas e nunca somadas entre si:
1. **Saldo direcionado** (BCB/SGS): quanto da carteira de crédito do SFN tem taxa
   regulada ou funding público, e quanto desse saldo é repasse do BNDES. ESTOQUE.
2. **Desembolsos do Sistema BNDES** (dados abertos do BNDES): quanto o banco liberou por
   mês, por porte, UF, setor, produto e agente. FLUXO em R$ milhões nominais, desde
   1995, cobrindo direto e indireto (automático ou não). Consultas e aprovações são as
   etapas anteriores do funil, na mesma régua.
3. **Operações não automáticas** (dados abertos do BNDES): contrato a contrato, o que o
   BNDES financia diretamente ou por agente sem automaticidade. Cobre uma fração do
   desembolso (as automáticas ficam fora) e a aba diz qual.

Regras: ausência é nulo; o último mês das estatísticas é o último publicado (o BNDES
publica com defasagem de meses e a aba mostra a data-base); janela de 12 meses fechada
no último mês publicado; nada é deflacionado; concentração é medida (HHI), não adjetivada.
"""
from pipeline import common

FONTES = {
    "sgs": {"nome": "BCB — Estatísticas de crédito com recursos direcionados (SGS)",
            "url": "https://api.bcb.gov.br/dados/serie/bcdata.sgs.20593/dados?formato=json",
            "catalogo": "https://dadosabertos.bcb.gov.br/dataset/20593-saldo-da-carteira-de-credito-com-recursos-direcionados---total",
            "licenca": "dados abertos do BCB", "nivel": "A — estatística oficial, mensal desde 2011"},
    "bndes": {"nome": "BNDES — Dados abertos (estatísticas de desembolsos, aprovações e consultas; operações não automáticas)",
              "url": "https://dadosabertos.bndes.gov.br/", "catalogo": "https://dadosabertos.bndes.gov.br/dataset/desembolsos",
              "licenca": "ODbL", "nivel": "A — registro administrativo do próprio banco"},
}
UF_COL = {"acre": "AC", "amapa": "AP", "amazonas": "AM", "para": "PA", "rondonia": "RO", "roraima": "RR", "tocantins": "TO",
          "alagoas": "AL", "bahia": "BA", "ceara": "CE", "maranhao": "MA", "paraiba": "PB", "pernambuco": "PE", "piaui": "PI",
          "rio_grande_do_norte": "RN", "sergipe": "SE", "espirito_santo": "ES", "minas_gerais": "MG", "rio_de_janeiro": "RJ",
          "sao_paulo": "SP", "parana": "PR", "rio_grande_do_sul": "RS", "santa_catarina": "SC", "distrito_federal": "DF",
          "goias": "GO", "mato_grosso": "MT", "mato_grosso_do_sul": "MS"}
REGIOES = {"AC": "Norte", "AP": "Norte", "AM": "Norte", "PA": "Norte", "RO": "Norte", "RR": "Norte", "TO": "Norte",
           "AL": "Nordeste", "BA": "Nordeste", "CE": "Nordeste", "MA": "Nordeste", "PB": "Nordeste", "PE": "Nordeste", "PI": "Nordeste", "RN": "Nordeste", "SE": "Nordeste",
           "ES": "Sudeste", "MG": "Sudeste", "RJ": "Sudeste", "SP": "Sudeste", "PR": "Sul", "RS": "Sul", "SC": "Sul",
           "DF": "Centro-Oeste", "GO": "Centro-Oeste", "MT": "Centro-Oeste", "MS": "Centro-Oeste"}
PORTES = [("micro", "Micro"), ("pequena", "Pequena"), ("media", "Média"), ("grande", "Grande")]
PORTE_COR = {"micro": "#2f7d4f", "pequena": "#0e7c7b", "media": "#1d4e89", "grande": "#6b46a3", "pessoa_fisica": "#b45309"}
SETOR_BNDES = [("agropecuaria", "Agropecuária"), ("industria", "Indústria"), ("infraestrutura", "Infraestrutura"), ("comercio_e_servicos", "Comércio e serviços")]
PRODUTOS_DIRETOS = {"bndes_finem": "Finem (direto)", "bndes_exim": "Exim (direto)", "bndes_mercado_de_capitais": "Mercado de capitais", "bndes_nao_reembolsavel": "Não reembolsável",
                    "bndes_microcredito": "Microcrédito", "bndes_prestacao_de_garantia": "Prestação de garantia", "bndes_finame": "Finame (direto)"}
PRODUTOS_INDIRETOS = {"bndes_maquinas_e_servicos": "Máquinas e serviços (indireto)", "bndes_finem": "Finem (indireto)", "bndes_exim": "Exim (indireto)", "bndes_nao_reembolsavel": "Não reembolsável (indireto)"}
FINAME = {"transporte": "Transporte", "demais_bens_de_capital": "Demais bens de capital", "agricola": "Agrícola"}
FONTES_RECURSOS = {"patrimonio_liquido": "Patrimônio líquido", "tesouro_nacional": "Tesouro Nacional", "fat": "FAT", "captacoes_internas": "Captações internas",
                   "fundos": "Fundos", "operacoes_compromissadas": "Operações compromissadas", "captacoes_externas": "Captações externas", "outros_passivos": "Outros passivos"}


def _r(v, d=2):
    return None if v is None else round(v, d)


def _share(v, tot):
    return _r(v / tot * 100) if tot else None


def _hhi(vals):
    tot = sum(vals)
    return round(sum((v / tot * 100) ** 2 for v in vals)) if tot else None


def _mes_menos(mes, n):
    y, m = int(mes[:4]), int(mes[5:7])
    m -= n
    while m <= 0:
        y, m = y - 1, m + 12
    return f"{y}-{m:02d}"


def _tab(con, tabela):
    """{mes: {chave: valor}} de uma tabela mensal."""
    out = {}
    for m, k, v in con.execute("SELECT mes, chave, valor FROM bndes_mensal WHERE tabela=? ORDER BY mes", (tabela,)):
        out.setdefault(m, {})[k] = v
    return out


def _soma_janela(tab, ini, fim):
    acc = {}
    for m, d in tab.items():
        if ini <= m <= fim:
            for k, v in d.items():
                acc[k] = acc.get(k, 0.0) + v
    return acc


# ---------------------------------------------------------------- saldo direcionado (SGS)
def _sgs(con, key):
    return [(d[:7], v) for d, v in common.get_series(con, key)]


def _saldo(con):
    tot = dict(_sgs(con, "dir_saldo_total"))
    if not tot:
        return {"disponivel": False}
    S = {k: dict(_sgs(con, k)) for k in ("dir_saldo_pj", "dir_saldo_pf", "dir_saldo_pj_bndes", "dir_saldo_pf_bndes", "saldo_total", "saldo_pj", "saldo_pf",
                                          "dir_conc_total", "dir_conc_pj", "dir_conc_pf", "dir_conc_pj_bndes", "dir_taxa_total", "dir_taxa_pj", "dir_taxa_pf", "dir_taxa_pj_bndes",
                                          "dir_inad_total", "dir_inad_pj", "dir_inad_pf", "dir_inad_pj_bndes", "dir_prazo_pj", "dir_prazo_pj_bndes", "taxa_pj", "inad_pj")}
    meses = sorted(tot)
    ult = meses[-1]
    ant = _mes_menos(ult, 12)
    g = lambda k, m=ult: S[k].get(m)
    serie = []
    for m in meses:
        t = tot[m]
        serie.append({"mes": m, "direcionado": t, "livre_total": (S["saldo_total"].get(m) - t) if S["saldo_total"].get(m) else None,
                      "share_direcionado": _share(t, S["saldo_total"].get(m)), "share_pj_direcionado": _share(S["dir_saldo_pj"].get(m), S["saldo_pj"].get(m)),
                      "share_pf_direcionado": _share(S["dir_saldo_pf"].get(m), S["saldo_pf"].get(m)),
                      "bndes_pj": S["dir_saldo_pj_bndes"].get(m), "bndes_share_pj_dir": _share(S["dir_saldo_pj_bndes"].get(m), S["dir_saldo_pj"].get(m)),
                      "bndes_share_pj_total": _share(S["dir_saldo_pj_bndes"].get(m), S["saldo_pj"].get(m)),
                      "taxa_dir_pj": S["dir_taxa_pj"].get(m), "taxa_livre_pj": None, "taxa_pj": S["taxa_pj"].get(m), "taxa_bndes_pj": S["dir_taxa_pj_bndes"].get(m),
                      "inad_dir_pj": S["dir_inad_pj"].get(m), "inad_pj": S["inad_pj"].get(m), "inad_bndes_pj": S["dir_inad_pj_bndes"].get(m)})
    kpis = {"mes": ult, "saldo_direcionado": tot[ult], "share_direcionado": _share(tot[ult], g("saldo_total")),
            "var_12m_pct": _r((tot[ult] / tot[ant] - 1) * 100, 1) if tot.get(ant) else None,
            "pj": {"saldo": g("dir_saldo_pj"), "share_no_pj": _share(g("dir_saldo_pj"), g("saldo_pj")), "bndes": g("dir_saldo_pj_bndes"),
                   "bndes_share_direcionado": _share(g("dir_saldo_pj_bndes"), g("dir_saldo_pj")), "bndes_share_total_pj": _share(g("dir_saldo_pj_bndes"), g("saldo_pj")),
                   "bndes_var_12m_pct": _r((g("dir_saldo_pj_bndes") / S["dir_saldo_pj_bndes"].get(ant) - 1) * 100, 1) if g("dir_saldo_pj_bndes") and S["dir_saldo_pj_bndes"].get(ant) else None,
                   "taxa_direcionado": g("dir_taxa_pj"), "taxa_bndes": g("dir_taxa_pj_bndes"), "taxa_total_pj": g("taxa_pj"),
                   "inad_direcionado": g("dir_inad_pj"), "inad_bndes": g("dir_inad_pj_bndes"), "inad_total_pj": g("inad_pj"),
                   "prazo_direcionado": g("dir_prazo_pj"), "prazo_bndes": g("dir_prazo_pj_bndes"), "concessoes_12m_bndes": sum(v for m, v in S["dir_conc_pj_bndes"].items() if _mes_menos(ult, 11) <= m <= ult) or None},
            "pf": {"saldo": g("dir_saldo_pf"), "share_no_pf": _share(g("dir_saldo_pf"), g("saldo_pf")), "bndes": g("dir_saldo_pf_bndes"),
                   "taxa_direcionado": g("dir_taxa_pf"), "inad_direcionado": g("dir_inad_pf")}}
    return {"disponivel": True, "mes": ult, "unidade": "R$ milhões (saldo de fim de mês, nominal)", "kpis": kpis, "serie": serie,
            "nota": ("Recursos direcionados: operações com taxa regulada ou funding público (BNDES, rural, imobiliário, microcrédito). "
                     "O saldo com recursos do BNDES é o que está nos balanços das instituições financeiras como repasse ou operação direta do banco.")}


# ---------------------------------------------------------------- desembolsos (BNDES)
def _desembolsos(con):
    porte = _tab(con, "des_porte")
    if not porte:
        return {"disponivel": False}
    meses = sorted(porte)
    fim = meses[-1]
    ini = _mes_menos(fim, 11)
    ini_ant, fim_ant = _mes_menos(ini, 12), _mes_menos(fim, 12)
    pfpj = _tab(con, "des_porte_pfpj")
    uf = _tab(con, "des_uf")
    mpme_uf = _tab(con, "des_mpme_uf")
    setor = _tab(con, "des_setor_bndes")
    cnae = _tab(con, "des_setor_cnae")
    sub = _tab(con, "des_subsetor_cnae")
    diretas = _tab(con, "des_diretas")
    indiretas = _tab(con, "des_indiretas")
    apr = _tab(con, "apr_porte")
    cons = _tab(con, "con_porte")
    finame = _tab(con, "finame_mensal")
    total = lambda d: sum(d.values())
    # série mensal com soma móvel de 12 meses por porte
    serie = []
    for i, m in enumerate(meses):
        p = {"mes": m, "total": total(porte[m]), **{k: porte[m].get(k) for k, _n in PORTES}}
        if i >= 11:
            jan = meses[i - 11:i + 1]
            p["total_12m"] = sum(total(porte[x]) for x in jan)
            p["mpme_12m_share"] = _share(sum(porte[x].get(k, 0) for x in jan for k in ("micro", "pequena", "media")), p["total_12m"])
            p["aprovacoes_12m"] = sum(total(apr.get(x, {})) for x in jan) if apr else None
            p["consultas_12m"] = sum(total(cons.get(x, {})) for x in jan) if cons else None
        serie.append(p)
    j = _soma_janela(porte, ini, fim)
    j_ant = _soma_janela(porte, ini_ant, fim_ant)
    tot12, tot12_ant = total(j), total(j_ant)
    j_pfpj = _soma_janela(pfpj, ini, fim)
    por_porte = [{"id": k, "nome": n, "cor": PORTE_COR[k], "valor": j.get(k, 0), "share": _share(j.get(k, 0), tot12),
                  "var_12m_pct": _r((j.get(k, 0) / j_ant[k] - 1) * 100, 1) if j_ant.get(k) else None} for k, n in PORTES]
    pf_share = _share(j_pfpj.get("pessoa_fisica", 0), total(j_pfpj)) if j_pfpj else None
    # anual
    anual = {}
    for m in meses:
        a = anual.setdefault(m[:4], {"ano": m[:4], "total": 0.0, "meses": 0, **{k: 0.0 for k, _n in PORTES}, "aprovacoes": 0.0, "consultas": 0.0, "infraestrutura": 0.0})
        a["total"] += total(porte[m]); a["meses"] += 1
        for k, _n in PORTES:
            a[k] += porte[m].get(k, 0)
        a["aprovacoes"] += total(apr.get(m, {})); a["consultas"] += total(cons.get(m, {}))
        a["infraestrutura"] += setor.get(m, {}).get("infraestrutura", 0)
    anual = [dict(a, incompleto=a["meses"] < 12, mpme_share=_share(a["micro"] + a["pequena"] + a["media"], a["total"])) for a in anual.values()]
    # funil 12m (consultas → aprovações → desembolsos) por porte
    ja, jc = _soma_janela(apr, ini, fim), _soma_janela(cons, ini, fim)
    funil = [{"porte": n, "consultas": jc.get(k), "aprovacoes": ja.get(k), "desembolsos": j.get(k),
              "aprov_sobre_consulta": _share(ja.get(k, 0), jc.get(k)), "desemb_sobre_aprov": _share(j.get(k, 0), ja.get(k))} for k, n in PORTES]
    funil.append({"porte": "Total", "consultas": total(jc), "aprovacoes": total(ja), "desembolsos": tot12,
                  "aprov_sobre_consulta": _share(total(ja), total(jc)), "desemb_sobre_aprov": _share(tot12, total(ja))})
    # setor e subsetor
    js = _soma_janela(setor, ini, fim); js_ant = _soma_janela(setor, ini_ant, fim_ant)
    por_setor = [{"id": k, "nome": n, "valor": js.get(k, 0), "share": _share(js.get(k, 0), total(js)),
                  "var_12m_pct": _r((js.get(k, 0) / js_ant[k] - 1) * 100, 1) if js_ant.get(k) else None} for k, n in SETOR_BNDES]
    setor_anual = []
    for a in sorted({m[:4] for m in meses}):
        sa = _soma_janela(setor, f"{a}-01", f"{a}-12")
        setor_anual.append({"ano": a, "total": total(sa), **{k: _share(sa.get(k, 0), total(sa)) for k, _n in SETOR_BNDES}})
    jsub = _soma_janela(sub, ini, fim); jsub_ant = _soma_janela(sub, ini_ant, fim_ant)
    subsetores = sorted([{"id": k, "nome": k.replace("_", " "), "valor": v, "share": _share(v, total(jsub)),
                          "var_12m_pct": _r((v / jsub_ant[k] - 1) * 100, 1) if jsub_ant.get(k) else None} for k, v in jsub.items() if v > 0], key=lambda x: -x["valor"])
    jc_cnae = _soma_janela(cnae, ini, fim)
    # produtos (as tabelas de forma de apoio cobrem só parte do desembolso: a aba declara a cobertura)
    jd, ji = _soma_janela(diretas, ini, fim), _soma_janela(indiretas, ini, fim)
    produtos = sorted([{"nome": PRODUTOS_DIRETOS.get(k, k), "forma": "direta", "valor": v} for k, v in jd.items() if v > 0] +
                      [{"nome": PRODUTOS_INDIRETOS.get(k, k), "forma": "indireta", "valor": v} for k, v in ji.items() if v > 0], key=lambda x: -x["valor"])
    cob_prod = total(jd) + total(ji)
    for p in produtos:
        p["share"] = _share(p["valor"], cob_prod)
    # UF
    juf = _soma_janela(uf, ini, fim); juf_ant = _soma_janela(uf, ini_ant, fim_ant); jm = _soma_janela(mpme_uf, ini, fim)
    tot_uf = total(juf)
    pop_uf = _pop_uf()
    ufs = sorted([{"uf": UF_COL[k], "regiao": REGIOES[UF_COL[k]], "valor": v, "share": _share(v, tot_uf), "mpme_share": _share(jm.get(k, 0), v),
                   "var_12m_pct": _r((v / juf_ant[k] - 1) * 100, 1) if juf_ant.get(k) else None,
                   "pop": pop_uf.get(UF_COL[k]), "valor_hab": _r(v * 1e6 / pop_uf[UF_COL[k]]) if pop_uf.get(UF_COL[k]) else None}
                  for k, v in juf.items() if k in UF_COL], key=lambda x: -x["valor"])
    regioes = {}
    for u in ufs:
        r = regioes.setdefault(u["regiao"], {"regiao": u["regiao"], "valor": 0.0, "pop": 0})
        r["valor"] += u["valor"]; r["pop"] += u["pop"] or 0
    regioes = sorted([dict(r, share=_share(r["valor"], tot_uf), valor_hab=_r(r["valor"] * 1e6 / r["pop"]) if r["pop"] else None) for r in regioes.values()], key=lambda x: -x["valor"])
    # FINAME
    fin = sorted(finame)
    finame_serie = [{"mes": m, **{FINAME[k]: v for k, v in finame[m].items() if k in FINAME}, "total": sum(v for k, v in finame[m].items() if k in FINAME)} for m in fin]
    # agentes (anual)
    ano_if = con.execute("SELECT MAX(ano) FROM bndes_anual WHERE tabela='des_if'").fetchone()[0]
    ano_if_cheio = str(int(fim[:4]) - 1) if fim[5:7] != "12" else fim[:4]
    ifs = con.execute("SELECT chave, grupo, valor FROM bndes_anual WHERE tabela='des_if' AND ano=? AND valor>0 ORDER BY valor DESC", (ano_if_cheio,)).fetchall()
    tot_if = sum(v for _c, _g, v in ifs)
    sem_agente = next((v for c, _g, v in ifs if c.upper().startswith("SEM AGENTE")), 0)
    agentes = [{"nome": c, "tipo": g, "valor": v, "share": _share(v, tot_if)} for c, g, v in ifs if not c.upper().startswith("SEM AGENTE")][:15]
    publico = sum(v for c, g, v in ifs if g == "Agente Público")
    n_agentes = len([1 for c, _g, v in ifs if not c.upper().startswith("SEM AGENTE")])
    hhi_agentes = _hhi([v for c, _g, v in ifs if not c.upper().startswith("SEM AGENTE")])
    qtd = {a: {} for a in set()}
    for a, k, v in con.execute("SELECT ano, chave, valor FROM bndes_anual WHERE tabela='des_qtd_porte' ORDER BY ano"):
        qtd.setdefault(a, {})[k] = v
    qtd_anual = [{"ano": a, **{k: d.get(k) for k, _n in PORTES}, "total": sum(d.values())} for a, d in sorted(qtd.items())][-12:]
    return {
        "disponivel": True, "mes": fim, "janela": {"ini": ini, "fim": fim}, "janela_anterior": {"ini": ini_ant, "fim": fim_ant},
        "unidade": "R$ milhões, nominal (desembolsos do Sistema BNDES: direto e indireto, automático e não automático)",
        "kpis": {"desembolsos_12m": tot12, "var_12m_pct": _r((tot12 / tot12_ant - 1) * 100, 1) if tot12_ant else None,
                 "mpme_share": _share(j.get("micro", 0) + j.get("pequena", 0) + j.get("media", 0), tot12), "pf_share": pf_share,
                 "infraestrutura_share": next((s["share"] for s in por_setor if s["id"] == "infraestrutura"), None),
                 "agropecuaria_share": next((s["share"] for s in por_setor if s["id"] == "agropecuaria"), None),
                 "aprov_sobre_consulta": funil[-1]["aprov_sobre_consulta"], "desemb_sobre_aprov": funil[-1]["desemb_sobre_aprov"],
                 "via_agentes_share": _share(tot_if - sem_agente, tot_if), "agentes_publicos_share": _share(publico, tot_if - sem_agente), "hhi_agentes": hhi_agentes, "n_agentes": n_agentes,
                 "ano_agentes": ano_if_cheio, "cobertura_produtos_pct": _share(cob_prod, tot12)},
        "serie_mensal": serie[-240:], "anual": anual, "por_porte": por_porte, "funil": funil,
        "por_setor": por_setor, "setor_anual": setor_anual[-15:], "subsetores": subsetores[:20], "n_subsetores": len(subsetores),
        "setor_cnae": [{"nome": k.replace("_", " "), "valor": v, "share": _share(v, total(jc_cnae))} for k, v in sorted(jc_cnae.items(), key=lambda x: -x[1])],
        "produtos": produtos, "cobertura_produtos": {"valor": cob_prod, "pct": _share(cob_prod, tot12)},
        "ufs": ufs, "regioes": regioes, "finame": {"serie": finame_serie[-120:], "mes": fin[-1] if fin else None, "categorias": list(FINAME.values())},
        "agentes": {"ano": ano_if_cheio, "ano_mais_recente_publicado": ano_if, "total": tot_if, "direto_sem_agente": sem_agente, "top": agentes, "n": n_agentes,
                    "publicos_share": _share(publico, tot_if - sem_agente), "hhi": hhi_agentes, "top5_share": _share(sum(a["valor"] for a in agentes[:5]), tot_if - sem_agente)},
        "qtd_operacoes_anual": qtd_anual,
        "nota": ("Desembolsos do Sistema BNDES por mês de liberação, em R$ milhões nominais; o BNDES publica as estatísticas com defasagem de alguns meses e o painel mostra o último mês publicado. "
                 "As tabelas por produto e forma de apoio cobrem só parte do desembolso (as indiretas automáticas não estão nelas); a cobertura é declarada."),
    }


def _pop_uf():
    pen = common.ler_gold_opcional("penetracao.json") or {}
    lista = pen.get("municipios") or (common.ler_gold_opcional("penetracao_mun.json") or {}).get("municipios") or []
    pop = {}
    for m in lista:
        if m.get("uf") and m.get("pop_total"):
            pop[m["uf"]] = pop.get(m["uf"], 0) + m["pop_total"]
    return pop


# ---------------------------------------------------------------- operações não automáticas
def _operacoes(con):
    n = con.execute("SELECT COUNT(*) FROM bndes_op").fetchone()[0]
    if not n:
        return {"disponivel": False}
    ult = con.execute("SELECT MAX(data) FROM bndes_op").fetchone()[0][:7]
    # a base traz o mês corrente da publicação: a janela fecha no mês anterior ao último
    fim = _mes_menos(ult, 1) if True else ult
    ini = _mes_menos(fim, 11)
    ini_ant, fim_ant = _mes_menos(ini, 12), _mes_menos(fim, 12)
    W = "FROM bndes_op WHERE SUBSTR(data,1,7) BETWEEN ? AND ?"
    a = (ini, fim)
    tot = con.execute("SELECT COUNT(*), SUM(contratado), SUM(desembolsado), COUNT(DISTINCT cnpj) " + W, a).fetchone()
    tot_ant = con.execute("SELECT SUM(contratado) " + W, (ini_ant, fim_ant)).fetchone()[0]
    def grupo(col, limite=12, alias=None):
        rows = con.execute(f"SELECT {col}, COUNT(*), SUM(contratado) {W} GROUP BY {col} ORDER BY 3 DESC", a).fetchall()
        return [{"nome": (c or "não informado").strip(), "n": k, "valor": v, "share": _share(v, tot[1])} for c, k, v in rows[:limite]]
    anual = []
    for ano, k, v, d, npub in con.execute("SELECT SUBSTR(data,1,4), COUNT(*), SUM(contratado), SUM(desembolsado), SUM(natureza NOT LIKE 'PRIVADA%') FROM bndes_op GROUP BY 1 ORDER BY 1"):
        anual.append({"ano": ano, "n": k, "contratado": v, "desembolsado": d, "n_publico": npub})
    custo_anual = {}
    for ano, c, v in con.execute("SELECT SUBSTR(data,1,4), custo, SUM(contratado) FROM bndes_op WHERE modalidade='REEMBOLSÁVEL' AND data >= '2015' GROUP BY 1, 2"):
        custo_anual.setdefault(ano, {})[c or "não informado"] = v
    custos = ["TJLP", "TLP", "SELIC", "TAXA FIXA", "US$ / CESTA", "IPCA", "TAXA REFERENCIAL (TR)"]
    custo_serie = [{"ano": ano, "total": sum(d.values()), **{c: _share(d.get(c, 0), sum(d.values())) for c in custos},
                    "outros": _share(sum(v for k, v in d.items() if k not in custos), sum(d.values()))} for ano, d in sorted(custo_anual.items())]
    juros = con.execute("SELECT SUM(juros*contratado)/SUM(contratado), SUM(amortizacao*contratado)/SUM(contratado), SUM(carencia*contratado)/SUM(contratado) " + W + " AND modalidade='REEMBOLSÁVEL' AND juros IS NOT NULL", a).fetchone()
    top = [{"cliente": c, "cnpj": j, "uf": u, "n": k, "valor": v, "share": _share(v, tot[1]), "setor": s, "natureza": nz}
           for c, j, u, k, v, s, nz in con.execute("SELECT cliente, cnpj, MAX(uf), COUNT(*), SUM(contratado), MAX(subsetor_bndes), MAX(natureza) " + W + " GROUP BY cnpj ORDER BY 5 DESC LIMIT 15", a)]
    hhi_clientes = _hhi([v for (v,) in con.execute("SELECT SUM(contratado) " + W + " GROUP BY cnpj", a)])
    mun = [{"cod": cod, "nome": nm, "uf": u, "n": k, "valor": v, "share": _share(v, tot[1])}
           for cod, nm, u, k, v in con.execute("SELECT cod_mun, MAX(municipio), MAX(uf), COUNT(*), SUM(contratado) " + W + " AND cod_mun IS NOT NULL GROUP BY cod_mun ORDER BY 5 DESC LIMIT 20", a)]
    sem_mun = con.execute("SELECT SUM(contratado) " + W + " AND cod_mun IS NULL", a).fetchone()[0] or 0
    return {
        "disponivel": True, "janela": {"ini": ini, "fim": fim}, "ultimo_mes": ult, "n_total": n,
        "kpis": {"n_12m": tot[0], "contratado_12m": tot[1], "desembolsado_12m": tot[2], "clientes_12m": tot[3],
                 "var_12m_pct": _r((tot[1] / tot_ant - 1) * 100, 1) if tot_ant else None, "juros_medio": _r(juros[0]), "amortizacao_media_meses": _r(juros[1], 0),
                 "carencia_media_meses": _r(juros[2], 0), "hhi_clientes": hhi_clientes, "sem_municipio_share": _share(sem_mun, tot[1])},
        "por_produto": grupo("produto"), "por_natureza": grupo("natureza", 6), "por_porte": grupo("porte", 5), "por_setor_bndes": grupo("subsetor_bndes", 12),
        "por_custo": grupo("custo", 8), "por_garantia": grupo("garantia", 8), "por_forma": grupo("forma", 3), "por_modalidade": grupo("modalidade", 3),
        "por_uf": grupo("uf", 28), "top_clientes": top, "top_municipios": mun, "anual": anual[-12:], "custo_anual": custo_serie,
        "nota": ("Contratações diretas e indiretas NÃO automáticas, pela data da contratação; as operações indiretas automáticas (Finame, BNDES Automático, cartão), "
                 "que respondem pela maior parte do número de operações, não estão nesta base. 'IE' e 'SEM MUNICÍPIO' marcam operações sem localização única (multi-UF, exportação). "
                 "Valor contratado não é desembolso: a liberação segue o cronograma do projeto."),
    }


# ---------------------------------------------------------------- funding
def _fontes(con):
    rows = con.execute("SELECT data, chave, valor FROM bndes_fontes ORDER BY data").fetchall()
    if not rows:
        return {"disponivel": False}
    por = {}
    for d, k, v in rows:
        por.setdefault(d, {})[k] = v
    out = []
    for d, x in sorted(por.items()):
        tot = x.get("passivo_total") or sum(v for k, v in x.items() if k in FONTES_RECURSOS)
        out.append({"data": d, "passivo_total": tot, "itens": [{"id": k, "nome": n, "valor": x.get(k), "share": _share(x.get(k), tot)} for k, n in FONTES_RECURSOS.items() if x.get(k) is not None]})
    n_ifs = con.execute("SELECT COUNT(*) FROM bndes_ifs").fetchone()[0]
    return {"disponivel": True, "anos": out, "ultimo": out[-1]["data"], "instituicoes_credenciadas": n_ifs,
            "nota": "composição do passivo do BNDES em 31 de dezembro (R$ milhões), conforme os dados abertos do banco; FAT e Tesouro são as fontes históricas, captações de mercado crescem desde 2023."}


# ---------------------------------------------------------------- build
def build(con, cfg=None):
    saldo = _saldo(con)
    des = _desembolsos(con)
    ops = _operacoes(con)
    fontes = _fontes(con)
    if not des.get("disponivel") and not saldo.get("disponivel"):
        return {"disponivel": False, "motivo": "silver sem estatísticas do BNDES nem séries de crédito direcionado — coleta ainda não rodou"}
    bi = lambda v: f"R$ {v / 1e3:.0f} bi" if v else "–"      # R$ milhões → bi
    biR = lambda v: f"R$ {v / 1e9:.1f} bi" if v else "–"     # R$ → bi
    frases = []
    pc = lambda v, d=0: f"{v:.{d}f}%" if v is not None else "n.d."
    if saldo.get("disponivel"):
        k = saldo["kpis"]
        frases.append(f"Em {k['mes']}, o crédito com recursos direcionados somava {bi(k['saldo_direcionado'])}, {pc(k['share_direcionado'])} da carteira do SFN; "
                      f"nas empresas, {pc(k['pj']['share_no_pj'])} do saldo é direcionado e os repasses do BNDES respondem por {pc(k['pj']['bndes_share_total_pj'])} de todo o crédito PJ.")
    if des.get("disponivel"):
        k = des["kpis"]
        frases.append(f"O Sistema BNDES desembolsou {bi(k['desembolsos_12m'])} entre {des['janela']['ini']} e {des['janela']['fim']}"
                      + (f" ({k['var_12m_pct']:+.0f}% sobre os 12 meses anteriores)" if k.get("var_12m_pct") is not None else "")
                      + f", {k['mpme_share']:.0f}% para micro, pequenas e médias empresas e {k['infraestrutura_share']:.0f}% para infraestrutura; "
                      f"{k['via_agentes_share']:.0f}% passou por agentes financeiros em {k['ano_agentes']}.")
    if ops.get("disponivel"):
        k = ops["kpis"]
        frases.append(f"Nas operações não automáticas, {k['n_12m']} contratos somaram {biR(k['contratado_12m'])} entre {ops['janela']['ini']} e {ops['janela']['fim']}, "
                      f"com juros médio ponderado de {k['juros_medio']:.1f}% a.a. sobre o custo financeiro e amortização média de {k['amortizacao_media_meses']:.0f} meses.")
    return {
        "disponivel": True, "gerado_em": common.now_utc(), "fontes": FONTES, "sintese": " ".join(frases),
        "saldo": saldo, "desembolsos": des, "operacoes": ops, "funding": fontes,
        "catalogo": [
            {"id": "saldo_direcionado", "nome": "Saldo com recursos direcionados", "definicao": "carteira de crédito do SFN com taxa regulada ou funding público, fim do mês", "unidade": "R$ milhões", "fonte": "BCB/SGS 20593 e família", "limitacoes": "estoque nominal; inclui rural, imobiliário e microcrédito, não só BNDES"},
            {"id": "bndes_share_pj", "nome": "Repasses do BNDES no crédito PJ", "definicao": "saldo PJ com recursos do BNDES ÷ saldo PJ total do SFN", "unidade": "%", "fonte": "calculado", "limitacoes": "só o que está no balanço das IFs; debêntures compradas pelo BNDES não entram"},
            {"id": "desembolsos_12m", "nome": "Desembolsos do Sistema BNDES", "definicao": "soma dos desembolsos mensais em 12 meses", "unidade": "R$ milhões", "fonte": "BNDES dados abertos", "limitacoes": "nominal; publicado com defasagem; inclui não reembolsável e mercado de capitais"},
            {"id": "mpme_share", "nome": "Parte para MPME", "definicao": "desembolsos a micro, pequenas e médias ÷ total", "unidade": "%", "fonte": "calculado", "limitacoes": "porte pelo faturamento declarado ao BNDES; pessoa física entra em 'micro' na tabela por porte"},
            {"id": "funil", "nome": "Funil consulta → aprovação → desembolso", "definicao": "razões entre as somas de 12 meses de cada etapa", "unidade": "%", "fonte": "calculado", "limitacoes": "etapas de safras diferentes: uma consulta de hoje desembolsa em anos; a razão é de fluxo, não de conversão"},
            {"id": "hhi_agentes", "nome": "Concentração dos agentes", "definicao": "HHI dos desembolsos indiretos por agente financeiro no ano", "unidade": "pontos", "fonte": "calculado", "limitacoes": "só o ano fechado mais recente; operações diretas ('sem agente') fora"},
            {"id": "juros_medio", "nome": "Juros médio das não automáticas", "definicao": "média dos juros ponderada pelo valor contratado, sobre o custo financeiro", "unidade": "% a.a.", "fonte": "calculado", "limitacoes": "juros acima do indexador (TLP, Selic, cesta); não é custo efetivo total"},
        ],
        "cautelas": [
            "Saldo direcionado (SGS), desembolsos (BNDES) e contratações não automáticas (BNDES) são três réguas: estoque no SFN, fluxo liberado e fluxo contratado. Nunca se somam nem se dividem entre si.",
            "O BNDES publica as estatísticas mensais com defasagem de meses; a data-base aparece no cabeçalho e a janela de 12 meses fecha no último mês publicado.",
            "As tabelas por produto e forma de apoio não cobrem as operações indiretas automáticas; o painel declara a cobertura e não escala o resto.",
            "As operações não automáticas são uma fração dos desembolsos (as automáticas, via agentes, ficam fora); o recorte municipal é só delas e não representa o BNDES inteiro.",
            "Valores nominais em todas as séries; a comparação de 1995 com 2026 sem deflacionar mede a inflação, não o banco.",
            "Aprovação sobre consulta e desembolso sobre aprovação são razões entre fluxos de 12 meses de etapas com prazos distintos, não taxas de conversão de uma mesma safra.",
        ],
        "metodo": ("Séries do SGS pela API pública; estatísticas do BNDES a partir dos CSV do catálogo CKAN, guardadas em formato longo; operações não automáticas linha a linha; "
                   "agregação em Python (stdlib), janelas de 12 meses fechadas no último mês publicado, sem estimativa, sem deflação, sem imputação."),
    }
