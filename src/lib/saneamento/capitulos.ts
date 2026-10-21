/**
 * Arquitetura do Observatório Brasileiro do Saneamento: cinco eixos, quinze
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
  /**
   * Subpainéis, com rota `${slug do capítulo}/${slug do subpainel}`: os cinco do capítulo 5 (navegação própria na página)
   * e o 7.1, dívida e alavancagem (`naNavegacao`: aparece também no menu do eixo, logo abaixo do capítulo).
   */
  subpaineis?: { slug: string; numero: string; rotulo: string; pergunta: string; situacao: Situacao; pendencia?: string; naNavegacao?: boolean }[];
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
          "Paralisações e racionamento declarados ao SINISA 2024; qualidade da água no SISAGUA, com controle do prestador, vigilância da saúde, plano de amostragem e população sob formas com controle, de 2014 a 2025.",
        situacao: "parcial",
        pendencia:
          "SISAGUA integrado para E. coli, coliformes totais, cloro residual livre, turbidez, cor e fluoreto, plano de amostragem de SAA e SAC desde 2023 e população cadastrada. Substâncias químicas, radioatividade e cianotoxinas na água tratada integradas em 2024 e 2025. Ainda não integrados: série das substâncias químicas antes de 2024 e plano de amostragem até 2022 (só JSON até 2021; cálculo de 2022 não comparável). pH não tem limite na rede pela Portaria 888.",
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
    rotulo: "Tarifa e conta das famílias",
    curto: "Tarifa",
    resumo: "Quanto se paga, por que o valor foi autorizado, o que ele financia, quem assume os riscos e se a conta cabe no orçamento.",
    capitulos: [
      {
        numero: 5,
        slug: "preco-regulado",
        rotulo: "Tarifa",
        pergunta: "Tarifa: o que pagamos, por que foi autorizada e o que ela financia?",
        resumo: "Simulador com regras verificadas, formação da tarifa pelo regulador, reajustes, contrapartidas e riscos.",
        situacao: "parcial",
        pendencia: "Amostra de prestadores e decisões tarifárias limitada aos atos verificados; cada subpainel declara o tamanho da amostra.",
        subpaineis: [
          { slug: "simulador", numero: "5.1", rotulo: "Quanto pagaríamos", pergunta: "Quanto pagaríamos pelo mesmo consumo?", situacao: "parcial" },
          { slug: "formacao", numero: "5.2", rotulo: "Como o regulador chega ao valor", pergunta: "Como o regulador chega ao valor da tarifa?", situacao: "parcial" },
          { slug: "reajustes", numero: "5.3", rotulo: "Por que a conta aumentou", pergunta: "Por que a conta aumentou?", situacao: "parcial" },
          { slug: "contrapartidas", numero: "5.4", rotulo: "Tarifa e serviço", pergunta: "A tarifa autorizada está associada a melhor serviço?", situacao: "parcial" },
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
        resumo: "Cadastro de prestadores declarados ao SINISA, com natureza jurídica, abrangência, municípios, instrumento de delegação e vigência, e a posição acionária das companhias abertas.",
        situacao: "parcial",
        pendencia:
          "Controle societário só das 17 companhias abertas com Formulário de Referência na CVM. Empresas fechadas, SPEs sem registro, autarquias e serviços municipais não têm esse dado; para eles o painel mostra a natureza jurídica declarada em 2024.",
        subpaineis: [
          {
            slug: "divida",
            numero: "7.1",
            rotulo: "Dívida e alavancagem",
            pergunta: "Quanto devem as empresas de água e esgoto?",
            situacao: "parcial",
            pendencia:
              "Só as companhias com demonstrações financeiras na CVM (DFP e ITR). Prazo médio (duration), custo, indexadores e limites contratuais da dívida estão só nas notas explicativas, sem base estruturada, e não são estimados.",
            naNavegacao: true,
          },
        ],
      },
      {
        numero: 8,
        slug: "prestadores/comparar",
        rotulo: "Como se comparam",
        pergunta: "Como os prestadores se comparam em serviço, operação e finanças?",
        resumo:
          "Até quatro prestadores lado a lado: perdas, consumo, receita e despesa por metro cúbico, investimento e demonstrações declaradas; os valores financeiros são autodeclarados ao SINISA, sem conferência com demonstrações financeiras auditadas.",
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
        resumo:
          "Investimento de 2024 declarado pelos prestadores por município, em água e esgoto, expansão e reposição, ao lado da carência medida pelo Censo; autodeclarado ao SINISA, sem conferência com demonstrações financeiras auditadas.",
        situacao: "parcial",
        pendencia: "Obras identificadas (cronograma, avanço físico e entrada em operação) dependem de bases de execução ainda não integradas.",
      },
      {
        numero: 10,
        slug: "financiamento",
        rotulo: "De onde vem o dinheiro",
        pergunta: "De onde vem o dinheiro e quem suporta o custo?",
        resumo:
          "Origem dos recursos (próprios, onerosos e não onerosos) do investimento que os prestadores declararam ao SINISA 2024, o próprio e o do governo estadual; autodeclarado, sem conferência com demonstrações financeiras auditadas.",
        situacao: "parcial",
        pendencia: "Contratações e desembolsos do BNDES, CAIXA e Transferegov ainda não conciliados com o SINISA; sem conciliação não se somam.",
      },
      {
        numero: 11,
        slug: "planejamento",
        rotulo: "Metas e planos",
        pergunta: "O planejamento é suficiente para a universalização?",
        resumo: "Metas do art. 11-B, indicadores da NR ANA 8/2024, situação observada, ritmo aritmético e planos municipais declarados.",
        situacao: "parcial",
        pendencia: "Os indicadores da NR ANA 8/2024 são aproximações sem ICA, ICE e soluções alternativas; nenhum município é declarado em cumprimento de meta.",
      },
      {
        numero: 15,
        slug: "contratado",
        rotulo: "O que está contratado",
        pergunta: "O que já está contratado para universalizar até 2033?",
        resumo:
          "Leilões de concessão e PPP desde o novo marco legal, com vencedor, outorga, investimento previsto e prazo; metas contratuais ano a ano transcritas dos contratos; posição 2024 das áreas concedidas; cenário didático para 2033 e as estimativas do custo da universalização lado a lado.",
        situacao: "parcial",
        pendencia:
          "Tabela curada à mão, com grau de verificação por linha; metas transcritas só dos contratos com anexo público localizado; aferição oficial de cumprimento (NR ANA 8/2024, art. 31) suspensa em 2026. Totais só somam contratos de serviço adjudicados e conferidos na fonte.",
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
        resumo: "Internações e óbitos por infecções intestinais, leptospirose e esquistossomose, por município de residência, ao lado da carência de esgoto.",
        situacao: "parcial",
        pendencia:
          "Só três grupos de doenças, na janela de 2022 a 2024, sem taxa ajustada por idade e sem o recorte por faixa etária. Qualidade da água bruta (ANA e órgãos estaduais), dengue e demais doenças de vetor e hepatite A não integradas.",
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
  { slug: "internacional", rotulo: "Brasil no mundo", descricao: "Água e esgotamento no Brasil e em outros países pelo JMP da OMS e do UNICEF, outros indicadores dos ODS e por que os números diferem do Censo e do SINISA." },
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
