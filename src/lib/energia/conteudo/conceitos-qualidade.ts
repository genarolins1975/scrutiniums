import type { Conceito, FonteOficial } from "./conceitos";

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
const DOC_S16 = 'Página "Qualidade do fornecimento de energia elétrica" (Assuntos, Distribuição), publicada em 01/07/2024 e atualizada em 29/04/2026';
const URL_S8 = "https://dadosabertos.aneel.gov.br/dataset/indicadores-coletivos-de-continuidade-dec-e-fec";
const DOC_S8 = 'Portal de dados abertos, conjunto "Indicadores Coletivos de Continuidade (DEC e FEC)" (descrição oficial)';

const s16 = (trecho: string, parafrase?: string): FonteOficial => ({ orgao: "ANEEL", documento: DOC_S16, url: URL_S16, trecho, parafrase });
const s8 = (trecho: string, parafrase?: string): FonteOficial => ({ orgao: "ANEEL", documento: DOC_S8, url: URL_S8, trecho, parafrase });

const TRECHO_COLETIVOS =
  "Os indicadores coletivos, DEC (Duração Equivalente de Interrupção por Unidade Consumidora) e FEC (Frequência Equivalente de Interrupção por Unidade Consumidora), são acompanhados pela ANEEL por meio de subdivisões das distribuidoras, denominadas conjuntos de unidades consumidoras.";
const TRECHO_3_MINUTOS = "São consideradas para os indicadores de continuidade as interrupções com duração maior ou igual a 3 minutos.";
const TRECHO_UNIDADES =
  "O conjunto de dados apresenta os limites e os valores apurados dos indicadores coletivos de continuidade DEC (Duração Equivalente de Interrupção por Unidade Consumidora), expresso em horas e centésimos de horas, e FEC (Frequência Equivalente de Interrupção por Unidade Consumidora), expresso em número de interrupções e centésimos do número de interrupções.";
const TRECHO_LIMITES =
  "A ANEEL estabelece, com a mesma periodicidade das revisões tarifárias das distribuidoras, os limites para os indicadores DEC e FEC dos conjuntos de unidades consumidoras.";

const VEJA = [{ rotulo: "Qualidade do serviço", href: "/setor-eletrico/qualidade" }];

export const CONCEITOS: Conceito[] = [
  {
    slug: "dec",
    sigla: "DEC",
    nome: "Duração Equivalente de Interrupção por Unidade Consumidora",
    grupo: "Qualidade e perdas",
    estado: "CONFERIDO",
    conferidoEm: "2026-09-30",
    emUmaFrase: "Tempo médio, em horas, em que as unidades consumidoras de um conjunto ficaram sem energia; contam as interrupções de 3 minutos ou mais.",
    porQueImporta:
      "É um dos dois indicadores coletivos com que a ANEEL acompanha a continuidade do fornecimento. A ANEEL fixa limites de DEC para cada conjunto, e o descumprimento traz consequências à distribuidora, como plano de resultados e limitação de proventos aos acionistas.",
    comoEMedido:
      "Em horas e centésimos de hora (10,50 h são 10 horas e 30 minutos), por conjunto e por mês, apurado pela distribuidora e enviado à ANEEL. No observatório, o DEC de uma distribuidora ou do Brasil é a média mensal dos conjuntos ponderada pelas unidades consumidoras, somada nos 12 meses.",
    relacoes: ["fec", "conjunto-eletrico", "compensacao-continuidade"],
    fontes: [
      s16(
        "O indicador DEC representa, para cada conjunto de unidades consumidoras, o tempo médio, em horas, no qual as unidades consumidoras permaneceram sem o fornecimento de energia elétrica.",
        "Em outras palavras: em cada conjunto, quantas horas, em média, cada unidade ficou sem energia.",
      ),
      s16(TRECHO_3_MINUTOS),
      s8(TRECHO_UNIDADES, "Em outras palavras: o DEC vem em horas com centésimos, e o FEC em número de interrupções com centésimos."),
      s16(
        "O descumprimento dos limites de DEC e FEC gera consequências às distribuidoras, tais como a necessidade de realização de um Plano de Resultados para melhoria do desempenho, a limitação da distribuição de proventos aos acionistas e até a abertura de processo de caducidade da concessão",
      ),
    ],
    limitacoes: [
      "É uma média por unidade consumidora: não diz quanto tempo cada pessoa ficou sem energia; o tempo de cada unidade é o DIC.",
      "Centésimos de hora não são minutos: 9,33 h são 9 h 20 min.",
    ],
    vejaNoPortal: VEJA,
  },
  {
    slug: "fec",
    sigla: "FEC",
    nome: "Frequência Equivalente de Interrupção por Unidade Consumidora",
    grupo: "Qualidade e perdas",
    estado: "CONFERIDO",
    conferidoEm: "2026-09-30",
    emUmaFrase: "Número médio de vezes em que o fornecimento foi interrompido nas unidades consumidoras de um conjunto; contam as interrupções de 3 minutos ou mais.",
    porQueImporta: "É o par do DEC: um conjunto pode ter poucas interrupções longas ou muitas curtas. A ANEEL também fixa limites de FEC para cada conjunto.",
    comoEMedido:
      "Em número de interrupções e centésimos, por conjunto e por mês. No observatório, o FEC de uma distribuidora ou do Brasil é a média mensal dos conjuntos ponderada pelas unidades consumidoras, somada nos 12 meses.",
    relacoes: ["dec", "conjunto-eletrico", "compensacao-continuidade"],
    fontes: [
      s16(
        "Já o FEC indica a quantidade média de vezes em que o fornecimento foi interrompido nas unidades consumidoras, para cada conjunto de unidades consumidoras.",
        "Em outras palavras: em cada conjunto, quantas vezes, em média, cada unidade ficou sem energia.",
      ),
      s16(TRECHO_3_MINUTOS),
      s8(TRECHO_UNIDADES),
    ],
    limitacoes: ["É uma média por unidade consumidora: o número de interrupções de cada unidade é o FIC."],
    vejaNoPortal: VEJA,
  },
  {
    slug: "conjunto-eletrico",
    nome: "Conjunto de unidades consumidoras (conjunto elétrico)",
    grupo: "Qualidade e perdas",
    estado: "CONFERIDO",
    conferidoEm: "2026-09-30",
    emUmaFrase:
      "Subdivisão da área de uma distribuidora, em geral formada por uma ou mais subestações de distribuição, em que a ANEEL acompanha o DEC e o FEC e fixa os limites.",
    porQueImporta:
      "É a menor unidade dos indicadores coletivos publicados. Como a abrangência varia muito, um conjunto pode atender vários municípios pequenos e um município populoso pode ter vários conjuntos: o conjunto não é o município.",
    comoEMedido:
      "Cada conjunto tem um código da ANEEL, um número de unidades consumidoras por mês e limites anuais de DEC e FEC. A relação entre conjuntos e municípios vem da base IndQual Município, sem a quantidade de unidades de cada conjunto em cada município.",
    relacoes: ["dec", "fec"],
    fontes: [
      s16(TRECHO_COLETIVOS),
      s16(
        "Os conjuntos geralmente são formados por uma ou mais subestações de distribuição (SED). Assim, os conjuntos possuem grande variação de abrangência: diversos municípios pequenos podem ser atendidos por um único conjunto, ao mesmo tempo em que municípios populosos costumam possuir vários conjuntos.",
        "Em outras palavras: o conjunto segue a rede (as subestações), não o mapa político; por isso não coincide com municípios.",
      ),
      s16(TRECHO_LIMITES),
    ],
    limitacoes: ["Um mapa municipal de DEC por atribuição de conjunto mostra o valor do conjunto inteiro, não uma medição no município."],
    vejaNoPortal: [{ rotulo: "Mapa dos conjuntos por município", href: "/setor-eletrico/qualidade#duracao" }],
  },
  {
    slug: "compensacao-continuidade",
    nome: "Compensação por violação de limite de continuidade",
    grupo: "Qualidade e perdas",
    estado: "CONFERIDO",
    conferidoEm: "2026-09-30",
    emUmaFrase:
      "Crédito na fatura que a distribuidora deve dar automaticamente à unidade consumidora quando ela passa dos limites individuais de continuidade (DIC, FIC, DMIC, DICRI ou DISE).",
    porQueImporta:
      "É o efeito da continuidade que chega diretamente ao consumidor. Os indicadores coletivos (DEC e FEC) são médias; os individuais medem o que cada unidade sofreu, e é a violação deles que gera a compensação.",
    comoEMedido:
      "A ANEEL publica, por conjunto e mês de apuração, a quantidade e o valor das compensações pagas, separados por tipo de limite violado. O valor individual depende dos indicadores da própria unidade, que não são publicados: não se calcula a partir do DEC.",
    relacoes: ["dec", "fec", "conjunto-eletrico"],
    fontes: [
      s16(
        "Os indicadores DIC (Duração de Interrupção Individual por Unidade Consumidora) e FIC (Frequência de Interrupção Individual por Unidade Consumidora) indicam, respectivamente, o tempo total e o número de vezes em que uma unidade consumidora ficou sem energia elétrica durante um período considerado.",
      ),
      s16(
        "A violação dos limites definidos pela ANEEL para os indicadores individuais gera compensação financeira automática às unidades consumidoras. A distribuidora deve realizar a compensação quando da ultrapassagem dos correspondentes limites, por meio de crédito na fatura de energia elétrica, no prazo de até dois meses após o período de apuração.",
        "Em outras palavras: passou do limite individual, a distribuidora credita o valor na conta em até dois meses, sem o consumidor precisar pedir.",
      ),
      s8(
        "O conjunto de dados também apresenta a quantidade e o valor das compensações pagas pelas distribuidoras pelas transgressões dos limites de continuidade.",
      ),
    ],
    limitacoes: ["A base informa a competência (mês de apuração), não a data em que o crédito apareceu na fatura; a quantidade é de compensações, não de consumidores."],
    vejaNoPortal: [{ rotulo: "Compensações pagas", href: "/setor-eletrico/qualidade#compensacoes" }],
  },
];
