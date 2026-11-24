import type { CSSProperties, ReactNode } from "react";
import { areaEntre, caminho, linear } from "./geometria";
import { COR_RECEITA, COR_VOLUME } from "./escala";

/**
 * Miniaturas das figuras do Varejo, desenhadas no servidor com o dado real: para os números de escala da entrada, os cartões de
 * destino, as etiquetas de segmento e a versão aberta. São figuras de apoio: o valor que elas ilustram está sempre escrito ao lado,
 * por isso saem com `aria-hidden` (ou com `descricao`, quando são a figura principal do bloco). Nenhuma tem texto dentro do SVG.
 */

/** Linha de uma série curta, sem eixo, com o último ponto marcado. Lacuna interrompe a linha; menos de dois pontos, nada desenhado. */
export function MicroSerie({ valores, cor = COR_VOLUME, zero = false, altura = 36, className = "" }: Readonly<{
  valores: readonly (number | null)[];
  cor?: string;
  /** Traça a linha do zero (para variações): a série aparece acima ou abaixo dela. */
  zero?: boolean;
  altura?: number;
  className?: string;
}>) {
  const validos = valores.filter((v): v is number => v !== null);
  if (validos.length < 2) return null;
  const L = 200;
  const A = 40;
  const lo = Math.min(...validos, ...(zero ? [0] : []));
  const hi = Math.max(...validos, ...(zero ? [0] : []));
  const x = linear([0, valores.length - 1], [0, L]);
  const y = linear(lo === hi ? [lo - 1, hi + 1] : [lo, hi], [A - 4, 4]);
  let fim = valores.length - 1;
  while (fim > 0 && valores[fim] === null) fim--;
  return (
    <span aria-hidden="true" className={`relative block ${className}`} style={{ height: altura }} data-micro-serie="">
      <svg viewBox={`0 0 ${L} ${A}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" focusable="false">
        {zero && <line x1={0} x2={L} y1={y(0)} y2={y(0)} stroke="var(--cor-mineral-soft)" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
        <path d={caminho(valores, x, y)} fill="none" stroke={cor} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="absolute h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${(100 * x(fim)) / L}%`, top: `${(100 * y(valores[fim] as number)) / A}%`, background: cor }} />
    </span>
  );
}

/** Dez marcas, `n` delas cheias: "7 em cada 10". A parte é arredondada à dezena; o valor exato fica escrito ao lado. */
export function MicroProporcao({ parte, cor = COR_VOLUME, className = "" }: Readonly<{ parte: number | null; cor?: string; className?: string }>) {
  if (parte === null) return null;
  const n = Math.max(0, Math.min(10, Math.round(parte / 10)));
  return (
    <span aria-hidden="true" className={`flex items-end gap-[3px] ${className}`} data-micro-proporcao={n}>
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} className="block h-6 flex-1" style={i < n ? { background: cor } : { boxShadow: "inset 0 0 0 1px var(--cor-mineral-soft)" }} />
      ))}
    </span>
  );
}

/** Barra de uma parte no todo, fina, com o resto em contorno: a proporção de relance; o percentual vai escrito ao lado. */
export function MicroBarra({ parte, cor = COR_VOLUME, className = "" }: Readonly<{ parte: number | null; cor?: string; className?: string }>) {
  if (parte === null) return null;
  return (
    <span aria-hidden="true" className={`block h-6 ${className}`} style={{ boxShadow: "inset 0 0 0 1px var(--cor-mineral-soft)" }} data-micro-barra="">
      <span className="block h-full" style={{ width: `${Math.max(0, Math.min(100, parte))}%`, background: cor }} />
    </span>
  );
}

/**
 * A tesoura em miniatura: volume e receita em índice, com a área entre as duas, sem eixo. Com `rotulos`, traz o mês inicial e o
 * final embaixo e os dois nomes no fim das linhas (a figura da versão aberta); sem eles, é só o desenho (cartão de destino).
 */
export function TesouraMini({ volume, receita, altura = 64, descricao, children, className = "" }: Readonly<{
  volume: readonly (number | null)[];
  receita: readonly (number | null)[];
  altura?: number;
  /** Descrição acessível; sem ela a miniatura é decorativa (o número está escrito no cartão). */
  descricao?: string;
  /** Rótulos em HTML sobrepostos (posicionados por quem usa). */
  children?: ReactNode;
  className?: string;
}>) {
  const L = 400;
  const A = 100;
  const [min, max] = dominioDaMini(volume, receita);
  const x = linear([0, Math.max(1, volume.length - 1)], [0, L]);
  const y = linear([min, max], [A - 4, 4]);
  const area = areaEntre(receita, volume, x, y);
  const estilo = { height: altura } as CSSProperties;
  return (
    <span className={`relative block ${className}`} style={estilo} data-tesoura-mini="" role={descricao ? "img" : undefined} aria-label={descricao} aria-hidden={descricao ? undefined : true}>
      <svg viewBox={`0 0 ${L} ${A}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true" focusable="false">
        <line x1={0} x2={L} y1={y(100)} y2={y(100)} stroke="var(--cor-mineral-soft)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        {area.acima && <path d={area.acima} fill="var(--escala-varejo-neg-1)" fillOpacity={0.6} />}
        {area.abaixo && <path d={area.abaixo} fill="var(--escala-varejo-pos-1)" fillOpacity={0.6} />}
        <path d={caminho(receita, x, y)} fill="none" stroke={COR_RECEITA} strokeWidth={1.75} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <path d={caminho(volume, x, y)} fill="none" stroke={COR_VOLUME} strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      {children}
    </span>
  );
}

/** Domínio justo da miniatura: do menor ao maior valor das duas séries, com a base 100 sempre dentro. Sem marcas de eixo, não há por que arredondar. */
function dominioDaMini(volume: readonly (number | null)[], receita: readonly (number | null)[]): [number, number] {
  const validos = [...volume, ...receita].filter((v): v is number => v !== null);
  const lo = Math.min(100, ...validos);
  const hi = Math.max(100, ...validos);
  return lo === hi ? [lo - 1, hi + 1] : [lo, hi];
}

/** Posição vertical, em % da altura, de um valor na miniatura da tesoura (para quem sobrepõe rótulos). */
export function topoNaTesouraMini(volume: readonly (number | null)[], receita: readonly (number | null)[], valor: number): number {
  return linear(dominioDaMini(volume, receita), [96, 4])(valor);
}

/** Barras horizontais mínimas, do maior para o menor, na mesma escala (cartão de destino dos grupos). Decorativa: os valores estão na página de destino. */
export function MicroBarras({ valores, cor = COR_VOLUME, className = "" }: Readonly<{ valores: readonly number[]; cor?: string; className?: string }>) {
  const max = Math.max(...valores, 0);
  if (!(max > 0)) return null;
  return (
    <span aria-hidden="true" className={`flex flex-col justify-between gap-[3px] ${className}`} data-micro-barras="">
      {valores.map((v, i) => (
        <span key={i} className="block h-[7px]" style={{ width: `${(100 * v) / max}%`, background: cor, opacity: i === 0 ? 1 : 0.55 }} />
      ))}
    </span>
  );
}

/** O mapa de blocos em miniatura: os 27 estados coloridos pela escala divergente, sem texto. Decorativa: o cartão diz o número. */
export function MapaBlocosMini({ cores, altura = 64, className = "" }: Readonly<{
  /** Cor de cada UF (var(--escala-varejo-*)), ou null para o estado sem valor. */
  cores: Readonly<Record<string, string | null>>;
  altura?: number;
  className?: string;
}>) {
  return (
    <span aria-hidden="true" className={`grid w-fit grid-cols-6 grid-rows-[repeat(8,1fr)] gap-px ${className}`} style={{ height: altura, aspectRatio: "6 / 8" }} data-mapa-blocos-mini="">
      {Object.entries(GRADE_UF_MINI).map(([uf, [col, lin]]) => (
        <span key={uf} className="block" style={{ gridColumn: col, gridRow: lin, ...(cores[uf] ? { background: cores[uf] as string } : { boxShadow: "inset 0 0 0 1px var(--cor-mineral-soft)" }) }} />
      ))}
    </span>
  );
}

/** A mesma grade do MapaBlocos (figuras/MapaBlocos.tsx); repetida aqui para a miniatura não puxar o componente inteiro. */
const GRADE_UF_MINI: Record<string, readonly [number, number]> = {
  RR: [2, 1], AP: [3, 1], AC: [1, 2], AM: [2, 2], PA: [3, 2], MA: [4, 2], CE: [5, 2], RN: [6, 2], RO: [2, 3], TO: [3, 3], PI: [4, 3], PE: [5, 3], PB: [6, 3],
  MT: [2, 4], GO: [3, 4], BA: [4, 4], SE: [5, 4], AL: [6, 4], MS: [2, 5], DF: [3, 5], MG: [4, 5], ES: [5, 5], SP: [3, 6], RJ: [4, 6], PR: [3, 7], SC: [4, 7], RS: [3, 8],
};

/** Duas (ou mais) barras de R$ 100 empilhadas, na mesma escala: a comparação entre companhias em miniatura. Decorativa. */
export function MicroCupons({ lojas, className = "" }: Readonly<{ lojas: readonly { id: string; partes: readonly { cor: string; valor: number }[] }[]; className?: string }>) {
  const escala = Math.max(100, ...lojas.map((l) => l.partes.reduce((s, p) => s + p.valor, 0)));
  return (
    <span aria-hidden="true" className={`flex flex-col justify-center gap-2 ${className}`} data-micro-cupons="">
      {lojas.map((l) => (
        <span key={l.id} className="flex h-4 w-full">
          {l.partes.map((p, i) => (
            <span key={i} className="block h-full" style={{ width: `${(100 * p.valor) / escala}%`, background: p.cor }} />
          ))}
        </span>
      ))}
    </span>
  );
}
