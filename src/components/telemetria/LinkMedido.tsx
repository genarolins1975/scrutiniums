"use client";

import type { AnchorHTMLAttributes } from "react";

/** Envia a seção para /api/telemetria (o mesmo canal de MarcaVisita), sem nunca atrasar nem impedir a navegação. */
export function enviarClique(secao: string): void {
  try {
    const corpo = JSON.stringify({ secao });
    const blob = new Blob([corpo], { type: "application/json" });
    if (!(navigator.sendBeacon && navigator.sendBeacon("/api/telemetria", blob))) {
      fetch("/api/telemetria", { method: "POST", headers: { "Content-Type": "application/json" }, body: corpo, keepalive: true }).catch(() => {});
    }
  } catch {
    // telemetria nunca derruba a página
  }
}

/**
 * Link medido do mapa da conta (Iniciativa M1 do parecer de UX de 23/10/2026): um `<a href>` comum que, no clique, conta a
 * escolha (`mapa:<colecaoId>` ou `mapa:o:<observatorioId>`, allowlist em src/lib/telemetry.ts) e deixa a navegação seguir.
 * Substitui o evento "observatorio_aberto" do POST /app/observatorios/entrar: link é link, sem formulário.
 *
 * É `<a>` de documento, não `<Link>` do Next, de propósito: a navegação inteira chega ao middleware como pedido de HTML, e é aí
 * que o último acesso é gravado (src/middleware.ts). A navegação no cliente do App Router chega ao middleware sem os cabeçalhos
 * RSC (o Next os retira antes), indistinguível de um pré-carregamento, e por isso não grava. O POST antigo também terminava numa
 * navegação inteira (303).
 */
export function LinkMedido({ secao, onClick, ...resto }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; secao: string }) {
  return (
    <a
      {...resto}
      onClick={(e) => {
        enviarClique(secao);
        onClick?.(e);
      }}
    />
  );
}
