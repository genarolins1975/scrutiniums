"use client";

import Link from "next/link";
import { useRef, type ReactNode } from "react";
import type { Natureza } from "@/lib/energia/tipos";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { IconeSetor, type TipoIcone } from "@/components/energia/IconeSetor";
import { Sparkline } from "@/components/energia/Sparkline";
import { umDe, useEstadoUrl } from "@/lib/energia/useEstadoUrl";

/**
 * "O sistema em uma tela": a assinatura visual do portal. Cinco blocos em
 * linha (água → geração → transmissão → consumo → preço), cada um com uma única
 * métrica essencial; o clique expande o detalhe abaixo, com a série recente, a
 * leitura em contexto e o caminho para o módulo. A ordem é didática, não
 * causal: as setas indicam a leitura, não uma relação de causa.
 */
export type BlocoSistema = {
  id: string;
  icone: TipoIcone;
  rotulo: string;
  valor: string;
  unidade?: string;
  contexto: string;
  natureza: Natureza;
  sparkline?: (number | null | undefined)[];
  referencia?: number | null;
  cor?: string;
  href: string;
  hrefRotulo: string;
  detalhe: ReactNode;
};

export function SistemaEmUmaTela({ blocos, chaveUrl = "bloco" }: { blocos: BlocoSistema[]; chaveUrl?: string }) {
  const ids = blocos.map((b) => b.id);
  const [aberto, setAberto] = useEstadoUrl<string>(chaveUrl, "", umDe(["", ...ids]));
  const painel = useRef<HTMLDivElement>(null);
  const atual = blocos.find((b) => b.id === aberto) ?? null;
  const alternar = (id: string) => {
    const novo = aberto === id ? "" : id;
    setAberto(novo);
    if (novo) window.requestAnimationFrame(() => painel.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  };
  return (
    <div>
      <ol className="grid gap-2 md:grid-cols-[repeat(5,minmax(0,1fr))] md:gap-0" aria-label="O sistema em uma tela">
        {blocos.map((b, i) => {
          const ativo = aberto === b.id;
          return (
            <li key={b.id} className="relative flex items-stretch md:pr-6 md:last:pr-0">
              <button
                type="button"
                onClick={() => alternar(b.id)}
                aria-expanded={ativo}
                aria-controls={`sistema-${chaveUrl}-detalhe`}
                className={`flex min-h-[44px] w-full flex-col items-start border px-4 py-3 text-left transition-colors ${
                  ativo ? "border-energia bg-energia-fundo" : "border-linha bg-superficie hover:border-energia"
                }`}
              >
                <span className={`rotulo flex items-center gap-2 ${ativo ? "text-carvao-muted" : "text-mineral"}`}>
                  <IconeSetor tipo={b.icone} tamanho={15} className="text-carvao-muted" />
                  {b.rotulo}
                </span>
                <span className="mt-2 font-serif text-[1.65rem] leading-none tabular-nums text-carvao">
                  {b.valor}
                  {b.unidade && <span className="ml-1 font-sans text-xs text-mineral">{b.unidade}</span>}
                </span>
                <span className="mt-2 text-xs leading-snug text-carvao-muted">{b.contexto}</span>
                {b.sparkline && (
                  <span className="mt-2 block">
                    <Sparkline valores={b.sparkline} cor={b.cor} referencia={b.referencia} largura={120} altura={26} />
                  </span>
                )}
                <span className="rotulo mt-2 !text-[0.62rem] text-energia-dark">{ativo ? "Fechar" : "Abrir"}</span>
              </button>
              {i < blocos.length - 1 && (
                <span aria-hidden="true" className="absolute right-1 top-1/2 hidden -translate-y-1/2 text-lg text-mineral md:block">
                  →
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <div ref={painel} id={`sistema-${chaveUrl}-detalhe`} aria-live="polite" className="scroll-mt-28">
        {atual && (
          <div className="mt-3 border border-energia bg-superficie p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="rotulo flex items-center gap-2 text-mineral">
                  <IconeSetor tipo={atual.icone} tamanho={15} className="text-carvao-muted" />
                  {atual.rotulo}
                </p>
                <p className="mt-2 flex flex-wrap items-center gap-3">
                  <span className="font-serif text-3xl leading-none tabular-nums text-carvao">
                    {atual.valor}
                    {atual.unidade && <span className="ml-1 font-sans text-sm text-mineral">{atual.unidade}</span>}
                  </span>
                  <SeloNatureza natureza={atual.natureza} />
                </p>
                <div className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao">{atual.detalhe}</div>
              </div>
              {atual.sparkline && (
                <div className="shrink-0">
                  <p className="rotulo text-mineral">Série recente</p>
                  <Sparkline valores={atual.sparkline} cor={atual.cor} referencia={atual.referencia} largura={220} altura={64} rotulo={`${atual.rotulo}: forma da série recente`} />
                </div>
              )}
            </div>
            <Link href={atual.href} className="rotulo mt-4 inline-flex min-h-[44px] items-center border border-carvao px-4 text-carvao hover:bg-carvao hover:text-marfim">
              {atual.hrefRotulo} <span aria-hidden="true" className="ml-2">→</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
