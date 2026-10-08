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

import { CONCEITOS_MODULOS } from "./conceitos-modulos";

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

const ONS = (id: string, titulo: string, trecho?: string): FonteOficial => ({
  orgao: "ONS",
  documento: `Portal de dados abertos, conjunto "${titulo}" (descrição e dicionário de dados)`,
  url: `https://dados.ons.org.br/dataset/${id}`,
  trecho,
});

const CCEE_PLD: FonteOficial = {
  orgao: "CCEE",
  documento: "Portal de dados abertos, organização Preço de Liquidação das Diferenças e conjunto PLD_HORARIO (descrição oficial)",
  url: "https://dadosabertos.ccee.org.br/dataset/pld_horario",
  trecho:
    "O Preço de Liquidação das Diferenças (PLD) é calculado pela Câmara de Comercialização de Energia Elétrica (CCEE) diariamente para cada hora do dia seguinte, considerando a aplicação dos limites máximos (horário e estrutural) e mínimo vigentes para cada período de apuração e para cada submercado. Este cálculo é realizado por modelos computacionais (Newave, Decomp e Dessem) e tem como base o Custo Marginal de Operação (CMO).",
  parafrase:
    "Em outras palavras: todo dia a CCEE calcula os preços de cada hora do dia seguinte, em cada submercado, com três modelos computacionais, partindo do custo marginal de operação e respeitando um limite mínimo e dois limites máximos.",
};

const TRECHO_CMO_SEMANAL =
  "Valores do custo, por unidade de energia produzida, para atender ao incremento de uma unidade de carga no SIN, chamado de Custo Marginal de Operação – CMO. Valores para cada semana operativa por subsistema, e por patamar de carga, além da média semanal, estimados pelo modelo Decomp.";
const TRECHO_CMO_SEMI =
  "Este CMO é estimado pelo modelo DESSEM para cada barra do sistema em base semi-horária. O CMO do subsistema é obtido pelo média dos CMOs nas barras de cada subsistema, ponderados pelas respectivas cargas [...]";
const TRECHO_EAR =
  "A Energia Armazenada (EAR) representa a energia associada ao volume de água disponível nos reservatórios que pode ser convertido em geração na própria usina e em todas as usinas à jusante na cascata. A grandeza de EAR leva em conta nível verificado nos reservatórios na data de referência. A grandeza de EAR máxima representa a capacidade de armazenamento caso todos os reservatórios do sistema estivessem cheios.";
const TRECHO_BALANCO =
  "Informações da carga e oferta de energia verificados em periodicidade horária por subsistema. A oferta é representada pelos valores de geração das usinas hidráulicas, térmicas, eólicas e fotovoltaicas, em MWmed.";
const TRECHO_CARGA =
  "Dados de carga por subsistema em base diária, medida em MWmed. Até fevereiro/2021, os dados representam a carga atendida por usinas despachadas e/ou programadas pelo ONS, com base em dados recebidos pelo Sistema de Supervisão e Controle do ONS. Entre março/2021 e abril/23, os dados representam a carga atendida por usinas despachadas e/ou programadas pelo ONS, com base em dados recebidos pelo Sistema de Supervisão e Controle do ONS, mais a previsão de geração de usinas não despachadas pelo ONS. A partir de 29/04/2023, além dos dados anteriormente considerados, passou a ser incorporado o valor estimado da micro e minigeração distribuída (MMGD), com base em dados meteorológicos previstos.";

const CCEE_MCP: FonteOficial = {
  orgao: "CCEE",
  documento:
    "Portal de dados abertos, conjuntos PLD_HORARIO_SUBMERCADO e SUMARIO_BE_HORARIO_SUBMERCADO (descrição dos recursos), capturados em 28/09/2026",
  url: "https://dadosabertos.ccee.org.br/dataset/sumario_be_horario_submercado",
  trecho:
    "Detalhar os valores do Preço de Liquidação das Diferenças do MCP por mês de referência, período de comercialização e submercado. [...] PERIODO_COMERCIALIZACAO: Representa o período de comercialização, equivalente a uma hora [...] BE_POSITIVO: Corresponde ao Balanço Energético positivo do perfil de agente “a” no submercado “s” para o período de comercialização “j” [...] RESULTADO_MCP: Corresponde ao Resultado no Mercado de Curto Prazo do perfil de agente “a”, no submercado “s”, por período de comercialização “j”. [...]",
  parafrase:
    "Em outras palavras: o PLD é o preço do Mercado de Curto Prazo. A CCEE define, para cada perfil de agente, submercado e hora, o balanço de energia (positivo ou negativo) e o resultado nesse mercado; o conjunto publica esses valores por submercado e hora.",
};

const CCEE_MCP_MENSAL: FonteOficial = {
  orgao: "CCEE",
  documento: "Portal de dados abertos, conjunto SUMARIO_MENSAL_COMPRA_VENDA_SUBMERCADO (descrição do recurso), capturado em 28/09/2026",
  url: "https://dadosabertos.ccee.org.br/dataset/sumario_mensal_compra_venda_submercado",
  trecho:
    "Detalhar o balanço energético e resultado do MCP por submercado e por mês de referência. [...] RESULTADO_MCP_VENDA: Corresponde ao Resultado no Mercado de Curto Prazo de venda do perfil de agente “a”, no submercado “s”, por período de comercialização “j” consolidado no mês.",
  parafrase: "Em outras palavras: no consolidado do mês, a CCEE publica por submercado o resultado de venda e o de compra no Mercado de Curto Prazo.",
};

const REN_957: FonteOficial = {
  orgao: "ANEEL",
  documento: "Resolução Normativa nº 957, de 7 de dezembro de 2021 (Convenção de Comercialização), art. 2º, inciso XIII, e art. 5º, § 4º (texto compilado, lido na cópia do Internet Archive de 01/06/2025)",
  url: "https://www2.aneel.gov.br/cedoc/ren2021957.pdf",
  trecho:
    "XIII – Mercado de Curto Prazo – MCP: denominação do processo em que se procede à contabilização e liquidação financeira das diferenças apuradas entre os montantes de energia elétrica seguintes: a) contratados, registrados e validados pelos agentes da CCEE, cujo registro tenha sido efetivado pela Câmara; e b) de geração ou de consumo efetivamente verificados e atribuídos aos respectivos agentes da CCEE; [...] § 4º As operações realizadas no MCP serão contabilizadas pela CCEE de acordo com as Regras e Procedimentos de Comercialização, [...] devendo as exposições dos agentes da CCEE serem valoradas ao PLD.",
  parafrase:
    "Em outras palavras: o Mercado de Curto Prazo é o processo em que a CCEE contabiliza e liquida financeiramente as diferenças entre a energia contratada e registrada pelos agentes e a energia de geração ou de consumo efetivamente verificada, e as exposições dos agentes são valoradas ao PLD.",
};

const CONCEITOS_BASE: Conceito[] = [
  {
    slug: "pld",
    sigla: "PLD",
    nome: "Preço de Liquidação das Diferenças",
    grupo: "Preço",
    estado: "CONFERIDO",
    conferidoEm: "2026-09-28",
    revisadoEm: "2026-10-07",
    emUmaFrase:
      "Preço do Mercado de Curto Prazo, ao qual a CCEE valora as exposições dos agentes, isto é, as diferenças entre a energia contratada e a efetivamente verificada; é calculado pela CCEE diariamente para cada hora do dia seguinte e para cada submercado, com base no Custo Marginal de Operação e dentro dos limites mínimo e máximos vigentes.",
    porQueImporta:
      "No Mercado de Curto Prazo, a CCEE contabiliza as diferenças entre a energia que cada agente contratou e a que efetivamente gerou ou consumiu, e as exposições são valoradas ao PLD (REN ANEEL nº 957/2021). Para cada perfil de agente, submercado e hora, a CCEE apura um balanço energético em MWh (positivo ou negativo) e um resultado em R$. O PLD tem como base o CMO, que o ONS define como o custo, por unidade de energia produzida, para atender ao incremento de uma unidade de carga no SIN. Como o balanço de cada agente é formado em detalhe está nas Regras de Comercialização da CCEE, que este verbete não lê.",
    comoEMedido:
      "Em reais por megawatt-hora (R$/MWh), unidade usual de preço de energia; a descrição do conjunto na CCEE registra a unidade apenas como R$. Um valor por hora e por submercado, no conjunto PLD_HORARIO. Médias diárias, semanais ou mensais são agregações dessas horas.",
    relacoes: ["cmo", "submercado", "newave", "decomp", "dessem"],
    fontes: [
      CCEE_PLD,
      CCEE_MCP,
      REN_957,
      ONS("cmo-semanal", "CMO Semanal", TRECHO_CMO_SEMANAL),
      {
        orgao: "ANEEL",
        documento: 'Portal de dados abertos, conjunto "Tarifas de aplicação das distribuidoras de energia elétrica"',
        url: "https://dadosabertos.aneel.gov.br/dataset/tarifas-distribuidoras-energia-eletrica",
        trecho:
          "Apresenta os valores das Tarifas de Energia - TE e das Tarifas de Uso do Sistema de Distribuição - TUSD, resultantes dos processos de reajustes tarifários das distribuidoras de energia elétrica.",
      },
    ],
    limitacoes: [
      "O PLD não é a tarifa do consumidor atendido pela distribuidora: essa conta segue os valores da Tarifa de Energia (TE) e da Tarifa de Uso do Sistema de Distribuição (TUSD), resultantes dos processos tarifários da ANEEL.",
      "Os limites mínimo e máximos mudam a cada ano; comparações longas em valores nominais misturam regimes de limites.",
    ],
    vejaNoPortal: [
      { rotulo: "PLD explicado", href: "/setor-eletrico/pld" },
      { rotulo: "PLD dos quatro submercados no último dia publicado", href: "/setor-eletrico/pld#hoje" },
    ],
  },
  {
    slug: "mcp",
    sigla: "MCP",
    nome: "Mercado de Curto Prazo",
    grupo: "Mercado",
    estado: "CONFERIDO",
    conferidoEm: "2026-09-28",
    revisadoEm: "2026-10-07",
    emUmaFrase:
      "Processo em que a CCEE contabiliza e liquida financeiramente as diferenças entre a energia contratada e registrada pelos agentes e a energia de geração ou de consumo efetivamente verificada, com as exposições valoradas ao PLD. A CCEE define o balanço de energia (MWh) e o resultado (R$) de cada perfil de agente por submercado e hora.",
    porQueImporta:
      "É onde o PLD é usado como preço. A CCEE publica, por hora e submercado, os totais de balanço positivo e negativo e o resultado no MCP; no consolidado do mês, o resultado de venda e o de compra.",
    comoEMedido:
      "Em MWh (balanço) e R$ (resultado), somados por submercado e período de comercialização de uma hora (SUMARIO_BE_HORARIO_SUBMERCADO) e por mês (SUMARIO_MENSAL_COMPRA_VENDA_SUBMERCADO). O observatório integra o resumo mensal por submercado e a liquidação mensal (SUMARIO_MENSAL_LIQUIDACAO) no módulo Mercado; o resumo horário ainda não.",
    relacoes: ["pld", "submercado"],
    fontes: [REN_957, CCEE_MCP, CCEE_MCP_MENSAL],
    limitacoes: [
      "Como o balanço de cada perfil de agente é formado (contratos, geração e consumo medidos) e como o resultado é liquidado, em detalhe, está nas Regras de Comercialização da CCEE, que este verbete não lê.",
    ],
    vejaNoPortal: [
      { rotulo: "O PLD no Mercado de Curto Prazo", href: "/setor-eletrico/pld#o-que-e" },
      { rotulo: "Mercado: encargos e liquidação", href: "/setor-eletrico/mercado/encargos" },
    ],
  },
  {
    slug: "cmo",
    sigla: "CMO",
    nome: "Custo Marginal de Operação",
    grupo: "Preço",
    estado: "CONFERIDO",
    conferidoEm: "2026-09-28",
    emUmaFrase:
      "Custo, por unidade de energia produzida, para atender ao incremento de uma unidade de carga no sistema interligado.",
    porQueImporta:
      "É a base do PLD, segundo a CCEE. O ONS publica o CMO por semana operativa (estimado pelo modelo DECOMP) e em base semi-horária por barra (estimado pelo modelo DESSEM).",
    comoEMedido:
      "Em reais por unidade de energia (exibido como R$/MWh, como a definição do ONS, \"custo, por unidade de energia produzida\"; o dicionário de dados do ONS registra a unidade da média semanal como R$/MW), por subsistema e por patamar de carga (leve, média, pesada) na versão semanal. Na versão semi-horária, o CMO do subsistema é a média dos CMOs das barras ponderada pelas cargas.",
    relacoes: ["pld", "decomp", "dessem", "carga"],
    fontes: [
      ONS("cmo-semanal", "CMO Semanal", TRECHO_CMO_SEMANAL),
      ONS("cmo-semi-horario", "CMO Semi-Horário", TRECHO_CMO_SEMI),
      CCEE_PLD,
    ],
    limitacoes: ["CMO não é PLD: o PLD aplica limites regulatórios e é calculado pela CCEE em base horária."],
    vejaNoPortal: [{ rotulo: "CMO na formação do PLD", href: "/setor-eletrico/pld#formacao" }],
  },
  {
    slug: "submercado",
    nome: "Submercado",
    grupo: "Preço",
    estado: "CONFERIDO",
    conferidoEm: "2026-09-28",
    emUmaFrase:
      "Cada uma das quatro divisões do SIN para as quais a CCEE calcula um PLD próprio: Norte, Nordeste, Sul e Sudeste (esta plataforma usa o rótulo Sudeste/Centro-Oeste para o último).",
    porQueImporta:
      "Os quatro valores de cada hora podem coincidir ou diferir. Por que diferem (limites de transmissão entre regiões, por exemplo) é matéria dos modelos e das regras da CCEE e do ONS, que este verbete não lê: a plataforma mostra a diferença observada e o intercâmbio medido, sem atribuir causa.",
    comoEMedido:
      "O conjunto PLD_HORARIO traz um valor por hora para cada submercado. Nos conjuntos do ONS usados aqui, o campo de região é o subsistema, identificado por SE, S, NE e N.",
    relacoes: ["pld", "intercambio"],
    fontes: [
      CCEE_PLD,
      {
        orgao: "CCEE",
        documento: "Portal de dados abertos, conjunto PLD_HORARIO_SUBMERCADO (descrição do campo SUBMERCADO), capturado em 28/09/2026",
        url: "https://dadosabertos.ccee.org.br/dataset/pld_horario_submercado",
        trecho: "Representa os quatro (4) submercados de atuação no SIN  - Sistema Interligado Nacional correspondentes a Norte (N), Nordeste (NE), Sul (S) e Sudeste (SE).",
      },
    ],
    vejaNoPortal: [{ rotulo: "Por que os submercados diferem", href: "/setor-eletrico/pld#submercados" }],
  },
  {
    slug: "sin",
    sigla: "SIN",
    nome: "Sistema Interligado Nacional",
    grupo: "Operação",
    estado: "CONFERIDO",
    conferidoEm: "2026-09-28",
    emUmaFrase:
      "Nome do sistema elétrico interligado do país. A CCEE descreve os quatro submercados (Norte, Nordeste, Sul e Sudeste) como submercados \"de atuação no SIN\".",
    porQueImporta:
      "Nos conjuntos do ONS usados aqui, os valores vêm por subsistema (N, NE, S e SE). Quando a plataforma mostra um valor do SIN, como a EAR ou a carga do SIN, ela o calcula a partir dos quatro, com a regra declarada no indicador.",
    comoEMedido:
      "Não é uma grandeza: é o recorte. Quando a plataforma calcula um valor para o SIN, a regra do indicador diz como (por exemplo, a EAR do SIN é a soma das EAR dos subsistemas dividida pela soma das EAR máximas).",
    relacoes: ["submercado", "intercambio"],
    fontes: [
      {
        orgao: "CCEE",
        documento: "Portal de dados abertos, conjunto PLD_HORARIO_SUBMERCADO (descrição do campo SUBMERCADO), capturado em 28/09/2026",
        url: "https://dadosabertos.ccee.org.br/dataset/pld_horario_submercado",
        trecho: "Representa os quatro (4) submercados de atuação no SIN  - Sistema Interligado Nacional correspondentes a Norte (N), Nordeste (NE), Sul (S) e Sudeste (SE).",
      },
    ],
    limitacoes: ["A abrangência física do SIN (quais sistemas isolados ficam de fora) não foi conferida em documento do ONS."],
    vejaNoPortal: [{ rotulo: "Visão geral do sistema", href: "/setor-eletrico/visao-geral" }],
  },
  {
    slug: "cvu",
    sigla: "CVU",
    nome: "Custo Variável Unitário",
    grupo: "Preço",
    estado: "CONFERIDO",
    conferidoEm: "2026-09-28",
    revisadoEm: "2026-10-06",
    emUmaFrase:
      "Valor atribuído a cada usina térmica que o ONS considera no Programa Mensal da Operação e na execução dos modelos NEWAVE, DECOMP e DESSEM. A fonte descreve o CVU pelo uso; o que compõe esse custo não foi conferido.",
    porQueImporta:
      "Segundo o ONS, é usado na execução dos modelos NEWAVE, DECOMP e DESSEM, nas decisões de programação e no acompanhamento dos custos da operação.",
    comoEMedido:
      "Em R$/MWh, por usina térmica e parcela, para cada semana operativa do Programa Mensal da Operação (sábado a sexta), no conjunto CVU das Usinas Térmicas do ONS (dicionário de dados versão 2.0, de 24/09/2025). O observatório publica o CVU da semana vigente por usina e a mediana mensal por combustível no painel de despacho térmico da Geração.",
    relacoes: ["cmo", "newave", "decomp", "dessem"],
    fontes: [
      ONS("cvu-usitermica", "CVU das Usina Térmicas",
        "Custo Variável Unitário (CVU) de usinas térmicas considerado no Programa Mensal da Operação, conforme utilizado na execução do modelo NEWAVE, DECOMP, DESSEM, além de seu uso nas decisões de programação e acompanhamentos dos custos da operação."),
    ],
    limitacoes: [
      "É o valor considerado no Programa Mensal da Operação para a semana: o conjunto não informa o custo realizado nem o preço do combustível.",
      "O que compõe esse custo não foi conferido.",
    ],
    vejaNoPortal: [{ rotulo: "Geração: despacho térmico", href: "/setor-eletrico/geracao/termica#p022" }],
  },
  {
    slug: "ear",
    sigla: "EAR",
    nome: "Energia Armazenada",
    grupo: "Água",
    estado: "CONFERIDO",
    conferidoEm: "2026-09-28",
    emUmaFrase:
      "Energia associada ao volume de água nos reservatórios que pode ser convertido em geração na própria usina e em todas as usinas a jusante na cascata.",
    porQueImporta:
      "Resume em uma grandeza, por subsistema, a energia que a água guardada nos reservatórios pode gerar na própria usina e nas usinas a jusante. Em percentual da EAR máxima, indica quanto da capacidade de armazenamento está ocupada.",
    comoEMedido:
      "Em MWmês e em percentual da EAR máxima (a capacidade caso todos os reservatórios estivessem cheios), por dia e por subsistema, bacia, REE ou reservatório.",
    relacoes: ["ena", "armazenamento", "ree"],
    fontes: [
      ONS("ear-diario-por-subsistema", "EAR Diário por Subsistema", TRECHO_EAR),
    ],
    limitacoes: [
      "Percentual da EAR máxima: a capacidade muda com a entrada de reservatórios, o que afeta comparações longas.",
      "O ONS informa que os dados passam por consistência recorrente e podem ser revisados.",
    ],
    vejaNoPortal: [{ rotulo: "Água e reservatórios", href: "/setor-eletrico/agua-e-clima" }],
  },
  {
    slug: "armazenamento",
    nome: "Capacidade de armazenamento (EAR máxima)",
    grupo: "Água",
    estado: "CONFERIDO",
    conferidoEm: "2026-09-28",
    emUmaFrase: "Energia que os reservatórios guardariam se todos estivessem cheios.",
    porQueImporta: "É a referência dos percentuais de EAR: 60% significa 60% dessa capacidade máxima.",
    comoEMedido: "Em MWmês, por subsistema, no conjunto EAR Diário por Subsistema do ONS (campo EAR máxima).",
    relacoes: ["ear"],
    fontes: [ONS("ear-diario-por-subsistema", "EAR Diário por Subsistema", TRECHO_EAR)],
    vejaNoPortal: [{ rotulo: "Água e reservatórios", href: "/setor-eletrico/agua-e-clima#ear" }],
  },
  {
    slug: "ena",
    sigla: "ENA",
    nome: "Energia Natural Afluente",
    grupo: "Água",
    estado: "CONFERIDO",
    conferidoEm: "2026-09-28",
    emUmaFrase:
      "Energia produzível a partir das vazões naturais aos reservatórios, calculada pelo ONS com as produtividades das usinas a 65% dos volumes úteis.",
    porQueImporta:
      "Expressa em energia as vazões naturais que chegam aos reservatórios. O ONS indica que os dados servem de insumo para estudos energéticos e para a projeção do custo marginal de operação.",
    comoEMedido:
      "ENA bruta: produto das vazões naturais pelas produtividades das usinas a 65% dos volumes úteis. Publicada por dia em energia (colunas terminadas em _mwmed; o dicionário de dados do ONS descreve a unidade como MWmês) e em percentual da média de longo termo (MLT).",
    relacoes: ["ear", "mlt"],
    fontes: [
      ONS("ena-diario-por-subsistema", "ENA Diário por Subsistema",
        "A Energia Natural Afluente (ENA) Bruta representa a energia produzível pela usina e é calculada pelo produto das vazões naturais aos reservatórios com as produtividades a 65% dos volumes úteis. A ENA Armazenável considera as vazões naturais descontadas das vazões vertidas nos reservatórios. [...] os dados podem servir de insumo para estudos energéticos e projeção do custo marginal de operação."),
    ],
    limitacoes: ["O conjunto não informa o período de referência da MLT."],
    vejaNoPortal: [{ rotulo: "Quanta água está chegando", href: "/setor-eletrico/agua-e-clima/afluencia#p018" }],
  },
  {
    slug: "mlt",
    sigla: "MLT",
    nome: "Média de longo termo",
    grupo: "Água",
    estado: "CONFERIDO",
    conferidoEm: "2026-09-28",
    emUmaFrase: "Média de longo termo: a referência em relação à qual o ONS publica a ENA em percentual.",
    porQueImporta: "Permite ler a ENA de subsistemas de tamanhos diferentes na mesma escala relativa: 100% corresponde ao valor da MLT.",
    comoEMedido:
      "O ONS publica a ENA bruta e a ENA armazenável em energia (colunas terminadas em _mwmed, descritas no dicionário como MWmês) e em percentual da MLT. O conjunto não informa como a MLT é calculada nem seu período de referência.",
    relacoes: ["ena"],
    fontes: [
      {
        orgao: "ONS",
        documento: 'Dicionário de dados do conjunto "ENA Diário por Subsistema"',
        url: "https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/ena_subsistema_di/DicionarioDados_EnaPorSubsistema.json",
        trecho: "Valor de ENA bruta por Subsistema medido em percentual por média de longo termo-MLT (%)",
      },
    ],
    limitacoes: ["O método de cálculo e o período de referência da MLT não são informados no conjunto de dados; leituras de \"acima ou abaixo do usual\" usam a distribuição histórica publicada pela plataforma, não a MLT."],
    vejaNoPortal: [{ rotulo: "ENA em % da MLT", href: "/setor-eletrico/agua-e-clima/afluencia#p018" }],
  },
  {
    slug: "ree",
    sigla: "REE",
    nome: "Reservatório Equivalente de Energia",
    grupo: "Água",
    estado: "PENDENTE",
    relacoes: ["ear", "ena"],
    fontes: [ONS("ear-diario-por-ree-reservatorio-equivalente-de-energia", "EAR Diário por REE")],
    fontePlanejada:
      "Procedimentos de Rede do ONS e documentação dos modelos de planejamento. Consultado em 06/10/2026 sem definição do termo: o dicionário de dados do conjunto EAR Diário por REE do ONS, que usa o termo sem defini-lo.",
    vejaNoPortal: [{ rotulo: "Catálogo de dados", href: "/setor-eletrico/dados" }],
  },
  {
    slug: "carga",
    nome: "Carga de energia",
    grupo: "Operação",
    estado: "CONFERIDO",
    conferidoEm: "2026-09-28",
    emUmaFrase: "Carga atendida no sistema interligado, publicada pelo ONS por subsistema em base diária, em MWmed; o que entra na conta mudou em março de 2021 e em abril de 2023.",
    porQueImporta: "É o lado da demanda no balanço de energia que o ONS publica por subsistema, ao lado da geração das usinas hidráulicas, térmicas, eólicas e fotovoltaicas.",
    comoEMedido:
      "Em MWmed. O conteúdo mudou ao longo do tempo: até fev/2021, carga atendida por usinas despachadas ou programadas pelo ONS; de mar/2021 a abr/2023, soma-se a previsão de usinas não despachadas; desde 29/04/2023, soma-se a estimativa da micro e minigeração distribuída.",
    relacoes: ["geracao-distribuida", "geracao-centralizada"],
    fontes: [
      ONS("carga-energia", "Carga de Energia Diária", TRECHO_CARGA),
      ONS("balanco-energia-subsistema", "Balanço de Energia nos Subsistemas", TRECHO_BALANCO),
    ],
    limitacoes: ["Comparações que atravessam 01/03/2021 ou 29/04/2023 não são homogêneas."],
    vejaNoPortal: [{ rotulo: "Carga e consumo", href: "/setor-eletrico/carga" }],
  },
  {
    slug: "geracao-centralizada",
    nome: "Geração verificada",
    grupo: "Operação",
    estado: "CONFERIDO",
    conferidoEm: "2026-09-28",
    emUmaFrase:
      "Geração das usinas hidráulicas, térmicas, eólicas e fotovoltaicas no balanço de energia do ONS, verificada hora a hora por subsistema.",
    porQueImporta: "Mostra, hora a hora e por subsistema, a oferta de energia por fonte ao lado da carga verificada.",
    comoEMedido: "Em MWmed, por hora e por subsistema, no Balanço de Energia nos Subsistemas do ONS.",
    relacoes: ["carga", "geracao-distribuida"],
    fontes: [
      ONS("balanco-energia-subsistema", "Balanço de Energia nos Subsistemas", TRECHO_BALANCO),
    ],
    limitacoes: [
      "O balanço não separa as térmicas por combustível.",
      "Em 29/04/2023 a solar do SIN no balanço mais que dobra de um dia para o outro, na mesma data em que o ONS passa a incluir na carga a estimativa de micro e minigeração distribuída. A leitura de que o salto é essa estimativa é da Scrutiniums, a partir do dado, e não foi conferida em documento do ONS. Comparações que atravessam a data não são homogêneas.",
    ],
    vejaNoPortal: [{ rotulo: "Como estamos gerando", href: "/setor-eletrico/geracao" }],
  },
  {
    slug: "geracao-distribuida",
    sigla: "MMGD",
    nome: "Micro e minigeração distribuída",
    grupo: "Operação",
    estado: "CONFERIDO",
    conferidoEm: "2026-09-28",
    emUmaFrase:
      "Geração conectada por meio de unidades consumidoras, conforme regulamentado no art. 655-W da Resolução Normativa ANEEL 1.000/2021.",
    porQueImporta:
      "É geração conectada por meio de unidades consumidoras; desde 29/04/2023 o ONS incorpora uma estimativa dela aos dados de carga.",
    comoEMedido:
      "A ANEEL publica a relação de empreendimentos por distribuidora, município, fonte e potência. A geração em si é estimada pelo ONS com dados meteorológicos previstos.",
    relacoes: ["carga", "geracao-centralizada"],
    fontes: [
      {
        orgao: "ANEEL",
        documento: 'Portal de dados abertos, conjunto "Relação de empreendimentos de Mini e Micro Geração Distribuída"',
        url: "https://dadosabertos.aneel.gov.br/dataset/relacao-de-empreendimentos-de-geracao-distribuida",
        trecho:
          "dados referentes às conexões de microgeração e minigeração distribuída (MMGD) por meio de unidades consumidoras, conforme regulamentado no art. 655-W da Resolução Normativa ANEEL 1.000/2021",
      },
      ONS("carga-energia", "Carga de Energia Diária", TRECHO_CARGA),
    ],
    limitacoes: ["A relação de empreendimentos da ANEEL está catalogada e ainda não integrada."],
    vejaNoPortal: [{ rotulo: "Carga e consumo", href: "/setor-eletrico/carga" }],
  },
  {
    slug: "intercambio",
    nome: "Intercâmbio entre subsistemas",
    grupo: "Operação",
    estado: "CONFERIDO",
    conferidoEm: "2026-09-28",
    emUmaFrase:
      "Fluxo de energia entre subsistemas, medido pela soma dos fluxos de potência ativa nas linhas de transmissão de fronteira.",
    porQueImporta: "Mostra quanta energia uma região está enviando ou recebendo das outras.",
    comoEMedido: "Em MWmed, por hora, verificado e programado, no conjunto Intercâmbios Entre Subsistemas do ONS.",
    relacoes: ["submercado"],
    fontes: [
      ONS("intercambio-nacional", "Intercâmbios Entre Subsistemas",
        "As grandezas representam a soma das medidas de fluxo de potência ativa nas linhas de transmissão de fronteira entre os subsistemas."),
    ],
    limitacoes: ["Os limites de intercâmbio não estão neste conjunto e não estão integrados ao portal."],
    vejaNoPortal: [{ rotulo: "A rede está limitando o sistema?", href: "/setor-eletrico/rede" }],
  },
  {
    slug: "constrained-off",
    nome: "Constrained-off",
    grupo: "Operação",
    estado: "PENDENTE",
    relacoes: ["geracao-centralizada"],
    fontes: [ONS("restricao_coff_eolica_usi", "Restrição de Operação por Constrained-off de Usinas Eólicas")],
    fontePlanejada:
      "Regulamentação da ANEEL sobre restrições de operação e a rotina operacional RO-AO.BR.13 do ONS. Consultados em 06/10/2026 sem definição do termo: a descrição e o dicionário de dados do conjunto de restrição de eólicas do ONS, que descrevem a apuração e as razões da restrição, não o termo.",
    vejaNoPortal: [{ rotulo: "Geração: renováveis restringidas", href: "/setor-eletrico/geracao/restricoes" }],
  },
  {
    slug: "newave",
    sigla: "NEWAVE",
    nome: "NEWAVE",
    grupo: "Modelos",
    estado: "CONFERIDO",
    conferidoEm: "2026-09-27",
    emUmaFrase: "Um dos três modelos computacionais citados pela CCEE no cálculo do PLD, ao lado do DECOMP e do DESSEM.",
    porQueImporta: "A CCEE informa que o cálculo do PLD é realizado por modelos computacionais, entre eles o NEWAVE. O papel de cada modelo na cadeia não foi conferido em documento técnico.",
    comoEMedido: "Modelo computacional; não é uma grandeza. Horizonte e formulação não foram conferidos em documento técnico.",
    relacoes: ["decomp", "dessem", "cmo", "pld"],
    fontes: [
      CCEE_PLD,
      ONS("cvu-usitermica", "CVU das Usina Térmicas",
        "Custo Variável Unitário (CVU) de usinas térmicas considerado no Programa Mensal da Operação, conforme utilizado na execução do modelo NEWAVE, DECOMP, DESSEM, além de seu uso nas decisões de programação e acompanhamentos dos custos da operação."),
    ],
    limitacoes: ["A documentação técnica do modelo não foi lida."],
    vejaNoPortal: [{ rotulo: "De onde vem o preço", href: "/setor-eletrico/pld#formacao" }],
  },
  {
    slug: "decomp",
    sigla: "DECOMP",
    nome: "DECOMP",
    grupo: "Modelos",
    estado: "CONFERIDO",
    conferidoEm: "2026-09-28",
    emUmaFrase: "Modelo que estima o CMO publicado pelo ONS para cada semana operativa, por subsistema e patamar de carga.",
    porQueImporta: "Segundo o ONS, é o modelo que estima o CMO semanal publicado por subsistema e patamar de carga; a CCEE o cita entre os modelos do cálculo do PLD.",
    comoEMedido: "Modelo computacional; sua saída publicada pelo ONS é o CMO semanal por subsistema e patamar de carga.",
    relacoes: ["cmo", "newave", "dessem"],
    fontes: [ONS("cmo-semanal", "CMO Semanal", TRECHO_CMO_SEMANAL), CCEE_PLD],
    vejaNoPortal: [{ rotulo: "CMO semanal", href: "/setor-eletrico/pld#formacao" }],
  },
  {
    slug: "dessem",
    sigla: "DESSEM",
    nome: "DESSEM",
    grupo: "Modelos",
    estado: "CONFERIDO",
    conferidoEm: "2026-09-28",
    emUmaFrase: "Modelo que estima o CMO em base semi-horária para cada barra do sistema, segundo o ONS.",
    porQueImporta: "Sua saída publicada tem resolução semi-horária, mais fina que a do CMO semanal; a CCEE o cita entre os modelos do cálculo do PLD.",
    comoEMedido: "Modelo computacional; sua saída publicada pelo ONS é o CMO semi-horário por barra e por subsistema.",
    relacoes: ["cmo", "decomp", "pld"],
    fontes: [ONS("cmo-semi-horario", "CMO Semi-Horário", TRECHO_CMO_SEMI), CCEE_PLD],
    vejaNoPortal: [{ rotulo: "De onde vem o preço", href: "/setor-eletrico/pld#formacao" }],
  },
  {
    slug: "acl",
    sigla: "ACL",
    nome: "Ambiente de Contratação Livre",
    grupo: "Mercado",
    estado: "PENDENTE",
    relacoes: ["acr", "pld"],
    fontes: [],
    fontePlanejada: "Lei nº 10.848/2004, Decreto nº 5.163/2004 e documentação da CCEE.",
    vejaNoPortal: [{ rotulo: "Mercado: livre e regulado", href: "/setor-eletrico/mercado" }],
  },
  {
    slug: "acr",
    sigla: "ACR",
    nome: "Ambiente de Contratação Regulada",
    grupo: "Mercado",
    estado: "PENDENTE",
    relacoes: ["acl"],
    fontes: [],
    fontePlanejada: "Lei nº 10.848/2004, Decreto nº 5.163/2004 e documentação da CCEE.",
    vejaNoPortal: [{ rotulo: "Mercado: livre e regulado", href: "/setor-eletrico/mercado" }],
  },
  {
    slug: "mre",
    sigla: "MRE",
    nome: "Mecanismo de Realocação de Energia",
    grupo: "Mercado",
    estado: "PENDENTE",
    relacoes: ["gsf", "garantia-fisica"],
    fontes: [],
    fontePlanejada: "Regras de Comercialização da CCEE.",
    vejaNoPortal: [{ rotulo: "Mercado: MRE e GSF", href: "/setor-eletrico/mercado/mre-e-gsf" }],
  },
  {
    slug: "gsf",
    sigla: "GSF",
    nome: "Generation Scaling Factor",
    grupo: "Mercado",
    estado: "PENDENTE",
    relacoes: ["mre", "garantia-fisica"],
    fontes: [],
    fontePlanejada:
      "Regras de Comercialização da CCEE (módulo do MRE). Consultados em 06/10/2026 sem definição do fator: o Decreto nº 5.163/2004, a Lei nº 10.848/2004 e o glossário do InfoMercado Nº 229 da CCEE, que usa a expressão \"fator de ajuste do MRE\" sem defini-la.",
    vejaNoPortal: [{ rotulo: "Mercado: MRE e GSF", href: "/setor-eletrico/mercado/mre-e-gsf" }],
  },
  {
    slug: "ess",
    sigla: "ESS",
    nome: "Encargos de Serviços do Sistema",
    grupo: "Mercado",
    estado: "PENDENTE",
    relacoes: ["pld"],
    fontes: [],
    fontePlanejada: "Regras de Comercialização da CCEE e regulamentação da ANEEL.",
    vejaNoPortal: [{ rotulo: "Mercado: encargos e liquidação", href: "/setor-eletrico/mercado/encargos" }],
  },
  {
    slug: "garantia-fisica",
    nome: "Garantia física",
    grupo: "Mercado",
    estado: "PENDENTE",
    relacoes: ["mre", "gsf"],
    fontes: [],
    fontePlanejada: "Decreto nº 5.163/2004 e portarias do MME.",
    vejaNoPortal: [{ rotulo: "Mercado: MRE e GSF", href: "/setor-eletrico/mercado/mre-e-gsf" }],
  },
];

/**
 * Verbetes dos módulos temáticos ficam em conceitos-<modulo>.ts (reunidos em
 * conceitos-modulos.ts). Um verbete de módulo com o mesmo slug de um verbete base
 * o substitui: é assim que um verbete PENDENTE vira CONFERIDO quando o módulo que
 * conferiu a fonte primária o publica, sem duplicar a entrada.
 */
const SUBSTITUTOS = new Map(CONCEITOS_MODULOS.map((c) => [c.slug, c]));
export const CONCEITOS: Conceito[] = [
  ...CONCEITOS_BASE.map((c) => SUBSTITUTOS.get(c.slug) ?? c),
  ...CONCEITOS_MODULOS.filter((c) => !CONCEITOS_BASE.some((b) => b.slug === c.slug)),
];

export function conceito(slug: string): Conceito | undefined {
  return CONCEITOS.find((c) => c.slug === slug);
}

export const GRUPOS: GrupoConceito[] = [
  "Preço",
  "Água",
  "Operação",
  "Rede",
  "Modelos",
  "Mercado",
  "Consumidor",
  "Qualidade e perdas",
  "Inclusão",
  "Empresas",
  "Expansão",
  "Transição",
  "Regulação",
  "Fontes de dados",
].filter((g) => CONCEITOS.some((c) => c.grupo === g)) as GrupoConceito[];
