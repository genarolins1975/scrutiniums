"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { CountrySelect } from "./CountrySelect";
import { PhoneField } from "./PhoneField";
import { OtpInput } from "./OtpInput";
import { ResendCountdown } from "./ResendCountdown";

type Phase = "solicitar" | "verificar";

/**
 * Etapa 2 do onboarding: confirmação de posse do telefone por SMS.
 * Duas telas: solicitar código → digitar código. Uma etapa por vez.
 * O SMS comprova controle do número — nunca "identidade verificada".
 */
export function TelefoneForm() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("solicitar");
  const [country, setCountry] = useState("BR");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [masked, setMasked] = useState("");
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [codeError, setCodeError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | undefined>();
  const [info, setInfo] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const verifyHeadingRef = useRef<HTMLParagraphElement>(null);
  const otpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (phase === "verificar") {
      verifyHeadingRef.current?.focus();
    }
  }, [phase]);

  async function requestCode(): Promise<boolean> {
    setServerError(undefined);
    setInfo(undefined);
    if (phone.replace(/\D/g, "").length < 8) {
      setPhoneError("Informe um telefone válido com DDD.");
      return false;
    }
    setPhoneError(undefined);
    try {
      const res = await fetch("/api/onboarding/phone/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country, phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.masked) {
        setMasked(data.masked);
        return true;
      }
      if (res.status === 401) {
        // Identificação de onboarding ausente ou expirada: recomeça na etapa 1.
        router.push("/cadastro");
        return false;
      }
      if (res.status === 429) {
        setServerError("Muitas tentativas. Aguarde um instante e tente novamente.");
      } else {
        setServerError(typeof data.error === "string" ? data.error : "Não foi possível usar este telefone.");
      }
      return false;
    } catch {
      setServerError("Não foi possível enviar o código agora. Tente novamente.");
      return false;
    }
  }

  async function onRequestSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const ok = await requestCode();
    setSubmitting(false);
    if (ok) {
      setCode("");
      setCodeError(undefined);
      setPhase("verificar");
    }
  }

  async function onVerifySubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(undefined);
    setInfo(undefined);
    if (code.length !== 6) {
      setCodeError("Informe o código de 6 dígitos.");
      return;
    }
    setCodeError(undefined);
    setSubmitting(true);
    try {
      const res = await fetch("/api/onboarding/phone/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country, phone, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.next) {
        router.push(data.next);
        return;
      }
      if (res.status === 401) {
        router.push("/cadastro");
        return;
      }
      setCodeError(
        res.status === 429
          ? "Muitas tentativas. Aguarde um instante e tente novamente."
          : "Código inválido ou expirado.",
      );
      otpRef.current?.focus();
    } catch {
      setCodeError("Não foi possível verificar agora. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  async function resend() {
    const ok = await requestCode();
    if (ok) setInfo("Enviamos um novo código por SMS.");
  }

  if (phase === "solicitar") {
    return (
      <form onSubmit={onRequestSubmit} noValidate className="flex flex-col gap-6">
        {serverError && <Alert kind="erro">{serverError}</Alert>}

        <CountrySelect value={country} onChange={(c) => { setCountry(c); setPhone(""); }} disabled={submitting} />
        <PhoneField
          country={country}
          value={phone}
          onChange={setPhone}
          error={phoneError}
          disabled={submitting}
        />

        <Button type="submit" full disabled={submitting}>
          {submitting ? "Enviando…" : "Enviar código"}
        </Button>

        <p className="text-sm text-mineral">Usado para validar e proteger seu acesso.</p>
      </form>
    );
  }

  return (
    <form onSubmit={onVerifySubmit} noValidate className="flex flex-col gap-6">
      <p ref={verifyHeadingRef} tabIndex={-1} className="text-sm text-carvao-muted outline-none">
        Código enviado para <span className="font-medium text-carvao">{masked}</span>.
      </p>

      {serverError && <Alert kind="erro">{serverError}</Alert>}
      {info && <Alert kind="sucesso">{info}</Alert>}

      <OtpInput
        ref={otpRef}
        label="Código recebido por SMS"
        value={code}
        onChange={setCode}
        error={codeError}
        disabled={submitting}
      />

      <Button type="submit" full disabled={submitting}>
        {submitting ? "Verificando…" : "Confirmar código"}
      </Button>

      <div className="flex items-center justify-between gap-4">
        <ResendCountdown onResend={resend} />
        <button
          type="button"
          onClick={() => {
            setPhase("solicitar");
            setCode("");
            setCodeError(undefined);
            setServerError(undefined);
            setInfo(undefined);
          }}
          className="rotulo min-h-[44px] py-3 text-carvao-muted underline underline-offset-4 hover:text-bronze"
        >
          Alterar número
        </button>
      </div>

      <p className="text-sm text-mineral">Usado para validar e proteger seu acesso.</p>
    </form>
  );
}
