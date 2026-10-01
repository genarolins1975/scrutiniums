"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { dominioBonito, escalaLinear, rotuloTick, type Dominio, type EscalaLinear } from "@/lib/energia/escalas";
import { LIMITE_COMPARACAO, alternarSelecao, buscarEntidades, type EntidadeBuscavel } from "@/lib/energia/tabela";

/**
 * Comparador de até quatro entidades (distribuidoras, submercados, usinas,
 * estados): a especificação pede comparação "com limite que preserve a
 * leitura" (seção 7.3). Mais que quatro painéis lado a lado deixam de ser
 * comparáveis de relance.
 *
 * - Combobox acessível (padrão ARIA 1.2 com listbox de seleção múltipla):
 *   setas percorrem, Enter liga/desliga, Esc fecha ou limpa, toque funciona
 *   igual ao clique; a busca ignora acento e caixa.
 * - Escolhidas viram fichas removíveis (botão de 44 px com nome acessível).
 * - O limite é visível ("3 de 4") e anunciado; ao atingi-lo, as opções
 *   restantes ficam marcadas como indisponíveis, sem sumir.
 * - A seleção sai por callback (onMudar), pode ser controlada pelo pai
 *   (selecionadas) ou pela URL (chaveUrl, com pushState: o voltar desfaz a
 *   última escolha); ids desconhecidos no link são descartados.
 * - Pequenos múltiplos: children(ctx) ou renderizarItem(entidade, ctx). O
 *   domínio comum (ctx.dominio, ctx.escala) é calculado sobre os valores de
 *   TODAS as selecionadas, então os painéis usam a mesma escala e a
 *   comparação visual é honesta; a escala comum é dita em texto.
 */

export type EntidadeComparavel = EntidadeBuscavel;

export type ContextoComparador = {
  selecionadas: EntidadeComparavel[];
  /** Domínio comum a todos os painéis (null sem `valores` ou sem valor válido). */
  dominio: Dominio | null;
  /** Escala linear do domínio comum para a faixa em pixels do painel ([base, topo] no eixo Y do SVG). */
  escala: (faixa: [number, number]) => EscalaLinear | null;
  max: number;
};

export type ComparadorProps = {
  /** Rótulo do campo, ex.: "Distribuidoras para comparar". */
  rotulo: string;
  entidades: EntidadeComparavel[];
  /** Limite de escolhas (1 a 4; padrão 4). */
  max?: number;
  /** Seleção controlada pelo pai (ids na ordem de escolha). */
  selecionadas?: string[];
  /** Seleção inicial quando não controlada (e padrão da URL). */
  padrao?: string[];
  /** Recebe a seleção sempre que ela muda (escolha, remoção, voltar/avançar). */
  onMudar?: (ids: string[]) => void;
  /** Nome do parâmetro na URL (ex.: "ent"); sem ele, a seleção é local. */
  chaveUrl?: string;
  /** Busca da página no servidor, para o HTML inicial já refletir a seleção do link. */
  buscaInicial?: string;
  /** Valores de uma entidade, para o domínio comum dos pequenos múltiplos. */
  valores?: (id: string) => readonly (number | null | undefined)[];
  /** O domínio comum inclui o zero (barras). */
  zeroNaEscala?: boolean;
  /** Unidade do domínio comum, para o texto "mesma escala". */
  unidade?: string;
  dicaBusca?: string;
  /** Texto quando nada está selecionado. */
  vazio?: ReactNode;
  children?: (ctx: ContextoComparador) => ReactNode;
  /** Alternativa a children: um painel por entidade, em grade de uma ou duas colunas. */
  renderizarItem?: (e: EntidadeComparavel, ctx: ContextoComparador & { indice: number }) => ReactNode;
};

const MAX_OPCOES = 50;

export function Comparador({
  rotulo,
  entidades,
  max: maxPedido = LIMITE_COMPARACAO,
  selecionadas: controladas,
  padrao,
  onMudar,
  chaveUrl,
  buscaInicial,
  valores,
  zeroNaEscala = false,
  unidade,
  dicaBusca = "Digite para buscar",
  vazio,
  children,
  renderizarItem,
}: ComparadorProps) {
  const uid = useId();
  const max = Math.max(1, Math.min(LIMITE_COMPARACAO, Math.floor(maxPedido) || LIMITE_COMPARACAO));
  const porId = useMemo(() => new Map(entidades.map((e) => [e.id, e])), [entidades]);
  const ids = useMemo(() => entidades.map((e) => e.id), [entidades]);
  const chaveIds = ids.join("\u0001");
  const padraoValido = useMemo(() => (padrao ?? []).filter((id) => porId.has(id)).slice(0, max), [padrao, porId, max]);
  const chavePadrao = padraoValido.join("\u0001");

  const controlado = controladas !== undefined;
  const esquema = useMemo(
    () => ({ sel: campo(tiposUrl.lista(tiposUrl.opcao(ids), { max }), padraoValido, { param: chaveUrl ?? "sel", historico: "push" }) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- as chaves resumem ids e padrão (listas recriadas a cada render não recriam o esquema)
    [chaveIds, chavePadrao, max, chaveUrl],
  );
  const sincronizar = !!chaveUrl && !controlado;
  const [estado, definir] = useEstadoUrl(esquema, { sincronizar, buscaInicial: sincronizar ? buscaInicial : undefined });
  const selecao = useMemo(
    () => (controlado ? Array.from(new Set(controladas)).filter((id) => porId.has(id)).slice(0, max) : estado.sel),
    [controlado, controladas, estado.sel, porId, max],
  );
  const selecionadas = useMemo(() => selecao.map((id) => porId.get(id)).filter((e): e is EntidadeComparavel => !!e), [selecao, porId]);

  // seleção não controlada (local ou URL) sai por callback a cada mudança, inclusive voltar/avançar
  const onMudarRef = useRef(onMudar);
  onMudarRef.current = onMudar;
  const chaveSelecao = selecao.join("\u0001");
  useEffect(() => {
    if (!controlado) onMudarRef.current?.(selecao);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dispara pela mudança de conteúdo, não de identidade
  }, [controlado, chaveSelecao]);

  const [consulta, setConsulta] = useState("");
  const [aberto, setAberto] = useState(false);
  const [ativa, setAtiva] = useState(-1);
  const [anuncio, setAnuncio] = useState("");
  const resultados = useMemo(() => buscarEntidades(entidades, consulta, MAX_OPCOES), [entidades, consulta]);
  const noLimite = selecao.length >= max;

  const inputRef = useRef<HTMLInputElement>(null);
  const remocoes = useRef<(HTMLButtonElement | null)[]>([]);
  const focoApos = useRef<number | null>(null);

  // foco depois de remover uma ficha: a ficha seguinte, a anterior ou o campo
  useEffect(() => {
    const i = focoApos.current;
    if (i === null) return;
    focoApos.current = null;
    const alvo = remocoes.current[Math.min(i, selecionadas.length - 1)];
    (alvo ?? inputRef.current)?.focus();
  }, [selecionadas.length]);

  // opção ativa sempre visível na lista rolável
  useEffect(() => {
    if (!aberto || ativa < 0) return;
    document.getElementById(`${uid}-op-${ativa}`)?.scrollIntoView({ block: "nearest" });
  }, [aberto, ativa, uid]);

  function mudar(novos: string[]) {
    if (controlado) onMudar?.(novos);
    else definir({ sel: novos });
  }

  function alternar(id: string) {
    const e = porId.get(id);
    if (!e) return;
    const r = alternarSelecao(selecao, id, max);
    if (r.motivo === "limite") {
      setAnuncio(`Limite de ${max} atingido. Remova uma escolha para incluir ${e.rotulo}.`);
      return;
    }
    mudar(r.ids);
    setAnuncio(`${e.rotulo} ${r.motivo === "entrou" ? "entrou na" : "saiu da"} comparação: ${r.ids.length} de ${max}.`);
    if (consulta) {
      setConsulta("");
      setAtiva(-1);
    }
  }

  function remover(id: string, i: number) {
    focoApos.current = i;
    alternar(id);
  }

  function teclado(ev: KeyboardEvent<HTMLInputElement>) {
    const n = resultados.itens.length;
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      ev.preventDefault();
      const desce = ev.key === "ArrowDown";
      if (!aberto) {
        setAberto(true);
        if (!ev.altKey) setAtiva(n ? (desce ? 0 : n - 1) : -1);
        return;
      }
      if (!n) return;
      setAtiva((a) => (desce ? (a + 1) % n : a <= 0 ? n - 1 : a - 1));
    } else if (ev.key === "Enter") {
      if (!aberto) return;
      const alvo = ativa >= 0 && ativa < n ? resultados.itens[ativa] : n === 1 ? resultados.itens[0] : null;
      if (alvo) {
        ev.preventDefault();
        alternar(alvo.id);
      }
    } else if (ev.key === "Escape") {
      if (aberto) {
        ev.preventDefault();
        setAberto(false);
        setAtiva(-1);
      } else if (consulta) {
        ev.preventDefault();
        setConsulta("");
      }
    } else if (ev.key === "Tab") {
      setAberto(false);
    }
  }

  const dominio = useMemo(() => {
    if (!valores || !selecionadas.length) return null;
    const todos = selecionadas.flatMap((e) => Array.from(valores(e.id)));
    return todos.some((v) => typeof v === "number" && Number.isFinite(v)) ? dominioBonito(todos, { zero: zeroNaEscala }) : null;
  }, [valores, selecionadas, zeroNaEscala]);
  const ctx: ContextoComparador = {
    selecionadas,
    dominio,
    escala: (faixa) => (dominio ? escalaLinear([dominio.min, dominio.max], faixa) : null),
    max,
  };

  const idLista = `${uid}-lista`;
  const idDica = `${uid}-dica`;
  const ativaId = aberto && ativa >= 0 && ativa < resultados.itens.length ? `${uid}-op-${ativa}` : undefined;

  return (
    <div className="min-w-0 max-w-full" data-componente="comparador">
      <div className="border border-linha bg-superficie p-4">
        <label htmlFor={`${uid}-campo`} className="rotulo block text-mineral">
          {rotulo}
        </label>
        <p id={idDica} className="mt-1 text-sm text-carvao-muted">
          Escolha até {max} para ver lado a lado, na mesma escala.{" "}
          <span className="font-medium tabular-nums text-carvao" data-contagem>
            {selecao.length} de {max}
          </span>{" "}
          {selecao.length === 1 ? "selecionada" : "selecionadas"}
          {noLimite ? ". Limite atingido: remova uma para escolher outra." : "."}
        </p>

        {selecionadas.length > 0 && (
          <ul aria-label="Selecionadas para comparação" className="mt-3 flex flex-wrap gap-2">
            {selecionadas.map((e, i) => (
              <li key={e.id} data-id={e.id} className="inline-flex items-center border border-energia bg-energia-fundo pl-3 text-sm text-carvao">
                <span>{e.rotulo}</span>
                <button
                  type="button"
                  ref={(el) => {
                    remocoes.current[i] = el;
                  }}
                  onClick={() => remover(e.id, i)}
                  aria-label={`Remover ${e.rotulo} da comparação`}
                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-carvao-muted hover:text-carvao"
                >
                  <span aria-hidden="true">✕</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="relative mt-3">
          <input
            ref={inputRef}
            id={`${uid}-campo`}
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={aberto}
            aria-controls={idLista}
            aria-activedescendant={ativaId}
            aria-describedby={idDica}
            autoComplete="off"
            spellCheck={false}
            value={consulta}
            placeholder={dicaBusca}
            onChange={(e) => {
              setConsulta(e.target.value);
              setAberto(true);
              setAtiva(-1);
            }}
            onClick={() => setAberto(true)}
            onKeyDown={teclado}
            onBlur={() => {
              setAberto(false);
              setAtiva(-1);
            }}
            className="block min-h-[44px] w-full border border-linha bg-superficie px-3 text-sm text-carvao placeholder:text-mineral hover:border-energia"
          />
          {/* painel suspenso na largura do campo (nunca passa da borda da tela); a lista existe sempre, oculta quando fechada, para o aria-controls */}
          <div className={aberto ? "absolute left-0 right-0 top-full z-30 mt-1 border border-linha bg-superficie shadow-[0_6px_20px_rgba(26,29,33,0.12)]" : "hidden"}>
            <ul
              id={idLista}
              role="listbox"
              aria-label={rotulo}
              aria-multiselectable="true"
              hidden={!aberto || resultados.itens.length === 0}
              className="max-h-72 overflow-y-auto py-1"
            >
              {aberto &&
                resultados.itens.map((e, i) => {
                  const marcada = selecao.includes(e.id);
                  const bloqueada = noLimite && !marcada;
                  const emFoco = i === ativa;
                  return (
                    <li
                      key={e.id}
                      id={`${uid}-op-${i}`}
                      role="option"
                      aria-selected={marcada}
                      aria-disabled={bloqueada || undefined}
                      // mousedown não tira o foco do campo: o clique e o toque escolhem sem fechar a lista
                      onMouseDown={(ev) => ev.preventDefault()}
                      onClick={() => alternar(e.id)}
                      onPointerMove={() => ativa !== i && setAtiva(i)}
                      className={`flex min-h-[44px] cursor-pointer items-center gap-2 px-3 text-sm ${emFoco ? "bg-energia-fundo" : ""} ${
                        bloqueada ? "cursor-not-allowed text-carvao-muted" : "text-carvao"
                      }`}
                    >
                      <span aria-hidden="true" className="w-4 shrink-0 text-energia-dark">
                        {marcada ? "✓" : ""}
                      </span>
                      <span className="min-w-0 flex-1">{e.rotulo}</span>
                      {e.detalhe && <span className={`text-xs ${emFoco ? "text-carvao-muted" : "text-mineral"}`}>{e.detalhe}</span>}
                    </li>
                  );
                })}
            </ul>
            {aberto && resultados.total === 0 && <p className="px-3 py-3 text-sm text-carvao-muted">Nada encontrado para “{consulta}”.</p>}
            {aberto && resultados.total > resultados.itens.length && (
              <p className="border-t border-linha px-3 py-2 text-xs text-carvao-muted">
                Mostrando {resultados.itens.length} de {resultados.total}. Digite mais para refinar.
              </p>
            )}
          </div>
          {/* região persistente: anunciada a cada mudança da contagem enquanto a lista está aberta (fora do painel oculto, para continuar na árvore de acessibilidade) */}
          <p className="sr-only" aria-live="polite">
            {!aberto
              ? ""
              : resultados.total === 0
                ? "Nenhum resultado."
                : resultados.total > resultados.itens.length
                  ? `${resultados.total} resultados; mostrando ${resultados.itens.length}. Refine a busca.`
                  : `${resultados.total} ${resultados.total === 1 ? "resultado" : "resultados"}.`}
          </p>
        </div>
        <p className="sr-only" aria-live="polite">
          {anuncio}
        </p>
      </div>

      <div className="mt-4" data-multiplos>
        {selecionadas.length === 0 ? (
          // div, não p: quem chama pode passar um parágrafo próprio como estado vazio
          <div className="text-sm text-carvao-muted">{vazio ?? `Nada selecionado. Escolha até ${max} para comparar.`}</div>
        ) : (
          <>
            {dominio && (
              <p className="mb-2 text-xs text-mineral" data-escala-comum>
                Mesma escala em todos os painéis: {rotuloTick(dominio.min, dominio.passo)} a {rotuloTick(dominio.max, dominio.passo)}
                {unidade ? ` ${unidade}` : ""}.
              </p>
            )}
            {renderizarItem ? (
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2" aria-label={`Comparação: ${selecionadas.map((e) => e.rotulo).join(", ")}`}>
                {selecionadas.map((e, i) => (
                  <li key={e.id} className="min-w-0">
                    {renderizarItem(e, { ...ctx, indice: i })}
                  </li>
                ))}
              </ul>
            ) : (
              children?.(ctx)
            )}
          </>
        )}
      </div>
    </div>
  );
}
