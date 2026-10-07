import type { Conceito } from "./conceitos";

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
  {
    slug: "ree",
    sigla: "REE",
    nome: "Reservatório Equivalente de Energia",
    grupo: "Água",
    estado: "CONFERIDO",
    conferidoEm: "2026-10-07",
    emUmaFrase:
      "Representação agregada das usinas hidrelétricas nos modelos oficiais de planejamento da operação, organizada de acordo com as bacias hidrográficas em que as usinas estão localizadas.",
    porQueImporta:
      "O ONS publica a energia armazenada (EAR) e a energia natural afluente (ENA) por REE. O MME registra que o número de REE nos modelos passou de 4 para 12 e que as afluências passaram a ter correlação espacial mensal entre os REE, para capturar a diversidade hidrológica entre as bacias.",
    comoEMedido:
      "Não é uma grandeza: é a unidade em que o ONS publica a EAR e a ENA diárias. A EAR é a energia associada ao volume de água disponível nos reservatórios que pode ser convertido em geração na própria usina e em todas as usinas a jusante na cascata. No observatório, a EAR por REE aparece em MWmês e em percentual da EAR máxima, cada REE com o próprio perímetro e a própria EAR máxima.",
    relacoes: ["ear", "ena", "newave"],
    fontes: [
      {
        orgao: "EPE",
        documento: "Plano Decenal de Expansão de Energia 2031, Estudos Complementares: Sensibilidades what if (Nota Técnica EPE-DEE-RE-037/2022, emissão original em 12/07/2022), seção 2, página 4",
        url: URL_PDE_COMPLEMENTAR,
        trecho:
          "devido à relevância das UHEs em termos de capacidade instalada total do SIN e também sua representação agregada nos modelos oficiais de planejamento da operação, isto é, através dos reservatórios equivalentes de energia de acordo com as bacias hidrográficas onde estas usinas hidrelétricas estão localizadas.",
        parafrase:
          "Em outras palavras: nos modelos oficiais de planejamento da operação, as usinas hidrelétricas não aparecem uma a uma, e sim agrupadas em reservatórios equivalentes de energia, de acordo com a bacia hidrográfica em que ficam.",
      },
      {
        orgao: "EPE",
        documento: "Nota Técnica EPE/DEE/099/2025 (dezembro de 2025), premissas dos modelos, página 11",
        url: URL_EPE_NT_099,
        trecho:
          "4 subsistemas interligados [...] Topologia de Reservatórios Equivalentes de Energia (REE): topologia G (12 REEs), considerada a partir do PMO de 01/2018, juntamente com a versão 24 do modelo NEWAVE, conforme Despacho nº 4.166, de 11 de dezembro de 2017",
        parafrase:
          "Em outras palavras: a topologia usada tem 4 subsistemas e, dentro dela, 12 REE, a chamada topologia G, em uso desde o PMO de janeiro de 2018, com a versão 24 do NEWAVE.",
      },
      {
        orgao: "MME, GT Modernização do Setor Elétrico",
        documento: "Relatório do Grupo Temático Mecanismos de Formação de Preços, julho de 2019, seção 5, propostas de aprimoramentos",
        url: URL_GT_PRECOS,
        trecho: "o aumento do número de Reservatórios Equivalentes em Energia (REEs), passando de 4 REEs para 12 REEs",
        parafrase: "Em outras palavras: o número de reservatórios equivalentes nos modelos subiu de 4 para 12.",
      },
      {
        orgao: "MME, GT Modernização do Setor Elétrico",
        documento: "Relatório do Grupo Temático Mecanismos de Formação de Preços, julho de 2019, seção 2.2.1, aprimoramentos em desenvolvimento dos modelos atuais",
        url: URL_GT_PRECOS,
        trecho:
          "A utilização de correlação espacial de ENAs, nos modelos NEWAVE e GEVAZP, entre os reservatórios equivalentes de energia (REE), em base mensal, em substituição à anual. Essa representação é mais aderente à realidade, capturando a diversidade hidrológica entre as diferentes bacias.",
        parafrase:
          "Em outras palavras: os modelos passaram a relacionar, mês a mês, as afluências dos diferentes REE, em vez de uma relação anual, e isso representa melhor a diferença de comportamento entre as bacias.",
      },
      {
        orgao: "ONS",
        documento: "Portal de dados abertos, conjunto \"EAR Diário por REE - Reservatório Equivalente de Energia\" (descrição)",
        url: "https://dados.ons.org.br/dataset/ear-diario-por-ree-reservatorio-equivalente-de-energia",
        trecho:
          "Dados das grandezas de energia armazenada (EAR) em periodicidade diária por Reservatórios Equivalentes. A Energia Armazenada (EAR) representa a energia associada ao volume de água disponível nos reservatórios que pode ser convertido em geração na própria usina e em todas as usinas à jusante na cascata.",
      },
      {
        orgao: "ONS",
        documento: "Portal de dados abertos, conjunto \"ENA Diário por REE - Reservatório Equivalente de Energia\" (descrição)",
        url: "https://dados.ons.org.br/dataset/ena-diario-por-ree-reservatorio-equivalente-de-energia",
        trecho: "Dados das grandezas de energia natural afluente (ENA) dos reservatórios com periodicidade diária por Reservatórios Equivalentes.",
      },
    ],
    limitacoes: [
      "Nenhum dos documentos consultados traz uma definição formal de REE: a descrição acima é a da EPE, e a composição de cada um dos 12 REE em usinas não está neste verbete. Os Procedimentos de Rede e o glossário do ONS não foram acessados nesta fase, e o dicionário de dados do conjunto EAR Diário por REE usa o termo sem defini-lo.",
      "O perímetro de alguns REE mudou na reconfiguração do fim de 2017, que o painel detecta nos arquivos do ONS; a EPE registra a topologia G, de 12 REE, em uso desde o PMO de janeiro de 2018. Séries por REE anteriores a essa mudança não são comparáveis no mesmo perímetro.",
    ],
    vejaNoPortal: [{ rotulo: "Água e clima: EAR por REE", href: "/setor-eletrico/agua-e-clima?rec=ree#p017" }],
  },
];
