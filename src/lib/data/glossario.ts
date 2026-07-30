/**
 * Glossário central da Scrutiniums.
 * Um mesmo conceito tem sempre o mesmo nome, definição, unidade,
 * formatação, cor e explicação em toda a plataforma.
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
    slug: "atividade-setorial",
    nome: "Índice de Atividade Setorial",
    unidade: "Índice (base 100 = média de 2022)",
    definicao:
      "Medida composta do nível de atividade econômica de um setor, combinando produção física, faturamento deflacionado e massa de emprego formal.",
    formula:
      "Média ponderada normalizada: 0,4 × produção física + 0,35 × faturamento real + 0,25 × emprego formal, reescalonada para base 100 na média de 2022.",
    interpretacao:
      "Valores acima de 100 indicam atividade superior à média de 2022. Variações mensais menores que 0,5 ponto costumam estar dentro do ruído da série.",
    fonte: "IBGE (PIM-PF, PMC, PMS), CAGED e dados próprios",
    cobertura: "Janeiro de 2012 até o mês anterior ao corrente",
    frequencia: "Mensal, divulgado até o dia 20",
    limitacoes:
      "Setores com alta informalidade são subrepresentados pelo componente de emprego formal. Revisões das fontes primárias alteram os últimos três meses da série.",
    revisaoMetodologica: "2026-03-15",
  },
  {
    slug: "risco-de-credito-setorial",
    nome: "Indicador de Risco de Crédito Setorial",
    unidade: "% da carteira (inadimplência acima de 90 dias)",
    definicao:
      "Percentual das operações de crédito de um setor com atraso superior a 90 dias, ponderado pelo saldo das carteiras.",
    formula:
      "Soma dos saldos em atraso > 90 dias ÷ saldo total da carteira ativa do setor × 100.",
    interpretacao:
      "Leituras acima da média histórica do setor sinalizam deterioração. Compare sempre com o próprio histórico setorial, não entre setores com estruturas de garantia distintas.",
    fonte: "Banco Central do Brasil (SCR, dados agregados públicos)",
    cobertura: "Março de 2015 até o trimestre anterior",
    frequencia: "Trimestral",
    limitacoes:
      "Dados agregados não capturam heterogeneidade dentro do setor. Renegociações podem reduzir o indicador sem melhora real da capacidade de pagamento.",
    revisaoMetodologica: "2026-01-10",
  },
  {
    slug: "score-de-sentimento-regulatorio",
    nome: "Score de Sentimento Regulatório",
    unidade: "Escala de -1 a +1",
    definicao:
      "Medida da orientação de comunicados e normativos de reguladores em relação a um tema, estimada por modelo de linguagem treinado em corpus regulatório brasileiro.",
    formula:
      "Classificação de sentenças por modelo supervisionado, agregada por média ponderada pela relevância do documento no período.",
    interpretacao:
      "Valores positivos indicam orientação flexibilizadora; negativos, restritiva. O score complementa a análise humana e não substitui a leitura dos normativos.",
    fonte: "Diário Oficial da União, Banco Central, CVM e SUSEP (documentos públicos)",
    cobertura: "Janeiro de 2018 até a semana anterior",
    frequencia: "Semanal",
    limitacoes:
      "Modelos de linguagem erram em ironia, contexto histórico e normas de redação atípica. A margem de erro estimada é de ±0,12. Resultados passam por amostragem de validação humana.",
    revisaoMetodologica: "2026-05-02",
  },
  {
    slug: "concentracao-de-mercado",
    nome: "Índice de Concentração de Mercado (HHI)",
    unidade: "Pontos (0 a 10.000)",
    definicao:
      "Índice Herfindahl-Hirschman: soma dos quadrados das participações de mercado das empresas de um setor.",
    formula: "HHI = Σ (participação de mercado de cada empresa em %)².",
    interpretacao:
      "Abaixo de 1.500: mercado desconcentrado. Entre 1.500 e 2.500: concentração moderada. Acima de 2.500: mercado concentrado, seguindo referências usuais de autoridades de defesa da concorrência.",
    fonte: "CADE, CVM, demonstrações financeiras públicas e registros setoriais",
    cobertura: "2010 até o exercício anterior",
    frequencia: "Anual, com atualização extraordinária após operações relevantes",
    limitacoes:
      "Participações estimadas para empresas de capital fechado carregam incerteza. Mercados relevantes geográficos podem diferir do recorte nacional adotado.",
    revisaoMetodologica: "2025-11-20",
  },
];

export function getGlossaryEntry(slug: string): GlossaryEntry | undefined {
  return GLOSSARIO.find((e) => e.slug === slug);
}
