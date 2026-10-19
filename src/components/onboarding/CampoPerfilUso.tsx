"use client";

import { useId } from "react";
import { PERFIS_USO } from "@/lib/perfilOpcoes";

/**
 * Perfil de uso: lista fechada em botões de opção (um toque, todas as opções
 * à vista). Usado no cadastro e na conta, com o mesmo texto de ajuda que diz
 * quando instituição, área e cargo passam a ser pedidos.
 */
export function CampoPerfilUso({
  value,
  onChange,
  error,
  hint = "Setor público, mercado financeiro, empresa e pesquisa acadêmica pedem também instituição, área e cargo.",
  grade = "grid-cols-2",
}: {
  value: string;
  onChange: (valor: string) => void;
  error?: string;
  hint?: string;
  /** Colunas da grade de opções (a conta, mais larga, usa quatro no desktop). */
  grade?: string;
}) {
  const id = useId();
  const errorId = `${id}-erro`;
  const hintId = `${id}-dica`;
  const describedBy = [error ? errorId : null, hint && !error ? hintId : null].filter(Boolean).join(" ") || undefined;

  return (
    <fieldset aria-describedby={describedBy} className="flex min-w-0 flex-col gap-1.5">
      <legend className="rotulo mb-1.5 text-carvao-muted">Como você vai usar a Scrutiniums?</legend>
      <div className={`grid gap-2 ${grade}`}>
        {PERFIS_USO.map((p) => (
          <label
            key={p.value}
            className={`flex min-h-[44px] cursor-pointer items-center gap-2 border bg-papel px-2.5 py-2 text-[15px] leading-snug text-carvao hover:border-bronze has-[:checked]:border-bronze has-[:checked]:bg-marfim has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-bronze ${
              error ? "border-erro" : "border-linha"
            }`}
          >
            <input
              type="radio"
              name="perfil-uso"
              value={p.value}
              required
              checked={value === p.value}
              onChange={() => onChange(p.value)}
              className="h-4 w-4 shrink-0 accent-bronze"
            />
            <span>{p.label}</span>
          </label>
        ))}
      </div>
      {hint && !error && (
        <p id={hintId} className="text-sm text-mineral">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-sm text-erro">
          {error}
        </p>
      )}
    </fieldset>
  );
}
