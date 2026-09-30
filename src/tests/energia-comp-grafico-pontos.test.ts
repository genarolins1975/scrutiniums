import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GraficoPontos, type GraficoPontosProps, type ParEntidade } from "@/components/energia/GraficoPontos";

/**
 * GraficoPontos (realizado × referência) renderizado no servidor: formas
 * distintas para as duas medidas, diferença escrita com sinal e sentido,
 * ausência sem marca inventada, ordenação com nulos no fim e a mesma ordem no
 * gráfico e na tabela, controle de ordenação nativo e seleção acessível.
 */
const html = (p: GraficoPontosProps) => renderToStaticMarkup(createElement(GraficoPontos, p));

const itens: ParEntidade[] = [
  { id: "A", rotulo: "Alfa Energia", valor: 10, referencia: 8 },
  { id: "B", rotulo: "Beta Luz", valor: 5, referencia: 9 },
  { id: "C", rotulo: "Gama", valor: null, referencia: 7 },
  { id: "D", rotulo: "Delta", valor: 6, referencia: null },
  { id: "E", rotulo: "Épsilon", valor: null, referencia: null },
  { id: "F", rotulo: "Zeta", valor: 7, referencia: 7 },
];

const base: GraficoPontosProps = {
  titulo: "Perdas realizadas e referência regulatória",
  itens,
  unidade: "%",
  rotuloValor: "Perda realizada",
  rotuloReferencia: "Referência regulatória",
};

function linha(markup: string, id: string): { abertura: string; corpo: string } {
  const m = markup.match(new RegExp(`(<g[^>]*data-id="${id}"[^>]*>)([\\s\\S]*?)</g>`));
  if (!m) throw new Error(`linha ${id} não encontrada`);
  return { abertura: m[1], corpo: m[2] };
}
const ordemGrafico = (m: string) => Array.from(m.matchAll(/<g[^>]*role="(?:img|button)"[^>]*data-id="([^"]+)"/g)).map((x) => x[1]);
const ordemTabela = (m: string) => Array.from(m.matchAll(/<tr[^>]*data-id="([^"]+)"/g)).map((x) => x[1]);

describe("GraficoPontos no servidor", () => {
  const m = html(base);

  it("ordem padrão: realizado, maior primeiro, com nulos no fim; tabela na mesma ordem", () => {
    expect(ordemGrafico(m)).toEqual(["A", "F", "D", "B", "E", "C"]);
    expect(ordemTabela(m)).toEqual(ordemGrafico(m));
  });

  it("ordenar por diferença põe quem não tem os dois valores no fim, nas duas direções", () => {
    const desc = html({ ...base, ordemInicial: { por: "diferenca", direcao: "desc" } });
    expect(ordemGrafico(desc)).toEqual(["A", "F", "B", "D", "E", "C"]);
    const asc = html({ ...base, ordemInicial: { por: "diferenca", direcao: "asc" } });
    expect(ordemGrafico(asc)).toEqual(["B", "F", "A", "D", "E", "C"]);
    expect(desc).toMatch(/<th scope="col" aria-sort="descending"[^>]*>Diferença/);
  });

  it("ordenar por nome usa a collation pt-BR (Épsilon junto do E, não depois do Z)", () => {
    const nome = html({ ...base, ordemInicial: { por: "nome", direcao: "asc" } });
    expect(ordemGrafico(nome)).toEqual(["A", "B", "D", "E", "C", "F"]);
    expect(nome).toContain("Ordem: A a Z");
  });

  it("formas diferentes: círculo cheio para o realizado, losango vazado para a referência", () => {
    const a = linha(m, "A").corpo;
    expect(a).toMatch(/<polygon data-forma="losango"[^>]*fill="var\(--cor-superficie\)"/);
    expect(a).toMatch(/<circle data-forma="circulo"[^>]*fill="var\(--cor-energia\)"/);
    expect(a).toContain("<line");
  });

  it("ausência de uma medida: a marca não é desenhada (nem em zero) e a diferença é 'sem dado'", () => {
    const c = linha(m, "C");
    expect(c.corpo).not.toContain('data-forma="circulo"');
    expect(c.corpo).toContain('data-forma="losango"');
    expect(c.corpo).not.toContain("<line");
    expect(c.corpo).toContain('data-diferenca="sem-dado"');
    expect(c.abertura).toContain("Perda realizada sem dado");
    expect(c.abertura).toContain("diferença sem dado");
    const d = linha(m, "D").corpo;
    expect(d).toContain('data-forma="circulo"');
    expect(d).not.toContain('data-forma="losango"');
  });

  it("sem as duas medidas: linha diz 'sem dado' e não tem marca", () => {
    const e = linha(m, "E").corpo;
    expect(e).toContain('data-estado="sem-dado"');
    expect(e).not.toContain("data-forma");
    expect(m).toContain('data-legenda="sem-dado"');
  });

  it("diferença explícita com sinal tipográfico, unidade p.p. e sentido na precisão exibida", () => {
    expect(linha(m, "A").abertura).toContain("diferença +2,0 p.p., acima da referência");
    expect(linha(m, "B").abertura).toContain("diferença −4,0 p.p., abaixo da referência");
    expect(linha(m, "F").abertura).toContain("diferença 0,0 p.p., igual à referência");
    expect(linha(m, "B").corpo).toContain(">−4,0 p.p.</text>");
    const tabB = m.match(/<tr[^>]*data-id="B"[^>]*>([\s\S]*?)<\/tr>/)?.[1] ?? "";
    expect(tabB).toContain(">−4,0</td>");
    const tabC = m.match(/<tr[^>]*data-id="C"[^>]*>([\s\S]*?)<\/tr>/)?.[1] ?? "";
    expect(tabC.match(/>sem dado<\/td>/g)).toHaveLength(2);
    expect(m).toContain("Diferença (p.p.)");
  });

  it("controle de ordenação nativo: rádios com o critério atual marcado e botão de direção", () => {
    expect(m).toMatch(/<fieldset[\s\S]*<legend[^>]*>Ordenar por<\/legend>/);
    const radios = Array.from(m.matchAll(/<input type="radio"[^>]*>/g)).map((x) => x[0]);
    expect(radios.map((r) => r.match(/value="([^"]+)"/)?.[1])).toEqual(["valor", "diferenca", "nome"]);
    const marcados = radios.filter((r) => r.includes('checked=""'));
    expect(marcados).toHaveLength(1);
    expect(marcados[0]).toContain('value="valor"');
    expect(new Set(radios.map((r) => r.match(/name="([^"]+)"/)?.[1])).size).toBe(1);
    expect(m).toMatch(/<button type="button"[^>]*aria-label="Ordem: maior primeiro\. Inverter"/);
    expect(m).toMatch(/<label class="[^"]*min-h-\[44px\]/);
  });

  it("estrutura acessível: grupo rotulado, um alvo de foco por linha, aria-live e tabela", () => {
    expect(m).toMatch(/<svg[^>]*role="group"[^>]*aria-labelledby="[^"]+"[^>]*aria-describedby="[^"]+"/);
    expect(Array.from(m.matchAll(/<g[^>]*role="img"[^>]*tabindex="0"/g))).toHaveLength(1);
    expect(Array.from(m.matchAll(/<g[^>]*role="img"[^>]*tabindex="-1"/g))).toHaveLength(5);
    expect(m).toContain('aria-live="polite"');
    expect(m).toContain("<caption");
    expect(Array.from(m.matchAll(/<th scope="row"/g))).toHaveLength(6);
    expect(m).not.toMatch(/#[0-9a-fA-F]{6}\b/);
  });

  it("seleção sincronizável: botão com aria-pressed e foco de entrada na selecionada", () => {
    const s = html({ ...base, selecionado: "B", onSelecionar: () => {} });
    const b = linha(s, "B").abertura;
    expect(b).toContain('role="button"');
    expect(b).toContain('aria-pressed="true"');
    expect(b).toContain('tabindex="0"');
    expect(Array.from(s.matchAll(/aria-pressed="false"/g))).toHaveLength(5);
    expect(s).toContain('data-selecionada="B"');
    expect(s).toContain("(selecionada)");
  });

  it("ordem controlada prevalece sobre a inicial", () => {
    const c = html({ ...base, ordemInicial: { por: "valor", direcao: "desc" }, ordem: { por: "nome", direcao: "desc" }, onOrdenar: () => {} });
    expect(ordemGrafico(c)).toEqual(["F", "C", "E", "D", "B", "A"]);
  });

  it("muitas entidades: altura por linha fixa e rolagem com altura máxima", () => {
    const muitos = Array.from({ length: 40 }, (_, i) => ({ id: `e${i}`, rotulo: `Entidade ${i}`, valor: i, referencia: 20 }));
    const r = html({ ...base, itens: muitos, alturaLinha: 44, alturaMaxima: 528 });
    expect(r).toContain('data-rolagem="sim"');
    expect(r).toMatch(/<svg[^>]*height="1760"[^>]*role="group"/);
  });
});
