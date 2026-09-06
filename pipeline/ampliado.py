"""Crédito ampliado e mercado de capitais — gold ampliado.json.

Três fontes, três réguas, declaradas separadamente e nunca somadas entre si:
1. **Saldo** (BCB/SGS, família "crédito ampliado ao setor não financeiro"): quanto
   empresas e famílias devem, a quem — SFN, outras sociedades financeiras, fundos
   governamentais, títulos de dívida privados, instrumentos de securitização e
   dívida externa. É ESTOQUE de fim de mês, em R$ milhões e em % do PIB.
2. **Emissões** (CVM, ofertas públicas de distribuição): quanto se captou no mercado
   de capitais, oferta a oferta. É FLUXO pela data do registro. No rito automático
   da Res. 160 o valor é o REGISTRADO da oferta encerrada, não a colocação final; no
   regime anterior é o valor total da oferta. Registros de fundos abertos (ICVM 555)
   ficam fora: o valor lá é um teto cadastral, não uma captação.
3. **Securitização** (CVM, informes mensais de CRI e CRA): quanto de crédito
   imobiliário e do agronegócio está fora dos bancos e como o lastro paga. É ESTOQUE
   por certificado, agregado do sistema, pela última versão de cada informe.

Regras que sustentam o painel:
- Ausência é nulo. Onde o campo vem vazio (créditos do CRI antes de 2022-07), a série
  começa onde há dado.
- Mês incompleto é declarado. Nos informes de securitizadoras, um mês com menos de
  90% dos certificados do mês anterior é "parcial" e fica fora de KPI e de razão.
  Nas ofertas, o mês corrente é parcial por construção.
- Erro de unidade não entra. Certificado cujo crédito salta mais de 50 vezes de um
  mês para o outro (e volta) é excluído do mês, com contagem publicada.
- Concentração é medida, não adjetivada: HHI dos coordenadores e dos emissores.
"""
from datetime import date

from pipeline import common
from pipeline.sources.cvm_ofertas import DIVIDA_CORPORATIVA, SECURITIZACAO
from pipeline.fmt import _r, _share, _mes_menos

FONTES = {
    "sgs": {"nome": "BCB — Estatísticas de crédito ampliado ao setor não financeiro (SGS)",
            "url": "https://api.bcb.gov.br/dados/serie/bcdata.sgs.28203/dados?formato=json",
            "catalogo": "https://dadosabertos.bcb.gov.br/dataset/28203-saldo-de-credito-ampliado-concedido-a-empresas-e-familias---total",
            "licenca": "dados abertos do BCB", "nivel": "A — estatística oficial, mensal desde 2013"},
    "ofertas": {"nome": "CVM — Ofertas públicas de distribuição (regime anterior e Res. CVM 160)",
                "url": "https://dados.cvm.gov.br/dados/OFERTA/DISTRIB/DADOS/oferta_distribuicao.zip",
                "catalogo": "https://dados.cvm.gov.br/dataset/oferta-distribuicao",
                "licenca": "dados abertos da CVM", "nivel": "A — registro administrativo, oferta a oferta"},
    "securit": {"nome": "CVM — Informes mensais de securitizadoras (CRI e CRA, Res. CVM 60)",
                "url": "https://dados.cvm.gov.br/dados/SECURIT/DOC/",
                "catalogo": "https://dados.cvm.gov.br/dataset/securit-doc-inf_mensal",
                "licenca": "dados abertos da CVM", "nivel": "A — informe regulatório por certificado, mensal"},
}
COMPONENTES = [("sfn", "Empréstimos do SFN", "#1d4e89"), ("osf", "Outras sociedades financeiras", "#0e7c7b"),
               ("fg", "Fundos governamentais", "#6b46a3"), ("tit", "Títulos de dívida privados", "#b45309"),
               ("sec", "Instrumentos de securitização", "#2f7d4f"), ("ext", "Dívida externa", "#8d5a2b")]
SEGMENTOS = {"ef": "Empresas e famílias", "pj": "Empresas", "pf": "Famílias"}
STATUS_ENCERRADA = ("Encerrada/registrada", "Oferta Encerrada")
STATUS_ANDAMENTO = ("Registro Concedido", "Aguardando Bookbuilding")
RITO_EXCLUIDO = "ICVM 555"          # fundos abertos: teto cadastral, não captação
SALTO_UNIDADE = 50                  # x vezes entre meses consecutivos do mesmo certificado
PISO_COBERTURA_MES = 0.90           # certificados no mês ÷ mês anterior


def _hhi(vals):
    tot = sum(vals)
    return round(sum((v / tot * 100) ** 2 for v in vals)) if tot else None


def _sgs(con, key):
    return [(d[:7], v) for d, v in common.get_series(con, key)]


# ---------------------------------------------------------------- saldo (SGS)
def _saldo(con):
    out = {"disponivel": False}
    tot = {seg: dict(_sgs(con, f"amp_{seg}")) for seg in SEGMENTOS}
    if not tot["ef"]:
        return out
    comp = {seg: {c: dict(_sgs(con, f"amp_{seg}_{c}")) for c, _n, _cor in COMPONENTES} for seg in SEGMENTOS}
    pib = {seg: dict(_sgs(con, f"amp_{seg}_pib")) for seg in SEGMENTOS}
    pib_total = dict(_sgs(con, "amp_pib"))
    total_snf = dict(_sgs(con, "amp_total"))
    gov = dict(_sgs(con, "amp_gov"))
    meses = sorted(tot["ef"])
    series = {}
    for seg in SEGMENTOS:
        pts = []
        for m in meses:
            t = tot[seg].get(m)
            if t is None:
                continue
            p = {"mes": m, "total": t, "pib_pct": pib[seg].get(m)}
            soma = 0.0
            for c, _n, _cor in COMPONENTES:
                v = comp[seg][c].get(m)
                p[c] = v
                soma += v or 0
            p["fecha_pct"] = _r(soma / t * 100, 1) if t else None
            # famílias não têm "títulos privados" (a família não emite debênture); o campo fica nulo
            pts.append(p)
        series[seg] = pts
    ult = meses[-1]
    ant = _mes_menos(ult, 12)
    kpis = {}
    for seg in SEGMENTOS:
        t, t_ant = tot[seg].get(ult), tot[seg].get(ant)
        sfn = comp[seg]["sfn"].get(ult)
        mercado = (comp[seg]["tit"].get(ult) or 0) + (comp[seg]["sec"].get(ult) or 0)
        kpis[seg] = {
            "saldo": t, "pib_pct": pib[seg].get(ult), "var_12m_pct": _r((t / t_ant - 1) * 100, 1) if t and t_ant else None,
            "sfn_share": _share(sfn, t), "mercado_share": _share(mercado, t),
            "externo_share": _share(comp[seg]["ext"].get(ult), t),
            "componentes": [{"id": c, "nome": n, "cor": cor, "valor": comp[seg][c].get(ult), "share": _share(comp[seg][c].get(ult), t),
                             "var_12m_pct": _r((comp[seg][c].get(ult) / comp[seg][c].get(ant) - 1) * 100, 1) if comp[seg][c].get(ult) and comp[seg][c].get(ant) else None}
                            for c, n, cor in COMPONENTES if comp[seg][c].get(ult) is not None],
        }
    # desintermediação das empresas: participação do SFN no crédito a empresas, ano a ano (dezembro)
    dez = [m for m in meses if m.endswith("-12")] + [ult]
    desint = []
    for m in dez:
        t = tot["pj"].get(m)
        if not t:
            continue
        desint.append({"mes": m, "sfn_share": _share(comp["pj"]["sfn"].get(m), t),
                       "titulos_share": _share(comp["pj"]["tit"].get(m), t), "sec_share": _share(comp["pj"]["sec"].get(m), t),
                       "externo_share": _share(comp["pj"]["ext"].get(m), t), "parcial": not m.endswith("-12")})
    out.update({
        "disponivel": True, "mes": ult, "unidade": "R$ milhões (saldo de fim de mês, nominal)",
        "total_setor_nao_financeiro": total_snf.get(ult), "governo_geral": gov.get(ult), "total_pib_pct": pib_total.get(ult),
        "kpis": kpis, "series": series, "desintermediacao_empresas": desint,
        "componentes": [{"id": c, "nome": n, "cor": cor} for c, n, cor in COMPONENTES],
        "nota": ("Saldo devido por empresas e famílias residentes a todos os credores: bancos e demais instituições do SFN, "
                 "outras sociedades financeiras (seguradoras, fundos de investimento, FIDCs como credores), fundos governamentais "
                 "(FGTS, FAT, fundos constitucionais), títulos de dívida privados (debêntures, notas comerciais), instrumentos de "
                 "securitização (CRI, CRA, cotas de FIDC lastreadas) e dívida externa. Famílias não emitem títulos privados; o campo fica nulo."),
    })
    return out


# ---------------------------------------------------------------- emissões (CVM ofertas)
def _emissoes(con):
    out = {"disponivel": False}
    if not con.execute("SELECT 1 FROM cvm_ofertas LIMIT 1").fetchone():
        return out
    hoje = date.today()
    mes_corrente = f"{hoje.year}-{hoje.month:02d}"
    base = ("FROM cvm_ofertas WHERE (rito IS NULL OR rito NOT LIKE ?) AND status IN (?,?) AND mes < ?")
    args = (f"{RITO_EXCLUIDO}%", *STATUS_ENCERRADA, mes_corrente)
    ult = con.execute("SELECT MAX(mes) " + base, args).fetchone()[0]
    if not ult:
        return out
    fim = _mes_menos(mes_corrente, 1)          # último mês fechado = mês anterior ao corrente
    ini = _mes_menos(fim, 11)
    ini_ant, fim_ant = _mes_menos(ini, 12), _mes_menos(fim, 12)
    rows = con.execute("SELECT mes, familia, valor " + base, args).fetchall()
    mensal = {}
    for m, fam, v in rows:
        d = mensal.setdefault(m, {"mes": m, "total": 0.0, "n": 0})
        d[fam] = d.get(fam, 0.0) + v
        d["total"] += v
        d["n"] += 1
    familias = sorted({f for _m, f, _v in rows})
    serie = [mensal[m] for m in sorted(mensal) if m >= "2010-01"]
    for p in serie:
        for f in familias:
            p.setdefault(f, 0.0)
        p["divida_corporativa"] = sum(p.get(f, 0) for f in DIVIDA_CORPORATIVA)
        p["securitizacao"] = sum(p.get(f, 0) for f in SECURITIZACAO)
    anual = {}
    for p in serie:
        a = anual.setdefault(p["mes"][:4], {"ano": p["mes"][:4], "total": 0.0, "n": 0, "divida_corporativa": 0.0, "securitizacao": 0.0, "meses": 0})
        for f in familias:
            a[f] = a.get(f, 0.0) + p[f]
        a["total"] += p["total"]; a["n"] += p["n"]; a["meses"] += 1
        a["divida_corporativa"] += p["divida_corporativa"]; a["securitizacao"] += p["securitizacao"]
    anual = [dict(a, incompleto=a["meses"] < 12) for a in anual.values()]
    jan = [p for p in serie if ini <= p["mes"] <= fim]
    jan_ant = [p for p in serie if ini_ant <= p["mes"] <= fim_ant]
    soma = lambda ps, k: sum(p.get(k, 0) for p in ps)
    tot12, tot12_ant = soma(jan, "total"), soma(jan_ant, "total")
    por_familia = sorted([{"familia": f, "valor": soma(jan, f), "n": sum(1 for m, ff, _v in rows if ff == f and ini <= m <= fim),
                           "share": _share(soma(jan, f), tot12), "var_12m_pct": _r((soma(jan, f) / soma(jan_ant, f) - 1) * 100, 1) if soma(jan_ant, f) else None}
                          for f in familias], key=lambda x: -x["valor"])
    # recortes só do rito automático da Res. 160 (público-alvo, incentivo, sustentável, regime de distribuição)
    sql_160 = ("FROM cvm_ofertas WHERE regime='res160' AND status=? AND mes BETWEEN ? AND ?")
    a160 = ("Oferta Encerrada", ini, fim)
    tot160 = con.execute("SELECT SUM(valor), COUNT(*) " + sql_160, a160).fetchone()
    publico = [{"publico": p or "não informado", "n": n, "valor": v, "share": _share(v, tot160[0])}
               for p, n, v in con.execute("SELECT publico, COUNT(*), SUM(valor) " + sql_160 + " GROUP BY publico ORDER BY 3 DESC", a160)]
    regime_dist = [{"regime": p or "não informado", "n": n, "valor": v, "share": _share(v, tot160[0])}
                   for p, n, v in con.execute("SELECT regime_distribuicao, COUNT(*), SUM(valor) " + sql_160 + " GROUP BY regime_distribuicao ORDER BY 3 DESC", a160)]
    deb = con.execute("SELECT SUM(valor), SUM(CASE WHEN incentivada=1 THEN valor ELSE 0 END), SUM(CASE WHEN sustentavel=1 THEN valor ELSE 0 END), COUNT(*), SUM(incentivada=1), SUM(sustentavel=1) "
                      + sql_160 + " AND familia='Debêntures'", a160).fetchone()
    debentures = {"valor": deb[0], "n": deb[3], "incentivadas_share": _share(deb[1], deb[0]), "incentivadas_n": deb[4] or 0,
                  "sustentaveis_share": _share(deb[2], deb[0]), "sustentaveis_n": deb[5] or 0}
    # emissores e coordenadores da dívida corporativa (12 meses, todos os regimes)
    fam_div = "','".join(DIVIDA_CORPORATIVA)
    base_div = base + f" AND familia IN ('{fam_div}') AND mes BETWEEN ? AND ?"
    args_div = (*args, ini, fim)
    tot_div = con.execute("SELECT SUM(valor), COUNT(*), COUNT(DISTINCT cnpj_emissor) " + base_div, args_div).fetchone()
    emissores = [{"nome": (n or "").strip(), "cnpj": c, "n": k, "valor": v, "share": _share(v, tot_div[0])}
                 for c, n, k, v in con.execute("SELECT cnpj_emissor, MAX(emissor), COUNT(*), SUM(valor) " + base_div + " GROUP BY cnpj_emissor ORDER BY 4 DESC LIMIT 15", args_div)]
    lideres_rows = con.execute("SELECT cnpj_lider, MAX(lider), COUNT(*), SUM(valor) " + base_div + " GROUP BY cnpj_lider ORDER BY 4 DESC", args_div).fetchall()
    lideres = [{"nome": (n or "").strip() or "não informado", "cnpj": c, "n": k, "valor": v, "share": _share(v, tot_div[0])} for c, n, k, v in lideres_rows[:12]]
    hhi_lideres = _hhi([v for _c, _n, _k, v in lideres_rows if v])
    top5_lideres = _share(sum(v for _c, _n, _k, v in lideres_rows[:5]), tot_div[0])
    em_andamento = con.execute("SELECT COUNT(*), SUM(valor) FROM cvm_ofertas WHERE regime='res160' AND status IN (?,?)", STATUS_ANDAMENTO).fetchone()
    coleta = con.execute("SELECT collected_at, n_legado, n_160 FROM cvm_ofertas_coleta ORDER BY collected_at DESC LIMIT 1").fetchone()
    out.update({
        "disponivel": True, "janela": {"ini": ini, "fim": fim}, "janela_anterior": {"ini": ini_ant, "fim": fim_ant},
        "mes_corrente_parcial": mes_corrente, "ultimo_mes_com_oferta": ult,
        "unidade": "R$ (valor total da oferta no regime anterior; valor registrado da oferta encerrada na Res. 160)",
        "kpis": {"valor_12m": tot12, "n_12m": len([1 for m, _f, _v in rows if ini <= m <= fim]), "var_12m_pct": _r((tot12 / tot12_ant - 1) * 100, 1) if tot12_ant else None,
                 "divida_corporativa_12m": soma(jan, "divida_corporativa"), "securitizacao_12m": soma(jan, "securitizacao"),
                 "divida_corporativa_var_12m_pct": _r((soma(jan, "divida_corporativa") / soma(jan_ant, "divida_corporativa") - 1) * 100, 1) if soma(jan_ant, "divida_corporativa") else None,
                 "profissional_share": next((p["share"] for p in publico if p["publico"] == "Profissional"), None),
                 "incentivadas_share_debentures": debentures["incentivadas_share"], "hhi_lideres": hhi_lideres, "top5_lideres_share": top5_lideres,
                 "emissores_distintos_divida": tot_div[2]},
        "familias": familias, "por_familia": por_familia, "serie_mensal": serie[-180:], "anual": anual,
        "res160": {"janela": {"ini": ini, "fim": fim}, "valor": tot160[0], "n": tot160[1], "publico_alvo": publico, "regime_distribuicao": regime_dist, "debentures": debentures,
                   "em_andamento": {"n": em_andamento[0], "valor_registrado": em_andamento[1]}},
        "divida_corporativa": {"janela": {"ini": ini, "fim": fim}, "valor": tot_div[0], "n": tot_div[1], "emissores_distintos": tot_div[2],
                               "top_emissores": emissores, "top_lideres": lideres, "hhi_lideres": hhi_lideres, "top5_lideres_share": top5_lideres,
                               "n_lideres": len([1 for x in lideres_rows if x[3]])},
        "coleta": {"em": coleta[0] if coleta else None, "ofertas_regime_anterior": coleta[1] if coleta else None, "ofertas_res160": coleta[2] if coleta else None},
        "nota": ("Fluxo pela data do registro (ou do início, nas dispensadas do regime anterior). Regime anterior: valor total da oferta. "
                 "Res. 160 (rito automático): valor registrado das ofertas encerradas; as em andamento aparecem à parte e não entram nos totais. "
                 "Fundos abertos com registro automático (ICVM 555) ficam fora: o valor lá é teto cadastral."),
    })
    return out


# ---------------------------------------------------------------- securitização (CVM CRI/CRA)
def series_securitizacao(con, tipo):
    """Série mensal limpa (última versão, sem erro de unidade, meses incompletos marcados).
    Compartilhada com leading.py, que a usa como componente do subíndice não bancário."""
    rows = con.execute("SELECT ref, cnpj, cod, creditos, vencidos, atraso, pdd, ativo FROM securit_cert WHERE tipo=? ORDER BY ref", (tipo,)).fetchall()
    if not rows:
        return []
    por_mes = {}
    for ref, cnpj, cod, cr, ve, at, pdd, ativo in rows:
        por_mes.setdefault(ref, {})[(cnpj, cod)] = (cr, ve, at, pdd, ativo)
    meses = sorted(por_mes)
    out = []
    prev_vals, prev_venc, prev_n = {}, {}, None
    for i, m in enumerate(meses):
        certs = por_mes[m]
        n = len(certs)
        excl = []
        cr = ve = at = pdd = ativo = 0.0
        n_cred = 0
        for k, (c, v, a, p, av) in certs.items():
            if c is None:
                continue
            pc = prev_vals.get(k)
            prox = por_mes[meses[i + 1]].get(k) if i + 1 < len(meses) else None
            if pc and c > pc * SALTO_UNIDADE and (prox is None or prox[0] is None or c > (prox[0] or 0) * SALTO_UNIDADE):
                excl.append(k)
                continue
            if (v or 0) > c or (a or 0) > c:   # vencido ou atraso maior que o crédito: informe inconsistente
                excl.append(k)
                continue
            # todo o crédito marcado como vencido num único mês, com zero antes e depois: erro de preenchimento
            pv = prev_venc.get(k)
            if v and v >= c * 0.99 and (pv is None or pv < c * 0.1) and (prox is None or prox[1] is None or prox[1] < c * 0.1):
                excl.append(k)
                continue
            n_cred += 1
            cr += c; ve += v or 0; at += a or 0; pdd += p or 0; ativo += av or 0
        parcial = prev_n is not None and n < prev_n * PISO_COBERTURA_MES
        out.append({"mes": m, "n_cert": n, "n_com_credito": n_cred, "creditos": cr if n_cred else None,
                    "vencidos_pct": _r(ve / cr * 100) if cr else None, "atraso_pct": _r(at / cr * 100) if cr else None,
                    "pdd_pct": _r(pdd / cr * 100) if cr else None, "ativo": ativo if n_cred else None,
                    "excluidos_unidade": len(excl), "parcial": parcial})
        prev_vals = {k: v[0] for k, v in certs.items() if v[0] is not None}
        prev_venc = {k: (v[1] or 0) for k, v in certs.items() if v[0] is not None}
        prev_n = n if not parcial else prev_n
    return out


def _securitizacao(con):
    out = {"disponivel": False}
    blocos = {}
    for tipo, nome in (("cri", "CRI"), ("cra", "CRA")):
        ser = series_securitizacao(con, tipo)
        if not ser:
            continue
        com_dado = [p for p in ser if p["creditos"]]
        fechados = [p for p in com_dado if not p["parcial"]]
        if not fechados:
            continue
        ult = fechados[-1]
        ant = next((p for p in fechados if p["mes"] == _mes_menos(ult["mes"], 12)), None)
        seg_rows = con.execute("SELECT segmento, valor FROM securit_seg WHERE tipo=? AND ref=? ORDER BY valor DESC", (tipo, ult["mes"])).fetchall()
        seg_tot = sum(v for _s, v in seg_rows)
        classes = con.execute("SELECT situacao, n, valor FROM securit_classe WHERE tipo=? AND ref=?", (tipo, ult["mes"])).fetchall()
        cl_tot_n = sum(n for _s, n, _v in classes)
        cl_tot_v = sum(v for _s, _n, v in classes)
        blocos[tipo] = {
            "nome": nome, "mes": ult["mes"], "primeiro_mes_com_credito": com_dado[0]["mes"],
            "meses_parciais": [p["mes"] for p in ser if p["parcial"]],
            "kpis": {"n_cert": ult["n_cert"], "creditos": ult["creditos"], "vencidos_pct": ult["vencidos_pct"], "atraso_pct": ult["atraso_pct"],
                     "pdd_pct": ult["pdd_pct"], "var_12m_pct": _r((ult["creditos"] / ant["creditos"] - 1) * 100, 1) if ant and ant["creditos"] else None,
                     "vencidos_pct_12m_atras": ant["vencidos_pct"] if ant else None},
            "serie": [{k: v for k, v in p.items()} for p in ser][-96:],
            "segmentos": [{"segmento": s, "valor": v, "share": _share(v, seg_tot)} for s, v in seg_rows],
            "series_situacao": [{"situacao": s, "n": n, "valor": v, "share_n": _share(n, cl_tot_n), "share_valor": _share(v, cl_tot_v)} for s, n, v in sorted(classes, key=lambda x: -x[1])],
            "excluidos_unidade_ultimo_mes": ult["excluidos_unidade"],
        }
    if not blocos:
        return out
    out.update({"disponivel": True, "blocos": blocos,
                "nota": ("Créditos vinculados por certificado (última versão do informe), agregados do sistema. 'Vencidos' são parcelas "
                         "vencidas e não pagas; 'a vencer com atraso' são contratos com alguma parcela atrasada. Nenhuma das duas é perda: "
                         "subordinação, sobrecolateral e coobrigação absorvem parte, e as estruturas não são comparáveis entre si.")})
    return out


# ---------------------------------------------------------------- FIDC (já coletado)
def _fidc(con):
    ser = serie_fidc(con)
    if not ser:
        return {"disponivel": False}
    fechados = [p for p in ser if not p["parcial"]]
    if not fechados:
        return {"disponivel": False}
    ult = fechados[-1]
    return {"disponivel": True, "mes": ult["mes"], "meses_parciais": [p["mes"] for p in ser if p["parcial"]],
            "kpis": {"n_fundos": ult["n_fundos"], "carteira": ult["carteira"], "inad_pct": ult["inad_pct"], "parcelas_inad_pct": ult["parcelas_inad_pct"]}, "serie": ser[-60:],
            "nota": ("informes mensais de FIDC (tab I), agregado do sistema; mês com menos de 90% dos fundos do mês anterior é parcial. "
                     "Inadimplência = créditos existentes inadimplentes ÷ carteira (I.2.a.3 e I.2.b.3 do informe); a medida de créditos a vencer "
                     "com parcelas inadimplentes fica ao lado. A página Sinais Antecedentes usa a mesma série como componente do subíndice não "
                     "bancário; FIDCs por lastro e cota abre lastro, classes e prazos.")}


def serie_fidc(con):
    """Série mensal dos FIDCs com meses parciais marcados (compartilhada com leading.py e fidc.py).

    Pelo dicionário da CVM (tab I): venc_inad soma I.2.a.2 + I.2.b.2, "créditos a vencer com parcelas
    inadimplentes"; venc_ad soma I.2.a.1 + I.2.b.1, "a vencer e adimplentes"; cred_inad soma I.2.a.3 +
    I.2.b.3, "créditos existentes inadimplentes". Até 06/09/2026 o campo inad_pct era venc_inad ÷ carteira
    rotulado como "vencidos inadimplentes"; passa a ser cred_inad ÷ carteira, e a medida antiga segue
    publicada com o nome certo em parcelas_inad_pct. Mês sem cred_inad (silver anterior ao backfill)
    fica nulo, nunca aproximado.
    """
    try:
        cols = {r[1] for r in con.execute("PRAGMA table_info(fidc_agg)").fetchall()}
        sel = "SELECT anomes, n_fundos, carteira, venc_inad, venc_ad, " + ("cred_inad" if "cred_inad" in cols else "NULL") + " FROM fidc_agg ORDER BY anomes"
        rows = con.execute(sel).fetchall()
    except Exception:
        return []
    out, prev_n = [], None
    for am, n, c, vi, va, ci in rows:
        parcial = prev_n is not None and n < prev_n * PISO_COBERTURA_MES
        out.append({"mes": f"{am[:4]}-{am[4:6]}", "n_fundos": n, "carteira": c,
                    "inad_pct": _r(ci / c * 100) if c and ci is not None else None,
                    "parcelas_inad_pct": _r(vi / c * 100) if c else None,
                    "a_vencer_pct": _r((vi + va) / c * 100) if c else None, "parcial": parcial})
        if not parcial:
            prev_n = n
    return out


# ---------------------------------------------------------------- build
def build(con, cfg=None):
    saldo = _saldo(con)
    emis = _emissoes(con)
    sec = _securitizacao(con)
    fidc = _fidc(con)
    if not saldo.get("disponivel") and not emis.get("disponivel") and not sec.get("disponivel"):
        return {"disponivel": False, "motivo": "silver sem séries de crédito ampliado, ofertas ou securitizadoras — coleta ainda não rodou"}
    bi = lambda v: f"R$ {v / 1e9:.0f} bi" if v else "–"        # valores da CVM vêm em R$
    tri = lambda v: f"R$ {v / 1e6:.1f} tri" if v else "–"      # saldos do SGS vêm em R$ milhões
    frases = []
    if saldo.get("disponivel"):
        k = saldo["kpis"]["ef"]; kp = saldo["kpis"]["pj"]
        frases.append(f"Em {saldo['mes']}, empresas e famílias deviam {tri(k['saldo'])} ({k['pib_pct']:.0f}% do PIB); "
                      f"{k['sfn_share']:.0f}% desse saldo está no SFN e {k['mercado_share']:.0f}% em títulos e securitização. "
                      f"Nas empresas, o SFN responde por {kp['sfn_share']:.0f}% e os títulos privados por "
                      f"{next((c['share'] for c in kp['componentes'] if c['id'] == 'tit'), 0):.0f}%.")
    if emis.get("disponivel"):
        ke = emis["kpis"]
        frases.append(f"O mercado de capitais registrou {bi(ke['valor_12m'])} em ofertas encerradas entre "
                      f"{emis['janela']['ini']} e {emis['janela']['fim']}"
                      + (f" ({ke['var_12m_pct']:+.0f}% sobre os 12 meses anteriores)" if ke.get("var_12m_pct") is not None else "")
                      + f", dos quais {bi(ke['divida_corporativa_12m'])} em debêntures e notas comerciais.")
    if sec.get("disponivel"):
        partes = []
        for t in ("cri", "cra"):
            b = sec["blocos"].get(t)
            if b:
                partes.append(f"{b['nome']}: {bi(b['kpis']['creditos'])} de créditos vinculados em {b['mes']}, "
                              f"{b['kpis']['vencidos_pct']:.1f}% vencidos")
        if partes:
            frases.append("Securitização — " + "; ".join(partes) + ".")
    return {
        "disponivel": True, "gerado_em": common.now_utc(), "fontes": FONTES,
        "sintese": " ".join(frases),
        "saldo": saldo, "emissoes": emis, "securitizacao": sec, "fidc": fidc,
        "catalogo": [
            {"id": "saldo_ampliado", "nome": "Saldo de crédito ampliado", "definicao": "dívida de empresas e famílias residentes com todos os credores, no fim do mês", "unidade": "R$ milhões; % do PIB",
             "fonte": "BCB/SGS 28203 e família", "limitacoes": "estoque nominal; inclui crédito de não residentes convertido pelo câmbio de fim de período"},
            {"id": "sfn_share", "nome": "Participação do SFN", "definicao": "empréstimos e financiamentos do SFN ÷ saldo ampliado do segmento", "unidade": "%", "fonte": "calculado",
             "limitacoes": "o restante não é 'mercado' inteiro: inclui fundos governamentais e outras sociedades financeiras"},
            {"id": "emissoes_12m", "nome": "Ofertas encerradas em 12 meses", "definicao": "soma do valor das ofertas públicas com registro no mês, por família de ativo", "unidade": "R$", "fonte": "CVM ofertas",
             "limitacoes": "valor registrado (Res. 160) ou valor total da oferta (regime anterior), não a colocação final; fundos abertos (ICVM 555) fora"},
            {"id": "hhi_lideres", "nome": "Concentração dos coordenadores", "definicao": "HHI das participações dos coordenadores líderes na dívida corporativa de 12 meses", "unidade": "pontos", "fonte": "calculado",
             "limitacoes": "só o líder da oferta; consórcios de distribuição não são abertos"},
            {"id": "vencidos_pct", "nome": "Créditos vencidos do lastro (CRI, CRA)", "definicao": "parcelas vencidas e não pagas ÷ créditos vinculados, agregado do sistema", "unidade": "%", "fonte": "CVM securitizadoras",
             "limitacoes": "não é perda; certificado com erro de unidade excluído do mês; meses incompletos marcados"},
        ],
        "cautelas": [
            "Saldo (SGS), emissões (CVM) e lastro securitizado (CVM) são três réguas: estoque devido, fluxo registrado e estoque por certificado. Nunca se somam nem se dividem entre si.",
            "O valor das ofertas da Res. 160 é o registrado da oferta encerrada; a colocação efetiva pode ser menor (distribuição parcial) e não é publicada oferta a oferta.",
            "Registros de fundos abertos (ICVM 555) trazem um teto cadastral e ficaram fora de todo total.",
            "Nos informes de securitizadoras, o CRI só informa créditos a partir de 2022-07; a série começa ali. Meses com menos de 90% dos certificados do mês anterior são parciais e ficam fora dos KPIs.",
            "Certificado cujo crédito salta mais de 50 vezes entre meses (erro de unidade), com vencido maior que o crédito, ou com todo o crédito marcado vencido num único mês (zero antes e depois) é excluído do mês, com contagem publicada.",
            "Vencido e em atraso não são perda: subordinação, sobrecolateral e coobrigação absorvem parte, e as estruturas não são comparáveis entre si.",
        ],
        "metodo": ("Séries do SGS pela API pública; ofertas da CVM a partir do zip consolidado (dois regimes sem sobreposição), uma linha por oferta; "
                   "informes de securitizadoras por ano, última versão por certificado e mês; agregação em Python (stdlib), sem estimativa, "
                   "sem interpolação, sem imputação."),
    }
