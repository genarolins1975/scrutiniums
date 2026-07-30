"use client";

import { forwardRef, useId } from "react";

/**
 * Entrada de código de 6 dígitos acessível: um único input com
 * inputMode numérico e autoComplete "one-time-code" — navegável por
 * teclado e compatível com preenchimento automático de SMS/e-mail.
 */
export const OtpInput = forwardRef<
  HTMLInputElement,
  {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
    disabled?: boolean;
  }
>(function OtpInput({ label = "Código de 6 dígitos", value, onChange, error, disabled }, ref) {
  const id = useId();
  const errorId = `${id}-erro`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="rotulo text-carvao-muted">
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`min-h-[52px] w-full border bg-papel px-3 py-2 text-center font-serif text-2xl tracking-[0.5em] text-carvao placeholder:text-mineral focus:border-bronze disabled:opacity-50 ${
          error ? "border-erro" : "border-linha"
        }`}
        placeholder="••••••"
      />
      {error && (
        <p id={errorId} role="alert" className="text-sm text-erro">
          {error}
        </p>
      )}
    </div>
  );
});
