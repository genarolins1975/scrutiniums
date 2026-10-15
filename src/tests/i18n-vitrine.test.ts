import { describe, expect, it, vi } from "vitest";
import type primariosEstaduais from "@/lib/contas-estaduais/primarios.json";

vi.mock("@/lib/contas-estaduais/primarios.json", async (original) => {
  const modulo = await original<{ default: typeof primariosEstaduais }>();
  return {
    ...modulo,
    default: {
      ...modulo.default,
      cobertura: {
        ...modulo.default.cobertura,
        // Fixture da origem: o número publicado hoje é menor que mil.
        observacoes: 12345,
        respostas: 81,
        ufs: 27,
      },
    },
  };
});

import { vitrines } from "@/lib/vitrine";

describe("vitrine com idioma explícito", () => {
  it("mantém português por padrão e preserva identidade, rotas e unidades", () => {
    const pt = vitrines("pt");
    const en = vitrines("en");
    expect(vitrines()).toEqual(pt);

    const identidade = (dados: ReturnType<typeof vitrines>) => Object.values(dados).map((vitrine) => ({
      id: vitrine.id,
      imagem: vitrine.imagem,
      focoImagem: vitrine.focoImagem,
      unidade: vitrine.contagem.unidade,
      paineis: vitrine.paineis.map(({ titulo, href }) => ({ titulo, href })),
      metodologia: vitrine.metodologia,
    }));
    expect(identidade(en)).toEqual(identidade(pt));
    expect(pt.estados.contagem).toEqual({ valor: "27", unidade: "unidades da Federação" });
    expect(en.estados.contagem).toEqual(pt.estados.contagem);
  });

  it("formata o número da fonte sem alterar a quantidade nem a cobertura", () => {
    const cobertura = (dados: ReturnType<typeof vitrines>) => dados.estados.paineis
      .find(({ href }) => href === "/contas-publicas-estaduais#cobertura");

    expect(cobertura(vitrines("pt"))).toEqual({
      titulo: "Cobertura",
      href: "/contas-publicas-estaduais#cobertura",
      descricao: "12.345 observações reproduzidas de 81 respostas originais.",
    });
    expect(cobertura(vitrines("en"))).toEqual({
      titulo: "Cobertura",
      href: "/contas-publicas-estaduais#cobertura",
      descricao: "12,345 observações reproduzidas de 81 respostas originais.",
    });
  });
});
