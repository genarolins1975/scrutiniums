"use client";

import { useMemo, useState } from "react";
import type { RegistroPrevisao } from "@/lib/energia/tipos";

const MOTIVOS: Record<string, string> = {
  SEM_PLD_CAPTURADO_ATE_O_CORTE: "nenhum PLD do período exigido capturado até o corte",
};
const ALERTAS: Record<string, string> = {
  ATRASADO_APOS_08H: "emitida depois do prazo das 08h00",
};

function dt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Data (AAAA-MM-DD) em que o registro entrou no arquivo da plataforma. */
function registradoEm(r: RegistroPrevisao): string {
  return r.registrado_no_portal_em;
}

/**
 * "O que a plataforma registrava naquele dia": escolha uma data e veja,
 * exatamente, os registros que já estavam no arquivo da plataforma ao fim desse
 * dia (data de inclusão, horário de Brasília), com status, motivo e sha256. A
 * emissão pela rodada pode ser anterior à inclusão e aparece em coluna própria.
 * Nada é recalculado nem reescrito. Número de rodada interna de modelo fora de
 * produção nunca é exibido como previsão.
 */
export function ArquivoPrevisoes({ registros }: { registros: RegistroPrevisao[] }) {
  const datas = useMemo(() => Array.from(new Set(registros.map(registradoEm))).sort(), [registros]);
  const [dia, setDia] = useState(datas.at(-1) ?? "");
  const vistos = registros.filter((r) => !dia || registradoEm(r) <= dia);
  return (
    <div>
      <label className="flex max-w-xs flex-col gap-1 text-xs text-mineral">
        Ver o arquivo como estava em
        <input
          type="date"
          value={dia}
          min={datas[0]}
          max={datas.at(-1)}
          onChange={(e) => setDia(e.target.value)}
          className="min-h-[44px] border border-linha bg-superficie px-3 text-sm text-carvao"
        />
      </label>
      <p className="mt-3 text-sm text-carvao" aria-live="polite">
        {vistos.length === 0
          ? "Nenhum registro emitido até esta data."
          : `${vistos.length} registros no arquivo ${dia ? `ao fim de ${dia.split("-").reverse().join("/")}` : "(todas as datas)"}: ${vistos.filter((r) => r.tipo === "PUBLICACAO").length} publicações e ${vistos.filter((r) => r.tipo === "RODADA_INTERNA").length} registros de rodadas internas.`}
      </p>
      {vistos.length > 0 && (
        <div className="tabela-scroll mt-4" tabIndex={0} role="region" aria-label="Registros do arquivo de previsões (rolável)">
          <table className="w-full min-w-[62rem] border-collapse text-xs">
            <caption className="sr-only">Registros do arquivo de previsões</caption>
            <thead>
              <tr className="text-left text-mineral">
                {["Tipo", "Incluído no arquivo", "Emitido pela rodada", "Corte", "Modelo · estado", "Horizonte", "Entrega", "Submercado", "Previsão", "Status e motivo", "sha256"].map((c) => (
                  <th key={c} scope="col" className="border-b border-linha px-2 py-2 font-medium">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vistos.map((r) => (
                <tr key={r.forecast_id} className="border-b border-linha align-top">
                  <td className="px-2 py-1.5">{r.tipo === "PUBLICACAO" ? "publicação" : "rodada interna"}</td>
                  <td className="px-2 py-1.5">{registradoEm(r).split("-").reverse().join("/")}</td>
                  <td className="px-2 py-1.5">{dt(r.emitido_em)}</td>
                  <td className="px-2 py-1.5">{dt(r.cutoff)}</td>
                  <td className="px-2 py-1.5">{r.versao_modelo} · {r.estado_modelo.toLowerCase()}</td>
                  <td className="px-2 py-1.5">{r.horizonte}</td>
                  <td className="px-2 py-1.5">{r.entrega.id}</td>
                  <td className="px-2 py-1.5">{r.submercado === "SE" ? "SE/CO" : r.submercado}</td>
                  <td className="px-2 py-1.5">
                    {r.previsao === null ? (
                      <span className="text-mineral">sem número</span>
                    ) : r.tipo !== "PUBLICACAO" || r.estado_modelo !== "PRODUCAO" ? (
                      <span className="text-mineral">número retido: rodada interna de modelo fora de produção</span>
                    ) : (
                      r.previsao.toLocaleString("pt-BR")
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {r.status === "INDISPONIVEL" ? "indisponível" : "disponível"}
                    {r.motivo && <span className="block text-mineral">{MOTIVOS[r.motivo] ?? r.motivo}</span>}
                    {r.alertas?.map((a) => <span key={a} className="block text-aviso">{ALERTAS[a] ?? a}</span>)}
                  </td>
                  <td className="break-all px-2 py-1.5 font-mono text-[0.62rem] text-mineral">{r.sha256.slice(0, 16)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
