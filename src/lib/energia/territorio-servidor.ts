/**
 * Leituras, no servidor, de arquivos publicados que a página de Minha região precisa na hora de montar o HTML: o arquivo de usinas que o
 * explorador carrega sob demanda no navegador (para contar, por UF, as usinas em operação sem os registros de até 10 kW, a regra da contagem
 * municipal, e dizer quantas usinas estão declaradas em mais de uma UF), o arquivo anual de perdas por distribuidora (a energia sobre a qual cada
 * taxa foi calculada) e o sha256 atual dos arquivos que o índice leu. Os arquivos são os publicados em public/energia; nada é recalculado além
 * da contagem das linhas deles e do hash. Só a página (servidor) importa este módulo: ele usa `node:fs` e `node:crypto`.
 */
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { lerCsv } from "./qualidade";
import { usinasDoJson, type BasePerdas, type PerdasDaFonte, type UsinaT } from "./territorio";
import type { InsumoTerritorio, UsinasTerritorio } from "./tipos-territorio";

const cache = new Map<string, { mtime: number; limiteKw: number; usinas: UsinaT[] }>();

/** As usinas do arquivo publicado (caminho como na gold, "/energia/series/territorio_usinas.json"); null se o arquivo faltar ou não ler. */
export function lerUsinasDoServidor(caminhoPublico: string, limiteKw: number): UsinaT[] | null {
  try {
    const caminho = join(process.cwd(), "public", caminhoPublico.replace(/^\/+/, ""));
    const mtime = statSync(caminho).mtimeMs;
    const c = cache.get(caminho);
    if (c && c.mtime === mtime && c.limiteKw === limiteKw) return c.usinas;
    const usinas = usinasDoJson(JSON.parse(readFileSync(caminho, "utf-8")) as UsinasTerritorio, limiteKw);
    cache.set(caminho, { mtime, limiteKw, usinas });
    return usinas;
  } catch {
    return null;
  }
}

const cachePerdas = new Map<string, { mtime: number; ano: number; mapa: Map<string, PerdasDaFonte> }>();

/**
 * A energia sobre a qual cada distribuidora calcula a taxa de perdas do ano, lida do arquivo anual por distribuidora (`origem_injetada`), e a mesma perda
 * total sobre a energia injetada publicada. Por CNPJ; null se o arquivo faltar, não ler ou não tiver o ano.
 */
export function lerPerdasDaFonte(ano: number | null, raiz: string = process.cwd()): Map<string, PerdasDaFonte> | null {
  if (ano === null) return null;
  try {
    const caminho = join(raiz, "public", "energia", "series", "perdas_distribuidoras.csv");
    const mtime = statSync(caminho).mtimeMs;
    const c = cachePerdas.get(caminho);
    if (c && c.mtime === mtime && c.ano === ano) return c.mapa;
    const mapa = new Map<string, PerdasDaFonte>();
    for (const r of lerCsv(readFileSync(caminho, "utf-8"))) {
      if (r.ano !== String(ano)) continue;
      const base = r.origem_injetada as BasePerdas;
      if (base !== "publicada" && base !== "requerida" && base !== "mista") continue;
      const taxa = r.taxa_total_pct === "" ? NaN : Number(r.taxa_total_pct);
      const perdas = r.perdas_totais_mwh === "" ? NaN : Number(r.perdas_totais_mwh);
      const publicada = r.injetada_publicada_mwh === "" ? NaN : Number(r.injetada_publicada_mwh);
      mapa.set(r.cnpj, {
        base,
        taxa_pct: Number.isFinite(taxa) ? taxa : null,
        taxa_publicada_pct: Number.isFinite(perdas) && Number.isFinite(publicada) && publicada > 0 ? (100 * perdas) / publicada : null,
      });
    }
    const resultado = mapa.size ? mapa : null;
    if (resultado) cachePerdas.set(caminho, { mtime, ano, mapa: resultado });
    return resultado;
  } catch {
    return null;
  }
}

/** Situação de um arquivo que o índice leu: o sha256 do arquivo servido hoje contra o que o índice registrou. */
export type SituacaoInsumo = {
  chave: string;
  /** true: o arquivo servido é o que o índice leu; false: o arquivo mudou depois do índice; null: o arquivo não pôde ser lido agora. */
  confere: boolean | null;
  sha256Atual: string | null;
  bytesAtual: number | null;
  /** Para o arquivo que mudou: quando o próprio arquivo diz ter sido gerado (campo `gerado_em` dos JSON das golds); null nos CSV e quando não há. */
  regeradoEm: string | null;
};

const cacheSha = new Map<string, { mtime: number; size: number; sha: string; regerado: string | null }>();

/** O `gerado_em` que uma gold JSON traz perto do começo; null para o que não é JSON ou não o traz. */
export function geradoEmDoArquivo(conteudo: Buffer, url: string): string | null {
  if (!/\.json$/i.test(url)) return null;
  const m = /"gerado_em"\s*:\s*"([^"]{10,40})"/.exec(conteudo.subarray(0, 16384).toString("utf-8"));
  return m ? m[1] : null;
}

/**
 * Recalcula, na hora de montar a página, o sha256 de cada arquivo que o índice leu e compara com o registrado nele. O índice só é regerado quando a
 * rotina de geração dos dados roda; um módulo regerado antes dela deixa o arquivo servido diferente do que o índice leu, e a diferença aparece aqui.
 */
export function situacaoDosInsumos(insumos: readonly InsumoTerritorio[], raiz: string = process.cwd()): SituacaoInsumo[] {
  return insumos.map((x) => {
    try {
      const caminho = join(raiz, "public", x.url.replace(/^\/+/, ""));
      const st = statSync(caminho);
      let c = cacheSha.get(caminho);
      if (!c || c.mtime !== st.mtimeMs || c.size !== st.size) {
        const conteudo = readFileSync(caminho);
        c = { mtime: st.mtimeMs, size: st.size, sha: createHash("sha256").update(conteudo).digest("hex"), regerado: geradoEmDoArquivo(conteudo, x.url) };
        cacheSha.set(caminho, c);
      }
      const confere = c.sha === x.sha256;
      return { chave: x.chave, confere, sha256Atual: c.sha, bytesAtual: st.size, regeradoEm: confere ? null : c.regerado };
    } catch {
      return { chave: x.chave, confere: null, sha256Atual: null, bytesAtual: null, regeradoEm: null };
    }
  });
}
