"""Conector Ipeadata — API OData4 pública.

Inclui expedição de papelão ondulado (ABPO), indicador antecedente clássico de atividade.
Licença: uso livre com atribuição às fontes primárias.
"""
import json

from pipeline import common


def collect(con, cfg):
    results = []
    for s in cfg["ipeadata"]:
        url = f"http://www.ipeadata.gov.br/api/odata4/ValoresSerie(SERCODIGO='{s['sercodigo']}')"
        try:
            body, meta = common.http_get(url)
            data = json.loads(body)
            values = data.get("value", [])
            if not values:
                raise ValueError("sem valores")
            bronze_file, sha = common.save_bronze("ipeadata", s["sercodigo"], body, meta)
            rows = []
            for item in values:
                v = item.get("VALVALOR")
                if v is None:
                    continue
                rows.append((item["VALDATA"][:10], float(v)))
            common.upsert_meta(con, "Ipeadata", s["sercodigo"], s["key"], s["name"], s["unit"],
                               s["freq"], s["methodology"], s["url"], "macro", "antecedente")
            common.insert_obs(con, s["key"], sorted(rows), sha)
            common.record_lineage(con, f"series:{s['key']}", bronze_file, sha,
                                  "parse OData4 ValoresSerie; VALDATA->ISO date")
            results.append({"key": s["key"], "ok": True, "obs": len(rows)})
        except Exception as e:
            results.append({"key": s["key"], "ok": False, "error": str(e)})
    return results
