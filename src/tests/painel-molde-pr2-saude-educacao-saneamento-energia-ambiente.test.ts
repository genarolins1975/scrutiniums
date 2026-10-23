import { describe, expect, it, vi } from "vitest";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { conferirPainel } from "./suporte/molde-painel";

// as leituras de base do OBEE marcam "server-only"; fora do Next o pacote não resolve, e o teste roda o componente da página direto
vi.mock("server-only", () => ({}));

import PaginaSaneamento from "@/app/eficiencia-estatal/saneamento/page";
import PaginaAgua from "@/app/eficiencia-estatal/saneamento/agua/page";
import PaginaEsgoto from "@/app/eficiencia-estatal/saneamento/esgoto/page";
import PaginaResiduos from "@/app/eficiencia-estatal/saneamento/residuos/page";
import PaginaDrenagem from "@/app/eficiencia-estatal/saneamento/drenagem/page";
import PaginaRecursos from "@/app/eficiencia-estatal/saneamento/recursos/page";

/**
 * Molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026), PR 2 do Grupo 2, frente de saúde, educação, saneamento, energia e meio
 * ambiente da Eficiência Estatal: cada página com sessão renderizada direto (renderToStaticMarkup, sem build) e conferida pela anatomia do
 * molde (conferirPainel), a mesma do teste do build (painel-molde.test.ts) quando o orquestrador move as rotas para NO_MOLDE_PAINEL. Os
 * testes de conteúdo conferem invariantes e o que existia antes (texto, controles, downloads), não o desenho.
 */
const html = (el: ReactElement) => renderToStaticMarkup(el);
const pagina = (P: () => unknown) => html(createElement(P as never));

const SANEAMENTO: [string, () => unknown][] = [
  ["/eficiencia-estatal/saneamento", PaginaSaneamento],
  ["/eficiencia-estatal/saneamento/agua", PaginaAgua],
  ["/eficiencia-estatal/saneamento/esgoto", PaginaEsgoto],
  ["/eficiencia-estatal/saneamento/residuos", PaginaResiduos],
  ["/eficiencia-estatal/saneamento/drenagem", PaginaDrenagem],
  ["/eficiencia-estatal/saneamento/recursos", PaginaRecursos],
];

describe("molde de painel: saneamento no OBEE", () => {
  it.each(SANEAMENTO)("%s", (rota, P) => {
    const h = pagina(P);
    conferirPainel(rota, h);
    // o aviso do painel principal da coleção Saneamento continua, e nenhum capítulo é numerado ("01 / Saneamento")
    expect(h).toContain("data-painel-principal");
    expect(h).not.toMatch(/\d{2} \/ Saneamento/);
    // os três números do Brasil, cada um com a prova da edição
    expect(h.match(/data-numero-indicador=""/g)).toHaveLength(3);
    expect(h).toContain('data-prova-numero="SINISA 2025 · 2024"');
  });
  it("as páginas de serviço mantêm a comparação, os controles na URL, o CSV, a fórmula e a seção explicativa", () => {
    const h = pagina(PaginaAgua);
    for (const t of ["Acesso e operação", "Indicador", "Territórios", "Ordenação", "Limpar seleção", "Baixar comparação CSV", "Fórmula, elegibilidade e fonte", "O que significa perder água?", "Fontes, universos e downloads."]) {
      expect(h).toContain(t);
    }
    expect(h).toContain('data-tabela-dados=""');
    expect(h).toContain('data-grafico="barras"');
  });
  it("recursos: a divergência de população fica à vista e as razões por residente têm ficha de calculado", () => {
    const h = pagina(PaginaRecursos);
    expect(h).toContain("Em esgoto, o relatório de participação informa 173.640.502 residentes");
    expect(h).toContain("Sobre as razões por residente");
    expect(h).toContain("Autodeclarado ao SINISA, sem conferência com demonstrações financeiras auditadas.");
  });
  it("panorama: os quatro serviços e os recursos a um clique e a participação por módulo na tabela do kit, à vista", () => {
    const h = pagina(PaginaSaneamento);
    for (const s of ["agua", "esgoto", "residuos", "drenagem", "recursos"]) expect(h).toContain(`href="/eficiencia-estatal/saneamento/${s}"`);
    expect(h).toContain("O que os municípios informaram?");
    expect(h).toContain('data-bloco-tabela=""');
    expect(h).not.toContain("overflow-x-auto");
  });
});
