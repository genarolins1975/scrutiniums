"""Gold do painel Segurança pública por UF (public/eficiencia/seguranca-publica/gold/seguranca.json) e o CSV.

Nada aqui estima um valor que falta. O que a gold calcula, sempre a partir dos seeds:

- contagem anual por UF (soma dos 12 meses do Sinesp VDE; contagem anual do SIM);
- situação de cada UF e ano (regra de ausência abaixo): só "ok" tem valor publicado;
- taxa por 100 mil habitantes (ou por 100 mil mulheres), com a população da Projeção do IBGE do mesmo ano;
- referência nacional: a soma das UFs com valor publicado sobre a população dessas UFs, com a cobertura
  (quantas UFs entraram) declarada ao lado;
- posição de cada UF na ordem decrescente da taxa, diferença para a referência em pontos de taxa e razão;
- variação nacional sobre o ano anterior, só quando as 27 UFs têm valor publicado nos dois anos;
- razão entre o registro policial de homicídio doloso e o registro de óbito por agressão do SIM, por UF;
- participação das mortes de intenção indeterminada nas causas externas (SIM), um sinal da qualidade da
  classificação da causa da morte em cada UF.

Regra de ausência (Sinesp VDE; a base não distingue zero de falta de envio):
- mês sem valor na base: o ano fica "incompleto";
- 12 meses zerados quando o esperado seria de pelo menos fontes.LIMIAR_ANO registros (pela taxa nacional do
  ano ou pela média da própria UF nos anos com registro): "sem registro", ausência e não zero;
- meses zerados num ano com registros, quando a chance de tantos zeros por acaso (Poisson com a média do
  próprio ano) é menor que fontes.PROB_MESES_ZERADOS: o ano fica "incompleto" e o total não é publicado.
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
import math

from . import fontes as F
from .validacoes import _num, anos_completos_vde, validar_seeds

VERSAO = "seguranca-1.0.0"
MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]


class GoldInvalida(ValueError):
    pass


def lista(xs: list[str]) -> str:
    return xs[0] if len(xs) == 1 else ", ".join(xs[:-1]) + " e " + xs[-1]


def milhar(n: float) -> str:
    return f"{n:,.0f}".replace(",", ".")


def media_mensal(m: float) -> str:
    return f"{m:.1f}".replace(".", ",") if m < 10 else milhar(m)


def _pop(ibge: dict, uf: str, ano: int, denominador: str | None) -> int:
    return ibge["populacao"][uf]["mulheres" if denominador == "mulheres" else "total"][str(ano)]


def chance_zerados(z: int, media: float, meses: int = 12) -> float:
    """Chance de z ou mais meses zerados em `meses`, se os registros de cada mês seguissem Poisson com a média dada."""
    p0 = math.exp(-media)
    return sum(math.comb(meses, j) * p0 ** j * (1 - p0) ** (meses - j) for j in range(z, meses + 1))


def situacao_vde(seed: dict, ibge: dict, evento: tuple, anos: list[int]) -> dict:
    """Contagem e situação de cada UF e ano completo de um evento do Sinesp VDE."""
    eid, denominador = evento[0], evento[6]
    bruto: dict[str, dict[int, list]] = {uf: {a: seed["valores"][str(a)][eid][uf] for a in anos} for uf in F.SIGLAS}
    soma = {uf: {a: (None if any(x is None for x in arr) else sum(arr)) for a, arr in pa.items()} for uf, pa in bruto.items()}
    out: dict[str, dict[int, tuple]] = {uf: {} for uf in F.SIGLAS}
    for a in anos:
        com = [uf for uf in F.SIGLAS if soma[uf][a]]
        pop_com = sum(_pop(ibge, uf, a, denominador) for uf in com)
        taxa_nac = sum(soma[uf][a] for uf in com) / pop_com if pop_com else 0
        for uf in F.SIGLAS:
            arr, s = bruto[uf][a], soma[uf][a]
            if s is None:
                vazios = [MESES[k] for k, x in enumerate(arr) if x is None]
                out[uf][a] = (None, "incompleto", f"Mês sem valor na base: {lista(vazios)}. O total do ano não é publicado.")
                continue
            if s == 0:
                outros = [soma[uf][b] for b in anos if b != a and soma[uf][b]]
                propria = sum(outros) / len(outros) if outros else 0
                esperado = max(taxa_nac * _pop(ibge, uf, a, denominador), propria)
                if esperado >= F.LIMIAR_ANO:
                    out[uf][a] = (None, "sem_registro", (
                        f"Nenhum registro nos 12 meses, quando o esperado seria de cerca de {milhar(esperado)} ou mais "
                        "(pela taxa nacional do ano ou pela média da própria UF). Tratado como falta de envio, não como zero."))
                else:
                    out[uf][a] = (0, "ok", None)
                continue
            zerados = [MESES[k] for k, x in enumerate(arr) if x == 0]
            if zerados and chance_zerados(len(zerados), s / 12) < F.PROB_MESES_ZERADOS:
                plural = len(zerados) > 1
                out[uf][a] = (None, "incompleto", (
                    f"{'Meses' if plural else 'Mês'} sem registro ({lista(zerados)}) num ano com média de {media_mensal(s / 12)} por mês: "
                    f"por acaso, a chance de {'tantos meses zerados' if plural else 'um mês zerado'} seria menor que {F.PROB_MESES_ZERADOS:.0%}. "
                    "O total do ano não é publicado."))
                continue
            out[uf][a] = (s, "ok", None)
    return out


def situacao_sim(sim: dict, consulta: str, anos: list[int]) -> dict:
    c = sim["consultas"][consulta]["ufs"]
    return {uf: {a: (c[uf][str(a)], "ok", None) if str(a) in c[uf] else (None, "fora", None) for a in anos} for uf in F.SIGLAS}


def serie(contagens: dict, ibge: dict, anos: list[int], denominador: str | None, casas: int = 2, escala: int = 100_000) -> dict:
    """Taxas, referência nacional, posições e diferenças a partir das contagens e situações por UF."""
    s: dict = {}
    for uf in F.SIGLAS:
        n = [contagens[uf][a][0] for a in anos]
        st = [contagens[uf][a][1] for a in anos]
        mot = [contagens[uf][a][2] for a in anos]
        taxa = None
        if denominador:
            taxa = [None if x is None else round(x / _pop(ibge, uf, a, denominador) * escala, casas) for x, a in zip(n, anos)]
        s[uf] = {"n": n, "situacao": st, "motivo": mot, "taxa": taxa}
    br = {"n": [], "situacao": [], "cobertura": [], "fora": [], "taxa": [] if denominador else None, "variacao": []}
    for k, a in enumerate(anos):
        ok = [uf for uf in F.SIGLAS if s[uf]["situacao"][k] == "ok"]
        fora_fonte = all(s[uf]["situacao"][k] == "fora" for uf in F.SIGLAS)
        total = sum(s[uf]["n"][k] for uf in ok)
        br["cobertura"].append(len(ok))
        br["fora"].append([uf for uf in F.SIGLAS if uf not in ok])
        if fora_fonte or not ok:
            br["n"].append(None)
            br["situacao"].append("fora" if fora_fonte else "sem_registro")
            if denominador:
                br["taxa"].append(None)
            br["variacao"].append(None)
            continue
        br["n"].append(total)
        br["situacao"].append("ok" if len(ok) == len(F.SIGLAS) else "parcial")
        if denominador:
            pop = sum(_pop(ibge, uf, a, denominador) for uf in ok)
            br["taxa"].append(round(total / pop * escala, casas))
        ant = k - 1
        if ant >= 0 and br["situacao"][k] == "ok" and br["situacao"][ant] == "ok" and br["n"][ant]:
            br["variacao"].append(round((total - br["n"][ant]) / br["n"][ant] * 100, 2))
        else:
            br["variacao"].append(None)
    s[F.BRASIL] = br
    if denominador:
        for uf in F.SIGLAS:
            pos, dif, razao = [], [], []
            for k in range(len(anos)):
                t, ref = s[uf]["taxa"][k], br["taxa"][k]
                if t is None or ref is None:
                    pos.append(None), dif.append(None), razao.append(None)
                    continue
                maiores = sum(1 for o in F.SIGLAS if s[o]["taxa"][k] is not None and s[o]["taxa"][k] > t)
                pos.append(maiores + 1)
                dif.append(round(t - ref, casas))
                razao.append(round(t / ref, 4) if ref else None)
            s[uf].update({"posicao": pos, "diferenca": dif, "razao": razao})
        br["comparadas"] = [sum(1 for uf in F.SIGLAS if s[uf]["taxa"][k] is not None) for k in range(len(anos))]
    return s


def construir(seeds: dict) -> dict:
    problemas = validar_seeds(seeds)
    if problemas:
        raise GoldInvalida("publicação retida: " + "; ".join(problemas[:20]) + (f" (e mais {len(problemas) - 20})" if len(problemas) > 20 else ""))
    vde, sim, ibge = seeds["sinesp"], seeds["sim"], seeds["ibge"]
    anos_vde = anos_completos_vde(vde)
    anos_sim = list(sim["anos"])
    anos = list(range(F.PRIMEIRO_ANO, max(anos_vde[-1], anos_sim[-1], seeds["siconfi"]["anos"][-1]) + 1))
    fora = lambda: {uf: {} for uf in F.SIGLAS}  # noqa: E731

    indicadores, series = [], {}
    # SIM: agressões (total e mulheres), por residência
    for iid, consulta, titulo, grupo, denominador in (
        ("agressoes", "agressoes", "Óbito por agressão (homicídio no registro de saúde)", "letalidade", "populacao"),
        ("agressoes_mulheres", "agressoes_mulheres", "Óbito de mulher por agressão (registro de saúde)", "mulheres", "mulheres"),
    ):
        c = situacao_sim(sim, consulta, anos)
        series[iid] = serie(c, ibge, anos, denominador)
        indicadores.append({
            "id": iid, "fonte": "sim", "grupo": grupo, "titulo": titulo, "unidade": "óbitos",
            "denominador": denominador, "base": "residencia",
            "definicao": "Causa básica do óbito no grande grupo X85 a Y09 da CID-10 (agressões), na declaração de óbito, pela UF de residência.",
        })
    # Sinesp VDE
    for e in F.EVENTOS:
        eid, _nome, _campo, grupo, titulo, unidade, denominador = e
        c = fora()
        sit = situacao_vde(vde, ibge, e, anos_vde)
        for uf in F.SIGLAS:
            for a in anos:
                c[uf][a] = sit[uf].get(a, (None, "fora", None))
        series[eid] = serie(c, ibge, anos, denominador)
        indicadores.append({
            "id": eid, "fonte": "sinesp", "grupo": grupo, "titulo": titulo, "unidade": unidade,
            "denominador": denominador, "base": "ocorrencia", "nome_na_fonte": e[1],
        })
    # SIM: intenção indeterminada, em % das causas externas
    ind, ext = sim["consultas"]["indeterminadas"]["ufs"], sim["consultas"]["externas"]["ufs"]
    pct: dict = {}
    for uf in F.SIGLAS:
        n = [ind[uf].get(str(a)) for a in anos]
        d = [ext[uf].get(str(a)) for a in anos]
        pct[uf] = {"n": n, "externas": d, "pct": [None if x is None or not y else round(x / y * 100, 2) for x, y in zip(n, d)],
                   "situacao": ["ok" if x is not None else "fora" for x in n]}
    tn = sim["consultas"]["indeterminadas"]["total"]
    te = sim["consultas"]["externas"]["total"]
    pct[F.BRASIL] = {"n": [tn.get(str(a)) for a in anos], "externas": [te.get(str(a)) for a in anos],
                     "pct": [None if tn.get(str(a)) is None else round(tn[str(a)] / te[str(a)] * 100, 2) for a in anos]}
    series["indeterminadas_pct"] = pct
    indicadores.append({
        "id": "indeterminadas_pct", "fonte": "sim", "grupo": "qualidade",
        "titulo": "Mortes por causa externa de intenção indeterminada", "unidade": "% das mortes por causas externas",
        "denominador": None, "base": "residencia",
        "definicao": "Óbitos com causa básica Y10 a Y34 da CID-10 (evento cuja intenção é indeterminada) sobre todos os óbitos por causas externas (V01 a Y98), pela UF de residência.",
    })

    # Siconfi: despesa liquidada do governo estadual na função 06, por habitante e em % da despesa do estado
    sic = seeds["siconfi"]
    nao_entregue = "DCA sem a função 06 no Siconfi para este ano. Ausência, não zero."
    desp = {uf: {a: ((round(sic["valores"][uf][str(a)]["seguranca"], 2), "ok", None) if sic["valores"][uf].get(str(a), {}).get("seguranca") is not None
                     else ((None, "sem_registro", nao_entregue) if str(a) in sic["valores"][uf] else (None, "fora", None))) for a in anos}
            for uf in F.SIGLAS}
    series["despesa_habitante"] = serie(desp, ibge, anos, "populacao", casas=2, escala=1)
    indicadores.append({
        "id": "despesa_habitante", "fonte": "siconfi", "grupo": "recursos", "titulo": "Despesa do governo estadual com segurança pública",
        "unidade": "reais correntes", "denominador": "populacao", "escala": 1, "base": "governo_estadual",
        "definicao": "Despesa liquidada na função 06 (Segurança Pública), exceto intraorçamentária, declarada pelo estado ou pelo DF na DCA, Anexo I-E, em reais do próprio ano.",
    })
    part: dict = {}
    for uf in F.SIGLAS:
        v = [sic["valores"][uf].get(str(a)) for a in anos]
        part[uf] = {"pct": [None if not d or d.get("seguranca") is None else round(d["seguranca"] / d["total"] * 100, 2) for d in v]}
    tot = {a: [uf for uf in F.SIGLAS if (sic["valores"][uf].get(str(a)) or {}).get("seguranca") is not None] for a in anos}
    part[F.BRASIL] = {"pct": [round(sum(sic["valores"][uf][str(a)]["seguranca"] for uf in tot[a]) / sum(sic["valores"][uf][str(a)]["total"] for uf in tot[a]) * 100, 2) if tot[a] else None for a in anos],
                      "cobertura": [len(tot[a]) for a in anos]}
    series["despesa_participacao"] = part
    indicadores.append({
        "id": "despesa_participacao", "fonte": "siconfi", "grupo": "recursos", "titulo": "Peso da segurança pública na despesa do estado",
        "unidade": "% da despesa liquidada do estado", "denominador": None, "base": "governo_estadual",
        "definicao": "Despesa liquidada na função 06 sobre a despesa liquidada total do estado ou do DF, ambas exceto intraorçamentárias, na DCA, Anexo I-E.",
    })
    for i in indicadores:
        i.setdefault("escala", 100_000)

    # polícia e saúde: homicídio doloso registrado pela polícia sobre óbitos por agressão no SIM
    comp: dict = {}
    h, ag = series["homicidio"], series["agressoes"]
    for uf in [*F.SIGLAS, F.BRASIL]:
        comp[uf] = [
            round(h[uf]["n"][k] / ag[uf]["n"][k], 4)
            if h[uf]["n"][k] is not None and ag[uf]["n"][k] and h[uf]["situacao"][k] == "ok" and ag[uf]["situacao"][k] == "ok" else None
            for k in range(len(anos))
        ]

    populacao = {uf: {"total": [ibge["populacao"][uf]["total"][str(a)] for a in anos],
                      "mulheres": [ibge["populacao"][uf]["mulheres"][str(a)] for a in anos]} for uf in [F.BRASIL, *F.SIGLAS]}

    # ausências por indicador, para a nota de quebra de série
    ausencias = []
    for i in indicadores:
        if i["fonte"] != "sinesp":
            continue
        s = series[i["id"]]
        for uf in F.SIGLAS:
            for k, a in enumerate(anos):
                if s[uf]["situacao"][k] in ("sem_registro", "incompleto"):
                    ausencias.append({"indicador": i["id"], "uf": uf, "ano": a, "situacao": s[uf]["situacao"][k]})

    dados = {"anos": anos, "populacao": populacao, "series": series, "policia_saude": comp}
    hash_dados = hashlib.sha256(json.dumps(dados, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()

    ultimo_vde = int(max(vde["arquivos"], key=int))
    parcial = vde["arquivos"][str(ultimo_vde)]["meses"] if vde["arquivos"][str(ultimo_vde)]["meses"] < 12 else None
    fontes = {
        "sinesp": {
            "nome": vde["fonte"], "pagina": vde["pagina"], "notas": F.URL_NOTAS_VDE, "capturado_em": vde["capturado_em"],
            "abrangencia": vde["abrangencia"], "anos": anos_vde,
            "ano_parcial": {"ano": ultimo_vde, "meses": parcial} if parcial else None,
            "arquivos": {a: {k: f[k] for k in ("url", "bytes", "sha256", "linhas", "meses")} for a, f in vde["arquivos"].items()},
        },
        "sim": {
            "nome": sim["fonte"], "pagina": sim["formulario"], "notas_tecnicas": F.URL_NOTAS_SIM, "capturado_em": sim["capturado_em"],
            "anos": anos_sim, "situacao": sim["situacao"], "final_ate": sim["notas"]["final_ate"],
            "extracao_final": sim["notas"]["extracao_final"], "extracao_preliminar": sim["notas"]["preliminares"],
            "previas_fora": sim["notas"]["previas"],
        },
        "siconfi": {
            "nome": sic["fonte"], "pagina": sic["pagina"], "url": sic["url"], "capturado_em": sic["capturado_em"],
            "anos": sic["anos"], "conta": sic["conta"], "coluna": sic["coluna"],
        },
        "ibge": {
            "nome": ibge["fonte"], "rotulo": F.ROTULO_PROJECAO, "base": F.BASE_PROJECAO,
            "url": ibge["url"], "metodo": ibge["metodo"], "capturado_em": ibge["capturado_em"],
            "sha256": ibge["original"]["sha256"],
        },
    }
    return {
        "versao": VERSAO,
        "hash_dados": hash_dados,
        "capturado_em": min(vde["capturado_em"], sim["capturado_em"], ibge["capturado_em"], sic["capturado_em"]),
        "anos": anos,
        "ufs": [{"codigo": c, "sigla": s, "nome": n, "regiao": r} for c, s, n, r in F.UFS],
        "regra_ausencia": {"limiar_ano": F.LIMIAR_ANO, "prob_meses_zerados": F.PROB_MESES_ZERADOS},
        "fontes": fontes,
        "indicadores": indicadores,
        "populacao": populacao,
        "series": series,
        "policia_saude": comp,
        "ausencias": ausencias,
    }


def csv_taxas(g: dict) -> str:
    """Uma linha por indicador, território e ano, com contagem, denominador, taxa, situação e referência."""
    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";", lineterminator="\r\n")
    w.writerow(["indicador", "titulo", "fonte", "base_territorial", "territorio", "ano", "contagem", "unidade",
                "denominador", "populacao_denominador", "taxa_por_100_mil", "situacao", "motivo",
                "taxa_brasil", "diferenca_para_brasil", "posicao_entre_ufs", "ufs_comparadas"])
    nomes = {u["sigla"]: u["nome"] for u in g["ufs"]}
    nomes[F.BRASIL] = "Brasil"
    for ind in g["indicadores"]:
        s = g["series"][ind["id"]]
        for terr in [F.BRASIL, *[u["sigla"] for u in g["ufs"]]]:
            x = s[terr]
            for k, a in enumerate(g["anos"]):
                if "pct" in x:
                    # participações (%): intenção indeterminada nas causas externas; função 06 na despesa do estado
                    taxa = x["pct"][k]
                    n, pop = (x["n"][k], x["externas"][k]) if "externas" in x else ("", "")
                    sit = "ok" if taxa is not None else "sem_registro"
                    den = "óbitos por causas externas" if "externas" in x else "despesa liquidada total do estado"
                    w.writerow([ind["id"], ind["titulo"], ind["fonte"], ind["base"], nomes[terr], a, "" if n is None else n, ind["unidade"],
                                den, "" if pop is None else pop, "" if taxa is None else str(taxa).replace(".", ","), sit, "", "", "", "", ""])
                    continue
                den = ind["denominador"]
                pop = g["populacao"][terr]["mulheres" if den == "mulheres" else "total"][k] if den else ""
                taxa = x["taxa"][k] if x.get("taxa") else None
                ref = s[F.BRASIL]["taxa"][k] if den else None
                w.writerow([
                    ind["id"], ind["titulo"], ind["fonte"], ind["base"], nomes[terr], a,
                    "" if x["n"][k] is None else x["n"][k], ind["unidade"],
                    {"populacao": "residentes", "mulheres": "residentes do sexo feminino"}.get(den, ""), pop,
                    "" if taxa is None else str(taxa).replace(".", ","),
                    x["situacao"][k], (x.get("motivo") or [None] * len(g["anos"]))[k] or "",
                    "" if ref is None or terr == F.BRASIL else str(ref).replace(".", ","),
                    "" if terr == F.BRASIL or not x.get("diferenca") or x["diferenca"][k] is None else str(x["diferenca"][k]).replace(".", ","),
                    "" if terr == F.BRASIL or not x.get("posicao") or x["posicao"][k] is None else x["posicao"][k],
                    s[F.BRASIL]["comparadas"][k] if den else "",
                ])
    return "﻿" + buf.getvalue()
