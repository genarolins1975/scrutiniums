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
 */

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
  { id: "acompanhar", titulo: "Acompanhar o sistema", descricao: "Preço, água, geração, carga e rede, cada um com a sua data.", slugs: ["visao-geral"] },
  { id: "regiao", titulo: "Explorar uma região", descricao: "Submercado, distribuidora, município e usinas no mesmo mapa, cada número no seu grão.", slugs: ["territorio"] },
  { id: "sistema", titulo: "Entender como o sistema se liga", descricao: "Sete elos, da água à vida das pessoas, no mapa logo abaixo das seis perguntas.", slugs: [], ancora: "#mapa-conceitual" },
  { id: "aprender", titulo: "Aprender um conceito", descricao: "Verbetes com a definição da fonte oficial e o painel onde cada conceito aparece.", slugs: ["aprenda"] },
  { id: "conferir", titulo: "Conferir ou baixar os dados", descricao: "A fonte, o arquivo e o cálculo de cada número, e os conjuntos para baixar.", slugs: ["dados", "metodologia"] },
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
    pergunta: "Quanto custa a energia numa residência?",
    importa: "Para comparar a tarifa que a ANEEL fixa para cada distribuidora, antes de tributos.",
    slug: "conta-de-luz",
    link: { rotulo: "Comparar as tarifas das distribuidoras", href: "/setor-eletrico/conta-de-luz#tarifa" },
    porDistribuidora: { tema: "conta", parametro: "dist", rotuloEscolhida: "Ver a tarifa de {sigla} em Conta de luz" },
  },
  {
    id: "qualidade",
    pergunta: "Quanto tempo falta energia?",
    importa: "Para saber quanto tempo, no ano, a unidade consumidora média ficou sem energia.",
    slug: "qualidade",
    link: { rotulo: "Ver a duração e a frequência das interrupções", href: "/setor-eletrico/qualidade#p051" },
    porDistribuidora: { tema: "qualidade", parametro: "dist", rotuloEscolhida: "Ver as interrupções de {sigla} em Qualidade" },
  },
  {
    id: "perdas",
    pergunta: "Quanta energia se perde na distribuição?",
    importa: "Para ver quanta da energia que entra na rede da distribuidora não chega ao consumidor.",
    slug: "perdas",
    link: { rotulo: "Ver as perdas no mapa das distribuidoras", href: "/setor-eletrico/perdas#painel-mapa" },
    porDistribuidora: { tema: "perdas", parametro: "d", rotuloEscolhida: "Ver as perdas de {sigla} em Perdas" },
  },
  {
    id: "agua",
    pergunta: "Quanta energia está armazenada nos reservatórios?",
    importa: "Para ver quanta água há guardada, em energia, para as hidrelétricas gerarem.",
    slug: "agua-e-clima",
    link: { rotulo: "Comparar cada região com a mediana do dia", href: "/setor-eletrico/agua-e-clima#p017" },
  },
  {
    id: "pld",
    pergunta: "Quanto custa a energia no curto prazo?",
    importa: "Para ver o preço do dia no mercado em que se liquidam as diferenças de energia.",
    slug: "pld",
    link: { rotulo: "Ver o último dia nos quatro submercados", href: "/setor-eletrico/pld#hoje" },
  },
  {
    id: "expansao",
    pergunta: "O que está sendo construído?",
    importa: "Para ver as usinas em obra e a potência que a ANEEL autorizou para elas.",
    slug: "expansao",
    link: { rotulo: "Ver a carteira por estágio", href: "/setor-eletrico/expansao/carteira#p040" },
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
    pergunta: "Quantas unidades consumidoras têm desconto na conta?",
    importa: "Para ver o alcance da Tarifa Social, o desconto para famílias de baixa renda.",
    link: { rotulo: "Ver a Tarifa Social por distribuidora e estado", href: "/setor-eletrico/inclusao-energetica/tarifa-social#p059" },
  },
  {
    id: "acesso",
    pergunta: "Quantos domicílios ainda estão sem energia elétrica?",
    importa: "Para ver quem ainda não tem acesso à rede ou a outra fonte de energia em casa.",
    link: { rotulo: "Ver o acesso à energia por região e situação", href: "/setor-eletrico/inclusao-energetica/acesso#p062" },
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
  "visao-geral": { rotulo: "Visão geral", href: "/setor-eletrico/visao-geral", pergunta: "O que está acontecendo no sistema elétrico brasileiro?", estado: "integrado" },
  "agua-e-clima": { rotulo: "Água e clima", href: "/setor-eletrico/agua-e-clima", pergunta: "Quanta energia está armazenada?", estado: "integrado" },
  carga: { rotulo: "Carga", href: "/setor-eletrico/carga", pergunta: "Quanto o sistema está consumindo?", estado: "integrado" },
  rede: { rotulo: "Rede", href: "/setor-eletrico/rede", pergunta: "Como a energia circula entre regiões?", estado: "integrado" },
  pld: { rotulo: "PLD", href: "/setor-eletrico/pld", pergunta: "Quanto custa a energia no curto prazo?", estado: "integrado" },
  mercado: { rotulo: "Mercado", href: "/setor-eletrico/mercado", pergunta: "Como a energia é contratada, alocada e liquidada?", estado: "integrado" },
  empresas: { rotulo: "Empresas", href: "/setor-eletrico/empresas", pergunta: "Quem atua no setor elétrico?", estado: "integrado" },
  expansao: { rotulo: "Expansão", href: "/setor-eletrico/expansao", pergunta: "O que está sendo construído?", estado: "integrado" },
  regulacao: { rotulo: "Regulação", href: "/setor-eletrico/regulacao", pergunta: "Que regra vale em cada período?", estado: "integrado" },
  "conta-de-luz": { rotulo: "Conta de luz", href: "/setor-eletrico/conta-de-luz", pergunta: "Quanto custa o mesmo consumo?", estado: "integrado" },
  perdas: { rotulo: "Perdas", href: "/setor-eletrico/perdas", pergunta: "Onde a energia se perde?", estado: "integrado" },
  qualidade: { rotulo: "Qualidade", href: "/setor-eletrico/qualidade", pergunta: "Quanto tempo e quantas vezes falta luz?", estado: "integrado" },
  "inclusao-energetica": { rotulo: "Inclusão energética", href: "/setor-eletrico/inclusao-energetica", pergunta: "Para quem a energia pesa mais?", estado: "integrado" },
  transicao: { rotulo: "Transição e ambiente", href: "/setor-eletrico/transicao", pergunta: "Como a matriz está mudando?", estado: "integrado" },
  aprenda: { rotulo: "Aprenda", href: "/setor-eletrico/aprenda", pergunta: "O que cada conceito significa e onde aparece?", estado: "referencia" },
  dados: { rotulo: "Dados e catálogo", href: "/setor-eletrico/dados", pergunta: "O que é público sobre o setor elétrico, e o que já está integrado?", estado: "referencia" },
  metodologia: { rotulo: "Metodologia", href: "/setor-eletrico/metodologia", pergunta: "Como os números são produzidos, e o que eles não dizem?", estado: "referencia" },
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
  fisico: { rotulo: "Fluxo físico", definicao: "a energia, a água ou o combustível passa de um elo ao outro.", traco: "", espessura: 3.2, ponta: "seta" },
  operacao: { rotulo: "Decisão de operação", definicao: "o ONS usa a informação para programar e despachar o sistema.", traco: "10 6", espessura: 2, ponta: "seta-aberta" },
  mercado: { rotulo: "Regra de mercado", definicao: "uma regra de comercialização transforma uma grandeza em valor a liquidar.", traco: "12 4 2 4", espessura: 2, ponta: "losango" },
  custo: { rotulo: "Componente de custo", definicao: "o custo de um elo vira parcela de uma tarifa ou de uma conta, por regra regulatória.", traco: "1.5 4.5", espessura: 3, ponta: "quadrado" },
  associacao: { rotulo: "Associação analítica", definicao: "as grandezas costumam variar juntas; a associação não prova causa.", traco: "3 3", espessura: 1.6, ponta: "circulo" },
};

export type IdNo = "recursos" | "geracao" | "rede" | "consumo" | "operacao" | "contratos" | "pessoas";

/** As quatro faixas do mapa: o caminho físico da energia, quem coordena a operação, o caminho do dinheiro e o que chega às pessoas. */
export type FaixaMapa = "fisico" | "operacao" | "economia" | "pessoas";

export const ORDEM_FAIXAS: readonly FaixaMapa[] = ["fisico", "operacao", "economia", "pessoas"];

export const FAIXAS_MAPA: Record<FaixaMapa, { rotulo: string; resumo: string }> = {
  fisico: {
    rotulo: "Caminho físico",
    resumo: "A água, o vento, o sol e os combustíveis movem as usinas, e a rede leva a energia até o consumo.",
  },
  operacao: {
    rotulo: "Coordenação da operação",
    resumo: "O ONS programa quais usinas geram, e a CCEE calcula o preço das diferenças a partir do custo de operação.",
  },
  economia: {
    rotulo: "Relações econômicas",
    resumo: "Contratos, liquidação e tarifa formam um caminho contratual, que não reproduz o trajeto físico da eletricidade.",
  },
  pessoas: {
    rotulo: "Experiência das pessoas",
    resumo: "A conta de luz, o serviço que chega a cada casa e o acesso à energia.",
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
    titulo: "Água, vento, sol e clima",
    curto: "Os recursos que movem as usinas e o tempo que muda o consumo.",
    explicacao:
      "A água que chega e fica guardada nos reservatórios, o vento, o sol e os combustíveis são a matéria-prima da geração. A chuva e a temperatura também mudam quanto se consome. O observatório mede a água em energia: a Energia Armazenada (EAR) e a Energia Natural Afluente (ENA). E mostra chuva e temperatura por bacia e por região.",
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
    titulo: "Geração",
    curto: "As usinas que transformam os recursos em eletricidade.",
    explicacao:
      "Dois grupos entram aqui: as usinas centralizadas (hidrelétricas, eólicas, solares e térmicas), cuja geração o ONS verifica hora a hora, e a micro e minigeração distribuída, instalada em casas e empresas e ligada à rede de distribuição, que a ANEEL cadastra e o ONS estima. O observatório mostra quanto cada fonte entregou, por que as térmicas foram acionadas, quanta energia eólica e solar deixou de ser gerada por restrição e como a geração mexe nas emissões.",
    destinos: ["geracao", "transicao"],
    conceitos: [
      { slug: "geracao-centralizada", rotulo: "geração verificada" },
      { slug: "geracao-distribuida", rotulo: "MMGD" },
    ],
    pos: { x: 375, y: 130 },
  },
  {
    id: "rede",
    faixa: "fisico",
    titulo: "Rede de transmissão e distribuição",
    curto: "As linhas que levam a energia das usinas às regiões e às casas.",
    explicacao:
      "A transmissão liga as regiões e as grandes usinas; a distribuição leva a energia até cada consumidor. Parte da energia se perde no caminho, e a falha de um trecho interrompe o serviço. O observatório mostra os fluxos entre regiões, as restrições documentadas, as perdas e a qualidade do serviço de cada distribuidora.",
    destinos: ["rede", "perdas", "qualidade"],
    conceitos: [
      { slug: "intercambio", rotulo: "intercâmbio" },
      { slug: "perdas-de-energia", rotulo: "perdas" },
    ],
    pos: { x: 625, y: 130 },
  },
  {
    id: "consumo",
    faixa: "fisico",
    titulo: "Consumo (carga)",
    curto: "Quanto o sistema precisa atender, hora a hora.",
    explicacao:
      "A carga é a energia que o sistema interligado atende. Ela muda com a hora do dia, o dia da semana, os feriados e a temperatura. Segundo o ONS, a carga diária inclui, desde 29/04/2023, uma estimativa da micro e minigeração distribuída; na carga verificada (carga global), o ONS publica essa parcela à parte, e sem ela resta a carga líquida de MMGD. São leituras diferentes da carga, e a página de Carga as mostra separadas.",
    destinos: ["carga"],
    conceitos: [
      { slug: "carga", rotulo: "carga" },
      { slug: "carga-liquida-de-mmgd", rotulo: "carga líquida de MMGD" },
    ],
    pos: { x: 875, y: 130 },
  },
  {
    id: "operacao",
    faixa: "operacao",
    titulo: "Operação e preço de curto prazo",
    curto: "O ONS decide o despacho; a CCEE calcula o preço das diferenças.",
    explicacao:
      "O ONS programa quais usinas geram, buscando atender a carga ao menor custo com segurança, e publica o custo marginal de operação (CMO). A CCEE calcula, a partir do CMO e dentro de limites fixados pela ANEEL, o preço de curto prazo (PLD) de cada hora e submercado. O observatório também registra previsões do PLD e como elas se saíram.",
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
    titulo: "Contratos, mercado e tarifa",
    curto: "Como a energia é contratada, liquidada e transformada em tarifa.",
    explicacao:
      "Grandes consumidores contratam energia no mercado livre; as distribuidoras compram para os seus clientes no mercado regulado. As diferenças entre o contratado e o verificado são liquidadas na CCEE ao PLD. A tarifa do consumidor atendido pela distribuidora é homologada pela ANEEL e soma energia, transmissão, distribuição, perdas e encargos.",
    destinos: ["mercado", "conta-de-luz"],
    conceitos: [
      { slug: "mcp", rotulo: "MCP" },
      { slug: "tarifa-te-tusd", rotulo: "TE e TUSD" },
      { slug: "bandeira-tarifaria", rotulo: "bandeira" },
    ],
    pos: { x: 250, y: 590 },
  },
  {
    id: "pessoas",
    faixa: "pessoas",
    titulo: "Vida das pessoas",
    curto: "A conta, o serviço que chega e quem tem acesso.",
    explicacao:
      "Para quem usa a energia, o setor aparece na conta de luz, na frequência e na duração das faltas de energia, no peso da conta no orçamento e no acesso, que ainda falta em parte do país. O DEC e o FEC divulgados são os apurados: não incluem as interrupções que a regra exclui (emergência, dia crítico, origem externa e cortes pedidos pelo ONS), e o tempo total sem energia, somadas todas as origens, é maior. O observatório mostra a conta por distribuidora, a qualidade do serviço com as duas medidas, a Tarifa Social e o acesso à energia.",
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
  { de: "recursos", para: "geracao", tipo: "fisico", texto: "A água, o vento, o sol e os combustíveis movem as usinas." },
  {
    de: "geracao",
    para: "rede",
    tipo: "fisico",
    texto: "A energia gerada entra na rede de transmissão ou na de distribuição; a micro e minigeração distribuída entra pela distribuição.",
  },
  { de: "rede", para: "consumo", tipo: "fisico", texto: "A rede entrega a energia ao consumo; parte se perde no caminho." },
  {
    de: "recursos",
    para: "operacao",
    tipo: "operacao",
    texto: "Armazenamento e afluências entram como insumo nos modelos com que o ONS planeja a operação. Sozinhos, não determinam o preço.",
  },
  { de: "consumo", para: "operacao", tipo: "operacao", texto: "A carga prevista é insumo da programação da operação." },
  {
    de: "operacao",
    para: "geracao",
    tipo: "operacao",
    texto: "O ONS decide quais usinas geram, considerando custo, segurança e os limites da rede.",
  },
  {
    de: "rede",
    para: "operacao",
    tipo: "operacao",
    texto: "Os limites da transmissão restringem a operação. Uma diferença de preço entre submercados não prova, sozinha, congestionamento.",
  },
  {
    de: "operacao",
    para: "contratos",
    tipo: "mercado",
    texto: "A CCEE liquida ao PLD as diferenças entre o contratado e o verificado. O PLD não é a tarifa do consumidor atendido pela distribuidora.",
  },
  {
    de: "contratos",
    para: "pessoas",
    tipo: "custo",
    texto: "A tarifa homologada pela ANEEL (TE e TUSD), as bandeiras, os encargos e os tributos compõem a conta de luz.",
  },
  {
    de: "rede",
    para: "pessoas",
    tipo: "custo",
    texto: "Transmissão, distribuição e as perdas reconhecidas pela regulação são parcelas da tarifa; a qualidade do serviço chega a cada casa pela distribuição.",
  },
  {
    de: "recursos",
    para: "consumo",
    tipo: "associacao",
    texto: "Temperatura e calendário costumam acompanhar o consumo; o observatório mede a associação sem afirmar causa.",
  },
];

/** O que o mapa NÃO afirma (seção 6.2 B): aparece junto do diagrama e da versão em texto. */
export const O_QUE_O_MAPA_NAO_DIZ = [
  "Chuva não determina diretamente a conta de luz: entre uma e outra há operação, regras de mercado e regras tarifárias.",
  "O PLD não é tarifa: é o preço das diferenças liquidadas no mercado de curto prazo.",
  "Diferença de preço entre submercados não prova congestionamento da rede.",
  "Associação entre clima e consumo não é causa provada.",
];

export const TRANSVERSAIS: { titulo: string; texto: string; destinos: string[] }[] = [
  {
    titulo: "Empresas",
    texto: "Quem é dono das usinas, das linhas e das distribuidoras de cada elo, pelo Cadastro Nacional da Pessoa Jurídica (CNPJ).",
    destinos: ["empresas"],
  },
  {
    titulo: "Expansão",
    texto: "O que está sendo construído em geração e transmissão e quando deve entrar.",
    destinos: ["expansao"],
  },
  {
    titulo: "Regulação",
    texto: "As regras de cada elo, com data de publicação, vigência e efeito declarado.",
    destinos: ["regulacao"],
  },
  {
    titulo: "Dados e método",
    texto: "De onde vem cada número, como foi calculado e como reproduzi-lo.",
    destinos: ["dados", "metodologia"],
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
    utilidade: "Ter o contexto de preço, água, geração, consumo e rede antes de aprofundar, e saber onde olhar em seguida.",
    encontra: [
      { texto: "Síntese por regras fixas, com a evidência de cada número", href: "/setor-eletrico/visao-geral#sistema" },
      { texto: "Preço, água, geração, carga e rede lado a lado, cada um com a sua data", href: "/setor-eletrico/visao-geral#preco" },
      { texto: "O que observar: regras explícitas sobre os dados mais recentes", href: "/setor-eletrico/visao-geral#observar" },
    ],
    recorte: "Sistema interligado e as quatro regiões; dado diário ou mensal, conforme a fonte.",
  },
  territorio: {
    utilidade: "Ver o que os dados dizem sobre a sua região sem confundir o que é do município com o que é da distribuidora ou do submercado.",
    encontra: [
      { texto: "Mapa com camadas separadas: submercado, distribuidora, município e usinas", href: "/setor-eletrico/territorio" },
      { texto: "Busca de município, com links para os módulos de origem", href: "/setor-eletrico/territorio" },
    ],
    recorte: "Município, área da distribuidora, UF e submercado, cada indicador no grão da sua fonte.",
  },
  "agua-e-clima": {
    utilidade: "Saber se a água guardada e a que chega estão acima ou abaixo do usual para a época, com a régua de comparação explicada.",
    encontra: [
      { texto: "Energia armazenada (EAR) com a faixa do mesmo dia nos anos anteriores", href: "/setor-eletrico/agua-e-clima#p017" },
      { texto: "Energia afluente (ENA) em percentual da média de longo termo", href: "/setor-eletrico/agua-e-clima/afluencia#p018" },
      { texto: "Chuva e temperatura por bacia, estimadas por satélite e reanálise", href: "/setor-eletrico/agua-e-clima/chuva-e-temperatura#p019" },
      { texto: "Variação e balanço de cada reservatório", href: "/setor-eletrico/agua-e-clima/reservatorios#p020" },
    ],
    recorte: "Sistema interligado, subsistema, REE, bacia e reservatório; diário.",
    conceito: { slug: "ear", rotulo: "o que é EAR" },
  },
  geracao: {
    utilidade: "Ver quanto cada fonte entregou, por que as térmicas foram acionadas e quanta energia eólica e solar deixou de ser gerada por restrição.",
    encontra: [
      { texto: "Matriz efetiva por fonte, com e sem a micro e minigeração estimada", href: "/setor-eletrico/geracao" },
      { texto: "Despacho térmico pelos motivos declarados pelo ONS", href: "/setor-eletrico/geracao/termica#p022" },
      { texto: "Cortes de geração eólica e solar pelas razões oficiais, com o mapa das usinas", href: "/setor-eletrico/geracao/restricoes#p023" },
      { texto: "Potência instalada e fator de capacidade por fonte e por usina", href: "/setor-eletrico/geracao/capacidade#p024" },
    ],
    recorte: "Sistema interligado e subsistemas; usina para térmicas e cortes; horário, diário e mensal.",
    conceito: { slug: "geracao-centralizada", rotulo: "o que é geração verificada" },
  },
  carga: {
    utilidade: "Medir o consumo do sistema, comparar com períodos equivalentes e separar calendário, temperatura e micro e minigeração.",
    encontra: [
      { texto: "Carga diária por região em janelas comparáveis", href: "/setor-eletrico/carga#p025" },
      { texto: "Perfil horário e carga líquida da micro e minigeração", href: "/setor-eletrico/carga/perfil-horario#p026" },
      { texto: "Clima e calendário: decomposição avaliada fora da amostra", href: "/setor-eletrico/carga/clima-e-calendario#p027" },
    ],
    recorte: "Sistema interligado e subsistemas; horário e diário.",
    conceito: { slug: "carga", rotulo: "o que é carga" },
  },
  rede: {
    utilidade: "Entender para onde a energia flui entre as regiões e o que os documentos do ONS registram como restrição.",
    encontra: [
      { texto: "Fluxos por fronteira e saldo de cada subsistema", href: "/setor-eletrico/rede#p028" },
      { texto: "Balanço e intercâmbio com outros países, identidade por identidade", href: "/setor-eletrico/rede/balanco-e-exterior#p029" },
      { texto: "Horas acima do limite sistêmico e cortes de carga", href: "/setor-eletrico/rede/restricoes#p030" },
      { texto: "Intercâmbio verificado contra o programado", href: "/setor-eletrico/rede/programado#p031" },
    ],
    recorte: "Fronteiras entre subsistemas e interligações internacionais; horário.",
    conceito: { slug: "intercambio", rotulo: "o que é intercâmbio" },
  },
  pld: {
    utilidade: "Entender como o preço de curto prazo se forma, onde ele está diante do histórico e dos limites e quando as regiões se separam.",
    encontra: [
      { texto: "O PLD explicado em 90 segundos", href: "/setor-eletrico/pld#o-que-e" },
      { texto: "CMO e formação do preço", href: "/setor-eletrico/pld/cmo-e-formacao#p009" },
      { texto: "Limites, piso e tetos de cada ano", href: "/setor-eletrico/pld/limites#p010" },
      { texto: "Histórico e distribuição por mês e semana", href: "/setor-eletrico/pld/historico#p011" },
      { texto: "Diferenças regionais hora a hora", href: "/setor-eletrico/pld/diferencas-regionais#p012" },
    ],
    recorte: "Quatro submercados; horário, diário e mensal.",
    conceito: { slug: "pld", rotulo: "o que é PLD" },
  },
  "pld-modelos": {
    utilidade: "Ver o que se projeta para o PLD, com que método, e conferir no arquivo imutável como cada projeção se saiu.",
    encontra: [
      { texto: "Rodada mais recente: referência B0 por submercado e entrega", href: "/setor-eletrico/pld/previsoes#p013" },
      { texto: "Registro e fichas dos modelos", href: "/setor-eletrico/pld/modelos#p014" },
      { texto: "Arquivo imutável de emissões", href: "/setor-eletrico/pld/previsoes#p015" },
      { texto: "Desempenho fora da amostra e calibração", href: "/setor-eletrico/pld/modelos#p016" },
    ],
    recorte: "Submercado; entregas semanais e mensais.",
  },
  mercado: {
    utilidade: "Entender como a energia é contratada nos ambientes livre e regulado, quem são os agentes e o que custam o compartilhamento do risco hidrológico e os encargos.",
    encontra: [
      { texto: "Mercado livre e regulado no consumo, em três universos com perímetros diferentes", href: "/setor-eletrico/mercado#livre-regulado" },
      { texto: "Agentes, parcelas de carga, migrações e desligamentos", href: "/setor-eletrico/mercado/agentes#agentes" },
      { texto: "GSF do MRE e risco hidrológico do consumidor cativo", href: "/setor-eletrico/mercado/mre-e-gsf#mre-gsf" },
      { texto: "Encargos, liquidação e inadimplência", href: "/setor-eletrico/mercado/encargos#encargos" },
    ],
    recorte: "Brasil, região, subsistema, UF e distribuidora, conforme a fonte; mensal.",
    conceito: { slug: "mcp", rotulo: "o que é o mercado de curto prazo" },
  },
  "conta-de-luz": {
    utilidade: "Comparar a tarifa residencial entre distribuidoras, ver o que compõe a conta e estimar o valor para um consumo mensal.",
    encontra: [
      { texto: "Tarifa residencial de cada distribuidora", href: "/setor-eletrico/conta-de-luz#tarifa" },
      { texto: "Composição: energia, transmissão, distribuição, perdas e encargos", href: "/setor-eletrico/conta-de-luz#composicao" },
      { texto: "Simulação da conta por consumo mensal", href: "/setor-eletrico/conta-de-luz#simulador" },
      { texto: "Reajustes, bandeiras e subsídios", href: "/setor-eletrico/conta-de-luz/reajustes-e-subsidios#p050" },
    ],
    recorte: "Distribuidora e vigência tarifária; bandeira por mês.",
    conceito: { slug: "tarifa-te-tusd", rotulo: "o que são TE e TUSD" },
  },
  perdas: {
    utilidade: "Saber quanto cada distribuidora perde, separar o técnico do não técnico e ver o percentual técnico regulatório.",
    encontra: [
      { texto: "Mapa e evolução das perdas por distribuidora", href: "/setor-eletrico/perdas#painel-mapa" },
      { texto: "Composição técnica e não técnica", href: "/setor-eletrico/perdas/composicao#painel-composicao" },
      { texto: "Percentual técnico regulatório por distribuidora", href: "/setor-eletrico/perdas/regulatorio#painel-regulatorio" },
      { texto: "Custo e contexto territorial", href: "/setor-eletrico/perdas/custo-e-contexto#painel-custo" },
    ],
    recorte: "Distribuidora, com a área desenhada por municípios inteiros; anual e mensal.",
    conceito: { slug: "perdas-de-energia", rotulo: "o que são perdas" },
  },
  qualidade: {
    utilidade: "Comparar quanto tempo e quantas vezes falta energia em cada distribuidora e conjunto, diante dos limites, e o que é pago em compensação.",
    encontra: [
      { texto: "DEC e FEC do Brasil, das distribuidoras e dos conjuntos", href: "/setor-eletrico/qualidade#p051" },
      { texto: "Distribuidoras diante do próprio limite", href: "/setor-eletrico/qualidade#p052" },
      { texto: "Quanto as regras tiram do tempo apurado", href: "/setor-eletrico/qualidade#expurgos" },
      { texto: "Compensações pagas por violação de limite", href: "/setor-eletrico/qualidade#p053" },
      { texto: "Atendimento e recuperação da rede", href: "/setor-eletrico/qualidade#p054" },
    ],
    recorte: "Brasil, distribuidora e conjunto elétrico; mensal e anual.",
    conceito: { slug: "dec", rotulo: "o que é DEC" },
  },
  "inclusao-energetica": {
    utilidade: "Ver quem recebe a Tarifa Social, onde a cobertura potencial parece baixa, quanto a energia pesa no orçamento e onde ainda falta acesso.",
    encontra: [
      { texto: "Tarifa Social: unidades atendidas e descontos", href: "/setor-eletrico/inclusao-energetica/tarifa-social#p059" },
      { texto: "Cobertura potencial por município, com o denominador declarado", href: "/setor-eletrico/inclusao-energetica/cobertura#p060" },
      { texto: "Peso da energia no orçamento das famílias", href: "/setor-eletrico/inclusao-energetica/orcamento#p061" },
      { texto: "Acesso à energia e sistemas isolados", href: "/setor-eletrico/inclusao-energetica/acesso#p062" },
    ],
    recorte: "Brasil, UF, município e distribuidora, conforme a fonte; mensal e anual.",
    conceito: { slug: "tarifa-social", rotulo: "o que é Tarifa Social" },
  },
  empresas: {
    utilidade: "Saber quem controla usinas, linhas e distribuidoras, como a potência se concentra e o que as companhias abertas publicam.",
    encontra: [
      { texto: "Ativos por proprietário: usinas e transmissão", href: "/setor-eletrico/empresas/ativos#p036" },
      { texto: "Ficha de cada distribuidora pelo CNPJ", href: "/setor-eletrico/empresas/distribuidoras#p037" },
      { texto: "Demonstrações das companhias abertas", href: "/setor-eletrico/empresas/financas#p038" },
      { texto: "Controle e concentração", href: "/setor-eletrico/empresas/controle#p039" },
    ],
    recorte: "CNPJ, grupo de controle e distribuidora; mensal e trimestral.",
  },
  expansao: {
    utilidade: "Acompanhar o que está sendo construído em geração e transmissão, quando deve entrar e quanto os prazos têm se deslocado.",
    encontra: [
      { texto: "Carteira de projetos de geração por estágio", href: "/setor-eletrico/expansao/carteira#p040" },
      { texto: "Cronograma e desvios de prazo", href: "/setor-eletrico/expansao/cronograma#p041" },
      { texto: "Geração e transmissão por UF e ano", href: "/setor-eletrico/expansao/geracao-e-transmissao#p042" },
      { texto: "Cenários oficiais de expansão", href: "/setor-eletrico/expansao/cenarios#p043" },
    ],
    recorte: "Usina, UF e linha de transmissão; mensal e anual.",
  },
  transicao: {
    utilidade: "Ver onde a micro e minigeração distribuída cresce e como evolui a intensidade de emissões da geração do sistema interligado.",
    encontra: [
      { texto: "Micro e minigeração por município e fonte", href: "/setor-eletrico/transicao/mmgd#p063" },
      { texto: "Intensidade de emissões do sistema interligado", href: "/setor-eletrico/transicao/emissoes#p064" },
      { texto: "Energia estimada da micro e minigeração na carga", href: "/setor-eletrico/transicao/energia-estimada#energia-estimada" },
    ],
    recorte: "Município, UF e sistema interligado; mensal e anual.",
    conceito: { slug: "fator-de-emissao", rotulo: "o que é fator de emissão" },
  },
  regulacao: {
    utilidade: "Situar uma regra no tempo: quando foi publicada, desde quando vale, o que mudou e qual efeito a própria fonte declara.",
    encontra: [
      { texto: "Limites do PLD e adicionais das bandeiras por vigência", href: "/setor-eletrico/regulacao#p044" },
      { texto: "Linha do tempo das regras", href: "/setor-eletrico/regulacao/linha-do-tempo#p045" },
      { texto: "Consultas públicas e Agenda Regulatória", href: "/setor-eletrico/regulacao/consultas-e-agenda#p046" },
    ],
    recorte: "Ato, tema e vigência; por data.",
    conceito: { slug: "agenda-regulatoria", rotulo: "o que é a Agenda Regulatória" },
  },
  aprenda: {
    utilidade: "Aprender os conceitos com a definição da fonte oficial e voltar ao painel onde cada um aparece.",
    encontra: [
      { texto: "Verbetes por tema, com fonte primária e trecho citado", href: "/setor-eletrico/aprenda" },
      { texto: "Dica curta ao passar sobre as siglas em todas as páginas", href: "/setor-eletrico/aprenda" },
    ],
    recorte: "Conceito.",
  },
  dados: {
    utilidade: "Encontrar o conjunto de origem de um número, ver o estado de cada fonte e baixar os arquivos para reproduzir.",
    encontra: [
      { texto: "Catálogo de conjuntos com a escada de estados, do catalogado ao publicado", href: "/setor-eletrico/dados#catalogo" },
      { texto: "Saúde das fontes: o que atrasou, falhou ou foi revisado", href: "/setor-eletrico/dados/saude#saude" },
      { texto: "Download e reprodução: sha256 de cada arquivo e conferência do que você baixou", href: "/setor-eletrico/dados/reproducao#reproducao" },
      { texto: "Ficha de cada conjunto com capturas e sha256", href: "/setor-eletrico/dados/ccee-pld-horario" },
    ],
    recorte: "Conjunto, arquivo e captura.",
  },
  metodologia: {
    utilidade: "Ver como cada número é produzido, que natureza ele tem e o que não se pode concluir a partir dele.",
    encontra: [
      { texto: "Regras por indicador: definição, unidade, recortes, cálculo e limites", href: "/setor-eletrico/metodologia#regras" },
      { texto: "Natureza de cada dado: observado, calculado, estimado, previsto e cenário", href: "/setor-eletrico/metodologia#natureza" },
      { texto: "Unidades e como lê-las", href: "/setor-eletrico/metodologia#unidades" },
      { texto: "Linhagem: do arquivo da fonte à página", href: "/setor-eletrico/metodologia#linhagem" },
      { texto: "Limitações conhecidas", href: "/setor-eletrico/metodologia#limitacoes" },
      { texto: "Avaliação dos painéis: nota de cada página por dimensão, com a evidência e os defeitos abertos", href: "/setor-eletrico/metodologia/avaliacao#avaliacao" },
    ],
    recorte: "Indicador e regra.",
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
    pergunta: "Minha distribuidora perde muita energia?",
    resposta: "Perdas mostra a taxa de cada distribuidora, a evolução e o percentual técnico regulatório. Perda não técnica não é sinônimo de furto.",
    destinos: [{ rotulo: "Perdas", href: "/setor-eletrico/perdas#painel-mapa" }],
    porDistribuidora: "perdas",
  },
  {
    pergunta: "O serviço da minha distribuidora melhorou?",
    resposta: "Qualidade mostra quanto tempo (DEC) e quantas vezes (FEC) falta energia em cada distribuidora, ano a ano, e o limite fixado para ela.",
    destinos: [{ rotulo: "Qualidade", href: "/setor-eletrico/qualidade#p051" }],
    porDistribuidora: "qualidade",
  },
  {
    pergunta: "Por que a conta de luz subiu?",
    resposta: "Conta de luz mostra o que mudou em cada componente da tarifa, a bandeira de cada mês e os subsídios. A página separa as mudanças; não atribui causa automaticamente.",
    destinos: [{ rotulo: "Reajustes, bandeiras e subsídios", href: "/setor-eletrico/conta-de-luz/reajustes-e-subsidios#reajustes" }],
  },
  {
    pergunta: "O preço de curto prazo está alto para esta época?",
    resposta: "O histórico do PLD põe cada dia no percentil do mesmo mês e da mesma semana nos anos anteriores, por regime de limites.",
    destinos: [{ rotulo: "PLD, histórico e distribuição", href: "/setor-eletrico/pld/historico#p011" }],
  },
  {
    pergunta: "A água nos reservatórios está acima do normal?",
    resposta: "Água e clima compara a energia armazenada com a faixa do mesmo dia nos anos anteriores, por subsistema.",
    destinos: [{ rotulo: "Água e clima", href: "/setor-eletrico/agua-e-clima#p017" }],
  },
  {
    pergunta: "Por que há corte de geração renovável?",
    resposta: "Geração mostra a energia eólica e solar não gerada pelas razões oficiais do ONS; Rede mostra as restrições documentadas.",
    destinos: [
      { rotulo: "Geração", href: "/setor-eletrico/geracao" },
      { rotulo: "Restrições da rede", href: "/setor-eletrico/rede/restricoes#p030" },
    ],
  },
  {
    pergunta: "Onde estão as novas usinas?",
    resposta: "Expansão mostra as usinas em construção e outorgadas no mapa, com o estágio e a previsão de entrada.",
    destinos: [{ rotulo: "Mapa das usinas", href: "/setor-eletrico/expansao/carteira#mapa-usinas" }],
  },
  {
    pergunta: "Quem recebe os benefícios e onde pode haver falta de cobertura?",
    resposta: "Inclusão mostra quem recebe a Tarifa Social e uma medida de cobertura potencial por município, com o denominador do Cadastro Único declarado como aproximação.",
    destinos: [
      { rotulo: "Tarifa Social", href: "/setor-eletrico/inclusao-energetica/tarifa-social#p059" },
      { rotulo: "Cobertura potencial", href: "/setor-eletrico/inclusao-energetica/cobertura#p060" },
    ],
  },
  {
    pergunta: "Quero baixar a série e reproduzir o gráfico.",
    resposta: "Dados lista cada conjunto com arquivos para baixar; o modo Auditar de cada página mostra fórmula, versão e reprodução.",
    destinos: [
      { rotulo: "Dados", href: "/setor-eletrico/dados" },
      { rotulo: "PLD no modo Auditar", href: "/setor-eletrico/pld?modo=auditar" },
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
    perfil: "Estou começando",
    para: "Para quem quer entender o quadro geral sem jargão e saber onde achar cada número.",
    minutos: 20,
    paradas: [
      { rotulo: "Visão geral", href: "/setor-eletrico/visao-geral", aprende: "o que está acontecendo agora, em frases com a evidência de cada número." },
      { rotulo: "PLD em 90 segundos", href: "/setor-eletrico/pld#o-que-e", aprende: "o que é o preço de curto prazo e por que ele não é a tarifa." },
      { rotulo: "Água e clima", href: "/setor-eletrico/agua-e-clima#p017", aprende: "por que a água guardada importa e como compará-la com o usual." },
      { rotulo: "Conta de luz", href: "/setor-eletrico/conta-de-luz#composicao", aprende: "o que compõe a conta que chega em casa." },
      { rotulo: "Aprenda", href: "/setor-eletrico/aprenda", aprende: "os conceitos, cada um com a definição da fonte oficial." },
    ],
  },
  {
    id: "consumidor",
    perfil: "Sou consumidor",
    para: "Para quem quer entender a própria conta, o serviço que recebe e os direitos de quem tem menos renda.",
    minutos: 15,
    paradas: [
      { rotulo: "Conta de luz", href: "/setor-eletrico/conta-de-luz#simulador", aprende: "a tarifa da sua distribuidora e o valor estimado para o seu consumo." },
      { rotulo: "Reajustes e bandeiras", href: "/setor-eletrico/conta-de-luz/reajustes-e-subsidios#bandeiras", aprende: "o que mudou na tarifa e qual bandeira valeu em cada mês." },
      { rotulo: "Qualidade", href: "/setor-eletrico/qualidade#p052", aprende: "quanto falta energia na sua distribuidora diante do limite." },
      { rotulo: "Perdas", href: "/setor-eletrico/perdas#painel-mapa", aprende: "quanto a sua distribuidora perde, a evolução e o percentual técnico regulatório." },
      { rotulo: "Tarifa Social", href: "/setor-eletrico/inclusao-energetica/tarifa-social#p059", aprende: "quem recebe o desconto e como a cobertura varia." },
      { rotulo: "Ficha da distribuidora", href: "/setor-eletrico/empresas/distribuidoras#p037", aprende: "perdas, continuidade, tarifa e controle no mesmo lugar, pelo CNPJ." },
    ],
  },
  {
    id: "analista",
    perfil: "Analiso o setor",
    para: "Para quem atua em comercialização, geração, consumo livre ou planejamento e quer séries, comparações e regras.",
    minutos: 40,
    paradas: [
      { rotulo: "PLD, histórico", href: "/setor-eletrico/pld/historico?modo=analisar#p011", aprende: "o preço no percentil sazonal e por regime de limites." },
      { rotulo: "PLD, diferenças regionais", href: "/setor-eletrico/pld/diferencas-regionais#p012", aprende: "quando e quanto os submercados se separam, hora a hora." },
      { rotulo: "Rede", href: "/setor-eletrico/rede#p028", aprende: "os fluxos entre regiões e as restrições documentadas." },
      { rotulo: "Água e clima, afluência", href: "/setor-eletrico/agua-e-clima/afluencia#p018", aprende: "a ENA diante da média de longo termo e a versão da referência." },
      { rotulo: "Geração", href: "/setor-eletrico/geracao", aprende: "o despacho térmico por motivo e os cortes de renováveis." },
      { rotulo: "Regulação, limites do PLD", href: "/setor-eletrico/regulacao#p044", aprende: "o piso e os tetos de cada ano, com o ato e a vigência." },
      { rotulo: "Previsões e modelos", href: "/setor-eletrico/pld/modelos#p016", aprende: "como as previsões se saíram fora da amostra." },
    ],
  },
  {
    id: "ensino",
    perfil: "Ensino ou pesquiso",
    para: "Para quem precisa citar, reproduzir e explicar de onde vem cada número.",
    minutos: 30,
    paradas: [
      { rotulo: "Metodologia", href: "/setor-eletrico/metodologia#natureza", aprende: "a natureza de cada dado e a linhagem do arquivo à página." },
      { rotulo: "Dados", href: "/setor-eletrico/dados", aprende: "o catálogo, o estado de cada conjunto e os arquivos para baixar." },
      { rotulo: "Comprove um número em Perdas", href: "/setor-eletrico/perdas#painel-mapa", aprende: "como a ficha de um número mostra fonte, fórmula, sha256 e citação." },
      { rotulo: "Modelos do PLD", href: "/setor-eletrico/pld/modelos#p014", aprende: "as fichas dos modelos e a reexecução das previsões." },
      { rotulo: "Arquivo de emissões", href: "/setor-eletrico/pld/previsoes#p015", aprende: "por que um registro de previsão nunca é reescrito." },
      { rotulo: "Linha do tempo das regras", href: "/setor-eletrico/regulacao/linha-do-tempo#p045", aprende: "quando cada regra passou a valer e o que mudou na leitura dos painéis." },
    ],
  },
];

// ---------------------------------------------------------------------------
// Seção G: fontes principais por tema (id do conjunto em publicacao.json)
// ---------------------------------------------------------------------------

export type FontePrincipal = { id: string; rotulo: string };

export const FONTES_PRINCIPAIS: { tema: string; href: string; conjuntos: FontePrincipal[] }[] = [
  {
    tema: "Água e clima",
    href: "/setor-eletrico/agua-e-clima",
    conjuntos: [
      { id: "energia/ear_subsistema_di", rotulo: "Energia armazenada por subsistema (ONS)" },
      { id: "energia/ena_subsistema_di", rotulo: "Energia natural afluente por subsistema (ONS)" },
    ],
  },
  {
    tema: "Geração",
    href: "/setor-eletrico/geracao",
    conjuntos: [
      { id: "energia/balanco_energia_subsistema_ho", rotulo: "Balanço de energia nos subsistemas (ONS)" },
      { id: "ons_geracao/ons_coff_eolica", rotulo: "Restrição de geração eólica (ONS)" },
    ],
  },
  { tema: "Carga", href: "/setor-eletrico/carga", conjuntos: [{ id: "energia/carga_energia_di", rotulo: "Carga de energia diária (ONS)" }] },
  { tema: "Rede", href: "/setor-eletrico/rede", conjuntos: [{ id: "energia/intercambio_nacional_ho", rotulo: "Intercâmbio entre subsistemas (ONS)" }] },
  {
    tema: "PLD e CMO",
    href: "/setor-eletrico/pld",
    conjuntos: [
      { id: "energia/ccee_pld_horario", rotulo: "PLD horário por submercado (CCEE)" },
      { id: "energia/cmo_se", rotulo: "CMO semanal por subsistema (ONS)" },
    ],
  },
  {
    tema: "Mercado",
    href: "/setor-eletrico/mercado",
    conjuntos: [
      { id: "mercado/ccee_sumario_mensal_liquidacao", rotulo: "Sumário mensal da liquidação (CCEE)" },
      { id: "mercado/epe_consumo_mensal", rotulo: "Consumo mensal de energia elétrica (EPE)" },
    ],
  },
  {
    tema: "Conta de luz",
    href: "/setor-eletrico/conta-de-luz",
    conjuntos: [
      { id: "aneel_tarifas/aneel_tarifas_aplicacao", rotulo: "Tarifas de aplicação das distribuidoras (ANEEL)" },
      { id: "aneel_tarifas/aneel_bandeiras_tarifarias", rotulo: "Bandeiras tarifárias (ANEEL)" },
    ],
  },
  { tema: "Perdas", href: "/setor-eletrico/perdas", conjuntos: [{ id: "aneel_distribuicao/aneel_samp_balanco", rotulo: "Balanço energético das distribuidoras (ANEEL)" }] },
  { tema: "Qualidade", href: "/setor-eletrico/qualidade", conjuntos: [{ id: "aneel_qualidade/aneel_continuidade", rotulo: "Indicadores coletivos de continuidade, DEC e FEC (ANEEL)" }] },
  {
    tema: "Inclusão energética",
    href: "/setor-eletrico/inclusao-energetica",
    conjuntos: [
      { id: "aneel_social/aneel_scs", rotulo: "Tarifa Social por distribuidora (ANEEL)" },
      { id: "aneel_social/ibge_pnadc_energia", rotulo: "PNAD Contínua: energia nos domicílios (IBGE)" },
    ],
  },
  { tema: "Empresas", href: "/setor-eletrico/empresas", conjuntos: [{ id: "empresas/cvm_itr", rotulo: "Informações trimestrais das companhias abertas (CVM)" }] },
  { tema: "Expansão", href: "/setor-eletrico/expansao", conjuntos: [{ id: "aneel_geracao/aneel_ralie", rotulo: "Acompanhamento da expansão da geração (ANEEL)" }] },
  {
    tema: "Transição e ambiente",
    href: "/setor-eletrico/transicao",
    conjuntos: [
      { id: "aneel_mmgd/aneel_mmgd_empreendimentos", rotulo: "Micro e minigeração distribuída (ANEEL)" },
      { id: "aneel_mmgd/mcti_fator_emissao", rotulo: "Fatores de emissão do sistema interligado (MCTI)" },
    ],
  },
  { tema: "Regulação", href: "/setor-eletrico/regulacao", conjuntos: [{ id: "regulacao/aneel_audiencias_consultas", rotulo: "Audiências e consultas públicas (ANEEL)" }] },
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
  { id: "proposito", rotulo: "Para que serve" },
  { id: "perguntas", rotulo: "Seis perguntas para começar" },
  { id: "mapa-conceitual", rotulo: "Como as partes se ligam" },
  { id: "destinos", rotulo: "Todas as páginas, por tema" },
  { id: "trilhas", rotulo: "Trilhas de leitura" },
  { id: "como-confiar", rotulo: "Como ler e conferir" },
  { id: "aprofundar", rotulo: "Fontes e atualidade" },
] as const;
