/**
 * Base de conhecimento do Setor Elétrico ("Aprenda").
 *
 * Regra: nenhuma definição escrita de memória. Cada verbete aponta o documento
 * primário e o estado de conferência:
 * - CONFERIDO: o texto foi escrito a partir do documento acessado na data indicada;
 * - PENDENTE: a fonte primária que define o termo ainda não foi acessada (as Regras
 *   de Comercialização da CCEE, por exemplo) ou as consultadas não o definem; o campo
 *   fontePlanejada diz o que falta e o que já foi consultado. Verbete pendente aparece
 *   como "em preparação", sem definição.
 */

import type { Idioma } from "@/lib/idioma";
import { idiomaEnergia } from "@/lib/energia/idioma";
import { montarNosDoisIdiomas, type TxIdioma } from "@/lib/energia/i18n/aprenda";
import { CONCEITOS_MODULOS_IDIOMAS } from "./conceitos-modulos";

export type EstadoConferencia = "CONFERIDO" | "PENDENTE";

export type GrupoConceito =
  | "Preço"
  | "Água"
  | "Operação"
  | "Modelos"
  | "Mercado"
  | "Rede"
  | "Consumidor"
  | "Qualidade e perdas"
  | "Inclusão"
  | "Empresas"
  | "Expansão"
  | "Regulação"
  | "Transição"
  | "Fontes de dados";

export type FonteOficial = {
  orgao: string;
  documento: string;
  url: string;
  /** Trecho do documento que sustenta a definição, quando aplicável. */
  trecho?: string;
  /** O trecho citado já está em inglês no original (fonte estrangeira): a página inglesa o mostra sem o aviso "Portuguese only". */
  trechoEmIngles?: boolean;
  /** O mesmo trecho em linguagem direta, sem acrescentar nada que ele não diga. */
  parafrase?: string;
};

export type Conceito = {
  slug: string;
  sigla?: string;
  nome: string;
  grupo: GrupoConceito;
  estado: EstadoConferencia;
  conferidoEm?: string;
  /** Última revisão do texto, quando posterior à conferência (ex.: integração de um conjunto citado em "como é medido"). */
  revisadoEm?: string;
  emUmaFrase?: string;
  porQueImporta?: string;
  comoEMedido?: string;
  relacoes: string[];
  fontes: FonteOficial[];
  limitacoes?: string[];
  /**
   * Detalhe técnico da conferência que o leitor comum não precisa (o código da resposta de um servidor, o que foi tentado):
   * a página o mostra recolhido, depois das limitações. A limitação em si diz em palavras comuns que a fonte não foi lida e por quê.
   */
  detalheDaConferencia?: string[];
  vejaNoPortal: { rotulo: string; href: string }[];
  /** Fonte planejada para verbetes pendentes. */
  fontePlanejada?: string;
  /**
   * Ressalva de um verbete CONFERIDO cuja fonte definidora não foi lida ou não existe: aparece junto do selo
   * de conferência, para o selo não dizer mais do que o verbete prova.
   */
  ressalva?: string;
  /**
   * Leitura em linguagem direta do que o texto da fonte já diz, mostrada antes dele quando a definição literal é jurídica ou
   * técnica demais para abrir o verbete. Só usa o que os trechos literais do verbete sustentam; não é definição nova.
   */
  emPalavrasSimples?: string;
  /**
   * Resumo de duas linhas de "Como é medido", mostrado aberto; o texto completo (a norma, a curva, o cálculo do observatório)
   * fica logo abaixo, recolhido, sob "Detalhe técnico". Parágrafos de `comoEMedido` separam-se por linha em branco.
   */
  comoEMedidoResumo?: string;
  /** Uma frase por relação, escrita só com o que os trechos literais do verbete dizem (relações sem frase seguem como atalho). */
  relacoesNotas?: Record<string, string>;
};



const TRECHO_CMO_SEMANAL =
  // i18n: dado
  "Valores do custo, por unidade de energia produzida, para atender ao incremento de uma unidade de carga no SIN, chamado de Custo Marginal de Operação – CMO. Valores para cada semana operativa por subsistema, e por patamar de carga, além da média semanal, estimados pelo modelo Decomp.";
const TRECHO_CMO_SEMI =
  // i18n: dado
  "Este CMO é estimado pelo modelo DESSEM para cada barra do sistema em base semi-horária. O CMO do subsistema é obtido pelo média dos CMOs nas barras de cada subsistema, ponderados pelas respectivas cargas [...]";
const TRECHO_EAR =
  // i18n: dado
  "A Energia Armazenada (EAR) representa a energia associada ao volume de água disponível nos reservatórios que pode ser convertido em geração na própria usina e em todas as usinas à jusante na cascata. A grandeza de EAR leva em conta nível verificado nos reservatórios na data de referência. A grandeza de EAR máxima representa a capacidade de armazenamento caso todos os reservatórios do sistema estivessem cheios.";
const TRECHO_BALANCO =
  // i18n: dado
  "Informações da carga e oferta de energia verificados em periodicidade horária por subsistema. A oferta é representada pelos valores de geração das usinas hidráulicas, térmicas, eólicas e fotovoltaicas, em MWmed.";
const TRECHO_CARGA =
  // i18n: dado
  "Dados de carga por subsistema em base diária, medida em MWmed. Até fevereiro/2021, os dados representam a carga atendida por usinas despachadas e/ou programadas pelo ONS, com base em dados recebidos pelo Sistema de Supervisão e Controle do ONS. Entre março/2021 e abril/23, os dados representam a carga atendida por usinas despachadas e/ou programadas pelo ONS, com base em dados recebidos pelo Sistema de Supervisão e Controle do ONS, mais a previsão de geração de usinas não despachadas pelo ONS. A partir de 29/04/2023, além dos dados anteriormente considerados, passou a ser incorporado o valor estimado da micro e minigeração distribuída (MMGD), com base em dados meteorológicos previstos.";




function montarConceitosBase(tx: TxIdioma): Conceito[] {
  const ONS = (id: string, titulo: string, trecho?: string): FonteOficial => ({
    orgao: "ONS",
    documento: tx(`Portal de dados abertos, conjunto "${titulo}" (descrição e dicionário de dados)`, `Open data portal, dataset «${titulo}» (description and data dictionary)`),
    url: `https://dados.ons.org.br/dataset/${id}`,
    trecho,
  });
  const CCEE_PLD: FonteOficial = {
    orgao: "CCEE",
    documento: tx("Portal de dados abertos, organização Preço de Liquidação das Diferenças e conjunto PLD_HORARIO (descrição oficial)", "Open data portal, organization «Preço de Liquidação das Diferenças» and dataset PLD_HORARIO (official description)"),
    url: "https://dadosabertos.ccee.org.br/dataset/pld_horario",
    trecho:
      // i18n: dado
      "O Preço de Liquidação das Diferenças (PLD) é calculado pela Câmara de Comercialização de Energia Elétrica (CCEE) diariamente para cada hora do dia seguinte, considerando a aplicação dos limites máximos (horário e estrutural) e mínimo vigentes para cada período de apuração e para cada submercado. Este cálculo é realizado por modelos computacionais (Newave, Decomp e Dessem) e tem como base o Custo Marginal de Operação (CMO).",
    parafrase:
      tx("Em outras palavras: todo dia a CCEE calcula os preços de cada hora do dia seguinte, em cada submercado, com três modelos computacionais, partindo do custo marginal de operação e respeitando um limite mínimo e dois limites máximos.", "In other words: every day the CCEE calculates the prices for each hour of the following day, in each submarket, with three computer models, starting from the marginal operating cost and respecting a minimum limit and two maximum limits."),
  };
  const CCEE_MCP: FonteOficial = {
    orgao: "CCEE",
    documento:
      tx("Portal de dados abertos, conjuntos PLD_HORARIO_SUBMERCADO e SUMARIO_BE_HORARIO_SUBMERCADO (descrição dos recursos), capturados em 28/09/2026", "Open data portal, datasets PLD_HORARIO_SUBMERCADO and SUMARIO_BE_HORARIO_SUBMERCADO (resource descriptions), captured on Sep 28, 2026"),
    url: "https://dadosabertos.ccee.org.br/dataset/sumario_be_horario_submercado",
    trecho:
      // i18n: dado
      "Detalhar os valores do Preço de Liquidação das Diferenças do MCP por mês de referência, período de comercialização e submercado. [...] PERIODO_COMERCIALIZACAO: Representa o período de comercialização, equivalente a uma hora [...] BE_POSITIVO: Corresponde ao Balanço Energético positivo do perfil de agente “a” no submercado “s” para o período de comercialização “j” [...] RESULTADO_MCP: Corresponde ao Resultado no Mercado de Curto Prazo do perfil de agente “a”, no submercado “s”, por período de comercialização “j”. [...]",
    parafrase:
      tx("Em outras palavras: o PLD é o preço do Mercado de Curto Prazo. A CCEE define, para cada perfil de agente, submercado e hora, o balanço de energia (positivo ou negativo) e o resultado nesse mercado; o conjunto publica esses valores por submercado e hora.", "In other words: the PLD is the price of the Short-Term Market. For each agent profile, submarket and hour, the CCEE determines the energy balance (positive or negative) and the result in that market; the dataset publishes these values by submarket and hour."),
  };
  const CCEE_MCP_MENSAL: FonteOficial = {
    orgao: "CCEE",
    documento: tx("Portal de dados abertos, conjunto SUMARIO_MENSAL_COMPRA_VENDA_SUBMERCADO (descrição do recurso), capturado em 28/09/2026", "Open data portal, dataset SUMARIO_MENSAL_COMPRA_VENDA_SUBMERCADO (resource description), captured on Sep 28, 2026"),
    url: "https://dadosabertos.ccee.org.br/dataset/sumario_mensal_compra_venda_submercado",
    trecho:
      // i18n: dado
      "Detalhar o balanço energético e resultado do MCP por submercado e por mês de referência. [...] RESULTADO_MCP_VENDA: Corresponde ao Resultado no Mercado de Curto Prazo de venda do perfil de agente “a”, no submercado “s”, por período de comercialização “j” consolidado no mês.",
    parafrase: tx("Em outras palavras: no consolidado do mês, a CCEE publica por submercado o resultado de venda e o de compra no Mercado de Curto Prazo.", "In other words: in the monthly consolidation, the CCEE publishes by submarket the selling result and the buying result in the Short-Term Market."),
  };
  const REN_957: FonteOficial = {
    orgao: "ANEEL",
    documento: tx("Resolução Normativa nº 957, de 7 de dezembro de 2021 (Convenção de Comercialização), art. 2º, inciso XIII, e art. 5º, § 4º (texto compilado, lido na cópia do Internet Archive de 01/06/2025)", "Normative Resolution (REN) No. 957 of Dec 7, 2021 (Trading Convention), art. 2, item XIII, and art. 5, § 4 (consolidated text, read in the Internet Archive copy of Jun 1, 2025)"),
    url: "https://www2.aneel.gov.br/cedoc/ren2021957.pdf",
    trecho:
      // i18n: dado
      "XIII – Mercado de Curto Prazo – MCP: denominação do processo em que se procede à contabilização e liquidação financeira das diferenças apuradas entre os montantes de energia elétrica seguintes: a) contratados, registrados e validados pelos agentes da CCEE, cujo registro tenha sido efetivado pela Câmara; e b) de geração ou de consumo efetivamente verificados e atribuídos aos respectivos agentes da CCEE; [...] § 4º As operações realizadas no MCP serão contabilizadas pela CCEE de acordo com as Regras e Procedimentos de Comercialização, [...] devendo as exposições dos agentes da CCEE serem valoradas ao PLD.",
    parafrase:
      tx("Em outras palavras: o Mercado de Curto Prazo é o processo em que a CCEE contabiliza e liquida financeiramente as diferenças entre a energia contratada e registrada pelos agentes e a energia de geração ou de consumo efetivamente verificada, e as exposições dos agentes são valoradas ao PLD.", "In other words: the Short-Term Market is the process in which the CCEE accounts for and financially settles the differences between the energy contracted and registered by the agents and the energy actually generated or consumed, and the agents' exposures are valued at the PLD."),
  };
  return [
    {
      slug: "pld",
      sigla: "PLD",
      nome: tx("Preço de Liquidação das Diferenças", "Spot price (Settlement Price for Differences)"),
      grupo: "Preço", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-09-28",
      revisadoEm: "2026-10-07",
      emUmaFrase:
        tx("Preço do Mercado de Curto Prazo, ao qual a CCEE valora as exposições dos agentes, isto é, as diferenças entre a energia contratada e a efetivamente verificada. É calculado pela CCEE diariamente para cada hora do dia seguinte e para cada submercado, com base no Custo Marginal de Operação e dentro dos limites mínimo e máximos vigentes.", "Price of the Short-Term Market, at which the CCEE values the agents' exposures, that is, the differences between contracted energy and energy actually verified. It is calculated by the CCEE daily for each hour of the following day and for each submarket, based on the Marginal Operating Cost and within the minimum and maximum limits in force."),
      porQueImporta:
        tx("No Mercado de Curto Prazo, a CCEE contabiliza as diferenças entre a energia que cada agente contratou e a que efetivamente gerou ou consumiu, e as exposições são valoradas ao PLD (REN ANEEL nº 957/2021). Para cada perfil de agente, submercado e hora, a CCEE apura um balanço energético em MWh (positivo ou negativo) e um resultado em R$. O PLD tem como base o CMO, que o ONS define como o custo, por unidade de energia produzida, para atender ao incremento de uma unidade de carga no SIN. Como o balanço de cada agente é formado em detalhe está nas Regras de Comercialização da CCEE, que o observatório não consultou.", "In the Short-Term Market, the CCEE accounts for the differences between the energy each agent contracted and the energy it actually generated or consumed, and the exposures are valued at the PLD (REN ANEEL No. 957/2021). For each agent profile, submarket and hour, the CCEE determines an energy balance in MWh (positive or negative) and a result in R$. The PLD is based on the CMO, which the ONS defines as the cost, per unit of energy produced, of meeting an increase of one unit of load in the SIN. How each agent's balance is formed in detail is in the CCEE Trading Rules, which the observatory did not consult."),
      comoEMedidoResumo:
        tx("Em reais por megawatt-hora (R$/MWh), com um valor por hora e por submercado, publicado pela CCEE. Médias diárias, semanais ou mensais são agregações dessas horas.", "In reais per megawatt-hour (R$/MWh), with one value per hour and per submarket, published by the CCEE. Daily, weekly or monthly averages are aggregations of these hours."),
      comoEMedido:
        tx("Em reais por megawatt-hora (R$/MWh), unidade usual de preço de energia; a descrição do conjunto na CCEE registra a unidade apenas como R$. Um valor por hora e por submercado, no conjunto PLD_HORARIO. Médias diárias, semanais ou mensais são agregações dessas horas.", "In reais per megawatt-hour (R$/MWh), the usual unit for energy prices; the dataset description at the CCEE records the unit only as R$. One value per hour and per submarket, in the PLD_HORARIO dataset. Daily, weekly or monthly averages are aggregations of these hours."),
      relacoes: ["cmo", "submercado", "newave", "decomp", "dessem"],
      fontes: [
        CCEE_PLD,
        CCEE_MCP,
        REN_957,
        ONS("cmo-semanal", "CMO Semanal", TRECHO_CMO_SEMANAL),
        {
          orgao: "ANEEL",
          documento: tx('Portal de dados abertos, conjunto "Tarifas de aplicação das distribuidoras de energia elétrica"', "Open data portal, dataset «Tarifas de aplicação das distribuidoras de energia elétrica»"),
          url: "https://dadosabertos.aneel.gov.br/dataset/tarifas-distribuidoras-energia-eletrica",
          trecho:
            // i18n: dado
            "Apresenta os valores das Tarifas de Energia - TE e das Tarifas de Uso do Sistema de Distribuição - TUSD, resultantes dos processos de reajustes tarifários das distribuidoras de energia elétrica.",
        },
      ],
      limitacoes: [
        tx("O PLD não é a tarifa do consumidor atendido pela distribuidora: essa conta segue os valores da Tarifa de Energia (TE) e da Tarifa de Uso do Sistema de Distribuição (TUSD), resultantes dos processos tarifários da ANEEL.", "The PLD is not the tariff of the consumer served by the distribution utility: that bill follows the values of the Energy Tariff (TE) and of the Distribution System Use Tariff (TUSD), resulting from ANEEL's tariff processes."),
        tx("Os limites mínimo e máximos mudam a cada ano; comparações longas em valores nominais misturam regimes de limites.", "The minimum and maximum limits change every year; long comparisons in nominal values mix limit regimes."),
      ],
      vejaNoPortal: [
        { rotulo: tx("PLD explicado", "PLD explained"), href: "/setor-eletrico/pld" },
        { rotulo: tx("PLD dos quatro submercados no último dia publicado", "PLD of the four submarkets on the last published day"), href: "/setor-eletrico/pld#hoje" },
      ],
    },
    {
      slug: "mcp",
      sigla: "MCP",
      nome: tx("Mercado de Curto Prazo", "Short-Term Market"),
      grupo: "Mercado", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-09-28",
      revisadoEm: "2026-10-07",
      emUmaFrase:
        tx("Processo em que a CCEE contabiliza e liquida financeiramente as diferenças entre a energia contratada e registrada pelos agentes e a energia de geração ou de consumo efetivamente verificada, com as exposições valoradas ao PLD. A CCEE define o balanço de energia (MWh) e o resultado (R$) de cada perfil de agente por submercado e hora.", "Process in which the CCEE accounts for and financially settles the differences between the energy contracted and registered by the agents and the energy actually generated or consumed, with the exposures valued at the PLD. The CCEE determines the energy balance (MWh) and the result (R$) of each agent profile by submarket and hour."),
      porQueImporta:
        tx("É onde o PLD é usado como preço. A CCEE publica, por hora e submercado, os totais de balanço positivo e negativo e o resultado no MCP; no consolidado do mês, o resultado de venda e o de compra.", "It is where the PLD is used as a price. The CCEE publishes, by hour and submarket, the totals of positive and negative balance and the result in the MCP; in the monthly consolidation, the selling result and the buying result."),
      comoEMedido:
        tx("Em MWh (balanço) e R$ (resultado), somados por submercado e período de comercialização de uma hora (SUMARIO_BE_HORARIO_SUBMERCADO) e por mês (SUMARIO_MENSAL_COMPRA_VENDA_SUBMERCADO). O observatório integra o resumo mensal por submercado e a liquidação mensal (SUMARIO_MENSAL_LIQUIDACAO) no módulo Mercado; o resumo horário ainda não.", "In MWh (balance) and R$ (result), summed by submarket and one-hour trading period (SUMARIO_BE_HORARIO_SUBMERCADO) and by month (SUMARIO_MENSAL_COMPRA_VENDA_SUBMERCADO). The observatory integrates the monthly summary by submarket and the monthly settlement (SUMARIO_MENSAL_LIQUIDACAO) in the Market module; the hourly summary not yet."),
      relacoes: ["pld", "submercado"],
      fontes: [REN_957, CCEE_MCP, CCEE_MCP_MENSAL],
      limitacoes: [
        tx("Como o balanço de cada perfil de agente é formado (contratos, geração e consumo medidos) e como o resultado é liquidado, em detalhe, está nas Regras de Comercialização da CCEE, que este verbete não lê.", "How the balance of each agent profile is formed (contracts, measured generation and consumption) and how the result is settled, in detail, is in the CCEE Trading Rules, which this entry does not read."),
      ],
      vejaNoPortal: [
        { rotulo: tx("O PLD no Mercado de Curto Prazo", "The PLD in the Short-Term Market"), href: "/setor-eletrico/pld#o-que-e" },
        { rotulo: tx("Mercado: encargos e liquidação", "Market: charges and settlement"), href: "/setor-eletrico/mercado/encargos" },
      ],
    },
    {
      slug: "cmo",
      sigla: "CMO",
      nome: tx("Custo Marginal de Operação", "Marginal operating cost"),
      grupo: "Preço", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-09-28",
      emUmaFrase:
        tx("Custo, por unidade de energia produzida, para atender ao incremento de uma unidade de carga no sistema interligado.", "Cost, per unit of energy produced, of meeting an increase of one unit of load in the interconnected system."),
      porQueImporta:
        tx("É a base do PLD, segundo a CCEE. O ONS publica o CMO por semana operativa (estimado pelo modelo DECOMP) e em base semi-horária por barra (estimado pelo modelo DESSEM).", "It is the basis of the PLD, according to the CCEE. The ONS publishes the CMO by operating week (estimated by the DECOMP model) and on a half-hourly basis by bus (estimated by the DESSEM model)."),
      comoEMedido:
        tx("Em reais por unidade de energia (exibido como R$/MWh, como a definição do ONS, \"custo, por unidade de energia produzida\"; o dicionário de dados do ONS registra a unidade da média semanal como R$/MW), por subsistema e por patamar de carga (leve, média, pesada) na versão semanal. Na versão semi-horária, o CMO do subsistema é a média dos CMOs das barras ponderada pelas cargas.", "In reais per unit of energy (shown as R$/MWh, as in the ONS definition, «custo, por unidade de energia produzida»; the ONS data dictionary records the unit of the weekly average as R$/MW), by subsystem and by load level (light, medium, heavy) in the weekly version. In the half-hourly version, the CMO of the subsystem is the average of the CMOs of the buses weighted by the loads."),
      relacoes: ["pld", "decomp", "dessem", "carga"],
      fontes: [
        ONS("cmo-semanal", "CMO Semanal", TRECHO_CMO_SEMANAL),
        // i18n: dado
        ONS("cmo-semi-horario", "CMO Semi-Horário", TRECHO_CMO_SEMI),
        CCEE_PLD,
      ],
      limitacoes: [tx("CMO não é PLD: o PLD aplica limites regulatórios e é calculado pela CCEE em base horária.", "CMO is not PLD: the PLD applies regulatory limits and is calculated by the CCEE on an hourly basis.")],
      vejaNoPortal: [{ rotulo: tx("CMO na formação do PLD", "CMO in the formation of the PLD"), href: "/setor-eletrico/pld#formacao" }],
    },
    {
      slug: "submercado",
      nome: tx("Submercado", "Submarket"),
      grupo: "Preço", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-09-28",
      emUmaFrase:
        tx("Cada uma das quatro divisões do SIN para as quais a CCEE calcula um PLD próprio: Norte, Nordeste, Sul e Sudeste (esta plataforma usa o rótulo Sudeste/Centro-Oeste para o último).", "Each of the four divisions of the SIN for which the CCEE calculates its own PLD: North, Northeast, South and Southeast (this platform uses the label Southeast/Center-West for the last one)."),
      porQueImporta:
        tx("Os quatro valores de cada hora podem coincidir ou diferir. Por que diferem (limites de transmissão entre regiões, por exemplo) é matéria dos modelos e das regras da CCEE e do ONS, que este verbete não lê: a plataforma mostra a diferença observada e o intercâmbio medido, sem atribuir causa.", "The four values of each hour may coincide or differ. Why they differ (transmission limits between regions, for example) is a matter for the models and rules of the CCEE and the ONS, which this entry does not read: the platform shows the observed difference and the measured interchange, without attributing a cause."),
      comoEMedido:
        tx("O conjunto PLD_HORARIO traz um valor por hora para cada submercado. Nos conjuntos do ONS usados aqui, o campo de região é o subsistema, identificado por SE, S, NE e N.", "The PLD_HORARIO dataset gives one value per hour for each submarket. In the ONS datasets used here, the region field is the subsystem, identified by SE, S, NE and N."),
      relacoes: ["pld", "intercambio"],
      fontes: [
        CCEE_PLD,
        {
          orgao: "CCEE",
          documento: tx("Portal de dados abertos, conjunto PLD_HORARIO_SUBMERCADO (descrição do campo SUBMERCADO), capturado em 28/09/2026", "Open data portal, dataset PLD_HORARIO_SUBMERCADO (description of the SUBMERCADO field), captured on Sep 28, 2026"),
          url: "https://dadosabertos.ccee.org.br/dataset/pld_horario_submercado",
          // i18n: dado
          trecho: "Representa os quatro (4) submercados de atuação no SIN  - Sistema Interligado Nacional correspondentes a Norte (N), Nordeste (NE), Sul (S) e Sudeste (SE).",
        },
      ],
      vejaNoPortal: [{ rotulo: tx("Por que os submercados diferem", "Why the submarkets differ"), href: "/setor-eletrico/pld#submercados" }],
    },
    {
      slug: "sin",
      sigla: "SIN",
      nome: tx("Sistema Interligado Nacional", "National Interconnected System"),
      grupo: "Operação", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-09-28",
      emUmaFrase:
        tx("Nome do sistema elétrico interligado do país. A CCEE descreve os quatro submercados (Norte, Nordeste, Sul e Sudeste) como submercados \"de atuação no SIN\".", "Name of the country's interconnected electricity system. The CCEE describes the four submarkets (North, Northeast, South and Southeast) as submarkets «de atuação no SIN» (operating in the SIN)."),
      porQueImporta:
        tx("Nos conjuntos do ONS usados aqui, os valores vêm por subsistema (N, NE, S e SE). Quando a plataforma mostra um valor do SIN, como a EAR ou a carga do SIN, ela o calcula a partir dos quatro, com a regra declarada no indicador.", "In the ONS datasets used here, the values come by subsystem (N, NE, S and SE). When the platform shows a SIN value, such as the EAR or the load of the SIN, it calculates it from the four, with the rule declared in the indicator."),
      comoEMedido:
        tx("Não é uma grandeza: é o recorte. Quando a plataforma calcula um valor para o SIN, a regra do indicador diz como (por exemplo, a EAR do SIN é a soma das EAR dos subsistemas dividida pela soma das EAR máximas).", "It is not a quantity: it is the scope. When the platform calculates a value for the SIN, the indicator rule says how (for example, the EAR of the SIN is the sum of the EAR of the subsystems divided by the sum of the maximum EAR)."),
      relacoes: ["submercado", "intercambio"],
      fontes: [
        {
          orgao: "CCEE",
          documento: tx("Portal de dados abertos, conjunto PLD_HORARIO_SUBMERCADO (descrição do campo SUBMERCADO), capturado em 28/09/2026", "Open data portal, dataset PLD_HORARIO_SUBMERCADO (description of the SUBMERCADO field), captured on Sep 28, 2026"),
          url: "https://dadosabertos.ccee.org.br/dataset/pld_horario_submercado",
          // i18n: dado
          trecho: "Representa os quatro (4) submercados de atuação no SIN  - Sistema Interligado Nacional correspondentes a Norte (N), Nordeste (NE), Sul (S) e Sudeste (SE).",
        },
      ],
      limitacoes: [tx("A abrangência física do SIN (quais sistemas isolados ficam de fora) não foi conferida em documento do ONS.", "The physical scope of the SIN (which isolated systems are left out) was not checked in an ONS document.")],
      vejaNoPortal: [{ rotulo: tx("Visão geral do sistema", "System overview"), href: "/setor-eletrico/visao-geral" }],
    },
    {
      slug: "cvu",
      sigla: "CVU",
      nome: tx("Custo Variável Unitário", "Unit variable cost"),
      grupo: "Preço", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-09-28",
      revisadoEm: "2026-10-06",
      emUmaFrase:
        tx("Valor atribuído a cada usina térmica que o ONS considera no Programa Mensal da Operação e na execução dos modelos NEWAVE, DECOMP e DESSEM. A fonte descreve o CVU pelo uso; o que compõe esse custo não foi conferido.", "Value assigned to each thermal plant that the ONS considers in the Monthly Operation Program and in running the NEWAVE, DECOMP and DESSEM models. The source describes the CVU by its use; what makes up this cost was not checked."),
      porQueImporta:
        tx("Segundo o ONS, é usado na execução dos modelos NEWAVE, DECOMP e DESSEM, nas decisões de programação e no acompanhamento dos custos da operação.", "According to the ONS, it is used in running the NEWAVE, DECOMP and DESSEM models, in scheduling decisions and in monitoring operating costs."),
      comoEMedido:
        tx("Em R$/MWh, por usina térmica e parcela, para cada semana operativa do Programa Mensal da Operação (sábado a sexta), no conjunto CVU das Usinas Térmicas do ONS (dicionário de dados versão 2.0, de 24/09/2025). O observatório publica o CVU da semana vigente por usina e a mediana mensal por combustível no painel de despacho térmico da Geração.", "In R$/MWh, by thermal plant and portion, for each operating week of the Monthly Operation Program (Saturday to Friday), in the ONS dataset «CVU das Usinas Térmicas» (data dictionary version 2.0, of Sep 24, 2025). The observatory publishes the CVU of the current week by plant and the monthly median by fuel in the thermal dispatch panel of Generation."),
      relacoes: ["cmo", "newave", "decomp", "dessem"],
      fontes: [
        // i18n: dado
        ONS("cvu-usitermica", "CVU das Usina Térmicas",
          // i18n: dado
          "Custo Variável Unitário (CVU) de usinas térmicas considerado no Programa Mensal da Operação, conforme utilizado na execução do modelo NEWAVE, DECOMP, DESSEM, além de seu uso nas decisões de programação e acompanhamentos dos custos da operação."),
      ],
      limitacoes: [
        tx("É o valor considerado no Programa Mensal da Operação para a semana: o conjunto não informa o custo realizado nem o preço do combustível.", "It is the value considered in the Monthly Operation Program for the week: the dataset does not report the actual cost or the fuel price."),
        tx("O que compõe esse custo não foi conferido.", "What makes up this cost was not checked."),
      ],
      vejaNoPortal: [{ rotulo: tx("Geração: despacho térmico", "Generation: thermal dispatch"), href: "/setor-eletrico/geracao/termica#p022" }],
    },
    {
      slug: "ear",
      sigla: "EAR",
      nome: tx("Energia Armazenada", "Stored energy"),
      grupo: "Água", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-09-28",
      emUmaFrase:
        tx("Energia associada ao volume de água nos reservatórios que pode ser convertido em geração na própria usina e em todas as usinas a jusante na cascata.", "Energy associated with the volume of water in the reservoirs that can be converted into generation at the plant itself and at all plants downstream in the cascade."),
      porQueImporta:
        tx("Resume em uma grandeza, por subsistema, a energia que a água guardada nos reservatórios pode gerar na própria usina e nas usinas a jusante. Em percentual da EAR máxima, indica quanto da capacidade de armazenamento está ocupada.", "It summarizes in one quantity, by subsystem, the energy that the water stored in the reservoirs can generate at the plant itself and at the downstream plants. As a percentage of the maximum EAR, it indicates how much of the storage capacity is occupied."),
      comoEMedido:
        tx("Em MWmês e em percentual da EAR máxima (a capacidade caso todos os reservatórios estivessem cheios), por dia e por subsistema, bacia, REE ou reservatório.", "In MW-month and as a percentage of the maximum EAR (the capacity if all reservoirs were full), by day and by subsystem, basin, REE or reservoir."),
      relacoes: ["ena", "armazenamento", "ree"],
      fontes: [
        // i18n: dado
        ONS("ear-diario-por-subsistema", "EAR Diário por Subsistema", TRECHO_EAR),
      ],
      limitacoes: [
        tx("Percentual da EAR máxima: a capacidade muda com a entrada de reservatórios, o que afeta comparações longas.", "Percentage of the maximum EAR: the capacity changes with the entry of reservoirs, which affects long comparisons."),
        tx("O ONS informa que os dados passam por consistência recorrente e podem ser revisados.", "The ONS states that the data undergo recurring consistency checks and may be revised."),
      ],
      vejaNoPortal: [{ rotulo: tx("Água e reservatórios", "Water and reservoirs"), href: "/setor-eletrico/agua-e-clima" }],
    },
    {
      slug: "armazenamento",
      nome: tx("Capacidade de armazenamento (EAR máxima)", "Storage capacity (maximum EAR)"),
      grupo: "Água", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-09-28",
      emUmaFrase: tx("Energia que os reservatórios guardariam se todos estivessem cheios.", "Energy the reservoirs would hold if they were all full."),
      porQueImporta: tx("É a referência dos percentuais de EAR: 60% significa 60% dessa capacidade máxima.", "It is the reference for EAR percentages: 60% means 60% of this maximum capacity."),
      comoEMedido: tx("Em MWmês, por subsistema, no conjunto EAR Diário por Subsistema do ONS (campo EAR máxima).", "In MW-month, by subsystem, in the ONS dataset «EAR Diário por Subsistema» (maximum EAR field)."),
      relacoes: ["ear"],
      // i18n: dado
      fontes: [ONS("ear-diario-por-subsistema", "EAR Diário por Subsistema", TRECHO_EAR)],
      vejaNoPortal: [{ rotulo: tx("Água e reservatórios", "Water and reservoirs"), href: "/setor-eletrico/agua-e-clima#ear" }],
    },
    {
      slug: "ena",
      sigla: "ENA",
      nome: tx("Energia Natural Afluente", "Natural inflow energy"),
      grupo: "Água", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-09-28",
      emUmaFrase:
        tx("Energia produzível a partir das vazões naturais aos reservatórios, calculada pelo ONS com as produtividades das usinas a 65% dos volumes úteis.", "Energy that can be produced from the natural flows into the reservoirs, calculated by the ONS with the productivities of the plants at 65% of the useful volumes."),
      porQueImporta:
        tx("Expressa em energia as vazões naturais que chegam aos reservatórios. O ONS indica que os dados servem de insumo para estudos energéticos e para a projeção do custo marginal de operação.", "It expresses in energy the natural flows that reach the reservoirs. The ONS indicates that the data serve as input for energy studies and for projecting the marginal operating cost."),
      comoEMedido:
        tx("ENA bruta: produto das vazões naturais pelas produtividades das usinas a 65% dos volumes úteis. Publicada por dia em energia (colunas terminadas em _mwmed; o dicionário de dados do ONS descreve a unidade como MWmês) e em percentual da média de longo termo (MLT).", "Gross ENA: product of the natural flows by the productivities of the plants at 65% of the useful volumes. Published by day in energy (columns ending in _mwmed; the ONS data dictionary describes the unit as MW-month) and as a percentage of the long-term average (MLT)."),
      relacoes: ["ear", "mlt"],
      fontes: [
        // i18n: dado
        ONS("ena-diario-por-subsistema", "ENA Diário por Subsistema",
          // i18n: dado
          "A Energia Natural Afluente (ENA) Bruta representa a energia produzível pela usina e é calculada pelo produto das vazões naturais aos reservatórios com as produtividades a 65% dos volumes úteis. A ENA Armazenável considera as vazões naturais descontadas das vazões vertidas nos reservatórios. [...] os dados podem servir de insumo para estudos energéticos e projeção do custo marginal de operação."),
      ],
      limitacoes: [tx("O conjunto não informa o período de referência da MLT.", "The dataset does not report the reference period of the MLT.")],
      vejaNoPortal: [{ rotulo: tx("Quanta água está chegando", "How much water is arriving"), href: "/setor-eletrico/agua-e-clima/afluencia#p018" }],
    },
    {
      slug: "mlt",
      sigla: "MLT",
      nome: tx("Média de longo termo", "Long-term average"),
      grupo: "Água", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-09-28",
      emUmaFrase: tx("Média de longo termo: a referência em relação à qual o ONS publica a ENA em percentual.", "Long-term average: the reference against which the ONS publishes the ENA as a percentage."),
      porQueImporta: tx("Permite ler a ENA de subsistemas de tamanhos diferentes na mesma escala relativa: 100% corresponde ao valor da MLT.", "It allows reading the ENA of subsystems of different sizes on the same relative scale: 100% corresponds to the MLT value."),
      comoEMedido:
        tx("O ONS publica a ENA bruta e a ENA armazenável em energia (colunas terminadas em _mwmed, descritas no dicionário como MWmês) e em percentual da MLT. O conjunto não informa como a MLT é calculada nem seu período de referência.", "The ONS publishes gross ENA and storable ENA in energy (columns ending in _mwmed, described in the dictionary as MW-month) and as a percentage of the MLT. The dataset does not report how the MLT is calculated or its reference period."),
      relacoes: ["ena"],
      fontes: [
        {
          orgao: "ONS",
          documento: tx('Dicionário de dados do conjunto "ENA Diário por Subsistema"', "Data dictionary of the «ENA Diário por Subsistema» dataset"),
          url: "https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/ena_subsistema_di/DicionarioDados_EnaPorSubsistema.json",
          // i18n: dado
          trecho: "Valor de ENA bruta por Subsistema medido em percentual por média de longo termo-MLT (%)",
        },
      ],
      limitacoes: [tx("O método de cálculo e o período de referência da MLT não são informados no conjunto de dados; leituras de \"acima ou abaixo do usual\" usam a distribuição histórica publicada pela plataforma, não a MLT.", "The calculation method and the reference period of the MLT are not reported in the dataset; readings of \"above or below usual\" use the historical distribution published by the platform, not the MLT.")],
      vejaNoPortal: [{ rotulo: tx("ENA em % da MLT", "ENA as % of the MLT"), href: "/setor-eletrico/agua-e-clima/afluencia#p018" }],
    },
    {
      slug: "ree",
      sigla: "REE",
      nome: tx("Reservatório Equivalente de Energia", "Equivalent Energy Reservoir"),
      grupo: "Água", // i18n: dado
      estado: "PENDENTE",
      relacoes: ["ear", "ena"],
      // i18n: dado
      fontes: [ONS("ear-diario-por-ree-reservatorio-equivalente-de-energia", "EAR Diário por REE")],
      fontePlanejada:
        tx("Procedimentos de Rede do ONS e documentação dos modelos de planejamento. Consultado em 06/10/2026 sem definição do termo: o dicionário de dados do conjunto EAR Diário por REE do ONS, que usa o termo sem defini-lo.", "ONS Grid Procedures and documentation of the planning models. Consulted on Oct 6, 2026 without a definition of the term: the data dictionary of the ONS dataset «EAR Diário por REE», which uses the term without defining it."),
      vejaNoPortal: [{ rotulo: tx("Catálogo de dados", "Data catalog"), href: "/setor-eletrico/dados" }],
    },
    {
      slug: "carga",
      nome: tx("Carga de energia", "Energy load"),
      grupo: "Operação", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-09-28",
      emUmaFrase: tx("Carga atendida no sistema interligado, publicada pelo ONS por subsistema em base diária, em MWmed; o que entra na conta mudou em março de 2021 e em abril de 2023.", "Load served in the interconnected system, published by the ONS by subsystem on a daily basis, in MWavg; what goes into the figure changed in March 2021 and in April 2023."),
      porQueImporta: tx("É o lado da demanda no balanço de energia que o ONS publica por subsistema, ao lado da geração das usinas hidráulicas, térmicas, eólicas e fotovoltaicas.", "It is the demand side of the energy balance that the ONS publishes by subsystem, alongside the generation of hydro, thermal, wind and photovoltaic plants."),
      comoEMedido:
        tx("Em MWmed. O conteúdo mudou ao longo do tempo: até fev/2021, carga atendida por usinas despachadas ou programadas pelo ONS; de mar/2021 a abr/2023, soma-se a previsão de usinas não despachadas; desde 29/04/2023, soma-se a estimativa da micro e minigeração distribuída.", "In MWavg. The content changed over time: until Feb 2021, load served by plants dispatched or scheduled by the ONS; from Mar 2021 to Apr 2023, the forecast of plants not dispatched is added; since Apr 29, 2023, the estimate of distributed micro and mini generation is added."),
      relacoes: ["geracao-distribuida", "geracao-centralizada"],
      fontes: [
        // i18n: dado
        ONS("carga-energia", "Carga de Energia Diária", TRECHO_CARGA),
        // i18n: dado
        ONS("balanco-energia-subsistema", "Balanço de Energia nos Subsistemas", TRECHO_BALANCO),
      ],
      limitacoes: [tx("Comparações que atravessam 01/03/2021 ou 29/04/2023 não são homogêneas.", "Comparisons that cross Mar 1, 2021 or Apr 29, 2023 are not homogeneous.")],
      vejaNoPortal: [{ rotulo: tx("Carga e consumo", "Load and consumption"), href: "/setor-eletrico/carga" }],
    },
    {
      slug: "geracao-centralizada",
      nome: tx("Geração verificada", "Verified generation"),
      grupo: "Operação", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-09-28",
      emUmaFrase:
        tx("Geração das usinas hidráulicas, térmicas, eólicas e fotovoltaicas no balanço de energia do ONS, verificada hora a hora por subsistema.", "Generation of hydro, thermal, wind and photovoltaic plants in the ONS energy balance, verified hour by hour by subsystem."),
      porQueImporta: tx("Mostra, hora a hora e por subsistema, a oferta de energia por fonte ao lado da carga verificada.", "It shows, hour by hour and by subsystem, the energy supply by source alongside the verified load."),
      comoEMedido: tx("Em MWmed, por hora e por subsistema, no Balanço de Energia nos Subsistemas do ONS.", "In MWavg, by hour and by subsystem, in the ONS «Balanço de Energia nos Subsistemas»."),
      relacoes: ["carga", "geracao-distribuida"],
      fontes: [
        // i18n: dado
        ONS("balanco-energia-subsistema", "Balanço de Energia nos Subsistemas", TRECHO_BALANCO),
      ],
      limitacoes: [
        tx("O balanço não separa as térmicas por combustível.", "The balance does not separate thermal plants by fuel."),
        tx("Em 29/04/2023 a solar do SIN no balanço mais que dobra de um dia para o outro, na mesma data em que o ONS passa a incluir na carga a estimativa de micro e minigeração distribuída. A leitura de que o salto é essa estimativa é da Scrutiniums, a partir do dado, e não foi conferida em documento do ONS. Comparações que atravessam a data não são homogêneas.", "On Apr 29, 2023, SIN solar in the balance more than doubles from one day to the next, on the same date on which the ONS starts to include the estimate of distributed micro and mini generation in the load. The reading that the jump is this estimate is Scrutiniums', based on the data, and was not checked in an ONS document. Comparisons that cross the date are not homogeneous."),
      ],
      vejaNoPortal: [{ rotulo: tx("Como estamos gerando", "How we are generating"), href: "/setor-eletrico/geracao" }],
    },
    {
      slug: "geracao-distribuida",
      sigla: "MMGD",
      nome: tx("Micro e minigeração distribuída", "Distributed micro and mini generation"),
      grupo: "Operação", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-09-28",
      emUmaFrase:
        tx("Geração conectada por meio de unidades consumidoras, conforme regulamentado no art. 655-W da Resolução Normativa ANEEL 1.000/2021.", "Generation connected through consumer units, as regulated in art. 655-W of ANEEL Normative Resolution 1.000/2021."),
      porQueImporta:
        tx("É geração conectada por meio de unidades consumidoras; desde 29/04/2023 o ONS incorpora uma estimativa dela aos dados de carga.", "It is generation connected through consumer units; since Apr 29, 2023 the ONS incorporates an estimate of it into the load data."),
      comoEMedido:
        tx("A ANEEL publica a relação de empreendimentos por distribuidora, município, fonte e potência. A geração em si é estimada pelo ONS com dados meteorológicos previstos.", "ANEEL publishes the list of installations by distribution utility, municipality, source and capacity. The generation itself is estimated by the ONS with forecast weather data."),
      relacoes: ["carga", "geracao-centralizada"],
      fontes: [
        {
          orgao: "ANEEL",
          documento: tx('Portal de dados abertos, conjunto "Relação de empreendimentos de Mini e Micro Geração Distribuída"', "Open data portal, dataset «Relação de empreendimentos de Mini e Micro Geração Distribuída»"),
          url: "https://dadosabertos.aneel.gov.br/dataset/relacao-de-empreendimentos-de-geracao-distribuida",
          trecho:
            // i18n: dado
            "dados referentes às conexões de microgeração e minigeração distribuída (MMGD) por meio de unidades consumidoras, conforme regulamentado no art. 655-W da Resolução Normativa ANEEL 1.000/2021",
        },
        // i18n: dado
        ONS("carga-energia", "Carga de Energia Diária", TRECHO_CARGA),
      ],
      limitacoes: [tx("A relação de empreendimentos da ANEEL está catalogada e ainda não integrada.", "The ANEEL list of installations is cataloged and not yet integrated.")],
      vejaNoPortal: [{ rotulo: tx("Carga e consumo", "Load and consumption"), href: "/setor-eletrico/carga" }],
    },
    {
      slug: "intercambio",
      nome: tx("Intercâmbio entre subsistemas", "Interchange between subsystems"),
      grupo: "Operação", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-09-28",
      emUmaFrase:
        tx("Fluxo de energia entre subsistemas, medido pela soma dos fluxos de potência ativa nas linhas de transmissão de fronteira.", "Energy flow between subsystems, measured as the sum of active power flows on the border transmission lines."),
      porQueImporta: tx("Mostra quanta energia uma região está enviando ou recebendo das outras.", "It shows how much energy a region is sending to or receiving from the others."),
      comoEMedido: tx("Em MWmed, por hora, verificado e programado, no conjunto Intercâmbios Entre Subsistemas do ONS.", "In MWavg, by hour, verified and scheduled, in the ONS dataset «Intercâmbios Entre Subsistemas»."),
      relacoes: ["submercado"],
      fontes: [
        // i18n: dado
        ONS("intercambio-nacional", "Intercâmbios Entre Subsistemas",
          // i18n: dado
          "As grandezas representam a soma das medidas de fluxo de potência ativa nas linhas de transmissão de fronteira entre os subsistemas."),
      ],
      limitacoes: [tx("Os limites de intercâmbio não estão neste conjunto e não estão integrados ao portal.", "The interchange limits are not in this dataset and are not integrated into the portal.")],
      vejaNoPortal: [{ rotulo: tx("A rede está limitando o sistema?", "Is the grid limiting the system?"), href: "/setor-eletrico/rede" }],
    },
    {
      slug: "constrained-off",
      nome: "Constrained-off",
      grupo: "Operação", // i18n: dado
      estado: "PENDENTE",
      relacoes: ["geracao-centralizada"],
      // i18n: dado
      fontes: [ONS("restricao_coff_eolica_usi", "Restrição de Operação por Constrained-off de Usinas Eólicas")],
      fontePlanejada:
        tx("Regulamentação da ANEEL sobre restrições de operação e a rotina operacional RO-AO.BR.13 do ONS. Consultados em 06/10/2026 sem definição do termo: a descrição e o dicionário de dados do conjunto de restrição de eólicas do ONS, que descrevem a apuração e as razões da restrição, não o termo.", "ANEEL regulations on operating restrictions and the ONS operating routine RO-AO.BR.13. Consulted on Oct 6, 2026 without a definition of the term: the description and data dictionary of the ONS wind restriction dataset, which describe the determination and the reasons for the restriction, not the term."),
      vejaNoPortal: [{ rotulo: tx("Geração: renováveis restringidas", "Generation: curtailed renewables"), href: "/setor-eletrico/geracao/restricoes" }],
    },
    {
      slug: "newave",
      sigla: "NEWAVE",
      nome: "NEWAVE",
      grupo: "Modelos", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-09-27",
      emUmaFrase: tx("Um dos três modelos computacionais citados pela CCEE no cálculo do PLD, ao lado do DECOMP e do DESSEM.", "One of the three computer models cited by the CCEE in calculating the PLD, alongside DECOMP and DESSEM."),
      porQueImporta: tx("A CCEE informa que o cálculo do PLD é realizado por modelos computacionais, entre eles o NEWAVE. O papel de cada modelo na cadeia não foi conferido em documento técnico.", "The CCEE states that the PLD is calculated by computer models, among them NEWAVE. The role of each model in the chain was not checked in a technical document."),
      comoEMedido: tx("Modelo computacional; não é uma grandeza. Horizonte e formulação não foram conferidos em documento técnico.", "Computer model; not a quantity. Horizon and formulation were not checked in a technical document."),
      relacoes: ["decomp", "dessem", "cmo", "pld"],
      fontes: [
        CCEE_PLD,
        // i18n: dado
        ONS("cvu-usitermica", "CVU das Usina Térmicas",
          // i18n: dado
          "Custo Variável Unitário (CVU) de usinas térmicas considerado no Programa Mensal da Operação, conforme utilizado na execução do modelo NEWAVE, DECOMP, DESSEM, além de seu uso nas decisões de programação e acompanhamentos dos custos da operação."),
      ],
      limitacoes: [tx("A documentação técnica do modelo não foi lida.", "The technical documentation of the model was not read.")],
      vejaNoPortal: [{ rotulo: tx("De onde vem o preço", "Where the price comes from"), href: "/setor-eletrico/pld#formacao" }],
    },
    {
      slug: "decomp",
      sigla: "DECOMP",
      nome: "DECOMP",
      grupo: "Modelos", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-09-28",
      emUmaFrase: tx("Modelo que estima o CMO publicado pelo ONS para cada semana operativa, por subsistema e patamar de carga.", "Model that estimates the CMO published by the ONS for each operating week, by subsystem and load level."),
      porQueImporta: tx("Segundo o ONS, é o modelo que estima o CMO semanal publicado por subsistema e patamar de carga; a CCEE o cita entre os modelos do cálculo do PLD.", "According to the ONS, it is the model that estimates the weekly CMO published by subsystem and load level; the CCEE cites it among the models used in calculating the PLD."),
      comoEMedido: tx("Modelo computacional; sua saída publicada pelo ONS é o CMO semanal por subsistema e patamar de carga.", "Computer model; its output published by the ONS is the weekly CMO by subsystem and load level."),
      relacoes: ["cmo", "newave", "dessem"],
      fontes: [ONS("cmo-semanal", "CMO Semanal", TRECHO_CMO_SEMANAL), CCEE_PLD],
      vejaNoPortal: [{ rotulo: tx("CMO semanal", "Weekly CMO"), href: "/setor-eletrico/pld#formacao" }],
    },
    {
      slug: "dessem",
      sigla: "DESSEM",
      nome: "DESSEM",
      grupo: "Modelos", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-09-28",
      emUmaFrase: tx("Modelo que estima o CMO em base semi-horária para cada barra do sistema, segundo o ONS.", "Model that estimates the CMO on a half-hourly basis for each bus of the system, according to the ONS."),
      porQueImporta:
        tx("A CCEE cita o DESSEM entre os modelos do cálculo do PLD, que sai por hora. O CMO que o ONS publica a partir dele é semi-horário, mais fino que o CMO semanal do DECOMP.", "The CCEE cites DESSEM among the models used in calculating the PLD, which is hourly. The CMO that the ONS publishes from it is half-hourly, finer than the weekly CMO of DECOMP."),
      comoEMedido:
        tx("Modelo computacional, não uma grandeza. O ONS publica o CMO que ele estima a cada meia hora, por barra; o CMO do subsistema é a média dos CMOs das barras ponderada pelas cargas. No exemplo, o observatório usa o CMO do subsistema e faz a média dele nas meias horas da semana operativa.", "Computer model, not a quantity. The ONS publishes the CMO it estimates every half hour, by bus; the CMO of the subsystem is the average of the CMOs of the buses weighted by the loads. In the example, the observatory uses the CMO of the subsystem and averages it over the half hours of the operating week."),
      relacoes: ["cmo", "decomp", "pld"],
      limitacoes: [
        tx("A fonte descreve o DESSEM só pelo CMO que ele estima; a documentação técnica do modelo não foi lida.", "The source describes DESSEM only through the CMO it estimates; the technical documentation of the model was not read."),
        tx("O CMO semi-horário não é o PLD: o PLD aplica limites regulatórios e é calculado pela CCEE em base horária.", "The half-hourly CMO is not the PLD: the PLD applies regulatory limits and is calculated by the CCEE on an hourly basis."),
      ],
      // i18n: dado
      fontes: [ONS("cmo-semi-horario", "CMO Semi-Horário", TRECHO_CMO_SEMI), CCEE_PLD],
      vejaNoPortal: [{ rotulo: tx("De onde vem o preço", "Where the price comes from"), href: "/setor-eletrico/pld#formacao" }],
    },
    {
      slug: "acl",
      sigla: "ACL",
      nome: tx("Ambiente de Contratação Livre", "Free contracting environment"),
      grupo: "Mercado", // i18n: dado
      estado: "PENDENTE",
      relacoes: ["acr", "pld"],
      fontes: [],
      fontePlanejada: tx("Lei nº 10.848/2004, Decreto nº 5.163/2004 e documentação da CCEE.", "Law No. 10.848/2004, Decree No. 5.163/2004 and CCEE documentation."),
      vejaNoPortal: [{ rotulo: tx("Mercado: livre e regulado", "Market: free and regulated"), href: "/setor-eletrico/mercado" }],
    },
    {
      slug: "acr",
      sigla: "ACR",
      nome: tx("Ambiente de Contratação Regulada", "Regulated contracting environment"),
      grupo: "Mercado", // i18n: dado
      estado: "PENDENTE",
      relacoes: ["acl"],
      fontes: [],
      fontePlanejada: tx("Lei nº 10.848/2004, Decreto nº 5.163/2004 e documentação da CCEE.", "Law No. 10.848/2004, Decree No. 5.163/2004 and CCEE documentation."),
      vejaNoPortal: [{ rotulo: tx("Mercado: livre e regulado", "Market: free and regulated"), href: "/setor-eletrico/mercado" }],
    },
    {
      slug: "mre",
      sigla: "MRE",
      nome: tx("Mecanismo de Realocação de Energia", "Energy Reallocation Mechanism"),
      grupo: "Mercado", // i18n: dado
      estado: "PENDENTE",
      relacoes: ["gsf", "garantia-fisica"],
      fontes: [],
      fontePlanejada: tx("Regras de Comercialização da CCEE.", "CCEE Trading Rules."),
      vejaNoPortal: [{ rotulo: tx("Mercado: MRE e GSF", "Market: MRE and GSF"), href: "/setor-eletrico/mercado/mre-e-gsf" }],
    },
    {
      slug: "gsf",
      sigla: "GSF",
      nome: "Generation Scaling Factor",
      grupo: "Mercado", // i18n: dado
      estado: "PENDENTE",
      relacoes: ["mre", "garantia-fisica"],
      fontes: [],
      fontePlanejada:
        tx("Regras de Comercialização da CCEE (módulo do MRE). Consultados em 06/10/2026 sem definição do fator: o Decreto nº 5.163/2004, a Lei nº 10.848/2004 e o glossário do InfoMercado Nº 229 da CCEE, que usa a expressão \"fator de ajuste do MRE\" sem defini-la.", "CCEE Trading Rules (MRE module). Consulted on Oct 6, 2026 without a definition of the factor: Decree No. 5.163/2004, Law No. 10.848/2004 and the glossary of CCEE InfoMercado No. 229, which uses the expression «fator de ajuste do MRE» (MRE adjustment factor) without defining it."),
      vejaNoPortal: [{ rotulo: tx("Mercado: MRE e GSF", "Market: MRE and GSF"), href: "/setor-eletrico/mercado/mre-e-gsf" }],
    },
    {
      slug: "ess",
      sigla: "ESS",
      nome: tx("Encargos de Serviços do Sistema", "System Service Charges"),
      grupo: "Mercado", // i18n: dado
      estado: "PENDENTE",
      relacoes: ["pld"],
      fontes: [],
      fontePlanejada: tx("Regras de Comercialização da CCEE e regulamentação da ANEEL.", "CCEE Trading Rules and ANEEL regulations."),
      vejaNoPortal: [{ rotulo: tx("Mercado: encargos e liquidação", "Market: charges and settlement"), href: "/setor-eletrico/mercado/encargos" }],
    },
    {
      slug: "garantia-fisica",
      nome: tx("Garantia física", "Physical guarantee"),
      grupo: "Mercado", // i18n: dado
      estado: "PENDENTE",
      relacoes: ["mre", "gsf"],
      fontes: [],
      fontePlanejada: tx("Decreto nº 5.163/2004 e portarias do MME.", "Decree No. 5.163/2004 and MME ordinances."),
      vejaNoPortal: [{ rotulo: tx("Mercado: MRE e GSF", "Market: MRE and GSF"), href: "/setor-eletrico/mercado/mre-e-gsf" }],
    },
  ];
}
const CONCEITOS_BASE_IDIOMAS = montarNosDoisIdiomas(montarConceitosBase);

/**
 * Verbetes dos módulos temáticos ficam em conceitos-<modulo>.ts (reunidos em
 * conceitos-modulos.ts). Um verbete de módulo com o mesmo slug de um verbete base
 * o substitui: é assim que um verbete PENDENTE vira CONFERIDO quando o módulo que
 * conferiu a fonte primária o publica, sem duplicar a entrada.
 */
function reunir(base: Conceito[], modulos: Conceito[]): Conceito[] {
  const substitutos = new Map(modulos.map((c) => [c.slug, c]));
  return [...base.map((c) => substitutos.get(c.slug) ?? c), ...modulos.filter((c) => !base.some((b) => b.slug === c.slug))];
}

/** O acervo nos dois idiomas: mesmos verbetes, na mesma ordem, com os mesmos slugs, estados, datas e endereços. */
export const CONCEITOS_IDIOMAS: Record<Idioma, Conceito[]> = {
  pt: reunir(CONCEITOS_BASE_IDIOMAS.pt, CONCEITOS_MODULOS_IDIOMAS.pt),
  en: reunir(CONCEITOS_BASE_IDIOMAS.en, CONCEITOS_MODULOS_IDIOMAS.en),
};

/** O acervo em português (a forma de sempre; testes, sitemap e quem só precisa de slug, estado e data). */
export const CONCEITOS: Conceito[] = CONCEITOS_IDIOMAS.pt;

/** O acervo no idioma da página (no servidor, o idioma vem do endereço da renderização). */
export function conceitos(idioma: Idioma = idiomaEnergia()): Conceito[] {
  return CONCEITOS_IDIOMAS[idioma];
}

/** Um verbete no idioma da página; em português, o mesmo objeto de CONCEITOS. */
export function conceito(slug: string, idioma: Idioma = idiomaEnergia()): Conceito | undefined {
  return CONCEITOS_IDIOMAS[idioma].find((c) => c.slug === slug);
}

/** Temas na ordem do índice (chaves portuguesas, também nas âncoras; o nome inglês vem de rotuloGrupoConceito). */
const ORDEM_GRUPOS: GrupoConceito[] = [
  "Preço", // i18n: dado
  "Água", // i18n: dado
  "Operação", // i18n: dado
  "Rede", // i18n: dado
  "Modelos", // i18n: dado
  "Mercado", // i18n: dado
  "Consumidor", // i18n: dado
  "Qualidade e perdas", // i18n: dado
  "Inclusão", // i18n: dado
  "Empresas", // i18n: dado
  "Expansão", // i18n: dado
  "Transição", // i18n: dado
  "Regulação", // i18n: dado
  "Fontes de dados", // i18n: dado
];
export const GRUPOS: GrupoConceito[] = ORDEM_GRUPOS.filter((g) => CONCEITOS.some((c) => c.grupo === g));
