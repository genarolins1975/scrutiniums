/** Parâmetros inválidos nunca selecionam uma observação inexistente. */
export function resolverSelecaoGas(valor: string | null, opcoes: readonly string[], padrao: string) {
  const invalida = valor !== null && !opcoes.includes(valor);
  return { valor: valor !== null && !invalida ? valor : padrao, invalida };
}
