/**
 * Ficha do lugar (eixo do lugar, pedido do dono de 10/11/2026): uma só página que reúne, para o município escolhido, o que
 * cada coleção já publica por município e por estado. Fonte única de rota, título e seção de telemetria.
 *
 * O lugar vive só no endereço (?ibge=, código de sete dígitos do IBGE): nada é gravado na conta e não há geolocalização
 * (parecer de UX de 23/10/2026, I3, "Não fazer"). A página exige conta: a rota não consta de src/lib/rotasPublicas.ts.
 */
export const ROTA_LUGAR = "/app/minha-cidade";
export const TITULO_LUGAR = "Minha cidade";
export const PERGUNTA_LUGAR = "O que os dados dizem sobre a minha cidade?";
export const SECAO_LUGAR = "app:minha-cidade";
export const RESUMO_LUGAR = "Água, esgoto, escola, internet, INSS e queimadas do seu município numa página só, com os números do estado.";
export const hrefLugar = (ibge: string) => `${ROTA_LUGAR}?ibge=${ibge}`;
