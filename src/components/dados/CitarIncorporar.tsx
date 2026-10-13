"use client";

import { useState } from "react";
import { citacao, type DadosCitacao } from "@/lib/citacao";

/**
 * "Copiar citação" e "Incorporar" de um indicador. A data de acesso da citação é a
 * do clique, no relógio do leitor; o código de incorporação vem pronto do servidor.
 */
export function CitarIncorporar({ dados, incorporar }: { dados: DadosCitacao; incorporar: string }) {
  const [copiado, setCopiado] = useState<"" | "citacao" | "incorporar">("");
  const [manual, setManual] = useState("");

  async function copiar(tipo: "citacao" | "incorporar") {
    const texto = tipo === "citacao" ? citacao(dados, new Date()) : incorporar;
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(tipo);
      setManual("");
      window.setTimeout(() => setCopiado(""), 1600);
    } catch {
      setManual(texto);
    }
  }

  const botao = "rotulo inline-flex min-h-[44px] items-center border border-linha px-4 text-carvao hover:border-bronze hover:text-bronze";
  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-3" role="group" aria-label="Citar e incorporar">
        <button type="button" className={botao} onClick={() => copiar("citacao")}>
          {copiado === "citacao" ? "Citação copiada" : "Copiar citação"}
        </button>
        <button type="button" className={botao} onClick={() => copiar("incorporar")}>
          {copiado === "incorporar" ? "Código copiado" : "Incorporar"}
        </button>
      </div>
      <p className="sr-only" aria-live="polite">{copiado ? "Copiado para a área de transferência." : ""}</p>
      {manual && (
        <label className="mt-3 block text-xs text-mineral">
          Copie manualmente:
          <textarea readOnly value={manual} rows={4} className="mt-1 w-full border border-linha bg-marfim p-2 font-mono text-xs text-carvao" />
        </label>
      )}
    </div>
  );
}
