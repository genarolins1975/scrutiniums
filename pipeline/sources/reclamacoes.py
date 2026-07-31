"""Conector Ranking de Reclamações do BCB (rdrweb) — risco operacional/reputacional.

CSV público (latin-1, ';') por trimestre com CNPJ, instituição, índice de reclamações
(reclamações procedentes ajustadas por nº de clientes), quantidades e base de clientes.
Uso na plataforma: indicador de risco operacional/reputacional — NUNCA medida de solvência.
"""
import csv
import io
import json
import time

from pipeline import common


def _periods(catalog, n):
    """Últimos n períodos TRIMESTRAIS disponíveis, mais recentes primeiro."""
    out = []
    for ano in reversed(catalog.get("anos", [])):
        for p in ano.get("periodicidades", []):
            if p["periodicidade"] != "TRIMESTRAL":
                continue
            for per in sorted((x["periodo"] for x in p["periodos"]), reverse=True):
                out.append((int(ano["ano"]), per))
    return out[:n]


def collect(con, cfg):
    c = cfg.get("reclamacoes")
    if not c:
        return [{"key": "reclamacoes", "ok": False, "error": "sem configuração"}]
    con.execute("""CREATE TABLE IF NOT EXISTS reclamacoes(
        ano INTEGER, trimestre INTEGER, cnpj TEXT, nome TEXT, indice REAL,
        reclamacoes_reguladas INTEGER, clientes REAL, posicao INTEGER,
        PRIMARY KEY(ano, trimestre, posicao))""")
    results = []
    try:
        body, meta = common.http_get(c["base_url"] + "?ano=2026", timeout=45)
        catalog = json.loads(body)
        periods = _periods(catalog, c.get("ultimos_trimestres", 4))
    except Exception as e:
        return [{"key": "reclamacoes", "ok": False, "error": f"catálogo: {e}"}]
    for ano, tri in periods:
        try:
            url = (f"{c['base_url']}/arquivo?ano={ano}&periodicidade=TRIMESTRAL&periodo={tri}"
                   f"&tipo={c['tipo'].replace(' ', '%20')}")
            body, meta = common.http_get(url, timeout=60)
            bronze, sha = common.save_bronze("reclamacoes", f"ranking_{ano}T{tri}", body, meta)
            text = body.decode("latin-1")
            rows = list(csv.DictReader(io.StringIO(text), delimiter=";"))
            n = 0
            for pos, r in enumerate(rows, start=1):
                def g(*names):
                    for nm in names:
                        for k in r:
                            if nm in k:
                                return r[k]
                    return None
                cnpj = (g("CNPJ") or "").strip()
                nome = (g("Institui") or "").strip()
                if not nome:
                    continue
                indice_raw = (g("ndice") or "").replace(".", "").replace(",", ".").strip()
                try:
                    indice = float(indice_raw)
                except ValueError:
                    indice = None  # ausência não é zero
                recl = g("respondidas")
                cli = g("clientes", "CCS")
                def num(x):
                    try:
                        return float((x or "").replace(".", "").replace(",", "."))
                    except ValueError:
                        return None
                con.execute("INSERT OR REPLACE INTO reclamacoes VALUES(?,?,?,?,?,?,?,?)",
                            (ano, tri, cnpj, nome, indice, num(recl), num(cli), pos))
                n += 1
            common.record_lineage(con, f"reclamacoes:{ano}T{tri}", bronze, sha,
                                  "CSV latin-1 do rdrweb; índice com vírgula decimal; posição = ordem do arquivo")
            results.append({"key": f"reclamacoes_{ano}T{tri}", "ok": True, "instituicoes": n})
            time.sleep(1)
        except Exception as e:
            results.append({"key": f"reclamacoes_{ano}T{tri}", "ok": False, "error": str(e)})
    return results
