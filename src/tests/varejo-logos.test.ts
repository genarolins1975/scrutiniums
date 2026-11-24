/**
 * Contrato dos logos da coleção Varejo (public/varejo/logos, escrito por pipeline/varejo/logos.py). Invariantes, sem texto
 * literal: toda entidade do ranking, das fichas e do comparador tem entrada; cada entrada tem arquivo oficial íntegro (sha256,
 * tamanho e medidas que conferem com o arquivo), origem em https e prova de vínculo, ou ausência com motivo; nenhum SVG traz
 * script, evento, conteúdo embutido ou referência externa; o carregador só devolve o que está publicado; o componente dá a
 * placa do tom do arquivo, com medidas explícitas, e o nome em texto quando não há logo; a pasta responde com CSP restritiva e
 * segue fechada como as outras pastas de logos.
 */
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LogoEmpresa, medidasNaPlaca } from "@/components/varejo/LogoEmpresa";
import { ehRotaPublica } from "@/lib/rotasPublicas";
import { goldEmpresas } from "@/lib/varejo/dados";
import { lerManifestoLogosVarejo, logoDe, PASTA_LOGOS } from "@/lib/varejo/logos";

const raiz = process.cwd();
const pasta = join(raiz, "public", "varejo", "logos");
const m = lerManifestoLogosVarejo()!;
const curadoria = join(raiz, "pipeline", "varejo", "curadoria");
const ranking = JSON.parse(readFileSync(join(curadoria, "ranking.json"), "utf-8")) as {
  grupos: { slug: string }[];
  lideres_por_segmento: { slug?: string | null }[];
};

/** Conteúdo que a regra recusa num SVG: script, evento, embutido (inclusive data:), entidade e referência externa. */
const SVG_RECUSADO =
  /<\s*(script|foreignObject|iframe|embed|object|image)\b|<!ENTITY|<!DOCTYPE[^>]*\[|\son[a-z]+\s*=|javascript\s*:|data\s*:|(xlink:)?href\s*=\s*["']?\s*(https?:|\/\/)|@import|url\(\s*["']?\s*(https?:|\/\/)/i;

function medidasDoArquivo(bytes: Buffer, formato: string): [number, number] {
  if (formato === "png") return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
  if (formato === "webp") {
    const bloco = bytes.subarray(12, 16).toString("latin1");
    if (bloco === "VP8X") return [bytes.readUIntLE(24, 3) + 1, bytes.readUIntLE(27, 3) + 1];
    if (bloco === "VP8L") return [(bytes.readUInt32LE(21) & 0x3fff) + 1, ((bytes.readUInt32LE(21) >>> 14) & 0x3fff) + 1];
    return [bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff];
  }
  const v = /viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(bytes.toString("utf-8"))!;
  return [Number(v[1]), Number(v[2])];
}

describe("Varejo: manifesto de logos", () => {
  it("toda entidade do ranking, das fichas e do comparador tem uma entrada, sem repetição", () => {
    expect(m).toBeTruthy();
    const slugs = m.logos.map((l) => l.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const esperados = new Set<string>([
      ...ranking.grupos.map((g) => g.slug),
      ...ranking.lideres_por_segmento.flatMap((g) => (g.slug ? [g.slug] : [])),
      ...readdirSync(join(curadoria, "fichas")).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)),
      ...Object.keys(goldEmpresas().empresas),
    ]);
    expect(esperados.size).toBeGreaterThanOrEqual(28);
    for (const s of esperados) expect(slugs, s).toContain(s);
  });

  it("cada entrada tem arquivo oficial íntegro com origem e vínculo, ou ausência com motivo", () => {
    for (const l of m.logos) {
      expect(l.nome_exibicao.length, l.slug).toBeGreaterThan(1);
      if (!l.arquivo) {
        expect(l.ausencia?.motivo.length ?? 0, l.slug).toBeGreaterThan(20);
        for (const c of [l.formato, l.fundo, l.largura, l.altura, l.sha256, l.bytes, l.metodo, l.extraido_de, l.derivado_de, l.derivacao, l.vinculo_conferido_por, l.vinculo_reforco]) expect(c, l.slug).toBeNull();
        continue;
      }
      expect(l.ausencia, l.slug).toBeNull();
      expect(l.arquivo, l.slug).toBe(`${PASTA_LOGOS}${l.slug}.${l.formato}`);
      const bytes = readFileSync(join(pasta, `${l.slug}.${l.formato}`));
      expect(bytes.length, l.slug).toBe(l.bytes);
      expect(bytes.length, l.slug).toBeLessThanOrEqual(60_000);
      expect(createHash("sha256").update(bytes).digest("hex"), l.slug).toBe(l.sha256);
      // como os bytes chegaram; extração só de PNG, com a origem; recorte ou redução sempre com o sha256 do original e a caixa
      expect(["direto", "navegador", "dono"], l.slug).toContain(l.metodo);
      if (l.extraido_de) {
        expect(l.formato, l.slug).toBe("png");
        expect(l.extraido_de.url, l.slug).toBe(l.url_origem);
        expect(l.extraido_de.sha256 ?? l.extraido_de.elemento, l.slug).toBeTruthy();
        if (l.extraido_de.sha256) expect(l.extraido_de.sha256, l.slug).toMatch(/^[0-9a-f]{64}$/);
        expect(l.nota ?? "", l.slug).toMatch(/extra[ií]d/);
      }
      expect(l.derivado_de === null, l.slug).toBe(l.derivacao === null);
      if (l.derivado_de) {
        expect(l.derivado_de, l.slug).toMatch(/^[0-9a-f]{64}$/);
        expect(l.derivado_de, l.slug).not.toBe(l.sha256);
        expect(l.derivacao!.operacao.length, l.slug).toBeGreaterThan(5);
        if (l.derivacao!.caixa || l.derivacao!.largura_max) expect(l.formato, l.slug).toBe("png");
        expect(l.nota ?? "", l.slug).toMatch(/recort|reduzid|acrescent/);
      }
      // prova que o script não releu: só a transcrita pelo dono, e dita no texto do vínculo
      expect([null, "dono"], l.slug).toContain(l.vinculo_conferido_por);
      if (l.vinculo_conferido_por) expect(l.vinculo, l.slug).toMatch(/pelo dono/);
      // segunda evidência nunca substitui a principal: só existe ao lado dela e cita o trecho entre aspas
      if (l.vinculo_reforco) expect(l.vinculo_reforco, l.slug).toMatch(/"[^"]{10,}"/);
      expect(l.url_origem, l.slug).toMatch(/^https:\/\//);
      expect(l.pagina_origem, l.slug).toMatch(/^https:\/\//);
      expect(l.capturado_em, l.slug).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(["claro", "escuro"], l.slug).toContain(l.fundo);
      // a prova do vínculo cita o CNPJ da entrada ou um trecho da própria página, entre aspas
      expect(l.vinculo?.length ?? 0, l.slug).toBeGreaterThan(40);
      if (l.cnpj) {
        expect(l.cnpj, l.slug).toMatch(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/);
        // a página pode grafar o CNPJ com outra pontuação: valem os catorze dígitos, em sequência
        expect(l.vinculo!.replace(/[./-]/g, ""), l.slug).toContain(l.cnpj.replace(/\D/g, ""));
      } else {
        expect(l.vinculo, l.slug).toMatch(/"[^"]{10,}"/);
      }
    }
  });

  it("companhia aberta leva o CNPJ da gold de empresas, nunca outro", () => {
    for (const [slug, e] of Object.entries(goldEmpresas().empresas)) {
      expect(m.logos.find((l) => l.slug === slug)!.cnpj, slug).toBe(e.cnpj);
    }
  });

  it("as medidas declaradas são as do arquivo e nenhum SVG traz conteúdo ativo, embutido ou externo", () => {
    for (const l of m.logos.filter((x) => x.arquivo)) {
      const bytes = readFileSync(join(pasta, `${l.slug}.${l.formato}`));
      if (l.formato === "png") expect(bytes.subarray(0, 8).toString("latin1"), l.slug).toBe("\x89PNG\r\n\x1a\n");
      else if (l.formato === "webp") expect(bytes.subarray(0, 4).toString("latin1") + bytes.subarray(8, 12).toString("latin1"), l.slug).toBe("RIFFWEBP");
      else expect(bytes.toString("utf-8"), l.slug).not.toMatch(SVG_RECUSADO);
      expect(medidasDoArquivo(bytes, l.formato!), l.slug).toEqual([l.largura, l.altura]);
      expect(l.largura! / l.altura!, l.slug).toBeGreaterThan(0.5);
      expect(l.largura! / l.altura!, l.slug).toBeLessThan(12);
    }
  });

  it("a pasta só tem o manifesto e os arquivos que ele cita", () => {
    const citados = new Set(m.logos.flatMap((l) => (l.arquivo ? [l.arquivo.slice(PASTA_LOGOS.length)] : [])));
    for (const f of readdirSync(pasta)) if (f !== "manifesto.json") expect(citados, f).toContain(f);
    for (const f of citados) expect(existsSync(join(pasta, f)), f).toBe(true);
  });
});

describe("Varejo: carregador e componente de logo", () => {
  it("logoDe devolve o arquivo publicado com medidas e tom do fundo, e null para ausência ou slug desconhecido", () => {
    for (const l of m.logos) {
      const logo = logoDe(l.slug);
      if (!l.arquivo) {
        expect(logo, l.slug).toBeNull();
        continue;
      }
      expect(logo, l.slug).toEqual({ arquivo: l.arquivo, largura: l.largura, altura: l.altura, fundo: l.fundo, nomeExibicao: l.nome_exibicao });
    }
    expect(logoDe("empresa-que-nao-existe")).toBeNull();
    expect(logoDe("../manifesto")).toBeNull();
  });

  it("com logo: placa do tom do arquivo, medidas explícitas que cabem na placa e alt com o nome", () => {
    const placas = { p: [84, 28], m: [120, 40], g: [168, 56] } as const;
    for (const l of m.logos.filter((x) => x.arquivo)) {
      for (const tamanho of ["p", "m", "g"] as const) {
        const html = renderToStaticMarkup(createElement(LogoEmpresa, { slug: l.slug, nome: l.nome_exibicao, tamanho }));
        expect(html, l.slug).toContain(`data-logo="${l.slug}"`);
        expect(html, l.slug).toContain(`src="${l.arquivo}"`);
        expect(html.includes("bg-carvao"), l.slug).toBe(l.fundo === "escuro");
        expect(html.includes("bg-superficie"), l.slug).toBe(l.fundo === "claro");
        const w = Number(/ width="(\d+)"/.exec(html)![1]);
        const h = Number(/ height="(\d+)"/.exec(html)![1]);
        expect(w, l.slug).toBeGreaterThan(0);
        expect(w, l.slug).toBeLessThan(placas[tamanho][0]);
        expect(h, l.slug).toBeGreaterThan(0);
        expect(h, l.slug).toBeLessThan(placas[tamanho][1]);
        expect(Math.abs(w / h - l.largura! / l.altura!) / (l.largura! / l.altura!), l.slug).toBeLessThan(0.12); // proporção preservada
        expect(/ alt="[^"]+"/.test(html), l.slug).toBe(true);
        expect(html, l.slug).not.toMatch(/undefined|NaN/);
      }
    }
    expect(medidasNaPlaca(400, 100, "m")).toEqual({ width: 102, height: 26 });
    expect(medidasNaPlaca(100, 100, "p")).toEqual({ width: 18, height: 18 });
  });

  it("sem logo: o nome em texto, sem imagem; decorativo não repete o nome que já está ao lado", () => {
    const ausentes = m.logos.filter((x) => !x.arquivo);
    expect(ausentes.length).toBeGreaterThan(0);
    for (const l of ausentes) {
      const html = renderToStaticMarkup(createElement(LogoEmpresa, { slug: l.slug, nome: "Nome <de> teste" }));
      expect(html, l.slug).toContain("Nome &lt;de&gt; teste");
      expect(html, l.slug).not.toContain("<img");
      expect(renderToStaticMarkup(createElement(LogoEmpresa, { slug: l.slug, nome: "Nome", decorativo: true })), l.slug).toBe("");
    }
    const comLogo = m.logos.find((x) => x.arquivo)!;
    expect(renderToStaticMarkup(createElement(LogoEmpresa, { slug: comLogo.slug, nome: "Nome", decorativo: true }))).toContain('alt=""');
  });

  it("a pasta responde com a mesma CSP das outras pastas de logos e segue fechada como elas", () => {
    const cfg = readFileSync(join(raiz, "next.config.mjs"), "utf-8");
    const regra = (dominio: string) => cfg.split("\n").find((linha) => linha.includes(`source: "/${dominio}/logos/:path*"`))!;
    expect(regra("varejo")).toBeTruthy();
    expect(regra("varejo").replace("/varejo/", "/energia/")).toBe(regra("energia"));
    const comLogo = m.logos.find((x) => x.arquivo)!;
    expect(ehRotaPublica(comLogo.arquivo!)).toBe(ehRotaPublica("/energia/logos/alup11.png"));
    expect(ehRotaPublica(`${PASTA_LOGOS}manifesto.json`)).toBe(ehRotaPublica("/energia/logos/manifesto.json"));
  });
});
