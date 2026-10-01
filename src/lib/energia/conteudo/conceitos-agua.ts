import type { Conceito } from "./conceitos";

/**
 * Verbetes do módulo agua. Mesma regra da base (conceitos.ts): nenhuma definição de
 * memória; CONFERIDO só com o documento primário acessado na data indicada. Um
 * verbete com o slug de um verbete base o substitui.
 *
 * Os dois verbetes abaixo foram escritos a partir da página de fontes de dados do
 * projeto NASA POWER, acessada em 01/10/2026 (madrugada em Brasília; sha256 da página
 * capturada 68a23d1e…55ed). O trecho é citado no original, em inglês, e a paráfrase não
 * acrescenta nada que ele não diga. O REE continua pendente: a descrição do conjunto
 * "EAR Diário por REE" do ONS, relida na mesma data, cita "Reservatórios Equivalentes"
 * sem defini-los.
 */
const POWER_FONTES = "https://power.larc.nasa.gov/docs/methodology/data/sources/";

export const CONCEITOS: Conceito[] = [
  {
    slug: "imerg",
    sigla: "IMERG",
    nome: "Precipitação estimada por satélite (IMERG)",
    grupo: "Água",
    estado: "CONFERIDO",
    conferidoEm: "2026-10-01",
    emUmaFrase:
      "Estimativa de chuva da missão GPM da NASA, que combina vários satélites numa grade de 0,1° (cerca de 10 km), com uma versão rápida (Late) e uma final, publicada cerca de 3,5 meses depois.",
    porQueImporta:
      "Sem estação em cada bacia, a chuva média de uma bacia hidrográfica só pode ser estimada por uma grade; é o insumo que o observatório usa para a chuva por bacia.",
    comoEMedido:
      "Precipitação diária (dia UTC) em cada ponto da grade, lida pelo serviço NASA POWER; a versão Late chega em cerca de 14 horas e é substituída pela Final.",
    relacoes: ["ena", "merra-2"],
    fontes: [
      {
        orgao: "NASA (Langley Research Center), projeto POWER",
        documento: "POWER Docs, Methodology, Data Sources (seção Precipitation)",
        url: POWER_FONTES,
        trecho:
          "POWER's higher resolution precipitation data is derived from NASA's Global Precipitation Measurement (GPM) mission's Integrated Multi-satellitE Retrievals for GPM (IMERG). The resolution of the IMERG precipitation data is a global 0.1° latitude by 0.1° longitude grid (approximately 10 km).",
        parafrase:
          "Em outras palavras: a chuva do POWER vem do IMERG, o produto de vários satélites da missão GPM da NASA, numa grade global de 0,1° por 0,1° (cerca de 10 km). Na mesma página, a tabela de fontes diz que a versão Final começa em 1º de janeiro de 2001 e chega 3,5 meses atrás do tempo real, e a versão Late cobre o período depois dela, com cerca de 14 horas de atraso.",
      },
    ],
    limitacoes: [
      "É estimativa, não medição de estação; a versão Late não tem a calibração por pluviômetros da Final.",
      "No POWER, o IMERG só existe por dia e em hora UTC.",
    ],
    vejaNoPortal: [{ rotulo: "Chuva, temperatura e clima", href: "/setor-eletrico/agua-e-clima/chuva-e-temperatura#p019" }],
  },
  {
    slug: "merra-2",
    sigla: "MERRA-2",
    nome: "Reanálise MERRA-2 (temperatura estimada)",
    grupo: "Água",
    estado: "CONFERIDO",
    conferidoEm: "2026-10-01",
    emUmaFrase:
      "Reanálise da NASA: um modelo do sistema de assimilação de dados GEOS que reconstrói o tempo passado numa grade de 0,5° por 0,625°; os dias mais recentes vêm do GEOS-IT até a MERRA-2 os substituir.",
    porQueImporta:
      "Dá a temperatura de qualquer ponto do país com a mesma regra desde 1981, o que permite comparar um período com a média de muitos anos; o observatório usa a temperatura das áreas mais populosas de cada estado.",
    comoEMedido: "Temperatura do ar a 2 metros, média, máxima e mínima do dia, por célula da grade, lida pelo serviço NASA POWER.",
    relacoes: ["imerg"],
    fontes: [
      {
        orgao: "NASA (Langley Research Center), projeto POWER",
        documento: "POWER Docs, Methodology, Data Sources (seção Meteorological)",
        url: POWER_FONTES,
        trecho:
          "the meteorological data source is ½° latitude by ⅝° longitude grid from GMAO MERRA-2. [...] Meteorological parameters are derived from NASA's GMAO MERRA-2 assimilation model and GEOS-IT. MERRA-2 is a version of NASA's Goddard Earth Observing System (GEOS) Data Assimilation System (Bosilovich, M. G., et al., 2016). GEOS-IT has the same grid resolution as MERRA-2 (and the same model physics less selected observations and surface rain gauge normalized precipitation). The POWER team processes GEOS-IT data on a daily basis, and it is appended to the end of the MERRA-2 daily time series to provide low latency products, which are generally ready within about two days of real-time. The MERRA-2 values in the resulting daily time series are typically updated every several months.",
        parafrase:
          "Em outras palavras: as variáveis meteorológicas do POWER vêm do modelo de assimilação MERRA-2, uma versão do sistema GEOS da NASA, e do GEOS-IT, que tem a mesma grade. O GEOS-IT é processado todo dia e emendado ao fim da série MERRA-2 para dar dados com cerca de dois dias de atraso; os valores MERRA-2 da série costumam ser atualizados a cada alguns meses. A grade meteorológica é de ½° de latitude por ⅝° de longitude, e a tabela de fontes da mesma página diz que a MERRA-2 começa em 1º de janeiro de 1981.",
      },
    ],
    limitacoes: [
      "É estimativa de modelo, não medição de estação; a conferência com estações do INMET não foi feita (o INMET não respondeu nas tentativas de coleta).",
      "O fim da série vem do GEOS-IT e muda quando a MERRA-2 chega.",
    ],
    vejaNoPortal: [{ rotulo: "Chuva, temperatura e clima", href: "/setor-eletrico/agua-e-clima/chuva-e-temperatura#temperatura" }],
  },
];
