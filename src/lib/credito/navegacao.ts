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
    secao: "credito:quanto-meu-banco-cobra",
  },
  {
    slug: "simulador-da-parcela",
    href: "/observatorio-do-credito/simulador-da-parcela",
    rotulo: "Simulador da parcela",
    titulo: "Quanto vai custar minha parcela?",
    descricao:
      "Cálculo da parcela, do total pago e dos juros pela tabela Price, com a taxa publicada pelo Banco Central para o banco e a modalidade, ou com a taxa que você digitar, e a comparação com o CET do seu contrato.",
    secao: "credito:simulador-da-parcela",
  },
  {
    slug: "metodologia",
    href: "/observatorio-do-credito/metodologia",
    rotulo: "Metodologia e fontes",
    titulo: "Metodologia e fontes do Crédito",
    descricao:
      "Catálogo das séries com qualidade e defasagem, dicionário de indicadores, model cards, score cards, histórico de versões e linhagem dos arquivos do Observatório de Crédito.",
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
