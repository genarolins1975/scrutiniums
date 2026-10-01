import type { ReactNode } from "react";
import Link from "next/link";
import { ContaLinkFiltros, ContaLinkPainel } from "@/components/energia/ContaLinkPainel";

/**
 * Peças de servidor comuns às duas páginas da Conta de luz (tarifas, composição e
 * simulador em /setor-eletrico/conta-de-luz; reajustes, bandeiras e subsídios em
 * /setor-eletrico/conta-de-luz/reajustes-e-subsidios): o recorte de cada painel
 * (período, universo e unidade), o rodapé com link compartilhável e próxima
 * pergunta, e o bloco de auditoria que só aparece no modo Auditar. Não é rota:
 * o App Router só publica page.tsx.
 */

export const ROTA_CONTA = "/setor-eletrico/conta-de-luz";
export const ROTA_REAJUSTES = "/setor-eletrico/conta-de-luz/reajustes-e-subsidios";

const CLASSE_LINK = "inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao";

export const FONTE_TARIFAS = "ANEEL, Tarifas de aplicação das distribuidoras de energia elétrica";

/** Período, universo e unidade do painel, logo abaixo da resposta (anatomia da seção 7.2, item 3). */
export function Recorte({ periodo, universo, unidade }: { periodo: ReactNode; universo: ReactNode; unidade: ReactNode }) {
  return (
    <dl className="grid gap-x-6 gap-y-1 text-xs text-carvao-muted sm:grid-cols-3">
      <div>
        <dt className="rotulo text-mineral">Período</dt>
        <dd className="mt-0.5">{periodo}</dd>
      </div>
      <div>
        <dt className="rotulo text-mineral">Universo</dt>
        <dd className="mt-0.5">{universo}</dd>
      </div>
      <div>
        <dt className="rotulo text-mineral">Unidade</dt>
        <dd className="mt-0.5">{unidade}</dd>
      </div>
    </dl>
  );
}

/** Rodapé de cada painel: link compartilhável e a próxima pergunta (seção 7.2, itens 9 e 10). */
export function Seguir({ ancora, href, pergunta }: { ancora: string; href: string; pergunta: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-linha pt-3">
      <ContaLinkPainel ancora={ancora} />
      <p className="text-sm">
        <span className="rotulo mr-2 text-mineral">Próxima pergunta</span>
        {href.startsWith("#") ? (
          <a href={href} className={CLASSE_LINK}>
            {pergunta}
          </a>
        ) : href.startsWith("/setor-eletrico/conta-de-luz") ? (
          <ContaLinkFiltros href={href} className={CLASSE_LINK}>
            {pergunta}
          </ContaLinkFiltros>
        ) : (
          <Link href={href} className={CLASSE_LINK}>
            {pergunta}
          </Link>
        )}
      </p>
    </div>
  );
}

export function Auditoria({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div data-nivel="auditar" className="space-y-3 border-t border-dashed border-linha pt-4">
      <h3 className="font-serif text-lg text-carvao">{titulo}</h3>
      {children}
    </div>
  );
}
