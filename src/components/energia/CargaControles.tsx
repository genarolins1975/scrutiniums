"use client";

import { useId } from "react";

/**
 * Controles de recorte das páginas de Carga: grupo de opções (rádios nativos com
 * aparência de botão, alvo de 44 px, setas do teclado do próprio navegador) e lista
 * de seleção nativa. São controlados pelo componente que guarda o recorte na URL
 * (useEstadoUrl): escolher cria entrada no histórico e o voltar desfaz.
 */

export type OpcaoControle<T extends string> = { id: T; rotulo: string; detalhe?: string };

export function CargaEscolha<T extends string>({
  legenda,
  opcoes,
  valor,
  onEscolher,
}: {
  legenda: string;
  opcoes: readonly OpcaoControle<T>[];
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

export function CargaLista<T extends string>({
  rotulo,
  opcoes,
  valor,
  onEscolher,
}: {
  rotulo: string;
  opcoes: readonly OpcaoControle<T>[];
  valor: T;
  onEscolher: (v: T) => void;
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
        onChange={(e) => onEscolher(e.target.value as T)}
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

/**
 * Alternância entre duas bases de comparação, com a explicação de cada uma sempre à vista: não basta o nome, porque "mesmos dias da
 * semana" e "mesmas datas" dão taxas diferentes para a mesma janela. Rádios nativos (teclado e leitor de tela do próprio navegador), cada
 * opção com alvo de 44 px; o estado escolhido leva o círculo cheio, além da cor, e todos os números da página seguem a escolha.
 */
export function CargaBase<T extends string>({
  legenda,
  opcoes,
  valor,
  onEscolher,
}: {
  legenda: string;
  opcoes: readonly { id: T; rotulo: string; explicacao: string }[];
  valor: T;
  onEscolher: (v: T) => void;
}) {
  const nome = useId();
  return (
    <fieldset className="min-w-0" data-controle="base-da-comparacao">
      <legend className="text-[0.8125rem] leading-snug text-carvao-muted">{legenda}</legend>
      <div className="mt-1.5 space-y-1.5">
        {opcoes.map((o) => {
          const ativo = o.id === valor;
          return (
            <label
              key={o.id}
              className={`flex min-h-[44px] cursor-pointer items-start gap-2.5 border px-2.5 py-1.5 focus-within:outline focus-within:outline-2 focus-within:outline-energia ${
                ativo ? "border-energia bg-energia-fundo text-carvao" : "border-linha bg-superficie text-carvao-muted hover:border-energia hover:text-carvao"
              }`}
            >
              <input type="radio" name={nome} value={o.id} checked={ativo} onChange={() => onEscolher(o.id)} className="sr-only" />
              <span aria-hidden="true" className="mt-[0.2rem] inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-carvao">
                {ativo && <span className="h-2 w-2 rounded-full bg-carvao" />}
              </span>
              <span className="block min-w-0">
                <span className="block text-sm font-medium leading-snug text-carvao">{o.rotulo}</span>
                <span className="mt-0.5 block text-xs leading-snug text-carvao-muted">{o.explicacao}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
