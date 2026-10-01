"use client";

import { useId, useState, type ReactNode } from "react";

/**
 * Bloco montado só quando o leitor pede (contrato dos módulos, seção 5.1: tabelas
 * grandes carregam sob demanda). O HTML do servidor leva o botão com o que há
 * dentro e quantas linhas; a tabela entra ao clicar e sai ao clicar de novo. Usado
 * nas tabelas de exploração e de auditoria da Conta de luz, nunca na tabela
 * equivalente de um gráfico, que já vem no próprio gráfico.
 */
export function ContaSobDemanda({ rotulo, detalhe, children }: { rotulo: string; detalhe?: string; children: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const id = useId();
  return (
    <div>
      <button
        type="button"
        aria-expanded={aberto}
        aria-controls={id}
        onClick={() => setAberto((a) => !a)}
        className="inline-flex min-h-[44px] items-center gap-2 border border-linha bg-superficie px-3 text-left text-sm text-carvao hover:border-energia"
      >
        <span aria-hidden="true">{aberto ? "▾" : "▸"}</span>
        {aberto ? `Ocultar ${rotulo}` : `Mostrar ${rotulo}`}
        {detalhe && <span className="text-xs text-carvao-muted">({detalhe})</span>}
      </button>
      <div id={id} className={aberto ? "mt-3" : "hidden"}>
        {aberto ? children : null}
      </div>
    </div>
  );
}
