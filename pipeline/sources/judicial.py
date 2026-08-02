"""Ações judiciais e instituições financeiras — coletor (ver docs/AUDITORIA_JUDICIAL.md).

DUAS CAMADAS QUE NUNCA SE CRUZAM, porque as fontes são de naturezas diferentes:

A) DataJud público (CNJ) — metadados processuais SEM as partes. Verificado campo a
   campo: o documento traz classe, assuntos, movimentos, órgão julgador e número do
   processo, e NENHUM identificador de parte. Portanto esta camada mede a litigiosidade
   de temas bancários no país e JAMAIS é atribuída a uma instituição.
   Coleta por AGREGAÇÃO (sem baixar documentos): contagem por assunto e cardinalidade
   sobre numeroProcesso (casos únicos × registros/tramitações).
   Datas NÃO são usadas: date_histogram devolve anos 2609–2612 por causa das datas de
   14 dígitos migradas do SAJ lidas como epoch-millis (armadilha documentada).

B) TST — Ranking das Partes: única fonte pública que identifica litigantes nominalmente.
   Top-10 do mês em casos novos no TST. HTML institucional, robots.txt permissivo.

Idempotente: cada coleta regrava a competência/tribunal correspondente. Sem dados
simulados; ausência não vira zero.
"""
import html
import json
import re
import time
import urllib.request

from pipeline import common

# ---------------------------------------------------------------- taxonomia TPU
# Códigos descobertos por agregação nos índices reais (nunca presumidos).
TAXONOMIA_CIVEL = {
    "revisionais": {
        "rotulo": "Revisionais de contrato bancário",
        "codigos": {9607: "Contratos Bancários", 14926: "Revisão de Juros Remuneratórios. Capitalização/Anatocismo",
                    10585: "Capitalização / Anatocismo", 10586: "Limitação de Juros", 11807: "Tarifas",
                    11974: "Cláusulas Abusivas", 6007: "Repetição de indébito", 11806: "Empréstimo consignado",
                    7772: "Cartão de Crédito", 9585: "Cartão de Crédito (contratos)",
                    7773: "Financiamento de Produto", 4960: "Cédula de Crédito Bancário",
                    7770: "Interpretação / Revisão de Contrato"},
    },
    "indenizatorias": {
        "rotulo": "Indenizatórias",
        "codigos": {7779: "Indenização por Dano Moral", 7780: "Indenização por Dano Material",
                    11811: "Práticas Abusivas"},
    },
    "garantias_cobranca": {
        "rotulo": "Garantias e cobrança (tipicamente promovidas pela IF)",
        "codigos": {9582: "Alienação Fiduciária", 9584: "Arrendamento Mercantil", 4970: "Cheque"},
    },
}
TAXONOMIA_TRABALHISTA = {
    "jornada": {"rotulo": "Jornada, horas extras e intervalos",
                "codigos": {13769: "Horas Extras", 13787: "Adicional de Horas Extras",
                            13799: "Adicional de Hora Extra", 13772: "Intervalo Intrajornada"}},
    "rescisao": {"rotulo": "Rescisão e verbas rescisórias",
                 "codigos": {13994: "Aviso Prévio", 13970: "Verbas Rescisórias", 13968: "Rescisão Indireta",
                             14000: "Multa do Artigo 477 da CLT", 13999: "Multa do Artigo 467 da CLT",
                             13996: "Férias Proporcionais", 13995: "Décimo Terceiro Salário Proporcional",
                             14001: "Saldo de Salário"}},
    "fgts": {"rotulo": "FGTS", "codigos": {13719: "FGTS", 13998: "Multa de 40% do FGTS", 13749: "Depósito/Diferenças"}},
    "adicionais": {"rotulo": "Adicionais e saúde no trabalho",
                   "codigos": {13875: "Adicional de Insalubridade"}},
}
TRIBUNAIS_CIVEL = ["tjsp", "tjrj", "tjmg", "tjrs", "tjpr", "tjsc", "tjba", "tjgo", "tjpe", "tjce"]
TRIBUNAIS_TRABALHO = ["trt2", "trt1", "trt15", "trt3", "trt4"]
UF_DO_TRIBUNAL = {"tjsp": "SP", "tjrj": "RJ", "tjmg": "MG", "tjrs": "RS", "tjpr": "PR", "tjsc": "SC",
                  "tjba": "BA", "tjgo": "GO", "tjpe": "PE", "tjce": "CE",
                  "trt2": "SP", "trt1": "RJ", "trt15": "SP", "trt3": "MG", "trt4": "RS"}
TST_URL = "https://www.tst.jus.br/web/estatistica/tst/ranking-das-partes"


def _ensure(con):
    con.executescript("""
    CREATE TABLE IF NOT EXISTS jud_assunto(
        tribunal TEXT, ramo TEXT, categoria TEXT, codigo INTEGER, nome TEXT,
        registros INTEGER, casos_unicos INTEGER, coletado_em TEXT,
        PRIMARY KEY(tribunal, codigo));
    CREATE TABLE IF NOT EXISTS jud_tribunal(
        tribunal TEXT PRIMARY KEY, ramo TEXT, uf TEXT, registros_indice INTEGER, coletado_em TEXT);
    CREATE TABLE IF NOT EXISTS jud_tst_ranking(
        competencia TEXT, posicao INTEGER, parte TEXT, processos INTEGER,
        eh_if INTEGER, cod_if TEXT, confianca TEXT, coletado_em TEXT,
        PRIMARY KEY(competencia, posicao));
    """)


def _es(base, key, tribunal, payload, timeout=120, retries=3):
    body = json.dumps(payload).encode()
    last = None
    for i in range(retries):
        try:
            req = urllib.request.Request(f"{base}/api_publica_{tribunal}/_search", data=body, method="POST",
                                         headers={"Authorization": f"APIKey {key}", "Content-Type": "application/json",
                                                  "User-Agent": common.USER_AGENT})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read())
        except Exception as e:
            last = e
            time.sleep(1.5 * (i + 1))
    raise last


def _coleta_ramo(con, base, key, tribunais, taxonomia, ramo, pausa):
    agora = common.now_utc()
    linhas, tribs = [], []
    for trib in tribunais:
        try:
            tot = _es(base, key, trib, {"size": 0})
            tribs.append((trib, ramo, UF_DO_TRIBUNAL.get(trib), tot["hits"]["total"]["value"], agora))
        except Exception:
            continue  # tribunal indisponível: não entra (ausência ≠ zero)
        for categoria, bloco in taxonomia.items():
            for cod, nome in bloco["codigos"].items():
                try:
                    d = _es(base, key, trib, {
                        "size": 0,
                        "track_total_hits": True,  # sem isto o total satura em 10.000 ("gte")
                        "query": {"term": {"assuntos.codigo": cod}},
                        # casos únicos: cardinalidade sobre o número CNJ — G1/G2 do mesmo caso
                        # compartilham numeroProcesso. Só o SUBCAMPO .keyword é agregável
                        # (o campo texto tem fielddata desabilitado). Estimativa do HyperLogLog++.
                        "aggs": {"unicos": {"cardinality": {"field": "numeroProcesso.keyword",
                                                            "precision_threshold": 40000}}},
                    })
                    reg = d["hits"]["total"]["value"]
                    uni = d["aggregations"]["unicos"]["value"]
                    if reg:
                        linhas.append((trib, ramo, categoria, cod, nome, reg, uni, agora))
                except Exception:
                    pass
                time.sleep(pausa)
        # grava ao fim de cada tribunal: coleta longa fica resumível e auditável
        con.executemany("INSERT OR REPLACE INTO jud_tribunal VALUES(?,?,?,?,?)", tribs[-1:])
        con.executemany("INSERT OR REPLACE INTO jud_assunto VALUES(?,?,?,?,?,?,?,?)",
                        [l for l in linhas if l[0] == trib])
        con.commit()
    return {"tribunais": len(tribs), "linhas": len(linhas)}


# ------------------------------------------------ resolução de entidades (camada nominal)
# Vínculo nome-no-TST → instituição do Observatório. Revisado manualmente; confiança
# declarada. Só entram correspondências inequívocas (razão social/marca dominante).
RESOLUCAO_IF = [
    (r"^bradesco", "Bradesco", "alta"),
    (r"^ita[uú]", "Itaú Unibanco", "alta"),
    (r"caixa econ", "Caixa Econômica Federal", "alta"),
    (r"^santander", "Santander", "alta"),
    (r"banco do brasil", "Banco do Brasil", "alta"),
    (r"^banco (?!do brasil)", None, "media"),   # outro banco nomeado: marcado como IF, sem vínculo
]


def _classifica_parte(nome):
    n = re.sub(r"\s+", " ", nome).strip().lower()
    for padrao, cod, conf in RESOLUCAO_IF:
        if re.search(padrao, n):
            return (1, cod, conf)
    return (0, None, "n/a")


def _tst_ranking(con):
    req = urllib.request.Request(TST_URL, headers={"User-Agent": common.USER_AGENT})
    with urllib.request.urlopen(req, timeout=90) as r:
        raw = r.read()
    common.save_bronze("judicial", "tst_ranking_partes.html", raw,
                       {"fonte": "TST — Ranking das Partes", "url": TST_URL,
                        "nota": "top-10 do mês em casos novos no TST; robots.txt permite"})
    h = raw.decode("utf-8", errors="ignore")
    plano = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", h)))
    m = re.search(r"Ranking das Partes no TST\s+([A-Za-zçÇã]+ de \d{4})\s*-\s*Casos Novos", plano)
    competencia = m.group(1) if m else None
    if not competencia:
        return {"key": "tst_ranking", "ok": False, "error": "competência não localizada no HTML (mudou o layout?)"}

    linhas, agora = [], common.now_utc()
    for tr in re.findall(r"<tr.*?</tr>", h, re.S | re.I):
        celulas = [html.unescape(re.sub(r"<[^>]+>", "", c)) for c in re.findall(r"<t[dh].*?</t[dh]>", tr, re.S | re.I)]
        celulas = [re.sub(r"\s+", " ", re.sub(r"[\u200b]", "", c)).strip() for c in celulas]
        celulas = [c for c in celulas if c]
        if len(celulas) < 2 or not re.match(r"^\d+º$", celulas[0]):
            continue
        pos = int(celulas[0].rstrip("º"))
        corpo = re.sub(r"\s+", " ", celulas[1])
        mp = re.match(r"^(.*?)\s+([\d.]+)\s*processos?$", corpo)
        if not mp:
            continue
        parte, qtd = mp.group(1).strip(), int(mp.group(2).replace(".", ""))
        eh_if, cod, conf = _classifica_parte(parte)
        linhas.append((competencia, pos, parte, qtd, eh_if, cod, conf, agora))
    if not linhas:
        return {"key": "tst_ranking", "ok": False, "error": "nenhuma linha do ranking reconhecida"}
    con.execute("DELETE FROM jud_tst_ranking WHERE competencia=?", (competencia,))
    con.executemany("INSERT OR REPLACE INTO jud_tst_ranking VALUES(?,?,?,?,?,?,?,?)", linhas)
    con.commit()
    return {"key": "tst_ranking", "ok": True, "competencia": competencia, "linhas": len(linhas),
            "ifs": sum(1 for x in linhas if x[4])}


def collect(con, cfg):
    _ensure(con)
    dj = cfg["datajud"]
    base, key = dj["base_url"], dj["api_key_publica"]
    pausa = float(dj.get("pausa_entre_requisicoes_s", 2.0)) / 4
    out = []
    try:
        out.append({"key": "jud_civel", "ok": True,
                    **_coleta_ramo(con, base, key, TRIBUNAIS_CIVEL, TAXONOMIA_CIVEL, "civel", pausa)})
    except Exception as e:
        out.append({"key": "jud_civel", "ok": False, "error": str(e)[:180]})
    try:
        out.append({"key": "jud_trabalhista", "ok": True,
                    **_coleta_ramo(con, base, key, TRIBUNAIS_TRABALHO, TAXONOMIA_TRABALHISTA, "trabalhista", pausa)})
    except Exception as e:
        out.append({"key": "jud_trabalhista", "ok": False, "error": str(e)[:180]})
    try:
        out.append(_tst_ranking(con))
    except Exception as e:
        out.append({"key": "tst_ranking", "ok": False, "error": str(e)[:180]})
    return out
