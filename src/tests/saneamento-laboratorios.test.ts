import { describe, expect, it } from "vitest";
import { createElement, type FunctionComponent, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { agregado } from "@/lib/saneamento/gold";
import { ESTUDOS } from "@/lib/saneamento/dados/estudos";
import {
  ANO_CENSO_2010,
  ANO_CENSO_2022,
  ANO_PRAZO,
  BASE_SABESP,
  PARAMETROS_SABESP,
  PUBLICADO_SABESP,
  anoCivil,
  receitaATarifa,
  ritmoAteMeta,
  variarSabesp,
} from "@/lib/saneamento/laboratorios";
import { LabReceitaTarifa, LabRitmoMeta } from "@/components/saneamento/Laboratorios";
import { PosicaoMunicipio } from "@/components/saneamento/PosicaoMunicipio";
import PrecoRegulado from "@/app/saneamento/preco-regulado/page";
import Planejamento from "@/app/saneamento/planejamento/page";
import FichaMunicipio from "@/app/saneamento/municipio/[id]/page";

/**
 * Modelos didáticos da etapa 2B: da receita à tarifa média (Sabesp, ARSESP), ritmo até a meta na régua do Censo e
 * posição do município na ficha. As contas são conferidas por caminho independente, a partir dos números publicados
 * e da gold, sem repetir a implementação.
 */
const texto = (h: string) => h.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");
function bruto<P extends object>(c: (p: P) => ReactNode, p?: P): string {
  return renderToStaticMarkup(createElement(c as unknown as FunctionComponent<P>, p ?? ({} as P)));
}
const html = <P extends object>(c: (p: P) => ReactNode, p?: P) => texto(bruto(c, p));

describe("Da receita à tarifa média (Sabesp, 1º reajuste)", () => {
  const sabesp = ESTUDOS.find((e) => e.id === "sabesp-2026")!;

  it("com os valores publicados, reproduz a receita requerida e a tarifa média base da NT da ARSESP", () => {
    const r = receitaATarifa(PARAMETROS_SABESP);
    expect(Math.abs(r.receitaRequerida - 25348.7)).toBeLessThan(0.01);
    expect(r.tarifaMedia.toFixed(4)).toBe("6.7828");
    expect(PUBLICADO_SABESP).toEqual({ receitaRequerida: 25348.7, tarifaMediaBase: 6.7828, componentesFinanceiros: -0.0155, tarifaEquilibrio: 6.7673 });
  });

  it("base × WACC reproduz a linha de remuneração do capital do estudo", () => {
    const linha = sabesp.receita.linhas.find((l) => l.rotulo === "Remuneração do capital")!;
    expect(BASE_SABESP).toBeCloseTo(88660.4, 2);
    expect(Math.abs((BASE_SABESP * 11.91) / 100 - linha.valor!)).toBeLessThan(0.01);
    expect(PARAMETROS_SABESP.wacc).toBe(11.91);
    // Custos = OPEX + outras despesas + receitas irrecuperáveis, somados à mão a partir da NT (PDF p.56).
    expect(PARAMETROS_SABESP.custos).toBeCloseTo(9670.47 + 1531.17 + 411.56, 6);
    expect(PARAMETROS_SABESP.deducoes).toBeCloseTo(405.72, 6);
    expect(PARAMETROS_SABESP.volume).toBe(3677.38);
  });

  it("um ponto de WACC muda a tarifa em base ÷ 100 ÷ volume; volume maior baixa a tarifa na proporção", () => {
    const base = receitaATarifa(PARAMETROS_SABESP).tarifaMedia;
    const mais1 = receitaATarifa(variarSabesp({ custosPct: 0, basePct: 0, wacc: 12.91, volumePct: 0 })).tarifaMedia;
    expect(mais1 - base).toBeCloseTo(BASE_SABESP / 100 / 3677.38, 9);
    const vol = receitaATarifa(variarSabesp({ custosPct: 0, basePct: 0, wacc: 11.91, volumePct: 10 })).tarifaMedia;
    expect(vol).toBeCloseTo(base / 1.1, 9);
  });

  it("o laboratório se identifica como modelo didático, mostra o publicado e diz o que deixa de fora", () => {
    const h = html(LabReceitaTarifa);
    expect(h).toContain("Modelo didático");
    expect(h).toContain("R$ 6,7828/m³");
    expect(h).toContain("Igual à tarifa média base publicada pela ARSESP");
    expect(h).toContain("O que este modelo deixa de fora");
    expect(h).toContain("6,7673");
    expect(h).toContain("A tarifa média não é o preço do seu metro cúbico");
  });

  it("a entrada do capítulo 5 traz o laboratório", () => {
    expect(bruto(PrecoRegulado)).toContain('data-laboratorio="lab-receita-tarifa"');
  });
});

describe("Ritmo até a meta (régua do Censo)", () => {
  const br = agregado("BR")!;
  const c10 = br.censo2010!;
  const es10 = (c10.esgoto_rede_pluvial! / c10.esgoto_moradores!) * 100;
  const m22 = br.censo2022.moradores!;
  const es22 = (m22.esgoto.rede_pluvial! / m22.esgoto.total!) * 100;

  it("datas de referência e prazo: 12 anos entre os Censos e 11 anos e 5 meses até 31/12/2033", () => {
    expect(ANO_CENSO_2022 - ANO_CENSO_2010).toBe(12);
    expect((ANO_PRAZO - ANO_CENSO_2022) * 12).toBeCloseTo(137, 9);
  });

  it("Brasil, esgoto: observado e exigido conferidos com a gold", () => {
    const r = ritmoAteMeta({ v2010: es10, v2022: es22, meta: 90 }, 0);
    expect([+es10.toFixed(1), +es22.toFixed(1)]).toEqual([52.8, 58.3]);
    expect(r.observado).toBeCloseTo((es22 - es10) / 12, 9);
    expect(r.exigido).toBeCloseTo(((90 - es22) * 12) / 137, 9);
    expect(r.razao).toBeCloseTo(r.exigido / r.observado, 9);
    expect(r.anoMeta).toBeNull();
    expect(r.em2033).toBeCloseTo(es22, 9);
  });

  it("no ritmo exigido, chega à meta no fim de 2033; acima de 100% a projeção para em 100%", () => {
    const exigido = ritmoAteMeta({ v2010: es10, v2022: es22, meta: 90 }, 0).exigido;
    const r = ritmoAteMeta({ v2010: es10, v2022: es22, meta: 90 }, exigido);
    expect(r.em2033).toBeCloseTo(90, 9);
    expect(r.anoMeta).toBeCloseTo(ANO_PRAZO, 9);
    expect(ritmoAteMeta({ v2010: 90, v2022: 95, meta: 99 }, 5).em2033).toBe(100);
  });

  it("território já na meta: exigido zero, sem razão, meta no próprio 2022", () => {
    const r = ritmoAteMeta({ v2010: 98, v2022: 99.5, meta: 99 }, 0.1);
    expect(r.exigido).toBe(0);
    expect(r.razao).toBeNull();
    expect(anoCivil(r.anoMeta!)).toBe(2022);
  });

  it("ano civil: 2030,3 cai em 2030 e 2034,0 é o fim de 2033", () => {
    expect(anoCivil(2030.3)).toBe(2030);
    expect(anoCivil(2034)).toBe(2033);
  });

  it("o laboratório abre no Brasil, esgoto, no ritmo observado, com a ressalva de régua", () => {
    const h = html(Planejamento);
    expect(bruto(Planejamento)).toContain('data-laboratorio="lab-ritmo-meta"');
    expect(h).toContain("Modelo didático · projeção aritmética");
    expect(h).toContain("Brasil, esgoto: rede geral ou pluvial: 52,8% em 2010 e 58,3% em 2022");
    expect(h).toContain(`${((es22 - es10) / 12).toFixed(2).replace(".", ",")} p.p. por ano`);
    expect(h).toContain("Chegar à meta nesta régua não equivale a cumprir a lei");
    expect(h).toContain("Região Norte");
  });

  it("extrapolação além de 2100 não vira ano: a frase diz só que a meta fica para depois", () => {
    const h = html(LabRitmoMeta, {
      territorios: [{ id: "X", nome: "Teste", grupo: "Brasil e regiões", agua: { v2010: 90, v2022: 91 }, esgoto: { v2010: 47, v2022: 48 } }],
      metas: { agua: 99, esgoto: 90 },
    });
    expect(h).toContain("Neste ritmo, a meta de 90% não seria alcançada antes de 2100.");
    expect(h).not.toMatch(/alcançada em 2[1-9]\d\d/);
  });

  it("LabRitmoMeta sem território com série não quebra a página", () => {
    expect(bruto(LabRitmoMeta, { territorios: [], metas: { agua: 99, esgoto: 90 } })).toBe("");
  });
});

describe("Posição do município na ficha", () => {
  it("estende o eixo quando algum valor passa de 100% e escreve ausência como 'sem dado'", () => {
    const h = html(PosicaoMunicipio, {
      uf: "SP",
      linhas: [{ rotulo: "Esgoto tratado sobre coletado (IES2004)", fonte: "SINISA 2024", m: 140, uf: 80, br: 70, pares: null }],
    });
    expect(h).toContain("150%");
    expect(h).toContain("Pares, mediana: sem dado");
    expect(h).toContain("Município: 140,0%");
  });

  it("a ficha de São Paulo traz a figura com as seis medidas percentuais antes da tabela", () => {
    const h = bruto(FichaMunicipio, { params: { id: "3550308" } });
    const i = h.indexOf('data-figura="posicao-municipio"');
    expect(i).toBeGreaterThan(-1);
    expect(i).toBeLessThan(h.indexOf("Medidas do município, da UF, do Brasil e mediana dos pares"));
    const figura = texto(h.slice(i, h.indexOf("</figure>", i)));
    for (const r of ["IAG0001", "IES0001", "IES2004", "IAG2013", "sem ligação à rede geral de água", "sem rede de esgoto nem fossa séptica"]) expect(figura).toContain(r);
  });
});
