"use client";

/**
 * Botão que entrega um CSV montado no servidor (o texto chega pronto na página; o navegador só o salva). A página exige conta, então
 * o botão aparece sempre. Nenhum dado sai do navegador.
 */
export function BaixarCsv({ nome, conteudo, rotulo }: Readonly<{ nome: string; conteudo: string; rotulo: string }>) {
  return (
    <button
      type="button"
      data-baixar-csv={nome}
      onClick={() => {
        const url = URL.createObjectURL(new Blob([conteudo], { type: "text/csv;charset=utf-8" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = nome;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }}
      className="inline-flex min-h-[44px] items-center border border-carvao px-4 text-sm text-carvao transition-colors duration-150 hover:bg-carvao hover:text-marfim active:scale-[0.98]"
    >
      {rotulo}
    </button>
  );
}
