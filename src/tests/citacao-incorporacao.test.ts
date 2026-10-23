import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { INDICADORES } from "@/lib/dadosPublicos";
import { alvoEmbed, citacao, codigoIncorporar } from "@/lib/citacao";

/**
 * Frente 4: citação e incorporação. O que se trava:
 * - todo rodapé de gráfico da SPA tem "Copiar citação" e "Incorporar";
 * - cada indicador público tem citação com os invariantes da casa e um iframe do
 *   embed.html que aponta para um cartão que existe na SPA, com crédito e volta;
 * - imagem social por página de indicador e summary_large_image na plataforma;
 * - API pública documentada com contrato versionado, CORS aberto e catálogo íntegro;
 * - depósito no Zenodo preparado sem nenhuma chamada de publicação.
 */
const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
const app = ler("public/obs/app.js");

describe("citação dos indicadores", () => {
  it("leva título, fonte com série, referência, natureza, processamento, URL e acesso", () => {
    const c = citacao(
      { titulo: "Inadimplência do crédito no Brasil", fonte: "BCB/SGS", serie: "21082", referencia: "jul/2026", natureza: "dado observado", processadoEm: "2026-09-24T15:25:15+00:00", caminho: "/dados/inadimplencia" },
      new Date(2026, 9, 13),
    );
    expect(c).toBe(
      "Inadimplência do crédito no Brasil. In: Crédito e sistema financeiro. Scrutiniums, 2026. Fonte primária: BCB/SGS, série 21082. " +
        "Referência: jul/2026. Natureza: dado observado. Processado em 2026-09-24. Disponível em: https://scrutiniums.com/dados/inadimplencia. Acesso em: 13/10/2026.",
    );
  });

  it("todo indicador público incorpora um cartão que existe na SPA, com o segmento certo", () => {
    expect(app).toContain('`<div class="card" id="pu-${c.key}">');
    expect(app).toContain('`<div class="card" id="pu-${k}">');
    expect(app).toContain('<div class="card" id="ov-ibcc">');
    const cartoesPulso = Array.from(app.matchAll(/\{ key: "(\w+)", title:/g)).map((m) => m[1]);
    const extras = (app.match(/\["credito_pib", "endividamento", "comprometimento"\]/) ? ["credito_pib", "endividamento", "comprometimento"] : []);
    for (const i of INDICADORES) {
      const alvo = alvoEmbed(i.key);
      const m = alvo.match(/^g=pulse\.pu-(\w+)(?:&seg=(\w+))?$/);
      expect(m, i.slug).toBeTruthy();
      expect([...cartoesPulso, ...extras], i.slug).toContain(m![1]);
      if (m![2]) expect(i.key).toBe(`${m![1]}_${m![2]}`);
    }
    expect(alvoEmbed("ibcc")).toBe("g=overview.ov-ibcc&seg=total");
  });

  it("o código de incorporar é o iframe do embed.html com crédito e link de volta", () => {
    const html = codigoIncorporar("inad_pf", "Inadimplência das famílias", "/dados/inadimplencia-familias");
    expect(html).toMatch(/^<iframe src="https:\/\/scrutiniums\.com\/obs\/embed\.html\?g=pulse\.pu-inad&amp;seg=pf"/);
    expect(html).toContain('<a href="https://scrutiniums.com/dados/inadimplencia-familias">');
    expect(html).toContain("Crédito e sistema financeiro (Scrutiniums)");
  });

  it("as páginas de indicador e do IBCC oferecem os dois botões", () => {
    for (const p of ["src/app/dados/[slug]/page.tsx", "src/app/dados/ibcc/page.tsx"]) {
      expect(ler(p), p).toContain("<CitarIncorporar");
    }
    const c = ler("src/components/dados/CitarIncorporar.tsx");
    expect(c).toContain("Copiar citação");
    expect(c).toContain("Incorporar");
    expect(c).toContain("citacao(dados, new Date())");
  });
});

describe("imagem social", () => {
  it("cada página de indicador, o IBCC, /dados, /resumo e a home têm imagem; o cartão é summary_large_image", () => {
    for (const p of ["src/app/opengraph-image.tsx", "src/app/resumo/opengraph-image.tsx", "src/app/dados/opengraph-image.tsx", "src/app/dados/[slug]/opengraph-image.tsx", "src/app/dados/ibcc/opengraph-image.tsx"]) {
      expect(existsSync(join(raiz, p)), p).toBe(true);
      const s = ler(p);
      expect(s).toMatch(/export const alt = "/);
      expect(s).toContain("rodape:");
    }
    expect(ler("src/app/layout.tsx")).toContain('twitter: { card: "summary_large_image" }');
    expect(ler("src/lib/og.tsx")).toContain('import { TOKENS } from "./tokens.gerado"');
    expect(ler("src/lib/og.tsx")).not.toMatch(/#[0-9A-Fa-f]{6}/);
  });
});

describe("API pública de leitura", () => {
  const contrato = JSON.parse(ler("docs/api/contrato-gold.json"));

  it("todo arquivo do contrato existe no gold e é JSON válido", () => {
    expect(contrato.versao).toMatch(/^\d+\.\d+\.\d+$/);
    for (const a of contrato.arquivos) {
      const p = join(raiz, "public/obs/data/gold", a.arquivo);
      expect(existsSync(p), a.arquivo).toBe(true);
      expect(() => JSON.parse(readFileSync(p, "utf-8")), a.arquivo).not.toThrow();
    }
    for (const d of contrato.diretorios) expect(existsSync(join(raiz, "public/obs/data/gold", d.diretorio)), d.diretorio).toBe(true);
  });

  it("a página documenta acesso, cadência, esquema, versão e catálogo; o gold exige sessão e não é compartilhado por CDN", () => {
    const p = ler("src/app/dados/api/page.tsx");
    for (const id of ["api-acesso", "api-cadencia", "api-esquema", "api-versao", "api-catalogo"]) expect(p).toContain(`id="${id}"`);
    // desde 13/10/2026 os painéis e seus arquivos exigem conta: sem CORS aberto, cache privado
    const cfg = ler("next.config.mjs");
    expect(cfg).not.toContain('{key: "Access-Control-Allow-Origin", value: "*"}');
    expect(cfg).toContain('{source: "/obs/data/gold/:path*", headers: [{key: "Cache-Control", value: "private, max-age=3600"}]}');
    expect(p).not.toMatch(/sem autenticação/);
    // a descrição de busca não pode prometer acesso sem conta
    expect(p).not.toMatch(/JSON aberto, sem chave/);
    expect(p).toContain("para quem está conectado com a conta gratuita: catálogo");
  });
});

describe("Zenodo", () => {
  it("script e workflow preparam e, no máximo, criam rascunho: nunca publicam", () => {
    const s = ler("scripts/zenodo_deposito.py");
    expect(s).not.toContain("/actions/publish");
    expect(s).toContain("sandbox.zenodo.org");
    const w = ler(".github/workflows/zenodo-mensal.yml");
    expect(w).toContain("vars.ZENODO_RASCUNHO == '1'");
    expect(w).not.toMatch(/publish/i);
  });
});
