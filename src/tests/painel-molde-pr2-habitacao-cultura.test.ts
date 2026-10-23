import { describe, expect, it, vi } from "vitest";
// as páginas importam módulos marcados com server-only; no teste, o marcador não tem efeito
vi.mock("server-only", () => ({}));
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { conferirPainel } from "./suporte/molde-painel";
import PaginaHabitacao from "@/app/eficiencia-estatal/habitacao/page";
import PaginaAluguel from "@/app/eficiencia-estatal/habitacao/aluguel-renda/page";
import PaginaInadequacao from "@/app/eficiencia-estatal/habitacao/inadequacao/page";

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
  it("/eficiencia-estatal/habitacao/aluguel-renda", () => {
    conferirPainel("/eficiencia-estatal/habitacao/aluguel-renda", html(createElement(PaginaAluguel)));
  });
  it("/eficiencia-estatal/habitacao/inadequacao", () => {
    conferirPainel("/eficiencia-estatal/habitacao/inadequacao", html(createElement(PaginaInadequacao)));
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
  it("aluguel e renda: os três números, as faixas de renda, a divergência à vista, a comparação e o que a medida não responde", () => {
    const h = html(createElement(PaginaAluguel));
    for (const t of [
      "Quando o aluguel pesa demais na renda?",
      "Domicílios com ônus excessivo",
      "Participação no déficit",
      "Déficit com renda de até 2 salários mínimos",
      "A distribuição do déficit por renda.",
      "Faixas de renda domiciliar no déficit",
      "Mais de 3 salários mínimos",
      "divergem em aproximadamente 546 unidades para Piauí e Ceará",
      "Aluguel e perfil de renda nos territórios.",
      "O seletor permite comparar o ônus excessivo e cada faixa de renda.",
      "Baixar comparação CSV",
      "inadimplência de aluguel, risco de despejo, aluguel médio ou elegibilidade a um programa",
      "Abas DH_Componentes e DH_faixa_renda.",
    ]) {
      expect(h).toContain(t);
    }
    // a divergência é ressalva à vista da figura de renda, não nota recolhida
    expect(h).toMatch(/data-ressalva=""[^>]*>.{0,200}divergem em aproximadamente 546/);
  });
  it("condições da moradia: os três números, a sobreposição, as dimensões sem somar, a fundiária exclusiva e as três definições", () => {
    const h = html(createElement(PaginaInadequacao));
    for (const t of [
      "A casa existe. Em que condições?",
      "Com alguma inadequação",
      "Parcela do universo analisado",
      "Inadequação fundiária total",
      "Os componentes se sobrepõem.",
      "Quais dimensões da moradia precisam de melhoria?",
      "Categorias sobrepostas; não somar.",
      "Fundiária: relatório, tabela 30; demais: planilha Inadequação.",
      "contém apenas inadequação fundiária exclusiva",
      "Do total às carências específicas.",
      "Explore água, esgoto, energia, coleta de lixo, banheiro, piso, cobertura e outras condições.",
      "Como interpretar as três dimensões?",
      "O indicador não substitui análise documental individual.",
      "Sobre a fundiária total (relatório, tabela 30)",
    ]) {
      expect(h).toContain(t);
    }
  });
});
