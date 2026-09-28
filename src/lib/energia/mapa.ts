/**
 * Mapa do Observatório do Setor Elétrico (página inicial do domínio), no molde do
 * "Mapa do Observatório" do Crédito: o sistema em passos ligados às páginas que os
 * respondem, índice por pergunta, trilhas por perfil e como ler as páginas.
 * Nada aqui é número novo: é o mapa das páginas. Os textos usam só definições
 * conferidas nos verbetes (conceitos.ts); o que depende dos modelos oficiais fica
 * marcado como pendente nas próprias páginas.
 */

export type EstadoPagina = "integrado" | "integracao" | "referencia";

export type PaginaMapa = {
  rotulo: string;
  href: string;
  /** A pergunta que a página responde; nas páginas de módulo, igual ao título da página. */
  pergunta: string;
  estado: EstadoPagina;
};

export const PAGINAS_MAPA = {
  "visao-geral": { rotulo: "Visão geral", href: "/setor-eletrico/visao-geral", pergunta: "O que está acontecendo no sistema elétrico brasileiro?", estado: "integrado" },
  "agua-e-clima": { rotulo: "Água e clima", href: "/setor-eletrico/agua-e-clima", pergunta: "Quanta energia está guardada nos reservatórios, e quanta água está chegando?", estado: "integrado" },
  geracao: { rotulo: "Geração", href: "/setor-eletrico/geracao", pergunta: "Com que fontes o sistema está atendendo a carga?", estado: "integrado" },
  carga: { rotulo: "Carga", href: "/setor-eletrico/carga", pergunta: "Quanto o sistema está consumindo?", estado: "integrado" },
  rede: { rotulo: "Rede", href: "/setor-eletrico/rede", pergunta: "A rede está limitando o sistema?", estado: "integrado" },
  "pld-o-que-e": { rotulo: "PLD · 1. O que é", href: "/setor-eletrico/pld#o-que-e", pergunta: "A que preço se acerta a energia no curto prazo, hora a hora e em cada região?", estado: "integrado" },
  "pld-formacao": { rotulo: "PLD · 2. De onde vem", href: "/setor-eletrico/pld#formacao", pergunta: "De onde vem o preço?", estado: "integrado" },
  "pld-hoje": { rotulo: "PLD · 3. O que está acontecendo", href: "/setor-eletrico/pld#hoje", pergunta: "O que o PLD mostrou no último dia publicado e no período recente?", estado: "integrado" },
  "pld-submercados": { rotulo: "PLD · 4. Submercados", href: "/setor-eletrico/pld#submercados", pergunta: "Por que os preços dos submercados podem diferir?", estado: "integrado" },
  "pld-previsao": { rotulo: "PLD · 5. Previsão", href: "/setor-eletrico/pld#previsao", pergunta: "Para onde o PLD pode ir?", estado: "integrado" },
  modelos: { rotulo: "Modelos do PLD", href: "/setor-eletrico/pld/modelos", pergunta: "Que modelos de previsão existem, e em que estado está cada um?", estado: "integrado" },
  previsoes: { rotulo: "Histórico de previsões", href: "/setor-eletrico/pld/previsoes", pergunta: "O que a plataforma registrou, em cada dia?", estado: "integrado" },
  mercado: { rotulo: "Mercado", href: "/setor-eletrico/mercado", pergunta: "Como a energia é contratada e liquidada?", estado: "integracao" },
  empresas: { rotulo: "Empresas", href: "/setor-eletrico/empresas", pergunta: "Quem é dono de quê no setor elétrico?", estado: "integracao" },
  expansao: { rotulo: "Expansão", href: "/setor-eletrico/expansao", pergunta: "Quanta capacidade está chegando, e de que fontes?", estado: "integracao" },
  regulacao: { rotulo: "Regulação", href: "/setor-eletrico/regulacao", pergunta: "Que regras mudaram, quando e com qual efeito declarado?", estado: "integracao" },
  aprenda: { rotulo: "Aprenda", href: "/setor-eletrico/aprenda", pergunta: "Como funciona o sistema elétrico brasileiro, conceito a conceito?", estado: "referencia" },
  dados: { rotulo: "Dados e catálogo", href: "/setor-eletrico/dados", pergunta: "O que é público sobre o setor elétrico, e o que já está integrado?", estado: "referencia" },
  metodologia: { rotulo: "Metodologia", href: "/setor-eletrico/metodologia", pergunta: "Como os números são produzidos, e o que eles não dizem?", estado: "referencia" },
} satisfies Record<string, PaginaMapa>;

export type IdPagina = keyof typeof PAGINAS_MAPA;

/** Fonte e data de referência de um passo: a página busca a data na gold pelo `chave`. */
export type FontePasso = { rotulo: string; chave: "ear" | "ena" | "geracao" | "carga" | "intercambio" | "saldos" | "pld" | "cmo" };

export type Passo = {
  n: number;
  id: string;
  titulo: string;
  pergunta: string;
  texto: string;
  conceitos: { slug: string; rotulo: string }[];
  paginas: IdPagina[];
  fontes: FontePasso[];
};

export const PASSOS: Passo[] = [
  {
    n: 1,
    id: "passo-agua",
    titulo: "A água nos reservatórios",
    pergunta: PAGINAS_MAPA["agua-e-clima"].pergunta,
    texto:
      "A energia armazenada (EAR) é a energia associada à água guardada nos reservatórios; a energia natural afluente (ENA) expressa em energia as vazões naturais que chegam a eles. O ONS publica as duas todos os dias, por subsistema. A página compara cada valor com o mesmo dia do calendário nos anos anteriores, para separar o que é da estação do que é incomum.",
    conceitos: [
      { slug: "ear", rotulo: "EAR" },
      { slug: "ena", rotulo: "ENA" },
      { slug: "mlt", rotulo: "MLT" },
      { slug: "armazenamento", rotulo: "EAR máxima" },
    ],
    paginas: ["agua-e-clima"],
    fontes: [
      { rotulo: "EAR diária por subsistema (ONS)", chave: "ear" },
      { rotulo: "ENA diária por subsistema (ONS)", chave: "ena" },
    ],
  },
  {
    n: 2,
    id: "passo-geracao",
    titulo: "A geração por fonte",
    pergunta: PAGINAS_MAPA.geracao.pergunta,
    texto:
      "O balanço de energia do ONS registra, hora a hora e por subsistema, a geração verificada das usinas hidráulicas, térmicas, eólicas e fotovoltaicas. A página mostra a participação de cada fonte no dia, em 7 e 30 dias e em 12 meses. A partir de 29/04/2023 o balanço passa a incluir, na solar, a estimativa de micro e minigeração distribuída (leitura a partir do dado, não conferida em documento do ONS); comparações que atravessam essa data não são homogêneas.",
    conceitos: [
      { slug: "geracao-centralizada", rotulo: "geração verificada" },
      { slug: "geracao-distribuida", rotulo: "MMGD" },
    ],
    paginas: ["geracao"],
    fontes: [{ rotulo: "Balanço de energia nos subsistemas (ONS)", chave: "geracao" }],
  },
  {
    n: 3,
    id: "passo-carga",
    titulo: "O consumo: a carga",
    pergunta: PAGINAS_MAPA.carga.pergunta,
    texto:
      "A carga é a energia atendida no sistema interligado, publicada pelo ONS por subsistema em base diária. O que entra na conta mudou em março de 2021 e em 29/04/2023, quando passou a incluir a estimativa de micro e minigeração distribuída; a página só compara períodos do mesmo regime.",
    conceitos: [{ slug: "carga", rotulo: "carga" }],
    paginas: ["carga"],
    fontes: [{ rotulo: "Carga de energia diária (ONS)", chave: "carga" }],
  },
  {
    n: 4,
    id: "passo-rede",
    titulo: "A rede entre as regiões",
    pergunta: PAGINAS_MAPA.rede.pergunta,
    texto:
      "O intercâmbio é o fluxo de energia entre subsistemas, medido nas linhas de transmissão de fronteira. A página mostra o fluxo diário em cada fronteira, o saldo de cada subsistema e se os preços das regiões se separaram. Os limites de intercâmbio ainda não estão integrados: sem eles, a página não afirma que a rede atingiu limite.",
    conceitos: [
      { slug: "intercambio", rotulo: "intercâmbio" },
      { slug: "submercado", rotulo: "submercado" },
      { slug: "sin", rotulo: "SIN" },
    ],
    paginas: ["rede"],
    fontes: [
      { rotulo: "Intercâmbios entre subsistemas (ONS)", chave: "intercambio" },
      { rotulo: "Saldos do balanço de energia (ONS)", chave: "saldos" },
    ],
  },
  {
    n: 5,
    id: "passo-preco",
    titulo: "O custo e o preço de curto prazo",
    pergunta: PAGINAS_MAPA["pld-o-que-e"].pergunta,
    texto:
      "Segundo a CCEE, o PLD é o preço do Mercado de Curto Prazo, calculado para cada hora e cada submercado com base no Custo Marginal de Operação (CMO). O ONS publica o CMO estimado pelos modelos DECOMP e DESSEM. A página do PLD explica o conceito em cinco capítulos, mostra o preço de cada dia e de cada região e o estado dos modelos de previsão.",
    conceitos: [
      { slug: "pld", rotulo: "PLD" },
      { slug: "cmo", rotulo: "CMO" },
      { slug: "mcp", rotulo: "MCP" },
      { slug: "decomp", rotulo: "DECOMP" },
      { slug: "dessem", rotulo: "DESSEM" },
      { slug: "newave", rotulo: "NEWAVE" },
    ],
    paginas: ["pld-o-que-e", "pld-formacao", "pld-hoje", "pld-submercados", "pld-previsao", "modelos", "previsoes"],
    fontes: [
      { rotulo: "PLD horário (CCEE)", chave: "pld" },
      { rotulo: "CMO semanal (ONS)", chave: "cmo" },
    ],
  },
  {
    n: 6,
    id: "passo-mercado",
    titulo: "Contratos, empresas, expansão e regras",
    pergunta: "Quem contrata a energia, quem é dono dos ativos, o que está chegando e que regras mudaram?",
    texto:
      "Como a energia é contratada e liquidada, quem é dono de usinas e linhas, que capacidade está chegando e que regras mudaram. Estes quatro módulos estão em integração: mostram escopo, perguntas e as fontes já catalogadas, sem nenhum número publicado.",
    conceitos: [
      { slug: "acl", rotulo: "ACL" },
      { slug: "acr", rotulo: "ACR" },
      { slug: "mre", rotulo: "MRE" },
      { slug: "garantia-fisica", rotulo: "garantia física" },
    ],
    paginas: ["mercado", "empresas", "expansao", "regulacao"],
    fontes: [],
  },
];

export const GRUPOS_PERGUNTAS: { rotulo: string; paginas: IdPagina[] }[] = [
  { rotulo: "Para começar e para consultar", paginas: ["visao-geral", "aprenda", "dados", "metodologia"] },
  { rotulo: "Operação do sistema", paginas: ["agua-e-clima", "geracao", "carga", "rede"] },
  { rotulo: "Preço", paginas: ["pld-o-que-e", "pld-formacao", "pld-hoje", "pld-submercados", "pld-previsao", "modelos", "previsoes"] },
  { rotulo: "Em integração", paginas: ["mercado", "empresas", "expansao", "regulacao"] },
];

/** Passo de trilha: página do mapa, com modo de profundidade ou âncora próprios quando a trilha pede. */
export type PassoTrilha = { pagina: IdPagina; href?: string; nota?: string };

export const TRILHAS: { perfil: string; quem: string; passos: PassoTrilha[] }[] = [
  {
    perfil: "Quem está começando",
    quem: "Para cidadão, estudante ou jornalista que quer entender o quadro sem jargão e achar o número certo para citar.",
    passos: [
      { pagina: "visao-geral" },
      { pagina: "pld-o-que-e" },
      { pagina: "agua-e-clima" },
      { pagina: "aprenda", href: "/setor-eletrico/aprenda/pld", nota: "verbete PLD" },
      { pagina: "metodologia", href: "/setor-eletrico/metodologia#natureza", nota: "o que significa cada selo" },
    ],
  },
  {
    perfil: "Analista do setor",
    quem: "Para quem atua em comercialização, geração ou consumo livre e acompanha preço, hidrologia, carga e rede.",
    passos: [
      { pagina: "pld-hoje", href: "/setor-eletrico/pld?modo=analisar#hoje", nota: "modo Analisar" },
      { pagina: "pld-submercados", href: "/setor-eletrico/pld?modo=analisar#submercados", nota: "modo Analisar" },
      { pagina: "rede", href: "/setor-eletrico/rede?modo=analisar", nota: "modo Analisar" },
      { pagina: "agua-e-clima", href: "/setor-eletrico/agua-e-clima?modo=analisar", nota: "modo Analisar" },
      { pagina: "carga" },
      { pagina: "geracao" },
      { pagina: "modelos" },
    ],
  },
  {
    perfil: "Regulador, auditor ou pesquisador",
    quem: "Para quem confere de onde vem cada número, como foi calculado e o que foi registrado.",
    passos: [
      { pagina: "metodologia" },
      { pagina: "dados" },
      { pagina: "dados", href: "/setor-eletrico/dados/ccee-pld-horario", nota: "ficha do PLD horário: capturas e sha256" },
      { pagina: "pld-previsao", href: "/setor-eletrico/pld?modo=auditar#previsao", nota: "modo Auditar" },
      { pagina: "modelos" },
      { pagina: "previsoes" },
    ],
  },
];

/** Âncoras da antiga página inicial (hoje Visão geral): um link antigo é levado à seção certa. */
export const ANCORAS_VISAO_GERAL = [
  "sistema",
  "agua",
  "agua-painel",
  "geracao",
  "geracao-painel",
  "consumo",
  "carga-painel",
  "rede",
  "rede-painel",
  "preco",
  "preco-painel",
  "observar",
];
