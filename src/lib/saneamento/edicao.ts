import meta from "../../../public/saneamento/gold/meta.json";

const sinisa = {
  edicao: meta.sinisa.edicao,
  ano_referencia: meta.sinisa.ano_referencia,
};

/**
 * Onda S1, 25/10/2026: edição é a publicação, não o ano dos dados.
 * A mesma proveniência alimenta servidor, navegador, metadados e CSV da interface.
 */
export type EdicaoSinisa = { edicao: string | null; ano_referencia: number };

export function rotuloSinisa(
  forma: "completa" | "curta" | "ano" | "edicao" = "completa",
  fonte: EdicaoSinisa = sinisa,
): string {
  const edicao = fonte.edicao ?? "SINISA, edição não informada";
  if (forma === "ano") return String(fonte.ano_referencia);
  if (forma === "edicao") return edicao;
  return forma === "curta"
    ? `${edicao} (ref. ${fonte.ano_referencia})`
    : `${edicao}, ano de referência ${fonte.ano_referencia}`;
}

/**
 * Notas legadas deste recorte usam o nome errado para a referência 2024.
 * Aplicar só a essas notas conhecidas, nunca a uma referência histórica à edição 2024 (dados de 2023).
 * O arquivo original permanece íntegro para auditoria e reprodução.
 */
export function apresentarEdicaoSinisa(texto: string): string {
  return texto.replace(/\bSINISA 2024\b/g, rotuloSinisa());
}
