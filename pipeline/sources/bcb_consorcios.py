"""Conector BCB — Panorama de Consórcios (dados agregados do segmento), API Olinda.

Fonte: https://olinda.bcb.gov.br/olinda/servico/PANORAMA_DE_CONSORCIOS/versao/v1/odata/
- CadastroDeMetricas(): 125 métricas em 19 grupos (administradoras, PLA, grupos e cotas
  ativas, carteira, contemplações, exclusões, inadimplência, recursos coletados e a
  coletar, RNP, taxa de administração, valor médio e prazo médio dos grupos constituídos,
  cotas ativas por UF), com unidade declarada (unidade, mil, R$ mil, R$ milhões,
  R$ bilhões, %, meses).
- Metricas(DataBase=AAAAMM): valores de um trimestre (DataBase = fim de trimestre:
  03, 06, 09, 12). Trimestres sem dado devolvem lista vazia; o coletor registra a ausência
  e não grava zero.

Silver: consorcios(database, id_metrica, grupo, metrica, valor, unidade) e
consorcios_coleta(database, sha, collected_at, n). Os dois trimestres mais novos são
recoletados a cada REVISAO_DIAS dias (o BCB revisa a posição corrente); o histórico entra
uma vez. As séries anuais do SGS sobre consórcios (27452 a 27499) pararam em 2022 e ficam
fora por decisão editorial: dado parado não é dado.
"""
import json
from datetime import date

from pipeline import common

BASE = "https://olinda.bcb.gov.br/olinda/servico/PANORAMA_DE_CONSORCIOS/versao/v1/odata/"
INICIO = 2015
REVISAO_DIAS = 7
TRIMESTRES_JOVENS = 2


def _ensure(con):
    con.execute("""CREATE TABLE IF NOT EXISTS consorcios(
        database TEXT, id_metrica INTEGER, grupo TEXT, metrica TEXT, valor REAL, unidade TEXT,
        PRIMARY KEY(database, id_metrica))""")
    con.execute("CREATE TABLE IF NOT EXISTS consorcios_coleta(database TEXT PRIMARY KEY, sha TEXT, collected_at TEXT, n INTEGER)")


def _trimestres():
    hoje = date.today()
    out = []
    for ano in range(INICIO, hoje.year + 1):
        for mes in (3, 6, 9, 12):
            if (ano, mes) <= (hoje.year, hoje.month):
                out.append(f"{ano:04d}{mes:02d}")
    return out


def collect(con, cfg):
    _ensure(con)
    results = []
    tris = _trimestres()
    jovens = set(tris[-TRIMESTRES_JOVENS:])
    for db in tris:
        ja = con.execute("SELECT collected_at, n FROM consorcios_coleta WHERE database=?", (db,)).fetchone()
        if ja and (db not in jovens or common.coletado_recentemente(ja[0], REVISAO_DIAS)):
            continue
        url = f"{BASE}Metricas(DataBase=@DataBase)?@DataBase={db}&%24format=json&%24top=10000"
        try:
            body, meta = common.http_get(url, timeout=120)
            rows = json.loads(body).get("value", [])
            if not rows:
                con.execute("INSERT OR REPLACE INTO consorcios_coleta VALUES(?,?,?,?)", (db, None, common.now_utc(), 0))
                con.commit()
                results.append({"key": f"consorcios:{db}", "ok": True, "pulado": "sem dados na fonte"})
                continue
            bronze_file, sha = common.save_bronze("bcb_consorcios", f"metricas_{db}", body, meta)
            con.execute("DELETE FROM consorcios WHERE database=?", (db,))
            con.executemany("INSERT INTO consorcios VALUES(?,?,?,?,?,?)",
                            [(db, int(r["IdMetrica"]), r.get("Grupo"), r.get("Metrica"), float(r["Valor"]) if r.get("Valor") is not None else None, r.get("Unidade")) for r in rows])
            con.execute("INSERT OR REPLACE INTO consorcios_coleta VALUES(?,?,?,?)", (db, sha, common.now_utc(), len(rows)))
            common.record_lineage(con, "consorcios.json", bronze_file, sha, f"BCB Panorama de Consórcios (Olinda), {len(rows)} métricas do trimestre {db}")
            con.commit()
            results.append({"key": f"consorcios:{db}", "ok": True, "metricas": len(rows)})
        except Exception as e:
            results.append({"key": f"consorcios:{db}", "ok": False, "error": str(e)[:160]})
    return results or [{"key": "consorcios", "ok": True, "nota": "nada a coletar"}]
