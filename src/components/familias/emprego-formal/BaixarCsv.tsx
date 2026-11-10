"use client";

import { ExportacaoComConta } from "@/components/acesso/ExportacaoComConta";

/**
 * Exportação do navegador (o "baixar CSV" do painel antigo): monta o arquivo com as linhas que o servidor entregou, separadas por ponto
 * e vírgula, com o cabeçalho de fonte e método nas primeiras linhas. Sem conta, o kit troca o botão pelo convite para entrar.
 */
export function BaixarCsv({ rotulo, nomeArquivo, cabecalho, colunas, linhas }: { rotulo: string; nomeArquivo: string; cabecalho: string[]; colunas: string[]; linhas: (string | number | boolean | null)[][] }) {
  const esc = (v: string | number | boolean | null) => {
    if (v === null) return "";
    const s = String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const baixar = () => {
    const texto = [...cabecalho.map((c) => `# ${c}`), colunas.join(";"), ...linhas.map((l) => l.map(esc).join(";"))].join("\n");
    const url = URL.createObjectURL(new Blob([`﻿${texto}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = nomeArquivo;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <ExportacaoComConta rotulo={rotulo}>
      <button type="button" onClick={baixar} className="inline-flex min-h-[44px] items-center text-sm text-carvao underline decoration-linha underline-offset-4 hover:decoration-carvao">
        {rotulo}
      </button>
    </ExportacaoComConta>
  );
}
