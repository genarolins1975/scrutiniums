import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import QualidadePage from "@/app/setor-eletrico/qualidade/page";
import { QualidadeComparador } from "@/components/energia/QualidadeComparador";
import { QualidadeConjuntos } from "@/components/energia/QualidadeConjuntos";
import { QualidadeLimites } from "@/components/energia/QualidadeLimites";
import { QualidadeMapa } from "@/components/energia/QualidadeMapa";
import { lerEstado } from "@/lib/energia/estadoUrl";
import { problemasEvidencia } from "@/lib/energia/evidencia";
import { num } from "@/lib/energia/formato";
import {
  CAMPO_DIST,
  CAMPO_IND,
  CAMPO_MEDIDA,
  CAMPO_MUN,
  COLUNAS_LIMITES,
  COLUNAS_MUNICIPIOS,
  arquivoConjuntosDoAno,
  avisoDefasagem,
  comparaNaPrecisao,
  conjuntosDoCsv,
  destacar,
  histogramaDeFaixas,
  horasEMinutos,
  itensLimite,
  lerCsv,
  linhasBrasilAnual,
  linhasBrasilMensal,
  linhasCompensacaoAnual,
  linhasCompensacaoMensal,
  linhasCompensacaoTipo,
  linhasDistribuidorasP051,
  linhasEscopos,
  linhasLimites,
  linhasMunicipios,
  linhasParcelas,
  linhasReclamacoesNacional,
  linhasSerieDistribuidoras,
  linhasTipoAnoReferencia,
  maioresDistribuidoras,
  mudancaP051,
  mudancaP053,
  mudancaP054,
  municipiosDoCsv,
  notaTiposCompensacao,
  notaTiposSemUc,
  pctCobertura,
  textoAtualidade,
  reaisMilhoes,
  respostaHistoricoDistribuidora,
  respostaMunicipio,
  respostaP051,
  respostaP052,
  respostaP053,
  respostaP054,
  situacaoLimite,
  tabelaQualidade,
  TABELAS_SOB_DEMANDA,
  valoresMapa,
  vezes,
  type MunicipioQualidade,
} from "@/lib/energia/qualidade";
import { gerarCsv } from "@/lib/energia/tabela";
import type {
  Distribuidora,
  QualidadeGold,
  QualidadeMapaGold,
  QualidadeSeriesDistribuidorasGold,
  ValidacaoQualidade,
} from "@/lib/energia/tipos-qualidade";

/**
 * Módulo Qualidade do serviço (P051 a P054). O que este teste protege:
 *
 *  1. contrato da gold do lado da interface: o tipo TypeScript é espelho exato da gold
 *     (as listas de chaves abaixo são conferidas pelo compilador contra o tipo e, no
 *     teste, contra o JSON publicado), evidências completas e controles sem reprovação
 *     crítica;
 *  2. gráfico, tabela e exportação mostram as mesmas linhas: a lista que a página entrega
 *     ao gráfico e à tabela, exportada pelo mesmo gerador de CSV da tabela, bate com os
 *     CSV publicados pelo pipeline, relidos aqui por outro caminho (leitura e soma
 *     próprias do arquivo, não a função da página);
 *  3. as respostas curtas saem dos números: mudam quando o número muda, dizem "abaixo"
 *     quando cai, viram ausência explicada quando o número falta e nunca trazem número
 *     fixo; centésimos de hora nunca viram minutos por leitura literal;
 *  4. a página e os componentes do módulo renderizam no servidor com os quatro painéis,
 *     pergunta como título, resposta, recorte, tabelas equivalentes, provas, link
 *     compartilhável, próxima pergunta e profundidade, sem "em breve" nem hexadecimal.
 */
const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
const caminhoGold = join(raiz, "public/energia/gold/qualidade.json");
const gold = (existsSync(caminhoGold) ? JSON.parse(readFileSync(caminhoGold, "utf-8")) : { disponivel: false }) as QualidadeGold;
const disponivel = gold.disponivel === true;

// Chaves de primeiro nível: `satisfies` recusa chave que o tipo não tem, e o tipo
// `FaltaNaLista` recusa chave do tipo que a lista esqueceu (exaustividade no compilador).
const CHAVES_GOLD = [
  "dominio", "gold", "gerado_em", "versao_pipeline", "versao_codigo", "disponivel",
  "ano_referencia", "ultimo_mes_completo", "parcial", "unidades", "regras", "parcelas", "brasil",
  "distribuidoras", "conjuntos", "compensacoes", "atendimento", "mapa", "reconciliacao", "controles",
  "validacao", "evidencias", "proveniencia", "downloads",
] as const satisfies readonly (keyof QualidadeGold)[];
type FaltaNaLista = Exclude<keyof QualidadeGold, (typeof CHAVES_GOLD)[number] | "motivo">;
const exaustivoGold: [FaltaNaLista] extends [never] ? true : false = true;

const CHAVES_DISTRIBUIDORA = [
  "cnpj", "sigla", "nome_comercial", "classificacao", "ano", "meses", "ucs", "conjuntos", "dec", "fec",
  "dec_limite", "fec_limite", "cobertura_limite", "razao_dec", "razao_fec", "dgc_calculado", "dgc_publicado",
  "posicao_ranking", "porte_ranking", "dec_todas_parcelas", "fec_todas_parcelas", "pct_dec_expurgado",
  "parcelas_dec", "parcelas_fec", "cobertura_min", "compensacao", "iasc", "reclamacoes", "tmae_min",
  "eventos_emergencia_2026", "telefonico", "quebras_perimetro",
] as const satisfies readonly (keyof Distribuidora)[];
type FaltaDistribuidora = Exclude<keyof Distribuidora, (typeof CHAVES_DISTRIBUIDORA)[number]>;
const exaustivoDistribuidora: [FaltaDistribuidora] extends [never] ? true : false = true;

const CHAVES_VALIDACAO = ["nome", "resultado", "critico", "detalhe"] as const satisfies readonly (keyof ValidacaoQualidade)[];
type FaltaValidacao = Exclude<keyof ValidacaoQualidade, (typeof CHAVES_VALIDACAO)[number]>;
const exaustivoValidacao: [FaltaValidacao] extends [never] ? true : false = true;

const ordenadas = (xs: readonly string[]) => [...xs].sort();

/** Leitura própria do CSV publicado (sem a função lerCsv da página): os arquivos do pipeline não têm aspas. */
function linhasCsv(nome: string): Record<string, string>[] {
  const [cab, ...linhas] = ler(`public/energia/series/${nome}`).replace(/^﻿/, "").trim().split("\n");
  const campos = cab.split(";");
  return linhas.map((l) => Object.fromEntries(l.split(";").map((v, i) => [campos[i], v])));
}

/**
 * Tolerância entre a gold (duas casas, a precisão da ANEEL) e o CSV anual (quatro casas):
 * meio centésimo do arredondamento da gold mais meio décimo de milésimo do CSV.
 */
const TOL = 0.005 + 0.00005 + 1e-9;

/** Cópia profunda da gold para os testes de mutação dos textos. */
const copia = (): QualidadeGold => JSON.parse(JSON.stringify(gold)) as QualidadeGold;

describe.skipIf(!disponivel)("gold qualidade.json", () => {
  it("chaves de primeiro nível iguais às do tipo QualidadeGold", () => {
    expect(exaustivoGold && exaustivoDistribuidora && exaustivoValidacao).toBe(true);
    expect(ordenadas(Object.keys(gold))).toEqual(ordenadas(CHAVES_GOLD));
  });

  it("cada distribuidora tem exatamente as chaves do tipo Distribuidora", () => {
    for (const d of gold.distribuidoras) expect(ordenadas(Object.keys(d)), d.cnpj).toEqual(ordenadas(CHAVES_DISTRIBUIDORA));
  });

  it("validacao: itens com nome, resultado no domínio, critico e detalhe; nenhum crítico reprovado publicado", () => {
    expect(gold.validacao.length).toBeGreaterThan(0);
    for (const v of gold.validacao) {
      expect(ordenadas(Object.keys(v))).toEqual(ordenadas(CHAVES_VALIDACAO));
      expect(["aprovado", "ressalva", "reprovado"]).toContain(v.resultado);
      expect(v.critico && v.resultado === "reprovado").toBe(false);
    }
  });

  it("as evidências \"Comprove este número\" que a página usa estão completas", () => {
    for (const k of ["dec_brasil", "fec_brasil", "conjuntos_acima_limite", "compensacoes_ano", "reclamacoes_distribuidora", "ouvidoria_aneel"] as const) {
      const ev = gold.evidencias[k];
      expect(ev, k).toBeTruthy();
      expect(problemasEvidencia(ev!), k).toEqual([]);
    }
  });

  it("conjuntos acima do limite: gold igual ao CSV de download (comparação em centésimos)", () => {
    const ano = gold.conjuntos.ano;
    const decada = Math.floor(ano / 10) * 10;
    const linhas = linhasCsv(`qualidade_conjuntos_anual_${decada}_${decada + 9}.csv`).filter(
      (l) => Number(l.ano) === ano && l.meses === "12" && l.dec_limite_h !== "",
    );
    expect(linhas.length).toBe(gold.conjuntos.com_limite);
    expect(linhas.filter((l) => l.acima_limite_dec === "1").length).toBe(gold.conjuntos.acima_limite_dec);
    // recontagem em centésimos inteiros pelos próprios valores do CSV
    const cent = (s: string) => Math.round(Number(s) * 100);
    expect(linhas.filter((l) => cent(l.dec_h) > cent(l.dec_limite_h)).length).toBe(gold.conjuntos.acima_limite_dec);
    expect(linhas.filter((l) => cent(l.dec_h) === cent(l.dec_limite_h)).length).toBe(gold.conjuntos.iguais_limite_dec);
  });

  it("taxa nacional sem nenhuma distribuidora no universo é ausência, nunca zero", () => {
    for (const x of [...gold.atendimento.reclamacoes_distribuidora, ...gold.atendimento.ouvidoria_aneel]) {
      if (x.distribuidoras === 0) {
        expect([x.total, x.ucs, x.cobertura_ucs, x.por_ucs]).toEqual([null, null, null, null]);
        expect(x.motivo_ausencia).toBeTruthy();
      }
    }
  });

  it("acumulado do ano corrente sem mês incompleto", () => {
    if (!gold.parcial) return;
    const incompletos = new Set(gold.brasil.mensal.filter((m) => !m.completo).map((m) => m.m));
    for (const m of gold.parcial.meses_incluidos) expect(incompletos.has(m), m).toBe(false);
    expect(gold.parcial.meses).toBe(gold.parcial.meses_incluidos.length);
  });

  it("valores conferidos na fonte (documento do módulo, seções 4.2 e 4.3) continuam na gold", () => {
    // DEC e FEC só das concessionárias de 2025 contra o divulgado pela ANEEL (9,30 h e 4,66), precisão de duas casas
    const a25 = gold.brasil.anual.find((a) => a.ano === 2025);
    if (!a25 || a25.dec_concessionarias === null || a25.fec_concessionarias === null) return;
    expect(Math.abs(a25.dec_concessionarias - 9.3)).toBeLessThanOrEqual(0.005);
    expect(Math.abs(a25.fec_concessionarias - 4.66)).toBeLessThanOrEqual(0.005);
    // CEMIG-D 2025: DEC 8,976398059 h relido do Parquet (gold com duas casas)
    const cemig = gold.distribuidoras.find((d) => d.cnpj === "06981180000116");
    if (cemig && cemig.ano === 2025) expect(cemig.dec).toBeCloseTo(8.98, 2);
  });
});

const caminhoMapa = join(raiz, "public/energia/series/qualidade_mapa.json");
const caminhoSerie = join(raiz, "public/energia/series/qualidade_distribuidoras_serie.json");
const caminhoMunicipios = join(raiz, "public/energia/series/qualidade_municipios.csv");

describe.skipIf(!disponivel || !existsSync(caminhoMapa) || !existsSync(caminhoSerie))("JSONs lidos sob demanda", () => {
  it("mapa: uma linha por município do cadastro do IBGE e nenhum código fora dele", () => {
    const mapa = JSON.parse(readFileSync(caminhoMapa, "utf-8")) as QualidadeMapaGold;
    const cs = gold.mapa.correspondencia;
    expect(mapa.relacoes.length).toBe(5);
    if (cs.cadastro_ibge !== null) expect(mapa.linhas.length).toBe(cs.cadastro_ibge);
    const foraDoIbge = new Set(mapa.codigos_sem_ibge.map((x) => x.codigo));
    for (const l of mapa.linhas) expect(foraDoIbge.has(l[0]), l[0]).toBe(false);
  });

  it("séries por distribuidora: uma para cada distribuidora da gold, com vetores do mesmo tamanho", () => {
    const serie = JSON.parse(readFileSync(caminhoSerie, "utf-8")) as QualidadeSeriesDistribuidorasGold;
    expect(ordenadas(Object.keys(serie.distribuidoras))).toEqual(ordenadas(gold.distribuidoras.map((d) => d.cnpj)));
    for (const [cnpj, s] of Object.entries(serie.distribuidoras)) {
      for (const k of ["dec", "fec", "dec_limite", "fec_limite"] as const) expect(s[k].length, cnpj).toBe(s.anos.length);
    }
  });
});

/* ------------------------------------------------------------------ gráfico, tabela e exportação */

describe.skipIf(!disponivel || !existsSync(caminhoMunicipios))("gráfico, tabela e exportação mostram as mesmas linhas", () => {
  it("P051 Brasil anual: as linhas do gráfico e da tabela são os anos completos do CSV publicado", () => {
    const linhas = linhasBrasilAnual(gold);
    const csv = linhasCsv("qualidade_brasil.csv").filter((l) => l.tipo === "anual" && l.completo === "1");
    expect(linhas.map((l) => l.ano)).toEqual(csv.map((l) => l.periodo));
    linhas.forEach((l, i) => {
      expect(Math.abs((l.dec as number) - Number(csv[i].dec_h)), String(l.ano)).toBeLessThanOrEqual(TOL);
      expect(Math.abs((l.fec as number) - Number(csv[i].fec_interrupcoes)), String(l.ano)).toBeLessThanOrEqual(TOL);
      // ausência no CSV continua ausência na linha do gráfico (nunca zero)
      if (csv[i].dec_concessionarias_h === "") expect(l.dec_concessionarias, String(l.ano)).toBeNull();
    });
    // ano incompleto não vira ano no gráfico
    for (const a of gold.brasil.anual.filter((x) => !x.completo)) expect(linhas.some((l) => l.ano === String(a.ano))).toBe(false);
  });

  it("P051 Brasil mensal: mês incompleto fica fora do gráfico (nulo) e continua na tabela com o valor publicado", () => {
    const linhas = linhasBrasilMensal(gold);
    expect(linhas.length).toBe(gold.brasil.mensal.length);
    gold.brasil.mensal.forEach((m, i) => {
      expect(linhas[i].dec_publicado).toBe(m.dec);
      if (!m.completo) {
        expect(linhas[i].dec).toBeNull();
        expect(String(linhas[i].situacao)).toMatch(/incompleto/);
      } else expect(linhas[i].dec).toBe(m.dec);
    });
  });

  it("P051 parcelas: as barras empilhadas somam o DEC de todas as origens publicadas (tolerância 0,02 h, universos de ponderação diferentes)", () => {
    const linhas = linhasParcelas(gold);
    expect(linhas.length).toBeGreaterThan(0);
    for (const l of linhas) {
      const soma = ["apurado", "emergencia", "dia_critico", "externa", "ons"].reduce((s, k) => s + ((l[k] as number | null) ?? 0), 0);
      expect(Math.abs(soma - (l.total as number)), String(l.ano)).toBeLessThanOrEqual(0.02 + 0.03);
    }
  });

  it("P051 e P052 por distribuidora: tabela, pontos e CSV exportado têm as mesmas distribuidoras e valores do CSV anual publicado", () => {
    const ref = gold.ano_referencia;
    const csv = new Map(linhasCsv("qualidade_distribuidoras_anual.csv").filter((l) => Number(l.ano) === ref).map((l) => [l.cnpj, l]));
    const tabela = linhasDistribuidorasP051(gold);
    const limites = linhasLimites(gold);
    const pontos = itensLimite(gold, "dec");
    expect(ordenadas(tabela.map((l) => String(l.id)))).toEqual(ordenadas(Array.from(csv.keys())));
    expect(ordenadas(pontos.map((p) => p.id))).toEqual(ordenadas(limites.map((l) => String(l.id))));
    for (const l of limites) {
      const c = csv.get(String(l.id))!;
      for (const [k, col] of [["dec", "dec_h"], ["fec", "fec_interrupcoes"], ["dec_limite", "dec_limite_h"]] as const) {
        if (c[col] === "") expect(l[k], `${l.id} ${k}`).toBeNull();
        else expect(Math.abs((l[k] as number) - Number(c[col])), `${l.id} ${k}`).toBeLessThanOrEqual(TOL);
      }
      const p = pontos.find((x) => x.id === l.id)!;
      expect(p.valor).toBe(l.dec);
      expect(p.referencia).toBe(l.dec_limite);
    }
    // a exportação da tabela (mesma matriz) tem uma linha por distribuidora, na mesma ordem e com o mesmo DEC
    const exportado = gerarCsv(COLUNAS_LIMITES, limites, { bom: false }).trim().split("\r\n");
    expect(exportado.length - 1).toBe(limites.length);
    const iDec = COLUNAS_LIMITES.findIndex((c) => c.id === "dec");
    limites.forEach((l, i) => {
      const cel = exportado[i + 1].split(";")[iDec];
      expect(cel === "" ? null : Number(cel), String(l.id)).toBe(l.dec);
    });
  });

  it("P053 compensações: o total anual a UCs é a soma, refeita aqui, das linhas do CSV publicado", () => {
    const soma = new Map<number, { valor: number; qt: number }>();
    for (const l of linhasCsv("qualidade_compensacoes.csv")) {
      if (l.unidade !== "uc") continue;
      const ano = Number(l.competencia.slice(0, 4));
      const s = soma.get(ano) ?? { valor: 0, qt: 0 };
      s.valor += Number(l.valor_rs || 0);
      s.qt += Number(l.quantidade || 0);
      soma.set(ano, s);
    }
    const linhas = linhasCompensacaoAnual(gold);
    for (const a of gold.compensacoes.anual) {
      const s = soma.get(a.ano);
      if (!s || a.valor_uc === null) continue;
      // tolerância de R$ 1: o CSV guarda centavos e a soma de milhares de linhas acumula erro de ponto flutuante
      expect(Math.abs(s.valor - a.valor_uc), String(a.ano)).toBeLessThanOrEqual(1);
      expect(Math.abs(s.qt - (a.quantidade_uc ?? 0)), String(a.ano)).toBeLessThanOrEqual(0.5);
      const l = linhas.find((x) => x.ano === String(a.ano))!;
      expect(l.valor_uc).toBe(a.valor_uc);
      // só ano completo vai ao gráfico de barras
      expect(l.valor_uc_mi === null).toBe(!a.completo);
    }
    for (const m of linhasCompensacaoMensal(gold)) if (String(m.situacao).startsWith("incompleto")) expect(m.valor_mi).toBeNull();
  });

  it("mapa: o CSV de municípios lido pela página tem os mesmos valores do JSON do mapa, município a município", () => {
    const mapa = JSON.parse(readFileSync(caminhoMapa, "utf-8")) as QualidadeMapaGold;
    const municipios = municipiosDoCsv(readFileSync(caminhoMunicipios, "utf-8"));
    expect(municipios.length).toBe(mapa.linhas.length);
    const porCod = new Map(municipios.map((m) => [m.cod, m]));
    for (const [cod, rel, n, dmin, dmax, fmin, fmax] of mapa.linhas) {
      const m = porCod.get(cod)!;
      expect(m, cod).toBeTruthy();
      expect(m.relacao, cod).toBe(mapa.relacoes[rel]);
      expect([m.dec_min, m.dec_max, m.fec_min, m.fec_max], cod).toEqual([dmin, dmax, fmin, fmax]);
      if (m.relacao !== "sem_relacao_na_fonte") expect(m.conjuntos.length, cod).toBe(n);
    }
    // o mapa e a tabela recebem a mesma lista: cada valor do mapa é a célula da tabela
    const valores = valoresMapa(municipios, "dec_max");
    const linhas = linhasMunicipios(municipios, (c) => c);
    expect(linhas.length).toBe(Object.keys(valores).length);
    for (const l of linhas) expect(l.dec_max, String(l.id)).toBe(valores[String(l.id)]);
    expect(gold.mapa.municipios_com_valor).toBe(municipios.filter((m) => m.dec_max !== null).length);
    // a exportação da tabela do mapa tem uma linha por município
    expect(gerarCsv(COLUNAS_MUNICIPIOS, linhas, { bom: false }).trim().split("\r\n").length - 1).toBe(municipios.length);
  });

  it("explorador de conjuntos: o ano de referência lido do CSV reproduz a contagem acima do limite da gold", () => {
    const linhas = conjuntosDoCsv(ler(`public${arquivoConjuntosDoAno(gold.conjuntos.ano)}`), gold.conjuntos.ano);
    expect(linhas.filter((l) => l.situacao_dec === "acima do limite").length).toBe(gold.conjuntos.acima_limite_dec);
    expect(linhas.filter((l) => l.meses === 12 && l.dec_limite !== null).length).toBe(gold.conjuntos.com_limite);
  });

  it("histograma da razão: as classes somam os conjuntos com limite, com os quantis da gold", () => {
    const h = histogramaDeFaixas(gold.conjuntos.histograma_razao_dec, gold.conjuntos.quantis_razao_dec);
    expect(h.classes.reduce((s, c) => s + c.contagem, 0)).toBe(gold.conjuntos.com_limite);
    expect(h.resumo.mediana).toBe(gold.conjuntos.quantis_razao_dec.p50);
    expect(h.classes.at(-1)!.fim).toBe(gold.conjuntos.quantis_razao_dec.max);
    expect(h.larguraUniforme).toBe(false);
  });

  it("pequenos múltiplos: ano sem valor é lacuna, e cada coluna é a da série da distribuidora", () => {
    const serie = JSON.parse(readFileSync(caminhoSerie, "utf-8")) as QualidadeSeriesDistribuidorasGold;
    const cnpjs = maioresDistribuidoras(gold);
    expect(cnpjs.length).toBe(4);
    const linhas = linhasSerieDistribuidoras(serie, cnpjs, "dec");
    for (const c of cnpjs) {
      const s = serie.distribuidoras[c];
      for (const l of linhas) {
        const i = s.anos.indexOf(Number(l.ano));
        expect(l[`dec_${c}`], `${c} ${l.ano}`).toBe(i >= 0 ? s.dec[i] : null);
        expect(l[`lim_${c}`], `${c} ${l.ano}`).toBe(i >= 0 ? s.dec_limite[i] : null);
      }
    }
  });

  it("P053 por tipo: só unidades consumidoras, conferido com o CSV; tipo sem linha de UC é ausência, nunca zero", () => {
    // releitura própria do CSV: soma por ano e tipo, separando UC e UG
    const uc = new Map<string, number>();
    const ug = new Map<string, number>();
    for (const l of linhasCsv("qualidade_compensacoes.csv")) {
      const k = `${l.competencia.slice(0, 4)}|${l.tipo}`;
      const m = l.unidade === "uc" ? uc : ug;
      m.set(k, (m.get(k) ?? 0) + Number(l.valor_rs || 0));
    }
    const linhas = linhasCompensacaoTipo(gold);
    for (const a of gold.compensacoes.anual) {
      const l = linhas.find((x) => x.ano === String(a.ano))!;
      for (const t of ["mensal", "trimestral", "anual", "dicri", "dise"] as const) {
        const k = `${a.ano}|${t}`;
        if (uc.has(k)) expect(Math.abs((l[t] as number) - uc.get(k)!), k).toBeLessThanOrEqual(1);
        else expect(l[t], k).toBeNull();
        if (ug.has(k) && a.por_tipo[t]) expect(Math.abs((a.por_tipo[t]!.valor_ug ?? NaN) - ug.get(k)!), k).toBeLessThanOrEqual(1);
      }
    }
    // composição do ano de referência: as barras somam o total a UCs (o número do destaque)
    const ref = gold.compensacoes.anual.find((x) => x.ano === gold.compensacoes.ano_referencia)!;
    const barras = linhasTipoAnoReferencia(gold);
    const soma = barras.reduce((s2, b) => s2 + ((b.valor_mi as number | null) ?? 0), 0);
    expect(Math.abs(soma - (ref.valor_uc ?? 0) / 1e6)).toBeLessThanOrEqual(1e-6);
    // tipo publicado só para unidades geradoras: barra nula e frase que diz isso
    for (const b of barras) if (ref.por_tipo[b.id as "mensal"]!.valor_uc === null) expect(b.valor_mi, String(b.id)).toBeNull();
    const semUc = barras.filter((b) => b.valor_mi === null);
    if (semUc.length) expect(notaTiposSemUc(gold)).toMatch(/barra hachurada é ausência, não zero/);
    else expect(notaTiposSemUc(gold)).toBe("");
    // por distribuidora: as colunas por tipo são só UC e somam o valor de UC do CSV
    const ucDist = new Map<string, number>();
    for (const l of linhasCsv("qualidade_compensacoes.csv")) {
      if (l.unidade !== "uc" || Number(l.competencia.slice(0, 4)) !== gold.compensacoes.ano_referencia) continue;
      ucDist.set(l.cnpj, (ucDist.get(l.cnpj) ?? 0) + Number(l.valor_rs || 0));
    }
    for (const l of tabelaQualidade("comp-dist", gold).linhas) {
      const somaTipos = (["mensal", "trimestral", "anual", "dicri", "dise"] as const).reduce((s2, t) => s2 + ((l[t] as number | null) ?? 0), 0);
      expect(Math.abs(somaTipos - (ucDist.get(String(l.id)) ?? 0)), String(l.id)).toBeLessThanOrEqual(1);
    }
  });

  it("P053 por tipo: a nota dos anos com valor sai da série (mutação muda o texto)", () => {
    const anosCom = (t: "trimestral" | "dise") => gold.compensacoes.anual.filter((a) => a.por_tipo[t]?.valor_uc != null).map((a) => a.ano);
    const nota = notaTiposCompensacao(gold);
    const tri = anosCom("trimestral");
    if (tri.length) expect(nota).toContain(String(tri[0]));
    const g2 = copia();
    const ultimo = g2.compensacoes.anual[g2.compensacoes.anual.length - 1];
    ultimo.por_tipo.trimestral = { valor: 1, quantidade: 1, valor_uc: 1, quantidade_uc: 1, valor_ug: null, quantidade_ug: null };
    expect(notaTiposCompensacao(g2)).not.toBe(nota);
    expect(notaTiposCompensacao(g2)).toContain(`trimestral de ${tri[0]} a ${tri[tri.length - 1]} e ${ultimo.ano}`);
  });

  it("tabelas sob demanda: cada uma tem linhas com id único, colunas existentes nas linhas e exportação com uma linha por linha", () => {
    for (const id of TABELAS_SOB_DEMANDA) {
      const t = tabelaQualidade(id, gold);
      expect(t.linhas.length, id).toBeGreaterThan(0);
      expect(new Set(t.linhas.map((l) => l.id)).size, id).toBe(t.linhas.length);
      for (const c of t.colunas) expect(t.linhas.some((l) => c.id in l), `${id}.${c.id}`).toBe(true);
      expect(gerarCsv(t.colunas, t.linhas, { bom: false }).trim().split("\r\n").length - 1, id).toBe(t.linhas.length);
    }
    // a tabela de compensações por distribuidora soma o total publicado do ano (UC e UG)
    const comp = tabelaQualidade("comp-dist", gold);
    const total = comp.linhas.reduce((s, l) => s + ((l.valor as number | null) ?? 0), 0);
    const ano = gold.compensacoes.anual.find((x) => x.ano === gold.compensacoes.ano_referencia)!;
    expect(Math.abs(total - (ano.valor ?? 0))).toBeLessThanOrEqual(1);
  });

  it("P054: a barra de ano parcial é ausência (nula), com o motivo na tabela de escopos", () => {
    const barras = linhasReclamacoesNacional(gold);
    const escopos = linhasEscopos(gold);
    for (const r of gold.atendimento.reclamacoes_distribuidora) {
      const b = barras.find((x) => x.ano === String(r.ano))!;
      expect(b.total).toBe(r.por_ucs);
      if (r.por_ucs === null) {
        expect(b.total).toBeNull();
        expect(String(escopos.find((e) => e.id === `rec-${r.ano}`)!.motivo)).not.toBe("");
      }
    }
  });
});

/* ------------------------------------------------------------------ textos derivados dos números */

describe("unidades e comparações", () => {
  it("centésimos de hora viram minutos pela conta, nunca por leitura literal", () => {
    expect(horasEMinutos(9.33)).toBe("9 h 20 min");
    expect(horasEMinutos(10.5)).toBe("10 h 30 min");
    expect(horasEMinutos(0.75)).toBe("45 min");
    expect(horasEMinutos(2)).toBe("2 h");
    expect(horasEMinutos(1482)).toBe("1.482 h");
    expect(horasEMinutos(null)).toBe("sem dado");
    expect(horasEMinutos(9.33)).not.toContain("33 min");
  });

  it("comparação na precisão exibida, plural de vez e reais em milhões", () => {
    expect(comparaNaPrecisao(9.334, 9.33, 2)).toBe("igual");
    expect(comparaNaPrecisao(9.33, 10.28, 2)).toBe("abaixo");
    expect(comparaNaPrecisao(8.001, 8, 2)).toBe("igual");
    expect(vezes(0.86)).toBe("vez");
    expect(vezes(1.33)).toBe("vez");
    expect(vezes(2.5)).toBe("vezes");
    expect(reaisMilhoes(1007210666.63)).toBe(`R$ ${num(1007.21066663, 1)} milhões`);
    expect(reaisMilhoes(null)).toBe("sem dado");
  });

  it("situação diante do limite decidida em centésimos: igual ao limite não é transgressão", () => {
    expect(situacaoLimite({ dec: 8.000000000000002, fec: 1, dec_limite: 8, fec_limite: 2 })).toBe("dentro dos dois limites");
    expect(situacaoLimite({ dec: 8.01, fec: 1, dec_limite: 8, fec_limite: 2 })).toBe("acima do limite de DEC");
    expect(situacaoLimite({ dec: 9, fec: 3, dec_limite: 8, fec_limite: 2 })).toBe("acima dos dois limites");
    expect(situacaoLimite({ dec: null, fec: 3, dec_limite: 8, fec_limite: 2 })).toBe("sem valor anual ou sem limite");
  });

  it("cobertura nunca arredonda para 100% quando alguém ficou de fora", () => {
    expect(pctCobertura(0.9996)).toBe(`${num(99.96, 2)}%`);
    expect(pctCobertura(0.994)).toBe(`${num(99.4, 1)}%`);
    expect(pctCobertura(1)).toBe(`${num(100, 1)}%`);
    expect(pctCobertura(0.99999)).toBe(`${num(99.999, 3)}%`);
    expect(pctCobertura(null)).toBe("sem dado");
  });

  it("aviso de fonte defasada só com data de publicação da fonte e acima de 60 dias", () => {
    expect(avisoDefasagem("2026-09-05T05:27:08Z", "2026-10-01T00:20:33Z")).toBeNull();
    expect(avisoDefasagem(null, "2026-10-01T00:20:33Z")).toBeNull();
    const t = avisoDefasagem("2026-06-01T00:00:00Z", "2026-10-01T00:20:33Z");
    expect(t).toMatch(/01\/06\/2026, 122 dias antes/);
  });

  it("estado na URL: CNPJ e código IBGE válidos, medida e indicador do domínio; o resto volta ao padrão", () => {
    const esquema = { dist: CAMPO_DIST, mun: CAMPO_MUN, med: CAMPO_MEDIDA, ind: CAMPO_IND };
    const v = lerEstado(esquema, "?dist=06981180000116,abc,23664303000104&mun=3550308&med=fec_min&ind=fec");
    expect(v).toEqual({ dist: ["06981180000116", "23664303000104"], mun: "3550308", med: "fec_min", ind: "fec" });
    expect(lerEstado(esquema, "?mun=355030&med=media&ind=dic")).toEqual({ dist: [], mun: "", med: "dec_max", ind: "dec" });
    expect(destacar(["1", "2", "3", "4"], "5")).toEqual(["5", "1", "2", "3"]);
    expect(destacar(["1", "2"], "2")).toEqual(["2", "1"]);
  });

  it("CSV com aspas, ponto e vírgula dentro do campo e BOM", () => {
    expect(lerCsv('﻿a;b\r\n"x;y";"di ""z"""\r\n1;\n')).toEqual([
      { a: "x;y", b: 'di "z"' },
      { a: "1", b: "" },
    ]);
  });
});

describe("município escolhido no mapa: intervalo dos conjuntos, nunca DEC municipal", () => {
  const base: MunicipioQualidade = {
    cod: "1100023",
    nome: "Ariquemes",
    uf: "RO",
    conjuntos: ["17332", "17335"],
    relacao: "varios_conjuntos",
    dec_min: 6.13,
    dec_max: 34.37,
    fec_min: 2.98,
    fec_max: 8.31,
    cnpjs: ["05914650000166"],
  };
  it("cada relação tem a sua frase, com os números do município e sem média", () => {
    expect(respostaMunicipio(base, 2025)).toContain(`de ${num(6.13, 2)} a ${num(34.37, 2)} h`);
    expect(respostaMunicipio(base, 2025)).toMatch(/nenhuma média municipal/);
    expect(respostaMunicipio({ ...base, relacao: "conjunto_compartilhado", conjuntos: ["1"], dec_min: 7, dec_max: 7 }, 2025)).toMatch(/conjunto inteiro, não medidos só no município/);
    expect(respostaMunicipio({ ...base, relacao: "conjunto_exclusivo", conjuntos: ["1"], dec_min: 10.5, dec_max: 10.5 }, 2025)).toContain("10 h 30 min");
    expect(respostaMunicipio({ ...base, relacao: "sem_relacao_na_fonte", conjuntos: [], dec_min: null, dec_max: null }, 2025)).toMatch(/não aparece na base/);
    expect(respostaMunicipio({ ...base, relacao: "sem_conjunto_ativo", dec_min: null, dec_max: null }, 2025)).toMatch(/sem valor no mapa/);
  });
});

describe.skipIf(!disponivel)("respostas curtas derivadas dos números", () => {
  it("P051: DEC e FEC do ano, horas e minutos, concessionárias e acumulado sem mês incompleto", () => {
    const ref = gold.ano_referencia;
    const a = gold.brasil.anual.find((x) => x.ano === ref)!;
    const t = respostaP051(gold);
    expect(t).toContain(`${num(a.dec, 2)} horas sem energia (${horasEMinutos(a.dec)})`);
    expect(t).toContain(`${num(a.fec, 2)} interrupções`);
    if (a.dec_concessionarias !== null) expect(t).toContain(`${num(a.dec_concessionarias, 2)} h`);
    if (gold.parcial?.meses_excluidos.length) expect(t).toMatch(/fora, incompleto/);
    // mudar o número muda a frase e o sentido
    const g2 = copia();
    const a2 = g2.brasil.anual.find((x) => x.ano === ref)!;
    const ant = g2.brasil.anual.find((x) => x.ano === ref - 1)!;
    a2.dec = (ant.dec ?? 0) + 1.5;
    a2.fec = (ant.fec ?? 0) + 1;
    expect(respostaP051(g2)).toContain(`${num(a2.dec, 2)} horas`);
    expect(respostaP051(g2)).toMatch(/acima das/);
    a2.dec = null;
    expect(respostaP051(g2)).toMatch(/^Sem DEC e FEC nacionais/);
  });

  it("P052: contagem e fração acima do limite, peso em UCs, Brasil diante do limite e caudas", () => {
    const c = gold.conjuntos;
    const t = respostaP052(gold);
    expect(t).toContain(`${num(c.acima_limite_dec, 0)} dos ${num(c.com_limite, 0)} conjuntos`);
    expect(t).toContain(`${num(c.pct_ucs_acima_limite_dec, 1)}%`);
    expect(t).toContain(`${num(c.quantis_razao_dec.p90, 2)} ${vezes(c.quantis_razao_dec.p90!)}`);
    const g2 = copia();
    g2.conjuntos.acima_limite_dec = 1234;
    const a2 = g2.brasil.anual.find((x) => x.ano === g2.conjuntos.ano)!;
    a2.dec = (a2.dec_limite ?? 0) + 2;
    a2.razao_dec = 1.2;
    expect(respostaP052(g2)).toContain(`${num(1234, 0)} dos`);
    expect(respostaP052(g2)).toMatch(/acima do limite agregado/);
  });

  it("P053: total a unidades consumidoras, geradoras à parte e ausência explicada", () => {
    const a = gold.compensacoes.anual.find((x) => x.ano === gold.compensacoes.ano_referencia)!;
    const t = respostaP053(gold);
    expect(t).toContain(reaisMilhoes(a.valor_uc));
    if (a.valor_ug !== null) expect(t).toContain(reaisMilhoes(a.valor_ug, 2));
    const g2 = copia();
    g2.compensacoes.anual.find((x) => x.ano === g2.compensacoes.ano_referencia)!.valor_uc = null;
    expect(respostaP053(g2)).toMatch(/^Sem total de compensações/);
  });

  it("P054: taxas por exposição, IASC com entrevistas e TMAE; ano sem taxa usa o motivo, nunca zero", () => {
    const ref = gold.ano_referencia;
    const rec = gold.atendimento.reclamacoes_distribuidora.find((x) => x.ano === ref)!;
    const t = respostaP054(gold);
    expect(t).toContain(`${num(rec.por_ucs, 1)} reclamações por mil unidades consumidoras`);
    expect(t).toContain(`${num(gold.atendimento.iasc.entrevistas, 0)} entrevistas`);
    const g2 = copia();
    const r2 = g2.atendimento.reclamacoes_distribuidora.find((x) => x.ano === ref)!;
    r2.por_ucs = null;
    r2.motivo_ausencia = "ano parcial de teste";
    expect(respostaP054(g2)).toContain("sem taxa (ano parcial de teste)");
    expect(respostaP054(g2)).not.toMatch(/\b0,0 reclamações/);
  });

  it("o que mudou e atualidade: ano parcial nunca é comparado a ano cheio", () => {
    const parcialComp = gold.compensacoes.anual.find((x) => !x.completo);
    if (parcialComp) expect(mudancaP053(gold)).toMatch(/soma parcial que não se compara a um ano cheio/);
    const tmParcial = gold.atendimento.tmae.find((x) => !x.completo && x.tmae_min !== null);
    if (tmParcial) expect(mudancaP054(gold)).toContain(`${tmParcial.ano} tem só ${tmParcial.meses} meses`);
    const a = gold.brasil.anual.find((x) => x.ano === gold.ano_referencia)!;
    expect(mudancaP051(gold)).toContain(`${num(a.dec, 2)} h`);
    const t = textoAtualidade(gold);
    expect(t).toContain(`Ano completo mais recente: ${gold.ano_referencia}.`);
    for (const m of gold.brasil.mensal.filter((x) => !x.completo && x.m > gold.ultimo_mes_completo)) expect(t).toContain(`${["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][Number(m.m.slice(5)) - 1]}/${m.m.slice(0, 4)}`);
  });

  it("histórico de uma distribuidora: anos acima do limite contados na precisão publicada e quebra de perímetro", () => {
    const s = { anos: [2023, 2024, 2025], dec: [10, 8, null], fec: [1, 1, 1], dec_limite: [9, 8, 8], fec_limite: [2, 2, 2], quebras: [2024] };
    const t = respostaHistoricoDistribuidora("X", s, "dec");
    expect(t).toContain("acima do limite em 1 de 2 anos");
    expect(t).toMatch(/perímetro mudou em 2024/);
    expect(respostaHistoricoDistribuidora("X", undefined, "dec")).toMatch(/sem série/);
  });
});

/* ------------------------------------------------------------------ renderização no servidor */

describe.skipIf(!disponivel)("página renderizada no servidor", () => {
  const html = renderToStaticMarkup(createElement(QualidadePage));

  it("renderiza com os quatro painéis, na ordem, cada um com a pergunta como título", () => {
    let ultimo = -1;
    for (const id of ["p051", "p052", "p053", "p054"]) {
      const i = html.indexOf(`id="${id}"`);
      expect(i, id).toBeGreaterThan(ultimo);
      ultimo = i;
    }
    for (const q of [
      "Por quanto tempo e quantas vezes faltou luz?",
      "O serviço cumpriu o padrão?",
      "Quais compensações foram pagas?",
      "Como o consumidor é atendido e como a rede se recupera?",
    ]) {
      expect(html).toContain(q);
    }
  });

  it("respostas derivadas, recorte (período, universo, unidade) e tabelas equivalentes presentes", () => {
    for (const id of ["p051", "p052", "p053", "p054"]) expect(html, id).toContain(`data-resposta="${id}"`);
    // a frase do servidor é a mesma da função testada
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;").replace(/</g, "&lt;");
    for (const f of [respostaP051, respostaP052, respostaP053, respostaP054]) expect(html).toContain(esc(f(gold)).slice(0, 80));
    expect((html.match(/>Período</g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect((html.match(/>Universo</g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect((html.match(/>Unidade</g) ?? []).length).toBeGreaterThanOrEqual(4);
    // cada gráfico leva a sua tabela equivalente no HTML; as tabelas de análise abrem sob demanda
    // barras, pontos e histogramas já trazem a tabela no HTML; a das linhas monta ao abrir o resumo
    expect((html.match(/<table/g) ?? []).length).toBeGreaterThanOrEqual(10);
    expect((html.match(/Dados do gráfico em tabela/g) ?? []).length).toBeGreaterThanOrEqual(18);
    expect(html).toContain(`Abrir: Realizado, limite e DGC por distribuidora, ${gold.ano_referencia}`);
    expect(html).toContain("Compensações por ano: unidades consumidoras e geradoras");
    expect(html).toContain("Abrir: Indicadores nacionais de atendimento por ano");
    expect((html.match(/Abrir: /g) ?? []).length).toBe(TABELAS_SOB_DEMANDA.length);
    expect(html).toMatch(/Baixar CSV/);
  });

  it("provas, links compartilháveis, próxima pergunta e profundidade", () => {
    expect((html.match(/Comprove/g) ?? []).length).toBeGreaterThanOrEqual(10);
    expect((html.match(/Copiar link deste painel/g) ?? []).length).toBe(4);
    expect((html.match(/Próxima pergunta/g) ?? []).length).toBe(4);
    expect(html).toContain('data-nivel="analisar"');
    expect(html).toContain('data-nivel="auditar"');
    for (const h of ['href="#limites"', 'href="#compensacoes"', 'href="#atendimento"', 'href="/setor-eletrico/conta-de-luz"']) expect(html).toContain(h);
    expect(html).toContain('aria-current="page"');
  });

  it("estados honestos: sem 'em breve' nem travessão, ausência explicada, cores só por variável", () => {
    // o menu do cabeçalho marca outros módulos ainda sem números; o conteúdo da página não usa esses estados
    const conteudo = html.slice(html.indexOf("<main"));
    expect(conteudo).not.toMatch(/em breve|em integração|em construção/i);
    expect(html).not.toContain("—");
    const parcial = gold.atendimento.reclamacoes_distribuidora.find((x) => x.por_ucs === null && x.motivo_ausencia);
    if (parcial) expect(html).toContain("barra hachurada é ausência, não zero");
    for (const f of ["QualidadeMapa", "QualidadeComparador", "QualidadeLimites", "QualidadeConjuntos", "QualidadeLinkPainel", "QualidadeTabela"]) {
      expect(ler(`src/components/energia/${f}.tsx`), f).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(ler(`src/components/energia/${f}.tsx`), f).not.toContain("—");
    }
    const pagina = ler("src/app/setor-eletrico/qualidade/page.tsx");
    expect(pagina).not.toMatch(/#[0-9a-fA-F]{6}\b/);
    expect(pagina).toMatch(/export const dynamic = "force-static"/);
    expect(pagina).toMatch(/lerGold<QualidadeGold>\("qualidade\.json"\)/);
    expect(ler("src/lib/energia/qualidade.ts")).not.toContain("—");
  });

  it("regras com número vêm da gold: mês completo, início das parcelas e das concessionárias", () => {
    const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;").replace(/</g, "&lt;");
    expect(html).toContain(esc(gold.regras.mes_completo));
    expect(html).toContain(esc(gold.regras.mes_completo_compensacao));
    // nenhum ano nem percentual de regra escrito à mão no código da página e dos componentes do módulo
    for (const f of [
      "src/app/setor-eletrico/qualidade/page.tsx",
      "src/components/energia/QualidadeMapa.tsx",
      "src/components/energia/QualidadeComparador.tsx",
      "src/components/energia/QualidadeLimites.tsx",
      "src/components/energia/QualidadeConjuntos.tsx",
      "src/components/energia/QualidadeTabela.tsx",
    ]) {
      const codigo = ler(f)
        .split("\n")
        .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
        .join("\n");
      expect(codigo, f).not.toMatch(/\b(19|20)\d{2}\b/);
      expect(codigo, f).not.toMatch(/\b99 ?%/);
    }
    // a ligação sobre falta de energia é descrita como parte da taxa, sem dizer que a taxa "acompanha" as interrupções
    expect(html).not.toContain("a taxa acompanha as interrupções");
    // termo interno do processamento não aparece no texto da página
    const conteudo = html.slice(html.indexOf("<main"));
    expect(conteudo).not.toMatch(/\bgold\b/i);
  });

  it("peso do HTML do servidor abaixo da meta do contrato (600 KB)", () => {
    expect(Buffer.byteLength(html, "utf-8")).toBeLessThan(600_000);
  });
});

describe.skipIf(!disponivel)("componentes do módulo no servidor", () => {
  it("mapa: sem JavaScript, caixa de altura fixa com o motivo e a ação de carregar, nunca um mapa vazio", () => {
    const html = renderToStaticMarkup(
      createElement(QualidadeMapa, {
        ano: gold.mapa.ano,
        urlMunicipios: "/energia/series/qualidade_municipios.csv",
        urlSerie: "/energia/series/qualidade_distribuidoras_serie.json",
        distribuidoras: [],
        regra: gold.mapa.regra,
        totalMunicipios: gold.mapa.correspondencia.cadastro_ibge,
        fonte: "ANEEL",
        versao: "2025",
      }),
    );
    expect(html).toContain("Carregar o mapa agora");
    expect(html).toContain("Cor do mapa");
    if (gold.mapa.correspondencia.cadastro_ibge !== null) expect(html).toContain(gold.mapa.correspondencia.cadastro_ibge.toLocaleString("pt-BR"));
  });

  it("limites: pontos pareados e tabela equivalente das mesmas distribuidoras", () => {
    const html = renderToStaticMarkup(
      createElement(QualidadeLimites, {
        ano: gold.ano_referencia,
        itensDec: itensLimite(gold, "dec"),
        itensFec: itensLimite(gold, "fec"),
        classes: Object.fromEntries(gold.distribuidoras.map((d) => [d.cnpj, d.classificacao])),
        totalLinhas: gold.distribuidoras.length,
        urlSerie: "/energia/series/qualidade_distribuidoras_serie.json",
      }),
    );
    const conc = gold.distribuidoras.filter((d) => d.classificacao === "Concessionária").length;
    expect(html).toContain(`DEC apurado e limite anual por distribuidora, concessionárias, ${gold.ano_referencia}`);
    // o gráfico de pontos e a sua tabela equivalente têm as mesmas linhas: as concessionárias do ano
    expect(html).toContain(`Dados do gráfico em tabela (${conc.toLocaleString("pt-BR")} linhas)`);
    expect(html).toContain(`Abrir: Realizado, limite e DGC por distribuidora, ${gold.ano_referencia} (${gold.distribuidoras.length.toLocaleString("pt-BR")} linhas`);
    expect((html.match(/role="radiogroup"/g) ?? []).length).toBe(2);
  });

  it("comparador e explorador de conjuntos renderizam o estado de espera, com o padrão das maiores distribuidoras", () => {
    const entidades = gold.distribuidoras.map((d) => ({ id: d.cnpj, rotulo: d.sigla ?? d.cnpj }));
    const comp = renderToStaticMarkup(createElement(QualidadeComparador, { entidades, padrao: maioresDistribuidoras(gold), urlSerie: "/x.json" }));
    expect(comp).toContain("Carregando as séries anuais por distribuidora");
    const sigla = gold.distribuidoras.find((d) => d.cnpj === maioresDistribuidoras(gold)[0])!.sigla!;
    expect(comp).toContain(sigla);
    const cj = renderToStaticMarkup(createElement(QualidadeConjuntos, { anoInicial: 2001, anoFinal: gold.ano_referencia, tamanhos: {}, fonte: "ANEEL" }));
    expect(cj).toContain(`Carregar os conjuntos de ${gold.ano_referencia}`);
  });
});
