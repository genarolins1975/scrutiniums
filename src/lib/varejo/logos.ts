/**
 * Símbolos oficiais das empresas da coleção Varejo (public/varejo/logos/manifesto.json), lidos somente no servidor. O manifesto
 * é escrito por pipeline/varejo/logos.py: uma entrada por entidade, com o arquivo oficial e a prova do vínculo, ou a ausência
 * com o motivo. Sem o manifesto, com ele ilegível ou com o arquivo fora de public/, a resposta é null e a página mostra o nome
 * em texto: nunca aponta para imagem inexistente.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const ARQUIVO_LOGOS = join("public", "varejo", "logos", "manifesto.json");
export const PASTA_LOGOS = "/varejo/logos/";

export type FundoLogo = "claro" | "escuro";

export type EntradaLogoVarejo = {
  slug: string;
  nome_exibicao: string;
  papel: string;
  cnpj: string | null;
  vinculo: string | null;
  nota: string | null;
  arquivo: string | null;
  formato: "svg" | "png" | "webp" | null;
  fundo: FundoLogo | null;
  largura: number | null;
  altura: number | null;
  url_origem: string | null;
  pagina_origem: string | null;
  capturado_em: string | null;
  sha256: string | null;
  bytes: number | null;
  metodo: "direto" | "extraido" | "navegador" | null;
  extraido_de: { url: string; sha256: string; bytes: number } | null;
  derivado_de: string | null;
  ausencia: { motivo: string } | null;
};

export type ManifestoLogosVarejo = { versao: number; gerado_em: string; regras: string; logos: EntradaLogoVarejo[] };

export type LogoVarejo = { arquivo: string; largura: number; altura: number; fundo: FundoLogo; nomeExibicao: string };

export function lerManifestoLogosVarejo(raiz: string = process.cwd()): ManifestoLogosVarejo | null {
  try {
    const m = JSON.parse(readFileSync(join(raiz, ARQUIVO_LOGOS), "utf-8")) as Partial<ManifestoLogosVarejo>;
    return Array.isArray(m.logos) ? (m as ManifestoLogosVarejo) : null;
  } catch {
    return null;
  }
}

let cache: Map<string, LogoVarejo> | null = null;

function publicados(): Map<string, LogoVarejo> {
  if (cache) return cache;
  const mapa = new Map<string, LogoVarejo>();
  const raiz = process.cwd();
  for (const l of lerManifestoLogosVarejo(raiz)?.logos ?? []) {
    // só o que o contrato permite servir: arquivo da própria pasta, com prova de vínculo, medidas e tom do fundo
    if (!l.arquivo || l.ausencia || !l.vinculo || !l.largura || !l.altura) continue;
    if (l.fundo !== "claro" && l.fundo !== "escuro") continue;
    if (!/^\/varejo\/logos\/[a-z0-9-]+\.(svg|png|webp)$/.test(l.arquivo)) continue;
    if (!existsSync(join(raiz, "public", l.arquivo.replace(/^\/+/, "")))) continue;
    mapa.set(l.slug, { arquivo: l.arquivo, largura: l.largura, altura: l.altura, fundo: l.fundo, nomeExibicao: l.nome_exibicao });
  }
  cache = mapa;
  return mapa;
}

/** O logo oficial de uma entidade da coleção, ou null quando não há arquivo publicado com vínculo provado. */
export function logoDe(slug: string): LogoVarejo | null {
  return publicados().get(slug) ?? null;
}
