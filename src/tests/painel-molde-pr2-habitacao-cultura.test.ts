import { describe, expect, it, vi } from "vitest";
// as páginas importam módulos marcados com server-only; no teste, o marcador não tem efeito
vi.mock("server-only", () => ({}));
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { conferirPainel } from "./suporte/molde-painel";
import PaginaHabitacao from "@/app/eficiencia-estatal/habitacao/page";

/**
 * Molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026), frente pr2-habitacao-cultura do Grupo 2: as páginas com sessão da
 * Eficiência Estatal de habitação (panorama, aluguel e renda, condições da moradia) e de cultura (panorama e recursos). Renderiza o
 * componente de cada página no servidor (renderToStaticMarkup, sem build) e confere a anatomia com o mesmo conferirPainel do teste do
 * build (painel-molde.test.ts), que passa a ler estas rotas quando o orquestrador as move para NO_MOLDE_PAINEL.
 */
const html = (el: ReactElement) => renderToStaticMarkup(el);

describe("molde de painel: Eficiência Estatal, frente pr2-habitacao-cultura", () => {
  it("/eficiencia-estatal/habitacao", () => {
    conferirPainel("/eficiencia-estatal/habitacao", html(createElement(PaginaHabitacao)));
  });
});

describe("molde de painel: o conteúdo de antes continua na página", () => {
  it("panorama da habitação: os três números, as duas perguntas, a composição e o que o diagnóstico acompanha", () => {
    const h = html(createElement(PaginaHabitacao));
    for (const t of [
      "O que falta para morar com dignidade?",
      "Déficit habitacional estimado",
      "Ônus excessivo com aluguel",
      "Domicílios com alguma inadequação",
      "Os dois totais não podem ser somados.",
      "Duas perguntas, duas formas de medir.",
      "Explorar componentes e territórios →",
      "Examinar condições da moradia →",
      "Do que é composto o déficit?",
      "Três componentes do déficit nacional",
      "Planilha Déficit, aba DH_Componentes.",
      "Entender o peso do aluguel e as faixas de renda →",
      "O que este diagnóstico permite acompanhar?",
      "Não os confundimos com redução do déficit.",
    ]) {
      expect(h).toContain(t);
    }
    // os três números com duas casas, como antes ("5,77 milhões")
    expect(h).toContain("5,77");
  });
});
