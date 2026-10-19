/**
 * Sinais de recusa de rastreamento respeitados pela medição de uso:
 * Do Not Track ("DNT: 1", navigator.doNotTrack) e Global Privacy Control
 * ("Sec-GPC: 1", navigator.globalPrivacyControl). Com qualquer um deles a
 * visita não é contada, nem com conta nem sem conta. Arquivo sem dependências,
 * importável pelo componente do navegador e pela rota de servidor.
 */

export type NavegadorComSinais = {
  doNotTrack?: string | null;
  globalPrivacyControl?: boolean;
};

/** Verdadeiro quando o navegador pede para não ser rastreado (não envia nada). */
export function navegadorRecusaRastreio(nav: NavegadorComSinais | undefined, janela?: { doNotTrack?: string | null }): boolean {
  if (!nav) return false;
  if (nav.globalPrivacyControl === true) return true;
  if (nav.doNotTrack === "1" || nav.doNotTrack === "yes") return true;
  return janela?.doNotTrack === "1";
}

/** Verdadeiro quando a requisição traz DNT: 1 ou Sec-GPC: 1 (o servidor não conta). */
export function cabecalhosRecusamRastreio(cabecalhos: Pick<Headers, "get">): boolean {
  return cabecalhos.get("dnt")?.trim() === "1" || cabecalhos.get("sec-gpc")?.trim() === "1";
}
