"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

/** Confirmação explícita da saída do boletim (a mutação nunca roda no GET). */
export function ConfirmarSaidaBoletim({ token }: { token: string }) {
  const [status, setStatus] = useState<"idle" | "enviando" | "ok" | "erro">("idle");

  async function sair() {
    setStatus("enviando");
    try {
      const res = await fetch("/api/boletim/sair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      setStatus(res.ok ? "ok" : "erro");
    } catch {
      setStatus("erro");
    }
  }

  if (status === "ok") {
    return (
      <Alert kind="sucesso">
        Pronto: você não receberá mais o boletim mensal. Se mudar de ideia, reative em
        Conta → Boletim mensal.
      </Alert>
    );
  }

  return (
    <div className="space-y-5">
      {status === "erro" && (
        <Alert kind="erro">
          Não foi possível processar a saída. O link pode estar incompleto — tente abrir
          novamente a partir do e-mail, ou gerencie a preferência na sua conta.
        </Alert>
      )}
      <Button variant="secondary" onClick={sair} disabled={status === "enviando"}>
        {status === "enviando" ? "Processando…" : "Confirmar saída do boletim"}
      </Button>
    </div>
  );
}
