"use client";

import { useMemo, useState } from "react";
import Link from "@/components/energia/LinkSemPrefetch";
import { ListadasLogo } from "@/components/energia/ListadasLogo";
import type { LogoListada } from "@/lib/energia/tipos-listadas";
import type { Idioma } from "@/lib/idioma";
import { num } from "@/lib/energia/formato";
import { tx } from "@/lib/energia/idioma";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import { Nome } from "@/components/i18n/Nome";

export type ColunaListadas = {
  id: string;
  rotulo: string;
  /** Unidade no cabeçalho (ex.: "MW", "%", "R$ milhões"). */
  unidade?: string;
  casas?: number;
  /** "sinal" mostra + e − (variações); "texto" ordena por ordem alfabética. */
  tipo: "numero" | "sinal" | "texto";
  /** Grupo do cabeçalho (ex.: "Ativos sob controle"). */
  grupo?: string;
};

export type LinhaListadas = {
  id: string;
  href: string;
  nome: string;
  papel: string;
  logo: LogoListada | null;
  valores: Record<string, number | string | null>;
};

function fmt(v: number | string | null, c: ColunaListadas, idioma: Idioma): string {
  if (v === null || v === undefined || v === "") return tx("sem dado", "no data", idioma);
  if (typeof v === "string") return v;
  const casas = c.casas ?? 0;
  const t = num(Math.abs(v), casas, idioma);
  if (c.tipo === "sinal") return `${v > 0 ? "+" : v < 0 ? "−" : ""}${t}`;
  return v < 0 ? `−${t}` : t;
}

/**
 * Tabela comparativa das companhias da carteira do IEE, com o símbolo de cada uma na primeira coluna. Ordenação por qualquer coluna
 * (botão no cabeçalho, com aria-sort); ausência sempre no fim, em qualquer direção. A ordem inicial é o peso no índice, que não é
 * juízo sobre a companhia. Rolagem horizontal só dentro da tabela, com a identificação fixa à esquerda.
 */
export function ListadasTabela({
  colunas,
  linhas,
  legenda,
  ordemInicial = "peso",
}: {
  colunas: ColunaListadas[];
  linhas: LinhaListadas[];
  legenda: string;
  ordemInicial?: string;
}) {
  const tx = useTx();
  const idioma = useIdioma();
  const [ordem, setOrdem] = useState<{ id: string; desc: boolean }>({ id: ordemInicial, desc: true });
  const ordenadas = useMemo(() => {
    const col = colunas.find((c) => c.id === ordem.id);
    const r = [...linhas];
    r.sort((a, b) => {
      const va = a.valores[ordem.id];
      const vb = b.valores[ordem.id];
      const na = va === null || va === undefined || va === "";
      const nb = vb === null || vb === undefined || vb === "";
      if (na && nb) return a.papel.localeCompare(b.papel);
      if (na) return 1;
      if (nb) return -1;
      const cmp = col?.tipo === "texto" ? String(va).localeCompare(String(vb), "pt-BR") : (va as number) - (vb as number);
      return (ordem.desc ? -cmp : cmp) || a.papel.localeCompare(b.papel);
    });
    return r;
  }, [linhas, colunas, ordem]);
  const grupos: { rotulo: string; n: number }[] = [];
  for (const c of colunas) {
    const g = c.grupo ?? "";
    if (grupos.length && grupos[grupos.length - 1].rotulo === g) grupos[grupos.length - 1].n += 1;
    else grupos.push({ rotulo: g, n: 1 });
  }
  const colAtual = colunas.find((c) => c.id === ordem.id);

  return (
    <div className="space-y-2">
      <div className="tabela-scroll overflow-x-auto" role="region" aria-label={legenda} tabIndex={0}>
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <caption className="sr-only">
            {tx(
              <>
                {legenda}. Ordenada por {colAtual?.rotulo ?? "peso no índice"}, {ordem.desc ? "decrescente" : "crescente"}.
              </>,
              <>
                {legenda}. Sorted by {colAtual?.rotulo ?? "weight in the index"}, {ordem.desc ? "descending" : "ascending"}.
              </>,
            )}
          </caption>
          <thead>
            <tr className="text-left">
              <th scope="col" rowSpan={2} className="sticky left-0 z-10 bg-papel pb-2 pr-3 align-bottom text-xs font-medium text-carvao-muted">
                {tx("Companhia", "Company")}
              </th>
              {grupos.map((g, i) => (
                <th key={`${g.rotulo}-${i}`} scope="colgroup" colSpan={g.n} className="border-b border-linha px-2 pb-1 text-center text-xs font-medium text-mineral">
                  {g.rotulo}
                </th>
              ))}
            </tr>
            <tr>
              {colunas.map((c) => {
                const ativa = ordem.id === c.id;
                return (
                  <th
                    key={c.id}
                    scope="col"
                    aria-sort={ativa ? (ordem.desc ? "descending" : "ascending") : "none"}
                    className="px-2 pb-2 text-right align-bottom text-xs font-medium text-carvao-muted"
                  >
                    <button
                      type="button"
                      onClick={() => setOrdem((o) => ({ id: c.id, desc: o.id === c.id ? !o.desc : c.tipo !== "texto" }))}
                      className="inline-flex min-h-[44px] items-end gap-1 text-right hover:text-carvao focus-visible:outline focus-visible:outline-2 focus-visible:outline-energia"
                    >
                      <span>
                        {c.rotulo}
                        {c.unidade && <span className="block font-normal text-mineral">{c.unidade}</span>}
                      </span>
                      <span aria-hidden="true" className="text-mineral">
                        {ativa ? (ordem.desc ? "↓" : "↑") : "↕"}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {ordenadas.map((l) => (
              <tr key={l.id} className="border-t border-linha">
                <th scope="row" className="sticky left-0 z-10 bg-papel py-2 pr-3 text-left font-normal">
                  <Link href={l.href} className="flex min-h-[44px] items-center gap-3 text-carvao hover:text-energia-dark">
                    <ListadasLogo logo={l.logo} nome={l.nome} tamanho="sm" decorativo={!!l.logo?.arquivo} />
                    <span className="leading-tight">
                      <span className="block whitespace-nowrap font-medium underline underline-offset-4">
                        <Nome>{l.nome}</Nome>
                      </span>
                      <span className="block text-xs text-mineral">{l.papel}</span>
                    </span>
                  </Link>
                </th>
                {colunas.map((c) => {
                  const v = l.valores[c.id];
                  const aus = v === null || v === undefined || v === "";
                  return (
                    <td key={c.id} className={`px-2 py-2 text-right tabular-nums ${aus ? "text-mineral" : "text-carvao"}`}>
                      {fmt(v ?? null, c, idioma)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
