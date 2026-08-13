/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Guidance × entregue (Fase 2). Os testes negativos são o coração:
 * cada banco só contra o próprio guidance (nenhum agregado entre bancos);
 * `situacao` é recomputável a partir de min/max/realizado (posição
 * aritmética, não juízo); URLs só do canal oficial da CVM; nada publica
 * sem aprovação e revisor.
 */

const raiz = process.cwd();
const cur = JSON.parse(readFileSync(join(raiz, "pipeline/curated/guidance.json"), "utf-8"));
const G = JSON.parse(readFileSync(join(raiz, "public/obs/data/gold/guidance.json"), "utf-8"));
const goldPy = readFileSync(join(raiz, "pipeline/gold.py"), "utf-8");
const appJs = readFileSync(join(raiz, "public/obs/app.js"), "utf-8");

describe("curadoria: ciclos com evidência oficial", () => {
  it("todo ciclo tem documento CVM, página, trecho e vocabulário válido", () => {
    expect(cur.ciclos.length).toBeGreaterThanOrEqual(7);
    for (const c of cur.ciclos) {
      expect(["em_revisao", "aprovado", "descartado"], c.id).toContain(c.status);
      expect(["guidance_x_realizado", "guidance_vigente", "ausencia_declarada"], c.id).toContain(c.tipo);
      expect(["companhia", "observatorio"], c.id).toContain(c.aferido_por);
      expect(c.conceito, c.id).toBeTruthy();
      expect(c.trecho, c.id).toBeTruthy();
      const doc = cur.documentos[c.documento_guidance];
      expect(doc, c.id).toBeTruthy();
      expect(doc.url, c.id).toMatch(/^https:\/\/www\.rad\.cvm\.gov\.br\//);
      expect(doc.identidade, c.id).toBeTruthy();
      if (c.status === "aprovado") expect(c.revisor, c.id).toBeTruthy();
    }
  });

  it("a situação de cada métrica é a posição aritmética no intervalo — recomputada", () => {
    for (const c of cur.ciclos) {
      for (const m of c.metricas || []) {
        expect(m.min, `${c.id}:${m.nome}`).toBeLessThan(m.max);
        if (m.realizado == null) {
          expect(m.situacao, `${c.id}:${m.nome}`).toBe("em_curso");
          expect(c.tipo, `${c.id}: realizado nulo só em ciclo vigente`).toBe("guidance_vigente");
        } else {
          const esperada = m.realizado < m.min ? "abaixo" : m.realizado > m.max ? "acima" : "dentro";
          expect(m.situacao, `${c.id}:${m.nome} (${m.min}–${m.max} vs ${m.realizado})`).toBe(esperada);
        }
      }
    }
  });

  it("aferição do Observatório exige fórmula declarada por métrica com realizado", () => {
    for (const c of cur.ciclos.filter((x: any) => x.aferido_por === "observatorio" && x.tipo === "guidance_x_realizado")) {
      for (const m of c.metricas) {
        if (m.realizado != null) expect(m.formula, `${c.id}:${m.nome}`).toBeTruthy();
      }
    }
  });

  it("ausência declarada tem verificação descrita e zero métricas", () => {
    const aus = cur.ciclos.filter((c: any) => c.tipo === "ausencia_declarada");
    expect(aus.length).toBeGreaterThanOrEqual(1);
    for (const c of aus) {
      expect(c.metricas.length, c.id).toBe(0);
      expect(c.conceito, c.id).toMatch(/AUSÊNCIA DECLARADA/);
    }
  });

  it("acompanhamentos trimestrais têm evidência, vocabulário e revisões apontando métricas reais", () => {
    for (const c of cur.ciclos) {
      for (const a of c.acompanhamentos || []) {
        expect(["em_revisao", "aprovado", "descartado"], `${c.id}:${a.periodo}`).toContain(a.status);
        expect(["revisao", "acompanhamento"], `${c.id}:${a.periodo}`).toContain(a.tipo);
        expect(a.trecho, `${c.id}:${a.periodo}`).toBeTruthy();
        const doc = cur.documentos[a.documento];
        expect(doc, `${c.id}:${a.periodo}`).toBeTruthy();
        // hosts oficiais permitidos: RAD/CVM (protocolo) ou o filemanager do RI
        // oficial da companhia (divulgação própria — precedente Caixa/Nubank).
        // Fora do RAD, a identidade verificada dentro do arquivo é OBRIGATÓRIA.
        expect(doc.url, `${c.id}:${a.periodo}`).toMatch(/^https:\/\/(www\.rad\.cvm\.gov\.br\/|api\.mziq\.com\/mzfilemanager\/v2\/d\/)/);
        if (!/^https:\/\/www\.rad\.cvm\.gov\.br\//.test(doc.url)) {
          expect(doc.identidade, `${c.id}:${a.periodo}: fonte fora do RAD exige identidade verificada`).toBeTruthy();
        }
        if (a.status === "aprovado") expect(a.revisor, `${c.id}:${a.periodo}`).toBeTruthy();
        if (a.tipo === "revisao") {
          const nomes = c.metricas.map((m: any) => m.nome);
          for (const mu of a.mudancas) {
            expect(nomes, `${c.id}: revisão de métrica inexistente`).toContain(mu.metrica);
            expect(mu.min_novo, mu.metrica).toBeLessThan(mu.max_novo);
          }
        }
      }
    }
  });

  it("nenhum agregado de cumprimento entre bancos, em lugar nenhum", () => {
    const texto = JSON.stringify(cur) + readFileSync(join(raiz, "pipeline/guidance_bancos.py"), "utf-8");
    expect(texto).not.toMatch(/cumprimento_medio|score_cumprimento|ranking_cumprimento/);
  });
});

describe("gold guidance.json publicado (gate de aprovação)", () => {
  it("publica só aprovado e reconcilia contagens com a curadoria", () => {
    expect(G.disponivel).toBe(true);
    const aprovados = cur.ciclos.filter((c: any) => c.status === "aprovado");
    const emRevisao = cur.ciclos.filter((c: any) => c.status === "em_revisao");
    expect(G.ciclos.length).toBe(aprovados.length);
    expect(G.em_revisao).toBe(emRevisao.length);
    for (const c of G.ciclos) {
      expect(c.revisor, `${c.id}: aprovado exige revisor`).toBeTruthy();
      expect(Object.keys(c.documentos).length, c.id).toBeGreaterThan(0);
    }
    const cautelas = (G.cautelas || []).join(" ");
    expect(cautelas).toMatch(/NUNCA é comparado, somado ou ranqueado entre bancos/);
    expect(cautelas).toMatch(/não juízo de mérito/);
    // acompanhamentos têm o próprio gate: pendentes viram contagem, publicados exigem aprovação
    const pendentes = cur.ciclos.flatMap((c: any) => (c.acompanhamentos || []).filter((a: any) => a.status === "em_revisao"));
    expect(G.acompanhamentos_em_revisao).toBe(pendentes.length);
    for (const c of G.ciclos) {
      for (const a of c.acompanhamentos || []) {
        expect(a.revisor, `${c.id}:${a.periodo}: publicado exige revisor`).toBeTruthy();
      }
    }
  });

  it("o builder roda no gold diário", () => {
    expect(goldPy).toContain("guid_mod.build");
  });
});

describe("SPA", () => {
  it("a seção existe na aba Instituições com pendência declarada", () => {
    expect(appJs).toContain("Promessas × entrega — guidance dos grandes listados");
    expect(appJs).toContain("guidanceSecao()");
    expect(appJs).toMatch(/aguardando revisão\s*\n?\s*editorial/);
    // o gold carrega junto com a aba
    expect(appJs).toMatch(/institutions: \["institutions", "inst_index", "npl", "guidance"/);
  });
});
