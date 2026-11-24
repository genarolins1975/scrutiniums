import type { PerfilCem } from "@/lib/varejo/dados";

/**
 * Nomes e explicações das partes do cupom de R$ 100, num módulo sem "use client": o cupom interativo (Cupom.tsx, cliente) e as
 * figuras de servidor (CuponsLadoALado.tsx) leem daqui. Constante exportada de um módulo de cliente não pode ser lida no servidor.
 */

/** O que cada parte é, em palavras de quem nunca leu um balanço. */
export const EXPLICA: Record<PerfilCem["partes"][number]["id"], string> = {
  custo: "O que a loja pagou ao fornecedor pelas mercadorias que vendeu.",
  despesas: "Salários, aluguel, energia, entrega, propaganda e administração.",
  financeiro: "Juros da dívida e dos aluguéis de longo prazo, menos o que o caixa rendeu.",
  impostos: "Imposto de renda e contribuição social sobre o lucro do ano.",
  outros: "Negócios que a companhia encerrou ou vendeu, e arredondamentos.",
  lucro: "O que sobra para os donos depois de tudo.",
};

export const NOME_CURTO: Record<PerfilCem["partes"][number]["id"], string> = {
  custo: "Mercadoria",
  despesas: "Operação da loja",
  financeiro: "Juros",
  impostos: "Imposto sobre o lucro",
  outros: "Encerradas e outros",
  lucro: "Lucro",
};

