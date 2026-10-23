"use client";

import Link from "next/link";
import { usePaginaAberta, useSessao } from "@/components/acesso/sessao";
import { exigeConta, prefetchDoLink } from "@/lib/rotasPublicas";
import type { VersaoAberta as Versao } from "@/lib/busca/tipos";

/**
 * Linha "versão aberta" sob o primeiro resultado da busca quando ele pede conta e o tema tem página aberta (decisão do dono de
 * 23/10/2026, achado A7 do diagnóstico da busca): a ordem não muda, o leitor sem conta só fica sabendo onde o tema abre. Segue a
 * regra do selo "com conta": some com sessão e nas páginas fechadas, onde todos já têm conta.
 */
export function VersaoAberta({ destino, versao, foco }: { destino: string; versao: Versao; foco?: number }) {
  const pagina = usePaginaAberta();
  const logado = useSessao() === true;
  if (logado || !pagina || !exigeConta(destino) || exigeConta(versao.href)) return null;
  return (
    <Link
      href={versao.href}
      prefetch={prefetchDoLink(versao.href)}
      tabIndex={foco}
      data-versao-aberta=""
      className="-mx-2 flex min-h-[44px] items-center px-2 text-sm text-carvao-muted hover:text-carvao"
    >
      <span>
        <span className="text-mineral">Versão aberta do tema:</span> <span className="underline underline-offset-4">{versao.titulo}</span>
      </span>
    </Link>
  );
}
