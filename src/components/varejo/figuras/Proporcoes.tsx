import type { ReactNode } from "react";
import { num, pct, SEM_DADO } from "@/lib/varejo/formato";
import { COR_VOLUME } from "./escala";

/**
 * Figuras de proporção do Varejo, em HTML desenhado no servidor (o texto é texto, nunca abaixo de 12 px): o quadro de cem blocos
 * (uma parte no todo), a barra de partes (do que se compõe um total) e a barra de uma parte (quanto de um total cabe num recorte).
 * Toda barra começa no zero e fecha em 100%. Ausência não vira zero: sem valor, a figura diz "sem dado" e não desenha a parte.
 */

/**
 * Cem blocos, `parte` deles cheios (arredondada à unidade): cada bloco é 1% do total. O percentual exato, o valor e o total vão em
 * texto ao lado; os blocos mostram a ordem de grandeza de relance e permitem comparar quadros vizinhos.
 */
export function QuadroDeCem({ rotulo, parte, valor, total, cor = COR_VOLUME, nomeDaParte, nomeDoTodo, className = "" }: Readonly<{
  rotulo: string;
  parte: number | null;
  /** Valor da parte, já formatado, com unidade ("R$ 3,20 trilhões", "1.175.862 empresas"). */
  valor: string;
  /** Valor do todo, já formatado. */
  total: string;
  cor?: string;
  nomeDaParte: string;
  nomeDoTodo: string;
  /** Classe extra da raiz: numa grade com linhas compartilhadas, `row-span-4 grid-rows-subgrid` alinha rótulo, número, blocos e texto entre quadros vizinhos. */
  className?: string;
}>) {
  const n = parte === null ? 0 : Math.max(0, Math.min(100, Math.round(parte)));
  return (
    <div data-figura-varejo="quadro-de-cem" data-quadro-de-cem="" className={`grid min-w-0 content-start gap-y-1 ${className}`}>
      <p className="t-meta self-end text-carvao-muted">{rotulo}</p>
      <p className="text-carvao">
        <span className="numero-g">{parte === null ? SEM_DADO : pct(parte, 0)}</span>
      </p>
      <div role="img" aria-label={parte === null ? `${rotulo}: sem dado` : `${rotulo}: ${nomeDaParte} responde por ${pct(parte)} de ${nomeDoTodo}`} className="mt-1 grid w-full max-w-[10.5rem] grid-cols-10 gap-[2px] sm:gap-[3px]">
        {Array.from({ length: 100 }, (_, i) => {
          // enche de baixo para cima, da esquerda para a direita: a parte "sobe" como um nível
          const linha = 9 - Math.floor(i / 10);
          const cheio = parte !== null && linha * 10 + (i % 10) < n;
          return <span key={i} className="block aspect-square" style={cheio ? { background: cor } : { boxShadow: "inset 0 0 0 1px var(--cor-linha)" }} />;
        })}
      </div>
      <p className="t-meta mt-1 text-carvao">
        {valor} <span className="text-carvao-muted">de {total}</span>
      </p>
    </div>
  );
}

export type Parte = { id: string; rotulo: string; parte: number | null; valor?: string; cor?: string };

/** Tons neutros das partes que não são o destaque, do mais escuro ao mais claro (o destaque leva o azul da coleção). */
const NEUTROS = ["var(--serie-4)", "var(--serie-2)", "var(--serie-6)", "var(--serie-5)", "var(--cor-mineral-soft)", "var(--cor-linha)"];

/** Fundos claros, sobre os quais o rótulo vai em carvão (nos demais, em papel): todos com 4,5:1 ou mais. */
const CLAROS = new Set(["var(--serie-2)", "var(--serie-5)", "var(--cor-mineral-soft)", "var(--cor-linha)"]);

/**
 * Do que se compõe um total: uma barra única de 100%, cada parte na largura exata, e a lista das partes logo abaixo, na mesma ordem,
 * com a cor, o valor e o percentual. As partes grandes levam o rótulo direto sobre a barra; as pequenas ficam só na lista, para
 * nenhum texto ser cortado. `destaque` pinta uma parte no azul da coleção; as demais ficam em neutros.
 */
export function BarraDePartes({ titulo, partes, destaque, casas = 1, colunas = 2 }: Readonly<{
  /** Nome acessível da barra. */
  titulo: string;
  partes: readonly Parte[];
  destaque?: string;
  casas?: number;
  colunas?: 1 | 2 | 3;
}>) {
  let k = 0;
  const cores = partes.map((p) => p.cor ?? (p.id === destaque ? COR_VOLUME : NEUTROS[Math.min(NEUTROS.length - 1, k++)]));
  const comValor = partes.filter((p) => p.parte !== null);
  return (
    <div data-grafico="barra-de-partes" data-figura-varejo="barra-de-partes" data-barra-de-partes="" className="min-w-0">
      {/* a parte em destaque, quando é estreita demais para o rótulo caber dentro, ganha o rótulo acima da barra, sobre ela */}
      {(() => {
        const i = partes.findIndex((p) => p.id === destaque);
        const d = partes[i];
        if (!d || d.parte === null || d.parte >= 14) return null;
        const antes = partes.slice(0, i).reduce((s2, p) => s2 + (p.parte ?? 0), 0);
        const centro = antes + d.parte / 2;
        return (
          <div className="relative h-7" aria-hidden="true">
            <span className={`absolute bottom-1 whitespace-nowrap text-sm text-carvao ${centro > 60 ? "-translate-x-full pr-2" : "pl-2"}`} style={{ left: `${centro}%` }}>
              <span className="font-medium">{d.rotulo}</span> <span className="tabular-nums">{pct(d.parte, casas)}</span>
            </span>
            <span className="absolute bottom-0 h-5 w-px bg-carvao" style={{ left: `${centro}%` }} />
          </div>
        );
      })()}
      <div role="img" aria-label={`${titulo}: ${comValor.map((p) => `${p.rotulo} ${pct(p.parte, casas)}`).join("; ")}`} className="flex h-12 w-full gap-px">
        {partes.map((p, i) =>
          p.parte === null ? null : (
            <span key={p.id} className="relative block h-full min-w-[2px]" style={{ width: `${p.parte}%`, background: cores[i] }}>
              {p.parte >= 14 && (
                <span className={`absolute inset-y-0 left-2 flex items-center text-sm tabular-nums ${CLAROS.has(cores[i]) ? "text-carvao" : "text-papel"}`}>{pct(p.parte, casas)}</span>
              )}
            </span>
          ),
        )}
      </div>
      <div className="mt-1 flex justify-between text-xs tabular-nums text-mineral" aria-hidden="true">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
      {/* a lista corre por colunas, de cima para baixo, para a ordem da barra ler-se na primeira coluna e seguir na outra */}
      <ul className={`mt-4 gap-x-10 ${colunas === 3 ? "sm:columns-2 lg:columns-3" : colunas === 2 ? "sm:columns-2" : ""}`}>
        {partes.map((p, i) => (
          <li key={p.id} className="flex break-inside-avoid items-baseline gap-3 border-t border-linha py-2 text-sm text-carvao">
            <span aria-hidden="true" className="h-3 w-3 shrink-0 translate-y-0.5" style={p.parte === null ? { boxShadow: "inset 0 0 0 1px var(--cor-mineral-soft)" } : { background: cores[i] }} />
            <span className={`min-w-0 flex-1 ${p.id === destaque ? "font-medium" : ""}`}>{p.rotulo}</span>
            {p.valor && <span className="shrink-0 tabular-nums text-carvao-muted">{p.valor}</span>}
            <span className="w-14 shrink-0 text-right tabular-nums">{p.parte === null ? SEM_DADO : pct(p.parte, casas)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Quanto de um total cabe num recorte: uma barra de 100% com a parte cheia e o rótulo ao lado. Várias empilhadas, com a mesma
 * largura, comparam recortes de totais diferentes (3% das empresas, 48% das pessoas).
 */
export function BarraDeUmaParte({ rotulo, parte, valor, total, cor = COR_VOLUME, nota }: Readonly<{
  rotulo: string;
  parte: number | null;
  valor: number | null;
  total: number | null;
  cor?: string;
  nota?: ReactNode;
}>) {
  return (
    <div data-figura-varejo="barra-de-uma-parte" data-barra-de-uma-parte="" className="min-w-0">
      <p className="flex flex-wrap items-baseline justify-between gap-x-4 text-sm text-carvao">
        <span>{rotulo}</span>
        <span className="tabular-nums">
          <span className="numero-p">{parte === null ? SEM_DADO : pct(parte)}</span>{" "}
          <span className="t-meta text-carvao-muted">
            {num(valor)} de {num(total)}
          </span>
        </span>
      </p>
      <div role="img" aria-label={`${rotulo}: ${parte === null ? "sem dado" : `${pct(parte)}, ${num(valor)} de ${num(total)}`}`} className="mt-1.5 h-5 w-full" style={{ boxShadow: "inset 0 0 0 1px var(--cor-mineral-soft)" }}>
        {parte !== null && <span className="block h-full min-w-[2px]" style={{ width: `${Math.max(0, Math.min(100, parte))}%`, background: cor }} />}
      </div>
      {nota && <p className="t-meta mt-1 text-carvao-muted">{nota}</p>}
    </div>
  );
}
