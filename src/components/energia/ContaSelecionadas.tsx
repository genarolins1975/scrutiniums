"use client";

/**
 * Distribuidoras selecionadas (?dist=): cada uma é uma etiqueta com o botão de tirar, mais o botão de limpar tudo e um aviso quando o
 * limite descarta uma. A escolha vem de um clique numa barra, num ponto, numa linha da tabela ou de uma lista, e ela atravessa os
 * painéis da página; até aqui só se desfazia clicando de novo no mesmo item, sem nada à vista que dissesse o que estava escolhido ou
 * que uma quinta escolha tirava a mais antiga. O aviso é uma região viva: quem usa leitor de tela ouve o que saiu.
 */
export function ContaSelecionadas({
  ids,
  rotulo,
  aoTirar,
  aoLimpar,
  aviso,
  limite,
}: {
  ids: readonly string[];
  /** Nome exibido de cada CNPJ. */
  rotulo: (id: string) => string;
  aoTirar: (id: string) => void;
  aoLimpar: () => void;
  /** O que o limite descartou na última escolha, dito em uma frase; null quando nada saiu. */
  aviso?: string | null;
  limite: number;
}) {
  return (
    <div className="min-w-0" data-selecionadas="">
      {ids.length > 0 && (
        <div>
          <p className="rotulo text-mineral">
            Selecionadas ({ids.length} de até {limite})
          </p>
          <ul className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1" aria-label="Distribuidoras selecionadas">
            {ids.map((id) => (
              <li key={id}>
                <span className="inline-flex min-h-[44px] items-center gap-0.5 border border-energia bg-energia-fundo pl-2.5 text-sm text-carvao">
                  {rotulo(id)}
                  <button
                    type="button"
                    onClick={() => aoTirar(id)}
                    aria-label={`Tirar ${rotulo(id)} da seleção`}
                    className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-carvao-muted hover:text-carvao focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-energia"
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </span>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={aoLimpar}
                className="inline-flex min-h-[44px] items-center px-2 text-sm text-energia-dark underline underline-offset-4 hover:text-carvao focus-visible:outline focus-visible:outline-2 focus-visible:outline-energia"
              >
                Limpar seleção
              </button>
            </li>
          </ul>
        </div>
      )}
      <p role="status" aria-live="polite" className={aviso ? "mt-1 text-sm text-carvao-muted" : "sr-only"} data-aviso-limite="">
        {aviso ?? ""}
      </p>
    </div>
  );
}
