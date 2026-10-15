import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseFragment, type DefaultTreeAdapterMap } from "parse5";
import { describe, expect, it, vi } from "vitest";
import type { InclusaoGold } from "@/lib/energia/tipos-inclusao";

// Só a entrada inclusao.json é adaptada em memória; página, modelo e filhos reais.
const troca = vi.hoisted(() => {
  const estado: { inclusao: InclusaoGold | null } = { inclusao: null };
  return estado;
});
vi.mock("@/lib/energia/gold", async (original) => {
  const modulo = await original<typeof import("@/lib/energia/gold")>();
  return { ...modulo, lerGold: (nome: string) => nome === "inclusao.json" && troca.inclusao !== null ? troca.inclusao : modulo.lerGold(nome) };
});
import InclusaoPage from "@/app/setor-eletrico/inclusao-energetica/page";

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
function congelar<T extends object>(valor: T): T {
  for (const filho of Object.values(valor)) if (filho !== null && typeof filho === "object") congelar(filho);
  return Object.freeze(valor);
}

describe("Inclusão: limiares da folha PT real", () => {
  it("preserva a fração percentual, o destino e toda a gold fora da entrada declarada", () => {
    const arquivo = join(process.cwd(), "public/energia/gold/inclusao.json");
    const original = readFileSync(arquivo, "utf8");
    const fixture: InclusaoGold = JSON.parse(original);
    expect(fixture.disponivel).toBe(true);
    // Valores de apresentação: só este campo muda, sem publicação ou recálculo.
    fixture.orcamento.limiares_pct = [3.25, 5, 10];
    const antes = structuredClone(fixture);
    congelar(fixture);
    troca.inclusao = fixture;
    try {
      const nos = elementos(parseFragment(renderToStaticMarkup(createElement(InclusaoPage))));
      const paragrafos = nos.filter((no) => no.tagName === "p" && texto(no).startsWith("Por região, por limiar de "));
      expect(paragrafos).toHaveLength(1);
      expect(texto(paragrafos[0])).toBe("Por região, por limiar de 3,25%, 5%, 10% da renda e da despesa e por UF, no painel completo de orçamento.");
      expect(elementos(paragrafos[0]).filter((no) => no.tagName === "a").map((no) => [texto(no), atributo(no, "href")]))
        .toEqual([["painel completo de orçamento", "/setor-eletrico/inclusao-energetica/orcamento"]]);
      expect(fixture).toEqual(antes);
      expect(readFileSync(arquivo, "utf8")).toBe(original);
    } finally { troca.inclusao = null; }
  });
});
