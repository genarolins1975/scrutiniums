import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "parse5";
import { describe, expect, it } from "vitest";
import { ehPaginaAberta } from "@/components/acesso/sessao";
import { distribuidorasDoMunicipio, simular } from "@/lib/energia/conta";
import { idiomaDoCaminhoEnergia } from "@/lib/energia/idioma";
import type { ContaGold } from "@/lib/energia/tipos-conta";
import { parDeIdioma } from "@/lib/i18n-rotas";
import { attr, elementos, links, meta, tag, texto, type No } from "./suporte/i18n-dom";
import { diferencaMulticonjunto, numerosNormalizados, vazamentosEnergia } from "./suporte/i18n-energia";

/**
 * Versão aperitivo da Conta de luz (princípio do aperitivo, decisão do dono de 20/10/2026): servida sem sessão, por rewrite, em
 * /setor-eletrico/conta-de-luz e na irmã /en. Mostra só a pergunta da cidade, a estimativa sem tributos da distribuidora escolhida,
 * a bandeira, a data da tarifa, a fonte e a ressalva, e fecha com o convite ao painel completo. O head e os links são do endereço
 * público: o caminho interno nunca aparece como canonical nem como link.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const PAGINA = "src/app/aperitivo/conta-de-luz/page.tsx";
const COMPONENTE = "src/components/energia/ContaLuzNaMinhaCidade.tsx";
const PUBLICA = "/setor-eletrico/conta-de-luz";

describe("Conta de luz, versão aperitivo: código", () => {
  it("é estática, tem a irmã inglesa e o idioma vem do caminho interno e do público", () => {
    expect(ler(PAGINA)).toMatch(/export const dynamic = "force-static"/);
    const en = ler("src/app/en/aperitivo/conta-de-luz/page.tsx");
    expect(en).toMatch(/export \{ default, generateMetadata \} from "@\/app\/aperitivo\/conta-de-luz\/page"/);
    expect(en).toMatch(/export const dynamic = "force-static"/);
    expect(idiomaDoCaminhoEnergia("/en/aperitivo/conta-de-luz")).toBe("en");
    expect(idiomaDoCaminhoEnergia("/en/setor-eletrico/conta-de-luz")).toBe("en");
    expect(idiomaDoCaminhoEnergia("/aperitivo/conta-de-luz")).toBe("pt");
    expect(idiomaDoCaminhoEnergia("/en/aperitivo/outra")).toBe("pt");
    expect(parDeIdioma("/aperitivo/conta-de-luz")?.conteudo).toBe("traduzido");
  });

  it("pelo caminho, o interno é aberto e o público é o painel completo; a versão aperitivo se declara aberta pelo layout", () => {
    expect(ehPaginaAberta("/aperitivo/conta-de-luz")).toBe(true);
    expect(ehPaginaAberta("/en/aperitivo/conta-de-luz")).toBe(true);
    // no navegador, o endereço público serve o aperitivo (marcado por src/app/aperitivo/layout.tsx) ou o painel completo
    expect(ehPaginaAberta("/setor-eletrico/conta-de-luz")).toBe(false);
    expect(ehPaginaAberta("/setor-eletrico/geracao")).toBe(false);
    expect(ler("src/app/aperitivo/layout.tsx")).toMatch(/<PaginaAberta>\{children\}<\/PaginaAberta>/);
    expect(ler("src/app/en/aperitivo/layout.tsx")).toMatch(/<PaginaAberta>\{children\}<\/PaginaAberta>/);
  });

  it("fecha com o convite no endereço público e o cabeçalho com selo; nada do painel completo entra", () => {
    const fonte = ler(PAGINA);
    expect(fonte).toMatch(/<ConviteAperitivo rota=\{rota\} comConta=/);
    expect(fonte).toMatch(/const ROTA_PUBLICA = "\/setor-eletrico\/conta-de-luz"/);
    // Iniciativa 2: a barra comum com a navegação da coleção (o selo "com conta" vem do próprio link numa página aberta) e o
    // rodapé da coleção com a marca do FGV CERI
    expect(fonte).toContain('<CabecalhoPlataforma colecao="energia" destinoConta="/setor-eletrico" navegacao="setor-eletrico" idiomas />');
    expect(fonte).toContain('<RodapeColecao colecao="setor-eletrico" />');
    expect(fonte).toMatch(/canonical: ROTA_PUBLICA/);
    const tudo = fonte + ler(COMPONENTE);
    for (const proibido of [
      "ContaTarifas", "ContaFaixa", "ContaComposicao", "ContaSerieReal", "ContaHistorico", "ContaSimulador", "ContaReajustes",
      "ContaBandeiras", "ContaTabelaSobDemanda", "GraficoLinhas", "Auditoria", "downloads.map", "ROTA_REAJUSTES", "AvisoConsultaAberta",
    ]) {
      expect(tudo, proibido).not.toContain(proibido);
    }
    // a estimativa sai da função do simulador completo, não de uma regra reescrita
    expect(ler(COMPONENTE)).toMatch(/simular\(\{ residencial: \[dist\[4\], dist\[5\]\] \}, CLASSE, kwh, LIGACAO, adicional, regras, idioma\)/);
  });

  it("regra de vínculo do município: o sem confirmação só entra quando não há outro", () => {
    const v = (cnpj: string, estado: 0 | 1 | 2) => ({ cnpj, sigla: cnpj, estado });
    expect(distribuidorasDoMunicipio({ nome: "A", uf: "PE", vinculos: [v("1", 0), v("2", 1)] }).map((x) => x.cnpj)).toEqual(["2"]);
    expect(distribuidorasDoMunicipio({ nome: "A", uf: "PE", vinculos: [v("1", 0)] }).map((x) => x.cnpj)).toEqual(["1"]);
    expect(distribuidorasDoMunicipio({ nome: "A", uf: "PE", vinculos: [v("1", 1), v("2", 2)] }).map((x) => x.cnpj)).toEqual(["1", "2"]);
  });

  it("com só a tarifa residencial, reproduz os casos residenciais monofásicos que o pipeline calculou", () => {
    const g = JSON.parse(ler("public/energia/gold/conta.json")) as ContaGold;
    if (!g.disponivel) return;
    const sim = g.simulador;
    const ref = sim.distribuidoras.find((d) => d.cnpj === sim.casos_referencia.cnpj);
    expect(ref).toBeDefined();
    const casos = sim.casos_referencia.casos.filter(([classe, , ligacao, , total]) => classe === "residencial" && ligacao === "monofasico" && total !== null);
    expect(casos.length).toBeGreaterThan(0);
    for (const [, kwh, ligacao, bandeira, total] of casos) {
      const adicional = sim.bandeiras.find((b) => b.bandeira === bandeira)?.rs_mwh ?? null;
      const r = simular({ residencial: ref!.tarifas.residencial }, "residencial", kwh, ligacao, adicional, sim.regras, "pt");
      expect(r.disponivel).toBe(true);
      if (r.disponivel) expect(r.total, `${kwh} kWh, ${bandeira}`).toBeCloseTo(total as number, 2);
    }
  });
});

const BUILD = join(process.cwd(), ".next");
const APP = join(BUILD, "server", "app");
const EXIGIR = process.env.EXIGIR_BUILD_HTML === "1";
const temBuild = existsSync(join(BUILD, "prerender-manifest.json"));
const BASE = "https://scrutiniums.com";

function documento(caminho: string): { doc: No; html: string } {
  const arquivo = join(APP, `${caminho}.html`);
  expect(existsSync(arquivo), `HTML ausente: ${caminho}`).toBe(true);
  const html = readFileSync(arquivo, "utf8");
  return { doc: parse(html), html };
}

describe.skipIf(!temBuild && !EXIGIR)("Conta de luz, versão aperitivo: HTML gerado", () => {
  const carregar = () => ({ pt: documento("/aperitivo/conta-de-luz"), en: documento("/en/aperitivo/conta-de-luz") });

  it("head do endereço público nos dois idiomas", () => {
    const { pt, en } = carregar();
    expect(attr(tag(pt.doc, "html"), "lang")).toBe("pt-BR");
    expect(attr(tag(en.doc, "html"), "lang")).toBe("en");
    expect(links(pt.doc, "canonical").map((e) => attr(e, "href"))).toEqual([BASE + PUBLICA]);
    expect(links(en.doc, "canonical").map((e) => attr(e, "href"))).toEqual([BASE + "/en" + PUBLICA]);
    const alternates = [["en", BASE + "/en" + PUBLICA], ["pt-BR", BASE + PUBLICA], ["x-default", BASE + PUBLICA]];
    for (const { doc } of [pt, en]) {
      expect(links(doc, "alternate").filter((e) => attr(e, "hreflang") !== undefined).map((e) => [attr(e, "hreflang"), attr(e, "href")]).sort()).toEqual(alternates);
    }
    expect(meta(en.doc, "og:locale")).toEqual(["en_US"]);
    expect(meta(en.doc, "og:url")).toEqual([BASE + "/en" + PUBLICA]);
  });

  it("nenhum link para o caminho interno; convite, ressalva e selo presentes", () => {
    const { pt, en } = carregar();
    for (const { doc } of [pt, en]) {
      const hrefs = elementos(doc).map((e) => attr(e, "href")).filter((h): h is string => !!h);
      expect(hrefs.filter((h) => /\/aperitivo(\/|$)/.test(h))).toEqual([]);
      expect(elementos(doc).some((e) => attr(e, "data-convite-aperitivo") !== undefined)).toBe(true);
      expect(elementos(doc).some((e) => attr(e, "data-ressalva-aperitivo") !== undefined)).toBe(true);
      expect(elementos(doc).some((e) => attr(e, "data-selo-conta") !== undefined)).toBe(true);
    }
    expect(texto(tag(pt.doc, "body"))).toContain("Quanto custa a conta de luz na minha cidade?");
    expect(texto(tag(en.doc, "body"))).toContain("How much does the electricity bill cost in my city?");
  });

  it("nenhum português sem marca no inglês, nenhum inglês no português, mesmos números", () => {
    const { pt, en } = carregar();
    const v = vazamentosEnergia(pt.doc, en.doc);
    expect(v.pt).toEqual([]);
    expect([...new Set(v.en)]).toEqual([]);
    expect(diferencaMulticonjunto(numerosNormalizados(tag(pt.doc, "body")), numerosNormalizados(tag(en.doc, "body")))).toEqual({ soEmA: [], soEmB: [] });
  });
});
