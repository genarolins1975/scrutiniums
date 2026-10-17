"use client";

import { useId, useMemo, useState } from "react";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { formatos } from "@/lib/energia/formato";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";

export type PapelLab = {
  papel: string;
  nome: string;
  /** [AAAA-MM, fechamento de tela, índice de preço ajustado, índice de retorno total] (último pregão do mês). */
  mensal: [string, number, number, number][];
  /** Eventos em ações e bonificações em outra classe, para a explicação. */
  eventos: { data_ex: string; texto: string }[];
};

const JANELAS = ["2020", "12m"] as const;

/**
 * Laboratório "preço de tela, preço ajustado e retorno total" com as séries reais de um papel da carteira do IEE. Três linhas em base
 * 100 no mesmo mês inicial: o fechamento como a bolsa mostra no dia (cai na data ex de uma bonificação ou de um desdobramento, sem que o
 * acionista perca nada), o preço ajustado por eventos em ações e o retorno total, que reinveste os proventos. A distância entre as duas
 * últimas é o que os proventos acrescentaram; a distância entre as duas primeiras é efeito de evento em ações, não de mercado.
 */
export function ListadasLabRetorno({ papeis, inicial }: { papeis: PapelLab[]; inicial: string }) {
  const tx = useTx();
  const f = formatos(useIdioma());
  const n = (v: number, casas = 1) => f.num(v, casas);
  const s = (v: number, casas = 1) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${n(Math.abs(v), casas)}`;
  const rotuloJanela = (j: (typeof JANELAS)[number]) => (j === "2020" ? tx("Desde o fim de 2020", "Since the end of 2020") : tx("Últimos 12 meses", "Last 12 months"));
  const [papel, setPapel] = useState(inicial);
  const [janela, setJanela] = useState<(typeof JANELAS)[number]>("2020");
  const id = useId();
  const p = papeis.find((x) => x.papel === papel) ?? papeis[0];
  const recorte = useMemo(() => {
    const ult = p.mensal.at(-1)?.[0] ?? "";
    const inicio = janela === "2020" ? "2020-12" : `${Number(ult.slice(0, 4)) - 1}-${ult.slice(5, 7)}`;
    const pts = p.mensal.filter(([m]) => m >= inicio);
    if (!pts.length) return null;
    const [m0, f0, ip0, it0] = pts[0];
    const dados = pts.map(([m, f, ip, it]) => ({ m, tela: (100 * f) / f0, ajustado: (100 * ip) / ip0, total: (100 * it) / it0 }));
    const fim = dados.at(-1)!;
    const eventos = p.eventos.filter((e) => e.data_ex.slice(0, 7) > m0 && e.data_ex.slice(0, 7) <= fim.m);
    return { dados, fim, m0, eventos };
  }, [p, janela]);

  return (
    <div className="space-y-4" data-lab="retorno">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <label className="flex flex-col gap-1 text-sm text-carvao" htmlFor={`${id}-papel`}>
          <span className="rotulo text-mineral">{tx("Papel", "Stock")}</span>
          <select
            id={`${id}-papel`}
            value={p.papel}
            onChange={(e) => setPapel(e.target.value)}
            className="min-h-[44px] border border-linha bg-superficie px-3 text-sm text-carvao"
          >
            {papeis.map((x) => (
              <option key={x.papel} value={x.papel}>
                {x.papel} · {x.nome}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="flex flex-wrap gap-x-4">
          <legend className="rotulo mb-1 text-mineral">{tx("Janela", "Window")}</legend>
          {JANELAS.map((j) => (
            <label key={j} className="inline-flex min-h-[44px] items-center gap-2 text-sm text-carvao">
              <input type="radio" name={`${id}-janela`} value={j} checked={janela === j} onChange={() => setJanela(j)} />
              {rotuloJanela(j)}
            </label>
          ))}
        </fieldset>
      </div>
      {recorte ? (
        <>
          <GraficoLinhas
            titulo={tx(
              `${p.papel}: fechamento de tela, preço ajustado e retorno total (base 100 no fim de ${recorte.m0.slice(5, 7)}/${recorte.m0.slice(0, 4)})`,
              `${p.papel}: screen closing price, adjusted price and total return (base 100 at the end of ${f.mesAno(recorte.m0)})`,
            )}
            dados={recorte.dados}
            chaveX="m"
            formatoX="mes"
            unidade={tx("base 100", "base 100")}
            casas={1}
            series={[
              { id: "tela", rotulo: tx("Fechamento de tela", "Screen closing price"), cor: "var(--serie-referencia)", tracejada: true },
              { id: "ajustado", rotulo: tx("Preço ajustado", "Adjusted price"), cor: "var(--serie-comp-4)" },
              { id: "total", rotulo: tx("Retorno total", "Total return"), cor: "var(--cor-energia)", espessura: 2.5 }, // i18n: dado
            ]}
            legendaInterativa
            escalaAoOcultar="manter"
            sincronizarCursor={false}
          />
          <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-3" aria-live="polite">
            <div className="border-l-2 border-linha pl-3">
              <dt className="rotulo text-mineral">{tx("Fechamento de tela", "Screen closing price")}</dt>
              <dd className="tabular-nums text-carvao">{s(recorte.fim.tela - 100)}%</dd>
            </div>
            <div className="border-l-2 border-linha pl-3">
              <dt className="rotulo text-mineral">{tx("Preço ajustado", "Adjusted price")}</dt>
              <dd className="tabular-nums text-carvao">{s(recorte.fim.ajustado - 100)}%</dd>
            </div>
            <div className="border-l-2 border-energia pl-3">
              <dt className="rotulo text-mineral">{tx("Retorno total", "Total return")}</dt>
              <dd className="tabular-nums text-carvao">{s(recorte.fim.total - 100)}%</dd>
            </div>
          </dl>
          <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
            {tx(
              `Os proventos reinvestidos acrescentaram ${n(recorte.fim.total - recorte.fim.ajustado)} pontos ao índice nesta janela.`,
              `Reinvested distributions added ${n(recorte.fim.total - recorte.fim.ajustado)} points to the index in this window.`,
            )}{" "}
            {Math.abs(recorte.fim.tela - recorte.fim.ajustado) >= 0.5
              ? tx(
                  `A diferença de ${n(Math.abs(recorte.fim.tela - recorte.fim.ajustado))} pontos entre o fechamento de tela e o preço ajustado vem de eventos em ações, não do mercado.`,
                  `The ${n(Math.abs(recorte.fim.tela - recorte.fim.ajustado))}-point difference between the screen closing price and the adjusted price comes from stock events, not from the market.`,
                )
              : tx(
                  "Não houve evento em ações que separasse o fechamento de tela do preço ajustado nesta janela.",
                  "There was no stock event separating the screen closing price from the adjusted price in this window.",
                )}
          </p>
          {recorte.eventos.length > 0 && (
            <ul className="space-y-1 text-sm text-carvao-muted">
              {recorte.eventos.map((e) => (
                <li key={`${e.data_ex}-${e.texto}`}>{e.texto}</li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="text-sm text-carvao-muted">{tx("Sem pregões do papel nesta janela.", "No trading sessions for the stock in this window.")}</p>
      )}
    </div>
  );
}
