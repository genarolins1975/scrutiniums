/**
 * Registro dos observatórios da Scrutiniums (domínios analíticos).
 *
 * Fonte única de nome, pergunta, descrição, chips, rota e acento de cada
 * observatório. Home, tela "Escolha seu observatório", switcher do cabeçalho,
 * telemetria e sitemap leem daqui. Um novo observatório é uma entrada nova.
 */

export type DominioId = "credito" | "energia" | "eficiencia";

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
  /** Token de cor de acento (tailwind): bronze para Crédito, energia para Setor Elétrico, obee para Eficiência Estatal. */
  acento: "bronze" | "energia" | "obee";
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
      "Indicadores públicos sobre recursos, atendimento e resultados, com definição, fonte, período e limitações em cada número. Dois temas publicados nas 26 capitais: educação municipal (despesa total, por habitante e por matrícula, matrículas, alunos por turma, aprovação, Ideb e Saeb) e saúde (despesa, ações e serviços públicos de saúde, UBS, equipes e cobertura da atenção primária e internações por condições sensíveis à atenção primária). Mostra valores e referências, sem notas, rankings ou conclusões.",
    descricaoCurta:
      "Educação e Saúde nas capitais: despesa, estrutura, atendimento e resultados a partir do Siconfi, SIOPS, CNES, Ministério da Saúde, IBGE e INEP.",
    chips: ["Recursos", "Atendimento", "Resultados", "Educação", "Saúde"],
    rotaRaiz: "/eficiencia-estatal",
    rotaApresentacao: "/eficiencia-estatal",
    cta: "Explorar Eficiência Estatal",
    acento: "obee",
    prefixosTelemetria: ["eficiencia:"],
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
  return null;
}
