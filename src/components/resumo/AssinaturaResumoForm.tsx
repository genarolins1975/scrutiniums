"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";

/**
 * Assinatura do resumo por e-mail, sem conta. Dupla confirmação: este
 * formulário só registra o pedido; a assinatura começa pelo link enviado.
 */
export function AssinaturaResumoForm() {
  const [email, setEmail] = useState("");
  const [periodicidade, setPeriodicidade] = useState<"diaria" | "semanal">("semanal");
  const [consentimento, setConsentimento] = useState(false);
  const [estado, setEstado] = useState<{ tipo: "idle" | "enviando" | "ok" | "erro"; msg?: string }>({ tipo: "idle" });

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEstado({ tipo: "enviando" });
    try {
      const res = await fetch("/api/resumo/assinar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, periodicidade, consentimento }),
      });
      const j = (await res.json().catch(() => ({}))) as { mensagem?: string; error?: string };
      setEstado(res.ok ? { tipo: "ok", msg: j.mensagem } : { tipo: "erro", msg: j.error ?? "Não foi possível registrar o pedido." });
    } catch {
      setEstado({ tipo: "erro", msg: "Falha de rede. Tente novamente." });
    }
  }

  if (estado.tipo === "ok") return <Alert kind="sucesso">{estado.msg}</Alert>;

  return (
    <form onSubmit={enviar} className="space-y-5" noValidate>
      {estado.tipo === "erro" && <Alert kind="erro">{estado.msg}</Alert>}
      <Field label="E-mail" type="email" name="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <fieldset>
        <legend className="rotulo text-carvao-muted">Periodicidade</legend>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm text-carvao">
          <label className="inline-flex min-h-[44px] items-center gap-2">
            <input type="radio" name="periodicidade" value="semanal" checked={periodicidade === "semanal"} onChange={() => setPeriodicidade("semanal")} />
            Semanal, às segundas-feiras
          </label>
          <label className="inline-flex min-h-[44px] items-center gap-2">
            <input type="radio" name="periodicidade" value="diaria" checked={periodicidade === "diaria"} onChange={() => setPeriodicidade("diaria")} />
            Diária, a cada nova publicação
          </label>
        </div>
      </fieldset>
      <label className="flex items-start gap-3 text-sm leading-relaxed text-carvao-muted">
        <input type="checkbox" className="mt-1" checked={consentimento} onChange={(e) => setConsentimento(e.target.checked)} required />
        <span>
          Autorizo o envio do resumo do crédito para este e-mail. Posso sair em um clique pelo link de todo e-mail.
          Tratamento dos dados na{" "}
          <Link href="/privacidade#priv-resumo" className="text-bronze underline underline-offset-4">
            política de privacidade
          </Link>
          .
        </span>
      </label>
      <Button type="submit" disabled={estado.tipo === "enviando" || !consentimento}>
        {estado.tipo === "enviando" ? "Enviando…" : "Assinar o resumo"}
      </Button>
    </form>
  );
}
