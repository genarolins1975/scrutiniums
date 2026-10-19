/**
 * Fronteira entre a vitrine pública e os painéis.
 *
 * Decisão de produto (13/10/2026): a página inicial, a apresentação do
 * Crédito, as páginas de método e glossário, as institucionais e o fluxo de
 * entrada e cadastro são abertos. Desde 19/10/2026 (estratégia "aberto e com
 * conta", leva 1), também as consultas pessoais listadas em CONSULTAS_ABERTAS.
 * Todo o resto, inclusive painéis, downloads, API, feeds e gráficos
 * incorporáveis, exige sessão. A sessão só nasce depois
 * da verificação do telefone (api/onboarding/phone/check), então sessão válida
 * equivale a conta com telefone verificado.
 *
 * A regra é por lista de rotas abertas: rota nova nasce fechada. O middleware
 * e o sitemap leem daqui. Código puro, compatível com o Edge Runtime.
 */
import { parDeIdioma } from "./i18n-rotas";

/** Caminhos abertos exatamente como escritos. */
const EXATAS = new Set([
  "/",
  "/termos",
  "/privacidade",
  "/imprensa",
  "/glossario",
  "/observatorio-do-credito",
  "/robots.txt",
  "/sitemap.xml",
  "/favicon.ico",
  "/icon.svg",
]);

/** Prefixos abertos: o próprio caminho e tudo abaixo dele. */
const PREFIXOS = [
  "/entrar",
  "/cadastro",
  "/sobre",
  "/boletim/sair",
  "/home",
  "/setor-eletrico/metodologia",
  "/setor-eletrico/aprenda",
  "/contas-publicas/metodologia",
  "/contas-publicas/glossario",
  "/saneamento/metodologia",
  "/gas-natural/metodologia",
  "/agronegocio/metodologia",
  "/agronegocio/glossario",
  "/territorio/metodologia",
  // camada aberta "O Brasil em perguntas" (decisão de 17/10/2026): a resposta curta é pública, os painéis seguem com conta
  "/perguntas",
];

/**
 * Consultas pessoais abertas (estratégia "aberto e com conta", leva 1, aprovada
 * pelo dono em 19/10/2026; docs/BANCA_2026-10-19.md). O curioso consulta o
 * próprio caso: a conta de luz da sua distribuidora, o saneamento do seu
 * município, a conta de água, a sua capital e o botijão no seu estado. Caminho
 * exato: subpáginas, arquivos e downloads dessas rotas continuam fechados.
 */
const CONSULTAS_ABERTAS = new Set([
  "/setor-eletrico/conta-de-luz",
  "/saneamento/municipio",
  "/saneamento/preco-regulado/simulador",
  "/eficiencia-estatal",
  "/gas-natural/gas-de-cozinha",
]);

/** Ficha do município no Saneamento: só o código IBGE de sete dígitos. */
const FICHA_MUNICIPIO = /^\/saneamento\/municipio\/\d{7}$/;

/**
 * Arquivos que as consultas abertas buscam no navegador, um a um e pelo
 * endereço exato (sem barra final): o índice município → distribuidora da
 * busca da Conta de luz (ContaBuscaMunicipio), o índice de nomes da busca de
 * município do Saneamento (BuscaMunicipio) e a malha das UFs do IBGE do mapa do
 * botijão (MapaUf). As pastas de cada um seguem fechadas.
 */
const ARQUIVOS_DAS_CONSULTAS = new Set([
  "/setor-eletrico/conta-de-luz/municipios.json",
  "/saneamento/gold/indice.json",
  "/energia/geo/uf.json",
]);

/** Páginas de método de cada tema da Eficiência Estatal. */
const METODOS_EFICIENCIA = /^\/eficiencia-estatal\/[a-z0-9-]+\/metodos\/?$/;

/**
 * Gravuras decorativas dos observatórios (não são dado). O otimizador do
 * next/image busca a imagem sem o cookie da sessão; fechada, a gravura
 * chegava quebrada mesmo para quem tinha conta (19/10/2026).
 */
const ARTE = /^\/(energia|estado|obs)\/arte\/[a-z0-9-]+\.webp$/;

/** Imagens de compartilhamento geradas pelo Next ao lado de cada rota. */
const IMAGEM_SOCIAL = /\/(opengraph-image|twitter-image)(-[\w]+)?$/;

/** Rotas de API que entregam dados dos painéis: exigem sessão como eles. */
const API_DE_DADOS = ["/api/eficiencia-mobilidade"];

function sobPrefixo(caminho: string, prefixo: string): boolean {
  return caminho === prefixo || caminho.startsWith(prefixo + "/");
}

/** A rota de API pede sessão? As demais APIs fazem a própria verificação. */
export function ehApiDeDados(caminho: string): boolean {
  return API_DE_DADOS.some((p) => sobPrefixo(caminho, p));
}

/** O caminho pode ser servido sem sessão? */
export function ehRotaPublica(caminho: string): boolean {
  // Só irmãs declaradas herdam a política PT. A guarda antecede imagens sociais
  // para que uma imagem inglesa ainda inexistente não herde abertura da página.
  if (sobPrefixo(caminho, "/en")) {
    if (/[?#]/.test(caminho)) return false;
    const par = parDeIdioma(caminho);
    return par !== null && ehRotaPublica(par.pt);
  }
  if (caminho.startsWith("/_next/")) return true;
  if (caminho === "/api" || caminho.startsWith("/api/")) return !ehApiDeDados(caminho);
  // a área de conta tem regra própria no middleware
  if (sobPrefixo(caminho, "/app")) return false;
  const social = caminho.match(IMAGEM_SOCIAL);
  if (social) {
    const pai = caminho.slice(0, social.index) || "/";
    return ehRotaPublica(pai);
  }
  if (ARQUIVOS_DAS_CONSULTAS.has(caminho)) return true;
  const semBarra = caminho.length > 1 && caminho.endsWith("/") ? caminho.slice(0, -1) : caminho;
  if (EXATAS.has(semBarra) || CONSULTAS_ABERTAS.has(semBarra)) return true;
  if (FICHA_MUNICIPIO.test(semBarra)) return true;
  if (PREFIXOS.some((p) => sobPrefixo(semBarra, p))) return true;
  if (ARTE.test(semBarra)) return true;
  return METODOS_EFICIENCIA.test(semBarra);
}

/** Cookie que guarda o painel pedido enquanto a pessoa entra ou se cadastra. */
export const COOKIE_DESTINO = "scrutiniums_destino";

/**
 * Pré-carregamento de link: desligado para destinos fechados, que para quem não
 * tem sessão só devolveriam o redirecionamento ao login.
 */
export function prefetchDoLink(href: string): false | undefined {
  return exigeConta(href) ? false : undefined;
}

/** O destino do link (página ou arquivo) pede sessão? Query e âncora não contam. */
export function exigeConta(href: string): boolean {
  return !ehRotaPublica(href.split(/[?#]/)[0] || "/");
}
