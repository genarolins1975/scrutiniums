"""Conector BCB — Expectativas de mercado (Focus), API Olinda.

Fonte: https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/
- ExpectativasMercadoAnuais: mediana, média, desvio-padrão, mínimo, máximo e número de
  respondentes por indicador e ano de referência, a cada divulgação (sextas-feiras).
  baseCalculo 0 = todos os respondentes dos últimos 30 dias; 1 = só os que atualizaram
  nos últimos 5 dias úteis. O painel usa a base 0.
- ExpectativasMercadoSelic: trajetória esperada da Selic por reunião do Copom.

O que vira silver: focus_anual(data, indicador, ref, mediana, media, dp, minimo, maximo, n)
para Selic, IPCA, PIB Total, Câmbio e Taxa de desocupação, desde 2024 (histórico das
expectativas para cada ano); focus_selic(data, reuniao, mediana, n). Idempotente por hash
da resposta; cada execução pede as divulgações dos últimos 400 dias, que cobrem a revisão
de qualquer ponto já gravado.
"""
import json
from datetime import date, timedelta

from pipeline import common

BASE = "https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/"
INDICADORES = ["Selic", "IPCA", "PIB Total", "Câmbio", "Taxa de desocupação"]
DIAS_HISTORIA = 400


def _ensure(con):
    con.execute("""CREATE TABLE IF NOT EXISTS focus_anual(
        data TEXT, indicador TEXT, ref TEXT, mediana REAL, media REAL, dp REAL, minimo REAL, maximo REAL, n INTEGER,
        PRIMARY KEY(data, indicador, ref))""")
    con.execute("CREATE TABLE IF NOT EXISTS focus_selic(data TEXT, reuniao TEXT, mediana REAL, n INTEGER, PRIMARY KEY(data, reuniao))")
    con.execute("CREATE TABLE IF NOT EXISTS focus_coleta(recurso TEXT PRIMARY KEY, sha TEXT, collected_at TEXT)")


def _get(recurso, filtro, select):
    from urllib.parse import quote
    url = f"{BASE}{recurso}?$filter={quote(filtro)}&$select={select}&$format=json&$top=100000"
    body, meta = common.http_get(url, timeout=180)
    return json.loads(body)["value"], body, meta, url


def collect(con, cfg):
    _ensure(con)
    results = []
    desde = (date.today() - timedelta(days=DIAS_HISTORIA)).isoformat()
    for ind in INDICADORES:
        key = f"focus:{ind}"
        try:
            rows, body, meta, url = _get("ExpectativasMercadoAnuais", f"Data ge '{desde}' and Indicador eq '{ind}' and baseCalculo eq 0",
                                         "Indicador,Data,DataReferencia,Mediana,Media,DesvioPadrao,Minimo,Maximo,numeroRespondentes")
            bronze_file, sha = common.save_bronze("focus", f"anuais_{ind.replace(' ', '_')}", body, meta)
            ja = con.execute("SELECT sha FROM focus_coleta WHERE recurso=?", (key,)).fetchone()
            if ja and ja[0] == sha:
                results.append({"key": key, "ok": True, "nota": "inalterado (hash)"})
                continue
            con.executemany("INSERT OR REPLACE INTO focus_anual VALUES(?,?,?,?,?,?,?,?,?)",
                            [(r["Data"], ind, str(r["DataReferencia"]), r.get("Mediana"), r.get("Media"), r.get("DesvioPadrao"), r.get("Minimo"), r.get("Maximo"), r.get("numeroRespondentes")) for r in rows])
            con.execute("INSERT OR REPLACE INTO focus_coleta VALUES(?,?,?)", (key, sha, common.now_utc()))
            common.record_lineage(con, "scenario.json", bronze_file, sha, f"BCB Focus, expectativas anuais de {ind} (base 0), últimos {DIAS_HISTORIA} dias de divulgação")
            con.commit()
            results.append({"key": key, "ok": True, "linhas": len(rows)})
        except Exception as e:
            results.append({"key": key, "ok": False, "error": str(e)[:160]})
    try:
        rows, body, meta, url = _get("ExpectativasMercadoSelic", f"Data ge '{(date.today() - timedelta(days=45)).isoformat()}' and baseCalculo eq 0",
                                     "Data,Reuniao,Mediana,numeroRespondentes")
        bronze_file, sha = common.save_bronze("focus", "selic_reunioes", body, meta)
        con.executemany("INSERT OR REPLACE INTO focus_selic VALUES(?,?,?,?)", [(r["Data"], r["Reuniao"], r.get("Mediana"), r.get("numeroRespondentes")) for r in rows])
        con.execute("INSERT OR REPLACE INTO focus_coleta VALUES(?,?,?)", ("focus:selic_reunioes", sha, common.now_utc()))
        common.record_lineage(con, "scenario.json", bronze_file, sha, "BCB Focus, Selic esperada por reunião do Copom (base 0)")
        con.commit()
        results.append({"key": "focus:selic_reunioes", "ok": True, "linhas": len(rows)})
    except Exception as e:
        results.append({"key": "focus:selic_reunioes", "ok": False, "error": str(e)[:160]})
    return results
