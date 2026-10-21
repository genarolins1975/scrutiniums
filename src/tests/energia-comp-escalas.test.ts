import { describe, expect, it } from "vitest";
import {
  NAO_SE_APLICA,
  SEM_DADO,
  casasDoPasso,
  classeDe,
  classificar,
  diferencaPar,
  dominioBonito,
  dominioComZero,
  empilhar,
  escalaLinear,
  formatarDiferenca,
  formatarValor,
  ordenarComNulos,
  ordenarPares,
  quantil,
  quebrasFixas,
  quebrasIntervalosIguais,
  quebrasQuantis,
  rotuloTick,
  sentidoDiferenca,
  ticksBonitos,
  ticksComPasso,
} from "@/lib/energia/escalas";

/**
 * Escalas, classes e ordenação dos gráficos do Setor Elétrico
 * (src/lib/energia/escalas.ts). Os casos cobrem os erros que distorcem a
 * leitura: barra sem zero, tick arredondado para outro número, "−0,0",
 * ausência somada como zero, classe vazia por empate, fronteira de classe
 * ambígua e "sem dado" no topo de uma ordenação.
 */

describe("ticks bonitos", () => {
  it("usa passos 1, 2, 2,5, 5 e 10 e inclui os extremos múltiplos do passo", () => {
    expect(ticksBonitos(0, 10)).toEqual([0, 2.5, 5, 7.5, 10]);
    expect(ticksBonitos(0, 100)).toEqual([0, 25, 50, 75, 100]);
    expect(ticksBonitos(0.3, 1.1)).toEqual([0.4, 0.6, 0.8, 1]);
  });

  it("não perde o tick do mínimo por resíduo de ponto flutuante", () => {
    // −2,3 / 0,1 = −22,999999999999996: Math.ceil sozinho pularia o −2,3
    expect(ticksComPasso(-2.3, -1.9, 0.1)).toEqual([-2.3, -2.2, -2.1, -2, -1.9]);
    expect(dominioComZero([-2.3, 0.2], 25).ticks[0]).toBe(-2.3);
  });

  it("zero nunca sai como zero negativo", () => {
    const t = ticksBonitos(-0.5, 10);
    expect(t).toContain(0);
    expect(t.some((v) => Object.is(v, -0))).toBe(false);
  });

  it("o rótulo do tick respeita as casas do passo: 2,5 não vira 3", () => {
    expect(casasDoPasso(2.5)).toBe(1);
    expect(casasDoPasso(0.25)).toBe(2);
    expect(casasDoPasso(5)).toBe(0);
    expect(ticksBonitos(0, 10).map((t) => rotuloTick(t, 2.5))).toEqual(["0,0", "2,5", "5,0", "7,5", "10,0"]);
    expect(rotuloTick(-5, 5)).toBe("−5");
    expect(rotuloTick(12000, 5000)).toBe("12.000");
  });
});

describe("domínio de barras com zero obrigatório", () => {
  it("só positivos: começa em zero e cobre o máximo com folga até o próximo passo", () => {
    const d = dominioComZero([3, 9.2, null]);
    expect(d.min).toBe(0);
    expect(d.max).toBeGreaterThanOrEqual(9.2);
    expect(d.ticks[0]).toBe(0);
    expect(d.ticks.at(-1)).toBe(d.max);
  });

  it("só negativos: termina em zero", () => {
    const d = dominioComZero([-3, -7]);
    expect(d.max).toBe(0);
    expect(d.min).toBeLessThanOrEqual(-7);
    expect(d.ticks).toContain(0);
  });

  it("valores mistos: zero é tick e os dois extremos cabem", () => {
    const d = dominioComZero([-4, 10]);
    expect(d.min).toBeLessThanOrEqual(-4);
    expect(d.max).toBeGreaterThanOrEqual(10);
    expect(d.ticks).toContain(0);
    // o domínio é múltiplo do passo: os ticks começam e terminam nos extremos
    expect(d.ticks[0]).toBe(d.min);
    expect(d.ticks.at(-1)).toBe(d.max);
  });

  it("nulos não viram zero nem estendem o domínio; sem nenhum valor, 0 a 1", () => {
    expect(dominioComZero([null, undefined, Number.NaN])).toMatchObject({ min: 0, max: 1 });
    expect(dominioComZero([0, 0])).toMatchObject({ min: 0, max: 1 });
    expect(dominioComZero([5, null]).min).toBe(0);
  });

  it("sem zero obrigatório (pontos), o domínio acompanha os dados", () => {
    const d = dominioBonito([10.2, 10.9]);
    expect(d.min).toBeGreaterThan(9);
    expect(d.max).toBeLessThan(12);
    expect(dominioBonito([10.2, 10.9], { zero: true }).min).toBe(0);
    // valor único abre faixa dos dois lados, sem colapsar a escala
    const u = dominioBonito([7]);
    expect(u.min).toBeLessThan(7);
    expect(u.max).toBeGreaterThan(7);
  });
});

describe("escala linear", () => {
  it("mapeia e inverte, inclusive com faixa invertida (eixo Y do SVG)", () => {
    const y = escalaLinear([0, 10], [300, 20]);
    expect(y(0)).toBe(300);
    expect(y(10)).toBe(20);
    expect(y(5)).toBe(160);
    expect(y.inversa(160)).toBe(5);
  });

  it("domínio degenerado não produz NaN", () => {
    const x = escalaLinear([3, 3], [0, 100]);
    expect(Number.isFinite(x(3))).toBe(true);
    expect(Number.isFinite(x.inversa(50))).toBe(true);
  });
});

describe("empilhamento", () => {
  it("positivos sobem e negativos descem a partir de zero, cada lado com sua soma", () => {
    const p = empilhar([3, -2, 4, -1]);
    expect(p.segmentos).toEqual([
      { inicio: 0, fim: 3 },
      { inicio: 0, fim: -2 },
      { inicio: 3, fim: 7 },
      { inicio: -2, fim: -3 },
    ]);
    expect(p).toMatchObject({ positivo: 7, negativo: -3, total: 4, completo: true });
  });

  it("parte ausente não vira segmento zero e marca a pilha como incompleta", () => {
    const p = empilhar([3, null, 4]);
    expect(p.segmentos[1]).toBeNull();
    expect(p.segmentos[2]).toEqual({ inicio: 3, fim: 7 });
    expect(p.completo).toBe(false);
  });

  it("zero é parte presente: a pilha continua completa", () => {
    expect(empilhar([0, 2]).completo).toBe(true);
  });

  it("soma sem resíduo de ponto flutuante", () => {
    expect(empilhar([0.1, 0.2]).positivo).toBe(0.3);
  });
});

describe("formatação de valores de gráfico", () => {
  it("ausência é 'sem dado', nunca 0 nem traço", () => {
    expect(formatarValor(null, 1, "MWh")).toBe("sem dado");
    expect(formatarValor(undefined)).toBe("sem dado");
    expect(formatarValor(Number.NaN)).toBe("sem dado");
  });

  it("arredonda antes do sinal: −0,04 com uma casa é 0,0, não −0,0", () => {
    expect(formatarValor(-0.04, 1, "MW")).toBe("0,0 MW");
    expect(formatarDiferenca(-0.04, 1, "p.p.")).toBe("0,0 p.p.");
  });

  it("percentual cola o símbolo; negativo usa o sinal tipográfico", () => {
    expect(formatarValor(12.345, 1, "%")).toBe("12,3%");
    expect(formatarValor(-1234.5, 1, "GWh")).toBe("−1.234,5 GWh");
    expect(formatarDiferenca(2.26, 1, "p.p.")).toBe("+2,3 p.p.");
    expect(formatarDiferenca(-1.26, 1)).toBe("−1,3");
  });

  it("diferença e sentido: nulo em qualquer lado não gera diferença; sentido na precisão exibida", () => {
    expect(diferencaPar(10, 8)).toBe(2);
    expect(diferencaPar(0.3, 0.1)).toBe(0.2);
    expect(diferencaPar(null, 8)).toBeNull();
    expect(diferencaPar(10, undefined)).toBeNull();
    expect(sentidoDiferenca(2, 1)).toBe("acima");
    expect(sentidoDiferenca(-0.3, 1)).toBe("abaixo");
    // 0,04 aparece como "0,0": dizer "acima" contradiria o número mostrado
    expect(sentidoDiferenca(0.04, 1)).toBe("igual");
    expect(sentidoDiferenca(null)).toBeNull();
  });
});

describe("ordenação com nulos", () => {
  const itens = [
    { nome: "b", v: 5 },
    { nome: "a", v: null },
    { nome: "c", v: 9 },
    { nome: "d", v: Number.NaN },
    { nome: "e", v: 1 },
  ];

  it("nulos (e NaN) vão para o fim nas duas direções", () => {
    expect(ordenarComNulos(itens, (t) => t.v, "desc").map((t) => t.nome)).toEqual(["c", "b", "e", "a", "d"]);
    expect(ordenarComNulos(itens, (t) => t.v, "asc").map((t) => t.nome)).toEqual(["e", "b", "c", "a", "d"]);
  });

  it("empates mantêm a ordem original também na ordem decrescente", () => {
    const empate = [
      { nome: "x", v: 2 },
      { nome: "y", v: 2 },
      { nome: "z", v: 3 },
    ];
    expect(ordenarComNulos(empate, (t) => t.v, "desc").map((t) => t.nome)).toEqual(["z", "x", "y"]);
  });

  it("nomes seguem a collation pt-BR (acento não joga o nome para depois do Z)", () => {
    const nomes = ["Enel", "Équatorial", "Cemig", "Águas", "Zeta", "aguas claras"].map((n) => ({ n }));
    expect(ordenarComNulos(nomes, (t) => t.n, "asc").map((t) => t.n)).toEqual(["Águas", "aguas claras", "Cemig", "Enel", "Équatorial", "Zeta"]);
  });

  it("não altera o arranjo recebido", () => {
    const copia = itens.map((t) => t.nome);
    ordenarComNulos(itens, (t) => t.v, "desc");
    expect(itens.map((t) => t.nome)).toEqual(copia);
  });

  it("pares por diferença: sem um dos valores vai para o fim, com desempate por nome", () => {
    const pares = [
      { rotulo: "Beta", valor: 5, referencia: 9 },
      { rotulo: "Alfa", valor: 10, referencia: 8 },
      { rotulo: "Delta", valor: 6, referencia: null },
      { rotulo: "Gama", valor: null, referencia: 7 },
      { rotulo: "Épsilon", valor: 7, referencia: 7 },
    ];
    expect(ordenarPares(pares, "diferenca", "desc").map((p) => p.rotulo)).toEqual(["Alfa", "Épsilon", "Beta", "Delta", "Gama"]);
    expect(ordenarPares(pares, "diferenca", "asc").map((p) => p.rotulo)).toEqual(["Beta", "Épsilon", "Alfa", "Delta", "Gama"]);
    expect(ordenarPares(pares, "valor", "asc").map((p) => p.rotulo)).toEqual(["Beta", "Delta", "Épsilon", "Alfa", "Gama"]);
    expect(ordenarPares(pares, "nome", "desc").map((p) => p.rotulo)).toEqual(["Gama", "Épsilon", "Delta", "Beta", "Alfa"]);
  });
});

describe("quebras de classe para mapas", () => {
  it("quantil tipo 7 (interpolação linear)", () => {
    expect(quantil([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantil([1, 2, 3, 4], 0)).toBe(1);
    expect(quantil([1, 2, 3, 4], 1)).toBe(4);
    expect(Number.isNaN(quantil([], 0.5))).toBe(true);
  });

  it("quantis: classes equilibradas, cortes arredondados às casas do rótulo", () => {
    const c = quebrasQuantis([9, 1, 5, 3, 7, 2, 8, 4, 6], 3, { casas: 1 });
    expect(c.cortes).toEqual([3.7, 6.3]);
    expect(c.classes.map((k) => k.contagem)).toEqual([3, 3, 3]);
    expect(c.classes.map((k) => k.rotulo)).toEqual(["menos de 3,7", "3,7 a menos de 6,3", "6,3 ou mais"]);
    expect(c).toMatchObject({ minimo: 1, maximo: 9, validos: 9 });
  });

  it("quantis com empates: menos classes do que o pedido, nunca classe vazia nem valor em duas classes", () => {
    const c = quebrasQuantis([0, 0, 0, 0, 1, 2], 3, { casas: 1 });
    expect(c.cortes).toEqual([0.3]);
    expect(c.classes.map((k) => k.contagem)).toEqual([4, 2]);
    expect(c.classes.every((k) => k.contagem > 0)).toBe(true);
  });

  it("ausência e 'não se aplica' ficam fora das classes e são contadas à parte", () => {
    const c = quebrasQuantis([1, null, 2, NAO_SE_APLICA, 3, undefined, 4], 2);
    expect(c.validos).toBe(4);
    expect(c.semDado).toBe(2);
    expect(c.naoSeAplica).toBe(1);
    expect(c.classes.reduce((s, k) => s + k.contagem, 0)).toBe(4);
  });

  it("intervalos iguais dividem a amplitude observada", () => {
    const c = quebrasIntervalosIguais([0, 1, 4, 6, 10], 4, { casas: 1 });
    expect(c.cortes).toEqual([2.5, 5, 7.5]);
    expect(c.classes.map((k) => k.contagem)).toEqual([2, 1, 1, 1]);
  });

  it("todos os valores iguais: uma classe só, com rótulo do valor", () => {
    const c = quebrasIntervalosIguais([5, 5, 5], 4, { casas: 0 });
    expect(c.cortes).toEqual([]);
    expect(c.classes).toHaveLength(1);
    expect(c.classes[0].rotulo).toBe("5");
    expect(classeDe(5, c)).toBe(0);
  });

  it("quebras fixas: limite inferior inclusivo, extremos abertos e formatação do chamador", () => {
    const c = quebrasFixas([5, 10, 20], [0, 4.99, 5, 12, 25, null], { formatar: (v) => `${v}%` });
    expect(c.classes.map((k) => k.rotulo)).toEqual(["menos de 5%", "5% a menos de 10%", "10% a menos de 20%", "20% ou mais"]);
    expect(c.classes.map((k) => k.contagem)).toEqual([2, 1, 1, 1]);
    expect(classeDe(4.99, c)).toBe(0);
    expect(classeDe(5, c)).toBe(1);
    expect(classeDe(20, c)).toBe(3);
    expect(classeDe(-100, c)).toBe(0);
    expect(classeDe(1e9, c)).toBe(3);
  });

  it("quebras fixas não descartam classe vazia (também é informação)", () => {
    const c = quebrasFixas([5, 10], [1, 2, 30]);
    expect(c.classes.map((k) => k.contagem)).toEqual([2, 0, 1]);
  });

  it("quebras fixas fora de ordem ou vazias são erro de programação", () => {
    expect(() => quebrasFixas([10, 5])).toThrow();
    expect(() => quebrasFixas([5, 5])).toThrow();
    expect(() => quebrasFixas([Number.NaN])).toThrow();
    expect(() => quebrasFixas([])).toThrow();
  });

  it("classe de um valor: zero é dado; ausência é sem-dado; não se aplica é estado próprio", () => {
    const c = classificar([0, 1, 2, 3, 4, 5, 6, 7], { metodo: "quantis", classes: 4 });
    expect(classeDe(0, c)).toBe(0);
    expect(classeDe(null, c)).toBe(SEM_DADO);
    expect(classeDe(undefined, c)).toBe(SEM_DADO);
    expect(classeDe(Number.NaN, c)).toBe(SEM_DADO);
    expect(classeDe(Number.POSITIVE_INFINITY, c)).toBe(SEM_DADO);
    expect(classeDe(NAO_SE_APLICA, c)).toBe("nao-se-aplica");
    expect(classeDe(7, c)).toBe(c.classes.length - 1);
  });

  it("sem nenhum valor válido não há classe possível", () => {
    const c = quebrasQuantis([null, null], 3);
    expect(c.classes).toEqual([]);
    expect(classeDe(3, c)).toBe(SEM_DADO);
  });

  it("atalho classificar escolhe o método", () => {
    expect(classificar([1, 2, 3], { metodo: "fixas", cortes: [2] }).metodo).toBe("fixas");
    expect(classificar([1, 2, 3], { metodo: "intervalos-iguais", classes: 2 }).metodo).toBe("intervalos-iguais");
  });
});
