import type { Conceito, FonteOficial } from "./conceitos";

/**
 * Verbetes do módulo mercado. Mesma regra da base (conceitos.ts): nenhuma definição de
 * memória; CONFERIDO só com o documento primário acessado na data indicada. Um
 * verbete com o slug de um verbete base o substitui.
 *
 * Fonte do verbete MRE: glossário do InfoMercado mensal Nº 229 da CCEE (julho de 2026,
 * publicado em 10/09/2026), página 12, capturado pelo pipeline em 06/10/2026 às 17h01 de
 * Brasília (sha256 c7efe73d4792c5ddda3148d68b4de8de840ad9f47187212e2a79c3bb4054aae5). O
 * trecho é literal. ACL, ACR, GSF, ESS e garantia física continuam pendentes: o mesmo
 * glossário não os define, e as definições operacionais do módulo (gold mercado.json,
 * bloco "definicoes") são método do observatório, não documento primário.
 */

const URL_IM_229 = "https://www.ccee.org.br/documents/80415/35773859/InfoMercado-mensal_JUL_26_229.pdf/92b947aa-21df-f603-a4dc-87876f30a94a";

const im229 = (trecho: string, parafrase?: string): FonteOficial => ({
  orgao: "CCEE",
  documento: "InfoMercado mensal Nº 229 (julho de 2026), seção 12, Glossário, página 12",
  url: URL_IM_229,
  trecho,
  parafrase,
});

export const CONCEITOS: Conceito[] = [
  {
    slug: "mre",
    sigla: "MRE",
    nome: "Mecanismo de Realocação de Energia",
    grupo: "Mercado",
    estado: "CONFERIDO",
    conferidoEm: "2026-10-06",
    emUmaFrase: "Mecanismo pelo qual as hidrelétricas do sistema interligado compartilham os riscos hidrológicos de uma operação decidida pelo despacho centralizado.",
    porQueImporta:
      "Como a geração de cada hidrelétrica é decidida pelo despacho centralizado do sistema, o risco hidrológico é compartilhado entre as usinas participantes, em vez de ficar com cada uma isoladamente.",
    comoEMedido:
      "No observatório, pelo GSF: geração das usinas do MRE dividida pela garantia física modulada e ajustada pelo fator de disponibilidade, calculada com os conjuntos abertos da CCEE e conferida com o fator publicado no InfoMercado.",
    relacoes: ["gsf", "garantia-fisica", "mcp"],
    fontes: [
      im229(
        "MRE – Mecanismo de compartilhamento dos riscos hidrológicos associados à otimização eletroenergética do SIN, por meio do despacho centralizado das unidades de geração de energia elétrica.",
        "Em outras palavras: as usinas dividem entre si o risco ligado à água, porque a operação do sistema interligado é otimizada e despachada de forma centralizada.",
      ),
    ],
    limitacoes: [
      "O glossário do InfoMercado define o mecanismo, não a fórmula do fator de ajuste; a razão usada no observatório é a que reproduz o fator mensal publicado pela CCEE, e a divergência com o número de 12 meses do InfoMercado está publicada no painel.",
    ],
    vejaNoPortal: [{ rotulo: "Mercado: MRE e GSF", href: "/setor-eletrico/mercado/mre-e-gsf" }],
  },
];
