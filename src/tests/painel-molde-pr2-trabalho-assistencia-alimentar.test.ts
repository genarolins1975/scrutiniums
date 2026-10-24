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
import PanoramaAlimentar from "@/app/eficiencia-estatal/seguranca-alimentar/page";
import NecessidadesAlimentar from "@/app/eficiencia-estatal/seguranca-alimentar/necessidades/page";
import AcessoAlimentar from "@/app/eficiencia-estatal/seguranca-alimentar/acesso/page";
import QualidadeAlimentar from "@/app/eficiencia-estatal/seguranca-alimentar/qualidade/page";
import RecursosAlimentar from "@/app/eficiencia-estatal/seguranca-alimentar/recursos/page";
import PanoramaTrabalho from "@/app/eficiencia-estatal/trabalho-renda/page";
import QualificacaoTrabalho from "@/app/eficiencia-estatal/trabalho-renda/qualificacao/page";
import RecursosTrabalho from "@/app/eficiencia-estatal/trabalho-renda/recursos/page";

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

/** Página assíncrona (lê a base no servidor) ou que embrulha uma assíncrona: resolve até o elemento que o React renderiza. */
async function resolver(el: ReactElement): Promise<ReactElement> {
  const tipo = el.type as unknown;
  if (typeof tipo === "function" && tipo.constructor.name === "AsyncFunction") return (await (tipo as (p: unknown) => Promise<ReactElement>)(el.props)) as ReactElement;
  if (typeof tipo === "function" && !(tipo as { prototype?: { isReactComponent?: unknown } }).prototype?.isReactComponent) {
    const filho = (tipo as (p: unknown) => ReactElement)(el.props);
    return filho && typeof filho === "object" && "type" in filho && typeof filho.type === "function" && filho.type.constructor.name === "AsyncFunction" ? resolver(filho) : filho;
  }
  return el;
}

describe("molde de painel: Trabalho e renda", () => {
  it("/eficiencia-estatal/trabalho-renda (panorama)", async () => {
    const h = html(await resolver(createElement(PanoramaTrabalho)));
    conferirPainel("/eficiencia-estatal/trabalho-renda", h);
    for (const t of ['data-figura-analitica="desocupacao"', 'id="dimensoes"', "Entre pela pergunta que importa.", "Dois calendários, duas perguntas.", "Todas as dimensões, cobertura explícita.", "Trajetórias e mobilidade", "não publicado nesta edição", "Definições, reprodução e limites", "Explorar a série, exportação e comparação"]) expect(h).toContain(t);
    for (const s of ["acesso-ao-trabalho", "qualidade-do-trabalho", "renda-do-trabalho", "renda-das-familias"]) expect(h).toContain(`href="/eficiencia-estatal/trabalho-renda/${s}?ter=1"`);
    // sem a numeração "01 ·" de antes (decisão 7 pendente: padrão sem numeração)
    expect(h).not.toMatch(/\b0\d · /);
  });

  it("/eficiencia-estatal/trabalho-renda/qualificacao, com e sem recorte na URL", () => {
    const h = html(createElement(QualificacaoTrabalho));
    conferirPainel("/eficiencia-estatal/trabalho-renda/qualificacao", h);
    for (const t of ['data-figura-analitica="modalidades"', 'id="cursos"', "Aplicar filtros", "Exportar todo o recorte CSV", "Próxima página →", "Ocupações e aprovação", "Baixar planilha original ZIP", "SHA-256 do CSV original", "O que falta para medir resultados"]) expect(h).toContain(t);
    const ac = html(createElement(QualificacaoTrabalho, { searchParams: { uf: "AC", pagina: "2" } }));
    conferirPainel("/eficiencia-estatal/trabalho-renda/qualificacao", ac);
    // o HTML do servidor já sai no recorte pedido: a UF no resumo, a segunda página e o link para a anterior e para limpar
    expect(ac).toContain("Mostrando AC");
    expect(ac).toContain("Página 2 de");
    expect(ac).toContain("← Página anterior");
    expect(ac).toContain("Limpar o recorte");
    expect(ac).toContain('href="/eficiencia-estatal/trabalho-renda/qualificacao/dados.csv?uf=AC');
  });

  it("/eficiencia-estatal/trabalho-renda/recursos", async () => {
    const h = html(await resolver(createElement(RecursosTrabalho)));
    conferirPainel("/eficiencia-estatal/trabalho-renda/recursos", h);
    for (const t of ['data-figura-analitica="distribuicao"', 'id="evolucao"', 'id="composicao"', "Barras · escala linear", "Pontos · escala logarítmica", "Baixar comparação completa CSV", "Consulta DCA", "Baixar base e proveniência JSON", "Perímetro:", "Conferência DCA × RREO", "Valores ausentes não representam ausência de política pública."]) expect(h).toContain(t);
  });
});

describe("molde de painel: Segurança alimentar", () => {
  it.each([
    ["/eficiencia-estatal/seguranca-alimentar", PanoramaAlimentar],
    ["/eficiencia-estatal/seguranca-alimentar/necessidades", NecessidadesAlimentar],
    ["/eficiencia-estatal/seguranca-alimentar/acesso", AcessoAlimentar],
    ["/eficiencia-estatal/seguranca-alimentar/qualidade", QualidadeAlimentar],
    ["/eficiencia-estatal/seguranca-alimentar/recursos", RecursosAlimentar],
  ] as const)("%s", (rota, P) => {
    const h = pagina(P);
    conferirPainel(rota, h);
    // nenhuma tabela escrita à mão: todas são a TabelaDados do kit (o conferidor já reprova <table> fora dela)
    expect(h).not.toContain("overflow-x-auto");
  });

  it("necessidades: as três figuras e as três tabelas, na ordem de antes, com as âncoras do índice", () => {
    const h = pagina(NecessidadesAlimentar);
    const ordem = ['data-figura-analitica="ebia-regioes"', 'data-figura-analitica="quem-passa-fome"', 'data-figura-analitica="estados"', 'id="urbano-rural"', 'id="cadinsan"', 'id="cadinsan-municipio"'].map((t) => h.indexOf(t));
    expect(ordem.every((i) => i > 0)).toBe(true);
    expect([...ordem].sort((a, b) => a - b)).toEqual(ordem);
    for (const a of ["#ebia-regioes", "#quem-passa-fome", "#estados", "#urbano-rural", "#cadinsan"]) expect(h).toContain(`href="${a}"`);
    // os quadros pareados ficam no desenho próprio, marcados como figura legada; as tabelas de apoio e a dos moradores são do kit
    expect(h).toContain('data-figura-legado="quem-passa-fome"');
    for (const t of ["Barras em escala fixa de 0 a 100%", "Baixar tabela completa · CSV", "/eficiencia/seguranca-alimentar/pnad.csv", "No seu município", "E nas casas com crianças, adolescentes ou pessoas idosas?", "A linha tracejada marca o Brasil"]) expect(h).toContain(t);
  });

  it("acesso: a figura do PNAE com a tabela por estado e a consulta, a do IPCA e o que falta medir", () => {
    const h = pagina(AcessoAlimentar);
    for (const t of ['data-figura-analitica="escolar"', 'data-figura-analitica="precos"', 'id="lacunas"', "Por estado, 2025", "Refeições públicas", "Auxílio alimentar", "Consultar ações declaradas na base municipal", 'href="/custo-de-vida"', "Acumulada em 12 meses"]) expect(h).toContain(t);
  });

  it("qualidade: a figura do SISVAN e a tabela dos critérios propostos, do kit", () => {
    const h = pagina(QualidadeAlimentar);
    for (const t of ['data-figura-analitica="acompanhamento-nutricional"', "Oferta cumprida", "Entregas verificadas pelo protocolo", "Situação: dados e referências pendentes; escore não calculável.", "Nenhuma dessas taxas é inferida da quantidade de equipamentos"]) expect(h).toContain(t);
  });

  it("recursos: a figura dos repasses, as tabelas do PAA, a consulta e a estrutura municipal declarada", () => {
    const h = pagina(RecursosAlimentar);
    for (const t of ['data-figura-analitica="pnae-repasses"', 'id="paa"', 'id="municipio"', 'id="estrutura"', "Gestão e participação", "Explorar registros de equipamentos e gestão", "Por estado, 2025"]) expect(h).toContain(t);
  });

  it("panorama: os quatro números, as seis perguntas e a proposta de escores depois do painel", () => {
    const h = pagina(PanoramaAlimentar);
    expect(h.match(/data-numero-indicador=""/g)).toHaveLength(4);
    for (const r of ["necessidades", "acesso", "qualidade", "recursos", "dados", "metodos"]) expect(h).toContain(`href="/eficiencia-estatal/seguranca-alimentar/${r}"`);
    expect(h.indexOf('id="escores-servicos"')).toBeGreaterThan(h.indexOf('data-fatia="fim"'));
  });
});
