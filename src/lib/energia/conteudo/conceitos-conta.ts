import type { Conceito, FonteOficial } from "./conceitos";
import { montarNosDoisIdiomas, type TxIdioma } from "@/lib/energia/i18n/aprenda";

/**
 * Verbetes do módulo conta. Mesma regra da base (conceitos.ts): nenhuma definição de
 * memória; CONFERIDO só com o documento primário acessado na data indicada. Um
 * verbete com o slug de um verbete base o substitui.
 *
 * Fontes acessadas em 30/09/2026: a descrição do conjunto de tarifas no portal de
 * dados abertos da ANEEL (API package_show) e quatro páginas oficiais da ANEEL
 * capturadas pelo pipeline do módulo (bronze em data/energia/bronze/aneel/normas_conta,
 * com sha256 e trechos conferidos a cada captura). Cada trecho abaixo está, letra por
 * letra, no texto dessas páginas.
 */

function montarConceitos(tx: TxIdioma): Conceito[] {
  const TARIFAS_ANEEL: FonteOficial = {
    orgao: "ANEEL",
    documento: tx('Portal de dados abertos, conjunto "Tarifas de aplicação das distribuidoras de energia elétrica" (descrição oficial, acessada em 30/09/2026)', "Open data portal, dataset «Tarifas de aplicação das distribuidoras de energia elétrica» (official description, accessed on Sep 30, 2026)"),
    url: "https://dadosabertos.aneel.gov.br/dataset/tarifas-distribuidoras-energia-eletrica",
    trecho:
      // i18n: dado
      "Apresenta os valores das Tarifas de Energia - TE e das Tarifas de Uso do Sistema de Distribuição - TUSD, resultantes dos processos de reajustes tarifários das distribuidoras de energia elétrica.",
    parafrase: tx("Em outras palavras: a ANEEL publica, para cada distribuidora, os valores de TE e de TUSD que saem de cada processo tarifário.", "In other words: for each distribution utility, ANEEL publishes the TE and TUSD values that result from each tariff process."),
  };
  const CUSTO_ENERGIA: FonteOficial = {
    orgao: "ANEEL",
    documento: tx('Página "Custo da energia que chega aos consumidores" (capturada em 30/09/2026)', "Page «Custo da energia que chega aos consumidores» (captured on Sep 30, 2026)"),
    url: "https://www.gov.br/aneel/pt-br/assuntos/tarifas/entenda-a-tarifa/custo-da-energia-que-chega-aos-consumidores",
    trecho:
      // i18n: dado
      "A tarifa considera três custos distintos: Energia gerada + transporte de energia até as unidades consumidores (transmissão e distribuição) + encargos setoriais Além da tarifa, os Governos Federal, Estadual e Municipal cobram os seguintes tributos na conta de luz: PIS/COFINS, ICMS e Contribuição para Iluminação Pública (CIP), respectivamente.",
    parafrase:
      tx("Em outras palavras: a tarifa paga a energia, a transmissão, a distribuição e os encargos setoriais; PIS/Cofins, ICMS e a contribuição de iluminação pública são cobrados na conta além da tarifa.", "In other words: the tariff pays for energy, transmission, distribution and sector charges; PIS/Cofins, ICMS and the public lighting contribution are charged on the bill on top of the tariff."),
  };
  const BANDEIRAS: FonteOficial = {
    orgao: "ANEEL",
    documento: tx('Página "Sobre Bandeiras Tarifárias" (capturada em 30/09/2026)', "Page «Sobre Bandeiras Tarifárias» (captured on Sep 30, 2026)"),
    url: "https://www.gov.br/aneel/pt-br/assuntos/tarifas/bandeiras-tarifarias",
    trecho:
      // i18n: dado
      "Bandeiras tarifárias é o sistema que sinaliza aos consumidores os custos reais da geração de energia elétrica. [...] Todos os consumidores cativos das distribuidoras são faturados pelo Sistema de Bandeiras Tarifárias, com exceção daqueles localizados em sistemas isolados.",
    parafrase:
      tx("Em outras palavras: a cor da bandeira sinaliza o custo da geração, e todo consumidor atendido pela distribuidora paga conforme a bandeira, exceto nos sistemas isolados.", "In other words: the color of the flag signals the cost of generation, and every consumer served by the distribution utility pays according to the flag, except in isolated systems."),
  };
  const BANDEIRAS_VALORES: FonteOficial = {
    orgao: "ANEEL",
    documento: tx('Página "Sobre Bandeiras Tarifárias", seção "O que significa cada cor e quanto custa?" (capturada em 30/09/2026)', "Page «Sobre Bandeiras Tarifárias», section «O que significa cada cor e quanto custa?» (captured on Sep 30, 2026)"),
    url: "https://www.gov.br/aneel/pt-br/assuntos/tarifas/bandeiras-tarifarias",
    trecho:
      // i18n: dado
      "Bandeira verde: condições favoráveis de geração de energia. A tarifa não sofre nenhum acréscimo; Bandeira amarela: condições de geração menos favoráveis. A tarifa sofre acréscimo de R$ 0,01885 para cada quilowatt-hora (kWh) consumidos;",
  };
  const GERACAO_DISTRIBUIDA: FonteOficial = {
    orgao: "ANEEL",
    documento: tx('Página "Micro e Minigeração Distribuída" (capturada em 30/09/2026)', "Page «Micro e Minigeração Distribuída» (captured on Sep 30, 2026)"),
    url: "https://www.gov.br/aneel/pt-br/assuntos/geracao-distribuida",
    trecho:
      // i18n: dado
      "para unidades consumidoras conectadas em baixa tensão (grupo B), ainda que a energia injetada na rede seja superior ao consumo, será devido o pagamento referente ao custo de disponibilidade – valor em reais equivalente a 30 kWh (monofásico), 50 kWh (bifásico) ou 100 kWh (trifásico).",
    parafrase:
      tx("Em outras palavras: toda unidade de baixa tensão paga ao menos o equivalente a 30, 50 ou 100 kWh, conforme a ligação seja monofásica, bifásica ou trifásica, mesmo quando gera mais do que consome.", "In other words: every low-voltage unit pays at least the equivalent of 30, 50 or 100 kWh, depending on whether the connection is single-phase, two-phase or three-phase, even when it generates more than it consumes."),
  };
  const TARIFA_SOCIAL: FonteOficial = {
    orgao: "ANEEL",
    documento: tx('Página "Tarifa Social" (capturada em 30/09/2026)', "Page «Tarifa Social» (captured on Sep 30, 2026)"),
    url: "https://www.gov.br/aneel/pt-br/assuntos/tarifas/tarifa-social",
    // i18n: dado
    trecho: "mesmo no caso de instalações trifásicas, existirá a gratuidade no caso de consumo até 80 kWh no mês",
  };
  const CDE_ANEEL: FonteOficial = {
    orgao: "ANEEL",
    documento: tx('Página "Gestão de Recursos Tarifários", seção Conta de Desenvolvimento Energético (capturada em 30/09/2026)', "Page «Gestão de Recursos Tarifários», Energy Development Account section (captured on Sep 30, 2026)"),
    url: "https://www.gov.br/aneel/pt-br/assuntos/tarifas/gestao-de-recursos-tarifarios",
    trecho:
      // i18n: dado
      "A Conta de Desenvolvimento Energético (CDE) é um fundo setorial que tem como objetivo custear diversas políticas públicas do setor elétrico brasileiro, tais como: universalização do serviço de energia elétrica em todo o território nacional; concessão de descontos tarifários a diversos usuários do serviço (baixa renda, rural, atividade de irrigação e aquicultura em horário especial, serviço público de água, esgoto e saneamento, geração e consumo de energia de fonte incentivadas etc.);",
    parafrase:
      tx("Em outras palavras: a CDE é um fundo do setor elétrico que paga políticas públicas, entre elas levar energia a todo o território e os descontos na tarifa de grupos como baixa renda, rural, irrigação, saneamento e fontes incentivadas.", "In other words: the CDE is a power sector fund that pays for public policies, among them bringing electricity to the whole territory and the tariff discounts of groups such as low income, rural, irrigation, sanitation and incentivized sources."),
  };
  const CDE_QUOTAS: FonteOficial = {
    orgao: "ANEEL",
    documento: tx('Página "Gestão de Recursos Tarifários", seção Conta de Desenvolvimento Energético (capturada em 30/09/2026)', "Page «Gestão de Recursos Tarifários», Energy Development Account section (captured on Sep 30, 2026)"),
    url: "https://www.gov.br/aneel/pt-br/assuntos/tarifas/gestao-de-recursos-tarifarios",
    trecho:
      // i18n: dado
      "Os recursos da CDE são arrecadados principalmente das quotas anuais pagas por todos os agentes que comercializam energia elétrica com consumidor final. Isso é feito mediante encargo tarifário incluído nas tarifas de uso dos sistemas de distribuição e transmissão de energia, [...] Cabe à ANEEL aprovar o Orçamento Anual da CDE e fixar a quota anual, que deve corresponder à diferença entre a necessidade total de recursos da Conta e a arrecadação proporcionada pelas demais fontes.",
    parafrase:
      tx("Em outras palavras: a maior parte do dinheiro da CDE vem de quotas cobradas dentro das tarifas de uso da rede; a ANEEL aprova o orçamento anual e fixa a quota no valor que falta depois das outras receitas.", "In other words: most of the CDE money comes from quotas charged within the grid use tariffs; ANEEL approves the annual budget and sets the quota at the amount still missing after the other revenues."),
  };
  return [
    {
      slug: "tarifa-te-tusd",
      sigla: "TE e TUSD",
      nome: tx("Tarifa de Energia e Tarifa de Uso do Sistema de Distribuição", "Energy Tariff and Distribution System Use Tariff"),
      grupo: "Consumidor", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-09-30",
      emUmaFrase:
        tx("Os dois valores que a ANEEL publica para cada distribuidora como resultado dos processos tarifários: a Tarifa de Energia (TE) e a Tarifa de Uso do Sistema de Distribuição (TUSD). Juntas, cobrem a energia gerada, a transmissão, a distribuição e os encargos setoriais; os tributos são cobrados além delas.", "The two values ANEEL publishes for each distribution utility as the result of the tariff processes: the Energy Tariff (TE) and the Distribution System Use Tariff (TUSD). Together, they cover generated energy, transmission, distribution and sector charges; taxes are charged on top of them."),
      porQueImporta:
        tx("É a parte da conta de luz fixada pela ANEEL para cada área de concessão: o mesmo consumo custa diferente conforme a distribuidora. Comparar TE + TUSD da mesma classe e modalidade isola essa diferença dos tributos estaduais e municipais.", "It is the part of the electricity bill defined by ANEEL for each concession area: the same consumption costs differently depending on the distribution utility. Comparing TE + TUSD of the same class and modality isolates this difference from state and municipal taxes."),
      comoEMedido:
        tx("No conjunto de dados abertos da ANEEL, em reais por megawatt-hora (R$/MWh), por distribuidora, subgrupo, modalidade, classe, subclasse, posto e vigência; dividido por 1000, dá o valor por kWh.", "In ANEEL's open dataset, in reais per megawatt-hour (R$/MWh), by distribution utility, subgroup, modality, class, subclass, time slot and validity period; divided by 1000, it gives the value per kWh."),
      relacoes: ["bandeira-tarifaria", "cde", "custo-de-disponibilidade"],
      fontes: [TARIFAS_ANEEL, CUSTO_ENERGIA],
      limitacoes: [
        tx("TE e TUSD não incluem PIS/Cofins, ICMS nem a contribuição de iluminação pública, que entram na conta além da tarifa.", "TE and TUSD do not include PIS/Cofins, ICMS or the public lighting contribution, which enter the bill on top of the tariff."),
        tx("A tarifa homologada não é a tarifa média de fornecimento (receita dividida pela energia vendida), que depende do mercado de cada classe.", "The approved tariff is not the average supply tariff (revenue divided by energy sold), which depends on the market of each class."),
      ],
      vejaNoPortal: [
        { rotulo: tx("Tarifa B1 residencial por distribuidora", "Residential B1 tariff by distribution utility"), href: "/setor-eletrico/conta-de-luz#tarifa" },
        { rotulo: tx("Do que a tarifa é feita", "What the tariff is made of"), href: "/setor-eletrico/conta-de-luz#composicao" },
      ],
    },
    {
      slug: "bandeira-tarifaria",
      nome: tx("Bandeira tarifária", "Tariff flag"),
      grupo: "Consumidor", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-09-30",
      emUmaFrase:
        tx("Sistema da ANEEL que sinaliza aos consumidores o custo da geração de energia: a cor definida para o mês (verde, amarela ou vermelha em dois patamares) indica se há acréscimo por kWh consumido, e de quanto.", "ANEEL system that signals to consumers the cost of generating energy: the color defined for the month (green, yellow or red in two levels) indicates whether there is a surcharge per kWh consumed, and how much."),
      porQueImporta:
        tx("Segundo a ANEEL, antes das bandeiras as variações de custo de geração eram repassadas até um ano depois, no reajuste tarifário seguinte; com elas, o custo aparece no mês do consumo. A bandeira verde não acrescenta nada à tarifa.", "According to ANEEL, before the flags, variations in generation cost were passed on up to a year later, in the next tariff adjustment; with them, the cost appears in the month of consumption. The green flag adds nothing to the tariff."),
      comoEMedido:
        tx("Acréscimo em reais por kWh consumido, conforme o patamar acionado no mês. No portal de dados abertos, a ANEEL publica o acionamento mensal e os adicionais de cada resolução em R$/MWh (R$ 0,01885 por kWh são 18,85 R$/MWh).", "Surcharge in reais per kWh consumed, according to the level triggered in the month. On the open data portal, ANEEL publishes the monthly triggering and the surcharges of each resolution in R$/MWh (R$ 0.01885 per kWh is 18.85 R$/MWh)."),
      relacoes: ["tarifa-te-tusd"],
      fontes: [BANDEIRAS, BANDEIRAS_VALORES],
      limitacoes: [
        tx("Não se aplica aos consumidores localizados em sistemas isolados.", "It does not apply to consumers located in isolated systems."),
        tx("Os valores de cada patamar mudam por resolução da ANEEL; meses antigos seguem a tabela vigente na época.", "The values of each level change by ANEEL resolution; past months follow the table in force at the time."),
      ],
      vejaNoPortal: [{ rotulo: tx("Bandeiras acionadas desde 2015", "Flags triggered since 2015"), href: "/setor-eletrico/conta-de-luz/reajustes-e-subsidios#bandeiras" }],
    },
    {
      slug: "custo-de-disponibilidade",
      nome: tx("Custo de disponibilidade", "Availability cost"),
      grupo: "Consumidor", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-09-30",
      emUmaFrase:
        tx("Valor em reais equivalente a 30 kWh (ligação monofásica), 50 kWh (bifásica) ou 100 kWh (trifásica) que a ANEEL diz ser devido pelas unidades consumidoras de baixa tensão (grupo B), mesmo quando a energia injetada na rede supera o consumo.", "Amount in reais equivalent to 30 kWh (single-phase connection), 50 kWh (two-phase) or 100 kWh (three-phase) that ANEEL says is owed by low-voltage consumer units (group B), even when the energy injected into the grid exceeds consumption."),
      porQueImporta:
        tx("Define o piso da parcela de energia da conta das unidades de baixa tensão. Na Tarifa Social, a página da ANEEL informa que há gratuidade até 80 kWh no mês mesmo em instalações trifásicas.", "It sets the floor of the energy portion of the bill of low-voltage units. For the Tarifa Social, the ANEEL page states that consumption up to 80 kWh in the month is free even in three-phase installations."),
      comoEMedido: tx("Em kWh equivalentes, multiplicados pela tarifa (TE + TUSD) da classe da unidade consumidora.", "In equivalent kWh, multiplied by the tariff (TE + TUSD) of the consumer unit's class."),
      relacoes: ["tarifa-te-tusd"],
      fontes: [GERACAO_DISTRIBUIDA, TARIFA_SOCIAL],
      limitacoes: [
        tx("A norma de origem (REN nº 1.000/2021) não pôde ser lida: o acervo da ANEEL bloqueou o acesso automatizado. O detalhe por número de condutores e a regra para a Tarifa Social acima de 80 kWh não foram conferidos no texto da norma.", "The originating norm (REN No. 1.000/2021) could not be read: ANEEL's document archive blocked automated access. The detail by number of conductors and the rule for the Tarifa Social above 80 kWh were not checked in the text of the norm."),
      ],
      vejaNoPortal: [{ rotulo: tx("Simulador da conta", "Bill simulator"), href: "/setor-eletrico/conta-de-luz#simulador" }],
    },
    {
      slug: "cde",
      sigla: "CDE",
      nome: tx("Conta de Desenvolvimento Energético", "Energy Development Account"),
      grupo: "Consumidor", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-09-30",
      emUmaFrase:
        tx("Fundo setorial que custeia políticas públicas do setor elétrico, como a universalização do serviço e os descontos tarifários a usuários (baixa renda, rural, irrigação e aquicultura, saneamento, fontes incentivadas). É arrecadado principalmente por quotas incluídas nas tarifas de uso da rede.", "Sector fund that pays for public policies of the power sector, such as universal service and tariff discounts to users (low income, rural, irrigation and aquaculture, sanitation, incentivized sources). It is collected mainly through quotas included in the grid use tariffs."),
      porQueImporta:
        tx("É por onde passam os descontos da conta de luz: quem tem desconto recebe, e o custo é repartido nas tarifas de todos os consumidores pela quota da CDE, que a ANEEL fixa a cada ano no valor que falta depois das demais receitas.", "It is the channel for the discounts on the electricity bill: those with a discount receive it, and the cost is shared in the tariffs of all consumers through the CDE quota, which ANEEL sets each year at the amount still missing after the other revenues."),
      comoEMedido:
        tx("Orçamento anual aprovado pela ANEEL, em reais, por rubrica de despesa e de receita; nas tarifas, as componentes com CDE no código aparecem dentro da TUSD e da TE, em R$/MWh.", "Annual budget approved by ANEEL, in reais, by expense and revenue item; in the tariffs, the components with CDE in their code appear within the TUSD and the TE, in R$/MWh."),
      relacoes: ["tarifa-te-tusd"],
      fontes: [CDE_ANEEL, CDE_QUOTAS],
      limitacoes: [
        tx("O orçamento aprovado não é a execução: o que a conta efetivamente arrecadou e gastou não está no conjunto usado aqui.", "The approved budget is not the execution: what the account actually collected and spent is not in the dataset used here."),
        tx("Os repasses mensais a cada distribuidora por descontos (subsídios tarifários) e o orçamento anual por rubrica são conjuntos diferentes e não se somam.", "Monthly transfers to each distribution utility for discounts (tariff subsidies) and the annual budget by item are different datasets and do not add up."),
      ],
      vejaNoPortal: [
        { rotulo: tx("Quem financia os descontos", "Who funds the discounts"), href: "/setor-eletrico/conta-de-luz/reajustes-e-subsidios#subsidios" },
        { rotulo: tx("Componentes CDE na tarifa", "CDE components in the tariff"), href: "/setor-eletrico/conta-de-luz#composicao" },
      ],
    },
  ];
}
export const CONCEITOS_IDIOMAS = montarNosDoisIdiomas(montarConceitos);
export const CONCEITOS: Conceito[] = CONCEITOS_IDIOMAS.pt;
