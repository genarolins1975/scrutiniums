"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Link de conta sensível à sessão num cabeçalho estático: visitante vê
 * "Entrar"; quem tem sessão vê "Minha conta". Consulta GET /api/auth/estado
 * (sempre 200, resposta mínima sem PII).
 */
export function AcessoConta({ destino }: { destino: string }) {
  const [logado, setLogado] = useState(false);
  // volta para a página onde o visitante estava; `destino` é o fallback
  const atual = usePathname() || destino;
  useEffect(() => {
    fetch("/api/auth/estado", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { logado: false }))
      .then((j: { logado?: boolean }) => setLogado(j.logado === true))
      .catch(() => setLogado(false));
  }, []);
  return logado ? (
    <Link href="/app/conta" className="rotulo inline-flex min-h-[44px] items-center text-carvao-muted hover:text-energia-dark">
      Minha conta
    </Link>
  ) : (
    <Link
      href={`/entrar?de=${encodeURIComponent(atual)}`}
      className="rotulo inline-flex min-h-[44px] items-center text-carvao-muted hover:text-energia-dark"
    >
      Entrar
    </Link>
  );
}
