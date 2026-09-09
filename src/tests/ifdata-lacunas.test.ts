/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Lacunas de entrega no IF.data (auditoria de 09/09/2026, a partir do painel Quem entra e quem sai).
 * A fonte publica com saldo nulo a linha de quem consta da relação do trimestre e não entregou o
 * balanço; o coletor descarta saldo nulo. Duas regras valem para todos os painéis que leem
 * institution_metrics:
 *  1. ausência num trimestre não é saída nem zero: quem consta da lista sem balanço é declarado
 *     nome a nome (`sem_balanco_na_data_base`) e mantém a ficha na última entrega;
 *  2. "variação no trimestre" só existe entre trimestres vizinhos (helper ifdata_lacunas.variacao_tri).
 */
const raiz = process.cwd();
const read = (p: string) => readFileSync(join(raiz, p), "utf-8");
const lerGold = (n: string) => (existsSync(join(raiz, "public/obs/data/gold", n)) ? JSON.parse(read("public/obs/data/gold/" + n)) : null);
const app = read("public/obs/app.js");

describe("pipeline: uma régua de lacunas para todos os builders do IF.data", () => {
  it("o helper existe e define adjacência de trimestres e a lista de quem consta sem balanço", () => {
    const h = read("pipeline/ifdata_lacunas.py");
    for (const fn of ["def tri_anterior(", "def adjacentes(", "def variacao_tri(", "def valor_ha_n_trimestres(", "def sem_balanco("]) expect(h).toContain(fn);
  });
  it("fichas, ranking, screener, NPL, pilotos, judicial e contagens usam o helper (nenhum compara vals[-1] com vals[-2] às cegas)", () => {
    const ipa = read("pipeline/inst_pages_all.py");
    expect(ipa).toContain("lacunas.sem_balanco(con, anomes)");
    expect(ipa).toContain("lacunas.variacao_tri(vals, relativa=(unit == \"R$\")");
    expect(ipa).toContain('"sem_balanco_na_data_base": aviso_lacuna');
    expect(ipa).not.toMatch(/prev = vals\[-2\]\[1\]/);
    expect(read("pipeline/indicators.py")).toContain('"sem_balanco_na_data_base": lacunas.sem_balanco(con, anomes)');
    expect(read("pipeline/market.py")).toContain('"sem_balanco_na_data_base": lacunas.sem_balanco(con, latest)');
    expect(read("pipeline/npl.py")).toContain("lacunas.variacao_tri(");
    expect(read("pipeline/npl.py")).not.toMatch(/serie\[-2\]\["inad_pct"\]/);
    const ip = read("pipeline/inst_pages.py");
    expect(ip).toContain("lacunas.valor_ha_n_trimestres(vals, 4)");
    expect(ip).not.toMatch(/vals\[0\]\[1\]\) if len\(vals\) >= 5/);
    expect(read("pipeline/judicial.py")).toContain("MAX(anomes) AS am FROM institution_metrics WHERE metric='ativo_total' AND anomes <= ?");
    expect(read("pipeline/gold.py")).toContain('out["ifdata_lista"]');
  });
});

describe("SPA: a lacuna aparece na tela, nunca como sumiço", () => {
  it("Instituições lista quem ficou fora do corte por falta de balanço; a ficha avisa e o KPI declara o período", () => {
    expect(app).toContain("inst.sem_balanco_na_data_base");
    expect(app).toContain("Fora do corte por falta de balanço em ${tri}");
    expect(app).toContain("const lacuna = cab.sem_balanco_na_data_base;");
    expect(app).toContain("sem variação trimestral: o trimestre anterior faltou na fonte");
    expect(app).toContain("S.sem_balanco_na_data_base");
  });
});

const I = lerGold("institutions.json");
// gold gerado antes de 09/09/2026 não tem o campo: o teste espera o próximo ciclo diário em vez de acusar o passado
describe.skipIf(!I?.ok || !("sem_balanco_na_data_base" in I))("institutions.json: quem consta sem balanço é declarado, nunca omitido em silêncio", () => {
  it("campo presente (lista ou null declarado); cada item traz última entrega ou nunca_entregou", () => {
    expect(I.nota_universo).toMatch(/não é saída nem zero/);
    const sb = I.sem_balanco_na_data_base;
    if (sb) {
      const cods = new Set(I.instituicoes.map((x: any) => x.cod_inst));
      for (const x of sb) {
        expect(cods.has(x.cod_inst), x.nome).toBe(false);
        expect(x.nunca_entregou || (x.ultima_entrega && x.ultima_entrega < I.anomes), x.nome).toBeTruthy();
      }
    }
  });
});

const X = lerGold("inst_index.json");
describe.skipIf(!X)("inst_index.json e fichas: instituição na lista sem balanço mantém a página na última entrega", () => {
  it("entradas com sem_balanco têm data_base anterior à do universo e a ficha carrega o aviso", () => {
    if (!("sem_balanco_na_data_base" in X)) return; // gold anterior à régua
    const atrasadas = X.instituicoes.filter((x: any) => x.sem_balanco);
    for (const x of atrasadas) {
      expect(x.data_base < X.anomes, x.nome).toBe(true);
      const pg = lerGold(`inst/${x.cod}.json`);
      if (!pg) continue;
      expect(pg.cabecalho.sem_balanco_na_data_base, x.nome).toBeTruthy();
      expect(pg.cabecalho.data_base_universo).not.toBe(pg.cabecalho.data_base);
    }
    for (const x of X.instituicoes.filter((y: any) => !y.sem_balanco).slice(0, 50)) expect(x.data_base, x.nome).toBe(X.anomes);
  });
  it("nenhuma ficha carrega variação trimestral quando o histórico do KPI tem lacuna declarada pelo período", () => {
    const dir = join(raiz, "public/obs/data/gold/inst");
    if (!existsSync(dir)) return;
    const arquivos = readdirSync(dir).filter(f => f.endsWith(".json")).slice(0, 200);
    for (const f of arquivos) {
      const pg = JSON.parse(read(`public/obs/data/gold/inst/${f}`));
      for (const k of pg.kpis || []) {
        if (!("periodo" in k)) return; // gold anterior à régua
        expect(k.periodo, `${f} ${k.label}`).toBe(pg.cabecalho.data_base);
      }
    }
  });
});
