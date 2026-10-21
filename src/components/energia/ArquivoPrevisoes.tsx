"use client";

import { useMemo, useState } from "react";
import { dataBR } from "@/lib/energia/formato";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import { textoAlertas, textoMotivo } from "@/lib/energia/previsoes";
import type { RegistroPrevisao } from "@/lib/energia/tipos";
import type { Idioma } from "@/lib/idioma";

const MOTIVOS: Record<string, string> = {
  SEM_PLD_CAPTURADO_ATE_O_CORTE: "nenhum PLD do período exigido capturado até o corte", // i18n: dado
};
const ALERTAS: Record<string, string> = {
  ATRASADO_APOS_08H: "emitida depois do prazo das 08h00", // i18n: dado
};

function dt(iso: string, idioma: Idioma) {
  const d = new Date(iso);
  return d.toLocaleString(idioma === "en" ? "en-US" : "pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
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
  const idioma = useIdioma();
  const tx = useTx();
  const diaBR = (d: string) => (idioma === "en" ? dataBR(d, "en") : d.split("-").reverse().join("/"));
  const datas = useMemo(() => Array.from(new Set(registros.map(registradoEm))).sort(), [registros]);
  const [dia, setDia] = useState(datas.at(-1) ?? "");
  const vistos = registros.filter((r) => !dia || registradoEm(r) <= dia);
  return (
    <div>
      <label className="flex max-w-xs flex-col gap-1 text-xs text-mineral">
        {tx("Ver o arquivo como estava em", "See the archive as it was on")}
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
          ? tx("Nenhum registro emitido até esta data.", "No record issued up to this date.")
          : tx(
              `${vistos.length} registros no arquivo ${dia ? `ao fim de ${dia.split("-").reverse().join("/")}` : "(todas as datas)"}: ${vistos.filter((r) => r.tipo === "PUBLICACAO").length} publicações e ${vistos.filter((r) => r.tipo === "RODADA_INTERNA").length} registros de rodadas internas.`,
              `${vistos.length} records in the archive ${dia ? `at the end of ${diaBR(dia)}` : "(all dates)"}: ${vistos.filter((r) => r.tipo === "PUBLICACAO").length} publications and ${vistos.filter((r) => r.tipo === "RODADA_INTERNA").length} internal run records.`,
            )}
      </p>
      {vistos.length > 0 && (
        <div className="tabela-scroll mt-4" tabIndex={0} role="region" aria-label={tx("Registros do arquivo de previsões (rolável)", "Forecast archive records (scrollable)")}>
          <table className="w-full min-w-[62rem] border-collapse text-xs">
            <caption className="sr-only">{tx("Registros do arquivo de previsões", "Forecast archive records")}</caption>
            <thead>
              <tr className="text-left text-mineral">
                {[
                  tx("Tipo", "Type"),
                  tx("Incluído no arquivo", "Included in the archive"),
                  tx("Emitido pela rodada", "Issued by the run"),
                  tx("Corte", "Cutoff"),
                  tx("Modelo · estado", "Model · state"),
                  tx("Horizonte", "Horizon"),
                  tx("Entrega", "Delivery"),
                  tx("Submercado", "Submarket"),
                  tx("Previsão", "Forecast"),
                  tx("Status e motivo", "Status and reason"),
                  "sha256",
                ].map((c) => (
                  <th key={c} scope="col" className="border-b border-linha px-2 py-2 font-medium">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vistos.map((r) => (
                <tr key={r.forecast_id} className="border-b border-linha align-top">
                  <td className="px-2 py-1.5">{r.tipo === "PUBLICACAO" ? tx("publicação", "publication") : tx("rodada interna", "internal run")}</td>
                  <td className="px-2 py-1.5">{diaBR(registradoEm(r))}</td>
                  <td className="px-2 py-1.5">{dt(r.emitido_em, idioma)}</td>
                  <td className="px-2 py-1.5">{dt(r.cutoff, idioma)}</td>
                  <td className="px-2 py-1.5">
                    {r.versao_modelo} · {tx(r.estado_modelo.toLowerCase(), r.estado_modelo === "PRODUCAO" ? "production" : r.estado_modelo === "VALIDACAO" ? "validation" : r.estado_modelo === "APOSENTADO" ? "retired" : "research")}
                  </td>
                  <td className="px-2 py-1.5">{r.horizonte}</td>
                  <td className="px-2 py-1.5">{r.entrega.id}</td>
                  <td className="px-2 py-1.5">{r.submercado === "SE" ? tx("SE/CO", "SE/CW") : r.submercado}</td>
                  <td className="px-2 py-1.5">
                    {r.previsao === null ? (
                      <span className="text-mineral">{tx("sem número", "no number")}</span>
                    ) : r.tipo !== "PUBLICACAO" || r.estado_modelo !== "PRODUCAO" ? (
                      <span className="text-mineral">{tx("número retido: rodada interna de modelo fora de produção", "number withheld: internal run of a model not in production")}</span>
                    ) : (
                      r.previsao.toLocaleString(idioma === "en" ? "en-US" : "pt-BR")
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {r.status === "INDISPONIVEL" ? tx("indisponível", "unavailable") : tx("disponível", "available")}
                    {r.motivo && <span className="block text-mineral">{tx(MOTIVOS[r.motivo] ?? r.motivo, textoMotivo(r.motivo, "en"))}</span>}
                    {r.alertas?.map((a) => (
                      <span key={a} className="block text-aviso">
                        {tx(ALERTAS[a] ?? a, textoAlertas([a], "en"))}
                      </span>
                    ))}
                  </td>
                  <td className="break-all px-2 py-1.5 font-mono text-xs text-mineral">{r.sha256.slice(0, 16)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
