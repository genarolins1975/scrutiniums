"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

/**
 * Define ou troca a senha da conta → POST /api/conta/senha.
 * Conta com senha exige a senha atual; conta antiga sem senha define direto.
 * Em recuperação (código SMS de "esqueci minha senha"), a atual não é pedida.
 */
export function AlterarSenha({
  temSenha,
  recuperacao = false,
}: {
  temSenha: boolean;
  recuperacao?: boolean;
}) {
  const [definida, setDefinida] = useState(temSenha);
  const [recuperando, setRecuperando] = useState(recuperacao);
  const novaRef = useRef<HTMLInputElement>(null);
  const exigeAtual = definida && !recuperando;

  useEffect(() => {
    if (recuperacao) novaRef.current?.focus();
  }, [recuperacao]);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [erros, setErros] = useState<{ atual?: string; nova?: string }>({});
  const [status, setStatus] = useState<"idle" | "salvando" | "sucesso" | "erro">("idle");
  const [mensagemErro, setMensagemErro] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const novosErros: { atual?: string; nova?: string } = {};
    if (exigeAtual && currentPassword.length < 1) {
      novosErros.atual = "Informe sua senha atual.";
    }
    if (newPassword.length < 8 || newPassword.length > 72) {
      novosErros.nova = "A nova senha deve ter entre 8 e 72 caracteres.";
    }
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    setStatus("salvando");
    try {
      const res = await fetch("/api/conta/senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          exigeAtual ? { currentPassword, newPassword } : { newPassword },
        ),
      });
      if (res.ok) {
        setStatus("sucesso");
        setDefinida(true);
        setRecuperando(false);
        setCurrentPassword("");
        setNewPassword("");
        return;
      }
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setMensagemErro(data?.error ?? "Não foi possível alterar a senha. Tente novamente.");
      setStatus("erro");
    } catch {
      setMensagemErro("Não foi possível alterar a senha. Verifique sua conexão e tente novamente.");
      setStatus("erro");
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-md space-y-5">
      {!definida && (
        <p className="text-sm text-carvao-muted">
          Sua conta ainda não tem senha; defina uma para entrar com e-mail e senha.
        </p>
      )}

      {recuperando && (
        <Alert kind="info">
          Código confirmado. Defina sua nova senha; a senha atual não é pedida nos próximos 10
          minutos. Ao salvar, as sessões abertas em outros dispositivos são encerradas.
        </Alert>
      )}

      {exigeAtual && (
        <Field
          label="Senha atual"
          name="current-password"
          type="password"
          autoComplete="current-password"
          maxLength={72}
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          error={erros.atual}
        />
      )}

      <Field
        label="Nova senha"
        name="new-password"
        type="password"
        autoComplete="new-password"
        maxLength={72}
        required
        ref={novaRef}
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        error={erros.nova}
        hint="Mínimo de 8 caracteres"
      />

      {status === "sucesso" && <Alert kind="sucesso">Senha atualizada. Use-a no próximo acesso.</Alert>}
      {status === "erro" && <Alert kind="erro">{mensagemErro}</Alert>}

      <Button type="submit" disabled={status === "salvando"}>
        {status === "salvando" ? "Salvando…" : exigeAtual ? "Alterar senha" : "Definir senha"}
      </Button>
    </form>
  );
}
