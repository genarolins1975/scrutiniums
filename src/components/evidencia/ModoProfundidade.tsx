"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Três níveis de profundidade sobre a MESMA página (nunca três páginas):
 * Entender (padrão), Analisar, Auditar. Blocos marcados com data-nivel
 * aparecem a partir do seu nível. Sem JavaScript, tudo aparece em ordem.
 * O modo fica na URL (?modo=) para ser compartilhável.
 */
export type Modo = "entender" | "analisar" | "auditar";
const MODOS: { id: Modo; rotulo: string; dica: string }[] = [
  { id: "entender", rotulo: "Entender", dica: "O essencial em poucos minutos" },
  { id: "analisar", rotulo: "Analisar", dica: "Mais séries, períodos e comparações" },
  { id: "auditar", rotulo: "Auditar", dica: "Dados, regras, modelo, versões e arquivos" },
];

export function ModoProfundidade({ children }: { children: ReactNode }) {
  const [modo, setModo] = useState<Modo | "todos">("todos");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("modo");
    setModo(q === "analisar" || q === "auditar" ? q : "entender");
  }, []);

  function escolher(m: Modo) {
    setModo(m);
    try {
      const url = new URL(window.location.href);
      if (m === "entender") url.searchParams.delete("modo");
      else url.searchParams.set("modo", m);
      window.history.replaceState(null, "", url.toString());
    } catch {
      // URL inalterada não impede a troca de modo
    }
  }

  return (
    <div data-modo={modo} className="modo-profundidade">
      <div className="sticky top-0 z-30 -mx-6 border-b border-linha bg-papel/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-papel/80">
        <div role="radiogroup" aria-label="Nível de profundidade" className="flex flex-wrap items-center gap-2">
          <span className="rotulo mr-2 text-mineral">Profundidade</span>
          {MODOS.map((m) => {
            const ativo = modo === m.id;
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={ativo}
                onClick={() => escolher(m.id)}
                title={m.dica}
                className={`rotulo min-h-[40px] border px-4 transition-colors ${
                  ativo ? "border-energia bg-energia text-superficie" : "border-linha bg-superficie text-carvao hover:border-energia"
                }`}
              >
                {m.rotulo}
              </button>
            );
          })}
          <span className="ml-1 hidden text-xs text-mineral md:inline">
            {MODOS.find((m) => m.id === modo)?.dica ?? "Todos os níveis visíveis"}
          </span>
        </div>
      </div>
      {children}
    </div>
  );
}
