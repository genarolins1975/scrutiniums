import { createHash } from "node:crypto";
import { ESQUEMA_GOLD, type ArquivoGold, type ManifestoGold, type PonteiroGold } from "./tipos";

/**
 * Regras do manifesto e do ponteiro, sem rede e sem disco. O gerador scripts/gold-manifesto.mjs repete calcularEdicao
 * e caminhoObjeto; src/tests/gold-leitor.test.ts confere que os dois lados chegam ao mesmo resultado.
 */

const HEX64 = /^[0-9a-f]{64}$/;
const DOMINIO = /^[a-z0-9][a-z0-9-]*$/;

export function sha256Hex(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Nome da pasta do domínio em public/: minúsculas, dígitos e hífen. */
export function dominioValido(dominio: string): boolean {
  return typeof dominio === "string" && DOMINIO.test(dominio);
}

/**
 * Caminho relativo à pasta do domínio, com "/" como separador. Recusa caminho absoluto, segmento vazio, "." e "..",
 * barra invertida e caractere de controle: nada que saia da pasta do domínio ou mude de sentido entre sistemas.
 */
export function caminhoValido(caminho: string): boolean {
  if (typeof caminho !== "string" || caminho.length === 0 || caminho.length > 1024) return false;
  if (caminho.includes("\\") || /[\u0000-\u001f\u007f]/.test(caminho)) return false;
  return caminho.split("/").every((s) => s.length > 0 && s !== "." && s !== "..");
}

/** Ordem do manifesto: unidades de código, igual em qualquer máquina e idioma (não usa localeCompare). */
export function ordenarArquivos<T extends { caminho: string }>(arquivos: readonly T[]): T[] {
  return [...arquivos].sort((a, b) => (a.caminho < b.caminho ? -1 : a.caminho > b.caminho ? 1 : 0));
}

/**
 * Identidade da edição: SHA-256 das linhas "caminho<TAB>bytes<TAB>sha256<LF>" na ordem do manifesto. Não entra data
 * nem nome de máquina: publicar duas vezes os mesmos bytes dá a mesma edição, e a segunda publicação é nula.
 */
export function calcularEdicao(arquivos: readonly ArquivoGold[]): string {
  const h = createHash("sha256");
  for (const a of ordenarArquivos(arquivos)) h.update(`${a.caminho}\t${a.bytes}\t${a.sha256}\n`);
  return h.digest("hex");
}

/**
 * Endereço imutável do conteúdo dentro do domínio: o hash decide o nome, a extensão só informa o tipo ao servidor.
 * Arquivos iguais em edições diferentes ocupam um objeto só.
 */
export function caminhoObjeto(arquivo: Pick<ArquivoGold, "caminho" | "sha256">): string {
  const nome = arquivo.caminho.slice(arquivo.caminho.lastIndexOf("/") + 1);
  const ponto = nome.lastIndexOf(".");
  const ext = ponto > 0 ? nome.slice(ponto).toLowerCase() : "";
  return `objetos/${arquivo.sha256}${/^\.[a-z0-9]{1,10}$/.test(ext) ? ext : ""}`;
}

export function caminhoManifesto(edicao: string): string {
  return `manifestos/${edicao}.json`;
}

export const CAMINHO_PONTEIRO = "corrente.json";

function ehObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function inteiroNaoNegativo(v: unknown): v is number {
  return typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
}

/** Devolve o manifesto conferido ou lança Error com o motivo; quem chama embrulha em ErroGold. */
export function validarManifesto(bruto: unknown, dominio: string): ManifestoGold {
  if (!ehObjeto(bruto)) throw new Error("manifesto não é um objeto JSON");
  if (bruto.esquema !== ESQUEMA_GOLD) throw new Error(`esquema ${String(bruto.esquema)} desconhecido (esperado ${ESQUEMA_GOLD})`);
  if (bruto.dominio !== dominio) throw new Error(`manifesto é do domínio ${String(bruto.dominio)}, não de ${dominio}`);
  if (typeof bruto.edicao !== "string" || !HEX64.test(bruto.edicao)) throw new Error("edição ausente ou malformada");
  if (!Array.isArray(bruto.arquivos)) throw new Error("lista de arquivos ausente");
  const arquivos: ArquivoGold[] = [];
  const vistos = new Set<string>();
  for (const item of bruto.arquivos as unknown[]) {
    if (!ehObjeto(item)) throw new Error("entrada de arquivo malformada");
    const { caminho, bytes, sha256 } = item;
    if (typeof caminho !== "string" || !caminhoValido(caminho)) throw new Error(`caminho inválido no manifesto: ${String(caminho)}`);
    if (!inteiroNaoNegativo(bytes)) throw new Error(`tamanho inválido em ${caminho}`);
    if (typeof sha256 !== "string" || !HEX64.test(sha256)) throw new Error(`sha256 inválido em ${caminho}`);
    if (vistos.has(caminho)) throw new Error(`caminho repetido no manifesto: ${caminho}`);
    vistos.add(caminho);
    arquivos.push({ caminho, bytes, sha256 });
  }
  const edicao = calcularEdicao(arquivos);
  if (edicao !== bruto.edicao) throw new Error(`edição declarada ${bruto.edicao} não corresponde à lista de arquivos (${edicao})`);
  const total = arquivos.reduce((s, a) => s + a.bytes, 0);
  if (bruto.total_arquivos !== arquivos.length) throw new Error("total_arquivos não corresponde à lista");
  if (bruto.total_bytes !== total) throw new Error("total_bytes não corresponde à lista");
  return { esquema: ESQUEMA_GOLD, dominio, edicao, total_arquivos: arquivos.length, total_bytes: total, arquivos: ordenarArquivos(arquivos) };
}

/** Devolve o ponteiro conferido ou lança Error com o motivo. */
export function validarPonteiro(bruto: unknown, dominio: string): PonteiroGold {
  if (!ehObjeto(bruto)) throw new Error("ponteiro não é um objeto JSON");
  if (bruto.esquema !== ESQUEMA_GOLD) throw new Error(`esquema ${String(bruto.esquema)} desconhecido (esperado ${ESQUEMA_GOLD})`);
  if (bruto.dominio !== dominio) throw new Error(`ponteiro é do domínio ${String(bruto.dominio)}, não de ${dominio}`);
  if (typeof bruto.edicao !== "string" || !HEX64.test(bruto.edicao)) throw new Error("edição ausente ou malformada");
  const m = bruto.manifesto;
  if (!ehObjeto(m)) throw new Error("referência ao manifesto ausente");
  if (m.caminho !== caminhoManifesto(bruto.edicao)) throw new Error("caminho do manifesto não corresponde à edição");
  if (!inteiroNaoNegativo(m.bytes) || m.bytes === 0) throw new Error("tamanho do manifesto inválido");
  if (typeof m.sha256 !== "string" || !HEX64.test(m.sha256)) throw new Error("sha256 do manifesto inválido");
  return {
    esquema: ESQUEMA_GOLD,
    dominio,
    edicao: bruto.edicao,
    manifesto: { caminho: m.caminho, bytes: m.bytes, sha256: m.sha256 },
    publicado_em: typeof bruto.publicado_em === "string" ? bruto.publicado_em : undefined,
    anterior: typeof bruto.anterior === "string" ? bruto.anterior : null,
  };
}

/** Ponteiro de uma edição, a partir dos bytes exatos do manifesto que será publicado. */
export function montarPonteiro(manifesto: ManifestoGold, bytesDoManifesto: Uint8Array, extra: { publicado_em?: string; anterior?: string | null } = {}): PonteiroGold {
  return {
    esquema: ESQUEMA_GOLD,
    dominio: manifesto.dominio,
    edicao: manifesto.edicao,
    manifesto: { caminho: caminhoManifesto(manifesto.edicao), bytes: bytesDoManifesto.byteLength, sha256: sha256Hex(bytesDoManifesto) },
    ...extra,
  };
}
