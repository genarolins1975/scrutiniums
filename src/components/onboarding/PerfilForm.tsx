"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";

/** Etapa 3 do onboarding: empresa e cargo, texto livre. */
export function PerfilForm() {
  const router = useRouter();
  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [companyError, setCompanyError] = useState<string | undefined>();
  const [jobError, setJobError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(undefined);
    const c = company.trim();
    const j = jobTitle.trim();
    const cOk = c.length >= 1 && c.length <= 120;
    const jOk = j.length >= 1 && j.length <= 120;
    setCompanyError(cOk ? undefined : "Informe sua empresa (até 120 caracteres).");
    setJobError(jOk ? undefined : "Informe seu cargo (até 120 caracteres).");
    if (!cOk || !jOk) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/onboarding/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: c, jobTitle: j }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.next) {
        router.push(data.next);
        return;
      }
      setServerError("Não foi possível concluir agora. Tente novamente.");
    } catch {
      setServerError("Não foi possível concluir agora. Verifique sua conexão.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {serverError && <Alert kind="erro">{serverError}</Alert>}

      <Field
        label="Empresa"
        name="organization"
        autoComplete="organization"
        maxLength={120}
        required
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        error={companyError}
        hint="Se atua por conta própria, informe Autônomo/independente"
      />

      <Field
        label="Cargo"
        name="organization-title"
        autoComplete="organization-title"
        maxLength={120}
        required
        value={jobTitle}
        onChange={(e) => setJobTitle(e.target.value)}
        error={jobError}
      />

      <Button type="submit" full disabled={submitting}>
        {submitting ? "Concluindo…" : "Acessar a plataforma"}
      </Button>

      <p className="text-sm text-mineral">
        Seu cadastro é a única exigência para usar a plataforma.
      </p>
    </form>
  );
}
