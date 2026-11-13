/**
 * Páginas Next do Crédito (as demais vistas estão na aplicação de página única, /observatorio). Fonte única dos
 * rótulos, endereços e descrições usados no cabeçalho do módulo, no registro dos observatórios, na página aberta
 * e nos testes. Rotas com conta: nenhuma consta de src/lib/rotasPublicas.ts (rota nova nasce fechada).
 */
export type PaginaCredito = {
  slug: "quanto-meu-banco-cobra" | "simulador-da-parcela" | "metodologia";
  href: string;
  /** Rótulo curto da navegação. */
  rotulo: string;
  /** Título da página e do registro dos observatórios. */
  titulo: string;
  descricao: string;
  /** Uma frase para a busca da plataforma (até 140 caracteres) e os termos que levam à página (ciclo 2 da busca, bloco 3). */
  resumo: string;
  termos: string[];
  /** Seção de telemetria (src/lib/telemetry.ts). */
  secao: "credito:quanto-meu-banco-cobra" | "credito:simulador-da-parcela" | "credito:metodologia";
};

export const PAGINAS_CREDITO: PaginaCredito[] = [
  {
    slug: "quanto-meu-banco-cobra",
    href: "/observatorio-do-credito/quanto-meu-banco-cobra",
    rotulo: "Quanto meu banco cobra?",
    titulo: "Quanto meu banco cobra?",
    descricao:
      "A taxa de juros média que o banco informou ao Banco Central na modalidade escolhida, ao lado da mediana e da distribuição entre as instituições, com a janela de referência e o aviso de que taxa não é CET.",
    resumo: "A taxa média de juros que o seu banco informou ao Banco Central, por modalidade, ao lado das demais.",
    termos: ["juros do meu banco", "taxa de juros", "modalidade", "mediana", "CET"],
    secao: "credito:quanto-meu-banco-cobra",
  },
  {
    slug: "simulador-da-parcela",
    href: "/observatorio-do-credito/simulador-da-parcela",
    rotulo: "Simulador da parcela",
    titulo: "Quanto vai custar minha parcela?",
    descricao:
      "Cálculo da parcela, do total pago e dos juros pela tabela Price, com a taxa publicada pelo Banco Central para o banco e a modalidade, ou com a taxa que você digitar, e a comparação com o CET do seu contrato.",
    resumo: "Parcela, total pago e juros pela tabela Price, com a taxa publicada para o banco ou a que você digitar.",
    termos: ["parcela", "tabela Price", "empréstimo", "financiamento", "CET"],
    secao: "credito:simulador-da-parcela",
  },
  {
    slug: "metodologia",
    href: "/observatorio-do-credito/metodologia",
    rotulo: "Metodologia e fontes",
    titulo: "Metodologia e fontes do Crédito",
    descricao:
      "Catálogo das séries com qualidade e defasagem, dicionário de indicadores, model cards, score cards, histórico de versões e linhagem dos arquivos do Observatório de Crédito.",
    resumo: "Séries com qualidade e defasagem, dicionário de indicadores e linhagem dos arquivos do Crédito.",
    termos: ["metodologia", "fontes", "dicionário de indicadores", "model cards"],
    secao: "credito:metodologia",
  },
];

export function paginaCredito(slug: PaginaCredito["slug"]): PaginaCredito {
  const p = PAGINAS_CREDITO.find((x) => x.slug === slug);
  if (!p) throw new Error(`página do Crédito desconhecida: ${slug}`);
  return p;
}

/** Vista de juros por instituição na aplicação de página única (painel completo, com histórico e as 20 modalidades). */
export const PAINEL_JUROS = "/observatorio/interest-rates";
/** Vista de metodologia da aplicação de página única, com os conceitos clicáveis. */
export const METODO_SPA = "/observatorio/methodology";

/**
 * Os grupos do Crédito na ordem da jornada (decisão do dono de 18/10/2026: oito grupos, de "Começar" a "Referência"), com
 * as páginas de cada um, as da aplicação de página única (/observatorio/*) e as Next do Crédito. Fonte única do agrupamento
 * desde a Iniciativa 2 do parecer de UX de 23/10/2026 (o Crédito na mesma casca): a navegação da coleção
 * (navegacaoColecao.ts) mostra só as páginas que o Crédito mantém, porque as que pertencem a outra coleção
 * (DESTINO_ABAS_CREDITO, registro.ts) ficam na navegação da coleção dona; o "Início do painel" da aplicação lista todas, por
 * pergunta. Decisões do dono de 23/10/2026: "Metodologia e fontes" entra em "Começar", o "Simulador da parcela" em "Produtos e
 * preços", "Marcos regulatórios" fica sozinho em "Referência" (vira item próprio da navegação) e "Sobre o Observatório" vai
 * para o fim da página. `curto`: o rótulo do grupo na navegação, quando o nome inteiro não deixa os oito itens e os atalhos
 * caberem numa linha a 1440 px (medido em 23/10/2026: faltavam 90 px e "Marcos regulatórios" saía cortado), como o Setor
 * Elétrico faz com os grupos longos; o nome inteiro continua no "Início do painel".
 *
 * Desde 10/11/2026 (decisão do dono), nove páginas dos grupos "Território e pessoas", "Risco, cobrança e recuperação" e
 * "Pagamentos, conduta e fronteiras" são páginas Next do Observatório das Famílias (/divida-das-familias/*, /credito-imobiliario e
 * /emprego-formal, `redirecionar: true` em src/lib/observatorios/paineis-reescritos.json): o grupo guarda o endereço novo, o
 * "Início do painel" as lista como link para fora da aplicação e a navegação do Crédito não as mostra (são de outra coleção). O
 * teste src/tests/mapa-menu.test.ts confere que nenhum grupo aponta para um endereço redirecionado. As três últimas (Consignado,
 * Crédito imobiliário e Emprego formal) entraram na lista no mesmo dia, depois de fechada a paridade declarada em
 * docs/familias/PARIDADE.md (mapa municipal, estado no endereço, dispersão e pesos do Risco setorial).
 */
export const GRUPOS_CREDITO: readonly { rotulo: string; curto?: string; paginas: readonly string[] }[] = [
  { rotulo: "Começar", paginas: ["/observatorio/map", "/observatorio/overview", "/observatorio/alerts", METODO_SPA] },
  { rotulo: "Ciclo do crédito", paginas: ["/observatorio/credit", "/observatorio/leading-signals", "/observatorio/scenarios", "/observatorio/search-trends"] },
  {
    rotulo: "Instituições e funding",
    curto: "Instituições",
    paginas: ["/observatorio/bank-profit", "/observatorio/institutions", "/observatorio/compare", "/observatorio/sfn-entries-exits", "/observatorio/funding", "/observatorio/fidc-receivables", "/observatorio/operational-indicators", "/observatorio/market"],
  },
  {
    rotulo: "Produtos e preços",
    paginas: ["/observatorio/products", "/observatorio/loan-maturity", PAINEL_JUROS, "/observatorio-do-credito/simulador-da-parcela", "/observatorio/rural-credit", "/observatorio/directed-credit-bndes", "/observatorio/broad-credit", "/observatorio/consortia"],
  },
  {
    rotulo: "Território e pessoas",
    curto: "Território",
    paginas: ["/observatorio/states", "/observatorio/credit-panorama", "/observatorio/credit-penetration", "/credito-imobiliario", "/divida-das-familias/consignado", "/emprego-formal", "/observatorio/subnational-credit"],
  },
  { rotulo: "Risco, cobrança e recuperação", paginas: ["/observatorio/sectors", "/divida-das-familias/desenrola", "/divida-das-familias/bancos-cobrando-na-justica", "/observatorio/recoveries", "/observatorio/federal-tax-debt"] },
  {
    rotulo: "Pagamentos, conduta e fronteiras",
    paginas: ["/observatorio/pix", "/observatorio/open-finance", "/divida-das-familias/sancoes-e-reclamacoes", "/divida-das-familias/clientes-contra-bancos", "/divida-das-familias/apostas", "/divida-das-familias/golpes-e-fraudes"],
  },
  { rotulo: "Referência", paginas: ["/observatorio/regulacao"] },
];

/** O "Início do painel" da aplicação: lista as páginas dos grupos e por isso não se conta entre elas. */
export const INICIO_DO_PAINEL = "/observatorio/map";
/** Prefixo dos endereços da aplicação de página única do Crédito. */
const PREFIXO_DA_APLICACAO = "/observatorio/";

/**
 * As páginas temáticas que a aplicação do Crédito mantém: as vistas da aplicação nos grupos, sem o "Início do painel". É a
 * contagem que o próprio "Início do painel" escreve no cabeçalho (renderMapa em public/obs/app.js: as vistas dos grupos, menos
 * o mapa e as substituídas por página das Famílias) e a que a vitrine da home mostra para o Crédito (src/lib/vitrine.ts).
 * Uma vista reescrita como página de outra coleção sai daqui sozinha, porque o grupo passa a guardar o endereço novo; as
 * páginas Next do Crédito nos grupos (o Simulador da parcela) e as do fim da página (FIM_DA_PAGINA_CREDITO) não entram, como
 * na aplicação. O teste src/tests/vitrine-credito-contagem.test.ts confere a igualdade com o que a aplicação conta.
 */
export function paginasTematicasDoCredito(): string[] {
  return GRUPOS_CREDITO.flatMap((g) => g.paginas).filter((h) => h.startsWith(PREFIXO_DA_APLICACAO) && h !== INICIO_DO_PAINEL);
}

/** Páginas da aplicação que ficam no fim da página, fora dos grupos: perguntas rápidas, sugestões e o "Sobre". */
export const FIM_DA_PAGINA_CREDITO: readonly { rotulo: string; href: string }[] = [
  { rotulo: "Perguntas rápidas", href: "/observatorio/research" },
  { rotulo: "Sobre o Observatório", href: "/observatorio/about" },
  { rotulo: "Sugestões", href: "/observatorio/suggestions" },
];
