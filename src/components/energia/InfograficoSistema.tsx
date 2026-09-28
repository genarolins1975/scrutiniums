"use client";

import Link from "next/link";
import { useRef, type CSSProperties } from "react";
import { IconeSetor, type TipoIcone } from "@/components/energia/IconeSetor";
import { NATUREZAS } from "@/components/evidencia/SeloNatureza";
import type { Natureza } from "@/lib/energia/tipos";
import { umDe, useEstadoUrl } from "@/lib/energia/useEstadoUrl";

/**
 * Infográfico mestre: como funciona o sistema elétrico brasileiro, em duas
 * cadeias exploráveis. A cadeia física vai da chuva ao consumidor; a cadeia da
 * operação vai dos modelos oficiais ao CMO e ao PLD. Cada etapa traz a frase
 * (só quando conferida em fonte primária, ou marcada como leitura usual), o
 * número de hoje com selo de natureza e o caminho para o módulo. As setas
 * indicam a ordem da leitura, não causa. Etapa escolhida fica na URL.
 */
export type EtapaSistema = {
  id: string;
  cadeia: "fisica" | "operacao";
  rotulo: string;
  icone: TipoIcone;
  frase: string;
  conferencia: "conferido" | "leitura" | "pendente";
  fonte: string;
  hoje: { valor: string; contexto: string; natureza: Natureza } | null;
  href: string;
  hrefRotulo: string;
  verbete?: string;
};

const CONF: Record<EtapaSistema["conferencia"], { rotulo: string; cls: string }> = {
  conferido: { rotulo: "● conferido na fonte", cls: "text-sucesso" },
  leitura: { rotulo: "leitura usual do setor, sem conferência documental", cls: "text-mineral" },
  pendente: { rotulo: "○ conferência documental pendente", cls: "text-aviso" },
};

export function InfograficoSistema({ etapas }: { etapas: EtapaSistema[] }) {
  const ids = etapas.map((e) => e.id);
  const padrao = etapas.find((e) => e.hoje)?.id ?? ids[0];
  const [sel, setSel] = useEstadoUrl<string>("etapa", padrao, umDe(ids));
  const atual = etapas.find((e) => e.id === sel) ?? etapas[0];
  const botoes = useRef<Record<string, HTMLButtonElement | null>>({});
  const fisica = etapas.filter((e) => e.cadeia === "fisica");
  const operacao = etapas.filter((e) => e.cadeia === "operacao");
  const mover = (delta: number) => {
    const i = ids.indexOf(sel);
    const j = Math.max(0, Math.min(ids.length - 1, i + delta));
    setSel(ids[j]);
    botoes.current[ids[j]]?.focus();
  };
  const Cadeia = ({ lista, rotulo }: { lista: EtapaSistema[]; rotulo: string }) => (
    <div>
      <p className="rotulo text-mineral">{rotulo}</p>
      <ol className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 md:[grid-template-columns:var(--colunas)]" style={{ "--colunas": `repeat(${lista.length}, minmax(0, 1fr))` } as CSSProperties} aria-label={rotulo}>
        {lista.map((e, i) => {
          const ativo = e.id === atual.id;
          return (
            <li key={e.id} className="relative min-w-0 md:pr-5 md:last:pr-0">
              <button
                ref={(el) => {
                  botoes.current[e.id] = el;
                }}
                type="button"
                aria-pressed={ativo}
                aria-controls="sistema-etapa"
                onClick={() => setSel(e.id)}
                onKeyDown={(ev) => {
                  if (ev.key === "ArrowRight") {
                    ev.preventDefault();
                    mover(1);
                  } else if (ev.key === "ArrowLeft") {
                    ev.preventDefault();
                    mover(-1);
                  }
                }}
                className={`flex min-h-[80px] w-full flex-col items-start border px-3 py-3 text-left transition-colors ${ativo ? "border-energia bg-energia-fundo" : "border-linha bg-superficie hover:border-energia"}`}
              >
                <IconeSetor tipo={e.icone} tamanho={20} className={ativo ? "text-energia-dark" : "text-mineral"} />
                <span className="mt-2 text-sm font-medium leading-snug text-carvao">{e.rotulo}</span>
                <span className={`mt-1 text-xs tabular-nums ${ativo ? "text-carvao-muted" : "text-mineral"}`}>{e.hoje ? e.hoje.valor : "sem dado integrado"}</span>
              </button>
              {i < lista.length - 1 && (
                <span aria-hidden="true" className="absolute right-0.5 top-1/2 hidden -translate-y-1/2 text-mineral md:block">
                  →
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
  const conf = CONF[atual.conferencia];
  return (
    <div>
      <Cadeia lista={fisica} rotulo="Cadeia física: da chuva ao consumidor" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Cadeia lista={operacao} rotulo="Em paralelo, a operação e o preço" />
        <p className="self-end text-xs leading-relaxed text-mineral">
          As duas cadeias se encontram nos modelos oficiais: o estado dos reservatórios, a carga, as renováveis, as térmicas e a rede entram como informação, e o resultado é o custo marginal (CMO) e, com as regras da CCEE, o PLD. As setas indicam a ordem da leitura, não uma relação de causa. Use as setas do teclado para percorrer as etapas.
        </p>
      </div>

      <section id="sistema-etapa" aria-live="polite" aria-labelledby="sistema-etapa-h" className="mt-6 border border-energia bg-superficie p-5 md:p-7">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div>
            <p className="rotulo text-mineral">{atual.cadeia === "fisica" ? "Cadeia física" : "Operação e preço"}</p>
            <h3 id="sistema-etapa-h" className="mt-1 flex items-center gap-2 font-serif text-2xl leading-snug text-carvao">
              <IconeSetor tipo={atual.icone} tamanho={22} className="text-energia-dark" />
              {atual.rotulo}
            </h3>
            <p className="mt-3 font-serif text-lg leading-relaxed text-carvao">{atual.frase}</p>
            <p className={`rotulo mt-2 ${conf.cls}`}>{conf.rotulo}</p>
            <p className="mt-1 text-xs text-mineral">Fonte: {atual.fonte}</p>
          </div>
          <div className="border-l border-linha pl-5 md:pl-6">
            <p className="rotulo text-mineral">Hoje</p>
            {atual.hoje ? (
              <>
                <p className="mt-1 font-serif text-3xl leading-none tabular-nums text-carvao">{atual.hoje.valor}</p>
                <p className="mt-2 text-sm leading-relaxed text-carvao-muted">{atual.hoje.contexto}</p>
                <p className="mt-2 text-xs text-mineral">
                  {NATUREZAS[atual.hoje.natureza].glifo} {NATUREZAS[atual.hoje.natureza].rotulo}
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm leading-relaxed text-carvao-muted">Nenhum dado desta etapa está integrado ao observatório nesta fase; os conjuntos correspondentes estão catalogados em Dados.</p>
            )}
            <div className="mt-4 flex flex-wrap gap-4">
              <Link href={atual.href} className="rotulo inline-flex min-h-[44px] items-center border border-carvao px-4 text-carvao hover:bg-carvao hover:text-marfim">
                {atual.hrefRotulo} →
              </Link>
              {atual.verbete && (
                <Link href={`/setor-eletrico/aprenda/${atual.verbete}`} className="rotulo inline-flex min-h-[44px] items-center text-carvao-muted underline underline-offset-4 hover:text-carvao">
                  Microaula
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
