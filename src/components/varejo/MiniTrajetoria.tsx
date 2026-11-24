import { mesCurto, num } from "@/lib/varejo/formato";

/**
 * Trajetória recente de uma série numa célula de tabela: linha de 24 meses do índice com ajuste sazonal, sem eixo, com o
 * primeiro e o último valor ditos no texto alternativo. Lacuna interrompe a linha; série inteira sem valor diz a ausência em texto.
 * Escala própria de cada linha: mostra a forma do movimento, não compara níveis entre atividades (a tabela diz isso).
 */
export function MiniTrajetoria({ pontos, nome }: Readonly<{ pontos: readonly { mes: string; valor: number | null }[]; nome: string }>) {
  const validos = pontos.filter((p): p is { mes: string; valor: number } => p.valor !== null);
  // o IBGE não publica a série com ajuste sazonal de algumas atividades (as de detalhe e o atacado de alimentos): a célula diz isso
  if (validos.length < 2) return <span className="italic text-mineral" data-sem-trajetoria="">sem série com ajuste sazonal</span>;
  const L = 112;
  const A = 28;
  const min = Math.min(...validos.map((p) => p.valor));
  const max = Math.max(...validos.map((p) => p.valor));
  const x = (i: number) => 2 + (i * (L - 4)) / (pontos.length - 1);
  const y = (v: number) => (max === min ? A / 2 : A - 3 - ((v - min) * (A - 6)) / (max - min));
  let d = "";
  let aberto = false;
  pontos.forEach((p, i) => {
    if (p.valor === null) {
      aberto = false;
      return;
    }
    d += `${aberto ? "L" : "M"}${x(i).toFixed(1)} ${y(p.valor).toFixed(1)}`;
    aberto = true;
  });
  const a = validos[0];
  const b = validos[validos.length - 1];
  const fim = pontos.length - 1 - [...pontos].reverse().findIndex((p) => p.valor !== null);
  return (
    <svg
      role="img"
      width={L}
      height={A}
      viewBox={`0 0 ${L} ${A}`}
      className="inline-block align-middle"
      aria-label={`${nome}: índice de ${num(a.valor, 1)} em ${mesCurto(a.mes)} a ${num(b.valor, 1)} em ${mesCurto(b.mes)}`}
    >
      <path d={d} fill="none" stroke="var(--cor-gas)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(fim)} cy={y(b.valor)} r={2.2} fill="var(--cor-gas)" />
    </svg>
  );
}
