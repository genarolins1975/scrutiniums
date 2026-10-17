import { parse } from "parse5";
import { describe, expect, it } from "vitest";
import { numerosNormalizados, portuguesSemMarca } from "./suporte/i18n-energia";

const corpo = (html: string) => parse(`<html><body>${html}</body></html>`);

describe("prova do Setor Elétrico bilíngue: normalização e detector", () => {
  it("datas nos dois idiomas contam os mesmos números", () => {
    const pt = numerosNormalizados(corpo("<p>Em 17/10/2026, out/2026, mai/23, 7 de outubro de 2026, outubro de 2026, às 16h: 1.552,5</p>"));
    const en = numerosNormalizados(corpo("<p>On Oct 17, 2026, Oct 2026, May ’23, October 7, 2026, October 2026, at 16:00: 1,552.5</p>"));
    expect(en).toEqual(pt);
  });

  it("palavras que parecem mês fora de data não viram mês", () => {
    expect(numerosNormalizados(corpo("<p>dez períodos, set de dados, the plant may stop, mar aberto</p>"))).toEqual([]);
    // célula "May" ao lado do valor 155 numa tabela não é data
    expect(numerosNormalizados(corpo("<table><tr><td>May</td><td>155</td></tr></table>"))).toEqual(["155"]);
  });

  it("acusa português sem marca e aceita nome próprio e trecho marcados", () => {
    expect(portuguesSemMarca(corpo("<p>Energia contratada nos leilões</p>"))).not.toEqual([]);
    expect(portuguesSemMarca(corpo('<p>Plants of <span lang="pt-BR" data-i18n-nome="">Companhia Energética de Minas Gerais</span></p>'))).toEqual([]);
    expect(portuguesSemMarca(corpo('<p><span data-i18n-aviso="" lang="en">Portuguese only</span><span data-i18n-estado="portugues_marcado" data-i18n-regiao="x" lang="pt-BR">texto da norma</span></p>'))).toEqual([]);
    expect(portuguesSemMarca(corpo('<svg><text>Energia armazenada</text></svg>'))).not.toEqual([]);
  });
});
