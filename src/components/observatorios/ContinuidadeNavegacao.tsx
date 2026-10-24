"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSessao } from "@/components/acesso/sessao";
import { ultimoAcessoDoCaminho } from "@/lib/observatorios/ultimoAcesso";

/** A fila impede que uma resposta lenta de A sobrescreva a visita seguinte a B. */
let gravacao: Promise<unknown> = Promise.resolve();
let mudou = false;

function Visita({ caminho }: { caminho: string }) {
  const logado = useSessao();
  const ultima = useRef<string | null>(null);
  useEffect(() => {
    if (!logado || ultima.current === caminho) return;
    ultima.current = caminho;
    mudou = true;
    gravacao = gravacao.then(async () => {
      const controle = new AbortController();
      const prazo = window.setTimeout(() => controle.abort(), 2500);
      try {
        await fetch("/api/conta/ultimo-acesso", {
          method: "POST", credentials: "same-origin", signal: controle.signal,
          headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caminho }),
        });
      } finally { window.clearTimeout(prazo); }
    }).catch(() => undefined);
  }, [caminho, logado]);
  return null;
}

/** Mesmo cookie do middleware, só após a navegação; nenhuma gravação de perfil ou evento novo. */
export function ContinuidadeNavegacao() {
  const caminho = usePathname() ?? "";
  const router = useRouter();
  useEffect(() => {
    let vivo = true;
    if (caminho === "/app/observatorios" && mudou) {
      mudou = false;
      void gravacao.then(() => { if (vivo) router.refresh(); });
    }
    return () => { vivo = false; };
  }, [caminho, router]);
  return ultimoAcessoDoCaminho(caminho) ? <Visita caminho={caminho} /> : null;
}
