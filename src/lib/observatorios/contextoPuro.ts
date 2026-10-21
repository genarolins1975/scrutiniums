/**
 * Resolução do contexto de um endereço (observatório, coleção, página) sem ler os catálogos: código puro, que roda no
 * servidor e no navegador. O servidor monta o índice (contexto.ts, a partir do registro) e o passa aos componentes de
 * cliente; no navegador, o mesmo índice resolve o endereço corrente a cada navegação. Assim o seletor, as abas e a trilha
 * de um cabeçalho renderizado num layout (que o Next não refaz ao navegar entre páginas irmãs) seguem a página aberta.
 */
import { APERITIVOS } from "@/lib/rotasPublicas";
import type { ObservatorioId } from "./lista";

export type ColecaoResumo = { id: string; nome: string; href: string };
export type ObservatorioResumo = {
  id: ObservatorioId;
  nome: string;
  nomeCurto: string;
  entrada?: string;
  metodo?: string;
  colecoes: ColecaoResumo[];
};
/** Painel do registro: rota, título, observatório e coleção donos. */
export type PainelResumo = readonly [rota: string, titulo: string, observatorio: ObservatorioId, colecao: string];
export type IndiceContexto = { observatorios: ObservatorioResumo[]; paineis: PainelResumo[] };

export type ContextoRota = {
  observatorio: ObservatorioResumo;
  /** null nas páginas do próprio observatório (entrada com conta, página aberta, método). */
  colecao: ColecaoResumo | null;
  /** Página dentro da coleção; null quando o endereço é a entrada da coleção ou do observatório. */
  pagina: { titulo: string; rota: string } | null;
  /** O endereço é exatamente o da última peça (coleção ou página), que a trilha marca como atual. */
  exato: boolean;
};

function normalizar(caminho: string): string {
  const semConsulta = caminho.split(/[?#]/)[0] || "/";
  return semConsulta.length > 1 && semConsulta.endsWith("/") ? semConsulta.slice(0, -1) : semConsulta;
}

/**
 * Endereço público de um caminho de renderização: a irmã inglesa (/en/...) vale pela portuguesa e a versão aperitivo,
 * servida por rewrite no endereço do tema, vale pelo endereço do tema (APERITIVOS).
 */
export function caminhoPublico(caminho: string): string {
  let c = normalizar(caminho);
  if (c === "/en") c = "/";
  else if (c.startsWith("/en/")) c = c.slice(3);
  const aperitivo = APERITIVOS.find((a) => a.versaoAberta && (c === a.versaoAberta || c.startsWith(`${a.versaoAberta}/`)));
  if (aperitivo) c = aperitivo.rota;
  else if (c.startsWith("/aperitivo/")) c = `/${c.slice("/aperitivo/".length)}`;
  return c;
}

/** Primeiro segmento do endereço público ("/setor-eletrico" para "/setor-eletrico/pld"): todo painel acima dele começa assim. */
export function segmentoDe(caminho: string): string {
  const c = caminhoPublico(caminho);
  const fim = c.indexOf("/", 1);
  return fim < 0 ? c : c.slice(0, fim);
}

/** Contexto de um endereço no índice; null fora dos observatórios (home, conta, institucionais). */
export function resolverContexto(caminho: string, indice: IndiceContexto): ContextoRota | null {
  const c = caminhoPublico(caminho);
  const porRota = new Map(indice.paineis.map((p) => [p[0], p]));
  const obs = (id: ObservatorioId) => indice.observatorios.find((o) => o.id === id);
  // dono: o painel do próprio endereço ou o mais próximo acima dele (donoDaRota, em registro.ts)
  let atual = c;
  while (atual) {
    const p = porRota.get(atual);
    if (p) {
      const o = obs(p[2]);
      if (!o) break;
      const colecao = o.colecoes.find((x) => x.id === p[3]) ?? null;
      if (colecao && p[0] === colecao.href) return { observatorio: o, colecao, pagina: null, exato: c === colecao.href };
      return { observatorio: o, colecao, pagina: { titulo: p[1], rota: p[0] }, exato: c === p[0] };
    }
    const corte = atual.lastIndexOf("/");
    if (corte <= 0) break;
    atual = atual.slice(0, corte);
  }
  // páginas do próprio observatório: entrada com conta, página aberta (/perguntas/<id>) e método
  for (const o of indice.observatorios) {
    if (c === o.entrada || c === `/perguntas/${o.id}`) return { observatorio: o, colecao: null, pagina: null, exato: true };
    if (o.metodo && (c === o.metodo || c.startsWith(`${o.metodo}/`))) return { observatorio: o, colecao: null, pagina: { titulo: "Método", rota: o.metodo }, exato: c === o.metodo };
  }
  // coleção cuja porta está acima do endereço, sem painel registrado entre os dois
  for (const o of indice.observatorios) {
    const colecao = o.colecoes.find((x) => c.startsWith(`${x.href}/`));
    if (colecao) return { observatorio: o, colecao, pagina: null, exato: false };
  }
  return null;
}
