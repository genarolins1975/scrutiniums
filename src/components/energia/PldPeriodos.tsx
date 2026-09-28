"use client";

import { useState } from "react";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";

type StatSm = {
  media: number;
  min: number;
  quando_min: string;
  max: number;
  quando_max: string;
  desvio_padrao: number | null;
  permanencia: { baixa: number; central: number; alta: number };
  frac_menor_valor_ano: number;
};

export type PeriodoPld = {
  id: string;
  rotulo: string;
  inicio: string;
  fim: string;
  nHoras: number;
  stats: Record<"SE" | "S" | "NE" | "N", StatSm>;
  diferenca: { horas_acima_limiar: number; frac_horas_acima_limiar: number; maior: number; quando_maior: string };
  serie: Record<string, string | number | null>[];
  formatoX: "hora" | "data" | "mes";
  descricaoSerie: string;
};

const SMS = [
  { id: "SE", rotulo: "Sudeste/Centro-Oeste", cor: "var(--serie-sm-se)" },
  { id: "S", rotulo: "Sul", cor: "var(--serie-sm-s)" },
  { id: "NE", rotulo: "Nordeste", cor: "var(--serie-sm-ne)" },
  { id: "N", rotulo: "Norte", cor: "var(--serie-sm-n)" },
] as const;

const n = (v: number | null | undefined, c = 2) =>
  v === null || v === undefined ? "sem dado" : v.toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c });
const p = (v: number) => `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const quando = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)} ${s.slice(11, 13)}h`;

/**
 * O que está acontecendo, por período: dia de referência | 7 dias | 30 dias | 12 meses |
 * Histórico. Todas as respostas vêm de regras publicadas (ver "Como
 * classificamos"); a tabela abaixo do gráfico é a mesma informação em texto.
 */
export function PldPeriodos({ periodos, limiar }: { periodos: PeriodoPld[]; limiar: number }) {
  const [sel, setSel] = useState(periodos[0].id);
  const at = periodos.find((x) => x.id === sel) ?? periodos[0];
  const d = at.diferenca;
  return (
    <div>
      <div role="tablist" aria-label="Período" className="flex flex-wrap gap-1 border-b border-linha">
        {periodos.map((x) => (
          <button
            key={x.id}
            role="tab"
            type="button"
            aria-selected={sel === x.id}
            aria-controls="pld-periodo-painel"
            onClick={() => setSel(x.id)}
            className={`rotulo min-h-[44px] border-b-2 px-3 ${sel === x.id ? "border-energia text-carvao" : "border-transparent text-carvao-muted hover:text-carvao"}`}
          >
            {x.rotulo}
          </button>
        ))}
      </div>
      <div id="pld-periodo-painel" role="tabpanel" className="pt-5">
        <p className="text-xs text-mineral">
          {quando(at.inicio)} a {quando(at.fim)} · {at.nHoras.toLocaleString("pt-BR")} horas · {at.descricaoSerie}
        </p>
        <div className="mt-3">
          <GraficoLinhas
            titulo={`PLD dos quatro submercados, ${at.rotulo.toLowerCase()}`}
            dados={at.serie}
            chaveX="x"
            series={SMS.map((s) => ({ id: s.id, rotulo: s.rotulo, cor: s.cor }))}
            unidade="R$/MWh"
            casas={2}
            formatoX={at.formatoX}
            altura={280}
          />
        </div>

        <dl className="mt-6 grid gap-px border border-linha bg-linha md:grid-cols-3">
          <div className="bg-superficie p-4">
            <dt className="rotulo text-mineral">Há diferença entre submercados?</dt>
            <dd className="mt-1 text-sm text-carvao">
              {d.horas_acima_limiar === 0
                ? `Não: nenhuma hora com diferença acima de R$ ${n(limiar, 0)}/MWh.`
                : `Sim, em ${d.horas_acima_limiar.toLocaleString("pt-BR")} horas (${p(d.frac_horas_acima_limiar)}). Maior diferença: R$ ${n(d.maior)}/MWh em ${quando(d.quando_maior)}.`}
            </dd>
          </div>
          <div className="bg-superficie p-4">
            <dt className="rotulo text-mineral">No menor valor observado do ano?</dt>
            <dd className="mt-1 text-sm text-carvao">
              {SMS.map((s) => `${s.id === "SE" ? "SE/CO" : s.id} ${p(at.stats[s.id].frac_menor_valor_ano)}`).join(" · ")} das horas.
              <span className="mt-1 block text-xs text-mineral">Menor valor observado não é o piso regulatório: o limite oficial não foi auditado nesta fase.</span>
            </dd>
          </div>
          <div className="bg-superficie p-4">
            <dt className="rotulo text-mineral">Houve picos?</dt>
            <dd className="mt-1 text-sm text-carvao">
              Máximo no Sudeste/Centro-Oeste: R$ {n(at.stats.SE.max)}/MWh em {quando(at.stats.SE.quando_max)}.
            </dd>
          </div>
        </dl>

        <div className="tabela-scroll mt-5">
          <table className="w-full min-w-[40rem] border-collapse text-sm tabular-nums">
            <caption className="sr-only">Estatísticas do PLD no período por submercado</caption>
            <thead>
              <tr className="text-left text-xs text-mineral">
                <th scope="col" className="border-b border-linha py-2 pr-3 font-medium">Submercado</th>
                <th scope="col" className="border-b border-linha px-2 py-2 font-medium">Média</th>
                <th scope="col" className="border-b border-linha px-2 py-2 font-medium">Mínimo</th>
                <th scope="col" className="border-b border-linha px-2 py-2 font-medium">Máximo</th>
                <th scope="col" className="border-b border-linha px-2 py-2 font-medium">Volatilidade (desvio padrão)</th>
                <th scope="col" className="border-b border-linha px-2 py-2 font-medium">Horas em faixa baixa · central · alta</th>
              </tr>
            </thead>
            <tbody>
              {SMS.map((s) => {
                const st = at.stats[s.id];
                return (
                  <tr key={s.id} className="border-b border-linha">
                    <th scope="row" className="py-2 pr-3 text-left font-normal text-carvao">
                      <span aria-hidden="true" className="mr-2 inline-block h-2 w-2" style={{ background: s.cor }} />
                      {s.rotulo}
                    </th>
                    <td className="px-2 py-2 text-carvao">R$ {n(st.media)}</td>
                    <td className="px-2 py-2 text-carvao">R$ {n(st.min)}</td>
                    <td className="px-2 py-2 text-carvao">R$ {n(st.max)}</td>
                    <td className="px-2 py-2 text-carvao">R$ {n(st.desvio_padrao)}</td>
                    <td className="px-2 py-2 text-carvao">
                      {p(st.permanencia.baixa)} · {p(st.permanencia.central)} · {p(st.permanencia.alta)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-mineral">
          Valores em R$/MWh nominais. Faixas: abaixo do 25º percentil, entre o 25º e o 75º e acima do 75º percentil da distribuição horária de cada submercado desde 01/01/2021.
        </p>
      </div>
    </div>
  );
}
