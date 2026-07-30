"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

/**
 * Encerra todas as sessões da conta (inclusive a atual) e
 * redireciona para /entrar.
 */
export function EncerrarSessoes() {
  const [status, setStatus] = useState<"idle" | "encerrando" | "erro">("idle");

  async function encerrar() {
    setStatus("encerrando");
    try {
      const res = await fetch("/api/conta/sessoes", { method: "POST" });
      if (res.ok) {
        window.location.assign("/entrar");
        return;
      }
      setStatus("erro");
    } catch {
      setStatus("erro");
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-carvao-muted">
        Se você suspeita de acesso indevido ou usou a plataforma em um computador compartilhado,
        encerre todas as sessões abertas. Isso desconecta todos os dispositivos, inclusive este.
      </p>
      {status === "erro" && (
        <Alert kind="erro">Não foi possível encerrar as sessões. Tente novamente.</Alert>
      )}
      <Button variant="secondary" onClick={encerrar} disabled={status === "encerrando"}>
        {status === "encerrando"
          ? "Encerrando…"
          : "Encerrar todas as sessões (você precisará entrar novamente)"}
      </Button>
    </div>
  );
}
