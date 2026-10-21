/**
 * Onde o leitor está: observatório, coleção e página de um endereço, lidos do registro (registro.ts). É a fonte do seletor
 * da barra (SwitcherObservatorio), das abas dos observatórios, do rótulo acima do H1 (RotuloContexto) e da trilha (Trilha),
 * para que todos digam sempre a mesma coisa. Iniciativa 1 do parecer de UX de 21/10/2026: uma só hierarquia,
 * Observatório → Coleção → Página.
 *
 * Só servidor: o registro lê os catálogos de todos os domínios. Para o navegador vai o índice (indiceDoCaminho), que
 * contextoPuro.ts resolve sem os catálogos.
 */
import { staticGenerationAsyncStorage } from "next/dist/client/components/static-generation-async-storage.external";
import { observatorio as observatorioPorId, OBSERVATORIOS, paineis, type Colecao, type Observatorio } from "./registro";
import type { DominioId } from "@/lib/dominios";
import { OBSERVATORIO_PRINCIPAL } from "./lista";
import { resolverContexto, segmentoDe, type ContextoRota, type IndiceContexto } from "./contextoPuro";

export { caminhoPublico } from "./contextoPuro";
export type { ContextoRota, IndiceContexto } from "./contextoPuro";

/** Endereço da página em renderização (servidor) ou da janela (navegador); null fora de render. */
export function caminhoAtual(): string | null {
  const store = staticGenerationAsyncStorage.getStore();
  if (store?.urlPathname) return store.urlPathname;
  if (typeof window !== "undefined") return window.location.pathname;
  return null;
}

function resumoDosObservatorios(): IndiceContexto["observatorios"] {
  return OBSERVATORIOS.map((o) => ({
    id: o.id, nome: o.nome, nomeCurto: o.nomeCurto, entrada: o.entrada, metodo: o.metodo,
    colecoes: o.colecoes.map((c) => ({ id: c.id, nome: c.nome, href: c.href })),
  }));
}

/** Índice inteiro: os seis observatórios, as 28 coleções e todos os painéis do registro. */
export function indiceCompleto(): IndiceContexto {
  return { observatorios: resumoDosObservatorios(), paineis: paineis().map((p) => [p.rota, p.titulo, p.observatorio, p.colecao] as const) };
}

/**
 * Índice para o navegador, a partir do endereço em renderização: os observatórios e só os painéis do mesmo primeiro
 * segmento (os únicos que podem ser donos de um endereço desse segmento). Um layout cobre um segmento só, então o índice
 * vale para toda navegação que não troca de layout; ao trocar de segmento, o novo layout traz o seu índice.
 */
export function indiceDoCaminho(caminho: string | null): IndiceContexto {
  const completo = indiceCompleto();
  if (!caminho) return { observatorios: completo.observatorios, paineis: [] };
  const seg = segmentoDe(caminho);
  return { observatorios: completo.observatorios, paineis: completo.paineis.filter((p) => p[0] === seg || p[0].startsWith(`${seg}/`)) };
}

/** Contexto de um endereço; null fora dos observatórios (home, conta, institucionais). */
export function contextoDaRota(caminho: string): ContextoRota | null {
  return resolverContexto(caminho, indiceCompleto());
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
