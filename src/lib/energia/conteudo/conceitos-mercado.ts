import type { Conceito, FonteOficial } from "./conceitos";
import { montarNosDoisIdiomas, type TxIdioma } from "@/lib/energia/i18n/aprenda";

/**
 * Verbetes do módulo mercado. Mesma regra da base (conceitos.ts): nenhuma definição de
 * memória; CONFERIDO só com o documento primário acessado na data indicada. Um
 * verbete com o slug de um verbete base o substitui.
 *
 * Fontes, versionadas em pipeline/energia/seed/documentos_aprenda/ (MANIFESTO.json com o
 * sha256 de cada original e a transformação aplicada):
 * - MRE: glossário do InfoMercado mensal Nº 229 da CCEE (julho de 2026, publicado em
 *   10/09/2026), página 12, capturado pelo pipeline em 06/10/2026 às 17h01 de Brasília (sha256
 *   c7efe73d4792c5ddda3148d68b4de8de840ad9f47187212e2a79c3bb4054aae5);
 * - ACR, ACL, garantia física e ESS: Decreto nº 5.163/2004, texto compilado do Planalto
 *   acessado em 06/10/2026 às 18h28 de Brasília, na redação vigente (art. 1º, § 2º; art. 2º,
 *   §§ 1º a 3º; art. 59).
 * - GSF: Boletim Mensal de Monitoramento do Sistema Elétrico Brasileiro de janeiro de 2021 e
 *   Relatório do GT Aprimoramento do MRE de julho de 2019, ambos do MME, conferidos em
 *   07/10/2026 e versionados em v20261007T211054Z (sha256 de cada original no MANIFESTO.json).
 * Os trechos são literais; a paráfrase não acrescenta nada que eles não digam. Nenhum desses
 * documentos é a definição regulatória do fator: as Regras de Comercialização da CCEE e a
 * regulamentação da ANEEL não foram acessadas, e o verbete GSF diz isso. As definições
 * operacionais do módulo (gold mercado.json, bloco "definicoes") são método do observatório,
 * não documento primário.
 */

const URL_IM_229 = "https://www.ccee.org.br/documents/80415/35773859/InfoMercado-mensal_JUL_26_229.pdf/92b947aa-21df-f603-a4dc-87876f30a94a";

const URL_D5163 = "https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2004/decreto/d5163.htm";

const URL_BOLETIM_MME = "https://www.gov.br/mme/pt-br/assuntos/secretarias/secretaria-nacional-energia-eletrica/publicacoes/boletim-de-monitoramento-do-sistema-eletrico/2021/boletim-de-monitoramento-do-sistema-eletrico-jan-2021.pdf";

const URL_GT_MRE = "https://www.gov.br/mme/pt-br/assuntos/secretarias/secretaria-executiva/modernizacao-do-setor-eletrico/arquivos/pasta-geral-publicada/mre.pdf";

function montarConceitos(tx: TxIdioma): Conceito[] {
  const d5163 = (dispositivo: string, trecho: string, parafrase?: string): FonteOficial => ({
    orgao: tx("Presidência da República", "Presidency of the Republic"),
    documento: tx(`Decreto nº 5.163, de 30 de julho de 2004, ${dispositivo} (texto compilado, redação vigente em 06/10/2026)`, `Decree No. 5.163 of Jul 30, 2004, ${dispositivo} (consolidated text, wording in force on Oct 6, 2026)`),
    url: URL_D5163,
    trecho,
    parafrase,
  });
  const boletimMme = (secao: string, trecho: string, parafrase?: string): FonteOficial => ({
    orgao: "MME",
    documento: tx(`Boletim Mensal de Monitoramento do Sistema Elétrico Brasileiro, janeiro de 2021, ${secao}`, `Monthly Monitoring Bulletin of the Brazilian Electric System, January 2021, ${secao}`),
    url: URL_BOLETIM_MME,
    trecho,
    parafrase,
  });
  const gtMre = (secao: string, trecho: string, parafrase?: string): FonteOficial => ({
    orgao: tx("MME, GT Modernização do Setor Elétrico", "MME, Power Sector Modernization working group (GT)"),
    documento: tx(`Relatório do Grupo Temático Aprimoramento do MRE, julho de 2019, ${secao}`, `Report of the Thematic Group on MRE Improvement, July 2019, ${secao}`),
    url: URL_GT_MRE,
    trecho,
    parafrase,
  });
  const VEJA_LIVRE = [{ rotulo: tx("Mercado: livre e regulado", "Market: free and regulated"), href: "/setor-eletrico/mercado" }];
  const im229 = (trecho: string, parafrase?: string): FonteOficial => ({
    orgao: "CCEE",
    documento: tx("InfoMercado mensal Nº 229 (julho de 2026), seção 12, Glossário, página 12", "Monthly InfoMercado No. 229 (July 2026), section 12, Glossary, page 12"),
    url: URL_IM_229,
    trecho,
    parafrase,
  });
  return [
    {
      slug: "mre",
      sigla: "MRE",
      nome: tx("Mecanismo de Realocação de Energia", "Energy Reallocation Mechanism"),
      grupo: "Mercado", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-10-06",
      emUmaFrase:
        tx("Mecanismo de compartilhamento dos riscos hidrológicos associados à otimização eletroenergética do Sistema Interligado Nacional (SIN), por meio do despacho centralizado das unidades de geração de energia elétrica.", "Mechanism for sharing the hydrological risks associated with the electro-energetic optimization of the National Interconnected System (SIN), through the centralized dispatch of electricity generating units."),
      porQueImporta:
        tx("O risco hidrológico é compartilhado entre as usinas participantes do mecanismo, em vez de ficar com cada uma isoladamente. Segundo o relatório do GT de Aprimoramento do MRE, participam também as PCHs, que não são despachadas centralizadamente; para elas, o MRE é uma forma de mitigar o risco hidrológico.", "Hydrological risk is shared among the plants participating in the mechanism, instead of staying with each one in isolation. According to the report of the MRE Improvement working group, small hydropower plants (PCH), which are not centrally dispatched, also participate; for them, the MRE is a way to mitigate hydrological risk."),
      comoEMedido:
        tx("Não é uma grandeza. O resultado do mecanismo, mês a mês, é o GSF (ver o verbete): no observatório, a geração das usinas do MRE dividida pela garantia física modulada e ajustada pelo fator de disponibilidade, calculada com os conjuntos abertos da CCEE e conferida com o fator mensal do InfoMercado em alguns meses da série.", "It is not a quantity. The result of the mechanism, month by month, is the GSF (see the entry): in the observatory, the generation of the MRE plants divided by the physical guarantee modulated and adjusted by the availability factor, calculated with the CCEE open datasets and checked against the monthly InfoMercado factor in some months of the series."),
      relacoes: ["gsf", "garantia-fisica", "mcp"],
      fontes: [
        im229(
          // i18n: dado
          "MRE – Mecanismo de compartilhamento dos riscos hidrológicos associados à otimização eletroenergética do SIN, por meio do despacho centralizado das unidades de geração de energia elétrica.",
          tx("Em outras palavras: as usinas dividem entre si o risco ligado à água, no contexto de uma operação do sistema interligado otimizada e despachada de forma centralizada.", "In other words: the plants share among themselves the risk linked to water, in the context of an optimized and centrally dispatched operation of the interconnected system."),
        ),
        gtMre(
          tx("seção sobre as PCHs no mecanismo, p. 18 do documento e do PDF", "section on the PCHs in the mechanism, p. 18 of the document and of the PDF"),
          // i18n: dado
          "As PCHs são usinas a fio d’água e não participam do despacho centralizado. A extensão do MRE às PCHs permite a elas mitigar o respectivo risco hidrológico e, portanto, melhorar sua competitividade.",
          tx("Em outras palavras: as pequenas centrais hidrelétricas podem participar do MRE mesmo sem fazer parte do despacho centralizado, e isso as ajuda a reduzir o risco hidrológico.", "In other words: small hydropower plants can participate in the MRE even without being part of the centralized dispatch, and this helps them reduce hydrological risk."),
        ),
      ],
      limitacoes: [
        tx("O glossário do InfoMercado define o mecanismo, não a fórmula do fator de ajuste; a razão usada no observatório é a que reproduz o fator mensal publicado pela CCEE, e a divergência com o número de 12 meses do InfoMercado está publicada no painel.", "The InfoMercado glossary defines the mechanism, not the formula of the adjustment factor; the ratio used in the observatory is the one that reproduces the monthly factor published by the CCEE, and the divergence from the 12-month InfoMercado figure is published in the panel."),
      ],
      vejaNoPortal: [{ rotulo: tx("Mercado: MRE e GSF", "Market: MRE and GSF"), href: "/setor-eletrico/mercado/mre-e-gsf" }],
    },
    {
      slug: "acr",
      sigla: "ACR",
      nome: tx("Ambiente de Contratação Regulada", "Regulated contracting environment"),
      grupo: "Mercado", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-10-06",
      emUmaFrase: tx("Segmento do mercado em que agentes vendedores e distribuidoras compram e vendem energia por meio de licitação, conforme regras e procedimentos de comercialização específicos.", "Market segment in which selling agents and distribution utilities buy and sell energy through public tenders, according to specific trading rules and procedures."),
      porQueImporta:
        tx("É o ambiente em que a distribuidora compra a energia para o mercado que atende: o mesmo Decreto exige que os agentes de distribuição garantam cem por cento desse mercado por contratos registrados na CCEE (art. 2º, inciso II).", "It is the environment in which the distribution utility buys energy for the market it serves: the same Decree requires distribution agents to secure one hundred percent of that market through contracts registered with the CCEE (art. 2, item II)."),
      comoEMedido:
        tx("No observatório, pelo consumo contabilizado pela CCEE na classe de agente Distribuidor, em MW médios, ao lado do ACL; na EPE, pelo consumo cativo na rede, em MWh. Participações sempre como razão de somas em energia.", "In the observatory, through the consumption accounted by the CCEE in the Distributor agent class, in average MW, alongside the ACL; at the EPE, through captive consumption on the grid, in MWh. Shares always as a ratio of sums in energy."),
      relacoes: ["acl", "mcp", "pld", "tarifa-te-tusd"],
      fontes: [
        d5163(
          tx("art. 1º, § 2º, inciso I", "art. 1, § 2, item I"),
          // i18n: dado
          "I - Ambiente de Contratação Regulada - ACR o segmento do mercado no qual se realizam as operações de compra e venda de energia elétrica entre agentes vendedores e agentes de distribuição, precedidas de licitação, ressalvados os casos previstos em lei, conforme regras e procedimentos de comercialização específicos;",
          tx("Em outras palavras: no ACR, quem vende energia e as distribuidoras negociam por licitação, salvo as exceções previstas em lei.", "In other words: in the ACR, energy sellers and distribution utilities negotiate through public tenders, except for the exceptions provided for by law."),
        ),
        d5163(
          tx("art. 2º, inciso II", "art. 2, item II"),
          // i18n: dado
          "II - os agentes de distribuição deverão garantir o atendimento a cem por cento de seus mercados de energia por intermédio de contratos registrados na Câmara de Comercialização de Energia Elétrica - CCEE e, quando for o caso, aprovados, homologados ou registrados pela ANEEL;",
          tx("Em outras palavras: a distribuidora precisa ter contratos registrados na CCEE para cem por cento do mercado que atende.", "In other words: the distribution utility needs contracts registered with the CCEE for one hundred percent of the market it serves."),
        ),
      ],
      limitacoes: [
        tx("O consumo contabilizado pela CCEE, segundo a descrição do conjunto de dados da própria CCEE, é referido ao centro de gravidade do submercado: não é o consumo faturado pelas distribuidoras nem o consumo cativo da EPE, que têm outros perímetros.", "The consumption accounted by the CCEE, according to the CCEE's own dataset description, is referred to the center of gravity of the submarket: it is not the consumption billed by distribution utilities nor the EPE captive consumption, which have other perimeters."),
      ],
      vejaNoPortal: VEJA_LIVRE,
    },
    {
      slug: "acl",
      sigla: "ACL",
      nome: tx("Ambiente de Contratação Livre", "Free contracting environment"),
      grupo: "Mercado", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-10-06",
      emUmaFrase: tx("Segmento do mercado em que a energia é comprada e vendida em contratos bilaterais livremente negociados, conforme regras e procedimentos de comercialização específicos.", "Market segment in which energy is bought and sold in freely negotiated bilateral contracts, according to specific trading rules and procedures."),
      porQueImporta:
        tx("A parte do consumo que contrata nesse ambiente não compra a energia da distribuidora; a participação do ACL no consumo mostra quanto do mercado passou a negociar a própria energia.", "The part of consumption that contracts in this environment does not buy energy from the distribution utility; the ACL share of consumption shows how much of the market has started to negotiate its own energy."),
      comoEMedidoResumo:
        tx("A participação do ACL é a energia consumida nas classes de agente do ACL dividida pelo consumo contabilizado pela CCEE (ACR e ACL), sem a exportação. Aqui, o ACR é a classe de agente Distribuidor e o ACL, a soma das demais classes, exceto Exportador. A conta soma a energia dos meses antes de dividir: é uma razão de somas, e não a média dos percentuais mensais.", "The ACL share is the energy consumed in the ACL agent classes divided by the consumption accounted by the CCEE (ACR and ACL), without exports. Here, the ACR is the Distributor agent class and the ACL, the sum of the other classes, except Exporter. The calculation sums the energy of the months before dividing: it is a ratio of sums, not the average of monthly percentages."),
      comoEMedido:
        tx("No observatório, pelo consumo contabilizado pela CCEE nas classes de agente de consumo, sem a exportação, em MW médios; e pelo consumo livre na rede publicado pela EPE, em MWh. Participações sempre como razão de somas em energia, nunca média de percentuais.", "In the observatory, through the consumption accounted by the CCEE in the consumption agent classes, without exports, in average MW; and through free consumption on the grid published by the EPE, in MWh. Shares always as a ratio of sums in energy, never an average of percentages."),
      relacoes: ["acr", "mcp", "pld"],
      fontes: [
        d5163(
          tx("art. 1º, § 2º, inciso II", "art. 1, § 2, item II"),
          // i18n: dado
          "II - Ambiente de Contratação Livre - ACL o segmento do mercado no qual se realizam as operações de compra e venda de energia elétrica, objeto de contratos bilaterais livremente negociados, conforme regras e procedimentos de comercialização específicos;",
          tx("Em outras palavras: no ACL, comprador e vendedor negociam diretamente os contratos, dentro das regras de comercialização.", "In other words: in the ACL, buyer and seller negotiate the contracts directly, within the trading rules."),
        ),
      ],
      limitacoes: [
        tx("O observatório não publica preço de contrato do ACL: os contratos são bilaterais e privados, e o PLD não é o preço deles.", "The observatory does not publish ACL contract prices: the contracts are bilateral and private, and the PLD is not their price."),
      ],
      vejaNoPortal: VEJA_LIVRE,
    },
    {
      slug: "garantia-fisica",
      nome: tx("Garantia física", "Physical guarantee"),
      grupo: "Mercado", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-10-06",
      emUmaFrase:
        tx("Quantidade máxima de energia de um empreendimento de geração, definida pelo Ministério de Minas e Energia, que pode ser usada para comprovar atendimento de carga ou para comercialização por meio de contratos.", "Maximum amount of energy of a generation project, set by the Ministry of Mines and Energy, that can be used to prove load coverage or for trading through contracts."),
      porQueImporta:
        tx("O Decreto exige que os agentes vendedores tenham lastro para cem por cento dos contratos, e esse lastro é a garantia física de empreendimentos próprios ou de terceiros; ela é revisada periodicamente e calculada pela EPE.", "The Decree requires selling agents to have backing for one hundred percent of their contracts, and this backing is the physical guarantee of their own or third-party projects; it is reviewed periodically and calculated by the EPE."),
      comoEMedido:
        tx("No observatório, a garantia física das usinas do MRE aparece em MW médios nos conjuntos da CCEE, modulada e ajustada pelo fator de disponibilidade, como denominador do GSF; a de cada usina não é publicada aqui.", "In the observatory, the physical guarantee of the MRE plants appears in average MW in the CCEE datasets, modulated and adjusted by the availability factor, as the denominator of the GSF; that of each plant is not published here."),
      relacoes: ["mre", "gsf", "acr", "acl"],
      fontes: [
        d5163(
          tx("art. 2º, inciso I", "art. 2, item I"),
          // i18n: dado
          "I - os agentes vendedores deverão apresentar lastro para a venda de energia para garantir cem por cento de seus contratos;",
          tx("Em outras palavras: quem vende energia precisa ter lastro para cem por cento dos contratos.", "In other words: whoever sells energy needs backing for one hundred percent of the contracts."),
        ),
        d5163(
          tx("art. 2º, § 1º", "art. 2, § 1"),
          // i18n: dado
          "§ 1 º O lastro para a venda de que trata o inciso I do caput será constituído pela garantia física proporcionada por empreendimento de geração própria ou de terceiros, neste caso, mediante contratos de compra de energia.",
        ),
        d5163(
          tx("art. 2º, § 2º", "art. 2, § 2"),
          // i18n: dado
          "§ 2 º A garantia física de energia de um empreendimento de geração, a ser definida pelo Ministério de Minas e Energia e a qual deverá constar do contrato de concessão ou do ato de autorização, corresponderá à quantidade máxima de energia elétrica associada ao empreendimento, incluída a importação, que poderá ser utilizada para comprovação de atendimento de carga ou comercialização por meio de contratos.",
          tx("Em outras palavras: a garantia física é o teto de energia que um empreendimento pode usar para comprovar atendimento de carga ou vender em contratos, fixado pelo MME no ato de outorga.", "In other words: the physical guarantee is the energy ceiling that a project can use to prove load coverage or to sell in contracts, set by the MME in the grant act."),
        ),
        d5163(
          tx("art. 2º, § 3º", "art. 2, § 3"),
          // i18n: dado
          "§ 3º A garantia física de empreendimentos de geração será revisada periodicamente e calculada pela Empresa de Pesquisa Energética - EPE conforme diretrizes e metodologias estabelecidas pelo Ministério de Minas e Energia.",
        ),
      ],
      limitacoes: [
        tx("Garantia física não é geração: a usina pode gerar mais ou menos que ela em cada mês, e é essa diferença, no conjunto das hidrelétricas do MRE, que o GSF mede.", "Physical guarantee is not generation: the plant may generate more or less than it each month, and it is this difference, across the MRE hydropower plants, that the GSF measures."),
      ],
      vejaNoPortal: [{ rotulo: tx("Mercado: MRE e GSF", "Market: MRE and GSF"), href: "/setor-eletrico/mercado/mre-e-gsf" }],
    },
    {
      slug: "ess",
      sigla: "ESS",
      nome: tx("Encargos de Serviços do Sistema", "System Service Charges"),
      grupo: "Mercado", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-10-06",
      emUmaFrase:
        tx("Encargo previsto nas regras de comercialização para cobrir os custos dos serviços do sistema prestados aos usuários do SIN, inclusive os serviços ancilares, como a geração despachada fora da ordem de mérito por restrição de transmissão ou por segurança energética.", "Charge provided for in the trading rules to cover the costs of system services provided to SIN users, including ancillary services, such as generation dispatched out of merit order due to transmission constraints or for energy security."),
      porQueImporta:
        tx("É um custo da operação que não está no preço da energia: o Decreto prevê que a geração despachada fora da ordem de mérito seja alocada aos consumidores, com possibilidade de diferenciação entre os submercados.", "It is an operating cost that is not in the energy price: the Decree provides that generation dispatched out of merit order be allocated to consumers, with the possibility of differentiation between submarkets."),
      comoEMedido:
        tx("No observatório, pela soma mensal dos tipos de encargo publicados pela CCEE no conjunto ENCARGO_ESS_ANCILAR, em reais, por mês de competência, conferida com o boletim de monitoramento do MME e com o InfoMercado.", "In the observatory, through the monthly sum of the charge types published by the CCEE in the ENCARGO_ESS_ANCILAR dataset, in reais, by accrual month, checked against the MME monitoring bulletin and the InfoMercado."),
      relacoes: ["mcp", "pld", "cde"],
      fontes: [
        d5163(
          tx("art. 59, caput e inciso I", "art. 59, caput and item I"),
          // i18n: dado
          "Art. 59. As regras e os procedimentos de comercialização deverão prever o pagamento de encargo para cobertura dos custos dos serviços do sistema, inclusive dos serviços ancilares, prestados aos usuários do SIN, que compreenderão, entre outros: (Redação dada pelo Decreto nº 9.143, de 2017) I - a geração despachada independentemente da ordem de mérito, por restrições de transmissão em cada submercado ou por razões de segurança energética, a ser alocada aos consumidores com possibilidade de diferenciação entre os submercados;",
          tx("Em outras palavras: as regras de comercialização preveem um encargo para pagar os serviços que mantêm o sistema operando, entre eles a geração acionada fora da ordem de custo por limite da rede ou por segurança energética.", "In other words: the trading rules provide for a charge to pay for the services that keep the system operating, among them generation called out of cost order due to a grid limit or for energy security."),
        ),
        d5163(
          tx("art. 59, incisos II e III", "art. 59, items II and III"),
          // i18n: dado
          "II - a reserva de potência operativa, em MW, disponibilizada pelos geradores para a regulação da freqüência do sistema e sua capacidade de partida autônoma; III - a reserva de capacidade, em MVAr, disponibilizada pelos geradores, superior aos valores de referência estabelecidos para cada gerador em Procedimentos de Rede do ONS, necessária à operação do sistema de transmissão;",
        ),
      ],
      limitacoes: [
        tx("Valor de competência não é valor pago no mês: o pagamento sai depois, na liquidação, e passa pelo alívio com recursos do próprio mercado.", "An accrual value is not an amount paid in the month: payment comes later, in the settlement, and goes through the relief with funds from the market itself."),
      ],
      vejaNoPortal: [{ rotulo: tx("Mercado: encargos e liquidação", "Market: charges and settlement"), href: "/setor-eletrico/mercado/encargos" }],
    },
    {
      slug: "gsf",
      sigla: "GSF",
      nome: tx("Generation Scaling Factor (fator de ajuste do MRE)", "Generation Scaling Factor (MRE adjustment factor)"),
      grupo: "Mercado", // i18n: dado
      estado: "CONFERIDO",
      conferidoEm: "2026-10-07",
      ressalva: tx("definição regulatória não lida (Regras de Comercialização da CCEE)", "regulatory definition not read (CCEE Trading Rules)"),
      emUmaFrase:
        tx("Razão, em percentual, entre a geração verificada das usinas do Mecanismo de Realocação de Energia (MRE) no mês e a garantia física dessas usinas (no boletim do MME, a garantia física sazonalizada). Abaixo de 100%, as hidrelétricas do mecanismo geraram, juntas, menos que a garantia física.", "Ratio, as a percentage, between the verified generation of the plants of the Energy Reallocation Mechanism (MRE) in the month and the physical guarantee of these plants (in the MME bulletin, the seasonalized physical guarantee). Below 100%, the hydropower plants of the mechanism generated, together, less than the physical guarantee."),
      porQueImporta:
        tx("A garantia física é a quantidade máxima de energia de um empreendimento que pode comprovar atendimento de carga ou lastrear contratos (ver Garantia física); o GSF mostra, mês a mês, quanto dela as hidrelétricas do MRE entregaram juntas. O relatório do GT de Aprimoramento do MRE (julho de 2019) registra que, desde 2014, o GSF tem ficado abaixo de 90%, o que expôs negativamente muitos agentes hidrelétricos a valores elevados de PLD, e que o descolamento entre a sazonalidade da produção e a da garantia física sazonalizada infla o GSF no período úmido e o reduz no período seco, com oscilações artificiais que elevam o risco das hidrelétricas.", "Physical guarantee is the maximum amount of energy of a project that can prove load coverage or back contracts (see Physical guarantee); the GSF shows, month by month, how much of it the MRE hydropower plants delivered together. The report of the MRE Improvement working group (July 2019) records that, since 2014, the GSF has been below 90%, which negatively exposed many hydropower agents to high PLD values, and that the mismatch between the seasonality of production and that of the seasonalized physical guarantee inflates the GSF in the wet season and reduces it in the dry season, with artificial oscillations that raise the risk for hydropower plants."),
      comoEMedidoResumo:
        tx("O GSF é a geração das usinas do MRE no mês dividida pela garantia física delas, em percentual. O que muda de uma fonte para outra é qual garantia física entra no denominador; o observatório usa a modulada e ajustada pelo fator de disponibilidade.", "The GSF is the generation of the MRE plants in the month divided by their physical guarantee, as a percentage. What changes from one source to another is which physical guarantee goes into the denominator; the observatory uses the one modulated and adjusted by the availability factor."),
      comoEMedido:
        tx("Nos documentos do MME. O boletim compara a geração hidráulica, rotulada \"(centro de gravidade)\", com a garantia física sazonalizada. Segundo o relatório do GT, o MRE usa a garantia física sazonalizada e modulada: a sazonalização segue a estratégia comercial de cada agente, e a modulação segue as regras de comercialização e o perfil de geração das usinas do MRE.\n\nNo observatório. O denominador é a garantia física modulada e ajustada pelo fator de disponibilidade, nos conjuntos abertos da CCEE, em percentual, por mês, e o resultado foi conferido com o fator mensal do InfoMercado em alguns meses da série, listados no painel.", "In the MME documents. The bulletin compares hydropower generation, labeled \"(center of gravity)\", with the seasonalized physical guarantee. According to the working group report, the MRE uses the seasonalized and modulated physical guarantee: seasonalization follows the commercial strategy of each agent, and modulation follows the trading rules and the generation profile of the MRE plants.\n\nIn the observatory. The denominator is the physical guarantee modulated and adjusted by the availability factor, in the CCEE open datasets, as a percentage, by month, and the result was checked against the monthly InfoMercado factor in some months of the series, listed in the panel."),
      relacoesNotas: {
        mre: tx("O relatório do GT trata o fator de ajuste do MRE e o GSF como o mesmo número: o GSF é o resultado mensal do mecanismo.", "The working group report treats the MRE adjustment factor and the GSF as the same number: the GSF is the monthly result of the mechanism."),
        "garantia-fisica": tx("É o denominador da razão, e as fontes não usam a mesma garantia física (ver o que não se pode concluir).", "It is the denominator of the ratio, and the sources do not use the same physical guarantee (see what cannot be concluded)."),
      },
      relacoes: ["mre", "garantia-fisica"],
      fontes: [
        boletimMme(
          tx("seção 8.5, Mecanismo de Realocação de Energia, p. 28 do documento (p. 33 do PDF)", "section 8.5, Energy Reallocation Mechanism, p. 28 of the document (p. 33 of the PDF)"),
          // i18n: dado
          "Em dezembro de 2020, as usinas participantes do MRE geraram, juntas, 42.500 MWmédios, ante a garantia física sazonalizada de 52.788 MWmédios, o que representou um GSF mensal de 80,51%.",
          tx("Em outras palavras: dividindo o que as usinas do MRE geraram juntas, 42.500 MWmédios, pela garantia física sazonalizada, 52.788 MWmédios, o resultado é 80,51%, e esse é o GSF do mês.", "In other words: dividing what the MRE plants generated together, 42,500 MWavg, by the seasonalized physical guarantee, 52,788 MWavg, the result is 80.51%, and that is the GSF of the month."),
        ),
        boletimMme(tx("lista de siglas, p. 40 do documento (p. 45 do PDF)", "list of acronyms, p. 40 of the document (p. 45 of the PDF)"), "GSF - Generation Scaling Factor"),
        gtMre(
          tx("seção sobre o balanço operativo, p. 38 do documento e do PDF", "section on the operating balance, p. 38 of the document and of the PDF"),
          // i18n: dado
          "Com base no comportamento da geração hidrelétrica é possível avaliar o comportamento do fator de ajuste do MRE, conhecido como GSF.",
          tx("Em outras palavras: o relatório trata o fator de ajuste do MRE e o GSF como o mesmo número.", "In other words: the report treats the MRE adjustment factor and the GSF as the same number."),
        ),
        gtMre(
          tx("Tabela 1, variáveis avaliadas, p. 22 do documento e do PDF", "Table 1, variables assessed, p. 22 of the document and of the PDF"),
          // i18n: dado
          "Razão entre a geração verificada (mensal) e as garantias físicas históricas. Neste estudo não será considerado procedimento da sazonalização das garantias físicas para o MRE.",
          tx("Em outras palavras: neste estudo o GSF é a geração mensal verificada dividida pelas garantias físicas históricas, sem aplicar a sazonalização das garantias físicas.", "In other words: in this study the GSF is the verified monthly generation divided by the historical physical guarantees, without applying the seasonalization of physical guarantees."),
        ),
        gtMre(
          tx("seção sobre a contabilização do MRE, p. 17 do documento e do PDF", "section on MRE accounting, p. 17 of the document and of the PDF"),
          // i18n: dado
          "e utiliza a GF sazonalizada e modulada. A sazonalização da GF é realizada em função da estratégia comercial de cada agente, enquanto que a modulação é realizada pelas regras de comercialização e segue o perfil de geração das usinas do MRE.",
          tx("Em outras palavras: a garantia física que entra na contabilização do MRE passa por duas etapas, a sazonalização, que depende da estratégia de cada agente, e a modulação, que segue as regras de comercialização e o perfil de geração das usinas.", "In other words: the physical guarantee that goes into MRE accounting goes through two steps, seasonalization, which depends on each agent's strategy, and modulation, which follows the trading rules and the generation profile of the plants."),
        ),
        gtMre(
          tx("seção sobre a recente crise do MRE, p. 21 do documento e do PDF", "section on the recent MRE crisis, p. 21 of the document and of the PDF"),
          // i18n: dado
          "Os últimos anos foram os mais desafiadores para o MRE desde sua implantação em 2001, especialmente a partir do ano de 2014, período em que o GSF tem apresentado valores abaixo de 90%, o que tem exposto negativamente muitos agentes hidrelétricos a valores elevados de PLD.",
          tx("Em outras palavras: desde 2014 o GSF vinha abaixo de 90%, e isso deixou muitos agentes hidrelétricos expostos a preços de curto prazo elevados.", "In other words: since 2014 the GSF had been below 90%, and this left many hydropower agents exposed to high spot prices."),
        ),
        gtMre(
          tx("seção sobre a produção das usinas do MRE (figura 8), p. 18 do documento e do PDF", "section on the production of the MRE plants (figure 8), p. 18 of the document and of the PDF"),
          // i18n: dado
          "O descolamento entre a sazonalidade da produção hidrelétrica e da GF faz com o GSF seja inflado no período úmido (muita geração e baixa GF sazonalizada) e reduzido no período seco (pouca geração e alta GF sazonalizada), provocando oscilações artificiais do GSF e elevando o risco das hidrelétricas.",
          tx("Em outras palavras (o original traz \"faz com o GSF seja inflado\"): como a produção das hidrelétricas e a garantia física sazonalizada não variam juntas ao longo do ano, o GSF calculado com a garantia física sazonalizada fica artificialmente alto no período úmido, quando se gera muito e a garantia física sazonalizada é baixa, e artificialmente baixo no período seco.", "In other words (the original reads «faz com o GSF seja inflado», with a missing word): since hydropower production and the seasonalized physical guarantee do not vary together over the year, the GSF calculated with the seasonalized physical guarantee is artificially high in the wet season, when a lot is generated and the seasonalized physical guarantee is low, and artificially low in the dry season."),
        ),
      ],
      limitacoes: [
        tx("As fontes não usam o mesmo denominador. O boletim do MME usa a garantia física sazonalizada; o relatório do GT usa as garantias físicas históricas, sem sazonalização, na Tabela 1, e a garantia física sazonalizada nas figuras; o observatório usa a garantia física modulada e ajustada pelo fator de disponibilidade. A diferença pode ser grande: no exemplo, o mesmo mês dá resultados distintos com cada denominador. Valores de fontes diferentes só se comparam depois de conferir o denominador.", "The sources do not use the same denominator. The MME bulletin uses the seasonalized physical guarantee; the working group report uses the historical physical guarantees, without seasonalization, in Table 1, and the seasonalized physical guarantee in the figures; the observatory uses the physical guarantee modulated and adjusted by the availability factor. The difference can be large: in the example, the same month gives different results with each denominator. Values from different sources can only be compared after checking the denominator."),
        tx("A definição regulatória do fator de ajuste do MRE, nas Regras de Comercialização da CCEE e na regulamentação da ANEEL, não foi lida: o repositório de normas da ANEEL recusa as consultas automáticas do observatório, e as Regras de Comercialização também não foram lidas. O verbete descreve o GSF como os documentos do MME o usam.", "The regulatory definition of the MRE adjustment factor, in the CCEE Trading Rules and in ANEEL regulations, was not read: ANEEL's repository of norms refuses the observatory's automated queries, and the Trading Rules were not read either. The entry describes the GSF as the MME documents use it."),
        tx("A conferência com o fator mensal do InfoMercado cobre alguns meses da série, e o mês do exemplo pode ainda não ter edição correspondente; a lista e a divergência do número de 12 meses estão no painel de Mercado (ver MRE).", "The check against the monthly InfoMercado factor covers some months of the series, and the month of the example may not yet have a corresponding edition; the list and the divergence of the 12-month figure are in the Market panel (see MRE)."),
        tx("O GSF é o resultado do conjunto das usinas do mecanismo, que o boletim descreve como as usinas do MRE geraram \"juntas\"; não é o desempenho de uma usina.", "The GSF is the result of the set of plants of the mechanism, which the bulletin describes as the MRE plants having generated \"together\"; it is not the performance of a single plant."),
      ],
      detalheDaConferencia: [tx("O repositório de normas da ANEEL responde 403 a requisições automatizadas, e o bloqueio não foi contornado.", "ANEEL's repository of norms returns 403 to automated requests, and the block was not circumvented.")],
      vejaNoPortal: [{ rotulo: tx("Mercado: MRE e GSF", "Market: MRE and GSF"), href: "/setor-eletrico/mercado/mre-e-gsf#mre-gsf" }],
    },
  ];
}
export const CONCEITOS_IDIOMAS = montarNosDoisIdiomas(montarConceitos);
export const CONCEITOS: Conceito[] = CONCEITOS_IDIOMAS.pt;
