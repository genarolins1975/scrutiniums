import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { num } from "@/lib/energia/formato";
import { REGRAS_QUALIDADE_EN, UNIVERSO_QUALIDADE_EN, traducaoExata } from "@/lib/energia/i18n/qualidade-perdas";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import {
  arquivoConjuntosDoAno,
  avisosFec,
  conjuntosDoCsv,
  fecComCoberturaParcial,
  mesesComFecParcial,
  paraLeitor,
  resumoSemRazaoFec,
} from "@/lib/energia/qualidade";
import type { QualidadeGold } from "@/lib/energia/tipos-qualidade";

/**
 * Leituras de servidor que as duas páginas de Qualidade fazem na geração (a entrada e Comparar distribuidoras): arquivos publicados
 * lidos do disco, os avisos de FEC de cobertura parcial, os conjuntos sem razão de FEC e o texto da gold escrito para o leitor. Uma
 * função só para as duas páginas, para o mesmo número não sair de duas contas.
 */

export const URL_SERIE_QUALIDADE = "/energia/series/qualidade_distribuidoras_serie.json";
export const URL_MUNICIPIOS_QUALIDADE = "/energia/series/qualidade_municipios.csv";

/** Tamanho de um arquivo publicado, lido no build (nunca escrito à mão). */
export function tamanhoPublico(url: string): string {
  try {
    const b = statSync(join(process.cwd(), "public", url)).size;
    return b >= 1e6 ? `${num(b / 1e6, 1)} MB` : `${num(b / 1e3, 0)} KB`;
  } catch {
    return tx("tamanho não disponível", "size not available");
  }
}

/** Texto de um arquivo publicado, lido no servidor na geração da página; nulo se o arquivo não existir (a página diz o que falta e segue). */
export function lerPublico(url: string): string | null {
  try {
    return readFileSync(join(process.cwd(), "public", url), "utf-8");
  } catch {
    return null;
  }
}

/** FEC de cobertura parcial: a regra usa só a gold; os meses de cobertura baixa vêm do CSV mensal por distribuidora, lido aqui no servidor. */
export function avisosFecDaPagina(g: QualidadeGold) {
  const candidatos = fecComCoberturaParcial(g).map((x) => x.cnpj);
  const mensal = candidatos.length ? lerPublico("/energia/series/qualidade_distribuidoras_mensal.csv") : null;
  return avisosFec(g, mensal ? mesesComFecParcial(mensal, candidatos, g.ano_referencia) : {});
}

/** Conjuntos sem razão de FEC (menos de 12 meses de FEC): a contagem de conjuntos acima do limite de FEC é um mínimo. */
export function semRazaoFecDaPagina(g: QualidadeGold) {
  const csv = lerPublico(arquivoConjuntosDoAno(g.conjuntos.ano));
  return csv ? resumoSemRazaoFec(conjuntosDoCsv(csv, g.conjuntos.ano), g.conjuntos.ano) : null;
}

/** Regras e universos da gold escritos para o leitor (sem nome de campo nem termo interno); em inglês, pela tabela exata ou marcados como só em português. */
export function textosDaGold(g: QualidadeGold) {
  const idioma = idiomaEnergia();
  const daGold = (x: string, tabela: Readonly<Record<string, string>>, regiao: string): ReactNode =>
    idioma === "en" ? (traducaoExata(x, tabela) ?? <TrechoPortugues regiao={regiao}>{paraLeitor(x)}</TrechoPortugues>) : paraLeitor(x);
  const regras = Object.fromEntries(Object.entries(g.regras).map(([k, x]) => [k, daGold(x, REGRAS_QUALIDADE_EN, `regra-${k}`)])) as Record<keyof QualidadeGold["regras"], ReactNode>;
  const universo = {
    principal: daGold(g.brasil.universo.principal, UNIVERSO_QUALIDADE_EN, "universo-principal"),
    concessionarias: daGold(g.brasil.universo.concessionarias, UNIVERSO_QUALIDADE_EN, "universo-concessionarias"),
  };
  return { daGold, regras, universo };
}
