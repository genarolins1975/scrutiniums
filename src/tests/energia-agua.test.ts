/* eslint-disable @typescript-eslint/no-explicit-any -- varredura genérica da gold e dos CSV publicados */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PaginaArmazenamento from "@/app/setor-eletrico/agua-e-clima/page";
import PaginaAfluencia from "@/app/setor-eletrico/agua-e-clima/afluencia/page";
import PaginaClima from "@/app/setor-eletrico/agua-e-clima/chuva-e-temperatura/page";
import PaginaReservatorios from "@/app/setor-eletrico/agua-e-clima/reservatorios/page";
import { AguaIndisponivel } from "@/components/energia/AguaPagina";
import {
  ANCORAS_AFLUENCIA,
  CORES_ANOMALIA,
  COLUNAS_AFLUENCIA,
  COLUNAS_ARMAZENAMENTO,
  COLUNAS_CHUVA,
  COLUNAS_RESERVATORIOS,
  PAINEIS_AGUA,
  PONTUACAO_PROIBIDA,
  baciaPadraoChuva,
  barrasBalanco,
  barrasDecomposicao,
  classificacaoChuva,
  entidadesEar,
  entidadesEna,
  itensPontosAfluencia,
  itensPontosArmazenamento,
  linhasAfluencia,
  linhasArmazenamento,
  linhasChuva,
  linhasDecomposicao,
  linhasEventos,
  linhasMultiplos,
  linhasMultiplosChuva,
  linhasMultiplosVolume,
  linhasPmo,
  linhasReservatorios,
  linhasResumo,
  linhasTemperatura,
  modeloCurto,
  nomeProprio,
  periodoValidacao,
  periodosMapa,
  recortePadrao,
  reservatorioDaParcela,
  reservatorioPadrao,
  respostaAfluencia,
  respostaArmazenamento,
  respostaBalanco,
  respostaCapacidade,
  respostaChuva,
  respostaDecomposicao,
  respostaPrevisao,
  respostaTemperatura,
  rotaPainel,
  serieDiariaTemperatura,
  serieMensalChuva,
  serieMensalEar,
  serieRegioes,
  serieReservatorio,
  serieSemanal,
  seriePrevisao,
  situacaoAtualidade,
  textoAnomaliaPct,
  textoAssociacao,
  textoFechamento,
  textoForaDosPontos,
  textoMltNaoConcluir,
  textoMudancaAfluencia,
  textoMudancaArmazenamento,
  textoPesoSubsistemas,
  textoQuebraRee,
  textoReconciliacaoEar,
  textoReeNovos,
  textoResumo,
  textoValidacao,
  textosMlt,
  valoresMapaChuva,
} from "@/lib/energia/agua";
import { problemasEvidencia, type Evidencia } from "@/lib/energia/evidencia";
import { validaCamada, type CamadaGeo } from "@/lib/energia/geo";
import { DESTINOS_NAVEGACAO } from "@/lib/energia/navegacao";
import { matrizExportacao } from "@/lib/energia/tabela";
import type { HidrologiaGold } from "@/lib/energia/tipos";
import type { AguaDetalheGold, AguaReservatorios45d } from "@/lib/energia/tipos-agua";

/**
 * Páginas de Água e clima (P017 a P020): contrato da gold agua_detalhe.json e dos
 * arquivos que a página lê sob demanda, equivalência entre gráfico, tabela e
 * exportação (as mesmas linhas, conferidas contra os CSV publicados pelo pipeline por
 * caminho independente: soma, razão de somas e releitura de outro arquivo), textos
 * derivados dos números (mudar o número muda o texto) e renderização no servidor das
 * quatro páginas com a anatomia da seção 7.2.
 */
const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
const G: AguaDetalheGold = JSON.parse(ler("public/energia/gold/agua_detalhe.json"));
const H: HidrologiaGold = JSON.parse(ler("public/energia/gold/hidrologia.json"));
const S45: AguaReservatorios45d = JSON.parse(ler("public/energia/series/agua_reservatorios_45d.json"));
const GEO: CamadaGeo = JSON.parse(ler("public/energia/series/agua_bacias_geo.json"));
const clone = <T,>(x: T): T => structuredClone(x);
const C = G.clima!;
const R = G.reservatorios!;

function csv(nome: string): Record<string, string>[] {
  const linhas = ler(`public/energia/series/${nome}`).replace(/^﻿/, "").split(/\r?\n/).filter(Boolean);
  const cab = linhas[0].split(";");
  return linhas.slice(1).map((l) => {
    const c = l.split(";");
    return Object.fromEntries(cab.map((h, i) => [h, c[i] ?? ""]));
  });
}
const n = (s: string) => (s === "" ? null : Number(s));
const menosDias = (iso: string, d: number) => new Date(Date.parse(`${iso}T00:00:00Z`) - d * 86_400_000).toISOString().slice(0, 10);

/* ---------- contrato ---------- */

describe("contrato da gold agua_detalhe.json e dos arquivos sob demanda", () => {
  it("cabeçalho, disponibilidade, datas de referência e os quatro blocos", () => {
    expect(G.dominio).toBe("energia");
    expect(G.disponivel).toBe(true);
    expect(G.gerado_em).toMatch(/Z$/);
    for (const k of ["ear", "ena", "ree", "bacias", "reservatorios", "precipitacao", "temperatura"] as const) expect(G.dias_referencia[k], k).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(G.armazenamento.subsistemas.map((s) => s.sm).sort()).toEqual(["N", "NE", "S", "SE", "SIN"]);
    expect(G.armazenamento.ree.length).toBeGreaterThanOrEqual(9);
    expect(G.armazenamento.bacias.length).toBeGreaterThanOrEqual(20);
    expect(C.precipitacao_bacias.length).toBeGreaterThan(15);
    expect(R.lista.length).toBeGreaterThan(30);
    expect(statSync(join(raiz, "public/energia/gold/agua_detalhe.json")).size).toBeLessThan(400 * 1024);
  });

  it("subsistemas trazem o último ano com a faixa da data, terminando no dia da EAR (mesma captura do resumo)", () => {
    for (const s of G.armazenamento.subsistemas) {
      const se = serieSemanal(s.semanal);
      expect(se.length, s.sm).toBe(27);
      expect(se[se.length - 1].d, s.sm).toBe(G.armazenamento.dia);
      // a série semanal tem uma casa e o resumo duas: a diferença é o arredondamento (até 0,05)
      expect(Math.abs(se[se.length - 1].v! - s.ear_pct!), s.sm).toBeLessThanOrEqual(0.0501);
      expect(Math.abs(se[se.length - 1].p10! - s.p10!), s.sm).toBeLessThanOrEqual(0.0501);
      expect(Math.abs(se[se.length - 1].p90! - s.p90!), s.sm).toBeLessThanOrEqual(0.0501);
    }
  });

  it("toda proveniência tem natureza, fonte com URL e licença, período e limitações; calculado tem fórmula", () => {
    for (const [k, p] of Object.entries(G.proveniencia)) {
      expect(["OBSERVADO", "CALCULADO", "ESTIMADO", "PREVISTO", "CENARIO"], k).toContain(p!.natureza);
      expect(p!.fonte.url_dataset || p!.fonte.url_primaria, k).toMatch(/^https?:\/\//);
      expect(p!.fonte.licenca.length, k).toBeGreaterThan(5);
      expect(p!.limitacoes.length, k).toBeGreaterThan(0);
      if (p!.natureza === "CALCULADO") expect(p!.formula, k).toBeTruthy();
    }
    expect(G.proveniencia.previsao?.natureza).toBe("PREVISTO");
    expect(G.proveniencia.precipitacao?.natureza).toBe("ESTIMADO");
  });

  it("as dez fichas 'Comprove este número' passam na verificação da interface (todo número de destaque das páginas tem a sua)", () => {
    const evs = Object.entries(G.evidencias) as [string, Evidencia][];
    expect(evs.length).toBe(10);
    expect(Object.keys(G.evidencias)).toEqual(expect.arrayContaining(["ena_arm_30d_sin", "fecham_por_construcao"]));
    for (const [k, e] of evs) expect(problemasEvidencia(e), k).toEqual([]);
  });

  it("downloads declarados existem e cabem no limite (até 5 MB)", () => {
    for (const d of G.downloads) {
      const f = join(raiz, "public", d.url);
      expect(existsSync(f), d.url).toBe(true);
      expect(statSync(f).size, d.url).toBeLessThan(5 * 1024 * 1024);
    }
    expect(G.downloads.map((d) => d.url)).toContain(R.series_45d.arquivo);
    expect(G.downloads.map((d) => d.url)).toContain("/energia/series/agua_bacias_geo.json");
  });

  it("séries de 45 dias: um item por reservatório da lista, na mesma ordem, terminando no fim da janela", () => {
    expect(S45.reservatorios.map((s) => s.id)).toEqual(R.lista.map((r) => r.id));
    expect(S45.fim).toBe(R.fim);
    for (const s of S45.reservatorios) {
      const serie = serieReservatorio(s);
      expect(serie.length, s.id).toBe(45);
      expect(serie[44].d, s.id).toBe(R.fim);
      const r = R.lista.find((x) => x.id === s.id)!;
      if (r.vol_util_pct_fim !== null) expect(serie[44].vol, s.id).toBeCloseTo(r.vol_util_pct_fim, 2);
    }
  });

  it("camada das bacias: válida, na grade da malha de UF e com as bacias que têm chuva estimada", () => {
    expect(validaCamada(GEO)).toEqual([]);
    const uf = JSON.parse(ler("public/energia/geo/uf.json"));
    expect(GEO.projecao.origem_m).toEqual(uf.projecao.origem_m);
    expect(new Set(GEO.features.map((f) => f.id))).toEqual(new Set(C.precipitacao_bacias.map((b) => b.bacia)));
    expect(GEO.fonte).toMatch(/^ONS/);
  });
});

/* ---------- P017 ---------- */

describe("P017: gráfico, tabela e exportação usam as mesmas linhas", () => {
  const ents = entidadesEar(G.armazenamento);

  it("pontos pareados e tabela equivalente: as mesmas entidades e os mesmos números em cada tipo de recorte", () => {
    for (const tipo of ["subsistema", "ree", "bacia"] as const) {
      const doTipo = ents.filter((e) => e.tipo === tipo);
      const linhas = linhasArmazenamento(doTipo);
      const itens = itensPontosArmazenamento(doTipo);
      expect(linhas.map((l) => l.id), tipo).toEqual(doTipo.map((e) => e.id));
      expect(itens.map((i) => i.id), tipo).toEqual(doTipo.filter((e) => !e.sem_armazenamento).map((e) => e.id));
      for (const i of itens) {
        const l = linhas.find((x) => x.id === i.id)!;
        expect(i.valor, i.id).toBe(l.ear_pct);
        expect(i.referencia, i.id).toBe(l.p50);
      }
      const m = matrizExportacao(COLUNAS_ARMAZENAMENTO, linhas);
      expect(m.linhas.length, tipo).toBe(linhas.length);
      const iPct = COLUNAS_ARMAZENAMENTO.findIndex((c) => c.id === "ear_pct");
      linhas.forEach((l, k) => expect(m.linhas[k][iPct], `${tipo} ${l.id}`).toBe(l.ear_pct ?? null));
    }
  });

  it("EAR de REE e bacias no dia: os números da tabela são os do CSV diário publicado (outro arquivo, uma casa)", () => {
    const dia = G.armazenamento.dia;
    const linhas = csv("agua_ear_recortes_diario.csv").filter((r) => r.data === dia);
    let conferidos = 0;
    for (const e of ents.filter((x) => x.tipo !== "subsistema")) {
      const r = linhas.find((x) => x.recorte === e.tipo && x.nome === e.nome);
      if (!r) continue;
      expect(e.ear_mwmes!, e.id).toBeCloseTo(n(r.ear_mwmes)!, 0);
      // EAR máxima zero: o percentual é vazio no CSV e nulo na gold (não se aplica, nunca 0%)
      if (e.sem_armazenamento) {
        expect(r.ear_pct, e.id).toBe("");
        expect(e.ear_pct, e.id).toBeNull();
      } else expect(e.ear_pct!, e.id).toBeCloseTo(n(r.ear_pct)!, 1);
      conferidos++;
    }
    expect(conferidos).toBeGreaterThan(25);
  });

  it("série diária em MWmês: o SIN é a soma dos quatro e é o do CSV por subsistema (captura mais recente)", () => {
    const serie = serieRegioes(G.armazenamento.serie_diaria_mwmes);
    expect(serie[serie.length - 1].d).toBe(G.armazenamento.dia);
    const porDia = new Map(csv("agua_subsistemas_diario.csv").filter((r) => r.recorte === "SIN").map((r) => [r.data, n(r.ear_mwmes)]));
    for (const p of serie.slice(-30)) {
      if (p.SIN === null) continue;
      expect(Math.abs(p.SIN - (p.SE! + p.S! + p.NE! + p.N!)), p.d).toBeLessThanOrEqual(2);
      expect(Math.abs(p.SIN - porDia.get(p.d)!), p.d).toBeLessThanOrEqual(0.5);
    }
  });

  it("série mensal: o ponto de cada mês é a EAR do último dia com dado no CSV diário (desde 2022) e o mês corrente é parcial", () => {
    const sin = csv("agua_subsistemas_diario.csv").filter((r) => r.recorte === "SIN");
    const ultimo = new Map<string, Record<string, string>>();
    for (const r of sin) ultimo.set(r.data.slice(0, 7), r);
    const mensal = serieMensalEar(G.armazenamento.serie_mensal_mwmes);
    let conferidos = 0;
    for (const p of mensal.filter((x) => x.m >= "2022-01")) {
      const r = ultimo.get(p.m);
      if (!r) continue;
      expect(Math.abs(p.SIN! - n(r.ear_mwmes)!), p.m).toBeLessThanOrEqual(0.5);
      expect(Math.abs(p.SIN_max! - n(r.ear_max_mwmes)!), p.m).toBeLessThanOrEqual(0.5);
      conferidos++;
    }
    expect(conferidos).toBeGreaterThan(40);
    expect(G.armazenamento.serie_mensal_mwmes.mes_parcial?.d).toBe(G.armazenamento.dia);
  });

  it("pequenos múltiplos: uma coluna por recorte e duas pela faixa, nos mesmos dias", () => {
    const esc = ents.filter((e) => ["SIN", "ree:SUDESTE", "bacia:GRANDE"].includes(e.id));
    const linhas = linhasMultiplos(esc);
    expect(linhas.length).toBe(27);
    for (const e of esc) {
      const s = serieSemanal(e.semanal);
      linhas.forEach((l, i) => {
        expect(l.d).toBe(s[i].d);
        expect(l[e.id]).toBe(s[i].v);
        expect(l[`${e.id}·p10`]).toBe(s[i].p10);
      });
    }
  });

  it("mudanças de capacidade: a tabela tem uma linha por evento, e os eventos são os do CSV (dia e subsistema)", () => {
    const c = G.armazenamento.capacidade;
    expect(linhasEventos(c.eventos).length).toBe(c.n_eventos);
    const chaves = new Set(csv("agua_capacidade_eventos.csv").map((r) => `${r.data}:${r.subsistema}`));
    expect(chaves.size).toBe(c.n_eventos);
    for (const e of c.eventos) expect(chaves.has(`${e.data}:${e.sm}`), e.data).toBe(true);
  });

  it("conferência com o resumo de operação: cada número com o seu dia, sem diferença calculada; mesma faixa no mesmo dia", () => {
    const l = linhasResumo(H, G.armazenamento, G.afluencia);
    expect(l.map((x) => x.id)).toEqual(["SIN", "SE", "S", "NE", "N"]);
    for (const x of l) expect(Object.keys(x).some((k) => /dif/.test(k)), String(x.id)).toBe(false);
    const sin = G.armazenamento.subsistemas.find((s) => s.sm === "SIN")!;
    const md = G.armazenamento.dia.slice(5);
    const banda = H.bandas_ear.find((b) => b.md === md);
    if (banda) {
      expect(banda.SIN_p10).toBeCloseTo(sin.p10!, 2);
      expect(banda.SIN_p50).toBeCloseTo(sin.p50!, 2);
      expect(banda.SIN_p90).toBeCloseTo(sin.p90!, 2);
    }
    expect(H.regras.ena_30d).toMatch(/soma da ENA/);
  });
});

/* ---------- P018 ---------- */

describe("P018: gráfico, tabela e exportação usam as mesmas linhas", () => {
  const ents = entidadesEna(G.afluencia);

  it("pontos pareados e tabela: mesmas entidades e números em cada tipo de recorte", () => {
    for (const tipo of ["subsistema", "ree", "bacia"] as const) {
      const doTipo = ents.filter((e) => e.tipo === tipo);
      const linhas = linhasAfluencia(doTipo);
      const itens = itensPontosAfluencia(doTipo);
      expect(itens.map((i) => i.id)).toEqual(linhas.map((l) => l.id));
      itens.forEach((it, k) => {
        expect(it.valor).toBe(linhas[k].pct_mlt_30d);
        expect(it.referencia).toBe(linhas[k].p50_30d);
      });
      expect(matrizExportacao(COLUNAS_AFLUENCIA, linhas).linhas.length).toBe(linhas.length);
    }
  });

  it("ENA de 30 dias refeita como razão de somas a partir dos CSV diários (outro caminho; uma casa)", () => {
    const fim = G.afluencia.dia_ree!;
    const ini = menosDias(fim, 29);
    const soma = new Map<string, { ena: number; mlt: number; dias: number }>();
    for (const r of csv("agua_ear_recortes_diario.csv")) {
      if (r.data < ini || r.data > fim || r.ena_bruta_mwmed === "" || r.mlt_implicita_mwmed === "") continue;
      const k = `${r.recorte}:${r.nome}`;
      const s = soma.get(k) ?? { ena: 0, mlt: 0, dias: 0 };
      s.ena += Number(r.ena_bruta_mwmed);
      s.mlt += Number(r.mlt_implicita_mwmed);
      s.dias++;
      soma.set(k, s);
    }
    let conferidos = 0;
    for (const e of ents.filter((x) => x.tipo !== "subsistema" && x.pct_mlt_30d !== null)) {
      const s = soma.get(e.id)!;
      expect(s.dias, e.id).toBe(30);
      expect(Math.abs((100 * s.ena) / s.mlt - e.pct_mlt_30d!), e.id).toBeLessThanOrEqual(0.051);
      conferidos++;
    }
    expect(conferidos).toBeGreaterThan(30);
    const sin = csv("agua_subsistemas_diario.csv").filter((r) => r.recorte === "SIN" && r.data >= menosDias(G.afluencia.dia, 29) && r.data <= G.afluencia.dia);
    expect(sin.length).toBe(30);
    const e = ents.find((x) => x.id === "SIN")!;
    const razao = (100 * sin.reduce((a, r) => a + Number(r.ena_bruta_mwmed), 0)) / sin.reduce((a, r) => a + Number(r.mlt_implicita_mwmed), 0);
    expect(Math.abs(razao - e.pct_mlt_30d!)).toBeLessThanOrEqual(0.051);
  });

  it("série semanal de 18 meses: último ponto no dia da ENA e igual à ENA de 30 dias publicada", () => {
    const s = serieRegioes(G.afluencia.serie_30d_semanal);
    const u = s[s.length - 1];
    expect(u.d).toBe(G.afluencia.dia);
    for (const sm of ["SIN", "SE", "S", "NE", "N"] as const) expect(u[sm]).toBeCloseTo(ents.find((e) => e.id === sm)!.pct_mlt_30d!, 1);
  });

  it("ENA armazenável de 30 dias do SIN: a ficha é a razão de somas refeita com as linhas dos quatro subsistemas no CSV (outro caminho)", () => {
    const e = G.evidencias.ena_arm_30d_sin!;
    const ini = e.periodo.inicio;
    const fim = e.periodo.fim;
    let ena = 0;
    let mlt = 0;
    let dias = 0;
    for (const r of csv("agua_subsistemas_diario.csv")) {
      if (r.data < ini || r.data > fim || r.recorte === "SIN") continue;
      expect(r.ena_arm_mwmed, `${r.data} ${r.recorte}`).not.toBe("");
      ena += Number(r.ena_arm_mwmed);
      mlt += Number(r.mlt_arm_implicita_mwmed);
      dias++;
    }
    expect(dias).toBe(30 * 4);
    // quatro casas no CSV em 120 parcelas: a razão fica a menos de 0,001 p.p. da ficha
    expect(Math.abs((100 * ena) / mlt - e.valor_calculo!)).toBeLessThan(0.001);
    const sin = entidadesEna(G.afluencia).find((x) => x.id === "SIN")!;
    expect(sin.pct_mlt_arm_30d).toBeCloseTo(e.valor_calculo!, 1);
  });

  it("MLT: uma linha por mês e subsistema do PMO, citando o relatório", () => {
    const l = linhasPmo(G.afluencia.mlt);
    expect(l.length).toBe(G.afluencia.mlt.pmo.comparacao.length);
    for (const x of l) expect(String(x.relatorio)).toMatch(/^RELATORIO-PMO-/);
  });
});

/* ---------- P019 ---------- */

describe("P019: mapa, tabela, histórico e exportação usam os mesmos valores", () => {
  const lista = C.precipitacao_bacias;

  it("mapa e tabela: a mesma anomalia por bacia em todos os períodos, e as classes contam todas as bacias", () => {
    for (const per of periodosMapa(lista)) {
      const v = valoresMapaChuva(lista, per);
      const linhas = linhasChuva(lista, per);
      expect(linhas.map((l) => l.id)).toEqual(Object.keys(v));
      for (const l of linhas) expect(l.anomalia, `${per} ${l.id}`).toBe(v[l.id as string]);
      const cl = classificacaoChuva(v);
      expect(cl.classes.length).toBe(CORES_ANOMALIA.length);
      expect(cl.classes.reduce((a, c) => a + c.contagem, 0) + cl.semDado).toBe(lista.length);
      expect(matrizExportacao(COLUNAS_CHUVA, linhas).linhas.length).toBe(lista.length);
    }
  });

  it("chuva mensal da gold é a do CSV mensal (outro arquivo), e a de 30 dias é a soma do CSV diário", () => {
    const mensal = new Map(csv("agua_precipitacao_bacias_mensal.csv").map((r) => [`${r.bacia}:${r.mes}`, r]));
    const diario = csv("agua_precipitacao_bacias_diario.csv");
    for (const b of lista) {
      for (const p of serieMensalChuva(b)) {
        const r = mensal.get(`${b.bacia}:${p.m}`)!;
        expect(p.mm, `${b.bacia} ${p.m}`).toBeCloseTo(n(r.precip_mm)!, 1);
        expect(p.media, `${b.bacia} ${p.m}`).toBeCloseTo(n(r.media_2001_2025_mm)!, 1);
      }
      const ini = menosDias(b.dia, 29);
      const dias = diario.filter((r) => r.bacia === b.bacia && r.data >= ini && r.data <= b.dia);
      if (b.mm_30d !== null) {
        expect(dias.length, b.bacia).toBe(30);
        expect(Math.abs(dias.reduce((a, r) => a + Number(r.precip_mm), 0) - b.mm_30d), b.bacia).toBeLessThanOrEqual(0.06);
      }
    }
  });

  it("temperatura de 30 dias do SIN é a média do CSV clima_diario.csv (outro arquivo)", () => {
    const t = C.temperatura.find((x) => x.recorte === "SIN")!;
    const dias = csv("clima_diario.csv").filter((r) => r.recorte === "SIN" && r.data >= menosDias(t.dia, 29) && r.data <= t.dia);
    expect(dias.length).toBe(30);
    expect(Math.abs(dias.reduce((a, r) => a + Number(r.temp_media_c), 0) / 30 - t.media_30d_c!)).toBeLessThanOrEqual(0.006);
    const d = serieDiariaTemperatura(t);
    expect(d[d.length - 1].d).toBe(t.dia);
    expect(linhasTemperatura(C.temperatura).map((l) => l.id)).toEqual(["SIN", "SE", "S", "NE", "N"]);
  });

  it("previsão: as séries diárias da página são as do CSV da rodada, só com dias completos", () => {
    const pv = C.previsao!;
    const linhas = csv("agua_previsao.csv").filter((r) => r.emitida_em === pv.emitida_em);
    const b = pv.bacias[0];
    const s = seriePrevisao(pv, b.bacia);
    expect(s.length).toBe(pv.n_dias);
    for (const p of s) {
      const r = linhas.find((x) => x.tipo === "precipitacao" && x.recorte === b.bacia && x.data === p.d)!;
      expect(p.mm, p.d).toBeCloseTo(n(r.precip_mm)!, 1);
      const t = linhas.find((x) => x.tipo === "temperatura" && x.recorte === "SIN" && x.data === p.d)!;
      expect(p.SIN, p.d).toBeCloseTo(n(t.temp_media_c)!, 1);
    }
  });

  it("pequenos múltiplos de bacias: mesmos meses e valores da série de cada bacia", () => {
    const esc = lista.slice(0, 3);
    const l = linhasMultiplosChuva(esc);
    for (const b of esc) serieMensalChuva(b).forEach((p, i) => expect(l[i][b.bacia]).toBe(p.mm));
  });

  it("bacia padrão é a da ficha de prova (maior EAR máxima com chuva estimada)", () => {
    const b = baciaPadraoChuva(G.armazenamento.bacias, lista);
    expect(G.evidencias.precipitacao_maior_bacia_30d?.entidade).toContain(b);
  });
});

/* ---------- P020 ---------- */

describe("P020: decomposição, balanço, tabela e séries usam as mesmas linhas", () => {
  it("barras e tabela da decomposição: mesmas parcelas, ligadas ao reservatório pelo código da usina", () => {
    for (const d of R.decomposicao_ear) {
      const b = barrasDecomposicao(d);
      const l = linhasDecomposicao(d);
      expect(l.map((x) => x.id), d.sm).toEqual(b.map((x) => x.id));
      expect(l.map((x) => x.delta), d.sm).toEqual(b.map((x) => x.delta));
      // ordenadas da maior queda à maior alta
      for (let i = 1; i < b.length; i++) expect((b[i].delta ?? 0) >= (b[i - 1].delta ?? 0), d.sm).toBe(true);
      expect(Math.abs((d.delta_ear_mwmes ?? 0) - (d.soma_reservatorios_mwmes ?? 0) - (d.residuo_mwmes ?? 0)), d.sm).toBeLessThanOrEqual(0.1);
    }
    const se = R.decomposicao_ear.find((d) => d.sm === "SE")!;
    const ligadas = barrasDecomposicao(se).map((b) => reservatorioDaParcela(R.lista, b.cod)).filter(Boolean);
    expect(ligadas.length).toBeGreaterThanOrEqual(8);
  });

  it("balanço: a tabela é a do CSV publicado e a identidade fecha com o resíduo publicado (arredondamento de 2 casas)", () => {
    const csvRes = new Map(csv("agua_reservatorios.csv").map((r) => [r.id, r]));
    const linhas = linhasReservatorios(R.lista);
    expect(linhas.length).toBe(R.lista.length);
    expect(matrizExportacao(COLUNAS_RESERVATORIOS, linhas).linhas.length).toBe(R.lista.length);
    for (const r of R.lista) {
      const c = csvRes.get(r.id)!;
      expect(r.residuo_hm3, r.id).toBe(n(c.residuo_hm3));
      expect(r.afluencia_hm3, r.id).toBe(n(c.afluencia_hm3));
      if (!r.balanco_calculado) continue;
      const b = Object.fromEntries(barrasBalanco(r).map((x) => [x.id, x.v]));
      expect(Math.abs(b.dv! - (b.afl! - b.defl!) - b.res!), r.id).toBeLessThanOrEqual(0.02);
    }
  });

  it("séries de 45 dias: volume e vazões de cada reservatório na ordem dos dias", () => {
    const s = S45.reservatorios.slice(0, 4);
    const l = linhasMultiplosVolume(s);
    expect(l.length).toBe(45);
    for (const x of s) serieReservatorio(x).forEach((p, i) => expect(l[i][x.id]).toBe(p.vol));
  });

  it("fechamento por construção: a ficha e o número da gold são a contagem refeita no CSV de reservatórios (outro arquivo)", () => {
    const linhas = csv("agua_reservatorios.csv").filter((r) => r.balanco_calculado === "1");
    const fecham = linhas.filter((r) => Number(r.serie_dias_residuo_dentro_tolerancia_pct) >= 95);
    expect(linhas.length).toBe(R.n_com_balanco);
    expect(fecham.length).toBe(R.n_fecham_por_construcao);
    const e = G.evidencias.fecham_por_construcao!;
    expect(e.valor_calculo).toBe(fecham.length);
    expect(e.denominador?.valor).toBe(linhas.length);
    expect(e.periodo).toEqual(R.periodo_fecham_por_construcao);
  });

  it("reservatório padrão é o da ficha de prova (maior volume útil com balanço)", () => {
    const id = reservatorioPadrao(R.lista);
    expect(G.evidencias.balanco_maior_reservatorio?.entidade).toContain(id);
  });
});

/* ---------- textos derivados ---------- */

describe("textos derivados dos números (mudar o número muda o texto)", () => {
  const ents = entidadesEar(G.armazenamento);
  const sin = ents.find((e) => e.id === "SIN")!;

  it("resposta do P017: dia, MWmês, percentual com uma casa, faixa, base e aviso de capacidade só quando vale", () => {
    const t = respostaArmazenamento(sin);
    expect(t).toContain(sin.dia!.split("-").reverse().join("/"));
    expect(t).toContain(`${sin.ear_pct!.toFixed(1).replace(".", ",")}%`);
    expect(t).toContain("faixa usual");
    expect(t).toContain(sin.periodo_base!.replace("-", " a "));
    const outro = clone(sin);
    outro.ear_pct = 12.34;
    outro.faixa = "abaixo";
    expect(respostaArmazenamento(outro)).toContain("12,3%");
    expect(respostaArmazenamento(outro)).toContain("abaixo da faixa usual");
    outro.capacidade_mudou_na_base = false;
    expect(respostaArmazenamento(outro)).not.toContain("compara capacidades diferentes");
    outro.faixa = null;
    outro.anos_na_base = 3;
    expect(respostaArmazenamento(outro)).toContain("3 anos na base, menos que os 5 exigidos");
    const semArm = ents.find((e) => e.sem_armazenamento)!;
    expect(respostaArmazenamento(semArm)).toContain("não se aplicam");
    expect(respostaArmazenamento(semArm)).not.toMatch(/\d% da EAR máxima/);
  });

  it("recorte padrão: SIN nos subsistemas e o de maior EAR máxima nos REE e nas bacias", () => {
    expect(recortePadrao(ents, "subsistema")).toBe("SIN");
    const ree = ents.filter((e) => e.tipo === "ree");
    expect(recortePadrao(ents, "ree")).toBe(ree.reduce((a, b) => ((b.ear_max_mwmes ?? -1) > (a.ear_max_mwmes ?? -1) ? b : a)).id);
  });

  it("resposta do P018: razão de somas com os dois totais, faixa e ausência dita como ausência", () => {
    const e = entidadesEna(G.afluencia).find((x) => x.id === "SIN")!;
    const t = respostaAfluencia(e);
    expect(t).toContain(`${e.pct_mlt_30d!.toFixed(1).replace(".", ",")}% da MLT`);
    expect(t).toContain("MWmed·dia");
    const sem = clone(e);
    sem.pct_mlt_30d = null;
    expect(respostaAfluencia(sem)).toMatch(/^Sem ENA de 30 dias/);
    const abaixo = clone(e);
    abaixo.faixa_30d = "abaixo";
    expect(respostaAfluencia(abaixo)).toContain("abaixo da faixa usual");
    expect(textoMudancaAfluencia(entidadesEna(G.afluencia))).toContain("SIN");
  });

  it("anomalias: sinal decidido no valor arredondado (−0,04 com uma casa é igual à média)", () => {
    expect(textoAnomaliaPct(4.7)).toBe("4,7% acima da");
    expect(textoAnomaliaPct(-51.7)).toBe("51,7% abaixo da");
    expect(textoAnomaliaPct(-0.04)).toBe("igual à");
    expect(textoAnomaliaPct(null)).toBeNull();
    const b = clone(C.precipitacao_bacias[0]);
    b.anomalia_30d_pct = -20;
    expect(respostaChuva(b, C.base_climatologica)).toContain("20,0% abaixo da média");
    b.mm_30d = null;
    expect(respostaChuva(b, C.base_climatologica)).toMatch(/^Sem estimativa de chuva/);
    const t = clone(C.temperatura.find((x) => x.recorte === "SIN")!);
    t.anomalia_30d_c = -1.26;
    expect(respostaTemperatura(t, C.base_climatologica)).toContain("1,3 °C abaixo da média");
  });

  it("associação chuva e ENA é dita como associação, nunca causa", () => {
    const a = textoAssociacao(C.precipitacao_bacias.find((b) => b.associacao_ena)!)!;
    expect(a).toMatch(/^Associação, não causa/);
  });

  it("previsão: rodada, modelo e a ressalva de comparabilidade", () => {
    const pv = C.previsao!;
    const t = respostaPrevisao(pv, pv.bacias[0].bacia);
    expect(t).toMatch(/^Previsão, não observação/);
    expect(t).toContain(pv.emitida_em.slice(0, 10).split("-").reverse().join("/"));
    expect(t).toContain("só ordem de grandeza");
  });

  it("decomposição: soma, resíduo, maiores quedas e altas com nomes legíveis e o contexto que não fecha balanço", () => {
    const d = R.decomposicao_ear.find((x) => x.sm === "SE")!;
    const t = respostaDecomposicao(d);
    expect(t).toContain(`${d.n_reservatorios} reservatórios`);
    expect(t).toContain(nomeProprio(d.maiores_quedas[0].nome));
    expect(t).toContain("não fecha balanço");
    const outro = clone(d);
    outro.delta_ear_mwmes = 1234.5;
    expect(respostaDecomposicao(outro)).toContain("+1.234,5 MWmês");
  });

  it("balanço: outras estruturas fora da defluência quando a convenção as exclui; fechamento por construção dito assim", () => {
    const janela = { inicio: R.inicio, fim: R.fim, periodo_fecham_por_construcao: R.periodo_fecham_por_construcao };
    const r = clone(R.lista.find((x) => x.balanco_calculado)!);
    r.convencao_defluencia = "exclui_outras";
    r.outras_estruturas_hm3 = 3.21;
    r.serie_dias_residuo_dentro_tolerancia_pct = 100;
    const t = respostaBalanco(r, janela);
    expect(t).toContain("fora da defluência");
    expect(t).toContain("não é prova independente");
    r.convencao_defluencia = "inclui_outras";
    r.serie_dias_residuo_dentro_tolerancia_pct = 18.2;
    const t2 = respostaBalanco(r, janela);
    expect(t2).toContain("3,2 por outras estruturas");
    expect(t2).toContain("Só 18,2% dos dias");
    r.balanco_calculado = false;
    expect(respostaBalanco(r, janela)).toContain("sem balanço de 30 dias");
  });

  it("atualidade: acima da folga da fonte é fonte defasada, com o número de dias", () => {
    expect(situacaoAtualidade("2026-09-29", "2026-10-01T07:00:00Z", 3, "o ONS publica a EAR do dia anterior").defasada).toBe(false);
    const d = situacaoAtualidade("2026-09-20", "2026-10-01T07:00:00Z", 3, "o ONS publica a EAR do dia anterior");
    expect(d.defasada).toBe(true);
    expect(d.texto).toContain("Fonte defasada");
    expect(d.texto).toContain("11 dias");
  });

  it("nenhum texto gerado usa travessão nem hífen como pontuação, e nenhum atribui causa", () => {
    const janela = { inicio: R.inicio, fim: R.fim, periodo_fecham_por_construcao: R.periodo_fecham_por_construcao };
    const textos = [
      ...ents.map(respostaArmazenamento),
      ...entidadesEna(G.afluencia).map(respostaAfluencia),
      ...C.precipitacao_bacias.map((b) => respostaChuva(b, C.base_climatologica)),
      ...C.precipitacao_bacias.map((b) => textoAssociacao(b) ?? ""),
      ...C.temperatura.map((t) => respostaTemperatura(t, C.base_climatologica)),
      ...C.previsao!.bacias.map((b) => respostaPrevisao(C.previsao!, b.bacia)),
      ...R.decomposicao_ear.map(respostaDecomposicao),
      ...R.lista.map((r) => respostaBalanco(r, janela)),
      ...textosMlt(G.afluencia.mlt, "2026"),
      ...textoReconciliacaoEar(G.reconciliacao_ear),
      respostaCapacidade(G.armazenamento.capacidade, G.armazenamento.dia),
      textoQuebraRee(G.armazenamento.quebras_perimetro_ree[0]),
      textoFechamento(R),
      textoMudancaArmazenamento(ents),
      textoResumo(H, G.dias_referencia.ear, G.dias_referencia.ena),
      textoResumo(H, G.dias_referencia.ear, G.dias_referencia.ena, "1991-2020"),
      textoMltNaoConcluir(G.afluencia.mlt),
      textoValidacao(C.validacao_estacoes),
      textoReeNovos(G.afluencia.ree_novos_por_data),
      textoPesoSubsistemas(ents) ?? "",
      textoForaDosPontos(ents.filter((e) => e.tipo === "bacia")) ?? "",
      ...Object.values(G.evidencias).flatMap((e) => [e!.indicador, ...e!.testes.map((t) => `${t.nome}: ${t.detalhe}`)]),
      ...Object.values(G.proveniencia).flatMap((p) => p!.limitacoes),
      ...Object.values(C.separacao),
    ];
    for (const t of textos) {
      expect(t, t).not.toMatch(PONTUACAO_PROIBIDA);
      expect(t, t).not.toMatch(/causou|causad[oa] pel|explicad[oa] pela (ENA|chuva)|por causa d/i);
      expect(t, t).not.toMatch(/undefined|NaN|null/);
    }
  });

  it("textos que citam período, base, contagem ou modelo leem a gold: mudar o dado muda o texto", () => {
    // MLT: "a mesma" só com todas as usinas iguais
    const m = clone(G.afluencia.mlt);
    m.ano_corrente_igual_ao_anterior = [{ mes: "2026-01", usinas_comparadas: 10, usinas_iguais: 10 }];
    expect(textosMlt(m, "2026")[0]).toContain("é a mesma do ano anterior");
    m.ano_corrente_igual_ao_anterior = [{ mes: "2026-01", usinas_comparadas: 100, usinas_iguais: 96 }];
    expect(textosMlt(m, "2026")[0]).toContain("repete a do ano anterior em quase todas as usinas");
    m.ano_corrente_igual_ao_anterior = [{ mes: "2026-01", usinas_comparadas: 100, usinas_iguais: 50 }];
    expect(textosMlt(m, "2026")[0]).toContain("difere da do ano anterior");
    // PMO: contagem de meses conferidos e divergentes
    const pmoTexto = textoMltNaoConcluir(G.afluencia.mlt);
    const meses = new Set(G.afluencia.mlt.pmo.comparacao.map((c) => c.mes)).size;
    expect(pmoTexto).toContain(`${meses} meses conferidos`);
    m.pmo.meses_divergentes = [];
    expect(textoMltNaoConcluir(m)).toContain("coincidiu");
    // resumo de operação: a base de cada publicação, lida de cada uma
    const baseSin = G.armazenamento.subsistemas.find((x) => x.sm === "SIN")!.periodo_base!;
    expect(textoResumo(H, G.dias_referencia.ear, G.dias_referencia.ena, baseSin)).toContain(baseSin.replace("-", " a "));
    expect(textoResumo(H, G.dias_referencia.ear, G.dias_referencia.ena, "1991-2020")).toContain("bases diferentes");
    // conferência com estações: o período é o publicado
    expect(textoValidacao(C.validacao_estacoes)).toContain(periodoValidacao(C.validacao_estacoes)!);
    const v = clone(C.validacao_estacoes);
    v.periodo = { inicio: "2019-03", fim: "2019-03" };
    expect(textoValidacao(v)).toContain("mar/2019");
    // REE novos e recortes sem armazenamento: nomes e datas da gold
    expect(textoReeNovos(G.afluencia.ree_novos_por_data)).toContain(G.afluencia.ree_novos_por_data[0].data.split("-").reverse().join("/"));
    const ents = entidadesEar(G.armazenamento);
    const fora = textoForaDosPontos(ents.filter((e) => e.tipo === "bacia"))!;
    for (const e of ents.filter((x) => x.tipo === "bacia" && x.sem_armazenamento)) expect(fora).toContain(e.rotulo);
    expect(textoForaDosPontos(ents.filter((e) => e.tipo === "subsistema"))).toBeNull();
    // peso dos subsistemas: 1 p.p. em MWmês = EAR máxima ÷ 100
    const se = ents.find((e) => e.id === "SE")!;
    expect(textoPesoSubsistemas(ents)).toContain(`${Math.round(se.ear_max_mwmes! / 100).toLocaleString("pt-BR")} MWmês`);
    // modelo da previsão: o publicado na gold
    expect(modeloCurto(C.previsao!.modelo)).toBe("ECMWF IFS 0,25°");
    expect(modeloCurto("GFS 0,25°, rodada de 00Z")).toBe("GFS 0,25°");
  });

  it("nomes do ONS ficam legíveis sem perder a chave original", () => {
    expect(nomeProprio("SAO FRANCISCO")).toBe("São Francisco");
    expect(nomeProprio("SERRA DA MESA")).toBe("Serra da Mesa");
    expect(nomeProprio("RONDON II")).toBe("Rondon II");
    expect(nomeProprio("C.BRANCO-1")).toBe("C.Branco-1");
    expect(linhasArmazenamento(ents.filter((e) => e.tipo === "bacia")).map((l) => l.nome)).toContain("SAO FRANCISCO");
  });
});

/* ---------- páginas no servidor ---------- */

describe("páginas renderizadas no servidor", () => {
  const paginas = { p017: PaginaArmazenamento, p018: PaginaAfluencia, p019: PaginaClima, p020: PaginaReservatorios } as const;
  const html = Object.fromEntries(Object.entries(paginas).map(([k, P]) => [k, renderToStaticMarkup(createElement(P))])) as Record<keyof typeof paginas, string>;
  const ents = entidadesEar(G.armazenamento);
  const respostas = {
    p017: respostaArmazenamento(ents.find((e) => e.id === "SIN")!),
    p018: respostaAfluencia(entidadesEna(G.afluencia).find((e) => e.id === "SIN")!),
    p019: respostaChuva(C.precipitacao_bacias.find((b) => b.bacia === baciaPadraoChuva(G.armazenamento.bacias, C.precipitacao_bacias))!, C.base_climatologica),
    p020: respostaDecomposicao(R.decomposicao_ear.find((d) => d.sm === "SE")!),
  };
  const minimoTabelas = { p017: 8, p018: 8, p019: 9, p020: 5 } as const;
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  it("cada painel renderiza na sua página com a pergunta como título, a resposta derivada e a anatomia da seção 7.2", () => {
    for (const id of ["p017", "p018", "p019", "p020"] as const) {
      const h = html[id];
      const p = PAINEIS_AGUA.find((x) => x.id === id)!;
      expect(h, id).toContain(`id="${id}"`);
      expect(h, id).toContain(`id="${id}-titulo"`);
      expect(h, id).toContain(p.pergunta);
      expect(h, id).toContain(`data-resposta="${id}"`);
      expect(h, id).toContain(esc(respostas[id].slice(0, 60)));
      for (const parte of ["Período", "Universo", "Unidade", "Como interpretar", "O que não é possível concluir", "Próxima pergunta", "Copiar link deste painel", "Baixar"]) {
        expect(h, `${id}: ${parte}`).toContain(parte);
      }
      expect((h.match(/Comprove este número/g) ?? []).length, id).toBeGreaterThanOrEqual(1);
      expect((h.match(/<table/g) ?? []).length, id).toBeGreaterThanOrEqual(minimoTabelas[id]);
      expect(h, id).toContain('role="radiogroup" aria-label="Nível de profundidade"');
      expect(h, id).toContain('data-nivel="analisar"');
      expect(h, id).toContain('data-nivel="auditar"');
      for (const q of PAINEIS_AGUA) expect(h, `${id} -> ${q.id}`).toContain(`href="${rotaPainel(q.id)}"`);
      // abertura (P017): os outros três painéis aparecem como capítulos depois da figura principal; nas filhas, a faixa de páginas irmãs
      // traz a atual com aria-current. O mesmo rótulo não aparece nas duas formas na mesma página.
      if (id === "p017") expect(h, id).toContain('data-navegacao-local="capitulos"');
      else expect(h, id).toMatch(new RegExp(`aria-current="page"[^>]*>${p.rotulo}<`));
      expect(h.slice(h.indexOf("<main")), id).not.toMatch(/em breve|em constru|em integra/i);
    }
  });

  it("P017: anchors antigas (#ear, #padrao), KPIs com prova, capacidade e conferência com o resumo de operação", () => {
    const h = html.p017;
    expect(h).toContain('id="ear"');
    expect(h).toContain('id="padrao"');
    expect(h).toContain('id="capacidade"');
    expect((h.match(/Comprove este número/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(h).toContain('id="conferencia-resumo"');
    expect(h).toContain("compara capacidades diferentes");
    expect(ler("src/app/setor-eletrico/agua-e-clima/page.tsx")).toContain("ANCORAS_AFLUENCIA");
    expect(ANCORAS_AFLUENCIA).toContain("ena");
  });

  it("P018: âncora #ena, MLT com o relatório do PMO e a ficha da diferença", () => {
    const h = html.p018;
    expect(h).toContain('id="ena"');
    expect(h).toContain('data-textos="mlt"');
    expect(h).toContain("RELATORIO-PMO-");
    // ENA bruta, ENA armazenável (os dois números de destaque) e a diferença da MLT
    expect((h.match(/Comprove este número|comprove este número/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it("P019: estimativa, observação, previsão e cenário separados; mapa com tabela equivalente; previsão rotulada", () => {
    const h = html.p019;
    expect(h).toContain('data-separacao="p019"');
    for (const x of ["Observação", "Estimativa", "Previsão", "Cenário", "Não integrado"]) expect(h, x).toContain(x);
    expect(h).toContain('data-estado="carregando"');
    expect(h).toContain("Tabela equivalente ao mapa");
    expect(h).toContain('data-natureza="PREVISTO"');
    expect(h).toContain("Previsão, não observação");
    expect(h).toContain("Associação, não causa");
  });

  it("P020: decomposição e balanço com resíduo, séries carregadas sob demanda com estado explicado", () => {
    const h = html.p020;
    expect(h).toContain("não fecha balanço");
    expect(h).toContain("Resíduo do balanço");
    expect(h).toContain('data-series="espera"');
    expect(h).toContain(`Carregando as séries diárias de ${R.series_45d.dias} dias`);
    // os dois números de destaque têm ficha de prova
    expect((h.match(/Comprove este número/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("HTML de cada página abaixo de 520 KB e props dos componentes cliente abaixo de cerca de 250 KB (meta de cerca de 600 KB; contrato, seção 5.1)", () => {
    for (const [id, h] of Object.entries(html)) expect(h.length, id).toBeLessThan(520_000);
    const props = {
      p017: { e: ents, d: serieRegioes(G.armazenamento.serie_diaria_mwmes), m: serieMensalEar(G.armazenamento.serie_mensal_mwmes) },
      p018: { e: entidadesEna(G.afluencia), s: serieRegioes(G.afluencia.serie_30d_semanal) },
      p019: { p: C.precipitacao_bacias, t: C.temperatura, f: C.previsao },
      p020: { l: R.lista, d: R.decomposicao_ear },
    };
    for (const [id, p] of Object.entries(props)) expect(JSON.stringify(p).length, id).toBeLessThan(250_000);
  });

  it("gold ausente: estado de indisponibilidade com o motivo, sem número de reserva", () => {
    const h = renderToStaticMarkup(createElement(AguaIndisponivel, { motivo: "gold reprovada na validação física" }));
    expect(h).toContain("Água e clima indisponível nesta publicação");
    expect(h).toContain("gold reprovada na validação física");
    expect(h).not.toMatch(/\d{2}\.\d{3}/);
  });

  it("o destino Água e clima está publicado no menu", () => {
    expect(DESTINOS_NAVEGACAO.find((d) => d.slug === "agua-e-clima")?.publicado).toBe(true);
  });
});

/* ---------- componentes ---------- */

describe("componentes do módulo", () => {
  const dir = join(raiz, "src/components/energia");
  const componentes = readdirSync(dir).filter((x) => x.startsWith("Agua"));
  const paginas = ["", "/afluencia", "/chuva-e-temperatura", "/reservatorios"].map((r) => join(raiz, `src/app/setor-eletrico/agua-e-clima${r}/page.tsx`));

  it("sem hexadecimal solto (o uso de energia-soft como texto é conferido por design-tokens-energia)", () => {
    for (const f of [...componentes.map((c) => join(dir, c)), ...paginas, join(raiz, "src/lib/energia/agua.ts")]) {
      const t = readFileSync(f, "utf-8");
      expect(t, f).not.toMatch(/#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?\b/);
      expect(t, f).not.toMatch(/["'`(\s]#[0-9a-fA-F]{3}["'`;\s)]/);
    }
  });

  it("nenhum período, base ou janela fixado no código das páginas e componentes (vêm da gold)", () => {
    const fixos = [/2001 a 2025/, /2020 e 2021/, /desde 2000/i, /\b45 dias\b/, /\b120 dias\b/, /\b18 meses\b/, /\b24 meses\b/, /\b12 meses completos\b/, /a cada (7|14) dias/, /30\/12\/2017/, /em 2026/];
    for (const f of [...componentes.map((c) => join(dir, c)), ...paginas]) {
      // comentários explicam o porquê e podem citar o valor atual; o texto exibido não
      const codigo = readFileSync(f, "utf-8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      for (const r of fixos) expect(codigo, `${f}: ${r}`).not.toMatch(r);
    }
  });

  it("módulos cliente só exportam componentes e tipos", () => {
    for (const f of componentes) {
      const t = readFileSync(join(dir, f), "utf-8");
      if (!t.startsWith('"use client"')) continue;
      for (const m of Array.from(t.matchAll(/^export (const|let|var) (\w+)/gm))) expect.fail(`${f} exporta valor ${m[2]}`);
    }
  });

  it("as páginas só leem a gold do módulo (o resumo de operação entra só na conferência do modo Auditar)", () => {
    for (const f of paginas) expect(readFileSync(f, "utf-8"), f).toContain('lerGold<AguaDetalheGold>("agua_detalhe.json")');
    expect(readFileSync(paginas[0], "utf-8").match(/gold\.hidrologia\(\)/g)?.length).toBe(1);
  });
});
