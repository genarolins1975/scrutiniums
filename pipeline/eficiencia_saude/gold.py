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
import re

from pipeline.eficiencia import entes, referencias as R
from pipeline.eficiencia_saude import base, conferencia as CF, matriz_fontes as MF, padroniza as P, referencias_externas as RE, validacoes as V

ARQUIVO_GOLD = os.path.join(base.GOLD, "saude_capitais.json")
DIAGNOSTICO = os.path.join(base.DADOS, "diagnostico")
FATOR_RAZAO = {"sau.aps.equipes_por_10mil": 10000, "sau.rede.ubs_publicas_por_10mil": 10000, "sau.icsap.taxa": 100000, "sau.icsap.participacao": 100,
               "sau.asps.percentual_aplicado": 100, "sau.aps.cobertura_potencial": 100}
"""Fator que leva soma do numerador ÷ soma do denominador à unidade do indicador (por 10 mil, por 100 mil, em %). Despesa por habitante tem fator 1."""
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
    unidades = {f["id"]: f["unidade"] for f in _catalogo()["indicadores"]}
    for ind, lista in sorted(por_ind.items()):
        comp = PRINCIPAL.get(ind)
        lista = [o for o in lista if comp is None or o["componente"] == comp] or lista
        ano_max = max(x["ano"] for x in lista)
        alvo = next((o for o in lista if o["ente"] == ENTE_TRILHA and o["ano"] == ano_max), lista[-1])
        passos = [f"Registro de origem: {alvo['registro']}."]
        c = alvo.get("calculo")
        if c:
            passos.append(f"Numerador: {_br(c['numerador'])} ({c['numerador_ref']}). Denominador: {_br(c['denominador'])} ({c['denominador_ref']}).")
        rotulo_comp = f", componente {alvo['componente']}" if alvo["componente"] else ""
        if unidades[ind].startswith("%") and alvo.get("participacao") is not None:
            # indicador de composição: o valor da observação é em reais; a participação, em %
            passos.append(f"Valor publicado: R$ {_br(alvo['valor'])}{rotulo_comp}, participação de {_br(alvo['participacao'])}% no total (estado {alvo['status']}).")
        else:
            passos.append(f"Valor publicado: {_br(alvo['valor'])} {unidades[ind]}{rotulo_comp} (estado {alvo['status']}).")
        out.append({"indicador": ind, "ente": alvo["ente"], "nome": nomes[alvo["ente"]], "ano": alvo["ano"], "componente": alvo["componente"], "passos": passos, "valor": alvo["valor"]})
    return out


ENTE_TRILHA = 3550308
"""Capital usada nos exemplos de reconstrução, a mesma dos exemplos documentados em VALIDACOES_E_REPRODUCAO.md (São Paulo)."""


def _br(v):
    """Número com separador de milhares em ponto e decimais em vírgula, sem zeros à direita."""
    if v is None:
        return "sem valor"
    texto = f"{round(v, 4):,.4f}".rstrip("0").rstrip(".") if isinstance(v, float) else f"{v:,}"
    return texto.replace(",", "\u0000").replace(".", ",").replace("\u0000", ".")


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
        "siconfi_msc_funcao10": "Terceira fonte da conferência da despesa (diferença material) e fonte da abertura por natureza; nunca somada à DCA.",
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
              "elegivel_comparacao", "situacao_conferencia", "motivo_inelegibilidade", "nota", "nota_material", "participacao_pct", "fonte", "fonte_url", "data_captura", "registro", "versao_metodologica",
              "dados_gerados_em", "hash_dados", "numerador", "denominador", "referencia_numerador", "referencia_denominador", "tipo_populacao", "base_populacional", "data_referencia", "quebra_serie", "minimo_pct"]
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
    "participacao_pct": "Participação da parte no total, em %, nos indicadores de composição.", "fonte": "Fontes combinadas no valor: instituição e conjunto de dados.",
    "fonte_url": "Páginas oficiais das fontes (separadas por espaço). O endereço exato de cada coleta, com parâmetros, está no manifesto das capturas.", "data_captura": "Data da captura mais recente das fontes do valor (AAAA-MM-DD).",
    "registro": "Registro de origem: documento, conjunto, conta ou coluna de onde o valor foi lido.", "versao_metodologica": "Versão metodológica do indicador.",
    "dados_gerados_em": "Data e hora de geração dos dados publicados.", "hash_dados": "Hash do conteúdo dos dados publicados; identifica a base exata da linha.",
    "numerador": "Numerador, nos indicadores em razão.", "denominador": "Denominador, nos indicadores em razão.",
    "referencia_numerador": "Referência de fonte do numerador.", "referencia_denominador": "Referência de fonte do denominador.",
    "tipo_populacao": "Tipo da população usada: estimativa de 1º de julho ou população do Censo 2022.",
    "base_populacional": "Base da população do denominador: estimativa anterior ao Censo 2022, Censo 2022 (2022 e 2023, mesma população) ou estimativa posterior ao Censo 2022. Variação entre exercícios de bases diferentes mistura a mudança do denominador.",
    "data_referencia": "Data de referência da população.",
    "quebra_serie": "Marca a base do denominador: dois exercícios consecutivos só têm variação comparável quando a marca é a mesma (sim e sim, ou nao e nao). Marcas diferentes indicam mudança de base populacional ou de método entre os dois.",
    "minimo_pct": "Mínimo de aplicação em ASPS do município, em % da base, quando o demonstrativo o informa (15% pela LC 141/2012, ou o da lei orgânica quando maior).",
}


def _num(v):
    """Número para CSV: até 8 casas, sem artefato de ponto flutuante (63.355000000000004 vira 63.355)."""
    if v is None:
        return ""
    return repr(round(v, 8)) if isinstance(v, float) else str(v)


def _mapa_fontes(fontes_gold):
    """id da fonte → (descrição legível, páginas oficiais, data da última captura). As páginas são endereços que uma pessoa abre; o endereço exato de cada coleta,
    com parâmetros e marcadores, fica no manifesto das capturas."""
    out = {}
    for f in fontes_gold:
        caps = f["capturas"]
        c = caps[0]
        nome = f"{c['instituicao']}, {c['conjunto']}" if c.get("instituicao") and c.get("conjunto") else f["id"]
        paginas = []
        for x in caps:
            if x.get("pagina") and x["pagina"] not in paginas:
                paginas.append(x["pagina"])
        datas = [x.get("capturado_em") for x in caps if x.get("capturado_em")]
        out[f["id"]] = (nome, " ".join(paginas), (max(datas) if datas else "")[:10])
        # as observações citam também a captura específica (por exemplo, a relação de população de 2023 ou o Relatório APS do Brasil)
        for x in caps:
            if x.get("chave") and x["chave"] not in out:
                n2 = f"{x['instituicao']}, {x['conjunto']}" if x.get("instituicao") and x.get("conjunto") else x["chave"]
                out[x["chave"]] = (n2, x.get("pagina") or "", (x.get("capturado_em") or "")[:10])
    return out


def _fonte_legivel(ids, mapa):
    partes = [p for p in re.split(r"[+;]\s*", ids or "") if p]
    nomes = [mapa[p][0] if p in mapa else p for p in partes]
    urls = list(dict.fromkeys(u for p in partes if p in mapa for u in mapa[p][1].split() if u))
    datas = [mapa[p][2] for p in partes if p in mapa and mapa[p][2]]
    return "; ".join(dict.fromkeys(nomes)), " ".join(urls), (max(datas) if datas else "")


def _base_monetaria(o, ficha):
    if o["componente"] == "real_2025":
        return "R$ de 2025 (IPCA, média anual)"
    return "R$ correntes do exercício" if ficha["unidade"].startswith("R$") else ""


def _csv(obs, caminho, catalogo, meta, mapa_fontes=None):
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    mapa_fontes = mapa_fontes or {}
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
        ids_fonte = o["fonte"] + ("+ibge_ipca" if o["componente"] == "real_2025" and "ibge_ipca" not in o["fonte"] else "")  # reais de 2025 também vêm do IPCA
        fonte_txt, fonte_url, fonte_data = _fonte_legivel(ids_fonte, mapa_fontes)
        w.writerow({
            "indicador_id": o["indicador"], "indicador": f["nome"], "codigo_ibge": o["ente"], "capital": nomes[o["ente"]], "uf": ufs[o["ente"]],
            "periodo_tipo": "ano de processamento da AIH" if o["indicador"].startswith("sau.icsap") else UNIDADE_PERIODO.get(f["granularidade"]["anos"], ""), "ano": o["ano"],
            "componente": o["componente"] or "", "valor": _num(o["valor"]),
            "unidade": f["unidade"], "base_monetaria": _base_monetaria(o, f), "universo": f"{p['territorial']} {p['institucional']} {p['servico']}", "status": o["status"],
            "elegivel_comparacao": "sim" if o.get("elegivel_comparacao") else "nao", "situacao_conferencia": conf.get("situacao", ""),
            "motivo_inelegibilidade": conf.get("motivo_inelegibilidade") or "", "nota": o["nota"] or "", "nota_material": "sim" if o.get("nota_material") else "nao",
            "participacao_pct": _num(o.get("participacao")), "fonte": fonte_txt or o["fonte"], "fonte_url": fonte_url, "data_captura": fonte_data, "registro": o["registro"],
            "versao_metodologica": f["versao_metodologica"], "dados_gerados_em": meta["gerado_em"], "hash_dados": meta["hash_dados"],
            "numerador": "" if not o.get("calculo") else _num(o["calculo"]["numerador"]), "denominador": "" if not o.get("calculo") else _num(o["calculo"]["denominador"]),
            "referencia_numerador": "" if not o.get("calculo") else o["calculo"]["numerador_ref"] + (f" ({o['calculo']['numerador_componente']})" if o["calculo"].get("numerador_componente") else ""),
            "referencia_denominador": "" if not o.get("calculo") else o["calculo"]["denominador_ref"], "tipo_populacao": o.get("tipo_populacao") or "", "base_populacional": o.get("base_populacional") or "",
            "data_referencia": o.get("data_referencia") or "", "quebra_serie": "sim" if (o.get("quebra_serie") or conf.get("quebra_serie")) else "nao",
            "minimo_pct": _num(o.get("minimo_pct")),
        })
    with open(caminho, "w", encoding="utf-8", newline="") as fh:
        fh.write(buf.getvalue())


DESCRICAO_REFERENCIAS = {
    "indicador_id": "Identificador do indicador no catálogo do OBEE.", "indicador": "Nome do indicador.", "componente": "Parte do indicador (base monetária, categoria ou tipo), quando houver.",
    "ano": "Ano do exercício, da competência de dezembro ou do processamento, conforme o indicador.", "grupo": "Grupo de capitais: todas ou a região (N, NE, SE, S, CO).",
    "capitais_no_grupo": "Número de capitais do grupo.", "capitais_com_valor": "Capitais do grupo com valor observado, elegível ou não.",
    "capitais_na_comparacao": "Capitais com valor observado e elegível: as que entram nas estatísticas da linha.",
    "media_simples": "Média aritmética simples das capitais na comparação; cada capital pesa igual.", "mediana": "Valor central das capitais na comparação.",
    "minimo": "Menor valor das capitais na comparação.", "capitais_do_minimo": "Capitais com o menor valor (todas, em caso de empate).",
    "maximo": "Maior valor das capitais na comparação.", "capitais_do_maximo": "Capitais com o maior valor (todas, em caso de empate).",
    "primeiro_quartil": "Primeiro quartil (interpolação linear, tipo 7).", "terceiro_quartil": "Terceiro quartil (interpolação linear, tipo 7).",
    "quartis_exibidos": "'sim' quando o grupo tem 8 capitais ou mais e a interface mostra a faixa entre quartis; política de apresentação, não garantia estatística.",
    "soma_numerador": "Soma dos numeradores das capitais na comparação, na unidade do numerador (vazio quando o indicador não é razão).",
    "soma_denominador": "Soma dos denominadores das capitais na comparação, na unidade do denominador.",
    "fator_razao": "Fator da unidade do indicador aplicado à razão agregada: 1 (R$ por habitante), 10000 (por 10 mil habitantes), 100000 (por 100 mil habitantes) ou 100 (em %).",
    "razao_agregada": "Soma do numerador ÷ soma do denominador × fator_razao, na unidade do indicador; pesa cada capital pelo seu denominador. Não é a média das capitais.",
    "pares_codigos_ibge": "Códigos IBGE das capitais na comparação, separados por espaço.", "politica_versao": "Versão da política de referências.",
    "versao_metodologica": "Versão metodológica do indicador.", "dados_gerados_em": "Data e hora de geração dos dados publicados.",
    "hash_dados": "Hash do conteúdo dos dados publicados; identifica a base exata da linha.",
}


DESCRICAO_MATRIZ = {
    "id": "Identificador da medida candidata: F (recursos), E (estrutura), R (resultados) e D (contexto demográfico), com número.", "medida": "Medida candidata avaliada.",
    "fonte": "Fonte oficial testada.", "acesso_testado": "O que foi testado no acesso à fonte em 09/10/2026.", "cobertura": "Cobertura das 26 capitais e dos períodos na fonte.",
    "periodo": "Período disponível.", "decisao": "publicar com ressalva, apenas contexto ou não publicar.", "fundamento": "Por que a decisão foi tomada, com as ressalvas.",
}


def _csv_dicionario(caminho):
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(["arquivo", "coluna", "descricao"])
    for c in CAMPOS_CSV:
        w.writerow(["sau_*.csv (um por indicador)", c, DESCRICAO_CAMPOS[c]])
    for c in CAMPOS_CSV_REFERENCIAS:
        w.writerow(["saude_referencias_capitais.csv", c, DESCRICAO_REFERENCIAS[c]])
    for c in MF.CAMPOS:
        w.writerow(["saude_matriz_de_fontes.csv", c, DESCRICAO_MATRIZ[c]])
    w.writerow(["", "(números)", "Valores decimais usam ponto e têm até 8 casas; a precisão original do cálculo é preservada na gold."])
    w.writerow(["", "(leia antes de usar)", "Os valores descrevem recursos, estrutura registrada e resultados observados; não classificam governos, não indicam meta e não demonstram causa. Célula vazia não é zero. Mediana e média descrevem o grupo de capitais e não são referência de desempenho."])
    w.writerow(["", "(perímetros)", "Recursos executados pelo município, serviços localizados no território e população residente são perímetros diferentes: um estabelecimento na capital pode não ser municipal, e resultados por residência não são produção da prefeitura."])
    w.writerow(["", "(como citar)", "Scrutiniums, Observatório Brasileiro de Eficiência Estatal, Saúde nas capitais. Indique dados_gerados_em e hash_dados da linha utilizada."])
    with open(caminho, "w", encoding="utf-8", newline="") as f:
        f.write(buf.getvalue())


CAMPOS_CSV_REFERENCIAS = ["indicador_id", "indicador", "componente", "ano", "grupo", "capitais_no_grupo", "capitais_com_valor", "capitais_na_comparacao", "media_simples", "mediana", "minimo",
                          "capitais_do_minimo", "maximo", "capitais_do_maximo", "primeiro_quartil", "terceiro_quartil", "quartis_exibidos", "soma_numerador", "soma_denominador", "fator_razao", "razao_agregada",
                          "pares_codigos_ibge", "politica_versao", "versao_metodologica", "dados_gerados_em", "hash_dados"]


def _csv_referencias(refs, caminho, catalogo, meta):
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    fichas = {i["id"]: i for i in catalogo["indicadores"]}
    nomes = {c: n for c, n, _ in entes.CAPITAIS}
    vazio = _num
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
                    "soma_numerador": vazio(r["soma_numerador"]), "soma_denominador": vazio(r["soma_denominador"]), "fator_razao": r.get("fator_razao", 1), "razao_agregada": vazio(r["razao_agregada"]),
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


def _aplica_fator(refs):
    """Razão agregada na unidade do indicador: soma do numerador ÷ soma do denominador × fator da unidade."""
    for r in refs:
        fator = FATOR_RAZAO.get(r["indicador"], 1)
        r["fator_razao"] = fator
        if r["razao_agregada"] is not None:
            r["razao_agregada"] = r["razao_agregada"] * fator
    return refs


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
    refs = _aplica_fator([r for r in R.calcula([o for o in obs if o["indicador"] not in IGNORADOS_REFERENCIA])])
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
                            "gestao_municipal_nao_publica": "Gestão municipal e natureza jurídica não pública",
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
    mapa_fontes = _mapa_fontes(gold["fontes"])
    for ind in gold["indicadores"]:
        if not ind.get("download"):
            continue
        sel = [o for o in gold["observacoes"] if o["indicador"] == ind["id"]]
        _csv(sel, os.path.join(raiz, ind["download"].lstrip("/")), catalogo, gold["meta"], mapa_fontes)
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
