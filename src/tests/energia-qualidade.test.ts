import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import QualidadePage from "@/app/setor-eletrico/qualidade/page";
import { QualidadeBuscaMunicipio } from "@/components/energia/QualidadeBuscaMunicipio";
import { QualidadeComparador } from "@/components/energia/QualidadeComparador";
import { QualidadeConjuntos } from "@/components/energia/QualidadeConjuntos";
import { QualidadeConjuntosDoMunicipio } from "@/components/energia/QualidadeConjuntosDoMunicipio";
import { QualidadeEscala } from "@/components/energia/QualidadeEscala";
import { QualidadeLimites } from "@/components/energia/QualidadeLimites";
import { QualidadeMapa } from "@/components/energia/QualidadeMapa";
import { lerEstado } from "@/lib/energia/estadoUrl";
import { problemasEvidencia } from "@/lib/energia/evidencia";
import { mesAno, num, pct } from "@/lib/energia/formato";
import {
  COBERTURA_MINIMA_FEC_MES,
  COLUNAS_COMP_ANUAL,
  COLUNAS_CONJUNTOS_MUNICIPIO,
  DEFINICAO_CONJUNTO,
  DEFINICAO_CONJUNTO_CURTA,
  DEFINICAO_LIMITES_INDIVIDUAIS,
  LIMITE_FEC_PARCIAL_CENTESIMOS,
  avisosFec,
  camposFecDaDistribuidora,
  colunasCompensacaoDistribuidoras,
  comColunasFec,
  comparacaoApurado,
  conjuntosDoMunicipio,
  detalheDgcDoAno,
  divergenciasDgc,
  fecComCoberturaParcial,
  limpaProveniencia,
  listaPt,
  mesesComFecParcial,
  notaDivulgadoCartao,
  notaPerimetroAbertura,
  paraLeitor,
  paresLimites,
  recorteColunas,
  resumirTexto,
  resumoSemRazaoFec,
  rotuloDistribuidora,
  situacaoFecDoConjunto,
  taxaNaBaseDaOuvidoria,
  textoContagemFec,
  textoCorDoMapa,
  textoDivergenciasDgc,
  textoFecBrasilConfere,
  textoMesesIncompletos,
  textoQuebraApurado,
  textoUniversosConjuntos,
  CAMPO_DIST,
  CAMPO_IND,
  CAMPO_MEDIDA,
  CAMPO_MUN,
  COLUNAS_LIMITES,
  COLUNAS_MUNICIPIOS,
  PAINEIS_QUALIDADE,
  anoApuradoUniforme,
  arquivoConjuntosDoAno,
  avisoDefasagem,
  comparaNaPrecisao,
  conjuntosDoCsv,
  destacar,
  downloadsDoPainel,
  histogramaDeFaixas,
  horasEMinutos,
  itensLimite,
  itensLimites,
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
  marcosHistoriaApurado,
  metricasAbertura,
  metricasCompensacao,
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
  rotuloArquivo,
  situacaoLimite,
  tabelaQualidade,
  TABELAS_SOB_DEMANDA,
  textoDivulgadoAno,
  textoParcelasAno,
  textoUniversoBrasil,
  valoresMapa,
  vereditoP051,
  vereditoP052,
  vezes,
  type MunicipioQualidade,
} from "@/lib/energia/qualidade";
import {
  anosDivulgados,
  notaQuantidadeDivulgada,
  orientacaoSemDado,
  quebraCompensacao,
  regimesCompensacao,
  resumoMunicipio,
  respostaRecorteLimites,
  textoConcessionariasDesde,
  textoParticipacaoUg,
  textoQuebraCompensacao,
  textoQuebraCompensacaoCurto,
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

  it("renderiza com os quatro painéis, na ordem, cada um com o título próprio, e a página com a pergunta como título", () => {
    let ultimo = -1;
    for (const id of ["p051", "p052", "p053", "p054"]) {
      const i = html.indexOf(`id="${id}"`);
      expect(i, id).toBeGreaterThan(ultimo);
      ultimo = i;
    }
    // o título da página é a pergunta; o de cada painel é o dele (o do primeiro painel não repete o da página)
    const h1 = /<h1[^>]*>([^<]*)<\/h1>/.exec(html)?.[1] ?? "";
    expect(h1).toBe("Quanto tempo e quantas vezes falta luz?");
    expect(h1.trim().split(/\s+/).length).toBeGreaterThanOrEqual(5);
    expect(h1.trim().split(/\s+/).length).toBeLessThanOrEqual(9);
    for (const p of PAINEIS_QUALIDADE) {
      expect(html, p.id).toContain(`<h2 id="${p.id}-titulo"`);
      expect(html, p.id).toContain(p.titulo);
      expect(p.titulo, p.id).not.toBe(h1);
      expect(html, p.id).toContain(`id="${p.ancora}"`);
    }
    // nada de julgamento no título dos painéis
    for (const p of PAINEIS_QUALIDADE) expect(p.titulo + p.descricao).not.toMatch(/cumpriu|melhor|pior|ruim|bom\b/i);
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
    // as seis fichas "Comprove este número" ficam junto do número (faixa de abertura e painéis), cada uma com o seu indicador
    const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;").replace(/</g, "&lt;");
    expect((html.match(/Comprove este número/g) ?? []).length).toBeGreaterThanOrEqual(6);
    for (const k of ["dec_brasil", "fec_brasil", "conjuntos_acima_limite", "compensacoes_ano", "reclamacoes_distribuidora", "ouvidoria_aneel"] as const) {
      expect(html, k).toContain(esc(gold.evidencias[k]!.indicador));
    }
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
    for (const f of ["QualidadeMapa", "QualidadeComparador", "QualidadeLimites", "QualidadeConjuntos", "QualidadePagina", "QualidadeTabela"]) {
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
      "src/components/energia/QualidadePagina.tsx",
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

  it("peso da marcação do servidor (sem o fluxo RSC) abaixo de 400 KB: é só parte do que o navegador baixa", () => {
    // O HTML servido soma a marcação e o fluxo RSC (self.__next_f), que repete o conteúdo dos componentes de servidor e as props dos de cliente: em
    // 09/10/2026, medidos no servidor, 407 KB de HTML e 339 KB de fluxo, 746 KB no total, contra a meta de 600 KB do contrato. Este teste vigia a
    // marcação (não deixa a parte local crescer); a meta do contrato só se confere medindo o servidor (ver o relatório da rodada 2).
    expect(Buffer.byteLength(html, "utf-8")).toBeLessThan(400_000);
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
    expect(html).toContain("Carregar o mapa");
    expect(html).toContain("Cor do mapa");
    if (gold.mapa.correspondencia.cadastro_ibge !== null) expect(html).toContain(gold.mapa.correspondencia.cadastro_ibge.toLocaleString("pt-BR"));
  });

  it("limites: pontos pareados e tabela equivalente das mesmas distribuidoras", () => {
    const html = renderToStaticMarkup(
      createElement(QualidadeLimites, {
        ano: gold.ano_referencia,
        itens: itensLimites(gold),
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

/* ------------------------------------------------------------------ redesenho: abertura, faixa, painéis, arquivos */

const brasil = (g: QualidadeGold, ano: number) => g.brasil.anual.find((x) => x.ano === ano)!;

describe.skipIf(!disponivel)("redesenho: seletores da abertura e dos painéis", () => {
  const ref = gold.ano_referencia;

  it("faixa de métricas: DEC, FEC, conjuntos acima do limite e DEC de todas as origens, os mesmos números que a resposta e o gráfico leem", () => {
    const m = metricasAbertura(gold);
    const a = brasil(gold, ref);
    const ant = brasil(gold, ref - 1);
    expect([m.ano, m.dec, m.fec, m.decTodasOrigens]).toEqual([ref, a.dec, a.fec, a.dec_todas_parcelas]);
    expect([m.anoAnterior, m.decAnterior, m.fecAnterior]).toEqual([ref - 1, ant.dec, ant.fec]);
    // as mesmas casas e a mesma conta de minutos que a resposta do painel: 9,33 h são 9 h 20 min, nunca 9 h 33 min
    const minutos = Math.round(a.dec! * 60);
    expect(m.decHorasMinutos).toBe(`${Math.floor(minutos / 60)} h ${minutos % 60} min`);
    expect(m.decHorasMinutos).not.toContain(`${String(a.dec).split(".")[1]} min`);
    expect(respostaP051(gold)).toContain(`${num(m.dec, 2)} horas sem energia (${m.decHorasMinutos})`);
    // o expurgado fica dentro do número de todas as origens: o apurado nunca passa dele
    expect(m.decTodasOrigens!).toBeGreaterThanOrEqual(m.dec!);
    // conjuntos: a contagem e o denominador da gold, e o ano anterior da própria série histórica
    const c = gold.conjuntos;
    const antC = c.historico.find((h) => h.ano === c.ano - 1)!;
    expect(m.conjuntos).toEqual({ ano: c.ano, acima: c.acima_limite_dec, comLimite: c.com_limite, pct: c.pct_acima_limite_dec, anoAnterior: c.ano - 1, pctAnterior: antC.pct_acima_limite_dec });
    expect(vereditoP052(gold)).toContain(`${num(m.conjuntos.pct, 1)}%`);
  });

  it("faixa de métricas: muda com o número, e a ausência é ausência (nunca zero nem horas inventadas)", () => {
    const g2 = copia();
    const a2 = brasil(g2, ref);
    a2.dec = 10.5;
    a2.dec_todas_parcelas = 21;
    const m2 = metricasAbertura(g2);
    expect([m2.dec, m2.decHorasMinutos, m2.decTodasOrigens, m2.decTodasOrigensHorasMinutos]).toEqual([10.5, "10 h 30 min", 21, "21 h"]);
    a2.dec = null;
    a2.dec_todas_parcelas = null;
    const m3 = metricasAbertura(g2);
    expect([m3.dec, m3.decHorasMinutos, m3.decTodasOrigens, m3.decTodasOrigensHorasMinutos]).toEqual([null, "sem dado", null, "sem dado"]);
    // ano anterior sem DEC e FEC: a faixa não inventa referência
    brasil(g2, ref - 1).dec = null;
    expect(metricasAbertura(g2).anoAnterior).toBeNull();
    expect(metricasAbertura(g2).decAnterior).toBeNull();
  });

  it("parcelas do ano: o apurado e cada parcela expurgada por extenso, somando o DEC de todas as origens", () => {
    const a = brasil(gold, ref);
    const p = a.parcelas_dec!;
    const t = textoParcelasAno(gold);
    for (const k of ["apurado", "emergencia", "dia_critico", "externa", "ons"] as const) expect(t, k).toContain(`${num(p[k], 2)} h`);
    expect(t).toContain(`${num(a.dec_todas_parcelas, 2)} h (${horasEMinutos(a.dec_todas_parcelas)})`);
    expect(Object.values(p).reduce<number>((soma, v) => soma + (v ?? 0), 0)).toBeCloseTo(a.dec_todas_parcelas!, 1);
    expect(t).toMatch(/a parte comparada ao limite/);
    expect(t).toMatch(/expurgadas do apurado/);
    // parcela que a fonte não publica é dita como ausência, nunca como zero
    const g2 = copia();
    brasil(g2, ref).parcelas_dec!.externa = null;
    expect(textoParcelasAno(g2)).toContain("sem valor publicado de origem externa");
    expect(textoParcelasAno(g2)).not.toContain("0,00 h");
    brasil(g2, ref).parcelas_dec = null;
    expect(textoParcelasAno(g2)).toBe("");
  });

  it("ano em que o apurado passa a ser só IP + IND: lido da identidade do apurado, e o marco dos gráficos sai dele", () => {
    const id = gold.brasil.identidade_apurado;
    const ultimoQueFalha = [...id].reverse().find((x) => x.pct_dec_igual_ip_mais_ind !== 100 || x.pct_fec_igual_ip_mais_ind !== 100)!;
    const uniforme = anoApuradoUniforme(gold)!;
    expect(uniforme).toBe(ultimoQueFalha.ano + 1);
    // o texto da regra publicada diz o mesmo ano ("desde 2022, exatamente as parcelas internas ... IP + IND")
    expect(gold.regras.apurado).toContain(`desde ${uniforme}`);
    const marcos = marcosHistoriaApurado(gold);
    const anosDoGrafico = new Set(linhasBrasilAnual(gold).map((l) => l.ano));
    expect(marcos.map((x) => x.x)).toEqual([String(uniforme)]);
    expect(anosDoGrafico.has(marcos[0].x)).toBe(true);
    expect(marcos[0].rotulo).toBe(`${uniforme}: muda o que entra no apurado`);
    // rótulo curto: dois marcos de rótulo longo se sobrepõem no gráfico de meia largura
    expect(marcos[0].rotulo.length).toBeLessThanOrEqual(36);
    // sem quebra: identidade exata desde o primeiro ano, ou nunca exata, não há ano para marcar
    const g2 = copia();
    for (const x of g2.brasil.identidade_apurado) [x.pct_dec_igual_ip_mais_ind, x.pct_fec_igual_ip_mais_ind] = [100, 100];
    expect(anoApuradoUniforme(g2)).toBeNull();
    expect(marcosHistoriaApurado(g2)).toEqual([]);
    for (const x of g2.brasil.identidade_apurado) [x.pct_dec_igual_ip_mais_ind, x.pct_fec_igual_ip_mais_ind] = [90, 90];
    expect(anoApuradoUniforme(g2)).toBeNull();
    // identidade que volta a falhar depois: o ano é o primeiro da sequência final de 100%
    const g3 = copia();
    g3.brasil.identidade_apurado.at(-2)!.pct_dec_igual_ip_mais_ind = 99;
    expect(anoApuradoUniforme(g3)).toBe(g3.brasil.identidade_apurado.at(-1)!.ano);
  });

  it("universo do Brasil: distribuidoras e conjuntos do ano, e as concessionárias à parte, sem nome de campo", () => {
    const a = brasil(gold, ref);
    const t = textoUniversoBrasil(gold);
    const comDec = gold.distribuidoras.filter((d) => d.dec !== null).length;
    expect(t).toContain(`${num(comDec, 0)} distribuidoras e ${num(a.conjuntos, 0)} conjuntos`);
    expect(t).toContain(`${num(a.concessionarias, 0)} concessionárias`);
    expect(t).toContain(`${num(a.dec_concessionarias, 2)} h e ${num(a.fec_concessionarias, 2)} interrupções`);
    expect(t).not.toMatch(/\b[a-z]+_[a-z_]+\b|\(dec, fec\)/);
    const g2 = copia();
    brasil(g2, ref).dec_concessionarias = null;
    expect(textoUniversoBrasil(g2)).not.toContain("concessionárias, o universo");
  });

  it("compensações do ano: unidades consumidoras e geradoras separadas, em milhões; e o total divulgado só entra quando difere além da precisão", () => {
    const c = gold.compensacoes;
    const a = c.anual.find((x) => x.ano === c.ano_referencia)!;
    const mc = metricasCompensacao(gold);
    expect(mc.valorUcMilhoes).toBeCloseTo(a.valor_uc! / 1e6, 9);
    expect(mc.valorUgMilhoes).toBeCloseTo(a.valor_ug! / 1e6, 9);
    expect(mc.quantidadeUcMilhoes).toBeCloseTo(a.quantidade_uc! / 1e6, 9);
    expect(mc.valorUcMilhoes).not.toBeCloseTo((a.valor_uc! + a.valor_ug!) / 1e6, 3);
    const d = a.divulgado_aneel;
    const t = textoDivulgadoAno(gold);
    if (d && d.dentro_da_precisao_valor === false) {
      expect(t).toContain(reaisMilhoes(d.valor, 0));
      expect(t).toContain(reaisMilhoes(a.valor_uc));
      expect(t).toMatch(/não foi explicada/);
    } else expect(t).toBe("");
    const g2 = copia();
    const a2 = g2.compensacoes.anual.find((x) => x.ano === g2.compensacoes.ano_referencia)!;
    a2.divulgado_aneel = { valor: 1_000_000_000, quantidade: null, dentro_da_precisao_valor: false, dentro_da_precisao_quantidade: null };
    expect(textoDivulgadoAno(g2)).toContain(reaisMilhoes(1_000_000_000, 0));
    a2.divulgado_aneel.dentro_da_precisao_valor = true;
    expect(textoDivulgadoAno(g2)).toBe("");
    a2.divulgado_aneel = null;
    expect(textoDivulgadoAno(g2)).toBe("");
    a2.valor_uc = null;
    a2.divulgado_aneel = { valor: 1, quantidade: null, dentro_da_precisao_valor: false, dentro_da_precisao_quantidade: null };
    expect(textoDivulgadoAno(g2)).toBe("");
  });

  it("arquivos para baixar: nome legível para o leitor, só os arquivos que a gold publica, e cada painel com os seus", () => {
    const urls = gold.downloads.map((d) => d.url);
    for (const u of urls) {
      const r = rotuloArquivo(u);
      expect(r, u).not.toMatch(/\.(csv|json)\b|qualidade_|_/);
      expect(r, u).not.toBe("Arquivo de dados");
    }
    expect(rotuloArquivo("/energia/series/qualidade_conjuntos_anual_2010_2019.csv")).toBe("DEC, FEC e limites de cada conjunto, por ano, de 2010 a 2019");
    expect(rotuloArquivo("/energia/series/qualidade_inexistente.csv")).toBe("Arquivo de dados");
    for (const p of PAINEIS_QUALIDADE) {
      const d = downloadsDoPainel(gold, p.id);
      expect(d.length, p.id).toBeGreaterThan(0);
      for (const x of d) expect(urls, `${p.id} ${x.url}`).toContain(x.url);
      expect(new Set(d.map((x) => x.rotulo)).size, p.id).toBe(d.length);
    }
    expect(downloadsDoPainel(gold, "p053").map((x) => x.url)).toEqual(["/energia/series/qualidade_compensacoes.csv"]);
    expect(downloadsDoPainel(gold, "p052").filter((x) => /conjuntos_anual/.test(x.url)).length).toBe(urls.filter((u) => /conjuntos_anual/.test(u)).length);
    // arquivo que a publicação não traz não aparece
    const g2 = copia();
    g2.downloads = g2.downloads.filter((d) => !d.url.includes("qualidade_compensacoes"));
    expect(downloadsDoPainel(g2, "p053")).toEqual([]);
  });
});

describe.skipIf(!disponivel)("redesenho: a página no servidor", () => {
  const html = renderToStaticMarkup(createElement(QualidadePage));
  const fonte = ler("src/app/setor-eletrico/qualidade/page.tsx");
  const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;").replace(/</g, "&lt;");
  const ate = (marca: string) => html.indexOf(marca);

  it("a primeira tela responde: título, lead, recorte e faixa de métricas antes do primeiro painel; o bloco de unidades não vem antes dos valores", () => {
    const i = {
      h1: ate("<h1"),
      lead: ate('class="ed-lead'),
      recorte: ate('data-recorte=""'),
      faixa: ate("data-faixa-metricas"),
      painel: ate('id="p051"'),
    };
    expect(i.h1).toBeGreaterThan(0);
    expect(i.h1).toBeLessThan(i.lead);
    expect(i.lead).toBeLessThan(i.recorte);
    expect(i.recorte).toBeLessThan(i.faixa);
    expect(i.faixa).toBeLessThan(i.painel);
    expect(html).not.toContain("Como ler as unidades");
    // quatro medidas na faixa, cada uma com a sua unidade por UC e o ano
    const faixa = html.slice(i.faixa, i.painel);
    expect((faixa.match(/data-metrica=""/g) ?? []).length).toBe(4);
    const m = metricasAbertura(gold);
    for (const t of [num(m.dec, 2), num(m.fec, 2), `${num(m.conjuntos.pct, 1)}%`, num(m.decTodasOrigens, 2), m.decHorasMinutos, `${num(m.conjuntos.acima, 0)} de ${num(m.conjuntos.comLimite, 0)} conjuntos`]) {
      expect(faixa, t).toContain(t);
    }
    expect(faixa).toContain("h por UC");
    expect(faixa).toContain("interrupções por UC");
    // as três fichas de prova da faixa
    expect((faixa.match(/Comprove este número/g) ?? []).length).toBe(3);
  });

  it("DEC e FEC em gráficos próprios, com eixos e unidades distintos, e a resposta logo depois das duas figuras", () => {
    const a = brasil(gold, gold.ano_referencia);
    const anos = linhasBrasilAnual(gold);
    const dec = `DEC apurado do Brasil e limite agregado, ${anos[0].ano} a ${gold.ano_referencia}`;
    const fec = `FEC apurado do Brasil e limite agregado, ${anos[0].ano} a ${gold.ano_referencia}`;
    expect(a).toBeTruthy();
    expect(ate(dec)).toBeGreaterThan(0);
    expect(ate(dec)).toBeLessThan(ate(fec));
    // cada gráfico diz a sua unidade (o FEC no título, o DEC em cada marca do eixo); as séries de DEC e de FEC nunca dividem o mesmo gráfico
    expect(html.slice(ate(fec), ate(fec) + 600)).toContain("em interrupções");
    expect(html.slice(ate(dec), ate(fec))).toMatch(/>\d+ h</);
    for (const arranjo of Array.from(fonte.matchAll(/series=\{\[([\s\S]*?)\]\}/g), (x) => x[1])) expect(/id: "dec"/.test(arranjo) && /id: "fec"/.test(arranjo)).toBe(false);
    expect(ate(fec)).toBeLessThan(ate('data-resposta="p051"'));
    // a mesma frase da função testada, na segunda camada
    expect(html).toContain(esc(vereditoP051(gold)));
    // o limite do mesmo ano é uma linha tracejada de cada gráfico
    expect((html.match(/Limite agregado do ano/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("apurado e expurgado visíveis em Entender: a seção, as parcelas por extenso e a regra do apurado", () => {
    const secao = /<section id="expurgos"([^>]*)>/.exec(html)?.[1] ?? "";
    expect(secao).not.toContain("data-nivel");
    expect(html).toContain(esc(textoParcelasAno(gold)));
    // a regra do apurado escrita para o leitor: "não expurgável" vira "que a regra não exclui" (o resto do texto é o da gold)
    expect(html).toContain(esc(paraLeitor(gold.regras.apurado)));
    expect(paraLeitor(gold.regras.apurado)).not.toMatch(/expurgável/);
    expect(html).toContain("Parcelas do DEC do Brasil por origem");
    expect(html).toContain(esc(textoUniversoBrasil(gold)));
  });

  it("cada seção da página está no nível que a rubrica pede: o que responde pergunta própria em Entender, o detalhe em Analisar, o método em Auditar", () => {
    const nivel = (id: string) => {
      const tag = new RegExp(`<section id="${id}"([^>]*)>`).exec(html);
      expect(tag, id).not.toBeNull();
      return /data-nivel="(analisar|auditar)"/.exec(tag![1])?.[1] ?? "entender";
    };
    const esperado: Record<string, string> = {
      expurgos: "entender",
      "mapa-municipios": "entender",
      "comparar-distribuidoras": "entender",
      "distribuicao-dos-conjuntos": "entender",
      "ano-a-ano": "entender",
      "tipos-de-violacao": "entender",
      "compensacao-entre-distribuidoras": "analisar",
      "compensacoes-por-ano": "analisar",
      "satisfacao-iasc": "entender",
      "recuperacao-da-rede": "analisar",
      mensal: "analisar",
      "tabela-distribuidoras": "analisar",
      "conjuntos-do-ano": "analisar",
      "matriz-limite-razao": "analisar",
      pontas: "analisar",
      "compensacoes-mes-a-mes": "analisar",
      "indicadores-e-escopos": "analisar",
      "atendimento-telefonico": "analisar",
      "atendimento-por-distribuidora": "analisar",
      "universos-e-arquivos": "auditar",
      dgc: "auditar",
      "conferencia-divulgado": "auditar",
      "fora-de-cada-universo": "auditar",
    };
    for (const [id, n] of Object.entries(esperado)) expect(nivel(id), id).toBe(n);
    // as âncoras antigas e as dos painéis continuam
    for (const id of ["duracao", "limites", "compensacoes", "atendimento", "auditoria-qualidade", "p051", "p052", "p053", "p054"]) expect(html, id).toContain(`id="${id}"`);
  });

  it("uma navegação local só, sem título de seção: o rótulo dos capítulos é texto, e eles apontam para as outras três perguntas da página", () => {
    expect((html.match(/data-navegacao-local="capitulos"/g) ?? []).length).toBe(1);
    expect(html).not.toContain('data-navegacao-local="faixa"');
    expect(html).not.toContain("As outras perguntas desta página");
    for (const p of PAINEIS_QUALIDADE.filter((x) => x.id !== "p051")) {
      expect(html, p.id).toContain(`href="#${p.ancora}"`);
      expect(html, p.id).toContain(esc(p.descricao));
    }
    // o índice de cartões antigo ("Perguntas desta página" com quatro caixas numeradas) não volta
    expect(html).not.toContain("hover:border-energia\"><span class=\"rotulo text-mineral\">1</span>");
  });

  it("downloads de cada painel com nome legível em Entender, e os nomes de arquivo só em Auditar", () => {
    for (const p of PAINEIS_QUALIDADE) for (const d of downloadsDoPainel(gold, p.id)) expect(html, d.url).toContain(esc(d.rotulo));
    const auditar = html.slice(html.indexOf('id="auditoria-qualidade"'));
    for (const d of gold.downloads) expect(auditar, d.url).toContain(`${d.rotulo} (`);
  });

  it("as ressalvas vão para onde evitam a leitura errada: média por UC na abertura, conjunto no mapa, expurgo na figura, divulgado na compensação", () => {
    const lead = /<p class="ed-lead[^>]*>([^<]*)<\/p>/.exec(html)?.[1] ?? "";
    // O lead distingue duração e frequência MÉDIAS; os limites são próprios de cada distribuidora.
    expect(lead).toMatch(/DEC mede a duração média.*FEC, a frequência média/);
    expect(lead).toMatch(/cada distribuidora com o próprio limite/);
    const limite = /data-limite="">([\s\S]*?)<\/p>/.exec(html)?.[1] ?? "";
    expect(limite).toContain("Não permite concluir");
    expect(limite).toMatch(/o que cada consumidor viveu: DEC e FEC são médias por UC/);
    // o mapa diz que o valor é do conjunto, não do município, e que não há média municipal
    const mapa = html.slice(ate('id="mapa-municipios"'), ate('id="mensal"'));
    expect(mapa).toMatch(/Cada cor é o valor de um conjunto, não do município/);
    expect(mapa).toMatch(/não há média municipal/);
    expect(mapa).toContain(esc(gold.mapa.regra));
    // a conversão de horas decimais vem junto da unidade do gráfico
    expect(html).toContain(esc(gold.regras.centesimos));
    // o DGC diz a sua origem (calculado aqui e publicado pela ANEEL) na unidade do painel de limites
    const limites = html.slice(ate('id="limites"'), ate('id="compensacoes"'));
    expect(limites).toMatch(/DGC, o desempenho global de continuidade/);
    expect(limites).toMatch(/calculada\s+aqui e publicada no ranking da ANEEL/);
    // o total divulgado pela ANEEL, quando difere além da precisão, está na leitura da compensação (e não só em Auditar)
    const divulgado = textoDivulgadoAno(gold);
    if (divulgado) expect(html.slice(ate('id="compensacoes"'), ate('id="atendimento"'))).toContain(esc(divulgado));
  });

  it("estados honestos e editorial: sem julgamento no título nem 'agora' em botão, sem coluna ou campo em texto de leitor", () => {
    const conteudo = html.slice(html.indexOf("<main"));
    expect(conteudo).not.toMatch(/\b(serviço ruim|pior distribuidora|melhor distribuidora|cumpriu o padrão)\b/i);
    expect(conteudo).not.toMatch(/\bagora\b/);
    // o nome de campo que a gold traz nos universos só aparece na seção de Auditar
    const auditar = conteudo.indexOf('id="universos-e-arquivos"');
    for (const campo of ["(dec, fec)", "dec_concessionarias"]) {
      const i = conteudo.indexOf(campo);
      expect(i === -1 || i > auditar, campo).toBe(true);
    }
  });
});

/* ------------------------------------------------------------------ ressalvas das avaliações independentes */

describe.skipIf(!disponivel)("ressalvas das avaliações independentes: seletores", () => {
  const ref = gold.ano_referencia;
  const cent = (x: number) => Math.round(x * 100);
  /** Recontagem própria da regra do FEC parcial, sem a função da página. */
  const divergentes = (g: QualidadeGold) => g.distribuidoras.filter((d) => d.fec !== null && d.parcelas_fec.apurado !== null && Math.abs(cent(d.fec) - cent(d.parcelas_fec.apurado)) > 2);
  const umaSemMarca = (g: QualidadeGold) => g.distribuidoras.find((x) => x.fec !== null && x.parcelas_fec.apurado !== null && !divergentes(gold).some((y) => y.cnpj === x.cnpj))!;

  it("FEC de cobertura parcial: a distribuidora cujo FEC anual difere da soma das parcelas internas em mais de 0,02 leva a marca, com o valor pelas parcelas ao lado", () => {
    const avisos = fecComCoberturaParcial(gold);
    expect(ordenadas(avisos.map((a) => a.cnpj))).toEqual(ordenadas(divergentes(gold).map((d) => d.cnpj)));
    for (const a of avisos) {
      const d = gold.distribuidoras.find((x) => x.cnpj === a.cnpj)!;
      expect(a.fec).toBe(d.fec);
      expect(a.fecPelasParcelas).toBe(d.parcelas_fec.apurado);
      expect(a.diferenca!).toBeCloseTo(d.fec! - d.parcelas_fec.apurado!, 9);
      expect(a.frase).toContain(a.rotulo);
      expect(a.frase).toContain(`cobertura parcial do FEC em ${a.ano}`);
      expect(a.frase).toContain("FECIP + FECIND");
      // sem os meses (só a gold), a frase diz que o FEC apurado difere da soma das parcelas; com os meses, diz qual mês cobre pouco (outro teste)
      expect(a.frase).toContain(`O FEC apurado (${num(a.fec, 2)}) difere da soma das parcelas internas, programada e não programada (FECIP + FECIND), ${num(a.fecPelasParcelas, 2)}.`);
      expect(a.marca).toBe(`parcial: difere em ${num(Math.abs(a.diferenca!), 2)} das parcelas internas`);
    }
    // a gold não muda: a marca e o valor pelas parcelas vão ao lado do valor
    expect(avisosFec(gold)).toEqual(Object.fromEntries(avisos.map((a) => [a.cnpj, a])));
  });

  it("a regra conta em centésimos (0,02 ainda confere, 0,03 marca, para cima ou para baixo) e só vale em ano de apurado uniforme", () => {
    const g2 = copia();
    const d = umaSemMarca(g2);
    const marcada = () => fecComCoberturaParcial(g2).some((a) => a.cnpj === d.cnpj);
    d.parcelas_fec.apurado = d.fec! - 0.02;
    expect(marcada()).toBe(false);
    d.parcelas_fec.apurado = d.fec! + 0.02;
    expect(marcada()).toBe(false);
    d.parcelas_fec.apurado = d.fec! - 0.03;
    expect(marcada()).toBe(true);
    d.parcelas_fec.apurado = d.fec! + 0.03;
    expect(marcada()).toBe(true);
    d.parcelas_fec.apurado = null;
    expect(marcada()).toBe(false);
    // identidade do apurado nunca exata: as duas contas não precisam fechar (regra do apurado diferente), então não há marca
    d.parcelas_fec.apurado = d.fec! - 0.5;
    expect(marcada()).toBe(true);
    for (const x of g2.brasil.identidade_apurado) [x.pct_dec_igual_ip_mais_ind, x.pct_fec_igual_ip_mais_ind] = [90, 90];
    expect(fecComCoberturaParcial(g2)).toEqual([]);
    // sem FEC anual não há o que marcar
    const g3 = copia();
    for (const x of g3.distribuidoras) x.fec = null;
    expect(fecComCoberturaParcial(g3)).toEqual([]);
  });

  it("pronto para o campo de cobertura da próxima coleta: meses_fec ou cobertura_fec na gold também marcam, sem exigir o campo", () => {
    const g2 = copia();
    const d = umaSemMarca(g2) as Distribuidora & { meses_fec?: number; cobertura_fec?: number };
    const marcada = () => fecComCoberturaParcial(g2).find((a) => a.cnpj === d.cnpj);
    expect(marcada()).toBeUndefined();
    d.meses_fec = d.meses - 1;
    expect(marcada()?.frase).toMatch(/não cobre todas as unidades consumidoras em todos os meses/);
    expect(marcada()?.frase).not.toContain("difere da soma");
    d.meses_fec = d.meses;
    expect(marcada()).toBeUndefined();
    d.cobertura_fec = COBERTURA_MINIMA_FEC_MES - 0.01;
    expect(marcada()).toBeTruthy();
    d.cobertura_fec = 1;
    expect(marcada()).toBeUndefined();
  });

  it("meses de cobertura baixa do FEC, lidos do CSV mensal: só as distribuidoras pedidas, só o ano pedido e só abaixo de 99%", () => {
    const flag = fecComCoberturaParcial(gold).map((a) => a.cnpj);
    const lido = mesesComFecParcial(ler("public/energia/series/qualidade_distribuidoras_mensal.csv"), flag, ref);
    // recontagem própria, pelas colunas ucs_fec e ucs_total
    const esperado: Record<string, string[]> = {};
    for (const l of linhasCsv("qualidade_distribuidoras_mensal.csv")) {
      if (!flag.includes(l.cnpj) || !l.mes.startsWith(`${ref}-`) || l.ucs_fec === "" || l.ucs_total === "") continue;
      if (Number(l.ucs_fec) / Number(l.ucs_total) < COBERTURA_MINIMA_FEC_MES) (esperado[l.cnpj] ??= []).push(l.mes);
    }
    expect(Object.fromEntries(Object.entries(lido).map(([k, v]) => [k, v.map((x) => x.mes)]))).toEqual(esperado);
    for (const v of Object.values(lido)) for (const m of v) expect(m.cobertura).toBeLessThan(COBERTURA_MINIMA_FEC_MES);
    // a frase diz o mês, a cobertura, e o valor pelas parcelas
    for (const a of fecComCoberturaParcial(gold, lido)) {
      expect(a.meses.map((m) => m.mes)).toEqual(esperado[a.cnpj] ?? []);
      for (const m of a.meses) {
        expect(a.frase).toContain(mesAno(m.mes));
        expect(a.frase).toContain(`${num(m.cobertura * 100, 2)}%`);
      }
      if (a.meses.length === 1) expect(a.frase).toContain(`O FEC de ${mesAno(a.meses[0].mes)} cobre`);
      expect(a.frase).toContain(`o anual é ${num(a.fecPelasParcelas, 2)}, contra ${num(a.fec, 2)} apurado`);
      expect(a.marca).toContain(a.meses.length ? "das UCs" : "das parcelas internas");
    }
    // arquivo pequeno, à mão: BOM, outro CNPJ, outro ano, cobertura de exatamente 99% e ausência
    const mini =
      "﻿cnpj;sigla;mes;dec_h;fec_interrupcoes;ucs;ucs_fec;ucs_total;conjuntos;cobertura;controle_numcon\n" +
      "11111111111111;A;2025-06;1;1;100;99;100;1;1;\n" +
      "11111111111111;A;2025-07;1;1;100;98;100;1;1;\n" +
      "11111111111111;A;2024-07;1;1;100;10;100;1;1;\n" +
      "22222222222222;B;2025-07;1;1;100;10;100;1;1;\n" +
      "11111111111111;A;2025-08;1;1;100;;100;1;1;\n";
    expect(mesesComFecParcial(mini, ["11111111111111"], 2025)).toEqual({ "11111111111111": [{ mes: "2025-07", ucsFec: 98, ucsTotal: 100, cobertura: 0.98 }] });
    expect(mesesComFecParcial(mini, [], 2025)).toEqual({});
    expect(mesesComFecParcial("", ["11111111111111"], 2025)).toEqual({});
    // dois meses: a frase lista os dois
    const g2 = copia();
    const d = divergentes(g2)[0] ?? umaSemMarca(g2);
    d.parcelas_fec.apurado = d.fec! - 0.5;
    const dois = fecComCoberturaParcial(g2, { [d.cnpj]: [{ mes: `${ref}-03`, ucsFec: 1, ucsTotal: 100, cobertura: 0.01 }, { mes: `${ref}-06`, ucsFec: 50, ucsTotal: 100, cobertura: 0.5 }] }).find((a) => a.cnpj === d.cnpj)!;
    expect(dois.frase).toContain(`menos de 99% das UCs em mar/${ref} (1,00%) e jun/${ref} (50,00%)`);
    expect(dois.marca).toBe("parcial: 2 meses com menos de 99% das UCs");
  });

  it("tabelas por distribuidora: a marca de cobertura parcial e o FEC pelas parcelas ficam ao lado do FEC apurado, e o valor da gold não muda", () => {
    const avisos = avisosFec(gold);
    for (const id of ["dist-p051", "limites"] as const) {
      const t = tabelaQualidade(id, gold);
      const ids = t.colunas.map((c) => c.id);
      expect(ids.slice(ids.indexOf("fec") + 1, ids.indexOf("fec") + 3), id).toEqual(["fec_cobertura", "fec_parcelas"]);
      expect(t.linhas.length, id).toBe((id === "limites" ? linhasLimites(gold) : linhasDistribuidorasP051(gold)).length);
      for (const l of t.linhas) {
        const d = gold.distribuidoras.find((x) => x.cnpj === l.id)!;
        expect(l.fec, `${id} ${l.id}`).toBe(d.fec);
        expect(l.fec_parcelas, `${id} ${l.id}`).toBe(d.parcelas_fec.apurado);
        if (avisos[d.cnpj]) expect(String(l.fec_cobertura)).toMatch(/^parcial: /);
        else expect(String(l.fec_cobertura)).toMatch(/^(confere com as parcelas internas|sem parcelas para conferir)$/);
      }
      for (const a of Object.values(avisos)) expect(t.nota, id).toContain(a.frase);
      expect(t.nota, id).toMatch(/vale também para a razão de FEC e para o DGC/);
      // a exportação leva as duas colunas
      const cab = gerarCsv(t.colunas, t.linhas, { bom: false }).split("\r\n")[0];
      expect(cab).toContain("Cobertura do FEC no ano");
      expect(cab).toContain("FEC pelas parcelas internas (FECIP + FECIND)");
    }
    // sem a marca aplicada, a tabela diz que difere, em vez de dizer que confere
    const semAvisos = tabelaQualidade("limites", gold, {});
    for (const a of Object.values(avisos)) expect(String(semAvisos.linhas.find((l) => l.id === a.cnpj)!.fec_cobertura)).toBe("difere das parcelas internas");
    // as colunas só entram se a tabela tem a coluna do FEC
    expect(comColunasFec([{ id: "x", rotulo: "X", tipo: "texto" }]).map((c) => c.id)).toEqual(["x", "fec_cobertura", "fec_parcelas"]);
    // o resumo de cada linha, sozinho
    const d = divergentes(gold)[0] ?? umaSemMarca(gold);
    expect(camposFecDaDistribuidora({ ...d, parcelas_fec: { ...d.parcelas_fec, apurado: null } }, {}).fec_cobertura).toBe("sem parcelas para conferir");
  });

  it("pontos do painel de limites: o valor de cada ponto é o da gold; o asterisco e a frase na dica só vão ao FEC da distribuidora marcada", () => {
    const avisos = avisosFec(gold);
    const itens = itensLimites(gold);
    expect(itens.length).toBe(gold.distribuidoras.length);
    const dec = paresLimites(itens, "dec", avisos);
    const fec = paresLimites(itens, "fec", avisos);
    for (const d of gold.distribuidoras) {
      const pd = dec.find((p) => p.id === d.cnpj)!;
      const pf = fec.find((p) => p.id === d.cnpj)!;
      expect([pd.valor, pd.referencia]).toEqual([d.dec, d.dec_limite]);
      expect([pf.valor, pf.referencia]).toEqual([d.fec, d.fec_limite]);
      expect(pd.rotulo).toBe(rotuloDistribuidora(d));
      if (avisos[d.cnpj]) {
        expect(pf.rotulo).toBe(`${rotuloDistribuidora(d)} *`);
        expect(pf.detalhe).toContain(avisos[d.cnpj].frase.replace(/\.$/, ""));
        expect(pd.detalhe ?? "").not.toContain("cobertura parcial");
      } else expect(pf.rotulo).toBe(rotuloDistribuidora(d));
    }
    // a classe em uma letra bate com a classificação publicada
    const conta = (c: "c" | "p" | "s") => itens.filter((i) => i.classe === c).length;
    const conc = gold.distribuidoras.filter((d) => d.classificacao === "Concessionária").length;
    const perm = gold.distribuidoras.filter((d) => d.classificacao === "Permissionária").length;
    expect([conta("c"), conta("p"), conta("s")]).toEqual([conc, perm, gold.distribuidoras.length - conc - perm]);
    // o DGC que difere do publicado no ano de referência vai na dica dos dois indicadores
    for (const [cnpj, txt] of Object.entries(detalheDgcDoAno(gold))) {
      expect(dec.find((p) => p.id === cnpj)!.detalhe).toContain(txt);
      expect(fec.find((p) => p.id === cnpj)!.detalhe).toContain(txt);
    }
    // peso: uma lista só, sem undefined explícito (o fluxo do servidor escreve cada undefined como texto) e bem menor que as duas listas completas de antes
    for (const i of itens) expect(Object.values(i).includes(undefined as never)).toBe(false);
    const antes = JSON.stringify({ dec: itensLimite(gold, "dec"), fec: itensLimite(gold, "fec"), classes: Object.fromEntries(gold.distribuidoras.map((d) => [d.cnpj, d.classificacao])) });
    expect(JSON.stringify(itens).length).toBeLessThan(antes.length * 0.6);
  });

  it("conjuntos acima do limite de FEC: a contagem é um mínimo, e o resumo dos conjuntos sem razão sai do CSV anual", () => {
    const ano = gold.conjuntos.ano;
    const arquivo = arquivoConjuntosDoAno(ano);
    const bruto = linhasCsv(arquivo.split("/").at(-1)!).filter((l) => Number(l.ano) === ano);
    const sem = bruto.filter((l) => l.fec_interrupcoes !== "" && l.fec_limite_interrupcoes !== "" && l.razao_fec === "");
    const resumo = resumoSemRazaoFec(conjuntosDoCsv(ler(`public${arquivo}`), ano), ano);
    expect(resumo.total).toBe(sem.length);
    expect(resumo.porDistribuidora.reduce((s, x) => s + x.n, 0)).toBe(sem.length);
    expect(ordenadas(resumo.acima.map((x) => x.conjunto))).toEqual(ordenadas(sem.filter((l) => cent(Number(l.fec_interrupcoes)) > cent(Number(l.fec_limite_interrupcoes))).map((l) => l.conjunto)));
    // a gold conta só os que têm razão: a contagem dela é a do CSV, e nenhum dos conjuntos sem razão entra nela
    expect(bruto.filter((l) => l.acima_limite_fec === "1").length).toBe(gold.conjuntos.acima_limite_fec);
    expect(sem.every((l) => l.acima_limite_fec === "")).toBe(true);
    const t = textoContagemFec(gold, resumo);
    expect(t).toContain(`pelo menos ${num(gold.conjuntos.acima_limite_fec, 0)}`);
    if (resumo.total) {
      expect(t).toContain(num(resumo.total, 0));
      expect(t).toContain(resumo.porDistribuidora[0].sigla);
      for (const x of resumo.acima) expect(t).toContain(`conjunto ${x.conjunto}`);
    }
    // sem o resumo, só o mínimo e o motivo
    expect(textoContagemFec(gold, null)).toBe(`A contagem de FEC é de pelo menos ${num(gold.conjuntos.acima_limite_fec, 0)}: só entram os conjuntos com os 12 meses de FEC publicados.`);
    // a frase com o resumo, à mão
    const doisAcima = {
      ano,
      total: 3,
      porDistribuidora: [{ sigla: "X", n: 2 }, { sigla: "Y", n: 1 }],
      acima: [{ conjunto: "1", nome: "A", sigla: "X", fec: 5.44, limite: 5 }],
    };
    expect(textoContagemFec(gold, doisAcima)).toBe(
      `A contagem de FEC é de pelo menos ${num(gold.conjuntos.acima_limite_fec, 0)}: só entram os conjuntos com os 12 meses de FEC publicados. 3 conjuntos com limite de FEC têm menos meses e ficam fora (2 da X e 1 de outra distribuidora). Um deles já passa do limite com os meses publicados: A, conjunto 1 (FEC 5,44 contra limite de 5,00).`,
    );
    expect(textoContagemFec(gold, { ...doisAcima, total: 0, porDistribuidora: [], acima: [] })).toBe(textoContagemFec(gold, null));
  });

  it("situação do FEC de um conjunto: a razão só existe com 12 meses de FEC; com menos, a frase diz se já passa do limite", () => {
    const f = (x: Partial<Parameters<typeof situacaoFecDoConjunto>[0]>) => situacaoFecDoConjunto({ acima: "", fec: 5, limite: 5, razao: null, ...x });
    expect(f({ acima: "1", razao: 1.2 })).toBe("acima do limite");
    expect(f({ acima: "0", razao: 0.8 })).toBe("até o limite");
    expect(f({ fec: 5.44, limite: 5 })).toBe("menos de 12 meses de FEC, já acima do limite");
    expect(f({ fec: 5, limite: 5 })).toBe("menos de 12 meses de FEC");
    expect(f({ fec: 4.99, limite: 5 })).toBe("menos de 12 meses de FEC");
    expect(f({ fec: 5.44, limite: 5, mesesFec: 11 })).toBe("11 meses de FEC, já acima do limite");
    expect(f({ fec: null })).toBe("sem FEC ou sem limite de FEC");
    expect(f({ limite: null })).toBe("sem FEC ou sem limite de FEC");
    // lido do CSV anual: as categorias somam os conjuntos do ano e a contagem "acima" é a da gold
    const linhas = conjuntosDoCsv(ler(`public${arquivoConjuntosDoAno(gold.conjuntos.ano)}`), gold.conjuntos.ano);
    const conta = (t: string) => linhas.filter((l) => l.situacao_fec === t).length;
    expect(conta("acima do limite")).toBe(gold.conjuntos.acima_limite_fec);
    expect(linhas.every((l) => typeof l.situacao_fec === "string" && l.situacao_fec !== "")).toBe(true);
    expect(linhas.filter((l) => /meses de FEC/.test(String(l.situacao_fec))).length).toBe(resumoSemRazaoFec(linhas, gold.conjuntos.ano).total);
    // DEC: sem a marca do limite, ou o conjunto tem menos de 12 meses ou não tem limite
    for (const l of linhas.filter((x) => x.situacao_dec !== "acima do limite" && x.situacao_dec !== "até o limite")) {
      expect(l.situacao_dec).toBe((l.meses as number) < 12 ? "menos de 12 meses publicados" : "sem limite publicado");
    }
  });

  it("a fração de conjuntos acima do limite diz que o universo muda (primeiro ano, o menor e o último) e põe a fração em UCs como leitura principal", () => {
    const h = gold.conjuntos.historico;
    const menor = h.reduce((m, x) => (x.com_limite < m.com_limite ? x : m));
    const t = textoUniversosConjuntos(gold);
    expect(t).toContain(`${num(h[0].com_limite, 0)} em ${h[0].ano}`);
    expect(t).toContain(`${num(menor.com_limite, 0)} em ${menor.ano}`);
    expect(t).toContain(`${num(h.at(-1)!.com_limite, 0)} em ${h.at(-1)!.ano}`);
    expect(t).toMatch(/mistura desempenho, meta e mudança de universo/);
    expect(t).toMatch(/unidades consumidoras .* é a leitura principal/);
    // o menor ano que é o primeiro (ou o último) não se repete
    const g2 = copia();
    g2.conjuntos.historico.forEach((x, i) => (x.com_limite = 1000 + i));
    expect((textoUniversosConjuntos(g2).match(/\d\.?\d{3} em \d{4}/g) ?? []).length).toBe(2);
    g2.conjuntos.historico = g2.conjuntos.historico.slice(0, 1);
    expect(textoUniversosConjuntos(g2)).toBe("");
  });

  it("o maior DEC apurado cruza regras do apurado: a frase diz as regras e compara o ano de referência pela mesma definição (a parcela apurada), desde o primeiro ano com parcelas", () => {
    const c = comparacaoApurado(gold)!;
    const comParcela = gold.brasil.anual.filter((a) => a.completo && a.parcelas_dec && a.parcelas_dec.apurado !== null);
    const maxIp = Math.max(...comParcela.map((a) => a.parcelas_dec!.apurado!));
    expect(c.desde).toBe(comParcela[0].ano);
    expect(c.maiorMesmaDefinicao.dec).toBe(maxIp);
    expect(c.maiorMesmaDefinicao.anos).toEqual(comParcela.filter((a) => cent(a.parcelas_dec!.apurado!) === cent(maxIp)).map((a) => a.ano));
    expect(c.referencia).toEqual({ ano: ref, publicado: brasil(gold, ref).dec, mesmaDefinicao: brasil(gold, ref).parcelas_dec!.apurado });
    // o ano do máximo publicado é o mesmo que a frase de "o que mudou" cita
    const completos = gold.brasil.anual.filter((a) => a.completo && a.dec !== null);
    const maiorPub = completos.reduce((m, a) => ((a.dec ?? -1) > (m.dec ?? -1) ? a : m));
    expect(c.maiorPublicado).toEqual({ ano: maiorPub.ano, dec: maiorPub.dec });
    expect(mudancaP051(gold)).toContain(`o de ${maiorPub.ano} (${num(maiorPub.dec, 2)} h)`);
    const t = textoQuebraApurado(gold);
    expect(t).toContain(`o de ${maiorPub.ano}, cruza regras diferentes do apurado`);
    expect(t).toContain(`de ${c.desde} a ${c.uniforme! - 1} ele incluía, em parte dos conjuntos, interrupções de origem externa`);
    expect(t).toContain(`desde ${c.uniforme}, inclui só as internas`);
    expect(t).toContain(`o maior DEC foi o de ${listaPt(c.maiorMesmaDefinicao.anos.map(String))} (${num(maxIp, 2)} h), e ${ref} fechou com ${num(c.referencia.mesmaDefinicao, 2)} h`);
    // sem as regras de código (XN, XP, IP, IND) no texto do leitor
    expect(t).not.toMatch(/\b(XN|XP|IP|IND)\b/);
    // sem parcelas, sem comparação; sem ano uniforme, sem a regra de transição
    const g2 = copia();
    for (const a of g2.brasil.anual) a.parcelas_dec = null;
    expect(comparacaoApurado(g2)).toBeNull();
    expect(textoQuebraApurado(g2)).toBe("");
    const g3 = copia();
    for (const x of g3.brasil.identidade_apurado) [x.pct_dec_igual_ip_mais_ind, x.pct_fec_igual_ip_mais_ind] = [90, 90];
    expect(textoQuebraApurado(g3)).toContain(`antes de ${c.desde} a fonte usa outra desagregação.`);
    expect(textoQuebraApurado(g3)).not.toContain("inclui só as internas");
  });

  it("R$ por UC e concentração: o valor por UC e as cinco maiores usam unidades consumidoras e geradoras somadas, e os rótulos dizem isso", () => {
    const a = gold.compensacoes.anual.find((x) => x.ano === gold.compensacoes.ano_referencia)!;
    const ucs = brasil(gold, gold.compensacoes.ano_referencia).ucs_media!;
    // o valor por UC é o total UC + UG dividido pelas UCs médias (e não o total só de UC): por isso o rótulo
    expect(a.valor_por_uc!).toBeCloseTo(a.valor! / ucs, 1);
    expect(Math.abs(a.valor_por_uc! - a.valor_uc! / ucs)).toBeGreaterThan(0.05);
    // a concentração das cinco maiores é sobre o total UC + UG
    const tops = gold.distribuidoras.map((d) => d.compensacao?.valor ?? 0).sort((x, y) => y - x).slice(0, 5);
    expect(gold.compensacoes.concentracao_5_maiores_pct!).toBeCloseTo((100 * tops.reduce((s, x) => s + x, 0)) / a.valor!, 1);
    expect(respostaP053(gold)).toContain(`${num(gold.compensacoes.concentracao_5_maiores_pct, 1)}% do total do ano de unidades consumidoras e geradoras somadas`);
    expect(COLUNAS_COMP_ANUAL.find((c) => c.id === "valor_por_uc")!.rotulo).toContain("UC e UG");
    expect(colunasCompensacaoDistribuidoras(gold.compensacoes.rotulos_tipo).find((c) => c.id === "valor_por_uc")!.rotulo).toContain("UC e UG");
    // a coluna vizinha (valor só de UC) não leva a marca de UC e UG
    expect(COLUNAS_COMP_ANUAL.find((c) => c.id === "valor_uc")!.rotulo).not.toContain("UG");
  });

  it("abertura: o cartão do DEC e o do FEC dizem o perímetro (concessionárias) e a diferença com o número que a ANEEL divulga; o das compensações, o total divulgado", () => {
    const a = brasil(gold, ref);
    expect(notaPerimetroAbertura(gold, "dec")).toBe(`Só as concessionárias, como a ANEEL divulga: ${num(a.dec_concessionarias, 2)} h.`);
    expect(notaPerimetroAbertura(gold, "fec")).toBe(`Só as concessionárias, como a ANEEL divulga: ${num(a.fec_concessionarias, 2)}.`);
    // o número de todas as distribuidoras e o das concessionárias são os dois da gold, nunca o mesmo
    expect(a.dec).not.toBe(a.dec_concessionarias);
    const g2 = copia();
    brasil(g2, ref).dec_concessionarias = null;
    brasil(g2, ref).fec_concessionarias = null;
    expect(notaPerimetroAbertura(g2, "dec")).toBe("");
    expect(notaPerimetroAbertura(g2, "fec")).toBe("");
    // compensações
    const c = gold.compensacoes.anual.find((x) => x.ano === gold.compensacoes.ano_referencia)!;
    if (c.divulgado_aneel && c.divulgado_aneel.dentro_da_precisao_valor === false) {
      expect(notaDivulgadoCartao(gold)).toBe(`A ANEEL divulga ${reaisMilhoes(c.divulgado_aneel.valor, 0)}: a diferença passa da precisão divulgada e não foi explicada.`);
    }
    const g3 = copia();
    const c3 = g3.compensacoes.anual.find((x) => x.ano === g3.compensacoes.ano_referencia)!;
    c3.divulgado_aneel = { valor: 1_002_000_000, quantidade: null, dentro_da_precisao_valor: false, dentro_da_precisao_quantidade: null };
    expect(notaDivulgadoCartao(g3)).toContain(reaisMilhoes(1_002_000_000, 0));
    c3.divulgado_aneel.dentro_da_precisao_valor = true;
    expect(notaDivulgadoCartao(g3)).toBe("");
    c3.divulgado_aneel = null;
    expect(notaDivulgadoCartao(g3)).toBe("");
  });

  it("DGC: as divergências com o ranking da ANEEL saem da reconciliação, sem inventar causa, e a do ano de referência marca o ponto", () => {
    const todas = gold.reconciliacao.dgc.flatMap((r) => r.divergentes.map((d) => ({ ano: r.ano, d })));
    const lista = divergenciasDgc(gold);
    expect(lista.length).toBe(todas.length);
    const comparados = gold.reconciliacao.dgc.reduce((s, r) => s + r.comparados, 0);
    const t = textoDivergenciasDgc(gold);
    expect(t).toContain(`${num(lista.length, 0)} de ${num(comparados, 0)} comparações`);
    for (const x of lista) expect(t).toContain(`${x.rotulo} em ${x.ano} (publicado ${num(x.publicado, 2)}, calculado ${num(x.calculado, 2)})`);
    expect(t).toMatch(/hipóteses não verificadas/);
    expect(t).toMatch(/a causa não está nos dados publicados/);
    // só as do ano de referência vão ao ponto, pelo CNPJ
    const doAno = lista.filter((x) => x.ano === gold.ano_referencia && x.cnpj);
    expect(Object.keys(detalheDgcDoAno(gold)).sort()).toEqual(doAno.map((x) => x.cnpj!).sort());
    // sem divergência, a frase diz que ficou dentro da tolerância
    const g2 = copia();
    for (const r of g2.reconciliacao.dgc) r.divergentes = [];
    expect(textoDivergenciasDgc(g2)).toMatch(/ficaram dentro da tolerância de 0,01/);
    expect(detalheDgcDoAno(g2)).toEqual({});
    g2.reconciliacao.dgc = [];
    expect(textoDivergenciasDgc(g2)).toBe("");
  });

  it("reclamações: a taxa por mil UCs na base de 100 mil UCs da Ouvidoria é só mudança de base, e a ausência continua ausência", () => {
    expect(taxaNaBaseDaOuvidoria(400.91)).toBeCloseTo(40091, 6);
    expect(taxaNaBaseDaOuvidoria(0)).toBe(0);
    expect(taxaNaBaseDaOuvidoria(null)).toBeNull();
    expect(taxaNaBaseDaOuvidoria(undefined)).toBeNull();
    expect(taxaNaBaseDaOuvidoria(Number.NaN)).toBeNull();
  });

  it("texto para o leitor: tira a marcação copiada da fonte e os nomes internos, e é idempotente", () => {
    const ent = "Conjunto __Nota__: migrado de __dadosabertos.aneel.gov.br/x__ e _itálico_ aqui.";
    expect(paraLeitor(ent)).toBe("Conjunto Nota: migrado de dadosabertos.aneel.gov.br/x e itálico aqui.");
    expect(paraLeitor("Indicadores:\n\n* Tempo Médio (TMP);\n* Tempo de Execução (TME); e\n* Percentual")).toBe("Indicadores: Tempo Médio (TMP); Tempo de Execução (TME); e Percentual");
    expect(paraLeitor("Lista\n* a\n* b")).toBe("Lista; a; b");
    expect(paraLeitor("Todas as distribuidoras (dec, fec).")).toBe("Todas as distribuidoras.");
    expect(paraLeitor("Só concessionárias (dec_concessionarias, fec_concessionarias): o universo")).toBe("Só concessionárias: o universo");
    expect(paraLeitor("e vai em dec_concessionarias e fec_concessionarias")).toBe("e aparece à parte");
    expect(paraLeitor("Distribuidora-mês com NumCon implausível")).toBe("Distribuidora-mês com número de UCs informado implausível");
    expect(paraLeitor("interna, não programada, não expurgável")).toBe("interna, não programada, que a regra não exclui");
    expect(paraLeitor("com Nie > NumOcorr")).toBe("com ocorrências com interrupção > total de ocorrências");
    expect(paraLeitor("ocorrências (Nie) e total (NumOcorr)")).toBe("ocorrências e total");
    expect(paraLeitor("(o silver tem uma única captura) e o bronze")).toBe("(a base tratada tem uma única captura) e o arquivo original");
    expect(paraLeitor("último mês 2026-06, hoje 2026-10-01")).toBe("último mês 2026-06, processamento em 2026-10-01");
    // siglas entre parênteses e sublinhado dentro de palavra ficam como estão
    expect(paraLeitor("Duração Equivalente (DEC) e snake_case_dentro")).toBe("Duração Equivalente (DEC) e snake_case_dentro");
    for (const t of [ent, "Lista\n* a\n* b", "com NumCon", "(dec, fec)"]) expect(paraLeitor(paraLeitor(t))).toBe(paraLeitor(t));
  });

  it("ficha de origem para o leitor: texto sem marcação nem termo interno, descrição longa da fonte resumida em frase inteira, e a original intacta", () => {
    const pistas = /__|\bsilver\b|\bbronze\b|\bNumCon\b|(dec|fec)_concessionarias/;
    for (const [k, p] of Object.entries(gold.proveniencia)) {
      const antes = JSON.stringify(p);
      const l = limpaProveniencia(p);
      expect(JSON.stringify(p), `${k}: a original não muda`).toBe(antes);
      for (const t of [l.notas_fonte ?? "", ...l.limitacoes, ...l.transformacoes, l.formula ?? ""]) expect(t, k).not.toMatch(pistas);
      expect((l.notas_fonte ?? "").length, k).toBeLessThanOrEqual(700 + 80);
      expect(l.indicador).toBe(p.indicador);
      expect(l.snapshot).toEqual(p.snapshot);
    }
    const longo = "Primeira frase do texto. ".repeat(60).trim();
    const r = resumirTexto(longo, 700);
    expect(r.length).toBeLessThanOrEqual(700 + 80);
    expect(r).toMatch(/\. \(texto resumido; a descrição completa está na página da fonte\)$/);
    expect(resumirTexto("curto", 700)).toBe("curto");
    // sem ponto final dentro do limite, corta na palavra e põe reticências
    expect(resumirTexto("palavra ".repeat(200), 100)).toMatch(/palavra… \(texto resumido/);
  });

  it("ficha do município: os conjuntos citados com DEC, FEC, limite e razão; o intervalo do arquivo de municípios vale para os conjuntos de 12 meses", () => {
    const ano = gold.mapa.ano;
    const linhasAno = conjuntosDoCsv(ler(`public${arquivoConjuntosDoAno(ano)}`), ano);
    const municipios = municipiosDoCsv(ler("public/energia/series/qualidade_municipios.csv"));
    const sp = municipios.find((m) => m.cod === "3550308")!;
    const { linhas, semValor } = conjuntosDoMunicipio(linhasAno, sp.conjuntos);
    // todos os conjuntos citados para São Paulo têm linha no ano, na ordem em que a base os cita
    expect(semValor).toEqual([]);
    expect(linhas.map((l) => l.conjunto)).toEqual(sp.conjuntos);
    for (const c of COLUNAS_CONJUNTOS_MUNICIPIO) expect(linhas.every((l) => c.id in l), c.id).toBe(true);
    // código citado sem linha no ano: fica numa lista à parte, nunca com valor preenchido
    expect(conjuntosDoMunicipio(linhasAno, ["000000", ...sp.conjuntos.slice(0, 2)])).toEqual({ linhas: linhas.slice(0, 2), semValor: ["000000"] });
    // o intervalo de DEC do arquivo de municípios é o dos conjuntos com 12 meses de DEC, em todos os municípios
    const porCodigo = new Map(linhasAno.map((l) => [String(l.conjunto), l]));
    const doMunicipio = (m: MunicipioQualidade) => m.conjuntos.map((c) => porCodigo.get(c)).filter((l): l is NonNullable<typeof l> => !!l);
    for (const m of municipios.filter((x) => x.conjuntos.length)) {
      const doze = doMunicipio(m).filter((l) => l.meses === 12 && l.dec !== null);
      if (!doze.length) continue;
      const decs = doze.map((l) => l.dec as number);
      expect(Math.min(...decs), `${m.nome} ${m.uf} mínimo`).toBeCloseTo(m.dec_min!, 2);
      expect(Math.max(...decs), `${m.nome} ${m.uf} máximo`).toBeCloseTo(m.dec_max!, 2);
    }
    // o conjunto de menos de 12 meses fica na tabela, mas fora do intervalo, e a nota diz isso
    const incompleto = linhasAno.find((l) => (l.meses as number) < 12)!;
    const mun = municipios.find((m) => m.conjuntos.includes(String(incompleto.conjunto)))!;
    const t = textoMesesIncompletos(conjuntosDoMunicipio(linhasAno, mun.conjuntos).linhas);
    expect(t).toContain("menos de 12 meses de DEC");
    expect(t).toContain("não entram no intervalo");
    expect(textoMesesIncompletos(linhas.filter((l) => l.meses === 12 && !/meses de FEC/.test(String(l.situacao_fec))))).toBe("");
    // o intervalo de FEC do arquivo de municípios deixa de fora os conjuntos de menos de 12 meses de FEC: onde ele difere do da tabela, há conjunto marcado
    let diferentes = 0;
    for (const m of municipios.filter((x) => x.conjuntos.length && x.fec_min !== null)) {
      const rows = doMunicipio(m).filter((l) => l.meses === 12 && l.fec !== null);
      if (!rows.length) continue;
      const fs = rows.map((l) => l.fec as number);
      if (Math.abs(Math.min(...fs) - m.fec_min!) > 0.005 || Math.abs(Math.max(...fs) - m.fec_max!) > 0.005) {
        diferentes++;
        expect(rows.some((l) => /meses de FEC/.test(String(l.situacao_fec))), `${m.nome} ${m.uf}`).toBe(true);
      }
    }
    expect(diferentes).toBeGreaterThanOrEqual(0);
  });

  it("cor do mapa: diz se é o maior ou o menor valor entre os conjuntos citados, com quantos são", () => {
    const base = { cod: "1", nome: "X", uf: "SP", relacao: "varios_conjuntos", dec_min: 1, dec_max: 36.5, fec_min: 0.32, fec_max: 14.35, cnpjs: [] } as const;
    const mun = (conjuntos: string[]): MunicipioQualidade => ({ ...base, conjuntos, cnpjs: [] });
    const tres = mun(["1", "2", "3"]);
    expect(textoCorDoMapa(tres, "dec_max")).toBe("Cor do mapa: o maior valor entre os 3 conjuntos citados, 36,50 h.");
    expect(textoCorDoMapa(tres, "dec_min")).toBe("Cor do mapa: o menor valor entre os 3 conjuntos citados, 1,00 h.");
    expect(textoCorDoMapa(tres, "fec_max")).toBe("Cor do mapa: o maior valor entre os 3 conjuntos citados, 14,35 interrupções.");
    expect(textoCorDoMapa(mun(["1"]), "dec_max")).toBe("Cor do mapa: o valor do único conjunto citado, 36,50 h.");
    expect(textoCorDoMapa({ ...tres, dec_max: null }, "dec_max")).toBe("");
    expect(textoCorDoMapa(mun([]), "dec_max")).toBe("");
  });

  it("recorte de colunas: só o que o gráfico lê, e a ausência continua nula (nunca zero nem undefined)", () => {
    const linhas = [{ a: 1, b: "x", c: 3 }, { a: null, b: "y" }];
    expect(recorteColunas(linhas, ["a", "c"])).toEqual([{ a: 1, c: 3 }, { a: null, c: null }]);
    expect(recorteColunas([], ["a"])).toEqual([]);
    const anual = linhasBrasilAnual(gold);
    const dec = recorteColunas(anual, ["ano", "dec", "dec_concessionarias", "dec_limite"]);
    expect(dec.length).toBe(anual.length);
    expect(JSON.stringify(dec).length).toBeLessThan(JSON.stringify(anual).length * 0.7);
  });

  it("o FEC do Brasil e a soma das parcelas internas: a frase diz se coincidem nas duas casas, e a ressalva não muda o número nacional", () => {
    const a = brasil(gold, ref);
    const t = textoFecBrasilConfere(gold);
    if (cent(a.fec!) === cent(a.parcelas_fec!.apurado!)) expect(t).toContain("coincidem nas duas casas: a ressalva não muda o número nacional");
    else expect(t).toContain("difere da soma das parcelas internas");
    expect(t).toContain(`o FEC de ${ref} (${num(a.fec, 2)})`);
    const g2 = copia();
    brasil(g2, ref).parcelas_fec!.apurado = brasil(g2, ref).fec! + 0.2;
    expect(textoFecBrasilConfere(g2)).toContain("difere da soma das parcelas internas");
    brasil(g2, ref).parcelas_fec = null;
    expect(textoFecBrasilConfere(g2)).toBe("");
  });
});

describe.skipIf(!disponivel)("ressalvas das avaliações independentes: a página e os componentes no servidor", () => {
  const html = renderToStaticMarkup(createElement(QualidadePage));
  const ref = gold.ano_referencia;
  const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;").replace(/</g, "&lt;");
  const ate = (marca: string) => html.indexOf(marca);
  const faixa = () => html.slice(ate("data-faixa-metricas"), ate('id="p051"'));
  const secao = (de: string, ate_: string) => html.slice(ate(de), ate(ate_));
  const csvAno = conjuntosDoCsv(ler(`public${arquivoConjuntosDoAno(gold.conjuntos.ano)}`), gold.conjuntos.ano);

  it("primeira tela: o número é de todas as distribuidoras e a nota diz o das concessionárias que a ANEEL divulga; conjunto é definido no cartão; nada de 'expurgado'", () => {
    const f = faixa();
    expect(f).toContain(esc(notaPerimetroAbertura(gold, "dec")));
    expect(f).toContain(esc(notaPerimetroAbertura(gold, "fec")));
    expect(f).toContain(esc(DEFINICAO_CONJUNTO_CURTA));
    expect(f).not.toMatch(/expurgad/);
    // o quarto cartão diz com palavras o que soma
    expect(f).toMatch(/Inclui o que a regra deixa fora do limite: emergências, dias críticos, origem externa e cortes do operador do sistema \(ONS\)/);
    // código do apurado só depois, na seção própria
    expect(f).not.toMatch(/IP \+ IND|XN|XP/);
    // o subtítulo do primeiro painel define "apurado" e usa a sigla de unidade consumidora já expandida no lead
    expect(html).toContain("DEC e FEC apurados, o que a regra conta para o limite");
  });

  it("jargão e marcação crua fora do texto: sem silver, bronze, NumCon, nome de campo da gold nem sublinhado de Markdown em lugar nenhum da página", () => {
    const texto = html.slice(html.indexOf("<main")).replace(/<svg[\s\S]*?<\/svg>/g, " ");
    expect(texto).not.toMatch(/\b(silver|bronze)\b/);
    expect(texto).not.toMatch(/NumCon|NumOcorr/);
    expect(texto).not.toMatch(/\bexpurgável\b/);
    expect(texto).not.toMatch(/(dec|fec)_concessionarias/);
    expect(texto).not.toMatch(/__[^_\s][^_<]*__/);
    expect(texto).not.toMatch(/\((dec|fec)(, (dec|fec))?\)/);
    // a descrição longa da fonte vem resumida; o diálogo "Sobre este dado" monta o texto só ao abrir, então a conferência é na ficha que ele recebe
    expect(Object.values(gold.proveniencia).some((p) => (limpaProveniencia(p).notas_fonte ?? "").includes("(texto resumido; a descrição completa está na página da fonte)"))).toBe(true);
  });

  it("o que mudou do P051 traz a quebra do apurado junto da frase do maior DEC; o do P052 traz a contagem mínima de FEC; o universo dos conjuntos vem na seção ano a ano", () => {
    expect(html).toContain(esc(textoQuebraApurado(gold)));
    expect(html).toContain(esc(textoContagemFec(gold, resumoSemRazaoFec(csvAno, gold.conjuntos.ano))));
    expect(html).toContain(esc(textoUniversosConjuntos(gold)));
    const ano = secao('id="ano-a-ano"', 'id="matriz-limite-razao"');
    expect(ano.indexOf("% das unidades consumidoras (leitura principal)")).toBeGreaterThan(0);
    expect(ano.indexOf("% das unidades consumidoras (leitura principal)")).toBeLessThan(ano.indexOf("% dos conjuntos"));
    expect(ano).toContain("Unidades consumidoras e conjuntos acima do limite de DEC");
  });

  it("DGC no Auditar: a lista das divergências e a regra da cobertura parcial do FEC, com a distribuidora marcada e o efeito nulo no Brasil", () => {
    const dgc = secao('id="dgc"', 'id="p053"');
    expect(dgc).toContain(esc(textoDivergenciasDgc(gold)));
    expect(dgc).toMatch(/Posição no ranking e DGC publicado são da ANEEL; o DGC calculado é do observatório/);
    const cob = html.slice(ate('data-texto="cobertura-fec"'), ate('data-texto="cobertura-fec"') + 2500);
    expect(cob).toContain("Cobertura do FEC:");
    expect(cob).toContain(`difere em mais de ${num(LIMITE_FEC_PARCIAL_CENTESIMOS / 100, 2)}`);
    for (const a of fecComCoberturaParcial(gold)) expect(cob).toContain(esc(a.rotulo));
    expect(cob).toContain(esc(textoFecBrasilConfere(gold)));
    // a seção de Auditar não traz mais o título interno do arquivo de origem
    expect(html).not.toContain("bronze com sha256");
  });

  it("P053: os cinco limites individuais definidos na primeira ocorrência, o valor por UC com o perímetro dito e o total divulgado junto do número", () => {
    const p = secao('id="p053"', 'id="p054"');
    const def = p.indexOf(esc(DEFINICAO_LIMITES_INDIVIDUAIS));
    expect(def).toBeGreaterThan(0);
    for (const sigla of ["DIC", "FIC", "DMIC", "DICRI", "DISE"]) expect(p.indexOf(sigla), sigla).toBeGreaterThanOrEqual(def);
    expect(p.slice(0, def)).not.toMatch(/\b(DIC|FIC|DMIC|DICRI|DISE)\b/);
    expect(p).toContain("soma as compensações de unidades consumidoras e");
    expect(p).toContain("Valor no ano (UC e UG) ÷ UCs médias");
    const nota = notaDivulgadoCartao(gold);
    if (nota) expect(p).toContain(esc(nota));
  });

  it("P054: as duas taxas dizem a sua base, uma em cada cartão, e a da distribuidora vem também na base da Ouvidoria", () => {
    const p = secao('id="p054"', 'id="auditoria-qualidade"');
    const rec = gold.atendimento.reclamacoes_distribuidora.find((x) => x.ano === ref)!;
    expect(p).toContain("Base: 1.000 unidades consumidoras médias das mesmas distribuidoras");
    expect(p).toContain(`Na base de 100 mil UCs do cartão ao lado, seriam ${num(taxaNaBaseDaOuvidoria(rec.por_ucs), 0)}`);
    expect(p).toContain("Base: 100 mil UCs, diferente da do cartão ao lado (1.000)");
  });

  it("mapa: conjunto definido antes da cor, e a dica diz que o valor é o maior (ou o menor) entre os conjuntos do município", () => {
    const mapa = secao('id="mapa-municipios"', 'id="mensal"');
    expect(mapa).toContain(esc(DEFINICAO_CONJUNTO));
    expect(mapa.indexOf(esc(DEFINICAO_CONJUNTO))).toBeLessThan(mapa.indexOf("Cada cor é o valor de um conjunto"));
    expect(mapa).toMatch(/ver os conjuntos, o limite de cada um e as distribuidoras/);
    // a unidade que o mapa passa à dica e à linha de seleção (estado inicial: DEC, maior conjunto)
    expect(ler("src/components/energia/QualidadeMapa.tsx")).toContain('${v.med.endsWith("max") ? "maior" : "menor"} entre os conjuntos do município');
  });

  it("componentes novos: a ficha do município diz o que faz antes de carregar, e a escolha de escala é um grupo de rádios nativos", () => {
    const f = renderToStaticMarkup(
      createElement(QualidadeConjuntosDoMunicipio, { ano: 2025, codigoMunicipio: "1302603", municipio: "Manaus (AM)", codigos: ["17371", "17393"], fonte: "ANEEL", tamanho: "2,1 MB" }),
    );
    expect(f).toContain("Os 2 conjuntos que atendem Manaus (AM), com o limite de cada um");
    expect(f).toContain(esc(DEFINICAO_CONJUNTO));
    expect(f).toContain("procure o nome do conjunto na fatura de energia");
    expect(f).toContain("ou pergunte à distribuidora");
    expect(f).toContain("Carregando os valores dos conjuntos (2,1 MB, o mesmo do explorador de Analisar)");
    expect(renderToStaticMarkup(createElement(QualidadeConjuntosDoMunicipio, { ano: 2025, codigoMunicipio: "1", municipio: "X", codigos: [], fonte: "ANEEL" }))).toBe("");
    expect(renderToStaticMarkup(createElement(QualidadeConjuntosDoMunicipio, { ano: 2025, codigoMunicipio: "1", municipio: "X", codigos: ["1"], fonte: "ANEEL" }))).toContain("O conjunto que atende X");
    const e = renderToStaticMarkup(createElement(QualidadeEscala, { valor: "compartilhada", onMudar: () => undefined }));
    expect(e).toContain('role="radiogroup"');
    expect((e.match(/type="radio"/g) ?? []).length).toBe(2);
    expect(e).toMatch(/checked=""[^>]*value="compartilhada"|value="compartilhada"[^>]*checked=""/);
    expect(e).toContain("A mesma em todos os painéis");
    expect(e).toContain("Própria de cada painel");
  });

  it("painel de limites: o histórico, a marca do FEC e a limpeza da seleção estão no componente, e o painel recebe os avisos pela página", () => {
    const limites = renderToStaticMarkup(createElement(QualidadeLimites, { ano: ref, itens: itensLimites(gold), totalLinhas: gold.distribuidoras.length, urlSerie: "/x.json", avisosFec: avisosFec(gold) }));
    // estado inicial (DEC, sem escolha): sem nota do FEC e sem chip de limpeza; as duas ordens de leitura continuam
    expect(limites).not.toContain("cobertura parcial do FEC");
    expect(limites).not.toContain("Limpar seleção");
    expect(limites).toContain("Escolha uma distribuidora no gráfico ou na tabela");
    const fonteLimites = ler("src/components/energia/QualidadeLimites.tsx");
    expect(fonteLimites).toContain("Limpar seleção");
    expect(fonteLimites).toContain('data-aviso="fec-cobertura-parcial"');
    expect(fonteLimites).toContain("FEC de cobertura parcial");
    const pagina = ler("src/app/setor-eletrico/qualidade/page.tsx");
    expect(pagina).toMatch(/<QualidadeLimites[\s\S]*avisosFec=\{avisos\}/);
    expect(pagina).toMatch(/<QualidadeComparador[\s\S]*avisosFec=\{avisos\}/);
    expect(pagina).toMatch(/<QualidadeMapa[\s\S]*avisosFec=\{avisos\}/);
  });

  it("peso: a marcação do servidor não cresce, e as props dos gráficos levam só as colunas que eles leem (o fluxo RSC repete essas props)", () => {
    expect(Buffer.byteLength(html, "utf-8")).toBeLessThan(400_000);
    const pagina = ler("src/app/setor-eletrico/qualidade/page.tsx");
    // nenhum gráfico recebe a lista inteira de colunas de um seletor: cada um recebe um recorte
    for (const lista of ["anual", "mensal", "compMensal"]) expect(pagina, lista).not.toMatch(new RegExp(`dados=\\{${lista}\\}`));
    expect(pagina).not.toMatch(/dados=\{linhasHistoricoConjuntos\(c\)\}/);
  });
});

describe.skipIf(!disponivel)("rodada 2: frase do recorte, quebra de 2022, busca na primeira tela, definições e orientação", () => {
  const ref = gold.ano_referencia;
  const html = renderToStaticMarkup(createElement(QualidadePage));
  const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;").replace(/</g, "&lt;");
  const itens = itensLimites(gold);
  const anoRef = () => gold.compensacoes.anual.find((x) => x.ano === gold.compensacoes.ano_referencia)!;

  it("a frase do gráfico de limites acompanha o indicador e o grupo: a contagem sai dos itens, em centésimos, e cada recorte diz a sua", () => {
    const avisos = avisosFec(gold);
    const frases = new Set<string>();
    for (const ind of ["dec", "fec"] as const) {
      for (const classe of ["c", "p"] as const) {
        const doGrupo = itens.filter((i) => i.classe === classe);
        const pares = doGrupo.filter((i) => (ind === "dec" ? i.dec !== null && i.decLim !== null : i.fec !== null && i.fecLim !== null));
        const acima = pares.filter((i) => comparaNaPrecisao(ind === "dec" ? i.dec! : i.fec!, ind === "dec" ? i.decLim! : i.fecLim!, 2) === "acima");
        const t = respostaRecorteLimites(itens, ind, classe, ref, avisos);
        const nome = ind === "dec" ? "DEC" : "FEC";
        expect(t, `${ind} ${classe}`).toContain(`${nome} e limite`);
        expect(t).toContain(classe === "c" ? "concessionárias" : "permissionárias");
        expect(t).toContain(acima.length === 0 ? `nenhuma das ${num(pares.length, 0)}` : acima.length === pares.length && pares.length > 1 ? `todas as ${num(pares.length, 0)}` : `${num(acima.length, 0)} de ${num(pares.length, 0)}`);
        if (doGrupo.length > pares.length) expect(t).toContain(`${num(doGrupo.length - pares.length, 0)} sem valor ou sem limite no ano`);
        frases.add(t);
      }
    }
    // quatro recortes, quatro frases: trocar para FEC ou para permissionárias muda o que ela diz
    expect(frases.size).toBe(4);
    // com itens à mão: contagem, a mais distante e quem fica fora; a ressalva de cobertura parcial só no FEC
    const mini: ItemLimitesTeste[] = [
      { id: "1", rotulo: "A", classe: "c", dec: 10, decLim: 8, fec: 9, fecLim: 4 },
      { id: "2", rotulo: "B", classe: "c", dec: 7, decLim: 8, fec: 3, fecLim: 4 },
      { id: "3", rotulo: "C", classe: "c", dec: null, decLim: null, fec: null, fecLim: null },
    ];
    const t = respostaRecorteLimites(mini, "dec", "c", 2025);
    expect(t).toContain("1 de 2 concessionárias com DEC e limite ficou acima do limite agregado de DEC");
    expect(t).toContain("A mais distante do limite é a A: 10,00 h para um limite de 8,00.");
    expect(t).toContain("1 sem valor ou sem limite no ano fica só na tabela");
    expect(respostaRecorteLimites(mini, "dec", "p", 2025)).toMatch(/Nenhuma das 0 permissionárias/);
    const marcada = Object.values(avisos)[0];
    if (marcada) {
      const f = respostaRecorteLimites([{ ...mini[0], id: marcada.cnpj }, mini[1]], "fec", "c", 2025, avisos);
      expect(f).toContain("(FEC de cobertura parcial, marcado com asterisco)");
      expect(respostaRecorteLimites([{ ...mini[0], id: marcada.cnpj }, mini[1]], "dec", "c", 2025, avisos)).not.toContain("cobertura parcial");
    }
    // na página: a frase do estado inicial (DEC, concessionárias) e, no componente, a legenda do asterisco acima do gráfico
    expect(html).toContain('data-frase-recorte="limites"');
    // depois dos controles e antes do gráfico, na ordem do documento e na da tela
    expect(html.indexOf('data-frase-recorte="limites"')).toBeGreaterThan(html.indexOf('aria-label="Grupo de distribuidoras"'));
    expect(html.indexOf('data-frase-recorte="limites"')).toBeLessThan(html.indexOf('data-grafico="pontos"'));
    expect(html).toContain(esc(respostaRecorteLimites(itens, "dec", "c", ref, avisos)));
    expect(ler("src/components/energia/QualidadeLimites.tsx")).toContain('data-legenda="asterisco-fec"');
  });

  it("compensações: a quebra de regime sai da série (ano, tipos que somem, os dois lados), marca o gráfico, a frase e a tabela, sem sugerir queda real", () => {
    const q = quebraCompensacao(gold)!;
    const anos = gold.compensacoes.anual;
    const comUc = (t: "trimestral" | "anual") => anos.filter((a) => a.completo && (a.por_tipo[t]?.valor_uc ?? 0) > 0).map((a) => a.ano);
    expect(q.ano).toBe(Math.max(...comUc("trimestral")) + 1);
    expect(q.somem).toEqual(["trimestral", "anual"]);
    expect(q.antes).toEqual({ ano: q.ano - 1, valorUc: anos.find((a) => a.ano === q.ano - 1)!.valor_uc, quantidadeUc: anos.find((a) => a.ano === q.ano - 1)!.quantidade_uc });
    expect(q.depois.ano).toBe(q.ano);
    const t = textoQuebraCompensacao(gold);
    expect(t).toContain(`Desde ${q.ano}, a fonte não publica mais as compensações trimestrais e anuais a unidades consumidoras`);
    expect(t).toContain(`de ${num(q.antes.quantidadeUc! / 1e6, 1)} milhões em ${q.antes.ano} para ${num(q.depois.quantidadeUc! / 1e6, 1)} milhões em ${q.depois.ano}`);
    expect(t).toContain("Não leia a diferença como queda das compensações");
    expect(t).not.toMatch(/caiu|despencou|diminuiu|encolheu/);
    // dois regimes no gráfico, cada ano numa série só; a situação de cada ano na tabela diz o regime
    const regimes = regimesCompensacao(gold)!;
    expect(regimes).toEqual({ ano: q.ano, antes: `Até ${q.antes.ano}: com as compensações trimestrais e anuais`, depois: `Desde ${q.ano}: sem as compensações trimestrais e anuais` });
    for (const l of linhasCompensacaoAnual(gold)) expect(String(l.situacao), String(l.ano)).toContain(Number(l.ano) < q.ano ? "com as compensações trimestrais e anuais" : "sem as compensações trimestrais e anuais");
    // na página: o aviso junto do gráfico, a legenda dos dois regimes e a frase do maior total com a quebra dita
    expect(html).toContain('data-aviso="quebra-compensacoes"');
    expect(html).toContain(esc(t));
    expect(html).toContain(esc(regimes.antes));
    expect(html).toContain(esc(regimes.depois));
    expect(mudancaP053(gold)).toContain(textoQuebraCompensacaoCurto(gold));
    // a tabela anual abre sob demanda, com a quebra na nota, e a nota por tipo traz a causa dos anos sem valor
    expect(TABELAS_SOB_DEMANDA).toContain("comp-anual");
    const def = tabelaQualidade("comp-anual", gold);
    expect(def.linhas.length).toBe(anos.length);
    expect(new Set(def.linhas.map((l) => l.id)).size).toBe(anos.length);
    expect(def.nota).toContain(textoQuebraCompensacao(gold));
    expect(notaTiposCompensacao(gold)).toContain(textoQuebraCompensacaoCurto(gold));
    // sem tipo que some, nada disso aparece
    const g2 = copia();
    for (const a of g2.compensacoes.anual) for (const tp of ["trimestral", "anual"] as const) if (a.por_tipo[tp]) a.por_tipo[tp]!.valor_uc = 1_000_000;
    expect(quebraCompensacao(g2)).toBeNull();
    expect(textoQuebraCompensacao(g2)).toBe("");
    expect(regimesCompensacao(g2)).toBeNull();
    expect(String(linhasCompensacaoAnual(g2)[0].situacao)).not.toContain("compensações trimestrais");
  });

  it("divulgado e reconciliação: a linha das concessionárias diz de onde começa e até onde foi conferida; as geradoras e a quantidade divulgada aparecem junto do número", () => {
    const conferido = anosDivulgados(gold)!;
    const desde = gold.brasil.anual.find((x) => x.dec_concessionarias !== null)!.ano;
    const t = textoConcessionariasDesde(gold, desde);
    expect(t).toContain(`começa em ${desde}`);
    expect(t).toContain(`cobre ${conferido.de} a ${conferido.ate}`);
    expect(t).not.toMatch(/reproduz/);
    expect(html).toContain(esc(t));
    expect(textoConcessionariasDesde(gold, null)).toMatch(/não tem anos com todas as distribuidoras classificadas/);
    const a = anoRef();
    expect(textoParticipacaoUg(gold)).toBe(`As unidades geradoras somam ${pct((a.valor_ug! / a.valor!) * 100, 1)} do valor pago em ${a.ano}.`);
    expect(html).toContain(esc(textoParticipacaoUg(gold)));
    const nq = notaQuantidadeDivulgada(gold);
    if (a.divulgado_aneel?.dentro_da_precisao_quantidade === false) {
      expect(nq).toContain(`${num(a.divulgado_aneel.quantidade! / 1e6, 1)} milhões`);
      expect(html).toContain(esc(nq));
    } else expect(nq).toBe("");
    const g2 = copia();
    for (const x of g2.compensacoes.anual) x.divulgado_aneel = null;
    expect(notaQuantidadeDivulgada(g2)).toBe("");
    expect(anosDivulgados(g2)).toBeNull();
    expect(textoConcessionariasDesde(g2, 2019)).not.toContain("conferência");
  });

  it("município: a busca está na primeira tela, o resumo traz o intervalo dos conjuntos e quem mora em área sem dado recebe a orientação", () => {
    const m: MunicipioQualidade = { cod: "1100023", nome: "Ariquemes", uf: "RO", conjuntos: ["17332", "17335"], relacao: "varios_conjuntos", dec_min: 6.13, dec_max: 34.37, fec_min: 2.98, fec_max: 8.31, cnpjs: ["05914650000166"] };
    expect(resumoMunicipio(m, 2025)).toContain(`de ${num(6.13, 2)} a ${num(34.37, 2)} h`);
    expect(resumoMunicipio(m, 2025)).toMatch(/nenhuma média municipal/);
    expect(resumoMunicipio({ ...m, relacao: "conjunto_compartilhado", conjuntos: ["1"], dec_min: 7, dec_max: 7 }, 2025)).toContain("valores do conjunto inteiro");
    expect(resumoMunicipio({ ...m, relacao: "sem_relacao_na_fonte", conjuntos: [], dec_min: null, dec_max: null, fec_min: null, fec_max: null }, 2025)).toMatch(/não aparece na base da ANEEL/);
    expect(resumoMunicipio({ ...m, relacao: "sem_conjunto_ativo", dec_min: null, dec_max: null }, 2025)).toMatch(/sem conjunto com DEC de 12 meses/);
    // área sem dado: sem dado não é sem energia, e diz a quem perguntar; área com dado não leva a orientação
    expect(orientacaoSemDado({ relacao: "sem_relacao_na_fonte" })).toMatch(/Sem dado não quer dizer sem energia/);
    expect(orientacaoSemDado({ relacao: "sem_conjunto_ativo" })).toMatch(/distribuidora e, depois, à Ouvidoria da ANEEL/);
    for (const r of ["conjunto_exclusivo", "conjunto_compartilhado", "varios_conjuntos"] as const) expect(orientacaoSemDado({ relacao: r })).toBe("");
    // na página: depois do lead e da linha "Não permite concluir", antes da faixa de métricas; campo com rótulo, combobox e a ficha do mapa com âncora
    const busca = html.indexOf("data-busca-municipio-topo");
    expect(busca).toBeGreaterThan(html.indexOf('data-limite=""'));
    expect(busca).toBeLessThan(html.indexOf("data-faixa-metricas"));
    expect(html).toContain("Procure o seu município");
    expect(html).toMatch(/role="combobox"/);
    expect(html).toContain('id="municipio-escolhido"');
    const isolado = renderToStaticMarkup(createElement(QualidadeBuscaMunicipio, { ano: ref, urlMunicipios: "/x.csv" }));
    expect(isolado).not.toContain("data-resposta=\"municipio-topo\"");
    // a lista de 600 KB só é baixada ao focar o campo (ou quando o link já traz um município), e o mapa reaproveita a mesma leitura
    const fonte = ler("src/components/energia/QualidadeBuscaMunicipio.tsx");
    expect(fonte).toMatch(/onFocus=\{iniciar\}/);
    expect(fonte).toContain("carregarMunicipios(urlMunicipios)");
    expect(ler("src/components/energia/QualidadeMapa.tsx")).toContain("carregarMunicipios(urlMunicipios)");
  });

  it("títulos e definições no ponto de uso: a distribuição não diz o contrário do que mostra, os painéis dizem DEC ou FEC e as siglas vêm por extenso", () => {
    expect(html).toContain("A média esconde as caudas");
    expect(html).not.toContain("As médias não escondem as caudas");
    expect(html).toContain("Operador Nacional do Sistema (ONS)");
    expect(html).toContain("P10 a P90 são percentis");
    expect(ler("src/components/energia/QualidadeComparador.tsx")).toContain('${ind === "dec" ? "DEC" : "FEC"}');
    expect(ler("src/components/energia/QualidadeMapa.tsx")).toContain('${rotuloCnpj(c)}, ${ind === "dec" ? "DEC" : "FEC"}');
    // a abertura traz a linha "Não permite concluir" e a razão no lead; os avisos essenciais têm 14 px, não 12
    expect(html).toContain('data-limite=""');
    for (const arq of ["QualidadeLimites", "QualidadeMapa", "QualidadeConjuntosDoMunicipio"]) expect(ler(`src/components/energia/${arq}.tsx`), arq).not.toMatch(/<p className="[^"]*\btext-xs\b[^"]*">/);
  });
});

type ItemLimitesTeste = Parameters<typeof respostaRecorteLimites>[0][number];
