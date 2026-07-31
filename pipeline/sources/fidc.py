"""Conector CVM — informes mensais de FIDC (crédito não bancário).

Fonte: dados.cvm.gov.br/dados/FIDC/DOC/INF_MENSAL/DADOS/inf_mensal_fidc_AAAAMM.zip
(~3 MB/mês; tab_I = carteira por fundo, com créditos vencidos adimplentes e
inadimplentes, separados por aquisição substancial de riscos (A) ou não (B)).

Agregação mensal do SISTEMA (soma entre fundos): carteira, vencidos inadimplentes,
vencidos adimplentes, nº de fundos. Percentuais calculados no gold. Não se infere
perda a partir de atraso: subordinação e garantias variam por estrutura (nota no gold).
"""
import csv
import io

csv.field_size_limit(10_000_000)  # listas de cedentes estouram o limite padrão de 128 KB
import zipfile
from datetime import date

from pipeline import common

URL = "https://dados.cvm.gov.br/dados/FIDC/DOC/INF_MENSAL/DADOS/inf_mensal_fidc_{am}.zip"
MESES_HISTORICO = 18


def _ensure(con):
    con.execute("""CREATE TABLE IF NOT EXISTS fidc_agg(
        anomes TEXT PRIMARY KEY, n_fundos INTEGER, carteira REAL,
        venc_inad REAL, venc_ad REAL, collected_at TEXT)""")


def _meses(n):
    hoje = date.today()
    y, m = hoje.year, hoje.month
    out = []
    for _ in range(n):
        m -= 1
        if m == 0:
            y, m = y - 1, 12
        out.append(f"{y}{m:02d}")
    return out


def collect(con, cfg):
    _ensure(con)
    results = []
    for am in _meses(MESES_HISTORICO):
        key = f"fidc:{am}"
        if con.execute("SELECT 1 FROM fidc_agg WHERE anomes=?", (am,)).fetchone():
            continue  # idempotente: mês já agregado
        try:
            body, meta = common.http_get(URL.format(am=am), timeout=300)
            zf = zipfile.ZipFile(io.BytesIO(body))
            name = next((n for n in zf.namelist() if "_tab_I_" in n), None)
            if not name:
                results.append({"key": key, "ok": False, "error": "tab_I ausente"})
                continue
            n_f, cart, vi, va = 0, 0.0, 0.0, 0.0
            with zf.open(name) as fh:
                rdr = csv.DictReader(io.TextIOWrapper(fh, encoding="latin-1"), delimiter=";")
                num = lambda row, col: float((row.get(col) or "0").replace(",", ".") or 0)
                for row in rdr:
                    c = num(row, "TAB_I2_VL_CARTEIRA")
                    if c <= 0:
                        continue
                    n_f += 1
                    cart += c
                    vi += num(row, "TAB_I2A2_VL_CRED_VENC_INAD") + num(row, "TAB_I2B2_VL_CRED_VENC_INAD")
                    va += num(row, "TAB_I2A1_VL_CRED_VENC_AD") + num(row, "TAB_I2B1_VL_CRED_VENC_AD")
            extrato = f"{am};{n_f};{cart};{vi};{va}"
            bronze_file, sha = common.save_bronze("cvm_fidc", f"agg_{am}", extrato.encode(),
                                                  {"url": URL.format(am=am), "nota": "agregado tab_I: soma entre fundos com carteira > 0"})
            con.execute("INSERT OR REPLACE INTO fidc_agg(anomes, n_fundos, carteira, venc_inad, venc_ad, collected_at) VALUES(?,?,?,?,?,?)",
                        (am, n_f, cart, vi, va, common.now_utc()))
            common.record_lineage(con, f"fidc_agg:{am}", bronze_file, sha,
                                  "CVM informe mensal FIDC tab_I — carteira e créditos vencidos (inadimplentes/adimplentes), agregado do sistema")
            results.append({"key": key, "ok": True, "fundos": n_f, "carteira_bi": round(cart / 1e9, 1)})
        except Exception as e:
            results.append({"key": key, "ok": False, "error": str(e)[:120]})
    return results
