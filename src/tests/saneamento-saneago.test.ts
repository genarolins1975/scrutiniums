import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PrecoRegulado from "@/app/saneamento/preco-regulado/page";
import Reajustes from "@/app/saneamento/preco-regulado/reajustes/page";
import TarifaSocialPage from "@/app/saneamento/tarifa-social/page";
import atos from "@/lib/saneamento/dados/atos.json";
import { prestador } from "@/lib/saneamento/gold";
import { TARIFAS, periodoConsultaTarifas, prestadorComTarifa, tarifa } from "@/lib/saneamento/tarifas";
import { CABECALHO_EXPORTACAO, CONSUMOS_EXPORTACAO, acimaDoLimite, calcularConta, leituras, linhasExportacao } from "@/lib/saneamento/conta";
import { csv } from "@/lib/saneamento/csv";
import { reais } from "@/lib/saneamento/formato";

/**
 * Saneago (GO), Resolução Conjunta 1/2026 AGR/AMAE, AGR/AR e AGR/ARM, vigente desde 01/04/2026.
 * Os valores esperados abaixo foram somados à mão a partir do Anexo Único, conferido nas três resoluções em 17/10/2026.
 */
const ID = "saneago-2026";
const conta = (cat: string, c: number) => calcularConta(tarifa(ID)!.categorias[cat], c);
const texto = (h: string) => h.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("Saneago: cálculo da conta", () => {
  it("residencial normal: tarifa básica soma à água e ao esgoto, que cobram por faixa em blocos", () => {
    expect(conta("residencial", 0).total).toBe(17.46); // só a tarifa básica
    expect(conta("residencial", 10).total).toBe(132.76); // 17,46 + 10 × 5,77 + 10 × 5,76
    expect(conta("residencial", 10).agua).toBe(75.16);
    expect(conta("residencial", 10).esgoto).toBe(57.6);
    expect(conta("residencial", 11).total).toBe(145.78); // + 6,51 de água e 6,51 de esgoto
    expect(conta("residencial", 20).total).toBe(272.36);
  });

  it("residencial normal: fronteiras de 50 m³ e acima", () => {
    expect(conta("residencial", 50).total).toBe(916.66); // 17,46 + 449,65 de água + 449,55 de esgoto
    expect(conta("residencial", 51).total).toBe(944.78); // + 14,06 de água e 14,06 de esgoto
  });

  it("residencial social: básica pela metade e faixas próprias até 20 m³", () => {
    expect(conta("social", 10).total).toBe(63.33); // 8,73 + 27,30 + 27,30
    expect(conta("social", 15).total).toBe(94.03);
    expect(conta("social", 20).total).toBe(129.23);
    const normal = conta("residencial", 10).total;
    expect(1 - conta("social", 10).total / normal).toBeGreaterThan(0.5);
  });

  it("a social não tem preço acima de 20 m³: o cálculo recusa em vez de extrapolar", () => {
    const social = tarifa(ID)!.categorias.social;
    expect(acimaDoLimite(social, 20)).toBe(false);
    expect(acimaDoLimite(social, 20.5)).toBe(true);
    expect(() => calcularConta(social, 21)).toThrow(RangeError);
    expect(acimaDoLimite(tarifa(ID)!.categorias.residencial, 500)).toBe(false);
  });

  it("custo de mais 1 m³: definido até 19 m³ na social e nulo a partir de 20", () => {
    const t = tarifa(ID)!;
    expect(leituras(t, "social", 19).m3Adicional).toBe(7.04); // 3,52 de água + 3,52 de esgoto
    expect(leituras(t, "social", 20).m3Adicional).toBeNull();
    expect(leituras(t, "residencial", 20).m3Adicional).toBe(16.9); // 8,45 + 8,45
  });

  it("só a social da Saneago (20 m³) e a social da Corsan (15 m³, três tabelas) têm teto de consumo", () => {
    for (const t of TARIFAS) {
      for (const [k, c] of Object.entries(t.categorias)) {
        const comTeto = k === "social" && (t.id === ID || (t.id.startsWith("corsan-") && t.categorias.social != null));
        expect(c.consumoMaximo != null, `${t.id} ${k}`).toBe(comTeto);
      }
    }
    expect(TARIFAS.filter((t) => t.categorias.social?.consumoMaximo === 15).map((t) => t.id)).toEqual(["corsan-2026", "corsan-canoas-esteio-2026", "corsan-santa-cruz-2026"]);
  });
});

describe("Saneago: exportação CSV das contas simuladas", () => {
  const linhas = linhasExportacao(TARIFAS);
  const col = (nome: (typeof CABECALHO_EXPORTACAO)[number]) => CABECALHO_EXPORTACAO.indexOf(nome);

  it("traz uma linha por tabela, categoria e consumo, inclusive acima do teto da categoria", () => {
    const categorias = TARIFAS.reduce((n, t) => n + Object.keys(t.categorias).length, 0);
    expect(linhas).toHaveLength(categorias * CONSUMOS_EXPORTACAO.length);
    for (const l of linhas) expect(l).toHaveLength(CABECALHO_EXPORTACAO.length);
  });

  it("acima do teto a linha fica com os valores vazios e a situação dita, e nas demais vem calculada", () => {
    const social = linhas.filter((l) => l[col("tabela")] === ID && l[col("categoria")] === "Residencial social");
    expect(social.map((l) => l[col("consumo_m3")])).toEqual(CONSUMOS_EXPORTACAO);
    const a30 = social.find((l) => l[col("consumo_m3")] === 30)!;
    expect([a30[col("agua_R$")], a30[col("esgoto_R$")], a30[col("total_R$")]]).toEqual([null, null, null]);
    expect(a30[col("situacao")]).toBe("sem preço no ato acima de 20 m³");
    const a20 = social.find((l) => l[col("consumo_m3")] === 20)!;
    expect(a20[col("total_R$")]).toBe(129.23);
    expect(a20[col("situacao")]).toBe("calculada");
    // uma linha da Saneago (30 m³) e duas de cada social da Corsan (20 e 30 m³, três tabelas)
    expect(linhas.filter((l) => l[col("situacao")] !== "calculada")).toHaveLength(1 + 3 * 2);
    expect(linhas.filter((l) => l[col("situacao")] === "sem preço no ato acima de 15 m³")).toHaveLength(3 * 2);
  });

  it("no arquivo, a célula vazia é ausência e a situação aparece na linha", () => {
    const texto = csv(CABECALHO_EXPORTACAO, linhas);
    expect(texto).toContain(";30;;;;sem preço no ato acima de 20 m³");
  });
});

describe("Saneago: registro da tabela", () => {
  const t = tarifa(ID)!;

  it("ato, vigência, fontes com sha256 das três resoluções e das regras de cobrança", () => {
    expect(t.ato).toContain("Resolução Conjunta nº 1/2026");
    expect(t.vigencia).toContain("01/04/2026");
    expect(t.fontes.length).toBeGreaterThanOrEqual(7);
    for (const f of t.fontes) {
      expect(f.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(f.url).toMatch(/^https:\/\//);
    }
    for (const sigla of ["AGR-AMAE", "AGR-AR", "AGR-ARM"]) expect(t.fontes.some((f) => f.url.includes(sigla))).toBe(true);
    expect(t.fontes.some((f) => f.url.includes("goias.gov.br/agr/perguntas-frequentes"))).toBe(true);
    expect(t.acessado).toBe("2026-10-17");
  });

  it("declara que o método de cobrança por faixa não foi verificado e quanto isso pesa", () => {
    expect(t.metodoNaoVerificado).toContain("não verificada em conta ou exemplo oficial");
    expect(t.metodoNaoVerificado).toContain("art. 103, parágrafo único");
    const agua20 = conta("residencial", 20).agua - t.categorias.residencial.agua.fixo!;
    expect(agua20).toBeCloseTo(127.5, 9);
    expect(t.metodoNaoVerificado).toContain("R$ 127,50");
    expect(t.metodoNaoVerificado).toContain("R$ 149,00"); // 20 × 7,45
    expect(t.observacoes.join(" ")).toContain("Não achei exemplo oficial de conta");
  });

  it("os municípios são os do prestador no SINISA 2024, com Goiânia, Anápolis e Rio Verde", () => {
    const p = prestador("saneago-saneamento-de-goias-s-a")!;
    expect([...t.municipios].sort()).toEqual([...p.municipios_agua].sort());
    for (const id of ["5208707", "5201108", "5218805"]) expect(prestadorComTarifa(id)).toBe(ID);
  });

  it("o período de consulta das tabelas vai de 14/10/2026 a 17/10/2026", () => {
    expect(periodoConsultaTarifas()).toBe("14/10/2026 a 17/10/2026");
  });
});

describe("Saneago: atos e páginas", () => {
  const lista = (atos as { atos: { prestador: string; verificado: boolean; ato: string; vigencia: string }[] }).atos;

  it("o catálogo traz os quatro reajustes de 2023 a 2026, lidos no texto oficial", () => {
    const sg = lista.filter((a) => a.prestador === "SANEAGO");
    expect(sg.map((a) => a.vigencia)).toEqual(["a partir de 01/04/2023", "a partir de 01/04/2024", "a partir de 01/04/2025", "a partir de 01/04/2026"]);
    expect(sg.every((a) => a.verificado)).toBe(true);
  });

  it("a página de reajustes mostra o prestador e nenhum prestador do catálogo fica de fora", () => {
    const h = texto(renderToStaticMarkup(createElement(Reajustes)));
    expect(h).toContain(`${lista.length} atos de 2023 a 2026 de ${new Set(lista.map((a) => a.prestador)).size} prestadores`);
    expect(h).toContain("SANEAGO em 17/10/2026");
    expect(h).toContain("SANEAGO · AGR");
    expect(h).not.toContain("AGR, AGR");
    for (const a of lista) expect(h, a.ato).toContain(a.ato);
  });

  it("o preço regulado lista o regulador na amostra e conta os prestadores a partir dos dados", () => {
    const h = texto(renderToStaticMarkup(createElement(PrecoRegulado)));
    expect(h).toContain("AGR, AR, AMAE e ARM");
    expect(h).toContain(`${TARIFAS.length} tabelas residenciais de ${new Set(TARIFAS.map((x) => x.prestadorSinisa)).size} prestadores`);
  });

  it("o capítulo 6 compara a social com a residencial da Saneago a 10 e 15 m³", () => {
    const h = texto(renderToStaticMarkup(createElement(TarifaSocialPage)));
    expect(h).toContain(reais(conta("social", 10).total));
    expect(h).toContain(reais(conta("residencial", 15).total));
  });
});
