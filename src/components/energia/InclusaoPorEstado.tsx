"use client";

import type { ReactNode } from "react";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { ESQUEMA_ACESSO, ESQUEMA_ORCAMENTO, ESQUEMA_TSEE, type BasePof, type IndicadorPnad, type MedidaTsee } from "@/lib/energia/inclusao";

/**
 * A frase de resposta, os cartões da faixa de métricas e as fichas "Comprove este número" leem o mesmo estado do controle que o
 * gráfico (base da participação, indicador, medida), sempre. Cada variante chega pronta do servidor, com o texto e os números da
 * gold daquela escolha; o cliente só mostra a que o estado da URL pede (useEstadoUrl avisa as instâncias entre si, então o
 * gráfico, a frase e os cartões mudam juntos). Antes da hidratação vale o estado padrão, o mesmo do HTML do servidor.
 */

/** Orçamento: base da participação (na despesa total ou na renda). */
export function InclusaoPorBasePof({ variantes }: { variantes: Record<BasePof, ReactNode> }) {
  const [v] = useEstadoUrl(ESQUEMA_ORCAMENTO);
  return <>{variantes[v.base]}</>;
}

/** Acesso: indicador da PNAD (sem energia, ligados à rede geral, rede em tempo integral). */
export function InclusaoPorIndicadorPnad({ variantes }: { variantes: Record<IndicadorPnad, ReactNode> }) {
  const [v] = useEstadoUrl(ESQUEMA_ACESSO);
  return <>{variantes[v.ind]}</>;
}

/** Tarifa Social: medida da série nacional (UC, participação nas residenciais, DMR). */
export function InclusaoPorMedidaTsee({ variantes }: { variantes: Record<MedidaTsee, ReactNode> }) {
  const [v] = useEstadoUrl(ESQUEMA_TSEE);
  return <>{variantes[v.medida]}</>;
}
