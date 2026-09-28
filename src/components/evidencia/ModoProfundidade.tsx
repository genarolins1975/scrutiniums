"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

/**
 * Três níveis de profundidade sobre a MESMA página (nunca três páginas):
 * Entender (padrão), Analisar, Auditar. Blocos marcados com data-nivel
 * aparecem a partir do seu nível. Sem JavaScript, tudo aparece em ordem.
 * O modo fica na URL (?modo=) para ser compartilhável.
 *
 * Âncoras: o HTML chega com todos os níveis visíveis; ao aplicar o modo, blocos
 * acima do alvo somem e a rolagem se perde. Por isso, depois de aplicar o modo
 * (e a cada troca de #hash), o alvo é rolado de novo até a vista; se ele estiver
 * num nível mais profundo que o atual, o modo sobe até esse nível.
 */
export type Modo = "entender" | "analisar" | "auditar";
const MODOS: { id: Modo; rotulo: string; dica: string }[] = [
  { id: "entender", rotulo: "Entender", dica: "O essencial em poucos minutos" },
  { id: "analisar", rotulo: "Analisar", dica: "Mais séries, períodos e comparações" },
  { id: "auditar", rotulo: "Auditar", dica: "Dados, regras, modelo, versões e arquivos" },
];
const ORDEM: Record<Modo, number> = { entender: 0, analisar: 1, auditar: 2 };

function nivelExigido(el: Element | null): Modo {
  const bloco = el?.closest("[data-nivel]");
  const n = bloco?.getAttribute("data-nivel");
  return n === "analisar" || n === "auditar" ? n : "entender";
}

function alvoDoHash(): HTMLElement | null {
  const h = decodeURIComponent(window.location.hash.slice(1));
  return h ? document.getElementById(h) : null;
}

export function ModoProfundidade({ children }: { children: ReactNode }) {
  const [modo, setModo] = useState<Modo | "todos">("todos");
  const rolarPendente = useRef(false);
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);

  const gravaUrl = useCallback((m: Modo) => {
    try {
      const url = new URL(window.location.href);
      if (m === "entender") url.searchParams.delete("modo");
      else url.searchParams.set("modo", m);
      window.history.replaceState(null, "", url.toString());
    } catch {
      // URL inalterada não impede a troca de modo
    }
  }, []);

  // modo inicial: o da URL, elevado se o #alvo estiver num nível mais profundo
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("modo");
    let m: Modo = q === "analisar" || q === "auditar" ? q : "entender";
    const alvo = alvoDoHash();
    if (alvo && ORDEM[nivelExigido(alvo)] > ORDEM[m]) {
      m = nivelExigido(alvo);
      gravaUrl(m);
    }
    rolarPendente.current = !!alvo;
    setModo(m);
  }, [gravaUrl]);

  // depois que o modo foi aplicado ao DOM, rola até o alvo do #hash
  useEffect(() => {
    if (modo === "todos" || !rolarPendente.current) return;
    rolarPendente.current = false;
    const id = window.requestAnimationFrame(() => alvoDoHash()?.scrollIntoView({ block: "start" }));
    return () => window.cancelAnimationFrame(id);
  }, [modo]);

  // clique em âncora da própria página para um bloco oculto: sobe o modo e rola
  useEffect(() => {
    function aoMudarHash() {
      const alvo = alvoDoHash();
      if (!alvo) return;
      setModo((atual) => {
        const exigido = nivelExigido(alvo);
        if (atual !== "todos" && ORDEM[exigido] > ORDEM[atual]) {
          gravaUrl(exigido);
          rolarPendente.current = true;
          return exigido;
        }
        return atual;
      });
    }
    window.addEventListener("hashchange", aoMudarHash);
    return () => window.removeEventListener("hashchange", aoMudarHash);
  }, [gravaUrl]);

  function escolher(m: Modo) {
    setModo(m);
    gravaUrl(m);
  }

  // padrão de radiogroup: setas movem a seleção e o foco
  function teclado(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const passo = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!passo) return;
    e.preventDefault();
    const j = (i + passo + MODOS.length) % MODOS.length;
    escolher(MODOS[j].id);
    botoes.current[j]?.focus();
  }

  const ativoIdx = Math.max(0, MODOS.findIndex((m) => m.id === modo));
  return (
    <div data-modo={modo} className="modo-profundidade">
      <div className="sticky top-0 z-30 -mx-6 border-b border-linha bg-papel/95 px-6 py-2 backdrop-blur supports-[backdrop-filter]:bg-papel/80 sm:py-3">
        <div role="radiogroup" aria-label="Nível de profundidade" className="flex items-center gap-1.5 sm:gap-2">
          <span className="rotulo mr-2 hidden text-mineral sm:inline">Profundidade</span>
          {MODOS.map((m, i) => {
            const ativo = modo === m.id;
            return (
              <button
                key={m.id}
                ref={(el) => {
                  botoes.current[i] = el;
                }}
                type="button"
                role="radio"
                aria-checked={ativo}
                tabIndex={i === ativoIdx ? 0 : -1}
                onClick={() => escolher(m.id)}
                onKeyDown={(e) => teclado(e, i)}
                title={m.dica}
                className={`rotulo min-h-[44px] flex-1 border px-2 transition-colors sm:flex-none sm:px-4 ${
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
