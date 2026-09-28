"use client";

import Link from "next/link";
import { useState } from "react";
import { IconeSetor, type TipoIcone } from "@/components/energia/IconeSetor";
import { umDe, useEstadoUrl } from "@/lib/energia/useEstadoUrl";

/**
 * Mapa conceitual do Aprenda: seis domínios em cadeia (natureza → geração →
 * sistema → mercado → preço → consumidor), cada um com os seus conceitos.
 * Clicar num conceito abre a prévia da microaula: a frase, o número de hoje e
 * o caminho para o verbete. Verbete em preparação aparece como tal, sem
 * definição. Domínio selecionado fica na URL.
 */
export type PreviaConceito = {
  slug: string;
  sigla?: string;
  nome: string;
  estado: "CONFERIDO" | "PENDENTE";
  frase: string | null;
  hoje: string | null;
};
export type DominioConceitual = { id: string; rotulo: string; icone: TipoIcone; descricao: string; conceitos: PreviaConceito[] };

export function MapaConceitual({ dominios }: { dominios: DominioConceitual[] }) {
  const ids = dominios.map((d) => d.id);
  const [dom, setDom] = useEstadoUrl<string>("dominio", ids[0], umDe(ids));
  const [slug, setSlug] = useState<string | null>(null);
  const atual = dominios.find((d) => d.id === dom) ?? dominios[0];
  const conceito = atual.conceitos.find((c) => c.slug === slug) ?? null;
  return (
    <div>
      <ol className="grid gap-2 md:grid-cols-6" aria-label="Domínios do sistema elétrico">
        {dominios.map((d, i) => {
          const ativo = d.id === atual.id;
          return (
            <li key={d.id} className="relative md:pr-5 md:last:pr-0">
              <button
                type="button"
                aria-pressed={ativo}
                onClick={() => {
                  setDom(d.id);
                  setSlug(null);
                }}
                className={`flex min-h-[72px] w-full flex-col items-start border px-3 py-3 text-left transition-colors ${ativo ? "border-energia bg-energia-fundo" : "border-linha bg-superficie hover:border-energia"}`}
              >
                <span className={`rotulo flex items-center gap-2 ${ativo ? "text-carvao-muted" : "text-mineral"}`}>
                  <span className="font-serif text-base normal-case tracking-normal text-energia">{i + 1}</span>
                  {d.rotulo}
                </span>
                <span className="mt-2 flex items-center gap-2 text-sm font-medium text-carvao">
                  <IconeSetor tipo={d.icone} tamanho={16} className={ativo ? "text-energia-dark" : "text-mineral"} />
                  {d.conceitos.length} {d.conceitos.length === 1 ? "conceito" : "conceitos"}
                </span>
              </button>
              {i < dominios.length - 1 && (
                <span aria-hidden="true" className="absolute right-0.5 top-1/2 hidden -translate-y-1/2 text-mineral md:block">
                  →
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="border border-linha bg-superficie p-5">
          <p className="rotulo text-mineral">{atual.rotulo}</p>
          <p className="mt-1 text-sm leading-relaxed text-carvao-muted">{atual.descricao}</p>
          <ul className="mt-3 flex flex-wrap gap-2" aria-label={`Conceitos de ${atual.rotulo}`}>
            {atual.conceitos.map((c) => (
              <li key={c.slug}>
                <button
                  type="button"
                  aria-pressed={slug === c.slug}
                  onClick={() => setSlug(c.slug)}
                  className={`rotulo inline-flex min-h-[44px] items-center gap-1.5 border px-3 ${slug === c.slug ? "border-energia bg-energia-fundo text-carvao" : "border-linha bg-superficie text-carvao hover:border-energia"}`}
                >
                  {c.sigla ?? c.nome}
                  {c.estado === "PENDENTE" && <span aria-hidden="true" className="text-aviso">○</span>}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-mineral">○ verbete em preparação, sem definição publicada.</p>
        </div>
        <div aria-live="polite" className="border border-linha bg-superficie p-5">
          {conceito ? (
            <>
              <p className="rotulo text-mineral">Microaula · prévia</p>
              <h3 className="mt-1 font-serif text-2xl leading-snug text-carvao">
                {conceito.sigla && <span className="mr-2">{conceito.sigla}</span>}
                <span className={conceito.sigla ? "text-carvao-muted" : ""}>{conceito.nome}</span>
              </h3>
              {conceito.estado === "CONFERIDO" && conceito.frase ? (
                <>
                  <p className="rotulo mt-4 text-mineral">Em uma frase</p>
                  <p className="mt-1 font-serif text-lg leading-relaxed text-carvao">{conceito.frase}</p>
                  <p className="rotulo mt-4 text-mineral">Hoje</p>
                  <p className="mt-1 text-sm leading-relaxed text-carvao">{conceito.hoje ?? "Exemplo com dado integrado ainda não disponível para este conceito."}</p>
                </>
              ) : (
                <p className="mt-4 text-sm leading-relaxed text-carvao-muted">
                  Verbete em preparação: a definição ainda não foi conferida na fonte primária e por isso não é publicada. A plataforma não escreve definições de memória.
                </p>
              )}
              <Link href={`/setor-eletrico/aprenda/${conceito.slug}`} className="rotulo mt-5 inline-flex min-h-[44px] items-center border border-carvao px-4 text-carvao hover:bg-carvao hover:text-marfim">
                Abrir a microaula <span aria-hidden="true" className="ml-2">→</span>
              </Link>
            </>
          ) : (
            <p className="text-sm leading-relaxed text-carvao-muted">Escolha um conceito à esquerda para ver a prévia da microaula: a frase, o número de hoje e o caminho para o verbete completo.</p>
          )}
        </div>
      </div>
    </div>
  );
}
