import { describe, expect, it } from "vitest";
import type { Idioma } from "@/lib/idioma";
import { inteiro, numero, pct, reais, reaisCompacto, sinal } from "@/lib/saneamento/formato";
import { MEDIDAS_PRESTADOR, formatarMedidaPrestador, type MedidaPrestador } from "@/lib/saneamento/prestadores";
import { formatarValor, medida, type Medida } from "@/lib/saneamento/medidas";

function congelar<T extends object>(valor: T): T {
  for (const filho of Object.values(valor)) if (filho !== null && typeof filho === "object") congelar(filho);
  return Object.freeze(valor);
}
function prestador(id: string): MedidaPrestador {
  const m = MEDIDAS_PRESTADOR.find((item) => item.id === id);
  if (!m) throw new Error(`Medida de prestador ausente: ${id}`);
  return m;
}
function copiarMedida(m: Medida): Medida {
  return { ...m, cortesPct: [...m.cortesPct],
    ...(m.cortesContagem ? { cortesContagem: [...m.cortesContagem] } : {}),
    ...(m.limitesHistograma ? { limitesHistograma: [...m.limitesHistograma] } : {}) };
}

// Apenas os segmentos numéricos mudam de locale. Unidades, ausência e sufixos
// continuam PT; estes testes puros não alegam tradução das páginas ou dos CSV.
describe("Saneamento: casas fixas, sinais e percentuais", () => {
  const casos: { nome: string; formatar: typeof numero; valor: number; casas?: number; pt: string; en: string }[] = [
    { nome: "numero padrão", formatar: numero, valor: 1234.5, pt: "1.234,5", en: "1,234.5" },
    { nome: "numero negativo", formatar: numero, valor: -1234.5, casas: 2, pt: "-1.234,50", en: "-1,234.50" },
    { nome: "numero três casas", formatar: numero, valor: 1.23456, casas: 3, pt: "1,235", en: "1.235" },
    { nome: "numero zero", formatar: numero, valor: 0, pt: "0,0", en: "0.0" },
    { nome: "numero zero negativo", formatar: numero, valor: -0, casas: 2, pt: "-0,00", en: "-0.00" },
    { nome: "percentual fracionário", formatar: pct, valor: 0.125, casas: 2, pt: "0,13%", en: "0.13%" },
    { nome: "percentual acima de cem", formatar: pct, valor: 1234.5, casas: 2, pt: "1.234,50%", en: "1,234.50%" },
    { nome: "percentual padrão e zero", formatar: pct, valor: 0, pt: "0,0%", en: "0.0%" },
    { nome: "sinal positivo", formatar: sinal, valor: 1234.5, pt: "+1.234,5", en: "+1,234.5" },
    { nome: "sinal negativo tipográfico", formatar: sinal, valor: -1234.5, pt: "−1.234,5", en: "−1,234.5" },
    { nome: "sinal zero", formatar: sinal, valor: 0, pt: "0,0", en: "0.0" },
    { nome: "sinal zero negativo", formatar: sinal, valor: -0, pt: "0,0", en: "0.0" },
    { nome: "sinal anterior ao arredondamento", formatar: sinal, valor: -0.004, casas: 2, pt: "−0,00", en: "−0.00" },
    { nome: "reais negativos e espaço comum", formatar: reais, valor: -1234.5, pt: "R$ -1.234,50", en: "R$ -1,234.50" },
    { nome: "reais três casas", formatar: reais, valor: 1234.5, casas: 3, pt: "R$ 1.234,500", en: "R$ 1,234.500" },
    { nome: "reais zero", formatar: reais, valor: 0, pt: "R$ 0,00", en: "R$ 0.00" },
    { nome: "reais zero negativo", formatar: reais, valor: -0, pt: "R$ -0,00", en: "R$ -0.00" },
  ];
  it.each(casos)("$nome preserva precisão e default PT", ({ formatar, valor, casas, pt, en }) => {
    expect(formatar(valor, casas)).toBe(pt);
    expect(formatar(valor, casas, "pt")).toBe(pt);
    expect(formatar(valor, casas, "en")).toBe(en);
  });

  it.each([
    { valor: 1234.5, pt: "1.235", en: "1,235" }, { valor: -1.5, pt: "-1", en: "-1" },
    { valor: -0.5, pt: "-0", en: "-0" }, { valor: 0, pt: "0", en: "0" },
  ])("inteiro arredonda $valor com Math.round antes da formatação", ({ valor, pt, en }) => {
    expect(inteiro(valor)).toBe(pt);
    expect(inteiro(valor, "pt")).toBe(pt);
    expect(inteiro(valor, "en")).toBe(en);
  });
});

describe("Saneamento: moeda compacta e ausência", () => {
  it.each([
    { valor: 999, pt: "R$ 999,00", en: "R$ 999.00" },
    { valor: 1000, pt: "R$ 1,0 mil", en: "R$ 1.0 mil" },
    { valor: 999999, pt: "R$ 1.000,0 mil", en: "R$ 1,000.0 mil" },
    { valor: 1000000, pt: "R$ 1,0 mi", en: "R$ 1.0 mi" },
    { valor: 999999999, pt: "R$ 1.000,0 mi", en: "R$ 1,000.0 mi" },
    { valor: 1000000000, pt: "R$ 1,00 bi", en: "R$ 1.00 bi" },
    { valor: -1234500000, pt: "R$ -1,23 bi", en: "R$ -1.23 bi" },
    { valor: 0, pt: "R$ 0,00", en: "R$ 0.00" }, { valor: -0, pt: "R$ -0,00", en: "R$ -0.00" },
  ])("escolhe a escala de $valor antes do arredondamento visual", ({ valor, pt, en }) => {
    expect(reaisCompacto(valor)).toBe(pt);
    expect(reaisCompacto(valor, "pt")).toBe(pt);
    expect(reaisCompacto(valor, "en")).toBe(en);
  });

  const formatos: { nome: string; formatar: (v: number | null | undefined, idioma?: Idioma) => string }[] = [
    { nome: "numero", formatar: (v, idioma) => numero(v, undefined, idioma) },
    { nome: "inteiro", formatar: inteiro },
    { nome: "pct", formatar: (v, idioma) => pct(v, undefined, idioma) },
    { nome: "sinal", formatar: (v, idioma) => sinal(v, undefined, idioma) },
    { nome: "reaisCompacto", formatar: reaisCompacto },
    { nome: "reais", formatar: (v, idioma) => reais(v, undefined, idioma) },
  ];
  it.each(formatos)("$nome conserva as guardas sem acrescentar unidade à ausência", ({ formatar }) => {
    for (const valor of [null, undefined, NaN, Infinity, -Infinity]) {
      expect(formatar(valor)).toBe("sem dado");
      expect(formatar(valor, "pt")).toBe("sem dado");
      expect(formatar(valor, "en")).toBe("sem dado");
    }
  });
});

describe("Saneamento: formatador do prestador", () => {
  it.each([
    { id: "perdas", valor: 12.25, pt: "12,3%", en: "12.3%" },
    { id: "perdas", valor: 0, pt: "0,0%", en: "0.0%" },
    { id: "receita_m3", valor: 1234.5, pt: "R$ 1.234,50/m³", en: "R$ 1,234.50/m³" },
    { id: "receita_m3", valor: -0, pt: "R$ -0,00/m³", en: "R$ -0.00/m³" },
    { id: "pop_agua", valor: 1234.4, pt: "1.234", en: "1,234" },
    { id: "inv_agua", valor: 1000, pt: "R$ 1.000", en: "R$ 1,000" },
    { id: "inv_agua", valor: 999999, pt: "R$ 999.999", en: "R$ 999,999" },
    { id: "inv_agua", valor: 1000000, pt: "R$ 1,0 mi", en: "R$ 1.0 mi" },
    { id: "inv_agua", valor: 999999999, pt: "R$ 1.000,0 mi", en: "R$ 1,000.0 mi" },
    { id: "inv_agua", valor: 1000000000, pt: "R$ 1,00 bi", en: "R$ 1.00 bi" },
    { id: "inv_agua", valor: -1234500000, pt: "R$ -1,23 bi", en: "R$ -1.23 bi" },
  ])("$id em $valor mantém suas casas e não introduz a escala mil", ({ id, valor, pt, en }) => {
    const original = prestador(id), antes = { ...original };
    const fixture = congelar<MedidaPrestador>({ ...original });
    expect(formatarMedidaPrestador(fixture, valor)).toBe(pt);
    expect(formatarMedidaPrestador(fixture, valor, "pt")).toBe(pt);
    expect(formatarMedidaPrestador(fixture, valor, "en")).toBe(en);
    expect(fixture).toEqual(antes);
    expect(original).toEqual(antes);
    expect(fixture.valor).toBe(original.valor);
  });

  it("preserva null e não finitos no contrato number|null do prestador", () => {
    const fixture = congelar<MedidaPrestador>({ ...prestador("inv_agua") });
    for (const valor of [null, NaN, Infinity, -Infinity]) {
      expect(formatarMedidaPrestador(fixture, valor)).toBe("sem dado");
      expect(formatarMedidaPrestador(fixture, valor, "pt")).toBe("sem dado");
      expect(formatarMedidaPrestador(fixture, valor, "en")).toBe("sem dado");
    }
  });
});

describe("Saneamento: adaptador de medidas municipais", () => {
  it.each([
    { id: "c22-agua-sem-ligacao", valor: 12.34, pt: "12,3%", en: "12.3%" },
    { id: "c22-agua-sem-ligacao", valor: 0, pt: "0,0%", en: "0.0%" },
    { id: "evolucao-agua-rede", valor: 12.34, pt: "+12,3 p.p.", en: "+12.3 p.p." },
    { id: "evolucao-agua-rede", valor: -12.34, pt: "−12,3 p.p.", en: "−12.3 p.p." },
    { id: "evolucao-agua-rede", valor: -0, pt: "0,0 p.p.", en: "0.0 p.p." },
    { id: "sinisa-investimento-por-habitante", valor: 1234.56, pt: "1.235 R$/hab.", en: "1,235 R$/hab." },
    { id: "tarifa-social-por-familia-elegivel", valor: 1234.56, pt: "1.234,6 por 100 famílias", en: "1,234.6 por 100 famílias" },
  ])("$id em $valor preserva unidade, fatores e callbacks", ({ id, valor, pt, en }) => {
    const original = medida(id), antes = copiarMedida(original);
    const fixture = congelar(copiarMedida(original));
    expect(formatarValor(fixture, valor)).toBe(pt);
    expect(formatarValor(fixture, valor, "pt")).toBe(pt);
    expect(formatarValor(fixture, valor, "en")).toBe(en);
    expect(fixture).toEqual(antes);
    expect(original).toEqual(antes);
    for (const campo of ["pct", "contagem", "numerador", "denominador"] as const) expect(fixture[campo]).toBe(original[campo]);
  });

  it("mantém uma casa no ramo divergente mesmo se a entrada de apresentação pede três", () => {
    const fixture = copiarMedida(medida("evolucao-agua-rede"));
    fixture.casas = 3;
    const antes = copiarMedida(fixture);
    congelar(fixture);
    expect(formatarValor(fixture, -12.3456)).toBe("−12,3 p.p.");
    expect(formatarValor(fixture, -12.3456, "pt")).toBe("−12,3 p.p.");
    expect(formatarValor(fixture, -12.3456, "en")).toBe("−12.3 p.p.");
    expect(fixture).toEqual(antes);
  });

  it("não acrescenta unidade, sinal ou zero à ausência municipal", () => {
    const fixture = congelar(copiarMedida(medida("c22-agua-sem-ligacao")));
    for (const valor of [null, undefined, NaN, Infinity, -Infinity]) {
      expect(formatarValor(fixture, valor)).toBe("sem dado");
      expect(formatarValor(fixture, valor, "pt")).toBe("sem dado");
      expect(formatarValor(fixture, valor, "en")).toBe("sem dado");
    }
  });
});
