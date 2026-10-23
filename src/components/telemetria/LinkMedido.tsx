"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

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
 */
export function LinkMedido({ secao, onClick, prefetch = false, ...resto }: ComponentProps<typeof Link> & { secao: string }) {
  return (
    <Link
      {...resto}
      prefetch={prefetch}
      onClick={(e) => {
        enviarClique(secao);
        onClick?.(e);
      }}
    />
  );
}
