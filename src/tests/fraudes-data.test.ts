/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON curado sem tipos gerados */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isViewSection, sectionLabel } from "@/lib/telemetry";

/**
 * Testes de consistência do dado curado da aba "Fraudes financeiras e
 * risco de crédito". Protegem as distinções que o painel promete:
 * tentativa ≠ perda; bruto ≠ líquido; reportado ≠ estimado; nenhuma soma
 * entre fontes sobrepostas; imprensa nunca vira nível A.
 */

const NIVEIS = ["A", "B", "C", "D", "E"];
const STATUS = ["oficial", "calculado", "estimativa", "imprensa"];

function load(rel: string) {
  return JSON.parse(readFileSync(join(process.cwd(), rel), "utf-8"));
}
const curado = load("pipeline/curated/fraudes.json");
const servido = load("public/obs/data/gold/fraudes.json");

describe("fraudes.json: integridade estrutural", () => {
  it("arquivo curado e arquivo servido no gold são idênticos", () => {
    expect(servido).toEqual(curado);
  });

  it("campos raiz obrigatórios e corte da pesquisa", () => {
    for (const k of ["gerado_em", "corte_pesquisa", "niveis", "sintese", "series", "tipos", "cadeia", "perfil", "subnotificacao", "explorador", "mitigacao", "estudos", "timeline", "metodologia"]) {
      expect(curado[k], `campo ${k}`).toBeTruthy();
    }
    expect(curado.corte_pesquisa).toBe("2026-07-31");
    expect(curado.aviso).toMatch(/não implicam causalidade/i);
    expect(Object.keys(curado.niveis).sort()).toEqual(NIVEIS);
  });

  it("todos os KPIs declaram conceito, nível, status e URL https", () => {
    for (const k of curado.sintese) {
      expect(NIVEIS, `nivel de ${k.id}`).toContain(k.nivel);
      expect(STATUS, `status de ${k.id}`).toContain(k.status);
      expect(k.url, `url de ${k.id}`).toMatch(/^https:\/\//);
      expect(k.conceito, `conceito de ${k.id}`).toBeTruthy();
      expect(k.data_ref, `data_ref de ${k.id}`).toBeTruthy();
    }
  });

  it("imprensa nunca recebe nível A; oficial exige URL de órgão público", () => {
    const varre = (obs: any[], origem: string) => {
      for (const o of obs) {
        if (o.status === "imprensa") expect(o.nivel, `${origem}: ${JSON.stringify(o)}`).not.toBe("A");
        if (o.status === "oficial" && o.url) {
          expect(o.url, `${origem}: ${o.url}`).toMatch(/gov\.br|bcb\.gov\.br|planalto|in\.gov\.br|stj\.jus|senado\.leg|camara\.leg|forumseguranca\.org|anatel|cetic\.br|cert\.br/);
        }
      }
    };
    varre(curado.sintese, "sintese");
    for (const [nome, s] of Object.entries<any>(curado.series)) if (s.obs) varre(s.obs, nome);
  });
});

describe("fraudes.json: tentativa vs perda, bruto vs líquido, deduplicação", () => {
  it("série da Serasa declara TENTATIVA e nunca usa conceito de perda", () => {
    const ser = curado.series.serasa_tentativas;
    expect(ser.conceito.toLowerCase()).toContain("tentativa");
    expect(ser.conceito).toMatch(/não é perda|bloqueada não é perda/i);
    expect(ser.unidade).not.toMatch(/R\$/);
  });

  it("MED separa valor contestado (bruto) de taxa de recuperação, com quebra metodológica", () => {
    const med = curado.series.med;
    expect(med.quebra_metodologica).toBe(true);
    const metricas = med.obs.map((o: any) => o.metrica);
    expect(metricas).toContain("taxa_recuperacao");
    expect(metricas).toContain("valor_contestado");
    const taxa = med.obs.find((o: any) => o.metrica === "taxa_recuperacao");
    expect(taxa.nivel).toBe("A");
    expect(taxa.status).toBe("oficial");
    const contestado = med.obs.find((o: any) => o.metrica === "valor_contestado");
    expect(contestado.status).toBe("imprensa");
    expect(contestado.nivel).toBe("E");
    expect(med.conceito).toMatch(/contestação não é fraude comprovada/i);
  });

  it("perdas Febraban declaradas como estimativa setorial (D), nunca oficiais", () => {
    for (const o of curado.series.perdas_febraban.obs) {
      expect(o.nivel).toBe("D");
      expect(o.status).toBe("estimativa");
    }
    expect(curado.series.perdas_febraban.nota).toMatch(/NÃO somar/i);
  });

  it("subnotificação apresenta camadas separadas e proíbe soma", () => {
    expect(curado.subnotificacao.aviso).toMatch(/NUNCA são somadas/i);
    expect(curado.subnotificacao.camadas.length).toBeGreaterThanOrEqual(4);
    const rotulos = curado.subnotificacao.camadas.map((c: any) => c.rotulo.toLowerCase()).join(" ");
    expect(rotulos).toMatch(/registro policial/);
    expect(rotulos).toMatch(/vitimização/);
    const dedup = curado.metodologia.conceitos.find((c: any) => c.termo.toLowerCase().includes("deduplica"));
    expect(dedup.def).toMatch(/nenhum número deste painel soma/i);
  });

  it("tipos de fraude: lacunas exibidas em vez de estimativas improvisadas", () => {
    const semDado = curado.tipos.itens.filter((t: any) =>
      `${t.frequencia} ${t.perda_media} ${t.recuperacao}`.match(/não disponível|ainda não disponível/i));
    expect(semDado.length).toBeGreaterThanOrEqual(2); // lacunas declaradas existem
    for (const t of curado.tipos.itens) {
      expect(NIVEIS, t.tipo).toContain(t.nivel);
      expect(t.frequencia, t.tipo).toBeTruthy();
    }
  });
});

describe("fraudes.json: séries íntegras e sem interpolação", () => {
  it("estelionato: série anual 2018-2025 estritamente crescente no período observado", () => {
    const obs = curado.series.estelionato.obs;
    expect(obs).toHaveLength(8);
    expect(obs[0].ref).toBe("2018");
    expect(obs[obs.length - 1].ref).toBe("2025");
    for (const o of obs) expect(String(o.ref)).toMatch(/^\d{4}$/); // anual: sem pontos mensais inventados
    const refs = obs.map((o: any) => o.ref);
    expect(new Set(refs).size).toBe(refs.length);
    expect([...refs].sort()).toEqual(refs);
    // valores conferem com o Anuário FBSP nas pontas
    expect(obs[0].v).toBe(426799);
    expect(obs[obs.length - 1].v).toBe(2261055);
  });

  it("timeline: datas em ordem, dentro de [2012, corte], com URL e status válidos", () => {
    for (const t of curado.timeline) {
      expect(t.data >= "2012-01-01" && t.data <= curado.corte_pesquisa, t.ato).toBe(true);
      expect(t.url).toMatch(/^https:\/\//);
      expect(["confirmado", "parcial"]).toContain(t.status);
    }
    const datas = curado.timeline.map((t: any) => t.data);
    expect([...datas].sort()).toEqual(datas);
  });
});

describe("fraudes.json: cadeia e explorador honestos", () => {
  it("cada elo declara grau de evidência válido e há hipóteses abertas", () => {
    const validos = Object.keys(curado.cadeia.legenda);
    for (const e of curado.cadeia.elos) {
      expect(validos, `${e.de} → ${e.para}`).toContain(e.status);
      expect(e.evidencia).toBeTruthy();
    }
    expect(curado.cadeia.elos.some((e: any) => e.status === "hipotese")).toBe(true);
  });

  it("correlação bloqueada e justificada; rótulos de leitura controlados", () => {
    const ex = curado.explorador;
    expect(ex.min_obs_correlacao).toBeGreaterThanOrEqual(24);
    expect(ex.justificativa_min_obs).toMatch(/espúria/i);
    expect(ex.rotulos_validos).toContain("sem evidência suficiente");
    expect(ex.rotulos_validos).toContain("não implica causalidade");
  });

  it("indicadores do explorador existem no gold de crédito (pulse.json)", () => {
    const pulse = load("public/obs/data/gold/pulse.json");
    for (const ind of curado.explorador.indicadores) {
      expect(pulse.series[ind.key], `série ${ind.key} ausente`).toBeTruthy();
    }
  });

  it("estudos: campos completos; WPs marcados; GASA nunca acima de E", () => {
    for (const e of curado.estudos) {
      for (const campo of ["desenho", "pais", "base", "resultado", "limitacoes", "aplicabilidade", "url", "tipo"]) {
        expect((e as any)[campo], `${e.id}.${campo}`).toBeTruthy();
      }
    }
    expect(curado.estudos.find((e: any) => e.id === "blascak2016").tipo).toMatch(/working paper/i);
    expect(curado.estudos.find((e: any) => e.id === "gasa2025").nivel).toBe("E");
  });
});

describe("fraudes: integração com a plataforma", () => {
  it("telemetria reconhece obs:fraudes", () => {
    expect(isViewSection("obs:fraudes")).toBe(true);
    expect(sectionLabel("obs:fraudes")).toMatch(/Fraudes/);
  });

  it("view registrada na SPA e pipeline copia todos os curados", () => {
    const app = readFileSync(join(process.cwd(), "public/obs/app.js"), "utf-8");
    expect(app).toContain('fraudes: "/financial-fraud"');
    expect(app).toContain('fraudes: ["fraudes"]'); // pulse agora é CORE_FILES
    expect(app).toContain('fraudes: "renderFraudes"');
    expect(app).toContain("function renderFraudes()");
    const html = readFileSync(join(process.cwd(), "public/obs/index.html"), "utf-8");
    expect(html).toContain('data-view="fraudes"');
    expect(html).toContain('id="view-fraudes"');
    const gold = readFileSync(join(process.cwd(), "pipeline/gold.py"), "utf-8");
    expect(gold).toContain("curated_dir");
    // sem modo demo/placeholder no bloco da view
    const bloco = app.slice(app.indexOf("function renderFraudes()"), app.indexOf("const RENDER = {"));
    expect(bloco).not.toMatch(/\bdemo\b|DEMONSTRATIVO|placeholder/i);
  });
});
