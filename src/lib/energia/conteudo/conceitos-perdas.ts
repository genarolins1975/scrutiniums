import type { Conceito, FonteOficial } from "./conceitos";
import { montarNosDoisIdiomas, type TxIdioma } from "@/lib/energia/i18n/aprenda";

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

function montarConceitos(tx: TxIdioma): Conceito[] {
  const DOC_S5 = tx('Página "Perdas de Energia" (Assuntos, Distribuição), publicada em 16/02/2022 e atualizada em 30/04/2026', "ANEEL page «Perdas de Energia» (Topics, Distribution), published on Feb 16, 2022 and updated on Apr 30, 2026");
  const s5 = (trecho: string, parafrase?: string): FonteOficial => ({ orgao: "ANEEL", documento: DOC_S5, url: URL_S5, trecho, parafrase });
  const VEJA = [{ rotulo: tx("Perdas de energia", "Energy losses"), href: "/setor-eletrico/perdas" }];
  // técnicas e não técnicas têm painel próprio; a âncora #composicao só existe nessa página
  const VEJA_COMPOSICAO = [...VEJA, { rotulo: tx("Técnicas e não técnicas", "Technical and non-technical"), href: "/setor-eletrico/perdas/composicao#composicao" }];
  return [
    {
      slug: "perdas-de-energia",
      nome: tx("Perdas de energia", "Energy losses"),
      grupo: "Qualidade e perdas", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-09-30",
      emUmaFrase: tx("Energia que passa pelas redes de transmissão e de distribuição mas não chega a ser comercializada, por motivos técnicos ou comerciais.", "Energy that passes through the transmission and distribution grids but is not sold, for technical or commercial reasons."),
      porQueImporta: tx("Segundo a ANEEL, o consumidor regular arca na tarifa com parte dessas perdas, e a regulação limita o repasse do que excede o nível eficiente.", "According to ANEEL, the regular consumer bears part of these losses in the tariff, and regulation limits the pass-through of what exceeds the efficient level."),
      comoEMedido:
        tx("No observatório, perdas totais da distribuidora como a ANEEL as calcula no SAMP Balanço (valor medido), em MWh, e a taxa sobre a energia injetada de referência da própria distribuidora.", "In the observatory, total losses of the distribution utility as ANEEL calculates them in the SAMP Balance (measured value), in MWh, and the rate over the distribution utility's own reference injected energy."),
      relacoes: ["perdas-tecnicas", "perdas-nao-tecnicas", "percentual-regulatorio-de-perdas"],
      fontes: [
        s5(
          // i18n: dado
          "As perdas referem-se à energia elétrica gerada que passa pelas linhas de transmissão (Rede Básica) e redes da distribuição, mas que não chega a ser comercializada, seja por motivos técnicos ou comerciais.",
          tx("Em outras palavras: é a energia que circula pelas redes e não vira venda, por causa da física das redes ou por motivos comerciais.", "In other words: it is the energy that flows through the grids and does not become a sale, because of the physics of the grids or for commercial reasons."),
        ),
        s5(
          // i18n: dado
          "A regulação por incentivos adotada pela ANEEL, quando observada ineficiência da gestão da concessionária, limita o repasse das perdas não técnicas para a conta de energia.",
        ),
      ],
      limitacoes: [tx("A taxa de uma distribuidora descreve a área inteira: não é a perda de cada município nem de cada consumidor.", "The rate of a distribution utility describes the whole area: it is not the loss of each municipality or of each consumer.")],
      vejaNoPortal: VEJA,
    },
    {
      slug: "perdas-tecnicas",
      nome: tx("Perdas técnicas", "Technical losses"),
      grupo: "Qualidade e perdas", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-09-30",
      emUmaFrase: tx("Perdas inevitáveis do transporte de energia, como o aquecimento dos condutores (efeito joule) e as perdas nos núcleos dos transformadores.", "Unavoidable losses in transporting energy, such as the heating of conductors (Joule effect) and losses in transformer cores."),
      porQueImporta: tx("Por serem inevitáveis em qualquer rede, os custos das perdas técnicas são considerados na tarifa, no nível que a ANEEL considera eficiente.", "Because they are unavoidable in any grid, the costs of technical losses are considered in the tariff, at the level ANEEL considers efficient."),
      comoEMedido:
        tx("A ANEEL estima o percentual de perdas técnicas eficientes sobre a energia injetada, com modelos por segmento de rede (Módulo 7 do Prodist). No SAMP, a perda técnica é a informada no balanço de energia: estimativa, não medição, que pode diferir do percentual técnico regulatório homologado.", "ANEEL estimates the percentage of efficient technical losses over injected energy, with models by grid segment (Module 7 of Prodist). In SAMP, the technical loss is the one reported in the energy balance: an estimate, not a measurement, which might differ from the approved regulatory technical percentage."),
      relacoes: ["perdas-de-energia", "perdas-nao-tecnicas", "percentual-regulatorio-de-perdas"],
      fontes: [
        s5(
          // i18n: dado
          "O transporte da energia, seja na Rede Básica ou na distribuição, resulta inevitavelmente em perdas técnicas relacionadas à transformação de energia elétrica em energia térmica nos condutores (efeito joule), perdas nos núcleos dos transformadores, perdas dielétricas etc.",
        ),
        // i18n: dado
        s5("Os custos das perdas técnicas são considerados na tarifa de energia elétrica por serem inevitáveis em qualquer rede de distribuição no mundo, representando um custo para o setor elétrico."),
        s5(
          // i18n: dado
          "As perdas técnicas são calculadas conforme as regras definidas no Módulo 7 do Prodist [...] estima-se o percentual de perdas técnicas eficientes relativas à energia injetada na rede.",
          tx("Em outras palavras: a ANEEL calcula, com as regras do Prodist, o percentual de perdas técnicas que considera eficiente para a rede, como fração da energia injetada.", "In other words: using the Prodist rules, ANEEL calculates the percentage of technical losses it considers efficient for the grid, as a fraction of injected energy."),
        ),
      ],
      limitacoes: [tx("Não se pode concluir que toda perda técnica possa ser eliminada: ela decorre da física da rede.", "It cannot be concluded that all technical loss can be eliminated: it results from the physics of the grid.")],
      vejaNoPortal: VEJA_COMPOSICAO,
    },
    {
      slug: "perdas-nao-tecnicas",
      nome: tx("Perdas não técnicas", "Non-technical losses"),
      grupo: "Qualidade e perdas", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-09-30",
      emUmaFrase: tx("Diferença entre as perdas totais e as técnicas; decorre principalmente de furto, fraude e erros de medição e de faturamento.", "Difference between total and technical losses; it results mainly from theft, fraud and metering and billing errors."),
      porQueImporta: tx("A ANEEL fixa limites regulatórios para elas comparando o desempenho das distribuidoras e as características socioeconômicas das áreas de concessão.", "ANEEL sets regulatory limits for them by comparing the performance of distribution utilities and the socioeconomic characteristics of the concession areas."),
      comoEMedido:
        tx("Apuradas pela diferença entre as perdas totais e as técnicas. No observatório, sobre o mercado de baixa tensão medido (a base da regulação) e, ao lado, sobre a energia injetada; a fonte não separa furto, fraude e erro.", "Determined as the difference between total and technical losses. In the observatory, over the measured low-voltage market (the basis of regulation) and, alongside, over injected energy; the source does not separate theft, fraud and error."),
      relacoes: ["perdas-de-energia", "perdas-tecnicas", "percentual-regulatorio-de-perdas"],
      fontes: [
        s5(
          // i18n: dado
          "As perdas não técnicas ou comerciais decorrem principalmente de furto (ligação clandestina, desvio direto da rede) ou fraude de energia (adulterações no medidor), popularmente conhecidos como “gatos”, erros de medição e de faturamento.",
        ),
        // i18n: dado
        s5("As perdas não técnicas são apuradas pela diferença entre as perdas totais e as perdas técnicas."),
      ],
      limitacoes: [
        tx("Incluem erros de medição e de faturamento: não são sinônimo de furto.", "They include metering and billing errors: they are not a synonym for theft."),
        tx("Uma taxa alta numa área não atribui responsabilidade às famílias que moram nela.", "A high rate in an area does not assign responsibility to the families who live in it."),
      ],
      vejaNoPortal: VEJA_COMPOSICAO,
    },
    {
      slug: "percentual-regulatorio-de-perdas",
      nome: tx("Percentual regulatório de perdas", "Regulatory loss percentage"),
      grupo: "Qualidade e perdas", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-09-30",
      emUmaFrase: tx("Percentuais de perdas técnicas e não técnicas que a ANEEL define para cada concessionária na revisão tarifária periódica e que a tarifa reconhece.", "Percentages of technical and non-technical losses that ANEEL sets for each concession holder in the periodic tariff review and that the tariff recognizes."),
      porQueImporta: tx("É a referência contra a qual se mede quanto da perda realizada a tarifa cobre; o que passa do nível regulatório não é repassado quando a ANEEL observa ineficiência.", "It is the reference against which one measures how much of the actual loss the tariff covers; what exceeds the regulatory level is not passed on when ANEEL observes inefficiency."),
      comoEMedido:
        tx("Técnico: modelos do Módulo 7 do Prodist (Procedimentos de Distribuição de Energia Elétrica no Sistema Elétrico Nacional) sobre a rede de cada distribuidora. Não técnico: comparação de desempenho entre distribuidoras (Submódulo 2.6 do Proret, os Procedimentos de Regulação Tarifária). O observatório só consegue inferir o técnico da série do SAMP; o não técnico não está em base aberta acessível.", "Technical: models of Module 7 of Prodist (Electricity Distribution Procedures in the National Electric System) on the grid of each distribution utility. Non-technical: performance comparison between distribution utilities (Submodule 2.6 of Proret, the Tariff Regulation Procedures). The observatory can only infer the technical one from the SAMP series; the non-technical one is not in an accessible open database."),
      relacoes: ["perdas-tecnicas", "perdas-nao-tecnicas"],
      fontes: [
        // i18n: dado
        s5("A ANEEL define os percentuais regulatórios das perdas técnicas e não técnicas das concessionárias na Revisão Tarifária Periódica, que ocorre a cada 4 ou 5 anos."),
        // i18n: dado
        s5("Os limites regulatórios de perdas não técnicas são calculados conforme as regras definidas no Submódulo 2.6 do Proret."),
        s5(
          // i18n: dado
          "Resumidamente, seus valores são calculados pela ANEEL por uma metodologia de comparação de desempenho das distribuidoras, observando critérios de eficiência e as características socioeconômicas das áreas de concessão.",
          tx("Em outras palavras: o limite de perdas não técnicas de cada distribuidora sai de uma comparação com as demais, que leva em conta eficiência e as características socioeconômicas da área.", "In other words: the non-technical loss limit of each distribution utility comes from a comparison with the others, which takes into account efficiency and the socioeconomic characteristics of the area."),
        ),
      ],
      limitacoes: [
        tx("Parâmetro regulatório não é perda realizada nem obrigação de perda zero.", "A regulatory parameter is neither an actual loss nor an obligation of zero loss."),
        tx("O observatório mostra só o percentual técnico, inferido da própria série do SAMP onde a razão fica constante por 6 meses ou mais; não é o percentual lido do ato da ANEEL.", "The observatory shows only the technical percentage, inferred from the SAMP series itself where the ratio stays constant for 6 months or more; it is not the percentage read from the ANEEL act."),
        tx("O percentual regulatório não técnico não está em base aberta acessível, e por isso não é mostrado.", "The non-technical regulatory percentage is not in an accessible open database, and is therefore not shown."),
      ],
      vejaNoPortal: [{ rotulo: tx("Realizado e regulatório", "Actual and regulatory"), href: "/setor-eletrico/perdas/regulatorio#regulatorio" }],
    },
  ];
}
export const CONCEITOS_IDIOMAS = montarNosDoisIdiomas(montarConceitos);
export const CONCEITOS: Conceito[] = CONCEITOS_IDIOMAS.pt;
