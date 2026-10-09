/**
 * Histórico de revisões da gold de Saúde. Cada linha é uma geração dos dados (hash_dados) com o que mudou em relação à anterior.
 * Horários em UTC. O módulo ainda não foi publicado em produção: as versões intermediárias existem só na branch de desenvolvimento.
 * Um teste exige que a última linha seja a gold publicada; quem regenera a gold acrescenta a linha nova.
 */
export type RevisaoSaude = { geradoEm: string; hash: string; observacoes: number; mudou: string; tipo: "dados" | "metodo" | "texto" };

export const HISTORICO_REVISOES: RevisaoSaude[] = [
  { geradoEm: "09/10/2026, 14h15", hash: "1cb7f82d0fffde46", observacoes: 8721, tipo: "dados", mudou: "Primeira geração: despesa, ASPS, UBS, equipes, cobertura potencial, ICSAP, planos e população, com referências e matriz de fontes." },
  { geradoEm: "09/10/2026, 14h34", hash: "f111efb2ef09c540", observacoes: 8751, tipo: "dados", mudou: "Composição das UBS: 30 observações a mais (componentes de gestão, natureza e atendimento SUS) e valores corrigidos em 661 observações de UBS (531 contagens por componente, 125 razões por 10 mil e 5 com estado e elegibilidade)." },
  { geradoEm: "09/10/2026, 16h06", hash: "ce882081d96f44d5", observacoes: 8777, tipo: "metodo", mudou: "Primeira rodada de avaliação: razão agregada na unidade do indicador, bases da população por exercício, retrato de UBS (26 observações a mais), campos revisados em 1.044 observações (base populacional, marca de base, nota, nota material e conferência); registros intactos." },
  { geradoEm: "09/10/2026, 16h39", hash: "159b76024a953f4d", observacoes: 8777, tipo: "metodo", mudou: "Segunda rodada: três bases da população de referência do Ministério na cobertura potencial, com marca e nota em 78 observações." },
  { geradoEm: "09/10/2026, 17h19", hash: "ea1565fee6907c1a", observacoes: 8777, tipo: "texto", mudou: "Terceira rodada: nota de natureza da despesa de Florianópolis em 2022 e 2023 (6 observações). Nenhum valor mudou." },
  { geradoEm: "09/10/2026, 17h57", hash: "6a4bac828fb3918d", observacoes: 8777, tipo: "texto", mudou: "Quarta rodada: procedência da população de 2023 (Primeiros Resultados do Censo 2022, 22/12/2023), valor bruto sem natureza na nota de Florianópolis, textos de base populacional. Nenhum valor mudou: 188 observações com registro ou nota revisados; colunas quebra_perimetro e arquivo de referências nacionais nas exportações." },
  { geradoEm: "09/10/2026, 18h42", hash: "3797117fb0d67027", observacoes: 8777, tipo: "texto", mudou: "Quinta rodada: textos de fichas e da matriz de fontes sobre as bases da população e o intervalo da população do Ministério por ano, procedência da população de 2023 (tipo e rótulo próprios), marca de perímetro nas aberturas da DCA e na série exportada, página e data da norma nos CSV de referências. Nenhum valor mudou." },
];

export const ROTULO_TIPO_REVISAO: Record<RevisaoSaude["tipo"], string> = { dados: "dados", metodo: "método", texto: "texto" };
