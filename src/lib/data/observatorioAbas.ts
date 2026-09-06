/**
 * Catálogo público das abas do Observatório Brasileiro de Crédito.
 *
 * Fonte de verdade dos metadados por rota (title, description, dataset gold)
 * usados pelo route handler de /observatorio para tornar cada aba indexável
 * e compartilhável. As chaves `view` e `caminho` espelham os mapas ROUTES e
 * VIEW_TITLES da SPA (public/obs/app.js); o teste observatorio-publico
 * garante que os dois lados não divirjam.
 */

export type AbaObservatorio = {
  /** Chave interna da SPA (data-view). */
  view: string;
  /** Rota pública sob /observatorio, ex.: "/bets-financial-risk". */
  caminho: string;
  /** Título da aba — idêntico ao VIEW_TITLES da SPA. */
  titulo: string;
  /** Meta description e texto de compartilhamento (OG). */
  descricao: string;
  /** Arquivo da camada gold que alimenta a aba (gera JSON-LD Dataset). */
  gold?: string;
};

export const ABAS_OBSERVATORIO: AbaObservatorio[] = [
  {
    view: "mapa",
    caminho: "/map",
    titulo: "Mapa do Observatório",
    descricao:
      "Por onde começar: o ciclo do crédito do funding à cobrança em sete passos, a pergunta que cada página responde, trilhas por perfil, como ler os selos e as réguas, e as fontes com a data de cada uma.",
    gold: "meta.json",
  },
  {
    view: "overview",
    caminho: "/overview",
    titulo: "Visão geral",
    descricao:
      "O diagnóstico do mês do crédito brasileiro: a frase classificada pelo IBCC, o que mudou, projeções e a inadimplência nas instituições, com fonte e data-base em cada número.",
    gold: "overview.json",
  },
  {
    view: "panorama",
    caminho: "/credit-panorama",
    titulo: "Quem toma crédito e onde",
    descricao:
      "Onde está o crédito no Brasil: mapa por estado, faixa de renda, ocupação e produto, a partir dos agregados públicos do SCR, normalizado por habitante.",
    gold: "panorama.json",
  },
  {
    view: "estados",
    caminho: "/states",
    titulo: "Estados",
    descricao:
      "As 27 unidades da federação lado a lado: carteira e inadimplência, penetração do crédito, presença bancária, Pix, moradia, consignado, rural, emprego, consórcios e cobrança judicial, com uma página por UF.",
    gold: "ufs.json",
  },
  {
    view: "penetracao",
    caminho: "/credit-penetration",
    titulo: "Crédito por município",
    descricao:
      "Penetração do crédito por município e o gap frente ao potencial local, reconciliado com o SCR e com série histórica.",
    gold: "penetracao.json",
  },
  {
    view: "moradia",
    caminho: "/housing-credit",
    titulo: "Crédito imobiliário e moradia",
    descricao:
      "Crédito habitacional no Brasil: saldo, concessões e funding, e o que os dados públicos permitem — e não permitem — concluir sobre moradia.",
    gold: "moradia.json",
  },
  {
    view: "consignado",
    caminho: "/payroll-lending-aging",
    titulo: "Consignado e aposentados",
    descricao:
      "Crédito consignado e envelhecimento populacional: carteira, taxas e demografia municipal, com a magnitude das correlações declarada.",
    gold: "consignado.json",
  },
  {
    view: "pulse",
    caminho: "/credit",
    titulo: "Pulso do crédito",
    descricao:
      "Séries mensais do Banco Central: concessões, saldo, taxas e inadimplência por segmento, com filtros, marcos anotados e exportação com procedência.",
    gold: "pulse.json",
  },
  {
    view: "leading",
    caminho: "/leading-signals",
    titulo: "Sinais antecedentes",
    descricao:
      "Subíndices de estresse de crédito — endividamento das famílias, garantias, judicialização e crédito não bancário — com alertas que exigem persistência.",
    gold: "leading.json",
  },
  {
    view: "trends",
    caminho: "/search-trends",
    titulo: "Buscas no Google",
    descricao:
      "Termos de crédito e dívida no Google Trends como sinal complementar — nunca como evidência isolada.",
    gold: "trends.json",
  },
  {
    view: "sectors",
    caminho: "/sectors",
    titulo: "Risco setorial",
    descricao:
      "Score de estresse por atividade econômica a partir do volume real (PIM, PMS e PMC do IBGE), das condições de crédito e do emprego formal da seção CNAE; não é inadimplência setorial, que não existe nas fontes públicas.",
    gold: "sectors.json",
  },
  {
    view: "rj",
    caminho: "/recoveries",
    titulo: "Recuperações e falências",
    descricao:
      "Recuperações judiciais e falências ajuizadas mês a mês nos tribunais (CNJ/DataJud), com funil processual por movimentos e cobertura declarada; sem corte por porte, que a fonte não traz.",
    gold: "rj.json",
  },
  {
    view: "institutions",
    caminho: "/institutions",
    titulo: "Instituições",
    descricao:
      "Capital, inadimplência, rentabilidade e carteira dos conglomerados prudenciais e instituições independentes do IF.data, comparados dentro do próprio segmento (S1 a S5), com página própria por instituição.",
    gold: "institutions.json",
  },
  {
    view: "products",
    caminho: "/products",
    titulo: "Produtos de crédito",
    descricao:
      "Consignado, cartão, veículos e imobiliário: carteira e atraso específicos de cada produto de crédito, com página própria por produto.",
    gold: "products.json",
  },
  {
    view: "juros",
    caminho: "/interest-rates",
    titulo: "Juros por instituição",
    descricao:
      "Taxas de juros de novas operações por instituição financeira e modalidade, a partir das divulgações do Banco Central.",
    gold: "juros.json",
  },
  {
    view: "sfn",
    caminho: "/sfn-entries-exits",
    titulo: "Quem entra e quem sai do SFN",
    descricao:
      "Quem está autorizado a funcionar hoje, por segmento e UF, quem entrou e quem saiu trimestre a trimestre no IF.data, as conversões de tipo e os regimes de resolução decretados pelo Banco Central.",
    gold: "sfn.json",
  },
  {
    view: "compare",
    caminho: "/compare",
    titulo: "Comparar instituições",
    descricao:
      "Comparação lado a lado de instituições financeiras, com bloqueio automático de níveis de consolidação não comparáveis.",
    gold: "compare.json",
  },
  {
    view: "market",
    caminho: "/market",
    titulo: "Bancos na bolsa",
    descricao:
      "Preços, proventos e valuation dos bancos listados em bolsa, com a ponte do lucro reconstruída da DRE da CVM. Nada aqui é recomendação de investimento.",
    gold: "market.json",
  },
  {
    view: "ampliado",
    caminho: "/broad-credit",
    titulo: "Bancos e mercado de capitais",
    descricao:
      "Quanto do crédito a empresas e famílias vem dos bancos e quanto vem do mercado: saldo ampliado do BCB, ofertas públicas registradas na CVM e o lastro de CRI e CRA.",
    gold: "ampliado.json",
  },
  {
    view: "rural",
    caminho: "/rural-credit",
    titulo: "Crédito rural",
    descricao:
      "Crédito rural no Brasil pela Matriz de Dados do BCB (Sicor): contratação por safra, programa, fonte de recursos, faixa de valor, gênero, instituição, produto e município.",
    gold: "rural.json",
  },
  {
    view: "bndes",
    caminho: "/directed-credit-bndes",
    titulo: "Crédito direcionado e BNDES",
    descricao:
      "Quanto do crédito do SFN tem taxa regulada ou funding público, e o que o Sistema BNDES desembolsa por porte, setor, UF, produto e agente, com as operações não automáticas contrato a contrato.",
    gold: "bndes.json",
  },
  {
    view: "pix",
    caminho: "/pix",
    titulo: "Pix e pagamentos",
    descricao:
      "A evolução do Pix desde o lançamento, comparada a cartões, TED e boleto: natureza dos fluxos, geografia municipal e o Mecanismo Especial de Devolução.",
    gold: "pix.json",
  },
  {
    view: "openfinance",
    caminho: "/open-finance",
    titulo: "Open Finance",
    descricao:
      "O Open Finance brasileiro em números: consentimentos, participantes e evolução do compartilhamento de dados.",
    gold: "openfinance.json",
  },
  {
    view: "conduta",
    caminho: "/conduct-enforcement",
    titulo: "Sanções e reclamações",
    descricao:
      "Processos administrativos sancionadores do Banco Central e da CVM, penalidades, multas, inabilitações e recursos, mais o índice de reclamações, lidos como fluxo do sistema, sem ranking por instituição.",
    gold: "conduta.json",
  },
  {
    view: "emprego",
    caminho: "/formal-employment",
    titulo: "Emprego formal",
    descricao:
      "Estoque de vínculos formais por seção CNAE e saldo de admissões e desligamentos por UF (Novo Caged), lidos contra a própria história: o componente de capacidade financeira do Risco setorial.",
    gold: "emprego.json",
  },
  {
    view: "funding",
    caminho: "/funding",
    titulo: "Captação dos bancos",
    descricao:
      "De onde vem o dinheiro que os bancos emprestam: o que o público tem aplicado (SGS), como cada instituição se financia entre varejo, mercado e repasses (IF.data) e quem, nos fundos, carrega o papel de cada banco (CVM).",
    gold: "funding.json",
  },
  {
    view: "consorcios",
    caminho: "/consortia",
    titulo: "Consórcios",
    descricao:
      "O crédito adjacente de veículos e imóveis: cotas ativas, carteira, contemplações, exclusões, custo do produto novo e o mapa por UF, do Panorama de Consórcios do Banco Central.",
    gold: "consorcios.json",
  },
  {
    view: "cobranca",
    caminho: "/debt-collection-lawsuits",
    titulo: "Bancos cobrando na Justiça",
    descricao:
      "Execuções de título, busca e apreensão em alienação fiduciária, monitórias e execuções hipotecárias ajuizadas mês a mês nos tribunais estaduais (DataJud), no recorte bancário e com qualquer credor, por classe e UF.",
    gold: "cobranca.json",
  },
  {
    view: "bets",
    caminho: "/bets-financial-risk",
    titulo: "Apostas e crédito das famílias",
    descricao:
      "Apostas online e saúde financeira: GGR, apostadores, autoexclusão e fluxo Pix, com hierarquia de evidências A–E, fontes primárias e sem correlação forçada.",
    gold: "bets.json",
  },
  {
    view: "fraudes",
    caminho: "/financial-fraud",
    titulo: "Golpes e fraudes",
    descricao:
      "Golpes e fraudes financeiras no Brasil: perdas reportadas, devoluções via Pix/MED e tipologias — separando dado administrativo de estimativa privada.",
    gold: "fraudes.json",
  },
  {
    view: "operacional",
    caminho: "/operational-indicators",
    titulo: "Rede, pessoas e auditoria",
    descricao:
      "Gente, rede física e auditoria dos bancos brasileiros: empregados declarados no FRE, agências e municípios atendidos (ESTBAN) e auditor vigente — só fontes estruturadas oficiais.",
    gold: "operacional.json",
  },
  {
    view: "judicial",
    caminho: "/lawsuits",
    titulo: "Clientes contra bancos na Justiça",
    descricao:
      "A litigiosidade bancária no CNJ/DataJud: processos cíveis e trabalhistas em temas financeiros, por tribunal e por instituição.",
    gold: "judicial.json",
  },
  {
    view: "pgfn",
    caminho: "/federal-tax-debt",
    titulo: "Dívida com a União",
    descricao:
      "Estoque, perfil dos devedores e recuperação da Dívida com a União, a partir dos dados abertos da PGFN.",
    gold: "pgfn.json",
  },
  {
    view: "desenrola",
    caminho: "/desenrola",
    titulo: "Desenrola Brasil",
    descricao:
      "O programa Desenrola Brasil: alcance, descontos e resultados — até onde os dados públicos permitem medir.",
    gold: "desenrola.json",
  },
  {
    view: "scenarios",
    caminho: "/scenarios",
    titulo: "Cenários",
    descricao:
      "Trajetórias simuladas para o crédito com premissas explícitas — exercícios analíticos, não previsões nem recomendações.",
    gold: "scenario.json",
  },
  {
    view: "alerts",
    caminho: "/alerts",
    titulo: "Central de alertas",
    descricao:
      "A central de alertas do crédito brasileiro: sinais de quatro famílias de monitoramento (macro, carteira, antecedentes e operacional), cada uma com seu universo, regras de persistência e feed RSS público.",
    gold: "alertas_central.json",
  },
  {
    view: "regulacao",
    caminho: "/regulacao",
    titulo: "Marcos regulatórios",
    descricao:
      "A linha do tempo regulatória transversal do mercado de crédito: os marcos (leis e resoluções CMN/BCB) que explicam quebras visíveis nas séries, cada um com o texto oficial e os painéis que afeta.",
    gold: "regulacao.json",
  },
  {
    view: "research",
    caminho: "/research",
    titulo: "Perguntas rápidas",
    descricao:
      "Consultas determinísticas sobre os dados carregados, prontas para relatório ou aula: perguntas fixas, respostas com fonte e data, sem estimativa.",
  },
  {
    view: "method",
    caminho: "/methodology",
    titulo: "Metodologia e fontes",
    descricao:
      "As fontes oficiais, os conceitos, as fórmulas e os limites de cada indicador — a metodologia completa e aberta do Observatório.",
    gold: "method.json",
  },
  {
    view: "sugestoes",
    caminho: "/suggestions",
    titulo: "Sugestões",
    descricao: "Canal aberto de sugestões e correções do Observatório Brasileiro de Crédito.",
  },
  {
    view: "sobre",
    caminho: "/about",
    titulo: "Sobre o Observatório",
    descricao:
      "O que é o Observatório Brasileiro de Crédito, quem o mantém, a licença dos dados e como citar.",
  },
];

/** Rotas dinâmicas (prefixo → como titular a página). */
export const PREFIXOS_DINAMICOS = [
  { prefixo: "/institutions/", view: "inst", rotulo: "Instituições financeiras" },
  { prefixo: "/products/", view: "product", rotulo: "Produtos de crédito" },
  { prefixo: "/sectors/", view: "sector", rotulo: "Risco setorial" },
  { prefixo: "/presenca/", view: "presmun", rotulo: "Presença bancária municipal" },
  { prefixo: "/states/", view: "estado", rotulo: "Estados" },
] as const;

/** Rota aposentada que continua respondendo (espelha ROTAS_APOSENTADAS da SPA). */
export const ROTAS_APOSENTADAS: Record<string, string> = {
  "/leading-indicators": "/leading-signals",
};

const porCaminho = new Map(ABAS_OBSERVATORIO.map((a) => [a.caminho, a]));

export function abaPorCaminho(caminho: string): AbaObservatorio | null {
  const alvo = ROTAS_APOSENTADAS[caminho] ?? caminho;
  return porCaminho.get(alvo) ?? null;
}
