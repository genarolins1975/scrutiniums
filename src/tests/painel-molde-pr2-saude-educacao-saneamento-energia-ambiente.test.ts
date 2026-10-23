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
import PaginaAmbiente from "@/app/eficiencia-estatal/meio-ambiente-clima/[[...painel]]/page";
import PaginaEnergia from "@/app/eficiencia-estatal/energia-conectividade/[[...painel]]/page";
import PaginaEduGastos from "@/app/eficiencia-estatal/educacao-municipal-capitais/gastos/page";
import PaginaEduAtendimento from "@/app/eficiencia-estatal/educacao-municipal-capitais/atendimento/page";
import PaginaEduResultados from "@/app/eficiencia-estatal/educacao-municipal-capitais/resultados/page";
import PaginaEduComparar from "@/app/eficiencia-estatal/educacao-municipal-capitais/comparar/page";
import { ComposicaoDespesa, MatriculasPorEtapa, PonteDaRazao } from "@/components/eficiencia/DetalhesMedida";
import { Indice, anosDaMedida } from "@/lib/eficiencia/consulta";
import { contextos } from "@/lib/eficiencia/contexto";
import { dadosPainelTema, goldEducacao } from "@/lib/eficiencia/dados";

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

describe("molde de painel: educação nas capitais", () => {
  const TEMAS: [string, () => unknown][] = [
    ["gastos", PaginaEduGastos],
    ["atendimento", PaginaEduAtendimento],
    ["resultados", PaginaEduResultados],
  ];
  // os três temas têm o mesmo corpo (PaginaTemaEducacao): o molde vale para os três
  it.each(TEMAS)("/eficiencia-estatal/educacao-municipal-capitais/%s", (tema, P) => {
    const h = pagina(P);
    conferirPainel(`/eficiencia-estatal/educacao-municipal-capitais/${tema}`, h);
    // a família de medidas é a faixa de números (três), a capital é a primeira ação e o caminho para comparar continua
    expect(h.match(/data-numero-indicador=""/g)).toHaveLength(3);
    expect(h).toMatch(/data-acao=""[\s\S]*Capital/);
    expect(h).toContain("Comparar capitais nesta medida");
    // as leituras que antes se alternavam ficam todas na página: a distribuição (legada), a tabela equivalente e a evolução (legada)
    expect(h).toContain('data-figura-legado="distribuicao-capitais"');
    expect(h).toContain('data-figura-legado="serie"');
    for (const t of ["Copiar link deste recorte", "Baixar estes valores (CSV)", "Baixar esta série (CSV)", "Dicionário das colunas (CSV)", "Referências para ler o número", "O que este painel não mostra"]) {
      expect(h).toContain(t);
    }
  });
  it("/eficiencia-estatal/educacao-municipal-capitais/comparar", () => {
    const h = pagina(PaginaEduComparar);
    conferirPainel("/eficiencia-estatal/educacao-municipal-capitais/comparar", h);
    // a figura e a tabela completa ficam as duas na página; a tabela das capitais e o resumo do grupo são do kit, à vista
    expect(h).toContain('data-figura-legado="distribuicao-capitais"');
    for (const t of ["Destacar capitais", "Colunas em exibição", "Ordenar a tabela por", "Baixar esta tabela (CSV)", "Baixar estes valores (CSV)", "Copiar link deste recorte", "Dicionário das colunas (CSV)", "Mediana do grupo", "Capitais com valor e na comparação", "Ressalvas"]) {
      expect(h).toContain(t);
    }
    expect(h.match(/data-bloco-tabela=""/g)).toHaveLength(2);
    expect(h).not.toContain("max-h-[40rem]");
  });
  it("o detalhe de uma capital (composição, ponte e matrículas por etapa) é uma figura do kit, com a tabela equivalente e sem tabela à mão", () => {
    const g = goldEducacao()!;
    const todos = contextos(g);
    const caso = (tema: "gastos" | "atendimento") => {
      const d = dadosPainelTema(g, tema);
      const fontes = Object.fromEntries(Object.entries(d.fontes).map(([id, f]) => [id, { nome: `${f.instituicao}, ${f.conjunto}`, orgao: f.instituicao, conjunto: f.conjunto, url: f.pagina, capturado_em: f.capturado_em }]));
      return { d, ix: new Indice(d), fontes, ficha: (id: string) => d.fichas.find((x) => x.id === id)! };
    };
    const gastos = caso("gastos");
    const atend = caso("atendimento");
    const cap = gastos.d.capitais[0];
    const anoGasto = anosDaMedida(gastos.d, "despesa").at(-1)!;
    const anoCenso = anosDaMedida(atend.d, "matriculas").at(-1)!;
    const figuras = [
      html(createElement(ComposicaoDespesa, { ix: gastos.ix, cap, ano: anoGasto, ficha: gastos.ficha("edu.despesa.subfuncao"), ctx: todos["edu.despesa.subfuncao"], fontes: gastos.fontes })),
      html(createElement(PonteDaRazao, { ix: gastos.ix, cap, ano: anoGasto, razao: gastos.ix.ponto("edu.despesa.aplicacao_direta_por_matricula", cap.cod, anoGasto, null, "nominal"), ficha: gastos.ficha("edu.despesa.ponte_matricula"), ctx: todos["edu.despesa.ponte_matricula"], fontes: gastos.fontes })),
      html(createElement(MatriculasPorEtapa, { ix: atend.ix, cap: atend.d.capitais[0], ano: anoCenso, ficha: atend.ficha("edu.matriculas.rede_municipal"), ctx: todos["edu.matriculas.rede_municipal"], fontes: atend.fontes })),
    ];
    for (const h of figuras) {
      expect(h).toContain("data-figura-analitica");
      expect(h).toMatch(/data-grafico="(barras|sem-composicao)"/);
      expect(h).toContain("data-nao-concluir");
      // toda <table> é a do kit
      expect((h.match(/<table/g) ?? []).length).toBe((h.match(/<table[^>]*data-tabela-dados/g) ?? []).length);
    }
  });
  it("gastos: as três escalas do gasto na faixa e na escolha da medida, os valores reais e o perímetro da despesa", () => {
    const h = pagina(PaginaEduGastos);
    for (const t of ["Três escalas do gasto", "Por habitante", "Por matrícula", "Reais de 2025 (IPCA)", "Grupo de comparação", "Ordem das capitais"]) expect(h).toContain(t);
    expect(h).toContain('data-ressalva=""');
  });
});

describe("molde de painel: energia e conectividade", () => {
  const visao = (slug: string) => html(createElement(PaginaEnergia, { params: { painel: [slug] } }));
  // cada visão do modelo [[...painel]] tem corpo próprio; as quatro de medida estão no molde, Dados e métodos fica fora
  it.each(["acesso", "continuidade", "custo", "internet"])("/eficiencia-estatal/energia-conectividade/%s", (slug) => {
    const h = visao(slug);
    conferirPainel(`/eficiencia-estatal/energia-conectividade/${slug}`, h);
    // o aviso do painel principal continua nas visões que o tinham (todas menos Conectividade)
    expect(h.includes("data-painel-principal")).toBe(slug !== "internet");
  });
  it("acesso: o ano das estimativas, a tabela por território, a nota amostral, o arquivo e os sistemas isolados", () => {
    const h = visao("acesso");
    for (const t of ["Quem ainda não tem energia?", "Ano de referência", "Ter energia, estar ligado à rede e receber em tempo integral.", "CV é o coeficiente de variação", "Baixar todas as observações de acesso (CSV)", "Sistemas isolados também fornecem energia.", "Examinar inclusão e sistemas isolados no Setor Elétrico"]) {
      expect(h).toContain(t);
    }
    expect(h).toContain('data-bloco-tabela=""');
  });
  it("continuidade: a figura do DEC no kit, o ano corrente como ressalva, a busca, a ordem, o arquivo e o caminho ao Setor Elétrico", () => {
    const h = visao("continuidade");
    for (const t of ["Por quanto tempo falta energia?", "Quanto tempo falta energia, ano a ano?", "Ano corrente:", "Buscar distribuidora", "Ordenar por", "DEC apurado crescente", "Baixar histórico por distribuidora (CSV)", "Explorar meses, conjuntos e compensações", "As parcelas expurgadas não entram no indicador apurado"]) {
      expect(h).toContain(t);
    }
    expect(h).toContain('data-grafico="pontos"');
  });
  it("custo: a Tarifa Social e o Luz para Todos no NumeroIndicador, a busca, o consumo, o cálculo e o arquivo; nenhuma data crua na tabela", () => {
    const h = visao("custo");
    expect(h.match(/data-numero-indicador=""/g)).toHaveLength(2);
    for (const t of ["Tarifa Social: unidade consumidora não é pessoa.", "Luz para Todos: ligações registradas pelo programa.", "Consumo de referência (kWh/mês)", "Cálculo: consumo × (TE + TUSD) ÷ 1.000.", "Baixar tarifas da publicação (CSV)", "Consultar orçamento familiar, subsídios e recursos por contrato"]) {
      expect(h).toContain(t);
    }
  });
  it("internet: as barras do kit, a diferença urbana e rural e o arquivo do recorte", () => {
    const h = visao("internet");
    for (const t of ["Internet no domicílio: cidade e campo.", "Diferença urbana–rural:", "Baixar recorte de conectividade (CSV)", "cobertura 4G/5G"]) expect(h).toContain(t);
    expect(h).toContain('data-grafico="barras"');
  });
  it("Dados e métodos segue fora do molde (página de método)", () => {
    const h = visao("metodos");
    expect(h).not.toContain("data-painel");
    expect(h).toContain("Regras de interpretação.");
  });
});

describe("molde de painel: meio ambiente e clima", () => {
  it("/eficiencia-estatal/meio-ambiente-clima (o panorama do modelo [[...painel]])", () => {
    const h = html(createElement(PaginaAmbiente, { params: {} }));
    conferirPainel("/eficiencia-estatal/meio-ambiente-clima", h);
    // os três capítulos a um clique, a figura das regiões no kit e os outros painéis de clima e território, à vista
    for (const s of ["riscos", "prevencao", "residuos"]) expect(h).toContain(`href="/eficiencia-estatal/meio-ambiente-clima/${s}"`);
    for (const t of ["Quanto do lixo coletado vai para destino inadequado?", "traço: Brasil", "Ver coleta seletiva e recuperação", "Os outros painéis de clima e território", "Ausência de indicador não significa ausência de problema."]) {
      expect(h).toContain(t);
    }
    for (const href of ["/territorio/desastres", "/territorio/queimadas", "/territorio/emissoes", "/agronegocio/ambiente"]) expect(h).toContain(`href="${href}"`);
    expect(h).toContain('data-grafico="barras"');
  });
  it("Dados e métodos segue fora do molde (página de método)", () => {
    const h = html(createElement(PaginaAmbiente, { params: { painel: ["metodos"] } }));
    expect(h).not.toContain("data-painel");
    expect(h).toContain("O que os dados permitem afirmar.");
    expect(h).toContain("Regras para interpretar");
  });
});
