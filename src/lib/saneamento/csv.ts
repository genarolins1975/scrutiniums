/** CSV com ponto e vírgula, BOM e aspas; vazio é ausência e zero continua zero. */
export function csv(cabecalho: readonly string[], linhas: readonly (readonly (string | number | null | undefined)[])[]): string {
  const esc = (v: string | number | null | undefined) => {
    if (v == null) return "";
    const t = typeof v === "number" ? String(v).replace(".", ",") : v;
    return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return "﻿" + [cabecalho, ...linhas].map((l) => l.map(esc).join(";")).join("\r\n") + "\r\n";
}

export function baixarCsv(nome: string, cabecalho: readonly string[], linhas: readonly (readonly (string | number | null | undefined)[])[]): void {
  const blob = new Blob([csv(cabecalho, linhas)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
