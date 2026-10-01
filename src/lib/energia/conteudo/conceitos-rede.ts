import type { Conceito, FonteOficial } from "./conceitos";

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

const DIC_NACIONAL: (trecho: string) => FonteOficial = (trecho) => ({
  orgao: "ONS",
  documento: "Dicionário de dados do conjunto Intercâmbios Entre Subsistemas (versão 1.2, 04/05/2026), acessado em 30/09/2026",
  url: "https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/intercambio_nacional_ho/DicionarioDados_Intercambio_Nacional.pdf",
  trecho,
});

const DIC_INTERNACIONAL: (trecho: string) => FonteOficial = (trecho) => ({
  orgao: "ONS",
  documento: "Dicionário de dados do conjunto Intercâmbio do SIN com Outros Países (versão 1.2, 04/05/2026), acessado em 30/09/2026",
  url: "https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/intercambio_internacional_ho/DicionarioDados_Intercambio_Internacional.pdf",
  trecho,
});

const SUBMODULO_9_1: (trecho: string) => FonteOficial = (trecho) => ({
  orgao: "ONS",
  documento: "Procedimentos de Rede, Submódulo 9.1, Indicadores de confiabilidade da Rede Básica (revisão 2020.12, vigência 01/01/2021), item 2.7, acessado em 30/09/2026",
  url: "https://proxyportais.ons.org.br/ons.portalempregado.proxy/garapi/api/processo/retornarpdf?url=%2Fsites%2Fsoumaisons%2Fportalgar%2Fecmpdf%2FSubm%C3%B3dulo+9.1-IN_2020.12.pdf",
  trecho,
});

export const CONCEITOS: Conceito[] = [
  {
    slug: "intercambio",
    nome: "Intercâmbio entre subsistemas",
    grupo: "Operação",
    estado: "CONFERIDO",
    conferidoEm: "2026-09-30",
    emUmaFrase: "Fluxo de energia entre subsistemas, medido pela soma dos fluxos de potência ativa nas linhas de transmissão de fronteira.",
    porQueImporta: "Mostra quanta energia uma região está enviando ou recebendo das outras.",
    comoEMedido:
      "Em MWmed, por hora e por fronteira, no conjunto Intercâmbios Entre Subsistemas do ONS, com o valor verificado e, a partir da versão 1.2 do dicionário, também o programado. O intercâmbio do Sul com os países vizinhos fica no conjunto de intercâmbio do SIN com outros países.",
    relacoes: ["submercado", "intercambio-internacional"],
    fontes: [
      DIC_NACIONAL("As grandezas representam a soma das medidas de fluxo de potência ativa nas linhas de transmissão de fronteira entre os subsistemas."),
      DIC_NACIONAL("O intercâmbio do subsistema Sul com os países vizinhos não consta nesta consulta e pode ser obtido nos dados de intercâmbio do SIN."),
    ],
    limitacoes: [
      "O conjunto não traz os limites de intercâmbio: o dicionário remete a relação das linhas de fronteira a um relatório do Portal SINtegre, de acesso autenticado.",
      "Só a soma por fronteira é publicada; o fluxo de cada linha de transmissão não é.",
    ],
    vejaNoPortal: [{ rotulo: "Como a energia circula entre regiões?", href: "/setor-eletrico/rede" }],
  },
  {
    slug: "intercambio-internacional",
    nome: "Intercâmbio com outros países",
    grupo: "Operação",
    estado: "CONFERIDO",
    conferidoEm: "2026-09-30",
    emUmaFrase:
      "Fluxo de energia entre o SIN e um país vizinho, medido pela soma dos fluxos de potência ativa nas conversoras de frequência de fronteira; positivo é exportação do Brasil.",
    porQueImporta:
      "O intercâmbio do Sul com os países vizinhos não está no conjunto das fronteiras entre subsistemas; sem ele, as contas de energia do Sul e do SIN ficam incompletas.",
    comoEMedido:
      "Em MWmed, por hora e por país, no conjunto Intercâmbio do SIN com Outros Países do ONS: Argentina pelas conversoras de Garabi I, Garabi II e Uruguaiana; Uruguai por Melo e Rivera; Paraguai por Acaray.",
    relacoes: ["intercambio", "sin"],
    fontes: [
      DIC_INTERNACIONAL(
        "As grandezas representam a soma das medidas de fluxo de potência ativa nas conversoras de frequência de fronteira entre os dois países. O intercâmbio com a Argentina pode ser realizado pelas conversoras de Garabi I, Garabi II e Uruguaiana. O intercâmbio com o Uruguai pode ser realizado pelas conversoras de Melo e Rivera. O intercâmbio com o Paraguai pode ser realizado pela conversora de Acaray.",
      ),
      DIC_INTERNACIONAL("Dados positivos indicam exportação de energia do Brasil para outros países; dados negativos indicam importação de energia do Brasil de outros países."),
    ],
    limitacoes: ["Itaipu é publicada pelo ONS como geração de uma usina, não como intercâmbio com o Paraguai."],
    vejaNoPortal: [{ rotulo: "De onde vem a diferença de energia?", href: "/setor-eletrico/rede/balanco-e-exterior" }],
  },
  {
    slug: "atls",
    sigla: "ATLS",
    nome: "Atendimento aos Limites Sistêmicos",
    grupo: "Operação",
    estado: "CONFERIDO",
    conferidoEm: "2026-09-30",
    emUmaFrase:
      "Percentual do tempo em que fluxos selecionados pelo ONS operaram dentro das faixas de segurança recomendadas pelos estudos elétricos; o complemento é o tempo acima do limite.",
    porQueImporta: "É a evidência pública de quanto tempo fluxos importantes da rede passaram fora da faixa de segurança, mesmo sem a publicação dos limites.",
    comoEMedido:
      "ATLS = (1 − A/B) × 100%, com A o somatório dos tempos de violação das faixas de segurança e B o período total de observação; intervalos de violação com menos de 10 minutos não contam, e há uma banda morta de 50 MW ou 5% do limite da faixa, o que for maior. Agregação mensal e anual.",
    relacoes: ["intercambio"],
    fontes: [
      SUBMODULO_9_1(
        "É o percentual de tempo em que os fluxos, definidos nos documentos normativos da operação e selecionados como relevantes para avaliação da segurança elétrica, operaram dentro das faixas de segurança recomendadas pelos estudos elétricos específicos.",
      ),
      SUBMODULO_9_1(
        "A = Somatório dos tempos de violação das faixas de segurança recomendadas pelos estudos elétricos específicos no período da agregação considerada. Não são considerados intervalos de tempo de violação com duração inferior a 10 (dez) minutos. B = Período total de observação da agregação considerada.",
      ),
      SUBMODULO_9_1("É considerado, no cálculo do indicador, uma banda morta de 50 MW ou 5% do limite da faixa, o que for maior."),
    ],
    limitacoes: [
      "O indicador não publica o valor do limite nem a folga de cada fluxo.",
      "O arquivo de dados do ONS traz o valor em fração de 0 a 1, embora o dicionário diga percentual.",
    ],
    vejaNoPortal: [{ rotulo: "Quando há evidência publicada de limitação da rede?", href: "/setor-eletrico/rede/restricoes" }],
  },
];
