import { describe, expect, it } from "vitest";
import { inteiro as inteiroNucleo, decimal, reaisExtenso, reaisCurto, reaisCompleto, reaisInteiro, percentual, contagem } from "@/lib/eficiencia/formato";
import { numero as numeroEntrada, inteiro as inteiroEntrada, diferenca as diferencaEntrada } from "@/lib/eficiencia/entrada-nucleo";
import { formata, formataEixo, formataCompleto, type MedidaId } from "@/lib/eficiencia/consulta";
import type { IndicadorId } from "@/lib/eficiencia/tipos";

type Esperado = { pt: string; en: string };
function congelarCasos<T extends object>(entradas: readonly T[]): readonly Readonly<T>[] {
  return Object.freeze(entradas.map((entrada) => Object.freeze(entrada)));
}

// Literais independentes: só números mudam de locale. Unidades, sufixos e
// fallbacks permanecem PT; não é prova de tradução de páginas, frases ou CSV.
// Os espaços monetários são U+0020; Intl usa '-' e diferencaEntrada usa '−'.
describe("OBEE: núcleo numérico e precisão preservada", () => {
  it.each(congelarCasos([
    { nome: "agrupamento", valor: 1234.56, pt: "1.235", en: "1,235" },
    { nome: "meio negativo sem Math.round", valor: -0.5, pt: "-1", en: "-1" },
    { nome: "zero negativo", valor: -0, pt: "-0", en: "-0" },
    { nome: "NaN", valor: NaN, pt: "NaN", en: "NaN" },
    { nome: "infinito", valor: Infinity, pt: "∞", en: "∞" },
    { nome: "infinito negativo", valor: -Infinity, pt: "-∞", en: "-∞" },
  ]))("inteiro: $nome", ({ valor, pt, en }) => {
    expect(inteiroNucleo(valor)).toBe(pt);
    expect(inteiroNucleo(valor, "pt")).toBe(pt);
    expect(inteiroNucleo(valor, "en")).toBe(en);
  });

  const decimais = congelarCasos<Esperado & { nome: string; formatar: typeof decimal; valor: number; casas?: number }>([
    { nome: "decimal padrão", formatar: decimal, valor: 1234.56, pt: "1.234,6", en: "1,234.6" },
    { nome: "decimal zero casas", formatar: decimal, valor: 1234.56, casas: 0, pt: "1.235", en: "1,235" },
    { nome: "decimal duas casas", formatar: decimal, valor: 1234.56, casas: 2, pt: "1.234,56", en: "1,234.56" },
    { nome: "decimal três seleciona uma casa", formatar: decimal, valor: 1234.56, casas: 3, pt: "1.234,6", en: "1,234.6" },
    { nome: "decimal zero negativo", formatar: decimal, valor: -0, casas: 2, pt: "-0,00", en: "-0.00" },
    { nome: "percentual herda precisão sem multiplicar", formatar: percentual, valor: 1234.56, casas: 3, pt: "1.234,6%", en: "1,234.6%" },
    { nome: "percentual padrão e zero", formatar: percentual, valor: 0, pt: "0,0%", en: "0.0%" },
  ]);
  it.each(decimais)("$nome", ({ formatar, valor, casas, pt, en }) => {
    expect(casas === undefined ? formatar(valor) : formatar(valor, casas)).toBe(pt);
    expect(formatar(valor, casas, "pt")).toBe(pt);
    expect(formatar(valor, casas, "en")).toBe(en);
  });

  const moedas = congelarCasos<Esperado & { nome: string; formatar: typeof reaisExtenso; valor: number }>([
    { nome: "extenso abaixo de mil", formatar: reaisExtenso, valor: 123.5, pt: "R$ 123,50", en: "R$ 123.50" },
    { nome: "extenso negativo em mil", formatar: reaisExtenso, valor: -1234.5, pt: "R$ -1,2 mil", en: "R$ -1.2 mil" },
    { nome: "extenso milhão singular", formatar: reaisExtenso, valor: 1500000, pt: "R$ 1,5 milhão", en: "R$ 1.5 milhão" },
    { nome: "extenso milhão plural", formatar: reaisExtenso, valor: 2500000, pt: "R$ 2,5 milhões", en: "R$ 2.5 milhões" },
    { nome: "extenso singular pelo valor bruto", formatar: reaisExtenso, valor: 1999999999, pt: "R$ 2,00 bilhão", en: "R$ 2.00 bilhão" },
    { nome: "extenso fronteira do plural", formatar: reaisExtenso, valor: 2000000000, pt: "R$ 2,00 bilhões", en: "R$ 2.00 bilhões" },
    { nome: "extenso não troca escala arredondada", formatar: reaisExtenso, valor: 999999999, pt: "R$ 1.000,0 milhões", en: "R$ 1,000.0 milhões" },
    { nome: "extenso conserva infinito", formatar: reaisExtenso, valor: Infinity, pt: "R$ ∞ bilhões", en: "R$ ∞ bilhões" },
    { nome: "curto abaixo de mil", formatar: reaisCurto, valor: 123.5, pt: "R$ 124", en: "R$ 124" },
    { nome: "curto mil", formatar: reaisCurto, valor: 1234.5, pt: "R$ 1 mil", en: "R$ 1 mil" },
    { nome: "curto milhão", formatar: reaisCurto, valor: 1234567, pt: "R$ 1 mi", en: "R$ 1 mi" },
    { nome: "curto bilhão sem mínimo decimal", formatar: reaisCurto, valor: 1000000000, pt: "R$ 1 bi", en: "R$ 1 bi" },
    { nome: "curto bilhão com máximo uma casa", formatar: reaisCurto, valor: 1250000000, pt: "R$ 1,3 bi", en: "R$ 1.3 bi" },
    { nome: "completo negativo e espaço comum", formatar: reaisCompleto, valor: -1234.5, pt: "R$ -1.234,50", en: "R$ -1,234.50" },
    { nome: "inteiro negativo e espaço comum", formatar: reaisInteiro, valor: -1234.5, pt: "R$ -1.235", en: "R$ -1,235" },
  ]);
  it.each(moedas)("$nome", ({ formatar, valor, pt, en }) => {
    expect(formatar(valor)).toBe(pt);
    expect(formatar(valor, "pt")).toBe(pt);
    expect(formatar(valor, "en")).toBe(en);
  });

  it.each(congelarCasos([
    { valor: 1234, pt: "1.234 matrículas", en: "1,234 matrículas" },
    { valor: 1, pt: "1 matrícula", en: "1 matrícula" },
    { valor: 1.4, pt: "1 matrículas", en: "1 matrículas" },
  ]))("contagem escolhe o rótulo pelo valor bruto $valor", ({ valor, pt, en }) => {
    expect(contagem(valor, "matrícula", "matrículas")).toBe(pt);
    expect(contagem(valor, "matrícula", "matrículas", "pt")).toBe(pt);
    expect(contagem(valor, "matrícula", "matrículas", "en")).toBe(en);
  });

  it("não deixa o idioma de uma chamada alterar o default das seguintes", () => {
    expect([
      reaisCompleto(1234.5, "en"), reaisCompleto(1234.5),
      reaisCompleto(1234.5, "pt"), reaisCompleto(1234.5, "en"),
    ]).toEqual(["R$ 1,234.50", "R$ 1.234,50", "R$ 1.234,50", "R$ 1,234.50"]);
  });
});

describe("OBEE: Entrada mantém suas guardas, arredondamento e unidade", () => {
  const numeros = congelarCasos<Esperado & { nome: string; valor: number | null; unidade: string; casas?: number }>([
    { nome: "moeda padrão", valor: 1234.5, unidade: "R$", pt: "R$ 1.234,50", en: "R$ 1,234.50" },
    { nome: "percentual padrão", valor: 1234.5, unidade: "%", pt: "1.234,5%", en: "1,234.5%" },
    { nome: "outra unidade negativa", valor: -1234.5, unidade: "habitantes", pt: "-1.234,5 habitantes", en: "-1,234.5 habitantes" },
    { nome: "três casas explícitas", valor: 1234.567, unidade: "h", casas: 3, pt: "1.234,567 h", en: "1,234.567 h" },
    { nome: "unidade vazia conserva espaço final", valor: 0, unidade: "", casas: 0, pt: "0 ", en: "0 " },
    { nome: "moeda zero negativo", valor: -0, unidade: "R$", pt: "R$ -0,00", en: "R$ -0.00" },
    { nome: "ausência", valor: null, unidade: "R$", pt: "Não disponível", en: "Não disponível" },
    { nome: "NaN", valor: NaN, unidade: "R$", pt: "Não disponível", en: "Não disponível" },
    { nome: "infinito", valor: Infinity, unidade: "R$", pt: "Não disponível", en: "Não disponível" },
    { nome: "infinito negativo", valor: -Infinity, unidade: "R$", pt: "Não disponível", en: "Não disponível" },
  ]);
  it.each(numeros)("número: $nome", ({ valor, unidade, casas, pt, en }) => {
    expect(casas === undefined ? numeroEntrada(valor, unidade) : numeroEntrada(valor, unidade, casas)).toBe(pt);
    expect(numeroEntrada(valor, unidade, casas, "pt")).toBe(pt);
    expect(numeroEntrada(valor, unidade, casas, "en")).toBe(en);
  });

  it.each(congelarCasos<Esperado & { nome: string; valor: number | null }>([
    { nome: "agrupamento", valor: 1234.5, pt: "1.235", en: "1,235" },
    { nome: "Math.round anterior ao locale", valor: -0.5, pt: "-0", en: "-0" },
    { nome: "ausência", valor: null, pt: "Não disponível", en: "Não disponível" },
    { nome: "NaN preservado", valor: NaN, pt: "NaN", en: "NaN" },
    { nome: "infinito preservado", valor: Infinity, pt: "∞", en: "∞" },
    { nome: "infinito negativo preservado", valor: -Infinity, pt: "-∞", en: "-∞" },
  ]))("inteiro: $nome", ({ valor, pt, en }) => {
    expect(inteiroEntrada(valor)).toBe(pt);
    expect(inteiroEntrada(valor, "pt")).toBe(pt);
    expect(inteiroEntrada(valor, "en")).toBe(en);
  });

  const diferencas = congelarCasos<Esperado & { nome: string; a: number | null; b: number | null; unidade: string }>([
    { nome: "percentual vira p.p.", a: 1234.5, b: 0, unidade: "%", pt: "+1.234,5 p.p.", en: "+1,234.5 p.p." },
    { nome: "moeda negativa", a: 0, b: 1234.5, unidade: "R$", pt: "−R$ 1.234,50", en: "−R$ 1,234.50" },
    { nome: "outra unidade", a: 1234.5, b: 0, unidade: "h", pt: "+1.234,5 h", en: "+1,234.5 h" },
    { nome: "empate", a: 2, b: 2, unidade: "R$", pt: "R$ 0,00", en: "R$ 0.00" },
    { nome: "dentro da tolerância", a: 5e-10, b: 0, unidade: "%", pt: "0,0 p.p.", en: "0.0 p.p." },
    { nome: "limite positivo estrito", a: 1e-9, b: 0, unidade: "%", pt: "+0,0 p.p.", en: "+0.0 p.p." },
    { nome: "limite negativo estrito", a: -1e-9, b: 0, unidade: "%", pt: "−0,0 p.p.", en: "−0.0 p.p." },
    { nome: "primeiro operando ausente", a: null, b: 1, unidade: "%", pt: "Diferença indisponível", en: "Diferença indisponível" },
    { nome: "segundo operando ausente", a: 1, b: null, unidade: "%", pt: "Diferença indisponível", en: "Diferença indisponível" },
    { nome: "NaN sem guarda nova", a: NaN, b: 0, unidade: "%", pt: "−NaN p.p.", en: "−NaN p.p." },
    { nome: "infinito sem guarda nova", a: Infinity, b: 0, unidade: "R$", pt: "+R$ ∞", en: "+R$ ∞" },
  ]);
  it.each(diferencas)("diferença: $nome", ({ a, b, unidade, pt, en }) => {
    expect(diferencaEntrada(a, b, unidade)).toBe(pt);
    expect(diferencaEntrada(a, b, unidade, "pt")).toBe(pt);
    expect(diferencaEntrada(a, b, unidade, "en")).toBe(en);
  });
});

describe("OBEE: fachadas escalares de Educação encaminham idioma", () => {
  const medidas = congelarCasos<Esperado & { medida: MedidaId; valor: number; curto: boolean }>([
    { medida: "despesa", valor: 1250000000, curto: false, pt: "R$ 1,25 bilhão", en: "R$ 1.25 bilhão" },
    { medida: "despesa", valor: 1250000000, curto: true, pt: "R$ 1,3 bi", en: "R$ 1.3 bi" },
    { medida: "despesa_hab", valor: 1234.5, curto: false, pt: "R$ 1.235", en: "R$ 1,235" },
    { medida: "despesa_mat", valor: 1234.5, curto: false, pt: "R$ 1.235", en: "R$ 1,235" },
    { medida: "matriculas", valor: 1234.5, curto: false, pt: "1.235", en: "1,235" },
    { medida: "conveniadas", valor: 1234.5, curto: false, pt: "1.235", en: "1,235" },
    { medida: "atu", valor: 1234.56, curto: false, pt: "1.234,6", en: "1,234.6" },
    { medida: "aprovacao", valor: 1234.56, curto: false, pt: "1.234,6%", en: "1,234.6%" },
    { medida: "ideb", valor: 6.75, curto: false, pt: "6,8", en: "6.8" },
    { medida: "saeb", valor: 1234.56, curto: false, pt: "1.234,56", en: "1,234.56" },
    { medida: "saeb", valor: 1234.56, curto: true, pt: "1.234,6", en: "1,234.6" },
  ]);
  it.each(medidas)("formata $medida, curto=$curto", ({ medida, valor, curto, pt, en }) => {
    expect(formata(medida, valor, curto)).toBe(pt);
    expect(formata(medida, valor, curto, "pt")).toBe(pt);
    expect(formata(medida, valor, curto, "en")).toBe(en);
  });

  it("preserva curto=false omitido e a quarta posição do idioma", () => {
    expect(formata("saeb", 1234.56)).toBe("1.234,56");
    expect(formata("saeb", 1234.56, undefined, "pt")).toBe("1.234,56");
    expect(formata("saeb", 1234.56, undefined, "en")).toBe("1,234.56");
  });

  const eixos = congelarCasos<Esperado & { medida: MedidaId; valor: number }>([
    { medida: "despesa", valor: 1250000000, pt: "R$ 1,3 bi", en: "R$ 1.3 bi" },
    { medida: "despesa_hab", valor: 1234.5, pt: "R$ 1.235", en: "R$ 1,235" },
    { medida: "despesa_mat", valor: 1234.5, pt: "R$ 1.235", en: "R$ 1,235" },
    { medida: "matriculas", valor: 1234.5, pt: "1.235", en: "1,235" },
    { medida: "conveniadas", valor: 1234.5, pt: "1.235", en: "1,235" },
    { medida: "saeb", valor: 1234, pt: "1.234", en: "1,234" },
    { medida: "saeb", valor: 1234.56, pt: "1.234,6", en: "1,234.6" },
    { medida: "aprovacao", valor: 96, pt: "96%", en: "96%" },
    { medida: "aprovacao", valor: 96.25, pt: "96,3%", en: "96.3%" },
    { medida: "ideb", valor: 5.5, pt: "5,5", en: "5.5" },
  ]);
  it.each(eixos)("eixo de $medida em $valor conserva casas necessárias", ({ medida, valor, pt, en }) => {
    expect(formataEixo(medida, valor)).toBe(pt);
    expect(formataEixo(medida, valor, "pt")).toBe(pt);
    expect(formataEixo(medida, valor, "en")).toBe(en);
  });

  const completos = congelarCasos<Esperado & { nome: string; indicador: IndicadorId; valor: number }>([
    { nome: "população inteira", indicador: "ctx.populacao.residente", valor: 1234.5, pt: "1.235", en: "1,235" },
    { nome: "despesa completa", indicador: "edu.despesa.por_habitante", valor: 1234.5, pt: "R$ 1.234,50", en: "R$ 1,234.50" },
    { nome: "matrículas inteiras", indicador: "edu.matriculas.conveniadas_municipais", valor: 1234.5, pt: "1.235", en: "1,235" },
    { nome: "Saeb duas casas", indicador: "edu.saeb.rede_municipal", valor: 1234.56, pt: "1.234,56", en: "1,234.56" },
    { nome: "Ideb precisão integral", indicador: "edu.ideb.rede_municipal", valor: 6.123456789, pt: "6,123456789", en: "6.123456789" },
    { nome: "Ideb notação científica", indicador: "edu.ideb.rede_municipal", valor: 1.25e-7, pt: "1,25e-7", en: "1.25e-7" },
    { nome: "Ideb sem agrupamento", indicador: "edu.ideb.rede_municipal", valor: 1234.56789, pt: "1234,56789", en: "1234.56789" },
    { nome: "Ideb String de zero negativo", indicador: "edu.ideb.rede_municipal", valor: -0, pt: "0", en: "0" },
    { nome: "fallback uma casa", indicador: "edu.atu.rede_municipal", valor: 1234.56, pt: "1.234,6", en: "1,234.6" },
  ]);
  it.each(completos)("valor completo: $nome", ({ indicador, valor, pt, en }) => {
    expect(formataCompleto(indicador, valor)).toBe(pt);
    expect(formataCompleto(indicador, valor, "pt")).toBe(pt);
    expect(formataCompleto(indicador, valor, "en")).toBe(en);
  });
});
