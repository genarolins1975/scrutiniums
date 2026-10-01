import type { Conceito, FonteOficial } from "./conceitos";

/**
 * Verbetes do módulo perdas. Mesma regra da base (conceitos.ts): nenhuma definição de
 * memória; CONFERIDO só com o documento primário acessado na data indicada. Um
 * verbete com o slug de um verbete base o substitui.
 *
 * Fonte dos quatro verbetes: página "Perdas de Energia" da ANEEL (S5 da especificação),
 * acessada em 30/09/2026 às 21h10 de Brasília (publicada em 16/02/2022, atualizada em
 * 30/04/2026 segundo a própria página; sha256 do HTML capturado
 * 8e6f1f46048de3b6ee20471d41805e12c59f9712b03e73e20f629a2db8696b04). Os trechos são
 * literais; a paráfrase não acrescenta nada que eles não digam. Energia injetada, mercado
 * de baixa tensão e resíduo do balanço não têm verbete: a fonte primária que os define (o
 * dicionário do SAMP) lista os campos sem defini-los; as definições de método do módulo
 * estão na própria página de Perdas, no modo Auditar.
 */

const URL_S5 = "https://www.gov.br/aneel/pt-br/assuntos/distribuicao/perdas-de-energia/perdas-de-energia";
const DOC_S5 = 'Página "Perdas de Energia" (Assuntos, Distribuição), publicada em 16/02/2022 e atualizada em 30/04/2026';

const s5 = (trecho: string, parafrase?: string): FonteOficial => ({ orgao: "ANEEL", documento: DOC_S5, url: URL_S5, trecho, parafrase });

const VEJA = [{ rotulo: "Perdas de energia", href: "/setor-eletrico/perdas" }];
// técnicas e não técnicas têm painel próprio; a âncora #composicao só existe nessa página
const VEJA_COMPOSICAO = [...VEJA, { rotulo: "Técnicas e não técnicas", href: "/setor-eletrico/perdas/composicao#composicao" }];

export const CONCEITOS: Conceito[] = [
  {
    slug: "perdas-de-energia",
    nome: "Perdas de energia",
    grupo: "Qualidade e perdas",
    estado: "CONFERIDO",
    conferidoEm: "2026-09-30",
    emUmaFrase: "Energia que passa pelas redes de transmissão e de distribuição mas não chega a ser comercializada, por motivos técnicos ou comerciais.",
    porQueImporta: "Segundo a ANEEL, o consumidor regular arca na tarifa com parte dessas perdas, e a regulação limita o repasse do que excede o nível eficiente.",
    comoEMedido:
      "No observatório, perdas totais da distribuidora como a ANEEL as calcula no SAMP Balanço (valor medido), em MWh, e a taxa sobre a energia injetada de referência da própria distribuidora.",
    relacoes: ["perdas-tecnicas", "perdas-nao-tecnicas", "percentual-regulatorio-de-perdas"],
    fontes: [
      s5(
        "As perdas referem-se à energia elétrica gerada que passa pelas linhas de transmissão (Rede Básica) e redes da distribuição, mas que não chega a ser comercializada, seja por motivos técnicos ou comerciais.",
        "Em outras palavras: é a energia que circula pelas redes e não vira venda, por causa da física das redes ou por motivos comerciais.",
      ),
      s5(
        "A regulação por incentivos adotada pela ANEEL, quando observada ineficiência da gestão da concessionária, limita o repasse das perdas não técnicas para a conta de energia.",
      ),
    ],
    limitacoes: ["A taxa de uma distribuidora descreve a área inteira: não é a perda de cada município nem de cada consumidor."],
    vejaNoPortal: VEJA,
  },
  {
    slug: "perdas-tecnicas",
    nome: "Perdas técnicas",
    grupo: "Qualidade e perdas",
    estado: "CONFERIDO",
    conferidoEm: "2026-09-30",
    emUmaFrase: "Perdas inevitáveis do transporte de energia, como o aquecimento dos condutores (efeito joule) e as perdas nos núcleos dos transformadores.",
    porQueImporta: "Por serem inevitáveis em qualquer rede, os custos das perdas técnicas são considerados na tarifa, no nível que a ANEEL considera eficiente.",
    comoEMedido:
      "A ANEEL estima o percentual de perdas técnicas eficientes sobre a energia injetada, com modelos por segmento de rede (Módulo 7 do Prodist). No SAMP, a perda técnica publicada é esse percentual aplicado à energia injetada: estimativa, não medição.",
    relacoes: ["perdas-de-energia", "perdas-nao-tecnicas", "percentual-regulatorio-de-perdas"],
    fontes: [
      s5(
        "O transporte da energia, seja na Rede Básica ou na distribuição, resulta inevitavelmente em perdas técnicas relacionadas à transformação de energia elétrica em energia térmica nos condutores (efeito joule), perdas nos núcleos dos transformadores, perdas dielétricas etc.",
      ),
      s5("Os custos das perdas técnicas são considerados na tarifa de energia elétrica por serem inevitáveis em qualquer rede de distribuição no mundo, representando um custo para o setor elétrico."),
      s5(
        "As perdas técnicas são calculadas conforme as regras definidas no Módulo 7 do Prodist [...] estima-se o percentual de perdas técnicas eficientes relativas à energia injetada na rede.",
        "Em outras palavras: a ANEEL calcula, com as regras do Prodist, o percentual de perdas técnicas que considera eficiente para a rede, como fração da energia injetada.",
      ),
    ],
    limitacoes: ["Não se pode concluir que toda perda técnica possa ser eliminada: ela decorre da física da rede."],
    vejaNoPortal: VEJA_COMPOSICAO,
  },
  {
    slug: "perdas-nao-tecnicas",
    nome: "Perdas não técnicas",
    grupo: "Qualidade e perdas",
    estado: "CONFERIDO",
    conferidoEm: "2026-09-30",
    emUmaFrase: "Diferença entre as perdas totais e as técnicas; decorre principalmente de furto, fraude e erros de medição e de faturamento.",
    porQueImporta: "A ANEEL fixa limites regulatórios para elas comparando o desempenho das distribuidoras e as características socioeconômicas das áreas de concessão.",
    comoEMedido:
      "Apuradas pela diferença entre as perdas totais e as técnicas. No observatório, sobre o mercado de baixa tensão medido (a base da regulação) e, ao lado, sobre a energia injetada; a fonte não separa furto, fraude e erro.",
    relacoes: ["perdas-de-energia", "perdas-tecnicas", "percentual-regulatorio-de-perdas"],
    fontes: [
      s5(
        "As perdas não técnicas ou comerciais decorrem principalmente de furto (ligação clandestina, desvio direto da rede) ou fraude de energia (adulterações no medidor), popularmente conhecidos como “gatos”, erros de medição e de faturamento.",
      ),
      s5("As perdas não técnicas são apuradas pela diferença entre as perdas totais e as perdas técnicas."),
    ],
    limitacoes: [
      "Incluem erros de medição e de faturamento: não são sinônimo de furto.",
      "Uma taxa alta numa área não atribui responsabilidade às famílias que moram nela.",
    ],
    vejaNoPortal: VEJA_COMPOSICAO,
  },
  {
    slug: "percentual-regulatorio-de-perdas",
    nome: "Percentual regulatório de perdas",
    grupo: "Qualidade e perdas",
    estado: "CONFERIDO",
    conferidoEm: "2026-09-30",
    emUmaFrase: "Percentuais de perdas técnicas e não técnicas que a ANEEL define para cada concessionária na revisão tarifária periódica e que a tarifa reconhece.",
    porQueImporta: "É a referência contra a qual se mede quanto da perda realizada a tarifa cobre; o que passa do nível regulatório não é repassado quando a ANEEL observa ineficiência.",
    comoEMedido:
      "Técnico: modelos do Módulo 7 do Prodist sobre a rede de cada distribuidora. Não técnico: comparação de desempenho entre distribuidoras (Submódulo 2.6 do Proret). O observatório só consegue inferir o técnico da série do SAMP; o não técnico não está em base aberta acessível.",
    relacoes: ["perdas-tecnicas", "perdas-nao-tecnicas"],
    fontes: [
      s5("A ANEEL define os percentuais regulatórios das perdas técnicas e não técnicas das concessionárias na Revisão Tarifária Periódica, que ocorre a cada 4 ou 5 anos."),
      s5("Os limites regulatórios de perdas não técnicas são calculados conforme as regras definidas no Submódulo 2.6 do Proret."),
      s5(
        "Resumidamente, seus valores são calculados pela ANEEL por uma metodologia de comparação de desempenho das distribuidoras, observando critérios de eficiência e as características socioeconômicas das áreas de concessão.",
        "Em outras palavras: o limite de perdas não técnicas de cada distribuidora sai de uma comparação com as demais, que leva em conta eficiência e as características socioeconômicas da área.",
      ),
    ],
    limitacoes: ["Parâmetro regulatório não é perda realizada nem obrigação de perda zero."],
    vejaNoPortal: [{ rotulo: "Realizado e regulatório", href: "/setor-eletrico/perdas/regulatorio#regulatorio" }],
  },
];
