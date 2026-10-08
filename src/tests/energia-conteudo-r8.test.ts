/* Trabalho de conteúdo depois da r7: respostas em duas camadas (veredito em palavras simples sempre à vista e os
 * números por trás só em Analisar e Auditar), identificadores técnicos fora de Entender e números conciliados no
 * ponto de uso. Os vereditos são derivados dos mesmos campos das respostas completas, não repetem a fórmula. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import DatasetPage, { generateStaticParams as paramsDatasets } from "@/app/setor-eletrico/dados/[dataset]/page";
import PaginaEmpresas from "@/app/setor-eletrico/empresas/page";
import PaginaInclusao from "@/app/setor-eletrico/inclusao-energetica/page";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { conjuntoLegivel } from "@/lib/energia/evidencia";
import * as R from "@/lib/energia/rede";
import type { GoldRedeDetalhe } from "@/lib/energia/tipos-rede";

const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
const palavras = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
const numeros = (t: string) => (t.match(/\d[\d.,]*\d|\d/g) ?? []).length;
const G = JSON.parse(ler("public/energia/gold/rede_detalhe.json")) as GoldRedeDetalhe;

describe("RespostaCurta: veredito à vista, números por trás em Analisar", () => {
  const html = renderToStaticMarkup(createElement(RespostaCurta, { id: "p999", veredito: "O preço subiu.", vivo: true }, "Detalhe com 12 números."));

  it("o elemento externo leva data-resposta e é região viva só quando pedido", () => {
    expect(html).toMatch(/^<div data-resposta="p999" aria-live="polite"/);
    expect(renderToStaticMarkup(createElement(RespostaCurta, { id: "x", veredito: "v" }, "d"))).not.toContain("aria-live");
  });

  it("o veredito fica fora do bloco de Analisar e o detalhe dentro, com rótulo", () => {
    const fim = html.indexOf('data-nivel="analisar"');
    expect(fim).toBeGreaterThan(0);
    expect(html.slice(0, fim)).toContain("O preço subiu.");
    expect(html.slice(fim)).toContain("Os números por trás da resposta");
    expect(html.slice(fim)).toContain("Detalhe com 12 números.");
    expect(html.slice(0, fim)).not.toContain("Detalhe com 12 números.");
  });

  it("aceita outro atributo de resposta (filtros, ano, ficha)", () => {
    expect(renderToStaticMarkup(createElement(RespostaCurta, { id: "2025", atributo: "data-resposta-ano", veredito: "v" }, "d"))).toContain('data-resposta-ano="2025"');
  });
});

describe("Rede, balanço e exterior (P029): veredito", () => {
  const per = { inicio: G.cobertura.inicio, fim: G.cobertura.fim };

  it("em cada região o veredito é curto, tem poucos números e não perde a ressalva sobre a causa dos resíduos", () => {
    for (const sm of ["SIN", "SE", "S", "NE", "N"] as const) {
      const v = R.vereditoBalanco(G.balanco, sm, per);
      expect(v.length, sm).toBeGreaterThan(0);
      expect(palavras(v), sm).toBeLessThanOrEqual(50);
      expect(numeros(v), sm).toBeLessThanOrEqual(8);
      const completa = R.respostaBalanco(G.balanco, sm, per);
      expect(palavras(v), sm).toBeLessThan(palavras(completa));
      if (/A fonte não informa a causa dos resíduos/.test(completa)) expect(v, sm).toContain("não atribui causa");
    }
  });

  it("não diz 'todas as horas' quando há resíduo", () => {
    const comResiduo = (["SIN", "SE", "S", "NE", "N"] as const).filter((sm) => /residuo|resíduo/.test(R.respostaBalanco(G.balanco, sm, per)) && /A fonte não informa/.test(R.respostaBalanco(G.balanco, sm, per)));
    for (const sm of comResiduo) expect(R.vereditoBalanco(G.balanco, sm, per), sm).not.toContain("em todas as horas");
  });
});

describe("Fonte das fichas de evidência: código de conjunto fora do texto de Entender", () => {
  it("troca o código pelo nome legível e guarda o código para Analisar", () => {
    expect(conjuntoLegivel("PLD_HORARIO")).toEqual({ texto: "PLD horário por submercado", codigos: ["PLD_HORARIO"] });
    expect(conjuntoLegivel("PLD_HORARIO (PLD horário por submercado)")).toEqual({ texto: "PLD horário por submercado", codigos: ["PLD_HORARIO"] });
    expect(conjuntoLegivel("mre_mensal")).toEqual({ texto: "MRE mensal", codigos: ["mre_mensal"] });
    expect(conjuntoLegivel("GERACAO_SUBMERCADO e MRE_MENSAL")).toEqual({ texto: "geração por submercado e MRE mensal", codigos: ["GERACAO_SUBMERCADO", "MRE_MENSAL"] });
    expect(conjuntoLegivel("PARCELA_CARGA_CONSUMO (classe do perfil pelo cadastro LISTA_PERFIL_V1)").texto).toBe("classe do perfil pelo cadastro lista de perfis (versão 1)");
  });

  it("trata cada item separado por ponto e vírgula e preserva nomes que já são legíveis", () => {
    const r = conjuntoLegivel("PLD_HORARIO; Balanço de Energia nos Subsistemas");
    expect(r.texto).toBe("PLD horário por submercado; Balanço de Energia nos Subsistemas");
    expect(r.codigos).toEqual(["PLD_HORARIO"]);
    expect(conjuntoLegivel("EAR Diário por Subsistema")).toEqual({ texto: "EAR Diário por Subsistema", codigos: [] });
    expect(conjuntoLegivel("PRORET")).toEqual({ texto: "PRORET", codigos: [] });
  });
});

describe("Segunda camada da resposta: toda página que a usa tem o seletor de profundidade", () => {
  it.each([
    ["Empresas", PaginaEmpresas],
    ["Inclusão energética", PaginaInclusao],
  ])("%s: a síntese envolve as respostas em modo-profundidade, senão a segunda camada ficaria à vista em Entender", (_nome, Pagina) => {
    const h = renderToStaticMarkup(createElement(Pagina as () => JSX.Element));
    expect(h).toContain("Os números por trás da resposta");
    expect(h).toContain("modo-profundidade");
    expect(h.indexOf("modo-profundidade")).toBeLessThan(h.indexOf("Os números por trás da resposta"));
  });
});

/** Filhos diretos de cada <dl>: só <dt>, <dd> ou <div> que contenha apenas <dt> e <dd> (regra definition-list do axe). */
function dlInvalidos(html: string): string[] {
  const erros: string[] = [];
  const pilha: { tag: string; ehDl: boolean; dentroDeDivDeDl: boolean }[] = [];
  const vazios = new Set(["br", "hr", "img", "input", "meta", "link", "source", "wbr", "col"]);
  for (const m of Array.from(html.matchAll(/<(\/)?([a-z][a-z0-9]*)\b[^>]*?(\/)?>/g))) {
    const [, fecha, tag, auto] = m;
    if (fecha) {
      while (pilha.length && pilha[pilha.length - 1].tag !== tag) pilha.pop();
      pilha.pop();
      continue;
    }
    const pai = pilha[pilha.length - 1];
    if (pai?.ehDl && !["dt", "dd", "div", "script", "template"].includes(tag)) erros.push(`<${tag}> filho direto de <dl>`);
    if (pai?.dentroDeDivDeDl && !["dt", "dd"].includes(tag)) erros.push(`<${tag}> dentro de <div> de <dl>`);
    if (auto || vazios.has(tag)) continue;
    pilha.push({ tag, ehDl: tag === "dl", dentroDeDivDeDl: tag === "div" && !!pai?.ehDl });
  }
  return erros;
}

describe("Ficha de conjunto de dados: listas de definição válidas (axe definition-list)", () => {
  it("nenhuma das fichas tem filho inválido dentro de <dl>", () => {
    const todas = paramsDatasets().map((x: { dataset: string }) => x.dataset);
    expect(todas.length).toBeGreaterThan(50);
    const ruins: string[] = [];
    for (const dataset of todas) {
      const e = dlInvalidos(renderToStaticMarkup(createElement(DatasetPage, { params: { dataset } })));
      if (e.length) ruins.push(`${dataset}: ${Array.from(new Set(e)).join("; ")}`);
    }
    expect(ruins).toEqual([]);
  });
});

describe("TabelaInterativa: coluna com nível mínimo de profundidade", () => {
  const colunas = [
    { id: "nome", rotulo: "Registro", tipo: "texto" as const },
    { id: "valor", rotulo: "Valor", tipo: "numero" as const, casas: 1 },
    { id: "hash", rotulo: "Impressão digital", tipo: "texto" as const, nivel: "auditar" as const },
    { id: "cod", rotulo: "Código", tipo: "texto" as const, nivel: "analisar" as const },
  ];
  const linhas = [{ id: "a", nome: "B0 W1 SE", valor: 12.34, hash: "ab12", cod: "X_Y" }];
  const h = renderToStaticMarkup(createElement(TabelaInterativa, { titulo: "Teste de coluna por nível", colunas, linhas, chaveLinha: "id", fonte: "Teste", versao: "v1", nomeArquivo: "teste" }));

  it("marca cabeçalho e célula com o nível, e deixa as demais colunas sem marca", () => {
    expect(h).toMatch(/<th[^>]*data-nivel="auditar"[^>]*>[\s\S]*?Impressão digital/);
    expect(h).toMatch(/<td[^>]*data-nivel="auditar"[^>]*>ab12/);
    expect(h).toMatch(/<td[^>]*data-nivel="analisar"[^>]*>X_Y/);
    expect(h).not.toMatch(/<th[^>]*data-nivel="[a-z]+"[^>]*>[\s\S]{0,400}?Valor/);
  });

  it("a coluna continua no HTML (busca, impressão e leitura sem JavaScript) e a regra de CSS a esconde só em Entender", () => {
    expect(h).toContain("ab12");
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf-8");
    expect(css).toMatch(/\[data-modo="entender"\] \[data-nivel="analisar"\]/);
    expect(css).toMatch(/\[data-modo="analisar"\] \[data-nivel="auditar"\]/);
  });
});
