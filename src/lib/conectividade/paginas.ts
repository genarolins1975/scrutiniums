/**
 * Painel "Conectividade" (Observatório de Energia e Infraestrutura, coleção Conectividade; dados abertos da Anatel por
 * município): fonte única de rota, títulos, pergunta, seção de telemetria e nomes de exibição. Registro, navegação,
 * camada aberta, sitemap e páginas leem daqui.
 *
 * Princípio do aperitivo: o endereço público /conectividade serve, sem sessão, a versão aperitivo
 * (src/app/aperitivo/conectividade, por rewrite do middleware) e, com sessão, o painel completo (src/app/conectividade).
 * APERITIVOS em src/lib/rotasPublicas.ts declara as duas.
 *
 * O painel mantém pipeline e gold próprios (pipeline/conectividade, public/conectividade/gold) e a fonte de frescor
 * "conectividade" (src/lib/frescor/limiares.json). Nomes de exibição sem hífen.
 */

export const ROTA_CONECTIVIDADE = "/conectividade";
export const VERSAO_ABERTA = "/aperitivo/conectividade";
export const TITULO_PAINEL = "Conectividade";
export const ROTULO_NAVEGACAO = "Conectividade";
export const PERGUNTA_PAINEL = "Quem tem internet de verdade no Brasil?";
export const PERGUNTA_APERITIVO = "Como é a internet na minha cidade?";
export const SECAO_PAINEL = "infra:conectividade";
export const SECAO_APERITIVO = "infra:conectividade-aperitivo";

/** Endereço público com o município escolhido (a busca e a volta do login usam o mesmo). */
export const hrefMunicipio = (ibge: string) => `${ROTA_CONECTIVIDADE}?ibge=${ibge}`;

/** Arquivos para baixar, servidos por rotas com conta ao lado do painel. */
export const DOWNLOADS = [
  { arquivo: "por-municipio.csv", rotulo: "Conectividade por município", descricao: "Banda larga fixa, telefonia móvel e cobertura de cada município no mês e no trimestre mais recentes" },
  { arquivo: "por-estado.csv", rotulo: "Conectividade por estado", descricao: "Os 27 estados e o Brasil: acessos, densidade, fibra, velocidade, prestadoras, 5G e cobertura" },
  { arquivo: "brasil-mensal.csv", rotulo: "Acessos no Brasil, mês a mês", descricao: "Banda larga fixa desde 2007 e telefonia móvel desde 2005, da série de totais da Anatel" },
] as const;

/** O estado com a preposição certa ("do Maranhão", "de São Paulo", "da Bahia"), pela sigla. */
export const DO_ESTADO: Record<string, string> = {
  AC: "do Acre", AL: "de Alagoas", AP: "do Amapá", AM: "do Amazonas", BA: "da Bahia", CE: "do Ceará", DF: "do Distrito Federal",
  ES: "do Espírito Santo", GO: "de Goiás", MA: "do Maranhão", MT: "de Mato Grosso", MS: "de Mato Grosso do Sul", MG: "de Minas Gerais",
  PA: "do Pará", PB: "da Paraíba", PR: "do Paraná", PE: "de Pernambuco", PI: "do Piauí", RJ: "do Rio de Janeiro", RN: "do Rio Grande do Norte",
  RS: "do Rio Grande do Sul", RO: "de Rondônia", RR: "de Roraima", SC: "de Santa Catarina", SP: "de São Paulo", SE: "de Sergipe", TO: "do Tocantins",
};

/** Nome legível das tecnologias da cobertura, na ordem em que o painel as mostra. */
export const TECNOLOGIAS = [
  { id: "g2", rotulo: "2G" },
  { id: "g3", rotulo: "3G" },
  { id: "g4", rotulo: "4G" },
  { id: "g5", rotulo: "5G" },
] as const;

/** Meios de acesso da banda larga fixa, do mais ao menos capaz, com o nome que o leitor conhece. */
export const MEIOS = [
  { id: "fibra_pct", rotulo: "Fibra óptica" },
  { id: "coaxial_pct", rotulo: "Cabo coaxial (TV a cabo)" },
  { id: "metalico_pct", rotulo: "Cabo metálico (linha telefônica)" },
  { id: "radio_pct", rotulo: "Rádio" },
  { id: "satelite_pct", rotulo: "Satélite" },
] as const;

/** Faixas de velocidade contratada da banda larga fixa (Mbps), como o pipeline as corta. */
export const VELOCIDADES = [
  { id: "vel_100_mais_pct", rotulo: "100 Mbps ou mais" },
  { id: "vel_25_100_pct", rotulo: "25 a 100 Mbps" },
  { id: "vel_10_25_pct", rotulo: "10 a 25 Mbps" },
  { id: "vel_ate_10_pct", rotulo: "Menos de 10 Mbps" },
] as const;

/** Nome de exibição dos grupos econômicos da Anatel, quando o rótulo da fonte é uma razão social. */
export const NOME_GRUPO: Record<string, string> = {
  TELEFONICA: "Vivo (Telefônica)",
  "TELECOM AMERICAS": "Claro",
  "TELECOM ITALIA": "TIM",
  OI: "Oi",
  "ALGAR (CTBC TELECOM)": "Algar",
  ALGAR: "Algar",
  BRISANET: "Brisanet",
  HUGHES: "Hughes (satélite)",
  OUTROS: "Provedores regionais e locais",
};

export const nomeGrupo = (g: string | null | undefined) => (g ? (NOME_GRUPO[g] ?? g.charAt(0) + g.slice(1).toLowerCase()) : "Sem dado");
