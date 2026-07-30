"use client";

import { InputHTMLAttributes, forwardRef, useId } from "react";

/**
 * Campo de formulário com label real, erro associado via aria-describedby
 * e dica opcional. Base de todos os formulários da plataforma.
 */
export const Field = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & {
    label: string;
    error?: string;
    hint?: string;
  }
>(function Field({ label, error, hint, id, className = "", ...props }, ref) {
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
      <input
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`min-h-[44px] border bg-papel px-3 py-2 text-base text-carvao placeholder:text-mineral focus:border-bronze ${
          error ? "border-erro" : "border-linha"
        } ${className}`}
        {...props}
      />
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
