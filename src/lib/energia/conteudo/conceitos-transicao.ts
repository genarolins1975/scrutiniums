import type { Conceito } from "./conceitos";
import { montarNosDoisIdiomas, type TxIdioma } from "@/lib/energia/i18n/aprenda";

/**
 * Verbetes do módulo transicao. Mesma regra da base (conceitos.ts): nenhuma definição de
 * memória; CONFERIDO só com o documento primário acessado na data indicada. Um
 * verbete com o slug de um verbete base o substitui.
 *
 * "geracao-distribuida" substitui o verbete base, que afirmava um método da estimativa
 * do ONS sem fonte ("dados meteorológicos previstos") e dava a relação da ANEEL como não
 * integrada. Fontes acessadas em 01/10/2026 (data de Brasília), com os trechos abaixo
 * conferidos literalmente no texto de cada documento nesse acesso:
 *  - ANEEL, página "Micro e Minigeração Distribuída" (gov.br/aneel, atualizada pela
 *    fonte em 09/06/2026);
 *  - ANEEL, descrição do conjunto "Relação de empreendimentos de Mini e Micro Geração
 *    Distribuída" (package_show do CKAN);
 *  - ONS, página Energia Agora, Balanço de Energia, e dicionário da Carga Verificada
 *    (v1.1 de 30/10/2023).
 *
 * "fator-de-emissao": página "Fatores de emissão" do MCTI (SIRENE), acessada em
 * 01/10/2026 pelo coletor sem desafio de verificação humana.
 */
const PAGINA_ANEEL_GD = "https://www.gov.br/aneel/pt-br/assuntos/geracao-distribuida";
const CONJUNTO_ANEEL_GD = "https://dadosabertos.aneel.gov.br/dataset/relacao-de-empreendimentos-de-geracao-distribuida";
const PAGINA_MCTI = "https://www.gov.br/mcti/pt-br/acompanhe-o-mcti/sirene/dados-e-ferramentas/fatores-de-emissao";

function montarConceitos(tx: TxIdioma): Conceito[] {
  return [
    {
      slug: "geracao-distribuida",
      sigla: "MMGD",
      nome: tx("Micro e minigeração distribuída", "Distributed micro and mini generation"),
      grupo: "Transição", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-10-01",
      emUmaFrase:
        tx("Central geradora de fonte renovável ou de cogeração qualificada conectada à rede de distribuição por meio das instalações de unidades consumidoras: microgeração até 75 kW de potência instalada e minigeração acima de 75 kW até 3 MW (até 5 MW em situações específicas da Lei nº 14.300/2022).", "Generating plant using a renewable source or qualified cogeneration connected to the distribution grid through the facilities of consumer units: microgeneration up to 75 kW of installed capacity and minigeneration above 75 kW up to 3 MW (up to 5 MW in specific situations of Law No. 14.300/2022)."),
      porQueImporta:
        tx("Pelo Sistema de Compensação de Energia Elétrica (SCEE), a energia que sobra vai para a rede e vira crédito para abater o consumo, no mesmo local, em outra unidade do mesmo titular (autoconsumo remoto), entre condôminos ou entre os participantes de uma geração compartilhada. Desde 29/04/2023, o ONS inclui o valor estimado da MMGD nos dados de geração e carga do Balanço de Energia.", "Under the Electric Energy Compensation System (SCEE), surplus energy goes to the grid and becomes a credit to offset consumption, at the same location, at another unit of the same holder (remote self-consumption), among condominium members or among the participants in shared generation. Since Apr 29, 2023, the ONS includes the estimated value of MMGD in the generation and load data of the Energy Balance."),
      comoEMedido:
        tx("A ANEEL publica a relação de empreendimentos, com quantidade e potência instalada em kW (a soma da potência elétrica ativa nominal das unidades geradoras), por distribuidora, município, fonte e data de conexão: é capacidade, não energia. O ONS publica, na carga verificada, a parcela da carga atendida por MMGD, em MWmed por meia hora, separada da parcela supervisionada e da medida para faturamento; na página do Balanço de Energia, o próprio ONS a chama de valor estimado.", "ANEEL publishes the list of installations, with number and installed capacity in kW (the sum of the nominal active electrical power of the generating units), by distribution utility, municipality, source and connection date: it is capacity, not energy. In the verified load, the ONS publishes the portion of load served by MMGD, in MWavg per half hour, separated from the supervised portion and from the portion measured for billing; on the Energy Balance page, the ONS itself calls it an estimated value."),
      relacoes: ["carga", "carga-liquida-de-mmgd", "fator-de-emissao"],
      fontes: [
        {
          orgao: "ANEEL",
          documento: tx('Página "Micro e Minigeração Distribuída" no portal gov.br/aneel, acessada em 01/10/2026', "ANEEL page «Micro e Minigeração Distribuída» on the gov.br/aneel portal, accessed on Oct 1, 2026"),
          url: PAGINA_ANEEL_GD,
          trecho:
            // i18n: dado
            "Denomina-se microgeração distribuída a central geradora com potência instalada até 75 quilowatts (KW). Já minigeração distribuída é aquela com potência acima de 75 kW e menor ou igual a 3 MW (podendo ser até 5 MW em situações específicas, nos termos dos incisos IX e XIIII e do Parágrafo Único do art. 1º da Lei nº 14.300/2022). Ambas são conectadas à rede de distribuição por meio de instalações de unidades consumidoras.",
          parafrase:
            tx("Em outras palavras: microgeração vai até 75 kW e minigeração vai de mais de 75 kW até 3 MW (5 MW em casos previstos na lei), e as duas se ligam à rede da distribuidora pela instalação de uma unidade consumidora.", "In other words: microgeneration goes up to 75 kW and minigeneration from more than 75 kW up to 3 MW (5 MW in cases provided for in the law), and both connect to the distribution utility's grid through the installation of a consumer unit."),
        },
        {
          orgao: "ANEEL",
          documento: tx("Mesma página, modalidades de participação no SCEE, acessada em 01/10/2026", "Same page, participation modalities in the SCEE, accessed on Oct 1, 2026"),
          url: PAGINA_ANEEL_GD,
          trecho:
            // i18n: dado
            "autoconsumo local - quando a energia é gerada e compensada no mesmo local onde está instalada a MMGD; autoconsumo remoto - quando a energia pode ser gerada em um local e compensada em outro, desde que em unidades consumidoras do mesmo titular; geração distribuída em empreendimentos de múltiplas unidades consumidoras - a energia gerada pode ser repartida entre os condôminos em porcentagens ou ordem de prioridade definidas pelos próprios consumidores; e geração compartilhada - diversos interessados podem se unir por meio de consórcio, cooperativa, condomínio civil voluntário ou edilício ou qualquer outra forma de associação civil, instituída para esse fim para instalar uma ou mais centrais de MMGD e utilizar a energia gerada para compensação do consumo de todos os participantes.",
        },
        {
          orgao: "ANEEL",
          documento: tx('Portal de dados abertos, descrição do conjunto "Relação de empreendimentos de Mini e Micro Geração Distribuída", acessada em 01/10/2026', "Open data portal, description of the dataset «Relação de empreendimentos de Mini e Micro Geração Distribuída», accessed on Oct 1, 2026"),
          url: CONJUNTO_ANEEL_GD,
          trecho:
            // i18n: dado
            "Os dados são expressos em quantidades e potência instalada em kW (quilowatt). A quantidade corresponde ao número de empreendimentos de MMGD conectados no período especificado. A potência instalada é definida pelo somatório da potência elétrica ativa nominal das unidades geradoras.",
        },
        {
          orgao: "ONS",
          documento: tx("Página Energia Agora, Balanço de Energia (texto de apresentação), acessada em 01/10/2026", "Energia Agora page, Energy Balance (introductory text), accessed on Oct 1, 2026"),
          url: "https://www.ons.org.br/paginas/energia-agora/balanco-de-energia",
          trecho:
            // i18n: dado
            "A partir de 29/04/2023, o valor estimado da micro e minigeração distribuída (MMGD) também passou a incorporar os dados de geração e carga apresentados nesta página.",
        },
        {
          orgao: "ONS",
          documento: tx("Dicionário de dados da Carga Verificada, versão 1.1 de 30/10/2023, acessado em 01/10/2026", "Data dictionary of the Verified Load dataset, version 1.1 of Oct 30, 2023, accessed on Oct 1, 2026"),
          url: "https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/carga_verificada_tm/DicionarioDados_Carga_Verificada.pdf",
          // i18n: dado
          trecho: "Valor da Carga atendida por MMGD em MWmed integralizada no final do intervalo da semi-hora (val_cargammgd).",
        },
      ],
      limitacoes: [
        tx("Potência instalada é capacidade, não energia gerada; a geração de cada unidade não é publicada nos dados abertos.", "Installed capacity is capacity, not generated energy; the generation of each unit is not published in the open data."),
        tx("O ONS chama a parcela de MMGD de valor estimado, e os documentos consultados não descrevem o método da estimativa.", "The ONS calls the MMGD portion an estimated value, and the documents consulted do not describe the estimation method."),
        tx("No autoconsumo remoto e na geração compartilhada, o crédito pode ser usado em outro lugar que não o da unidade geradora.", "In remote self-consumption and shared generation, the credit can be used at a place other than that of the generating unit."),
      ],
      vejaNoPortal: [
        { rotulo: tx("Onde a geração distribuída cresce", "Where distributed generation is growing"), href: "/setor-eletrico/transicao/mmgd" },
        { rotulo: tx("Carga: MMGD e perfil horário", "Load: MMGD and hourly profile"), href: "/setor-eletrico/carga/perfil-horario" },
      ],
    },
    {
      slug: "fator-de-emissao",
      nome: tx("Fator de emissão de CO2 da energia elétrica", "CO2 emission factor of electricity"),
      grupo: "Transição", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-10-01",
      emUmaFrase:
        tx("Quantidade de CO2 associada a cada MWh gerado no Sistema Interligado Nacional, publicada pelo MCTI. O fator médio considera todas as usinas que estão gerando, e não só as que funcionam na margem.", "Amount of CO2 associated with each MWh generated in the National Interconnected System, published by the MCTI. The average factor considers all plants that are generating, and not only those operating at the margin."),
      porQueImporta:
        tx("É o fator para inventários: se todos os consumidores do SIN multiplicassem a energia consumida pelo fator médio, a soma daria as emissões do SIN. Os fatores de margem servem a outra pergunta (a emissão deslocada na margem) e, segundo o MCTI, aplicam-se exclusivamente a projetos de MDL.", "It is the factor for inventories: if all consumers of the SIN multiplied the energy consumed by the average factor, the sum would give the emissions of the SIN. The margin factors serve another question (the emission displaced at the margin) and, according to the MCTI, apply exclusively to CDM projects."),
      comoEMedido:
        tx("O MCTI publica planilhas com o fator médio mensal e anual, em toneladas de CO2 por MWh, e, para o MDL, a margem de operação (energia despachada na margem) e a margem de construção (últimas usinas construídas). O observatório publica os valores como o MCTI os publica, sem recalcular.", "The MCTI publishes spreadsheets with the monthly and annual average factor, in tonnes of CO2 per MWh, and, for the CDM, the operating margin (energy dispatched at the margin) and the build margin (most recently built plants). The observatory publishes the values as the MCTI publishes them, without recalculating."),
      relacoes: ["geracao-distribuida"],
      fontes: [
        {
          orgao: "MCTI",
          documento: tx('Página "Fatores de emissão" (SIRENE), seção do fator médio para inventários, acessada em 01/10/2026', "Page «Fatores de emissão» (SIRENE), section on the average factor for inventories, accessed on Oct 1, 2026"),
          url: PAGINA_MCTI,
          trecho:
            // i18n: dado
            "Os fatores de emissão médios de CO2 para energia elétrica a serem utilizados em inventários têm como objetivo estimar a quantidade de CO2 associada a uma geração de energia elétrica determinada. Ele calcula a média das emissões da geração, levando em consideração todas as usinas que estão gerando energia e não somente aquelas que estejam funcionando na margem. Se todos os consumidores de energia elétrica do SIN calculassem as suas emissões multiplicando a energia consumida por esse Fator de Emissão, o somatório corresponderia às emissões do SIN.",
          parafrase:
            tx("Em outras palavras: o fator médio é a emissão média de todas as usinas que estão gerando, por MWh; aplicado ao consumo de todos, reproduz as emissões do SIN, e por isso serve a inventários.", "In other words: the average factor is the average emission of all plants that are generating, per MWh; applied to everyone's consumption, it reproduces the emissions of the SIN, and that is why it serves inventories."),
        },
        {
          orgao: "MCTI",
          documento: tx("Mesma página, seção dos fatores para projetos de MDL, acessada em 01/10/2026", "Same page, section on the factors for CDM projects, accessed on Oct 1, 2026"),
          url: PAGINA_MCTI,
          trecho:
            // i18n: dado
            "o fator de emissão do sistema interligado para fins de MDL é uma combinação do fator de emissão da margem de operação, que reflete a intensidade das emissões de CO2 da energia despachada na margem, com o fator de emissão da margem de construção, que reflete a intensidade das emissões de CO2 das últimas usinas construídas. [...] Esse fator serve para quantificar a emissão que está sendo deslocada na margem. A sua utilidade está associada a projetos de MDL e se aplica, exclusivamente, para estimar as reduções certificadas de emissões (RCEs) dos projetos de MDL.",
        },
      ],
      limitacoes: [
        tx("Só CO2, como o MCTI publica: não é CO2 equivalente nem emissão de ciclo de vida.", "Only CO2, as the MCTI publishes it: it is not CO2 equivalent nor life-cycle emissions."),
        tx("O fator médio não é marginal: não mede o efeito de consumir ou economizar um MWh a mais.", "The average factor is not marginal: it does not measure the effect of consuming or saving one more MWh."),
        tx("É nacional (SIN) e mensal; não existe fator oficial por hora nem por município.", "It is national (SIN) and monthly; there is no official factor by hour or by municipality."),
      ],
      vejaNoPortal: [{ rotulo: tx("Como varia a intensidade de emissões", "How emissions intensity varies"), href: "/setor-eletrico/transicao/emissoes" }],
    },
  ];
}
export const CONCEITOS_IDIOMAS = montarNosDoisIdiomas(montarConceitos);
export const CONCEITOS: Conceito[] = CONCEITOS_IDIOMAS.pt;
