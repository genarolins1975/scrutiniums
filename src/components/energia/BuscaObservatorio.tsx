"use client";

import { useId, useMemo, useState } from "react";
import { buscar, moverAtivo, normalizarBusca, type ItemBusca } from "@/lib/energia/busca";

/**
 * Busca da página inicial (seção 6.2 A): pergunta, assunto (painel), página, conceito e distribuidora,
 * só sobre o que existe no observatório. O índice é montado no servidor a partir do
 * mesmo conteúdo que a página publica (páginas, perguntas, painéis, verbetes conferidos e
 * distribuidoras com ficha); a busca não inventa destino. Todas as palavras
 * digitadas precisam começar alguma palavra do item, sem diferença de acento ou maiúscula; "o que é" e as
 * demais palavras de pergunta não contam. A sigla digitada por inteiro leva ao verbete antes de qualquer
 * outro item, e os nomes de quem não conhece a sigla ("preço da luz", "apagão", "congestionamento")
 * levam à página que trata do assunto; nesse caso o resultado mostra o termo que casou
 * (busca.ts e busca-sinonimos.ts). Município não está no índice (são milhares): quem digita um nome
 * de cidade é levado a Minha região.
 *
 * Teclado no padrão combobox: o foco fica no campo; as setas percorrem os resultados, Enter abre o
 * resultado ativo e Esc fecha a lista (depois, limpa o campo). O leitor de tela recebe o resultado ativo
 * por aria-activedescendant e a contagem por região viva.
 */
export function BuscaObservatorio({ itens, exemplos, regiao }: { itens: ItemBusca[]; exemplos: string[]; regiao: { href: string; rotulo: string } }) {
  const [consulta, setConsulta] = useState("");
  const [aberta, setAberta] = useState(true);
  const [ativo, setAtivo] = useState(-1);
  const id = useId();
  const r = useMemo(() => buscar(itens, consulta), [itens, consulta]);
  const digitou = normalizarBusca(consulta).length > 0;
  const mostra = digitou && aberta && r.itens.length > 0;
  const opcao = (i: number) => `${id}-op-${i}`;
  const abrir = (i: number) => document.getElementById(opcao(i))?.querySelector("a")?.click();

  return (
    <div className="max-w-2xl" role="search" aria-label="Busca no observatório">
      <label htmlFor={`${id}-q`} className="rotulo text-mineral">
        Busque por pergunta, assunto, página, conceito ou distribuidora
      </label>
      <input
        id={`${id}-q`}
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={mostra}
        aria-controls={`${id}-lista`}
        aria-activedescendant={mostra && ativo >= 0 ? opcao(ativo) : undefined}
        value={consulta}
        onChange={(e) => {
          setConsulta(e.target.value);
          setAberta(true);
          setAtivo(-1);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            const prox = moverAtivo(mostra ? ativo : -1, e.key, r.itens.length);
            if (prox === null) return;
            e.preventDefault();
            setAberta(true);
            setAtivo(prox);
          } else if (e.key === "Enter" && mostra && ativo >= 0 && ativo < r.itens.length) {
            e.preventDefault();
            abrir(ativo);
          } else if (e.key === "Escape") {
            if (mostra) {
              e.preventDefault();
              setAberta(false);
              setAtivo(-1);
            } else if (consulta) {
              e.preventDefault();
              setConsulta("");
            }
          }
        }}
        autoComplete="off"
        spellCheck={false}
        aria-describedby={`${id}-s ${id}-aj`}
        placeholder="Ex.: preço da luz, DEC, CEMIG"
        className="mt-2 min-h-[44px] w-full border border-linha bg-superficie px-3 text-base text-carvao placeholder:text-mineral focus-visible:outline focus-visible:outline-2 focus-visible:outline-energia-dark"
      />
      <p id={`${id}-aj`} className="sr-only">
        Digite parte do nome. As setas percorrem os resultados, Enter abre o resultado escolhido e Esc fecha a lista.
      </p>
      <p id={`${id}-s`} aria-live="polite" className="mt-2 text-xs text-mineral">
        {!digitou
          ? `Sugestões: ${exemplos.join(", ")}.`
          : r.total === 0
            ? `Nada no observatório para "${consulta.trim()}". Tente outra palavra ou use o índice completo abaixo.`
            : r.parcial
              ? `Nenhum item reúne todas as palavras; ${r.total === 1 ? "1 tem parte delas" : `${r.total} têm parte delas`}, ${r.itens.length === 1 ? "o mais próximo" : `os ${r.itens.length} mais próximos`}:`
              : r.total > r.itens.length
                ? `${r.total} resultados; os ${r.itens.length} mais próximos:`
                : `${r.total} ${r.total === 1 ? "resultado" : "resultados"}:`}
      </p>
      {/* a lista existe sempre (aria-controls aponta para ela) e só aparece com resultado e aberta */}
      <ul id={`${id}-lista`} role="listbox" hidden={!mostra} aria-label="Resultados da busca" className="mt-2 divide-y divide-linha border border-linha bg-superficie">
        {r.itens.map((i, n) => (
          <li
            key={`${i.tipo}-${i.href}-${i.titulo}`}
            id={opcao(n)}
            role="option"
            aria-selected={n === ativo}
            onClick={(e) => {
              // o leitor de tela ativa a opção, não o link dentro dela
              if (e.target === e.currentTarget) abrir(n);
            }}
            // a opção ativa não depende só de um fundo quase branco: leva também uma barra no acento
            className={n === ativo ? "bg-energia-fundo shadow-[inset_4px_0_0_var(--cor-energia)]" : "hover:bg-papel"}
          >
            <a href={i.href} tabIndex={-1} className="flex min-h-[44px] flex-col justify-center px-3 py-2">
              <span className="text-sm text-carvao">
                <span className="rotulo mr-2 text-mineral">{i.tipo}</span>
                {i.titulo}
              </span>
              {i.detalhe && <span className="mt-0.5 text-xs leading-snug text-carvao-muted">{i.detalhe}</span>}
              {i.viaSinonimo && <span className="mt-0.5 text-xs leading-snug text-mineral">Termo relacionado: {i.viaSinonimo}</span>}
            </a>
          </li>
        ))}
      </ul>
      {digitou && (
        <p className="mt-2 text-xs text-carvao-muted">
          Procura um município? A busca por cidade está em{" "}
          <a href={regiao.href} className="inline-flex min-h-[24px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
            {regiao.rotulo}
          </a>
          .
        </p>
      )}
    </div>
  );
}
