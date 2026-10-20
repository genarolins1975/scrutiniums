"""Coleta do IPCA na API do SIDRA (tabela 7060) e grava o seed.

O seed guarda só o que a gold usa, em forma compacta: o índice geral e os nove grupos em todas as áreas e
todos os meses (variação mensal, no ano, em 12 meses e peso), e os subitens no último mês e no primeiro mês
da janela de 12 meses (variação em 12 meses e peso). O manifesto registra o endereço, o sha256, o tamanho e
o status de cada resposta original, e a data da captura.

Sentinelas do SIDRA preservadas: "..." (não disponível) vira null; "-" (zero absoluto; no peso de um subitem,
fora da cesta daquela área) fica "-". Qualquer outro texto não numérico reprova a coleta.
"""
from __future__ import annotations

import gzip
import hashlib
import json
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

from . import fontes as F

USER_AGENT = "Scrutiniums/1.0 (observatorio de dados publicos; contato pelo site)"


def agora_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def baixar(url: str, tentativas: int = 5, timeout: int = 180) -> tuple[bytes, dict]:
    """GET com novas tentativas (o SIDRA devolve 500 e corta conexões em horários de pico)."""
    erro = None
    for t in range(tentativas):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                corpo = r.read()
                if corpo[:2] == b"\x1f\x8b":  # a API de serviços do IBGE responde em gzip mesmo sem pedir
                    corpo = gzip.decompress(corpo)
                return corpo, {"status": r.status, "bytes": len(corpo), "sha256": hashlib.sha256(corpo).hexdigest()}
        except urllib.error.HTTPError as e:
            erro = e
            if 400 <= e.code < 500:  # consulta malformada ou acima do limite: repetir não muda a resposta
                break
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            erro = e
            time.sleep(min(60, 4 * (t + 1)))
    raise RuntimeError(f"falha ao coletar {url}: {erro}")


def valor(texto: str):
    """Valor do SIDRA: número, null ("..."), ou "-" preservado. Outro texto é erro de coleta."""
    if texto == "...":
        return None
    if texto == "-":
        return "-"
    try:
        return float(texto)
    except ValueError as e:
        raise ValueError(f"valor inesperado no SIDRA: {texto!r}") from e


def linhas_sidra(corpo: bytes) -> list[dict]:
    dados = json.loads(corpo)
    if not isinstance(dados, list) or len(dados) < 2 or dados[0].get("V") != "Valor":
        raise ValueError("resposta do SIDRA sem cabeçalho ou sem linhas")
    cab = dados[0]
    # D1 = área, D2 = variável, D3 = mês, D4 = categoria (a ordem da consulta)
    esperado = {"D1C": "Brasil", "D2C": "Variável", "D3C": "Mês", "D4C": "Geral"}
    for k, ini in esperado.items():
        if not str(cab.get(k, "")).startswith(ini):
            raise ValueError(f"dimensão {k} inesperada no SIDRA: {cab.get(k)!r}")
    return dados[1:]


def mes_anterior(mes: str, n: int) -> str:
    a, m = int(mes[:4]), int(mes[4:])
    i = a * 12 + (m - 1) - n
    return f"{i // 12}{i % 12 + 1:02d}"


def coletar() -> tuple[dict, dict]:
    """Coleta tudo e devolve (seed, manifesto). Não grava nada: quem chama decide."""
    capturado = agora_utc()
    originais: dict[str, dict] = {}

    def pegar(url: str) -> bytes:
        corpo, info = baixar(url)
        originais[url] = info
        return corpo

    meta = json.loads(pegar(F.URL_METADADOS))
    periodos = json.loads(pegar(F.URL_PERIODOS))
    cats = {str(c["id"]): {"nome": c["nome"], "nivel": c["nivel"]} for c in meta["classificacoes"][0]["categorias"]}
    ultimo = max(p["id"] for p in periodos)
    inicio = mes_anterior(ultimo, 11)

    # a API limita cada consulta a 50.000 valores: duas variáveis por vez (17 áreas × 10 categorias × 81 meses × 2)
    grupos: dict = {}
    areas_fonte: dict[str, str] = {}
    meses_vistos: set[str] = set()
    for par in ((F.V_MENSAL, F.V_ANO), (F.V_DOZE, F.V_PESO)):
        url_grupos = f"{F.URL_VALORES}/v/{','.join(par)}/p/all/c315/{','.join([F.GERAL, *F.IDS_GRUPOS])}"
        for r in linhas_sidra(pegar(url_grupos)):
            meses_vistos.add(r["D3C"])
            areas_fonte.setdefault(r["D1C"], r["D1N"])
            grupos.setdefault(r["D1C"], {}).setdefault(r["D4C"], {}).setdefault(r["D2C"], {})[r["D3C"]] = valor(r["V"])
    meses = sorted(meses_vistos)
    # forma compacta: uma lista por variável, na ordem de `meses`; mês ausente fica fora (a validação acusa)
    compacto = {
        a: {c: {v: [porv.get(m, "ausente") for m in meses] for v, porv in porc.items()} for c, porc in pora.items()}
        for a, pora in grupos.items()
    }

    url_sub = f"{F.URL_VALORES}/v/{F.V_DOZE},{F.V_PESO}/p/{inicio},{ultimo}/c315/allxt"
    sub: dict = {}
    for r in linhas_sidra(pegar(url_sub)):
        if cats.get(r["D4C"], {}).get("nivel") != 4:
            continue
        sub.setdefault(r["D1C"], {}).setdefault(r["D4C"], {})[f"{r['D2C']}_{r['D3C']}"] = valor(r["V"])
    subitens = {
        a: {c: [d.get(f"{F.V_DOZE}_{ultimo}", "ausente"), d.get(f"{F.V_PESO}_{inicio}", "ausente"), d.get(f"{F.V_PESO}_{ultimo}", "ausente")] for c, d in porc.items()}
        for a, porc in sub.items()
    }

    calendario = coletar_calendario(originais)

    seed = {
        "tabela": F.TABELA,
        "nome_tabela": meta.get("nome"),
        "capturado_em": capturado,
        "periodos": [{"id": p["id"], "modificacao": p.get("modificacao")} for p in sorted(periodos, key=lambda p: p["id"])],
        "categorias": {k: v for k, v in cats.items() if v["nivel"] in (0, 1, 4)},
        "areas_fonte": areas_fonte,
        "meses": meses,
        "grupos": compacto,
        "subitens": {"inicio": inicio, "ultimo": ultimo, "campos": ["doze_ultimo", "peso_inicio", "peso_ultimo"], "valores": subitens},
        "calendario": calendario,
    }
    manifesto = {"capturado_em": capturado, "tabela": F.TABELA, "originais": originais}
    return seed, manifesto


def coletar_calendario(originais: dict) -> dict | None:
    """Próximas divulgações do IPCA. Falha aqui não reprova a coleta: a página só deixa de dizer a próxima data."""
    hoje = datetime.now(timezone.utc).date()
    ate = hoje + timedelta(days=200)
    url = f"{F.URL_CALENDARIO}?qtd=20&de={hoje:%m-%d-%Y}&ate={ate:%m-%d-%Y}"
    try:
        corpo, info = baixar(url, tentativas=3, timeout=60)
        originais[url] = info
        itens = json.loads(corpo).get("items", [])
    except Exception:  # noqa: BLE001
        return None
    datas = []
    for i in itens:
        try:
            d = datetime.strptime(i["data_divulgacao"].split(" ")[0], "%d/%m/%Y").date()
            ref = f"{int(i['ano_referencia_inicio'])}-{int(i['mes_referencia_inicio']):02d}"
        except (KeyError, ValueError, TypeError):
            continue
        datas.append({"data": d.isoformat(), "referencia": ref})
    return {"divulgacoes": sorted(datas, key=lambda x: x["data"])}
