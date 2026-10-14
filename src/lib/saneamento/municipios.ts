import type { Municipio, TabelaMunicipios } from "./tipos";

/** Converte a tabela colunar (municipios.json) em registros. Puro: usado no servidor e no cliente. */
export function paraMunicipios(t: TabelaMunicipios): Municipio[] {
  return t.linhas.map((l) => {
    const r: Record<string, unknown> = {};
    t.campos.forEach((c, i) => {
      r[c] = l[i];
    });
    return r as Municipio;
  });
}

/** Une a uma lista municipal os campos de uma tabela complementar (primeira coluna: código IBGE). */
export function juntarComplemento(lista: Municipio[], extra: TabelaMunicipios | null): Municipio[] {
  if (!extra) return lista;
  const porId = new Map(extra.linhas.map((l) => [String(l[0]), l]));
  return lista.map((m) => {
    const l = porId.get(m.id);
    if (!l) return m;
    const r: Record<string, unknown> = { ...m };
    extra.campos.forEach((c, i) => {
      if (i > 0) r[c] = l[i];
    });
    return r as Municipio;
  });
}

/** Busca por nome sem acento e sem caixa; prefixo antes de trecho, depois maior população. */
export function normalizar(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type ItemIndice = [id: string, nome: string, uf: string];

export function buscarMunicipios(indice: readonly ItemIndice[], termo: string, limite = 12): ItemIndice[] {
  const q = normalizar(termo);
  if (q.length < 2) return [];
  const comUf = q.match(/^(.*?)\s+([a-z]{2})$/);
  const nomeQ = comUf ? comUf[1] : q;
  const ufQ = comUf ? comUf[2].toUpperCase() : null;
  const prefixo: ItemIndice[] = [];
  const trecho: ItemIndice[] = [];
  for (const it of indice) {
    if (ufQ && it[2] !== ufQ) continue;
    const n = normalizar(it[1]);
    if (n.startsWith(nomeQ)) prefixo.push(it);
    else if (n.includes(nomeQ)) trecho.push(it);
    if (prefixo.length >= limite) break;
  }
  const ordem = (a: ItemIndice, b: ItemIndice) => a[1].localeCompare(b[1], "pt-BR") || a[2].localeCompare(b[2]);
  return [...prefixo.sort(ordem), ...trecho.sort(ordem)].slice(0, limite);
}

/** Razão em % com denominador positivo; null quando qualquer parte falta. */
export function razaoPct(num: number | null | undefined, den: number | null | undefined): number | null {
  if (num == null || den == null || !(den > 0)) return null;
  return (num / den) * 100;
}

/** Soma de numeradores e denominadores compatíveis (nunca média de percentuais). */
export function razaoAgregada<T>(
  itens: readonly T[],
  numerador: (t: T) => number | null | undefined,
  denominador: (t: T) => number | null | undefined,
): { valor: number | null; numerador: number; denominador: number; n: number } {
  let num = 0;
  let den = 0;
  let n = 0;
  for (const it of itens) {
    const a = numerador(it);
    const b = denominador(it);
    if (a == null || b == null) continue;
    num += a;
    den += b;
    n += 1;
  }
  return { valor: den > 0 ? (num / den) * 100 : null, numerador: num, denominador: den, n };
}
