import { describe, expect, it, vi } from "vitest";
// as páginas importam módulos marcados com server-only; no teste, o marcador não tem efeito
vi.mock("server-only", () => ({}));
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { conferirPainel } from "./suporte/molde-painel";
import PaginaDeficit from "@/app/eficiencia-estatal/habitacao/deficit/page";
import PaginaAmbiente from "@/app/eficiencia-estatal/meio-ambiente-clima/[[...painel]]/page";
import PaginaJudiciario from "@/app/eficiencia-estatal/judiciario/[capitulo]/page";
import PaginaCultura from "@/app/eficiencia-estatal/cultura/[[...painel]]/page";
// a página da mobilidade é o cabeçalho comum (que leva o recorte pela navegação do app router) e este corpo: o teste renderiza o corpo
import { PainelMobilidade } from "@/components/eficiencia/mobilidade/PainelMobilidade";
import type { PaginaMobilidade } from "@/lib/eficiencia/mobilidade/modelo";
import PaginaSeguranca from "@/app/eficiencia-estatal/seguranca-publica/[[...painel]]/page";

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
  it("/eficiencia-estatal/judiciario/panorama", () => {
    conferirPainel("/eficiencia-estatal/judiciario/panorama", html(createElement(PaginaJudiciario, { params: { capitulo: "panorama" } })));
  });
  it("/eficiencia-estatal/seguranca-publica/estados", () => {
    conferirPainel("/eficiencia-estatal/seguranca-publica/estados", html(createElement(PaginaSeguranca, { params: { painel: ["estados"] } })));
  });
  // os quatro capítulos da TIC Cultura têm o mesmo corpo (o explorador das estimativas): o molde vale para os quatro
  it.each(["rede", "acesso", "atividades", "acervos"])("/eficiencia-estatal/cultura/%s", (slug) => {
    conferirPainel(`/eficiencia-estatal/cultura/${slug}`, html(createElement(PaginaCultura, { params: { painel: [slug] } })));
  });
  // os capítulos de medida da mobilidade têm o mesmo corpo (o explorador; no tempo, também a distribuição do Censo)
  it.each(["tempo", "transporte", "acesso", "seguranca", "recursos", "comparar"])("/eficiencia-estatal/mobilidade-transporte/%s", (slug) => {
    conferirPainel(`/eficiencia-estatal/mobilidade-transporte/${slug}`, html(createElement(PainelMobilidade, { slug: slug as PaginaMobilidade, p: {} })));
  });
  it("/eficiencia-estatal/mobilidade-transporte/tempo com recorte na URL", () => {
    const h = html(createElement(PainelMobilidade, { slug: "tempo", p: { nivel: "municipio", uf: "AL", territorio: "2704302" } }));
    conferirPainel("/eficiencia-estatal/mobilidade-transporte/tempo", h);
    // o HTML do servidor já sai no recorte pedido: a distribuição do território escolhido
    expect(h).toContain("A distribuição em Maceió");
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
  it("Judiciário: a tabela de perímetros é a do kit, com a mesma conta, e a cobertura fica à vista", () => {
    const h = html(createElement(PaginaJudiciario, { params: { capitulo: "panorama" } }));
    for (const t of ["Três ramos não são o total do Judiciário.", "Diferença de perímetro e arredondamento", "Cobertura deste recorte:", "Não ajustar os ramos para que somem ao total", "Escala comum aos três ramos"]) {
      expect(h).toContain(t);
    }
    expect(h).toContain('data-bloco-tabela=""');
  });
  it("segurança por estado: as duas comparações, a tabela por UF do kit com a linha do Brasil e o antes de comparar", () => {
    const h = html(createElement(PaginaSeguranca, { params: { painel: ["estados"] } }));
    for (const t of ["Como cada UF se compara à taxa do Brasil?", "Polícia e saúde contam de formas diferentes", "Valores, denominador e posição em", "Soma das 27 UFs", "Antes de comparar", "Baixar esta tabela · CSV", "Ver a lista de ausências e o método", "Escolha o indicador, o ano e uma UF."]) {
      expect(h).toContain(t);
    }
    // a âncora antiga da seção polícia e saúde continua valendo
    expect(h).toContain('id="policia-e-saude"');
  });
  it("cultura: o gráfico de estimativa e margem fica, marcado como legado, e a tabela de precisão é a do kit", () => {
    const h = html(createElement(PaginaCultura, { params: { painel: ["rede"] } }));
    for (const t of ["Quem mantém os espaços culturais?", "Estimativas e precisão, lado a lado.", "valor ± margem publicada", "Fonte: aba · linha · coluna", "Baixar este recorte · CSV"]) {
      expect(h).toContain(t);
    }
    expect(h).toContain("data-figura-legado");
    // métodos (página de método) segue fora do molde; recursos e o panorama passaram ao molde no PR 2 (molde de painel, Iniciativa 1 do
    // parecer de UX de 23/10/2026), conferidos em painel-molde-pr2-habitacao-cultura.test.ts
    expect(html(createElement(PaginaCultura, { params: { painel: ["metodos"] } }))).not.toContain("data-painel");
  });
  it("mobilidade: a distribuição, o explorador paginado, os downloads e os outros capítulos continuam", () => {
    const h = html(createElement(PainelMobilidade, { slug: "tempo", p: {} }));
    for (const t of ["Quanto do dia fica no caminho?", "Tempo de ida ao trabalho", "Meio em que passa mais tempo", "Baixar recorte completo (CSV)", "Aplicar recorte", "Do deslocamento ao serviço", "Ver cobertura e limites"]) {
      expect(h).toContain(t);
    }
    expect(html(createElement(PainelMobilidade, { slug: "transporte", p: {} }))).toContain("Quanto custariam os embarques no mês?");
    // o panorama e as oportunidades entraram no molde no PR 2 (molde de painel, Iniciativa 1 do parecer de UX de 23/10/2026); só o capítulo de
    // método segue fora, como página de método
    expect(html(createElement(PainelMobilidade, { slug: "metodos", p: {} }))).not.toContain("data-painel");
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
