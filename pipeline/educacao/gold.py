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
import statistics
import unicodedata

from pipeline.eficiencia.entes import codigos_capitais

from . import fontes as F
from .validacoes import validar_censo, validar_cruzado, validar_ideb, validar_populacao

VERSAO = "educacao-1.0.0"


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
    corpo = json.dumps({"gold": _sem_captura(gold), "ufs": arquivos}, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    gold["hash_dados"] = hashlib.sha256(corpo.encode("utf-8")).hexdigest()
    return gold, arquivos
