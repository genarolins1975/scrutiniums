/**
 * Página /sobre: seções institucionais montadas a partir de config/institucional.json
 * e de fatos do próprio código (política de correção, como citar, contato).
 * Seção de decisão do mantenedor sem conteúdo não é renderizada: nada é inventado.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type Institucional, INSTITUCIONAL, preenchido, textosInstitucionais } from "./institucional";
import type { Idioma } from "./idioma";
export { contato, type Contato } from "./contato";

export type Secao = { id: string; titulo: string; paragrafos: string[]; itens?: string[] };

const TITULOS: Record<Idioma, Record<"quem" | "financiamento" | "independencia" | "conselho", string>> = {
  pt: { quem: "Quem mantém", financiamento: "Financiamento", independencia: "Independência e conflitos de interesse", conselho: "Conselho consultivo" },
  en: { quem: "Who maintains it", financiamento: "Funding", independencia: "Independence and conflicts of interest", conselho: "Advisory board" },
};

/** Seções que dependem de decisão do mantenedor; vazias, somem. */
export function secoesInstitucionais(inst: Institucional = INSTITUCIONAL, idioma: Idioma = "pt"): Secao[] {
  const s: Secao[] = [];
  const m = inst.mantenedor;
  const t = textosInstitucionais(inst, idioma);
  const titulo = TITULOS[idioma];
  if (preenchido(m.nome)) {
    s.push({ id: "quem-mantem", titulo: titulo.quem, paragrafos: [preenchido(t.natureza_juridica) ? `${m.nome} (${t.natureza_juridica}).` : `${m.nome}.`] });
  }
  if (preenchido(t.financiamento)) s.push({ id: "financiamento", titulo: titulo.financiamento, paragrafos: [t.financiamento] });
  if (preenchido(t.conflitos_de_interesse)) {
    s.push({ id: "independencia", titulo: titulo.independencia, paragrafos: [t.conflitos_de_interesse] });
  }
  const conselho = (inst.conselho_consultivo ?? []).filter((c) => preenchido(c.nome));
  if (conselho.length) {
    s.push({
      id: "conselho",
      titulo: titulo.conselho,
      paragrafos: [],
      itens: conselho.map((c) => (preenchido(c.afiliacao) ? `${c.nome}, ${c.afiliacao}` : c.nome)),
    });
  }
  return s;
}

/* ------------------------------------------------------------------ */
/* Registro público de erros (pesquisa/registro_erros.json)            */
/* ------------------------------------------------------------------ */

export type ErroRegistrado = {
  id: string;
  superficie: string;
  descricao: string;
  tipo: string;
  gravidade: string;
  publicado: boolean;
  data_publicacao: string | null;
  data_deteccao: string | null;
  canal_deteccao: string | null;
  correcao: { data: string | null; onde: string | null } | null;
  fonte_registro?: string;
};

/**
 * Só entradas com `publicado: true`: as páginas dizem "erros publicados", e um erro
 * pego antes de chegar ao leitor não pode aparecer como se tivesse chegado.
 */
export function registroErros(): { descricao: string; erros: ErroRegistrado[] } {
  const r = JSON.parse(readFileSync(join(process.cwd(), "pesquisa", "registro_erros.json"), "utf-8"));
  const erros = ((r.erros ?? []) as ErroRegistrado[]).filter((e) => e.publicado === true);
  return { descricao: String(r.descricao ?? ""), erros };
}

/** Data ISO para dd/mm/aaaa; nulo é "não apurado", nunca estimado (regra do próprio registro). */
export const dataOuNaoApurado = (d: string | null | undefined) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "não apurado");
