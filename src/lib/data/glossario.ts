/**
 * Glossário central da Scrutiniums.
 * Um mesmo conceito tem sempre o mesmo nome, definição, unidade,
 * formatação e explicação em toda a plataforma. Só entram aqui conceitos
 * que a plataforma efetivamente exibe, com fonte primária real — nenhum
 * verbete descreve indicador que não exista no acervo.
 */
export type GlossaryEntry = {
  slug: string;
  nome: string;
  unidade: string;
  definicao: string;
  formula: string;
  interpretacao: string;
  fonte: string;
  cobertura: string;
  frequencia: string;
  limitacoes: string;
  revisaoMetodologica: string;
};

export const GLOSSARIO: GlossaryEntry[] = [
  {
    slug: "inadimplencia-90-dias",
    nome: "Inadimplência (atraso acima de 90 dias)",
    unidade: "% da carteira ativa",
    definicao:
      "Parcela da carteira de crédito com pelo menos uma parcela em atraso superior a 90 dias. É o conceito mais usado nas divulgações do Banco Central, mas não é o único: atraso de 15 a 90 dias e ativos problemáticos são medidas diferentes, com valores diferentes.",
    formula:
      "Saldo das operações com atraso superior a 90 dias ÷ saldo total da carteira ativa × 100.",
    interpretacao:
      "Compare cada recorte com o próprio histórico: níveis absolutos variam por produto, garantia e público. A plataforma declara, em cada número, qual conceito de inadimplência está sendo usado — os conceitos oficiais não são intercambiáveis.",
    fonte: "Banco Central do Brasil (séries SGS e agregados públicos do SCR)",
    cobertura: "Conforme a série; cada página declara a data-base do recorte exibido",
    frequencia: "Mensal",
    limitacoes:
      "Renegociações e reestruturações reduzem o indicador sem necessariamente melhorar a capacidade de pagamento. Baixas para prejuízo retiram operações da carteira e também reduzem a razão. Dados agregados escondem heterogeneidade dentro de cada recorte.",
    revisaoMetodologica: "2026-08-05",
  },
  {
    slug: "carteira-de-credito",
    nome: "Carteira de crédito (saldo)",
    unidade: "R$ (saldo em fim de período)",
    definicao:
      "Estoque de crédito ativo em uma data: a soma dos saldos devedores de todas as operações vigentes do recorte (país, estado, segmento, produto ou instituição).",
    formula: "Soma dos saldos devedores das operações ativas do recorte na data-base.",
    interpretacao:
      "Estoque, não fluxo: a carteira pode crescer mesmo com concessões em queda, se as operações antigas forem longas. Para comparar regiões ou períodos, normalize — por habitante ou como proporção do PIB — em vez de comparar valores absolutos.",
    fonte: "Banco Central do Brasil (séries SGS e agregados públicos do SCR)",
    cobertura: "Conforme a série; cada página declara a data-base do recorte exibido",
    frequencia: "Mensal",
    limitacoes:
      "Valores nominais: comparações longas no tempo exigem deflacionamento. Mudanças de escopo das fontes (instituições incluídas, conceitos de carteira) produzem quebras que a plataforma anota quando existem.",
    revisaoMetodologica: "2026-08-05",
  },
  {
    slug: "concessoes",
    nome: "Concessões de crédito",
    unidade: "R$ por mês",
    definicao:
      "Fluxo de crédito novo: o valor das operações contratadas no mês, independentemente do prazo em que serão pagas.",
    formula: "Soma do valor contratado das operações iniciadas no mês, no recorte exibido.",
    interpretacao:
      "Fluxo, não estoque: mede o ritmo de contratação e reage antes da carteira a mudanças de juros, apetite de risco e demanda. Séries de concessões têm sazonalidade forte — compare com o mesmo mês de anos anteriores ou use médias móveis.",
    fonte: "Banco Central do Brasil (séries SGS)",
    cobertura: "Conforme a série; cada página declara a data-base do recorte exibido",
    frequencia: "Mensal",
    limitacoes:
      "Renovações e renegociações podem aparecer como concessão nova sem crédito novo na economia. Valores nominais, sujeitos a revisão nas divulgações seguintes.",
    revisaoMetodologica: "2026-08-05",
  },
  {
    slug: "comprometimento-de-renda",
    nome: "Comprometimento de renda das famílias",
    unidade: "% da renda mensal",
    definicao:
      "Percentual da renda das famílias comprometido com o serviço das dívidas bancárias (juros e amortizações) no mês.",
    formula:
      "Serviço da dívida das famílias com o sistema financeiro ÷ renda das famílias, em série dessazonalizada do Banco Central (SGS 29034).",
    interpretacao:
      "Mede o aperto do orçamento no presente: pode subir por mais dívida, juros maiores ou prazos menores, mesmo com o estoque estável. É um agregado nacional — famílias endividadas específicas podem estar muito acima da média.",
    fonte: "Banco Central do Brasil (SGS 29034)",
    cobertura: "Série nacional agregada; a página exibe a data-base vigente",
    frequencia: "Mensal, com defasagem de divulgação",
    limitacoes:
      "Só captura dívidas com o sistema financeiro nacional — crediário não bancário e dívidas informais ficam de fora. Média nacional esconde a distribuição; a dessazonalização é revista retroativamente.",
    revisaoMetodologica: "2026-08-05",
  },
  {
    slug: "endividamento-das-familias",
    nome: "Endividamento das famílias",
    unidade: "% da renda acumulada em 12 meses",
    definicao:
      "Razão entre o estoque de dívidas das famílias com o sistema financeiro e a renda acumulada nos últimos doze meses.",
    formula: "Saldo das dívidas das famílias ÷ renda acumulada em 12 meses (SGS 29037).",
    interpretacao:
      "Mede o peso do estoque, não o aperto do mês — o par natural do comprometimento de renda. Endividamento alto com comprometimento baixo sugere dívidas longas e baratas (como financiamento imobiliário); a composição importa tanto quanto o nível.",
    fonte: "Banco Central do Brasil (SGS 29037)",
    cobertura: "Série nacional agregada; a página exibe a data-base vigente",
    frequencia: "Mensal, com defasagem de divulgação",
    limitacoes:
      "Mesmo escopo do comprometimento: apenas dívidas com o sistema financeiro nacional. A renda do denominador é estimada e revisada; comparações internacionais exigem cuidado com diferenças de conceito.",
    revisaoMetodologica: "2026-08-05",
  },
  {
    slug: "ggr",
    nome: "GGR (receita bruta de jogos)",
    unidade: "R$ no período",
    definicao:
      "Gross Gaming Revenue: o total apostado menos os prêmios pagos — a receita bruta dos operadores de apostas antes de tributos e despesas.",
    formula: "Total de apostas − prêmios pagos, no mercado regulado, conforme reporte ao SIGAP/SPA.",
    interpretacao:
      "GGR não é depósito, não é perda individual do apostador, não é arrecadação pública e não é o fluxo bruto de Pix a operadoras — cada um desses conceitos tem valor e significado diferentes, e a plataforma nunca os apresenta como a mesma coisa.",
    fonte: "Secretaria de Prêmios e Apostas do Ministério da Fazenda (Panoramas semestrais, dados do SIGAP)",
    cobertura: "Mercado autorizado (bet.br) desde a regulamentação, em janeiro de 2025",
    frequencia: "Semestral",
    limitacoes:
      "Série curta e com quebra estrutural na origem (o mercado anterior a 2025 não era medido): ainda não sustenta correlações nem índices. Não inclui o mercado ilegal, cuja dimensão só existe como estimativa privada.",
    revisaoMetodologica: "2026-08-05",
  },
  {
    slug: "concentracao-de-mercado",
    nome: "Índice de Concentração de Mercado (HHI)",
    unidade: "Pontos (0 a 10.000)",
    definicao:
      "Índice Herfindahl-Hirschman: soma dos quadrados das participações de mercado das empresas de um mercado. É o conceito de referência para medir concentração.",
    formula: "HHI = Σ (participação de mercado de cada empresa em %)².",
    interpretacao:
      "Abaixo de 1.500: mercado desconcentrado. Entre 1.500 e 2.500: concentração moderada. Acima de 2.500: mercado concentrado, seguindo referências usuais de autoridades de defesa da concorrência.",
    fonte:
      "Conceito da literatura de organização industrial; limiares de referência de autoridades de defesa da concorrência (CADE, DOJ/FTC)",
    cobertura: "Aplicável a qualquer mercado com participações mensuráveis",
    frequencia: "Conforme a disponibilidade do dado de participação usado no cálculo",
    limitacoes:
      "O resultado depende inteiramente da definição do mercado relevante (produto e geografia) e da qualidade das participações usadas. Participações estimadas para empresas de capital fechado carregam incerteza.",
    revisaoMetodologica: "2026-08-05",
  },
];

export function getGlossaryEntry(slug: string): GlossaryEntry | undefined {
  return GLOSSARIO.find((e) => e.slug === slug);
}
