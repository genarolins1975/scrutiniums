/**
 * Laboratório experimental da candidata v3, público por decisão editorial de
 * 12/10/2026 (docs/obee/resultados/DECISAO_PUBLICACAO_LABORATORIO_V3.md).
 * Não é índice oficial: pesos não aprovados e precisão municipal não quantificada.
 * Desligamento sem mudança de código: OBEE_LABORATORIO_V3=desligado no ambiente.
 */
export function laboratorioPublico(chave: string | undefined) {
  return chave !== 'desligado';
}
