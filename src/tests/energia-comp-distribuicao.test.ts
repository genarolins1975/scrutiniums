import { describe, expect, it } from "vitest";
import {
  alturaClasse,
  casasMarcas,
  contaEmpates,
  dominioLegivel,
  marcasEixo,
  massasPontuais,
  montaHistograma,
  percentilDe,
  quantil,
  quantis,
  resumo,
  textoValor,
} from "@/lib/energia/distribuicao";

/**
 * Distribuições do domínio Energia: o quantil da interface precisa ser o
 * mesmo do pipeline (comum.py, tipo 7), ausência nunca entra na conta e as
 * classes do histograma não podem perder nem duplicar observação.
 */

// amostra com PLD no piso (58,6), ausências e valores fora de ordem
const PLD = [58.6, 58.6, 58.6, 120.5, null, 77.25, 301.9, 58.6, 145.0, 99.99, undefined, 210.0, 58.6, 64.3];

describe("quantil tipo 7, igual ao pipeline", () => {
  it("reproduz os valores de pipeline/energia/gold/comum.py:quantil na mesma amostra", () => {
    // valores obtidos rodando comum.quantil e comum.percentil_de sobre esta amostra
    expect(quantil(PLD, 0.1)).toBe(58.6);
    expect(quantil(PLD, 0.25)).toBe(58.6);
    expect(quantil(PLD, 0.5)).toBeCloseTo(70.775, 10);
    expect(quantil(PLD, 0.75)).toBeCloseTo(126.625, 10);
    expect(quantil(PLD, 0.9)).toBeCloseTo(203.5, 10);
    expect(percentilDe(99.99, PLD)).toBe(62.5);
    expect(percentilDe(58.6, PLD)).toBeCloseTo(20.833333333333332, 12);
  });

  it("interpola entre vizinhos da amostra ordenada e trata casos-limite como o pipeline", () => {
    expect(quantil([3, 1, 2, 4], 0.25)).toBe(1.75);
    expect(quantil([7], 0.9)).toBe(7);
    expect(quantil([], 0.5)).toBeNull();
    expect(quantil([null, undefined], 0.5)).toBeNull();
    expect(quantis([10, 0, 5], [0, 0.5, 1])).toEqual([0, 5, 10]);
  });

  it("ausência e não finitos ficam fora; zero é observação", () => {
    expect(quantil([0, null, NaN, Infinity, 10], 0.5)).toBe(5);
    const r = resumo([0, null, NaN, 10]);
    expect(r.n).toBe(2);
    expect(r.semDado).toBe(2);
    expect(r.min).toBe(0);
  });

  it("recusa quantil fora de [0, 1]", () => {
    expect(() => quantil([1, 2], 90)).toThrow(RangeError);
  });

  it("resumo traz n, sem dado e os sete pontos", () => {
    const r = resumo(PLD);
    expect(r.n).toBe(12);
    expect(r.semDado).toBe(2);
    expect(r.min).toBe(58.6);
    expect(r.max).toBe(301.9);
    expect(r.mediana).toBeCloseTo(70.775, 10);
    expect(resumo([]).mediana).toBeNull();
  });
});

describe("empates num ponto", () => {
  it("conta empates exatos e com tolerância", () => {
    expect(contaEmpates(PLD, 58.6)).toBe(5);
    expect(contaEmpates([58.6, 58.6000001, 58.7], 58.6, 1e-6)).toBe(2);
  });

  it("massasPontuais encontra o piso e ignora valores sem repetição relevante", () => {
    const m = massasPontuais(PLD, 0.05);
    expect(m).toHaveLength(1);
    expect(m[0].valor).toBe(58.6);
    expect(m[0].contagem).toBe(5);
    expect(m[0].fracao).toBeCloseTo(5 / 12, 12);
    expect(massasPontuais([1, 2, 3], 0.05)).toEqual([]);
  });
});

describe("histograma", () => {
  const soma = (h: ReturnType<typeof montaHistograma>) =>
    h.classes.reduce((a, c) => a + c.contagem, 0) + h.massas.reduce((a, m) => a + m.contagem, 0) + h.foraDasClasses.abaixo + h.foraDasClasses.acima;

  it("largura fixa não erra a classe por ponto flutuante (0,3 / 0,1 = 2,999...)", () => {
    const h = montaHistograma([0.1, 0.2, 0.3, 0.35, 0.4], { largura: 0.1 });
    expect(h.classes.map((c) => [c.inicio, c.fim])).toEqual([
      [0.1, 0.2],
      [0.2, 0.3],
      [0.3, 0.4],
    ]);
    // 0,3 pertence a [0,3; 0,4]; o máximo 0,4 cai na última classe, fechada à direita
    expect(h.classes.map((c) => c.contagem)).toEqual([1, 1, 3]);
    expect(h.classes.at(-1)?.fechadaDireita).toBe(true);
    expect(h.classes[0].fechadaDireita).toBe(false);
  });

  it("limite inferior pertence à classe; valor igual a uma borda interna vai para a classe de cima", () => {
    const h = montaHistograma([0, 25, 49.999, 50, 100], { largura: 25 });
    expect(h.classes.map((c) => c.contagem)).toEqual([1, 2, 1, 1]);
    expect(soma(h)).toBe(5);
  });

  it("massa no piso sai das classes, preserva o total e os quantis consideram todas as observações", () => {
    const h = montaHistograma(PLD, { largura: 50, massas: [{ valor: 58.6, rotulo: "piso regulatório" }] });
    expect(h.massas[0].contagem).toBe(5);
    expect(h.massas[0].fracao).toBeCloseTo(5 / 12, 12);
    expect(h.classes.reduce((a, c) => a + c.contagem, 0)).toBe(7);
    expect(soma(h)).toBe(h.resumo.n);
    expect(h.resumo.n).toBe(12);
    expect(h.resumo.semDado).toBe(2);
    expect(h.resumo.p25).toBe(58.6);
    // sem a massa, a primeira classe começaria no piso; com ela, começa no menor valor restante
    expect(h.classes[0].inicio).toBe(50);
  });

  it("bordas definidas contam o que fica fora, sem descartar em silêncio", () => {
    const h = montaHistograma([-5, 0, 10, 20, 30, 45], { limites: [0, 10, 20, 30] });
    expect(h.classes.map((c) => c.contagem)).toEqual([1, 1, 2]);
    expect(h.foraDasClasses).toEqual({ abaixo: 1, acima: 1 });
    expect(soma(h)).toBe(6);
  });

  it("larguras diferentes viram densidade: classe larga não parece maior só por ser larga", () => {
    const h = montaHistograma([...Array(10).fill(5), ...Array(20).fill(30)], { limites: [0, 10, 50] });
    expect(h.larguraUniforme).toBe(false);
    expect(h.larguraReferencia).toBe(10);
    expect(alturaClasse(h.classes[0], h.larguraReferencia)).toBe(10);
    expect(alturaClasse(h.classes[1], h.larguraReferencia)).toBe(5);
  });

  it("recusa configurações que produziriam classes erradas", () => {
    expect(() => montaHistograma([1, 2], { limites: [0, 5, 5] })).toThrow(/crescentes/);
    expect(() => montaHistograma([1, 2], { largura: 0 })).toThrow(/positiva/);
    expect(() => montaHistograma([0, 1e6], { largura: 1 })).toThrow(/classes/);
    expect(() => montaHistograma([1], {})).toThrow(/largura/);
  });

  it("amostra só de ausências não inventa classe", () => {
    const h = montaHistograma([null, undefined], { largura: 10 });
    expect(h.classes).toEqual([]);
    expect(h.resumo.n).toBe(0);
    expect(h.resumo.semDado).toBe(2);
  });
});

describe("marcas de eixo", () => {
  it("domínio contém os dados, começa e termina em marca e não carrega lixo de ponto flutuante", () => {
    const d = dominioLegivel([0.13, 0.31, 0.29]);
    expect(d.min).toBeLessThanOrEqual(0.13);
    expect(d.max).toBeGreaterThanOrEqual(0.31);
    expect(d.marcas[0]).toBe(d.min);
    expect(d.marcas.at(-1)).toBe(d.max);
    for (const m of d.marcas) expect(String(m).length).toBeLessThan(6);
  });

  it("valores iguais ganham folga; incluirZero estende até zero", () => {
    const d = dominioLegivel([50, 50]);
    expect(d.min).toBeLessThan(50);
    expect(d.max).toBeGreaterThan(50);
    expect(dominioLegivel([40, 90], { incluirZero: true }).min).toBe(0);
    expect(dominioLegivel([-12, -3]).max).toBeLessThanOrEqual(0);
  });

  it("marcas e casas decimais", () => {
    expect(marcasEixo(0, 100, 4)).toEqual([0, 25, 50, 75, 100]);
    expect(casasMarcas([0, 0.5, 1])).toBe(1);
    expect(casasMarcas([0, 2.5, 5])).toBe(1);
    expect(casasMarcas([0, 0.25])).toBe(2);
    expect(casasMarcas([10, 20])).toBe(0);
  });
});

describe("texto de valor", () => {
  it("ausência é 'sem dado', zero é número e o menos é tipográfico", () => {
    expect(textoValor(null, 1, "R$/MWh")).toBe("sem dado");
    expect(textoValor(NaN, 1, "R$/MWh")).toBe("sem dado");
    expect(textoValor(0, 1, "R$/MWh")).toBe("0,0 R$/MWh");
    // arredonda antes do sinal: um valor que some no arredondamento não vira "−0,0"
    expect(textoValor(-0.04, 1, "")).toBe("0,0");
    expect(textoValor(-0.06, 1, "")).toBe("\u22120,1");
    expect(textoValor(-2.5, 1, "%")).toBe("−2,5%");
  });
});
