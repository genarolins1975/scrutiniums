"use client";

import { FormEvent, useState } from "react";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

/** Formulário de edição de empresa e cargo → POST /api/conta/perfil. */
export function PerfilForm({
  companyInicial,
  jobTitleInicial,
}: {
  companyInicial: string;
  jobTitleInicial: string;
}) {
  const [company, setCompany] = useState(companyInicial);
  const [jobTitle, setJobTitle] = useState(jobTitleInicial);
  const [erros, setErros] = useState<{ company?: string; jobTitle?: string }>({});
  const [status, setStatus] = useState<"idle" | "salvando" | "sucesso" | "erro">("idle");
  const [mensagemErro, setMensagemErro] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const novosErros: { company?: string; jobTitle?: string } = {};
    if (company.trim().length < 2) novosErros.company = "Informe a empresa (mínimo 2 caracteres).";
    if (jobTitle.trim().length < 2) novosErros.jobTitle = "Informe o cargo (mínimo 2 caracteres).";
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    setStatus("salvando");
    try {
      const res = await fetch("/api/conta/perfil", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: company.trim(), jobTitle: jobTitle.trim() }),
      });
      if (res.ok) {
        setStatus("sucesso");
        return;
      }
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setMensagemErro(data?.error ?? "Não foi possível salvar. Tente novamente.");
      setStatus("erro");
    } catch {
      setMensagemErro("Não foi possível salvar. Verifique sua conexão e tente novamente.");
      setStatus("erro");
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <Field
        label="Empresa"
        name="company"
        autoComplete="organization"
        maxLength={120}
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        error={erros.company}
      />
      <Field
        label="Cargo"
        name="jobTitle"
        autoComplete="organization-title"
        maxLength={120}
        value={jobTitle}
        onChange={(e) => setJobTitle(e.target.value)}
        error={erros.jobTitle}
      />
      {status === "sucesso" && <Alert kind="sucesso">Perfil atualizado.</Alert>}
      {status === "erro" && <Alert kind="erro">{mensagemErro}</Alert>}
      <Button type="submit" disabled={status === "salvando"}>
        {status === "salvando" ? "Salvando…" : "Salvar perfil"}
      </Button>
    </form>
  );
}
