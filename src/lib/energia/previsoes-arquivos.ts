import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Leitura, no build, do CSV do arquivo de emissões que o pipeline publica ao lado
 * da gold (public/energia/series/previsoes_emissoes.csv). Só para Server
 * Components: a página passa ao componente cliente apenas o recorte que mostra.
 *
 * Por que o CSV, e não as partições JSON: o CSV é exatamente o download do
 * painel, então a tabela, o gráfico e o arquivo baixado saem das mesmas linhas
 * (seção 11.7, equivalência entre gráfico, tabela e exportação). As partições
 * mensais (previsoes_emissoes_AAAA-MM.json) continuam como o registro completo,
 * com o encadeamento por sha256, e são citadas na auditoria.
 *
 * O pipeline escreve o CSV sem aspas (base.escreve_csv: ';' como separador, ponto
 * decimal, vazio para ausência). Linha com número de campos diferente do
 * cabeçalho não é adivinhada: fica fora e é contada em `invalidas`, que a página
 * declara.
 */
const DIR = join(process.cwd(), "public");

export type CsvLido = { cabecalho: string[]; linhas: Record<string, string>[]; invalidas: number };

/** Só arquivos do próprio módulo, sem sair de public/energia/series. */
export function lerCsvPrevisoes(url: string): CsvLido | null {
  if (!/^\/energia\/series\/previsoes_[a-z0-9_-]+\.csv$/.test(url)) return null;
  let texto: string;
  try {
    texto = readFileSync(join(DIR, url), "utf-8");
  } catch {
    return null;
  }
  return interpretarCsv(texto);
}

/** Interpreta o texto do CSV (sem aspas; BOM e CRLF tolerados). */
export function interpretarCsv(texto: string): CsvLido {
  const ls = texto.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.length > 0);
  const cabecalho = (ls[0] ?? "").split(";");
  const linhas: Record<string, string>[] = [];
  let invalidas = 0;
  for (const l of ls.slice(1)) {
    const campos = l.split(";");
    if (campos.length !== cabecalho.length) {
      invalidas++;
      continue;
    }
    linhas.push(Object.fromEntries(cabecalho.map((c, i) => [c, campos[i]])));
  }
  return { cabecalho, linhas, invalidas };
}
