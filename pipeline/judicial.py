"""Ações judiciais e instituições financeiras — gold judicial.json.

Ver docs/AUDITORIA_JUDICIAL.md. O payload separa fisicamente as duas camadas para
que a interface nunca as cruze:

  camada_nacional  — DataJud: litigiosidade de temas bancários por assunto e tribunal,
                     SEM identificação de instituição (o DataJud público não traz partes).
  camada_nominal   — TST Ranking das Partes: os dez maiores litigantes do mês em casos
                     novos no TST, com as IFs resolvidas e normalizadas pela escala.

Métricas de deduplicação: `registros` (tramitações; G1 e G2 do mesmo caso contam duas
vezes) e `casos_unicos` (cardinalidade sobre o número CNJ). A comparação principal usa
casos únicos, como manda a especificação.
"""
from pipeline import common

# escala das IFs para normalizar a camada nominal (mesma data-base do IF.data)
DENOM_LABEL = {"ativo_total": "ativo total", "carteira_credito": "carteira de crédito"}


def _rows(con, sql, params=()):
    return con.execute(sql, params).fetchall()


def _escala_ifs(con):
    """Ativo e carteira por nome de instituição (última data-base disponível)."""
    try:
        ult = _rows(con, "SELECT MAX(anomes) FROM institution_metrics")[0][0]
    except Exception:
        return {}, None
    if not ult:
        return {}, None
    out = {}
    for nome, metric, valor in _rows(con, """
            SELECT i.name, m.metric, m.value FROM institution_metrics m
            JOIN institutions i ON i.cod_inst = m.cod_inst
            WHERE m.anomes = ? AND m.metric IN ('ativo_total','carteira_credito')""", (ult,)):
        out.setdefault(nome, {})[metric] = valor
    return out, ult


# Vínculo EXPLÍCITO parte-no-TST → conglomerado prudencial do IF.data. Cada código foi
# conferido manualmente contra o cadastro (não há casamento automático por nome: a
# tentativa heurística associou "Banco do Brasil" ao BNDES e "Itaú" a uma cooperativa de
# Itaúna, exatamente o tipo de atribuição falsa que a metodologia proíbe).
VINCULO_CONGLOMERADO = {
    "Bradesco": ("C0010045", "conglomerado prudencial Bradesco"),
    "Itaú Unibanco": ("C0010069", "conglomerado prudencial Itaú"),
    "Caixa Econômica Federal": ("C0051626", "Caixa Econômica Federal"),
    "Santander": ("C0030379", "conglomerado prudencial Santander"),
    "Banco do Brasil": ("C0049906", "conglomerado prudencial Banco do Brasil"),
}


def _escala_por_codigo(con):
    """Ativo e carteira por cod_inst na última data-base (valores em R$)."""
    ult = _rows(con, "SELECT MAX(anomes) FROM institution_metrics")
    ult = ult[0][0] if ult else None
    if not ult:
        return {}, None
    out = {}
    for cod, metric, valor in _rows(con,
            """SELECT cod_inst, metric, value FROM institution_metrics
               WHERE anomes = ? AND metric IN ('ativo_total','carteira_credito')""", (ult,)):
        out.setdefault(cod, {})[metric] = valor
    return out, ult


def _casa_escala(escala_cod, cod_if):
    """Resolve a instituição pelo vínculo explícito — nunca por similaridade de nome."""
    if not cod_if or cod_if not in VINCULO_CONGLOMERADO:
        return None, None
    cod, rotulo = VINCULO_CONGLOMERADO[cod_if]
    met = escala_cod.get(cod)
    return (rotulo, met) if met else (rotulo, None)


def build(con, cfg):
    try:
        from pipeline.sources.judicial import TAXONOMIA_CIVEL, TAXONOMIA_TRABALHISTA, UF_DO_TRIBUNAL
    except Exception:
        TAXONOMIA_CIVEL = TAXONOMIA_TRABALHISTA = {}
        UF_DO_TRIBUNAL = {}
    assuntos = _rows(con, """SELECT tribunal, ramo, categoria, codigo, nome, registros, casos_unicos
                             FROM jud_assunto ORDER BY registros DESC""")
    if not assuntos:
        common.write_gold("judicial.json", {"disponivel": False,
                                            "motivo": "nenhuma coleta do DataJud disponível no silver"})
        return {"ok": False, "error": "sem dados"}
    tribunais = {t: {"ramo": r, "uf": uf, "registros_indice": n, "coletado_em": c}
                 for t, r, uf, n, c in _rows(con, "SELECT tribunal, ramo, uf, registros_indice, coletado_em FROM jud_tribunal")}
    coletado_em = max((v["coletado_em"] for v in tribunais.values() if v["coletado_em"]), default=None)

    rotulos = {}
    for tax in (TAXONOMIA_CIVEL, TAXONOMIA_TRABALHISTA):
        for cat, bloco in tax.items():
            rotulos[cat] = bloco["rotulo"]

    # ---------- agregações da camada nacional ----------
    por_categoria, por_assunto, por_tribunal = {}, {}, {}
    for trib, ramo, cat, cod, nome, reg, uni in assuntos:
        c = por_categoria.setdefault((ramo, cat), {"registros": 0, "casos_unicos": 0})
        c["registros"] += reg or 0
        c["casos_unicos"] += uni or 0
        a = por_assunto.setdefault((ramo, cat, cod), {"nome": nome, "registros": 0, "casos_unicos": 0})
        a["registros"] += reg or 0
        a["casos_unicos"] += uni or 0
        t = por_tribunal.setdefault(trib, {"ramo": ramo, "uf": UF_DO_TRIBUNAL.get(trib),
                                           "registros": 0, "casos_unicos": 0, "por_categoria": {}})
        t["registros"] += reg or 0
        t["casos_unicos"] += uni or 0
        pc = t["por_categoria"].setdefault(cat, {"registros": 0, "casos_unicos": 0})
        pc["registros"] += reg or 0
        pc["casos_unicos"] += uni or 0

    categorias = [{"ramo": ramo, "categoria": cat, "rotulo": rotulos.get(cat, cat),
                   "registros": v["registros"], "casos_unicos": v["casos_unicos"],
                   "razao_reg_caso": round(v["registros"] / v["casos_unicos"], 3) if v["casos_unicos"] else None}
                  for (ramo, cat), v in por_categoria.items()]
    categorias.sort(key=lambda x: -x["casos_unicos"])
    total_civel = sum(c["casos_unicos"] for c in categorias if c["ramo"] == "civel")
    total_trab = sum(c["casos_unicos"] for c in categorias if c["ramo"] == "trabalhista")
    for c in categorias:
        base = total_civel if c["ramo"] == "civel" else total_trab
        c["part"] = round(c["casos_unicos"] / base * 100, 2) if base else None

    assuntos_out = [{"ramo": ramo, "categoria": cat, "codigo": cod, "nome": v["nome"],
                     "registros": v["registros"], "casos_unicos": v["casos_unicos"]}
                    for (ramo, cat, cod), v in por_assunto.items()]
    assuntos_out.sort(key=lambda x: -x["casos_unicos"])

    tribunais_out = []
    for trib, v in sorted(por_tribunal.items(), key=lambda kv: -kv[1]["casos_unicos"]):
        tribunais_out.append({"tribunal": trib.upper(), "ramo": v["ramo"], "uf": v["uf"],
                              "casos_unicos": v["casos_unicos"], "registros": v["registros"],
                              "registros_indice": tribunais.get(trib, {}).get("registros_indice"),
                              "por_categoria": {k: x["casos_unicos"] for k, x in v["por_categoria"].items()}})

    # matriz tribunal × categoria (heatmap), em casos únicos
    cats_civel = [c["categoria"] for c in categorias if c["ramo"] == "civel"]
    cats_trab = [c["categoria"] for c in categorias if c["ramo"] == "trabalhista"]

    # ---------- camada nominal (TST) ----------
    escala, data_escala = _escala_por_codigo(con)
    tst_linhas, competencia, tst_carregado = [], None, False
    comp = _rows(con, "SELECT MAX(competencia) FROM jud_tst_ranking")
    if comp and comp[0][0]:
        competencia = comp[0][0]
        total_top10 = _rows(con, "SELECT SUM(processos) FROM jud_tst_ranking WHERE competencia=?", (competencia,))[0][0] or 0
        for pos, parte, proc, eh_if, cod_if, conf in _rows(con,
                """SELECT posicao, parte, processos, eh_if, cod_if, confianca FROM jud_tst_ranking
                   WHERE competencia=? ORDER BY posicao""", (competencia,)):
            nome_if, met = _casa_escala(escala, cod_if) if eh_if else (None, None)
            ativo = (met or {}).get("ativo_total")
            carteira = (met or {}).get("carteira_credito")
            tst_linhas.append({
                "posicao": pos, "parte": parte, "processos": proc,
                "eh_if": bool(eh_if), "cod_if": cod_if, "confianca": conf,
                "part_top10": round(proc / total_top10 * 100, 2) if total_top10 else None,
                "entidade_escala": nome_if,
                "ativo_total": ativo, "carteira_credito": carteira,
                # normalização: processos por R$ 100 bi de ativo (denominador declarado)
                "por_100bi_ativo": round(proc / (ativo / 1e11), 1) if ativo else None,
                "por_100bi_carteira": round(proc / (carteira / 1e11), 1) if carteira else None,
            })

    if not tst_linhas:
        # pane dupla de 07-08/08/2026: o cache com o histórico do TST se perdeu
        # e o scraper do ranking quebrou no mesmo intervalo. A camada nominal
        # carrega a última publicação íntegra — a competência publicada é a que
        # o próprio bloco declara — e volta ao vivo na primeira coleta que
        # funcionar.
        import json as _j
        from pathlib import Path as _P
        try:
            _ant = _j.loads((_P(__file__).resolve().parent.parent / "public" / "obs" /
                             "data" / "gold" / "judicial.json").read_text())
            _cn = _ant.get("camada_nominal") or {}
            if _cn.get("linhas"):
                tst_linhas, competencia, tst_carregado = _cn["linhas"], _cn.get("competencia"), True
        except Exception:
            pass

    catalogo = [
        {"id": "casos_unicos", "nome": "Casos únicos", "definicao": "número de processos distintos pelo número único do CNJ",
         "formula": "cardinalidade(numeroProcesso.keyword)", "unidade": "processos", "fonte": "CNJ/DataJud API pública",
         "nivel": "assunto × tribunal", "cobertura": "tribunais coletados; acervo acumulado do índice",
         "limitacoes": "estimativa do HyperLogLog++ (erro tipicamente <1%); NÃO identifica as partes",
         "versao": "v1"},
        {"id": "registros", "nome": "Registros (tramitações)", "definicao": "documentos do índice: o mesmo caso em G1 e G2 conta duas vezes",
         "formula": "contagem exata com track_total_hits", "unidade": "registros", "fonte": "CNJ/DataJud",
         "nivel": "assunto × tribunal", "cobertura": "idem", "limitacoes": "não é número de litígios", "versao": "v1"},
        {"id": "razao_reg_caso", "nome": "Registros por caso", "definicao": "quantas tramitações existem para cada caso único",
         "formula": "registros ÷ casos únicos", "unidade": "razão", "fonte": "cálculo próprio", "nivel": "categoria",
         "cobertura": "idem", "limitacoes": "razão alta indica recorribilidade, não gravidade", "versao": "v1"},
        {"id": "tst_casos_novos", "nome": "Casos novos no TST (mês)", "definicao": "processos novos do litigante no TST na competência",
         "formula": "publicado pelo TST", "unidade": "processos/mês", "fonte": "TST — Ranking das Partes",
         "nivel": "parte nominal", "cobertura": "apenas TST, apenas os 10 maiores, apenas o mês publicado",
         "limitacoes": "não é o total de ações trabalhistas da instituição no país", "versao": "v1"},
        {"id": "por_100bi_ativo", "nome": "Casos novos no TST por R$ 100 bi de ativo", "definicao": "normalização pela escala da instituição",
         "formula": "casos novos ÷ (ativo total ÷ 100 bi)", "unidade": "processos por R$ 100 bi",
         "fonte": "TST + BCB/IF.data", "nivel": "instituição líder do conglomerado",
         "cobertura": f"escala na data-base {data_escala}",
         "limitacoes": "numerador e denominador têm períodos e perímetros distintos; leitura apenas de ordem de grandeza",
         "versao": "v1"},
    ]

    common.write_gold("judicial.json", {
        "disponivel": True, "gerado_em": common.now_utc(), "coletado_em": coletado_em,
        "aviso_permanente": ("O volume de processos não constitui, isoladamente, evidência de irregularidade ou de pior "
                             "qualidade institucional. Os resultados são influenciados pela escala, perfil de clientes, "
                             "presença geográfica, modelo de negócio, organização societária, acesso à Justiça, práticas "
                             "locais de litigância e cobertura das bases."),
        "limitacao_central": ("Nenhuma fonte pública nacional atribui processos judiciais a uma instituição financeira "
                              "identificada. O DataJud público não publica as partes — verificamos campo a campo: o "
                              "documento traz classe, assuntos, movimentos, órgão julgador e número do processo, e nenhum "
                              "identificador de parte. Por isso esta página tem duas camadas que nunca se cruzam."),
        "camada_nacional": {
            "fonte": "CNJ — API Pública do DataJud",
            "identifica_instituicao": False,
            "tribunais": tribunais_out,
            "n_tribunais": len(tribunais_out),
            "categorias": categorias,
            "assuntos": assuntos_out,
            "cats_civel": cats_civel, "cats_trabalhista": cats_trab,
            "total_civel_casos": total_civel, "total_trabalhista_casos": total_trab,
            "nota_temporal": ("Contagens sobre o acervo acumulado do índice, sem recorte temporal: o campo de "
                              "ajuizamento mistura datas ISO-8601 com carimbos de 14 dígitos migrados de sistemas "
                              "legados, que o índice interpreta como epoch-millis e joga para os anos 2609–2612. "
                              "Séries anuais exigiriam reinterpretar as datas documento a documento — lacuna declarada."),
            "nota_polo": ("O DataJud não informa polo ativo nem passivo. As categorias de garantias e cobrança "
                          "(alienação fiduciária, arrendamento, cheque) são tipicamente promovidas PELA instituição e "
                          "por isso ficam separadas das revisionais e indenizatórias, que são tipicamente contra ela."),
        },
        "camada_nominal": {
            "fonte": "TST — Ranking das Partes", "identifica_instituicao": True,
            "competencia": competencia, "linhas": tst_linhas,
            "n_ifs": sum(1 for x in tst_linhas if x["eh_if"]),
            "data_escala": data_escala,
            "cobertura": ("Somente o Tribunal Superior do Trabalho, somente os dez maiores litigantes e somente os casos "
                          "novos do mês publicado. Não é, e não deve ser lido como, o total de ações trabalhistas de cada "
                          "instituição no país."),
        },
        "denominadores_indisponiveis": [
            {"metrica": "casos por 100 mil clientes", "motivo": "número de clientes por instituição não é público"},
            {"metrica": "casos por mil empregados", "motivo": "número de empregados por instituição não está nas bases integradas"},
            {"metrica": "casos por agência", "motivo": "rede de agências por instituição não está nas bases integradas"},
            {"metrica": "provisões cíveis e trabalhistas", "motivo": "a CVM estruturada traz apenas 'Provisões' agregado; a quebra por natureza está em notas explicativas em texto livre"},
        ],
        "catalogo": catalogo,
        "privacidade": ("Somente resultados agregados. Nenhuma pessoa física é identificada; nenhum número individual de "
                        "processo, CPF, nome de parte natural ou conteúdo processual é exibido."),
    })
    return {"ok": True, "tribunais": len(tribunais_out), "categorias": len(categorias),
            "assuntos": len(assuntos_out), "tst": len(tst_linhas)}
