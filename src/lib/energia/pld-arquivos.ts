import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Evidencia } from "./evidencia";
import type { EvidenciaPld, PldEvidenciasArquivo, PldHorarioRecenteArquivo } from "./tipos-pld";

/**
 * Leitura, no build, dos arquivos do módulo PLD que ficam fora da gold
 * (public/energia/series/pld_*.json). Só para Server Components: as páginas
 * passam aos componentes cliente apenas o recorte que mostram.
 *
 * Por que as fichas de prova vão na página do painel, e não por fetch ao abrir:
 * cada painel usa de 4 a 9 fichas (de 3 a 5 KB cada, de 20 a 40 KB por página),
 * bem abaixo da meta de 600 KB do contrato (seção 5.1), e o "Comprove este
 * número" compartilhado recebe a ficha pronta. O arquivo inteiro (27 fichas,
 * cerca de 117 KB) nunca vai para uma página só. A janela das últimas 168 horas
 * (26 KB) vai inteira para os dois painéis que a mostram; o mapa hora × dia
 * (95 KB) é lido no navegador só quando o mapa é aberto.
 *
 * Arquivo ausente ou ilegível devolve null: a página diz o que falta.
 */
const DIR = join(process.cwd(), "public");

function ler<T>(url: string): T | null {
  // só os arquivos do próprio módulo, sem sair de public/energia/series
  if (!/^\/energia\/series\/pld_[a-z_]+\.json$/.test(url)) return null;
  try {
    return JSON.parse(readFileSync(join(DIR, url), "utf-8")) as T;
  } catch {
    return null;
  }
}

/** Fichas pedidas, na ordem pedida; ficha ausente no arquivo fica fora (o KPI mostra o número sem a prova e o motivo). */
export function fichasPld(url: string, ids: readonly string[]): Record<string, Evidencia> {
  const arq = ler<PldEvidenciasArquivo>(url);
  const saida: Record<string, Evidencia> = {};
  if (!arq) return saida;
  for (const id of ids) {
    const f: EvidenciaPld | undefined = arq.evidencias[id];
    // a ficha do PLD tem campos a mais nos arquivos (endereço oficial, cópia lida, nível de conferência do ato): é um superconjunto da compartilhada
    if (f) saida[id] = f as unknown as Evidencia;
  }
  return saida;
}

export function horarioRecentePld(url: string): PldHorarioRecenteArquivo | null {
  return ler<PldHorarioRecenteArquivo>(url);
}
