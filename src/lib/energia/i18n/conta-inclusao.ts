import { createElement, type ComponentType, type ReactNode } from "react";
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
  "distribuidora com tarifa B1 mais próxima da mediana nacional": "distribution utility with the B1 tariff closest to the national median",
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
  // regras do simulador (texto, aplicação, partes e motivos), como a gold as publica
  "Tarifa Social (Lei nº 12.212/2010, art. 1º, na redação da Lei nº 15.235/2025): desconto de 100% sobre a parcela do consumo até 80 kWh/mês e de 0% sobre a parcela acima de 80 kWh/mês, incidente sobre a tarifa da classe residencial. Beneficiários não pagam CDE nem Proinfa (página da ANEEL), por isso a ANEEL homologa uma tarifa própria da subclasse (Residencial Tarifa Social, faixas 01 e 02).":
    "Tarifa Social (Law 12,212/2010, art. 1, as worded by Law 15,235/2025): a 100% discount on the portion of consumption up to 80 kWh/month and 0% on the portion above 80 kWh/month, applied to the residential class tariff. Beneficiaries do not pay the CDE or Proinfa (ANEEL page), so ANEEL ratifies a tariff specific to the subclass (Residential Tarifa Social, bands 01 and 02).",
  "Faixa 01 (até 80 kWh): valor calculado com a tarifa da faixa 01 e abatido integralmente. Faixa 02 (acima de 80 kWh): tarifa homologada da faixa 02, sem desconto.":
    "Band 01 (up to 80 kWh): amount calculated with the band 01 tariff and fully deducted. Band 02 (above 80 kWh): ratified band 02 tariff, without discount.",
  "Desconto de 100% até 80 kWh/mês e de 0% acima, sobre a tarifa da classe residencial": "100% discount up to 80 kWh/month and 0% above, on the residential class tariff",
  "Tarifa própria da subclasse (faixas 01 e 02), porque beneficiários não pagam CDE nem Proinfa": "Tariff specific to the subclass (bands 01 and 02), because beneficiaries do not pay the CDE or Proinfa",
  "Desconto Social (Lei nº 10.438/2002, art. 13, § 3º-I, incluído pela Lei nº 15.235/2025): desde 1º/1/2026, famílias do CadÚnico com renda per capita acima de meio e até um salário mínimo têm isenção das quotas da CDE para consumo mensal de até 120 kWh, em uma unidade consumidora.":
    "Desconto Social (Law 10,438/2002, art. 13, § 3-I, added by Law 15,235/2025): since Jan 1, 2026, CadÚnico families with per capita income above half and up to one minimum wage are exempt from CDE quotas for monthly consumption of up to 120 kWh, in one consumer unit.",
  "Leitura por parcela, seguindo as faixas homologadas pela ANEEL (Residencial Desconto Social, faixas 01 e 02): até 120 kWh com a tarifa da faixa 01 e o excedente com a da faixa 02.":
    "Band-by-band reading, following the bands ratified by ANEEL (Residential Desconto Social, bands 01 and 02): up to 120 kWh at the band 01 tariff and the excess at the band 02 tariff.",
  "O texto da REN que regulamenta a aplicação não pôde ser lido (bloqueio de acesso ao acervo da ANEEL); por isso a leitura é declarada.":
    "The text of the REN that regulates the application could not be read (access to the ANEEL archive is blocked); that is why the reading is declared.",
  "Isenção das quotas da CDE até 120 kWh/mês desde 1º/1/2026": "Exemption from CDE quotas up to 120 kWh/month since Jan 1, 2026",
  "Aplicação por parcela: faixa 01 até 120 kWh e faixa 02 no excedente": "Band-by-band application: band 01 up to 120 kWh and band 02 on the excess",
  "a REN que regulamenta a aplicação não pôde ser lida (acervo da ANEEL bloqueado)": "the REN that regulates the application could not be read (ANEEL archive blocked)",
  "Custo de disponibilidade do grupo B: valor em reais equivalente a 30 kWh (monofásico), 50 kWh (bifásico) ou 100 kWh (trifásico), cobrado como valor mínimo quando o consumo é menor (páginas oficiais da ANEEL; a REN nº 1.000/2021 é a norma de origem, mas seu texto não pôde ser lido no acervo da ANEEL, que bloqueou o acesso automatizado).":
    "Group B availability cost: an amount in reais equivalent to 30 kWh (single-phase), 50 kWh (two-phase) or 100 kWh (three-phase), charged as a minimum when consumption is lower (ANEEL's official pages; REN 1,000/2021 is the source rule, but its text could not be read in the ANEEL archive, which blocked automated access).",
  "Classes residencial, rural, demais classes e Desconto Social: energia faturada = maior entre o consumo e o mínimo da ligação. Tarifa Social: sem mínimo até 80 kWh (página da ANEEL); acima de 80 kWh o mínimo não é aplicado, e isso é declarado como regra não conferida.":
    "Residential, rural, other classes and Desconto Social: billed energy = the greater of consumption and the connection minimum. Tarifa Social: no minimum up to 80 kWh (ANEEL page); above 80 kWh the minimum is not applied, and this is declared as an unchecked rule.",
  "Mínimo de 30, 50 ou 100 kWh (monofásico, bifásico, trifásico) nas classes residencial, rural, demais e Desconto Social":
    "Minimum of 30, 50 or 100 kWh (single-phase, two-phase, three-phase) in the residential, rural, other and Desconto Social classes",
  "Tarifa Social sem mínimo até 80 kWh, inclusive em ligação trifásica": "Tarifa Social with no minimum up to 80 kWh, including on three-phase connections",
  "Tarifa Social acima de 80 kWh: mínimo não aplicado": "Tarifa Social above 80 kWh: minimum not applied",
  "a REN nº 1.000/2021 não pôde ser lida; a regra do mínimo para a Tarifa Social acima de 80 kWh não foi conferida":
    "REN 1,000/2021 could not be read; the minimum rule for the Tarifa Social above 80 kWh was not checked",
  "Bandeira tarifária: acréscimo por kWh consumido conforme o patamar acionado no mês (verde sem acréscimo). Não se aplica a consumidores de sistemas isolados.":
    "Tariff flag: a surcharge per kWh consumed according to the level activated in the month (green with no surcharge). It does not apply to consumers in isolated systems.",
  "Adicional × kWh consumido. Tarifa Social: aplicado só sobre a parcela acima de 80 kWh, porque a ANEEL informa que, até 80 kWh, a fatura pode conter apenas cobranças não associadas à energia consumida; a regra específica da REN não foi lida.":
    "Surcharge × kWh consumed. Tarifa Social: applied only to the portion above 80 kWh, because ANEEL states that, up to 80 kWh, the bill may contain only charges not associated with the energy consumed; the specific REN rule was not read.",
  "Adicional por kWh consumido conforme o patamar do mês; não se aplica a sistemas isolados": "Surcharge per kWh consumed according to the month's level; does not apply to isolated systems",
  "Tarifa Social: bandeira só sobre a parcela acima de 80 kWh": "Tarifa Social: tariff flag only on the portion above 80 kWh",
  "leitura da página da ANEEL sobre a fatura até 80 kWh; a regra específica da REN não foi lida": "reading of ANEEL's page on the bill up to 80 kWh; the specific REN rule was not read",
  "Tributos (ICMS estadual, PIS/Pasep e Cofins federais) e Contribuição para Iluminação Pública municipal compõem a fatura mas não a tarifa homologada. Não há base oficial estruturada por distribuidora e mês com essas alíquotas efetivas; ficam fora de todos os números deste módulo.":
    "Taxes (state ICMS, federal PIS/Pasep and Cofins) and the municipal Public Lighting Contribution are part of the bill but not of the ratified tariff. There is no structured official database by distribution utility and month with these effective rates; they are left out of all numbers in this module.",
  "Não incluídos. O resultado é uma estimativa sem tributos e sem iluminação pública.": "Not included. The result is an estimate without taxes and without public lighting.",
  "Tributos e iluminação pública compõem a fatura, não a tarifa homologada": "Taxes and public lighting are part of the bill, not of the ratified tariff",
  // auditoria da página de tarifas: regras de leitura, critérios, licenças e arquivos
  "Contribuição para Iluminação Pública": "Public Lighting Contribution",
  "observatório, pelo código da componente (PRORET 7.1 não lido: acesso bloqueado); valor negativo em componente de custo listada em creditos.codigos vai para o grupo créditos":
    "observatory, by component code (PRORET 7.1 not read: access blocked); a negative value in a cost component listed in creditos.codigos goes to the credits group",
  "componente com sinal contrário à natureza do grupo de custo ou com módulo mais de 10 vezes a mediana da mesma componente entre as distribuidoras, com pelo menos 5% da tarifa":
    "component with a sign contrary to the nature of the cost group or with an absolute value more than 10 times the median of the same component across distribution utilities, with at least 5% of the tariff",
  "valor negativo na componente CFURH lido como crédito tarifário, provavelmente o repasse da repactuação da UBP (Lei nº 15.235/2025) às distribuidoras das áreas da Sudam e da Sudene; a regra de lançamento (PRORET) não pôde ser lida":
    "negative value in the CFURH component read as a tariff credit, probably the transfer from the UBP renegotiation (Law 15,235/2025) to the distribution utilities in the Sudam and Sudene areas; the booking rule (PRORET) could not be read",
  "valor igual repetido é ignorado; valor diferente para a mesma componente, vigência e ato: vale a última linha do arquivo, e o caso fica contado":
    "a repeated equal value is ignored; a different value for the same component, validity period and act: the last row of the file prevails, and the case is counted",
  "sinal contrário à natureza do grupo": "sign contrary to the nature of the group",
  "módulo mais de 10 vezes a mediana da componente entre as distribuidoras que a publicam":
    "absolute value more than 10 times the component's median across the distribution utilities that publish it",
  "mês com valor acima de 5 vezes a mediana dos outros meses do ano na mesma distribuidora e linha":
    "month with a value above 5 times the median of the other months of the year for the same distribution utility and row",
  "Não há base oficial estruturada com receita de fornecimento, energia e tributos que passe na conferência de atípicos: o SAMP, avaliado para isso, traz meses isolados com valores declarados com erro de ordem de grandeza, e o dicionário não define as linhas de DscDetalheMercado. Sem regra de tratamento validada contra fonte independente, a tarifa média e a carga tributária observada não são publicadas.":
    "There is no structured official database with supply revenue, energy and taxes that passes the outlier check: SAMP, assessed for this, has isolated months with values declared with an order-of-magnitude error, and the dictionary does not define the DscDetalheMercado rows. Without a treatment rule validated against an independent source, the average tariff and the observed tax burden are not published.",
  "Creative Commons Atribuição-SemDerivações 3.0 (CC BY-ND 3.0), conforme o rodapé do portal gov.br": "Creative Commons Attribution-NoDerivs 3.0 (CC BY-ND 3.0), per the gov.br portal footer",
  "Texto de lei, não protegido por direito autoral (Lei nº 9.610/1998, art. 8º, IV); reproduzido do portal da Câmara dos Deputados":
    "Text of law, not protected by copyright (Law 9,610/1998, art. 8, IV); reproduced from the Chamber of Deputies portal",
  "Subsídios Tarifários (ANEEL), mesmo CNPJ": "Tariff Subsidies (ANEEL), same CNPJ",
  "Tarifas B1 vigentes e custo por perfil (CSV)": "B1 tariffs in force and cost by profile (CSV)",
  "Histórico de tarifas de baixa tensão convencional (CSV)": "Conventional low-voltage tariff history (CSV)",
  "Histórico e mudanças da tarifa B1 por distribuidora (JSON)": "B1 tariff history and changes by distribution utility (JSON)",
  "Componentes da tarifa B1 (CSV)": "B1 tariff components (CSV)",
  "Mudanças da tarifa B1 e IPCA (CSV)": "B1 tariff changes and IPCA (CSV)",
  "Variação em 12, 60 e 120 meses e IPCA (CSV)": "Change over 12, 60 and 120 months and IPCA (CSV)",
  "Bandeiras por mês (CSV)": "Tariff flags by month (CSV)",
  "Subsídios tarifários por ano (CSV)": "Tariff subsidies by year (CSV)",
  "Custeio da CDE por rubrica (CSV)": "CDE funding by budget line (CSV)",
  "IPCA usado (CSV)": "IPCA used (CSV)",
  "Vigências sobrepostas na fonte e escolha feita (CSV)": "Overlapping validity periods in the source and the choice made (CSV)",
  "CNPJ único no ranking (crítica)": "Unique CNPJ in the ranking (critical)",
  "TE + TUSD positiva no ranking (crítica)": "Positive TE + TUSD in the ranking (critical)",
  "TE e TUSD não negativas (ressalva)": "Non-negative TE and TUSD (caveat)",
  "tarifa fora de 200 a 3000 R$/MWh (ressalva, conferir no arquivo)": "tariff outside 200 to 3000 R$/MWh (caveat, check in the file)",
  "data de referência não posterior à geração (crítica)": "reference date not later than generation (critical)",
  "adicional de bandeira não negativo (crítica)": "non-negative tariff flag surcharge (critical)",
  "número-índice do IPCA positivo (crítica)": "positive IPCA index number (critical)",
  "participações da composição entre -100% e 200% (ressalva)": "composition shares between -100% and 200% (caveat)",
  "grupo de custo da composição (energia, transmissão, distribuição, perdas, encargos) com soma negativa (ressalva)":
    "composition cost group (energy, transmission, distribution, losses, charges) with a negative sum (caveat)",
  "parcela CDE maior que o grupo de encargos que a contém (ressalva)": "CDE portion larger than the charges group that contains it (caveat)",
  "componente com sinal contrário à natureza do grupo de custo ou com módulo mais de 10 vezes a mediana da mesma componente, com pelo menos 5% da tarifa (ressalva, conferida no arquivo original)":
    "component with a sign contrary to the nature of the cost group or with an absolute value more than 10 times the median of the same component, with at least 5% of the tariff (caveat, checked in the original file)",
  "valor negativo de componente de custo reclassificado como crédito (ressalva, com a lista)": "negative value of a cost component reclassified as credit (caveat, with the list)",
  "incorporação registrada que não se confirma nos dados de tarifa (ressalva)": "recorded merger not confirmed in the tariff data (caveat)",
  "custeio da CDE com despesa igual à receita no ano (ressalva)": "CDE funding with expense equal to revenue in the year (caveat)",
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
  // o filho vai como terceiro argumento de createElement; o tipo do componente o declara opcional só para isso
  const Trecho = TrechoPortugues as ComponentType<{ regiao: string; como?: "span" | "div"; children?: ReactNode }>;
  return createElement(Trecho, { regiao, como }, texto);
}

/** Bandeira no idioma (string). */
export function bandeiraNoIdioma(b: string, idioma: Idioma): string {
  return idioma === "en" ? (BANDEIRAS[b] ?? b) : b;
}

/** dd/mm/aaaa → data inglesa ("Sep 30, 2026"), para as datas escritas dentro de um texto da gold. */
function dataTextoEn(d: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d);
  if (!m) return d;
  const meses = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${meses[Number(m[2]) - 1]} ${Number(m[1])}, ${m[3]}`;
}

/**
 * Motivo de uma distribuidora sem tarifa vigente, como a gold o escreve (três formas fixas, com CNPJ, sigla, ato e datas), em inglês.
 * Forma que não casa com nenhuma das três volta como veio (null): quem chama a marca como trecho só em português.
 */
export function motivoSemVigenteEn(m: string): string | null {
  const DATA = "(\\d{2}/\\d{2}/\\d{4})";
  let r = new RegExp(`^incorporada pela distribuidora de CNPJ (\\d{14}) \\(sigla atual ([^)]+)\\), (REA nº [\\d.]+/\\d{4})( \\(provável\\))?; a tarifa unificada começa em ${DATA}$`).exec(m);
  if (r) return `merged into the distribution utility with CNPJ ${r[1]} (current acronym ${r[2]}), ${r[3].replace("nº ", "")}${r[4] ? " (probable)" : ""}; the unified tariff starts on ${dataTextoEn(r[5])}`;
  r = new RegExp(`^sem tarifa publicada desde ${DATA}; o conjunto não informa o motivo \\(incorporação, extinção ou troca de CNPJ\\)$`).exec(m);
  if (r) return `no tariff published since ${dataTextoEn(r[1])}; the dataset does not give the reason (merger, extinction or change of CNPJ)`;
  r = new RegExp(`^vigência encerrada em ${DATA}; a tarifa seguinte ainda não consta no arquivo gerado pela ANEEL em ${DATA}$`).exec(m);
  if (r) return `validity ended on ${dataTextoEn(r[1])}; the next tariff is not yet in the file generated by ANEEL on ${dataTextoEn(r[2])}`;
  return null;
}
