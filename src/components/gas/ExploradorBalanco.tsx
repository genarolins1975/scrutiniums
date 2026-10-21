"use client";

import { useId } from "react";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { useSelecaoGas } from "./useSelecaoGas";
import type { AproveitamentoGold } from "@/lib/gas/gold";
import { mesExtenso, num, sinal } from "@/lib/gas/formato";
import { COR } from "@/lib/gas/cores";

const DESTINOS = [["reinjecao", "Reinjeção"], ["queima", "Queima e perda"], ["consumo_proprio", "Consumo próprio"], ["disponivel", "Disponível"]] as const;

export function ExploradorBalanco({ serie }: { serie: AproveitamentoGold["serie"] }) {
  const id = useId();
  const escolha = useSelecaoGas("balanco", serie.map((p) => p.mes), serie.at(-1)?.mes ?? "");
  const ponto = serie.find((p) => p.mes === escolha.valor);
  if (!ponto) return <p>Sem dados para explorar o balanço.</p>;
  const valido = ponto.situacao === "ok";
  const dados = DESTINOS.map(([chave, nome]) => ({ nome, valor: valido ? ponto[chave] as number | null : null }));
  const situacao = ponto.situacao === "incompleto" ? "Sem dado: falta uma parcela; a diferença não pode ser calculada."
    : ponto.situacao === "inconsistente" ? "Balanço inconsistente: as parcelas foram reprovadas na conferência e não são exibidas."
    : "Balanço conferido dentro da tolerância declarada. A diferença permanece publicada.";
  const formatar = (v: unknown, unidade: string) => typeof v === "number" && Number.isFinite(v) ? `${num(v, 2)} ${unidade}` : "sem dado";
  // percentuais com o símbolo junto do número, como no restante do observatório
  const pct = (v: unknown, comSinal = false) => typeof v === "number" && Number.isFinite(v) ? (comSinal ? sinal(v, 2, "%") : `${num(v, 2)}%`) : "sem dado";
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-3">
      <label htmlFor={id} className="text-sm text-carvao">Mês do balanço</label>
      <select id={id} value={escolha.valor} onChange={(e) => escolha.selecionar(e.target.value)} className="min-h-[44px] border border-mineral bg-superficie px-3 text-sm text-carvao">
        {[...serie].reverse().map((p) => <option key={p.mes} value={p.mes}>{mesExtenso(p.mes)}</option>)}
      </select>
    </div>
    <p aria-live="polite" className="text-sm text-carvao-muted">{escolha.invalida ? "O mês informado no endereço não existe nesta série. Exibimos o último mês disponível." : ""}</p>
    <div role="status" className="border-l-2 border-gas bg-gas-fundo p-4 text-sm leading-relaxed text-carvao">
      <p>{mesExtenso(ponto.mes)} · Brasil · Calculado a partir dos conjuntos da ANP.</p>
      <p className="mt-1">{situacao}</p>
      <p className="mt-1">Produção: {formatar(ponto.producao, "milhões de m³/dia")}. Diferença entre produção e parcelas: {pct(ponto.diferenca_pct, true)} da produção.</p>
    </div>
    {valido && <GraficoBarras titulo={`Destinos da produção em ${mesExtenso(ponto.mes)}`} dados={dados} chaveCategoria="nome" orientacao="horizontal" unidade="milhões de m³/dia" casas={2} rotulosValor series={[{ id: "valor", rotulo: "Média diária", cor: COR.foco }]} />}
    <table className="w-full border-collapse text-sm text-carvao [font-variant-numeric:tabular-nums]">
      <caption className="pb-2 text-left">Participação na produção de {mesExtenso(ponto.mes)}, Brasil, calculada pela Scrutiniums a partir da ANP</caption>
      <thead><tr className="border-b border-linha"><th scope="col" className="py-2 text-left font-normal">Destino</th><th scope="col" className="py-2 text-right font-normal">% da produção</th></tr></thead>
      <tbody>{DESTINOS.map(([chave, nome]) => <tr key={chave} className="border-b border-linha"><th scope="row" className="py-3 text-left font-normal">{nome}</th><td className="py-3 text-right">{pct(valido ? ponto[`${chave}_pct`] : null)}</td></tr>)}</tbody>
    </table>
    <p className="text-sm leading-relaxed text-carvao-muted">Média diária: volume do mês dividido pelos dias do mês. Participação: parcela dividida pela produção do mesmo mês. Parte do disponível ainda passa por processamento, e ele não mede consumo final. <a href="/gas-natural/metodologia#validacoes" className="inline-flex min-h-[44px] items-center text-gas-dark underline underline-offset-4">Consultar a regra de conferência</a>.</p>
  </div>;
}
