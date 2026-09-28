import type { Faixa, Natureza, Regiao } from "@/lib/energia/tipos";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { ROTULO_FAIXA_USUAL } from "@/lib/energia/leituras";

/**
 * Reservatórios como colunas: a altura da coluna é a EAR máxima (100%), o
 * preenchimento é a EAR do dia e os três traços marcam onde a EAR esteve, no
 * mesmo dia do calendário, no 10º, 50º e 90º percentil dos anos anteriores.
 * De relance: quanto temos e quanto costumamos ter nesta data.
 */
export type ItemReservatorio = {
  sm: Regiao;
  nome: string;
  valor: number | null;
  p10: number | null;
  p50: number | null;
  p90: number | null;
  percentil: number | null;
  faixa: Faixa;
  variacao30pp: number | null;
  natureza: Natureza;
};

const fmt = (v: number | null, casas = 1) => (v === null ? "–" : `${v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`);

export function ColunasReservatorio({ itens, dia }: { itens: ItemReservatorio[]; dia: string }) {
  const W = 132;
  const H = 230;
  const topo = 14;
  const base = 216;
  const esc = base - topo;
  const y = (v: number) => base - (Math.max(0, Math.min(100, v)) / 100) * esc;
  const colX = 22;
  const colW = 54;
  return (
    <div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label={`Energia armazenada por subsistema em ${dia}`}>
        {itens.map((it) => {
          const v = it.valor;
          const marcas: { v: number | null; rotulo: string }[] = [
            { v: it.p90, rotulo: "P90" },
            { v: it.p50, rotulo: "mediana" },
            { v: it.p10, rotulo: "P10" },
          ];
          return (
            <li key={it.sm} className={`border bg-superficie p-3 ${it.sm === "SIN" ? "border-energia" : "border-linha"}`}>
              <p className="rotulo flex items-center justify-between gap-2 text-mineral">
                <span>{it.nome}</span>
                <SeloNatureza natureza={it.natureza} compacto />
              </p>
              <p className="mt-1 font-serif text-[1.75rem] leading-none tabular-nums text-carvao">{fmt(v)}</p>
              <p className="mt-1 text-xs text-carvao-muted">{it.faixa ? ROTULO_FAIXA_USUAL[it.faixa] : "sem faixa histórica"}</p>
              <svg
                viewBox={`0 0 ${W} ${H}`}
                className="mt-2 block h-auto w-full max-w-[9rem]"
                role="img"
                aria-label={`${it.nome}: EAR de ${fmt(v)} da máxima; mediana da data ${fmt(it.p50)}, 10º percentil ${fmt(it.p10)}, 90º percentil ${fmt(it.p90)}.`}
              >
                <rect x={colX} y={topo} width={colW} height={esc} fill="var(--cor-agua-fundo)" stroke="var(--cor-mapa-borda)" />
                {it.p10 !== null && it.p90 !== null && (
                  <rect x={colX} y={y(it.p90)} width={colW} height={Math.max(0, y(it.p10) - y(it.p90))} fill="color-mix(in srgb, var(--serie-referencia) 22%, transparent)" />
                )}
                {v !== null && <rect x={colX} y={y(v)} width={colW} height={Math.max(0, base - y(v))} fill="var(--serie-hidraulica)" opacity={0.85} />}
                {marcas.map((m) =>
                  m.v === null ? null : (
                    <g key={m.rotulo}>
                      <line x1={colX - 4} x2={colX + colW + 4} y1={y(m.v)} y2={y(m.v)} stroke="var(--cor-carvao)" strokeWidth={m.rotulo === "mediana" ? 1.6 : 1} strokeDasharray={m.rotulo === "mediana" ? undefined : "3 2"} />
                      <text x={colX + colW + 7} y={y(m.v) + 3.5} fontSize="11" fill="var(--cor-carvao-muted)">
                        {m.rotulo}
                      </text>
                    </g>
                  ),
                )}
                {v !== null && (
                  <text x={colX + colW / 2} y={Math.min(base - 4, Math.max(topo + 12, y(v) - 5))} fontSize="11" fontWeight="600" textAnchor="middle" fill="var(--cor-carvao)" className="tabular-nums">
                    {fmt(v, 0)}
                  </text>
                )}
                <text x={colX + colW / 2} y={H - 2} fontSize="10.5" textAnchor="middle" fill="var(--cor-mineral)">
                  0 a 100% da máxima
                </text>
              </svg>
              <dl className="mt-2 grid grid-cols-2 gap-x-2 text-xs">
                <dt className="text-mineral">Mediana</dt>
                <dd className="text-right tabular-nums text-carvao">{fmt(it.p50)}</dd>
                <dt className="text-mineral">Percentil</dt>
                <dd className="text-right tabular-nums text-carvao">{it.percentil === null ? "–" : it.percentil.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</dd>
                <dt className="text-mineral">30 dias</dt>
                <dd className="text-right tabular-nums text-carvao">{it.variacao30pp === null ? "–" : `${it.variacao30pp > 0 ? "+" : it.variacao30pp < 0 ? "−" : ""}${Math.abs(it.variacao30pp).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} p.p.`}</dd>
              </dl>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs leading-relaxed text-mineral">
        Coluna: capacidade máxima de armazenamento (EAR máxima). Preenchimento azul: EAR em {dia}. Área cinza e traços: faixa do 10º ao 90º percentil e
        mediana do mesmo dia do calendário nos anos completos desde 2001. O SIN é calculado pela plataforma; os subsistemas são publicados pelo ONS.
      </p>
    </div>
  );
}
