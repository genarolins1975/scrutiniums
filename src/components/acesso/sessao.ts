import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { hrefNoIdioma } from "@/lib/i18n-href";
import { ehRotaPublica } from "@/lib/rotasPublicas";

/* Sem "use client": módulo de hooks, importado por componentes de cliente. */

// uma consulta por visita, compartilhada por todos os componentes da página
let consulta: Promise<boolean> | null = null;
function consultar(): Promise<boolean> {
  if (!consulta) {
    consulta = fetch("/api/auth/estado", { cache: "no-store", credentials: "same-origin" })
      .then((r) => (r.ok ? (r.json() as Promise<{ logado?: boolean }>) : { logado: false }))
      .then((j) => j.logado === true)
      .catch(() => false);
  }
  return consulta;
}

/**
 * Sessão vista do navegador, numa página estática que o servidor serve igual para todos:
 * `null` enquanto a resposta não chega (e no HTML do servidor), depois `true` ou `false`.
 * GET /api/auth/estado responde sempre 200, sem dado pessoal.
 */
export function useSessao(): boolean | null {
  const [logado, setLogado] = useState<boolean | null>(null);
  useEffect(() => {
    let vivo = true;
    consultar().then((v) => vivo && setLogado(v));
    return () => {
      vivo = false;
    };
  }, []);
  return logado;
}

/** A página atual é aberta (src/lib/rotasPublicas.ts)? Igual no servidor e no navegador. */
export function usePaginaAberta(): boolean {
  const caminho = usePathname();
  return !!caminho && ehRotaPublica(caminho);
}

/** Entrada com retorno para a página atual; em /en, a irmã inglesa do login. */
export function hrefEntrar(caminho: string): string {
  const en = caminho === "/en" || caminho.startsWith("/en/");
  return hrefNoIdioma(`/entrar?de=${encodeURIComponent(caminho)}`, en ? "en" : "pt");
}

/** Rótulos do acesso no idioma do endereço (inglês só nas irmãs /en declaradas). */
export function textosAcesso(caminho: string | null) {
  const en = !!caminho && (caminho === "/en" || caminho.startsWith("/en/"));
  return en
    ? { selo: "account required", entrar: "Sign in or create a free account" }
    : { selo: "com conta", entrar: "Entrar ou criar conta gratuita" };
}
