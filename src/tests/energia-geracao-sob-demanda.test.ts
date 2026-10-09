import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import GeracaoPage from "@/app/setor-eletrico/geracao/page";
import GeracaoTermicaPage from "@/app/setor-eletrico/geracao/termica/page";
import { GeracaoSerieRecente } from "@/components/energia/GeracaoSerieRecente";
import { GeracaoTabelaSobDemanda } from "@/components/energia/GeracaoTabelasSobDemanda";
import { REGISTRO_TABELAS_GERACAO, URL_GOLD_GERACAO_DETALHE, type TabelaGeracao } from "@/lib/energia/geracao-tabelas";
import { lerGold } from "@/lib/energia/gold";
import type { GoldGeracaoDetalhe } from "@/lib/energia/tipos-geracao";

/**
 * Tabelas dos níveis Analisar e Auditar de Geração (P021) e da Térmica (P022) lidas sob demanda: o HTML e as props da
 * página não carregam as linhas (/geracao tinha 1.045,5 kB e /geracao/termica 646,3 kB em 08/10/2026, contra 600 kB do
 * contrato, seção 5.1); o navegador lê geracao_detalhe.json quando a tabela chega perto da janela. As séries diária (60 dias)
 * e horária (72 horas) de Analisar seguem o mesmo caminho (GeracaoSerieRecente): com elas no HTML a abertura passava de
 * 615 kB depois de ganhar a composição completa e as cinco maiores fontes.
 */
const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
const g = lerGold<GoldGeracaoDetalhe>("geracao_detalhe.json") as GoldGeracaoDetalhe;
const IDS = Object.keys(REGISTRO_TABELAS_GERACAO) as TabelaGeracao[];

describe("registro das tabelas de Geração", () => {
  it("a URL da gold é a do arquivo publicado", () => {
    expect(URL_GOLD_GERACAO_DETALHE).toBe("/energia/gold/geracao_detalhe.json");
  });

  it("toda tabela monta colunas e linhas a partir da gold publicada", () => {
    expect(IDS.length).toBe(20);
    for (const id of IDS) {
      const p = REGISTRO_TABELAS_GERACAO[id].monta(g);
      if (p === null) {
        // só as tabelas que dependem de um bloco opcional da gold podem faltar
        expect(["doze", "lacuna", "outros-ceg", "cvu-combustivel", "cvu-mensal", "cvu-usinas", "universo-termica"], id).toContain(id);
        continue;
      }
      expect(p.titulo.length, id).toBeGreaterThan(5);
      expect(p.colunas.length, id).toBeGreaterThan(1);
      expect(p.linhas.length, id).toBeGreaterThan(0);
      expect(p.nomeArquivo, id).toMatch(/^geracao-/);
      expect(p.fonte, id).toMatch(/ONS|Controles|Portal/);
    }
  });

  it("título, nota e cabeçalhos das tabelas não trazem nome de campo (snake_case)", () => {
    const campo = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/;
    for (const id of IDS) {
      const p = REGISTRO_TABELAS_GERACAO[id].monta(g);
      if (p === null) continue;
      const textos = [p.titulo, p.nota ?? "", ...p.colunas.map((c) => c.rotulo)];
      for (const t of textos) expect(t, `${id}: ${t.slice(0, 60)}`).not.toMatch(campo);
    }
  });

  it("as linhas coincidem com a série publicada de cada tabela", () => {
    const m = g.matriz;
    expect(REGISTRO_TABELAS_GERACAO.diaria.monta(g)!.linhas.length).toBe(m.diario_sin_recente.dias.length);
    expect(REGISTRO_TABELAS_GERACAO.horaria.monta(g)!.linhas.length).toBe(m.horario_sin_recente.horas.length);
    expect(REGISTRO_TABELAS_GERACAO.anual.monta(g)!.linhas.length).toBe(m.anual_sin.length);
    expect(REGISTRO_TABELAS_GERACAO.quebras.monta(g)!.linhas.length).toBe(g.quebras.length);
    expect(REGISTRO_TABELAS_GERACAO.controles.monta(g)!.linhas.length).toBe(g.controles.length);
    expect(REGISTRO_TABELAS_GERACAO.fontes.monta(g)!.linhas.length).toBe(g.fontes.length);
    expect(REGISTRO_TABELAS_GERACAO.rotulos.monta(g)!.linhas.length).toBe(m.rotulos.length);
    if (g.termica?.cvu) expect(REGISTRO_TABELAS_GERACAO["cvu-usinas"].monta(g)!.linhas.length).toBeGreaterThan(50);
  });

  it("a chave de URL de cada tabela é única (busca, filtro, ordem e página de uma não vão para outra)", () => {
    const chaves = IDS.map((id) => REGISTRO_TABELAS_GERACAO[id].chaveUrl);
    expect(new Set(chaves).size).toBe(chaves.length);
  });

  it("as chaves conhecidas de links já compartilhados foram mantidas", () => {
    const esperado: Record<string, string> = { diaria: "dd", horaria: "hh", natureza: "nt", anual: "an", a11: "a11", "mmgd-api": "api", "rec-fonte": "rf", "rec-mensal": "rm", divergencias: "dv", lacuna: "lc", quebras: "qb", rotulos: "rt", "outros-ceg": "oc", controles: "ct", fontes: "ft", doze: "dz", "cvu-combustivel": "cvc", "cvu-mensal": "cvm", "cvu-usinas": "cvu", "universo-termica": "ut" };
    for (const [id, chave] of Object.entries(esperado)) expect(REGISTRO_TABELAS_GERACAO[id as TabelaGeracao].chaveUrl, id).toBe(chave);
  });
});

describe("páginas sem as linhas no HTML", () => {
  const geracao = renderToStaticMarkup(createElement(GeracaoPage as never));
  const termica = renderToStaticMarkup(createElement(GeracaoTermicaPage as never));

  it("Geração leva um marcador por tabela de Analisar e Auditar, e não as linhas", () => {
    expect((geracao.match(/data-tabela-geracao="/g) ?? []).length).toBeGreaterThanOrEqual(15);
    for (const titulo of ["Dias conciliados por fonte, em todo o histórico", "Mudanças de universo e de rótulo na fonte", "Controles executados antes da publicação", "Conjuntos integrados neste módulo", "Tabela equivalente: geração horária por categoria, últimas 72 horas"]) {
      expect(geracao, titulo).not.toContain(titulo);
    }
    expect(Buffer.byteLength(geracao)).toBeLessThan(420_000);
  });

  it("a Térmica leva um marcador por tabela do CVU e do universo, e não as linhas", () => {
    expect((termica.match(/data-tabela-geracao="/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(termica).not.toContain("Mês a mês, as mesmas usinas nos dois conjuntos do ONS");
    expect(termica).not.toContain("Tabela equivalente: mediana mensal do CVU por combustível");
    expect(Buffer.byteLength(termica)).toBeLessThan(340_000);
  });

  it("as páginas não importam mais a TabelaInterativa para os níveis Analisar e Auditar", () => {
    for (const f of ["src/app/setor-eletrico/geracao/page.tsx", "src/app/setor-eletrico/geracao/termica/page.tsx"]) {
      const t = ler(f);
      expect(t, f).not.toContain("<TabelaInterativa");
      expect(t, f).toContain("<GeracaoTabelaSobDemanda");
    }
  });

  it("o marcador diz o que acontece e oferece o botão, sem JavaScript também", () => {
    const html = renderToStaticMarkup(createElement(GeracaoTabelaSobDemanda, { tabela: "diaria", versao: "2026-09-29" }));
    expect(html).toContain('data-tabela-geracao="diaria"');
    expect(html).toContain("lida da base publicada quando aparece na tela");
    expect(html).toContain("Carregar a tabela");
    expect(html).toContain("arquivos CSV do painel");
  });
});

describe("séries diária e horária do SIN lidas sob demanda", () => {
  const geracao = renderToStaticMarkup(createElement(GeracaoPage as never));

  it("cada série leva um marcador com o botão e o aviso de onde estão os arquivos, sem o gráfico nem as linhas", () => {
    for (const tipo of ["diaria", "horaria"] as const) {
      const html = renderToStaticMarkup(createElement(GeracaoSerieRecente, { tipo }));
      expect(html, tipo).toContain(`data-grafico-sob-demanda="${tipo}"`);
      expect(html, tipo).toContain(`A série ${tipo === "diaria" ? "diária" : "horária"} é lida da base publicada quando aparece na tela`);
      expect(html, tipo).toContain("Carregar a série");
      expect(html, tipo).toContain("arquivos CSV do painel");
      expect(html, tipo).not.toContain("data-grafico=");
      expect(html, tipo).toContain('aria-live="polite"');
    }
    expect(geracao).toContain('data-grafico-sob-demanda="diaria"');
    expect(geracao).toContain('data-grafico-sob-demanda="horaria"');
  });

  it("a página não passa as séries aos componentes cliente e o gráfico lido depois mantém as chaves de URL dos links já compartilhados", () => {
    const pagina = ler("src/app/setor-eletrico/geracao/page.tsx");
    expect(pagina).not.toContain("linhasRecentes");
    expect(pagina).not.toContain("diario_sin_recente.categorias");
    expect(pagina).toContain('<GeracaoSerieRecente tipo="diaria" />');
    expect(pagina).toContain('<GeracaoSerieRecente tipo="horaria" />');
    const t = ler("src/components/energia/GeracaoSerieRecente.tsx");
    expect(t).toContain('tipo === "diaria" ? "dia" : "hor"');
    expect(t).toContain("useGoldGeracaoSobDemanda()");
    expect(t).toContain("linhasRecentes(eixo, serie)");
    // o estado do gráfico na URL (intervalo, séries ocultas) pede a leitura de imediato, como nas tabelas
    expect(t).toContain("k.startsWith(prefixo)");
    // o gráfico lido é o mesmo componente de linhas, com legenda interativa e zero no eixo
    expect(t).toContain("legendaInterativa");
    expect(t).toContain("zeroNoEixo");
  });

  it("a leitura é um hook compartilhado com as tabelas: um pedido, uma leitura da gold, e o erro tem nova tentativa", () => {
    const tabelas = ler("src/components/energia/GeracaoTabelasSobDemanda.tsx");
    expect(tabelas).toContain("export function useGoldGeracaoSobDemanda()");
    expect(tabelas).toContain("useGoldGeracaoSobDemanda()");
    const serie = ler("src/components/energia/GeracaoSerieRecente.tsx");
    expect(serie).toContain("A série não pôde ser lida da base publicada");
    expect(serie).toContain("Tentar de novo");
    // os arquivos CSV das duas séries continuam no fim do painel (downloads do P021)
    expect(g.downloads.some((d) => /matriz/.test(d.url))).toBe(true);
  });

  it("as séries publicadas que o gráfico lê existem na gold: 60 dias e 72 horas, com as mesmas categorias da tabela equivalente", () => {
    const m = g.matriz;
    expect(m.diario_sin_recente.dias.length).toBeGreaterThan(30);
    expect(m.horario_sin_recente.horas.length).toBe(72);
    expect(m.diario_sin_recente.categorias.length).toBeGreaterThan(5);
    expect(m.horario_sin_recente.categorias).toEqual(m.diario_sin_recente.categorias);
  });
});

describe("mecanismo de leitura", () => {
  const t = ler("src/components/energia/GeracaoTabelasSobDemanda.tsx");
  it("lê a gold sob demanda, por IntersectionObserver ou botão, e reage ao estado da tabela na URL", () => {
    expect(t).toContain("carregaJson<GoldGeracaoDetalhe>(URL_GOLD_GERACAO_DETALHE)");
    expect(t).toContain("IntersectionObserver");
    expect(t).toContain('rootMargin: "600px 0px"');
    expect(t).toContain("k.startsWith(prefixo)");
  });
  it("erro de leitura não é silencioso e tem nova tentativa", () => {
    expect(t).toContain("A tabela não pôde ser lida da base publicada");
    expect(t).toContain("Tentar de novo");
  });
});
