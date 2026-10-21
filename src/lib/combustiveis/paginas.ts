/**
 * Coleção Combustíveis do Observatório de Energia e Infraestrutura: fonte única de rota, rótulo, pergunta e seção de
 * telemetria. Registro (src/lib/observatorios/registro.ts), cabeçalho, telemetria e home leem daqui.
 *
 * A gold é do pipeline do Gás (pipeline/gas, public/gas/gold/combustiveis.json): a mesma planilha da ANP que dá o preço
 * do botijão e do GNV, baixada uma vez. Por isso a origem da coleção é o domínio gas, e a faixa de frescor é a dele.
 */
export type PaginaCombustiveis = {
  slug: string;
  href: string;
  /** Rótulo curto da navegação. */
  rotulo: string;
  /** Pergunta que a página responde, como aparece no título. */
  pergunta: string;
  /** Uma linha sobre o que a página mostra. */
  descricao: string;
  secao: `gas:${string}`;
};

export const ROTA_COMBUSTIVEIS = "/combustiveis";
export const ROTA_CONSULTA_TANQUE = "/combustiveis/no-meu-estado";

export const PAGINAS_COMBUSTIVEIS: PaginaCombustiveis[] = [
  {
    slug: "painel", href: ROTA_COMBUSTIVEIS, rotulo: "Preços nos postos", secao: "gas:combustiveis",
    pergunta: "Quanto custa encher o tanque no meu estado?",
    descricao: "Gasolina, etanol e diesel por estado e no Brasil, mês a mês desde 2013, em valores da época e corrigidos pelo IPCA.",
  },
  {
    slug: "no-meu-estado", href: ROTA_CONSULTA_TANQUE, rotulo: "Consulta por estado", secao: "gas:combustiveis-no-meu-estado",
    pergunta: "Quanto custa encher o tanque no meu estado?",
    descricao: "O preço médio do litro de cada combustível no seu estado no último mês da pesquisa da ANP, comparado com a média do Brasil.",
  },
];

export function paginaCombustiveis(slug: string): PaginaCombustiveis {
  const p = PAGINAS_COMBUSTIVEIS.find((x) => x.slug === slug);
  if (!p) throw new Error(`página de combustíveis fora do catálogo: ${slug}`);
  return p;
}
