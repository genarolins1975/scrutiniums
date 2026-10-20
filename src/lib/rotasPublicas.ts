/**
 * Fronteira entre a vitrine pública e os painéis.
 *
 * Decisão de produto (13/10/2026): a página inicial, a apresentação do
 * Crédito, as páginas de método e glossário, as institucionais e o fluxo de
 * entrada e cadastro são abertos. Desde 19/10/2026 (estratégia "aberto e com
 * conta", leva 1), também as consultas pessoais listadas em CONSULTAS_ABERTAS.
 * A leva 2 (LEVA_2, abaixo) está preparada e desligada: cada item só abre
 * quando a data da aprovação do dono é registrada nele.
 * Todo o resto, inclusive painéis, downloads, API, feeds e gráficos
 * incorporáveis, exige sessão. A sessão só nasce depois
 * da verificação do telefone (api/onboarding/phone/check), então sessão válida
 * equivale a conta com telefone verificado.
 *
 * A regra é por lista de rotas abertas: rota nova nasce fechada. O middleware
 * e o sitemap leem daqui. Código puro, compatível com o Edge Runtime.
 */
import { parDeIdioma } from "./i18n-rotas";
import type { ObservatorioId } from "./observatorios/lista";

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
 * Princípio do aperitivo (decisão do dono de 20/10/2026): tudo o que a área
 * aberta mostra existe na área com conta, com nível de detalhe muito maior; a
 * área aberta mostra só um aperitivo da informação, e cada tema tem uma única
 * página aberta. Método, glossário, conteúdo didático, páginas institucionais,
 * a camada "O Brasil em perguntas" e o fluxo de conta não são aperitivo:
 * explicam como a plataforma mede ou levam aos temas, e valem igual para todos.
 *
 * Cada tema com consulta aberta declara aqui a sua página. Quando `versaoAberta`
 * existe, o endereço público serve duas versões (src/middleware.ts): sem sessão,
 * a versão aperitivo, por rewrite, sem mudar o endereço; com sessão, o painel
 * completo de sempre. Quando é null, a própria página já é o aperitivo e o
 * painel completo fica em outro endereço, com conta. As fichas por código IBGE
 * do tema (`fichasIbge`) são do painel completo: sem sessão voltam à página do
 * tema com ?ibge=. src/tests/aperitivo.test.ts confere tudo isso.
 *
 * Origem: estratégia "aberto e com conta", leva 1, aprovada pelo dono em
 * 19/10/2026 (docs/BANCA_2026-10-19.md). Caminho exato: subpáginas, arquivos e
 * downloads continuam fechados. O simulador da conta de água saiu da área aberta
 * em 20/10/2026, porque o Saneamento já tem a sua página aberta.
 */
export type Aperitivo = {
  /** Tema dono da página aberta; um tema, uma página. */
  tema: string;
  /** Endereço público, aberto sem conta pelo caminho exato. */
  rota: string;
  /** Versão aperitivo servida sem sessão no endereço público; null quando a própria página já é o aperitivo. */
  versaoAberta: string | null;
  /** Onde a conta aprofunda: o próprio endereço com sessão, ou o painel com conta. */
  painelCompleto: string;
  /** Prefixo das fichas por código IBGE do tema, que pedem conta e, sem sessão, voltam à página do tema. */
  fichasIbge?: string;
};

export const APERITIVOS: readonly Aperitivo[] = Object.freeze([
  { tema: "Conta de luz", rota: "/setor-eletrico/conta-de-luz", versaoAberta: "/aperitivo/conta-de-luz", painelCompleto: "/setor-eletrico/conta-de-luz" },
  {
    tema: "Saneamento",
    rota: "/saneamento/municipio",
    versaoAberta: "/aperitivo/saneamento",
    painelCompleto: "/saneamento/municipio/[id]",
    fichasIbge: "/saneamento/municipio",
  },
  { tema: "Eficiência Estatal", rota: "/eficiencia-estatal", versaoAberta: "/aperitivo/minha-capital", painelCompleto: "/eficiencia-estatal" },
  { tema: "Gás de cozinha", rota: "/gas-natural/gas-de-cozinha", versaoAberta: "/aperitivo/gas-de-cozinha", painelCompleto: "/gas-natural/gas-de-cozinha" },
  // apresentação do Crédito, aberta desde 13/10/2026: é a página única do tema; o observatório completo segue com conta
  { tema: "Crédito", rota: "/observatorio-do-credito", versaoAberta: null, painelCompleto: "/observatorio" },
] satisfies Aperitivo[]);

const ROTAS_DOS_APERITIVOS = new Set(APERITIVOS.map((a) => a.rota));

/** Prefixo interno das versões aperitivo: nunca é endereço público, só destino de rewrite. */
const PREFIXO_APERITIVO = "/aperitivo";

/**
 * Arquivos que as páginas abertas buscam no navegador, um a um e pelo
 * endereço exato (sem barra final): o índice município → distribuidora da
 * busca da Conta de luz (ContaBuscaMunicipio) e o índice de nomes da busca de
 * município do Saneamento (BuscaMunicipio). As pastas de cada um seguem
 * fechadas. A malha das UFs saiu em 20/10/2026: o aperitivo do botijão não
 * desenha mapa.
 */
const ARQUIVOS_DAS_CONSULTAS = new Set([
  "/setor-eletrico/conta-de-luz/municipios.json",
  "/saneamento/gold/indice.json",
]);

/**
 * Leva 2 da estratégia "aberto e com conta" (docs/BANCA_2026-10-19.md, Onda 2,
 * tabela "Ferramentas candidatas à abertura, rota por rota"). Preparada e
 * desligada: enquanto `aprovadaEm` for null, nenhuma rota e nenhum arquivo do
 * item é público, nenhuma página aberta o lista e o sitemap não o inclui.
 *
 * Ligar um item é uma decisão registrada do dono: trocar `aprovadaEm: null`
 * pela data da aprovação (AAAA-MM-DD) nesse item, e mais nada. O resto segue
 * sozinho: o middleware e o sitemap (ehRotaPublica), o bloco "Para o seu caso"
 * e os métodos de /perguntas/[porta] (src/lib/perguntas/leva2.ts), o artefato
 * da porta e o link da navegação do tema. Item aprovado cuja rota ainda não
 * existe, ou cujo arquivo não está em public/, reprova src/tests/leva2.test.ts.
 *
 * Abertura por caminho exato, como na leva 1: subpáginas, pastas e downloads
 * seguem fechados. `arquivos` são os que a consulta busca no navegador, um a
 * um; o que a página lê no servidor não precisa abrir.
 */
export type IdLeva2 =
  | "quanto-meu-banco-cobra"
  | "teve-fogo-perto-de-mim"
  | "cem-reais-dos-impostos"
  | "metodologia-do-credito"
  | "quanto-custa-encher-o-tanque"
  | "cem-reais-por-area"
  | "quanto-subiu-o-custo-de-vida";

export type ItemLeva2 = {
  id: IdLeva2;
  /** Tema da consulta (princípio do aperitivo: aprovada, ela é a única página aberta do tema). */
  tema: string;
  /** A pergunta do curioso, como aparece na camada aberta. */
  pergunta: string;
  /** O que a consulta mostra, em uma frase. */
  resumo: string;
  /**
   * Como entra na camada aberta quando aprovado: consulta no bloco "Para o seu
   * caso", página de método na lista de métodos, ou artefato dentro da própria
   * página da porta (que já é aberta, por isso sem rota própria).
   */
  forma: "consulta" | "metodo" | "artefato";
  /** Páginas abertas de "O Brasil em perguntas" (/perguntas/[porta]) que mostram o item. */
  portas: readonly ObservatorioId[];
  /** Rotas abertas pelo caminho exato; a primeira é o destino do link. */
  rotas: readonly string[];
  /** Ficha por município: o prefixo seguido de "/" e do código IBGE de sete dígitos. */
  fichasIbge?: string;
  /** Arquivos que a consulta busca no navegador, cada um pelo endereço exato. */
  arquivos: readonly string[];
  /**
   * Painel com conta que aprofunda o item (princípio do aperitivo, 20/10/2026):
   * a mesma informação com nível de detalhe muito maior. null só para método.
   */
  painelCompleto: string | null;
  /** Data da aprovação do dono (AAAA-MM-DD); null = preparada, aguardando aprovação. */
  aprovadaEm: string | null;
};

export const LEVA_2: readonly ItemLeva2[] = Object.freeze([
  {
    // rota do pacote Q1 da Onda 2 (página Next a partir de public/obs/data/gold/juros.json, lida no servidor);
    // se a versão final buscar arquivo no navegador, ele entra em `arquivos` antes da aprovação
    id: "quanto-meu-banco-cobra",
    tema: "Crédito",
    pergunta: "Quanto meu banco cobra?",
    resumo: "A taxa média da modalidade escolhida no seu banco, comparada com a mediana das instituições, com o aviso de que taxa média não é o CET.",
    forma: "consulta",
    portas: ["familias", "economia"],
    rotas: ["/observatorio-do-credito/quanto-meu-banco-cobra"],
    arquivos: [],
    painelCompleto: "/observatorio/interest-rates",
    aprovadaEm: null,
  },
  {
    // a ficha é montada no servidor a partir da gold municipal: a gold inteira (arquivo completo) continua com conta;
    // no navegador, a busca só baixa o índice de nomes do IBGE, que já é aberto pela leva 1
    id: "teve-fogo-perto-de-mim",
    tema: "Queimadas",
    pergunta: "Teve fogo perto de mim?",
    resumo: "Os focos de calor no seu município no último ano completo e no ano em curso, por área e comparados com o estado, pelo satélite de referência do INPE.",
    forma: "consulta",
    portas: ["territorio-e-clima"],
    rotas: ["/territorio/queimadas/municipio"],
    fichasIbge: "/territorio/queimadas/municipio",
    arquivos: ["/saneamento/gold/indice.json"],
    painelCompleto: "/territorio/queimadas",
    aprovadaEm: null,
  },
  {
    // artefato CemReaisPagos levado para a página aberta /perguntas/contas-publicas, que já é pública
    id: "cem-reais-dos-impostos",
    tema: "Contas públicas",
    pergunta: "Para onde vão R$ 100 dos meus impostos?",
    resumo: "Cada R$ 100 pagos pelo orçamento federal no último exercício encerrado, repartidos por grupo de despesa, pelos dados abertos do SIOP.",
    forma: "artefato",
    portas: ["contas-publicas"],
    rotas: [],
    arquivos: [],
    painelCompleto: "/contas-publicas",
    aprovadaEm: null,
  },
  {
    // página estática Next avaliada pelo pacote Q1 (hoje o método do Crédito é a vista /observatorio/methodology da aplicação de página única)
    id: "metodologia-do-credito",
    tema: "Crédito",
    pergunta: "Como o Crédito calcula cada número?",
    resumo: "Conceitos, fontes e regras de cálculo do Observatório do Crédito.",
    forma: "metodo",
    portas: ["familias", "economia"],
    rotas: ["/observatorio-do-credito/metodologia"],
    arquivos: [],
    painelCompleto: null,
    aprovadaEm: null,
  },
  {
    // consulta do painel novo Combustíveis nos postos (19/10/2026): só o último mês, por UF, com fonte e data, montado no
    // servidor a partir de public/gas/gold/combustiveis.json; nenhum arquivo é buscado no navegador. Série, comparação entre
    // as UFs, downloads e o painel /combustiveis seguem com conta
    id: "quanto-custa-encher-o-tanque",
    tema: "Combustíveis",
    pergunta: "Quanto custa encher o tanque no meu estado?",
    resumo: "O preço médio do litro de gasolina, etanol e diesel no seu estado no último mês da pesquisa da ANP, comparado com a média do Brasil.",
    forma: "consulta",
    portas: ["energia-e-infraestrutura", "familias"],
    rotas: ["/combustiveis/no-meu-estado"],
    arquivos: [],
    painelCompleto: "/combustiveis",
    // aprovada pelo dono em 20/10/2026, junto com o merge do painel Combustíveis nos postos
    aprovadaEm: "2026-10-20",
  },
  {
    // consulta do painel novo Despesa por área (/contas-publicas/por-area, autorizado em 20/10/2026, com conta): artefato
    // CemReaisPorAreaAberto dentro de /perguntas/contas-publicas, que já é aberta. Só o último exercício encerrado, valor
    // pago, montado no servidor a partir de src/lib/contas-publicas/snapshots/funcoes.json; nenhuma rota e nenhum arquivo
    // abrem. Série, outros estágios, subfunções, downloads e o painel seguem com conta
    id: "cem-reais-por-area",
    tema: "Contas públicas",
    pergunta: "Quanto de cada R$ 100 do governo federal vai para cada área?",
    resumo: "Cada R$ 100 pagos pelo orçamento federal no último exercício encerrado, repartidos por área de governo (previdência, saúde, educação e as demais), com a dívida pública à parte, pelos dados abertos do SIOP.",
    forma: "artefato",
    portas: ["contas-publicas"],
    rotas: [],
    arquivos: [],
    painelCompleto: "/contas-publicas/por-area",
    aprovadaEm: null,
  },
  {
    // consulta do painel novo Inflação por cidade (Observatório das Famílias, 20/10/2026): só o último mês da área escolhida,
    // 12 meses do índice geral e dos nove grupos comparados com o Brasil, montado no servidor a partir de
    // public/inflacao/gold/ipca.json; nenhum arquivo é buscado no navegador. A série desde 2020, a comparação entre as 16
    // áreas, os produtos e serviços que mais subiram, o artefato dos pesos, os downloads e o painel /custo-de-vida seguem com conta
    id: "quanto-subiu-o-custo-de-vida",
    tema: "Custo de vida",
    pergunta: "Quanto subiu o custo de vida na minha cidade?",
    resumo: "A inflação em 12 meses da sua cidade ou região metropolitana no último mês do IPCA, no índice geral e nos nove grupos de despesa, comparada com a do Brasil.",
    forma: "consulta",
    portas: ["familias"],
    rotas: ["/custo-de-vida/na-minha-cidade"],
    arquivos: [],
    painelCompleto: "/custo-de-vida",
    aprovadaEm: null,
  },
] satisfies ItemLeva2[]);

/** A aprovação vale só com data real no formato AAAA-MM-DD; qualquer outro valor mantém o item fechado. */
export function itemAprovado(item: Pick<ItemLeva2, "aprovadaEm">): boolean {
  const d = item.aprovadaEm;
  if (typeof d !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const t = new Date(`${d}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
}

/** O item da leva 2 está aprovado? (lido pelas páginas que o mostram) */
export function leva2Aprovada(id: IdLeva2, leva: readonly ItemLeva2[] = LEVA_2): boolean {
  const item = leva.find((i) => i.id === id);
  return !!item && itemAprovado(item);
}

const CODIGO_IBGE = /^\d{7}$/;

/** O caminho (já sem barra final) é rota, ficha ou arquivo de um item aprovado? */
function abertoPelaLeva2(caminho: string, semBarra: string, leva: readonly ItemLeva2[]): boolean {
  for (const item of leva) {
    if (!itemAprovado(item)) continue;
    if (item.arquivos.includes(caminho)) return true;
    if (item.rotas.includes(semBarra)) return true;
    if (item.fichasIbge && semBarra.startsWith(item.fichasIbge + "/") && CODIGO_IBGE.test(semBarra.slice(item.fichasIbge.length + 1))) return true;
  }
  return false;
}

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
  return ehRotaPublicaCom(LEVA_2, caminho);
}

/**
 * A mesma regra com uma leva 2 dada: serve para conferir, antes de ligar, o
 * que a aprovação abriria (src/tests/leva2.test.ts). O middleware, o sitemap e
 * as páginas usam ehRotaPublica, com a LEVA_2 registrada acima.
 */
export function ehRotaPublicaCom(leva2: readonly ItemLeva2[], caminho: string): boolean {
  // Só irmãs declaradas herdam a política PT. A guarda antecede imagens sociais
  // para que uma imagem inglesa ainda inexistente não herde abertura da página.
  if (sobPrefixo(caminho, "/en")) {
    if (/[?#]/.test(caminho)) return false;
    const par = parDeIdioma(caminho);
    return par !== null && ehRotaPublicaCom(leva2, par.pt);
  }
  if (caminho.startsWith("/_next/")) return true;
  if (caminho === "/api" || caminho.startsWith("/api/")) return !ehApiDeDados(caminho);
  // a área de conta tem regra própria no middleware
  if (sobPrefixo(caminho, "/app")) return false;
  const social = caminho.match(IMAGEM_SOCIAL);
  if (social) {
    const pai = caminho.slice(0, social.index) || "/";
    return ehRotaPublicaCom(leva2, pai);
  }
  if (ARQUIVOS_DAS_CONSULTAS.has(caminho)) return true;
  const semBarra = caminho.length > 1 && caminho.endsWith("/") ? caminho.slice(0, -1) : caminho;
  if (EXATAS.has(semBarra) || ROTAS_DOS_APERITIVOS.has(semBarra)) return true;
  if (abertoPelaLeva2(caminho, semBarra, leva2)) return true;
  if (PREFIXOS.some((p) => sobPrefixo(semBarra, p))) return true;
  if (ARTE.test(semBarra)) return true;
  return METODOS_EFICIENCIA.test(semBarra);
}

export type DesvioDoAperitivo =
  /** Sem sessão: servir a versão aperitivo no mesmo endereço. */
  | { tipo: "aperitivo"; destino: string }
  /** Sem sessão: a ficha do painel completo volta à página aberta do tema. */
  | { tipo: "ficha"; destino: string }
  /** O caminho interno da versão aperitivo, pedido diretamente: não existe como endereço. */
  | { tipo: "interno" };

/**
 * O que o middleware faz com o caminho, pelo princípio do aperitivo. `aperitivo` e
 * `ficha` valem só para quem não tem sessão; `interno` vale para todos. null: o
 * caminho segue a regra comum da lista aberta.
 */
export function desvioDoAperitivo(caminho: string): DesvioDoAperitivo | null {
  const semBarra = caminho.length > 1 && caminho.endsWith("/") ? caminho.slice(0, -1) : caminho;
  if (sobPrefixo(semBarra, PREFIXO_APERITIVO) || sobPrefixo(semBarra, "/en" + PREFIXO_APERITIVO)) return { tipo: "interno" };
  const en = sobPrefixo(semBarra, "/en");
  const pt = en ? parDeIdioma(semBarra)?.pt : semBarra;
  if (!pt) return null;
  for (const a of APERITIVOS) {
    if (a.versaoAberta && pt === a.rota) return { tipo: "aperitivo", destino: (en ? "/en" : "") + a.versaoAberta };
    if (a.fichasIbge && !en && semBarra.startsWith(a.fichasIbge + "/") && CODIGO_IBGE.test(semBarra.slice(a.fichasIbge.length + 1))) {
      return { tipo: "ficha", destino: `${a.rota}?ibge=${semBarra.slice(a.fichasIbge.length + 1)}` };
    }
  }
  return null;
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
