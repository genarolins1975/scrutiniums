"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

/**
 * Botão que confirma ou cancela a assinatura do resumo. A mudança só acontece no
 * clique (POST), nunca ao abrir o link: scanners de e-mail pré-buscam URLs.
 */
export function AcaoAssinatura({ token, acao }: { token: string; acao: "confirmar" | "sair" }) {
  const [status, setStatus] = useState<"idle" | "enviando" | "ok" | "erro">("idle");
  const textos =
    acao === "confirmar"
      ? { botao: "Confirmar a assinatura", ok: "Assinatura confirmada. O próximo resumo chega no e-mail, na periodicidade escolhida.", erro: "Link de confirmação inválido ou vencido. Peça a assinatura de novo no resumo." }
      : { botao: "Deixar de receber o resumo", ok: "Pronto: você não receberá mais o resumo e o endereço foi apagado da lista.", erro: "Não foi possível processar a saída. Abra de novo o link a partir do e-mail." };

  async function executar() {
    setStatus("enviando");
    try {
      const res = await fetch(`/api/resumo/assinatura/${acao}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      setStatus(res.ok ? "ok" : "erro");
    } catch {
      setStatus("erro");
    }
  }

  if (status === "ok") return <Alert kind="sucesso">{textos.ok}</Alert>;
  return (
    <div className="space-y-5">
      {status === "erro" && <Alert kind="erro">{textos.erro}</Alert>}
      <Button variant={acao === "sair" ? "secondary" : "primary"} onClick={executar} disabled={status === "enviando"}>
        {status === "enviando" ? "Processando…" : textos.botao}
      </Button>
    </div>
  );
}
