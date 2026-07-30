"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";

/**
 * Login principal: e-mail + senha → POST /api/auth/login.
 * `de` (destino pós-login, já validado no servidor da página) é repassado
 * no corpo; a API revalida e só o aplica com onboarding completo.
 */
export function EntrarSenhaForm({ de }: { de?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(undefined);
    const em = email.trim().toLowerCase();
    const emOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em);
    const pOk = password.length >= 1;
    setEmailError(emOk ? undefined : "Informe um e-mail válido.");
    setPasswordError(pOk ? undefined : "Informe sua senha.");
    if (!emOk || !pOk) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em, password, ...(de ? { de } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.next) {
        router.push(data.next);
        return;
      }
      if (res.status === 429) {
        setServerError("Muitas tentativas. Aguarde um instante e tente novamente.");
      } else if (res.status === 401 || res.status === 400) {
        setServerError("E-mail ou senha inválidos.");
      } else {
        setServerError("Não foi possível entrar agora. Tente novamente.");
      }
    } catch {
      setServerError("Não foi possível entrar agora. Verifique sua conexão.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {serverError && <Alert kind="erro">{serverError}</Alert>}

      <Field
        label="E-mail"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        maxLength={254}
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={emailError}
      />

      <Field
        label="Senha"
        name="current-password"
        type="password"
        autoComplete="current-password"
        maxLength={72}
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={passwordError}
      />

      <Button type="submit" full disabled={submitting}>
        {submitting ? "Entrando…" : "Entrar"}
      </Button>

      <div className="flex flex-col items-center gap-2 border-t border-linha pt-5 text-center">
        <p className="text-sm text-carvao-muted">
          Prefere ou precisa entrar sem senha?{" "}
          <Link
            href="/entrar/sms"
            className="text-bronze underline underline-offset-4 hover:text-bronze-dark"
          >
            Entrar com código por SMS
          </Link>
        </p>
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
