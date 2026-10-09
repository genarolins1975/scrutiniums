"use client";

import { useId } from "react";

/**
 * Controles de recorte das páginas de Água e clima: grupo de opções (rádios nativos
 * com aparência de botão, alvo de 44 px, setas do teclado do próprio navegador) e lista
 * de seleção nativa. São controlados pelo componente que guarda o recorte na URL
 * (useEstadoUrl): escolher cria entrada no histórico e o voltar desfaz.
 */

export type OpcaoAgua<T extends string> = {
  id: T;
  rotulo: string;
  detalhe?: string;
  /** Na lista de seleção, opções com o mesmo grupo ficam sob o mesmo título (optgroup), na ordem em que o grupo aparece. */
  grupo?: string;
};

export function AguaEscolha<T extends string>({
  legenda,
  opcoes,
  valor,
  onEscolher,
}: {
  legenda: string;
  opcoes: readonly OpcaoAgua<T>[];
  valor: T;
  onEscolher: (v: T) => void;
}) {
  const nome = useId();
  return (
    <fieldset className="min-w-0">
      <legend className="rotulo text-mineral">{legenda}</legend>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {opcoes.map((o) => {
          const ativo = o.id === valor;
          return (
            <label
              key={o.id}
              title={o.detalhe}
              className={`inline-flex min-h-[44px] cursor-pointer items-center border px-3 text-sm focus-within:outline focus-within:outline-2 focus-within:outline-energia ${
                ativo ? "border-energia bg-energia-fundo text-carvao" : "border-linha bg-superficie text-carvao-muted hover:border-energia hover:text-carvao"
              }`}
            >
              <input type="radio" name={nome} value={o.id} checked={ativo} onChange={() => onEscolher(o.id)} className="sr-only" />
              {o.rotulo}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function AguaLista<T extends string>({
  rotulo,
  opcoes,
  valor,
  onEscolher,
  dica,
}: {
  rotulo: string;
  opcoes: readonly OpcaoAgua<T>[];
  valor: T;
  onEscolher: (v: T) => void;
  /** Frase curta sob a lista (o que o controle muda), ligada à lista por aria-describedby. */
  dica?: string;
}) {
  const id = useId();
  const grupos: string[] = [];
  for (const o of opcoes) if (o.grupo && !grupos.includes(o.grupo)) grupos.push(o.grupo);
  const opcao = (o: OpcaoAgua<T>) => (
    <option key={o.id} value={o.id}>
      {o.rotulo}
    </option>
  );
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="rotulo block text-mineral">
        {rotulo}
      </label>
      <select
        id={id}
        value={valor}
        onChange={(e) => onEscolher(e.target.value as T)}
        aria-describedby={dica ? `${id}-dica` : undefined}
        className="mt-1 min-h-[44px] w-full max-w-xs border border-linha bg-superficie px-2 text-sm text-carvao focus:outline focus:outline-2 focus:outline-energia"
      >
        {opcoes.filter((o) => !o.grupo).map(opcao)}
        {grupos.map((g) => (
          <optgroup key={g} label={g}>
            {opcoes.filter((o) => o.grupo === g).map(opcao)}
          </optgroup>
        ))}
      </select>
      {dica && (
        <p id={`${id}-dica`} className="mt-1 max-w-xs text-xs leading-snug text-carvao-muted">
          {dica}
        </p>
      )}
    </div>
  );
}
