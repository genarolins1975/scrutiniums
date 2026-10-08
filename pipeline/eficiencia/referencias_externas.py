"""Referências nacionais e internacionais, cada uma com universo, período e uso permitido declarados.

Classes (campo `tipo`):

* nacional_mesmo_universo   indicador oficial do mesmo conceito e da mesma rede (por exemplo, a média de alunos por
                            turma da rede municipal do Brasil, calculada pelo INEP). Permite diferença numérica com
                            a unidade da escala: não é a média das capitais, é o cálculo e o universo da fonte;
* nacional_outro_universo   indicador oficial de outro universo (por exemplo, todas as redes públicas e esferas).
                            Mostrado ao lado, com o universo, sem diferença;
* internacional_contexto    ajuda a compreender o tema, mas compara outra escala ou população (um país, não um
                            município). Seção própria, sem diferença percentual contra a capital e fora da
                            distribuição das capitais;
* incompativel              candidata examinada e rejeitada, com o motivo (não entra no painel como valor).

Os valores são lidos do seed (recortes preservados com sha256) e nunca recalculados; a média da OCDE é a
publicada pela fonte e o pipeline confere que ela é a média simples dos países da OCDE com dado.
"""
from pipeline.eficiencia import base, entes

ANOS_ATU = list(range(2021, 2026))

AGREGADOS_OCDE = {"OECD", "EU25", "EU27", "G20", "OECDE", "EU22"}

# nível ISCED ↔ etapa brasileira (mapeamento padrão da UNESCO; não conferido na documentação do Brasil nesta rodada)
ISCED_ETAPA = {"ISCED11_1": "anos_iniciais", "ISCED11_2": "anos_finais"}

UNIDADE_DIFERENCA = {"edu.atu.rede_municipal": "alunos por turma", "edu.aprovacao.rede_municipal": "pontos percentuais",
                     "edu.ideb.rede_municipal": "pontos", "edu.saeb.rede_municipal": "pontos"}


def _nacionais():
    caminho = f"{base.SEED}/inep_nacional/referencias_nacionais.json.gz"
    try:
        return base.le_json_gz(caminho)
    except FileNotFoundError:
        return []


def _ocde():
    caminho = f"{base.SEED}/ocde/education_at_a_glance.json.gz"
    try:
        return base.le_json_gz(caminho)
    except FileNotFoundError:
        return []


def nacionais():
    """Referências oficiais do INEP para o Brasil, por indicador do painel, etapa e ano."""
    out = []
    for r in _nacionais():
        if r["valor"] is None:
            continue
        t = r["tipo"]
        if t == "atu":
            ind, comp, unidade, tipo = "edu.atu.rede_municipal", None, "alunos por turma", "nacional_mesmo_universo"
            rotulo = "Brasil, rede municipal (INEP)"
            escopo = "Média de alunos por turma da rede municipal do Brasil, todas as localizações, calculada pelo INEP (não é a média das capitais)."
        elif t == "rendimento":
            ind, comp, unidade, tipo = "edu.aprovacao.rede_municipal", None, "%", "nacional_mesmo_universo"
            rotulo = "Brasil, rede municipal (INEP)"
            escopo = "Taxa de aprovação da rede municipal do Brasil, todas as localizações, publicada pelo INEP (não é a média das capitais)."
        elif t == "ideb":
            comp = r["componente"]
            ind = "edu.saeb.rede_municipal" if comp in ("matematica", "portugues") else "edu.ideb.rede_municipal"
            unidade, tipo = ("pontos na escala Saeb" if ind.startswith("edu.saeb") else "índice de 0 a 10" if comp != "p_rendimento" else "índice de 0 a 1"), "nacional_mesmo_universo"
            rotulo = "Brasil, rede municipal (INEP)"
            escopo = "Resultado do Brasil para a rede municipal, calculado e publicado pelo INEP; não é a média dos Idebs municipais nem das capitais."
        elif t == "investimento_estudante":
            if r["componente"] != "real":
                continue
            ind, comp, unidade, tipo = "edu.despesa.por_matricula_rede_propria", None, "R$ de 2021 por estudante", "nacional_outro_universo"
            rotulo = "Brasil, todas as redes públicas (INEP)"
            escopo = ("Investimento público direto por estudante, consolidado de União, estados, DF e municípios, em instituições públicas de todos os níveis "
                      "(INEP, metodologia da OCDE; exclui aposentadorias, pensões, bolsas, dívida e transferências ao setor privado; valores em reais de 2021 pelo IPCA). "
                      "Outro universo: não é a rede municipal, e a série termina em 2021.")
            etapas_map = {"educacao_basica": "total"}
            if r["etapa"] not in etapas_map:
                continue
            r = {**r, "etapa": etapas_map[r["etapa"]]}
        else:
            continue
        out.append({"id": f"{t}.{r['ano']}.{r['etapa']}.{comp or ''}", "indicador": ind, "componente": comp, "etapa": r["etapa"], "ano": r["ano"], "tipo": tipo,
                    "rotulo": rotulo, "valor": r["valor"], "unidade": unidade, "unidade_diferenca": UNIDADE_DIFERENCA.get(ind) if tipo == "nacional_mesmo_universo" else None,
                    "escopo": escopo, "fonte": r["captura"], "registro": r["registro"]})
    return out


def _media_simples(vals):
    return sum(vals) / len(vals) if vals else None


def internacionais():
    """Contexto internacional (OCDE): Brasil, média da OCDE publicada e todos os países com dado, por conjunto, nível e ano."""
    reg = _ocde()
    out = []
    grupos = {}
    for r in reg:
        grupos.setdefault((r["conjunto"], r["nivel"], r["instituicoes"], r["ano"]), []).append(r)
    nomes = {"ocde_tamanho_turma": "Tamanho médio das turmas (alunos por turma)", "ocde_despesa_por_estudante": "Despesa por estudante em tempo integral (USD PPC)"}
    for (conj, nivel, inst, ano), linhas in sorted(grupos.items()):
        paises = sorted(({"codigo": x["pais"], "nome": x["nome"], "valor": x["valor"]} for x in linhas if x["pais"] not in AGREGADOS_OCDE and x["pais"] != "BRA"),
                        key=lambda x: x["nome"])
        bra = next((x["valor"] for x in linhas if x["pais"] == "BRA"), None)
        ocde = next((x["valor"] for x in linhas if x["pais"] == "OECD"), None)
        # a média publicada precisa ser a média simples dos membros da OCDE com dado; os parceiros ficam fora dela
        out.append({"conjunto": conj, "nome": nomes[conj], "nivel": nivel, "etapa": ISCED_ETAPA.get(nivel), "instituicoes": inst, "ano": ano,
                    "unidade": linhas[0]["unidade"], "brasil": bra, "media_ocde_publicada": ocde, "paises": paises,
                    "paises_com_dado": len(paises) + (1 if bra is not None else 0),
                    "agregados_na_fonte": sorted({x["pais"] for x in linhas if x["pais"] in AGREGADOS_OCDE}),
                    "fonte": "ocde_eag"})
    return out


MATRIZ = [
    # id, indicador, candidata, fonte, universo, unidade, periodo, metodo, compatibilidade, tipo, uso, decisao
    {"id": "inep.atu.brasil", "indicador": "edu.atu.rede_municipal", "candidata": "ATU, Brasil, rede municipal",
     "fonte": "INEP, Indicadores Educacionais, Média de Alunos por Turma, Brasil, regiões e UFs", "universo": "Rede municipal do Brasil, todas as localizações",
     "unidade": "alunos por turma", "periodo": "Censo Escolar 2021 a 2025", "metodo": "Mesmo cálculo da ATU municipal do INEP, agregado para o Brasil pelo próprio INEP",
     "compatibilidade": "Mesmo conceito, mesma rede e mesma etapa", "tipo": "nacional_mesmo_universo",
     "uso": "Mostrada ao lado de cada capital, com diferença em alunos por turma", "decisao": "Aceita: é o indicador oficial na escala nacional da mesma rede."},
    {"id": "inep.aprovacao.brasil", "indicador": "edu.aprovacao.rede_municipal", "candidata": "Taxa de aprovação, Brasil, rede municipal",
     "fonte": "INEP, Taxas de Rendimento Escolar, Brasil, regiões e UFs", "universo": "Rede municipal do Brasil, todas as localizações",
     "unidade": "%", "periodo": "Ano letivo 2021 a 2025", "metodo": "Taxa oficial do INEP; o painel não recalcula taxas",
     "compatibilidade": "Mesmo conceito, mesma rede e mesma etapa", "tipo": "nacional_mesmo_universo",
     "uso": "Mostrada ao lado de cada capital, com diferença em pontos percentuais", "decisao": "Aceita."},
    {"id": "inep.ideb.brasil", "indicador": "edu.ideb.rede_municipal", "candidata": "Ideb, Saeb, P e N, Brasil, rede municipal",
     "fonte": "INEP, Ideb 2025, resultados do Brasil por rede", "universo": "Rede municipal do Brasil",
     "unidade": "índice de 0 a 10; pontos na escala Saeb", "periodo": "Edições 2005 a 2025", "metodo": "Cálculo do INEP para o Brasil (não é a média dos Idebs municipais)",
     "compatibilidade": "Mesmo conceito, mesma rede e mesma etapa", "tipo": "nacional_mesmo_universo",
     "uso": "Mostrada ao lado de cada capital, com diferença em pontos; sem metas", "decisao": "Aceita. Metas do Ideb seguem fora do painel (nota metodológica 1.1)."},
    {"id": "inep.investimento_estudante", "indicador": "edu.despesa.por_matricula_rede_propria", "candidata": "Investimento público direto por estudante, educação básica, Brasil",
     "fonte": "INEP, Indicadores Financeiros Educacionais (valores reais pelo IPCA, base 2021)", "universo": "Todas as redes públicas e esferas (União, estados, DF e municípios)",
     "unidade": "R$ de 2021 por estudante", "periodo": "2000 a 2021 (série encerrada em 2021 nas tabelas vigentes)",
     "metodo": "Metodologia da OCDE: grupos de natureza pessoal ativo, outras despesas correntes e investimentos; exclui aposentadorias, pensões, bolsas, dívida e transferências ao setor privado",
     "compatibilidade": "Conceito próximo (também exclui inativos e transferências a instituições privadas), mas outro universo: redes estaduais e federais, todos os níveis e rateio por nível feito pelo INEP",
     "tipo": "nacional_outro_universo", "uso": "Mostrada só para 2021, com o universo declarado; sem diferença com a capital",
     "decisao": "Contexto nacional de outro universo. Não é a rede municipal e não há edição do INEP para 2022 a 2025 nas tabelas vigentes."},
    {"id": "ocde.tamanho_turma", "indicador": "edu.atu.rede_municipal", "candidata": "OCDE, Education at a Glance, tamanho médio das turmas, ISCED 1 e 2",
     "fonte": "OCDE, API SDMX, OECD.EDU.IMEP, DF_UOE_NF_PERS_CLS 1.1", "universo": "País (para o Brasil, todas as esferas), instituições públicas e todas, ensino regular",
     "unidade": "alunos por turma", "periodo": "2023 e 2024 (ano de referência da OCDE)", "metodo": "Alunos matriculados ÷ número de turmas; média da OCDE simples, sem ponderação, dos países com dado",
     "compatibilidade": "Definição próxima da ATU do INEP; universo diferente (país, não rede municipal) e sem creche e pré-escola; tratamento de educação especial e AEE na ATU não verificado",
     "tipo": "internacional_contexto", "uso": "Seção própria de contexto internacional, sem diferença percentual com a capital e fora da distribuição das capitais",
     "decisao": "Aceita como contexto para anos iniciais (ISCED 1) e anos finais (ISCED 2); o mapeamento ISCED segue a convenção da UNESCO e não foi conferido na documentação do Brasil."},
    {"id": "ocde.tamanho_turma.infantil", "indicador": "edu.atu.rede_municipal", "candidata": "OCDE, tamanho de turma na educação infantil (ISCED 01 e 02)",
     "fonte": "OCDE, Education at a Glance 2025, tabela D2.1 (crianças por docente)", "universo": "País", "unidade": "crianças por docente",
     "periodo": "2023", "metodo": "Razão criança por docente, não tamanho de turma", "compatibilidade": "O dataflow de tamanho de turma não cobre ISCED 01 e 02; alunos por turma não é alunos por professor",
     "tipo": "incompativel", "uso": "Nenhum", "decisao": "Rejeitada: outro conceito e sem dado de tamanho de turma para creche e pré-escola."},
    {"id": "ocde.despesa_estudante", "indicador": "edu.despesa.por_matricula_rede_propria", "candidata": "OCDE, despesa por estudante em tempo integral, ISCED 1, 2 e 1 a 8",
     "fonte": "OCDE, API SDMX, OECD.EDU.IMEP, DF_UOE_INDIC_FIN_PERSTUD 3.2", "universo": "País; despesa governamental em instituições educacionais; Brasil reportado só com fonte governamental",
     "unidade": "USD PPC por estudante em tempo integral", "periodo": "2023", "metodo": "Despesa em instituições (ensino e não ensino) ÷ estudantes equivalentes em tempo integral; conversão por paridade de poder de compra do PIB, nunca por câmbio",
     "compatibilidade": "Outra escala (país), outro conceito de despesa (instituições, regime de caixa) e outro denominador (tempo integral); sem creche e pré-escola para o Brasil",
     "tipo": "internacional_contexto", "uso": "Seção própria de contexto, sem conversão para reais nem diferença com a capital",
     "decisao": "Aceita só como contexto internacional (ISCED 1 e 2); nunca comparação direta com um município."},
    {"id": "ocde.repetencia", "indicador": "edu.aprovacao.rede_municipal", "candidata": "OCDE, taxa de repetência; UNESCO UIS, repetência (REPR)",
     "fonte": "OCDE, DF_UOE_NF_DIST_RPTR; UNESCO UIS, API pública", "universo": "País", "unidade": "% de alunos",
     "periodo": "OCDE 2013 a 2024 (Brasil sem valor); UIS: último valor do Brasil em 2010", "metodo": "Repetência por estoque ou coorte, não a taxa de aprovação do INEP",
     "compatibilidade": "Outro conceito; o Brasil não tem valor na OCDE e o último do UIS é de 2010", "tipo": "incompativel", "uso": "Nenhum",
     "decisao": "Rejeitada: indisponível para o Brasil e de outro conceito."},
    {"id": "pisa.ideb", "indicador": "edu.ideb.rede_municipal", "candidata": "PISA (OCDE) para Ideb e Saeb",
     "fonte": "OCDE, PISA", "universo": "Estudantes de 15 anos, amostra nacional", "unidade": "pontos PISA", "periodo": "Ciclos trienais",
     "metodo": "Escala e população próprias", "compatibilidade": "Ideb, Saeb e PISA não compartilham população, escala nem construto; sem conversão entre notas",
     "tipo": "incompativel", "uso": "Nenhum", "decisao": "Rejeitada: o painel não converte nem equipara notas de escalas diferentes."},
    {"id": "ocde.matriculas", "indicador": "edu.matriculas.rede_municipal", "candidata": "OCDE e UNESCO UIS, matrículas e taxas de matrícula por idade",
     "fonte": "OCDE, DF_UOE_NF_STUD_TOTALS e DF_UOE_NF_ENRL_RATE; UNESCO UIS, NER e GER", "universo": "País", "unidade": "matrículas; % da população da idade",
     "periodo": "2024", "metodo": "Contagem nacional; taxa tem a população como denominador", "compatibilidade": "Matrículas nacionais são de outra escala; taxas de matrícula medem cobertura da população, outro conceito",
     "tipo": "incompativel", "uso": "Nenhum", "decisao": "Rejeitada para matrículas da rede municipal; a cobertura da população por idade é tema distinto."},
    {"id": "ibge.despesa_habitante", "indicador": "edu.despesa.por_habitante", "candidata": "Despesa municipal em Educação por habitante, Brasil",
     "fonte": "Nenhuma publicação oficial encontrada (IBGE, INEP, STN, FNDE)", "universo": "Conjunto dos municípios do Brasil", "unidade": "R$ por habitante", "periodo": "Não se aplica",
     "metodo": "Calcular a soma da função Educação de todos os municípios por habitante seria cálculo próprio, não indicador oficial", "compatibilidade": "Sem indicador oficial",
     "tipo": "incompativel", "uso": "Nenhum", "decisao": "Sem referência nacional: o painel mostra o grupo das capitais (média, mediana, extremos, razão agregada), rotulado como tal."},
    {"id": "fnde.siope.por_aluno", "indicador": "edu.despesa.por_matricula_rede_propria", "candidata": "SIOPE (FNDE), Investimento educacional por aluno (indicadores 4.x)",
     "fonte": "FNDE, SIOPE, relatórios gerenciais (API do relatório gerencial)", "universo": "Município, declaração própria no SIOPE", "unidade": "R$ por aluno", "periodo": "Exercícios 2021 a 2025",
     "metodo": "Fórmula e universo de matrículas não encontrados em documentação pública; valores não reproduzíveis com DCA, MSC e Censo (razão entre o valor implícito e a despesa da função de 0,83 a 2,5)",
     "compatibilidade": "Não verificável e instável entre exercícios", "tipo": "incompativel", "uso": "Nenhum",
     "decisao": "Examinada e não adotada: sem documentação da fórmula e sem reprodução com fontes abertas; ver docs/obee/COMPARACOES_GASTO_POR_HABITANTE_E_MATRICULA.md."},
]


def matriz():
    return MATRIZ


def paridade_ocde():
    """Confere que a média da OCDE publicada é a média simples dos membros da OCDE com dado. Devolve {chave: diferença}.
    Os parceiros (Brasil, Bulgária, Croácia, Peru, Romênia, China, Arábia Saudita) não integram a média da OCDE."""
    PARCEIROS = {"BRA", "BGR", "HRV", "PER", "ROU", "CHN", "SAU", "ARG", "IDN", "IND", "ZAF"}
    out = {}
    for g in internacionais():
        vals = [p["valor"] for p in g["paises"] if p["codigo"] not in PARCEIROS]
        m = _media_simples(vals)
        if m is not None and g["media_ocde_publicada"] is not None:
            out[(g["conjunto"], g["nivel"], g["instituicoes"], g["ano"])] = (len(vals), m, g["media_ocde_publicada"], m - g["media_ocde_publicada"])
    return out
