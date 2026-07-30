"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

/**
 * Erro global no padrão editorial. Client component obrigatório
 * pelo App Router; mantém tom institucional e ação de recuperação.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Registro local para diagnóstico; sem exposição de detalhes ao usuário.
    console.error(error);
  }, [error]);

  return (
    <main className="bg-marfim">
      <div className="mx-auto max-w-page px-6 py-24 md:py-32">
        <p className="rotulo text-mineral">Erro inesperado</p>
        <p className="mt-4 font-serif text-6xl text-erro md:text-7xl" aria-hidden="true">
          !
        </p>
        <h1 className="mt-4 font-serif text-3xl leading-snug text-carvao md:text-4xl">
          Algo saiu do esperado
        </h1>
        <p className="mt-4 max-w-prose2 text-carvao-muted">
          Ocorreu um erro ao carregar esta página. Você pode tentar novamente ou voltar para a
          página inicial.
        </p>
        {error.digest && (
          <p className="mt-3 text-xs text-mineral">Código de referência: {error.digest}</p>
        )}
        <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-linha pt-8">
          <Button variant="primary" onClick={reset}>
            Tentar novamente
          </Button>
          <Link
            href="/"
            className="rotulo inline-flex min-h-[44px] items-center text-carvao-muted underline underline-offset-4 hover:text-bronze"
          >
            Ir para a página inicial
          </Link>
        </div>
      </div>
    </main>
  );
}
