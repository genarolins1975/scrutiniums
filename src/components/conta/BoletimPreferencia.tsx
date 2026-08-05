"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

/**
 * Liga/desliga o boletim mensal (consentimento de comunicações). O estado
 * inicial vem do servidor; a troca é imediata e reversível.
 */
export function BoletimPreferencia({ optInInicial }: { optInInicial: boolean }) {
  const [optIn, setOptIn] = useState(optInInicial);
  const [status, setStatus] = useState<"idle" | "salvando" | "erro">("idle");

  async function alternar() {
    setStatus("salvando");
    try {
      const res = await fetch("/api/conta/boletim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optIn: !optIn }),
      });
      if (res.ok) {
        setOptIn(!optIn);
        setStatus("idle");
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
        Um e-mail por mês com os alertas ativos da central do Observatório — texto puro,
        fontes declaradas, sem propaganda. Todo boletim traz link de saída de um clique.
      </p>
      <p className="text-sm text-carvao">
        Situação atual: <strong>{optIn ? "você recebe o boletim" : "você não recebe o boletim"}</strong>.
      </p>
      {status === "erro" && (
        <Alert kind="erro">Não foi possível salvar a preferência. Tente novamente.</Alert>
      )}
      <Button variant="secondary" onClick={alternar} disabled={status === "salvando"}>
        {status === "salvando"
          ? "Salvando…"
          : optIn
            ? "Deixar de receber o boletim"
            : "Passar a receber o boletim"}
      </Button>
    </div>
  );
}
