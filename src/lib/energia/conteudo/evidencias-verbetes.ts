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
  mre: {
    arquivo: "gold/mercado.json",
    caminho: ["mre_gsf", "kpis", "gsf_ultimo_mes", "evidencia"],
    natureza: "CALCULADO",
    painel: { rotulo: "Mercado: MRE e GSF", href: "/setor-eletrico/mercado/mre-e-gsf#mre-gsf" },
    leitura: "O fator de ajuste do MRE no último mês: geração das usinas do mecanismo dividida pela garantia física modulada e ajustada pelo fator de disponibilidade.",
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
    leitura: "Mediana, entre as distribuidoras com tarifa vigente na data, da TE mais TUSD residencial B1 convencional, sem ponderação e sem tributos.",
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
    leitura: "Parcela das receitas do orçamento da CDE no ano que vem das quotas pagas nas tarifas.",
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
    painel: { rotulo: "Qualidade: duração e frequência", href: "/setor-eletrico/qualidade#p052" },
    leitura: "DEC do Brasil no ano: média mensal dos conjuntos ponderada pelas unidades consumidoras, somada nos 12 meses.",
  },
  fec: {
    arquivo: "gold/qualidade.json",
    caminho: ["evidencias", "fec_brasil"],
    natureza: "CALCULADO",
    painel: { rotulo: "Qualidade: duração e frequência", href: "/setor-eletrico/qualidade#p052" },
    leitura: "FEC do Brasil no ano, com a mesma ponderação do DEC.",
  },
  "conjunto-eletrico": {
    arquivo: "gold/qualidade.json",
    caminho: ["evidencias", "conjuntos_acima_limite"],
    natureza: "CALCULADO",
    painel: { rotulo: "Qualidade: conjuntos e limites", href: "/setor-eletrico/qualidade#p053" },
    leitura: "Parcela dos conjuntos com 12 meses apurados cujo DEC anual passou do limite fixado para o próprio conjunto.",
  },
  "compensacao-continuidade": {
    arquivo: "gold/qualidade.json",
    caminho: ["evidencias", "compensacoes_ano"],
    natureza: "CALCULADO",
    painel: { rotulo: "Qualidade: compensações", href: "/setor-eletrico/qualidade#p054" },
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
};

export type ExemploComEvidencia = FonteExemplo & { evidencia: Evidencia };

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

/** Evidência publicada para o exemplo do verbete; null sem mapeamento, sem gold ou sem valor. */
export function exemploComEvidencia(slug: string): ExemploComEvidencia | null {
  const f = EXEMPLO_EVIDENCIA[slug];
  if (!f) return null;
  const ev = evidenciaPublicada(f.arquivo, f.caminho);
  return ev ? { ...f, evidencia: ev } : null;
}
