"use client";

import { useMemo } from "react";
import { RegulacaoFaixas } from "@/components/energia/RegulacaoFaixas";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { dataBR } from "@/lib/energia/formato";
import { ROTULO_BASE, type BaseData } from "@/lib/energia/linha-do-tempo";
import {
  COLUNAS_LINHA_TEMPO,
  ROTULO_NIVEL_EVENTO,
  ROTULO_ORIGEM_EVENTO,
  faixasLinhaTempo,
  filtrarLinhaTempo,
  linhasLinhaTempo,
  origemEvento,
  respostaLinhaTempo,
  slugPainel,
  textoDefasagemEvento,
  textoPublicacao,
  textoReuniao,
  type OrigemEvento,
} from "@/lib/energia/regulacao";
import type { EventoRegulatorio, PainelLink } from "@/lib/energia/tipos-regulacao";

/**
 * P045, linha do tempo filtrável. O recorte mora na URL: painel afetado (`?painel=`),
 * origem do evento (`?origem=`: ato lido no texto ou registro do conjunto de dados de
 * bandeiras), a data que filtra e ordena (`?base=`, publicação ou vigência), o período
 * (`?de=` e `?ate=`) e o evento escolhido (`?ev=`). Filtro e seleção criam entrada no
 * histórico (o voltar desfaz). O gráfico de faixas, a lista e a tabela equivalente usam
 * a mesma lista filtrada (filtrarLinhaTempo), na mesma ordem.
 *
 * Cada evento separa o resumo editorial do observatório, o efeito que o próprio ato
 * declara (literal) e o impacto estimado, que fica sempre vazio: o observatório não
 * estima efeito de norma, e a coincidência entre uma data desta lista e um movimento
 * num gráfico não é evidência de causa.
 */
const ORIGENS: readonly ("" | OrigemEvento)[] = ["", "ato", "registro"];
const BASES: readonly BaseData[] = ["vigencia", "publicacao"];

export function RegulacaoLinhaTempo({ eventos, paineis, fonte, versao }: { eventos: EventoRegulatorio[]; paineis: PainelLink[]; fonte: string; versao: string }) {
  const slugs = useMemo(() => paineis.map((p) => slugPainel(p.href)), [paineis]);
  const ids = useMemo(() => eventos.map((e) => e.id), [eventos]);
  const esquema = useMemo(
    () => ({
      painel: campo(tiposUrl.opcao(["", ...slugs]), "", { param: "painel" }),
      origem: campo(tiposUrl.opcao(ORIGENS), "", { param: "origem" }),
      base: campo(tiposUrl.opcao(BASES), "vigencia", { param: "base" }),
      de: campo(tiposUrl.data(), "", { param: "de" }),
      ate: campo(tiposUrl.data(), "", { param: "ate" }),
      ev: campo(tiposUrl.opcao(["", ...ids]), "", { param: "ev" }),
    }),
    [slugs.join(","), ids.join(",")], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const [v, definir] = useEstadoUrl(esquema);
  const filtro = { painel: v.painel, origem: v.origem, base: v.base, de: v.de, ate: v.ate };
  const r = filtrarLinhaTempo(eventos, filtro);
  const faixas = faixasLinhaTempo(r.eventos);
  const linhas = linhasLinhaTempo(r.eventos);
  const ativo = filtro.painel !== "" || filtro.origem !== "" || filtro.de !== "" || filtro.ate !== "";
  const selecionado = r.eventos.find((e) => e.id === v.ev) ?? null;
  const selecionar = (id: string | null) => definir({ ev: id ?? "" });
  const nomePainel = paineis.find((p) => slugPainel(p.href) === filtro.painel)?.rotulo;

  const resumo = [
    nomePainel ? `afeta ${nomePainel}` : "",
    filtro.origem ? ROTULO_ORIGEM_EVENTO[filtro.origem].toLowerCase() : "",
    filtro.de || filtro.ate ? `${ROTULO_BASE[filtro.base]} ${filtro.de ? `de ${dataBR(filtro.de)}` : ""}${filtro.ate ? ` até ${dataBR(filtro.ate)}` : ""}`.trim() : "",
  ].filter(Boolean);
  const estado =
    `Mostrando ${r.eventos.length} de ${eventos.length} eventos${resumo.length ? `: ${resumo.join("; ")}` : ""}.` +
    (r.semDataNaBase ? ` ${r.semDataNaBase} ${r.semDataNaBase === 1 ? "evento sem data" : "eventos sem data"} de ${ROTULO_BASE[filtro.base]} ${r.semDataNaBase === 1 ? "fica" : "ficam"} fora do recorte por período.` : "");
  const campoData = "mt-0.5 block min-h-[44px] border border-linha bg-superficie px-2 text-sm text-carvao focus:border-energia";

  return (
    <div className="space-y-6">
      <div role="group" aria-label="Filtros da linha do tempo" className="space-y-2 border-b border-linha pb-3">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
          <label className="text-xs text-carvao-muted">
            Quem é afetado (painel)
            <select value={filtro.painel} onChange={(e) => definir({ painel: e.currentTarget.value })} className={campoData}>
              <option value="">Todos os painéis</option>
              {paineis.map((p) => (
                <option key={p.href} value={slugPainel(p.href)}>
                  {p.rotulo}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="flex flex-wrap items-center gap-x-4">
            <legend className="rotulo float-left mr-3 text-mineral">Origem</legend>
            {ORIGENS.map((o) => (
              <label key={o || "todas"} className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-carvao">
                <input type="radio" name="regulacao-origem" checked={filtro.origem === o} onChange={() => definir({ origem: o })} className="h-4 w-4 accent-energia" />
                {o ? ROTULO_ORIGEM_EVENTO[o] : "Todas"}
              </label>
            ))}
          </fieldset>
        </div>
        <fieldset className="flex flex-wrap items-end gap-x-4 gap-y-1">
          <legend className="rotulo float-left mr-3 self-center text-mineral">Período e ordem por data de</legend>
          {BASES.map((b) => (
            <label key={b} className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-carvao">
              <input type="radio" name="regulacao-base" checked={filtro.base === b} onChange={() => definir({ base: b })} className="h-4 w-4 accent-energia" />
              {ROTULO_BASE[b]}
            </label>
          ))}
          <label className="text-xs text-carvao-muted">
            De
            <input type="date" value={filtro.de} onChange={(e) => definir({ de: e.currentTarget.value })} className={campoData} />
          </label>
          <label className="text-xs text-carvao-muted">
            Até
            <input type="date" value={filtro.ate} onChange={(e) => definir({ ate: e.currentTarget.value })} className={campoData} />
          </label>
        </fieldset>
        <div className="flex flex-wrap items-center gap-x-4">
          <p className="text-sm text-carvao-muted" aria-live="polite" data-estado-filtro="">
            {estado}
          </p>
          <button
            type="button"
            aria-disabled={!ativo}
            onClick={() => ativo && definir({ painel: "", origem: "", de: "", ate: "" })}
            className={`rotulo inline-flex min-h-[44px] items-center border px-3 ${ativo ? "border-carvao-muted text-carvao hover:border-carvao" : "cursor-default border-linha text-mineral"}`}
          >
            Limpar filtros
          </button>
        </div>
      </div>

      {ativo && (
        // a resposta do recorte inteiro já está acima do filtro; com filtro, a frase do recorte
        <p className="max-w-prose2 text-sm leading-relaxed text-carvao" data-resposta-filtro="p045" aria-live="polite">
          {respostaLinhaTempo(r.eventos, eventos.length, filtro.base)}
        </p>
      )}

      <RegulacaoFaixas
        titulo="Publicação e início de vigência de cada evento"
        faixas={faixas}
        selecionado={selecionado?.id ?? null}
        onSelecionar={selecionar}
        vazio="Nenhum evento no recorte atual. Limpe os filtros para ver a linha do tempo inteira."
        legenda={
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
            <li className="inline-flex items-center gap-1.5">
              <svg width="14" height="14" aria-hidden="true">
                <circle cx="7" cy="7" r="5" fill="var(--cor-superficie)" stroke="var(--cor-carvao-muted)" strokeWidth="2" />
              </svg>
              publicação no DOU
            </li>
            <li className="inline-flex items-center gap-1.5">
              <svg width="14" height="14" aria-hidden="true">
                <circle cx="7" cy="7" r="5" fill="var(--cor-carvao-muted)" />
              </svg>
              início de vigência
            </li>
            <li className="inline-flex items-center gap-1.5">
              <svg width="18" height="14" aria-hidden="true">
                <rect x="1" y="2" width="16" height="10" fill="var(--cor-carvao-muted)" />
              </svg>
              vigência conhecida só pelo mês
            </li>
            <li className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="inline-block h-2.5 w-4" style={{ background: "var(--cor-energia)" }} />
              ato ou lei lido no texto
            </li>
            <li className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="inline-block h-2.5 w-4" style={{ background: "var(--serie-referencia)" }} />
              registro do conjunto de dados (ato não lido)
            </li>
          </ul>
        }
      />

      {selecionado && (
        <div className="border border-energia bg-superficie p-4 text-sm" data-evento-selecionado={selecionado.id} aria-live="polite">
          <p className="rotulo text-energia-dark">Evento selecionado</p>
          <p className="mt-1 font-serif text-lg text-carvao">{selecionado.titulo}</p>
          <p className="mt-1 text-carvao-muted">
            {selecionado.ato ?? selecionado.tipo_ato}; {textoPublicacao(selecionado.data_publicacao)}; vigência a partir de{" "}
            {dataBR(selecionado.vigencia_grao === "mes" ? selecionado.vigencia_inicio.slice(0, 7) : selecionado.vigencia_inicio)} ({textoDefasagemEvento(selecionado)}).
          </p>
          <p className="mt-2 flex flex-wrap gap-x-4">
            <a href={`#evento-${selecionado.id}`} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
              Ver o evento completo na lista
            </a>
            <button type="button" onClick={() => selecionar(null)} className="rotulo inline-flex min-h-[44px] items-center text-carvao-muted underline underline-offset-4 hover:text-carvao">
              Remover seleção
            </button>
          </p>
        </div>
      )}

      {r.eventos.length > 0 && (
        <ol aria-label="Eventos da linha do tempo no recorte" className="ml-1.5 border-l border-linha">
          {r.eventos.map((e, k) => {
            const data = filtro.base === "publicacao" ? e.data_publicacao : e.vigencia_inicio;
            const ano = data ? data.slice(0, 4) : `sem data de ${ROTULO_BASE[filtro.base]}`;
            const anterior = k > 0 ? (filtro.base === "publicacao" ? r.eventos[k - 1].data_publicacao : r.eventos[k - 1].vigencia_inicio) : undefined;
            const anoAnterior = k === 0 ? null : anterior ? anterior.slice(0, 4) : `sem data de ${ROTULO_BASE[filtro.base]}`;
            const sel = selecionado?.id === e.id;
            return (
              <li key={e.id} id={`evento-${e.id}`} data-evento={e.id} className="relative scroll-mt-28 pb-7 pl-6 last:pb-1">
                <span aria-hidden="true" className={`absolute -left-[6px] top-1.5 h-[11px] w-[11px] rounded-full border-2 ${sel ? "border-energia-dark bg-energia" : "border-energia bg-superficie"}`} />
                {ano !== anoAnterior && (
                  <p aria-hidden="true" className="rotulo mb-1 text-mineral">
                    {ano}
                  </p>
                )}
                <article aria-labelledby={`evento-${e.id}-titulo`} className={sel ? "bg-energia-fundo p-3" : undefined}>
                  <p className="rotulo text-energia-dark">
                    {ROTULO_ORIGEM_EVENTO[origemEvento(e)]} · {e.orgao}
                  </p>
                  <h4 id={`evento-${e.id}-titulo`} className="mt-0.5 font-serif text-lg leading-snug text-carvao">
                    {e.titulo}
                  </h4>
                  <dl className="mt-1.5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-0.5 text-sm [&_dd]:[overflow-wrap:anywhere]">
                    <dt className="text-carvao-muted">Ato</dt>
                    <dd className="text-carvao">{e.ato ?? `${e.tipo_ato} (número não informado pela fonte)`}</dd>
                    <dt className="text-carvao-muted">Publicação</dt>
                    <dd className="tabular-nums text-carvao">
                      {e.data_publicacao ? <time dateTime={e.data_publicacao}>{dataBR(e.data_publicacao)}</time> : <span className="italic text-mineral">não informada pela fonte</span>}
                    </dd>
                    <dt className="text-carvao-muted">Vigência</dt>
                    <dd className="tabular-nums text-carvao">
                      a partir de <time dateTime={e.vigencia_inicio}>{dataBR(e.vigencia_grao === "mes" ? e.vigencia_inicio.slice(0, 7) : e.vigencia_inicio)}</time>
                      <span className="block text-xs text-carvao-muted">{textoDefasagemEvento(e)}</span>
                    </dd>
                    <dt className="text-carvao-muted">Dispositivo</dt>
                    <dd className="text-carvao">{e.dispositivo}</dd>
                    <dt className="text-carvao-muted">Quem é afetado</dt>
                    <dd className="text-carvao">
                      {e.paineis.length
                        ? e.paineis.map((p, i) => (
                            <span key={p.href}>
                              {i > 0 && ", "}
                              <a href={p.href} className="text-energia-dark underline underline-offset-4">
                                {p.rotulo}
                              </a>
                            </span>
                          ))
                        : "nenhum painel indicado"}
                    </dd>
                  </dl>
                  <div className="mt-2 space-y-1.5 text-sm leading-relaxed">
                    <p className="text-carvao-muted">
                      <span className="rotulo mr-1.5 text-mineral">Resumo do observatório</span>
                      {e.resumo}
                    </p>
                    <p className="text-carvao">
                      <span className="rotulo mr-1.5 text-mineral">Efeito declarado pelo ato</span>
                      {e.efeito_declarado ? <q>{e.efeito_declarado}</q> : <span className="italic text-carvao-muted">o conjunto de dados não traz efeito declarado; o ato não foi lido</span>}
                    </p>
                    <p className="text-carvao-muted">
                      <span className="rotulo mr-1.5 text-mineral">Impacto estimado</span>
                      {e.impacto_estimado ?? "não estimado pelo observatório"}
                    </p>
                  </div>
                  <details className="mt-2 text-sm" open={sel}>
                    <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-carvao-muted underline underline-offset-4">Evidência: trecho literal, conferências e documento</summary>
                    <div className="mt-1 space-y-1.5 border-l-2 border-linha pl-3 text-carvao-muted">
                      <p>
                        <span className="text-carvao">Onde foi lido:</span> {ROTULO_NIVEL_EVENTO[e.nivel_conferencia] ?? e.nivel_conferencia}
                        {e.trecho_confere === null ? "; conferência do trecho não executada" : e.trecho_confere ? "; trecho encontrado no documento guardado" : "; trecho não encontrado no documento"}.
                      </p>
                      {e.conferencia_publicacao && (
                        <p>
                          <span className="text-carvao">Data de publicação conferida:</span> {e.conferencia_publicacao.resultado === "aprovado" ? "aprovada" : e.conferencia_publicacao.resultado}; {e.conferencia_publicacao.detalhe}.
                        </p>
                      )}
                      <p>
                        <span className="text-carvao">Regra de vigência:</span> <q>{e.vigencia_regra}</q>
                        {e.vigencia_calculada ? " (data calculada pela LC nº 95/1998, art. 8º, § 1º)" : ""}
                      </p>
                      {e.trecho && (
                        <p>
                          <span className="text-carvao">Trecho:</span> <q>{e.trecho}</q>
                        </p>
                      )}
                      {e.deliberacao && (
                        <p>
                          Deliberado na reunião {textoReuniao(e.deliberacao.reuniao)} da Diretoria da ANEEL, em {dataBR(e.deliberacao.data)}.
                        </p>
                      )}
                      {e.observacoes.map((o) => (
                        <p key={o}>{o}</p>
                      ))}
                      <p className="flex flex-wrap gap-x-4">
                        {e.url_oficial && (
                          <a href={e.url_oficial} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 [overflow-wrap:anywhere]">
                            Endereço oficial do documento<span className="sr-only"> (abre em nova aba)</span>
                          </a>
                        )}
                        {e.copia_publica && (
                          <a href={e.copia_publica} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 [overflow-wrap:anywhere]">
                            Cópia pública conferida por sha256<span className="sr-only"> (abre em nova aba)</span>
                          </a>
                        )}
                      </p>
                      {e.sha256 && <p className="text-xs [overflow-wrap:anywhere]">sha256 {e.sha256}</p>}
                    </div>
                  </details>
                  <button
                    type="button"
                    aria-pressed={sel}
                    onClick={() => selecionar(sel ? null : e.id)}
                    className="rotulo mt-1 inline-flex min-h-[44px] items-center text-carvao-muted underline underline-offset-4 hover:text-carvao"
                  >
                    {sel ? "Remover seleção" : "Destacar no gráfico e na tabela"}
                  </button>
                </article>
              </li>
            );
          })}
        </ol>
      )}

      <TabelaInterativa
        titulo="Eventos da linha do tempo no recorte (tabela equivalente)"
        colunas={COLUNAS_LINHA_TEMPO}
        linhas={linhas}
        chaveLinha="id"
        colunaRotulo="titulo"
        fonte={fonte}
        versao={versao}
        nomeArquivo="regulacao-linha-do-tempo"
        chaveUrl="lt"
        selecionado={selecionado?.id ?? null}
        onSelecionar={selecionar}
        semLinhas="Nenhum evento no recorte atual."
        nota="Mesmas linhas, na mesma ordem, do gráfico e da lista. Impacto estimado fica vazio em todos os eventos: o observatório não estima efeito de norma."
      />
    </div>
  );
}
