"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { navegadorRecusaRastreio, type NavegadorComSinais } from "@/lib/uso/sinais";

/**
 * Medição de uso agregada (docs/observatorios/MEDICAO_DE_USO.md), montada uma
 * vez no layout raiz: cobre todas as páginas Next de todos os observatórios.
 * Manda só o caminho da página (sem consulta nem fragmento), uma vez por
 * navegação, por navigator.sendBeacon com fetch keepalive de reserva. Não lê
 * nem cria cookie, não guarda nada no navegador e engole qualquer falha.
 * Com Do Not Track ou Global Privacy Control, não envia nada.
 *
 * A aplicação de página única do Crédito (/observatorio, public/obs/app.js) não
 * usa este layout e fica fora desta etapa.
 *
 * As páginas de autenticação (entrar, código por SMS, cadastro) não mandam nada:
 * ali nenhuma requisição além do próprio formulário sai do navegador (testes
 * i18n-auth-browser e i18n-sms-browser), e o funil de cadastro já é medido no admin.
 */
let ultimoEnviado: string | null = null;

/** Rotas de autenticação, também nas irmãs /en: fora da medição de uso. */
export const FORA_DA_MEDICAO = /^\/(?:en\/)?(?:entrar|cadastro)(?:\/|$)/;

export function MedeUso() {
  const caminho = usePathname();
  useEffect(() => {
    // O modo estrito do React em desenvolvimento repete o efeito: o mesmo caminho seguido conta uma vez.
    if (!caminho || caminho === ultimoEnviado || FORA_DA_MEDICAO.test(caminho)) return;
    ultimoEnviado = caminho;
    try {
      if (navegadorRecusaRastreio(navigator as Navigator & NavegadorComSinais, window as { doNotTrack?: string | null })) return;
      const corpo = JSON.stringify({ rota: caminho });
      const enviado = typeof navigator.sendBeacon === "function"
        && navigator.sendBeacon("/api/uso", new Blob([corpo], { type: "application/json" }));
      if (!enviado) {
        fetch("/api/uso", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: corpo,
          keepalive: true,
          credentials: "same-origin",
        }).catch(() => {});
      }
    } catch {
      // A medição nunca derruba a página.
    }
  }, [caminho]);
  return null;
}
