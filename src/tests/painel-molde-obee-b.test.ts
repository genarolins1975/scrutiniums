import { describe, expect, it } from "vitest";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { conferirPainel } from "./suporte/molde-painel";
import PaginaDeficit from "@/app/eficiencia-estatal/habitacao/deficit/page";
import PaginaAmbiente from "@/app/eficiencia-estatal/meio-ambiente-clima/[[...painel]]/page";

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
  // o corpo dos capítulos de medida do meio ambiente é um só (riscos, prevenção e pressões ambientais): o molde vale para os três
  it.each(["riscos", "prevencao", "residuos"])("/eficiencia-estatal/meio-ambiente-clima/%s", (slug) => {
    conferirPainel(`/eficiencia-estatal/meio-ambiente-clima/${slug}`, html(createElement(PaginaAmbiente, { params: { painel: [slug] } })));
  });
});

describe("molde de painel: o conteúdo de antes continua na página", () => {
  it("meio ambiente: o limite vira o não permite concluir e a pergunta sobre quem responde fica depois da figura", () => {
    const h = html(createElement(PaginaAmbiente, { params: { painel: ["riscos"] } }));
    for (const t of ["Onde a água ameaça a moradia?", "não equivalem ao total de ocorrências do S2ID", "Compare medidas, sem transformar diferenças em notas", "Quem responde por esses resultados?", "Examinar o serviço no capítulo de Saneamento", "Fórmula, elegibilidade e fonte"]) {
      expect(h).toContain(t);
    }
  });
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
