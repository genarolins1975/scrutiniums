import Link from "next/link";
import type { ReactNode } from "react";
import { LogoEmpresa } from "@/components/varejo/LogoEmpresa";
import { num, ordinal, pct, reaisDeMilhoes } from "@/lib/varejo/formato";
import type { LiderNoSegmento, LinhaPlataforma, ParDeListas } from "@/lib/varejo/grupos";
import { COR_RECEITA, COR_VOLUME, HACHURA } from "./escala";

const LINK = "underline decoration-linha underline-offset-4 [@media(hover:hover)]:hover:decoration-carvao";
const bi = (milhoes: number, casas = 1) => `R$ ${num(milhoes / 1000, casas)} bi`;

/**
 * A régua das plataformas: o valor negociado (GMV digital) de cada marketplace numa barra, todas na mesma escala e a partir do
 * zero. Quando a fonte publica a parte vendida por terceiros (3P), a barra se divide em venda própria (1P, cheia) e de terceiros
 * (clara); quando não publica, a barra fica inteira no neutro e diz "sem abertura". Valor estimado pela fonte leva hachura e a
 * palavra. Não é a venda do ranking: é tudo o que passou pela plataforma.
 */
export function ReguaPlataformas({ linhas, href, titulo }: Readonly<{ linhas: readonly LinhaPlataforma[]; href: (slug: string) => string | null; titulo: string }>) {
  const max = Math.max(0, ...linhas.map((l) => l.gmv_milhoes ?? 0));
  if (!(max > 0)) return null;
  const temAbertura = linhas.some((l) => l.terceiros_milhoes !== null);
  const temEstimado = linhas.some((l) => l.natureza === "estimado_pela_fonte");
  return (
    <div data-figura-varejo="regua-plataformas" data-regua-plataformas={linhas.length} className="min-w-0">
      <ul className="t-meta flex flex-wrap gap-x-6 gap-y-1 text-carvao-muted" aria-label="Como ler">
        {temAbertura && (
          <>
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="h-3 w-5 shrink-0" style={{ background: COR_VOLUME }} />
              venda própria (1P)
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="h-3 w-5 shrink-0 bg-gas-soft" />
              venda de terceiros (3P)
            </li>
          </>
        )}
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-3 w-5 shrink-0" style={{ background: "var(--serie-4)" }} />
          total, sem abertura publicada
        </li>
        {temEstimado && (
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="h-3 w-5 shrink-0 bg-mineral" style={{ backgroundImage: HACHURA }} />
            hachura: estimado pela fonte
          </li>
        )}
      </ul>
      <ol aria-label={titulo} className="mt-3 border-t border-carvao">
        {linhas.map((l) => {
          const estimado = l.natureza === "estimado_pela_fonte";
          const destino = l.slug ? href(l.slug) : null;
          const hachura = estimado ? { backgroundImage: HACHURA } : {};
          return (
            <li key={l.nome} data-plataforma={l.nome} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 border-b border-linha py-2 md:grid-cols-[84px_12rem_minmax(0,1fr)_13rem]">
              <LogoEmpresa slug={l.slug ?? `plataforma-${l.nome}`} nome={l.nome} tamanho="p" decorativo semLogo="placa" />
              <span className="min-w-0 text-sm leading-snug text-carvao">
                {destino ? (
                  <Link href={destino} prefetch={false} className={LINK}>
                    {l.nome}
                  </Link>
                ) : (
                  l.nome
                )}
              </span>
              <span className="col-span-3 row-start-2 block md:col-span-1 md:row-start-auto" aria-hidden="true">
                <span className="flex h-4 w-full">
                  {l.gmv_milhoes === null ? null : l.propria_milhoes !== null && l.terceiros_milhoes !== null ? (
                    <>
                      <span className="block h-full" style={{ width: `${(100 * l.propria_milhoes) / max}%`, background: COR_VOLUME, ...hachura }} />
                      <span className="block h-full bg-gas-soft" style={{ width: `${(100 * l.terceiros_milhoes) / max}%`, ...hachura }} />
                    </>
                  ) : (
                    <span className="block h-full min-w-[2px]" style={{ width: `${(100 * l.gmv_milhoes) / max}%`, background: "var(--serie-4)", ...hachura }} />
                  )}
                </span>
              </span>
              <span className="text-right text-sm tabular-nums text-carvao md:text-left">
                {l.gmv_milhoes === null ? <span className="text-xs italic text-mineral">não publicado</span> : bi(l.gmv_milhoes)}
                <span className="block text-xs text-carvao-muted">
                  {estimado ? "estimado pela fonte" : "divulgado"}
                  {l.terceiros_milhoes !== null ? ` · 3P: ${bi(l.terceiros_milhoes)}` : ""}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * O mesmo grupo em duas listas, na mesma régua a partir do zero: o valor do IRTT (círculo cheio) e o da outra lista (losango
 * vazado). Quando os dois coincidem, as marcas ficam uma sobre a outra e a coluna da direita diz "coincidem"; quando divergem, o
 * traço entre elas é a diferença, escrita em reais.
 */
export function ParesDeListas({ pares, outra, href, titulo }: Readonly<{ pares: readonly ParDeListas[]; outra: string; href: (slug: string) => string | null; titulo: string }>) {
  const max = Math.max(0, ...pares.flatMap((p) => [p.irtt_milhoes ?? 0, p.outra_milhoes]));
  if (!(max > 0)) return null;
  const x = (v: number) => 4 + (92 * v) / max;
  return (
    <div data-figura-varejo="pares-de-listas" data-pares-de-listas={pares.length} className="min-w-0">
      <ul className="t-meta flex flex-wrap gap-x-6 gap-y-1 text-carvao-muted" aria-label="Como ler">
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full" style={{ background: COR_VOLUME }} />
          IRTT
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rotate-45 bg-papel" style={{ boxShadow: `inset 0 0 0 2px ${COR_RECEITA}` }} />
          {outra}
        </li>
      </ul>
      <ol aria-label={titulo} className="mt-3 border-t border-carvao">
        {pares.map((p) => {
          const destino = p.tem_ficha ? href(p.slug) : null;
          const igual = p.diferenca_milhoes !== null && Math.abs(p.diferenca_milhoes) <= 1;
          const a = p.irtt_milhoes === null ? null : x(p.irtt_milhoes);
          const b = x(p.outra_milhoes);
          return (
            <li key={p.slug} data-par-de-listas={p.slug} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-linha py-2 md:grid-cols-[84px_11rem_minmax(0,1fr)_15rem]">
              <LogoEmpresa slug={p.slug} nome={p.grupo} tamanho="p" decorativo semLogo="placa" />
              <span className="min-w-0 text-sm leading-snug text-carvao">
                {destino ? (
                  <Link href={destino} prefetch={false} className={LINK}>
                    {p.grupo}
                  </Link>
                ) : (
                  p.grupo
                )}
              </span>
              <span className="relative col-span-3 row-start-2 block h-6 md:col-span-1 md:row-start-auto" aria-hidden="true">
                <span className="absolute inset-y-0 w-px bg-mineral" style={{ left: `${x(0)}%` }} />
                <span className="absolute top-1/2 h-px bg-linha" style={{ left: `${x(0)}%`, right: 0 }} />
                {a !== null && <span className="absolute top-1/2 h-[3px] -translate-y-1/2 bg-mineral-soft" style={{ left: `${Math.min(a, b)}%`, width: `${Math.abs(a - b)}%` }} />}
                <span className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-papel" style={{ left: `${b}%`, boxShadow: `inset 0 0 0 2px ${COR_RECEITA}` }} />
                {a !== null && <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${a}%`, background: COR_VOLUME }} />}
              </span>
              <span className="text-right text-sm tabular-nums text-carvao md:text-left">
                {p.irtt_milhoes === null ? <span className="text-xs italic text-mineral">sem valor no IRTT</span> : bi(p.irtt_milhoes)}
                <span className="block text-xs text-carvao-muted">
                  {p.diferenca_milhoes === null ? `${outra}: ${bi(p.outra_milhoes)}` : igual ? `${outra}: coincidem` : `${outra}: ${bi(p.outra_milhoes)} (${p.diferenca_milhoes > 0 ? "+" : "−"}${reaisDeMilhoes(Math.abs(p.diferenca_milhoes))})`}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * O líder de cada segmento dentro do segmento dele: a barra inteira são as vendas do segmento entre as 300 do ranking, todas na
 * mesma escala; o trecho cheio é a venda do líder. Mostra de uma vez o tamanho de cada segmento e quanto dele cabe à maior empresa.
 */
export function LideresDeSegmento({ lideres, href, titulo }: Readonly<{ lideres: readonly LiderNoSegmento[]; href: (slug: string) => string | null; titulo: string }>) {
  const max = Math.max(0, ...lideres.map((l) => l.vendas_segmento_milhoes ?? 0));
  if (!(max > 0)) return null;
  return (
    <div data-figura-varejo="lideres-de-segmento" data-lideres-de-segmento={lideres.length} className="min-w-0">
      <ul className="t-meta flex flex-wrap gap-x-6 gap-y-1 text-carvao-muted" aria-label="Como ler">
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-3 w-5 shrink-0" style={{ background: COR_VOLUME }} />
          venda do líder
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-3 w-5 shrink-0 bg-gas-fundo" style={{ boxShadow: "inset 0 0 0 1px var(--cor-gas-soft)" }} />
          demais empresas do segmento entre as 300
        </li>
      </ul>
      <ol aria-label={titulo} className="mt-3 border-t border-carvao">
        {lideres.map((l) => {
          const destino = l.slug && l.tem_ficha ? href(l.slug) : null;
          return (
            <li key={l.segmento_irtt} data-lider-de-segmento={l.slug ?? l.lider} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 border-b border-linha py-2.5 md:grid-cols-[84px_15rem_minmax(0,1fr)_11rem]">
              <LogoEmpresa slug={l.slug ?? `lider-${l.lider}`} nome={l.lider} tamanho="p" decorativo semLogo="placa" />
              <span className="min-w-0 text-sm leading-snug text-carvao">
                <span className="block text-xs text-carvao-muted">{l.segmento_irtt}</span>
                {destino ? (
                  <Link href={destino} prefetch={false} className={`font-medium ${LINK}`}>
                    {l.lider}
                  </Link>
                ) : (
                  <span className="font-medium">{l.lider}</span>
                )}
                {l.posicao_geral !== null && <span className="text-carvao-muted"> · {ordinal(l.posicao_geral)} no geral</span>}
              </span>
              <span className="col-span-2 block md:col-span-1" aria-hidden="true">
                {l.vendas_segmento_milhoes !== null && (
                  <span className="block h-4 bg-gas-fundo" style={{ width: `${(100 * l.vendas_segmento_milhoes) / max}%`, minWidth: 3, boxShadow: "inset 0 0 0 1px var(--cor-gas-soft)" }}>
                    {l.parte_do_lider_pct !== null && <span className="block h-full" style={{ width: `${Math.min(100, l.parte_do_lider_pct)}%`, minWidth: 2, background: COR_VOLUME, ...(l.natureza === "estimado_pela_fonte" ? { backgroundImage: HACHURA } : {}) }} />}
                  </span>
                )}
              </span>
              <span className="col-span-2 text-sm tabular-nums text-carvao md:col-span-1">
                {l.vendas_segmento_milhoes === null ? <span className="text-xs italic text-mineral">vendas do segmento não publicadas</span> : `${bi(l.vendas_segmento_milhoes, 1)} no segmento`}
                <span className="block text-xs text-carvao-muted">
                  {l.vendas_milhoes !== null ? `líder: ${bi(l.vendas_milhoes)}` : "venda do líder não publicada"}
                  {l.parte_do_lider_pct !== null ? `, ${pct(l.parte_do_lider_pct)} dele` : ""}
                  {l.natureza === "estimado_pela_fonte" ? " (estimado)" : ""}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Um conceito com um esquema de duas caixas (a loja da própria empresa e os vendedores hospedados): o que cada medida conta fica cheio. */
export function ConceitoEmEsquema({ rotulo, children, propria, terceiros }: Readonly<{ rotulo: string; children: ReactNode; propria: "cheia" | "vazia"; terceiros: "cheia" | "vazia" | "fatia" }>) {
  const vazia = { boxShadow: "inset 0 0 0 1px var(--cor-mineral)" };
  return (
    <div className="min-w-0 border-t border-carvao pt-3">
      <span aria-hidden="true" className="flex h-5 max-w-[11rem] gap-[3px]">
        <span className="block h-full flex-1" style={propria === "cheia" ? { background: COR_VOLUME } : vazia} />
        <span className="relative block h-full flex-[1.6]" style={terceiros === "cheia" ? { background: "var(--cor-gas-soft)" } : vazia}>
          {terceiros === "fatia" && <span className="absolute inset-y-0 left-0 w-[18%] bg-gas-soft" />}
        </span>
      </span>
      <dt className="mt-2.5 text-sm font-medium text-carvao">{rotulo}</dt>
      <dd className="mt-1 text-sm leading-relaxed text-carvao-muted">{children}</dd>
    </div>
  );
}
