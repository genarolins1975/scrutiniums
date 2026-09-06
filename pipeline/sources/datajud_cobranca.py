"""Conector CNJ/DataJud — cobrança judicial de crédito (agregação, sem baixar documentos).

Classes TPU que são o proxy público mais direto de cobrança de crédito:
- execução de título extrajudicial (12154 na TPU vigente e 159 na antiga; somadas);
- busca e apreensão em alienação fiduciária (81);
- ação monitória (40);
- execução hipotecária do SFH (1117).
São milhões de processos por tribunal: o coletor NÃO baixa documentos, só agrega.

Datas: `dataAjuizamento` mistura dois formatos no índice. Os documentos migrados do SAJ
guardam 'yyyyMMddHHmmss', que o índice lê como epoch-millis (anos ~2611); os demais
guardam ISO-8601. A leitura como epoch-millis é MONOTÔNICA no tempo real, então um
intervalo escrito no mesmo formato de 14 dígitos conta o mês certo, e um intervalo ISO
conta o mês certo dos documentos ISO. Cada mês é a soma dos dois espaços (medido em
TJSP, classe 81, 05/09/2026: 617 mil documentos no espaço de 14 dígitos e 201 mil no
ISO, sem sobreposição possível, porque um mesmo documento cai a séculos de distância
num espaço e no outro). O date_histogram do servidor segue inutilizável.

Casos únicos: cardinalidade de numeroProcesso.keyword por mês (G1 e G2 do mesmo caso
compartilham o número; estimativa HyperLogLog++ com precision_threshold 40000).

Dois recortes por classe: "todos" e "bancario" (assuntos TPU de contratos bancários,
cédula de crédito bancário, alienação e propriedade fiduciária, financiamento de
produto, CDC, cartão de crédito, mútuo e consignado). Execução e monitória cobram
qualquer título: o recorte bancário é o que interessa ao crédito, e o total é o
contexto.

Cadência: 27 tribunais estaduais, no máximo TRIBUNAIS_POR_EXECUCAO por rodada (os mais
antigos primeiro); cada tribunal regrava suas linhas inteiras (a agregação devolve a
história toda de uma vez). Ausência é nulo: tribunal que falha não entra.
"""
import json
import time
import urllib.request
from datetime import date

from pipeline import common

GRUPOS = {
    "execucao": ("Execução de título extrajudicial", [12154, 159]),
    "busca_apreensao": ("Busca e apreensão em alienação fiduciária", [81]),
    "monitoria": ("Ação monitória", [40]),
    "exec_hipotecaria": ("Execução hipotecária do SFH", [1117]),
}
ASSUNTOS_BANCARIOS = {9607: "Contratos Bancários", 4960: "Cédula de Crédito Bancário", 9582: "Alienação Fiduciária",
                      10481: "Propriedade Fiduciária", 7773: "Financiamento de Produto", 14757: "Crédito Direto ao Consumidor - CDC",
                      9585: "Cartão de Crédito (contratos)", 7772: "Cartão de Crédito", 9603: "Mútuo", 11806: "Empréstimo consignado"}
TRIBUNAIS = {"tjac": "AC", "tjal": "AL", "tjam": "AM", "tjap": "AP", "tjba": "BA", "tjce": "CE", "tjdft": "DF", "tjes": "ES", "tjgo": "GO",
             "tjma": "MA", "tjmg": "MG", "tjms": "MS", "tjmt": "MT", "tjpa": "PA", "tjpb": "PB", "tjpe": "PE", "tjpi": "PI", "tjpr": "PR",
             "tjrj": "RJ", "tjrn": "RN", "tjro": "RO", "tjrr": "RR", "tjrs": "RS", "tjsc": "SC", "tjse": "SE", "tjsp": "SP", "tjto": "TO"}
MES_INICIO = "2019-01"
TRIBUNAIS_POR_EXECUCAO = 9
PAUSA = 1.5


def _ensure(con):
    con.execute("""CREATE TABLE IF NOT EXISTS cobranca_mensal(
        tribunal TEXT, uf TEXT, grupo TEXT, recorte TEXT, mes TEXT, registros INTEGER, casos INTEGER,
        PRIMARY KEY(tribunal, grupo, recorte, mes))""")
    con.execute("""CREATE TABLE IF NOT EXISTS cobranca_tribunal(
        tribunal TEXT, uf TEXT, grupo TEXT, recorte TEXT, total INTEGER, casos INTEGER, datados INTEGER, collected_at TEXT,
        PRIMARY KEY(tribunal, grupo, recorte))""")


def _es(base, key, tribunal, payload, timeout=180, retries=3):
    body = json.dumps(payload).encode()
    last = None
    for i in range(retries):
        try:
            req = urllib.request.Request(f"{base}/api_publica_{tribunal}/_search", data=body, method="POST",
                                         headers={"Authorization": f"APIKey {key}", "Content-Type": "application/json", "User-Agent": common.USER_AGENT})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read())
        except Exception as e:
            last = e
            time.sleep(3 * (i + 1))
    raise last


def _meses(ini, fim):
    y, m = int(ini[:4]), int(ini[5:7])
    out = []
    while f"{y:04d}-{m:02d}" <= fim:
        y2, m2 = (y, m + 1) if m < 12 else (y + 1, 1)
        out.append((f"{y:04d}-{m:02d}", f"{y:04d}{m:02d}01000000", f"{y2:04d}{m2:02d}01000000", f"{y:04d}-{m:02d}-01", f"{y2:04d}-{m2:02d}-01"))
        y, m = y2, m2
    return out


def _consulta(codigos, bancario, meses):
    filtros = [{"terms": {"classe.codigo": codigos}}]
    if bancario:
        filtros.append({"terms": {"assuntos.codigo": list(ASSUNTOS_BANCARIOS)}})
    card = {"u": {"cardinality": {"field": "numeroProcesso.keyword", "precision_threshold": 40000}}}
    return {
        "size": 0, "track_total_hits": True,
        "query": {"bool": {"filter": filtros}},
        "aggs": {
            "a": {"date_range": {"field": "dataAjuizamento", "ranges": [{"key": k, "from": a, "to": b} for k, a, b, _, _ in meses]}, "aggs": card},
            "b": {"date_range": {"field": "dataAjuizamento", "ranges": [{"key": k, "from": a, "to": b} for k, _, _, a, b in meses]}, "aggs": card},
            "unicos": {"cardinality": {"field": "numeroProcesso.keyword", "precision_threshold": 40000}},
        },
    }


def coleta_tribunal(con, cfg, trib):
    c = cfg["datajud"]
    hoje = date.today()
    meses = _meses(MES_INICIO, f"{hoje.year:04d}-{hoje.month:02d}")
    uf = TRIBUNAIS[trib]
    linhas, totais = [], []
    for grupo, (nome, codigos) in GRUPOS.items():
        for recorte in ("todos", "bancario"):
            d = _es(c["base_url"], c["api_key_publica"], trib, _consulta(codigos, recorte == "bancario", meses))
            A = {x["key"]: x for x in d["aggregations"]["a"]["buckets"]}
            B = {x["key"]: x for x in d["aggregations"]["b"]["buckets"]}
            datados = 0
            for k, *_ in meses:
                reg = A[k]["doc_count"] + B[k]["doc_count"]
                casos = A[k]["u"]["value"] + B[k]["u"]["value"]
                datados += reg
                linhas.append((trib, uf, grupo, recorte, k, reg, casos))
            totais.append((trib, uf, grupo, recorte, d["hits"]["total"]["value"], d["aggregations"]["unicos"]["value"], datados, common.now_utc()))
            time.sleep(PAUSA)
    raw = json.dumps({"tribunal": trib, "linhas": linhas, "totais": totais}, ensure_ascii=False).encode("utf-8")
    bronze_file, sha = common.save_bronze("datajud", f"cobranca_{trib}", raw, {"url": f"{c['base_url']}/api_publica_{trib}/_search", "status": 200})
    con.execute("DELETE FROM cobranca_mensal WHERE tribunal=?", (trib,))
    con.execute("DELETE FROM cobranca_tribunal WHERE tribunal=?", (trib,))
    con.executemany("INSERT INTO cobranca_mensal VALUES(?,?,?,?,?,?,?)", linhas)
    con.executemany("INSERT INTO cobranca_tribunal VALUES(?,?,?,?,?,?,?,?)", totais)
    common.record_lineage(con, "cobranca.json", bronze_file, sha, f"CNJ DataJud {trib.upper()}: cobrança judicial por classe e mês (agregação em dois espaços de data), recortes todos e bancário")
    con.commit()
    return len(linhas)


def collect(con, cfg):
    _ensure(con)
    results = []
    ultimo = dict(con.execute("SELECT tribunal, MAX(collected_at) FROM cobranca_tribunal GROUP BY tribunal").fetchall())
    ordem = sorted(TRIBUNAIS, key=lambda t: ultimo.get(t) or "")
    for trib in ordem[:TRIBUNAIS_POR_EXECUCAO]:
        try:
            n = coleta_tribunal(con, cfg, trib)
            results.append({"key": f"cobranca:{trib}", "ok": True, "linhas": n})
        except Exception as e:
            results.append({"key": f"cobranca:{trib}", "ok": False, "error": str(e)[:160]})
    return results
