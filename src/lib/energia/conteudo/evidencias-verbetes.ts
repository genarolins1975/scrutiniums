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
import { dataBR, mesAno, num, pct, plural } from "../formato";
import type { Natureza } from "../tipos";

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

export const EXEMPLO_EVIDENCIA: Record<string, FonteExemplo> = {
  acl: {
    arquivo: "gold/mercado.json",
    caminho: ["livre_regulado", "kpis", "participacao_acl_ccee_12m", "evidencia"],
    natureza: "CALCULADO",
    painel: { rotulo: "Mercado: livre e regulado", href: "/setor-eletrico/mercado#livre-regulado" },
    leitura: "Parcela do consumo contabilizado pela CCEE que está nas classes de agente do ACL, como razão de somas em energia nos 12 meses.",
  },
  gsf: {
    arquivo: "gold/mercado.json",
    caminho: ["mre_gsf", "kpis", "gsf_ultimo_mes", "evidencia"],
    natureza: "CALCULADO",
    painel: { rotulo: "Mercado: MRE e GSF", href: "/setor-eletrico/mercado/mre-e-gsf#mre-gsf" },
    leitura: "O GSF do último mês publicado: geração das usinas do MRE dividida pela garantia física modulada e ajustada pelo fator de disponibilidade, nos conjuntos abertos da CCEE.",
  },
  "constrained-off": {
    arquivo: "gold/geracao_detalhe.json",
    caminho: ["evidencias", "restricao_eolica_12m_energia"],
    natureza: "ESTIMADO",
    painel: { rotulo: "Geração: renováveis restringidas", href: "/setor-eletrico/geracao/restricoes#p023" },
    leitura: "Energia que as usinas eólicas deixaram de gerar por limitação do ONS nos 12 meses completos, estimada como a geração de referência menos a verificada.",
  },
  ess: {
    arquivo: "gold/mercado.json",
    caminho: ["encargos", "kpis", "ess_12m", "evidencia"],
    natureza: "CALCULADO",
    painel: { rotulo: "Mercado: encargos e liquidação", href: "/setor-eletrico/mercado/encargos#encargos" },
    leitura: "Soma, por mês de competência, dos tipos de encargo de serviços do sistema publicados pela CCEE nos 12 meses.",
  },
  imerg: {
    arquivo: "gold/agua_detalhe.json",
    caminho: ["evidencias", "precipitacao_maior_bacia_30d"],
    natureza: "ESTIMADO",
    painel: { rotulo: "Água e clima: chuva e temperatura", href: "/setor-eletrico/agua-e-clima/chuva-e-temperatura#p019" },
    leitura: "Chuva acumulada em 30 dias na bacia de maior EAR máxima, estimada pelo IMERG.",
  },
  "merra-2": {
    arquivo: "gold/agua_detalhe.json",
    caminho: ["evidencias", "temperatura_sin_30d"],
    natureza: "ESTIMADO",
    painel: { rotulo: "Água e clima: chuva e temperatura", href: "/setor-eletrico/agua-e-clima/chuva-e-temperatura#p019" },
    leitura: "Anomalia de temperatura do SIN em 30 dias diante da mesma janela de 2001 a 2025, com as células da reanálise e as UF ponderadas pela população.",
  },
  "curva-de-carga": {
    arquivo: "gold/carga_detalhe.json",
    caminho: ["evidencias", "p026_pico_sin"],
    natureza: "OBSERVADO",
    painel: { rotulo: "Carga: perfil horário", href: "/setor-eletrico/carga/perfil-horario#p026" },
    leitura: "A hora de maior carga do SIN no dia, lida da curva de carga horária.",
  },
  "carga-global": {
    arquivo: "gold/carga_detalhe.json",
    caminho: ["evidencias", "p026_mmgd_mes"],
    natureza: "ESTIMADO",
    painel: { rotulo: "Carga: perfil horário", href: "/setor-eletrico/carga/perfil-horario#p026" },
    leitura: "Quanto da carga global do SIN foi atendido por micro e minigeração distribuída no último mês completo, segundo a estimativa do ONS.",
  },
  "carga-liquida-de-mmgd": {
    arquivo: "gold/carga_detalhe.json",
    caminho: ["evidencias", "p026_mmgd_mes"],
    natureza: "ESTIMADO",
    painel: { rotulo: "Carga: perfil horário", href: "/setor-eletrico/carga/perfil-horario#p026" },
    leitura: "A parcela da carga global atendida por MMGD: é ela que separa a carga global da carga líquida de MMGD.",
  },
  "intercambio-internacional": {
    arquivo: "gold/rede_detalhe.json",
    caminho: ["evidencias", "exterior_12m"],
    natureza: "CALCULADO",
    painel: { rotulo: "Rede: balanço e exterior", href: "/setor-eletrico/rede/balanco-e-exterior#p029" },
    leitura: "Saldo do intercâmbio do SIN com a Argentina e o Uruguai em 12 meses; positivo é exportação.",
  },
  atls: {
    arquivo: "gold/rede_detalhe.json",
    caminho: ["evidencias", "atls_12m.FNESE"],
    natureza: "CALCULADO",
    painel: { rotulo: "Rede: restrições", href: "/setor-eletrico/rede/restricoes#p030" },
    leitura: "Horas acima do limite em 12 meses num fluxo selecionado pelo ONS, pela soma das horas de violação que o ONS publica: é o tempo que o ATLS desconta do período observado.",
  },
  "tarifa-te-tusd": {
    arquivo: "gold/conta.json",
    caminho: ["tarifas", "evidencia_mediana"],
    natureza: "CALCULADO",
    painel: { rotulo: "Conta de luz: tarifa", href: "/setor-eletrico/conta-de-luz#tarifa" },
    leitura: "Tarifa residencial (no conjunto da ANEEL: subgrupo B1, modalidade convencional): a mediana, entre as distribuidoras com tarifa vigente na data, da soma de TE e TUSD, sem tributos.",
  },
  "bandeira-tarifaria": {
    arquivo: "gold/conta.json",
    caminho: ["bandeiras", "evidencia"],
    natureza: "OBSERVADO",
    painel: { rotulo: "Conta de luz: bandeiras", href: "/setor-eletrico/conta-de-luz/reajustes-e-subsidios#bandeiras" },
    leitura: "A cor acionada no mês e o acréscimo por kWh que ela representa.",
  },
  cde: {
    arquivo: "gold/conta.json",
    caminho: ["financiamento_cde", "evidencia"],
    natureza: "CALCULADO",
    painel: { rotulo: "Conta de luz: subsídios", href: "/setor-eletrico/conta-de-luz/reajustes-e-subsidios#subsidios" },
    leitura: "Parcela das receitas do orçamento aprovado da CDE de {ano} que vem das quotas pagas nas tarifas.",
  },
  "perdas-de-energia": {
    arquivo: "gold/perdas.json",
    caminho: ["evidencias", "perdas_nacional"],
    natureza: "OBSERVADO",
    painel: { rotulo: "Perdas: mapa das distribuidoras", href: "/setor-eletrico/perdas#painel-mapa" },
    leitura: "Perdas totais de energia das concessionárias de distribuição no último ano completo, como a ANEEL as calcula no SAMP.",
  },
  "perdas-nao-tecnicas": {
    arquivo: "gold/perdas.json",
    caminho: ["evidencias", "pnt_bt_nacional"],
    natureza: "ESTIMADO",
    painel: { rotulo: "Perdas: composição", href: "/setor-eletrico/perdas/composicao#composicao" },
    leitura: "Perdas não técnicas sobre o mercado de baixa tensão medido, nas concessionárias que separam a parcela técnica.",
  },
  dec: {
    arquivo: "gold/qualidade.json",
    caminho: ["evidencias", "dec_brasil"],
    natureza: "CALCULADO",
    painel: { rotulo: "Qualidade: duração e frequência", href: "/setor-eletrico/qualidade#p051" },
    leitura: "DEC do Brasil no ano: média mensal dos conjuntos ponderada pelas unidades consumidoras, somada nos 12 meses.",
  },
  fec: {
    arquivo: "gold/qualidade.json",
    caminho: ["evidencias", "fec_brasil"],
    natureza: "CALCULADO",
    painel: { rotulo: "Qualidade: duração e frequência", href: "/setor-eletrico/qualidade#p051" },
    leitura: "FEC do Brasil no ano, com a mesma ponderação do DEC.",
  },
  "conjunto-eletrico": {
    arquivo: "gold/qualidade.json",
    caminho: ["evidencias", "conjuntos_acima_limite"],
    natureza: "CALCULADO",
    painel: { rotulo: "Qualidade: conjuntos e limites", href: "/setor-eletrico/qualidade#p052" },
    leitura: "Parcela dos conjuntos com 12 meses apurados cujo DEC anual passou do limite fixado para o próprio conjunto.",
  },
  "compensacao-continuidade": {
    arquivo: "gold/qualidade.json",
    caminho: ["evidencias", "compensacoes_ano"],
    natureza: "CALCULADO",
    painel: { rotulo: "Qualidade: compensações", href: "/setor-eletrico/qualidade#p053" },
    leitura: "Valor das compensações pagas no ano por violação dos limites individuais de continuidade, pela competência.",
  },
  "tarifa-social": {
    arquivo: "gold/inclusao.json",
    caminho: ["tarifa_social", "kpis", "uc_tsee", "evidencia"],
    natureza: "OBSERVADO",
    painel: { rotulo: "Inclusão: Tarifa Social", href: "/setor-eletrico/inclusao-energetica/tarifa-social#p059" },
    leitura: "Unidades consumidoras com o desconto, no último mês publicado pela ANEEL; não é número de famílias.",
  },
  "fator-de-emissao": {
    arquivo: "gold/transicao.json",
    caminho: ["emissoes", "evidencia"],
    natureza: "ESTIMADO",
    painel: { rotulo: "Transição: emissões", href: "/setor-eletrico/transicao/emissoes#p064" },
    leitura: "Fator médio anual de emissão de CO2 do SIN, como o MCTI publica.",
  },
  "limites-do-pld": {
    arquivo: "gold/regulacao.json",
    caminho: ["evidencias", "limites", "pld_max_horario"],
    natureza: "OBSERVADO",
    painel: { rotulo: "Regulação: limites do PLD", href: "/setor-eletrico/regulacao#p044" },
    leitura: "O teto horário vigente, como escrito no ato da ANEEL.",
  },
  pld: {
    arquivo: "series/pld_evidencias.json",
    caminho: ["evidencias", "pld_semana_SE"],
    natureza: "CALCULADO",
    painel: { rotulo: "PLD: CMO e formação do preço", href: "/setor-eletrico/pld/cmo-e-formacao#p009" },
    leitura: "Média, nas horas da semana operativa, do PLD do Sudeste/Centro-Oeste: o preço que a CCEE calcula para cada hora a partir do CMO, aplicando o piso e os tetos. O CMO do DESSEM da mesma semana está no verbete DESSEM.",
  },
  ear: {
    arquivo: "gold/agua_detalhe.json",
    caminho: ["evidencias", "ear_sin"],
    natureza: "CALCULADO",
    painel: { rotulo: "Água e clima: reservatórios", href: "/setor-eletrico/agua-e-clima#p017" },
    leitura: "Quanto da capacidade de armazenamento dos reservatórios do SIN estava ocupada no último dia publicado: soma das EAR dos subsistemas dividida pela soma das EAR máximas.",
  },
  armazenamento: {
    arquivo: "gold/agua_detalhe.json",
    caminho: ["evidencias", "ear_sin"],
    natureza: "CALCULADO",
    painel: { rotulo: "Água e clima: reservatórios", href: "/setor-eletrico/agua-e-clima#p017" },
    leitura: "A EAR do SIN em relação à EAR máxima, a capacidade de armazenamento com todos os reservatórios cheios.",
  },
  dessem: {
    arquivo: "series/pld_evidencias.json",
    caminho: ["evidencias", "dessem_semana_SE"],
    natureza: "CALCULADO",
    painel: { rotulo: "PLD: CMO e formação do preço", href: "/setor-eletrico/pld/cmo-e-formacao#p009" },
    leitura: "Média, nas meias horas da semana operativa, do CMO que o DESSEM estima para o Sudeste/Centro-Oeste, lado a lado com o PLD da mesma semana no painel.",
  },
  "geracao-distribuida": {
    arquivo: "gold/transicao.json",
    caminho: ["mmgd", "evidencias", "potencia"],
    natureza: "OBSERVADO",
    painel: { rotulo: "Transição: micro e minigeração", href: "/setor-eletrico/transicao/mmgd#p063" },
    leitura: "Potência instalada da MMGD no cadastro da ANEEL: capacidade, não energia gerada.",
  },
  // instituições e escopo do sistema (conceitos-instituicoes.ts): o exemplo é um número que a instituição produz ou publica e o painel mostra
  ons: {
    arquivo: "gold/carga_detalhe.json",
    caminho: ["evidencias", "p026_pico_sin"],
    natureza: "OBSERVADO",
    painel: { rotulo: "Carga: perfil horário", href: "/setor-eletrico/carga/perfil-horario#p026" },
    leitura: "Um dado de operação que o ONS mede e publica: a hora de maior carga do SIN no dia, lida da curva de carga horária.",
  },
  ccee: {
    arquivo: "series/pld_evidencias.json",
    caminho: ["evidencias", "pld_semana_SE"],
    natureza: "CALCULADO",
    painel: { rotulo: "PLD: CMO e formação do preço", href: "/setor-eletrico/pld/cmo-e-formacao#p009" },
    leitura: "Um preço que a CCEE calcula para cada hora; aqui, a média do PLD do Sudeste/Centro-Oeste nas horas da semana operativa.",
  },
  aneel: {
    arquivo: "gold/regulacao.json",
    caminho: ["evidencias", "limites", "pld_max_horario"],
    natureza: "OBSERVADO",
    painel: { rotulo: "Regulação: limites do PLD", href: "/setor-eletrico/regulacao#p044" },
    leitura: "Um ato da ANEEL lido no painel de Regulação: o teto horário do PLD vigente no ano, como escrito no ato.",
  },
  epe: {
    arquivo: "gold/expansao.json",
    caminho: ["evidencias", "pde_capacidade_2035"],
    natureza: "CENARIO",
    painel: { rotulo: "Expansão: cenários", href: "/setor-eletrico/expansao/cenarios#p043" },
    leitura: "Um número do planejamento que a EPE publica: a capacidade instalada nacional em 2035 no Cenário de Referência do Plano Decenal de Expansão de Energia. É cenário, não previsão.",
  },
  ibge: {
    arquivo: "gold/inclusao.json",
    caminho: ["orcamento", "evidencias", "media_razoes_renda_classe_baixa"],
    natureza: "ESTIMADO",
    painel: { rotulo: "Inclusão: peso no orçamento", href: "/setor-eletrico/inclusao-energetica/orcamento#p061" },
    leitura: "Um número calculado com microdados do IBGE: o peso da energia no orçamento das famílias de menor rendimento, na Pesquisa de Orçamentos Familiares de 2017 a 2018.",
  },
  "sistemas-isolados": {
    arquivo: "gold/inclusao.json",
    caminho: ["acesso", "sistemas_isolados", "evidencia_populacao"],
    natureza: "OBSERVADO",
    painel: { rotulo: "Inclusão: sistemas isolados", href: "/setor-eletrico/inclusao-energetica/acesso#isolados" },
    leitura: "População das localidades de sistemas isolados que a EPE lista no ciclo mais recente do PASI, informada pelas distribuidoras; localidade sem população informada fica fora da soma.",
  },
};

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

/** Reais em bilhões, com uma casa: "R$ 50,7 bilhões". */
const bilhoes = (v: number) => `R$ ${num(v / 1e9, 1)} bilhões`;

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
      `Os termos da conta, em MWmed: ${num(ger, 0)} de geração das usinas do MRE divididos por ${num(modulada, 0)} de garantia física modulada e ajustada pelo fator de disponibilidade. ` +
      `Com a garantia física sazonalizada (${num(sazonalizada, 0)}) no lugar dela, a mesma geração daria ${pct((ger / sazonalizada) * 100, 1)}. ` +
      `São dois resultados do mesmo mês e da mesma geração: só a garantia física do denominador muda. O observatório usa a modulada e ajustada pelo fator de disponibilidade; o boletim do MME usa a sazonalizada.`
    );
  },
  "constrained-off": () => {
    const u = noCaminho(lerPublicado("gold/geracao_detalhe.json"), ["restricoes", "eolica", "ultimos_12m"]) as { taxa_pct?: number; por_razao?: { razao: string; pct: number }[] } | undefined;
    const p = (r: string) => u?.por_razao?.find((x) => x.razao === r)?.pct;
    const [rel, cnf, ene] = [p("REL"), p("CNF"), p("ENE")];
    if (!u || typeof u.taxa_pct !== "number" || [rel, cnf, ene].some((x) => typeof x !== "number")) return null;
    return `Nos mesmos 12 meses, a taxa de restrição foi de ${pct(u.taxa_pct, 1)} da geração possível estimada (verificada mais não gerada). Por razão, a energia não gerada se divide em ${pct(rel, 1)} de indisponibilidade externa, ${pct(cnf, 1)} de confiabilidade elétrica e ${pct(ene, 1)} de razão energética. Segundo a REN, nos eventos posteriores aos marcos de vigência (1º/10/2021 nas eólicas, 1º/04/2024 nas fotovoltaicas), só a primeira razão dá direito ao pagamento por ESS, e só depois de um limite de horas acumuladas no ano.`;
  },
  // leitura do número em palavras comuns: lida da própria ficha (numerador e denominador) e do período dela
  acl: (ev) => {
    const v = ev.valor_exibido.replace("%", "");
    return `De cada 100 MWh contabilizados pela CCEE nas classes do ACR e do ACL, sem a exportação, ${v} foram consumidos no ACL nos 12 meses de ${mesAno(ev.periodo.inicio)} a ${mesAno(ev.periodo.fim)}.`;
  },
  cde: (ev) => {
    const n = ev.numerador?.valor;
    const d = ev.denominador?.valor;
    if (typeof n !== "number" || typeof d !== "number") return null;
    return `No orçamento aprovado de ${ev.periodo.fim}, as quotas pagas nas tarifas somam ${bilhoes(n)}, de ${bilhoes(d)} em receitas publicadas.`;
  },
  ear: (ev) => {
    const sin = (noCaminho(lerPublicado("gold/agua_detalhe.json"), ["armazenamento", "subsistemas"]) as Record<string, unknown>[] | undefined)?.find((x) => x.sm === "SIN");
    const dia = String(sin?.dia ?? ev.periodo.fim);
    const p50 = Number(sin?.p50);
    const [p10, p90] = [Number(sin?.p10), Number(sin?.p90)];
    const base = String(sin?.periodo_base ?? "");
    const anos = Number(sin?.anos_na_base);
    if (![p50, p10, p90, anos].every(Number.isFinite) || !/^\d{4}-\d{4}$/.test(base)) return null;
    const faixa = sin?.faixa === "dentro" ? "dentro dessa faixa" : sin?.faixa === "acima" ? "acima dessa faixa" : sin?.faixa === "abaixo" ? "abaixo dessa faixa" : null;
    // a Visão geral lê a base de hidrologia, cuja captura do ONS pode terminar um dia antes da deste painel
    const h = (noCaminho(lerPublicado("gold/hidrologia.json"), ["subsistemas"]) as { sm: string; ear?: { valor: number; dia: string } }[] | undefined)?.find((x) => x.sm === "SIN")?.ear;
    const dias = h ? Math.round((Date.parse(dia) - Date.parse(h.dia)) / 86_400_000) : 0;
    // o mesmo dia na captura mais recente (a série diária do painel de Água): o ONS revisa os valores já publicados
    const revisado = h ? earDoDia(h.dia) : null;
    const mudou = revisado !== null && h !== undefined && pct(revisado, 1) !== pct(h.valor, 1);
    const ponte =
      h && dias > 0
        ? ` A Visão geral traz ${pct(h.valor, 1)} em ${dataBR(h.dia)}, ${plural(dias, "dia", "dias")} antes: ela lê a base de hidrologia, cuja captura do arquivo do ONS é anterior, e este exemplo usa uma captura mais recente, que já traz ${dataBR(dia).slice(0, 5)}${mudou ? ` e dá ${pct(revisado, 1)} para o próprio ${dataBR(h.dia).slice(0, 5)}, porque o ONS revisa os valores publicados` : ""}.`
        : "";
    return (
      `Para ${dataBR(dia).slice(0, 5)}, a mediana dos anos completos desde ${base.slice(0, 4)} (${base.replace("-", " a ")}, ${num(anos, 0)} anos) é ${pct(p50, 1)} da EAR máxima; o 10º a 90º percentil vai de ${pct(p10, 1)} a ${pct(p90, 1)}` +
      `${faixa ? `, e o valor deste dia fica ${faixa}` : ""}.${ponte}`
    );
  },
  dessem: (ev) => {
    const pld = ficha("series/pld_evidencias.json", ["evidencias", "pld_semana_SE"]);
    if (!pld || pld.valor_calculo === null || ev.valor_calculo === null) return null;
    const lado = pld.valor_calculo > ev.valor_calculo ? "acima" : pld.valor_calculo < ev.valor_calculo ? "abaixo" : "igual ao";
    return (
      `No mesmo recorte (Sudeste/Centro-Oeste, mesma semana operativa), o PLD médio foi ${pld.valor_exibido}, ${lado} do CMO médio do DESSEM. ` +
      `O PLD parte do CMO, mas não é o CMO: é calculado pela CCEE por hora e submercado e aplica os limites regulatórios.`
    );
  },
  pld: (ev) => {
    const dessem = ficha("series/pld_evidencias.json", ["evidencias", "dessem_semana_SE"]);
    const piso = ficha("gold/regulacao.json", ["evidencias", "limites", "pld_min"]);
    const teto = ficha("gold/regulacao.json", ["evidencias", "limites", "pld_max_horario"]);
    const partes: string[] = [];
    if (piso && teto) partes.push(`Em ${piso.periodo.inicio.slice(0, 4)}, o piso do PLD é ${piso.valor_exibido} e o teto horário, ${teto.valor_exibido}.`);
    if (dessem && dessem.valor_calculo !== null && ev.valor_calculo !== null) {
      const lado = dessem.valor_calculo < ev.valor_calculo ? "abaixo" : dessem.valor_calculo > ev.valor_calculo ? "acima" : "igual ao";
      partes.push(`No mesmo recorte, o CMO médio que o DESSEM estima foi ${dessem.valor_exibido}, ${lado} do PLD médio.`);
    }
    return partes.length ? partes.join(" ") : null;
  },
  "tarifa-te-tusd": () => {
    const r = noCaminho(lerPublicado("gold/conta.json"), ["tarifas", "resumo"]) as { n?: number; p25?: number; p75?: number; perfis_mediana?: Record<string, number> } | undefined;
    const kwh = (mwh: number) => `R$ ${num(mwh / 1000, 4)}`;
    const mes200 = r?.perfis_mediana?.["200"];
    if (!r || typeof r.n !== "number" || typeof r.p25 !== "number" || typeof r.p75 !== "number" || typeof mes200 !== "number") return null;
    return (
      `A mediana é a tarifa do meio entre as ${num(r.n, 0)} distribuidoras: metade cobra menos e metade cobra mais, e cada uma conta uma vez, qualquer que seja o número de consumidores. ` +
      `A metade do meio cobra de ${kwh(r.p25)} a ${kwh(r.p75)} por kWh. Um consumo de 200 kWh em um mês custa R$ ${num(mes200, 2)} na tarifa mediana, sem tributos nem bandeira.`
    );
  },
};

/** Evidência publicada para o exemplo do verbete; null sem mapeamento, sem gold ou sem valor. */
export function exemploComEvidencia(slug: string): ExemploComEvidencia | null {
  const f = EXEMPLO_EVIDENCIA[slug];
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
  return `A razão entre a geração e a garantia física modulada e ajustada pelo fator de disponibilidade é o GSF de ${mesAno(ultimo)}: ${g.evidencia.valor_exibido}.`;
}
