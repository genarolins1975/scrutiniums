/**
 * Exemplo com evidência de cada verbete (P065, "exemplos ligados aos gráficos"): o mesmo
 * número que um painel mostra, lido da gold no build, com a ficha de prova completa e o
 * endereço do painel onde ele aparece. Nada é recalculado aqui: o valor é o
 * `valor_exibido` da evidência publicada pelo módulo, e a natureza é a mesma que o painel
 * declara para esse número.
 *
 * O caminho é uma lista de chaves, não uma string com pontos: algumas golds usam chaves
 * com ponto ("atls_12m.FNESE"). Fichas que o módulo publica fora da gold (a série de
 * evidências do PLD) são lidas do mesmo jeito.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Evidencia } from "../evidencia";
import { dataBR, dataCurta, mesAno, num, pct, plural } from "../formato";
import { idiomaEnergia, tx } from "../idioma";
import type { Natureza } from "../tipos";
import { montarNosDoisIdiomas, type TxIdioma } from "@/lib/energia/i18n/aprenda";

export type FonteExemplo = {
  /** Arquivo publicado, relativo a public/energia (gold ou série de evidências). */
  arquivo: string;
  caminho: string[];
  natureza: Natureza;
  /** Painel onde o número aparece, com âncora. */
  painel: { rotulo: string; href: string };
  /** Como o número ilustra o conceito, sem repetir o número (ele vem da evidência). */
  leitura: string;
};

function montarExemploEvidencia(tx: TxIdioma): Record<string, FonteExemplo> {
  return {
    acl: {
      arquivo: "gold/mercado.json",
      caminho: ["livre_regulado", "kpis", "participacao_acl_ccee_12m", "evidencia"],
      natureza: "CALCULADO",
      painel: { rotulo: tx("Mercado: livre e regulado", "Market: free and regulated"), href: "/setor-eletrico/mercado#livre-regulado" },
      leitura: tx("Parcela do consumo contabilizado pela CCEE que está nas classes de agente do ACL, como razão de somas em energia nos 12 meses.", "Share of the consumption accounted by the CCEE that is in the ACL agent classes, as a ratio of sums in energy over the 12 months."),
    },
    gsf: {
      arquivo: "gold/mercado.json",
      caminho: ["mre_gsf", "kpis", "gsf_ultimo_mes", "evidencia"],
      natureza: "CALCULADO",
      painel: { rotulo: tx("Mercado: MRE e GSF", "Market: MRE and GSF"), href: "/setor-eletrico/mercado/mre-e-gsf#mre-gsf" },
      leitura: tx("O GSF do último mês publicado: geração das usinas do MRE dividida pela garantia física modulada e ajustada pelo fator de disponibilidade, nos conjuntos abertos da CCEE.", "The GSF of the last published month: generation of the MRE plants divided by the physical guarantee modulated and adjusted by the availability factor, in the CCEE open datasets."),
    },
    "constrained-off": {
      arquivo: "gold/geracao_detalhe.json",
      caminho: ["evidencias", "restricao_eolica_12m_energia"],
      natureza: "ESTIMADO",
      painel: { rotulo: tx("Geração: renováveis restringidas", "Generation: curtailed renewables"), href: "/setor-eletrico/geracao/restricoes#p023" },
      leitura: tx("Energia que as usinas eólicas deixaram de gerar por limitação do ONS nos 12 meses completos, estimada como a geração de referência menos a verificada.", "Energy that wind plants did not generate due to ONS limitation over the 12 complete months, estimated as reference generation minus verified generation."),
    },
    ess: {
      arquivo: "gold/mercado.json",
      caminho: ["encargos", "kpis", "ess_12m", "evidencia"],
      natureza: "CALCULADO",
      painel: { rotulo: tx("Mercado: encargos e liquidação", "Market: charges and settlement"), href: "/setor-eletrico/mercado/encargos#encargos" },
      leitura: tx("Soma, por mês de competência, dos tipos de encargo de serviços do sistema publicados pela CCEE nos 12 meses.", "Sum, by accrual month, of the system service charge types published by the CCEE over the 12 months."),
    },
    imerg: {
      arquivo: "gold/agua_detalhe.json",
      caminho: ["evidencias", "precipitacao_maior_bacia_30d"],
      natureza: "ESTIMADO",
      painel: { rotulo: tx("Água e clima: chuva e temperatura", "Water and climate: rainfall and temperature"), href: "/setor-eletrico/agua-e-clima/chuva-e-temperatura#p019" },
      leitura: tx("Chuva acumulada em 30 dias na bacia de maior EAR máxima, estimada pelo IMERG.", "Rainfall accumulated over 30 days in the basin with the largest maximum EAR, estimated by IMERG."),
    },
    "merra-2": {
      arquivo: "gold/agua_detalhe.json",
      caminho: ["evidencias", "temperatura_sin_30d"],
      natureza: "ESTIMADO",
      painel: { rotulo: tx("Água e clima: chuva e temperatura", "Water and climate: rainfall and temperature"), href: "/setor-eletrico/agua-e-clima/chuva-e-temperatura#p019" },
      leitura: tx("Anomalia de temperatura do SIN em 30 dias diante da mesma janela de 2001 a 2025, com as células da reanálise e as UF ponderadas pela população.", "SIN temperature anomaly over 30 days compared with the same window from 2001 to 2025, with the reanalysis cells and the states weighted by population."),
    },
    "curva-de-carga": {
      arquivo: "gold/carga_detalhe.json",
      caminho: ["evidencias", "p026_pico_sin"],
      natureza: "OBSERVADO",
      painel: { rotulo: tx("Carga: perfil horário", "Load: hourly profile"), href: "/setor-eletrico/carga/perfil-horario#p026" },
      leitura: tx("A hora de maior carga do SIN no dia, lida da curva de carga horária.", "The hour of highest SIN load in the day, read from the hourly load curve."),
    },
    "carga-global": {
      arquivo: "gold/carga_detalhe.json",
      caminho: ["evidencias", "p026_mmgd_mes"],
      natureza: "ESTIMADO",
      painel: { rotulo: tx("Carga: perfil horário", "Load: hourly profile"), href: "/setor-eletrico/carga/perfil-horario#p026" },
      leitura: tx("Quanto da carga global do SIN foi atendido por micro e minigeração distribuída no último mês completo, segundo a estimativa do ONS.", "How much of the SIN global load was served by distributed micro and mini generation in the last complete month, according to the ONS estimate."),
    },
    "carga-liquida-de-mmgd": {
      arquivo: "gold/carga_detalhe.json",
      caminho: ["evidencias", "p026_mmgd_mes"],
      natureza: "ESTIMADO",
      painel: { rotulo: tx("Carga: perfil horário", "Load: hourly profile"), href: "/setor-eletrico/carga/perfil-horario#p026" },
      leitura: tx("A parcela da carga global atendida por MMGD: é ela que separa a carga global da carga líquida de MMGD.", "The portion of global load served by MMGD: it is what separates global load from load net of MMGD."),
    },
    "intercambio-internacional": {
      arquivo: "gold/rede_detalhe.json",
      caminho: ["evidencias", "exterior_12m"],
      natureza: "CALCULADO",
      painel: { rotulo: tx("Rede: balanço e exterior", "Grid: balance and abroad"), href: "/setor-eletrico/rede/balanco-e-exterior#p029" },
      leitura: tx("Saldo do intercâmbio do SIN com a Argentina e o Uruguai em 12 meses; positivo é exportação.", "Net interchange of the SIN with Argentina and Uruguay over 12 months; positive is export."),
    },
    atls: {
      arquivo: "gold/rede_detalhe.json",
      caminho: ["evidencias", "atls_12m.FNESE"],
      natureza: "CALCULADO",
      painel: { rotulo: tx("Rede: restrições", "Grid: restrictions"), href: "/setor-eletrico/rede/restricoes#p030" },
      leitura: tx("Horas acima do limite em 12 meses num fluxo selecionado pelo ONS, pela soma das horas de violação que o ONS publica: é o tempo que o ATLS desconta do período observado.", "Hours above the limit over 12 months in a flow selected by the ONS, as the sum of the violation hours the ONS publishes: it is the time the ATLS deducts from the observed period."),
    },
    "tarifa-te-tusd": {
      arquivo: "gold/conta.json",
      caminho: ["tarifas", "evidencia_mediana"],
      natureza: "CALCULADO",
      painel: { rotulo: tx("Conta de luz: tarifa", "Electricity bill: tariff"), href: "/setor-eletrico/conta-de-luz#tarifa" },
      leitura: tx("Tarifa residencial (no conjunto da ANEEL: subgrupo B1, modalidade convencional): a mediana, entre as distribuidoras com tarifa vigente na data, da soma de TE e TUSD, sem tributos.", "Residential tariff (in the ANEEL dataset: subgroup B1, conventional modality): the median, among distribution utilities with a tariff in force on the date, of the sum of TE and TUSD, without taxes."),
    },
    "bandeira-tarifaria": {
      arquivo: "gold/conta.json",
      caminho: ["bandeiras", "evidencia"],
      natureza: "OBSERVADO",
      painel: { rotulo: tx("Conta de luz: bandeiras", "Electricity bill: tariff flags"), href: "/setor-eletrico/conta-de-luz/reajustes-e-subsidios#bandeiras" },
      leitura: tx("A cor acionada no mês e o acréscimo por kWh que ela representa.", "The color triggered in the month and the surcharge per kWh it represents."),
    },
    cde: {
      arquivo: "gold/conta.json",
      caminho: ["financiamento_cde", "evidencia"],
      natureza: "CALCULADO",
      painel: { rotulo: tx("Conta de luz: subsídios", "Electricity bill: subsidies"), href: "/setor-eletrico/conta-de-luz/reajustes-e-subsidios#subsidios" },
      leitura: tx("Parcela das receitas do orçamento aprovado da CDE de {ano} que vem das quotas pagas nas tarifas.", "Share of the revenues of the approved CDE budget for {ano} that comes from the quotas paid in the tariffs."),
    },
    "perdas-de-energia": {
      arquivo: "gold/perdas.json",
      caminho: ["evidencias", "perdas_nacional"],
      natureza: "OBSERVADO",
      painel: { rotulo: tx("Perdas: mapa das distribuidoras", "Losses: map of distribution utilities"), href: "/setor-eletrico/perdas#painel-mapa" },
      leitura: tx("Perdas totais de energia das concessionárias de distribuição no último ano completo, como a ANEEL as calcula no SAMP.", "Total energy losses of distribution concession holders in the last complete year, as ANEEL calculates them in SAMP."),
    },
    "perdas-nao-tecnicas": {
      arquivo: "gold/perdas.json",
      caminho: ["evidencias", "pnt_bt_nacional"],
      natureza: "ESTIMADO",
      painel: { rotulo: tx("Perdas: composição", "Losses: composition"), href: "/setor-eletrico/perdas/composicao#composicao" },
      leitura: tx("Perdas não técnicas sobre o mercado de baixa tensão medido, nas concessionárias que separam a parcela técnica.", "Non-technical losses over the measured low-voltage market, at the concession holders that separate the technical portion."),
    },
    dec: {
      arquivo: "gold/qualidade.json",
      caminho: ["evidencias", "dec_brasil"],
      natureza: "CALCULADO",
      painel: { rotulo: tx("Qualidade: duração e frequência", "Quality of supply: duration and frequency"), href: "/setor-eletrico/qualidade#p051" },
      leitura: tx("DEC do Brasil no ano: média mensal dos conjuntos ponderada pelas unidades consumidoras, somada nos 12 meses.", "DEC of Brazil in the year: monthly average of the sets weighted by consumer units, summed over the 12 months."),
    },
    fec: {
      arquivo: "gold/qualidade.json",
      caminho: ["evidencias", "fec_brasil"],
      natureza: "CALCULADO",
      painel: { rotulo: tx("Qualidade: duração e frequência", "Quality of supply: duration and frequency"), href: "/setor-eletrico/qualidade#p051" },
      leitura: tx("FEC do Brasil no ano, com a mesma ponderação do DEC.", "FEC of Brazil in the year, with the same weighting as the DEC."),
    },
    "conjunto-eletrico": {
      arquivo: "gold/qualidade.json",
      caminho: ["evidencias", "conjuntos_acima_limite"],
      natureza: "CALCULADO",
      painel: { rotulo: tx("Qualidade: conjuntos e limites", "Quality of supply: sets and limits"), href: "/setor-eletrico/qualidade#p052" },
      leitura: tx("Parcela dos conjuntos com 12 meses apurados cujo DEC anual passou do limite fixado para o próprio conjunto.", "Share of the sets with 12 months determined whose annual DEC exceeded the limit set for the set itself."),
    },
    "compensacao-continuidade": {
      arquivo: "gold/qualidade.json",
      caminho: ["evidencias", "compensacoes_ano"],
      natureza: "CALCULADO",
      painel: { rotulo: tx("Qualidade: compensações", "Quality of supply: compensations"), href: "/setor-eletrico/qualidade#p053" },
      leitura: tx("Valor das compensações pagas no ano por violação dos limites individuais de continuidade, pela competência.", "Value of the compensations paid in the year for violation of the individual continuity limits, by accrual period."),
    },
    "tarifa-social": {
      arquivo: "gold/inclusao.json",
      caminho: ["tarifa_social", "kpis", "uc_tsee", "evidencia"],
      natureza: "OBSERVADO",
      painel: { rotulo: tx("Inclusão: Tarifa Social", "Inclusion: Tarifa Social"), href: "/setor-eletrico/inclusao-energetica/tarifa-social#p059" },
      leitura: tx("Unidades consumidoras com o desconto, no último mês publicado pela ANEEL; não é número de famílias.", "Consumer units with the discount, in the last month published by ANEEL; it is not a number of families."),
    },
    "fator-de-emissao": {
      arquivo: "gold/transicao.json",
      caminho: ["emissoes", "evidencia"],
      natureza: "ESTIMADO",
      painel: { rotulo: tx("Transição: emissões", "Transition: emissions"), href: "/setor-eletrico/transicao/emissoes#p064" },
      leitura: tx("Fator médio anual de emissão de CO2 do SIN, como o MCTI publica.", "Annual average CO2 emission factor of the SIN, as the MCTI publishes it."),
    },
    "limites-do-pld": {
      arquivo: "gold/regulacao.json",
      caminho: ["evidencias", "limites", "pld_max_horario"],
      natureza: "OBSERVADO",
      painel: { rotulo: tx("Regulação: limites do PLD", "Regulation: PLD limits"), href: "/setor-eletrico/regulacao#p044" },
      leitura: tx("O teto horário vigente, como escrito no ato da ANEEL.", "The hourly ceiling in force, as written in the ANEEL act."),
    },
    pld: {
      arquivo: "series/pld_evidencias.json",
      caminho: ["evidencias", "pld_semana_SE"],
      natureza: "CALCULADO",
      painel: { rotulo: tx("PLD: CMO e formação do preço", "PLD: CMO and price formation"), href: "/setor-eletrico/pld/cmo-e-formacao#p009" },
      leitura: tx("Média, nas horas da semana operativa, do PLD do Sudeste/Centro-Oeste: o preço que a CCEE calcula para cada hora a partir do CMO, aplicando o piso e os tetos. O CMO do DESSEM da mesma semana está no verbete DESSEM.", "Average, over the hours of the operating week, of the Southeast/Center-West PLD: the price the CCEE calculates for each hour from the CMO, applying the floor and the ceilings. The DESSEM CMO of the same week is in the DESSEM entry."),
    },
    ear: {
      arquivo: "gold/agua_detalhe.json",
      caminho: ["evidencias", "ear_sin"],
      natureza: "CALCULADO",
      painel: { rotulo: tx("Água e clima: reservatórios", "Water and climate: reservoirs"), href: "/setor-eletrico/agua-e-clima#p017" },
      leitura: tx("Quanto da capacidade de armazenamento dos reservatórios do SIN estava ocupada no último dia publicado: soma das EAR dos subsistemas dividida pela soma das EAR máximas.", "How much of the storage capacity of the SIN reservoirs was occupied on the last published day: sum of the EAR of the subsystems divided by the sum of the maximum EAR."),
    },
    armazenamento: {
      arquivo: "gold/agua_detalhe.json",
      caminho: ["evidencias", "ear_sin"],
      natureza: "CALCULADO",
      painel: { rotulo: tx("Água e clima: reservatórios", "Water and climate: reservoirs"), href: "/setor-eletrico/agua-e-clima#p017" },
      leitura: tx("A EAR do SIN em relação à EAR máxima, a capacidade de armazenamento com todos os reservatórios cheios.", "The EAR of the SIN relative to the maximum EAR, the storage capacity with all reservoirs full."),
    },
    dessem: {
      arquivo: "series/pld_evidencias.json",
      caminho: ["evidencias", "dessem_semana_SE"],
      natureza: "CALCULADO",
      painel: { rotulo: tx("PLD: CMO e formação do preço", "PLD: CMO and price formation"), href: "/setor-eletrico/pld/cmo-e-formacao#p009" },
      leitura: tx("Média, nas meias horas da semana operativa, do CMO que o DESSEM estima para o Sudeste/Centro-Oeste, lado a lado com o PLD da mesma semana no painel.", "Average, over the half hours of the operating week, of the CMO that DESSEM estimates for the Southeast/Center-West, side by side with the PLD of the same week in the panel."),
    },
    "geracao-distribuida": {
      arquivo: "gold/transicao.json",
      caminho: ["mmgd", "evidencias", "potencia"],
      natureza: "OBSERVADO",
      painel: { rotulo: tx("Transição: micro e minigeração", "Transition: micro and mini generation"), href: "/setor-eletrico/transicao/mmgd#p063" },
      leitura: tx("Potência instalada da MMGD no cadastro da ANEEL: capacidade, não energia gerada.", "Installed capacity of MMGD in the ANEEL register: capacity, not generated energy."),
    },
    // instituições e escopo do sistema (conceitos-instituicoes.ts): o exemplo é um número que a instituição produz ou publica e o painel mostra
    ons: {
      arquivo: "gold/carga_detalhe.json",
      caminho: ["evidencias", "p026_pico_sin"],
      natureza: "OBSERVADO",
      painel: { rotulo: tx("Carga: perfil horário", "Load: hourly profile"), href: "/setor-eletrico/carga/perfil-horario#p026" },
      leitura: tx("Um dado de operação que o ONS mede e publica: a hora de maior carga do SIN no dia, lida da curva de carga horária.", "An operating figure that the ONS measures and publishes: the hour of highest SIN load in the day, read from the hourly load curve."),
    },
    ccee: {
      arquivo: "series/pld_evidencias.json",
      caminho: ["evidencias", "pld_semana_SE"],
      natureza: "CALCULADO",
      painel: { rotulo: tx("PLD: CMO e formação do preço", "PLD: CMO and price formation"), href: "/setor-eletrico/pld/cmo-e-formacao#p009" },
      leitura: tx("Um preço que a CCEE calcula para cada hora; aqui, a média do PLD do Sudeste/Centro-Oeste nas horas da semana operativa.", "A price that the CCEE calculates for each hour; here, the average Southeast/Center-West PLD over the hours of the operating week."),
    },
    aneel: {
      arquivo: "gold/regulacao.json",
      caminho: ["evidencias", "limites", "pld_max_horario"],
      natureza: "OBSERVADO",
      painel: { rotulo: tx("Regulação: limites do PLD", "Regulation: PLD limits"), href: "/setor-eletrico/regulacao#p044" },
      leitura: tx("Um ato da ANEEL lido no painel de Regulação: o teto horário do PLD vigente no ano, como escrito no ato.", "An ANEEL act read in the Regulation panel: the hourly PLD ceiling in force in the year, as written in the act."),
    },
    epe: {
      arquivo: "gold/expansao.json",
      caminho: ["evidencias", "pde_capacidade_2035"],
      natureza: "CENARIO",
      painel: { rotulo: tx("Expansão: cenários", "Expansion: scenarios"), href: "/setor-eletrico/expansao/cenarios#p043" },
      leitura: tx("Um número do planejamento que a EPE publica: a capacidade instalada nacional em 2035 no Cenário de Referência do Plano Decenal de Expansão de Energia. É cenário, não previsão.", "A planning figure that the EPE publishes: national installed capacity in 2035 in the Reference Scenario of the Ten-Year Energy Expansion Plan. It is a scenario, not a forecast."),
    },
    ibge: {
      arquivo: "gold/inclusao.json",
      caminho: ["orcamento", "evidencias", "media_razoes_renda_classe_baixa"],
      natureza: "ESTIMADO",
      painel: { rotulo: tx("Inclusão: peso no orçamento", "Inclusion: weight in the budget"), href: "/setor-eletrico/inclusao-energetica/orcamento#p061" },
      leitura: tx("Um número calculado com microdados do IBGE: o peso da energia no orçamento das famílias de menor rendimento, na Pesquisa de Orçamentos Familiares de 2017 a 2018.", "A figure calculated with IBGE microdata: the weight of energy in the budget of the lowest-income families, in the Household Budget Survey of 2017 to 2018."),
    },
    "sistemas-isolados": {
      arquivo: "gold/inclusao.json",
      caminho: ["acesso", "sistemas_isolados", "evidencia_populacao"],
      natureza: "OBSERVADO",
      painel: { rotulo: tx("Inclusão: sistemas isolados", "Inclusion: isolated systems"), href: "/setor-eletrico/inclusao-energetica/acesso#isolados" },
      leitura: tx("População das localidades de sistemas isolados que a EPE lista no ciclo mais recente do PASI, informada pelas distribuidoras; localidade sem população informada fica fora da soma.", "Population of the isolated system localities that the EPE lists in the most recent PASI cycle, reported by the distribution utilities; a locality without reported population is left out of the sum."),
    },
  };
}
export const EXEMPLO_EVIDENCIA_IDIOMAS = montarNosDoisIdiomas(montarExemploEvidencia);
export const EXEMPLO_EVIDENCIA: Record<string, FonteExemplo> = EXEMPLO_EVIDENCIA_IDIOMAS.pt;

export type ExemploComEvidencia = FonteExemplo & {
  evidencia: Evidencia;
  /** Frase que completa o número com os termos da conta ou com a decomposição, lida da gold no build; ausente sem dado. */
  complemento?: string | null;
};

const RAIZ = join(process.cwd(), "public", "energia");
const cache = new Map<string, unknown>();

function lerPublicado(arquivo: string): unknown {
  if (!cache.has(arquivo)) {
    try {
      cache.set(arquivo, JSON.parse(readFileSync(join(RAIZ, arquivo), "utf-8")));
    } catch {
      cache.set(arquivo, null);
    }
  }
  return cache.get(arquivo);
}

function noCaminho(obj: unknown, caminho: string[]): unknown {
  let v = obj;
  for (const k of caminho) {
    if (v === null || typeof v !== "object") return undefined;
    v = (v as Record<string, unknown>)[k];
  }
  return v;
}

function ehEvidencia(x: unknown): x is Evidencia {
  return !!x && typeof x === "object" && typeof (x as Evidencia).indicador === "string" && typeof (x as Evidencia).valor_exibido === "string";
}

/** Ficha publicada num arquivo de /energia; null sem arquivo, sem ficha ou sem valor. */
export function evidenciaPublicada(arquivo: string, caminho: string[]): Evidencia | null {
  const ev = noCaminho(lerPublicado(arquivo), caminho);
  return ehEvidencia(ev) && ev.valor_calculo !== null ? ev : null;
}

type Linha = Record<string, number | string | null>;

/** Ficha publicada em outro arquivo, pelo valor exibido e pelo cálculo; null sem ficha. */
const ficha = (arquivo: string, caminho: string[]) => evidenciaPublicada(arquivo, caminho);

/** EAR do SIN (% da EAR máxima) de um dia, na série diária publicada pelo painel de Água (captura mais recente); null sem o dia. */
function earDoDia(dia: string): number | null {
  try {
    const linhas = readFileSync(join(RAIZ, "series", "agua_subsistemas_diario.csv"), "utf-8").split("\n");
    const cab = linhas[0].split(";");
    const iPct = cab.indexOf("ear_pct");
    const achada = linhas.find((l) => l.startsWith(`${dia};SIN;`));
    const v = achada ? Number(achada.split(";")[iPct]) : NaN;
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

/**
 * Valor exibido da ficha (escrito em português pela gold, "1.234,56") com os separadores do idioma da página: em inglês, ponto e
 * vírgula trocam de lugar dentro de cada número ("1,234.56"). O valor é o mesmo; só a grafia muda.
 */
const valorNoIdioma = (v: string) => tx(v, v.replace(/\d[\d.,]*\d|\d/g, (n) => n.replace(/[.,]/g, (c) => (c === "." ? "," : "."))));

/** Reais em bilhões, com uma casa: "R$ 50,7 bilhões". */
const bilhoes = (v: number) => tx(`R$ ${num(v / 1e9, 1)} bilhões`, `R$ ${num(v / 1e9, 1)} billion`);

/**
 * Complemento do exemplo de alguns verbetes: os termos da conta (GSF) ou a decomposição do número
 * (constrained-off), lidos da mesma gold do painel e do mesmo mês ou período da ficha. Nunca escrito à mão.
 */
const COMPLEMENTO_EXEMPLO: Record<string, (ev: Evidencia) => string | null> = {
  gsf: () => {
    const mes = noCaminho(lerPublicado("gold/mercado.json"), ["mre_gsf", "kpis", "gsf_ultimo_mes", "mes"]);
    const linhas = noCaminho(lerPublicado("gold/mercado.json"), ["mre_gsf", "mensal"]);
    const u = Array.isArray(linhas) ? (linhas as Linha[]).find((x) => x.mes === mes) : undefined;
    const ger = Number(u?.geracao_mre_mwmed);
    const modulada = Number(u?.gf_modulada_fdisp_mwmed);
    const sazonalizada = Number(u?.gf_sazonalizada_mwmed);
    if (![ger, modulada, sazonalizada].every((x) => Number.isFinite(x) && x > 0)) return null;
    return (
      tx(`Os termos da conta, em MWmed: ${num(ger, 0)} de geração das usinas do MRE divididos por ${num(modulada, 0)} de garantia física modulada e ajustada pelo fator de disponibilidade. `, `The terms of the calculation, in MWavg: ${num(ger, 0)} of generation of the MRE plants divided by ${num(modulada, 0)} of physical guarantee modulated and adjusted by the availability factor. `) +
      tx(`Com a garantia física sazonalizada (${num(sazonalizada, 0)}) no lugar dela, a mesma geração daria ${pct((ger / sazonalizada) * 100, 1)}. `, `With the seasonalized physical guarantee (${num(sazonalizada, 0)}) in its place, the same generation would give ${pct((ger / sazonalizada) * 100, 1)}. `) +
      tx(`São dois resultados do mesmo mês e da mesma geração: só a garantia física do denominador muda. O observatório usa a modulada e ajustada pelo fator de disponibilidade; o boletim do MME usa a sazonalizada.`, "These are two results of the same month and the same generation: only the physical guarantee in the denominator changes. The observatory uses the modulated one adjusted by the availability factor; the MME bulletin uses the seasonalized one.")
    );
  },
  "constrained-off": () => {
    const u = noCaminho(lerPublicado("gold/geracao_detalhe.json"), ["restricoes", "eolica", "ultimos_12m"]) as { taxa_pct?: number; por_razao?: { razao: string; pct: number }[] } | undefined;
    const p = (r: string) => u?.por_razao?.find((x) => x.razao === r)?.pct;
    const [rel, cnf, ene] = [p("REL"), p("CNF"), p("ENE")];
    if (!u || typeof u.taxa_pct !== "number" || [rel, cnf, ene].some((x) => typeof x !== "number")) return null;
    return tx(`Nos mesmos 12 meses, a taxa de restrição foi de ${pct(u.taxa_pct, 1)} da geração possível estimada (verificada mais não gerada). Por razão, a energia não gerada se divide em ${pct(rel, 1)} de indisponibilidade externa, ${pct(cnf, 1)} de confiabilidade elétrica e ${pct(ene, 1)} de razão energética. Segundo a REN, nos eventos posteriores aos marcos de vigência (1º/10/2021 nas eólicas, 1º/04/2024 nas fotovoltaicas), só a primeira razão dá direito ao pagamento por ESS, e só depois de um limite de horas acumuladas no ano.`, `Over the same 12 months, the restriction rate was ${pct(u.taxa_pct, 1)} of the estimated possible generation (verified plus not generated). By reason, the energy not generated splits into ${pct(rel, 1)} external unavailability, ${pct(cnf, 1)} electrical reliability and ${pct(ene, 1)} energy reason. According to the REN, for events after the effective milestones (Oct 1, 2021 at wind plants, Apr 1, 2024 at photovoltaic plants), only the first reason gives the right to payment through the ESS, and only after a limit of hours accumulated in the year.`);
  },
  // leitura do número em palavras comuns: lida da própria ficha (numerador e denominador) e do período dela
  acl: (ev) => {
    const v = ev.valor_exibido.replace("%", "");
    return tx(`De cada 100 MWh contabilizados pela CCEE nas classes do ACR e do ACL, sem a exportação, ${v} foram consumidos no ACL nos 12 meses de ${mesAno(ev.periodo.inicio)} a ${mesAno(ev.periodo.fim)}.`, `Of every 100 MWh accounted by the CCEE in the ACR and ACL classes, without exports, ${valorNoIdioma(v)} were consumed in the ACL over the 12 months from ${mesAno(ev.periodo.inicio)} to ${mesAno(ev.periodo.fim)}.`);
  },
  cde: (ev) => {
    const n = ev.numerador?.valor;
    const d = ev.denominador?.valor;
    if (typeof n !== "number" || typeof d !== "number") return null;
    return tx(`No orçamento aprovado de ${ev.periodo.fim}, as quotas pagas nas tarifas somam ${bilhoes(n)}, de ${bilhoes(d)} em receitas publicadas.`, `In the approved budget for ${ev.periodo.fim}, the quotas paid in the tariffs add up to ${bilhoes(n)}, out of ${bilhoes(d)} in published revenues.`);
  },
  ear: (ev) => {
    const sin = (noCaminho(lerPublicado("gold/agua_detalhe.json"), ["armazenamento", "subsistemas"]) as Record<string, unknown>[] | undefined)?.find((x) => x.sm === "SIN");
    const dia = String(sin?.dia ?? ev.periodo.fim);
    const p50 = Number(sin?.p50);
    const [p10, p90] = [Number(sin?.p10), Number(sin?.p90)];
    const base = String(sin?.periodo_base ?? "");
    const anos = Number(sin?.anos_na_base);
    if (![p50, p10, p90, anos].every(Number.isFinite) || !/^\d{4}-\d{4}$/.test(base)) return null;
    const faixa = sin?.faixa === "dentro" ? tx("dentro dessa faixa", "within this range") : sin?.faixa === "acima" ? tx("acima dessa faixa", "above this range") : sin?.faixa === "abaixo" ? tx("abaixo dessa faixa", "below this range") : null;
    // a Visão geral lê a base de hidrologia, cuja captura do ONS pode terminar um dia antes da deste painel
    const h = (noCaminho(lerPublicado("gold/hidrologia.json"), ["subsistemas"]) as { sm: string; ear?: { valor: number; dia: string } }[] | undefined)?.find((x) => x.sm === "SIN")?.ear;
    const dias = h ? Math.round((Date.parse(dia) - Date.parse(h.dia)) / 86_400_000) : 0;
    // o mesmo dia na captura mais recente (a série diária do painel de Água): o ONS revisa os valores já publicados
    const revisado = h ? earDoDia(h.dia) : null;
    const mudou = revisado !== null && h !== undefined && pct(revisado, 1) !== pct(h.valor, 1);
    const ponte =
      h && dias > 0
        ? tx(
            ` A Visão geral traz ${pct(h.valor, 1)} em ${dataBR(h.dia)}, ${plural(dias, "dia", "dias")} antes: ela lê a base de hidrologia, cuja captura do arquivo do ONS é anterior, e este exemplo usa uma captura mais recente, que já traz ${dataBR(dia).slice(0, 5)}${mudou ? ` e dá ${pct(revisado, 1)} para o próprio ${dataBR(h.dia).slice(0, 5)}, porque o ONS revisa os valores publicados` : ""}.`,
            ` The Overview shows ${pct(h.valor, 1)} on ${dataBR(h.dia)}, ${plural(dias, "day", "days")} earlier: it reads the hydrology database, whose capture of the ONS file is older, and this example uses a more recent capture, which already includes ${dataCurta(dia)}${mudou ? ` and gives ${pct(revisado, 1)} for ${dataCurta(h.dia)} itself, because the ONS revises published values` : ""}.`,
          )
        : "";
    return tx(
      `Para ${dataBR(dia).slice(0, 5)}, a mediana dos anos completos desde ${base.slice(0, 4)} (${base.replace("-", " a ")}, ${num(anos, 0)} anos) é ${pct(p50, 1)} da EAR máxima; o 10º a 90º percentil vai de ${pct(p10, 1)} a ${pct(p90, 1)}` +
        `${faixa ? `, e o valor deste dia fica ${faixa}` : ""}.${ponte}`,
      `For ${dataCurta(dia)}, the median of the complete years since ${base.slice(0, 4)} (${base.replace("-", " to ")}, ${num(anos, 0)} years) is ${pct(p50, 1)} of the maximum EAR; the 10th to 90th percentile range goes from ${pct(p10, 1)} to ${pct(p90, 1)}` +
        `${faixa ? `, and the value of this day is ${faixa}` : ""}.${ponte}`,
    );
  },
  dessem: (ev) => {
    const pld = ficha("series/pld_evidencias.json", ["evidencias", "pld_semana_SE"]);
    if (!pld || pld.valor_calculo === null || ev.valor_calculo === null) return null;
    const lado = pld.valor_calculo > ev.valor_calculo ? tx("acima", "above") : pld.valor_calculo < ev.valor_calculo ? tx("abaixo", "below") : tx("igual ao", "equal to");
    return (
      tx(`No mesmo recorte (Sudeste/Centro-Oeste, mesma semana operativa), o PLD médio foi ${pld.valor_exibido}, ${lado} do CMO médio do DESSEM. `, `In the same cut (Southeast/Center-West, same operating week), the average PLD was ${valorNoIdioma(pld.valor_exibido)}, ${lado} the average DESSEM CMO. `) +
      tx(`O PLD parte do CMO, mas não é o CMO: é calculado pela CCEE por hora e submercado e aplica os limites regulatórios.`, "The PLD starts from the CMO, but it is not the CMO: it is calculated by the CCEE by hour and submarket and applies the regulatory limits.")
    );
  },
  pld: (ev) => {
    const dessem = ficha("series/pld_evidencias.json", ["evidencias", "dessem_semana_SE"]);
    const piso = ficha("gold/regulacao.json", ["evidencias", "limites", "pld_min"]);
    const teto = ficha("gold/regulacao.json", ["evidencias", "limites", "pld_max_horario"]);
    const partes: string[] = [];
    if (piso && teto) partes.push(tx(`Em ${piso.periodo.inicio.slice(0, 4)}, o piso do PLD é ${piso.valor_exibido} e o teto horário, ${teto.valor_exibido}.`, `In ${piso.periodo.inicio.slice(0, 4)}, the PLD floor is ${valorNoIdioma(piso.valor_exibido)} and the hourly ceiling, ${valorNoIdioma(teto.valor_exibido)}.`));
    if (dessem && dessem.valor_calculo !== null && ev.valor_calculo !== null) {
      const lado = dessem.valor_calculo < ev.valor_calculo ? tx("abaixo", "below") : dessem.valor_calculo > ev.valor_calculo ? tx("acima", "above") : tx("igual ao", "equal to");
      partes.push(tx(`No mesmo recorte, o CMO médio que o DESSEM estima foi ${dessem.valor_exibido}, ${lado} do PLD médio.`, `In the same cut, the average CMO that DESSEM estimates was ${valorNoIdioma(dessem.valor_exibido)}, ${lado} the average PLD.`));
    }
    return partes.length ? partes.join(" ") : null;
  },
  "tarifa-te-tusd": () => {
    const r = noCaminho(lerPublicado("gold/conta.json"), ["tarifas", "resumo"]) as { n?: number; p25?: number; p75?: number; perfis_mediana?: Record<string, number> } | undefined;
    const kwh = (mwh: number) => `R$ ${num(mwh / 1000, 4)}`;
    const mes200 = r?.perfis_mediana?.["200"];
    if (!r || typeof r.n !== "number" || typeof r.p25 !== "number" || typeof r.p75 !== "number" || typeof mes200 !== "number") return null;
    return (
      tx(`A mediana é a tarifa do meio entre as ${num(r.n, 0)} distribuidoras: metade cobra menos e metade cobra mais, e cada uma conta uma vez, qualquer que seja o número de consumidores. `, `The median is the middle tariff among the ${num(r.n, 0)} distribution utilities: half charge less and half charge more, and each one counts once, whatever the number of consumers. `) +
      tx(`A metade do meio cobra de ${kwh(r.p25)} a ${kwh(r.p75)} por kWh. Um consumo de 200 kWh em um mês custa R$ ${num(mes200, 2)} na tarifa mediana, sem tributos nem bandeira.`, `The middle half charges from ${kwh(r.p25)} to ${kwh(r.p75)} per kWh. A consumption of 200 kWh in a month costs R$ ${num(mes200, 2)} at the median tariff, without taxes or tariff flag.`)
    );
  },
};

/** Evidência publicada para o exemplo do verbete; null sem mapeamento, sem gold ou sem valor. */
export function exemploComEvidencia(slug: string): ExemploComEvidencia | null {
  const f = EXEMPLO_EVIDENCIA_IDIOMAS[idiomaEnergia()][slug];
  if (!f) return null;
  const ev = evidenciaPublicada(f.arquivo, f.caminho);
  return ev ? { ...f, leitura: f.leitura.replace("{ano}", ev.periodo.fim.slice(0, 4)), evidencia: ev, complemento: COMPLEMENTO_EXEMPLO[slug]?.(ev) ?? null } : null;
}

/**
 * Ponte do passo "Onde o preço vira resultado" (o exemplo do MRE mostra a geração e a garantia física do último mês, sem a razão):
 * o GSF do mesmo mês, lido da ficha do GSF. Só escreve quando os dois exemplos são do mesmo mês.
 */
export function notaGsfDoMes(): string | null {
  const g = exemploComEvidencia("gsf");
  const mensal = noCaminho(lerPublicado("gold/mercado.json"), ["mre_gsf", "mensal"]);
  const ultimo = Array.isArray(mensal) ? (mensal[mensal.length - 1] as Linha | undefined)?.mes : undefined;
  const mes = noCaminho(lerPublicado("gold/mercado.json"), ["mre_gsf", "kpis", "gsf_ultimo_mes", "mes"]);
  if (!g || typeof ultimo !== "string" || ultimo !== mes) return null;
  return tx(`A razão entre a geração e a garantia física modulada e ajustada pelo fator de disponibilidade é o GSF de ${mesAno(ultimo)}: ${g.evidencia.valor_exibido}.`, `The ratio between generation and the physical guarantee modulated and adjusted by the availability factor is the GSF of ${mesAno(ultimo)}: ${valorNoIdioma(g.evidencia.valor_exibido)}.`);
}
