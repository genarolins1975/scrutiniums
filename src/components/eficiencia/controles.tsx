"use client";

/** Controles locais do painel: seleção em lista e alternância de poucas opções, ambos com alvo de 44 px. */

export function Selecao({
  id,
  rotulo,
  ajuda,
  valor,
  opcoes,
  aoMudar,
  desabilitado,
}: {
  id: string;
  rotulo: string;
  ajuda: string;
  valor: string;
  opcoes: { v: string; t: string; desab?: boolean; grupo?: string }[];
  aoMudar: (v: string) => void;
  desabilitado?: boolean;
}) {
  const grupos = Array.from(new Set(opcoes.map((o) => o.grupo ?? "")));
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="rotulo block text-carvao-muted">
        {rotulo}
      </label>
      <select
        id={id}
        value={valor}
        disabled={desabilitado}
        aria-describedby={`${id}-ajuda`}
        onChange={(e) => aoMudar(e.target.value)}
        className="mt-1.5 block min-h-[44px] w-full border border-linha bg-superficie px-3 text-[0.95rem] text-obee-tinta hover:border-obee disabled:text-mineral"
      >
        {grupos.map((g) => {
          const itens = opcoes
            .filter((o) => (o.grupo ?? "") === g)
            .map((o) => (
              <option key={o.v} value={o.v} disabled={o.desab}>
                {o.t}
              </option>
            ));
          return g ? (
            <optgroup key={g} label={g}>
              {itens}
            </optgroup>
          ) : (
            itens
          );
        })}
      </select>
      <p id={`${id}-ajuda`} className="mt-1 text-xs leading-snug text-carvao-muted">
        {ajuda}
      </p>
    </div>
  );
}

export function Alternancia<T extends string>({
  rotulo,
  valor,
  opcoes,
  aoMudar,
  rotuloVisivel = true,
}: {
  rotulo: string;
  valor: T;
  opcoes: { v: T; t: string }[];
  aoMudar: (v: T) => void;
  /** false: o rótulo fica só para leitores de tela (alternâncias cujo sentido o próprio texto das opções já dá) */
  rotuloVisivel?: boolean;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className={rotuloVisivel ? "rotulo text-carvao-muted" : "sr-only"}>{rotulo}</legend>
      <div className={`${rotuloVisivel ? "mt-1.5 " : ""}inline-flex border border-linha bg-superficie`}>
        {opcoes.map((o) => (
          <label
            key={o.v}
            className={`relative inline-flex min-h-[44px] cursor-pointer items-center px-3 text-sm focus-within:outline focus-within:outline-2 focus-within:outline-obee ${
              valor === o.v ? "bg-obee-fundo font-semibold text-obee-tinta" : "text-carvao-muted hover:text-obee-tinta"
            }`}
          >
            <input type="radio" className="sr-only" name={rotulo} value={o.v} checked={valor === o.v} onChange={() => aoMudar(o.v)} />
            {o.t}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

