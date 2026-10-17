import type { Acionista, CompanhiaAberta } from "./tipos";
import { inteiro, numero } from "./formato";

/** Controle societário das companhias abertas (CVM, FRE): leitura da árvore de acionistas e rótulos de apresentação. */

export type LinhaSocietaria = { nivel: number; acima: string | null; no: Acionista };

/** A árvore em ordem de leitura, uma linha por acionista, com o acionista acima na cadeia de controle. */
export function achatar(c: CompanhiaAberta): LinhaSocietaria[] {
  const saida: LinhaSocietaria[] = [];
  const desce = (nos: Acionista[], nivel: number, acima: string | null) => {
    for (const no of nos) {
      saida.push({ nivel, acima, no });
      desce(no.filhos, nivel + 1, no.nome);
    }
  };
  desce(c.acionistas, 1, null);
  return saida;
}

/** Acionistas diretos que a companhia declara como controladores. */
export function controladoresDiretos(c: CompanhiaAberta): Acionista[] {
  return c.acionistas.filter((a) => a.controlador);
}

export function nomeAcionista(a: Acionista): string {
  if (a.nome === "Ações Tesouraria") return "Ações em tesouraria";
  if (a.nome === "Outros") return "Outros acionistas";
  return a.nome;
}

/** Percentual com três casas, como publicado. Posição com ações mas arredondada a zero não vira "0,000%". */
export function pctSocietario(a: Acionista, campo: "pct_on" | "pct_pn" | "pct_total"): string {
  const v = a[campo];
  if (v == null) return "sem dado";
  if (campo === "pct_total" && v === 0 && (a.acoes ?? 0) > 0) return "menos de 0,001%";
  return `${numero(v, 3)}%`;
}

/** Texto curto do controlador declarado para a tabela do capítulo: nomes e participação no total e nas ordinárias. */
export function resumoControlador(c: CompanhiaAberta): string {
  const ctrl = controladoresDiretos(c);
  if (ctrl.length === 0) return "Nenhum controlador declarado";
  return ctrl.map((a) => `${a.nome} (${pctSocietario(a, "pct_total")} do capital total, ${pctSocietario(a, "pct_on")} das ordinárias)`).join("; ");
}

export function rotuloAcoes(a: Acionista): string | null {
  return a.acoes == null ? null : `${inteiro(a.acoes)} ações`;
}

/** A data de referência do arquivo da CVM é posterior ao recebimento do documento: não é a data da posição. */
export function referenciaPosteriorAoRecebimento(c: CompanhiaAberta): boolean {
  return c.documento.referencia > c.documento.recebido_em;
}
