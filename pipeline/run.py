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
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pipeline import common, gold
from pipeline.sources import (bcb_sgs, ibge, ipeadata, ifdata, ifdata_ui, ifdata_carteiras,
                              datajud, djen, djen_credores, openfinance, reclamacoes, txjuros, b3_market, cvm_dfp, fidc,
                              trends_manual, scr_data, geo_ibge, pix_bcb, judicial, pgfn, desenrola, estban, censo2022,
                              mercado_imobiliario, previdencia, reclamacoes_consig, operacional, releases,
                              releases_ext, epae, dependencias, correspondentes, pncp_folha,
                              ifdata_funding, pilar3, regimes, remuneracao, sicor,
                              cvm_ofertas, cvm_securit, bndes, focus, sfn_cadastro, bcb_pas, cvm_pas, ipea_caged,
                              ifdata_passivo, cvm_cda, bcb_consorcios, datajud_cobranca, susep_ses, sadipem, siconfi_rgf, tesouro_garantias)


# Orçamento de tempo da coleta, em minutos (env OBS_ORCAMENTO_COLETA_MIN). Em 08/09/2026 a coleta
# passou dos 150 minutos do job e o runner cancelou tudo antes do gold: um dia inteiro sem publicar.
# Estourado o orçamento, os coletores restantes são pulados (registrados em status como "pulado")
# e o gold é reconstruído com o silver que já existe; a coleta pulada volta no dia seguinte.
ORCAMENTO_COLETA_MIN = float(os.environ.get("OBS_ORCAMENTO_COLETA_MIN", "120"))


def _log(msg):
    print(msg, flush=True)


def main():
    skip_fetch = "--skip-fetch" in sys.argv
    cfg = common.load_config()
    con = common.get_db()
    started = common.now_utc()
    status = {}
    t_coleta = time.monotonic()
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
                          ("operacional", operacional), ("releases", releases),
                          ("releases_ext", releases_ext), ("epae", epae),
                          ("dependencias", dependencias),
                          ("pncp_folha", pncp_folha),
                          ("ifdata_funding", ifdata_funding),
                          ("pilar3", pilar3),
                          ("regimes", regimes),
                          ("remuneracao", remuneracao),
                          ("correspondentes", correspondentes),
                          ("sicor", sicor),
                          ("cvm_ofertas", cvm_ofertas), ("cvm_securit", cvm_securit), ("bndes", bndes), ("focus", focus), ("sfn_cadastro", sfn_cadastro), ("bcb_pas", bcb_pas), ("cvm_pas", cvm_pas), ("ipea_caged", ipea_caged), ("ifdata_passivo", ifdata_passivo), ("cvm_cda", cvm_cda), ("bcb_consorcios", bcb_consorcios), ("susep_ses", susep_ses), ("sadipem", sadipem), ("siconfi_rgf", siconfi_rgf), ("tesouro_garantias", tesouro_garantias), ("datajud_cobranca", datajud_cobranca)]:
            decorrido_min = (time.monotonic() - t_coleta) / 60
            if decorrido_min > ORCAMENTO_COLETA_MIN:
                status[name] = {"ok": 0, "falhas": [], "pulado": f"orçamento de coleta de {ORCAMENTO_COLETA_MIN:.0f} min esgotado após {decorrido_min:.0f} min; volta na próxima execução"}
                _log(f"[coleta] {name}: pulado (orçamento de {ORCAMENTO_COLETA_MIN:.0f} min esgotado, {decorrido_min:.0f} min decorridos)")
                continue
            _log(f"[coleta] {name}... ({decorrido_min:.0f} min decorridos)")
            t0 = time.monotonic()
            try:
                results = mod.collect(con, cfg)
            except Exception as e:
                results = [{"key": name, "ok": False, "error": str(e)}]
            con.commit()
            ok = sum(1 for r in results if r.get("ok"))
            fail = [r for r in results if not r.get("ok")]
            status[name] = {"ok": ok, "falhas": [{"key": f.get("key"), "erro": f.get("error")} for f in fail], "segundos": round(time.monotonic() - t0)}
            _log(f"  -> {ok} ok, {len(fail)} falhas em {time.monotonic() - t0:.0f} s")
            for f in fail:
                _log(f"     FALHA {f.get('key')}: {f.get('error')}")
        _log(f"[coleta] total: {(time.monotonic() - t_coleta) / 60:.0f} min")
    else:
        status = {"info": "coleta pulada (--skip-fetch); gold reconstruído do silver existente"}

    _log("[gold] reconstruindo camada analítica...")
    t_gold = time.monotonic()
    gold.build_all(con, cfg, status)
    con.execute("INSERT INTO pipeline_runs(started_at, finished_at, status, detail) VALUES(?,?,?,?)",
                (started, common.now_utc(), "ok", json.dumps(status, ensure_ascii=False)))
    con.commit()
    con.close()
    _log(f"[fim] pipeline concluído em {(time.monotonic() - t_coleta) / 60:.0f} min (gold {(time.monotonic() - t_gold) / 60:.0f} min). Gold em data/gold/.")


if __name__ == "__main__":
    main()
