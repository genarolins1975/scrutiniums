"""Conector BCB/SGS — Sistema Gerenciador de Séries Temporais.

API pública: https://api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo}/dados?formato=json
Licença: dados abertos do BCB, uso livre com atribuição.
"""
import json
import math
from datetime import date, datetime, timedelta

from pipeline import common


def _parse_date(br_date):
    return datetime.strptime(br_date, "%d/%m/%Y").date().isoformat()


def _resposta(body, hoje):
    if not body.strip():
        raise ValueError("resposta vazia do SGS; série anterior preservada")
    if body.lstrip().startswith(b"<"):
        raise ValueError("resposta HTML no lugar do JSON SGS; bloqueio ou manutenção não confirmados")
    data = json.loads(body)
    if not isinstance(data, list) or not data:
        raise ValueError("SGS sem lista de observações; não significa série igual a zero")
    rows = {}
    for item in data:
        if not isinstance(item, dict) or not {"data", "valor"} <= item.keys():
            raise ValueError("esquema inesperado na observação SGS")
        d = _parse_date(item["data"])
        if isinstance(item["valor"], bool):
            raise ValueError("valor booleano no SGS")
        value = float(item["valor"])
        if not math.isfinite(value):
            raise ValueError("valor não finito no SGS")
        if d > hoje:
            continue  # meta Selic futura não é observação realizada
        if d in rows and rows[d] != value:
            raise ValueError("observações conflitantes para a mesma data SGS")
        rows[d] = value
    if not rows:
        raise ValueError("SGS sem observação válida até a data da coleta")
    return sorted(rows.items())


def _janelas(inicio, fim, diaria):
    """Consulta diária limitada a menos de dez anos, sem abandonar o histórico."""
    atual = datetime.strptime(inicio, "%d/%m/%Y").date()
    ultimo = date.fromisoformat(fim)
    while atual <= ultimo:
        limite = min(ultimo, date(atual.year + 9, 1, 1) - timedelta(days=1)) if diaria else ultimo
        yield atual.strftime("%d/%m/%Y"), limite.strftime("%d/%m/%Y")
        atual = limite + timedelta(days=1)


def collect(con, cfg):
    results = []
    start = cfg.get("sgs_start_date", "01/01/2012")
    for s in cfg["sgs_series"]:
        try:
            hoje = common.now_utc()[:10]
            rows, origens = [], []
            for inicio, fim in _janelas(start, hoje, s["freq"] == "diária"):
                url = (f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{s['code']}/dados?formato=json"
                       f"&dataInicial={inicio}&dataFinal={fim}")
                body, meta = common.http_get(url)
                parsed = _resposta(body, hoje)
                if any(not _parse_date(inicio) <= d <= _parse_date(fim) for d, _ in parsed):
                    raise ValueError("SGS devolveu observação fora da janela solicitada")
                bronze_file, sha = common.save_bronze("bcb_sgs", f"sgs_{s['code']}", body, meta)
                rows.append((parsed, sha))
                origens.append((bronze_file, sha))
            if not rows:
                raise ValueError("janela SGS vazia")
            con.execute("SAVEPOINT sgs_serie")
            common.upsert_meta(con, "BCB/SGS", s["code"], s["key"], s["name"], s["unit"],
                               s["freq"], s["methodology"], s["url"], s.get("segment", ""), s.get("category", ""))
            n_new = n_rev = 0
            for parsed, sha in rows:
                novos, revistos = common.insert_obs(con, s["key"], parsed, sha)
                n_new += novos; n_rev += revistos
            con.execute("DELETE FROM series_obs WHERE key=? AND ref_date > ?", (s["key"], hoje))  # limpa o futuro já gravado
            for bronze_file, sha in origens:
                common.record_lineage(con, f"series:{s['key']}", bronze_file, sha,
                                      "JSON SGS validado integralmente; datas ISO; valores finitos; histórico preservado")
            con.execute("RELEASE sgs_serie")
            results.append({"key": s["key"], "ok": True, "obs": sum(len(r) for r, _ in rows),
                            "novas": n_new, "revisoes": n_rev, "janelas": len(rows)})
        except Exception as e:
            try:
                con.execute("ROLLBACK TO sgs_serie")
                con.execute("RELEASE sgs_serie")
            except Exception:
                pass  # falha de coleta/validação ocorreu antes do savepoint
            results.append({"key": s["key"], "ok": False, "error": str(e)})
    return results
