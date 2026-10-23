import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { conferirPainel } from "./suporte/molde-painel";

// as leituras de base do OBEE marcam "server-only"; fora do Next o pacote não resolve, e o teste roda o componente da página direto
vi.mock("server-only", () => ({}));

import PaginaNecessidades from "@/app/eficiencia-estatal/assistencia-social/necessidades/page";
import PaginaIndice from "@/app/eficiencia-estatal/indice-de-resultados/page";
import PaginaSaude from "@/app/eficiencia-estatal/saude-capitais/page";
import PaginaEducacao from "@/app/eficiencia-estatal/educacao-municipal-capitais/page";
import PaginaSaudeGastos from "@/app/eficiencia-estatal/saude-capitais/gastos/page";
import PaginaSaudeRede from "@/app/eficiencia-estatal/saude-capitais/rede-e-atencao-primaria/page";
import PaginaSaudeResultados from "@/app/eficiencia-estatal/saude-capitais/atendimento-e-resultados/page";
import PaginaEnergia from "@/app/eficiencia-estatal/energia-conectividade/[[...painel]]/page";

/**
 * Molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026), frente obee-a do Grupo 1: as páginas com sessão da Eficiência
 * Estatal renderizadas direto (renderToStaticMarkup) e conferidas pela anatomia do molde (conferirPainel). O teste do build
 * (painel-molde.test.ts) faz a mesma conferência no HTML do servidor, com sessão, quando as rotas entram em NO_MOLDE_PAINEL.
 */
const html = (P: () => unknown) => renderToStaticMarkup(createElement(P as never));

describe("molde de painel, Eficiência Estatal (frente obee-a)", () => {
  it("/eficiencia-estatal/assistencia-social/necessidades", () => {
    const h = html(PaginaNecessidades);
    conferirPainel("/eficiencia-estatal/assistencia-social/necessidades", h);
    // a tabela das perguntas de demanda, antes escrita à mão, é a TabelaDados do kit, rolável dentro do bloco e focável
    expect(h).toContain("Denominador necessário");
    expect(h).toMatch(/<div class="tabela-scroll[^"]*" tabindex="0" role="region"/);
    expect(h).not.toContain("overflow-x-auto");
  });

  it("/eficiencia-estatal/indice-de-resultados", () => {
    const h = html(PaginaIndice);
    conferirPainel("/eficiencia-estatal/indice-de-resultados", h);
    // a interface da edição v4 segue inteira dentro da figura, marcada como figura legada, e as tabelas dela são as do kit
    expect(h).toContain('data-figura-legado="indice-v4"');
    expect(h).toContain('id="atlas-indice"');
    expect(h).toContain('id="atlas-score-method"');
  });

  it("/eficiencia-estatal/energia-conectividade (o panorama do modelo [[...painel]])", () => {
    const h = renderToStaticMarkup(createElement(PaginaEnergia, { params: {} }));
    conferirPainel("/eficiencia-estatal/energia-conectividade", h);
    // o painel principal do tema continua avisado, e as quatro perguntas levam às visões do tema
    expect(h).toContain("data-painel-principal");
    for (const v of ["acesso", "continuidade", "custo", "internet"]) expect(h).toContain(`href="/eficiencia-estatal/energia-conectividade/${v}"`);
  });

  it("/eficiencia-estatal/saude-capitais", () => {
    const h = html(PaginaSaude);
    conferirPainel("/eficiencia-estatal/saude-capitais", h);
    // uma figura por medida do panorama, cada uma com o caminho para a trilha da própria medida em Dados e métodos
    expect(h.match(/data-figura-analitica="medida-/g)).toHaveLength(7);
    expect(h).toContain('href="/eficiencia-estatal/saude-capitais/metodos#trilha-sau-despesa-por_habitante"');
  });

  it("/eficiencia-estatal/educacao-municipal-capitais", () => {
    const h = html(PaginaEducacao);
    conferirPainel("/eficiencia-estatal/educacao-municipal-capitais", h);
    // os três capítulos do panorama, sem a numeração "01 /" de antes (decisão 7 pendente: padrão sem numeração)
    for (const c of ["gastos", "atendimento", "resultados"]) expect(h).toContain(`data-figura-analitica="capitulo-${c}"`);
    expect(h).toContain('href="/educacao-municipal"');
  });

  // modelo genérico (PaginaTemaSaude e ExploradorSaude): o mesmo corpo serve aos três temas da Saúde, e os três entram no molde juntos
  it.each([
    ["/eficiencia-estatal/saude-capitais/gastos", PaginaSaudeGastos, ["gastos-subfuncao", "gastos-natureza", "gastos-fonte"]],
    ["/eficiencia-estatal/saude-capitais/rede-e-atencao-primaria", PaginaSaudeRede, []],
    ["/eficiencia-estatal/saude-capitais/atendimento-e-resultados", PaginaSaudeResultados, ["res-grupos"]],
  ] as const)("%s", (rota, P, composicoes) => {
    const h = html(P);
    conferirPainel(rota, h);
    for (const id of ["distribuicao", "evolucao", ...composicoes]) expect(h).toContain(`data-figura-analitica="${id}"`);
  });
});
