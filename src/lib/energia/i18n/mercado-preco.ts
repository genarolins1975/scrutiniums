import { createElement, Fragment, type ReactNode } from "react";
import { Nome } from "@/components/i18n/Nome";
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
  "PLD horário, quatro submercados (CSV)": "Hourly PLD, four submarkets (CSV)",
  "PLD médio diário, quatro submercados (CSV)": "Daily average PLD, four submarkets (CSV)",
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
  "a composição do C1 (referências e pesos) está no arquivo de configuração da pesquisa, que não foi publicado. Sem configuração publicável não há como refazer nem auditar o C1; ele segue só como registro da pesquisa.":
    "the composition of C1 (benchmarks and weights) is in the research configuration file, which was not published. Without a publishable configuration there is no way to redo or audit C1; it remains only as a research record.",
};

/** Forma inglesa de um texto do registro de modelos; sem entrada na tabela, o texto volta como veio (a página marca o trecho). */
export function textoRegistroModelos(texto: string, idioma: Idioma): string {
  return traducaoExata(REGISTRO_MODELOS_EN, texto, idioma) ?? texto;
}

/** Frases fixas da gold de previsões (bandas, candidatos, leitura do acompanhamento, rotina, definição do realizado), texto exato publicado. */
export const TEXTOS_PREVISOES_EN: Readonly<Record<string, string>> = {
  "Sem faixa: nenhum segmento do B0 está calibrado no período de teste (estado em cada célula; a cobertura do teste retrospectivo está retida fora do portal até a liberação dos números de desempenho).":
    "No band: no B0 segment is calibrated in the test period (state in each cell; the coverage of the retrospective test is withheld outside the portal until the performance numbers are released).",
  "C2-P e C2-H não são emitidos: a governança retém número de rodada interna dos candidatos até a liberação formal registrada no registro de modelos. O período prospectivo deles ainda não começou.":
    "C2-P and C2-H are not issued: governance withholds the internal run numbers of the candidates until the formal release recorded in the model registry. Their prospective period has not started yet.",
  "Nenhuma entrega prevista pelo arquivo terminou ainda: não há desempenho prospectivo, e nada pode ser concluído sobre a operação real.":
    "No delivery forecast in the archive has ended yet: there is no prospective performance, and nothing can be concluded about real operation.",
  "Pelo menos sete rodadas agendadas no prazo, sem dia faltante desde o início da operação agendada. Dia faltante é dia de Brasília cujo prazo das 08h00 já passou sem rodada agendada registrada.":
    "At least seven scheduled runs on time, with no missing day since the start of scheduled operation. A missing day is a Brasília day whose 08:00 deadline has passed with no scheduled run recorded.", // i18n: dado
  "Pelo menos sete rodadas agendadas no prazo e nenhum dia faltante nos últimos 30 dias vencidos (ou desde o início da operação agendada, se for mais recente). Dia faltante é dia de Brasília cujo prazo das 08h00 já passou sem rodada agendada registrada; os dias faltantes anteriores à janela continuam contados no total.":
    "At least seven scheduled runs on time and no missing day in the last 30 days past their deadline (or since the start of scheduled operation, if more recent). A missing day is a Brasília day whose 08:00 deadline has passed with no scheduled run recorded; missing days before the window are still counted in the total.", // i18n: dado
  "As execuções agendadas emitiram a rodada, mas falharam ao registrá-la no repositório: arquivos derivados que a rodada não publica impediam a atualização antes do envio. Nenhuma rodada desses dias foi registrada, e elas não podem ser refeitas, porque cada previsão depende do dado como estava no corte do dia.":
    "The scheduled runs issued the forecast but failed to record it in the repository: derived files that the run does not publish blocked the update before the push. No run from those days was recorded, and they cannot be redone, because each forecast depends on the data as it stood at that day's cutoff.", // i18n: dado
  "Nenhuma execução agendada registrada até agora: a rotina está escrita no código, mas ainda não foi comprovada por execução real.":
    "No scheduled run recorded so far: the routine is written in the code but has not yet been demonstrated by a real run.",
  "Média de todas as horas da entrega no PLD horário vigente; só existe quando as 168 horas da semana (ou 24 × dias do mês) estão publicadas. Entrega incompleta não tem realizado.":
    "Average of all hours of the delivery in the hourly PLD in force; it only exists when the 168 hours of the week (or 24 × days of the month) are published. An incomplete delivery has no actual value.",
  "entregas que terminam até 01/01/2025 00h (seleção de modelos)": "deliveries that end by Jan 1, 2025 00h (model selection)",
  "entregas que começam em 01/01/2025 ou depois (teste final)": "deliveries that start on Jan 1, 2025 or later (final test)",
  "entregas que atravessam a virada ficam fora dos dois": "deliveries that straddle the turn of the year are left out of both",
  "Regra de defasagem de 1 dia: um dado só entra como informação se o seu período terminou até 1 dia antes do horário de corte (hipótese fixada pela pesquisa antes dos testes).":
    "1-day lag rule: a piece of data only enters as information if its period ended up to 1 day before the cutoff time (hypothesis fixed by the research before the tests).",
  "Números de desempenho do teste retrospectivo retidos: a regra do registro de modelos só os admite no portal depois da liberação formal pelo responsável pela plataforma, e essa decisão ainda não foi registrada com nome e data. O cálculo está pronto e é reproduzível; os resultados ficam fora do portal até a decisão.":
    "Performance numbers from the retrospective test withheld: the model registry rule only admits them on the portal after formal release by the platform owner, and that decision has not yet been recorded with a name and a date. The calculation is ready and reproducible; the results stay off the portal until the decision.",
  "Não usa informação de chuva, reservatórios ou vazões: só o preço passado.": "It uses no information on rain, reservoirs or inflows: only the past price.",
  "Nos testes da pesquisa, as faixas de incerteza cobriram menos do que prometiam, e no horizonte mensal há poucos casos para comparar modelos.":
    "In the research tests, the uncertainty bands covered less than they promised, and in the monthly horizon there are few cases to compare models.",
  "As faixas de incerteza não estão calibradas: a faixa do 10º ao 90º percentil não pode ser apresentada como uma faixa de 80%.":
    "The uncertainty bands are not calibrated: the band from the 10th to the 90th percentile cannot be presented as an 80% band.",
  "As faixas de incerteza não estão calibradas, e o período usado nos testes já tinha sido examinado antes da definição do modelo (resultado exploratório).":
    "The uncertainty bands are not calibrated, and the period used in the tests had already been examined before the model was defined (exploratory result).",
  "Não acompanha mudança de regime de preço entre um ano e outro.": "It does not follow a change in price regime from one year to the next.",
  "Repete o último valor completo: a previsão de cada período é a média do período mais recente já encerrado no corte. Serve de régua: um candidato só vale a pena se errar menos que isso.":
    "It repeats the latest complete value: the forecast for each period is the average of the most recent period already closed at the cutoff. It serves as a yardstick: a candidate is only worthwhile if it errs less than this.",
  "Repete o último valor completo: a previsão de cada período é a média do período mais recente já encerrado no corte.":
    "It repeats the latest complete value: the forecast for each period is the average of the most recent period already closed at the cutoff.",
  "Combina referências simples com pesos fixos. Quais referências e quais pesos estão no arquivo de configuração da pesquisa, ainda não publicado.":
    "It combines simple benchmarks with fixed weights. Which benchmarks and which weights are in the research configuration file, not yet published.",
  "Combina referências simples com pesos fixos.": "It combines simple benchmarks with fixed weights.",
  "Parte da persistência (B0) e a corrige com informações recentes de preço.": "It starts from persistence (B0) and corrects it with recent price information.",
  "Parte da persistência (B0) e a corrige com informações de preço e de hidrologia.": "It starts from persistence (B0) and corrects it with price and hydrology information.",
  "Repete o mesmo período do ano anterior. Serve de segunda régua, ao lado da persistência.": "It repeats the same period of the previous year. It serves as a second yardstick, alongside persistence.",
  "Repete o mesmo período do ano anterior.": "It repeats the same period of the previous year.",
  "07h00 de Brasília do dia de origem; dado como estava no corte": "07:00 Brasília time on the origin day; data as it was at the cutoff", // i18n: dado
  "Coeficiente na unidade original: R$/MWh de correção por R$/MWh (ou por ponto percentual) da variável.":
    "Coefficient in the original unit: R$/MWh of correction per R$/MWh (or per percentage point) of the variable.",
  "A faixa entre P10 e P90 pretende conter o preço em 80% dos casos; se contém de fato só se sabe com a calibração, verificada nos testes.":
    "The band between P10 and P90 is meant to contain the price in 80% of cases; whether it actually does is only known from calibration, checked in the tests.",
};

/** Forma inglesa de uma frase fixa da gold de previsões ou do registro de modelos; null sem entrada (a página marca o trecho em português). */
export function traducaoPrevisoes(pt: string | null | undefined, idioma: Idioma): string | null {
  return traducaoExata(TEXTOS_PREVISOES_EN, pt, idioma) ?? traducaoExata(REGISTRO_MODELOS_EN, pt, idioma);
}

/** Critério da tabela de distribuidoras (gold mercado.json, livre_regulado.distribuidoras.criterio). */
export const CRITERIOS_MERCADO_EN: Readonly<Record<string, string>> = {
  "as 30 maiores em energia livre faturada no ano; a tabela completa está no CSV": "the 30 largest by free-market energy billed in the year; the full table is in the CSV",
};

/* ---------------------------------------------------------------- Marcas de idioma dentro de frases já traduzidas */

/** Nomes próprios em português que as frases inglesas do grupo citam por extenso (conta setorial, publicação oficial, organização da fonte). */
export const NOMES_MERCADO_PRECO: readonly string[] = ["Preço de Liquidação das Diferenças", "Boletim de Monitoramento", "Conta Bandeira"]; // i18n: dado

/**
 * Identificador técnico no meio de uma frase: código de conjunto ou de campo com sublinhado (COD_PARCELA_CARGA,
 * infomercado_dados_gerais), caminho de arquivo (pipeline/energia/previsoes/variaveis.py) e impressão digital hexadecimal.
 */
const IDENTIFICADOR_MP = new RegExp(
  String.raw`(?<![\p{L}\p{N}_./-])(?:[\w-]+(?:\/[\w.-]+)*\.(?:py|yml|ts|json|csv|parquet)\b|[A-Za-z0-9][\w.-]*_[\w.-]*|(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{12,64})(?![\p{L}\p{N}_])`,
  "gu",
);

const ESTILO_IDENTIFICADOR = { fontFamily: "inherit", fontSize: "inherit", overflowWrap: "anywhere" } as const;

/** Identificador técnico solto (hash, id da gold, comando): na página inglesa em <code> com a fonte do texto ao redor; em português, o texto puro. */
export function identificador(texto: string | null | undefined, idioma: Idioma): ReactNode {
  if (!texto) return texto ?? "";
  if (idioma !== "en") return texto;
  return createElement("code", { style: ESTILO_IDENTIFICADOR, translate: "no" }, texto);
}

const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Frase com nomes próprios e identificadores dentro: em português, o texto como veio; em inglês, os nomes (NOMES_MERCADO_PRECO e os
 * de `nomes`) em <Nome> e os identificadores técnicos em <code>. O texto não muda, só ganha as marcas.
 */
export function marcadoMercado(texto: string | null | undefined, idioma: Idioma, nomes: readonly string[] = []): ReactNode {
  if (!texto || idioma !== "en") return texto ?? "";
  const lista = [...nomes, ...NOMES_MERCADO_PRECO].sort((a, b) => b.length - a.length);
  const achados: { i: number; f: number; tipo: "nome" | "codigo" }[] = [];
  for (const m of texto.matchAll(new RegExp(`(?<![\\p{L}\\p{N}])(?:${lista.map(escapar).join("|")})(?![\\p{L}\\p{N}])`, "gu"))) {
    achados.push({ i: m.index ?? 0, f: (m.index ?? 0) + m[0].length, tipo: "nome" });
  }
  for (const m of texto.matchAll(IDENTIFICADOR_MP)) {
    const t = m[0].replace(/[.,:;/-]+$/, "");
    if (t) achados.push({ i: m.index ?? 0, f: (m.index ?? 0) + t.length, tipo: "codigo" });
  }
  achados.sort((a, b) => a.i - b.i || b.f - a.f);
  const partes: ReactNode[] = [];
  let ultimo = 0;
  for (const a of achados) {
    if (a.i < ultimo) continue;
    if (a.i > ultimo) partes.push(texto.slice(ultimo, a.i));
    const trecho = texto.slice(a.i, a.f);
    partes.push(
      a.tipo === "nome"
        ? createElement(Nome, { key: `n${a.i}` } as unknown as { children: ReactNode }, trecho)
        : createElement("code", { key: `c${a.i}`, style: ESTILO_IDENTIFICADOR, translate: "no" }, trecho),
    );
    ultimo = a.f;
  }
  if (!partes.length) return texto;
  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return createElement(Fragment, null, ...partes);
}

/** Tolerâncias das conferências do módulo Mercado (gold mercado.json, campo tolerancia), texto exato publicado; os números são os mesmos. */
export const TOLERANCIAS_MERCADO_EN: Readonly<Record<string, string>> = {
  "5,5 MW médios (0,5 do arredondamento a MW médio inteiro e até 5 da diferença entre os conjuntos por classe e por ambiente)":
    "5.5 MWavg (0.5 from rounding to a whole MWavg and up to 5 from the difference between the datasets by class and by environment)",
  "maior entre 1 MWh e 10⁻⁶ do total nacional do mês; 1 unidade consumidora": "the greater of 1 MWh and 10⁻⁶ of the national total for the month; 1 consumer unit", // i18n: dado (tabela de tradução)
  "0,006 p.p. (o InfoMercado publica duas casas decimais)": "0.006 pp (InfoMercado publishes two decimal places)",
  "0,05 p.p. (o InfoMercado publica uma casa decimal)": "0.05 pp (InfoMercado publishes one decimal place)",
  "0,5 mil R$ por tipo e mês no boletim do MME; R$ 0,06 milhão por mês no InfoMercado": "R$ 0.5 thousand per type and month in the MME bulletin; R$ 0.06 million per month in InfoMercado",
  "5 MW médios por mês na identidade entre os conjuntos; 5,5 MW médios no consumo do InfoMercado; 0,005 MW médio na exportação; 0,05 p.p. na variação":
    "5 MWavg per month in the identity between the datasets; 5.5 MWavg in InfoMercado consumption; 0.005 MWavg in exports; 0.05 pp in the change",
  "R$ 0,005 milhão (duas casas decimais em milhões)": "R$ 0.005 million (two decimal places in millions)",
  "0,006 p.p. (duas casas decimais publicadas)": "0.006 pp (two decimal places published)",
  "1 GWh (o boletim publica GWh inteiros)": "1 GWh (the bulletin publishes whole GWh)",
  "0,5 MW médio (o InfoMercado publica MW médios inteiros)": "0.5 MWavg (InfoMercado publishes whole MWavg)",
  "R$ 0,06 milhão (diferença de dois números publicados com uma ou duas casas decimais em milhões)": "R$ 0.06 million (difference between two numbers published with one or two decimal places in millions)",
  "R$ 0,010 milhão (2 parcelas publicadas com duas casas decimais em milhões)": "R$ 0.010 million (2 components published with two decimal places in millions)",
  "0,05 p.p. (o boletim publica uma casa decimal)": "0.05 pp (the bulletin publishes one decimal place)",
  "0,005 MW médio (o InfoMercado publica duas casas decimais)": "0.005 MWavg (InfoMercado publishes two decimal places)",
  "R$ 0,05 bilhão no total; 1 p.p. na variação": "R$ 0.05 billion in the total; 1 pp in the change", // i18n: dado (tabela de tradução)
  "R$ 0,005 milhão (1 parcela publicada com duas casas decimais em milhões)": "R$ 0.005 million (1 component published with two decimal places in millions)",
  "R$ 0,005 bilhão (duas casas decimais em bilhões)": "R$ 0.005 billion (two decimal places in billions)",
  "R$ 0,06 milhão (diferença de números publicados com uma ou duas casas decimais em milhões)": "R$ 0.06 million (difference between numbers published with one or two decimal places in millions)",
  "0,5 mil R$ por tipo e mês; 6 mil R$ no total sem a resposta da demanda": "R$ 0.5 thousand per type and month; R$ 6 thousand in the total excluding demand response", // i18n: dado (tabela de tradução)
  "3% do número da EPE (universos diferentes, publicações independentes)": "3% of the EPE figure (different universes, independent publications)",
  "0 agente": "0 agents",
};

/** Medidas conferidas com o InfoMercado que não têm rótulo próprio em português (o português mostra o código sem sublinhado). */
export const MEDIDAS_INFOMERCADO_EN: Readonly<Record<string, string>> = {
  geracao_mre_mwmed: "MRE generation (MWavg)",
  encargos_servicos_ancilares_milhoes_rs: "Ancillary service charges (R$ million)",
  encargos_resposta_demanda_milhoes_rs: "Demand response charges (R$ million)",
  encargos_deslocamento_hidraulico_milhoes_rs: "Hydro displacement charges (R$ million)",
  encargos_suporte_reativo_milhoes_rs: "Reactive power support charges (R$ million)",
  encargos_restricao_operacao_milhoes_rs: "Operating restriction charges (R$ million)",
  encargos_importacao_milhoes_rs: "Import charges (R$ million)",
  encargos_do_conjunto_milhoes_rs: "Charges in the dataset (R$ million)",
  pagamento_ess_milhoes_rs: "ESS payment (R$ million)",
  liquidar_bilhoes_rs: "Amount to be settled (R$ billion)",
};

/** Títulos descritivos do catálogo nas fontes do módulo Mercado (catalogo.json, titulo); os demais são nomes de conjunto e ficam como estão. */
export const TITULOS_CATALOGO_MERCADO_EN: Readonly<Record<string, string>> = {
  "InfoMercado mensal (PDF): sumário executivo e composição dos encargos, usados para conferir os números calculados":
    "Monthly InfoMercado (PDF): executive summary and breakdown of charges, used to check the calculated numbers",
  "Consumo mensal de energia elétrica por classe (planilha formatada; conferência)": "Monthly electricity consumption by class (formatted spreadsheet; check)",
  "Consumo mensal de energia elétrica: dados abertos (SAM), cativo e livre": "Monthly electricity consumption: open data (SAM), captive and free",
  "Boletim de Monitoramento do Sistema Elétrico: edições mensais (encargos de serviços do sistema e consumo por ambiente) e consolidação anual (conferência anual)":
    "Power System Monitoring Bulletin (Boletim de Monitoramento do Sistema Elétrico): monthly editions (system service charges and consumption by environment) and annual consolidation (annual check)", // i18n: dado (tabela de tradução)
};

/** Páginas do observatório em que a fonte aparece (catalogo.json, paginas[].rotulo): nomes dos módulos no glossário inglês. */
export const PAGINAS_CATALOGO_EN: Readonly<Record<string, string>> = {
  Mercado: "Market",
  Empresas: "Companies",
  "Regulação": "Regulation",
  "Conta de luz": "Electricity bill",
  "Leilões": "Auctions",
  "Geração": "Generation",
  Carga: "Load",
  Rede: "Grid",
  PLD: "PLD",
};

/** Modo de emissão das rodadas de previsão (gold previsoes_desempenho.json, rodadas[].modo e o CSV do arquivo). */
export const MODOS_EMISSAO_EN: Readonly<Record<string, string>> = {
  agendada: "scheduled",
  manual: "manual",
  "manual (registro transcrito de artefato externo)": "manual (record transcribed from an external artifact)",
};

/** Valores de texto da configuração publicada dos modelos (gold previsoes_desempenho.json, fichas[].configuracao). */
export const CONFIG_MODELOS_EN: Readonly<Record<string, string>> = {
  "domingo (semanal)": "Sunday (weekly)",
  "erro quadrático na validação interna": "squared error in internal validation",
};

/** Pendências da pesquisa e estados dos achados da governança das previsões (títulos e estados curtos, texto exato publicado). */
export const GOVERNANCA_PREVISOES_EN: Readonly<Record<string, string>> = {
  "Última etapa de validação da pesquisa": "Final validation stage of the research",
  "C2 pode amplificar o sinal de preço; previsões mensais negativas": "C2 can amplify the price signal; negative monthly forecasts",
  "corrigido no código; aguarda rodada agendada real no prazo": "fixed in the code; awaiting a real scheduled run on time",
  "distinção mantida; hipótese LAT1D documentada e com sensibilidade": "distinction kept; LAT1D assumption documented, with a sensitivity analysis",
};
