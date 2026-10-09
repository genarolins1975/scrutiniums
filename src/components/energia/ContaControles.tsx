"use client";

import { useId } from "react";

/**
 * Controles da Conta de luz: grupo de opções (rádios nativos com aparência de botão, alvo de 44 px, setas do teclado do próprio
 * navegador) e lista de seleção nativa. São controlados por quem guarda o recorte na URL (useEstadoUrl): escolher cria entrada no
 * histórico e o voltar desfaz. O grupo mantém o nome acessível de antes (role radiogroup, nome igual à legenda visível).
 */

export type OpcaoConta<T extends string> = { id: T; rotulo: string; detalhe?: string };

export function ContaEscolha<T extends string>({
  legenda,
  opcoes,
  valor,
  onEscolher,
  emLinha = false,
}: {
  legenda: string;
  opcoes: readonly OpcaoConta<T>[];
  valor: T;
  onEscolher: (v: T) => void;
  /** Legenda ao lado das opções (a partir de 640 px), para o controle gastar uma linha só em vez de duas. */
  emLinha?: boolean;
}) {
  const uid = useId();
  return (
    <div role="radiogroup" aria-labelledby={`${uid}-legenda`} className={`min-w-0 ${emLinha ? "sm:flex sm:flex-wrap sm:items-center sm:gap-x-3" : ""}`}>
      <p id={`${uid}-legenda`} className="rotulo text-mineral">
        {legenda}
      </p>
      <div className={`flex flex-wrap gap-1.5 ${emLinha ? "mt-1 sm:mt-0" : "mt-1"}`}>
        {opcoes.map((o) => {
          const ativo = o.id === valor;
          return (
            <label
              key={o.id}
              title={o.detalhe}
              className={`inline-flex min-h-[44px] cursor-pointer items-center border px-3 text-sm focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-energia ${
                ativo ? "border-energia bg-energia-fundo text-carvao" : "border-linha bg-superficie text-carvao-muted hover:border-energia hover:text-carvao"
              }`}
            >
              <input type="radio" name={uid} value={o.id} checked={ativo} onChange={() => onEscolher(o.id)} className="sr-only" />
              {o.rotulo}
            </label>
          );
        })}
      </div>
    </div>
  );
}

export function ContaLista({
  rotulo,
  opcoes,
  valor,
  onEscolher,
}: {
  rotulo: string;
  opcoes: readonly OpcaoConta<string>[];
  valor: string;
  onEscolher: (v: string) => void;
}) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="rotulo block text-mineral">
        {rotulo}
      </label>
      <select
        id={id}
        value={valor}
        onChange={(e) => onEscolher(e.target.value)}
        className="mt-1 min-h-[44px] w-full max-w-xs border border-linha bg-superficie px-2 text-sm text-carvao focus:outline focus:outline-2 focus:outline-energia"
      >
        {opcoes.map((o) => (
          <option key={o.id} value={o.id}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </div>
  );
}
