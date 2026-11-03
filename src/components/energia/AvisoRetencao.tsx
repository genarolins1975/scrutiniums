"use client";

import { usePathname } from "next/navigation";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { dataRef, diaBrasilia } from "@/lib/energia/evidencia";
import { retencoesDaPagina, type Retencao } from "@/lib/energia/retencao";

/**
 * Faixa da publicação retida (decisão do dono de 03/11/2026, publicação por módulo): nas páginas de um módulo cuja atualização
 * reprovou a conferência, diz ao leitor de quando são os números que ele vê e por quê, antes de qualquer número. O texto do
 * motivo é o do pipeline (meta.json, `regressoes`), em português nas duas línguas, marcado na página inglesa. A faixa vem no HTML
 * estático; nas páginas sem retenção não há nada.
 */
export function AvisoRetencao({ retencoes }: { retencoes: readonly Retencao[] }) {
  const caminho = usePathname() ?? "/";
  const daPagina = retencoesDaPagina(caminho, retencoes);
  if (daPagina.length === 0) return null;
  const en = caminho === "/en" || caminho.startsWith("/en/");
  const idioma = en ? "en" : "pt";
  return (
    <aside data-aviso-retencao="" aria-label={en ? "Update held back" : "Atualização retida"} className="border-b border-linha bg-marfim">
      <div className="mx-auto max-w-page px-4 py-2.5 text-sm leading-relaxed text-carvao-muted sm:px-6">
        {daPagina.map((r) => {
          const data = dataRef(diaBrasilia(r.publicadaEm), false, idioma);
          return (
            <p key={r.gold} data-gold={r.gold} className="max-w-prose2">
              <span className="font-medium text-carvao">{en ? "Update held back." : "Atualização retida."}</span>{" "}
              {en
                ? `Part of the figures on this page come from the publication of ${data ?? "an earlier date"}: the latest processing did not pass the consistency checks and was not published.`
                : `Parte dos números desta página é da publicação de ${data ?? "uma data anterior"}: o processamento mais recente não passou nas conferências e não foi publicado.`}
              {r.motivo && (
                <span className="mt-0.5 block text-xs text-mineral">
                  {en ? "Reason recorded by the pipeline: " : "Motivo registrado pelo processamento: "}
                  <TrechoPortugues regiao="aviso-retencao">{r.motivo.replace(/^(?:validação crítica:\s*|CRÍTICO:\s*)+/i, "")}</TrechoPortugues>
                </span>
              )}
            </p>
          );
        })}
      </div>
    </aside>
  );
}
