"use client";

import { useEffect, useMemo, useState } from "react";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { carregarJson } from "@/lib/energia/perdas";
import type { Evidencia } from "@/lib/energia/evidencia";
import type { EvidenciasPorDistribuidora } from "@/lib/energia/tipos-perdas";

/**
 * Distribuidora escolhida, compartilhada por todos os painéis da página de Perdas pelo
 * parâmetro ?d= (CNPJ de 14 dígitos): escolher no mapa acende a mesma distribuidora nas
 * barras de composição, nos pontos do percentual técnico e no custo, e o voltar do
 * navegador desfaz a escolha em todos. CNPJ fora da lista do painel vale como "nenhuma"
 * só naquele painel, sem apagar a escolha dos outros.
 */
export function useSelecaoPerdas(ids: readonly string[]): [string | null, (id: string | null) => void] {
  const chave = ids.join(",");
  const esquema = useMemo(
    () => ({ d: campo(tiposUrl.opcao(ids), "", { param: "d" }) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a chave resume a lista
    [chave],
  );
  const [v, definir] = useEstadoUrl(esquema);
  return [v.d || null, (id) => definir({ d: id ?? "" })];
}

export type CargaEvidencia = { estado: "ocioso" | "carregando" | "ausente" } | { estado: "pronta"; evidencia: Evidencia } | { estado: "erro"; erro: string };

/**
 * Evidência "Comprove este número" da distribuidora escolhida, lida de um arquivo por CNPJ
 * (perdas_evidencias_*.json) só quando há escolha; "ausente" quando o arquivo não tem a
 * distribuidora (sem trecho de referência, sem processo tarifário).
 */
export function useEvidenciaPerdas(url: string, cnpj: string | null): [CargaEvidencia, () => void] {
  const [carga, setCarga] = useState<CargaEvidencia>({ estado: "ocioso" });
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    if (!cnpj) {
      setCarga({ estado: "ocioso" });
      return;
    }
    let vivo = true;
    setCarga({ estado: "carregando" });
    carregarJson<EvidenciasPorDistribuidora>(url).then(
      (j) => {
        if (!vivo) return;
        const ev = j.evidencias[cnpj];
        setCarga(ev ? { estado: "pronta", evidencia: ev as Evidencia } : { estado: "ausente" });
      },
      (e: unknown) => vivo && setCarga({ estado: "erro", erro: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      vivo = false;
    };
  }, [url, cnpj, tentativa]);
  return [carga, () => setTentativa((t) => t + 1)];
}
