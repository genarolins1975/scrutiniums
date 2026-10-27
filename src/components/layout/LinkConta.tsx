"use client";

import Link from "next/link";
import { useSessaoCompleta } from "@/components/acesso/sessao";

type Destino = { href: string; rotulo: string };

/**
 * Link de conta do cabeçalho público ("Entrar"/"Minha conta", "Criar
 * acesso"/"Observatórios"). Em páginas dinâmicas o servidor já sabe se há
 * sessão. Em páginas estáticas não sabe: o link começa no destino do visitante
 * (funciona sem JavaScript) e troca para o de quem tem conta quando o
 * navegador tem sessão.
 */
export function LinkConta({ autenticado, visitante, logado, className }: Readonly<{ autenticado: boolean; visitante: Destino; logado: Destino; className: string }>) {
  const comSessao = useSessaoCompleta(autenticado ? true : undefined);
  const d = comSessao ? logado : visitante;
  return (
    <Link href={d.href} prefetch={false} className={className}>
      {d.rotulo}
    </Link>
  );
}
