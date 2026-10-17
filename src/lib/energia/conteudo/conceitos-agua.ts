import type { Conceito } from "./conceitos";
import { montarNosDoisIdiomas, type TxIdioma } from "@/lib/energia/i18n/aprenda";

/**
 * Verbetes do módulo agua. Mesma regra da base (conceitos.ts): nenhuma definição de
 * memória; CONFERIDO só com o documento primário acessado na data indicada. Um
 * verbete com o slug de um verbete base o substitui.
 *
 * Os dois verbetes abaixo foram escritos a partir da página de fontes de dados do
 * projeto NASA POWER, acessada em 01/10/2026 (madrugada em Brasília; sha256 da página
 * capturada 68a23d1e…55ed). O trecho é citado no original, em inglês, e a paráfrase não
 * acrescenta nada que ele não diga.
 *
 * O REE foi conferido em 07/10/2026 em documentos da EPE, do MME e do ONS versionados em
 * pipeline/energia/seed/documentos_aprenda/v20261007T211054Z (sha256 de cada original no
 * MANIFESTO.json). Nenhum deles é uma definição formal do termo: a EPE o descreve como a
 * representação agregada das usinas hidrelétricas nos modelos oficiais de planejamento, e o
 * verbete diz isso e o que não foi acessado (Procedimentos de Rede e glossário do ONS).
 */
const POWER_FONTES = "https://power.larc.nasa.gov/docs/methodology/data/sources/";

const URL_PDE_COMPLEMENTAR = "https://www.epe.gov.br/sites-pt/publicacoes-dados-abertos/publicacoes/Documents/Estudos%20Complementares%20PDE2031_Sensibilidades%20what%20if.pdf";
const URL_EPE_NT_099 = "https://www.epe.gov.br/sites-pt/publicacoes-dados-abertos/publicacoes/PublicacoesArquivos/publicacao-525/topico-813/EPE-DEE-RE-099_2025_rv0.pdf";
const URL_GT_PRECOS = "https://www.gov.br/mme/pt-br/assuntos/secretarias/secretaria-executiva/modernizacao-do-setor-eletrico/arquivos/pasta-geral-publicada/formacao-de-precos.pdf";

function montarConceitos(tx: TxIdioma): Conceito[] {
  return [
    {
      slug: "imerg",
      sigla: "IMERG",
      nome: tx("Precipitação estimada por satélite (IMERG)", "Satellite-estimated precipitation (IMERG)"),
      grupo: "Fontes de dados", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-10-01",
      emUmaFrase:
        tx("Estimativa de chuva da missão GPM da NASA, que combina vários satélites numa grade de 0,1° (cerca de 10 km), com uma versão rápida (Late) e uma final, publicada cerca de 3,5 meses depois.", "Rainfall estimate from NASA's GPM mission, which combines several satellites on a 0.1° grid (about 10 km), with a quick version (Late) and a final one, published about 3.5 months later."),
      porQueImporta:
        tx("Sem estação em cada bacia, a chuva média de uma bacia hidrográfica só pode ser estimada por uma grade; é o insumo que o observatório usa para a chuva por bacia.", "Without a station in every basin, the average rainfall of a river basin can only be estimated from a grid; it is the input the observatory uses for rainfall by basin."),
      comoEMedido:
        tx("Precipitação diária (dia UTC) em cada ponto da grade, lida pelo serviço NASA POWER; a versão Late chega em cerca de 14 horas e é substituída pela Final.", "Daily precipitation (UTC day) at each grid point, read through the NASA POWER service; the Late version arrives in about 14 hours and is replaced by the Final one."),
      relacoes: ["ena", "merra-2"],
      fontes: [
        {
          orgao: "NASA (Langley Research Center), projeto POWER",
          documento: tx("POWER Docs, Methodology, Data Sources (seção Precipitation)", "POWER Docs, Methodology, Data Sources (Precipitation section)"),
          url: POWER_FONTES,
          trechoEmIngles: true,
          trecho:
            "POWER's higher resolution precipitation data is derived from NASA's Global Precipitation Measurement (GPM) mission's Integrated Multi-satellitE Retrievals for GPM (IMERG). The resolution of the IMERG precipitation data is a global 0.1° latitude by 0.1° longitude grid (approximately 10 km).",
          parafrase:
            tx("Em outras palavras: a chuva do POWER vem do IMERG, o produto de vários satélites da missão GPM da NASA, numa grade global de 0,1° por 0,1° (cerca de 10 km). Na mesma página, a tabela de fontes diz que a versão Final começa em 1º de janeiro de 2001 e chega 3,5 meses atrás do tempo real, e a versão Late cobre o período depois dela, com cerca de 14 horas de atraso.", "In other words: POWER rainfall comes from IMERG, the multi-satellite product of NASA's GPM mission, on a global grid of 0.1° by 0.1° (about 10 km). On the same page, the sources table says the Final version starts on Jan 1, 2001 and arrives 3.5 months behind real time, and the Late version covers the period after it, with a delay of about 14 hours."),
        },
      ],
      limitacoes: [
        tx("É estimativa, não medição de estação; a versão Late não tem a calibração por pluviômetros da Final.", "It is an estimate, not a station measurement; the Late version lacks the rain gauge calibration of the Final one."),
        tx("No POWER, o IMERG só existe por dia e em hora UTC.", "In POWER, IMERG only exists by day and in UTC time."),
      ],
      vejaNoPortal: [{ rotulo: tx("Chuva, temperatura e clima", "Rainfall, temperature and climate"), href: "/setor-eletrico/agua-e-clima/chuva-e-temperatura#p019" }],
    },
    {
      slug: "merra-2",
      sigla: "MERRA-2",
      nome: tx("Reanálise MERRA-2 (temperatura estimada)", "MERRA-2 reanalysis (estimated temperature)"),
      grupo: "Fontes de dados", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-10-01",
      emUmaFrase:
        tx("Reanálise da NASA: um modelo do sistema de assimilação de dados GEOS que reconstrói o tempo passado numa grade de 0,5° por 0,625°; os dias mais recentes vêm do GEOS-IT até a MERRA-2 os substituir.", "NASA reanalysis: a model of the GEOS data assimilation system that reconstructs past weather on a 0.5° by 0.625° grid; the most recent days come from GEOS-IT until MERRA-2 replaces them."),
      porQueImporta:
        tx("Dá a temperatura de qualquer ponto do país com a mesma regra desde 1981, o que permite comparar um período com a média de muitos anos; o observatório usa a temperatura das áreas mais populosas de cada estado.", "It gives the temperature of any point in the country with the same rule since 1981, which allows comparing a period with the average of many years; the observatory uses the temperature of the most populated areas of each state."),
      comoEMedido: tx("Temperatura do ar a 2 metros, média, máxima e mínima do dia, por célula da grade, lida pelo serviço NASA POWER.", "Air temperature at 2 meters, daily mean, maximum and minimum, by grid cell, read through the NASA POWER service."),
      relacoes: ["imerg"],
      fontes: [
        {
          orgao: "NASA (Langley Research Center), projeto POWER",
          documento: tx("POWER Docs, Methodology, Data Sources (seção Meteorological)", "POWER Docs, Methodology, Data Sources (Meteorological section)"),
          url: POWER_FONTES,
          trechoEmIngles: true,
          trecho:
            "the meteorological data source is ½° latitude by ⅝° longitude grid from GMAO MERRA-2. [...] Meteorological parameters are derived from NASA's GMAO MERRA-2 assimilation model and GEOS-IT. MERRA-2 is a version of NASA's Goddard Earth Observing System (GEOS) Data Assimilation System (Bosilovich, M. G., et al., 2016). GEOS-IT has the same grid resolution as MERRA-2 (and the same model physics less selected observations and surface rain gauge normalized precipitation). The POWER team processes GEOS-IT data on a daily basis, and it is appended to the end of the MERRA-2 daily time series to provide low latency products, which are generally ready within about two days of real-time. The MERRA-2 values in the resulting daily time series are typically updated every several months.",
          parafrase:
            tx("Em outras palavras: as variáveis meteorológicas do POWER vêm do modelo de assimilação MERRA-2, uma versão do sistema GEOS da NASA, e do GEOS-IT, que tem a mesma grade. O GEOS-IT é processado todo dia e emendado ao fim da série MERRA-2 para dar dados com cerca de dois dias de atraso; os valores MERRA-2 da série costumam ser atualizados a cada alguns meses. A grade meteorológica é de ½° de latitude por ⅝° de longitude, e a tabela de fontes da mesma página diz que a MERRA-2 começa em 1º de janeiro de 1981.", "In other words: POWER's meteorological variables come from the MERRA-2 assimilation model, a version of NASA's GEOS system, and from GEOS-IT, which has the same grid. GEOS-IT is processed every day and appended to the end of the MERRA-2 series to provide data with a delay of about two days; the MERRA-2 values in the series are usually updated every few months. The meteorological grid is ½° latitude by ⅝° longitude, and the sources table on the same page says MERRA-2 starts on Jan 1, 1981."),
        },
      ],
      limitacoes: [
        tx("É estimativa de modelo, não medição de estação; a conferência com estações do INMET não foi feita (o INMET não respondeu nas tentativas de coleta).", "It is a model estimate, not a station measurement; the check against INMET stations was not done (INMET did not respond in the collection attempts)."),
        tx("O fim da série vem do GEOS-IT e muda quando a MERRA-2 chega.", "The end of the series comes from GEOS-IT and changes when MERRA-2 arrives."),
      ],
      vejaNoPortal: [{ rotulo: tx("Chuva, temperatura e clima", "Rainfall, temperature and climate"), href: "/setor-eletrico/agua-e-clima/chuva-e-temperatura#temperatura" }],
    },
    {
      slug: "ree",
      sigla: "REE",
      nome: tx("Reservatório Equivalente de Energia", "Equivalent Energy Reservoir"),
      grupo: "Água", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-10-07",
      emUmaFrase:
        tx("Representação agregada das usinas hidrelétricas nos modelos oficiais de planejamento da operação, organizada de acordo com as bacias hidrográficas em que as usinas estão localizadas.", "Aggregated representation of hydropower plants in the official operation planning models, organized according to the river basins where the plants are located."),
      ressalva: tx("sem definição formal nas fontes consultadas", "no formal definition in the sources consulted"),
      emPalavrasSimples:
        tx("Nos modelos oficiais de planejamento da operação, as usinas hidrelétricas não aparecem uma a uma: as de cada conjunto de bacias hidrográficas são agrupadas num único reservatório equivalente de energia. A topologia que a EPE descreve tem 12 REE, em uso desde o Programa Mensal da Operação de janeiro de 2018.", "In the official operation planning models, hydropower plants do not appear one by one: those of each group of river basins are grouped into a single equivalent energy reservoir. The topology the EPE describes has 12 REE, in use since the Monthly Operation Program of January 2018."),
      relacoesNotas: {
        ear: tx("O ONS publica a energia armazenada por REE, cada um com o próprio perímetro e a própria EAR máxima.", "The ONS publishes stored energy by REE, each with its own perimeter and its own maximum EAR."),
        ena: tx("O ONS publica a energia natural afluente por REE.", "The ONS publishes natural inflow energy by REE."),
        newave: tx("A EPE registra a topologia de 12 REE junto com a versão 24 do modelo NEWAVE, a partir do PMO de janeiro de 2018.", "The EPE records the 12-REE topology together with version 24 of the NEWAVE model, from the PMO of January 2018."),
      },
      porQueImporta:
        tx("Com os REE, o ONS publica quanta energia há armazenada e quanta chega de afluência em cada conjunto de bacias, e não só no total do subsistema. O ONS publica a energia armazenada (EAR) e a energia natural afluente (ENA) por REE. O relatório do GT Mecanismos de Formação de Preços (coordenado pela CCEE, com MME, ANEEL, EPE e ONS) registra que o número de REE nos modelos subiu de 4 para 12 e, entre os aprimoramentos em desenvolvimento em 2019, a correlação espacial mensal das afluências entre os REE, para capturar a diversidade hidrológica entre as bacias; se essa correlação já está em uso não foi conferido.", "With the REE, the ONS publishes how much energy is stored and how much arrives as inflow in each group of basins, and not only in the subsystem total. The ONS publishes stored energy (EAR) and natural inflow energy (ENA) by REE. The report of the Price Formation Mechanisms working group (GT, coordinated by the CCEE, with the MME, ANEEL, EPE and ONS) records that the number of REE in the models rose from 4 to 12 and, among the improvements under development in 2019, the monthly spatial correlation of inflows between the REE, to capture the hydrological diversity between basins; whether this correlation is already in use was not checked."),
      comoEMedido:
        tx("Não é uma grandeza: é a unidade em que o ONS publica a EAR e a ENA diárias. A EAR é a energia associada ao volume de água disponível nos reservatórios que pode ser convertido em geração na própria usina e em todas as usinas a jusante na cascata. No observatório, a EAR por REE aparece em MWmês e em percentual da EAR máxima, cada REE com o próprio perímetro e a própria EAR máxima.", "It is not a quantity: it is the unit in which the ONS publishes the daily EAR and ENA. EAR is the energy associated with the volume of water available in the reservoirs that can be converted into generation at the plant itself and at all plants downstream in the cascade. In the observatory, EAR by REE appears in MW-month and as a percentage of the maximum EAR, each REE with its own perimeter and its own maximum EAR."),
      relacoes: ["ear", "ena", "newave"],
      fontes: [
        {
          orgao: "EPE",
          documento: tx("Plano Decenal de Expansão de Energia 2031, Estudos Complementares: Sensibilidades what if (Nota Técnica EPE-DEE-RE-037/2022, emissão original em 12/07/2022), seção 2, p. 4 do documento (p. 7 do PDF)", "Ten-Year Energy Expansion Plan 2031, Complementary Studies: what-if sensitivities (EPE Technical Note EPE-DEE-RE-037/2022, original issue on Jul 12, 2022), section 2, p. 4 of the document (p. 7 of the PDF)"),
          url: URL_PDE_COMPLEMENTAR,
          trecho:
            // i18n: dado
            "devido à relevância das UHEs em termos de capacidade instalada total do SIN e também sua representação agregada nos modelos oficiais de planejamento da operação, isto é, através dos reservatórios equivalentes de energia de acordo com as bacias hidrográficas onde estas usinas hidrelétricas estão localizadas.",
          parafrase:
            tx("Em outras palavras: nos modelos oficiais de planejamento da operação, as usinas hidrelétricas não aparecem uma a uma, e sim agrupadas em reservatórios equivalentes de energia, de acordo com a bacia hidrográfica em que ficam.", "In other words: in the official operation planning models, hydropower plants do not appear one by one, but grouped into equivalent energy reservoirs, according to the river basin where they are located."),
        },
        {
          orgao: "EPE",
          documento: tx("Nota Técnica EPE/DEE/099/2025 (dezembro de 2025), premissas dos modelos, página 11", "EPE Technical Note EPE/DEE/099/2025 (December 2025), model assumptions, page 11"),
          url: URL_EPE_NT_099,
          trecho:
            // i18n: dado
            "4 subsistemas interligados [...] Topologia de Reservatórios Equivalentes de Energia (REE): topologia G (12 REEs), considerada a partir do PMO de 01/2018, juntamente com a versão 24 do modelo NEWAVE, conforme Despacho nº 4.166, de 11 de dezembro de 2017",
          parafrase:
            tx("Em outras palavras: a topologia usada tem 4 subsistemas e, dentro dela, 12 REE, a chamada topologia G, em uso desde o PMO de janeiro de 2018, com a versão 24 do NEWAVE.", "In other words: the topology used has 4 subsystems and, within it, 12 REE, the so-called topology G, in use since the PMO of January 2018, with version 24 of NEWAVE."),
        },
        {
          orgao: tx("MME, GT Modernização do Setor Elétrico (coordenação da CCEE)", "MME, Power Sector Modernization working group (GT, coordinated by the CCEE)"),
          documento: tx("Relatório do Grupo Temático Mecanismos de Formação de Preços, julho de 2019, seção 5, propostas de aprimoramentos, p. 38 do documento (p. 41 do PDF)", "Report of the Thematic Group on Price Formation Mechanisms, July 2019, section 5, improvement proposals, p. 38 of the document (p. 41 of the PDF)"),
          url: URL_GT_PRECOS,
          // i18n: dado
          trecho: "o aumento do número de Reservatórios Equivalentes em Energia (REEs), passando de 4 REEs para 12 REEs",
          parafrase: tx("Em outras palavras: o número de reservatórios equivalentes nos modelos subiu de 4 para 12.", "In other words: the number of equivalent reservoirs in the models rose from 4 to 12."),
        },
        {
          orgao: tx("MME, GT Modernização do Setor Elétrico (coordenação da CCEE)", "MME, Power Sector Modernization working group (GT, coordinated by the CCEE)"),
          documento: tx("Relatório do Grupo Temático Mecanismos de Formação de Preços, julho de 2019, seção 2.2.1, aprimoramentos em desenvolvimento dos modelos atuais, p. 9 do documento (p. 12 do PDF)", "Report of the Thematic Group on Price Formation Mechanisms, July 2019, section 2.2.1, improvements under development in the current models, p. 9 of the document (p. 12 of the PDF)"),
          url: URL_GT_PRECOS,
          trecho:
            // i18n: dado
            "A utilização de correlação espacial de ENAs, nos modelos NEWAVE e GEVAZP, entre os reservatórios equivalentes de energia (REE), em base mensal, em substituição à anual. Essa representação é mais aderente à realidade, capturando a diversidade hidrológica entre as diferentes bacias.",
          parafrase:
            tx("Em outras palavras: entre os aprimoramentos dos modelos em desenvolvimento em 2019, o relatório lista relacionar, mês a mês, as afluências dos diferentes REE, em vez de uma relação anual, o que representaria melhor a diferença de comportamento entre as bacias.", "In other words: among the model improvements under development in 2019, the report lists relating the inflows of the different REE month by month, instead of an annual relation, which would better represent the difference in behavior between the basins."),
        },
        {
          orgao: "ONS",
          documento: tx("Portal de dados abertos, conjunto \"EAR Diário por REE - Reservatório Equivalente de Energia\" (descrição)", "Open data portal, dataset «EAR Diário por REE - Reservatório Equivalente de Energia» (description)"),
          url: "https://dados.ons.org.br/dataset/ear-diario-por-ree-reservatorio-equivalente-de-energia",
          trecho:
            // i18n: dado
            "Dados das grandezas de energia armazenada (EAR) em periodicidade diária por Reservatórios Equivalentes. A Energia Armazenada (EAR) representa a energia associada ao volume de água disponível nos reservatórios que pode ser convertido em geração na própria usina e em todas as usinas à jusante na cascata.",
        },
        {
          orgao: "ONS",
          documento: tx("Portal de dados abertos, conjunto \"ENA Diário por REE - Reservatório Equivalente de Energia\" (descrição)", "Open data portal, dataset «ENA Diário por REE - Reservatório Equivalente de Energia» (description)"),
          url: "https://dados.ons.org.br/dataset/ena-diario-por-ree-reservatorio-equivalente-de-energia",
          // i18n: dado
          trecho: "Dados das grandezas de energia natural afluente (ENA) dos reservatórios com periodicidade diária por Reservatórios Equivalentes.",
        },
      ],
      limitacoes: [
        tx("Nenhum dos documentos consultados traz uma definição formal de REE: a descrição acima é a da EPE, e a composição de cada um dos 12 REE em usinas não está neste verbete. Os Submódulos 2.4, 4.3 e 4.5 dos Procedimentos de Rede, lidos para o módulo PLD, não contêm o termo; os demais submódulos e o glossário do ONS não foram lidos, e o dicionário de dados do conjunto EAR Diário por REE usa o termo sem defini-lo.", "None of the documents consulted gives a formal definition of REE: the description above is the EPE's, and the composition of each of the 12 REE in plants is not in this entry. Submodules 2.4, 4.3 and 4.5 of the Grid Procedures, read for the PLD module, do not contain the term; the other submodules and the ONS glossary were not read, and the data dictionary of the «EAR Diário por REE» dataset uses the term without defining it."),
        tx("O relatório do GT descreve o aumento de 4 para 12 REE sem datá-lo. Nos arquivos do ONS, o painel detecta a reconfiguração de 29 e 30/12/2017, de 9 para 12 REE, que mudou o perímetro de alguns deles, e a EPE registra a topologia G, de 12 REE, em uso desde o Programa Mensal da Operação de janeiro de 2018. Séries por REE anteriores a essa mudança não são comparáveis no mesmo perímetro.", "The GT report describes the increase from 4 to 12 REE without dating it. In the ONS files, the panel detects the reconfiguration of Dec 29 and 30, 2017, from 9 to 12 REE, which changed the perimeter of some of them, and the EPE records topology G, with 12 REE, in use since the Monthly Operation Program of January 2018. Series by REE before this change are not comparable on the same perimeter."),
      ],
      vejaNoPortal: [{ rotulo: tx("Água e clima: EAR por REE", "Water and climate: EAR by REE"), href: "/setor-eletrico/agua-e-clima?rec=ree#p017" }],
    },
  ];
}
export const CONCEITOS_IDIOMAS = montarNosDoisIdiomas(montarConceitos);
export const CONCEITOS: Conceito[] = CONCEITOS_IDIOMAS.pt;
