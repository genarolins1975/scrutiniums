"use client";

import { SelectHTMLAttributes, forwardRef, useId } from "react";
import type { Opcao } from "@/lib/perfilOpcoes";

/**
 * Campo de seleção com o mesmo contrato visual e de acessibilidade do
 * Field (label real, erro via aria-describedby, dica opcional). Base dos
 * formulários estruturados (perfil sem texto livre).
 */
export const SelectField = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & {
    label: string;
    opcoes: Opcao[];
    placeholder?: string;
    error?: string;
    hint?: string;
  }
>(function SelectField({ label, opcoes, placeholder = "Selecione…", error, hint, id, className = "", ...props }, ref) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const errorId = `${fieldId}-erro`;
  const hintId = `${fieldId}-dica`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="rotulo text-carvao-muted">
        {label}
      </label>
      <select
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`min-h-[44px] border bg-papel px-3 py-2 text-base text-carvao focus:border-bronze ${
          error ? "border-erro" : "border-linha"
        } ${className}`}
        {...props}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {opcoes.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
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
    </div>
  );
});
