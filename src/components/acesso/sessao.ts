import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { APERITIVOS, ehRotaPublica } from "@/lib/rotasPublicas";

/* Sem "use client": módulo de hooks, importado por componentes de cliente. */

// uma consulta por página, compartilhada pelos componentes dela; a navegação para outro endereço (por
// exemplo, a volta do login com router.push) refaz a consulta, para quem entrou não seguir visto como visitante
export const ContextoSessaoValidada = createContext<boolean | undefined>(undefined);

type EstadoSessao = { logado: boolean; completo: boolean };
let consumidores = 0;
let consulta: { caminho: string; resposta: Promise<EstadoSessao>; instante: number } | null = null;
function consultar(caminho: string, renovar = false): Promise<EstadoSessao> {
  if (!consulta || consulta.caminho !== caminho || (renovar && Date.now() - consulta.instante > 1000)) {
    const resposta = fetch("/api/auth/estado", { cache: "no-store", credentials: "same-origin" })
      .then((r) => (r.ok ? (r.json() as Promise<{ logado?: boolean; completo?: boolean }>) : { logado: false, completo: false }))
      .then((j) => ({ logado: j.logado === true, completo: j.completo === true }))
      .catch(() => ({ logado: false, completo: false }));
    consulta = { caminho, resposta, instante: Date.now() };
  }
  return consulta.resposta;
}

/**
 * Sessão vista do navegador, numa página estática que o servidor serve igual para todos:
 * `null` enquanto a resposta não chega (e no HTML do servidor), depois `true` ou `false`.
 * GET /api/auth/estado responde sempre 200, sem dado pessoal.
 */
function useEstadoSessao(inicial?: boolean): EstadoSessao | null {
  const conhecida = useContext(ContextoSessaoValidada);
  const estadoInicial = inicial ?? conhecida;
  const caminho = usePathname() ?? "/";
  const primeiraMontagem = useRef(true);
  const [logado, setLogado] = useState<EstadoSessao | null>(estadoInicial === undefined ? null : { logado: estadoInicial, completo: estadoInicial });
  useEffect(() => {
    let vivo = true;
    consumidores += 1;
    if (primeiraMontagem.current && consumidores === 1 && estadoInicial !== undefined) consulta = { caminho, resposta: Promise.resolve({ logado: estadoInicial, completo: estadoInicial }), instante: Date.now() };
    primeiraMontagem.current = false;
    const atualizar = (renovar = false) => consultar(caminho, renovar).then((v) => vivo && setLogado(v));
    void atualizar();
    const aoVoltar = () => { if (document.visibilityState === "visible") void atualizar(true); };
    window.addEventListener("pageshow", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      vivo = false;
      consumidores -= 1;
      if (consumidores === 0) consulta = null;
      window.removeEventListener("pageshow", aoVoltar);
      window.removeEventListener("focus", aoVoltar);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [caminho, estadoInicial]);
  return logado;
}

/** Os selos dependem de sessão; o redirecionamento da home exige onboarding completo. */
export function useSessao(): boolean | null { return useEstadoSessao()?.logado ?? null; }
export function useSessaoCompleta(inicial?: boolean): boolean | null { return useEstadoSessao(inicial)?.completo ?? null; }

/** Endereço atual com o recorte (query e âncora), lido na hora do clique: o estado da consulta vive na URL. */
export function destinoAtual(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

/**
 * Clique no convite ao login: leva o recorte da página (território, comparador, intervalo) na volta.
 * O href do HTML continua válido sem JavaScript; com JavaScript, o destino inclui query e âncora.
 */
export function aoEntrarComRecorte(e: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; button: number; preventDefault: () => void }) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  e.preventDefault();
  window.location.assign(hrefEntrar(destinoAtual()));
}

/**
 * Destino da volta do login para um convite que conhece a rota pública do tema (`ConviteAperitivo`): o caminho de `rota`
 * com a query da janela (o recorte escolhido: ?territorio=, ?uf=), ou a de `rota` quando a janela não tiver, e a âncora.
 * O caminho vem de `rota`, nunca da janela: a versão aperitivo pode ser vista no caminho interno.
 */
export function destinoComRecorte(rota: string, local: { search: string; hash: string }): string {
  const fim = rota.search(/[?#]/);
  const caminho = fim === -1 ? rota : rota.slice(0, fim);
  const daRota = rota.match(/\?[^#]*/)?.[0] ?? "";
  const query = local.search && local.search !== "?" ? local.search : daRota;
  return `${caminho}${query}${local.hash}`;
}

/** Clique no convite com rota pública: como `aoEntrarComRecorte`, com o caminho de `rota` e o recorte da janela. */
export function aoEntrarComRecorteEm(rota: string) {
  return (e: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey?: boolean; button: number; preventDefault: () => void }) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    window.location.assign(hrefEntrar(destinoComRecorte(rota, window.location)));
  };
}

/** A página atual é aberta (src/lib/rotasPublicas.ts)? Igual no servidor e no navegador. */
/**
 * A versão aperitivo se declara aberta por contexto (src/app/aperitivo/layout.tsx): no endereço público do
 * tema, o mesmo caminho serve o aperitivo sem sessão e o painel completo com sessão, e só a página sabe qual
 * das duas é. Fora dela, vale o caminho.
 */
export const ContextoPaginaAberta = createContext<boolean | null>(null);

export function usePaginaAberta(): boolean {
  const declarada = useContext(ContextoPaginaAberta);
  const caminho = usePathname();
  return declarada ?? ehPaginaAberta(caminho);
}

/** Endereços públicos que, servidos sem o contexto da versão aperitivo, são o painel completo (só chegam com sessão). */
const PAINEL_NO_ENDERECO_PUBLICO = new Set(APERITIVOS.filter((a) => a.versaoAberta).flatMap((a) => [a.rota, "/en" + a.rota]));

/**
 * Página aberta pelo caminho: rota pública (src/lib/rotasPublicas.ts) ou versão aperitivo. A versão aperitivo é gerada no caminho
 * interno (/aperitivo/..., /en/aperitivo/...) e servida por rewrite no endereço público: o HTML estático vê o interno e o navegador
 * vê o público, e os dois precisam concluir "aberta" para o selo não divergir na hidratação.
 */
export function ehPaginaAberta(caminho: string | null | undefined): boolean {
  if (!caminho) return false;
  if (/^(\/en)?\/aperitivo(\/|$)/.test(caminho)) return true;
  const semBarra = caminho.length > 1 && caminho.endsWith("/") ? caminho.slice(0, -1) : caminho;
  if (PAINEL_NO_ENDERECO_PUBLICO.has(semBarra)) return false;
  return ehRotaPublica(caminho);
}

/** O caminho interno da versão aperitivo (visto no HTML estático) vira o endereço público do tema. */
export function enderecoPublico(caminho: string): string {
  const m = caminho.match(/^(\/en)?(\/aperitivo\/[^/?#]+)/);
  if (!m) return caminho;
  const a = APERITIVOS.find((x) => x.versaoAberta === m[2]);
  return a ? (m[1] ?? "") + a.rota : caminho;
}

/** Entrada com retorno para a página atual; em /en, a irmã inglesa do login. */
export function hrefEntrar(caminhoVisto: string): string {
  const caminho = enderecoPublico(caminhoVisto);
  const en = caminho === "/en" || caminho.startsWith("/en/");
  // a irmã inglesa do login existe (/en/entrar); com query, hrefNoIdioma não traduz o endereço
  return en ? `/en/entrar?de=${encodeURIComponent(caminho)}` : `/entrar?de=${encodeURIComponent(caminho)}`;
}

/** Rótulos do acesso no idioma do endereço (inglês só nas irmãs /en declaradas). */
export function textosAcesso(caminho: string | null) {
  const en = !!caminho && (caminho === "/en" || caminho.startsWith("/en/"));
  return en
    ? { selo: "account required", entrar: "Sign in or create a free account" }
    : { selo: "com conta", entrar: "Entrar ou criar conta gratuita" };
}
