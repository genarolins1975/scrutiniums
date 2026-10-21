/**
 * Onde o leitor está: observatório, coleção e página de um endereço, lidos do registro (registro.ts). É a fonte do seletor
 * da barra (SwitcherObservatorio), do rótulo acima do H1 (RotuloContexto) e da trilha (Trilha), para que os três digam
 * sempre a mesma coisa. Iniciativa 1 do parecer de UX de 21/10/2026: uma só hierarquia, Observatório → Coleção → Página.
 *
 * Só servidor (ou componente de cliente renderizado no servidor): o registro lê os catálogos de todos os domínios.
 */
import { staticGenerationAsyncStorage } from "next/dist/client/components/static-generation-async-storage.external";
import { APERITIVOS } from "@/lib/rotasPublicas";
import { donoDaRota, observatorio as observatorioPorId, OBSERVATORIOS, type Colecao, type Observatorio } from "./registro";
import type { DominioId } from "@/lib/dominios";
import { OBSERVATORIO_PRINCIPAL } from "./lista";

export type ContextoRota = {
  observatorio: Observatorio;
  /** null nas páginas do próprio observatório (entrada com conta, página aberta, método). */
  colecao: Colecao | null;
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

/** Endereço da página em renderização (servidor) ou da janela (navegador); null fora de render. */
export function caminhoAtual(): string | null {
  const store = staticGenerationAsyncStorage.getStore();
  if (store?.urlPathname) return store.urlPathname;
  if (typeof window !== "undefined") return window.location.pathname;
  return null;
}

/** Contexto de um endereço; null fora dos observatórios (home, conta, institucionais). */
export function contextoDaRota(caminho: string): ContextoRota | null {
  const c = caminhoPublico(caminho);
  const dono = donoDaRota(c);
  if (dono) {
    const o = observatorioPorId(dono.observatorio);
    const colecao = o.colecoes.find((x) => x.id === dono.colecao) ?? null;
    if (colecao && dono.rota === colecao.href) return { observatorio: o, colecao, pagina: null, exato: c === colecao.href };
    return { observatorio: o, colecao, pagina: { titulo: dono.titulo, rota: dono.rota }, exato: c === dono.rota };
  }
  // páginas do próprio observatório: entrada com conta, página aberta (/perguntas/<id>) e método
  for (const o of OBSERVATORIOS) {
    if (c === o.entrada || c === `/perguntas/${o.id}`) return { observatorio: o, colecao: null, pagina: null, exato: true };
    if (o.metodo && (c === o.metodo || c.startsWith(`${o.metodo}/`))) return { observatorio: o, colecao: null, pagina: { titulo: "Método", rota: o.metodo }, exato: c === o.metodo };
  }
  // coleção cuja porta está acima do endereço, sem painel registrado entre os dois (ex.: método das Contas Estaduais)
  for (const o of OBSERVATORIOS) {
    const colecao = o.colecoes.find((x) => c.startsWith(`${x.href}/`));
    if (colecao) return { observatorio: o, colecao, pagina: null, exato: false };
  }
  return null;
}

/** Contexto da página em renderização. */
export function contextoAtual(): ContextoRota | null {
  const c = caminhoAtual();
  return c ? contextoDaRota(c) : null;
}

/** Coleção que apresenta um domínio de origem inteiro (a do observatório principal dele), para quando só o domínio é conhecido. */
export function colecaoDoDominio(id: DominioId): { observatorio: Observatorio; colecao: Colecao } | null {
  const o = observatorioPorId(OBSERVATORIO_PRINCIPAL[id]);
  const colecao = o.colecoes.find((x) => x.dominio === id);
  return colecao ? { observatorio: o, colecao } : null;
}
