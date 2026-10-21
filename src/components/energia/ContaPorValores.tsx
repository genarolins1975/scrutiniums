"use client";

import type { ReactNode } from "react";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { CAMPO_VALORES } from "@/lib/energia/conta";

/**
 * Uma peça do painel que muda com a escolha "Nominais ou Em reais" (?valores=), a mesma dos gráficos: o número de destaque, a frase da
 * resposta, o "o que mudou" e o texto de cada tabela falam na moeda que o leitor escolheu. A página monta as duas versões no servidor
 * (cada uma com os mesmos valores que o gráfico e a tabela usam) e esta peça só decide qual mostrar; sem versão em reais (IPCA
 * ausente), a nominal vale sempre, e o gráfico já diz que faltam os índices.
 */
export function ContaPorValores({ nominal, real }: { nominal: ReactNode; real: ReactNode | null }) {
  const [v] = useEstadoUrl({ valores: CAMPO_VALORES });
  const mostrarReal = v.valores === "real" && real !== null && real !== undefined;
  return <div data-moeda={mostrarReal ? "real" : "nominal"}>{mostrarReal ? real : nominal}</div>;
}
