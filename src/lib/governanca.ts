/**
 * Página /sobre/governanca: a Constituição editorial (docs/CONSTITUICAO.md)
 * publicada a partir do próprio arquivo, sem cópia que possa divergir.
 *
 * Decisão do mantenedor (14/10/2026): o texto público não nomeia as entidades
 * em que o responsável ocupa cargos. As omissões são trechos exatos; se a
 * Constituição mudar e um trecho deixar de existir, a montagem falha no build
 * em vez de publicar o texto interno (src/tests/governanca.test.ts).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Bloco =
  | { tipo: "titulo"; texto: string }
  | { tipo: "artigo"; id: string; texto: string }
  | { tipo: "paragrafo"; texto: string }
  | { tipo: "lista"; ordenada: boolean; itens: string[] };

/** Trecho interno e sua forma pública. */
export const OMISSOES: readonly { de: string; para: string }[] = [
  {
    de: "2. FGC, garantias de depósito, regimes de resolução, liquidação ou intervenção.",
    para: "2. Garantias de depósito, regimes de resolução, liquidação ou intervenção.",
  },
  {
    de: "o dono do projeto é conselheiro do FGC e diretor da Associação Open Finance Brasil,",
    para: "o dono do projeto ocupa cargos de conselho e de diretoria em entidades do sistema financeiro,",
  },
];

export function textoPublico(interno: string): string {
  let t = interno;
  for (const o of OMISSOES) {
    if (!t.includes(o.de)) throw new Error(`Constituição mudou: trecho a omitir não encontrado: "${o.de}"`);
    t = t.replace(o.de, o.para);
  }
  return t;
}

/** Leitura do subconjunto de Markdown que a Constituição usa. */
export function blocos(md: string): Bloco[] {
  const out: Bloco[] = [];
  let lista: Extract<Bloco, { tipo: "lista" }> | null = null;
  for (const linha of md.split("\n")) {
    const l = linha.trim();
    const num = l.match(/^\d+\.\s+(.*)$/);
    const marca = l.match(/^[-*]\s+(.*)$/);
    if (num || marca) {
      const ordenada = Boolean(num);
      if (!lista || lista.ordenada !== ordenada) {
        lista = { tipo: "lista", ordenada, itens: [] };
        out.push(lista);
      }
      lista.itens.push((num ?? marca)![1]);
      continue;
    }
    lista = null;
    if (!l) continue;
    const art = l.match(/^##\s+(Art\.\s*(\d+)\..*)$/);
    if (art) out.push({ tipo: "artigo", id: `art-${art[2]}`, texto: art[1] });
    else if (l.startsWith("# ")) out.push({ tipo: "titulo", texto: l.slice(2) });
    else out.push({ tipo: "paragrafo", texto: l });
  }
  return out;
}

export function constituicaoPublica(): Bloco[] {
  const interno = readFileSync(join(process.cwd(), "docs", "CONSTITUICAO.md"), "utf-8");
  return blocos(textoPublico(interno));
}
