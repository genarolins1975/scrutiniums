import { mesCurto, mesExtenso, num } from "@/lib/varejo/formato";
import { caminho, eixo, linear, marcasDeTempo } from "./geometria";

/**
 * Uma série de contexto num gráfico pequeno, para andar em grade com outras (pequenos múltiplos): mesma altura, mesmo período no
 * eixo do tempo, cada uma na sua unidade e na sua escala (por isso não se comparam níveis entre os gráficos). O último valor leva
 * rótulo direto; o eixo vertical traz só as marcas redondas. Lacuna interrompe a linha e o começo da lacuna é dito em `nota`.
 * Linha em SVG esticado; todo texto em HTML. A tabela equivalente fica com a figura que reúne os gráficos.
 */
export function LinhaContexto({ titulo, meses, valores, unidade, casas = 1, cor = "var(--serie-4)", altura = 180 }: Readonly<{
  titulo: string;
  meses: readonly string[];
  valores: readonly (number | null)[];
  unidade: string;
  casas?: number;
  cor?: string;
  altura?: number;
}>) {
  const n = meses.length;
  const L = 600;
  const A = 200;
  const { min, max, marcas } = eixo(valores, { n: 3 });
  const x = linear([0, Math.max(1, n - 1)], [0, L]);
  const y = linear([min, max], [A - 4, 4]);
  let fim = n - 1;
  while (fim > 0 && valores[fim] === null) fim--;
  const ini = valores.findIndex((v) => v !== null);
  const ultimo = valores[fim];
  const tempo = marcasDeTempo(meses, 6);
  const casasEixo = marcas.every((m) => Number.isInteger(m)) ? 0 : 1;
  if (ini < 0 || ultimo === null) return <p className="t-meta italic text-mineral" data-grafico="linha-contexto">Sem valores publicados no período.</p>;
  const topo = (100 * y(ultimo)) / A;
  return (
    <div
      data-grafico="linha-contexto"
      data-figura-varejo="linha-contexto"
      role="img"
      aria-label={`${titulo}, ${unidade}: de ${num(valores[ini], casas)} em ${mesExtenso(meses[ini])} a ${num(ultimo, casas)} em ${mesExtenso(meses[fim])}.`}
      className="grid min-w-0 grid-cols-[2.75rem_minmax(0,1fr)_4rem]"
    >
      <div className="relative" style={{ height: altura }} aria-hidden="true">
        {marcas.map((m) => (
          <span key={m} className="absolute right-2 -translate-y-1/2 text-xs tabular-nums text-mineral" style={{ top: `${(100 * y(m)) / A}%` }}>
            {num(m, casasEixo)}
          </span>
        ))}
      </div>
      <div className="relative" style={{ height: altura }} aria-hidden="true">
        <svg viewBox={`0 0 ${L} ${A}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" focusable="false">
          {marcas.map((m) => (
            <line key={m} x1={0} x2={L} y1={y(m)} y2={y(m)} stroke="var(--cor-grade)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
          <path d={caminho(valores, x, y)} fill="none" stroke={cor} strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${(100 * x(fim)) / L}%`, top: `${topo}%`, background: cor }} />
      </div>
      {/* rótulo direto do último valor, numa calha à direita, na altura do ponto: nunca sobre a linha */}
      <div className="relative" style={{ height: altura }} aria-hidden="true">
        <span className="absolute left-2 -translate-y-1/2 whitespace-nowrap text-xs leading-tight text-carvao" style={{ top: `${Math.min(90, Math.max(10, topo))}%` }}>
          <span className="block text-sm font-medium tabular-nums">{num(ultimo, casas)}</span>
          <span className="block text-carvao-muted">{mesCurto(meses[fim])}</span>
        </span>
      </div>
      <span aria-hidden="true" />
      <div className="relative mt-1.5 h-5" aria-hidden="true">
        {tempo.map((t) => (
          <span key={t.i} className={`absolute text-xs tabular-nums text-mineral ${(100 * x(t.i)) / L < 5 ? "" : (100 * x(t.i)) / L > 95 ? "-translate-x-full" : "-translate-x-1/2"}`} style={{ left: `${(100 * x(t.i)) / L}%` }}>
            {t.rotulo}
          </span>
        ))}
      </div>
      <span aria-hidden="true" />
    </div>
  );
}
