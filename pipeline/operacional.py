"""Gold dos indicadores operacionais (Fase 0): gente, rede e auditoria.

Tudo aqui vem de fonte estruturada oficial (CVM/FRE, CVM/FCA, BCB/ESTBAN),
absorvida por pipeline/sources/operacional.py. Nenhum valor é estimado; a
ausência de dado aparece como ausência, nunca como zero. Os escopos são
mantidos distintos e declarados: empregados são o DECLARADO pela companhia
listada no FRE (item 10.1), que pode diferir do conglomerado prudencial do
IF.data; a rede é a soma nacional de agências processadas no ESTBAN por
CNPJ-raiz do banco operacional (que pode diferir do CNPJ da holding listada).
"""
import json

from pipeline import common
from pipeline.sources.b3_market import COMPANIES

# CNPJ-raiz do BANCO OPERACIONAL no ESTBAN, verificado empiricamente contra a
# data-base 2026-03 (nome retornado pelo próprio arquivo). Holding listada e
# banco operacional podem ter raízes diferentes (ex.: Itaú Holding 60872504 ×
# Itaú Unibanco S.A. 60701190). Candidato ausente do ESTBAN → instituição sem
# rede reportada (informação em si; nunca aproximamos por semelhança).
REDE_CNPJ8 = {
    "itau": "60701190",
    "bb": "00000000",
    "bradesco": "60746948",
    "santander": "90400888",
    "banrisul": "92702067",
    "nordeste": "07237373",
    "amazonia": "04902979",
    "banestes": "28127603",
    "mercantil": "17184037",
    "brb": "00000208",
    "banese": "13009717",
    "bmg": "61186680",
    "pine": "62144175",
    "abc": "28195667",
    "alfa": "03323840",
    "btg": "30306294",
    "brpartners": "10739356",
    "bmi": "34169557",
}

# Instituições sem listagem na CVM (sem FRE/FCA) mas com rede relevante no
# ESTBAN: entram só com o bloco de rede, escopo declarado.
REDE_EXTRA = [
    {"id": "caixa", "nome": "Caixa Econômica Federal", "cnpj8": "00360305"},
    {"id": "safra", "nome": "Banco Safra S.A.", "cnpj8": "58160789"},
]

FONTES = [
    {"nome": "CVM — Formulário de Referência (FRE), tabela de empregados (item 10.1)",
     "url": "https://dados.cvm.gov.br/dataset/cia_aberta-doc-fre", "nivel": "A"},
    {"nome": "CVM — Formulário Cadastral (FCA), tabela de auditores",
     "url": "https://dados.cvm.gov.br/dataset/cia_aberta-doc-fca", "nivel": "A"},
    {"nome": "BCB — ESTBAN, Estatística Bancária Mensal por município (agências processadas)",
     "url": "https://www.bcb.gov.br/estatisticas/estatisticabancariamunicipios", "nivel": "A"},
]

LIMIAR_VAR_EMPREGADOS_PCT = 30.0
LIMIAR_QUEDA_REDE_12M_PCT = 15.0


def _pct(atual, anterior):
    if not anterior:
        return None
    return round((atual - anterior) / anterior * 100.0, 1)


def _empregados(con, company_id, flags, nome):
    rows = con.execute(
        """SELECT ano_zip, data_ref, versao, lideranca, nao_lideranca, total, regioes
           FROM oper_empregados WHERE company_id=? ORDER BY data_ref""",
        (company_id,)).fetchall()
    if not rows:
        return None
    serie = []
    for i, (ano_zip, data_ref, versao, lid, nao, total, regioes) in enumerate(rows):
        var = _pct(total, rows[i - 1][5]) if i > 0 else None
        serie.append({"ref": data_ref, "total": total, "lideranca": lid,
                      "nao_lideranca": nao, "regioes": json.loads(regioes),
                      "var_aa_pct": var, "fre_ano": ano_zip, "versao": versao})
        if var is not None and abs(var) > LIMIAR_VAR_EMPREGADOS_PCT:
            flags.append({"instituicao": nome, "indicador": "empregados",
                          "detalhe": f"variação de {var}% entre {rows[i-1][1]} e {data_ref} — "
                                     "verificar mudança de escopo ou perímetro no FRE"})
        if total == 0 and i > 0 and rows[i - 1][5] > 0:
            flags.append({"instituicao": nome, "indicador": "empregados",
                          "detalhe": f"total zerado em {data_ref} após série positiva — possível falha de declaração"})
    return {
        "serie": serie,
        "fonte": "CVM/FRE, tabela de empregados (item 10.1)",
        "nivel": "A",
        "status": "oficial",
        "escopo": "declarado pela companhia no FRE; pode diferir do conglomerado prudencial (IF.data)",
    }


def _auditor(con, company_id):
    rows = con.execute(
        """SELECT ano_zip, auditor, cnpj_auditor, inicio, fim FROM oper_auditores
           WHERE company_id=? ORDER BY ano_zip, inicio""", (company_id,)).fetchall()
    if not rows:
        return None
    ultimo_ano = max(r[0] for r in rows)
    vigente = None
    for ano_zip, auditor, _cnpj, inicio, fim in rows:
        if ano_zip == ultimo_ano and not fim:
            vigente = {"nome": auditor, "desde": inicio}
    historico, vistos = [], set()
    for _ano_zip, auditor, cnpj, inicio, fim in rows:
        chave = (cnpj or auditor, inicio)
        if chave in vistos:
            continue
        vistos.add(chave)
        historico.append({"nome": auditor, "inicio": inicio, "fim": fim or None})
    historico.sort(key=lambda h: h["inicio"])
    return {"vigente": vigente, "historico": historico,
            "fonte": "CVM/FCA, tabela de auditores", "nivel": "A", "status": "oficial"}


def _rede(con, cnpj8, flags, nome):
    rows = con.execute(
        """SELECT data_base, agencias, municipios FROM oper_rede
           WHERE cnpj8=? ORDER BY data_base""", (cnpj8,)).fetchall()
    if not rows:
        return None
    serie = [{"mes": db, "agencias": ag, "municipios": mun} for db, ag, mun in rows]
    atual = serie[-1]
    idx = {p["mes"]: p for p in serie}
    ano, mes = atual["mes"].split("-")
    mes_12m = f"{int(ano) - 1}-{mes}"
    var_12m = var_12m_pct = None
    if mes_12m in idx:
        var_12m = atual["agencias"] - idx[mes_12m]["agencias"]
        var_12m_pct = _pct(atual["agencias"], idx[mes_12m]["agencias"])
        if var_12m_pct is not None and var_12m_pct < -LIMIAR_QUEDA_REDE_12M_PCT:
            flags.append({"instituicao": nome, "indicador": "rede",
                          "detalhe": f"queda de {abs(var_12m_pct)}% nas agências em 12 meses "
                                     f"({idx[mes_12m]['agencias']} → {atual['agencias']}) — verificar reorganização societária"})
    return {
        "serie": serie,
        "atual": atual,
        "var_12m": var_12m,
        "var_12m_pct": var_12m_pct,
        "fonte": "BCB/ESTBAN, agências processadas (soma nacional por CNPJ-raiz)",
        "nivel": "A",
        "status": "oficial",
        "escopo": "banco operacional (CNPJ-raiz no ESTBAN); pode diferir da holding listada",
    }


def build(con, cfg=None):
    flags = []
    instituicoes = []

    for c in COMPANIES:
        cid = c["company_id"]
        nome = c["legal_name"]
        inst = {
            "id": cid,
            "nome": nome,
            "listada": True,
            "cnpj8_rede": REDE_CNPJ8.get(cid),
            "empregados": _empregados(con, cid, flags, nome),
            "auditor": _auditor(con, cid),
            "rede": _rede(con, REDE_CNPJ8[cid], flags, nome) if cid in REDE_CNPJ8 else None,
        }
        instituicoes.append(inst)

    for extra in REDE_EXTRA:
        instituicoes.append({
            "id": extra["id"],
            "nome": extra["nome"],
            "listada": False,
            "cnpj8_rede": extra["cnpj8"],
            "empregados": None,
            "auditor": None,
            "rede": _rede(con, extra["cnpj8"], flags, extra["nome"]),
        })

    sfn_rows = con.execute(
        "SELECT data_base, agencias, municipios, bancos FROM oper_rede_total ORDER BY data_base"
    ).fetchall()
    sfn_serie = [{"mes": db, "agencias": ag, "municipios": mun, "bancos": b}
                 for db, ag, mun, b in sfn_rows]

    com_empregados = sum(1 for i in instituicoes if i["empregados"])
    com_auditor = sum(1 for i in instituicoes if i["auditor"])
    com_rede = sum(1 for i in instituicoes if i["rede"])
    disponivel = com_rede > 0 and com_empregados > 0

    return {
        "gerado_em": common.now_utc(),
        "versao": 1,
        "disponivel": disponivel,
        "titulo": "Indicadores operacionais",
        "subtitulo": "Gente, rede física e auditoria das instituições financeiras — "
                     "só fontes estruturadas oficiais, sem estimativa e sem leitura de PDF.",
        "aviso": "Empregados: valor declarado pela companhia listada no FRE, no escopo que ela "
                 "declara — pode diferir do conglomerado prudencial. Rede: agências processadas "
                 "no ESTBAN, do banco operacional. Instituição sem dado numa fonte aparece sem o "
                 "bloco, nunca com zero.",
        "fontes": FONTES,
        "instituicoes": instituicoes,
        "sfn": {"rede": {"serie": sfn_serie,
                         "nota": "Soma de agências processadas de todos os bancos no ESTBAN e "
                                 "contagem de municípios com ao menos uma agência (código de "
                                 "município do próprio ESTBAN)."}},
        "flags": flags,
        "cobertura": {"instituicoes": len(instituicoes), "com_empregados": com_empregados,
                      "com_auditor": com_auditor, "com_rede": com_rede},
    }
