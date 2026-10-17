import type { Idioma } from "@/lib/idioma";

/**
 * Tabelas de tradução do grupo Mercado e preço (PLD, previsões, mercado, riscos): texto que chega
 * da gold em português e tem valores fixos. A chave é o texto português exato publicado; valor que
 * não está aqui (a fonte mudou a frase, categoria nova) sai em português marcado (<TrechoPortugues>),
 * nunca em português solto e nunca traduzido por aproximação. Não altera a gold.
 */

/** Forma inglesa de um texto da gold pela tabela exata; null quando não há entrada (ou a página é portuguesa). */
export function traducaoExata(mapa: Readonly<Record<string, string>>, pt: string | null | undefined, idioma: Idioma): string | null {
  if (idioma !== "en" || !pt) return null;
  return mapa[pt.trim()] ?? null;
}

/** Definições operacionais do módulo Mercado (gold mercado.json, campo definicoes). */
export const DEFINICOES_MERCADO_EN: Readonly<Record<string, string>> = {
  "Ambiente de Contratação Livre: o consumidor (livre ou especial) compra energia de gerador ou comercializador em contrato bilateral negociado livremente. No consumo contabilizado pela CCEE, o observatório conta como ACL as classes de agente de consumo (consumidor livre, consumidor especial, autoprodutor, comercializador e varejista) e deixa a exportação à parte.":
    "Free contracting environment: the consumer (free or special) buys energy from a generator or trader under a freely negotiated bilateral contract. In the consumption accounted by CCEE, the observatory counts the consumption agent classes (free consumer, special consumer, self-producer, trader and retailer) as ACL and keeps exports separate.",
  "Energia vendida a outros países (Argentina e Uruguai), registrada na CCEE pela classe de agente Exportador. O conjunto de consumo por ambiente da CCEE a soma ao ACL; o observatório a publica como componente separado e calcula a participação do ACL no consumo sem ela, como o InfoMercado apresenta o consumo.":
    "Energy sold to other countries (Argentina and Uruguay), registered at CCEE under the Exporter agent class. The CCEE consumption-by-environment dataset adds it to the ACL; the observatory publishes it as a separate component and calculates the ACL share of consumption without it, as InfoMercado presents consumption.",
  "Ambiente de Contratação Regulada: a distribuidora compra em leilões e revende ao consumidor cativo pela tarifa regulada.":
    "Regulated contracting environment: the distribution utility buys in auctions and resells to the captive consumer at the regulated tariff.",
  "Pessoa jurídica associada à CCEE ou cadastrada na ANEEL, identificada pelo CNPJ. Um agente pode ter vários perfis.":
    "Legal entity that is a member of CCEE or registered with ANEEL, identified by its CNPJ (company tax ID). An agent can have several profiles.",
  "Registro contábil de um agente na CCEE (código COD_PERF_AGENTE), com classe e, no caso de geração, tipo de energia. Novo perfil não é empresa nova.":
    "Accounting record of an agent at CCEE (code COD_PERF_AGENTE), with a class and, for generation, an energy type. A new profile is not a new company.",
  "Unidade de consumo modelada na CCEE (COD_PARCELA_CARGA), ligada a um perfil de agente; pode reunir uma ou mais unidades consumidoras. O conjunto de parcelas inclui uma parcela por área de distribuidora (perfil da classe Distribuidor), que representa o consumo do ACR e fica fora da contagem do ACL.":
    "Consumption unit modeled at CCEE (COD_PARCELA_CARGA), linked to an agent profile; it can group one or more consumer units. The parcel dataset includes one parcel per distribution utility area (Distributor class profile), which represents ACR consumption and is excluded from the ACL count.",
  "Instalação com um só ponto de entrega e medição individualizada, correspondente a um único consumidor (Resolução ANEEL 83/2004, citada pela EPE). É o que a EPE e o SAMP contam.":
    "Facility with a single delivery point and individual metering, corresponding to a single consumer (ANEEL Resolution 83/2004, cited by EPE). This is what EPE and SAMP count.",
  "Entrada de uma parcela de carga no ACL: a CCEE publica a data de migração de cada parcela; aqui conta-se a parcela cuja data de migração cai no próprio mês de referência.":
    "Entry of a load parcel into the ACL: CCEE publishes the migration date of each parcel; here a parcel is counted when its migration date falls within the reference month itself.",
  "Entrada: CNPJ presente na lista de associados da CCEE no mês e ausente no mês anterior; saída: o inverso. Saída não é necessariamente desligamento (pode ser sucessão).":
    "Entry: a CNPJ present in the CCEE member list in the month and absent in the previous month; exit: the reverse. An exit is not necessarily a disconnection (it can be a succession).",
  "Cancelamento da participação de um agente na CCEE, voluntário (a pedido, com ou sem sucessão) ou compulsório (por outorga revogada ou descumprimento), aprovado pelo Conselho de Administração.":
    "Cancellation of an agent's participation in CCEE, either voluntary (on request, with or without succession) or compulsory (due to a revoked grant or non-compliance), approved by the Board of Directors.",
  "Diferença entre o estoque de um mês e o do mês anterior: não separa quem entrou de quem saiu.":
    "Difference between the stock in one month and in the previous month: it does not separate who entered from who left.",
  "Mecanismo de Realocação de Energia: compartilha entre as hidrelétricas participantes o risco hidrológico do despacho centralizado; quem gera acima da garantia física cede energia a quem gera abaixo, ao preço da TEO.":
    "Energy Reallocation Mechanism: it shares the hydrological risk of centralized dispatch among the participating hydropower plants; plants that generate above their physical guarantee transfer energy to those that generate below it, at the TEO (energy optimization tariff) price.",
  "Fator de ajuste do MRE (generation scaling factor): geração das usinas do MRE dividida pela garantia física delas (modulada e ajustada pelo fator de disponibilidade). Abaixo de 100%, as usinas do MRE geraram menos que a garantia física e ficam expostas ao mercado de curto prazo.":
    "MRE adjustment factor (generation scaling factor): generation of the MRE plants divided by their physical guarantee (modulated and adjusted by the availability factor). Below 100%, the MRE plants generated less than their physical guarantee and are exposed to the short-term market.",
  "Parte do risco hidrológico que recai sobre o consumidor cativo: usinas em regime de cotas (Lei 12.783/2013), usinas que repactuaram o risco com a ANEEL (Lei 13.203/2015) e Itaipu. O custo é apurado pela CCEE por distribuidora e publicado pela ANEEL na Conta Bandeira.":
    "Part of the hydrological risk that falls on the captive consumer: plants under the quota regime (Law 12,783/2013), plants that renegotiated the risk with ANEEL (Law 13,203/2015) and Itaipu. The cost is calculated by CCEE per distribution utility and published by ANEEL in the Conta Bandeira (tariff flag account).",
  "Encargos de serviços do sistema: remuneram geração fora da ordem de mérito por restrição elétrica (constrained-on, constrained-off, unit commitment), segurança energética, serviços ancilares, deslocamento hidráulico, importação e reserva operativa; pagos pelos consumidores na proporção do consumo.":
    "System service charges: they pay for generation outside the merit order due to electrical constraints (constrained-on, constrained-off, unit commitment), energy security, ancillary services, hydro displacement, imports and operating reserve; paid by consumers in proportion to their consumption.",
  "Encargo de energia de reserva: cobre a contratação da energia de reserva, pago pelos usuários via CONER (Conta de Energia de Reserva) na CCEE.":
    "Reserve energy charge: it covers the contracting of reserve energy, paid by users through CONER (the reserve energy account) at CCEE.",
  "Competência é o mês de referência da contabilização; pagamento é a liquidação financeira (valor a liquidar, liquidado e inadimplência); reprocessamento é a mudança de um valor já publicado (aqui detectada entre capturas do silver e entre edições do boletim do MME).":
    "The accounting month is the reference month of the accounting; payment is the financial settlement (amount to be settled, settled and in default); reprocessing is a change to a value already published (detected here between silver captures and between editions of the MME bulletin).",
  "O PLD é o preço do mercado de curto prazo, usado para liquidar diferenças entre contratos e medição. Não é o preço dos contratos do mercado livre, que são bilaterais e privados: o observatório não publica preço de contrato, de PPA nem curva a termo.":
    "The PLD is the short-term market price, used to settle differences between contracts and metering. It is not the price of free-market contracts, which are bilateral and private: the observatory does not publish contract prices, PPA prices or a forward curve.",
};

/** Perguntas dos painéis do módulo Mercado (gold mercado.json, paineis[].pergunta). */
export const PERGUNTAS_MERCADO_EN: Readonly<Record<string, string>> = {
  "Como se distribui o consumo entre o mercado livre e o regulado?": "How is consumption split between the free and the regulated market?",
  "Quem participa do mercado e como a composição mudou?": "Who takes part in the market and how has its makeup changed?",
  "Como foi o ajuste da garantia física das hidrelétricas do MRE?": "How was the physical guarantee of the MRE hydropower plants adjusted?",
  "Quais custos públicos aparecem na liquidação do mercado de curto prazo?": "Which public costs appear in short-term market settlement?",
};

/** Efeito declarado de cada pendência e bloqueio do módulo Mercado (gold mercado.json, pendencias[] e bloqueios[]). */
export const EFEITOS_MERCADO_EN: Readonly<Record<string, string>> = {
  "GSF, consumo contabilizado por ambiente e encargos da CCEE não têm série anterior a 2023 neste observatório; o consumo cativo e livre da EPE cobre desde 2004 e o risco hidrológico do ACR (Conta Bandeira) desde 2015.":
    "GSF, consumption accounted by environment and CCEE charges have no series before 2023 in this observatory; EPE captive and free consumption is covered from 2004 and ACR hydrological risk (Conta Bandeira) from 2015.",
  "O painel publica o estoque de perfis por classe e status, sem série mensal de entradas e saídas de perfis.":
    "The panel publishes the stock of profiles by class and status, without a monthly series of profile entries and exits.",
  "A série de encargos extraída do boletim mensal cobre só as edições do ano corrente; a série principal de encargos vem da CCEE e o ano anterior é conferido com a consolidação anual.":
    "The charges series extracted from the monthly bulletin covers only the current year's editions; the main charges series comes from CCEE and the previous year is checked against the annual consolidation.",
};

/** Rótulo de categoria pela tabela exata; sem entrada, volta o valor da fonte (quem exibe marca como trecho em português). */
export function rotuloCategoria(mapa: Readonly<Record<string, string>>, valor: string, idioma: Idioma): string {
  return idioma === "en" ? mapa[valor] ?? valor : valor;
}

/** Classes de agente da CCEE e classes de consumo da EPE (gold mercado.json). */
export const CLASSES_MERCADO_EN: Readonly<Record<string, string>> = {
  Autoprodutor: "Self-producer",
  Comercializador: "Trader",
  "Consumidor Especial": "Special consumer",
  "Consumidor Livre": "Free consumer",
  Distribuidor: "Distributor",
  Gerador: "Generator",
  "Produtor Independente": "Independent producer",
  Exportador: "Exporter",
  Importador: "Importer",
  Transmissor: "Transmitter",
  Varejista: "Retailer",
  Residencial: "Residential",
  Industrial: "Industrial",
  Comercial: "Commercial",
  Rural: "Rural",
  Outros: "Other",
  Total: "Total", // i18n: dado
  ACL: "ACL",
  ACR: "ACR",
};

/** Notas fixas que a gold do mercado publica ao lado de tabelas. */
export const NOTAS_MERCADO_EN: Readonly<Record<string, string>> = {
  "O arquivo do cadastro não informa a data da posição; a data exibida é a de modificação do recurso informada pelo portal de dados abertos da CCEE (last_modified), que nem sempre acompanha o conteúdo. A data de captura não é usada como data do dado.":
    "The registry file does not state the date of the position; the date shown is the resource modification date reported by the CCEE open data portal (last_modified), which does not always follow the content. The capture date is not used as the data date.",
};

/** Tipos de encargo nas conferências com o boletim do MME (gold mercado.json, encargos.mme), já sem sublinhado. */
export const TIPOS_ENCARGO_EN: Readonly<Record<string, string>> = {
  "resposta demanda": "demand response",
  "suporte reativo": "reactive power support",
  "sr vinculado rd": "reactive support linked to demand response",
  "sr nao vinculado rd": "reactive support not linked to demand response",
  total: "total", // i18n: dado
};

/** Notas das revisões entre edições do boletim do MME. */
export const NOTAS_REVISAO_EN: Readonly<Record<string, string>> = {
  "linha publicada na edição anterior e retirada na seguinte": "row published in the previous edition and removed in the next one",
};

/* ---------------------------------------------------------------- PLD (gold pld_detalhe.json) */

/** Rótulos dos arquivos para baixar do PLD (pld_detalhe.json, downloads[].rotulo). */
export const DOWNLOADS_PLD_EN: Readonly<Record<string, string>> = {
  "CMO do DESSEM na hora e PLD horário, quatro submercados (CSV)": "Hourly DESSEM CMO and hourly PLD, four submarkets (CSV)",
  "CMO semanal, média do DESSEM e média do PLD por semana operativa (CSV)": "Weekly CMO, DESSEM average and PLD average by operating week (CSV)",
  "PLD diário com horas no piso e nos tetos e limites vigentes (CSV)": "Daily PLD with hours at the floor and caps and limits in force (CSV)",
  "PLD mensal: temporal, ponderado pela carga e em moeda constante (CSV)": "Monthly PLD: time-weighted, load-weighted and in constant currency (CSV)",
  "Percentis sazonais da média diária por mês (CSV)": "Seasonal percentiles of the daily average by month (CSV)",
  "Mapa hora × dia do PLD, últimos 90 dias (JSON)": "PLD hour × day map, last 90 days (JSON)",
  "PLD, CMO do DESSEM e fluxo nas fronteiras, últimas 168 horas (JSON)": "PLD, DESSEM CMO and flow at the boundaries, last 168 hours (JSON)",
  "Separação diária por par de submercados e fluxo na fronteira (CSV)": "Daily divergence by pair of submarkets and flow at the boundary (CSV)",
  "Amplitude diária entre submercados (CSV)": "Daily spread between submarkets (CSV)",
};

/** Notas fixas que a gold do PLD publica ao lado de figuras e tabelas (texto original, antes de qualquer troca). */
export const NOTAS_PLD_EN: Readonly<Record<string, string>> = {
  "Recorte hora × dia dos últimos 90 dias, lido sob demanda; o histórico horário inteiro está em pld_cmo_horario.csv.":
    "Hour × day selection for the last 90 days, read on demand; the full hourly history is in the hourly CMO and PLD file (CSV, under Download the data).",
};

/** Regras e notas de método fixas da gold do PLD (pld_detalhe.json: regional.regra_*, limites, previsões), texto exato publicado. */
export const TEXTOS_PLD_EN: Readonly<Record<string, string>> = {
  "Dois submercados estão separados numa hora quando |PLD_A − PLD_B| > R$ 0,01/MWh (mais de um centavo), sempre na mesma hora e na mesma publicação da CCEE. Diferenças de exatamente um centavo são frequentes e ficam contadas à parte (horas_diferenca_de_um_centavo), sem entrar na separação.":
    "Two submarkets are divergent in an hour when |PLD_A − PLD_B| > R$ 0.01/MWh (more than one cent), always in the same hour and in the same CCEE publication. Differences of exactly one cent are frequent and are counted separately (in their own column), outside the divergence count.",
  "horas_acima_1 e horas_acima_10 contam as horas com diferença acima de R$ 1,00/MWh e de R$ 10,00/MWh. A gold de operação pld.json (resumo por janela) usa R$ 1,00/MWh: nas mesmas janelas, horas_acima_1 da amplitude é o número dela (controle publicado); horas_com_separacao usa R$ 0,01/MWh e por isso é maior.":
    "The columns \"above 1\" and \"above 10\" count the hours with a difference above R$ 1.00/MWh and above R$ 10.00/MWh. The operation gold file pld.json (summary by window) uses R$ 1.00/MWh: in the same windows, the spread column \"above 1\" equals its figure (published check); the divergence count uses R$ 0.01/MWh and is therefore larger.",
  "Fluxo verificado pelo ONS na fronteira, na mesma hora, com sinal positivo da primeira para a segunda ponta. Fluxo de até 1 MWmed em módulo é tratado como nulo. A contagem é descritiva: os limites de intercâmbio não estão integrados e nenhuma hora é classificada como congestionada.":
    "Flow verified by ONS at the border, in the same hour, with a positive sign from the first to the second end. Flow of up to 1 MWavg in absolute value is treated as zero. The count is descriptive: the interchange limits are not integrated and no hour is classified as congested.",
};

/** Textos fixos da comparação CMO × PLD (pld_detalhe.json, cmo_pld.nao_equivalencia e cmo_pld.produtos), texto exato publicado. */
export const TEXTOS_CMO_EN: Readonly<Record<string, string>> = {
  "O CMO semanal do DECOMP é um valor para a semana operativa inteira, por patamar de carga e em média semanal (descrição do ONS); não é uma média de valores horários.":
    "The weekly DECOMP CMO is a value for the whole operating week, by load level and as a weekly average (ONS description); it is not an average of hourly values.",
  "O CMO semi-horário do DESSEM publicado pelo ONS é o do subsistema, média das barras ponderada pelas cargas; os conjuntos do ONS não identificam deck, versão ou revisão do modelo por valor.":
    "The half-hourly DESSEM CMO published by ONS is the subsystem one, an average of the buses weighted by their loads; the ONS datasets do not identify the model deck, version or revision for each value.",
  "O PLD é calculado pela CCEE para cada hora do dia seguinte, com base no CMO e com a aplicação dos limites mínimo e máximos vigentes; a descrição pública integrada não detalha as diferenças de configuração entre a execução da CCEE e a do ONS.":
    "The PLD is calculated by CCEE for each hour of the following day, based on the CMO and applying the minimum and maximum limits in force; the integrated public description does not detail the configuration differences between the CCEE run and the ONS run.",
  "Agregar as duas meias horas por duração alinha a resolução, mas não torna as séries iguais: mesmo nas horas com o PLD entre os limites, o PLD e o CMO do ONS diferem (ver relação por ano).":
    "Aggregating the two half hours by duration aligns the resolution but does not make the series equal: even in hours with the PLD between the limits, the PLD and the ONS CMO differ (see the relation by year).",
  "CMO semanal (DECOMP)": "Weekly CMO (DECOMP)",
  "CMO semi-horário (DESSEM)": "Half-hourly CMO (DESSEM)",
  "PLD horário": "Hourly PLD",
  "NEWAVE, DECOMP e DESSEM, segundo a CCEE": "NEWAVE, DECOMP and DESSEM, according to CCEE",
  "semana operativa de sábado a sexta, com valores por patamar de carga (leve, médio, pesado) e média semanal":
    "operating week from Saturday to Friday, with values by load level (light, medium, heavy) and a weekly average",
  "subsistema": "subsystem",
  "submercado": "submarket",
  "meia hora; o instante publicado marca o início da meia hora": "half hour; the published instant marks the start of the half hour",
  "subsistema: média dos CMOs das barras do subsistema ponderada pelas cargas (descrição do ONS; Manual de Metodologia do DESSEM, CEPEL, seção 22.6)":
    "subsystem: average of the CMOs of the subsystem's buses weighted by their loads (ONS description; DESSEM Methodology Manual, CEPEL, section 22.6)",
  "hora (HORA 0 a 23, horário de Brasília)": "hour (HOUR 0 to 23, Brasília time)", // i18n: dado
  "horas com PLD entre os limites vigentes, fora de dias no teto estrutural": "hours with the PLD between the limits in force, excluding days at the structural cap",
  "diariamente, para cada hora do dia seguinte (descrição oficial da CCEE)": "daily, for each hour of the following day (official CCEE description)",
  "não identificados por valor no conjunto da CCEE": "not identified per value in the CCEE dataset",
  "As versões dos modelos usados pelo ONS são as validadas com os agentes e homologadas pela ANEEL por ato específico (Procedimentos de Rede, Submódulo 4.3, item 1.7.1.3); o conjunto de dados não identifica a versão nem o deck de cada valor.":
    "The versions of the models used by ONS are those validated with the agents and approved by ANEEL through a specific act (Grid Procedures, Submodule 4.3, item 1.7.1.3); the dataset does not identify the version or the deck of each value.",
};

/** Regras do resumo do PLD e exemplo sintético de liquidação (pld.json, regras; pld_detalhe.json, conceito.exemplo_liquidacao), texto exato publicado. */
export const TEXTOS_PLD_ABERTURA_EN: Readonly<Record<string, string>> = {
  "Último dia com as 24 horas publicadas para os quatro submercados.": "Latest day with all 24 hours published for the four submarkets.",
  "Média aritmética simples das 24 horas do dia (horário local de Brasília).": "Simple arithmetic average of the 24 hours of the day (Brasília local time).", // i18n: dado
  "Percentil da média diária do dia de referência na distribuição das médias diárias do mesmo submercado desde 01/01/2021, em valores nominais. Faixa baixa: abaixo do 25º percentil. Central: do 25º ao 75º. Alta: acima do 75º.":
    "Percentile of the reference day's daily average in the distribution of daily averages of the same submarket since Jan 1, 2021, in nominal values. Low band: below the 25th percentile. Central: from the 25th to the 75th. High: above the 75th.",
  "Desvio padrão amostral dos valores horários do período.": "Sample standard deviation of the hourly values in the period.",
  "Fração das horas do período abaixo do 25º percentil, entre o 25º e o 75º e acima do 75º percentil da distribuição horária do submercado desde 01/01/2021.":
    "Share of the hours in the period below the 25th percentile, between the 25th and the 75th, and above the 75th percentile of the submarket's hourly distribution since Jan 1, 2021.",
  "Menor valor horário observado no ano civil até o dia de referência. Não é o piso regulatório: o piso vigente é o do ato da ANEEL, conferido na página Limites.":
    "Lowest hourly value observed in the calendar year up to the reference day. It is not the regulatory floor: the floor in force is the one in the ANEEL act, checked on the Limits page.",
  "Para cada hora, maior valor menos menor valor entre os quatro submercados. Contam-se as horas com diferença acima de R$ 1,00/MWh; diferenças menores são tratadas como coincidência nesta contagem.":
    "For each hour, the highest value minus the lowest value among the four submarkets. Hours with a difference above R$ 1.00/MWh are counted; smaller differences are treated as coincidence in this count.",
  "Exemplo sintético para explicar o mecanismo. As quantidades são hipotéticas e não representam a contabilização de nenhum agente nem de nenhum mês; o único número real é o PLD da hora indicada, publicado pela CCEE.":
    "Synthetic example to explain the mechanism. The quantities are hypothetical and do not represent the accounting of any agent or any month; the only real number is the PLD of the stated hour, published by CCEE.",
  "diferença (MWh) = geração verificada + compras contratadas − consumo verificado − vendas contratadas; valor no mercado de curto prazo (R$) = diferença × PLD da hora":
    "difference (MWh) = verified generation + contracted purchases − verified consumption − contracted sales; value in the short-term market (R$) = difference × PLD of the hour",
  "O preço de cada contrato é acertado entre as partes e não entra na conta: só a diferença entre o que foi contratado e o que foi verificado é valorada ao PLD. Neste exemplo as duas diferenças se compensam.":
    "The price of each contract is agreed between the parties and does not enter the calculation: only the difference between what was contracted and what was verified is valued at the PLD. In this example the two differences offset each other.",
  "Uma hora e um submercado. A contabilização real soma todas as horas do mês e a liquidação financeira é multilateral, com periodicidade máxima mensal (REN ANEEL nº 957/2021, art. 82).":
    "One hour and one submarket. Real accounting adds up all the hours of the month, and financial settlement is multilateral, at most monthly (ANEEL REN No. 957/2021, art. 82).",
  "Sem perdas de transmissão: o cálculo real ajusta as quantidades pelo fator de perdas (Decreto nº 5.163/2004, art. 57, § 5º).":
    "No transmission losses: the real calculation adjusts the quantities by the loss factor (Decree No. 5.163/2004, art. 57, § 5).",
  "Sem encargos, penalidades, garantias financeiras, sazonalização e modulação de contratos, nem mecanismos de compartilhamento de risco.":
    "No charges, penalties, financial guarantees, contract seasonalization and modulation, or risk-sharing mechanisms.",
  "Contratos, geração e consumo no mesmo submercado: o exemplo não trata diferenças de preço entre submercados.":
    "Contracts, generation and consumption in the same submarket: the example does not deal with price differences between submarkets.",
  "Crédito para diferença positiva e débito para negativa é a convenção deste exemplo; as regras algébricas da CCEE não estão acessíveis.":
    "Credit for a positive difference and debit for a negative one is the convention of this example; the CCEE algebraic rules are not accessible.",
  "Consumidor hipotético": "Hypothetical consumer",
  "Gerador hipotético": "Hypothetical generator",
  "débito": "debit",
  "crédito": "credit",
  "hora de maior PLD do Sudeste/Centro-Oeste no dia de referência": "hour with the highest Southeast/Center-West PLD on the reference day",
  "CCEE, PLD horário por submercado": "CCEE, hourly PLD by submarket",
};

/* ---------------------------------------------------------------- Previsões (gold previsoes_desempenho.json, fichas) */

/**
 * Textos fixos do registro de modelos de previsão (nome descritivo, papel, entradas, variáveis, fórmula, leitura da aprovação), no
 * texto exato publicado e também na forma já limpa pelas funções de leitura (semCodigosInternos, papelCurto). O identificador do
 * modelo (B0, S0, C1, C2-P, C2-H) é nome próprio e não se traduz; o nome descritivo, sim.
 */
export const REGISTRO_MODELOS_EN: Readonly<Record<string, string>> = {
  "Persistência": "Persistence",
  "Mistura fixa": "Fixed blend",
  "Correção por preços": "Price correction",
  "Correção com hidrologia": "Correction with hydrology",
  "Sazonal": "Seasonal",
  "Referência simples (benchmark) e método do piloto operacional interno": "Simple benchmark and method of the internal operational pilot",
  "Referência simples": "Simple benchmark",
  "Candidato": "Candidate",
  "Referência sazonal (benchmark exigido pela seção 12.3); não é candidato": "Seasonal benchmark; not a candidate",
  "Referência sazonal (benchmark); não é candidato": "Seasonal benchmark; not a candidate",
  "Referência sazonal": "Seasonal benchmark",
  "PLD horário do submercado (CCEE)": "Hourly PLD of the submarket (CCEE)",
  "Média móvel recente − B0": "Recent moving average − B0",
  "Mesmo período do ano anterior − B0": "Same period of the previous year − B0",
  "Média dos 7 últimos dias − B0": "Average of the last 7 days − B0",
  "Variação da EAR em 28 dias (p.p.)": "Change in EAR over 28 days (pp)",
  "ENA média de 7 dias (% da MLT) − 100": "7-day average ENA (% of MLT) − 100",
  "Média móvel recente − B0 (R$/MWh)": "Recent moving average − B0 (R$/MWh)",
  "Mesmo período do ano anterior − B0 (R$/MWh)": "Same period of the previous year − B0 (R$/MWh)",
  "Média dos 7 últimos dias − B0 (R$/MWh)": "Average of the last 7 days − B0 (R$/MWh)",
  "ENA bruta média de 7 dias (% da MLT) − 100": "7-day average gross ENA (% of MLT) − 100",
  "B0 = média do PLD horário do último período completo elegível no corte": "B0 = average of the hourly PLD of the latest complete period eligible at the cutoff",
  "S0 = média do PLD horário do mesmo período um ano antes da entrega": "S0 = average of the hourly PLD of the same period one year before the delivery",
  "C2 = B0 + Σ_j (x_j / escala_rms_j) · beta_escalado_j; sem intercepto; coeficiente de B0 fixo em 1; λ = ZERO ⇒ todos os beta = 0 ⇒ C2 = B0":
    "C2 = B0 + Σ_j (x_j / rms_scale_j) · scaled_beta_j; no intercept; B0 coefficient fixed at 1; λ = ZERO ⇒ all beta = 0 ⇒ C2 = B0",
  "Em pesquisa: não alimenta a previsão principal. Autorizado como referência experimental identificada, sem aprovação.":
    "In research: does not feed the main forecast. Authorized as an identified experimental benchmark, without approval.",
  "Em pesquisa: não alimenta a previsão principal.": "In research: does not feed the main forecast.",
  "A composição do C1 (referências e pesos) está no arquivo de configuração da pesquisa, que não está no repositório nem foi publicado. Sem configuração publicável não há como reimplementar nem auditar o C1; ele segue só como registro da pesquisa.":
    "The composition of C1 (benchmarks and weights) is in the research configuration file, which is not in the repository and was not published. Without a publishable configuration there is no way to reimplement or audit C1; it remains only as a research record.",
  "A composição do C1 (referências e pesos) está no arquivo de configuração da pesquisa, que não foi publicado. Sem configuração publicável não há como refazer nem auditar o C1; ele segue só como registro da pesquisa.":
    "The composition of C1 (benchmarks and weights) is in the research configuration file, which was not published. Without a publishable configuration there is no way to redo or audit C1; it remains only as a research record.",
};

/** Forma inglesa de um texto do registro de modelos; sem entrada na tabela, o texto volta como veio (a página marca o trecho). */
export function textoRegistroModelos(texto: string, idioma: Idioma): string {
  return traducaoExata(REGISTRO_MODELOS_EN, texto, idioma) ?? texto;
}

/** Critério da tabela de distribuidoras (gold mercado.json, livre_regulado.distribuidoras.criterio). */
export const CRITERIOS_MERCADO_EN: Readonly<Record<string, string>> = {
  "as 30 maiores em energia livre faturada no ano; a tabela completa está no CSV": "the 30 largest by free-market energy billed in the year; the full table is in the CSV",
};
