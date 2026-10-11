"""Adaptadores de evidências existentes e gate de elegibilidade. Python stdlib.

Executar: python3 -m pipeline.eficiencia_escores.fundacao --output /tmp/obee.json
O relatório é diagnóstico: não altera o contrato nem os arquivos públicos.
"""
import argparse
import csv
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PILLARS = ("access", "response", "quality")


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def normalize(value, reference):
    if value is None or not reference.get("validated"):
        return None
    low, high = reference.get("lower"), reference.get("upper")
    if not all(finite(x) for x in (value, low, high)) or high <= low:
        raise ValueError("Valor ou referência inválida")
    direction = reference.get("direction")
    if direction not in ("higher", "lower"):
        raise ValueError("Sentido inválido")
    score = 100 * (value - low) / (high - low)
    return min(100, max(0, score if direction == "higher" else 100 - score))


def aggregate(records, required_ids, *, territory, edition, comparison_window):
    """A ordem e a cobertura da cesta são fixas; todos os bloqueios são mantidos."""
    if not required_ids or len(set(required_ids)) != len(required_ids):
        raise ValueError("Cesta vazia ou duplicada")
    if not all(isinstance(x, str) and x for x in (territory, edition, comparison_window)):
        raise ValueError("Contexto obrigatório")
    ids = [r["id"] for r in records]
    if len(set(ids)) != len(ids) or set(ids) - set(required_ids):
        raise ValueError("Componente duplicado ou fora da cesta")
    by_id = {r["id"]: r for r in records}
    reasons, values = [], []
    for key in required_ids:
        r = by_id.get(key)
        if not r or r.get("value") is None:
            reasons.append({"id": key, "reason": "COBERTURA_INSUFICIENTE"})
            continue
        if not finite(r["value"]) or not 0 <= r["value"] <= 100:
            reasons.append({"id": key, "reason": "DADO_INVALIDO"})
        if r.get("validated") is not True:
            reasons.append({"id": key, "reason": "REFERENCIA_PENDENTE"})
        if any(r.get(k) != v for k, v in (("territory", territory), ("edition", edition), ("comparison_window", comparison_window))):
            reasons.append({"id": key, "reason": "RECORTE_INCOMPATIVEL"})
        if r.get("state") != "CALCULAVEL_EXPERIMENTAL":
            reasons.append({"id": key, "reason": "ESTADO_INELEGIVEL"})
        values.append(r["value"])
    if reasons:
        return {"value": None, "state": "BLOQUEADO", "reasons": reasons}
    value = 0 if 0 in values else math.exp(sum(math.log(v) for v in values) / len(values))
    return {"value": value, "state": "CALCULAVEL_EXPERIMENTAL", "reasons": []}


def validate_cards(document):
    expected = {f"{c}.{p}" for c in document["basket"] for p in PILLARS}
    cards = document["cards"]
    ids = [c["id"] for c in cards]
    if len(ids) != len(set(ids)) or set(ids) != expected:
        raise ValueError("Matriz não contém exatamente os pilares da cesta")
    for c in cards:
        if c["id"] != f'{c["chapter"]}.{c["pillar"]}':
            raise ValueError("Identificador inconsistente")
        for key in ("formula", "denominator", "available_evidence", "source_path", "source_commit", "next_action"):
            if not c.get(key):
                raise ValueError(f"Ficha sem {key}")
        if c["reference"]["validated"] or document["validated"]:
            raise ValueError("Esta edição diagnóstica não autoriza notas validadas")
        if not c["blockers"]:
            raise ValueError("Ficha bloqueada sem justificativa")


def provenance(path, root):
    return {"path": str(path.relative_to(root)), "sha256_bytes": hashlib.sha256(path.read_bytes()).hexdigest()}


def education_evidence(root, territories, year):
    path = root / "public/eficiencia/series/edu_saeb_rede_municipal.csv"
    origin = provenance(path, root)
    output, seen = [], set()
    with path.open(encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            if row["codigo_ibge"] not in territories or row["ano"] != str(year):
                continue
            if row["etapa"] != "Ensino fundamental, anos iniciais" or row["componente"] != "portugues":
                continue
            key = row["codigo_ibge"]
            if key in seen:
                raise ValueError("Saeb duplicado no recorte")
            seen.add(key)
            if row["indicador_id"] != "edu.saeb.rede_municipal":
                raise ValueError("Indicador inesperado")
            raw = row["valor"].strip()
            value = float(raw) if raw else None
            if value is not None and not finite(value):
                raise ValueError("Valor Saeb inválido")
            output.append({"indicator": row["indicador_id"], "territory": key,
                "territory_name": row["capital"], "geography": "municipality",
                "period": row["ano"], "stage": row["etapa"], "component": row["componente"],
                "raw_value": value, "unit": row["unidade"], "universe": row["universo"],
                "source_state": row["status"], "raw_comparison_eligible": row["elegivel_comparacao"],
                "source_locator": row["registro"], "source_id": row["fonte"],
                "source_generated_at": row["dados_gerados_em"], "provenance": origin,
                "score": None, "score_state": "REFERENCIA_PENDENTE",
                "role": "CANDIDATO_QUALIDADE_NAO_VALIDADO"})
    if seen != set(territories):
        raise ValueError("Território ausente no piloto; não substituir por UF")
    return sorted(output, key=lambda r: r["territory"])


def food_context(root, year):
    path = root / "public/eficiencia/seguranca-alimentar/panorama.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    rows = [r for r in data["needs"] if r["year"] == year and r["territory"] in ("Nordeste", "Sul")]
    if len(rows) != 2 or len({r["territory"] for r in rows}) != 2:
        raise ValueError("Recorte regional alimentar incompleto ou duplicado")
    for r in rows:
        if not finite(r["secure"]) or not 0 <= r["secure"] <= 100:
            raise ValueError("Percentual alimentar inválido")
    return [{"indicator": "food.households_secure", "territory": r["territory"],
        "geography": "region", "period": str(year), "raw_value": r["secure"],
        "unit": "% de domicílios", "role": "CONTEXTO_NAO_PONTUA", "score": None,
        "source_page": data["manifest"]["source_page"], "sources": data["manifest"]["sources"],
        "provenance": provenance(path, root)} for r in rows]


def build(root=ROOT):
    doc = json.loads((root / "pipeline/eficiencia_escores/fichas.json").read_text(encoding="utf-8"))
    validate_cards(doc)
    observations = education_evidence(root, ("2611606", "4106902"), 2023)
    profiles = []
    for observation in observations:
        chapters = [{"id": c, "value": None, "state": "COBERTURA_INSUFICIENTE",
            "pillars": [{"id": card["id"], "value": None, "state": card["status"], "reasons": card["blockers"]}
                for card in doc["cards"] if card["chapter"] == c]} for c in doc["basket"]]
        profiles.append({"territory": observation["territory"], "name": observation["territory_name"],
            "edition": doc["edition"], "reference_period": None,
            "chapters": chapters, "aggregate": aggregate(chapters, doc["basket"],
                territory=observation["territory"], edition=doc["edition"], comparison_window="PILOTO_SEM_JANELA_VALIDADA")})
    return {"schema_version": 1, "purpose": "DIAGNOSTICO_INTERNO_NAO_PUBLICA_ESCORE",
        "edition": doc["edition"], "validated": False,
        "summary": {"cards": len(doc["cards"]), "validated_pillars": 0, "numeric_aggregate_scores": 0},
        "observations": observations, "regional_context_not_city_scores": food_context(root, 2024),
        "profiles": profiles}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if (ROOT / "public").resolve() in args.output.resolve().parents:
        parser.error("Diagnóstico não deve ser gravado em public/")
    report = build()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps(report["summary"], ensure_ascii=False))


if __name__ == "__main__":
    main()
