/**
 * Dados institucionais da plataforma, lidos de config/institucional.json.
 * Campo vazio é decisão pendente do mantenedor: quem consome não renderiza a
 * seção e não inventa texto no lugar (src/tests/institucional.test.ts).
 */
import bruto from "../../config/institucional.json";

export type MembroConselho = { nome: string; afiliacao?: string };

export type Institucional = {
  mantenedor: { nome: string; natureza_juridica: string };
  financiamento: string;
  conflitos_de_interesse: string;
  email_institucional: string;
  conselho_consultivo: MembroConselho[];
  api: { aviso_previo_quebra_dias: number | null };
  dados: { licenca_derivados: string };
  zenodo: { criadores: { nome: string; afiliacao?: string; orcid?: string }[]; comunidade: string; doi_conceito: string };
};

export const INSTITUCIONAL = bruto as unknown as Institucional;

/** Texto preenchido de verdade (não vazio, não só espaços). */
export const preenchido = (s: string | null | undefined): s is string => typeof s === "string" && s.trim().length > 0;
