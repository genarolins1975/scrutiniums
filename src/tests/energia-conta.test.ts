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
  CAMPO_GRUPO,
  CAMPO_PERFIL,
  CAMPO_UF,
  CASO_EVIDENCIA_SIMULADOR,
  COLUNAS_JANELA,
  COLUNAS_RANKING,
  GRUPOS_DESPESA_CDE,
  ID_MEDIA,
  ORDEM_GRUPOS,
  REGRAS_DA_CLASSE,
  ROTULO_TIPO,
  arredondar,
  buscarMunicipios,
  categoriasSubsidio,
  compactarComposicao,
  compactarDistribuidorasSim,
  compactarEntidades,
  compactarInfo,
  compactarLinhasTabela,
  compactarVigentes,
  expandirComposicao,
  expandirDistribuidorasSim,
  expandirEntidades,
  expandirInfo,
  expandirLinhasTabela,
  expandirVigentes,
  colunasComposicao,
  compararMesmoConjunto,
  comProcedimentoExterno,
  criarIndiceMunicipios,
  custoDoPerfil,
  descricaoDaTarifa,
  destacar,
  destaquesDoPerfil,
  emReaisDoMesBase,
  empilharPontos,
  fatoresReaisPorAno,
  filtrarRanking,
  igualdadeComResidencial,
  infoDistribuidoras,
  janelasNoMesmoConjunto,
  leiturasNaoConferidas,
  lerIpcaCsv,
  mediana,
  prepararBuscaMunicipios,
  receitasQueZeraram,
  resumoDoRanking,
  serieQuotas,
  textoComparacaoMesmoConjunto,
  textoJanelasNoMesmoConjunto,
  textoResidualQuotas,
  textoResumoDoRanking,
  textoTresValoresTipicos,
  ufsDoRanking,
  gradeBandeiras,
  idsComposicaoPadrao,
  linhasCde,
  linhasComposicao,
  linhasComposicaoGrafico,
  linhasEvolucao,
  linhasGrupos,
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
  VALORES_NOMINAIS,
  PISO_COBERTURA_UCS,
  categoriasQueZeraram,
  coberturaDoRanking,
  dicaDaRegua,
  expandirFora,
  compactarFora,
  foraDoRanking,
  marcaBase,
  medianaPonderada,
  medianaPonderadaDoPerfil,
  reguaDoRanking,
  resumoForaDoRanking,
  textoCobertura,
  textoForaDoRanking,
  textoForaDoRankingLinha,
  textoReguaDoRanking,
  textoUcs,
  textoUltimaMudanca,
  ROTULO_AJUSTE,
  linhasEmReais,
  notaQuotas,
  rotuloMoeda,
  tabelaTemReal,
  textoCategoriasQueZeraram,
  valorNoModo,
  vereditoSubsidios,
  type ValoresDoPainel,
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
    expect((html.match(/<table/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect((htmlP050.match(/<table/g) ?? []).length).toBeGreaterThanOrEqual(5);
    // a tabela do ranking só entra quando o leitor a pede (em Analisar nasce aberta): o HTML leva o botão com a contagem de linhas
    expect(html).toContain("a tabela das distribuidoras");
    expect(html).toContain(`${gold.tarifas.vigentes.length} linhas, ordenável e exportável`);
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
      "ContaPontos",
      "ContaSelecionadas",
      "ContaBuscaMunicipio",
      "ContaBarrasReais",
      "ContaTabelaSobDemanda",
    ]) {
      expect(ler(`src/components/energia/${f}.tsx`), f).not.toMatch(/#[0-9a-fA-F]{6}\b/);
    }
    for (const f of ["page.tsx", "partes.tsx", "reajustes-e-subsidios/page.tsx"]) {
      expect(ler(`src/app/setor-eletrico/conta-de-luz/${f}`), f).not.toMatch(/#[0-9a-fA-F]{6}\b/);
    }
    for (const f of ["page.tsx", "reajustes-e-subsidios/page.tsx"]) expect(ler(`src/app/setor-eletrico/conta-de-luz/${f}`)).toMatch(/export const dynamic = "force-static"/);
  });

  it("peso: o HTML estático e as props que as páginas entregam aos componentes de cliente (o fluxo do servidor) têm teto, medidos juntos", () => {
    // o HTML servido é o markup mais o fluxo do servidor (cada texto de servidor e cada prop de cliente vão uma vez no markup e outra no
    // fluxo); medir só o markup deixava a página passar de 600 KB sem o teste ver. Calibrado em 09/10/2026 contra o HTML servido por
    // `next dev` (peso decodificado): principal 443 KB aqui para 681 KB servidos, reajustes 392 KB para 622 KB (fator de 1,54 a 1,59). Depois
    // da rodada 2 (tabela do ranking só ao pedido, ranking de barras com as 12 primeiras, tabelas de 10 e 12 linhas) a medida aqui é de
    // 380 KB e 348 KB; no fator de 1,54 a 1,59 isso dá cerca de 590 KB e 550 KB servidos, SEM medida do servidor depois da mudança (o
    // servidor estava fora do ar). Este teto NÃO prova a meta de 600 KB do contrato, que a página principal tinha deixado de cumprir
    // (644 KB servidos antes da rodada 2): ele só impede que o peso volte a crescer; a medida do HTML servido continua sendo manual.
    const medida = (pagina: () => unknown, markup: string) => {
      const soma = new Map<string, number>();
      propsDeCliente(pagina(), soma);
      const props = Array.from(soma.values()).reduce((a, b) => a + b, 0);
      return { props, total: Buffer.byteLength(markup, "utf-8") + props, porComponente: soma };
    };
    const a = medida(ContaDeLuzPage as () => unknown, html);
    const b = medida(ContaReajustesPage as () => unknown, htmlP050);
    // nenhum componente de cliente leva a lista inteira de distribuidoras em objetos: as listas grandes viajam em tuplas
    for (const nome of ["ContaFaixa", "ContaTarifas", "ContaComposicao", "ContaSimulador", "ContaHistorico"]) expect(a.porComponente.get(nome) ?? 0, nome).toBeLessThan(30_000);
    expect(a.total).toBeLessThan(LIMITE_PESO_PRINCIPAL);
    expect(b.total).toBeLessThan(LIMITE_PESO_REAJUSTES);
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
    // largura mínima fixa só em tabela que mora dentro de um contêiner rolável (ContaRolavel, que liga a sombra .tabela-scroll só quando rola, ainda aberto)
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
        const rolavel = antes.lastIndexOf("<ContaRolavel");
        expect(rolavel, `${f}: ${m[0]}`).toBeGreaterThan(-1);
        expect(antes.slice(rolavel), `${f}: ${m[0]} fora do contêiner rolável`).not.toContain("</ContaRolavel>");
      }
    }
  });
});

/**
 * Redesenho da Conta de luz (sistema editorial). O que estes casos protegem:
 *  - as referências do perfil (menor, mediana, maior e quartis) saem dos mesmos números que o ranking e o CSV publicado, para cada perfil;
 *  - a faixa de métricas da abertura diz o universo (quantas distribuidoras) pelo mesmo resumo e traz a ressalva junto do valor;
 *  - a série em reais tem data-base e deflator ditos, e os números do texto são os da série;
 *  - na primeira tela não há conteúdo de Analisar ou Auditar (o CSS só o esconde dentro do seletor de profundidade) e o bastidor da
 *    tarifa média de fornecimento sai de Entender, que fica com um estado curto e honesto, sem nome de campo.
 */
describe.skipIf(!disponivel)("abertura: referências do perfil, faixa de métricas e série em reais", () => {
  const { resumo, vigentes } = gold.tarifas;
  const csvVigentes = lerCsv(ler("public/energia/series/conta_tarifas_b1_vigentes.csv"));
  const PERFIS = [100, 200, 300] as const;

  it("custo do perfil: kWh × tarifa ÷ 1000 em centavos, meio centavo exato sobe e ausência continua ausência", () => {
    expect(custoDoPerfil(821.18, 200)).toBe(164.24);
    expect(custoDoPerfil(759.75, 200)).toBe(151.95);
    expect(custoDoPerfil(759.75, 100)).toBe(75.98);
    expect(custoDoPerfil(903.29, 200)).toBe(180.66);
    expect(custoDoPerfil(null, 200)).toBeNull();
    expect(custoDoPerfil(Number.NaN, 200)).toBeNull();
  });

  it("menor, mediana e maior de cada perfil são os do CSV de tarifas vigentes, lido por outro caminho", () => {
    for (const p of PERFIS) {
      const custos = csvVigentes.map((l) => Number(l[`custo_${p}kwh_rs`])).sort((a, b) => a - b);
      const r = referenciasDoPerfil(vigentes, resumo, p);
      expect(r.n, `${p} kWh`).toBe(csvVigentes.length);
      expect(r.menor!.valor, `${p} kWh`).toBe(custos[0]);
      expect(r.maior!.valor, `${p} kWh`).toBe(custos[custos.length - 1]);
      // n ímpar: a mediana é o elemento do meio; com n par, a média dos dois do meio
      const meio = custos.length % 2 ? custos[(custos.length - 1) / 2] : (custos[custos.length / 2 - 1] + custos[custos.length / 2]) / 2;
      expect(r.mediana!, `${p} kWh`).toBeCloseTo(meio, 2);
      // os nomes são os das linhas de menor e maior posição
      const porPosicao = [...csvVigentes].sort((a, b) => Number(a.posicao) - Number(b.posicao));
      expect(r.menor!.sigla).toBe(porPosicao[0].sigla);
      expect(r.maior!.sigla).toBe(porPosicao[porPosicao.length - 1].sigla);
    }
  });

  it("1º e 3º quartil do perfil são a tarifa do quartil publicada, convertida pela fórmula do perfil", () => {
    const tarifas = csvVigentes.map((l) => Number(l.total_rs_mwh)).sort((a, b) => a - b);
    const n = tarifas.length;
    // percentil por interpolação linear: com 81 distribuidoras, os quartis caem em elementos exatos
    const quartil = (q: number) => {
      const pos = q * (n - 1);
      const i = Math.floor(pos);
      return tarifas[i] + (tarifas[Math.min(i + 1, n - 1)] - tarifas[i]) * (pos - i);
    };
    expect(resumo.p25!).toBeCloseTo(quartil(0.25), 2);
    expect(resumo.p75!).toBeCloseTo(quartil(0.75), 2);
    for (const p of PERFIS) {
      const r = referenciasDoPerfil(vigentes, resumo, p);
      expect(r.p25).toBe(custoDoPerfil(resumo.p25, p));
      expect(r.p75).toBe(custoDoPerfil(resumo.p75, p));
      expect(r.p25!).toBeLessThan(r.mediana!);
      expect(r.mediana!).toBeLessThan(r.p75!);
      expect(r.tarifa).toEqual({ menor: r.menor!.tarifa, p25: resumo.p25, mediana: resumo.mediana, p75: resumo.p75, maior: r.maior!.tarifa });
    }
  });

  it("distribuidora em destaque: custo, posição e diferença para a mediana saem da mesma linha do ranking; fora do ranking não aparece", () => {
    const v = vigentes.find((x) => x.posicao === 40)!;
    const [d] = destaquesDoPerfil(vigentes, resumo, 200, [v.cnpj]);
    expect(d.valor).toBe(v.perfis["200"]);
    expect(d.posicao).toBe(40);
    expect(d.n).toBe(resumo.n);
    expect(d.diferenca).toBeCloseTo(v.perfis["200"]! - resumo.perfis_mediana["200"]!, 2);
    const t = textoDestaquePerfil(d);
    expect(t).toContain(reais(d.valor));
    expect(t).toContain(`posição 40 de ${resumo.n}`);
    expect(t).toMatch(/acima da mediana|abaixo da mediana|igual à mediana/);
    expect(destaquesDoPerfil(vigentes, resumo, 200, ["00000000000000", v.cnpj]).map((x) => x.cnpj)).toEqual([v.cnpj]);
    expect(destaquesDoPerfil(vigentes, resumo, 200, [])).toEqual([]);
    // a ordem do link é a ordem da escolha
    const outro = vigentes.find((x) => x.posicao === 7)!;
    expect(destaquesDoPerfil(vigentes, resumo, 200, [outro.cnpj, v.cnpj]).map((x) => x.cnpj)).toEqual([outro.cnpj, v.cnpj]);
  });

  it("a frase da figura nomeia o menor, a mediana e o maior do perfil, com o universo e a metade central", () => {
    for (const p of PERFIS) {
      const r = referenciasDoPerfil(vigentes, resumo, p);
      const t = textoReferenciasPerfil(r);
      for (const x of [reais(r.menor!.valor), reais(r.mediana), reais(r.maior!.valor), r.menor!.sigla, r.maior!.sigla, `${r.n} distribuidoras`, reais(r.p25), reais(r.p75)]) expect(t, `${p} kWh`).toContain(x);
      expect(t).not.toMatch(/—|undefined|NaN/);
    }
    expect(textoReferenciasPerfil({ ...referenciasDoPerfil(vigentes, resumo, 200), menor: null })).toMatch(/Sem referências/);
  });

  it("a ressalva da faixa diz que a mediana é simples, com o universo do mesmo resumo (o que a tarifa não inclui fica no limite da abertura)", () => {
    const t = notaFaixaTarifa(resumo);
    for (const x of [`${resumo.n} distribuidoras`, "Mediana simples", "sem ponderar por consumidores"]) expect(t, x).toContain(x);
    expect(t).not.toMatch(/conta final|—|hoje/i);
    // mudar o universo muda o texto: o número não está escrito na frase
    expect(notaFaixaTarifa({ ...resumo, n: 12 })).toContain("12 distribuidoras");
  });

  it("o parâmetro do perfil é um só, lido pela faixa de métricas e pelo painel de tarifas", () => {
    const esquema = { perfil: CAMPO_PERFIL };
    expect(lerEstado(esquema, "?perfil=300").perfil).toBe("300");
    expect(lerEstado(esquema, "?perfil=250").perfil).toBe("200");
    expect(lerEstado(esquema, "").perfil).toBe("200");
    expect(ler("src/components/energia/ContaFaixa.tsx")).toContain("CAMPO_PERFIL");
    expect(ler("src/components/energia/ContaTarifas.tsx")).toContain("CAMPO_PERFIL");
  });

  it("série em reais: mês-base e deflator ditos, e os números do texto são os da série", () => {
    const linhas = linhasEvolucao(gold.tarifas.evolucao);
    const ultimoIpca = gold.reajustes.comparacao_inflacao!.ultimo_ipca;
    const r = resumoSerieReal(linhas, ultimoIpca)!;
    expect(r.base).toBe(ultimoIpca);
    expect(r.inicio).toBe(linhas[0].m);
    expect(r.primeira.nominal).toBe(linhas[0].mediana);
    expect(r.primeira.real).toBe(linhas[0].real);
    // no mês-base o valor em reais é o próprio valor da época (o fator de correção é 1)
    expect(r.ultimaComReal!.m).toBe(ultimoIpca);
    expect(r.ultimaComReal!.real).toBe(r.ultimaComReal!.nominal);
    // meses depois do último IPCA publicado ficam sem valor em reais, nunca com o último índice repetido
    for (const m of r.semReal) expect(m > ultimoIpca, m).toBe(true);
    const n = linhas.filter((p) => p.mediana !== null).map((p) => p.n);
    expect([r.nMin, r.nMax]).toEqual([Math.min(...n), Math.max(...n)]);
    const t = textoSerieReal(r);
    for (const x of [mesAno(`${r.inicio}-01`), num(r.primeira.nominal, 2), num(r.primeira.real, 2), mesAno(`${ultimoIpca}-01`), "valores da época"]) expect(t, x).toContain(x);
    for (const m of r.semReal) expect(t).toContain(mesAno(`${m}-01`));
    expect(t).not.toMatch(/—|undefined|NaN|porque/);
    expect(textoSerieReal(null)).toMatch(/Sem mediana/);
    // sem IPCA publicado, a série em valores da época continua e o texto não inventa reais
    const semIpca = textoSerieReal(resumoSerieReal(linhas.map((p) => ({ ...p, real: null })), null));
    expect(semIpca).toContain("valores da época");
    expect(semIpca).not.toContain("em reais de");
  });

  it("a mudança de créditos fala da vigência pela data, não por 'atual', e mantém o resto do texto", () => {
    const c = gold.composicao;
    const m = mudancaComposicaoEm(c, gold.data_referencia);
    expect(m).toContain(`na vigência de ${dataBR(gold.data_referencia)}`);
    expect(m).not.toMatch(/\batual\b/);
    expect(m.replace(`na vigência de ${dataBR(gold.data_referencia)}`, "na vigência atual")).toBe(mudancaComposicao(c));
    expect(mudancaComposicaoEm({ ...c, creditos: { ...c.creditos, distribuidoras: [] } }, gold.data_referencia)).toBe(`Nenhum valor negativo em componente de custo na vigência de ${dataBR(gold.data_referencia)}.`);
  });
});

const ESPACOS = /[\s ]+/g;
const decodifica = (t: string) => t.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const normaliza = (t: string) => t.replace(ESPACOS, " ").trim();
const VAZIAS = new Set(["br", "img", "input", "hr", "meta", "link", "path", "circle", "rect", "line", "polygon", "polyline", "use", "source", "wbr", "col"]);

/** Texto de Entender: sem os blocos de Analisar e de Auditar, sem diálogos, svg, script e style (a mesma regra dos testes de conteúdo). */
function textoEntenderDe(html: string): string {
  const corpo = html.slice(html.indexOf("<main"));
  const saida: string[] = [];
  const ocultas: string[] = [];
  const re = /<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(corpo))) {
    if (m[5] !== undefined) {
      if (!ocultas.length) saida.push(m[5]);
      continue;
    }
    const [, fecha, tag, attrs, auto] = m;
    const t = tag.toLowerCase();
    if (VAZIAS.has(t) || auto) continue;
    if (fecha) {
      if (ocultas.length && ocultas[ocultas.length - 1] === t) ocultas.pop();
      continue;
    }
    if (ocultas.length) {
      if (ocultas[ocultas.length - 1] === t) ocultas.push(t);
      continue;
    }
    if (/data-nivel="(?:analisar|auditar)"/.test(attrs) || ["dialog", "svg", "script", "style"].includes(t)) ocultas.push(t);
    else saida.push(" ");
  }
  return normaliza(decodifica(saida.join(" ")));
}
const textoCompletoDe = (html: string) => normaliza(decodifica(html.slice(html.indexOf("<main")).replace(/<(script|style)[\s\S]*?<\/\1>/g, " ").replace(/<[^>]+>/g, " ")));
/** HTML da página até o seletor de profundidade: o que não está dentro dele nunca é escondido pelo CSS dos níveis. */
const ateAProfundidade = (html: string) => html.slice(html.indexOf("<main"), html.indexOf('class="modo-profundidade"'));
const semEspacoDuro = (t: string) => t.replace(/\s/g, " ");

describe.skipIf(!disponivel)("redesenho: primeira tela, níveis de profundidade e estados honestos", () => {
  const html = renderToStaticMarkup(createElement(ContaDeLuzPage));
  const htmlP050 = renderToStaticMarkup(createElement(ContaReajustesPage));
  const { resumo, vigentes } = gold.tarifas;

  it("nenhum conteúdo de Analisar ou de Auditar fica fora do seletor de profundidade (o CSS dos níveis só vale dentro dele)", () => {
    for (const h of [html, htmlP050]) {
      expect(h).toContain('class="modo-profundidade"');
      expect(ateAProfundidade(h)).not.toContain("data-nivel=");
    }
  });

  it("a abertura traz o preço do mesmo consumo e a ressalva junto do valor, com o universo do resumo", () => {
    const antes = semEspacoDuro(textoCompletoDe(ateAProfundidade(html).replace(/<details[\s\S]*?<\/details>/g, " ")));
    const r = referenciasDoPerfil(vigentes, resumo, 200);
    expect(ateAProfundidade(html)).toContain("<h1");
    expect(antes).toContain("Quanto custa o mesmo consumo?");
    for (const x of [r.menor!.valor, r.mediana!, r.maior!.valor]) expect(antes).toContain(semEspacoDuro(reais(x)));
    expect(antes).toContain(`Mediana simples de ${resumo.n} distribuidoras`);
    expect(antes).toContain(semEspacoDuro(escapar("Tarifa mediana simples, TE + TUSD")).replace(/&amp;/g, "&"));
    expect(antes).toContain("Ponderada pelas UCs de cada distribuidora");
    // a abertura fala de preço para o mesmo consumo, nunca de conta final
    expect(antes).not.toMatch(/conta final/i);
    expect(antes).not.toMatch(/\b(hoje|agora|atual)\b/i);
    // a ficha "Comprove este número" acompanha a tarifa mediana, a evidência que a gold publica
    expect(ateAProfundidade(html)).toContain("Comprove este número");
  });

  it("a figura das três referências vem antes do ranking, com tabela equivalente, e o título dela não repete o da página", () => {
    const i = html.indexOf('data-grafico="referencias"');
    const j = html.indexOf('data-grafico="barras"');
    expect(i).toBeGreaterThan(-1);
    expect(j).toBeGreaterThan(i);
    expect(html).toContain("Dados do gráfico em tabela (5 linhas)");
    const h1 = /<h1[^>]*>([^<]*)<\/h1>/.exec(html)![1];
    const h2 = /<h2 id="p047-titulo"[^>]*>([^<]*)<\/h2>/.exec(html)![1];
    expect(h1).not.toBe(h2);
    expect(h1.split(" ").length).toBeGreaterThanOrEqual(5);
    expect(h1.split(" ").length).toBeLessThanOrEqual(9);
  });

  it("o bastidor da tarifa média (nome de campo e motivo da coleta) sai de Entender, que fica com um estado curto e honesto", () => {
    const e = textoEntenderDe(html);
    const c = textoCompletoDe(html);
    expect(e).toContain("Tarifa média de fornecimento (não publicada)");
    expect(e).toContain("Indisponível nesta publicação");
    for (const x of ["Motivo da coleta", "DscDetalheMercado", "SAMP", "conferência de atípicos", "erro de ordem de grandeza"]) expect(e, x).not.toContain(x);
    // o conteúdo continua na página, em Analisar e em Auditar
    expect(c).toContain("Motivo da coleta");
    expect(c).toContain("DscDetalheMercado");
    // as três definições seguem à vista, com a homologada, a média e a simulada
    for (const x of ["Tarifa homologada (usada aqui)", "Conta simulada (estimativa)", gold.definicoes.tarifa_homologada, gold.definicoes.conta_simulada]) expect(e, x).toContain(x);
    expect(html.indexOf("Três números que costumam ser chamados de conta de luz")).toBeGreaterThan(html.indexOf('id="p047"'));
  });

  it("texto de Entender sem palavra de tempo relativo, travessão, undefined ou NaN", () => {
    for (const [nome, h] of [
      ["principal", html],
      ["reajustes", htmlP050],
    ] as const) {
      // "Recorte atual" é o rótulo da tabela interativa compartilhada (fora desta família): relatado, não alterado
      const e = textoEntenderDe(h).replace(/Recorte atual/g, "");
      expect(e, nome).not.toMatch(/\b(hoje|agora|atual|atuais)\b/i);
      expect(e, nome).not.toMatch(/—|–|\bundefined\b|\bNaN\b/);
    }
  });

  it("página filha: faixa de páginas irmãs com a atual marcada, sem a trilha antiga, e cada medida de destaque dentro do seu painel", () => {
    expect(htmlP050).toContain('data-navegacao-local="faixa"');
    expect(htmlP050).toMatch(/aria-current="page"[^>]*>Reajustes, bandeiras e subsídios</);
    expect(htmlP050).not.toContain('aria-label="Trilha"');
    // a página principal leva a mesma faixa, com a aba dela marcada e a da página irmã à vista no alto
    expect(html).toContain('data-navegacao-local="faixa"');
    expect(html).toMatch(/aria-current="page"[^>]*>Tarifas, composição e simulador</);
    expect(html).toMatch(/<a href="\/setor-eletrico\/conta-de-luz\/reajustes-e-subsidios"[^>]*>Reajustes, bandeiras e subsídios</);
    expect(html.indexOf('data-navegacao-local="faixa"')).toBeLessThan(html.indexOf("<h1"));
    // a abertura da filha não leva faixa de métricas (as quatro medidas ficam nos painéis, e a primeira figura aparece na primeira tela)
    expect(ateAProfundidade(htmlP050)).not.toContain("data-faixa-metricas");
    const painel = (id: string) => htmlP050.indexOf(`id="${id}"`);
    const dentro = (rotulo: string, de: string, ate: string | null) => {
      const i = htmlP050.indexOf(rotulo);
      expect(i, rotulo).toBeGreaterThan(painel(de));
      if (ate) expect(i, rotulo).toBeLessThan(painel(ate));
    };
    dentro("Variação mediana da tarifa B1 em 12 meses", "reajustes", "bandeiras");
    dentro("Adicional de amarela em set/2026", "bandeiras", "subsidios");
    dentro("Subsídios tarifários em 2025", "subsidios", null);
    dentro("Quotas nas receitas da CDE, orçamento de 2026", "subsidios", null);
    // o resumo da página principal é o caminho até a página filha (capítulos), uma vez só
    expect((html.match(/data-navegacao-local="capitulos"/g) ?? []).length).toBe(1);
  });

  it("o simulador, o ranking e a tabela continuam à vista em Entender, com o mesmo texto de antes", () => {
    const e = textoEntenderDe(html);
    expect(e).toContain("Memória de cálculo");
    expect(e).toContain(`A lista começa pela distribuidora mais barata e segue até a mais cara (${vigentes.length} no total)`);
    expect(e).toContain("As parcelas somam R$ 126,01 e o total é R$ 126,00");
  });

  it("os destaques de ContaFaixa sem ficha são só os três do perfil, e a tarifa mediana leva a evidência da gold", () => {
    const src = ler("src/components/energia/ContaFaixa.tsx");
    const blocos = Array.from(src.matchAll(/<Numero\b[\s\S]*?\/>/g)).map((m) => m[0]);
    expect(blocos.length).toBe(4);
    const semFicha = blocos.filter((b) => !/\bevidencia=\{/.test(b));
    expect(semFicha.length).toBe(3);
    for (const b of semFicha) expect(b).toMatch(/formato="reais"[\s\S]*unidade="R\$\/mês"/);
    expect(blocos.filter((b) => /evidencia=\{evidenciaMediana\}/.test(b)).length).toBe(1);
  });
});

/* ============================================================================================================================
 * Segunda passada (avaliações iniciais de 09/10/2026): os seletores novos, conferidos por outro caminho que o do código (laços
 * próprios sobre os arquivos publicados) e, quando existe, contra o número que a própria gold publica.
 * ========================================================================================================================== */

const historico = JSON.parse(ler("public/energia/series/conta_historico_b1.json")) as HistoricoB1;
const qualidadeGold = JSON.parse(ler("public/energia/gold/qualidade.json")) as { distribuidoras: { cnpj: string; classificacao?: string; ucs?: number; ano?: number }[] };
const territorioGold = JSON.parse(ler("public/energia/gold/territorio.json")) as { distribuidoras: { cnpj: string; area?: { ufs?: string[] } }[] };

/** Mediana escrita aqui por outro caminho (ordenação e meio da lista), sem o código da página. */
function medianaDeFora(xs: number[]): number {
  const o = [...xs].sort((a, b) => a - b);
  const n = o.length;
  return n % 2 ? o[(n - 1) / 2] : (o[n / 2 - 1] + o[n / 2]) / 2;
}
/** Tarifa de um dia lida da linha do tempo, por laço próprio. */
function tarifaDeFora(vig: HistoricoB1["distribuidoras"][string]["vigencias"], dia: string): number | null {
  const v = vig.filter((x) => x[0] <= dia && dia <= x[1]);
  return v.length ? v[0][5] : null;
}

describe.skipIf(!disponivel)("aritmética e medianas novas", () => {
  it("arredondar: meio para cima sobre o decimal, simétrico no zero, sem o resíduo binário", () => {
    expect(arredondar(795.965, 2)).toBe(795.97);
    expect(arredondar(443.545, 2)).toBe(443.55);
    expect(arredondar(-1.95, 1)).toBe(-2);
    expect(arredondar(1.95, 1)).toBe(2);
    expect(arredondar(0.1 + 0.2, 2)).toBe(0.3);
    expect(arredondar(0, 2)).toBe(0);
    expect(Object.is(arredondar(-0.001, 2), -0)).toBe(false);
    expect(arredondar(Number.NaN, 2)).toBeNaN();
  });

  it("mediana: valor do meio, média dos dois centrais no número par e null sem valores", () => {
    expect(mediana([3, 1, 2])).toBe(2);
    expect(mediana([4, 1, 3, 2])).toBe(2.5);
    expect(mediana([])).toBeNull();
    expect(mediana([Number.NaN, 5])).toBe(5);
  });

  it("a mediana mensal da gold sai da linha do tempo de cada distribuidora no dia 1º, com o mesmo n (a regra da evolução)", () => {
    let comparados = 0;
    let divergentes = 0;
    for (const [m, n, publicada] of gold.tarifas.evolucao) {
      const xs = Object.values(historico.distribuidoras)
        .map((d) => tarifaDeFora(d.vigencias, `${m}-01`))
        .filter((x): x is number => x !== null);
      expect(xs.length, m).toBe(n);
      if (publicada === null) continue;
      comparados++;
      const exata = medianaDeFora(xs);
      // a função da página faz o mesmo cálculo
      expect(mediana(xs), m).toBe(exata);
      // o pipeline arredonda o empate exato (média de dois valores que diferem por um número ímpar de centavos) pelo valor binário e a
      // página, pela regra do meio para cima sobre o decimal: só nesses meses a diferença existe, e é de R$ 0,01
      const empate = Math.abs(exata * 1000 - Math.round(exata * 1000)) < 1e-6 && Math.round(exata * 1000) % 10 === 5;
      if (arredondar(exata, 2) !== publicada) {
        expect(empate, m).toBe(true);
        expect(Math.abs(arredondar(exata, 2) - publicada), m).toBeLessThanOrEqual(0.0100001);
        divergentes++;
      }
    }
    expect(comparados).toBeGreaterThan(100);
    // fora dos empates a página reproduz o número publicado: a divergência é minoria
    expect(divergentes).toBeLessThan(comparados / 4);
  });

  it("janelas: a mediana publicada de cada janela é a mediana das suas linhas (o método vale para o conjunto inteiro)", () => {
    for (const j of gold.reajustes.comparacao_inflacao!.janelas) {
      const xs = j.distribuidoras.map((d) => d[2]).filter((x): x is number => x !== null);
      expect(xs.length, `${j.meses}`).toBe(j.n);
      expect(arredondar(mediana(xs) as number, 2), `${j.meses}`).toBe(j.mediana_pct);
    }
  });
});

describe.skipIf(!disponivel)("a mesma base de comparação: mediana nas distribuidoras com tarifa nas duas datas", () => {
  const evolucao = linhasEvolucao(gold.tarifas.evolucao);
  const c = compararMesmoConjunto({ vigentes: gold.tarifas.vigentes, semVigente: gold.tarifas.sem_vigente, historico: historico.distribuidoras, evolucao, dataReferencia: gold.data_referencia })!;

  it("conjuntos e medianas batem com o laço próprio sobre a linha do tempo", () => {
    expect(c).toBeTruthy();
    const ult = [...evolucao].reverse().find((p) => p.mediana !== null)!;
    expect(c.de).toBe(`${ult.m}-01`);
    expect(c.ate).toBe(gold.data_referencia);
    const emDe = new Map<string, number>();
    for (const [cnpj, d] of Object.entries(historico.distribuidoras)) {
      const t = tarifaDeFora(d.vigencias, c.de);
      if (t !== null) emDe.set(cnpj, t);
    }
    const vig = new Map(gold.tarifas.vigentes.map((v) => [v.cnpj, v.total]));
    const comuns = gold.tarifas.vigentes.filter((v) => emDe.has(v.cnpj));
    const saidos = Array.from(emDe.keys()).filter((k) => !vig.has(k));
    expect(c.nDe).toBe(emDe.size);
    expect(c.nAte).toBe(gold.tarifas.resumo.n);
    expect(c.nComum).toBe(comuns.length);
    expect(c.saidas.n).toBe(saidos.length);
    // nde = comuns + saídas: ninguém sai e entra ao mesmo tempo
    expect(c.nDe).toBe(c.nComum + c.saidas.n);
    expect(c.medianaDeTodas).toBe(ult.mediana);
    expect(c.medianaDeComum).toBe(arredondar(medianaDeFora(comuns.map((v) => emDe.get(v.cnpj) as number)), 2));
    expect(c.medianaAteComum).toBe(arredondar(medianaDeFora(comuns.map((v) => v.total)), 2));
    expect(c.saidas.mediana).toBe(arredondar(medianaDeFora(saidos.map((k) => emDe.get(k) as number)), 2));
    expect(c.variacaoPct).toBe(arredondar((medianaDeFora(comuns.map((v) => v.total)) / medianaDeFora(comuns.map((v) => emDe.get(v.cnpj) as number)) - 1) * 100, 2));
    // quando todas as vigentes tinham tarifa na data de partida, a mediana final do conjunto comum é a publicada no ranking
    if (c.nComum === gold.tarifas.resumo.n) expect(c.medianaAteComum).toBe(gold.tarifas.resumo.mediana);
  });

  it("os números da avaliação de 09/10/2026 (102 e 81 distribuidoras, 819,75 e 0,17%, 21 que saíram com 746,92) saem dos dados", () => {
    if (gold.data_referencia !== "2026-09-30") return;
    expect([c.nDe, c.nAte, c.nComum, c.saidas.n]).toEqual([102, 81, 81, 21]);
    expect([c.medianaDeTodas, c.medianaDeComum, c.medianaAteComum, c.variacaoPct, c.saidas.mediana]).toEqual([795.97, 819.75, 821.18, 0.17, 746.92]);
    expect(c.saidas.cooperativas).toBe(21);
    expect(c.saidas.fimDaVigencia).toBe("2026-09-29");
  });

  it("o texto diz a variação no mesmo conjunto, quem saiu e o limite, sem causalidade nem tempo relativo", () => {
    const t = textoComparacaoMesmoConjunto(c);
    expect(t).toContain(`Nas mesmas ${c.nComum} distribuidoras`);
    for (const v of [c.medianaDeComum, c.medianaAteComum, c.medianaDeTodas, c.saidas.mediana]) expect(t).toContain(num(v, 2));
    expect(t).toContain(`as ${c.saidas.n} que ficaram fora do ranking`);
    expect(t).toContain("mistura conjuntos diferentes");
    expect(t).not.toMatch(/\b(hoje|agora|atual|porque|por isso)\b/i);
    expect(t).not.toMatch(/—|–/);
    // sem ninguém fora, só a frase da variação
    expect(textoComparacaoMesmoConjunto({ ...c, saidas: { ...c.saidas, n: 0 } })).not.toContain("mistura conjuntos");
    // a mudança do painel e a ressalva da faixa leem a mesma comparação
    const m = mudancaTarifa(gold.data_referencia, gold.tarifas.resumo, evolucao, c);
    expect(m).toContain(t);
    expect(notaFaixaTarifa(gold.tarifas.resumo, c)).toContain(`eram ${c.nDe}: ${c.saidas.n} saíram do conjunto`);
    expect(notaFaixaTarifa(gold.tarifas.resumo, { ...c, saidas: { ...c.saidas, n: 0 } })).toBe(notaFaixaTarifa(gold.tarifas.resumo));
  });

  it("sem mês com mediana publicada, não há comparação", () => {
    expect(compararMesmoConjunto({ vigentes: [], semVigente: [], historico: {}, evolucao: [], dataReferencia: "2026-09-30" })).toBeNull();
  });
});

describe.skipIf(!disponivel)("três valores típicos: o que cada um é e em que diferem", () => {
  it("a frase traz a média, a mediana das mesmas e a mediana do ranking, com os conjuntos de cada uma", () => {
    const t = textoTresValoresTipicos(gold.composicao, gold.tarifas.resumo)!;
    const m = gold.composicao.media!;
    expect(t).toContain(`${num(m.total_rs_mwh, 2)} R$/MWh`);
    expect(t).toContain(num(gold.composicao.mediana.mediana_do_total_rs_mwh, 2));
    expect(t).toContain(num(gold.tarifas.resumo.mediana, 2));
    expect(t).toContain(`${m.n} distribuidoras têm componentes publicadas e ${gold.tarifas.resumo.n} têm tarifa vigente`);
    expect(t).not.toMatch(/\b(hoje|agora|atual|porque)\b/i);
    // no mesmo conjunto, a frase diz que as medianas coincidem em conjunto
    expect(textoTresValoresTipicos(gold.composicao, { ...gold.tarifas.resumo, n: m.n })).toContain(`as duas medianas usam o mesmo conjunto de ${m.n}`);
    expect(textoTresValoresTipicos({ media: null, mediana: gold.composicao.mediana }, gold.tarifas.resumo)).toBeNull();
  });
});

describe.skipIf(!disponivel)("UF, tipo e UCs de cada distribuidora, grupos de pares e filtro por UF", () => {
  const cnpjs = gold.tarifas.vigentes.map((v) => v.cnpj);
  const info = infoDistribuidoras(cnpjs, qualidadeGold.distribuidoras, territorioGold.distribuidoras);

  it("todas as distribuidoras do ranking têm tipo, UCs e UF, lidos das golds de Qualidade e de Território", () => {
    for (const cnpj of cnpjs) {
      const i = info[cnpj];
      expect(i.tipo, cnpj).not.toBeNull();
      expect(i.ucs, cnpj).toBeGreaterThan(0);
      expect(i.uf, cnpj).toMatch(/^[A-Z]{2}(, [A-Z]{2})*$/);
      const q = qualidadeGold.distribuidoras.find((x) => x.cnpj === cnpj)!;
      expect(ROTULO_TIPO[i.tipo!]).toBe(q.classificacao);
      expect(i.ucs).toBe(q.ucs);
      expect(i.anoUcs).toBe(q.ano);
      expect(i.uf!.split(", ")).toEqual([...territorioGold.distribuidoras.find((x) => x.cnpj === cnpj)!.area!.ufs!].sort());
    }
  });

  it("ausência continua ausência: sem a gold, nada é inventado", () => {
    const vazio = infoDistribuidoras(["12345678000199"], null, null)["12345678000199"];
    expect(vazio).toEqual({ uf: null, tipo: null, ucs: null, anoUcs: null });
    expect(infoDistribuidoras(["1"], [{ cnpj: "1", classificacao: "Outra" }], [{ cnpj: "1", area: { ufs: [] } }])["1"]).toEqual({ uf: null, tipo: null, ucs: null, anoUcs: null });
  });

  it("as linhas do ranking levam UF, tipo e UCs, e as colunas da tabela as nomeiam (a exportação segue o CSV publicado)", () => {
    const linhas = linhasRanking(gold.tarifas.vigentes, 200, info);
    expect(linhas.every((l) => l.uf && l.tipo && l.ucs)).toBe(true);
    expect(COLUNAS_RANKING.map((c) => c.id).slice(0, 5)).toEqual(["posicao", "sigla", "uf", "tipo", "ucs"]);
    const exportado = lerCsv(gerarCsv(COLUNAS_RANKING, linhas));
    expect(exportado[0]["UF"]).toBe(linhas[0].uf);
    expect(exportado[0]["Tipo"]).toBe(linhas[0].tipo);
    expect(numero(exportado[0]["Consumidores (UCs)"])).toBe(linhas[0].ucs);
    // sem informação, as três colunas ficam vazias e as demais não mudam
    const sem = linhasRanking(gold.tarifas.vigentes, 200);
    expect(sem.every((l) => l.uf === null && l.tipo === null && l.ucs === null)).toBe(true);
  });

  it("grupo de pares: concessionárias e permissionárias somam o ranking, e a UF restringe sem perder a ordem", () => {
    const linhas = linhasRanking(gold.tarifas.vigentes, 200, info);
    const todas = filtrarRanking(linhas, "todas", "");
    const con = filtrarRanking(linhas, "concessionaria", "");
    const per = filtrarRanking(linhas, "permissionaria", "");
    expect(todas.length).toBe(linhas.length);
    expect(con.length + per.length).toBe(linhas.length);
    expect(con.every((l) => l.tipo === "Concessionária") && per.every((l) => l.tipo === "Permissionária")).toBe(true);
    expect(con.map((l) => l.posicao)).toEqual([...con.map((l) => l.posicao)].sort((a, b) => a - b));
    const ufs = ufsDoRanking(linhas);
    expect(ufs.map((u) => u.uf)).toEqual([...ufs.map((u) => u.uf)].sort((a, b) => a.localeCompare(b, "pt-BR")));
    for (const { uf, n } of ufs) {
      const f = filtrarRanking(linhas, "todas", uf);
      expect(f.length, uf).toBe(n);
      expect(f.every((l) => l.uf!.split(", ").includes(uf)), uf).toBe(true);
    }
    // UF que não está no ranking não filtra (link antigo ou digitado)
    expect(filtrarRanking(linhas, "todas", "ZZ").length).toBe(linhas.length);
    expect(filtrarRanking(linhas, "concessionaria", "ZZ").length).toBe(con.length);
  });

  it("resumo do ranking: a mediana do conjunto inteiro é a publicada em cada perfil", () => {
    for (const p of [100, 200, 300] as const) {
      const r = resumoDoRanking(linhasRanking(gold.tarifas.vigentes, p, info));
      expect(r.n).toBe(gold.tarifas.resumo.n);
      expect(r.mediana, `${p}`).toBe(gold.tarifas.resumo.perfis_mediana[String(p) as "100"]);
      expect(r.medianaTarifa).toBe(gold.tarifas.resumo.mediana);
      expect(r.menor!.posicao).toBe(1);
      expect(r.maior!.posicao).toBe(gold.tarifas.resumo.n);
    }
    const per = resumoDoRanking(filtrarRanking(linhasRanking(gold.tarifas.vigentes, 200, info), "permissionaria", ""));
    expect(per.mediana).toBe(arredondar(medianaDeFora(gold.tarifas.vigentes.filter((v) => info[v.cnpj].tipo === "permissionaria").map((v) => v.perfis["200"] as number)), 2));
    const t = textoResumoDoRanking(per, 200, "permissionaria", "");
    expect(t).toContain(`Entre as ${per.n} permissionárias`);
    expect(t).toContain(reais(per.mediana));
    expect(textoResumoDoRanking(resumoDoRanking([]), 200, "todas", "")).toMatch(/Nenhuma das distribuidoras/);
  });

  it("os parâmetros da URL do grupo e da UF existem e têm padrão", () => {
    expect(CAMPO_GRUPO.padrao).toBe("todas");
    expect(CAMPO_UF.padrao).toBe("");
    expect(CAMPO_GRUPO.param).toBe("grupo");
    expect(CAMPO_UF.param).toBe("uf");
  });
});

describe.skipIf(!disponivel)("busca por município", () => {
  const csv = ler("public/energia/series/territorio_municipios.csv");
  const indice = criarIndiceMunicipios(csv);
  const preparado = prepararBuscaMunicipios(indice);
  const linhasCsv = lerCsv(csv);

  it("o índice tem os 5.571 municípios e as distribuidoras de cada um, com o estado do vínculo", () => {
    expect(indice.m.length).toBe(linhasCsv.length);
    for (const [k, l] of [0, 1, 2, 100, 2000, linhasCsv.length - 1].map((i) => [i, linhasCsv[i]] as const)) {
      const [nome, uf, v] = indice.m[k];
      expect(nome).toBe(l.municipio);
      expect(uf).toBe(l.uf);
      const esperado = l.distribuidoras
        .split("|")
        .filter(Boolean)
        .map((p) => p.split(":").slice(-2).join(":"));
      expect(v.map((x) => `${indice.d[Math.floor(x / 3)][0]}:${x % 3}`)).toEqual(esperado);
    }
    // cada vínculo guarda CNPJ de 14 dígitos
    for (const [cnpj] of indice.d) expect(cnpj).toMatch(/^\d{14}$/);
  });

  it("acha por nome sem acento nem caixa, por prefixo de cada palavra e por UF digitada", () => {
    const manaus = buscarMunicipios(indice, preparado, "MANAUS");
    expect(manaus[0].nome).toBe("Manaus");
    expect(manaus[0].uf).toBe("AM");
    expect(manaus[0].vinculos.length).toBeGreaterThan(0);
    const sp = buscarMunicipios(indice, preparado, "sao paulo sp")[0];
    expect([sp.nome, sp.uf]).toEqual(["São Paulo", "SP"]);
    expect(sp.vinculos.length).toBeGreaterThanOrEqual(2);
    // o nome que começa pelo texto vem antes de quem só tem a palavra
    expect(buscarMunicipios(indice, preparado, "campinas", 3)[0].nome).toBe("Campinas");
    // acento e apóstrofo: "d oeste" acha "D'Oeste"
    expect(buscarMunicipios(indice, preparado, "alta floresta d oeste")[0].nome).toBe("Alta Floresta D'Oeste");
    // mesmo nome em UFs diferentes aparece mais de uma vez, com a UF
    const nomesIguais = buscarMunicipios(indice, preparado, "bom jesus", 8);
    expect(new Set(nomesIguais.map((x) => x.uf)).size).toBeGreaterThan(1);
    // texto curto, sem resultado e limite
    expect(buscarMunicipios(indice, preparado, "a")).toEqual([]);
    expect(buscarMunicipios(indice, preparado, "xqzw")).toEqual([]);
    expect(buscarMunicipios(indice, preparado, "sao", 5).length).toBe(5);
  });

  it("uma distribuidora do ranking aparece pelo município onde atua", () => {
    const cnpjsRanking = new Set(gold.tarifas.vigentes.map((v) => v.cnpj));
    const ateUm = indice.m.filter(([, , v]) => v.some((x) => cnpjsRanking.has(indice.d[Math.floor(x / 3)][0])));
    expect(ateUm.length).toBeGreaterThan(5000);
    const dmed = gold.tarifas.vigentes.find((v) => v.sigla === "DMED");
    if (dmed) {
      const com = indice.m.filter(([, , v]) => v.some((x) => indice.d[Math.floor(x / 3)][0] === dmed.cnpj));
      expect(com.length).toBeGreaterThan(0);
    }
  });

  it("o índice compacto cabe num arquivo estático leve", () => {
    expect(Buffer.byteLength(JSON.stringify(indice), "utf-8")).toBeLessThan(400_000);
  });
});

describe.skipIf(!disponivel)("subsídios e orçamento da CDE em reais do mês-base", () => {
  const ipca = lerIpcaCsv(ler("public/energia/series/conta_ipca.csv"));
  const base = gold.reajustes.comparacao_inflacao!.ultimo_ipca;
  const anos = Array.from(new Set([...gold.subsidios.anual.map((a) => a.ano), ...gold.financiamento_cde!.anos]));
  const fatores = fatoresReaisPorAno(ipca, anos, base);

  it("o fator de cada ano é o índice do mês-base dividido pela média dos índices do ano (ano do mês-base, parcial)", () => {
    const indiceBase = ipca.find((x) => x.mes === base)!.indice;
    for (const ano of anos) {
      const doAno = ipca.filter((x) => x.mes.startsWith(`${ano}-`) && x.mes <= base).map((x) => x.indice);
      const f = fatores[ano];
      expect(f, ano).not.toBeNull();
      expect(f!.meses).toBe(doAno.length);
      expect(f!.fator).toBeCloseTo(indiceBase / (doAno.reduce((a, b) => a + b, 0) / doAno.length), 10);
    }
    expect(fatores[base.slice(0, 4)]!.meses).toBeLessThan(12);
    expect(fatores["2014"]!.meses).toBe(12);
    // ano depois do mês-base e ano sem índice: sem fator
    expect(fatoresReaisPorAno(ipca, ["2099", "1900"], base)).toEqual({ "2099": null, "1900": null });
    expect(fatoresReaisPorAno(ipca, ["2025"], "2099-01")["2025"]).toBeNull();
  });

  it("de 2014 a 2025 a soma dos subsídios multiplica por cerca de 4,3 em valores da época e por cerca de 2,35 em reais constantes", () => {
    const nominal = linhasSubsidios(gold.subsidios);
    const real = emReaisDoMesBase(nominal, ["soma", ...categoriasSubsidio(gold.subsidios)], fatores);
    const de = (ls: typeof nominal, ano: string) => ls.find((l) => l.ano === ano)!.soma as number;
    const crescNominal = de(nominal, "2025") / de(nominal, "2014");
    const crescReal = de(real, "2025") / de(real, "2014");
    expect(crescNominal).toBeGreaterThan(4.2);
    expect(crescNominal).toBeLessThan(4.4);
    // a avaliação independente recalculou 2,35 com o IPCA médio anual; o índice dez/2013 a dez/2025 foi de 94,0%
    expect(crescReal).toBeGreaterThan(2.3);
    expect(crescReal).toBeLessThan(2.4);
    // o mês-base não muda a razão entre dois anos: só a unidade
    const outra = emReaisDoMesBase(nominal, ["soma"], fatoresReaisPorAno(ipca, anos, "2026-06"));
    expect(de(outra, "2025") / de(outra, "2014")).toBeCloseTo(crescReal, 8);
  });

  it("em reais, só os valores de dinheiro mudam: o ano, o rótulo e os meses ficam, a ausência continua ausência", () => {
    const nominal = linhasSubsidios(gold.subsidios);
    const real = emReaisDoMesBase(nominal, ["soma"], fatores);
    nominal.forEach((l, i) => {
      expect(real[i].ano).toBe(l.ano);
      expect(real[i].rotulo).toBe(l.rotulo);
      expect(real[i].meses).toBe(l.meses);
      expect(real[i].total_publicado).toBe(l.total_publicado);
    });
    // ano sem fator vira ausência, nunca o valor nominal passando por real
    expect(emReaisDoMesBase([{ ano: "2099", soma: 5 }], ["soma"], fatores)[0].soma).toBeNull();
    expect(emReaisDoMesBase([{ ano: "2014", soma: null }], ["soma"], fatores)[0].soma).toBeNull();
    // a série da CDE em reais: cada grupo de despesa multiplicado pelo fator do ano
    const cde = linhasCde(gold.financiamento_cde!);
    const cdeReal = emReaisDoMesBase(cde, [...GRUPOS_DESPESA_CDE, "despesa"], fatores);
    cde.forEach((l, i) => {
      const f = fatores[String(l.ano)]!.fator;
      expect(cdeReal[i].despesa as number).toBeCloseTo((l.despesa as number) * f, 8);
      expect(cdeReal[i].quotas_pct).toBe(l.quotas_pct);
    });
  });

  it("lerIpcaCsv ignora cabeçalho e meses sem índice", () => {
    expect(lerIpcaCsv("mes;indice;variacao\n2026-07;7657.73;4.44\n2026-08;;\nlixo;1;2\n2026-09;7700;\n")).toEqual([
      { mes: "2026-07", indice: 7657.73 },
      { mes: "2026-09", indice: 7700 },
    ]);
  });
});

describe.skipIf(!disponivel)("quotas da CDE: a série e a leitura do residual", () => {
  const f = gold.financiamento_cde!;

  it("a série é a participação das quotas de cada ano do orçamento, a mesma da tabela", () => {
    const s = serieQuotas(f);
    expect(s.map((p) => p.ano)).toEqual(f.anos);
    expect(s.map((p) => p.pct)).toEqual(linhasCde(f).map((l) => l.quotas_pct));
  });

  it("as rubricas que passam a zero no último ano saem das rubricas publicadas, por outro caminho", () => {
    const i = f.anos.indexOf(f.ultimo_ano);
    const esperado = f.rubricas.filter((r) => r.tipo === "Receita" && r.grupo !== "quotas_tarifa" && r.valores[i] === 0 && (r.valores[i - 1] ?? 0) > 0).map((r) => r.fonte);
    expect(receitasQueZeraram(f).map((x) => x.fonte)).toEqual(esperado);
    if (f.ultimo_ano === "2026") expect(esperado.sort()).toEqual(["P&D", "Saldo Anterior"]);
  });

  it("a frase traz os dois anos anteriores, o ano do orçamento, o residual e o que mudou nas outras receitas", () => {
    const t = textoResidualQuotas(f)!;
    const s = serieQuotas(f);
    const k = s.findIndex((p) => p.ano === f.ultimo_ano);
    expect(t).toContain("A quota é o residual do orçamento");
    expect(t).toContain(`${pct(s[k].pct, 1)} em ${f.ultimo_ano}`);
    expect(t).toContain(`${pct(s[k - 1].pct, 1)} em ${s[k - 1].ano}`);
    expect(t).toContain(`${pct(s[k - 2].pct, 1)} em ${s[k - 2].ano}`);
    for (const z of receitasQueZeraram(f)) expect(t).toContain(z.fonte);
    const sem = f.totais.find((x) => x.ano === f.ultimo_ano)!.rubricas_sem_valor;
    if (sem.length) expect(t).toContain(`${sem.length} rubricas estão sem valor publicado`);
    expect(t).not.toMatch(/\b(hoje|agora|atual|porque)\b/i);
    expect(textoResidualQuotas(null)).toBeNull();
    // a nota da gold diz a mesma coisa: a quota anual cobre a diferença
    expect(f.nota).toMatch(/quota anual é fixada para cobrir a diferença/);
  });
});

describe.skipIf(!disponivel)("janelas de comparação no mesmo conjunto", () => {
  const janelas = gold.reajustes.comparacao_inflacao!.janelas;
  const c = janelasNoMesmoConjunto(janelas)!;

  it("o conjunto comum é o das distribuidoras com variação nas três janelas, e a mediana de cada uma sai só delas", () => {
    const conjuntos = janelas.map((j) => new Set(j.distribuidoras.filter((d) => d[2] !== null).map((d) => d[0])));
    const comuns = Array.from(conjuntos[0]).filter((k) => conjuntos.every((s) => s.has(k)));
    expect(c.n).toBe(comuns.length);
    expect(c.itens.map((i) => i.meses)).toEqual(janelas.map((j) => j.meses));
    janelas.forEach((j, k) => {
      const xs = j.distribuidoras.filter((d) => comuns.includes(d[0])).map((d) => d[2] as number);
      expect(c.itens[k].medianaPct).toBe(arredondar(medianaDeFora(xs), 2));
      expect(c.itens[k].ipcaPct).toBe(j.ipca_pct);
      expect(c.itens[k].nDaJanela).toBe(j.n);
      expect(c.itens[k].acima).toBe(xs.filter((x) => x > (j.ipca_pct as number)).length);
    });
    // o conjunto comum cabe em cada janela
    for (const i of c.itens) expect(c.n).toBeLessThanOrEqual(i.nDaJanela);
  });

  it("a frase nomeia o conjunto e dá a mediana de cada janela contra o IPCA do período", () => {
    const t = textoJanelasNoMesmoConjunto(c);
    expect(t).toContain(`Nas ${c.n} distribuidoras com variação nas três janelas`);
    for (const i of c.itens) expect(t).toContain(`${pct(i.medianaPct, 2)} em ${i.meses} meses (IPCA de ${pct(i.ipcaPct, 2)})`);
    expect(t).not.toMatch(/\b(hoje|agora|atual|porque)\b/i);
    expect(janelasNoMesmoConjunto(janelas.slice(0, 1))).toBeNull();
  });
});

describe.skipIf(!disponivel)("simulador: tarifa usada, classes iguais à residencial e leituras não conferidas", () => {
  const sim = gold.simulador;

  it("rural e demais classes usam a tarifa B2 e B3 da fonte, e o cálculo confere em quantas distribuidoras ela é igual à residencial", () => {
    for (const chave of ["rural", "demais"] as const) {
      const { iguais, total } = igualdadeComResidencial(sim.distribuidoras, chave);
      expect(total).toBe(sim.cobertura_classes[chave]);
      // laço próprio sobre a gold
      const esperado = sim.distribuidoras.filter((d) => d.tarifas.residencial && d.tarifas[chave] && d.tarifas.residencial[0] === d.tarifas[chave]![0] && d.tarifas.residencial[1] === d.tarifas[chave]![1]).length;
      expect(iguais).toBe(esperado);
    }
    expect(descricaoDaTarifa(sim.chaves_tarifa.rural)).toBe("subgrupo B2, sem subclasse na fonte");
    expect(descricaoDaTarifa(sim.chaves_tarifa.residencial)).toBe("subgrupo B1, subclasse Residencial");
    // o cálculo de rural e de demais não aplica desconto: é a mesma fórmula da residencial sobre a tarifa da chave
    const d = sim.distribuidoras[0];
    const regras = sim.regras;
    const r = simular(d.tarifas, "rural", 100, "monofasico", 0, regras);
    const b = simular(d.tarifas, "residencial", 100, "monofasico", 0, regras);
    if (r.disponivel && b.disponivel) {
      expect(r.linhas.map((l) => l.rotulo)).toEqual(b.linhas.map((l) => l.rotulo));
      expect(r.linhas.every((l) => l.valor >= 0)).toBe(true);
    }
    // diferença de uma tarifa muda o resultado
    const igual = igualdadeComResidencial([{ tarifas: { residencial: [1, 2], rural: [1, 2] } }, { tarifas: { residencial: [1, 2], rural: [1, 3] } }, { tarifas: { residencial: null, rural: [1, 3] } }], "rural");
    expect(igual).toEqual({ iguais: 1, total: 2 });
  });

  it("a leitura não conferida de que o resultado depende é só a da classe (Tarifa Social e Desconto Social), nunca a de outra", () => {
    const ts = leiturasNaoConferidas("tarifa_social", sim.regras_texto);
    const ds = leiturasNaoConferidas("desconto_social", sim.regras_texto);
    expect(ts.length).toBeGreaterThan(0);
    expect(ts.every((t) => /tarifa social/i.test(t))).toBe(true);
    expect(ds.length).toBeGreaterThan(0);
    for (const classe of ["residencial", "rural", "demais"] as const) expect(leiturasNaoConferidas(classe, sim.regras_texto), classe).toEqual([]);
    // cada texto é o de uma parte não conferida da gold
    const naoConferidas = sim.regras_texto.flatMap((r) => r.partes.filter((p) => p.estado !== "CONFERIDA").map((p) => p.texto));
    for (const t of [...ts, ...ds]) expect(naoConferidas).toContain(t);
    // regra toda conferida: sem selo
    const conferidas = sim.regras_texto.map((r) => ({ ...r, partes: r.partes.map((p) => ({ ...p, estado: "CONFERIDA" })) }));
    expect(leiturasNaoConferidas("tarifa_social", conferidas)).toEqual([]);
    expect(leiturasNaoConferidas("desconto_social", conferidas)).toEqual([]);
    // as regras de cada classe existem na gold
    for (const classe of Object.keys(REGRAS_DA_CLASSE) as (keyof typeof REGRAS_DA_CLASSE)[]) for (const id of REGRAS_DA_CLASSE[classe]) expect(sim.regras_texto.some((r) => r.id === id), `${classe}: ${id}`).toBe(true);
  });
});

describe.skipIf(!disponivel)("ficha com procedimento externo", () => {
  const fichas = [gold.tarifas.evidencia_mediana, gold.composicao.evidencia, gold.simulador.evidencia, gold.reajustes.evidencia, gold.bandeiras.evidencia, gold.subsidios.evidencia, gold.financiamento_cde!.evidencia];

  it("troca só o passo de reprodução: sem comando interno, com filtros, fórmula, valor exibido e data de corte", () => {
    for (const ev of fichas) {
      expect(ev).toBeTruthy();
      const novo = comProcedimentoExterno(ev)!;
      expect({ ...novo, reproducao: ev!.reproducao }).toEqual(ev);
      expect(novo.reproducao).not.toMatch(/python|pipeline\/|executar_modulo|--sem-coleta/);
      expect(novo.reproducao).toContain("Data de corte");
      expect(novo.reproducao).toContain(ev!.valor_exibido);
      expect(novo.reproducao).toContain(ev!.formula);
      for (const f of ev!.filtros) expect(novo.reproducao).toContain(f);
      if (ev!.fonte.capturado_em) expect(novo.reproducao).toContain(dataBR(ev!.fonte.capturado_em.slice(0, 10)));
      expect(problemasEvidencia(novo), ev!.indicador).toEqual([]);
    }
    expect(comProcedimentoExterno(null)).toBeNull();
  });
});

describe("pontos de uma faixa: cada um no seu lugar, sem encostar", () => {
  const pontos = Array.from({ length: 81 }, (_, i) => ({ id: `p${i}`, x: 14 + ((i * 37) % 81) * 6.1 + (i % 7) * 0.3 }));

  it("nenhum par da mesma linha chega mais perto que o diâmetro mais a folga, e a posição horizontal não muda", () => {
    const r = 3.4;
    const out = empilharPontos(pontos, r, 1.3);
    expect(out.length).toBe(pontos.length);
    const x0 = new Map(pontos.map((p) => [p.id, p.x]));
    for (const o of out) expect(o.x).toBe(x0.get(o.id));
    const porLinha = new Map<number, number[]>();
    for (const o of out) porLinha.set(o.linha, [...(porLinha.get(o.linha) ?? []), o.x]);
    for (const xs of Array.from(porLinha.values())) {
      const o = [...xs].sort((a, b) => a - b);
      for (let i = 1; i < o.length; i++) expect(o[i] - o[i - 1]).toBeGreaterThanOrEqual(2 * r + 1.3 - 1e-9);
    }
  });

  it("é determinístico, começa pela linha central e alterna para cima e para baixo", () => {
    expect(empilharPontos(pontos, 3.4)).toEqual(empilharPontos([...pontos].reverse(), 3.4));
    const juntos = empilharPontos([{ id: "a", x: 10 }, { id: "b", x: 10 }, { id: "c", x: 10 }, { id: "d", x: 10 }, { id: "e", x: 10 }], 3, 1);
    expect(juntos.map((j) => j.linha)).toEqual([0, 1, -1, 2, -2]);
    expect(empilharPontos([], 3)).toEqual([]);
  });
});

describe.skipIf(!disponivel)("props compactas dos componentes de cliente: a ida e a volta não perdem nada que a tela usa", () => {
  const json = (x: unknown) => Buffer.byteLength(JSON.stringify(x), "utf-8");

  it("distribuidoras do ranking: todos os campos que os componentes leem voltam iguais, e os que ninguém lê não viajam", () => {
    const compactas = compactarVigentes(gold.tarifas.vigentes);
    const volta = expandirVigentes(compactas);
    expect(volta.length).toBe(gold.tarifas.vigentes.length);
    volta.forEach((v, i) => {
      const o = gold.tarifas.vigentes[i];
      expect({ ...v, be_te: o.be_te, be_tusd: o.be_tusd }).toEqual(o);
      expect([v.be_te, v.be_tusd]).toEqual([null, null]);
    });
    // a linha do ranking, a referência do perfil e o destaque saem iguais com a lista que voltou
    expect(linhasRanking(volta, 200)).toEqual(linhasRanking(gold.tarifas.vigentes, 200));
    expect(referenciasDoPerfil(volta, gold.tarifas.resumo, 300)).toEqual(referenciasDoPerfil(gold.tarifas.vigentes, gold.tarifas.resumo, 300));
    expect(json(compactas)).toBeLessThan(json(gold.tarifas.vigentes) * 0.62);
  });

  it("composição: cada distribuidora volta com total, partes em R$/MWh e em %, CDE e reclassificadas; as linhas do gráfico e da tabela não mudam", () => {
    const c = gold.composicao;
    const compacta = compactarComposicao(c);
    const volta = expandirComposicao(compacta);
    expect(volta.distribuidoras.length).toBe(c.distribuidoras.length);
    volta.distribuidoras.forEach((d, i) => {
      const o = c.distribuidoras[i];
      expect({ cnpj: d.cnpj, sigla: d.sigla, total: d.total, grupos: d.grupos, pct: d.pct, cde: d.cde, cde_pct: d.cde_pct }).toEqual({ cnpj: o.cnpj, sigla: o.sigla, total: o.total, grupos: o.grupos, pct: o.pct, cde: o.cde, cde_pct: o.cde_pct });
      expect((d.reclassificadas ?? []).map((r) => [r.codigo, r.valor])).toEqual(o.reclassificadas.map((r) => [r.codigo, r.valor]));
    });
    expect(volta.grupos.map((g) => [g.id, g.rotulo])).toEqual(c.grupos.map((g) => [g.id, g.rotulo]));
    for (const u of ["rs", "pct"] as const) {
      expect(linhasComposicao(volta, gold.tarifas.vigentes, u)).toEqual(linhasComposicao(c, gold.tarifas.vigentes, u));
      expect(linhasComposicaoGrafico(volta, gold.tarifas.vigentes, u, [gold.simulador.casos_referencia.cnpj])).toEqual(linhasComposicaoGrafico(c, gold.tarifas.vigentes, u, [gold.simulador.casos_referencia.cnpj]));
    }
    expect(linhasGrupos(volta, c.distribuidoras[0].cnpj)).toEqual(linhasGrupos(c, c.distribuidoras[0].cnpj));
    expect(idsComposicaoPadrao(volta, gold.tarifas.vigentes, gold.simulador.casos_referencia.cnpj)).toEqual(idsComposicaoPadrao(c, gold.tarifas.vigentes, gold.simulador.casos_referencia.cnpj));
    expect(json(compacta)).toBeLessThan(json({ grupos: c.grupos, distribuidoras: c.distribuidoras, media: c.media, mediana: c.mediana, cde: c.cde, creditos: c.creditos }) * 0.45);
  });

  it("simulador: as tarifas de cada distribuidora voltam iguais, com null onde a subclasse não tem vigência, e o cálculo reproduz os casos de referência", () => {
    const d = gold.simulador.distribuidoras;
    const compactas = compactarDistribuidorasSim(d);
    expect(expandirDistribuidorasSim(compactas)).toEqual(d);
    expect(json(compactas)).toBeLessThan(json(d) * 0.7);
    const ref = expandirDistribuidorasSim(compactas).find((x) => x.cnpj === gold.simulador.casos_referencia.cnpj)!;
    for (const [classe, kwh, ligacao, bandeira, total] of gold.simulador.casos_referencia.casos.slice(0, 20)) {
      const adicional = bandeira === "Amarela" ? (gold.simulador.bandeiras.find((b) => b.bandeira === "Amarela")?.rs_mwh ?? null) : 0;
      const r = simular(ref.tarifas, classe, kwh, ligacao, adicional, gold.simulador.regras);
      if (total === null) expect(r.disponivel).toBe(false);
      else expect(r.disponivel && Math.abs(r.total - total) <= 0.005 + 1e-9).toBe(true);
    }
  });

  it("entidades do histórico: a lista que a tela monta é a de antes (vigentes e depois as sem tarifa vigente, com o CNPJ como sinônimo)", () => {
    const antes = [
      ...gold.tarifas.vigentes.map((v) => ({ id: v.cnpj, rotulo: v.sigla && v.sigla.trim() ? v.sigla : `CNPJ ${v.cnpj}`, detalhe: v.nome ?? undefined, sinonimos: [v.cnpj] })),
      ...gold.tarifas.sem_vigente.map((v) => ({ id: v.cnpj, rotulo: v.sigla && v.sigla.trim() ? v.sigla : `CNPJ ${v.cnpj}`, detalhe: `${v.nome ?? ""} (sem tarifa vigente)`.trim(), sinonimos: [v.cnpj] })),
    ];
    const compactas = compactarEntidades(gold.tarifas.vigentes, gold.tarifas.sem_vigente);
    expect(expandirEntidades(compactas)).toEqual(antes);
    expect(json(compactas)).toBeLessThan(json(antes) * 0.65);
  });

  it("UF, tipo e UCs: a ida e a volta guardam o ano comum uma vez e o ano de quem difere", () => {
    const info = infoDistribuidoras(
      gold.tarifas.vigentes.map((v) => v.cnpj),
      qualidadeGold.distribuidoras,
      territorioGold.distribuidoras,
    );
    const compacta = compactarInfo(info);
    expect(expandirInfo(compacta)).toEqual(info);
    expect(compacta.ano).toBe(qualidadeGold.distribuidoras[0].ano);
    expect(json(compacta)).toBeLessThan(json(info) * 0.6);
    const misto = {
      a: { uf: "SP", tipo: "concessionaria" as const, ucs: 10, anoUcs: 2025 },
      b: { uf: "PR", tipo: "permissionaria" as const, ucs: 5, anoUcs: 2024 },
      c: { uf: null, tipo: null, ucs: null, anoUcs: null },
    };
    expect(expandirInfo(compactarInfo(misto))).toEqual(misto);
  });

  it("linhas de tabela: só o identificador e o valor de cada coluna viajam, e a ausência volta como ausência", () => {
    const colunas = [{ id: "sigla" }, { id: "dias" }, { id: "motivo" }];
    const linhas = [
      { id: "1", sigla: "A", dias: 0, motivo: "x", sobra: "não viaja" },
      { id: "2", sigla: "B", dias: null, motivo: undefined },
    ];
    const tuplas = compactarLinhasTabela(colunas, linhas);
    expect(tuplas).toEqual([
      ["1", "A", 0, "x"],
      ["2", "B", null, null],
    ]);
    expect(expandirLinhasTabela(colunas, tuplas)).toEqual([
      { id: "1", sigla: "A", dias: 0, motivo: "x" },
      { id: "2", sigla: "B", dias: null, motivo: null },
    ]);
    // 0 continua 0 (dado) e null continua null (ausência)
    expect(expandirLinhasTabela(colunas, tuplas)[0].dias).toBe(0);
    expect(expandirLinhasTabela(colunas, tuplas)[1].dias).toBeNull();
  });
});

describe.skipIf(!disponivel)("segunda passada: o que as páginas dizem e mostram depois das avaliações de 09/10/2026", () => {
  const html = renderToStaticMarkup(createElement(ContaDeLuzPage));
  const htmlP050 = renderToStaticMarkup(createElement(ContaReajustesPage));
  const entender = textoEntenderDe(html);
  const entenderP050 = textoEntenderDe(htmlP050);
  const completo = textoCompletoDe(html);
  const completoP050 = textoCompletoDe(htmlP050);
  const evolucao = linhasEvolucao(gold.tarifas.evolucao);
  const cmp = compararMesmoConjunto({ vigentes: gold.tarifas.vigentes, semVigente: gold.tarifas.sem_vigente, historico: historico.distribuidoras, evolucao, dataReferencia: gold.data_referencia })!;

  it("a mediana da primeira tela traz a variação nas mesmas distribuidoras e a ressalva diz quantas saíram do conjunto", () => {
    const antes = semEspacoDuro(textoCompletoDe(ateAProfundidade(html).replace(/<details[\s\S]*?<\/details>/g, " ")));
    expect(antes).toContain(`nas mesmas ${cmp.nComum} distribuidoras, de ${dataBR(cmp.de)} a ${dataBR(cmp.ate)}`);
    expect(antes).toContain(`+${num(cmp.variacaoPct, 2)}%`);
    expect(antes).toContain(`Em ${dataBR(cmp.de)} eram ${cmp.nDe}: ${cmp.saidas.n} saíram do conjunto`);
    // o painel diz o mesmo com as medianas do mesmo conjunto e o limite de leitura
    expect(entender).toContain(`Nas mesmas ${cmp.nComum} distribuidoras, a mediana`);
    expect(entender).toContain(num(cmp.medianaDeComum, 2));
    expect(entender).toContain(num(cmp.saidas.mediana, 2));
    expect(entender).toContain("mistura conjuntos diferentes");
  });

  it("três valores típicos numa frase, e o destaque da composição é o agregado, com a distribuidora de exemplo rotulada como exemplo", () => {
    expect(entender).toContain(textoTresValoresTipicos(gold.composicao, gold.tarifas.resumo));
    const m = gold.composicao.media!;
    expect(entender).toContain(`Encargos setoriais na tarifa média de ${m.n} distribuidoras`);
    expect(entender).toContain(`${num(m.grupos_pct.encargos, 1)}%`);
    expect(entender).toMatch(/Exemplo: encargos na /);
    expect(entender).toContain(`${num(gold.composicao.evidencia!.valor_calculo, 1)}%`);
    expect(entender).toContain("Uma distribuidora, não a média");
    // o agregado não finge ficha: diz de onde vem
    expect(entender).toContain("Sem ficha própria");
  });

  it("o ranking tem UF, tipo e UCs, filtros de grupo e de UF, busca por município, dica da fatura e a seleção à vista", () => {
    for (const x of ["Tipo de distribuidora", "Estado (UF)", "Buscar pelo município", "Não sabe qual é a sua distribuidora? O nome dela está no alto da fatura de luz"]) expect(entender, x).toContain(x);
    expect(html).toContain('role="combobox"');
    expect(html).toContain("data-selecionadas");
    for (const x of ["Concessionárias (51)", "Permissionárias (30)", "Todas (81)"]) expect(entender, x).toContain(x);
    // a tabela do ranking (que abre ao pedido) tem as colunas novas, e a UF aparece no nome das barras
    expect(COLUNAS_RANKING.map((c) => c.rotulo)).toEqual(expect.arrayContaining(["Consumidores (UCs)", "UF", "Tipo", "Posição pela base econômica", "Aplicação contra a base"]));
    expect(html).toMatch(/DMED · MG/);
  });

  it("as distribuidoras aparecem todas numa faixa de pontos, com a mediana, os extremos e a legenda, na abertura do painel", () => {
    expect((html.match(/data-grafico="pontos"/g) ?? []).length).toBe(1);
    const pontos = (html.match(/data-ponto="/g) ?? []).length;
    expect(pontos).toBe(gold.tarifas.resumo.n);
    expect(html).toContain("Cada ponto é uma distribuidora.");
    expect(html.indexOf('data-grafico="pontos"')).toBeLessThan(html.indexOf('data-grafico="barras"'));
    // a resposta do painel vem antes da faixa de pontos (primeira tela)
    expect(html.indexOf('data-resposta="p047"')).toBeLessThan(html.indexOf('data-grafico="pontos"'));
    expect(entender).toContain("uma distribuidora");
  });

  it("composição: o total do gráfico é o publicado, a diferença de arredondamento é uma parte dita, e a nota diz o tamanho dela", () => {
    expect(html).toContain('data-nota="arredondamento-composicao"');
    const rs = maiorAjusteDaGold("rs");
    const pc = maiorAjusteDaGold("pct");
    expect(entender).toContain(`a soma delas difere da tarifa em até R$ ${num(rs, 2)}/MWh, ou ${num(pc, 2)} ponto percentual na leitura em %`);
    expect(entender).toContain("Ajuste de arredondamento (não é componente)");
    expect(entender).toContain("todo total é o publicado: o mesmo valor no gráfico, na tabela e no arquivo");
    // a média do gráfico fecha no total publicado (859,08 na gold desta publicação), e a tabela de decomposição traz a linha do ajuste
    expect(completo).toContain(num(gold.composicao.media!.total_rs_mwh, 2));
  });

  it("simulador: a tarifa usada (subgrupo e subclasse) fica ao lado do resultado e na memória de cálculo", () => {
    expect(html).toContain('data-tarifa-usada=""');
    expect(entender).toContain("Tarifa usada: subgrupo B1, subclasse Residencial");
    expect(html).toContain('data-memoria-tarifa=""');
    expect(entender).toMatch(/Tarifa usada: subgrupo B1, subclasse Residencial \(TE [\d,]+ \+ TUSD [\d,]+ R\$\/kWh\)/);
    // na classe residencial não há selo de regra parcial; ele aparece nas classes que dependem de leitura declarada (componente, selo no cartão)
    expect(html).not.toContain('data-selo="regra-parcial"');
    const src = ler("src/components/energia/ContaSimulador.tsx");
    expect(src).toContain('data-selo="regra-parcial"');
    expect(src).toContain("Regra parcialmente conferida.");
    expect(src).toContain('data-nota="classe-igual-residencial"');
    expect(src).toContain("O desconto rural não está incluído neste cálculo.");
    expect(src).toContain('aria-invalid={kwhInvalido || undefined}');
    expect(entender).toContain("Bandeira do mês publicado: amarela de set/2026, a última que consta nos dados de 30/09/2026");
  });

  it("Entender não traz identificador técnico, comando interno nem texto de bastidor em nenhuma das duas páginas", () => {
    for (const [nome, e] of [
      ["principal", entender],
      ["reajustes", entenderP050],
    ] as const) {
      for (const x of ["reconciliacao_externa", "bronze", "silver", "SAMP", "DscDetalheMercado", "dec_concessionarias", "NumCon", "TE_CFURH", "python3", "executar_modulo", "pipeline/", "sha256", "HTTP 403", "cf-mitigated"]) expect(e, `${nome}: ${x}`).not.toContain(x);
    }
    // o registro da coleta e o resto continuam na página, em Analisar e em Auditar
    expect(completoP050).toContain("Registro da coleta");
  });

  it("reajustes: a primeira medida é a variação entre datas, o aviso do efeito médio fica logo abaixo da resposta e a faixa de pontos mostra as 102", () => {
    expect(entenderP050).toContain("Variação da tarifa B1 residencial entre duas datas, contra o IPCA do mesmo período");
    const i = htmlP050.indexOf('data-resposta="p050-reajustes"');
    const a = htmlP050.indexOf('data-bloco="efeito-medio"');
    const p = htmlP050.indexOf('data-grafico="pontos"');
    expect(i).toBeGreaterThan(-1);
    expect(a).toBeGreaterThan(i);
    expect(p).toBeGreaterThan(a);
    expect(entenderP050).toContain("nenhum valor de reserva foi usado no lugar");
    expect(entenderP050).toContain("recusaram o acesso do observatório em 30/09/2026");
    const j12 = gold.reajustes.comparacao_inflacao!.janelas.find((j) => j.meses === 12)!;
    expect((htmlP050.match(/data-ponto="/g) ?? []).length).toBe(j12.n);
    expect(entenderP050).toContain("IPCA do período: à direita da linha, a tarifa subiu mais que a inflação");
  });

  it("reajustes: a mediana de cada janela no mesmo conjunto fica ao lado do cartão, que acompanha a janela", () => {
    const c = janelasNoMesmoConjunto(gold.reajustes.comparacao_inflacao!.janelas)!;
    expect(entenderP050).toContain(textoJanelasNoMesmoConjunto(c));
    expect(htmlP050).toContain('data-bloco="janelas-mesmo-conjunto"');
    const src = ler("src/components/energia/ContaReajustes.tsx");
    expect(src).toContain("`Variação mediana da tarifa B1 em ${janela.meses} meses`");
    expect(src).toContain("evidencia={janela.meses === 12 ? evidencia : null}");
    expect(src).toContain("A ficha de prova só está publicada para a janela de 12 meses");
  });

  it("subsídios: foram homologados para repasse (não é desembolso), CDE definida na primeira frase, alternância nominal e real, quotas com série e residual", () => {
    const ano = gold.subsidios.anual.find((a) => a.ano === gold.subsidios.ultimo_ano_completo)!;
    expect(semEspacoDuro(entenderP050)).toContain(semEspacoDuro(`foram homologados ${reais(ano.soma_categorias! / 1e9, 2)} bilhões para repasse da Conta de Desenvolvimento Energético (CDE)`));
    expect(entenderP050).toContain("Não são desembolso realizado nem transferências a famílias");
    expect(completo + completoP050).not.toMatch(/A CDE repassou/);
    expect(entenderP050).toContain("Nominais (valores da época)");
    expect(entenderP050).toContain(`Em reais de ${mesAno(`${gold.reajustes.comparacao_inflacao!.ultimo_ipca}-01`)}`);
    expect(htmlP050).toContain('data-valores="nominal"');
    expect(entenderP050).toContain("em reais nominais (valores da época)");
    expect(entenderP050).toContain(textoResidualQuotas(gold.financiamento_cde)!);
    expect(entenderP050).toContain("Antes: 87,6% em 2024 e 90,2% em 2025");
    expect(htmlP050).toContain('data-bloco="quotas"');
    expect(htmlP050).toMatch(/Participação das quotas nas receitas do orçamento da CDE, 2013 a 2026/);
  });

  it("a ficha de cada destaque indica o procedimento externo com data de corte, nunca o comando interno", () => {
    for (const h of [completo, completoP050]) {
      expect(h).not.toContain("executar_modulo");
      expect(h).not.toContain("--sem-coleta");
    }
    const fontes = [ler("src/app/setor-eletrico/conta-de-luz/page.tsx"), ler("src/app/setor-eletrico/conta-de-luz/reajustes-e-subsidios/page.tsx"), ler("src/components/energia/ContaFaixa.tsx")].join("\n");
    // as sete fichas da gold: tarifa mediana, composição, simulador, reajustes, bandeiras, subsídios e orçamento da CDE
    expect((fontes.match(/comProcedimentoExterno\(/g) ?? []).length).toBeGreaterThanOrEqual(7);
  });

  it("quem escolhe pode ver e limpar a seleção, e o aviso do limite diz qual distribuidora saiu", () => {
    for (const f of ["ContaTarifas", "ContaSimulador", "ContaReajustes"]) {
      const src = ler(`src/components/energia/${f}.tsx`);
      expect(src, f).toContain("<ContaSelecionadas");
      expect(src, f).toContain("saiu da seleção para entrar");
    }
    const sel = ler("src/components/energia/ContaSelecionadas.tsx");
    expect(sel).toContain("Limpar seleção");
    expect(sel).toContain('aria-live="polite"');
  });

  it("as tabelas sob demanda abrem no primeiro clique", () => {
    const comp = ler("src/components/energia/ContaTabelaSobDemanda.tsx");
    expect(comp).toContain("iniciarAberta");
    for (const f of ["src/components/energia/ContaComposicao.tsx", "src/components/energia/ContaReajustes.tsx"]) expect(ler(f), f).toContain("iniciarAberta");
    // nenhuma tabela das páginas fica atrás de dois botões: toda ContaSobDemanda com tabela dentro nasce aberta
    for (const f of ["src/app/setor-eletrico/conta-de-luz/page.tsx", "src/app/setor-eletrico/conta-de-luz/reajustes-e-subsidios/page.tsx"]) {
      expect(ler(f), f).not.toMatch(/<ContaSobDemanda[\s\S]{0,400}<TabelaInterativa/);
    }
  });

  it("a grade de bandeiras cabe no celular sem rolar de lado: doze colunas com a inicial do mês", () => {
    const src = ler("src/components/energia/ContaBandeiras.tsx");
    expect(src).toContain("min-w-[300px]");
    expect(htmlP050).toContain('class="sm:hidden"');
    for (const m of ["janeiro", "dezembro"]) expect(htmlP050).toContain(m);
  });
});

/** Maior diferença de arredondamento das partes da composição, lida por laço próprio sobre a gold, em R$/MWh ou em pontos percentuais. */
function maiorAjusteDaGold(u: "rs" | "pct"): number {
  let maior = 0;
  const alvo = (d: { total: number | null }) => (u === "rs" ? d.total : 100);
  const linhas = [...gold.composicao.distribuidoras.map((d) => ({ partes: Object.values(u === "rs" ? d.grupos : d.pct), alvo: alvo(d) })), { partes: Object.values(u === "rs" ? gold.composicao.media!.grupos_rs_mwh : gold.composicao.media!.grupos_pct), alvo: u === "rs" ? gold.composicao.media!.total_rs_mwh : 100 }];
  for (const l of linhas) {
    if (l.alvo === null || l.partes.some((p) => p === null)) continue;
    maior = Math.max(maior, Math.abs(Math.round((l.alvo - (l.partes as number[]).reduce((a, b) => a + b, 0)) * 100) / 100));
  }
  return maior;
}

/** Componentes que recebem props serializadas no fluxo do servidor (de cliente, ou de servidor que repassam a prova e a proveniência a um de cliente). */
const COM_PROPS_NO_FLUXO = new Set(["ContaFaixa", "ContaTarifas", "ContaComposicao", "ContaSimulador", "ContaHistorico", "ContaReajustes", "ContaBarrasReais", "ContaTabelaSobDemanda", "GraficoLinhas", "GraficoBarras", "TabelaInterativa", "Numero", "PainelEvidencia"]);

/** Soma, por componente, o tamanho em bytes das props que não são elementos nem funções (as de dado), percorrendo o que a página devolve sem renderizar. */
function propsDeCliente(no: unknown, soma: Map<string, number>, vistos = new Set<unknown>()): void {
  if (Array.isArray(no)) {
    no.forEach((x) => propsDeCliente(x, soma, vistos));
    return;
  }
  if (!no || typeof no !== "object") return;
  const el = no as { $$typeof?: unknown; type?: unknown; props?: Record<string, unknown> };
  if (!el.$$typeof) return;
  const dados: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(el.props ?? {})) {
    const ehElemento = (x: unknown) => !!x && typeof x === "object" && "$$typeof" in (x as object);
    if (k === "children" || ehElemento(v) || (Array.isArray(v) && v.some(ehElemento))) {
      propsDeCliente(v, soma, vistos);
      continue;
    }
    if (typeof v === "function") continue;
    dados[k] = v;
  }
  const nome = typeof el.type === "function" ? (el.type as { name: string }).name : "";
  if (COM_PROPS_NO_FLUXO.has(nome)) {
    // a mesma lista passada por referência a vários componentes vai uma vez no fluxo: não conta de novo
    const proprios: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(dados)) {
      if (v && typeof v === "object") {
        if (vistos.has(v)) continue;
        vistos.add(v);
      }
      proprios[k] = v;
    }
    soma.set(nome, (soma.get(nome) ?? 0) + Buffer.byteLength(JSON.stringify(proprios), "utf-8"));
  }
}

const LIMITE_PESO_PRINCIPAL = 395_000;
const LIMITE_PESO_REAJUSTES = 365_000;


/* ------------------------------------------------------------------------------------------------------------------------------
 * Rodada 2: o painel de subsídios e da CDE fala numa moeda só. Com "Em reais" escolhido, o número de destaque, a frase, o "o que mudou",
 * as tabelas e os gráficos mostram o mesmo valor (2025 em reais de ago/2026), e o que fica nominal diz que é nominal.
 * ---------------------------------------------------------------------------------------------------------------------------- */
describe.skipIf(!disponivel)("rodada 2: valores nominais e em reais seguem a escolha no painel inteiro", () => {
  const sub = gold.subsidios;
  const cde = gold.financiamento_cde!;
  const ipca = lerIpcaCsv(ler("public/energia/series/conta_ipca.csv"));
  const baseIso = gold.reajustes.comparacao_inflacao!.ultimo_ipca!;
  const base = mesAno(`${baseIso}-01`);
  const anos = Array.from(new Set([...sub.anual.map((a) => a.ano), ...cde.anos]));
  const fatores = fatoresReaisPorAno(ipca, anos, baseIso);
  const real: ValoresDoPainel = { modo: "real", base, fatores };
  const ano = sub.anual.find((a) => a.ano === sub.ultimo_ano_completo)!;
  const catsSub = categoriasSubsidio(sub);
  const doGrafico = emReaisDoMesBase(linhasSubsidios(sub), ["soma", "total_publicado", ...catsSub], fatores, "ano");
  const linhaGrafico = (a: string) => doGrafico.find((l) => l.ano === a)!;
  const bi = (x: number) => reais(x, 2);

  it("o valor em reais de cada ano é o mesmo no gráfico, na frase, no veredito, no número de destaque e no que mudou", () => {
    const g25 = linhaGrafico(ano.ano).soma as number;
    expect(valorNoModo(ano.soma_categorias, ano.ano, real)! / 1e9).toBeCloseTo(g25, 9);
    expect(g25).toBeGreaterThan(ano.soma_categorias! / 1e9);
    expect(semEspacoDuro(respostaSubsidios(sub, real))).toContain(semEspacoDuro(`foram homologados ${bi(g25)} bilhões para repasse da Conta de Desenvolvimento Energético (CDE)`));
    expect(semEspacoDuro(vereditoSubsidios(sub, real))).toContain(semEspacoDuro(`foram homologados ${bi(g25)} bilhões`));
    expect(vereditoSubsidios(sub, real)).toContain(`valores em reais de ${base}`);
    // o nominal aparece, dito como nominal, ao lado do valor em reais
    expect(semEspacoDuro(respostaSubsidios(sub, real))).toContain(semEspacoDuro(`o valor nominal, na moeda da época, é ${bi(ano.soma_categorias! / 1e9)} bilhões`));
    const completos = sub.anual.filter((a) => !a.parcial);
    const [a0, a1] = completos.slice(-2);
    const mudou = semEspacoDuro(mudancaSubsidios(sub, real));
    expect(mudou).toContain(semEspacoDuro(`passou de ${bi(linhaGrafico(a0.ano).soma as number)} bilhões para ${bi(linhaGrafico(a1.ano).soma as number)} bilhões`));
    expect(mudou).toContain(`Valores em reais de ${base}`);
    // cada categoria da frase "maior mudança" também é a do gráfico em reais
    const dif = catsSub
      .map((c) => ({ c, d: Math.abs(((linhaGrafico(a1.ano)[c] as number | null) ?? NaN) - ((linhaGrafico(a0.ano)[c] as number | null) ?? NaN)) }))
      .filter((x) => Number.isFinite(x.d))
      .sort((a, b) => b.d - a.d);
    expect(mudou).toContain(`a maior mudança foi em ${dif[0].c}`);
  });

  it("no modo nominal, toda frase e o número de destaque dizem que os valores são nominais", () => {
    for (const t of [respostaSubsidios(sub), vereditoSubsidios(sub), mudancaSubsidios(sub)]) expect(t).toMatch(/nominais, na moeda da época/);
    expect(respostaCde(cde)).toMatch(/bilhões nominais, na moeda da época/);
    expect(rotuloMoeda(VALORES_NOMINAIS)).toBe("nominais, na moeda da época");
    expect(rotuloMoeda(real)).toBe(`em reais de ${base}`);
    expect(semEspacoDuro(respostaSubsidios(sub))).toContain(semEspacoDuro(`foram homologados ${bi(ano.soma_categorias! / 1e9)} bilhões para repasse da Conta de Desenvolvimento Energético (CDE)`));
  });

  it("o orçamento da CDE em reais usa o mesmo fator do gráfico, com o nominal ao lado", () => {
    const t = cde.totais.find((x) => x.ano === cde.ultimo_ano)!;
    const linhas = emReaisDoMesBase(linhasCde(cde), ["despesa"], fatores, "ano");
    const g = linhas.find((l) => l.ano === cde.ultimo_ano)!.despesa as number;
    const txt = semEspacoDuro(respostaCde(cde, real));
    expect(txt).toContain(semEspacoDuro(`${bi(g)} bilhões em reais de ${base} (${bi(t.despesa! / 1e9)} bilhões nominais)`));
    // sem fator para o ano, não há valor em reais: a frase volta ao nominal e diz por quê
    const semFator: ValoresDoPainel = { modo: "real", base, fatores: { ...fatores, [cde.ultimo_ano]: null } };
    expect(respostaCde(cde, semFator)).toMatch(/o IPCA não cobre o ano/);
    expect(semEspacoDuro(respostaCde(cde, semFator))).toContain(semEspacoDuro(`${bi(t.despesa! / 1e9)} bilhões nominais`));
  });

  it("as tabelas de dinheiro seguem a moeda: cada linha pelo fator do ano, e a soma por distribuidora bate com o total do número de destaque", () => {
    const porAno = linhasCde(cde);
    const chaves = ["despesa", ...GRUPOS_DESPESA_CDE, "receita"];
    const r = { chaves, base, fatores, chaveAno: "ano" };
    expect(tabelaTemReal(r)).toBe(true);
    const tabela = linhasEmReais(porAno, r);
    const grafico = emReaisDoMesBase(porAno, chaves, fatores, "ano");
    expect(tabela.map((l) => l.despesa)).toEqual(grafico.map((l) => l.despesa));
    expect(tabela.find((l) => l.ano === cde.ultimo_ano)!.quotas_pct).toBe(porAno.find((l) => l.ano === cde.ultimo_ano)!.quotas_pct);
    // um ano só: os subsídios por distribuidora (R$ milhões) vezes o fator do ano somam o número de destaque em reais
    const f = fatores[ano.ano]!;
    const dist = sub.distribuidoras_ultimo_ano.map((d) => ({ id: d.cnpj, total: d.total === null ? null : d.total / 1e6 }));
    const emReais = linhasEmReais(dist, { chaves: ["total"], base, fatorUnico: f });
    const soma = emReais.reduce((s, l) => s + ((l.total as number | null) ?? 0), 0);
    expect(soma / 1e3).toBeCloseTo(valorNoModo(ano.soma_categorias, ano.ano, real)! / 1e9, 3);
    // ano sem fator: null, nunca o nominal passando por real
    expect(linhasEmReais(dist, { chaves: ["total"], base, fatorUnico: null }).every((l) => l.total === null)).toBe(true);
    expect(tabelaTemReal({ chaves: ["total"], base, fatorUnico: null })).toBe(false);
    expect(tabelaTemReal({ chaves, base: null, fatores })).toBe(false);
  });

  it("a página traz o número de destaque, a frase e o que mudou em duas versões, escolhidas pela mesma ?valores= dos gráficos", () => {
    const fonte = ler("src/app/setor-eletrico/conta-de-luz/reajustes-e-subsidios/page.tsx");
    expect((fonte.match(/<ContaPorValores/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect(fonte).toContain("real={valoresReal ? mudancaSubsidios(sub, valoresReal) : null}");
    expect(fonte).toContain("vereditoSubsidios(sub, valoresReal)");
    expect(fonte).toContain("respostaCde(cde, valoresReal)");
    expect(fonte).toContain("reais={{ chaves:");
    const html = renderToStaticMarkup(createElement(ContaReajustesPage));
    expect((html.match(/data-moeda="nominal"/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect(html).not.toContain('data-moeda="real"');
    expect(semEspacoDuro(html)).toContain(semEspacoDuro("Valores nominais · "));
    const ctx = ler("src/components/energia/ContaPorValores.tsx");
    expect(ctx).toContain("CAMPO_VALORES");
    expect(ler("src/components/energia/ContaBarrasReais.tsx")).toContain("CAMPO_VALORES");
  });

  it("controle de rubrica que cai a zero: Rural e Água, esgoto e saneamento são achadas nos dados, sem causa inventada", () => {
    const z = categoriasQueZeraram(sub);
    expect(z.map((x) => x.categoria).sort()).toEqual(["Rural", "Água-esgoto-saneamento"]);
    expect(z.every((x) => x.desde === "2024")).toBe(true);
    const rural = z.find((x) => x.categoria === "Rural")!;
    const serie = sub.anual.filter((a) => !a.parcial).map((a) => a.categorias["Rural"] as number);
    expect(rural.pico).toBe(Math.max(...serie));
    const t = textoCategoriasQueZeraram(z)!;
    expect(t).toContain("Rural e Água-esgoto-saneamento ficam em quase zero");
    expect(t).toContain("desde 2024");
    expect(t).toContain("não explica a mudança");
    expect(t).toContain("o observatório não confirmou a causa regulatória");
    expect(t).not.toMatch(/\b(hoje|agora|atual|porque|bom|ruim|melhor|pior)\b/i);
    expect(textoCategoriasQueZeraram(z, real)!).toContain(`Valores em reais de ${base}`);
    expect(textoCategoriasQueZeraram([])).toBeNull();
    // o controle de verdade: uma categoria nova que cai a zero é achada, e uma série estável não acusa nada
    const fabrica = (valores: number[]): typeof sub => ({
      ...sub,
      categorias: [{ categoria: "X", definicao: "" }],
      anual: valores.map((v, i) => ({ ano: String(2020 + i), meses: 12, parcial: false, categorias: { X: v }, soma_categorias: v, total_publicado: v })),
    });
    expect(categoriasQueZeraram(fabrica([2e9, 2e9, 1e9, 1e6, 0])).map((x) => [x.categoria, x.desde])).toEqual([["X", "2023"]]);
    expect(categoriasQueZeraram(fabrica([2e9, 2.2e9, 2.4e9, 2.5e9, 2.6e9]))).toEqual([]);
    expect(categoriasQueZeraram(fabrica([5e7, 4e7, 0, 0, 0]))).toEqual([]);
  });

  it("o cartão das quotas diz que é orçamento, que os anos antes também são, e que as receitas do último ano ainda estão incompletas", () => {
    const n = notaQuotas(cde)!;
    expect(n).toContain("Orçamento aprovado ou previsto pela ANEEL, não execução.");
    expect(n).toContain("Antes: 87,6% em 2024 e 90,2% em 2025, também orçamento.");
    expect(n).toContain(`a participação de ${cde.ultimo_ano} não é comparável à dos anos anteriores`);
    expect(n).not.toMatch(/\b(hoje|agora|atual|porque)\b/i);
    const htmlP = renderToStaticMarkup(createElement(ContaReajustesPage));
    expect(htmlP).toContain(`Quotas nas receitas da CDE, orçamento de ${cde.ultimo_ano}`);
  });
});


/* ------------------------------------------------------------------------------------------------------------------------------
 * Rodada 2: o ranking diz o que cobre. Menor e maior custo são "entre as N com tarifa vigente", com o peso em UCs ao lado, a cobertura em
 * distribuidoras e em UCs contra o piso de 99%, a mediana ponderada ao lado da simples, a régua que ordena e a outra régua.
 * ---------------------------------------------------------------------------------------------------------------------------- */
describe.skipIf(!disponivel)("rodada 2: cobertura, extremos, mediana ponderada e régua do ranking", () => {
  const t = gold.tarifas;
  const historico = JSON.parse(ler("public/energia/series/conta_historico_b1.json")) as HistoricoB1;
  const qualidade = JSON.parse(ler("public/energia/gold/qualidade.json")) as { distribuidoras: { cnpj: string; classificacao?: string; ucs?: number; ano?: number }[] };
  const territorio = JSON.parse(ler("public/energia/gold/territorio.json")) as { distribuidoras: { cnpj: string; area?: { ufs?: string[] } }[] };
  const cnpjs = [...t.vigentes.map((v) => v.cnpj), ...t.sem_vigente.map((x) => x.cnpj)];
  const info = infoDistribuidoras(cnpjs, qualidade.distribuidoras, territorio.distribuidoras);
  const fora = foraDoRanking(t.sem_vigente, historico.distribuidoras);
  const cob = coberturaDoRanking({ vigentes: t.vigentes, fora, info });

  it("a cobertura conta distribuidoras e UCs do universo (as vigentes mais as de vigência encerrada há até 90 dias), contra o piso de 99% das UCs", () => {
    expect(cob.n).toBe(t.resumo.n);
    expect(cob.universo).toBe(t.resumo.n + t.resumo.fora_vigencia_recente);
    expect(cob.nFora).toBe(t.resumo.fora_vigencia_recente);
    expect(cob.pctDistribuidoras).toBeCloseTo((cob.n / cob.universo) * 100, 9);
    // as UCs, por outro caminho: soma direta da gold de Qualidade
    const ucs = new Map(qualidade.distribuidoras.map((d) => [d.cnpj, d.ucs ?? 0]));
    const dentro = t.vigentes.reduce((s, v) => s + (ucs.get(v.cnpj) ?? 0), 0);
    const emFora = t.sem_vigente.filter((x) => !x.incorporada_por && x.dias_sem_tarifa <= 90).reduce((s, x) => s + (ucs.get(x.cnpj) ?? 0), 0);
    expect(cob.ucs).toBe(dentro);
    expect(cob.ucsUniverso).toBe(dentro + emFora);
    expect(cob.pctUcs).toBeCloseTo((dentro / (dentro + emFora)) * 100, 9);
    expect(cob.piso).toBe(PISO_COBERTURA_UCS);
    expect(cob.atingePiso).toBe((cob.pctUcs as number) >= 99);
    // o que mudaria nos extremos com a última tarifa das de fora: vem do histórico, e é o mínimo e o máximo das que ficaram de fora
    const custos = fora.filter((f) => f.situacao === "encerrada" && f.custos).map((f) => ({ s: f.sigla, c: f.custos![1] as number }));
    expect(cob.seMantidas["200"].menor!.valor).toBe(Math.min(...custos.map((x) => x.c)));
    expect(cob.seMantidas["200"].maior!.valor).toBe(Math.max(...custos.map((x) => x.c)));
    // cada custo é o do perfil pela última vigência do arquivo de histórico
    const um = fora.find((f) => f.situacao === "encerrada" && f.custos)!;
    const vig = historico.distribuidoras[um.id].vigencias.find((v) => v[0] === t.sem_vigente.find((x) => x.cnpj === um.id)!.ultima_vigencia.inicio)!;
    expect(um.custos![1]).toBe(custoDoPerfil(vig[5], 200));
  });

  it("o texto da cobertura diz distribuidoras, UCs, piso e o que muda no menor e no maior; abaixo do piso, diz que os extremos valem só para as que têm tarifa", () => {
    const ref = referenciasDoPerfil(t.vigentes, t.resumo, 200);
    const extremos = { menor: ref.menor!.valor, maior: ref.maior!.valor, siglaMenor: ref.menor!.sigla, siglaMaior: ref.maior!.sigla };
    const txt = semEspacoDuro(textoCobertura(cob, 200, extremos));
    expect(txt).toContain(`${cob.n} de ${cob.universo} distribuidoras (${num(cob.pctDistribuidoras, 1)}%) e ${num(cob.pctUcs, 2)}% das UCs`);
    expect(txt).toContain(cob.atingePiso ? "acima do piso de 99% das UCs que Qualidade usa" : "Cobertura abaixo do piso de 99% das UCs");
    const se = cob.seMantidas["200"];
    if (se.menor!.valor < ref.menor!.valor) expect(txt).toContain(semEspacoDuro(`o menor custo de 200 kWh seria ${reais(se.menor!.valor)} (${se.menor!.sigla}), e não ${reais(ref.menor!.valor)} (${ref.menor!.sigla})`));
    expect(txt).not.toMatch(/\b(hoje|agora|atual|porque|bom|ruim|melhor|pior)\b/i);
    // abaixo do piso: as distribuidoras de fora passam a pesar mais de 1% das UCs
    const infoGrande = { ...info };
    for (const f of fora.filter((x) => x.situacao === "encerrada")) infoGrande[f.id] = { uf: null, tipo: null, ucs: 5_000_000, anoUcs: 2025 };
    const abaixo = coberturaDoRanking({ vigentes: t.vigentes, fora, info: infoGrande });
    expect(abaixo.atingePiso).toBe(false);
    const aviso = textoCobertura(abaixo, 200, extremos);
    expect(aviso).toContain("Cobertura abaixo do piso de 99% das UCs que Qualidade usa");
    expect(aviso).toContain(`O menor e o maior valem só para as ${abaixo.n} com tarifa e podem mudar`);
    // sem UCs, a cobertura não é medida: diz isso, em vez de afirmar o piso
    const semUcs = coberturaDoRanking({ vigentes: t.vigentes, fora, info: {} });
    expect(semUcs.atingePiso).toBeNull();
    expect(textoCobertura(semUcs, 200, extremos)).toContain("sem as UCs não há como medir");
  });

  it("a mediana ponderada pelas UCs vem ao lado da simples e difere dela", () => {
    expect(medianaPonderada([[1, 1], [2, 1], [3, 1]])).toBe(2);
    expect(medianaPonderada([[1, 1], [2, 1], [3, 10]])).toBe(3);
    expect(medianaPonderada([[1, null], [2, 0]])).toBeNull();
    expect(medianaPonderada([])).toBeNull();
    const r = medianaPonderadaDoPerfil(t.vigentes, info, 200);
    expect(r.semUcs).toBe(0);
    expect(r.valor).not.toBeNull();
    expect(r.valor).not.toBe(t.resumo.perfis_mediana["200"]);
    // por outro caminho: ordenar e somar os pesos até a metade
    const pares = t.vigentes.map((v) => [v.perfis["200"] as number, info[v.cnpj].ucs as number] as const).sort((a, b) => a[0] - b[0]);
    const total = pares.reduce((s, p) => s + p[1], 0);
    let acc = 0;
    let esperado = pares[pares.length - 1][0];
    for (const [c, u] of pares) {
      acc += u;
      if (acc * 2 >= total) {
        esperado = c;
        break;
      }
    }
    expect(r.valor).toBe(esperado);
    const nota = semEspacoDuro(notaFaixaTarifa(t.resumo, null, { perfil: 200, ponderada: r.valor, cobertura: cob, extremos: { menor: 1, maior: 2 } }));
    expect(nota).toContain(semEspacoDuro(`Ponderada pelas UCs de cada distribuidora, a mediana de 200 kWh é ${reais(r.valor)} (a simples é ${reais(t.resumo.perfis_mediana["200"])})`));
  });

  it("a abertura rotula menor e maior como 'entre as N com tarifa vigente', com o peso em UCs de cada um, e a nota traz a cobertura", () => {
    const html = renderToStaticMarkup(createElement(ContaDeLuzPage));
    const ref = referenciasDoPerfil(t.vigentes, t.resumo, 200);
    const h = semEspacoDuro(html);
    expect(h).toContain(`Menor custo de 200 kWh/mês, entre as ${t.resumo.n} com tarifa vigente`);
    expect(h).toContain(`Maior custo de 200 kWh/mês, entre as ${t.resumo.n} com tarifa vigente`);
    expect(h).toContain(semEspacoDuro(`${ref.menor!.sigla} (${textoUcs(info[ref.menor!.cnpj].ucs)}), ${dataBR(gold.data_referencia)}`));
    expect(h).toContain(semEspacoDuro(`${ref.maior!.sigla} (${textoUcs(info[ref.maior!.cnpj].ucs)}), ${dataBR(gold.data_referencia)}`));
    expect(h).toContain('data-nota="cobertura-ranking"');
    expect(h).toContain(`${cob.n} de ${cob.universo} distribuidoras`);
    expect(textoUcs(6134)).toBe("6,1 mil UCs");
    expect(textoUcs(950)).toBe("950 UCs");
    expect(textoUcs(null)).toBe("UCs não informadas");
    // a frase da resposta diz o universo
    expect(h).toContain(`entre as ${t.resumo.n} distribuidoras com tarifa vigente no arquivo`);
  });

  it("a régua que ordena é dita, a outra régua está na tabela e na dica, e as distribuidoras que mudam de lugar levam †", () => {
    const linhas = linhasRanking(t.vigentes, 200, info);
    // por outro caminho: contar na gold as que diferem mais de 20% e a posição pela base
    const comBase = t.vigentes.filter((v) => v.be_total);
    const marcadas = comBase.filter((v) => Math.abs(v.total / (v.be_total as number) - 1) > 0.2);
    const regua = reguaDoRanking(linhas);
    expect(regua.marcadas).toBe(marcadas.length);
    expect(linhas.filter((l) => marcaBase(l)).length).toBe(marcadas.length);
    const pelaBase = [...comBase].sort((a, b) => (a.be_total as number) - (b.be_total as number) || a.posicao - b.posicao).map((v) => v.cnpj);
    for (const l of linhas) expect(l.posicao_base).toBe(pelaBase.indexOf(l.id) + 1);
    const cooperluz = linhas.find((l) => l.sigla === "COOPERLUZ")!;
    expect(regua.exemplo).not.toBeNull();
    const txt = semEspacoDuro(textoReguaDoRanking(regua));
    expect(txt).toContain("O ranking ordena pela tarifa de aplicação");
    expect(txt).toContain("A base econômica");
    expect(txt).toContain(`Em ${marcadas.length} distribuidoras, marcadas com †`);
    expect(txt).toContain(`${regua.exemplo!.sigla} é a ${regua.exemplo!.posicao}ª pela aplicação e a ${regua.exemplo!.posicaoBase}ª pela base`);
    expect(marcaBase(cooperluz)).toBe(true);
    const dica = dicaDaRegua(cooperluz)!;
    expect(dica).toContain(`${cooperluz.posicao}ª pela aplicação, ${cooperluz.posicao_base}ª pela base econômica`);
    expect(dicaDaRegua(linhas.find((l) => !marcaBase(l))!)).toBeUndefined();
    // a página: a nota diz a régua, a barra marcada leva †, e os pontos marcados levam a dica no título
    const html = renderToStaticMarkup(createElement(ContaDeLuzPage));
    expect(semEspacoDuro(html)).toContain("O ranking ordena pela tarifa de aplicação (TE + TUSD homologadas)");
    expect(html).toContain(escapar(dica));
    expect(COLUNAS_RANKING.map((c) => c.id)).toEqual(expect.arrayContaining(["be_total", "posicao_base", "dif_base_pct"]));
    expect(linhasRanking(t.vigentes, 200, info).every((l) => l.dif_base_pct === null || Number.isFinite(l.dif_base_pct))).toBe(true);
  });

  it("quem ficou fora do ranking aparece em Entender com a contagem e o motivo, e no seletor com a última tarifa; as incorporadas não entram no seletor", () => {
    const r = resumoForaDoRanking(fora);
    expect(r.total).toBe(t.sem_vigente.length);
    expect(r.encerradas).toBe(t.resumo.fora_vigencia_recente);
    expect(r.encerradas + r.incorporadas + r.semTarifa).toBe(r.total);
    expect(r.semTarifa).toBe(t.resumo.fora_sem_tarifa_ha_mais_de_90_dias - r.incorporadas);
    const linha = textoForaDoRankingLinha(r)!;
    expect(linha).toContain(`Fora do ranking: ${r.total} distribuidoras.`);
    expect(linha).toContain(`${r.encerradas} tiveram a vigência encerrada em ${dataBR(r.dataEncerramento!)} e a tarifa seguinte ainda não está no arquivo`);
    expect(linha).toContain("foram incorporadas por outra distribuidora");
    expect(textoForaDoRankingLinha(resumoForaDoRanking([]))).toBeNull();
    const html = renderToStaticMarkup(createElement(ContaDeLuzPage));
    expect(semEspacoDuro(html)).toContain(semEspacoDuro(linha));
    expect(html).toContain('href="#fora-do-ranking"');
    expect(html).toContain('id="fora-do-ranking"');
    const naoIncorporadas = fora.filter((f) => f.situacao !== "incorporada");
    expect(html).toContain(`<optgroup label="Sem tarifa vigente na data (${naoIncorporadas.length})">`);
    for (const f of naoIncorporadas.slice(0, 3)) expect(html).toContain(`>${f.sigla}</option>`);
    // a distribuidora escolhida que está fora diz o motivo e o custo pela última tarifa
    const escolhida = fora.find((f) => f.situacao === "encerrada" && f.custos)!;
    const frase = textoForaDoRanking(expandirFora(compactarFora([escolhida]))[0], 200, gold.data_referencia);
    expect(semEspacoDuro(frase)).toContain(`${escolhida.sigla} não está no ranking: a vigência da tarifa B1 terminou em ${dataBR(escolhida.fim)} e a tarifa seguinte ainda não consta no arquivo de ${dataBR(gold.data_referencia)}`);
    expect(semEspacoDuro(frase)).toContain(semEspacoDuro(`Pela última tarifa que teve, 200 kWh custavam ${reais(escolhida.custos![1])}; esse valor não entra no ranking nem na mediana.`));
    expect(expandirFora(compactarFora(fora)).map((f) => [f.id, f.situacao, f.fim])).toEqual(fora.map((f) => [f.id, f.situacao, f.fim]));
  });

  it("a tabela do ranking só abre ao pedido (em Analisar nasce aberta), a escolha no gráfico não a abre, e as linhas de referência são uma por gráfico", () => {
    const tarifas = ler("src/components/energia/ContaTarifas.tsx");
    expect(tarifas).toContain('<ContaSobDemanda chaveUrl="tar" abreEm="analisar"');
    expect(tarifas).toContain("iniciarAberta");
    const sob = ler("src/components/energia/ContaSobDemanda.tsx");
    expect(sob).toContain("abreEm");
    expect(sob).toContain('.modo-profundidade');
    // modo TE e TUSD: a mediana é a única linha de referência (três tracejados iguais só se distinguiam pela ordem da legenda)
    const bloco = tarifas.slice(tarifas.indexOf("empilhado"), tarifas.indexOf("limiteInicial={12}", tarifas.indexOf("empilhado")));
    expect((bloco.match(/rotulo: rotuloMediana/g) ?? []).length).toBe(1);
    expect(bloco).not.toMatch(/rotulo: "(1º|3º) quartil"/);
    expect(tarifas).toContain("const rotuloMediana = `Mediana das ${resumo.n}${filtrado ? \", todas\" : \"\"}`");
  });
});


/* ------------------------------------------------------------------------------------------------------------------------------
 * Rodada 2, página de reajustes e bandeiras: a última mudança da distribuidora escolhida, uma linha de referência por gráfico, a bandeira
 * em reais para o consumo de referência, a dica de cada mês da grade e o limite à vista na abertura das duas páginas.
 * ---------------------------------------------------------------------------------------------------------------------------- */
describe.skipIf(!disponivel)("rodada 2: última mudança, bandeira na conta, dica da grade, limite da abertura e rótulo do ajuste", () => {
  const html = renderToStaticMarkup(createElement(ContaDeLuzPage));
  const htmlP = renderToStaticMarkup(createElement(ContaReajustesPage));
  const h = semEspacoDuro(html);
  const hp = semEspacoDuro(htmlP);

  it("a última mudança da tarifa de cada distribuidora escolhida sai dos dados: data, ato, variação com o verbo e o IPCA desde a mudança anterior", () => {
    const u = gold.reajustes.ultimos[0];
    const t = textoUltimaMudanca(u);
    expect(t).toContain(`a última mudança da tarifa B1 foi em ${dataBR(u[2])} (${u[3]})`);
    expect(t).toContain(verboVariacao(u[4]));
    expect(t).toContain(`o IPCA desde a mudança anterior (${mesAno(`${u[6]}-01`)} a ${mesAno(`${u[7]}-01`)}) foi ${pct(u[5], 2)}`);
    expect(t).not.toMatch(/\b(hoje|agora|atual|porque)\b/i);
    // mudança de perímetro é dita: compara áreas diferentes
    const comPerimetro = gold.reajustes.ultimos.find((x) => x[8]);
    if (comPerimetro) expect(textoUltimaMudanca(comPerimetro)).toContain("É mudança de perímetro");
    const fonte = ler("src/components/energia/ContaReajustes.tsx");
    expect(fonte).toContain("data-ultima-mudanca");
    expect(fonte).toContain("textoUltimaMudanca(u)");
    // uma linha de referência só no ranking de variações: o IPCA (a mediana está na faixa de pontos, no cartão e na tabela)
    const refs = fonte.slice(fonte.indexOf("const refs = ["), fonte.indexOf("const marcas = ["));
    expect(refs).toContain("IPCA de");
    expect(refs).not.toContain('rotulo: "Mediana das distribuidoras"');
  });

  it("a bandeira em reais para o consumo de referência: cada patamar vezes 100, 200 e 300 kWh, com o verde sem acréscimo", () => {
    expect(htmlP).toContain('data-bloco="bandeira-na-conta"');
    const band = gold.bandeiras;
    const amarela = band.patamares.find((p) => p.bandeira === "Amarela")!;
    for (const k of gold.perfis_kwh) expect(hp).toContain(semEspacoDuro(reais(custoDoPerfil(amarela.rs_mwh, k))));
    expect(hp).toContain("sem acréscimo");
    expect(hp).toContain(`Quanto cada bandeira acrescenta à conta de ${gold.perfis_kwh.join(", ")} kWh no mês, em R$ e antes de tributos`);
    // a conta confere por outro caminho: kWh × R$/MWh ÷ 1000
    expect(custoDoPerfil(amarela.rs_mwh, 200)).toBeCloseTo((200 * (amarela.rs_mwh as number)) / 1000, 2);
  });

  it("a grade de bandeiras ganha dica por mês (mouse, foco, toque) e setas, com uma parada de tabulação só", () => {
    const celulas = (htmlP.match(/<td class="cb-cel"/g) ?? []).length;
    expect(celulas).toBe(gold.bandeiras.acionamento.length);
    expect(htmlP).toContain("data-dica-bandeira");
    expect(hp).toContain("Passe o mouse, toque ou use as setas sobre um mês para ver a bandeira e o adicional dele.");
    const ilha = ler("src/components/energia/ContaGradeDica.tsx");
    for (const x of ['setAttribute("tabindex"', "ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", 'role="status"', "td.title = t", "onMouseOver", "onFocus", "onClick"]) expect(ilha, x).toContain(x);
    expect(ler("src/components/energia/ContaBandeiras.tsx")).toContain("<ContaGradeDica");
  });

  it("a abertura das duas páginas traz a razão no lead e o limite à vista, e a série de arredondamento não se passa por componente", () => {
    const t = gold.tarifas;
    expect(html).toContain("data-limite");
    expect(h).toContain(`Não é a fatura: faltam ICMS, PIS/Pasep, Cofins, iluminação pública e bandeira. O menor e o maior custo são das ${t.resumo.n} distribuidoras com tarifa no arquivo de ${dataBR(gold.data_referencia)}`);
    expect(h).toContain("O mesmo consumo em quilowatt-hora (kWh) custa diferente conforme a distribuidora");
    expect(htmlP).toContain("data-limite");
    expect(hp).toContain("Não é o efeito médio do processo tarifário, que a fonte não publica em dado aberto");
    expect(hp).toContain("os descontos a categorias de usuários são pagos pela Conta de Desenvolvimento Energético (CDE)");
    // o limite e o lead são texto da família: sem tempo relativo, causalidade nem juízo de valor
    const limite = (x: string) => semEspacoDuro((/data-limite[^>]*>([\s\S]*?)<\/p>/.exec(x)?.[1] ?? "").replace(/<[^>]+>/g, " "));
    expect(limite(html).length).toBeGreaterThan(80);
    expect(limite(htmlP).length).toBeGreaterThan(80);
    for (const x of [limite(html), limite(htmlP), "O mesmo consumo em quilowatt-hora (kWh) custa diferente conforme a distribuidora", "A tarifa B1 (residencial, baixa tensão) muda a cada reajuste"]) expect(x).not.toMatch(/\b(hoje|agora|atual|porque|bom|ruim|melhor|pior)\b/i);
    expect(ROTULO_AJUSTE).toBe("Ajuste de arredondamento (não é componente)");
  });
});
