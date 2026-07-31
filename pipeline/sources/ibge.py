"""Conector IBGE — API de agregados (servicodados) e Sidra.

PNAD Contínua (desemprego, agregado 6381) e PIM-PF por atividade CNAE (tabela 8888).
Licença: uso livre com atribuição.
"""
import json

from pipeline import common

# Períodos "202604" da PNAD são trimestres móveis terminados no mês indicado.


def _pnad(con, cfg):
    c = cfg["ibge"]["pnad_desemprego"]
    body, meta = common.http_get(c["url"])
    data = json.loads(body)
    bronze_file, sha = common.save_bronze("ibge", "pnad_desemprego", body, meta)
    serie = data[0]["resultados"][0]["series"][0]["serie"]
    rows = []
    for period, v in sorted(serie.items()):
        if v in (None, "...", "-"):
            continue
        ref = f"{period[:4]}-{period[4:6]}-01"
        rows.append((ref, float(v)))
    common.upsert_meta(con, "IBGE", "6381/4099", c["key"], c["name"], c["unit"], c["freq"],
                       c["methodology"], c["url"], "macro", "emprego")
    common.insert_obs(con, c["key"], rows, sha)
    common.record_lineage(con, f"series:{c['key']}", bronze_file, sha,
                          "parse API v3 agregados; período AAAAMM->ISO (mês final do trimestre móvel)")
    return {"key": c["key"], "ok": True, "obs": len(rows)}


def _pim(con, cfg):
    c = cfg["ibge"]["pim_setorial"]
    body, meta = common.http_get(c["url"])
    data = json.loads(body)
    bronze_file, sha = common.save_bronze("ibge", "pim_setorial", body, meta)
    by_sector = {}
    sector_names = {}
    for row in data[1:]:  # linha 0 = cabeçalho
        v = row.get("V")
        if v in (None, "...", "-", ""):
            continue
        period = row["D3C"]  # AAAAMM
        sec_code, sec_name = row["D4C"], row["D4N"]
        ref = f"{period[:4]}-{period[4:6]}-01"
        by_sector.setdefault(sec_code, []).append((ref, float(v)))
        sector_names[sec_code] = sec_name
    n = 0
    for sec_code, rows in by_sector.items():
        key = f"pim_{sec_code}"
        common.upsert_meta(con, "IBGE", f"8888/12606/{sec_code}", key,
                           f"PIM-PF (2022=100) — {sector_names[sec_code]}", c["unit"], c["freq"],
                           c["methodology"], c["url"], "setorial", "atividade")
        common.insert_obs(con, key, sorted(rows), sha)
        n += len(rows)
    common.record_lineage(con, "series:pim_setorial", bronze_file, sha,
                          "parse Sidra t8888 v12606 c544; um key por atividade CNAE")
    return {"key": "pim_setorial", "ok": True, "obs": n, "setores": len(by_sector),
            "sector_names": sector_names}


def collect(con, cfg):
    results = []
    for fn in (_pnad, _pim):
        try:
            results.append(fn(con, cfg))
        except Exception as e:
            results.append({"key": fn.__name__, "ok": False, "error": str(e)})
    return results
