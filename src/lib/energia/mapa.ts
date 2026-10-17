/**
 * Página inicial do Observatório do Setor Elétrico: a porta de entrada (seção 6 da
 * especificação, painéis P001 e P003). Este arquivo é o conteúdo editorial da inicial:
 *
 *  - os cinco caminhos de intenção do alto da página (o quinto leva ao mapa) e as seis perguntas prioritárias, mais as duas de
 *    acesso e desigualdade (a medida de cada uma vem de home-sinais.ts, nunca daqui);
 *  - o mapa conceitual (sete elos em quatro faixas, ligações tipificadas e temas transversais);
 *  - o cartão de cada destino (para que serve, o que se encontra, recorte), que abre dentro do
 *    próprio item do índice completo;
 *  - as perguntas do dia a dia (as nove da especificação) e as trilhas por interesse;
 *  - as fontes principais de cada tema, pelo id do conjunto em publicacao.json.
 *
 * Nada aqui é número: a inicial mostra números só quando os lê de uma gold com a
 * proveniência dela. Toda promessa aponta para uma rota e uma âncora que o teste
 * `energia-mapa.test.ts` confere no código da página de destino.
 *
 * Idioma: os textos são getters com tx(), lidos no idioma da página no momento do uso; o português não muda. Ninguém deve copiar
 * estes objetos com spread no topo de um módulo (o idioma ficaria congelado no da primeira leitura).
 */
import { tx } from "@/lib/energia/idioma";

/** Lista de frases que segue o idioma da página: cada posição é lida na hora (map, join e índice funcionam como numa lista comum). */
function frasesNoIdioma(frases: (() => string)[]): string[] {
  const lista: string[] = [];
  frases.forEach((f, i) => Object.defineProperty(lista, i, { get: f, enumerable: true, configurable: false }));
  return lista;
}

// ---------------------------------------------------------------------------
// Alto da página: quatro caminhos de intenção e seis perguntas prioritárias
// ---------------------------------------------------------------------------

export type IdCaminho = "acompanhar" | "regiao" | "sistema" | "aprender" | "conferir";

export type CaminhoIntencao = {
  id: IdCaminho;
  /** Verbo e objeto: o que a pessoa quer fazer, não o nome da página. */
  titulo: string;
  /** Uma frase sobre o que a página de destino entrega. */
  descricao: string;
  /** Slugs de DESTINOS_NAVEGACAO: o primeiro é o link do título; os demais viram links de apoio. Vazio quando o caminho é uma seção desta própria página. */
  slugs: string[];
  /** Âncora desta página para onde o título leva, quando o caminho não é outra página (o mapa de como o sistema se liga). */
  ancora?: string;
};

/**
 * Os cinco caminhos do hero: acompanhar o sistema, explorar uma região, entender como o sistema se liga (o mapa, nesta página), aprender e
 * conferir ou baixar. O mapa é o atalho de quem quer o caminho da geração ao consumo sem rolar pelas seis perguntas.
 */
export const CAMINHOS_INTENCAO: CaminhoIntencao[] = [
  { id: "acompanhar", get titulo() { return tx("Acompanhar o sistema", "Follow the system"); }, get descricao() { return tx("Preço, água, geração, carga e rede, cada um com a sua data.", "Price, water, generation, load and grid, each with its own date."); }, slugs: ["visao-geral"] },
  { id: "regiao", get titulo() { return tx("Explorar uma região", "Explore a region"); }, get descricao() { return tx("Submercado, distribuidora, município e usinas no mesmo mapa, cada número no seu grão.", "Submarket, distribution utility, municipality and plants on the same map, each number at its own level of detail."); }, slugs: ["territorio"] },
  { id: "sistema", get titulo() { return tx("Entender como o sistema se liga", "Understand how the system fits together"); }, get descricao() { return tx("Sete elos, da água à vida das pessoas, no mapa interativo desta página.", "Seven links, from water to people's lives, in the interactive map on this page."); }, slugs: [], ancora: "#mapa-conceitual" },
  { id: "aprender", get titulo() { return tx("Aprender um conceito", "Learn a concept"); }, get descricao() { return tx("Verbetes com a definição da fonte oficial e o painel onde cada conceito aparece.", "Entries with the definition from the official source and the panel where each concept appears."); }, slugs: ["aprenda"] },
  { id: "conferir", get titulo() { return tx("Conferir ou baixar os dados", "Check or download the data"); }, get descricao() { return tx("A fonte, o arquivo e o cálculo de cada número, e os conjuntos para baixar.", "The source, the file and the calculation behind each number, and the datasets to download."); }, slugs: ["dados", "metodologia"] }, // i18n: dado
];

/** Os seis sinais da inicial, na ordem da página: o que chega a quem usa a energia, depois o sistema e o que vem. */
export const ID_SINAIS = ["conta", "qualidade", "perdas", "agua", "pld", "expansao"] as const;
export type IdSinal = (typeof ID_SINAIS)[number];

export type PerguntaPrioritaria = {
  id: IdSinal;
  pergunta: string;
  /** Para que serve a medida, em uma frase: o porquê de olhar para ela, sem número e sem juízo. */
  importa: string;
  /** Slug do destino em DESTINOS_NAVEGACAO (de onde saem o estado e o conceito da pergunta). */
  slug: string;
  /** Painel que aprofunda a medida: o que se faz lá e o endereço, com a âncora do painel. */
  link: { rotulo: string; href: string };
  /**
   * A pergunta tem resposta própria por distribuidora (Conta de luz, Qualidade e Perdas): a escolha é uma só, no alto da seção, e o link do
   * cartão leva a página com ela já selecionada. `rotuloEscolhida` é o texto do link com a escolha feita, com `{sigla}` no lugar da sigla.
   */
  porDistribuidora?: { tema: "conta" | "qualidade" | "perdas"; parametro: "d" | "dist"; rotuloEscolhida: string };
};

export const PERGUNTAS_PRIORITARIAS: PerguntaPrioritaria[] = [
  {
    id: "conta",
    get pergunta() { return tx("Quanto custa a energia numa residência?", "How much does electricity cost for a household?"); },
    get importa() { return tx("Para comparar a tarifa que a ANEEL fixa para cada distribuidora, antes de tributos.", "To compare the tariff that ANEEL sets for each distribution utility, before taxes."); },
    slug: "conta-de-luz",
    link: { get rotulo() { return tx("Comparar as tarifas das distribuidoras", "Compare the tariffs of the distribution utilities"); }, href: "/setor-eletrico/conta-de-luz#tarifa" },
    porDistribuidora: { tema: "conta", parametro: "dist", get rotuloEscolhida() { return tx("Ver a tarifa de {sigla} em Conta de luz", "See the tariff of {sigla} in Electricity bill"); } },
  },
  {
    id: "qualidade",
    get pergunta() { return tx("Quanto tempo falta energia?", "How long does the power go out?"); },
    get importa() { return tx("Para saber quanto tempo, no ano, a unidade consumidora média ficou sem energia.", "To know how long, over the year, the average consumer unit went without power."); },
    slug: "qualidade",
    link: { get rotulo() { return tx("Ver a duração e a frequência das interrupções", "See the duration and frequency of interruptions"); }, href: "/setor-eletrico/qualidade#p051" },
    porDistribuidora: { tema: "qualidade", parametro: "dist", get rotuloEscolhida() { return tx("Ver as interrupções de {sigla} em Qualidade", "See the interruptions of {sigla} in Quality of supply"); } },
  },
  {
    id: "perdas",
    get pergunta() { return tx("Quanta energia se perde na distribuição?", "How much energy is lost in distribution?"); },
    get importa() { return tx("Para ver quanta da energia que entra na rede da distribuidora não chega ao consumidor.", "To see how much of the energy that enters the distribution utility's grid does not reach the consumer."); },
    slug: "perdas",
    link: { get rotulo() { return tx("Ver as perdas no mapa das distribuidoras", "See the losses on the map of distribution utilities"); }, href: "/setor-eletrico/perdas#painel-mapa" },
    porDistribuidora: { tema: "perdas", parametro: "d", get rotuloEscolhida() { return tx("Ver as perdas de {sigla} em Perdas", "See the losses of {sigla} in Losses"); } },
  },
  {
    id: "agua",
    get pergunta() { return tx("Quanta energia está armazenada nos reservatórios?", "How much energy is stored in the reservoirs?"); },
    get importa() { return tx("Para ver quanta água há guardada, em energia, para as hidrelétricas gerarem.", "To see how much water is stored, in energy terms, for the hydropower plants to generate."); },
    slug: "agua-e-clima",
    link: { get rotulo() { return tx("Comparar cada região com a mediana do dia", "Compare each region with the median for the day"); }, href: "/setor-eletrico/agua-e-clima#p017" },
  },
  {
    id: "pld",
    get pergunta() { return tx("Quanto custa a energia no curto prazo?", "How much does energy cost in the short term?"); },
    get importa() { return tx("Para ver o preço do dia no mercado em que se liquidam as diferenças de energia.", "To see the day's price in the market where energy differences are settled."); },
    slug: "pld",
    link: { get rotulo() { return tx("Ver o último dia nos quatro submercados", "See the latest day in the four submarkets"); }, href: "/setor-eletrico/pld#hoje" },
  },
  {
    id: "expansao",
    get pergunta() { return tx("O que está sendo construído?", "What is being built?"); },
    get importa() { return tx("Para ver as usinas em obra e a potência que a ANEEL autorizou para elas.", "To see the plants under construction and the capacity that ANEEL authorized for them."); },
    slug: "expansao",
    link: { get rotulo() { return tx("Ver a carteira por estágio", "See the portfolio by stage"); }, href: "/setor-eletrico/expansao/carteira#p040" },
  },
];

/** Os dois números de acesso e desigualdade, que a inicial mostra abaixo das seis perguntas em vez de só apontar para a página de Inclusão. */
export const ID_SINAIS_INCLUSAO = ["tarifa-social", "acesso"] as const;
export type IdSinalInclusao = (typeof ID_SINAIS_INCLUSAO)[number];

export type PerguntaDeInclusao = {
  id: IdSinalInclusao;
  pergunta: string;
  importa: string;
  link: { rotulo: string; href: string };
};

export const PERGUNTAS_DE_INCLUSAO: PerguntaDeInclusao[] = [
  {
    id: "tarifa-social",
    get pergunta() { return tx("Quantas unidades consumidoras têm desconto na conta?", "How many consumer units get a discount on the bill?"); },
    get importa() { return tx("Para ver o alcance da Tarifa Social, o desconto para famílias de baixa renda.", "To see the reach of the Tarifa Social, the discount for low-income families."); },
    link: { get rotulo() { return tx("Ver a Tarifa Social por distribuidora e estado", "See the Tarifa Social by distribution utility and state"); }, href: "/setor-eletrico/inclusao-energetica/tarifa-social#p059" },
  },
  {
    id: "acesso",
    get pergunta() { return tx("Quantos domicílios ainda estão sem energia elétrica?", "How many households still have no electricity?"); },
    get importa() { return tx("Para ver quem ainda não tem acesso à rede ou a outra fonte de energia em casa.", "To see who still has no access to the grid or to another source of energy at home."); },
    link: { get rotulo() { return tx("Ver o acesso à energia por região e situação", "See access to energy by region and situation"); }, href: "/setor-eletrico/inclusao-energetica/acesso#p062" },
  },
];

// ---------------------------------------------------------------------------
// Título (pergunta) de cada página de módulo, igual ao título da própria página
// ---------------------------------------------------------------------------

export type EstadoPagina = "integrado" | "integracao" | "referencia";

export type PaginaMapa = {
  rotulo: string;
  href: string;
  /** A pergunta que a página responde, igual ao título da página de destino. */
  pergunta: string;
  estado: EstadoPagina;
};

export const PAGINAS_MAPA = {
  "visao-geral": { get rotulo() { return tx("Visão geral", "Overview"); }, href: "/setor-eletrico/visao-geral", get pergunta() { return tx("O que está acontecendo no sistema elétrico brasileiro?", "What is happening in the Brazilian power system?"); }, estado: "integrado" },
  "agua-e-clima": { get rotulo() { return tx("Água e clima", "Water and climate"); }, href: "/setor-eletrico/agua-e-clima", get pergunta() { return tx("Quanta energia está armazenada?", "How much energy is stored?"); }, estado: "integrado" },
  carga: { get rotulo() { return tx("Carga", "Load"); }, href: "/setor-eletrico/carga", get pergunta() { return tx("Quanto o sistema está consumindo?", "How much is the system consuming?"); }, estado: "integrado" },
  rede: { get rotulo() { return tx("Rede", "Grid"); }, href: "/setor-eletrico/rede", get pergunta() { return tx("Como a energia circula entre regiões?", "How does energy flow between regions?"); }, estado: "integrado" },
  pld: { rotulo: "PLD", href: "/setor-eletrico/pld", get pergunta() { return tx("Quanto custa a energia no curto prazo?", "How much does energy cost in the short term?"); }, estado: "integrado" },
  mercado: { get rotulo() { return tx("Mercado", "Market"); }, href: "/setor-eletrico/mercado", get pergunta() { return tx("Como a energia é contratada, alocada e liquidada?", "How is energy contracted, allocated and settled?"); }, estado: "integrado" },
  leiloes: { get rotulo() { return tx("Leilões", "Auctions"); }, href: "/setor-eletrico/leiloes", get pergunta() { return tx("O que os leilões contrataram, a que preço e de quem?", "What did the auctions contract, at what price and from whom?"); }, estado: "integrado" },
  empresas: { get rotulo() { return tx("Empresas", "Companies"); }, href: "/setor-eletrico/empresas", get pergunta() { return tx("Quem atua no setor elétrico?", "Who operates in the power sector?"); }, estado: "integrado" },
  expansao: { get rotulo() { return tx("Expansão", "Expansion"); }, href: "/setor-eletrico/expansao", get pergunta() { return tx("O que está sendo construído?", "What is being built?"); }, estado: "integrado" },
  regulacao: { get rotulo() { return tx("Regulação", "Regulation"); }, href: "/setor-eletrico/regulacao", get pergunta() { return tx("Que regra vale em cada período?", "Which rule applies in each period?"); }, estado: "integrado" },
  "conta-de-luz": { get rotulo() { return tx("Conta de luz", "Electricity bill"); }, href: "/setor-eletrico/conta-de-luz", get pergunta() { return tx("Quanto custa o mesmo consumo?", "How much does the same consumption cost?"); }, estado: "integrado" },
  perdas: { get rotulo() { return tx("Perdas", "Losses"); }, href: "/setor-eletrico/perdas", get pergunta() { return tx("Onde a energia se perde?", "Where is energy lost?"); }, estado: "integrado" },
  qualidade: { get rotulo() { return tx("Qualidade", "Quality of supply"); }, href: "/setor-eletrico/qualidade", get pergunta() { return tx("Quanto tempo e quantas vezes falta luz?", "How long and how often does the power go out?"); }, estado: "integrado" },
  "inclusao-energetica": { get rotulo() { return tx("Inclusão energética", "Energy inclusion"); }, href: "/setor-eletrico/inclusao-energetica", get pergunta() { return tx("Para quem a energia pesa mais?", "For whom does energy weigh the most?"); }, estado: "integrado" },
  transicao: { get rotulo() { return tx("Transição e ambiente", "Transition and environment"); }, href: "/setor-eletrico/transicao", get pergunta() { return tx("Como a matriz está mudando?", "How is the energy mix changing?"); }, estado: "integrado" },
  aprenda: { get rotulo() { return tx("Aprenda", "Learn"); }, href: "/setor-eletrico/aprenda", get pergunta() { return tx("O que cada conceito significa e onde aparece?", "What does each concept mean and where does it appear?"); }, estado: "referencia" },
  dados: { get rotulo() { return tx("Dados e catálogo", "Data and catalog"); }, href: "/setor-eletrico/dados", get pergunta() { return tx("O que é público sobre o setor elétrico, e o que já está integrado?", "What is public about the power sector, and what is already integrated?"); }, estado: "referencia" },
  metodologia: { get rotulo() { return tx("Metodologia", "Methodology"); }, href: "/setor-eletrico/metodologia", get pergunta() { return tx("Como os números são produzidos, e o que eles não dizem?", "How are the numbers produced, and what do they not say?"); }, estado: "referencia" },
} satisfies Record<string, PaginaMapa>;

export type IdPagina = keyof typeof PAGINAS_MAPA;

// ---------------------------------------------------------------------------
// Seção B: mapa conceitual
// ---------------------------------------------------------------------------

/** Tipo de ligação entre dois elos (seção 6.2 B). Cada tipo muda a forma da linha (traço e espessura) e a da ponta; a cor nunca é o único sinal. */
export type TipoLigacao = "fisico" | "operacao" | "mercado" | "custo" | "associacao";

/** Forma da ponta da ligação: seta cheia, seta aberta, losango, quadrado ou círculo nas duas pontas (a associação não tem sentido). */
export type PontaLigacao = "seta" | "seta-aberta" | "losango" | "quadrado" | "circulo";

export const TIPOS_LIGACAO: Record<TipoLigacao, { rotulo: string; definicao: string; traco: string; espessura: number; ponta: PontaLigacao }> = {
  fisico: { get rotulo() { return tx("Fluxo físico", "Physical flow"); }, get definicao() { return tx("a energia, a água ou o combustível passa de um elo ao outro.", "energy, water or fuel passes from one link to the other."); }, traco: "", espessura: 3.2, ponta: "seta" },
  operacao: { get rotulo() { return tx("Decisão de operação", "Operating decision"); }, get definicao() { return tx("o ONS usa a informação para programar e despachar o sistema.", "ONS uses the information to schedule and dispatch the system."); }, traco: "10 6", espessura: 2, ponta: "seta-aberta" },
  mercado: { get rotulo() { return tx("Regra de mercado", "Market rule"); }, get definicao() { return tx("uma regra de comercialização transforma uma grandeza em valor a liquidar.", "a trading rule turns a quantity into an amount to be settled."); }, traco: "12 4 2 4", espessura: 2, ponta: "losango" },
  custo: { get rotulo() { return tx("Componente de custo", "Cost component"); }, get definicao() { return tx("o custo de um elo vira parcela de uma tarifa ou de uma conta, por regra regulatória.", "the cost of one link becomes part of a tariff or a bill, under a regulatory rule."); }, traco: "1.5 4.5", espessura: 3, ponta: "quadrado" },
  associacao: { get rotulo() { return tx("Associação analítica", "Analytical association"); }, get definicao() { return tx("as grandezas costumam variar juntas; a associação não prova causa.", "the quantities tend to vary together; the association does not prove cause."); }, traco: "3 3", espessura: 1.6, ponta: "circulo" },
};

export type IdNo = "recursos" | "geracao" | "rede" | "consumo" | "operacao" | "contratos" | "pessoas";

/** As quatro faixas do mapa: o caminho físico da energia, quem coordena a operação, o caminho do dinheiro e o que chega às pessoas. */
export type FaixaMapa = "fisico" | "operacao" | "economia" | "pessoas";

export const ORDEM_FAIXAS: readonly FaixaMapa[] = ["fisico", "operacao", "economia", "pessoas"];

export const FAIXAS_MAPA: Record<FaixaMapa, { rotulo: string; resumo: string }> = {
  fisico: {
    get rotulo() { return tx("Caminho físico", "Physical path"); },
    get resumo() { return tx("A água, o vento, o sol e os combustíveis movem as usinas, e a rede leva a energia até o consumo.", "Water, wind, sun and fuels drive the plants, and the grid carries the energy to consumption."); },
  },
  operacao: {
    get rotulo() { return tx("Coordenação da operação", "Coordination of operation"); },
    get resumo() { return tx("O ONS programa quais usinas geram, e a CCEE calcula o preço das diferenças a partir do custo de operação.", "ONS schedules which plants generate, and CCEE calculates the price of differences from the operating cost."); },
  },
  economia: {
    get rotulo() { return tx("Relações econômicas", "Economic relationships"); },
    get resumo() { return tx("Contratos, liquidação e tarifa formam um caminho contratual, que não reproduz o trajeto físico da eletricidade.", "Contracts, settlement and tariffs form a contractual path that does not mirror the physical route of electricity."); },
  },
  pessoas: {
    get rotulo() { return tx("Experiência das pessoas", "People's experience"); },
    get resumo() { return tx("A conta de luz, o serviço que chega a cada casa e o acesso à energia.", "The electricity bill, the service that reaches each home and access to energy."); },
  },
};

/**
 * Onde o nome de cada faixa fica no diagrama, em unidades do viewBox 1000 × 680 (o mesmo dos elos abaixo): acima do caminho físico, ao
 * lado da operação (à esquerda do elo, onde nenhuma ligação passa) e abaixo dos dois últimos elos.
 */
export const ROTULOS_FAIXA: Record<FaixaMapa, { x: number; y: number; alinha: "esq" | "centro" }> = {
  fisico: { x: 27, y: 14, alinha: "esq" },
  operacao: { x: 27, y: 348, alinha: "esq" },
  economia: { x: 250, y: 652, alinha: "centro" },
  pessoas: { x: 750, y: 652, alinha: "centro" },
};

export type NoMapa = {
  id: IdNo;
  titulo: string;
  /** Faixa do mapa em que o elo está: o diagrama, o painel do elo e a versão em texto a usam. */
  faixa: FaixaMapa;
  /** Uma frase para o diagrama e para o leitor de tela. */
  curto: string;
  explicacao: string;
  /** Slugs de DESTINOS_NAVEGACAO onde o elo é explorado. */
  destinos: string[];
  conceitos: { slug: string; rotulo: string }[];
  /** Centro do cartão no diagrama, em unidades do viewBox 1000 × 680. */
  pos: { x: number; y: number };
};

export const NOS_MAPA: NoMapa[] = [
  {
    id: "recursos",
    faixa: "fisico",
    get titulo() { return tx("Água, vento, sol e clima", "Water, wind, sun and climate"); },
    get curto() { return tx("Os recursos que movem as usinas e o tempo que muda o consumo.", "The resources that drive the plants and the weather that changes consumption."); },
    get explicacao() {
      return tx(
        "A água que chega e fica guardada nos reservatórios, o vento, o sol e os combustíveis são a matéria-prima da geração. A chuva e a temperatura também mudam quanto se consome. O observatório mede a água em energia: a Energia Armazenada (EAR) e a Energia Natural Afluente (ENA). E mostra chuva e temperatura por bacia e por região.",
        "The water that flows in and is stored in reservoirs, the wind, the sun and fuels are the raw material of generation. Rain and temperature also change how much is consumed. The observatory measures water in energy terms: stored energy (EAR) and natural inflow energy (ENA). It also shows rainfall and temperature by basin and by region.",
      );
    },
    destinos: ["agua-e-clima"],
    conceitos: [
      { slug: "ear", rotulo: "EAR" },
      { slug: "ena", rotulo: "ENA" },
    ],
    pos: { x: 125, y: 130 },
  },
  {
    id: "geracao",
    faixa: "fisico",
    get titulo() { return tx("Geração", "Generation"); },
    get curto() { return tx("As usinas que transformam os recursos em eletricidade.", "The plants that turn resources into electricity."); },
    get explicacao() {
      return tx(
        "Dois grupos entram aqui: as usinas centralizadas (hidrelétricas, eólicas, solares e térmicas), cuja geração o ONS verifica hora a hora, e a micro e minigeração distribuída, instalada em casas e empresas e ligada à rede de distribuição, que a ANEEL cadastra e o ONS estima. O observatório mostra quanto cada fonte entregou, por que as térmicas foram acionadas, quanta energia eólica e solar deixou de ser gerada por restrição e como a geração mexe nas emissões.",
        "Two groups come in here: centralized plants (hydropower, wind, solar and thermal), whose generation ONS verifies hour by hour, and distributed micro and mini generation (MMGD), installed in homes and businesses and connected to the distribution grid, which ANEEL registers and ONS estimates. The observatory shows how much each source delivered, why thermal plants were dispatched, how much wind and solar energy was not generated because of restrictions, and how generation affects emissions.",
      );
    },
    destinos: ["geracao", "transicao"],
    conceitos: [
      { slug: "geracao-centralizada", get rotulo() { return tx("geração verificada", "verified generation"); } },
      { slug: "geracao-distribuida", rotulo: "MMGD" },
    ],
    pos: { x: 375, y: 130 },
  },
  {
    id: "rede",
    faixa: "fisico",
    get titulo() { return tx("Rede de transmissão e distribuição", "Transmission and distribution grid"); },
    get curto() { return tx("As linhas que levam a energia das usinas às regiões e às casas.", "The lines that carry energy from the plants to the regions and to homes."); },
    get explicacao() {
      return tx(
        "A transmissão liga as regiões e as grandes usinas; a distribuição leva a energia até cada consumidor. Parte da energia se perde no caminho, e a falha de um trecho interrompe o serviço. O observatório mostra os fluxos entre regiões, as restrições documentadas, as perdas e a qualidade do serviço de cada distribuidora.",
        "Transmission links the regions and the large plants; distribution carries the energy to each consumer. Part of the energy is lost along the way, and a failure in one stretch interrupts the service. The observatory shows the flows between regions, the documented restrictions, the losses and the quality of supply of each distribution utility.",
      );
    },
    destinos: ["rede", "perdas", "qualidade"],
    conceitos: [
      { slug: "intercambio", get rotulo() { return tx("intercâmbio", "interchange"); } },
      { slug: "perdas-de-energia", get rotulo() { return tx("perdas", "losses"); } },
    ],
    pos: { x: 625, y: 130 },
  },
  {
    id: "consumo",
    faixa: "fisico",
    get titulo() { return tx("Consumo (carga)", "Consumption (load)"); },
    get curto() { return tx("Quanto o sistema precisa atender, hora a hora.", "How much the system has to meet, hour by hour."); },
    get explicacao() {
      return tx(
        "A carga é a energia que o sistema interligado atende. Ela muda com a hora do dia, o dia da semana, os feriados e a temperatura. Segundo o ONS, a carga diária inclui, desde 29/04/2023, uma estimativa da micro e minigeração distribuída; na carga verificada (carga global), o ONS publica essa parcela à parte, e sem ela resta a carga líquida de MMGD. São leituras diferentes da carga, e a página de Carga as mostra separadas.",
        "Load is the energy that the interconnected system serves. It changes with the hour of the day, the day of the week, holidays and temperature. According to ONS, daily load has included, since April 29, 2023, an estimate of distributed micro and mini generation (MMGD); in verified load (global load), ONS publishes that portion separately, and without it what remains is load net of MMGD. These are different readings of load, and the Load page shows them separately.",
      );
    },
    destinos: ["carga"],
    conceitos: [
      { slug: "carga", get rotulo() { return tx("carga", "load"); } },
      { slug: "carga-liquida-de-mmgd", get rotulo() { return tx("carga líquida de MMGD", "load net of MMGD"); } },
    ],
    pos: { x: 875, y: 130 },
  },
  {
    id: "operacao",
    faixa: "operacao",
    get titulo() { return tx("Operação e preço de curto prazo", "Operation and spot price"); },
    get curto() { return tx("O ONS decide o despacho; a CCEE calcula o preço das diferenças.", "ONS decides the dispatch; CCEE calculates the price of differences."); },
    get explicacao() {
      return tx(
        "O ONS programa quais usinas geram, buscando atender a carga ao menor custo com segurança, e publica o custo marginal de operação (CMO). A CCEE calcula, a partir do CMO e dentro de limites fixados pela ANEEL, o preço de curto prazo (PLD) de cada hora e submercado. O observatório também registra previsões do PLD e como elas se saíram.",
        "ONS schedules which plants generate, seeking to meet the load at the lowest cost with security, and publishes the marginal operating cost (CMO). CCEE calculates, from the CMO and within limits set by ANEEL, the spot price (PLD) for each hour and submarket. The observatory also records PLD forecasts and how they performed.",
      );
    },
    destinos: ["pld", "pld-modelos"],
    conceitos: [
      { slug: "cmo", rotulo: "CMO" },
      { slug: "pld", rotulo: "PLD" },
    ],
    pos: { x: 500, y: 360 },
  },
  {
    id: "contratos",
    faixa: "economia",
    get titulo() { return tx("Contratos, mercado e tarifa", "Contracts, market and tariff"); },
    get curto() { return tx("Como a energia é contratada, liquidada e transformada em tarifa.", "How energy is contracted, settled and turned into a tariff."); },
    get explicacao() {
      return tx(
        "Grandes consumidores contratam energia no mercado livre; as distribuidoras compram para os seus clientes no mercado regulado, em leilões. As diferenças entre o contratado e o verificado são liquidadas na CCEE ao PLD. A tarifa do consumidor atendido pela distribuidora é homologada pela ANEEL e soma energia, transmissão, distribuição, perdas e encargos.",
        "Large consumers contract energy in the free market; distribution utilities buy for their customers in the regulated market, through auctions. Differences between what was contracted and what was verified are settled at CCEE at the PLD. The tariff of consumers served by the distribution utility is approved by ANEEL and adds up energy, transmission, distribution, losses and sector charges.",
      );
    },
    destinos: ["mercado", "leiloes", "conta-de-luz"],
    conceitos: [
      { slug: "mcp", rotulo: "MCP" },
      { slug: "tarifa-te-tusd", get rotulo() { return tx("TE e TUSD", "TE and TUSD"); } },
      { slug: "bandeira-tarifaria", get rotulo() { return tx("bandeira", "tariff flag"); } },
    ],
    pos: { x: 250, y: 590 },
  },
  {
    id: "pessoas",
    faixa: "pessoas",
    get titulo() { return tx("Vida das pessoas", "People's lives"); },
    get curto() { return tx("A conta, o serviço que chega e quem tem acesso.", "The bill, the service that arrives and who has access."); },
    get explicacao() {
      return tx(
        "Para quem usa a energia, o setor aparece na conta de luz, na frequência e na duração das faltas de energia, no peso da conta no orçamento e no acesso, que ainda falta em parte do país. O DEC e o FEC divulgados são os apurados: não incluem as interrupções que a regra exclui (emergência, dia crítico, origem externa e cortes pedidos pelo ONS), e o tempo total sem energia, somadas todas as origens, é maior. O observatório mostra a conta por distribuidora, a qualidade do serviço com as duas medidas, a Tarifa Social e o acesso à energia.",
        "For those who use energy, the sector shows up in the electricity bill, in how often and how long the power goes out, in the weight of the bill in the household budget and in access, which is still missing in part of the country. The published DEC and FEC are the computed values: they exclude the interruptions that the rule leaves out (emergency, critical day, external origin and cuts requested by ONS), and the total time without power, adding up all origins, is longer. The observatory shows the bill by distribution utility, quality of supply with both measures, the Tarifa Social and access to energy.",
      );
    },
    destinos: ["conta-de-luz", "qualidade", "inclusao-energetica"],
    conceitos: [
      { slug: "dec", rotulo: "DEC" },
      { slug: "tarifa-social", rotulo: "Tarifa Social" },
    ],
    pos: { x: 750, y: 590 },
  },
];

export type Ligacao = { de: IdNo; para: IdNo; tipo: TipoLigacao; texto: string };

export const LIGACOES: Ligacao[] = [
  { de: "recursos", para: "geracao", tipo: "fisico", get texto() { return tx("A água, o vento, o sol e os combustíveis movem as usinas.", "Water, wind, sun and fuels drive the plants."); } },
  {
    de: "geracao",
    para: "rede",
    tipo: "fisico",
    get texto() { return tx("A energia gerada entra na rede de transmissão ou na de distribuição; a micro e minigeração distribuída entra pela distribuição.", "The energy generated enters the transmission or the distribution grid; distributed micro and mini generation enters through distribution."); },
  },
  { de: "rede", para: "consumo", tipo: "fisico", get texto() { return tx("A rede entrega a energia ao consumo; parte se perde no caminho.", "The grid delivers the energy to consumption; part of it is lost along the way."); } },
  {
    de: "recursos",
    para: "operacao",
    tipo: "operacao",
    get texto() { return tx("Armazenamento e afluências entram como insumo nos modelos com que o ONS planeja a operação. Sozinhos, não determinam o preço.", "Storage and inflows are inputs to the models ONS uses to plan the operation. On their own, they do not determine the price."); },
  },
  { de: "consumo", para: "operacao", tipo: "operacao", get texto() { return tx("A carga prevista é insumo da programação da operação.", "The forecast load is an input to operation scheduling."); } },
  {
    de: "operacao",
    para: "geracao",
    tipo: "operacao",
    get texto() { return tx("O ONS decide quais usinas geram, considerando custo, segurança e os limites da rede.", "ONS decides which plants generate, considering cost, security and grid limits."); },
  },
  {
    de: "rede",
    para: "operacao",
    tipo: "operacao",
    get texto() { return tx("Os limites da transmissão restringem a operação. Uma diferença de preço entre submercados não prova, sozinha, congestionamento.", "Transmission limits constrain the operation. A price difference between submarkets does not prove, on its own, congestion."); },
  },
  {
    de: "operacao",
    para: "contratos",
    tipo: "mercado",
    get texto() { return tx("A CCEE liquida ao PLD as diferenças entre o contratado e o verificado. O PLD não é a tarifa do consumidor atendido pela distribuidora.", "CCEE settles at the PLD the differences between what was contracted and what was verified. The PLD is not the tariff of consumers served by the distribution utility."); },
  },
  {
    de: "contratos",
    para: "pessoas",
    tipo: "custo",
    get texto() { return tx("A tarifa homologada pela ANEEL (TE e TUSD), as bandeiras, os encargos e os tributos compõem a conta de luz.", "The tariff approved by ANEEL (TE and TUSD), tariff flags, sector charges and taxes make up the electricity bill."); },
  },
  {
    de: "rede",
    para: "pessoas",
    tipo: "custo",
    get texto() { return tx("Transmissão, distribuição e as perdas reconhecidas pela regulação são parcelas da tarifa; a qualidade do serviço chega a cada casa pela distribuição.", "Transmission, distribution and the losses recognized by regulation are parts of the tariff; quality of supply reaches each home through distribution."); },
  },
  {
    de: "recursos",
    para: "consumo",
    tipo: "associacao",
    get texto() { return tx("Temperatura e calendário costumam acompanhar o consumo; o observatório mede a associação sem afirmar causa.", "Temperature and the calendar tend to move with consumption; the observatory measures the association without claiming cause."); },
  },
];

/** O que o mapa NÃO afirma (seção 6.2 B): aparece junto do diagrama e da versão em texto. */
export const O_QUE_O_MAPA_NAO_DIZ: string[] = frasesNoIdioma([
  () =>
    tx(
      "Chuva não determina diretamente a conta de luz: entre uma e outra há operação, regras de mercado e regras tarifárias.",
      "Rain does not directly determine the electricity bill: between the two lie operation, market rules and tariff rules.",
    ),
  () => tx("O PLD não é tarifa: é o preço das diferenças liquidadas no mercado de curto prazo.", "The PLD is not a tariff: it is the price of the differences settled in the short-term market."),
  () => tx("Diferença de preço entre submercados não prova congestionamento da rede.", "A price difference between submarkets does not prove grid congestion."),
  () => tx("Associação entre clima e consumo não é causa provada.", "An association between climate and consumption is not proven cause."),
]);

export const TRANSVERSAIS: { titulo: string; texto: string; destinos: string[] }[] = [
  {
    get titulo() { return tx("Empresas", "Companies"); },
    get texto() { return tx("Quem é dono das usinas, das linhas e das distribuidoras de cada elo, pelo Cadastro Nacional da Pessoa Jurídica (CNPJ).", "Who owns the plants, the lines and the distribution utilities of each link, by the national corporate taxpayer number (CNPJ)."); },
    destinos: ["empresas"],
  },
  {
    get titulo() { return tx("Expansão", "Expansion"); },
    get texto() { return tx("O que está sendo construído em geração e transmissão e quando deve entrar.", "What is being built in generation and transmission and when it is due to start operating."); },
    destinos: ["expansao"],
  },
  {
    get titulo() { return tx("Regulação", "Regulation"); },
    get texto() { return tx("As regras de cada elo, com data de publicação, vigência e efeito declarado.", "The rules of each link, with publication date, effective period and declared effect."); },
    destinos: ["regulacao"],
  },
  {
    get titulo() { return tx("Dados e método", "Data and method"); },
    get texto() { return tx("De onde vem cada número, como foi calculado e como reproduzi-lo.", "Where each number comes from, how it was calculated and how to reproduce it."); },
    destinos: ["dados", "metodologia"], // i18n: dado
  },
];

// ---------------------------------------------------------------------------
// Seção C: para que serve cada destino
// ---------------------------------------------------------------------------

export type ItemCartao = { texto: string; href: string };

export type CartaoDestino = {
  /** Para que a resposta é útil. */
  utilidade: string;
  /** Dois a cinco recursos concretos, cada um com a âncora do painel que o entrega. */
  encontra: ItemCartao[];
  /** Recorte disponível, sem prometer geografia que a fonte não tem. */
  recorte: string;
  conceito?: { slug: string; rotulo: string };
};

/** Um cartão por destino publicado da navegação (exceto a própria home). */
export const CARTOES: Record<string, CartaoDestino> = {
  "visao-geral": {
    get utilidade() { return tx("Ter o contexto de preço, água, geração, consumo e rede antes de aprofundar, e saber onde olhar em seguida.", "Get the context of price, water, generation, consumption and grid before going deeper, and know where to look next."); },
    encontra: [
      { get texto() { return tx("Síntese por regras fixas, com a evidência de cada número", "Summary by fixed rules, with the evidence for each number"); }, href: "/setor-eletrico/visao-geral#sistema" },
      { get texto() { return tx("Preço, água, geração, carga e rede lado a lado, cada um com a sua data", "Price, water, generation, load and grid side by side, each with its own date"); }, href: "/setor-eletrico/visao-geral#preco" },
      { get texto() { return tx("O que observar: regras explícitas sobre os dados mais recentes", "What to watch: explicit rules on the latest data"); }, href: "/setor-eletrico/visao-geral#observar" },
    ],
    get recorte() { return tx("Sistema interligado e as quatro regiões; dado diário ou mensal, conforme a fonte.", "Interconnected system and the four regions; daily or monthly data, depending on the source."); },
  },
  territorio: {
    get utilidade() { return tx("Ver o que os dados dizem sobre a sua região sem confundir o que é do município com o que é da distribuidora ou do submercado.", "See what the data say about your region without confusing what belongs to the municipality with what belongs to the distribution utility or the submarket."); },
    encontra: [
      { get texto() { return tx("Mapa com camadas separadas: submercado, distribuidora, município e usinas", "Map with separate layers: submarket, distribution utility, municipality and plants"); }, href: "/setor-eletrico/territorio" },
      { get texto() { return tx("Busca de município, com links para os módulos de origem", "Municipality search, with links to the source modules"); }, href: "/setor-eletrico/territorio" },
    ],
    get recorte() { return tx("Município, área da distribuidora, UF e submercado, cada indicador no grão da sua fonte.", "Municipality, distribution utility area, state and submarket, each indicator at the level of detail of its source."); },
  },
  "agua-e-clima": {
    get utilidade() { return tx("Saber se a água guardada e a que chega estão acima ou abaixo do usual para a época, com a régua de comparação explicada.", "Know whether stored water and inflows are above or below what is usual for the season, with the comparison yardstick explained."); },
    encontra: [
      { get texto() { return tx("Energia armazenada (EAR) com a faixa do mesmo dia nos anos anteriores", "Stored energy (EAR) with the range for the same day in previous years"); }, href: "/setor-eletrico/agua-e-clima#p017" },
      { get texto() { return tx("Energia afluente (ENA) em percentual da média de longo termo", "Inflow energy (ENA) as a percentage of the long-term average"); }, href: "/setor-eletrico/agua-e-clima/afluencia#p018" },
      { get texto() { return tx("Chuva e temperatura por bacia, estimadas por satélite e reanálise", "Rainfall and temperature by basin, estimated from satellite and reanalysis"); }, href: "/setor-eletrico/agua-e-clima/chuva-e-temperatura#p019" },
      { get texto() { return tx("Variação e balanço de cada reservatório", "Change and balance of each reservoir"); }, href: "/setor-eletrico/agua-e-clima/reservatorios#p020" },
    ],
    get recorte() { return tx("Sistema interligado, subsistema, REE, bacia e reservatório; diário.", "Interconnected system, subsystem, REE, basin and reservoir; daily."); },
    conceito: { slug: "ear", get rotulo() { return tx("o que é EAR", "what EAR is"); } },
  },
  geracao: {
    get utilidade() { return tx("Ver quanto cada fonte entregou, por que as térmicas foram acionadas e quanta energia eólica e solar deixou de ser gerada por restrição.", "See how much each source delivered, why thermal plants were dispatched and how much wind and solar energy was not generated because of restrictions."); },
    encontra: [
      { get texto() { return tx("Matriz efetiva por fonte, com e sem a micro e minigeração estimada", "Actual mix by source, with and without estimated micro and mini generation"); }, href: "/setor-eletrico/geracao" },
      { get texto() { return tx("Despacho térmico pelos motivos declarados pelo ONS", "Thermal dispatch by the reasons declared by ONS"); }, href: "/setor-eletrico/geracao/termica#p022" },
      { get texto() { return tx("Cortes de geração eólica e solar pelas razões oficiais, com o mapa das usinas", "Cuts to wind and solar generation by official reasons, with the map of plants"); }, href: "/setor-eletrico/geracao/restricoes#p023" },
      { get texto() { return tx("Curtailment: por que eólicas e solares são cortadas e quem perde, com laboratórios interativos", "Curtailment: why wind and solar plants are cut and who loses, with interactive labs"); }, href: "/setor-eletrico/geracao/curtailment" },
      { get texto() { return tx("Potência instalada e fator de capacidade por fonte e por usina", "Installed capacity and capacity factor by source and by plant"); }, href: "/setor-eletrico/geracao/capacidade#p024" },
    ],
    get recorte() { return tx("Sistema interligado e subsistemas; usina para térmicas e cortes; horário, diário e mensal.", "Interconnected system and subsystems; plant level for thermal plants and cuts; hourly, daily and monthly."); },
    conceito: { slug: "geracao-centralizada", get rotulo() { return tx("o que é geração verificada", "what verified generation is"); } },
  },
  carga: {
    get utilidade() { return tx("Medir o consumo do sistema, comparar com períodos equivalentes e separar calendário, temperatura e micro e minigeração.", "Measure the system's consumption, compare it with equivalent periods and separate calendar, temperature and micro and mini generation."); },
    encontra: [
      { get texto() { return tx("Carga diária por região em janelas comparáveis", "Daily load by region in comparable windows"); }, href: "/setor-eletrico/carga#p025" },
      { get texto() { return tx("Perfil horário e carga líquida da micro e minigeração", "Hourly profile and load net of micro and mini generation"); }, href: "/setor-eletrico/carga/perfil-horario#p026" },
      { get texto() { return tx("Clima e calendário: decomposição avaliada fora da amostra", "Climate and calendar: decomposition evaluated out of sample"); }, href: "/setor-eletrico/carga/clima-e-calendario#p027" },
    ],
    get recorte() { return tx("Sistema interligado e subsistemas; horário e diário.", "Interconnected system and subsystems; hourly and daily."); },
    conceito: { slug: "carga", get rotulo() { return tx("o que é carga", "what load is"); } },
  },
  rede: {
    get utilidade() { return tx("Entender para onde a energia flui entre as regiões e o que os documentos do ONS registram como restrição.", "Understand where energy flows between regions and what ONS documents record as restrictions."); },
    encontra: [
      { get texto() { return tx("Fluxos por fronteira e saldo de cada subsistema", "Flows by boundary and net balance of each subsystem"); }, href: "/setor-eletrico/rede#p028" },
      { get texto() { return tx("Balanço e intercâmbio com outros países, identidade por identidade", "Balance and interchange with other countries, identity by identity"); }, href: "/setor-eletrico/rede/balanco-e-exterior#p029" },
      { get texto() { return tx("Horas acima do limite sistêmico e cortes de carga", "Hours above the system limit and load cuts"); }, href: "/setor-eletrico/rede/restricoes#p030" },
      { get texto() { return tx("Intercâmbio verificado contra o programado", "Verified interchange against scheduled interchange"); }, href: "/setor-eletrico/rede/programado#p031" },
    ],
    get recorte() { return tx("Fronteiras entre subsistemas e interligações internacionais; horário.", "Boundaries between subsystems and international interconnections; hourly."); },
    conceito: { slug: "intercambio", get rotulo() { return tx("o que é intercâmbio", "what interchange is"); } },
  },
  pld: {
    get utilidade() { return tx("Entender como o preço de curto prazo se forma, onde ele está diante do histórico e dos limites e quando as regiões se separam.", "Understand how the spot price is formed, where it stands against history and limits, and when the regions separate."); },
    encontra: [
      { get texto() { return tx("O PLD explicado em 90 segundos", "The PLD explained in 90 seconds"); }, href: "/setor-eletrico/pld#o-que-e" },
      { get texto() { return tx("CMO e formação do preço", "CMO and price formation"); }, href: "/setor-eletrico/pld/cmo-e-formacao#p009" },
      { get texto() { return tx("Limites, piso e tetos de cada ano", "Limits, floor and ceilings for each year"); }, href: "/setor-eletrico/pld/limites#p010" },
      { get texto() { return tx("Histórico e distribuição por mês e semana", "History and distribution by month and week"); }, href: "/setor-eletrico/pld/historico#p011" },
      { get texto() { return tx("Diferenças regionais hora a hora", "Regional differences hour by hour"); }, href: "/setor-eletrico/pld/diferencas-regionais#p012" },
    ],
    get recorte() { return tx("Quatro submercados; horário, diário e mensal.", "Four submarkets; hourly, daily and monthly."); },
    conceito: { slug: "pld", get rotulo() { return tx("o que é PLD", "what the PLD is"); } },
  },
  "pld-modelos": {
    get utilidade() { return tx("Ver o que se projeta para o PLD, com que método, e conferir no arquivo imutável como cada projeção se saiu.", "See what is projected for the PLD, with which method, and check in the immutable archive how each projection performed."); },
    encontra: [
      { get texto() { return tx("Rodada mais recente: referência B0 por submercado e entrega", "Latest run: B0 reference by submarket and delivery"); }, href: "/setor-eletrico/pld/previsoes#p013" },
      { get texto() { return tx("Registro e fichas dos modelos", "Model register and model sheets"); }, href: "/setor-eletrico/pld/modelos#p014" },
      { get texto() { return tx("Arquivo imutável de emissões", "Immutable archive of issued forecasts"); }, href: "/setor-eletrico/pld/previsoes#p015" },
      { get texto() { return tx("Desempenho fora da amostra e calibração", "Out-of-sample performance and calibration"); }, href: "/setor-eletrico/pld/modelos#p016" },
    ],
    get recorte() { return tx("Submercado; entregas semanais e mensais.", "Submarket; weekly and monthly deliveries."); },
  },
  mercado: {
    get utilidade() { return tx("Entender como a energia é contratada nos ambientes livre e regulado, quem são os agentes e o que custam o compartilhamento do risco hidrológico e os encargos.", "Understand how energy is contracted in the free and regulated environments, who the agents are and what hydrological risk sharing and sector charges cost."); },
    encontra: [
      { get texto() { return tx("Mercado livre e regulado no consumo, em três universos com perímetros diferentes", "Free and regulated markets in consumption, in three universes with different perimeters"); }, href: "/setor-eletrico/mercado#livre-regulado" },
      { get texto() { return tx("Agentes, parcelas de carga, migrações e desligamentos", "Agents, load portions, migrations and exits"); }, href: "/setor-eletrico/mercado/agentes#agentes" },
      { get texto() { return tx("GSF do MRE e risco hidrológico do consumidor cativo", "MRE GSF and the hydrological risk of captive consumers"); }, href: "/setor-eletrico/mercado/mre-e-gsf#mre-gsf" },
      { get texto() { return tx("Encargos, liquidação e inadimplência", "Sector charges, settlement and defaults"); }, href: "/setor-eletrico/mercado/encargos#encargos" },
    ],
    get recorte() { return tx("Brasil, região, subsistema, UF e distribuidora, conforme a fonte; mensal.", "Brazil, region, subsystem, state and distribution utility, depending on the source; monthly."); },
    conceito: { slug: "mcp", get rotulo() { return tx("o que é o mercado de curto prazo", "what the short-term market is"); } },
  },
  leiloes: {
    get utilidade() { return tx("Saber quanta energia o mercado regulado comprou em leilão, a que preço corrigido pelo IPCA, de quem, e quanto das usinas contratadas já opera.", "Know how much energy the regulated market bought at auction, at what price adjusted for IPCA inflation, from whom, and how many of the contracted plants already operate."); },
    encontra: [
      { get texto() { return tx("Energia contratada por ano, fonte e tipo de leilão", "Contracted energy by year, source and type of auction"); }, href: "/setor-eletrico/leiloes#quanto" },
      { get texto() { return tx("Preço por fonte em reais da época e corrigido pelo IPCA, e deságio", "Price by source in reais of the time and adjusted for IPCA inflation, and discount"); }, href: "/setor-eletrico/leiloes#preco" },
      { get texto() { return tx("Situação atual das usinas contratadas", "Current status of the contracted plants"); }, href: "/setor-eletrico/leiloes#entrega" },
      { get texto() { return tx("Laboratório do leilão de preço descendente", "Descending-price auction lab"); }, href: "/setor-eletrico/leiloes#laboratorio" },
      { get texto() { return tx("Leilões de transmissão corrigidos pelo IPCA, com o deságio de cada lote", "Transmission auctions adjusted for IPCA inflation, with the discount for each lot"); }, href: "/setor-eletrico/leiloes/transmissao" },
    ],
    get recorte() { return tx("Leilão, ano, fonte e UF; leilões de geração desde 2005 e de transmissão desde 1999.", "Auction, year, source and state; generation auctions since 2005 and transmission auctions since 1999."); },
    conceito: { slug: "acr", get rotulo() { return tx("o que é o ACR", "what the ACR is"); } },
  },
  "conta-de-luz": {
    get utilidade() { return tx("Comparar a tarifa residencial entre distribuidoras, ver o que compõe a conta e estimar o valor para um consumo mensal.", "Compare the residential tariff across distribution utilities, see what makes up the bill and estimate the amount for a monthly consumption."); },
    encontra: [
      { get texto() { return tx("Tarifa residencial de cada distribuidora", "Residential tariff of each distribution utility"); }, href: "/setor-eletrico/conta-de-luz#tarifa" },
      { get texto() { return tx("Composição: energia, transmissão, distribuição, perdas e encargos", "Breakdown: energy, transmission, distribution, losses and sector charges"); }, href: "/setor-eletrico/conta-de-luz#composicao" },
      { get texto() { return tx("Simulação da conta por consumo mensal", "Bill simulation by monthly consumption"); }, href: "/setor-eletrico/conta-de-luz#simulador" },
      { get texto() { return tx("Reajustes, bandeiras e subsídios", "Tariff adjustments, tariff flags and subsidies"); }, href: "/setor-eletrico/conta-de-luz/reajustes-e-subsidios#p050" },
    ],
    get recorte() { return tx("Distribuidora e vigência tarifária; bandeira por mês.", "Distribution utility and tariff period; tariff flag by month."); },
    conceito: { slug: "tarifa-te-tusd", get rotulo() { return tx("o que são TE e TUSD", "what TE and TUSD are"); } },
  },
  perdas: {
    get utilidade() { return tx("Saber quanto cada distribuidora perde, separar o técnico do não técnico e ver o percentual técnico regulatório.", "Know how much each distribution utility loses, separate technical from non-technical losses and see the regulatory technical percentage."); },
    encontra: [
      { get texto() { return tx("Mapa e evolução das perdas por distribuidora", "Map and evolution of losses by distribution utility"); }, href: "/setor-eletrico/perdas#painel-mapa" },
      { get texto() { return tx("Composição técnica e não técnica", "Technical and non-technical breakdown"); }, href: "/setor-eletrico/perdas/composicao#painel-composicao" },
      { get texto() { return tx("Percentual técnico regulatório por distribuidora", "Regulatory technical percentage by distribution utility"); }, href: "/setor-eletrico/perdas/regulatorio#painel-regulatorio" },
      { get texto() { return tx("Custo e contexto territorial", "Cost and territorial context"); }, href: "/setor-eletrico/perdas/custo-e-contexto#painel-custo" },
    ],
    get recorte() { return tx("Distribuidora, com a área desenhada por municípios inteiros; anual e mensal.", "Distribution utility, with the area drawn from whole municipalities; annual and monthly."); },
    conceito: { slug: "perdas-de-energia", get rotulo() { return tx("o que são perdas", "what losses are"); } },
  },
  qualidade: {
    get utilidade() { return tx("Comparar quanto tempo e quantas vezes falta energia em cada distribuidora e conjunto, diante dos limites, e o que é pago em compensação.", "Compare how long and how often the power goes out in each distribution utility and consumer set, against the limits, and what is paid in compensation."); },
    encontra: [
      { get texto() { return tx("DEC e FEC do Brasil, das distribuidoras e dos conjuntos", "DEC and FEC for Brazil, the distribution utilities and the consumer sets"); }, href: "/setor-eletrico/qualidade#p051" },
      { get texto() { return tx("Distribuidoras diante do próprio limite", "Distribution utilities against their own limit"); }, href: "/setor-eletrico/qualidade#p052" },
      { get texto() { return tx("Quanto as regras tiram do tempo apurado", "How much the rules remove from the computed time"); }, href: "/setor-eletrico/qualidade#expurgos" },
      { get texto() { return tx("Compensações pagas por violação de limite", "Compensation paid for limit violations"); }, href: "/setor-eletrico/qualidade#p053" },
      { get texto() { return tx("Atendimento e recuperação da rede", "Customer service and grid recovery"); }, href: "/setor-eletrico/qualidade#p054" },
    ],
    get recorte() { return tx("Brasil, distribuidora e conjunto elétrico; mensal e anual.", "Brazil, distribution utility and consumer set; monthly and annual."); },
    conceito: { slug: "dec", get rotulo() { return tx("o que é DEC", "what DEC is"); } },
  },
  "inclusao-energetica": {
    get utilidade() { return tx("Ver quem recebe a Tarifa Social, onde a cobertura potencial parece baixa, quanto a energia pesa no orçamento e onde ainda falta acesso.", "See who receives the Tarifa Social, where potential coverage seems low, how much energy weighs in the budget and where access is still missing."); },
    encontra: [
      { get texto() { return tx("Tarifa Social: unidades atendidas e descontos", "Tarifa Social: units served and discounts"); }, href: "/setor-eletrico/inclusao-energetica/tarifa-social#p059" },
      { get texto() { return tx("Cobertura potencial por município, com o denominador declarado", "Potential coverage by municipality, with the declared denominator"); }, href: "/setor-eletrico/inclusao-energetica/cobertura#p060" },
      { get texto() { return tx("Peso da energia no orçamento das famílias", "Weight of energy in household budgets"); }, href: "/setor-eletrico/inclusao-energetica/orcamento#p061" },
      { get texto() { return tx("Acesso à energia e sistemas isolados", "Access to energy and isolated systems"); }, href: "/setor-eletrico/inclusao-energetica/acesso#p062" },
    ],
    get recorte() { return tx("Brasil, UF, município e distribuidora, conforme a fonte; mensal e anual.", "Brazil, state, municipality and distribution utility, depending on the source; monthly and annual."); },
    conceito: { slug: "tarifa-social", get rotulo() { return tx("o que é Tarifa Social", "what the Tarifa Social is"); } },
  },
  empresas: {
    get utilidade() { return tx("Saber quem controla usinas, linhas e distribuidoras, como a potência se concentra e o que as companhias abertas publicam.", "Know who controls plants, lines and distribution utilities, how capacity is concentrated and what listed companies publish."); },
    encontra: [
      { get texto() { return tx("Ativos por proprietário: usinas e transmissão", "Assets by owner: plants and transmission"); }, href: "/setor-eletrico/empresas/ativos#p036" },
      { get texto() { return tx("Ficha de cada distribuidora pelo CNPJ", "Sheet for each distribution utility by CNPJ"); }, href: "/setor-eletrico/empresas/distribuidoras#p037" },
      { get texto() { return tx("Demonstrações das companhias abertas", "Financial statements of listed companies"); }, href: "/setor-eletrico/empresas/financas#p038" },
      { get texto() { return tx("Controle e concentração", "Control and concentration"); }, href: "/setor-eletrico/empresas/controle#p039" },
      { get texto() { return tx("Companhias listadas do índice de energia elétrica da B3: ativos, controle, finanças e ações", "Listed companies in the B3 electric power index: assets, control, finances and shares"); }, href: "/setor-eletrico/empresas/listadas" },
    ],
    get recorte() { return tx("CNPJ, grupo de controle e distribuidora; mensal e trimestral.", "CNPJ, controlling group and distribution utility; monthly and quarterly."); },
  },
  expansao: {
    get utilidade() { return tx("Acompanhar o que está sendo construído em geração e transmissão, quando deve entrar e quanto os prazos têm se deslocado.", "Follow what is being built in generation and transmission, when it is due to start operating and how much deadlines have shifted."); },
    encontra: [
      { get texto() { return tx("Carteira de projetos de geração por estágio", "Portfolio of generation projects by stage"); }, href: "/setor-eletrico/expansao/carteira#p040" },
      { get texto() { return tx("Cronograma e desvios de prazo", "Schedule and deadline deviations"); }, href: "/setor-eletrico/expansao/cronograma#p041" },
      { get texto() { return tx("Geração e transmissão por UF e ano", "Generation and transmission by state and year"); }, href: "/setor-eletrico/expansao/geracao-e-transmissao#p042" },
      { get texto() { return tx("Cenários oficiais de expansão", "Official expansion scenarios"); }, href: "/setor-eletrico/expansao/cenarios#p043" },
    ],
    get recorte() { return tx("Usina, UF e linha de transmissão; mensal e anual.", "Plant, state and transmission line; monthly and annual."); },
  },
  transicao: {
    get utilidade() { return tx("Ver onde a micro e minigeração distribuída cresce e como evolui a intensidade de emissões da geração do sistema interligado.", "See where distributed micro and mini generation is growing and how the emissions intensity of generation in the interconnected system evolves."); },
    encontra: [
      { get texto() { return tx("Micro e minigeração por município e fonte", "Micro and mini generation by municipality and source"); }, href: "/setor-eletrico/transicao/mmgd#p063" },
      { get texto() { return tx("Intensidade de emissões do sistema interligado", "Emissions intensity of the interconnected system"); }, href: "/setor-eletrico/transicao/emissoes#p064" },
      { get texto() { return tx("Energia estimada da micro e minigeração na carga", "Estimated energy from micro and mini generation in the load"); }, href: "/setor-eletrico/transicao/energia-estimada#energia-estimada" },
    ],
    get recorte() { return tx("Município, UF e sistema interligado; mensal e anual.", "Municipality, state and interconnected system; monthly and annual."); },
    conceito: { slug: "fator-de-emissao", get rotulo() { return tx("o que é fator de emissão", "what an emission factor is"); } },
  },
  regulacao: {
    get utilidade() { return tx("Situar uma regra no tempo: quando foi publicada, desde quando vale, o que mudou e qual efeito a própria fonte declara.", "Place a rule in time: when it was published, since when it applies, what changed and what effect the source itself declares."); },
    encontra: [
      { get texto() { return tx("Limites do PLD e adicionais das bandeiras por vigência", "PLD limits and tariff flag surcharges by effective period"); }, href: "/setor-eletrico/regulacao#p044" },
      { get texto() { return tx("Linha do tempo das regras", "Timeline of the rules"); }, href: "/setor-eletrico/regulacao/linha-do-tempo#p045" },
      { get texto() { return tx("Consultas públicas e Agenda Regulatória", "Public consultations and the Regulatory Agenda"); }, href: "/setor-eletrico/regulacao/consultas-e-agenda#p046" },
    ],
    get recorte() { return tx("Ato, tema e vigência; por data.", "Act, topic and effective period; by date."); },
    conceito: { slug: "agenda-regulatoria", get rotulo() { return tx("o que é a Agenda Regulatória", "what the Regulatory Agenda is"); } },
  },
  aprenda: {
    get utilidade() { return tx("Aprender os conceitos com a definição da fonte oficial e voltar ao painel onde cada um aparece.", "Learn the concepts with the definition from the official source and go back to the panel where each one appears."); },
    encontra: [
      { get texto() { return tx("Verbetes por tema, com fonte primária e trecho citado", "Entries by topic, with primary source and quoted excerpt"); }, href: "/setor-eletrico/aprenda" },
      { get texto() { return tx("Dica curta ao passar sobre as siglas em todas as páginas", "Short tip when hovering over acronyms on every page"); }, href: "/setor-eletrico/aprenda" },
    ],
    get recorte() { return tx("Conceito.", "Concept."); },
  },
  dados: {
    get utilidade() { return tx("Encontrar o conjunto de origem de um número, ver o estado de cada fonte e baixar os arquivos para reproduzir.", "Find the source dataset of a number, see the status of each source and download the files to reproduce it."); },
    encontra: [
      { get texto() { return tx("Catálogo de conjuntos com a escada de estados, do catalogado ao publicado", "Dataset catalog with the ladder of states, from catalogued to published"); }, href: "/setor-eletrico/dados#catalogo" },
      { get texto() { return tx("Saúde das fontes: o que atrasou, falhou ou foi revisado", "Source health: what was late, failed or was revised"); }, href: "/setor-eletrico/dados/saude#saude" },
      { get texto() { return tx("Download e reprodução: sha256 de cada arquivo e conferência do que você baixou", "Download and reproduction: sha256 of each file and a check of what you downloaded"); }, href: "/setor-eletrico/dados/reproducao#reproducao" },
      { get texto() { return tx("Ficha de cada conjunto com capturas e sha256", "Sheet for each dataset with captures and sha256"); }, href: "/setor-eletrico/dados/ccee-pld-horario" },
    ],
    get recorte() { return tx("Conjunto, arquivo e captura.", "Dataset, file and capture."); },
  },
  metodologia: {
    get utilidade() { return tx("Ver como cada número é produzido, que natureza ele tem e o que não se pode concluir a partir dele.", "See how each number is produced, what nature it has and what cannot be concluded from it."); },
    encontra: [
      { get texto() { return tx("Regras por indicador: definição, unidade, recortes, cálculo e limites", "Rules by indicator: definition, unit, breakdowns, calculation and limits"); }, href: "/setor-eletrico/metodologia#regras" },
      { get texto() { return tx("Natureza de cada dado: observado, calculado, estimado, previsto e cenário", "Nature of each data point: observed, calculated, estimated, forecast and scenario"); }, href: "/setor-eletrico/metodologia#natureza" },
      { get texto() { return tx("Unidades e como lê-las", "Units and how to read them"); }, href: "/setor-eletrico/metodologia#unidades" },
      { get texto() { return tx("Linhagem: do arquivo da fonte à página", "Lineage: from the source file to the page"); }, href: "/setor-eletrico/metodologia#linhagem" },
      { get texto() { return tx("Limitações conhecidas", "Known limitations"); }, href: "/setor-eletrico/metodologia#limitacoes" },
      { get texto() { return tx("Avaliação dos painéis: nota de cada página por dimensão, com a evidência e os defeitos abertos", "Panel assessment: score of each page by dimension, with the evidence and open defects"); }, href: "/setor-eletrico/metodologia/avaliacao#avaliacao" },
    ],
    get recorte() { return tx("Indicador e regra.", "Indicator and rule."); },
  },
};

// ---------------------------------------------------------------------------
// Seção D: perguntas do dia a dia
// ---------------------------------------------------------------------------

export type PerguntaCotidiana = {
  pergunta: string;
  /** O que a pessoa encontra e o cuidado de leitura, em uma ou duas frases. */
  resposta: string;
  destinos: { rotulo: string; href: string }[];
  /** A pergunta é sobre uma distribuidora: a home oferece a escolha e leva a página com ela já selecionada. */
  porDistribuidora?: "perdas" | "qualidade";
};

export const PERGUNTAS_COTIDIANAS: PerguntaCotidiana[] = [
  {
    get pergunta() { return tx("Minha distribuidora perde muita energia?", "Does my distribution utility lose a lot of energy?"); },
    get resposta() { return tx("Perdas mostra a taxa de cada distribuidora, a evolução e o percentual técnico regulatório. Perda não técnica não é sinônimo de furto.", "Losses shows the rate of each distribution utility, its evolution and the regulatory technical percentage. Non-technical loss is not a synonym for theft."); },
    destinos: [{ get rotulo() { return tx("Perdas", "Losses"); }, href: "/setor-eletrico/perdas#painel-mapa" }],
    porDistribuidora: "perdas",
  },
  {
    get pergunta() { return tx("O serviço da minha distribuidora melhorou?", "Has my distribution utility's service improved?"); },
    get resposta() { return tx("Qualidade mostra quanto tempo (DEC) e quantas vezes (FEC) falta energia em cada distribuidora, ano a ano, e o limite fixado para ela.", "Quality of supply shows how long (DEC) and how often (FEC) the power goes out in each distribution utility, year by year, and the limit set for it."); },
    destinos: [{ get rotulo() { return tx("Qualidade", "Quality of supply"); }, href: "/setor-eletrico/qualidade#p051" }],
    porDistribuidora: "qualidade",
  },
  {
    get pergunta() { return tx("Por que a conta de luz subiu?", "Why did the electricity bill go up?"); },
    get resposta() { return tx("Conta de luz mostra o que mudou em cada componente da tarifa, a bandeira de cada mês e os subsídios. A página separa as mudanças; não atribui causa automaticamente.", "Electricity bill shows what changed in each tariff component, the tariff flag of each month and the subsidies. The page separates the changes; it does not attribute cause automatically."); },
    destinos: [{ get rotulo() { return tx("Reajustes, bandeiras e subsídios", "Tariff adjustments, tariff flags and subsidies"); }, href: "/setor-eletrico/conta-de-luz/reajustes-e-subsidios#reajustes" }],
  },
  {
    get pergunta() { return tx("O preço de curto prazo está alto para esta época?", "Is the spot price high for this time of year?"); },
    get resposta() { return tx("O histórico do PLD põe cada dia no percentil do mesmo mês e da mesma semana nos anos anteriores, por regime de limites.", "The PLD history places each day in the percentile of the same month and the same week in previous years, by limit regime."); },
    destinos: [{ get rotulo() { return tx("PLD, histórico e distribuição", "PLD, history and distribution"); }, href: "/setor-eletrico/pld/historico#p011" }],
  },
  {
    get pergunta() { return tx("A água nos reservatórios está acima do normal?", "Is the water in the reservoirs above normal?"); },
    get resposta() { return tx("Água e clima compara a energia armazenada com a faixa do mesmo dia nos anos anteriores, por subsistema.", "Water and climate compares stored energy with the range for the same day in previous years, by subsystem."); },
    destinos: [{ get rotulo() { return tx("Água e clima", "Water and climate"); }, href: "/setor-eletrico/agua-e-clima#p017" }],
  },
  {
    get pergunta() { return tx("Por que há corte de geração renovável?", "Why is renewable generation curtailed?"); },
    get resposta() { return tx("Geração mostra a energia eólica e solar não gerada pelas razões oficiais do ONS; Rede mostra as restrições documentadas.", "Generation shows the wind and solar energy not generated for the official reasons given by ONS; Grid shows the documented restrictions."); },
    destinos: [
      { get rotulo() { return tx("Geração", "Generation"); }, href: "/setor-eletrico/geracao" },
      { get rotulo() { return tx("Restrições da rede", "Grid restrictions"); }, href: "/setor-eletrico/rede/restricoes#p030" },
    ],
  },
  {
    get pergunta() { return tx("Onde estão as novas usinas?", "Where are the new plants?"); },
    get resposta() { return tx("Expansão mostra as usinas em construção e outorgadas no mapa, com o estágio e a previsão de entrada.", "Expansion shows the plants under construction and granted on the map, with their stage and expected start of operation."); },
    destinos: [{ get rotulo() { return tx("Mapa das usinas", "Map of plants"); }, href: "/setor-eletrico/expansao/carteira#mapa-usinas" }],
  },
  {
    get pergunta() { return tx("Quem recebe os benefícios e onde pode haver falta de cobertura?", "Who receives the benefits and where might coverage be missing?"); },
    get resposta() { return tx("Inclusão mostra quem recebe a Tarifa Social e uma medida de cobertura potencial por município, com o denominador do Cadastro Único declarado como aproximação.", "Energy inclusion shows who receives the Tarifa Social and a measure of potential coverage by municipality, with the denominator from the federal registry for social programs declared as an approximation."); },
    destinos: [
      { rotulo: "Tarifa Social", href: "/setor-eletrico/inclusao-energetica/tarifa-social#p059" },
      { get rotulo() { return tx("Cobertura potencial", "Potential coverage"); }, href: "/setor-eletrico/inclusao-energetica/cobertura#p060" },
    ],
  },
  {
    get pergunta() { return tx("Quero baixar a série e reproduzir o gráfico.", "I want to download the series and reproduce the chart."); },
    get resposta() { return tx("Dados lista cada conjunto com arquivos para baixar; o modo Auditar de cada página mostra fórmula, versão e reprodução.", "Data lists each dataset with files to download; the Audit mode of each page shows formula, version and reproduction."); },
    destinos: [
      { get rotulo() { return tx("Dados", "Data"); }, href: "/setor-eletrico/dados" },
      { get rotulo() { return tx("PLD no modo Auditar", "PLD in Audit mode"); }, href: "/setor-eletrico/pld?modo=auditar" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Seção E: trilhas por interesse
// ---------------------------------------------------------------------------

export type ParadaTrilha = { rotulo: string; href: string; aprende: string };

export type Trilha = {
  id: "comecando" | "consumidor" | "analista" | "ensino";
  perfil: string;
  para: string;
  /** Tempo de leitura estimado pela equipe editorial; não é medida de uso. */
  minutos: number;
  paradas: ParadaTrilha[];
};

export const TRILHAS: Trilha[] = [
  {
    id: "comecando",
    get perfil() { return tx("Estou começando", "I am just starting"); },
    get para() { return tx("Para quem quer entender o quadro geral sem jargão e saber onde achar cada número.", "For those who want to understand the big picture without jargon and know where to find each number."); },
    minutos: 20,
    paradas: [
      { get rotulo() { return tx("Visão geral", "Overview"); }, href: "/setor-eletrico/visao-geral", get aprende() { return tx("o que está acontecendo agora, em frases com a evidência de cada número.", "what is happening now, in sentences with the evidence for each number."); } },
      { get rotulo() { return tx("PLD em 90 segundos", "PLD in 90 seconds"); }, href: "/setor-eletrico/pld#o-que-e", get aprende() { return tx("o que é o preço de curto prazo e por que ele não é a tarifa.", "what the spot price is and why it is not the tariff."); } },
      { get rotulo() { return tx("Água e clima", "Water and climate"); }, href: "/setor-eletrico/agua-e-clima#p017", get aprende() { return tx("por que a água guardada importa e como compará-la com o usual.", "why stored water matters and how to compare it with what is usual."); } },
      { get rotulo() { return tx("Conta de luz", "Electricity bill"); }, href: "/setor-eletrico/conta-de-luz#composicao", get aprende() { return tx("o que compõe a conta que chega em casa.", "what makes up the bill that arrives at home."); } },
      { get rotulo() { return tx("Aprenda", "Learn"); }, href: "/setor-eletrico/aprenda", get aprende() { return tx("os conceitos, cada um com a definição da fonte oficial.", "the concepts, each with the definition from the official source."); } },
    ],
  },
  {
    id: "consumidor",
    get perfil() { return tx("Sou consumidor", "I am a consumer"); },
    get para() { return tx("Para quem quer entender a própria conta, o serviço que recebe e os direitos de quem tem menos renda.", "For those who want to understand their own bill, the service they receive and the rights of people with lower incomes."); },
    minutos: 15,
    paradas: [
      { get rotulo() { return tx("Conta de luz", "Electricity bill"); }, href: "/setor-eletrico/conta-de-luz#simulador", get aprende() { return tx("a tarifa da sua distribuidora e o valor estimado para o seu consumo.", "the tariff of your distribution utility and the estimated amount for your consumption."); } },
      { get rotulo() { return tx("Reajustes e bandeiras", "Tariff adjustments and tariff flags"); }, href: "/setor-eletrico/conta-de-luz/reajustes-e-subsidios#bandeiras", get aprende() { return tx("o que mudou na tarifa e qual bandeira valeu em cada mês.", "what changed in the tariff and which tariff flag applied in each month."); } },
      { get rotulo() { return tx("Qualidade", "Quality of supply"); }, href: "/setor-eletrico/qualidade#p052", get aprende() { return tx("quanto falta energia na sua distribuidora diante do limite.", "how often the power goes out at your distribution utility against the limit."); } },
      { get rotulo() { return tx("Perdas", "Losses"); }, href: "/setor-eletrico/perdas#painel-mapa", get aprende() { return tx("quanto a sua distribuidora perde, a evolução e o percentual técnico regulatório.", "how much your distribution utility loses, its evolution and the regulatory technical percentage."); } },
      { rotulo: "Tarifa Social", href: "/setor-eletrico/inclusao-energetica/tarifa-social#p059", get aprende() { return tx("quem recebe o desconto e como a cobertura varia.", "who receives the discount and how coverage varies."); } },
      { get rotulo() { return tx("Ficha da distribuidora", "Distribution utility sheet"); }, href: "/setor-eletrico/empresas/distribuidoras#p037", get aprende() { return tx("perdas, continuidade, tarifa e controle no mesmo lugar, pelo CNPJ.", "losses, continuity, tariff and control in the same place, by CNPJ."); } },
    ],
  },
  {
    id: "analista",
    get perfil() { return tx("Analiso o setor", "I analyze the sector"); },
    get para() { return tx("Para quem atua em comercialização, geração, consumo livre ou planejamento e quer séries, comparações e regras.", "For those who work in trading, generation, free consumption or planning and want series, comparisons and rules."); },
    minutos: 40,
    paradas: [
      { get rotulo() { return tx("PLD, histórico", "PLD, history"); }, href: "/setor-eletrico/pld/historico?modo=analisar#p011", get aprende() { return tx("o preço no percentil sazonal e por regime de limites.", "the price in its seasonal percentile and by limit regime."); } },
      { get rotulo() { return tx("PLD, diferenças regionais", "PLD, regional differences"); }, href: "/setor-eletrico/pld/diferencas-regionais#p012", get aprende() { return tx("quando e quanto os submercados se separam, hora a hora.", "when and by how much the submarkets separate, hour by hour."); } },
      { get rotulo() { return tx("Rede", "Grid"); }, href: "/setor-eletrico/rede#p028", get aprende() { return tx("os fluxos entre regiões e as restrições documentadas.", "the flows between regions and the documented restrictions."); } },
      { get rotulo() { return tx("Água e clima, afluência", "Water and climate, inflows"); }, href: "/setor-eletrico/agua-e-clima/afluencia#p018", get aprende() { return tx("a ENA diante da média de longo termo e a versão da referência.", "the ENA against the long-term average and the version of the reference."); } },
      { get rotulo() { return tx("Geração", "Generation"); }, href: "/setor-eletrico/geracao", get aprende() { return tx("o despacho térmico por motivo e os cortes de renováveis.", "thermal dispatch by reason and renewable curtailment."); } },
      { get rotulo() { return tx("Regulação, limites do PLD", "Regulation, PLD limits"); }, href: "/setor-eletrico/regulacao#p044", get aprende() { return tx("o piso e os tetos de cada ano, com o ato e a vigência.", "the floor and ceilings for each year, with the act and effective period."); } },
      { get rotulo() { return tx("Previsões e modelos", "Forecasts and models"); }, href: "/setor-eletrico/pld/modelos#p016", get aprende() { return tx("como as previsões se saíram fora da amostra.", "how the forecasts performed out of sample."); } },
    ],
  },
  {
    id: "ensino",
    get perfil() { return tx("Ensino ou pesquiso", "I teach or do research"); },
    get para() { return tx("Para quem precisa citar, reproduzir e explicar de onde vem cada número.", "For those who need to cite, reproduce and explain where each number comes from."); },
    minutos: 30,
    paradas: [
      { get rotulo() { return tx("Metodologia", "Methodology"); }, href: "/setor-eletrico/metodologia#natureza", get aprende() { return tx("a natureza de cada dado e a linhagem do arquivo à página.", "the nature of each data point and the lineage from the file to the page."); } },
      { get rotulo() { return tx("Dados", "Data"); }, href: "/setor-eletrico/dados", get aprende() { return tx("o catálogo, o estado de cada conjunto e os arquivos para baixar.", "the catalog, the status of each dataset and the files to download."); } },
      { get rotulo() { return tx("Comprove um número em Perdas", "Check a number in Losses"); }, href: "/setor-eletrico/perdas#painel-mapa", get aprende() { return tx("como a ficha de um número mostra fonte, fórmula, sha256 e citação.", "how a number's evidence sheet shows source, formula, sha256 and citation."); } },
      { get rotulo() { return tx("Modelos do PLD", "PLD models"); }, href: "/setor-eletrico/pld/modelos#p014", get aprende() { return tx("as fichas dos modelos e a reexecução das previsões.", "the model sheets and the re-run of the forecasts."); } },
      { get rotulo() { return tx("Arquivo de emissões", "Archive of issued forecasts"); }, href: "/setor-eletrico/pld/previsoes#p015", get aprende() { return tx("por que um registro de previsão nunca é reescrito.", "why a forecast record is never rewritten."); } },
      { get rotulo() { return tx("Linha do tempo das regras", "Timeline of the rules"); }, href: "/setor-eletrico/regulacao/linha-do-tempo#p045", get aprende() { return tx("quando cada regra passou a valer e o que mudou na leitura dos painéis.", "when each rule started to apply and what changed in how the panels are read."); } },
    ],
  },
];

// ---------------------------------------------------------------------------
// Seção G: fontes principais por tema (id do conjunto em publicacao.json)
// ---------------------------------------------------------------------------

export type FontePrincipal = { id: string; rotulo: string };

export const FONTES_PRINCIPAIS: { tema: string; href: string; conjuntos: FontePrincipal[] }[] = [
  {
    get tema() { return tx("Água e clima", "Water and climate"); },
    href: "/setor-eletrico/agua-e-clima",
    conjuntos: [
      { id: "energia/ear_subsistema_di", get rotulo() { return tx("Energia armazenada por subsistema (ONS)", "Stored energy by subsystem (ONS)"); } },
      { id: "energia/ena_subsistema_di", get rotulo() { return tx("Energia natural afluente por subsistema (ONS)", "Natural inflow energy by subsystem (ONS)"); } },
    ],
  },
  {
    get tema() { return tx("Geração", "Generation"); },
    href: "/setor-eletrico/geracao",
    conjuntos: [
      { id: "energia/balanco_energia_subsistema_ho", get rotulo() { return tx("Balanço de energia nos subsistemas (ONS)", "Energy balance in the subsystems (ONS)"); } },
      { id: "ons_geracao/ons_coff_eolica", get rotulo() { return tx("Restrição de geração eólica (ONS)", "Wind generation restriction (ONS)"); } },
    ],
  },
  { get tema() { return tx("Carga", "Load"); }, href: "/setor-eletrico/carga", conjuntos: [{ id: "energia/carga_energia_di", get rotulo() { return tx("Carga de energia diária (ONS)", "Daily energy load (ONS)"); } }] },
  { get tema() { return tx("Rede", "Grid"); }, href: "/setor-eletrico/rede", conjuntos: [{ id: "energia/intercambio_nacional_ho", get rotulo() { return tx("Intercâmbio entre subsistemas (ONS)", "Interchange between subsystems (ONS)"); } }] },
  {
    get tema() { return tx("PLD e CMO", "PLD and CMO"); },
    href: "/setor-eletrico/pld",
    conjuntos: [
      { id: "energia/ccee_pld_horario", get rotulo() { return tx("PLD horário por submercado (CCEE)", "Hourly PLD by submarket (CCEE)"); } },
      { id: "energia/cmo_se", get rotulo() { return tx("CMO semanal por subsistema (ONS)", "Weekly CMO by subsystem (ONS)"); } },
    ],
  },
  {
    get tema() { return tx("Mercado", "Market"); },
    href: "/setor-eletrico/mercado",
    conjuntos: [
      { id: "mercado/ccee_sumario_mensal_liquidacao", get rotulo() { return tx("Sumário mensal da liquidação (CCEE)", "Monthly settlement summary (CCEE)"); } },
      { id: "mercado/epe_consumo_mensal", get rotulo() { return tx("Consumo mensal de energia elétrica (EPE)", "Monthly electricity consumption (EPE)"); } },
    ],
  },
  {
    get tema() { return tx("Conta de luz", "Electricity bill"); },
    href: "/setor-eletrico/conta-de-luz",
    conjuntos: [
      { id: "aneel_tarifas/aneel_tarifas_aplicacao", get rotulo() { return tx("Tarifas de aplicação das distribuidoras (ANEEL)", "Applicable tariffs of the distribution utilities (ANEEL)"); } },
      { id: "aneel_tarifas/aneel_bandeiras_tarifarias", get rotulo() { return tx("Bandeiras tarifárias (ANEEL)", "Tariff flags (ANEEL)"); } },
    ],
  },
  { get tema() { return tx("Perdas", "Losses"); }, href: "/setor-eletrico/perdas", conjuntos: [{ id: "aneel_distribuicao/aneel_samp_balanco", get rotulo() { return tx("Balanço energético das distribuidoras (ANEEL)", "Energy balance of the distribution utilities (ANEEL)"); } }] },
  { get tema() { return tx("Qualidade", "Quality of supply"); }, href: "/setor-eletrico/qualidade", conjuntos: [{ id: "aneel_qualidade/aneel_continuidade", get rotulo() { return tx("Indicadores coletivos de continuidade, DEC e FEC (ANEEL)", "Collective continuity indicators, DEC and FEC (ANEEL)"); } }] },
  {
    get tema() { return tx("Inclusão energética", "Energy inclusion"); },
    href: "/setor-eletrico/inclusao-energetica",
    conjuntos: [
      { id: "aneel_social/aneel_scs", get rotulo() { return tx("Tarifa Social por distribuidora (ANEEL)", "Tarifa Social by distribution utility (ANEEL)"); } },
      { id: "aneel_social/ibge_pnadc_energia", get rotulo() { return tx("PNAD Contínua: energia nos domicílios (IBGE)", "Continuous PNAD: energy in households (IBGE)"); } },
    ],
  },
  { get tema() { return tx("Empresas", "Companies"); }, href: "/setor-eletrico/empresas", conjuntos: [{ id: "empresas/cvm_itr", get rotulo() { return tx("Informações trimestrais das companhias abertas (CVM)", "Quarterly information of listed companies (CVM)"); } }] },
  { get tema() { return tx("Expansão", "Expansion"); }, href: "/setor-eletrico/expansao", conjuntos: [{ id: "aneel_geracao/aneel_ralie", get rotulo() { return tx("Acompanhamento da expansão da geração (ANEEL)", "Monitoring of generation expansion (ANEEL)"); } }] },
  {
    get tema() { return tx("Transição e ambiente", "Transition and environment"); },
    href: "/setor-eletrico/transicao",
    conjuntos: [
      { id: "aneel_mmgd/aneel_mmgd_empreendimentos", get rotulo() { return tx("Micro e minigeração distribuída (ANEEL)", "Distributed micro and mini generation (ANEEL)"); } },
      { id: "aneel_mmgd/mcti_fator_emissao", get rotulo() { return tx("Fatores de emissão do sistema interligado (MCTI)", "Emission factors of the interconnected system (MCTI)"); } },
    ],
  },
  { get tema() { return tx("Regulação", "Regulation"); }, href: "/setor-eletrico/regulacao", conjuntos: [{ id: "regulacao/aneel_audiencias_consultas", get rotulo() { return tx("Audiências e consultas públicas (ANEEL)", "Public hearings and consultations (ANEEL)"); } }] },
];

/** Âncoras da antiga página inicial (hoje Visão geral): um link antigo é levado à seção certa. */
export const ANCORAS_VISAO_GERAL = [
  "sistema",
  "agua",
  "agua-painel",
  "geracao",
  "geracao-painel",
  "consumo",
  "carga-painel",
  "rede",
  "rede-painel",
  "preco",
  "preco-painel",
  "observar",
];

/**
 * Ids das sete seções da inicial, na ordem em que aparecem: o hero com a busca e os caminhos, as seis perguntas, o mapa conceitual (a resposta
 * a "como o sistema se liga", antes do índice para não ficar telas abaixo), o índice completo, as trilhas, "Como ler e conferir" e as fontes com
 * a atualidade. Outras páginas apontam para estes ids (por exemplo, o Aprenda leva a #mapa-conceitual), e o link antigo de qualquer um deles
 * continua abrindo a seção.
 */
export const SECOES_HOME = [
  { id: "proposito", get rotulo() { return tx("Para que serve", "What it is for"); } },
  { id: "mapa-conceitual", get rotulo() { return tx("Como as partes se ligam", "How the parts fit together"); } },
  { id: "perguntas", get rotulo() { return tx("Seis perguntas para começar", "Six questions to start with"); } },
  { id: "destinos", get rotulo() { return tx("Todas as páginas, por tema", "All pages, by topic"); } },
  { id: "trilhas", get rotulo() { return tx("Trilhas de leitura", "Reading paths"); } },
  { id: "como-confiar", get rotulo() { return tx("Como ler e conferir", "How to read and check"); } },
  { id: "aprofundar", get rotulo() { return tx("Fontes e atualidade", "Sources and timeliness"); } },
] as const;
