import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lerGold } from "./gold";
import { provenienciaLegivel } from "./mercado";
import type { ConferenciaManifesto, MetricaPublicada, VereditoDoArquivo } from "./dados";
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

/* ---------------------------------------------------------------- estado de cada arquivo publicado */

export type ProblemaDoArquivo = { tipo: string; resultado: "ressalva" | "reprovado"; detalhe: string };

export type ValidacaoDoCsv = { veredito: "aprovado" | "ressalva" | "reprovado"; problemas: ProblemaDoArquivo[] };

const GRAVIDADE: Record<ValidacaoDoCsv["veredito"], number> = { aprovado: 0, ressalva: 1, reprovado: 2 };

let cacheValidacoes: Map<string, ValidacaoDoCsv> | null = null;

/**
 * Veredito de cada CSV publicado, lido de dados_validacoes.csv (uma linha por checagem): o pior resultado das checagens do arquivo,
 * por nome de arquivo. CSV que o relatório não cobre (publicado depois da validação) não está no mapa: o estado dele é "sem validação
 * registrada", nunca "aprovado" por omissão.
 */
export function validacoesDosCsv(raiz = join(process.cwd(), "public")): Map<string, ValidacaoDoCsv> {
  if (cacheValidacoes) return cacheValidacoes;
  const m = new Map<string, ValidacaoDoCsv>();
  try {
    const linhas = lerCsvComAspas(readFileSync(join(raiz, "energia/series/dados_validacoes.csv"), "utf-8"));
    const cab = linhas[0] ?? [];
    const col = (n: string) => cab.indexOf(n);
    const [iId, iAlvo, iTipo, iRes, iDet] = [col("id"), col("alvo"), col("tipo"), col("resultado"), col("detalhe")];
    if ([iId, iAlvo, iTipo, iRes, iDet].some((i) => i < 0)) throw new Error("cabeçalho inesperado");
    for (const l of linhas.slice(1)) {
      if (!(l[iId] ?? "").startsWith("csv:")) continue;
      const nome = l[iAlvo];
      const r = l[iRes];
      if (!nome || (r !== "aprovado" && r !== "ressalva" && r !== "reprovado")) continue;
      const atual = m.get(nome) ?? { veredito: "aprovado" as const, problemas: [] };
      if (GRAVIDADE[r] > GRAVIDADE[atual.veredito]) atual.veredito = r;
      if (r !== "aprovado") atual.problemas.push({ tipo: l[iTipo], resultado: r, detalhe: l[iDet] });
      m.set(nome, atual);
    }
  } catch {
    // sem o CSV de validações, nenhum arquivo ganha veredito: todos ficam "sem validação registrada"
  }
  cacheValidacoes = m;
  return m;
}

export type ReleituraDoCsv = { linhas: number; colunas: number; divergentes: number };

/** Relê um CSV publicado com a leitura de aspas do projeto (ponto e vírgula dentro de campo entre aspas não separa coluna). */
export function releituraDoCsv(caminho: string, raiz = join(process.cwd(), "public")): ReleituraDoCsv | null {
  try {
    const t = lerCsvComAspas(readFileSync(join(raiz, caminho), "utf-8"));
    if (!t.length) return null;
    const colunas = t[0].length;
    return { linhas: t.length - 1, colunas, divergentes: t.slice(1).filter((l) => l.length !== colunas).length };
  } catch {
    return null;
  }
}

export type EstadoDoArquivo = {
  caminho: string;
  veredito: VereditoDoArquivo;
  problemas: ProblemaDoArquivo[];
  /** Só nos CSV reprovados: o arquivo que está publicado relido agora, com a leitura que respeita aspas. */
  releitura: ReleituraDoCsv | null;
  /** Só nos CSV reprovados: a validação julgou outra versão do arquivo (impressão digital diferente da publicada). */
  outraVersao: { julgada: string; publicada: string; julgadaEm: string | null } | null;
};

/**
 * Estado de um arquivo publicado para quem baixa: o veredito da validação automática e, quando a validação reprova um CSV, o que a
 * releitura do arquivo publicado diz e se a validação julgou a mesma versão (a impressão digital que a validação registra é comparada
 * com a do manifesto). Nada é corrigido aqui: a página mostra os dois registros lado a lado.
 */
export function estadoDoArquivo(caminho: string, pub: PublicacaoGold | null, m: ManifestoGold | null, raiz = join(process.cwd(), "public")): EstadoDoArquivo {
  const base: EstadoDoArquivo = { caminho, veredito: "nao_se_aplica", problemas: [], releitura: null, outraVersao: null };
  if (!caminho.startsWith("/energia/series/") || !caminho.endsWith(".csv")) return base;
  const v = validacoesDosCsv(raiz).get(caminho.split("/").pop() ?? "");
  if (!v) return { ...base, veredito: "sem_validacao" };
  const out: EstadoDoArquivo = { ...base, veredito: v.veredito, problemas: v.problemas };
  if (v.veredito === "reprovado") {
    out.releitura = releituraDoCsv(caminho, raiz);
    const julgada = pub?.evidencias.checagens_reprovadas?.fonte.arquivos?.find((a) => a.recurso === caminho);
    const publicada = m?.arquivos.find((a) => a.caminho === caminho)?.sha256;
    if (julgada?.sha256 && publicada && julgada.sha256 !== publicada) out.outraVersao = { julgada: julgada.sha256, publicada, julgadaEm: julgada.capturado_em ?? null };
  }
  return out;
}

/* ---------------------------------------------------------------- versão do código de cada base */

export type VersaoDoCodigo = { arquivo: string; geradoEm: string | null; versao: string | null };

/**
 * Versão do código (commit curto, com o sufixo "+alterado" quando havia mudança ainda não registrada) que gerou cada base publicada,
 * lida do campo `versao_codigo` de cada gold da lista de arquivos. Base sem o campo fica com `versao` nula: a página diz que não registra.
 */
export function versoesDoCodigoDasBases(m: ManifestoGold): VersaoDoCodigo[] {
  return m.arquivos
    .filter((a) => a.tipo === "gold")
    .map((a) => {
      const nome = a.caminho.split("/").pop() ?? a.caminho;
      const g = lerGold<{ versao_codigo?: string | null }>(nome);
      return { arquivo: nome, geradoEm: a.gerado_em ?? null, versao: g?.versao_codigo ?? null };
    })
    .sort((x, y) => x.arquivo.localeCompare(y.arquivo));
}
