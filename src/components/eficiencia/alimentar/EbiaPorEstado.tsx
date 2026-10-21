"use client";
/**
 * EBIA por estado (IBGE, SIDRA 9552): percentual publicado de domicílios em cada classe, com o
 * coeficiente de variação ao lado. Só filtra e ordena o que a gold traz; não recalcula nada.
 */
import { useId, useState } from "react";
import type { ClasseEbia, LinhaEbia } from "@/lib/eficiencia/alimentar/complementos";

const CLASSES: { id: Exclude<ClasseEbia, "total" | "segura">; nome: string }[] = [
  { id: "insegura", nome: "Insegurança alimentar total" },
  { id: "grave", nome: "Insegurança alimentar grave" },
  { id: "moderada", nome: "Insegurança alimentar moderada" },
  { id: "leve", nome: "Insegurança alimentar leve" },
];
const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtInt = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

export function EbiaPorEstado({ linhas, regiaoDe }: { linhas: LinhaEbia[]; regiaoDe: Record<string, string> }) {
  const id = useId();
  const anos = [...new Set(linhas.map((l) => l.ano))].sort((a, b) => b - a);
  const [ano, setAno] = useState(anos[0]);
  const [classe, setClasse] = useState<(typeof CLASSES)[number]["id"]>("insegura");
  const nomeClasse = CLASSES.find((c) => c.id === classe)!.nome;
  const brasil = linhas.find((l) => l.nivel === "brasil" && l.ano === ano)!.classes[classe].pct;
  const ufs = linhas
    .filter((l) => l.nivel === "uf" && l.ano === ano)
    .sort((a, b) => (b.classes[classe].pct ?? -1) - (a.classes[classe].pct ?? -1) || a.territorio.localeCompare(b.territorio, "pt-BR"));
  // escala fixa entre os anos da mesma classe: trocar o ano não muda a régua
  const maximo = Math.ceil(Math.max(...linhas.filter((l) => l.nivel === "uf").map((l) => l.classes[classe].pct ?? 0)) / 10) * 10;
  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-4">
        <label htmlFor={`${id}-classe`} className="max-w-full text-sm">
          Medida
          <select id={`${id}-classe`} value={classe} onChange={(e) => setClasse(e.target.value as typeof classe)} className="mt-2 block min-h-[44px] w-full border border-mineral bg-superficie px-3">
            {CLASSES.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
        <label htmlFor={`${id}-ano`} className="text-sm">
          Ano
          <select id={`${id}-ano`} value={ano} onChange={(e) => setAno(Number(e.target.value))} className="mt-2 block min-h-[44px] border border-mineral bg-superficie px-3">
            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
      </div>
      <figure className="mt-6" aria-label={`${nomeClasse}, % dos domicílios por estado, ${ano}; Brasil ${brasil === null ? "sem valor publicado" : fmt(brasil) + "%"}`}>
        <figcaption className="mb-3 text-sm">{nomeClasse} · % dos domicílios · 27 estados · {ano}</figcaption>
        <div className="space-y-0.5">
          {ufs.map((l) => {
            const v = l.classes[classe].pct;
            return (
              <div key={l.codigo} className="grid grid-cols-[minmax(6.5rem,11rem)_1fr_3.5rem] items-center gap-3 text-sm">
                <span className="truncate" title={l.territorio}>{l.territorio}</span>
                <div className="relative h-3 bg-obee-fundo" aria-hidden="true">
                  {v !== null && <div className="h-full bg-obee" style={{ width: `${(100 * v) / maximo}%` }} />}
                  {brasil !== null && <div className="absolute inset-y-[-3px] w-0.5 bg-obee-tinta" style={{ left: `${(100 * brasil) / maximo}%` }} />}
                </div>
                <span className="text-right tabular-nums">{v === null ? "Sem valor" : `${fmt(v)}%`}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-carvao-muted">
          Insegurança total soma as classes leve, moderada e grave. Barras desde zero, escala de 0 a {maximo}% igual nos dois anos. O traço escuro marca o Brasil ({brasil === null ? "sem valor publicado" : `${fmt(brasil)}%`}). A ordem segue o valor e não indica diferença estatisticamente significativa entre estados vizinhos na lista.
        </p>
      </figure>
      <details className="mt-4 border-y border-linha py-2">
        <summary className="min-h-[44px] cursor-pointer py-3 text-sm font-medium">Tabela com coeficiente de variação e número de domicílios</summary>
        <div className="tabela-scroll mt-2 min-w-0 max-w-full" tabIndex={0} role="region" aria-label={`${nomeClasse} por estado, ${ano} (tabela; role na horizontal se necessário)`}>
          <table className="w-full min-w-[30rem] border-collapse text-sm">
            <caption className="sr-only">{nomeClasse} por estado, {ano}: percentual publicado, coeficiente de variação e mil domicílios</caption>
            <thead>
              <tr>
                {["Estado", "Região", "% dos domicílios", "CV do percentual", "Mil domicílios"].map((t, i) => (
                  <th key={t} scope="col" className={`border-b border-carvao-muted px-2 py-1.5 font-semibold text-obee-tinta ${i > 1 ? "text-right" : "text-left"}`}>{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ufs.map((l) => {
                const v = l.classes[classe];
                return (
                  <tr key={l.codigo} className="border-b border-linha">
                    <th scope="row" className="px-2 py-1.5 text-left font-normal">{l.territorio}</th>
                    <td className="px-2 py-1.5">{regiaoDe[l.codigo] ?? ""}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{v.pct === null ? "Sem valor publicado" : `${fmt(v.pct)}%`}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{v.cv_pct === null ? "Sem valor publicado" : `${fmt(v.cv_pct)}%`}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{v.mil_domicilios === null ? "Sem valor publicado" : fmtInt(v.mil_domicilios)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-carvao-muted">CV: coeficiente de variação publicado pelo IBGE; quanto maior, menos precisa a estimativa amostral.</p>
      </details>
    </div>
  );
}
