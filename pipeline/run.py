"""Orquestrador do pipeline diário.

Uso:
    python3 pipeline/run.py            # coleta tudo + reconstrói gold
    python3 pipeline/run.py --skip-fetch   # só reconstrói gold a partir do silver

Agendamento diário (macOS/Linux): ver README.md (cron/launchd).
Cada fonte respeita sua periodicidade natural: nova coleta só grava bronze novo se o
conteúdo mudou (hash) e só gera revisão se um valor histórico divergir.
"""
import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pipeline import common, gold
from pipeline.sources import (bcb_sgs, ibge, ipeadata, ifdata, ifdata_ui, ifdata_carteiras,
                              datajud, djen, djen_credores, openfinance, reclamacoes, txjuros, b3_market, cvm_dfp, fidc,
                              trends_manual, scr_data, geo_ibge, pix_bcb, judicial, pgfn, desenrola, estban, censo2022,
                              mercado_imobiliario, previdencia, reclamacoes_consig, operacional)


def main():
    skip_fetch = "--skip-fetch" in sys.argv
    cfg = common.load_config()
    con = common.get_db()
    started = common.now_utc()
    status = {}
    if not skip_fetch:
        for name, mod in [("bcb_sgs", bcb_sgs), ("ibge", ibge), ("ipeadata", ipeadata),
                          ("ifdata", ifdata), ("ifdata_ui", ifdata_ui),
                          ("ifdata_carteiras", ifdata_carteiras), ("datajud", datajud),
                          ("djen", djen), ("djen_credores", djen_credores),
                          ("openfinance", openfinance), ("reclamacoes", reclamacoes),
                          ("txjuros", txjuros),
                          ("b3_market", b3_market), ("cvm_dfp", cvm_dfp), ("fidc", fidc),
                          ("trends_manual", trends_manual), ("scr_data", scr_data), ("geo_ibge", geo_ibge),
                          ("pix_bcb", pix_bcb), ("judicial", judicial), ("pgfn", pgfn), ("desenrola", desenrola), ("censo2022", censo2022), ("estban", estban),
                          ("mercado_imobiliario", mercado_imobiliario),
                          ("previdencia", previdencia), ("reclamacoes_consig", reclamacoes_consig),
                          ("operacional", operacional)]:
            print(f"[coleta] {name}...")
            try:
                results = mod.collect(con, cfg)
            except Exception as e:
                results = [{"key": name, "ok": False, "error": str(e)}]
            con.commit()
            ok = sum(1 for r in results if r.get("ok"))
            fail = [r for r in results if not r.get("ok")]
            status[name] = {"ok": ok, "falhas": [{"key": f.get("key"), "erro": f.get("error")} for f in fail]}
            print(f"  -> {ok} ok, {len(fail)} falhas")
            for f in fail:
                print(f"     FALHA {f.get('key')}: {f.get('error')}")
    else:
        status = {"info": "coleta pulada (--skip-fetch); gold reconstruído do silver existente"}

    print("[gold] reconstruindo camada analítica...")
    gold.build_all(con, cfg, status)
    con.execute("INSERT INTO pipeline_runs(started_at, finished_at, status, detail) VALUES(?,?,?,?)",
                (started, common.now_utc(), "ok", json.dumps(status, ensure_ascii=False)))
    con.commit()
    con.close()
    print("[fim] pipeline concluído. Gold em data/gold/.")


if __name__ == "__main__":
    main()
