"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { buscar, emOrdemDeTela, type Resultado } from "@/lib/busca/buscar";
import type { IndiceBusca } from "@/lib/busca/tipos";
import { medirBusca } from "@/lib/busca/medir";
import { useSessao } from "@/components/acesso/sessao";
import { ListaResultados } from "./ListaResultados";

// um só download por página, compartilhado pelos campos dela; falha de rede libera uma nova tentativa no próximo foco
let carga: Promise<IndiceBusca | null> | null = null;
function carregarIndice(): Promise<IndiceBusca | null> {
  carga ??= fetch("/busca/indice.json")
    .then((r) => (r.ok ? (r.json() as Promise<IndiceBusca>) : null))
    .catch(() => null)
    .then((i) => {
      if (!i) carga = null;
      return i;
    });
  return carga;
}

/** Atalho de teclado fora de um campo de texto: "/" e Ctrl K (⌘ K no Mac). */
function ehAtalho(e: globalThis.KeyboardEvent): boolean {
  const alvo = e.target as HTMLElement | null;
  const digitando = !!alvo && (alvo.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName));
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k") return true;
  return e.key === "/" && !digitando && !e.ctrlKey && !e.metaKey && !e.altKey;
}

const ROTULO = "Buscar na Scrutiniums";

function Lupa({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="6.75" cy="6.75" r="5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.5 10.5L14.5 14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
  );
}

/**
 * Busca da plataforma (Iniciativa 3 do parecer de UX de 21/10/2026): um campo que procura no índice único
 * (/busca/indice.json, montado do registro e dos catálogos por src/lib/busca/indice.ts) e lista coleções, páginas, perguntas,
 * consultas, métodos e verbetes, agrupados por observatório e coleção, com o selo "com conta" nos destinos fechados para quem
 * não tem sessão. O índice só desce no primeiro foco e fica em memória.
 *
 * Sem JavaScript é um formulário GET para /buscar?q=, que renderiza os mesmos resultados no servidor. Com JavaScript, o padrão
 * combobox: as setas percorrem a lista (aria-activedescendant), Enter abre o resultado ativo ou o primeiro, Esc fecha e devolve
 * o foco a quem o tinha. Sem resultado, Enter leva à página /buscar.
 *
 * `variante="barra"` (BarraPlataforma): campo compacto na linha da marca; abaixo de 640 px, uma lupa de 44 px que abre a busca
 * em tela cheia; "/" e Ctrl K levam ao campo, sem animação. `variante="pagina"`: o campo dentro de uma página (entrada de uma
 * coleção, mapa da conta), que com `filtro` procura só na coleção e oferece a busca em toda a plataforma.
 */
export function BuscaPlataforma({
  variante = "barra",
  exemplo,
  filtro,
  rotulo = ROTULO,
}: {
  variante?: "barra" | "pagina";
  /** Texto de exemplo do campo (EXEMPLO_DO_CAMPO, lido no servidor). */
  exemplo: string;
  /** Só os destinos de uma coleção do registro, com o nome dela para o aviso. */
  filtro?: { colecao: string; nome: string };
  rotulo?: string;
}) {
  const id = useId();
  const sessao = useSessao();
  const [termo, setTermo] = useState("");
  const [indice, setIndice] = useState<IndiceBusca | null>(null);
  const [aberta, setAberta] = useState(false);
  const [ativo, setAtivo] = useState(-1);
  const [folha, setFolha] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  const lupa = useRef<HTMLButtonElement>(null);
  const voltarPara = useRef<HTMLElement | null>(null);
  const barra = variante === "barra";

  const resposta = useMemo(() => (indice && termo.trim() ? buscar(indice, termo, { colecao: filtro?.colecao }) : null), [indice, termo, filtro?.colecao]);
  const lista = useMemo(() => (resposta ? emOrdemDeTela(resposta.grupos) : []), [resposta]);
  const mostra = aberta && !!resposta;
  const opcao = (n: number) => `${id}-op-${n}`;
  const paraTudo = `/buscar${termo.trim() ? `?q=${encodeURIComponent(termo.trim())}` : ""}`;

  function preparar() {
    setAberta(true);
    if (!indice) carregarIndice().then((i) => i && setIndice(i));
  }

  function abrirFolha() {
    setFolha(true);
    preparar();
  }

  function fechar(devolver: boolean) {
    setAberta(false);
    setAtivo(-1);
    if (folha) {
      setFolha(false);
      if (devolver) lupa.current?.focus();
    } else if (devolver) {
      // volta a quem tinha o foco antes do atalho; sem ninguém (o leitor clicou no campo), o campo só perde o foco
      const antes = voltarPara.current;
      if (antes && antes !== document.body && antes.isConnected) antes.focus();
      else campo.current?.blur();
    }
    voltarPara.current = null;
  }

  // a folha em tela cheia recebe o foco ao abrir; a página atrás não rola
  useEffect(() => {
    if (!folha) return;
    campo.current?.focus();
    const antes = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = antes;
    };
  }, [folha]);

  // "/" e Ctrl K levam à busca da barra de qualquer ponto da página, sem animação (é ação de teclado, repetida)
  useEffect(() => {
    if (!barra) return;
    const aoTeclar = (e: globalThis.KeyboardEvent) => {
      if (!ehAtalho(e)) return;
      e.preventDefault();
      if (document.activeElement !== campo.current) voltarPara.current = document.activeElement as HTMLElement | null;
      if (window.matchMedia("(max-width: 639px)").matches) abrirFolha();
      else {
        campo.current?.focus();
        preparar();
      }
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  });

  /** Abre o resultado da posição n (o link dele, que já sabe se pré-carrega), contando a busca uma vez. */
  function abrir(n: number): boolean {
    const r = lista[n];
    if (!r?.href) return false;
    const a = document.getElementById(opcao(n))?.querySelector("a");
    if (!a) return false;
    a.click();
    return true;
  }

  function escolheu(r: Resultado) {
    medirBusca(termo);
    if (r.href) fechar(false);
  }

  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    // com resultado à vista, Enter abre o ativo ou o primeiro com página; sem ele, o formulário segue para /buscar
    if (!mostra || lista.length === 0) return;
    const alvo = ativo >= 0 ? ativo : lista.findIndex((r) => r.href);
    if (alvo >= 0 && abrir(alvo)) e.preventDefault();
  }

  function aoTeclarNoCampo(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!lista.length) return;
      e.preventDefault();
      setAberta(true);
      setAtivo((a) => (e.key === "ArrowDown" ? Math.min(a + 1, lista.length - 1) : a <= 0 ? lista.length - 1 : a - 1));
    } else if (e.key === "Escape") {
      e.preventDefault();
      fechar(true);
    }
  }

  const classe = barra ? "bp-busca" : "bp-busca bp-busca--pagina";
  return (
    <div className={classe} data-busca-plataforma="" data-folha={folha ? "" : undefined}>
      {barra && (
        <button ref={lupa} type="button" className="bp-busca-lupa" aria-label={rotulo} aria-haspopup="dialog" aria-expanded={folha} onClick={abrirFolha}>
          <Lupa />
        </button>
      )}
      <div
        className="bp-busca-caixa"
        role={folha ? "dialog" : undefined}
        aria-modal={folha || undefined}
        aria-label={folha ? rotulo : undefined}
        onBlur={(e) => {
          // fora da folha, a lista fecha quando o foco sai do campo e dela
          if (!folha && !e.currentTarget.contains(e.relatedTarget as Node | null)) setAberta(false);
        }}
      >
        <form action="/buscar" method="get" role="search" aria-label={rotulo} className="bp-busca-form" onSubmit={aoEnviar}>
          <label htmlFor={`${id}-q`} className="sr-only">
            {rotulo}
          </label>
          <Lupa className="bp-busca-icone" />
          <input
            ref={campo}
            id={`${id}-q`}
            name="q"
            type="search"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={mostra}
            aria-controls={`${id}-lista`}
            aria-activedescendant={mostra && ativo >= 0 ? opcao(ativo) : undefined}
            aria-describedby={`${id}-estado`}
            value={termo}
            onChange={(e) => {
              setTermo(e.target.value);
              setAtivo(-1);
              preparar();
            }}
            onFocus={preparar}
            onKeyDown={aoTeclarNoCampo}
            placeholder={exemplo}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            maxLength={120}
            className="bp-busca-campo"
          />
          {barra && (
            <kbd className="bp-busca-tecla" aria-hidden="true">
              /
            </kbd>
          )}
          {folha && (
            <button type="button" className="bp-busca-fechar" onClick={() => fechar(true)}>
              Fechar
            </button>
          )}
        </form>
        <div className="bp-busca-painel" hidden={!mostra && !folha}>
          <p id={`${id}-estado`} className="bp-busca-estado" aria-live="polite">
            {!termo.trim()
              ? folha || mostra
                ? `Coleções, páginas, perguntas, consultas e verbetes${filtro ? ` de ${filtro.nome}` : " da Scrutiniums"}.`
                : ""
              : !indice
                ? "Carregando o índice…"
                : lista.length === 0
                  ? ""
                  : resposta?.cortado
                    ? `Os ${lista.length} primeiros resultados.`
                    : `${lista.length} ${lista.length === 1 ? "resultado" : "resultados"}.`}
          </p>
          <div id={`${id}-lista`} role="listbox" aria-label="Resultados da busca" className="bp-busca-lista">
            {resposta && (
              <ListaResultados grupos={resposta.grupos} comSessao={sessao} opcao={{ id: opcao, ativa: ativo, aoEscolher: escolheu }} />
            )}
          </div>
          {resposta && lista.length === 0 && (
            <p className="bp-busca-vazio">
              Nenhum resultado para <q>{termo.trim()}</q>
              {filtro ? ` em ${filtro.nome}` : ""}.{" "}
              <Link href="/buscar" prefetch={false}>
                Veja as coleções
              </Link>
              .
            </p>
          )}
          {termo.trim() && indice && (
            <p className="bp-busca-rodape">
              <Link href={paraTudo} prefetch={false} onClick={() => fechar(false)}>
                {filtro ? "Buscar em toda a plataforma" : "Ver na página de busca"} <span aria-hidden="true">→</span>
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
