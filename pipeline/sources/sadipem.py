"""Conector Tesouro Nacional — Sadipem, pedidos de verificação de limites (PVL) de estados e municípios.

Fonte: API ORDS do Tesouro Transparente, https://apidatalake.tesouro.gov.br/ords/sadipem/tt/pvl
(dataset "Análises de operações de crédito de estados e municípios", licença aberta). A API
devolve a base inteira de PVLs, 26,5 mil linhas em 6 páginas de 5.000 (12 MB) na sondagem de
06/09/2026; o parâmetro `ano` documentado é ignorado pelo servidor, então o coletor pagina sem
filtro e substitui a tabela inteira a cada coleta, porque o status dos pleitos muda ao longo do
tempo (em tramitação vira deferido ou arquivado).

O que é um PVL: antes de contratar uma operação de crédito, estado, DF ou município pede à STN
(ou ao banco credor, no rito PVL-IF) a verificação dos limites e condições da LRF e das
Resoluções 40 e 43 do Senado. "Deferido" significa que a operação pode ser contratada; não
significa que foi. Cada linha traz interessado, UF, código IBGE, tipo de operação, finalidade,
tipo de credor, credor, moeda, valor, status e data do status.
"""
import json
import urllib.request

from pipeline import common

URL = "https://apidatalake.tesouro.gov.br/ords/sadipem/tt/pvl"
PAGINA = 5000
MAX_PAGINAS = 40  # 200 mil linhas: teto de segurança contra paginação infinita


def _ensure(con):
    con.executescript("""
    CREATE TABLE IF NOT EXISTS sadipem_pvl(
        id_pleito INTEGER PRIMARY KEY, tipo_interessado TEXT, interessado TEXT, cod_ibge INTEGER, uf TEXT, num_pvl TEXT,
        status TEXT, num_processo TEXT, data_protocolo TEXT, tipo_operacao TEXT, finalidade TEXT, tipo_credor TEXT, credor TEXT,
        moeda TEXT, valor REAL, pvl_assoc_divida INTEGER, pvl_contratado_credor INTEGER, data_status TEXT);
    CREATE INDEX IF NOT EXISTS ix_sadipem_status ON sadipem_pvl(data_status);
    CREATE TABLE IF NOT EXISTS sadipem_coleta(fonte TEXT PRIMARY KEY, linhas INTEGER, paginas INTEGER, bytes INTEGER,
        data_status_max TEXT, coletado_em TEXT);
    """)


def _iso(d):
    """'20/01/2026' -> '2026-01-20'; ISO já vem pronto; vazio vira None."""
    if not d:
        return None
    d = str(d)
    if len(d) >= 10 and d[2] == "/" and d[5] == "/":
        return f"{d[6:10]}-{d[3:5]}-{d[0:2]}"
    return d[:10]


def collect(con, cfg):
    _ensure(con)
    key = "sadipem:pvl"
    linhas, off, paginas, nbytes = [], 0, 0, 0
    try:
        while paginas < MAX_PAGINAS:
            body, meta = common.http_get(f"{URL}?limit={PAGINA}&offset={off}", timeout=180)
            nbytes += len(body)
            d = json.loads(body)
            itens = d.get("items") or []
            paginas += 1
            for x in itens:
                linhas.append((x.get("id_pleito"), x.get("tipo_interessado"), x.get("interessado"), x.get("cod_ibge"), x.get("uf"), x.get("num_pvl"),
                               x.get("status"), x.get("num_processo"), _iso(x.get("data_protocolo")), x.get("tipo_operacao"), x.get("finalidade"),
                               x.get("tipo_credor"), x.get("credor"), x.get("moeda"), x.get("valor") if isinstance(x.get("valor"), (int, float)) else None,
                               x.get("pvl_assoc_divida"), x.get("pvl_contradado_credor"), _iso(x.get("data_status"))))
            if not d.get("hasMore") or not itens:
                break
            off += PAGINA
        if len(linhas) < 10000:
            return [{"key": key, "ok": False, "error": f"{len(linhas)} linhas: menos que o piso de 10 mil, base possivelmente truncada; nada gravado"}]
        con.execute("DELETE FROM sadipem_pvl")
        con.executemany("INSERT OR REPLACE INTO sadipem_pvl VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", linhas)
        dmax = max((l[17] for l in linhas if l[17]), default=None)
        extrato = "\n".join(";".join("" if v is None else str(v) for v in l) for l in sorted(linhas, key=lambda l: l[17] or "")[-2000:])
        bronze_file, sha = common.save_bronze("sadipem", f"pvl_{(dmax or '').replace('-', '')[:6]}", extrato.encode(),
                                              {"url": URL, "nota": "2000 PVLs mais recentes por data do status; a API devolve a base inteira e a tabela é substituída a cada coleta"})
        con.execute("INSERT OR REPLACE INTO sadipem_coleta VALUES('pvl',?,?,?,?,?)", (len(linhas), paginas, nbytes, dmax, common.now_utc()))
        common.record_lineage(con, f"sadipem_pvl:{dmax}", bronze_file, sha,
                              "Tesouro Nacional, API Sadipem tt/pvl: pedidos de verificação de limites de estados e municípios, base inteira paginada")
        return [{"key": key, "ok": True, "linhas": len(linhas), "paginas": paginas, "mb": round(nbytes / 1e6, 1), "data_status_max": dmax}]
    except Exception as e:
        return [{"key": key, "ok": False, "error": str(e)[:160]}]
