"use client";

import Link from "next/link";
import { COUNTRIES, type PaisTelefone } from "@/lib/phone";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { CountrySelect } from "./CountrySelect";
import { PhoneField } from "./PhoneField";
import { digitosMinimosTelefone } from "@/lib/telefone-minimo";
import type { Idioma } from "@/lib/idioma";
import { hrefNoIdioma } from "@/lib/i18n-href";
import { TEXTOS_ENTRAR } from "@/i18n/paginas/entrar";

/**
 * Login alternativo sem senha: telefone → código SMS (rota /entrar/sms).
 * Com `recuperar`, o código leva à definição de nova senha (esqueci minha senha).
 */
export function EntrarForm({
  paises = COUNTRIES,
  idioma = "pt",
  recuperar = false,
}: {
  paises?: readonly PaisTelefone[];
  idioma?: Idioma;
  recuperar?: boolean;
}) {
  const t = TEXTOS_ENTRAR[idioma];
  const router = useRouter();
  const [country, setCountry] = useState(paises[0]?.code ?? "");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(undefined);
    if (phone.replace(/\D/g, "").length < digitosMinimosTelefone(country)) {
      setPhoneError(t.erroTelefone);
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
        router.push(hrefNoIdioma(recuperar ? "/entrar/sms/verificar?recuperar=1" : "/entrar/sms/verificar", idioma));
        return;
      }
      setServerError(
        res.status === 429
          ? t.erroMuitasTentativas
          : t.erroContinuar,
      );
    } catch {
      setServerError(t.erroContinuarConexao);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {serverError && <Alert kind="erro">{serverError}</Alert>}

      <CountrySelect paises={paises} value={country} onChange={(c) => { setCountry(c); setPhone(""); }} disabled={submitting} idioma={idioma} />
      <PhoneField
        country={country}
        value={phone}
        onChange={setPhone}
        error={phoneError}
        disabled={submitting}
        idioma={idioma}
      />

      <Button type="submit" full disabled={submitting}>
        {submitting ? t.enviando : t.receberCodigo}
      </Button>

      <div className="flex flex-col items-center gap-2 border-t border-linha pt-5 text-center">
        <Link
          href={hrefNoIdioma("/entrar", idioma)}
          className="rotulo min-h-[44px] py-3 text-carvao-muted underline underline-offset-4 hover:text-bronze"
        >
          {t.entrarComSenha}
        </Link>
        <Link
          href={hrefNoIdioma("/cadastro", idioma)}
          className="rotulo min-h-[44px] py-3 text-carvao-muted underline underline-offset-4 hover:text-bronze"
        >
          {t.semCadastro}
        </Link>
      </div>
    </form>
  );
}
