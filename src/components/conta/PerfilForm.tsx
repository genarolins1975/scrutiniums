"use client";

import { FormEvent, useState } from "react";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { formatCpf, isValidCpf, normalizeCpf } from "@/lib/cpf";
import { AREAS_ATUACAO, NIVEIS_CARGO, TIPOS_INSTITUICAO, UFS, corpoPerfil, ehPerfilProfissional, errosPerfil } from "@/lib/perfilOpcoes";
import { CampoPerfilUso } from "@/components/onboarding/CampoPerfilUso";

/**
 * Edição do perfil ESTRUTURADO (listas fechadas, sem texto livre)
 * → POST /api/conta/perfil. Contas sem CPF podem incluí-lo uma única vez;
 * para telefone estrangeiro verificado, o preenchimento é opcional.
 * Depois disso o campo some (alteração de CPF só pelo canal de privacidade).
 * Mesma regra do cadastro (errosPerfil): perfil de uso e UF obrigatórios;
 * instituição, área e cargo só aparecem e só são enviados nos perfis de uso
 * profissionais. Conta anterior ao perfil de uso escolhe um ao salvar.
 */
export function PerfilForm({
  perfilUsoInicial = "",
  orgTypeInicial,
  orgAreaInicial,
  orgRoleInicial,
  ufInicial,
  temCpf,
  cpfObrigatorio = true,
}: {
  perfilUsoInicial?: string;
  orgTypeInicial: string;
  orgAreaInicial: string;
  orgRoleInicial: string;
  ufInicial: string;
  temCpf: boolean;
  cpfObrigatorio?: boolean;
}) {
  const [perfilUso, setPerfilUso] = useState(perfilUsoInicial);
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
      ...errosPerfil({ perfilUso, orgType, orgArea, orgRole, uf }),
      cpf: temCpf || !cpf || isValidCpf(cpf) ? undefined : "CPF inválido. Confira os dígitos.",
    };
    if (!temCpf && cpfObrigatorio && !cpf) novos.cpf = "Informe seu CPF para completar o cadastro.";
    setErros(novos);
    if (Object.values(novos).some(Boolean)) return;

    setStatus("salvando");
    try {
      const corpo: Record<string, string> = corpoPerfil({ perfilUso, orgType, orgArea, orgRole, uf });
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
          label={cpfObrigatorio ? "CPF" : "CPF (opcional)"}
          name="cpf"
          inputMode="numeric"
          autoComplete="off"
          placeholder="000.000.000-00"
          maxLength={14}
          value={cpf}
          onChange={(e) => setCpf(formatCpf(e.target.value))}
          error={erros.cpf}
          hint={cpfObrigatorio
            ? "Sua conta é anterior à exigência de CPF. Usado apenas para garantir uma conta por pessoa; nunca é exibido nem compartilhado."
            : "Para seu telefone estrangeiro, o CPF é opcional. Você precisará dele antes de trocar para um telefone brasileiro."}
        />
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <CampoPerfilUso
            value={perfilUso}
            onChange={setPerfilUso}
            error={erros.perfilUso}
            grade="grid-cols-2 lg:grid-cols-4"
            hint={perfilUsoInicial ? undefined : "Novo no cadastro: escolha o que melhor descreve seu uso. Setor público, mercado financeiro, empresa e pesquisa acadêmica pedem também instituição, área e cargo."}
          />
        </div>
        {ehPerfilProfissional(perfilUso) && (
          <>
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
          </>
        )}
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
