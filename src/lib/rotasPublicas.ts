/**
 * Fronteira entre a vitrine pública e os painéis.
 *
 * Decisão de produto (13/10/2026): a página inicial, a apresentação do
 * Crédito, as páginas de método e glossário, as institucionais e o fluxo de
 * entrada e cadastro são abertos. Todo o resto, inclusive painéis, downloads,
 * API, feeds e gráficos incorporáveis, exige sessão. A sessão só nasce depois
 * da verificação do telefone (api/onboarding/phone/check), então sessão válida
 * equivale a conta com telefone verificado.
 *
 * A regra é por lista de rotas abertas: rota nova nasce fechada. O middleware
 * e o sitemap leem daqui. Código puro, compatível com o Edge Runtime.
 */

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
  "/gas-natural/metodologia",
];

/** Páginas de método de cada tema da Eficiência Estatal. */
const METODOS_EFICIENCIA = /^\/eficiencia-estatal\/[a-z0-9-]+\/metodos\/?$/;

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
  if (caminho.startsWith("/_next/")) return true;
  if (caminho === "/api" || caminho.startsWith("/api/")) return !ehApiDeDados(caminho);
  // a área de conta tem regra própria no middleware
  if (sobPrefixo(caminho, "/app")) return false;
  const social = caminho.match(IMAGEM_SOCIAL);
  if (social) {
    const pai = caminho.slice(0, social.index) || "/";
    return ehRotaPublica(pai);
  }
  const semBarra = caminho.length > 1 && caminho.endsWith("/") ? caminho.slice(0, -1) : caminho;
  if (EXATAS.has(semBarra)) return true;
  if (PREFIXOS.some((p) => sobPrefixo(semBarra, p))) return true;
  return METODOS_EFICIENCIA.test(semBarra);
}

/** Cookie que guarda o painel pedido enquanto a pessoa entra ou se cadastra. */
export const COOKIE_DESTINO = "scrutiniums_destino";

/**
 * Pré-carregamento de link: desligado para destinos fechados, que para quem não
 * tem sessão só devolveriam o redirecionamento ao login.
 */
export function prefetchDoLink(href: string): false | undefined {
  const caminho = href.split(/[?#]/)[0] || "/";
  return ehRotaPublica(caminho) ? undefined : false;
}
