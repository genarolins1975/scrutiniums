"use client";

import { useId } from "react";
import { Controles } from "@/components/painel/Controles";
import { GraficoLinhas } from "@/components/painel/GraficoLinhas";

import { useSelecaoGas } from "./useSelecaoGas";
import { mesExtenso, num, reais, sinal } from "@/lib/gas/formato";
import type { PrecoUf } from "@/lib/gas/gold";

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
  retrato,
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
  retrato: { periodo: string; ufs: PrecoUf[] };
}) {
  const id = useId();
  const escolha = useSelecaoGas("uf", ufs.map((x) => x.uf), inicial);
  const uf = escolha.valor;
  const ultimo = retrato.ufs.find((x) => x.uf === uf);
  // "R$/13 kg" e "R$/m³": o valor sai como "R$ 142,81", e a unidade fica declarada uma vez, abaixo dos números
  const emReais = unidade.startsWith("R$/");
  const unidadeExtensa = unidade === "R$/13 kg" ? "por botijão de 13 kg" : `por ${unidade.slice(3)}`;
  const formatar = (v: number | null | undefined) => v == null ? "sem dado" : emReais ? reais(v, casas) : `${num(v, casas)} ${unidade}`;
  const extremos = ultimo?.minimo == null && ultimo?.maximo == null ? "sem dado" : `${formatar(ultimo?.minimo)} a ${formatar(ultimo?.maximo)}`;
  const nome = ufs.find((x) => x.uf === uf)?.nome ?? uf;
  const brasil = new Map(serieBrasil.map((x) => [x.mes, x.medio]));
  const dados = serieUf.map((p) => ({ mes: p.mes as string, uf: (p[uf] as number | null | undefined) ?? null, brasil: brasil.get(p.mes as string) ?? null }));
  return (
    <div className="space-y-3">
      {/* controle do kit (Controles), logo antes do retrato e do gráfico que ele recorta; a UF fica na URL (?uf=) */}
      <Controles rotulo="Estado da série" idioma="pt">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor={id} className="text-sm text-carvao">UF</label>
          <select
            id={id}
            value={uf}
            onChange={(e) => escolha.selecionar(e.target.value)}
            className="min-h-[44px] border border-mineral bg-superficie px-3 text-sm text-carvao"
          >
            {ufs.map((x) => <option key={x.uf} value={x.uf}>{x.nome}</option>)}
          </select>
        </div>
      </Controles>
      <p aria-live="polite" className="text-sm text-carvao-muted">{escolha.invalida ? "A UF informada no endereço não está disponível nesta pesquisa. Exibimos a seleção inicial." : ""}</p>
      <div role="status" className="border-l-2 border-gas bg-gas-fundo p-4 text-sm leading-relaxed text-carvao">
        <p>{nome} · {mesExtenso(retrato.periodo)} · Preços observados na pesquisa da ANP.</p>
        <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <div><dt>Preço médio nominal</dt><dd className="font-medium">{formatar(ultimo?.medio)}</dd></div>
          <div><dt>Extremos nominais da amostra</dt><dd>{extremos}</dd></div>
          <div><dt>Revendas pesquisadas</dt><dd>{ultimo?.postos == null ? "sem dado" : num(ultimo.postos, 0)}</dd></div>
          <div><dt>Variação em 12 meses, calculada</dt><dd>{ultimo?.variacao_12m_pct == null ? "sem dado" : sinal(ultimo.variacao_12m_pct, 1, "%")}</dd></div>
        </dl>
        {emReais && <p className="mt-3 text-xs text-carvao-muted">Valores em reais {unidadeExtensa}.</p>}
        <p className="mt-3">Os extremos não são intervalo de confiança nem limites do mercado. Variação: preço médio do mês dividido pelo preço de 12 meses antes, menos um, em percentual.</p>
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
