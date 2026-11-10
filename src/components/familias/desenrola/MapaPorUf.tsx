"use client";

import { useId, useMemo, useState } from "react";
import { MapaCoropletico } from "@/components/energia/MapaCoropletico";
import { Controles } from "@/components/painel/Controles";
import { GraficoBarras } from "@/components/painel/GraficoBarras";
import { quebrasQuantis } from "@/lib/painel/escalas";
import { URL_GEO } from "@/lib/energia/geo";

export type UfDesenrola = {
  /** Código do IBGE da unidade da federação, a chave da malha oficial. */
  cod: string;
  uf: string;
  nome: string;
  operacoes: number;
  /** Operações por mil habitantes; null quando a gold não traz a população. */
  porMil: number | null;
  /** Valor médio por operação, em R$. */
  valorMedio: number;
  /** Volume após desconto, em R$ milhões. */
  volume: number;
};

type Medida = "operacoes" | "porMil" | "valorMedio" | "volume";

const MEDIDAS: Record<Medida, { nome: string; unidade: string; casas: number }> = {
  operacoes: { nome: "Operações", unidade: "operações", casas: 0 },
  porMil: { nome: "Operações por mil habitantes", unidade: "operações por mil habitantes", casas: 1 },
  valorMedio: { nome: "Valor médio por operação", unidade: "R$ por operação", casas: 0 },
  volume: { nome: "Volume após desconto", unidade: "R$ milhões", casas: 1 },
};

const CORES = ["var(--escala-seq-1)", "var(--escala-seq-2)", "var(--escala-seq-3)", "var(--escala-seq-4)", "var(--escala-seq-5)"];

/**
 * Renegociações por unidade da federação: o mapa na malha oficial do IBGE e, ao lado, as barras na ordem da gold (da UF com mais
 * operações para a com menos). A medida escolhida vale para os dois. As classes do mapa são quantis das 27 UFs, porque a concentração
 * em São Paulo apagaria as demais numa escala linear. Os valores chegam prontos do servidor.
 */
export function MapaPorUf({ ufs, periodo, nota }: Readonly<{ ufs: UfDesenrola[]; periodo: string; nota: string }>) {
  const id = useId();
  const [medida, setMedida] = useState<Medida>("operacoes");
  const m = MEDIDAS[medida];
  const valores = useMemo(() => Object.fromEntries(ufs.map((u) => [u.cod, u[medida]])), [ufs, medida]);
  const classes = useMemo(() => quebrasQuantis(ufs.map((u) => u[medida]), 5, { casas: m.casas }), [ufs, medida, m.casas]);
  return (
    <div data-mapa-por-uf={medida}>
      <Controles rotulo="Medida do mapa e das barras" idioma="pt">
        <label htmlFor={id} className="block text-sm text-carvao-muted">
          Medida do mapa e das barras
          <select
            id={id}
            value={medida}
            onChange={(e) => setMedida(e.target.value as Medida)}
            className="mt-1 block min-h-[44px] w-full max-w-md border border-linha bg-superficie px-3 text-base text-carvao focus:border-bronze focus:outline-none focus:ring-2 focus:ring-bronze/30"
          >
            {(Object.keys(MEDIDAS) as Medida[]).map((k) => (
              <option key={k} value={k}>
                {MEDIDAS[k].nome}
              </option>
            ))}
          </select>
        </label>
      </Controles>
      <div className="mt-4 grid gap-x-10 gap-y-8 lg:grid-cols-2">
        <div className="min-w-0">
          <MapaCoropletico
            key={medida}
            semTabela
            titulo={`${m.nome} por unidade da federação`}
            fonteGeometria={URL_GEO.uf}
            valores={valores}
            cores={CORES}
            classificacao={classes}
            unidade={m.unidade}
            casas={m.casas}
            rotuloRegiao={{ singular: "UF", plural: "UFs" }}
            rotulos
            periodo={periodo}
            nota={nota}
            altura={440}
            alturaCelular={340}
          />
        </div>
        <div className="min-w-0">
          <GraficoBarras
            key={medida}
            semTabela
            titulo={`${m.nome} por unidade da federação, da que tem mais operações para a que tem menos`}
            dados={ufs.map((u) => ({ uf: u.uf, nome: `${u.nome} (${u.uf})`, valor: u[medida] }))}
            chaveCategoria="uf"
            chaveRotulo="nome"
            series={[{ id: "valor", rotulo: m.nome, cor: "var(--cor-energia)" }]}
            unidade={m.unidade}
            casas={m.casas}
            orientacao="horizontal"
            alturaCategoria={32}
            limiteInicial={12}
            rotulosValor
            rotulosSaoNomes
          />
        </div>
      </div>
    </div>
  );
}
