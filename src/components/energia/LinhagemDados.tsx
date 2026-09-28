"use client";

import Link from "next/link";
import { IconeSetor, type TipoIcone } from "@/components/energia/IconeSetor";
import { umDe, useEstadoUrl } from "@/lib/energia/useEstadoUrl";

/**
 * Mapa de linhagem dos dados: da fonte ao portal, etapa a etapa, com o que
 * cada uma guarda, o que se confere nela e as contagens do próprio processamento
 * (fontes, capturas, arquivos processados, páginas, modelos). Cada etapa é um
 * botão; o painel abaixo explica e leva à evidência. Etapa fica na URL.
 */
export type EtapaLinhagem = {
  id: string;
  rotulo: string;
  icone: TipoIcone;
  numero: string;
  unidade: string;
  resumo: string;
  detalhes: string[];
  confere: string;
  href?: string;
  hrefRotulo?: string;
};

export function LinhagemDados({ etapas }: { etapas: EtapaLinhagem[] }) {
  const ids = etapas.map((e) => e.id);
  const [sel, setSel] = useEstadoUrl<string>("etapa", ids[0], umDe(ids));
  const atual = etapas.find((e) => e.id === sel) ?? etapas[0];
  return (
    <div>
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6" aria-label="Linhagem dos dados">
        {etapas.map((e, i) => {
          const ativo = e.id === atual.id;
          return (
            <li key={e.id} className="relative md:pr-5 md:last:pr-0">
              <button
                type="button"
                aria-pressed={ativo}
                aria-controls="linhagem-detalhe"
                onClick={() => setSel(e.id)}
                className={`flex min-h-[88px] w-full flex-col items-start border px-3 py-3 text-left transition-colors ${ativo ? "border-energia bg-energia-fundo" : "border-linha bg-superficie hover:border-energia"}`}
              >
                <span className={`rotulo flex items-center gap-2 ${ativo ? "text-carvao-muted" : "text-mineral"}`}>
                  <IconeSetor tipo={e.icone} tamanho={14} className={ativo ? "text-energia-dark" : "text-mineral"} />
                  {e.rotulo}
                </span>
                <span className="mt-2 font-serif text-2xl leading-none tabular-nums text-carvao">{e.numero}</span>
                <span className="mt-1 text-xs text-carvao-muted">{e.unidade}</span>
              </button>
              {i < etapas.length - 1 && (
                <span aria-hidden="true" className="absolute right-0.5 top-1/2 hidden -translate-y-1/2 text-mineral md:block">
                  →
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <div id="linhagem-detalhe" aria-live="polite" className="mt-3 border border-energia bg-superficie p-5 md:p-6">
        <p className="rotulo text-mineral">Etapa</p>
        <h3 className="mt-1 flex items-center gap-2 font-serif text-xl text-carvao">
          <IconeSetor tipo={atual.icone} tamanho={18} className="text-energia-dark" />
          {atual.rotulo}
        </h3>
        <p className="mt-2 max-w-prose2 text-sm leading-relaxed text-carvao">{atual.resumo}</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-relaxed text-carvao-muted">
          {atual.detalhes.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-carvao">
          <span className="rotulo mr-2 text-mineral">O que se confere aqui</span>
          {atual.confere}
        </p>
        {atual.href && (
          <Link href={atual.href} className="rotulo mt-4 inline-flex min-h-[44px] items-center border border-carvao px-4 text-carvao hover:bg-carvao hover:text-marfim">
            {atual.hrefRotulo ?? "Ver"} →
          </Link>
        )}
      </div>
    </div>
  );
}
