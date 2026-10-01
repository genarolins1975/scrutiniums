"""Métricas do módulo Regulação: definição única das medidas publicadas em
public/energia/gold/regulacao.json. As regras rodam em pipeline/energia/modulos/regulacao.py
e pipeline/energia/fontes/aneel_regulacao.py; a interface só lê o resultado.

Convenções: valores monetários em R$/MWh nominais, como escritos nos atos (dois decimais);
datas no calendário civil de Brasília; publicação (Diário Oficial) e vigência são campos
distintos; nenhuma medida deste módulo estima efeito de norma.
"""

GOLD = "regulacao.json"
PAGINA = ["/setor-eletrico/regulacao"]
F_DOCS = "regulacao_documentos"
F_CUR = "regulacao_curadoria"
F_ATAS = "aneel_pautas_atas_diretoria"
F_PART = "aneel_audiencias_consultas"
F_BAND = "aneel_bandeiras_adicional"
F_PAG = "aneel_paginas_regulatorias"
F_IPCA = "ibge_ipca_1737"

_ATO = "Valor transcrito do ato com trecho literal, conferido automaticamente no texto extraído do PDF guardado no bronze."


def _m(**kw):
    base = {"gold": GOLD, "paginas": PAGINA, "versao_formula": "1.0"}
    base.update(kw)
    return base


METRICAS = [
    _m(id="regulacao_pld_min", titulo="Piso do PLD (PLD mínimo) vigente",
       pergunta="Qual é o menor valor que o PLD pode assumir em cada período?",
       definicao="Limite mínimo do Preço de Liquidação de Diferenças fixado pela ANEEL para o ano, igual ao maior valor entre a TEO e a TEO de Itaipu (REN nº 1.032/2022, art. 24). Vigente campo a campo: vale o ato em vigor que informa o piso, com a publicação mais recente.",
       unidade="R$/MWh", grao_geografico="Sistema Interligado Nacional (todos os submercados)", grao_temporal="ano civil (vigência do ato)",
       fontes=[F_DOCS, F_CUR, F_ATAS], regra_agregacao="não se aplica (valor do ato)",
       natureza_fonte="OBSERVADO", natureza_transformacao="OBSERVADO",
       dimensoes=["ano", "ato"],
       regras_comparabilidade=["Valores nominais de anos diferentes não são comparáveis em termos reais sem deflator.",
                               "O piso nunca é inferido do menor PLD observado (achado A04)."],
       regra_cobertura="2021 a 2026 (PLD horário); anos sem ato ficam sem valor.",
       politica_ausencia="Sem ato em vigor que informe o piso, o campo fica vazio.",
       validacoes=[_ATO, "piso igual ao maior entre TEO e TEO de Itaipu do mesmo ato",
                   "número e data da deliberação conferidos nas atas da Diretoria quando o ato é resolução homologatória"],
       limitacoes=["2021 e 2023: valores lidos em documento oficial do processo (voto), porque o texto do ato não estava acessível."]),
    _m(id="regulacao_pld_max_horario", titulo="Teto horário do PLD vigente",
       pergunta="Qual é o maior valor que o PLD pode assumir numa hora?",
       definicao="Limite máximo do PLD em cada hora (PLDmax_horário), fixado pela ANEEL para o ano e atualizado pela variação do IPCA (REN nº 1.032/2022, art. 23).",
       unidade="R$/MWh", grao_geografico="Sistema Interligado Nacional (todos os submercados)", grao_temporal="ano civil (vigência do ato)",
       fontes=[F_DOCS, F_CUR, F_IPCA], regra_agregacao="não se aplica (valor do ato)",
       natureza_fonte="OBSERVADO", natureza_transformacao="OBSERVADO", dimensoes=["ano", "ato"],
       regras_comparabilidade=["Vale hora a hora; não se compara com a média diária, que tem o teto estrutural."],
       regra_cobertura="2021 a 2026.", politica_ausencia="Sem ato em vigor, vazio.",
       validacoes=[_ATO, "teto do ano refeito a partir do teto do ano anterior pela razão IPCA nov/(ano−1) ÷ IPCA nov/(ano−2), tolerância R$ 0,011/MWh"],
       limitacoes=["Em 2023 vale o valor retificado no DOU de 06/01/2023 para o ano inteiro (erro material na resolução original)."]),
    _m(id="regulacao_pld_max_estrutural", titulo="Teto estrutural do PLD vigente",
       pergunta="Qual é o maior valor que a média diária do PLD pode assumir?",
       definicao="Limite máximo estrutural (PLDmax_estrutural): se a média diária dos PLDs horários o ultrapassa, a CCEE ajusta a série do dia até a média igualar o teto (REN nº 1.032/2022, art. 23, § 3º).",
       unidade="R$/MWh", grao_geografico="Sistema Interligado Nacional (todos os submercados)", grao_temporal="ano civil (vigência do ato)",
       fontes=[F_DOCS, F_CUR, F_IPCA], regra_agregacao="não se aplica (valor do ato)",
       natureza_fonte="OBSERVADO", natureza_transformacao="OBSERVADO", dimensoes=["ano", "ato"],
       regras_comparabilidade=["Aplica-se à média diária, não à hora."],
       regra_cobertura="2021 a 2026.", politica_ausencia="Sem ato em vigor, vazio.",
       validacoes=[_ATO, "teto refeito pela variação do IPCA de novembro, tolerância R$ 0,011/MWh"],
       limitacoes=["Mesma retificação de 2023 do teto horário."]),
    _m(id="regulacao_conferencia_ipca_teto", titulo="Teto publicado no ano anterior encadeado pela variação do IPCA",
       pergunta="O teto publicado bate com o encadeamento anual pelo IPCA que os atos da ANEEL praticam?",
       definicao="Teto publicado no ano anterior multiplicado pela razão entre o número-índice do IPCA de novembro do ano anterior e o de novembro de dois anos antes; comparado ao teto publicado. É a prática dos atos, não o texto literal do art. 23, § 1º, da REN nº 1.032/2022, que manda atualizar a partir dos valores de setembro de 2019; a aplicação literal é calculada à parte (conferência informativa art23_literal) e difere dos valores publicados.",
       unidade="R$/MWh", grao_geografico="Sistema Interligado Nacional", grao_temporal="ano",
       fontes=[F_CUR, F_IPCA], formula="esperado_ano = teto_{ano−1} × IPCA_nov(ano−1) ÷ IPCA_nov(ano−2); diferença = teto_ano − esperado_ano",
       numerador="IPCA número-índice de novembro do ano anterior", denominador="IPCA número-índice de novembro de dois anos antes",
       regra_agregacao="não se aplica", natureza_fonte="OBSERVADO", natureza_transformacao="CALCULADO",
       dimensoes=["ano", "tipo de teto"],
       regras_comparabilidade=["Conferência de consistência; não substitui o valor do ato."],
       regra_cobertura="Pares de anos consecutivos com os dois tetos e os dois índices.",
       politica_ausencia="Índice ausente: conferência registrada como não executada.",
       validacoes=["tolerância de R$ 0,011/MWh: dois arredondamentos a centavos (valor anterior multiplicado pelo fator anual e valor atual)",
                   "aplicação literal do art. 23, § 1º, calculada e publicada como ressalva informativa, sem ser critério de aprovação"],
       limitacoes=["O encadeamento reproduz os atos de 2022 a 2026; o ponto de partida de 2021 depende do valor de 2020, não integrado.",
                   "O texto do art. 23, § 1º, não enuncia o encadeamento: a conta literal (base de setembro de 2019) difere dos atos em dezenas de centavos por MWh."]),
    _m(id="regulacao_adicional_bandeira", titulo="Adicional da bandeira tarifária por patamar",
       pergunta="Quanto cada bandeira acrescenta à tarifa em cada período?",
       definicao="Valor adicional, em R$/MWh, cobrado quando o patamar está acionado, conforme a resolução e a data de vigência informadas pela ANEEL.",
       unidade="R$/MWh", grao_geografico="consumidores do Sistema Interligado Nacional", grao_temporal="vigência da resolução",
       fontes=[F_BAND], regra_agregacao="não se aplica",
       natureza_fonte="OBSERVADO", natureza_transformacao="OBSERVADO", dimensoes=["patamar", "vigência"],
       regras_comparabilidade=["Valores nominais.", "Adicional por MWh consumido; não é o valor médio da conta."],
       regra_cobertura="Desde março de 2015, como publicado no recurso 'Bandeira Tarifária - Adicional'.",
       politica_ausencia="Valor vazio na fonte fica vazio; a bandeira verde não tem adicional e não consta do recurso.",
       validacoes=["fim de vigência = véspera do valor seguinte do mesmo patamar",
                   "patamar extinto (ausente da resolução seguinte e sem acionamento depois) termina no último mês com acionamento no recurso 'Bandeira Tarifária - Acionamento', conferido com a vigência escrita no dicionário desse recurso",
                   "valor positivo"],
       limitacoes=["A data de publicação das resoluções não é informada pela fonte.",
                   "Fim de patamar extinto com grão mensal (o recurso Acionamento é mensal)."]),
    _m(id="regulacao_consultas_abertas", titulo="Consultas e audiências públicas recebendo contribuições",
       pergunta="Quantas consultas públicas da ANEEL estão abertas hoje?",
       definicao="Número de avisos de consulta ou audiência pública cuja abertura foi deliberada em reunião pública da Diretoria e cuja fase deliberada por último tem início ≤ data de referência ≤ fim, sem resultado deliberado.",
       unidade="consultas", grao_geografico="ANEEL", grao_temporal="dia (data de referência, horário de Brasília)",
       fontes=[F_ATAS], formula="contagem de avisos com situação 'aberta' pela regra de situação publicada na gold",
       regra_agregacao="contagem", natureza_fonte="OBSERVADO", natureza_transformacao="CALCULADO",
       dimensoes=["modalidade", "situação"],
       regras_comparabilidade=["Depende das atas publicadas; a contagem de um dia não se compara com totais anuais."],
       regra_cobertura="Avisos deliberados em reunião pública registrada no conjunto de pautas e atas (desde set/2017).",
       politica_ausencia="Fase sem janela na ata (só duração, só sessão de audiência ou nada) não entra na contagem de abertas; fase com início e duração escritos tem o fim calculado (contando o dia do início) e rotulado.",
       validacoes=["nenhuma consulta com fim anterior à data de referência aparece como aberta",
                   "período lido por expressões regulares testadas em frases reais das atas (por extenso, numéricas, 'entre os dias', 'com início em ... até')",
                   "datas da janela das abertas reencontradas no texto integral da decisão por regra independente"],
       limitacoes=["Prorrogação decidida fora da reunião pública não aparece.",
                   "Tomadas de subsídios e consultas abertas por ato de superintendência ficam de fora."]),
    _m(id="regulacao_cobertura_consultas", titulo="Cobertura das consultas e audiências reconstituídas das atas",
       pergunta="Que parte das consultas e das audiências públicas do ano aparece nas atas da Diretoria?",
       definicao="Por modalidade: consultas públicas com abertura deliberada nas atas do ano frente ao total anual de consultas públicas, e audiências públicas com abertura deliberada nas atas frente ao total anual de audiências, ambos publicados pela ANEEL no conjunto 'Audiências e Consultas Públicas'. As duas razões são publicadas separadas (cobertura e cobertura_faixa na gold).",
       unidade="consultas", grao_geografico="ANEEL", grao_temporal="ano",
       fontes=[F_ATAS, F_PART], numerador="aberturas da modalidade nas atas do ano", denominador="total anual da modalidade publicado pela ANEEL",
       regra_agregacao="contagem por ano", natureza_fonte="OBSERVADO", natureza_transformacao="CALCULADO",
       dimensoes=["ano", "modalidade"],
       regras_comparabilidade=["O ano em curso é parcial e o total anual foi gerado pela fonte em data anterior à das atas.",
                               "A cobertura das audiências é menor que a das consultas (faixas anuais em consultas.cobertura_faixa da gold): a contagem de abertas mistura as duas modalidades e herda a cobertura de cada uma."],
       regra_cobertura="2018 em diante.", politica_ausencia="Ano sem total publicado fica fora.",
       validacoes=["as duas contagens são publicadas lado a lado, sem ajuste"],
       limitacoes=["Diferenças podem vir de consultas abertas por circuito deliberativo ou superintendência, ou de numeração repetida na fonte."]),
    _m(id="regulacao_atividades_agenda", titulo="Atividades da Agenda Regulatória por ano previsto",
       pergunta="Quais normas a ANEEL prevê editar em 2026 e 2027?",
       definicao="Atividades do Anexo I da Portaria ANEEL nº 7.030/2025 (Agenda Regulatória 2026-2027), com código e ano previsto para edição da norma.",
       unidade="atividades", grao_geografico="ANEEL", grao_temporal="ano previsto",
       fontes=[F_DOCS, F_PAG], regra_agregacao="contagem por ano previsto",
       natureza_fonte="PREVISTO", natureza_transformacao="OBSERVADO", dimensoes=["ano previsto", "painel relacionado"],
       regras_comparabilidade=["Ano previsto é reprogramável; não é data de decisão."],
       regra_cobertura="Versão aprovada em 02/12/2025.",
       politica_ausencia="Atividade cujo texto não cai em nenhuma regra de palavra-chave fica sem painel relacionado.",
       validacoes=["contagem de códigos igual à de atividades lidas no Anexo I", "códigos únicos"],
       limitacoes=["A revisão de 08/09/2026 (Portaria nº 7.157/2026) não pôde ser lida."]),
]
