"""Indicadores de dívida e alavancagem a partir das contas padronizadas da DFP e do ITR.

Definições (todas sobre a demonstração consolidada; a individual só quando a companhia não publicou consolidada naquela
data, o que acontece quando não há controladas a consolidar):

- dívida bruta: empréstimos e financiamentos (2.01.04.01 e 2.02.01.01) mais debêntures (2.01.04.02 e 2.02.01.02),
  circulante e não circulante. O financiamento por arrendamento (2.01.04.03 e 2.02.01.03) fica de fora e é mostrado à
  parte; quando a companhia não abre a linha 2.01.04 ou 2.02.01 nas subcontas, o total da linha entra e o ponto é
  marcado ("sem abertura");
- caixa e aplicações: caixa e equivalentes (1.01.01) mais aplicações financeiras do circulante (1.01.02);
- dívida líquida: dívida bruta menos caixa e aplicações;
- EBITDA: resultado antes do resultado financeiro e dos tributos (3.05) mais depreciação, amortização e exaustão da
  demonstração do valor adicionado (7.04.01, em módulo). Equivale ao LAJIDA da Resolução CVM 156/2022, sem ajustes de
  itens não recorrentes. No trimestre, soma dos últimos 12 meses: acumulado do ano, mais o exercício anterior (DFP),
  menos o acumulado do mesmo período do ano anterior (comparativo do próprio ITR);
- dívida líquida sobre EBITDA (vezes): só com EBITDA positivo;
- dívida líquida sobre patrimônio líquido (vezes): patrimônio líquido total (2.03, com os não controladores no
  consolidado), só quando positivo;
- parcela da dívida que vence em até 12 meses (%): parte circulante da dívida bruta sobre a dívida bruta;
- cobertura das despesas financeiras (vezes): EBITDA sobre as despesas financeiras da DRE (3.06.02, em módulo), que
  incluem juros, variação monetária e cambial e outras despesas: não é a cobertura de juros em sentido estrito.

Ausência é ausência: conta faltando, denominador não positivo ou período sem a demonstração anterior devolvem None com
o motivo, nunca zero.
"""
from __future__ import annotations

import datetime as dt

from . import fontes as F


def valor(l: dict) -> float:
    """VL_CONTA em milhares de reais."""
    v = float(l["VL_CONTA"])
    return v if l["ESCALA_MOEDA"] == "MIL" else v / 1000.0


def tolerancia(l_ref: dict | None, total: float) -> float:
    unid = 1.0 if (l_ref or {}).get("ESCALA_MOEDA", "MIL") == "MIL" else 0.001
    return max(F.TOLERANCIA_ESCALA * unid, abs(total) * F.TOLERANCIA_RELATIVA)


def agrupar(linhas: list[dict]) -> dict:
    """{(cnpj, fonte, dt_refer, escopo): {"bal": {conta: v}, "res": {(ordem, dt_ini): {conta: v}}, "escala": ...}}."""
    g: dict = {}
    for l in linhas:
        k = (l["CNPJ_CIA"], l["fonte"], l["DT_REFER"], l["escopo"])
        r = g.setdefault(k, {"bal": {}, "res": {}, "versao": int(l["VERSAO"]), "escala": l["ESCALA_MOEDA"], "fim": {}})
        if l["demonstracao"] in ("BPA", "BPP"):
            r["bal"][l["CD_CONTA"]] = valor(l)
            r["fim"]["bal"] = l["DT_FIM_EXERC"]
        else:
            chave = (l["ORDEM_EXERC"], l["DT_INI_EXERC"])
            r["res"].setdefault(chave, {})[l["CD_CONTA"]] = valor(l)
            r["fim"][chave] = l["DT_FIM_EXERC"]
    return g


def escopo_da_data(g: dict, cnpj: str, fonte: str, data: str) -> str | None:
    """Consolidado quando publicado (com balanço); senão o individual."""
    for esc in F.ESCOPOS:
        r = g.get((cnpj, fonte, data, esc))
        if r and r["bal"].get("1") is not None:
            return esc
    return None


def _soma(d: dict, *contas) -> float | None:
    vs = [d.get(c) for c in contas]
    return None if any(v is None for v in vs) else sum(vs)


def divida(bal: dict) -> dict:
    """Componentes da dívida de um balanço (milhares de reais) e a marca de abertura."""
    out = {"sem_abertura": []}
    for prazo, pai in (("cp", "2.01.04"), ("lp", "2.02.01")):
        emp, deb, arr, total = (bal.get(f"{pai}.01"), bal.get(f"{pai}.02"), bal.get(f"{pai}.03"), bal.get(pai))
        if all(not x for x in (emp, deb, arr)) and total:
            # subcontas ausentes ou zeradas com a linha total preenchida: a companhia não abriu a linha
            out[f"emprestimos_{prazo}"] = None
            out[f"debentures_{prazo}"] = None
            out[f"arrendamento_{prazo}"] = None
            out[f"divida_{prazo}"] = total
            out["sem_abertura"].append(pai)
        elif emp is None and deb is None and arr is None:
            out[f"emprestimos_{prazo}"] = None
            out[f"debentures_{prazo}"] = None
            out[f"arrendamento_{prazo}"] = None
            out[f"divida_{prazo}"] = total
            out["sem_abertura"].append(pai)
        else:
            out[f"emprestimos_{prazo}"] = emp or 0.0
            out[f"debentures_{prazo}"] = deb or 0.0
            out[f"arrendamento_{prazo}"] = arr or 0.0
            out[f"divida_{prazo}"] = (emp or 0.0) + (deb or 0.0)
    cp, lp = out["divida_cp"], out["divida_lp"]
    out["divida_bruta"] = None if cp is None or lp is None else cp + lp
    return out


def razao(num, den, *, motivo_den: str) -> tuple[float | None, str | None]:
    if num is None or den is None:
        return None, "conta ausente na demonstração publicada"
    if den <= 0:
        return None, motivo_den
    return num / den, None


def ponto(bal: dict, ebitda: float | None, desp_fin: float | None, motivo_ebitda: str | None, motivo_desp: str | None = None) -> dict:
    """Indicadores de um ponto (balanço numa data e resultado de 12 meses terminados nela)."""
    d = divida(bal)
    caixa = _soma(bal, "1.01.01", "1.01.02")
    dl = None if d["divida_bruta"] is None or caixa is None else d["divida_bruta"] - caixa
    pl = bal.get("2.03")
    p = {
        "ativo_total": bal.get("1"),
        "divida_bruta": d["divida_bruta"],
        "divida_cp": d["divida_cp"],
        "divida_lp": d["divida_lp"],
        "emprestimos": None if d["sem_abertura"] else _soma(d, "emprestimos_cp", "emprestimos_lp"),
        "debentures": None if d["sem_abertura"] else _soma(d, "debentures_cp", "debentures_lp"),
        "arrendamento": None if d["sem_abertura"] else _soma(d, "arrendamento_cp", "arrendamento_lp"),
        "sem_abertura": d["sem_abertura"],
        "caixa": caixa,
        "divida_liquida": dl,
        "patrimonio_liquido": pl,
        "ebitda": ebitda,
        "despesas_financeiras": desp_fin,
        "motivos": {},
    }
    if ebitda is None:
        p["motivos"]["ebitda"] = motivo_ebitda or "resultado ou depreciação ausente na demonstração"
    if ebitda is None:
        v, m = None, p["motivos"]["ebitda"]
    else:
        v, m = razao(dl, ebitda, motivo_den="EBITDA negativo ou nulo: a razão não tem leitura")
    p["dl_ebitda"] = v
    if m:
        p["motivos"]["dl_ebitda"] = m
    v, m = razao(dl, pl, motivo_den="patrimônio líquido negativo ou nulo: a razão não tem leitura")
    p["dl_pl"] = v
    if m:
        p["motivos"]["dl_pl"] = m
    v, m = razao(d["divida_cp"], d["divida_bruta"], motivo_den="sem dívida bruta")
    if v is not None and v < 0:
        v, m = None, "parte circulante da dívida publicada negativa: a parcela não tem leitura"
    p["parcela_cp"] = None if v is None else v * 100
    if m:
        p["motivos"]["parcela_cp"] = m
    if ebitda is None or desp_fin is None:
        p["cobertura"] = None
        p["motivos"]["cobertura"] = p["motivos"].get("ebitda") or motivo_desp or "despesas financeiras ausentes na demonstração"
    elif ebitda <= 0:
        p["cobertura"] = None
        p["motivos"]["cobertura"] = "EBITDA negativo ou nulo: a razão não tem leitura"
    elif desp_fin == 0:
        p["cobertura"] = None
        p["motivos"]["cobertura"] = "despesas financeiras declaradas como zero"
    else:
        p["cobertura"] = ebitda / abs(desp_fin)
    return p


SEM_ABERTURA_FINANCEIRA = "a companhia publicou só o resultado financeiro líquido, sem separar receitas e despesas financeiras"


def ebitda_de(res: dict) -> tuple[float | None, float | None]:
    """EBITDA e despesas financeiras de um bloco de resultado (milhares de reais).

    Despesas financeiras ficam None quando a companhia zera receitas e despesas financeiras e publica só o resultado
    financeiro líquido (3.06): zero ali não é ausência de despesa."""
    ebit, da, df = res.get("3.05"), res.get("7.04.01"), res.get("3.06.02")
    e = None if ebit is None or da is None else ebit + abs(da)
    if df is not None and not df and not res.get("3.06.01") and res.get("3.06"):
        df = None
    return e, (None if df is None else abs(df))


def motivo_despesas(*blocos: dict) -> str:
    for res in blocos:
        if not res.get("3.06.02") and not res.get("3.06.01") and res.get("3.06"):
            return SEM_ABERTURA_FINANCEIRA
    return "despesas financeiras ausentes na demonstração"


def _ini_ano(data: str) -> str:
    return data[:4] + "-01-01"


def _exercicio(r: dict) -> tuple[str | None, dict]:
    """Início e contas do resultado do exercício (ÚLTIMO) de uma DFP."""
    for (ordem, ini), v in r["res"].items():
        if ordem == "ÚLTIMO":
            return ini, v
    return None, {}


def anual(g: dict, cnpj: str, data: str) -> dict | None:
    esc = escopo_da_data(g, cnpj, "DFP", data)
    if esc is None:
        return None
    r = g[(cnpj, "DFP", data, esc)]
    ini, res = _exercicio(r)
    e, df = ebitda_de(res)
    p = ponto(r["bal"], e, df, None, motivo_despesas(res))
    p.update({"data": data, "periodo": data[:4], "fonte": "DFP", "escopo": esc, "versao": r["versao"], "inicio_resultado": ini})
    if ini is not None and ini != _ini_ano(data) and e is not None:
        # exercício menor que 12 meses (companhia constituída no ano): o EBITDA vale para o período, a razão anual não
        p["dl_ebitda"] = None
        p["motivos"]["dl_ebitda"] = f"exercício de {ini} a {data}, menor que 12 meses: a razão sobre o EBITDA não tem base anual"
    return p


def trimestral(g: dict, cnpj: str, data: str) -> dict | None:
    """Ponto do ITR com EBITDA dos últimos 12 meses."""
    esc = escopo_da_data(g, cnpj, "ITR", data)
    if esc is None:
        return None
    r = g[(cnpj, "ITR", data, esc)]
    ano = int(data[:4])
    atual = r["res"].get(("ÚLTIMO", _ini_ano(data)), {})
    anterior_ytd = r["res"].get(("PENÚLTIMO", f"{ano - 1}-01-01"), {})
    dez = f"{ano - 1}-12-31"
    rd = g.get((cnpj, "DFP", dez, esc))
    ini_ex, exercicio = _exercicio(rd) if rd else (None, {})
    e_at, df_at = ebitda_de(atual)
    e_ant, df_ant = ebitda_de(anterior_ytd)
    e_ex, df_ex = ebitda_de(exercicio)
    motivo = None
    if rd is None:
        motivo = f"sem a DFP de {ano - 1} no mesmo escopo: os 12 meses não se completam"
    elif ini_ex != f"{ano - 1}-01-01":
        motivo = f"exercício de {ano - 1} menor que 12 meses: os 12 meses não se completam"
        e_ex = df_ex = None
    if None in (e_at, e_ant, e_ex):
        e12 = None
        motivo = motivo or "resultado ou depreciação ausente em uma das três demonstrações dos 12 meses"
    else:
        e12 = e_at + e_ex - e_ant
    df12 = None if None in (df_at, df_ant, df_ex) else df_at + df_ex - df_ant
    p = ponto(r["bal"], e12, df12, motivo, motivo_despesas(atual, anterior_ytd, exercicio))
    p.update({"data": data, "periodo": trimestre_de(data), "fonte": "ITR", "escopo": esc, "versao": r["versao"], "inicio_resultado": None})
    return p


def periodo_trimestral_de_dfp(p: dict) -> dict:
    """O quarto trimestre da série trimestral é o próprio ponto anual (DFP), com o EBITDA do exercício."""
    q = dict(p)
    q["periodo"] = trimestre_de(p["data"])
    return q


def datas(g: dict, cnpj: str, fonte: str) -> list[str]:
    return sorted({k[2] for k in g if k[0] == cnpj and k[1] == fonte})


def trimestre_de(data: str) -> str:
    d = dt.date.fromisoformat(data)
    return f"{(d.month - 1) // 3 + 1}T{d.year}"
