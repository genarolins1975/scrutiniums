/**
 * Calendário de calor: semanas nas colunas, dias da semana nas linhas, cor
 * proporcional ao valor. Revela de uma vez o padrão semanal e o sazonal de uma
 * série diária. Ausência é célula vazia (nunca zero). A leitura em palavras
 * (dia da semana mais alto, maior e menor dia) sai dos próprios dados, para a
 * página não afirmar nada que a série não mostre.
 */
import { TabelaDados } from "@/components/energia/TabelaDados";

export type PontoDiario = { d: string; v: number | null };

const DIAS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function diaSemana(d: string): number {
  // 0 = segunda … 6 = domingo (UTC evita deslocamento de fuso)
  return (new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7;
}

export type ResumoHeatmap = {
  maior: PontoDiario | null;
  menor: PontoDiario | null;
  mediaPorDia: { dia: string; media: number | null; n: number }[];
  diaMaisAlto: string | null;
  diaMaisBaixo: string | null;
};

/** Estatísticas descritivas da série exibida, para a página escrever a leitura a partir do dado. */
export function resumoHeatmap(dados: PontoDiario[]): ResumoHeatmap {
  const validos = dados.filter((p): p is { d: string; v: number } => typeof p.v === "number");
  if (!validos.length) return { maior: null, menor: null, mediaPorDia: [], diaMaisAlto: null, diaMaisBaixo: null };
  const maior = validos.reduce((a, b) => (b.v > a.v ? b : a));
  const menor = validos.reduce((a, b) => (b.v < a.v ? b : a));
  const somas = DIAS.map(() => ({ s: 0, n: 0 }));
  for (const p of validos) {
    const i = diaSemana(p.d);
    somas[i].s += p.v;
    somas[i].n += 1;
  }
  const mediaPorDia = somas.map((x, i) => ({ dia: DIAS[i], media: x.n ? x.s / x.n : null, n: x.n }));
  const comMedia = mediaPorDia.filter((x): x is { dia: string; media: number; n: number } => x.media !== null);
  const alto = comMedia.length ? comMedia.reduce((a, b) => (b.media > a.media ? b : a)) : null;
  const baixo = comMedia.length ? comMedia.reduce((a, b) => (b.media < a.media ? b : a)) : null;
  return { maior, menor, mediaPorDia, diaMaisAlto: alto?.dia ?? null, diaMaisBaixo: baixo?.dia ?? null };
}

function fmt(v: number, casas: number) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

export function HeatmapCalendario({
  dados,
  titulo,
  unidade,
  casas = 0,
  cor = "var(--cor-energia)",
}: {
  dados: PontoDiario[];
  titulo: string;
  unidade: string;
  casas?: number;
  cor?: string;
}) {
  if (!dados.length) return null;
  const validos = dados.map((p) => p.v).filter((v): v is number => typeof v === "number");
  const mn = Math.min(...validos);
  const mx = Math.max(...validos);
  const span = mx - mn || 1;
  const CEL = 12;
  const GAP = 2;
  const PASSO = CEL + GAP;
  const ESQ = 30;
  const TOPO = 18;
  const primeiraSemanaOffset = diaSemana(dados[0].d);
  const colunaDe = (i: number) => Math.floor((i + primeiraSemanaOffset) / 7);
  const nCol = colunaDe(dados.length - 1) + 1;
  const w = ESQ + nCol * PASSO;
  const h = TOPO + 7 * PASSO;
  // rótulo de mês na primeira coluna em que o mês aparece
  const meses: { col: number; rotulo: string }[] = [];
  let ultimoMes = "";
  dados.forEach((p, i) => {
    const m = p.d.slice(0, 7);
    if (m !== ultimoMes) {
      ultimoMes = m;
      meses.push({ col: colunaDe(i), rotulo: `${MESES[Number(p.d.slice(5, 7)) - 1]}${p.d.slice(5, 7) === "01" ? `/${p.d.slice(2, 4)}` : ""}` });
    }
  });
  const r = resumoHeatmap(dados);
  return (
    <figure>
      <svg viewBox={`0 0 ${w} ${h}`} className="block h-auto w-full" role="img" aria-label={`${titulo}: calendário de calor, de ${dados[0].d} a ${dados[dados.length - 1].d}, em ${unidade}. ${r.maior ? `Maior valor ${fmt(r.maior.v as number, casas)} em ${r.maior.d}; ` : ""}${r.menor ? `menor ${fmt(r.menor.v as number, casas)} em ${r.menor.d}.` : ""}`}>
        {meses.map((m, i) => {
          const proximo = meses[i + 1]?.col ?? nCol;
          if (proximo - m.col < 2) return null;
          return (
            <text key={`${m.rotulo}-${m.col}`} x={ESQ + m.col * PASSO} y={11} fontSize="10" fill="var(--cor-mineral)">
              {m.rotulo}
            </text>
          );
        })}
        {DIAS.map((d, i) => (
          <text key={d} x={ESQ - 6} y={TOPO + i * PASSO + CEL - 2} fontSize="9" textAnchor="end" fill="var(--cor-mineral)">
            {i % 2 === 0 ? d : ""}
          </text>
        ))}
        {dados.map((p, i) => {
          const c = colunaDe(i);
          const l = diaSemana(p.d);
          const x = ESQ + c * PASSO;
          const y = TOPO + l * PASSO;
          if (typeof p.v !== "number") {
            return <rect key={p.d} x={x} y={y} width={CEL} height={CEL} fill="none" stroke="var(--cor-linha)" strokeDasharray="2 2" />;
          }
          const t = (p.v - mn) / span;
          const pct = Math.round(8 + 88 * t);
          return (
            <rect key={p.d} x={x} y={y} width={CEL} height={CEL} rx={1.5} fill={`color-mix(in srgb, ${cor} ${pct}%, var(--cor-superficie))`}>
              <title>{`${p.d.slice(8, 10)}/${p.d.slice(5, 7)}/${p.d.slice(0, 4)} (${DIAS[l]}): ${fmt(p.v, casas)} ${unidade}`}</title>
            </rect>
          );
        })}
      </svg>
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-mineral">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-3 w-3" style={{ background: `color-mix(in srgb, ${cor} 8%, var(--cor-superficie))` }} />
          {fmt(mn, casas)} {unidade}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-3 w-3" style={{ background: `color-mix(in srgb, ${cor} 96%, var(--cor-superficie))` }} />
          {fmt(mx, casas)} {unidade}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-3 w-3 border border-dashed border-linha" /> sem dado
        </span>
        <span>Colunas: semanas. Linhas: segunda a domingo. Cor: valor do dia, do menor ao maior do período.</span>
      </figcaption>
      <TabelaDados
        titulo={titulo}
        colunas={["Dia", "Dia da semana", `Valor (${unidade})`]}
        linhas={dados.map((p) => [`${p.d.slice(8, 10)}/${p.d.slice(5, 7)}/${p.d.slice(0, 4)}`, DIAS[diaSemana(p.d)], p.v])}
        casas={[null, null, casas]}
        limite={dados.length}
      />
    </figure>
  );
}
