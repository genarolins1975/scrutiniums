"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { navCabecalho } from "@/components/layout/navCabecalho";
import { prefetchDoLink } from "@/lib/rotasPublicas";

// Uma consulta por carregamento de página, compartilhada pelas duas linhas de abas.
let consulta: Promise<boolean> | null = null;
function temSessao(): Promise<boolean> {
  consulta ??= fetch("/api/auth/eu", { cache: "no-store", credentials: "same-origin" })
    .then((r) => r.status === 204)
    .catch(() => false);
  return consulta;
}

/**
 * Abas do cabeçalho. Em páginas dinâmicas o servidor já sabe se há sessão
 * (`logadoNoServidor`). Em páginas estáticas ele não sabe: a aba começa com o
 * destino do visitante (funciona sem JavaScript) e, se o navegador tiver sessão,
 * passa a apontar para o painel, como para quem entrou pela página inicial.
 */
export function AbasCabecalho({ logadoNoServidor, className }: { logadoNoServidor: boolean; className: string }) {
  const [logado, setLogado] = useState(logadoNoServidor);
  useEffect(() => {
    if (logadoNoServidor) return;
    let ativo = true;
    temSessao().then((ok) => {
      if (ativo && ok) setLogado(true);
    });
    return () => {
      ativo = false;
    };
  }, [logadoNoServidor]);
  return (
    <>
      {navCabecalho(logado).map((item) => (
        <Link key={item.label} href={item.href} prefetch={prefetchDoLink(item.href)} className={className}>
          {item.label}
        </Link>
      ))}
    </>
  );
}
