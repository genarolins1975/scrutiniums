"use client";

import { useMemo, useState } from "react";
import type { RegistroPrevisao, Submercado } from "@/lib/energia/tipos";

/**
 * Máquina do tempo da previsão: escolha o que a plataforma sabia em uma data e
 * veja exatamente os registros que já estavam no arquivo ao fim desse dia,
 * célula a célula (horizonte × submercado), com o realizado das entregas que já
 * se completaram e o erro quando previsão e realizado existem. Nada é
 * recalculado: o arquivo é imutável, e número de rodada interna de modelo fora
 * de produção fica retido.
 */
export type RealizadoEntrega = { media: number | null; dias: number; esperados: number };

const SMS: Submercado[] = ["SE", "S", "NE", "N"];
const NOME: Record<Submercado, string> = { SE: "SE/CO", S: "Sul", NE: "Nordeste", N: "Norte" };
const HORIZONTES = ["W1", "W2", "W3", "W4", "M1", "M2", "M3"];
const dataBR = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const reais = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function MaquinaDoTempo({ registros, realizado }: { registros: RegistroPrevisao[]; realizado: Record<string, Partial<Record<Submercado, RealizadoEntrega>>> }) {
  const datas = useMemo(() => Array.from(new Set(registros.map((r) => r.registrado_no_portal_em))).sort(), [registros]);
  const [idx, setIdx] = useState(Math.max(0, datas.length - 1));
  const dia = datas[idx];
  const vistos = registros.filter((r) => r.registrado_no_portal_em <= dia);
  const rodadas = Array.from(new Set(vistos.map((r) => r.run_id)));
  const ultimaRodada = rodadas[rodadas.length - 1];
  const celulas = vistos.filter((r) => r.run_id === ultimaRodada);
  const porCelula = (h: string, sm: Submercado) => celulas.find((r) => r.horizonte === h && r.submercado === sm);
  const numeroPublico = (r: RegistroPrevisao) => r.previsao !== null && r.tipo === "PUBLICACAO" && r.estado_modelo === "PRODUCAO";
  // rodada inteira sem número e sem realizado: uma frase diz isso, e a tabela abre sob demanda
  const todasVazias = celulas.length > 0 && celulas.every((r) => r.previsao === null && r.status === "INDISPONIVEL") && !celulas.some((r) => SMS.some((sm) => realizado[r.entrega.id]?.[sm]?.media != null));
  if (!datas.length) return <p className="text-sm text-mineral">Nenhum registro no arquivo.</p>;
  return (
    <div>
      <label className="block text-sm text-carvao">
        <span className="rotulo text-mineral">Escolha o que sabíamos em</span>
        <span className="mt-1 flex flex-wrap items-center gap-4">
          <input
            type="range"
            min={0}
            max={datas.length - 1}
            step={1}
            value={idx}
            onChange={(e) => setIdx(Number(e.target.value))}
            aria-valuetext={dataBR(dia)}
            className="h-11 w-full max-w-md accent-[var(--cor-energia)]"
            disabled={datas.length < 2}
          />
          <span className="font-serif text-2xl tabular-nums text-carvao">{dataBR(dia)}</span>
        </span>
      </label>
      <p className="mt-1 text-xs text-mineral">
        {datas.length === 1 ? "Há uma única data com registros no arquivo até agora; o controle ganha posições a cada dia com registros novos." : `${datas.length} datas com registros, de ${dataBR(datas[0])} a ${dataBR(datas[datas.length - 1])}.`}
      </p>

      <dl className="mt-5 grid gap-px border border-linha bg-linha sm:grid-cols-3">
        <div className="bg-superficie p-4">
          <dt className="rotulo text-mineral">Registros no arquivo ao fim do dia</dt>
          <dd className="mt-1 font-serif text-2xl tabular-nums text-carvao">{vistos.length}</dd>
        </div>
        <div className="bg-superficie p-4">
          <dt className="rotulo text-mineral">Publicações oficiais</dt>
          <dd className="mt-1 font-serif text-2xl tabular-nums text-carvao">{vistos.filter((r) => r.tipo === "PUBLICACAO").length}</dd>
        </div>
        <div className="bg-superficie p-4">
          <dt className="rotulo text-mineral">Rodadas internas</dt>
          <dd className="mt-1 font-serif text-2xl tabular-nums text-carvao">{rodadas.length}</dd>
        </div>
      </dl>

      {ultimaRodada && (
        <div className="mt-5">
          <p className="text-sm text-carvao">
            Última rodada registrada até essa data: <span className="break-all font-mono text-xs">{ultimaRodada}</span>
            {celulas[0] ? ` · modelo ${celulas[0].modelo} (${celulas[0].estado_modelo.toLowerCase()}) · corte ${new Date(celulas[0].cutoff).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}` : ""}
          </p>
          {todasVazias && (
            <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao">
              As {celulas.length} células desta rodada ({HORIZONTES.filter((h) => SMS.some((sm) => porCelula(h, sm))).length} horizontes por {SMS.length} submercados) estão registradas sem número e com status indisponível: o modelo está em pesquisa, e a plataforma registra a ausência, não um valor. Nenhuma entrega tem realizado a comparar.
            </p>
          )}
          <details open={!todasVazias} className="mt-3">
            <summary className="rotulo min-h-[44px] cursor-pointer text-carvao-muted">{todasVazias ? `Ver as ${celulas.length} células, uma a uma` : "Células da rodada"}</summary>
          <div className="tabela-scroll mt-3" tabIndex={0} role="region" aria-label="Células da rodada por horizonte e submercado (tabela rolável)">
            <table className="w-full min-w-[44rem] border-collapse text-xs">
              <caption className="sr-only">Previsão, realizado e erro por horizonte e submercado</caption>
              <thead>
                <tr className="text-left text-mineral">
                  <th scope="col" className="border-b border-linha px-2 py-2 font-medium">Horizonte · entrega</th>
                  {SMS.map((sm) => (
                    <th key={sm} scope="col" className="border-b border-linha px-2 py-2 font-medium">
                      {NOME[sm]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HORIZONTES.map((h) => {
                  const primeira = SMS.map((sm) => porCelula(h, sm)).find(Boolean);
                  if (!primeira) return null;
                  return (
                    <tr key={h} className="border-b border-linha align-top">
                      <th scope="row" className="px-2 py-2 text-left font-normal text-carvao">
                        {h}
                        <span className="block text-mineral">
                          {primeira.entrega.id} · {dataBR(primeira.entrega.inicio.slice(0, 10))} a {dataBR(primeira.entrega.fim.slice(0, 10))}
                        </span>
                      </th>
                      {SMS.map((sm) => {
                        const r = porCelula(h, sm);
                        const real = r ? realizado[r.entrega.id]?.[sm] : undefined;
                        return (
                          <td key={sm} className="px-2 py-2">
                            {!r ? (
                              <span className="text-mineral">sem registro</span>
                            ) : (
                              <>
                                <span className="block text-carvao">
                                  {r.previsao === null ? "sem número" : numeroPublico(r) ? reais(r.previsao) : "número retido"}
                                </span>
                                <span className="block text-mineral">{r.status === "INDISPONIVEL" ? "indisponível" : "disponível"}</span>
                                <span className="block text-mineral">
                                  realizado:{" "}
                                  {real && real.media !== null ? `${reais(real.media)}${real.dias < real.esperados ? ` (${real.dias} de ${real.esperados} dias)` : ""}` : "ainda não disponível"}
                                </span>
                                {numeroPublico(r) && real && real.media !== null && real.dias >= real.esperados && (
                                  <span className="block text-carvao">erro: {reais((r.previsao as number) - real.media)}</span>
                                )}
                              </>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </details>
          <p className="mt-2 text-xs leading-relaxed text-mineral">
            &quot;Número retido&quot;: a rodada interna de modelo fora de produção produziu um valor que não é exibido, por regra de governança. &quot;Sem número&quot;: a rodada não gerou valor (motivo no histórico). O realizado é a média das médias diárias do PLD nos dias da entrega, calculada pela plataforma; o erro é previsão menos realizado e só aparece quando os dois existem e a entrega está completa.
          </p>
        </div>
      )}
    </div>
  );
}
