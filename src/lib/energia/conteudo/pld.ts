/**
 * Conteúdo didático do módulo PLD como registro de afirmações: cada texto tem
 * fonte e estado de conferência (CONFERIDO contra documento acessado; PENDENTE
 * quando a documentação primária, sobretudo a da CCEE e dos modelos, não foi
 * acessada nesta fase). A interface mostra o estado ao lado do texto.
 */
import type { EstadoConferencia } from "./conceitos";

export type TipoRelacao =
  | "relacao_fisica"
  | "mecanismo_economico"
  | "informacao_modelos"
  | "resultado_modelos"
  | "regra_regulatoria"
  | "associacao_estatistica"
  | "interpretacao_analitica"
  | "contribuicao_modelo";

export const TIPOS_RELACAO: Record<TipoRelacao, { rotulo: string; definicao: string }> = {
  relacao_fisica: { rotulo: "Relação física", definicao: "Relação material entre grandezas, como a que liga vazões, volumes armazenados e geração." },
  mecanismo_economico: { rotulo: "Mecanismo econômico", definicao: "Relação estrutural de custo e escolha descrita na formação de preço." },
  informacao_modelos: { rotulo: "Informação usada pelos modelos oficiais", definicao: "Dado de entrada dos modelos de operação e de formação de preço." },
  resultado_modelos: { rotulo: "Resultado dos modelos oficiais", definicao: "Grandeza produzida pelos modelos NEWAVE, DECOMP e DESSEM." },
  regra_regulatoria: { rotulo: "Regra regulatória", definicao: "Regra aplicada por norma, como os limites do PLD." },
  associacao_estatistica: { rotulo: "Associação estatística", definicao: "Correlação medida pela Scrutiniums, com janela e método declarados. Não é causalidade." },
  interpretacao_analitica: { rotulo: "Interpretação analítica", definicao: "Leitura da Scrutiniums, marcada como tal." },
  contribuicao_modelo: { rotulo: "Contribuição de modelo proprietário", definicao: "Peso de uma variável em modelo da Scrutiniums. Nunca é chamada de causa." },
};

export type NoFormacao = {
  id: string;
  titulo: string;
  sigla?: string;
  oQueE: string;
  fonteOQueE: string;
  conferenciaOQueE: EstadoConferencia;
  mecanismo?: string;
  conferenciaMecanismo?: EstadoConferencia;
  relacaoSaida?: { para: string; tipo: TipoRelacao; texto: string; conferencia: EstadoConferencia; fonte: string };
  modulo?: { rotulo: string; href: string };
  conceito?: string;
};

export const NOS_FORMACAO: NoFormacao[] = [
  {
    id: "afluencias",
    titulo: "Chuva e afluências",
    sigla: "ENA",
    oQueE: "Energia produzível a partir das vazões naturais aos reservatórios, calculada pelo ONS com as produtividades das usinas a 65% dos volumes úteis.",
    fonteOQueE: "ONS, ENA Diário por Subsistema",
    conferenciaOQueE: "CONFERIDO",
    relacaoSaida: {
      para: "reservatorios",
      tipo: "relacao_fisica",
      texto: "A parte da afluência que não é vertida pode ser armazenada; a EAR resulta também das defluências e dos usos da água.",
      conferencia: "PENDENTE",
      fonte: "Documentação do ONS sobre balanço hídrico dos reservatórios (não acessada nesta fase)",
    },
    modulo: { rotulo: "Água e clima", href: "/setor-eletrico/agua-e-clima#ena" },
    conceito: "ena",
  },
  {
    id: "reservatorios",
    titulo: "Reservatórios e valor da água",
    sigla: "EAR",
    oQueE: "Energia associada ao volume de água armazenado que pode virar geração na própria usina e nas usinas a jusante.",
    fonteOQueE: "ONS, EAR Diário por Subsistema",
    conferenciaOQueE: "CONFERIDO",
    mecanismo:
      "Água usada hoje deixa de estar disponível amanhã. Por isso a água armazenada tem valor de oportunidade, e a otimização da operação pesa gerar com água agora contra guardá-la para o futuro. É o que torna o sistema brasileiro hidrotérmico e intertemporal.",
    conferenciaMecanismo: "PENDENTE",
    relacaoSaida: {
      para: "otimizacao",
      tipo: "informacao_modelos",
      texto: "O estado dos reservatórios entra na otimização da operação.",
      conferencia: "PENDENTE",
      fonte: "Documentação dos modelos (não acessada nesta fase)",
    },
    modulo: { rotulo: "Água e clima", href: "/setor-eletrico/agua-e-clima#ear" },
    conceito: "ear",
  },
  {
    id: "carga",
    titulo: "Carga",
    oQueE: "Carga atendida no sistema interligado, publicada pelo ONS por subsistema em base diária, em MWmed.",
    fonteOQueE: "ONS, Carga de Energia Diária",
    conferenciaOQueE: "CONFERIDO",
    relacaoSaida: {
      para: "otimizacao",
      tipo: "informacao_modelos",
      texto: "A carga a atender é dado de entrada da programação da operação.",
      conferencia: "PENDENTE",
      fonte: "Documentação dos modelos (não acessada nesta fase)",
    },
    modulo: { rotulo: "Carga e consumo", href: "/setor-eletrico/carga" },
    conceito: "carga",
  },
  {
    id: "renovaveis",
    titulo: "Eólica, solar e outras fontes",
    oQueE: "Geração verificada das usinas eólicas e fotovoltaicas acompanhadas pelo ONS, hora a hora.",
    fonteOQueE: "ONS, Balanço de Energia nos Subsistemas",
    conferenciaOQueE: "CONFERIDO",
    relacaoSaida: {
      para: "otimizacao",
      tipo: "informacao_modelos",
      texto: "A expectativa de geração dessas fontes entra na programação da operação.",
      conferencia: "PENDENTE",
      fonte: "Documentação dos modelos (não acessada nesta fase)",
    },
    modulo: { rotulo: "Geração", href: "/setor-eletrico/geracao" },
    conceito: "geracao-centralizada",
  },
  {
    id: "termicas",
    titulo: "Disponibilidade e custo das térmicas",
    sigla: "CVU",
    oQueE: "O Custo Variável Unitário das térmicas é considerado pelo ONS no Programa Mensal da Operação e usado nos modelos NEWAVE, DECOMP e DESSEM.",
    fonteOQueE: "ONS, CVU das Usinas Térmicas",
    conferenciaOQueE: "CONFERIDO",
    relacaoSaida: {
      para: "otimizacao",
      tipo: "informacao_modelos",
      texto: "O CVU é utilizado na execução dos modelos NEWAVE, DECOMP e DESSEM.",
      conferencia: "CONFERIDO",
      fonte: "ONS, CVU das Usinas Térmicas",
    },
    modulo: { rotulo: "Geração", href: "/setor-eletrico/geracao#termica" },
    conceito: "cvu",
  },
  {
    id: "rede",
    titulo: "Rede, intercâmbios e restrições",
    oQueE: "Fluxo de energia entre subsistemas pelas linhas de transmissão de fronteira, verificado e programado pelo ONS.",
    fonteOQueE: "ONS, Intercâmbios Entre Subsistemas",
    conferenciaOQueE: "CONFERIDO",
    relacaoSaida: {
      para: "otimizacao",
      tipo: "informacao_modelos",
      texto: "Os limites de transferência entre regiões restringem a solução da operação.",
      conferencia: "PENDENTE",
      fonte: "Documentação dos modelos (não acessada nesta fase)",
    },
    modulo: { rotulo: "Rede", href: "/setor-eletrico/rede" },
    conceito: "intercambio",
  },
  {
    id: "otimizacao",
    titulo: "Modelos oficiais (NEWAVE, DECOMP, DESSEM)",
    oQueE: "O cálculo do PLD é realizado por modelos computacionais: NEWAVE, DECOMP e DESSEM. O ONS publica o CMO estimado pelo DECOMP por semana operativa e pelo DESSEM em base semi-horária.",
    fonteOQueE: "CCEE, descrição oficial do PLD; ONS, CMO Semanal e CMO Semi-Horário",
    conferenciaOQueE: "CONFERIDO",
    relacaoSaida: {
      para: "cmo",
      tipo: "resultado_modelos",
      texto: "O CMO é resultado desses modelos.",
      conferencia: "CONFERIDO",
      fonte: "ONS, CMO Semanal (DECOMP) e CMO Semi-Horário (DESSEM)",
    },
    conceito: "decomp",
  },
  {
    id: "cmo",
    titulo: "Custo Marginal de Operação",
    sigla: "CMO",
    oQueE: "Custo, por unidade de energia produzida, para atender ao incremento de uma unidade de carga no sistema interligado.",
    fonteOQueE: "ONS, CMO Semanal",
    conferenciaOQueE: "CONFERIDO",
    relacaoSaida: {
      para: "limites",
      tipo: "regra_regulatoria",
      texto: "O PLD tem como base o CMO, com aplicação dos limites mínimo e máximos vigentes.",
      conferencia: "CONFERIDO",
      fonte: "CCEE, descrição oficial do PLD",
    },
    modulo: { rotulo: "CMO semanal", href: "/setor-eletrico/pld#cmo" },
    conceito: "cmo",
  },
  {
    id: "limites",
    titulo: "Regras e limites aplicáveis",
    oQueE: "Limites máximos (horário e estrutural) e mínimo vigentes para cada período de apuração e para cada submercado.",
    fonteOQueE: "CCEE, descrição oficial do PLD",
    conferenciaOQueE: "CONFERIDO",
    relacaoSaida: {
      para: "pld",
      tipo: "regra_regulatoria",
      texto: "O resultado, limitado, é o PLD de cada hora e submercado.",
      conferencia: "CONFERIDO",
      fonte: "CCEE, descrição oficial do PLD",
    },
    conceito: "pld",
  },
  {
    id: "pld",
    titulo: "PLD",
    oQueE: "Valor em R$/MWh calculado pela CCEE diariamente para cada hora do dia seguinte e para cada submercado.",
    fonteOQueE: "CCEE, descrição oficial do PLD",
    conferenciaOQueE: "CONFERIDO",
    modulo: { rotulo: "O que está acontecendo", href: "/setor-eletrico/pld#hoje" },
    conceito: "pld",
  },
];

/** "O que o PLD não é": cada item com o porquê e a base. */
export const PLD_NAO_E: { titulo: string; porque: string; base: string; conferencia: EstadoConferencia }[] = [
  {
    titulo: "Não é a sua tarifa de energia",
    porque:
      "A conta de quem é atendido pela distribuidora segue a Tarifa de Energia (TE) e a Tarifa de Uso do Sistema de Distribuição (TUSD), resultantes dos processos tarifários da ANEEL. O PLD é calculado pela CCEE para cada hora e submercado com base no CMO.",
    base: "ANEEL, Tarifas de aplicação das distribuidoras; CCEE, descrição oficial do PLD",
    conferencia: "CONFERIDO",
  },
  {
    titulo: "Não é simplesmente o preço da última usina",
    porque:
      "O PLD tem como base o CMO, resultado dos modelos computacionais oficiais (NEWAVE, DECOMP e DESSEM). Na descrição usual do setor, ainda não conferida em documento primário nesta fase, esses modelos ponderam usar a água agora ou guardá-la, de modo que o custo marginal incorpora um valor futuro da água, e não apenas o custo da usina mais cara acionada naquela hora.",
    base: "CCEE, descrição oficial do PLD; mecanismo do valor da água com conferência documental pendente",
    conferencia: "PENDENTE",
  },
  {
    titulo: "Não é uma cotação de bolsa formada só por lances",
    porque:
      "Segundo a CCEE, o PLD é calculado por modelos computacionais com base no CMO, dentro de limites mínimo e máximos. A descrição oficial não menciona ofertas de compra e venda.",
    base: "CCEE, descrição oficial do PLD",
    conferencia: "CONFERIDO",
  },
  {
    titulo: "Não é uma previsão meteorológica",
    porque:
      "O PLD é calculado para cada hora do dia seguinte com base no CMO. Não é uma estimativa de chuva nem de afluência; a ENA publicada pelo ONS é que mede, em energia, as vazões naturais já verificadas.",
    base: "CCEE, descrição oficial do PLD; ONS, ENA Diário por Subsistema",
    conferencia: "CONFERIDO",
  },
];
