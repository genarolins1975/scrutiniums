"""Conector CVM dados abertos — DFP/ITR das companhias listadas do piloto.

Extrai das demonstrações CONSOLIDADAS (csv oficiais, latin-1, ';'):
    DRE: lucro do período e parcela atribuível aos controladores (match por DS_CONTA —
         o código da conta varia entre planos: 3.09/3.11/3.13);
    BPP: patrimônio líquido consolidado e participação de não controladores.
Escala MIL → R$. DFP = exercício anual auditado; ITR = trimestre (PL mais recente).

Os valores alimentam P/L, P/VP, ROE da COMPANHIA (≠ conglomerado prudencial IF.data)
e payout — correspondência de entidades em docs/AUDITORIA_MERCADO.md.
"""
import csv
import io
import zipfile

from pipeline import common
from pipeline.sources.b3_market import COMPANIES

DFP = "https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/DFP/DADOS/dfp_cia_aberta_{ano}.zip"
ITR = "https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/ITR/DADOS/itr_cia_aberta_{ano}.zip"
DFP_ANOS = [2024, 2025]
ITR_ANOS = [2026]


def _fmt_cnpj(c):
    return f"{c[0:2]}.{c[2:5]}.{c[5:8]}/{c[8:12]}-{c[12:14]}"


CNPJ_MAP = {_fmt_cnpj(c["cnpj"]): c["company_id"] for c in COMPANIES}


def _ensure_tables(con):
    con.execute("""CREATE TABLE IF NOT EXISTS market_fin(
        company_id TEXT, period_end TEXT, kind TEXT,
        lucro REAL, lucro_controladores REAL, pl_total REAL, pl_nao_controladores REAL,
        stmt TEXT DEFAULT 'consolidado',
        PRIMARY KEY(company_id, period_end, kind))""")
    try:
        con.execute("ALTER TABLE market_fin ADD COLUMN stmt TEXT DEFAULT 'consolidado'")
    except Exception:
        pass


def _scan_zip(body, inner_suffix, wanted_cnpjs):
    """Lê um csv interno do zip e devolve linhas das companhias-alvo."""
    zf = zipfile.ZipFile(io.BytesIO(body))
    name = next((n for n in zf.namelist() if n.endswith(inner_suffix)), None)
    if not name:
        return []
    out = []
    with zf.open(name) as fh:
        rdr = csv.DictReader(io.TextIOWrapper(fh, encoding="latin-1"), delimiter=";")
        for row in rdr:
            if row.get("CNPJ_CIA") in wanted_cnpjs and row.get("ORDEM_EXERC") == "ÚLTIMO":
                out.append(row)
    return out


def _val(row):
    v = float(row["VL_CONTA"].replace(",", "."))
    if row.get("ESCALA_MOEDA") == "MIL":
        v *= 1000.0
    return v


def _absorb(con, rows_dre, rows_bpp, kind, stmt):
    """Agrega por (companhia, período). stmt: consolidado (DFP _con) ou individual (_ind —
    bancos sem subsidiárias relevantes só entregam a individual; ex.: ABC Brasil)."""
    lucro_ds = ("Lucro/Prejuízo Consolidado do Período", "Lucro/Prejuízo do Período",
                "Lucro ou Prejuízo Líquido do Período",            # plano IF individual
                "Lucro ou Prejuízo Líquido Consolidado do Período")  # plano IF consolidado (BB/Bradesco/Santander…)
    pl_ds = ("Patrimônio Líquido Consolidado", "Patrimônio Líquido")
    acc = {}
    for row in rows_dre:
        ds = (row.get("DS_CONTA") or "").strip()
        key = (CNPJ_MAP[row["CNPJ_CIA"]], row["DT_FIM_EXERC"])
        if kind == "anual" and row.get("DT_INI_EXERC", "")[5:10] != "01-01":
            continue
        if ds in lucro_ds:
            acc.setdefault(key, {})["lucro"] = _val(row)
        elif ds.startswith("Atribuído a Sócios da Empresa Controladora"):
            acc.setdefault(key, {})["lucro_ctrl"] = _val(row)
    for row in rows_bpp:
        ds = (row.get("DS_CONTA") or "").strip()
        key = (CNPJ_MAP[row["CNPJ_CIA"]], row["DT_FIM_EXERC"])
        if ds in pl_ds:
            acc.setdefault(key, {})["pl"] = _val(row)
        elif "Participação dos Acionistas Não Controladores" in ds:
            acc.setdefault(key, {})["pl_nc"] = _val(row)
    n = 0
    for (cid, fim), v in acc.items():
        if not v.get("lucro") and not v.get("pl"):
            continue
        con.execute("""INSERT OR REPLACE INTO market_fin
            (company_id, period_end, kind, lucro, lucro_controladores, pl_total, pl_nao_controladores, stmt)
            VALUES(?,?,?,?,?,?,?,?)""",
            (cid, fim, kind, v.get("lucro"), v.get("lucro_ctrl") or v.get("lucro"), v.get("pl"), v.get("pl_nc"), stmt))
        n += 1
    return n


def collect(con, cfg):
    _ensure_tables(con)
    wanted = set(CNPJ_MAP)
    results = []
    for url_tpl, anos, kind in ((DFP, DFP_ANOS, "anual"), (ITR, ITR_ANOS, "tri")):
        for ano in anos:
            key = f"cvm_{kind}:{ano}"
            try:
                have = con.execute("SELECT COUNT(*) FROM market_fin WHERE kind=? AND period_end LIKE ?",
                                   (kind, f"{ano - 1 if kind == 'anual' else ano}%")).fetchone()[0]
                if kind == "anual" and ano < max(DFP_ANOS) and have >= len(COMPANIES):
                    results.append({"key": key, "ok": True, "cache": True})
                    continue
                body, meta = common.http_get(url_tpl.format(ano=ano), timeout=600)
                pref = "dfp" if kind == "anual" else "itr"
                dre = _scan_zip(body, f"{pref}_cia_aberta_DRE_con_{ano}.csv", wanted)
                bpp = _scan_zip(body, f"{pref}_cia_aberta_BPP_con_{ano}.csv", wanted)
                achou_con = {CNPJ_MAP[r["CNPJ_CIA"]] for r in dre}
                falta = wanted - {c for c in wanted if CNPJ_MAP[c] in achou_con}
                dre_ind = _scan_zip(body, f"{pref}_cia_aberta_DRE_ind_{ano}.csv", falta) if falta else []
                bpp_ind = _scan_zip(body, f"{pref}_cia_aberta_BPP_ind_{ano}.csv", falta) if falta else []
                n = _absorb(con, dre, bpp, kind, "consolidado")
                n += _absorb(con, dre_ind, bpp_ind, kind, "individual")
                dre = dre + dre_ind
                bpp = bpp + bpp_ind
                extrato = "\n".join(";".join(str(r.get(k, "")) for k in ("CNPJ_CIA", "DT_FIM_EXERC", "CD_CONTA", "DS_CONTA", "VL_CONTA", "ESCALA_MOEDA"))
                                    for r in dre + bpp)
                bronze_file, sha = common.save_bronze("cvm", f"{pref}_{ano}_extrato", extrato.encode(),
                                                      {"url": url_tpl.format(ano=ano), "nota": "linhas DRE/BPP (con + ind fallback) das companhias do piloto"})
                common.record_lineage(con, f"market_fin:{kind}:{ano}", bronze_file, sha,
                                      "CVM DFP/ITR consolidado — lucro (DS_CONTA exato) e PL; escala MIL aplicada")
                results.append({"key": key, "ok": True, "periodos": n, "linhas_dre": len(dre)})
            except Exception as e:
                results.append({"key": key, "ok": False, "error": str(e)})
    return results
