import type { Conceito, FonteOficial } from "./conceitos";
import { montarNosDoisIdiomas, type TxIdioma } from "@/lib/energia/i18n/aprenda";

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

const TRECHO_CARGA_DIARIA =
  // i18n: dado
  "Até fevereiro/2021, os dados representam a carga atendida por usinas despachadas e/ou programadas pelo ONS, com base em dados recebidos pelo Sistema de Supervisão e Controle do ONS. Entre março/2021 e abril/23, os dados representam a carga atendida por usinas despachadas e/ou programadas pelo ONS, com base em dados recebidos pelo Sistema de Supervisão e Controle do ONS, mais a previsão de geração de usinas não despachadas pelo ONS. A partir de 29/04/2023, além dos dados anteriormente considerados, passou a ser incorporado o valor estimado da micro e minigeração distribuída (MMGD), com base em dados meteorológicos previstos.";
const TRECHO_VERIFICADA =
  // i18n: dado
  "Dados de carga verificada na periodicidade semi-horária por área de carga e suas componentes de parcela supervisionada pelo ONS, parcela proveniente dos dados de medição (geração tipo I, IIA, IIB, IIC e intercâmbios), parcela proveniente do sistema de medição para faturamento da CCEE (geração tipo III), parcela atendida por micro e mini geração distribuída (MMGD), parcela atendida por redução de demanda, e os valores das consistências feitas para os modelos de previsão, quando ocorrerem.";

function montarConceitos(tx: TxIdioma): Conceito[] {
  const CKAN = (id: string, titulo: string, trecho: string, parafrase?: string): FonteOficial => ({
    orgao: "ONS",
    documento: tx(`Portal de dados abertos, conjunto "${titulo}" (descrição do conjunto, acessada em 01/10/2026)`, `Open data portal, dataset «${titulo}» (dataset description, accessed on Oct 1, 2026)`),
    url: `https://dados.ons.org.br/dataset/${id}`,
    trecho,
    parafrase,
  });
  const DIC_VERIFICADA: (trecho: string) => FonteOficial = (trecho) => ({
    orgao: "ONS",
    documento: tx("Dicionário de dados da Carga de Energia Verificada (DicionarioDados_Carga_Verificada.json), acessado em 01/10/2026", "Data dictionary of the «Carga de Energia Verificada» dataset (DicionarioDados_Carga_Verificada.json), accessed on Oct 1, 2026"),
    url: "https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/carga_verificada_tm/DicionarioDados_Carga_Verificada.json",
    trecho,
  });
  const VEJA = [{ rotulo: tx("Carga", "Load"), href: "/setor-eletrico/carga" }];
  const VEJA_PERFIL = [{ rotulo: tx("MMGD e perfil horário", "MMGD and hourly profile"), href: "/setor-eletrico/carga/perfil-horario#p026" }];
  return [
    {
      slug: "carga",
      nome: tx("Carga de energia", "Energy load"),
      grupo: "Operação", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-10-01",
      emUmaFrase:
        tx("Carga atendida no sistema interligado, publicada pelo ONS por subsistema em base diária, em MWmed; o que entra na conta mudou em março de 2021 e em abril de 2023.", "Load served in the interconnected system, published by the ONS by subsystem on a daily basis, in MWavg; what goes into the figure changed in March 2021 and in April 2023."),
      porQueImporta: tx("É o lado da demanda no balanço de energia que o ONS publica por subsistema, ao lado da geração das usinas.", "It is the demand side of the energy balance that the ONS publishes by subsystem, alongside the generation of the plants."),
      comoEMedido:
        tx("Em MWmed, por subsistema e dia. Até fevereiro de 2021, carga atendida por usinas despachadas ou programadas pelo ONS; de março de 2021 a abril de 2023, soma-se a previsão de usinas não despachadas; a partir da data que o ONS declara, 29/04/2023, soma-se a estimativa da micro e minigeração distribuída, feita com dados meteorológicos previstos.", "In MWavg, by subsystem and day. Until February 2021, load served by plants dispatched or scheduled by the ONS; from March 2021 to April 2023, the forecast of plants not dispatched is added; from the date the ONS declares, Apr 29, 2023, the estimate of distributed micro and mini generation is added, made with forecast weather data."),
      relacoes: ["curva-de-carga", "carga-global", "geracao-distribuida"],
      fontes: [
        CKAN(
          "carga-energia",
          // i18n: dado
          "Carga de Energia Diária",
          TRECHO_CARGA_DIARIA,
          tx("Em outras palavras: o que a carga inclui mudou duas vezes; desde 29/04/2023, segundo o ONS, ela inclui uma estimativa da micro e minigeração distribuída feita com previsão do tempo.", "In other words: what the load includes changed twice; since Apr 29, 2023, according to the ONS, it includes an estimate of distributed micro and mini generation made with weather forecasts."),
        ),
      ],
      limitacoes: [
        tx("Comparações que atravessam 01/03/2021 ou a inclusão da MMGD não são homogêneas.", "Comparisons that cross Mar 1, 2021 or the inclusion of MMGD are not homogeneous."),
        tx("Nos dados publicados, o degrau da inclusão da MMGD aparece em 01/05/2023, não na data declarada (29/04/2023); 29 e 30/04/2023 ficam fora das comparações.", "In the published data, the step from the inclusion of MMGD appears on May 1, 2023, not on the declared date (Apr 29, 2023); Apr 29 and 30, 2023 are excluded from the comparisons."),
        tx("A MMGD está dentro da carga, mas o ONS não a publica separada nesse conjunto.", "MMGD is inside the load, but the ONS does not publish it separately in this dataset."),
      ],
      vejaNoPortal: [...VEJA, ...VEJA_PERFIL],
    },
    {
      slug: "curva-de-carga",
      nome: tx("Curva de carga horária", "Hourly load curve"),
      grupo: "Operação", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-10-01",
      emUmaFrase: tx("Perfil de consumo de energia elétrica hora a hora, publicado pelo ONS por subsistema, em MWmed.", "Hour-by-hour electricity consumption profile, published by the ONS by subsystem, in MWavg."),
      porQueImporta: tx("Mostra a que horas o sistema demanda mais energia e quando ocorre o pico do dia.", "It shows at what times the system demands the most energy and when the daily peak occurs."),
      comoEMedido: tx("Um valor por subsistema e hora: o valor da carga de energia, em MWmed.", "One value per subsystem and hour: the energy load value, in MWavg."),
      relacoes: ["carga", "carga-global"],
      fontes: [
        // i18n: dado
        CKAN("curva-carga", "Curva de Carga Horária", "Dados de curva de carga horária, que representam o perfil de consumo de energia elétrica com discretização horária."),
        {
          orgao: "ONS",
          documento: tx("Dicionário de dados da Curva de Carga Horária (DicionarioDados_CurvaCarga.json), acessado em 01/10/2026", "Data dictionary of the «Curva de Carga Horária» dataset (DicionarioDados_CurvaCarga.json), accessed on Oct 1, 2026"),
          url: "https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/curva-carga-ho/DicionarioDados_CurvaCarga.json",
          // i18n: dado
          trecho: "Valor da Carga de Energia, em MWmed",
        },
      ],
      limitacoes: [
        tx("Inclui a estimativa de MMGD do ONS sem separá-la.", "It includes the ONS estimate of MMGD without separating it."),
        tx("Nos dados publicados, a média das 24 horas de um dia reproduz a carga diária (conferência do observatório): é o mesmo produto em outro grão, não uma fonte independente.", "In the published data, the average of the 24 hours of a day reproduces the daily load (observatory check): it is the same product at another granularity, not an independent source."),
        tx("Antes de 2019, no dia de início do horário de verão, a hora que não existe no relógio local vem vazia (ou zero) e o dia tem 23 horas.", "Before 2019, on the day daylight saving time began, the hour that does not exist on the local clock comes empty (or zero) and the day has 23 hours."),
      ],
      vejaNoPortal: VEJA_PERFIL,
    },
    {
      slug: "carga-global",
      nome: tx("Carga global (carga verificada)", "Global load (verified load)"),
      grupo: "Operação", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-10-01",
      emUmaFrase:
        tx("Carga verificada pelo ONS a cada meia hora por área de carga, com as componentes publicadas: parcela supervisionada pelo ONS, parcela medida pela CCEE, parcela atendida por micro e minigeração distribuída e, quando ocorrem, redução de demanda e consistências.", "Load verified by the ONS every half hour by load area, with the published components: the portion supervised by the ONS, the portion measured by the CCEE, the portion served by distributed micro and mini generation and, when they occur, demand reduction and consistency adjustments."),
      porQueImporta: tx("É o conjunto em que o ONS publica a parcela atendida por MMGD separada do restante da carga.", "It is the dataset in which the ONS publishes the portion served by MMGD separately from the rest of the load."),
      comoEMedido: tx("Em MWmed integralizado no fim de cada meia hora (horário UTC), por área de carga.", "In MWavg integrated at the end of each half hour (UTC time), by load area."),
      relacoes: ["carga-liquida-de-mmgd", "geracao-distribuida", "curva-de-carga"],
      fontes: [
        // i18n: dado
        CKAN("carga-energia-verificada", "Carga de Energia Verificada", TRECHO_VERIFICADA),
        // i18n: dado
        DIC_VERIFICADA("Valor da Carga Global em MWmed integralizada no final do intervalo da semi-hora"),
      ],
      limitacoes: [
        tx("A parcela de MMGD é estimativa do ONS, não medição; a carga global é, portanto, observada com um componente estimado.", "The MMGD portion is an ONS estimate, not a measurement; global load is therefore observed with an estimated component."),
        tx("Não é a mesma grandeza da curva de carga horária: nos dados publicados, a carga global do SIN fica acima da curva nas mesmas horas (painel MMGD e perfil horário, modo Auditar).", "It is not the same quantity as the hourly load curve: in the published data, the global load of the SIN is above the curve in the same hours (MMGD and hourly profile panel, Audit mode)."),
      ],
      vejaNoPortal: VEJA_PERFIL,
    },
    {
      slug: "carga-liquida-de-mmgd",
      nome: tx("Carga global líquida de MMGD", "Global load net of MMGD"),
      grupo: "Operação", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-10-01",
      emUmaFrase: tx("Carga global da carga verificada sem a parcela atendida por micro e minigeração distribuída, publicada pelo ONS a cada meia hora.", "Global load from the verified load without the portion served by distributed micro and mini generation, published by the ONS every half hour."),
      porQueImporta: tx("Separa a parte da carga que o ONS estima como atendida pela micro e minigeração distribuída do restante da carga verificada.", "It separates the part of the load that the ONS estimates as served by distributed micro and mini generation from the rest of the verified load."),
      comoEMedido:
        tx("Em MWmed integralizado no fim de cada meia hora. Nos dados publicados, carga global = carga líquida de MMGD + carga atendida por MMGD em todas as meias horas conferidas.", "In MWavg integrated at the end of each half hour. In the published data, global load = load net of MMGD + load served by MMGD in all half hours checked."),
      relacoes: ["carga-global", "geracao-distribuida"],
      fontes: [
        // i18n: dado
        DIC_VERIFICADA("Valor da Carga Global líquida de MMGD em MWmed integralizada no final do intervalo da semi-hora"),
        // i18n: dado
        DIC_VERIFICADA("Valor da Carga atendida por MMGD em MWmed integralizada no final do intervalo da semi-hora"),
      ],
      limitacoes: [tx("Não se obtém subtraindo a MMGD da curva de carga horária: os dois produtos têm definições diferentes.", "It is not obtained by subtracting MMGD from the hourly load curve: the two products have different definitions.")],
      vejaNoPortal: VEJA_PERFIL,
    },
  ];
}
export const CONCEITOS_IDIOMAS = montarNosDoisIdiomas(montarConceitos);
export const CONCEITOS: Conceito[] = CONCEITOS_IDIOMAS.pt;
