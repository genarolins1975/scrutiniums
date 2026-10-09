"""Publicação: gold do módulo Saúde nas capitais e séries para download.

Saídas (todas com o prefixo `saude` ou `sau_`, para nunca colidir com Educação):

    public/eficiencia/gold/saude_capitais.json      lida pela página no build
    public/eficiencia/series/sau_<indicador>.csv    todas as observações, com estado e fonte
    public/eficiencia/series/saude_*.csv            referências, matriz de fontes, dicionário e manifesto das capturas

A interface, a tabela e o download usam o mesmo conjunto de observações. A promoção é atômica: só substitui a saída pública se nenhuma validação foi reprovada.
"""
import csv
import hashlib
import io
import json
import os

from pipeline.eficiencia import entes, referencias as R
from pipeline.eficiencia_saude import base, conferencia as CF, matriz_fontes as MF, padroniza as P, referencias_externas as RE, validacoes as V

ARQUIVO_GOLD = os.path.join(base.GOLD, "saude_capitais.json")
DIAGNOSTICO = os.path.join(base.DADOS, "diagnostico")
IGNORADOS_REFERENCIA = {"sau.despesa.subfuncao", "sau.despesa.natureza", "sau.despesa.por_fonte", "sau.icsap.grupos", "sau.rede.ubs_retrato", "ctx.populacao.residente"}
PRINCIPAL = {"sau.despesa.funcao_saude": "nominal", "sau.despesa.por_habitante": "nominal", "sau.asps.valor_aplicado": "nominal", "sau.asps.base_receita": "nominal",
             "sau.rede.ubs_publicas": "publicas", "sau.rede.ubs_publicas_por_10mil": "publicas", "sau.aps.equipes": "esf", "sau.aps.equipes_por_10mil": "esf",
             "sau.icsap.taxa": "ripsa", "sau.rede.ubs_retrato": "total_ativas", "sau.despesa.natureza": "pessoal", "sau.despesa.por_fonte": "recursos_ordinarios",
             "sau.icsap.grupos": "g01"}


def _catalogo():
    return base.le_json(base.CATALOGO)


def _hash_dados(obs):
    return hashlib.sha256(json.dumps(obs, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()


def cobertura(obs, catalogo):
    """Por indicador e ano: capitais elegíveis, com valor observado, na comparação e sem valor (com estado)."""
    out = {}
    for ind in catalogo["indicadores"]:
        sel = [o for o in obs if o["indicador"] == ind["id"]]
        if not sel:
            continue
        principal = PRINCIPAL.get(ind["id"])
        grupos = {}
        for o in sel:
            if principal and o["componente"] != principal:
                continue
            grupos.setdefault(o["ano"], {})[o["ente"]] = (o["status"], bool(o.get("elegivel_comparacao")), o.get("nota"))
        linhas = []
        for ano, por_ente in sorted(grupos.items()):
            sem = [{"ente": e, "nome": V.NOMES[e], "status": st} for e, (st, _, _) in sorted(por_ente.items()) if st != "OBSERVADO"]
            fora = [{"ente": e, "nome": V.NOMES[e]} for e, (st, el, _) in sorted(por_ente.items()) if st == "OBSERVADO" and not el]
            linhas.append({"ano": ano, "etapa": None, "elegiveis": len(entes.CAPITAIS), "com_valor": sum(1 for st, _, _ in por_ente.values() if st == "OBSERVADO"),
                           "comparaveis": sum(1 for st, el, _ in por_ente.values() if st == "OBSERVADO" and el), "sem_valor": sem, "fora_da_comparacao": fora})
        out[ind["id"]] = linhas
    return out


def trilhas(obs):
    """Uma trilha de reconstrução por indicador, em uma capital e ano com valor: da fonte ao número, em passos."""
    out = []
    por_ind = {}
    for o in obs:
        if o["status"] == "OBSERVADO" and o["valor"] is not None and o.get("elegivel_comparacao"):
            por_ind.setdefault(o["indicador"], []).append(o)
    nomes = {c: n for c, n, _ in entes.CAPITAIS}
    for ind, lista in sorted(por_ind.items()):
        alvo = next((o for o in lista if o["ente"] == 3106200 and o["ano"] == max(x["ano"] for x in lista)), lista[-1])
        passos = [f"Registro de origem: {alvo['registro']}."]
        c = alvo.get("calculo")
        if c:
            passos.append(f"Numerador: {c['numerador']} ({c['numerador_ref']}). Denominador: {c['denominador']} ({c['denominador_ref']}).")
        passos.append(f"Valor publicado: {alvo['valor']} (estado {alvo['status']}).")
        out.append({"indicador": ind, "ente": alvo["ente"], "nome": nomes[alvo["ente"]], "ano": alvo["ano"], "passos": passos, "valor": alvo["valor"]})
    return out


def fontes():
    m = base.le_manifesto()["capturas"]
    educacao = base.le_json(os.path.join(os.path.dirname(base.AQUI), "eficiencia", "seed", "manifesto.json"))["capturas"]
    compartilhadas = {k: educacao[k] for k in ("ibge_populacao", "ibge_ipca", "ibge_populacao_relacao_2023", "siconfi_entes") if k in educacao}
    grupos = {
        "siconfi_dca_anexo_i_e": ["siconfi_dca_anexo_i_e"], "siconfi_rreo_anexo_02_b6": ["siconfi_rreo_anexo_02_b6"], "siconfi_msc_funcao10": ["siconfi_msc_funcao10"],
        "siops_rreo_anexo_12": ["siops_rreo_anexo_12"], "siops_despesas_por_fonte": ["siops_despesas_por_fonte"],
        "cnes_estabelecimentos": ["cnes_estabelecimentos"], "cnes_historico_estabelecimentos": ["cnes_historico_estabelecimentos"],
        "relatorio_aps_cobertura": ["relatorio_aps_cobertura", "relatorio_aps_cobertura_brasil"],
        "ripsa_mrb402_icsap": ["ripsa_mrb402_icsap"], "ripsa_cob201_internacoes": ["ripsa_cob201_internacoes"], "ripsa_cob501_planos": ["ripsa_cob501_planos"],
        "ibge_populacao": ["ibge_populacao", "ibge_populacao_relacao_2023"], "ibge_ipca": ["ibge_ipca"],
    }
    papel = {
        "siconfi_dca_anexo_i_e": "Fonte da despesa liquidada na função Saúde e da composição por subfunção.",
        "siconfi_rreo_anexo_02_b6": "Somente conferência cruzada da DCA; nunca somado.",
        "siconfi_msc_funcao10": "Terceira fonte da conferência da despesa (diferença material) e fonte da abertura por natureza; nunca somada à DCA. Em 123 de 130 pares a DCA é gerada da própria matriz.",
        "siops_rreo_anexo_12": "Fonte do percentual, do valor aplicado e da base de cálculo do mínimo em saúde (ASPS). Informado pelo município e homologado no SIOPS.",
        "siops_despesas_por_fonte": "Fonte da despesa total em saúde por fonte de recursos (estágio empenhado, perímetro declarado no SIOPS); contexto, nunca somada à DCA.",
        "cnes_estabelecimentos": "Retrato do CNES (arquivo diário do OpenDataSUS): UBS ativas por natureza, gestão e atendimento SUS.",
        "cnes_historico_estabelecimentos": "Histórico mensal de cada estabelecimento de tipo 01 e 02 (API de dados abertos): UBS públicas ativas em dezembro.",
        "relatorio_aps_cobertura": "Equipes de atenção primária e cobertura potencial estimada da APS (Relatório APS), por município e para o Brasil.",
        "ripsa_mrb402_icsap": "Internações por condições sensíveis à atenção primária (ICSAP), por município de residência.",
        "ripsa_cob201_internacoes": "Total de internações SUS por município de residência: participação das ICSAP.",
        "ripsa_cob501_planos": "Cobertura de planos de saúde privados (ANS): contexto da taxa de ICSAP.",
        "ibge_populacao": "Denominador dos indicadores por habitante e por 10 mil habitantes (captura compartilhada com o painel de Educação).",
        "ibge_ipca": "Correção monetária opcional para reais de 2025 (captura compartilhada com o painel de Educação).",
    }
    out = []
    for gid, chaves in grupos.items():
        caps = []
        for k in chaves:
            c = dict(m[k] if k in m else compartilhadas.get(k, {}))
            if not c:
                continue
            c.pop("rotulos_colunas", None)
            if "arquivos" in c:
                arqs = c.pop("arquivos")
                c["arquivos_capturados"] = len(arqs)
                c["arquivos_com_erro"] = sum(1 for a in arqs.values() if "erro" in a)
                c["capturado_em"] = max((a.get("capturado_em") or "") for a in arqs.values())
            caps.append({"chave": k, **c})
        if caps:
            out.append({"id": gid, "papel": papel[gid], "capturas": caps})
    return out


UNIDADE_PERIODO = {"exercicios": "exercício financeiro", "dezembros": "competência de dezembro", "retrato": "retrato do arquivo diário do CNES (data de captura)"}
CAMPOS_CSV = ["indicador_id", "indicador", "codigo_ibge", "capital", "uf", "periodo_tipo", "ano", "componente", "valor", "unidade", "base_monetaria", "universo", "status",
              "elegivel_comparacao", "situacao_conferencia", "motivo_inelegibilidade", "nota", "nota_material", "participacao_pct", "fonte", "registro", "versao_metodologica",
              "dados_gerados_em", "hash_dados", "numerador", "denominador", "referencia_numerador", "referencia_denominador", "tipo_populacao", "data_referencia", "quebra_serie", "minimo_pct"]
DESCRICAO_CAMPOS = {
    "indicador_id": "Identificador do indicador no catálogo do OBEE.", "indicador": "Nome do indicador.", "codigo_ibge": "Código do município no IBGE (7 dígitos).",
    "capital": "Nome da capital.", "uf": "Sigla da unidade da federação.",
    "periodo_tipo": "O que a coluna 'ano' representa: exercício financeiro, competência de dezembro, ano de processamento da AIH ou retrato de captura.",
    "ano": "Ano do exercício, da competência de dezembro, do processamento ou da captura do retrato (2026 marca o retrato de 09/10/2026).",
    "componente": "Parte do indicador: base monetária (nominal ou real_2025), categoria (por exemplo, pessoal, ou uma fonte de recursos) ou tipo (por exemplo, esf).",
    "valor": "Valor numérico com ponto decimal e a precisão da fonte. Vazio quando não há valor observado; vazio nunca significa zero.", "unidade": "Unidade do valor.",
    "base_monetaria": "Base monetária dos valores em reais, quando se aplica.", "universo": "O que o indicador cobre e o que o numerador e o denominador incluem.",
    "status": "Estado do dado: OBSERVADO, AUSENTE_NA_COLETA, INCONSISTENTE etc.",
    "elegivel_comparacao": "'sim' quando o valor entra em medianas, médias e comparações; 'nao' quando há valor oficial mas ele fica fora.",
    "situacao_conferencia": "Resultado da conferência da despesa entre DCA, RREO e MSC.", "motivo_inelegibilidade": "Por que o valor oficial não entra na comparação, quando é o caso.",
    "nota": "Nota ou ressalva do dado nesta capital e período.", "nota_material": "'sim' quando a nota é uma restrição que precisa aparecer junto do dado.",
    "participacao_pct": "Participação da parte no total, em %, nos indicadores de composição.", "fonte": "Fontes combinadas no valor.",
    "registro": "Registro de origem: documento, conjunto, conta ou coluna de onde o valor foi lido.", "versao_metodologica": "Versão metodológica do indicador.",
    "dados_gerados_em": "Data e hora de geração dos dados publicados.", "hash_dados": "Hash do conteúdo dos dados publicados; identifica a base exata da linha.",
    "numerador": "Numerador, nos indicadores em razão.", "denominador": "Denominador, nos indicadores em razão.",
    "referencia_numerador": "Referência de fonte do numerador.", "referencia_denominador": "Referência de fonte do denominador.",
    "tipo_populacao": "Tipo da população usada: estimativa de 1º de julho ou população do Censo 2022.", "data_referencia": "Data de referência da população.",
    "quebra_serie": "'sim' quando o valor usa base diferente da do ano anterior; a variação entre os dois lados não é comparável.",
    "minimo_pct": "Mínimo de aplicação em ASPS do município, em % da base, quando o demonstrativo o informa (15% pela LC 141/2012, ou o da lei orgânica quando maior).",
}


def _base_monetaria(o, ficha):
    if o["componente"] == "real_2025":
        return "R$ de 2025 (IPCA, média anual)"
    return "R$ correntes do exercício" if ficha["unidade"].startswith("R$") else ""


def _csv(obs, caminho, catalogo, meta):
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    fichas = {i["id"]: i for i in catalogo["indicadores"]}
    ufs = {c: u for c, _, u in entes.CAPITAIS}
    nomes = {c: n for c, n, _ in entes.CAPITAIS}
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=CAMPOS_CSV, lineterminator="\n")
    w.writeheader()
    for o in obs:
        f = fichas[o["indicador"]]
        conf = o.get("conferencia") or {}
        p = f["perimetro"]
        w.writerow({
            "indicador_id": o["indicador"], "indicador": f["nome"], "codigo_ibge": o["ente"], "capital": nomes[o["ente"]], "uf": ufs[o["ente"]],
            "periodo_tipo": "ano de processamento da AIH" if o["indicador"].startswith("sau.icsap") else UNIDADE_PERIODO.get(f["granularidade"]["anos"], ""), "ano": o["ano"],
            "componente": o["componente"] or "", "valor": "" if o["valor"] is None else repr(o["valor"]) if isinstance(o["valor"], float) else o["valor"],
            "unidade": f["unidade"], "base_monetaria": _base_monetaria(o, f), "universo": f"{p['territorial']} {p['institucional']} {p['servico']}", "status": o["status"],
            "elegivel_comparacao": "sim" if o.get("elegivel_comparacao") else "nao", "situacao_conferencia": conf.get("situacao", ""),
            "motivo_inelegibilidade": conf.get("motivo_inelegibilidade") or "", "nota": o["nota"] or "", "nota_material": "sim" if o.get("nota_material") else "nao",
            "participacao_pct": o.get("participacao", "") if o.get("participacao") is not None else "", "fonte": o["fonte"], "registro": o["registro"],
            "versao_metodologica": f["versao_metodologica"], "dados_gerados_em": meta["gerado_em"], "hash_dados": meta["hash_dados"],
            "numerador": "" if not o.get("calculo") else repr(o["calculo"]["numerador"]), "denominador": "" if not o.get("calculo") else repr(o["calculo"]["denominador"]),
            "referencia_numerador": "" if not o.get("calculo") else o["calculo"]["numerador_ref"] + (f" ({o['calculo']['numerador_componente']})" if o["calculo"].get("numerador_componente") else ""),
            "referencia_denominador": "" if not o.get("calculo") else o["calculo"]["denominador_ref"], "tipo_populacao": o.get("tipo_populacao") or "",
            "data_referencia": o.get("data_referencia") or "", "quebra_serie": "sim" if (o.get("quebra_serie") or conf.get("quebra_serie")) else "nao",
            "minimo_pct": "" if o.get("minimo_pct") is None else repr(o["minimo_pct"]),
        })
    with open(caminho, "w", encoding="utf-8", newline="") as fh:
        fh.write(buf.getvalue())


def _csv_dicionario(caminho):
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(["coluna", "descricao"])
    for c in CAMPOS_CSV:
        w.writerow([c, DESCRICAO_CAMPOS[c]])
    w.writerow(["(leia antes de usar)", "Os valores descrevem recursos, estrutura registrada e resultados observados; não classificam governos, não indicam meta e não demonstram causa. Célula vazia não é zero. Mediana e média descrevem o grupo de capitais e não são referência de desempenho."])
    w.writerow(["(perímetros)", "Recursos executados pelo município, serviços localizados no território e população residente são perímetros diferentes: um estabelecimento na capital pode não ser municipal, e resultados por residência não são produção da prefeitura."])
    w.writerow(["(como citar)", "Scrutiniums, Observatório Brasileiro de Eficiência Estatal, Saúde nas capitais. Indique dados_gerados_em e hash_dados da linha utilizada."])
    with open(caminho, "w", encoding="utf-8", newline="") as f:
        f.write(buf.getvalue())


CAMPOS_CSV_REFERENCIAS = ["indicador_id", "indicador", "componente", "ano", "grupo", "capitais_no_grupo", "capitais_com_valor", "capitais_na_comparacao", "media_simples", "mediana", "minimo",
                          "capitais_do_minimo", "maximo", "capitais_do_maximo", "primeiro_quartil", "terceiro_quartil", "quartis_exibidos", "soma_numerador", "soma_denominador", "razao_agregada",
                          "pares_codigos_ibge", "politica_versao", "versao_metodologica", "dados_gerados_em", "hash_dados"]


def _csv_referencias(refs, caminho, catalogo, meta):
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    fichas = {i["id"]: i for i in catalogo["indicadores"]}
    nomes = {c: n for c, n, _ in entes.CAPITAIS}
    vazio = lambda v: "" if v is None else repr(v)
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=CAMPOS_CSV_REFERENCIAS, lineterminator="\n")
    w.writeheader()
    for r in refs:
        f = fichas[r["indicador"]]
        w.writerow({"indicador_id": r["indicador"], "indicador": f["nome"], "componente": r["componente"] or "", "ano": r["ano"], "grupo": r["grupo"],
                    "capitais_no_grupo": r["capitais_no_grupo"], "capitais_com_valor": r["capitais_com_valor"], "capitais_na_comparacao": r["n"],
                    "media_simples": vazio(r["media"]), "mediana": vazio(r["mediana"]), "minimo": vazio(r["minimo"]),
                    "capitais_do_minimo": "; ".join(nomes[c] for c in r["capitais_minimo"]), "maximo": vazio(r["maximo"]), "capitais_do_maximo": "; ".join(nomes[c] for c in r["capitais_maximo"]),
                    "primeiro_quartil": vazio(r["q1"]), "terceiro_quartil": vazio(r["q3"]), "quartis_exibidos": "sim" if r["quartis_exibicao"] else "nao",
                    "soma_numerador": vazio(r["soma_numerador"]), "soma_denominador": vazio(r["soma_denominador"]), "razao_agregada": vazio(r["razao_agregada"]),
                    "pares_codigos_ibge": " ".join(str(c) for c in r["pares"]), "politica_versao": R.VERSAO, "versao_metodologica": f["versao_metodologica"],
                    "dados_gerados_em": meta["gerado_em"], "hash_dados": meta["hash_dados"]})
    with open(caminho, "w", encoding="utf-8", newline="") as fh:
        fh.write(buf.getvalue())


def _csv_matriz(caminho):
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=MF.CAMPOS, lineterminator="\n")
    w.writeheader()
    for l in MF.linhas():
        w.writerow(l)
    with open(caminho, "w", encoding="utf-8", newline="") as fh:
        fh.write(buf.getvalue())


def proveniencia(manif, obs):
    sha_gerador, n_arquivos = base.hash_gerador()
    return {
        "codigo_gerador": {"sha256": sha_gerador, "arquivos": n_arquivos,
                           "escopo": "todos os .py de pipeline/eficiencia_saude (sem seed e sem testes), o catálogo de indicadores e as unidades compartilhadas base.py e entes.py de pipeline/eficiencia"},
        "entradas": {"manifesto_do_seed_sha256": base.sha256_arquivo(base.MANIFESTO), "capturas_no_manifesto": len(manif),
                     "nota": "o manifesto registra o sha256 de cada arquivo do seed; alterar uma entrada altera este hash. População e IPCA vêm do seed de Educação (captura compartilhada)."},
        "saidas": {"hash_dados": _hash_dados(obs), "observacoes": len(obs)},
        "git": base.B.proveniencia_git(),
        "nota": "Reconstruir a gold com o mesmo seed e o mesmo código produz o mesmo hash_dados. O commit que incorpora a gold gerada é posterior à geração.",
    }


MOTIVO_DF = ("O Distrito Federal não tem prefeitura e a saúde distrital é executada pelo Governo do Distrito Federal, que reúne competências de estado e de município. "
             "A despesa com a função Saúde, os estabelecimentos do CNES, as equipes de atenção primária e as internações do Distrito Federal misturam as duas esferas. "
             "Incluí-lo nas comparações das capitais municipais juntaria perímetros diferentes; a inclusão exige tratamento próprio, registrado como próxima etapa.")


def _excluidos():
    """Mesma lista de entes de Educação, com o motivo escrito para o perímetro da Saúde."""
    return [{**e, "motivo": MOTIVO_DF} for e in entes.excluidos()]


def constroi(gerado_em=None):
    catalogo = _catalogo()
    obs = P.todas()
    validacoes = V.todas(obs)
    fatores, medias = P.fatores_ipca()
    manif = base.le_manifesto()["capturas"]
    capturas = []
    for c in manif.values():
        capturas.append(c.get("capturado_em"))
        for a in (c.get("arquivos") or {}).values():
            capturas.append(a.get("capturado_em"))
    refs = R.calcula([o for o in obs if o["indicador"] not in IGNORADOS_REFERENCIA])
    return {
        "meta": {"dominio": base.DOMINIO, "painel": catalogo["painel"]["id"], "versao_pipeline": base.VERSAO_PIPELINE, "versao_catalogo": catalogo["versao_catalogo"],
                 "versao_codigo": base.versao_codigo(), "gerado_em": gerado_em or base.agora_utc(), "dados_capturados_ate": max(c for c in capturas if c),
                 "hash_dados": _hash_dados(obs), "observacoes": len(obs), "proveniencia": proveniencia(manif, obs)},
        "painel": catalogo["painel"],
        "universo": {"capitais": entes.capitais(), "excluidos": _excluidos(), "regioes": entes.REGIOES},
        "periodos": {"financeiros": P.ANOS_FINANCEIROS, "resultados": P.ANOS_RESULTADOS, "dezembros": P.ANOS_FINANCEIROS, "retrato": "2026-10-09"},
        "subfuncoes": {k: v for k, v in __import__("pipeline.eficiencia_saude.fontes.siconfi", fromlist=["x"]).SUBFUNCOES_ROTULO.items()},
        "categorias_natureza": {"pessoal": "Pessoal e encargos sociais", "outras_correntes": "Outras despesas correntes", "capital": "Despesas de capital"},
        "fontes_recurso": {c: r for c, r, _ in P.FONTES_RECURSO},
        "grupos_icsap": {f"g{k:02d}": v for k, v in P.GRUPOS_ICSAP.items()},
        "tipos_equipe": {"esf": "Saúde da Família (eSF)", "eap20": "Atenção Primária, 20 horas (eAP 20h)", "eap30": "Atenção Primária, 30 horas (eAP 30h)", "esfr": "Saúde da Família ribeirinha (eSFR)",
                         "ecr": "Consultório na Rua (eCR)", "eapp20": "Apoio à Atenção Primária, 20 horas (eAPP 20h)", "eapp30": "Apoio à Atenção Primária, 30 horas (eAPP 30h)"},
        "componentes_ubs": {"total_ativas": "UBS ativas (tipos 01 e 02)", "publicas": "Públicas", "nao_publicas": "Não públicas", "gestao_municipal": "Gestão municipal",
                            "gestao_estadual": "Gestão estadual", "gestao_dupla": "Gestão dupla", "publicas_sus": "Públicas com atendimento ambulatorial SUS", "tp01": "Postos de saúde (tipo 01)",
                            "tp02": "Centros de saúde e unidades básicas (tipo 02)", "tp15": "Unidades mistas (tipo 15)", "tp32": "Unidades móveis fluviais (tipo 32)",
                            "tp40": "Unidades móveis terrestres (tipo 40)", "tp71": "Centros de apoio à saúde da família (tipo 71)", "tp74": "Polos academia da saúde (tipo 74)"},
        "ipca": {"fatores_para_2025": {str(a): f for a, f in fatores.items()}, "media_anual_numero_indice": {str(a): round(v, 4) for a, v in medias.items()}},
        "indicadores": catalogo["indicadores"], "cobertura": cobertura(obs, catalogo), "validacoes": validacoes, "trilhas": trilhas(obs), "fontes": fontes(), "status": base.STATUS,
        "politica_referencias": R.POLITICA, "referencias": refs, "referencias_externas": RE.nacionais(), "matriz_fontes": MF.linhas(),
        "politica_conferencia": {"versao": CF.VERSAO_POLITICA, "tolerancia_arredondamento_reais": CF.TOL_ARREDONDAMENTO, "tolerancia_relativa": CF.TOL_RELATIVA,
                                 "elegiveis": sorted(CF.ELEGIVEIS), "rotulos": CF.ROTULO},
        "observacoes": obs,
    }


def reprovadas(gold):
    return [v["id"] for v in gold["validacoes"] if v["resultado"] == "reprovada"]


def _nome_csv(ind):
    return os.path.basename(ind["download"]) if ind.get("download") else None


def publica(gold, raiz_publica=None):
    raiz = raiz_publica or os.path.join(base.RAIZ, "public")
    arquivo = os.path.join(raiz, "eficiencia", "gold", "saude_capitais.json")
    base.grava_json(arquivo, gold)
    catalogo = {"indicadores": gold["indicadores"]}
    for ind in gold["indicadores"]:
        if not ind.get("download"):
            continue
        sel = [o for o in gold["observacoes"] if o["indicador"] == ind["id"]]
        _csv(sel, os.path.join(raiz, ind["download"].lstrip("/")), catalogo, gold["meta"])
    _csv_referencias(gold["referencias"], os.path.join(raiz, "eficiencia", "series", "saude_referencias_capitais.csv"), catalogo, gold["meta"])
    _csv_matriz(os.path.join(raiz, "eficiencia", "series", "saude_matriz_de_fontes.csv"))
    _csv_dicionario(os.path.join(raiz, "eficiencia", "series", "saude_dicionario_das_colunas.csv"))
    base.grava_json(os.path.join(raiz, "eficiencia", "series", "saude_manifesto_das_capturas.json"), base.le_manifesto())
    return arquivo


def promove(gold, raiz_publica=None, diagnostico=None):
    """Gera tudo numa área de trabalho; só substitui a saída pública se nenhuma validação foi reprovada. Escreve apenas arquivos de Saúde
    (nomes com prefixo saude ou sau_ e ctx_populacao_residente_saude): nada de Educação é tocado."""
    import shutil
    import tempfile
    diagnostico = diagnostico or DIAGNOSTICO
    raiz = raiz_publica or os.path.join(base.RAIZ, "public")
    ruins = reprovadas(gold)
    if ruins:
        if os.path.isdir(diagnostico):
            shutil.rmtree(diagnostico)
        return False, publica(gold, diagnostico)
    with tempfile.TemporaryDirectory(dir=os.path.dirname(raiz.rstrip("/")) or None) as tmp:
        publica(gold, tmp)
        for sub in ("gold", "series"):
            origem = os.path.join(tmp, "eficiencia", sub)
            destino = os.path.join(raiz, "eficiencia", sub)
            os.makedirs(destino, exist_ok=True)
            for nome in os.listdir(origem):
                os.replace(os.path.join(origem, nome), os.path.join(destino, nome))
    return True, os.path.join(raiz, "eficiencia", "gold", "saude_capitais.json")


def resumo_validacoes(gold):
    return [(v["id"], v["resultado"]) for v in gold["validacoes"]]
