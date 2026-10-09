import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PerdasComposicaoPage from "@/app/setor-eletrico/perdas/composicao/page";
import PerdasRegulatorioPage from "@/app/setor-eletrico/perdas/regulatorio/page";
import PerdasCustoContextoPage from "@/app/setor-eletrico/perdas/custo-e-contexto/page";
import { diferencaPar, formatarDiferenca, formatarValor } from "@/lib/energia/escalas";
import type { PerdasGold } from "@/lib/energia/tipos-perdas";
import {
  componentesParaBarra,
  fraseSelecaoRegulatorio,
  linhasComposicao,
  linhasCusto,
  linhasRegulatorio,
  linhasTrechosRegulatorio,
  rotuloDistribuidora,
  segmentosPorDistribuidora,
  vereditoCusto,
} from "@/lib/energia/perdas";

/**
 * Coerência entre os pontos em que o mesmo número aparece nas páginas de Perdas (rodada 2). O que se confere aqui não são os números do
 * projeto, e sim que cada ponto lê a mesma conta: a frase da distribuidora escolhida, o gráfico, a tabela e o arquivo exportado do percentual
 * técnico usam uma só diferença; o total no fim da barra de composição e de custo é o número da tabela.
 */

const raiz = process.cwd();
const g = JSON.parse(readFileSync(join(raiz, "public/energia/gold/perdas.json"), "utf-8")) as PerdasGold;
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
// "−1,014" ou "+4,460" ou "12,662" escritos em pt-BR, lidos de volta como número
const br = (s: string) => Number(s.replace("−", "-").replace("+", "").replace(/\./g, "").replace(",", "."));

describe("percentual técnico: a frase da distribuidora escolhida, o gráfico, a tabela e o arquivo exportado usam uma só diferença", () => {
  const linhas = linhasRegulatorio(g.distribuidoras);
  const segs = segmentosPorDistribuidora(g.distribuidoras);
  const rotulos = Object.fromEntries(g.distribuidoras.map((d) => [d.cnpj, rotuloDistribuidora(d)]));
  const tabela = linhasTrechosRegulatorio(segs, rotulos);

  it("a diferença impressa na frase é a diferença dos dois percentuais que a própria frase mostra, nas 49 distribuidoras", () => {
    expect(linhas.length).toBe(49);
    for (const l of linhas) {
      const frase = fraseSelecaoRegulatorio(l, segs[l.id].length);
      const atual = /: ([\d.]+,\d{3})% da energia injetada publicada/.exec(frase);
      expect(atual, l.rotulo).not.toBeNull();
      expect(br(atual![1]), l.rotulo).toBeCloseTo(l.atual, 3);
      expect(frase, l.rotulo).not.toMatch(/troca/);
      if (l.anterior === null) {
        expect(frase, l.rotulo).toContain("sem trecho anterior de referência");
        expect(frase, l.rotulo).not.toMatch(/diferença de/);
        continue;
      }
      const anterior = /trecho anterior de referência: ([\d.]+,\d{3})%/.exec(frase);
      const dif = /diferença de ([+−]?[\d.]+,\d{3})\sp\.p\./.exec(frase);
      expect(anterior, l.rotulo).not.toBeNull();
      expect(dif, l.rotulo).not.toBeNull();
      expect(br(anterior![1]), l.rotulo).toBeCloseTo(l.anterior, 3);
      // aritmética dos dois valores impressos
      expect(br(dif![1]), l.rotulo).toBeCloseTo(br(atual![1]) - br(anterior![1]), 3);
      // e o mesmo texto que o gráfico escreve na dica
      expect(dif![0], l.rotulo).toBe(`diferença de ${formatarDiferenca(diferencaPar(l.atual, l.anterior), 3, "p.p.")}`);
    }
  });

  it("as sete distribuidoras que a avaliação achou erradas dizem a diferença contra o trecho anterior de referência, não a troca do pipeline", () => {
    for (const sigla of ["EQUATORIAL PA", "CERTAJA", "ERO", "CERFOX", "ÂMBAR AMAZONAS", "CEEE-D", "ELEKTRO"]) {
      const l = linhas.find((x) => x.rotulo === sigla);
      expect(l, sigla).toBeDefined();
      expect(l!.anterior, sigla).not.toBeNull();
      // a troca do pipeline é outra referência (trecho curto ou mês anterior) e não pode aparecer como diferença
      expect(l!.diferenca, sigla).not.toBe(l!.troca_pp);
      const frase = fraseSelecaoRegulatorio(l!, segs[l!.id].length);
      expect(frase, sigla).toContain(`diferença de ${formatarDiferenca(diferencaPar(l!.atual, l!.anterior), 3, "p.p.")}`);
      if (l!.troca_pp !== null) expect(frase, sigla).not.toContain(formatarDiferenca(l!.troca_pp, 3, "p.p."));
    }
  });

  it("a tabela, o arquivo exportado e o gráfico têm a mesma diferença no trecho mais recente de cada distribuidora", () => {
    expect(tabela.length).toBe(Object.values(segs).reduce((n, s) => n + s.length, 0));
    for (const l of linhas) {
      const dela = tabela.filter((r) => r.cnpj === l.id).sort((a, b) => a.inicio.localeCompare(b.inicio));
      const ultimo = dela[dela.length - 1];
      expect(ultimo.pct, l.rotulo).toBe(l.atual);
      expect(ultimo.pct_anterior, l.rotulo).toBe(l.anterior);
      expect(ultimo.diferenca, l.rotulo).toBe(l.diferenca);
      // sem trecho anterior no gráfico, sem diferença na tabela (nunca um número de outra referência)
      if (l.anterior === null) expect(dela[0].diferenca, l.rotulo).toBeNull();
    }
    // nenhuma diferença da ordem de −49,7 p.p. (a troca contra a razão do mês anterior) entra na tabela
    for (const r of tabela) if (r.diferenca !== null) expect(Math.abs(r.diferenca), r.rotulo).toBeLessThan(20);
  });

  it("a página usa um só nome para a diferença e não mostra a troca do pipeline", () => {
    const h = renderToStaticMarkup(createElement(PerdasRegulatorioPage));
    expect(h).toContain("Diferença contra o trecho anterior de referência");
    expect(h).toContain("Trecho anterior de referência");
    expect(h).not.toContain("Troca contra o trecho anterior");
    expect(h).not.toContain("49,709");
    // a frase não lê troca_pp: o componente só escreve a frase pelo seletor testado acima
    const fonte = ler("src/components/energia/PerdasRegulatorio.tsx");
    expect(fonte).not.toMatch(/linhaSel\.troca_pp|s\.troca_pp|sinal\(/);
    expect(fonte).toContain("fraseSelecaoRegulatorio(");
  });
});

describe("composição: o total no fim da barra é o número da tabela", () => {
  const { linhas } = linhasComposicao(g.distribuidoras);

  it("a soma da pilha arredonda no total da tabela e cada parte, no valor da tabela, nas 19 distribuidoras", () => {
    expect(linhas.length).toBeGreaterThan(0);
    for (const l of linhas) {
      expect(formatarValor(l.tecnica_barra + l.nao_tecnica_barra, 2), l.rotulo).toBe(formatarValor(l.total, 2));
      expect(formatarValor(l.tecnica_barra, 2), l.rotulo).toBe(formatarValor(l.tecnica, 2));
      expect(formatarValor(l.nao_tecnica_barra, 2), l.rotulo).toBe(formatarValor(l.nao_tecnica, 2));
    }
  });

  it("a página escreve o mesmo total no texto do gráfico e na tabela: 14,23 e 10,44, não 14,22 nem 10,45", () => {
    const h = renderToStaticMarkup(createElement(PerdasComposicaoPage));
    for (const [sigla, certo, errado] of [
      ["NEOENERGIA BRASÍLIA", "14,23", "14,22"],
      ["COSERN", "10,44", "10,45"],
    ] as const) {
      const l = linhas.find((x) => x.rotulo === sigla);
      expect(l, sigla).toBeDefined();
      expect(formatarValor(l!.total, 2), sigla).toBe(certo);
      expect(h, sigla).toMatch(new RegExp(`${sigla}[^<"]{0,240}total ${certo}`));
      expect(h, sigla).not.toMatch(new RegExp(`${sigla}[^<"]{0,240}total ${errado}`));
    }
  });
});

describe("custo: o total no fim da barra é a coluna Perdas da tabela, e a base econômica vem nomeada", () => {
  const custo = linhasCusto(g.distribuidoras);

  it("a soma da pilha arredonda no total da tabela e cada componente, no valor da tabela, em todas as linhas", () => {
    expect(custo.length).toBeGreaterThan(80);
    for (const l of custo) {
      const b = componentesParaBarra(l);
      expect(formatarValor(b.pt + b.pnt + b.rede_basica, 2), l.rotulo).toBe(formatarValor(l.perdas, 2));
      expect(formatarValor(b.pt, 2), l.rotulo).toBe(formatarValor(l.pt, 2));
      expect(formatarValor(b.pnt, 2), l.rotulo).toBe(formatarValor(l.pnt, 2));
      expect(formatarValor(b.rede_basica, 2), l.rotulo).toBe(formatarValor(l.rede_basica, 2));
    }
  });

  it("CERPRO tem 14,65 na barra, na tabela e na frase de abertura, e a página não explica mais uma divergência por nota", () => {
    const cerpro = custo.find((l) => l.rotulo === "CERPRO")!;
    expect(formatarValor(cerpro.perdas, 2)).toBe("14,65");
    expect(vereditoCusto(custo, g.referencia.tarifa_consultada_em)).toContain("14,65 R$/MWh (CERPRO)");
    const h = renderToStaticMarkup(createElement(PerdasCustoContextoPage));
    const trechos = Array.from(h.matchAll(/CERPRO/g), (m) => h.slice(m.index!, m.index! + 420)).filter((t) => /14,6[45]/.test(t));
    expect(trechos.length).toBeGreaterThan(0);
    for (const t of trechos) expect(t).not.toContain("14,64");
    expect(h).not.toContain("data-arredondamento");
  });

  it("a base econômica está no título da coluna, no título do gráfico, na primeira frase e na linha de limite do cabeçalho", () => {
    const h = renderToStaticMarkup(createElement(PerdasCustoContextoPage));
    expect(h).toContain("Tarifa B1, base econômica (TUSD + TE)");
    expect(h).toContain("Perdas na tarifa, base econômica");
    expect(h).toContain("tarifa residencial B1 (base econômica) vigente em");
    expect(vereditoCusto(custo, g.referencia.tarifa_consultada_em)).toMatch(/^Na base econômica da tarifa residencial B1/);
    const limite = /data-limite=""[^>]*>([\s\S]*?)<\/p>/.exec(h);
    expect(limite).not.toBeNull();
    expect(limite![1].replace(/<[^>]+>/g, " ")).toMatch(/base econômica/);
    expect(limite![1].replace(/<[^>]+>/g, " ")).toMatch(/não são a tarifa que aparece na conta/);
  });
});
