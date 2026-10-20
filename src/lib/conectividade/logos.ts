import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Símbolos oficiais das operadoras da cobertura móvel (public/conectividade/logos/manifesto.json), lidos no build. A
 * cobertura da Anatel identifica a operadora só pelo nome; o manifesto liga cada nome a um CNPJ do cadastro da Anatel lido
 * pelo pipeline e diz como ("vinculo"). Sem o manifesto, ou com ele ilegível, o mapa sai vazio e as páginas mostram só o
 * nome. Item sem arquivo publicado em public/ sai como ausência, para a página nunca apontar para imagem inexistente.
 */

export type LogoOperadora = {
  operadora: string;
  cnpj: string | null;
  nome_exibicao: string;
  papel: "operadora";
  vinculo: string;
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

export type ManifestoLogosConectividade = { gerado_em: string; regras: string; logos: LogoOperadora[] };

export function lerManifestoLogosConectividade(raiz: string = process.cwd()): ManifestoLogosConectividade | null {
  try {
    return JSON.parse(readFileSync(join(raiz, "public", "conectividade", "logos", "manifesto.json"), "utf-8")) as ManifestoLogosConectividade;
  } catch {
    return null;
  }
}

export type LogoDaOperadora = { papel: string; arquivo: string | null; fundo: "claro" | "escuro" | null; largura: number | null; altura: number | null; motivo: string | null };

/** Logos por nome da operadora na cobertura da Anatel, no formato que `ListadasLogo` recebe; `papel` leva o CNPJ para marcar a imagem no HTML. */
export function logosConectividade(raiz: string = process.cwd()): Map<string, LogoDaOperadora> {
  const m = lerManifestoLogosConectividade(raiz);
  const pub = join(raiz, "public");
  const mapa = new Map<string, LogoDaOperadora>();
  for (const l of m?.logos ?? []) {
    const publicado = !!l.arquivo && existsSync(join(pub, l.arquivo.replace(/^\/+/, "")));
    mapa.set(l.operadora, {
      papel: l.cnpj ?? l.operadora.toLowerCase(),
      arquivo: publicado ? l.arquivo : null,
      fundo: l.fundo,
      largura: l.largura,
      altura: l.altura,
      motivo: publicado ? null : (l.ausencia?.motivo ?? "arquivo do manifesto não publicado"),
    });
  }
  return mapa;
}
