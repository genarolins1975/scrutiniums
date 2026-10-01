import type { Conceito } from "./conceitos";

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

export const CONCEITOS: Conceito[] = [
  {
    slug: "geracao-distribuida",
    sigla: "MMGD",
    nome: "Micro e minigeração distribuída",
    grupo: "Transição",
    estado: "CONFERIDO",
    conferidoEm: "2026-10-01",
    emUmaFrase:
      "Central geradora de fonte renovável ou de cogeração qualificada conectada à rede de distribuição por meio das instalações de unidades consumidoras: microgeração até 75 kW de potência instalada e minigeração acima de 75 kW até 3 MW (até 5 MW em situações específicas da Lei nº 14.300/2022).",
    porQueImporta:
      "Pelo Sistema de Compensação de Energia Elétrica (SCEE), a energia que sobra vai para a rede e vira crédito para abater o consumo, no mesmo local, em outra unidade do mesmo titular (autoconsumo remoto), entre condôminos ou entre os participantes de uma geração compartilhada. Desde 29/04/2023, o ONS inclui o valor estimado da MMGD nos dados de geração e carga do Balanço de Energia.",
    comoEMedido:
      "A ANEEL publica a relação de empreendimentos, com quantidade e potência instalada em kW (a soma da potência elétrica ativa nominal das unidades geradoras), por distribuidora, município, fonte e data de conexão: é capacidade, não energia. O ONS publica, na carga verificada, a parcela da carga atendida por MMGD, em MWmed por meia hora, separada da parcela supervisionada e da medida para faturamento; na página do Balanço de Energia, o próprio ONS a chama de valor estimado.",
    relacoes: ["carga", "carga-liquida-de-mmgd", "fator-de-emissao"],
    fontes: [
      {
        orgao: "ANEEL",
        documento: 'Página "Micro e Minigeração Distribuída" no portal gov.br/aneel, acessada em 01/10/2026',
        url: PAGINA_ANEEL_GD,
        trecho:
          "Denomina-se microgeração distribuída a central geradora com potência instalada até 75 quilowatts (KW). Já minigeração distribuída é aquela com potência acima de 75 kW e menor ou igual a 3 MW (podendo ser até 5 MW em situações específicas, nos termos dos incisos IX e XIIII e do Parágrafo Único do art. 1º da Lei nº 14.300/2022). Ambas são conectadas à rede de distribuição por meio de instalações de unidades consumidoras.",
        parafrase:
          "Em outras palavras: microgeração vai até 75 kW e minigeração vai de mais de 75 kW até 3 MW (5 MW em casos previstos na lei), e as duas se ligam à rede da distribuidora pela instalação de uma unidade consumidora.",
      },
      {
        orgao: "ANEEL",
        documento: "Mesma página, modalidades de participação no SCEE, acessada em 01/10/2026",
        url: PAGINA_ANEEL_GD,
        trecho:
          "autoconsumo local - quando a energia é gerada e compensada no mesmo local onde está instalada a MMGD; autoconsumo remoto - quando a energia pode ser gerada em um local e compensada em outro, desde que em unidades consumidoras do mesmo titular; geração distribuída em empreendimentos de múltiplas unidades consumidoras - a energia gerada pode ser repartida entre os condôminos em porcentagens ou ordem de prioridade definidas pelos próprios consumidores; e geração compartilhada - diversos interessados podem se unir por meio de consórcio, cooperativa, condomínio civil voluntário ou edilício ou qualquer outra forma de associação civil, instituída para esse fim para instalar uma ou mais centrais de MMGD e utilizar a energia gerada para compensação do consumo de todos os participantes.",
      },
      {
        orgao: "ANEEL",
        documento: 'Portal de dados abertos, descrição do conjunto "Relação de empreendimentos de Mini e Micro Geração Distribuída", acessada em 01/10/2026',
        url: CONJUNTO_ANEEL_GD,
        trecho:
          "Os dados são expressos em quantidades e potência instalada em kW (quilowatt). A quantidade corresponde ao número de empreendimentos de MMGD conectados no período especificado. A potência instalada é definida pelo somatório da potência elétrica ativa nominal das unidades geradoras.",
      },
      {
        orgao: "ONS",
        documento: "Página Energia Agora, Balanço de Energia (texto de apresentação), acessada em 01/10/2026",
        url: "https://www.ons.org.br/paginas/energia-agora/balanco-de-energia",
        trecho:
          "A partir de 29/04/2023, o valor estimado da micro e minigeração distribuída (MMGD) também passou a incorporar os dados de geração e carga apresentados nesta página.",
      },
      {
        orgao: "ONS",
        documento: "Dicionário de dados da Carga Verificada, versão 1.1 de 30/10/2023, acessado em 01/10/2026",
        url: "https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/carga_verificada_tm/DicionarioDados_Carga_Verificada.pdf",
        trecho: "Valor da Carga atendida por MMGD em MWmed integralizada no final do intervalo da semi-hora (val_cargammgd).",
      },
    ],
    limitacoes: [
      "Potência instalada é capacidade, não energia gerada; a geração de cada unidade não é publicada nos dados abertos.",
      "O ONS chama a parcela de MMGD de valor estimado, e os documentos consultados não descrevem o método da estimativa.",
      "No autoconsumo remoto e na geração compartilhada, o crédito pode ser usado em outro lugar que não o da unidade geradora.",
    ],
    vejaNoPortal: [
      { rotulo: "Onde a geração distribuída cresce", href: "/setor-eletrico/transicao/mmgd" },
      { rotulo: "Carga: MMGD e perfil horário", href: "/setor-eletrico/carga/perfil-horario" },
    ],
  },
  {
    slug: "fator-de-emissao",
    nome: "Fator de emissão de CO2 da energia elétrica",
    grupo: "Transição",
    estado: "CONFERIDO",
    conferidoEm: "2026-10-01",
    emUmaFrase:
      "Quantidade de CO2 associada a cada MWh gerado no Sistema Interligado Nacional, publicada pelo MCTI. O fator médio considera todas as usinas que estão gerando, e não só as que funcionam na margem.",
    porQueImporta:
      "É o fator para inventários: se todos os consumidores do SIN multiplicassem a energia consumida pelo fator médio, a soma daria as emissões do SIN. Os fatores de margem servem a outra pergunta (a emissão deslocada na margem) e, segundo o MCTI, aplicam-se exclusivamente a projetos de MDL.",
    comoEMedido:
      "O MCTI publica planilhas com o fator médio mensal e anual, em toneladas de CO2 por MWh, e, para o MDL, a margem de operação (energia despachada na margem) e a margem de construção (últimas usinas construídas). O observatório publica os valores como o MCTI os publica, sem recalcular.",
    relacoes: ["geracao-distribuida"],
    fontes: [
      {
        orgao: "MCTI",
        documento: 'Página "Fatores de emissão" (SIRENE), seção do fator médio para inventários, acessada em 01/10/2026',
        url: PAGINA_MCTI,
        trecho:
          "Os fatores de emissão médios de CO2 para energia elétrica a serem utilizados em inventários têm como objetivo estimar a quantidade de CO2 associada a uma geração de energia elétrica determinada. Ele calcula a média das emissões da geração, levando em consideração todas as usinas que estão gerando energia e não somente aquelas que estejam funcionando na margem. Se todos os consumidores de energia elétrica do SIN calculassem as suas emissões multiplicando a energia consumida por esse Fator de Emissão, o somatório corresponderia às emissões do SIN.",
        parafrase:
          "Em outras palavras: o fator médio é a emissão média de todas as usinas que estão gerando, por MWh; aplicado ao consumo de todos, reproduz as emissões do SIN, e por isso serve a inventários.",
      },
      {
        orgao: "MCTI",
        documento: "Mesma página, seção dos fatores para projetos de MDL, acessada em 01/10/2026",
        url: PAGINA_MCTI,
        trecho:
          "o fator de emissão do sistema interligado para fins de MDL é uma combinação do fator de emissão da margem de operação, que reflete a intensidade das emissões de CO2 da energia despachada na margem, com o fator de emissão da margem de construção, que reflete a intensidade das emissões de CO2 das últimas usinas construídas. [...] Esse fator serve para quantificar a emissão que está sendo deslocada na margem. A sua utilidade está associada a projetos de MDL e se aplica, exclusivamente, para estimar as reduções certificadas de emissões (RCEs) dos projetos de MDL.",
      },
    ],
    limitacoes: [
      "Só CO2, como o MCTI publica: não é CO2 equivalente nem emissão de ciclo de vida.",
      "O fator médio não é marginal: não mede o efeito de consumir ou economizar um MWh a mais.",
      "É nacional (SIN) e mensal; não existe fator oficial por hora nem por município.",
    ],
    vejaNoPortal: [{ rotulo: "Como varia a intensidade de emissões", href: "/setor-eletrico/transicao/emissoes" }],
  },
];
