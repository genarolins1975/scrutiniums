"use client";

import Link from "next/link";
import type { Submercado } from "@/lib/energia/tipos";
import { FanChart, type PontoRealizado } from "@/components/energia/FanChart";
import { umDe, useEstadoUrl } from "@/lib/energia/useEstadoUrl";

/**
 * "Para onde o preço pode ir?": o fan chart com o realizado por semana (sábado a
 * sábado, a mesma semana das entregas do registro de previsões) e o horizonte
 * escolhido. Sem previsão publicada, o horizonte fica hachurado e o motivo é
 * dito no lugar do número. Submercado e horizonte ficam na URL.
 */
type Horizonte = "w1" | "w2" | "w3" | "w4" | "m1";
const HORIZONTES: { id: Horizonte; rotulo: string }[] = [
  { id: "w1", rotulo: "1 semana" },
  { id: "w2", rotulo: "2 semanas" },
  { id: "w3", rotulo: "3 semanas" },
  { id: "w4", rotulo: "4 semanas" },
  { id: "m1", rotulo: "Mensal" },
];
const SMS: { id: Submercado; rotulo: string }[] = [
  { id: "SE", rotulo: "SE/CO" },
  { id: "S", rotulo: "Sul" },
  { id: "NE", rotulo: "Nordeste" },
  { id: "N", rotulo: "Norte" },
];

export type DiaPld = { d: string; SE: number | null; S: number | null; NE: number | null; N: number | null };

function addDias(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** Sábado que inicia a semana operativa de comercialização em que o dia cai. */
function inicioSemana(iso: string): string {
  const dow = new Date(`${iso}T00:00:00Z`).getUTCDay(); // 6 = sábado
  return addDias(iso, -((dow + 1) % 7));
}

export function semanasRealizadas(diario: DiaPld[], sm: Submercado): PontoRealizado[] {
  const grupos = new Map<string, number[]>();
  for (const p of diario) {
    const v = p[sm];
    if (typeof v !== "number") continue;
    const k = inicioSemana(p.d);
    grupos.set(k, [...(grupos.get(k) ?? []), v]);
  }
  return Array.from(grupos.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([x, vs]) => ({ x, v: vs.reduce((s, v) => s + v, 0) / vs.length, parcial: vs.length < 7 }));
}

export function PrevisaoPld({
  diario,
  motivoIndisponivel,
  resumoRodada,
  nRegistros,
  nPublicacoes,
}: {
  diario: DiaPld[];
  motivoIndisponivel: string;
  resumoRodada: string | null;
  nRegistros: number;
  nPublicacoes: number;
}) {
  const [sm, setSm] = useEstadoUrl<Submercado>("submercado", "SE", umDe(["SE", "S", "NE", "N"] as const));
  const [hz, setHz] = useEstadoUrl<Horizonte>("horizonte", "w2", umDe(HORIZONTES.map((h) => h.id)));
  const realizado = semanasRealizadas(diario, sm).slice(-14);
  const ultimaSemana = realizado[realizado.length - 1]?.x;
  let futuro: { x: string }[] = [];
  if (ultimaSemana) {
    const proxima = addDias(ultimaSemana, 7);
    if (hz === "m1") {
      // próximo mês civil que ainda não começou: as semanas cujo sábado cai nele
      const ultimoDia = diario[diario.length - 1]?.d ?? ultimaSemana;
      const [a, m] = ultimoDia.split("-").map(Number);
      const mesAlvo = m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
      let s = proxima;
      for (let k = 0; k < 10; k++) {
        if (s.slice(0, 7) === mesAlvo) futuro.push({ x: s });
        else if (s.slice(0, 7) > mesAlvo) break;
        s = addDias(s, 7);
      }
    } else {
      const n = Number(hz.slice(1));
      futuro = Array.from({ length: n }, (_, k) => ({ x: addDias(proxima, 7 * k) }));
    }
  }
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div role="tablist" aria-label="Submercado" className="flex flex-wrap gap-1 border-b border-linha">
          {SMS.map((s) => (
            <button key={s.id} type="button" role="tab" aria-selected={sm === s.id} onClick={() => setSm(s.id)} className={`rotulo min-h-[44px] border-b-2 px-3 ${sm === s.id ? "border-energia text-carvao" : "border-transparent text-carvao-muted hover:text-carvao"}`}>
              {s.rotulo}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Horizonte" className="flex flex-wrap gap-1">
          {HORIZONTES.map((h) => (
            <button key={h.id} type="button" aria-pressed={hz === h.id} onClick={() => setHz(h.id)} className={`rotulo min-h-[44px] border px-2.5 ${hz === h.id ? "border-energia bg-energia-fundo text-carvao" : "border-linha bg-superficie text-carvao-muted hover:border-energia"}`}>
              {h.rotulo}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4">
        <FanChart realizado={realizado} futuro={futuro} previsao={null} unidade="R$/MWh" rotuloSerie={`PLD médio semanal, ${SMS.find((s) => s.id === sm)?.rotulo}`} motivoIndisponivel={motivoIndisponivel} />
      </div>
      <div role="status" className="mt-4 border border-dashed border-mineral bg-papel p-5">
        <p className="rotulo text-carvao">Previsão indisponível no horizonte escolhido</p>
        <p className="mt-2 max-w-prose2 text-sm leading-relaxed text-carvao">{motivoIndisponivel} A Scrutiniums não publica previsão de modelo em pesquisa ou em validação.</p>
        {resumoRodada && <p className="mt-2 max-w-prose2 text-sm leading-relaxed text-carvao-muted">{resumoRodada}</p>}
        <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <Link href="/setor-eletrico/pld/modelos" className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
            Registro de modelos
          </Link>
          <Link href="/setor-eletrico/pld/previsoes" className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
            Histórico de previsões ({nRegistros} registros, {nPublicacoes} publicações)
          </Link>
        </p>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-mineral">
        Semanas de sábado a sábado, como as entregas do registro de previsões; a última pode estar incompleta (ponto vazio). Quando houver previsão publicada, a mediana e as faixas P10 a P90 e P25 a P75 aparecerão no horizonte, com o rótulo que a calibração medida sustentar.
      </p>
    </div>
  );
}
