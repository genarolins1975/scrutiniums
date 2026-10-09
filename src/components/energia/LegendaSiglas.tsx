"use client";

import { useEffect, useState } from "react";
import { legendaDeSiglas, siglasNoTexto } from "@/lib/energia/siglas";

/** Quantas siglas a legenda mostra de uma vez: a mais antiga no texto vem primeiro, o resto fica atrás de "Mais siglas". */
const NA_LINHA = 6;
/** Teto de siglas por página: acima disso a legenda vira glossário, que é papel do Aprenda. */
const TETO = 14;

/**
 * Legenda com o nome por extenso das siglas que o leitor encontra na página, logo abaixo do título e das fontes.
 *
 * O HTML do servidor traz a lista que a página declara (`siglas`), para quem lê sem JavaScript e para o primeiro quadro.
 * Depois da hidratação a lista passa a ser derivada do texto que está à vista agora: cada sigla do dicionário que aparece
 * no texto visível do nível escolhido (Entender, Analisar ou Auditar), sem as que o próprio texto já expande, na ordem
 * da primeira aparição. Trocar de nível, ou abrir e fechar um bloco, refaz a lista. Texto escondido (nível mais fundo, tabela recolhida, bloco
 * fechado) não conta: a legenda não define o que o leitor ainda não leu. Sigla fora do dicionário não é expandida.
 */
export function LegendaDeSiglas({ siglas }: { siglas?: readonly string[] }) {
  const [viva, setViva] = useState<readonly string[] | null>(null);

  useEffect(() => {
    let tempo: ReturnType<typeof setTimeout> | undefined;
    const recalcula = () => {
      const main = document.querySelector("main");
      if (!main) return;
      const achadas = siglasNoTexto(textoVisivel(main), TETO);
      setViva((antes) => (antes && antes.join("|") === achadas.join("|") ? antes : achadas));
    };
    const agenda = () => {
      if (tempo) clearTimeout(tempo);
      tempo = setTimeout(recalcula, 60);
    };
    agenda();
    const mo = new MutationObserver(agenda);
    document.querySelectorAll(".modo-profundidade").forEach((e) => mo.observe(e, { attributes: true, attributeFilter: ["data-modo"] }));
    // abrir ou fechar um bloco (a abertura do módulo, uma tabela recolhida) muda o texto à vista; o evento toggle não borbulha, então a captura
    document.addEventListener("toggle", agenda, true);
    return () => {
      if (tempo) clearTimeout(tempo);
      mo.disconnect();
      document.removeEventListener("toggle", agenda, true);
    };
  }, []);

  const lista = viva ?? siglas ?? [];
  const entradas = legendaDeSiglas(lista).split("; ").filter(Boolean);
  if (!entradas.length) return null;
  const visiveis = entradas.slice(0, NA_LINHA);
  const resto = entradas.slice(NA_LINHA);
  return (
    <div className="mt-2 max-w-prose2 text-xs leading-relaxed text-mineral" data-siglas="true">
      <p>
        <span className="font-medium text-carvao-muted">Siglas: </span>
        {visiveis.join("; ")}.
      </p>
      {resto.length > 0 && (
        <details className="mt-1">
          <summary className="inline-flex min-h-[24px] cursor-pointer items-center text-energia-dark underline underline-offset-4 max-md:min-h-[44px] [@media(pointer:coarse)]:min-h-[44px]">
            Mais {resto.length} {resto.length === 1 ? "sigla" : "siglas"}
          </summary>
          <p>{resto.join("; ")}.</p>
        </details>
      )}
    </div>
  );
}

/** Texto que está à vista em `raiz`: sem elemento escondido por CSS, sem bloco fechado e sem a própria legenda. */
function textoVisivel(raiz: Element): string {
  const partes: string[] = [];
  const visita = (el: Element) => {
    if (el.hasAttribute("data-siglas")) return;
    const tag = el.tagName;
    if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT" || tag === "TEMPLATE") return;
    const css = getComputedStyle(el);
    if (css.display === "none" || css.visibility === "hidden") return;
    const fechado = tag === "DETAILS" && !el.hasAttribute("open");
    el.childNodes.forEach((n) => {
      if (n.nodeType === 3) partes.push(n.textContent ?? "");
      else if (n.nodeType === 1) {
        const filho = n as Element;
        if (fechado && filho.tagName !== "SUMMARY") return;
        visita(filho);
      }
    });
  };
  visita(raiz);
  return partes.join(" ");
}
