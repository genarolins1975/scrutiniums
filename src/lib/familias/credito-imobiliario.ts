/**
 * Leitura da gold de Crédito imobiliário e moradia (public/obs/data/gold/moradia.json: Censo 2022, ESTBAN, Informações do Mercado
 * Imobiliário e SCR) para o painel /credito-imobiliario do Observatório das Famílias. Só servidor. Nenhum valor é calculado aqui além
 * das três somas por UF que a vista antiga já fazia para a comparação das medidas (somasPorUf). O arquivo por município
 * (moradia_mun.json, 2,5 MB) nunca é lido aqui: a página o carrega no navegador, sob demanda.
 */
import { lerPublico, mesAno } from "@/lib/perguntas/leitura";
import { provenienciaMontada } from "@/lib/painel/proveniencia-montada";
import type { Natureza, Proveniencia } from "@/lib/painel/tipos";

export const ROTA_MORADIA = "/credito-imobiliario";
export const TITULO_MORADIA = "Crédito imobiliário e moradia";
export const PERGUNTA_MORADIA = "Como o Brasil mora e onde o crédito imobiliário chega?";
export const DESCRICAO_MORADIA =
  "Como o país mora, quanto crédito imobiliário existe e onde ele não chega, com o Censo 2022 e as três bases do Banco Central mantidas separadas, e um simulador de prestação pelas tabelas Price e SAC.";
/** Endereço da vista antiga, na aplicação do Crédito. */
export const ROTA_ANTIGA_MORADIA = "/observatorio/housing-credit";
/** Arquivo por município, servido como estático e lido só no navegador. */
export const ARQUIVO_MUNICIPIOS = "/obs/data/gold/moradia_mun.json";

export type Selo = "observado" | "calculado" | "estimado" | "cenario" | "indisponivel";
export const NATUREZA_DO_SELO: Record<Exclude<Selo, "indisponivel">, Natureza> = { observado: "OBSERVADO", calculado: "CALCULADO", estimado: "ESTIMADO", cenario: "CENARIO" };

export const SEGMENTOS = [
  ["sfh", "SFH, poupança direcionada"],
  ["fgts", "FGTS"],
  ["livre", "Taxas de mercado"],
  ["home_equity", "Home equity (imóvel em garantia)"],
  ["comercial", "Imóvel comercial de pessoa física"],
] as const;
export type Segmento = (typeof SEGMENTOS)[number][0];

export type ItemRanking = { c: string; n: string; uf: string; v: number; sel: string };

export type Estado = {
  uf: string;
  nome: string;
  reg: string;
  pgp: number | null;
  mi_carteira_pf: number | null;
  scr_imob_pf: number | null;
  scr_operacoes: number | null;
  taxa_sfh: number | null;
  ltv_sfh: number | null;
  parcela_sfh: number | null;
  inad_sfh: number | null;
  valor_compra: number | null;
  area_privativa: number | null;
};

/* eslint-disable @typescript-eslint/no-explicit-any -- leitura de gold JSON sem tipos gerados */
export type DadosMoradia = {
  geradoEm: string;
  datas: { censo: number; estban: string; mi_credito: string; mi_imoveis: string; scr: string };
  censo: { ano: number; total: number; categorias: { k: string; rot: string; n: number; pct: number }[]; tabela: string; nao_coletado: string[]; verificacao_ausencia: string; arredondamento: string };
  brasil: {
    carteira_pf: Record<Segmento, number | null>;
    taxa: Record<Segmento, number | null>;
    ltv: Record<Segmento, number | null>;
    parcela: Record<Segmento, number | null>;
    inad: Record<Segmento, number | null>;
    direcionamento: { aquisicao: number | null; construcao: number | null; reforma_ampliacao: number | null };
    series: { carteira: ({ d: string } & Record<string, number | null>)[] };
  };
  estados: Estado[];
  instituicoes: { nome: string; saldo: number; part_nacional: number; municipios: number; ql_mediano?: number | null }[];
  nomesInstituicoes: string[];
  concentracao: { instituicoes_total: number; instituicoes_ate_2_municipios: number; saldo_dessas: number; part_dessas: number; leitura: string };
  verbete169: { contas: { conta: string; titulo: string; funcao: string; habitacional: boolean | null }[]; nao_distingue: string[]; fonte: string; alerta: string; invercao_cosif: string };
  totais: { estban169: number; municipios_com_saldo: number; municipios_sem_dependencia: number; instituicoes_no_169: number; mediana_saldo_por_domicilio: number };
  modelos: {
    penetracao: { criterio: string; referencia: string; grupos: number; municipios_cobertos: number; municipios_abaixo: number; lacuna_domicilios: number; aviso: string };
    saldo: { n: number; r2: number; sigma: number; especificacao: string; referencia: string; lacuna_total: number; municipios_abaixo: number; faixa: string; aviso: string };
  };
  rankings: { maior_lacuna_saldo: ItemRanking[]; maior_lacuna_domicilios: ItemRanking[] };
  simulador: { partida: { valor_imovel: number; ltv_pct: number; taxa_aa_pct: number; prazo_meses: number }; formulas: Record<string, string>; avisos: string[] };
  achados: { t: string; d: string; selo: Selo }[];
  matriz: { pergunta: string; status: "viavel" | "parcial" | "indisponivel"; fonte: string; obs: string }[];
  dicionario: { t: string; selo: Selo; d: string; f: string; l: string }[];
  limitacoes: string[];
};

export function dadosMoradia(): DadosMoradia | { indisponivel: string } {
  const g = lerPublico("obs", "data", "gold", "moradia.json");
  if (!g?.ok) return { indisponivel: String(g?.error ?? g?.motivo ?? "A publicação de moradia e crédito habitacional não está disponível nesta versão.") };
  return {
    geradoEm: String(g.gerado_em),
    datas: g.datas,
    censo: g.censo,
    brasil: g.brasil,
    estados: g.estados,
    instituicoes: g.instituicoes,
    nomesInstituicoes: g.nomes_instituicoes ?? [],
    concentracao: g.concentracao_contabil,
    verbete169: g.verbete169,
    totais: g.totais,
    modelos: g.modelos,
    rankings: g.rankings,
    simulador: g.simulador,
    achados: g.achados ?? [],
    matriz: g.matriz_viabilidade ?? [],
    dicionario: g.dicionario ?? [],
    limitacoes: g.limitacoes ?? [],
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * As três somas sobre as 27 UFs que a vista antiga fazia para pôr as medidas lado a lado (carteira de pessoa física do Mercado
 * Imobiliário, exposição de pessoa física no SCR e número de operações no SCR). UF sem valor não entra na soma.
 */
export function somasPorUf(d: DadosMoradia): { carteiraMi: number; exposicaoScr: number; operacoesScr: number } {
  const soma = (k: "mi_carteira_pf" | "scr_imob_pf" | "scr_operacoes") => d.estados.reduce((s, e) => s + (e[k] ?? 0), 0);
  return { carteiraMi: soma("mi_carteira_pf"), exposicaoScr: soma("scr_imob_pf"), operacoesScr: soma("scr_operacoes") };
}

/** Data-base da gold na forma da página: "2026-08-31" e "2026-06" viram "ago/2026" e "jun/2026". */
export const base = (iso: string) => mesAno(iso);

/**
 * Texto que vem da gold, na forma da página: data e mês no padrão brasileiro e travessão trocado por vírgula. Nenhum número muda.
 */
export function textoDaGold(t: string): string {
  return t
    .replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (_, a, m, d) => `${d}/${m}/${a}`)
    .replace(/\b((?:19|20)\d{2})-(0[1-9]|1[0-2])\b/g, (_, a, m) => mesAno(`${a}-${m}`))
    .replace(/\s+[—–]\s+/g, ", ")
    .replace(/^[—–]$/, "");
}

/** Fração escrita por extenso ("um terço", "metade"): a página só a mostra se vier do número; a gold já publicou uma que não confere. */
export const FRACAO_POR_EXTENSO = /\b(?:um|uma|dois|duas|três)\s+(?:terços?|quartos?|quintos?|sextos?|décimos?)\b|\b(?:a\s+)?metade\b/i;
const frases = (t: string) => t.split(/(?<=[.!?])\s+/).filter(Boolean);
const pct = (v: number, casas: number) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;

/**
 * A frase da concentração contábil, montada do número. A gold publica `concentracao_contabil.part_dessas` (26,23 na publicação de
 * 10/11/2026) e, no texto `leitura` e no achado correspondente, escreve "Um terço do saldo": a frase da gold está errada e deve ser
 * corrigida no pipeline (auditoria de 10/11/2026, achado 2). Até lá, a página monta o título do percentual publicado e aproveita da
 * gold só as frases que não trazem fração por extenso.
 */
export function leituraDaConcentracao(d: DadosMoradia): { titulo: string; complemento: string } {
  return {
    titulo: `${pct(d.concentracao.part_dessas, 1)} do saldo está escriturado em um ou dois municípios`,
    complemento: frases(d.concentracao.leitura).filter((f) => !FRACAO_POR_EXTENSO.test(f)).join(" "),
  };
}

/**
 * Os achados como a página os mostra (auditoria de 10/11/2026, achados 2 e 9). O texto vem da gold; três correções ficam na exibição
 * até o pipeline corrigir a origem, todas com a medida que a própria gold publica e nenhum número novo:
 * - fração por extenso que o número desmente vira o percentual publicado (ver `leituraDaConcentracao`);
 * - título com superlativo que a página não demonstra ("menor inadimplência do país": a página não compara com outras modalidades de
 *   crédito, e a própria gold traz FGTS e home equity com inadimplência maior) vira a medida, com os dois segmentos que o texto cita;
 * - advérbio de juízo ("apenas", "quase nunca") sai, e o título passa a dizer o que os valores do texto mostram.
 */
export function achadosExibidos(d: DadosMoradia): DadosMoradia["achados"] {
  const inad = d.brasil.inad;
  const dir = d.brasil.direcionamento;
  return d.achados.map((a) => {
    let t = a.t;
    let texto = a.d;
    if (FRACAO_POR_EXTENSO.test(t) || FRACAO_POR_EXTENSO.test(texto) || texto === d.concentracao.leitura) {
      const c = leituraDaConcentracao(d);
      t = c.titulo;
      texto = `${d.concentracao.instituicoes_ate_2_municipios} das ${d.concentracao.instituicoes_total} instituições com saldo no verbete 169 contabilizam em no máximo dois municípios. ${c.complemento}`.trim();
    }
    if (/\b(?:menor|maior|melhor|pior)\b.*\bdo país\b/i.test(t) && typeof inad.sfh === "number" && typeof inad.livre === "number")
      t = `Inadimplência de ${pct(inad.sfh, 2)} no SFH e de ${pct(inad.livre, 2)} nas taxas de mercado`;
    if (/\bquase nunca\b/i.test(t)) {
      const [aq, co, re] = [dir.aquisicao, dir.construcao, dir.reforma_ampliacao];
      t = typeof aq === "number" && typeof co === "number" && typeof re === "number" && aq > co && aq > re ? "A aquisição recebe mais recursos da poupança que a construção e a reforma" : "Como se dividem os recursos da poupança aplicados em habitação";
    }
    const semJuizo = (x: string) => x.replace(/\b(?:apenas|somente|só)\s+(?=\d)/gi, "");
    return { ...a, t: semJuizo(t), d: semJuizo(texto) };
  });
}

type Base = "censo" | "estban" | "mi" | "scr";

const ORIGEM: Record<Base, { orgao: string; dataset: string; url: string; frequencia: string }> = {
  censo: { orgao: "IBGE", dataset: "Censo Demográfico 2022, tabela 9930 (condição de ocupação do domicílio)", url: "https://sidra.ibge.gov.br/tabela/9930", frequencia: "decenal" },
  estban: { orgao: "Banco Central do Brasil", dataset: "Estatística Bancária Mensal por município (ESTBAN), verbete 169", url: "https://www.bcb.gov.br/estatisticas/estatisticabancariamunicipios", frequencia: "mensal" },
  mi: { orgao: "Banco Central do Brasil", dataset: "Informações do Mercado Imobiliário", url: "https://www.bcb.gov.br/estatisticas/mercadoimobiliario", frequencia: "mensal" },
  scr: { orgao: "Banco Central do Brasil", dataset: "SCR.data, carteira de crédito por UF e modalidade", url: "https://www.bcb.gov.br/estabilidadefinanceira/scrdata", frequencia: "mensal" },
};

/** Proveniência de uma figura, por base de origem; a captura mostrada é a data de processamento da gold. */
export function provMoradia(
  d: DadosMoradia,
  qual: Base,
  o: { indicador: string; natureza: Natureza; unidade: string; inicio: string; fim: string; limitacoes: string[]; formula?: string | null; transformacoes?: string[] },
): Proveniencia {
  const f = ORIGEM[qual];
  return provenienciaMontada({
    indicador: o.indicador,
    natureza: o.natureza,
    orgao: f.orgao,
    dataset: f.dataset,
    url: f.url,
    unidade: o.unidade,
    frequencia: f.frequencia,
    inicio: o.inicio,
    fim: o.fim,
    capturadoEm: d.geradoEm,
    transformacoes: o.transformacoes ?? [],
    formula: o.formula ?? null,
    limitacoes: [...o.limitacoes, "A gold de moradia não registra captura separada nem o hash do arquivo original; a data mostrada como captura é a do processamento da publicação."],
    versaoPipeline: "pipeline do Observatório de Crédito (moradia.json)",
  });
}
