import { describe, expect, it, vi } from "vitest";
// as páginas importam módulos marcados com server-only; no teste, o marcador não tem efeito
vi.mock("server-only", () => ({}));
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { conferirPainel } from "./suporte/molde-painel";
import PanoramaJustica from "@/app/eficiencia-estatal/acesso-justica/page";
import CoberturaJustica from "@/app/eficiencia-estatal/acesso-justica/cobertura/page";
import ConciliacaoJustica from "@/app/eficiencia-estatal/acesso-justica/conciliacao/page";
import RecursosJustica from "@/app/eficiencia-estatal/acesso-justica/recursos/page";
import TempoJustica from "@/app/eficiencia-estatal/acesso-justica/tempo-resposta/page";
import PaginaSeguranca from "@/app/eficiencia-estatal/seguranca-publica/[[...painel]]/page";
// a página da mobilidade é o cabeçalho comum e estes corpos: o teste renderiza o corpo
import { PainelMobilidade } from "@/components/eficiencia/mobilidade/PainelMobilidade";
import { PainelOportunidades } from "@/components/eficiencia/mobilidade/PainelOportunidades";

/**
 * Molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026), PR 2 do Grupo 2, frente de Judiciário, Acesso à Justiça, Segurança
 * pública e Mobilidade: as páginas com sessão desses temas. Renderiza o componente de cada página no servidor (renderToStaticMarkup, sem
 * build) e confere a anatomia com o mesmo conferirPainel do teste do build (painel-molde.test.ts), que passa a ler estas rotas quando o
 * orquestrador as move para NO_MOLDE_PAINEL.
 */
const html = (el: ReactElement) => renderToStaticMarkup(el);

describe("molde de painel: Acesso à Justiça", () => {
  it.each([
    ["", PanoramaJustica],
    ["/cobertura", CoberturaJustica],
    ["/conciliacao", ConciliacaoJustica],
    ["/recursos", RecursosJustica],
    ["/tempo-resposta", TempoJustica],
  ] as const)("/eficiencia-estatal/acesso-justica%s", (sub, Pagina) => {
    conferirPainel(`/eficiencia-estatal/acesso-justica${sub}`, html(createElement(Pagina)));
  });
  it("o conteúdo de antes continua: o elo com o Judiciário, a consulta das comarcas, a série e as notas", () => {
    // a verificação do Judiciário (scripts/obee/judiciario-verificacao.mjs) exige o link do Judiciário no panorama do Acesso à Justiça
    expect(html(createElement(PanoramaJustica))).toContain('href="/eficiencia-estatal/judiciario"');
    const cobertura = html(createElement(CoberturaJustica));
    for (const t of ["Consulte cada comarca.", "Nome da comarca", "Baixar recorte completo", "Valor à direita: participação com atendimento regular."]) expect(cobertura).toContain(t);
    const conciliacao = html(createElement(ConciliacaoJustica));
    for (const t of ["Uma década de conciliação judicial", "Ampliar valores abaixo do extremo", "Minas Gerais declara 1.335.367 acordos", "Nem todo conflito admite ou requer conciliação."]) expect(conciliacao).toContain(t);
    const tempo = html(createElement(TempoJustica));
    for (const t of ["A execução fiscal muda a leitura do tempo.", "Execuções fiscais", "data-painel-principal"]) expect(tempo).toContain(t);
    expect(html(createElement(RecursosJustica))).toContain("Como a conta é feita");
  });
});

describe("molde de painel: Segurança pública", () => {
  // o panorama, os quatro grupos nacionais (o mesmo corpo, o Explorador) e os recursos; estados veio no PR 1 e metodos é página de método
  it.each(["", "letalidade", "mulheres", "patrimonio", "resposta", "recursos"])("/eficiencia-estatal/seguranca-publica/%s", (slug) => {
    const rota = `/eficiencia-estatal/seguranca-publica${slug ? `/${slug}` : ""}`;
    conferirPainel(rota, html(createElement(PaginaSeguranca, { params: { painel: slug ? [slug] : [] } })));
  });
  it("o conteúdo de antes continua: destino mais procurado, artefato, tabela com link por linha e o que a despesa não mostra", () => {
    const panorama = html(createElement(PaginaSeguranca, { params: { painel: [] } }));
    for (const t of ["O destino mais procurado", "Compare os estados", "Uma morte, dois registros", "Modelo didático", "Escolha a pergunta que deseja explorar", "Três dimensões, três perguntas", "Ler o método completo"]) expect(panorama).toContain(t);
    const grupo = html(createElement(PaginaSeguranca, { params: { painel: ["letalidade"] } }));
    for (const t of ["Buscar indicador", "Baixar este recorte · CSV", "Variação sobre o ano anterior", "Valores, unidades e cobertura", "Comparar as UFs →", "/eficiencia-estatal/seguranca-publica/estados?indicador="]) expect(grupo).toContain(t);
    const recursos = html(createElement(PaginaSeguranca, { params: { painel: ["recursos"] } }));
    for (const t of ["O que esta despesa não mostra", "Fundo Constitucional do DF", "% da despesa do estado"]) expect(recursos).toContain(t);
    // a tabela do peso na despesa era uma região rolável sem foco (axe scrollable-region-focusable); a do kit recebe o foco
    expect(recursos).not.toMatch(/overflow-x-auto[^>]*>\s*<table/);
  });
});

describe("molde de painel: Mobilidade e transporte", () => {
  it("/eficiencia-estatal/mobilidade-transporte", () => {
    const h = html(createElement(PainelMobilidade, { slug: "", p: {} }));
    conferirPainel("/eficiencia-estatal/mobilidade-transporte", h);
    for (const t of ["Explore por pergunta", "Explorar a medida →", "Uma pergunta, três perspectivas.", "Do deslocamento ao serviço", "Aplicar recorte"]) expect(h).toContain(t);
  });
  // a auditoria do workflow (scripts/obee/oportunidades-auditoria.mjs) conta as <figure> do <main> (uma sem cidade, duas com cidade, nenhuma
  // sem estimativa no modo), lê um só formulário e abre o resumo "Tabela equivalente: valores, cobertura e denominadores"
  it.each([
    [{}, 1],
    [{ cidade: "2611606", modo: "public_transport", indicador: "CMATT60" }, 2],
    [{ cidade: "1501402", modo: "public_transport" }, 0],
  ] as const)("/eficiencia-estatal/mobilidade-transporte/oportunidades com %j", (p, figuras) => {
    const h = html(createElement(PainelOportunidades, { p: { ...p } }));
    conferirPainel("/eficiencia-estatal/mobilidade-transporte/oportunidades", h);
    expect(h.match(/<figure\b/g)?.length ?? 0).toBe(figuras);
    expect(h.match(/<form\b/g)?.length).toBe(1);
    for (const t of ["Tabela equivalente: valores, cobertura e denominadores", "Aplicar oportunidades", "Limpar filtros", "Baixar recorte e grupos de renda (CSV)", "Chegar não é ser atendido"]) expect(h).toContain(t);
  });
});
