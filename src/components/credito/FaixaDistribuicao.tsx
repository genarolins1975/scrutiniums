import { num } from "@/lib/credito/formato";

type Stats = { n: number; min: number; p25: number; mediana: number; p75: number; max: number };

/** Topo do eixo: o primeiro valor "redondo" (1, 2, 2,5 ou 5 vezes uma potência de 10) que cobre o máximo. */
function topoDoEixo(max: number): { topo: number; passo: number } {
  if (!(max > 0)) return { topo: 1, passo: 0.25 };
  const bruto = max / 4;
  const pot = Math.pow(10, Math.floor(Math.log10(bruto)));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * pot).find((p) => p * 4 >= max) ?? 10 * pot;
  return { topo: Math.ceil(max / passo) * passo, passo };
}

/**
 * Distribuição das taxas de uma modalidade entre as instituições: cada ponto é uma instituição, a faixa marca o
 * intervalo entre o primeiro e o terceiro quartil (metade das instituições), a linha marca a mediana e o ponto em
 * destaque é a instituição escolhida. Eixo de zero até o maior valor, em % ao ano. HTML com posições em %, para
 * manter o texto legível em qualquer largura; os números estão também na lista ao lado (alternativa ao visual).
 */
export function FaixaDistribuicao({
  stats,
  taxas,
  destaque,
  nomeDestaque,
}: {
  stats: Stats;
  /** Taxa de cada instituição da modalidade, em % ao ano. */
  taxas: number[];
  destaque: number | null;
  nomeDestaque?: string;
}) {
  const { topo, passo } = topoDoEixo(stats.max);
  const x = (v: number) => (v / topo) * 100;
  // pontos empilhados por faixa de 1,5% da largura, para que instituições com taxas próximas não se escondam
  const LARGURA = 1.5;
  const pilhas = new Map<number, number>();
  const pontos = [...taxas]
    .sort((a, b) => a - b)
    .map((t) => {
      const balde = Math.round(x(t) / LARGURA);
      const nivel = pilhas.get(balde) ?? 0;
      pilhas.set(balde, nivel + 1);
      return { t, left: balde * LARGURA, nivel };
    });
  const niveis = Math.max(1, ...Array.from(pilhas.values()));
  const alturaPontos = niveis * 9 + 8;
  const marcas: number[] = [];
  for (let v = 0; v <= topo + 1e-9; v += passo) marcas.push(v);
  const casasEixo = passo < 1 ? 2 : passo < 10 && !Number.isInteger(passo) ? 1 : 0;
  const resumo = `Distribuição das taxas de ${stats.n} instituições, em % ao ano: mínimo ${num(stats.min)}, primeiro quartil ${num(stats.p25)}, mediana ${num(stats.mediana)}, terceiro quartil ${num(stats.p75)}, máximo ${num(stats.max)}${destaque !== null ? `. ${nomeDestaque ?? "Instituição escolhida"}: ${num(destaque)}` : ""}.`;

  return (
    <figure className="m-0">
      <div role="img" aria-label={resumo} className="relative px-1 pt-7">
        {/* rótulo da mediana, acima da área dos pontos */}
        <span
          className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-xs text-carvao-muted"
          style={{ left: `${Math.min(92, Math.max(8, x(stats.mediana)))}%` }}
          aria-hidden="true"
        >
          mediana {num(stats.mediana)}%
        </span>
        <div className="relative border-b border-carvao-muted" style={{ height: alturaPontos }}>
          {/* metade central: do primeiro ao terceiro quartil */}
          <div
            className="absolute inset-y-0 border-x border-mineral-soft bg-marfim"
            style={{ left: `${x(stats.p25)}%`, width: `${Math.max(0.4, x(stats.p75) - x(stats.p25))}%` }}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-carvao" style={{ left: `${x(stats.mediana)}%` }} aria-hidden="true" />
          {pontos.map((p, i) => (
            <span
              key={i}
              aria-hidden="true"
              className="absolute h-[7px] w-[7px] -translate-x-1/2 rounded-full border border-carvao-muted bg-superficie"
              style={{ left: `${p.left}%`, bottom: 4 + p.nivel * 9 }}
            />
          ))}
          {destaque !== null && (
            <span
              aria-hidden="true"
              className="absolute bottom-[-7px] h-[14px] w-[14px] -translate-x-1/2 rounded-full border-2 border-superficie bg-bronze-dark ring-1 ring-bronze-dark"
              style={{ left: `${x(destaque)}%` }}
            />
          )}
        </div>
        {/* eixo */}
        <div className="relative h-6 text-xs tabular-nums text-carvao-muted" aria-hidden="true">
          {marcas.map((m, i) => (
            <span
              key={m}
              className={`absolute top-1.5 whitespace-nowrap ${i === 0 ? "" : i === marcas.length - 1 ? "-translate-x-full" : "-translate-x-1/2"} ${i % 2 === 1 && i !== marcas.length - 1 ? "hidden sm:inline" : ""}`}
              style={{ left: `${x(m)}%` }}
            >
              {num(m, casasEixo)}%
            </span>
          ))}
        </div>
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-carvao-muted">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-[7px] w-[7px] rounded-full border border-carvao-muted bg-superficie" /> cada ponto é uma instituição
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-3 w-5 border-x border-mineral-soft bg-marfim" /> metade central das instituições (do 1º ao 3º quartil)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-3 w-0.5 bg-carvao" /> mediana
        </span>
        {destaque !== null && (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-[12px] w-[12px] rounded-full bg-bronze-dark" /> {nomeDestaque ?? "instituição escolhida"}
          </span>
        )}
      </figcaption>
    </figure>
  );
}
