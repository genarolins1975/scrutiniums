import { describe, expect, it } from "vitest";
import { calcular, compararComCet, parcelaPrice, problemaDaEntrada, taxaAnualDeMensal, taxaMensalDeAnual } from "@/lib/credito/parcela";
import { lerNumero } from "@/components/credito/SimuladorParcela";

/**
 * Matemática do simulador do custo da dívida (/observatorio-do-credito/simulador-da-parcela): conversão de taxa por
 * capitalização composta, parcela pela tabela Price, casos de taxa zero e prazo de um mês, comparação com o CET.
 */
describe("conversão entre taxa anual e mensal (composta)", () => {
  it("1% ao mês equivale a 12,6825% ao ano, e a volta recupera a taxa", () => {
    expect(taxaAnualDeMensal(1)).toBeCloseTo(12.682503, 5);
    expect(taxaMensalDeAnual(12.682503013197)).toBeCloseTo(1, 9);
    for (const aa of [0, 7.18, 22.87, 440.15, 1353.46]) expect(taxaAnualDeMensal(taxaMensalDeAnual(aa))).toBeCloseTo(aa, 9);
  });

  it("não é a divisão simples por 12", () => {
    expect(taxaMensalDeAnual(24)).toBeCloseTo(1.8088, 4);
    expect(taxaMensalDeAnual(24)).not.toBeCloseTo(2, 2);
  });

  it("reproduz o par ao ano e ao mês que o Banco Central publica (juros.json)", () => {
    // BCO MERCEDES-BENZ, veículos PF: 0,58% ao mês e 7,18% ao ano, ambos publicados com duas casas
    expect(taxaAnualDeMensal(0.58)).toBeCloseTo(7.18, 1);
    expect(taxaMensalDeAnual(7.18)).toBeCloseTo(0.58, 2);
  });
});

describe("parcela pela tabela Price", () => {
  it("caso de referência: R$ 10.000 em 12 meses a 1% ao mês dá R$ 888,49", () => {
    expect(parcelaPrice(10_000, 1, 12)).toBeCloseTo(888.4879, 3);
  });

  it("taxa zero reparte o valor em parcelas iguais", () => {
    expect(parcelaPrice(12_000, 0, 12)).toBe(1000);
    const r = calcular({ valor: 12_000, meses: 12, anualPct: 0 });
    expect(r.parcela).toBe(1000);
    expect(r.total).toBe(12_000);
    expect(r.juros).toBe(0);
  });

  it("prazo de um mês devolve o valor mais um mês de juros", () => {
    expect(parcelaPrice(1000, 2, 1)).toBeCloseTo(1020, 9);
    const r = calcular({ valor: 1000, meses: 1, anualPct: taxaAnualDeMensal(2) });
    expect(r.parcela).toBeCloseTo(1020, 9);
    expect(r.juros).toBeCloseTo(20, 9);
  });

  it("o valor presente das parcelas, descontado à mesma taxa, é o valor tomado", () => {
    const valor = 25_000;
    const meses = 48;
    const r = calcular({ valor, meses, anualPct: 90.15 });
    const i = r.mensalPct / 100;
    let vp = 0;
    for (let k = 1; k <= meses; k++) vp += r.parcela / Math.pow(1 + i, k);
    expect(vp).toBeCloseTo(valor, 6);
    expect(r.total).toBeCloseTo(r.parcela * meses, 9);
    expect(r.juros).toBeCloseTo(r.total - valor, 9);
  });

  it("taxa maior dá parcela maior, e prazo maior dá parcela menor e mais juros", () => {
    const base = calcular({ valor: 10_000, meses: 24, anualPct: 30 });
    expect(calcular({ valor: 10_000, meses: 24, anualPct: 40 }).parcela).toBeGreaterThan(base.parcela);
    const longo = calcular({ valor: 10_000, meses: 48, anualPct: 30 });
    expect(longo.parcela).toBeLessThan(base.parcela);
    expect(longo.juros).toBeGreaterThan(base.juros);
  });
});

describe("comparação com o CET informado", () => {
  it("CET acima da taxa aumenta a parcela e o total; a diferença é declarada em reais e em %", () => {
    const c = compararComCet({ valor: 10_000, meses: 24, anualPct: 30 }, 36);
    expect(c.comCet.parcela).toBeGreaterThan(c.base.parcela);
    expect(c.diferencaTotal).toBeCloseTo((c.comCet.parcela - c.base.parcela) * 24, 9);
    expect(c.diferencaTotalPct).toBeCloseTo((c.diferencaTotal / c.base.total) * 100, 9);
    expect(c.diferencaTaxaPp).toBeCloseTo(6, 9);
  });

  it("CET igual à taxa não muda nada", () => {
    const c = compararComCet({ valor: 5000, meses: 10, anualPct: 22.87 }, 22.87);
    expect(c.diferencaTotal).toBeCloseTo(0, 9);
  });
});

describe("validação da entrada e leitura dos números digitados", () => {
  it("recusa valor, prazo e taxa fora do domínio com o motivo, e aceita os limites", () => {
    expect(problemaDaEntrada({ valor: 0, meses: 12, anualPct: 10 })).toMatch(/valor/);
    expect(problemaDaEntrada({ valor: 1000, meses: 0, anualPct: 10 })).toMatch(/prazo/);
    expect(problemaDaEntrada({ valor: 1000, meses: 1.5, anualPct: 10 })).toMatch(/prazo/);
    expect(problemaDaEntrada({ valor: 1000, meses: 12, anualPct: -1 })).toMatch(/taxa/);
    expect(problemaDaEntrada({ valor: 1000, meses: 12, anualPct: Number.NaN })).toMatch(/taxa/);
    expect(problemaDaEntrada({ valor: 1, meses: 1, anualPct: 0 })).toBeNull();
    expect(problemaDaEntrada({ valor: 1000, meses: 600, anualPct: 1353.46 })).toBeNull();
  });

  it("lê o padrão brasileiro e o ponto decimal; vazio ou texto vira NaN, nunca zero", () => {
    expect(lerNumero("10.000,50")).toBe(10000.5);
    expect(lerNumero("R$ 1.234")).toBe(1234);
    expect(lerNumero("22,48")).toBe(22.48);
    expect(lerNumero("22.48")).toBe(22.48);
    expect(lerNumero("24")).toBe(24);
    expect(lerNumero("10.000")).toBe(10000);
    expect(lerNumero("1.250.000")).toBe(1250000);
    expect(lerNumero("")).toBeNaN();
    expect(lerNumero("abc")).toBeNaN();
  });
});
