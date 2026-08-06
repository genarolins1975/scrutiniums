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
from pipeline.sources.operacional import BANCOS_CVM, SETOR_BANCOS

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

# Instituições sem registro de companhia aberta na CVM (sem FRE/FCA): Caixa e
# Safra entram pela rede do ESTBAN; o Nubank (listado no exterior, arquivos na
# SEC) entra pela Fase 2 de clientes e não tem rede reportada no ESTBAN.
# O Inter saiu desta lista: a holding tem registro próprio na CVM e passou a
# ser coberta por FRE/FCA como as demais (ver BANCOS_CVM).
REDE_EXTRA = [
    {"id": "caixa", "nome": "Caixa Econômica Federal", "cnpj8": "00360305"},
    {"id": "safra", "nome": "Banco Safra S.A.", "cnpj8": "58160789"},
    {"id": "nubank", "nome": "Nu Holdings Ltd. (Nubank)", "cnpj8": "18236120"},
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
    {"nome": "BCB — cadastro de agências, postos de atendimento e postos eletrônicos (Unicad)",
     "url": "https://www.bcb.gov.br/fis/info/agencias.asp", "nivel": "A"},
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


# Famílias de métrica da Fase 2. A separação existe porque a tela agrupa por
# assunto: contagem de clientes e quadro de pessoal são coisas diferentes e não
# podem cair na mesma tabela só porque vieram do mesmo fluxo de extração.
FAMILIA_FASE2 = {
    "clientes_total": "clientes", "clientes_ativos": "clientes", "correntistas": "clientes",
    "clientes_ativos_digitais": "clientes", "clientes_corporativos": "clientes",
    "empregados_reportado": "pessoal", "colaboradores_reportado": "pessoal",
}


def _fase2():
    """Observações da Fase 2 (releases de RI, extração com revisão obrigatória).
    Publica APENAS status 'aprovado', e apenas observações completas (evidência,
    página e URL presentes). O restante vira contador — nunca valor.

    Devolve as observações já separadas por família (clientes, pessoal): o fluxo
    de extração é o mesmo, o assunto não."""
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
        familia = FAMILIA_FASE2.get(o["metric_id"], "clientes")
        por_inst.setdefault(o["institution_id"], {}).setdefault(familia, []).append({
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
    for familias in por_inst.values():
        for itens in familias.values():
            itens.sort(key=lambda x: (x["metric_id"], x["period_end"]))
    return por_inst, contadores, cur.get("metricas", {})


def build(con, cfg=None):
    flags = []
    instituicoes = []
    clientes_por_inst, fase2_contadores, fase2_metricas = _fase2()

    # Companhias com registro na CVM: o piloto de mercado (recorte da B3) mais
    # os demais bancos que a própria CVM classifica no setor "Bancos". Ambos
    # têm FRE e FCA, então recebem exatamente o mesmo tratamento.
    registradas = [
        {"id": c["company_id"], "nome": c["legal_name"],
         "cnpj8_rede": REDE_CNPJ8.get(c["company_id"]), "cod_ifdata": COD_IFDATA.get(c["company_id"])}
        for c in COMPANIES
    ] + [
        {"id": b["id"], "nome": b["nome"],
         "cnpj8_rede": b["cnpj8_rede"], "cod_ifdata": b["cod_ifdata"]}
        for b in BANCOS_CVM
    ]

    deps = _dependencias(con)
    dep_de = (lambda c8: (deps["por_cnpj8"].get(c8) if deps and c8 else None))

    for c in registradas:
        cid, nome = c["id"], c["nome"]
        instituicoes.append({
            "id": cid,
            "nome": nome,
            "listada": True,
            "cod_ifdata": c["cod_ifdata"],
            "cnpj8_rede": c["cnpj8_rede"],
            "empregados": _empregados(con, cid, flags, nome),
            "auditor": _auditor(con, cid, flags, nome),
            "rede": _rede(con, c["cnpj8_rede"], flags, nome) if c["cnpj8_rede"] else None,
            "pontos": dep_de(c["cnpj8_rede"]),
            "clientes": (clientes_por_inst.get(cid) or {}).get("clientes") or None,
            "pessoal_reportado": (clientes_por_inst.get(cid) or {}).get("pessoal") or None,
        })

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
            "pontos": dep_de(extra["cnpj8"]),
            "clientes": (clientes_por_inst.get(extra["id"]) or {}).get("clientes") or None,
            "pessoal_reportado": (clientes_por_inst.get(extra["id"]) or {}).get("pessoal") or None,
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
        "dependencias": deps,
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
                      "com_auditor": com_auditor, "com_rede": com_rede,
                      **_cobertura_cvm(con, registradas)},
    }


def _dependencias(con):
    """Rede de atendimento completa: agências, postos e PAEs por instituição e
    a cobertura municipal que decorre deles.

    Não se mistura com o ESTBAN. Lá são agências PROCESSADAS (as que entregaram
    o balancete do mês), com série mensal; aqui é CADASTRO, sem série publicada,
    mas com postos e PAEs que o ESTBAN não enxerga. Os dois números de agência
    diferem em conceito e em data-base, e o painel diz isso em vez de escolher
    um deles.
    """
    try:
        linhas = con.execute(
            "SELECT tipo, cnpj8, nome_if, municipio_ibge, qtd, posicao FROM dep_unidades").fetchall()
    except Exception:
        return None
    if not linhas:
        return None
    posicao = linhas[0][5]
    tipos = ("agencia", "posto", "pae")
    por_if, nomes = {}, {}
    mun = {t: set() for t in tipos}
    for tipo, cnpj8, nome, municipio, qtd, _pos in linhas:
        d = por_if.setdefault(cnpj8, {t: 0 for t in tipos})
        d[tipo] += qtd
        d.setdefault("municipios", set())
        if municipio:
            d["municipios"].add(municipio)
            mun[tipo].add(municipio)
        nomes[cnpj8] = nome
    por_cnpj8 = {c: {**{t: d[t] for t in tipos}, "total": sum(d[t] for t in tipos),
                     "municipios": len(d["municipios"]), "nome": nomes[c]}
                 for c, d in por_if.items()}
    com_agencia = mun["agencia"]
    com_posto = mun["posto"] | mun["pae"]
    return {
        "posicao": posicao,
        "fonte": {"nome": "BCB — cadastro de agências, postos e postos eletrônicos (Unicad)",
                  "url": "https://www.bcb.gov.br/fis/info/agencias.asp", "nivel": "A"},
        "totais": {t: sum(d[t] for d in por_cnpj8.values()) for t in tipos},
        "instituicoes_com_ponto": len(por_cnpj8),
        "municipios": {
            "com_agencia": len(com_agencia),
            "com_posto_ou_pae": len(com_posto),
            "com_qualquer_ponto": len(com_agencia | com_posto),
            "so_posto_sem_agencia": len(com_posto - com_agencia),
            "sem_ponto": 5570 - len(com_agencia | com_posto),
            "total_municipios": 5570,
        },
        "por_cnpj8": por_cnpj8,
        "escopo": ("Cadastro do BC na posição indicada, não série mensal. As agências aqui são as CADASTRADAS; "
                   "as do ESTBAN são as PROCESSADAS no mês (entregaram balancete). Os dois números diferem em "
                   "conceito e data-base e nunca são somados nem reconciliados."),
        "conceitos": [
            {"termo": "Agência", "def": "dependência com atendimento completo, sede de conta e caixa."},
            {"termo": "Posto de atendimento", "def": "ponto com atendimento reduzido ou dedicado — PAB (em empresa ou órgão), PAC (cooperativo), PAA (avançado, em município sem agência), câmbio, microcrédito. O tipo vem declarado pela própria instituição."},
            {"termo": "PAE", "def": "posto de atendimento eletrônico: terminal fora de agência, sem atendente."},
        ],
    }


def _cobertura_cvm(con, registradas):
    """Quantos bancos com registro ativo na CVM o painel cobre — e quais ficam
    de fora, nominalmente.

    A lacuna é publicada em vez de ficar implícita: se a CVM registrar um banco
    novo, ele aparece aqui na atualização seguinte, antes de qualquer decisão
    de curadoria. Sem esta lista, "22 instituições" pareceria uma escolha
    editorial fechada em vez de uma cobertura com fronteira conhecida.
    """
    try:
        linhas = con.execute(
            "SELECT cnpj, nome, ano_zip FROM oper_cadastro_cvm "
            "WHERE setor=? AND situacao_registro LIKE 'Ativo%' ORDER BY nome", (SETOR_BANCOS,)
        ).fetchall()
    except Exception:
        return {}
    if not linhas:
        return {}
    cobertos = {c["id"] for c in registradas}
    from pipeline.sources.operacional import CNPJ_ALIAS, CNPJ_CVM
    fora = []
    for cnpj, nome, ano in linhas:
        ident = CNPJ_CVM.get(cnpj) or CNPJ_ALIAS.get(cnpj)
        if ident in cobertos or ident in {e["id"] for e in REDE_EXTRA}:
            continue
        # o ano da última entrega do FCA diz quão recente é o cadastro: banco
        # com registro "ativo" e entrega antiga costuma ser caso encerrado que
        # nunca foi baixado na CVM, não instituição em operação
        fora.append({"cnpj": cnpj, "nome": nome, "ultimo_fca": ano})
    return {
        "bancos_cvm": len(linhas),
        "bancos_cvm_cobertos": len(linhas) - len(fora),
        "bancos_cvm_fora": fora,
        "criterio": ("setor de atividade \"Bancos\" com registro ativo no Formulário Cadastral da CVM. "
                     "Instituições sem registro de companhia aberta (Caixa, Safra) entram por fontes "
                     "próprias e não contam neste denominador. Quem está fora não tem tabela de "
                     "empregados no FRE — entraria como linha vazia, e ausência não vira zero."),
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
