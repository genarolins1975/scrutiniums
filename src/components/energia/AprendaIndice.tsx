"use client";

import Link from "@/components/energia/LinkSemPrefetch";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { LinkDoPainel } from "@/components/energia/LinkDoPainel";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { buscarVerbetes } from "@/lib/energia/aprenda-busca";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
// só tipos: o acervo de verbetes fica no servidor, e o cliente recebe a lista pronta
import type { GrupoDoIndice, ItemDoIndice } from "@/lib/energia/conteudo/aprenda-indice";

const ESQUEMA = { q: campo(tiposUrl.texto({ max: 80 }), "", { param: "q", historico: "replace" }) };

/** Marca de estado ao lado do verbete: só o que foge do padrão (conferido sem ressalva não leva marca; a legenda da lista diz isso). */
const SELO: Record<ItemDoIndice["estado"], string | null> = {
  conferido: null,
  ressalva: "◐ com ressalva",
  preparacao: "○ em preparação, sem definição publicada",
};

/**
 * Linha de um verbete no índice: a pergunta prática primeiro, depois a sigla e o nome, e à direita o link direto para o painel onde o
 * conceito aparece. A pergunta leva ao verbete; verbete em preparação não tem pergunta (não há definição a reformular) e abre pelo nome,
 * com a marca visível. Duas ações por linha, cada uma com alvo de 44 px.
 */
function Linha({ i, comTema = false }: { i: ItemDoIndice; comTema?: boolean }) {
  const selo = SELO[i.estado];
  const nome = i.subtitulo ? `${i.titulo} · ${i.subtitulo}` : i.titulo;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 border-t border-linha" data-verbete={i.slug} data-estado={i.estado}>
      <Link href={`/setor-eletrico/aprenda/${i.slug}`} className="group block min-h-[44px] min-w-0 py-3">
        {i.pergunta ? (
          <>
            <span className="block font-serif text-[1.0625rem] leading-snug text-carvao group-hover:text-energia-dark" data-pergunta="">
              {i.pergunta}
            </span>
            <span className="mt-1 block text-sm leading-snug text-carvao-muted" data-nome="">
              <span className="font-medium text-carvao">{i.titulo}</span>
              {i.subtitulo && ` · ${i.subtitulo}`}
              {comTema && <span className="text-mineral">{` · ${i.grupo}`}</span>}
            </span>
          </>
        ) : (
          <span className="block font-serif text-[1.0625rem] leading-snug text-carvao group-hover:text-energia-dark" data-nome="">
            {nome}
            {comTema && <span className="font-sans text-sm text-mineral">{` · ${i.grupo}`}</span>}
          </span>
        )}
        {selo && (
          <span className="mt-1 block text-xs leading-snug text-aviso" data-selo="">
            {selo}
          </span>
        )}
      </Link>
      {i.painel && (
        <Link
          href={i.painel.href}
          className="-mr-1 inline-flex min-h-[44px] min-w-[44px] flex-col items-end justify-center py-2 pl-2 pr-1 text-right text-sm text-energia-dark hover:text-carvao"
          data-painel=""
        >
          <span className="underline underline-offset-4">
            Ver no painel<span aria-hidden="true"> →</span>
          </span>
          {/* o nome do painel fica à vista a partir de 768 px e, abaixo disso, só para leitor de tela: o nome acessível do link o inclui sempre */}
          <span className="mt-0.5 max-w-[14rem] text-xs leading-snug text-mineral max-md:sr-only">{i.painel.rotulo}</span>
        </Link>
      )}
    </li>
  );
}

const plural = (n: number) => `${n} ${n === 1 ? "verbete" : "verbetes"}`;

/**
 * A lista por tema, em duas apresentações do mesmo conteúdo, escolhidas por CSS (sem salto na hidratação):
 *  - a partir de 768 px, todos os temas abertos, uma linha por verbete (a página é lida de cima a baixo e cada pergunta cabe numa linha);
 *  - abaixo de 768 px, um tema por vez, recolhido, com a prévia dos verbetes (sigla ou nome) e a contagem: 48 linhas abertas teriam mais de
 *    dez telas no celular, e a prévia deixa ver o acervo inteiro de relance. O que não está à vista não some: está no HTML e abre por toque.
 * Só a apresentação à vista conta para leitor de tela e para a busca do navegador; o link #g-<tema> leva ao tema nas duas.
 */
function ListaPorTema({ grupos }: { grupos: GrupoDoIndice[] }) {
  return (
    <>
      <div className="md:hidden" data-lista="recolhida">
        {grupos.map((g) => (
          <details key={g.id} id={g.id} className="group scroll-mt-28 border-t border-linha last:border-b">
            <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-4 py-2 [&::-webkit-details-marker]:hidden">
              <span className="min-w-0">
                <h3 className="ed-h3 font-serif text-carvao">{g.nome}</h3>
                <span className="mt-0.5 block text-sm leading-snug text-carvao-muted" data-previa="true">
                  {g.itens.map((i) => i.titulo).join(", ")}
                </span>
              </span>
              <span className="shrink-0 whitespace-nowrap text-sm text-carvao-muted">
                {plural(g.itens.length)} <span aria-hidden="true" className="inline-block motion-safe:transition-transform group-open:rotate-180">▾</span>
              </span>
            </summary>
            <ul className="pb-2">
              {g.itens.map((i) => (
                <Linha key={i.slug} i={i} />
              ))}
            </ul>
          </details>
        ))}
      </div>
      <div className="hidden space-y-8 md:block" data-lista="aberta">
        {grupos.map((g) => (
          <section key={g.id} id={`${g.id}-lista`} aria-labelledby={`${g.id}-titulo`} className="scroll-mt-28">
            <h3 id={`${g.id}-titulo`} className="ed-h3 flex flex-wrap items-baseline gap-x-3 font-serif text-carvao">
              {g.nome}
              <span className="font-sans text-xs font-normal text-carvao-muted">{plural(g.itens.length)}</span>
            </h3>
            <ul className="mt-2 border-b border-linha">
              {g.itens.map((i) => (
                <Linha key={i.slug} i={i} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

/**
 * Índice dos verbetes: busca por pergunta, sigla, nome ou palavra do texto (guardada em ?q=, para o resultado ser um link) e, sem busca,
 * as trilhas e a lista de todos os verbetes por tema, cada um numa linha curta com a pergunta prática, o nome e o link ao painel.
 *
 * Todo verbete está no HTML do servidor (a lista por tema não depende de JavaScript, a busca do navegador e a impressão a leem inteira).
 * A busca só troca o que vem abaixo dela: os resultados, na ordem de quem tem o termo na sigla ou no nome, depois na pergunta, depois no
 * texto. Termo sem resultado não diz que o conceito não existe: diz que nenhum verbete publicado o traz e lembra o escopo do acervo.
 * Em tela larga as trilhas ficam numa coluna ao lado da lista, que acompanha a rolagem; em tela estreita vêm entre a busca e a lista.
 */
export function AprendaIndice({
  grupos,
  trilhas,
  estados,
}: {
  grupos: GrupoDoIndice[];
  /** Bloco das trilhas, montado no servidor; aparece só quando não há busca. */
  trilhas: ReactNode;
  /** Frase do acervo: quantos verbetes estão conferidos e o que cada marca quer dizer (lida do acervo, nunca escrita aqui). */
  estados: string;
}) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const campoBusca = useRef<HTMLInputElement>(null);
  const todos = useMemo(() => grupos.flatMap((g) => g.itens), [grupos]);
  const achados = useMemo(() => buscarVerbetes(todos, v.q), [todos, v.q]);

  // link com #g-<tema>: no celular abre o tema recolhido; em tela larga leva à lista aberta do tema
  useEffect(() => {
    const abre = () => {
      let id = window.location.hash.slice(1);
      try {
        id = decodeURIComponent(id);
      } catch {
        // âncora com % malformado: vale o texto cru
      }
      if (!id.startsWith("g-")) return;
      const el = document.getElementById(id);
      if (el instanceof HTMLDetailsElement && el.getClientRects().length > 0) {
        el.open = true;
        el.scrollIntoView();
      } else if (el) {
        document.getElementById(`${id}-lista`)?.scrollIntoView();
      }
    };
    abre();
    window.addEventListener("hashchange", abre);
    return () => window.removeEventListener("hashchange", abre);
  }, []);

  const limpar = () => {
    definir({ q: "" });
    campoBusca.current?.focus();
  };

  return (
    <div data-aprenda-indice="" className={achados ? "" : "lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-x-12"}>
      <div className="lg:col-start-1 lg:row-start-1">
        <div id="busca" role="search" aria-label="Busca de verbetes" className="scroll-mt-28 border-t border-linha py-6 [@media(scripting:none)]:hidden">
          <label htmlFor="aprenda-busca" className="ed-h3 block font-serif text-carvao">
            O que você quer entender?
          </label>
          <input
            ref={campoBusca}
            id="aprenda-busca"
            type="search"
            value={v.q}
            onChange={(e) => definir({ q: e.target.value })}
            placeholder="Pergunta, sigla ou palavra: PLD, garantia física, perdas"
            autoComplete="off"
            spellCheck={false}
            aria-describedby="aprenda-busca-contagem"
            className="mt-2 block min-h-[44px] w-full max-w-xl border border-linha bg-superficie px-3 text-base text-carvao placeholder:text-mineral hover:border-energia"
          />
          <p id="aprenda-busca-contagem" role="status" className="mt-2 text-sm text-carvao-muted">
            {achados
              ? achados.length === 0
                ? "Nenhum verbete publicado tem esse termo."
                : `${achados.length} ${achados.length === 1 ? "verbete" : "verbetes"} com esse termo.`
              : `${todos.length} verbetes em ${grupos.length} temas. Procure um termo ou veja a lista por tema.`}
          </p>
          {achados && achados.length > 1 && (
            <p className="text-xs text-carvao-muted">Primeiro os que têm o termo na sigla ou no nome, depois os que o têm na pergunta ou no texto.</p>
          )}
          {achados && (
            <div className="mt-1 flex flex-wrap items-center gap-x-5">
              <button
                type="button"
                onClick={limpar}
                className="inline-flex min-h-[44px] items-center text-sm text-energia-dark underline underline-offset-4 hover:text-carvao"
              >
                Limpar a busca
              </button>
              <LinkDoPainel ancora="busca" rotulo="Copiar link desta busca" />
            </div>
          )}
        </div>
        <noscript>
          <p className="border-t border-linha py-4 text-sm text-carvao-muted">A busca precisa de JavaScript. Os {todos.length} verbetes estão todos na lista por tema, mais abaixo.</p>
        </noscript>
      </div>

      {achados ? (
        <section aria-labelledby="aprenda-resultados" className="border-t border-linha pt-4">
          <h2 id="aprenda-resultados" className="sr-only">
            Resultados da busca
          </h2>
          {achados.length === 0 ? (
            <p className="max-w-prose2 pb-6 text-base leading-relaxed text-carvao" data-sem-resultado="">
              Nenhum verbete publicado tem esse termo na pergunta, no nome, na sigla ou no texto. Isso não quer dizer que o conceito não exista: os verbetes cobrem os conceitos
              que aparecem nos painéis deste observatório, não todo o vocabulário do setor.
            </p>
          ) : (
            <ul className="grid gap-x-12 border-b border-linha lg:grid-cols-2">
              {achados.map((i) => (
                <Linha key={i.slug} i={i} comTema />
              ))}
            </ul>
          )}
        </section>
      ) : (
        <>
          <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start lg:sticky lg:top-4">{trilhas}</div>
          <section aria-labelledby="aprenda-todos" className="mt-6 border-t border-linha pt-6 lg:col-start-1 lg:row-start-2 lg:mt-0">
            <h2 id="aprenda-todos" className="ed-h2 font-serif text-carvao">
              Todos os verbetes, por tema
            </h2>
            <p className="mt-2 max-w-prose2 text-sm leading-relaxed text-carvao-muted" data-estados-do-acervo="">
              {estados}
            </p>
            <div className="mt-4">
              <ListaPorTema grupos={grupos} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
