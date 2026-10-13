"""Aquisição SIDRA municipal com consultas, recortes e hashes preservados."""
import argparse
from datetime import datetime, timezone
import gzip
import hashlib
import json
from pathlib import Path
import urllib.request

from .contrato import HERE, ROOT

SIDRA = "https://apisidra.ibge.gov.br/values/t/"
METADATA = "https://servicodados.ibge.gov.br/api/v3/agregados/"
QUERIES = {
    10056: "/v/3795/p/2022/c58/47813/c2/6794/c86/95251",
    10295: "/v/13534/p/2022/c2/6794/c86/95251/c58/95253",
    10330: "/v/13376/p/2022/c537/31609,19432,79191,79192/c2088/79488/c86/95251/c469/79176",
    6805: "/v/381/p/2022/c11558/all",
    9934: "/v/381,1000381/p/2022/c1975/all/c1986/73103/c1988/73108",
    9936: "/v/381,1000381/p/2022/c2072/all/c63/95826/c125/2932",
    9940: "/v/382,1000382/p/2022/c1975/all/c86/95251/c58/95253",
}
UF = dict(zip(("11", "12", "13", "14", "15", "16", "17", "21", "22", "23", "24", "25", "26", "27", "28", "29", "31", "32", "33", "35", "41", "42", "43", "50", "51", "52", "53"),
              ("RO", "AC", "AM", "RR", "PA", "AP", "TO", "MA", "PI", "CE", "RN", "PB", "PE", "AL", "SE", "BA", "MG", "ES", "RJ", "SP", "PR", "SC", "RS", "MS", "MT", "GO", "DF")))
REGIONS = {"1": "Norte", "2": "Nordeste", "3": "Sudeste", "4": "Sul", "5": "Centro-Oeste"}


def encode(data):
    return (json.dumps(data, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False) + "\n").encode()


def acquire(url, cache, filename):
    request = urllib.request.Request(url, headers={"Accept-Encoding": "identity", "User-Agent": "OBEE-BMC-2022/1.0"})
    with urllib.request.urlopen(request, timeout=90) as response:
        transport = response.read(24_000_001)
    if len(transport) > 24_000_000:
        raise ValueError("Resposta excede o limite de aquisição")
    raw = gzip.decompress(transport) if transport.startswith(b"\x1f\x8b") else transport
    data = json.loads(raw)
    (cache / filename).write_bytes(raw)
    return data, {"url": url, "capturado_em": datetime.now(timezone.utc).isoformat(),
                  "sha256_resposta": hashlib.sha256(raw).hexdigest(),
                  "sha256_transporte": hashlib.sha256(transport).hexdigest(), "bytes_resposta": len(raw)}


def population_cohort(data):
    if not data or data[0].get("D1C") != "Município (Código)":
        raise ValueError("População precisa estar no nível N6")
    cities, seen = [], set()
    for row in data[1:]:
        ident = row["D1C"]
        if len(ident) != 7 or not ident.isdigit() or ident[:2] not in UF:
            raise ValueError("Código municipal IBGE inválido")
        if ident in seen or (row["NC"], row["D2C"], row["D3C"]) != ("6", "93", "2022"):
            raise ValueError("População duplicada ou com recorte divergente")
        if (row["MC"], row["MN"]) != ("45", "Pessoas"):
            raise ValueError("Unidade populacional divergente")
        seen.add(ident)
        if not row["V"].isdigit():
            raise ValueError("População não observada: nenhuma imputação permitida")
        count = int(row["V"])
        if count >= 100_000:
            name, suffix = row["D1N"].rsplit(" (", 1)
            uf = UF.get(ident[:2])
            if suffix != uf + ")":
                raise ValueError("Identidade municipal e UF divergentes")
            cities.append({"id": ident, "nome": name, "uf": uf, "grande_regiao": REGIONS[ident[0]], "populacao": count})
    if len(cities) != 319 or sum(c["id"] == "5300108" for c in cities) != 1:
        raise ValueError("SIDRA 4714 não reproduz os 319 municípios incluindo Brasília")
    capitals = {r["id"] for r in json.loads((ROOT / "docs/obee/resultados/piloto-2022-v2.json").read_text())["rows"]}
    cities = [dict(c, capital=c["id"] in capitals) for c in cities if c["id"] != "5300108"]
    if len(cities) != 318 or sum(c["capital"] for c in cities) != 26:
        raise ValueError("Universo não contém as 26 capitais esperadas")
    return cities


def collect(cache):
    cache = Path(cache)
    cache.mkdir(parents=True, exist_ok=True)
    # O seed só é promovido depois de todas as aquisições e validações de estrutura.
    # Falhas não sobrescrevem uma edição já adquirida.
    seed = HERE / "seed"
    population, population_source = acquire(SIDRA + "4714/n6/all/v/93/p/2022", cache, "populacao_n6_original.json")
    cities = population_cohort(population)
    city_ids = {c["id"] for c in cities}
    cut = [population[0]] + [r for r in population[1:] if r["D1C"] in city_ids]
    pending = {"populacao.json": encode(cut)}
    sources = [{"arquivo": "populacao.json", "tabela": 4714, "consultas": [population_source], "linhas": 318}]
    for table, suffix in QUERIES.items():
        metadata, meta_source = acquire(METADATA + str(table) + "/metadados", cache, f"{table}_metadata_original.json")
        if metadata["id"] != table or "N6" not in metadata["nivelTerritorial"]["Administrativo"]:
            raise ValueError("Metadados sem o nível municipal requerido")
        pending[f"{table}_metadata.json"] = encode(metadata)
        sources.append({"arquivo": f"{table}_metadata.json", "tabela": table, "consultas": [meta_source]})
        collected, queries = [], []
        for offset in range(0, len(cities), 80):
            batch = cities[offset:offset + 80]
            url = SIDRA + str(table) + "/n6/" + ",".join(c["id"] for c in batch) + suffix
            part, source = acquire(url, cache, f"{table}_lote_{offset}_original.json")
            if not part or part[0].get("D1C") != "Município (Código)":
                raise ValueError("Resposta SIDRA não municipal")
            if collected and part[0] != collected[0]:
                raise ValueError("Cabeçalho mudou entre os lotes")
            if any(r.get("NC") != "6" or r.get("D1C") not in {c["id"] for c in batch} for r in part[1:]):
                raise ValueError("Lote contém território fora da consulta")
            collected.extend(part if not collected else part[1:])
            queries.append(source)
        pending[f"{table}.json"] = encode(collected)
        sources.append({"arquivo": f"{table}.json", "tabela": table, "consultas": queries, "linhas": len(collected) - 1})
    for source in sources:
        source["sha256"] = hashlib.sha256(pending[source["arquivo"]]).hexdigest()
        source["capturado_em"] = min(q["capturado_em"] for q in source["consultas"])
    manifest = {"versao": "BMC_2022_seeds_v1", "fontes": sources, "municipios": cities,
                "universo": {"criterio": "População do Censo 2022 maior ou igual a 100 mil", "incluindo_brasilia": 319, "sem_brasilia": 318},
                "violencia_sim": {"estado": "NAO_ADQUIRIDO", "motivo": "Aquisição municipal reproduzível do SIM ainda não preservada nesta edição"}}
    seed.mkdir(parents=True, exist_ok=True)
    for name, raw in pending.items():
        (seed / name).write_bytes(raw)
    (seed / "manifesto.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    return manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, default=Path("/tmp/obee_bmc_2022"))
    args = parser.parse_args()
    manifest = collect(args.cache)
    print(json.dumps({"municipios": len(manifest["municipios"]), "fontes": len(manifest["fontes"])}, ensure_ascii=False))
