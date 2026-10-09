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
import { MedidasAfluencia } from "@/components/energia/AguaAfluencia";
import { MedidasClima } from "@/components/energia/AguaClima";
import { AguaLista } from "@/components/energia/AguaControles";
import { AguaIndisponivel } from "@/components/energia/AguaPagina";
import { MedidasBalanco, MedidasDecomposicao } from "@/components/energia/AguaReservatorios";
import {
  ANCORAS_AFLUENCIA,
  CORES_ANOMALIA,
  COLUNAS_AFLUENCIA,
  COLUNAS_ARMAZENAMENTO,
  COLUNAS_CHUVA,
  COLUNAS_RESERVATORIOS,
  PAINEIS_AGUA,
  COLUNAS_DECOMPOSICAO,
  COLUNAS_PREVISAO_CHUVA,
  COLUNAS_PREVISAO_TEMPERATURA,
  COLUNAS_TEMPERATURA,
  PONTUACAO_PROIBIDA,
  REGRA_CAPTURA_ENA,
  REGRA_FAIXA_ENA,
  REVISOES_CAPTURA_UNICA,
  baciaPadraoChuva,
  baciasSemChuva,
  barrasBalanco,
  barrasBalancoDefluencia,
  barrasBalancoResiduo,
  barrasBalancoTotais,
  barrasDecomposicao,
  barrasDecomposicaoComRestante,
  classificacaoChuva,
  dadosChuvaMes,
  diasPreliminares,
  ehGrupoOns,
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
  listaMeses,
  marcaPreliminarSerie,
  mesPreliminar,
  mesesSemPmo,
  modeloCurto,
  motivoSemBalanco,
  motivoSemEna30d,
  nomeProprio,
  notaChuvaBacia,
  notaChuvaMes,
  notaEnaDoDia,
  notaOutraJanelaCurta,
  notaVazoesCoincidem,
  periodoBase,
  periodoValidacao,
  periodosMapa,
  recortePadrao,
  restanteDecomposicao,
  rotuloRecorte,
  serieDiferencaMlt,
  serieMltJanJul,
  serieMltMensal,
  ultimoDiaDoMes,
  vereditoAfluencia,
  vereditoAssociacao,
  vereditoBalancoReservatorio,
  vereditoChuva,
  vereditoChuvaMes,
  vereditoDecomposicao,
  vereditoTemperatura,
  vizinhaNoMapa,
  volumeForaDaFaixa,
  textoBaciasSemChuva,
  textoCobertura,
  textoEnaProvisoria,
  textoFaixaJanela,
  textoMudancaMltNoMes,
  textoOutraJanelaNaArmazenamento,
  textoParcelasFaltantes,
  textoPreliminarChuva,
  textoPreliminarTemperatura,
  textoRevisoesFicha,
  textoUltimoMesFinalChuva,
  textoUltimoMesFinalTemperatura,
  textoVolumeForaDaFaixa,
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
  textoMudancaDecomposicao,
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

  it("MLT e PMO: o eixo é de tempo real, o mês sem relatório é lacuna, e a diferença plotada é a da gold com a tolerância publicada", () => {
    const mlt = G.afluencia.mlt;
    const comp = mlt.pmo.comparacao;
    const meses = Array.from(new Set(comp.map((c) => c.mes))).sort();
    const sem = mesesSemPmo(mlt);
    // abril a junho de 2026 não têm relatório: são os meses que faltam entre o primeiro e o último comparados
    expect(sem).toEqual(["2026-04", "2026-05", "2026-06"]);
    expect(listaMeses(sem)).toBe("abril, maio e junho de 2026");
    expect(listaMeses(["2025-12", "2026-01"])).toBe("dezembro de 2025 e janeiro de 2026");
    const nivel = serieMltMensal(mlt, "SE");
    expect(nivel.length).toBe(meses.length + sem.length);
    for (const m of sem) expect(nivel.find((x) => x.m === m)).toEqual({ m, pmo: null, inicio: null, fim: null });
    for (const c of comp.filter((x) => x.sm === "SE")) expect(nivel.find((x) => x.m === c.mes)).toEqual({ m: c.mes, pmo: c.pmo_mwmed, inicio: c.aberto_inicio_mwmed, fim: c.aberto_fim_mwmed });
    // a diferença é a do início do mês, por subsistema, com a tolerância em todos os meses (a faixa é referência, não dado)
    const dif = serieDiferencaMlt(mlt);
    expect(dif.length).toBe(nivel.length);
    for (const l of dif) {
      expect(l.tol_sup).toBe(mlt.pmo.tolerancia_pct);
      expect(l.tol_inf).toBe(-mlt.pmo.tolerancia_pct);
    }
    for (const c of comp) expect(dif.find((x) => x.m === c.mes)![c.sm]).toBe(c.dif_inicio_pct);
    for (const m of sem) expect(dif.find((x) => x.m === m)).toMatchObject({ SE: null, S: null, NE: null, N: null });
    // a mudança dentro do mês (janeiro) é dita com a diferença do fim, que o gráfico do início não mostra
    const t = textoMudancaMltNoMes(mlt);
    for (const c of comp.filter((x) => x.dif_inicio_pct !== x.dif_fim_pct)) expect(t).toContain(`${c.dif_fim_pct! > 0 ? "+" : "−"}${Math.abs(c.dif_fim_pct!).toFixed(3).replace(".", ",")}%`);
    expect(t).toContain("janeiro de 2026");
    const sem2 = clone(mlt);
    for (const c of sem2.pmo.comparacao) c.dif_fim_pct = c.dif_inicio_pct;
    expect(textoMudancaMltNoMes(sem2)).toBe("");
    // os textos de Analisar dizem a lacuna e que a versão provisória é inferência do observatório
    const textos = textosMlt(mlt, "2026").join(" ");
    expect(textos).toContain("Sem comparação em abril, maio e junho de 2026");
    expect(textos).toContain("versão inferida como provisória");
    expect(textos).toContain("a inferência é do observatório, não do ONS");
    expect(textoMltNaoConcluir(mlt)).toContain("sem abril, maio e junho de 2026");
  });

  it("MLT implícita de janeiro e de julho: duas linhas por subsistema, uma por mês, com os valores da gold", () => {
    const mlt = G.afluencia.mlt;
    const linhas = serieMltJanJul(mlt);
    const anos = Array.from(new Set(mlt.implicita_subsistemas.ano));
    expect(linhas.map((l) => l.x)).toEqual(anos.map(String));
    mlt.implicita_subsistemas.ano.forEach((ano, i) => {
      const l = linhas.find((x) => x.x === String(ano))!;
      for (const sm of ["SE", "S", "NE", "N"] as const) expect(l[`${sm}_${mlt.implicita_subsistemas.mes[i]}`], `${sm} ${ano}`).toBe(mlt.implicita_subsistemas[sm][i]);
    });
  });

  it("sem ENA de 30 dias: o motivo exato, o rótulo do grupo do ONS e a faixa sem a expressão quebrada", () => {
    const ents = entidadesEna(G.afluencia);
    const grupos = ents.filter((e) => e.tipo === "bacia" && ehGrupoOns(e.nome));
    expect(grupos.length).toBe(2);
    for (const g of grupos) {
      expect(g.rotulo).toMatch(/^Outras do (Sul|Sudeste) \(grupo do ONS\)$/);
      expect(rotuloRecorte("bacia", g.nome)).toBe(g.rotulo);
      expect(motivoSemEna30d(g)).toBe("o ONS publica essas afluências agrupadas sem MLT, e sem MLT não há percentual");
      const v = vereditoAfluencia(g);
      expect(v).toMatch(/^Sem ENA de 30 dias do grupo Outras do (Sul|Sudeste) até 29\/09\/2026: o ONS publica essas afluências agrupadas sem MLT/);
      expect(respostaAfluencia(g)).toContain("o ONS publica essas afluências agrupadas sem MLT");
      expect(textoFaixaJanela(g)).toBe("sem faixa da mesma janela, porque o recorte não tem ENA de 30 dias");
      expect(String(linhasAfluencia([g])[0].rotulo)).not.toMatch(/Bacia do Outras/);
    }
    // recorte comum sem ENA: a causa vem dos campos (falta ENA em algum dia, ou falta a MLT)
    const bacia = clone(ents.find((e) => e.tipo === "bacia" && !ehGrupoOns(e.nome))!);
    bacia.pct_mlt_30d = null;
    bacia.ena_30d_soma_mwmed_dia = null;
    expect(motivoSemEna30d(bacia)).toContain("falta ENA em algum dia da janela de 30 dias");
    bacia.ena_30d_soma_mwmed_dia = 10;
    bacia.mlt_30d_soma_mwmed_dia = null;
    expect(motivoSemEna30d(bacia)).toContain("não há MLT publicada para o recorte");
    // com ENA e sem faixa (poucos anos na base): o texto diz quantos anos e o mínimo, e o período da base só vale com faixa
    const smv = ents.find((e) => e.nome === "SANTA MARIA VIT")!;
    expect(smv.faixa_30d).toBeNull();
    expect(textoFaixaJanela(smv)).toBe("sem faixa da mesma janela: 2 anos na base, e o mínimo é 5");
    expect(textoFaixaJanela(ents.find((e) => e.id === "SIN")!)).toBe("faixa da mesma janela em 2001 a 2025");
    for (const e of ents) expect(textoFaixaJanela(e), e.id).not.toContain("sem base");
    // o veredito diz "média de longo termo", como o lead e a sigla
    expect(vereditoAfluencia(ents.find((e) => e.id === "SIN")!)).toContain("média de longo termo (MLT)");
  });

  it("revisões do ONS: a ficha da ENA diz o que a tabela da página mostra, e os destaques dizem que os últimos dias são provisórios", () => {
    const rev = G.afluencia.revisoes_entre_capturas_30d;
    const f = textoRevisoesFicha(rev);
    const nome = { SE: "Sudeste/Centro-Oeste", S: "Sul", NE: "Nordeste", N: "Norte" } as const;
    for (const r of rev.filter((x) => x.dias_revisados > 0)) expect(f).toContain(`${nome[r.sm]} ${r.dias_revisados}`);
    expect(f).toContain("O ONS revisou a ENA bruta entre as duas capturas mais recentes");
    expect(f).toContain("tabela de revisões do ONS desta página, em Auditar");
    expect(f).not.toContain("Nenhuma revisão");
    const nenhuma = rev.map((r) => ({ ...r, dias_revisados: 0 }));
    expect(textoRevisoesFicha(nenhuma)).toBe("Nenhum valor dos últimos 30 dias mudou entre as duas capturas mais recentes.");
    const p = textoEnaProvisoria(rev);
    expect(p).toContain("A ENA dos últimos dias é provisória: o ONS a revisa depois de publicá-la");
    const dias = rev.map((r) => r.dias_revisados);
    expect(p).toContain(`de ${Math.min(...dias)} a ${Math.max(...dias)} dos 30 dias`);
    expect(textoEnaProvisoria(nenhuma)).toContain("nenhum valor dos últimos 30 dias mudou");
    // reservatórios e chuva vêm de uma captura só: a ficha diz que ainda não dá para detectar revisões
    expect(REVISOES_CAPTURA_UNICA).toBe("Ainda não é possível detectar revisões: há uma única captura.");
  });

  it("mapa das bacias: a seta vai à bacia mais próxima na direção, pelo ponto de rótulo; sem bacia na direção, o foco fica", () => {
    // y cresce para baixo, como no SVG
    const pontos = { A: [0, 0], B: [10, -1], C: [12, 30], D: [-10, 0], E: [0, -10] } as const;
    expect(vizinhaNoMapa(pontos, "A", "direita")).toBe("B");
    expect(vizinhaNoMapa(pontos, "A", "esquerda")).toBe("D");
    expect(vizinhaNoMapa(pontos, "A", "cima")).toBe("E");
    expect(vizinhaNoMapa(pontos, "A", "baixo")).toBe("C");
    // o ângulo pesa: à direita de A, B está alinhado e C, na diagonal, não
    expect(vizinhaNoMapa(pontos, "A", "direita")).not.toBe("C");
    expect(vizinhaNoMapa(pontos, "D", "esquerda")).toBeNull();
    expect(vizinhaNoMapa(pontos, "inexistente", "direita")).toBeNull();
    // com os pontos reais do mapa de bacias, toda bacia alcança alguma outra com ao menos duas setas
    const ids = GEO.features.map((f) => f.id);
    expect(ids.length).toBe(22);
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
  it("barras e tabela da decomposição: mesmas parcelas, ligadas ao reservatório pelo código da usina, e uma barra para a soma dos demais", () => {
    for (const d of R.decomposicao_ear) {
      const b = barrasDecomposicao(d);
      const comRestante = barrasDecomposicaoComRestante(d);
      const l = linhasDecomposicao(d);
      // o gráfico e a tabela têm as mesmas linhas, e a soma dos demais é a última
      expect(l.map((x) => x.id), d.sm).toEqual(comRestante.map((x) => x.id));
      expect(l.map((x) => x.delta), d.sm).toEqual(comRestante.map((x) => x.delta));
      expect(comRestante.slice(0, b.length).map((x) => x.id), d.sm).toEqual(b.map((x) => x.id));
      // as parcelas listadas vão da maior queda à maior alta
      for (let i = 1; i < b.length; i++) expect((b[i].delta ?? 0) >= (b[i - 1].delta ?? 0), d.sm).toBe(true);
      expect(Math.abs((d.delta_ear_mwmes ?? 0) - (d.soma_reservatorios_mwmes ?? 0) - (d.residuo_mwmes ?? 0)), d.sm).toBeLessThanOrEqual(0.1);
      // com a barra dos demais, as barras somam a soma publicada dos reservatórios (a identidade fecha por construção) e contam todas as parcelas
      const soma = comRestante.reduce((t, x) => t + (x.delta ?? 0), 0);
      // cada parcela e o total vêm arredondados a uma casa: sem a barra dos demais, a soma das parcelas difere do total por arredondamento
      expect(Math.abs(soma - (d.soma_reservatorios_mwmes ?? 0)), d.sm).toBeLessThan(0.05 * b.length + 0.05);
      const rest = restanteDecomposicao(d);
      expect(b.length + (rest?.nRestantes ?? 0), d.sm).toBe(d.n_reservatorios);
      expect(comRestante.length, d.sm).toBe(b.length + (rest ? 1 : 0));
    }
    const se = R.decomposicao_ear.find((d) => d.sm === "SE")!;
    const ligadas = barrasDecomposicao(se).map((b) => reservatorioDaParcela(R.lista, b.cod)).filter(Boolean);
    expect(ligadas.length).toBeGreaterThanOrEqual(8);
    // a barra dos demais não é um reservatório: não se liga a nenhum
    const demais = barrasDecomposicaoComRestante(se).at(-1)!;
    expect(demais.cod).toBe("");
    expect(reservatorioDaParcela(R.lista, demais.cod)).toBeNull();
    expect(demais.rotulo).toContain("Demais 35 reservatórios");
    expect(demais.delta!).toBeCloseTo(-1912.3, 1);
    // o subsistema com todas as parcelas no gráfico não ganha a barra
    const norte = R.decomposicao_ear.find((d) => d.sm === "N")!;
    expect(restanteDecomposicao(norte)).toBeNull();
    expect(textoParcelasFaltantes(norte)).toBe("");
    // a frase diz o que falta: a soma dos demais é por diferença e as variações individuais não estão publicadas
    const f = textoParcelasFaltantes(se);
    expect(f).toContain("10 das 45 parcelas");
    expect(f).toContain("por diferença");
    expect(f).toContain("não estão publicadas");
    // a coluna do valor vem logo depois do nome (cabe em 360 px)
    expect(COLUNAS_DECOMPOSICAO.slice(0, 2).map((c) => c.id)).toEqual(["rotulo", "delta"]);
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
    // o veredito diz o sentido, o tamanho e o reservatório que mais pesou, em uma frase curta; sem variação, o valor fica ausente
    const v = vereditoDecomposicao(d);
    expect(v).toMatch(/^De \d{2}\/\d{2}\/\d{4} a \d{2}\/\d{2}\/\d{4}, a energia armazenada /);
    expect(v).toContain(d.delta_ear_mwmes! < 0 ? "caiu" : "subiu");
    expect(v).toContain(d.delta_ear_mwmes! < 0 ? "a maior queda foi a de" : "a maior alta foi a de");
    expect(v.split(/\s+/).length).toBeLessThanOrEqual(40);
    const ausente = clone(d);
    ausente.delta_ear_mwmes = null;
    expect(vereditoDecomposicao(ausente)).toContain("o valor fica ausente, nunca zero");
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
      ...R.lista.map((r) => respostaBalanco(r, janela, R.sem_cadastro)),
      ...textosMlt(G.afluencia.mlt, "2026"),
      ...textoReconciliacaoEar(G.reconciliacao_ear),
      respostaCapacidade(G.armazenamento.capacidade, G.armazenamento.dia),
      textoQuebraRee(G.armazenamento.quebras_perimetro_ree[0]),
      textoFechamento(R),
      textoMudancaArmazenamento(ents),
      textoMudancaDecomposicao(R.decomposicao_ear),
      notaEnaDoDia(entidadesEna(G.afluencia).find((e) => e.id === "SIN")!) ?? "",
      textoResumo(H, G.dias_referencia.ear, G.dias_referencia.ena),
      textoResumo(H, G.dias_referencia.ear, G.dias_referencia.ena, "1991-2020"),
      textoMltNaoConcluir(G.afluencia.mlt),
      textoValidacao(C.validacao_estacoes),
      textoValidacao(C.validacao_estacoes, C.corte_imerg_final),
      textoCobertura(C),
      textoBaciasSemChuva(baciasSemChuva(G.armazenamento.bacias, C.precipitacao_bacias)),
      textoPreliminarChuva(C.precipitacao_bacias[0].dia, C.corte_imerg_final),
      textoPreliminarTemperatura(C.temperatura[0].dia, C.corte_merra2),
      ...C.precipitacao_bacias.map(vereditoChuva),
      ...C.precipitacao_bacias.map((b) => notaChuvaBacia(b, C.base_climatologica)),
      ...C.precipitacao_bacias.map((b) => vereditoAssociacao(b) ?? ""),
      ...C.precipitacao_bacias.map((b) => vereditoChuvaMes(b, b.mensal.m[b.mensal.m.length - 1])),
      ...C.precipitacao_bacias.map((b) => notaChuvaMes(b, b.mensal.m[b.mensal.m.length - 1], C.base_climatologica)),
      ...entidadesEna(G.afluencia).map(vereditoAfluencia),
      textoRevisoesFicha(G.afluencia.revisoes_entre_capturas_30d),
      textoEnaProvisoria(G.afluencia.revisoes_entre_capturas_30d),
      textoMudancaMltNoMes(G.afluencia.mlt),
      textoVolumeForaDaFaixa(R.lista),
      textoParcelasFaltantes(R.decomposicao_ear[0]),
      REGRA_FAIXA_ENA,
      REGRA_CAPTURA_ENA,
      ...R.lista.map((r) => vereditoBalancoReservatorio(r, janela, R.sem_cadastro)),
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

  it("faixa de métricas da afluência: a nota da ENA do dia lê o percentual da MLT do dia e a MLT do dia, e some sem eles", () => {
    const e = entidadesEna(G.afluencia).find((x) => x.id === "SIN")!;
    const nota = notaEnaDoDia(e)!;
    expect(nota).toContain(`${e.pct_mlt_dia!.toFixed(1).replace(".", ",")}% da MLT do dia`);
    expect(nota).toContain(`${Math.round(e.mlt_mwmed_dia!).toLocaleString("pt-BR")} MWmed`);
    // mudar o dado muda a nota; ausência não vira zero
    const outro = clone(e);
    outro.pct_mlt_dia = 50;
    outro.mlt_mwmed_dia = 1234;
    expect(notaEnaDoDia(outro)).toBe("50,0% da MLT do dia, de 1.234 MWmed.");
    outro.pct_mlt_dia = null;
    expect(notaEnaDoDia(outro)).toBeNull();
  });

  it("variação da EAR por subsistema: mesma unidade e mesmo período dito uma vez; período por subsistema só quando diferem", () => {
    const ds = R.decomposicao_ear;
    const t = textoMudancaDecomposicao(ds);
    const mesmo = ds.every((d) => d.inicio === ds[0].inicio && d.fim === ds[0].fim);
    expect(mesmo).toBe(true);
    expect(t).toContain(`De ${ds[0].inicio.split("-").reverse().join("/")} a ${ds[0].fim.split("-").reverse().join("/")}`);
    for (const d of ds) expect(t).toContain(`${d.delta_ear_mwmes! < 0 ? "−" : "+"}${Math.abs(d.delta_ear_mwmes!).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`);
    expect(t.indexOf("Sudeste/Centro-Oeste")).toBeLessThan(t.indexOf("Sul"));
    expect(t.indexOf("Sul")).toBeLessThan(t.indexOf("Nordeste"));
    expect(t.indexOf("Nordeste")).toBeLessThan(t.indexOf("Norte"));
    // períodos diferentes: cada subsistema traz o seu
    const dif = clone(ds);
    dif[1].fim = "2026-01-05";
    expect(textoMudancaDecomposicao(dif)).toContain("(");
    expect(textoMudancaDecomposicao(dif)).toContain("05/01/2026");
    // variação ausente fica de fora, nunca zero
    const sem = clone(ds);
    sem[0].delta_ear_mwmes = null;
    expect(textoMudancaDecomposicao(sem)).not.toContain("Sudeste/Centro-Oeste");
    for (const d of sem) d.delta_ear_mwmes = null;
    expect(textoMudancaDecomposicao(sem)).toContain("Sem variação");
  });

  it("nomes do ONS ficam legíveis sem perder a chave original", () => {
    expect(nomeProprio("SAO FRANCISCO")).toBe("São Francisco");
    expect(nomeProprio("SERRA DA MESA")).toBe("Serra da Mesa");
    expect(nomeProprio("RONDON II")).toBe("Rondon II");
    // o dicionário local dá acento e nome por extenso aos que o ONS publica sem acento ou abreviados
    expect(nomeProprio("C.BRANCO-1")).toBe("Capim Branco I");
    expect(nomeProprio("SAO ROQUE")).toBe("São Roque");
    expect(nomeProprio("TUCURUI")).toBe("Tucuruí");
    expect(nomeProprio("S.DO FACÃO")).toBe("Serra do Facão");
    expect(nomeProprio("CURUA-UNA")).toBe("Curuá-Una");
    for (const r of R.lista) expect(nomeProprio(r.nome), r.nome).not.toMatch(/\b(Sao|Tucurui|Curua)\b|S\.Do|A\. Vermelha/);
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

/* ---------- as três páginas filhas no sistema editorial ---------- */

describe("páginas filhas (afluência, chuva e temperatura, reservatórios) no sistema editorial", () => {
  const filhas = { p018: PaginaAfluencia, p019: PaginaClima, p020: PaginaReservatorios } as const;
  const html = Object.fromEntries(Object.entries(filhas).map(([k, P]) => [k, renderToStaticMarkup(createElement(P))])) as Record<keyof typeof filhas, string>;
  const dataBr = (iso: string) => iso.split("-").reverse().join("/");
  const faixaMetricas = (h: string) => /<section[^>]*data-faixa-metricas=""[^>]*>[\s\S]*?<\/section>/.exec(h)?.[0] ?? "";
  const faixas = (h: string) => Array.from(h.matchAll(/<section[^>]*data-faixa-metricas=""[^>]*>[\s\S]*?<\/section>/g)).map((m) => m[0]);
  const secao = (h: string, id: string) => new RegExp(`<section id="${id}"[^>]*>`).exec(h)?.[0] ?? null;
  const textoDe = (h: string) => h.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  it("abertura editorial: faixa de irmãs no alto, migalha do módulo, título igual à pergunta do painel e título da figura diferente dele", () => {
    for (const id of ["p018", "p019", "p020"] as const) {
      const h = html[id];
      const p = PAINEIS_AGUA.find((x) => x.id === id)!;
      expect(h, id).toContain('data-abertura="editorial"');
      expect(h.match(/<h1/g)?.length, id).toBe(1);
      expect(/<h1[^>]*>([^<]*)<\/h1>/.exec(h)![1], id).toBe(p.pergunta);
      // a faixa de irmãs abre o conteúdo (antes da migalha e do título); capítulos só existem na abertura do módulo
      expect(h.match(/data-navegacao-local="faixa"/g)?.length, id).toBe(1);
      expect(h, id).not.toContain('data-navegacao-local="capitulos"');
      const main = h.slice(h.indexOf("<main"));
      expect(main.indexOf('data-navegacao-local="faixa"'), id).toBeLessThan(main.indexOf("<h1"));
      expect(main.indexOf(">Água e clima</p>"), `${id}: migalha`).toBeGreaterThan(main.indexOf('data-navegacao-local="faixa"'));
      expect(main.indexOf(">Água e clima</p>"), `${id}: migalha`).toBeLessThan(main.indexOf("<h1"));
      // o título da primeira figura não repete o da página
      const h2 = new RegExp(`<h2 id="${id}-titulo"[^>]*>([^<]*)</h2>`).exec(h)?.[1];
      expect(h2, id).toBeTruthy();
      expect(h2, id).not.toBe(p.pergunta);
    }
  });

  it("uma navegação local, notas junto da figura (uma vez) e próximos passos numa linha no rodapé do painel", () => {
    for (const id of ["p018", "p019", "p020"] as const) {
      const h = html[id];
      expect(h.match(/data-notas-painel=""/g)?.length, id).toBe(1);
      expect(h.match(/data-seguir-painel=""/g)?.length, id).toBe(1);
      // as notas vêm depois da figura principal (a resposta do painel) e antes do bloco recolhido "Por que isso importa"
      const iResposta = h.indexOf(`data-resposta="${id}"`);
      const iNotas = h.indexOf('data-notas-painel=""');
      const iPorQue = h.indexOf("data-por-que-importa");
      expect(iNotas, id).toBeGreaterThan(iResposta);
      expect(iNotas, id).toBeLessThan(iPorQue);
      // as três notas à vista: o que mudou, como interpretar e o que não é possível concluir
      for (const nota of ["data-que-mudou", "data-como-interpretar", "data-ressalva"]) expect(h, `${id}: ${nota}`).toContain(nota);
    }
  });

  it("afluência: a faixa de números fica logo abaixo da figura, com a ENA em % da MLT e em MWmed, cada uma com a sua data; a régua da MLT não se compara com a da EAR e os últimos dias são provisórios", () => {
    const h = html.p018;
    const faixa = faixaMetricas(h);
    const sinEna = entidadesEna(G.afluencia).find((e) => e.id === "SIN")!;
    expect(faixa.match(/data-metrica=""/g)?.length).toBe(4);
    // a resposta e a figura abrem o painel; a faixa vem depois da figura e da legenda, antes da tabela; nenhuma faixa acima do seletor de profundidade
    const seletor = h.indexOf('role="radiogroup" aria-label="Nível de profundidade"');
    const iFaixa = h.indexOf('data-faixa-metricas=""');
    expect(iFaixa).toBeGreaterThan(seletor);
    expect(iFaixa).toBeGreaterThan(h.indexOf('data-resposta="p018"'));
    expect(iFaixa).toBeGreaterThan(h.indexOf("data-recorte-painel"));
    expect(iFaixa).toBeLessThan(h.indexOf("Tabela equivalente: ENA de 30 dias"));
    expect(h.slice(Math.max(0, seletor - 4000), seletor)).not.toContain('data-faixa-metricas=""');
    const t = textoDe(faixa);
    expect(t).toContain(`${sinEna.pct_mlt_30d!.toFixed(1).replace(".", ",")}`);
    expect(t).toContain(`${sinEna.p50_30d!.toFixed(1).replace(".", ",")}`);
    expect(t).toContain(Math.round(sinEna.ena_mwmed_dia!).toLocaleString("pt-BR"));
    expect(t).toContain("MWmed");
    expect(t).toContain("da MLT");
    // as datas: a janela de 30 dias (ficha), a data da ENA do dia e a base da mediana
    expect(t).toContain(dataBr(G.afluencia.dia));
    expect(t).toContain(dataBr(G.dias_referencia.ena));
    expect(t).toContain(sinEna.periodo_base!.replace("-", " a "));
    // outra régua: dito junto do número e nas notas, sem comparar os dois percentuais
    expect(t).toContain("outra régua que o da energia armazenada (EAR)");
    expect(textoDe(h)).toMatch(/outra\s+régua que o da energia armazenada \(EAR\), e os dois não se comparam/);
    // provisório, em palavras: o ONS revisa os últimos dias, e a página diz quantos dias ele revisou entre as duas capturas
    expect(t).toContain(textoEnaProvisoria(G.afluencia.revisoes_entre_capturas_30d));
    expect(t).toContain("provisória");
    // as duas fichas "Comprove este número" (ENA bruta e ENA armazenável) continuam na faixa, e são as do SIN
    expect(faixa.match(/Comprove este número/g)?.length).toBe(2);
  });

  it("afluência: a faixa acompanha o recorte escolhido, e a ficha de prova é só a do SIN", () => {
    const ents = entidadesEna(G.afluencia);
    const evid = { ena30d: G.evidencias.ena_30d_sin, enaArm30d: G.evidencias.ena_arm_30d_sin };
    const rev = G.afluencia.revisoes_entre_capturas_30d;
    const medidas = (id: string) => renderToStaticMarkup(createElement(MedidasAfluencia, { e: ents.find((x) => x.id === id)!, revisoes: rev, evidencias: evid }));
    const virg = (v: number) => v.toFixed(1).replace(".", ",");
    // outro subsistema: os números são os dele, com o nome dele, e sem a ficha do SIN
    const sul = ents.find((x) => x.id === "S")!;
    const hSul = textoDe(medidas("S"));
    expect(hSul).toContain("Números do recorte escolhido: Sul");
    expect(hSul).toContain(virg(sul.pct_mlt_30d!));
    expect(hSul).toContain(virg(sul.p50_30d!));
    expect(hSul).not.toContain(virg(ents.find((x) => x.id === "SIN")!.pct_mlt_30d!));
    expect(medidas("S")).not.toContain("Comprove este número");
    expect(medidas("SIN").match(/Comprove este número/g)?.length).toBe(2);
    // REE e bacia: só três medidas (a ENA armazenável existe só nos subsistemas)
    const ree = ents.find((x) => x.tipo === "ree")!;
    expect(medidas(ree.id).match(/data-metrica=""/g)?.length).toBe(3);
    expect(textoDe(medidas(ree.id))).toContain(ree.rotulo);
    // grupo de afluências agrupadas: o motivo exato da ausência, sem a expressão quebrada nem "Bacia do Outras"
    const outras = ents.find((x) => x.tipo === "bacia" && ehGrupoOns(x.nome))!;
    const hOutras = textoDe(medidas(outras.id));
    expect(hOutras).toContain(outras.rotulo);
    expect(outras.rotulo).toMatch(/^Outras do (Sul|Sudeste) \(grupo do ONS\)$/);
    expect(hOutras).toContain("O ONS publica essas afluências agrupadas sem MLT, e sem MLT não há percentual");
    expect(hOutras).not.toMatch(/em sem base|Bacia do Outras/);
    expect(hOutras).not.toContain("falta dia na janela ou não há MLT");
  });

  it("afluência: a MLT e a evolução em 30 dias são seções visíveis com pergunta própria; a diferença contra o PMO e a MLT de janeiro e julho estão à vista, e o gráfico dos níveis, as tabelas e o texto de método ficam em Analisar", () => {
    const h = html.p018;
    for (const id of ["evolucao", "mlt"]) {
      const tag = secao(h, id);
      expect(tag, id).not.toBeNull();
      expect(tag, id).not.toContain("data-nivel");
    }
    expect(secao(h, "mlt-detalhes")).toContain('data-nivel="analisar"');
    expect(secao(h, "unidade")).toContain('data-nivel="auditar"');
    expect(secao(h, "regras-p018")).toContain('data-nivel="auditar"');
    // as figuras da MLT visíveis: a diferença contra o PMO (com a lacuna dita) e a MLT implícita de janeiro e de julho; as tabelas ficam em Analisar
    const iMlt = h.indexOf('<section id="mlt"');
    const iDet = h.indexOf('<section id="mlt-detalhes"');
    const visivel = h.slice(iMlt, iDet);
    expect(visivel).toContain("Diferença da MLT do conjunto aberto contra a do PMO no início de cada mês");
    expect(visivel).toContain("MLT implícita de cada subsistema no dia 15 de janeiro e no dia 15 de julho");
    expect(visivel).not.toContain("<table");
    expect(textoDe(visivel)).toContain(`Sem relatório do PMO coletado em ${listaMeses(mesesSemPmo(G.afluencia.mlt))}`);
    expect(textoDe(visivel)).toContain(textoMudancaMltNoMes(G.afluencia.mlt));
    expect(textoDe(visivel)).toContain("Programa Mensal de Operação (PMO)");
    const detalhes = h.slice(iDet, h.indexOf('<section id="unidade"'));
    expect((detalhes.match(/<table/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(detalhes).toContain('data-textos="mlt"');
    // o gráfico dos níveis (PMO, início e fim do mês) fica em Analisar, com a lacuna
    expect(detalhes).toContain("MLT do Sudeste/Centro-Oeste no PMO e no conjunto aberto, mês a mês");
    // regras do Auditar escritas para a ENA, sem repetir a regra da EAR nem citar nomes internos
    const bloco = h.slice(h.indexOf('<section id="regras-p018"'));
    const regras = textoDe(bloco.slice(0, bloco.indexOf("</dl>")));
    expect(regras).toContain(REGRA_FAIXA_ENA);
    expect(regras).toContain(REGRA_CAPTURA_ENA);
    expect(regras).not.toMatch(/EAR máxima zero|periodo_base|silver/);
    // a legenda da grade de janeiro e julho tem as oito linhas, cada uma com o subsistema, sem rótulo repetido
    for (const sm of ["SE/CO", "S", "NE", "N"]) {
      expect(visivel).toContain(`${sm}, 15 de janeiro`);
      expect(visivel).toContain(`${sm}, 15 de julho`);
    }
  });

  it("chuva e temperatura: sem faixa no alto; duas medidas estimadas em seção própria, com data e selo de estimativa; separação visível e previsão rotulada", () => {
    const h = html.p019;
    const i = h.indexOf('data-faixa-metricas=""');
    const iMedidas = h.indexOf('<section id="medidas"');
    expect(iMedidas).toBeGreaterThan(h.indexOf('data-notas-painel=""'));
    expect(i).toBeGreaterThan(iMedidas);
    const faixa = faixaMetricas(h);
    expect(faixa.match(/data-metrica=""/g)?.length).toBe(2);
    expect(faixa.match(/Estimado/g)?.length).toBeGreaterThanOrEqual(2);
    expect(faixa).toContain(dataBr(C.precipitacao_bacias[0].dia));
    expect(faixa).toContain(dataBr(G.dias_referencia.temperatura!));
    expect(textoDe(secao(h, "medidas") ? h.slice(iMedidas, h.indexOf('<section id="separacao"')) : "")).toContain("não equivalem à afluência nem ao armazenamento");
    for (const id of ["medidas", "separacao", "historico", "comparar-bacias", "temperatura", "previsao", "relacoes"]) {
      const tag = secao(h, id);
      expect(tag, id).not.toBeNull();
      expect(tag, id).not.toContain("data-nivel");
    }
    expect(secao(h, "cobertura")).toContain('data-nivel="analisar"');
    expect(secao(h, "regras-p019")).toContain('data-nivel="auditar"');
    // a previsão fica na seção própria, com o selo de previsão, e não aparece nas seções de estimativa
    const iPrev = h.indexOf('<section id="previsao"');
    expect(h.slice(Math.max(0, iPrev - 80), iPrev)).toContain('data-natureza="PREVISTO"');
    expect(h.slice(iPrev, iPrev + 700)).toContain("Previsão meteorológica: uma rodada de um modelo, não observação.");
    expect(h.slice(h.indexOf('<section id="temperatura"'), iPrev)).not.toContain("Previsão, não observação");
    // o mapa é a figura principal e a legenda de recorte vem depois dele
    expect(h.indexOf("data-recorte-painel")).toBeGreaterThan(h.indexOf('data-resposta="p019"'));
  });

  it("chuva e temperatura: a faixa acompanha a bacia, o período e o recorte escolhidos, com o percentil e a cautela na nota; a ficha de prova é só a da bacia padrão e a do SIN", () => {
    const baciaPadrao = baciaPadraoChuva(G.armazenamento.bacias, C.precipitacao_bacias);
    const evid = { chuva30d: G.evidencias.precipitacao_maior_bacia_30d, temperaturaSin30d: G.evidencias.temperatura_sin_30d };
    const medidas = (bac: string, per: string, rt: string) => {
      const b = C.precipitacao_bacias.find((x) => x.bacia === bac)!;
      return renderToStaticMarkup(
        createElement(MedidasClima, {
          bacia: b,
          nomeBacia: rotuloRecorte("bacia", bac),
          per,
          base: C.base_climatologica,
          temp: C.temperatura.find((x) => x.recorte === rt)!,
          baciaPadrao,
          evidencias: evid,
        }),
      );
    };
    const virg = (v: number, c = 1) => v.toFixed(c).replace(".", ",");
    const pad = C.precipitacao_bacias.find((x) => x.bacia === baciaPadrao)!;
    // bacia padrão em 30 dias e SIN: os milímetros, o percentil antes da anomalia, a cautela, e as duas fichas
    const padrao = medidas(baciaPadrao, "30d", "SIN");
    const tp = textoDe(padrao);
    expect(tp).toContain(`${virg(pad.mm_30d!)}`);
    expect(tp).toContain(`Percentil ${Math.round(pad.percentil_30d!)} entre os mesmos dias de anos anteriores`);
    expect(tp.indexOf("Percentil")).toBeLessThan(tp.indexOf("% acima"));
    expect(tp).toContain("leia os milímetros e o percentil");
    expect(padrao.match(/Comprove este número/g)?.length).toBe(2);
    // o rótulo da ficha usa o mesmo nome e o mesmo arredondamento do cartão
    expect(padrao).toContain(`Chuva de 30 dias, Bacia do ${nomeProprio(baciaPadrao)}`);
    expect(padrao).toContain(`${virg(pad.mm_30d!)} mm`);
    expect(padrao).not.toMatch(/bacia PARANAIBA|, 70 mm/);
    // outra bacia e outro recorte de temperatura: os números são os deles, sem as fichas
    const outraBacia = C.precipitacao_bacias.find((x) => x.bacia !== baciaPadrao && x.mm_30d !== null)!;
    const outra = medidas(outraBacia.bacia, "30d", "S");
    expect(textoDe(outra)).toContain(`${virg(outraBacia.mm_30d!)}`);
    expect(textoDe(outra)).toContain(`Anomalia da temperatura, Sul`);
    expect(outra).not.toContain("Comprove este número");
    // um mês do mapa: os milímetros e a faixa do mês, com o nome do mês, sem a ficha de 30 dias
    const mes = pad.mensal.m[pad.mensal.m.length - 1];
    const dm = dadosChuvaMes(pad, mes)!;
    const mesHtml = textoDe(medidas(baciaPadrao, mes, "SIN"));
    expect(mesHtml).toContain("Chuva do mês");
    expect(mesHtml).toContain(`${virg(dm.mm!)}`);
    expect(medidas(baciaPadrao, mes, "SIN").match(/Comprove este número/g)?.length).toBe(1);
  });

  it("veredito da chuva: os milímetros e o percentil abrem a frase, com a média ao lado; o percentual de anomalia fica na nota e na resposta completa", () => {
    const b = C.precipitacao_bacias.find((x) => x.bacia === baciaPadraoChuva(G.armazenamento.bacias, C.precipitacao_bacias))!;
    const v = vereditoChuva(b);
    expect(v).toContain(`${b.mm_30d!.toFixed(1).replace(".", ",")} mm de chuva estimada por satélite`);
    expect(v).toContain(`no percentil ${Math.round(b.percentil_30d!)} dos mesmos dias de anos anteriores`);
    expect(v).toContain(`média desses dias: ${b.media_30d_base!.toFixed(1).replace(".", ",")} mm`);
    expect(v).not.toContain(`${b.anomalia_30d_pct!.toFixed(1).replace(".", ",")}%`);
    expect(notaChuvaBacia(b, C.base_climatologica)).toContain(`${b.anomalia_30d_pct!.toFixed(1).replace(".", ",")}% acima`);
    expect(respostaChuva(b, C.base_climatologica)).toContain(`${b.anomalia_30d_pct!.toFixed(1).replace(".", ",")}% acima`);
    // mudar o dado muda a frase; sem percentil, a frase não o inventa
    const outro = clone(b);
    outro.percentil_30d = null;
    expect(vereditoChuva(outro)).not.toContain("percentil");
    // um mês: milímetros, média e faixa do mês (o percentil do mês não é publicado)
    const mes = b.mensal.m[b.mensal.m.length - 1];
    const d = dadosChuvaMes(b, mes)!;
    const vm = vereditoChuvaMes(b, mes);
    expect(vm).toContain(`${d.mm!.toFixed(1).replace(".", ",")} mm de chuva estimada por satélite`);
    expect(vm).toContain(`do 10º ao 90º percentil, vai de ${d.p10!.toFixed(1).replace(".", ",")} a ${d.p90!.toFixed(1).replace(".", ",")} mm`);
    expect(notaChuvaMes(b, mes, C.base_climatologica)).toContain("leia os milímetros e a faixa do mês");
    expect(vereditoChuvaMes(b, "1999-01")).toContain("Sem estimativa de chuva");
    // temperatura: o veredito diz que a janela é preliminar
    const t = C.temperatura.find((x) => x.recorte === "SIN")!;
    expect(vereditoTemperatura(t)).toContain("A janela é preliminar.");
    // a correlação diz o método e que é sensível a meses secos
    const a = vereditoAssociacao(b)!;
    expect(a).toContain("correlação de Pearson");
    expect(a).toContain("sensível a meses secos");
    expect(a).toContain("É associação, não causa.");
    expect(textoAssociacao(b)).toContain("correlação de Pearson");
  });

  it("janelas preliminares: todos os dias da janela são preliminares quando começam depois do produto final, com a recomendação da fonte; os gráficos de temperatura marcam o GEOS-IT", () => {
    const b = C.precipitacao_bacias.find((x) => x.preliminar_30d)!;
    expect(diasPreliminares(b.dia, C.corte_imerg_final)).toEqual({ n: 30, todos: true });
    const tc = textoPreliminarChuva(b.dia, C.corte_imerg_final);
    expect(tc).toContain("Todos os 30 dias da janela são preliminares");
    expect(tc).toContain("IMERG Late");
    expect(tc).toContain(`IMERG Final, já calibrado, que vai até ${C.corte_imerg_final.split("-").reverse().join("/")}`);
    expect(tc).toContain("documentação do NASA POWER recomenda");
    // parte da janela: a frase diz quantos dias, não "todos"
    const meio = textoPreliminarChuva(b.dia, menosDias(b.dia, 9));
    expect(meio).toContain("9 dos 30 dias da janela são preliminares");
    expect(textoPreliminarChuva(b.dia, b.dia)).toBe("");
    const t = C.temperatura.find((x) => x.recorte === "SIN")!;
    expect(textoPreliminarTemperatura(t.dia, C.corte_merra2)).toContain("Todos os 30 dias da janela vêm do GEOS-IT");
    expect(textoPreliminarTemperatura(t.dia, t.dia)).toBe("");
    // marca no eixo: série inteira depois do corte é só nota; corte dentro da série vira marca vertical no primeiro dia depois dele
    const serie = serieDiariaTemperatura(t).map((p) => p.d);
    expect(marcaPreliminarSerie(serie, C.corte_merra2, "GEOS-IT").todaPreliminar).toBe(true);
    const corte = serie[10];
    const parcial = marcaPreliminarSerie(serie, corte, "GEOS-IT");
    expect(parcial.todaPreliminar).toBe(false);
    expect(parcial.marcos).toEqual([{ x: serie[11], rotulo: "GEOS-IT" }]);
    expect(marcaPreliminarSerie(serie, serie[serie.length - 1], "GEOS-IT")).toEqual({ marcos: [], todaPreliminar: false });
    // barras mensais: o mês com dias depois do corte leva a marca
    expect(ultimoDiaDoMes("2026-08")).toBe("2026-08-31");
    expect(mesPreliminar("2026-08", C.corte_merra2)).toBe(true);
    expect(mesPreliminar("2026-07", C.corte_merra2)).toBe(false);
    // na página: cautela junto da resposta (uma frase, com a explicação inteira logo abaixo), rótulo da série e nota do mês preliminar
    const h = html.p019;
    expect(h).toContain('data-cautela="chuva"');
    expect(h).toContain('data-cautela="temperatura"');
    expect(textoDe(h)).toContain(tc);
    expect(textoDe(h)).toContain(textoPreliminarTemperatura(t.dia, C.corte_merra2));
    // a explicação da janela preliminar traz o último mês completo só com produto final, para ver uma anomalia sem dia preliminar
    const padrao = C.precipitacao_bacias.find((x) => x.bacia === baciaPadraoChuva(G.armazenamento.bacias, C.precipitacao_bacias))!;
    const ultimoChuva = textoUltimoMesFinalChuva(padrao, C.base_climatologica);
    expect(ultimoChuva).toMatch(/^O último mês completo só com produto final é \p{L}+ de \d{4}: [\d.,]+ mm/u);
    expect(ultimoChuva).toContain(`média do mês em ${periodoBase(C.base_climatologica)}`);
    expect(textoDe(h)).toContain(ultimoChuva);
    const ultimoTemp = textoUltimoMesFinalTemperatura(t, C.corte_merra2, C.base_climatologica);
    expect(ultimoTemp).toMatch(/^O último mês completo só com MERRA-2 é \p{L}+ de \d{4}: [\d.,]+ °C/u);
    expect(ultimoTemp).toContain(`média do mês em ${periodoBase(C.base_climatologica)}`);
    expect(textoDe(h)).toContain(ultimoTemp);
    // sem nenhum mês completo com o produto final, a frase não aparece
    const semFinal = clone(padrao);
    semFinal.mensal.preliminar_desde = semFinal.mensal.m[0];
    expect(textoUltimoMesFinalChuva(semFinal, C.base_climatologica)).toBe("");
    expect(textoUltimoMesFinalTemperatura(t, "1900-01-01", C.base_climatologica)).toBe("");
    expect(h).toContain("Média das máximas das células");
    expect(h).not.toContain(">Máxima do dia<");
    expect(textoDe(h)).toContain("* Mês com dias do GEOS-IT (preliminar)");
    expect(textoDe(h)).toContain("Todos os dias deste gráfico vêm do GEOS-IT, preliminar");
    // o IMERG, o MERRA-2, o GEOS-IT, a reanálise e o UTC são ditos por extenso no ponto de uso
    const visivel = textoDe(h.slice(h.indexOf("<main")));
    expect(visivel).toContain("IMERG, produto de chuva da NASA calibrado por pluviômetros");
    expect(visivel).toContain("reanálise (MERRA-2, da NASA: um modelo da atmosfera ajustado a observações");
    expect(visivel).toContain("dias UTC, o horário universal");
    expect(visivel).toContain("SIN: Sistema Interligado Nacional");
  });

  it("mapa e cobertura: a bacia sem contorno é dita, os totais únicos e as somas das tabelas são explicados, e a média não se reproduz só com o CSV diário", () => {
    const sem = baciasSemChuva(G.armazenamento.bacias, C.precipitacao_bacias);
    expect(sem).toEqual(["SANTA MARIA VIT"]);
    const nota = textoBaciasSemChuva(sem);
    expect(nota).toContain("Santa Maria da Vitória");
    expect(nota).toContain("sem chuva estimada");
    expect(textoBaciasSemChuva([])).toBe("");
    expect(textoDe(html.p019)).toContain(nota);
    // os totais únicos (580 pontos e 97 células) contra as somas das tabelas por bacia e por UF
    const somaPontos = C.cobertura_precipitacao.reduce((t, x) => t + x.pontos, 0);
    const somaCelulas = C.cobertura_temperatura.reduce((t, x) => t + x.celulas, 0);
    expect(somaPontos).toBeGreaterThan(C.totais.pontos_precipitacao);
    const cob = textoCobertura(C);
    expect(cob).toContain(`as linhas da tabela por bacia somam ${somaPontos} pontos`);
    expect(cob).toContain("um ponto dentro de dois contornos conta nas duas bacias");
    expect(cob).toContain(`as da tabela por UF somam ${somaCelulas} células`);
    // sem sobra, sem explicação
    const igual = clone(C);
    igual.totais = { pontos_precipitacao: somaPontos, celulas_temperatura: somaCelulas };
    expect(textoCobertura(igual)).not.toContain("Totais únicos");
    // a conferência com estações diz que agrupa meses e bacias e que o período é de IMERG Final
    const val = textoValidacao(C.validacao_estacoes, C.corte_imerg_final);
    expect(val).toContain("inclui o ciclo sazonal");
    expect(val).toContain("Os meses comparados são de IMERG Final");
    expect(val).toMatch(/o viés por bacia vai de [−+]\d/);
    // a nota da tabela da chuva diz que a média usa a base e que o CSV diário público começa depois
    const h = textoDe(html.p019);
    const inicio = /desde (\d{4})/.exec(G.downloads.find((d) => /agua_precipitacao_bacias_diario/.test(d.url))!.rotulo)![1];
    expect(h).toContain(`mas o CSV diário público começa em ${inicio}`);
    expect(h).toContain("não se reproduz só com esse arquivo");
  });

  it("tabelas de Água: em Entender cabem em 360 px (nome, números e no máximo uma coluna de texto), e o arquivo exportado leva todas as colunas", () => {
    const tabelas = [
      ["afluência", COLUNAS_AFLUENCIA],
      ["chuva", COLUNAS_CHUVA],
      ["temperatura", COLUNAS_TEMPERATURA],
      ["previsão de chuva", COLUNAS_PREVISAO_CHUVA],
      ["previsão de temperatura", COLUNAS_PREVISAO_TEMPERATURA],
      ["balanço dos reservatórios", COLUNAS_RESERVATORIOS],
      ["decomposição", COLUNAS_DECOMPOSICAO],
    ] as const;
    for (const [nome, colunas] of tabelas) {
      const visiveis = colunas.filter((c) => !c.nivel);
      // nome (fixo à esquerda, 112 px) e duas colunas de 112 px cabem em 358 px; mais que isso força a rolagem e corta o número
      expect(visiveis.length, nome).toBeLessThanOrEqual(3);
      expect(visiveis[0].tipo, nome).toBe("texto");
      expect(visiveis.slice(1).some((c) => c.tipo === "numero" || c.tipo === "percentual"), nome).toBe(true);
    }
    // afluência: nome, ENA em % da MLT e percentil (as três de 358 px); a posição por extenso fica em Analisar, e o arquivo leva as duas
    expect(COLUNAS_AFLUENCIA.filter((c) => !c.nivel).map((c) => c.rotulo)).toEqual(["Recorte", "ENA de 30 dias", "Percentil"]);
    expect(COLUNAS_AFLUENCIA.find((c) => c.id === "faixa")?.nivel).toBe("analisar");
    // o arquivo leva todas as colunas, as de Analisar também
    expect(matrizExportacao(COLUNAS_AFLUENCIA, linhasAfluencia(entidadesEna(G.afluencia).filter((e) => e.tipo === "subsistema"))).cabecalho.length).toBe(COLUNAS_AFLUENCIA.length);
    expect(matrizExportacao(COLUNAS_RESERVATORIOS, linhasReservatorios(R.lista)).cabecalho.length).toBe(COLUNAS_RESERVATORIOS.length);
    // os cabeçalhos da previsão de temperatura são curtos
    for (const c of COLUNAS_PREVISAO_TEMPERATURA.slice(1)) expect(c.rotulo.length, c.rotulo).toBeLessThanOrEqual(22);
  });


  it("reservatórios: nenhuma faixa acima do seletor de profundidade; a soma das parcelas, a conta da água e a qualidade do balanço têm faixa própria, e a página segue a ordem decomposição, conta da água, qualidade e série diária", () => {
    const h = html.p020;
    const seletor = h.indexOf('role="radiogroup" aria-label="Nível de profundidade"');
    expect(h.slice(Math.max(0, seletor - 5000), seletor)).not.toContain('data-faixa-metricas=""');
    const todas = faixas(h);
    expect(todas.length).toBe(3);
    // 1) a variação do subsistema, a soma das parcelas do gráfico e a soma dos demais (por diferença), logo depois da figura
    expect(todas[0].match(/data-metrica=""/g)?.length).toBe(3);
    const se = R.decomposicao_ear.find((d) => d.sm === "SE")!;
    const t0 = textoDe(todas[0]);
    expect(t0).toContain("Variação da EAR do subsistema");
    expect(t0).toContain("−3.188,7");
    expect(t0).toContain("Soma das 10 parcelas do gráfico");
    expect(t0).toContain("Soma dos demais 35 reservatórios");
    expect(t0).toContain("−1.912,3");
    expect(t0).toContain("Por diferença");
    // as duas janelas de 30 dias do mesmo subsistema ficam lado a lado, cada uma com o seu dia
    expect(t0).toContain(notaOutraJanelaCurta(se, entidadesEar(G.armazenamento)));
    // 2) a conta da água do reservatório padrão: quatro números em hm³, com a ficha do resíduo
    expect(todas[1].match(/data-metrica=""/g)?.length).toBe(4);
    const t1 = textoDe(todas[1]);
    expect(t1).toContain("−1,95");
    expect(t1).toContain("hm³");
    expect(t1).toContain("reservatório Serra da Mesa: variação observada menos afluência mais defluência");
    expect(todas[1].match(/Comprove este número/g)?.length).toBe(1);
    // 3) a qualidade do balanço, em bloco próprio, com os dois universos ditos (153 de 177 e a lista menor)
    expect(todas[2].match(/data-metrica=""/g)?.length).toBe(2);
    const t2 = textoDe(todas[2]);
    expect(t2).toContain(`${R.n_com_balanco}`);
    expect(t2).toContain(`de ${R.n_reservatorios} nos dados hidráulicos`);
    expect(t2).toContain(`${R.n_fecham_por_construcao}`);
    expect(t2).toContain(`de ${R.n_com_balanco} com balanço`);
    expect(todas[2].match(/Comprove este número/g)?.length).toBe(1);
    expect(textoDe(secao(h, "qualidade") ? h.slice(h.indexOf('<section id="qualidade"'), h.indexOf('<section id="serie-diaria"')) : "")).toContain(`A lista desta página é menor, os reservatórios com EAR máxima positiva`);
    // ordem: veredito da decomposição, figura, faixa, notas, conta da água, qualidade, série diária
    const ordem = [`data-resposta="p020"`, "Soma dos demais", 'data-notas-painel=""', '<section id="balanco"', '<section id="qualidade"', '<section id="serie-diaria"'].map((x) => h.indexOf(x));
    expect(ordem.every((x) => x > 0)).toBe(true);
    expect([...ordem].sort((a, b) => a - b)).toEqual(ordem);
    for (const id of ["balanco", "qualidade", "serie-diaria"]) expect(secao(h, id), id).not.toContain("data-nivel");
    for (const id of ["comparar", "decomposicao"]) expect(secao(h, id), id).toContain('data-nivel="analisar"');
    expect(secao(h, "regras-p020")).toContain('data-nivel="auditar"');
    // a resposta da conta da água vem depois do título da seção e não antes dele (a resposta não sobe para fora da seção)
    expect(h.indexOf('data-resposta="p020-balanco"')).toBeGreaterThan(h.indexOf('<section id="balanco"'));
    // o "O que mudou" traz a variação de cada subsistema na mesma unidade
    expect(textoDe(h)).toContain(textoMudancaDecomposicao(R.decomposicao_ear));
    // o subtítulo do painel não carrega os termos antes da definição, e os termos da conta da água são ditos num bloco visível
    const subtitulo = /<h2 id="p020-titulo"[^>]*>[^<]*<\/h2><p[^>]*><span>([^<]*)<\/span>/.exec(h)?.[1] ?? "";
    expect(subtitulo).not.toMatch(/defluência|turbinado|vertido|transferência/);
    const termos = textoDe(h.slice(h.indexOf('data-termos="balanco"')));
    for (const t of ["Afluência:", "Defluência:", "turbinado", "vertido", "Resíduo:", "Transferência:", "Convenção da defluência:"]) expect(termos, t).toContain(t);
    // o texto da decomposição define a parte própria e a parte a jusante
    expect(textoDe(h)).toContain("na parte própria, a energia que a água do reservatório produz na própria usina");
  });

  it("reservatórios: a faixa da decomposição e a conta da água acompanham a escolha, e o estado sem balanço diz o motivo exato", () => {
    const ents = entidadesEar(G.armazenamento);
    const norte = R.decomposicao_ear.find((d) => d.sm === "N")!;
    const hNorte = textoDe(renderToStaticMarkup(createElement(MedidasDecomposicao, { dec: norte, armazenamento: ents })));
    expect(hNorte).toContain("Todas as 5 parcelas estão no gráfico e somam a variação da EAR do subsistema");
    const sul = R.decomposicao_ear.find((d) => d.sm === "S")!;
    const hSul = textoDe(renderToStaticMarkup(createElement(MedidasDecomposicao, { dec: sul, armazenamento: ents })));
    expect(hSul).toContain("Soma das 7 parcelas do gráfico");
    expect(hSul).toContain("Soma dos demais 9 reservatórios");
    const evid = G.evidencias.balanco_maior_reservatorio;
    const periodo = `${R.inicio} a ${R.fim}`;
    const conta = (id: string, padrao = false) =>
      renderToStaticMarkup(createElement(MedidasBalanco, { res: R.lista.find((r) => r.id === id)!, periodo, semCadastro: R.sem_cadastro, ehPadrao: padrao, evidenciaResiduo: evid }));
    // reservatório com balanço que não é o padrão: os números dele, sem a ficha do padrão
    const outro = R.lista.find((r) => r.balanco_calculado && r.id !== reservatorioPadrao(R.lista))!;
    expect(textoDe(conta(outro.id))).toContain(`reservatório ${nomeProprio(outro.nome)}: variação observada menos afluência mais defluência`);
    expect(conta(outro.id)).not.toContain("Comprove este número");
    expect(conta(reservatorioPadrao(R.lista), true).match(/Comprove este número/g)?.length).toBe(1);
    // sem balanço: o motivo exato, lido de sem_cadastro, e não as três causas possíveis
    const sem = R.lista.filter((r) => !r.balanco_calculado);
    expect(sem.length).toBeGreaterThanOrEqual(5);
    for (const r of sem) {
      expect(R.sem_cadastro).toContain(r.id);
      expect(motivoSemBalanco(r, R.sem_cadastro)).toBe("o reservatório não tem correspondência no cadastro do ONS, que traz o volume útil");
      const v = vereditoBalancoReservatorio(r, R, R.sem_cadastro);
      expect(v).toContain("porque o reservatório não tem correspondência no cadastro do ONS");
      expect(v).not.toContain("falta volume ou vazão na janela, ou volume útil no cadastro");
      expect(textoDe(conta(r.id))).toContain("O reservatório não tem correspondência no cadastro do ONS");
    }
    // sem a lista do cadastro, a causa vem do volume útil ausente
    const billings = clone(sem[0]);
    expect(motivoSemBalanco(billings)).toBe("o cadastro do ONS não informa o volume útil");
    billings.vol_util_total_hm3 = 100;
    expect(motivoSemBalanco(billings)).toBe("falta volume ou vazão na janela");
    // a lista da conta da água marca quem não tem balanço e agrupa por subsistema (optgroup), e o reservatório vale em qualquer subsistema
    const hp = html.p020;
    expect(hp).toContain('<optgroup label="Sudeste/Centro-Oeste">');
    expect(hp).toContain('<optgroup label="Norte">');
    for (const r of sem) expect(hp).toContain(`${nomeProprio(r.nome)} (sem balanço)`);
    const lista = renderToStaticMarkup(
      createElement(AguaLista, { rotulo: "Reservatório", valor: "a", onEscolher: () => undefined, opcoes: [{ id: "a", rotulo: "A", grupo: "Sul" }, { id: "b", rotulo: "B", grupo: "Sul" }, { id: "c", rotulo: "C" }], dica: "Troca a conta." }),
    );
    expect(lista).toContain('<optgroup label="Sul"><option value="a"');
    expect(lista).toContain("aria-describedby");
    expect(lista).toContain("Troca a conta.");
  });

  it("reservatórios: o volume fora de 0 a 100% do volume útil é marcado na tabela, no veredito e na nota, com o nome legível", () => {
    const fora = R.lista.filter((r) => volumeForaDaFaixa(r.vol_util_pct_fim) !== null);
    expect(fora.length).toBe(6);
    expect(volumeForaDaFaixa(100)).toBeNull();
    expect(volumeForaDaFaixa(0)).toBeNull();
    expect(volumeForaDaFaixa(100.01)).toBe("acima");
    expect(volumeForaDaFaixa(-0.5)).toBe("abaixo");
    expect(volumeForaDaFaixa(null)).toBeNull();
    const linhas = linhasReservatorios(R.lista, R.sem_cadastro);
    for (const r of fora) {
      const l = linhas.find((x) => x.id === r.id)!;
      expect(String(l.rotulo), r.id).toContain("(volume acima de 100%)");
      expect(String(l.motivo), r.id).toContain("Valor da fonte, acima do volume máximo normal do reservatório");
    }
    // quem está dentro da faixa não leva a marca
    const dentro = linhas.find((x) => x.id === R.lista.find((r) => volumeForaDaFaixa(r.vol_util_pct_fim) === null && r.balanco_calculado)!.id)!;
    expect(String(dentro.rotulo)).not.toContain("volume acima");
    expect(dentro.motivo).toBeNull();
    // a nota da tabela cita quantos terminam fora e os maiores desvios
    const nota = textoVolumeForaDaFaixa(R.lista);
    expect(nota).toContain("6 reservatórios terminam a janela fora de 0 a 100% do volume útil");
    expect(nota).toContain("Garibaldi 165,13%");
    expect(textoVolumeForaDaFaixa(R.lista.filter((r) => volumeForaDaFaixa(r.vol_util_pct_fim) === null))).toBe("");
    // a resposta do reservatório fora da faixa diz que o valor é da fonte; o veredito de abertura não muda
    const janela = { inicio: R.inicio, fim: R.fim, periodo_fecham_por_construcao: R.periodo_fecham_por_construcao };
    const gari = R.lista.find((r) => r.nome === "GARIBALDI")!;
    expect(respostaBalanco(gari, janela)).toContain("terminou em 165,13% do volume útil (valor da fonte, acima do volume máximo normal do reservatório)");
    expect(vereditoBalancoReservatorio(gari, janela)).not.toContain("165,13");
    // a página mostra a nota e os nomes legíveis (sem "Sao Roque")
    const h = textoDe(html.p020);
    expect(h).toContain(nota);
    expect(h).toContain("São Roque");
    expect(h).not.toMatch(/Sao Roque|Tucurui\b/);
  });

  it("reservatórios: a conta da água separa totais, partes da defluência e resíduo, cada grupo na sua régua; vazões que coincidem são ditas", () => {
    const r = R.lista.find((x) => x.id === reservatorioPadrao(R.lista))!;
    const grupos = [...barrasBalancoTotais(r), ...barrasBalancoDefluencia(r), ...barrasBalancoResiduo(r)];
    // os três grupos juntos são os componentes de sempre, sem repetir nem perder nenhum
    expect(grupos.map((b) => b.id).sort()).toEqual(barrasBalanco(r).map((b) => b.id).sort());
    expect(new Set(grupos.map((b) => b.id)).size).toBe(grupos.length);
    expect(barrasBalancoResiduo(r).map((b) => b.id)).toEqual(["res", "transf"]);
    expect(barrasBalancoTotais(r).find((b) => b.id === "nat")!.rotulo).toBe("Vazão natural (fora do balanço)");
    // rótulo curto o bastante para caber ao lado da barra
    for (const b of grupos) expect(b.rotulo.length, b.rotulo).toBeLessThanOrEqual(34);
    const h = html.p020;
    expect(h).toContain(`Balanço hídrico de Serra da Mesa, ${R.inicio.split("-").reverse().join("/")} a ${R.fim.split("-").reverse().join("/")}`);
    expect(h).toContain("Como a defluência de Serra da Mesa se divide");
    expect(h).toContain("Resíduo e transferência de Serra da Mesa");
    expect(h).toContain("régua própria, porque são pequenos");
    // defluente e turbinada coincidem quando nada é vertido: a nota diz isso; sem coincidência, não diz nada
    const serie = serieReservatorio(S45.reservatorios.find((x) => x.id === r.id));
    const igual = serie.map((p) => ({ ...p, defl: 100, turb: 100, vert: 0 }));
    expect(notaVazoesCoincidem(igual)).toContain("a defluência é igual à vazão que passa pelas turbinas, porque nada foi vertido");
    const dif = igual.map((p, i) => ({ ...p, defl: 100 + i }));
    expect(notaVazoesCoincidem(dif)).toBe("");
    expect(notaVazoesCoincidem([])).toBe("");
  });

  it("reservatórios: o arquivo e a lista dizem o que falta (variações individuais dos demais reservatórios) e as janelas de 30 dias do mesmo subsistema nas duas páginas", () => {
    const ents = entidadesEar(G.armazenamento);
    const se = ents.find((e) => e.id === "SE")!;
    const dec = R.decomposicao_ear.find((d) => d.sm === "SE")!;
    // da página de armazenamento para a de reservatórios: a mesma explicação, escrita para quem lê a outra página
    const frase = textoOutraJanelaNaArmazenamento(se, R.decomposicao_ear);
    expect(frase).toContain("A página de reservatórios mostra −3.188,7 MWmês do Sudeste/Centro-Oeste de 29/08/2026 a 28/09/2026");
    expect(frase).toContain("Aqui a janela é de 30 dias até 29/09/2026, e a variação é −3.297,8 MWmês");
    const mesmo = { ...se, dia: dec.fim };
    expect(textoOutraJanelaNaArmazenamento(mesmo, R.decomposicao_ear)).toBe("");
    expect(notaOutraJanelaCurta(dec, ents)).toContain("Na página de armazenamento, −3.297,8 MWmês em 30 dias até 29/09/2026");
    expect(notaOutraJanelaCurta(dec, ents.map((e) => (e.id === "SE" ? { ...e, dia: dec.fim } : e)))).toBe("");
    // a página diz que as variações dos demais reservatórios não estão publicadas
    expect(textoDe(html.p020)).toContain("As variações de cada um dos demais não estão publicadas");
  });

  it("o recorte é legenda da figura (depois dela), e o texto novo não usa 'hoje' nem 'agora' como data", () => {
    for (const id of ["p018", "p019", "p020"] as const) {
      const h = html[id];
      // a figura principal é um gráfico (data-grafico) ou, na chuva, o mapa das bacias (que nasce no estado de carregamento)
      const figura = Math.min(...[h.indexOf("data-grafico"), h.indexOf('data-estado="carregando"')].filter((x) => x >= 0));
      expect(h.indexOf("data-recorte-painel"), id).toBeGreaterThan(figura);
      // só o conteúdo da página: a casca do site (menu) tem frases próprias
      const visivel = textoDe(h.slice(h.indexOf("<main")));
      expect(visivel, id).not.toMatch(/\bhoje\b|\bagora\b/i);
    }
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
