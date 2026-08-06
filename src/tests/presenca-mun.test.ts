/* eslint-disable @typescript-eslint/no-explicit-any -- leitura de gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Presença bancária física por município: junção dos dois cadastros do BC
 * (dependências próprias e correspondentes contratados) na malha do IBGE.
 *
 * A invariante que importa aqui é de leitura: a classe é o ponto de MAIOR
 * profundidade existente, nunca uma medida de quantidade nem de acesso. Os
 * testes protegem a exclusividade das classes, o fechamento contra o
 * denominador oficial e a presença das ressalvas que impedem a leitura errada.
 */
const g = JSON.parse(
  readFileSync(join(process.cwd(), "public/obs/data/gold/presenca_mun.json"), "utf-8"),
);
const muns: any[] = g.municipios;

describe("presenca_mun.json: estrutura e denominador", () => {
  it("cobre a lista do IBGE inteira, sem duplicata e sem município inventado", () => {
    expect(muns.length).toBe(g.totais.municipios);
    expect(muns.length).toBeGreaterThanOrEqual(5570);
    const cods = muns.map((m) => m.cod);
    expect(new Set(cods).size).toBe(cods.length);
    for (const m of muns) {
      expect(m.cod).toMatch(/^\d{7}$/);
      expect(m.nome).toBeTruthy();
      expect(m.uf).toMatch(/^[A-Z]{2}$/);
    }
  });

  it("as três fontes estão declaradas, todas nível A", () => {
    expect(g.fontes.length).toBe(3);
    for (const f of g.fontes) {
      expect(f.url).toMatch(/^https:\/\//);
      expect(f.nivel).toBe("A");
    }
    expect(g.posicao.dependencias).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(g.posicao.correspondentes).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });
});

describe("presenca_mun.json: classificação exclusiva e coerente", () => {
  it("cada município tem exatamente uma classe, derivada dos próprios contadores", () => {
    const validas = new Set(g.classes.map((c: any) => c.id));
    for (const m of muns) {
      expect(validas, `${m.nome}: classe ${m.classe}`).toContain(m.classe);
      const esperada = m.agencia > 0 ? "agencia"
        : (m.posto > 0 || m.pae > 0) ? "posto"
          : m.corresp > 0 ? "correspondente" : "nenhum";
      expect(m.classe, `${m.nome} (${m.uf})`).toBe(esperada);
      for (const k of ["agencia", "posto", "pae", "corresp", "ifs_dep", "ifs_corresp"]) {
        expect(m[k], `${m.nome}.${k}`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("os totais por classe somam o total de municípios", () => {
    const soma = g.classes.reduce((a: number, c: any) => a + g.totais[c.id], 0);
    expect(soma).toBe(g.totais.municipios);
    for (const c of g.classes) {
      const contados = muns.filter((m) => m.classe === c.id).length;
      expect(g.totais[c.id], c.id).toBe(contados);
    }
  });

  it("os agregados por UF fecham com os municípios", () => {
    const somaUf = g.por_uf.reduce((a: number, u: any) => a + u.municipios, 0);
    expect(somaUf).toBe(muns.length);
    for (const u of g.por_uf) {
      const doUf = muns.filter((m) => m.uf === u.uf);
      expect(doUf.length, u.uf).toBe(u.municipios);
      expect(u.agencia + u.posto + u.correspondente + u.nenhum, u.uf).toBe(u.municipios);
      expect(u.corresp_qtd, u.uf).toBe(doUf.reduce((a, m) => a + m.corresp, 0));
    }
  });
});

describe("presenca_mun.json: o mapa não diz mais do que pode", () => {
  it("o aviso nega a leitura de acesso, e as limitações são explícitas", () => {
    expect(g.aviso).toMatch(/presença FÍSICA/i);
    expect(g.aviso).toMatch(/não equivale a ausência de acesso/i);
    const lim = g.limitacoes.join(" ");
    expect(lim).toMatch(/canais digitais/i);
    expect(lim).toMatch(/qualidade|horário|distância/i);
    expect(lim).toMatch(/escopo|serviço/i);
    expect(g.limitacoes.length).toBeGreaterThanOrEqual(4);
  });

  it("cada classe define o que significa, em vez de depender do rótulo", () => {
    for (const c of g.classes) {
      expect(c.def.length, c.id).toBeGreaterThan(30);
      expect(c.rotulo).toBeTruthy();
    }
  });

  it("a aba carrega o gold e desenha o mapa como categórico", () => {
    const app = readFileSync(join(process.cwd(), "public/obs/app.js"), "utf-8");
    expect(app).toContain('operacional: ["operacional", "presenca_mun", "penetracao_malha"]');
    expect(app).toContain("Presença bancária física por município");
    expect(app).toContain("Mapa categórico");
    expect(app).toContain("o que este mapa não diz");
    // a malha tem menos polígonos que a lista do IBGE: a diferença é declarada
    expect(app).toContain("ainda não no desenho");
  });
});
