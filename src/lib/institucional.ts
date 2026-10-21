/**
 * Dados institucionais da plataforma, lidos de config/institucional.json.
 * Campo vazio é decisão pendente do mantenedor: quem consome não renderiza a
 * seção e não inventa texto no lugar (src/tests/institucional.test.ts).
 */
import bruto from "../../config/institucional.json";
import type { Idioma } from "./idioma";

export type MembroConselho = { nome: string; afiliacao?: string };

export type Institucional = {
  mantenedor: { nome: string; natureza_juridica: string };
  financiamento: string;
  conflitos_de_interesse: string;
  email_institucional: string;
  conselho_consultivo: MembroConselho[];
  api: { aviso_previo_quebra_dias: number | null };
  dados: { licenca_id: string; licenca_derivados: string };
  zenodo: { criadores: { nome: string; afiliacao?: string; orcid?: string }[]; comunidade: string; doi_conceito: string };
  /** Tradução de cortesia dos textos acima, para as páginas em inglês. */
  en?: { natureza_juridica?: string; financiamento?: string; conflitos_de_interesse?: string; licenca_derivados?: string };
};

/** Textos institucionais no idioma da página; em inglês, a tradução de cortesia do mesmo campo. */
export function textosInstitucionais(inst: Institucional, idioma: Idioma) {
  if (idioma === "pt") {
    return { natureza_juridica: inst.mantenedor.natureza_juridica, financiamento: inst.financiamento, conflitos_de_interesse: inst.conflitos_de_interesse, licenca_derivados: inst.dados.licenca_derivados };
  }
  const en = inst.en ?? {};
  return { natureza_juridica: en.natureza_juridica ?? "", financiamento: en.financiamento ?? "", conflitos_de_interesse: en.conflitos_de_interesse ?? "", licenca_derivados: en.licenca_derivados ?? "" };
}

export const INSTITUCIONAL = bruto as unknown as Institucional;

/** Texto preenchido de verdade (não vazio, não só espaços). */
export const preenchido = (s: string | null | undefined): s is string => typeof s === "string" && s.trim().length > 0;
