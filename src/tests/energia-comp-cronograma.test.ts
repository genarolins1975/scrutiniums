import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Cronograma, type CronogramaProps } from "@/components/energia/Cronograma";
import {
  diaSerial,
  diferencaDatas,
  precisaoData,
  somarDias,
  somarHoras,
  somarMeses,
  textoDiferencaComSinal,
  ticksTempo,
} from "@/lib/energia/calendario";
import {
  alternarEstado,
  atrasoDoMarco,
  estadosDisponiveis,
  filtrarPorEstado,
  previsaoMaisRecente,
  previsaoVigenteEm,
  rotuloAtraso,
  textoAtraso,
  type ItemCronograma,
  type MarcoCronograma,
} from "@/lib/energia/cronograma";

/**
 * Cronograma de expansão (src/components/energia/Cronograma.tsx,
 * src/lib/energia/cronograma.ts e src/lib/energia/calendario.ts). Os casos
 * cobrem os erros que falsificam um cronograma: data inválida aceita pelo
 * Date, fim de mês transbordando, diferença em dias entre datas que só têm
 * mês, previsão "vigente" escolhida pela ordem do arquivo em vez da data em
 * que foi informada, atraso calculado sem data-base declarada, previsão
 * tratada como realizado e ausência exibida como atraso zero.
 */

describe("calendário", () => {
  it("rejeita datas que o Date aceitaria em silêncio", () => {
    expect(precisaoData("2026-02-30")).toBeNull();
    expect(precisaoData("2026-13")).toBeNull();
    expect(diaSerial("2024-02-29")).not.toBeNull();
    expect(diaSerial("2023-02-29")).toBeNull();
    expect(precisaoData("2027-03")).toBe("mes");
  });

  it("soma sem transbordar o fim do mês e sem depender do fuso", () => {
    expect(somarMeses("2024-03-31", -1)).toBe("2024-02-29");
    expect(somarMeses("2023-03-31", -1)).toBe("2023-02-28");
    expect(somarMeses("2026-01", -1)).toBe("2025-12");
    expect(somarDias("2026-10-31", 1)).toBe("2026-11-01");
    expect(somarHoras("2026-10-31T23:00", 2)).toBe("2026-11-01T01:00");
  });

  it("diferença em dias entre datas completas e em meses quando uma ponta só tem mês", () => {
    expect(diferencaDatas("2025-01-01", "2025-05-01")).toEqual({ valor: 120, unidade: "dias" });
    expect(diferencaDatas("2025-03-31", "2025-04-01")).toEqual({ valor: 1, unidade: "dias" });
    expect(diferencaDatas("2025-03", "2025-04-15")).toEqual({ valor: 1, unidade: "meses" });
    expect(diferencaDatas("2025-06-10", "2025-03")).toEqual({ valor: -3, unidade: "meses" });
    expect(diferencaDatas(null, "2025-03")).toBeNull();
    expect(textoDiferencaComSinal({ valor: -3, unidade: "meses" })).toBe("−3 meses");
    expect(textoDiferencaComSinal({ valor: 1, unidade: "dias" })).toBe("+1 dia");
  });

  it("marcas de eixo: meses em período curto, anos em período longo, nunca mais que o máximo", () => {
    const curto = ticksTempo(diaSerial("2026-01-15") as number, diaSerial("2026-05-20") as number, 6);
    expect(curto.map((t) => t.rotulo)).toEqual(["fev/26", "mar/26", "abr/26", "mai/26"]);
    const longo = ticksTempo(diaSerial("2016-06-01") as number, diaSerial("2031-02-01") as number, 6);
    expect(longo.length).toBeLessThanOrEqual(6);
    expect(longo.every((t) => /^\d{4}$/.test(t.rotulo) && t.iso.endsWith("-01-01"))).toBe(true);
  });
});

const marcoA: MarcoCronograma = {
  id: "oc",
  rotulo: "Operação comercial",
  // fora de ordem de propósito: a vigente é a última INFORMADA até a data-base
  previsoes: [
    { data: "2025-06-01", informadaEm: "2023-03-01", snapshot: "RALIE mar/2023" },
    { data: "2025-01-01", informadaEm: "2022-01-10", snapshot: "outorga" },
    { data: "2025-09-01", informadaEm: "2024-02-01" },
  ],
  realizado: "2025-05-01",
};

describe("previsão vigente e atraso", () => {
  it("previsão vigente é a última informada até a data (inclusive), não a última do arquivo", () => {
    expect(previsaoVigenteEm(marcoA.previsoes, "2022-06-30")?.data).toBe("2025-01-01");
    expect(previsaoVigenteEm(marcoA.previsoes, "2023-03-01")?.data).toBe("2025-06-01");
    expect(previsaoVigenteEm(marcoA.previsoes, "2021-12-31")).toBeNull();
    expect(previsaoMaisRecente(marcoA.previsoes)?.data).toBe("2025-09-01");
  });

  it("sem data-base declarada não há atraso, mesmo com previsões e realizado", () => {
    const a = atrasoDoMarco(marcoA, null);
    expect(a.estado).toBe("sem-data-base");
    expect(rotuloAtraso(a)).toBe("");
  });

  it("realizado contra a previsão vigente na data-base; previsto só quando ainda não realizado", () => {
    const base = { data: "2022-06-30", rotulo: "cronograma da outorga" };
    const a = atrasoDoMarco(marcoA, base);
    expect(a).toMatchObject({ estado: "realizado", diferenca: { valor: 120, unidade: "dias" } });
    expect(rotuloAtraso(a)).toBe("+120 dias");
    expect(textoAtraso(a)).toBe("realizado com atraso de 120 dias sobre a data-base");

    const p = atrasoDoMarco({ ...marcoA, realizado: null }, base);
    expect(p).toMatchObject({ estado: "previsto", diferenca: { valor: 243, unidade: "dias" } });
    expect(rotuloAtraso(p)).toBe("+243 dias (prev.)");
    expect(textoAtraso(p)).toContain("ainda não realizado");
  });

  it("sem previsão vigente na data-base: 'sem base', nunca atraso zero", () => {
    const a = atrasoDoMarco(marcoA, { data: "2021-01-01", rotulo: "antes da outorga" });
    expect(a.estado).toBe("sem-previsao-na-base");
    expect(rotuloAtraso(a)).toBe("sem base");
  });

  it("antecipação tem sinal de menos; precisão de mês gera diferença em meses", () => {
    const m: MarcoCronograma = { id: "x", rotulo: "x", previsoes: [{ data: "2026-06", informadaEm: "2024-01-01" }], realizado: "2026-03-20" };
    const a = atrasoDoMarco(m, { data: "2024-12-31", rotulo: "base" });
    expect(a).toMatchObject({ estado: "realizado", diferenca: { valor: -3, unidade: "meses" } });
    expect(rotuloAtraso(a)).toBe("−3 meses");
    expect(textoAtraso(a)).toBe("realizado 3 meses antes da data-base");
  });
});

const itens: ItemCronograma[] = [
  { id: "u1", rotulo: "UHE Alfa", estado: "Em construção", detalhe: "1.200 MW · PA", marcos: [marcoA, { id: "enchimento", rotulo: "Enchimento do reservatório", previsoes: [] }] },
  { id: "u2", rotulo: "EOL Beta", estado: "Em operação", marcos: [{ id: "oc", rotulo: "Operação comercial", previsoes: [{ data: "2024-03-01", informadaEm: "2021-05-01" }], realizado: "2024-02-20" }] },
  { id: "u3", rotulo: "UFV Gama", estado: "Em construção", marcos: [{ id: "oc", rotulo: "Operação comercial", previsoes: [{ data: "2026-12-01", informadaEm: "2023-01-01" }] }] },
];

describe("filtro por estado", () => {
  it("estados em ordem pt-BR com contagem; null é todos e lista vazia é nenhum", () => {
    expect(estadosDisponiveis(itens)).toEqual([
      { estado: "Em construção", total: 2 },
      { estado: "Em operação", total: 1 },
    ]);
    expect(filtrarPorEstado(itens, null)).toHaveLength(3);
    expect(filtrarPorEstado(itens, [])).toHaveLength(0);
    expect(filtrarPorEstado(itens, ["Em operação"]).map((i) => i.id)).toEqual(["u2"]);
  });

  it("remarcar todos volta a null (uma só forma para 'todos')", () => {
    const todos = ["Em construção", "Em operação"];
    const so = alternarEstado(null, "Em operação", todos);
    expect(so).toEqual(["Em construção"]);
    expect(alternarEstado(so, "Em operação", todos)).toBeNull();
  });
});

const html = (p: Partial<CronogramaProps> = {}) => renderToStaticMarkup(createElement(Cronograma, { titulo: "Cronograma das usinas", itens, ...p }));

describe("Cronograma no servidor", () => {
  it("sem data-base: nenhuma coluna de atraso e a razão escrita", () => {
    const m = html();
    expect(m).toContain("Atraso não calculado: nenhuma data-base foi declarada");
    expect(m).not.toContain("data-atraso");
    expect(m).not.toContain('data-forma="base"');
    expect(m).not.toMatch(/<th[^>]*>Atraso<\/th>/);
  });

  it("previsto vazado e realizado cheio: formas e preenchimentos distintos", () => {
    const m = html();
    const alfa = m.match(/<g role="img" aria-label="UHE Alfa, Operação comercial[^"]*"[^>]*>([\s\S]*?)<\/g>/)?.[1] ?? "";
    expect(alfa.match(/data-forma="previsao"[^>]*fill="var\(--cor-superficie\)"/g)).toHaveLength(3);
    expect(alfa.match(/data-recente="sim"/g)).toHaveLength(1);
    expect(alfa).toMatch(/data-forma="realizado"[^>]*fill="var\(--cor-carvao\)"/);
  });

  it("marco sem previsão nem realizado diz 'sem dado' e não desenha marca", () => {
    const m = html();
    const ench = m.match(/<g role="img" aria-label="UHE Alfa, Enchimento do reservatório[^"]*"[^>]*>([\s\S]*?)<\/g>/)?.[1] ?? "";
    expect(ench).toContain('data-estado="sem-dado"');
    expect(ench).not.toContain("data-forma");
  });

  it("com data-base: losango na previsão vigente, atraso realizado, previsto e 'sem base' distintos", () => {
    const m = html({ dataBase: { data: "2022-06-30", rotulo: "cronograma da outorga" } });
    expect(m).toContain('data-forma="base"');
    expect(m).toMatch(/data-atraso="realizado"[^>]*>\+120 dias</);
    expect(m).toMatch(/data-atraso="sem-previsao-na-base"[^>]*>sem base</);
    // UFV Gama: previsão informada depois da data-base não serve de régua
    expect(m).toMatch(/aria-label="UFV Gama, Operação comercial:[^"]*atraso não calculado: não havia previsão vigente na data-base"/);
    expect(m).toMatch(/<th scope="col"[^>]*>Atraso<\/th>/);
    expect(m).toContain('data-linha="data-base"');
  });

  it("filtro por estado: caixas nativas com contagem, estado inicial aplicado e 'Mostrar todos' ativo", () => {
    const m = html({ estadosIniciais: ["Em operação"] });
    expect(m).toMatch(/<legend[^>]*>Filtrar por estado<\/legend>/);
    expect(m).toMatch(/<input type="checkbox"[^>]*checked=""[^>]*\/>Em operação/);
    expect(m).toMatch(/<input type="checkbox"(?![^>]*checked)[^>]*\/>Em construção/);
    expect(m).toMatch(/aria-disabled="false"[^>]*>Mostrar todos/);
    expect(m).toContain("EOL Beta");
    expect(m).not.toContain("UHE Alfa");
  });

  it("um só marco na ordem de tabulação (tabindex itinerante) e tabela com todas as previsões", () => {
    const m = html();
    expect(m.match(/<g role="img"[^>]*tabindex="0"/g)).toHaveLength(1);
    expect(m.match(/<g role="img"[^>]*tabindex="-1"/g)).toHaveLength(3);
    expect(m).toContain("Cronograma em tabela (4 marcos)");
    expect(m).toContain("01/01/2025, informada em 10/01/2022 (outorga)");
    expect(m).toContain("sem previsão registrada");
  });

  it("filtro que esvazia a lista diz isso, sem gráfico vazio", () => {
    const m = html({ estados: [] });
    expect(m).toContain("Nenhum item no filtro de estado selecionado.");
  });
});
