"use client";

import { useId, useState } from "react";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { useSelecaoGas } from "@/components/gas/useSelecaoGas";
import { COR } from "@/lib/gas/cores";
import { mesAno, mesExtenso } from "@/lib/gas/formato";
import type { IdCombustivel, ProdutoCombustivel } from "@/lib/gas/gold";
import { BRASIL, opcoesUf } from "./PrecoNoEstado";

type Ponto = Record<string, string | number | null>;
type Marco = { x: string; rotulo: string };

const CORES: Record<IdCombustivel, string> = { gasolina: COR.foco, etanol: COR.comp[0], diesel: COR.comp[1], diesel_s10: COR.comp[2] };

function Seletor({ rotulo, valor, opcoes, onChange }: { rotulo: string; valor: string; opcoes: { valor: string; rotulo: string }[]; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-sm text-carvao">{rotulo}</label>
      <select id={id} value={valor} onChange={(e) => onChange(e.target.value)} className="mt-1 min-h-[44px] max-w-full border border-mineral bg-superficie px-3 text-sm text-carvao">
        {opcoes.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
      </select>
    </div>
  );
}

/**
 * Série Brasil desde 2013 dos quatro combustíveis, em valores da época ou corrigidos pelo IPCA (a escolha fica no próprio
 * controle). O mês sem pesquisa é lacuna na linha; os marcos vêm das observações da planilha da ANP.
 */
export function HistoricoBrasil({ serie, produtos, mesBase, marcos }: { serie: Ponto[]; produtos: ProdutoCombustivel[]; mesBase: string; marcos: Marco[] }) {
  const [modo, setModo] = useState<"nominal" | "real">("nominal");
  const nome = `${useId()}-modo`;
  const sufixo = modo === "real" ? "_real" : "";
  return (
    <div className="space-y-3">
      <fieldset className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <legend className="mb-1 text-sm text-carvao">Valores</legend>
        {(["nominal", "real"] as const).map((m) => (
          <label key={m} className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-carvao">
            <input type="radio" name={nome} value={m} checked={modo === m} onChange={() => setModo(m)} className="h-4 w-4 accent-[var(--cor-gas-dark)]" />
            {m === "nominal" ? "Da época (nominais)" : `Corrigidos pelo IPCA, em reais de ${mesExtenso(mesBase)}`}
          </label>
        ))}
      </fieldset>
      <GraficoLinhas
        titulo={modo === "nominal" ? "Preço médio do litro no Brasil, valores da época" : `Preço médio do litro no Brasil, em reais de ${mesAno(mesBase)}`}
        dados={serie}
        chaveX="mes"
        formatoX="mes"
        unidade="R$/l"
        casas={2}
        zeroNoEixo
        zoom
        legendaInterativa
        chaveUrl="hist"
        marcos={marcos}
        series={produtos.map((p, i) => ({ id: `${p.id}${sufixo}`, rotulo: p.nome, sigla: p.curto, cor: CORES[p.id], espessura: i === 0 ? 2.5 : 2, tracejada: p.id === "diesel_s10" }))}
      />
    </div>
  );
}

/** O preço de um estado ao lado da média Brasil, mês a mês desde 2013, para o combustível escolhido. */
export function SerieDoEstado({ meses, valores, brasil, produtos, ufs }: {
  meses: string[];
  valores: Record<IdCombustivel, Record<string, (number | null)[]>>;
  brasil: Ponto[];
  produtos: ProdutoCombustivel[];
  ufs: { uf: string; nome: string }[];
}) {
  const opcoes = opcoesUf(ufs);
  const uf = useSelecaoGas("uf", opcoes.map((o) => o.valor), BRASIL);
  const produto = useSelecaoGas("produto", produtos.map((p) => p.id), "gasolina");
  const p = produtos.find((x) => x.id === produto.valor) ?? produtos[0];
  const nome = opcoes.find((o) => o.valor === uf.valor)?.rotulo ?? uf.valor;
  const doEstado = uf.valor === BRASIL ? null : valores[p.id][uf.valor];
  const dados = meses.map((m, i) => ({ mes: m, uf: doEstado ? doEstado[i] : null, brasil: (brasil[i]?.[p.id] as number | null) ?? null }));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <Seletor rotulo="Estado" valor={uf.valor} opcoes={opcoes} onChange={uf.selecionar} />
        <Seletor rotulo="Combustível" valor={p.id} opcoes={produtos.map((x) => ({ valor: x.id, rotulo: x.nome }))} onChange={produto.selecionar} />
      </div>
      {!doEstado && <p className="text-sm text-carvao-muted">Escolha um estado para ver a linha dele ao lado da média do Brasil.</p>}
      <GraficoLinhas
        titulo={doEstado ? `${p.nome}: ${nome} e média Brasil` : `${p.nome}: média Brasil`}
        dados={dados}
        chaveX="mes"
        formatoX="mes"
        unidade="R$/l"
        casas={2}
        zeroNoEixo
        zoom
        chaveUrl="serieuf"
        series={[
          ...(doEstado ? [{ id: "uf", rotulo: nome, sigla: uf.valor, cor: COR.foco, espessura: 2.5 }] : []),
          { id: "brasil", rotulo: "Média Brasil", sigla: "BR", cor: COR.referencia, tracejada: true },
        ]}
      />
    </div>
  );
}

/**
 * As 27 UFs no último mês, da maior para a menor média, com a média do Brasil como linha de referência. A UF escolhida no
 * alto da página fica selecionada. UF sem preço publicado aparece como "sem dado", no fim da lista.
 */
export function ComparacaoUfs({ ufs, produtos, brasil, ultimoMes }: {
  ufs: ({ uf: string; nome: string } & Record<IdCombustivel, { medio: number } | null>)[];
  produtos: ProdutoCombustivel[];
  brasil: Record<IdCombustivel, number>;
  ultimoMes: string;
}) {
  const opcoes = opcoesUf(ufs);
  const uf = useSelecaoGas("uf", opcoes.map((o) => o.valor), BRASIL);
  const produto = useSelecaoGas("produto", produtos.map((p) => p.id), "gasolina");
  const p = produtos.find((x) => x.id === produto.valor) ?? produtos[0];
  const dados = [...ufs]
    .map((u) => ({ uf: u.uf, nome: u.nome, medio: u[p.id]?.medio ?? null }))
    .sort((a, b) => (a.medio === null ? 1 : b.medio === null ? -1 : b.medio - a.medio || a.nome.localeCompare(b.nome, "pt-BR")));
  return (
    <div className="space-y-3">
      <Seletor rotulo="Combustível" valor={p.id} opcoes={produtos.map((x) => ({ valor: x.id, rotulo: x.nome }))} onChange={produto.selecionar} />
      <GraficoBarras
        titulo={`${p.nome}: preço médio do litro por UF, ${mesAno(ultimoMes)}`}
        dados={dados}
        chaveCategoria="uf"
        chaveRotulo="nome"
        orientacao="horizontal"
        series={[{ id: "medio", rotulo: "Preço médio do litro", cor: COR.foco }]}
        unidade="R$/l"
        casas={2}
        rotulosValor
        referencias={[{ valor: brasil[p.id], rotulo: "Média Brasil" }]}
        selecionado={uf.valor === BRASIL ? null : uf.valor}
        onSelecionar={(v) => uf.selecionar(v ?? BRASIL)}
        rotulosSaoNomes
      />
    </div>
  );
}
