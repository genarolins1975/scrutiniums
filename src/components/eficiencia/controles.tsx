"use client";

/**
 * Controles locais do painel: seleção em lista e alternância de poucas opções, ambos com alvo de 44 px.
 *
 * A seleção mantém o `select` nativo (teclado, leitor de tela e seletor do celular), mas o texto da opção escolhida é
 * desenhado numa caixa visível que quebra linha, porque o `select` nativo corta em reticências o que não cabe na largura
 * (nomes de medida chegam a 60 caracteres). O `select` fica transparente por cima da caixa, borda incluída (alvo de 44 px inteiro), e recebe todo toque e foco.
 */

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
  const atual = opcoes.find((o) => o.v === valor)?.t ?? "";
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="rotulo block text-carvao-muted">
        {rotulo}
      </label>
      <div
        className={`relative mt-1.5 flex min-h-[44px] w-full items-center gap-2 border border-linha bg-superficie px-3 py-2 text-[0.95rem] leading-snug focus-within:outline focus-within:outline-2 focus-within:outline-obee ${
          desabilitado ? "text-mineral" : "text-obee-tinta hover:border-obee"
        }`}
      >
        <span aria-hidden="true" className="min-w-0 flex-1 [overflow-wrap:anywhere]">
          {atual}
        </span>
        <svg aria-hidden="true" width="12" height="8" viewBox="0 0 12 8" className="shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M1 1.5l5 5 5-5" />
        </svg>
        <select
          id={id}
          value={valor}
          disabled={desabilitado}
          aria-describedby={`${id}-ajuda`}
          onChange={(e) => aoMudar(e.target.value)}
          className="absolute -left-px -top-px h-[calc(100%+2px)] w-[calc(100%+2px)] cursor-pointer opacity-0 disabled:cursor-not-allowed"
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
      </div>
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
      <div className={`${rotuloVisivel ? "mt-1.5 " : ""}inline-flex max-w-full flex-wrap border border-linha bg-superficie`}>
        {opcoes.map((o) => (
          <label
            key={o.v}
            className={`relative inline-flex min-h-[44px] cursor-pointer items-center px-3 text-sm focus-within:outline focus-within:outline-2 focus-within:outline-obee ${
              valor === o.v ? "bg-obee-fundo font-semibold text-obee-tinta shadow-[inset_0_-3px_0_0_currentColor]" : "text-carvao-muted hover:text-obee-tinta"
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

