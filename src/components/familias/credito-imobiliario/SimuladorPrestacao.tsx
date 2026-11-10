"use client";

import { useId, useState } from "react";
import { TabelaDados } from "@/components/painel/TabelaDados";
import { num, pc, reais0 } from "./formato";

/** Taxa ao mês equivalente à taxa ao ano, por juros compostos (não é a taxa anual dividida por doze). */
const taxaMensal = (aoAno: number) => Math.pow(1 + aoAno / 100, 1 / 12) - 1;

/** Tabela Price: prestação constante. Com taxa zero, o valor dividido pelo prazo. */
export function price(pv: number, aoAno: number, n: number) {
  const i = taxaMensal(aoAno);
  if (i <= 0) return { i: 0, primeira: pv / n, ultima: pv / n };
  const p = (pv * i) / (1 - Math.pow(1 + i, -n));
  return { i, primeira: p, ultima: p };
}

/** Sistema SAC: amortização constante, prestação decrescente. */
export function sac(pv: number, aoAno: number, n: number) {
  const i = taxaMensal(aoAno);
  const amort = pv / n;
  return { i, primeira: amort + pv * i, ultima: amort + amort * i };
}

const campo =
  "mt-1 block min-h-[44px] w-full border border-linha bg-superficie px-3 text-base tabular-nums text-carvao focus:border-bronze focus:outline-none focus:ring-2 focus:ring-bronze/30";

type Partida = { valorFinanciado: number; taxa: number; prazo: number; renda: number };

/**
 * Simulador de prestação do painel Crédito imobiliário e moradia (o mesmo da vista antiga): aritmética da tabela Price e do sistema
 * SAC sobre valores que a pessoa escolhe. É um cálculo, não uma previsão nem uma proposta de crédito, e a página diz isso junto do
 * resultado. Os valores de partida vêm de médias publicadas pelo Banco Central; a renda de partida é um valor de exemplo.
 */
export function SimuladorPrestacao({
  partida,
  estados,
  mesReferencia,
}: {
  partida: Partida;
  /** Prestação média do estoque do SFH por UF, só como ordem de grandeza ao lado do cálculo. */
  estados: { uf: string; nome: string; parcela: number | null }[];
  mesReferencia: string;
}) {
  const id = useId();
  const [txt, setTxt] = useState({ valor: String(partida.valorFinanciado), taxa: String(partida.taxa), prazo: String(partida.prazo), renda: String(partida.renda) });
  const [uf, setUf] = useState(estados.some((e) => e.uf === "SP") ? "SP" : estados[0]?.uf ?? "");
  const v = { valor: Number(txt.valor), taxa: Number(txt.taxa), prazo: Math.round(Number(txt.prazo)), renda: Number(txt.renda) };
  const valido = [v.valor, v.taxa, v.prazo, v.renda].every((x) => Number.isFinite(x) && x > 0) && v.prazo <= 600 && v.taxa <= 100;
  const pr = valido ? price(v.valor, v.taxa, v.prazo) : null;
  const sa = valido ? sac(v.valor, v.taxa, v.prazo) : null;
  const estado = estados.find((e) => e.uf === uf);
  const entrada = (chave: keyof typeof txt, rotulo: string, extra: { min: number; max?: number; step: number }) => (
    <label htmlFor={`${id}-${chave}`} className="block text-sm text-carvao-muted">
      {rotulo}
      <input id={`${id}-${chave}`} type="number" inputMode="decimal" value={txt[chave]} onChange={(e) => setTxt((t) => ({ ...t, [chave]: e.target.value }))} className={campo} autoComplete="off" {...extra} />
    </label>
  );
  return (
    <div data-simulador-prestacao="">
      <div role="group" aria-label="Valores do cálculo" className="grid gap-x-6 gap-y-4 border-y border-linha py-4 sm:grid-cols-2 lg:grid-cols-4">
        {entrada("valor", "Valor financiado, em R$", { min: 10000, step: 10000 })}
        {entrada("taxa", "Taxa de juros, em % ao ano", { min: 0.1, max: 60, step: 0.01 })}
        {entrada("prazo", "Prazo, em meses", { min: 12, max: 480, step: 12 })}
        {entrada("renda", "Renda mensal, em R$", { min: 500, step: 500 })}
      </div>
      <div role="status" className="mt-4">
        {pr && sa ? (
          <>
            <TabelaDados
              titulo="Resultado do cálculo: primeira e última prestação pela tabela Price e pelo sistema SAC"
              colunas={["Sistema", "Primeira prestação", "Última prestação", "Primeira prestação sobre a renda informada"]}
              linhas={[
                ["Price (prestação constante)", reais0(pr.primeira), reais0(pr.ultima), pc((100 * pr.primeira) / v.renda)],
                ["SAC (amortização constante)", reais0(sa.primeira), reais0(sa.ultima), pc((100 * sa.primeira) / v.renda)],
              ]}
              recolhida={false}
              idioma="pt"
            />
            <p className="t-meta mt-3 max-w-prose2 text-carvao-muted">
              Cálculo, não previsão: os quatro valores acima saem só dos números que você informou. Taxa ao mês equivalente: {num(100 * pr.i, 4)}%, obtida por (1 + taxa ao ano)
              elevado a 1/12, menos 1, e não pela divisão da taxa anual por doze.
            </p>
          </>
        ) : (
          <p className="t-corpo max-w-prose2 text-carvao" data-ausencia="">
            Informe valor, taxa, prazo e renda maiores que zero para ver o cálculo. Nenhum resultado é mostrado com valores incompletos.
          </p>
        )}
      </div>
      {estados.length > 0 && (
        <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-3">
          <label htmlFor={`${id}-uf`} className="block text-sm text-carvao-muted">
            Estado de referência
            <select id={`${id}-uf`} value={uf} onChange={(e) => setUf(e.target.value)} className={campo}>
              {estados.map((e) => (
                <option key={e.uf} value={e.uf}>
                  {e.nome}
                </option>
              ))}
            </select>
          </label>
          <p className="t-meta max-w-prose2 flex-1 basis-72 text-carvao-muted">
            Para referência, a prestação média do estoque de contratos do SFH em {estado?.nome} é de <span className="font-medium text-carvao">{reais0(estado?.parcela)}</span> (observado, Banco
            Central, Informações do Mercado Imobiliário, {mesReferencia}). É um número de universo diferente do simulado: serve como ordem de grandeza, não como comparação direta.
          </p>
        </div>
      )}
    </div>
  );
}
