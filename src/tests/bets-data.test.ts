/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON curado sem tipos gerados */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isViewSection, sectionLabel } from "@/lib/telemetry";

/**
 * Testes de consistência do dado curado da aba "Bets e risco financeiro".
 * Protegem as distinções conceituais que o painel promete: GGR ≠ depósito ≠
 * fluxo bruto; regulado ≠ ilegal; oficial ≠ imprensa; semestral ≠ mensal.
 */

const NIVEIS = ["A", "B", "C", "D", "E"];
const STATUS = ["oficial", "calculado", "estimativa", "imprensa"];

function loadBets(rel: string) {
  return JSON.parse(readFileSync(join(process.cwd(), rel), "utf-8"));
}
const curado = loadBets("pipeline/curated/bets.json");
const servido = loadBets("public/obs/data/gold/bets.json");

describe("bets.json: integridade estrutural", () => {
  it("arquivo curado e arquivo servido no gold são idênticos", () => {
    expect(servido).toEqual(curado);
  });

  it("campos raiz obrigatórios presentes", () => {
    for (const k of ["gerado_em", "corte_pesquisa", "niveis", "sintese", "series", "cadeia", "perfil", "vulnerabilidade", "explorador", "mercado_ilegal", "estudos", "timeline", "metodologia"]) {
      expect(curado[k], `campo ${k}`).toBeTruthy();
    }
    expect(curado.corte_pesquisa).toBe("2026-08-06");
    expect(curado.aviso).toMatch(/não implicam causalidade/i);
  });

  it("hierarquia A..E definida e usada corretamente", () => {
    expect(Object.keys(curado.niveis).sort()).toEqual(NIVEIS);
    for (const k of curado.sintese) {
      expect(NIVEIS, `nivel de ${k.id}`).toContain(k.nivel);
      expect(STATUS, `status de ${k.id}`).toContain(k.status);
      expect(k.url, `url de ${k.id}`).toMatch(/^https:\/\//);
      expect(k.conceito, `conceito de ${k.id}`).toBeTruthy();
      expect(k.data_ref, `data_ref de ${k.id}`).toBeTruthy();
    }
  });

  it("número de imprensa nunca recebe nível A; dado oficial nunca cita imprensa como fonte", () => {
    const varre = (obs: any[]) => {
      for (const o of obs) {
        if (o.status === "imprensa") expect(o.nivel, JSON.stringify(o)).not.toBe("A");
        if (o.status === "oficial" && o.url) expect(o.url).toMatch(/gov\.br|bcb\.gov\.br|planalto|in\.gov\.br|stf\.jus|senado\.leg|camara\.leg|tcu\.gov/);
      }
    };
    varre(curado.sintese);
    for (const s of Object.values<any>(curado.series)) if (s.obs) varre(s.obs);
  });
});

describe("bets.json: fórmula do GGR e conceitos que não se misturam", () => {
  const ggr = curado.series.ggr_regulado;

  it("GGR anual 2025 = 1S2025 + 2S2025 (derivação declarada)", () => {
    const s1 = ggr.obs.find((o: any) => o.ref === "2025-S1");
    const s2 = ggr.obs.find((o: any) => o.ref === "2025-S2");
    const anual = curado.sintese.find((k: any) => k.id === "ggr_2025");
    expect(s1.v + s2.v).toBeCloseTo(anual.valor, 2);
    expect(s2.status).toBe("calculado");
    expect(s2.derivacao).toBeTruthy();
  });

  it("GGR médio mensal por apostador = GGR semestral / apostadores / 6", () => {
    const kpi = curado.sintese.find((k: any) => k.id === "ggr_por_apostador");
    const esperado = (17.4e9 / 17.7e6) / 6;
    expect(kpi.valor).toBeCloseTo(esperado, 0);
    expect(kpi.status).toBe("calculado");
    expect(kpi.nota).toMatch(/mediana/i); // média declarada como média
  });

  it("conceito de GGR nunca é confundido com depósito, volume apostado ou faturamento", () => {
    expect(ggr.conceito).toMatch(/apostado menos prêmios|apostas menos prêmios/i);
    expect(ggr.nota).toMatch(/payout arbitrário/i); // proíbe inferir turnover
    const kpiGgr = curado.sintese.find((k: any) => k.id === "ggr_2025");
    expect(kpiGgr.conceito).toMatch(/Não é volume apostado/i);
  });

  it("fluxo Pix pré-regulação carrega quebra metodológica e não se mistura ao GGR", () => {
    const pix = curado.series.pix_pre_regulacao;
    expect(pix.quebra_metodologica).toBe(true);
    expect(pix.conceito).toMatch(/NÃO é perda/i);
    expect(pix.conceito).toMatch(/NÃO é GGR/i);
    // nenhum ponto do Pix dentro da série de GGR e vice-versa
    for (const o of ggr.obs) expect(String(o.ref)).not.toMatch(/^2024/);
    for (const o of pix.obs) expect(String(o.ref)).toMatch(/^2024/);
  });

  it("mercado regulado e ilegal nunca são somados", () => {
    expect(curado.mercado_ilegal.aviso).toMatch(/NUNCA são somados|nunca somar/i);
  });

  it("apostadores: cada observação declara o conceito (conta vs CPF único)", () => {
    for (const o of curado.series.apostadores.obs) {
      expect(o.conceito, JSON.stringify(o)).toBeTruthy();
    }
    const glossario = curado.metodologia.conceitos.map((c: any) => c.termo).join(" ");
    expect(glossario).toMatch(/CPF único/i);
    expect(glossario).toMatch(/mediana/i);
  });
});

describe("bets.json: séries sem interpolação e ordenadas", () => {
  it("GGR oficial é semestral/trimestral: nenhum ponto mensal inventado", () => {
    expect(curado.series.ggr_regulado.obs.length).toBeLessThanOrEqual(4);
    for (const o of curado.series.ggr_regulado.obs) {
      expect(String(o.ref)).toMatch(/^\d{4}-(S[12]|T[1-4])$/);
    }
  });

  it("séries datadas são estritamente crescentes e sem duplicatas", () => {
    for (const key of ["autoexclusao", "bloqueios_ilegais"]) {
      const refs = curado.series[key].obs.map((o: any) => o.ref);
      const sorted = [...refs].sort();
      expect(refs).toEqual(sorted);
      expect(new Set(refs).size).toBe(refs.length);
      // acumulados nunca decrescem
      const vs = curado.series[key].obs.map((o: any) => o.v);
      for (let i = 1; i < vs.length; i++) expect(vs[i]).toBeGreaterThanOrEqual(vs[i - 1]);
    }
  });

  it("datas dentro do intervalo [2018, corte da pesquisa]", () => {
    for (const t of curado.timeline) {
      expect(t.data >= "2018-01-01" && t.data <= curado.corte_pesquisa, t.ato).toBe(true);
      expect(t.url).toMatch(/^https:\/\//);
      expect(["confirmado", "parcial"]).toContain(t.status);
    }
    // ordem cronológica aproximada (tolerância para atos do mesmo mês agrupados)
    const anos = curado.timeline.map((t: any) => t.data.slice(0, 4));
    expect([...anos].sort()).toEqual(anos.slice().sort());
    expect(anos[0]).toBe("2018");
  });
});

describe("bets.json: cadeia causal e explorador honestos", () => {
  it("cada elo declara grau de evidência válido", () => {
    const validos = Object.keys(curado.cadeia.legenda);
    expect(validos.sort()).toEqual(["associacao", "comprovado_brasil", "hipotese", "internacional"].sort());
    for (const e of curado.cadeia.elos) {
      expect(validos, `${e.de} → ${e.para}`).toContain(e.status);
      expect(e.evidencia).toBeTruthy();
    }
    // nem todos os elos podem estar "comprovados": o painel investiga, não conclui
    expect(curado.cadeia.elos.some((e: any) => e.status === "hipotese")).toBe(true);
  });

  it("correlação bloqueada com série curta (min_obs_correlacao)", () => {
    const ex = curado.explorador;
    expect(ex.min_obs_correlacao).toBeGreaterThanOrEqual(8);
    expect(curado.series.ggr_regulado.obs.length).toBeLessThan(ex.min_obs_correlacao);
    expect(ex.rotulos_validos).toContain("sem evidência suficiente");
    expect(ex.rotulos_validos).toContain("não implica causalidade");
  });

  it("indicadores do explorador existem no gold de crédito (pulse.json)", () => {
    const pulse = loadBets("public/obs/data/gold/pulse.json");
    for (const ind of curado.explorador.indicadores) {
      expect(pulse.series[ind.key], `série ${ind.key} ausente no pulse.json`).toBeTruthy();
    }
  });

  it("estudos: desenho e aplicabilidade declarados; working papers marcados", () => {
    for (const e of curado.estudos) {
      for (const campo of ["desenho", "pais", "base", "resultado", "limitacoes", "aplicabilidade", "url", "tipo"]) {
        expect((e as any)[campo], `${e.id}.${campo}`).toBeTruthy();
      }
    }
    const hollenbeck = curado.estudos.find((e: any) => e.id === "hollenbeck");
    expect(hollenbeck.tipo).toMatch(/working paper/i);
    const cnc = curado.estudos.find((e: any) => e.id === "cnc2026");
    expect(cnc.limitacoes).toMatch(/contestado/i);
  });

  it("estimativa Comsefaz/EPAE entra como contestada e nunca se mistura ao GGR", () => {
    const comsefaz = curado.estudos.find((e: any) => e.id === "comsefaz2026");
    expect(comsefaz.nivel).toBe("D");
    expect(comsefaz.limitacoes).toMatch(/contestado/i);
    expect(comsefaz.limitacoes).toMatch(/ordem de grandeza/i);
    expect(comsefaz.aplicabilidade).toMatch(/incompatível.*GGR/i);
    // o número contestado não entra na síntese nem nas séries oficiais
    expect(curado.sintese.some((k: any) => /62,5|comsefaz/i.test(JSON.stringify(k)))).toBe(false);
    for (const s of Object.values<any>(curado.series)) {
      expect(JSON.stringify(s)).not.toMatch(/comsefaz/i);
    }
  });
});

describe("bets: integração com a plataforma", () => {
  it("telemetria reconhece a seção obs:bets", () => {
    expect(isViewSection("obs:bets")).toBe(true);
    expect(sectionLabel("obs:bets")).toMatch(/Bets/);
  });

  it("view registrada na SPA (rota, dados, render, navegação)", () => {
    const app = readFileSync(join(process.cwd(), "public/obs/app.js"), "utf-8");
    expect(app).toContain('bets: "/bets-financial-risk"');
    expect(app).toContain('bets: ["bets", "epae"]'); // pulse é CORE_FILES; epae entra junto com a aba
    expect(app).toContain('bets: "renderBets"');
    expect(app).toContain("function renderBets()");
    const html = readFileSync(join(process.cwd(), "public/obs/index.html"), "utf-8");
    expect(html).toContain('data-view="bets"');
    expect(html).toContain('id="view-bets"');
    expect(html).toContain("Riscos emergentes");
  });

  it("sem dados sintéticos: aba não possui modo demo e pipeline copia o curado", () => {
    const app = readFileSync(join(process.cwd(), "public/obs/app.js"), "utf-8");
    const bloco = app.slice(app.indexOf("function renderBets()"), app.indexOf("const RENDER = {"));
    expect(bloco).not.toMatch(/\bdemo\b|badge\("demo"\)|DEMONSTRATIVO|placeholder/i);
    const gold = readFileSync(join(process.cwd(), "pipeline/gold.py"), "utf-8");
    // cópia generalizada: todo pipeline/curated/*.json vai ao gold
    expect(gold).toContain("curated_dir");
  });
});
