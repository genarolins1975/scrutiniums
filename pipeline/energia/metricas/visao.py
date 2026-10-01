"""Métricas do módulo Visão geral: definição única das medidas publicadas em
public/energia/gold/sintese.json. As regras rodam em pipeline/energia/gold/sintese.py
(funções puras) e pipeline/energia/modulos/visao.py; a interface só lê o resultado.

A Visão geral reutiliza números das golds de origem. Quando a medida já tem definição no
catálogo (EAR do SIN, tarifa B1, DEC, perdas, Tarifa Social, horas no piso), o painel
aponta para ela e nada é redefinido aqui. As medidas abaixo são as que a Visão geral
publica com regra própria (as condições do "o que observar", a frequência de disparo, a
defasagem por frase) ou as séries de operação que ainda não tinham verbete no catálogo e
que P005 copia sem recálculo.

Convenções: datas no calendário civil de Brasília; data de processamento é a de
comum.hoje_brasilia(); dia sem dado é ausência (nunca zero) e interrompe a contagem de
duração das regras.
"""

GOLD = "sintese.json"
PAGINA = ["/setor-eletrico/visao-geral"]
F_EAR, F_ENA, F_CARGA = "ear_subsistema_di", "ena_subsistema_di", "carga_energia_di"
F_BAL, F_INT, F_PLD, F_CMO = "balanco_energia_subsistema_ho", "intercambio_nacional_ho", "ccee_pld_horario", "cmo_se"
F_COFF_E, F_COFF_S = "ons_coff_eolica", "ons_coff_fotovoltaica"

_HIST = ("Frequência de disparo reavaliada em todos os dias desde 01/01/2021 com os dados vigentes hoje (já revisados), "
         "pela mesma função que avalia o dia (gold/sintese.py: episodios e resumo_historico).")
_NAO_CAUSA = "Alerta descreve condição medida; não implica causa nem é previsão."


def _m(**kw):
    base = {"gold": GOLD, "paginas": PAGINA, "versao_formula": "1.0"}
    base.update(kw)
    return base


def _regra(id, titulo, pergunta, definicao, fontes, formula, unidade, grao_geo, comparabilidade, cobertura, limitacoes,
           grao_temporal="dia", validacoes=()):
    return _m(id=id, titulo=titulo, pergunta=pergunta, definicao=definicao, unidade=unidade, grao_geografico=grao_geo,
              grao_temporal=grao_temporal, fontes=fontes, formula=formula,
              regra_agregacao="condição diária booleana; episódio = duração mínima de dias seguidos com a condição; fim = dias seguidos sem ela",
              natureza_fonte="OBSERVADO", natureza_transformacao="CALCULADO", dimensoes=["dia", "regra"],
              regras_comparabilidade=list(comparabilidade), regra_cobertura=cobertura,
              politica_ausencia="Dia sem dado ou sem base completa não é avaliado: não confirma nem normaliza o alerta e interrompe a contagem de dias seguidos.",
              validacoes=[_HIST, "estado do dia reavaliado e comparado com a classificação publicada pela gold de origem", *validacoes],
              limitacoes=[_NAO_CAUSA, *limitacoes])


METRICAS = [
    # ---- P005: séries de operação copiadas sem recálculo
    _m(id="visao_pld_media_diaria", titulo="PLD médio diário por submercado (série da Visão geral)",
       pergunta="Em que nível está o preço de liquidação nos últimos 90 dias?",
       definicao="Média aritmética simples das 24 horas do PLD de cada dia e submercado, copiada de pld.json#diario sem recálculo.",
       unidade="R$/MWh (nominal)", grao_geografico="submercado", grao_temporal="dia (horário de Brasília)", fontes=[F_PLD],
       formula="PLD_dia(s) = (1/24) × Σ PLD_h(s), h = 0..23", regra_agregacao="média temporal simples das horas (não ponderada pela carga)",
       natureza_fonte="OBSERVADO", natureza_transformacao="CALCULADO", dimensoes=["dia", "submercado"],
       regras_comparabilidade=["Valores nominais; anos diferentes têm limites regulatórios diferentes.",
                               "Não é o PLD ponderado pela carga (pld_media_mensal_ponderada_carga)."],
       regra_cobertura="Dias com as 24 horas publicadas; últimos 90 dias até a data de referência do PLD.",
       politica_ausencia="Dia sem as 24 horas não tem média e fica vazio.",
       validacoes=["cada célula igual à de pld.json#diario (conferência a cada publicação)"],
       limitacoes=["A CCEE publica o PLD do dia seguinte na véspera; a série termina depois das demais da Visão geral."]),
    _m(id="visao_participacao_termica_7d", titulo="Participação térmica em janela de 7 dias (SIN)",
       pergunta="Quanto da geração verificada veio de térmicas na última semana?",
       definicao="Geração térmica verificada dividida pela soma da geração hidráulica, térmica, eólica e solar do balanço de energia do ONS, em janela móvel de 7 dias, copiada de geracao.json#serie_termica_7d.",
       unidade="% da geração verificada", grao_geografico="SIN", grao_temporal="janela móvel de 7 dias", fontes=[F_BAL],
       numerador="Σ geração térmica verificada nos 7 dias (MWmed·dia)", denominador="Σ geração verificada das quatro fontes nos 7 dias (MWmed·dia)",
       formula="100 × Σ térmica ÷ Σ (hidráulica + térmica + eólica + solar)", regra_agregacao="razão de somas",
       natureza_fonte="OBSERVADO", natureza_transformacao="CALCULADO", dimensoes=["dia final da janela"],
       regras_comparabilidade=["Desde 29/04/2023 a solar do balanço inclui a MMGD estimada; janelas antes e depois não se comparam."],
       regra_cobertura="Janelas com os 7 dias completos.", politica_ausencia="Janela com dia ausente fica vazia.",
       validacoes=["cada célula igual à de geracao.json#serie_termica_7d"],
       limitacoes=["O balanço não separa a térmica por combustível (painel Geração)."]),
    _m(id="visao_carga_diaria_sin", titulo="Carga diária do SIN (série da Visão geral)",
       pergunta="Quanto o sistema está consumindo, dia a dia?",
       definicao="Soma das cargas diárias dos quatro subsistemas publicadas pelo ONS, copiada de carga.json#serie; a referência é a mesma data do ano anterior quando os dois dias estão no mesmo regime metodológico.",
       unidade="MWmed", grao_geografico="SIN", grao_temporal="dia", fontes=[F_CARGA],
       formula="carga_SIN(d) = Σ_s carga(s, d), s ∈ {SE, S, NE, N}", regra_agregacao="soma dos subsistemas no mesmo dia",
       natureza_fonte="OBSERVADO", natureza_transformacao="CALCULADO", dimensoes=["dia"],
       regras_comparabilidade=["Regimes do ONS: até 28/02/2021, de 01/03/2021 a 28/04/2023 e desde 29/04/2023 (MMGD estimada incluída); o ano anterior só aparece no mesmo regime."],
       regra_cobertura="Dias aceitos pela validação física do módulo Carga.", politica_ausencia="Dia em quarentena ou ausente fica vazio.",
       validacoes=["cada célula igual à de carga.json#serie"],
       limitacoes=["Temperatura e calendário não são ajustados."]),
    _m(id="visao_fluxo_diario_fronteira", titulo="Fluxo médio diário entre subsistemas (série da Visão geral)",
       pergunta="Para onde a energia está fluindo entre as regiões?",
       definicao="Média das 24 horas do intercâmbio verificado em cada fronteira, com sinal (positivo da primeira para a segunda ponta), copiada de rede.json#serie_fluxos.",
       unidade="MWmed", grao_geografico="fronteira entre subsistemas", grao_temporal="dia", fontes=[F_INT],
       formula="fluxo(par, d) = (1/24) × Σ_h sinal × intercâmbio_verificado(h)", regra_agregacao="média temporal das horas",
       natureza_fonte="OBSERVADO", natureza_transformacao="CALCULADO", dimensoes=["dia", "fronteira"],
       regras_comparabilidade=["Sentido convencionado por fronteira (N→NE, N→SE/CO, NE→SE/CO, S→SE/CO)."],
       regra_cobertura="Dias com as 24 horas.", politica_ausencia="Dia incompleto fica vazio.",
       validacoes=["cada célula igual à de rede.json#serie_fluxos"],
       limitacoes=["Sem limites de intercâmbio neste painel: fluxo alto não indica congestionamento."]),
    # ---- P004: qualidade por frase
    _m(id="visao_defasagem_frase", titulo="Defasagem da frase em relação ao processamento",
       pergunta="Quantos dias separam o dado da data em que a página foi processada?",
       definicao="Data de processamento (civil de Brasília) menos a data de referência do dado usado na frase. Negativa quando a fonte publica o dado do dia seguinte na véspera (PLD).",
       unidade="dias", grao_geografico="frase", grao_temporal="processamento", fontes=[F_EAR, F_ENA, F_CARGA, F_BAL, F_INT, F_PLD],
       formula="defasagem = data_processamento_brasilia − data_referencia", regra_agregacao="não se aplica",
       natureza_fonte="OBSERVADO", natureza_transformacao="CALCULADO", dimensoes=["frase"],
       regras_comparabilidade=["A data de processamento é a civil de Brasília (comum.hoje_brasilia), não a UTC do servidor."],
       regra_cobertura="Toda frase emitida.", politica_ausencia="Sem data de referência, a frase não é emitida.",
       validacoes=["texto sem '0 dias antes' quando a referência é posterior ao processamento"],
       limitacoes=["Não substitui a situação de atualidade pela frequência declarada da fonte (publicacao.json), também publicada."]),
    _m(id="visao_revisoes_janela_frase", titulo="Referências revisadas na janela da frase",
       pergunta="Algum dado usado nesta frase foi revisado pela fonte entre capturas?",
       definicao="Número de referências (dias ou horas) dentro da janela da frase cujo valor mudou entre capturas consecutivas no silver principal; a maior variação relativa acompanha.",
       unidade="referências", grao_geografico="frase", grao_temporal="janela da frase", fontes=[F_EAR, F_ENA, F_CARGA, F_BAL, F_INT, F_PLD],
       formula="contagem de (série, referência) com mais de um valor entre vintages e referência na janela", regra_agregacao="contagem",
       natureza_fonte="OBSERVADO", natureza_transformacao="CALCULADO", dimensoes=["frase"],
       regras_comparabilidade=["Séries horárias contam horas; séries diárias contam dias."],
       regra_cobertura="Capturas versionadas do silver principal (desde 27/09/2026).",
       politica_ausencia="Referência ausente numa captura não é revisão.",
       validacoes=["mesma lista de revisões publicada em sintese_revisoes.csv"],
       limitacoes=["Antes das capturas versionadas não há como medir revisão."]),
    # ---- P007: regras
    _regra("visao_regra_ear_faixa", "Regra: EAR do SIN fora da faixa usual", "O armazenamento do SIN está fora do usual para a data?",
           "EAR do SIN abaixo do 10º ou acima do 90º percentil do mesmo dia do calendário nos anos completos de 2001 ao anterior; alerta com 7 dias seguidos, retorno com 7 dias seguidos dentro.",
           [F_EAR], "condição(d) = EAR_SIN(d) < P10(md) ou EAR_SIN(d) > P90(md); EAR_SIN = 100 × Σ EAR ÷ Σ EARmax", "% da EAR máxima", "SIN",
           ["A variante 'algum dos quatro subsistemas' é publicada como alternativa avaliada e rejeitada."],
           "Dias com os quatro subsistemas e faixa da data disponível (2021 em diante).",
           ["A capacidade de armazenamento mudou ao longo do tempo; a faixa compara percentuais de capacidades diferentes."]),
    _regra("visao_regra_ena_faixa", "Regra: ENA de 30 dias do SIN fora da faixa usual", "A afluência do último mês está fora do usual para o mesmo período do ano?",
           "ENA bruta do SIN em 30 dias, em % da MLT, abaixo do 10º ou acima do 90º percentil da mesma janela nos anos de 2001 ao anterior; alerta com 7 dias seguidos, retorno com 7 dias seguidos dentro.",
           [F_ENA], "condição(d) = ENA30(d) < P10 ou > P90 das janelas terminadas na mesma data dos anos anteriores; ENA30 = 100 × Σ ENA ÷ Σ MLT", "% da MLT", "SIN",
           ["A MLT do conjunto aberto muda com usinas novas e recálculos (agua_mlt_versao)."],
           "Janelas com os 30 dias.", ["Janela de 30 dias suaviza eventos curtos."]),
    _regra("visao_regra_termica", "Regra: participação térmica incomum", "As térmicas estão gerando muito mais ou muito menos que no último ano?",
           "Participação térmica de 7 dias abaixo do 10º ou acima do 90º percentil das 365 janelas terminadas de 7 a 371 dias antes, todas no regime do balanço iniciado em 29/04/2023; alerta com 7 dias seguidos, retorno com 7.",
           [F_BAL], "condição(d) = part7(d) < P10 ou > P90 de {part7(d − i), i = 7..371}", "% da geração verificada", "SIN",
           ["Só avaliada com 365 janelas inteiras no mesmo regime (a partir de maio de 2024)."],
           "Dias com as 365 janelas anteriores completas no regime atual.", ["O balanço não separa a térmica por combustível nem por motivo de despacho."]),
    _regra("visao_regra_carga_extrema", "Regra: carga diária entre as mais altas do ano", "A carga está entre os dias mais altos dos últimos 12 meses?",
           "Carga do SIN acima do 95º percentil dos 364 dias anteriores, no mesmo regime metodológico e com pelo menos 330 dias publicados; alerta com 2 dias seguidos, retorno com 3 dias abaixo.",
           [F_CARGA], "condição(d) = carga(d) > quantil_0,95{carga(d − i), i = 1..364}", "MWmed", "SIN",
           ["Base de 364 dias no mesmo regime do ONS; a série publicada pela gold de Carga começa três anos antes da referência."],
           "Dias com base completa no mesmo regime.", ["Temperatura e calendário não são ajustados."]),
    _regra("visao_regra_descolamento", "Regra: preços separados entre submercados", "Os submercados estão com preços diferentes de forma persistente?",
           "Diferença entre o maior e o menor PLD médio diário dos quatro submercados de pelo menos max(R$ 5,00/MWh; 10% da média dos quatro); alerta com 3 dias seguidos, retorno com 3 dias abaixo.",
           [F_PLD], "condição(d) = max_s PLD_d(s) − min_s PLD_d(s) ≥ max(5; 0,10 × média_s PLD_d(s))", "R$/MWh", "quatro submercados",
           ["Médias diárias arredondadas ao centavo (pld.json#diario); a amplitude do dia confere com pld.json#amplitude_dia em R$ 0,02/MWh."],
           "Dias com os quatro submercados (desde 01/01/2021).", ["Não identifica qual restrição de transmissão atuou."]),
    _regra("visao_regra_pld_piso", "Regra: PLD no piso o dia inteiro", "O piso regulatório determinou o preço em todas as horas?",
           "Algum submercado com as 24 horas do dia no PLD mínimo vigente (igual ao centavo, contagem de pld_limites_diario.csv do módulo PLD); alerta com 3 dias seguidos, retorno com 3 dias sem dia inteiro no piso.",
           [F_PLD], "condição(d) = ∃ s: horas_no_piso(s, d) = horas(s, d) = 24", "dias", "quatro submercados",
           ["Limites por ano conforme os atos da ANEEL (conferidos com regulacao.json)."],
           "Dias do PLD horário com limites vigentes (desde 01/01/2021).", ["Preço no piso não quer dizer energia sem custo."],
           validacoes=["limites do CSV do PLD iguais aos vigentes publicados pela Regulação (R$ 0,005/MWh)"]),
    _regra("visao_regra_pld_teto", "Regra: PLD no teto horário ou estrutural", "Algum limite máximo do PLD foi atingido?",
           "Alguma hora no PLD máximo horário ou média diária no máximo estrutural em algum submercado; alerta no mesmo dia, retorno com 7 dias seguidos sem teto.",
           [F_PLD], "condição(d) = ∃ s: horas_no_teto_horario(s, d) > 0 ou media_no_teto_estrutural(s, d) = 1", "dias", "quatro submercados",
           ["Teto horário vale hora a hora; teto estrutural vale para a média diária."],
           "Dias do PLD horário com limites vigentes.", ["Não identifica a causa nem indica risco de suprimento."],
           validacoes=["limites do CSV do PLD iguais aos vigentes publicados pela Regulação (R$ 0,005/MWh)"]),
    _regra("visao_regra_restricao", "Regra: restrição de eólicas ou fotovoltaicas acima do usual", "O corte de geração renovável está acima do usual do último ano?",
           "Taxa de restrição do SIN em 7 dias (energia não gerada ÷ geração verificada mais não gerada, linhas TOTAL de geracao_restricao_diaria.csv somadas nas regiões) acima do 90º percentil das 365 janelas terminadas de 7 a 371 dias antes; alerta com 7 dias seguidos, retorno com 7.",
           [F_COFF_E, F_COFF_S], "condição(d) = taxa7(d) > P90{taxa7(d − i), i = 7..371}; taxa7 = 100 × Σ não gerada ÷ Σ (verificada + não gerada)",
           "% da geração possível", "SIN, por fonte (eólica, fotovoltaica)",
           ["Universo de usinas dos arquivos de restrição do ONS (muda com usinas novas); taxa de razão de somas."],
           "Eólica desde out/2021, fotovoltaica desde abr/2024; avaliada com 365 janelas anteriores completas.",
           ["Energia não gerada é estimativa do ONS; MMGD não entra."]),
    _regra("visao_regra_revisao_material", "Regra: revisão material de dado já publicado", "A fonte mudou números que esta página usa?",
           "Captura nos últimos 7 dias com ao menos uma revisão material de série da Visão geral: |Δ| ≥ 1% do valor anterior e ≥ piso da unidade (0,1 p.p.; 10 MWmed ou MWmês; R$ 0,01/MWh).",
           [F_EAR, F_ENA, F_CARGA, F_BAL, F_INT, F_PLD, F_CMO], "condição(d) = ∃ captura c, d − 6 ≤ dia(c) ≤ d, com revisão material", "revisões",
           "conjuntos da Visão geral", ["Revisão é comparação entre capturas consecutivas do mesmo arquivo; antes da primeira captura comparável o dia não é avaliado."],
           "Capturas versionadas do silver principal (desde 27/09/2026).", ["Histórico curto: frequência anual não estimável antes de um ano de capturas."],
           grao_temporal="dia de captura (Brasília)"),
    _m(id="visao_regra_pld_defasagem", titulo="Regra: PLD sem atualização recente",
       pergunta="A série de PLD está sendo integrada?",
       definicao="Último dia de PLD integrado mais de 2 dias antes da data de processamento (civil de Brasília).",
       unidade="dias", grao_geografico="quatro submercados", grao_temporal="processamento", fontes=[F_PLD],
       formula="ativo = data_processamento − dia_referencia_pld > 2", regra_agregacao="não se aplica",
       natureza_fonte="OBSERVADO", natureza_transformacao="CALCULADO", dimensoes=["processamento"],
       regras_comparabilidade=["A CCEE publica o PLD do dia seguinte na véspera: defasagem de −1 é o normal à noite."],
       regra_cobertura="Cada processamento.", politica_ausencia="Sem pld.json íntegro, a regra não é listada.",
       validacoes=["data de Brasília, não UTC (defeito corrigido: '0 dias antes do processamento' às 23h20 de Brasília)"],
       limitacoes=["Diz respeito à integração, não ao preço."]),
    _m(id="visao_regra_atualidade_fontes", titulo="Regra: fonte da Visão geral com atualização atrasada",
       pergunta="Algum conjunto usado nesta página está atrasado em relação à frequência declarada?",
       definicao="Algum conjunto usado nas frases, nos determinantes ou em energia e sociedade com situação ATRASADO no painel de saúde dos dados (publicacao.json).",
       unidade="conjuntos", grao_geografico="conjuntos da Visão geral", grao_temporal="processamento",
       fontes=[F_EAR, F_ENA, F_CARGA, F_BAL, F_INT, F_PLD, F_CMO, "aneel_tarifas_aplicacao", "aneel_continuidade", "aneel_samp_balanco", "aneel_scs"],
       formula="ativo = ∃ conjunto com atualidade.situacao = ATRASADO", regra_agregacao="contagem",
       natureza_fonte="OBSERVADO", natureza_transformacao="CALCULADO", dimensoes=["conjunto"],
       regras_comparabilidade=["Tolerância pela cadência declarada (módulo Dados)."],
       regra_cobertura="Conjuntos com situação publicada.", politica_ausencia="Conjunto sem situação publicada é listado à parte.",
       validacoes=["situação lida de publicacao.json#conjuntos[].atualidade"],
       limitacoes=["Atraso pode ser da fonte ou da integração; o painel Dados separa as causas."]),
    _m(id="visao_frequencia_disparo", titulo="Frequência de disparo das regras no histórico",
       pergunta="Quantas vezes cada regra teria disparado desde 2021, e por quanto tempo?",
       definicao="Para cada regra: dias avaliados, dias com a condição, acionamentos brutos (sequências de dias com a condição), acionamentos curtos descartados pela duração mínima, episódios, duração mediana e máxima, dias com alerta exibido (da confirmação ao retorno) e sensibilidade a durações mínimas de 1, 3, 7 e 14 dias.",
       unidade="dias, episódios e % dos dias avaliados", grao_geografico="regra", grao_temporal="histórico desde 01/01/2021",
       fontes=[F_EAR, F_ENA, F_CARGA, F_BAL, F_PLD, F_COFF_E, F_COFF_S],
       numerador="dias com alerta exibido", denominador="dias avaliados",
       formula="pct_dias_exibidos = 100 × Σ dias exibidos ÷ dias avaliados; episódios por ano = episódios ÷ (dias avaliados ÷ 365,25), só com ao menos 365 dias",
       regra_agregacao="contagem sobre a série diária de condições", natureza_fonte="OBSERVADO", natureza_transformacao="CALCULADO",
       dimensoes=["regra", "duração mínima"],
       regras_comparabilidade=["Regras com histórico avaliável diferente (termica e restrição solar começam depois) não têm a mesma base."],
       regra_cobertura="Dias avaliados de cada regra.", politica_ausencia="Dia não avaliado fica fora do denominador.",
       validacoes=["mesma máquina de estados que avalia o dia", "episódios publicados em sintese_episodios.csv"],
       limitacoes=["Reavaliação com dados de hoje: não reproduz o que se via na época; os alertas emitidos são registrados a partir desta versão.",
                   "Sem verdade de referência, nenhum alerta é rotulado como falso; o registro das emissões mede os que deixaram de se confirmar após revisão."]),
]
