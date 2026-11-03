/**
 * Publicação por módulo do Setor Elétrico (decisão do dono de 03/11/2026: "publicar por arquivo"). Quando a construção de
 * uma gold regride ou reprova a validação crítica do próprio módulo, o pipeline mantém a publicação anterior só dessa gold
 * (sentinela de pipeline/energia/run.py) e registra o motivo em meta.json, `regressoes`; as demais golds seguem publicadas.
 * O leitor das páginas do módulo retido vê a faixa AvisoRetencao com a data da publicação que está vendo.
 *
 * Este arquivo diz quais páginas mostram cada gold. Código puro: o layout lê meta.json no servidor e a faixa, no navegador,
 * escolhe pelo endereço. src/tests/energia-retencao.test.ts reprova gold publicada sem páginas e página sem gold.
 */

/** Caminhos (depois de /setor-eletrico) cujas páginas mostram os números de cada gold. Prefixo: vale para as filhas. */
export const PAGINAS_DA_GOLD: Readonly<Record<string, readonly string[]>> = {
  "pld.json": ["/pld"],
  "pld_detalhe.json": ["/pld"],
  "cmo.json": ["/pld/cmo-e-formacao"],
  "previsoes.json": ["/pld/previsoes", "/pld/modelos"],
  "modelos.json": ["/pld/previsoes", "/pld/modelos"],
  "previsoes_desempenho.json": ["/pld/previsoes", "/pld/modelos"],
  "hidrologia.json": ["/agua-e-clima"],
  "agua_detalhe.json": ["/agua-e-clima"],
  "carga.json": ["/carga"],
  "carga_detalhe.json": ["/carga"],
  "geracao.json": ["/geracao"],
  "geracao_detalhe.json": ["/geracao"],
  "rede.json": ["/rede"],
  "rede_detalhe.json": ["/rede"],
  "regulacao.json": ["/regulacao", "/pld/limites"],
  "expansao.json": ["/expansao"],
  "transicao.json": ["/transicao"],
  "mercado.json": ["/mercado"],
  "perdas.json": ["/perdas"],
  "qualidade.json": ["/qualidade"],
  "conta.json": ["/conta-de-luz"],
  "inclusao.json": ["/inclusao-energetica"],
  "empresas.json": ["/empresas"],
  "listadas.json": ["/empresas/listadas"],
  "leiloes.json": ["/leiloes"],
  "territorio.json": ["/territorio"],
  "sintese.json": ["/visao-geral"],
  "publicacao.json": ["/dados"],
};

export type Retencao = { gold: string; publicadaEm: string | null; motivo: string | null };

/** Retenções que valem para um endereço (português ou /en), na ordem de meta.json, sem repetir gold. */
export function retencoesDaPagina(caminho: string, retencoes: readonly Retencao[]): Retencao[] {
  const semIdioma = caminho.replace(/^\/en(?=\/|$)/, "");
  if (!semIdioma.startsWith("/setor-eletrico")) return [];
  const resto = semIdioma.slice("/setor-eletrico".length).replace(/\/+$/, "");
  const vistas = new Set<string>();
  return retencoes.filter((r) => {
    if (vistas.has(r.gold)) return false;
    const paginas = PAGINAS_DA_GOLD[r.gold] ?? [];
    const vale = paginas.some((p) => resto === p || resto.startsWith(`${p}/`));
    if (vale) vistas.add(r.gold);
    return vale;
  });
}

/** Regressões de meta.json com a data da publicação mantida, lida da própria gold (`golds[nome].gerado_em`). */
export function retencoesDaMeta(meta: {
  regressoes?: readonly { gold: string; motivo?: string | null }[];
  golds?: Readonly<Record<string, { gerado_em?: string | null } | undefined>>;
} | null): Retencao[] {
  if (!meta?.regressoes) return [];
  return meta.regressoes.map((r) => ({ gold: r.gold, publicadaEm: meta.golds?.[r.gold]?.gerado_em ?? null, motivo: r.motivo ?? null }));
}
