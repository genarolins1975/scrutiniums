"use client";

import { useId, useMemo, useState } from "react";
import { buscar, normalizarBusca, type ItemBusca } from "@/lib/energia/busca";

/**
 * Busca da página inicial (seção 6.2 A): pergunta, assunto (painel), página, conceito e distribuidora,
 * só sobre o que existe no observatório. O índice é montado no servidor a partir do
 * mesmo conteúdo que a página publica (páginas, perguntas, painéis, verbetes conferidos e
 * distribuidoras com ficha); a busca não inventa destino. Todas as palavras
 * digitadas precisam aparecer, sem diferença de acento ou maiúscula.
 */

export function BuscaObservatorio({ itens, exemplos }: { itens: ItemBusca[]; exemplos: string[] }) {
  const [consulta, setConsulta] = useState("");
  const id = useId();
  const r = useMemo(() => buscar(itens, consulta), [itens, consulta]);
  const digitou = normalizarBusca(consulta).length > 0;

  return (
    <div className="max-w-2xl" role="search" aria-label="Busca no observatório">
      <label htmlFor={`${id}-q`} className="rotulo text-mineral">
        Busque por pergunta, assunto, página, conceito ou distribuidora
      </label>
      <input
        id={`${id}-q`}
        type="search"
        value={consulta}
        onChange={(e) => setConsulta(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        aria-describedby={`${id}-s`}
        placeholder="Ex.: perdas, bandeira, CEMIG, reservatórios"
        className="mt-2 min-h-[44px] w-full border border-linha bg-superficie px-3 text-base text-carvao placeholder:text-mineral focus-visible:outline focus-visible:outline-2 focus-visible:outline-energia-dark"
      />
      <p id={`${id}-s`} aria-live="polite" className="mt-2 text-xs text-mineral">
        {!digitou
          ? `Sugestões: ${exemplos.join(", ")}.`
          : r.total === 0
            ? `Nada no observatório para "${consulta.trim()}". Tente outra palavra ou use o índice completo abaixo.`
            : r.total > r.itens.length
              ? `${r.total} resultados; os ${r.itens.length} mais próximos:`
              : `${r.total} ${r.total === 1 ? "resultado" : "resultados"}:`}
      </p>
      {r.itens.length > 0 && (
        <ul className="mt-2 divide-y divide-linha border border-linha bg-superficie">
          {r.itens.map((i) => (
            <li key={`${i.tipo}-${i.href}-${i.titulo}`}>
              <a href={i.href} className="flex min-h-[44px] flex-col justify-center px-3 py-2 hover:bg-papel">
                <span className="text-sm text-carvao">
                  <span className="rotulo mr-2 text-mineral">{i.tipo}</span>
                  {i.titulo}
                </span>
                {i.detalhe && <span className="mt-0.5 text-xs leading-snug text-carvao-muted">{i.detalhe}</span>}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
