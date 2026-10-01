"use client";

import { useId, type ReactNode } from "react";

/**
 * Controles e peças de marcação das páginas da Geração, usados tanto pela página do
 * servidor quanto pelos componentes cliente que guardam o recorte na URL: grupo de opções
 * (rádios nativos com aparência de botão, alvo de 44 px, setas do teclado do próprio
 * navegador), lista de seleção nativa, o recorte do painel (período, universo e unidade)
 * e o aviso que muda a leitura. Escolher cria entrada no histórico (useEstadoUrl) e o
 * voltar desfaz.
 */

export type OpcaoGeracao<T extends string> = { id: T; rotulo: string; detalhe?: string };

export function GeracaoEscolha<T extends string>({
  legenda,
  opcoes,
  valor,
  onEscolher,
}: {
  legenda: string;
  opcoes: readonly OpcaoGeracao<T>[];
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
              {/* o detalhe (nome por extenso, o que a opção mostra) também chega ao leitor de tela e ao toque, não só ao passar o mouse */}
              {o.detalhe && o.detalhe !== o.rotulo && <span className="sr-only">: {o.detalhe}</span>}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function GeracaoLista<T extends string>({
  rotulo,
  opcoes,
  valor,
  onEscolher,
}: {
  rotulo: string;
  opcoes: readonly OpcaoGeracao<T>[];
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

/** Período, universo e unidade do painel, logo abaixo da resposta (anatomia da seção 7.2, item 3). */
export function GeracaoRecorte({ periodo, universo, unidade }: { periodo: ReactNode; universo: ReactNode; unidade: ReactNode }) {
  return (
    <dl className="grid gap-x-6 gap-y-1 text-xs text-carvao-muted sm:grid-cols-3">
      <div className="min-w-0">
        <dt className="rotulo text-mineral">Período</dt>
        <dd className="mt-0.5">{periodo}</dd>
      </div>
      <div className="min-w-0">
        <dt className="rotulo text-mineral">Universo</dt>
        <dd className="mt-0.5">{universo}</dd>
      </div>
      <div className="min-w-0">
        <dt className="rotulo text-mineral">Unidade</dt>
        <dd className="mt-0.5">{unidade}</dd>
      </div>
    </dl>
  );
}

/** Aviso que muda a leitura (fonte defasada, ausência legítima, comparação incompatível). */
export function GeracaoAviso({ children, tipo = "nota" }: { children: ReactNode; tipo?: "nota" | "alerta" }) {
  return (
    <p
      role={tipo === "alerta" ? "alert" : undefined}
      className={`border-l-2 pl-3 text-sm leading-relaxed [overflow-wrap:anywhere] ${tipo === "alerta" ? "border-aviso text-carvao" : "border-mineral text-carvao-muted"}`}
    >
      {children}
    </p>
  );
}
