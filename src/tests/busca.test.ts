import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { indiceDeBusca } from "@/lib/busca/indice";
import { buscar, emOrdemDeTela } from "@/lib/busca/buscar";
import { normalizar, palavrasDaBusca } from "@/lib/busca/normalizar";
import type { IndiceBusca } from "@/lib/busca/tipos";
import { ListaResultados } from "@/components/busca/ListaResultados";
import { PaginaAberta } from "@/components/acesso/PaginaAberta";

vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<typeof import("next/navigation")>("next/navigation")),
  usePathname: () => "/buscar",
}));

/**
 * Busca da plataforma (Iniciativa 3 do parecer de UX de 21/10/2026): os dez termos de controle do critério de aceite, um por
 * tipo, a ordem dos resultados e o selo "com conta" nos destinos fechados.
 */
vi.setConfig({ testTimeout: 60_000 });

const hrefs = (termo: string, n = 5) => buscar(indiceDeBusca(), termo).resultados.slice(0, n).map((r) => r.href);

describe("dez termos de controle", () => {
  it("coleção: 'saneamento' abre a coleção Saneamento em primeiro", () => {
    const r = buscar(indiceDeBusca(), "saneamento").resultados[0];
    expect([r.tipo, r.href]).toEqual(["colecao", "/saneamento"]);
  });

  it("página: 'curtailment' abre a página de curtailment do Setor Elétrico", () => {
    expect(hrefs("curtailment", 1)).toEqual(["/setor-eletrico/geracao/curtailment"]);
  });

  it("pergunta: 'quanto pesa a dívida' leva à porta das Famílias", () => {
    const r = buscar(indiceDeBusca(), "quanto pesa a dívida").resultados[0];
    expect([r.tipo, r.href, r.aberta]).toEqual(["pergunta", "/perguntas/familias", true]);
  });

  it("verbete: 'inadimplência' leva ao verbete do glossário", () => {
    const r = buscar(indiceDeBusca(), "inadimplência").resultados[0];
    expect(r.tipo).toBe("verbete");
    expect(r.href).toBe("/glossario#inadimplencia-90-dias");
  });

  it("sinônimo: 'GLP' leva ao gás de cozinha", () => {
    expect(hrefs("GLP", 3)).toContain("/gas-natural/gas-de-cozinha");
    expect(buscar(indiceDeBusca(), "GLP").resultados[0].href).toBe("/gas-natural/gas-de-cozinha");
  });

  it("município: 'Recife' leva às consultas Minha capital e Meu município, nunca ao resultado do município", () => {
    const r = buscar(indiceDeBusca(), "Recife").resultados;
    expect(r.every((x) => x.tipo === "consulta")).toBe(true);
    expect(r.map((x) => x.href)).toEqual(expect.arrayContaining(["/eficiencia-estatal", "/saneamento/municipio"]));
    expect(r[0].href).toBe("/eficiencia-estatal");
  });

  it("UF: 'Pernambuco' leva às consultas por estado", () => {
    const r = buscar(indiceDeBusca(), "Pernambuco").resultados;
    expect(r.length).toBeGreaterThan(1);
    expect(r.every((x) => x.tipo === "consulta")).toBe(true);
    expect(r.map((x) => x.href)).toEqual(expect.arrayContaining(["/gas-natural/gas-de-cozinha", "/contas-publicas-estaduais"]));
  });

  it("capital: 'Belo Horizonte' leva a Minha capital", () => {
    expect(hrefs("Belo Horizonte", 1)).toEqual(["/eficiencia-estatal"]);
  });

  it("distribuidora: 'Neoenergia Pernambuco' leva à Conta de luz", () => {
    expect(hrefs("Neoenergia Pernambuco", 1)).toEqual(["/setor-eletrico/conta-de-luz"]);
  });

  it("banco: 'Nubank' leva a Quanto meu banco cobra", () => {
    expect(hrefs("Nubank", 1)).toEqual(["/observatorio-do-credito/quanto-meu-banco-cobra"]);
  });
});

describe("ordem e forma", () => {
  it("normaliza acento, caixa e pontuação; ignora palavras vazias", () => {
    expect(normalizar("Dívida dos Estados!")).toBe("divida dos estados");
    expect(palavrasDaBusca("quanto pesa a dívida")).toEqual(["quanto", "pesa", "divida"]);
    expect(buscar(indiceDeBusca(), "botijao").resultados[0].href).toBe(buscar(indiceDeBusca(), "Botijão").resultados[0].href);
  });

  it("título igual ao termo vem antes de prefixo, sinônimo e resumo; até 30 resultados", () => {
    const r = buscar(indiceDeBusca(), "PLD").resultados;
    expect(r.length).toBeLessThanOrEqual(30);
    for (let k = 1; k < r.length; k++) expect(r[k].nivel).toBeGreaterThanOrEqual(r[k - 1].nivel);
    expect(buscar(indiceDeBusca(), "a").resultados.length).toBeLessThanOrEqual(30);
  });

  it("entre iguais, consulta pessoal antes de página publicada, e publicada antes de parcial e prevista", () => {
    const sintetico: IndiceBusca = {
      versao: 1,
      observatorios: [{ id: "familias", nome: "Famílias" }],
      colecoes: [{ id: "renda", observatorio: "familias", nome: "Renda", href: "/r" }],
      exemplos: [],
      lugares: { capital: [], uf: [], distribuidora: [], banco: [] },
      entradas: [
        { id: "a", tipo: "pagina", titulo: "Água parcial", resumo: "", href: "/a", observatorio: "familias", colecao: "renda", situacao: "parcial", aberta: false, termos: [] },
        { id: "b", tipo: "pagina", titulo: "Água prevista", resumo: "", href: null, observatorio: "familias", colecao: "renda", situacao: "previsto", aberta: false, termos: [] },
        { id: "c", tipo: "pagina", titulo: "Água página", resumo: "", href: "/c", observatorio: "familias", colecao: "renda", situacao: "publicado", aberta: false, termos: [] },
        { id: "d", tipo: "consulta", titulo: "Água consulta", resumo: "", href: "/d", observatorio: "familias", colecao: "renda", situacao: "publicado", aberta: true, termos: [] },
      ],
    };
    expect(buscar(sintetico, "água").resultados.map((r) => r.id)).toEqual(["d", "c", "a", "b"]);
  });

  it("resultados agrupados por observatório e coleção, com o filtro de coleção", () => {
    const r = buscar(indiceDeBusca(), "conta de luz");
    expect(r.grupos.length).toBeGreaterThan(0);
    expect(emOrdemDeTela(r.grupos)).toHaveLength(r.resultados.length);
    const so = buscar(indiceDeBusca(), "PLD", { colecao: "setor-eletrico" }).resultados;
    expect(so.length).toBeGreaterThan(0);
    expect(so.every((x) => x.colecao === "setor-eletrico")).toBe(true);
  });

  it("termo sem correspondência devolve vazio, sem resultado demonstrativo", () => {
    expect(buscar(indiceDeBusca(), "xyzabc").resultados).toEqual([]);
    expect(buscar(indiceDeBusca(), "   ").resultados).toEqual([]);
  });
});

describe("selo 'com conta'", () => {
  const lista = (comSessao: boolean) => {
    const r = buscar(indiceDeBusca(), "Ideb");
    return renderToStaticMarkup(createElement(PaginaAberta, null, createElement(ListaResultados, { grupos: r.grupos, comSessao })));
  };

  it("sem sessão, todo destino fechado leva o selo e o aberto não", () => {
    const h = lista(false);
    const itens = h.split("<li").slice(1);
    const r = emOrdemDeTela(buscar(indiceDeBusca(), "Ideb").grupos);
    expect(itens).toHaveLength(r.length);
    r.forEach((x, k) => expect(itens[k].includes("data-selo-conta"), x.href ?? x.titulo).toBe(!!x.href && !x.aberta));
    // critério de aceite: o painel Educação das capitais com selo e o aperitivo da escola sem selo
    expect(r.some((x) => x.href === "/eficiencia-estatal/educacao-municipal-capitais" && !x.aberta)).toBe(true);
    expect(r.some((x) => x.href === "/educacao-municipal" && x.aberta)).toBe(true);
  });

  it("com sessão, nenhum selo", () => {
    expect(lista(true)).not.toContain("data-selo-conta");
  });

  it("página prevista aparece como texto 'ainda sem página', sem link", () => {
    const prevista = indiceDeBusca().entradas.find((e) => e.situacao === "previsto");
    expect(prevista).toBeDefined();
    const r = buscar(indiceDeBusca(), prevista!.titulo);
    const h = renderToStaticMarkup(createElement(ListaResultados, { grupos: r.grupos, comSessao: false }));
    expect(h).toContain("ainda sem página");
  });
});
