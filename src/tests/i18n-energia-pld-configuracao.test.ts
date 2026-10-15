import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseFragment, type DefaultTreeAdapterMap } from "parse5";
import { describe, expect, it, vi } from "vitest";
import type { Ficha, PrevisoesDesempenhoGold } from "@/lib/energia/tipos-previsoes";

// Só o adaptador desta gold é substituído; demais leituras e componentes são reais.
const troca = vi.hoisted(() => {
  const estado: { gold: PrevisoesDesempenhoGold | null } = { gold: null };
  return estado;
});
vi.mock("@/lib/energia/gold", async (original) => {
  const modulo = await original<typeof import("@/lib/energia/gold")>();
  return {
    ...modulo,
    lerGold: (nome: string) => nome === "previsoes_desempenho.json" && troca.gold !== null ? troca.gold : modulo.lerGold(nome),
  };
});

import PaginaFicha from "@/app/setor-eletrico/pld/modelos/[modelo]/page";
import { GOLD_PREVISOES } from "@/lib/energia/previsoes";

type No = DefaultTreeAdapterMap["node"];
type Elemento = DefaultTreeAdapterMap["element"];
const filhos = (no: No): No[] => "childNodes" in no ? no.childNodes : [];
const atributo = (no: Elemento, nome: string) => no.attrs.find((a) => a.name === nome)?.value;
function elementos(no: No): Elemento[] {
  return [...("tagName" in no ? [no] : []), ...filhos(no).flatMap(elementos)];
}
function texto(no: No): string {
  return "value" in no ? no.value : filhos(no).map(texto).join("");
}
function unico(nos: Elemento[], predicado: (no: Elemento) => boolean): Elemento {
  const encontrados = nos.filter(predicado);
  expect(encontrados).toHaveLength(1);
  return encontrados[0];
}
function congelar<T extends object>(valor: T): T {
  for (const filho of Object.values(valor)) if (filho !== null && typeof filho === "object") congelar(filho);
  return Object.freeze(valor);
}

describe("configuração privada da ficha PLD na página real em português", () => {
  it("preserva recursão de objetos, String nos arrays, precisão, sinal e sha256 sem mutar a gold", () => {
    const publicada: PrevisoesDesempenhoGold = JSON.parse(readFileSync(join(process.cwd(), "public/energia/gold", GOLD_PREVISOES), "utf-8"));
    expect(publicada.disponivel).toBe(true);
    const fixture = structuredClone(publicada);
    const ficha = fixture.fichas.find((f) => f.codigo === "S0");
    if (!ficha) throw new Error("A gold precisa conter a ficha S0 para esta prova de configuração.");

    const configuracao: NonNullable<Ficha["configuracao"]> = {
      objeto: { semanal: { alpha: 1234.5678 } },
      sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      lista: [1234.5678, 12, "1234.5678", null, true, { x: 1234.5 }, [1234.5, 2]],
      negativo: -1234.5,
      zero_negativo: -0,
      texto_numerico: "1234.5678",
    };
    ficha.configuracao = configuracao;
    const antes = structuredClone(fixture);
    congelar(fixture);
    const props: ComponentProps<typeof PaginaFicha> = { params: { modelo: "s0" } };

    troca.gold = fixture;
    try {
      // Sem prop de idioma inventada: a página Next atual publica somente PT.
      const nos = elementos(parseFragment(renderToStaticMarkup(createElement(PaginaFicha, props))));
      const implementacao = unico(nos, (no) => atributo(no, "id") === "implementacao");
      const rotulo = unico(elementos(implementacao), (no) => no.tagName === "dt" && texto(no) === "Configuração");
      if (!rotulo.parentNode) throw new Error("O rótulo de configuração precisa pertencer à sua linha de definição.");
      const valor = unico(elementos(rotulo.parentNode), (no) => no.tagName === "dd");
      const blocos = filhos(valor).filter((no): no is Elemento => "tagName" in no);
      expect(blocos.map((no) => no.tagName)).toEqual(["span", "ul"]);
      expect(texto(blocos[0])).toBe("sha256 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
      const sha = unico(elementos(blocos[0]), (no) => atributo(no, "class") === "font-mono text-xs");
      expect(texto(sha)).toBe("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");

      // Lista exata e em ordem: sha256 não pode aparecer novamente como parâmetro.
      const itens = elementos(blocos[1]).filter((no) => no.tagName === "li");
      expect(itens.map(texto)).toEqual([
        "objeto: semanal: alpha: 1.234,568",
        "lista: 1.234,568; 12; 1234.5678; null; true; [object Object]; 1234.5,2",
        "negativo: -1.234,5",
        "zero_negativo: -0",
        "texto_numerico: 1234.5678",
      ]);
      expect(fixture).toEqual(antes);
    } finally {
      troca.gold = null;
    }
  });
});
