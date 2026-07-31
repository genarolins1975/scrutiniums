"""Fonte MANUAL — Google Trends via exportação autorizada pelo usuário.

A coleta automatizada do Google Trends para termos arbitrários segue SEM licença
(sem API pública livre; automação violaria os termos de uso — ver docs/AUDITORIA_SINAIS.md).
Este conector NÃO acessa a internet: lê exclusivamente a planilha exportada manualmente
pelo usuário a partir da interface pública oficial (trends.google.com), depositada em
data/manual/Google_Trends_Temperatura_Credito.xlsx.

Propriedades do arquivo (aba CATALOGO_E_QUALIDADE): coleta 2026-07-29 via interface
oficial, sem API/pytrends/scraping, sem CAPTCHA nem login; Brasil, jan/2011–jul/2026,
todas as categorias, Pesquisa na Web; hash SHA-256 por CSV de origem preservado.

Parser xlsx 100% stdlib (zipfile + ElementTree): o pipeline não depende de openpyxl.
Silver: trends_series, trends_lotes, trends_painel, trends_catalogo, trends_familias,
trends_raw, trends_meta. Ausência ≠ zero: valores originais (inclusive "<1" e vazios)
preservados como texto em trends_raw.
"""
import json
import os
import re
import zipfile
from xml.etree import ElementTree as ET

from pipeline import common

ARQUIVO = os.path.join(common.ROOT, "data", "manual", "Google_Trends_Temperatura_Credito.xlsx")
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
NS_R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
RE_ANOMES = re.compile(r"^\d{4}-\d{2}$")


def _col_idx(ref):
    """'BC12' -> índice 0-based da coluna."""
    n = 0
    for ch in ref:
        if ch.isalpha():
            n = n * 26 + (ord(ch.upper()) - 64)
        else:
            break
    return n - 1


def _sheet_rows(zf, target):
    """Lê uma worksheet como lista de linhas (listas posicionais por coluna)."""
    root = ET.fromstring(zf.read(target))
    try:
        sst = ET.fromstring(zf.read("xl/sharedStrings.xml"))
        shared = ["".join(t.text or "" for t in si.iter(f"{{{NS['m']}}}t")) for si in sst.findall("m:si", NS)]
    except KeyError:
        shared = []
    rows = []
    for r in root.findall(".//m:row", NS):
        cells = {}
        for c in r.findall("m:c", NS):
            idx = _col_idx(c.get("r") or "A")
            t = c.get("t")
            if t == "inlineStr":
                cells[idx] = "".join(x.text or "" for x in c.iter(f"{{{NS['m']}}}t")) or None
            else:
                v = c.find("m:v", NS)
                if v is None or v.text is None:
                    cells[idx] = None
                elif t == "s":
                    cells[idx] = shared[int(v.text)]
                elif t == "str":
                    cells[idx] = v.text
                else:
                    try:
                        f = float(v.text)
                        cells[idx] = int(f) if f == int(f) else f
                    except ValueError:
                        cells[idx] = v.text
        width = max(cells) + 1 if cells else 0
        rows.append([cells.get(i) for i in range(width)])
    return rows


def _sheets(zf):
    """nome da aba -> caminho da worksheet (via rels; não assume ordem)."""
    rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
    rid2target = {rel.get("Id"): rel.get("Target") for rel in rels}
    wb = ET.fromstring(zf.read("xl/workbook.xml"))
    out = {}
    for s in wb.findall(".//m:sheet", NS):
        target = rid2target[s.get(NS_R)].lstrip("/")
        out[s.get("name")] = target if target.startswith("xl/") else "xl/" + target
    return out


def _ensure(con):
    con.executescript("""
    CREATE TABLE IF NOT EXISTS trends_series(
        termo TEXT, anomes TEXT, valor REAL, usado INTEGER,
        PRIMARY KEY(termo, anomes));
    CREATE TABLE IF NOT EXISTS trends_lotes(
        lote TEXT, termo TEXT, anomes TEXT, valor REAL, familia TEXT, ancora INTEGER,
        PRIMARY KEY(lote, termo, anomes));
    CREATE TABLE IF NOT EXISTS trends_painel(
        termo TEXT PRIMARY KEY, familia TEXT, valor_atual REAL, var1m REAL, var3m REAL,
        var12m REAL, media12m REAL, z REAL, percentil REAL, direcao TEXT,
        intensidade TEXT, aceleracao REAL, qualidade TEXT, status TEXT);
    CREATE TABLE IF NOT EXISTS trends_catalogo(
        termo TEXT PRIMARY KEY, familia TEXT, tipo TEXT, status_coleta TEXT,
        volume_suficiente TEXT, ambiguidade TEXT, periodo TEXT, pct_zeros TEXT,
        menor_que_1 TEXT, mes_parcial TEXT, ancora TEXT, observacoes TEXT);
    CREATE TABLE IF NOT EXISTS trends_familias(
        familia TEXT PRIMARY KEY, termos INTEGER, aquecendo TEXT, arrefecendo TEXT,
        var12m_mediana REAL, var3m_mediana REAL, temperatura TEXT, leitura TEXT);
    CREATE TABLE IF NOT EXISTS trends_raw(
        arquivo TEXT, consulta TEXT, anomes TEXT, termo TEXT, valor_original TEXT,
        configuracao TEXT, sha256 TEXT,
        PRIMARY KEY(arquivo, anomes, termo));
    CREATE TABLE IF NOT EXISTS trends_meta(k TEXT PRIMARY KEY, v TEXT);
    """)


def collect(con, cfg):
    _ensure(con)
    if not os.path.exists(ARQUIVO):
        return [{"key": "trends_manual", "ok": False,
                 "error": "arquivo manual ausente (data/manual/Google_Trends_Temperatura_Credito.xlsx) — fonte segue indisponível"}]
    with open(ARQUIVO, "rb") as f:
        body = f.read()
    bronze_path, sha = common.save_bronze(
        "trends_manual", "Google_Trends_Temperatura_Credito.xlsx", body,
        {"fonte": "Google Trends — interface pública oficial (trends.google.com)",
         "modo": "exportação manual autorizada, fornecida pelo usuário em 2026-07-29",
         "licenca": "uso pessoal da interface oficial; coleta automatizada permanece NÃO licenciada",
         "config": "Brasil | 01/01/2011–29/07/2026 | Todas as categorias | Pesquisa na Web | hl=pt-BR"})

    zf = zipfile.ZipFile(ARQUIVO)
    sheets = _sheets(zf)
    resumo = _sheet_rows(zf, sheets["RESUMO_EXECUTIVO"])
    painel = _sheet_rows(zf, sheets["PAINEL_TERMOS"])
    individ = _sheet_rows(zf, sheets["SERIES_INDIVIDUAIS"])
    lotes = _sheet_rows(zf, sheets["SERIES_COMPARAVEIS"])
    originais = _sheet_rows(zf, sheets["DADOS_ORIGINAIS"])
    catalogo = _sheet_rows(zf, sheets["CATALOGO_E_QUALIDADE"])

    def cell(r, i):
        return r[i] if i < len(r) else None

    # ---------- catálogo e qualidade ----------
    con.execute("DELETE FROM trends_catalogo")
    cat_rows, registro_lotes, nota_raw = [], "", ""
    in_data = False
    for r in catalogo:
        c0 = cell(r, 0)
        if c0 == "termo":
            in_data = True
            continue
        if not in_data or not c0:
            continue
        if str(c0).startswith("Registro de lotes"):
            registro_lotes = str(c0)
            in_data = False
            continue
        cat_rows.append(tuple(str(cell(r, i)) if cell(r, i) is not None else None for i in range(12)))
    for r in catalogo:
        if r and r[0] and str(r[0]).startswith("Arquivos de origem"):
            nota_raw = str(r[0])
    con.executemany("INSERT INTO trends_catalogo VALUES(?,?,?,?,?,?,?,?,?,?,?,?)", cat_rows)
    usados = {r[0] for r in cat_rows if r[3] and r[3].startswith("Coletado")}

    # ---------- séries individuais (todas, com flag de uso) ----------
    header = next(r for r in individ if cell(r, 0) == "data")
    termos_cols = [(i, t) for i, t in enumerate(header) if i > 0 and t]
    con.execute("DELETE FROM trends_series")
    n_obs = 0
    for r in individ:
        d = cell(r, 0)
        if not (isinstance(d, str) and RE_ANOMES.match(d)):
            continue
        for i, termo in termos_cols:
            v = cell(r, i)
            if v is None:  # ausência ≠ zero: célula vazia não vira observação
                continue
            con.execute("INSERT OR REPLACE INTO trends_series VALUES(?,?,?,?)",
                        (termo, d, float(v), 1 if termo in usados else 0))
            n_obs += 1

    # ---------- séries comparáveis (lotes com âncora) ----------
    con.execute("DELETE FROM trends_lotes")
    n_lote = 0
    for r in lotes:
        d = cell(r, 0)
        if not (isinstance(d, str) and RE_ANOMES.match(d)):
            continue
        lote, termo, ancora, valor, familia = cell(r, 2), cell(r, 3), cell(r, 4), cell(r, 5), cell(r, 1)
        if lote is None or termo is None or valor is None:
            continue
        con.execute("INSERT OR REPLACE INTO trends_lotes VALUES(?,?,?,?,?,?)",
                    (str(lote), str(termo), d, float(valor), str(familia or ""),
                     1 if ancora == "(é a âncora)" else 0))
        n_lote += 1

    # ---------- painel de termos (métricas calculadas na exportação) ----------
    con.execute("DELETE FROM trends_painel")
    in_data, notas_painel = False, ""
    for r in painel:
        c0 = cell(r, 0)
        if c0 == "Família":
            in_data = True
            continue
        if not in_data or not c0:
            continue
        if str(c0).startswith("Notas:"):
            notas_painel = str(c0)
            break
        con.execute("INSERT OR REPLACE INTO trends_painel VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    (str(cell(r, 1)), str(c0), cell(r, 2), cell(r, 3), cell(r, 4), cell(r, 5),
                     cell(r, 6), cell(r, 7), cell(r, 8), cell(r, 9), cell(r, 10), cell(r, 11),
                     cell(r, 12), cell(r, 13)))

    # ---------- resumo executivo: famílias, diagnóstico e limitações ----------
    con.execute("DELETE FROM trends_familias")
    in_data = False
    diagnostico, limitacoes, fonte_linha = "", [], ""
    for i, r in enumerate(resumo):
        c0 = cell(r, 0)
        if c0 and str(c0).startswith("Fonte:"):
            fonte_linha = str(c0)
        if c0 == "Família":
            in_data = True
            continue
        if in_data:
            if not c0 or str(c0).startswith("DIAGNÓSTICO"):
                in_data = False
            else:
                con.execute("INSERT OR REPLACE INTO trends_familias VALUES(?,?,?,?,?,?,?,?)",
                            (str(c0), cell(r, 1), str(cell(r, 2) or ""), str(cell(r, 3) or ""),
                             cell(r, 4), cell(r, 5), str(cell(r, 6) or ""), str(cell(r, 7) or "")))
        if c0 and str(c0).startswith("DIAGNÓSTICO") and i + 1 < len(resumo):
            diagnostico = str(cell(resumo[i + 1], 0) or "")
        if c0 and re.match(r"^\d+\. ", str(c0)):
            limitacoes.append(str(c0))

    # ---------- dados originais (auditoria integral, valores como texto) ----------
    con.execute("DELETE FROM trends_raw")
    for r in originais:
        d = cell(r, 2)
        if not (isinstance(d, str) and RE_ANOMES.match(d)):
            continue
        con.execute("INSERT OR REPLACE INTO trends_raw VALUES(?,?,?,?,?,?,?)",
                    (str(cell(r, 0)), str(cell(r, 1) or ""), d, str(cell(r, 3) or ""),
                     str(cell(r, 4)) if cell(r, 4) is not None else None,
                     str(cell(r, 5) or ""), str(cell(r, 6) or "")))

    meta = {
        "fonte": "Google Trends — interface pública oficial",
        "modo": "exportação manual autorizada (fornecida pelo usuário; sem API, sem scraping, sem login)",
        "coleta": "2026-07-29",
        "config": "Brasil | 01/01/2011–29/07/2026 | Todas as categorias | Pesquisa na Web | hl=pt-BR",
        "ultimo_mes_completo": "2026-06",
        "mes_parcial": "2026-07",
        "fonte_linha": fonte_linha,
        "diagnostico": diagnostico,
        "limitacoes": limitacoes,
        "notas_painel": notas_painel,
        "registro_lotes": registro_lotes,
        "nota_arquivos_raw": nota_raw,
        "sha256_arquivo": sha,
        "bronze": bronze_path,
    }
    con.execute("DELETE FROM trends_meta")
    con.executemany("INSERT INTO trends_meta VALUES(?,?)",
                    [(k, json.dumps(v, ensure_ascii=False)) for k, v in meta.items()])
    common.record_lineage(con, "trends.json", bronze_path, sha,
                          "planilha manual -> silver trends_* (parser xlsx stdlib); ausência≠zero preservada em trends_raw")
    con.commit()
    return [{"key": "trends_manual", "ok": True, "series_obs": n_obs, "lote_obs": n_lote,
             "termos_catalogo": len(cat_rows), "usados": len(usados), "sha": sha[:12]}]
