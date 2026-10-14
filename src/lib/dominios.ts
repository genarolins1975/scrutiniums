/**
 * Registro dos observatórios da Scrutiniums (domínios analíticos).
 *
 * Fonte única de nome, pergunta, descrição, chips, rota e acento de cada
 * observatório. Home, tela "Escolha seu observatório", switcher do cabeçalho,
 * telemetria e sitemap leem daqui. Um novo observatório é uma entrada nova.
 */

export type DominioId = "credito" | "energia" | "eficiencia" | "contas" | "estados" | "gas";

export type Dominio = {
  id: DominioId;
  /** Nome completo, como aparece em títulos. */
  nome: string;
  /** Rótulo curto do switcher: "Crédito", "Setor Elétrico", "Eficiência Estatal". */
  nomeCurto: string;
  /** Pergunta editorial que o observatório responde. */
  pergunta: string;
  /** Descrição dos cards editoriais (home). */
  descricao: string;
  /** Descrição curta da tela de escolha pós login. */
  descricaoCurta: string;
  chips: string[];
  /** Rota de entrada do observatório (produto). */
  rotaRaiz: string;
  /** Rota de apresentação editorial, quando existe separada da raiz. */
  rotaApresentacao: string;
  cta: string;
  /** Token de cor de acento (tailwind): bronze para Crédito, energia para Setor Elétrico, obee para Eficiência Estatal, gas para Gás Natural. */
  acento: "bronze" | "energia" | "obee" | "gas";
  /** Prefixos de seção de telemetria atribuídos ao domínio. */
  prefixosTelemetria: string[];
};

export const DOMINIOS: Dominio[] = [
  {
    id: "credito",
    nome: "Observatório Brasileiro de Crédito",
    nomeCurto: "Crédito",
    pergunta:
      "Onde o crédito cresce, onde o risco aparece e como instituições, produtos e regiões se comparam?",
    descricao:
      "Uma visão integrada do mercado de crédito brasileiro a partir de bases públicas. Carteiras, inadimplência, juros, instituições financeiras, Pix, mercado, riscos emergentes e sinais antecedentes, sempre com conceito, fonte e limitações declarados.",
    descricaoCurta:
      "Carteira, inadimplência, juros, instituições, Pix e riscos emergentes a partir das bases do Banco Central, CVM, IBGE e CNJ.",
    chips: ["Crédito", "Instituições", "Risco", "Mercado"],
    rotaRaiz: "/observatorio",
    rotaApresentacao: "/observatorio-do-credito",
    cta: "Explorar Crédito",
    acento: "bronze",
    prefixosTelemetria: ["obs:", "credito:"],
  },
  {
    id: "energia",
    nome: "Observatório Brasileiro do Setor Elétrico",
    nomeCurto: "Setor Elétrico",
    pergunta:
      "Como água, geração, consumo, rede e mercado se combinam para determinar as condições do sistema elétrico brasileiro?",
    descricao:
      "Dados públicos de operação, preços, hidrologia, geração, carga, transmissão, empresas e planejamento reunidos em uma única base de conhecimento. Inclui acompanhamento do PLD, registro de modelos de previsão com estado explícito e metodologia auditável.",
    descricaoCurta:
      "PLD, reservatórios, afluências, geração por fonte, carga e intercâmbios a partir dos dados abertos da CCEE, do ONS e da ANEEL.",
    chips: ["PLD", "Hidrologia", "Geração", "Mercado"],
    rotaRaiz: "/setor-eletrico",
    rotaApresentacao: "/setor-eletrico",
    cta: "Explorar Setor Elétrico",
    acento: "energia",
    prefixosTelemetria: ["energia:"],
  },
  {
    id: "eficiencia",
    nome: "Observatório Brasileiro de Eficiência Estatal",
    nomeCurto: "Eficiência Estatal",
    pergunta:
      "Quanto o Estado aplica, que atendimento oferece e que resultados a fonte registra, com a mesma régua para cada ente?",
    descricao:
      "Indicadores públicos sobre recursos, atendimento e resultados, com definição, fonte, período e limitações em cada número. Educação municipal e Saúde publicadas nas 26 capitais: educação municipal (despesa total, por habitante e por matrícula, matrículas, alunos por turma, aprovação, Ideb e Saeb) e saúde (despesa, ações e serviços públicos de saúde, UBS, equipes e cobertura da atenção primária e internações por condições sensíveis à atenção primária). Trabalho e Renda reúne indicadores do IBGE, emprego formal, Cadastro Único, cursos de aprendizagem autorizados e despesas municipais de Trabalho, nos recortes e períodos próprios de cada fonte. Mostra valores e referências, sem notas, rankings ou conclusões.",
    descricaoCurta:
      "Educação e Saúde nas capitais, Trabalho e Renda nos recortes das fontes: recursos públicos, serviços e condições de vida a partir de bases oficiais.",
    chips: ["Recursos", "Atendimento", "Resultados", "Educação", "Saúde", "Trabalho e Renda"],
    rotaRaiz: "/eficiencia-estatal",
    rotaApresentacao: "/eficiencia-estatal",
    cta: "Explorar Eficiência Estatal",
    acento: "obee",
    prefixosTelemetria: ["eficiencia:"],
  },
  {
    id: "contas",
    nome: "Observatório Brasileiro de Contas Públicas Federais",
    nomeCurto: "Contas Públicas Federais",
    pergunta: "Como o orçamento federal é executado, onde estão os maiores custos e quais entregas foram registradas?",
    descricao: "Da autorização ao pagamento, acompanhe o orçamento federal, o resultado fiscal, os restos a pagar, as metas físicas e os custos da União. Explore composição e variações no tempo, com fontes oficiais e limites de comparação explícitos.",
    descricaoCurta: "Orçamento e entregas físicas do SIOP, resultado fiscal e custos do Tesouro Nacional. Cada painel identifica período, fonte e cobertura; execução do gasto não comprova eficiência.",
    chips: ["Orçamento", "Resultado fiscal", "Custos", "Entregas"],
    rotaRaiz: "/contas-publicas",
    rotaApresentacao: "/contas-publicas",
    cta: "Explorar Contas Públicas Federais",
    acento: "energia",
    prefixosTelemetria: ["contas:"],
  },
  {
    id: "estados",
    nome: "Observatório Brasileiro de Contas Públicas Estaduais",
    nomeCurto: "Contas Públicas Estaduais",
    pergunta: "Como os estados executam o orçamento, financiam suas despesas e se comparam?",
    descricao: "Execução orçamentária, composição de receitas e despesas, margem corrente e dívida das 27 unidades da Federação. Compare estados e regiões, consulte valores exatos e acesse as respostas originais do Tesouro. Execução financeira não comprova eficiência ou entrega de serviços.",
    descricaoCurta: "Tesouro Nacional / Siconfi: RREO Anexo 01 e RGF Anexo 02. Execução e composição no encerramento de 2025; dívida também com recorte parcial de 2026.",
    chips: ["27 UFs", "Execução", "Receitas e despesas", "Dívida"],
    rotaRaiz: "/contas-publicas-estaduais",
    rotaApresentacao: "/contas-publicas-estaduais",
    cta: "Explorar Contas Públicas Estaduais",
    acento: "obee",
    prefixosTelemetria: ["estados:"],
  },
  {
    id: "gas",
    nome: "Observatório Brasileiro de Gás Natural",
    nomeCurto: "Gás Natural",
    pergunta: "Quanto gás o Brasil produz, quanto chega ao mercado, de onde vem o que é importado e quanto custa em cada elo até o consumidor?",
    descricao:
      "Produção por estado, gás reinjetado e queimado, importação por origem, preço de venda às distribuidoras comparado às referências internacionais, preço do botijão e do GNV em cada UF, inflação do gás e uso da malha de transporte, a partir dos dados abertos da ANP, do IBGE, do Banco Central, do Comex Stat e do Banco Mundial. O gás de cozinha (GLP) tem página própria, separada do gás natural.",
    descricaoCurta:
      "Produção, aproveitamento, importação, preços na cadeia, botijão, GNV e transporte a partir da ANP, IBGE, BCB, Comex Stat e Banco Mundial.",
    chips: ["Produção", "Importação", "Preços", "Botijão", "Transporte"],
    rotaRaiz: "/gas-natural",
    rotaApresentacao: "/gas-natural",
    cta: "Explorar Gás Natural",
    acento: "gas",
    prefixosTelemetria: ["gas:"],
  },
];

export const COOKIE_OBSERVATORIO = "scrutiniums_observatorio";

export function dominio(id: DominioId): Dominio {
  const d = DOMINIOS.find((x) => x.id === id);
  if (!d) throw new Error(`domínio desconhecido: ${id}`);
  return d;
}

export function isDominioId(v: unknown): v is DominioId {
  return typeof v === "string" && DOMINIOS.some((d) => d.id === v);
}

/** Domínio de uma seção de telemetria; "plataforma" para conta e páginas gerais. */
export function dominioDaSecao(secao: string): DominioId | "plataforma" {
  for (const d of DOMINIOS) {
    if (d.prefixosTelemetria.some((p) => secao.startsWith(p))) return d.id;
  }
  return "plataforma";
}

/** Domínio de um caminho público (para destacar o observatório corrente). */
export function dominioDoCaminho(caminho: string): DominioId | null {
  if (caminho === "/credito" || caminho.startsWith("/observatorio")) return "credito";
  if (caminho.startsWith("/setor-eletrico")) return "energia";
  if (caminho.startsWith("/eficiencia-estatal")) return "eficiencia";
  if (caminho === "/contas-publicas" || caminho.startsWith("/contas-publicas/")) return "contas";
  if (caminho === "/contas-publicas-estaduais" || caminho.startsWith("/contas-publicas-estaduais/")) return "estados";
  if (caminho === "/gas-natural" || caminho.startsWith("/gas-natural/")) return "gas";
  return null;
}
