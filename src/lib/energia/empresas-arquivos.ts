import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Evidencia } from "./evidencia";
import { lerGold } from "./gold";
import { ROTULO_ALERTA as ROTULO_ALERTA_PERDAS } from "./perdas";
import type { ArvoreSocietaria } from "./empresas";
import { arvoreDe, evolucaoPerdas, evolucaoQualidade, evolucaoTarifa, type PontoPerdas, type PontoQualidade, type PontoTarifa } from "./empresas";
import type { CadeiaSocietaria, Distribuidoras, EvidenciasEmpresas, SeriesFinanceiras } from "./tipos-empresas";

/**
 * Leitura, no build, dos arquivos que ficam fora da gold do módulo Empresas
 * (public/energia/series/empresas_*.json) e das séries por distribuidora que as golds de
 * origem publicam (Perdas, Qualidade e Conta de luz). Só para Server Components: a página
 * passa aos componentes cliente apenas o recorte que mostra (a árvore de um CNPJ, as séries
 * de uma companhia, a evolução de uma distribuidora, uma ficha de prova).
 *
 * Por que no build e não por fetch: a ficha de cada distribuidora mostra só a própria série
 * (alguns KB), e o arquivo inteiro (até 2,9 MB) nunca vai para a página. Os painéis da página
 * principal leem os arquivos inteiros no navegador só quando a pessoa escolhe outra entidade.
 *
 * Arquivo ausente ou ilegível devolve null: a página diz o que falta, nunca inventa a série.
 */
const DIR = join(process.cwd(), "public");
// só os arquivos de séries do próprio módulo e as séries por distribuidora das golds de origem
const PERMITIDOS = /^\/energia\/series\/(empresas_[a-z_]+|perdas_anual|perdas_evidencias|qualidade_distribuidoras_serie|conta_historico_b1)\.json$/;

const cache = new Map<string, { mtime: number; dado: unknown }>();

export function lerSerie<T>(url: string | null | undefined): T | null {
  if (!url || !PERMITIDOS.test(url)) return null;
  try {
    const caminho = join(DIR, url);
    const mtime = statSync(caminho).mtimeMs;
    const c = cache.get(url);
    if (c && c.mtime === mtime) return c.dado as T;
    const dado = JSON.parse(readFileSync(caminho, "utf-8")) as T;
    cache.set(url, { mtime, dado });
    return dado;
  } catch {
    return null;
  }
}

/** Árvore societária de um CNPJ, montada do arquivo da cadeia (null sem arquivo ou sem o CNPJ). */
export function arvoreDoArquivo(url: string, cnpj: string): ArvoreSocietaria | null {
  const c = lerSerie<CadeiaSocietaria>(url);
  return c ? arvoreDe(c, cnpj) : null;
}

/** Séries financeiras só das companhias pedidas (o recorte que vai para a página). */
export function seriesFinanceirasDe(url: string, cnpjs: readonly string[]): SeriesFinanceiras["series"] | null {
  const s = lerSerie<SeriesFinanceiras>(url);
  if (!s) return null;
  const out: SeriesFinanceiras["series"] = {};
  for (const c of cnpjs) if (s.series[c]) out[c] = s.series[c];
  return out;
}

/** Ficha de prova da receita do último exercício de cada companhia pedida (ausente quando o arquivo não tem). */
export function evidenciasReceita(url: string, cnpjs: readonly string[]): Record<string, Evidencia> {
  const e = lerSerie<EvidenciasEmpresas>(url);
  const out: Record<string, Evidencia> = {};
  if (!e) return out;
  for (const c of cnpjs) if (e.evidencias[c]) out[c] = e.evidencias[c];
  return out;
}

export type EvolucaoDistribuidora = {
  perdas: PontoPerdas[];
  qualidade: PontoQualidade[];
  /** Mudança de perímetro publicada pela gold de Qualidade (anos). */
  quebrasQualidade: number[];
  tarifa: PontoTarifa[];
  /** Arquivos lidos, para o rodapé (o mesmo que a gold de origem publica). */
  arquivos: { modulo: "perdas" | "qualidade" | "tarifa"; url: string; disponivel: boolean }[];
};

type PerdasAnual = { campos: string[]; distribuidoras: Record<string, unknown[][]> };
type QualidadeSerie = { distribuidoras: Record<string, { anos: number[]; dec: (number | null)[]; fec: (number | null)[]; dec_limite: (number | null)[]; fec_limite: (number | null)[]; quebras?: number[] }> };
type ContaHistorico = { distribuidoras: Record<string, { vigencias: unknown[][] }> };

/**
 * Evolução própria de uma distribuidora, lida pelo CNPJ nas séries que as golds de origem
 * publicam (endereços e campos em distribuidoras.series_evolucao): a mesma consulta dos
 * módulos de origem, sem recálculo.
 */
export function evolucaoDistribuidora(se: Distribuidoras["series_evolucao"], cnpj: string): EvolucaoDistribuidora {
  const arquivos: EvolucaoDistribuidora["arquivos"] = [];
  let perdas: PontoPerdas[] = [];
  let qualidade: PontoQualidade[] = [];
  let quebrasQualidade: number[] = [];
  let tarifa: PontoTarifa[] = [];
  if (se.perdas) {
    const p = lerSerie<PerdasAnual>(se.perdas.url);
    arquivos.push({ modulo: "perdas", url: se.perdas.url, disponivel: !!p });
    if (p) perdas = evolucaoPerdas(p.distribuidoras[cnpj] as unknown[][] | undefined, p.campos ?? se.perdas.campos);
  }
  if (se.qualidade) {
    const q = lerSerie<QualidadeSerie>(se.qualidade.url);
    arquivos.push({ modulo: "qualidade", url: se.qualidade.url, disponivel: !!q });
    const s = q?.distribuidoras[cnpj];
    if (s) {
      qualidade = evolucaoQualidade(s);
      quebrasQualidade = s.quebras ?? [];
    }
  }
  if (se.tarifa) {
    const t = lerSerie<ContaHistorico>(se.tarifa.url);
    arquivos.push({ modulo: "tarifa", url: se.tarifa.url, disponivel: !!t });
    if (t) tarifa = evolucaoTarifa(t.distribuidoras[cnpj]?.vigencias, se.tarifa.campos);
  }
  return { perdas, qualidade, quebrasQualidade, tarifa, arquivos };
}

/**
 * Ficha de prova da taxa de perdas da distribuidora, publicada pelo módulo Perdas
 * (perdas_evidencias.json, endereço lido da própria gold de Perdas). Null quando o módulo não
 * publica a ficha daquele CNPJ: a página mostra o número com a proveniência, sem prova falsa.
 */
export function evidenciaPerdas(cnpj: string): { evidencia: Evidencia; ano: number } | null {
  const g = lerGold<{ series?: { evidencias?: string } }>("perdas.json");
  const e = lerSerie<{ ano: number; evidencias: Record<string, Evidencia> }>(g?.series?.evidencias ?? null);
  const ev = e?.evidencias[cnpj];
  return ev && e ? { evidencia: ev, ano: e.ano } : null;
}

/**
 * Alertas que o módulo Perdas publica para a taxa de perdas do ano de referência de um CNPJ (por exemplo, perda total negativa
 * ou energia fornecida maior que a injetada), com o rótulo que o próprio módulo usa. Vazio sem alerta ou sem o CNPJ.
 */
export function alertasDePerdas(cnpj: string): string[] {
  const g = lerGold<{ distribuidoras?: { cnpj: string; referencia?: { alertas?: string[] } | null }[] }>("perdas.json");
  const alertas = g?.distribuidoras?.find((x) => x.cnpj === cnpj)?.referencia?.alertas ?? [];
  return alertas.map((a) => (ROTULO_ALERTA_PERDAS as Record<string, string>)[a] ?? a);
}
