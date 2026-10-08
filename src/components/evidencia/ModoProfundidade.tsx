"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { AbreDetalhesAoImprimir } from "@/components/energia/AbreDetalhesAoImprimir";

/**
 * Três níveis de profundidade sobre a MESMA página (nunca três páginas):
 * Entender (padrão), Analisar, Auditar. Blocos marcados com data-nivel
 * aparecem a partir do seu nível. Sem JavaScript, tudo aparece em ordem.
 * O modo fica na URL (?modo=) para ser compartilhável. Quem escolhe Analisar ou Auditar
 * segue nesse nível ao trocar de painel: o clique em link interno do observatório, sem
 * ?modo= próprio, leva o nível junto (abas do módulo, "Abrir o painel", "Próxima pergunta").
 *
 * Âncoras: antes da hidratação o HTML ainda não sabe o modo (data-modo="todos": o CSS mostra tudo
 * sem JavaScript e só Entender com JavaScript); ao aplicar o modo, blocos
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
  let h = window.location.hash.slice(1);
  try {
    h = decodeURIComponent(h);
  } catch {
    // hash com % malformado: procura pelo texto cru em vez de derrubar a página
  }
  return h ? document.getElementById(h) : null;
}

/** Destinos que não têm seletor de profundidade: o nível não viaja para lá. */
function destinoSemNivel(caminho: string): boolean {
  return caminho === "/setor-eletrico" || caminho === "/setor-eletrico/" || caminho.startsWith("/setor-eletrico/aprenda");
}

/**
 * Endereço de destino com o nível atual (?modo=) quando o clique em `href` deve levá-lo junto; null quando não deve:
 * nível Entender (o padrão não vai para a URL), outra origem, fora do observatório, mesma página, destino sem seletor
 * de profundidade (hub e Aprenda) ou link que já traz ?modo= próprio.
 */
export function urlComNivel(href: string, atual: { origin: string; pathname: string; search: string }): string | null {
  const nivel = new URLSearchParams(atual.search).get("modo");
  if (nivel !== "analisar" && nivel !== "auditar") return null;
  let url: URL;
  try {
    url = new URL(href, `${atual.origin}${atual.pathname}${atual.search}`);
  } catch {
    return null;
  }
  if (url.origin !== atual.origin || !url.pathname.startsWith("/setor-eletrico")) return null;
  if (url.pathname === atual.pathname || destinoSemNivel(url.pathname) || url.searchParams.has("modo")) return null;
  url.searchParams.set("modo", nivel);
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Roteador do app; null onde ele não está montado (renderização de teste), sem derrubar a página. */
function useRoteadorOuNulo() {
  try {
    return useRouter();
  } catch {
    return null;
  }
}

export function ModoProfundidade({ children }: { children: ReactNode }) {
  const router = useRoteadorOuNulo();
  const [modo, setModo] = useState<Modo | "todos">("todos");
  const rolarPendente = useRef(false);
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);

  // escolha do visitante entra no histórico (voltar desfaz a troca de modo); ajustes
  // automáticos (modo elevado por âncora) só substituem a entrada atual
  const gravaUrl = useCallback((m: Modo, novaEntrada = false) => {
    try {
      const url = new URL(window.location.href);
      if (m === "entender") url.searchParams.delete("modo");
      else url.searchParams.set("modo", m);
      if (url.toString() === window.location.href) return;
      if (novaEntrada) window.history.pushState(window.history.state, "", url.toString());
      else window.history.replaceState(window.history.state, "", url.toString());
    } catch {
      // URL inalterada não impede a troca de modo
    }
  }, []);

  // voltar e avançar do navegador restauram o modo gravado na URL
  useEffect(() => {
    function aoNavegar() {
      const q = new URLSearchParams(window.location.search).get("modo");
      setModo(q === "analisar" || q === "auditar" ? q : "entender");
    }
    window.addEventListener("popstate", aoNavegar);
    return () => window.removeEventListener("popstate", aoNavegar);
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
    // dois quadros: o primeiro aplica o modo ao layout, o segundo rola sem animação
    // (uma rolagem suave concorreria com a da âncora nativa e pararia fora do alvo)
    let id2 = 0;
    const id1 = window.requestAnimationFrame(() => {
      id2 = window.requestAnimationFrame(() => alvoDoHash()?.scrollIntoView({ block: "start", behavior: "instant" as ScrollBehavior }));
    });
    return () => {
      window.cancelAnimationFrame(id1);
      window.cancelAnimationFrame(id2);
    };
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

  // o nível escolhido acompanha o clique em link interno do observatório que não traz ?modo= próprio
  useEffect(() => {
    function aoClicar(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!(a instanceof HTMLAnchorElement) || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      if (!router) return;
      const destino = urlComNivel(a.href, window.location);
      if (!destino) return;
      e.preventDefault();
      router.push(destino);
    }
    document.addEventListener("click", aoClicar, true);
    return () => document.removeEventListener("click", aoClicar, true);
  }, [router]);

  // clique e seta do teclado criam uma entrada no histórico: o Voltar desfaz a troca de nível (seção 7.3 da especificação).
  // Substituir a entrada nas setas fazia o Voltar pular para o nível anterior ao último clique (a r6 mediu 69 páginas assim).
  function escolher(m: Modo) {
    setModo(m);
    gravaUrl(m, true);
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
      <AbreDetalhesAoImprimir />
      <div className="sticky top-0 z-30 border-b border-linha bg-papel/95 py-2 backdrop-blur supports-[backdrop-filter]:bg-papel/80 sm:py-3">
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
