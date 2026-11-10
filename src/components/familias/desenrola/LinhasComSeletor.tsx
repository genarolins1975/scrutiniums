"use client";

import { useId, useState } from "react";
import { Controles } from "@/components/painel/Controles";
import { GraficoLinhas } from "@/components/painel/GraficoLinhas";

export type OpcaoLinhas = {
  id: string;
  /** Nome da opção no seletor e no título do gráfico. */
  nome: string;
  unidade: string;
  casas: number;
  /** Uma linha por mês: `mes` e um campo por série; null é lacuna. */
  dados: Record<string, string | number | null>[];
  series: { id: string; rotulo: string; sigla?: string; cor: string }[];
  /** Séries que abrem ocultas (a legenda as mostra e esconde). */
  ocultas?: string[];
  /** Frase factual da opção, escrita no servidor com os valores da gold. */
  frase: string;
};

/**
 * Gráfico de linhas com um seletor de medida (operações ou volume; qual série de contexto): a pessoa escolhe, o gráfico e a frase
 * mudam juntos. Todas as opções chegam prontas do servidor; nada é calculado no navegador. As marcas de data são as mesmas em todas
 * as opções. Com mais de uma série, a legenda mostra e esconde cada uma (o recorte por faixa da vista antiga).
 */
export function LinhasComSeletor({
  rotulo,
  titulo,
  opcoes,
  inicial,
  marcos,
  zero = false,
}: Readonly<{
  rotulo: string;
  titulo: string;
  opcoes: OpcaoLinhas[];
  inicial: string;
  marcos: { x: string; rotulo: string }[];
  zero?: boolean;
}>) {
  const id = useId();
  const [escolha, setEscolha] = useState(inicial);
  const op = opcoes.find((o) => o.id === escolha) ?? opcoes[0];
  return (
    <div data-linhas-com-seletor={op.id}>
      <Controles rotulo={rotulo} idioma="pt">
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
      </Controles>
      <div className="mt-4">
        <GraficoLinhas
          key={op.id}
          semTabela
          titulo={`${titulo}: ${op.nome}`}
          dados={op.dados}
          chaveX="mes"
          formatoX="mes"
          series={op.series}
          unidade={op.unidade}
          casas={op.casas}
          zeroNoEixo={zero}
          zoom
          marcos={marcos}
          legendaInterativa={op.series.length > 1}
          ocultasIniciais={op.ocultas}
        />
      </div>
      <p role="status" className="t-meta mt-3 max-w-prose2 text-carvao">
        {op.frase}
      </p>
    </div>
  );
}
