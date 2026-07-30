"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { CountrySelect } from "./CountrySelect";
import { PhoneField } from "./PhoneField";

/**
 * Login alternativo sem senha: telefone → código SMS (rota /entrar/sms).
 * Cobre entrada e recuperação de quem esqueceu a senha.
 */
export function EntrarForm() {
  const router = useRouter();
  const [country, setCountry] = useState("BR");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(undefined);
    if (phone.replace(/\D/g, "").length < 8) {
      setPhoneError("Informe um telefone válido com DDD.");
      return;
    }
    setPhoneError(undefined);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/entrar/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country, phone }),
      });
      if (res.ok) {
        router.push("/entrar/sms/verificar");
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

      <CountrySelect value={country} onChange={(c) => { setCountry(c); setPhone(""); }} disabled={submitting} />
      <PhoneField
        country={country}
        value={phone}
        onChange={setPhone}
        error={phoneError}
        disabled={submitting}
      />

      <Button type="submit" full disabled={submitting}>
        {submitting ? "Enviando…" : "Receber código por SMS"}
      </Button>

      <div className="flex flex-col items-center gap-2 border-t border-linha pt-5 text-center">
        <Link
          href="/entrar"
          className="rotulo min-h-[44px] py-3 text-carvao-muted underline underline-offset-4 hover:text-bronze"
        >
          Entrar com e-mail e senha
        </Link>
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
