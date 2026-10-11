"""Ipea/AOP 2019: médias de acesso ponderadas pela população espacial de 2010.

Conserva zero e ausência; nunca soma oportunidades sobrepostas entre origens.
Semente reduzida conserva cada célula necessária aos cálculos e sua linhagem.
Não escreve em public/, não altera Censo/Pemob nem a cesta de escores.
"""
from __future__ import annotations
import argparse
import base64
from collections import defaultdict
import csv
import gzip
import hashlib
import io
import json
import math
from pathlib import Path

METRICS = [
    {"id": f"CMA{code}{minutes}", "opportunity": label, "minutes": minutes, "unit": unit}
    for code, label, unit in [
        ("TT", "Empregos", "empregos"),
        ("EF", "Escolas de ensino fundamental", "escolas"),
        ("SB", "Saúde de baixa complexidade", "estabelecimentos"),
        ("CT", "Centros de Referência da Assistência Social", "CRAS"),
    ] for minutes in [30, 60]
]
MODES = {"walk", "bicycle", "car", "public_transport"}
MAX_ORIGINAL = 96 * 1024 * 1024


def number(raw: str | None) -> float | None:
    if raw is None or raw.strip() in {"", "NA", "NaN"}:
        return None
    n = float(raw)
    if not math.isfinite(n) or n < 0:
        raise ValueError("Valor não finito ou negativo na variável cumulativa")
    return n


def checked_source(root: Path, item: dict) -> bytes:
    name = item["arquivo"]
    if Path(name).name != name or item["estado"] != "coletado":
        raise ValueError("Original não elegível")
    with gzip.open(root / (name + ".gz"), "rb") as handle:
        raw = handle.read(MAX_ORIGINAL + 1)
    if len(raw) > MAX_ORIGINAL or hashlib.sha256(raw).hexdigest() != item["sha256"]:
        raise ValueError("Hash do original divergente: " + name)
    return raw


def create_seed(root: Path) -> dict:
    manifest = json.loads((root / "manifesto.json").read_text())
    if (manifest["referenceYear"], manifest["populationYear"]) != (2019, 2010):
        raise ValueError("Edição não prevista")
    metadata = (root / "metadata.csv").read_bytes()
    if hashlib.sha256(metadata).hexdigest() != manifest["metadata"]["sha256"]:
        raise ValueError("Hash do catálogo divergente")
    items = [r for r in csv.DictReader(io.StringIO(metadata.decode("utf-8-sig")))
             if (r["type"] == "access" and r["year"] == "2019" and r["mode"] in MODES)
             or (r["type"] == "population" and r["year"] == "2010")]
    key = lambda x: (x["type"], x["city"], x["year"], x["mode"])
    expected = {key(x) for x in items}
    if len(expected) != len(items) or {key(x) for x in manifest["files"]} != expected:
        raise ValueError("Fontes não correspondem ao catálogo selecionado")
    cities, population, access = {}, [], []
    popkeys, accesskeys = set(), set()
    for f in sorted(manifest["files"], key=key):
        raw = checked_source(root, f)
        rows = csv.DictReader(io.StringIO(raw.decode("utf-8-sig")))
        total = 0
        for row in rows:
            total += 1
            city, cell = row["code_muni"], row["id_hex"]
            if not (len(city) == 7 and city.isdigit() and len(cell) == 15):
                raise ValueError("Identificador territorial inválido")
            if row["year"] != f["year"] or row["abbrev_muni"] != f["city"]:
                raise ValueError("Ano ou cidade da linha diverge da fonte")
            if city not in cities:
                cities[city] = {"id": city, "name": row["name_muni"], "abbrev": f["city"]}
            if cities[city]["abbrev"] != f["city"]:
                raise ValueError("Código municipal ambíguo")
            if f["type"] == "population":
                k = (city, cell)
                if k in popkeys:
                    raise ValueError("População duplicada")
                popkeys.add(k)
                pop, decile = number(row["P001"]), number(row["R003"])
                if decile is not None and (decile != int(decile) or not 0 <= decile <= 10):
                    raise ValueError("Decil inválido")
                population.append([city, cell, pop, decile])
            else:
                mode, peak = row["mode"], row["peak"]
                if mode != f["mode"] or peak not in {"0", "1"}:
                    raise ValueError("Modo ou horário inválido")
                # Nos modos ativos, a fonte usa peak=1 sem um segundo horário.
                if mode in {"walk", "bicycle"}:
                    if peak != "1":
                        raise ValueError("Horário dos modos ativos mudou")
                    peak = "na"
                k = (city, cell, mode, peak)
                if k in accesskeys:
                    raise ValueError("Origem duplicada no mesmo modo e horário")
                accesskeys.add(k)
                values = [number(row[m["id"]]) for m in METRICS]
                for j in range(0, len(values), 2):
                    if values[j] is not None and values[j+1] is not None and values[j] > values[j+1]:
                        raise ValueError("Acesso em 30 min excede 60 min")
                access.append([city, cell, mode, peak, *values])
        if total != f["linhas"]:
            raise ValueError("Contagem da fonte diverge")
    if not population or not access:
        raise ValueError("Semente vazia")
    return {"schemaVersion": 1, "referenceYear": 2019, "populationYear": 2010,
            "metrics": METRICS, "cities": sorted(cities.values(), key=lambda c: c["id"]),
            "populationColumns": ["city", "id_hex", "P001", "R003"],
            "accessColumns": ["city", "id_hex", "mode", "peak", *[m["id"] for m in METRICS]],
            "population": sorted(population), "access": sorted(access),
            "sources": [{k: v for k, v in f.items() if k not in {"primeira_linha", "cabecalhos"}}
                        for f in sorted(manifest["files"], key=key)],
            "metadata": manifest["metadata"]}


def aggregate(seed: dict) -> dict:
    population = {(r[0], r[1]): (r[2], r[3]) for r in seed["population"]}
    if len(population) != len(seed["population"]):
        raise ValueError("População duplicada na semente")
    totals = defaultdict(lambda: {"population": 0., "cells": 0, "missingWeightCells": 0})
    for city, _, weight, decile in seed["population"]:
        groups = ["all"] + ([str(int(decile))] if decile is not None and 1 <= decile <= 10 else ["unknown"])
        for group in groups:
            t = totals[(city, group)]
            if weight is None:
                t["missingWeightCells"] += 1
            elif weight > 0:
                t["population"] += weight
                t["cells"] += 1
    buckets = defaultdict(lambda: [0., 0., 0, 0.])
    panels, seen, unmatched = set(), set(), defaultdict(int)
    for city, cell, mode, peak, *values in seed["access"]:
        k = (city, cell, mode, peak)
        if k in seen or len(values) != len(seed["metrics"]):
            raise ValueError("Chave duplicada ou coluna ausente na semente")
        seen.add(k)
        panel = (city, mode, peak)
        panels.add(panel)
        if (city, cell) not in population:
            unmatched[panel] += 1
            continue
        weight, decile = population[(city, cell)]
        if weight is None or weight == 0:
            continue
        groups = ["all"] + ([str(int(decile))] if decile is not None and 1 <= decile <= 10 else ["unknown"])
        for j, value in enumerate(values):
            if value is None:
                continue
            if value < 0 or not math.isfinite(value):
                raise ValueError("Valor inválido na semente")
            for group in groups:
                b = buckets[(*panel, j, group)]
                b[0] += weight * value
                b[1] += weight
                b[2] += 1
                if value == 0:
                    b[3] += weight
    records = []
    for panel in sorted(panels):
        for j, metric in enumerate(seed["metrics"]):
            groups = []
            for group in ["all", *map(str, range(1, 11)), "unknown"]:
                t = totals[(panel[0], group)]
                numerator, denominator, cells, zero_weight = buckets[(*panel, j, group)]
                if denominator > t["population"] + .0001:
                    raise ValueError("Cobertura excede população de referência")
                groups.append({"group": group, "mean": numerator/denominator if denominator else None,
                               "numerator": numerator if denominator else None, "coveredPopulation": denominator,
                               "totalPopulation": t["population"], "coveredCells": cells, "totalCells": t["cells"],
                               "zeroPopulation": zero_weight, "zeroShare": 100*zero_weight/denominator if denominator else None,
                               "coverage": 100*denominator/t["population"] if t["population"] else None,
                               "missingWeightCells": t["missingWeightCells"]})
            records.append({"city": panel[0], "mode": panel[1], "peak": panel[2], "metric": metric["id"],
                            "unmatchedCells": unmatched[panel], "groups": groups})
    return {k: seed[k] for k in ["schemaVersion", "referenceYear", "populationYear", "metrics", "cities", "sources", "metadata"]} | {
        "populationRows": len(seed["population"]), "accessRows": len(seed["access"]), "records": records,
        "notes": ["Estimativas de acessibilidade de 2019 ponderadas pela distribuição espacial da população de 2010, não população atual.",
                  "Média = soma de oportunidades acessíveis em cada origem × moradores / moradores nas origens com estimativa válida.",
                  "Cobertura = moradores nas células com valor válido / moradores com peso conhecido no arquivo populacional da cidade.",
                  "Cada destino pode ser alcançado por várias origens; médias não são totais de vagas, empregos ou atendimentos.",
                  "Decis de renda classificam áreas da cidade, não pessoas. Não são os mesmos patamares de renda entre cidades.",
                  "Código de decil zero na fonte é conservado na semente e incluído em Sem decil válido, nunca remapeado para o decil 1.",
                  "Acesso espacial não garante contratação, matrícula, consulta, atendimento ou capacidade de pagar o deslocamento.",
                  "Inf dos indicadores TMI não entra nesta edição. São usadas somente medidas cumulativas CMA em 30 e 60 minutos."]}


def write_json(path: Path, data: dict) -> bytes:
    raw = json.dumps(data, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode()
    path.write_bytes(raw)
    return raw


def run(source: Path, target: Path) -> dict:
    seed = create_seed(source)
    result = aggregate(seed)
    target.mkdir(parents=True, exist_ok=True)
    # Semente enxuta: apenas as colunas usadas. Todos os hashes dos originais permanecem no manifesto.
    raw_seed = json.dumps(seed, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode()
    packed = gzip.compress(raw_seed, mtime=0)
    target.joinpath("seed.json.gz.b64").write_bytes(base64.b64encode(packed))
    result["seedSha256"] = hashlib.sha256(packed).hexdigest()
    raw = write_json(target / "resumo.json", result)
    target.joinpath("resumo.sha256").write_text(hashlib.sha256(raw).hexdigest()+"\n")
    check = aggregate(json.loads(gzip.decompress(base64.b64decode(target.joinpath("seed.json.gz.b64").read_bytes()))))
    if check != {k: v for k, v in result.items() if k != "seedSha256"}:
        raise ValueError("Reprodução da semente diverge")
    print(json.dumps({"cities": len(result["cities"]), "records": len(result["records"]),
                      "accessRows": result["accessRows"], "populationRows": result["populationRows"],
                      "seedBytes": len(packed), "summaryBytes": len(raw), "sources": len(result["sources"])}, ensure_ascii=False))
    return result

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--origem", type=Path, required=True)
    p.add_argument("--saida", type=Path, required=True)
    a = p.parse_args()
    run(a.origem, a.saida)
