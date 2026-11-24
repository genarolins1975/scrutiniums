import { mesCurto, mesExtenso, num, pontos, SEM_DADO, variacao } from "@/lib/varejo/formato";
import { eixo, linear, marcasDeTempo } from "./geometria";

/**
 * Colunas mês a mês a partir do zero, para uma diferença ou uma variação que tem sinal: acima do zero numa cor, abaixo em outra, e
 * a legenda diz o que cada lado significa (cor não é julgamento). O último mês leva o valor escrito. Colunas em SVG esticado, texto
 * em HTML; mês sem valor não ganha coluna (lacuna, nunca zero). A tabela equivalente fica com a figura que usa o componente.
 */
export function Colunas({ titulo, meses, valores, unidade, casas = 1, rotuloAcima, rotuloAbaixo, corAcima = "var(--escala-varejo-neg-2)", corAbaixo = "var(--escala-varejo-pos-2)", altura = 220 }: Readonly<{
  /** Nome acessível. */
  titulo: string;
  meses: readonly string[];
  valores: readonly (number | null)[];
  /** "p.p." (diferença entre duas variações) ou "%" (variação). */
  unidade: "p.p." | "%";
  casas?: number;
  /** O que significa a coluna acima do zero e a de baixo, para a legenda. */
  rotuloAcima: string;
  rotuloAbaixo: string;
  corAcima?: string;
  corAbaixo?: string;
  altura?: number;
}>) {
  const n = meses.length;
  const A = 200;
  const { min, max, marcas } = eixo(valores, { n: 4, incluir: 0 });
  const y = linear([min, max], [A, 0]);
  const fmt = (v: number | null) => (v === null ? SEM_DADO : unidade === "p.p." ? pontos(v, casas) : variacao(v, casas));
  let fim = n - 1;
  while (fim > 0 && valores[fim] === null) fim--;
  const ini = valores.findIndex((v) => v !== null);
  const validos = valores.filter((v): v is number => v !== null);
  const tempo = marcasDeTempo(meses);
  const ultimo = valores[fim] ?? null;
  const acima = validos.filter((v) => Number(v.toFixed(casas)) > 0).length;
  const abaixo = validos.filter((v) => Number(v.toFixed(casas)) < 0).length;
  return (
    <div data-grafico="colunas" data-figura-varejo="colunas" className="min-w-0">
      <p className="sr-only">
        {titulo}. {ini >= 0 ? `De ${mesExtenso(meses[ini])} a ${mesExtenso(meses[fim])}: ${num(acima)} meses acima de zero e ${num(abaixo)} abaixo; no último mês, ${fmt(ultimo)}.` : "Sem valores publicados no período."}
      </p>
      <div className="grid grid-cols-[2.75rem_minmax(0,1fr)] sm:grid-cols-[2.75rem_minmax(0,1fr)_5.5rem]" aria-hidden="true">
        <div className="relative" style={{ height: altura }}>
          {marcas.map((m) => (
            <span key={m} className={`absolute right-2 -translate-y-1/2 text-xs tabular-nums ${m === 0 ? "text-carvao" : "text-mineral"}`} style={{ top: `${(100 * y(m)) / A}%` }}>
              {m === 0 ? "0" : num(m, Number.isInteger(m) ? 0 : 1)}
            </span>
          ))}
        </div>
        <div className="relative" style={{ height: altura }}>
          <svg viewBox={`0 0 ${n} ${A}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" focusable="false" shapeRendering="crispEdges">
            {marcas.map((m) => (
              <line key={m} x1={0} x2={n} y1={y(m)} y2={y(m)} stroke={m === 0 ? "var(--cor-carvao)" : "var(--cor-grade)"} strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ))}
            {valores.map((v, i) => (v === null || v === 0 ? null : <rect key={i} x={i + 0.12} width={0.76} y={v > 0 ? y(v) : y(0)} height={Math.abs(y(v) - y(0))} fill={v > 0 ? corAcima : corAbaixo} />))}
          </svg>
        </div>
        {/* o último mês, com o valor escrito ao lado da coluna dele */}
        <div className="relative hidden sm:block" style={{ height: altura }}>
          {ultimo !== null && (
            <span className="absolute left-2 -translate-y-1/2 text-xs leading-tight text-carvao" style={{ top: `${Math.min(92, Math.max(8, (100 * y(ultimo / 2)) / A))}%` }}>
              <span className="block text-sm font-medium tabular-nums">{fmt(ultimo)}</span>
              <span className="block text-carvao-muted">{mesCurto(meses[fim])}</span>
            </span>
          )}
        </div>
        <span />
        <div className="relative mt-1.5 h-5">
          {tempo.map((t) => (
            <span key={t.i} className="absolute border-l border-mineral-soft pl-1 text-xs tabular-nums text-mineral" style={{ left: `${(100 * t.i) / n}%` }}>
              {t.rotulo}
            </span>
          ))}
        </div>
      </div>
      <ul className="t-meta mt-3 flex flex-wrap gap-x-5 gap-y-1 text-carvao-muted" aria-hidden="true">
        <li className="flex items-center gap-2">
          <span className="h-3 w-3 shrink-0" style={{ background: corAcima }} />
          {rotuloAcima}
        </li>
        <li className="flex items-center gap-2">
          <span className="h-3 w-3 shrink-0" style={{ background: corAbaixo }} />
          {rotuloAbaixo}
        </li>
        <li className="sm:hidden">
          Último mês, {mesCurto(meses[fim])}: <span className="tabular-nums text-carvao">{fmt(ultimo)}</span>
        </li>
      </ul>
    </div>
  );
}
