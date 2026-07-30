"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";

/**
 * Etapa final do onboarding: código de acesso antecipado.
 * Em ACCESS_PENDING (waitlist=false) oferece também "Não tenho código",
 * que coloca o usuário na lista de espera e re-renderiza a página no
 * modo WAITLIST via router.refresh(). O valor digitado não é
 * transformado: apenas exibido em maiúsculas via CSS.
 */
export function AcessoForm({ waitlist }: { waitlist: boolean }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [joining, setJoining] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(undefined);
    const value = code.trim();
    const ok = value.length >= 1 && value.length <= 64;
    setCodeError(ok ? undefined : "Informe seu código de acesso.");
    if (!ok) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/onboarding/access/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.next) {
        router.push(data.next);
        return;
      }
      if (res.status === 429) {
        setServerError("Muitas tentativas. Aguarde e tente novamente.");
      } else {
        setServerError("Código inválido. Confira e tente novamente.");
      }
    } catch {
      setServerError("Não foi possível validar agora. Verifique sua conexão.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onNoCode() {
    setServerError(undefined);
    setJoining(true);
    try {
      const res = await fetch("/api/onboarding/access/waitlist", { method: "POST" });
      if (res.ok) {
        router.refresh();
        return;
      }
      setServerError("Não foi possível concluir agora. Tente novamente.");
    } catch {
      setServerError("Não foi possível concluir agora. Verifique sua conexão.");
    } finally {
      setJoining(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {serverError && <Alert kind="erro">{serverError}</Alert>}

      <Field
        label="Código de acesso"
        name="access-code"
        autoComplete="off"
        maxLength={64}
        required
        value={code}
        onChange={(e) => setCode(e.target.value)}
        error={codeError}
        className="uppercase"
      />

      <Button type="submit" full disabled={submitting || joining}>
        {submitting ? "Validando…" : "Validar código"}
      </Button>

      {!waitlist && (
        <Button type="button" variant="ghost" full disabled={submitting || joining} onClick={onNoCode}>
          {joining ? "Registrando…" : "Não tenho código"}
        </Button>
      )}
    </form>
  );
}
