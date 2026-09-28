/**
 * Base de conhecimento do Setor Elétrico ("Aprenda").
 *
 * Regra: nenhuma definição escrita de memória. Cada verbete aponta o documento
 * primário e o estado de conferência:
 * - CONFERIDO: o texto foi escrito a partir do documento acessado na data indicada;
 * - PENDENTE: a fonte primária não foi acessada nesta fase (Regras de
 *   Comercialização da CCEE e legislação no site do Planalto não acessadas). Verbete
 *   pendente aparece como "em preparação", sem definição.
 */

export type EstadoConferencia = "CONFERIDO" | "PENDENTE";

export type FonteOficial = {
  orgao: string;
  documento: string;
  url: string;
  /** Trecho do documento que sustenta a definição, quando aplicável. */
  trecho?: string;
};

export type Conceito = {
  slug: string;
  sigla?: string;
  nome: string;
  grupo: "Preço" | "Água" | "Operação" | "Modelos" | "Mercado";
  estado: EstadoConferencia;
  conferidoEm?: string;
  emUmaFrase?: string;
  porQueImporta?: string;
  comoEMedido?: string;
  relacoes: string[];
  fontes: FonteOficial[];
  limitacoes?: string[];
  vejaNoPortal: { rotulo: string; href: string }[];
  /** Fonte planejada para verbetes pendentes. */
  fontePlanejada?: string;
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
};

const TRECHO_CMO_SEMANAL =
  "Valores do custo, por unidade de energia produzida, para atender ao incremento de uma unidade de carga no SIN, chamado de Custo Marginal de Operação – CMO. Valores para cada semana operativa por subsistema, e por patamar de carga, além da média semanal, estimados pelo modelo Decomp.";
const TRECHO_CMO_SEMI =
  "Este CMO é estimado pelo modelo DESSEM para cada barra do sistema em base semi-horária. O CMO do subsistema é obtido pelo média dos CMOs nas barras de cada subsistema, ponderados pelas respectivas cargas.";
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
    "Detalhar os valores do Preço de Liquidação das Diferenças do MCP por mês de referência, período de comercialização e submercado. [...] BE_POSITIVO: Corresponde ao Balanço Energético positivo do perfil de agente “a” no submercado “s” para o período de comercialização “j” [...] RESULTADO_MCP: Corresponde ao Resultado no Mercado de Curto Prazo do perfil de agente “a”, no submercado “s”, por período de comercialização “j”.",
};

export const CONCEITOS: Conceito[] = [
  {
    slug: "pld",
    sigla: "PLD",
    nome: "Preço de Liquidação das Diferenças",
    grupo: "Preço",
    estado: "CONFERIDO",
    conferidoEm: "2026-09-27",
    emUmaFrase:
      "Preço do Mercado de Curto Prazo, em R$/MWh, calculado pela CCEE diariamente para cada hora do dia seguinte e para cada submercado, com base no Custo Marginal de Operação e dentro dos limites mínimo e máximos vigentes.",
    porQueImporta:
      "No Mercado de Curto Prazo, a CCEE apura, para cada perfil de agente, submercado e hora, um balanço energético em MWh (positivo ou negativo) e um resultado em R$; o PLD é o preço desse mercado. Tem como base o CMO, que o ONS define como o custo, por unidade de energia produzida, para atender ao incremento de uma unidade de carga no SIN. Como o balanço de cada agente é formado e como o resultado é liquidado está nas Regras de Comercialização da CCEE, cuja conferência documental está pendente nesta fase.",
    comoEMedido:
      "Em R$/MWh, por hora e por submercado, publicado pela CCEE no conjunto PLD_HORARIO. Médias diárias, semanais ou mensais são agregações dessas horas.",
    relacoes: ["cmo", "submercado", "newave", "decomp", "dessem"],
    fontes: [
      CCEE_PLD,
      CCEE_MCP,
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
      "O PLD não é a tarifa do consumidor atendido pela distribuidora, que é composta pela Tarifa de Energia (TE) e pela Tarifa de Uso do Sistema de Distribuição (TUSD) definidas nos processos tarifários da ANEEL.",
      "Os limites mínimo e máximos mudam a cada ano; comparações longas em valores nominais misturam regimes de limites.",
    ],
    vejaNoPortal: [
      { rotulo: "PLD explicado", href: "/setor-eletrico/pld" },
      { rotulo: "PLD dos quatro submercados hoje", href: "/setor-eletrico/pld#hoje" },
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
      "Em R$/MWh, por subsistema e por patamar de carga (leve, média, pesada) na versão semanal. Na versão semi-horária, o CMO do subsistema é a média dos CMOs das barras ponderada pelas cargas.",
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
    conferidoEm: "2026-09-27",
    emUmaFrase:
      "Cada uma das quatro divisões do sistema interligado (Sudeste/Centro-Oeste, Sul, Nordeste e Norte) para as quais a CCEE calcula um PLD próprio.",
    porQueImporta:
      "Os quatro valores de cada hora podem coincidir ou diferir. Por que diferem (limites de transmissão entre regiões, por exemplo) é matéria dos modelos e das regras da CCEE e do ONS, cuja conferência documental está pendente nesta fase: a plataforma mostra a diferença observada e o intercâmbio medido, sem atribuir causa.",
    comoEMedido:
      "O conjunto PLD_HORARIO traz um valor por hora para cada submercado. Nos dados do ONS as mesmas quatro regiões aparecem como subsistemas (SE, S, NE, N).",
    relacoes: ["pld", "intercambio"],
    fontes: [CCEE_PLD],
    vejaNoPortal: [{ rotulo: "Por que os submercados diferem", href: "/setor-eletrico/pld#submercados" }],
  },
  {
    slug: "cvu",
    sigla: "CVU",
    nome: "Custo Variável Unitário",
    grupo: "Preço",
    estado: "CONFERIDO",
    conferidoEm: "2026-09-28",
    emUmaFrase:
      "Custo variável unitário das usinas térmicas considerado pelo ONS no Programa Mensal da Operação e usado nos modelos NEWAVE, DECOMP e DESSEM.",
    porQueImporta:
      "Segundo o ONS, é usado na execução dos modelos NEWAVE, DECOMP e DESSEM, nas decisões de programação e no acompanhamento dos custos da operação.",
    comoEMedido: "Em R$/MWh, por usina térmica, publicado pelo ONS no conjunto CVU das Usinas Térmicas.",
    relacoes: ["cmo", "newave", "decomp", "dessem"],
    fontes: [
      ONS("cvu-usitermica", "CVU das Usina Térmicas",
        "Custo Variável Unitário (CVU) de usinas térmicas considerado no Programa Mensal da Operação, conforme utilizado na execução do modelo NEWAVE, DECOMP, DESSEM, além de seu uso nas decisões de programação e acompanhamentos dos custos da operação."),
    ],
    limitacoes: ["O conjunto de CVU está catalogado e ainda não integrado ao portal."],
    vejaNoPortal: [{ rotulo: "Catálogo de dados", href: "/setor-eletrico/dados" }],
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
      "ENA bruta: produto das vazões naturais pelas produtividades das usinas a 65% dos volumes úteis. Publicada em MWmed e em percentual da média de longo termo (MLT), por dia.",
    relacoes: ["ear", "mlt"],
    fontes: [
      ONS("ena-diario-por-subsistema", "ENA Diário por Subsistema",
        "A Energia Natural Afluente (ENA) Bruta representa a energia produzível pela usina e é calculada pelo produto das vazões naturais aos reservatórios com as produtividades a 65% dos volumes úteis. A ENA Armazenável considera as vazões naturais descontadas das vazões vertidas nos reservatórios. [...] os dados podem servir de insumo para estudos energéticos e projeção do custo marginal de operação."),
    ],
    limitacoes: ["O conjunto não informa o período de referência da MLT."],
    vejaNoPortal: [{ rotulo: "Quanta água está chegando", href: "/setor-eletrico/agua-e-clima#ena" }],
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
      "O ONS publica a ENA bruta e a ENA armazenável em MWmed e em percentual da MLT. O conjunto não informa como a MLT é calculada nem seu período de referência.",
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
    vejaNoPortal: [{ rotulo: "ENA em % da MLT", href: "/setor-eletrico/agua-e-clima#ena" }],
  },
  {
    slug: "ree",
    sigla: "REE",
    nome: "Reservatório Equivalente de Energia",
    grupo: "Água",
    estado: "PENDENTE",
    relacoes: ["ear", "ena"],
    fontes: [ONS("ear-diario-por-ree-reservatorio-equivalente-de-energia", "EAR Diário por REE")],
    fontePlanejada: "Procedimentos de Rede do ONS e documentação dos modelos de planejamento.",
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
    nome: "Geração verificada (centralizada)",
    grupo: "Operação",
    estado: "CONFERIDO",
    conferidoEm: "2026-09-28",
    emUmaFrase:
      "Geração das usinas hidráulicas, térmicas, eólicas e fotovoltaicas acompanhadas pelo ONS, verificada hora a hora.",
    porQueImporta: "Mostra, hora a hora e por subsistema, a oferta de energia por fonte ao lado da carga verificada.",
    comoEMedido: "Em MWmed, por hora e por subsistema, no Balanço de Energia nos Subsistemas do ONS.",
    relacoes: ["carga", "geracao-distribuida"],
    fontes: [
      ONS("balanco-energia-subsistema", "Balanço de Energia nos Subsistemas", TRECHO_BALANCO),
    ],
    limitacoes: [
      "O balanço não separa as térmicas por combustível.",
      "A micro e minigeração distribuída não está na geração verificada do balanço.",
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
    fontePlanejada: "Regulamentação da ANEEL sobre restrições de operação e apuração do ONS.",
    vejaNoPortal: [{ rotulo: "Catálogo de dados", href: "/setor-eletrico/dados" }],
  },
  {
    slug: "newave",
    sigla: "NEWAVE",
    nome: "NEWAVE",
    grupo: "Modelos",
    estado: "CONFERIDO",
    conferidoEm: "2026-09-27",
    emUmaFrase: "Um dos três modelos computacionais citados pela CCEE no cálculo do PLD, ao lado do DECOMP e do DESSEM.",
    porQueImporta: "A CCEE informa que o cálculo do PLD é realizado por modelos computacionais, entre eles o NEWAVE. O papel de cada modelo na cadeia está pendente de conferência documental.",
    comoEMedido: "Modelo computacional; não é uma grandeza. Descrição de horizonte e formulação pendente de conferência documental.",
    relacoes: ["decomp", "dessem", "cmo", "pld"],
    fontes: [
      CCEE_PLD,
      ONS("cvu-usitermica", "CVU das Usina Térmicas",
        "Custo Variável Unitário (CVU) de usinas térmicas considerado no Programa Mensal da Operação, conforme utilizado na execução do modelo NEWAVE, DECOMP, DESSEM, além de seu uso nas decisões de programação e acompanhamentos dos custos da operação."),
    ],
    limitacoes: ["A documentação técnica do modelo não foi acessada nesta fase."],
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
    comoEMedido: "Modelo computacional; sua saída publicada é o CMO semanal em R$/MWh.",
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
    vejaNoPortal: [{ rotulo: "Mercado (em integração)", href: "/setor-eletrico/mercado" }],
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
    vejaNoPortal: [{ rotulo: "Mercado (em integração)", href: "/setor-eletrico/mercado" }],
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
    vejaNoPortal: [{ rotulo: "Mercado (em integração)", href: "/setor-eletrico/mercado" }],
  },
  {
    slug: "gsf",
    sigla: "GSF",
    nome: "Generation Scaling Factor",
    grupo: "Mercado",
    estado: "PENDENTE",
    relacoes: ["mre", "garantia-fisica"],
    fontes: [],
    fontePlanejada: "Regras de Comercialização da CCEE.",
    vejaNoPortal: [{ rotulo: "Mercado (em integração)", href: "/setor-eletrico/mercado" }],
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
    vejaNoPortal: [{ rotulo: "Mercado (em integração)", href: "/setor-eletrico/mercado" }],
  },
  {
    slug: "garantia-fisica",
    nome: "Garantia física",
    grupo: "Mercado",
    estado: "PENDENTE",
    relacoes: ["mre", "gsf"],
    fontes: [],
    fontePlanejada: "Decreto nº 5.163/2004 e portarias do MME.",
    vejaNoPortal: [{ rotulo: "Mercado (em integração)", href: "/setor-eletrico/mercado" }],
  },
];

export function conceito(slug: string): Conceito | undefined {
  return CONCEITOS.find((c) => c.slug === slug);
}

export const GRUPOS: Conceito["grupo"][] = ["Preço", "Água", "Operação", "Modelos", "Mercado"];
