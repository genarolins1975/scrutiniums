/**
 * Nomes próprios das UF, compartilhados sem carregar a lógica dos painéis.
 * Extração em 27/10/2026: o resumo do recorte precisa só deste catálogo leve.
 * Ficam em português nos dois idiomas; a tela usa <Nome>.
 */
export const NOME_UF: Readonly<Record<string, string>> = {
  // i18n: dado (nomes próprios)
  RO: "Rondônia", AC: "Acre", AM: "Amazonas", RR: "Roraima", PA: "Pará", AP: "Amapá", TO: "Tocantins",
  // i18n: dado (nomes próprios)
  MA: "Maranhão", PI: "Piauí", CE: "Ceará", RN: "Rio Grande do Norte", PB: "Paraíba", PE: "Pernambuco", AL: "Alagoas", SE: "Sergipe", BA: "Bahia",
  // i18n: dado (nomes próprios)
  MG: "Minas Gerais", ES: "Espírito Santo", RJ: "Rio de Janeiro", SP: "São Paulo",
  // i18n: dado (nomes próprios)
  PR: "Paraná", SC: "Santa Catarina", RS: "Rio Grande do Sul",
  // i18n: dado (nomes próprios)
  MS: "Mato Grosso do Sul", MT: "Mato Grosso", GO: "Goiás", DF: "Distrito Federal",
};
