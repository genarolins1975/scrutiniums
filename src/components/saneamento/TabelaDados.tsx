"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { baixarCsv } from "@/lib/saneamento/csv";
import { inteiro, numero, reaisCompacto } from "@/lib/saneamento/formato";

/**
 * Tabela de dados do Saneamento: ordenável, filtrável por texto, com corte
 * inicial e exportação do conteúdo filtrado. Ausência aparece como "sem dado";
 * zero continua zero. As linhas chegam prontas do servidor.
 */

export type ColunaTabela = {
  id: string;
  rotulo: string;
  tipo?: "texto" | "inteiro" | "numero" | "pct" | "reais";
  casas?: number;
  /** Campo da linha com o endereço interno para o qual a célula aponta. */
  href?: string;
  /** Campo secundário exibido abaixo do valor, em texto menor. */
  detalhe?: string;
};

export type LinhaTabela = Record<string, string | number | null>;

function formatar(c: ColunaTabela, v: string | number | null): string {
  if (v == null || v === "") return "sem dado";
  if (typeof v === "string") return v;
  switch (c.tipo) {
    case "inteiro":
      return inteiro(v);
    case "pct":
      return `${numero(v, c.casas ?? 1)}%`;
    case "reais":
      return reaisCompacto(v);
    case "numero":
      return numero(v, c.casas ?? 1);
    default:
      return String(v);
  }
}

export function TabelaDados({
  titulo,
  colunas,
  linhas,
  arquivo,
  limite = 20,
  ordemInicial,
  busca = true,
  rotuloLinhas = { singular: "linha", plural: "linhas" },
}: {
  titulo: string;
  colunas: ColunaTabela[];
  linhas: LinhaTabela[];
  arquivo: string;
  limite?: number;
  ordemInicial?: { coluna: string; direcao: "asc" | "desc" };
  busca?: boolean;
  rotuloLinhas?: { singular: string; plural: string };
}) {
  const [texto, setTexto] = useState("");
  const [ordem, setOrdem] = useState(ordemInicial ?? { coluna: colunas[0].id, direcao: "asc" as const });
  const [tudo, setTudo] = useState(false);

  const filtradas = useMemo(() => {
    const t = texto
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
    const base = t
      ? linhas.filter((l) =>
          colunas.some((c) =>
            String(l[c.id] ?? "")
              .normalize("NFD")
              .replace(/[̀-ͯ]/g, "")
              .toLowerCase()
              .includes(t),
          ),
        )
      : linhas;
    const sinal = ordem.direcao === "asc" ? 1 : -1;
    return [...base].sort((a, b) => {
      const x = a[ordem.coluna];
      const y = b[ordem.coluna];
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      if (typeof x === "number" && typeof y === "number") return (x - y) * sinal;
      return String(x).localeCompare(String(y), "pt-BR") * sinal;
    });
  }, [linhas, colunas, texto, ordem]);

  const visiveis = tudo ? filtradas : filtradas.slice(0, limite);
  const n = filtradas.length;

  const exportar = () =>
    baixarCsv(
      arquivo,
      colunas.map((c) => c.rotulo),
      filtradas.map((l) => colunas.map((c) => l[c.id] ?? null)),
    );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        {busca && (
          <label className="min-w-0 flex-1 text-sm text-carvao sm:max-w-sm">
            Filtrar {titulo.toLowerCase()}
            <input
              type="search"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              className="mt-1 block min-h-[44px] w-full border border-linha bg-papel px-3 text-sm text-carvao"
              placeholder="Nome, UF, natureza..."
            />
          </label>
        )}
        <button
          type="button"
          onClick={exportar}
          className="inline-flex min-h-[44px] items-center border border-obee px-4 text-sm font-medium text-obee-dark hover:bg-obee-fundo"
        >
          Baixar CSV ({inteiro(n)} {n === 1 ? rotuloLinhas.singular : rotuloLinhas.plural})
        </button>
      </div>
      <div className="tabela-scroll mt-4" tabIndex={0} role="region" aria-label={`${titulo} (rolável)`}>
        <table className="w-full min-w-[40rem] border-collapse text-sm">
          <caption className="sr-only">{titulo}</caption>
          <thead>
            <tr className="border-b border-carvao align-bottom">
              {colunas.map((c) => {
                const ativa = ordem.coluna === c.id;
                const num = c.tipo && c.tipo !== "texto";
                return (
                  <th
                    key={c.id}
                    scope="col"
                    aria-sort={ativa ? (ordem.direcao === "asc" ? "ascending" : "descending") : "none"}
                    className={`py-2 pr-4 font-medium ${num ? "text-right" : "text-left"}`}
                  >
                    <button
                      type="button"
                      className="inline-flex min-h-[44px] items-end gap-1 text-left underline-offset-2 hover:underline"
                      onClick={() =>
                        setOrdem((o) => ({ coluna: c.id, direcao: o.coluna === c.id && o.direcao === (num ? "desc" : "asc") ? (num ? "asc" : "desc") : num ? "desc" : "asc" }))
                      }
                    >
                      {c.rotulo}
                      <span aria-hidden="true" className="text-carvao-muted">
                        {ativa ? (ordem.direcao === "asc" ? "↑" : "↓") : ""}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visiveis.map((l, i) => (
              <tr key={i} className="border-b border-linha align-top">
                {colunas.map((c, j) => {
                  const v = l[c.id];
                  const num = c.tipo && c.tipo !== "texto";
                  const conteudo = c.href && typeof l[c.href] === "string" && l[c.href] ? (
                    <Link href={String(l[c.href])} className="text-obee-dark underline underline-offset-2">
                      {formatar(c, v)}
                    </Link>
                  ) : (
                    formatar(c, v)
                  );
                  const detalhe = c.detalhe && l[c.detalhe] != null ? <span className="block text-xs text-carvao-muted">{String(l[c.detalhe])}</span> : null;
                  return j === 0 ? (
                    <th key={c.id} scope="row" className="py-2 pr-4 text-left font-normal text-carvao">
                      {conteudo}
                      {detalhe}
                    </th>
                  ) : (
                    <td key={c.id} className={`py-2 pr-4 ${num ? "text-right tabular-nums" : ""} ${v == null ? "text-carvao-muted" : "text-carvao"}`}>
                      {conteudo}
                      {detalhe}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {n > limite && (
        <button
          type="button"
          onClick={() => setTudo((t) => !t)}
          className="mt-3 inline-flex min-h-[44px] items-center text-sm font-medium text-obee-dark underline underline-offset-4"
        >
          {tudo ? `Mostrar só as ${limite} primeiras` : `Mostrar todas as ${inteiro(n)} ${rotuloLinhas.plural}`}
        </button>
      )}
      <span className="sr-only" aria-live="polite">
        {inteiro(n)} {n === 1 ? rotuloLinhas.singular : rotuloLinhas.plural}
      </span>
    </div>
  );
}
