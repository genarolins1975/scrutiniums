"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { CampoSenha } from "@/components/ui/CampoSenha";
import { SelectField } from "@/components/ui/SelectField";
import { Alert } from "@/components/ui/Alert";
import { formatCpf, normalizeCpf } from "@/lib/cpf";
import {
  AREAS_ATUACAO,
  NIVEIS_CARGO,
  TIPOS_INSTITUICAO,
  UFS,
  corpoPerfil,
  ehPerfilProfissional,
} from "@/lib/perfilOpcoes";
import { ACESSO } from "@/lib/acesso";
import { CampoPerfilUso } from "./CampoPerfilUso";
import { errosPerfilForm } from "./regrasPerfil";

/**
 * Etapa 3 do onboarding: senha de acesso (digitada uma vez, com "Mostrar"),
 * CPF e perfil ESTRUTURADO. Sem campos de texto livre: perfil de uso,
 * instituição, área, cargo e UF são listas fechadas (as mesmas validadas no
 * servidor, com a mesma regra: errosPerfil em perfilOpcoes.ts). Tipo de
 * instituição, área e cargo só aparecem, e só são enviados, nos perfis de
 * uso profissionais.
 */
export function PerfilForm({ exigeCpf = true }: { exigeCpf?: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [cpf, setCpf] = useState("");
  const [perfilUso, setPerfilUso] = useState("");
  const [orgType, setOrgType] = useState("");
  const [orgArea, setOrgArea] = useState("");
  const [orgRole, setOrgRole] = useState("");
  const [uf, setUf] = useState("");
  const [erros, setErros] = useState<Record<string, string | undefined>>({});
  const [serverError, setServerError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const profissional = ehPerfilProfissional(perfilUso);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(undefined);
    const novos = errosPerfilForm({ password, cpf, exigeCpf, perfilUso, orgType, orgArea, orgRole, uf });
    setErros(novos);
    if (Object.values(novos).some(Boolean)) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/onboarding/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          ...(exigeCpf ? { cpf: normalizeCpf(cpf) } : {}),
          ...corpoPerfil({ perfilUso, orgType, orgArea, orgRole, uf }),
        }),
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

      <CampoSenha
        label="Senha"
        name="new-password"
        autoComplete="new-password"
        maxLength={72}
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={erros.password}
        hint="Mínimo de 8 caracteres. Use “Mostrar” para conferir o que digitou."
      />

      {exigeCpf ? <Field
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
      /> : <p className="text-sm text-mineral">Seu telefone confirmado é de fora do Brasil. O cadastro não exige CPF.</p>}

      <SelectField
        label="UF onde você mora"
        name="uf"
        required
        opcoes={UFS}
        value={uf}
        onChange={(e) => setUf(e.target.value)}
        error={erros.uf}
      />

      <CampoPerfilUso value={perfilUso} onChange={setPerfilUso} error={erros.perfilUso} />

      {profissional && (
        <fieldset className="flex min-w-0 flex-col gap-6 border-t border-linha pt-6">
          <legend className="float-left mb-1 w-full font-serif text-xl text-carvao">Sobre o seu trabalho</legend>
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
        </fieldset>
      )}

      <Button type="submit" full disabled={submitting}>
        {submitting ? "Concluindo…" : "Concluir cadastro"}
      </Button>

      <p className="text-sm text-mineral">
        {ACESSO.leitura} Os dados de perfil contextualizam o uso e nunca são exibidos publicamente.
      </p>
    </form>
  );
}
