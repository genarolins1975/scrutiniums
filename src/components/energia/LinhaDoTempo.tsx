"use client";

import { Fragment, useId, useState } from "react";
import { dataBR } from "@/lib/energia/formato";
import {
  FILTRO_PADRAO,
  ROTULO_BASE,
  filtrarEventos,
  filtroAtivo,
  normalizarPeriodo,
  resumoFiltro,
  textoDefasagem,
  urlSegura,
  type BaseData,
  type EventoDatado,
  type FiltroLinhaDoTempo,
} from "@/lib/energia/linha-do-tempo";

/**
 * Linha do tempo de eventos datados (atos regulatórios, revisões tarifárias,
 * mudanças de metodologia) como lista ordenada semântica (<ol>), não como
 * desenho: cada evento é um item de lista com título, categoria em texto,
 * datas em <time> e link para a fonte primária. Quem usa leitor de tela ouve
 * a mesma sequência que quem vê; o fio vertical e os marcadores são só
 * reforço visual.
 *
 * - Data de publicação e data de vigência são campos distintos, sempre
 *   rotulados; a defasagem entre elas é escrita ("vigência 30 dias após a
 *   publicação", "retroativa"). Data ausente diz "não informada".
 * - Filtro por categoria e por período. O período vale para a data que a
 *   pessoa escolhe (publicação ou vigência); eventos sem essa data ficam fora
 *   do recorte e a contagem diz quantos. Filtros ativos aparecem em forma
 *   resumida, com "Limpar filtros".
 * - Estado por props (`filtro` e `onFiltro`) para ir à URL; sem elas o
 *   componente guarda o próprio estado.
 * - Link de fonte primária só para http(s), abre em nova aba com aviso para
 *   leitor de tela; sem fonte localizada, o evento diz isso.
 */
export type CategoriaEvento = { id: string; rotulo: string };

export type LinhaDoTempoProps = {
  titulo: string;
  eventos: EventoDatado[];
  /** Categorias na ordem de exibição do filtro. */
  categorias: CategoriaEvento[];
  /** Filtro controlado (ex.: vindo da URL); use com onFiltro. */
  filtro?: FiltroLinhaDoTempo;
  filtroInicial?: Partial<FiltroLinhaDoTempo>;
  onFiltro?: (f: FiltroLinhaDoTempo) => void;
  /** "recentes" (padrão) ou "cronologica". */
  ordem?: "recentes" | "cronologica";
  /** Nível do título de cada evento: 3 em página de módulo, 4 dentro de seção com h3. */
  nivelTitulo?: 3 | 4;
};

export function LinhaDoTempo({ titulo, eventos, categorias, filtro: filtroControlado, filtroInicial, onFiltro, ordem = "recentes", nivelTitulo = 3 }: LinhaDoTempoProps) {
  const uid = useId().replace(/:/g, "");
  const [filtroInterno, setFiltroInterno] = useState<FiltroLinhaDoTempo>({ ...FILTRO_PADRAO, ...filtroInicial });
  const filtro = filtroControlado ?? filtroInterno;
  const Titulo = nivelTitulo === 4 ? "h4" : "h3";

  function mudar(parcial: Partial<FiltroLinhaDoTempo>) {
    const novo = { ...filtro, ...parcial };
    if (filtroControlado === undefined) setFiltroInterno(novo);
    onFiltro?.(novo);
  }

  const todas = categorias.map((c) => c.id);
  function alternarCategoria(id: string) {
    const atual = new Set(filtro.categorias ?? todas);
    if (atual.has(id)) atual.delete(id);
    else atual.add(id);
    const lista = todas.filter((c) => atual.has(c));
    mudar({ categorias: lista.length === todas.length ? null : lista });
  }

  const r = filtrarEventos(eventos, filtro, ordem);
  const periodo = normalizarPeriodo(filtro.inicio, filtro.fim);
  const ativo = filtroAtivo(filtro);
  const resumo = resumoFiltro(filtro, categorias);
  const rotuloCategoria = (id: string) => categorias.find((c) => c.id === id)?.rotulo ?? id;
  const contagem = (id: string) => eventos.filter((e) => e.categoria === id).length;

  const estado =
    `Mostrando ${r.eventos.length.toLocaleString("pt-BR")} de ${r.total.toLocaleString("pt-BR")} ${r.total === 1 ? "evento" : "eventos"}` +
    (resumo ? `; ${resumo}` : "") +
    "." +
    (r.semDataNaBase
      ? ` ${r.semDataNaBase.toLocaleString("pt-BR")} ${r.semDataNaBase === 1 ? "evento sem data" : "eventos sem data"} de ${ROTULO_BASE[filtro.base]} ${r.semDataNaBase === 1 ? "fica" : "ficam"} fora do recorte por período.`
      : "");

  const campoData = "mt-0.5 block min-h-[44px] border border-linha bg-superficie px-2 text-sm text-carvao focus:border-energia";

  return (
    <div className="w-full" data-grafico="linha-do-tempo">
      <div role="group" aria-label={`Filtros: ${titulo}`} className="mb-4 space-y-1 border-b border-linha pb-3">
        {categorias.length > 1 && (
          <fieldset className="flex flex-wrap items-center gap-x-4">
            <legend className="rotulo float-left mr-3 text-mineral">Categoria</legend>
            {categorias.map((c) => (
              <label key={c.id} className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-carvao">
                <input
                  type="checkbox"
                  checked={filtro.categorias === null || filtro.categorias.includes(c.id)}
                  onChange={() => alternarCategoria(c.id)}
                  className="h-4 w-4 accent-energia"
                />
                {c.rotulo} <span className="tabular-nums text-mineral">({contagem(c.id)})</span>
              </label>
            ))}
          </fieldset>
        )}
        <fieldset className="flex flex-wrap items-end gap-x-4 gap-y-1">
          <legend className="rotulo float-left mr-3 self-center text-mineral">Período por data de</legend>
          {(["publicacao", "vigencia"] as BaseData[]).map((b) => (
            <label key={b} className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-carvao">
              <input type="radio" name={`${uid}-base`} value={b} checked={filtro.base === b} onChange={() => mudar({ base: b })} className="h-4 w-4 accent-energia" />
              {ROTULO_BASE[b]}
            </label>
          ))}
          <label className="text-xs text-carvao-muted">
            De
            <input type="date" value={periodo.inicio ?? ""} onChange={(e) => mudar({ inicio: e.currentTarget.value || null })} className={campoData} />
          </label>
          <label className="text-xs text-carvao-muted">
            Até
            <input type="date" value={periodo.fim ?? ""} onChange={(e) => mudar({ fim: e.currentTarget.value || null })} className={campoData} />
          </label>
        </fieldset>
        <div className="flex flex-wrap items-center gap-x-4">
          <p className="text-sm text-carvao-muted" aria-live="polite" data-estado-filtro="">
            {estado}
          </p>
          <button
            type="button"
            aria-disabled={!ativo}
            onClick={() => ativo && mudar({ categorias: null, inicio: null, fim: null })}
            className={`rotulo inline-flex min-h-[44px] items-center border px-3 ${ativo ? "border-carvao-muted text-carvao hover:border-carvao" : "cursor-default border-linha text-mineral"}`}
          >
            Limpar filtros
          </button>
        </div>
      </div>
      {r.eventos.length === 0 ? (
        <p className="border border-dashed border-linha px-4 py-6 text-sm text-carvao-muted">
          {eventos.length ? "Nenhum evento no filtro atual." : "Nenhum evento registrado."}
        </p>
      ) : (
        <ol aria-label={titulo} className="ml-1.5 border-l border-linha">
          {r.eventos.map((e, k) => {
            const dataBase = e[filtro.base];
            const ano = dataBase ? dataBase.slice(0, 4) : `sem data de ${ROTULO_BASE[filtro.base]}`;
            const anterior = k > 0 ? r.eventos[k - 1][filtro.base] : undefined;
            const anoAnterior = k === 0 ? null : anterior ? anterior.slice(0, 4) : `sem data de ${ROTULO_BASE[filtro.base]}`;
            const url = urlSegura(e.fonte?.url);
            const defasagem = textoDefasagem(e.publicacao, e.vigencia);
            const idTitulo = `${uid}-${k}`;
            return (
              <li key={e.id} data-id={e.id} className="relative pb-6 pl-6 last:pb-1">
                {/* marcador e ano são reforço visual: as datas completas estão no texto do item */}
                <span aria-hidden="true" className="absolute -left-[6px] top-1.5 h-[11px] w-[11px] rounded-full border-2 border-energia bg-superficie" />
                {ano !== anoAnterior && (
                  <p aria-hidden="true" className="rotulo mb-1 text-mineral" data-ano="">
                    {ano}
                  </p>
                )}
                <article aria-labelledby={idTitulo}>
                  <p className="rotulo text-energia-dark">
                    {rotuloCategoria(e.categoria)}
                    {e.orgao ? ` · ${e.orgao}` : ""}
                  </p>
                  <Titulo id={idTitulo} className="mt-0.5 font-serif text-lg leading-snug text-carvao">
                    {e.titulo}
                  </Titulo>
                  <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-sm">
                    <dt className="text-carvao-muted">Publicação</dt>
                    <dd className="tabular-nums text-carvao">
                      {e.publicacao ? <time dateTime={e.publicacao}>{dataBR(e.publicacao)}</time> : <span className="italic text-mineral">não informada</span>}
                    </dd>
                    <dt className="text-carvao-muted">Vigência</dt>
                    <dd className="tabular-nums text-carvao">
                      {e.vigencia ? (
                        <>
                          {e.fimVigencia ? "de " : "a partir de "}
                          <time dateTime={e.vigencia}>{dataBR(e.vigencia)}</time>
                          {e.fimVigencia ? (
                            <>
                              {" a "}
                              <time dateTime={e.fimVigencia}>{dataBR(e.fimVigencia)}</time>
                            </>
                          ) : null}
                        </>
                      ) : (
                        <span className="italic text-mineral">não informada</span>
                      )}
                      {defasagem && <span className="block text-xs text-carvao-muted">{defasagem}</span>}
                    </dd>
                    {e.dispositivo && (
                      <Fragment>
                        <dt className="text-carvao-muted">Dispositivo</dt>
                        <dd className="text-carvao">{e.dispositivo}</dd>
                      </Fragment>
                    )}
                  </dl>
                  {e.resumo && <p className="mt-1.5 max-w-prose2 text-sm leading-relaxed text-carvao-muted">{e.resumo}</p>}
                  {url && e.fonte ? (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="rotulo mt-1 inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
                      Fonte primária: {e.fonte.rotulo}
                      <span className="sr-only"> (abre em nova aba)</span>
                    </a>
                  ) : (
                    <p className="mt-1.5 text-xs italic text-mineral" data-fonte="ausente">
                      Fonte primária não localizada: confira o ato antes de citar este evento.
                    </p>
                  )}
                </article>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
