/* Trabalho de conteúdo r8, área T2 (Regulação e Empresas): respostas em duas camadas, linha do tempo em lista curta, termos no
 * ponto de uso e números conciliados. Cada conciliação relê o dado de OUTRO artefato publicado (CSV ou JSON em public/energia),
 * por um caminho que não repete a fórmula do código das páginas. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PaginaLimites from "@/app/setor-eletrico/regulacao/page";
import PaginaLinhaTempo from "@/app/setor-eletrico/regulacao/linha-do-tempo/page";
import PaginaConsultas from "@/app/setor-eletrico/regulacao/consultas-e-agenda/page";
import Sintese from "@/app/setor-eletrico/empresas/page";
import PaginaAtivos from "@/app/setor-eletrico/empresas/ativos/page";
import PaginaControle from "@/app/setor-eletrico/empresas/controle/page";
import PaginaDistribuidoras from "@/app/setor-eletrico/empresas/distribuidoras/page";
import PaginaFinancas from "@/app/setor-eletrico/empresas/financas/page";
import Ficha from "@/app/setor-eletrico/empresas/[entidade]/page";
import { conceito } from "@/lib/energia/conteudo/conceitos";
import * as E from "@/lib/energia/empresas";
import { num } from "@/lib/energia/formato";
import * as R from "@/lib/energia/regulacao";
import { SIGLAS } from "@/lib/energia/siglas";
import { hojeBrasilia, type GoldRegulacao } from "@/lib/energia/tipos-regulacao";
import type { EmpresasGold } from "@/lib/energia/tipos-empresas";

const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
const json = <T,>(p: string) => JSON.parse(ler(p)) as T;
const GR = json<GoldRegulacao>("public/energia/gold/regulacao.json");
const GE = json<EmpresasGold>("public/energia/gold/empresas.json");
const palavras = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
const numeros = (t: string) => (t.match(/\d[\d.,]*\d|\d/g) ?? []).length;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** CSV de ";" com campos entre aspas (RFC 4180), lido por um parser próprio: caminho independente do código das páginas. */
function csv(p: string): Record<string, string>[] {
  const t = ler(p);
  const linhas: string[][] = [];
  let campo = "";
  let linha: string[] = [];
  let aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ";") {
      linha.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      linha.push(campo);
      campo = "";
      if (linha.length > 1 || linha[0] !== "") linhas.push(linha);
      linha = [];
    } else campo += c;
  }
  if (campo !== "" || linha.length) {
    linha.push(campo);
    linhas.push(linha);
  }
  const [cab, ...resto] = linhas;
  return resto.map((l) => Object.fromEntries(cab.map((c, i) => [c, l[i] ?? ""])));
}

/* ---------------------------------------------------------------- o que Entender mostra */

const VAZIOS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

/**
 * HTML sem o que Entender não mostra: blocos data-nivel analisar e auditar, tabela recolhida, conteúdo de details fechado (o
 * resumo continua), dialog fechado e elemento hidden.
 */
/** A abertura do módulo fica atrás de "Sobre esta página" (um toque): para estes testes ela conta como texto de Entender, porque é onde os termos são definidos. */
const comAberturaAberta = (h: string) => h.replace(/<details[^>]*data-sobre-pagina="true"[^>]*>([\s\S]*?)<\/details>/g, "<div>$1</div>");

function entender(html0: string): string {
  const html = comAberturaAberta(html0);
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*?)(\/?)>/g;
  type No = { nome: string; duro: boolean; mole: boolean; fechado: boolean };
  const pilha: No[] = [];
  let out = "";
  let ultimo = 0;
  const topo = () => pilha[pilha.length - 1];
  const visivel = () => !topo() || (!topo().duro && !topo().mole);
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const [tag, fecha, nome, attrs, auto] = m;
    if (visivel()) out += html.slice(ultimo, m.index);
    const n = nome.toLowerCase();
    const vazio = VAZIOS.has(n) || auto === "/";
    if (fecha) {
      for (let i = pilha.length - 1; i >= 0; i--)
        if (pilha[i].nome === n) {
          pilha.length = i;
          break;
        }
      if (visivel()) out += tag;
    } else {
      const pai = topo();
      const duro =
        !!pai?.duro ||
        /data-nivel="(analisar|auditar)"/.test(attrs) ||
        /data-recolhivel="fechada"/.test(attrs) ||
        (n === "dialog" && !/\sopen(=|\s|$)/.test(attrs)) ||
        /\shidden(=|\s|$)/.test(attrs);
      let mole = !!pai?.mole;
      if (pai?.fechado && n === "summary") mole = false;
      else if (pai?.fechado) mole = true;
      const fechado = n === "details" && !/\sopen(=|\s|$)/.test(attrs);
      if (!vazio) pilha.push({ nome: n, duro, mole, fechado });
      if (!duro && !mole) out += tag;
    }
    ultimo = m.index + tag.length;
  }
  if (visivel()) out += html.slice(ultimo);
  return out;
}

function texto(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<svg[\s\S]*?<\/svg>/g, " ")
    .replace(/<(br|\/p|\/li|\/h[1-6]|\/div|\/dd|\/dt|\/tr|\/summary)[^>]*>/g, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}
const principal = (h: string) => h.slice(h.indexOf("<main"));
const textoEntender = (h: string) => texto(entender(principal(h)));

/** Identificadores que o leitor de Entender não consulta (BRIEF, seção 2). */
const IDENTIFICADOR = /\b[a-z][a-z0-9]*_[a-z0-9_]+\b|\bsha256\b|HTTP \d{3}|\bP0\d{2}\b|achado A\d+|\b(?:pipeline|silver|bronze|gold|vintages?)\b|qualidade\.porte|[A-Za-z0-9_-]+\.(?:json|csv|parquet|py)\b|\bundefined\b|\bNaN\b|\bhoje\b|\d{4}-\d{2}-\d{2}|\b20\d\dT\d\b/;
const TRAVESSAO = /[–—]/;

/* ---------------------------------------------------------------- páginas */

const data = (() => {
  const hoje = hojeBrasilia();
  return hoje > GR.consultas.data_referencia ? hoje : GR.consultas.data_referencia;
})();
const htmlReg = {
  p044: renderToStaticMarkup(createElement(PaginaLimites)),
  p045: renderToStaticMarkup(createElement(PaginaLinhaTempo)),
  p046: renderToStaticMarkup(createElement(PaginaConsultas)),
};
const htmlEmp = {
  sintese: renderToStaticMarkup(createElement(Sintese)),
  p036: renderToStaticMarkup(createElement(PaginaAtivos)),
  p037: renderToStaticMarkup(createElement(PaginaDistribuidoras)),
  p038: renderToStaticMarkup(createElement(PaginaFinancas)),
  p039: renderToStaticMarkup(createElement(PaginaControle)),
};
const SLUGS_FICHAS = ["ambar-amazonas", "cemig-d", "cerbranorte", "certhil", "cpfl-piratining", "emt", "uhenpal"] as const;
const htmlFicha = Object.fromEntries(SLUGS_FICHAS.map((s) => [s, renderToStaticMarkup(createElement(Ficha, { params: { entidade: s } }))])) as Record<(typeof SLUGS_FICHAS)[number], string>;
const todas: Record<string, string> = { ...htmlReg, ...htmlEmp, ...htmlFicha };

const eventos = R.filtrarLinhaTempo(GR.linha_do_tempo.eventos, R.FILTRO_LINHA_TEMPO_PADRAO).eventos;
const conferido = GR.linha_do_tempo.conferido_em;
const NACIONAL = (() => {
  const p = json<{ nacional: { ano: number; parcial: boolean; taxa_total_pct: number | null; universo?: string }[] }>("public/energia/gold/perdas.json").nacional;
  return p.find((x) => !x.parcial && x.ano === 2025 && (x.universo ?? "concessionarias") === "concessionarias")?.taxa_total_pct ?? null;
})();

/* ================================================================ (a) forma dos vereditos */

describe("vereditos novos: curtos, com poucos números, sem identificador e menores que a resposta completa", () => {
  const filtrado = (f: Partial<typeof R.FILTRO_LINHA_TEMPO_PADRAO>) => R.filtrarLinhaTempo(GR.linha_do_tempo.eventos, { ...R.FILTRO_LINHA_TEMPO_PADRAO, ...f }).eventos;
  const casos: { nome: string; veredito: string; completa: string }[] = [
    { nome: "p044", veredito: R.vereditoP044(GR), completa: R.respostaP044(GR) },
    ...R.linhasLimites(GR).map((l) => ({ nome: `p044 ${l.id}`, veredito: R.vereditoLimites(GR, l.ano), completa: R.respostaLimites(GR, l.ano) })),
    { nome: "p045", veredito: R.vereditoLinhaTempo(eventos, eventos.length, "vigencia", conferido), completa: R.respostaLinhaTempo(eventos, eventos.length) },
    { nome: "p045 por publicação", veredito: R.vereditoLinhaTempo(eventos, eventos.length, "publicacao", conferido), completa: R.respostaLinhaTempo(eventos, eventos.length, "publicacao") },
    ...["pld", "conta-de-luz", "qualidade"].map((p) => {
      const e = filtrado({ painel: p });
      return { nome: `p045 painel ${p}`, veredito: R.vereditoLinhaTempo(e, eventos.length, "vigencia", conferido), completa: R.respostaLinhaTempo(e, eventos.length) };
    }),
    { nome: "p045 registros", veredito: R.vereditoLinhaTempo(filtrado({ origem: "registro" }), eventos.length, "vigencia", conferido), completa: R.respostaLinhaTempo(filtrado({ origem: "registro" }), eventos.length) },
    ...[GR.consultas.data_referencia, "2026-10-08", "2026-11-30"].map((d) => ({ nome: `p046 ${d}`, veredito: R.vereditoConsultas(GR.consultas, d), completa: R.respostaConsultas(GR.consultas, d) })),
    { nome: "agenda", veredito: R.vereditoAgenda(GR.agenda, GR.limites_em_revisao), completa: R.respostaAgenda(GR.agenda, GR.limites_em_revisao) },
    { nome: "p036", veredito: E.vereditoCadastro(GE.cadastro), completa: E.respostaCadastro(GE.cadastro) },
    { nome: "p037", veredito: E.vereditoDistribuidoras(GE.distribuidoras, NACIONAL, 2025), completa: E.respostaDistribuidoras(GE.distribuidoras) },
    { nome: "p037 sem referência", veredito: E.vereditoDistribuidoras(GE.distribuidoras), completa: E.respostaDistribuidoras(GE.distribuidoras) },
    { nome: "p038", veredito: E.vereditoFinancas(GE.financas), completa: E.respostaFinancas(GE.financas) },
    { nome: "p039", veredito: E.vereditoControle(GE.controle), completa: E.respostaControle(GE.controle) },
    // todas as 123 fichas, com a média nacional do mesmo ano para as concessionárias de ano completo
    ...GE.distribuidoras.indice.map((d) => ({
      nome: `ficha ${d.slug}`,
      veredito: E.vereditoFicha(d, d.grupo === "concessionaria" && d.perdas?.completo ? NACIONAL : null),
      completa: E.respostaFicha(d),
    })),
  ];

  it("no máximo 50 palavras e 8 números, e mais curto que a resposta completa", () => {
    expect(casos.length).toBeGreaterThan(130);
    for (const c of casos) {
      expect(c.veredito.length, c.nome).toBeGreaterThan(0);
      expect(palavras(c.veredito), c.nome).toBeLessThanOrEqual(50);
      expect(numeros(c.veredito), c.nome).toBeLessThanOrEqual(8);
      expect(palavras(c.veredito), c.nome).toBeLessThan(palavras(c.completa));
    }
  });

  it("os vereditos dos painéis principais cabem na forma pedida (até 40 palavras, uma ou duas frases)", () => {
    for (const c of casos.filter((x) => /^(p036|p037|p038|p039|p044|p045|p046)( |$)/.test(x.nome) && !/por publicação/.test(x.nome))) {
      expect(palavras(c.veredito), c.nome).toBeLessThanOrEqual(40);
      expect((c.veredito.match(/[.!?](?=\s|$)/g) ?? []).length, c.nome).toBeLessThanOrEqual(3);
    }
  });

  it("sem identificador técnico, travessão, hífen como separador nem a palavra 'hoje'", () => {
    for (const c of casos) {
      expect(c.veredito, c.nome).not.toMatch(IDENTIFICADOR);
      expect(c.veredito, c.nome).not.toMatch(TRAVESSAO);
      expect(c.veredito, c.nome).not.toMatch(/ - /);
    }
  });

  it("todo número do veredito vem do dado: mudar o dado muda o texto", () => {
    const g2 = structuredClone(GR);
    g2.limites_pld.vigencias.find((v) => v.ano === 2026)!.pld_min = 11.11;
    expect(R.vereditoLimites(g2, 2026)).toContain("R$\u00a011,11/MWh");
    const e2 = structuredClone(GE);
    e2.controle.concentracao.grupo_proporcional!.hhi = 2600;
    e2.controle.concentracao.grupo_proporcional!.faixa = "alto";
    expect(E.vereditoControle(e2.controle)).toContain("é 2.600");
    expect(E.vereditoControle(e2.controle)).toContain("altamente concentrado");
    e2.cadastro.ativos.pct_mw_operacao_vinculado = 87.5;
    expect(E.vereditoCadastro(e2.cadastro)).toContain("87,50%");
    const d = structuredClone(GE.distribuidoras.indice.find((x) => x.slug === "cemig-d")!);
    d.qualidade!.dec = 12;
    expect(E.vereditoFicha(d, NACIONAL)).toContain("acima do limite de duração e dentro do limite de frequência");
    d.perdas!.taxa_total_pct = 20;
    // a referência é a taxa nacional das concessionárias em conjunto (perdas somadas sobre energia injetada somada), não a média simples das taxas
    expect(E.vereditoFicha(d, NACIONAL)).toContain("acima da taxa nacional das concessionárias");
  });
});

/* ================================================================ (b) segunda camada */

describe("a resposta completa original continua no HTML, atrás do veredito", () => {
  const casos: [string, string, string, string][] = [
    ["p044", htmlReg.p044, R.vereditoP044(GR), R.respostaP044(GR)],
    ["p045", htmlReg.p045, R.vereditoLinhaTempo(eventos, eventos.length, "vigencia", conferido), R.respostaLinhaTempo(eventos, eventos.length)],
    ["p046", htmlReg.p046, R.vereditoConsultas(GR.consultas, data), R.respostaConsultas(GR.consultas, data)],
    ["p036", htmlEmp.p036, E.vereditoCadastro(GE.cadastro), E.respostaCadastro(GE.cadastro)],
    ["p038", htmlEmp.p038, E.vereditoFinancas(GE.financas), E.respostaFinancas(GE.financas)],
    ["p039", htmlEmp.p039, E.vereditoControle(GE.controle), E.respostaControle(GE.controle)],
    ["p037", htmlEmp.p037, "O observatório reúne", E.respostaDistribuidoras(GE.distribuidoras)],
    ["sintese", htmlEmp.sintese, E.vereditoCadastro(GE.cadastro), E.respostaCadastro(GE.cadastro)],
    ...SLUGS_FICHAS.map((s) => {
      const d = GE.distribuidoras.indice.find((x) => x.slug === s)!;
      return [`ficha ${s}`, htmlFicha[s], `Em 2025, a ${d.sigla}`, E.respostaFicha(d)] as [string, string, string, string];
    }),
  ];

  it("o veredito está fora de Analisar e a resposta completa dentro dele, no mesmo HTML", () => {
    for (const [nome, h, veredito, completa] of casos) {
      const i = h.indexOf("data-resposta=");
      expect(i, nome).toBeGreaterThan(0);
      const bloco = h.slice(i);
      const aqui = bloco.indexOf('data-nivel="analisar"');
      // na síntese de Empresas não há seletor de profundidade: a resposta completa fica recolhida logo abaixo
      const limite = aqui > 0 ? aqui : bloco.indexOf("<details");
      expect(limite, nome).toBeGreaterThan(0);
      expect(esc(bloco.slice(0, limite)), nome).toContain(esc(veredito).slice(0, 40));
      expect(h, nome).toContain(esc(completa));
      expect(entender(h), nome).not.toContain(esc(completa));
    }
  });

  it("p046: o recálculo na data de leitura leva o atributo data-resposta-hoje e a resposta do veredito segue a mesma data", () => {
    expect(htmlReg.p046).toContain(`data-resposta-hoje="${data}"`);
    expect(entender(htmlReg.p046)).toContain(`Em ${data.split("-").reverse().join("/")}`);
  });

  it("p044 por ano: o ano da data de referência diz onde está a resposta; os outros anos trazem o veredito do ano", () => {
    expect(htmlReg.p044).toContain("data-resposta-ano=");
    expect(htmlReg.p044).not.toContain("os limites dele estão na resposta acima");
    expect(textoEntender(htmlReg.p044)).toContain("Escolha outro ano para ver os limites e o ato dele");
  });
});

/* ================================================================ (c) identificadores no Entender */

describe("nenhum identificador técnico novo no texto de Entender das páginas tocadas", () => {
  it("regulação e empresas: sem nome de campo, sha256, HTTP, código de pergunta, pipeline, data crua ISO, 'hoje' nem travessão", () => {
    for (const [nome, h] of Object.entries(todas)) {
      const t = textoEntender(h);
      const m = IDENTIFICADOR.exec(t);
      expect(m ? `${nome}: ...${t.slice(Math.max(0, m.index - 40), m.index + 60)}...` : null, nome).toBeNull();
      // citações literais (<q>) podem trazer o travessão do ato; o texto do observatório não
      const semCitacao = textoEntender(h.replace(/<q>[\s\S]*?<\/q>/g, ""));
      expect(semCitacao, nome).not.toMatch(/ [–—] /);
    }
  });

  it("o nome interno de campo 'qualidade.porte' não aparece em lugar nenhum do HTML visível das fichas e do índice", () => {
    for (const h of [htmlEmp.p037, ...Object.values(htmlFicha)]) expect(texto(principal(h))).not.toContain("qualidade.porte");
    expect(E.semNomesDeCampo(GE.distribuidoras.pares)).not.toContain("qualidade.porte");
    expect(E.semNomesDeCampo(GE.distribuidoras.pares)).toContain("mesmo porte do ranking da ANEEL");
    expect(E.semNomesDeCampo("Soma da extensão (NumEtnLinTms) dos módulos")).toBe("Soma da extensão dos módulos");
  });

  it("'declarações ao Polímero' deixa de ser escrito: a página diz composição societária declarada à ANEEL", () => {
    for (const k of ["sintese", "p039"] as const) {
      const t = textoEntender(htmlEmp[k]);
      expect(t, k).not.toContain("declarações ao Polímero");
      expect(t, k).toContain("declarações de composição societária à ANEEL");
    }
  });

  it("a página de limites, em Entender, não traz as conferências do ato (IPCA, art. 23, TEO) nem o dispositivo, que ficam em Analisar", () => {
    const t = textoEntender(htmlReg.p044);
    for (const termo of ["Aplicação literal do art. 23", "encadeado pelo IPCA", "Piso igual ao maior entre TEO", "Dispositivo", "item (ii) da parte decisória", "Trecho literal"]) expect(t, termo).not.toContain(termo);
    const cheio = texto(principal(htmlReg.p044));
    for (const termo of ["Aplicação literal do art. 23", "Dispositivo", "Trecho literal"]) expect(cheio, termo).toContain(termo);
    // o que fixou, quando saiu e desde quando vale ficam à vista, com o que cada limite limita
    expect(t).toContain("menor valor do PLD em qualquer hora");
    expect(t).toMatch(/Publicação\s+23\/12\/2025/);
  });
});

/* ================================================================ linha do tempo */

describe("P045: lista curta em Entender e lista completa em Analisar", () => {
  const h = htmlReg.p045;
  const e = entender(h);
  const atos = eventos.filter((x) => R.origemEvento(x) === "ato");
  const registros = eventos.filter((x) => R.origemEvento(x) === "registro");
  const linhasCsv = csv("public/energia/series/regulacao_linha_do_tempo.csv");

  it("um item por ato e um cartão por tipo de registro, com a quantidade", () => {
    expect((e.match(/data-resumo-evento="/g) ?? []).length).toBe(atos.length);
    // os registros do CSV publicado, agrupados por tipo de ato por um caminho próprio
    const porTipo = new Map<string, number>();
    for (const l of linhasCsv.filter((x) => x.origem === "conjunto_de_dados")) porTipo.set(l.tipo_ato, (porTipo.get(l.tipo_ato) ?? 0) + 1);
    expect(registros.length).toBe(Array.from(porTipo.values()).reduce((a, b) => a + b, 0));
    expect((e.match(/data-grupo-registros="/g) ?? []).length).toBe(porTipo.size);
    for (const [tipo, n] of Array.from(porTipo.entries())) {
      const g = R.agruparRegistros(eventos).find((x) => x.tipo === tipo)!;
      expect(g.n, tipo).toBe(n);
      expect(texto(e), tipo).toContain(`${n} ${n === 1 ? "registro" : "registros"}`);
    }
    expect(R.agruparRegistros(eventos).reduce((s, g) => s + g.n, 0)).toBe(registros.length);
  });

  it("a lista completa continua no HTML, atrás de data-nivel analisar, com os 26 eventos", () => {
    expect((h.match(/data-evento="/g) ?? []).length).toBe(eventos.length);
    expect((e.match(/data-evento="/g) ?? []).length).toBe(0);
    expect(h).toContain('id="lista-completa"');
    expect(h).toContain("Efeito declarado pelo ato");
    expect(texto(e)).not.toContain("Efeito declarado pelo ato");
    expect(texto(e)).not.toContain("Evidência: trecho literal");
  });

  it("'sem impacto estimado nesta fonte' é dito uma vez na lista curta, e nenhum cartão repete 'não estimado pelo observatório'", () => {
    expect((texto(e).match(/Sem impacto estimado nesta fonte/g) ?? []).length).toBe(1);
    expect(h).not.toContain("não estimado pelo observatório");
    for (const ev of eventos) expect(ev.impacto_estimado).toBeNull();
  });

  it("o vazio comum dos registros é dito uma vez, e os cartões dos registros não repetem os campos vazios", () => {
    const t = texto(e);
    const frase = R.textoVaziosRegistros(registros);
    expect(frase).toContain(`Nos ${registros.length} registros`);
    expect(t).toContain(frase);
    expect((t.match(/não informada pela fonte/g) ?? []).length).toBeLessThanOrEqual(1); // só o ato sem data de publicação (Portaria MME 301/2019)
    // na lista completa, o cartão do registro não traz as linhas Publicação e Efeito declarado vazias
    const cartao = h.slice(h.indexOf('data-evento="bandeiras-2024-04-01"'), h.indexOf('data-evento="arr-limites-pld-2023"'));
    expect(cartao).not.toContain("Efeito declarado pelo ato");
    expect(cartao).not.toContain(">Publicação<");
  });

  it("a lista curta mostra a primeira frase do resumo, sem identificador interno, e a completa mantém o resumo inteiro", () => {
    const ren1032 = eventos.find((x) => x.id === "ren-1032-2022")!;
    expect(ren1032.resumo).toContain("regra_ipca");
    const curto = R.resumoCurtoEvento(ren1032, (t) => t);
    expect(curto).toBe("Consolida as regras de formação do PLD e dos seus limites.");
    expect(R.semIdentificadores("A aplicação não reproduz os valores (conferências regra_ipca e art23_literal). Fim.")).toBe("A aplicação não reproduz os valores. Fim.");
    expect(R.primeiraFrase("Nos processos, a meta passa a usar o mercado medido. O resto fica.")).toBe("Nos processos, a meta passa a usar o mercado medido.");
    expect(R.primeiraFrase("Sem ponto final")).toBe("Sem ponto final");
    for (const ev of atos) {
      const c = R.resumoCurtoEvento(ev, (t) => t);
      expect(ev.resumo.startsWith(c.replace(/\.$/, "")), ev.id).toBe(true);
      expect(c.length, ev.id).toBeGreaterThan(20);
      expect(c, ev.id).not.toMatch(/[a-z]+_[a-z0-9_]+/);
    }
    expect(h).toContain(esc(ren1032.resumo));
  });

  it("a lista curta é bem menor que a lista inteira de cartões que existia", () => {
    const palavrasEntender = palavras(texto(e));
    expect(palavrasEntender).toBeLessThan(3200);
    // referência: só o texto dos 26 cartões completos já passava de 6.000 palavras
    const completos = palavras(texto(h.slice(h.indexOf('id="lista-completa"'))));
    expect(completos).toBeGreaterThan(palavrasEntender);
  });

  it("o gráfico diz quantas linhas mostra por vez (12 de 26) e o filtro por período fica em Analisar", () => {
    expect(texto(e)).toContain(`O gráfico mostra 12 das ${eventos.length} linhas por vez`);
    expect(e).not.toContain('type="date"');
    expect(h).toContain('type="date"');
  });

  it("a página diz até quando a lista foi conferida", () => {
    const t = texto(e);
    expect(t).toContain(`conferida em ${conferido.split("-").reverse().join("/")}`);
    expect(t).toContain("não inclui o que foi publicado depois disso");
  });
});

/* ================================================================ P046 */

describe("P046: situações sem consulta, siglas CP e AP, agenda em resumo e decisões sem resultado em Analisar", () => {
  const h = htmlReg.p046;
  const e = entender(h);
  it("categorias com zero não ganham caixa: são ditas numa linha", () => {
    const t = texto(e);
    expect(t).toMatch(/Sem consultas nesta data em: .*A abrir/);
    expect(t).not.toMatch(/A abrir \(0\)/);
    expect(t).not.toMatch(/Só a sessão na ata \(0\)/);
  });
  it("CP e AP são explicadas na legenda do gráfico", () => {
    expect(texto(e)).toContain("CP: consulta pública; AP: audiência pública");
  });
  it("a Agenda Regulatória tem resumo em Entender e a lista de atividades em Analisar", () => {
    expect(texto(e)).toContain(R.vereditoAgenda(GR.agenda, GR.limites_em_revisao));
    expect(h).toContain('id="agenda"');
    expect(texto(e)).not.toContain("Atividades da Agenda Regulatória");
  });
  it("as ementas das decisões de abertura sem resultado formal ficam em Analisar", () => {
    expect(h).toContain("data-decisoes-sem-resultado");
    expect(e).not.toContain("data-decisoes-sem-resultado");
  });
  it("o p046 abre com o veredito antes do recorte e dos cartões", () => {
    const iVeredito = h.indexOf('data-resposta="p046"');
    expect(iVeredito).toBeGreaterThan(0);
    expect(iVeredito).toBeLessThan(h.indexOf(">Período<"));
    expect(iVeredito).toBeLessThan(h.indexOf("Comprove este número"));
  });
});

/* ================================================================ (d) conciliações com o dado publicado */

describe("conciliação (i): consultas abertas, 8 no cartão e 7 no parágrafo (classificação 2: datas diferentes)", () => {
  const linhas = csv("public/energia/series/regulacao_consultas.csv");
  const ref = GR.consultas.data_referencia;
  const rotulo = (l: Record<string, string>) => `${l.modalidade} nº ${l.numero}/${l.ano}`;
  const dataBR = (d: string) => d.split("-").reverse().join("/");

  it("no CSV, 8 estavam abertas na data de referência e, 7 dias depois, a de prazo até 02/10/2026 saiu da contagem", () => {
    const abertasRef = linhas.filter((l) => l.situacao === "aberta" && l.data_referencia === ref);
    expect(abertasRef.length).toBe(GR.evidencias.consultas_abertas!.valor_calculo);
    const d2 = "2026-10-08";
    const aindaAbertas = abertasRef.filter((l) => l.fim >= d2);
    const fecharam = abertasRef.filter((l) => l.fim < d2);
    expect(fecharam.map(rotulo)).toEqual(["Consulta Pública nº 30/2026"]);
    expect(fecharam[0].fim).toBe("2026-10-02");

    const t = R.textoMudancaDeAbertas(GR.consultas.itens, ref, d2);
    expect(t).toContain(`Em ${dataBR(ref)} eram ${abertasRef.length} abertas; em ${dataBR(d2)}, são ${aindaAbertas.length}.`);
    expect(t).toContain(`Encerrou o prazo no intervalo: ${rotulo(fecharam[0])}, prazo até ${dataBR(fecharam[0].fim)}.`);
    expect(R.textoMudancaDeAbertas(GR.consultas.itens, ref, ref)).toBe("");
  });

  it("o cartão diz que a contagem é da data de referência e a página explica a diferença no ponto de uso", () => {
    const t = textoEntender(htmlReg.p046);
    expect(t).toContain(`Contagem em ${dataBR(ref)}, a data de referência da publicação`);
    if (data > ref) {
      const n1 = linhas.filter((l) => l.situacao === "aberta" && l.data_referencia === ref).length;
      expect(R.mudancasDeAbertas(GR.consultas.itens, ref, data).antes).toBe(n1);
      expect(t).toContain(`Em ${dataBR(ref)} eram ${n1} abertas; em ${dataBR(data)}`);
    }
  });
});

describe("conciliação (ii): RALIE e SIGA em construção (classificação 2: fonte, data e medida diferentes)", () => {
  const ralie = csv("public/energia/series/expansao_carteira_ralie.csv");
  const siga = (() => {
    const m = new Map<string, Record<string, string>>();
    for (const l of csv("public/energia/series/empresas_ativos.csv")) if (!m.has(l.nucleo_ceg)) m.set(l.nucleo_ceg, l);
    return Array.from(m.values());
  })();
  const construcao = siga.filter((u) => u.fase === "Construção" || u.fase === "Construção não iniciada");
  const idsRalie = new Set(ralie.map((x) => x.nucleo_ceg));
  const exp = json<{ estagios: { ralie: R2 } }>("public/energia/gold/expansao.json").estagios.ralie;
  type R2 = Parameters<typeof E.textoFasesSigaERalie>[1] & object;

  it("os números do texto batem com o cruzamento feito linha a linha nos dois CSV", () => {
    const emConstrucao = ralie.filter((x) => x.fase_siga === "Construção" || x.fase_siga === "Construção não iniciada").length;
    const emOperacao = ralie.filter((x) => x.fase_siga === "Operação").length;
    const ausentes = ralie.filter((x) => !x.fase_siga).length;
    const foraDoRalie = construcao.filter((u) => !idsRalie.has(u.nucleo_ceg)).length;
    expect(ralie.length).toBe(emConstrucao + emOperacao + ausentes);
    // o RALIE e o SIGA concordam sobre a fase de cada usina em comum
    expect(construcao.length - foraDoRalie).toBe(emConstrucao);

    const t = E.textoFasesSigaERalie(GE.cadastro.ativos, exp);
    const f = (n: number) => num(n, 0);
    expect(t).toContain(`as fases Construção e Construção não iniciada somam ${f(construcao.length)} usinas`);
    expect(t).toContain(`${f(ralie.length)} usinas em implantação`);
    expect(t).toContain(`Das ${f(ralie.length)}, ${f(emConstrucao)} estão nessas duas fases do SIGA, ${f(emOperacao)} já aparecem em operação e ${f(ausentes)} não aparecem no SIGA`);
    expect(t).toContain(`das ${f(construcao.length)} do SIGA, ${f(foraDoRalie)} não estão no RALIE`);
    const mwSiga = construcao.reduce((s, u) => s + Number(u.kw_outorgado || 0), 0) / 1000;
    expect(t).toContain(`${num(mwSiga, 1)} MW de potência outorgada`);
    expect(t).toContain(`${num(ralie.reduce((s, x) => s + Number(x.kw_ugs_em_implantacao || 0), 0) / 1000, 1)} MW de potência das unidades geradoras em implantação`);
  });

  it("a página de ativos mostra a conciliação no ponto de uso (tabela de fases), sem estimar nem forçar os totais", () => {
    expect(htmlEmp.p036).toContain("data-conciliacao-ralie");
    expect(texto(htmlEmp.p036)).toContain("Por isso os dois totais não coincidem: mudam a fonte, a data e a medida.");
  });
});

describe("conciliação (iii): 22.798 usinas e 220.658,9 MW contra 22.665 e 220.501,8 MW (classificação 2: a fronteira exclui parte)", () => {
  const usinas = (() => {
    const m = new Map<string, Record<string, string>>();
    for (const l of csv("public/energia/series/empresas_ativos.csv")) if (l.fase === "Operação" && !m.has(l.nucleo_ceg)) m.set(l.nucleo_ceg, l);
    return Array.from(m.values());
  })();
  const kw = (u: Record<string, string>) => Number(u.kw_fiscalizado || 0);

  it("a diferença é a soma de 123 usinas sem proprietário ou com participações fora de 100% e 10 sem potência fiscalizada", () => {
    const dentro = usinas.filter((u) => (u.estado_vinculo === "vinculado" || u.estado_vinculo === "inclui_sem_documento") && kw(u) > 0);
    const fora = usinas.filter((u) => !dentro.includes(u));
    const semParticipacao = fora.filter((u) => u.estado_vinculo === "sem_proprietario" || u.estado_vinculo === "soma_divergente");
    const semPotencia = fora.filter((u) => kw(u) === 0);
    expect(usinas.length).toBe(GE.cadastro.ativos.operacao.usinas);
    expect(dentro.length).toBe(GE.controle.fronteira.usinas);
    expect(fora.length).toBe(semParticipacao.length + semPotencia.length);
    // as usinas fora por falta de potência são todas de participação válida: a causa do resto é só a potência zero
    expect(semPotencia.every((u) => u.estado_vinculo === "vinculado" || u.estado_vinculo === "inclui_sem_documento")).toBe(true);
    expect(Math.abs(fora.reduce((s, u) => s + kw(u), 0) / 1000 - (GE.controle.fronteira.mw_fora as number))).toBeLessThan(0.1);

    const t = E.textoFronteiraNoCadastro(GE.controle.fronteira, GE.cadastro.ativos);
    expect(t).toContain(`ficam de fora ${num(fora.length, 0)} usinas e ${num(GE.controle.fronteira.mw_fora, 1)} MW`);
    expect(t).toContain(`sendo ${num(semParticipacao.length, 0)} usinas sem proprietário informado ou com participações que não somam 100% e ${num(semPotencia.length, 0)} sem potência fiscalizada para contar`);
  });

  it("a síntese e o painel de controle trazem a explicação ao lado dos dois números", () => {
    for (const k of ["sintese", "p039"] as const) {
      const t = textoEntender(htmlEmp[k]);
      expect(t, k).toContain("é menor que o total em operação do cadastro");
      expect(t, k).toContain(num(GE.controle.fronteira.usinas, 0));
      expect(t, k).toContain(num(GE.cadastro.ativos.operacao.usinas, 0));
    }
  });
});

describe("conciliação (iv): 14,7% e 14,75% (mesma medida, uma regra de casas: duas)", () => {
  it("a taxa nacional do módulo Perdas, 14,748264, aparece com duas casas no cartão, na ficha de prova e na legenda do gráfico", () => {
    // a ficha de prova do módulo Perdas guarda 14,748264: com uma casa seria 14,7 e com duas, 14,75 (a página usa duas, como o gráfico)
    const bruto = json<{ evidencias: { taxa_nacional: { valor_calculo: number; valor_exibido: string } } }>("public/energia/gold/perdas.json").evidencias.taxa_nacional;
    expect(bruto.valor_calculo.toFixed(2)).toBe("14.75");
    expect(bruto.valor_calculo.toFixed(1)).toBe("14.7");
    expect(bruto.valor_exibido).toBe("14,7%");
    expect(NACIONAL).toBe(14.75);
    for (const k of ["sintese", "p037"] as const) {
      const t = textoEntender(htmlEmp[k]);
      expect(t, k).toContain("14,75% da energia injetada");
      expect(t, k).toContain("Taxa de perdas totais na distribuição, 14,75%");
      expect(t, k).not.toMatch(/14,7%(?!\d)/);
    }
    expect(texto(htmlEmp.p037)).toContain("Brasil, 51 concessionárias com os 12 meses de 2025 e sem alerta: 14,75%");
  });

  it("a potência vinculada tem duas casas no texto, no cartão e na ficha de prova (99,91%)", () => {
    const v = Number(json<{ cadastro: { ativos: { pct_mw_operacao_vinculado: number } } }>("public/energia/gold/empresas.json").cadastro.ativos.pct_mw_operacao_vinculado);
    const dois = num(v, 2);
    for (const k of ["sintese", "p036"] as const) {
      const t = textoEntender(htmlEmp[k]);
      expect(t, k).toContain(`${dois}% da potência`);
      expect(t, k).toContain(`identificados por CNPJ, ${dois}%`);
    }
    expect(E.respostaCadastro(GE.cadastro)).toContain(`${dois}% dessa potência`);
  });
});

describe("conciliação (v): o mesmo CNPJ com nomes diferentes na cadeia de controle (classificação 2: nome do cadastro e nome declarado)", () => {
  const cadeia = json<{ nos: Record<string, [string | null, string | null, string | null]>; arestas: { pai: string[]; socio: (string | null)[]; nome: string[] } }>("public/energia/series/empresas_cadeia.json");
  const casos: [(typeof SLUGS_FICHAS)[number], string][] = [
    ["cemig-d", "06981180000116"],
    ["ambar-amazonas", "02341467000120"],
  ];
  for (const [slug, cnpj] of casos) {
    it(`${slug}: nível 1 e sócio direto são o mesmo CNPJ com nomes diferentes, e a página mostra o CNPJ e explica`, () => {
      const i = cadeia.arestas.pai.findIndex((p, k) => p === cnpj && cadeia.arestas.socio[k] !== null);
      const socio = cadeia.arestas.socio[i] as string;
      const nomeNivel = cadeia.nos[socio][0] as string;
      const nomeSocio = cadeia.arestas.nome[i];
      expect(nomeNivel).not.toBe(nomeSocio);
      const t = textoEntender(htmlFicha[slug]);
      expect(t).toContain(nomeNivel);
      expect(t).toContain(nomeSocio);
      const fmt = E.cnpjFormatado(socio);
      expect((t.match(new RegExp(fmt.replace(/[./-]/g, "\\$&"), "g")) ?? []).length).toBeGreaterThanOrEqual(2);
      expect(t).toContain("o mesmo do nível 1");
      expect(t).toContain("O mesmo CNPJ pode aparecer com nomes diferentes: o CNPJ é o que identifica a empresa.");
    });
  }
});

describe("conciliação (vi): finanças remete ao aviso de fonte indisponível, que está acima", () => {
  it("o texto diz 'acima' e o aviso vem antes da caixa que o cita", () => {
    const h = htmlEmp.p038;
    expect(h).not.toContain("bloqueio abaixo");
    expect(h).toContain("ver o aviso \u201cFonte indisponível\u201d, acima");
    expect(h.indexOf("Fonte indisponível")).toBeLessThan(h.indexOf("O que não é possível concluir"));
    // os dados vêm antes dos avisos de método: a figura principal (gráfico e tabela equivalente) abre o painel, e a tabela de todas as companhias é uma seção própria depois dele
    expect(h.indexOf("Valores do gráfico (tabela equivalente)")).toBeLessThan(h.indexOf("Fonte indisponível"));
    expect(h.indexOf("Companhias abertas do setor elétrico na CVM")).toBeGreaterThan(h.indexOf("Fonte indisponível"));
    expect(textoEntender(h)).not.toContain("Decisão de método");
    expect(h).toContain("Decisão de método");
  });
});

/* ================================================================ fichas */

describe("fichas: perda negativa, pares que mostram a própria empresa, DEC e FEC, termos", () => {
  const perdasAnual = json<{ campos: string[]; distribuidoras: Record<string, unknown[][]> }>("public/energia/series/perdas_anual.json");
  const perdasGold = json<{ distribuidoras: { cnpj: string; sigla: string; grupo: string; referencia: { ano: number | null; taxa_total_pct: number | null; alertas: string[] } | null }[] }>("public/energia/gold/perdas.json");

  it("CERTHIL: valor negativo é dito como medida da fonte, com os alertas do módulo Perdas e os anos negativos da série", () => {
    const d = GE.distribuidoras.indice.find((x) => x.slug === "certhil")!;
    const t = textoEntender(htmlFicha.certhil);
    expect(t).toContain("Valor negativo quer dizer que a medida publicada pelo SAMP é negativa. O observatório mostra o valor como a fonte o entrega, sem corrigi-lo.");
    const alertas = perdasGold.distribuidoras.find((x) => x.cnpj === d.cnpj)!.referencia!.alertas;
    expect(alertas).toContain("perda_total_negativa");
    for (const rotulo of ["perda total negativa", "energia fornecida maior que a injetada"]) expect(t).toContain(rotulo);
    // série anual lida do arquivo publicado: o ano de menor valor aparece com o valor do arquivo
    const iAno = perdasAnual.campos.indexOf("ano");
    const iTaxa = perdasAnual.campos.indexOf("taxa_total_pct");
    const linhas = perdasAnual.distribuidoras[d.cnpj];
    const menor = linhas.reduce((a, b) => ((b[iTaxa] as number) < (a[iTaxa] as number) ? b : a));
    expect(menor[iTaxa] as number).toBeLessThan(-100);
    expect(t).toContain(`${menor[iAno]} (${num(menor[iTaxa] as number, 2)}%)`);
    expect(t).toContain("Valor negativo é a medida publicada pelo SAMP; o observatório não o corrige.");
  });

  it("CERBRANORTE: as barras negativas do grupo são ditas, com os nomes que o módulo Perdas marca como negativos", () => {
    const negativos = perdasGold.distribuidoras.filter((x) => x.grupo === "permissionaria" && x.referencia?.ano === 2025 && (x.referencia.taxa_total_pct ?? 0) < 0).map((x) => x.sigla);
    expect(negativos.length).toBeGreaterThan(0);
    const t = textoEntender(htmlFicha.cerbranorte);
    expect(t).toContain("valor negativo na fonte");
    for (const s of negativos) expect(t, s).toContain(s);
  });

  it("os gráficos de pares abrem com a empresa da página entre as linhas visíveis, nas sete fichas", () => {
    for (const slug of SLUGS_FICHAS) {
      const d = GE.distribuidoras.indice.find((x) => x.slug === slug)!;
      const h = htmlFicha[slug];
      for (const p of [E.paresPerdas(d, GE.distribuidoras.indice), E.paresQualidade(d, GE.distribuidoras.indice)]) {
        if (!p) continue;
        const j = E.janelaDosPares(p.posicao, p.total, 44, 440);
        const ordem = j.crescente ? p.itens : p.itens.slice().reverse();
        const idx = ordem.findIndex((i) => i.id === slug);
        expect(idx, slug).toBeGreaterThanOrEqual(0);
        expect((idx + 1) * 44, `${slug}: linha ${idx + 1}`).toBeLessThanOrEqual(j.alturaMaxima);
        expect(h, slug).toContain(`max-height:${j.alturaMaxima}px`);
      }
      if (E.paresQualidade(d, GE.distribuidoras.indice)) {
        const pq = E.paresQualidade(d, GE.distribuidoras.indice)!;
        expect(h, slug).toContain(E.janelaDosPares(pq.posicao, pq.total, 44, 440).crescente ? "Ordem: menor primeiro" : "Ordem: maior primeiro");
      }
    }
    // os extremos: a pior (última) e a melhor (primeira) aparecem sem rolar
    const ambar = E.paresQualidade(GE.distribuidoras.indice.find((x) => x.slug === "ambar-amazonas")!, GE.distribuidoras.indice)!;
    expect(ambar.posicao).toBe(ambar.total);
    expect(E.janelaDosPares(ambar.posicao, ambar.total, 44, 440).crescente).toBe(false);
    const cpfl = E.paresQualidade(GE.distribuidoras.indice.find((x) => x.slug === "cpfl-piratining")!, GE.distribuidoras.indice)!;
    expect(cpfl.posicao).toBe(1);
    expect(E.janelaDosPares(cpfl.posicao, cpfl.total, 44, 440).crescente).toBe(true);
  });

  it("janelaDosPares: sempre mostra a linha da empresa e uma a mais, com piso de altura", () => {
    for (let total = 1; total <= 60; total++)
      for (let pos = 1; pos <= total; pos++) {
        const j = E.janelaDosPares(pos, total, 44, 440);
        const linha = j.crescente ? pos : total - pos + 1;
        expect(linha * 44).toBeLessThanOrEqual(j.alturaMaxima);
        expect(j.alturaMaxima).toBeGreaterThanOrEqual(440);
        expect(linha).toBeLessThanOrEqual(Math.ceil(total / 2));
      }
  });

  it("DEC e FEC: a leitura vem dos verbetes, com o sentido da diferença diante do limite, em cada ficha e no índice", () => {
    const dec = conceito("dec")!.emUmaFrase;
    const fec = conceito("fec")!.emUmaFrase;
    for (const h of [htmlEmp.p037, ...Object.values(htmlFicha)]) {
      const t = textoEntender(h);
      expect(t).toContain(dec);
      expect(t).toContain(fec);
      expect(t).toContain("diferença negativa quer dizer abaixo do limite, ou seja, dentro dele; diferença positiva, acima do limite");
      expect(t).toContain(`soma da ${SIGLAS.TE} (TE) e da ${SIGLAS.TUSD} (TUSD)`);
      expect(t).toContain(`${SIGLAS.REH}, REH`);
    }
  });

  it("a ficha da permissionária diz o que o termo faz na página, e a de concessionária não repete a frase", () => {
    expect(textoEntender(htmlFicha.cerbranorte)).toContain("Permissionária é a classificação que a ANEEL dá a esta distribuidora");
    expect(textoEntender(htmlFicha["cemig-d"])).not.toContain("Permissionária é a classificação");
  });

  it("ESS é sigla de encargos e nome de distribuidora: nos gráficos de pares a empresa leva o nome, e a legenda não a confunde", () => {
    const ess = GE.distribuidoras.indice.find((x) => x.sigla === "ESS")!;
    expect(ess.sigla in SIGLAS).toBe(true);
    expect(E.rotuloDistribuidora(ess)).toBe("ENERGISA SUL-SUDESTE");
    expect(E.rotuloDistribuidora({ sigla: "CEMIG-D", nome: "CEMIG DISTRIBUICAO S.A" })).toBe("CEMIG-D");
    for (const slug of SLUGS_FICHAS) expect(textoEntender(htmlFicha[slug]), slug).not.toMatch(/\bESS\b/);
    for (const i of E.paresPerdas(GE.distribuidoras.indice.find((x) => x.slug === "emt")!, GE.distribuidoras.indice)!.itens) expect(i.rotulo in SIGLAS, i.rotulo).toBe(false);
  });

  it("motivo da parada da cadeia: a ficha usa a explicação que a gold publica, sem repetir o rótulo", () => {
    const motivos = GE.controle.cobertura.motivos_parada;
    const ambigua = motivos.find((m) => m.motivo === "ambigua")!.rotulo;
    expect(textoEntender(htmlFicha["cemig-d"])).toContain(`a cadeia para ali porque: ${ambigua}`);
    const compart = motivos.find((m) => m.motivo === "compartilhado")!.rotulo;
    expect(textoEntender(htmlFicha["ambar-amazonas"])).toContain(compart);
    expect(textoEntender(htmlFicha["ambar-amazonas"])).not.toContain("controle compartilhado (mais de um sócio");
    expect(E.motivoExplicado("sem_declaracao", motivos)).toBe(motivos.find((m) => m.motivo === "sem_declaracao")!.rotulo);
    expect(E.motivoExplicado("sem_declaracao")).toBe("sem declaração na janela");
  });

  it("a legenda dos motivos fica junto da tabela de grupos, com as explicações da gold", () => {
    const h = htmlEmp.p039;
    expect(h).toContain("data-legenda-motivos");
    for (const m of GE.controle.cobertura.motivos_parada) expect(h).toContain(esc(m.rotulo));
  });

  it("unidades das demonstrações: uma só (R$ milhões) no parágrafo e no cartão", () => {
    const t = textoEntender(htmlFicha["cpfl-piratining"]);
    const c = GE.financas.companhias.find((x) => x.distribuidora_slug === "cpfl-piratining" || x.cnpj === GE.distribuidoras.indice.find((d) => d.slug === "cpfl-piratining")!.cnpj)!;
    expect(t).toContain(`receita de R$ ${num((c.valores!.receita as number) / 1e6, 1)} milhões`);
    expect(t).not.toMatch(/bilh(?:ão|ões)/);
    expect(E.reaisMilhoes(-5400000000)).toBe("−R$ 5.400,0 milhões");
    expect(E.reaisMilhoes(null)).toBe("sem dado");
  });

  it("siglas publicadas pelas fontes só aparecem quando são diferentes de verdade", () => {
    // Âmbar Amazonas: "Âmbar Amazonas (tarifas)" e "ÂMBAR AMAZONAS (SAMP)" são a mesma sigla com outra caixa
    expect(textoEntender(htmlFicha["ambar-amazonas"])).not.toContain("Siglas publicadas pelas fontes");
  });
});

/* ================================================================ hub e termos */

describe("síntese de Empresas: a resposta vem primeiro, as medidas depois, e os termos são explicados no ponto de uso", () => {
  const h = htmlEmp.sintese;
  it("as quatro respostas abrem a página; 'Quais medidas não se somam?' vem depois dos capítulos", () => {
    const iMedidas = h.indexOf('id="medidas"');
    expect(iMedidas).toBeGreaterThan(0);
    expect(h.indexOf('id="sintese-p036"')).toBeLessThan(iMedidas);
    expect(h.indexOf('id="sintese-p039"')).toBeLessThan(iMedidas);
    expect(h).toContain("Quais medidas não se somam?");
    for (const id of ["p036", "p037", "p038", "p039"]) expect(h).toContain(`data-resposta="${id}"`);
  });
  it("CNPJ, DFP e ITR entram na linha de siglas da síntese, com o nome por extenso de siglas.ts", () => {
    expect(texto(entender(principal(h)))).toContain(`CNPJ, ${SIGLAS.CNPJ}`);
    expect(h).toContain(esc(SIGLAS.ITR));
    expect(h).toContain(esc(SIGLAS.DFP));
  });
  it("o período do HHI diz de onde as declarações consideradas começam", () => {
    expect(textoEntender(htmlEmp.p039)).toContain("O período vai do primeiro trimestre de declarações considerado (3º trimestre de 2025) à data do SIGA.");
  });
  it("controle: HHI com a escala e as faixas junto do número; a fronteira é descrita; limite inferior é dito em palavras", () => {
    const t = textoEntender(htmlEmp.p039);
    expect(t).toContain(`abaixo de ${num(E.LIMIARES_HHI_CADE.moderado, 0)} pontos é não concentrado`);
    expect(t).toContain("a fronteira: as usinas em operação cujas participações somam 100%");
    expect(t).toContain("o valor real pode ser maior, não menor");
    expect(t).not.toContain("ficam no denominador");
  });
  it("controle: o gráfico dos níveis usa rótulos curtos e todos os 12 grupos ficam visíveis", () => {
    expect(E.linhasNiveis(GE.controle.concentracao).every((l) => String(l.nivel_curto).length <= 28)).toBe(true);
    expect(htmlEmp.p039).toContain(`max-height:${12 * 56}px`);
  });
  it("ativos: vínculo provado e módulos de transmissão são definidos com texto publicado; grupos da transmissão são ditos", () => {
    const t = textoEntender(htmlEmp.p036);
    expect(t).toContain("CNPJ publicado pela fonte oficial no mesmo registro do ativo. Nenhum vínculo por semelhança de nome.");
    expect(t).toContain("Cada módulo de linha é um circuito: linha de circuito duplo conta duas vezes");
    expect(t).toMatch(/Entre as 10 maiores concessionárias, \d+ do grupo AXIA ENERGIA S\.A\./);
  });
  it("finanças: o seletor de conta não mostra código contábil em Entender", () => {
    const t = textoEntender(htmlEmp.p038);
    expect(t).not.toMatch(/\(\d\.\d{2}(?:\.\d{2})?\)/);
    expect(t).not.toContain("conta 3.01");
  });
});

describe("orçamento de HTML das páginas tocadas", () => {
  it("cada página abaixo de 520 KB antes das props (meta de 600 KB com elas)", () => {
    for (const [nome, h] of Object.entries(todas)) expect(h.length, nome).toBeLessThan(520_000);
  });
});
