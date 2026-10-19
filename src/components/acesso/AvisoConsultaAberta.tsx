"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Cadeado } from "./SeloComConta";
import { hrefEntrar, textosAcesso, useSessao } from "./sessao";

/**
 * Faixa das consultas abertas (estratégia "aberto e com conta", leva 1, 19/10/2026): diz ao visitante
 * sem sessão que a consulta do seu caso é aberta e o que fica com a conta gratuita, marcado na página com
 * o selo "com conta". A página é estática: a faixa vem no HTML (funciona sem JavaScript) e some quando o
 * navegador tem sessão. `comConta` é a lista do que exige conta nesta página, numa frase.
 */
export function AvisoConsultaAberta({ comConta, className = "" }: { comConta: ReactNode; className?: string }) {
  const caminho = usePathname() ?? "/";
  const logado = useSessao();
  if (logado === true) return null;
  const en = caminho === "/en" || caminho.startsWith("/en/");
  const t = textosAcesso(caminho);
  return (
    <aside data-aviso-consulta-aberta="" aria-label={en ? "Open lookup" : "Consulta aberta"} className="border-b border-linha bg-marfim">
      <div className={`flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2.5 text-sm leading-relaxed text-carvao-muted ${className}`}>
        <p className="min-w-0 flex-1 basis-[28rem]">
          <span className="font-medium text-carvao">{en ? "Open lookup, no account needed." : "Consulta aberta, sem conta."}</span>{" "}
          {comConta}{" "}
          {en ? "are kept for the free account, marked " : "ficam com a conta gratuita, marcados com "}
          <span className="whitespace-nowrap">
            <span className="inline-flex items-center gap-1 text-xs text-mineral">
              <Cadeado /> {t.selo}
            </span>
            .
          </span>
        </p>
        <a href={hrefEntrar(caminho)} className="inline-flex min-h-[44px] items-center whitespace-nowrap text-carvao underline decoration-linha underline-offset-4 hover:decoration-carvao">
          {t.entrar}
        </a>
      </div>
    </aside>
  );
}
