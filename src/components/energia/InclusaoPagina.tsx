import type { ReactNode } from "react";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { InclusaoLinkPainel } from "@/components/energia/InclusaoLinkPainel";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { PAINEIS_INCLUSAO, ROTA_INCLUSAO, rotaPainel, type PainelInclusao } from "@/lib/energia/inclusao";

/**
 * Peças de servidor das páginas da Inclusão energética (a síntese em
 * /setor-eletrico/inclusao-energetica e um painel por página em
 * /tarifa-social, /cobertura, /orcamento e /acesso): navegação entre os
 * painéis, recorte (período, universo e unidade), rodapé com downloads, link
 * compartilhável e próxima pergunta, e os blocos dos modos Analisar e Auditar.
 *
 * Por que um painel por página: cada painel tem mapa, séries, tabelas e fichas de
 * prova; juntos, os quatro passavam de 900 KB de HTML, acima da meta de cerca de
 * 600 KB por página (contrato, seção 5.1).
 */

/** Navegação entre a síntese e os quatro painéis; o atual leva aria-current. */
export function InclusaoNavegacao({ atual }: { atual: PainelInclusao | "sintese" }) {
  const itens = [{ href: ROTA_INCLUSAO, rotulo: "Síntese", id: "sintese" as const }, ...PAINEIS_INCLUSAO.map((p) => ({ href: rotaPainel(p.id), rotulo: p.rotulo, id: p.id }))];
  return (
    <nav aria-label="Páginas da inclusão energética" className="pb-4">
      <ol className="nav-faixa flex flex-wrap gap-2 text-sm">
        {itens.map((i) => (
          <li key={i.id}>
            <Link
              href={i.href}
              aria-current={i.id === atual ? "page" : undefined}
              className={`inline-flex min-h-[44px] items-center border px-3 ${
                i.id === atual ? "border-energia bg-energia-fundo text-carvao" : "border-linha bg-superficie text-carvao-muted hover:border-energia hover:text-carvao"
              }`}
            >
              {i.rotulo}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Estado de ausência da gold inteira: a página diz o que falta, nunca mostra número de reserva. */
export function InclusaoIndisponivel({ motivo }: { motivo?: string | null }) {
  return (
    <>
      <CabecalhoEnergia atual="inclusao-energetica" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6 py-14">
        <Indisponivel
          titulo="Inclusão energética indisponível nesta publicação"
          motivo={
            motivo ??
            "A gold do módulo Inclusão energética (public/energia/gold/inclusao.json) não foi gerada ou não passou na validação; a última publicação válida é mantida quando existe."
          }
        />
      </main>
    </>
  );
}

/** Período, universo e unidade do painel, logo abaixo da resposta (anatomia da seção 7.2, item 3). */
export function InclusaoRecorte({ periodo, universo, unidade }: { periodo: ReactNode; universo: ReactNode; unidade: ReactNode }) {
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

/** Rodapé do painel: downloads, link compartilhável e a próxima pergunta (seção 7.2, itens 9 e 10). */
export function InclusaoSeguir({ ancora, href, pergunta, downloads }: { ancora: string; href: string; pergunta: string; downloads: { rotulo: string; url: string }[] }) {
  return (
    <div className="space-y-3 border-t border-linha pt-3">
      {downloads.length > 0 && (
        <div>
          <p className="rotulo text-mineral">Baixar os dados deste painel</p>
          <ul className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {downloads.map((d) => (
              <li key={d.url}>
                <a href={d.url} download className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
                  {d.rotulo}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <InclusaoLinkPainel ancora={ancora} />
        <p className="text-sm">
          <span className="rotulo mr-2 text-mineral">Próxima pergunta</span>
          <Link href={href} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
            {pergunta}
          </Link>
        </p>
      </div>
    </div>
  );
}

export function InclusaoAuditoria({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div data-nivel="auditar" className="space-y-3 border-t border-dashed border-linha pt-4">
      <h3 className="font-serif text-lg text-carvao">{titulo}</h3>
      {children}
    </div>
  );
}

export function InclusaoAnalise({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div data-nivel="analisar" className="space-y-3 border-t border-linha pt-5">
      <h3 className="font-serif text-lg text-carvao">{titulo}</h3>
      {children}
    </div>
  );
}

export function InclusaoSubtitulo({ children }: { children: ReactNode }) {
  return <h3 className="font-serif text-lg text-carvao">{children}</h3>;
}
