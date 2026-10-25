import type { Grau, TipoFonte } from "./contratos-base";

/**
 * Onda S1, 25/10/2026: traduz o grau sem promover imprensa a documento oficial.
 * A gold registra páginas de imprensa como V quando foram abertas e conferidas.
 */
export function rotuloConferencia(grau: Grau, tipoFonte?: TipoFonte): string {
  if (grau === "S") return "só em fonte secundária";
  return tipoFonte === "documento_oficial" || tipoFonte === "noticia_oficial"
    ? "conferido na fonte oficial"
    : "conferido na fonte consultada";
}

/**
 * Onda S1, 25/10/2026: notas de auditoria em linguagem pública, sem editar o seed.
 * Remove apenas marcas de inclusão na pesquisa; mantém valores, fontes e ressalvas.
 * Uma sigla V sem tipo de fonte não autoriza chamar aquela fonte de oficial.
 */
export function apresentarNotaContratado(nota: string): string {
  return nota
    .replace(/\bLinha extra\s*(?:\([^)]*\))?\s*[,.;]?\s*/gi, "")
    .replace(/\(\s*pedido\s*:[^)]*\)/gi, "")
    .replace(/\bDIVERGÊNCIA\s*:/g, "Fontes divergem:")
    .replace(/\bDIVERGÊNCIA entre fontes, não consolidar:/g, "Fontes divergem; valores não consolidados:")
    .replace(/\bDIVERGÊNCIA com a lista original\s*\(([^)]+)\):/g, "Fontes divergem sobre a data, antes registrada como $1:")
    .replace(/\(provavelmente\s+[^)]*\)/gi, "(valor não confirmado na fonte)")
    .replace(/\bprovavelmente\s+([^;)]+)/gi, "$1, identificação não confirmada na fonte")
    .replace(/grau declarado na pesquisa:\s*/gi, "Conferência das fontes: ")
    .replace(/\bgrau\s+([VS])\b/g, (_, grau: Grau) => rotuloConferencia(grau))
    .replace(new RegExp("(?<![\\p{L}\\p{N}_])([VS])(?![\\p{L}\\p{N}_])", "gu"), (_, grau: Grau) => rotuloConferencia(grau))
    .replace(/;\s*[.;]/g, ";")
    .replace(/\s+/g, " ")
    .replace(/^[\s;,.]+|[\s;]+$/g, "")
    .trim();
}
