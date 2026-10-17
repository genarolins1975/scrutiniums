import type { Conceito, FonteOficial } from "./conceitos";
import { montarNosDoisIdiomas, type TxIdioma } from "@/lib/energia/i18n/aprenda";

/**
 * Verbetes do módulo regulacao. Mesma regra da base (conceitos.ts): nenhuma definição de
 * memória; CONFERIDO só com o documento primário acessado na data indicada. Um
 * verbete com o slug de um verbete base o substitui.
 *
 * Fontes dos dois verbetes, acessadas em 30/09/2026 (captura do bronze às 20h05 de
 * Brasília) e relidas com pdftotext para conferir cada trecho, com espaços e quebras de
 * linha normalizados:
 *  - Resolução Normativa ANEEL nº 1.032, de 26 de julho de 2022, arts. 22 a 24: PDF
 *    original obtido na cópia pública do Internet Archive (modo id_, bytes da origem),
 *    sha256 df67f43f224838a7c9c3aed26accd485ea089094ac2b7a0ed3d6d66bf800f775, o mesmo
 *    registrado em pipeline/energia/regulatorio/documentos.json;
 *  - Portaria ANEEL nº 7.030, de 2 de dezembro de 2025, arts. 1º e 2º: PDF com sha256
 *    d3616e09c45b90967c52f647afcda73a475f3c3b2342d86bd2c6d6ac5b14208e.
 * O endereço oficial (www2.aneel.gov.br/cedoc) respondeu com desafio de navegador e não
 * foi contornado; o link do verbete é o oficial, e a cópia lida fica no documento.
 */

const URL_REN1032 = "https://www2.aneel.gov.br/cedoc/ren20221032.pdf";
const URL_PRT7030 = "https://www2.aneel.gov.br/cedoc/prt20257030.pdf";

function montarConceitos(tx: TxIdioma): Conceito[] {
  const DOC_REN1032 =
    tx("Resolução Normativa ANEEL nº 1.032, de 26 de julho de 2022 (texto lido na cópia pública do Internet Archive de 14/04/2024; endereço e sha256 no módulo Regulação)", "ANEEL Normative Resolution (REN) No. 1.032 of Jul 26, 2022 (text read in the public Internet Archive copy of Apr 14, 2024; address and sha256 in the Regulation module)");
  const DOC_PRT7030 =
    tx("Portaria ANEEL nº 7.030, de 2 de dezembro de 2025 (texto lido na cópia pública do Internet Archive de 15/01/2026; endereço e sha256 no módulo Regulação)", "ANEEL Ordinance No. 7.030 of Dec 2, 2025 (text read in the public Internet Archive copy of Jan 15, 2026; address and sha256 in the Regulation module)");
  const ren1032 = (trecho: string, parafrase?: string): FonteOficial => ({ orgao: "ANEEL", documento: DOC_REN1032, url: URL_REN1032, trecho, parafrase });
  const prt7030 = (trecho: string, parafrase?: string): FonteOficial => ({ orgao: "ANEEL", documento: DOC_PRT7030, url: URL_PRT7030, trecho, parafrase });
  return [
    {
      slug: "limites-do-pld",
      nome: tx("Limites do PLD (piso, teto estrutural e teto horário)", "PLD limits (floor, structural ceiling and hourly ceiling)"),
      grupo: "Preço", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-09-30",
      emUmaFrase:
        tx("Valores que a ANEEL fixa a cada ano para o PLD: um piso, um teto para cada hora (teto horário) e um teto para a média diária dos preços horários (teto estrutural).", "Values that ANEEL sets each year for the PLD: a floor, a ceiling for each hour (hourly ceiling) and a ceiling for the daily average of hourly prices (structural ceiling)."),
      porQueImporta:
        tx("Sem os limites, um preço no piso parece só um preço baixo e um preço no teto parece só um preço alto. Os limites mudam a cada ano por ato da ANEEL, e a data em que o ato sai no Diário Oficial é diferente da data em que ele passa a valer.", "Without the limits, a price at the floor looks like just a low price and a price at the ceiling looks like just a high price. The limits change each year by an ANEEL act, and the date on which the act appears in the Official Gazette is different from the date on which it takes effect."),
      comoEMedido:
        tx("Em R$/MWh, por ano civil. Os tetos são atualizados anualmente pelo IPCA; o piso é o maior valor entre duas tarifas de otimização das hidrelétricas. O observatório publica o valor escrito em cada ato, com publicação e vigência separadas, no painel de limites da Regulação.", "In R$/MWh, by calendar year. The ceilings are updated annually by the IPCA; the floor is the greater of two hydropower optimization tariffs. The observatory publishes the value written in each act, with publication and effective date separated, in the limits panel of Regulation."),
      relacoes: ["pld", "mcp"],
      fontes: [
        ren1032(
          // i18n: dado
          "Art. 22. Ficam estabelecidos dois limites máximos do PLD: I - um limite máximo estrutural (PLDmax_estrutural); e II - um limite máximo horário (PLDmax_horário).",
          tx("Em outras palavras: há dois tetos, um estrutural e um horário.", "In other words: there are two ceilings, a structural one and an hourly one."),
        ),
        ren1032(
          // i18n: dado
          "§ 3º A partir da vigência do PLDmax_horário, caso a média diária dos PLDs horários for superior ao PLDmax_estrutural, a CCEE deve ajustar a série de PLDs horários até que a média de seus valores seja igual ao PLDmax_estrutural.",
          tx("Em outras palavras: o teto horário limita cada hora; o teto estrutural limita a média do dia, e a CCEE ajusta as horas quando a média passa dele.", "In other words: the hourly ceiling limits each hour; the structural ceiling limits the average of the day, and the CCEE adjusts the hours when the average exceeds it."),
        ),
        ren1032(
          // i18n: dado
          "§ 1º Os limites máximos do PLD serão atualizados pela ANEEL anualmente pela variação do Índice Nacional de Preços ao Consumidor Amplo (IPCA) a partir dos seguintes valores, a preços de setembro de 2019:",
          tx("Em outras palavras: os tetos são corrigidos todo ano pela inflação medida pelo IPCA.", "In other words: the ceilings are corrected every year by the inflation measured by the IPCA."),
        ),
        ren1032(
          // i18n: dado
          "Art. 24. O valor mínimo do PLD será calculado anualmente pela ANEEL considerando o maior valor entre: I - a Tarifa de Energia de Otimização da UHE Itaipu (TEOItaipu); e II - a Tarifa de Energia de Otimização (TEO) das outras usinas hidrelétricas do Sistema Interligado Nacional.",
          tx("Em outras palavras: o piso é a maior entre a tarifa de otimização de Itaipu e a das demais hidrelétricas.", "In other words: the floor is the greater of the Itaipu optimization tariff and that of the other hydropower plants."),
        ),
      ],
      limitacoes: [
        tx("Os atos anuais encadeiam o teto publicado no ano anterior pela variação do IPCA de novembro; a aplicação literal do art. 23, § 1º, a partir dos valores de setembro de 2019, não reproduz os valores publicados (diferenças de centavos, medidas no painel de limites).", "The annual acts chain the ceiling published in the previous year by the November IPCA change; applying art. 23, § 1 literally, from the September 2019 values, does not reproduce the published values (differences of cents, measured in the limits panel)."),
        tx("Os valores são nominais: comparar anos exige deflator.", "The values are nominal: comparing years requires a deflator."),
      ],
      vejaNoPortal: [
        { rotulo: tx("Limites e regras de preço", "Price limits and rules"), href: "/setor-eletrico/regulacao" },
        { rotulo: "PLD", href: "/setor-eletrico/pld" },
      ],
    },
    {
      slug: "agenda-regulatoria",
      nome: tx("Agenda Regulatória da ANEEL", "ANEEL Regulatory Agenda"),
      grupo: "Regulação", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-09-30",
      emUmaFrase: tx("Lista, aprovada por portaria da ANEEL para um biênio, das atividades regulatórias com previsão de edição de norma no período.", "List, approved by an ANEEL ordinance for a two-year period, of the regulatory activities expected to result in a norm in the period."),
      porQueImporta:
        tx("Mostra o que a agência pretende decidir e em que ano. O ano é previsão e pode ser reprogramado nas revisões da agenda; não é data de decisão.", "It shows what the agency intends to decide and in which year. The year is a forecast and may be rescheduled in the agenda reviews; it is not a decision date."),
      comoEMedido:
        tx("Cada atividade tem um código e o ano previsto. O observatório lê o Anexo I da portaria vigente e liga cada atividade aos painéis por palavra-chave do texto e às consultas cujas atas citam o código.", "Each activity has a code and the expected year. The observatory reads Annex I of the ordinance in force and links each activity to the panels by keywords in the text and to the consultations whose minutes cite the code."),
      relacoes: ["limites-do-pld"],
      fontes: [
        // i18n: dado
        prt7030("Art. 1º Aprovar a Agenda Regulatória da ANEEL para o biênio 2026-2027 na forma do Anexo I desta Portaria."),
        prt7030(
          // i18n: dado
          "I. Agenda Regulatória: aquelas que possuem previsão de edição de norma na vigência do ciclo;",
          tx("Em outras palavras: entram na agenda as atividades em que se prevê editar uma norma dentro do biênio.", "In other words: the agenda includes the activities in which a norm is expected to be issued within the two-year period."),
        ),
      ],
      limitacoes: [
        tx("A primeira revisão da agenda 2026-2027 (Portaria nº 7.157, de 8 de setembro de 2026) não pôde ser lida: o endereço publicado pela página oficial respondeu com bloqueio de navegador.", "The first review of the 2026-2027 agenda (Ordinance No. 7.157 of Sep 8, 2026) could not be read: the address published by the official page responded with a browser block."),
      ],
      vejaNoPortal: [{ rotulo: tx("Consultas e agenda", "Consultations and agenda"), href: "/setor-eletrico/regulacao/consultas-e-agenda#agenda" }],
    },
  ];
}
export const CONCEITOS_IDIOMAS = montarNosDoisIdiomas(montarConceitos);
export const CONCEITOS: Conceito[] = CONCEITOS_IDIOMAS.pt;
