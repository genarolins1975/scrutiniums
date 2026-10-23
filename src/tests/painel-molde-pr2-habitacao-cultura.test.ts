import { describe, expect, it, vi } from "vitest";
// as páginas importam módulos marcados com server-only; no teste, o marcador não tem efeito
vi.mock("server-only", () => ({}));
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { conferirPainel } from "./suporte/molde-painel";
import PaginaHabitacao from "@/app/eficiencia-estatal/habitacao/page";
import PaginaAluguel from "@/app/eficiencia-estatal/habitacao/aluguel-renda/page";
import PaginaInadequacao from "@/app/eficiencia-estatal/habitacao/inadequacao/page";
import PaginaCultura from "@/app/eficiencia-estatal/cultura/[[...painel]]/page";

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
  it("/eficiencia-estatal/cultura", () => {
    conferirPainel("/eficiencia-estatal/cultura", html(createElement(PaginaCultura, { params: {} })));
  });
  it("/eficiencia-estatal/cultura/recursos", () => {
    conferirPainel("/eficiencia-estatal/cultura/recursos", html(createElement(PaginaCultura, { params: { painel: ["recursos"] } })));
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
  it("panorama da cultura: os três números, os caminhos, o Wi-Fi com margem (legado) e o aviso de participação no método", () => {
    const h = html(createElement(PaginaCultura, { params: {} }));
    for (const t of [
      "O que os espaços culturais oferecem ao público?",
      "Bibliotecas com Wi-Fi para o público",
      "Bibliotecas de natureza pública municipal",
      "Despesa pública com cultura",
      "Os valores não compõem um escore de eficiência.",
      "Da estrutura à experiência cultural.",
      "Quanto o poder público destina à cultura?",
      "Wi-Fi para o público, por tipo de equipamento",
      "barra: estimativa · traço: margem publicada (95%)",
      "Margens que se sobrepõem não comprovam diferença entre os tipos.",
      "Oferta registrada. Participação ainda não medida.",
      "A existência de um equipamento não comprova acesso efetivo.",
    ]) {
      expect(h).toContain(t);
    }
    // o gráfico de estimativa e margem fica como era, marcado como legado, com a margem de cada tipo na tabela equivalente
    expect(h).toContain("data-figura-legado");
    expect(h).toContain("Margem (p.p.)");
    // os caminhos levam a todos os capítulos, inclusive métodos
    for (const s of ["rede", "acesso", "atividades", "acervos", "recursos", "metodos"]) expect(h).toContain(`href="/eficiencia-estatal/cultura/${s}"`);
  });
  it("recursos da cultura: o recorte na abertura, os dois números, a evolução, as esferas e a tabela dos governos estaduais", () => {
    const h = html(createElement(PaginaCultura, { params: { painel: ["recursos"] } }));
    for (const t of [
      "Quanto o poder público destina à cultura?",
      "Ano do recorte",
      "Esfera na evolução",
      "Baixar recorte · CSV",
      "Despesa com cultura · Total · 2023",
      "Mostrando a esfera Total e o ano 2023.",
      "Participação na despesa total da própria esfera",
      "Não é participação no gasto cultural.",
      "Onze anos de despesa publicada.",
      "O crescimento nominal não mede o aumento do poder de compra.",
      "% do orçamento da esfera",
      "Como o total se distribui entre esferas?",
      "Não identifica a origem de transferências",
      "Governos estaduais e Distrito Federal.",
      "Não soma as prefeituras localizadas na UF.",
      "Buscar UF",
      "Ordenar governos",
      "27 governos estaduais/distrital no recorte.",
      "Aba · linha · coluna",
    ]) {
      expect(h).toContain(t);
    }
    // a tabela dos governos estaduais continua à vista, com as 27 linhas
    expect(h).toContain('data-tabela-a-vista=""');
    expect(h.match(/3\.7 · \d+ · \d+/g)?.length).toBe(27);
    // os controles do recorte vêm na abertura, antes dos números
    expect(h.indexOf("Ano do recorte")).toBeLessThan(h.indexOf('data-fatia="numeros"'));
  });
});
