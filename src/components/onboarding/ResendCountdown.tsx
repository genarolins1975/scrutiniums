"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Botão de reenvio de código com contagem regressiva de 30 segundos.
 * Começa bloqueado (o primeiro envio acabou de acontecer) e informa
 * o tempo restante de forma acessível via aria-live.
 */
export function ResendCountdown({
  onResend,
  seconds = 30,
  disabled = false,
}: {
  onResend: () => Promise<void> | void;
  seconds?: number;
  disabled?: boolean;
}) {
  const [remaining, setRemaining] = useState(seconds);
  const [sending, setSending] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCountdown = useCallback(() => {
    setRemaining(seconds);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
  }, [seconds]);

  useEffect(() => {
    startCountdown();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startCountdown]);

  async function handleClick() {
    if (remaining > 0 || sending || disabled) return;
    setSending(true);
    try {
      await onResend();
      startCountdown();
    } finally {
      setSending(false);
    }
  }

  const blocked = remaining > 0 || sending || disabled;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={blocked}
      aria-live="polite"
      className="rotulo min-h-[44px] text-carvao-muted underline underline-offset-4 hover:text-bronze disabled:cursor-not-allowed disabled:no-underline disabled:opacity-60"
    >
      {remaining > 0
        ? `Reenviar código em ${remaining}s`
        : sending
          ? "Reenviando…"
          : "Reenviar código"}
    </button>
  );
}
