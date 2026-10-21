import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * Painel "Previdência e INSS" (aprovado pelo dono em 20/10/2026): Contas Federais, com pipeline e gold próprios
 * (pipeline/previdencia, public/previdencia/gold). Confere o lugar no registro e na navegação, o acesso pelo princípio do
 * aperitivo (o endereço público serve o aperitivo sem sessão e o painel com sessão; gold e arquivos com conta), os
 * números das páginas contra a gold, o que o aperitivo não pode mostrar, os arquivos para baixar e as entradas que citam
 * o painel.
 */
const caminho = vi.hoisted(() => ({ atual: "/contas-publicas/previdencia" }));
vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<typeof import("next/navigation")>("next/navigation")),
  usePathname: () => caminho.atual,
  useRouter: () => ({ push: () => undefined, prefetch: () => undefined, replace: () => undefined }),
  useSearchParams: () => new URLSearchParams(),
}));

const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
const textoDe = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;|\u00a0/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");
const semComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const fmt = (v: number, casas = 0) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

type Gold = import("@/lib/previdencia/tipos").GoldPrevidencia;
const gold = JSON.parse(ler("public/previdencia/gold/previdencia.json")) as Gold;
const SP = "3550308";

async function aperitivo(ibge?: string): Promise<string> {
  caminho.atual = "/contas-publicas/previdencia";
  const { default: Pagina } = await import("@/app/aperitivo/previdencia/page");
  return renderToStaticMarkup(createElement(Pagina, { searchParams: ibge ? { ibge } : {} }));
}

async function painel(ibge?: string): Promise<string> {
  caminho.atual = "/contas-publicas/previdencia";
  const { default: Pagina } = await import("@/app/contas-publicas/previdencia/page");
  return renderToStaticMarkup(createElement(Pagina, { searchParams: ibge ? { ibge } : {} }));
}

describe("previdência: lugar no registro, navegação e acesso", () => {
  it("painel das Contas Federais, no observatório das Contas Públicas, primeiro da navegação dos painéis", async () => {
    const { donoDaRota } = await import("@/lib/observatorios/registro");
    const { colecoesDe } = await import("@/lib/observatorios/colecoes");
    const { PAINEIS_NAVEGACAO } = await import("@/lib/contas-publicas/catalogo");
    expect(donoDaRota("/contas-publicas/previdencia")).toMatchObject({ observatorio: "contas-publicas", colecao: "federais", titulo: "Previdência e INSS" });
    expect(colecoesDe("contas-publicas").find((c) => c.id === "federais")!.paineis.map((p) => p.href)).toContain("/contas-publicas/previdencia");
    expect(PAINEIS_NAVEGACAO[0]).toEqual(["/contas-publicas/previdencia", "Previdência e INSS"]);
    // navegação do módulo: logo depois da visão geral
    const layout = ler("src/app/contas-publicas/layout.tsx");
    expect(layout.indexOf('href="/contas-publicas/previdencia"')).toBeGreaterThan(layout.indexOf('href="/contas-publicas">Visão geral'));
    expect(layout.indexOf('href="/contas-publicas/previdencia"')).toBeLessThan(layout.indexOf('href="/contas-publicas/por-area"'));
  });

  it("um endereço público para o tema: aperitivo sem sessão, painel com sessão; gold, arquivos e caminho interno fechados", async () => {
    const { APERITIVOS, desvioDoAperitivo, ehRotaPublica, exigeConta } = await import("@/lib/rotasPublicas");
    expect(APERITIVOS.find((a) => a.tema === "Previdência")).toEqual({ tema: "Previdência", rota: "/contas-publicas/previdencia", versaoAberta: "/aperitivo/previdencia", painelCompleto: "/contas-publicas/previdencia" });
    expect(ehRotaPublica("/contas-publicas/previdencia")).toBe(true);
    expect(desvioDoAperitivo("/contas-publicas/previdencia")).toEqual({ tipo: "aperitivo", destino: "/aperitivo/previdencia" });
    expect(desvioDoAperitivo("/aperitivo/previdencia")).toEqual({ tipo: "interno" });
    for (const r of [
      "/previdencia/gold/previdencia.json",
      "/previdencia/gold/municipios/SP.json",
      "/contas-publicas/previdencia/beneficios-por-municipio.csv",
      "/contas-publicas/previdencia/beneficios-por-estado.csv",
      "/contas-publicas/previdencia/beneficios-brasil-mensal.csv",
      "/contas-publicas/previdencia/resultado-rgps.csv",
    ]) {
      expect(exigeConta(r), r).toBe(true);
    }
  });

  it("as rotas dinâmicas levam a gold no pacote do servidor", async () => {
    const { default: config } = await import("../../next.config.mjs");
    const inc = (config as { experimental: { outputFileTracingIncludes: Record<string, string[]> } }).experimental.outputFileTracingIncludes;
    expect(inc["/contas-publicas/previdencia"]).toContain("./public/previdencia/gold/**/*.json");
    expect(inc["/aperitivo/previdencia"]).toContain("./public/previdencia/gold/**/*.json");
    expect(inc["/"]).toContain("./public/previdencia/gold/previdencia.json");
    for (const uf of ["AC", "SP", "DF"]) expect(existsSync(join(raiz, "public/previdencia/gold/municipios", `${uf}.json`)), uf).toBe(true);
  });
});

describe("previdência: aperitivo (sem sessão)", () => {
  it("o município escolhido: benefícios e valor médio de dezembro, com competência, fonte, captura e ressalva", async () => {
    const { consultarMunicipio, municipioNoAno } = await import("@/lib/previdencia/dados");
    const c = consultarMunicipio(SP);
    if (c.estado !== "ok") throw new Error("São Paulo fora da gold");
    const i = c.arquivo.anos.length - 1;
    const d = municipioNoAno(c.m, i)!;
    const t = textoDe(await aperitivo(SP));
    expect(t).toContain("Quanto o INSS paga na minha cidade?");
    expect(t).toContain(`${fmt(d.q.total)} benefícios`);
    expect(t).toContain(`R$ ${fmt(d.v.total / d.q.total, 2)}`);
    expect(t).toContain(`Competência dezembro de ${c.arquivo.anos[i]}`);
    expect(t).toContain("Ministério da Previdência Social");
    expect(t).toMatch(/Dados capturados em \d{2}\/\d{2}\/\d{4}/);
    expect(t).toContain("órgão pagador");
    expect(t).toContain("Benefícios, não pessoas");
  });

  it("só o aperitivo: sem série, sem comparação, sem tipos detalhados, sem tabela e sem arquivo para baixar", async () => {
    const html = await aperitivo(SP);
    expect(html).not.toContain("<table");
    expect(html).not.toContain("pv-svg");
    expect(html).not.toMatch(/\.csv/);
    expect(html).not.toContain("pv-barra");
    const t = textoDe(html);
    expect(t).not.toContain("No estado,");
    expect(t).not.toMatch(/º entre os/);
    // o convite lista, seção por seção, o que a conta acrescenta, e leva ao login com a volta para o município
    expect(html).toContain("data-convite-aperitivo");
    expect(html).toContain(encodeURIComponent(`/contas-publicas/previdencia?ibge=${SP}`));
    expect(t).toContain(`de dezembro de ${gold.anual.anos[0]} a dezembro de ${gold.anual.anos.at(-1)}`);
    expect(t).toContain(`ano a ano de ${gold.rgps.anos[0]} a ${gold.rgps.anos.at(-1)}`); // a série do Regime Geral, dimensionada pela gold
  });

  it("sem município: a busca e o Brasil do mesmo universo; código desconhecido avisa e não chuta", async () => {
    const t = textoDe(await aperitivo());
    const br = gold.anual.brasil[String(gold.anual.anos.at(-1))];
    expect(t).toContain(`${fmt(br.q[0])} benefícios`);
    expect(textoDe(await aperitivo("9999999"))).toContain("Nenhum município da base do INSS tem o código IBGE 9999999");
    expect(textoDe(await aperitivo("abc"))).toContain("sete dígitos");
  });

  it("o caminho interno nunca aparece em link e a página não escreve número à mão", () => {
    const fonte = ler("src/app/aperitivo/previdencia/page.tsx");
    expect(fonte).not.toMatch(/href=\{?["'`]\/aperitivo/);
    expect(semComentarios(fonte)).not.toMatch(/\b(19|20)\d{2}\b/);
  });
});

describe("previdência: o convite do aperitivo não promete série que o município não tem", () => {
  it("município que só aparece na base em 2025 não ganha a série desde 2019; município antigo ganha", async () => {
    const { comConta } = await import("@/lib/previdencia/convite");
    const { consultarMunicipio, goldPrevidencia } = await import("@/lib/previdencia/dados");
    const g = goldPrevidencia();
    const novo = consultarMunicipio("5101837"); // Boa Esperança do Norte (MT), instalado em 2025
    expect(novo.estado).toBe("ok");
    if (novo.estado !== "ok") return;
    const anosComDado = novo.arquivo.anos.filter((_, i) => novo.m.q[i] != null);
    const primeiro = comConta(g, novo.uf, { m: novo.m, anos: novo.arquivo.anos })[0];
    expect(primeiro).toContain(`dezembro de ${anosComDado[0]}`);
    expect(primeiro).not.toContain(`dezembro de ${g.anual.anos[0]} a`);
    const antigo = consultarMunicipio("3550308");
    expect(antigo.estado).toBe("ok");
    if (antigo.estado !== "ok") return;
    expect(comConta(g, antigo.uf, { m: antigo.m, anos: antigo.arquivo.anos })[0]).toContain(`de dezembro de ${g.anual.anos[0]} a dezembro de`);
  });
});

describe("previdência: painel completo (com sessão)", () => {
  it("abertura: os quatro números com período e fonte, lidos da gold", async () => {
    const t = textoDe(await painel());
    const tipos = Object.fromEntries(gold.brasil_mes.tipos.map((x) => [x.id, x]));
    const k = gold.rgps.anos.length - 1;
    expect(t).toContain(fmt(tipos.total.q / 1e6, 2));
    expect(t).toContain(`R$ ${fmt(tipos.rgps.medio!, 2)}`);
    expect(t).toContain(`${fmt(-gold.rgps.pct_pib.resultado[k], 2)}% do PIB`);
    expect(t).toContain("BEPS, tabela 15");
    expect(t).toContain("RTN");
  });

  it("todas as seções por pergunta, o método recolhido e os cinco arquivos", async () => {
    const html = await painel();
    for (const id of ["municipio", "tipos", "anuario", "resultado", "estados", "atendimento", "evolucao", "metodo"]) expect(html, id).toContain(`id="${id}"`);
    for (const a of ["beneficios-por-municipio.csv", "beneficios-por-estado.csv", "beneficios-brasil-mensal.csv", "resultado-rgps.csv", "anuario-inss.csv"]) {
      expect(html).toContain(`/contas-publicas/previdencia/${a}`);
      expect(existsSync(join(raiz, "src/app/contas-publicas/previdencia", a, "route.ts")), a).toBe(true);
    }
    // os 27 estados na tabela, e nenhum selo "com conta" no painel completo
    for (const u of gold.ufs_mes.ufs) expect(textoDe(html)).toContain(u.nome);
    expect(html).not.toContain("com conta</span>");
  });

  it("com o município: comparação com o estado e o Brasil, posição na UF e série desde o primeiro dezembro", async () => {
    const t = textoDe(await painel(SP));
    const est = gold.anual.ufs.SP[String(gold.anual.anos.at(-1))];
    expect(t).toContain(`No estado, R$ ${fmt(est.v[0] / est.q[0], 2)}`);
    expect(t).toMatch(/1º entre os [\d.]+ municípios de São Paulo/);
    expect(t).toContain("não separado no arquivo");
  });

  it("ausência não vira zero: anos sem divisão urbana e rural aparecem como sem dado", async () => {
    const html = await painel();
    const i0 = gold.rgps.anos.indexOf(gold.rgps.inicio_divisao_urbana_rural);
    expect(i0).toBeGreaterThan(0);
    expect(gold.rgps.resultado_urbano.slice(0, i0).every((x) => x === null)).toBe(true);
    expect(textoDe(html)).toContain("Sem dado");
  });
});

describe("previdência: o ano inteiro e o atendimento, pelo Anuário (AEPS)", () => {
  const a = gold.aeps;
  const esp = Object.fromEntries(a.especies.map((e) => [e.id, e]));
  const k = a.anos.length - 1;

  it("seção do ano: valor emitido, concessões e a divisão Regime Geral, assistenciais e encargos da União, com os três anos", async () => {
    const html = await painel();
    expect(html).toContain('id="anuario"');
    const t = textoDe(html);
    expect(t).toContain("Quanto o INSS paga e concede em um ano?");
    expect(t).toContain(`R$ ${fmt(esp.total.valor_ano[k]! / 1e6, 1)} bilhões`);
    expect(t).toContain(`${fmt(esp.total.concedidos[k]! / 1e6, 2)} milhões`);
    for (const ano of a.anos) expect(t).toContain(String(ano));
    for (const nome of ["Regime Geral (RGPS)", "Assistenciais", "Encargos previdenciários da União (EPU)"]) expect(t).toContain(nome);
    // a tabela por grupo traz o valor do ano em R$ bilhões de cada grupo
    expect(t).toContain(fmt(esp.rgps.valor_ano[0]! / 1e6, 1));
    expect(t).toContain(fmt(esp.assistenciais.valor_ano[k]! / 1e6, 1));
    // as concessões dos 27 estados somam o Brasil
    expect(a.concessoes_uf.ufs.reduce((s, u) => s + u.v[k]!, 0)).toBe(esp.total.concedidos[k]);
    expect(t).toContain("Anuário Estatístico da Previdência Social");
    expect(t).toMatch(/tabelas atualizadas no portal em \d{2}\/\d{2}\/\d{4}, capturadas em \d{2}\/\d{2}\/\d{4}/);
  });

  it("traço da fonte é ausência: salário família não aparece como zero nem como linha da tabela de concessões", async () => {
    expect(esp.salario_familia.concedidos.every((v) => v === null)).toBe(true);
    const t = textoDe(await painel());
    expect(t).toContain("salário família");
    expect(t).toContain("traço nos três anos");
  });

  it("seção do atendimento: total do ano (soma dos meses), mês de maior movimento e a rede por estado", async () => {
    const html = await painel();
    expect(html).toContain('id="atendimento"');
    const t = textoDe(html);
    expect(a.atendimento.total).toBe(a.atendimento.brasil.reduce((s, v) => s + v, 0));
    expect(t).toContain(`${fmt(a.atendimento.total / 1e6, 2)} milhões de atendimentos`);
    expect(t).toContain(fmt(a.rede.brasil[a.rede.colunas.indexOf("aps_fixas")]!));
    expect(t).toContain("Atendimentos, não pessoas");
    expect(t).toContain("não informa o tempo de espera");
    for (const u of a.atendimento.ufs) expect(t).toContain(fmt(u.total));
  });

  it("ordem das seções: o ano depois dos tipos, o atendimento depois dos estados", async () => {
    const html = await painel();
    const pos = (id: string) => html.indexOf(`id="${id}"`);
    expect(pos("tipos")).toBeLessThan(pos("anuario"));
    expect(pos("anuario")).toBeLessThan(pos("resultado"));
    expect(pos("estados")).toBeLessThan(pos("atendimento"));
    expect(pos("atendimento")).toBeLessThan(pos("evolucao"));
  });

  it("o Regime Geral do Anuário é o do BEPS em cada dezembro", () => {
    for (const c of a.conferencia_beps) {
      expect(c.rgps_aeps).toBe(c.rgps_beps);
      expect(c.pmv_epu_aeps).toBe(c.ble_beps);
      const i = gold.serie.meses.indexOf(`${c.ano}-12`);
      expect(gold.serie.q.rgps[i]).toBe(c.rgps_aeps);
    }
  });

  it("o aperitivo não mostra o Anuário, mas o convite diz o que o painel tem a mais, com os anos e a rede", async () => {
    const html = await aperitivo(SP);
    expect(html).not.toContain('id="anuario"');
    expect(html).not.toContain('id="atendimento"');
    const t = textoDe(html);
    expect(t).not.toContain(`${fmt(a.atendimento.total / 1e6, 2)} milhões de atendimentos`);
    expect(t).toContain(`O ano inteiro, de ${a.anos[0]} a ${a.anos[k]}, pelo Anuário Estatístico da Previdência Social`);
    expect(t).toContain(`O atendimento nas unidades do INSS mês a mês em ${a.atendimento.ano}`);
    expect(t).toContain(`${fmt(a.rede.brasil[a.rede.colunas.indexOf("aps_fixas")]!)} agências fixas`);
  });

  it("arquivo do Anuário: uma linha por célula usada, traço vazio com observação, com conta", async () => {
    const { exigeConta } = await import("@/lib/rotasPublicas");
    expect(exigeConta("/contas-publicas/previdencia/anuario-inss.csv")).toBe(true);
    expect(existsSync(join(raiz, "src/app/contas-publicas/previdencia/anuario-inss.csv/route.ts"))).toBe(true);
    const { csvAnuario } = await import("@/lib/previdencia/csv");
    const linhas = (await csvAnuario().text()).replace(/^﻿/, "").trim().split("\n");
    const n = a.anos.length;
    expect(linhas).toHaveLength(1 + 4 * a.especies.length * 3 * n + 28 * 3 * n + 28 * a.rede.colunas.length + 28 * 12);
    const tracos = linhas.filter((l) => l.includes(";traço na fonte;"));
    expect(tracos.length).toBeGreaterThan(0);
    for (const l of tracos.slice(0, 20)) expect(l.split(";")[6]).toBe("");
    expect(linhas[1]).toContain("https://www.gov.br/previdencia/");
  });
});

describe("previdência: arquivos para baixar", () => {
  it("resultado do Regime Geral: uma linha por ano, unidade e fonte em cada linha", async () => {
    const { csvResultadoRgps } = await import("@/lib/previdencia/csv");
    const txt = (await csvResultadoRgps().text()).replace(/^﻿/, "");
    const linhas = txt.trim().split("\n");
    expect(linhas).toHaveLength(gold.rgps.anos.length + 1);
    expect(linhas[1]).toContain("R$ milhões correntes");
    // ausência fica vazia: o primeiro ano não tem divisão urbana e rural
    expect(linhas[1].split(";")[2]).toBe("");
  });

  it("municípios: uma linha por município e ano, somando o Brasil de cada dezembro", async () => {
    const { csvMunicipios } = await import("@/lib/previdencia/csv");
    const txt = (await csvMunicipios().text()).replace(/^﻿/, "");
    const linhas = txt.trim().split("\n").slice(1).map((l) => l.split(";"));
    const ano = String(gold.anual.anos.at(-1));
    const doAno = linhas.filter((l) => l[0] === ano);
    expect(doAno).toHaveLength(gold.municipios.total);
    expect(doAno.reduce((s, l) => s + Number(l[5]), 0)).toBe(gold.anual.brasil[ano].q[0]);
  });
});

describe("previdência: entradas e camada aberta citam o painel", () => {
  it("a porta das Contas Públicas oferece a consulta em 'Para o seu caso' e abre com o número do INSS", async () => {
    const { portas } = await import("@/lib/perguntas/portas");
    const p = portas().find((x) => x.id === "contas-publicas")!;
    expect(p.paraOSeuCaso.map((c) => c.href)).toEqual(["/contas-publicas/previdencia"]);
    expect(p.lacunas.join(" ")).not.toMatch(/Previdência e INSS em detalhe/);
    expect(p.numeros[0].href).toBe("/contas-publicas/previdencia");
    const tipos = Object.fromEntries(gold.brasil_mes.tipos.map((x) => [x.id, x]));
    expect(p.numeros[0].valor).toBe(fmt(tipos.total.q / 1e6, 2));
  });

  it("'Para você' das Contas Públicas e a vitrine da home citam o painel", async () => {
    const { PARA_VOCE } = await import("@/lib/observatorios/paraVoce");
    expect(PARA_VOCE["/observatorios/contas-publicas"][0]).toBe("inss");
    expect(PARA_VOCE["/contas-publicas"][0]).toBe("inss");
    const { vitrines } = await import("@/lib/vitrine");
    expect(vitrines().contas.paineis[0]).toMatchObject({ href: "/contas-publicas/previdencia", titulo: "Previdência e INSS" });
  });

  it("frescor: domínio próprio, mensal, lido da gold, nas faixas das Contas Públicas", async () => {
    const limiares = JSON.parse(ler("src/lib/frescor/limiares.json"));
    expect(limiares.dominios.previdencia).toMatchObject({ cadencia: "mensal" });
    const { FRESCOR_DOS_OBSERVATORIOS, FRESCOR_DAS_COLECOES } = await import("@/lib/frescor/entradas");
    expect(FRESCOR_DOS_OBSERVATORIOS["contas-publicas"]).toContain("previdencia");
    expect(FRESCOR_DAS_COLECOES["/contas-publicas"]).toContain("previdencia");
  });

  it("nomes de exibição sem hífen nem travessão", async () => {
    const { NOME_TIPO, NOME_GRUPO_Q, NOME_GRUPO_V } = await import("@/lib/previdencia/paginas");
    for (const n of [...Object.values(NOME_TIPO), ...Object.values(NOME_GRUPO_Q), ...Object.values(NOME_GRUPO_V)]) expect(n, n).not.toMatch(/[-–—]/);
  });
});
