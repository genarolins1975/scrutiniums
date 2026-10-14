/**
 * Arquitetura do Observatório Brasileiro do Saneamento: cinco eixos, catorze
 * capítulos e as ferramentas transversais. Fonte única para cabeçalho, índice
 * da página inicial, vitrine da plataforma, sitemap e testes.
 *
 * Situação de cada capítulo, sem promessa:
 *  - "publicado": painel com dados reais na cobertura declarada;
 *  - "parcial": painel com dados reais em parte das perguntas; o que falta e a
 *    dependência exata aparecem no próprio painel e aqui;
 *  - "em_preparacao": sem painel; o capítulo não vira link, só descreve a
 *    dependência.
 */

export const ROTA = "/saneamento";

export type Situacao = "publicado" | "parcial" | "em_preparacao";

export type Capitulo = {
  numero: number;
  slug: string;
  /** Pergunta principal, como título. */
  pergunta: string;
  /** Rótulo curto de navegação. */
  rotulo: string;
  resumo: string;
  situacao: Situacao;
  /** O que ainda falta e de que depende (obrigatório quando não publicado). */
  pendencia?: string;
  /** Subpainéis (só o capítulo 5). */
  subpaineis?: { slug: string; numero: string; rotulo: string; pergunta: string; situacao: Situacao; pendencia?: string }[];
};

export type Eixo = { id: "A" | "B" | "C" | "D" | "E"; rotulo: string; curto: string; resumo: string; capitulos: Capitulo[] };

export const EIXOS: Eixo[] = [
  {
    id: "A",
    rotulo: "Acesso e qualidade",
    curto: "Acesso",
    resumo: "Quem está sem água e esgoto, quem fica para trás, se a água chega e para onde vai o esgoto.",
    capitulos: [
      {
        numero: 1,
        slug: "acesso",
        rotulo: "Sem atendimento",
        pergunta: "Quantas pessoas ainda estão sem atendimento adequado?",
        resumo: "Carência de água e esgoto em pessoas e em proporção, nos 5.570 municípios, pelo Censo 2022 e pelo SINISA 2024.",
        situacao: "publicado",
      },
      {
        numero: 2,
        slug: "desigualdades",
        rotulo: "Quem fica para trás",
        pergunta: "Quem fica para trás?",
        resumo: "Diferenças por cor ou raça, quilombolas, indígenas, favelas e áreas urbanas e rurais nas tabelas do Censo 2022.",
        situacao: "parcial",
        pendencia:
          "Censo 2022 por cor ou raça, esgoto de quilombolas e indígenas e água/esgoto em favelas integrados. Ligação à rede de água para quilombolas e indígenas pela identificação ampliada e recortes urbano/rural ainda não integrados. Renda individual cruzada com saneamento não publicada pelo Censo.",
      },
      {
        numero: 3,
        slug: "continuidade",
        rotulo: "Regularidade e qualidade",
        pergunta: "A água chega regularmente e com qualidade monitorada?",
        resumo:
          "Paralisações e racionamento declarados ao SINISA 2024; qualidade da água no SISAGUA, com controle do prestador, vigilância da saúde e plano de amostragem, em 2024 e 2025.",
        situacao: "parcial",
        pendencia:
          "SISAGUA integrado para E. coli, coliformes totais, cloro residual livre e turbidez na rede e no consumo, e para o plano de coliformes totais da rede de SAA. Ainda não integrados: demais parâmetros (cor, pH, fluoreto, cianobactérias, substâncias químicas), plano de SAC, população abastecida por forma de abastecimento e série anterior a 2024.",
      },
      {
        numero: 4,
        slug: "esgoto",
        rotulo: "Destino do esgoto",
        pergunta: "Para onde vai o esgoto?",
        resumo: "Coleta, tratamento com denominadores explícitos, ligações possíveis ainda não feitas e estações de tratamento declaradas.",
        situacao: "publicado",
      },
    ],
  },
  {
    id: "B",
    rotulo: "Preço regulado e conta das famílias",
    curto: "Preço regulado",
    resumo: "Quanto se paga, por que o valor foi autorizado, o que ele financia, quem assume os riscos e se a conta cabe no orçamento.",
    capitulos: [
      {
        numero: 5,
        slug: "preco-regulado",
        rotulo: "Preço regulado",
        pergunta: "Preço regulado: o que pagamos, por que foi autorizado e o que ele financia?",
        resumo: "Simulador com regras verificadas, formação da tarifa pelo regulador, reajustes, contrapartidas e riscos.",
        situacao: "parcial",
        pendencia: "Amostra de prestadores e decisões tarifárias limitada aos atos verificados; cada subpainel declara o tamanho da amostra.",
        subpaineis: [
          { slug: "simulador", numero: "5.1", rotulo: "Quanto pagaríamos", pergunta: "Quanto pagaríamos pelo mesmo consumo?", situacao: "parcial" },
          { slug: "formacao", numero: "5.2", rotulo: "Como o regulador chega ao valor", pergunta: "Como o regulador chega ao valor da tarifa?", situacao: "parcial" },
          { slug: "reajustes", numero: "5.3", rotulo: "Por que a conta aumentou", pergunta: "Por que a conta aumentou?", situacao: "parcial" },
          { slug: "contrapartidas", numero: "5.4", rotulo: "Preço e serviço", pergunta: "O preço autorizado está associado a melhor serviço?", situacao: "parcial" },
          { slug: "riscos", numero: "5.5", rotulo: "Riscos e desvios", pergunta: "Quem assume os riscos e quem paga pelos desvios?", situacao: "parcial" },
        ],
      },
      {
        numero: 6,
        slug: "tarifa-social",
        rotulo: "Conta e tarifa social",
        pergunta: "A conta cabe no orçamento? A tarifa social chega a quem precisa?",
        resumo:
          "Regras da Lei 14.898/2024, o que cada prestador declarou ao SINISA, economias com tarifa social por família elegível do CadÚnico e cenários de comprometimento de renda.",
        situacao: "parcial",
        pendencia:
          "O SINISA conta economias com tarifa social, não famílias beneficiadas; a razão sobre as famílias elegíveis do CadÚnico é aproximação declarada como tal. Famílias beneficiadas por município dependem de dado dos prestadores ou da ANA, ainda não publicado.",
      },
    ],
  },
  {
    id: "C",
    rotulo: "Empresas e prestação do serviço",
    curto: "Prestadores",
    resumo: "Quem presta o serviço em cada município, sob qual natureza jurídica e instrumento, e como os prestadores se comparam.",
    capitulos: [
      {
        numero: 7,
        slug: "prestadores",
        rotulo: "Quem presta",
        pergunta: "Quem presta o serviço e quem controla as empresas?",
        resumo: "Cadastro de prestadores declarados ao SINISA, com natureza jurídica, abrangência, municípios, instrumento de delegação e vigência.",
        situacao: "parcial",
        pendencia:
          "Controle societário e grupos econômicos: dependem de formulários da CVM e de documentos societários; não integrados. O painel mostra a natureza jurídica declarada em 2024.",
      },
      {
        numero: 8,
        slug: "prestadores/comparar",
        rotulo: "Como se comparam",
        pergunta: "Como os prestadores se comparam em serviço, operação e finanças?",
        resumo: "Até quatro prestadores lado a lado: perdas, receita e despesa por metro cúbico, investimento e demonstrações declaradas.",
        situacao: "parcial",
        pendencia:
          "Seleção de pares por escala, densidade e renda e reconciliação de demonstrações auditadas (CVM) ainda não feitas; a comparação é descritiva e declara o perímetro de cada número.",
      },
    ],
  },
  {
    id: "D",
    rotulo: "Investimento e planejamento",
    curto: "Investimento e metas",
    resumo: "Onde o investimento chega, de onde vem o dinheiro, se o planejamento leva à meta e quem responde por ela.",
    capitulos: [
      {
        numero: 9,
        slug: "investimento",
        rotulo: "Onde o investimento chega",
        pergunta: "Onde o investimento está chegando? As obras viram serviço?",
        resumo: "Investimento declarado em 2024 por município, água e esgoto, expansão e reposição, ao lado da carência medida pelo Censo.",
        situacao: "parcial",
        pendencia: "Obras identificadas (cronograma, avanço físico e entrada em operação) dependem de bases de execução ainda não integradas.",
      },
      {
        numero: 10,
        slug: "financiamento",
        rotulo: "De onde vem o dinheiro",
        pergunta: "De onde vem o dinheiro e quem suporta o custo?",
        resumo: "Recursos próprios, onerosos e não onerosos declarados por prestadores e Estados no SINISA 2024.",
        situacao: "parcial",
        pendencia: "Contratações e desembolsos do BNDES, CAIXA e Transferegov ainda não conciliados com o SINISA; sem conciliação não se somam.",
      },
      {
        numero: 11,
        slug: "planejamento",
        rotulo: "Metas e planos",
        pergunta: "O planejamento é suficiente para a universalização?",
        resumo: "Metas do art. 11-B, indicadores da NR ANA 8/2024, situação observada, ritmo aritmético e planos municipais declarados.",
        situacao: "publicado",
      },
      {
        numero: 12,
        slug: "responsaveis",
        rotulo: "Quem responde",
        pergunta: "Quem responde pelas metas, fiscaliza e atende o cidadão?",
        resumo: "Titular, prestador e regulador de cada município, conselhos, ouvidorias e o catálogo de entidades reguladoras por CNPJ.",
        situacao: "parcial",
        pendencia: "Contratos, fiscalizações e sanções dependem dos portais de cada regulador; o painel publica só o que o SINISA declara.",
      },
    ],
  },
  {
    id: "E",
    rotulo: "Saúde, ambiente e resiliência",
    curto: "Saúde e ambiente",
    resumo: "Relações documentadas entre saneamento, saúde e ambiente e a preparação para secas, enchentes e crescimento urbano.",
    capitulos: [
      {
        numero: 13,
        slug: "saude-ambiente",
        rotulo: "Saúde e ambiente",
        pergunta: "Como saneamento, saúde e ambiente se relacionam?",
        resumo: "Internações e óbitos por doenças relacionadas ao saneamento e qualidade de corpos d'água monitorados.",
        situacao: "em_preparacao",
        pendencia:
          "DATASUS (SIH e SIM por residência, com grupos diagnósticos documentados) e redes de monitoramento de qualidade da água bruta ainda não integrados.",
      },
      {
        numero: 14,
        slug: "resiliencia",
        rotulo: "Secas e eventos extremos",
        pergunta: "O serviço está preparado para secas, enchentes e crescimento urbano?",
        resumo: "Interrupções sistemáticas por baixa disponibilidade do manancial e dias de colapso declarados ao SINISA 2024.",
        situacao: "parcial",
        pendencia:
          "Mananciais, bacias, eventos da Defesa Civil e Cemaden e planos de contingência ainda não integrados; o painel mostra apenas o que os prestadores declararam.",
      },
    ],
  },
];

export const CAPITULOS: Capitulo[] = EIXOS.flatMap((e) => e.capitulos);

export const FERRAMENTAS = [
  { slug: "municipio", rotulo: "Meu município", descricao: "Busca por nome: carência, prestador, regulador, plano, investimento e comparação com o estado." },
  { slug: "comparar", rotulo: "Comparar municípios", descricao: "Até quatro municípios lado a lado, com período comum e link compartilhável." },
  { slug: "metodologia", rotulo: "Método e fontes", descricao: "Fontes, matriz de viabilidade, conferências entre bases e downloads." },
] as const;

export function rotaCapitulo(c: Pick<Capitulo, "slug">): string {
  return `${ROTA}/${c.slug}`;
}

export function capituloPorSlug(slug: string): Capitulo | undefined {
  return CAPITULOS.find((c) => c.slug === slug);
}

export function eixoDoCapitulo(numero: number): Eixo | undefined {
  return EIXOS.find((e) => e.capitulos.some((c) => c.numero === numero));
}

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  publicado: "Publicado",
  parcial: "Cobertura parcial",
  em_preparacao: "Em preparação",
};
