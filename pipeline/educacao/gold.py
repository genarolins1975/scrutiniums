"""Gold do painel Educação nos municípios (public/educacao/gold).

- educacao.json: o Ideb do Brasil (redes municipal e pública) e das UFs (rede pública) em toda a série, a distribuição do
  Ideb das redes municipais no ano mais recente (Brasil, cada UF e cada porte de município), quantos municípios têm Ideb
  em cada etapa e rede e por que os demais não têm, o Censo Escolar do Brasil e das UFs, as faixas de porte e as fontes.
- municipios/{UF}.json: cada município da UF, com população e porte, o Ideb e os componentes (aprovação, P, notas do
  Saeb, N e meta do primeiro ciclo) das redes municipal e pública nos anos iniciais e finais, o motivo de não haver Ideb
  no ano mais recente e as matrículas e escolas do Censo Escolar.

Nada aqui estima nem interpola. O que a gold calcula, sempre a partir de números publicados e marcado como cálculo da
Scrutiniums nas páginas: o porte (faixa de população do IBGE), as estatísticas de posição (mínimo, quartis pelo método
inclusivo, mediana e máximo) e as faixas de meio ponto da distribuição, as contagens de municípios por motivo e a soma das
matrículas. O Ideb do estado é o publicado pelo INEP (rede pública); a planilha da UF não tem a rede municipal, por isso
a comparação com o estado usa a rede pública e a mediana das redes municipais, com os nomes certos.
"""
from __future__ import annotations

import hashlib
import json
import math
from decimal import Decimal
import statistics
import unicodedata

from pipeline.eficiencia.entes import codigos_capitais

from . import fontes as F
from .validacoes import validar_censo, validar_cruzado, validar_ideb, validar_populacao, validar_analises

VERSAO = "educacao-1.1.0"


class GoldInvalida(ValueError):
    pass


def _r(x, casas):
    return None if x is None else round(x, casas)


def linha_gold(r: dict | None) -> dict | None:
    """A linha do seed com as casas que a página usa (N e P com quatro, para recompor N × P)."""
    if r is None:
        return None
    return {
        "ideb": r["ideb"],
        "n": [_r(x, 4) for x in r["n"]],
        "mat": r["mat"],
        "port": r["port"],
        "p": [_r(x, 4) for x in r["p"]],
        "aprov": r["aprov"],
        "marca": r["marca_saeb"],
        "meta": r["meta"],
    }


def porte(pop: int | None) -> str | None:
    if pop is None:
        return None
    for pid, _rot, lo, hi in F.PORTES:
        if pop >= lo and (hi is None or pop <= hi):
            return pid
    return None


def motivo(r: dict | None, matriculas: int | None) -> str | None:
    """Por que a rede não tem Ideb no ano mais recente (None quando tem). A ordem decide o caso mais específico."""
    if r is not None and r["ideb"][-1] is not None:
        return None
    if matriculas == 0:
        return "sem_matricula"
    if r is None:
        return "nao_divulgado"
    marca = r["marca_saeb"][-1]
    if marca == "ND":
        return "participacao"
    if marca == "ND*":
        return "a_pedido"
    if marca == "ND***":
        return "extravio"
    if r["n"][-1] is not None and r["p"][-1] is None:
        return "sem_aprovacao"
    return "sem_saeb"


def estatisticas(valores: list[float]) -> dict | None:
    if not valores:
        return None
    v = sorted(valores)
    if len(v) >= 2:
        q1, med, q3 = statistics.quantiles(v, n=4, method="inclusive")
    else:
        q1 = med = q3 = v[0]
    faixas = [0] * 20  # de meio em meio ponto, de 0 a 10 (o 10 entra na última)
    for x in v:
        faixas[min(19, int(x * 2 + 1e-9))] += 1
    return {"n": len(v), "min": v[0], "p25": round(q1, 2), "mediana": round(med, 2), "p75": round(q3, 2), "max": v[-1], "faixas": faixas}


def _chave_nome(nome: str) -> str:
    return unicodedata.normalize("NFKD", nome).encode("ascii", "ignore").decode().lower()


def _fontes(ideb: dict, censo: dict, pop: dict) -> dict:
    return {
        "ideb": {
            "orgao": F.ORGAO_INEP, "nome": F.NOME_IDEB, "edicao": ideb["ano"], "pagina": ideb.get("pagina", F.PAGINA_IDEB),
            "nota_informativa": ideb.get("nota_informativa"), "capturado_em": ideb.get("capturado_em"),
            "ultima_formula_original": F.ULTIMA_FORMULA_ORIGINAL,
            "publicado_em": max((a.get("modificado_em") or "") for a in ideb["arquivos"].values()) or None,
            "arquivos": {k: {"url": a.get("url"), "sha256": a.get("sha256"), "membro": a.get("membro"), "md5_publicado_inep": a.get("md5_publicado_inep"), "modificado_em": a.get("modificado_em")} for k, a in ideb["arquivos"].items()},
            "codigos_divergentes": ideb.get("codigos_divergentes") or {},
            "notas_da_fonte": (ideb.get("notas_da_fonte") or {}).get("ai") or [],
        },
        "censo": {
            "orgao": F.ORGAO_INEP, "nome": F.NOME_SINOPSE, "edicao": censo["ano"], "pagina": censo.get("pagina", F.PAGINA_SINOPSE),
            "capturado_em": censo.get("capturado_em"), "publicado_em": censo["arquivo"].get("modificado_em"),
            "url": censo["arquivo"].get("url"), "sha256": censo["arquivo"].get("sha256"), "membro": censo["arquivo"].get("membro"),
            "tabelas": censo.get("tabelas"),
        },
        "populacao": {
            "orgao": F.ORGAO_IBGE, "nome": F.NOME_SIDRA, "ano": pop["ano"], "pagina": pop.get("pagina", F.PAGINA_SIDRA),
            "url": pop.get("url"), "capturado_em": pop.get("capturado_em"),
        },
    }


def _sem_captura(obj):
    """Cópia sem datas de captura nem sha256: o hash do dado não muda só porque a coleta rodou de novo."""
    if isinstance(obj, dict):
        return {k: _sem_captura(v) for k, v in obj.items() if k not in ("capturado_em", "sha256", "modificado_em", "publicado_em")}
    if isinstance(obj, list):
        return [_sem_captura(x) for x in obj]
    return obj


def analise_serie(serie: dict | None, anos: list[int], anos_meta: list[int]) -> dict:
    """Metas e divisão logarítmica de todos os pares publicados, sem arredondar N e P da gold.

    Cada variação contém: índices inicial/final, movimentos de N/P, produtos inicial/final e contribuições de N/P.
    Contribuições nulas significam movimento pequeno ou logaritmo indefinido; nunca contribuição igual a zero.
    """
    metas = []
    for j, ano in enumerate(anos_meta):
        k = anos.index(ano)
        meta = serie["meta"][j] if serie else None
        valor = serie["ideb"][k] if serie else None
        motivo_historico = None
        if valor is None:
            marca = serie["marca"][k] if serie else None
            motivo_historico = {"ND": "participacao", "ND*": "a_pedido", "ND***": "extravio"}.get(marca)
            if motivo_historico is None:
                motivo_historico = "sem_aprovacao" if serie and serie["n"][k] is not None and serie["p"][k] is None else "nao_divulgado"
        estado = "sem_meta" if meta is None else "sem_ideb" if valor is None else "alcancou" if valor >= meta else "nao_alcancou"
        metas.append({"ano": ano, "estado": estado, "motivo": motivo_historico})
    pares = []
    if serie:
        completos = [i for i in range(len(anos)) if all(serie[c][i] is not None for c in ("ideb", "n", "p"))]
        for pos, i in enumerate(completos):
            for j in completos[pos + 1:]:
                n0, n1, p0, p1 = serie["n"][i], serie["n"][j], serie["p"][i], serie["p"][j]
                v0, v1 = n0 * p0, n1 * p1
                cn = cp = None
                delta_exato = Decimal(str(n1))*Decimal(str(p1))-Decimal(str(n0))*Decimal(str(p0))
                if abs(delta_exato) >= Decimal("0.05") and min(n0, n1, p0, p1) > 0:
                    cn = (math.log(n1) - math.log(n0)) / (math.log(v1) - math.log(v0)) * (v1 - v0)
                    cp = (v1 - v0) - cn
                pares.append([i, j, n1 - n0, p1 - p0, v0, v1, cn, cp])
    return {"metas": metas, "variacoes": pares}


def composicao_matriculas(censo: dict | None) -> list[dict]:
    """Partições exatas das contagens disponíveis; a fonte não separa federal/estadual por etapa."""
    if censo is None:
        return []
    c = censo
    linhas = [{"etapa": "basica", "total": c["mat_total"], "partes": {r: c[f"mat_{r}"] for r in ("municipal", "estadual", "federal", "privada")}}]
    for e in ("creche", "pre", "ai", "af"):
        total, municipal = c[f"{e}_total"], c[f"{e}_mun"]
        partes = {"municipal": municipal}
        if e in ("ai", "af"):
            partes.update({"outras_publicas": c[f"{e}_publica"] - municipal, "privada": total - c[f"{e}_publica"]})
        else:
            partes["demais_redes"] = total - municipal
        linhas.append({"etapa": e, "total": total, "partes": partes})
    return linhas


def mapa_compacto(gold: dict, arquivos: dict) -> dict:
    """Identificação, resultados, ausência e cobertura por recorte; sem detalhe individual extra."""
    municipios = [{"id": m["id"], "nome": m["nome"], "uf": uf,
                   **{e: m[e]["municipal"]["ideb"][-1] if m[e]["municipal"] else None for e in F.ETAPAS},
                   **{f"motivo_{e}": m[e]["motivo_municipal"] for e in F.ETAPAS}}
                  for uf, arquivo in arquivos.items() for m in arquivo["municipios"]]
    cobertura = {}
    for uf in ["BR", *F.SIGLAS]:
        recorte = [m for m in municipios if uf == "BR" or m["uf"] == uf]
        cobertura[uf] = {"total": len(recorte), **{e: {
            "com_ideb": sum(m[e] is not None for m in recorte),
            "motivos": {mot: sum(m[f"motivo_{e}"] == mot for m in recorte) for mot in F.MOTIVOS}}
            for e in F.ETAPAS}}
    return {"versao": VERSAO, "ano": gold["ideb"]["ano"], "fonte": gold["fontes"]["ideb"]["orgao"],
            "municipios": municipios, "cobertura": cobertura}


def construir(seeds: dict) -> tuple[dict, dict[str, dict]]:
    ideb, censo, pop = seeds["ideb"], seeds["censo"], seeds["populacao"]
    problemas = (
        [f"Ideb: {x}" for x in validar_ideb(ideb)]
        + [f"Censo: {x}" for x in validar_censo(censo)]
        + [f"população: {x}" for x in validar_populacao(pop)]
        + [f"cruzada: {x}" for x in validar_cruzado(ideb, censo, pop)]
    )
    if problemas:
        raise GoldInvalida("gold não publicada:\n- " + "\n- ".join(problemas[:40]))

    campos = censo["campos"]
    capitais = {str(c) for c in codigos_capitais()}
    populacao = pop["municipios"]
    nomes_ibge = pop.get("nomes") or {}
    universo = sorted(set(censo["municipios"]) | set(populacao))

    por_uf: dict[str, list] = {s: [] for s in F.SIGLAS}
    ideb_mun_ultimo: dict[str, dict[str, float]] = {e: {} for e in F.ETAPAS}
    cobertura = {e: {r: {"com_ideb": 0, "motivos": {m: 0 for m in F.MOTIVOS}} for r in ("municipal", "publica")} for e in F.ETAPAS}
    for cod in universo:
        uf = F.UF_DO_PREFIXO[cod[:2]]
        linha_censo = censo["municipios"].get(cod)
        c = None if linha_censo is None else dict(zip(campos, linha_censo[1:]))
        nome = nomes_ibge.get(cod) or (linha_censo[0] if linha_censo else None)
        m = {"id": cod, "nome": nome, "pop": populacao.get(cod), "porte": porte(populacao.get(cod)), "capital": cod in capitais}
        for etapa in F.ETAPAS:
            redes = ((ideb["etapas"][etapa]["municipios"].get(cod) or {}).get("redes")) or {}
            bloco = {}
            for rede, campo in (("municipal", f"{etapa}_mun"), ("publica", f"{etapa}_publica")):
                r = redes.get(rede)
                mot = motivo(r, None if c is None else c[campo])
                bloco[rede] = linha_gold(r)
                bloco[f"motivo_{rede}"] = mot
                if mot is None:
                    cobertura[etapa][rede]["com_ideb"] += 1
                else:
                    cobertura[etapa][rede]["motivos"][mot] += 1
            if bloco["municipal"] and bloco["municipal"]["ideb"][-1] is not None:
                ideb_mun_ultimo[etapa][cod] = bloco["municipal"]["ideb"][-1]
            m[etapa] = bloco
        m["censo"] = c
        m["analises"] = {e: analise_serie(m[e]["municipal"], ideb["anos"], ideb["anos_meta"]) for e in F.ETAPAS}
        m["composicao_matriculas"] = composicao_matriculas(c)
        por_uf[uf].append(m)

    ano = ideb["ano"]
    distribuicao = {}
    for etapa in F.ETAPAS:
        valores = ideb_mun_ultimo[etapa]
        por_porte = {pid: estatisticas([v for cod, v in valores.items() if porte(populacao.get(cod)) == pid]) for pid, *_ in F.PORTES}
        por_uf_est = {s: estatisticas([v for cod, v in valores.items() if F.UF_DO_PREFIXO[cod[:2]] == s]) for s in F.SIGLAS}
        distribuicao[etapa] = {"ano": ano, "rede": "municipal", "brasil": estatisticas(list(valores.values())), "portes": por_porte, "ufs": por_uf_est}

    soma_censo = lambda linha: dict(zip(campos, linha))
    portes = [
        {"id": pid, "rotulo": rot, "min": lo, "max": hi, "municipios": sum(1 for cod in universo if porte(populacao.get(cod)) == pid)}
        for pid, rot, lo, hi in F.PORTES
    ]
    gold = {
        "versao": VERSAO,
        "gerado_por": "pipeline/educacao",
        "capturado_em": max(x for x in (ideb.get("capturado_em"), censo.get("capturado_em"), pop.get("capturado_em")) if x),
        "referencia": str(ano),
        "fontes": _fontes(ideb, censo, pop),
        "ideb": {
            "ano": ano,
            "anos": ideb["anos"],
            "anos_meta": ideb["anos_meta"],
            "brasil": {e: {r: linha_gold(x) for r, x in ideb["etapas"][e]["brasil"].items() if r in ("municipal", "publica")} for e in F.ETAPAS},
            "ufs": {e: {s: {"publica": linha_gold(ideb["etapas"][e]["ufs"][s]["publica"])} for s in F.SIGLAS} for e in F.ETAPAS},
        },
        "distribuicao": distribuicao,
        "cobertura": cobertura,
        "censo": {"ano": censo["ano"], "campos": campos, "brasil": soma_censo(censo["brasil"]), "ufs": {s: soma_censo(censo["ufs"][s]) for s in F.SIGLAS}},
        "portes": portes,
        "municipios": {"total": len(universo), "por_uf": {s: len(por_uf[s]) for s in F.SIGLAS}, "capitais": sorted(capitais)},
    }
    arquivos = {}
    for s in F.SIGLAS:
        lista = sorted(por_uf[s], key=lambda m: (_chave_nome(m["nome"] or ""), m["id"]))
        arquivos[s] = {"versao": VERSAO, "uf": s, "nome_uf": F.NOME_UF[s], "anos": ideb["anos"], "anos_meta": ideb["anos_meta"], "censo_ano": censo["ano"], "municipios": lista}
    gold["metas"] = {e: [
        {"ano": ano, **{estado: sum(1 for lista in por_uf.values() for m in lista if m["analises"][e]["metas"][j]["estado"] == estado)
                         for estado in ("alcancou", "nao_alcancou", "sem_ideb", "sem_meta")}}
        for j, ano in enumerate(ideb["anos_meta"])] for e in F.ETAPAS}
    problemas = validar_analises(gold, arquivos)
    if problemas:
        raise GoldInvalida("análises não publicadas: " + "; ".join(problemas[:20]))
    corpo = json.dumps({"gold": _sem_captura(gold), "ufs": arquivos}, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    gold["hash_dados"] = hashlib.sha256(corpo.encode("utf-8")).hexdigest()
    return gold, arquivos
