"""Motor de alertas explicáveis, baseado em regras configuráveis (config.json → alerts.rules).

Cada alerta emitido carrega: regra, série, valor observado, limiar, nível, explicação e linhagem.
Regras de usuário (front-end) usam o mesmo formato e são avaliadas no navegador sobre os JSON gold.
"""
from datetime import date

from pipeline import common
from pipeline.indicators import _yoy


def _delta(series, k):
    if len(series) <= k:
        return None
    return series[-1][1] - series[-1 - k][1]


def evaluate(con, cfg, today=None):
    today = today or date.today().isoformat()
    alerts = []
    for rule in cfg["alerts"]["rules"]:
        if rule["series"] == "*" and rule["metric"] == "staleness_days":
            stale_list = []
            cur = con.execute("SELECT key FROM series_meta")
            for (key,) in cur.fetchall():
                s = common.get_series(con, key)
                if not s:
                    continue
                meta = common.get_meta(con, key)
                freq = (meta.get("freq") or "").lower()
                if "mensal" not in freq:
                    continue  # regra de atualidade calibrada para séries mensais
                stale = (date.fromisoformat(today) - date.fromisoformat(s[-1][0])).days
                if stale > rule["threshold"]:
                    stale_list.append((key, meta["name"], stale))
            # agrega para não inundar o painel: 1 alerta consolidado quando muitas séries
            if len(stale_list) > 3:
                worst = sorted(stale_list, key=lambda x: -x[2])[:3]
                alerts.append({
                    "id": rule["id"], "nivel": rule["level"],
                    "titulo": f"{len(stale_list)} séries mensais além do limiar de atualidade ({rule['threshold']} dias desde a referência)",
                    "explicacao": ("Defasagem conta a partir da data de referência (inclui o atraso normal de publicação da fonte). "
                                   "Mais defasadas: " + "; ".join(f"{n} ({d} dias)" for _, n, d in worst) +
                                   ". Ausência de dado novo NÃO foi interpretada como zero."),
                    "serie": "*", "valor": len(stale_list), "limiar": rule["threshold"], "fonte": "múltiplas",
                })
            else:
                for key, name, stale in stale_list:
                    alerts.append({
                        "id": f"{rule['id']}:{key}", "nivel": rule["level"],
                        "titulo": f"Série '{name}' sem atualização há {stale} dias",
                        "explicacao": f"Última referência conhecida; limiar: {rule['threshold']} dias. Ausência de dado novo NÃO foi interpretada como zero.",
                        "serie": key, "valor": stale, "limiar": rule["threshold"], "fonte": common.get_meta(con, key)["source"],
                    })
            continue
        s = common.get_series(con, rule["series"])
        meta = common.get_meta(con, rule["series"])
        if not s or not meta:
            continue
        metric = rule["metric"]
        if metric == "level":
            val = s[-1][1]
        elif metric == "delta_3m":
            val = _delta(s, 3)
        elif metric == "yoy":
            yy = _yoy(s)
            val = yy[-1][1] if yy else None
        else:
            val = None
        if val is None:
            continue
        fired = val > rule["threshold"] if rule["direction"] == "up" else val < rule["threshold"]
        if fired:
            alerts.append({
                "id": rule["id"], "nivel": rule["level"], "titulo": rule["label"],
                "explicacao": (f"{meta['name']}: {metric} = {val:.2f} {'acima' if rule['direction']=='up' else 'abaixo'} do limiar {rule['threshold']} "
                               f"(referência {s[-1][0]}, fonte {meta['source']}, série {meta['series_code']})."),
                "serie": rule["series"], "valor": round(val, 3), "limiar": rule["threshold"],
                "fonte": meta["source"], "ref": s[-1][0],
                # os 24 meses da própria série NO alerta: um Δ sem a curva ao
                # lado induz leitura sem contexto (achado da auditoria de 12/08)
                "serie_recente": [{"p": p2, "v": round(v2, 3)} for p2, v2 in s[-24:]],
            })
    order = {"critico": 0, "relevante": 1, "atencao": 2, "informativo": 3}
    alerts.sort(key=lambda a: order.get(a["nivel"], 9))

    # histórico + controle de ruído: persiste cada disparo e marca recorrência
    con.execute("""CREATE TABLE IF NOT EXISTS alerts_history(
        run_at TEXT, alert_id TEXT, nivel TEXT, titulo TEXT, valor REAL)""")
    run_at = common.now_utc()
    cur = con.execute("SELECT alert_id, COUNT(DISTINCT run_at) FROM alerts_history GROUP BY alert_id")
    prev_counts = dict(cur.fetchall())
    for a in alerts:
        a["disparos_anteriores"] = prev_counts.get(a["id"], 0)
        a["recorrente"] = a["disparos_anteriores"] > 0
        con.execute("INSERT INTO alerts_history(run_at, alert_id, nivel, titulo, valor) VALUES(?,?,?,?,?)",
                    (run_at, a["id"], a["nivel"], a["titulo"], a.get("valor")))
    return alerts


def history(con, limit=80):
    con.execute("""CREATE TABLE IF NOT EXISTS alerts_history(
        run_at TEXT, alert_id TEXT, nivel TEXT, titulo TEXT, valor REAL)""")
    cur = con.execute("""SELECT run_at, alert_id, nivel, titulo, valor FROM alerts_history
                         ORDER BY run_at DESC LIMIT ?""", (limit,))
    return [dict(zip(["run_at", "alert_id", "nivel", "titulo", "valor"], r)) for r in cur.fetchall()]
