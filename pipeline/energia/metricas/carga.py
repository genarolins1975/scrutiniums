"""Métricas do módulo Carga (P025, P026 e P027). As fórmulas rodam em
pipeline/energia/modulos/carga_detalhe.py e pipeline/energia/gold/carga.py; a interface
lê o valor calculado e esta definição.

Duas famílias de carga do ONS que não se misturam: a carga de energia (Carga de Energia
Diária e Curva de Carga Horária, o mesmo produto em dois grãos) e a carga verificada da
API (carga global, MMGD e carga líquida de MMGD, com definições compatíveis entre si)."""

_GOLD = "carga_detalhe.json"
_PAG = ["/setor-eletrico/carga"]
_DIARIA = ["carga_energia_di"]
_CURVA = ["ons_curva_carga_ho"]
_API = ["ons_carga_verificada_ho"]
_TEMP = ["nasa_power_temperatura", "ibge_populacao_uf_6579", "ibge_centroides_capitais"]
_LEIS = ["senado_leis_feriados"]
_REGIME = ("Só compara períodos dentro do mesmo regime do ONS: até 28/02/2021; de 01/03/2021 a 28/04/2023; desde 29/04/2023 "
           "(com a estimativa de MMGD). Variação que atravessa uma dessas datas não é publicada.")
_AUSENCIA = ("Dia em quarentena (validação física) ou ausente fica sem valor: nunca zero, nunca repetido. Janela com dia ausente não "
             "tem média nem variação.")
_VALIDACAO = ["Validação física antes da publicação: F1 (valor positivo, domínio do dicionário do ONS), F2 (faixa plausível do "
              "subsistema), F3 (salto sobre a mediana da semana anterior), com conferência na curva horária e quarentena.",
              "Média das 24 horas da curva horária conferida contra a carga diária (tolerância de 0,01 MWmed; os dias que diferem "
              "são publicados em p025.revisoes.curva_contra_diaria)."]
_CAUSA = "Variação de carga é observação; não é atribuída à atividade econômica sem evidência adicional."

METRICAS = [
    {
        "id": "carga_variacao_equivalente",
        "titulo": "Variação da carga contra os mesmos dias da semana do ano anterior",
        "pergunta": "Quanto a carga mudou em relação ao mesmo período do ano passado, com a mesma composição de dias?",
        "definicao": ("Média da carga diária numa janela (7 dias, 28 dias, mês corrente, último mês completo ou 52 semanas) dividida pela "
                      "média da mesma janela deslocada 364 dias (52 semanas: mesmos dias da semana), menos 1. Publicada ao lado da "
                      "comparação com as mesmas datas do calendário e da composição de dias úteis, sábados e domingos ou feriados das duas."),
        "unidade": "%", "grao_geografico": "subsistema (SE/CO, S, NE, N) e SIN", "grao_temporal": "janela diária móvel",
        "fontes": _DIARIA, "formula": "100 × (média(janela) ÷ média(janela − 364 dias) − 1)",
        "numerador": "média da carga diária na janela (MWmed)", "denominador": "média da carga diária na janela deslocada 364 dias (MWmed)",
        "regra_agregacao": "Média aritmética de valores diários em MWmed (todos os dias têm 24 horas; SIN = soma dos quatro subsistemas no dia).",
        "versao_formula": "1", "natureza_fonte": "OBSERVADO", "natureza_transformacao": "CALCULADO",
        "dimensoes": ["subsistema", "janela", "tipo de comparação (mesmas datas ou equivalente)"],
        "regras_comparabilidade": [_REGIME, "Feriado nacional que cai em dia útil num ano e no fim de semana no outro torna o calendário não equivalente; o indicador marca calendario_equivalente = falso.", _CAUSA],
        "regra_cobertura": "Todos os dias das duas janelas presentes e aceitos pela validação física.",
        "politica_ausencia": _AUSENCIA, "validacoes": _VALIDACAO,
        "limitacoes": ["Mesmos dias da semana não igualam temperatura nem eventos locais: a decomposição estatística trata a temperatura.",
                       "Os dias mais recentes são revisados pelo ONS depois da publicação."],
        "gold": _GOLD, "paginas": _PAG,
    },
    {
        "id": "carga_media_anual",
        "titulo": "Carga média anual e variação entre anos completos",
        "pergunta": "Quanto o sistema consumiu em média em cada ano e quanto isso mudou?",
        "definicao": ("Média da carga diária do ano. A variação só é publicada entre dois anos completos inteiramente no mesmo regime do "
                      "ONS; o ano corrente entra como acumulado até o último dia contra o mesmo período do ano anterior deslocado 364 dias."),
        "unidade": "MWmed e %", "grao_geografico": "subsistema e SIN", "grao_temporal": "anual",
        "fontes": _DIARIA, "formula": "média anual = Σ carga diária ÷ dias com dado; variação = 100 × (média do ano ÷ média do ano anterior − 1)",
        "regra_agregacao": "Média dos dias (cada dia tem o mesmo peso de 24 horas).", "versao_formula": "1",
        "natureza_fonte": "OBSERVADO", "natureza_transformacao": "CALCULADO",
        "dimensoes": ["ano", "subsistema"],
        "regras_comparabilidade": [_REGIME, "Ano parcial não é comparado com ano completo; o acumulado do ano usa o mesmo período do ano anterior.", _CAUSA],
        "regra_cobertura": "Ano completo = todos os dias com o SIN (quatro subsistemas aceitos).", "politica_ausencia": _AUSENCIA,
        "validacoes": _VALIDACAO, "limitacoes": ["2021 e 2023 misturam dois regimes: não têm variação contra o ano anterior nem o seguinte."],
        "gold": _GOLD, "paginas": _PAG,
    },
    {
        "id": "carga_revisao",
        "titulo": "Revisão da carga diária entre capturas",
        "pergunta": "Quanto a fonte mudou um valor já publicado?",
        "definicao": ("Diferença entre o valor de uma carga diária numa captura e o valor da captura anterior do mesmo arquivo, em MWmed e em "
                      "% do valor anterior; correção de valor fora do domínio é marcada à parte."),
        "unidade": "MWmed e %", "grao_geografico": "subsistema", "grao_temporal": "diário, por captura",
        "fontes": _DIARIA, "formula": "diferença = valor(captura k) − valor(captura k − 1); % = 100 × diferença ÷ valor(captura k − 1)",
        "regra_agregacao": "Sem agregação; resumo por mediana e máximo do valor absoluto das diferenças percentuais.", "versao_formula": "1",
        "natureza_fonte": "OBSERVADO", "natureza_transformacao": "CALCULADO", "dimensoes": ["subsistema", "dia", "captura"],
        "regras_comparabilidade": ["Só compara capturas do mesmo arquivo anual; a percentagem não é calculada quando o valor anterior é zero ou negativo."],
        "regra_cobertura": "Capturas integradas no silver (a primeira captura de cada arquivo não tem revisão).",
        "politica_ausencia": "Valor que some numa captura posterior não é revisão para zero: não gera linha.",
        "validacoes": ["Revisões lidas das vintages do silver, que só gravam valor novo ou alterado."],
        "limitacoes": ["O silver só conhece as capturas feitas pelo observatório; revisões entre duas capturas ficam agregadas."],
        "gold": _GOLD, "paginas": _PAG,
    },
    {
        "id": "carga_pico_horario",
        "titulo": "Pico horário diário da carga e hora do pico",
        "pergunta": "Quando ocorre o pico de carga e de que tamanho ele é?",
        "definicao": ("Maior valor horário da Curva de Carga Horária do ONS no dia e a hora local (início da hora) em que ocorreu. Para o "
                      "SIN, o máximo da soma dos quatro subsistemas hora a hora, não a soma dos picos."),
        "unidade": "MWmed (na hora) e hora 0 a 23", "grao_geografico": "subsistema e SIN", "grao_temporal": "diário (a partir de valores horários)",
        "fontes": _CURVA, "formula": "pico = max_h carga(h); hora = argmax_h (empate: primeira hora)",
        "regra_agregacao": "Máximo diário; distribuição anual = contagem de dias por hora do pico.", "versao_formula": "1",
        "natureza_fonte": "OBSERVADO", "natureza_transformacao": "CALCULADO", "dimensoes": ["dia", "subsistema", "ano"],
        "regras_comparabilidade": [_REGIME, "Antes de 2019 havia horário de verão: a hora local do pico se desloca uma hora nesses meses."],
        "regra_cobertura": "Dia com as 24 horas (dias de mudança do horário de verão, com 23 horas, ficam sem pico).",
        "politica_ausencia": "Dia incompleto não tem pico.", "validacoes": _VALIDACAO[1:],
        "limitacoes": ["Desde 29/04/2023 a curva inclui a MMGD estimada, que desloca a forma da curva ao meio-dia; o pico da carga líquida está no painel de MMGD."],
        "gold": _GOLD, "paginas": _PAG,
    },
    {
        "id": "carga_perfil_tipico",
        "titulo": "Perfil horário típico por mês e tipo de dia",
        "pergunta": "Como a carga se distribui ao longo do dia num mês típico?",
        "definicao": ("Média, hora a hora, dos dias completos de uma classe (dia útil; sábado; domingo ou feriado nacional, Paixão e Carnaval) "
                      "no mês, para a carga da curva e, separadamente, para a carga global, a MMGD e a carga líquida da API."),
        "unidade": "MWmed", "grao_geografico": "subsistema e SIN", "grao_temporal": "hora do dia, por mês",
        "fontes": _CURVA + _API + _LEIS, "formula": "perfil(h) = Σ_dias carga(d, h) ÷ número de dias completos da classe",
        "regra_agregacao": "Média simples entre dias (todos com 24 horas).", "versao_formula": "1",
        "natureza_fonte": "OBSERVADO", "natureza_transformacao": "CALCULADO", "dimensoes": ["mês", "classe do dia", "hora", "subsistema", "série"],
        "regras_comparabilidade": ["Curva (carga) e API (carga global) são produtos diferentes: aparecem lado a lado, nunca subtraídos um do outro.", _REGIME],
        "regra_cobertura": "Dias com as 24 horas; a quantidade de dias de cada média é publicada.",
        "politica_ausencia": "Classe sem dia completo no mês não tem perfil.", "validacoes": _VALIDACAO[1:],
        "limitacoes": ["Classe de dia pelo calendário nacional: feriados estaduais e municipais não entram."],
        "gold": _GOLD, "paginas": _PAG,
    },
    {
        "id": "carga_mmgd_participacao",
        "titulo": "Parcela da carga global atendida por MMGD (estimativa do ONS)",
        "pergunta": "Qual parcela da carga é suprida pela micro e minigeração distribuída, segundo a estimativa do ONS?",
        "definicao": ("Energia de MMGD estimada pelo ONS dividida pela carga global verificada, nas mesmas horas, na API de carga verificada. "
                      "Carga líquida de MMGD = carga global − MMGD, identidade publicada pelo ONS e conferida em cada meia hora."),
        "unidade": "% da carga global", "grao_geografico": "submercado e SIN", "grao_temporal": "hora, dia e mês",
        "fontes": _API, "formula": "100 × Σ MMGD (MWh) ÷ Σ carga global (MWh)",
        "numerador": "energia de MMGD estimada (MWh)", "denominador": "carga global verificada (MWh)",
        "regra_agregacao": "Razão de somas de energia nas mesmas horas (nunca média de percentuais).", "versao_formula": "1",
        "natureza_fonte": "ESTIMADO", "natureza_transformacao": "CALCULADO", "dimensoes": ["submercado", "mês", "hora"],
        "regras_comparabilidade": ["Não se aplica à carga diária nem à curva de carga: a carga global da API é outra grandeza (maior, sobretudo à noite).",
                                   "Nenhuma dupla contagem: a MMGD da API nunca é somada à curva (que já inclui uma estimativa de MMGD desde 29/04/2023) nem subtraída dela."],
        "regra_cobertura": "Horas com as duas meias horas de carga global e de MMGD; mês completo quando todos os dias têm 24 horas.",
        "politica_ausencia": "Antes de 15/02/2019 a MMGD vem vazia na API: ausência, não zero. Dia em curso na captura é descartado.",
        "validacoes": ["Identidade carga global = líquida + MMGD em cada meia hora (0,01 MWmed).",
                       "MMGD não negativa (dicionário do ONS).",
                       "Energia diária por submercado conferida contra o arquivo do módulo Transição (mesma API, outro código; 0,1 MWh)."],
        "limitacoes": ["A MMGD é estimativa do ONS, não medição.", "A API não informa o método de estimativa; as notas da carga diária falam em dados meteorológicos previstos."],
        "gold": _GOLD, "paginas": _PAG,
    },
    {
        "id": "carga_decomposicao_contribuicao",
        "titulo": "Contribuição de calendário, temperatura, sazonalidade e tendência (decomposição estatística)",
        "pergunta": "Quanto da variação da carga é compatível com clima e calendário, segundo um modelo estatístico?",
        "definicao": ("Mudança na previsão de ln(carga) de um modelo de regressão estimado só com dias anteriores, atribuída a cada grupo de "
                      "variáveis (β × diferença das médias das variáveis do grupo). Resíduo = diferença real − diferença prevista. Não é "
                      "efeito causal nem percentual explicado."),
        "unidade": "log × 100 (aproximadamente pontos percentuais)", "grao_geografico": "subsistema e SIN", "grao_temporal": "diário e janelas",
        "fontes": _DIARIA + _TEMP + _LEIS,
        "formula": "contribuição_g = 100 × Σ_{j∈g} β_j (x̄_j,A − x̄_j,B); resíduo = 100 × (ȳ_A − ȳ_B) − Σ_g contribuição_g",
        "regra_agregacao": "Soma dentro de cada grupo; médias de ln(carga) nos dias das janelas.", "versao_formula": "1",
        "natureza_fonte": "OBSERVADO", "natureza_transformacao": "ESTIMADO", "dimensoes": ["subsistema", "variante do modelo", "janela"],
        "regras_comparabilidade": ["Contribuições de variantes diferentes não se somam.", "Com temperatura ausente em parte da janela, a decomposição usa o maior trecho inicial com todas as variáveis e o informa."],
        "regra_cobertura": "Dias com carga aceita, temperatura do dia e do dia anterior.",
        "politica_ausencia": "Dia sem temperatura fica fora do modelo; nada é interpolado.",
        "validacoes": ["Backtest com origens mensais fora da amostra e comparação com a referência de 364 dias.", "Sensibilidade a seis especificações."],
        "limitacoes": ["Associação estatística, não causa.", "Temperatura de reanálise, não observação de estação."],
        "gold": _GOLD, "paginas": _PAG,
    },
    {
        "id": "carga_decomposicao_erro",
        "titulo": "Erro fora da amostra da decomposição estatística",
        "pergunta": "Quão bem o modelo de clima e calendário reproduz a carga em dias que não viu?",
        "definicao": ("Erro percentual absoluto médio, viés, erro absoluto em MWmed e cobertura dos intervalos de 80% e 95%, nos dias de cada "
                      "mês previstos pelo modelo estimado só com os dias anteriores ao mês."),
        "unidade": "% e MWmed", "grao_geografico": "subsistema e SIN", "grao_temporal": "diário, agregado no período de avaliação",
        "fontes": _DIARIA + _TEMP, "formula": "MAPE = 100 × média |real ÷ previsto − 1|; viés = 100 × média (real ÷ previsto − 1)",
        "regra_agregacao": "Média simples entre dias previstos.", "versao_formula": "1",
        "natureza_fonte": "OBSERVADO", "natureza_transformacao": "ESTIMADO", "dimensoes": ["subsistema", "variante", "origem"],
        "regras_comparabilidade": ["Comparável entre variantes só no mesmo período de avaliação (mesmas origens).",
                                   "A referência ingênua (mesmo dia da semana 364 dias antes) é publicada junto."],
        "regra_cobertura": "Origens mensais desde 01/05/2024 com pelo menos 300 dias de treino.",
        "politica_ausencia": "Dia sem previsão (temperatura ausente) fica fora da métrica e da contagem.",
        "validacoes": ["Treino estritamente anterior a cada origem (sem olhar o futuro)."],
        "limitacoes": ["Usa a temperatura realizada: mede decomposição, não previsão de carga.", "Cobertura empírica abaixo da nominal é publicada, não corrigida."],
        "gold": _GOLD, "paginas": _PAG,
    },
    {
        "id": "temperatura_ponderada_subsistema",
        "titulo": "Temperatura diária ponderada pela população, por subsistema",
        "pergunta": "Qual foi a temperatura média do dia nas regiões de cada subsistema?",
        "definicao": ("Média da temperatura do ar a 2 m (NASA POWER) nos centroides das capitais das UFs do subsistema, ponderada pela "
                      "população residente estimada de cada UF (IBGE, SIDRA 6579)."),
        "unidade": "°C", "grao_geografico": "subsistema e SIN", "grao_temporal": "diário",
        "fontes": _TEMP, "formula": "T = Σ peso_UF × T_capital ÷ Σ pesos com valor (dia publicado com pelo menos 95% do peso)",
        "regra_agregacao": "Média ponderada por população.", "versao_formula": "1",
        "natureza_fonte": "ESTIMADO", "natureza_transformacao": "CALCULADO", "dimensoes": ["subsistema", "dia"],
        "regras_comparabilidade": ["MERRA-2 (histórico) e GEOS-IT (trecho recente) são produtos diferentes da NASA; a fonte de cada mês é publicada."],
        "regra_cobertura": "Dia com pelo menos 95% do peso populacional com valor.",
        "politica_ausencia": "Valor -999 da fonte é ausência; dia sem cobertura mínima fica sem valor.",
        "validacoes": ["UFs por subsistema conferidas pela soma das áreas de carga da API do ONS em 20/09/2026."],
        "limitacoes": ["Reanálise e análise de modelo, não observação de estação.", "A capital representa a UF; população não é distribuição da carga."],
        "gold": _GOLD, "paginas": _PAG,
    },
]
