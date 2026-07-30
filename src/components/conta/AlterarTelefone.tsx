"use client";

import { FormEvent, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { COUNTRIES } from "@/lib/phone";

type Etapa = "telefone" | "codigo" | "concluido";

/**
 * Fluxo de troca de telefone com re-verificação obrigatória por SMS:
 * país + número → /api/conta/telefone/start → código de 6 dígitos →
 * /api/conta/telefone/check.
 */
export function AlterarTelefone() {
  const router = useRouter();
  const paisId = useId();

  const [etapa, setEtapa] = useState<Etapa>("telefone");
  const [country, setCountry] = useState<string>("BR");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [erroTelefone, setErroTelefone] = useState<string | undefined>();
  const [erroCodigo, setErroCodigo] = useState<string | undefined>();
  const [alerta, setAlerta] = useState("");
  const [enviando, setEnviando] = useState(false);

  const ddi = COUNTRIES.find((c) => c.code === country)?.ddi ?? "";

  async function enviarCodigo(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAlerta("");
    if (phone.trim().length < 6) {
      setErroTelefone("Informe o número de telefone com DDD.");
      return;
    }
    setErroTelefone(undefined);
    setEnviando(true);
    try {
      const res = await fetch("/api/conta/telefone/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country, phone: phone.trim() }),
      });
      if (res.ok) {
        setCode("");
        setErroCodigo(undefined);
        setEtapa("codigo");
        return;
      }
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (res.status === 429) {
        setAlerta(data?.error ?? "Muitas tentativas. Aguarde antes de tentar novamente.");
      } else {
        setErroTelefone(data?.error ?? "Não foi possível enviar o código. Tente novamente.");
      }
    } catch {
      setAlerta("Não foi possível enviar o código. Verifique sua conexão e tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  async function confirmarCodigo(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAlerta("");
    if (!/^\d{6}$/.test(code.trim())) {
      setErroCodigo("Informe o código de 6 dígitos recebido por SMS.");
      return;
    }
    setErroCodigo(undefined);
    setEnviando(true);
    try {
      const res = await fetch("/api/conta/telefone/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country, phone: phone.trim(), code: code.trim() }),
      });
      if (res.ok) {
        setEtapa("concluido");
        router.refresh();
        return;
      }
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (res.status === 429) {
        setAlerta(data?.error ?? "Muitas tentativas. Aguarde antes de tentar novamente.");
      } else {
        setErroCodigo(data?.error ?? "Código inválido ou expirado. Tente novamente.");
      }
    } catch {
      setAlerta("Não foi possível confirmar o código. Verifique sua conexão e tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  if (etapa === "concluido") {
    return (
      <div className="space-y-5">
        <Alert kind="sucesso">Telefone atualizado e confirmado com sucesso.</Alert>
        <Button
          variant="secondary"
          onClick={() => {
            setPhone("");
            setCode("");
            setEtapa("telefone");
          }}
        >
          Alterar novamente
        </Button>
      </div>
    );
  }

  if (etapa === "codigo") {
    return (
      <form onSubmit={confirmarCodigo} noValidate className="space-y-5">
        <p className="text-sm text-carvao-muted">
          Enviamos um código de 6 dígitos por SMS para o número informado ({ddi} …). Digite o
          código para confirmar a troca.
        </p>
        <Field
          label="Código de verificação"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          error={erroCodigo}
          hint="Código de 6 dígitos recebido por SMS."
        />
        {alerta && <Alert kind="aviso">{alerta}</Alert>}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={enviando}>
            {enviando ? "Confirmando…" : "Confirmar código"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={enviando}
            onClick={() => {
              setAlerta("");
              setEtapa("telefone");
            }}
          >
            Usar outro número
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={enviarCodigo} noValidate className="space-y-5">
      <p className="text-sm text-carvao-muted">
        Por segurança, o novo número precisa ser confirmado por SMS.
      </p>
      <div className="grid gap-5 sm:grid-cols-[minmax(10rem,1fr)_2fr]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={paisId} className="rotulo text-carvao-muted">
            País
          </label>
          <select
            id={paisId}
            name="country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="min-h-[44px] border border-linha bg-papel px-3 py-2 text-base text-carvao focus:border-bronze"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} ({c.ddi})
              </option>
            ))}
          </select>
        </div>
        <Field
          label="Novo telefone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="(11) 91234-5678"
          maxLength={20}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={erroTelefone}
        />
      </div>
      {alerta && <Alert kind="aviso">{alerta}</Alert>}
      <Button type="submit" disabled={enviando}>
        {enviando ? "Enviando…" : "Enviar código por SMS"}
      </Button>
    </form>
  );
}
