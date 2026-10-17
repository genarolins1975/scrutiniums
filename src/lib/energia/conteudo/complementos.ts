/**
 * Complementos dos verbetes do Aprenda (P065): a unidade em que cada grandeza aparece e
 * os pares que o leitor costuma confundir.
 *
 * Regra: nada aqui acrescenta definição. Cada contraste é escrito só com o que os dois
 * verbetes conferidos já dizem (frase, como é medido e limitações) e só liga verbetes
 * CONFERIDOS; verbete em preparação não entra, porque um contraste também define. Quando
 * o termo confundido não é verbete (família, município), ele entra pelo rótulo.
 */
import type { Idioma } from "@/lib/idioma";
import { idiomaEnergia } from "@/lib/energia/idioma";
import { montarNosDoisIdiomas, type TxIdioma } from "@/lib/energia/i18n/aprenda";
import { CONCEITOS, conceito } from "./conceitos";

/** Unidade em que a grandeza é publicada e lida no observatório; ausente quando o verbete não é grandeza. */
function montarUnidade(tx: TxIdioma): Record<string, string> {
  return {
    pld: tx("R$/MWh, por hora e submercado", "R$/MWh, by hour and submarket"),
    mcp: tx("MWh (balanço) e R$ (resultado), por submercado e período de comercialização", "MWh (balance) and R$ (result), by submarket and trading period"),
    cmo: tx("R$/MWh, por subsistema; por patamar de carga na versão semanal", "R$/MWh, by subsystem; by load level in the weekly version"),
    cvu: tx("R$/MWh, por usina e semana operativa", "R$/MWh, by plant and operating week"),
    ear: tx("MWmês (a energia que os reservatórios produziriam em um mês à potência média de 1 MW) ou percentual da EAR máxima", "MW-month (the energy the reservoirs would produce in one month at an average power of 1 MW) or percentage of the maximum EAR"),
    armazenamento: tx("MWmês", "MW-month"),
    ena: tx("energia (MWmês, segundo o dicionário do ONS) ou percentual da MLT", "energy (MW-month, according to the ONS dictionary) or percentage of the MLT"),
    carga: tx("MWmed, por subsistema e dia", "MWavg, by subsystem and day"),
    "geracao-centralizada": tx("MWmed, por hora e subsistema", "MWavg, by hour and subsystem"),
    "geracao-distribuida": tx("kW de potência instalada (ANEEL); MWmed da parcela da carga (ONS)", "kW of installed capacity (ANEEL); MWavg of the load portion (ONS)"),
    intercambio: tx("MWmed, por hora e fronteira", "MWavg, by hour and border"),
    "intercambio-internacional": tx("MWmed, por hora e país; positivo é exportação", "MWavg, by hour and country; positive is export"),
    acl: tx("MW médios (consumo contabilizado pela CCEE) ou MWh (consumo na rede, EPE)", "average MW (consumption accounted by the CCEE) or MWh (consumption on the grid, EPE)"),
    acr: tx("MW médios (consumo contabilizado pela CCEE) ou MWh (consumo cativo na rede, EPE)", "average MW (consumption accounted by the CCEE) or MWh (captive consumption on the grid, EPE)"),
    ess: tx("R$, por mês de competência", "R$, by accrual month"),
    "garantia-fisica": tx("MW médios", "average MW"),
    gsf: tx("percentual, por mês (geração em MWmed dividida pela garantia física em MWmed)", "percentage, by month (generation in MWavg divided by physical guarantee in MWavg)"),
    "constrained-off": tx("GWh de energia não gerada estimada, % da geração possível estimada (taxa) e MW de corte simultâneo", "GWh of estimated energy not generated, % of estimated possible generation (rate) and MW of simultaneous cut"),
    imerg: tx("mm de precipitação por dia", "mm of precipitation per day"),
    "merra-2": tx("°C (temperatura do ar a 2 metros)", "°C (air temperature at 2 meters)"),
    "curva-de-carga": tx("MWmed, por hora e subsistema", "MWavg, by hour and subsystem"),
    "carga-global": tx("MWmed, por meia hora e área de carga", "MWavg, by half hour and load area"),
    "carga-liquida-de-mmgd": tx("MWmed, por meia hora", "MWavg, by half hour"),
    atls: tx("percentual do tempo de observação", "percentage of observation time"),
    "tarifa-te-tusd": tx("R$/MWh no conjunto da ANEEL; dividido por 1000, R$/kWh", "R$/MWh in the ANEEL dataset; divided by 1000, R$/kWh"),
    "bandeira-tarifaria": tx("R$ por kWh consumido (publicado em R$/MWh)", "R$ per kWh consumed (published in R$/MWh)"),
    "custo-de-disponibilidade": tx("kWh equivalentes (30, 50 ou 100) multiplicados pela tarifa, em R$", "equivalent kWh (30, 50 or 100) multiplied by the tariff, in R$"),
    cde: tx("R$ (orçamento anual); R$/MWh nas componentes da tarifa", "R$ (annual budget); R$/MWh in the tariff components"),
    "perdas-de-energia": tx("MWh e percentual da energia injetada", "MWh and percentage of injected energy"),
    "perdas-tecnicas": tx("percentual da energia injetada (estimado por modelo)", "percentage of injected energy (estimated by model)"),
    "perdas-nao-tecnicas": tx("percentual do mercado de baixa tensão medido", "percentage of the measured low-voltage market"),
    "percentual-regulatorio-de-perdas": tx("percentual", "percentage"),
    dec: tx("horas e centésimos de hora por unidade consumidora", "hours and hundredths of an hour per consumer unit"),
    fec: tx("interrupções por unidade consumidora", "interruptions per consumer unit"),
    "compensacao-continuidade": tx("R$ e quantidade de compensações", "R$ and number of compensations"),
    "tarifa-social": tx("unidades consumidoras e faturas, nunca famílias", "consumer units and bills, never families"),
    "fator-de-emissao": "tCO2/MWh",
    "limites-do-pld": tx("R$/MWh, por ano civil", "R$/MWh, by calendar year"),
  };
}
export const UNIDADE_IDIOMAS = montarNosDoisIdiomas(montarUnidade);
export const UNIDADE: Record<string, string> = UNIDADE_IDIOMAS.pt;

export type Contraste = {
  a: string;
  /** Outro verbete (slug) ou um termo que não é verbete, pelo rótulo. */
  b: string | { rotulo: string };
  texto: string;
  /**
   * O mesmo contraste visto do verbete `b`, quando o texto de `a` seria repetido palavra por palavra em dois verbetes vizinhos:
   * no verbete `b` entra esta versão curta, que aponta para `a`.
   */
  textoB?: string;
};

function montarContrastes(tx: TxIdioma): Contraste[] {
  return [
    {
      a: "pld",
      b: "cmo",
      texto:
        tx("O CMO é o custo de atender uma unidade a mais de carga, estimado pelos modelos do ONS por subsistema. O PLD parte do CMO, mas não é o CMO: é calculado pela CCEE por hora e submercado e aplica os limites regulatórios.", "The CMO is the cost of meeting one more unit of load, estimated by the ONS models by subsystem. The PLD starts from the CMO, but it is not the CMO: it is calculated by the CCEE by hour and submarket and applies the regulatory limits."),
    },
    {
      a: "pld",
      b: "tarifa-te-tusd",
      texto:
        tx("O PLD é o preço das diferenças liquidadas no Mercado de Curto Prazo. A conta do consumidor atendido pela distribuidora segue a TE e a TUSD, que a ANEEL homologa nos processos tarifários, mais bandeira e tributos.", "The PLD is the price of the differences settled in the Short-Term Market. The bill of the consumer served by the distribution utility follows the TE and the TUSD, which ANEEL approves in the tariff processes, plus the tariff flag and taxes."),
    },
    {
      a: "limites-do-pld",
      b: "pld",
      texto:
        tx("Os limites são o piso e os dois tetos que a ANEEL fixa a cada ano; o PLD é o preço calculado dentro deles. Os limites são valores nominais, sem correção pela inflação: para comparar anos é preciso corrigir os valores.", "The limits are the floor and the two ceilings that ANEEL sets each year; the PLD is the price calculated within them. The limits are nominal values, without inflation correction: comparing years requires correcting the values."),
    },
    {
      a: "mcp",
      b: "acl",
      texto:
        tx("O ACL é o segmento dos contratos bilaterais livremente negociados; o MCP é onde a CCEE apura, ao PLD, o balanço de cada perfil de agente. O preço de um contrato do ACL é privado e não é o PLD.", "The ACL is the segment of freely negotiated bilateral contracts; the MCP is where the CCEE determines, at the PLD, the balance of each agent profile. The price of an ACL contract is private and is not the PLD."),
    },
    {
      a: "acl",
      b: "acr",
      texto:
        tx("No ACR, agentes vendedores e distribuidoras negociam por licitação; no ACL, os contratos são bilaterais e livremente negociados. Nos painéis, cada ambiente aparece em dois universos (consumo contabilizado pela CCEE e consumo na rede da EPE), que não se misturam.", "In the ACR, selling agents and distribution utilities negotiate through public tenders; in the ACL, contracts are bilateral and freely negotiated. In the panels, each environment appears in two universes (consumption accounted by the CCEE and consumption on the grid from the EPE), which are not mixed."),
    },
    {
      a: "submercado",
      b: "sin",
      texto:
        tx("O SIN é o sistema interligado inteiro; submercado é cada uma das quatro divisões dele com PLD próprio. Um valor do SIN é soma ou razão de somas dos subsistemas, conforme a regra de cada indicador.", "The SIN is the entire interconnected system; a submarket is each of its four divisions with its own PLD. A SIN value is a sum or a ratio of sums of the subsystems, according to the rule of each indicator."),
    },
    {
      a: "ear",
      b: "ena",
      texto:
        tx("A EAR é a energia associada à água já guardada nos reservatórios; a ENA é a energia que as vazões naturais que chegam permitiriam produzir. Uma ENA acima da MLT não diz, sozinha, quanto há guardado.", "EAR is the energy associated with the water already stored in the reservoirs; ENA is the energy that the arriving natural flows would allow to be produced. An ENA above the MLT does not say, by itself, how much is stored."),
    },
    {
      a: "ear",
      b: "armazenamento",
      texto:
        tx("A EAR é quanto está guardado; a EAR máxima é quanto caberia com todos os reservatórios cheios. O percentual da EAR é a razão entre as duas, e o denominador muda quando entram reservatórios.", "EAR is how much is stored; the maximum EAR is how much would fit with all reservoirs full. The EAR percentage is the ratio between the two, and the denominator changes when reservoirs come in."),
    },
    {
      a: "ena",
      b: "mlt",
      texto:
        tx("A ENA é o valor do período; a MLT é a referência com que o ONS a publica em percentual. O conjunto não informa o período de referência da MLT; por isso, nos painéis, \"acima do usual\" vem da distribuição histórica, não da MLT.", "ENA is the value for the period; the MLT is the reference with which the ONS publishes it as a percentage. The dataset does not report the reference period of the MLT; that is why, in the panels, \"above usual\" comes from the historical distribution, not from the MLT."),
    },
    {
      a: "carga",
      b: "geracao-centralizada",
      texto:
        tx("A carga é a energia atendida; a geração centralizada é a energia produzida pelas usinas no balanço do ONS. Em cada subsistema, geração menos carga deveria corresponder ao intercâmbio; o balanço da Rede mostra as horas em que não corresponde.", "Load is the energy served; centralized generation is the energy produced by the plants in the ONS balance. In each subsystem, generation minus load should correspond to the interchange; the Grid balance shows the hours when it does not."),
    },
    {
      a: "carga",
      b: "curva-de-carga",
      texto:
        tx("São o mesmo produto do ONS em grãos diferentes: a média das 24 horas da curva reproduz a carga do dia. A curva mostra o perfil hora a hora; a carga diária, não.", "They are the same ONS product at different granularities: the average of the 24 hours of the curve reproduces the load of the day. The curve shows the hour-by-hour profile; the daily load does not."),
    },
    {
      a: "carga-global",
      b: "carga-liquida-de-mmgd",
      texto:
        tx("A carga global inclui a parcela atendida por micro e minigeração distribuída; a carga líquida de MMGD é a carga global sem essa parcela. Nos dados publicados, a líquida mais a parcela de MMGD dá a global em todas as meias horas conferidas.", "Global load includes the portion served by distributed micro and mini generation; load net of MMGD is global load without that portion. In the published data, net load plus the MMGD portion gives the global load in all half hours checked."),
    },
    {
      a: "carga-global",
      b: "curva-de-carga",
      texto:
        tx("São grandezas diferentes: a carga global, por meia hora e área de carga, fica acima da curva de carga horária nas mesmas horas. Por isso a carga líquida de MMGD não se obtém subtraindo a MMGD da curva.", "They are different quantities: global load, by half hour and load area, is above the hourly load curve in the same hours. That is why load net of MMGD is not obtained by subtracting MMGD from the curve."),
    },
    {
      a: "geracao-distribuida",
      b: "geracao-centralizada",
      texto:
        tx("A MMGD se liga à rede de distribuição pelas instalações de unidades consumidoras e é publicada como potência instalada (ANEEL) e como parcela estimada da carga (ONS); a geração centralizada é verificada hora a hora nas usinas do balanço do ONS. Potência instalada não é energia gerada.", "MMGD connects to the distribution grid through the facilities of consumer units and is published as installed capacity (ANEEL) and as an estimated portion of the load (ONS); centralized generation is verified hour by hour at the plants in the ONS balance. Installed capacity is not generated energy."),
    },
    {
      a: "intercambio",
      b: "intercambio-internacional",
      texto:
        tx("O intercâmbio é o fluxo entre subsistemas do SIN; o internacional é o fluxo entre o SIN e um país vizinho, publicado em outro conjunto. Itaipu entra como geração de uma usina, não como intercâmbio com o Paraguai.", "Interchange is the flow between subsystems of the SIN; international interchange is the flow between the SIN and a neighboring country, published in another dataset. Itaipu enters as the generation of a plant, not as interchange with Paraguay."),
    },
    {
      a: "intercambio",
      b: "atls",
      texto:
        tx("O intercâmbio é o fluxo medido; o ATLS diz em que parte do tempo fluxos selecionados ficaram dentro das faixas de segurança. Nenhum dos dois conjuntos publica o valor do limite.", "Interchange is the measured flow; the ATLS says in what part of the time selected flows stayed within the safety ranges. Neither dataset publishes the value of the limit."),
    },
    {
      a: "decomp",
      b: "dessem",
      texto: tx("Os dois estimam o CMO publicado pelo ONS: o DECOMP por semana operativa, subsistema e patamar de carga; o DESSEM por meia hora e por barra.", "Both estimate the CMO published by the ONS: DECOMP by operating week, subsystem and load level; DESSEM by half hour and by bus."),
    },
    {
      a: "newave",
      b: "decomp",
      texto:
        tx("Os dois são citados pela CCEE no cálculo do PLD. O DECOMP tem saída publicada pelo ONS e usada aqui (o CMO semanal); a descrição técnica do NEWAVE não foi conferida, e o observatório não publica saída dele.", "Both are cited by the CCEE in calculating the PLD. DECOMP has output published by the ONS and used here (the weekly CMO); the technical description of NEWAVE was not checked, and the observatory does not publish its output."),
    },
    {
      a: "cvu",
      b: "cmo",
      texto:
        tx("O CVU é um valor de cada usina térmica, considerado no Programa Mensal da Operação e nos modelos; o CMO é o custo de atender uma unidade a mais de carga, por subsistema. O CVU de uma usina não é o CMO nem o PLD.", "The CVU is a value of each thermal plant, considered in the Monthly Operation Program and in the models; the CMO is the cost of meeting one more unit of load, by subsystem. A plant's CVU is neither the CMO nor the PLD."),
    },
    {
      a: "mre",
      b: "garantia-fisica",
      texto:
        tx("A garantia física é a quantidade máxima de energia de cada empreendimento que pode lastrear contratos; o MRE é o mecanismo pelo qual as hidrelétricas compartilham o risco hidrológico. No observatório, a geração das usinas do MRE dividida pela garantia física modulada e ajustada pelo fator de disponibilidade é o GSF.", "Physical guarantee is the maximum amount of energy of each project that can back contracts; the MRE is the mechanism through which hydropower plants share hydrological risk. In the observatory, the generation of the MRE plants divided by the physical guarantee modulated and adjusted by the availability factor is the GSF."),
      textoB:
        tx("A garantia física é um limite de energia de cada empreendimento; o MRE é o mecanismo pelo qual as hidrelétricas compartilham o risco hidrológico, e não define a garantia física de ninguém (ver MRE).", "Physical guarantee is an energy limit of each project; the MRE is the mechanism through which hydropower plants share hydrological risk, and it does not define anyone's physical guarantee (see MRE)."),
    },
    {
      a: "garantia-fisica",
      b: "geracao-centralizada",
      texto: tx("Garantia física não é geração: a usina pode gerar mais ou menos que ela em cada mês.", "Physical guarantee is not generation: the plant might generate more or less than it each month."),
    },
    {
      a: "gsf",
      b: "garantia-fisica",
      texto:
        tx("A garantia física é a quantidade máxima de energia que um empreendimento pode usar para comprovar atendimento de carga ou vender em contratos; o GSF é a razão entre o que as usinas do MRE geraram no mês e a garantia física delas, no conjunto. Um GSF de 80,51% (dezembro de 2020, no boletim do MME, com a garantia física sazonalizada) não diz que a garantia física caiu: diz que a geração do mês ficou abaixo dela. Um GSF acima de 100% diz que ficou acima.", "Physical guarantee is the maximum amount of energy a project can use to prove load coverage or to sell in contracts; the GSF is the ratio between what the MRE plants generated in the month and their physical guarantee, as a whole. A GSF of 80.51% (December 2020, in the MME bulletin, with the seasonalized physical guarantee) does not say that the physical guarantee fell: it says that the generation of the month was below it. A GSF above 100% says it was above."),
      textoB:
        tx("O GSF compara, mês a mês, a geração das usinas do MRE com a garantia física delas. Um GSF abaixo de 100% diz que a geração ficou abaixo da garantia física, não que a garantia física caiu (ver GSF).", "The GSF compares, month by month, the generation of the MRE plants with their physical guarantee. A GSF below 100% says that generation was below the physical guarantee, not that the physical guarantee fell (see GSF)."),
    },
    {
      a: "mre",
      b: "gsf",
      texto:
        tx("O MRE é o mecanismo de compartilhamento do risco hidrológico; o GSF, também chamado de fator de ajuste do MRE, é o número mensal que compara a geração das usinas com a garantia física. Falar em MRE é falar do mecanismo, falar em GSF é falar da razão do mês.", "The MRE is the mechanism for sharing hydrological risk; the GSF, also called the MRE adjustment factor, is the monthly number that compares the generation of the plants with the physical guarantee. Talking about the MRE is talking about the mechanism; talking about the GSF is talking about the ratio of the month."),
      textoB:
        tx("O GSF não é o mecanismo: é o número mensal que compara a geração das usinas do MRE com a garantia física delas. O mecanismo está no verbete MRE.", "The GSF is not the mechanism: it is the monthly number that compares the generation of the MRE plants with their physical guarantee. The mechanism is in the MRE entry."),
    },
    {
      a: "ree",
      b: "ear",
      texto:
        tx("A EAR é a energia associada à água armazenada; o REE é um dos recortes em que o ONS a publica, ao lado do subsistema, da bacia e do reservatório. Cada recorte tem o próprio perímetro e a própria EAR máxima.", "EAR is the energy associated with stored water; the REE is one of the cuts in which the ONS publishes it, alongside the subsystem, the basin and the reservoir. Each cut has its own perimeter and its own maximum EAR."),
      textoB:
        tx("O REE é um dos recortes em que o ONS publica a EAR, ao lado do subsistema, da bacia e do reservatório; cada recorte tem o próprio perímetro e a própria EAR máxima.", "The REE is one of the cuts in which the ONS publishes the EAR, alongside the subsystem, the basin and the reservoir; each cut has its own perimeter and its own maximum EAR."),
    },
    {
      a: "ree",
      b: { rotulo: tx("subsistema", "subsystem") },
      texto:
        tx("A topologia descrita pela EPE tem 4 subsistemas interligados e 12 REE: são recortes diferentes, e o REE agrega as usinas hidrelétricas de acordo com a bacia hidrográfica.", "The topology described by the EPE has 4 interconnected subsystems and 12 REE: they are different cuts, and the REE aggregates hydropower plants according to the river basin."),
    },
    {
      a: "constrained-off",
      b: "geracao-centralizada",
      texto:
        tx("A geração verificada é o que as usinas entregaram no balanço do ONS; o constrained-off é a energia que a usina deixou de gerar por comando do ONS, estimada contra uma geração de referência, só nas meias horas em que a usina foi limitada. É energia que a geração verificada não contém.", "Verified generation is what the plants delivered in the ONS balance; constrained-off is the energy the plant did not generate by order of the ONS, estimated against a reference generation, only in the half hours in which the plant was limited. It is energy that verified generation does not contain."),
    },
    {
      a: "constrained-off",
      b: { rotulo: tx("falta de vento", "lack of wind") },
      texto:
        tx("Pela definição da REN, o evento decorre de comando do ONS e se origina fora das instalações da usina. Um dia sem vento reduz a geração sem comando do ONS e, portanto, não é constrained-off.", "By the REN definition, the event results from an ONS order and originates outside the plant's facilities. A day without wind reduces generation without an ONS order and, therefore, is not constrained-off."),
    },
    {
      a: "imerg",
      b: "merra-2",
      texto: tx("O IMERG estima chuva com satélites; a MERRA-2 é uma reanálise de modelo, usada aqui para a temperatura. Nenhum dos dois é medição de estação.", "IMERG estimates rainfall with satellites; MERRA-2 is a model reanalysis, used here for temperature. Neither is a station measurement."),
    },
    {
      a: "tarifa-te-tusd",
      b: "bandeira-tarifaria",
      texto:
        tx("A TE e a TUSD são homologadas para cada distribuidora nos processos tarifários; a bandeira é um acréscimo por kWh consumido, conforme o patamar acionado no mês, e não se aplica aos sistemas isolados.", "The TE and the TUSD are approved for each distribution utility in the tariff processes; the tariff flag is a surcharge per kWh consumed, according to the level triggered in the month, and does not apply to isolated systems."),
    },
    {
      a: "custo-de-disponibilidade",
      b: "tarifa-te-tusd",
      texto: tx("O custo de disponibilidade não é outra tarifa: é uma quantidade mínima em kWh equivalentes (30, 50 ou 100, conforme a ligação) multiplicada pela TE e pela TUSD da classe.", "The availability cost is not another tariff: it is a minimum quantity in equivalent kWh (30, 50 or 100, depending on the connection) multiplied by the TE and the TUSD of the class."),
    },
    {
      a: "cde",
      b: "tarifa-social",
      texto:
        tx("A Tarifa Social é a política de desconto na fatura; a CDE é o fundo setorial que a custeia, arrecadado principalmente por quotas incluídas nas tarifas de uso da rede.", "The Tarifa Social is the policy of discount on the bill; the CDE is the sector fund that pays for it, collected mainly through quotas included in the grid use tariffs."),
    },
    {
      a: "ess",
      b: "cde",
      texto:
        tx("O ESS é um encargo das regras de comercialização para os custos dos serviços do sistema; a CDE é um fundo setorial com orçamento anual aprovado pela ANEEL para políticas públicas. São bases diferentes, e o observatório não as soma.", "The ESS is a charge of the trading rules for the costs of system services; the CDE is a sector fund with an annual budget approved by ANEEL for public policies. They are different bases, and the observatory does not add them up."),
    },
    {
      a: "ess",
      b: "pld",
      texto: tx("O ESS é encargo, em reais por mês de competência; o PLD é preço, em R$/MWh por hora. Valor de competência do ESS não é valor pago no mês.", "The ESS is a charge, in reais by accrual month; the PLD is a price, in R$/MWh by hour. An ESS accrual value is not an amount paid in the month."),
    },
    {
      a: "perdas-tecnicas",
      b: "perdas-nao-tecnicas",
      texto:
        tx("As técnicas vêm da física do transporte (aquecimento dos condutores, núcleos dos transformadores) e são estimadas por modelo; as não técnicas são a diferença entre as totais e as técnicas e incluem furto, fraude e erros de medição e de faturamento.", "Technical losses come from the physics of transport (heating of conductors, transformer cores) and are estimated by model; non-technical losses are the difference between total and technical losses and include theft, fraud and metering and billing errors."),
    },
    {
      a: "perdas-de-energia",
      b: "percentual-regulatorio-de-perdas",
      texto:
        tx("As perdas de energia são o realizado, calculado pela ANEEL no SAMP; o percentual regulatório é o nível que a ANEEL reconhece na tarifa de cada concessionária. Parâmetro regulatório não é perda realizada.", "Energy losses are the actual figure, calculated by ANEEL in SAMP; the regulatory percentage is the level ANEEL recognizes in the tariff of each concession holder. A regulatory parameter is not an actual loss."),
    },
    {
      a: "dec",
      b: "fec",
      texto: tx("O DEC mede duração, em horas; o FEC mede frequência, em número de interrupções. Os dois são médias por unidade consumidora do conjunto.", "DEC measures duration, in hours; FEC measures frequency, in number of interruptions. Both are averages per consumer unit of the group."),
    },
    {
      a: "compensacao-continuidade",
      b: "dec",
      texto:
        tx("A compensação depende dos indicadores individuais de cada unidade (DIC, FIC e outros), que não são publicados; não se calcula a partir do DEC do conjunto.", "Compensation depends on the individual indicators of each unit (DIC, FIC and others), which are not published; it is not calculated from the DEC of the group."),
    },
    {
      a: "conjunto-eletrico",
      b: { rotulo: tx("município", "municipality") },
      texto:
        tx("O conjunto é uma subdivisão da área da distribuidora, em geral formada por uma ou mais subestações de distribuição. Num mapa municipal de DEC por atribuição de conjunto, o valor é o do conjunto inteiro, não uma medição no município.", "The group is a subdivision of the distribution utility's area, generally formed by one or more distribution substations. In a municipal DEC map built by assigning groups, the value is that of the whole group, not a measurement in the municipality."),
    },
    {
      a: "tarifa-social",
      b: { rotulo: tx("família", "family") },
      texto: tx("O alcance é contado em unidades consumidoras e faturas, nunca em famílias: uma família pode não ser titular da conta da casa em que mora.", "Reach is counted in consumer units and bills, never in families: a family might not hold the account of the house it lives in."),
    },
    {
      a: "fator-de-emissao",
      b: { rotulo: tx("fator marginal", "marginal factor") },
      texto:
        tx("O fator médio considera todas as usinas que estão gerando; a margem de operação, que o MCTI publica para o MDL, considera a energia despachada na margem. O fator médio não mede o efeito de consumir ou economizar um MWh a mais.", "The average factor considers all plants that are generating; the operating margin, which the MCTI publishes for the MDL, considers the energy dispatched at the margin. The average factor does not measure the effect of consuming or saving one more MWh."),
    },
    {
      a: "agenda-regulatoria",
      b: { rotulo: tx("norma publicada", "published norm") },
      texto: tx("A agenda lista atividades com previsão de edição de norma no biênio. Estar na agenda não é ter norma editada.", "The agenda lists activities expected to result in a norm in the two-year period. Being on the agenda is not having a norm issued."),
    },
    {
      a: "ons",
      b: "ccee",
      texto:
        tx("O ONS coordena e controla a operação da geração e da transmissão do SIN; a CCEE tem a finalidade de viabilizar a comercialização de energia elétrica. Operar o sistema não é comercializar a energia, e as duas entidades mantêm acordo operacional entre si.", "The ONS coordinates and controls the operation of SIN generation and transmission; the CCEE has the purpose of enabling the trading of electricity. Operating the system is not trading the energy, and the two entities maintain an operating agreement with each other."),
    },
    {
      a: "aneel",
      b: "ons",
      texto:
        tx("A ANEEL regula e fiscaliza o setor elétrico; o ONS opera o sistema interligado e é fiscalizado e regulado por ela. O ONS propõe as regras de operação da transmissão, e quem as aprova é a ANEEL.", "ANEEL regulates and oversees the power sector; the ONS operates the interconnected system and is overseen and regulated by it. The ONS proposes the transmission operation rules, and ANEEL is the one that approves them."),
    },
    {
      a: "aneel",
      b: "ccee",
      texto:
        tx("A ANEEL regula e fiscaliza, e aprova as regras e os procedimentos de comercialização de energia elétrica; a CCEE, que atua sob regulação e fiscalização da ANEEL, tem a finalidade de viabilizar a comercialização. São entidades diferentes: quem aprova as regras não é quem viabiliza a comercialização.", "ANEEL regulates and oversees, and approves the rules and procedures for trading electricity; the CCEE, which acts under ANEEL regulation and oversight, has the purpose of enabling trading. They are different entities: the one that approves the rules is not the one that enables trading."),
    },
    {
      a: "epe",
      b: "ons",
      texto:
        tx("A EPE presta serviços de estudos e pesquisas que subsidiam o planejamento do setor energético, entre eles os planos de expansão da geração e da transmissão; o ONS coordena e controla a operação do sistema interligado e planeja essa operação. Planejar a expansão do setor e planejar a operação do sistema são tarefas diferentes.", "The EPE provides studies and research services that support energy sector planning, among them the expansion plans for generation and transmission; the ONS coordinates and controls the operation of the interconnected system and plans that operation. Planning the expansion of the sector and planning the operation of the system are different tasks."),
    },
    {
      a: "sin",
      b: "sistemas-isolados",
      texto:
        tx("O SIN é, segundo o ONS, o conjunto de quatro subsistemas: Sul, Sudeste/Centro-Oeste, Nordeste e a maior parte da região Norte. Os Sistemas Isolados são sistemas de distribuição que, em sua configuração normal, não estão conectados ao SIN. Um valor do SIN não descreve as localidades atendidas por Sistemas Isolados.", "According to the ONS, the SIN is the group of four subsystems: South, Southeast/Center-West, Northeast and most of the North region. Isolated Systems are distribution systems that, in their normal configuration, are not connected to the SIN. A SIN value does not describe the localities served by Isolated Systems."),
    },
    {
      a: "ibge",
      b: "aneel",
      texto:
        tx("O IBGE produz informações estatísticas, geográficas, cartográficas e demográficas do País; quem regula e fiscaliza a energia elétrica é a ANEEL. Um número do IBGE, como o da POF ou o da PNAD Contínua, descreve famílias e domicílios, não o setor elétrico.", "The IBGE produces statistical, geographical, cartographic and demographic information about the country; the one that regulates and oversees electricity is ANEEL. An IBGE figure, such as that of the POF or the Continuous PNAD, describes families and households, not the power sector."),
    },
  ];
}
export const CONTRASTES_IDIOMAS = montarNosDoisIdiomas(montarContrastes);
export const CONTRASTES: Contraste[] = CONTRASTES_IDIOMAS.pt;

/**
 * Exemplo sintético do verbete quando nenhum painel publica o número correspondente: conta
 * com valores hipotéticos, exibida com o rótulo permanente de exemplo sintético.
 */
function montarExemploSintetico(tx: TxIdioma): Record<string, string> {
  return {
    "custo-de-disponibilidade":
      tx("Uma unidade residencial monofásica com microgeração injetou na rede, num mês, mais energia do que consumiu. Mesmo assim, deve o custo de disponibilidade: 30 kWh multiplicados pela tarifa da classe. Com uma tarifa hipotética de R$ 0,80/kWh (TE mais TUSD, sem tributos), seriam R$ 24,00 no mês.", "A single-phase residential unit with microgeneration injected more energy into the grid in a month than it consumed. Even so, it owes the availability cost: 30 kWh multiplied by the tariff of the class. With a hypothetical tariff of R$ 0.80/kWh (TE plus TUSD, without taxes), that would be R$ 24.00 for the month."),
  };
}
export const EXEMPLO_SINTETICO_IDIOMAS = montarNosDoisIdiomas(montarExemploSintetico);
export const EXEMPLO_SINTETICO: Record<string, string> = EXEMPLO_SINTETICO_IDIOMAS.pt;

export type ContrasteDoVerbete = { com: string; rotulo: string; href: string | null; texto: string };

/** Contrastes em que o verbete aparece, de qualquer lado do par. */
export function contrastesDe(slug: string, idioma: Idioma = idiomaEnergia()): ContrasteDoVerbete[] {
  const out: ContrasteDoVerbete[] = [];
  for (const c of CONTRASTES_IDIOMAS[idioma]) {
    const outro = c.a === slug ? c.b : c.b === slug ? c.a : null;
    if (outro === null) continue;
    if (typeof outro === "string") {
      const v = conceito(outro, idioma);
      if (!v) continue;
      // sigla igual ao nome (DECOMP, NEWAVE) não se repete entre parênteses
      out.push({ com: outro, rotulo: v.sigla && v.sigla.toLowerCase() !== v.nome.toLowerCase() ? `${v.sigla} (${v.nome})` : v.nome, href: `/setor-eletrico/aprenda/${outro}`, texto: c.b === slug && c.textoB ? c.textoB : c.texto });
    } else {
      out.push({ com: outro.rotulo, rotulo: outro.rotulo, href: null, texto: c.texto });
    }
  }
  return out;
}

/** Verbetes conferidos sem nenhum contraste (deve ser vazio; conferido em teste). */
export function conferidosSemContraste(): string[] {
  return CONCEITOS.filter((c) => c.estado === "CONFERIDO" && contrastesDe(c.slug, "pt").length === 0).map((c) => c.slug);
}
