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

/** Critério da tabela de distribuidoras (gold mercado.json, livre_regulado.distribuidoras.criterio). */
export const CRITERIOS_MERCADO_EN: Readonly<Record<string, string>> = {
  "as 30 maiores em energia livre faturada no ano; a tabela completa está no CSV": "the 30 largest by free-market energy billed in the year; the full table is in the CSV",
};

/**
 * Rótulo da natureza do dado no idioma da página, para os painéis do grupo que escrevem a natureza em texto corrido
 * (o selo compartilhado, NATUREZAS em SeloNatureza, só tem o português).
 */
const NATUREZA_EN: Readonly<Record<string, string>> = {
  OBSERVADO: "Observed",
  CALCULADO: "Calculated",
  ESTIMADO: "Estimated",
  PREVISTO: "Forecast",
  CENARIO: "Scenario",
};
export function rotuloNaturezaIdioma(natureza: string, rotuloPt: string, idioma: Idioma): string {
  return idioma === "en" ? (NATUREZA_EN[natureza] ?? rotuloPt) : rotuloPt;
}
