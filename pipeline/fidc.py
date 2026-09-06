"""FIDCs por lastro e classe de cota — gold fidc.json.

Uma fonte: os informes mensais de FIDC da CVM, agregados entre fundos pelo coletor
(pipeline/sources/fidc.py). Quatro leituras, cada uma com a própria cobertura declarada:

- sistema (tab I): fundos, carteira, créditos vencidos inadimplentes e adimplentes;
  a série é a mesma que Bancos e mercado de capitais e Sinais antecedentes usam.
- lastro (tab II): carteira por segmento do direito creditório, com onze grupos e os
  subitens que a CVM publica (o financeiro abre em crédito pessoal, consignado, corporativo,
  middle market, veículos, imobiliário e outros). Nem todo fundo preenche a tabela.
- classes (tab X.2 contra tab IV): PL por classe de cota (sênior, mezanino, subordinada,
  única), só de fundos cuja soma das classes fecha com o PL em ±20% e só entre fundos com
  duas ou mais classes. Subordinação = mezanino + subordinada ÷ PL desses fundos: é o
  colchão que absorve perdas antes do sênior. Fundo de classe única não tem subordinação e
  entra numa linha própria (a CVM renomeou 670 deles de "Subordinada" para "Senior" em
  2025-12; medir só os multiclasse deixa a série imune a esse rótulo).
- prazo (tab VI): direitos creditórios a vencer por faixa de prazo e parcelas
  inadimplentes por faixa de atraso, entre os fundos que informam a tabela.

Regras: shares sobre a base coberta de cada tabela, nunca sobre a carteira total; variação
em pontos percentuais contra o mesmo mês do ano anterior; mês parcial (menos de 90% dos
fundos do mês anterior) fica fora dos KPIs. Atraso não é perda.
"""
from pipeline import common
from pipeline.ampliado import serie_fidc
from pipeline.fmt import _r, _share, _dec, _mil
from pipeline.sources.fidc import LASTRO, PRAZOS

FONTE = {"nome": "CVM — informes mensais de FIDC (dados abertos)",
         "url": "https://dados.cvm.gov.br/dados/FIDC/DOC/INF_MENSAL/DADOS/",
         "dicionario": "https://dados.cvm.gov.br/dados/FIDC/DOC/INF_MENSAL/META/meta_inf_mensal_fidc_txt.zip",
         "licenca": "dados abertos da CVM", "nivel": "A — informe regulatório mensal dos administradores à CVM"}
CLASSES = [("senior", "Sênior"), ("mezanino", "Mezanino"), ("subordinada", "Subordinada"), ("unica", "Única"), ("outra", "Outra")]  # fundos com 2+ classes
MONO = "monoclasse"  # fundos com uma só classe: sem subordinação, seja qual for o rótulo
NOMES_PRAZO = {"30": "até 30 dias", "60": "31 a 60 dias", "90": "61 a 90 dias", "120": "91 a 120 dias", "150": "121 a 150 dias",
               "180": "151 a 180 dias", "360": "181 a 360 dias", "720": "1 a 2 anos", "1080": "2 a 3 anos", "MAIOR_1080": "acima de 3 anos"}


def _am(mes):
    return mes.replace("-", "")


def _mes(am):
    return f"{am[:4]}-{am[4:6]}"


def _am_menos(am, n):
    y, m = int(am[:4]), int(am[4:6])
    t = y * 12 + (m - 1) - n
    return f"{t // 12:04d}{t % 12 + 1:02d}"


def _lastro(con, am, am12):
    vals = dict(con.execute("SELECT cat, valor FROM fidc_lastro WHERE anomes=?", (am,)).fetchall())
    if not vals:
        return None
    antes = dict(con.execute("SELECT cat, valor FROM fidc_lastro WHERE anomes=?", (am12,)).fetchall()) if am12 else {}
    det = con.execute("SELECT n_fundos_lastro, carteira_lastro, carteira_tab1_com_lastro, n_fundos_tab1, carteira_tab1 FROM fidc_detalhe WHERE anomes=?", (am,)).fetchone()
    base = sum(v for (cat, _c, _n, pai), v in ((x, vals.get(x[0], 0.0)) for x in LASTRO) if pai is None)
    base12 = sum(v for (cat, _c, _n, pai), v in ((x, antes.get(x[0], 0.0)) for x in LASTRO) if pai is None) if antes else None
    grupos = []
    for cat, _col, nome, pai in LASTRO:
        if pai is not None:
            continue
        v = vals.get(cat, 0.0)
        subs = [{"id": c, "nome": n, "valor": vals.get(c, 0.0), "share_pct": _share(vals.get(c, 0.0), base)}
                for c, _cc, n, p in LASTRO if p == cat and vals.get(c, 0.0) > 0]
        share = _share(v, base)
        share12 = _share(antes.get(cat, 0.0), base12) if base12 else None
        grupos.append({"id": cat, "nome": nome, "valor": v, "share_pct": share,
                       "d12_pp": _r(share - share12) if share is not None and share12 is not None else None,
                       "var_12m_pct": _r((v / antes[cat] - 1) * 100) if antes.get(cat) else None, "sub": subs})
    grupos.sort(key=lambda g: -g["valor"])
    return {"grupos": grupos, "base": base,
            "cobertura": {"n_fundos": det[0] if det else None, "n_fundos_total": det[3] if det else None, "carteira_tab2": det[1] if det else base,
                          "carteira_tab1_cobertos": det[2] if det else None, "carteira_tab1_total": det[4] if det else None,
                          "share_carteira_pct": _share(det[2], det[4]) if det and det[4] else None}}


def _classes(con, am, am12):
    rows = con.execute("SELECT classe, pl, n_fundos FROM fidc_classe WHERE anomes=?", (am,)).fetchall()
    if not rows:
        return None
    pl = {c: v for c, v, _n in rows if c != MONO}
    nf = {c: n for c, _v, n in rows}
    mono = next(((v, n) for c, v, n in rows if c == MONO), (0.0, 0))
    antes = {c: v for c, v, _n in con.execute("SELECT classe, pl, n_fundos FROM fidc_classe WHERE anomes=?", (am12,)).fetchall() if c != MONO} if am12 else {}
    tot, tot12 = sum(pl.values()), sum(antes.values()) if antes else None
    if tot <= 0:
        return None
    det = con.execute("SELECT n_fundos_classe_ok, pl_classe_ok, n_fundos_pl, pl_total FROM fidc_detalhe WHERE anomes=?", (am,)).fetchone()
    itens = []
    for cid, nome in CLASSES:
        if pl.get(cid, 0.0) <= 0:
            continue
        share, share12 = _share(pl[cid], tot), (_share(antes.get(cid, 0.0), tot12) if tot12 else None)
        itens.append({"id": cid, "nome": nome, "pl": pl[cid], "n_fundos": nf.get(cid), "share_pct": share,
                      "d12_pp": _r(share - share12) if share is not None and share12 is not None else None})
    sub = pl.get("mezanino", 0.0) + pl.get("subordinada", 0.0)
    sub12 = (antes.get("mezanino", 0.0) + antes.get("subordinada", 0.0)) if antes else None
    s, s12 = _share(sub, tot), (_share(sub12, tot12) if tot12 else None)
    pl_ok = det[1] if det else tot + mono[0]
    return {"itens": itens, "pl_multiclasse": tot, "subordinacao_pct": s, "d12_subordinacao_pp": _r(s - s12) if s is not None and s12 is not None else None,
            "monoclasse": {"pl": mono[0], "n_fundos": mono[1], "share_pl_pct": _share(mono[0], pl_ok)},
            "cobertura": {"n_fundos_ok": det[0] if det else None, "pl_ok": pl_ok, "n_fundos_pl": det[2] if det else None,
                          "pl_total": det[3] if det else None, "share_pl_pct": _share(det[1], det[3]) if det and det[3] else None}}


def _prazo(con, am):
    rows = con.execute("SELECT faixa, a_vencer, inad, antecipado FROM fidc_prazo WHERE anomes=?", (am,)).fetchall()
    if not rows:
        return None
    d = {f: (av, inad, ant) for f, av, inad, ant in rows}
    av_tot = sum(v[0] for v in d.values())
    inad_tot = sum(v[1] for v in d.values())
    ant_tot = sum(v[2] for v in d.values())
    if av_tot <= 0:
        return None
    det = con.execute("SELECT n_fundos_prazo, a_vencer_prazo, n_fundos_tab1, carteira_tab1 FROM fidc_detalhe WHERE anomes=?", (am,)).fetchone()
    faixas = [{"id": f, "nome": NOMES_PRAZO[f], "dias_fim": dias, "a_vencer": d[f][0], "share_pct": _share(d[f][0], av_tot),
               "inad": d[f][1], "inad_share_pct": _share(d[f][1], inad_tot) if inad_tot else None} for f, dias in PRAZOS if f in d]
    ate = lambda lim: sum(d[f][0] for f, dias in PRAZOS if f in d and dias is not None and dias <= lim)
    return {"faixas": faixas, "a_vencer": av_tot, "inad": inad_tot, "antecipado": ant_tot,
            "curto_180_pct": _share(ate(180), av_tot), "ate_360_pct": _share(ate(360), av_tot),
            "longo_1080_pct": _share(d.get("MAIOR_1080", (0, 0, 0))[0], av_tot),
            "inad_sobre_a_vencer_pct": _share(inad_tot, av_tot + inad_tot),
            "inad_acima_90_share_pct": _share(sum(d[f][1] for f, dias in PRAZOS if f in d and (dias is None or dias > 90)), inad_tot) if inad_tot else None,
            "cobertura": {"n_fundos": det[0] if det else None, "n_fundos_total": det[2] if det else None, "a_vencer": det[1] if det else av_tot,
                          "share_fundos_pct": _share(det[0], det[2]) if det and det[2] else None}}


def build(con, cfg=None):
    ser = serie_fidc(con)
    if not ser:
        return {"disponivel": False, "motivo": "fidc_agg vazia: informes da CVM ainda não coletados"}
    try:
        com_detalhe = {r[0] for r in con.execute("SELECT anomes FROM fidc_detalhe").fetchall()}
    except Exception:
        com_detalhe = set()
    fechados = [p for p in ser if not p["parcial"] and _am(p["mes"]) in com_detalhe]
    if not fechados:
        return {"disponivel": False, "motivo": "nenhum mês fechado com detalhe por lastro, classe e prazo (o coletor faz o backfill na próxima execução)"}
    ult = fechados[-1]
    am = _am(ult["mes"])
    am12 = _am_menos(am, 12)
    am12 = am12 if am12 in com_detalhe else None
    lastro, classes, prazo = _lastro(con, am, am12), _classes(con, am, am12), _prazo(con, am)

    # série enriquecida com subordinação e peso do lastro financeiro, mês a mês
    sub_por_mes = {}
    for a, c, pl in con.execute("SELECT anomes, classe, pl FROM fidc_classe WHERE classe != ?", (MONO,)).fetchall():
        sub_por_mes.setdefault(a, {})[c] = pl
    fin_por_mes = {}
    for a, cat, v in con.execute("SELECT anomes, cat, valor FROM fidc_lastro").fetchall():
        fin_por_mes.setdefault(a, {})[cat] = v
    serie = []
    for p in ser[-36:]:
        a = _am(p["mes"])
        sp = sub_por_mes.get(a)
        fp = fin_por_mes.get(a)
        base = sum(fp.get(c, 0.0) for c, _cc, _n, pai in LASTRO if pai is None) if fp else 0
        serie.append({**p,
                      "subordinacao_pct": _share(sp.get("mezanino", 0.0) + sp.get("subordinada", 0.0), sum(sp.values())) if sp else None,
                      "senior_pct": _share(sp.get("senior", 0.0), sum(sp.values())) if sp else None,
                      "financeiro_pct": _share(fp.get("F", 0.0), base) if fp and base else None,
                      "comercial_pct": _share(fp.get("C", 0.0), base) if fp and base else None})

    top = lastro["grupos"][0] if lastro and lastro["grupos"] else None
    fin = next((g for g in lastro["grupos"] if g["id"] == "F"), None) if lastro else None
    fsub = sorted(fin["sub"], key=lambda s: -s["valor"])[:2] if fin else []
    sintese = (f"Em {ult['mes']}, {_mil(ult['n_fundos'])} FIDCs somavam R$ {_dec(ult['carteira'] / 1e9, 0)} bilhões em carteira"
               + (f", com {_dec(ult['inad_pct'], 2)}% em créditos inadimplentes" if ult.get("inad_pct") is not None else "") + ".")
    if lastro and top:
        sintese += (f" Entre os {_mil(lastro['cobertura']['n_fundos'])} fundos que abrem o lastro ({_dec(lastro['cobertura']['share_carteira_pct'], 0)}% da carteira), "
                    f"o maior segmento é {top['nome'].lower()} ({_dec(top['share_pct'], 0)}%)"
                    + (f", puxado por {fsub[0]['nome'].lower()} e {fsub[1]['nome'].lower()}" if top["id"] == "F" and len(fsub) == 2 else "") + ".")
    if classes:
        sintese += (f" Entre os fundos com duas ou mais classes, a subordinação é de {_dec(classes['subordinacao_pct'], 0)}% do PL (mezanino e subordinada)"
                    + (f", {'acima' if classes['d12_subordinacao_pp'] >= 0 else 'abaixo'} de um ano antes em {_dec(abs(classes['d12_subordinacao_pp']))} p.p." if classes.get("d12_subordinacao_pp") is not None else "")
                    + (f"; {_dec(classes['monoclasse']['share_pl_pct'], 0)}% do PL está em fundos de classe única, sem subordinação." if classes.get("monoclasse") else "."))
    if prazo:
        sintese += (f" Nos fundos que informam prazos, {_dec(prazo['curto_180_pct'], 0)}% dos direitos creditórios vencem em até 180 dias e "
                    f"{_dec(prazo['inad_acima_90_share_pct'], 0)}% das parcelas inadimplentes têm mais de 90 dias de atraso.")
    return {
        "disponivel": True, "tipo": "DADO OBSERVADO (informes CVM) + CALCULADO (agregação, shares, subordinação, variações)",
        "mes": ult["mes"], "anomes": am, "mes_12m": _mes(am12) if am12 else None, "meses_parciais": [p["mes"] for p in ser if p["parcial"]],
        "fonte": FONTE, "gerado_em": common.now_utc(),
        "sistema": {"n_fundos": ult["n_fundos"], "carteira": ult["carteira"], "inad_pct": ult["inad_pct"], "parcelas_inad_pct": ult["parcelas_inad_pct"],
                    "a_vencer_pct": ult["a_vencer_pct"], "pl_total": classes["cobertura"]["pl_total"] if classes else None},
        "lastro": lastro, "classes": classes, "prazo": prazo, "serie": serie,
        "sintese": sintese,
        "metodo": ("Informes mensais de FIDC da CVM agregados entre fundos. Sistema: tab I, fundos com carteira maior que zero. Lastro: tab II, "
                   "onze grupos e subitens com os nomes do dicionário da CVM; shares sobre a carteira informada na tabela. Classes: tab X.2 "
                   "(quantidade × valor da cota por classe e série, classificadas pelo texto em sênior, mezanino, subordinada e única), só de "
                   "fundos cuja soma fecha com o PL da tab IV em ±20% e só entre fundos com duas ou mais classes; fundos de classe única "
                   "ficam numa linha própria; subordinação = mezanino + subordinada ÷ PL dos multiclasse. Inadimplência do sistema = créditos "
                   "existentes inadimplentes (I.2.a.3 e I.2.b.3) ÷ carteira. Prazos: tab VI, "
                   "direitos creditórios a vencer por faixa e parcelas inadimplentes por faixa de atraso, entre os fundos que a informam. "
                   "Mês com menos de 90% dos fundos do mês anterior é parcial e fica fora dos KPIs; variações contra o mesmo mês do ano anterior."),
        "limitacoes": ("Cada tabela tem cobertura própria e os shares valem só para a base coberta: o lastro cobre cerca de três quartos dos fundos, "
                       "os prazos cerca de um quarto. 'Outros financeiros' é a maior categoria do lastro e a CVM não a abre. Não há corte por "
                       "administrador, gestor, cedente ou UF. Classes com texto fora do padrão caem em 'outra'."),
        "cautelas": [
            "Atraso não é perda: a subordinação e as garantias de cada estrutura absorvem parte da inadimplência antes de atingir o cotista sênior.",
            "Subordinação do sistema é média ponderada pelo PL entre fundos com duas ou mais classes; um fundo pode ter 5% ou 50%. Não avalia risco de nenhum fundo.",
            "A carteira dos FIDCs não se soma ao crédito do SCR: parte dos direitos creditórios é cedida por bancos e já esteve no SCR.",
        ],
        "catalogo": [
            {"nome": "Carteira", "definicao": "direitos creditórios na carteira dos fundos", "unidade": "R$", "fonte": "CVM tab I (TAB_I2_VL_CARTEIRA)", "limitacoes": "fundos com carteira > 0"},
            {"nome": "Inadimplência", "definicao": "créditos existentes inadimplentes ÷ carteira", "unidade": "%", "fonte": "CVM tab I (I.2.a.3 + I.2.b.3)", "limitacoes": "atraso, não perda"},
            {"nome": "A vencer com parcelas inadimplentes", "definicao": "créditos a vencer que já têm parcela em atraso ÷ carteira", "unidade": "%", "fonte": "CVM tab I (I.2.a.2 + I.2.b.2)", "limitacoes": "era chamada de inadimplência até 06/09/2026"},
            {"nome": "Lastro", "definicao": "carteira por segmento do direito creditório", "unidade": "R$ e % da base coberta", "fonte": "CVM tab II", "limitacoes": "cobertura declarada"},
            {"nome": "Classes de cota", "definicao": "PL por classe = quantidade × valor da cota", "unidade": "R$ e % do PL válido", "fonte": "CVM tab X.2 e tab IV", "limitacoes": "só fundos com soma ≈ PL"},
            {"nome": "Subordinação", "definicao": "mezanino + subordinada ÷ PL dos fundos com 2+ classes", "unidade": "%", "fonte": "calculado", "limitacoes": "média do sistema; classe única fora"},
            {"nome": "Prazo dos direitos creditórios", "definicao": "a vencer por faixa; inadimplentes por faixa de atraso", "unidade": "R$ e %", "fonte": "CVM tab VI", "limitacoes": "cobertura menor"},
        ],
    }
