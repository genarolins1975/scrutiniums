"use client";

import { ExportacaoComConta } from "@/components/acesso/ExportacaoComConta";

const celula = (v: string | number | null): string => {
  if (v === null) return "";
  const s = String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * Exporta em CSV o recorte que está na tela (o universo, a medida, o mês e o período escolhidos), montado no navegador a
 * partir das mesmas linhas que o servidor desenhou. Cada linha leva o recorte e a fonte, para o arquivo se explicar sozinho.
 * Separador ';', ponto decimal, ausência como campo vazio (nunca zero) e BOM para o Excel. Numa página aberta, sem sessão, o
 * botão dá lugar ao convite para entrar (ExportacaoComConta); a série completa sai das rotas de servidor com conta.
 */
export function ExportarRecorte({ nome, colunas, linhas, recorte, fonte }: Readonly<{
  /** Nome do arquivo, sem a extensão. */
  nome: string;
  colunas: readonly string[];
  linhas: readonly (readonly (string | number | null)[])[];
  /** O recorte em palavras ("Varejo restrito, variação no mês com ajuste sazonal, setembro de 2026"). */
  recorte: string;
  fonte: string;
}>) {
  const baixar = () => {
    const corpo = [[...colunas, "recorte", "fonte"], ...linhas.map((l) => [...l, recorte, fonte])].map((l) => l.map(celula).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + corpo + "\n"], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nome}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };
  return (
    <ExportacaoComConta rotulo="Baixar este recorte (CSV)">
      <button
        type="button"
        onClick={baixar}
        data-exportar-recorte={nome}
        className="inline-flex min-h-[44px] items-center border border-linha bg-superficie px-4 text-sm text-carvao transition-[border-color,transform] duration-150 ease-out motion-safe:active:scale-[0.97] [@media(hover:hover)]:hover:border-carvao"
      >
        Baixar este recorte (CSV)
      </button>
    </ExportacaoComConta>
  );
}
