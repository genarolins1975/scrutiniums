"""Reconcilia capitais congeladas e produz a camada municipal descritiva."""
import csv
import hashlib
import io
import json
import math
import unicodedata

from pipeline.eficiencia_resultados.precisao_saude import poisson_interval
from .coletar import UF, REGIONS
from .contrato import ROOT, HERE, PRIMARY, read_catalog, size_group, verify_frozen
from .padroniza import normalize

OUT = ROOT / "public/eficiencia/base_comparavel_2022"


def read(relative):
    raw = (ROOT / relative).read_bytes()
    return json.loads(raw), hashlib.sha256(raw).hexdigest()


def alphabetical(city):
    return "".join(c for c in unicodedata.normalize("NFD", city["nome"]) if not unicodedata.combining(c)).casefold(), city["id"]


def observation(city, measure, value, source, *, numerator=None, denominator=None, reason="", precision=None):
    return {"municipio": city["id"], "nome": city["nome"], "medida": measure["id"], "valor": value,
            "unidade": measure["unidade"], "periodo": measure["periodo"], "ano_referencia": measure["ano_referencia"],
            "estado": "OBSERVADO" if value is not None else "NAO_DISPONIVEL",
            "alinhamento": measure["alinhamento"], "marca_alinhamento": measure["alinhamento"],
            "desvios": measure["desvios"], "precisao": measure["precisao"],
            "ressalva_precisao": measure["ressalva_precisao"], "motivo_ausencia": reason,
            "numerador": numerator, "denominador": denominator,
            "erro_padrao": precision["erro_padrao"] if precision else None,
            "intervalo_95": precision["intervalo_95"] if precision else None,
            "fonte": measure["fonte"], "arquivo_fonte": source["arquivo"],
            "capturado_em": source["capturado_em"], "sha256": source["sha256"]}


def capitals(catalog):
    pilot, ph = read("docs/obee/resultados/piloto-2022-v2.json")
    candidates, ch = read("docs/obee/resultados/cesta-conjunta.json")
    evidence, eh = read("pipeline/eficiencia_resultados/seed/expansao-2022.json")
    health, hh = read("docs/obee/resultados/saude-contagens-2021-2023.json")
    panorama, _ = read("src/lib/eficiencia/panorama-atlas.json")
    if len(pilot["rows"]) != 26 or len(health["rows"]) != 26:
        raise ValueError("Capitais congeladas incompletas")
    measures = {m["id"]: m for m in catalog["medidas"]}
    violence = {r["id"]: r for r in evidence["violence"]}
    health_rows = {r["id"]: r for r in health["rows"]}
    scenario = next(s for s in candidates["scenarios"] if s["id"] == "conjunta__domicilios_gt2__materiais_40pct")
    housing = {r["id"]: r["candidate_raw_pct"] for r in scenario["rows"]}
    legacy = {m["id"]: m for m in panorama["metrics"]}
    sources = {}
    for measure, old in (("educacao", "educacao"), ("renda", "trabalho"), ("mobilidade", "mobilidade"), ("aps", "saude")):
        m = legacy[old]
        if hashlib.sha256((ROOT / m["sourcePath"]).read_bytes()).hexdigest() != m["sourceHash"]:
            raise ValueError("Entrada canônica do panorama alterada")
        sources[measure] = {"arquivo": m["sourcePath"], "sha256": m["sourceHash"], "capturado_em": m["capturedAt"], "consultas": m["sourceQueries"]}
    sources["saneamento"] = {"arquivo": "pipeline/eficiencia_resultados/seed/expansao-2022.json", "sha256": eh, "capturado_em": evidence["inspected_at_utc"]}
    sources["homicidios"] = dict(sources["saneamento"])
    for measure, manifest_path in (("habitacao", "pipeline/eficiencia_resultados/seed/habitacao/manifest.json"),
                                  ("internet", "pipeline/eficiencia_resultados/seed/conectividade/manifest.json")):
        manifest, _ = read(manifest_path)
        # O valor é exatamente o da cesta congelada; os recortes oficiais são
        # vinculados no manifesto e também integram o pacote verificado.
        sources[measure] = {"arquivo": "docs/obee/resultados/cesta-conjunta.json", "sha256": ch,
                            "capturado_em": manifest["captured_at"], "fontes_primarias": manifest["sources"]}
    sources["mortalidade_infantil"] = {"arquivo": "docs/obee/resultados/saude-contagens-2021-2023.json", "sha256": hh,
                                      "capturado_em": health["source_manifest"]["acquired_on"]}
    cities, rows, capacity, registered = [], [], [], []
    for row in pilot["rows"]:
        ident = row["id"]
        v, h = violence[ident], health_rows[ident]
        city = {"id": ident, "nome": row["name"], "uf": UF[ident[:2]], "grande_regiao": REGIONS[ident[0]],
                "populacao": v["population"], "capital": True}
        cities.append(city)
        values = {"educacao": row["raw_values"]["educacao"], "renda": row["raw_values"]["trabalho"],
                  "mobilidade": row["raw_values"]["mobilidade"], "saneamento": row["raw_values"]["saneamento"],
                  "habitacao": housing[ident]["habitacao"], "internet": housing[ident]["conectividade"],
                  "homicidios": v["value"], "mortalidade_infantil": h["pooled_rate_per_1000"]}
        interval = poisson_interval(h["deaths_total"], h["live_births_total"])
        precision = {"erro_padrao": 1000 * math.sqrt(h["deaths_total"]) / h["live_births_total"],
                     "intervalo_95": [interval["lower_95"], interval["upper_95"]]}
        for measure in PRIMARY:
            rows.append(observation(city, measures[measure], values[measure], sources[measure],
                numerator=h["deaths_total"] if measure == "mortalidade_infantil" else None,
                denominator=h["live_births_total"] if measure == "mortalidade_infantil" else None,
                precision=precision if measure == "mortalidade_infantil" else None))
        aps = next(o for o in legacy["saude"]["observations"] if o["territory"] == ident)
        capacity.append(observation(city, measures["aps"], aps["value"], sources["aps"], numerator=aps["numerator"], denominator=aps["denominator"]))
        registered.append(observation(city, measures["homicidios_registrados"], v["registered_rate"], sources["homicidios"],
                                      numerator=v["registered"], denominator=v["population"]))
    return sorted(cities, key=alphabetical), rows, sources, capacity, registered, {"piloto_sha256": ph, "cesta_sha256": ch}


def quantile(values, probability):
    if not values:
        return None
    index = (len(values) - 1) * probability
    lo, hi = math.floor(index), math.ceil(index)
    return values[lo] + (values[hi] - values[lo]) * (index - lo)


def distribution(rows, members):
    by_city = {o["municipio"]: o for o in rows}
    values = sorted(by_city[c]["valor"] for c in members if by_city[c]["valor"] is not None)
    return {"municipios": members, "n_universo": len(members), "n_observados": len(values),
            "n_ausentes": len(members) - len(values), "cobertura_completa": len(values) == len(members),
            "minimo": min(values) if values else None, "q1": quantile(values, .25),
            "mediana": quantile(values, .5), "q3": quantile(values, .75), "maximo": max(values) if values else None}


def distributions(cities, rows):
    result = {}
    memberships = {"universo": [c["id"] for c in cities]}
    for city in cities:
        memberships.setdefault("porte:" + size_group(city["populacao"]), []).append(city["id"])
        memberships.setdefault("regiao:" + city["grande_regiao"], []).append(city["id"])
    for measure in PRIMARY:
        selected = [r for r in rows if r["medida"] == measure]
        result[measure] = {group: distribution(selected, members) for group, members in memberships.items()}
    return result


def build(*, only_capitals=False):
    frozen = verify_frozen()
    catalog = read_catalog()
    cities, capital_rows, legacy_sources, capacity, registered, reconciliation = capitals(catalog)
    frozen_capital_ids = {c["id"] for c in cities}
    measures = {m["id"]: m for m in catalog["medidas"]}
    catalog_hash = hashlib.sha256((HERE / "contrato.json").read_bytes()).hexdigest()
    rows, sources, checks, alternatives = capital_rows, legacy_sources, [], []
    status = "CAPITAIS_RECONCILIADAS_UNIVERSO_PENDENTE"
    sim = {"estado": "NAO_ADQUIRIDO", "motivo": "Universo ampliado ainda não adquirido"}
    if not only_capitals:
        manifest_path = HERE / "seed/manifesto.json"
        if not manifest_path.exists():
            raise ValueError("Seed dos 318 municípios ausente; adquirir o SIDRA antes de promover a BMC")
        manifest = json.loads(manifest_path.read_text())
        cities = sorted(manifest["municipios"], key=alphabetical)
        if len(cities) != 318 or len({c["id"] for c in cities}) != 318 or any(c["id"] == "5300108" for c in cities):
            raise ValueError("Universo de referência divergente")
        datasets, source_index = {}, {}
        for source in manifest["fontes"]:
            raw = (HERE / "seed" / source["arquivo"]).read_bytes()
            if hashlib.sha256(raw).hexdigest() != source["sha256"]:
                raise ValueError("Hash do seed divergente: " + source["arquivo"])
            if source["arquivo"].endswith("_metadata.json") or source["tabela"] == 4714:
                if source["tabela"] == 4714:
                    population = json.loads(raw)
                    population_by_city = {r["D1C"]: r for r in population[1:]}
                    if len(population_by_city) != 318 or set(population_by_city) != {c["id"] for c in cities}:
                        raise ValueError("Recorte populacional divergente do universo")
                    for city in cities:
                        p = population_by_city[city["id"]]
                        if (p["NC"], p["D2C"], p["D3C"]) != ("6", "93", "2022") or int(p["V"]) != city["populacao"] or city["populacao"] < 100_000:
                            raise ValueError("Grupo de porte diverge da população oficial")
                        if city["grande_regiao"] != REGIONS[city["id"][0]] or city["uf"] != UF[city["id"][:2]]:
                            raise ValueError("Grupo territorial divergente da identidade IBGE")
                continue
            datasets[source["tabela"]] = normalize(source["tabela"], json.loads(raw), cities)
            source_index[source["tabela"]] = dict(source, arquivo="pipeline/eficiencia_comparavel/seed/" + source["arquivo"])
        frozen_values = {(o["municipio"], o["medida"]): o for o in capital_rows}
        capital_ids = {c["id"] for c in cities if c["capital"]}
        if capital_ids != frozen_capital_ids:
            raise ValueError("Capitais da referência divergentes da coorte congelada")
        rows = []
        for city in cities:
            for measure_id in PRIMARY:
                measure = measures[measure_id]
                canonical = frozen_values.get((city["id"], measure_id))
                if measure["tabela"] is not None:
                    data = datasets[measure["tabela"]][city["id"]]
                    value = data["valor"]
                    source = source_index[measure["tabela"]]
                    if canonical:
                        if value is None or abs(value - canonical["valor"]) > .5 * 10 ** -measure["casas_publicadas"]:
                            raise ValueError(f"Capital não reconcilia na precisão publicada: {city['nome']} / {measure_id}")
                        checks.append({"municipio": city["id"], "medida": measure_id, "valor_congelado": canonical["valor"],
                                       "valor_consulta": value, "diferenca": value - canonical["valor"],
                                       "tolerancia_arredondamento": .5 * 10 ** -measure["casas_publicadas"]})
                        item = dict(canonical, numerador=data["numerador"], denominador=data["denominador"],
                                    valor_consulta=value, sha256_consulta=source["sha256"])
                    else:
                        item = observation(city, measure, value, source, numerator=data["numerador"], denominator=data["denominador"],
                                           reason="Célula não disponível ou suprimida na fonte" if value is None else "")
                    rows.append(item)
                elif canonical:
                    rows.append(canonical)
                else:
                    rows.append(observation(city, measure, None, legacy_sources[measure_id],
                                           reason="O recorte auditado da fonte contém somente as 26 capitais"))
            houses, residents = datasets[9934][city["id"]], datasets[9940][city["id"]]
            alternatives.append({"municipio": city["id"], "natureza": "SENSIBILIDADE_DE_DEFINICAO",
                                 "domicilios_acima_dois": houses["valor"], "domicilios_acima_tres": houses["alternativa_acima_tres"],
                                 "moradores_acima_dois": residents["valor"], "moradores_acima_tres": residents["alternativa_acima_tres"],
                                 "erro_padrao": None, "intervalo_95": None})
        sources = {**legacy_sources, **{str(k): v for k, v in source_index.items()}}
        status = "UNIVERSO_ADQUIRIDO_E_RECONCILIADO"
        sim = manifest["violencia_sim"]
    result = {"versao": "BMC_2022_v1", "natureza": "CAMADA_DESCRITIVA", "ano_referencia": 2022, "estado": status,
              "contrato_sha256": catalog_hash, "medidas": catalog["medidas"], "municipios": cities,
              "capitais": sorted(capital_rows, key=lambda r: (r["nome"], PRIMARY.index(r["medida"]))),
              "observacoes": rows, "capacidade_servicos": capacity, "homicidios_registrados_capitais": registered,
              "violencia_sim_universo": sim, "fontes": sources, "reconciliacao": {**reconciliation, "consultas": checks},
              "sensibilidade_habitacao": alternatives, "pacote_v3": frozen,
              "grupos_de_pares": catalog["grupos_de_pares"],
              "distribuicoes": distributions(cities, rows)}
    return result


def serialize(data):
    return (json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode()


def csv_bytes(data):
    stream = io.StringIO(newline="")
    fields = ["municipio", "nome", "medida", "periodo", "unidade", "valor", "estado", "alinhamento", "desvios",
              "precisao", "ressalva_precisao", "erro_padrao", "intervalo_inferior_95", "intervalo_superior_95",
              "fonte", "capturado_em", "sha256", "numerador", "denominador", "motivo_ausencia"]
    writer = csv.DictWriter(stream, fieldnames=fields, delimiter=";", lineterminator="\n")
    writer.writeheader()
    for row in sorted(data["observacoes"], key=lambda r: (alphabetical({"nome": r["nome"], "id": r["municipio"]}), PRIMARY.index(r["medida"]))):
        item = {k: row.get(k) for k in fields}
        item["desvios"] = " | ".join(row["desvios"])
        item["intervalo_inferior_95"] = row["intervalo_95"][0] if row["intervalo_95"] else None
        item["intervalo_superior_95"] = row["intervalo_95"][1] if row["intervalo_95"] else None
        for field in ("valor", "erro_padrao", "intervalo_inferior_95", "intervalo_superior_95", "numerador", "denominador"):
            if item[field] is not None:
                item[field] = str(item[field]).replace(".", ",")
        writer.writerow(item)
    return stream.getvalue().encode("utf-8-sig")
