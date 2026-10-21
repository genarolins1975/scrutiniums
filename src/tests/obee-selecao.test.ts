import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Selecao } from "@/components/eficiencia/controles";

/**
 * Seleção do painel: o select nativo continua sendo o controle (rótulo associado, opções, valor), e o texto da opção
 * escolhida aparece inteiro numa caixa visível que quebra linha, em vez de ser cortado em reticências pelo navegador.
 */
const LONGO = "Despesa de aplicação direta por matrícula da rede municipal";
const html = (p: Partial<Parameters<typeof Selecao>[0]> = {}) =>
  renderToStaticMarkup(
    createElement(Selecao, {
      id: "c-med",
      rotulo: "Medida",
      ajuda: "Qualquer indicador do painel.",
      valor: "despesa_mat",
      opcoes: [
        { v: "despesa_hab", t: "Despesa liquidada em Educação por habitante", grupo: "Recursos" },
        { v: "despesa_mat", t: LONGO, grupo: "Recursos" },
        { v: "ideb", t: "Ideb da rede municipal", grupo: "Resultado" },
      ],
      aoMudar: () => {},
      ...p,
    }),
  );

describe("seleção do painel", () => {
  it("mostra o texto completo da opção escolhida, sem depender do corte do select", () => {
    const h = html();
    expect(h).toMatch(new RegExp(`<span aria-hidden="true"[^>]*>${LONGO}</span>`));
    expect(h).toContain("overflow-wrap:anywhere");
  });

  it("mantém o select nativo associado ao rótulo, com a opção marcada e a ajuda descrita", () => {
    const h = html();
    expect(h).toContain('<label for="c-med"');
    expect(h).toMatch(/<select id="c-med"[^>]*aria-describedby="c-med-ajuda"/);
    expect(h).toContain('<optgroup label="Recursos">');
    expect(h).toMatch(new RegExp(`<option value="despesa_mat" selected="">${LONGO}</option>`));
    expect(h).toContain('id="c-med-ajuda"');
  });

  it("o select cobre toda a caixa, borda incluída, e a caixa tem alvo mínimo de 44 px", () => {
    const h = html();
    expect(h).toContain("min-h-[44px]");
    expect(h).toMatch(/<select[^>]*class="absolute -left-px -top-px h-\[calc\(100%\+2px\)\] w-\[calc\(100%\+2px\)\][^"]*opacity-0/);
  });

  it("valor sem opção correspondente não quebra a caixa", () => {
    expect(html({ valor: "inexistente" })).toMatch(/<span aria-hidden="true"[^>]*><\/span>/);
  });

  it("desabilitado: select desabilitado e texto atenuado", () => {
    const h = html({ desabilitado: true });
    expect(h).toMatch(/<select[^>]*disabled=""/);
    expect(h).toContain("text-mineral");
  });
});
