import { navegadorRecusaRastreio, type NavegadorComSinais } from "@/lib/uso/sinais";

/**
 * Soma uma busca ao contador agregado do dia (uso_busca_dia, docs/observatorios/MEDICAO_DE_USO.md): manda só o termo, uma
 * vez por busca feita (o resultado aberto pelo campo ou a página /buscar com termo), por sendBeacon com fetch keepalive de
 * reserva. Com Do Not Track ou Global Privacy Control não envia nada; o servidor decide o resto (sem conta, só com a
 * contagem anônima ligada) e recusa termo que pareça dado pessoal. Nunca derruba a página.
 */
export function medirBusca(termo: string): void {
  const t = termo.trim();
  if (!t) return;
  try {
    if (navegadorRecusaRastreio(navigator as Navigator & NavegadorComSinais, window as { doNotTrack?: string | null })) return;
    const corpo = JSON.stringify({ termo: t.slice(0, 120) });
    const enviado = typeof navigator.sendBeacon === "function" && navigator.sendBeacon("/api/uso/busca", new Blob([corpo], { type: "application/json" }));
    if (!enviado) {
      fetch("/api/uso/busca", { method: "POST", headers: { "Content-Type": "application/json" }, body: corpo, keepalive: true, credentials: "same-origin" }).catch(() => {});
    }
  } catch {
    // a medição nunca derruba a página
  }
}
