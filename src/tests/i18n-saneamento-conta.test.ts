import { describe, expect, it } from "vitest";
import { calcularConta, leituras, type Conta, type LinhaConta } from "@/lib/saneamento/conta";
import type { Categoria, TarifaVerificada } from "@/lib/saneamento/tarifas";

function congelar<T extends object>(valor: T): T {
  for (const filho of Object.values(valor)) if (filho !== null && typeof filho === "object") congelar(filho);
  return Object.freeze(valor);
}
type LinhaCrua = Omit<LinhaConta, "rotulo"> & { rotulo?: string };
type ContaCrua = Omit<Conta, "linhas"> & { linhas: LinhaCrua[] };
type Posicoes = Readonly<Partial<Record<number, LinhaConta["servico"]>>>;

// Só os índices/serviços declarados perdem rotulo, após a conferência literal.
// Fixas, adicionais, aviso e todos os demais campos continuam na comparação.
function camposCrus(conta: Conta, posicoes: Posicoes): ContaCrua {
  return { ...conta, linhas: conta.linhas.map((linha, indice) => {
    const servico = posicoes[indice];
    if (servico === undefined) return linha;
    expect(linha.servico).toBe(servico);
    const crua: LinhaCrua = { ...linha };
    delete crua.rotulo;
    return crua;
  }) };
}
const contas = (categoria: Categoria, consumo: number, adicionais: { rotulo: string; percentual: number }[] = []) => [
  ["pt", calcularConta(categoria, consumo, adicionais)],
  ["pt", calcularConta(categoria, consumo, adicionais, "pt")],
  ["en", calcularConta(categoria, consumo, adicionais, "en")],
] as const;

// Fixtures de apresentação; nenhuma tarifa publicada é modificada.
const percentual = congelar<Categoria>({
  rotulo: "Categoria sintética",
  agua: { fixo: 1.005, minimo: { m3: 1.0625, valor: 2.005 }, faixas: [
    { de: 1.0625, ate: 1001.0625, preco: 0.00125 },
    { de: 1001.0625, ate: null, preco: 0.125 },
  ] },
  esgoto: { percentual: 12.5625 },
});
const adicionais = congelar([{ rotulo: "Encargo 2,5%: texto livre", percentual: 2.5 }]);
const porTabela = congelar<Categoria>({
  rotulo: "Categoria sintética por tabela", agua: { fixo: 2.5, faixas: [] },
  esgoto: { fixo: 0.125, minimo: { m3: 0.5, valor: 1.255 }, faixas: [
    { de: 0.5, ate: 1.25, preco: 2 }, { de: 1.25, ate: null, preco: 3 },
  ] },
});
const rotulosTabela = {
  pt: ["Tarifa fixa", "Tarifa fixa", "Valor até 0,5 m³ (cobrado mesmo com consumo menor)", "De 0,5 a 1,25 m³", "Acima de 1,25 m³"],
  en: ["Tarifa fixa", "Tarifa fixa", "Valor até 0.5 m³ (cobrado mesmo com consumo menor)", "De 0.5 a 1.25 m³", "Acima de 1.25 m³"],
};
const posicoesTabela: Posicoes = { 2: "esgoto", 3: "esgoto", 4: "esgoto" };
const fixasTabela: LinhaConta[] = [
  { servico: "agua", rotulo: "Tarifa fixa", volume: null, preco: null, valor: 2.5 },
  { servico: "esgoto", rotulo: "Tarifa fixa", volume: null, preco: null, valor: 0.125 },
];
const minimoTabela: LinhaCrua = { servico: "esgoto", volume: 0.5, preco: null, valor: 1.255 };
const fechadaTabela: LinhaCrua = { servico: "esgoto", volume: 0.75, preco: 2, valor: 1.5 };
const esperadaTabela: ContaCrua = {
  consumo: 2.25, agua: 2.5, esgoto: 5.88, adicionais: 0, total: 8.38, esgotoNaoVerificado: undefined,
  linhas: [...fixasTabela, minimoTabela, fechadaTabela, { servico: "esgoto", volume: 1, preco: 3, valor: 3 }],
};

describe("Saneamento: rótulos da conta com cálculo real", () => {
  it("formata as cinco posições e mantém total 5.10 calculado na escala original", () => {
    const antes = structuredClone({ percentual, adicionais });
    for (const [idioma, conta] of contas(percentual, 1002.3125, adicionais)) {
      expect(conta.linhas.map((linha) => linha.rotulo)).toEqual(idioma === "pt" ? [
        "Tarifa fixa", "Valor até 1,063 m³ (cobrado mesmo com consumo menor)",
        "De 1,063 a 1.001,063 m³", "Acima de 1.001,063 m³", "Esgoto: 12,563% da conta de água", "Encargo 2,5%: texto livre",
      ] : [
        "Tarifa fixa", "Valor até 1.063 m³ (cobrado mesmo com consumo menor)",
        "De 1.063 a 1,001.063 m³", "Acima de 1,001.063 m³", "Esgoto: 12.563% da conta de água", "Encargo 2,5%: texto livre",
      ]);
      // A soma dos componentes já arredondados seria 5.09; o total real é 5.10.
      expect(camposCrus(conta, { 1: "agua", 2: "agua", 3: "agua", 4: "esgoto" })).toStrictEqual({
        consumo: 1002.3125, agua: 4.42, esgoto: 0.55, adicionais: 0.12, total: 5.10, esgotoNaoVerificado: undefined,
        linhas: [
          { servico: "agua", rotulo: "Tarifa fixa", volume: null, preco: null, valor: 1.005 },
          { servico: "agua", volume: 1.0625, preco: null, valor: 2.005 },
          { servico: "agua", volume: 1000, preco: 0.00125, valor: 1.25 },
          { servico: "agua", volume: 1.25, preco: 0.125, valor: 0.16 },
          { servico: "esgoto", volume: null, preco: null, valor: 0.55 },
          { servico: "adicional", rotulo: "Encargo 2,5%: texto livre", volume: null, preco: null, valor: 0.12 },
        ],
      });
    }
    expect({ percentual, adicionais }).toStrictEqual(antes);
  });

  it("encaminha idioma ao esgoto por tabela sem acrescentar casas fixas", () => {
    const antes = structuredClone(porTabela);
    for (const [idioma, conta] of contas(porTabela, 2.25)) {
      expect(conta.linhas.map((linha) => linha.rotulo)).toEqual(rotulosTabela[idioma]);
      expect(camposCrus(conta, posicoesTabela)).toStrictEqual(esperadaTabela);
    }
    expect(porTabela).toStrictEqual(antes);
  });

  it.each(["ausente", "zero"] as const)("preserva consumo limitado a zero e esgoto %s", (estado) => {
    const categoria = congelar<Categoria>({ rotulo: "Fixture", agua: { fixo: 2.5, faixas: [] },
      ...(estado === "ausente" ? { esgotoNaoVerificado: "Esgoto não verificado; referência 1.234,5" } : { esgoto: { percentual: 0 } }),
    });
    const antes = structuredClone(categoria);
    const esperado: Conta = { consumo: 0, agua: 2.5, esgoto: estado === "ausente" ? null : 0, adicionais: 0, total: 2.5,
      esgotoNaoVerificado: estado === "ausente" ? "Esgoto não verificado; referência 1.234,5" : undefined,
      linhas: [{ servico: "agua", rotulo: "Tarifa fixa", volume: null, preco: null, valor: 2.5 }],
    };
    if (estado === "zero") esperado.linhas.push({ servico: "esgoto", rotulo: "Esgoto: 0% da conta de água", volume: null, preco: null, valor: 0 });
    for (const [, conta] of contas(categoria, -3.5)) expect(conta).toStrictEqual(esperado);
    expect(categoria).toStrictEqual(antes);
  });
});

const tarifaSintetica = congelar<TarifaVerificada>({
  id: "fixture-conta", prestador: "Fixture", prestadorSinisa: "Fixture", uf: "SP",
  regulador: "Fixture", modelo: "Fixture", ato: "Fixture sem ato normativo", vigencia: "2026-01-01",
  ultimoReajuste: "2026-01-01", area: "Fixture", fontes: [], unidade: "R$/m³", categorias: { residencial: porTabela },
  adicionais: [{ id: "extra", rotulo: "Adicional não automático", percentual: 10, nota: "Fixture" }],
  observacoes: [], exemplos: {}, municipios: [], acessado: "2026-10-15",
});
type CasoLeitura = { consumo: number; consumoSeguinte: number; precoMedio: number | null; m3Adicional: number; atual: ContaCrua; seguinte: ContaCrua };
const casosLeitura: CasoLeitura[] = [
  { consumo: 4, consumoSeguinte: 5, precoMedio: 3.4075, m3Adicional: 3,
    atual: { ...esperadaTabela, consumo: 4, esgoto: 11.13, total: 13.63,
      linhas: [...fixasTabela, minimoTabela, fechadaTabela, { servico: "esgoto", volume: 2.75, preco: 3, valor: 8.25 }] },
    seguinte: { ...esperadaTabela, consumo: 5, esgoto: 14.13, total: 16.63,
      linhas: [...fixasTabela, minimoTabela, fechadaTabela, { servico: "esgoto", volume: 3.75, preco: 3, valor: 11.25 }] },
  },
  { consumo: 0, consumoSeguinte: 1, precoMedio: null, m3Adicional: 1,
    atual: { ...esperadaTabela, consumo: 0, esgoto: 1.38, total: 3.88,
      linhas: [...fixasTabela, { ...minimoTabela, volume: 0 }] },
    seguinte: { ...esperadaTabela, consumo: 1, esgoto: 2.38, total: 4.88,
      linhas: [...fixasTabela, minimoTabela, { ...fechadaTabela, volume: 0.5, valor: 1 }] },
  },
];

describe("Saneamento: leituras numéricas sem adicionais automáticos", () => {
  it.each(casosLeitura)("preserva conta e marginal no consumo $consumo", (caso) => {
    const antes = structuredClone(tarifaSintetica);
    for (const idioma of [undefined, "pt", "en"] as const) {
      const leitura = idioma === undefined
        ? leituras(tarifaSintetica, "residencial", caso.consumo)
        : leituras(tarifaSintetica, "residencial", caso.consumo, idioma);
      const rotulos = rotulosTabela[idioma ?? "pt"];
      expect(leitura.conta.linhas.map((linha) => linha.rotulo)).toEqual(rotulos.slice(0, caso.atual.linhas.length));
      expect({ ...leitura, conta: camposCrus(leitura.conta, posicoesTabela) })
        .toStrictEqual({ conta: caso.atual, precoMedio: caso.precoMedio, m3Adicional: caso.m3Adicional });
      // O próximo é conferido separadamente contra literais, nunca usado como
      // oráculo do marginal. Seus rótulos internos não são retornados por leituras:
      // o repasse de idioma nesse segundo call depende de revisão estática.
      const seguinte = idioma === undefined
        ? calcularConta(porTabela, caso.consumoSeguinte)
        : calcularConta(porTabela, caso.consumoSeguinte, [], idioma);
      expect(seguinte.linhas.map((linha) => linha.rotulo)).toEqual(rotulos.slice(0, caso.seguinte.linhas.length));
      expect(camposCrus(seguinte, posicoesTabela)).toStrictEqual(caso.seguinte);
    }
    expect(tarifaSintetica).toStrictEqual(antes);
  });
});
