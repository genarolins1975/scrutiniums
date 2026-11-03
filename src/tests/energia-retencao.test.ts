import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PAGINAS_DA_GOLD, retencoesDaMeta, retencoesDaPagina, type Retencao } from "@/lib/energia/retencao";

/**
 * Publicação por módulo do Setor Elétrico (decisão do dono de 03/11/2026): a gold retida pela sentinela tem páginas que dizem
 * de quando são os números (AvisoRetencao), e só elas. Invariantes: toda gold de conteúdo tem página, toda página existe, e o
 * HTML gerado mostra a faixa exatamente nas páginas das golds retidas em meta.json.
 */
const GOLD = join(process.cwd(), "public", "energia", "gold");
const APP = join(process.cwd(), "src", "app", "setor-eletrico");
/** Golds de controle da publicação inteira (envelope, inventário, catálogo, avaliação): não pertencem a um módulo. */
const CONTROLE = new Set(["meta.json", "manifesto.json", "arquivos.json", "metricas.json", "catalogo.json", "avaliacao.json"]);
const meta = JSON.parse(readFileSync(join(GOLD, "meta.json"), "utf8"));
const retidas = retencoesDaMeta(meta);

describe("publicação por módulo: páginas de cada gold", () => {
  it("toda gold de conteúdo publicada tem páginas declaradas, e toda página declarada existe", () => {
    const golds = readdirSync(GOLD).filter((n) => n.endsWith(".json") && !n.startsWith("_") && !CONTROLE.has(n));
    for (const g of golds) expect(PAGINAS_DA_GOLD[g]?.length ?? 0, g).toBeGreaterThan(0);
    for (const [g, paginas] of Object.entries(PAGINAS_DA_GOLD)) {
      for (const p of paginas) expect(existsSync(join(APP, p)) && statSync(join(APP, p)).isDirectory(), `${g}: ${p}`).toBe(true);
    }
  });

  it("a faixa vale para a página da gold e para as filhas, nas duas línguas, e só para elas", () => {
    const r: Retencao[] = [{ gold: "agua_detalhe.json", publicadaEm: "2026-10-01T07:51:56Z", motivo: "teste" }];
    expect(retencoesDaPagina("/setor-eletrico/agua-e-clima", r)).toHaveLength(1);
    expect(retencoesDaPagina("/setor-eletrico/agua-e-clima/reservatorios", r)).toHaveLength(1);
    expect(retencoesDaPagina("/en/setor-eletrico/agua-e-clima/", r)).toHaveLength(1);
    expect(retencoesDaPagina("/setor-eletrico/agua-e-climaX", r)).toHaveLength(0);
    expect(retencoesDaPagina("/setor-eletrico/pld", r)).toHaveLength(0);
    expect(retencoesDaPagina("/saneamento/agua-e-clima", r)).toHaveLength(0);
    // gold repetida em regressoes conta uma vez
    expect(retencoesDaPagina("/setor-eletrico/agua-e-clima", [...r, ...r])).toHaveLength(1);
  });

  it("a data da faixa é a da publicação mantida (meta.golds), não a da execução", () => {
    for (const r of retidas) {
      expect(r.publicadaEm, r.gold).toBe(JSON.parse(readFileSync(join(GOLD, r.gold), "utf8")).gerado_em);
      expect(r.publicadaEm! < meta.gerado_em, r.gold).toBe(true);
    }
  });
});

const BUILD = join(process.cwd(), ".next", "server", "app");
const temBuild = existsSync(join(process.cwd(), ".next", "prerender-manifest.json"));
const EXIGIR = process.env.EXIGIR_BUILD_HTML === "1";

describe.skipIf(!temBuild && !EXIGIR)("publicação por módulo: HTML gerado", () => {
  const html = (rota: string) => readFileSync(join(BUILD, `${rota}.html`), "utf8");
  const golds = (h: string) => [...h.matchAll(/data-aviso-retencao[^>]*>[\s\S]*?<\/aside>/g)].flatMap((m) => [...m[0].matchAll(/data-gold="([^"]+)"/g)].map((x) => x[1]));

  it("a página principal de cada gold retida mostra a faixa, em português e em inglês, antes do conteúdo", () => {
    for (const r of retidas) {
      const rota = `/setor-eletrico${PAGINAS_DA_GOLD[r.gold][0]}`;
      for (const caminho of [rota, `/en${rota}`]) {
        const h = html(caminho);
        expect(golds(h), caminho).toContain(r.gold);
        expect(h.indexOf("data-aviso-retencao"), caminho).toBeLessThan(h.indexOf('id="conteudo"') === -1 ? Infinity : h.indexOf('id="conteudo"'));
      }
    }
  });

  it("páginas sem gold retida não mostram a faixa", () => {
    const retidasNomes = new Set(retidas.map((r) => r.gold));
    for (const [g, paginas] of Object.entries(PAGINAS_DA_GOLD)) {
      const rota = `/setor-eletrico${paginas[0]}`;
      const daPagina = retencoesDaPagina(rota, retidas).map((r) => r.gold);
      if (daPagina.length > 0 || retidasNomes.has(g) || !existsSync(join(BUILD, `${rota}.html`))) continue;
      expect(golds(html(rota)), rota).toEqual([]);
    }
  });
});
