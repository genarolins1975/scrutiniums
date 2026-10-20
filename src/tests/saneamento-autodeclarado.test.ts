import { describe, expect, it, vi } from "vitest";
import { createElement, type FunctionComponent } from "react";

vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<typeof import("next/navigation")>("next/navigation")),
  useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {}, back: () => {}, forward: () => {}, refresh: () => {} }),
  usePathname: () => "/saneamento",
  useSearchParams: () => new URLSearchParams(),
}));
import { renderToStaticMarkup } from "react-dom/server";
import { agregado, agregados, municipio, municipios, prestador } from "@/lib/saneamento/gold";
import { AUTODECLARADO, MARCA_AUTODECLARADO } from "@/lib/saneamento/autodeclarado";
import { ATENDIMENTO_REDE, CASAS_ATENDIMENTO } from "@/lib/saneamento/atendimento";
import { CAPITULOS, EIXOS } from "@/lib/saneamento/capitulos";
import { MEDIDAS, MEDIDAS_GERAIS, medida } from "@/lib/saneamento/medidas";
import { MEDIDAS_PRESTADOR, notaMedidaPrestador } from "@/lib/saneamento/prestadores";
import { referencias } from "@/lib/saneamento/referencias";
import { fontesDe } from "@/lib/saneamento/respostas";
import { numero, reaisCompacto } from "@/lib/saneamento/formato";
import { cadeias } from "@/lib/observatorios/entradas/energia";

/**
 * Revisão da especialista em saneamento (20/10/2026): valores financeiros autodeclarados ao SINISA ficam só nos capítulos, com a
 * marca; população atendida com rede (IAG0001 e IES0001) nas páginas com conta, coerente com a aberta; "tarifa" no lugar de
 * "preço regulado"; consumo médio por pessoa na tabela 5.4.
 */
const texto = (h: string) => h.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ");
async function pagina(mod: string, props: object = {}) {
  const C = (await import(/* @vite-ignore */ mod)).default as FunctionComponent<object>;
  return renderToStaticMarkup(createElement(C, props));
}
const SP = "3550308";
const SABESP = "sabesp-companhia-de-saneamento-basico-do-estado-de-sao-paulo";

describe("Valores financeiros autodeclarados ao SINISA", () => {
  const br = agregado("BR")!;
  const invTotal = br.sinisa.agua.investimento!.total! + br.sinisa.esgoto.investimento!.total!;
  const fb = fontesDe(br);

  it("a entrada não tem o investimento nem a origem dos recursos em número, e os capítulos 9 e 10 dizem onde estão", async () => {
    const h = texto(await pagina("@/app/saneamento/page"));
    for (const v of [reaisCompacto(invTotal), reaisCompacto(fb.proprios), reaisCompacto(fb.onerosos)]) expect(h).not.toContain(v);
    expect(h).not.toMatch(/investidos em água e esgoto/i);
    expect(h).toContain(`Os valores ficam dentro do capítulo, com a ressalva: ${AUTODECLARADO}.`);
  }, 60_000);

  it("a página aberta não mostra valor em reais", async () => {
    const h = texto(await pagina("@/app/aperitivo/saneamento/page", { searchParams: { ibge: SP } }));
    expect(h).not.toMatch(/R\$\s?\d/);
    expect(h).not.toContain(reaisCompacto(invTotal));
  }, 60_000);

  it("a entrada da coleção de infraestrutura não traz o investimento como número", () => {
    const agua = cadeias().find((c) => c.id === "agua")!;
    const investir = agua.elos.find((e) => e.titulo === "Investir")!;
    expect(investir.numero).toBeUndefined();
    expect(agua.pergunta).not.toMatch(/invest/i);
  });

  it("os capítulos e fichas com valores financeiros levam a ressalva e a marca", async () => {
    const paginas: [string, object?][] = [
      ["@/app/saneamento/investimento/page"],
      ["@/app/saneamento/financiamento/page"],
      ["@/app/saneamento/preco-regulado/contrapartidas/page"],
      ["@/app/saneamento/prestadores/[id]/page", { params: { id: SABESP } }],
      ["@/app/saneamento/metodologia/page"],
    ];
    for (const [mod, props] of paginas) {
      const h = await pagina(mod, props);
      expect(h, mod).toContain("data-ressalva-autodeclarado");
      expect(texto(h), mod).toContain("autodeclarado ao SINISA, sem conferência com demonstrações financeiras auditadas");
    }
    const ficha = texto(await pagina("@/app/saneamento/municipio/[id]/page", { params: { id: SP } }));
    expect(ficha).toContain(MARCA_AUTODECLARADO);
    expect(ficha).not.toMatch(/declarado por prestadores e pelo Estado/);
  }, 120_000);

  it("o capítulo 9 diz quem declara: os prestadores, inclusive o investimento do governo estadual", async () => {
    const h = texto(await pagina("@/app/saneamento/investimento/page"));
    expect(h).toContain(reaisCompacto(invTotal));
    expect(h).toContain("Declarado ao SINISA pelos prestadores");
    expect(h).not.toMatch(/declarado (por prestadores e Estados|pelos Estados)/);
  }, 60_000);

  it("medidas e linhas financeiras estão marcadas, e só elas", () => {
    expect(MEDIDAS.filter((m) => m.financeira).map((m) => m.id)).toEqual(["sinisa-investimento-por-habitante"]);
    const fin = MEDIDAS_PRESTADOR.filter((m) => m.financeira).map((m) => m.id);
    expect(fin).toEqual(["receita_m3", "despesa_m3", "inv_agua", "inv_esgoto", "inv_hab", "margem_liquida", "endividamento"]);
    for (const m of MEDIDAS_PRESTADOR) expect(notaMedidaPrestador(m).includes(MARCA_AUTODECLARADO)).toBe(!!m.financeira);
  });
});

describe("População atendida com rede (IAG0001 e IES0001)", () => {
  const m = municipio(SP)!;

  it("as medidas existem no catálogo, entram na comparação e têm a referência oficial", () => {
    for (const id of ["sinisa-agua-atendida", "sinisa-esgoto-atendida"]) expect(MEDIDAS_GERAIS.some((x) => x.id === id)).toBe(true);
    expect(medida("sinisa-agua-atendida").pct(m)).toBe(m.IAG0001);
    expect(medida("sinisa-esgoto-atendida").pct(m)).toBe(m.IES0001);
    const refs = referencias(agregados(), municipios(), ["sinisa-agua-atendida", "sinisa-esgoto-atendida"]);
    expect(refs["sinisa-agua-atendida"].BR.pct).toBe(agregado("BR")!.sinisa.agua.indicadores.IAG0001);
    expect(refs["sinisa-esgoto-atendida"].BR.pct).toBe(agregado("BR")!.sinisa.esgoto.indicadores.IES0001);
    // ausência não vira zero
    const fora = municipios().find((x) => x.IES0001 == null)!;
    expect(medida("sinisa-esgoto-atendida").pct(fora)).toBeNull();
    expect(medida("sinisa-esgoto-atendida").contagem!(fora)).toBeNull();
  });

  it("página aberta e ficha completa mostram o mesmo valor, com o mesmo rótulo", async () => {
    const aberta = texto(await pagina("@/app/aperitivo/saneamento/page", { searchParams: { ibge: SP } }));
    const ficha = texto(await pagina("@/app/saneamento/municipio/[id]/page", { params: { id: SP } }));
    for (const [s, v] of [["agua", m.IAG0001], ["esgoto", m.IES0001]] as const) {
      const valor = `${numero(v, CASAS_ATENDIMENTO)}`;
      for (const h of [aberta, ficha]) {
        expect(h).toContain(ATENDIMENTO_REDE[s].rotulo);
        expect(h).toContain(valor);
        expect(h).toContain(ATENDIMENTO_REDE[s].contexto);
      }
    }
  }, 60_000);

  it("o capítulo de acesso tem a seção de atendimento declarado", async () => {
    const h = await pagina("@/app/saneamento/acesso/page");
    expect(h).toContain('id="atendimento-declarado"');
    const t = texto(h);
    expect(t).toContain(`${numero(agregado("BR")!.sinisa.agua.indicadores.IAG0001, CASAS_ATENDIMENTO)}%`);
    expect(t).toContain(`${numero(agregado("BR")!.sinisa.esgoto.indicadores.IES0001, CASAS_ATENDIMENTO)}%`);
  }, 60_000);
});

describe("Tarifa no lugar de preço regulado e consumo na tabela 5.4", () => {
  it("o registro de capítulos e as páginas do eixo não dizem preço regulado", async () => {
    const registro = JSON.stringify({ EIXOS, CAPITULOS });
    expect(registro).not.toMatch(/pre[çc]o regulado/i);
    for (const mod of ["@/app/saneamento/page", "@/app/saneamento/preco-regulado/page", "@/app/saneamento/preco-regulado/contrapartidas/page"]) {
      expect(texto(await pagina(mod)), mod).not.toMatch(/pre[çc]o regulado/i);
    }
  }, 60_000);

  it("a tabela 5.4 traz o consumo médio por pessoa (IAG2006, l/hab/dia) de cada prestador", async () => {
    const t = texto(await pagina("@/app/saneamento/preco-regulado/contrapartidas/page"));
    expect(t).toContain("Tarifa e serviço lado a lado");
    expect(t).toContain("Consumo médio por pessoa (2024)");
    const p = prestador(SABESP)!;
    expect(p.consumo_per_capita_agua).not.toBeNull();
    expect(t).toContain(`${numero(p.consumo_per_capita_agua, 1)} l/hab/dia`);
    expect(t).not.toContain("R$ 0,00");
  }, 60_000);
});
