"""Conector B3 — preços (COTAHIST) e proventos/ações (APIs públicas do site de listadas).

Preços: arquivos oficiais COTAHIST_A{ano}.ZIP (layout posicional, mercado à vista,
lote padrão). NÃO ajustados por proventos — o ajuste é feito no gold (retorno total).
Proventos: GetListedCashDividends (paginado) — dividendos e JCP por classe, com data ex
(lastDatePrior) e fechamento cum. Ações em circulação: GetListedSupplementCompany.

Piloto (3 perfis): ITUB3/ITUB4 (holding), BPAC11 (banco listado, unit), ABCB4 (banco médio).
"""
import base64
import io
import json
import urllib.request
import zipfile

from pipeline import common


def _http_bin(url, timeout=600):
    """B3 responde 406 ao UA/Accept padrão do pipeline — usar cabeçalhos de navegador."""
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read(), {"url": url, "status": resp.status, "collected_at": common.now_utc()}

COTAHIST = "https://bvmf.bmfbovespa.com.br/InstDados/SerHist/COTAHIST_A{ano}.ZIP"
DIV_API = "https://sistemaswebb3-listados.b3.com.br/listedCompaniesProxy/CompanyCall/GetListedCashDividends/{b64}"
SUP_API = "https://sistemaswebb3-listados.b3.com.br/listedCompaniesProxy/CompanyCall/GetListedSupplementCompany/{b64}"

ANOS = [2023, 2024, 2025, 2026]

# mapa de entidades — UNIVERSO de bancos listados na B3 (18 companhias, validadas via
# GetListedSupplementCompany/GetDetail em 2026-07-29; BPAN/MODL/BIDI/CRIV sem cadastro ativo).
# BDRs (Nubank/Inter/XP) excluídos: demonstrações fora do padrão CVM DFP — declarado na UI.
COMPANIES = [{'company_id': 'itau',
  'legal_name': 'Itau Unibanco Holding S.A.',
  'cnpj': '60872504000123',
  'cvm_code': '19348',
  'issuer': 'ITUB',
  'trading_name': 'ITAUUNIBANCO',
  'tickers': [{'ticker': 'ITUB3', 'share_class': 'ON'}, {'ticker': 'ITUB4', 'share_class': 'PN/PNA/PNB'}],
  'main_ticker': 'ITUB4',
  'div_mode': {'class': 'PN'},
  'unit_divisor': None,
  'congl_hint': 'C0010069',
  'listing_segment': 'N1',
  'natureza': 'holding listada — controla o conglomerado',
  'perfil': 'grande banco universal'},
 {'company_id': 'bb',
  'legal_name': 'Banco Brasil S.A.',
  'cnpj': '00000000000191',
  'cvm_code': '1023',
  'issuer': 'BBAS',
  'trading_name': 'BRASIL',
  'tickers': [{'ticker': 'BBAS11', 'share_class': 'UNT'}, {'ticker': 'BBAS3', 'share_class': 'ON'}],
  'main_ticker': 'BBAS3',
  'div_mode': {'class': 'ON'},
  'unit_divisor': None,
  'congl_hint': 'C0049906',
  'listing_segment': 'NM',
  'natureza': 'banco listado diretamente (controle da União)',
  'perfil': 'grande banco universal público'},
 {'company_id': 'bradesco',
  'legal_name': 'Banco Bradesco S.A.',
  'cnpj': '60746948000112',
  'cvm_code': '906',
  'issuer': 'BBDC',
  'trading_name': 'BRADESCO',
  'tickers': [{'ticker': 'BBDC3', 'share_class': 'ON'}, {'ticker': 'BBDC4', 'share_class': 'PN/PNA/PNB'}],
  'main_ticker': 'BBDC4',
  'div_mode': {'class': 'PN'},
  'unit_divisor': None,
  'congl_hint': 'BRADESCO',
  'listing_segment': 'N1',
  'natureza': 'banco listado diretamente',
  'perfil': 'grande banco universal'},
 {'company_id': 'santander',
  'legal_name': 'Banco Santander (Brasil) S.A.',
  'cnpj': '90400888000142',
  'cvm_code': '20532',
  'issuer': 'SANB',
  'trading_name': 'SANTANDER BR',
  'tickers': [{'ticker': 'SANB11', 'share_class': 'UNT'},
              {'ticker': 'SANB3', 'share_class': 'ON'},
              {'ticker': 'SANB4', 'share_class': 'PN/PNA/PNB'}],
  'main_ticker': 'SANB11',
  'div_mode': {'unit': {'ON': 1, 'PN': 1}},
  'unit_divisor': 2,
  'congl_hint': 'SANTANDER',
  'listing_segment': 'BOLSA',
  'natureza': 'banco listado; unit = 1 ON + 1 PN',
  'perfil': 'grande banco universal (controle Santander ES)'},
 {'company_id': 'btg',
  'legal_name': 'Banco Btg Pactual S.A.',
  'cnpj': '30306294000145',
  'cvm_code': '22616',
  'issuer': 'BPAC',
  'trading_name': 'BTGP BANCO',
  'tickers': [{'ticker': 'BPAC11', 'share_class': 'UNT'}, {'ticker': 'BPAC3', 'share_class': 'ON'}],
  'main_ticker': 'BPAC11',
  'div_mode': {'unit': {'ON': 1, 'PNA': 2}},
  'unit_divisor': 3,
  'congl_hint': 'C0049944',
  'listing_segment': 'N2',
  'natureza': 'banco listado; unit = 1 ON + 2 PNA',
  'perfil': 'banco de atacado/investimento'},
 {'company_id': 'abc',
  'legal_name': 'Banco Abc Brasil S.A.',
  'cnpj': '28195667000106',
  'cvm_code': '20958',
  'issuer': 'ABCB',
  'trading_name': 'ABC BRASIL',
  'tickers': [{'ticker': 'ABCB4', 'share_class': 'PN/PNA/PNB'}],
  'main_ticker': 'ABCB4',
  'div_mode': {'class': 'PN'},
  'unit_divisor': None,
  'congl_hint': 'C0041856',
  'listing_segment': 'N2',
  'natureza': 'banco listado diretamente',
  'perfil': 'médio — crédito corporativo'},
 {'company_id': 'banrisul',
  'legal_name': 'Banco Estado Do Rio Grande Do Sul S.A.',
  'cnpj': '92702067000196',
  'cvm_code': '1210',
  'issuer': 'BRSR',
  'trading_name': 'BANRISUL',
  'tickers': [{'ticker': 'BRSR3', 'share_class': 'ON'}, {'ticker': 'BRSR6', 'share_class': 'PN/PNA/PNB'}],
  'main_ticker': 'BRSR6',
  'div_mode': {'class': 'PNB'},
  'unit_divisor': None,
  'congl_hint': 'BANRISUL',
  'listing_segment': 'N1',
  'natureza': 'banco listado diretamente (controle RS)',
  'perfil': 'regional público'},
 {'company_id': 'bmg',
  'legal_name': 'Banco Bmg S.A.',
  'cnpj': '61186680000174',
  'cvm_code': '24600',
  'issuer': 'BMGB',
  'trading_name': 'BANCO BMG',
  'tickers': [{'ticker': 'BMGB4', 'share_class': 'PN/PNA/PNB'}],
  'main_ticker': 'BMGB4',
  'div_mode': {'class': 'PN'},
  'unit_divisor': None,
  'congl_hint': 'BMG',
  'listing_segment': 'N1',
  'natureza': 'banco listado diretamente',
  'perfil': 'consignado/varejo'},
 {'company_id': 'pine',
  'legal_name': 'Banco Pine S.A.',
  'cnpj': '62144175000120',
  'cvm_code': '20567',
  'issuer': 'PINE',
  'trading_name': 'PINE',
  'tickers': [{'ticker': 'PINE14', 'share_class': 'PN/PNA/PNB'},
              {'ticker': 'PINE3', 'share_class': 'ON'},
              {'ticker': 'PINE4', 'share_class': 'PN/PNA/PNB'}],
  'main_ticker': 'PINE4',
  'div_mode': {'class': 'PN'},
  'unit_divisor': None,
  'congl_hint': 'PINE',
  'listing_segment': 'N2',
  'natureza': 'banco listado diretamente',
  'perfil': 'médio — atacado'},
 {'company_id': 'amazonia',
  'legal_name': 'Banco Amazonia S.A.',
  'cnpj': '04902979000144',
  'cvm_code': '922',
  'issuer': 'BAZA',
  'trading_name': 'AMAZONIA',
  'tickers': [{'ticker': 'BAZA3', 'share_class': 'ON'}],
  'main_ticker': 'BAZA3',
  'div_mode': {'class': 'ON'},
  'unit_divisor': None,
  'congl_hint': 'AMAZ',
  'listing_segment': 'BOLSA',
  'natureza': 'banco listado (controle da União)',
  'perfil': 'fomento regional Norte'},
 {'company_id': 'nordeste',
  'legal_name': 'Banco Nordeste Do Brasil S.A.',
  'cnpj': '07237373000120',
  'cvm_code': '1228',
  'issuer': 'BNBR',
  'trading_name': 'NORD BRASIL',
  'tickers': [{'ticker': 'BNBR3', 'share_class': 'ON'}],
  'main_ticker': 'BNBR3',
  'div_mode': {'class': 'ON'},
  'unit_divisor': None,
  'congl_hint': 'NORDESTE',
  'listing_segment': 'BOLSA',
  'natureza': 'banco listado (controle da União)',
  'perfil': 'fomento regional Nordeste'},
 {'company_id': 'banestes',
  'legal_name': 'Banestes S.A. - Banco Est Espirito Santo',
  'cnpj': '28127603000178',
  'cvm_code': '1155',
  'issuer': 'BEES',
  'trading_name': 'BANESTES',
  'tickers': [{'ticker': 'BEES3', 'share_class': 'ON'}, {'ticker': 'BEES4', 'share_class': 'PN/PNA/PNB'}],
  'main_ticker': 'BEES3',
  'div_mode': {'class': 'ON'},
  'unit_divisor': None,
  'congl_hint': 'BANESTES',
  'listing_segment': 'BOLSA',
  'natureza': 'banco listado (controle ES)',
  'perfil': 'regional público'},
 {'company_id': 'mercantil',
  'legal_name': 'Banco Mercantil Do Brasil S.A.',
  'cnpj': '17184037000110',
  'cvm_code': '1325',
  'issuer': 'BMEB',
  'trading_name': 'MERCANTIL',
  'tickers': [{'ticker': 'BMEB3', 'share_class': 'ON'}, {'ticker': 'BMEB4', 'share_class': 'PN/PNA/PNB'}],
  'main_ticker': 'BMEB4',
  'div_mode': {'class': 'PN'},
  'unit_divisor': None,
  'congl_hint': 'MERCANTIL DO BRASIL',
  'listing_segment': 'N1',
  'natureza': 'banco listado diretamente',
  'perfil': 'varejo/consignado'},
 {'company_id': 'brb',
  'legal_name': 'Brb Banco De Brasilia S.A.',
  'cnpj': '00000208000100',
  'cvm_code': '14206',
  'issuer': 'BSLI',
  'trading_name': 'BRB BANCO',
  'tickers': [{'ticker': 'BSLI3', 'share_class': 'ON'}, {'ticker': 'BSLI4', 'share_class': 'PN/PNA/PNB'}],
  'main_ticker': 'BSLI4',
  'div_mode': {'class': 'PN'},
  'unit_divisor': None,
  'congl_hint': 'BRB',
  'listing_segment': 'BOLSA',
  'natureza': 'banco listado (controle GDF)',
  'perfil': 'regional público'},
 {'company_id': 'banese',
  'legal_name': 'Banco Estado De Sergipe S.A. - Banese',
  'cnpj': '13009717000146',
  'cvm_code': '1120',
  'issuer': 'BGIP',
  'trading_name': 'BANESE',
  'tickers': [{'ticker': 'BGIP3', 'share_class': 'ON'}, {'ticker': 'BGIP4', 'share_class': 'PN/PNA/PNB'}],
  'main_ticker': 'BGIP4',
  'div_mode': {'class': 'PN'},
  'unit_divisor': None,
  'congl_hint': 'SERGIPE',
  'listing_segment': 'BOLSA',
  'natureza': 'banco listado (controle SE)',
  'perfil': 'regional público'},
 {'company_id': 'brpartners',
  'legal_name': 'Brbi Br Partners S.A.',
  'cnpj': '10739356000103',
  'cvm_code': '25860',
  'issuer': 'BRBI',
  'trading_name': 'BR PARTNERS',
  'tickers': [{'ticker': 'BRBI11', 'share_class': 'UNT'}],
  'main_ticker': 'BRBI11',
  'div_mode': {'unit': {'ON': 1, 'PN': 2}},
  'unit_divisor': 3,
  'congl_hint': 'BR PARTNERS',
  'listing_segment': 'N2',
  'natureza': 'banco listado; unit = 1 ON + 2 PN',
  'perfil': 'banco de investimento independente'},
 {'company_id': 'alfa',
  'legal_name': 'Alfa Holdings S.A.',
  'cnpj': '17167396000169',
  'cvm_code': '9954',
  'issuer': 'RPAD',
  'trading_name': 'ALFA HOLDING',
  'tickers': [{'ticker': 'RPAD3', 'share_class': 'ON'},
              {'ticker': 'RPAD5', 'share_class': 'PN/PNA/PNB'},
              {'ticker': 'RPAD6', 'share_class': 'PN/PNA/PNB'}],
  'main_ticker': 'RPAD5',
  'div_mode': {'class': 'PNA'},
  'unit_divisor': None,
  'congl_hint': 'ALFA',
  'listing_segment': 'BOLSA',
  'natureza': 'holding listada do conglomerado Alfa',
  'perfil': 'conglomerado médio (holding)'},
 {'company_id': 'bmi',
  'legal_name': 'Banco Mercantil De Investimentos S.A.',
  'cnpj': '34169557000172',
  'cvm_code': '1309',
  'issuer': 'BMIN',
  'trading_name': 'MERC INVEST',
  'tickers': [{'ticker': 'BMIN3', 'share_class': 'ON'}, {'ticker': 'BMIN4', 'share_class': 'PN/PNA/PNB'}],
  'main_ticker': 'BMIN4',
  'div_mode': {'class': 'PN'},
  'unit_divisor': None,
  'congl_hint': 'MERCANTIL',
  'listing_segment': 'BOLSA',
  'natureza': 'banco de investimento listado',
  'perfil': 'investimento (grupo Mercantil)'}]

TICKERS = {c["main_ticker"] for c in COMPANIES} | {"ITUB3"}


def _ensure_tables(con):
    con.execute("""CREATE TABLE IF NOT EXISTS market_prices(
        date TEXT, ticker TEXT, close REAL, volume REAL,
        PRIMARY KEY(date, ticker))""")
    con.execute("""CREATE TABLE IF NOT EXISTS market_dividends(
        company_id TEXT, type_stock TEXT, approved TEXT, last_cum TEXT, value REAL,
        kind TEXT, close_cum REAL, ratio TEXT,
        PRIMARY KEY(company_id, type_stock, last_cum, kind, value))""")
    con.execute("""CREATE TABLE IF NOT EXISTS market_shares(
        company_id TEXT PRIMARY KEY, common REAL, preferred REAL, total REAL, collected_at TEXT)""")


def _b64(obj):
    return base64.b64encode(json.dumps(obj).encode()).decode()


def _num_br(s):
    if s in (None, "", "-"):
        return None
    return float(str(s).replace(".", "").replace(",", "."))


def _parse_cotahist(raw, keep):
    """Layout posicional oficial: mercado à vista (TPMERC 010), lote padrão (CODBDI 02)."""
    rows = []
    for ln in raw.splitlines():
        if not ln.startswith("01"):
            continue
        codneg = ln[12:24].strip()
        if codneg not in keep:
            continue
        if ln[10:12] != "02" or ln[24:27] != "010":
            continue
        data = f"{ln[2:6]}-{ln[6:8]}-{ln[8:10]}"
        close = int(ln[108:121]) / 100.0
        vol = int(ln[170:188]) / 100.0
        rows.append((data, codneg, close, vol))
    return rows


def collect(con, cfg):
    _ensure_tables(con)
    results = []

    # ---- preços (um arquivo por ano; anos anteriores pulados se já carregados) ----
    for ano in ANOS:
        key = f"b3_precos:{ano}"
        try:
            n_ano = con.execute("SELECT COUNT(*) FROM market_prices WHERE date LIKE ?", (f"{ano}-%",)).fetchone()[0]
            if ano < max(ANOS) and n_ano > 200 * len(TICKERS) * 0.5:
                results.append({"key": key, "ok": True, "linhas": n_ano, "cache": True})
                continue
            body, meta = _http_bin(COTAHIST.format(ano=ano), timeout=600)
            zf = zipfile.ZipFile(io.BytesIO(body))
            raw = zf.read(zf.namelist()[0]).decode("latin-1")
            rows = _parse_cotahist(raw, TICKERS)
            # bronze = subconjunto extraído (o arquivo integral tem ~90 MB; guardamos o recorte auditável)
            extrato = "\n".join(f"{d};{t};{c};{v}" for d, t, c, v in rows)
            bronze_file, sha = common.save_bronze("b3_cotahist", f"extrato_{ano}",
                                                  extrato.encode(), {"url": COTAHIST.format(ano=ano), "nota": "linhas TIPREG=01, CODBDI=02, TPMERC=010, tickers do piloto"})
            for d, t, c, v in rows:
                con.execute("INSERT OR REPLACE INTO market_prices(date, ticker, close, volume) VALUES(?,?,?,?)", (d, t, c, v))
            common.record_lineage(con, f"market_prices:{ano}", bronze_file, sha,
                                  "B3 COTAHIST anual — fechamento e volume, mercado à vista, lote padrão; preços NÃO ajustados")
            results.append({"key": key, "ok": True, "linhas": len(rows)})
        except Exception as e:
            results.append({"key": key, "ok": False, "error": str(e)})

    # ---- proventos e ações em circulação por companhia ----
    for c in COMPANIES:
        key = f"b3_proventos:{c['company_id']}"
        try:
            all_rows, page = [], 1
            while page <= 30:
                b64 = _b64({"language": "pt-br", "pageNumber": page, "pageSize": 99, "tradingName": c["trading_name"]})
                body, meta = common.http_get(DIV_API.format(b64=b64), timeout=120)
                d = json.loads(body)
                rs = d.get("results") or []
                all_rows += rs
                if page >= (d.get("page", {}).get("totalPages") or 1):
                    break
                page += 1
            bronze_file, sha = common.save_bronze("b3_proventos", c["company_id"],
                                                  json.dumps(all_rows, ensure_ascii=False).encode(),
                                                  {"api": "GetListedCashDividends", "trading_name": c["trading_name"]})
            n = 0
            for r in all_rows:
                val = _num_br(r.get("valueCash"))
                cum = r.get("lastDatePriorEx") or ""
                if val is None or not cum:
                    continue
                cum_iso = f"{cum[6:10]}-{cum[3:5]}-{cum[0:2]}" if len(cum) == 10 else cum
                kind = "JCP" if "JRS" in (r.get("corporateAction") or "") else "DIV"
                con.execute("""INSERT OR REPLACE INTO market_dividends
                    (company_id, type_stock, approved, last_cum, value, kind, close_cum, ratio)
                    VALUES(?,?,?,?,?,?,?,?)""",
                    (c["company_id"], (r.get("typeStock") or "").strip(), r.get("dateApproval"),
                     cum_iso, val, kind, _num_br(r.get("closingPricePriorExDate")), r.get("ratio")))
                n += 1
            common.record_lineage(con, f"market_dividends:{c['company_id']}", bronze_file, sha,
                                  "B3 GetListedCashDividends — dividendos e JCP por classe, valor por ação, data ex e fechamento cum")
            # ações em circulação
            b64 = _b64({"issuingCompany": c["issuer"], "language": "pt-br"})
            body, _m = common.http_get(SUP_API.format(b64=b64), timeout=120)
            sup = json.loads(body)
            if isinstance(sup, str):  # a API às vezes devolve JSON duplamente codificado
                sup = json.loads(sup) if sup else {}
            sup = sup[0] if isinstance(sup, list) and sup else (sup or {})
            con.execute("INSERT OR REPLACE INTO market_shares(company_id, common, preferred, total, collected_at) VALUES(?,?,?,?,?)",
                        (c["company_id"], _num_br(sup.get("numberCommonShares")), _num_br(sup.get("numberPreferredShares")),
                         _num_br(sup.get("totalNumberShares")), common.now_utc()))
            results.append({"key": key, "ok": True, "proventos": n,
                            "acoes_total": _num_br(sup.get("totalNumberShares"))})
        except Exception as e:
            results.append({"key": key, "ok": False, "error": str(e)})
    return results
