import { describe, expect, it, vi } from "vitest";
import { createElement, type FunctionComponent } from "react";

// A busca da página de entrada usa o roteador do Next, que não existe na renderização estática do teste.
vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<typeof import("next/navigation")>("next/navigation")),
  useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {}, back: () => {}, forward: () => {}, refresh: () => {} }),
  usePathname: () => "/saneamento",
  useSearchParams: () => new URLSearchParams(),
}));
import { renderToStaticMarkup } from "react-dom/server";
import { EIXOS, ROTA, rotaCapitulo } from "@/lib/saneamento/capitulos";
import { prestadores, controleSocietario } from "@/lib/saneamento/gold";
import { CAPITULOS_SEM_MANCHETE_FINANCEIRA, respostasDosCapitulos } from "@/lib/saneamento/respostas";
import Entrada from "@/app/saneamento/page";

/**
 * Etapa 3 da análise de arquitetura (docs/saneamento/ARQUITETURA_2026-10-17.md): na entrada, cada capítulo traz resposta curta e
 * número com prova, calculado pelo mesmo contrato da página do capítulo; as páginas longas ganham a navegação "Nesta página".
 */
const texto = (h: string) => h.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ");
async function pagina(mod: string, props: object = {}) {
  const C = (await import(/* @vite-ignore */ mod)).default as FunctionComponent<object>;
  return renderToStaticMarkup(createElement(C, props));
}
const todos = EIXOS.flatMap((e) => e.capitulos);
// capítulos cujo número seria valor financeiro autodeclarado ao SINISA ficam sem manchete (decisão de 20/10/2026)
const semManchete = new Set<number>(CAPITULOS_SEM_MANCHETE_FINANCEIRA);
const capitulos = todos.filter((c) => !semManchete.has(c.numero));
const modulo = (slug: string) => `@/app/saneamento/${slug}/page`;

describe("Entrada: resposta curta e número com prova por capítulo", () => {
  const respostas = respostasDosCapitulos();

  it("os capítulos sem valor financeiro autodeclarado têm resposta com valor, o que ele mede, frase e fonte", () => {
    expect(todos).toHaveLength(14);
    expect(capitulos).toHaveLength(14 - semManchete.size);
    for (const n of semManchete) expect(respostas[n], `capítulo ${n} sem manchete financeira`).toBeUndefined();
    for (const c of capitulos) {
      const r = respostas[c.numero];
      expect(r, `capítulo ${c.numero}`).toBeDefined();
      for (const campo of [r!.valor, r!.rotulo, r!.frase, r!.fonte]) expect(campo.length, `capítulo ${c.numero}`).toBeGreaterThan(0);
      expect(r!.valor, `capítulo ${c.numero}`).not.toMatch(/sem dado|NaN|undefined/);
      expect(r!.frase, `capítulo ${c.numero}`).not.toMatch(/sem dado|NaN|undefined/);
    }
  });

  it("o valor da entrada aparece na página do capítulo (mesmo contrato, mesma formatação)", async () => {
    for (const c of capitulos) {
      const r = respostas[c.numero]!;
      const h = texto(await pagina(modulo(c.slug)));
      expect(h, `capítulo ${c.numero} (${c.slug}) sem ${r.valor}`).toContain(r.valor);
    }
  }, 120_000);

  it("a entrada mostra resposta, valor e fonte em cada capítulo, e o link leva ao capítulo", async () => {
    const bruto = await pagina("@/app/saneamento/page");
    for (const c of capitulos) {
      const r = respostas[c.numero]!;
      const i = bruto.indexOf(`data-capitulo="${c.numero}"`);
      expect(i, `capítulo ${c.numero}`).toBeGreaterThan(-1);
      const bloco = texto(bruto.slice(i, bruto.indexOf("</li>", bruto.indexOf("data-resposta", i))));
      for (const t of [r.valor, r.rotulo, r.frase, r.fonte]) expect(bloco, `capítulo ${c.numero}`).toContain(t);
      expect(bruto).toContain(`href="${rotaCapitulo(c)}"`);
    }
    expect(texto(bruto)).toContain("Cada capítulo traz a resposta curta, o número que a sustenta e a fonte");
    expect(Entrada).toBeTypeOf("function");
  }, 60_000);
});

describe("Nesta página: atalhos completos, na ordem, sem âncora ausente", () => {
  const sabesp = controleSocietario().find((c) => c.prestador)?.prestador;
  const semControle = prestadores().find((p) => !controleSocietario().some((c) => c.prestador === p.id))?.id;
  const PAGINAS: [string, string, object?][] = [
    ...[
      "acesso", "desigualdades", "continuidade", "esgoto", "tarifa-social", "investimento", "financiamento", "planejamento",
      "responsaveis", "saude-ambiente", "resiliencia", "internacional", "metodologia",
    ].map((s): [string, string] => [s, modulo(s)]),
    ["ficha do município", "@/app/saneamento/municipio/[id]/page", { params: { id: "3550308" } }],
    ["ficha de prestador com controle", "@/app/saneamento/prestadores/[id]/page", { params: { id: sabesp } }],
    ["ficha de prestador sem controle", "@/app/saneamento/prestadores/[id]/page", { params: { id: semControle } }],
  ];

  it.each(PAGINAS)("%s", async (_nome, mod, props) => {
    const h = await pagina(mod, props);
    const nav = h.match(/<nav aria-label="Nesta página"[\s\S]*?<\/nav>/)?.[0];
    expect(nav, "navegação ausente").toBeDefined();
    const atalhos = [...nav!.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
    // Seções da página: <section id> que contêm um título h2, na ordem do documento.
    const secoes = [...h.matchAll(/<section[^>]*\bid="([^"]+)"[^>]*>(?:(?!<section)[\s\S])*?<h2/g)].map((m) => m[1]);
    expect(atalhos).toEqual(secoes);
    expect(new Set(atalhos).size).toBe(atalhos.length);
  }, 60_000);

  it("os dois casos de ficha de prestador existem na gold", () => {
    expect(sabesp).toBeTruthy();
    expect(semControle).toBeTruthy();
    expect(ROTA).toBe("/saneamento");
  });
});
