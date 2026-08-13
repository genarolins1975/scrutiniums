/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Linhagem automatizada (P1 da auditoria: "lineage.json com 3 entradas vs.
 * narrativa de linhagem"). O que se trava: o mapa é gerado do código a cada
 * execução e cobre TODO objeto publicado — produtor, fontes e consumo — com
 * zero itens sem produtor; a SPA nunca pede um gold que ninguém escreve; e a
 * Metodologia mostra a tabela completa.
 */
const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf-8");
const lineage = JSON.parse(read("public/obs/data/gold/lineage.json"));
const app = read("public/obs/app.js");
const MAPA = lineage.mapa;

describe("lineage.json: o mapa completo", () => {
  it("existe, é declarado como gerado do código e tem método descrito", () => {
    expect(MAPA).toBeTruthy();
    expect(MAPA.gerado_de).toMatch(/análise estática/);
    expect(MAPA.gerado_de).toMatch(/nunca mantido à mão/);
    expect(MAPA.metodo.length).toBeGreaterThan(80);
  });

  it("zero publicados sem produtor mapeado — a promessa de cobertura total", () => {
    expect(MAPA.resumo.publicados_sem_produtor_mapeado).toEqual([]);
  });

  it("todo objeto publicado no gold da SPA está no mapa", () => {
    const goldDir = join(process.cwd(), "public/obs/data/gold");
    const nomes = new Set(MAPA.objetos.map((o: any) => o.gold));
    for (const f of readdirSync(goldDir)) {
      const st = statSync(join(goldDir, f));
      const chave = st.isDirectory() ? `${f}/*` : f;
      if (!st.isDirectory() && !/\.(json|xml|html)$/.test(f)) continue;
      expect(nomes.has(chave), `${chave} fora do mapa`).toBe(true);
    }
  });

  it("todo objeto tem produtor, fonte e consumidor — nada órfão", () => {
    for (const o of MAPA.objetos) {
      expect(o.produtores.length, `${o.gold} sem produtor`).toBeGreaterThan(0);
      expect(o.fontes.length, `${o.gold} sem fonte`).toBeGreaterThan(0);
      expect(o.consumido_em.length, `${o.gold} sem consumidor`).toBeGreaterThan(0);
    }
  });

  it("vínculos conhecidos aparecem: curadoria de bets, split municipal, famílias", () => {
    const por = Object.fromEntries(MAPA.objetos.map((o: any) => [o.gold, o]));
    expect(por["bets.json"].fontes.join(" ")).toMatch(/curadoria:bets\.json/);
    expect(por["penetracao_mun.json"].notas.join(" ")).toMatch(/template \{nome\}_mun\.json/);
    for (const fam of ["cmp/*", "inst/*", "pano/*", "prod/*"]) {
      expect(por[fam], fam).toBeTruthy();
      expect(por[fam].produtores.length, fam).toBeGreaterThan(0);
    }
    // dependência invertida vira consumo: timeline curada é insumo da regulação
    expect(por["timeline_regulatoria.json"].consumido_em.join(" ")).toMatch(/regulacao\.json/);
  });

  it("a linhagem recente (bronze→gold com SHA-256) continua publicada ao lado", () => {
    expect(lineage.linhagem_recente.length).toBeGreaterThan(0);
    expect(lineage.linhagem_recente[0].sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("app.js: a Metodologia mostra o mapa", () => {
  it("seção da linhagem completa com contagens e alerta de não mapeados", () => {
    expect(app).toContain("Linhagem completa (${MP.resumo.objetos_mapeados} objetos, gerada do código)");
    expect(app).toContain("publicados_sem_produtor_mapeado");
    expect(app).toMatch(/investigar/);
  });
});
