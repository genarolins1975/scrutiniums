import { dominioBonito, escalaLinear } from "@/lib/energia/escalas";
import { num } from "@/lib/energia/formato";
import type { FaixaRegime } from "@/lib/energia/pld";

/**
 * Distribuição do PLD horário por ano (cada ano é um regime de limites): linha do
 * percentil 10 ao 90, caixa do 25 ao 75, traço grosso na mediana, losango na
 * média e as marcas do piso e do teto estrutural do próprio ano. Os quantis vêm
 * prontos da gold; nada é recalculado. Sem estado: renderiza igual no servidor e no
 * navegador, com largura fluida (viewBox) e a tabela equivalente fora do desenho.
 *
 * O teto horário fica fora do eixo de propósito: com ele, a escala iria a mais de
 * R$ 1.500/MWh e espremeria as caixas; o valor está na tabela, e as horas no teto
 * horário estão no painel de limites.
 */
export function PldFaixas({ faixas, titulo }: { faixas: FaixaRegime[]; titulo: string }) {
  const valores = faixas.flatMap((f) => [f.p10, f.p90, f.media, f.piso, f.teto_e]);
  const dom = dominioBonito(valores, { zero: true, n: 5 });
  const L = 640;
  const esq = 96;
  const dir = 16;
  const alt = 34;
  const topo = 24;
  const H = topo + faixas.length * alt + 28;
  const x = escalaLinear([dom.min, dom.max], [esq, L - dir]);
  const resumo = faixas
    .map((f) => `${f.rotulo}: mediana ${num(f.p50, 2)}, de ${num(f.p10, 2)} (percentil 10) a ${num(f.p90, 2)} (percentil 90), piso ${num(f.piso, 2)}`)
    .join("; ");
  return (
    <figure className="min-w-0">
      <figcaption className="rotulo text-mineral">{titulo}</figcaption>
      <svg viewBox={`0 0 ${L} ${H}`} className="mt-2 w-full" role="img" aria-label={`${titulo}, R$/MWh. ${resumo}.`}>
        {dom.ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={topo - 6} y2={H - 24} stroke="var(--cor-grade)" strokeWidth={1} />
            <text x={x(t)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--cor-carvao-muted)" className="tabular-nums">
              {num(t, 0)}
            </text>
          </g>
        ))}
        {faixas.map((f, i) => {
          const y = topo + i * alt + alt / 2;
          const ok = (v: number | null): v is number => typeof v === "number" && Number.isFinite(v);
          return (
            <g key={f.id}>
              <text x={esq - 10} y={y + 4} textAnchor="end" fontSize="12" fill="var(--cor-carvao)">
                {f.rotulo}
              </text>
              {ok(f.p10) && ok(f.p90) && <line x1={x(f.p10)} x2={x(f.p90)} y1={y} y2={y} stroke="var(--cor-carvao-muted)" strokeWidth={1.5} />}
              {ok(f.p25) && ok(f.p75) && (
                <rect x={x(f.p25)} y={y - 8} width={Math.max(1, x(f.p75) - x(f.p25))} height={16} fill="var(--cor-energia-fundo)" stroke="var(--cor-energia-dark)" strokeWidth={1} />
              )}
              {ok(f.p50) && <line x1={x(f.p50)} x2={x(f.p50)} y1={y - 10} y2={y + 10} stroke="var(--cor-carvao)" strokeWidth={3} />}
              {ok(f.media) && (
                <path d={`M${x(f.media)},${y - 6} L${x(f.media) + 6},${y} L${x(f.media)},${y + 6} L${x(f.media) - 6},${y} Z`} fill="var(--cor-superficie)" stroke="var(--cor-carvao)" strokeWidth={1.5} />
              )}
              {ok(f.piso) && (
                <g>
                  <line x1={x(f.piso)} x2={x(f.piso)} y1={y - 14} y2={y + 14} stroke="var(--cor-energia)" strokeWidth={2} strokeDasharray="3 2" />
                </g>
              )}
              {ok(f.teto_e) && <line x1={x(f.teto_e)} x2={x(f.teto_e)} y1={y - 14} y2={y + 14} stroke="var(--cor-erro)" strokeWidth={2} strokeDasharray="1 2" />}
            </g>
          );
        })}
      </svg>
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
