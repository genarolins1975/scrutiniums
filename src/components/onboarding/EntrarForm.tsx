"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Login sem senha: e-mail → código de acesso. Cobre entrada e recuperação. */
export function EntrarForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(undefined);
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setEmailError("Informe um e-mail válido.");
      return;
    }
    setEmailError(undefined);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/entrar/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      if (res.ok) {
        router.push("/entrar/verificar");
        return;
      }
      setServerError(
        res.status === 429
          ? "Muitas tentativas. Aguarde um instante e tente novamente."
          : "Não foi possível continuar agora. Tente novamente.",
      );
    } catch {
      setServerError("Não foi possível continuar agora. Verifique sua conexão.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {serverError && <Alert kind="erro">{serverError}</Alert>}

      <Field
        label="E-mail"
        type="email"
        name="email"
        autoComplete="email"
        inputMode="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={emailError}
      />

      <Button type="submit" full disabled={submitting}>
        {submitting ? "Enviando…" : "Receber código de acesso"}
      </Button>

      <div className="flex flex-col items-center gap-2 border-t border-linha pt-5 text-center">
        <Link
          href="/cadastro"
          className="rotulo min-h-[44px] py-3 text-carvao-muted underline underline-offset-4 hover:text-bronze"
        >
          Ainda não tenho cadastro
        </Link>
      </div>
    </form>
  );
}
