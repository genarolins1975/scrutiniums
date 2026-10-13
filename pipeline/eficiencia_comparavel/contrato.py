"""Contrato executável de alinhamento, precisão e grupos de referência."""
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).parent
CATALOG = HERE / "contrato.json"
SAMPLE_WARNING = ("Estimativa preliminar da amostra do Censo 2022. Precisão municipal "
                  "não quantificada; diferenças observadas não demonstram diferenças "
                  "estatisticamente significativas.")
PRIMARY = ("educacao", "renda", "mobilidade", "saneamento", "habitacao", "internet",
           "homicidios", "mortalidade_infantil")
PEER_VARIABLES = {"populacao_censo_2022", "grande_regiao"}
PRECISION = {"QUANTIFICADA", "NAO_QUANTIFICADA", "UNIVERSO", "NAO_APLICAVEL"}


def read_catalog():
    catalog = json.loads(CATALOG.read_text())
    measures = catalog["medidas"]
    ids = [m["id"] for m in measures]
    if len(ids) != len(set(ids)) or {m["id"] for m in measures if m["base_2022"]} != set(PRIMARY):
        raise ValueError("Catálogo incompleto ou com medidas duplicadas")
    for measure in measures:
        validate_measure(measure)
    validate_peer_variables(catalog["grupos_de_pares"])
    return catalog


def validate_measure(measure):
    alignment = measure["alinhamento"]
    deviations = measure["desvios"]
    if alignment not in {"A", "B", "C"} or measure["precisao"] not in PRECISION:
        raise ValueError("Classe de comparabilidade desconhecida")
    if alignment == "A" and deviations:
        raise ValueError("Medida A não admite desvio")
    if alignment == "B" and len(deviations) != 1:
        raise ValueError("Medida B exige exatamente um desvio declarado")
    if alignment != "C":
        if measure["nivel"] != "N6" or measure["base_geografica"] != "residencia":
            raise ValueError("Base 2022 exige município de residência")
        if measure["ano_referencia"] != 2022 or not measure["universo"]:
            raise ValueError("Referência ou universo incompatível")
        if measure["precisao"] == "NAO_APLICAVEL":
            raise ValueError("Precisão precisa ser classificada na base")
    elif measure["base_2022"]:
        raise ValueError("Medida C não integra a base 2022")
    if not measure["ressalva_precisao"]:
        raise ValueError("Ressalva de precisão obrigatória")
    if measure["amostra_censo"] and measure["ressalva_precisao"] != SAMPLE_WARNING:
        raise ValueError("Ressalva amostral divergente do contrato")


def validate_peer_variables(groups):
    if set(groups) != PEER_VARIABLES:
        raise ValueError("Pares só podem usar população do Censo e Grande Região")


def compare(first, second, measure, *, marked_b=True):
    """Recusa C e B sem marca; ausência produz diferença ausente, nunca zero."""
    validate_measure(measure)
    if measure["alinhamento"] == "C":
        raise ValueError("Medida C não pode ser justaposta à base 2022")
    if measure["alinhamento"] == "B" and not marked_b:
        raise ValueError("Medida B exige marca e motivo do desvio")
    for observation in (first, second):
        if observation["medida"] != measure["id"] or observation["municipio"] == "5300108":
            raise ValueError("Observação fora do contrato")
        if observation["alinhamento"] != measure["alinhamento"] or observation["precisao"] != measure["precisao"]:
            raise ValueError("Classificação divergente da ficha")
        if observation["ano_referencia"] != 2022 or observation["periodo"] != measure["periodo"]:
            raise ValueError("Período divergente do contrato")
        if measure["alinhamento"] == "B" and (observation.get("marca_alinhamento") != "B" or observation["desvios"] != measure["desvios"]):
            raise ValueError("Observação B sem marca e motivo do desvio")
        value = observation["valor"]
        if value is not None and (type(value) not in (int, float) or not math.isfinite(value)):
            raise ValueError("Valor inválido")
        if (value is None) != (observation["estado"] != "OBSERVADO"):
            raise ValueError("Estado e valor divergentes")
    a, b = first["valor"], second["valor"]
    return None if a is None or b is None else a - b


def verify_frozen():
    """Somente leitura: nunca chama freeze nem reconstrói os arquivos da v3."""
    raw = (ROOT / "docs/obee/resultados/revisao-v3-pacote.json").read_bytes()
    if hashlib.sha256(raw).hexdigest() != "bfd575fdc4c92ff23147999902ceb5a71a41892ca4e0ba1bf9da5e7379f11a6f":
        raise ValueError("Manifesto congelado alterado")
    packet = json.loads(raw)
    if len(packet["files"]) != 54 or len({r["path"] for r in packet["files"]}) != 54:
        raise ValueError("Inventário congelado divergente")
    for row in packet["files"]:
        if hashlib.sha256((ROOT / row["path"]).read_bytes()).hexdigest() != row["sha256"]:
            raise ValueError("Arquivo congelado alterado: " + row["path"])
    return {"arquivos": 54, "pacote_sha256": packet["packet_sha256"]}


def size_group(population):
    if type(population) is not int or population < 100_000:
        raise ValueError("Município fora do universo de referência")
    if population < 250_000:
        return "100_a_250_mil"
    if population < 500_000:
        return "250_a_500_mil"
    if population <= 1_000_000:
        return "500_mil_a_1_milhao"
    return "acima_de_1_milhao"
