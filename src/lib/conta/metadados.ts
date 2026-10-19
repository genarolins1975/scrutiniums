/**
 * Datas e identificadores de publicação de cada fonte de dados, lidos em tempo
 * de requisição (somente servidor). Usados pelo "Citar" (/api/conta/citacao) e
 * pelo disparo dos alertas (/api/alertas/enviar). Os arquivos lidos são os de
 * src/lib/frescor/limiares.json e os manifestos abaixo; next.config.mjs os
 * inclui no pacote das duas rotas (teste conta-ferramentas).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import limiares from "@/lib/frescor/limiares.json";
import { extrairFrescor, IDS_DOMINIOS, type DadosFrescor, type DominioFrescorId } from "@/lib/frescor/regras";
import { INSTITUCIONAL, preenchido } from "@/lib/institucional";
import type { FonteCitacao } from "./citar";

/** Manifestos que declaram `id_publicacao` (sha256 da lista de arquivos publicados). */
export const MANIFESTOS: Partial<Record<DominioFrescorId, string>> = {
  energia: "public/energia/gold/manifesto.json",
};

export type Leitor = (arquivo: string) => unknown;

export const lerDoDisco: Leitor = (arquivo) => JSON.parse(readFileSync(join(process.cwd(), arquivo), "utf-8"));

/** Todos os arquivos que as rotas leem: a lista de tracing das rotas em next.config.mjs é conferida contra esta. */
export function arquivosLidos(): string[] {
  const dominios = limiares.dominios as Record<string, { publicacao: { arquivo: string }[]; partes?: { arquivo: string }[]; referencia: { arquivo: string }[] }>;
  const s = new Set<string>();
  for (const d of Object.values(dominios)) for (const o of [...d.publicacao, ...(d.partes ?? []), ...d.referencia]) s.add(o.arquivo);
  for (const m of Object.values(MANIFESTOS)) if (m) s.add(m);
  return [...s].sort();
}

export function ehDominio(valor: unknown): valor is DominioFrescorId {
  return typeof valor === "string" && (IDS_DOMINIOS as string[]).includes(valor);
}

/** Datas de um domínio, lidas agora (sem cache: o disparo compara com o que está publicado neste deploy). */
export function frescorAgora(id: DominioFrescorId, ler: Leitor = lerDoDisco): DadosFrescor {
  return extrairFrescor(id, ler);
}

export function idPublicacao(id: DominioFrescorId, ler: Leitor = lerDoDisco): string | null {
  const arquivo = MANIFESTOS[id];
  if (!arquivo) return null;
  try {
    const m = ler(arquivo) as { id_publicacao?: unknown } | null;
    const v = m?.id_publicacao;
    return typeof v === "string" && /^[0-9a-f]{64}$/.test(v) ? v : null;
  } catch {
    return null;
  }
}

export function fontesCitacao(ids: readonly DominioFrescorId[], ler: Leitor = lerDoDisco): FonteCitacao[] {
  return ids.map((id) => {
    const f = frescorAgora(id, ler);
    return { id, referencia: f.referencia, publicadoEm: f.publicadoEm, idPublicacao: idPublicacao(id, ler) };
  });
}

/** DOI do depósito mensal no Zenodo (config/institucional.json); nulo enquanto o campo estiver vazio. */
export function doiDeposito(): string | null {
  const doi = INSTITUCIONAL.zenodo.doi_conceito;
  return preenchido(doi) ? doi.trim() : null;
}
