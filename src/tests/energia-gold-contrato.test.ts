/* eslint-disable @typescript-eslint/no-explicit-any -- varredura genérica da gold publicada */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DATASETS_INTEGRADOS } from "@/lib/energia/datasets";

/**
 * Contrato da gold do domínio Energia (docs/observatorios/MODELO_AUDITABILIDADE.md):
 * todo indicador publicado tem natureza, fonte, período, snapshot e limitações;
 * calculado tem fórmula; ausência nunca vira zero; classificação só com regra.
 */
const DIR = join(process.cwd(), "public", "energia", "gold");
const ler = (n: string) => JSON.parse(readFileSync(join(DIR, n), "utf-8"));
const GOLDS = ["pld.json", "hidrologia.json", "carga.json", "geracao.json", "rede.json", "cmo.json", "sintese.json", "modelos.json", "previsoes.json", "catalogo.json", "meta.json"];
const NATUREZAS = ["OBSERVADO", "CALCULADO", "ESTIMADO", "PREVISTO", "CENARIO"];

function proveniencias(o: any, out: any[] = []): any[] {
  if (Array.isArray(o)) o.forEach((x) => proveniencias(x, out));
  else if (o && typeof o === "object") {
    if ("natureza" in o && "fonte" in o && "limitacoes" in o) out.push(o);
    Object.values(o).forEach((v) => proveniencias(v, out));
  }
  return out;
}

describe("gold de energia: presença e integridade", () => {
  it("todas as golds existem, são do domínio energia e estão íntegras", () => {
    for (const g of GOLDS) {
      expect(existsSync(join(DIR, g)), g).toBe(true);
      const j = ler(g);
      expect(j.dominio, g).toBe("energia");
      expect(j.disponivel, g).toBe(true);
    }
  });

  it("meta.json não registra builder falho nem regressão retida", () => {
    const m = ler("meta.json");
    expect(m.builders_falhos).toEqual([]);
    expect(m.regressoes).toEqual([]);
  });
});

describe("proveniência: todo indicador leva ao dado primário", () => {
  const todas = GOLDS.flatMap((g) => proveniencias(ler(g)).map((p) => ({ g, p })));

  it("há proveniência em cada gold de indicador", () => {
    for (const g of ["pld.json", "hidrologia.json", "carga.json", "geracao.json", "rede.json", "cmo.json"]) {
      expect(todas.filter((x) => x.g === g).length, g).toBeGreaterThan(0);
    }
  });

  it("natureza válida, fonte com órgão e URL, período, snapshot e limitações não vazias", () => {
    for (const { g, p } of todas) {
      const id = `${g}: ${p.indicador}`;
      expect(NATUREZAS, id).toContain(p.natureza);
      expect(p.fonte.orgao, id).toBeTruthy();
      expect(p.fonte.url_dataset, id).toMatch(/^https:\/\//);
      expect(p.fonte.licenca, id).toBeTruthy();
      expect(p.periodo_referencia?.inicio, id).toBeTruthy();
      expect(p.periodo_referencia?.fim, id).toBeTruthy();
      expect(p.snapshot?.id, id).toBeTruthy();
      expect(p.snapshot?.sha256, id).toMatch(/^[0-9a-f]{64}$/);
      expect(p.capturado_em, id).toBeTruthy();
      expect(Array.isArray(p.limitacoes) && p.limitacoes.length > 0, id).toBe(true);
    }
  });

  it("indicador calculado sempre tem fórmula", () => {
    for (const { g, p } of todas) {
      if (p.natureza === "CALCULADO") expect(p.formula, `${g}: ${p.indicador}`).toBeTruthy();
    }
  });

  it("downloads declarados existem", () => {
    for (const { p } of todas) {
      if (p.download) expect(existsSync(join(process.cwd(), "public", p.download)), p.download).toBe(true);
    }
  });
});

describe("ausência nunca vira zero", () => {
  it("séries do PLD não têm zero nem valor não numérico (o PLD é positivo)", () => {
    const pld = ler("pld.json");
    for (const linha of [...pld.diario, ...pld.horario_30d]) {
      for (const sm of ["SE", "S", "NE", "N"]) {
        const v = linha[sm];
        expect(v === null || (typeof v === "number" && v > 0), `${linha.d ?? linha.t} ${sm}`).toBe(true);
      }
    }
  });

  it("EAR, carga e geração: nenhum ponto é zero exato disfarçando lacuna", () => {
    const h = ler("hidrologia.json");
    for (const l of h.serie_ear) for (const k of ["SE", "S", "NE", "N", "SIN"]) expect(l[k] === null || l[k] > 0, `EAR ${l.d} ${k}`).toBe(true);
    const c = ler("carga.json");
    for (const l of c.serie) for (const k of ["SE", "S", "NE", "N", "SIN"]) expect(l[k] === null || l[k] > 0, `carga ${l.d} ${k}`).toBe(true);
    const g = ler("geracao.json");
    for (const l of g.serie_sin) for (const k of ["hidraulica", "termica", "eolica"]) expect(l[k] === null || l[k] > 0, `geração ${l.d} ${k}`).toBe(true);
  });

  it("CSVs publicados: ausência é campo vazio, nunca 'nan', 'None' ou 'null'", () => {
    const dir = join(process.cwd(), "public", "energia", "series");
    for (const f of readdirSync(dir)) {
      const t = readFileSync(join(dir, f), "utf-8");
      expect(t, f).not.toMatch(/;(nan|NaN|None|null|undefined)(;|\n)/);
    }
  });
});

describe("classificação só com regra publicada", () => {
  it("toda faixa do PLD vem acompanhada da regra e dos quartis", () => {
    const pld = ler("pld.json");
    expect(pld.regras.posicao_historica).toMatch(/25º percentil/);
    for (const c of pld.cartoes) {
      if (c.posicao.faixa) {
        expect(["baixa", "central", "alta"]).toContain(c.posicao.faixa);
        expect(c.posicao.quartis.p25).not.toBeNull();
        expect(c.posicao.n_dias).toBeGreaterThan(365);
      }
    }
    expect(pld.regras.menor_valor_ano).toMatch(/Não é o piso regulatório/);
  });

  it("faixa usual da hidrologia vem da regra do 10º ao 90º percentil", () => {
    const h = ler("hidrologia.json");
    expect(h.regras.faixa_usual).toMatch(/10º e o 90º percentil/);
    for (const s of h.subsistemas) {
      if (s.ear.faixa) expect(s.ear.anos_na_base).toBeGreaterThanOrEqual(20);
    }
  });

  it("comparação anual da carga só aparece dentro do mesmo regime metodológico", () => {
    const c = ler("carga.json");
    for (const s of c.subsistemas) {
      for (const j of [s.ult7, s.ult30]) {
        if (j && !j.mesmo_regime) expect(j.variacao_pct).toBeNull();
      }
    }
  });

  it("síntese: toda frase tem regra e todo trecho com link tem evidência", () => {
    const s = ler("sintese.json");
    expect(s.frases.length).toBeGreaterThan(0);
    for (const f of s.frases) {
      expect(f.regra, f.id).toBeTruthy();
      for (const t of f.trechos) if (t.href) expect(t.evidencia, f.id).toBeTruthy();
    }
    for (const o of s.observar) expect(o.condicao, o.id).toBeTruthy();
  });
});

describe("catálogo coerente com o pipeline", () => {
  it("cada dataset integrado na interface existe no catálogo com o mesmo slug e estado de uso", () => {
    const cat = ler("catalogo.json");
    for (const d of DATASETS_INTEGRADOS) {
      const e = cat.entradas.find((x: any) => x.id === d.catalogoId);
      expect(e, d.catalogoId).toBeTruthy();
      expect(e.slug).toBe(d.slug);
      expect(["UTILIZADO EM INDICADOR", "UTILIZADO EM MODELO"]).toContain(e.estado);
    }
  });

  it("nenhum dataset só catalogado aparece como fonte de indicador", () => {
    const cat = ler("catalogo.json");
    for (const e of cat.entradas) if (e.estado === "CATALOGADO") expect(e.usado_em, e.id).toEqual([]);
  });

  it("entrada manual nunca se apresenta como verificada", () => {
    const manual = JSON.parse(readFileSync(join(process.cwd(), "pipeline", "energia", "catalogo_manual.json"), "utf-8"));
    const cat = ler("catalogo.json");
    for (const m of manual.entradas) {
      const e = cat.entradas.find((x: any) => x.id === m.id);
      expect(e.metadados_verificados, m.id).toBe(false);
    }
  });
});
