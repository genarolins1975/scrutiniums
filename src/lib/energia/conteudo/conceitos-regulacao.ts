import type { Conceito, FonteOficial } from "./conceitos";

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
const DOC_REN1032 =
  "Resolução Normativa ANEEL nº 1.032, de 26 de julho de 2022 (texto lido na cópia pública https://web.archive.org/web/20240414122616id_/https://www2.aneel.gov.br/cedoc/ren20221032.pdf, sha256 df67f43f2248)";
const URL_PRT7030 = "https://www2.aneel.gov.br/cedoc/prt20257030.pdf";
const DOC_PRT7030 =
  "Portaria ANEEL nº 7.030, de 2 de dezembro de 2025 (texto lido na cópia pública https://web.archive.org/web/20260115144238id_/https://www2.aneel.gov.br/cedoc/prt20257030.pdf, sha256 d3616e09c45b)";

const ren1032 = (trecho: string, parafrase?: string): FonteOficial => ({ orgao: "ANEEL", documento: DOC_REN1032, url: URL_REN1032, trecho, parafrase });
const prt7030 = (trecho: string, parafrase?: string): FonteOficial => ({ orgao: "ANEEL", documento: DOC_PRT7030, url: URL_PRT7030, trecho, parafrase });

export const CONCEITOS: Conceito[] = [
  {
    slug: "limites-do-pld",
    nome: "Limites do PLD (piso, teto estrutural e teto horário)",
    grupo: "Preço",
    estado: "CONFERIDO",
    conferidoEm: "2026-09-30",
    emUmaFrase:
      "Valores que a ANEEL fixa a cada ano para o PLD: um piso, um teto para cada hora (teto horário) e um teto para a média diária dos preços horários (teto estrutural).",
    porQueImporta:
      "Sem os limites, um preço no piso parece só um preço baixo e um preço no teto parece só um preço alto. Os limites mudam a cada ano por ato da ANEEL, e a data em que o ato sai no Diário Oficial é diferente da data em que ele passa a valer.",
    comoEMedido:
      "Em R$/MWh, por ano civil. Os tetos são atualizados anualmente pelo IPCA; o piso é o maior valor entre duas tarifas de otimização das hidrelétricas. O observatório publica o valor escrito em cada ato, com publicação e vigência separadas, no painel de limites da Regulação.",
    relacoes: ["pld", "mcp"],
    fontes: [
      ren1032(
        "Art. 22. Ficam estabelecidos dois limites máximos do PLD: I - um limite máximo estrutural (PLDmax_estrutural); e II - um limite máximo horário (PLDmax_horário).",
        "Em outras palavras: há dois tetos, um estrutural e um horário.",
      ),
      ren1032(
        "§ 3º A partir da vigência do PLDmax_horário, caso a média diária dos PLDs horários for superior ao PLDmax_estrutural, a CCEE deve ajustar a série de PLDs horários até que a média de seus valores seja igual ao PLDmax_estrutural.",
        "Em outras palavras: o teto horário limita cada hora; o teto estrutural limita a média do dia, e a CCEE ajusta as horas quando a média passa dele.",
      ),
      ren1032(
        "§ 1º Os limites máximos do PLD serão atualizados pela ANEEL anualmente pela variação do Índice Nacional de Preços ao Consumidor Amplo (IPCA) a partir dos seguintes valores, a preços de setembro de 2019:",
        "Em outras palavras: os tetos são corrigidos todo ano pela inflação medida pelo IPCA.",
      ),
      ren1032(
        "Art. 24. O valor mínimo do PLD será calculado anualmente pela ANEEL considerando o maior valor entre: I - a Tarifa de Energia de Otimização da UHE Itaipu (TEOItaipu); e II - a Tarifa de Energia de Otimização (TEO) das outras usinas hidrelétricas do Sistema Interligado Nacional.",
        "Em outras palavras: o piso é a maior entre a tarifa de otimização de Itaipu e a das demais hidrelétricas.",
      ),
    ],
    limitacoes: [
      "Os atos anuais encadeiam o teto publicado no ano anterior pela variação do IPCA de novembro; a aplicação literal do art. 23, § 1º, a partir dos valores de setembro de 2019, não reproduz os valores publicados (diferenças de centavos, medidas no painel de limites).",
      "Os valores são nominais: comparar anos exige deflator.",
    ],
    vejaNoPortal: [
      { rotulo: "Limites e regras de preço", href: "/setor-eletrico/regulacao" },
      { rotulo: "PLD", href: "/setor-eletrico/pld" },
    ],
  },
  {
    slug: "agenda-regulatoria",
    nome: "Agenda Regulatória da ANEEL",
    grupo: "Regulação",
    estado: "CONFERIDO",
    conferidoEm: "2026-09-30",
    emUmaFrase: "Lista, aprovada por portaria da ANEEL para um biênio, das atividades regulatórias com previsão de edição de norma no período.",
    porQueImporta:
      "Mostra o que a agência pretende decidir e em que ano. O ano é previsão e pode ser reprogramado nas revisões da agenda; não é data de decisão.",
    comoEMedido:
      "Cada atividade tem um código e o ano previsto. O observatório lê o Anexo I da portaria vigente e liga cada atividade aos painéis por palavra-chave do texto e às consultas cujas atas citam o código.",
    relacoes: ["limites-do-pld"],
    fontes: [
      prt7030("Art. 1º Aprovar a Agenda Regulatória da ANEEL para o biênio 2026-2027 na forma do Anexo I desta Portaria."),
      prt7030(
        "I. Agenda Regulatória: aquelas que possuem previsão de edição de norma na vigência do ciclo;",
        "Em outras palavras: entram na agenda as atividades em que se prevê editar uma norma dentro do biênio.",
      ),
    ],
    limitacoes: [
      "A primeira revisão da agenda 2026-2027 (Portaria nº 7.157, de 8 de setembro de 2026) não pôde ser lida: o endereço publicado pela página oficial respondeu com bloqueio de navegador.",
    ],
    vejaNoPortal: [{ rotulo: "Consultas e agenda", href: "/setor-eletrico/regulacao/consultas-e-agenda#agenda" }],
  },
];
