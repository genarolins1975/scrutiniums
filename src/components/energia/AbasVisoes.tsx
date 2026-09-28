"use client";

import type { ReactNode } from "react";
import { umDe, useEstadoUrl } from "@/lib/energia/useEstadoUrl";

/**
 * Abas de visão sobre o mesmo conteúdo (mapa, fluxos, histórico): a escolha
 * fica na URL para ser compartilhável. Recebe o conteúdo já renderizado no
 * servidor; só a alternância roda no cliente. Padrão de abas acessível.
 */
export function AbasVisoes({ abas, chaveUrl = "visao", rotulo = "Visão" }: { abas: { id: string; rotulo: string; conteudo: ReactNode }[]; chaveUrl?: string; rotulo?: string }) {
  const ids = abas.map((a) => a.id);
  const [id, setId] = useEstadoUrl<string>(chaveUrl, ids[0], umDe(ids));
  const atual = abas.find((a) => a.id === id) ?? abas[0];
  return (
    <div>
      <div role="tablist" aria-label={rotulo} className="flex flex-wrap gap-1 border-b border-linha">
        {abas.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            id={`aba-${chaveUrl}-${a.id}`}
            aria-selected={a.id === atual.id}
            aria-controls={`painel-${chaveUrl}`}
            onClick={() => setId(a.id)}
            className={`rotulo min-h-[44px] border-b-2 px-3 ${a.id === atual.id ? "border-energia text-carvao" : "border-transparent text-carvao-muted hover:text-carvao"}`}
          >
            {a.rotulo}
          </button>
        ))}
      </div>
      <div id={`painel-${chaveUrl}`} role="tabpanel" aria-labelledby={`aba-${chaveUrl}-${atual.id}`} className="pt-4">
        {atual.conteudo}
      </div>
    </div>
  );
}
