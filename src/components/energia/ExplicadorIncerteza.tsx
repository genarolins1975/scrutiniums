"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * "Existem muitos futuros possíveis": animação didática que mostra dezenas de
 * trajetórias ilustrativas e depois as condensa na faixa entre o 10º e o 90º
 * percentil, com a mediana. A faixa é calculada das próprias trajetórias, o
 * que torna a lição exata: mais larga, mais incerteza; mais estreita,
 * distribuição mais concentrada. Nenhum número vem do PLD: as trajetórias são
 * geradas por um sorteio fixo, só para explicar a forma da previsão. Respeita
 * prefers-reduced-motion (abre direto na faixa).
 */
const N_TRAJ = 48;
const N_PASSOS = 20;

function gerador(semente: number) {
  let s = semente >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function quantil(xs: number[], q: number): number {
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const i = Math.floor(pos);
  const f = pos - i;
  return s[i] + (s[i + 1] !== undefined ? f * (s[i + 1] - s[i]) : 0);
}

export function ExplicadorIncerteza() {
  const { traj, faixa } = useMemo(() => {
    const rnd = gerador(20260928);
    const traj: number[][] = [];
    for (let t = 0; t < N_TRAJ; t++) {
      const p = [0];
      // passeio com leve reversão à média e choques de tamanho crescente
      for (let k = 1; k <= N_PASSOS; k++) {
        const g = (rnd() + rnd() + rnd() - 1.5) * 1.15;
        p.push(p[k - 1] * 0.93 + g * (0.7 + k / N_PASSOS));
      }
      traj.push(p);
    }
    const faixa = Array.from({ length: N_PASSOS + 1 }, (_, k) => {
      const col = traj.map((p) => p[k]);
      return { p10: quantil(col, 0.1), p25: quantil(col, 0.25), p50: quantil(col, 0.5), p75: quantil(col, 0.75), p90: quantil(col, 0.9) };
    });
    return { traj, faixa };
  }, []);

  const [fase, setFase] = useState<"trajetorias" | "faixa">("faixa");
  const [reduzido, setReduzido] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduzido(mq.matches);
    if (!mq.matches) {
      setFase("trajetorias");
      const id = window.setTimeout(() => setFase("faixa"), 2600);
      return () => window.clearTimeout(id);
    }
  }, []);
  const reexibir = () => {
    setFase("trajetorias");
    window.setTimeout(() => setFase("faixa"), 2600);
  };

  const W = 320;
  const H = 210;
  const x0 = 14;
  const xh = 96;
  const x1 = W - 60;
  const yc = 105;
  const esc = 13;
  const xk = (k: number) => xh + (k / N_PASSOS) * (x1 - xh);
  const yv = (v: number) => yc - v * esc;
  const area = (a: keyof (typeof faixa)[number], b: keyof (typeof faixa)[number]) =>
    `M${faixa.map((f, k) => `${xk(k).toFixed(1)},${yv(f[a]).toFixed(1)}`).join("L")}L${[...faixa].reverse().map((f, i) => `${xk(N_PASSOS - i).toFixed(1)},${yv(f[b]).toFixed(1)}`).join("L")}Z`;
  const mediana = `M${faixa.map((f, k) => `${xk(k).toFixed(1)},${yv(f.p50).toFixed(1)}`).join("L")}`;
  const mostraTraj = fase === "trajetorias";

  return (
    <figure className="border border-dashed border-mineral bg-papel p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="rotulo text-mineral">Ilustração conceitual, sem dados do PLD</p>
        <div className="flex gap-1" role="group" aria-label="Modo da ilustração">
          <button type="button" aria-pressed={mostraTraj} onClick={() => setFase("trajetorias")} className={`rotulo min-h-[44px] border px-2 ${mostraTraj ? "border-energia bg-energia-fundo text-carvao" : "border-linha bg-superficie text-carvao-muted"}`}>
            Trajetórias
          </button>
          <button type="button" aria-pressed={!mostraTraj} onClick={() => setFase("faixa")} className={`rotulo min-h-[44px] border px-2 ${!mostraTraj ? "border-energia bg-energia-fundo text-carvao" : "border-linha bg-superficie text-carvao-muted"}`}>
            Faixa
          </button>
          {!reduzido && (
            <button type="button" onClick={reexibir} className="rotulo min-h-[44px] border border-linha bg-superficie px-2 text-carvao-muted hover:text-carvao">
              Ver de novo
            </button>
          )}
        </div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mx-auto mt-2 block w-full max-w-md"
        role="img"
        aria-label="Ilustração conceitual: à esquerda, o passado como uma única linha; à direita, dezenas de trajetórias futuras possíveis que se abrem com o horizonte e se resumem em uma faixa do 10º ao 90º percentil com a mediana no centro. Mais larga, mais incerteza."
      >
        <line x1={x0} y1={H - 22} x2={x1} y2={H - 22} stroke="var(--cor-mineral-soft)" />
        <line x1={xh} y1={14} x2={xh} y2={H - 22} stroke="var(--cor-mineral)" strokeDasharray="3 3" />
        <text x={xh - 5} y={24} textAnchor="end" fontSize="11" fill="var(--cor-mineral)">
          realizado
        </text>
        <text x={xh + 5} y={24} fontSize="11" fill="var(--cor-mineral)">
          futuro
        </text>
        <path d={`M${x0},${yc + 18} C${x0 + 26},${yc - 6} ${x0 + 50},${yc + 26} ${xh},${yc}`} fill="none" stroke="var(--cor-carvao)" strokeWidth="2" />
        <g style={{ opacity: mostraTraj ? 1 : 0, transition: "opacity 900ms ease" }}>
          {traj.map((p, t) => (
            <path key={t} d={`M${p.map((v, k) => `${xk(k).toFixed(1)},${yv(v).toFixed(1)}`).join("L")}`} fill="none" stroke="var(--cor-previsto)" strokeWidth="0.8" opacity={0.45} />
          ))}
        </g>
        <g style={{ opacity: mostraTraj ? 0 : 1, transition: "opacity 900ms ease 300ms" }}>
          <path d={area("p90", "p10")} fill="var(--cor-previsto)" fillOpacity="0.14" />
          <path d={area("p75", "p25")} fill="var(--cor-previsto)" fillOpacity="0.26" />
          <path d={mediana} fill="none" stroke="var(--cor-previsto)" strokeWidth="2" strokeDasharray="6 4" />
          <text x={x1 + 4} y={yv(faixa[N_PASSOS].p90) + 3} fontSize="11" fill="var(--cor-carvao)">
            P90
          </text>
          <text x={x1 + 4} y={yv(faixa[N_PASSOS].p50) + 3} fontSize="11" fill="var(--cor-carvao)">
            mediana
          </text>
          <text x={x1 + 4} y={yv(faixa[N_PASSOS].p10) + 3} fontSize="11" fill="var(--cor-carvao)">
            P10
          </text>
        </g>
        <text x={(xh + x1) / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--cor-mineral)">
          horizonte da previsão
        </text>
      </svg>
      <figcaption className="mt-2 text-xs leading-relaxed text-mineral">
        {mostraTraj
          ? "Existem muitos futuros possíveis: cada linha fina é uma trajetória ilustrativa. Nenhuma delas é a previsão."
          : "A faixa resume as trajetórias: entre o 10º e o 90º percentil ficam 80% delas; a mediana é o centro. Mais larga, mais incerteza; mais estreita, distribuição mais concentrada."}{" "}
        Trajetórias geradas por sorteio fixo para a explicação, sem dados do PLD. Uma faixa real só é chamada de faixa de 80% quando a cobertura observada no passado sustenta isso.
      </figcaption>
    </figure>
  );
}
