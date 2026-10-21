import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Símbolos oficiais das companhias de saneamento (public/saneamento/logos/manifesto.json), lidos no build. O vínculo é o CNPJ
 * da companhia na CVM, nunca o nome. Sem o manifesto, ou com ele ilegível, o mapa sai vazio e as páginas mostram só o nome.
 * Item cujo arquivo não está publicado em public/ sai como ausência, para a página nunca apontar para imagem inexistente.
 */

export type LogoSaneamento = {
  cnpj: string;
  nome_exibicao: string;
  papel: "operadora" | "holding";
  arquivo: string | null;
  formato: "svg" | "png" | "jpg" | "webp" | null;
  fundo: "claro" | "escuro" | null;
  largura: number | null;
  altura: number | null;
  url_origem: string | null;
  pagina_origem: string | null;
  capturado_em: string | null;
  sha256: string | null;
  bytes: number | null;
  ausencia: { motivo: string } | null;
};

export type ManifestoLogosSaneamento = { gerado_em: string; regras: string; logos: LogoSaneamento[] };

export const soDigitos = (cnpj: string) => cnpj.replace(/\D/g, "");

export function lerManifestoLogosSaneamento(raiz: string = process.cwd()): ManifestoLogosSaneamento | null {
  try {
    return JSON.parse(readFileSync(join(raiz, "public", "saneamento", "logos", "manifesto.json"), "utf-8")) as ManifestoLogosSaneamento;
  } catch {
    return null;
  }
}

/** Logos por CNPJ (só dígitos), no formato que `ListadasLogo` recebe; `papel` leva o CNPJ para marcar a imagem no HTML. */
export function logosSaneamento(raiz: string = process.cwd()) {
  const m = lerManifestoLogosSaneamento(raiz);
  const pub = join(raiz, "public");
  const mapa = new Map<string, { papel: string; arquivo: string | null; fundo: "claro" | "escuro" | null; largura: number | null; altura: number | null }>();
  for (const l of m?.logos ?? []) {
    const publicado = !!l.arquivo && existsSync(join(pub, l.arquivo.replace(/^\/+/, "")));
    mapa.set(soDigitos(l.cnpj), {
      papel: soDigitos(l.cnpj),
      arquivo: publicado ? l.arquivo : null,
      fundo: l.fundo,
      largura: l.largura,
      altura: l.altura,
    });
  }
  return mapa;
}
