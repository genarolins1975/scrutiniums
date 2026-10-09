import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ContaDeLuzPage from "@/app/setor-eletrico/conta-de-luz/page";
import ContaReajustesPage from "@/app/setor-eletrico/conta-de-luz/reajustes-e-subsidios/page";
import {
  CAMPO_DIST,
  CAMPO_PERFIL,
  CASO_EVIDENCIA_SIMULADOR,
  COLUNAS_JANELA,
  COLUNAS_RANKING,
  GRUPOS_DESPESA_CDE,
  ID_MEDIA,
  ORDEM_GRUPOS,
  categoriasSubsidio,
  colunasComposicao,
  custoDoPerfil,
  destacar,
  destaquesDoPerfil,
  gradeBandeiras,
  idsComposicaoPadrao,
  linhasCde,
  linhasComposicao,
  linhasComposicaoGrafico,
  linhasEvolucao,
  linhasHistorico,
  linhasJanela,
  linhasRanking,
  linhasSubsidios,
  minuscula,
  mudancaComposicao,
  mudancaComposicaoEm,
  mudancaSubsidios,
  mudancaTarifa,
  notaFaixaTarifa,
  referenciasDoPerfil,
  remover,
  respostaBandeira,
  respostaCde,
  respostaComposicao,
  respostaHistorico,
  respostaReajustes,
  respostaSimulacao,
  respostaSubsidios,
  respostaTarifa,
  resumoSerieReal,
  simular,
  tarifaNaData,
  textoDestaquePerfil,
  textoReferenciasPerfil,
  textoSerieReal,
  verboVariacao,
} from "@/lib/energia/conta";
import { problemasEvidencia } from "@/lib/energia/evidencia";
import { conceito } from "@/lib/energia/conteudo/conceitos";
import { CONCEITOS as CONCEITOS_CONTA } from "@/lib/energia/conteudo/conceitos-conta";
import { lerEstado } from "@/lib/energia/estadoUrl";
import { dataBR, mesAno, num, pct, reais } from "@/lib/energia/formato";
import { gerarCsv } from "@/lib/energia/tabela";
import type { ContaGold, HistoricoB1, JanelaInflacao } from "@/lib/energia/tipos-conta";

/**
 * Módulo Conta de luz (P047 a P050), lado da interface. O que este teste protege:
 *
 *  1. contrato da gold: o que a página lê existe, com natureza, fonte, evidências
 *     completas e identidades internas da própria gold (TE + TUSD = total, grupos
 *     somam a tarifa, perfis = kWh × tarifa ÷ 1000), com valores conferidos na
 *     fonte original escritos aqui (documento do módulo, seção 4.1);
 *  2. gráfico, tabela e exportação mostram as mesmas linhas: a matriz que a
 *     página entrega ao gráfico e à tabela, exportada pelo mesmo gerador de CSV da
 *     tabela, bate com os CSVs publicados pelo pipeline, relidos aqui por outro
 *     caminho (agregação própria do arquivo, não a função da página);
 *  3. o simulador reaplica a fórmula publicada e reproduz os 100 casos de
 *     referência calculados no pipeline e a evidência "Comprove este número";
 *  4. as respostas curtas saem dos números (mudam quando o número muda, dizem
 *     "caiu" quando cai, nunca trazem número fixo);
 *  5. a página renderiza no servidor com os quatro painéis, as tabelas
 *     equivalentes, as provas, os links compartilháveis e a próxima pergunta.
 */

const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
const gold = JSON.parse(ler("public/energia/gold/conta.json")) as ContaGold;
const disponivel = gold.disponivel === true;

/** CSV com ";" (aspas duplas para campo com separador), como o pipeline e a tabela escrevem. */
function lerCsv(texto: string): Record<string, string>[] {
  const linhas: string[][] = [];
  let campo = "";
  let linha: string[] = [];
  let aspas = false;
  const t = texto.replace(/^﻿/, "");
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
      linhas.push(linha);
      linha = [];
      campo = "";
    } else campo += c;
  }
  if (campo || linha.length) {
    linha.push(campo);
    linhas.push(linha);
  }
  const [cab, ...resto] = linhas.filter((l) => l.length > 1 || l[0] !== "");
  return resto.map((l) => Object.fromEntries(cab.map((h, i) => [h, l[i] ?? ""])));
}
const numero = (s: string | undefined) => (s === undefined || s === "" ? null : Number(s));
const perto = (a: number | null | undefined, b: number | null | undefined, tol: number) =>
  a !== null && a !== undefined && b !== null && b !== undefined && Math.abs(a - b) <= tol + 1e-9;

describe.skipIf(!disponivel)("contrato da gold conta.json", () => {
  it("cabeçalho, data de referência e blocos que a página lê", () => {
    expect(gold.dominio).toBe("energia");
    expect(gold.gold).toBe("conta.json");
    expect(gold.data_referencia).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(gold.perfis_kwh).toEqual([100, 200, 300]);
    for (const k of ["tarifas", "composicao", "simulador", "reajustes", "bandeiras", "subsidios", "financiamento_cde", "definicoes", "validacao"] as const) {
      expect(gold[k], k).toBeTruthy();
    }
    for (const k of ["tarifa_homologada", "tarifa_media_fornecimento", "conta_simulada", "nao_e_conta"] as const) expect(gold.definicoes[k].length, k).toBeGreaterThan(40);
    expect(gold.tarifa_media_fornecimento.disponivel).toBe(false);
    expect(gold.reajustes.efeito_medio.disponivel).toBe(false);
  });

  it("natureza de cada bloco: tarifas e composição calculadas, simulador estimado, orçamento da CDE previsto", () => {
    expect(gold.tarifas.proveniencia.natureza).toBe("CALCULADO");
    expect(gold.composicao.proveniencia.natureza).toBe("CALCULADO");
    expect(gold.simulador.proveniencia.natureza).toBe("ESTIMADO");
    expect(gold.bandeiras.proveniencia.natureza).toBe("OBSERVADO");
    expect(gold.financiamento_cde?.proveniencia?.natureza).toBe("PREVISTO");
    for (const p of [
      gold.tarifas.proveniencia,
      gold.composicao.proveniencia,
      gold.simulador.proveniencia,
      gold.reajustes.proveniencia,
      gold.bandeiras.proveniencia,
      gold.subsidios.proveniencia,
    ]) {
      expect(p.limitacoes.length, p.indicador).toBeGreaterThan(0);
      expect(p.fonte.url_dataset, p.indicador).toMatch(/^https:\/\//);
      if (p.download) expect(() => ler(`public${p.download}`), p.download).not.toThrow();
    }
  });

  it('as sete evidências "Comprove este número" estão completas', () => {
    const evs = {
      tarifa: gold.tarifas.evidencia_mediana,
      composicao: gold.composicao.evidencia,
      simulador: gold.simulador.evidencia,
      reajustes: gold.reajustes.evidencia,
      bandeiras: gold.bandeiras.evidencia,
      subsidios: gold.subsidios.evidencia,
      cde: gold.financiamento_cde?.evidencia ?? null,
    };
    for (const [k, ev] of Object.entries(evs)) {
      expect(ev, k).toBeTruthy();
      expect(problemasEvidencia(ev!), k).toEqual([]);
    }
    expect(evs.tarifa.valor_calculo).toBe(gold.tarifas.resumo.mediana);
    expect(evs.reajustes!.valor_calculo!.toFixed(2)).toBe(gold.reajustes.comparacao_inflacao!.janelas.find((j) => j.meses === 12)!.mediana_pct!.toFixed(2));
  });

  it("ranking: CNPJ único de 14 dígitos, posições 1..n, TE + TUSD = total e perfil = kWh × total ÷ 1000", () => {
    const v = gold.tarifas.vigentes;
    expect(v.length).toBe(gold.tarifas.resumo.n);
    expect(new Set(v.map((x) => x.cnpj)).size).toBe(v.length);
    for (const x of v) expect(x.cnpj).toMatch(/^\d{14}$/);
    expect([...v.map((x) => x.posicao)].sort((a, b) => a - b)).toEqual(v.map((_, i) => i + 1));
    for (const x of v) {
      expect(perto((x.te ?? 0) + (x.tusd ?? 0), x.total, 0.005), x.cnpj).toBe(true);
      for (const p of [100, 200, 300] as const) expect(perto(x.perfis[String(p) as "100"], (p * x.total) / 1000, 0.005), `${x.cnpj} ${p}`).toBe(true);
    }
  });

  it("valores conferidos na fonte original da ANEEL (documento do módulo, seção 4.1)", () => {
    // CEMIG-D, REH 3.589/2026, vigência 28/05/2026 a 27/05/2027: "310,21" e "593,08" R$/MWh no CSV de tarifas
    const cemig = gold.tarifas.vigentes.find((x) => x.cnpj === "06981180000116");
    if (cemig && cemig.inicio === "2026-05-28") {
      expect(cemig.te).toBe(310.21);
      expect(cemig.tusd).toBe(593.08);
      expect(cemig.total).toBe(903.29);
      expect(cemig.ato).toBe("REH 3.589/2026");
    }
    // DMED, menor tarifa B1 (REH 3.548/2025): 221,14 + 396,43
    const dmed = gold.tarifas.vigentes.find((x) => x.cnpj === "23664303000104");
    if (dmed && dmed.inicio === "2025-11-18") expect([dmed.te, dmed.tusd, dmed.total]).toEqual([221.14, 396.43, 617.57]);
    // bandeira de set/2026: "2026-09-01;Amarela;18,85" no arquivo de acionamento
    const set26 = gold.bandeiras.acionamento.find((a) => a.m === "2026-09");
    if (set26) expect([set26.bandeira, set26.rs_mwh]).toEqual(["Amarela", 18.85]);
  });

  it("composição: grupos somam TE + TUSD em cada distribuidora e na média; CDE é parte dos encargos", () => {
    const c = gold.composicao;
    for (const d of c.distribuidoras) {
      const soma = ORDEM_GRUPOS.reduce((s, g) => s + (d.grupos[g] ?? 0), 0);
      if (d.fecha_com_total) expect(perto(soma, d.total, 0.02), d.sigla ?? d.cnpj).toBe(true);
      if (d.cde !== null && d.grupos.encargos !== null) expect(d.cde, d.sigla ?? d.cnpj).toBeLessThanOrEqual(d.grupos.encargos + 0.01);
      for (const g of ["energia", "transmissao", "distribuicao", "perdas", "encargos"] as const) {
        if (d.grupos[g] !== null) expect(d.grupos[g]!, `${d.sigla} ${g}`).toBeGreaterThanOrEqual(0);
      }
    }
    const m = c.media!;
    expect(
      perto(
        ORDEM_GRUPOS.reduce((s, g) => s + (m.grupos_rs_mwh[g] ?? 0), 0),
        m.total_rs_mwh,
        0.01,
      ),
    ).toBe(true);
    expect(
      perto(
        ORDEM_GRUPOS.reduce((s, g) => s + (m.grupos_pct[g] ?? 0), 0),
        100,
        0.05,
      ),
    ).toBe(true);
    expect(c.mediana.fecha_com_total).toBe(false);
  });
});

describe.skipIf(!disponivel)("gráfico, tabela e exportação mostram as mesmas linhas", () => {
  it("ranking (P047): a matriz do gráfico e da tabela, exportada, é o CSV publicado de tarifas vigentes", () => {
    const linhas = linhasRanking(gold.tarifas.vigentes, 200);
    const exportado = lerCsv(gerarCsv(COLUNAS_RANKING, linhas));
    const publicado = lerCsv(ler("public/energia/series/conta_tarifas_b1_vigentes.csv")).sort((a, b) => Number(a.posicao) - Number(b.posicao));
    expect(exportado.length).toBe(publicado.length);
    exportado.forEach((e, i) => {
      const p = publicado[i];
      expect(e["CNPJ"], `linha ${i}`).toBe(p.cnpj);
      expect(numero(e["Posição (1 = menor)"])).toBe(numero(p.posicao));
      expect(numero(e["TE (R$/MWh)"])).toBe(numero(p.te_rs_mwh));
      expect(numero(e["TUSD (R$/MWh)"])).toBe(numero(p.tusd_rs_mwh));
      expect(numero(e["TE + TUSD (R$/MWh)"])).toBe(numero(p.total_rs_mwh));
      expect(numero(e["200 kWh (R$/mês)"])).toBe(numero(p.custo_200kwh_rs));
      expect(e["Início da vigência"]).toBe(p.inicio_vigencia);
      expect(e["Ato da ANEEL"]).toBe(p.ato);
    });
    // o gráfico lê `custo`, que é a coluna do perfil escolhido, linha a linha
    for (const p of [100, 200, 300] as const) for (const l of linhasRanking(gold.tarifas.vigentes, p)) expect(l.custo).toBe(l[`custo_${p}`]);
  });

  it("composição (P048): a linha de cada distribuidora tem TE + TUSD do CSV de componentes da mesma vigência", () => {
    const linhas = linhasComposicao(gold.composicao, gold.tarifas.vigentes, "rs");
    const csv = lerCsv(ler("public/energia/series/conta_composicao_b1.csv"));
    const vig = new Map(gold.tarifas.vigentes.map((v) => [v.cnpj, v]));
    const exportado = lerCsv(gerarCsv(colunasComposicao(new Map(gold.composicao.grupos.map((g) => [g.id, g.rotulo])), false), linhas));
    expect(exportado.length).toBe(gold.composicao.distribuidoras.length);
    for (const e of exportado) {
      const v = vig.get(e["CNPJ"])!;
      // a mesma vigência e o mesmo ato da tarifa exibida (a fonte publica vigências sobrepostas)
      const doCsv = csv.find((r) => r.cnpj === v.cnpj && r.inicio === v.inicio && r.ato === v.ato);
      expect(doCsv, v.sigla ?? v.cnpj).toBeTruthy();
      expect(perto(numero(doCsv!.TE)! + numero(doCsv!.TUSD)!, numero(e["TE + TUSD (R$/MWh)"]), 0.01), v.sigla ?? v.cnpj).toBe(true);
    }
    // ordem por grupo: decrescente, ausência no fim
    const porEncargos = linhasComposicao(gold.composicao, gold.tarifas.vigentes, "pct", "encargos").map((l) => l.encargos);
    const presentes = porEncargos.filter((x): x is number => x !== null);
    expect(presentes).toEqual([...presentes].sort((a, b) => b - a));
  });

  it("composição (P048): o gráfico leva a média e as distribuidoras pedidas, cada uma igual à sua linha na tabela", () => {
    const c = gold.composicao;
    const ref = gold.simulador.casos_referencia.cnpj;
    const padrao = idsComposicaoPadrao(c, gold.tarifas.vigentes, ref);
    expect(padrao[0]).toBe(ref);
    expect(padrao.length).toBeLessThanOrEqual(3);
    const grafico = linhasComposicaoGrafico(c, gold.tarifas.vigentes, "rs", padrao);
    expect(grafico[0].id).toBe(ID_MEDIA);
    for (const g of ORDEM_GRUPOS) expect(grafico[0][g]).toBe(c.media!.grupos_rs_mwh[g]);
    const tabela = new Map(linhasComposicao(c, gold.tarifas.vigentes, "rs").map((l) => [l.id, l]));
    for (const l of grafico.slice(1)) expect(l).toEqual(tabela.get(l.id));
    // distribuidora sem composição (sem componentes para o ato) não entra no gráfico
    const semComp = gold.tarifas.vigentes.find((v) => !c.distribuidoras.some((d) => d.cnpj === v.cnpj));
    if (semComp) expect(linhasComposicaoGrafico(c, gold.tarifas.vigentes, "pct", [semComp.cnpj]).map((l) => l.id)).toEqual([ID_MEDIA]);
  });

  it("variação contra o IPCA (P050): cada janela tem as mesmas distribuidoras e valores do CSV publicado", () => {
    const csv = lerCsv(ler("public/energia/series/conta_reajuste_vs_ipca.csv"));
    for (const j of gold.reajustes.comparacao_inflacao!.janelas) {
      const exportado = lerCsv(gerarCsv(COLUNAS_JANELA, linhasJanela(j)));
      const doCsv = new Map(csv.filter((r) => Number(r.janela_meses) === j.meses).map((r) => [r.cnpj, r]));
      expect(exportado.length, `${j.meses} meses`).toBe(j.n);
      expect(doCsv.size, `${j.meses} meses`).toBe(j.n);
      for (const e of exportado) {
        const r = doCsv.get(e["CNPJ"]);
        expect(r, `${j.meses}: ${e["CNPJ"]}`).toBeTruthy();
        expect(perto(numero(e["Variação da tarifa B1 (%)"]), numero(r!.variacao_pct), 0.005), `${j.meses}: ${e["CNPJ"]}`).toBe(true);
        expect(perto(numero(e["Variação real (descontado o IPCA) (%)"]), numero(r!.variacao_real_pct), 0.005), `${j.meses}: ${e["CNPJ"]}`).toBe(true);
      }
    }
  });

  it("subsídios (P050): as barras por ano e categoria são a soma do CSV por distribuidora", () => {
    const csv = lerCsv(ler("public/energia/series/conta_subsidios_anual.csv")).filter((r) => r.montante === "Total");
    const soma = new Map<string, number>();
    for (const r of csv) soma.set(`${r.ano}|${r.categoria}`, (soma.get(`${r.ano}|${r.categoria}`) ?? 0) + Number(r.valor_rs));
    const linhas = linhasSubsidios(gold.subsidios);
    expect(linhas.map((l) => l.ano)).toEqual(gold.subsidios.anual.map((a) => a.ano));
    for (const l of linhas) {
      for (const c of categoriasSubsidio(gold.subsidios)) {
        const v = l[c] as number | null;
        const s = soma.get(`${l.ano}|${c}`);
        if (v === null) continue;
        // R$ bilhões na tela contra a soma em R$ do arquivo; tolerância de R$ 10 (soma de centavos arredondados)
        expect(perto(v * 1e9, s ?? 0, 10), `${l.ano} ${c}`).toBe(true);
      }
    }
  });

  it("orçamento da CDE (P050): os grupos por ano são a soma das rubricas do CSV", () => {
    const f = gold.financiamento_cde!;
    const csv = lerCsv(ler("public/energia/series/conta_cde_custeio.csv"));
    const soma = new Map<string, number>();
    for (const r of csv) if (r.valor_rs !== "") soma.set(`${r.ano}|${r.grupo}`, (soma.get(`${r.ano}|${r.grupo}`) ?? 0) + Number(r.valor_rs));
    for (const l of linhasCde(f)) {
      for (const g of GRUPOS_DESPESA_CDE) {
        const v = l[g] as number | null;
        if (v === null) continue;
        expect(perto(v * 1e9, soma.get(`${l.ano}|${g}`) ?? 0, 2), `${l.ano} ${g}`).toBe(true);
      }
    }
  });

  it("bandeiras (P050): a grade tem um mês para cada linha do CSV e nenhum mês inventado", () => {
    const csv = lerCsv(ler("public/energia/series/conta_bandeiras.csv"));
    const celulas = gradeBandeiras(gold.bandeiras.acionamento)
      .flatMap((a) => a.meses)
      .filter((c) => c !== null);
    expect(celulas.length).toBe(csv.length);
    const porMes = new Map(csv.map((r) => [r.mes, r]));
    for (const c of celulas) {
      const r = porMes.get(c!.mes)!;
      expect(c!.bandeira).toBe(r.bandeira);
      expect(c!.rs_mwh).toBe(numero(r.adicional_rs_mwh));
    }
    // mês fora do acionamento publicado fica vazio, não repete o anterior
    const grade = gradeBandeiras([
      { m: "2020-01", bandeira: "Verde", rs_mwh: 0 },
      { m: "2020-03", bandeira: "Amarela", rs_mwh: 18.85 },
    ]);
    expect(grade[0].meses[1]).toBeNull();
    expect(grade[0].meses[0]).toEqual({
      mes: "2020-01",
      bandeira: "Verde",
      rs_mwh: 0,
    });
  });

  it("histórico (P047): a tarifa do dia 1º é a da vigência que cobre a data, e a lacuna continua lacuna", () => {
    const vig: HistoricoB1["distribuidoras"][string]["vigencias"] = [
      ["2020-01-10", "2021-01-09", "REH 1", 100, 200, 300],
      ["2021-03-01", "2022-02-28", "REH 2", 110, 210, 320],
    ];
    expect(tarifaNaData(vig, "2020-01-01")).toBeNull();
    expect(tarifaNaData(vig, "2020-02-01")).toBe(300);
    expect(tarifaNaData(vig, "2021-01-09")).toBe(300);
    expect(tarifaNaData(vig, "2021-02-01")).toBeNull(); // sem vigência: nunca repete a anterior
    expect(tarifaNaData(vig, "2021-03-01")).toBe(320);
    const ev = linhasEvolucao(gold.tarifas.evolucao);
    expect(ev[0].mediana).not.toBeNull();
    const h = JSON.parse(ler(gold.tarifas.historico_url.replace(/^\//, "public/"))) as HistoricoB1;
    const cemig = h.distribuidoras["06981180000116"];
    const linhas = linhasHistorico(ev, { "06981180000116": cemig.vigencias });
    const v = gold.tarifas.vigentes.find((x) => x.cnpj === "06981180000116")!;
    const ult = linhas.at(-1)!;
    if (v.inicio <= `${ult.m}-01`) expect(ult["06981180000116"]).toBe(v.total);
  });
});

describe.skipIf(!disponivel)("simulador (P049) reproduz a fórmula publicada", () => {
  const s = gold.simulador;
  const alvo = s.distribuidoras.find((d) => d.cnpj === s.casos_referencia.cnpj)!;
  const adicional = (b: string) => s.bandeiras.find((x) => x.bandeira === b)?.rs_mwh ?? null;

  it("os 100 casos de referência calculados no pipeline, com tolerância de meio centavo", () => {
    expect(s.casos_referencia.casos.length).toBe(100);
    for (const [classe, kwh, lig, band, total, parcela] of s.casos_referencia.casos) {
      const r = simular(alvo.tarifas, classe, kwh, lig, adicional(band), s.regras);
      const id = `${classe} ${kwh} ${lig} ${band}`;
      if (total === null) {
        expect(r.disponivel, id).toBe(false);
        continue;
      }
      expect(r.disponivel, id).toBe(true);
      if (!r.disponivel) continue;
      expect(perto(r.total, total, 0.005), `${id}: ${r.total} × ${total}`).toBe(true);
      expect(perto(r.bandeira, parcela, 0.005), `${id}: bandeira`).toBe(true);
    }
  });

  it('o caso da evidência "Comprove este número" sai igual ao valor de cálculo da evidência', () => {
    const ev = s.evidencia!;
    const band = s.bandeira_vigente!.bandeira!;
    const r = simular(alvo.tarifas, CASO_EVIDENCIA_SIMULADOR.classe, CASO_EVIDENCIA_SIMULADOR.kwh, CASO_EVIDENCIA_SIMULADOR.ligacao, adicional(band), s.regras);
    expect(r.disponivel).toBe(true);
    if (r.disponivel) expect(perto(r.total, ev.valor_calculo, 1e-6)).toBe(true);
    expect(ev.entidade).toContain(`${CASO_EVIDENCIA_SIMULADOR.kwh} kWh`);
  });

  it("regras: mínimo da ligação, Tarifa Social sem mínimo e sem bandeira até 80 kWh, classe sem tarifa indisponível", () => {
    const t = alvo.tarifas;
    const res = (t.residencial![0]! + t.residencial![1]!) / 1000;
    const zero = simular(t, "residencial", 0, "trifasico", 0, s.regras);
    expect(zero.disponivel && perto(zero.total, s.regras.custo_disponibilidade_kwh.trifasico * res, 1e-9)).toBe(true);
    const ts = simular(t, "tarifa_social", s.regras.tarifa_social_limite_kwh, "trifasico", 78.77, s.regras);
    expect(ts.disponivel && perto(ts.total, 0, 1e-9)).toBe(true);
    // distribuidora sem tarifa do Desconto Social na vigência: nunca usa a de outra classe
    const sem = s.distribuidoras.find((d) => !d.tarifas.ds1 || d.tarifas.ds1[0] === null);
    if (sem) {
      const r = simular(sem.tarifas, "desconto_social", 150, "monofasico", 0, s.regras);
      expect(r.disponivel).toBe(false);
    }
    // zero publicado nas duas parcelas é tarifa não homologada, não tarifa zero
    expect(simular({ residencial: [0, 0] }, "residencial", 100, "monofasico", 0, s.regras).disponivel).toBe(false);
    expect(simular(t, "residencial", -1, "monofasico", 0, s.regras).disponivel).toBe(false);
  });
});

describe.skipIf(!disponivel)("respostas curtas derivadas dos números", () => {
  const sem = (t: string) => {
    expect(t).not.toMatch(/—/);
    expect(t).not.toMatch(/ - /);
    expect(t).not.toMatch(/undefined|NaN|null/);
  };

  it("P047: menor, maior e mediana do perfil, para cada perfil", () => {
    const { resumo, vigentes } = gold.tarifas;
    const ord = [...vigentes].sort((a, b) => a.posicao - b.posicao);
    for (const p of [100, 200, 300] as const) {
      const t = respostaTarifa(gold.data_referencia, resumo, vigentes, p);
      sem(t);
      expect(t).toContain(reais(resumo.perfis_mediana[String(p) as "100"]));
      expect(t).toContain(reais(ord[0].perfis[String(p) as "100"]));
      expect(t).toContain(reais(ord.at(-1)!.perfis[String(p) as "100"]));
      expect(t).toContain(`${resumo.n} distribuidoras`);
    }
    // muda com o número: outra mediana, outro texto
    const outro = respostaTarifa(
      gold.data_referencia,
      {
        ...resumo,
        perfis_mediana: { ...resumo.perfis_mediana, "200": 999.99 },
      },
      vigentes,
      200,
    );
    expect(outro).toContain(reais(999.99));
    const m = mudancaTarifa(gold.data_referencia, resumo, linhasEvolucao(gold.tarifas.evolucao));
    sem(m);
    expect(m).toContain(num(resumo.mediana, 2));
    expect(m).toContain(`${resumo.fora_vigencia_recente} com a vigência encerrada`);
  });

  it("P048: participação de cada grupo da média, créditos negativos e CDE", () => {
    const c = gold.composicao;
    const t = respostaComposicao(c);
    sem(t);
    for (const g of ORDEM_GRUPOS) if (c.media!.grupos_pct[g] !== null && c.media!.grupos_pct[g] !== 0) expect(t, g).toContain(pct(c.media!.grupos_pct[g], 1));
    expect(t).toContain(pct(c.cde.razao_de_somas_pct, 1));
    expect(t).toContain(`${c.media!.n} distribuidoras`);
    expect(respostaComposicao({ ...c, media: null })).toMatch(/Sem composição/);
    const m = mudancaComposicao(c);
    sem(m);
    expect(m).toContain(`${c.creditos.distribuidoras.length} distribuidoras`);
  });

  it("P049: estimativa com o rótulo, a bandeira e o motivo quando indisponível", () => {
    const s = gold.simulador;
    const alvo = s.distribuidoras.find((d) => d.cnpj === s.casos_referencia.cnpj)!;
    const r = simular(alvo.tarifas, "residencial", 150, "monofasico", 18.85, s.regras);
    const t = respostaSimulacao(r, "X", "Residencial (B1)", 150, "Amarela", s.rotulo);
    sem(t);
    expect(r.disponivel && t.includes(reais(r.total))).toBe(true);
    expect(t).toContain(s.rotulo);
    expect(respostaSimulacao({ disponivel: false, motivo: "sem tarifa" }, "X", "Rural", 10, "Verde", s.rotulo)).toContain("indisponível");
  });

  it("P050: variação contra o IPCA, com verbo pelo sinal arredondado", () => {
    for (const j of gold.reajustes.comparacao_inflacao!.janelas) {
      const t = respostaReajustes(j);
      sem(t);
      expect(t).toContain(pct(j.mediana_pct, 2));
      expect(t).toContain(pct(j.ipca_pct, 2));
      expect(t).toContain(`${j.acima_ipca} ficaram acima`);
      expect(t).toContain(`mediana de ${j.n} distribuidoras`);
    }
    const j0 = gold.reajustes.comparacao_inflacao!.janelas[0];
    const queda: JanelaInflacao = { ...j0, mediana_pct: -3.456 };
    expect(respostaReajustes(queda)).toContain(`caiu ${pct(3.456, 2)}`);
    const fora = j0.excluidas_sem_tarifa_nas_duas_datas + j0.excluidas_mudanca_perimetro.length;
    if (fora === 1) expect(respostaReajustes(j0)).toContain("Fica fora 1 distribuidora ");
    if (fora > 1) expect(respostaReajustes(j0)).toContain(`Ficam fora ${fora} distribuidoras`);
    expect(minuscula("Vermelha P1")).toBe("vermelha P1");
    expect(minuscula("Distribuição (fio B)")).toBe("distribuição (fio B)");
    expect(minuscula("Residencial (B1)")).toBe("residencial (B1)");
    expect(minuscula("CDE Escassez Hídrica")).toBe("CDE escassez hídrica");
    expect(verboVariacao(0.004)).toMatch(/estável/);
    expect(verboVariacao(-0.006)).toMatch(/^caiu/);
    expect(respostaReajustes({ ...j0, ipca_pct: null })).toMatch(/Sem comparação/);
  });

  it("P050: bandeira do mês, meses com acréscimo contados no CSV, subsídios e CDE", () => {
    const b = gold.bandeiras;
    const t = respostaBandeira(b);
    sem(t);
    const csv = lerCsv(ler("public/energia/series/conta_bandeiras.csv"));
    const comAcrescimo = csv.filter((r) => r.bandeira && r.bandeira !== "Verde").length;
    expect(t).toContain(`${comAcrescimo} dos ${csv.filter((r) => r.bandeira).length} meses`);
    expect(t.toLowerCase()).toContain(b.vigente!.bandeira!.toLowerCase());
    const s = respostaSubsidios(gold.subsidios);
    sem(s);
    const ano = gold.subsidios.anual.find((a) => a.ano === gold.subsidios.ultimo_ano_completo)!;
    expect(s).toContain(reais(ano.soma_categorias! / 1e9, 2));
    expect(s).toContain(ano.ano);
    const c = respostaCde(gold.financiamento_cde);
    sem(c);
    const tt = gold.financiamento_cde!.totais.find((x) => x.ano === gold.financiamento_cde!.ultimo_ano)!;
    expect(c).toContain(pct(tt.quotas_pct, 1));
    expect(c).toContain(pct(tt.tarifa_social_pct, 1));
    expect(respostaCde(null)).toMatch(/não foi publicado/);
    sem(mudancaSubsidios(gold.subsidios));
  });

  it("histórico: última mudança, IPCA e mudança de perímetro dita quando há", () => {
    const h = JSON.parse(ler(gold.tarifas.historico_url.replace(/^\//, "public/"))) as HistoricoB1;
    const rge = h.distribuidoras["02016440000162"];
    const t = respostaHistorico("RGE", rge.eventos, rge.vigencias);
    sem(t);
    expect(t).toContain(`${rge.eventos.length} mudanças`);
    const comPerimetro = rge.eventos.filter((e) => e[11]);
    expect(comPerimetro.length).toBeGreaterThan(0);
    const soAteIncorporacao = rge.eventos.filter((e) => e[0] <= comPerimetro[0][0]);
    expect(respostaHistorico("RGE", soAteIncorporacao, rge.vigencias)).toMatch(/perímetro/);
  });
});

describe("estado compartilhado na URL (?dist=)", () => {
  it("destaque vai para o início, sem repetir e sem passar de quatro; CNPJ inválido no link é descartado", () => {
    expect(destacar(["1", "2", "3", "4"], "5")).toEqual(["5", "1", "2", "3"]);
    expect(destacar(["1", "2"], "2")).toEqual(["2", "1"]);
    expect(remover(["1", "2"], "1")).toEqual(["2"]);
    const esquema = { dist: CAMPO_DIST };
    expect(lerEstado(esquema, "?dist=06981180000116,abc,0698118000011,23664303000104").dist).toEqual(["06981180000116", "23664303000104"]);
    expect(lerEstado(esquema, "?modo=analisar").dist).toEqual([]);
    expect(lerEstado(esquema, "?dist=1,2,3,4,5").dist).toEqual([]);
  });
});

describe("verbetes do módulo (conceitos-conta.ts)", () => {
  const bronze = join(raiz, "data/energia/bronze/aneel/normas_conta");
  /** Texto visível de cada captura da página no bronze (sem tags, entidades decodificadas, espaços colapsados). */
  function capturas(dir: string): string[] {
    if (!existsSync(join(bronze, dir))) return [];
    return readdirSync(join(bronze, dir)).map((f) =>
      gunzipSync(readFileSync(join(bronze, dir, f)))
        .toString("utf-8")
        .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " "),
    );
  }
  const PAGINAS: Record<string, string> = {
    "https://www.gov.br/aneel/pt-br/assuntos/tarifas/entenda-a-tarifa/custo-da-energia-que-chega-aos-consumidores": "aneel_custo_energia",
    "https://www.gov.br/aneel/pt-br/assuntos/tarifas/bandeiras-tarifarias": "aneel_bandeiras",
    "https://www.gov.br/aneel/pt-br/assuntos/geracao-distribuida": "aneel_geracao_distribuida",
    "https://www.gov.br/aneel/pt-br/assuntos/tarifas/tarifa-social": "aneel_tarifa_social",
    "https://www.gov.br/aneel/pt-br/assuntos/tarifas/gestao-de-recursos-tarifarios": "aneel_gestao_recursos_tarifarios",
  };

  it("todo verbete conferido tem data de hoje, trecho e fonte oficial; os slugs usados na página existem", () => {
    for (const c of CONCEITOS_CONTA) {
      expect(c.estado, c.slug).toBe("CONFERIDO");
      expect(c.conferidoEm, c.slug).toBe("2026-09-30");
      expect(
        c.fontes.some((f) => (f.trecho ?? "").length > 40),
        c.slug,
      ).toBe(true);
      expect(`${c.emUmaFrase} ${c.porQueImporta} ${c.comoEMedido}`, c.slug).not.toMatch(/—/);
    }
    const pagina = ler("src/app/setor-eletrico/conta-de-luz/page.tsx") + ler("src/app/setor-eletrico/conta-de-luz/reajustes-e-subsidios/page.tsx");
    for (const m of Array.from(pagina.matchAll(/<Termo slug="([^"]+)"/g))) expect(conceito(m[1]), m[1]).toBeTruthy();
  });

  it.skipIf(!existsSync(bronze))("cada trecho das páginas da ANEEL está, letra por letra, na captura guardada no bronze", () => {
    for (const c of CONCEITOS_CONTA) {
      for (const f of c.fontes) {
        const dir = PAGINAS[f.url];
        if (!dir || !f.trecho) continue;
        const textos = capturas(dir);
        expect(textos.length, `${c.slug}: ${dir}`).toBeGreaterThan(0);
        for (const parte of f.trecho
          .split("[...]")
          .map((x) => x.trim())
          .filter(Boolean)) {
          expect(
            textos.some((t) => t.includes(parte)),
            `${c.slug}: ${parte.slice(0, 60)}`,
          ).toBe(true);
        }
      }
    }
  });
});

/** Texto como o React escreve no HTML (escapa &, <, >, aspas e apóstrofo). */
const escapar = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

describe.skipIf(!disponivel)("páginas renderizadas no servidor", () => {
  const html = renderToStaticMarkup(createElement(ContaDeLuzPage));
  const htmlP050 = renderToStaticMarkup(createElement(ContaReajustesPage));

  it("página principal: P047, P048 e P049 completos e o resumo da P050, na ordem, com a pergunta como título", () => {
    let ultimo = -1;
    for (const id of ["p047", "p048", "p049", "p050"]) {
      const i = html.indexOf(`id="${id}"`);
      expect(i, id).toBeGreaterThan(ultimo);
      ultimo = i;
    }
    // redesenho: a pergunta da página é o título da página ("Quanto custa o mesmo consumo?") e o painel de tarifas tem o título da
    // primeira figura, que não a repete (antes, o título do painel era "Quanto custa um perfil comparável em cada distribuidora?")
    for (const q of [
      "Quanto custa o mesmo consumo?",
      "O mesmo consumo, da menor à maior tarifa",
      "Para onde vai o valor da conta?",
      "Como a minha conta varia com o consumo e o perfil?",
      "O que mudou e quem financia os benefícios?",
    ]) {
      expect(html).toContain(q);
    }
    // o resumo da P050 leva à página própria
    expect(html).toContain('href="/setor-eletrico/conta-de-luz/reajustes-e-subsidios#reajustes"');
    expect(html).toContain('href="/setor-eletrico/conta-de-luz/reajustes-e-subsidios#subsidios"');
  });

  it("página da P050: reajustes, bandeiras e subsídios, na ordem", () => {
    let ultimo = -1;
    for (const id of ["reajustes", "bandeiras", "subsidios"]) {
      const i = htmlP050.indexOf(`id="${id}"`);
      expect(i, id).toBeGreaterThan(ultimo);
      ultimo = i;
    }
    for (const q of ["A tarifa subiu mais que a inflação?", "Quando a bandeira encareceu a conta?", "Quem financia os descontos e benefícios da conta?"])
      expect(htmlP050).toContain(q);
    expect(htmlP050).toContain('href="/setor-eletrico/conta-de-luz"');
  });

  it("respostas derivadas, recorte (período, universo, unidade), tabelas equivalentes e exportação", () => {
    for (const r of ["p047", "p048", "p049", "p050-reajustes", "p050-bandeiras", "p050-subsidios"]) expect(html, r).toContain(`data-resposta="${r}"`);
    for (const r of ["p050-reajustes", "p050-bandeiras", "p050-subsidios"]) expect(htmlP050, r).toContain(`data-resposta="${r}"`);
    expect((html.match(/>Período</g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect((html.match(/>Universo</g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect((htmlP050.match(/>Período</g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect((html.match(/<table/g) ?? []).length).toBeGreaterThanOrEqual(5);
    expect((htmlP050.match(/<table/g) ?? []).length).toBeGreaterThanOrEqual(5);
    expect(html).toContain("Tarifas B1 residenciais vigentes e custo por perfil");
    expect(html).toContain("Decomposição: média, mediana");
    expect(html).toContain("Memória de cálculo");
    expect(htmlP050).toContain("Bandeira acionada por mês e ano");
    expect(html).toMatch(/Baixar CSV/);
    expect(htmlP050).toMatch(/Baixar CSV/);
    // a resposta do servidor é a da função testada (perfil padrão de 200 kWh), e a da janela de 12 meses idem
    expect(html).toContain(escapar(respostaTarifa(gold.data_referencia, gold.tarifas.resumo, gold.tarifas.vigentes, 200)));
    expect(html).toContain(escapar(respostaComposicao(gold.composicao)));
    const j12 = gold.reajustes.comparacao_inflacao!.janelas.find((j) => j.meses === 12)!;
    expect(htmlP050).toContain(escapar(respostaReajustes(j12)));
    expect(html).toContain(escapar(respostaReajustes(j12)));
    expect(htmlP050).toContain(escapar(respostaBandeira(gold.bandeiras)));
  });

  it("provas, links compartilháveis, próxima pergunta e profundidade", () => {
    expect((html.match(/Comprove este número/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect((htmlP050.match(/Comprove este número/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect((html.match(/Copiar link deste painel/g) ?? []).length).toBe(3);
    expect((htmlP050.match(/Copiar link deste painel/g) ?? []).length).toBe(3);
    expect((html.match(/Próxima pergunta/g) ?? []).length).toBe(3);
    expect((htmlP050.match(/Próxima pergunta/g) ?? []).length).toBe(3);
    for (const h of [html, htmlP050]) {
      expect(h).toContain('data-nivel="analisar"');
      expect(h).toContain('data-nivel="auditar"');
    }
    expect(html).toContain('href="#composicao"');
    expect(html).toContain('href="/setor-eletrico/conta-de-luz/reajustes-e-subsidios#reajustes"');
    expect(htmlP050).toContain('href="/setor-eletrico/pld"');
  });

  it("estados honestos: sem 'em breve' nem travessão, ausências explicadas, cores só por variável", () => {
    for (const h of [html, htmlP050]) {
      const main = h.slice(h.indexOf('<main id="conteudo"'));
      expect(main).not.toMatch(/em breve|em integração|em construção/i);
      expect(h).not.toContain("—");
    }
    expect(htmlP050).toContain("Efeito médio do processo tarifário: não publicado");
    expect(html).toContain("Tarifa média de fornecimento (não publicada)");
    for (const f of [
      "ContaTarifas",
      "ContaHistorico",
      "ContaComposicao",
      "ContaSimulador",
      "ContaReajustes",
      "ContaBandeiras",
      "ContaLinkPainel",
      "ContaSobDemanda",
      "ContaControles",
      "ContaReferencias",
      "ContaFaixa",
      "ContaSerieReal",
    ]) {
      expect(ler(`src/components/energia/${f}.tsx`), f).not.toMatch(/#[0-9a-fA-F]{6}\b/);
    }
    for (const f of ["page.tsx", "partes.tsx", "reajustes-e-subsidios/page.tsx"]) {
      expect(ler(`src/app/setor-eletrico/conta-de-luz/${f}`), f).not.toMatch(/#[0-9a-fA-F]{6}\b/);
    }
    for (const f of ["page.tsx", "reajustes-e-subsidios/page.tsx"]) expect(ler(`src/app/setor-eletrico/conta-de-luz/${f}`)).toMatch(/export const dynamic = "force-static"/);
  });

  it("peso: HTML do servidor de cada página bem abaixo da meta de 600 KB (sobra para o fluxo RSC das props)", () => {
    expect(Buffer.byteLength(html, "utf-8")).toBeLessThan(400_000);
    expect(Buffer.byteLength(htmlP050, "utf-8")).toBeLessThan(400_000);
  });
});

/**
 * Revisão da interface (30/09/2026). Cada caso protege um defeito encontrado e
 * corrigido na revisão: destaque sem prova, citação apontando para a página
 * errada, número fixo em texto, ausência dita como zero e controle que estoura a
 * largura da página no celular.
 */
describe.skipIf(!disponivel)("revisão da interface: defeitos corrigidos não voltam", () => {
  const fontes = {
    principal: ler("src/app/setor-eletrico/conta-de-luz/page.tsx"),
    p050: ler("src/app/setor-eletrico/conta-de-luz/reajustes-e-subsidios/page.tsx"),
  };
  const html = renderToStaticMarkup(createElement(ContaDeLuzPage));
  const htmlP050 = renderToStaticMarkup(createElement(ContaReajustesPage));
  const blocosNumero = (src: string) => Array.from(src.matchAll(/<Numero\b[\s\S]*?\/>/g)).map((m) => m[0]);

  it('todo destaque (Numero) das duas páginas leva a evidência do "Comprove este número"', () => {
    for (const [nome, src] of Object.entries(fontes)) {
      const blocos = blocosNumero(src);
      expect(blocos.length, nome).toBeGreaterThan(0);
      for (const b of blocos) expect(b, `${nome}: ${b.slice(0, 80)}`).toMatch(/\bevidencia=\{/);
    }
  });

  it("a citação de cada destaque aponta para a página e a âncora onde o número está", () => {
    for (const b of blocosNumero(fontes.principal)) {
      const m = b.match(/endereco="\/setor-eletrico\/conta-de-luz#([a-z0-9-]+)"/);
      expect(m, b.slice(0, 80)).toBeTruthy();
      expect(html).toContain(`id="${m![1]}"`);
    }
    for (const b of blocosNumero(fontes.p050)) {
      const m = b.match(/endereco=\{`\$\{ROTA_REAJUSTES\}#([a-z0-9-]+)`\}/);
      expect(m, b.slice(0, 80)).toBeTruthy();
      expect(htmlP050).toContain(`id="${m![1]}"`);
    }
  });

  it("o valor do destaque é o valor exibido da sua evidência", () => {
    // reais() escreve espaço não separável entre "R$" e o número; a evidência, espaço comum
    const esp = (t: string) => t.replace(/\s/g, " ");
    const sub = gold.subsidios.evidencia!;
    expect(esp(htmlP050)).toContain(esp(reais(sub.valor_calculo! / 1e9, 1)));
    expect(esp(sub.valor_exibido)).toContain(esp(reais(sub.valor_calculo! / 1e9, 1)));
    const band = gold.bandeiras.evidencia!;
    expect(esp(band.valor_exibido)).toContain(esp(reais(band.valor_calculo! / 1000, 5)));
    expect(esp(htmlP050)).toContain(esp(reais(band.valor_calculo! / 1000, 5)));
  });

  it("textos das páginas sem número fixo de regra: limites e janelas vêm da gold", () => {
    // regra de cobertura da mediana, início do arquivo e janelas de comparação não ficam escritos no código
    expect(fontes.principal).not.toMatch(/80% do maior número|fevereiro de 2010|desconto de 100%/);
    expect(fontes.p050).not.toMatch(/janelas de 12, 60 e 120|desde 2015/);
    // observações do simulador seguem o limite publicado: com outro limite, outro texto
    const s = gold.simulador;
    const alvo = s.distribuidoras.find((d) => d.cnpj === s.casos_referencia.cnpj)!;
    const outro = { ...s.regras, tarifa_social_limite_kwh: 50 };
    const r = simular(alvo.tarifas, "tarifa_social", 120, "monofasico", 18.85, outro);
    expect(r.disponivel).toBe(true);
    if (r.disponivel) {
      const texto = [...r.linhas.map((l) => l.rotulo), ...r.observacoes].join(" ");
      expect(texto).toContain("50 kWh");
      expect(texto).not.toContain("80 kWh");
    }
  });

  it("bandeira sem adicional publicado é dita como ausente, nunca como 'sem acréscimo'", () => {
    const s = gold.simulador;
    const alvo = s.distribuidoras.find((d) => d.cnpj === s.casos_referencia.cnpj)!;
    const r = simular(alvo.tarifas, "residencial", 150, "monofasico", null, s.regras);
    const t = respostaSimulacao(r, "X", "Residencial (B1)", 150, null, s.rotulo);
    expect(t).toContain("não está publicado");
    expect(t).not.toContain("sem acréscimo");
    // e o rótulo de estimativa não ganha ponto duplo ao lado da vigência
    expect(html).not.toContain("iluminação pública.. ");
  });

  it("controles de formulário do simulador ocupam a coluna (a opção mais longa não alarga a página no celular)", () => {
    const sim = ler("src/components/energia/ContaSimulador.tsx");
    const selects = Array.from(sim.matchAll(/<select[\s\S]*?<\/select>/g)).map((m) => m[0]);
    expect(selects.length).toBeGreaterThan(0);
    for (const sel of selects) expect(sel).toContain("className={CLASSE_SELECT}");
    expect(sim).toMatch(/const CLASSE_SELECT = "[^"]*\bw-full\b[^"]*\bmin-w-0\b/);
    // largura mínima fixa só em tabela que mora dentro de um contêiner rolável (.tabela-scroll ainda aberto)
    const arquivos = [
      "src/components/energia/ContaComposicao.tsx",
      "src/components/energia/ContaSimulador.tsx",
      "src/components/energia/ContaBandeiras.tsx",
      "src/app/setor-eletrico/conta-de-luz/reajustes-e-subsidios/page.tsx",
    ];
    for (const f of arquivos) {
      const src = ler(f);
      for (const m of Array.from(src.matchAll(/min-w-\[\d+px\]/g))) {
        const antes = src.slice(0, m.index);
        const rolavel = antes.lastIndexOf('className="tabela-scroll');
        expect(rolavel, `${f}: ${m[0]}`).toBeGreaterThan(-1);
        expect(antes.slice(rolavel), `${f}: ${m[0]} fora do contêiner rolável`).not.toContain("</div>");
      }
    }
  });
});
