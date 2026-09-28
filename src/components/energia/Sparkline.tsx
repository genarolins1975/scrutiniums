/**
 * Sparkline: a forma da série ao lado do número, sem eixos. Ausência é lacuna
 * (nunca zero). Referência opcional (mediana, 100% da MLT) como linha
 * tracejada; faixa opcional (10º a 90º percentil) como área recessiva. Puro
 * SVG, sem estado: serve em componentes de servidor.
 */
export function Sparkline({
  valores,
  largura = 140,
  altura = 36,
  cor = "var(--cor-energia)",
  referencia,
  faixa,
  rotulo,
  zeroNoEixo = false,
  espessura = 1.75,
}: {
  valores: (number | null | undefined)[];
  largura?: number;
  altura?: number;
  cor?: string;
  /** Linha de referência horizontal (mesma unidade da série). */
  referencia?: number | null;
  /** Faixa inferior e superior, alinhadas por índice. */
  faixa?: { inferior: (number | null | undefined)[]; superior: (number | null | undefined)[] };
  /** Descrição para leitor de tela; sem ela, a figura é decorativa (o número ao lado já diz o valor). */
  rotulo?: string;
  zeroNoEixo?: boolean;
  espessura?: number;
}) {
  const n = valores.length;
  const nums: number[] = [];
  for (const v of valores) if (typeof v === "number" && Number.isFinite(v)) nums.push(v);
  if (faixa) for (const v of [...faixa.inferior, ...faixa.superior]) if (typeof v === "number" && Number.isFinite(v)) nums.push(v);
  if (typeof referencia === "number") nums.push(referencia);
  if (nums.length < 2) return null;
  let mn = Math.min(...nums);
  const mx = Math.max(...nums);
  if (zeroNoEixo) mn = Math.min(0, mn);
  const pad = (mx - mn) * 0.08 || 1;
  const y0 = mn - pad;
  const y1 = mx + pad;
  const T = 3;
  const B = 3;
  const x = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * largura);
  const y = (v: number) => T + (1 - (v - y0) / (y1 - y0)) * (altura - T - B);
  let d = "";
  let aberto = false;
  let ultimo: { x: number; y: number } | null = null;
  valores.forEach((v, i) => {
    if (typeof v === "number" && Number.isFinite(v)) {
      d += `${aberto ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      aberto = true;
      ultimo = { x: x(i), y: y(v) };
    } else aberto = false;
  });
  let area = "";
  if (faixa) {
    const sup: string[] = [];
    const inf: string[] = [];
    valores.forEach((_, i) => {
      const a = faixa.superior[i];
      const b = faixa.inferior[i];
      if (typeof a === "number" && typeof b === "number") {
        sup.push(`${x(i).toFixed(1)},${y(a).toFixed(1)}`);
        inf.unshift(`${x(i).toFixed(1)},${y(b).toFixed(1)}`);
      }
    });
    if (sup.length) area = `M${sup.join("L")}L${inf.join("L")}Z`;
  }
  return (
    <svg
      width={largura}
      height={altura}
      viewBox={`0 0 ${largura} ${altura}`}
      className="block h-auto max-w-full overflow-visible"
      role={rotulo ? "img" : undefined}
      aria-label={rotulo}
      aria-hidden={rotulo ? undefined : "true"}
      focusable="false"
    >
      {area && <path d={area} fill="color-mix(in srgb, var(--serie-referencia) 20%, transparent)" stroke="none" />}
      {typeof referencia === "number" && (
        <line x1={0} x2={largura} y1={y(referencia)} y2={y(referencia)} stroke="var(--serie-referencia)" strokeWidth="1" strokeDasharray="3 3" />
      )}
      <path d={d} fill="none" stroke={cor} strokeWidth={espessura} strokeLinejoin="round" strokeLinecap="round" />
      {ultimo && <circle cx={(ultimo as { x: number }).x} cy={(ultimo as { y: number }).y} r={2.6} fill={cor} stroke="var(--cor-superficie)" strokeWidth="1.2" />}
    </svg>
  );
}
