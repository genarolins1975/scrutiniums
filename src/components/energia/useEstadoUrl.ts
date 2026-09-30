"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import {
  chavesAlteradas,
  estabilizar,
  gravarNaUrl,
  lerEstado,
  modoHistorico,
  type Esquema,
  type ModoHistorico,
  type ValoresDe,
} from "@/lib/energia/estadoUrl";

/**
 * Estado de consulta sincronizado com a URL (ver src/lib/energia/estadoUrl.ts).
 *
 * - Seleção, filtro e ordem entram com history.pushState (o voltar desfaz);
 *   digitação em busca e troca de página usam replaceState, com espera curta
 *   para não gravar a cada tecla (navegadores limitam a frequência).
 * - Voltar/avançar (popstate) relê a URL e restaura o estado.
 * - Parâmetros de outros componentes (?modo= do ModoProfundidade) e o #hash
 *   ficam intactos: cada gravação parte da URL atual, não de uma cópia antiga.
 * - Várias instâncias na mesma página (um comparador e um gráfico lendo o
 *   mesmo ?ent=) se avisam por um evento próprio, porque pushState não
 *   dispara popstate.
 * - O valor digitado vive no estado local: a URL é gravada depois, então uma
 *   gravação limitada pelo navegador nunca apaga o que a pessoa digitou.
 * - No servidor não há URL: o HTML sai com os padrões, ou com a busca da
 *   página quando ela é passada em buscaInicial. A URL real é lida antes da
 *   primeira pintura (efeito de layout), sem salto visível.
 *
 * O esquema deve ser estável (constante de módulo ou useMemo): quando a
 * identidade muda, a URL é relida para validar os valores com o esquema novo.
 */

const EVENTO = "scrutiniums:estado-url";

// efeito de layout no navegador (lê a URL antes de pintar); efeito comum no servidor, onde nada roda
const useEfeitoAntesDePintar = typeof window === "undefined" ? useEffect : useLayoutEffect;

export type OpcoesEstadoUrl = {
  /** false: estado só local, com a mesma API e sem tocar na URL. */
  sincronizar?: boolean;
  /** Busca conhecida no servidor ("?a=1"), para o HTML inicial já refletir o recorte do link. */
  buscaInicial?: string;
  /** Espera (ms) antes de gravar mudanças em modo replace. */
  atraso?: number;
};

export type DefinirEstadoUrl<V> = (
  mudanca: Partial<V> | ((atual: V) => Partial<V>),
  opcoes?: { historico?: ModoHistorico },
) => void;

export function useEstadoUrl<E extends Esquema>(esquema: E, opcoes: OpcoesEstadoUrl = {}): [ValoresDe<E>, DefinirEstadoUrl<ValoresDe<E>>] {
  const { sincronizar = true, buscaInicial = "", atraso = 300 } = opcoes;
  const origem = useId();
  const [valores, setValores] = useState<ValoresDe<E>>(() => lerEstado(esquema, buscaInicial));
  const valoresRef = useRef(valores);
  const esquemaRef = useRef(esquema);
  esquemaRef.current = esquema;
  const pendente = useRef<ReturnType<typeof setTimeout> | null>(null);

  const aplicar = useCallback((novos: ValoresDe<E>) => {
    valoresRef.current = novos;
    setValores(novos);
  }, []);

  const reler = useCallback(() => {
    const lidos = lerEstado(esquemaRef.current, window.location.search);
    const estaveis = estabilizar(esquemaRef.current, valoresRef.current, lidos);
    if (estaveis !== valoresRef.current) aplicar(estaveis);
  }, [aplicar]);

  const gravar = useCallback(
    (v: ValoresDe<E>, modo: ModoHistorico) => {
      if (gravarNaUrl(window, esquemaRef.current, v, modo)) {
        window.dispatchEvent(new CustomEvent(EVENTO, { detail: { origem } }));
      }
    },
    [origem],
  );

  // montagem e troca de esquema: lê a URL (exceto com gravação pendente, que a URL ainda não reflete);
  // no modo local, chaves novas do esquema entram com o padrão e as existentes ficam
  useEfeitoAntesDePintar(() => {
    if (pendente.current) return;
    if (sincronizar) {
      reler();
      return;
    }
    const atual = valoresRef.current as Record<string, unknown>;
    const completo = lerEstado(esquemaRef.current, "") as Record<string, unknown>;
    for (const k of Object.keys(completo)) if (k in atual) completo[k] = atual[k];
    const estaveis = estabilizar(esquemaRef.current, valoresRef.current, completo as ValoresDe<E>);
    if (estaveis !== valoresRef.current) aplicar(estaveis);
  }, [esquema, sincronizar, reler, aplicar]);

  // voltar/avançar e gravações de outras instâncias
  useEffect(() => {
    if (!sincronizar) return;
    const aoVoltar = () => {
      if (pendente.current) {
        clearTimeout(pendente.current);
        pendente.current = null;
      }
      reler();
    };
    const aoGravarOutro = (e: Event) => {
      if ((e as CustomEvent<{ origem?: string }>).detail?.origem !== origem) reler();
    };
    window.addEventListener("popstate", aoVoltar);
    window.addEventListener(EVENTO, aoGravarOutro);
    return () => {
      window.removeEventListener("popstate", aoVoltar);
      window.removeEventListener(EVENTO, aoGravarOutro);
      // desmontagem (inclusive por navegação): a gravação pendente é descartada, nunca aplicada à página seguinte
      if (pendente.current) {
        clearTimeout(pendente.current);
        pendente.current = null;
      }
    };
  }, [sincronizar, origem, reler]);

  const definir = useCallback<DefinirEstadoUrl<ValoresDe<E>>>(
    (mudanca, op) => {
      const esq = esquemaRef.current;
      const atual = valoresRef.current;
      const parcial = typeof mudanca === "function" ? mudanca(atual) : mudanca;
      const chaves = chavesAlteradas(esq, atual, parcial);
      if (!chaves.length) return;
      const novos = { ...atual } as ValoresDe<E>;
      for (const k of chaves) (novos as Record<string, unknown>)[k] = (parcial as Record<string, unknown>)[k];
      aplicar(novos);
      if (!sincronizar || typeof window === "undefined") return;
      const modo = modoHistorico(esq, chaves, op?.historico);
      if (modo === "replace") {
        if (pendente.current) clearTimeout(pendente.current);
        pendente.current = setTimeout(() => {
          pendente.current = null;
          gravar(valoresRef.current, "replace");
        }, atraso);
        return;
      }
      // antes da entrada nova, a digitação pendente vai para a entrada atual:
      // o voltar retorna à busca digitada, não ao estado anterior a ela
      if (pendente.current) {
        clearTimeout(pendente.current);
        pendente.current = null;
        gravar(atual, "replace");
      }
      gravar(novos, "push");
    },
    [aplicar, gravar, sincronizar, atraso],
  );

  return [valores, definir];
}
