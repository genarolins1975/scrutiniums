/** Uso mínimo: sem parâmetros, sem persistência local e sem identificador no evento. */
export type AcaoAgro = 'simulacao' | 'download' | 'percurso';
const ultimos = new Map<AcaoAgro, number>();
export function registrarUsoAgro(acao: AcaoAgro) {
    try {
        const now = Date.now();
        if (now - (ultimos.get(acao) ?? 0) < 5000)
            return;
        ultimos.set(acao, now);
        const body = JSON.stringify({ acao }), blob = new Blob([body], { type: 'application/json' });
        if (!(navigator.sendBeacon && navigator.sendBeacon('/api/agro/eventos', blob)))
            fetch('/api/agro/eventos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => { });
    }
    catch { /* Uso não interfere na tarefa. */ }
}
