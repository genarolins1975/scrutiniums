import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ComparacaoReferencia, FaixaResumo, type LinhaReferencia } from "@/components/eficiencia/PanoramaGraficos";
import { fraseAmplitude, listaRotulos } from "@/lib/eficiencia/frases";

/**
 * Gráficos do panorama renderizados no servidor: cada marca traz o valor escrito, o desenho tem descrição acessível (a
 * frase factual), a capital destacada ganha marca e rótulo próprios, e o gasto total usa escala logarítmica sem perder o
 * rótulo de nenhuma marca.
 */
const brl = (v: number) => `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
const textos = (h: string) => Array.from(h.matchAll(/<text[^>]*>(.*?)<\/text>/g)).map((m) => m[1].replace(/<[^>]+>/g, "").replace(/<!-- -->/g, ""));

const faixa = (p: Partial<Parameters<typeof FaixaResumo>[0]> = {}) =>
  renderToStaticMarkup(
    createElement(FaixaResumo, {
      menor: 702,
      mediana: 1160,
      maior: 2362,
      faixa: { q1: 960, q3: 1464 },
      destaque: null,
      formata: brl,
      formataCurto: brl,
      formataEixo: brl,
      zero: true,
      tituloEixo: "Despesa em Educação por habitante (R$)",
      descricao: "A despesa vai de R$ 702 em Belém (PA) a R$ 2.362 em Vitória (ES).",
      ...p,
    }),
  );

describe("faixa de resumo (capítulo de recursos)", () => {
  it("escreve o valor do menor, da mediana e do maior, e o título do eixo", () => {
    const t = textos(faixa());
    for (const v of ["R$ 702", "R$ 1.160", "R$ 2.362"]) expect(t).toContain(v);
    expect(t).toContain("Despesa em Educação por habitante (R$)");
  });

  it("a descrição acessível é a frase factual e o desenho não é lido pelo leitor de tela", () => {
    const h = faixa();
    expect(h).toContain('role="img" aria-label="A despesa vai de R$ 702 em Belém (PA) a R$ 2.362 em Vitória (ES)."');
    expect(h).toMatch(/<svg[^>]*aria-hidden="true"/);
  });

  it("os limites da faixa central aparecem escritos junto ao eixo", () => {
    const t = textos(faixa());
    expect(t).toContain("R$ 960");
    expect(t).toContain("R$ 1.464");
  });

  it("sem faixa central, não desenha o fundo nem os limites", () => {
    const h = faixa({ faixa: null });
    expect(h).not.toContain("var(--cor-obee-fundo)");
    expect(textos(h)).not.toContain("R$ 960");
  });

  it("capital destacada: marca vazada e rótulo com nome e valor", () => {
    const h = faixa({ destaque: { rotulo: "Recife (PE)", valor: 1172 } });
    expect(textos(h)).toContain("Recife (PE) R$ 1.172");
    expect(h).toContain('stroke-width="2.5"');
  });

  it("escala logarítmica: marcas de ordens de grandeza diferentes mantêm o rótulo escrito", () => {
    const h = faixa({ menor: 354_000_000, mediana: 1_010_000_000, maior: 23_580_000_000, faixa: { q1: 743_000_000, q3: 2_110_000_000 }, escala: "log", zero: false, formata: (v) => `${(v / 1e9).toFixed(2)} bi` });
    const t = textos(h);
    for (const v of ["0.35 bi", "1.01 bi", "23.58 bi"]) expect(t).toContain(v);
  });
});

const linhas: LinhaReferencia[] = [
  { chave: "capitais", rotulo: "Capitais · mediana", rotuloEstreito: ["Capitais", "mediana"], valor: 25, tom: "capitais" },
  { chave: "brasil", rotulo: "Brasil · agregado", rotuloEstreito: ["Brasil", "agregado"], valor: 22, tom: "referencia" },
];
const comparacao = (p: Partial<Parameters<typeof ComparacaoReferencia>[0]> = {}) =>
  renderToStaticMarkup(
    createElement(ComparacaoReferencia, { linhas, formata: (v) => v.toFixed(1).replace(".", ","), formataEixo: (v) => String(v), dominioFixo: null, descricao: "Mediana 25,0; Brasil 22,0.", extremos: [20.5, 29.5], ...p }),
  );

describe("comparação com a referência (capítulos de atendimento e resultados)", () => {
  it("cada linha traz o rótulo e o valor escrito; a referência é um agregado, não uma diferença", () => {
    const t = textos(comparacao());
    expect(t).toContain("Capitais · mediana");
    expect(t).toContain("Brasil · agregado");
    expect(t).toContain("25,0");
    expect(t).toContain("22,0");
    expect(t.join(" ")).not.toMatch(/acima|abaixo|diferença/);
  });

  it("domínio fixo (Ideb de 0 a 10) marca o eixo inteiro", () => {
    const t = textos(comparacao({ dominioFixo: [0, 10], extremos: [4.8, 6.9] }));
    for (const v of ["0", "2", "4", "6", "8", "10"]) expect(t).toContain(v);
  });

  it("capital destacada entra como terceira linha", () => {
    const t = textos(comparacao({ linhas: [...linhas, { chave: "d", rotulo: "Recife (PE)", rotuloEstreito: ["Recife (PE)", ""], valor: 20.5, tom: "destaque" }] }));
    expect(t).toContain("Recife (PE)");
    expect(t).toContain("20,5");
  });

  it("sem referência nacional, só a linha das capitais", () => {
    const t = textos(comparacao({ linhas: [linhas[0]] }));
    expect(t).not.toContain("Brasil · agregado");
  });
});

describe("empate nos extremos: a frase e a lista de nomes citam as mesmas capitais", () => {
  it("duas capitais empatadas no maior valor aparecem juntas, em ordem alfabética", () => {
    const itens = [
      { nome: "Natal", uf: "RN", valor: 4.8 },
      { nome: "Teresina", uf: "PI", valor: 6.9 },
      { nome: "Curitiba", uf: "PR", valor: 6.9 },
    ];
    expect(fraseAmplitude(itens, { medida: "ideb", ano: 2025 })).toContain("6,9 em Curitiba (PR) e Teresina (PI)");
    expect(listaRotulos(["Curitiba (PR)", "Teresina (PI)"])).toBe("Curitiba (PR) e Teresina (PI)");
  });
});
