/* Trabalho de conteúdo depois da r7: respostas em duas camadas (veredito em palavras simples sempre à vista e os
 * números por trás só em Analisar e Auditar), identificadores técnicos fora de Entender e números conciliados no
 * ponto de uso. Os vereditos são derivados dos mesmos campos das respostas completas, não repetem a fórmula. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { conjuntoLegivel } from "@/lib/energia/evidencia";
import * as R from "@/lib/energia/rede";
import type { GoldRedeDetalhe } from "@/lib/energia/tipos-rede";

const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
const palavras = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
const numeros = (t: string) => (t.match(/\d[\d.,]*\d|\d/g) ?? []).length;
const G = JSON.parse(ler("public/energia/gold/rede_detalhe.json")) as GoldRedeDetalhe;

describe("RespostaCurta: veredito à vista, números por trás em Analisar", () => {
  const html = renderToStaticMarkup(createElement(RespostaCurta, { id: "p999", veredito: "O preço subiu.", vivo: true }, "Detalhe com 12 números."));

  it("o elemento externo leva data-resposta e é região viva só quando pedido", () => {
    expect(html).toMatch(/^<div data-resposta="p999" aria-live="polite"/);
    expect(renderToStaticMarkup(createElement(RespostaCurta, { id: "x", veredito: "v" }, "d"))).not.toContain("aria-live");
  });

  it("o veredito fica fora do bloco de Analisar e o detalhe dentro, com rótulo", () => {
    const fim = html.indexOf('data-nivel="analisar"');
    expect(fim).toBeGreaterThan(0);
    expect(html.slice(0, fim)).toContain("O preço subiu.");
    expect(html.slice(fim)).toContain("Os números por trás da resposta");
    expect(html.slice(fim)).toContain("Detalhe com 12 números.");
    expect(html.slice(0, fim)).not.toContain("Detalhe com 12 números.");
  });

  it("aceita outro atributo de resposta (filtros, ano, ficha)", () => {
    expect(renderToStaticMarkup(createElement(RespostaCurta, { id: "2025", atributo: "data-resposta-ano", veredito: "v" }, "d"))).toContain('data-resposta-ano="2025"');
  });
});

describe("Rede, balanço e exterior (P029): veredito", () => {
  const per = { inicio: G.cobertura.inicio, fim: G.cobertura.fim };

  it("em cada região o veredito é curto, tem poucos números e não perde a ressalva sobre a causa dos resíduos", () => {
    for (const sm of ["SIN", "SE", "S", "NE", "N"] as const) {
      const v = R.vereditoBalanco(G.balanco, sm, per);
      expect(v.length, sm).toBeGreaterThan(0);
      expect(palavras(v), sm).toBeLessThanOrEqual(50);
      expect(numeros(v), sm).toBeLessThanOrEqual(8);
      const completa = R.respostaBalanco(G.balanco, sm, per);
      expect(palavras(v), sm).toBeLessThan(palavras(completa));
      if (/A fonte não informa a causa dos resíduos/.test(completa)) expect(v, sm).toContain("não atribui causa");
    }
  });

  it("não diz 'todas as horas' quando há resíduo", () => {
    const comResiduo = (["SIN", "SE", "S", "NE", "N"] as const).filter((sm) => /residuo|resíduo/.test(R.respostaBalanco(G.balanco, sm, per)) && /A fonte não informa/.test(R.respostaBalanco(G.balanco, sm, per)));
    for (const sm of comResiduo) expect(R.vereditoBalanco(G.balanco, sm, per), sm).not.toContain("em todas as horas");
  });
});

describe("Fonte das fichas de evidência: código de conjunto fora do texto de Entender", () => {
  it("troca o código pelo nome legível e guarda o código para Analisar", () => {
    expect(conjuntoLegivel("PLD_HORARIO")).toEqual({ texto: "PLD horário por submercado", codigos: ["PLD_HORARIO"] });
    expect(conjuntoLegivel("PLD_HORARIO (PLD horário por submercado)")).toEqual({ texto: "PLD horário por submercado", codigos: ["PLD_HORARIO"] });
    expect(conjuntoLegivel("mre_mensal")).toEqual({ texto: "MRE mensal", codigos: ["mre_mensal"] });
    expect(conjuntoLegivel("GERACAO_SUBMERCADO e MRE_MENSAL")).toEqual({ texto: "geração por submercado e MRE mensal", codigos: ["GERACAO_SUBMERCADO", "MRE_MENSAL"] });
    expect(conjuntoLegivel("PARCELA_CARGA_CONSUMO (classe do perfil pelo cadastro LISTA_PERFIL_V1)").texto).toBe("classe do perfil pelo cadastro lista de perfis (versão 1)");
  });

  it("trata cada item separado por ponto e vírgula e preserva nomes que já são legíveis", () => {
    const r = conjuntoLegivel("PLD_HORARIO; Balanço de Energia nos Subsistemas");
    expect(r.texto).toBe("PLD horário por submercado; Balanço de Energia nos Subsistemas");
    expect(r.codigos).toEqual(["PLD_HORARIO"]);
    expect(conjuntoLegivel("EAR Diário por Subsistema")).toEqual({ texto: "EAR Diário por Subsistema", codigos: [] });
    expect(conjuntoLegivel("PRORET")).toEqual({ texto: "PRORET", codigos: [] });
  });
});
