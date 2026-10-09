import { dominioBonito, escalaLinear } from "@/lib/energia/escalas";
import { num } from "@/lib/energia/formato";
import type { FaixaRegime } from "@/lib/energia/pld";

/**
 * Distribuição do PLD horário por ano (cada ano é um regime de limites): linha do
 * percentil 10 ao 90, caixa do 25 ao 75, traço grosso na mediana, losango na
 * média e as marcas do piso e do teto estrutural do próprio ano. Os quantis vêm
 * prontos da gold; nada é recalculado. Sem estado: renderiza igual no servidor e no
 * navegador.
 *
 * O desenho é feito com blocos de página (posição em % da largura), e não com um SVG que encolhe: o texto dos anos e do eixo é texto da
 * página, com 12 px em qualquer largura (um SVG de 640 unidades em 316 px reduz a letra à metade). O eixo, a legenda e o resumo para
 * leitor de tela são os mesmos de antes.
 *
 * O teto horário fica fora do eixo de propósito: com ele, a escala iria a mais de
 * R$ 1.500/MWh e espremeria as caixas; o valor está na tabela, e as horas no teto
 * horário estão no painel de limites.
 */
const ok = (v: number | null): v is number => typeof v === "number" && Number.isFinite(v);

export function PldFaixas({ faixas, titulo }: { faixas: FaixaRegime[]; titulo: string }) {
  const valores = faixas.flatMap((f) => [f.p10, f.p90, f.media, f.piso, f.teto_e]);
  const dom = dominioBonito(valores, { zero: true, n: 5 });
  const x = escalaLinear([dom.min, dom.max], [0, 100]);
  const resumo = faixas
    .map((f) => `${f.rotulo}: mediana ${num(f.p50, 2)}, de ${num(f.p10, 2)} (percentil 10) a ${num(f.p90, 2)} (percentil 90), piso ${num(f.piso, 2)}`)
    .join("; ");
  return (
    <figure className="min-w-0">
      <figcaption className="rotulo text-mineral">{titulo}</figcaption>
      <div role="img" aria-label={`${titulo}, R$/MWh. ${resumo}.`} className="mt-2 pr-4" data-faixas-regime="">
        {faixas.map((f) => (
          <div key={f.id} className="flex items-center gap-2">
            <p className="w-[5.75rem] shrink-0 text-right text-xs text-carvao">{f.rotulo}</p>
            <div className="relative h-9 min-w-0 flex-1">
              {dom.ticks.map((t) => (
                <span key={t} aria-hidden="true" className="absolute inset-y-0 border-l" style={{ left: `${x(t)}%`, borderColor: "var(--cor-grade)" }} />
              ))}
              {ok(f.p10) && ok(f.p90) && (
                <span aria-hidden="true" className="absolute top-1/2 h-[1.5px] -translate-y-1/2" style={{ left: `${x(f.p10)}%`, width: `${Math.max(0, x(f.p90) - x(f.p10))}%`, background: "var(--cor-carvao-muted)" }} />
              )}
              {ok(f.p25) && ok(f.p75) && (
                <span
                  aria-hidden="true"
                  className="absolute top-1/2 h-4 min-w-px -translate-y-1/2 border"
                  style={{ left: `${x(f.p25)}%`, width: `${Math.max(0, x(f.p75) - x(f.p25))}%`, background: "var(--cor-energia-fundo)", borderColor: "var(--cor-energia-dark)" }}
                />
              )}
              {ok(f.p50) && <span aria-hidden="true" className="absolute top-1/2 h-5 w-[3px] -translate-x-1/2 -translate-y-1/2" style={{ left: `${x(f.p50)}%`, background: "var(--cor-carvao)" }} />}
              {ok(f.media) && (
                <span
                  aria-hidden="true"
                  className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-[1.5px]"
                  style={{ left: `${x(f.media)}%`, background: "var(--cor-superficie)", borderColor: "var(--cor-carvao)" }}
                />
              )}
              {ok(f.piso) && (
                <span aria-hidden="true" className="absolute top-1/2 h-7 -translate-x-px -translate-y-1/2 border-l-2 border-dashed" style={{ left: `${x(f.piso)}%`, borderColor: "var(--cor-energia)" }} />
              )}
              {ok(f.teto_e) && (
                <span aria-hidden="true" className="absolute top-1/2 h-7 -translate-x-px -translate-y-1/2 border-l-2 border-dotted" style={{ left: `${x(f.teto_e)}%`, borderColor: "var(--cor-erro)" }} />
              )}
            </div>
          </div>
        ))}
        <div className="flex gap-2">
          <span className="w-[5.75rem] shrink-0" aria-hidden="true" />
          <div className="relative h-6 min-w-0 flex-1" aria-hidden="true">
            {dom.ticks.map((t) => (
              <span key={t} className="absolute top-1 -translate-x-1/2 text-xs tabular-nums" style={{ left: `${x(t)}%`, color: "var(--cor-carvao-muted)" }}>
                {num(t, 0)}
              </span>
            ))}
          </div>
        </div>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-carvao-muted">
        <li>
          <span aria-hidden="true">─</span> percentil 10 a 90
        </li>
        <li>
          <span aria-hidden="true">▭</span> percentil 25 a 75
        </li>
        <li>
          <span aria-hidden="true">┃</span> mediana
        </li>
        <li>
          <span aria-hidden="true">◇</span> média
        </li>
        <li>
          <span aria-hidden="true">┆</span> piso do ano (tracejado)
        </li>
        <li>
          <span aria-hidden="true">┊</span> teto estrutural do ano (pontilhado)
        </li>
      </ul>
    </figure>
  );
}
