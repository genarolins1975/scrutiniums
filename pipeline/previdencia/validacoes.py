"""Validações que retêm a publicação do painel Previdência e INSS.

Cada função devolve a lista de problemas (vazia quando está tudo certo). A coleta não grava o seed se a lista não vier
vazia; a construção da gold roda as mesmas funções e a conferência cruzada, e não grava nada se reprovar (o motor de
atualização mantém no ar a publicação anterior). Os testes do pipeline rodam as mesmas funções sobre os seeds
versionados.

O que reprova:
- BEPS: meses fora de sequência ou faltando na série mensal; total que não fecha com a soma dos grupos; tabela 15 com
  linhas renomeadas, fora de ordem, a mais ou a menos, ou com partes que não somam o todo; tabela 19 sem as 27 UFs, com
  UFs que não somam o Brasil, ou com o Brasil longe do RGPS da tabela 15 (a diferença são os créditos sem localização);
  valor médio fora da faixa plausível;
- municípios: menos ou mais municípios que o esperado, código que não é de UF, quantidade ausente, negativa ou que não
  fecha (aposentadorias com os três tipos, previdenciários com os quatro grupos, total com previdenciários e
  assistenciais), valor total que não fecha com os grupos, total diferente da linha BRASIL publicada, ano faltando na
  série desde 2019, e revisão de ano fechado acima de 1% no total do Brasil;
- RTN: anos faltando desde 1997, último ano completo velho demais, linha ausente, divisão urbana e rural que não soma o
  total, conta em % do PIB que não confere com a publicada pelo Tesouro, benefícios fora da faixa de % do PIB, e revisão
  de ano fechado acima de 2% numa linha;
- cruzada: em cada dezembro, a soma dos municípios tem de ser igual à quantidade e ao valor da série do BEPS.
"""
from __future__ import annotations

from datetime import date

from . import fontes as F


def _num(x) -> bool:
    return isinstance(x, (int, float)) and not isinstance(x, bool)


def mes_seguinte(m: str) -> str:
    a, mm = int(m[:4]), int(m[5:])
    return f"{a + (mm == 12)}-{1 if mm == 12 else mm + 1:02d}"


def _perto(a, b, rel=1e-6, abs_=0.5) -> bool:
    return _num(a) and _num(b) and abs(a - b) <= max(abs_, rel * max(abs(a), abs(b)))


# ------------------------------------------------------------------------------------------------------- BEPS


def validar_beps(seed: dict, anterior: dict | None = None) -> list[str]:
    p: list[str] = []
    ref = seed.get("referencia")
    if not isinstance(ref, str) or len(ref) != 7:
        return ["BEPS sem mês de referência"]
    serie = (seed.get("tabela14") or {}).get("serie") or []
    if not serie:
        return ["BEPS sem a série da tabela 14"]
    meses = [x["mes"] for x in serie]
    if serie[-1]["mes"] != ref:
        p.append(f"tabela 14 termina em {serie[-1]['mes']}, referência {ref}")
    mensal = [m for m in meses if m >= "2008-01"]
    if not mensal or mensal[0] != "2008-01":
        p.append("série mensal da tabela 14 não começa em janeiro de 2008")
    for a, b in zip(mensal, mensal[1:]):
        if b != mes_seguinte(a):
            p.append(f"tabela 14: mês faltando entre {a} e {b}")
    anuais = [m for m in meses if m < "2008-01"]
    if anuais and (any(not m.endswith("-12") for m in anuais) or [int(m[:4]) for m in anuais] != list(range(int(anuais[0][:4]), 2008))):
        p.append("tabela 14: dezembros anteriores a 2008 fora de sequência")
    for x in serie:
        q, v = x["q"], x["v"]
        if any(not _num(q.get(g)) or q[g] < 0 for g in ("total", "rgps", "assist", "ble")):
            p.append(f"tabela 14, {x['mes']}: quantidade ausente ou negativa")
            continue
        if q["total"] != q["rgps"] + q["assist"] + q["ble"]:
            p.append(f"tabela 14, {x['mes']}: quantidade total não fecha com os grupos")
        if any(not _num(v.get(g)) for g in ("total", "rgps", "assist", "ble")) or not _perto(v["total"], v["rgps"] + v["assist"] + v["ble"], abs_=1.0):
            p.append(f"tabela 14, {x['mes']}: valor total ausente ou não fecha com os grupos")
        elif not x.get("abono"):
            for g in ("rgps", "assist"):
                medio = v[g] / q[g] if q[g] else None
                if medio is None or not (F.FAIXA_VALOR_MEDIO[0] * (0.1 if x["mes"] < "2008-01" else 1) <= medio <= F.FAIXA_VALOR_MEDIO[1]):
                    p.append(f"tabela 14, {x['mes']}: valor médio {g} fora da faixa ({medio})")

    linhas = (seed.get("tabela15") or {}).get("linhas") or []
    from .coleta import normalizar  # sem rede: só a normalização de rótulos

    rotulos = [normalizar(l["rotulo"]) for l in linhas]
    esperados = [r for _i, r, _p in F.TABELA_15]
    if rotulos != esperados:
        p.append(f"tabela 15 com linhas diferentes das esperadas: {rotulos}")
    else:
        por_id = {i: l for (i, _r, _p), l in zip(F.TABELA_15, linhas)}
        for i, _r, _p in F.TABELA_15:
            l = por_id[i]
            if not _num(l.get("q")) or not _num(l.get("v")):
                p.append(f"tabela 15, {i}: quantidade ou valor ausente")
            elif _num(l.get("q_urbana")) and _num(l.get("q_rural")) and l["q"] != l["q_urbana"] + l["q_rural"]:
                p.append(f"tabela 15, {i}: urbana e rural não somam o total")
        filhos: dict[str, list[str]] = {}
        for i, _r, pai in F.TABELA_15:
            if pai:
                filhos.setdefault(pai, []).append(i)
        for pai, fs in filhos.items():
            if all(_num(por_id[f].get("q")) for f in fs) and _num(por_id[pai].get("q")):
                if sum(por_id[f]["q"] for f in fs) != por_id[pai]["q"]:
                    p.append(f"tabela 15: as partes de {pai} não somam o todo")
                if not _perto(sum(por_id[f]["v"] for f in fs), por_id[pai]["v"], abs_=2.0):
                    p.append(f"tabela 15: os valores das partes de {pai} não somam o todo")
        if serie and serie[-1]["mes"] == ref and _num(por_id["total"].get("q")):
            u = serie[-1]
            if por_id["total"]["q"] != u["q"]["total"] or por_id["rgps"]["q"] != u["q"]["rgps"] or por_id["ble"]["q"] != u["q"]["ble"]:
                p.append("tabela 15 e tabela 14 com quantidades diferentes no mês de referência")

    t19 = seed.get("tabela19") or {}
    ufs = t19.get("ufs") or {}
    if sorted(ufs) != sorted(F.SIGLAS):
        p.append(f"tabela 19 sem as 27 UFs (tem {len(ufs)})")
    br = t19.get("brasil") or {}
    if ufs and _num(br.get("q")):
        if sum(u.get("q") or 0 for u in ufs.values()) != br["q"]:
            p.append("tabela 19: as UFs não somam o Brasil em quantidade")
        if not _perto(sum(u.get("v") or 0 for u in ufs.values()), br["v"], abs_=5.0):
            p.append("tabela 19: as UFs não somam o Brasil em valor")
        for s, u in ufs.items():
            if not all(_num(u.get(k)) for k in ("q", "v", "q_urbana", "q_rural", "v_urbana", "v_rural")):
                p.append(f"tabela 19, {s}: campo ausente")
                continue
            if u["q"] != u["q_urbana"] + u["q_rural"]:
                p.append(f"tabela 19, {s}: urbana e rural não somam o total")
            medio = u["v"] / u["q"] if u["q"] else None
            if medio is None or not (F.FAIXA_VALOR_MEDIO[0] <= medio <= F.FAIXA_VALOR_MEDIO[1]):
                p.append(f"tabela 19, {s}: valor médio fora da faixa")
        if rotulos == esperados:
            rgps15 = linhas[1]["q"]
            dif = rgps15 - br["q"]
            if not (0 <= dif <= 1000):
                p.append(f"tabela 19: Brasil ({br['q']}) longe do RGPS da tabela 15 ({rgps15})")
    else:
        p.append("tabela 19 sem a linha BRASIL")

    if anterior and anterior.get("referencia") and ref < anterior["referencia"]:
        p.append(f"BEPS novo ({ref}) é mais antigo que o publicado ({anterior['referencia']})")
    return p


# ------------------------------------------------------------------------------------------- municípios


def validar_municipios(seed: dict, anterior: dict | None = None, hoje: date | None = None) -> list[str]:
    p: list[str] = []
    anos = seed.get("anos") or []
    if not anos:
        return ["seed municipal sem anos"]
    lista = [a["ano"] for a in anos]
    if lista != list(range(F.PRIMEIRO_ANO_MUNICIPIOS, lista[-1] + 1)):
        p.append(f"anos do arquivo municipal fora de sequência: {lista}")
    hoje = hoje or date.today()
    if lista[-1] < hoje.year - 2:
        p.append(f"último ano municipal ({lista[-1]}) velho demais")
    nq, nv = len(F.CAMPOS_Q), len(F.CAMPOS_V)
    for a in anos:
        mun = a.get("municipios") or {}
        ano = a["ano"]
        if not (F.MUNICIPIOS_MIN <= len(mun) <= F.MUNICIPIOS_MAX):
            p.append(f"{ano}: {len(mun)} municípios")
        soma_q, soma_v = 0, 0.0
        for cod, linha in mun.items():
            if len(cod) != 7 or not cod.isdigit() or cod[:2] not in F.UF_DO_PREFIXO:
                p.append(f"{ano}: código inválido {cod}")
                continue
            nome, q, v, tq, tv, apos, prev = linha
            if not nome:
                p.append(f"{ano}, {cod}: sem nome")
            if len(q) != nq or len(v) != nv or any(not _num(x) or x < 0 for x in q + v) or not all(_num(x) for x in (tq, tv, apos, prev)):
                p.append(f"{ano}, {cod}: campo ausente ou negativo")
                continue
            idade, inval, tempo, pens, aux, outros, assist = q
            if apos != idade + inval + tempo:
                p.append(f"{ano}, {cod}: aposentadorias não fecham com os três tipos")
            if prev != apos + pens + aux + outros:
                p.append(f"{ano}, {cod}: previdenciários não fecham com os grupos")
            if tq != prev + assist:
                p.append(f"{ano}, {cod}: total não fecha com previdenciários e assistenciais")
            if not _perto(tv, sum(v), abs_=0.05):
                p.append(f"{ano}, {cod}: valor total não fecha com os grupos")
            soma_q += tq
            soma_v += tv
        br = a.get("brasil_publicado") or {}
        if _num(br.get("q")) and soma_q != br["q"]:
            p.append(f"{ano}: soma dos municípios ({soma_q}) diferente da linha BRASIL ({br['q']})")
        if _num(br.get("v")) and not _perto(soma_v, br["v"], abs_=5.0):
            p.append(f"{ano}: soma dos valores diferente da linha BRASIL")
    if anterior:
        antes = {a["ano"]: a for a in anterior.get("anos") or []}
        for a in anos:
            b = antes.get(a["ano"])
            if not b:
                continue
            tq_novo = sum(l[3] or 0 for l in a["municipios"].values())
            tq_antes = sum(l[3] or 0 for l in b["municipios"].values())
            if tq_antes and abs(tq_novo - tq_antes) / tq_antes > F.REVISAO_MAXIMA_MUNICIPIOS:
                p.append(f"{a['ano']}: revisão de {100 * (tq_novo - tq_antes) / tq_antes:.2f}% no total do Brasil")
        if set(antes) - {a["ano"] for a in anos}:
            p.append(f"anos que sumiram da fonte: {sorted(set(antes) - {a['ano'] for a in anos})}")
    return p


# ---------------------------------------------------------------------------------------------------- RTN


def validar_rtn(seed: dict, anterior: dict | None = None, hoje: date | None = None) -> list[str]:
    p: list[str] = []
    anos = seed.get("anos") or []
    if not anos:
        return ["RTN sem anos"]
    if anos != list(range(F.PRIMEIRO_ANO_RTN, anos[-1] + 1)):
        p.append(f"anos do RTN fora de sequência: {anos[0]} a {anos[-1]}")
    hoje = hoje or date.today()
    if anos[-1] < hoje.year - 2:
        p.append(f"último ano completo do RTN ({anos[-1]}) velho demais")
    L = seed.get("linhas") or {}
    for k in F.LINHAS_RTN:
        if k not in L or len(L[k]) != len(anos):
            p.append(f"RTN: linha {k} ausente ou incompleta")
    if p:
        return p
    pib = seed.get("pib") or []
    pct = seed.get("pct_pib_publicado") or {}
    for i, ano in enumerate(anos):
        arr, ben = L["arrecadacao"][i], L["beneficios"][i]
        if not _num(arr) or not _num(ben) or arr <= 0 or ben <= 0:
            p.append(f"RTN {ano}: arrecadação ou benefícios ausentes")
            continue
        for tot, partes in (("arrecadacao", ("arrecadacao_urbana", "arrecadacao_rural")), ("beneficios", ("beneficios_urbano", "beneficios_rural"))):
            a, b = L[partes[0]][i], L[partes[1]][i]
            if _num(a) and _num(b) and (a or b) and abs(a + b - L[tot][i]) > 0.5:
                p.append(f"RTN {ano}: {tot} urbano e rural não somam o total")
        if not _num(pib[i]) or pib[i] <= 0:
            p.append(f"RTN {ano}: PIB ausente")
            continue
        for k in ("arrecadacao", "beneficios"):
            pub = (pct.get(k) or [None] * len(anos))[i]
            if not _num(pub) or abs(100 * L[k][i] / pib[i] - pub) > 0.01:
                p.append(f"RTN {ano}: {k} em % do PIB não confere com a publicada ({pub})")
        b_pib = 100 * ben / pib[i]
        if not (F.FAIXA_BENEFICIOS_PIB[0] <= b_pib <= F.FAIXA_BENEFICIOS_PIB[1]):
            p.append(f"RTN {ano}: benefícios em {b_pib:.2f}% do PIB, fora da faixa")
    if anterior and anterior.get("anos"):
        ia = {a: i for i, a in enumerate(anterior["anos"])}
        for k in ("arrecadacao", "beneficios", "bpc_rmv"):
            for i, ano in enumerate(anos):
                j = ia.get(ano)
                if j is None or ano == anos[-1]:
                    continue
                novo, velho = L[k][i], (anterior.get("linhas") or {}).get(k, [None] * (j + 1))[j]
                if _num(novo) and _num(velho) and velho and abs(novo - velho) / abs(velho) > F.REVISAO_MAXIMA_RTN:
                    p.append(f"RTN {ano}: {k} revisto em {100 * (novo - velho) / velho:.1f}%")
        if anos[-1] < anterior["anos"][-1]:
            p.append("RTN novo termina antes do publicado")
    return p


# ---------------------------------------------------------------------------------------------- cruzada


def validar_cruzado(beps: dict, municipios: dict) -> list[str]:
    """Cada dezembro do arquivo municipal tem de fechar com a série do BEPS: quantidade exata, valor a R$ 0,001%."""
    p: list[str] = []
    serie = {x["mes"]: x for x in (beps.get("tabela14") or {}).get("serie") or []}
    for a in municipios.get("anos") or []:
        x = serie.get(f"{a['ano']}-12")
        if not x:
            p.append(f"BEPS sem dezembro de {a['ano']} para conferir o arquivo municipal")
            continue
        linhas = a["municipios"].values()
        tq = sum(l[3] or 0 for l in linhas)
        tv = sum(l[4] or 0 for l in linhas)
        prev = sum(l[6] or 0 for l in linhas)
        if tq != x["q"]["total"]:
            p.append(f"dezembro de {a['ano']}: municípios somam {tq} benefícios, o BEPS publica {x['q']['total']:.0f}")
        if prev != x["q"]["rgps"]:
            p.append(f"dezembro de {a['ano']}: municípios somam {prev} benefícios do RGPS, o BEPS publica {x['q']['rgps']:.0f}")
        if not _perto(tv, x["v"]["total"], rel=1e-5):
            p.append(f"dezembro de {a['ano']}: valor dos municípios ({tv:.2f}) diferente do BEPS ({x['v']['total']:.2f})")
    return p
