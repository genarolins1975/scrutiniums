"use client";

import { useId, useMemo, useState } from "react";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";

export type PapelLab = {
  papel: string;
  nome: string;
  /** [AAAA-MM, fechamento de tela, índice de preço ajustado, índice de retorno total] (último pregão do mês). */
  mensal: [string, number, number, number][];
  /** Eventos em ações e bonificações em outra classe, para a explicação. */
  eventos: { data_ex: string; texto: string }[];
};

const JANELAS = [
  { id: "2020", rotulo: "Desde o fim de 2020" },
  { id: "12m", rotulo: "Últimos 12 meses" },
] as const;

function n(v: number, casas = 1): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }).replace(/^-/, "−");
}
function s(v: number, casas = 1): string {
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${n(Math.abs(v), casas)}`;
}

/**
 * Laboratório "preço de tela, preço ajustado e retorno total" com as séries reais de um papel da carteira do IEE. Três linhas em base
 * 100 no mesmo mês inicial: o fechamento como a bolsa mostra no dia (cai na data ex de uma bonificação ou de um desdobramento, sem que o
 * acionista perca nada), o preço ajustado por eventos em ações e o retorno total, que reinveste os proventos. A distância entre as duas
 * últimas é o que os proventos acrescentaram; a distância entre as duas primeiras é efeito de evento em ações, não de mercado.
 */
export function ListadasLabRetorno({ papeis, inicial }: { papeis: PapelLab[]; inicial: string }) {
  const [papel, setPapel] = useState(inicial);
  const [janela, setJanela] = useState<(typeof JANELAS)[number]["id"]>("2020");
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
          <span className="rotulo text-mineral">Papel</span>
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
          <legend className="rotulo mb-1 text-mineral">Janela</legend>
          {JANELAS.map((j) => (
            <label key={j.id} className="inline-flex min-h-[44px] items-center gap-2 text-sm text-carvao">
              <input type="radio" name={`${id}-janela`} value={j.id} checked={janela === j.id} onChange={() => setJanela(j.id)} />
              {j.rotulo}
            </label>
          ))}
        </fieldset>
      </div>
      {recorte ? (
        <>
          <GraficoLinhas
            titulo={`${p.papel}: fechamento de tela, preço ajustado e retorno total (base 100 no fim de ${recorte.m0.slice(5, 7)}/${recorte.m0.slice(0, 4)})`}
            dados={recorte.dados}
            chaveX="m"
            formatoX="mes"
            unidade="base 100"
            casas={1}
            series={[
              { id: "tela", rotulo: "Fechamento de tela", cor: "var(--serie-referencia)", tracejada: true },
              { id: "ajustado", rotulo: "Preço ajustado", cor: "var(--serie-comp-4)" },
              { id: "total", rotulo: "Retorno total", cor: "var(--cor-energia)", espessura: 2.5 },
            ]}
            legendaInterativa
            escalaAoOcultar="manter"
            sincronizarCursor={false}
          />
          <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-3" aria-live="polite">
            <div className="border-l-2 border-linha pl-3">
              <dt className="rotulo text-mineral">Fechamento de tela</dt>
              <dd className="tabular-nums text-carvao">{s(recorte.fim.tela - 100)}%</dd>
            </div>
            <div className="border-l-2 border-linha pl-3">
              <dt className="rotulo text-mineral">Preço ajustado</dt>
              <dd className="tabular-nums text-carvao">{s(recorte.fim.ajustado - 100)}%</dd>
            </div>
            <div className="border-l-2 border-energia pl-3">
              <dt className="rotulo text-mineral">Retorno total</dt>
              <dd className="tabular-nums text-carvao">{s(recorte.fim.total - 100)}%</dd>
            </div>
          </dl>
          <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
            Os proventos reinvestidos acrescentaram {n(recorte.fim.total - recorte.fim.ajustado)} pontos ao índice nesta janela.{" "}
            {Math.abs(recorte.fim.tela - recorte.fim.ajustado) >= 0.5
              ? `A diferença de ${n(Math.abs(recorte.fim.tela - recorte.fim.ajustado))} pontos entre o fechamento de tela e o preço ajustado vem de eventos em ações, não do mercado.`
              : "Não houve evento em ações que separasse o fechamento de tela do preço ajustado nesta janela."}
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
        <p className="text-sm text-carvao-muted">Sem pregões do papel nesta janela.</p>
      )}
    </div>
  );
}
