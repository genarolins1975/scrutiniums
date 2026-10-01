"use client";

import { useMemo } from "react";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";

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
