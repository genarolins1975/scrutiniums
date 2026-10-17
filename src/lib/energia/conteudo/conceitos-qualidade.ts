import type { Conceito, FonteOficial } from "./conceitos";
import { montarNosDoisIdiomas, type TxIdioma } from "@/lib/energia/i18n/aprenda";

/**
 * Verbetes do módulo qualidade. Mesma regra da base (conceitos.ts): nenhuma definição de
 * memória; CONFERIDO só com o documento primário acessado na data indicada. Um
 * verbete com o slug de um verbete base o substitui.
 *
 * Fontes dos quatro verbetes, acessadas em 30/09/2026 às 21h48 de Brasília:
 *  - página "Qualidade do fornecimento de energia elétrica" da ANEEL (S16 da
 *    especificação), publicada em 01/07/2024 e atualizada em 29/04/2026 segundo a própria
 *    página; sha256 do HTML capturado
 *    2e113237473eacf623f33331d972aa04657a40a07587788e2d5ed7f5920c0fb5;
 *  - descrição do conjunto "Indicadores Coletivos de Continuidade (DEC e FEC)" no portal
 *    de dados abertos da ANEEL (S8), pela API package_show; sha256 da resposta
 *    93da63f6118be47f85dfd58a2922b6f211f08ec08dde75f540a69e41eb308d0f.
 * Os trechos são literais; a paráfrase não acrescenta nada que eles não digam. DIC, FIC,
 * DMIC, DICRI e DISE aparecem dentro do verbete de compensação (a mesma página os define),
 * sem verbete próprio.
 */

const URL_S16 = "https://www.gov.br/aneel/pt-br/assuntos/distribuicao/qualidade-do-fornecimento-de-energia-eletrica";
const URL_S8 = "https://dadosabertos.aneel.gov.br/dataset/indicadores-coletivos-de-continuidade-dec-e-fec";

const TRECHO_COLETIVOS =
  // i18n: dado
  "Os indicadores coletivos, DEC (Duração Equivalente de Interrupção por Unidade Consumidora) e FEC (Frequência Equivalente de Interrupção por Unidade Consumidora), são acompanhados pela ANEEL por meio de subdivisões das distribuidoras, denominadas conjuntos de unidades consumidoras.";
// i18n: dado
const TRECHO_3_MINUTOS = "São consideradas para os indicadores de continuidade as interrupções com duração maior ou igual a 3 minutos.";
const TRECHO_UNIDADES =
  // i18n: dado
  "O conjunto de dados apresenta os limites e os valores apurados dos indicadores coletivos de continuidade DEC (Duração Equivalente de Interrupção por Unidade Consumidora), expresso em horas e centésimos de horas, e FEC (Frequência Equivalente de Interrupção por Unidade Consumidora), expresso em número de interrupções e centésimos do número de interrupções.";
const TRECHO_LIMITES =
  // i18n: dado
  "A ANEEL estabelece, com a mesma periodicidade das revisões tarifárias das distribuidoras, os limites para os indicadores DEC e FEC dos conjuntos de unidades consumidoras.";

function montarConceitos(tx: TxIdioma): Conceito[] {
  const DOC_S16 = tx('Página "Qualidade do fornecimento de energia elétrica" (Assuntos, Distribuição), publicada em 01/07/2024 e atualizada em 29/04/2026', "ANEEL page «Qualidade do fornecimento de energia elétrica» (Topics, Distribution), published on Jul 1, 2024 and updated on Apr 29, 2026");
  const DOC_S8 = tx('Portal de dados abertos, conjunto "Indicadores Coletivos de Continuidade (DEC e FEC)" (descrição oficial)', "Open data portal, dataset «Indicadores Coletivos de Continuidade (DEC e FEC)» (official description)");
  const s16 = (trecho: string, parafrase?: string): FonteOficial => ({ orgao: "ANEEL", documento: DOC_S16, url: URL_S16, trecho, parafrase });
  const s8 = (trecho: string, parafrase?: string): FonteOficial => ({ orgao: "ANEEL", documento: DOC_S8, url: URL_S8, trecho, parafrase });
  const VEJA = [{ rotulo: tx("Qualidade do serviço", "Quality of supply"), href: "/setor-eletrico/qualidade" }];
  return [
    {
      slug: "dec",
      sigla: "DEC",
      nome: tx("Duração Equivalente de Interrupção por Unidade Consumidora", "Equivalent interruption duration per consumer unit"),
      grupo: "Qualidade e perdas", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-09-30",
      emUmaFrase: tx("Tempo médio, em horas, em que as unidades consumidoras de um conjunto ficaram sem energia; contam as interrupções de 3 minutos ou mais.", "Average time, in hours, that the consumer units of a group were without electricity; interruptions of 3 minutes or more count."),
      porQueImporta:
        tx("É um dos dois indicadores coletivos com que a ANEEL acompanha a continuidade do fornecimento. A ANEEL fixa limites de DEC para cada conjunto, e o descumprimento traz consequências à distribuidora, como plano de resultados e limitação de proventos aos acionistas.", "It is one of the two collective indicators with which ANEEL monitors continuity of supply. ANEEL sets DEC limits for each group, and non-compliance has consequences for the distribution utility, such as a results plan and a limit on payouts to shareholders."),
      comoEMedido:
        tx("Em horas e centésimos de hora (10,50 h são 10 horas e 30 minutos), por conjunto e por mês, apurado pela distribuidora e enviado à ANEEL. No observatório, o DEC de uma distribuidora ou do Brasil é a média mensal dos conjuntos ponderada pelas unidades consumidoras, somada nos 12 meses.", "In hours and hundredths of an hour (10.50 h is 10 hours and 30 minutes), by group and by month, determined by the distribution utility and sent to ANEEL. In the observatory, the DEC of a distribution utility or of Brazil is the monthly average of the groups weighted by consumer units, summed over the 12 months."),
      relacoes: ["fec", "conjunto-eletrico", "compensacao-continuidade"],
      fontes: [
        s16(
          // i18n: dado
          "O indicador DEC representa, para cada conjunto de unidades consumidoras, o tempo médio, em horas, no qual as unidades consumidoras permaneceram sem o fornecimento de energia elétrica.",
          tx("Em outras palavras: em cada conjunto, quantas horas, em média, cada unidade ficou sem energia.", "In other words: in each group, how many hours, on average, each unit was without electricity."),
        ),
        s16(TRECHO_3_MINUTOS),
        s8(TRECHO_UNIDADES, tx("Em outras palavras: o DEC vem em horas com centésimos, e o FEC em número de interrupções com centésimos.", "In other words: DEC comes in hours with hundredths, and FEC in number of interruptions with hundredths.")),
        s16(
          // i18n: dado
          "O descumprimento dos limites de DEC e FEC gera consequências às distribuidoras, tais como a necessidade de realização de um Plano de Resultados para melhoria do desempenho, a limitação da distribuição de proventos aos acionistas e até a abertura de processo de caducidade da concessão",
        ),
      ],
      limitacoes: [
        tx("É uma média por unidade consumidora: não diz quanto tempo cada pessoa ficou sem energia; o tempo de cada unidade é o DIC.", "It is an average per consumer unit: it does not say how long each person was without electricity; the time of each unit is the DIC."),
        tx("Centésimos de hora não são minutos: 9,33 h são 9 h 20 min.", "Hundredths of an hour are not minutes: 9.33 h is 9 h 20 min."),
        tx("O DEC divulgado é o apurado: a regra exclui da conta as interrupções por situação de emergência, dia crítico, origem externa ao sistema de distribuição e cortes pedidos pelo ONS. Somadas essas parcelas, o tempo sem energia é maior que o apurado; a página de Qualidade mostra as duas medidas.", "The published DEC is the determined one: the rule excludes from the count interruptions due to emergencies, critical days, origin outside the distribution system and load cuts requested by the ONS. With these portions added, the time without electricity is greater than the determined one; the Quality of supply page shows both measures."),
      ],
      vejaNoPortal: VEJA,
    },
    {
      slug: "fec",
      sigla: "FEC",
      nome: tx("Frequência Equivalente de Interrupção por Unidade Consumidora", "Equivalent interruption frequency per consumer unit"),
      grupo: "Qualidade e perdas", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-09-30",
      emUmaFrase: tx("Número médio de vezes em que o fornecimento foi interrompido nas unidades consumidoras de um conjunto; contam as interrupções de 3 minutos ou mais.", "Average number of times supply was interrupted at the consumer units of a group; interruptions of 3 minutes or more count."),
      porQueImporta: tx("É o par do DEC: um conjunto pode ter poucas interrupções longas ou muitas curtas. A ANEEL também fixa limites de FEC para cada conjunto.", "It is the counterpart of DEC: a group might have few long interruptions or many short ones. ANEEL also sets FEC limits for each group."),
      comoEMedido:
        tx("Em número de interrupções e centésimos, por conjunto e por mês. No observatório, o FEC de uma distribuidora ou do Brasil é a média mensal dos conjuntos ponderada pelas unidades consumidoras, somada nos 12 meses.", "In number of interruptions and hundredths, by group and by month. In the observatory, the FEC of a distribution utility or of Brazil is the monthly average of the groups weighted by consumer units, summed over the 12 months."),
      relacoes: ["dec", "conjunto-eletrico", "compensacao-continuidade"],
      fontes: [
        s16(
          // i18n: dado
          "Já o FEC indica a quantidade média de vezes em que o fornecimento foi interrompido nas unidades consumidoras, para cada conjunto de unidades consumidoras.",
          tx("Em outras palavras: em cada conjunto, quantas vezes, em média, cada unidade ficou sem energia.", "In other words: in each group, how many times, on average, each unit was without electricity."),
        ),
        s16(TRECHO_3_MINUTOS),
        s8(TRECHO_UNIDADES),
      ],
      limitacoes: [tx("É uma média por unidade consumidora: o número de interrupções de cada unidade é o FIC.", "It is an average per consumer unit: the number of interruptions of each unit is the FIC.")],
      vejaNoPortal: VEJA,
    },
    {
      slug: "conjunto-eletrico",
      nome: tx("Conjunto de unidades consumidoras (conjunto elétrico)", "Group of consumer units (electrical group)"),
      grupo: "Qualidade e perdas", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-09-30",
      emUmaFrase:
        tx("Subdivisão da área de uma distribuidora, em geral formada por uma ou mais subestações de distribuição, em que a ANEEL acompanha o DEC e o FEC e fixa os limites.", "Subdivision of a distribution utility's area, generally formed by one or more distribution substations, in which ANEEL monitors DEC and FEC and sets the limits."),
      porQueImporta:
        tx("É a menor unidade dos indicadores coletivos publicados. Como a abrangência varia muito, um conjunto pode atender vários municípios pequenos e um município populoso pode ter vários conjuntos: o conjunto não é o município.", "It is the smallest unit of the published collective indicators. Since coverage varies widely, a group might serve several small municipalities and a populous municipality might have several sets: the group is not the municipality."),
      comoEMedido:
        tx("Cada conjunto tem um código da ANEEL, um número de unidades consumidoras por mês e limites anuais de DEC e FEC. A relação entre conjuntos e municípios vem da base IndQual Município, sem a quantidade de unidades de cada conjunto em cada município.", "Each group has an ANEEL code, a number of consumer units per month and annual DEC and FEC limits. The relation between groups and municipalities comes from the «IndQual Município» database, without the number of units of each group in each municipality."),
      relacoes: ["dec", "fec"],
      fontes: [
        s16(TRECHO_COLETIVOS),
        s16(
          // i18n: dado
          "Os conjuntos geralmente são formados por uma ou mais subestações de distribuição (SED). Assim, os conjuntos possuem grande variação de abrangência: diversos municípios pequenos podem ser atendidos por um único conjunto, ao mesmo tempo em que municípios populosos costumam possuir vários conjuntos.",
          tx("Em outras palavras: o conjunto segue a rede (as subestações), não o mapa político; por isso não coincide com municípios.", "In other words: the group follows the grid (the substations), not the political map; that is why it does not coincide with municipalities."),
        ),
        s16(TRECHO_LIMITES),
      ],
      limitacoes: [tx("Um mapa municipal de DEC por atribuição de conjunto mostra o valor do conjunto inteiro, não uma medição no município.", "A municipal DEC map built by assigning groups shows the value of the whole group, not a measurement in the municipality.")],
      vejaNoPortal: [{ rotulo: tx("Mapa dos conjuntos por município", "Map of groups by municipality"), href: "/setor-eletrico/qualidade#duracao" }],
    },
    {
      slug: "compensacao-continuidade",
      nome: tx("Compensação por violação de limite de continuidade", "Compensation for violation of a continuity limit"),
      grupo: "Qualidade e perdas", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-09-30",
      emUmaFrase:
        tx("Crédito na fatura que a distribuidora deve dar automaticamente à unidade consumidora quando ela passa dos limites individuais de continuidade (DIC, FIC, DMIC, DICRI ou DISE).", "Credit on the bill that the distribution utility must give automatically to the consumer unit when it exceeds the individual continuity limits (DIC, FIC, DMIC, DICRI or DISE)."),
      porQueImporta:
        tx("É o efeito da continuidade que chega diretamente ao consumidor. Os indicadores coletivos (DEC e FEC) são médias; os individuais medem o que cada unidade sofreu, e é a violação deles que gera a compensação.", "It is the effect of continuity that reaches the consumer directly. The collective indicators (DEC and FEC) are averages; the individual ones measure what each unit experienced, and it is their violation that generates compensation."),
      comoEMedido:
        tx("A ANEEL publica, por conjunto e mês de apuração, a quantidade e o valor das compensações pagas, separados por tipo de limite violado. O valor individual depende dos indicadores da própria unidade, que não são publicados: não se calcula a partir do DEC.", "ANEEL publishes, by group and month of determination, the number and value of compensations paid, separated by type of limit violated. The individual value depends on the indicators of the unit itself, which are not published: it is not calculated from the DEC."),
      relacoes: ["dec", "fec", "conjunto-eletrico"],
      fontes: [
        s16(
          // i18n: dado
          "Os indicadores DIC (Duração de Interrupção Individual por Unidade Consumidora) e FIC (Frequência de Interrupção Individual por Unidade Consumidora) indicam, respectivamente, o tempo total e o número de vezes em que uma unidade consumidora ficou sem energia elétrica durante um período considerado.",
        ),
        s16(
          // i18n: dado
          "A violação dos limites definidos pela ANEEL para os indicadores individuais gera compensação financeira automática às unidades consumidoras. A distribuidora deve realizar a compensação quando da ultrapassagem dos correspondentes limites, por meio de crédito na fatura de energia elétrica, no prazo de até dois meses após o período de apuração.",
          tx("Em outras palavras: passou do limite individual, a distribuidora credita o valor na conta em até dois meses, sem o consumidor precisar pedir.", "In other words: once the individual limit is exceeded, the distribution utility credits the amount on the bill within two months, without the consumer having to ask."),
        ),
        s8(
          // i18n: dado
          "O conjunto de dados também apresenta a quantidade e o valor das compensações pagas pelas distribuidoras pelas transgressões dos limites de continuidade.",
        ),
      ],
      limitacoes: [tx("A base informa a competência (mês de apuração), não a data em que o crédito apareceu na fatura; a quantidade é de compensações, não de consumidores.", "The database reports the accrual period (month of determination), not the date on which the credit appeared on the bill; the quantity is of compensations, not of consumers.")],
      vejaNoPortal: [{ rotulo: tx("Compensações pagas", "Compensations paid"), href: "/setor-eletrico/qualidade#compensacoes" }],
    },
  ];
}
export const CONCEITOS_IDIOMAS = montarNosDoisIdiomas(montarConceitos);
export const CONCEITOS: Conceito[] = CONCEITOS_IDIOMAS.pt;
