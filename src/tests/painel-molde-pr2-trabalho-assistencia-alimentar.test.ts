import { describe, expect, it, vi } from "vitest";
// as leituras de base do OBEE marcam "server-only"; fora do Next o pacote não resolve, e o teste roda o componente da página direto
vi.mock("server-only", () => ({}));
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { conferirPainel } from "./suporte/molde-painel";
import PanoramaAssistencia from "@/app/eficiencia-estatal/assistencia-social/page";
import AcessoAssistencia from "@/app/eficiencia-estatal/assistencia-social/acesso/page";
import AcompanhamentoAssistencia from "@/app/eficiencia-estatal/assistencia-social/acompanhamento/page";
import CuidadoAssistencia from "@/app/eficiencia-estatal/assistencia-social/cuidado/page";
import RecursosAssistencia from "@/app/eficiencia-estatal/assistencia-social/recursos/page";

/**
 * Molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026), PR 2, frente de Trabalho e renda, Assistência social e Segurança
 * alimentar: as páginas com sessão renderizadas direto (renderToStaticMarkup, sem build) e conferidas pela anatomia do molde
 * (conferirPainel), a mesma do teste do build (painel-molde.test.ts), que passa a ler estas rotas quando o orquestrador as move para
 * NO_MOLDE_PAINEL. As asserções de conteúdo conferem que o que a página tinha antes continua nela.
 */
const html = (el: ReactElement) => renderToStaticMarkup(el).replace(/<!-- -->/g, "");
const pagina = (P: () => unknown) => html(createElement(P as never));

describe("molde de painel: Assistência social", () => {
  it.each([
    ["/eficiencia-estatal/assistencia-social", PanoramaAssistencia],
    ["/eficiencia-estatal/assistencia-social/acesso", AcessoAssistencia],
    ["/eficiencia-estatal/assistencia-social/acompanhamento", AcompanhamentoAssistencia],
    ["/eficiencia-estatal/assistencia-social/cuidado", CuidadoAssistencia],
    ["/eficiencia-estatal/assistencia-social/recursos", RecursosAssistencia],
  ] as const)("%s", (rota, P) => {
    const h = pagina(P);
    conferirPainel(rota, h);
    // as respostas da rede são a figura do kit em todas as páginas do tema, com o arquivo nacional e a escala comum de 0 a 100%
    expect(h).toContain('data-figura-analitica="respostas-da-rede"');
    expect(h).toContain("Baixar recorte nacional completo, todas as variáveis (CSV)");
    expect(h).toContain("consulta por unidade");
  });

  it("panorama: os três tipos de rede, os sete capítulos, a ressalva do recorte e a proposta de escores depois do painel", () => {
    const h = pagina(PanoramaAssistencia);
    for (const t of ["Apoio e acompanhamento familiar", "Proteção especializada", "Centros-dia e modalidades similares", "36 regionais incluídas", "Da necessidade ao cuidado.", "Ausência de resposta não é ausência de serviço.", "experiência de quem precisa"]) expect(h).toContain(t);
    for (const r of ["necessidades", "acesso", "acompanhamento", "cuidado", "recursos", "dados", "metodos"]) expect(h).toContain(`href="/eficiencia-estatal/assistencia-social/${r}"`);
    expect(h.indexOf('id="escores-servicos"')).toBeGreaterThan(h.indexOf('data-fatia="fim"'));
  });

  it("acompanhamento: o volume mensal do RMA com a tabela equivalente, o arquivo e as ressalvas de antes", () => {
    const h = pagina(AcompanhamentoAssistencia);
    expect(h).toContain('data-figura-analitica="volume-mensal"');
    for (const t of ["O volume observado em cada mês.", "RMA CRAS 2025 · Base tratada pelo MDS.", "Valores alterados pelo tratamento", "Com valor / presentes", "somá-las no ano repetiria famílias", "Encaminhar não comprova atendimento no destino.", "Os critérios do MDS retiram formulários inteiramente zerados e valores discrepantes.", "não se mede a completude de envio", "/eficiencia/assistencia-social/rma-cras.csv", "Jan / 2025"]) expect(h).toContain(t);
  });

  it("acesso, cuidado e recursos: o texto de antes fica na abertura, no limite ou na nota dos números", () => {
    expect(pagina(AcessoAssistencia)).toContain("Adequação à norma é autodeclarada, sem auditoria técnica integrada.");
    const c = pagina(CuidadoAssistencia);
    for (const t of ["diferente de visitas do PAIF", "não some essas categorias", "Os centros-dia incluem modalidades similares e organizações não governamentais."]) expect(c).toContain(t);
    const r = pagina(RecursosAssistencia);
    for (const t of ["sem identificar trabalhadores", "pessoas únicas ou equivalentes de jornada completa", "O recorte financeiro ainda não foi integrado; estas medidas não são uma nota de eficiência."]) expect(r).toContain(t);
  });
});
