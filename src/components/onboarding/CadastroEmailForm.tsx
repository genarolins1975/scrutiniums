"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Etapa 1 do onboarding: e-mail + aceite de termos (obrigatório) e opt-in de novidades (opcional). */
export function CadastroEmailForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [emailError, setEmailError] = useState<string | undefined>();
  const [termsError, setTermsError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(undefined);
    const trimmed = email.trim();
    const emailOk = EMAIL_RE.test(trimmed);
    setEmailError(emailOk ? undefined : "Informe um e-mail válido.");
    setTermsError(terms ? undefined : "É preciso aceitar os termos para continuar.");
    if (!emailOk || !terms) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/onboarding/email/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, termsAccepted: true, marketingOptIn: marketing }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        router.push(typeof data.next === "string" ? data.next : "/cadastro/telefone");
        return;
      }
      if (res.status === 429) {
        setServerError("Muitas tentativas. Aguarde um instante e tente novamente.");
      } else {
        setServerError("Não foi possível continuar agora. Tente novamente.");
      }
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

      <div className="flex flex-col gap-3">
        <label className="flex min-h-[44px] cursor-pointer items-start gap-3 py-1 text-sm text-carvao-muted">
          <input
            type="checkbox"
            checked={terms}
            onChange={(e) => setTerms(e.target.checked)}
            aria-invalid={termsError ? true : undefined}
            aria-describedby={termsError ? "termos-erro" : undefined}
            className="mt-0.5 h-5 w-5 shrink-0 accent-carvao"
          />
          <span>
            Li e aceito os{" "}
            <Link href="/termos" className="underline underline-offset-2 hover:text-bronze">
              Termos de uso
            </Link>{" "}
            e a{" "}
            <Link href="/privacidade" className="underline underline-offset-2 hover:text-bronze">
              Política de privacidade
            </Link>
            . Seu e-mail é usado para contato e comunicações essenciais.
          </span>
        </label>
        {termsError && (
          <p id="termos-erro" role="alert" className="text-sm text-erro">
            {termsError}
          </p>
        )}

        <label className="flex min-h-[44px] cursor-pointer items-start gap-3 py-1 text-sm text-carvao-muted">
          <input
            type="checkbox"
            checked={marketing}
            onChange={(e) => setMarketing(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-carvao"
          />
          <span>Quero receber novidades da plataforma por e-mail (opcional).</span>
        </label>
      </div>

      <Button type="submit" full disabled={submitting}>
        {submitting ? "Enviando…" : "Continuar"}
      </Button>

      <div className="flex flex-col items-center gap-4 border-t border-linha pt-5 text-center">
        <Link href="/entrar" className="rotulo min-h-[44px] py-3 text-carvao-muted underline underline-offset-4 hover:text-bronze">
          Já tenho cadastro
        </Link>
        <p className="rotulo text-bronze">100% gratuito · sem assinatura · sem cobrança</p>
      </div>
    </form>
  );
}
