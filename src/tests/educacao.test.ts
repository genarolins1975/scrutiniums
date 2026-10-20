import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * Painel "Educação nos municípios" (aprovado pelo dono em 20/10/2026): Observatório dos Serviços Públicos, coleção Educação,
 * com pipeline e gold próprios (pipeline/educacao, public/educacao/gold). Confere o lugar no registro e na navegação (a
 * porta da coleção, com "Educação nas capitais" como aprofundamento), o acesso pelo princípio do aperitivo (o endereço
 * público serve o aperitivo sem sessão e o painel com sessão; gold e arquivos com conta), os números das páginas contra a
 * gold, o que o aperitivo não pode mostrar, o convite dimensionado pelo município, os arquivos para baixar e as entradas
 * que citam o painel.
 */
const caminho = vi.hoisted(() => ({ atual: "/educacao-municipal" }));
vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<typeof import("next/navigation")>("next/navigation")),
  usePathname: () => caminho.atual,
  useRouter: () => ({ push: () => undefined, prefetch: () => undefined, replace: () => undefined }),
  useSearchParams: () => new URLSearchParams(),
}));

const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
const textoDe = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;| /g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");
const semComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const fmt = (v: number, casas = 1) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

type Gold = import("@/lib/educacao/tipos").GoldEducacao;
type ArquivoUf = import("@/lib/educacao/tipos").ArquivoUf;
const gold = JSON.parse(ler("public/educacao/gold/educacao.json")) as Gold;
const uf = (s: string) => JSON.parse(ler(`public/educacao/gold/municipios/${s}.json`)) as ArquivoUf;
const SP = "3550308";
const BRASILIA = "5300108";
const K = gold.ideb.anos.length - 1;

async function aperitivo(ibge?: string): Promise<string> {
  caminho.atual = "/educacao-municipal";
  const { default: Pagina } = await import("@/app/aperitivo/educacao-municipal/page");
  return renderToStaticMarkup(createElement(Pagina, { searchParams: ibge ? { ibge } : {} }));
}

async function painel(ibge?: string): Promise<string> {
  caminho.atual = "/educacao-municipal";
  const { default: Pagina } = await import("@/app/educacao-municipal/page");
  return renderToStaticMarkup(createElement(Pagina, { searchParams: ibge ? { ibge } : {} }));
}

describe("educação nos municípios: lugar no registro, navegação e acesso", () => {
  it("porta da coleção Educação dos Serviços Públicos, antes do painel das capitais, mantido pelo próprio observatório", async () => {
    const { donoDaRota, observatorio } = await import("@/lib/observatorios/registro");
    const { colecoesDe } = await import("@/lib/observatorios/colecoes");
    expect(donoDaRota("/educacao-municipal")).toMatchObject({ observatorio: "servicos-publicos", colecao: "educacao", titulo: "Educação nos municípios", origem: null });
    expect(observatorio("servicos-publicos").colecoes.find((c) => c.id === "educacao")?.href).toBe("/educacao-municipal");
    const paineis = colecoesDe("servicos-publicos").find((c) => c.id === "educacao")!.paineis.map((p) => p.href);
    expect(paineis[0]).toBe("/educacao-municipal");
    // o painel canônico das capitais continua na coleção, como aprofundamento, sem virar cópia
    expect(paineis).toContain("/eficiencia-estatal/educacao-municipal-capitais");
    const { COPIAS } = await import("@/lib/observatorios/copias");
    expect(COPIAS.some((c) => c.rota === "/educacao-municipal" || c.principal === "/educacao-municipal")).toBe(false);
  });

  it("um endereço público para o tema: aperitivo sem sessão, painel com sessão; gold, arquivos e caminho interno fechados", async () => {
    const { APERITIVOS, desvioDoAperitivo, ehRotaPublica, exigeConta } = await import("@/lib/rotasPublicas");
    expect(APERITIVOS.find((a) => a.rota === "/educacao-municipal")).toEqual({ tema: "Educação nos municípios", rota: "/educacao-municipal", versaoAberta: "/aperitivo/educacao-municipal", painelCompleto: "/educacao-municipal" });
    expect(ehRotaPublica("/educacao-municipal")).toBe(true);
    expect(desvioDoAperitivo("/educacao-municipal")).toEqual({ tipo: "aperitivo", destino: "/aperitivo/educacao-municipal" });
    expect(desvioDoAperitivo("/aperitivo/educacao-municipal")).toEqual({ tipo: "interno" });
    for (const r of [
      "/educacao/gold/educacao.json",
      "/educacao/gold/municipios/SP.json",
      "/educacao-municipal/ideb-por-municipio.csv",
      "/educacao-municipal/censo-escolar-por-municipio.csv",
      "/educacao-municipal/resumo-por-estado.csv",
      "/eficiencia-estatal/educacao-municipal-capitais",
    ]) {
      expect(exigeConta(r), r).toBe(true);
    }
  });

  it("as rotas dinâmicas levam a gold no pacote do servidor, e a home lê a gold nacional", async () => {
    const { default: config } = await import("../../next.config.mjs");
    const inc = (config as { experimental: { outputFileTracingIncludes: Record<string, string[]> } }).experimental.outputFileTracingIncludes;
    expect(inc["/educacao-municipal"]).toContain("./public/educacao/gold/**/*.json");
    expect(inc["/aperitivo/educacao-municipal"]).toContain("./public/educacao/gold/**/*.json");
    expect(inc["/"]).toContain("./public/educacao/gold/educacao.json");
    for (const s of ["AC", "SP", "DF"]) expect(existsSync(join(raiz, "public/educacao/gold/municipios", `${s}.json`)), s).toBe(true);
  });
});

describe("educação nos municípios: aperitivo (sem sessão)", () => {
  it("o município escolhido: Ideb da rede municipal nas duas etapas, com ano, escala, fonte, captura e ressalva", async () => {
    const m = uf("SP").municipios.find((x) => x.id === SP)!;
    const t = textoDe(await aperitivo(SP));
    expect(t).toContain("Como está a escola pública da minha cidade?");
    expect(t).toContain(`${fmt(m.ai.municipal!.ideb[K]!)} de 0 a 10`);
    expect(t).toContain(`${fmt(m.af.municipal!.ideb[K]!)} de 0 a 10`);
    expect(t).toContain(`Ideb ${gold.ideb.ano} · rede municipal`);
    expect(t).toMatch(/INEP, Ideb \d{4}, resultados por município, divulgados em \d{2}\/\d{2}\/\d{4}\. Dados capturados em \d{2}\/\d{2}\/\d{4}/);
    expect(t).toContain("O Ideb junta aprendizagem e aprovação");
    // capital: leva ao painel das capitais (aprofundamento da Eficiência Estatal)
    expect(await aperitivo(SP)).toContain('href="/eficiencia-estatal/educacao-municipal-capitais"');
  });

  it("só o aperitivo: sem série, sem comparação, sem componentes, sem tabela e sem arquivo para baixar", async () => {
    const html = await aperitivo(SP);
    expect(html).not.toContain("<table");
    expect(html).not.toContain("edm-svg");
    expect(html).not.toMatch(/\.csv/);
    expect(html).not.toContain("edm-faixa");
    expect(html).not.toContain("data-modelo-didatico");
    const t = textoDe(html);
    expect(t).not.toMatch(/º entre as/);
    expect(t).not.toContain("Mediana");
    // o convite lista, seção por seção, o que a conta acrescenta, e leva ao login com a volta para o município
    expect(html).toContain("data-convite-aperitivo");
    expect(html).toContain(encodeURIComponent(`/educacao-municipal?ibge=${SP}`));
    expect(t).toContain(`de ${gold.ideb.anos[0]} a ${gold.ideb.ano}`);
  });

  it("rede sem Ideb diz o motivo, nunca zero: Brasília não tem rede municipal e mostra a rede pública da etapa", async () => {
    const df = uf("DF").municipios[0];
    expect(df.id).toBe(BRASILIA);
    const t = textoDe(await aperitivo(BRASILIA));
    expect(t).toContain(`Sem Ideb ${gold.ideb.ano}`);
    expect(t).toContain("A rede não tem alunos nesta etapa no Censo Escolar");
    expect(t).toContain(`A rede pública da cidade, que atende essa etapa, teve Ideb ${fmt(df.ai.publica!.ideb[K]!)}`);
    expect(t).not.toMatch(/\b0,0 de 0 a 10/);
  });

  it("sem município: a busca e o Brasil; código desconhecido avisa e não chuta", async () => {
    const t = textoDe(await aperitivo());
    expect(t).toContain(`o Ideb das redes municipais foi ${fmt(gold.ideb.brasil.ai.municipal.ideb[K]!)} nos anos iniciais e ${fmt(gold.ideb.brasil.af.municipal.ideb[K]!)} nos anos finais`);
    expect(textoDe(await aperitivo("9999999"))).toContain("Nenhum município da base tem o código IBGE 9999999");
    expect(textoDe(await aperitivo("abc"))).toContain("sete dígitos");
  });

  it("o caminho interno nunca aparece em link e a página não escreve número à mão", () => {
    for (const f of ["src/app/aperitivo/educacao-municipal/page.tsx", "src/app/educacao-municipal/page.tsx", "src/components/educacao/PainelEducacao.tsx"]) {
      const fonte = ler(f);
      expect(fonte, f).not.toMatch(/href=\{?["'`]\/aperitivo/);
      // o único ano escrito é 2021, a marca da pandemia que o INEP pede para ler à parte (e só se a série tiver esse ano)
      expect(semComentarios(fonte).replace(/2021/g, ""), f).not.toMatch(/\b(19|20)\d{2}\b/);
    }
  });
});

describe("educação nos municípios: o convite do aperitivo não promete o que o município não tem", () => {
  it("a série começa no primeiro ano com Ideb da rede do município; a posição no estado só com Ideb recente", async () => {
    const { comConta } = await import("@/lib/educacao/convite");
    const sp = uf("SP").municipios.find((x) => x.id === SP)!;
    const itensSp = comConta(gold, { m: sp, uf: "SP" });
    expect(itensSp[0]).toContain(`de ${gold.ideb.anos[0]} a ${gold.ideb.ano}`);
    expect(itensSp.join(" ")).toContain("a posição da rede entre elas");
    // um município cuja rede municipal só tem Ideb a partir de um ano posterior a 2005
    const todos = ["AC", "AM", "PA", "MG", "BA", "MT"].flatMap((s) => uf(s).municipios.map((m) => ({ m, s })));
    const tardio = todos.find(({ m }) => {
      const anos = gold.ideb.anos.filter((_, i) => m.ai.municipal?.ideb[i] != null || m.af.municipal?.ideb[i] != null);
      return anos.length > 1 && anos[0] > gold.ideb.anos[0];
    })!;
    expect(tardio).toBeDefined();
    const primeiro = gold.ideb.anos.find((_, i) => tardio.m.ai.municipal?.ideb[i] != null || tardio.m.af.municipal?.ideb[i] != null)!;
    const item = comConta(gold, { m: tardio.m, uf: tardio.s })[0];
    expect(item).toContain(`de ${primeiro} a`);
    expect(item).not.toContain(`de ${gold.ideb.anos[0]} a`);
    // Brasília: sem rede municipal, o convite fala da rede pública e não promete posição entre redes municipais
    const df = uf("DF").municipios[0];
    const itensDf = comConta(gold, { m: df, uf: "DF" }).join(" ");
    expect(itensDf).toContain("da rede pública");
    expect(itensDf).not.toContain("a posição da rede entre elas");
    expect(itensDf).toContain("não tem rede municipal com alunos");
  });
});

describe("educação nos municípios: painel completo (com sessão)", () => {
  it("abertura: os quatro números com período e fonte, lidos da gold", async () => {
    const t = textoDe(await painel());
    expect(t).toContain(`Ideb dos anos iniciais, redes municipais do Brasil ${fmt(gold.ideb.brasil.ai.municipal.ideb[K]!)} de 0 a 10`);
    expect(t).toContain(`${gold.cobertura.ai.municipal.com_ideb.toLocaleString("pt-BR")} de ${gold.municipios.total.toLocaleString("pt-BR")} municípios`);
    expect(t).toContain(fmt(gold.censo.brasil.mat_municipal / 1e6, 2));
    expect(t).toContain(`INEP, Ideb ${gold.ideb.ano}`);
  });

  it("todas as seções por pergunta, o método recolhido e os três arquivos; nenhum selo no painel completo", async () => {
    const html = await painel();
    for (const id of ["municipio", "estados", "porte", "cobertura", "capitais", "metodo"]) expect(html, id).toContain(`id="${id}"`);
    for (const a of ["ideb-por-municipio.csv", "censo-escolar-por-municipio.csv", "resumo-por-estado.csv"]) {
      expect(html).toContain(`/educacao-municipal/${a}`);
      expect(existsSync(join(raiz, "src/app/educacao-municipal", a, "route.ts")), a).toBe(true);
    }
    expect(textoDe(html)).toContain("Rio Grande do Norte");
    expect(html).not.toContain("com conta</span>");
  });

  it("com o município: série com meta, componentes, laboratório, posição no estado, porte e matrículas", async () => {
    const html = await painel(SP);
    const t = textoDe(html);
    for (const id of ["serie", "componentes", "comparacao", "matriculas"]) expect(html, id).toContain(`id="${id}"`);
    expect(html).toContain("edm-meta");
    expect(html).toContain("data-modelo-didatico");
    expect(t).toMatch(/\d+º entre as [\d.]+ redes municipais de São Paulo com Ideb/);
    const m = uf("SP").municipios.find((x) => x.id === SP)!;
    expect(t).toContain(`A rede municipal de São Paulo tem ${m.censo!.mat_municipal.toLocaleString("pt-BR")} matrículas`);
    // 2013 sem Ideb (não divulgado a pedido) aparece como ausência na tabela e quebra a linha do gráfico
    expect(t).toContain("Sem Ideb");
    expect(t).toContain("ND*");
  });

  it("cobertura: cada etapa e rede soma o universo; a contagem confere com a nota informativa", () => {
    for (const e of ["ai", "af"] as const) {
      for (const r of ["municipal", "publica"] as const) {
        const c = gold.cobertura[e][r];
        expect(c.com_ideb + Object.values(c.motivos).reduce((a, b) => a + b, 0)).toBe(gold.municipios.total);
      }
    }
  });
});

describe("educação nos municípios: arquivos para baixar", () => {
  it("resumo por estado: duas linhas por UF, com fonte", async () => {
    const { csvEstados } = await import("@/lib/educacao/csv");
    const txt = (await csvEstados().text()).replace(/^﻿/, "");
    const linhas = txt.trim().split("\n");
    expect(linhas).toHaveLength(27 * 2 + 1);
    expect(linhas[0]).toContain("ideb_rede_publica_uf");
    expect(linhas[1]).toContain("INEP");
  });

  it("Censo por município: uma linha por município, somando o Brasil", async () => {
    const { csvCenso } = await import("@/lib/educacao/csv");
    const txt = (await csvCenso().text()).replace(/^﻿/, "");
    const [cab, ...linhas] = txt.trim().split("\n").map((l) => l.split(";"));
    expect(linhas).toHaveLength(gold.municipios.total);
    const i = cab.indexOf("mat_municipal");
    expect(linhas.reduce((s, l) => s + Number(l[i] || 0), 0)).toBe(gold.censo.brasil.mat_municipal);
  });

  it("Ideb por município: ausência vazia com o motivo, nunca zero", async () => {
    const { csvIdeb } = await import("@/lib/educacao/csv");
    const txt = (await csvIdeb().text()).replace(/^﻿/, "");
    const [cab, ...linhas] = txt.trim().split("\n").map((l) => l.split(";"));
    const iIdeb = cab.indexOf("ideb");
    const iMotivo = cab.indexOf("motivo_sem_ideb");
    const df = linhas.filter((l) => l[0] === BRASILIA && l[4] === "municipal");
    expect(df.length).toBeGreaterThan(0);
    for (const l of df) {
      expect(l[iIdeb]).toBe("");
      expect(l[iMotivo]).toBe("sem_matricula");
    }
    expect(linhas.some((l) => l[iIdeb] === "0")).toBe(false);
  });
});

describe("educação nos municípios: entradas e camada aberta citam o painel", () => {
  it("a porta dos Serviços Públicos oferece a consulta em 'Para o seu caso', abre com o número e reescreve a lacuna", async () => {
    const { portas } = await import("@/lib/perguntas/portas");
    const p = portas().find((x) => x.id === "servicos-publicos")!;
    expect(p.paraOSeuCaso.map((c) => c.href)).toEqual(["/educacao-municipal", "/eficiencia-estatal"]);
    expect(p.paraOSeuCaso[0].pergunta).toBe("Como está a escola pública da minha cidade?");
    expect(p.lacunas).toContain("Saúde nos municípios que não são capitais.");
    expect(p.lacunas.join(" ")).not.toMatch(/Educação e saúde nos municípios/);
    expect(p.numeros[0].href).toBe("/educacao-municipal");
    expect(p.numeros[0].valor).toBe(fmt(gold.ideb.brasil.ai.municipal.ideb[K]!));
  });

  it("'Para você' dos Serviços Públicos, a entrada do observatório e a vitrine da home citam o painel", async () => {
    const { PARA_VOCE } = await import("@/lib/observatorios/paraVoce");
    expect(PARA_VOCE["/observatorios/servicos-publicos"][0]).toBe("escola");
    const { escalaServicos } = await import("@/lib/observatorios/entradas/servicos");
    expect(escalaServicos()[0].href).toBe("/educacao-municipal");
    const { vitrines } = await import("@/lib/vitrine");
    expect(vitrines().eficiencia.paineis[0]).toMatchObject({ href: "/educacao-municipal", titulo: "Educação nos municípios" });
  });

  it("frescor: domínio próprio, anual, lido da gold, na faixa dos Serviços Públicos", async () => {
    const limiares = JSON.parse(ler("src/lib/frescor/limiares.json"));
    expect(limiares.dominios.educacao).toMatchObject({ cadencia: "anual" });
    const { FRESCOR_DOS_OBSERVATORIOS } = await import("@/lib/frescor/entradas");
    expect(FRESCOR_DOS_OBSERVATORIOS["servicos-publicos"]).toContain("educacao");
  });

  it("textos de exibição sem hífen nem travessão", async () => {
    const p = await import("@/lib/educacao/paginas");
    const textos = [
      ...Object.values(p.TEXTO_MOTIVO), ...Object.values(p.ROTULO_MOTIVO), ...Object.values(p.NOME_ETAPA), ...Object.values(p.NOME_REDE),
      ...Object.values(p.DESCRICAO_REDE), ...p.DOWNLOADS.flatMap((d) => [d.rotulo, d.descricao]), p.PERGUNTA_PAINEL, p.PERGUNTA_APERITIVO, p.TITULO_PAINEL,
    ];
    for (const n of textos) expect(n, n).not.toMatch(/[–—]|\s-\s|\w-\w/);
    const html = textoDe(await painel(SP)) + textoDe(await aperitivo(SP));
    expect(html).not.toMatch(/\s[–—]\s/);
  });
});
