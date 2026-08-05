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
import os

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

# Instituições sem listagem na CVM (sem FRE/FCA): Caixa e Safra entram pela
# rede do ESTBAN; Nubank e Inter (listados no exterior, arquivos na SEC)
# entram pela Fase 2 de clientes — o Inter tem exatamente 1 agência no
# ESTBAN (banco digital com sede única), o Nubank não tem rede reportada.
REDE_EXTRA = [
    {"id": "caixa", "nome": "Caixa Econômica Federal", "cnpj8": "00360305"},
    {"id": "safra", "nome": "Banco Safra S.A.", "cnpj8": "58160789"},
    {"id": "nubank", "nome": "Nu Holdings Ltd. (Nubank)", "cnpj8": "18236120"},
    {"id": "inter", "nome": "Inter & Co, Inc. (Banco Inter)", "cnpj8": "00416968"},
]

# Código IF.data (inst_index/páginas de IF) de cada instituição do piloto,
# verificado empiricamente contra o inst_index.json vigente (por código direto
# ou razão social, sempre a entidade de maior ativo do grupo). Conglomerado
# prudencial (C…) quando existe; instituição individual (8 dígitos) senão.
# BRB, Banco Alfa e BMI não constam do universo de páginas do IF.data no
# corte — ficam sem código (ausência declarada, nunca aproximada).
COD_IFDATA = {
    "itau": "C0010069",
    "bb": "C0049906",
    "bradesco": "C0010045",
    "santander": "C0030379",
    "btg": "C0049944",
    "abc": "C0041856",
    "banrisul": "C0030173",
    "bmg": "C0030290",
    "pine": "C0050304",
    "banestes": "C0030159",
    "mercantil": "C0020152",
    "amazonia": "04902979",
    "nordeste": "07237373",
    "banese": "13009717",
    "brpartners": "13220493",
    "caixa": "C0051626",
    "safra": "C0010083",
}

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
                          "valor": var, "referencia": data_ref,
                          "detalhe": f"variação de {var}% entre {rows[i-1][1]} e {data_ref} — "
                                     "verificar mudança de escopo ou perímetro no FRE"})
        if total == 0 and i > 0 and rows[i - 1][5] > 0:
            flags.append({"instituicao": nome, "indicador": "empregados",
                          "valor": -100.0, "referencia": data_ref,
                          "detalhe": f"total zerado em {data_ref} após série positiva — possível falha de declaração"})
    return {
        "serie": serie,
        "fonte": "CVM/FRE, tabela de empregados (item 10.1)",
        "nivel": "A",
        "status": "oficial",
        "escopo": "declarado pela companhia no FRE; pode diferir do conglomerado prudencial (IF.data)",
    }


def _flag_troca_auditor(historico, flags, nome):
    """Troca de auditor nos últimos dois anos-calendário vira flag (nunca juízo:
    troca é fato administrativo; rodízio obrigatório também produz trocas)."""
    encerrados = [h for h in historico if h["fim"]]
    if not encerrados:
        return
    ultimo = max(encerrados, key=lambda h: h["fim"])
    ano_fim = int(ultimo["fim"][:4]) if len(ultimo["fim"]) >= 4 and ultimo["fim"][:4].isdigit() else None
    ano_corte = int(common.now_utc()[:4]) - 2
    if ano_fim and ano_fim >= ano_corte:
        sucessores = [h for h in historico if not h["fim"] and h["inicio"] > ultimo["inicio"]]
        novo = sucessores[0]["nome"] if sucessores else "sucessor ainda não identificado no FCA"
        flags.append({"instituicao": nome, "indicador": "auditoria",
                      "valor": None, "referencia": ultimo["fim"],
                      "detalhe": f"troca de auditor: {ultimo['nome']} (até {ultimo['fim']}) → {novo} — "
                                 "o rodízio obrigatório também produz trocas; ver FCA da companhia"})


def _auditor(con, company_id, flags, nome):
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
    _flag_troca_auditor(historico, flags, nome)
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
                          "valor": var_12m_pct, "referencia": atual["mes"],
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


CURADO_FASE2 = os.path.join(os.path.dirname(os.path.abspath(__file__)), "curated", "fase2_observacoes.json")


def _fase2():
    """Observações da Fase 2 (releases de RI, extração com revisão obrigatória).
    Publica APENAS status 'aprovado', e apenas observações completas (evidência,
    página e URL presentes). O restante vira contador — nunca valor."""
    try:
        with open(CURADO_FASE2, encoding="utf-8") as fh:
            cur = json.load(fh)
    except Exception:
        return {}, {"em_revisao": 0, "aprovadas": 0, "rejeitadas": 0}, {}
    contadores = {"em_revisao": 0, "aprovadas": 0, "rejeitadas": 0}
    por_inst = {}
    for o in cur.get("observacoes", []):
        chave = {"review": "em_revisao", "aprovado": "aprovadas", "rejeitado": "rejeitadas"}.get(o.get("status"))
        if chave:
            contadores[chave] += 1
        if o.get("status") != "aprovado":
            continue
        if not (o.get("evidencia") and o.get("pagina") and (o.get("documento") or {}).get("url")):
            continue  # sem evidência completa não se publica, aprovado ou não
        por_inst.setdefault(o["institution_id"], []).append({
            "metric_id": o["metric_id"],
            "valor": o["valor"],
            "exibir": o["exibir"],
            "unidade": o["unidade"],
            "period_end": o["period_end"],
            "periodo_rotulo": o["periodo_rotulo"],
            "escopo": o["escopo"],
            "natureza": o["natureza"],
            "comparabilidade": o["comparabilidade"],
            "pagina": o["pagina"],
            "evidencia": o["evidencia"],
            "documento": o["documento"],
        })
    for itens in por_inst.values():
        itens.sort(key=lambda x: (x["metric_id"], x["period_end"]))
    return por_inst, contadores, cur.get("metricas", {})


def build(con, cfg=None):
    flags = []
    instituicoes = []
    clientes_por_inst, fase2_contadores, fase2_metricas = _fase2()

    for c in COMPANIES:
        cid = c["company_id"]
        nome = c["legal_name"]
        inst = {
            "id": cid,
            "nome": nome,
            "listada": True,
            "cod_ifdata": COD_IFDATA.get(cid),
            "cnpj8_rede": REDE_CNPJ8.get(cid),
            "empregados": _empregados(con, cid, flags, nome),
            "auditor": _auditor(con, cid, flags, nome),
            "rede": _rede(con, REDE_CNPJ8[cid], flags, nome) if cid in REDE_CNPJ8 else None,
            "clientes": clientes_por_inst.get(cid) or None,
        }
        instituicoes.append(inst)

    for extra in REDE_EXTRA:
        instituicoes.append({
            "id": extra["id"],
            "nome": extra["nome"],
            "listada": False,
            "cod_ifdata": COD_IFDATA.get(extra["id"]),
            "cnpj8_rede": extra["cnpj8"],
            "empregados": None,
            "auditor": None,
            "rede": _rede(con, extra["cnpj8"], flags, extra["nome"]),
            "clientes": None,
        })

    sfn_rows = con.execute(
        "SELECT data_base, agencias, municipios, bancos FROM oper_rede_total ORDER BY data_base"
    ).fetchall()
    sfn_serie = [{"mes": db, "agencias": ag, "municipios": mun, "bancos": b}
                 for db, ag, mun, b in sfn_rows]

    # Mapa de rede de TODOS os bancos do ESTBAN (não só o piloto), chaveado por
    # CNPJ-raiz e com a SÉRIE mensal completa: alimenta a tabela integral da
    # aba, a página de qualquer IF (com sparkline) e o comparador. As páginas
    # de instituição individual do IF.data usam o próprio CNPJ-raiz como
    # código, então o join é direto.
    rede_por_cnpj8 = {}
    if sfn_serie:
        mes_atual = sfn_serie[-1]["mes"]
        ano_a, mes_a = mes_atual.split("-")
        mes_ref12 = f"{int(ano_a) - 1}-{mes_a}"
        antes = {r[0]: r[1] for r in con.execute(
            "SELECT cnpj8, agencias FROM oper_rede WHERE data_base=?", (mes_ref12,))}
        series = {}
        for cnpj8, db, ag, mun in con.execute(
                "SELECT cnpj8, data_base, agencias, municipios FROM oper_rede ORDER BY data_base"):
            series.setdefault(cnpj8, []).append({"mes": db, "agencias": ag, "municipios": mun})
        for cnpj8, nome_b, ag, mun in con.execute(
                "SELECT cnpj8, nome, agencias, municipios FROM oper_rede WHERE data_base=?",
                (mes_atual,)):
            if ag <= 0:
                continue
            ref = antes.get(cnpj8)
            rede_por_cnpj8[cnpj8] = {
                "nome": nome_b, "mes": mes_atual, "agencias": ag, "municipios": mun,
                "var_12m": (ag - ref) if ref is not None else None,
                "var_12m_pct": _pct(ag, ref) if ref else None,
                "serie": series.get(cnpj8, []),
            }

    sintese = _sintese(instituicoes, sfn_serie)

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
        "rede_por_cnpj8": rede_por_cnpj8,
        "fase2": {
            **fase2_contadores,
            "metricas": fase2_metricas,
            "nota": "Clientes vêm dos releases de resultados (descoberta via CVM/IPE), com extração "
                    "revisada e evidência obrigatória (documento, página e trecho). Comparabilidade C: "
                    "o conceito varia por companhia — nunca comparar entre bancos nem usar em ranking.",
        },
        "sintese": sintese,
        "flags": flags,
        "cobertura": {"instituicoes": len(instituicoes), "com_empregados": com_empregados,
                      "com_auditor": com_auditor, "com_rede": com_rede},
    }


def _fmt_milhar(v):
    return f"{v:,}".replace(",", ".")


def _sintese(instituicoes, sfn_serie):
    """Números citáveis (página /imprensa), no formato da síntese de bets e
    fraudes: cada item com valor, conceito, nível, fonte primária e URL."""
    if not sfn_serie:
        return []
    url_estban = "https://www.bcb.gov.br/estatisticas/estatisticabancariamunicipios"
    atual = sfn_serie[-1]
    itens = [{
        "id": "agencias_sfn",
        "rotulo": "Agências bancárias em funcionamento no país",
        "valor": atual["agencias"],
        "exibir": _fmt_milhar(atual["agencias"]),
        "unidade": f"agências processadas · {atual['mes']}",
        "conceito": "Agências processadas na estatística bancária mensal do BCB, somadas para todos os "
                    "bancos; não inclui postos de atendimento nem correspondentes",
        "data_ref": atual["mes"],
        "nivel": "A", "status": "oficial",
        "fonte": "BCB/ESTBAN", "url": url_estban,
    }, {
        "id": "municipios_com_agencia",
        "rotulo": "Municípios com ao menos uma agência bancária",
        "valor": atual["municipios"],
        "exibir": f"{_fmt_milhar(atual['municipios'])} de 5.570",
        "unidade": f"municípios · {atual['mes']}",
        "conceito": "Municípios (código do próprio ESTBAN) com pelo menos uma agência processada de "
                    "qualquer banco — os demais dependem de postos, correspondentes e canais digitais",
        "data_ref": atual["mes"],
        "nivel": "A", "status": "oficial",
        "fonte": "BCB/ESTBAN", "url": url_estban,
    }]
    ano, mes = atual["mes"].split("-")
    ref_12m = next((p for p in sfn_serie if p["mes"] == f"{int(ano) - 1}-{mes}"), None)
    if ref_12m:
        delta = atual["agencias"] - ref_12m["agencias"]
        itens.append({
            "id": "var_agencias_sfn_12m",
            "rotulo": "Variação líquida de agências em 12 meses",
            "valor": delta,
            "exibir": f"{delta:+,}".replace(",", "."),
            "unidade": f"agências · {ref_12m['mes']} → {atual['mes']}",
            "conceito": "Diferença simples entre os totais de agências processadas; parte das quedas de "
                        "bancos individuais é migração societária entre CNPJs do mesmo grupo",
            "data_ref": atual["mes"],
            "nivel": "A", "status": "calculado",
            "fonte": "BCB/ESTBAN (derivação por subtração)", "url": url_estban,
        })
        maior = None
        for i in instituicoes:
            r = i.get("rede")
            if r and r.get("var_12m") is not None and (maior is None or r["var_12m"] < maior[1]):
                maior = (i["nome"], r["var_12m"])
        if maior and maior[1] < 0:
            itens.append({
                "id": "maior_fechamento_12m",
                "rotulo": "Maior fechamento líquido de agências em 12 meses (piloto)",
                "valor": abs(maior[1]),
                "exibir": f"{_fmt_milhar(abs(maior[1]))} ({maior[0]})",
                "unidade": f"agências · 12 meses até {atual['mes']}",
                "conceito": "Entre as instituições acompanhadas; quedas abruptas podem refletir "
                            "reorganização societária (agências migradas de CNPJ), sinalizada em flag no painel",
                "data_ref": atual["mes"],
                "nivel": "A", "status": "calculado",
                "fonte": "BCB/ESTBAN (derivação por subtração)", "url": url_estban,
            })
    return itens
