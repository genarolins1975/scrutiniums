/** Nomes de modalidade do BCB (txjuros): endereço, rótulo e natureza. Código puro, usado no servidor e no navegador. */

/** Endereço curto e estável da modalidade: "aquisicao-de-veiculos-prefixado". */
export function slugModalidade(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Rótulo da modalidade sem o regime de taxa, e o regime à parte: "Aquisição de veículos" e "Prefixado". */
export function partesDaModalidade(nome: string): { produto: string; regime: string | null } {
  const corte = nome.lastIndexOf(" - ");
  if (corte < 0) return { produto: nome, regime: null };
  return { produto: nome.slice(0, corte), regime: nome.slice(corte + 3) };
}

/** Modalidade pós-fixada: o custo final acompanha um indexador que a taxa publicada não antecipa. */
export function ehPosFixada(nome: string): boolean {
  return /p[óo]s-fixado/i.test(nome);
}

/**
 * Modalidades que, pela forma de cobrança, não costumam ser pagas em parcelas iguais (crédito rotativo,
 * limite de conta, desconto e antecipação de recebíveis, adiantamento de câmbio). O simulador avisa.
 */
export function naoEhParcelada(nome: string): boolean {
  return /cheque especial|rotativo|conta garantida|desconto de|adiantamento sobre contratos|antecipa[çc][ãa]o de faturas|vendor/i.test(nome);
}

/** Rótulo de leitura: "Aquisição de veículos (prefixado)". */
export function rotuloModalidade(nome: string): string {
  const { produto, regime } = partesDaModalidade(nome);
  return regime ? `${produto} (${regime.charAt(0).toLowerCase()}${regime.slice(1)})` : produto;
}
