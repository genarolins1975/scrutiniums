"use client";

/**
 * Geração e download de CSV no cliente.
 * Padrão brasileiro: separador ponto e vírgula (valores usam vírgula
 * decimal, formatados pelos helpers de @/lib/format) e BOM UTF-8 para
 * abrir corretamente em planilhas.
 */
export function gerarCsv(cabecalho: string[], linhas: Array<Array<string | number>>): string {
  const escapar = (v: string | number) => {
    const s = String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const corpo = [cabecalho, ...linhas].map((l) => l.map(escapar).join(";")).join("\r\n");
  return "\ufeff" + corpo;
}

export function baixarCsv(
  nomeArquivo: string,
  cabecalho: string[],
  linhas: Array<Array<string | number>>,
): void {
  const blob = new Blob([gerarCsv(cabecalho, linhas)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const ancora = document.createElement("a");
  ancora.href = url;
  ancora.download = nomeArquivo;
  document.body.appendChild(ancora);
  ancora.click();
  ancora.remove();
  URL.revokeObjectURL(url);
}

export function DownloadCsvButton({
  nomeArquivo,
  cabecalho,
  linhas,
  rotulo = "Baixar dados (CSV)",
}: {
  nomeArquivo: string;
  cabecalho: string[];
  linhas: Array<Array<string | number>>;
  rotulo?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => baixarCsv(nomeArquivo, cabecalho, linhas)}
      className="rotulo min-h-[44px] border border-linha px-4 text-carvao-muted hover:border-carvao hover:text-carvao"
    >
      {rotulo}
    </button>
  );
}
