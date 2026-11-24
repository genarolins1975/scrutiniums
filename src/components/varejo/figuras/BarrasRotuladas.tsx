import Link from "next/link";
import type { ReactNode } from "react";
import { num } from "@/lib/varejo/formato";
import { COR_VOLUME } from "./escala";

export type LinhaRotulada = {
  id: string;
  nome: ReactNode;
  valor: number | null;
  /** Texto do valor, já formatado ("+3,2%", "R$ 12,4 milhões"); sem ele, o número com `casas`. */
  texto?: string;
  /** Complemento discreto depois do nome ("2025", "estimativa da fonte"). */
  nota?: string;
  /** Linha de referência (o total, o Brasil): barra em neutro e nome em destaque. */
  referencia?: boolean;
  cor?: string;
  href?: string;
  selecionado?: boolean;
};

/**
 * Barras horizontais com o nome e o valor escritos em cada linha, todas a partir do zero e na mesma escala. Com valores negativos, o
 * zero vai para dentro da régua e as barras saem dele para os dois lados. Serve de lista ordenada ao lado de um mapa (os estados),
 * de figura de um indicador entre poucas empresas e de comparação contra uma referência. HTML no servidor; o nome pode ser link.
 * Linha sem valor diz "sem dado" e não desenha barra. Com `limiteInicial`, o resto fica num <details>, inteiro no HTML.
 */
export function BarrasRotuladas({ titulo, linhas, casas = 1, limiteInicial, rotuloMais = "Ver todas as linhas", larguraDoNome = "11rem" }: Readonly<{
  /** Nome acessível da lista. */
  titulo: string;
  linhas: readonly LinhaRotulada[];
  casas?: number;
  limiteInicial?: number;
  rotuloMais?: string;
  larguraDoNome?: string;
}>) {
  const validos = linhas.map((l) => l.valor).filter((v): v is number => v !== null);
  const min = Math.min(0, ...validos);
  const max = Math.max(0, ...validos);
  const amplitude = max - min || 1;
  const zero = (100 * (0 - min)) / amplitude;
  const linha = (l: LinhaRotulada) => {
    const largura = l.valor === null ? 0 : (100 * Math.abs(l.valor)) / amplitude;
    const esquerda = l.valor !== null && l.valor < 0 ? zero - largura : zero;
    const nome = l.href ? (
      <Link href={l.href} prefetch={false} scroll={false} aria-current={l.selecionado ? "true" : undefined} className="underline decoration-linha underline-offset-4 [@media(hover:hover)]:hover:decoration-carvao">
        {l.nome}
      </Link>
    ) : (
      l.nome
    );
    return (
      <li key={l.id} data-barra-rotulada={l.id} className={`grid min-h-[1.75rem] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 border-b border-linha py-1 sm:grid-cols-[var(--nome)_minmax(0,1fr)_auto] ${l.selecionado ? "bg-marfim" : ""}`}>
        <span className={`min-w-0 text-sm leading-snug text-carvao ${l.referencia || l.selecionado ? "font-medium" : ""}`}>
          {nome}
          {l.nota && <span className="font-normal text-carvao-muted"> · {l.nota}</span>}
        </span>
        <span className="col-span-2 row-start-2 block sm:col-span-1 sm:row-start-auto" aria-hidden="true">
          <span className="relative block h-3 w-full">
            {min < 0 && <span className="absolute inset-y-[-3px] w-px bg-mineral" style={{ left: `${zero}%` }} />}
            {l.valor !== null && <span className="absolute inset-y-0 min-w-[2px]" style={{ left: `${esquerda}%`, width: `${largura}%`, background: l.cor ?? (l.referencia ? "var(--serie-referencia)" : COR_VOLUME) }} />}
          </span>
        </span>
        <span className="w-[4.5rem] text-right text-sm tabular-nums text-carvao sm:w-[5rem]">{l.valor === null ? <span className="text-xs text-mineral">sem dado</span> : (l.texto ?? num(l.valor, casas))}</span>
      </li>
    );
  };
  const aVista = limiteInicial && limiteInicial < linhas.length ? linhas.slice(0, limiteInicial) : linhas;
  const resto = limiteInicial && limiteInicial < linhas.length ? linhas.slice(limiteInicial) : [];
  const estilo = { "--nome": larguraDoNome } as React.CSSProperties;
  return (
    <div data-figura-varejo="barras-rotuladas" className="min-w-0" style={estilo}>
      <ol aria-label={titulo} className="border-t border-linha">
        {aVista.map(linha)}
      </ol>
      {resto.length > 0 && (
        <details className="group/mais">
          <summary className="flex min-h-[44px] cursor-pointer items-center text-sm text-carvao-muted hover:text-carvao">
            <span className="group-open/mais:hidden">
              {rotuloMais}
            </span>
            <span className="hidden group-open/mais:inline">Mostrar menos</span>
          </summary>
          <ol aria-label={`${titulo}, continuação`} start={aVista.length + 1}>
            {resto.map(linha)}
          </ol>
        </details>
      )}
    </div>
  );
}
