"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { Alert } from "@/components/ui/Alert";
import { formatCpf, isValidCpf, normalizeCpf } from "@/lib/cpf";
import { AREAS_ATUACAO, NIVEIS_CARGO, TIPOS_INSTITUICAO, UFS } from "@/lib/perfilOpcoes";

/**
 * Etapa 3 do onboarding: senha de acesso, CPF e perfil ESTRUTURADO.
 * Sem campos de texto livre: instituição, área, cargo e UF são listas
 * fechadas (mesmas allowlists validadas no servidor). O CPF é formatado
 * durante a digitação e validado pelos dígitos verificadores.
 */
export function PerfilForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [cpf, setCpf] = useState("");
  const [orgType, setOrgType] = useState("");
  const [orgArea, setOrgArea] = useState("");
  const [orgRole, setOrgRole] = useState("");
  const [uf, setUf] = useState("");
  const [erros, setErros] = useState<Record<string, string | undefined>>({});
  const [serverError, setServerError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(undefined);
    const pOk = password.length >= 8 && password.length <= 72;
    const confirmOk = pOk && confirm === password;
    const cpfOk = isValidCpf(cpf);
    const novos: Record<string, string | undefined> = {
      password: pOk ? undefined : "A senha deve ter entre 8 e 72 caracteres.",
      confirm: !pOk || confirmOk ? undefined : "As senhas não coincidem.",
      cpf: cpfOk ? undefined : "CPF inválido. Confira os dígitos.",
      orgType: orgType ? undefined : "Selecione o tipo de instituição.",
      orgArea: orgArea ? undefined : "Selecione sua área de atuação.",
      orgRole: orgRole ? undefined : "Selecione seu nível de cargo.",
      uf: uf ? undefined : "Selecione sua UF.",
    };
    setErros(novos);
    if (Object.values(novos).some(Boolean)) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/onboarding/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, cpf: normalizeCpf(cpf), orgType, orgArea, orgRole, uf }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.next) {
        router.push(data.next);
        return;
      }
      setServerError(data?.error ?? "Não foi possível concluir agora. Tente novamente.");
    } catch {
      setServerError("Não foi possível concluir agora. Verifique sua conexão.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {serverError && <Alert kind="erro">{serverError}</Alert>}

      <div className="grid gap-6 sm:grid-cols-2">
        <Field
          label="Senha"
          name="new-password"
          type="password"
          autoComplete="new-password"
          maxLength={72}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={erros.password}
          hint="Mínimo de 8 caracteres"
        />
        <Field
          label="Confirmar senha"
          name="confirm-password"
          type="password"
          autoComplete="new-password"
          maxLength={72}
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={erros.confirm}
        />
      </div>

      <Field
        label="CPF"
        name="cpf"
        inputMode="numeric"
        autoComplete="off"
        placeholder="000.000.000-00"
        maxLength={14}
        required
        value={cpf}
        onChange={(e) => setCpf(formatCpf(e.target.value))}
        error={erros.cpf}
        hint="Usado apenas para garantir uma conta por pessoa. Nunca é exibido nem compartilhado."
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <SelectField
          label="Tipo de instituição"
          name="org-type"
          required
          opcoes={TIPOS_INSTITUICAO}
          value={orgType}
          onChange={(e) => setOrgType(e.target.value)}
          error={erros.orgType}
        />
        <SelectField
          label="Área de atuação"
          name="org-area"
          required
          opcoes={AREAS_ATUACAO}
          value={orgArea}
          onChange={(e) => setOrgArea(e.target.value)}
          error={erros.orgArea}
        />
        <SelectField
          label="Nível de cargo"
          name="org-role"
          required
          opcoes={NIVEIS_CARGO}
          value={orgRole}
          onChange={(e) => setOrgRole(e.target.value)}
          error={erros.orgRole}
        />
        <SelectField
          label="UF"
          name="uf"
          required
          opcoes={UFS}
          value={uf}
          onChange={(e) => setUf(e.target.value)}
          error={erros.uf}
        />
      </div>

      <Button type="submit" full disabled={submitting}>
        {submitting ? "Concluindo…" : "Concluir cadastro"}
      </Button>

      <p className="text-sm text-mineral">
        Seu cadastro é a única exigência para usar a plataforma. Os dados de perfil contextualizam o
        uso e nunca são exibidos publicamente.
      </p>
    </form>
  );
}
