import type { RespostaBusca } from "./buscar";

/**
 * Frases da busca que dizem o que o motor fez com o termo (diagnóstico da busca de 23/10/2026, achados A1 e A5), as mesmas no
 * campo (BuscaPlataforma) e na página /buscar: o resultado parcial diz por quais palavras chegou ao mais próximo, e a correção
 * diz com que palavra a busca rodou.
 */

/** "“juros” e “cartão”": as palavras entre aspas, na ordem em que foram digitadas. */
export function listaDePalavras(palavras: string[]): string {
  const entre = palavras.map((p) => `“${p}”`);
  if (entre.length <= 1) return entre.join("");
  return `${entre.slice(0, -1).join(", ")} e ${entre[entre.length - 1]}`;
}

/** As palavras que casaram em algum resultado do parcial, na ordem do termo digitado. */
export function palavrasDoParcial(resposta: RespostaBusca): string[] {
  const vistas = Array.from(new Set(resposta.resultados.flatMap((r) => r.casou ?? [])));
  const termo = resposta.termo.toLowerCase();
  return vistas.sort((a, b) => termo.indexOf(a.toLowerCase()) - termo.indexOf(b.toLowerCase()));
}

/** Rótulo do resultado parcial: "Nenhuma página tem todas as palavras. O mais próximo, por “juros” e “cartão”:". */
export function rotuloDoParcial(resposta: RespostaBusca): string {
  return `Nenhuma página tem todas as palavras. O mais próximo, por ${listaDePalavras(palavrasDoParcial(resposta))}:`;
}
