"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Link de conta sensível à sessão num cabeçalho estático: visitante vê
 * "Entrar"; quem tem sessão vê "Minha conta". Mesma checagem da SPA do Crédito
 * (GET /api/auth/eu, resposta mínima sem PII).
 */
export function AcessoConta({ destino }: { destino: string }) {
  const [logado, setLogado] = useState(false);
  useEffect(() => {
    fetch("/api/auth/eu", { cache: "no-store" })
      .then((r) => setLogado(r.status === 204))
      .catch(() => setLogado(false));
  }, []);
  return logado ? (
    <Link href="/app/conta" className="rotulo inline-flex min-h-[44px] items-center text-carvao-muted hover:text-energia-dark">
      Minha conta
    </Link>
  ) : (
    <Link
      href={`/entrar?de=${encodeURIComponent(destino)}`}
      className="rotulo inline-flex min-h-[44px] items-center text-carvao-muted hover:text-energia-dark"
    >
      Entrar
    </Link>
  );
}
