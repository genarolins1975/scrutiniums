"""Regimes de resolução do BCB (intervenção, RAET, liquidação extrajudicial).

Fonte estruturada oficial: Olinda `regimes_especiais` (dados abertos do BCB,
atualização diária) — a lista VIGENTE de instituições sob regime, com tipo,
data de decretação e responsável nomeado pelo BCB.

Memória institucional: a fonte só publica o estado ATUAL. O silver guarda
duas camadas: `regimes_vigentes` (espelho da fonte, recriado a cada coleta)
e `regimes_hist` (append-only por cnpj+início — um regime que sai da lista
vigente permanece na história com o último visto, nunca é apagado). É assim
que o painel acumula o 'risco realizado' daqui para frente.
"""
import json
import urllib.request

from pipeline import common

URL = ("https://olinda.bcb.gov.br/olinda/servico/regimes_especiais/versao/v1/"
       "odata/Regimes?$format=json&$top=100000")


def collect(con, cfg=None):
    con.execute("""CREATE TABLE IF NOT EXISTS regimes_vigentes(
        cnpj TEXT PRIMARY KEY, cnpj8 TEXT, nome TEXT, tipo TEXT, inicio TEXT,
        responsavel TEXT, municipio TEXT, uf TEXT, coletado_em TEXT)""")
    con.execute("""CREATE TABLE IF NOT EXISTS regimes_hist(
        cnpj TEXT, inicio TEXT, cnpj8 TEXT, nome TEXT, tipo TEXT,
        primeiro_visto TEXT, ultimo_visto TEXT, PRIMARY KEY(cnpj, inicio))""")
    try:
        req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0 (Observatorio)",
                                                   "Accept": "application/json"})
        body = urllib.request.urlopen(req, timeout=120).read()
        vals = json.loads(body).get("value", [])
    except Exception as e:
        return [{"key": "regimes", "ok": False, "error": str(e)[:200]}]
    if not vals:
        # lista vazia é implausível (sempre há liquidações em curso): trata como
        # falha de fonte e preserva o espelho anterior — ausência nunca vira zero
        return [{"key": "regimes", "ok": False, "error": "fonte retornou lista vazia — espelho anterior preservado"}]
    common.save_bronze("regimes", "regimes_vigentes", body, {"url": URL})
    agora = common.now_utc()
    con.execute("DELETE FROM regimes_vigentes")
    for v in vals:
        cnpj = str(v.get("CnpjInstituicao") or "")
        ini = str(v.get("Inicio") or "")
        con.execute("INSERT OR REPLACE INTO regimes_vigentes VALUES(?,?,?,?,?,?,?,?,?)",
                    (cnpj, str(v.get("CnpjRaiz") or cnpj[:8]), v.get("NomeInstituicao"),
                     v.get("Tipo"), ini, v.get("Responsavel"), v.get("Municipio"),
                     v.get("UF"), agora))
        con.execute("""INSERT INTO regimes_hist VALUES(?,?,?,?,?,?,?)
                       ON CONFLICT(cnpj, inicio) DO UPDATE SET ultimo_visto=excluded.ultimo_visto""",
                    (cnpj, ini, str(v.get("CnpjRaiz") or cnpj[:8]), v.get("NomeInstituicao"),
                     v.get("Tipo"), agora, agora))
    con.commit()
    common.record_lineage(con, "regimes.json", "regimes/regimes_vigentes", "-",
                          "BCB Olinda regimes_especiais (lista vigente diária) -> vigentes + histórico append-only")
    return [{"key": "regimes", "ok": True, "vigentes": len(vals)}]
