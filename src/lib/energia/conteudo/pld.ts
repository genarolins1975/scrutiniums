/**
 * Conteúdo didático do módulo PLD como registro de afirmações: cada texto tem
 * fonte e estado de conferência (CONFERIDO contra documento acessado; PENDENTE
 * quando a documentação primária, sobretudo a da CCEE e dos modelos, não foi
 * acessada nesta fase). A interface mostra o estado ao lado do texto.
 */
import type { EstadoConferencia } from "./conceitos";
import { montarNosDoisIdiomas, type TxIdioma } from "@/lib/energia/i18n/aprenda";

export type TipoRelacao =
  | "relacao_fisica"
  | "mecanismo_economico"
  | "informacao_modelos"
  | "resultado_modelos"
  | "regra_regulatoria"
  | "associacao_estatistica"
  | "interpretacao_analitica"
  | "contribuicao_modelo";

function montarTiposRelacao(tx: TxIdioma): Record<TipoRelacao, { rotulo: string; definicao: string }> {
  return {
    relacao_fisica: { rotulo: tx("Relação física", "Physical relation"), definicao: tx("Relação material entre grandezas, como a que liga vazões, volumes armazenados e geração.", "Material relation between quantities, such as the one linking flows, stored volumes and generation.") },
    mecanismo_economico: { rotulo: tx("Mecanismo econômico", "Economic mechanism"), definicao: tx("Relação estrutural de custo e escolha descrita na formação de preço.", "Structural relation of cost and choice described in price formation.") },
    informacao_modelos: { rotulo: tx("Informação usada pelos modelos oficiais", "Information used by the official models"), definicao: tx("Dado de entrada dos modelos de operação e de formação de preço.", "Input data of the operation and price formation models.") },
    resultado_modelos: { rotulo: tx("Resultado dos modelos oficiais", "Result of the official models"), definicao: tx("Grandeza produzida pelos modelos NEWAVE, DECOMP e DESSEM.", "Quantity produced by the NEWAVE, DECOMP and DESSEM models.") },
    regra_regulatoria: { rotulo: tx("Regra regulatória", "Regulatory rule"), definicao: tx("Regra aplicada por norma, como os limites do PLD.", "Rule applied by a norm, such as the PLD limits.") },
    associacao_estatistica: { rotulo: tx("Associação estatística", "Statistical association"), definicao: tx("Correlação medida pela Scrutiniums, com janela e método declarados. Não é causalidade.", "Correlation measured by Scrutiniums, with declared window and method. It is not causality.") },
    interpretacao_analitica: { rotulo: tx("Interpretação analítica", "Analytical interpretation"), definicao: tx("Leitura da Scrutiniums, marcada como tal.", "Scrutiniums' reading, marked as such.") },
    contribuicao_modelo: { rotulo: tx("Contribuição de modelo proprietário", "Contribution of a proprietary model"), definicao: tx("Peso de uma variável em modelo da Scrutiniums. Nunca é chamada de causa.", "Weight of a variable in a Scrutiniums model. It is never called a cause.") },
  };
}
export const TIPOS_RELACAO_IDIOMAS = montarNosDoisIdiomas(montarTiposRelacao);
export const TIPOS_RELACAO: Record<TipoRelacao, { rotulo: string; definicao: string }> = TIPOS_RELACAO_IDIOMAS.pt;

export type NoFormacao = {
  id: string;
  titulo: string;
  sigla?: string;
  oQueE: string;
  fonteOQueE: string;
  conferenciaOQueE: EstadoConferencia;
  mecanismo?: string;
  conferenciaMecanismo?: EstadoConferencia;
  relacaoSaida?: { para: string; tipo: TipoRelacao; texto: string; conferencia: EstadoConferencia; fonte: string };
  modulo?: { rotulo: string; href: string };
  conceito?: string;
};

function montarNosFormacao(tx: TxIdioma): NoFormacao[] {
  return [
    {
      id: "afluencias",
      titulo: tx("Chuva e afluências", "Rainfall and inflows"),
      sigla: "ENA",
      oQueE: tx("Energia produzível a partir das vazões naturais aos reservatórios, calculada pelo ONS com as produtividades das usinas a 65% dos volumes úteis.", "Energy that can be produced from the natural flows into the reservoirs, calculated by the ONS with the productivities of the plants at 65% of the useful volumes."),
      fonteOQueE: tx("ONS, ENA Diário por Subsistema", "ONS, daily ENA by subsystem dataset"),
      conferenciaOQueE: "CONFERIDO",
      relacaoSaida: {
        para: "reservatorios",
        tipo: "relacao_fisica",
        texto: tx("A parte da afluência que não é vertida pode ser armazenada; a EAR resulta também das defluências e dos usos da água.", "The part of the inflow that is not spilled can be stored; EAR also results from outflows and water uses."),
        conferencia: "PENDENTE",
        fonte: tx("Documentação do ONS sobre balanço hídrico dos reservatórios (não acessada nesta fase)", "ONS documentation on the water balance of the reservoirs (not accessed in this phase)"),
      },
      modulo: { rotulo: tx("Água e clima", "Water and climate"), href: "/setor-eletrico/agua-e-clima/afluencia#p018" },
      conceito: "ena",
    },
    {
      id: "reservatorios",
      titulo: tx("Reservatórios e valor da água", "Reservoirs and the value of water"),
      sigla: "EAR",
      oQueE: tx("Energia associada ao volume de água armazenado que pode virar geração na própria usina e nas usinas a jusante.", "Energy associated with the volume of stored water that can become generation at the plant itself and at the downstream plants."),
      fonteOQueE: tx("ONS, EAR Diário por Subsistema", "ONS, daily EAR by subsystem dataset"),
      conferenciaOQueE: "CONFERIDO",
      mecanismo:
        tx("Água usada agora deixa de estar disponível depois. Por isso a água armazenada tem valor de oportunidade, e a otimização da operação pesa gerar com água agora contra guardá-la para o futuro. É o que torna o sistema brasileiro hidrotérmico e intertemporal.", "Water used now is no longer available later. That is why stored water has an opportunity value, and the optimization of operation weighs generating with water now against saving it for the future. This is what makes the Brazilian system hydrothermal and intertemporal."),
      conferenciaMecanismo: "PENDENTE",
      relacaoSaida: {
        para: "otimizacao",
        tipo: "informacao_modelos",
        texto: tx("O estado dos reservatórios entra na otimização da operação.", "The state of the reservoirs enters the optimization of operation."),
        conferencia: "PENDENTE",
        fonte: tx("Documentação dos modelos (não acessada nesta fase)", "Model documentation (not accessed in this phase)"),
      },
      modulo: { rotulo: tx("Água e clima", "Water and climate"), href: "/setor-eletrico/agua-e-clima#ear" },
      conceito: "ear",
    },
    {
      id: "carga",
      titulo: tx("Carga", "Load"),
      oQueE: tx("Carga atendida no sistema interligado, publicada pelo ONS por subsistema em base diária, em MWmed.", "Load served in the interconnected system, published by the ONS by subsystem on a daily basis, in MWavg."),
      fonteOQueE: tx("ONS, Carga de Energia Diária", "ONS, daily energy load dataset"),
      conferenciaOQueE: "CONFERIDO",
      relacaoSaida: {
        para: "otimizacao",
        tipo: "informacao_modelos",
        texto: tx("A carga a atender é dado de entrada da programação da operação.", "The load to be served is an input of operation scheduling."),
        conferencia: "PENDENTE",
        fonte: tx("Documentação dos modelos (não acessada nesta fase)", "Model documentation (not accessed in this phase)"),
      },
      modulo: { rotulo: tx("Carga e consumo", "Load and consumption"), href: "/setor-eletrico/carga" },
      conceito: "carga",
    },
    {
      id: "renovaveis",
      titulo: tx("Eólica, solar e outras fontes", "Wind, solar and other sources"),
      oQueE: tx("Geração eólica e fotovoltaica verificada no balanço de energia do ONS, hora a hora.", "Wind and photovoltaic generation verified in the ONS energy balance, hour by hour."),
      fonteOQueE: tx("ONS, Balanço de Energia nos Subsistemas", "ONS, energy balance in the subsystems dataset"),
      conferenciaOQueE: "CONFERIDO",
      relacaoSaida: {
        para: "otimizacao",
        tipo: "informacao_modelos",
        texto: tx("A expectativa de geração dessas fontes entra na programação da operação.", "The expected generation of these sources enters operation scheduling."),
        conferencia: "PENDENTE",
        fonte: tx("Documentação dos modelos (não acessada nesta fase)", "Model documentation (not accessed in this phase)"),
      },
      modulo: { rotulo: tx("Geração", "Generation"), href: "/setor-eletrico/geracao" },
      conceito: "geracao-centralizada",
    },
    {
      id: "termicas",
      titulo: tx("Disponibilidade e custo das térmicas", "Availability and cost of thermal plants"),
      sigla: "CVU",
      oQueE: tx("O Custo Variável Unitário das térmicas é considerado pelo ONS no Programa Mensal da Operação e usado nos modelos NEWAVE, DECOMP e DESSEM.", "The Unit Variable Cost of thermal plants is considered by the ONS in the Monthly Operation Program and used in the NEWAVE, DECOMP and DESSEM models."),
      fonteOQueE: tx("ONS, CVU das Usinas Térmicas", "ONS, thermal plant CVU dataset"),
      conferenciaOQueE: "CONFERIDO",
      relacaoSaida: {
        para: "otimizacao",
        tipo: "informacao_modelos",
        texto: tx("O CVU é utilizado na execução dos modelos NEWAVE, DECOMP e DESSEM.", "The CVU is used in running the NEWAVE, DECOMP and DESSEM models."),
        conferencia: "CONFERIDO",
        fonte: tx("ONS, CVU das Usinas Térmicas", "ONS, thermal plant CVU dataset"),
      },
      modulo: { rotulo: tx("Geração", "Generation"), href: "/setor-eletrico/geracao#termica" },
      conceito: "cvu",
    },
    {
      id: "rede",
      titulo: tx("Rede, intercâmbios e restrições", "Grid, interchanges and restrictions"),
      oQueE: tx("Fluxo de energia entre subsistemas pelas linhas de transmissão de fronteira, verificado e programado pelo ONS.", "Energy flow between subsystems through the border transmission lines, verified and scheduled by the ONS."),
      fonteOQueE: tx("ONS, Intercâmbios Entre Subsistemas", "ONS, interchanges between subsystems dataset"),
      conferenciaOQueE: "CONFERIDO",
      relacaoSaida: {
        para: "otimizacao",
        tipo: "informacao_modelos",
        texto: tx("Os limites de transferência entre regiões restringem a solução da operação.", "Transfer limits between regions constrain the operation solution."),
        conferencia: "PENDENTE",
        fonte: tx("Documentação dos modelos (não acessada nesta fase)", "Model documentation (not accessed in this phase)"),
      },
      modulo: { rotulo: tx("Rede", "Grid"), href: "/setor-eletrico/rede" },
      conceito: "intercambio",
    },
    {
      id: "otimizacao",
      titulo: tx("Modelos oficiais (NEWAVE, DECOMP, DESSEM)", "Official models (NEWAVE, DECOMP, DESSEM)"),
      oQueE: tx("O cálculo do PLD é realizado por modelos computacionais: NEWAVE, DECOMP e DESSEM. O ONS publica o CMO estimado pelo DECOMP por semana operativa e pelo DESSEM em base semi-horária.", "The PLD is calculated by computer models: NEWAVE, DECOMP and DESSEM. The ONS publishes the CMO estimated by DECOMP by operating week and by DESSEM on a half-hourly basis."),
      fonteOQueE: tx("CCEE, descrição oficial do PLD; ONS, CMO Semanal e CMO Semi-Horário", "CCEE, official description of the PLD; ONS, weekly CMO and half-hourly CMO datasets"),
      conferenciaOQueE: "CONFERIDO",
      relacaoSaida: {
        para: "cmo",
        tipo: "resultado_modelos",
        texto: tx("O ONS publica o CMO estimado pelo DECOMP (semanal) e pelo DESSEM (semi-horário).", "The ONS publishes the CMO estimated by DECOMP (weekly) and by DESSEM (half-hourly)."),
        conferencia: "CONFERIDO",
        fonte: tx("ONS, CMO Semanal (DECOMP) e CMO Semi-Horário (DESSEM)", "ONS, weekly CMO (DECOMP) and half-hourly CMO (DESSEM) datasets"),
      },
      conceito: "decomp",
    },
    {
      id: "cmo",
      titulo: tx("Custo Marginal de Operação", "Marginal operating cost"),
      sigla: "CMO",
      oQueE: tx("Custo, por unidade de energia produzida, para atender ao incremento de uma unidade de carga no sistema interligado.", "Cost, per unit of energy produced, of meeting an increase of one unit of load in the interconnected system."),
      fonteOQueE: tx("ONS, CMO Semanal", "ONS, weekly CMO dataset"),
      conferenciaOQueE: "CONFERIDO",
      relacaoSaida: {
        para: "limites",
        tipo: "regra_regulatoria",
        texto: tx("O PLD tem como base o CMO, com aplicação dos limites mínimo e máximos vigentes.", "The PLD is based on the CMO, with the minimum and maximum limits in force applied."),
        conferencia: "CONFERIDO",
        fonte: tx("CCEE, descrição oficial do PLD", "CCEE, official description of the PLD"),
      },
      modulo: { rotulo: tx("CMO semanal", "Weekly CMO"), href: "/setor-eletrico/pld#cmo" },
      conceito: "cmo",
    },
    {
      id: "limites",
      titulo: tx("Regras e limites aplicáveis", "Applicable rules and limits"),
      oQueE: tx("Limites máximos (horário e estrutural) e mínimo vigentes para cada período de apuração e para cada submercado.", "Maximum (hourly and structural) and minimum limits in force for each determination period and for each submarket."),
      fonteOQueE: tx("CCEE, descrição oficial do PLD", "CCEE, official description of the PLD"),
      conferenciaOQueE: "CONFERIDO",
      relacaoSaida: {
        para: "pld",
        tipo: "regra_regulatoria",
        texto: tx("O resultado, limitado, é o PLD de cada hora e submercado.", "The result, limited, is the PLD of each hour and submarket."),
        conferencia: "CONFERIDO",
        fonte: tx("CCEE, descrição oficial do PLD", "CCEE, official description of the PLD"),
      },
      conceito: "pld",
    },
    {
      id: "pld",
      titulo: "PLD",
      oQueE: tx("Valor em R$/MWh calculado pela CCEE diariamente para cada hora do dia seguinte e para cada submercado.", "Value in R$/MWh calculated by the CCEE daily for each hour of the following day and for each submarket."),
      fonteOQueE: tx("CCEE, descrição oficial do PLD", "CCEE, official description of the PLD"),
      conferenciaOQueE: "CONFERIDO",
      modulo: { rotulo: tx("O que está acontecendo", "What is happening"), href: "/setor-eletrico/pld#hoje" },
      conceito: "pld",
    },
  ];
}
export const NOS_FORMACAO_IDIOMAS = montarNosDoisIdiomas(montarNosFormacao);
export const NOS_FORMACAO: NoFormacao[] = NOS_FORMACAO_IDIOMAS.pt;

/** "O que o PLD não é": cada item com o porquê e a base. */
function montarPldNaoE(tx: TxIdioma): { titulo: string; porque: string; base: string; conferencia: EstadoConferencia }[] {
  return [
    {
      titulo: tx("Não é a sua tarifa de energia", "It is not your energy tariff"),
      porque:
        tx("A conta de quem é atendido pela distribuidora segue a Tarifa de Energia (TE) e a Tarifa de Uso do Sistema de Distribuição (TUSD), resultantes dos processos tarifários da ANEEL. O PLD é calculado pela CCEE para cada hora e submercado com base no CMO.", "The bill of those served by the distribution utility follows the Energy Tariff (TE) and the Distribution System Use Tariff (TUSD), resulting from ANEEL's tariff processes. The PLD is calculated by the CCEE for each hour and submarket based on the CMO."),
      base: tx("ANEEL, Tarifas de aplicação das distribuidoras; CCEE, descrição oficial do PLD", "ANEEL, applicable tariffs of the distribution utilities; CCEE, official description of the PLD"),
      conferencia: "CONFERIDO",
    },
    {
      titulo: tx("Não é simplesmente o preço da última usina", "It is not simply the price of the last plant"),
      porque:
        tx("O PLD tem como base o CMO e é calculado com os modelos computacionais NEWAVE, DECOMP e DESSEM, segundo a CCEE; o ONS publica o CMO estimado pelo DECOMP e pelo DESSEM. Na descrição usual do setor, ainda não conferida em documento primário nesta fase, esses modelos ponderam usar a água agora ou guardá-la, de modo que o custo marginal incorpora um valor futuro da água, e não apenas o custo da usina mais cara acionada naquela hora.", "The PLD is based on the CMO and is calculated with the NEWAVE, DECOMP and DESSEM computer models, according to the CCEE; the ONS publishes the CMO estimated by DECOMP and by DESSEM. In the usual description of the sector, not yet checked in a primary document in this phase, these models weigh using the water now or saving it, so that the marginal cost incorporates a future value of water, and not only the cost of the most expensive plant called on in that hour."),
      base: tx("CCEE, descrição oficial do PLD; mecanismo do valor da água com conferência documental pendente", "CCEE, official description of the PLD; water value mechanism with documentary check pending"),
      conferencia: "PENDENTE",
    },
    {
      titulo: tx("Não é uma cotação de bolsa formada só por lances", "It is not an exchange quotation formed only by bids"),
      porque:
        tx("Segundo a CCEE, o PLD é calculado por modelos computacionais com base no CMO, dentro de limites mínimo e máximos. A descrição oficial não menciona ofertas de compra e venda.", "According to the CCEE, the PLD is calculated by computer models based on the CMO, within minimum and maximum limits. The official description does not mention buy and sell offers."),
      base: tx("CCEE, descrição oficial do PLD", "CCEE, official description of the PLD"),
      conferencia: "CONFERIDO",
    },
    {
      titulo: tx("Não é uma previsão meteorológica", "It is not a weather forecast"),
      porque:
        tx("O PLD é calculado para cada hora do dia seguinte com base no CMO. Não é uma estimativa de chuva nem de afluência; a ENA publicada pelo ONS é calculada a partir das vazões naturais aos reservatórios.", "The PLD is calculated for each hour of the following day based on the CMO. It is not an estimate of rainfall or inflow; the ENA published by the ONS is calculated from the natural flows into the reservoirs."),
      base: tx("CCEE, descrição oficial do PLD; ONS, ENA Diário por Subsistema", "CCEE, official description of the PLD; ONS, daily ENA by subsystem dataset"),
      conferencia: "CONFERIDO",
    },
  ];
}
export const PLD_NAO_E_IDIOMAS = montarNosDoisIdiomas(montarPldNaoE);
export const PLD_NAO_E: { titulo: string; porque: string; base: string; conferencia: EstadoConferencia }[] = PLD_NAO_E_IDIOMAS.pt;
