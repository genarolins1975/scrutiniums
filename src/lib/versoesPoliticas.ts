/**
 * Versões vigentes das políticas publicadas. Fonte única: a página exibe e o
 * cadastro grava a mesma versão no aceite (users.privacy_version).
 */
// 2026-10-23: a política passa a dizer que, com conta, o texto da busca fora do vocabulário do índice é guardado por 30 dias
// (ciclo 2 da busca, bloco 4); mudança material, então versão nova, com o dia, para distinguir o aceite antes e depois dela
export const PRIVACY_VERSION = "2026-10-23";
