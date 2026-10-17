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
import type { Idioma } from "@/lib/idioma";
import { mesAno } from "../formato";
import { idiomaEnergia } from "../idioma";
import { notaGsfDoMes, type FonteExemplo } from "./evidencias-verbetes";
import type { Prova } from "./provas";
import { montarNosDoisIdiomas, type TxIdioma } from "@/lib/energia/i18n/aprenda";

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
  /** Frase que liga o número do passo ao texto do passo (o mês do número, a razão que o exemplo não mostra), lida da prova; null quando não se aplica. */
  nota?: (prova: Prova | null) => string | null;
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
  /** Passo depois do qual o exemplo sintético aparece (o exemplo fica junto do conceito que ele explica). */
  simulacaoApos: string;
};

function montarTrilhasAprenda(tx: TxIdioma): TrilhaConceitual[] {
  return [
    {
      id: "agua-operacao-preco",
      titulo: tx("Água, operação e preço", "Water, operation and price"),
      pergunta: tx("Como a água que chega aos reservatórios aparece no preço de curto prazo?", "How does the water that reaches the reservoirs show up in the short-term price?"),
      resumo:
        tx("Resposta curta: a água chega ao preço por etapas que o observatório mostra em seis passos. A afluência e o armazenamento alimentam os modelos com que o ONS planeja a operação. Esses modelos estimam o CMO. A CCEE parte do CMO para calcular o PLD, e é ao PLD que o mercado valora as diferenças entre a energia contratada e a verificada. Entre a água e o preço há decisões de operação e regras de mercado: nenhum passo determina sozinho o seguinte.", "Short answer: water reaches the price in stages that the observatory shows in six steps. Inflow and storage feed the models with which the ONS plans operation. These models estimate the CMO. The CCEE starts from the CMO to calculate the PLD, and it is at the PLD that the market values the differences between contracted and verified energy. Between water and price there are operating decisions and market rules: no step alone determines the next one."),
      passos: [
        {
          id: "afluencia",
          titulo: tx("A água que chega", "The water that arrives"),
          conceitos: ["ena", "mlt"],
          texto:
            tx("A ENA é a energia que as vazões naturais que chegam aos reservatórios permitiriam produzir, calculada pelo ONS com as produtividades das usinas a 65% dos volumes úteis. O ONS a publica também em percentual da MLT, a média de longo termo: 100% é o valor da própria MLT, e acima de 100% a afluência passou da média.", "ENA is the energy that the natural flows reaching the reservoirs would allow to be produced, calculated by the ONS with the productivities of the plants at 65% of the useful volumes. The ONS also publishes it as a percentage of the MLT, the long-term average: 100% is the value of the MLT itself, and above 100% the inflow exceeded the average."),
          prova: {
            tipo: "evidencia",
            arquivo: "gold/agua_detalhe.json",
            caminho: ["evidencias", "ena_30d_sin"],
            natureza: "CALCULADO",
            painel: { rotulo: tx("Água e clima: afluência", "Water and climate: inflow"), href: "/setor-eletrico/agua-e-clima/afluencia#p018" },
            leitura: tx("ENA bruta do SIN nos últimos 30 dias, como soma da ENA sobre soma da MLT dos quatro subsistemas.", "Gross ENA of the SIN over the last 30 days, as the sum of ENA over the sum of the MLT of the four subsystems."),
          },
          ligacao: {
            tipo: "fisico",
            texto: tx("O que fica nos reservatórios é medido pela EAR, a energia associada ao volume de água guardado.", "What stays in the reservoirs is measured by the EAR, the energy associated with the volume of stored water."),
          },
        },
        {
          id: "armazenamento",
          titulo: tx("A água guardada", "The stored water"),
          conceitos: ["ear", "armazenamento", "ree"],
          texto:
            tx("A EAR é a energia associada ao volume de água nos reservatórios que pode virar geração na própria usina e nas que ficam a jusante. Em percentual da EAR máxima, diz quanto do armazenamento possível está ocupado. O ONS a publica também por reservatório equivalente de energia (REE), o agrupamento das usinas hidrelétricas por bacia que os modelos de planejamento usam, um recorte diferente do das bacias que o ONS também publica.", "EAR is the energy associated with the volume of water in the reservoirs that can become generation at the plant itself and at those downstream. As a percentage of the maximum EAR, it says how much of the possible storage is occupied. The ONS also publishes it by equivalent energy reservoir (REE), the grouping of hydropower plants by basin that the planning models use, a different cut from that of the basins the ONS also publishes."),
          prova: {
            tipo: "evidencia",
            arquivo: "gold/agua_detalhe.json",
            caminho: ["evidencias", "ear_sin"],
            natureza: "CALCULADO",
            painel: { rotulo: tx("Água e clima: reservatórios", "Water and climate: reservoirs"), href: "/setor-eletrico/agua-e-clima#p017" },
            leitura: tx("EAR do SIN: soma das EAR dos subsistemas dividida pela soma das EAR máximas.", "SIN EAR: sum of the EAR of the subsystems divided by the sum of the maximum EAR."),
          },
          ligacao: {
            tipo: "operacao",
            texto: tx("Armazenamento e afluências entram como insumo nos modelos com que o ONS planeja a operação. Sozinhos, não determinam o preço.", "Storage and inflows enter as inputs into the models with which the ONS plans operation. On their own, they do not determine the price."),
          },
        },
        {
          id: "operacao",
          titulo: tx("A operação decide quem gera", "Operation decides who generates"),
          conceitos: ["geracao-centralizada", "cvu", "constrained-off"],
          texto:
            tx("O ONS decide quais usinas geram, considerando custo, segurança e os limites da rede. Para as térmicas, o custo variável unitário (CVU) de cada usina é considerado no Programa Mensal da Operação e nos modelos; o painel separa a geração térmica pelo motivo de despacho que o próprio ONS informa. A geração eólica também pode ser reduzida por comando do ONS, por motivo externo à usina: é o constrained-off. O número abaixo é uma média de potência em 12 meses, em MWmed, e não o total de energia; o peso da fonte no total está no painel.", "The ONS decides which plants generate, considering cost, security and grid limits. For thermal plants, the unit variable cost (CVU) of each plant is considered in the Monthly Operation Program and in the models; the panel separates thermal generation by the dispatch reason the ONS itself reports. Wind generation can also be reduced by order of the ONS, for a reason outside the plant: this is constrained-off. The number below is an average power over 12 months, in MWavg, and not total energy; the weight of the source in the total is in the panel."),
          prova: {
            tipo: "evidencia",
            arquivo: "gold/geracao_detalhe.json",
            caminho: ["evidencias", "termica_12m_total"],
            natureza: "CALCULADO",
            painel: { rotulo: tx("Geração: despacho térmico", "Generation: thermal dispatch"), href: "/setor-eletrico/geracao/termica#p022" },
            leitura: tx("Geração térmica e nuclear verificada nos últimos 12 meses completos, em média de potência.", "Thermal and nuclear generation verified over the last 12 complete months, as average power."),
          },
          ligacao: {
            tipo: "operacao",
            texto: tx("Os modelos de operação do ONS estimam o CMO: o DECOMP por semana operativa e patamar de carga, o DESSEM por meia hora.", "The ONS operation models estimate the CMO: DECOMP by operating week and load level, DESSEM by half hour."),
          },
        },
        {
          id: "cmo",
          titulo: tx("O custo de uma unidade a mais de carga", "The cost of one more unit of load"),
          conceitos: ["cmo", "decomp", "dessem"],
          texto: tx("O CMO é o custo, por unidade de energia produzida, de atender uma unidade a mais de carga no sistema interligado. É uma estimativa dos modelos, por subsistema.", "The CMO is the cost, per unit of energy produced, of serving one more unit of load in the interconnected system. It is an estimate of the models, by subsystem."),
          prova: { tipo: "verbete", slug: "dessem" },
          ligacao: {
            tipo: "mercado",
            texto: tx("A CCEE calcula o PLD de cada hora do dia seguinte com base no CMO, aplicando o piso e os tetos vigentes.", "The CCEE calculates the PLD for each hour of the following day based on the CMO, applying the floor and ceilings in force."),
          },
        },
        {
          id: "pld",
          titulo: tx("O preço de curto prazo", "The short-term price"),
          conceitos: ["pld", "limites-do-pld", "submercado"],
          texto:
            tx("O PLD é o preço do Mercado de Curto Prazo, calculado por hora e por submercado. O cálculo aplica um piso e dois tetos que a ANEEL fixa a cada ano; por isso o PLD pode diferir do CMO da mesma hora. O número abaixo é o PLD médio do Sudeste/Centro-Oeste na mesma semana operativa do CMO do passo anterior, para os dois ficarem lado a lado.", "The PLD is the price of the Short-Term Market, calculated by hour and by submarket. The calculation applies a floor and two ceilings that ANEEL sets each year; that is why the PLD may differ from the CMO of the same hour. The number below is the average Southeast/Center-West PLD in the same operating week as the CMO of the previous step, so that the two sit side by side."),
          prova: { tipo: "verbete", slug: "pld" },
          ligacao: {
            tipo: "mercado",
            texto: tx("A CCEE liquida ao PLD as diferenças entre o contratado e o verificado. O PLD não é a tarifa do consumidor atendido pela distribuidora.", "The CCEE settles at the PLD the differences between contracted and verified energy. The PLD is not the tariff of the consumer served by the distribution utility."),
          },
        },
        {
          id: "mercado",
          titulo: tx("Onde o preço vira resultado", "Where the price becomes a result"),
          conceitos: ["mcp", "mre", "gsf", "garantia-fisica"],
          texto:
            tx("No MCP, a CCEE define o balanço de energia e o resultado de cada perfil de agente por submercado e hora. As hidrelétricas do MRE compartilham o risco hidrológico: quando, juntas, geram menos que a garantia física, o fator de ajuste do MRE (GSF) fica abaixo de 100%.", "In the MCP, the CCEE determines the energy balance and the result of each agent profile by submarket and hour. The MRE hydropower plants share hydrological risk: when, together, they generate less than the physical guarantee, the MRE adjustment factor (GSF) falls below 100%."),
          prova: { tipo: "verbete", slug: "mre" },
          nota: () => notaGsfDoMes(),
        },
      ],
      naoConclua: [
        tx("Chuva não determina diretamente o preço: entre uma e outra há operação, modelos e regras de mercado.", "Rainfall does not directly determine the price: between one and the other there are operation, models and market rules."),
        tx("O PLD não é tarifa: é o preço das diferenças liquidadas no mercado de curto prazo.", "The PLD is not a tariff: it is the price of the differences settled in the short-term market."),
        tx("O fator de ajuste do MRE não diz quanto cada usina ganhou ou perdeu nem como o resultado é liquidado: as Regras de Comercialização da CCEE não foram lidas.", "The MRE adjustment factor does not say how much each plant gained or lost or how the result is settled: the CCEE Trading Rules were not read."),
      ],
      simulacao: "liquidacao",
      simulacaoApos: "pld",
    },
    {
      id: "custo-tarifa-orcamento",
      titulo: tx("Custo, tarifa e orçamento", "Cost, tariff and budget"),
      pergunta: tx("Como custos do setor chegam à conta de luz e ao orçamento das famílias?", "How do sector costs reach the electricity bill and the family budget?"),
      resumo:
        tx("Resposta curta: as perdas que a regulação reconhece e as quotas da CDE entram na tarifa que a ANEEL homologa (TE e TUSD); a tarifa, a bandeira do mês, os encargos e os tributos compõem a conta de luz. A Tarifa Social é um desconto na fatura, custeado pela CDE, e o peso da energia no orçamento vem de outra fonte, a POF 2017-2018. O percurso tem cinco passos; cada um usa uma fonte e um período próprios, e o percurso explica a relação, não soma as fontes.", "Short answer: the losses that regulation recognizes and the CDE quotas enter the tariff that ANEEL approves (TE and TUSD); the tariff, the month's tariff flag, charges and taxes make up the electricity bill. The Tarifa Social is a discount on the bill, funded by the CDE, and the weight of energy in the budget comes from another source, the POF 2017-2018. The path has five steps; each uses its own source and period, and the path explains the relation, it does not add up the sources."),
      passos: [
        {
          id: "custos",
          titulo: tx("Custos que a regulação reconhece", "Costs that regulation recognizes"),
          conceitos: ["perdas-de-energia", "percentual-regulatorio-de-perdas", "cde"],
          texto:
            tx("Parte da energia que passa pelas redes não chega a ser comercializada. Na revisão tarifária, a ANEEL define para cada concessionária os percentuais de perdas que a tarifa reconhece. A CDE, fundo das políticas públicas do setor, é arrecadada principalmente por quotas incluídas nas tarifas de uso da rede. O número abaixo é a perda realizada nas concessionárias, e não o percentual que a tarifa reconhece.", "Part of the energy that passes through the grids is not sold. In the tariff review, ANEEL sets for each concession holder the loss percentages that the tariff recognizes. The CDE, the fund for the sector's public policies, is collected mainly through quotas included in the grid use tariffs. The number below is the actual loss at the concession holders, and not the percentage the tariff recognizes."),
          prova: {
            tipo: "evidencia",
            arquivo: "gold/perdas.json",
            caminho: ["evidencias", "taxa_nacional"],
            natureza: "CALCULADO",
            painel: { rotulo: tx("Perdas: mapa das distribuidoras", "Losses: map of distribution utilities"), href: "/setor-eletrico/perdas#painel-mapa" },
            leitura: tx("Perdas totais medidas sobre a energia injetada de referência, somando as concessionárias de distribuição no último ano completo. É a perda realizada; o percentual que a tarifa reconhece é outro número (verbete Percentual regulatório de perdas).", "Total measured losses over the reference injected energy, adding up the distribution concession holders in the last complete year. It is the actual loss; the percentage the tariff recognizes is another number (entry Regulatory loss percentage)."),
          },
          ligacao: {
            tipo: "custo",
            texto: tx("As perdas reconhecidas pela regulação e as quotas da CDE são parcelas da tarifa: as componentes com CDE no código aparecem dentro da TUSD e da TE.", "The losses recognized by regulation and the CDE quotas are portions of the tariff: the components with CDE in their code appear within the TUSD and the TE."),
          },
        },
        {
          id: "tarifa",
          titulo: tx("A tarifa homologada", "The approved tariff"),
          conceitos: ["tarifa-te-tusd", "custo-de-disponibilidade"],
          texto:
            tx("A ANEEL publica para cada distribuidora a TE e a TUSD. Juntas, cobrem a energia gerada, a transmissão, a distribuição e os encargos setoriais; os tributos são cobrados além delas.", "ANEEL publishes the TE and the TUSD for each distribution utility. Together, they cover generated energy, transmission, distribution and sector charges; taxes are charged on top of them."),
          prova: { tipo: "verbete", slug: "tarifa-te-tusd" },
          ligacao: { tipo: "custo", texto: tx("A bandeira acrescenta um valor por kWh consumido, conforme o patamar acionado no mês.", "The tariff flag adds a value per kWh consumed, according to the level triggered in the month.") },
        },
        {
          id: "bandeira",
          titulo: tx("A bandeira do mês", "The month's tariff flag"),
          conceitos: ["bandeira-tarifaria"],
          texto:
            tx("A cor definida para o mês sinaliza o custo da geração e indica se há acréscimo por kWh consumido, e de quanto. Não se aplica aos consumidores dos sistemas isolados.", "The color set for the month signals the cost of generation and indicates whether there is a surcharge per kWh consumed, and how much. It does not apply to consumers in isolated systems."),
          prova: { tipo: "verbete", slug: "bandeira-tarifaria" },
          ligacao: {
            tipo: "custo",
            texto: tx("A tarifa homologada pela ANEEL (TE e TUSD), as bandeiras, os encargos e os tributos compõem a conta de luz.", "The tariff approved by ANEEL (TE and TUSD), the tariff flags, charges and taxes make up the electricity bill."),
          },
        },
        {
          id: "tarifa-social",
          titulo: tx("O desconto para quem tem menos renda", "The discount for those with lower income"),
          conceitos: ["tarifa-social", "cde"],
          texto:
            tx("A Tarifa Social dá desconto na fatura a famílias de baixa renda e a idosos ou pessoas com deficiência que recebem o BPC, custeado pela CDE. Nas faturas emitidas a partir de 5 de julho de 2025, o desconto é de 100% para o consumo até 80 kWh no mês.", "The Tarifa Social gives a discount on the bill to low-income families and to elderly people or people with disabilities who receive the BPC, funded by the CDE. On bills issued from Jul 5, 2025, the discount is 100% for consumption up to 80 kWh in the month."),
          prova: { tipo: "verbete", slug: "tarifa-social" },
          nota: (p) => {
            const mes = p?.tipo === "evidencia" ? p.dado.evidencia.periodo.fim.slice(0, 7) : null;
            // a regra descrita no passo vale para faturas emitidas a partir de 5 de julho de 2025
            return mes && mes < "2025-07" ? tx(`O mês do número é ${mesAno(mes)}, anterior às faturas emitidas a partir de 5 de julho de 2025: o número não mede o efeito da regra descrita acima.`, `The month of the number is ${mesAno(mes)}, before the bills issued from Jul 5, 2025: the number does not measure the effect of the rule described above.`) : null;
          },
          ligacao: {
            tipo: "associacao",
            texto:
              tx("O peso da energia no orçamento vem de outra fonte (POF 2017-2018), anterior às regras atuais do desconto: os dois números ficam lado a lado, sem relação de causa.", "The weight of energy in the budget comes from another source (POF 2017-2018), earlier than the current discount rules: the two numbers sit side by side, without a causal relation."),
          },
        },
        {
          id: "orcamento",
          titulo: tx("O peso no orçamento", "The weight in the budget"),
          conceitos: [],
          texto:
            tx("O peso da energia no orçamento é a despesa da família com energia dividida pelo seu rendimento total, na Pesquisa de Orçamentos Familiares do IBGE. O número abaixo é a média dessas razões nas famílias de menor rendimento.", "The weight of energy in the budget is the family's spending on energy divided by its total income, in the IBGE Household Budget Survey. The number below is the average of these ratios among the lowest-income families."),
          prova: {
            tipo: "evidencia",
            arquivo: "gold/inclusao.json",
            caminho: ["orcamento", "evidencias", "media_razoes_renda_classe_baixa"],
            natureza: "ESTIMADO",
            painel: { rotulo: tx("Inclusão: peso no orçamento", "Inclusion: weight in the budget"), href: "/setor-eletrico/inclusao-energetica/orcamento#p061" },
            leitura: tx("Média ponderada das razões entre despesa com energia e rendimento total, nas famílias com rendimento total até R$ 1.908 (valores de 15/01/2018).", "Weighted average of the ratios between spending on energy and total income, among families with total income up to R$ 1,908 (values of Jan 15, 2018)."),
          },
        },
      ],
      naoConclua: [
        tx("A mediana da tarifa entre distribuidoras não é a conta de ninguém: a conta depende da distribuidora, da classe, do consumo e dos tributos.", "The median tariff among distribution utilities is nobody's bill: the bill depends on the distribution utility, the class, consumption and taxes."),
        tx("Unidades consumidoras e faturas com desconto não são famílias atendidas.", "Consumer units and bills with a discount are not families served."),
        tx("O peso no orçamento vem da POF 2017-2018 e não mede o efeito das regras atuais da Tarifa Social nem das tarifas vigentes.", "The weight in the budget comes from the POF 2017-2018 and does not measure the effect of the current Tarifa Social rules or of the tariffs in force."),
      ],
      simulacao: "conta",
      simulacaoApos: "orcamento",
    },
  ];
}
export const TRILHAS_APRENDA_IDIOMAS = montarNosDoisIdiomas(montarTrilhasAprenda);
export const TRILHAS_APRENDA: TrilhaConceitual[] = TRILHAS_APRENDA_IDIOMAS.pt;

/** As trilhas no idioma da página. */
export function trilhasAprenda(idioma: Idioma = idiomaEnergia()): TrilhaConceitual[] {
  return TRILHAS_APRENDA_IDIOMAS[idioma];
}

export function trilha(id: string, idioma: Idioma = idiomaEnergia()): TrilhaConceitual | undefined {
  return TRILHAS_APRENDA_IDIOMAS[idioma].find((t) => t.id === id);
}

/** Endereço de um passo, para o retorno do painel ao contexto. */
export function hrefPasso(t: IdTrilha, passo: string): string {
  return `/setor-eletrico/aprenda/trilhas/${t}#passo-${passo}`;
}

/** Trilhas e passos em que um verbete aparece. */
export function passosComVerbete(slug: string, idioma: Idioma = idiomaEnergia()): { trilha: TrilhaConceitual; passo: PassoTrilha; ordem: number }[] {
  const out: { trilha: TrilhaConceitual; passo: PassoTrilha; ordem: number }[] = [];
  for (const t of TRILHAS_APRENDA_IDIOMAS[idioma]) t.passos.forEach((p, i) => p.conceitos.includes(slug) && out.push({ trilha: t, passo: p, ordem: i + 1 }));
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
