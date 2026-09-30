"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useSyncExternalStore, type ReactNode } from "react";
import { criarLojaCursor, type CursorCompartilhado, type LojaCursor } from "@/lib/energia/series-temporais";

/**
 * Cursor sincronizado entre séries temporais compatíveis (seção 7.3 da
 * especificação): gráficos sob o mesmo <CursorSincronizado> e com o mesmo
 * grupo (por padrão, a mesma chaveX) mostram a cruz na mesma posição de X
 * quando a pessoa percorre qualquer um deles com mouse, toque ou teclado.
 *
 * - A posição é o valor de X ("2026-09-12"), não o índice: gráficos com
 *   períodos diferentes se alinham pela data, e o gráfico que não tem aquele
 *   ponto (fora do intervalo ou da série) simplesmente não mostra a cruz, em
 *   vez de mostrar outro dia.
 * - Só o gráfico de origem abre a dica e fala na região aria-live; os outros
 *   mostram a cruz e os pontos, para o leitor de tela não ouvir quatro
 *   anúncios a cada tecla.
 * - A loja fica fora do estado do React (useSyncExternalStore com seletor por
 *   grupo): mover o cursor re-renderiza só os gráficos do grupo, não a página
 *   inteira que está dentro do provedor.
 * - Sem provedor acima, nada muda: cada gráfico tem o próprio cursor.
 *
 * `inicial` abre a página com o cursor já posicionado (ex.: dia citado no
 * texto ou vindo da URL) e permite conferir o HTML do servidor.
 */

const Contexto = createContext<LojaCursor | null>(null);

export function CursorSincronizado({ children, inicial }: { children: ReactNode; inicial?: { grupo: string; valor: string } }) {
  const loja = useRef<LojaCursor | null>(null);
  if (!loja.current) loja.current = criarLojaCursor(inicial ? { ...inicial, origem: "inicial" } : null);
  return <Contexto.Provider value={loja.current}>{children}</Contexto.Provider>;
}

const semAssinatura = () => () => {};

export type CursorDoGrupo = {
  /** Cursor atual do grupo (de qualquer origem), ou null. */
  cursor: CursorCompartilhado;
  publicar: (valor: string, origem: string) => void;
  limpar: (origem: string) => void;
};

/**
 * Cursor do grupo pedido. Devolve null quando não há provedor acima ou quando
 * o grupo é null (gráfico que optou por não sincronizar).
 */
export function useCursorSincronizado(grupo: string | null): CursorDoGrupo | null {
  const loja = useContext(Contexto);
  const ler = useCallback((): CursorCompartilhado => {
    if (!loja || grupo === null) return null;
    const c = loja.ler();
    return c && c.grupo === grupo ? c : null;
  }, [loja, grupo]);
  const cursor = useSyncExternalStore(loja ? loja.assinar : semAssinatura, ler, ler);
  const publicar = useCallback((valor: string, origem: string) => {
    if (loja && grupo !== null) loja.publicar(grupo, valor, origem);
  }, [loja, grupo]);
  const limpar = useCallback((origem: string) => loja?.limpar(origem), [loja]);
  return useMemo(() => (loja && grupo !== null ? { cursor, publicar, limpar } : null), [loja, grupo, cursor, publicar, limpar]);
}
