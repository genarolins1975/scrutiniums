"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { OtpInput } from "./OtpInput";
import { ResendCountdown } from "./ResendCountdown";

/** Verificação do código de acesso (login sem senha). */
export function EntrarVerificarForm({ maskedEmail }: { maskedEmail: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [info, setInfo] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const otpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    otpRef.current?.focus();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setInfo(undefined);
    if (code.length !== 6) {
      setError("Informe o código de 6 dígitos.");
      return;
    }
    setError(undefined);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/entrar/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.next) {
        router.push(data.next);
        return;
      }
      setError(
        res.status === 429
          ? "Muitas tentativas. Aguarde um instante e tente novamente."
          : "Código inválido ou expirado.",
      );
      otpRef.current?.focus();
    } catch {
      setError("Não foi possível verificar agora. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  async function resend() {
    setError(undefined);
    setInfo(undefined);
    try {
      const res = await fetch("/api/auth/entrar/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resend: true }),
      });
      if (res.ok) {
        setInfo("Se o e-mail for válido, enviamos um novo código.");
      } else if (res.status === 429) {
        setError("Muitas tentativas. Aguarde um instante e tente novamente.");
      } else {
        setError("Não foi possível reenviar agora. Tente novamente.");
      }
    } catch {
      setError("Não foi possível reenviar agora. Tente novamente.");
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <p className="text-sm text-carvao-muted">
        Se houver cadastro para <span className="font-medium text-carvao">{maskedEmail}</span>,
        você receberá um código de 6 dígitos.
      </p>

      {info && <Alert kind="sucesso">{info}</Alert>}

      <OtpInput ref={otpRef} value={code} onChange={setCode} error={error} disabled={submitting} />

      <Button type="submit" full disabled={submitting}>
        {submitting ? "Verificando…" : "Entrar"}
      </Button>

      <div className="flex items-center justify-between gap-4">
        <ResendCountdown onResend={resend} />
        <Link
          href="/entrar"
          className="rotulo min-h-[44px] py-3 text-carvao-muted underline underline-offset-4 hover:text-bronze"
        >
          Alterar e-mail
        </Link>
      </div>
    </form>
  );
}
