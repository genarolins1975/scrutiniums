import { describe, expect, it } from "vitest";
import { ehApiDeDados, ehRotaPublica, exigeConta, prefetchDoLink } from "@/lib/rotasPublicas";
import { parDeIdioma } from "@/lib/i18n-rotas";
import sitemap from "@/app/sitemap";

/**
 * Fronteira entre a vitrine e os painéis (decisão de 13/10/2026): só a lista
 * aberta passa sem sessão; rota nova nasce fechada.
 */
describe("rotas públicas", () => {
  it("abre a vitrine, o método, o glossário, as institucionais e o fluxo de conta", () => {
    for (const p of [
      "/", "/termos", "/privacidade", "/imprensa", "/glossario", "/observatorio-do-credito",
      "/entrar", "/entrar/sms", "/cadastro", "/cadastro/perfil", "/sobre", "/sobre/erros", "/boletim/sair",
      "/setor-eletrico/metodologia", "/setor-eletrico/metodologia/avaliacao", "/setor-eletrico/aprenda/gsf",
      "/contas-publicas/metodologia", "/contas-publicas/glossario", "/saneamento/metodologia", "/gas-natural/metodologia",
      "/eficiencia-estatal/saude-capitais/metodos", "/eficiencia-estatal/trabalho-renda/metodos/",
      "/home/credito.webp", "/robots.txt", "/sitemap.xml", "/icon.svg", "/opengraph-image",
      "/api/auth/login", "/api/onboarding/phone/check", "/api/telemetria",
    ]) expect(ehRotaPublica(p), p).toBe(true);
  });

  it("fecha painéis, arquivos, feeds, incorporações e a área de conta", () => {
    for (const p of [
      "/observatorio", "/observatorio/pix", "/obs/data/gold/meta.json", "/obs/embed.html", "/dados", "/dados/api",
      "/resumo", "/resumo/feed.xml", "/setor-eletrico", "/setor-eletrico/pld", "/energia/series/pld.csv",
      "/eficiencia-estatal/saude-capitais", "/eficiencia-estatal/saneamento/dados",
      "/contas-publicas", "/contas-publicas/execucao", "/contas-publicas-estaduais", "/contas-publicas-estaduais/comparacao.csv",
      "/saneamento", "/saneamento/acesso", "/saneamento/gold/municipios.csv",
      "/gas-natural", "/gas-natural/dados", "/gas/gold/meta.json", "/gas/series/preco-glp-por-uf.csv",
      "/app", "/app/observatorios", "/dados/pix/opengraph-image", "/rota-que-ainda-nao-existe",
      "/api/eficiencia-mobilidade/exportar",
    ]) expect(ehRotaPublica(p), p).toBe(false);
  });

  it("abre só as gravuras decorativas, que o otimizador de imagem busca sem sessão", () => {
    for (const p of ["/energia/arte/sistema-gravura-v1.webp", "/estado/arte/obee-gravura-v1.webp", "/obs/arte/economia-gravura-v1.webp"]) {
      expect(ehRotaPublica(p), p).toBe(true);
    }
    for (const p of ["/energia/arte", "/energia/arte/", "/energia/arte/../gold/pld.json", "/energia/arte/x.json", "/energia/gold/pld.json", "/saneamento/arte/x.webp"]) {
      expect(ehRotaPublica(p), p).toBe(false);
    }
  });

  it("toda imagem servida pelo otimizador do next/image é pública", async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const arquivos: string[] = [];
    const varrer = (d: string) => {
      for (const n of readdirSync(d)) {
        const c = join(d, n);
        if (statSync(c).isDirectory()) varrer(c);
        else if (/\.tsx$/.test(n)) arquivos.push(c);
      }
    };
    varrer(join(process.cwd(), "src"));
    const fontes = arquivos
      .filter((a) => /from ["']next\/image["']/.test(readFileSync(a, "utf8")))
      .flatMap((a) => [...readFileSync(a, "utf8").matchAll(/<Image[^>]*?src=\{?["'](\/[^"']+)["']/g)].map((m) => m[1]));
    expect(fontes.length).toBeGreaterThan(0);
    for (const f of fontes) expect(ehRotaPublica(f), f).toBe(true);
  });

  it("não aceita prefixo parcial nem caminho disfarçado", () => {
    for (const p of ["/sobrecarga", "/entrarx", "/eficiencia-estatal/saude-capitais/metodos/extra", "/setor-eletrico/metodologiax", "/gas-natural/metodologiax"]) {
      expect(ehRotaPublica(p), p).toBe(false);
    }
  });

  it("só a API de dados pede sessão", () => {
    expect(ehApiDeDados("/api/eficiencia-mobilidade/oportunidades")).toBe(true);
    expect(ehApiDeDados("/api/auth/eu")).toBe(false);
  });

  it("o sitemap só lista o que é público", () => {
    const urls = sitemap().map((u) => new URL(u.url).pathname);
    expect(urls.length).toBeGreaterThan(5);
    for (const u of urls) expect(ehRotaPublica(u), u).toBe(true);
  });
});

/**
 * Estratégia "aberto e com conta", leva 1 (decisão do dono de 19/10/2026, docs/BANCA_2026-10-19.md): o curioso
 * consulta o próprio caso sem conta. Abrem exatamente cinco consultas e os arquivos que elas buscam no
 * navegador; as vizinhas, os downloads e as subpáginas continuam fechados.
 */
describe("consultas abertas da leva 1", () => {
  const ABERTAS = [
    "/setor-eletrico/conta-de-luz", "/setor-eletrico/conta-de-luz/",
    "/saneamento/municipio", "/saneamento/municipio/", "/saneamento/municipio/2611606", "/saneamento/municipio/3550308/",
    "/saneamento/preco-regulado/simulador",
    "/eficiencia-estatal", "/eficiencia-estatal/",
    "/gas-natural/gas-de-cozinha",
  ];
  // os únicos arquivos que as consultas buscam no navegador, cada um pelo endereço exato
  const ARQUIVOS = ["/setor-eletrico/conta-de-luz/municipios.json", "/saneamento/gold/indice.json", "/energia/geo/uf.json"];

  it("abre as cinco consultas e os arquivos que o navegador busca", () => {
    for (const p of [...ABERTAS, ...ARQUIVOS]) expect(ehRotaPublica(p), p).toBe(true);
  });

  it("mantém fechadas as vizinhas, os downloads e as subpáginas", () => {
    for (const p of [
      // Conta de luz: a página de reajustes, os arquivos e o histórico por distribuidora
      "/setor-eletrico/conta-de-luz/reajustes-e-subsidios", "/setor-eletrico/conta-de-luz/reajustes-e-subsidios/",
      "/energia/series/conta_tarifas_b1_vigentes.csv", "/energia/series/conta_historico_b1.json", "/energia/gold/conta.json",
      "/energia/geo/municipios.json", "/energia/geo", "/energia/geo/",
      // Saneamento: a pasta gold, o atlas, a comparação, os prestadores e os outros capítulos do preço regulado
      "/saneamento/gold/municipios.csv", "/saneamento/gold/municipios.json", "/saneamento/gold", "/saneamento/gold/",
      "/saneamento/gold/uf/SP.json", "/saneamento/acesso", "/saneamento/comparar", "/saneamento/prestadores/sabesp",
      "/saneamento/preco-regulado", "/saneamento/preco-regulado/formacao", "/saneamento/preco-regulado/reajustes",
      "/saneamento/preco-regulado/contrapartidas", "/saneamento/preco-regulado/riscos",
      // Eficiência Estatal: a nota composta, os temas e a exportação das 26 capitais
      "/eficiencia-estatal/indice-de-resultados", "/eficiencia-estatal/saude-capitais", "/eficiencia-estatal/educacao-municipal-capitais",
      "/eficiencia-estatal/retrato-26-capitais.csv", "/eficiencia/atlas/frequencia-escolar-2022.csv",
      // Gás Natural: a entrada, os dados e as outras páginas
      "/gas-natural", "/gas-natural/dados", "/gas-natural/precos", "/gas-natural/gnv-e-gas-encanado", "/gas/gold/gas-de-cozinha.json",
      "/gas/series/preco-glp-brasil-mensal.csv",
    ]) expect(ehRotaPublica(p), p).toBe(false);
  });

  it("não aceita caminho disfarçado nem prefixo parcial", () => {
    for (const p of [
      "/setor-eletrico/conta-de-luzx", "/setor-eletrico/conta-de-luz/x", "/setor-eletrico/conta-de-luz//reajustes-e-subsidios",
      "/setor-eletrico/conta-de-luz/municipios.json/", "/setor-eletrico/conta-de-luz/municipios.jsonx",
      "/saneamento/municipiox", "/saneamento/municipio/261160", "/saneamento/municipio/26116060", "/saneamento/municipio/2611606/x",
      "/saneamento/municipio/abc1234", "/saneamento/municipio/%32611606", "/saneamento/municipio/2611606.json",
      "/saneamento/municipio/../acesso", "/saneamento/gold/indice.json/", "/saneamento/gold/indice.jsonx", "/saneamento/gold//indice.json",
      "/saneamento/gold/indice.json/../municipios.csv", "/saneamento/preco-regulado/simulador/x", "/saneamento/preco-regulado/simuladorx",
      "/eficiencia-estatalx", "/eficiencia-estatal/x", "/gas-natural/gas-de-cozinhax", "/gas-natural/gas-de-cozinha/serie.json",
      "/energia/geo/uf.json/", "/energia/geo/uf.jsonx", "/Saneamento/municipio", "/EFICIENCIA-ESTATAL",
    ]) expect(ehRotaPublica(p), p).toBe(false);
  });

  it("a irmã inglesa declarada herda a política; as demais não existem e seguem fechadas", () => {
    expect(parDeIdioma("/setor-eletrico/conta-de-luz")?.en).toBe("/en/setor-eletrico/conta-de-luz");
    expect(ehRotaPublica("/en/setor-eletrico/conta-de-luz")).toBe(true);
    expect(ehRotaPublica("/en/setor-eletrico/conta-de-luz/reajustes-e-subsidios")).toBe(false);
    for (const p of ["/en/saneamento/municipio", "/en/saneamento/municipio/2611606", "/en/eficiencia-estatal", "/en/gas-natural/gas-de-cozinha",
      "/en/saneamento/preco-regulado/simulador", "/en/saneamento/gold/indice.json", "/en/energia/geo/uf.json", "/en/setor-eletrico/conta-de-luz/municipios.json"]) {
      expect(ehRotaPublica(p), p).toBe(false);
    }
  });

  it("o pré-carregamento só vale para destino aberto, com e sem query e âncora", () => {
    expect(prefetchDoLink("/saneamento/municipio/2611606")).toBeUndefined();
    expect(prefetchDoLink("/saneamento/preco-regulado/simulador?t=sabesp")).toBeUndefined();
    expect(prefetchDoLink("/setor-eletrico/conta-de-luz?dist=23664303000104#simulador")).toBeUndefined();
    expect(prefetchDoLink("/saneamento/comparar?m=2611606")).toBe(false);
    expect(prefetchDoLink("/setor-eletrico/conta-de-luz/reajustes-e-subsidios#reajustes")).toBe(false);
    expect(exigeConta("/eficiencia-estatal/indice-de-resultados?territorio=2611606")).toBe(true);
    expect(exigeConta("/gas/series/preco-glp-por-uf.csv")).toBe(true);
    expect(exigeConta("/eficiencia-estatal")).toBe(false);
  });

  it("o sitemap lista as consultas abertas e nenhuma vizinha fechada", () => {
    const urls = new Set(sitemap().map((u) => new URL(u.url).pathname));
    for (const p of ["/setor-eletrico/conta-de-luz", "/en/setor-eletrico/conta-de-luz", "/saneamento/municipio", "/saneamento/municipio/2611606",
      "/saneamento/preco-regulado/simulador", "/eficiencia-estatal", "/gas-natural/gas-de-cozinha"]) expect(urls.has(p), p).toBe(true);
    for (const p of ["/setor-eletrico/conta-de-luz/reajustes-e-subsidios", "/saneamento/acesso", "/saneamento/comparar", "/eficiencia-estatal/indice-de-resultados",
      "/eficiencia-estatal/saude-capitais", "/gas-natural", "/gas-natural/dados", "/saneamento/gold/indice.json"]) expect(urls.has(p), p).toBe(false);
    // uma ficha por município do índice da busca
    expect([...urls].filter((u) => /^\/saneamento\/municipio\/\d{7}$/.test(u)).length).toBeGreaterThan(5000);
  });
});

describe("abas do cabeçalho", () => {
  it("cada aba leva à página aberta de um dos seis observatórios, logado ou não", async () => {
    const { navCabecalho } = await import("@/components/layout/navCabecalho");
    const { OBSERVATORIOS } = await import("@/lib/observatorios/registro");
    const abas = navCabecalho();
    expect(abas.map((n) => n.href)).toEqual([...OBSERVATORIOS.map((o) => `/perguntas/${o.id}`), "/imprensa"]);
    expect(abas.map((n) => n.label).slice(0, 6)).toEqual(OBSERVATORIOS.map((o) => o.nomeCurto));
    for (const n of abas) expect(ehRotaPublica(n.href), n.href).toBe(true);
  });

  it("as abas não consultam a sessão no navegador: o destino é o mesmo para todos", async () => {
    const { readFileSync } = await import("node:fs");
    const c = readFileSync(`${process.cwd()}/src/components/layout/AbasCabecalho.tsx`, "utf-8");
    expect(c).not.toMatch(/^"use client";/);
    expect(c).not.toContain("/api/auth/eu");
  });
});
