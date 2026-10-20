"use client";

import { Children, useState, type ReactNode } from "react";

/**
 * Escolha entre exemplos montados no servidor: todos ficam no HTML (leitura sem JavaScript, impressão e busca do navegador), e só o
 * escolhido aparece. Os filhos vêm na mesma ordem das opções. O rótulo de cada opção é nó (nome próprio marcado com <Nome> na página
 * inglesa), por isso os rádios são desenhados aqui, no mesmo estilo de TransicaoOpcoes.
 */
export function AlternarExemplos({ rotulo, nome, opcoes, children }: { rotulo: string; nome: string; opcoes: { id: string; rotulo: ReactNode }[]; children: ReactNode }) {
  const [atual, setAtual] = useState(opcoes[0]?.id ?? "");
  const filhos = Children.toArray(children);
  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label={rotulo} className="flex flex-wrap items-center gap-2">
        <span className="rotulo text-mineral">{rotulo}</span>
        {opcoes.map((o) => (
          <label
            key={o.id}
            className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 border px-3 text-sm ${
              atual === o.id ? "border-energia bg-energia-fundo text-carvao" : "border-linha bg-superficie text-carvao-muted"
            }`}
          >
            <input type="radio" name={nome} value={o.id} checked={atual === o.id} onChange={() => setAtual(o.id)} className="accent-energia" />
            {o.rotulo}
          </label>
        ))}
      </div>
      {filhos.map((f, i) => (
        <div key={opcoes[i]?.id ?? i} hidden={opcoes[i]?.id !== atual} data-exemplo={opcoes[i]?.id}>
          {f}
        </div>
      ))}
    </div>
  );
}
