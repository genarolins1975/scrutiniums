import { navegadorRecusaRastreio, type NavegadorComSinais } from "@/lib/uso/sinais";

/** "abriu": resultado aberto ou /buscar com termo; "sem_resultado": a barra não achou resultado completo (ciclo 2, 23/10/2026). */
export type EventoMedido = "abriu" | "sem_resultado";

/**
 * Soma uma busca ao contador agregado do dia (uso_busca_dia, docs/observatorios/MEDICAO_DE_USO.md): manda só o termo e o
 * evento, uma vez por busca feita (o resultado aberto pelo campo, a página /buscar com termo ou, desde o ciclo 2 da busca, a
 * busca da barra sem resultado completo depois de uma pausa na digitação), por sendBeacon com fetch keepalive de
 * reserva. Com Do Not Track ou Global Privacy Control não envia nada; o servidor decide o resto (sem conta, só com a
 * contagem anônima ligada) e recusa termo que pareça dado pessoal. Nunca derruba a página.
 */
export function medirBusca(termo: string, evento: EventoMedido = "abriu"): void {
  const t = termo.trim();
  if (!t) return;
  try {
    if (navegadorRecusaRastreio(navigator as Navigator & NavegadorComSinais, window as { doNotTrack?: string | null })) return;
    const corpo = JSON.stringify(evento === "abriu" ? { termo: t.slice(0, 120) } : { termo: t.slice(0, 120), evento });
    const enviado = typeof navigator.sendBeacon === "function" && navigator.sendBeacon("/api/uso/busca", new Blob([corpo], { type: "application/json" }));
    if (!enviado) {
      fetch("/api/uso/busca", { method: "POST", headers: { "Content-Type": "application/json" }, body: corpo, keepalive: true, credentials: "same-origin" }).catch(() => {});
    }
  } catch {
    // a medição nunca derruba a página
  }
}
