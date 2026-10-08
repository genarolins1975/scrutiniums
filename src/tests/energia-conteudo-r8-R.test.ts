/* Trabalho de conteúdo depois da r7, área R (Rede, Carga e Água e clima): respostas em duas camadas (veredito em palavras
 * simples sempre à vista e os números por trás só em Analisar e Auditar), termos explicados no primeiro uso, identificadores
 * técnicos fora de Entender e números que parecem divergir explicados no ponto de uso. Os vereditos são derivados dos mesmos
 * campos das respostas completas; as conferências numéricas releem os CSV publicados (outro artefato, outro código) e não
 * repetem a fórmula de src/lib/energia. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PaginaAgua from "@/app/setor-eletrico/agua-e-clima/page";
import PaginaAfluencia from "@/app/setor-eletrico/agua-e-clima/afluencia/page";
import PaginaChuva from "@/app/setor-eletrico/agua-e-clima/chuva-e-temperatura/page";
import PaginaReservatorios from "@/app/setor-eletrico/agua-e-clima/reservatorios/page";
import PaginaCarga from "@/app/setor-eletrico/carga/page";
import PaginaClima from "@/app/setor-eletrico/carga/clima-e-calendario/page";
import PaginaPerfil from "@/app/setor-eletrico/carga/perfil-horario/page";
import PaginaRede from "@/app/setor-eletrico/rede/page";
import PaginaBalanco from "@/app/setor-eletrico/rede/balanco-e-exterior/page";
import PaginaProgramado from "@/app/setor-eletrico/rede/programado/page";
import PaginaRestricoes from "@/app/setor-eletrico/rede/restricoes/page";
import * as A from "@/lib/energia/agua";
import * as C from "@/lib/energia/carga";
import * as R from "@/lib/energia/rede";
import { SIGLAS } from "@/lib/energia/siglas";
import type { AguaDetalheGold } from "@/lib/energia/tipos-agua";
import type { CargaDetalheGold } from "@/lib/energia/tipos-carga";
import type { GoldRedeDetalhe } from "@/lib/energia/tipos-rede";

const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
const copia = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const palavras = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
const numeros = (t: string) => (t.match(/\d[\d.,]*\d|\d/g) ?? []).length;
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

const GA = JSON.parse(ler("public/energia/gold/agua_detalhe.json")) as AguaDetalheGold;
const GC = JSON.parse(ler("public/energia/gold/carga_detalhe.json")) as CargaDetalheGold;
const GR = JSON.parse(ler("public/energia/gold/rede_detalhe.json")) as GoldRedeDetalhe;

function csv(nome: string): Record<string, string>[] {
  const [cab, ...linhas] = ler(`public/energia/series/${nome}`).replace(/^﻿/, "").trim().split(/\r?\n/);
  const cols = cab.split(";");
  return linhas.map((l) => Object.fromEntries(l.split(";").map((v, i) => [cols[i], v])));
}
const media = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

/**
 * Texto que o leitor vê em Entender: tira os blocos de Analisar e Auditar, as caixas das fichas de evidência (dialog, de
 * responsabilidade da ficha compartilhada), scripts, estilos e gráficos. Uma linha por bloco.
 */
function textoEntender(html: string): string {
  const VAZIOS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
  const BLOCOS = new Set(["p", "div", "li", "h1", "h2", "h3", "h4", "tr", "section", "header", "dt", "dd", "details", "summary", "button"]);
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*?)(\/?)>/g;
  let saida = "";
  let ultimo = 0;
  let ignorando = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const [tag, fecha, nome, attrs, auto] = m;
    if (!ignorando) saida += html.slice(ultimo, m.index);
    ultimo = m.index + tag.length;
    const n = nome.toLowerCase();
    if (fecha) {
      if (ignorando) ignorando--;
      else if (BLOCOS.has(n)) saida += "\n";
      continue;
    }
    if (VAZIOS.has(n) || auto) {
      if (!ignorando && n === "br") saida += "\n";
      continue;
    }
    if (ignorando) {
      ignorando++;
      continue;
    }
    if (/data-nivel="(analisar|auditar)"/.test(attrs) || ["script", "style", "svg", "dialog"].includes(n)) ignorando = 1;
  }
  saida += html.slice(ultimo);
  return saida
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/* ---------- as onze páginas, renderizadas uma vez ---------- */

const PAGINAS = {
  agua: PaginaAgua,
  afluencia: PaginaAfluencia,
  chuva: PaginaChuva,
  reservatorios: PaginaReservatorios,
  carga: PaginaCarga,
  clima: PaginaClima,
  perfil: PaginaPerfil,
  rede: PaginaRede,
  balanco: PaginaBalanco,
  programado: PaginaProgramado,
  restricoes: PaginaRestricoes,
} as const;
type Pagina = keyof typeof PAGINAS;
const html = Object.fromEntries(Object.entries(PAGINAS).map(([k, P]) => [k, renderToStaticMarkup(createElement(P as never))])) as Record<Pagina, string>;
const entender = Object.fromEntries(Object.entries(html).map(([k, h]) => [k, textoEntender(h)])) as Record<Pagina, string>;

/* ---------- dados escolhidos como as páginas escolhem por padrão ---------- */

const ENT_EAR = A.entidadesEar(GA.armazenamento);
const ENT_ENA = A.entidadesEna(GA.afluencia);
const CLIMA = GA.clima!;
const BACIA_PADRAO = CLIMA.precipitacao_bacias.find((b) => b.bacia === A.baciaPadraoChuva(GA.armazenamento.bacias, CLIMA.precipitacao_bacias))!;
const T_SIN = CLIMA.temperatura.find((t) => t.recorte === "SIN")!;
const RES = GA.reservatorios!;
const DEC_SE = RES.decomposicao_ear.find((d) => d.sm === "SE")!;
const RES_PADRAO = RES.lista.find((r) => r.id === A.reservatorioPadrao(RES.lista))!;
const JANELA_RES = { inicio: RES.inicio, fim: RES.fim, periodo_fecham_por_construcao: RES.periodo_fecham_por_construcao };
const PERIODO_REDE = { inicio: GR.cobertura.inicio, fim: GR.cobertura.fim };
const P027 = GC.p027!;

/** Todos os vereditos novos, com a resposta completa de que cada um sai (nos casos em que ela existe). */
function vereditos(): { nome: string; veredito: string; completa?: string }[] {
  const v: { nome: string; veredito: string; completa?: string }[] = [];
  // Rede
  v.push({ nome: "p028", veredito: R.vereditoCirculacao(GR.circulacao.resumo_30d), completa: R.respostaCirculacao(GR.circulacao.resumo_30d) });
  v.push({ nome: "p029-exterior", veredito: R.vereditoExterior(GR.exterior), completa: R.respostaExterior(GR.exterior) });
  v.push({ nome: "p030", veredito: R.vereditoRestricoes(GR.restricoes), completa: R.respostaRestricoes(GR.restricoes) });
  for (const par of R.PARES_PROGRAMADO) {
    for (const base of ["com", "sem"] as const) {
      v.push({ nome: `p031 ${par} ${base}`, veredito: R.vereditoProgramado(GR.programado, par, base), completa: R.respostaProgramado(GR.programado, par, base) });
    }
  }
  // Carga
  for (const sm of C.REGIOES) {
    for (const j of C.JANELAS) {
      for (const t of C.TIPOS_COMPARACAO) v.push({ nome: `p025 ${sm} ${j} ${t}`, veredito: C.vereditoNivel(GC.p025, sm, j, t), completa: C.respostaNivel(GC.p025, sm, j, t) });
    }
    v.push({ nome: `p026 ${sm}`, veredito: C.vereditoPerfil(GC.p026, sm), completa: C.respostaPerfil(GC.p026, sm) });
    v.push({ nome: `p027 sem decomposição ${sm}`, veredito: C.vereditoClima(null, P027, sm), completa: C.respostaClima(P027, sm) });
  }
  for (const pf of [...GC.p026.perfil_sin_12m, ...GC.p026.perfil_subsistemas]) {
    v.push({ nome: `p026-perfil ${pf.sm} ${pf.mes} ${pf.classe}`, veredito: C.vereditoPerfilTipico(pf), completa: C.respostaPerfilTipico(pf) });
  }
  for (const d of GC.a07.decomposicao) {
    v.push({ nome: `p027 ${d.sm} ${d.variante} ${d.comparacao}`, veredito: C.vereditoClima(d, P027, d.sm), completa: C.respostaDecomposicao(d) });
  }
  // Água e clima
  for (const e of ENT_EAR) v.push({ nome: `p017 ${e.id}`, veredito: A.vereditoArmazenamento(e), completa: A.respostaArmazenamento(e) });
  for (const e of ENT_ENA) v.push({ nome: `p018 ${e.id}`, veredito: A.vereditoAfluencia(e), completa: A.respostaAfluencia(e) });
  for (const b of CLIMA.precipitacao_bacias) {
    v.push({ nome: `p019 chuva ${b.bacia}`, veredito: A.vereditoChuva(b), completa: A.respostaChuva(b, CLIMA.base_climatologica) });
    const assoc = A.vereditoAssociacao(b);
    if (assoc) v.push({ nome: `p019 associação ${b.bacia}`, veredito: assoc, completa: A.textoAssociacao(b) ?? undefined });
  }
  for (const t of CLIMA.temperatura) v.push({ nome: `p019 temperatura ${t.recorte}`, veredito: A.vereditoTemperatura(t), completa: A.respostaTemperatura(t, CLIMA.base_climatologica) });
  for (const d of RES.decomposicao_ear) v.push({ nome: `p020 ${d.sm}`, veredito: A.vereditoDecomposicao(d), completa: A.respostaDecomposicao(d) });
  for (const r of RES.lista) v.push({ nome: `p020 balanço ${r.id}`, veredito: A.vereditoBalancoReservatorio(r, JANELA_RES), completa: A.respostaBalanco(r, JANELA_RES) });
  return v;
}

describe("vereditos novos: forma", () => {
  const lista = vereditos();

  it("cobre todos os painéis da área e não é vazio em nenhuma seleção", () => {
    expect(lista.length).toBeGreaterThan(200);
    for (const x of lista) expect(x.veredito.trim().length, x.nome).toBeGreaterThan(0);
  });

  it("no máximo 50 palavras e 8 números; nunca maior que a resposta completa de que sai", () => {
    for (const x of lista) {
      expect(palavras(x.veredito), `${x.nome}: ${x.veredito}`).toBeLessThanOrEqual(50);
      expect(numeros(x.veredito), `${x.nome}: ${x.veredito}`).toBeLessThanOrEqual(8);
      if (x.completa) expect(palavras(x.veredito), x.nome).toBeLessThanOrEqual(palavras(x.completa));
    }
  });

  it("as seleções que o leitor vê de abertura ficam em 40 palavras", () => {
    const abertura = [
      R.vereditoCirculacao(GR.circulacao.resumo_30d),
      R.vereditoExterior(GR.exterior),
      R.vereditoRestricoes(GR.restricoes),
      R.vereditoProgramado(GR.programado, "N_NE", "com"),
      C.vereditoNivel(GC.p025, "SIN", "7d", "equivalente"),
      C.vereditoPerfil(GC.p026, "SIN"),
      C.vereditoClima(GC.a07.decomposicao.find((d) => d.sm === "SIN" && d.variante === "principal" && d.comparacao === "equivalente")!, P027, "SIN"),
      A.vereditoArmazenamento(ENT_EAR.find((e) => e.id === "SIN")!),
      A.vereditoAfluencia(ENT_ENA.find((e) => e.id === "SIN")!),
      A.vereditoChuva(BACIA_PADRAO),
      A.vereditoTemperatura(T_SIN),
      A.vereditoDecomposicao(DEC_SE),
      A.vereditoBalancoReservatorio(RES_PADRAO, JANELA_RES),
    ];
    for (const t of abertura) expect(palavras(t), t).toBeLessThanOrEqual(40);
  });

  it("sem travessão, hífen como pontuação, 'hoje', 'undefined' nem 'NaN'; sigla só se estiver em siglas.ts", () => {
    for (const x of lista) {
      expect(x.veredito, x.nome).not.toMatch(/[–—]| - |\bhoje\b|undefined|NaN/);
      // numeral romano de nome de usina ("Rondon II") não é sigla
      for (const s of (x.veredito.match(/\b[A-ZÀ-Ý]{2,}\b/g) ?? []).filter((t) => !/^[IVXL]+$/.test(t))) expect(Object.keys(SIGLAS), `${x.nome}: ${s}`).toContain(s);
    }
  });

  it("nenhum veredito traz código de fluxo do ONS, nome de campo, nome de arquivo nem identificador de conjunto", () => {
    const codigos = GR.restricoes.atls.fluxos.map((f) => f.fluxo);
    for (const x of lista) {
      for (const c of codigos) expect(x.veredito, `${x.nome}: ${c}`).not.toMatch(new RegExp(`(?<![A-Za-z])${c.replace("+", "\\+")}(?![A-Za-z])`));
      expect(x.veredito, x.nome).not.toMatch(/[a-z]+_[a-z0-9_]+|\.(csv|json|parquet)\b|sha256|HTTP \d{3}|\bP0\d{2}\b|achado A\d+/);
    }
  });

  it("são derivados do dado: mudar o campo muda o veredito, e nenhum número é digitado", () => {
    const p = copia(GR.programado);
    p.distribuicao.N_NE!.desvio_abs_medio_mwmed = 777.7;
    p.distribuicao.N_NE!.programado_abs_mediano_mwmed = 4321.1;
    const t = R.vereditoProgramado(p, "N_NE", "com");
    expect(t).toContain("777,7 MWmed");
    expect(t).toContain("4.321 MWmed");
    expect(t).not.toContain("914,4");

    const e = copia(GR.exterior);
    e.resumo_12m.ARGENTINA.exportacao_mwh = 1000;
    e.resumo_12m.ARGENTINA.importacao_mwh = 3000;
    e.resumo_12m.URUGUAI.exportacao_mwh = 0;
    e.resumo_12m.URUGUAI.importacao_mwh = 0;
    expect(R.vereditoExterior(e)).toContain("importou 2.000 MWh a mais do que exportou");

    const r = copia(GR.restricoes);
    r.interrupcoes.ultimos_12_meses.registros = 1;
    expect(R.vereditoRestricoes(r)).toContain("houve 1 corte de carga");
    for (const f of r.atls.fluxos) if (f.ultimos_12_meses) f.ultimos_12_meses.horas_violacao = 0;
    expect(R.vereditoRestricoes(r)).toContain("0 dos 8 fluxos");

    const ds = copia(GC.a07.decomposicao.find((d) => d.sm === "SIN" && d.variante === "principal" && d.comparacao === "equivalente")!);
    ds.real_log100 = 10;
    ds.contribuicoes_log100 = { calendario: 1, temperatura: 1.5, sazonalidade: 0.5, nivel_tendencia: 2 };
    ds.residuo_log100 = 5;
    const c = C.vereditoClima(ds, P027, "SIN");
    expect(c).toContain("10,00 pontos acima");
    expect(c).toContain("acompanham 30% dessa diferença");
    expect(c).toContain("o modelo não reproduz 50%");
    ds.contribuicoes_log100 = { calendario: -2, temperatura: -1, sazonalidade: 0, nivel_tendencia: 2 };
    ds.residuo_log100 = 11;
    expect(C.vereditoClima(ds, P027, "SIN")).toContain("puxam no sentido oposto à diferença");
    ds.real_log100 = 0;
    expect(C.vereditoClima(ds, P027, "SIN")).toContain("diferença nula");

    const arm = copia(ENT_EAR.find((x) => x.id === "SIN")!);
    arm.ear_pct = 12.3;
    arm.variacao_30d_mwmes = 500;
    expect(A.vereditoArmazenamento(arm)).toContain("12,3%");
    expect(A.vereditoArmazenamento(arm)).toContain("subiu 500 MWmês");
    arm.sem_armazenamento = true;
    expect(A.vereditoArmazenamento(arm)).toContain("fio d'água");
  });

  it("ausência continua ausência: recorte sem dado não vira zero", () => {
    const arm = copia(ENT_EAR.find((x) => x.id === "SIN")!);
    arm.dia = null;
    expect(A.vereditoArmazenamento(arm)).toContain("nunca zero");
    const ena = copia(ENT_ENA.find((x) => x.id === "SIN")!);
    ena.pct_mlt_30d = null;
    expect(A.vereditoAfluencia(ena)).toContain("Sem ENA de 30 dias");
    const b = copia(BACIA_PADRAO);
    b.mm_30d = null;
    expect(A.vereditoChuva(b)).toContain("Sem estimativa de chuva");
    const r = copia(RES_PADRAO);
    r.balanco_calculado = false;
    expect(A.vereditoBalancoReservatorio(r, JANELA_RES)).toContain("sem balanço de 30 dias");
    const ex = copia(GR.exterior);
    for (const p of R.PAISES) ex.resumo_12m[p].horas = 0;
    expect(R.vereditoExterior(ex)).toContain("ausência de dado, não zero");
  });
});

describe("duas camadas: veredito à vista, resposta completa intacta em Analisar", () => {
  /** O veredito vem antes do bloco de Analisar do mesmo painel, e a resposta completa dentro dele. */
  function duasCamadas(pagina: Pagina, id: string, veredito: string, completa: string) {
    const h = html[pagina];
    const marca = h.indexOf(`data-resposta="${id}"`);
    expect(marca, `${pagina} ${id}: atributo de resposta`).toBeGreaterThanOrEqual(0);
    const iVeredito = h.indexOf(esc(veredito), marca);
    const iAnalisar = h.indexOf('data-nivel="analisar"', marca);
    const iCompleta = h.indexOf(esc(completa), marca);
    expect(iVeredito, `${pagina} ${id}: veredito no HTML`).toBeGreaterThan(marca);
    expect(iAnalisar, `${pagina} ${id}: bloco de Analisar`).toBeGreaterThan(iVeredito);
    expect(iCompleta, `${pagina} ${id}: resposta completa no HTML, dentro de Analisar`).toBeGreaterThan(iAnalisar);
    expect(entender[pagina], `${pagina} ${id}: veredito em Entender`).toContain(veredito);
    expect(entender[pagina], `${pagina} ${id}: a resposta completa sai de Entender`).not.toContain(completa);
  }

  const sinEar = ENT_EAR.find((e) => e.id === "SIN")!;
  const sinEna = ENT_ENA.find((e) => e.id === "SIN")!;
  const perfilPadrao = C.perfilEscolhido(GC.p026.perfil_sin_12m, GC.p026.meses_perfil[GC.p026.meses_perfil.length - 1], "util")!;
  const decSin = GC.a07.decomposicao.find((d) => d.sm === "SIN" && d.variante === "principal" && d.comparacao === "equivalente")!;

  it("Água e clima: P017, P018, P019 (chuva, temperatura e associação) e P020 (decomposição e balanço)", () => {
    duasCamadas("agua", "p017", A.vereditoArmazenamento(sinEar), A.respostaArmazenamento(sinEar));
    duasCamadas("afluencia", "p018", A.vereditoAfluencia(sinEna), A.respostaAfluencia(sinEna));
    duasCamadas("chuva", "p019", A.vereditoChuva(BACIA_PADRAO), A.respostaChuva(BACIA_PADRAO, CLIMA.base_climatologica));
    duasCamadas("chuva", "p019-temperatura", A.vereditoTemperatura(T_SIN), A.respostaTemperatura(T_SIN, CLIMA.base_climatologica));
    duasCamadas("chuva", "p019-associacao", A.vereditoAssociacao(BACIA_PADRAO)!, A.textoAssociacao(BACIA_PADRAO)!);
    duasCamadas("reservatorios", "p020", A.vereditoDecomposicao(DEC_SE), A.respostaDecomposicao(DEC_SE));
    duasCamadas("reservatorios", "p020-balanco", A.vereditoBalancoReservatorio(RES_PADRAO, JANELA_RES), A.respostaBalanco(RES_PADRAO, JANELA_RES));
  });

  it("Carga: P025, P026 (e o dia típico) e P027", () => {
    duasCamadas("carga", "p025", C.vereditoNivel(GC.p025, "SIN", "7d", "equivalente"), C.respostaNivel(GC.p025, "SIN", "7d", "equivalente"));
    duasCamadas("perfil", "p026", C.vereditoPerfil(GC.p026, "SIN"), C.respostaPerfil(GC.p026, "SIN"));
    duasCamadas("perfil", "p026-perfil", C.vereditoPerfilTipico(perfilPadrao), C.respostaPerfilTipico(perfilPadrao));
    duasCamadas("clima", "p027", C.vereditoClima(decSin, P027, "SIN"), C.respostaClima(P027, "SIN"));
    // o parágrafo numérico da decomposição continua no HTML, mas só em Analisar
    const h = html.clima;
    const i = h.indexOf('data-resposta="p027-decomposicao"');
    expect(i).toBeGreaterThan(0);
    expect(h.slice(i - 80, i + 60)).toContain('data-nivel="analisar"');
    expect(h).toContain(esc(C.respostaDecomposicao(decSin)));
    expect(entender.clima).not.toContain(C.respostaDecomposicao(decSin));
  });

  it("Rede: P028, P029 (exterior), P030 e P031", () => {
    duasCamadas("rede", "p028", R.vereditoCirculacao(GR.circulacao.resumo_30d), R.respostaCirculacao(GR.circulacao.resumo_30d));
    duasCamadas("balanco", "p029-exterior", R.vereditoExterior(GR.exterior), R.respostaExterior(GR.exterior));
    duasCamadas("restricoes", "p030", R.vereditoRestricoes(GR.restricoes), R.respostaRestricoes(GR.restricoes));
    duasCamadas("programado", "p031", R.vereditoProgramado(GR.programado, "N_NE", "com"), R.respostaProgramado(GR.programado, "N_NE", "com"));
    // o painel feito antes (P029) segue com as duas camadas
    duasCamadas("balanco", "p029", R.vereditoBalanco(GR.balanco, "SIN", PERIODO_REDE), R.respostaBalanco(GR.balanco, "SIN", PERIODO_REDE));
  });

  it("a primeira resposta de cada página tem no máximo 8 números e 50 palavras em Entender", () => {
    const primeiras: [Pagina, string][] = [
      ["agua", "p017"],
      ["afluencia", "p018"],
      ["chuva", "p019"],
      ["reservatorios", "p020"],
      ["carga", "p025"],
      ["perfil", "p026"],
      ["clima", "p027"],
      ["rede", "p028"],
      ["balanco", "p029"],
      ["programado", "p031"],
      ["restricoes", "p030"],
    ];
    for (const [pagina, id] of primeiras) {
      const h = html[pagina];
      const i = h.indexOf(`data-resposta="${id}"`);
      const t = textoEntender(h.slice(h.lastIndexOf("<", i)).slice(0, 4000));
      const primeira = t.split("\n")[0];
      expect(primeira.length, `${pagina} ${id}`).toBeGreaterThan(0);
      expect(palavras(primeira), `${pagina} ${id}: ${primeira}`).toBeLessThanOrEqual(50);
      expect(numeros(primeira), `${pagina} ${id}: ${primeira}`).toBeLessThanOrEqual(8);
    }
  });
});

describe("Entender sem identificador técnico novo", () => {
  /** A linha "Fontes:" do painel vem da proveniência (código de conjunto), de responsabilidade da ficha compartilhada. */
  const semFontes = (t: string) => t.split("\n").filter((l) => !/^Fontes: /.test(l)).join("\n");

  it("nenhuma das 11 páginas mostra nome de campo, nome de arquivo, sha256, código HTTP, P0xx, achado Axx ou jargão de pipeline", () => {
    const proibidos: [RegExp, string][] = [
      [/\b[a-z]{2,}_[a-z0-9_]+\b/, "nome de campo"],
      [/\b[A-Z]{2,}_[A-Z0-9_]+\b/, "código de conjunto"],
      [/[A-Za-z0-9_<>-]+\.(csv|json|parquet|xlsx|zip|pdf)\b/i, "nome de arquivo"],
      [/sha256/i, "sha256"],
      [/\bHTTP \d{3}\b/, "código HTTP"],
      [/\bP0\d{2}\b/, "código de pergunta"],
      [/\bachado A\d{2}\b/i, "achado Axx"],
      [/\b(pipeline|silver|bronze|vintages?)\b/i, "jargão de pipeline"],
      [/\bhoje\b/i, "hoje"],
      [/[–—]/, "travessão"],
      [/undefined|NaN/, "valor de reserva"],
      [/\b\d{4}-\d{2}-\d{2}\b/, "data ISO crua"],
    ];
    for (const pagina of Object.keys(PAGINAS) as Pagina[]) {
      const t = semFontes(entender[pagina]);
      for (const [re, nome] of proibidos) {
        const m = re.exec(t);
        expect(m, `${pagina}: ${nome} (${m?.[0]}) em "${m ? t.slice(Math.max(0, m.index - 60), m.index + 80).replace(/\n/g, " ") : ""}"`).toBeNull();
      }
    }
  });

  it("MMGD e perfil horário: os campos da fonte e as classes de geração saíram de Entender e ficaram em Analisar", () => {
    const t = entender.perfil;
    expect(t).not.toMatch(/val_carga|tipo I|IIA|IIB|IIC/);
    for (const [campo, texto] of [
      ["val_cargammgd", "MMGD"],
      ["val_cargaglobalsmmgd", "Carga global líquida de MMGD"],
      ["val_cargaglobal", "Carga global"],
    ]) {
      expect(t, texto).toContain(texto);
      expect(html.perfil, campo).toContain(`(campo ${campo})`);
    }
    expect(html.perfil).toContain("Classes da fonte: geração tipo I, IIA, IIB, IIC e intercâmbios");
  });

  it("separaCampoDaSerie e semTiposDeGeracao só tiram o que é código ou classe, e o resto do texto fica", () => {
    expect(C.separaCampoDaSerie("MMGD (val_cargammgd)")).toEqual({ nome: "MMGD", campo: "val_cargammgd" });
    expect(C.separaCampoDaSerie("Carga global")).toEqual({ nome: "Carga global", campo: null });
    const x = C.semTiposDeGeracao("Parcela supervisionada pelo ONS (geração tipo I, IIA) mais a medida pela CCEE (geração tipo III).");
    expect(x.texto).toBe("Parcela supervisionada pelo ONS mais a medida pela CCEE.");
    expect(x.tipos).toEqual(["geração tipo I, IIA", "geração tipo III"]);
  });

  it("Reservatórios: o código da usina sai da nota do cartão, e hm³, defluência e a jusante ganham explicação no primeiro uso", () => {
    expect(A.entidadeLegivel("reservatório SERRA DA MESA (TOSMES)")).toBe("reservatório Serra da Mesa");
    expect(A.entidadeLegivel("bacia PARANAIBA")).toBe("bacia Paranaíba");
    const t = entender.reservatorios;
    // o cartão do resíduo nomeia o reservatório sem o código da usina (a coluna de identificador da tabela segue como chave de busca)
    expect(t).not.toContain("(TOSMES)");
    expect(t).toContain("reservatório Serra da Mesa: variação observada menos afluência mais defluência");
    expect(t).toMatch(/hm³ \(milhões de metros cúbicos\)/);
    expect(t).toMatch(/defluência, pelas turbinas, pelos vertedouros e por outras estruturas/);
    expect(t).toContain("rio abaixo");
    // a unidade é explicada no texto de abertura, antes do primeiro uso nos vereditos
    expect(t.indexOf("hm³ (milhões de metros cúbicos)")).toBeLessThan(t.indexOf("saiu mais água do que entrou"));
  });

  it("Mapa de bacias: o nome do arquivo da fonte vai para Analisar", () => {
    const h = renderToStaticMarkup(createElement(PaginaChuva as never));
    expect(textoEntender(h)).not.toContain("Bacias_Hidrograficas_SIN");
  });
});

describe("termos explicados no ponto de uso", () => {
  it("Restrições: ATLS por extenso, nomes legíveis dos fluxos e a sigla do ONS só como sigla", () => {
    const t = entender.restricoes;
    expect(t).toContain("Atendimento aos Limites Sistêmicos");
    expect(t).toContain("energia não suprida, isto é, a que deixou de ser entregue");
    const rsul = GR.restricoes.atls.fluxos.find((f) => f.fluxo === "RSUL")!;
    expect(rsul.definicao).toBeTruthy();
    expect(R.nomeFluxo(rsul)).toBe(rsul.definicao);
    expect(t).toContain(rsul.definicao!);
    const sem = GR.restricoes.atls.fluxos.find((f) => !f.definicao && f.ativo)!;
    expect(R.nomeFluxo(sem)).toBe(sem.fluxo);
    // a linha da tabela traz o nome, a sigla do ONS e a definição, nessa ordem
    const l = R.linhasAtls([rsul])[0];
    expect(l.nome).toBe(rsul.definicao);
    expect(l.fluxo).toBe("RSUL");
    expect(R.COLUNAS_ATLS.slice(0, 3).map((c) => c.rotulo)).toEqual(["Fluxo", "Sigla do ONS", "Definição conferida"]);
  });

  it("Programado: o veredito vem antes do bloco de método, que passou para Analisar; PDO e conversoras saíram de Entender", () => {
    const h = html.programado;
    const iResposta = h.indexOf('data-resposta="p031"');
    const iMetodo = h.indexOf("De onde vem o valor programado");
    expect(iResposta).toBeGreaterThan(0);
    expect(iMetodo).toBeGreaterThan(iResposta);
    expect(h.slice(h.lastIndexOf("<div", iMetodo - 200), iMetodo)).toContain('data-nivel="analisar"');
    expect(h).toContain(esc(GR.programado.versao_programa.texto));
    expect(entender.programado).not.toMatch(/conversoras|elementos de fluxo controlado|45 de 47 dias/);
    expect(entender.programado).toContain("fluxo que se esperava em cada hora antes da operação");
    expect(entender.programado).toContain("no percentil 90, por exemplo, 90% das horas têm desvio absoluto menor ou igual a esse valor");
  });

  it("Balanço e exterior: perímetro, resíduo e tolerância ditos em palavras comuns no texto de abertura, e a conta tem nome", () => {
    const t = entender.balanco;
    expect(t).toContain("geração menos carga é igual ao intercâmbio da região");
    expect(t).toContain("o observatório chama esta segunda conta de perímetro");
    expect(t).toContain(`diferença maior que ${String(GR.balanco.tolerancia_mwmed).replace(".", ",")} MWmed, o resíduo`);
    // o texto próprio do painel não fala em "identidade"; só sobram a frase da gold sobre o sinal e o título da ficha
    for (const termo of ["Uma identidade", "nenhuma identidade", "contagem por identidade", "cada identidade", "Tabela equivalente: identidades"]) expect(t, termo).not.toContain(termo);
    expect(t).toContain("Horas em que cada conta fecha e horas com resíduo");
  });

  it("Balanço e exterior: o 'O que mudou' diz onde estão as horas com resíduo, sem causa, e quais anos fecham em todas as horas", () => {
    const x = GR.balanco.identidades.find((i) => i.id === "balanco.SIN")!;
    const texto = R.textoMudancaBalanco(GR.balanco);
    expect(texto).toContain(`as ${x.horas_residuo.toLocaleString("pt-BR")} horas com resíduo estão em 2026`);
    expect(texto).toContain("Em 2021, 2022, 2023, 2024 e 2025, o balanço interno fecha em todas as horas conferidas");
    expect(texto).not.toMatch(/perdas|causa/);
    expect(html.balanco).toContain(esc(texto));
    // a contagem, o ano e o maior valor saem da lista de horas com resíduo publicada, não da gold
    const horas = csv("rede_balanco_residuos.csv").filter((r) => r.sm === "SIN" && r.identidade === "balanco");
    expect(horas.length).toBe(x.horas_residuo);
    expect(new Set(horas.map((r) => r.data_hora.slice(0, 4)))).toEqual(new Set(["2026"]));
    const maior = horas.reduce((a, b) => (Math.abs(Number(b.residuo_mwmed)) > Math.abs(Number(a.residuo_mwmed)) ? b : a));
    expect(texto).toContain(`${Math.abs(Number(maior.residuo_mwmed)).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MWmed, em ${maior.data_hora.slice(8, 10)}/${maior.data_hora.slice(5, 7)}/${maior.data_hora.slice(0, 4)} às ${maior.data_hora.slice(11, 13)}h`);
  });

  it("Rede: 'energia escondida pelo saldo' definida antes dos cartões, e o lead não cita mais o 'arquivo de 2026'", () => {
    const t = entender.rede;
    expect(t).toContain("A energia escondida pelo saldo é o menor dos dois sentidos; zero quer dizer que o fluxo foi sempre no mesmo sentido");
    expect(t.indexOf("A energia escondida pelo saldo é o menor")).toBeLessThan(t.indexOf("Energia escondida pelo saldo de 30 dias, Norte"));
    expect(t).not.toContain("no arquivo de");
    expect(t).not.toContain("Quatro painéis");
  });

  it("Clima e calendário: 'log × 100' e 'origem' explicados, e a abertura responde à pergunta do painel", () => {
    const t = entender.clima;
    expect(t).toContain("o modelo trabalha com o logaritmo natural da carga");
    expect(t).toContain("se lê, aproximadamente, como pontos percentuais");
    expect(t).not.toMatch(/com a origem de/);
    const abertura = t.split("\n").find((l) => /Calendário, temperatura e estação do ano acompanham/.test(l))!;
    expect(abertura).toBeTruthy();
    // a pergunta do painel vem antes da resposta, e a resposta fala de clima e calendário, não do erro do modelo
    expect(t.indexOf("Quanto da variação da carga é compatível com clima e calendário?")).toBeLessThan(t.indexOf(abertura));
    expect(abertura).not.toMatch(/errou|cobertura|referência ingênua/);
    // o erro do modelo continua na resposta completa
    expect(html.clima).toContain(esc(C.respostaClima(P027, "SIN")));
  });
});

describe("números que parecem divergir: causa, classificação e explicação no ponto de uso", () => {
  const comparacao = csv("carga_comparacoes.csv");
  const diaria = csv("carga_diaria.csv")
    .filter((r) => r.SIN_calculado !== "")
    .map((r) => ({ d: r.data, v: Number(r.SIN_calculado) }));
  const dias = (a: string, b: string) => diaria.filter((x) => x.d >= a && x.d <= b).map((x) => x.v);

  it("Rede, saldo do exterior (classe 1, arredondamento único): o veredito, o cartão e a soma do CSV mensal publicado dão o mesmo valor", () => {
    const meses = csv("rede_exterior_mensal.csv").filter((r) => ["ARGENTINA", "URUGUAI"].includes(r.pais) && r.mes >= "2025-09" && r.mes <= "2026-08" && r.liquido_mwh !== "");
    const soma = meses.reduce((s, r) => s + Number(r.liquido_mwh), 0);
    expect(meses.length).toBe(24);
    expect(Math.abs(soma - 2_754_057)).toBeLessThan(1);
    expect(R.vereditoExterior(GR.exterior)).toContain("2.754.057 MWh");
    expect(GR.evidencias.exterior_12m!.valor_exibido).toBe("2.754.057 MWh");
  });

  it("Rede, programado: o desvio médio e a mediana do programa, relidos do arquivo horário de 2026, são os do veredito", () => {
    const linhas = csv("rede_horario_2026.csv").filter((r) => r.fluxo_N_NE !== "" && r.prog_N_NE !== "");
    const desvio = media(linhas.map((r) => Math.abs(Number(r.fluxo_N_NE) - Number(r.prog_N_NE))));
    const prog = linhas.map((r) => Math.abs(Number(r.prog_N_NE))).sort((a, b) => a - b);
    const mediana = prog.length % 2 ? prog[(prog.length - 1) / 2] : (prog[prog.length / 2 - 1] + prog[prog.length / 2]) / 2;
    const v = R.vereditoProgramado(GR.programado, "N_NE", "com");
    expect(v).toContain(`${desvio.toFixed(1).replace(".", ",")} MWmed`);
    expect(v).toContain(`${Math.round(mediana).toLocaleString("pt-BR")} MWmed`);
  });

  it("Rede, restrições: os 7 de 8 fluxos e os cortes de carga do veredito saem do ATLS mensal e do registro de cortes publicados", () => {
    const atls = csv("rede_atls.csv").filter((r) => r.periodicidade === "ME");
    const ultimo = atls.map((r) => r.mes).sort().at(-1)!;
    const ativos = new Set(atls.filter((r) => r.mes === ultimo).map((r) => r.fluxo));
    const [a, m] = ultimo.split("-").map(Number);
    const janela = Array.from({ length: 12 }, (_, k) => {
      const t = a * 12 + (m - 1) - (11 - k);
      return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
    });
    const horas = new Map<string, number>();
    for (const r of atls) if (ativos.has(r.fluxo) && janela.includes(r.mes) && r.horas_violacao !== "") horas.set(r.fluxo, (horas.get(r.fluxo) ?? 0) + Number(r.horas_violacao));
    const acima = Array.from(ativos).filter((f) => (horas.get(f) ?? 0) > 0).length;
    const cortes = csv("rede_interrupcoes_carga.csv").filter((r) => r.instante.slice(0, 10) >= "2025-09-30" && r.instante.slice(0, 10) <= "2026-09-29");
    const v = R.vereditoRestricoes(GR.restricoes);
    expect(v).toContain(`${acima} dos ${ativos.size} fluxos`);
    expect(v).toContain(`${cortes.length} cortes de carga`);
  });

  it("Carga, 11,4% e 11,45% (classe 1, mesmas casas para a mesma medida): o cartão, o veredito, a resposta e a tabela mostram 11,45%, como o CSV de comparações", () => {
    const linha = comparacao.find((r) => r.submercado === "SIN" && r.janela === "7d" && r.tipo === "equivalente")!;
    const variacao = Number(linha.variacao_pct).toFixed(2).replace(".", ",");
    expect(variacao).toBe("11,45");
    expect(C.vereditoNivel(GC.p025, "SIN", "7d", "equivalente")).toContain(`${variacao}% acima`);
    expect(C.respostaNivel(GC.p025, "SIN", "7d", "equivalente")).toContain(`+${variacao}%`);
    // o cartão (duas casas) e o outro cartão do mesmo bloco, da reprodução do diagnóstico
    expect(html.carga).toContain("11,45");
    const repro = (GC.evidencias.a07_reproducao!.valor_calculo as number).toFixed(2).replace(".", ",");
    expect(html.carga).toContain(`>${repro}<`);
    // o valor completo da ficha (valor_calculo) arredonda para a mesma casa do cartão
    expect((GC.evidencias.p025_7d_equivalente!.valor_calculo as number).toFixed(2).replace(".", ",")).toBe(variacao);
  });

  it("Carga, 'últimos 28 dias' e 'mês corrente' (classe 2, mesma janela): o CSV mostra as duas com os mesmos dias e a mesma média, e a página diz isso", () => {
    const a = comparacao.find((r) => r.submercado === "SIN" && r.janela === "28d" && r.tipo === "equivalente")!;
    const b = comparacao.find((r) => r.submercado === "SIN" && r.janela === "mes_corrente" && r.tipo === "equivalente")!;
    expect([a.inicio, a.fim, a.media_mwmed]).toEqual([b.inicio, b.fim, b.media_mwmed]);
    const frase = C.textoJanelasIguais(GC.p025.comparacoes.janelas);
    expect(frase).toContain("são a mesma janela e têm a mesma média");
    expect(frase).toContain(`${a.inicio.split("-").reverse().join("/")} a ${a.fim.split("-").reverse().join("/")}`);
    expect(html.carga).toContain(esc(frase));
    // janelas distintas não ganham a frase
    const distintas = copia(GC.p025.comparacoes.janelas);
    distintas.find((j) => j.id === "mes_corrente")!.inicio = "2000-01-01";
    expect(C.textoJanelasIguais(distintas)).toBe("");
  });

  it("Clima e calendário, +11,06% (6 dias) e +11,45% (7 dias) (classe 2, janela e método): os dois valores saem da série diária publicada e a página diz os dois motivos", () => {
    const aritmetica7 = (media(dias("2026-09-22", "2026-09-28")) / media(dias("2025-09-23", "2025-09-29")) - 1) * 100;
    expect(aritmetica7).toBeCloseTo(11.45, 1);
    const logs = (xs: number[]) => media(xs.map((x) => Math.log(x)));
    const log6 = (Math.exp(logs(dias("2026-09-22", "2026-09-27")) - logs(dias("2025-09-23", "2025-09-28"))) - 1) * 100;
    expect(log6).toBeCloseTo(11.06, 1);
    // a média simples dos mesmos 6 dias daria outro valor: por isso a página fala em janela e em método, não só em janela
    const aritmetica6 = (media(dias("2026-09-22", "2026-09-27")) / media(dias("2025-09-23", "2025-09-28")) - 1) * 100;
    expect(Math.abs(aritmetica6 - log6)).toBeGreaterThan(0.1);
    const d = GC.a07.decomposicao.find((x) => x.sm === "SIN" && x.variante === "principal" && x.comparacao === "equivalente")!;
    const frase = C.textoJanelaCurta(d, { fim: GC.a07.referencia.fim, dias_janela: GC.a07.janela_modelo.dias_janela }, GC.a07.comparacoes);
    expect(frase).toContain("calculada sobre o logaritmo da carga diária: +11,06%");
    expect(frase).toContain("A página Carga usa a média simples de 7 dias: +11,45%");
    // a causa (a temperatura do último dia ainda não publicada) está na frase anterior do mesmo parágrafo
    expect(html.clima).toContain("a temperatura da NASA POWER chega com defasagem");
    expect(html.clima).toContain(esc(frase));
    // a resposta completa diz o que a variação mede
    expect(C.respostaDecomposicao(d)).toContain("calculada sobre a média dos logaritmos de cada janela");
    // sem janela curta, sem frase
    expect(C.textoJanelaCurta(d, { fim: d.fim, dias_janela: 6 }, GC.a07.comparacoes)).toBe("");
  });

  it("Perfil horário, 83.065 e 80.189 MWmed (classe 2, dois produtos do ONS): as médias de ago/2026 saem dos dois CSV e a nota fica na página", () => {
    const global = media(csv("carga_verificada_diaria.csv").filter((r) => r.submercado === "SIN" && r.data.startsWith("2026-08")).map((r) => Number(r.carga_global_mwmed)));
    const energiaDiaria = media(dias("2026-08-01", "2026-08-31"));
    expect(Math.abs(global - 83_065)).toBeLessThan(1);
    expect(Math.abs(energiaDiaria - 80_189)).toBeLessThan(1);
    const nota = C.textoGlobalContraDiaria(GC.p026, [{ m: "2026-08", SIN: 80_189 }]);
    expect(nota).toContain("83.065 MWmed");
    expect(nota).toContain("80.189 MWmed");
    expect(nota).toContain("São produtos diferentes do ONS");
    expect(html.perfil).toContain("a Carga de Energia Diária, usada na página Carga, de 80.189 MWmed");
    expect(C.textoGlobalContraDiaria(GC.p026, [])).toBe("");
  });

  it("Perfil horário, séries por subsistema só desde set/2025 (classe 2, cobertura): a nota diz o primeiro mês de cada série, lido dos meses publicados", () => {
    const nota = C.textoInicioSeriesMmgd(GC.p026);
    expect(nota).toBe("A série mensal do SIN começa em fev/2019; a de cada subsistema publicada aqui, em set/2025.");
    const sin = csv("carga_verificada_diaria.csv").filter((r) => r.submercado === "SIN").map((r) => r.data).sort()[0];
    expect(sin.slice(0, 7)).toBe("2019-02");
    expect(html.perfil).toContain(nota);
  });

  it("Reservatórios, −3.188,7 e −3.297,8 MWmês (classe 2, janelas que terminam em dias diferentes): as duas variações saem da EAR diária do SE publicada", () => {
    const se = new Map(csv("agua_subsistemas_diario.csv").filter((r) => r.recorte === "SE").map((r) => [r.data, Number(r.ear_mwmes)]));
    expect(se.get("2026-09-28")! - se.get("2026-08-29")!).toBeCloseTo(DEC_SE.delta_ear_mwmes!, 0);
    expect(se.get("2026-09-29")! - se.get("2026-08-30")!).toBeCloseTo(ENT_EAR.find((e) => e.id === "SE")!.variacao_30d_mwmes!, 0);
    const frase = A.textoOutraJanelaDaEar(DEC_SE, ENT_EAR);
    expect(frase).toContain("A página de armazenamento mostra −3.297,8 MWmês do Sudeste/Centro-Oeste em 30 dias até 29/09/2026");
    expect(frase).toContain("Aqui a janela vai de 29/08/2026 a 28/09/2026, o último dia com EAR por reservatório, e a variação é −3.188,7 MWmês");
    expect(html.reservatorios).toContain(esc(frase));
    // se as duas janelas terminam no mesmo dia, não há o que explicar
    const mesmo = copia(ENT_EAR);
    mesmo.find((e) => e.id === "SE")!.dia = DEC_SE.fim;
    expect(A.textoOutraJanelaDaEar(DEC_SE, mesmo)).toBe("");
  });

  it("Água, 61,5% em 29/09 (Visão geral traz 61,6% em 28/09): a EAR do SIN no dia de cada página sai da EAR diária publicada", () => {
    const sin = new Map(csv("agua_subsistemas_diario.csv").filter((r) => r.recorte === "SIN").map((r) => [r.data, Number(r.ear_pct)]));
    const e = ENT_EAR.find((x) => x.id === "SIN")!;
    expect(e.dia).toBe("2026-09-29");
    expect(sin.get("2026-09-29")!).toBeCloseTo(e.ear_pct!, 1);
    expect(A.vereditoArmazenamento(e)).toContain(`Em 29/09/2026, o SIN guardava ${e.ear_pct!.toFixed(1).replace(".", ",")}%`);
  });
});

describe("textos novos de apoio", () => {
  it("vereditoCirculacao agrupa o saldo por destino, na ordem das fronteiras, e diz quando nada fica escondido", () => {
    const r = copia(GR.circulacao.resumo_30d);
    const t = R.vereditoCirculacao(r);
    expect(t).toMatch(/^Nos \d+ dias até \d{2}\/\d{2}\/\d{4}, o Sudeste\/Centro-Oeste recebeu energia do Norte, do Nordeste e do Sul; o Norte recebeu do Nordeste\./);
    for (const x of r) {
      x.contra_saldo_mwh = 0;
      x.horas_canonico = x.liquido_mwh >= 0 ? x.horas : 0;
      x.horas_inverso = x.liquido_mwh >= 0 ? 0 : x.horas;
    }
    expect(R.vereditoCirculacao(r)).toContain("Em nenhuma fronteira o saldo esconde energia que passou no sentido contrário.");
    expect(R.vereditoCirculacao([])).toBe("Sem fluxo publicado na janela de 30 dias.");
  });

  it("textoRegimesCarga lê as datas dos regimes da gold", () => {
    const t = C.textoRegimesCarga(GC.regimes);
    expect(t).toBe("o ONS passou a incluir na carga a previsão de usinas não despachadas, desde 01/03/2021; a estimativa de MMGD, declarada para 29/04/2023, observada nos dados em 01/05/2023");
    expect(C.textoRegimesCarga([])).toBe("o que o ONS inclui na carga mudou ao longo da série");
    expect(entender.carga).toContain(t);
  });

  it("os campos de busca deixam claro que o cinza é exemplo, não valor escolhido", () => {
    for (const f of ["AguaAfluencia", "AguaArmazenamento", "AguaClima", "AguaReservatorios", "CargaNivel", "CargaPerfil", "RedeBalanco", "RedeCirculacao", "RedeProgramado", "RedeRestricoes"]) {
      const fonte = ler(`src/components/energia/${f}.tsx`);
      for (const m of Array.from(fonte.matchAll(/dicaBusca=(\{[^}]*\}|"[^"]*")/g))) expect(m[1], f).toMatch(/Buscar|Nome, bacia/);
    }
  });
});
