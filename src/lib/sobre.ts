/**
 * Página /sobre: seções institucionais montadas a partir de config/institucional.json
 * e de fatos do próprio código (política de correção, como citar, contato).
 * Seção de decisão do mantenedor sem conteúdo não é renderizada: nada é inventado.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type Institucional, INSTITUCIONAL, preenchido } from "./institucional";
export { contato, type Contato } from "./contato";

export type Secao = { id: string; titulo: string; paragrafos: string[]; itens?: string[] };

/** Seções que dependem de decisão do mantenedor; vazias, somem. */
export function secoesInstitucionais(inst: Institucional = INSTITUCIONAL): Secao[] {
  const s: Secao[] = [];
  const m = inst.mantenedor;
  if (preenchido(m.nome)) {
    s.push({ id: "quem-mantem", titulo: "Quem mantém", paragrafos: [preenchido(m.natureza_juridica) ? `${m.nome} (${m.natureza_juridica}).` : `${m.nome}.`] });
  }
  if (preenchido(inst.financiamento)) s.push({ id: "financiamento", titulo: "Financiamento", paragrafos: [inst.financiamento] });
  if (preenchido(inst.conflitos_de_interesse)) {
    s.push({ id: "independencia", titulo: "Independência e conflitos de interesse", paragrafos: [inst.conflitos_de_interesse] });
  }
  const conselho = (inst.conselho_consultivo ?? []).filter((c) => preenchido(c.nome));
  if (conselho.length) {
    s.push({
      id: "conselho",
      titulo: "Conselho consultivo",
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

export function registroErros(): { descricao: string; erros: ErroRegistrado[] } {
  const r = JSON.parse(readFileSync(join(process.cwd(), "pesquisa", "registro_erros.json"), "utf-8"));
  return { descricao: String(r.descricao ?? ""), erros: (r.erros ?? []) as ErroRegistrado[] };
}

/** Data ISO para dd/mm/aaaa; nulo é "não apurado", nunca estimado (regra do próprio registro). */
export const dataOuNaoApurado = (d: string | null | undefined) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "não apurado");
