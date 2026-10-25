"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Destino = { href: string; rotulo: string };

// Uma consulta por carregamento de página, compartilhada pelos links de conta do cabeçalho.
let consulta: Promise<boolean> | null = null;
function temSessao(): Promise<boolean> {
  consulta ??= fetch("/api/auth/estado", { cache: "no-store", credentials: "same-origin" })
    .then((r) => r.ok ? r.json() as Promise<{ logado?: boolean }> : { logado: false })
    .then((r) => r.logado === true)
    .catch(() => false);
  return consulta;
}

/**
 * Link de conta do cabeçalho público ("Entrar"/"Minha conta", "Criar
 * acesso"/"Observatórios"). Em páginas dinâmicas o servidor já sabe se há
 * sessão. Em páginas estáticas não sabe: o link começa no destino do visitante
 * (funciona sem JavaScript) e troca para o de quem tem conta quando o
 * navegador tem sessão.
 */
export function LinkConta({ autenticado, visitante, logado, className }: Readonly<{ autenticado: boolean; visitante: Destino; logado: Destino; className: string }>) {
  const [comSessao, setComSessao] = useState(autenticado);
  useEffect(() => {
    if (autenticado) return;
    let ativo = true;
    temSessao().then((ok) => {
      if (ativo && ok) setComSessao(true);
    });
    return () => {
      ativo = false;
    };
  }, [autenticado]);
  const d = comSessao ? logado : visitante;
  return (
    <Link href={d.href} prefetch={false} className={className}>
      {d.rotulo}
    </Link>
  );
}
