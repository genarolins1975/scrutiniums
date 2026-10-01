import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  Distribuidora,
  QualidadeGold,
  QualidadeMapaGold,
  QualidadeSeriesDistribuidorasGold,
  ValidacaoQualidade,
} from "@/lib/energia/tipos-qualidade";

/**
 * Contrato da gold do módulo Qualidade (P051 a P054) do lado da interface: o tipo
 * TypeScript é espelho exato da gold (as listas de chaves abaixo são conferidas pelo
 * compilador contra o tipo e, no teste, contra o JSON publicado), e a contagem de conjuntos
 * acima do limite é a mesma na gold e no CSV de download (equivalência tabela × exportação).
 */
const raiz = process.cwd();
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

function linhasCsv(nome: string): Record<string, string>[] {
  const [cab, ...linhas] = readFileSync(join(raiz, "public/energia/series", nome), "utf-8").trim().split("\n");
  const campos = cab.split(";");
  return linhas.map((l) => Object.fromEntries(l.split(";").map((v, i) => [campos[i], v])));
}

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
});

const caminhoMapa = join(raiz, "public/energia/series/qualidade_mapa.json");
const caminhoSerie = join(raiz, "public/energia/series/qualidade_distribuidoras_serie.json");

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
