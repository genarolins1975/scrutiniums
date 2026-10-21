"use client";
/**
 * Inflação dos alimentos no IPCA (IBGE, tabela 7060): variação acumulada em 12 meses publicada,
 * com a alimentação no domicílio em destaque e o índice geral como referência neutra. A tabela
 * equivalente traz as quatro categorias. Nenhuma taxa é recalculada.
 */
import { useId, useState } from "react";
import { COR, dimensoes, useLargura } from "@/components/eficiencia/graficos";
import type { CategoriaIpca, PontoIpca } from "@/lib/eficiencia/alimentar/complementos";

const NOMES: Record<CategoriaIpca, string> = {
  geral: "Índice geral",
  alimentacao_bebidas: "Alimentação e bebidas",
  alimentacao_domicilio: "Alimentação no domicílio",
  alimentacao_fora: "Alimentação fora do domicílio",
};
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const mes = (p: string) => `${MESES[Number(p.slice(4, 6)) - 1]}/${p.slice(0, 4)}`;
const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function IpcaAlimentos({ pontos }: { pontos: PontoIpca[] }) {
  const id = useId();
  const [medida, setMedida] = useState<"doze_meses" | "mensal">("doze_meses");
  const [ref, w, medido] = useLargura<HTMLDivElement>(720);
  const serie = (cat: CategoriaIpca) => pontos.filter((p) => p.medida === medida && p.categoria === cat).sort((a, b) => a.periodo.localeCompare(b.periodo));
  const foco = serie("alimentacao_domicilio");
  const geral = serie("geral");
  const periodos = foco.map((p) => p.periodo);
  const valores = [...foco, ...geral].map((p) => p.valor).filter((v): v is number => v !== null);
  const min = Math.min(0, Math.floor(Math.min(...valores)));
  const max = Math.ceil(Math.max(...valores));
  const H = 260;
  const m = { t: 16, r: 16, b: 32, l: 44 };
  const x = (i: number) => m.l + (i * (w - m.l - m.r)) / Math.max(1, periodos.length - 1);
  const y = (v: number) => m.t + ((max - v) * (H - m.t - m.b)) / (max - min || 1);
  const caminho = (s: PontoIpca[]) =>
    s.map((p, i) => (p.valor === null ? null : `${i === 0 || s[i - 1].valor === null ? "M" : "L"}${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`)).filter(Boolean).join(" ");
  const passo = max - min > 12 ? 4 : max - min > 6 ? 2 : 1;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / passo) * passo; v <= max; v += passo) ticks.push(v === 0 ? 0 : v); // sem "-0"
  const marcasAno = periodos.map((p, i) => ({ p, i })).filter(({ p }) => p.endsWith("01"));
  const ultimo = foco[foco.length - 1];
  const ultimoGeral = geral[geral.length - 1];
  const nomeMedida = medida === "doze_meses" ? "variação acumulada em 12 meses" : "variação no mês";
  const tabela = [...periodos].reverse().slice(0, 12);
  return (
    <div className="mt-6">
      <fieldset className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <legend className="mb-2 text-sm">Medida</legend>
        {(["doze_meses", "mensal"] as const).map((k) => (
          <label key={k} htmlFor={`${id}-${k}`} className="inline-flex min-h-[44px] items-center gap-2">
            <input id={`${id}-${k}`} type="radio" name={`${id}-medida`} checked={medida === k} onChange={() => setMedida(k)} />
            {k === "doze_meses" ? "Acumulada em 12 meses" : "No mês"}
          </label>
        ))}
      </fieldset>
      <p className="mt-4 max-w-prose2 text-base leading-relaxed">
        Em {mes(ultimo.periodo)}, a {nomeMedida} da alimentação no domicílio foi de{" "}
        <strong className="tabular-nums">{ultimo.valor === null ? "valor não publicado" : `${fmt(ultimo.valor)}%`}</strong>; a do índice geral, de{" "}
        <strong className="tabular-nums">{ultimoGeral.valor === null ? "valor não publicado" : `${fmt(ultimoGeral.valor)}%`}</strong>.
      </p>
      <figure className="mt-4" aria-label={`IPCA, ${nomeMedida}, alimentação no domicílio e índice geral, Brasil, ${mes(periodos[0])} a ${mes(periodos[periodos.length - 1])}`}>
        <figcaption className="mb-2 text-sm">IPCA · {nomeMedida} · % · Brasil · {mes(periodos[0])} a {mes(periodos[periodos.length - 1])}</figcaption>
        <div className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
          <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="inline-block h-0.5 w-6" style={{ background: COR.selecao }} />Alimentação no domicílio</span>
          <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="inline-block h-0.5 w-6 border-t-2 border-dashed" style={{ borderColor: COR.neutro }} />Índice geral</span>
        </div>
        <div ref={ref} className="w-full">
          <svg {...dimensoes(medido, w, H)} aria-hidden="true" className="block">
            {ticks.map((v) => (
              <g key={v}>
                <line x1={m.l} x2={w - m.r} y1={y(v)} y2={y(v)} stroke={v === 0 ? COR.eixo : COR.grade} strokeWidth={v === 0 ? 1.2 : 1} />
                <text x={m.l - 6} y={y(v) + 4} textAnchor="end" fontSize="12" fill="currentColor">{v.toLocaleString("pt-BR")}%</text>
              </g>
            ))}
            {marcasAno.map(({ p, i }) => (
              <text key={p} x={x(i)} y={H - 10} textAnchor="start" fontSize="12" fill="currentColor">{p.slice(0, 4)}</text>
            ))}
            <path d={caminho(geral)} fill="none" stroke={COR.neutro} strokeWidth={1.8} strokeDasharray="5 4" />
            <path d={caminho(foco)} fill="none" stroke={COR.selecao} strokeWidth={2.4} />
          </svg>
        </div>
        <p className="mt-2 text-xs text-carvao-muted">Linha de base em zero destacada. Variação negativa é queda de preços no período, não ausência de dado.</p>
      </figure>
      <details className="mt-4 border-y border-linha py-2">
        <summary className="min-h-[44px] cursor-pointer py-3 text-sm font-medium">Tabela dos últimos 12 meses, com as quatro categorias</summary>
        <div className="tabela-scroll mt-2 min-w-0 max-w-full" tabIndex={0} role="region" aria-label={`IPCA, ${nomeMedida}, últimos 12 meses (tabela; role na horizontal se necessário)`}>
          <table className="w-full min-w-[34rem] border-collapse text-sm">
            <caption className="sr-only">IPCA, {nomeMedida}, Brasil, últimos 12 meses publicados, em %</caption>
            <thead>
              <tr>
                <th scope="col" className="border-b border-carvao-muted px-2 py-1.5 text-left font-semibold">Mês</th>
                {(Object.keys(NOMES) as CategoriaIpca[]).map((k) => <th key={k} scope="col" className="border-b border-carvao-muted px-2 py-1.5 text-right font-semibold">{NOMES[k]}</th>)}
              </tr>
            </thead>
            <tbody>
              {tabela.map((p) => (
                <tr key={p} className="border-b border-linha">
                  <th scope="row" className="px-2 py-1.5 text-left font-normal">{mes(p)}</th>
                  {(Object.keys(NOMES) as CategoriaIpca[]).map((k) => {
                    const v = pontos.find((x) => x.medida === medida && x.categoria === k && x.periodo === p)?.valor;
                    return <td key={k} className="px-2 py-1.5 text-right tabular-nums">{v === null || v === undefined ? "Não publicado" : `${fmt(v)}%`}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
