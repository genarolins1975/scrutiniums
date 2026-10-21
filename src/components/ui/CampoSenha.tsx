"use client";

import { InputHTMLAttributes, useId, useState } from "react";

/**
 * Campo de senha digitada uma vez, com botão "Mostrar" acessível: o botão
 * diz o que faz ("Mostrar senha" / "Ocultar senha"), aponta para o campo
 * (aria-controls) e uma região de status anuncia o novo estado. Mesmo
 * contrato visual do Field (label real, erro e dica via aria-describedby).
 */
export function CampoSenha({
  label,
  error,
  hint,
  id,
  className = "",
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string; error?: string; hint?: string }) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const errorId = `${fieldId}-erro`;
  const hintId = `${fieldId}-dica`;
  const describedBy = [error ? errorId : null, hint && !error ? hintId : null].filter(Boolean).join(" ") || undefined;
  const [visivel, setVisivel] = useState(false);
  const [alternou, setAlternou] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="rotulo text-carvao-muted">
        {label}
      </label>
      <div className="flex">
        <input
          id={fieldId}
          type={visivel ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={`min-h-[44px] min-w-0 flex-1 border bg-papel px-3 py-2 text-base text-carvao placeholder:text-mineral focus:border-bronze ${
            error ? "border-erro" : "border-linha"
          } ${className}`}
          {...props}
        />
        <button
          type="button"
          aria-controls={fieldId}
          aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
          onClick={() => {
            setVisivel((v) => !v);
            setAlternou(true);
          }}
          className="rotulo min-h-[44px] min-w-[88px] border border-l-0 border-linha bg-papel px-3 text-carvao hover:text-bronze"
        >
          {visivel ? "Ocultar" : "Mostrar"}
        </button>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {alternou ? (visivel ? "Sua senha está visível." : "Sua senha está oculta.") : ""}
      </p>
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
}
