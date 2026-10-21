import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SeloComConta } from "@/components/acesso/SeloComConta";
import { ExportacaoComConta } from "@/components/acesso/ExportacaoComConta";
import { AvisoConsultaAberta } from "@/components/acesso/AvisoConsultaAberta";
import { PaginaAberta } from "@/components/acesso/PaginaAberta";

/**
 * Estratégia "aberto e com conta", leva 1 (decisão do dono de 19/10/2026, docs/BANCA_2026-10-19.md): nas cinco
 * consultas abertas, o visitante vê antes do clique o que exige conta (selo "com conta"), a exportação montada no
 * navegador sai da versão aberta e a faixa diz o que fica com a conta gratuita.
 */
const caminho = vi.hoisted(() => ({ atual: "/" }));
vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<typeof import("next/navigation")>("next/navigation")),
  usePathname: () => caminho.atual,
}));

const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");


const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
/** Na versão aperitivo, servida no endereço público do tema: o layout de src/app/aperitivo declara a página aberta. */
const aberta = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(createElement(PaginaAberta, null, el));

describe("selo com conta", () => {
  beforeEach(() => {
    caminho.atual = "/";
  });

  it("aparece na página aberta para destino fechado, e só nele", () => {
    caminho.atual = "/saneamento/municipio";
    expect(aberta(createElement(SeloComConta, { href: "/saneamento/comparar?m=2611606" }))).toContain("com conta");
    expect(aberta(createElement(SeloComConta, { href: "/gas/series/preco-glp-por-uf.csv" }))).toContain("com conta");
    // a ficha completa e o simulador da conta de água pedem conta desde 20/10/2026 (princípio do aperitivo)
    expect(aberta(createElement(SeloComConta, { href: "/saneamento/municipio/2611606" }))).toContain("com conta");
    expect(aberta(createElement(SeloComConta, { href: "/saneamento/preco-regulado/simulador?t=x" }))).toContain("com conta");
    expect(aberta(createElement(SeloComConta, { href: "/saneamento/municipio?ibge=2611606" }))).toBe("");
    // no mesmo endereço, sem a marca da versão aperitivo, é o painel completo de quem tem conta: sem selo
    expect(html(createElement(SeloComConta, { href: "/saneamento/comparar?m=2611606" }))).toBe("");
    // página aberta que já é o aperitivo (sem versão separada): o caminho basta
    caminho.atual = "/combustiveis/no-meu-estado";
    expect(html(createElement(SeloComConta, { href: "/combustiveis" }))).toContain("com conta");
    expect(html(createElement(SeloComConta, { href: "/saneamento/metodologia" }))).toBe("");
    expect(html(createElement(SeloComConta, { sempre: true }))).toContain("com conta");
  });

  it("não aparece nas páginas fechadas, onde todos já têm sessão", () => {
    for (const p of ["/saneamento/acesso", "/setor-eletrico/conta-de-luz/reajustes-e-subsidios", "/gas-natural/dados"]) {
      caminho.atual = p;
      expect(html(createElement(SeloComConta, { href: "/gas/series/preco-glp-por-uf.csv" })), p).toBe("");
    }
  });

  it("fala inglês na irmã inglesa da Conta de luz", () => {
    caminho.atual = "/en/setor-eletrico/conta-de-luz";
    const h = aberta(createElement(SeloComConta, { href: "/setor-eletrico/conta-de-luz/reajustes-e-subsidios" }));
    expect(h).toContain("account required");
    expect(h).not.toContain("com conta");
  });
});

describe("exportação montada no navegador", () => {
  it("sai da versão aberta: no HTML do servidor fica o convite para entrar, com o retorno à página", () => {
    caminho.atual = "/gas-natural/gas-de-cozinha";
    const h = aberta(createElement(ExportacaoComConta, { rotulo: "Baixar CSV" }, createElement("button", { type: "button" }, "exportar")));
    expect(h).not.toContain("<button");
    expect(h).toContain('href="/entrar?de=%2Fgas-natural%2Fgas-de-cozinha"');
    expect(h).toContain("com conta");
  });

  it("segue igual nas páginas fechadas", () => {
    caminho.atual = "/setor-eletrico/conta-de-luz/reajustes-e-subsidios";
    const h = html(createElement(ExportacaoComConta, { rotulo: "Baixar CSV" }, createElement("button", { type: "button" }, "exportar")));
    expect(h).toBe('<button type="button">exportar</button>');
  });

  it("as tabelas e o simulador passam pela guarda; a entrada da Eficiência Estatal não gera mais CSV no navegador", () => {
    for (const p of ["src/components/energia/TabelaInterativa.tsx", "src/components/energia/ListaConsultavel.tsx", "src/components/saneamento/SimuladorConta.tsx"]) {
      expect(ler(p), p).toMatch(/<ExportacaoComConta[\s\S]*onClick=\{\(\) => exportar\(f\)\}|<ExportacaoComConta[\s\S]*onClick=\{exportar\}/);
    }
    const atlas = ler("src/components/eficiencia/AtlasCidadao.tsx");
    expect(atlas).not.toMatch(/createObjectURL|new Blob|csv\(/);
    expect(atlas).toContain("'/eficiencia-estatal/retrato-26-capitais.csv'");
  });
});

describe("CSV das 26 capitais", () => {
  it("sai do servidor, numa rota fechada, com o mesmo conteúdo que a entrada gerava", async () => {
    const { ehRotaPublica } = await import("@/lib/rotasPublicas");
    expect(ehRotaPublica("/eficiencia-estatal/retrato-26-capitais.csv")).toBe(false);
    const { GET } = await import("@/app/eficiencia-estatal/retrato-26-capitais.csv/route");
    const { montarRetrato } = await import("@/lib/eficiencia/entrada");
    const { csv } = await import("@/lib/eficiencia/entrada-nucleo");
    const r = GET();
    expect(r.headers.get("content-type")).toMatch(/^text\/csv/);
    expect(r.headers.get("content-disposition")).toContain("obee-retrato-26-capitais.csv");
    // com a marca de ordem de bytes, que o Excel usa para ler UTF-8 (Response.text() a descartaria)
    const texto = new TextDecoder("utf-8", { ignoreBOM: true }).decode(await r.arrayBuffer());
    expect(texto).toBe("﻿" + csv(montarRetrato()));
    expect(texto.trim().split("\r\n")).toHaveLength(27);
  });

  it("o retrato que vai ao HTML aberto não leva a nota composta nem os cenários do índice", async () => {
    const { montarRetrato } = await import("@/lib/eficiencia/entrada");
    const json = JSON.stringify(montarRetrato());
    for (const campo of ['"score"', '"band"', '"contributions"', '"sensitivity"', '"scenario_scores"', '"weights"']) expect(json, campo).not.toContain(campo);
  });
});

describe("faixa da consulta aberta", () => {
  it("diz o que fica com conta e leva ao login com retorno à página", () => {
    caminho.atual = "/gas-natural/gas-de-cozinha";
    const h = html(createElement(AvisoConsultaAberta, { comConta: "Os arquivos para baixar" }));
    expect(h).toContain("Consulta aberta, sem conta.");
    expect(h).toContain("Os arquivos para baixar");
    expect(h).toContain('href="/entrar?de=%2Fgas-natural%2Fgas-de-cozinha"');
  });

  it("está nas cinco consultas, e só nelas", () => {
    const paginas = [
      "src/app/setor-eletrico/conta-de-luz/page.tsx",
      "src/app/saneamento/municipio/page.tsx",
      "src/app/saneamento/municipio/[id]/page.tsx",
      "src/app/saneamento/preco-regulado/simulador/page.tsx",
      "src/app/eficiencia-estatal/page.tsx",
      "src/app/gas-natural/gas-de-cozinha/page.tsx",
    ];
    for (const p of paginas) expect(ler(p), p).toContain("<AvisoConsultaAberta");
    expect(ler("src/app/setor-eletrico/conta-de-luz/reajustes-e-subsidios/page.tsx")).not.toContain("AvisoConsultaAberta");
  });
});

describe("convite ao login leva o recorte da consulta na volta", () => {
  it("o clique monta o destino com query e âncora, e respeita abrir em nova aba", async () => {
    const { aoEntrarComRecorte } = await import("@/components/acesso/sessao");
    const indo: string[] = [];
    const original = (globalThis as { window?: unknown }).window;
    (globalThis as { window?: unknown }).window = {
      location: { pathname: "/eficiencia-estatal", search: "?territorio=2611606&comparador=4106902", hash: "#perguntas", assign: (u: string) => indo.push(u) },
    };
    try {
      let impedido = false;
      aoEntrarComRecorte({ metaKey: false, ctrlKey: false, shiftKey: false, button: 0, preventDefault: () => { impedido = true; } });
      expect(impedido).toBe(true);
      expect(indo).toEqual([`/entrar?de=${encodeURIComponent("/eficiencia-estatal?territorio=2611606&comparador=4106902#perguntas")}`]);
      impedido = false;
      aoEntrarComRecorte({ metaKey: true, ctrlKey: false, shiftKey: false, button: 0, preventDefault: () => { impedido = true; } });
      expect(impedido).toBe(false);
      expect(indo).toHaveLength(1);
    } finally {
      (globalThis as { window?: unknown }).window = original;
    }
  });

  it("o convite do aperitivo leva o recorte da janela no caminho da rota pública (achado do Codex)", async () => {
    const { aoEntrarComRecorteEm, destinoComRecorte } = await import("@/components/acesso/sessao");
    // a query da janela vence; sem query na janela, vale a da rota; a âncora vem sempre da janela
    expect(destinoComRecorte("/eficiencia-estatal", { search: "?territorio=1302603", hash: "" })).toBe("/eficiencia-estatal?territorio=1302603");
    expect(destinoComRecorte("/saneamento/municipio?ibge=3550308", { search: "", hash: "#conteudo" })).toBe("/saneamento/municipio?ibge=3550308#conteudo");
    expect(destinoComRecorte("/gas-natural/gas-de-cozinha", { search: "?uf=SP", hash: "" })).toBe("/gas-natural/gas-de-cozinha?uf=SP");
    expect(destinoComRecorte("/combustiveis/no-meu-estado", { search: "", hash: "" })).toBe("/combustiveis/no-meu-estado");

    const indo: string[] = [];
    const original = (globalThis as { window?: unknown }).window;
    // a janela pode estar no caminho interno da versão aperitivo: o caminho do destino vem sempre da rota pública
    (globalThis as { window?: unknown }).window = {
      location: { pathname: "/aperitivo/gas-de-cozinha", search: "?uf=SP", hash: "", assign: (u: string) => indo.push(u) },
    };
    try {
      const clicar = aoEntrarComRecorteEm("/gas-natural/gas-de-cozinha");
      let impedido = false;
      clicar({ metaKey: false, ctrlKey: false, shiftKey: false, button: 0, preventDefault: () => { impedido = true; } });
      expect(impedido).toBe(true);
      expect(indo).toEqual([`/entrar?de=${encodeURIComponent("/gas-natural/gas-de-cozinha?uf=SP")}`]);
      // nova aba, botão do meio: o navegador segue o href do HTML, sem o recorte
      for (const tecla of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { button: 1 }]) {
        impedido = false;
        clicar({ metaKey: false, ctrlKey: false, shiftKey: false, button: 0, ...tecla, preventDefault: () => { impedido = true; } });
        expect(impedido).toBe(false);
      }
      expect(indo).toHaveLength(1);
      // na irmã inglesa, a entrada inglesa
      aoEntrarComRecorteEm("/en/setor-eletrico/conta-de-luz")({ metaKey: false, ctrlKey: false, shiftKey: false, button: 0, preventDefault: () => {} });
      expect(indo[1]).toBe(`/en/entrar?de=${encodeURIComponent("/en/setor-eletrico/conta-de-luz?uf=SP")}`);
    } finally {
      (globalThis as { window?: unknown }).window = original;
    }
  });

  it("o convite do aperitivo mantém o href sem JavaScript e liga o clique só para quem não tem sessão", () => {
    const fonte = ler("src/components/acesso/ConviteAperitivo.tsx");
    expect(fonte).toContain("href={logado ? rota : hrefEntrar(rota)}");
    expect(fonte).toContain("onClick={logado ? undefined : aoEntrarComRecorteEm(rota)}");
  });
});
