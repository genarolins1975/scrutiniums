"use client";

import { FormEvent, useState } from "react";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { formatCpf, isValidCpf, normalizeCpf } from "@/lib/cpf";
import { AREAS_ATUACAO, NIVEIS_CARGO, TIPOS_INSTITUICAO, UFS } from "@/lib/perfilOpcoes";

/**
 * Edição do perfil ESTRUTURADO (listas fechadas, sem texto livre)
 * → POST /api/conta/perfil. Contas anteriores à estruturação podem
 * completar o CPF uma única vez; depois disso o campo some (alteração
 * de CPF só pelo canal de privacidade).
 */
export function PerfilForm({
  orgTypeInicial,
  orgAreaInicial,
  orgRoleInicial,
  ufInicial,
  temCpf,
}: {
  orgTypeInicial: string;
  orgAreaInicial: string;
  orgRoleInicial: string;
  ufInicial: string;
  temCpf: boolean;
}) {
  const [orgType, setOrgType] = useState(orgTypeInicial);
  const [orgArea, setOrgArea] = useState(orgAreaInicial);
  const [orgRole, setOrgRole] = useState(orgRoleInicial);
  const [uf, setUf] = useState(ufInicial);
  const [cpf, setCpf] = useState("");
  const [erros, setErros] = useState<Record<string, string | undefined>>({});
  const [status, setStatus] = useState<"idle" | "salvando" | "sucesso" | "erro">("idle");
  const [mensagemErro, setMensagemErro] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const novos: Record<string, string | undefined> = {
      orgType: orgType ? undefined : "Selecione o tipo de instituição.",
      orgArea: orgArea ? undefined : "Selecione sua área de atuação.",
      orgRole: orgRole ? undefined : "Selecione seu nível de cargo.",
      uf: uf ? undefined : "Selecione sua UF.",
      cpf: temCpf || !cpf || isValidCpf(cpf) ? undefined : "CPF inválido. Confira os dígitos.",
    };
    if (!temCpf && !cpf) novos.cpf = "Informe seu CPF para completar o cadastro.";
    setErros(novos);
    if (Object.values(novos).some(Boolean)) return;

    setStatus("salvando");
    try {
      const corpo: Record<string, string> = { orgType, orgArea, orgRole, uf };
      if (!temCpf && cpf) corpo.cpf = normalizeCpf(cpf);
      const res = await fetch("/api/conta/perfil", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
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
      {!temCpf && (
        <Field
          label="CPF"
          name="cpf"
          inputMode="numeric"
          autoComplete="off"
          placeholder="000.000.000-00"
          maxLength={14}
          value={cpf}
          onChange={(e) => setCpf(formatCpf(e.target.value))}
          error={erros.cpf}
          hint="Sua conta é anterior à exigência de CPF. Usado apenas para garantir uma conta por pessoa; nunca é exibido nem compartilhado."
        />
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          label="Tipo de instituição"
          name="org-type"
          opcoes={TIPOS_INSTITUICAO}
          value={orgType}
          onChange={(e) => setOrgType(e.target.value)}
          error={erros.orgType}
        />
        <SelectField
          label="Área de atuação"
          name="org-area"
          opcoes={AREAS_ATUACAO}
          value={orgArea}
          onChange={(e) => setOrgArea(e.target.value)}
          error={erros.orgArea}
        />
        <SelectField
          label="Nível de cargo"
          name="org-role"
          opcoes={NIVEIS_CARGO}
          value={orgRole}
          onChange={(e) => setOrgRole(e.target.value)}
          error={erros.orgRole}
        />
        <SelectField
          label="UF"
          name="uf"
          opcoes={UFS}
          value={uf}
          onChange={(e) => setUf(e.target.value)}
          error={erros.uf}
        />
      </div>

      {status === "sucesso" && <Alert kind="sucesso">Perfil atualizado.</Alert>}
      {status === "erro" && <Alert kind="erro">{mensagemErro}</Alert>}

      <Button type="submit" disabled={status === "salvando"}>
        {status === "salvando" ? "Salvando…" : "Salvar perfil"}
      </Button>
    </form>
  );
}
