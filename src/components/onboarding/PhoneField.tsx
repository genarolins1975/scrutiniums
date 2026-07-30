"use client";

import { useId } from "react";

/**
 * Campo de telefone com máscara visual brasileira quando o país é BR:
 * (11) 91234-5678. Formatação leve no cliente, sem biblioteca extra —
 * a normalização/validação real acontece no servidor (toE164).
 */

export function formatBrPhone(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function PhoneField({
  country,
  value,
  onChange,
  error,
  disabled,
}: {
  country: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const errorId = `${id}-erro`;
  const isBr = country === "BR";

  function handleChange(raw: string) {
    if (isBr) {
      onChange(formatBrPhone(raw));
    } else {
      onChange(raw.replace(/[^\d\s()+-]/g, "").slice(0, 20));
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="rotulo text-carvao-muted">
        Telefone celular
      </label>
      <input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        disabled={disabled}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={isBr ? "(11) 91234-5678" : "Número com DDD"}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`min-h-[44px] border bg-papel px-3 py-2 text-base text-carvao placeholder:text-mineral focus:border-bronze disabled:opacity-50 ${
          error ? "border-erro" : "border-linha"
        }`}
      />
      {error && (
        <p id={errorId} role="alert" className="text-sm text-erro">
          {error}
        </p>
      )}
    </div>
  );
}
