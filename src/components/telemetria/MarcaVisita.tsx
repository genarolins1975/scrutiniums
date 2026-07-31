"use client";

import { useEffect } from "react";

/**
 * Registra a visita à seção atual (uma vez por montagem) via
 * navigator.sendBeacon, com fallback em fetch keepalive. Nunca interfere
 * na página: qualquer falha é engolida em silêncio.
 */
export function MarcaVisita({ secao }: { secao: string }) {
  useEffect(() => {
    try {
      const corpo = JSON.stringify({ secao });
      const blob = new Blob([corpo], { type: "application/json" });
      if (!(navigator.sendBeacon && navigator.sendBeacon("/api/telemetria", blob))) {
        fetch("/api/telemetria", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: corpo,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      // Telemetria nunca derruba a página.
    }
  }, [secao]);
  return null;
}
