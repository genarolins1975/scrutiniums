import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lerGold } from "./gold";
import { provenienciaLegivel } from "./mercado";
import type { ConferenciaManifesto, MetricaPublicada } from "./dados";
import type { MercadoGold } from "./tipos-mercado";
import type { ManifestoGold, PublicacaoGold } from "./tipos-dados";
import type { Proveniencia } from "./tipos";

/**
 * Leituras de disco das páginas de Dados e Metodologia, só no servidor (build): as golds
 * publicacao.json, manifesto.json e metricas.json, a conferência do manifesto contra os
 * arquivos entregues e a proveniência com as datas escritas como na página.
 */

export function publicacaoDados(): PublicacaoGold | null {
  const g = lerGold<PublicacaoGold>("publicacao.json");
  return g && g.disponivel ? g : null;
}

export function manifestoDados(): ManifestoGold | null {
  const g = lerGold<ManifestoGold>("manifesto.json");
  return g && g.disponivel ? g : null;
}

/** Nome de conjunto da fonte sem o nome técnico da consulta ("(API CKAN package_search)") nem o caminho de pasta ("em public/energia"). */
const nomeDeFonteLegivel = (t: string): string => t.replace(/\s*\(API CKAN package_search\)/g, "").replace(/ em public\/energia\b/g, "");

export function provenienciaDados(p: Proveniencia): Proveniencia {
  const q = provenienciaLegivel(p);
  return { ...q, fonte: { ...q.fonte, dataset: nomeDeFonteLegivel(q.fonte.dataset) } };
}

/**
 * Confere, no build, o sha256 e o tamanho de cada arquivo do manifesto com o arquivo que a
 * publicação entrega. Divergência não é escondida: a página mostra o número e a lista.
 */
export function conferirManifestoNoDisco(m: ManifestoGold, raiz = join(process.cwd(), "public")): ConferenciaManifesto {
  const divergentes: string[] = [];
  const ausentes: string[] = [];
  let conferidos = 0;
  for (const a of m.arquivos) {
    try {
      const b = readFileSync(join(raiz, a.caminho));
      if (b.length === a.bytes && createHash("sha256").update(b).digest("hex") === a.sha256) conferidos++;
      else divergentes.push(a.caminho);
    } catch {
      ausentes.push(a.caminho);
    }
  }
  return { total: m.arquivos.length, conferidos, divergentes, ausentes, foraDoManifesto: m.fora_do_manifesto.map((x) => x.caminho) };
}

export function metricasPublicadas(): MetricaPublicada[] {
  const g = lerGold<{ disponivel: boolean; metricas: MetricaPublicada[] }>("metricas.json");
  return g && g.disponivel ? g.metricas : [];
}

/** CSV com aspas duplas (RFC 4180) e separador ";" como o pipeline grava dados_catalogo.csv: campo entre aspas pode ter ";" e "" . */
export function lerCsvComAspas(texto: string, sep = ";"): string[][] {
  const linhas: string[][] = [];
  let campo = "";
  let linha: string[] = [];
  let aspas = false;
  let inicio = true; // true no começo de um campo: só aí a aspa abre um campo entre aspas; no meio de um campo ela é um caractere
  const t = texto.replace(/^\uFEFF/, "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"' && inicio) {
      aspas = true;
      inicio = false;
    } else if (c === sep) {
      linha.push(campo);
      campo = "";
      inicio = true;
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      linha.push(campo);
      campo = "";
      inicio = true;
      if (linha.length > 1 || linha[0] !== "") linhas.push(linha);
      linha = [];
    } else {
      campo += c;
      inicio = false;
    }
  }
  if (campo !== "" || linha.length) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas;
}

let cacheDescricoes: Map<string, string> | null = null;

/**
 * Descrição de cada conjunto como está publicada em public/energia/series/dados_catalogo.csv (a íntegra que o catálogo
 * compacto da ficha não carrega), por id da entrada. Leitura de disco do arquivo que a própria publicação entrega; nenhuma
 * requisição à fonte.
 */
export function descricoesCompletas(raiz = join(process.cwd(), "public")): Map<string, string> {
  if (cacheDescricoes) return cacheDescricoes;
  const m = new Map<string, string>();
  try {
    const linhas = lerCsvComAspas(readFileSync(join(raiz, "energia/series/dados_catalogo.csv"), "utf-8"));
    const cab = linhas[0] ?? [];
    const iId = cab.indexOf("id");
    const iDesc = cab.indexOf("descricao");
    if (iId >= 0 && iDesc >= 0) for (const l of linhas.slice(1)) if (l[iId]) m.set(l[iId], l[iDesc] ?? "");
  } catch {
    // sem o CSV, a ficha fica com o texto guardado no catálogo
  }
  cacheDescricoes = m;
  return m;
}

/** Registro de acesso à CCEE da gold de Mercado (decisão do responsável e capturas feitas no portal), ou nulo sem a gold. */
export function acessoCceeDados(): MercadoGold["acesso_ccee"] | null {
  const g = lerGold<MercadoGold>("mercado.json");
  return g?.acesso_ccee ?? null;
}

/** Instante em que metricas.json (o catálogo de indicadores) foi gerado. */
export function metricasGeradoEm(): string | null {
  const g = lerGold<{ disponivel: boolean; gerado_em: string }>("metricas.json");
  return g && g.disponivel ? g.gerado_em : null;
}
