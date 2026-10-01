import type { Conceito, FonteOficial } from "./conceitos";

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

const TARIFAS_ANEEL: FonteOficial = {
  orgao: "ANEEL",
  documento: 'Portal de dados abertos, conjunto "Tarifas de aplicação das distribuidoras de energia elétrica" (descrição oficial, acessada em 30/09/2026)',
  url: "https://dadosabertos.aneel.gov.br/dataset/tarifas-distribuidoras-energia-eletrica",
  trecho:
    "Apresenta os valores das Tarifas de Energia - TE e das Tarifas de Uso do Sistema de Distribuição - TUSD, resultantes dos processos de reajustes tarifários das distribuidoras de energia elétrica.",
  parafrase: "Em outras palavras: a ANEEL publica, para cada distribuidora, os valores de TE e de TUSD que saem de cada processo tarifário.",
};

const CUSTO_ENERGIA: FonteOficial = {
  orgao: "ANEEL",
  documento: 'Página "Custo da energia que chega aos consumidores" (capturada em 30/09/2026)',
  url: "https://www.gov.br/aneel/pt-br/assuntos/tarifas/entenda-a-tarifa/custo-da-energia-que-chega-aos-consumidores",
  trecho:
    "A tarifa considera três custos distintos: Energia gerada + transporte de energia até as unidades consumidores (transmissão e distribuição) + encargos setoriais Além da tarifa, os Governos Federal, Estadual e Municipal cobram os seguintes tributos na conta de luz: PIS/COFINS, ICMS e Contribuição para Iluminação Pública (CIP), respectivamente.",
  parafrase:
    "Em outras palavras: a tarifa paga a energia, a transmissão, a distribuição e os encargos setoriais; PIS/Cofins, ICMS e a contribuição de iluminação pública são cobrados na conta além da tarifa.",
};

const BANDEIRAS: FonteOficial = {
  orgao: "ANEEL",
  documento: 'Página "Sobre Bandeiras Tarifárias" (capturada em 30/09/2026)',
  url: "https://www.gov.br/aneel/pt-br/assuntos/tarifas/bandeiras-tarifarias",
  trecho:
    "Bandeiras tarifárias é o sistema que sinaliza aos consumidores os custos reais da geração de energia elétrica. [...] Todos os consumidores cativos das distribuidoras são faturados pelo Sistema de Bandeiras Tarifárias, com exceção daqueles localizados em sistemas isolados.",
  parafrase:
    "Em outras palavras: a cor da bandeira sinaliza o custo da geração, e todo consumidor atendido pela distribuidora paga conforme a bandeira, exceto nos sistemas isolados.",
};

const BANDEIRAS_VALORES: FonteOficial = {
  orgao: "ANEEL",
  documento: 'Página "Sobre Bandeiras Tarifárias", seção "O que significa cada cor e quanto custa?" (capturada em 30/09/2026)',
  url: "https://www.gov.br/aneel/pt-br/assuntos/tarifas/bandeiras-tarifarias",
  trecho:
    "Bandeira verde: condições favoráveis de geração de energia. A tarifa não sofre nenhum acréscimo; Bandeira amarela: condições de geração menos favoráveis. A tarifa sofre acréscimo de R$ 0,01885 para cada quilowatt-hora (kWh) consumidos;",
};

const GERACAO_DISTRIBUIDA: FonteOficial = {
  orgao: "ANEEL",
  documento: 'Página "Micro e Minigeração Distribuída" (capturada em 30/09/2026)',
  url: "https://www.gov.br/aneel/pt-br/assuntos/geracao-distribuida",
  trecho:
    "para unidades consumidoras conectadas em baixa tensão (grupo B), ainda que a energia injetada na rede seja superior ao consumo, será devido o pagamento referente ao custo de disponibilidade – valor em reais equivalente a 30 kWh (monofásico), 50 kWh (bifásico) ou 100 kWh (trifásico).",
  parafrase:
    "Em outras palavras: toda unidade de baixa tensão paga ao menos o equivalente a 30, 50 ou 100 kWh, conforme a ligação seja monofásica, bifásica ou trifásica, mesmo quando gera mais do que consome.",
};

const TARIFA_SOCIAL: FonteOficial = {
  orgao: "ANEEL",
  documento: 'Página "Tarifa Social" (capturada em 30/09/2026)',
  url: "https://www.gov.br/aneel/pt-br/assuntos/tarifas/tarifa-social",
  trecho: "mesmo no caso de instalações trifásicas, existirá a gratuidade no caso de consumo até 80 kWh no mês",
};

const CDE_ANEEL: FonteOficial = {
  orgao: "ANEEL",
  documento: 'Página "Gestão de Recursos Tarifários", seção Conta de Desenvolvimento Energético (capturada em 30/09/2026)',
  url: "https://www.gov.br/aneel/pt-br/assuntos/tarifas/gestao-de-recursos-tarifarios",
  trecho:
    "A Conta de Desenvolvimento Energético (CDE) é um fundo setorial que tem como objetivo custear diversas políticas públicas do setor elétrico brasileiro, tais como: universalização do serviço de energia elétrica em todo o território nacional; concessão de descontos tarifários a diversos usuários do serviço (baixa renda, rural, atividade de irrigação e aquicultura em horário especial, serviço público de água, esgoto e saneamento, geração e consumo de energia de fonte incentivadas etc.);",
  parafrase:
    "Em outras palavras: a CDE é um fundo do setor elétrico que paga políticas públicas, entre elas levar energia a todo o território e os descontos na tarifa de grupos como baixa renda, rural, irrigação, saneamento e fontes incentivadas.",
};

const CDE_QUOTAS: FonteOficial = {
  orgao: "ANEEL",
  documento: 'Página "Gestão de Recursos Tarifários", seção Conta de Desenvolvimento Energético (capturada em 30/09/2026)',
  url: "https://www.gov.br/aneel/pt-br/assuntos/tarifas/gestao-de-recursos-tarifarios",
  trecho:
    "Os recursos da CDE são arrecadados principalmente das quotas anuais pagas por todos os agentes que comercializam energia elétrica com consumidor final. Isso é feito mediante encargo tarifário incluído nas tarifas de uso dos sistemas de distribuição e transmissão de energia, [...] Cabe à ANEEL aprovar o Orçamento Anual da CDE e fixar a quota anual, que deve corresponder à diferença entre a necessidade total de recursos da Conta e a arrecadação proporcionada pelas demais fontes.",
  parafrase:
    "Em outras palavras: a maior parte do dinheiro da CDE vem de quotas cobradas dentro das tarifas de uso da rede; a ANEEL aprova o orçamento anual e fixa a quota no valor que falta depois das outras receitas.",
};

export const CONCEITOS: Conceito[] = [
  {
    slug: "tarifa-te-tusd",
    sigla: "TE e TUSD",
    nome: "Tarifa de Energia e Tarifa de Uso do Sistema de Distribuição",
    grupo: "Consumidor",
    estado: "CONFERIDO",
    conferidoEm: "2026-09-30",
    emUmaFrase:
      "Os dois valores que a ANEEL publica para cada distribuidora como resultado dos processos tarifários: a Tarifa de Energia (TE) e a Tarifa de Uso do Sistema de Distribuição (TUSD). Juntas, cobrem a energia gerada, a transmissão, a distribuição e os encargos setoriais; os tributos são cobrados além delas.",
    porQueImporta:
      "É a parte da conta de luz fixada pela ANEEL para cada área de concessão: o mesmo consumo custa diferente conforme a distribuidora. Comparar TE + TUSD da mesma classe e modalidade isola essa diferença dos tributos estaduais e municipais.",
    comoEMedido:
      "No conjunto de dados abertos da ANEEL, em reais por megawatt-hora (R$/MWh), por distribuidora, subgrupo, modalidade, classe, subclasse, posto e vigência; dividido por 1000, dá o valor por kWh.",
    relacoes: ["bandeira-tarifaria", "cde", "custo-de-disponibilidade"],
    fontes: [TARIFAS_ANEEL, CUSTO_ENERGIA],
    limitacoes: [
      "TE e TUSD não incluem PIS/Cofins, ICMS nem a contribuição de iluminação pública, que entram na conta além da tarifa.",
      "A tarifa homologada não é a tarifa média de fornecimento (receita dividida pela energia vendida), que depende do mercado de cada classe.",
    ],
    vejaNoPortal: [
      { rotulo: "Tarifa B1 residencial por distribuidora", href: "/setor-eletrico/conta-de-luz#tarifa" },
      { rotulo: "Do que a tarifa é feita", href: "/setor-eletrico/conta-de-luz#composicao" },
    ],
  },
  {
    slug: "bandeira-tarifaria",
    nome: "Bandeira tarifária",
    grupo: "Consumidor",
    estado: "CONFERIDO",
    conferidoEm: "2026-09-30",
    emUmaFrase:
      "Sistema da ANEEL que sinaliza aos consumidores o custo da geração de energia: a cor definida para o mês (verde, amarela ou vermelha em dois patamares) indica se há acréscimo por kWh consumido, e de quanto.",
    porQueImporta:
      "Segundo a ANEEL, antes das bandeiras as variações de custo de geração eram repassadas até um ano depois, no reajuste tarifário seguinte; com elas, o custo aparece no mês do consumo. A bandeira verde não acrescenta nada à tarifa.",
    comoEMedido:
      "Acréscimo em reais por kWh consumido, conforme o patamar acionado no mês. No portal de dados abertos, a ANEEL publica o acionamento mensal e os adicionais de cada resolução em R$/MWh (R$ 0,01885 por kWh são 18,85 R$/MWh).",
    relacoes: ["tarifa-te-tusd"],
    fontes: [BANDEIRAS, BANDEIRAS_VALORES],
    limitacoes: [
      "Não se aplica aos consumidores localizados em sistemas isolados.",
      "Os valores de cada patamar mudam por resolução da ANEEL; meses antigos seguem a tabela vigente na época.",
    ],
    vejaNoPortal: [{ rotulo: "Bandeiras acionadas desde 2015", href: "/setor-eletrico/conta-de-luz/reajustes-e-subsidios#bandeiras" }],
  },
  {
    slug: "custo-de-disponibilidade",
    nome: "Custo de disponibilidade",
    grupo: "Consumidor",
    estado: "CONFERIDO",
    conferidoEm: "2026-09-30",
    emUmaFrase:
      "Valor em reais equivalente a 30 kWh (ligação monofásica), 50 kWh (bifásica) ou 100 kWh (trifásica) que a ANEEL diz ser devido pelas unidades consumidoras de baixa tensão (grupo B), mesmo quando a energia injetada na rede supera o consumo.",
    porQueImporta:
      "Define o piso da parcela de energia da conta das unidades de baixa tensão. Na Tarifa Social, a página da ANEEL informa que há gratuidade até 80 kWh no mês mesmo em instalações trifásicas.",
    comoEMedido: "Em kWh equivalentes, multiplicados pela tarifa (TE + TUSD) da classe da unidade consumidora.",
    relacoes: ["tarifa-te-tusd"],
    fontes: [GERACAO_DISTRIBUIDA, TARIFA_SOCIAL],
    limitacoes: [
      "A norma de origem (REN nº 1.000/2021) não pôde ser lida nesta fase: o acervo da ANEEL bloqueou o acesso automatizado. O detalhe por número de condutores e a regra para a Tarifa Social acima de 80 kWh não foram conferidos no texto da norma.",
    ],
    vejaNoPortal: [{ rotulo: "Simulador da conta", href: "/setor-eletrico/conta-de-luz#simulador" }],
  },
  {
    slug: "cde",
    sigla: "CDE",
    nome: "Conta de Desenvolvimento Energético",
    grupo: "Consumidor",
    estado: "CONFERIDO",
    conferidoEm: "2026-09-30",
    emUmaFrase:
      "Fundo setorial que custeia políticas públicas do setor elétrico, como a universalização do serviço e os descontos tarifários a usuários (baixa renda, rural, irrigação e aquicultura, saneamento, fontes incentivadas), arrecadado principalmente por quotas incluídas nas tarifas de uso da rede.",
    porQueImporta:
      "É por onde passam os descontos da conta de luz: quem tem desconto recebe, e o custo é repartido nas tarifas de todos os consumidores pela quota da CDE, que a ANEEL fixa a cada ano no valor que falta depois das demais receitas.",
    comoEMedido:
      "Orçamento anual aprovado pela ANEEL, em reais, por rubrica de despesa e de receita; nas tarifas, as componentes com CDE no código aparecem dentro da TUSD e da TE, em R$/MWh.",
    relacoes: ["tarifa-te-tusd"],
    fontes: [CDE_ANEEL, CDE_QUOTAS],
    limitacoes: [
      "O orçamento aprovado não é a execução: o que a conta efetivamente arrecadou e gastou não está no conjunto usado aqui.",
      "Os repasses mensais a cada distribuidora por descontos (subsídios tarifários) e o orçamento anual por rubrica são conjuntos diferentes e não se somam.",
    ],
    vejaNoPortal: [
      { rotulo: "Quem financia os descontos", href: "/setor-eletrico/conta-de-luz/reajustes-e-subsidios#subsidios" },
      { rotulo: "Componentes CDE na tarifa", href: "/setor-eletrico/conta-de-luz#composicao" },
    ],
  },
];
