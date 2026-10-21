"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { OtpInput } from "./OtpInput";
import { ResendCountdown } from "./ResendCountdown";
import type { Idioma } from "@/lib/idioma";
import { hrefNoIdioma } from "@/lib/i18n-href";
import { TEXTOS_ENTRAR } from "@/i18n/paginas/entrar";

/**
 * Verificação do código SMS de acesso (login alternativo, /entrar/sms).
 * Com `recuperar`, a API abre a troca de senha sem a atual e devolve
 * /app/conta#senha como destino.
 */
export function EntrarVerificarForm({
  maskedPhone,
  idioma = "pt",
  recuperar = false,
}: {
  maskedPhone: string;
  idioma?: Idioma;
  recuperar?: boolean;
}) {
  const t = TEXTOS_ENTRAR[idioma];
  const inicio = hrefNoIdioma(recuperar ? "/entrar/sms?recuperar=1" : "/entrar/sms", idioma);
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
      setError(t.erroCodigoTamanho);
      return;
    }
    setError(undefined);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/entrar/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(recuperar ? { code, recuperar: true } : { code }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.next) {
        router.push(data.next);
        return;
      }
      if (res.status === 401) {
        router.push(inicio);
        return;
      }
      setError(
        res.status === 429
          ? t.erroMuitasTentativas
          : t.erroCodigo,
      );
      otpRef.current?.focus();
    } catch {
      setError(t.erroVerificar);
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
        setInfo(t.reenviado);
      } else if (res.status === 429) {
        setError(t.erroMuitasTentativas);
      } else {
        setError(t.erroReenviar);
      }
    } catch {
      setError(t.erroReenviar);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <p className="text-sm text-carvao-muted">
        {t.destinoAntes} <span className="font-medium text-carvao">{maskedPhone}</span>{t.destinoDepois}
      </p>

      {info && <Alert kind="sucesso">{info}</Alert>}

      <OtpInput
        ref={otpRef}
        label={t.codigo}
        value={code}
        onChange={setCode}
        error={error}
        disabled={submitting}
      />

      <Button type="submit" full disabled={submitting}>
        {submitting ? t.verificando : recuperar ? t.continuarNovaSenha : t.entrar}
      </Button>

      <div className="flex items-center justify-between gap-4">
        <ResendCountdown onResend={resend} idioma={idioma} />
        <Link
          href={inicio}
          className="rotulo min-h-[44px] py-3 text-carvao-muted underline underline-offset-4 hover:text-bronze"
        >
          {t.alterarTelefone}
        </Link>
      </div>
    </form>
  );
}
