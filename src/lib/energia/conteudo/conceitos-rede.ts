import type { Conceito, FonteOficial } from "./conceitos";
import { montarNosDoisIdiomas, type TxIdioma } from "@/lib/energia/i18n/aprenda";

/**
 * Verbetes do módulo rede. Mesma regra da base (conceitos.ts): nenhuma definição de
 * memória; CONFERIDO só com o documento primário acessado na data indicada. Um
 * verbete com o slug de um verbete base o substitui.
 *
 * Fontes, baixadas em 30/09/2026 às 20h46 de Brasília (23h46 UTC) e relidas com
 * pdftotext para conferir cada trecho literal: o dicionário de dados do conjunto
 * Intercâmbios Entre Subsistemas (DicionarioDados_Intercambio_Nacional.pdf, versão 1.2
 * de 04/05/2026, sha256 b3c9941804cd…), o do conjunto Intercâmbio do SIN com Outros
 * Países (DicionarioDados_Intercambio_Internacional.pdf, versão 1.2 de 04/05/2026, sha256
 * 1c21323c6bec…) e o Submódulo 9.1 dos Procedimentos de Rede, revisão 2020.12, vigente
 * desde 01/01/2021 (sha256 b7f69a0388d4…). Os arquivos estão no bronze do módulo
 * (data/energia/bronze/ons/ons_rede_dicionarios e ons_rede_documentos).
 *
 * O verbete "intercambio" substitui o da base para apontar a página com a pergunta nova
 * do P028 e para dizer, com o trecho do dicionário, onde ficam o intercâmbio do Sul com
 * os países vizinhos e a relação das linhas de fronteira.
 */

function montarConceitos(tx: TxIdioma): Conceito[] {
  const DIC_NACIONAL: (trecho: string) => FonteOficial = (trecho) => ({
    orgao: "ONS",
    documento: tx("Dicionário de dados do conjunto Intercâmbios Entre Subsistemas (versão 1.2, 04/05/2026), acessado em 30/09/2026", "Data dictionary of the «Intercâmbios Entre Subsistemas» dataset (version 1.2, May 4, 2026), accessed on Sep 30, 2026"),
    url: "https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/intercambio_nacional_ho/DicionarioDados_Intercambio_Nacional.pdf",
    trecho,
  });
  const DIC_INTERNACIONAL: (trecho: string) => FonteOficial = (trecho) => ({
    orgao: "ONS",
    documento: tx("Dicionário de dados do conjunto Intercâmbio do SIN com Outros Países (versão 1.2, 04/05/2026), acessado em 30/09/2026", "Data dictionary of the «Intercâmbio do SIN com Outros Países» dataset (version 1.2, May 4, 2026), accessed on Sep 30, 2026"),
    url: "https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/intercambio_internacional_ho/DicionarioDados_Intercambio_Internacional.pdf",
    trecho,
  });
  const SUBMODULO_9_1: (trecho: string) => FonteOficial = (trecho) => ({
    orgao: "ONS",
    documento: tx("Procedimentos de Rede, Submódulo 9.1, Indicadores de confiabilidade da Rede Básica (revisão 2020.12, vigência 01/01/2021), item 2.7, acessado em 30/09/2026", "Grid Procedures, Submodule 9.1, Basic Network reliability indicators (revision 2020.12, in force from Jan 1, 2021), item 2.7, accessed on Sep 30, 2026"),
    url: "https://proxyportais.ons.org.br/ons.portalempregado.proxy/garapi/api/processo/retornarpdf?url=%2Fsites%2Fsoumaisons%2Fportalgar%2Fecmpdf%2FSubm%C3%B3dulo+9.1-IN_2020.12.pdf",
    trecho,
  });
  return [
    {
      slug: "intercambio",
      nome: tx("Intercâmbio entre subsistemas", "Interchange between subsystems"),
      grupo: "Operação", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-09-30",
      emUmaFrase: tx("Fluxo de energia entre subsistemas, medido pela soma dos fluxos de potência ativa nas linhas de transmissão de fronteira.", "Energy flow between subsystems, measured as the sum of active power flows on the border transmission lines."),
      porQueImporta: tx("Mostra quanta energia uma região está enviando ou recebendo das outras.", "It shows how much energy a region is sending to or receiving from the others."),
      comoEMedido:
        tx("Em MWmed, por hora e por fronteira, no conjunto Intercâmbios Entre Subsistemas do ONS, com o valor verificado e, a partir da versão 1.2 do dicionário, também o programado. O intercâmbio do Sul com os países vizinhos fica no conjunto de intercâmbio do SIN com outros países.", "In MWavg, by hour and by border, in the ONS dataset «Intercâmbios Entre Subsistemas», with the verified value and, from version 1.2 of the dictionary, also the scheduled one. The interchange of the South with neighboring countries is in the dataset of interchange of the SIN with other countries."),
      relacoes: ["submercado", "intercambio-internacional"],
      fontes: [
        // i18n: dado
        DIC_NACIONAL("As grandezas representam a soma das medidas de fluxo de potência ativa nas linhas de transmissão de fronteira entre os subsistemas."),
        // i18n: dado
        DIC_NACIONAL("O intercâmbio do subsistema Sul com os países vizinhos não consta nesta consulta e pode ser obtido nos dados de intercâmbio do SIN."),
      ],
      limitacoes: [
        tx("O conjunto não traz os limites de intercâmbio: o dicionário remete a relação das linhas de fronteira a um relatório do Portal SINtegre, de acesso autenticado.", "The dataset does not include the interchange limits: the dictionary refers the list of border lines to a report on the SINtegre Portal, with authenticated access."),
        tx("Só a soma por fronteira é publicada; o fluxo de cada linha de transmissão não é.", "Only the sum by border is published; the flow of each transmission line is not."),
      ],
      vejaNoPortal: [{ rotulo: tx("Como a energia circula entre regiões?", "How does energy flow between regions?"), href: "/setor-eletrico/rede" }],
    },
    {
      slug: "intercambio-internacional",
      nome: tx("Intercâmbio com outros países", "Interchange with other countries"),
      grupo: "Operação", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-09-30",
      emUmaFrase:
        tx("Fluxo de energia entre o SIN e um país vizinho, medido pela soma dos fluxos de potência ativa nas conversoras de frequência de fronteira; positivo é exportação do Brasil.", "Energy flow between the SIN and a neighboring country, measured as the sum of active power flows at the border frequency converters; positive is export from Brazil."),
      porQueImporta:
        tx("O intercâmbio do Sul com os países vizinhos não está no conjunto das fronteiras entre subsistemas; sem ele, as contas de energia do Sul e do SIN ficam incompletas.", "The interchange of the South with neighboring countries is not in the dataset of borders between subsystems; without it, the energy accounts of the South and of the SIN are incomplete."),
      comoEMedido:
        tx("Em MWmed, por hora e por país, no conjunto Intercâmbio do SIN com Outros Países do ONS: Argentina pelas conversoras de Garabi I, Garabi II e Uruguaiana; Uruguai por Melo e Rivera; Paraguai por Acaray.", "In MWavg, by hour and by country, in the ONS dataset «Intercâmbio do SIN com Outros Países»: Argentina through the Garabi I, Garabi II and Uruguaiana converters; Uruguay through Melo and Rivera; Paraguay through Acaray."),
      relacoes: ["intercambio", "sin"],
      fontes: [
        DIC_INTERNACIONAL(
          // i18n: dado
          "As grandezas representam a soma das medidas de fluxo de potência ativa nas conversoras de frequência de fronteira entre os dois países. O intercâmbio com a Argentina pode ser realizado pelas conversoras de Garabi I, Garabi II e Uruguaiana. O intercâmbio com o Uruguai pode ser realizado pelas conversoras de Melo e Rivera. O intercâmbio com o Paraguai pode ser realizado pela conversora de Acaray.",
        ),
        // i18n: dado
        DIC_INTERNACIONAL("Dados positivos indicam exportação de energia do Brasil para outros países; dados negativos indicam importação de energia do Brasil de outros países."),
      ],
      limitacoes: [tx("Itaipu é publicada pelo ONS como geração de uma usina, não como intercâmbio com o Paraguai.", "Itaipu is published by the ONS as the generation of a plant, not as interchange with Paraguay.")],
      vejaNoPortal: [{ rotulo: tx("De onde vem a diferença de energia?", "Where does the energy difference come from?"), href: "/setor-eletrico/rede/balanco-e-exterior" }],
    },
    {
      slug: "atls",
      sigla: "ATLS",
      nome: tx("Atendimento aos Limites Sistêmicos", "Compliance with System Limits"),
      grupo: "Operação", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-09-30",
      emUmaFrase:
        tx("Percentual do tempo em que fluxos selecionados pelo ONS operaram dentro das faixas de segurança recomendadas pelos estudos elétricos; o complemento é o tempo acima do limite.", "Percentage of time in which flows selected by the ONS operated within the safety ranges recommended by electrical studies; the complement is the time above the limit."),
      porQueImporta: tx("É a evidência pública de quanto tempo fluxos importantes da rede passaram fora da faixa de segurança, mesmo sem a publicação dos limites.", "It is the public evidence of how long important grid flows spent outside the safety range, even without the limits being published."),
      comoEMedido:
        tx("ATLS = (1 − A/B) × 100%, com A o somatório dos tempos de violação das faixas de segurança e B o período total de observação; intervalos de violação com menos de 10 minutos não contam, e há uma banda morta de 50 MW ou 5% do limite da faixa, o que for maior. Agregação mensal e anual.", "ATLS = (1 − A/B) × 100%, with A the sum of the times of violation of the safety ranges and B the total observation period; violation intervals shorter than 10 minutes do not count, and there is a dead band of 50 MW or 5% of the range limit, whichever is greater. Monthly and annual aggregation."),
      relacoes: ["intercambio"],
      fontes: [
        SUBMODULO_9_1(
          // i18n: dado
          "É o percentual de tempo em que os fluxos, definidos nos documentos normativos da operação e selecionados como relevantes para avaliação da segurança elétrica, operaram dentro das faixas de segurança recomendadas pelos estudos elétricos específicos.",
        ),
        SUBMODULO_9_1(
          // i18n: dado
          "A = Somatório dos tempos de violação das faixas de segurança recomendadas pelos estudos elétricos específicos no período da agregação considerada. Não são considerados intervalos de tempo de violação com duração inferior a 10 (dez) minutos. B = Período total de observação da agregação considerada.",
        ),
        // i18n: dado
        SUBMODULO_9_1("É considerado, no cálculo do indicador, uma banda morta de 50 MW ou 5% do limite da faixa, o que for maior."),
      ],
      limitacoes: [
        tx("O indicador não publica o valor do limite nem a folga de cada fluxo.", "The indicator does not publish the value of the limit or the margin of each flow."),
        tx("O arquivo de dados do ONS traz o valor em fração de 0 a 1, embora o dicionário diga percentual.", "The ONS data file gives the value as a fraction from 0 to 1, although the dictionary says percentage."),
      ],
      vejaNoPortal: [{ rotulo: tx("Quando há evidência publicada de limitação da rede?", "When is there published evidence of grid limitation?"), href: "/setor-eletrico/rede/restricoes" }],
    },
  ];
}
export const CONCEITOS_IDIOMAS = montarNosDoisIdiomas(montarConceitos);
export const CONCEITOS: Conceito[] = CONCEITOS_IDIOMAS.pt;
