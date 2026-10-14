/**
 * Páginas do Observatório Brasileiro de Gás Natural: fonte única de rota, rótulo, pergunta e grupo.
 * Cabeçalho, inicial, vitrine da home, sitemap e telemetria leem daqui. Página nova é uma entrada nova.
 */
export type GrupoGas = "oferta" | "precos" | "mercado" | "dados";

export type PaginaGas = {
  slug: string;
  href: string;
  /** Rótulo curto da navegação. */
  rotulo: string;
  /** Pergunta que a página responde, como aparece no título. */
  pergunta: string;
  /** Uma linha sobre o que a página mostra. */
  descricao: string;
  grupo: GrupoGas;
  secao: `gas:${string}`;
};

export const GRUPOS_GAS: { id: GrupoGas; rotulo: string }[] = [
  { id: "oferta", rotulo: "De onde vem" },
  { id: "precos", rotulo: "Quanto custa" },
  { id: "mercado", rotulo: "Mercado e regras" },
  { id: "dados", rotulo: "Dados e método" },
];

const BASE = "/gas-natural";

export const PAGINAS_GAS: PaginaGas[] = [
  {
    slug: "producao", href: `${BASE}/producao`, rotulo: "Produção", grupo: "oferta", secao: "gas:producao",
    pergunta: "Quanto gás o Brasil produz e onde?",
    descricao: "Produção mensal desde 1997, mar e terra, e a participação de cada estado nos últimos 12 meses.",
  },
  {
    slug: "aproveitamento", href: `${BASE}/aproveitamento`, rotulo: "Aproveitamento", grupo: "oferta", secao: "gas:aproveitamento",
    pergunta: "Quanto do gás produzido chega ao mercado?",
    descricao: "Reinjeção nos reservatórios, queima, consumo nas próprias instalações e gás disponível, no Brasil e por estado.",
  },
  {
    slug: "importacao", href: `${BASE}/importacao`, rotulo: "Importação", grupo: "oferta", secao: "gas:importacao",
    pergunta: "Quanto gás o Brasil importa e de onde ele vem?",
    descricao: "Volume e dispêndio mensais, peso da importação na oferta, gasoduto e GNL por país de origem.",
  },
  {
    slug: "precos", href: `${BASE}/precos`, rotulo: "Preços na cadeia", grupo: "precos", secao: "gas:precos",
    pergunta: "Quanto custa o gás antes de chegar à distribuidora?",
    descricao: "Preço de venda às distribuidoras e consumidores livres por região, vendas entre agentes e referências internacionais.",
  },
  {
    slug: "gas-de-cozinha", href: `${BASE}/gas-de-cozinha`, rotulo: "Gás de cozinha", grupo: "precos", secao: "gas:gas-de-cozinha",
    pergunta: "Quanto custa o botijão de gás no seu estado?",
    descricao: "Preço do GLP em botijão de 13 kg por UF, em valores nominais e corrigidos pelo IPCA, inflação do botijão e vendas.",
  },
  {
    slug: "gnv-e-gas-encanado", href: `${BASE}/gnv-e-gas-encanado`, rotulo: "GNV e gás encanado", grupo: "precos", secao: "gas:gnv-e-gas-encanado",
    pergunta: "Quanto pagam motoristas e residências pelo gás natural?",
    descricao: "Preço do GNV por UF e a inflação do gás encanado e do gás veicular no IPCA.",
  },
  {
    slug: "mercado", href: `${BASE}/mercado`, rotulo: "Abertura do mercado", grupo: "mercado", secao: "gas:mercado",
    pergunta: "Mais empresas estão comprando e vendendo gás?",
    descricao: "Carregadores que movimentam gás na malha de transporte e volumes negociados entre produtores e comercializadores.",
  },
  {
    slug: "infraestrutura", href: `${BASE}/infraestrutura`, rotulo: "Infraestrutura", grupo: "mercado", secao: "gas:infraestrutura",
    pergunta: "Por onde o gás chega ao consumidor?",
    descricao: "Volume entregue por transportadora, atos de autorização de instalações e terminais de GNL.",
  },
  {
    slug: "regulacao", href: `${BASE}/regulacao`, rotulo: "Regulação", grupo: "mercado", secao: "gas:regulacao",
    pergunta: "Quem define as regras do gás no Brasil?",
    descricao: "Competências da União e dos estados e os marcos legais, com link para cada texto oficial.",
  },
  {
    slug: "dados", href: `${BASE}/dados`, rotulo: "Dados e downloads", grupo: "dados", secao: "gas:dados",
    pergunta: "De onde vêm os números e como conferir cada um?",
    descricao: "Cada fonte com data de captura e sha256 do original, cada indicador com fórmula, e as séries para download.",
  },
  {
    slug: "metodologia", href: `${BASE}/metodologia`, rotulo: "Método e glossário", grupo: "dados", secao: "gas:metodologia",
    pergunta: "Como ler os números deste observatório?",
    descricao: "Regras de cálculo, validações publicadas, o que cada medida não permite afirmar e o glossário do gás.",
  },
];

export function paginaGas(slug: string): PaginaGas {
  const p = PAGINAS_GAS.find((x) => x.slug === slug);
  if (!p) throw new Error(`página do gás fora do catálogo: ${slug}`);
  return p;
}
