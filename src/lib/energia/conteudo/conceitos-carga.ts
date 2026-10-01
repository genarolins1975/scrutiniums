import type { Conceito, FonteOficial } from "./conceitos";

/**
 * Verbetes do módulo carga. Mesma regra da base (conceitos.ts): nenhuma definição de
 * memória; CONFERIDO só com o documento primário acessado na data indicada. Um
 * verbete com o slug de um verbete base o substitui.
 *
 * Fontes, acessadas em 01/10/2026 às 03h50 de Brasília (06h50 UTC): a descrição de três
 * conjuntos no portal de dados abertos do ONS (CKAN package_show de "carga-energia",
 * "curva-carga" e "carga-energia-verificada"; sha256 das respostas 23e2ebe1500a…,
 * 7d5d7cd11e6c… e 99722c851291…) e os dicionários de dados em JSON da curva de carga
 * (DicionarioDados_CurvaCarga.json, sha256 4dc6b8166eae…) e da carga verificada
 * (DicionarioDados_Carga_Verificada.json, sha256 a3362aea962f…). Os trechos são
 * literais. A MMGD tem verbete próprio na base (geracao-distribuida).
 *
 * O verbete "carga" substitui o da base para separar a data que o ONS declara para a
 * inclusão da MMGD (29/04/2023, citada literalmente) da data em que o degrau aparece
 * nos dados publicados (01/05/2023), que é constatação do observatório com evidência
 * no painel de perfil horário, não definição da fonte.
 */

const CKAN = (id: string, titulo: string, trecho: string, parafrase?: string): FonteOficial => ({
  orgao: "ONS",
  documento: `Portal de dados abertos, conjunto "${titulo}" (descrição do conjunto, acessada em 01/10/2026)`,
  url: `https://dados.ons.org.br/dataset/${id}`,
  trecho,
  parafrase,
});

const DIC_VERIFICADA: (trecho: string) => FonteOficial = (trecho) => ({
  orgao: "ONS",
  documento: "Dicionário de dados da Carga de Energia Verificada (DicionarioDados_Carga_Verificada.json), acessado em 01/10/2026",
  url: "https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/carga_verificada_tm/DicionarioDados_Carga_Verificada.json",
  trecho,
});

const TRECHO_CARGA_DIARIA =
  "Até fevereiro/2021, os dados representam a carga atendida por usinas despachadas e/ou programadas pelo ONS, com base em dados recebidos pelo Sistema de Supervisão e Controle do ONS. Entre março/2021 e abril/23, os dados representam a carga atendida por usinas despachadas e/ou programadas pelo ONS, com base em dados recebidos pelo Sistema de Supervisão e Controle do ONS, mais a previsão de geração de usinas não despachadas pelo ONS. A partir de 29/04/2023, além dos dados anteriormente considerados, passou a ser incorporado o valor estimado da micro e minigeração distribuída (MMGD), com base em dados meteorológicos previstos.";
const TRECHO_VERIFICADA =
  "Dados de carga verificada na periodicidade semi-horária por área de carga e suas componentes de parcela supervisionada pelo ONS, parcela proveniente dos dados de medição (geração tipo I, IIA, IIB, IIC e intercâmbios), parcela proveniente do sistema de medição para faturamento da CCEE (geração tipo III), parcela atendida por micro e mini geração distribuída (MMGD), parcela atendida por redução de demanda, e os valores das consistências feitas para os modelos de previsão, quando ocorrerem.";

const VEJA = [{ rotulo: "Carga", href: "/setor-eletrico/carga" }];
const VEJA_PERFIL = [{ rotulo: "MMGD e perfil horário", href: "/setor-eletrico/carga/perfil-horario#p026" }];

export const CONCEITOS: Conceito[] = [
  {
    slug: "carga",
    nome: "Carga de energia",
    grupo: "Operação",
    estado: "CONFERIDO",
    conferidoEm: "2026-10-01",
    emUmaFrase:
      "Carga atendida no sistema interligado, publicada pelo ONS por subsistema em base diária, em MWmed; o que entra na conta mudou em março de 2021 e em abril de 2023.",
    porQueImporta: "É o lado da demanda no balanço de energia que o ONS publica por subsistema, ao lado da geração das usinas.",
    comoEMedido:
      "Em MWmed, por subsistema e dia. Até fevereiro de 2021, carga atendida por usinas despachadas ou programadas pelo ONS; de março de 2021 a abril de 2023, soma-se a previsão de usinas não despachadas; a partir da data que o ONS declara, 29/04/2023, soma-se a estimativa da micro e minigeração distribuída, feita com dados meteorológicos previstos.",
    relacoes: ["curva-de-carga", "carga-global", "geracao-distribuida"],
    fontes: [
      CKAN(
        "carga-energia",
        "Carga de Energia Diária",
        TRECHO_CARGA_DIARIA,
        "Em outras palavras: o que a carga inclui mudou duas vezes; desde 29/04/2023, segundo o ONS, ela inclui uma estimativa da micro e minigeração distribuída feita com previsão do tempo.",
      ),
    ],
    limitacoes: [
      "Comparações que atravessam 01/03/2021 ou a inclusão da MMGD não são homogêneas.",
      "Nos dados publicados, o degrau da inclusão da MMGD aparece em 01/05/2023, não na data declarada (29/04/2023); 29 e 30/04/2023 ficam fora das comparações.",
      "A MMGD está dentro da carga, mas o ONS não a publica separada nesse conjunto.",
    ],
    vejaNoPortal: [...VEJA, ...VEJA_PERFIL],
  },
  {
    slug: "curva-de-carga",
    nome: "Curva de carga horária",
    grupo: "Operação",
    estado: "CONFERIDO",
    conferidoEm: "2026-10-01",
    emUmaFrase: "Perfil de consumo de energia elétrica hora a hora, publicado pelo ONS por subsistema, em MWmed.",
    porQueImporta: "Mostra a que horas o sistema demanda mais energia e quando ocorre o pico do dia.",
    comoEMedido: "Um valor por subsistema e hora: o valor da carga de energia, em MWmed.",
    relacoes: ["carga", "carga-global"],
    fontes: [
      CKAN("curva-carga", "Curva de Carga Horária", "Dados de curva de carga horária, que representam o perfil de consumo de energia elétrica com discretização horária."),
      {
        orgao: "ONS",
        documento: "Dicionário de dados da Curva de Carga Horária (DicionarioDados_CurvaCarga.json), acessado em 01/10/2026",
        url: "https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/curva-carga-ho/DicionarioDados_CurvaCarga.json",
        trecho: "Valor da Carga de Energia, em MWmed",
      },
    ],
    limitacoes: [
      "Inclui a estimativa de MMGD do ONS sem separá-la.",
      "Nos dados publicados, a média das 24 horas de um dia reproduz a carga diária (conferência do observatório): é o mesmo produto em outro grão, não uma fonte independente.",
      "Antes de 2019, no dia de início do horário de verão, a hora que não existe no relógio local vem vazia (ou zero) e o dia tem 23 horas.",
    ],
    vejaNoPortal: VEJA_PERFIL,
  },
  {
    slug: "carga-global",
    nome: "Carga global (carga verificada)",
    grupo: "Operação",
    estado: "CONFERIDO",
    conferidoEm: "2026-10-01",
    emUmaFrase:
      "Carga verificada pelo ONS a cada meia hora por área de carga, com as componentes publicadas: parcela supervisionada pelo ONS, parcela medida pela CCEE, parcela atendida por micro e minigeração distribuída e, quando ocorrem, redução de demanda e consistências.",
    porQueImporta: "É o conjunto em que o ONS publica a parcela atendida por MMGD separada do restante da carga.",
    comoEMedido: "Em MWmed integralizado no fim de cada meia hora (horário UTC), por área de carga.",
    relacoes: ["carga-liquida-de-mmgd", "geracao-distribuida", "curva-de-carga"],
    fontes: [
      CKAN("carga-energia-verificada", "Carga de Energia Verificada", TRECHO_VERIFICADA),
      DIC_VERIFICADA("Valor da Carga Global em MWmed integralizada no final do intervalo da semi-hora"),
    ],
    limitacoes: [
      "A parcela de MMGD é estimativa do ONS, não medição; a carga global é, portanto, observada com um componente estimado.",
      "Não é a mesma grandeza da curva de carga horária: nos dados publicados, a carga global do SIN fica acima da curva nas mesmas horas (painel MMGD e perfil horário, modo Auditar).",
    ],
    vejaNoPortal: VEJA_PERFIL,
  },
  {
    slug: "carga-liquida-de-mmgd",
    nome: "Carga global líquida de MMGD",
    grupo: "Operação",
    estado: "CONFERIDO",
    conferidoEm: "2026-10-01",
    emUmaFrase: "Carga global da carga verificada sem a parcela atendida por micro e minigeração distribuída, publicada pelo ONS a cada meia hora.",
    porQueImporta: "Separa a parte da carga que o ONS estima como atendida pela micro e minigeração distribuída do restante da carga verificada.",
    comoEMedido:
      "Em MWmed integralizado no fim de cada meia hora. Nos dados publicados, carga global = carga líquida de MMGD + carga atendida por MMGD em todas as meias horas conferidas.",
    relacoes: ["carga-global", "geracao-distribuida"],
    fontes: [
      DIC_VERIFICADA("Valor da Carga Global líquida de MMGD em MWmed integralizada no final do intervalo da semi-hora"),
      DIC_VERIFICADA("Valor da Carga atendida por MMGD em MWmed integralizada no final do intervalo da semi-hora"),
    ],
    limitacoes: ["Não se obtém subtraindo a MMGD da curva de carga horária: os dois produtos têm definições diferentes."],
    vejaNoPortal: VEJA_PERFIL,
  },
];
