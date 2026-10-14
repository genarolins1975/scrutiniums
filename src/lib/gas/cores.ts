/**
 * Cores das figuras do gás, sempre por variável CSS (src/app/globals.css). Série focal no acento do domínio; referência neutra;
 * comparações de até quatro séries com a paleta validada de comparação do Setor Elétrico. Cor nunca é o único portador da série:
 * toda figura tem legenda ou rótulo direto e tabela equivalente.
 */
export const COR = {
  foco: "var(--cor-gas)",
  focoEscuro: "var(--cor-gas-dark)",
  referencia: "var(--serie-referencia)",
  comp: ["var(--serie-comp-1)", "var(--serie-comp-2)", "var(--serie-comp-3)", "var(--serie-comp-4)"],
} as const;

/** Escala sequencial do acento, da menor para a maior classe (mapas por UF). */
export const ESCALA_GAS = ["var(--escala-gas-1)", "var(--escala-gas-2)", "var(--escala-gas-3)", "var(--escala-gas-4)", "var(--escala-gas-5)"] as const;
