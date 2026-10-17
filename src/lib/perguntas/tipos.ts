/**
 * Contrato das portas de entrada por pergunta ("O Brasil em perguntas").
 *
 * Cada porta reúne, numa pergunta que a população faz, os números que os
 * observatórios já publicam. Nenhum número é escrito à mão: todos são lidos
 * das golds no build, com fonte e período da própria base. Quando a leitura
 * falha, o número fica ausente e a página diz isso; ausência nunca vira zero.
 */
import type { Dominio } from "@/lib/dominios";

export type PortaId = "bolso" | "servicos" | "dinheiro-publico" | "energia" | "economia" | "territorio";

/** Número de manchete com a prova ao lado: medida, período, fonte e destino. */
export type NumeroPorta = {
  rotulo: string;
  /** Valor formatado no padrão brasileiro; ausente quando a base não pôde ser lida. */
  valor: string | null;
  unidade: string;
  periodo: string;
  fonte: string;
  /** Ressalva material que acompanha o número, quando houver. */
  nota?: string;
  /** Painel ou página de onde o número vem. */
  href: string;
};

/** Pergunta complementar e o lugar onde ela é respondida. */
export type CaminhoPorta = {
  pergunta: string;
  /** O que o leitor encontra no destino, em uma frase. */
  resumo: string;
  href: string;
  /** Observatório que mantém o destino. */
  observatorio: string;
};

export type Porta = {
  id: PortaId;
  /** Nome curto da porta, como aparece no cartão da home. */
  nome: string;
  pergunta: string;
  /** Uma frase sobre o que a porta cobre, sem juízo de valor. */
  resumo: string;
  acento: Dominio["acento"];
  /** Até três números; o primeiro é o destaque do cartão da home. */
  numeros: NumeroPorta[];
  caminhos: CaminhoPorta[];
  /** Perguntas da porta que a plataforma ainda não responde. */
  lacunas: string[];
  /** Páginas públicas de método dos observatórios que alimentam a porta. */
  metodos: { rotulo: string; href: string }[];
};
