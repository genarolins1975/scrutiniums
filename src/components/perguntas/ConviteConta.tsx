"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BotaoLink } from "@/components/home/BotaoLink";

/**
 * Convite para criar conta nas páginas abertas, que são estáticas: o servidor
 * não sabe se há sessão. O convite aparece por padrão (funciona sem
 * JavaScript) e some quando o navegador tem sessão, como as abas do cabeçalho.
 */
export function ConviteConta() {
  const [logado, setLogado] = useState(false);
  useEffect(() => {
    let ativo = true;
    fetch("/api/auth/eu", { cache: "no-store", credentials: "same-origin" })
      .then((r) => { if (ativo && r.status === 204) setLogado(true); })
      .catch(() => undefined);
    return () => { ativo = false; };
  }, []);
  if (logado) return <p className="mt-6 text-sm text-carvao-muted">Você já tem conta: os painéis abrem direto.</p>;
  return (
    <>
      <div className="mt-6 flex flex-wrap gap-3">
        <BotaoLink href="/cadastro">Criar conta gratuita</BotaoLink>
      </div>
      <p className="mt-3 text-sm text-carvao-muted">
        Já tem conta?{" "}
        <Link href="/entrar" className="text-carvao underline decoration-linha underline-offset-4">
          Entrar
        </Link>
        .
      </p>
    </>
  );
}
