/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Clientes contra bancos na Justiça e instituições financeiras. O teste mais importante deste módulo é
 * negativo: garantir que a camada nacional (DataJud, que não publica as partes) NUNCA
 * carregue identificação de instituição, e que a camada nominal (TST) declare seu
 * recorte. Além disso: casos únicos ≤ registros, participações somando 100%, códigos
 * TPU presentes e ausência de dados pessoais.
 */
function load(rel: string) {
  return JSON.parse(readFileSync(join(process.cwd(), rel), "utf-8"));
}
const J = load("public/obs/data/gold/judicial.json");

describe("judicial.json: separação das camadas", () => {
  it("a camada nacional declara que não identifica instituição", () => {
    expect(J.camada_nacional.identifica_instituicao).toBe(false);
    expect(J.limitacao_central).toMatch(/não publica as partes|nenhum identificador de parte/i);
  });

  it("nenhuma linha da camada nacional carrega instituição, CNPJ ou parte", () => {
    const txt = JSON.stringify(J.camada_nacional).toLowerCase();
    for (const proibido of ["cnpj", "cod_if", "parte", "litigante", "bradesco", "itaú", "santander"]) {
      expect(txt.includes(proibido), `camada nacional não pode conter "${proibido}"`).toBe(false);
    }
  });

  it("a camada nominal declara cobertura restrita e identifica a fonte", () => {
    expect(J.camada_nominal.identifica_instituicao).toBe(true);
    expect(J.camada_nominal.fonte).toMatch(/TST/);
    expect(J.camada_nominal.cobertura).toMatch(/somente/i);
    expect(J.camada_nominal.cobertura).toMatch(/não é.*total/i);
  });

  it("aviso permanente e privacidade presentes", () => {
    expect(J.aviso_permanente).toMatch(/não constitui, isoladamente, evidência/i);
    expect(J.privacidade).toMatch(/agregados/i);
  });
});

describe("judicial.json: coerência das contagens", () => {
  it("casos únicos nunca superam registros (dedup pelo número CNJ)", () => {
    for (const c of J.camada_nacional.categorias) {
      expect(c.casos_unicos, c.rotulo).toBeLessThanOrEqual(c.registros);
      expect(c.casos_unicos).toBeGreaterThan(0);
    }
    for (const a of J.camada_nacional.assuntos) {
      expect(a.casos_unicos, a.nome).toBeLessThanOrEqual(a.registros);
    }
  });

  it("participações por ramo somam 100%", () => {
    for (const ramo of ["civel", "trabalhista"]) {
      const cats = J.camada_nacional.categorias.filter((c: any) => c.ramo === ramo);
      if (!cats.length) continue;
      const soma = cats.reduce((s: number, c: any) => s + c.part, 0);
      expect(Math.abs(soma - 100), ramo).toBeLessThan(0.5);
    }
  });

  it("soma dos assuntos reconcilia com o total da categoria", () => {
    for (const c of J.camada_nacional.categorias) {
      const soma = J.camada_nacional.assuntos
        .filter((a: any) => a.ramo === c.ramo && a.categoria === c.categoria)
        .reduce((s: number, a: any) => s + a.casos_unicos, 0);
      expect(soma, c.rotulo).toBe(c.casos_unicos);
    }
  });

  it("todo assunto traz o código TPU e o tribunal tem UF", () => {
    for (const a of J.camada_nacional.assuntos) {
      expect(Number.isInteger(a.codigo)).toBe(true);
      expect(a.nome).toBeTruthy();
    }
    for (const t of J.camada_nacional.tribunais) {
      expect(t.uf, t.tribunal).toBeTruthy();
      expect(t.casos_unicos).toBeGreaterThan(0);
    }
  });

  it("garantias e cobrança ficam separadas das ações contra a instituição", () => {
    const cats = J.camada_nacional.categorias.map((c: any) => c.categoria);
    expect(cats).toContain("garantias_cobranca");
    expect(J.camada_nacional.nota_polo).toMatch(/não informa polo/i);
  });
});

describe("judicial.json: camada nominal e limitações", () => {
  it("ranking do TST com posições sequenciais e instituições resolvidas", () => {
    const l = J.camada_nominal.linhas;
    expect(l.length).toBeGreaterThanOrEqual(5);
    l.forEach((x: any, i: number) => expect(x.posicao).toBe(i + 1));
    const ifs = l.filter((x: any) => x.eh_if);
    expect(ifs.length).toBeGreaterThanOrEqual(3);
    for (const x of ifs) expect(x.confianca).toBeTruthy();
  });

  it("normalização só existe quando há denominador de escala", () => {
    for (const x of J.camada_nominal.linhas) {
      if (x.por_100bi_ativo != null) {
        expect(x.ativo_total).toBeGreaterThan(0);
        expect(x.eh_if).toBe(true);
      }
    }
  });

  it("denominadores indisponíveis declarados com motivo", () => {
    expect(J.denominadores_indisponiveis.length).toBeGreaterThanOrEqual(3);
    for (const d of J.denominadores_indisponiveis) {
      expect(d.metrica).toBeTruthy();
      expect(d.motivo).toBeTruthy();
    }
    const txt = JSON.stringify(J.denominadores_indisponiveis);
    expect(txt).toMatch(/clientes/);
    expect(txt).toMatch(/empregados/);
  });

  it("catálogo metodológico completo", () => {
    for (const c of J.catalogo) {
      for (const campo of ["id", "nome", "definicao", "formula", "unidade", "fonte", "nivel", "cobertura", "limitacoes", "versao"]) {
        expect(c[campo], `${c.id}.${campo}`).toBeTruthy();
      }
    }
  });

  it("a armadilha temporal do DataJud está declarada", () => {
    expect(J.camada_nacional.nota_temporal).toMatch(/2609|epoch/i);
  });
});
