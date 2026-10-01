import { diasEntre, type TrechoEstado } from "@/lib/energia/visao";

/**
 * Linha de estado de uma regra (P007): um trecho por sequência de dias no mesmo estado,
 * sobre um eixo de datas comum (o mesmo para as regras comparadas). Estado é codificado
 * pela altura e pela cor ao mesmo tempo (a cor nunca é o único portador): alerta exibido
 * ocupa a faixa inteira, condição sem a duração mínima ocupa a metade, dia normal é um
 * traço fino e dia sem dado é um traço tracejado. Sem estado nem efeito: serve ao servidor
 * e ao cliente. A leitura em palavras (contagem por estado) acompanha sempre o desenho.
 */

export const LEGENDA_ESTADOS: readonly { estado: string; rotulo: string }[] = [
  { estado: "A", rotulo: "alerta exibido (faixa cheia)" },
  { estado: "o", rotulo: "condição sem a duração mínima (meia faixa)" },
  { estado: ".", rotulo: "normal (traço fino)" },
  { estado: "-", rotulo: "sem dado (tracejado)" },
];

const ALTURA = 16;

export function VisaoFaixaEstados({ trechos, inicio, fim, rotulo }: { trechos: readonly TrechoEstado[]; inicio: string; fim: string; rotulo: string }) {
  const total = Math.max(1, diasEntre(inicio, fim) + 1);
  const x = (iso: string) => (1000 * diasEntre(inicio, iso)) / total;
  return (
    <svg viewBox={`0 0 1000 ${ALTURA}`} preserveAspectRatio="none" width="100%" height={ALTURA} role="img" aria-label={rotulo} className="block">
      {trechos.map((t) => {
        const x0 = x(t.inicio);
        const w = (1000 * t.dias) / total;
        if (t.estado === "A") return <rect key={t.inicio} x={x0} y={0} width={w} height={ALTURA} fill="var(--cor-energia-dark)" />;
        if (t.estado === "o") return <rect key={t.inicio} x={x0} y={ALTURA / 4} width={w} height={ALTURA / 2} fill="var(--cor-energia-soft)" />;
        if (t.estado === "-")
          return <line key={t.inicio} x1={x0} x2={x0 + w} y1={ALTURA / 2} y2={ALTURA / 2} stroke="var(--cor-mineral)" strokeWidth={1.5} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />;
        return <rect key={t.inicio} x={x0} y={ALTURA / 2 - 1} width={w} height={2} fill="var(--cor-mineral-soft)" />;
      })}
    </svg>
  );
}

/** Legenda dos estados, com a mesma forma do desenho. */
export function VisaoLegendaEstados() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-carvao-muted" aria-label="Legenda da linha de estado">
      {LEGENDA_ESTADOS.map((l) => (
        <li key={l.estado} className="inline-flex items-center gap-1.5">
          <svg width="18" height={ALTURA} aria-hidden="true">
            {l.estado === "A" && <rect x={0} y={0} width={18} height={ALTURA} fill="var(--cor-energia-dark)" />}
            {l.estado === "o" && <rect x={0} y={ALTURA / 4} width={18} height={ALTURA / 2} fill="var(--cor-energia-soft)" />}
            {l.estado === "." && <rect x={0} y={ALTURA / 2 - 1} width={18} height={2} fill="var(--cor-mineral-soft)" />}
            {l.estado === "-" && <line x1={0} x2={18} y1={ALTURA / 2} y2={ALTURA / 2} stroke="var(--cor-mineral)" strokeWidth={1.5} strokeDasharray="4 3" />}
          </svg>
          {l.rotulo}
        </li>
      ))}
    </ul>
  );
}
