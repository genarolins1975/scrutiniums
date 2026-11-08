"""Coletor CCEE: PLD horário por submercado (conjunto PLD_HORARIO, CC-BY-4.0).

Duas origens, ambas com vintage e sha256:

1. `seed`: capturas primárias versionadas em pipeline/energia/seed/ccee_pld_horario/,
   com MANIFESTO.json (sha256 do CSV original, recurso CKAN, capturado_em).
   Existe porque o portal da CCEE respondeu 403 ("Acesso bloqueado") ao ambiente
   de construção em 28/09/2026. O sha256 de cada arquivo é conferido na importação.
2. `coleta_direta`: package_show + download dos recursos anuais. Falha vira
   registro em `coletas` (e aparece na gold como pane), nunca dado.

Formato dos arquivos: MES_REFERENCIA;SUBMERCADO;PERIODO_COMERCIALIZACAO;DIA;HORA;PLD_HORA,
com aspas e zeros à esquerda até 2024 e sem eles a partir de 2025. HORA é a hora
local (0 a 23); a conferência com o snapshot do projeto PLD (UTC) confirma o
deslocamento de 3 horas.
"""
import csv
import gzip
import hashlib
import io
import json
import re
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from pipeline.common import http_get  # noqa: E402
from pipeline.energia import base  # noqa: E402

DATASET = "ccee_pld_horario"
PACOTE_URL = "https://dadosabertos.ccee.org.br/api/3/action/package_show?id=pld_horario"
PORTAL_URL = "https://dadosabertos.ccee.org.br/dataset/pld_horario"
SEED_DIR = os.path.join(base.SEED, "ccee_pld_horario")

SUBMERCADO = {"SUDESTE": "SE", "SUDESTE/CENTRO-OESTE": "SE", "SUL": "S", "NORDESTE": "NE", "NORTE": "N"}


def parse_pld(texto):
    """Linhas (serie, ref, valor) com serie `pld.{SM}` e ref `AAAA-MM-DDTHH:00` (hora local)."""
    leitor = csv.reader(io.StringIO(texto), delimiter=";")
    cab = [c.strip().strip('"').lstrip("﻿") for c in next(leitor)]
    idx = {c: i for i, c in enumerate(cab)}
    for row in leitor:
        if not row:
            continue
        g = lambda c: row[idx[c]].strip().strip('"')  # noqa: E731
        mes, sub, dia, hora, v = g("MES_REFERENCIA"), g("SUBMERCADO"), g("DIA"), g("HORA"), g("PLD_HORA")
        sm = SUBMERCADO.get(sub.upper())
        if not sm or not v:
            continue
        ref = f"{mes[:4]}-{mes[4:6]}-{int(dia):02d}T{int(hora):02d}:00"
        yield f"pld.{sm}", ref, float(v.replace(",", "."))


def importa_seed(con):
    """Importa todas as capturas versionadas. Retorna lista de status por arquivo.
    sha256 divergente do manifesto = erro (o arquivo não entra)."""
    out = []
    if not os.path.isdir(SEED_DIR):
        return out
    for versao in sorted(os.listdir(SEED_DIR)):
        pasta = os.path.join(SEED_DIR, versao)
        manifesto_path = os.path.join(pasta, "MANIFESTO.json")
        if not os.path.isfile(manifesto_path):
            continue
        with open(manifesto_path, encoding="utf-8") as f:
            manifesto = json.load(f)
        for item in manifesto["arquivos"]:
            caminho = os.path.join(pasta, item["arquivo_seed"])
            with gzip.open(caminho, "rb") as f:
                corpo = f.read()
            sha = hashlib.sha256(corpo).hexdigest()
            if sha != item["sha256"]:
                out.append({"recurso": item["recurso"], "ok": False,
                            "erro": f"sha256 divergente: {sha} != {item['sha256']}"})
                base.registra_coleta(con, DATASET, item["recurso"], False, "seed com sha256 divergente")
                continue
            vid, nova = base.registra_vintage(
                con, DATASET, item["recurso"], item["url"], manifesto["capturado_em"],
                item.get("last_modified"), sha, len(corpo), "seed", os.path.relpath(caminho, base.RAIZ))
            novas, revs = (0, 0)
            if nova:
                novas, revs = base.grava_observacoes(con, DATASET, vid, parse_pld(corpo.decode("utf-8-sig")))
            out.append({"recurso": item["recurso"], "ok": True, "novas": novas, "revisoes": revs,
                        "vintage": vid})
        con.commit()
    return out


def coleta_direta(con, baixar=http_get):
    """Tenta a fonte primária. Nunca lança; devolve status com o erro quando há."""
    try:
        corpo, _ = baixar(PACOTE_URL, timeout=60)
        resposta = json.loads(corpo.decode("utf-8"))
        if not resposta.get("success") or not isinstance(resposta.get("result"), dict):
            raise ValueError("package_show sem resultado válido")
        pacote = resposta["result"]
    except Exception as e:
        base.registra_coleta(con, DATASET, "*", False, f"package_show: {e}")
        return {"ok": False, "erro": f"package_show: {e}"[:300]}
    status = {"ok": True, "arquivos": 0, "novas": 0, "revisoes": 0, "falhas": []}
    for r in pacote.get("resources", []):
        nome = r.get("name") or ""
        # o nome vem do CKAN e vira segmento de caminho no bronze: só o padrão esperado
        if not re.fullmatch(r"pld_horario_\d{4}", nome):
            continue
        try:
            arq, _ = baixar(r["url"], timeout=180, accept="*/*")
        except Exception as e:
            base.registra_coleta(con, DATASET, nome, False, str(e))
            status["falhas"].append(f"{nome}: {e}"[:200])
            continue
        capturado = base.agora_utc()
        caminho, sha = base.salva_bronze("ccee", DATASET, nome, arq, "csv", capturado)
        con.execute("SAVEPOINT recurso_ccee")
        try:
            linhas = list(parse_pld(arq.decode("utf-8-sig")))
            if not linhas:
                raise ValueError("CSV sem observações de PLD")
            vid, _ = base.registra_vintage(con, DATASET, nome, r["url"], capturado, r.get("last_modified"),
                                              sha, len(arq), "coleta_direta", caminho)
            n, rv = base.grava_observacoes(con, DATASET, vid, linhas)
        except Exception as e:
            con.execute("ROLLBACK TO SAVEPOINT recurso_ccee")
            con.execute("RELEASE SAVEPOINT recurso_ccee")
            base.registra_coleta(con, DATASET, nome, False, f"importação: {e}")
            con.commit()
            status["falhas"].append(f"{nome}: importação: {e}"[:300])
            continue
        con.execute("RELEASE SAVEPOINT recurso_ccee")
        status["novas"] += n
        status["revisoes"] += rv
        base.registra_coleta(con, DATASET, nome, True, f"{len(arq)} bytes")
        status["arquivos"] += 1
        con.commit()
    if not status["arquivos"] and not status["falhas"]:
        motivo = "package_show sem CSV anual de PLD compatível"
        base.registra_coleta(con, DATASET, "*", False, motivo)
        con.commit()
        status["falhas"].append(motivo)
    status["ok"] = not status["falhas"]
    return status


def coleta(con, tentar_direta=True):
    seed = importa_seed(con)
    direta = coleta_direta(con) if tentar_direta else {"ok": False, "erro": "coleta direta desativada"}
    return {"dataset": DATASET, "seed": seed, "direta": direta,
            "ok": all(s["ok"] for s in seed) and bool(seed)}
