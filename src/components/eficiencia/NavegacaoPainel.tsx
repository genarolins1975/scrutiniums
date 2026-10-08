"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { CAMINHO_COMPARAR, CAMINHO_METODOS, ROTA_BASE, ROTULO_NAVEGACAO, href } from "@/lib/eficiencia/visao";

/**
 * Navegação curta e persistente do painel, igual no computador e no celular: Panorama, Gastos, Atendimento e Resultados;
 * "Comparar capitais" e "Dados e métodos" são ações à parte. A capital escolhida (?cap=) acompanha a pessoa entre as
 * visões, para voltar ao panorama sem perder o contexto. A visão atual é indicada por texto sublinhado e por
 * aria-current, não só por cor.
 */

const EVENTO = "scrutiniums:estado-url";

function assinar(cb: () => void) {
  window.addEventListener("popstate", cb);
  window.addEventListener(EVENTO, cb);
  return () => {
    window.removeEventListener("popstate", cb);
    window.removeEventListener(EVENTO, cb);
  };
}
const lerCap = () => new URLSearchParams(window.location.search).get("cap") ?? "";

export function NavegacaoPainel() {
  const caminho = usePathname() ?? "";
  const cap = useSyncExternalStore(assinar, lerCap, () => "");
  const relativo = caminho.startsWith(ROTA_BASE) ? caminho.slice(ROTA_BASE.length).replace(/\/$/, "") : "";
  const atual = (c: string) => relativo === c;
  const params = cap ? { cap } : {};
  const classeAba = (ativa: boolean) =>
    `inline-flex min-h-[44px] w-full items-center justify-center border-b-2 px-1 text-[0.8125rem] sm:px-3 sm:text-[0.9375rem] ${
      ativa ? "border-obee font-semibold text-obee-tinta" : "border-transparent text-carvao-muted hover:border-linha hover:text-obee-tinta"
    }`;
  const classeAcao = (ativa: boolean) =>
    `inline-flex min-h-[44px] items-center gap-1.5 px-1 text-[0.8125rem] underline-offset-4 sm:text-[0.9375rem] ${
      ativa ? "font-semibold text-obee-tinta underline" : "text-obee-dark hover:underline"
    }`;
  return (
    <nav aria-label="Visões do painel" className="mx-auto max-w-page px-4 sm:px-6">
      <div className="flex flex-col gap-x-6 sm:flex-row sm:items-end sm:justify-between">
        <ul className="grid grid-cols-4 sm:flex sm:gap-1">
          {ROTULO_NAVEGACAO.map((a) => (
            <li key={a.id} className="min-w-0">
              <Link href={href(a.caminho, params)} aria-current={atual(a.caminho) ? "page" : undefined} className={classeAba(atual(a.caminho))}>
                {a.rotulo}
              </Link>
            </li>
          ))}
        </ul>
        <ul className="flex flex-wrap gap-x-5 border-t border-linha sm:border-t-0">
          <li>
            <Link href={href(CAMINHO_COMPARAR, params)} aria-current={atual(CAMINHO_COMPARAR) ? "page" : undefined} className={classeAcao(atual(CAMINHO_COMPARAR))}>
              Comparar capitais <span aria-hidden="true">→</span>
            </Link>
          </li>
          <li>
            <Link href={href(CAMINHO_METODOS)} aria-current={atual(CAMINHO_METODOS) ? "page" : undefined} className={classeAcao(atual(CAMINHO_METODOS))}>
              Dados e métodos
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}
