"use client";

import { useState } from "react";
import { TabelaDados } from "@/components/painel/TabelaDados";

type Celula = string | number | null;

/**
 * Tabela do kit com a ordem escolhida por botões (as três ordens que o painel antigo oferecia por UF). Ordena no navegador as linhas
 * que o servidor entregou, do maior para o menor; linha sem valor vai para o fim. A ordem em vigor fica visível e é anunciada.
 */
export function TabelaOrdenada({
  titulo,
  colunas,
  linhas,
  casas,
  ordens,
  links,
  nota,
}: {
  titulo: string;
  colunas: string[];
  linhas: Celula[][];
  casas: (number | null)[];
  /** Coluna numérica (índice) de cada ordem oferecida; a primeira é a ordem em que as linhas chegam. */
  ordens: { rotulo: string; coluna: number }[];
  /** Endereço da primeira coluna de cada linha, na ordem em que as linhas chegam. */
  links?: (string | null)[];
  nota?: string;
}) {
  const [ordem, setOrdem] = useState(0);
  const col = ordens[ordem].coluna;
  const indices = linhas.map((_, i) => i);
  if (ordem !== 0) {
    indices.sort((a, b) => {
      const x = linhas[a][col];
      const y = linhas[b][col];
      return (typeof y === "number" ? y : -Infinity) - (typeof x === "number" ? x : -Infinity);
    });
  }
  return (
    <div data-tabela-ordenada="">
      <div role="group" aria-label="Ordem da tabela" className="flex flex-wrap items-center gap-2 border-y border-linha py-3">
        <span className="mr-2 text-sm text-carvao-muted">Ordenar por</span>
        {ordens.map((o, i) => (
          <button
            key={o.rotulo}
            type="button"
            aria-pressed={i === ordem}
            onClick={() => setOrdem(i)}
            className={`min-h-[44px] border px-3 text-sm ${i === ordem ? "border-carvao bg-carvao text-superficie" : "border-linha bg-superficie text-carvao-muted hover:text-carvao"}`}
          >
            {o.rotulo}
          </button>
        ))}
        <p role="status" className="t-meta ml-2 text-carvao-muted">
          Do maior para o menor em {ordens[ordem].rotulo}.
        </p>
      </div>
      <TabelaDados
        titulo={titulo}
        colunas={colunas}
        linhas={indices.map((i) => linhas[i])}
        casas={casas}
        limite={linhas.length}
        recolhida={false}
        fixarPrimeiraColuna
        links={links ? { [colunas[0]]: indices.map((i) => links[i]) } : undefined}
        nota={nota}
        idioma="pt"
      />
    </div>
  );
}
