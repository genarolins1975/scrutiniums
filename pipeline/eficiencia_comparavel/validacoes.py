"""Portão de promoção da BMC: cobertura, precisão, território e proveniência."""
import hashlib
import math
from .contrato import HERE, ROOT, PRIMARY, compare, read_catalog, validate_peer_variables


def validate(data, *, require_universe=True):
    catalog = read_catalog()
    measures = {m["id"]: m for m in catalog["medidas"]}
    if data["contrato_sha256"] != hashlib.sha256((HERE / "contrato.json").read_bytes()).hexdigest():
        raise ValueError("Gold vinculada a outro contrato")
    validate_peer_variables(data["grupos_de_pares"])
    cities = data["municipios"]
    ids = [c["id"] for c in cities]
    if len(ids) != len(set(ids)) or any(len(i) != 7 or not i.isdigit() or i.startswith("53") for i in ids):
        raise ValueError("Identidade municipal inválida, duplicada ou DF na coorte")
    if require_universe and (len(ids) != 318 or data["estado"] != "UNIVERSO_ADQUIRIDO_E_RECONCILIADO"):
        raise ValueError("Universo de 318 municípios ainda não validado")
    if len(data["capitais"]) != 208 or len({o["municipio"] for o in data["capitais"]}) != 26:
        raise ValueError("Capitais sem as 208 observações requeridas")
    rows = data["observacoes"]
    keys = [(o["municipio"], o["medida"]) for o in rows]
    if len(keys) != len(set(keys)) or set(keys) != {(ident, m) for ident in ids for m in PRIMARY}:
        raise ValueError("Observações incompletas ou duplicadas")
    source_hashes = {}
    for row in rows:
        measure = measures[row["medida"]]
        compare(row, row, measure)
        if row["unidade"] != measure["unidade"] or row["ressalva_precisao"] != measure["ressalva_precisao"]:
            raise ValueError("Unidade ou precisão divergente da ficha")
        if row["precisao"] != "QUANTIFICADA" and (row["erro_padrao"] is not None or row["intervalo_95"] is not None):
            raise ValueError("Incerteza não quantificada foi preenchida")
        if row["valor"] is not None and measure["precisao"] == "QUANTIFICADA":
            interval = row["intervalo_95"]
            if interval is None or row["erro_padrao"] is None or not all(math.isfinite(x) for x in interval):
                raise ValueError("Precisão quantificada sem parâmetros")
            if not interval[0] <= row["valor"] <= interval[1]:
                raise ValueError("Intervalo condicional inválido")
        if not row["capturado_em"] or len(row["sha256"]) != 64:
            raise ValueError("Proveniência incompleta")
        path = row["arquivo_fonte"]
        if path not in source_hashes:
            source_hashes[path] = hashlib.sha256((ROOT / path).read_bytes()).hexdigest()
        if source_hashes[path] != row["sha256"]:
            raise ValueError("Hash da observação não confere com sua entrada")
    if require_universe:
        for measure in (m for m in catalog["medidas"] if m["base_2022"] and m["alinhamento"] == "A"):
            if sum(r["medida"] == measure["id"] and r["estado"] == "OBSERVADO" for r in rows) != 318:
                raise ValueError("Medida A sem cobertura observada completa: " + measure["id"])
    for measure_id, groups in data["distribuicoes"].items():
        for group in groups.values():
            observed = [r["valor"] for r in rows if r["medida"] == measure_id and r["municipio"] in group["municipios"] and r["valor"] is not None]
            if group["n_observados"] != len(observed) or group["n_universo"] != len(group["municipios"]):
                raise ValueError("Cobertura da distribuição divergente")
            if observed and not group["minimo"] <= group["q1"] <= group["mediana"] <= group["q3"] <= group["maximo"]:
                raise ValueError("Quartis fora da distribuição")
    return data
