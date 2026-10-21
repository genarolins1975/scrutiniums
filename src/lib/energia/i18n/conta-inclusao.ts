import { createElement, Fragment, type ComponentType, type ReactNode } from "react";
import { Nome } from "@/components/i18n/Nome";
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
    "Discount on irrigation and aquaculture consumption during special hours (8 hours 30 minutes a day, Law 10,438/2002, art. 25).",
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
    "Desconto Social (Law 10,438/2002, art. 13, § 3-I, added by Law 15,235/2025): since Jan 1, 2026, Cadastro Único families with per capita income above half and up to one minimum wage are exempt from CDE quotas for monthly consumption of up to 120 kWh, in one consumer unit.",
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
  // página de reajustes, bandeiras e subsídios
  "o IBGE publica a variação com duas casas decimais; a razão de índices de duas casas pode diferir no arredondamento":
    "IBGE publishes the change with two decimal places; the ratio of two-decimal indices may differ in rounding",
  confirmada: "confirmed",
  aprovado: "approved",
  "previsto (consulta pública)": "forecast (public consultation)",
  "Rubrica 'Subsídio Baixa Renda': valor do orçamento aprovado da CDE para os descontos da Tarifa Social de Energia Elétrica, que chegam às famílias beneficiárias como desconto na fatura (dicionário do conjunto).":
    "Budget line 'Subsídio Baixa Renda' (low-income subsidy): amount of the approved CDE budget for the Tarifa Social discounts, which reach beneficiary families as a discount on the bill (dataset dictionary).",
  "Demais rubricas 'Subsídio ...' do orçamento aprovado: compensam distribuidoras e transmissoras por descontos concedidos a categorias (rural, irrigação e aquicultura, água e esgoto, fontes incentivadas, distribuidoras pequenas, micro e minigeração distribuída). Não são transferências a famílias.":
    "Other 'Subsídio ...' budget lines of the approved budget: they compensate distribution utilities and transmission companies for discounts granted to categories (rural, irrigation and aquaculture, water and sewage, incentivized sources, small distribution utilities, distributed micro and mini generation). They are not transfers to families.",
  "Rubricas 'CCC' (Conta de Consumo de Combustíveis) e 'Programa Luz para Todos - PLPT', com o nome publicado.":
    "Budget lines 'CCC' (Fuel Consumption Account) and 'Programa Luz para Todos - PLPT', with the published name.",
  "Demais rubricas de despesa com o nome publicado pela ANEEL (carvão mineral, subvenções, indenizações, restos a pagar e outras).":
    "Other expense budget lines with the name published by ANEEL (mineral coal, grants, indemnities, outstanding payables and others).",
  "Rubricas 'Quotas CDE Uso', 'Quotas CDE Energia' e 'Quotas CDE - GD' do orçamento aprovado: encargo cobrado nas tarifas, fixado para cobrir o que as demais receitas não cobrem (as componentes com CDE no código aparecem dentro da TUSD e da TE no conjunto de componentes tarifárias).":
    "Budget lines 'Quotas CDE Uso', 'Quotas CDE Energia' and 'Quotas CDE - GD' of the approved budget: a charge collected in the tariffs, set to cover what the other revenues do not (the components with CDE in the code appear within the TUSD and the TE in the tariff components dataset).",
  "Demais rubricas de receita com o nome publicado (uso de bem público, multas, recursos da União, aportes previstos em lei, saldo anterior e outras disponibilidades).":
    "Other revenue budget lines with the published name (use of public assets, fines, federal funds, contributions provided for by law, previous balance and other available funds).",
  "As rubricas de desconto do custeio da CDE e as categorias do conjunto de subsídios tarifários não coincidem em valor: um traz o valor anual da conta por rubrica, o outro os repasses mensais homologados por distribuidora. Os dois não se somam.":
    "The discount budget lines of the CDE funding and the categories of the tariff subsidies dataset do not match in value: one gives the account's annual amount by budget line, the other the ratified monthly transfers by distribution utility. The two do not add up.",
  "Orçamento anual da CDE por rubrica, como publicado pela ANEEL: valores aprovados ou previstos, não o que foi efetivamente gasto. A despesa é igual à receita em todos os anos porque a quota anual é fixada para cobrir a diferença entre a necessidade de recursos da conta e as demais fontes (página Gestão de Recursos Tarifários da ANEEL), e os totais conferem com os orçamentos divulgados pela ANEEL (reconciliacao_externa). A Tarifa Social (baixa renda) é custeada aqui e não aparece no conjunto de subsídios tarifários, que trata só dos descontos a categorias de usuários.":
    "Annual CDE budget by budget line, as published by ANEEL: approved or forecast amounts, not what was actually spent. Expense equals revenue in every year because the annual quota is set to cover the difference between the account's funding needs and the other sources (ANEEL's Gestão de Recursos Tarifários page), and the totals match the budgets announced by ANEEL (reconciliacao_externa). The Tarifa Social (low income) is funded here and does not appear in the tariff subsidies dataset, which covers only discounts to user categories.",
  "títulos das notícias oficiais da ANEEL lidos no índice de busca em 30/09/2026; o corpo das páginas exige autenticação no gov.br (conteúdo restrito durante o defeso eleitoral) e não foi guardado no bronze":
    "titles of ANEEL's official news read from the search index on Sep 30, 2026; the body of the pages requires gov.br authentication (content restricted during the electoral blackout period) and was not stored in the bronze layer",
  "O efeito médio de cada processo tarifário (todas as classes) e o calendário dos processos são publicados em calculostarifarios.aneel.gov.br e git.aneel.gov.br, que responderam 403 com desafio de navegador (Cloudflare) em 30/09/2026; não há recurso equivalente no portal de dados abertos. O módulo mostra a variação da tarifa B1 residencial, que é outra medida.":
    "The average effect of each tariff process (all classes) and the process calendar are published at calculostarifarios.aneel.gov.br and git.aneel.gov.br, which responded 403 with a browser challenge (Cloudflare) on Sep 30, 2026; there is no equivalent resource on the open data portal. The module shows the change in the residential B1 tariff, which is a different measure.",
};

/* ---------- Inclusão energética ---------- */

/** Rótulos curtos, categorias e regras da gold de Inclusão energética (`inclusao.json`). */
const PROSA_INCLUSAO: Record<string, string> = {
  // classes de rendimento da POF 2017-2018 (valores de 15/01/2018)
  Total: "Total",
  "Até R$ 1.908": "Up to R$ 1,908",
  "Mais de R$ 1.908 a R$ 2.862": "More than R$ 1,908 to R$ 2,862",
  "Mais de R$ 2.862 a R$ 5.724": "More than R$ 2,862 to R$ 5,724",
  "Mais de R$ 5.724 a R$ 9.540": "More than R$ 5,724 to R$ 9,540",
  "Mais de R$ 9.540 a R$ 14.310": "More than R$ 9,540 to R$ 14,310",
  "Mais de R$ 14.310 a R$ 23.850": "More than R$ 14,310 to R$ 23,850",
  "Mais de R$ 23.850": "More than R$ 23,850",
  // medidas da POF
  "Despesa média com energia elétrica (R$ por família e mês)": "Average electricity expense (R$ per family per month)",
  "Despesa total média (R$ por família e mês)": "Average total expense (R$ per family per month)",
  "Razão de médias: energia ÷ despesa total (%)": "Ratio of averages: energy ÷ total expense (%)",
  "Média das participações da energia na despesa de cada família (%)": "Average share of energy in each family's expense (%)",
  "Média das participações da energia na renda de cada família (%)": "Average share of energy in each family's income (%)",
  "Mediana da participação na despesa (%)": "Median share in expense (%)",
  "Mediana da participação na renda (%)": "Median share in income (%)",
  "Famílias sem despesa com energia elétrica (%)": "Families without electricity expense (%)",
  "Famílias com energia acima de 3% da renda (%)": "Families with energy above 3% of income (%)",
  "Famílias com energia acima de 3% da despesa total (%)": "Families with energy above 3% of total expense (%)",
  "Famílias com energia acima de 5% da renda (%)": "Families with energy above 5% of income (%)",
  "Famílias com energia acima de 5% da despesa total (%)": "Families with energy above 5% of total expense (%)",
  "Famílias com energia acima de 10% da renda (%)": "Families with energy above 10% of income (%)",
  "Famílias com energia acima de 10% da despesa total (%)": "Families with energy above 10% of total expense (%)",
  "POF 2017-2018 (valores de 15/01/2018)": "POF 2017-2018 (values as of Jan 15, 2018)",
  // faixas de consumo e eventos da Tarifa Social
  "até 30 kWh": "up to 30 kWh",
  "31 a 50 kWh": "31 to 50 kWh",
  "51 a 100 kWh": "51 to 100 kWh",
  "101 a 220 kWh": "101 to 220 kWh",
  "acima de 220 kWh": "above 220 kWh",
  "Concessão automática (Lei nº 14.203/2021)": "Automatic granting (Law 14,203/2021)",
  "Gratuidade até 80 kWh (MPV nº 1.300/2025)": "Free of charge up to 80 kWh (Provisional Measure 1,300/2025)",
  "A ANEEL informa que a Tarifa Social é concedida automaticamente desde janeiro de 2022 a quem tem direito e é titular da conta.":
    "ANEEL states that the Tarifa Social has been granted automatically since January 2022 to those entitled who hold the account.",
  "Faturas emitidas a partir de 5 de julho de 2025 têm desconto de 100% até 80 kWh por mês e nenhum desconto acima disso, segundo a ANEEL.":
    "Bills issued from July 5, 2025 have a 100% discount up to 80 kWh a month and no discount above that, according to ANEEL.",
  // Luz para Todos
  "Luz para Todos: rural": "Luz para Todos: rural",
  "Luz para Todos: regiões remotas da Amazônia Legal": "Luz para Todos: remote regions of the Legal Amazon",
  "Recurso da distribuidora": "Distribution utility funds",
  // elegibilidade da Tarifa Social (Cobertura)
  "Família inscrita no Cadastro Único com renda familiar mensal por pessoa de até meio salário mínimo.":
    "Family registered in the Cadastro Único (federal social registry) with monthly family income per person of up to half a minimum wage.",
  "Idoso com 65 anos ou mais ou pessoa com deficiência que recebe o BPC.": "Person aged 65 or older or person with a disability who receives the BPC (continuous cash benefit).",
  "Família no Cadastro Único com renda de até 3 salários mínimos e morador que depende de equipamento elétrico para tratamento de saúde.":
    "Family in the Cadastro Único with income of up to 3 minimum wages and a resident who depends on electrical equipment for health treatment.",
  "Cadastro Único atualizado nos últimos 2 anos.": "Cadastro Único record updated in the last 2 years.",
  "Uma única UC por família, residencial.": "A single residential consumer unit per family.",
  "Endereço do cadastro na área da distribuidora.": "Registered address within the distribution utility's area.",
  "Concessão automática desde janeiro de 2022 quando um membro da família é titular da conta.": "Automatic granting since January 2022 when a family member holds the account.",
  "O numerador inclui beneficiários pelos critérios II e III, que não estão (ou não estão todos) no denominador; por isso a razão pode passar de 100%.":
    "The numerator includes beneficiaries under criteria II and III, who are not (or not all) in the denominator; that is why the ratio can exceed 100%.",
  "O município da fatura é o da UC; o do Cadastro Único é o da residência declarada.": "The municipality of the bill is that of the consumer unit; that of the Cadastro Único is that of the declared residence.",
  "Famílias sem acesso à rede elétrica estão no denominador e não podem estar no numerador.": "Families without access to the electricity grid are in the denominator and cannot be in the numerator.",
  "Denominador com todas as famílias cadastradas (limite inferior da razão) e só com as atualizadas (limite superior): não é intervalo estatístico, é sensibilidade à definição do denominador.":
    "Denominator with all registered families (lower bound of the ratio) and with only the updated ones (upper bound): it is not a statistical interval, it is sensitivity to the denominator definition.",
  // custeio da Tarifa Social na CDE
  "O conjunto não distingue valor orçado de valor executado; o ano em curso só pode ser valor orçado.":
    "The dataset does not distinguish budgeted from executed values; the current year can only be a budgeted value.",
  "Os valores anuais da CDE não coincidem com a soma da DMR do SCS: a CDE registra o ano de referência do orçamento e dos repasses, o SCS a competência do desconto.":
    "The annual CDE values do not match the sum of the SCS monthly revenue difference (DMR): the CDE records the reference year of the budget and transfers, the SCS the accrual month of the discount.",
  "Valores nominais, sem correção pela inflação.": "Nominal values, without inflation adjustment.",
  // arquivos para baixar
  "Tarifa Social: série mensal nacional (SCS)": "Tarifa Social: national monthly series (SCS)",
  "Tarifa Social por distribuidora e mês (SCS)": "Tarifa Social by distribution utility and month (SCS)",
  "Tarifa Social: faturas e desconto por mês e UF (Beneficiários da CDE)": "Tarifa Social: bills and discount by month and state (CDE Beneficiaries)",
  "Municípios: faturas com Tarifa Social e Cadastro Único (proxy)": "Municipalities: bills with Tarifa Social and Cadastro Único (proxy)",
  "Cobertura potencial nacional por mês (proxy)": "National potential coverage by month (proxy)",
  "Série antiga da ANEEL por região (descontinuada)": "ANEEL's old series by region (discontinued)",
  "CDE: custeio anual por rubrica": "CDE: annual funding by budget line",
  "POF 2017-2018: energia no orçamento das famílias": "POF 2017-2018: energy in family budgets",
  "PNAD Contínua: acesso à energia elétrica": "Continuous PNAD: access to electricity",
  "Tarifa Social: faturas e desconto por mês e UF (JSON do gráfico)": "Tarifa Social: bills and discount by month and state (chart JSON)",
  "Cobertura potencial nacional por mês (JSON do gráfico, proxy)": "National potential coverage by month (chart JSON, proxy)",
  "Sistemas isolados: localidades do ciclo mais recente (JSON do mapa)": "Isolated systems: localities of the latest cycle (map JSON)",
  "Luz para Todos: domicílios atendidos por UF e mês": "Luz para Todos: households served by state and month",
  "Luz para Todos: domicílios atendidos por município e ano": "Luz para Todos: households served by municipality and year",
  "Luz para Todos: recursos por contrato": "Luz para Todos: funds by contract",
  "Sistemas isolados: localidades (PASI)": "Isolated systems: localities (PASI)",
  // regra de elegibilidade (base legal, vigência e o primeiro motivo da proxy)
  "Lei nº 12.212/2010, Lei nº 10.438/2002, Portaria Interministerial MME/MS nº 630/2011; REN ANEEL nº 1.000/2021 (arts. 176 a 179 e 200); MPV nº 1.300/2025 (desconto a partir de 05/07/2025).":
    "Law 12,212/2010, Law 10,438/2002, MME/MS Interministerial Ordinance 630/2011; ANEEL Normative Resolution (REN) 1,000/2021 (arts. 176 to 179 and 200); Provisional Measure (MPV) 1,300/2025 (discount from Jul 5, 2025).",
  "Os critérios de quem tem direito são os mesmos no período coberto pela comparação (a MPV nº 1.300/2025 mudou o tamanho do desconto, não o público); a verificação foi feita na página da ANEEL em 30/09/2026.":
    "The criteria for who is entitled are the same over the period covered by the comparison (Provisional Measure 1,300/2025 changed the size of the discount, not who receives it); the check was made on ANEEL's page on Sep 30, 2026.",
  "O numerador conta UC (SCS) ou faturas (CDE) com desconto; o denominador conta famílias. Uma família só pode ter o benefício em uma UC, mas pode não ser titular da conta (inquilino, conta em nome de terceiro, ligação compartilhada), e aí não aparece no numerador.":
    "The numerator counts consumer units (SCS) or bills (CDE) with a discount; the denominator counts families. A family can only have the benefit in one consumer unit, but may not hold the account (tenant, account in a third party's name, shared connection), and then it does not appear in the numerator.",
  // conferências e fontes tentadas do acesso (PASI e Luz para Todos)
  "Os atendimentos do Luz para Todos vêm do conjunto aberto do MME (domicílios atendidos por município e mês); os painéis Power BI da página de informações analíticas do MME não têm arquivo para download e não foram usados. O arquivo não traz uma categoria chamada Mais Luz para a Amazônia: os atendimentos em regiões remotas da Amazônia Legal aparecem como 'LPT - Regiões Remotas da Amazônia Legal'. Os valores anuais da CDE para o programa (custeio) e os recursos por contrato do MME são grandezas diferentes e não se somam.":
    "Luz para Todos services come from the MME open dataset (households served by municipality and month); the Power BI panels on the MME analytical information page have no downloadable file and were not used. The file has no category called Mais Luz para a Amazônia: services in remote regions of the Legal Amazon appear as 'LPT - Regiões Remotas da Amazônia Legal'. The annual CDE amounts for the program (funding) and the MME funds per contract are different quantities and do not add up.",
  "https://www.gov.br/mme/pt-br/assuntos/observatorio-de-minas-e-energia/energia-eletrica/outras-informacoes-analiticas (4 painéis Power BI, sem download)":
    "https://www.gov.br/mme/pt-br/assuntos/observatorio-de-minas-e-energia/energia-eletrica/outras-informacoes-analiticas (4 Power BI panels, no download)",
  "https://dadosabertos.aneel.gov.br (busca por 'universalização': nenhum conjunto)": "https://dadosabertos.aneel.gov.br (search for 'universalização': no dataset)",
  "https://dados.ons.org.br (busca por 'isolados': nenhum conjunto)": "https://dados.ons.org.br (search for 'isolados': no dataset)",
  "https://dadosabertos.mme.gov.br/dataset/luz-para-todos (integrado)": "https://dadosabertos.mme.gov.br/dataset/luz-para-todos (integrated)",
  "EPE, Planejamento do Atendimento aos Sistemas Isolados, Ciclo 2025 (caderno em PDF)": "EPE, Planejamento do Atendimento aos Sistemas Isolados (isolated systems service planning), Ciclo 2025 (PDF report)",
  aprovado: "passed",
  "localidades: igualdade; população: 0,0005 milhão de pessoas (o caderno escreve três casas decimais)":
    "localities: equality; population: 0.0005 million people (the report writes three decimal places)",
  // regras e conferências da Tarifa Social (modo Auditar)
  "Mês completo do SCS: pelo menos 90 distribuidoras informantes e nenhuma distribuidora esperada faltando. Esperada é a que já informou antes e volta a informar depois (lacuna) ou que informou em algum dos 3 últimos meses do arquivo; a que deixa de informar para sempre antes disso saiu do conjunto por incorporação e não torna o mês incompleto.":
    "Complete SCS month: at least 90 reporting distribution utilities and no expected utility missing. Expected is one that reported before and reports again later (a gap) or that reported in any of the last 3 months of the file; one that stops reporting for good before that left the set through a merger and does not make the month incomplete.",
  "Total residencial ausente, zero, menor que as UC com Tarifa Social ou mais de 25% distante da mediana dos 3 meses anteriores e 3 posteriores: a distribuidora sai das duas somas da participação naquele mês. Quando a distribuidora incorporou outra (incorporacoes), a mediana só usa meses do mesmo lado da incorporação: o novo patamar não é erro de dado.":
    "Residential total missing, zero, lower than the consumer units with Tarifa Social or more than 25% away from the median of the 3 previous and 3 following months: the distribution utility leaves both sums of the share in that month. When the utility merged another one (incorporacoes), the median only uses months on the same side of the merger: the new level is not a data error.",
  "Incorporação detectada no próprio SCS: distribuidora que informa pela última vez antes dos 3 últimos meses do arquivo e nunca volta, e sucessora cujo total residencial muda de patamar no mês seguinte (mediana dos 3 totais seguintes menos a dos 3 anteriores) em valor a até 25% do total residencial das que saíram, com salto de pelo menos 5% do patamar anterior.":
    "Merger detected in the SCS itself: a distribution utility that reports for the last time before the last 3 months of the file and never returns, and a successor whose residential total changes level in the following month (median of the 3 following totals minus that of the 3 previous ones) by an amount within 25% of the residential total of those that left, with a jump of at least 5% of the previous level.",
  "A lista de maiores diferenças SCS × CDE considera distribuidoras com 1.000 UC ou mais no SCS; as menores com diferença acima de ±2% aparecem em diferencas_distribuidoras_pequenas.":
    "The list of largest SCS × CDE differences considers distribution utilities with 1,000 consumer units or more in the SCS; smaller ones with a difference above ±2% appear in diferencas_distribuidoras_pequenas.",
  "Desconto líquido do mês: soma de VlrSubsidio das subclasses 3.2 a 3.6 nos tipos de faturamento 1 a 4; outras subclasses com SubsBaixaRenda ficam fora e são publicadas à parte.":
    "Net discount of the month: sum of VlrSubsidio for subclasses 3.2 to 3.6 in billing types 1 to 4; other subclasses with SubsBaixaRenda are left out and published separately.",
  "Competência em mais de um despacho: vale o de data de registro mais recente; os demais ficam listados como alternativos.":
    "Accrual month in more than one order: the one with the most recent registration date applies; the others are listed as alternatives.",
  "Arquivo mensal da CDE mais recente com cobertura de pelo menos 99,5% das UC do SCS no mês de conferência.":
    "Most recent monthly CDE file with coverage of at least 99.5% of the SCS consumer units in the check month.",
  "Mês da CDE sondado e rejeitado pela cobertura não guarda o original no bronze; publica só a cobertura e o motivo, sem contagens nem valores.":
    "A CDE month probed and rejected for coverage does not keep the original in the bronze layer; only the coverage and the reason are published, without counts or values.",
  "Código IBGE de 7 dígitos cujo prefixo de 6 dígitos está na lista de municípios do Cadastro Único (IBGE); outro código fica só no total nacional.":
    "7-digit IBGE code whose 6-digit prefix is in the Cadastro Único municipality list (IBGE); any other code stays only in the national total.",
  "±2% das contagens no total e em pelo menos 90% das distribuidoras; fora disso, ressalva com as maiores diferenças listadas. As duas bases contam coisas próximas mas não idênticas: UC informada no pedido de reembolso da DMR (SCS) versus faturas de faturamento com desconto no mês (CDE), que podem incluir faturas de outras referências e mais de uma fatura por UC. A lista maiores_diferencas traz só distribuidoras com 1.000 UC ou mais no SCS; as menores com diferença acima de ±2% ficam em diferencas_distribuidoras_pequenas, porque um percentual sobre poucas centenas de UC pesa pouco no total mas não deve sumir da conferência.":
    "±2% of the counts in the total and in at least 90% of the distribution utilities; outside that, a caveat with the largest differences listed. The two databases count similar but not identical things: consumer units reported in the DMR reimbursement request (SCS) versus billing invoices with a discount in the month (CDE), which may include invoices for other reference months and more than one invoice per consumer unit. The maiores_diferencas list only has utilities with 1,000 consumer units or more in the SCS; smaller ones with a difference above ±2% are in diferencas_distribuidoras_pequenas, because a percentage over a few hundred consumer units weighs little in the total but should not disappear from the check.",
  "Beneficiários da CDE (SCS sem sigla informada)": "CDE Beneficiaries (SCS without a reported acronym)",
  "laço de redirecionamento: o recurso aponta para a própria URL": "redirect loop: the resource points to its own URL",
  // perguntas dos quatro painéis
  "Onde e quanto a Tarifa Social alcança?": "Where and how far does the Tarifa Social reach?",
  "Quem pode estar ficando de fora?": "Who may be left out?",
  "Para quem a energia pesa mais?": "For whom does energy weigh the most?",
  "Quem ainda precisa de acesso adequado?": "Who still needs adequate access?",
  // unidade e conferência da POF
  "R$ por família e mês (15/01/2018)": "R$ per family per month (Jan 15, 2018)",
  "meio centavo: o IBGE publica em reais com duas casas": "half a cent: IBGE publishes in reais with two decimal places",
  "0,05 ponto percentual: o IBGE publica a distribuição com uma casa": "0.05 percentage point: IBGE publishes the distribution with one decimal place",
  "comparação informativa: o IBGE calcula o CV com a calibração dos pesos por pós-estratos; aqui a linearização usa estrato e UPA sem refazer a calibração":
    "informative comparison: IBGE calculates the CV with the calibration of weights by post-strata; here the linearization uses stratum and PSU without redoing the calibration",
  // formato dos microdados da POF (nota da tabela de todas as medidas)
  "cada medida é [valor, coeficiente de variação em %, estado]; estado: publicado, cautela (CV de 15% a 30%), suprimido (CV acima de 30%, valor nulo), sem_erro_padrao (mediana), zero_na_amostra (nenhuma família da amostra; não prova zero na população), ausente. As UF trazem só as medidas de medidas_uf; todas as medidas e os erros-padrão estão em inclusao_pof.csv":
    "each measure is [value, coefficient of variation in %, status]; status: publicado (published), cautela (caution, CV from 15% to 30%), suprimido (suppressed, CV above 30%, null value), sem_erro_padrao (no standard error, median), zero_na_amostra (no family in the sample; does not prove zero in the population), ausente (absent). The states carry only the measures in medidas_uf; all measures and standard errors are in inclusao_pof.csv",
  // o que a Lei nº 15.235/2025 faz, como a linha do tempo da Regulação o resume (com CadÚnico já escrito por extenso)
  "mantém o desconto de 100% até 80 kWh por mês na Tarifa Social e, a partir de 1º de janeiro de 2026, isenta das quotas da CDE, até 120 kWh por mês e numa única unidade, as famílias do Cadastro Único com renda por pessoa acima de meio e até um salário mínimo.":
    "keeps the 100% discount up to 80 kWh per month in the Tarifa Social and, from January 1, 2026, exempts from the CDE quotas, up to 120 kWh per month and in a single consumer unit, Cadastro Único families with income per person above half and up to one minimum wage.",
};

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
  if (en !== null) return comNomes(en, idioma);
  // o filho vai como terceiro argumento de createElement; o tipo do componente o declara opcional só para isso
  const Trecho = TrechoPortugues as ComponentType<{ regiao: string; como?: "span" | "div"; children?: ReactNode }>;
  return createElement(Trecho, { regiao, como }, texto);
}

/**
 * Nomes próprios em português que a prosa inglesa dos dois módulos cita pelo nome oficial: pesquisas, cadastros, sistemas e conjuntos de
 * dados das fontes e as rubricas do orçamento da CDE como a ANEEL as publica. Na página inglesa, `comNomes` os marca com <Nome>.
 */
const NOMES_PROPRIOS = [
  "Pesquisa Nacional por Amostra de Domicílios (PNAD) Contínua", // i18n: dado
  "Pesquisa Nacional por Amostra de Domicílios", // i18n: dado
  "Pesquisa de Orçamentos Familiares", // i18n: dado
  "PNAD Contínua", // i18n: dado
  "Benefício de Prestação Continuada", // i18n: dado
  "Sistema de Controle de Subvenções e Programas Sociais", // i18n: dado
  "Portal de Acompanhamento e Informações dos Sistemas Isolados", // i18n: dado
  "Planejamento do Atendimento aos Sistemas Isolados", // i18n: dado
  "Beneficiários da Conta de Desenvolvimento Energético", // i18n: dado
  "Beneficiários da CDE", // i18n: dado
  "Tarifa Social de Energia Elétrica: Beneficiários", // i18n: dado
  "Gestão de Recursos Tarifários", // i18n: dado
  "Subsídio Baixa Renda", // i18n: dado
  "Subsídio ...", // i18n: dado
  "Programa Luz para Todos - PLPT", // i18n: dado
  "Quotas CDE Uso", // i18n: dado
  "Quotas CDE Energia", // i18n: dado
  "Quotas CDE - GD", // i18n: dado
  "CadÚnico", // i18n: dado
  "LPT - Regiões Remotas da Amazônia Legal", // i18n: dado
  // termo de busca digitado no portal da fonte, citado entre aspas
  "universalização", // i18n: dado
  // UF por extenso com acento ou palavra portuguesa (nome da unidade da federação, como a gold o publica)
  ...["Amapá", "Ceará", "Espírito Santo", "Goiás", "Maranhão", "Mato Grosso do Sul", "Pará", "Paraíba", "Paraná", "Piauí", "Rio de Janeiro", "Rio Grande do Norte"], // i18n: dado
  ...["Rio Grande do Sul", "Rondônia", "São Paulo"], // i18n: dado
].sort((a, b) => b.length - a.length);

/** Identificador de dado em caixa de cobra ("sem_erro_padrao", "OUTROS_RENDIMENTOS", "medidas_uf"): código, não prosa. */
const IDENTIFICADOR = /\b[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)+\b/g;

/**
 * Frase inglesa (string) com os nomes oficiais em português marcados: em inglês, cada nome da lista vira <Nome> e cada identificador de
 * dado em caixa de cobra vira <code>; em português, o texto volta como está. Nó que não é string passa sem mudança.
 */
export function comNomes(texto: ReactNode, idioma: Idioma): ReactNode {
  if (idioma !== "en" || typeof texto !== "string") return texto;
  const partes: ReactNode[] = [];
  let resto = texto;
  for (;;) {
    let melhor: { pos: number; trecho: string; codigo: boolean } | null = null;
    for (const n of NOMES_PROPRIOS) {
      const pos = resto.indexOf(n);
      if (pos >= 0 && (!melhor || pos < melhor.pos)) melhor = { pos, trecho: n, codigo: false };
    }
    IDENTIFICADOR.lastIndex = 0;
    const id = IDENTIFICADOR.exec(resto);
    if (id && (!melhor || id.index < melhor.pos)) melhor = { pos: id.index, trecho: id[0], codigo: true };
    if (!melhor) break;
    if (melhor.pos > 0) partes.push(resto.slice(0, melhor.pos));
    partes.push(
      melhor.codigo
        ? createElement("code", { key: partes.length, className: "font-sans" }, melhor.trecho)
        : createElement(Nome as ComponentType<{ children?: ReactNode }>, { key: partes.length }, melhor.trecho),
    );
    resto = resto.slice(melhor.pos + melhor.trecho.length);
  }
  if (!partes.length) return texto;
  if (resto) partes.push(resto);
  return createElement(Fragment, null, ...partes);
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

/* ---------- Links "Sua distribuidora" da página inicial ---------- */

/** Textos dos links por distribuidora que a página inicial passa em português (rótulo, rótulo com a escolha e avisos com {sigla}). */
const LINKS_DISTRIBUIDORA: Record<string, string> = {
  "Comparar as tarifas das distribuidoras": "Compare the distribution utilities' tariffs",
  "Ver a duração e a frequência das interrupções": "See the duration and frequency of interruptions",
  "Ver as perdas no mapa das distribuidoras": "See the losses on the distribution utilities map",
  "Ver a tarifa de {sigla} em Conta de luz": "See {sigla}'s tariff in Electricity bill",
  "Ver as interrupções de {sigla} em Qualidade": "See {sigla}'s interruptions in Quality of supply",
  "Ver as perdas de {sigla} em Perdas": "See {sigla}'s losses in Losses",
  "{sigla} não tem tarifa em vigor na data.": "{sigla} has no tariff in force on the date.",
};

/**
 * Texto de link ou aviso por distribuidora no idioma: a tabela exata, os avisos com ano por forma fixa e, sem entrada (texto que já
 * chega em inglês, ou novo), o próprio texto.
 */
export function linkDistribuidoraNoIdioma(texto: string, idioma: Idioma): string {
  if (idioma !== "en") return texto;
  const fixo = LINKS_DISTRIBUIDORA[texto];
  if (fixo) return fixo;
  let r = /^\{sigla\} não enviou DEC de (\d{4})\.$/.exec(texto);
  if (r) return `{sigla} did not submit DEC for ${r[1]}.`;
  r = /^\{sigla\} enviou só parte de (\d{4}) e não tem DEC anual\.$/.exec(texto);
  if (r) return `{sigla} submitted only part of ${r[1]} and has no annual DEC.`;
  r = /^\{sigla\} não tem dado de perdas em (\d{4})\.$/.exec(texto);
  if (r) return `{sigla} has no loss data for ${r[1]}.`;
  return texto;
}
