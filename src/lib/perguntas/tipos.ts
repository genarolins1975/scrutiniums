/**
 * Contrato das portas de entrada por pergunta ("O Brasil em perguntas").
 *
 * Cada porta reúne, numa pergunta que a população faz, os números que os
 * observatórios já publicam. Nenhum número é escrito à mão: todos são lidos
 * das golds no build, com fonte e período da própria base. Quando a leitura
 * falha, o número fica ausente e a página diz isso; ausência nunca vira zero.
 */
import type { Dominio } from "@/lib/dominios";
import type { ObservatorioId } from "@/lib/observatorios/registro";

/** Cada porta é a página aberta de um dos seis observatórios. */
export type PortaId = ObservatorioId;

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
  /** Domínio de origem que mantém o destino (Setor Elétrico, Crédito...). */
  observatorio: string;
  /** Coleção do registro a que o destino pertence, como o leitor a vê. */
  colecao: string;
};

/**
 * Consulta pessoal aberta, sem conta (estratégia "aberto e com conta", leva 1, 19/10/2026): o curioso
 * consulta o próprio caso (minha distribuidora, meu município, minha capital, meu estado). Só rotas abertas.
 */
export type ConsultaAberta = {
  pergunta: string;
  /** O que a consulta mostra, em uma frase. */
  resumo: string;
  href: string;
};

export type Porta = {
  id: PortaId;
  /** Nome curto do observatório, como aparece no cartão da home. */
  nome: string;
  /** Nome completo do observatório. */
  nomeCompleto: string;
  pergunta: string;
  /** Uma frase sobre o que a porta cobre, sem juízo de valor. */
  resumo: string;
  acento: Dominio["acento"];
  /** Até três números; o primeiro é o destaque do cartão da home. */
  numeros: NumeroPorta[];
  caminhos: CaminhoPorta[];
  /** Consultas abertas do tema ("Para o seu caso"); os caminhos acima levam aos painéis com conta. */
  paraOSeuCaso: ConsultaAberta[];
  /** Perguntas da porta que a plataforma ainda não responde. */
  lacunas: string[];
  /** Páginas públicas de método dos observatórios que alimentam a porta. */
  metodos: { rotulo: string; href: string }[];
};
