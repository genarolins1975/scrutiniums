"use client";

import { usePathname } from "next/navigation";
import { exigeConta } from "@/lib/rotasPublicas";
import { ehPaginaAberta, textosAcesso } from "./sessao";

export function Cadeado() {
  return (
    // tamanho no atributo style: regras de figura dos painéis (ex.: `.rowStrip svg{width:100%}`) não o esticam
    <svg aria-hidden="true" width="11" height="12" viewBox="0 0 11 12" fill="none" className="shrink-0" style={{ display: "inline-block", width: 11, height: 12, overflow: "hidden" }}>
      <rect x="0.75" y="5.25" width="9.5" height="6" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2.75 5.25V3.5a2.75 2.75 0 0 1 5.5 0v1.75" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

/**
 * Selo "com conta" de um link numa página aberta (estratégia "aberto e com conta", 19/10/2026):
 * aparece só quando a página atual é aberta e o destino (`href`) pede sessão, para o visitante saber
 * antes do clique que ali começa a conta gratuita. Nas páginas fechadas não aparece, porque todos ali já
 * têm sessão. `sempre` mostra o selo sem olhar o destino (recurso fechado que não é link).
 * Fica dentro do link, sem o sublinhado dele, no idioma do endereço (ou no fixado por `idioma`).
 */
export function SeloComConta({
  href,
  sempre = false,
  className = "",
  idioma,
}: {
  href?: string;
  sempre?: boolean;
  className?: string;
  /** Fixa o idioma do selo: página em português servida também pela irmã /en como conteúdo português marcado. */
  idioma?: "pt" | "en";
}) {
  const caminho = usePathname();
  const aberta = ehPaginaAberta(caminho);
  if (!aberta || (!sempre && (!href || !exigeConta(href)))) return null;
  return (
    // o selo interno é inline-flex (atômico): o sublinhado do link não passa para ele, mesmo quando o link é flex
    <span data-selo-conta="" className={`ml-1.5 inline-block align-baseline text-xs font-normal normal-case tracking-normal text-mineral ${className}`}>
      <span className="inline-flex items-center gap-1 whitespace-nowrap">
        <Cadeado /> {textosAcesso(idioma ? (idioma === "en" ? "/en" : "/") : caminho).selo}
      </span>
    </span>
  );
}
