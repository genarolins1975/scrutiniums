"use client";

import { useId, useState } from "react";
import { GraficoLinhas } from "@/components/painel/GraficoLinhas";

export type OpcaoSerie = {
  id: string;
  nome: string;
  /** Frase factual da opção, escrita no servidor com os valores da gold. */
  frase: string;
  pontos: { ref: string; v: number | null }[];
  /** Média histórica da própria opção, desenhada como linha de referência tracejada. */
  media?: number | null;
};

/**
 * Gráfico de linhas com seletor (a seção de atividade ou a UF): a pessoa escolhe a série, o gráfico e a frase mudam juntos. Todas as
 * séries chegam do servidor (36 meses por opção); nada é calculado no navegador. A linha de referência, quando há, é a mesma em todas
 * as opções (o total do país) e não se repete quando a opção escolhida é ela mesma.
 */
export function SerieEscolhida({
  rotulo,
  titulo,
  opcoes,
  inicial,
  referencia,
  rotuloMedia,
  unidade,
  casas,
}: {
  rotulo: string;
  titulo: string;
  opcoes: OpcaoSerie[];
  inicial: string;
  referencia?: { id: string; rotulo: string; pontos: { ref: string; v: number | null }[] };
  rotuloMedia?: string;
  unidade: string;
  casas: number;
}) {
  const id = useId();
  const [escolha, setEscolha] = useState(inicial);
  const op = opcoes.find((o) => o.id === escolha) ?? opcoes[0];
  const comReferencia = referencia && referencia.id !== op.id ? referencia : null;
  const ref = new Map(comReferencia?.pontos.map((p) => [p.ref, p.v]) ?? []);
  const comMedia = typeof op.media === "number" && rotuloMedia;
  const dados = op.pontos.map((p) => ({ mes: p.ref, escolhida: p.v, referencia: ref.get(p.ref) ?? null, media: comMedia ? op.media : null }));
  return (
    <div data-serie-escolhida={op.id}>
      <div role="group" aria-label={rotulo} className="flex flex-wrap items-end gap-x-6 gap-y-3 border-y border-linha py-3">
        <label htmlFor={id} className="block text-sm text-carvao-muted">
          {rotulo}
          <select
            id={id}
            value={op.id}
            onChange={(e) => setEscolha(e.target.value)}
            className="mt-1 block min-h-[44px] w-full max-w-md border border-linha bg-superficie px-3 text-base text-carvao focus:border-bronze focus:outline-none focus:ring-2 focus:ring-bronze/30"
          >
            {opcoes.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-4">
        <GraficoLinhas
          key={op.id}
          titulo={`${titulo}: ${op.nome}`}
          dados={dados}
          chaveX="mes"
          formatoX="mes"
          series={[
            { id: "escolhida", rotulo: op.nome, cor: "var(--serie-1)" },
            ...(comReferencia ? [{ id: "referencia", rotulo: comReferencia.rotulo, cor: "var(--serie-2)" }] : []),
            ...(comMedia ? [{ id: "media", rotulo: rotuloMedia, cor: "var(--serie-referencia)", espessura: 1 }] : []),
          ]}
          unidade={unidade}
          casas={casas}
          zeroNoEixo
        />
      </div>
      <p role="status" className="t-meta mt-3 max-w-prose2 text-carvao">
        {op.frase}
      </p>
    </div>
  );
}
