import { createElement, type ReactNode } from "react";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import type { Idioma } from "@/lib/idioma";

/**
 * Inglês dos módulos Conta de luz e Inclusão energética: o tx preso a um idioma (para lib chamada por servidor e cliente) e as tabelas
 * exatas português → inglês dos rótulos que vêm das golds (`conta.json`, `inclusao.json`). A gold e o pipeline não mudam: a tela troca o
 * rótulo pelo inglês quando a tabela tem a entrada, e o valor sem entrada sai marcado como trecho só em português, nunca solto.
 */

/** tx preso a um idioma explícito: `const tx = txEm(idioma)` e depois `tx("pt", "en")`. */
export function txEm(idioma: Idioma): <T>(pt: T, en: T) => T {
  return <T,>(pt: T, en: T): T => (idioma === "en" ? en : pt);
}

/* ---------- Conta de luz ---------- */

/** Bandeiras tarifárias (nome oficial da ANEEL → tariff flag). */
const BANDEIRAS: Record<string, string> = {
  Verde: "Green",
  Amarela: "Yellow",
  "Vermelha P1": "Red P1",
  "Vermelha P2": "Red P2",
  "Escassez Hídrica": "Water Scarcity",
};

/** Categorias dos subsídios tarifários (conjunto Subsídios Tarifários da ANEEL). */
const CATEGORIAS_SUBSIDIO: Record<string, string> = {
  Rural: "Rural",
  "Irrigação e Aquicultura": "Irrigation and aquaculture",
  "Água-esgoto-saneamento": "Water, sewage and sanitation",
  "Consumidor Fonte Incentivada": "Consumer of incentivized sources",
  "Geração Fonte Incentivada": "Incentivized-source generation",
  Distribuidora: "Distribution utility",
  SCEE: "SCEE",
  "Lei 14.299/2022": "Law 14,299/2022",
};

/** Grupos da composição da tarifa (classificação do observatório pelo código da componente). */
const GRUPOS_COMPOSICAO: Record<string, string> = {
  "Energia comprada": "Purchased energy",
  "Transmissão e conexão": "Transmission and connection",
  "Distribuição (fio B)": "Distribution (wire B)",
  "Perdas e receitas irrecuperáveis": "Losses and unrecoverable revenue",
  "Encargos setoriais": "Sector charges",
  "Outros componentes e ajustes": "Other components and adjustments",
  "Créditos tarifários lançados em componente de custo": "Tariff credits booked in a cost component",
};

/** Descrição das componentes tarifárias (dicionário da ANEEL, como a gold publica). */
const DESCRICOES_COMPONENTE: Record<string, string> = {
  "Custo da energia comprada pela distribuidora": "Cost of energy purchased by the distribution utility",
  "Energia das usinas de Angra 1 e 2": "Energy from the Angra 1 and 2 plants",
  "Rede básica de transmissão": "Basic transmission grid",
  "Instalações de fronteira com a rede básica": "Border facilities with the basic grid",
  "Uso do sistema de outra distribuidora": "Use of another distribution utility's system",
  "Conexão às instalações de transmissão": "Connection to transmission facilities",
  "Conexão às instalações de distribuição": "Connection to distribution facilities",
  "TUSD de geração (transmissão)": "Generation TUSD (transmission)",
  "Transporte da energia de Itaipu": "Transport of Itaipu energy",
  "Uso da transmissão associado a Itaipu": "Transmission use associated with Itaipu",
  "Uso da transmissão (código TUST_CI da fonte)": "Transmission use (source code TUST_CI)",
  "Custo da própria distribuidora (fio B)": "The distribution utility's own cost (wire B)",
  "Perdas técnicas": "Technical losses",
  "Perdas não técnicas": "Non-technical losses",
  "Perdas na rede básica (parcela da TUSD)": "Basic grid losses (TUSD portion)",
  "Perdas na rede básica (parcela da TE)": "Basic grid losses (TE portion)",
  "Receitas irrecuperáveis": "Unrecoverable revenue",
  "Conta de Desenvolvimento Energético": "Energy Development Account",
  "CDE Conta Covid (TUSD)": "CDE Covid Account (TUSD)",
  Proinfa: "Proinfa",
  "Taxa de fiscalização (TFSEE)": "Inspection fee (TFSEE)",
  "Pesquisa e desenvolvimento e eficiência energética (TUSD)": "Research and development and energy efficiency (TUSD)",
  "Operador Nacional do Sistema": "National System Operator",
  "Reserva Global de Reversão": "Global Reversion Reserve",
  "Conta de Consumo de Combustíveis": "Fuel Consumption Account",
  "TUSD de geração (ONS)": "Generation TUSD (ONS)",
  "Encargos de serviços do sistema e de energia de reserva": "System service and reserve energy charges",
  "Compensação financeira pelo uso de recursos hídricos": "Financial compensation for the use of water resources",
  "Pesquisa e desenvolvimento e eficiência energética (TE)": "Research and development and energy efficiency (TE)",
  "CDE (código CDE_ELET da fonte)": "CDE (source code CDE_ELET)",
  "CDE (código CDE_GD da fonte)": "CDE (source code CDE_GD)",
  "CDE Conta Covid (TE)": "CDE Covid Account (TE)",
  "Subsídio (TUSD)": "Subsidy (TUSD)",
  "Subsídio (TE)": "Subsidy (TE)",
  "Benefício da Lei nº 14.299/2022 (TUSD)": "Benefit under Law 14,299/2022 (TUSD)",
  "Benefício da Lei nº 14.299/2022 (TE)": "Benefit under Law 14,299/2022 (TE)",
  "Efeito de decisão liminar (TUSD)": "Effect of an injunction (TUSD)",
  "Efeito de decisão liminar (TE)": "Effect of an injunction (TE)",
  "Outros (TUSD)": "Other (TUSD)",
};

/** Classes do simulador e subclasses das tarifas. */
const CLASSES_SIMULADOR: Record<string, string> = {
  "Residencial (B1)": "Residential (B1)",
  "Residencial Tarifa Social (baixa renda)": "Residential Tarifa Social (low income)",
  "Residencial Desconto Social": "Residential Desconto Social",
  "Rural (B2)": "Rural (B2)",
  "Demais classes em baixa tensão (B3: comercial, industrial e outras)": "Other low-voltage classes (B3: commercial, industrial and others)",
  Residencial: "Residential",
  "Residencial Tarifa Social – faixa 01": "Residential Tarifa Social, band 01",
  "Residencial Tarifa Social – faixa 02": "Residential Tarifa Social, band 02",
  "Residencial Desconto Social – faixa 01": "Residential Desconto Social, band 01",
  "Residencial Desconto Social – faixa 02": "Residential Desconto Social, band 02",
  "Não se aplica": "Not applicable",
  "Baixa Renda": "Low income",
  "Cooperativa de eletrificação rural": "Rural electrification cooperative",
  "Serviço público de irrigação rural": "Public rural irrigation service",
};

/** Grupos do orçamento da CDE. */
const GRUPOS_CDE: Record<string, string> = {
  "Tarifa Social (baixa renda)": "Tarifa Social (low income)",
  "Descontos tarifários a categorias de usuários": "Tariff discounts to user categories",
  "CCC e Luz para Todos": "CCC and Luz para Todos",
  "Outras despesas": "Other expenses",
  "Quotas da CDE": "CDE quotas",
  "Outras receitas": "Other revenue",
  Despesa: "Expense",
  Receita: "Revenue",
};

/** Rubricas do orçamento da CDE (nome publicado pela ANEEL). */
const RUBRICAS_CDE: Record<string, string> = {
  "CAFT CCEE": "CAFT CCEE",
  CCC: "CCC",
  "CDE Eletrobras - Lei 14.182": "CDE Eletrobras, Law 14,182",
  "Carvão Mineral": "Mineral coal",
  "Indenização das Concessões": "Concession indemnities",
  "Programa Luz para Todos - PLPT": "Luz para Todos program (PLPT)",
  "Restos a Pagar": "Outstanding payables",
  "Subsídio Baixa Renda": "Low-income subsidy",
  "Subsídio Consumidor Fonte Incentivada": "Subsidy, consumer of incentivized sources",
  "Subsídio Distribuidora": "Subsidy, distribution utility",
  "Subsídio Fonte Incentivada (Transmissoras)": "Subsidy, incentivized sources (transmission companies)",
  "Subsídio GD - Lei 14.300": "Distributed generation subsidy, Law 14,300",
  "Subsídio Geração Fonte Incentivada": "Subsidy, incentivized-source generation",
  "Subsídio Irrigação e Aquicultura": "Subsidy, irrigation and aquaculture",
  "Subsídio Rural": "Subsidy, rural",
  "Subsídio Água-esgoto-saneamento": "Subsidy, water, sewage and sanitation",
  "Subvenção Cooperativa": "Cooperative grant",
  "Subvenção RTE": "RTE grant",
  "Verba MME": "MME funds",
  "Aporte Eletrobras - Lei 14.182": "Eletrobras contribution, Law 14,182",
  Multas: "Fines",
  "Outras Disponibilidades": "Other available funds",
  "Quotas CDE - GD": "CDE quotas, distributed generation",
  "Quotas CDE Energia": "CDE quotas, energy",
  "Quotas CDE Uso": "CDE quotas, use",
  RGR: "RGR",
  "Recursos da União": "Federal funds",
  "Saldo Anterior": "Previous balance",
  "Uso de Bem Público - UBP": "Use of public assets (UBP)",
};

/** Definições e regras curtas da gold de Conta de luz que a tela mostra no caminho principal. */
const PROSA_CONTA: Record<string, string> = {
  "TE + TUSD de aplicação publicadas na resolução homologatória da ANEEL, em R$/MWh, sem tributos e sem bandeira.":
    "Applied TE + TUSD published in ANEEL's ratifying resolution, in R$/MWh, without taxes and without the tariff flag.",
  "Valores usados estritamente no cálculo tarifário (dicionário da ANEEL); a diferença para a tarifa de aplicação são os componentes financeiros do processo.":
    "Values used strictly in the tariff calculation (ANEEL dictionary); the difference from the applied tariff is the financial components of the process.",
  "Receita de fornecimento dividida pela energia vendida. Não é calculada neste módulo.":
    "Supply revenue divided by energy sold. It is not calculated in this module.",
  "Estimativa do valor da energia na fatura para um consumo informado, com as regras declaradas, sem tributos e sem iluminação pública.":
    "Estimate of the energy amount on the bill for a given consumption, with the declared rules, without taxes and without public lighting.",
  "Consumo mensal de referência escolhido pelo observatório (100, 200 e 300 kWh) para comparar distribuidoras; não é consumo médio.":
    "Monthly reference consumption chosen by the observatory (100, 200 and 300 kWh) to compare distribution utilities; it is not average consumption.",
  "PLD vezes consumo não é conta de luz; a diferença entre PLD e tarifa não é margem da distribuidora.":
    "PLD times consumption is not an electricity bill; the difference between the PLD and the tariff is not the distribution utility's margin.",
  "TE e TUSD iguais a zero na mesma linha significam tarifa não homologada para a subclasse (a fonte publica ',00'); o valor não entra em comparação.":
    "TE and TUSD both equal to zero on the same row mean a tariff not ratified for the subclass (the source publishes ',00'); the value is not compared.",
  "Só entram linhas com unidade MWh (R$/MWh); linha em kW (demanda) fica fora e é contada.":
    "Only rows in MWh (R$/MWh) are used; rows in kW (demand) are left out and counted.",
  "Vence a vigência de início mais recente; empate, o ato mais recente; empate, a vigência mais curta.":
    "The validity period with the latest start prevails; on a tie, the latest act; on a further tie, the shortest validity period.",
  "Estimativa sem tributos (ICMS, PIS/Pasep e Cofins) e sem contribuição de iluminação pública.":
    "Estimate without taxes (ICMS, PIS/Pasep and Cofins) and without the public lighting contribution.",
  "total = Σ faixas (kWh da faixa × (TE + TUSD) da faixa ÷ 1000) − descontos + kWh sujeitos à bandeira × adicional ÷ 1000":
    "total = Σ bands (band kWh × band (TE + TUSD) ÷ 1000) − discounts + kWh subject to the tariff flag × surcharge ÷ 1000",
  "distribuidora com tarifa B1 mais próxima da mediana": "distribution utility with the B1 tariff closest to the median",
  "Variação da tarifa B1 residencial de aplicação entre vigências; não é o efeito médio do processo tarifário.":
    "Change in the applied residential B1 tariff between validity periods; it is not the average effect of the tariff process.",
  "Desconto tarifário da classe rural.": "Tariff discount for the rural class.",
  "Desconto ao consumo de irrigação e aquicultura em horário especial (8h30 diárias, Lei nº 10.438/2002, art. 25).":
    "Discount on irrigation and aquaculture consumption during special hours (8.5 hours a day, Law 10,438/2002, art. 25).",
  "Desconto ao serviço público de água, esgoto e saneamento.": "Discount for the public water, sewage and sanitation service.",
  "Desconto na tarifa de uso de consumidores que compram energia de fonte incentivada.":
    "Discount on the use-of-system tariff for consumers who buy energy from incentivized sources.",
  "Desconto na tarifa de uso de geradores de fonte incentivada.": "Discount on the use-of-system tariff for incentivized-source generators.",
  "Desconto a distribuidora com mercado próprio inferior a 500 GWh/ano.": "Discount for distribution utilities with their own market below 500 GWh/year.",
  "Categoria ligada ao Sistema de Compensação de Energia Elétrica da micro e minigeração distribuída (Lei nº 14.300/2022); o dicionário não detalha a regra de cálculo.":
    "Category linked to the Electric Energy Compensation System of distributed micro and mini generation (Law 14,300/2022); the dictionary does not detail the calculation rule.",
  "Subvenção prevista na Lei nº 14.299/2022, cuja ementa trata de subvenção econômica às concessionárias de distribuição de pequeno porte.":
    "Grant provided for in Law 14,299/2022, whose summary addresses an economic grant to small distribution concession holders.",
  "Os valores são repasses da CDE às distribuidoras para compensar descontos tarifários concedidos a categorias de usuários. Não são transferências a famílias. A Tarifa Social (baixa renda) é custeada pela CDE por outra rubrica e não integra este conjunto.":
    "The values are CDE transfers to distribution utilities to offset tariff discounts granted to user categories. They are not transfers to families. The Tarifa Social (low income) is funded by the CDE under another budget line and is not part of this dataset.",
  "orçamento anual aprovado ou previsto pela ANEEL (não é execução)": "annual budget approved or forecast by ANEEL (not execution)",
};

/* ---------- Inclusão energética ---------- */

/** Rótulos curtos e categorias da gold de Inclusão energética (preenchida pelos componentes do módulo). */
const PROSA_INCLUSAO: Record<string, string> = {};

const TABELAS: Record<string, Record<string, string>> = {
  bandeira: BANDEIRAS,
  categoriaSubsidio: CATEGORIAS_SUBSIDIO,
  grupoComposicao: GRUPOS_COMPOSICAO,
  descricaoComponente: DESCRICOES_COMPONENTE,
  classe: CLASSES_SIMULADOR,
  grupoCde: GRUPOS_CDE,
  rubricaCde: RUBRICAS_CDE,
  conta: PROSA_CONTA,
  inclusao: PROSA_INCLUSAO,
};

/** Todas as tabelas juntas: um rótulo da gold tem uma única forma inglesa, venha de onde vier. */
const TODAS: Record<string, string> = Object.assign({}, ...Object.values(TABELAS));

/** O inglês exato de um texto da gold, ou null quando a tabela não o tem. */
export function dadoEn(texto: string | null | undefined): string | null {
  if (!texto) return null;
  return TODAS[texto] ?? null;
}

/**
 * Texto da gold no idioma da página, como string (para atributo, rótulo de coluna, legenda de gráfico, CSV): o inglês da tabela, ou o
 * próprio texto quando não há entrada. Em português devolve sempre o texto.
 */
export function dadoTexto(texto: string, idioma: Idioma): string {
  if (idioma !== "en") return texto;
  return dadoEn(texto) ?? texto;
}

/**
 * Texto da gold como nó: em português, o texto; em inglês, a forma da tabela ou, sem entrada, o texto marcado como trecho só em
 * português (aviso visível e lang="pt-BR"), nunca português solto.
 */
export function dadoNo(texto: string | null | undefined, regiao: string, idioma: Idioma, como: "span" | "div" = "span"): ReactNode {
  if (texto === null || texto === undefined || texto === "") return texto ?? null;
  if (idioma !== "en") return texto;
  const en = dadoEn(texto);
  if (en !== null) return en;
  return createElement(TrechoPortugues, { regiao, como }, texto);
}

/** Bandeira no idioma (string). */
export function bandeiraNoIdioma(b: string, idioma: Idioma): string {
  return idioma === "en" ? (BANDEIRAS[b] ?? b) : b;
}
