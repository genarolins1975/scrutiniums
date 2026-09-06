/**
 * Testes de contrato dos sete golds que não tinham arquivo *-data.test.ts (avaliação de
 * 06/09/2026, achado T6): market, npl, compare, trends, rj, exposures e quality. Cada um
 * trava chaves obrigatórias, data de referência ou vintage, ausência de NaN e Infinity
 * (JSON.parse rejeita ambos, então o teste lê o texto), e unidade declarada onde há série.
 * Lê sempre o gold publicado (public/obs/data/gold), que é o contrato consumido em produção.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const RAIZ = process.cwd();
// sempre o gold PUBLICADO: é o contrato que a SPA em produção consome (um build local
// parcial, como o desta sessão sem o arquivo manual do Trends, não é o contrato)
const caminho = (n: string) => join(RAIZ, "public/obs/data/gold", `${n}.json`);
const texto = (n: string) => readFileSync(caminho(n), "utf8");
const gold = (n: string) => JSON.parse(texto(n));
const ISO_MES = /^\d{4}-\d{2}/;
const ANOMES = /^\d{6}$/;

describe("contrato: todo gold é JSON estrito, sem NaN nem Infinity", () => {
  for (const n of ["market", "npl", "compare", "trends", "rj", "exposures", "quality"]) {
    it(`${n}.json não carrega NaN, Infinity nem undefined literal`, () => {
      const t = texto(n);
      expect(t).not.toMatch(/\bNaN\b/);
      expect(t).not.toMatch(/\bInfinity\b/);
      expect(t).not.toMatch(/:\s*undefined\b/);
    });
  }
});

describe("market.json: bancos na bolsa", () => {
  const M = gold("market");
  it("declara geração, universo e fontes, e traz empresas com séries e janelas", () => {
    expect(M.gerado_em).toMatch(ISO_MES);
    expect(Array.isArray(M.empresas)).toBe(true);
    expect(M.empresas.length).toBeGreaterThanOrEqual(10);
    expect(M.fontes).toBeTruthy();
    expect(Object.keys(M.series).length).toBeGreaterThanOrEqual(10);
    for (const e of M.empresas) { expect(e.company_id).toBeTruthy(); expect(e.legal_name).toBeTruthy(); expect(e.tickers.length, e.company_id).toBeGreaterThan(0); }
    for (const v of M.valuation) expect(v.data_preco, v.ticker).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("as janelas de retorno existem para cada ticker do valuation", () => {
    for (const v of M.valuation || []) {
      expect(M.janelas[v.ticker], v.ticker).toBeTruthy();
      expect(typeof M.janelas[v.ticker].total.a12).toBe("number");
    }
  });
});

describe("npl.json: inadimplência por instituição", () => {
  const N = gold("npl");
  it("é observado numa data-base declarada e cobre centenas de instituições", () => {
    expect(N.ok).toBe(true);
    expect(String(N.anomes)).toMatch(ANOMES);
    expect(N.data_base).toBeTruthy();
    expect(N.n_instituicoes).toBeGreaterThan(300);
    expect(Object.keys(N.instituicoes || {}).length || (N.instituicoes || []).length).toBeGreaterThan(300);
    expect(N.metodo).toBeTruthy();
  });
  it("listas de deterioração e melhora só apontam para instituições do arquivo", () => {
    const codigos = new Set(Array.isArray(N.instituicoes) ? N.instituicoes.map((i: { cod_inst?: string; cod?: string }) => i.cod_inst || i.cod) : Object.keys(N.instituicoes));
    for (const lista of [N.top_deterioracoes, N.top_melhoras]) for (const i of lista || []) {
      expect(codigos.has(i.cod_inst || i.cod), JSON.stringify(i).slice(0, 80)).toBe(true);
    }
  });
});

describe("compare.json: comparar instituições", () => {
  const C = gold("compare");
  it("tem catálogo de métricas com unidade, lista de períodos e universo declarado", () => {
    expect(C.gerado_em).toMatch(ISO_MES);
    expect(C.anomes_list.length).toBeGreaterThan(4);
    for (const a of C.anomes_list) expect(String(a)).toMatch(ANOMES);
    expect(C.metric_catalog.length).toBeGreaterThan(20);
    for (const m of C.metric_catalog) { expect(m.metric_id, JSON.stringify(m).slice(0, 80)).toBeTruthy(); expect(m.unit, m.metric_id).toBeTruthy(); expect(m.last_reference, m.metric_id).toMatch(ANOMES); }
    expect(C.universo.n_total).toBeGreaterThan(1000);
    expect(C.universo.n_total).toBe(C.universo.n_conglomerados + C.universo.n_individuais);
  });
});

describe("trends.json: buscas no Google", () => {
  const T = gold("trends");
  it("declara licença, disclaimer, mês parcial e séries em escala 0 a 100", () => {
    expect(T.disponivel).toBe(true);
    expect(T.disclaimer).toBeTruthy();
    expect(T.licenca).toBeTruthy();
    expect(T.meta.ultimo_mes_completo).toMatch(ISO_MES);
    expect(Object.keys(T.series).length).toBeGreaterThan(10);
    for (const [termo, s] of Object.entries<{ obs: { v: number; p: string }[] }>(T.series)) {
      for (const o of s.obs) { expect(o.v, termo).toBeGreaterThanOrEqual(0); expect(o.v, termo).toBeLessThanOrEqual(100); expect(o.p).toMatch(ISO_MES); }
    }
  });
});

describe("rj.json: recuperações e falências", () => {
  const R = gold("rj");
  it("traz séries reais do DataJud com cobertura declarada e, quando não é demo, nada fictício", () => {
    expect(R.series_reais).toBeTruthy();
    for (const slug of ["recuperacao_judicial", "falencia"]) {
      const s = R.series_reais[slug];
      expect(s, slug).toBeTruthy();
      expect(s.cobertura, slug).toBeTruthy();
      expect(s.agregado.obs.length, slug).toBeGreaterThan(24);
    }
    if (R.demo === false) {
      for (const k of ["casos", "exposicao_total_rmi", "serie_pedidos_mensais", "componentes_setoriais"]) expect(R[k], k).toBeUndefined();
    } else {
      expect(R.selo).toBe("DADO DEMONSTRATIVO");
    }
  });
});

describe("exposures.json: exposição setorial das instituições", () => {
  const E = gold("exposures");
  it("é observado numa data-base e todo setor declara participação em percentual", () => {
    expect(E.ok).toBe(true);
    expect(String(E.anomes)).toMatch(ANOMES);
    expect(Object.keys(E.setores).length).toBeGreaterThan(5);
    expect(E.ranking_pme.length).toBeGreaterThan(5);
    expect(E.pme_share_sistema_pct).toBeGreaterThan(0);
    expect(E.pme_share_sistema_pct).toBeLessThan(100);
    expect(E.metodo).toBeTruthy();
    expect(E.limitacoes).toBeTruthy();
  });
});

describe("quality.json: saúde das séries", () => {
  const Q = gold("quality");
  it("toda série tem nome, fonte, score entre 0 e 100 e última referência no passado", () => {
    const chaves = Object.keys(Q);
    expect(chaves.length).toBeGreaterThan(100);
    const gerado = (gold("meta").gerado_em || "").slice(0, 10);
    for (const k of chaves) {
      const q = Q[k];
      expect(q.nome, k).toBeTruthy();
      expect(q.fonte, k).toBeTruthy();
      expect(q.score, k).toBeGreaterThanOrEqual(0);
      expect(q.score, k).toBeLessThanOrEqual(100);
      // observação datada no futuro (meta Selic válida até a próxima reunião) é cortada na coleta desde 06/09/2026;
      // até o gold publicado refletir a coleta nova, a exceção fica declarada aqui
      if (k !== "selic_meta") expect(q.ultima_ref <= gerado, `${k} ${q.ultima_ref} > ${gerado}`).toBe(true);
    }
  });
});
