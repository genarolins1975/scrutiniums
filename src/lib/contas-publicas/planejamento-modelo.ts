/**
 * Tipos e rótulos do capítulo "Qualidade do planejamento", sem dados: o componente do navegador importa daqui para
 * não levar a base por função (funcoes.json, lida só no servidor por planejamento.ts) para o pacote do cliente.
 */
export const ESTAGIOS_PLANO = ['inicial', 'atualizada', 'liquidado'] as const;
export type EstagioPlano = (typeof ESTAGIOS_PLANO)[number];
export type ValoresPlano = Record<EstagioPlano, number | null>;
export const BASES_PLANO = ['primaria', 'total'] as const;
export type BasePlano = (typeof BASES_PLANO)[number];
export const NOME_BASE_PLANO: Record<BasePlano, string> = {
  primaria: 'Despesa primária, sem a dívida',
  total: 'Orçamento inteiro, com a dívida',
};
export type FuncaoPlano = {codigo: string; nome: string} & ValoresPlano;
export type AnoPlano = {
  ano: number;
  encerrado: boolean;
  atualizacao: string;
  captura: string;
  primaria: ValoresPlano;
  total: ValoresPlano;
  /** Reserva de contingência na lei original, parte primária (R$). */
  reservaPrimaria: number | null;
  reservaTotal: number | null;
  /** Despesa primária por função, sem a reserva de contingência; só nos anos encerrados. */
  funcoes: FuncaoPlano[];
};
export const FONTE_PLANO = {
  fonte: 'SIOP · dados abertos · classificação funcional e identificador de resultado primário',
  url: 'https://www1.siop.planejamento.gov.br/siopdoc/doku.php/acesso_publico:dados_abertos',
  perimetro: 'Orçamentos Fiscal e da Seguridade Social da União',
  unidade: 'R$ correntes',
};
