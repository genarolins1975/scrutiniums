import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ehRotaPublica } from "@/lib/rotasPublicas";

/* Sem "use client": módulo de hooks, importado por componentes de cliente. */

// uma consulta por página, compartilhada pelos componentes dela; a navegação para outro endereço (por
// exemplo, a volta do login com router.push) refaz a consulta, para quem entrou não seguir visto como visitante
let consulta: { caminho: string; resposta: Promise<boolean> } | null = null;
function consultar(caminho: string): Promise<boolean> {
  if (!consulta || consulta.caminho !== caminho) {
    const resposta = fetch("/api/auth/estado", { cache: "no-store", credentials: "same-origin" })
      .then((r) => (r.ok ? (r.json() as Promise<{ logado?: boolean }>) : { logado: false }))
      .then((j) => j.logado === true)
      .catch(() => false);
    consulta = { caminho, resposta };
  }
  return consulta.resposta;
}

/**
 * Sessão vista do navegador, numa página estática que o servidor serve igual para todos:
 * `null` enquanto a resposta não chega (e no HTML do servidor), depois `true` ou `false`.
 * GET /api/auth/estado responde sempre 200, sem dado pessoal.
 */
export function useSessao(): boolean | null {
  const caminho = usePathname() ?? "/";
  const [logado, setLogado] = useState<boolean | null>(null);
  useEffect(() => {
    let vivo = true;
    consultar(caminho).then((v) => vivo && setLogado(v));
    return () => {
      vivo = false;
    };
  }, [caminho]);
  return logado;
}

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

/** A página atual é aberta (src/lib/rotasPublicas.ts)? Igual no servidor e no navegador. */
export function usePaginaAberta(): boolean {
  return ehPaginaAberta(usePathname());
}

/**
 * Página aberta pelo caminho: rota pública (src/lib/rotasPublicas.ts) ou versão aperitivo. A versão aperitivo é gerada no caminho
 * interno (/aperitivo/..., /en/aperitivo/...) e servida por rewrite no endereço público: o HTML estático vê o interno e o navegador
 * vê o público, e os dois precisam concluir "aberta" para o selo não divergir na hidratação.
 */
export function ehPaginaAberta(caminho: string | null | undefined): boolean {
  if (!caminho) return false;
  return /^(\/en)?\/aperitivo(\/|$)/.test(caminho) || ehRotaPublica(caminho);
}

/** Entrada com retorno para a página atual; em /en, a irmã inglesa do login. */
export function hrefEntrar(caminho: string): string {
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
