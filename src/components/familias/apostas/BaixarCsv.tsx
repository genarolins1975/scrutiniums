"use client";

/**
 * Exportação montada no navegador a partir das linhas que a própria página mostra (as vistas de origem, na aplicação do Crédito,
 * exportavam do mesmo jeito). Separador ponto e vírgula e marca de ordem de bytes, para abrir direto em planilha.
 */
export type CelulaCsv = string | number | null | undefined;

export function montarCsv(linhas: readonly (readonly CelulaCsv[])[]): string {
  return "﻿" + linhas.map((l) => l.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
}

export function baixarTexto(nome: string, conteudo: string, tipo = "text/csv;charset=utf-8"): void {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const CLASSE_BAIXAR = "inline-flex min-h-[44px] items-center text-left text-sm text-carvao underline decoration-linha underline-offset-4 hover:decoration-carvao";

/** Botão que baixa as linhas dadas como CSV. A primeira linha é o cabeçalho. */
export function BaixarCsv({ nome, linhas, rotulo }: Readonly<{ nome: string; linhas: readonly (readonly CelulaCsv[])[]; rotulo: string }>) {
  return (
    <button type="button" className={CLASSE_BAIXAR} onClick={() => baixarTexto(nome, montarCsv(linhas))} data-baixar-csv="">
      {rotulo}
    </button>
  );
}
