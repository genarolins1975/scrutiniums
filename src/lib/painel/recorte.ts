/**
 * Recorte de um painel na URL (Iniciativa 1 do parecer de UX de 23/10/2026): `?cap=`, `?uf=`, `?exercicio=`, `?ibge=`. O servidor lê o
 * recorte dos parâmetros da página e o HTML já sai nele; o link copiado reproduz o recorte; sem JavaScript vale o padrão. Os controles
 * de cliente escrevem no mesmo lugar pelo esquema de src/lib/painel/estadoUrl.ts, e a navegação da coleção leva os parâmetros de uma
 * página a outra (`levar`, em src/lib/observatorios/navegacaoPura.ts).
 */

export type ParametrosPagina = Record<string, string | string[] | undefined>;

/** Valor único de um parâmetro (o primeiro, quando repetido), aparado; vazio vira null. */
export function parametro(p: ParametrosPagina | undefined, nome: string): string | null {
  const v = p?.[nome];
  const s = (Array.isArray(v) ? v[0] : v)?.trim();
  return s ? s : null;
}

/** Parâmetro restrito a uma lista de valores válidos; fora dela vale o padrão (link antigo ou adulterado não quebra a página). */
export function parametroEntre<T extends string>(p: ParametrosPagina | undefined, nome: string, validos: readonly T[], padrao: T): T {
  const v = parametro(p, nome);
  return v !== null && (validos as readonly string[]).includes(v) ? (v as T) : padrao;
}

/** Endereço com o recorte: parâmetros nulos ou iguais ao padrão saem da URL, para o link do estado padrão ser o endereço limpo. */
export function hrefComRecorte(base: string, recorte: Record<string, string | null | undefined>, padrao: Record<string, string> = {}): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(recorte)) if (v && v !== padrao[k]) q.set(k, v);
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}
