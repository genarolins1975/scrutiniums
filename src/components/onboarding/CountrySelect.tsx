"use client";

import { useId } from "react";
import { COUNTRIES } from "@/lib/phone";

/** Seleção de país com label real. Padrão: Brasil. */
export function CountrySelect({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="rotulo text-carvao-muted">
        País
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[44px] border border-linha bg-papel px-3 py-2 text-base text-carvao focus:border-bronze disabled:opacity-50"
      >
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name} ({c.ddi})
          </option>
        ))}
      </select>
    </div>
  );
}
