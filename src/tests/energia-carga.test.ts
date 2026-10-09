/* eslint-disable @typescript-eslint/no-explicit-any -- varredura genérica da gold publicada */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PaginaNivel from "@/app/setor-eletrico/carga/page";
import PaginaPerfil from "@/app/setor-eletrico/carga/perfil-horario/page";
import PaginaClima from "@/app/setor-eletrico/carga/clima-e-calendario/page";
import { CargaIndisponivel } from "@/components/energia/CargaPagina";
import {
  COLUNAS_ANUAL,
  COLUNAS_COMPARACAO,
  COLUNAS_COMPARACOES_TODAS,
  COLUNAS_MENSAL,
  JANELAS,
  PAINEIS_CARGA,
  REGIOES,
  barrasDecomposicao,
  decomposicaoEscolhida,
  diasNoAno,
  horaModal,
  linhasAnual,
  linhasComparacao,
  linhasComparacoesTodas,
  linhasEvolucao,
  linhasMensal,
  linhasMmgdMensal,
  linhasPerfil,
  linhasRecente,
  linhasRecenteModelo,
  linhasRespostaTemperatura,
  linhasSensibilidade,
  marcosRegimes,
  matrizHoraPico,
  paraTabela,
  perfilEscolhido,
  respostaAcumulado,
  respostaClima,
  respostaDecomposicao,
  respostaNivel,
  respostaPerfil,
  respostaPerfilTipico,
  respostaUltimoDia,
  rotaPainel,
  serieColunar,
  serieComReferencia,
  situacaoAtualidade,
  textoClasses,
  textoDefasagemTemperatura,
  textoRevisoes,
  anosPadraoEvolucao,
  ultimoMesCompletoMmgd,
  deslocaDias,
  linhasHoraPicoApi,
  parentesesMmgd,
  recorteEvolucao,
  regimeDoMes,
  textoAvisoRegimes,
  textoDiferencaHoraria,
  textoMesCorrente,
  textoQuebraCurva,
} from "@/lib/energia/carga";
import { dataBR, mesAno } from "@/lib/energia/formato";
import { problemasEvidencia, type Evidencia } from "@/lib/energia/evidencia";
import { DESTINOS_NAVEGACAO } from "@/lib/energia/navegacao";
import { matrizExportacao } from "@/lib/energia/tabela";
import type { CargaGold } from "@/lib/energia/tipos";
import type { CargaDetalheGold } from "@/lib/energia/tipos-carga";

/**
 * Páginas de Carga (P025, P026 e P027): contrato da gold de detalhe, equivalência entre
 * gráfico, tabela e exportação (as mesmas linhas, conferidas contra os CSV publicados
 * pelo pipeline, por caminho independente: recontagem, soma ou leitura de outro
 * arquivo), textos derivados dos números (mudar o número muda o texto) e renderização
 * no servidor das três páginas com a anatomia da seção 7.2.
 */
const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
const G: CargaDetalheGold = JSON.parse(ler("public/energia/gold/carga_detalhe.json"));
const C: CargaGold = JSON.parse(ler("public/energia/gold/carga.json"));
const clone = <T,>(x: T): T => structuredClone(x);

function csv(nome: string): Record<string, string>[] {
  const linhas = ler(`public/energia/series/${nome}`).replace(/^﻿/, "").split(/\r?\n/).filter(Boolean);
  const cab = linhas[0].split(";");
  return linhas.slice(1).map((l) => {
    const c = l.split(";");
    return Object.fromEntries(cab.map((h, i) => [h, c[i] ?? ""]));
  });
}
const n = (s: string | undefined) => (s === undefined || s === "" ? null : Number(s));

function objetos(o: any, teste: (x: any) => boolean, out: any[] = []): any[] {
  if (Array.isArray(o)) o.forEach((x) => objetos(x, teste, out));
  else if (o && typeof o === "object") {
    if (teste(o)) out.push(o);
    Object.values(o).forEach((v) => objetos(v, teste, out));
  }
  return out;
}

/* ---------- contrato da gold ---------- */

describe("contrato da gold carga_detalhe.json", () => {
  it("cabeçalho, disponibilidade, os três painéis e os achados", () => {
    expect(G.dominio).toBe("energia");
    expect(G.gold).toBe("carga_detalhe.json");
    expect(G.disponivel).toBe(true);
    expect(G.dia_referencia).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(G.unidade).toBe("MWmed");
    for (const b of ["p025", "p026", "p027", "a07", "a11_carga"] as const) expect(G[b], b).toBeTruthy();
    expect(G.p025.comparacoes.janelas.map((j) => j.id)).toEqual([...JANELAS]);
    expect(G.p025.comparacoes.subsistemas.map((s) => s.sm).sort()).toEqual([...REGIOES].sort());
  });

  it("toda proveniência tem natureza, fonte com URL e licença, período, snapshot e limitações; calculado tem fórmula; download existe", () => {
    const provs = objetos(G.proveniencia, (x) => "natureza" in x && "fonte" in x && "limitacoes" in x);
    expect(provs.length).toBe(5);
    for (const p of provs) {
      expect(["OBSERVADO", "CALCULADO", "ESTIMADO", "PREVISTO", "CENARIO"], p.indicador).toContain(p.natureza);
      expect(p.fonte.url_dataset ?? p.fonte.url_primaria, p.indicador).toMatch(/^https:\/\//);
      expect(p.fonte.licenca, p.indicador).toBeTruthy();
      expect(p.periodo_referencia.inicio && p.periodo_referencia.fim, p.indicador).toBeTruthy();
      expect(p.snapshot.sha256, p.indicador).toMatch(/^[0-9a-f]{64}$/);
      expect(p.limitacoes.length, p.indicador).toBeGreaterThan(0);
      if (p.natureza === "CALCULADO") expect(p.formula, p.indicador).toBeTruthy();
      if (p.download) expect(existsSync(join(raiz, "public", p.download)), p.download).toBe(true);
    }
    // MMGD é estimativa da fonte (seção 11.3): a natureza vai série a série
    const nat = Object.fromEntries(G.proveniencia.api.natureza_por_serie.map((s) => [s.serie, s.natureza]));
    expect(nat).toEqual({ mmgd: "ESTIMADO", liquida: "OBSERVADO", global: "OBSERVADO" });
    expect(G.proveniencia.api.natureza_por_serie.find((s) => s.serie === "global")!.componentes[0].natureza).toBe("ESTIMADO");
  });

  it("as cinco fichas 'Comprove este número' passam na verificação da interface", () => {
    const evs = Object.values(G.evidencias) as Evidencia[];
    expect(Object.keys(G.evidencias).sort()).toEqual(["a07_reproducao", "p025_7d_equivalente", "p026_mmgd_mes", "p026_pico_sin", "p027_mape_sin"]);
    for (const e of evs) expect(problemasEvidencia(e), e.indicador).toEqual([]);
  });

  it("downloads declarados existem e são pequenos o bastante (até 5 MB)", () => {
    for (const d of [...G.downloads, ...C.downloads]) {
      const p = join(raiz, "public", d.url);
      expect(existsSync(p), d.url).toBe(true);
      expect(readFileSync(p).length, d.url).toBeLessThan(5_000_000);
    }
  });

  it("variação só no mesmo regime e coerente com as médias publicadas (tolerância do arredondamento a 0,1 MWmed)", () => {
    for (const s of G.p025.comparacoes.subsistemas) {
      for (const j of JANELAS) {
        for (const t of ["mesmas_datas", "equivalente"] as const) {
          const c = s.janelas[j][t];
          if (!c) continue;
          if (!c.mesmo_regime) expect(c.variacao_pct, `${s.sm} ${j} ${t}`).toBeNull();
          if (c.variacao_pct === null) continue;
          const tol = 0.006 + 100 * (0.05 / c.media_ant + (0.05 * c.media) / c.media_ant ** 2);
          expect(Math.abs(100 * (c.media / c.media_ant - 1) - c.variacao_pct), `${s.sm} ${j} ${t}`).toBeLessThanOrEqual(tol);
        }
      }
    }
  });

  it("carga verificada: carga global = líquida + MMGD em toda hora recente (valores inteiros: até 1,5 MWmed)", () => {
    let horas = 0;
    for (const h of G.p026.recente) {
      if (h.global === null || h.mmgd === null || h.liquida === null) continue;
      horas++;
      expect(Math.abs(h.global - h.liquida - h.mmgd), h.h).toBeLessThanOrEqual(1.5);
    }
    expect(horas).toBeGreaterThanOrEqual(24 * 6);
  });

  it("decomposição fecha: partes do modelo somam o previsto e, com o resíduo, o real (duas casas)", () => {
    for (const d of G.a07.decomposicao) {
      const soma = Object.values(d.contribuicoes_log100).reduce((a, b) => a + b, 0);
      expect(Math.abs(soma - d.previsto_log100), `${d.sm} ${d.variante} ${d.comparacao}`).toBeLessThanOrEqual(0.03);
      expect(Math.abs(d.previsto_log100 + d.residuo_log100 - d.real_log100), `${d.sm} ${d.variante}`).toBeLessThanOrEqual(0.02);
    }
    const p = G.p027!;
    for (const r of REGIOES) {
      expect(p.metricas[r].cobertura_80_pct).toBeGreaterThan(0);
      expect(p.metricas[r].cobertura_95_pct).toBeLessThanOrEqual(100);
    }
  });

  it("nenhum texto publicado diz que a MMGD entrou 'desde 29/04/2023' nem atribui causa", () => {
    const t = JSON.stringify(G);
    expect(t).not.toMatch(/desde 29\/04\/2023/);
    expect(t).not.toMatch(/causad[ao] pela|explicad[ao] pela temperatura|por causa da atividade/i);
  });
});

/* ---------- P025: gráfico, tabela e exportação ---------- */

describe("P025: gráfico, tabela e exportação usam as mesmas linhas", () => {
  const P = G.p025;

  it("pontos pareados e tabela equivalente: a mesma linha por janela, para toda região e tipo", () => {
    for (const sm of REGIOES) {
      for (const tipo of ["equivalente", "mesmas_datas"] as const) {
        const ls = linhasComparacao(P, sm, tipo);
        expect(ls.map((l) => l.janela)).toEqual([...JANELAS]);
        const tabela = paraTabela(ls.map((l) => ({ ...l, id: l.janela })));
        const m = matrizExportacao(COLUNAS_COMPARACAO, tabela);
        const iMedia = COLUNAS_COMPARACAO.findIndex((c) => c.id === "media");
        const iAnt = COLUNAS_COMPARACAO.findIndex((c) => c.id === "media_ant");
        ls.forEach((l, i) => {
          const g = P.comparacoes.subsistemas.find((x) => x.sm === sm)!.janelas[l.janela][tipo];
          expect(m.linhas[i][iMedia], `${sm} ${l.janela}`).toBe(g?.media ?? null);
          expect(m.linhas[i][iAnt], `${sm} ${l.janela}`).toBe(g?.media_ant ?? null);
        });
      }
    }
  });

  it("todas as comparações são as linhas de carga_comparacoes.csv (mesmos números)", () => {
    const linhas = linhasComparacoesTodas(P);
    const arquivo = csv("carga_comparacoes.csv");
    expect(linhas.length).toBe(arquivo.length);
    for (const r of arquivo) {
      const l = linhas.find((x) => x.sm === r.submercado && x.janela === r.janela && x.tipo === r.tipo)!;
      expect(l, `${r.submercado} ${r.janela} ${r.tipo}`).toBeTruthy();
      expect(l.media).toBe(n(r.media_mwmed));
      expect(l.media_ant).toBe(n(r.media_ant_mwmed));
      expect(l.variacao_pct).toBe(n(r.variacao_pct));
      expect(l.dias_uteis).toBe(n(r.dias_uteis));
      expect(l.dias_uteis_ant).toBe(n(r.dias_uteis_ant));
      expect(l.inicio_ant).toBe(r.inicio_ant);
    }
    expect(matrizExportacao(COLUNAS_COMPARACOES_TODAS, paraTabela(linhas)).linhas.length).toBe(arquivo.length);
  });

  it("referência de 364 dias procurada pela data: confere com carga_diaria.csv (outro arquivo, 4 casas)", () => {
    const col = serieColunar(C.serie);
    expect(col.d.length).toBe(C.serie.length);
    const diario = new Map(csv("carga_diaria.csv").map((r) => [r.data, r]));
    for (const sm of ["SIN", "NE"] as const) {
      const s = serieComReferencia(col, sm);
      const ult = s[s.length - 1];
      const ref = diario.get("2025-09-29")!;
      expect(ult.d).toBe(C.dia_referencia);
      // carga.json arredonda a MWmed inteiro; o CSV tem quatro casas
      expect(Math.abs(ult.ref364! - n(sm === "SIN" ? ref.SIN_calculado : ref[sm])!), sm).toBeLessThanOrEqual(0.5);
      // o primeiro ano da série não tem par 364 dias antes: ausência, nunca zero
      expect(s[0].ref364).toBeNull();
    }
    // um dia ausente no meio não desloca o par: a busca é por data
    const furada = serieColunar(C.serie.filter((p) => p.d !== "2026-01-15"));
    const s2 = serieComReferencia(furada, "SIN");
    const alvo = s2.find((p) => p.d === "2027-01-14" || p.d === "2026-09-28")!;
    expect(alvo.ref364).toBe(serieComReferencia(col, "SIN").find((p) => p.d === alvo.d)!.ref364);
  });

  it("mensal e anual: gráfico e tabela com as mesmas linhas; variação anual nula fora de ano completo no mesmo regime", () => {
    const m = linhasMensal(P);
    expect(m.length).toBe(P.mensal.length);
    const mat = matrizExportacao(COLUNAS_MENSAL, paraTabela(m));
    const iVar = COLUNAS_MENSAL.findIndex((c) => c.id === "var_SIN");
    m.forEach((l, i) => expect(mat.linhas[i][iVar]).toBe(l.var_SIN));
    const a = linhasAnual(P);
    const matA = matrizExportacao(COLUNAS_ANUAL, paraTabela(a));
    expect(matA.linhas.length).toBe(P.anual.length);
    for (const l of a) {
      const g = P.anual.find((x) => String(x.ano) === l.ano)!;
      if (!g.completo || g.regimes.length > 1) expect(l.var_SIN, l.ano).toBeNull();
      expect(l.rotulo.includes("dias"), l.ano).toBe(!g.completo);
    }
  });

  it("marcos de regime só dentro do período, com a data observada da MMGD", () => {
    const m = marcosRegimes(G.regimes, "2000-01-01", "2026-09-28");
    expect(m.map((x) => x.x)).toEqual(["2021-03-01", "2023-04-29", "2023-05-01"]);
    expect(marcosRegimes(G.regimes, "2023-09-29", "2026-09-28")).toEqual([]);
    expect(marcosRegimes(G.regimes, "2000-01", "2026-09", "mes").map((x) => x.x)).toEqual(["2021-03", "2023-04", "2023-05"]);
  });
});

/* ---------- P026 ---------- */

describe("P026: gráfico, tabela e exportação usam as mesmas linhas", () => {
  const P = G.p026;

  it("últimas horas: curva igual a carga_horaria.csv e API igual a carga_verificada_horaria.csv (até 0,5 MWmed)", () => {
    const rec = linhasRecente(P);
    const curva = new Map(csv("carga_horaria.csv").filter((r) => r.data_hora >= rec[0].h).map((r) => [r.data_hora, r]));
    const api = new Map(csv("carga_verificada_horaria.csv").filter((r) => r.data_hora >= rec[0].h).map((r) => [r.data_hora, r]));
    let conferidas = 0;
    for (const h of rec) {
      const c = curva.get(h.h);
      const a = api.get(h.h);
      if (c && h.SIN !== null && h.SIN !== undefined) {
        expect(Math.abs(h.SIN - n(c.SIN)!), h.h).toBeLessThanOrEqual(0.5);
        conferidas++;
      }
      if (a && h.liquida !== null && h.liquida !== undefined) expect(Math.abs(h.liquida - n(a.liquida_SIN)!), h.h).toBeLessThanOrEqual(0.5);
    }
    expect(conferidas).toBeGreaterThanOrEqual(24 * 6);
  });

  it("perfil típico: as 24 linhas do gráfico e da tabela são as de carga_perfil_tipico.csv", () => {
    const pf = perfilEscolhido(P.perfil_sin_12m, "2026-08", "util")!;
    expect(pf.mes).toBe("2026-08");
    const ls = linhasPerfil(pf);
    const arq = csv("carga_perfil_tipico.csv").filter((r) => r.mes === "2026-08" && r.submercado === "SIN" && r.classe_dia === "util");
    expect(arq.length).toBe(24);
    for (const r of arq) {
      const l = ls[Number(r.hora)];
      expect(l.carga).toBe(n(r.carga_mwmed));
      expect(l.liquida).toBe(n(r.carga_liquida_mwmed));
      expect(l.mmgd).toBe(n(r.mmgd_mwmed));
      expect(l.global).toBe(n(r.carga_global_mwmed));
    }
    // mês ou classe inválidos caem num perfil publicado, nunca num vazio
    expect(perfilEscolhido(P.perfil_sin_12m, "1999-01", "util")).not.toBeNull();
  });

  it("hora do pico por ano: a matriz do mapa de calor é a recontagem de carga_pico_diario.csv", () => {
    const cont = new Map<number, number[]>();
    for (const r of csv("carga_pico_diario.csv")) {
      if (r.submercado !== "SIN" || r.hora_pico === "") continue;
      const a = Number(r.data.slice(0, 4));
      if (!cont.has(a)) cont.set(a, Array(24).fill(0));
      cont.get(a)![Number(r.hora_pico)]++;
    }
    const m = matrizHoraPico(P, "SIN");
    expect(m.anos.length).toBe(cont.size);
    m.anos.forEach((a, i) => expect(m.valores[i], a.id).toEqual(cont.get(Number(a.id))));
    // recorte desde o primeiro ano da carga verificada: mesmas linhas, só menos anos
    const desde = P.hora_pico_api_sin_por_ano[0].ano;
    const r = matrizHoraPico(P, "SIN", desde);
    expect(r.anos[0].id).toBe(String(desde));
    expect(r.valores).toEqual(m.valores.slice(m.anos.findIndex((a) => a.id === String(desde))));
    // ano incompleto (bissexto incluído) leva a contagem de dias no rótulo
    for (const a of m.anos) expect(a.rotulo.includes("dias"), a.id).toBe(a.dias < diasNoAno(Number(a.id)));
  });

  it("MMGD mensal: razão de somas refeita de carga_verificada_diaria.csv (mês completo, até 0,01 ponto)", () => {
    const ult = ultimoMesCompletoMmgd(P, "SIN")!;
    const dias = csv("carga_verificada_diaria.csv").filter((r) => r.submercado === "SIN" && r.data.startsWith(ult.m));
    expect(dias.length).toBe(ult.dias_no_mes);
    expect(dias.every((r) => r.horas === "24")).toBe(true);
    const pct = (100 * dias.reduce((s, r) => s + n(r.mmgd_mwmed)!, 0)) / dias.reduce((s, r) => s + n(r.carga_global_mwmed)!, 0);
    expect(Math.abs(pct - ult.mmgd_pct)).toBeLessThanOrEqual(0.01);
    // a evidência prova o mesmo mês
    expect(G.evidencias.p026_mmgd_mes!.periodo.inicio.slice(0, 7)).toBe(ult.m);
    const largas = linhasMmgdMensal(P);
    expect(largas.find((l) => l.mes === ult.m)!.SIN).toBe(ult.mmgd_pct);
    // mês incompleto na tabela = algum subsistema com menos dias que o mês na gold (o primeiro mês da API e o corrente)
    for (const l of largas) expect(l.parcial, l.mes).toBe(P.mmgd_mensal.some((x) => x.m === l.mes && x.dias < x.dias_no_mes));
  });

  it("evolução: só os anos escolhidos, padrão com o primeiro e o último ano", () => {
    const anos = P.perfil_evolucao.map((x) => x.mes.slice(0, 4));
    const padrao = anosPadraoEvolucao(anos);
    expect(padrao.length).toBe(4);
    expect(padrao[0]).toBe(anos[0]);
    expect(padrao[3]).toBe(anos[anos.length - 1]);
    const ls = linhasEvolucao(P, ["2019", "2026"], "liquida");
    expect(ls.length).toBe(24);
    expect(Object.keys(ls[0]).sort()).toEqual(["2019", "2026", "hora", "id"]);
    expect(ls[12]["2026"]).toBe(P.perfil_evolucao.find((x) => x.mes.startsWith("2026"))!.liquida[12]);
  });
});

/* ---------- P027 ---------- */

describe("P027: gráfico, tabela e exportação usam as mesmas linhas", () => {
  const P = G.p027!;

  it("série recente decomposta igual a carga_decomposicao_diaria.csv (SIN, valores arredondados pela gold)", () => {
    const ls = linhasRecenteModelo(P);
    const arq = new Map(csv("carga_decomposicao_diaria.csv").filter((r) => r.submercado === "SIN").map((r) => [r.data, r]));
    for (const l of ls) {
      const r = arq.get(l.d)!;
      expect(r, l.d).toBeTruthy();
      expect(Math.abs(l.real - n(r.real_mwmed)!), l.d).toBeLessThanOrEqual(0.5);
      expect(Math.abs(l.previsto - n(r.previsto_mwmed)!), l.d).toBeLessThanOrEqual(0.5);
      // a gold arredonda a duas casas o valor de três casas do CSV: até meio centésimo (mais o erro de ponto flutuante)
      expect(Math.abs(l.residuo_pct - n(r.residuo_pct)!), l.d).toBeLessThanOrEqual(0.005 + 1e-9);
      expect(l.dentro_80).toBe(l.real >= l.p10 && l.real <= l.p90);
    }
  });

  it("barras da decomposição: as partes e o resíduo da gold, na mesma ordem da tabela", () => {
    const d = decomposicaoEscolhida(G.a07, "SIN", "principal", "equivalente")!;
    const b = barrasDecomposicao(d);
    expect(b.map((x) => x.id)).toEqual(["calendario", "temperatura", "sazonalidade", "nivel_tendencia", "residuo"]);
    expect(b[4].valor).toBe(d.residuo_log100);
    expect(decomposicaoEscolhida(G.a07, "SIN", "principal", "mesmas_datas")).not.toBeNull();
  });

  it("sensibilidade: seis variantes por região, com o MAPE do principal como referência", () => {
    for (const r of REGIOES) {
      const ls = linhasSensibilidade(P, r);
      expect(ls.length, r).toBe(6);
      const principal = ls.find((x) => x.id === "principal")!;
      expect(principal.mape_pct).toBe(P.metricas[r].mape_pct);
      expect(ls.every((x) => x.mape_principal === principal.mape_pct)).toBe(true);
    }
    expect(paraTabela(linhasSensibilidade(P, "SIN")).length).toBe(6);
  });

  it("resposta à temperatura: uma linha por grau, faixa de cada região sem preencher fora dela", () => {
    const ls = linhasRespostaTemperatura(P);
    const sin = P.resposta_temperatura.SIN.pontos;
    for (const [t, ef] of sin) expect(ls.find((l) => l.id === String(t))!.SIN).toBe(ef);
    const fora = ls.filter((l) => !sin.some(([t]) => String(t) === l.id));
    for (const l of fora) expect(l.SIN, l.id).toBeNull();
  });
});

/* ---------- textos derivados ---------- */

describe("textos derivados dos números (mudar o número muda o texto)", () => {
  it("resposta do P025: média, variação com duas casas (sem arredondar duas vezes), datas e calendário", () => {
    const t = respostaNivel(G.p025, "SIN", "7d", "equivalente");
    expect(t).toContain("83.771 MWmed");
    expect(t).toContain("+11,45%");
    expect(t).not.toContain("+11,5%");
    expect(t).toContain("de 23/09/2025 a 29/09/2025");
    expect(t).toContain("mesma composição de calendário: 5 dias úteis, 1 sábado e 1 domingo ou feriado");
    const p = clone(G.p025);
    const sin = p.comparacoes.subsistemas.find((s) => s.sm === "SIN")!;
    sin.janelas["7d"].equivalente!.variacao_pct = -2.31;
    expect(respostaNivel(p, "SIN", "7d", "equivalente")).toContain("−2,31%");
    sin.janelas["7d"].equivalente!.variacao_pct = null;
    expect(respostaNivel(p, "SIN", "7d", "equivalente")).toContain("não é publicada como variação");
    sin.janelas["7d"].equivalente = null;
    expect(respostaNivel(p, "SIN", "7d", "equivalente")).toContain("falta dia aceito pela validação física");
    p.comparacoes.janelas[0].calendario_equivalente_364d = false;
    p.comparacoes.janelas[0].classes_equivalente = { util: 4, sabado: 1, domingo_feriado: 2, sem_classe: 0 };
    sin.janelas["7d"].equivalente = clone(G.p025.comparacoes.subsistemas.find((s) => s.sm === "SIN")!.janelas["7d"].equivalente);
    expect(respostaNivel(p, "SIN", "7d", "equivalente")).toContain("não têm a mesma composição de calendário: 5 dias úteis, 1 sábado e 1 domingo ou feriado nesta, 4 dias úteis");
  });

  it("acumulado do ano: calendário não equivalente vira ressalva com os feriados em dia útil", () => {
    const a = G.p025.acumulado_ano;
    const t = respostaAcumulado(a, "SIN");
    expect(a.calendario_equivalente).toBe(false);
    expect(t).toContain(`${a.classes.util} dias úteis contra ${a.classes_ant.util}`);
    expect(t).toContain("calendário não é equivalente");
    const b = clone(a);
    b.calendario_equivalente = true;
    expect(respostaAcumulado(b, "SIN")).toContain("mesma composição de calendário");
    b.sm.SIN = null;
    expect(respostaAcumulado(b, "SIN")).toContain("Sem acumulado do ano");
  });

  it("composição de dias: classes com zero somem; plural e singular", () => {
    expect(textoClasses({ util: 1, sabado: 0, domingo_feriado: 2, sem_classe: 0 })).toBe("1 dia útil e 2 domingos ou feriados");
    expect(textoClasses({ util: 0, sabado: 0, domingo_feriado: 0, sem_classe: 3 })).toContain("sem classificação");
  });

  it("revisões: magnitude e alcance, não só contagem", () => {
    const t = textoRevisoes(G.p025.revisoes);
    expect(t).toContain(`${G.p025.revisoes.total} valores foram revisados`);
    expect(t).toMatch(/mediana de 0,0191% e máximo de 4,07%/);
    const r = clone(G.p025.revisoes);
    r.total = 0;
    expect(textoRevisoes(r)).toContain("Nenhum valor revisado");
  });

  it("atualidade: mais de três dias entre o dado e o processamento é fonte defasada", () => {
    expect(situacaoAtualidade("2026-09-28", "2026-10-01T06:24:22Z").defasada).toBe(false);
    const d = situacaoAtualidade("2026-09-20", "2026-10-01T06:24:22Z");
    expect(d.defasada).toBe(true);
    expect(d.texto).toContain("Fonte defasada");
    expect(d.texto).toContain("11 dias");
    // 01/10 02:00 UTC ainda é 30/09 em Brasília
    expect(situacaoAtualidade("2026-09-28", "2026-10-01T02:00:00Z").dias).toBe(2);
  });

  it("resposta do P026: parcela da MMGD do último mês completo e hora modal do pico", () => {
    const t = respostaPerfil(G.p026, "SIN");
    const m = ultimoMesCompletoMmgd(G.p026, "SIN")!;
    expect(t).toContain(`${m.mmgd_pct.toFixed(2).replace(".", ",")}% da carga global do SIN`);
    expect(t).toContain("às 18h (129 dias)");
    const p = clone(G.p026);
    const ult = p.hora_pico_por_ano.SIN[p.hora_pico_por_ano.SIN.length - 1];
    ult.contagem = Array(24).fill(0);
    ult.contagem[14] = 200;
    expect(respostaPerfil(p, "SIN")).toContain("às 14h (200 dias)");
    expect(horaModal([0, 3, 3, 1])).toEqual({ hora: 1, dias: 3 });
    expect(horaModal(Array(24).fill(0))).toBeNull();
  });

  it("perfil típico: extremos da carga líquida e pico da MMGD só da carga verificada", () => {
    const pf = perfilEscolhido(G.p026.perfil_sin_12m, "2026-08", "util")!;
    const t = respostaPerfilTipico(pf);
    expect(t).toContain("59.479 MWmed (hora das 12h)");
    expect(t).toContain("30.044 MWmed na hora das 12h");
    const sem = clone(pf);
    sem.liquida = Array(24).fill(null);
    sem.mmgd = Array(24).fill(null);
    expect(respostaPerfilTipico(sem)).toContain("não tem dia completo");
  });

  it("resposta do P027: erro, referência ingênua e cobertura diante da nominal", () => {
    const p = G.p027!;
    const t = respostaClima(p, "SIN");
    expect(t).toContain("2,08%");
    expect(t).toContain("4,80%");
    expect(t).toContain("abaixo do nominal");
    const q = clone(p);
    q.metricas.SIN.cobertura_80_pct = 81;
    q.metricas.SIN.cobertura_95_pct = 96;
    expect(respostaClima(q, "SIN")).toContain("no nível nominal ou acima");
    expect(textoDefasagemTemperatura(p, G.dia_referencia)).toContain("1 dia antes do último dia de carga");
    expect(textoDefasagemTemperatura(p, p.periodo_avaliacao.fim)).toContain("cobre até");
    expect(respostaUltimoDia(p)).toContain(p.recente_sin[p.recente_sin.length - 1].d.split("-").reverse().join("/"));
  });

  it("decomposição: duas casas da gold e sempre 'não causa'", () => {
    const d = decomposicaoEscolhida(G.a07, "SIN", "principal", "equivalente")!;
    const t = respostaDecomposicao(d);
    expect(t).toContain("não causa");
    expect(t).toContain(`temperatura ${d.contribuicoes_log100.temperatura.toFixed(2).replace(".", ",")}`);
    expect(t).not.toMatch(/explica|efeito/i);
    const e = clone(d);
    e.residuo_log100 = 9.99;
    expect(respostaDecomposicao(e)).toContain("resíduo 9,99");
  });

  it("nenhum texto gerado usa travessão nem hífen como pontuação nem atribui a carga à atividade econômica", () => {
    const textos = [
      ...REGIOES.flatMap((sm) => JANELAS.flatMap((j) => [respostaNivel(G.p025, sm, j, "equivalente"), respostaNivel(G.p025, sm, j, "mesmas_datas")])),
      ...REGIOES.map((sm) => respostaAcumulado(G.p025.acumulado_ano, sm)),
      ...REGIOES.map((sm) => respostaPerfil(G.p026, sm)),
      ...REGIOES.map((sm) => respostaClima(G.p027!, sm)),
      ...G.a07.decomposicao.map(respostaDecomposicao),
      textoRevisoes(G.p025.revisoes),
    ];
    for (const t of textos) {
      expect(t).not.toMatch(/—|–| - /);
      expect(t).not.toMatch(/atividade econômica (cresceu|aumentou|explica)|por causa d/i);
    }
  });
});

/* ---------- páginas no servidor ---------- */

describe("páginas renderizadas no servidor", () => {
  const paginas = { p025: PaginaNivel, p026: PaginaPerfil, p027: PaginaClima } as const;
  const html = Object.fromEntries(Object.entries(paginas).map(([k, P]) => [k, renderToStaticMarkup(createElement(P))])) as Record<keyof typeof paginas, string>;
  const respostas = {
    p025: respostaNivel(G.p025, "SIN", "7d", "equivalente"),
    p026: respostaPerfil(G.p026, "SIN"),
    p027: respostaClima(G.p027!, "SIN"),
  };

  it("cada painel renderiza sem erro na sua página, com a pergunta como título, a resposta derivada e a anatomia da seção 7.2", () => {
    for (const id of ["p025", "p026", "p027"] as const) {
      const h = html[id];
      expect(h, id).toContain(`id="${id}"`);
      expect(h, id).toContain(`id="${id}-titulo"`);
      expect(h, id).toContain(PAINEIS_CARGA.find((p) => p.id === id)!.pergunta);
      expect(h, id).toContain(`data-resposta="${id}"`);
      expect(h, id).toContain(respostas[id].slice(0, 40));
      for (const parte of ["Período", "Universo", "Unidade", "Como interpretar", "O que não é possível concluir", "Próxima pergunta", "Copiar link deste painel", "Baixar"]) {
        expect(h, `${id}: ${parte}`).toContain(parte);
      }
      expect((h.match(/Comprove este número/g) ?? []).length, id).toBeGreaterThanOrEqual(1);
      expect((h.match(/<table/g) ?? []).length, id).toBeGreaterThanOrEqual(8);
      expect(h, id).toContain('role="radiogroup" aria-label="Nível de profundidade"');
      expect(h, id).toContain('data-nivel="analisar"');
      expect(h, id).toContain('data-nivel="auditar"');
      // navegação entre as páginas: na abertura (P025) as outras duas aparecem como capítulos depois da figura principal; nas filhas, a faixa de
      // páginas irmãs traz a atual com aria-current. O mesmo rótulo não aparece nas duas formas na mesma página.
      for (const p of PAINEIS_CARGA) expect(h, `${id} -> ${p.id}`).toContain(`href="${rotaPainel(p.id)}"`);
      if (id === "p025") expect(h, id).toContain('data-navegacao-local="capitulos"');
      else expect(h, id).toMatch(new RegExp(`aria-current="page"[^>]*>${PAINEIS_CARGA.find((p) => p.id === id)!.rotulo}<`));
      // nunca "em breve" nem "em construção" como entrega (o menu compartilhado descreve outros módulos; confere-se o conteúdo)
      expect(h.slice(h.indexOf("<main")), id).not.toMatch(/em breve|em constru|em integra/i);
    }
  });

  it("P025: A07 com os textos do pipeline, os dois KPIs com prova e o aviso de atividade econômica", () => {
    const h = html.p025;
    expect(h).toContain('data-textos="a07"');
    for (const t of G.a07.textos) expect(h).toContain(t.slice(0, 30));
    expect(h).toContain("não mede atividade econômica");
    expect((h.match(/Comprove este número/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(h).toContain("Mesmo dia da semana, 364 dias antes");
    expect(h).toContain(respostaAcumulado(G.p025.acumulado_ano, "SIN").slice(0, 40));
  });

  it("P026: conceitos de cada carga, natureza por série e as duas fontes em gráficos separados", () => {
    const h = html.p026;
    expect(h).toContain('data-conceitos="p026"');
    for (const c of Object.values(G.p026.conceitos)) expect(h).toContain(c.slice(0, 30));
    expect(h).toContain("MMGD estimada");
    expect(h).toMatch(/Natureza do dado: (<[^>]+>)*Estimado/);
    expect(h).toContain('data-textos="a11"');
    expect(h).toContain("Curva de carga horária do SIN (já inclui MMGD estimada, não separada)");
  });

  it("P027: decomposição chamada de estatística, com backtest, sensibilidade e resíduos", () => {
    const h = html.p027;
    expect(h).toContain("não causa");
    expect(h).toContain("Sensibilidade");
    expect(h).toContain("erro por origem");
    expect(h).toContain(respostaDecomposicao(decomposicaoEscolhida(G.a07, "SIN", "principal", "equivalente")!).slice(0, 40));
    expect(h).not.toMatch(/parcela explicada pela|explicado pela temperatura/i);
  });

  it("HTML de cada página abaixo de 520 KB antes das props (meta de cerca de 600 KB com elas; contrato, seção 5.1)", () => {
    for (const [id, h] of Object.entries(html)) expect(h.length, id).toBeLessThan(520_000);
  });

  it("gold ausente: estado de indisponibilidade com o motivo, sem número de reserva", () => {
    const h = renderToStaticMarkup(createElement(CargaIndisponivel, { motivo: "gold reprovada na validação física" }));
    expect(h).toContain("Carga indisponível nesta publicação");
    expect(h).toContain("gold reprovada na validação física");
    expect(h).not.toMatch(/\d{2}\.\d{3}/);
  });

  it("o destino Carga está publicado no menu", () => {
    expect(DESTINOS_NAVEGACAO.find((d) => d.slug === "carga")?.publicado).toBe(true);
  });
});

/* ---------- revisão de interface: datas, contagens e afirmações lidas da gold ---------- */

describe("revisão de interface: nada de data, contagem ou afirmação sobre os dados escrita à mão", () => {
  it("carga global contra curva por hora: o texto cita a hora de maior e de menor diferença refeitas dos CSV horários (não 'à noite')", () => {
    // caminho independente: as duas séries horárias publicadas, nos mesmos 365 dias e horas da gold
    const ult = G.p026.ultimo_dia;
    const ini = deslocaDias(ult, -364);
    const dentro = (r: Record<string, string>) => r.data_hora.slice(0, 10) >= ini && r.data_hora.slice(0, 10) <= ult;
    const curva = new Map(csv("carga_horaria.csv").filter(dentro).map((r) => [r.data_hora, n(r.SIN)]));
    const soma = Array.from({ length: 24 }, () => ({ g: 0, c: 0, k: 0 }));
    for (const r of csv("carga_verificada_horaria.csv").filter(dentro)) {
      const c = curva.get(r.data_hora);
      const g = n(r.global_SIN);
      if (c === null || c === undefined || g === null) continue;
      const x = soma[Number(r.data_hora.slice(11, 13))];
      x.g += g;
      x.c += c;
      x.k++;
    }
    const pct = soma.map((x) => 100 * (x.g / x.c - 1));
    const publicada = G.p026.compatibilidade.por_hora_sin_365d;
    publicada.forEach((x) => {
      expect(x.horas, `${x.hora}h`).toBe(soma[x.hora].k);
      expect(Math.abs(x.diferenca_pct! - pct[x.hora]), `${x.hora}h`).toBeLessThanOrEqual(0.01);
    });
    const hMax = pct.indexOf(Math.max(...pct));
    const hMin = pct.indexOf(Math.min(...pct));
    const t = textoDiferencaHoraria(publicada)!;
    expect(t).toContain(`na hora das ${String(hMax).padStart(2, "0")}h`);
    expect(t).toContain(`na hora das ${String(hMin).padStart(2, "0")}h`);
    expect(hMax).toBeGreaterThanOrEqual(9);
    expect(hMax).toBeLessThanOrEqual(15);
    // a mesma regra do pipeline: a frase da interface é a da gold (conclusão e limitação da proveniência)
    expect(G.p026.compatibilidade.conclusao).toContain(`(${t})`);
    expect(G.proveniencia.api.limitacoes.some((l) => l.includes(`(${t})`))).toBe(true);
    // mudar a tabela muda o texto; diferença com sinais opostos é dita assim
    const outra = clone(publicada).map((x) => ({ ...x, diferenca_pct: x.hora === 21 ? 9.99 : x.hora === 3 ? -1.5 : x.diferenca_pct }));
    expect(textoDiferencaHoraria(outra)).toContain("muda de sinal");
    expect(textoDiferencaHoraria(outra)).toContain("+9,99% na hora das 21h");
    expect(textoDiferencaHoraria(publicada.map((x) => ({ ...x, diferenca_pct: null })))).toBeNull();
  });

  it("regimes do ONS: avisos e quebra da curva usam as datas da gold, inclusive a mudança de 2021", () => {
    const R = G.regimes;
    const desp = R.find((r) => /não despachadas/.test(r.descricao))!;
    const mmgd = R.find((r) => /MMGD/.test(r.descricao))!;
    expect(textoAvisoRegimes(R)).toContain(`Antes de ${dataBR(desp.inicio)}`);
    expect(textoAvisoRegimes(R)).toContain(`observada nos dados em ${dataBR(mmgd.observado_nos_dados!)}`);
    expect(parentesesMmgd(R)).toBe(` (declarada para ${dataBR(mmgd.inicio)}, observada nos dados em ${dataBR(mmgd.observado_nos_dados!)})`);
    // mês que atravessa a mudança não pertence a um regime só
    expect(regimeDoMes(R, mmgd.inicio.slice(0, 7))).toBeNull();
    expect(regimeDoMes(R, "2019-08")).toBe(0);
    // agosto de 2019 e 2020: mesmo regime; 2020 e 2022: só a mudança de 2021 (o aviso antigo só olhava 2023)
    expect(textoQuebraCurva(R, ["2019-08", "2020-08"])).toBeNull();
    const q2021 = textoQuebraCurva(R, ["2020-08", "2022-08"])!;
    expect(q2021).toContain(dataBR(desp.inicio));
    expect(q2021).not.toContain(dataBR(mmgd.inicio));
    const qTodos = textoQuebraCurva(R, ["2019-08", "2026-08"])!;
    expect(qTodos).toContain(dataBR(desp.inicio));
    expect(qTodos).toContain(dataBR(mmgd.observado_nos_dados!));
    expect(textoQuebraCurva(R, ["2023-08", "2026-08"])).toBeNull();
    // mudar a data publicada muda o texto
    const R2 = clone(R);
    R2.find((r) => /não despachadas/.test(r.descricao))!.inicio = "2021-04-01";
    expect(textoAvisoRegimes(R2)).toContain("Antes de 01/04/2021");
  });

  it("série mensal: o texto diz que o mês corrente fica de fora quando a gold só publica meses completos", () => {
    const P = G.p025;
    const ult = P.mensal[P.mensal.length - 1].m;
    const mc = P.comparacoes.janelas.find((j) => j.id === "mes_corrente")!;
    expect(mc.inicio.slice(0, 7) > ult).toBe(true);
    const t = textoMesCorrente(P.mensal, P.comparacoes.janelas);
    expect(t).toContain(`último mês completo (${mesAno(ult)})`);
    expect(t).toContain(`${dataBR(mc.inicio)} a ${dataBR(mc.fim)}`);
    expect(t).not.toContain("compara os mesmos dias");
    // se a gold trouxer o mês parcial, o texto muda
    const comParcial = [...P.mensal, { ...P.mensal[P.mensal.length - 1], m: mc.inicio.slice(0, 7) }];
    expect(textoMesCorrente(comParcial, P.comparacoes.janelas)).toContain("é parcial");
  });

  it("perfil comparado entre anos e hora do pico da API: mês, tipo de dia e contagens vêm da gold; ausência não vira zero", () => {
    const ev = recorteEvolucao(G.p026)!;
    expect(ev.desde).toBe(G.p026.perfil_evolucao[0].mes.slice(0, 4));
    expect(ev.mes).toBe("agosto");
    const P = clone(G.p026);
    P.perfil_evolucao.forEach((x) => (x.mes = `${x.mes.slice(0, 4)}-07`));
    expect(recorteEvolucao(P)!.mes).toBe("julho");
    const ano = G.p026.hora_pico_api_sin_por_ano[G.p026.hora_pico_api_sin_por_ano.length - 1];
    const ls = linhasHoraPicoApi(G.p026, ano.ano);
    expect(ls.map((l) => l.liquida)).toEqual(ano.contagem_liquida);
    const curto = clone(G.p026);
    curto.hora_pico_api_sin_por_ano[curto.hora_pico_api_sin_por_ano.length - 1].contagem_liquida = ano.contagem_liquida.slice(0, 20);
    expect(linhasHoraPicoApi(curto, ano.ano)[22].liquida).toBeNull();
  });

  it("páginas: títulos com as datas e contagens da gold, sem 'à noite', sem chave crua de categoria", () => {
    const h025 = renderToStaticMarkup(createElement(PaginaNivel));
    const h026 = renderToStaticMarkup(createElement(PaginaPerfil));
    const h027 = renderToStaticMarkup(createElement(PaginaClima));
    const ref = G.a07.referencia;
    expect(h025).toContain(`Carga diária de cada captura, de ${dataBR(ref.inicio)} a ${dataBR(ref.fim)}`);
    expect(h025).toContain(textoMesCorrente(G.p025.mensal, G.p025.comparacoes.janelas).slice(0, 60));
    expect(h025).toContain(`Temperatura nas mesmas datas de ${ref.inicio_anterior.slice(0, 4)}`);
    expect(h025).toContain(`Como a carga média do SIN evoluiu desde ${C.mensal[0].m.slice(0, 4)}`);
    expect(h026).not.toMatch(/sobretudo à noite|mais à noite/);
    expect(h026).toContain(textoDiferencaHoraria(G.p026.compatibilidade.por_hora_sin_365d)!.slice(0, 40));
    expect(h026).toContain(`Pico de cada dia nos últimos ${G.p026.picos_90d.length} dias`);
    expect(h026).toContain(`Como o dia útil de agosto mudou desde ${G.p026.perfil_evolucao[0].mes.slice(0, 4)}`);
    expect(h027).toContain(`A janela do achado, de ${dataBR(ref.inicio)} a ${dataBR(ref.fim)}`);
    expect(h027).toContain(`Últimos ${G.p027!.recente_sin.length} dias previstos`);
    const principal = decomposicaoEscolhida(G.a07, "SIN", "principal", "equivalente")!;
    if (principal.fim < ref.fim) expect(h027).toContain(`Esta variante cobre ${principal.dias} dias, até ${dataBR(principal.fim)}`);
    expect(h027).toContain("Categorias do calendário:");
    expect(h027).not.toMatch(/paixao \(/);
  });

  it("código das páginas e componentes não fixa data: as datas visíveis vêm da gold", () => {
    const dir = join(raiz, "src/components/energia");
    const arquivos = [
      ...readdirSync(dir).filter((x) => x.startsWith("Carga")).map((f) => join(dir, f)),
      ...["", "/perfil-horario", "/clima-e-calendario"].map((r) => join(raiz, `src/app/setor-eletrico/carga${r}/page.tsx`)),
    ];
    for (const f of arquivos) {
      const codigo = readFileSync(f, "utf-8")
        .split("\n")
        .filter((l) => !/^\s*(\/\/|\*|\/\*\*)/.test(l))
        .join("\n");
      expect(codigo, f).not.toMatch(/\b\d{2}\/\d{2}\/\d{4}\b/);
      expect(codigo, f).not.toMatch(/\b\d{1,2} a \d{1,2}\/\d{2}/);
    }
  });

  it("zoom das séries longas vai para a URL (histórico mensal e parcela mensal da MMGD, como a série diária)", () => {
    const fonte = (f: string) => readFileSync(join(raiz, f), "utf-8");
    expect(fonte("src/components/energia/CargaHistorico.tsx")).toMatch(/onIntervalo=\{\(i\) => definir\(\{ hde:/);
    expect(fonte("src/components/energia/CargaPerfil.tsx")).toMatch(/onIntervalo=\{\(i\) => definir\(\{ mde:/);
    expect(fonte("src/components/energia/CargaNivel.tsx")).toMatch(/onIntervalo=\{\(i\) => definir\(\{ de:/);
    // nenhum gráfico com zoom fica sem o intervalo controlado
    for (const f of ["src/components/energia/CargaNivel.tsx", "src/components/energia/CargaPerfil.tsx", "src/components/energia/CargaClima.tsx", "src/components/energia/CargaHistorico.tsx", "src/app/setor-eletrico/carga/page.tsx", "src/app/setor-eletrico/carga/perfil-horario/page.tsx", "src/app/setor-eletrico/carga/clima-e-calendario/page.tsx"]) {
      for (const b of fonte(f).split("<GraficoLinhas").slice(1).map((x) => x.slice(0, x.indexOf("/>")))) {
        if (/\n\s*zoom\n/.test(b)) expect(b, f).toContain("onIntervalo=");
      }
    }
  });

  it("toda tabela equivalente guarda busca, filtros, ordem e página na URL, com prefixo único por página", () => {
    const fonte = (f: string) => readFileSync(join(raiz, f), "utf-8");
    const paginas = {
      p025: ["src/app/setor-eletrico/carga/page.tsx", "src/components/energia/CargaNivel.tsx"],
      p026: ["src/app/setor-eletrico/carga/perfil-horario/page.tsx", "src/components/energia/CargaPerfil.tsx"],
      p027: ["src/app/setor-eletrico/carga/clima-e-calendario/page.tsx", "src/components/energia/CargaClima.tsx"],
    };
    for (const [id, fs] of Object.entries(paginas)) {
      const blocos = fs.flatMap((f) => fonte(f).split("<TabelaInterativa").slice(1).map((b) => b.slice(0, b.indexOf("/>"))));
      const chaves = blocos.map((b) => b.match(/chaveUrl="([^"]+)"/)?.[1] ?? null);
      expect(chaves.filter((c) => c === null).length, `${id}: tabela sem chaveUrl`).toBe(0);
      expect(new Set(chaves).size, `${id}: prefixo repetido`).toBe(chaves.length);
      // prefixo de tabela não colide com os parâmetros do recorte da página
      for (const c of chaves) expect(["sm", "jan", "cmp", "de", "ate", "sms", "hde", "hate", "mes", "cls", "psm", "anos", "med", "hp", "mde", "mate", "var", "modo"]).not.toContain(c);
    }
  });
});

describe("componentes do módulo", () => {
  it("sem hexadecimal solto (o uso de energia-soft como texto é conferido por design-tokens-energia)", () => {
    const dir = join(raiz, "src/components/energia");
    const arquivos = [
      ...readdirSync(dir).filter((x) => x.startsWith("Carga")).map((f) => join(dir, f)),
      ...["", "/perfil-horario", "/clima-e-calendario"].map((r) => join(raiz, `src/app/setor-eletrico/carga${r}/page.tsx`)),
    ];
    // seis ou oito dígitos em qualquer lugar; três dígitos só como valor isolado (âncoras como "#a07" não são cor)
    for (const f of arquivos) {
      const t = readFileSync(f, "utf-8");
      expect(t, f).not.toMatch(/#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?\b/);
      expect(t, f).not.toMatch(/["'`(\s]#[0-9a-fA-F]{3}["'`;\s)]/);
    }
  });

  it("módulos cliente só exportam componentes e tipos", () => {
    const dir = join(raiz, "src/components/energia");
    for (const f of readdirSync(dir).filter((x) => x.startsWith("Carga"))) {
      const t = readFileSync(join(dir, f), "utf-8");
      if (!t.startsWith('"use client"')) continue;
      for (const m of Array.from(t.matchAll(/^export (const|let|var) (\w+)/gm))) expect.fail(`${f} exporta valor ${m[2]}`);
    }
  });
});
