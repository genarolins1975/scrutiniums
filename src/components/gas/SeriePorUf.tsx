"use client";

import { useId, useState } from "react";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";

type Ponto = Record<string, string | number | null>;

/**
 * Preço mensal de uma UF ao lado da média Brasil. A escolha da UF fica no próprio controle, junto da figura; a tabela
 * equivalente do gráfico mostra os mesmos meses. UF sem pesquisa num mês aparece como lacuna, nunca como zero.
 */
export function SeriePorUf({
  titulo,
  serieUf,
  serieBrasil,
  ufs,
  inicial,
  unidade,
  casas = 2,
  corUf,
  corBrasil,
}: {
  titulo: string;
  serieUf: Ponto[];
  serieBrasil: { mes: string; medio: number | null }[];
  ufs: { uf: string; nome: string }[];
  inicial: string;
  unidade: string;
  casas?: number;
  corUf: string;
  corBrasil: string;
}) {
  const id = useId();
  const [uf, setUf] = useState(inicial);
  const nome = ufs.find((x) => x.uf === uf)?.nome ?? uf;
  const brasil = new Map(serieBrasil.map((x) => [x.mes, x.medio]));
  const dados = serieUf.map((p) => ({ mes: p.mes as string, uf: (p[uf] as number | null | undefined) ?? null, brasil: brasil.get(p.mes as string) ?? null }));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={id} className="text-sm text-carvao">UF</label>
        <select
          id={id}
          value={uf}
          onChange={(e) => setUf(e.target.value)}
          className="min-h-[44px] border border-mineral bg-superficie px-3 text-sm text-carvao"
        >
          {ufs.map((x) => <option key={x.uf} value={x.uf}>{x.nome}</option>)}
        </select>
      </div>
      <GraficoLinhas
        titulo={`${titulo}: ${nome} e média Brasil`}
        dados={dados}
        chaveX="mes"
        formatoX="mes"
        unidade={unidade}
        casas={casas}
        zeroNoEixo
        series={[
          { id: "uf", rotulo: nome, sigla: uf, cor: corUf, espessura: 2.5 },
          { id: "brasil", rotulo: "Média Brasil", sigla: "BR", cor: corBrasil, tracejada: true },
        ]}
      />
    </div>
  );
}
