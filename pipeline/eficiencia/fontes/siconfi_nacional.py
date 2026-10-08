"""Despesa municipal em Educação de todos os municípios (Siconfi): base da referência nacional calculada pelo OBEE.

Para cada município (esfera "M" da lista de entes, 5.570) e um exercício, coleta duas respostas oficiais da API de
dados abertos do Tesouro: a DCA, Anexo I-E, e o RREO do 6º bimestre, Anexo 02. Guarda só o necessário para refazer a
conferência das capitais em escala (as mesmas regras de `conferencia.py`): a despesa liquidada na função 12 na DCA, o
total da DCA exceto intraorçamentárias, a despesa liquidada até o bimestre da Educação no RREO e o sha256 de cada
resposta completa. A API não oferece a DCA em lote por exercício (a consulta sem `id_ente` volta vazia), por isso a
coleta é município a município, com poucas conexões simultâneas e retomável.

Nada é imputado: município sem resposta, sem a linha da função ou com erro fica registrado com o motivo.
"""
import concurrent.futures as cf
import hashlib
import json
import os
import threading
import time

from pipeline.eficiencia import base
from pipeline.eficiencia.fontes import siconfi as S

CONEXOES = 6
PASTA = os.path.join(base.SEED, "siconfi", "nacional_educacao")


def _sha_itens(itens):
    return hashlib.sha256(json.dumps(itens, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()


def _dca(cod, ano):
    urls, itens = S._todas_paginas("dca", {"an_exercicio": ano, "no_anexo": "DCA-Anexo I-E", "id_ente": cod})
    liq = [x for x in itens if x.get("coluna") == "Despesas Liquidadas"]
    funcao12 = [float(x["valor"]) for x in liq if x.get("conta") == "12 - Educação"]
    total = [float(x["valor"]) for x in liq if x.get("conta") == "Despesas Exceto Intraorçamentárias"]
    return {"linhas": len(itens), "funcao12": funcao12[0] if len(funcao12) == 1 else None, "linhas_funcao12": len(funcao12),
            "total_exceto_intra": total[0] if len(total) == 1 else None, "sha256": _sha_itens(itens) if itens else None}


def _rreo(cod, ano):
    urls, itens = S._todas_paginas("rreo", {"an_exercicio": ano, "nr_periodo": 6, "co_tipo_demonstrativo": "RREO",
                                            "no_anexo": "RREO-Anexo 02", "co_esfera": "M", "id_ente": cod})
    exc = intra = None
    for x in itens:
        if x.get("conta") == "Educação" and str(x.get("coluna", "")).startswith("DESPESAS LIQUIDADAS ATÉ O BIMESTRE"):
            if "Exceto" in x.get("rotulo", ""):
                exc = float(x["valor"])
            else:
                intra = float(x["valor"])
    return {"linhas": len(itens), "exceto_intra": exc, "intra": intra, "sha256": _sha_itens(itens) if itens else None}


def _um(cod, ano):
    out = {"cod": cod}
    for nome, f in (("dca", _dca), ("rreo", _rreo)):
        try:
            out[nome] = f(cod, ano)
        except Exception as e:  # erro de rede ou resposta inesperada: registra, não imputa
            out[nome] = {"erro": str(e)[:200]}
    return out


def coleta(ano, limite=None, log=print):
    """Coleta (ou completa) o exercício. Resultado parcial em data/eficiencia/nacional_{ano}.json, para retomar."""
    capturado_em = base.agora_utc()
    entes = [x for x in base.le_json_gz(os.path.join(base.SEED, "siconfi", "entes.json.gz")) if x["esfera"] == "M"]
    cods = sorted(x["cod_ibge"] for x in entes)[:limite]
    parcial = os.path.join(base.DADOS, f"nacional_{ano}.json")
    feitos = {}
    if os.path.exists(parcial):
        feitos = {r["cod"]: r for r in base.le_json(parcial) if "erro" not in r.get("dca", {}) and "erro" not in r.get("rreo", {})}
    pendentes = [c for c in cods if c not in feitos]
    log(f"{len(cods)} municípios; {len(feitos)} já coletados; {len(pendentes)} a coletar com {CONEXOES} conexões")
    trava, n = threading.Lock(), 0
    t0 = time.time()
    with cf.ThreadPoolExecutor(max_workers=CONEXOES) as ex:
        futs = {ex.submit(_um, c, ano): c for c in pendentes}
        for fut in cf.as_completed(futs):
            r = fut.result()
            with trava:
                feitos[r["cod"]] = r
                n += 1
                if n % 250 == 0:
                    os.makedirs(os.path.dirname(parcial), exist_ok=True)
                    base.grava_json(parcial, list(feitos.values()))
                    log(f"  {n}/{len(pendentes)} em {time.time() - t0:.0f}s")
    os.makedirs(os.path.dirname(parcial), exist_ok=True)
    base.grava_json(parcial, list(feitos.values()))
    registros = [feitos[c] for c in cods]
    erros = sum(1 for r in registros if "erro" in r["dca"] or "erro" in r["rreo"])
    os.makedirs(PASTA, exist_ok=True)
    destino = os.path.join(PASTA, f"{ano}.json.gz")
    sha = base.grava_json_gz(destino, registros)
    base.registra_captura(f"siconfi_nacional_educacao_{ano}", {
        "instituicao": "Secretaria do Tesouro Nacional (Siconfi)",
        "conjunto": f"DCA Anexo I-E e RREO 6º bimestre Anexo 02 de todos os municípios, exercício {ano}: despesa liquidada na função Educação",
        "pagina": S.DOC, "url": f"{S.API}/dca?an_exercicio={ano}&no_anexo=DCA-Anexo%20I-E&id_ente=<código IBGE>; {S.API}/rreo?an_exercicio={ano}&nr_periodo=6&co_tipo_demonstrativo=RREO&no_anexo=RREO-Anexo%2002&co_esfera=M&id_ente=<código IBGE>",
        "capturado_em": capturado_em, "parametros": f"{len(cods)} municípios (esfera M da lista de entes); só os campos usados na conferência; sha256 da resposta completa de cada ente",
        "recorte": os.path.relpath(destino, base.RAIZ), "sha256_recorte": sha, "linhas_recorte": len(registros), "municipios_com_erro_de_coleta": erros,
    })
    return len(registros), erros
