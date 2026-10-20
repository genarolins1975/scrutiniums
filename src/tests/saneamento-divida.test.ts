import { describe, expect, it, vi } from "vitest";

// O cabeçalho comum usa o roteador do Next, que não existe na renderização estática do teste.
vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<typeof import("next/navigation")>("next/navigation")),
  useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {}, back: () => {}, forward: () => {}, refresh: () => {} }),
  usePathname: () => "/saneamento/prestadores/divida",
  useSearchParams: () => new URLSearchParams(),
}));

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Pagina from "@/app/saneamento/prestadores/divida/page";
import Entrada from "@/app/saneamento/page";
import Aperitivo from "@/app/aperitivo/saneamento/page";
import { Cabecalho } from "@/components/saneamento/Cabecalho";
import { capituloPorSlug, ROTA } from "@/lib/saneamento/capitulos";
import { APERITIVOS, ehRotaPublica } from "@/lib/rotasPublicas";
import { comPonto, fotografia, goldDivida, mediana, periodoPorExtenso, reaisDeMil, resumoDivida, ROTA_DIVIDA, vezes } from "@/lib/saneamento/divida";
import { inteiro, numero } from "@/lib/saneamento/formato";
import { VIABILIDADE } from "@/lib/saneamento/viabilidade";

/**
 * Capítulo 7.1 do Saneamento: dívida e alavancagem das prestadoras com demonstrações na CVM (pipeline/saneamento_divida).
 * Trava: página com conta e registrada no capítulo 7 e no menu; números da abertura calculados da gold; toda companhia com
 * ponto na tabela; ausência escrita como ausência, com motivo; lacuna do prazo médio declarada; arquivos com conta; convite
 * do aperitivo dimensionado pela publicação.
 */
const raiz = process.cwd();
const texto = (h: string) => h.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");
const g = goldDivida()!;
const html = renderToStaticMarkup(createElement(Pagina));
const t = texto(html);

describe("gold do capítulo 7.1", () => {
  it("existe, com fontes da CVM, data de referência trimestral e companhias esperadas", () => {
    expect(g).not.toBeNull();
    expect(g.fontes.dfp.pagina).toMatch(/^https:\/\/dados\.cvm\.gov\.br\//);
    expect(g.fontes.itr.pagina).toMatch(/^https:\/\/dados\.cvm\.gov\.br\//);
    for (const a of [...g.fontes.dfp.arquivos, ...g.fontes.itr.arquivos]) {
      expect(a.url).toMatch(/^https:\/\/dados\.cvm\.gov\.br\/dados\/CIA_ABERTA\/DOC\/(DFP|ITR)\/DADOS\//);
      expect(a.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(g.referencia_trimestral).toMatch(/^\d{4}-(03-31|06-30|09-30|12-31)$/);
    const nomes = comPonto(g).map((c) => c.nome);
    for (const n of ["Sabesp", "Copasa", "Sanepar", "Casan", "Aegea Saneamento", "BRK Ambiental Participações", "Iguá Saneamento"]) expect(nomes).toContain(n);
  });

  it("dívida líquida é dívida bruta menos caixa, e ausência vem com motivo", () => {
    for (const c of g.companhias) {
      for (const p of [...c.anual, ...c.trimestral]) {
        if (p.retido) continue;
        if (p.divida_bruta != null && p.caixa != null) expect(p.divida_liquida).toBeCloseTo(p.divida_bruta - p.caixa, 2);
        for (const k of ["dl_ebitda", "dl_pl", "parcela_cp", "cobertura"] as const) if (p[k] == null) expect(p.motivos[k], `${c.nome} ${p.periodo} ${k}`).toBeTruthy();
      }
    }
  });

  it("o resumo do convite confere com a gold", () => {
    const r = resumoDivida()!;
    expect(r.hash_dados).toBe(g.hash_dados);
    expect(r.companhias).toBe(comPonto(g).length);
    expect(r.operadoras + r.holdings).toBe(r.companhias);
  });
});

describe("página /saneamento/prestadores/divida", () => {
  it("é painel com conta: a página e os arquivos não abrem sem sessão e não há aperitivo próprio", () => {
    expect(ehRotaPublica(ROTA_DIVIDA)).toBe(false);
    for (const a of ["divida.json", "resumo.json", "divida_anual.csv", "divida_trimestral.csv"]) {
      expect(existsSync(join(raiz, "public", "saneamento", "divida", a)), a).toBe(true);
      expect(ehRotaPublica(`/saneamento/divida/${a}`), a).toBe(false);
    }
    expect(APERITIVOS.some((a) => a.rota === ROTA_DIVIDA || a.painelCompleto === ROTA_DIVIDA)).toBe(false);
  });

  it("está registrada no capítulo 7, no menu do Saneamento, na entrada e na matriz de viabilidade", () => {
    const sub = capituloPorSlug("prestadores")!.subpaineis!.find((s) => s.slug === "divida")!;
    expect(sub.numero).toBe("7.1");
    expect(sub.naNavegacao).toBe(true);
    expect(`${ROTA}/prestadores/${sub.slug}`).toBe(ROTA_DIVIDA);
    const menu = renderToStaticMarkup(createElement(Cabecalho, { atual: "prestadores/divida" }));
    expect(menu).toContain(`href="${ROTA_DIVIDA}"`);
    expect(menu).toContain('aria-current="page"');
    expect(renderToStaticMarkup(createElement(Entrada))).toContain(`href="${ROTA_DIVIDA}"`);
    expect(VIABILIDADE.some((v) => v.capitulo === "7.1")).toBe(true);
  });

  it("a abertura traz os números calculados da gold, com período e fonte", () => {
    const f = fotografia(g);
    expect(t).toContain(sub().pergunta);
    expect(t).toContain(inteiro(comPonto(g).length));
    expect(t).toContain(reaisDeMil(f.dividaBruta));
    expect(t).toContain(vezes(f.medianaDlEbitda));
    expect(t).toContain(`${numero(f.parcelaCp, 1)}%`);
    expect(t).toContain(periodoPorExtenso(f.operadoras[0].ultimo!.periodo));
    const razoes = f.operadoras.map((c) => c.ultimo!.dl_ebitda).filter((v): v is number => v != null);
    expect(f.medianaDlEbitda).toBe(mediana(razoes));
  });

  it("toda companhia com ponto aparece na tabela, e ausência é 'sem leitura' com nota, nunca zero", () => {
    for (const c of comPonto(g)) expect(t, c.nome).toContain(c.nome);
    const semRazao = comPonto(g).filter((c) => c.ultimo!.dl_ebitda == null);
    for (const c of semRazao) expect(t).toContain(`${c.nome}, dívida líquida sobre EBITDA: ${c.ultimo!.motivos.dl_ebitda}`);
    expect(t).toContain("sem leitura");
  });

  it("artefato didático, série, lacuna do prazo médio, método recolhido e arquivos", () => {
    expect(html).toContain('data-laboratorio="alavancagem"');
    expect(t).toContain("Modelo didático");
    expect(html).toContain("data-serie-divida");
    expect(t).toContain("Prazo médio da dívida (duration)");
    expect(t).toContain("não estima prazo médio");
    expect(html).toMatch(/<details[^>]*>\s*<summary/);
    for (const a of ["divida_anual.csv", "divida_trimestral.csv", "divida.json"]) expect(html).toContain(`href="/saneamento/divida/${a}"`);
    for (const i of g.inconsistencias) expect(t).toContain(i.nome);
  });

  it("texto da página e do componente sem travessão", () => {
    for (const a of ["src/app/saneamento/prestadores/divida/page.tsx", "src/components/saneamento/Divida.tsx", "src/lib/saneamento/divida.ts"]) {
      expect(readFileSync(join(raiz, a), "utf-8"), a).not.toMatch(/—|–/);
    }
    expect(t).not.toMatch(/—|–/);
  });
});

describe("convite do aperitivo do Saneamento", () => {
  it("diz que o painel completo traz a dívida das companhias com demonstrações na CVM, dimensionada pela publicação", () => {
    const r = resumoDivida()!;
    const a = texto(renderToStaticMarkup(createElement(Aperitivo, { searchParams: {} })));
    expect(a).toContain(`Dívida e alavancagem das ${inteiro(r.companhias)} companhias de água e esgoto com demonstrações financeiras na CVM`);
    expect(a).toContain(`série anual desde ${r.primeiro_ano}`);
  });
});

function sub() {
  return capituloPorSlug("prestadores")!.subpaineis!.find((s) => s.slug === "divida")!;
}
