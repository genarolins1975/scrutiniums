"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { SeloComConta } from "@/components/acesso/SeloComConta";
import { prefetchDoLink } from "@/lib/rotasPublicas";

/** Uma visão do tema: o caminho relativo à rota do tema ('' é o panorama) e o rótulo da aba. */
export type AbaTema = readonly [caminho: string, rotulo: string];

/**
 * Abas de um tema da Eficiência Estatal, no molde da Saúde nas capitais (diagnóstico de layout de 20/10/2026, item 10):
 * as visões à esquerda, sublinhadas na atual (aria-current, não só cor), e as ações de conferência à direita
 * ("Comparar", "Dados e métodos"). Rótulos e ordem vêm de cada tema; o desenho é um só.
 * `levar` lista os parâmetros do recorte que acompanham a pessoa entre as visões (ex.: território na Mobilidade): lidos
 * no clique, do endereço atual, para valerem também depois de uma troca de filtro feita na mesma página.
 */
export function NavegacaoTemaObee({ rota, nome, abas, acoes = [], levar = [] }: { rota: string; nome: string; abas: readonly AbaTema[]; acoes?: readonly AbaTema[]; levar?: readonly string[] }) {
  const caminho = (usePathname() ?? "").replace(/\/$/, "");
  const router = useRouter();
  const href = (c: string) => (c ? `${rota}/${c}` : rota);
  const comRecorte = (destino: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (!levar.length || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const atualQ = new URLSearchParams(window.location.search), q = new URLSearchParams();
    for (const k of levar) { const v = atualQ.get(k); if (v) q.set(k, v); }
    if (!q.size) return;
    e.preventDefault();
    router.push(`${destino}?${q.toString()}`);
  };
  const atual = (c: string) => caminho === href(c);
  const classeAba = (ativa: boolean) =>
    `inline-flex min-h-[44px] items-center border-b-2 px-1 text-[0.8125rem] sm:px-2 sm:text-[0.9375rem] ${
      ativa ? "border-obee font-semibold text-obee-tinta" : "border-transparent text-carvao-muted hover:border-linha hover:text-obee-tinta"
    }`;
  const classeAcao = (ativa: boolean) =>
    `inline-flex min-h-[44px] items-center gap-1.5 px-1 text-[0.8125rem] underline-offset-4 sm:text-[0.9375rem] ${ativa ? "font-semibold text-obee-tinta underline" : "text-obee-dark hover:underline"}`;
  return (
    <nav aria-label={`Visões do tema ${nome}`} className="mx-auto max-w-page px-4 sm:px-6">
      <div className="flex flex-col gap-x-8 lg:flex-row lg:items-end lg:justify-between">
        <ul className="flex flex-wrap gap-x-3 sm:gap-x-2">
          {abas.map(([c, rotulo]) => (
            <li key={c} className="min-w-0">
              <Link prefetch={prefetchDoLink(href(c))} href={href(c)} onClick={comRecorte(href(c))} aria-current={atual(c) ? "page" : undefined} className={classeAba(atual(c))}>
                {rotulo}
                <SeloComConta href={href(c)} />
              </Link>
            </li>
          ))}
        </ul>
        {acoes.length > 0 && (
          <ul className="flex flex-wrap gap-x-5 border-t border-linha lg:shrink-0 lg:flex-nowrap lg:whitespace-nowrap lg:border-t-0">
            {acoes.map(([c, rotulo]) => (
              <li key={c}>
                <Link prefetch={prefetchDoLink(href(c))} href={href(c)} onClick={comRecorte(href(c))} aria-current={atual(c) ? "page" : undefined} className={classeAcao(atual(c))}>
                  {rotulo}
                  <SeloComConta href={href(c)} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </nav>
  );
}
