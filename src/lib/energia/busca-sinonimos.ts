import type { Idioma } from "@/lib/idioma";
import { idiomaEnergia } from "@/lib/energia/idioma";
import { montarNosDoisIdiomas, type TxIdioma } from "@/lib/energia/i18n/aprenda";

/**
 * Vocabulário de quem procura sem conhecer a sigla: "preço da luz", "apagão", "gato de energia", "congestionamento". Cada
 * grupo liga alguns desses nomes aos destinos que de fato tratam do assunto; a busca da página inicial os trata como um nome a mais do
 * item, logo abaixo do título (busca.ts), e mostra ao leitor o termo que casou.
 *
 * Regras de manutenção:
 *  - o alvo é o endereço exato de um item do índice (página, painel, pergunta ou verbete); um endereço que o índice não
 *    tem deixa de contar, e o teste acusa, para a busca nunca prometer um destino que não existe;
 *  - o termo é o que o leitor diria, e não o nome técnico (o nome técnico já está no título do item);
 *  - o termo leva ao lugar onde o assunto é tratado, mesmo quando a página explica que não mede o que o termo sugere: quem
 *    procura "congestionamento" chega aos fluxos e às diferenças de preço, onde está escrito que o observatório não classifica
 *    hora congestionada;
 *  - nenhum termo afirma uma causa nem dá o assunto por medido: "apagão" leva às interrupções e aos cortes de carga que o
 *    observatório mostra, e a página diz o que cada um mede; "racionamento" leva ao armazenamento dos reservatórios e aos cortes de carga
 *    pedidos pelo ONS, e as duas páginas dizem que o percentual não mede risco de desabastecimento.
 */
export type GrupoDeSinonimos = {
  /** Endereços exatos dos itens do índice que respondem ao assunto. */
  alvos: string[];
  /** Como o leitor chama o assunto. */
  termos: string[];
};

const S = "/setor-eletrico";

function montarSinonimosBusca(tx: TxIdioma): readonly GrupoDeSinonimos[] {
  return [
    // conta de luz
    {
      alvos: [`${S}/conta-de-luz`, `${S}/conta-de-luz#tarifa`], // i18n: dado
      termos: [tx("preço da luz", "electricity price"), tx("preço da energia", "energy price"), tx("preço da conta de luz", "electricity bill price"), tx("valor da conta de luz", "electricity bill amount"), tx("conta de energia", "energy bill"), tx("fatura de luz", "electricity invoice"), tx("quanto pago de luz", "how much I pay for electricity"), tx("tarifa de energia", "energy tariff")],
    },
    { alvos: [`${S}/conta-de-luz#simulador`], termos: [tx("simular a conta", "simulate the bill"), tx("calcular a conta de luz", "calculate the electricity bill"), tx("quanto vou pagar de luz", "how much will I pay for electricity")] }, // i18n: dado
    { alvos: [`${S}/conta-de-luz/reajustes-e-subsidios#p050`, `${S}/aprenda/bandeira-tarifaria`], termos: [tx("bandeira vermelha", "red flag"), tx("bandeira amarela", "yellow flag"), tx("bandeira verde", "green flag"), tx("aumento da conta de luz", "electricity bill increase"), tx("reajuste da tarifa", "tariff adjustment")] }, // i18n: dado
    // qualidade do serviço
    {
      alvos: [`${S}/qualidade`, `${S}/qualidade#p051`],
      termos: [tx("falta de luz", "power outage"), tx("falta de energia", "electricity outage"), tx("queda de energia", "power cut"), tx("queda de luz", "power failure"), tx("luz caiu", "power went out"), tx("energia caiu", "electricity went out"), tx("sem luz", "no power"), tx("interrupção de energia", "electricity interruption"), tx("apagão", "blackout"), tx("blecaute", "power blackout")],
    },
    { alvos: [`${S}/aprenda/dec`], termos: [tx("tempo sem energia", "time without electricity"), tx("tempo sem luz", "time without power"), tx("duração das faltas de energia", "duration of power outages"), tx("horas sem luz", "hours without power")] },
    { alvos: [`${S}/aprenda/fec`], termos: [tx("quantas vezes falta energia", "how often the power goes out"), tx("quantas vezes falta luz", "how many times the power goes out"), tx("frequência das faltas de energia", "frequency of power outages"), tx("número de quedas de energia", "number of power cuts")] },
    { alvos: [`${S}/qualidade#expurgos`], termos: [tx("apagão", "blackout"), tx("blecaute", "power blackout")] },
    { alvos: [`${S}/qualidade#p053`, `${S}/aprenda/compensacao-continuidade`], termos: [tx("desconto por falta de luz", "discount for power outage"), tx("crédito na fatura", "credit on the bill"), tx("ressarcimento por falta de energia", "refund for power outage")] },
    // perdas
    {
      alvos: [`${S}/perdas`, `${S}/perdas/composicao#painel-composicao`, `${S}/aprenda/perdas-nao-tecnicas`], // i18n: dado
      termos: [tx("furto de energia", "electricity theft"), tx("roubo de energia", "stealing electricity"), tx("gato de energia", "illegal connection to the grid"), tx("gato", "illegal hookup"), tx("ligação clandestina", "clandestine connection"), tx("fraude de energia", "electricity fraud"), tx("desvio de energia", "electricity diversion")],
    },
    // água
    {
      alvos: [`${S}/agua-e-clima`, `${S}/agua-e-clima#p017`],
      termos: [tx("nível dos reservatórios", "reservoir level"), tx("nível das represas", "dam levels"), tx("represas", "dams"), tx("barragens", "dam reservoirs"), tx("seca", "drought"), tx("crise hídrica", "water crisis"), tx("falta de chuva", "lack of rain"), tx("água das usinas", "water for the plants"), tx("racionamento", "rationing"), tx("racionamento de energia", "energy rationing")],
    },
    // preço de curto prazo
    { alvos: [`${S}/pld`, `${S}/pld#hoje`, `${S}/aprenda/pld`], termos: [tx("preço da energia", "energy price"), tx("preço da energia no mercado", "wholesale energy price"), tx("preço spot", "spot price"), tx("preço no atacado", "wholesale price"), tx("preço por hora", "hourly price"), tx("preço horário", "price per hour")] },
    { alvos: [`${S}/pld/modelos`, `${S}/pld/previsoes#p013`], termos: [tx("previsão do preço da energia", "energy price forecast"), tx("preço futuro", "future price"), tx("quanto vai custar a energia", "how much energy will cost")] },
    // rede
    {
      alvos: [`${S}/rede`, `${S}/rede#p028`, `${S}/pld/diferencas-regionais#p012`],
      termos: [tx("congestionamento", "congestion"), tx("congestionamento de linhas", "line congestion"), tx("gargalo na transmissão", "transmission bottleneck"), tx("linhas lotadas", "overloaded lines"), tx("limite de transmissão", "transmission limit")],
    },
    { alvos: [`${S}/rede/restricoes#p030`], termos: [tx("apagão", "blackout"), tx("blecaute", "power blackout"), tx("corte de carga", "load shedding"), tx("racionamento", "rationing")] },
    // carga
    { alvos: [`${S}/carga`, `${S}/carga#p025`], termos: [tx("consumo de energia", "energy consumption"), tx("consumo do país", "country consumption"), tx("consumo do Brasil", "Brazil consumption"), tx("demanda de energia", "energy demand")] },
    { alvos: [`${S}/carga/clima-e-calendario#p027`], termos: [tx("calor e consumo", "heat and consumption"), tx("temperatura e consumo", "temperature and consumption"), tx("feriado e consumo", "holiday and consumption")] },
    // geração
    { alvos: [`${S}/geracao`], termos: [tx("fontes de energia", "energy sources"), tx("matriz elétrica", "electricity mix"), tx("matriz energética", "energy mix"), tx("energia solar", "solar energy"), tx("energia eólica", "wind energy"), tx("energia hidrelétrica", "hydropower"), tx("usinas", "power plants")] },
    { alvos: [`${S}/geracao/termica#p022`], termos: [tx("usina térmica", "thermal plant"), tx("térmicas ligadas", "thermal plants on"), tx("por que ligaram as térmicas", "why thermal plants were turned on")] },
    { alvos: [`${S}/geracao/curtailment`, `${S}/geracao/restricoes#p023`, `${S}/aprenda/constrained-off`], termos: [tx("curtailment", "curtailment"), tx("geração cortada", "curtailed generation"), tx("corte de energia solar", "solar curtailment"), tx("corte de energia eólica", "wind curtailment")] },
    // leilões
    {
      alvos: [`${S}/leiloes`, `${S}/leiloes#preco`],
      termos: [tx("leilão de energia", "energy auction"), tx("leilão de energia nova", "new energy auction"), tx("leilão A-5", "A-5 auction"), tx("leilão A-6", "A-6 auction"), tx("leilão de reserva", "reserve auction"), tx("preço do leilão", "auction price"), tx("deságio do leilão", "auction discount"), tx("mercado regulado", "regulated market")],
    },
    { alvos: [`${S}/leiloes/transmissao`], termos: [tx("leilão de transmissão", "transmission auction"), tx("leilão de linhas de transmissão", "transmission line auction"), tx("deságio da transmissão", "transmission auction discount")] },
    // transição
    {
      alvos: [`${S}/transicao`, `${S}/transicao/mmgd#p063`, `${S}/aprenda/geracao-distribuida`],
      termos: [tx("energia solar em casa", "solar energy at home"), tx("energia solar no telhado", "rooftop solar"), tx("painel solar", "solar panel"), tx("placas solares", "solar panels"), tx("geração própria", "own generation"), tx("gerar a própria energia", "generate your own energy"), tx("geração distribuída", "distributed generation")],
    },
    { alvos: [`${S}/transicao/emissoes#p064`, `${S}/aprenda/fator-de-emissao`], termos: [tx("carbono", "carbon"), tx("poluição", "pollution"), tx("gases de efeito estufa", "greenhouse gases"), tx("emissões de carbono", "carbon emissions")] }, // i18n: dado
    // inclusão
    { alvos: [`${S}/inclusao-energetica/tarifa-social#p059`, `${S}/aprenda/tarifa-social`], termos: [tx("desconto na conta de luz", "discount on the electricity bill"), tx("baixa renda", "low income"), tx("famílias de baixa renda", "low-income families")] },
    { alvos: [`${S}/inclusao-energetica/acesso#p062`], termos: [tx("quem não tem energia elétrica", "who has no electricity"), tx("sem acesso à luz", "without access to electricity"), tx("comunidades isoladas", "isolated communities")] },
    { alvos: [`${S}/inclusao-energetica/orcamento#p061`], termos: [tx("peso da conta de luz", "weight of the electricity bill"), tx("gasto com energia", "spending on energy"), tx("conta de luz no orçamento", "electricity bill in the budget")] },
    // expansão
    { alvos: [`${S}/expansao`, `${S}/expansao/carteira#p040`], termos: [tx("obras", "construction works"), tx("usinas em construção", "plants under construction"), tx("novas usinas", "new plants"), tx("usinas novas", "new power plants"), tx("projetos de geração", "generation projects")] },
    { alvos: [`${S}/expansao/cronograma#p041`], termos: [tx("atraso de obras", "construction delays"), tx("obra atrasada", "delayed works"), tx("prazo das obras", "construction deadlines")] },
    // empresas
    { alvos: [`${S}/empresas/ativos#p036`], termos: [tx("dono da usina", "plant owner"), tx("quem é dono da usina", "who owns the plant"), tx("proprietário da usina", "plant owner company")] },
    { alvos: [`${S}/empresas/controle#p039`], termos: [tx("quem controla as empresas", "who controls the companies"), tx("dono das distribuidoras", "owner of the distribution utilities")] },
    { alvos: [`${S}/empresas/distribuidoras#p037`], termos: [tx("minha distribuidora", "my distribution utility"), tx("empresa que fornece a minha luz", "company that supplies my electricity"), tx("fornecedora de luz", "electricity supplier")] },
    { alvos: [`${S}/empresas/financas#p038`], termos: [tx("lucro das empresas", "company profits"), tx("balanço das empresas", "company financial statements"), tx("resultado financeiro", "financial results")] },
    {
      alvos: [`${S}/empresas/listadas`],
      termos: [tx("ações de energia", "energy stocks"), tx("empresas listadas", "listed companies"), tx("empresas na bolsa", "companies on the stock exchange"), tx("bolsa de valores", "stock exchange"), tx("índice de energia elétrica", "electric energy index"), tx("IEE", "IEE"), tx("dividendos das elétricas", "utility dividends"), tx("retorno das ações", "stock returns"), tx("acionista controlador", "controlling shareholder")],
    },
    // mercado e regulação
    { alvos: [`${S}/mercado`, `${S}/mercado#livre-regulado`, `${S}/mercado/agentes#agentes`], termos: [tx("migrar para o mercado livre", "switch to the free market"), tx("mercado livre de energia", "free energy market"), tx("escolher o fornecedor de energia", "choose the energy supplier")] },
    { alvos: [`${S}/regulacao/consultas-e-agenda#p046`], termos: [tx("audiência pública", "public hearing"), tx("consulta da ANEEL", "ANEEL consultation")] },
    { alvos: [`${S}/regulacao/linha-do-tempo#p045`], termos: [tx("mudanças nas regras", "rule changes"), tx("histórico das regras", "history of the rules"), tx("decisão da ANEEL", "ANEEL decision")] },
    // território, visão geral, aprenda e dados
    { alvos: [`${S}/territorio`], termos: [tx("meu estado", "my state"), tx("minha cidade", "my city"), tx("meu município", "my municipality"), tx("por estado", "by state"), tx("por município", "by municipality"), tx("mapa do Brasil", "map of Brazil")] },
    { alvos: [`${S}/visao-geral`], termos: [tx("resumo do setor", "sector summary"), tx("situação do sistema", "state of the system"), tx("panorama", "overview"), tx("como está o setor elétrico", "how is the power sector doing")] },
    { alvos: [`${S}/aprenda`], termos: [tx("glossário", "glossary"), tx("dicionário", "dictionary"), tx("o que significa", "what does it mean"), tx("significado de sigla", "meaning of an acronym"), tx("siglas", "acronyms")] },
    { alvos: [`${S}/dados`, `${S}/dados/reproducao#reproducao`], termos: [tx("baixar dados", "download data"), tx("planilha", "spreadsheet"), tx("excel", "excel"), tx("csv", "csv"), tx("download", "download")] }, // i18n: dado
    { alvos: [`${S}/metodologia`], termos: [tx("como é calculado", "how is it calculated"), tx("fórmula", "formula"), tx("de onde vêm os números", "where do the numbers come from"), tx("fonte dos números", "source of the numbers")] },
  ];
}
export const SINONIMOS_BUSCA_IDIOMAS = montarNosDoisIdiomas(montarSinonimosBusca);
export const SINONIMOS_BUSCA: readonly GrupoDeSinonimos[] = SINONIMOS_BUSCA_IDIOMAS.pt;

function porAlvo(grupos: readonly GrupoDeSinonimos[]): ReadonlyMap<string, readonly string[]> {
  const m = new Map<string, string[]>();
  for (const g of grupos) {
    for (const alvo of g.alvos) {
      const lista = m.get(alvo) ?? [];
      for (const t of g.termos) if (!lista.includes(t)) lista.push(t);
      m.set(alvo, lista);
    }
  }
  return m;
}

const POR_ALVO: Record<Idioma, ReadonlyMap<string, readonly string[]>> = { pt: porAlvo(SINONIMOS_BUSCA_IDIOMAS.pt), en: porAlvo(SINONIMOS_BUSCA_IDIOMAS.en) };

/**
 * Os nomes alternativos de um endereço do índice, ou lista vazia, no idioma da página: na página inglesa, o vocabulário de quem
 * procura em inglês ("power outage", "electricity price"), com os mesmos alvos.
 */
export function sinonimosDe(href: string, idioma: Idioma = idiomaEnergia()): readonly string[] {
  return POR_ALVO[idioma].get(href) ?? [];
}
