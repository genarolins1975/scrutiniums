/**
 * Trilhas do Aprenda (P066): dois percursos que ligam conceitos a números publicados,
 * água → operação → preço e custo → tarifa → orçamento.
 *
 * Cada passo junta verbetes conferidos, um número real com a ficha de prova (ou o exemplo
 * do verbete, lido da gold) e a ligação com o passo seguinte, tipificada como no mapa do
 * setor (fluxo físico, decisão de operação, regra de mercado, componente de custo,
 * associação analítica). Os textos usam só o que os verbetes conferidos e o mapa já
 * dizem; o que o percurso não permite concluir fica escrito em cada trilha.
 *
 * Os exemplos sintéticos (liquidação ao PLD e conta com peso no orçamento) vivem em
 * AprendaSimulacao: valores hipotéticos com rótulo permanente, que não leem nem
 * alimentam nenhum indicador do observatório.
 */
import type { TipoLigacao } from "../mapa";
import type { FonteExemplo } from "./evidencias-verbetes";

export type ProvaPasso =
  /** Ficha publicada por um painel (mesmo formato do exemplo com evidência do verbete). */
  | ({ tipo: "evidencia" } & FonteExemplo)
  /** O exemplo do verbete: ficha, quando houver, ou o texto lido da gold. */
  | { tipo: "verbete"; slug: string };

export type PassoTrilha = {
  id: string;
  titulo: string;
  conceitos: string[];
  texto: string;
  prova: ProvaPasso;
  /** Ligação com o passo seguinte; o último passo não tem. */
  ligacao?: { tipo: TipoLigacao; texto: string };
};

export type IdTrilha = "agua-operacao-preco" | "custo-tarifa-orcamento";

export type TrilhaConceitual = {
  id: IdTrilha;
  titulo: string;
  pergunta: string;
  resumo: string;
  passos: PassoTrilha[];
  naoConclua: string[];
  simulacao: "liquidacao" | "conta";
};

export const TRILHAS_APRENDA: TrilhaConceitual[] = [
  {
    id: "agua-operacao-preco",
    titulo: "Água, operação e preço",
    pergunta: "Como a água que chega aos reservatórios aparece no preço de curto prazo?",
    resumo:
      "Da afluência ao resultado no mercado de curto prazo, em seis passos. Entre a água e o preço há decisões de operação e regras de mercado: nenhum passo determina sozinho o seguinte.",
    passos: [
      {
        id: "afluencia",
        titulo: "A água que chega",
        conceitos: ["ena", "mlt"],
        texto:
          "A ENA é a energia que as vazões naturais que chegam aos reservatórios permitiriam produzir, calculada pelo ONS com as produtividades das usinas a 65% dos volumes úteis. O ONS a publica também em percentual da MLT, a média de longo termo.",
        prova: {
          tipo: "evidencia",
          arquivo: "gold/agua_detalhe.json",
          caminho: ["evidencias", "ena_30d_sin"],
          natureza: "CALCULADO",
          painel: { rotulo: "Água e clima: afluência", href: "/setor-eletrico/agua-e-clima/afluencia#p018" },
          leitura: "ENA bruta do SIN nos últimos 30 dias, como soma da ENA sobre soma da MLT dos quatro subsistemas.",
        },
        ligacao: {
          tipo: "fisico",
          texto: "O que fica nos reservatórios é medido pela EAR, a energia associada ao volume de água guardado.",
        },
      },
      {
        id: "armazenamento",
        titulo: "A água guardada",
        conceitos: ["ear", "armazenamento", "ree"],
        texto:
          "A EAR é a energia associada ao volume de água nos reservatórios que pode virar geração na própria usina e nas que ficam a jusante. Em percentual da EAR máxima, diz quanto do armazenamento possível está ocupado. O ONS a publica também por reservatório equivalente de energia (REE), a agregação por bacia que os modelos de planejamento usam.",
        prova: {
          tipo: "evidencia",
          arquivo: "gold/agua_detalhe.json",
          caminho: ["evidencias", "ear_sin"],
          natureza: "CALCULADO",
          painel: { rotulo: "Água e clima: reservatórios", href: "/setor-eletrico/agua-e-clima#p017" },
          leitura: "EAR do SIN: soma das EAR dos subsistemas dividida pela soma das EAR máximas.",
        },
        ligacao: {
          tipo: "operacao",
          texto: "Armazenamento e afluências entram como insumo nos modelos com que o ONS planeja a operação. Sozinhos, não determinam o preço.",
        },
      },
      {
        id: "operacao",
        titulo: "A operação decide quem gera",
        conceitos: ["geracao-centralizada", "cvu", "constrained-off"],
        texto:
          "O ONS decide quais usinas geram, considerando custo, segurança e os limites da rede. Para as térmicas, o CVU de cada usina é considerado no Programa Mensal da Operação e nos modelos; o painel separa a geração térmica pelo motivo de despacho que o próprio ONS informa. A geração eólica também pode ser reduzida por comando do ONS, por motivo externo à usina: é o constrained-off.",
        prova: {
          tipo: "evidencia",
          arquivo: "gold/geracao_detalhe.json",
          caminho: ["evidencias", "termica_12m_total"],
          natureza: "CALCULADO",
          painel: { rotulo: "Geração: despacho térmico", href: "/setor-eletrico/geracao/termica#p022" },
          leitura: "Geração térmica e nuclear verificada nos últimos 12 meses completos, em média de potência.",
        },
        ligacao: {
          tipo: "operacao",
          texto: "Os modelos de operação do ONS estimam o CMO: o DECOMP por semana operativa e patamar de carga, o DESSEM por meia hora.",
        },
      },
      {
        id: "cmo",
        titulo: "O custo de uma unidade a mais de carga",
        conceitos: ["cmo", "decomp", "dessem"],
        texto: "O CMO é o custo, por unidade de energia produzida, de atender uma unidade a mais de carga no sistema interligado. É uma estimativa dos modelos, por subsistema.",
        prova: { tipo: "verbete", slug: "dessem" },
        ligacao: {
          tipo: "mercado",
          texto: "A CCEE calcula o PLD de cada hora do dia seguinte com base no CMO, aplicando o piso e os tetos vigentes.",
        },
      },
      {
        id: "pld",
        titulo: "O preço de curto prazo",
        conceitos: ["pld", "limites-do-pld", "submercado"],
        texto:
          "O PLD é o preço do Mercado de Curto Prazo, calculado por hora e por submercado. O cálculo aplica um piso e dois tetos que a ANEEL fixa a cada ano; por isso o PLD pode diferir do CMO da mesma hora.",
        prova: { tipo: "verbete", slug: "pld" },
        ligacao: {
          tipo: "mercado",
          texto: "A CCEE liquida ao PLD as diferenças entre o contratado e o verificado. O PLD não é a tarifa do consumidor atendido pela distribuidora.",
        },
      },
      {
        id: "mercado",
        titulo: "Onde o preço vira resultado",
        conceitos: ["mcp", "mre", "gsf", "garantia-fisica"],
        texto:
          "No MCP, a CCEE define o balanço de energia e o resultado de cada perfil de agente por submercado e hora. As hidrelétricas do MRE compartilham o risco hidrológico: quando, juntas, geram menos que a garantia física, o fator de ajuste do MRE (GSF) fica abaixo de 100%.",
        prova: { tipo: "verbete", slug: "mre" },
      },
    ],
    naoConclua: [
      "Chuva não determina diretamente o preço: entre uma e outra há operação, modelos e regras de mercado.",
      "O PLD não é tarifa: é o preço das diferenças liquidadas no mercado de curto prazo.",
      "O fator de ajuste do MRE não diz quanto cada usina ganhou ou perdeu nem como o resultado é liquidado: as Regras de Comercialização da CCEE não foram conferidas nesta fase.",
    ],
    simulacao: "liquidacao",
  },
  {
    id: "custo-tarifa-orcamento",
    titulo: "Custo, tarifa e orçamento",
    pergunta: "Como custos do setor chegam à conta de luz e ao orçamento das famílias?",
    resumo:
      "Dos custos reconhecidos pela regulação ao peso da energia no orçamento, em cinco passos. Cada passo usa uma fonte e um período próprios; o percurso explica a relação, não soma as fontes.",
    passos: [
      {
        id: "custos",
        titulo: "Custos que a regulação reconhece",
        conceitos: ["perdas-de-energia", "percentual-regulatorio-de-perdas", "cde"],
        texto:
          "Parte da energia que passa pelas redes não chega a ser comercializada. Na revisão tarifária, a ANEEL define para cada concessionária os percentuais de perdas que a tarifa reconhece. A CDE, fundo das políticas públicas do setor, é arrecadada principalmente por quotas incluídas nas tarifas de uso da rede.",
        prova: {
          tipo: "evidencia",
          arquivo: "gold/perdas.json",
          caminho: ["evidencias", "taxa_nacional"],
          natureza: "CALCULADO",
          painel: { rotulo: "Perdas: mapa das distribuidoras", href: "/setor-eletrico/perdas#painel-mapa" },
          leitura: "Perdas totais medidas sobre a energia injetada de referência, somando as concessionárias de distribuição no último ano completo.",
        },
        ligacao: {
          tipo: "custo",
          texto: "As perdas reconhecidas pela regulação e as quotas da CDE são parcelas da tarifa: as componentes com CDE no código aparecem dentro da TUSD e da TE.",
        },
      },
      {
        id: "tarifa",
        titulo: "A tarifa homologada",
        conceitos: ["tarifa-te-tusd", "custo-de-disponibilidade"],
        texto:
          "A ANEEL publica para cada distribuidora a TE e a TUSD. Juntas, cobrem a energia gerada, a transmissão, a distribuição e os encargos setoriais; os tributos são cobrados além delas.",
        prova: { tipo: "verbete", slug: "tarifa-te-tusd" },
        ligacao: { tipo: "custo", texto: "A bandeira acrescenta um valor por kWh consumido, conforme o patamar acionado no mês." },
      },
      {
        id: "bandeira",
        titulo: "A bandeira do mês",
        conceitos: ["bandeira-tarifaria"],
        texto:
          "A cor definida para o mês sinaliza o custo da geração e indica se há acréscimo por kWh consumido, e de quanto. Não se aplica aos consumidores dos sistemas isolados.",
        prova: { tipo: "verbete", slug: "bandeira-tarifaria" },
        ligacao: {
          tipo: "custo",
          texto: "A tarifa homologada pela ANEEL (TE e TUSD), as bandeiras, os encargos e os tributos compõem a conta de luz.",
        },
      },
      {
        id: "tarifa-social",
        titulo: "O desconto para quem tem menos renda",
        conceitos: ["tarifa-social", "cde"],
        texto:
          "A Tarifa Social dá desconto na fatura a famílias de baixa renda e a idosos ou pessoas com deficiência que recebem o BPC, custeado pela CDE. Nas faturas emitidas a partir de 5 de julho de 2025, o desconto é de 100% para o consumo até 80 kWh no mês.",
        prova: { tipo: "verbete", slug: "tarifa-social" },
        ligacao: {
          tipo: "associacao",
          texto:
            "O peso da energia no orçamento vem de outra fonte (POF 2017-2018), anterior às regras atuais do desconto: os dois números ficam lado a lado, sem relação de causa.",
        },
      },
      {
        id: "orcamento",
        titulo: "O peso no orçamento",
        conceitos: [],
        texto:
          "O peso da energia no orçamento é a despesa da família com energia dividida pelo seu rendimento total, na Pesquisa de Orçamentos Familiares do IBGE. O número abaixo é a média dessas razões nas famílias de menor rendimento.",
        prova: {
          tipo: "evidencia",
          arquivo: "gold/inclusao.json",
          caminho: ["orcamento", "evidencias", "media_razoes_renda_classe_baixa"],
          natureza: "ESTIMADO",
          painel: { rotulo: "Inclusão: peso no orçamento", href: "/setor-eletrico/inclusao-energetica/orcamento#p061" },
          leitura: "Média ponderada das razões entre despesa com energia e rendimento total, nas famílias com rendimento total até R$ 1.908 (valores de 15/01/2018).",
        },
      },
    ],
    naoConclua: [
      "A mediana da tarifa entre distribuidoras não é a conta de ninguém: a conta depende da distribuidora, da classe, do consumo e dos tributos.",
      "Unidades consumidoras e faturas com desconto não são famílias atendidas.",
      "O peso no orçamento vem da POF 2017-2018 e não mede o efeito das regras atuais da Tarifa Social nem das tarifas vigentes.",
    ],
    simulacao: "conta",
  },
];

export function trilha(id: string): TrilhaConceitual | undefined {
  return TRILHAS_APRENDA.find((t) => t.id === id);
}

/** Endereço de um passo, para o retorno do painel ao contexto. */
export function hrefPasso(t: IdTrilha, passo: string): string {
  return `/setor-eletrico/aprenda/trilhas/${t}#passo-${passo}`;
}

/** Trilhas e passos em que um verbete aparece. */
export function passosComVerbete(slug: string): { trilha: TrilhaConceitual; passo: PassoTrilha; ordem: number }[] {
  const out: { trilha: TrilhaConceitual; passo: PassoTrilha; ordem: number }[] = [];
  for (const t of TRILHAS_APRENDA) t.passos.forEach((p, i) => p.conceitos.includes(slug) && out.push({ trilha: t, passo: p, ordem: i + 1 }));
  return out;
}

/**
 * Parâmetro que leva o leitor do Aprenda a um painel e o traz de volta (?volta=):
 * "trilha:<id>:<passo>" ou "verbete:<slug>". Acrescentado antes do #âncora.
 */
export function comVolta(href: string, volta: string): string {
  const [base, ancora] = href.split("#");
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}volta=${encodeURIComponent(volta)}${ancora ? `#${ancora}` : ""}`;
}
