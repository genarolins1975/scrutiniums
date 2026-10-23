import { describe, expect, it } from "vitest";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { conferirPainel } from "./suporte/molde-painel";
import PaginaDeficit from "@/app/eficiencia-estatal/habitacao/deficit/page";

/**
 * Molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026), frente obee-b do Grupo 1: as páginas com sessão da Eficiência Estatal
 * de cultura, habitação, Judiciário, meio ambiente e clima, mobilidade e segurança pública. Renderiza o componente de cada página no
 * servidor (renderToStaticMarkup, sem build) e confere a anatomia com o mesmo conferirPainel do teste do build (painel-molde.test.ts),
 * que passa a ler estas rotas quando o orquestrador as move para NO_MOLDE_PAINEL.
 */
const html = (el: ReactElement) => renderToStaticMarkup(el);

describe("molde de painel: Eficiência Estatal, frente obee-b", () => {
  it("/eficiencia-estatal/habitacao/deficit", () => {
    conferirPainel("/eficiencia-estatal/habitacao/deficit", html(createElement(PaginaDeficit)));
  });
});

describe("molde de painel: o conteúdo de antes continua na página", () => {
  it("déficit: os três números, a comparação e os três conceitos", () => {
    const h = html(createElement(PaginaDeficit));
    for (const t of ["Déficit relativo", "Parcela urbana do déficit", "Tamanho, proporção e composição", "Três conceitos que não são equivalentes", "Habitação precária", "Coabitação", "Ônus excessivo", "Abas Deficit_habitacional e Total_domicilios_ocupados"]) {
      expect(h).toContain(t);
    }
    // a tabela de denominadores da comparação é a do kit, com o Brasil como razão de totais
    expect(h).toContain("data-tabela-dados");
    expect(h).toContain("O percentual nacional é uma razão de totais");
  });
});
