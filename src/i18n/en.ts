import type { pt } from "./pt";

type EntradaEn =
  | { readonly estado: "traduzido"; readonly texto: string }
  | { readonly estado: "portugues_marcado"; readonly motivo: string; readonly texto?: never };

export type DicionarioEn = { readonly [K in keyof typeof pt]: EntradaEn };

export const en = {
  "idioma.portugues": { estado: "traduzido", texto: "Portuguese" },
  "idioma.ingles": { estado: "traduzido", texto: "English" },
  "idioma.seletor": { estado: "traduzido", texto: "Language" },
  "traducao.portugues_apenas": { estado: "traduzido", texto: "Portuguese only" },
} as const satisfies DicionarioEn;
