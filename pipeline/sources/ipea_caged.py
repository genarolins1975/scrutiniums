"""Conector Ipeadata — Novo Caged por UF (admissões e desligamentos), API OData.

Fonte: http://www.ipeadata.gov.br/api/odata4/ValoresSerie(SERCODIGO='ADMISNC') e
DESLIGNC (MTE/Novo Caged sem ajuste, republicado pelo Ipea; unidade: pessoa; mensal
desde 2020-01). O portal do MTE (PDET e FTP) não responde a partir deste ambiente e
o BCB/SGS só republica o ESTOQUE por seção; o corte por UF vem daqui.

O recurso devolve todos os níveis territoriais (municípios inclusive, ~63 MB por
série) e não aceita $filter: o coletor baixa a série inteira, guarda só Brasil e
estados e pula a coleta se já rodou nos últimos dias (a fonte é mensal).

Silver: caged_uf(mes, uf, admissoes, desligamentos) com uf='BR' para o Brasil.
Saldo = admissões − desligamentos, calculado no builder, nunca gravado.
"""
import json

from pipeline import common

BASE = "http://www.ipeadata.gov.br/api/odata4/ValoresSerie(SERCODIGO='{}')"
SERIES = {"ADMISNC": "admissoes", "DESLIGNC": "desligamentos"}
UF_IBGE = {"11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO", "21": "MA", "22": "PI", "23": "CE",
           "24": "RN", "25": "PB", "26": "PE", "27": "AL", "28": "SE", "29": "BA", "31": "MG", "32": "ES", "33": "RJ", "35": "SP",
           "41": "PR", "42": "SC", "43": "RS", "50": "MS", "51": "MT", "52": "GO", "53": "DF"}
DIAS_ENTRE_COLETAS = 3


def _ensure(con):
    con.execute("CREATE TABLE IF NOT EXISTS caged_uf(mes TEXT, uf TEXT, admissoes REAL, desligamentos REAL, PRIMARY KEY(mes, uf))")
    con.execute("CREATE TABLE IF NOT EXISTS caged_coleta(recurso TEXT PRIMARY KEY, sha TEXT, collected_at TEXT, linhas INTEGER)")


def collect(con, cfg):
    _ensure(con)
    results = []
    for codigo, coluna in SERIES.items():
        key = f"ipea_caged:{codigo}"
        try:
            ja = con.execute("SELECT sha, collected_at FROM caged_coleta WHERE recurso=?", (key,)).fetchone()
            if ja and common.coletado_recentemente(ja[1], DIAS_ENTRE_COLETAS):
                results.append({"key": key, "ok": True, "nota": f"coletado há menos de {DIAS_ENTRE_COLETAS} dias"})
                continue
            body, meta = common.http_get(BASE.format(codigo), timeout=300, retries=2)
            valores = json.loads(body)["value"]
            rows = []
            for r in valores:
                niv, ter = r.get("NIVNOME"), str(r.get("TERCODIGO") or "")
                if niv == "Brasil":
                    uf = "BR"
                elif niv == "Estados" and ter in UF_IBGE:
                    uf = UF_IBGE[ter]
                else:
                    continue
                v = r.get("VALVALOR")
                if v is None:
                    continue  # ausência é nulo, não zero
                rows.append((str(r["VALDATA"])[:7], uf, float(v)))
            if not rows:
                raise ValueError("nenhuma linha de Brasil/estados no payload")
            # bronze: só o recorte que vira silver (o arquivo inteiro é municipal e pesa 63 MB)
            recorte = json.dumps({"serie": codigo, "fonte": BASE.format(codigo), "linhas": rows}, ensure_ascii=False).encode("utf-8")
            bronze_file, sha = common.save_bronze("ipea_caged", codigo.lower(), recorte, meta)
            con.executemany(f"INSERT INTO caged_uf(mes, uf, {coluna}) VALUES(?,?,?) ON CONFLICT(mes, uf) DO UPDATE SET {coluna}=excluded.{coluna}", rows)
            con.execute("INSERT OR REPLACE INTO caged_coleta VALUES(?,?,?,?)", (key, sha, common.now_utc(), len(rows)))
            common.record_lineage(con, "emprego.json", bronze_file, sha, f"Ipeadata {codigo} (MTE/Novo Caged sem ajuste): Brasil e 27 UFs, mensal desde 2020-01")
            con.commit()
            results.append({"key": key, "ok": True, "linhas": len(rows), "ultimo_mes": max(r[0] for r in rows)})
        except Exception as e:
            results.append({"key": key, "ok": False, "error": str(e)[:160]})
    return results
