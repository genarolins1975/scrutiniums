"""Conector BCB/SGS — Sistema Gerenciador de Séries Temporais.

API pública: https://api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo}/dados?formato=json
Licença: dados abertos do BCB, uso livre com atribuição.
"""
import json

from pipeline import common


def _parse_date(br_date):
    # "01/05/2026" -> "2026-05-01"
    d, m, y = br_date.split("/")
    return f"{y}-{m}-{d}"


def collect(con, cfg):
    results = []
    start = cfg.get("sgs_start_date", "01/01/2012")
    for s in cfg["sgs_series"]:
        url = f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{s['code']}/dados?formato=json&dataInicial={start}"
        try:
            try:
                body, meta = common.http_get(url)
            except RuntimeError:
                # séries diárias têm limite de ~10 anos por requisição (HTTP 406): janela recente
                url = f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{s['code']}/dados?formato=json&dataInicial=01/01/2019"
                body, meta = common.http_get(url)
            data = json.loads(body)
            if not isinstance(data, list) or not data:
                raise ValueError("payload inesperado")
            bronze_file, sha = common.save_bronze("bcb_sgs", f"sgs_{s['code']}", body, meta)
            rows = []
            hoje = common.now_utc()[:10]
            for item in data:
                try:
                    d = _parse_date(item["data"])
                    if d > hoje:
                        # a meta Selic (SGS 432) vem datada até a próxima reunião do Copom:
                        # observação com data futura vira "dias sem atualizar" negativo no
                        # painel de qualidade (auditoria de 06/09/2026). Fica só o passado.
                        continue
                    rows.append((d, float(item["valor"])))
                except (KeyError, ValueError):
                    continue  # valor não numérico (ex.: vazio) => ausência, não zero
            common.upsert_meta(con, "BCB/SGS", s["code"], s["key"], s["name"], s["unit"],
                               s["freq"], s["methodology"], s["url"], s.get("segment", ""), s.get("category", ""))
            n_new, n_rev = common.insert_obs(con, s["key"], rows, sha)
            con.execute("DELETE FROM series_obs WHERE key=? AND ref_date > ?", (s["key"], hoje))  # limpa o futuro já gravado
            common.record_lineage(con, f"series:{s['key']}", bronze_file, sha,
                                  "parse JSON SGS; datas dd/mm/aaaa->ISO; valores para float")
            results.append({"key": s["key"], "ok": True, "obs": len(rows), "novas": n_new, "revisoes": n_rev})
        except Exception as e:
            results.append({"key": s["key"], "ok": False, "error": str(e)})
    return results
