import { fmtNumber } from "@/lib/format";
import type { EtapaFunil, PontoDiario } from "@/lib/adminStats";

/**
 * Gráficos do painel de administração: server components puros (SVG e
 * divs), sem JavaScript no cliente, no vocabulário visual da marca —
 * linhas finas, bronze como destaque, sem gradientes nem cantos
 * arredondados.
 */

/** Cartão de indicador (KPI). */
export function Indicador({
  rotulo,
  valor,
  detalhe,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
}) {
  return (
    <div className="border border-linha bg-papel px-5 py-4">
      <p className="rotulo mb-2 text-mineral">{rotulo}</p>
      <p className="font-serif text-3xl leading-none text-carvao">{valor}</p>
      {detalhe && <p className="mt-2 text-xs text-mineral">{detalhe}</p>}
    </div>
  );
}

/** Colunas diárias (últimos N dias) em SVG, com rótulos esparsos. */
export function ColunasDiarias({
  pontos,
  titulo,
  descricaoVazia = "Sem registros no período.",
}: {
  pontos: PontoDiario[];
  titulo: string;
  descricaoVazia?: string;
}) {
  const max = Math.max(...pontos.map((p) => p.valor), 0);
  const total = pontos.reduce((acc, p) => acc + p.valor, 0);
  const W = 600;
  const H = 150;
  const PAD_BOTTOM = 22;
  const PAD_TOP = 14;
  const n = pontos.length;
  const passo = W / n;
  const larguraBarra = Math.max(passo - 4, 3);
  const alturaUtil = H - PAD_BOTTOM - PAD_TOP;

  return (
    <figure>
      <figcaption className="mb-1 flex items-baseline justify-between gap-4">
        <span className="rotulo text-mineral">{titulo}</span>
        <span className="text-xs text-mineral">
          {total > 0 ? `${fmtNumber(total)} no período · pico ${fmtNumber(max)}/dia` : descricaoVazia}
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${titulo}: ${fmtNumber(total)} registros nos últimos ${n} dias`}
        className="block w-full"
      >
        {max > 0 && (
          <text x={0} y={PAD_TOP - 4} fontSize="10" className="fill-mineral">
            {fmtNumber(max)}
          </text>
        )}
        {max > 0 && (
          <line
            x1={0}
            y1={PAD_TOP}
            x2={W}
            y2={PAD_TOP}
            className="stroke-linha"
            strokeWidth="1"
            strokeDasharray="2 4"
          />
        )}
        {pontos.map((p, i) => {
          const h = max > 0 ? Math.round((p.valor / max) * alturaUtil) : 0;
          const x = i * passo + (passo - larguraBarra) / 2;
          return (
            <rect
              key={p.dia}
              x={x}
              y={H - PAD_BOTTOM - h}
              width={larguraBarra}
              height={Math.max(h, p.valor > 0 ? 2 : 0)}
              className="fill-bronze"
            >
              <title>{`${p.rotulo}: ${fmtNumber(p.valor)}`}</title>
            </rect>
          );
        })}
        <line
          x1={0}
          y1={H - PAD_BOTTOM}
          x2={W}
          y2={H - PAD_BOTTOM}
          className="stroke-carvao"
          strokeWidth="1"
        />
        {pontos.map((p, i) =>
          i % 7 === 0 || i === n - 1 ? (
            <text
              key={`t-${p.dia}`}
              x={i * passo + passo / 2}
              y={H - 7}
              fontSize="10"
              textAnchor="middle"
              className="fill-mineral"
            >
              {p.rotulo}
            </text>
          ) : null,
        )}
      </svg>
    </figure>
  );
}

/** Barras horizontais de ranking (trilha fina + preenchimento bronze). */
export function BarrasRanking({
  itens,
}: {
  itens: { rotulo: string; valor: number; detalhe?: string }[];
}) {
  const max = Math.max(...itens.map((i) => i.valor), 1);
  return (
    <ol className="space-y-4">
      {itens.map((item) => (
        <li key={item.rotulo}>
          <div className="mb-1 flex items-baseline justify-between gap-4 text-sm">
            <span className="text-carvao">{item.rotulo}</span>
            <span className="whitespace-nowrap text-carvao">
              {fmtNumber(item.valor)}
              {item.detalhe && <span className="ml-2 text-xs text-mineral">{item.detalhe}</span>}
            </span>
          </div>
          <div className="h-[6px] w-full bg-linha/40" aria-hidden="true">
            <div
              className="h-full bg-bronze"
              style={{ width: `${Math.max((item.valor / max) * 100, item.valor > 0 ? 1.5 : 0)}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Funil de onboarding: barra proporcional + conversão sobre a etapa anterior. */
export function Funil({ etapas }: { etapas: EtapaFunil[] }) {
  const base = etapas[0]?.valor ?? 0;
  return (
    <ol className="space-y-5">
      {etapas.map((etapa, i) => {
        const anterior = i > 0 ? etapas[i - 1].valor : null;
        const conversao =
          anterior && anterior > 0 ? Math.round((etapa.valor / anterior) * 100) : null;
        const largura = base > 0 ? Math.max((etapa.valor / base) * 100, etapa.valor > 0 ? 2 : 0) : 0;
        return (
          <li key={etapa.rotulo}>
            <div className="mb-1 flex items-baseline justify-between gap-4 text-sm">
              <span className="text-carvao">
                <span className="font-serif text-bronze" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>{" "}
                {etapa.rotulo}
              </span>
              <span className="whitespace-nowrap text-carvao">
                {fmtNumber(etapa.valor)}
                {conversao !== null && (
                  <span className="ml-2 text-xs text-mineral">{conversao}% da etapa anterior</span>
                )}
              </span>
            </div>
            <div className="h-[10px] w-full bg-linha/40" aria-hidden="true">
              <div className="h-full bg-carvao" style={{ width: `${largura}%` }} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
