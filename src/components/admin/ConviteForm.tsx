"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";

/**
 * Formulário de envio de convites para toda a lista de espera.
 * O código informado precisa estar ativo em ACCESS_CODES — a validação
 * real acontece no servidor (POST /api/admin/convites).
 */
export function ConviteForm() {
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | undefined>();
  const [success, setSuccess] = useState<{ enviados: number; falhas: number } | undefined>();
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(undefined);
    setSuccess(undefined);
    const value = code.trim();
    const ok = value.length >= 1 && value.length <= 64;
    setCodeError(ok ? undefined : "Informe o código de acesso do convite.");
    if (!ok) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/convites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setSuccess({ enviados: data.enviados ?? 0, falhas: data.falhas ?? 0 });
        return;
      }
      if (res.status === 429) {
        setServerError("Muitas tentativas. Aguarde e tente novamente.");
      } else if (typeof data.error === "string" && data.error) {
        setServerError(data.error);
      } else {
        setServerError("Não foi possível enviar os convites agora. Tente novamente.");
      }
    } catch {
      setServerError("Não foi possível enviar os convites agora. Verifique sua conexão.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-md flex-col gap-6">
      {success && (
        <Alert kind="sucesso">
          Convites enviados: {success.enviados}. Falhas: {success.falhas}.
        </Alert>
      )}
      {serverError && <Alert kind="erro">{serverError}</Alert>}

      <Field
        label="Código de acesso"
        name="invite-code"
        autoComplete="off"
        maxLength={64}
        required
        value={code}
        onChange={(e) => setCode(e.target.value)}
        error={codeError}
        hint="O código precisa constar em ACCESS_CODES para funcionar."
      />

      <Button type="submit" disabled={submitting}>
        {submitting ? "Enviando…" : "Enviar convite para toda a lista"}
      </Button>
    </form>
  );
}
