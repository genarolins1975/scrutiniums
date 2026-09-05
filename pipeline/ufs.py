"""Páginas por UF — gold ufs.json.

Uma página por unidade da federação, montada a partir dos golds que já carregam
recorte estadual: Panorama (SCR.data), Penetração (SCR + Censo), Presença bancária
(Unicad e correspondentes), Pix, Moradia, Consignado, Crédito rural (MDCR), BNDES e
Dívida ativa (PGFN). Nada é coletado de novo: o builder roda depois dos demais e lê
os golds do disco; onde um gold falta, o bloco fica nulo e a página diz isso.

Regras: cada bloco carrega a própria data-base e a própria fonte; posições em ranking
são calculadas aqui, entre as 27 UFs, e nunca somam réguas distintas; per capita usa a
população do Censo 2022 já embutida nos golds de origem.
"""
from pipeline import common

REGIOES = {"AC": "Norte", "AP": "Norte", "AM": "Norte", "PA": "Norte", "RO": "Norte", "RR": "Norte", "TO": "Norte",
           "AL": "Nordeste", "BA": "Nordeste", "CE": "Nordeste", "MA": "Nordeste", "PB": "Nordeste", "PE": "Nordeste", "PI": "Nordeste", "RN": "Nordeste", "SE": "Nordeste",
           "ES": "Sudeste", "MG": "Sudeste", "RJ": "Sudeste", "SP": "Sudeste", "PR": "Sul", "RS": "Sul", "SC": "Sul",
           "DF": "Centro-Oeste", "GO": "Centro-Oeste", "MT": "Centro-Oeste", "MS": "Centro-Oeste"}
NOMES = {"AC": "Acre", "AL": "Alagoas", "AP": "Amapá", "AM": "Amazonas", "BA": "Bahia", "CE": "Ceará", "DF": "Distrito Federal", "ES": "Espírito Santo",
         "GO": "Goiás", "MA": "Maranhão", "MT": "Mato Grosso", "MS": "Mato Grosso do Sul", "MG": "Minas Gerais", "PA": "Pará", "PB": "Paraíba", "PR": "Paraná",
         "PE": "Pernambuco", "PI": "Piauí", "RJ": "Rio de Janeiro", "RN": "Rio Grande do Norte", "RS": "Rio Grande do Sul", "RO": "Rondônia", "RR": "Roraima",
         "SC": "Santa Catarina", "SP": "São Paulo", "SE": "Sergipe", "TO": "Tocantins"}
PREP = {"AC": "no Acre", "AL": "em Alagoas", "AP": "no Amapá", "AM": "no Amazonas", "BA": "na Bahia", "CE": "no Ceará", "DF": "no Distrito Federal", "ES": "no Espírito Santo",
        "GO": "em Goiás", "MA": "no Maranhão", "MT": "em Mato Grosso", "MS": "em Mato Grosso do Sul", "MG": "em Minas Gerais", "PA": "no Pará", "PB": "na Paraíba", "PR": "no Paraná",
        "PE": "em Pernambuco", "PI": "no Piauí", "RJ": "no Rio de Janeiro", "RN": "no Rio Grande do Norte", "RS": "no Rio Grande do Sul", "RO": "em Rondônia", "RR": "em Roraima",
        "SC": "em Santa Catarina", "SP": "em São Paulo", "SE": "em Sergipe", "TO": "no Tocantins"}


def _mil(v):
    """Inteiro com ponto de milhar (padrão brasileiro) para a síntese."""
    return f"{v:,.0f}".replace(",", ".")


def _dec(v, d=1):
    """Decimal com vírgula (padrão brasileiro) para a síntese."""
    return f"{v:.{d}f}".replace(".", ",")


def _r(v, d=2):
    return None if v is None else round(v, d)


def _share(v, tot):
    return _r(v / tot * 100) if tot and v is not None else None


def _rank(ufs, chave, bloco, maior=True):
    """Posição 1..27 pelo campo; nulos ficam sem posição."""
    vals = [(u["uf"], (u.get(bloco) or {}).get(chave)) for u in ufs]
    ordem = sorted([x for x in vals if x[1] is not None], key=lambda x: -x[1] if maior else x[1])
    pos = {uf: i + 1 for i, (uf, _v) in enumerate(ordem)}
    for u in ufs:
        u.setdefault("posicoes", {})[f"{bloco}.{chave}"] = pos.get(u["uf"])


def build(con=None, cfg=None):
    g = lambda n: common.ler_gold_opcional(n) or {}
    pan, pen_mun, pres, pix, mor, con_g, rur, bnd, pgf, expl, emp = (g("panorama.json"), g("penetracao_mun.json"), g("presenca_mun.json"), g("pix.json"),
                                                                    g("moradia.json"), g("consignado.json"), g("rural.json"), g("bndes.json"), g("pgfn.json"), g("explorer.json"), g("emprego.json"))
    if not pan.get("mapa"):
        return {"disponivel": False, "motivo": "panorama.json sem recorte por UF — o Panorama do Crédito precisa existir antes das páginas por UF"}
    por_uf = {}
    idx = lambda lista, k="uf": {x[k]: x for x in (lista or []) if x.get(k)}
    pan_uf = idx(pan.get("mapa"))
    pres_uf = idx(pres.get("por_uf"))
    pix_uf = idx((pix.get("geografia") or {}).get("ufs"))
    mor_uf = idx(mor.get("estados"))
    con_uf = idx(con_g.get("estados"))
    rur_uf = idx(rur.get("ufs"))
    bnd_uf = idx((bnd.get("desembolsos") or {}).get("ufs"))
    pgf_uf = idx(pgf.get("mapa"))
    emp_uf = idx(emp.get("ufs"))
    # penetração: agregado do municipal
    pen_agg = {}
    for m in pen_mun.get("municipios") or []:
        a = pen_agg.setdefault(m["uf"], {"municipios": 0, "credito": 0.0, "renda_anual": 0.0, "adultos": 0.0, "pop": 0.0, "abaixo": 0, "gap_abs": 0.0, "sem_estban": 0})
        a["municipios"] += 1
        a["credito"] += m.get("credito") or 0; a["renda_anual"] += m.get("renda_anual") or 0
        a["adultos"] += m.get("adultos") or 0; a["pop"] += m.get("pop_total") or 0
        if (m.get("gap_abs_modelo") or 0) > 0:
            a["abaixo"] += 1; a["gap_abs"] += m["gap_abs_modelo"]
        if m.get("no_estban") is False:
            a["sem_estban"] += 1
    # explorer: produtos por UF (PF + PJ), com inadimplência
    prod_uf = {}
    for r in (expl.get("fatos") or {}).get("uf_produto") or []:
        d = prod_uf.setdefault(r["uf"], {})
        p = d.setdefault(r["produto"], {"produto": r["produto"], "saldo": 0.0, "inad": 0.0, "pf": 0.0, "pj": 0.0})
        p["saldo"] += r.get("saldo") or 0; p["inad"] += r.get("inad") or 0
        p["pf" if r.get("cliente") == "PF" else "pj"] += r.get("saldo") or 0
    tot_br = {"saldo": sum(x.get("saldo") or 0 for x in pan_uf.values()), "pop": sum(x.get("populacao") or 0 for x in pgf_uf.values())}
    ufs = []
    for uf in sorted(NOMES):
        p = pan_uf.get(uf, {})
        pe = pen_agg.get(uf, {})
        prods = sorted(prod_uf.get(uf, {}).values(), key=lambda x: -x["saldo"])
        tot_prod = sum(x["saldo"] for x in prods)
        for x in prods:
            x["share"] = _share(x["saldo"], tot_prod); x["inad_pct"] = _share(x["inad"], x["saldo"]); x["pf_share"] = _share(x["pf"], x["saldo"])
        pr = pres_uf.get(uf, {}); px = pix_uf.get(uf, {}); mo = mor_uf.get(uf, {}); co = con_uf.get(uf, {}); ru = rur_uf.get(uf, {}); bn = bnd_uf.get(uf, {}); pg = pgf_uf.get(uf, {}); em = emp_uf.get(uf, {})
        ufs.append({
            "uf": uf, "nome": NOMES[uf], "prep": PREP[uf], "regiao": REGIOES[uf], "cod": p.get("cod"),
            "pop": pg.get("populacao") or co.get("pop") or (pe.get("pop") or None),
            "scr": {"data_base": pan.get("data_base"), "saldo": p.get("saldo"), "part_br": p.get("part_br"), "per_capita": p.get("per_capita"), "n_op": p.get("n_op"),
                    "cresc12": p.get("cresc12"), "cresc3": p.get("cresc3"), "inad": p.get("inad"), "d_inad_12m": p.get("d_inad_12m"), "atraso15_90": p.get("atraso15_90"),
                    "ap": p.get("ap"), "saldo_medio_op": p.get("saldo_medio_op"), "prod_dominante": p.get("prod_dominante"), "renda_dominante": p.get("renda_dominante"), "z_inad": p.get("z_inad")} if p else None,
            "produtos": prods[:10] or None,
            "penetracao": {"municipios": pe.get("municipios"), "credito": pe.get("credito"), "renda_anual": pe.get("renda_anual"), "adultos": pe.get("adultos"),
                           "penetracao": _r(pe["credito"] / pe["renda_anual"] * 100) if pe.get("renda_anual") else None,
                           "cred_adulto": _r(pe["credito"] / pe["adultos"]) if pe.get("adultos") else None,
                           "municipios_abaixo": pe.get("abaixo"), "gap_abs": pe.get("gap_abs"), "sem_estban": pe.get("sem_estban")} if pe else None,
            "presenca": {"municipios": pr.get("municipios"), "com_agencia": pr.get("agencia"), "so_posto": pr.get("posto"), "so_correspondente": pr.get("correspondente"), "nenhum": pr.get("nenhum"),
                         "agencias": pr.get("agencia_qtd"), "postos": pr.get("posto_qtd"), "pae": pr.get("pae_qtd"), "correspondentes": pr.get("corresp_qtd"),
                         "agencias_100mil": _r(pr["agencia_qtd"] / (pg.get("populacao") or co.get("pop")) * 1e5, 1) if pr.get("agencia_qtd") and (pg.get("populacao") or co.get("pop")) else None} if pr else None,
            "pix": {"mes": pix.get("data_base") or pix.get("mes"), "v_pag": px.get("v_pag"), "q_pag": px.get("q_pag"), "t_pag": px.get("t_pag"), "q_hab": px.get("q_hab"), "v_hab": px.get("v_hab"), "yoy_v": px.get("yoy_v"),
                    "pf_share": _share(px.get("v_pag_pf"), px.get("v_pag"))} if px else None,
            "moradia": {"dom_total": mo.get("dom_total"), "pgp": mo.get("pgp"), "alp": mo.get("alp"), "scr_imob_pf": mo.get("scr_imob_pf"), "scr_inad_pct": mo.get("scr_inad_pct"),
                        "taxa_sfh": mo.get("taxa_sfh"), "ltv_sfh": mo.get("ltv_sfh"), "valor_compra": mo.get("valor_compra"), "renda_pc": mo.get("renda_pc")} if mo else None,
            "consignado": {"p60": co.get("p60"), "elegiveis": co.get("elegiveis"), "cons_total": co.get("cons_total"), "cons_obs": co.get("cons_obs"), "part_apos": co.get("part_apos"),
                           "inad_apos": co.get("inad_apos"), "cons_por_elegivel": co.get("cons_por_elegivel"), "ben_medio": co.get("ben_medio"), "prural": co.get("prural")} if co else None,
            "rural": {"janela": rur.get("janela"), "valor": ru.get("valor"), "qtd": ru.get("qtd"), "share": ru.get("share"), "valor_hab": ru.get("valor_hab"), "agricola_share": ru.get("agricola_share"),
                      "pronaf_share": ru.get("pronaf_share"), "ticket": ru.get("ticket")} if ru else None,
            "bndes": {"janela": (bnd.get("desembolsos") or {}).get("janela"), "valor": bn.get("valor"), "share": bn.get("share"), "mpme_share": bn.get("mpme_share"), "var_12m_pct": bn.get("var_12m_pct"),
                      "valor_hab": bn.get("valor_hab")} if bn else None,
            "pgfn": {"data_base": pgf.get("data_base"), "inscricoes": pg.get("inscricoes"), "valor": pg.get("valor"), "part_br": pg.get("part_br"), "valor_medio": pg.get("valor_medio"),
                     "insc_pf_por_mil_hab": pg.get("insc_pf_por_mil_hab"), "pj_valor": (pg.get("pj") or {}).get("valor")} if pg else None,
            "emprego": {"mes": em.get("mes"), "saldo_mes": em.get("saldo_mes"), "admissoes_mes": em.get("admissoes_mes"), "desligamentos_mes": em.get("desligamentos_mes"),
                        "saldo_12m": em.get("saldo_12m"), "saldo_12m_anterior": em.get("saldo_12m_anterior"), "admissoes_12m": em.get("admissoes_12m"),
                        "desligamentos_12m": em.get("desligamentos_12m"), "retencao_pct": em.get("retencao_pct")} if em else None,
        })
    # posições entre as 27 UFs (1 = maior, salvo onde "menor" é o desejável e está dito na SPA)
    for bloco, chave in (("scr", "saldo"), ("scr", "per_capita"), ("scr", "inad"), ("scr", "cresc12"), ("penetracao", "penetracao"), ("penetracao", "cred_adulto"),
                         ("presenca", "agencias_100mil"), ("pix", "q_hab"), ("moradia", "pgp"), ("consignado", "cons_por_elegivel"), ("rural", "valor_hab"), ("bndes", "valor_hab"), ("emprego", "saldo_12m"), ("emprego", "retencao_pct"), ("pgfn", "insc_pf_por_mil_hab")):
        _rank(ufs, chave, bloco)
    # síntese por UF (determinística, com números da própria página)
    for u in ufs:
        s = u["scr"] or {}
        pos = u["posicoes"]
        partes = []
        if s.get("saldo"):
            partes.append(f"O crédito {u['prep']} somava R$ {_mil(s['saldo'] / 1e9)} bilhões em {s['data_base']}, {_dec(s['part_br'])}% do Brasil, "
                          f"R$ {_mil(s['per_capita'])} por habitante ({pos['scr.per_capita']}º entre as 27 UFs), com inadimplência de {_dec(s['inad'], 2)}% ({pos['scr.inad']}º) "
                          f"e crescimento de {'+' if s['cresc12'] >= 0 else ''}{_dec(s['cresc12'])}% em 12 meses.")
        pe = u["penetracao"] or {}
        if pe.get("penetracao") is not None:
            partes.append(f"Penetração de {pe['penetracao']:.0f}% da renda anual ({pos['penetracao.penetracao']}º), com {pe['municipios_abaixo']} de {pe['municipios']} municípios abaixo do esperado pelo modelo.")
        pr = u["presenca"] or {}
        if pr.get("municipios"):
            pl = lambda n, um, muitos: f"{n} {um if n == 1 else muitos}"
            partes.append(f"{pl(pr['com_agencia'], 'município tem', 'municípios têm')} agência, {pl(pr['so_correspondente'], 'depende', 'dependem')} só de correspondente e "
                          f"{'nenhum fica' if not pr['nenhum'] else pl(pr['nenhum'], 'fica', 'ficam')} sem ponto físico.")
        u["sintese"] = " ".join(partes)
    brasil = {"saldo": tot_br["saldo"], "inad": (pan.get("kpis") or {}).get("inad", {}).get("v"), "cresc12": (pan.get("kpis") or {}).get("saldo", {}).get("cresc12"),
              "penetracao": ((g("penetracao.json").get("totais") or {}).get("penetracao_br")), "cred_adulto": ((g("penetracao.json").get("totais") or {}).get("cred_adulto_br"))}
    return {
        "disponivel": True, "gerado_em": common.now_utc(),
        "datas": {"scr": pan.get("data_base"), "penetracao": (g("penetracao.json").get("data_base_credito")), "presenca": (pres.get("posicao") or {}), "pix": pix.get("data_base") or pix.get("mes"),
                  "moradia": (mor.get("datas") or {}).get("scr"), "consignado": (con_g.get("scr") or {}).get("data_base"), "rural": rur.get("janela"), "bndes": (bnd.get("desembolsos") or {}).get("janela"), "pgfn": pgf.get("data_base"), "emprego": emp.get("ufs_mes")},
        "brasil": brasil, "ufs": ufs,
        "fontes": ["BCB/SCR.data (Panorama)", "BCB/ESTBAN e IBGE Censo 2022 (Penetração)", "BCB/Unicad e Correspondentes (Presença)", "BCB/Pix", "BCB e IBGE (Moradia)", "INSS e SCR (Consignado)",
                   "BCB/MDCR (Crédito rural)", "BNDES dados abertos", "PGFN (Dívida ativa)", "MTE/Novo Caged via Ipeadata (Emprego formal)"],
        "cautelas": [
            "Cada bloco tem a própria data-base e a própria régua; posições em ranking são calculadas entre as 27 UFs dentro de um mesmo bloco e nunca cruzam blocos.",
            "Nada aqui é coletado de novo: a página reúne o recorte estadual dos painéis temáticos. Um bloco ausente significa que o painel de origem não publicou o recorte, não que o dado seja zero.",
            "Per capita e por habitante usam a população do Censo 2022; penetração usa a renda anual estimada por município.",
        ],
        "metodo": "Agregação em Python (stdlib) sobre os golds publicados; municipal somado por UF onde o painel de origem não traz o recorte estadual; posições por ordenação simples; sem estimativa.",
    }
