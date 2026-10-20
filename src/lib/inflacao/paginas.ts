/**
 * Painel "Inflação por cidade" (Observatório das Famílias, coleção Custo de vida): fonte única de rota, rótulo, pergunta e
 * seção de telemetria. Registro (src/lib/observatorios/registro.ts), cabeçalho, telemetria, camada aberta e entradas leem
 * daqui.
 *
 * O próprio Observatório das Famílias mantém o pipeline (pipeline/inflacao) e a gold (public/inflacao/gold/ipca.json): a
 * origem do painel no registro é null, como nos painéis do Território e Clima, e a fonte de frescor é "inflacao"
 * (src/lib/frescor/limiares.json). A inflação dos alimentos item por item continua no painel canônico /agronegocio/prato.
 */
export type PaginaInflacao = {
  slug: string;
  href: string;
  /** Rótulo curto da navegação da coleção. */
  rotulo: string;
  /** Pergunta que a página responde, como aparece no título. */
  pergunta: string;
  /** Uma linha sobre o que a página mostra. */
  descricao: string;
  secao: `familias:${string}`;
};

export const ROTA_INFLACAO = "/custo-de-vida";
export const ROTA_CONSULTA_CIDADE = "/custo-de-vida/na-minha-cidade";
/** Painel canônico da inflação dos alimentos (Agronegócio, Comida no prato), citado com link. */
export const ROTA_COMIDA = "/agronegocio/prato";
export const TITULO_PAINEL = "Inflação por cidade";

export const PAGINAS_INFLACAO: PaginaInflacao[] = [
  {
    slug: "painel", href: ROTA_INFLACAO, rotulo: TITULO_PAINEL, secao: "familias:custo-de-vida",
    pergunta: "Quanto subiu o custo de vida na minha cidade?",
    descricao: "A inflação do IPCA em cada uma das 16 áreas pesquisadas pelo IBGE e no Brasil, no índice geral e nos nove grupos de despesa, mês a mês desde 2020.",
  },
  {
    slug: "na-minha-cidade", href: ROTA_CONSULTA_CIDADE, rotulo: "Consulta por cidade", secao: "familias:custo-de-vida-na-minha-cidade",
    pergunta: "Quanto subiu o custo de vida na minha cidade?",
    descricao: "A inflação em 12 meses da sua cidade ou região metropolitana no último mês do IPCA, no índice geral e nos nove grupos, comparada com a do Brasil.",
  },
];

export function paginaInflacao(slug: string): PaginaInflacao {
  const p = PAGINAS_INFLACAO.find((x) => x.slug === slug);
  if (!p) throw new Error(`página de inflação fora do catálogo: ${slug}`);
  return p;
}
