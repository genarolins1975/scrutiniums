"use client";

import { useMemo, type ReactNode } from "react";
import Link from "@/components/i18n/LinkIdioma";
import { LiteralFonte } from "@/components/LiteralFonte";
import { RegulacaoFaixas } from "@/components/energia/RegulacaoFaixas";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { formatos } from "@/lib/energia/formato";
import { codigo, comNomes } from "@/lib/energia/i18n/regulacao-dados-metodo";
import { ROTULO_BASE, type BaseData } from "@/lib/energia/linha-do-tempo";
import {
  COLUNAS_LINHA_TEMPO,
  ROTULO_NIVEL_EVENTO,
  ROTULO_ORIGEM_EVENTO,
  agruparRegistros,
  faixasLinhaTempo,
  filtrarLinhaTempo,
  linhasLinhaTempo,
  orgaoNoIdioma,
  origemEvento,
  respostaLinhaTempo,
  resumoCurtoEvento,
  rotuloPainelGold,
  slugPainel,
  textoDefasagemEvento,
  textoPublicacao,
  textoReuniao,
  textoVaziosRegistros,
  tipoAtoNoIdioma,
  vereditoLinhaTempo,
  type OrigemEvento,
} from "@/lib/energia/regulacao";
import type { EventoRegulatorio, PainelLink } from "@/lib/energia/tipos-regulacao";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";

/**
 * P045, linha do tempo filtrável. O recorte mora na URL: painel afetado (`?painel=`),
 * origem do evento (`?origem=`: ato lido no texto ou registro do conjunto de dados de
 * bandeiras), a data que filtra e ordena (`?base=`, publicação ou vigência), o período
 * (`?de=` e `?ate=`) e o evento escolhido (`?ev=`). Filtro e seleção criam entrada no
 * histórico (o voltar desfaz). O gráfico de faixas, as listas e a tabela equivalente usam
 * a mesma lista filtrada (filtrarLinhaTempo), na mesma ordem.
 *
 * Duas camadas de lista. Em Entender, uma lista curta: um item compacto por ato ou lei (título, ato,
 * datas, a primeira frase do resumo e os painéis afetados) e um cartão por tipo de registro de bandeiras,
 * com a quantidade e o período; o que falta em todos os registros (data de publicação, efeito declarado,
 * texto do ato) e o fato de nenhum evento ter impacto estimado são ditos uma vez, não em cada cartão. Em
 * Analisar, a lista completa de cada evento, com dispositivo, efeito declarado, evidência e documento.
 *
 * Cada evento separa o resumo editorial do observatório, o efeito que o próprio ato
 * declara (literal) e o impacto estimado, que fica sempre vazio: o observatório não
 * estima efeito de norma, e a coincidência entre uma data desta lista e um movimento
 * num gráfico não é evidência de causa.
 *
 * Na página inglesa, título, resumo, efeito declarado e trechos dos eventos (texto da curadoria e dos atos, só em
 * português) saem marcados como trecho em português; nomes de atos, como nome próprio.
 */
const ORIGENS: readonly ("" | OrigemEvento)[] = ["", "ato", "registro"];
const BASES: readonly BaseData[] = ["vigencia", "publicacao"];

const pl = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

export function RegulacaoLinhaTempo({
  eventos,
  paineis,
  fonte,
  versao,
  recorte,
  notas,
}: {
  eventos: EventoRegulatorio[];
  paineis: PainelLink[];
  fonte: string;
  versao: string;
  /** Período, universo e unidade como legenda da figura, depois dela. */
  recorte?: ReactNode;
  /** Notas do painel (NotasDoPainel), logo depois da figura principal e do evento escolhido. */
  notas?: ReactNode;
}) {
  const tx = useTx();
  const idioma = useIdioma();
  const { dataBR, datasLegiveis } = formatos(idioma);
  const slugs = useMemo(() => paineis.map((p) => slugPainel(p.href)), [paineis]);
  const ids = useMemo(() => eventos.map((e) => e.id), [eventos]);
  const esquema = useMemo(
    () => ({
      painel: campo(tiposUrl.opcao(["", ...slugs]), "", { param: "painel" }), // i18n: dado
      origem: campo(tiposUrl.opcao(ORIGENS), "", { param: "origem" }),
      base: campo(tiposUrl.opcao(BASES), "vigencia", { param: "base" }),
      de: campo(tiposUrl.data(), "", { param: "de" }), // i18n: dado
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
  const rotuloPainelFiltro = paineis.find((p) => slugPainel(p.href) === filtro.painel)?.rotulo;
  const nomePainel = rotuloPainelFiltro ? rotuloPainelGold(rotuloPainelFiltro) : undefined;
  const atos = r.eventos.filter((e) => origemEvento(e) === "ato");
  const registros = r.eventos.filter((e) => origemEvento(e) === "registro");
  const grupos = agruparRegistros(r.eventos);
  const dataDe = (e: EventoRegulatorio) => (filtro.base === "publicacao" ? e.data_publicacao : e.vigencia_inicio);
  const vigenciaTexto = (e: EventoRegulatorio) => dataBR(e.vigencia_grao === "mes" ? e.vigencia_inicio.slice(0, 7) : e.vigencia_inicio);
  const rotuloAno = (e: EventoRegulatorio) =>
    dataDe(e) ? (dataDe(e) as string).slice(0, 4) : tx(`sem data de ${ROTULO_BASE[filtro.base]}`, `no ${ROTULO_BASE[filtro.base]} date`);
  const atoOuTipo = (e: EventoRegulatorio) =>
    e.ato ? <Nome>{e.ato}</Nome> : tx(`${e.tipo_ato} (número não informado pela fonte)`, `${tipoAtoNoIdioma(e.tipo_ato)} (number not reported by the source)`);
  const linksPaineis = (e: EventoRegulatorio) =>
    e.paineis.length
      ? e.paineis.map((p, i) => (
          <span key={p.href}>
            {i > 0 && ", "}
            <Link href={p.href} className="text-energia-dark underline underline-offset-4">
              {rotuloPainelGold(p.rotulo)}
            </Link>
          </span>
        ))
      : tx("nenhum painel indicado", "no panel indicated");

  const resumo = [
    nomePainel ? tx(`afeta ${nomePainel}`, `affects ${nomePainel}`) : "",
    filtro.origem ? ROTULO_ORIGEM_EVENTO[filtro.origem].toLowerCase() : "",
    filtro.de || filtro.ate
      ? tx(
          `${ROTULO_BASE[filtro.base]} ${filtro.de ? `de ${dataBR(filtro.de)}` : ""}${filtro.ate ? ` até ${dataBR(filtro.ate)}` : ""}`,
          `${ROTULO_BASE[filtro.base]} ${filtro.de ? `from ${dataBR(filtro.de)}` : ""}${filtro.ate ? ` until ${dataBR(filtro.ate)}` : ""}`,
        ).trim()
      : "",
  ].filter(Boolean);
  const estado = tx(
    `Mostrando ${r.eventos.length} de ${eventos.length} eventos${resumo.length ? `: ${resumo.join("; ")}` : ""}.` +
      (r.semDataNaBase
        ? ` ${r.semDataNaBase} ${r.semDataNaBase === 1 ? "evento sem data" : "eventos sem data"} de ${ROTULO_BASE[filtro.base]} ${r.semDataNaBase === 1 ? "fica" : "ficam"} fora do recorte por período.`
        : ""),
    `Showing ${r.eventos.length} of ${eventos.length} events${resumo.length ? `: ${resumo.join("; ")}` : ""}.` +
      (r.semDataNaBase
        ? ` ${r.semDataNaBase} ${r.semDataNaBase === 1 ? "event" : "events"} without a ${ROTULO_BASE[filtro.base]} date ${r.semDataNaBase === 1 ? "is" : "are"} left out of the period selection.`
        : ""),
  );
  const campoData = "mt-0.5 block min-h-[44px] border border-linha bg-superficie px-2 text-sm text-carvao focus:border-energia";
  const langData = idioma === "en" ? "en" : "pt-BR";
  const abreNovaAba = <span className="sr-only">{tx(" (abre em nova aba)", " (opens in a new tab)")}</span>;

  return (
    <div className="space-y-6">
      <div role="group" aria-label={tx("Filtros da linha do tempo", "Timeline filters")} className="space-y-2 border-b border-linha pb-3">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
          <label className="text-xs text-carvao-muted">
            {tx("Painel ligado ao ato", "Panel linked to the act")}
            <select value={filtro.painel} onChange={(e) => definir({ painel: e.currentTarget.value })} className={campoData}>
              <option value="">{tx("Todos os painéis", "All panels")}</option>
              {paineis.map((p) => (
                <option key={p.href} value={slugPainel(p.href)}>
                  {rotuloPainelGold(p.rotulo)}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="flex flex-wrap items-center gap-x-4">
            <legend className="rotulo float-left mr-3 text-mineral">{tx("Origem", "Origin")}</legend>
            {ORIGENS.map((o) => (
              <label key={o || "todas"} className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-carvao">
                <input type="radio" name="regulacao-origem" checked={filtro.origem === o} onChange={() => definir({ origem: o })} className="h-4 w-4 accent-energia" />
                {o ? ROTULO_ORIGEM_EVENTO[o] : tx("Todas", "All")}
              </label>
            ))}
          </fieldset>
        </div>
        <fieldset data-nivel="analisar" className="flex flex-wrap items-end gap-x-4 gap-y-1">
          <legend className="rotulo float-left mr-3 self-center text-mineral">{tx("Período e ordem por data de", "Period and order by date of")}</legend>
          {BASES.map((b) => (
            <label key={b} className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-carvao">
              <input type="radio" name="regulacao-base" checked={filtro.base === b} onChange={() => definir({ base: b })} className="h-4 w-4 accent-energia" />
              {ROTULO_BASE[b]}
            </label>
          ))}
          <label className="text-xs text-carvao-muted">
            {tx("De", "From")}
            <input type="date" lang={langData} value={filtro.de} onChange={(e) => definir({ de: e.currentTarget.value })} className={campoData} />
          </label>
          <label className="text-xs text-carvao-muted">
            {tx("Até", "To")}
            <input type="date" lang={langData} value={filtro.ate} onChange={(e) => definir({ ate: e.currentTarget.value })} className={campoData} />
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
            {tx("Limpar filtros", "Clear filters")}
          </button>
        </div>
      </div>

      {ativo && (
        // a resposta do recorte inteiro já está acima do filtro; com filtro, o veredito do recorte e, por trás, a resposta completa dele
        <RespostaCurta id="p045" atributo="data-resposta-filtro" vivo tamanho="sm" veredito={vereditoLinhaTempo(r.eventos, eventos.length, filtro.base, versao)}>
          {comNomes(respostaLinhaTempo(r.eventos, eventos.length, filtro.base), idioma)}
        </RespostaCurta>
      )}

      <RegulacaoFaixas
        titulo={tx("Publicação e início de vigência de cada evento", "Publication and start of validity of each event")}
        faixas={faixas}
        selecionado={selecionado?.id ?? null}
        onSelecionar={selecionar}
        vazio={tx("Nenhum evento no recorte atual. Limpe os filtros para ver a linha do tempo inteira.", "No event in the current selection. Clear the filters to see the whole timeline.")}
        legenda={
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
            <li className="inline-flex items-center gap-1.5">
              <svg width="14" height="14" aria-hidden="true">
                <circle cx="7" cy="7" r="5" fill="var(--cor-superficie)" stroke="var(--cor-carvao-muted)" strokeWidth="2" />
              </svg>
              {tx("publicação no Diário Oficial", "publication in the Official Gazette")}
            </li>
            <li className="inline-flex items-center gap-1.5">
              <svg width="14" height="14" aria-hidden="true">
                <circle cx="7" cy="7" r="5" fill="var(--cor-carvao-muted)" />
              </svg>
              {tx("início de vigência", "start of validity")}
            </li>
            <li className="inline-flex items-center gap-1.5">
              <svg width="18" height="14" aria-hidden="true">
                <rect x="1" y="2" width="16" height="10" fill="var(--cor-carvao-muted)" />
              </svg>
              {tx("vigência conhecida só pelo mês", "validity known only by month")}
            </li>
            <li className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="inline-block h-2.5 w-4" style={{ background: "var(--cor-energia)" }} />
              {tx("ato ou lei lido no texto", "act or law read in full text")}
            </li>
            <li className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="inline-block h-2.5 w-4" style={{ background: "var(--serie-referencia)" }} />
              {tx("registro do conjunto de dados (ato não lido)", "dataset record (act not read)")}
            </li>
          </ul>
        }
      />

      {selecionado && (
        <div className="border border-energia bg-superficie p-4 text-sm" data-evento-selecionado={selecionado.id} aria-live="polite">
          <p className="rotulo text-energia-dark">{tx("Evento selecionado", "Selected event")}</p>
          <p className="mt-1 font-serif text-lg text-carvao">
            <TrechoPortugues regiao="regulacao-evento-titulo">{selecionado.titulo}</TrechoPortugues>
          </p>
          <p className="mt-1 text-carvao-muted">
            {selecionado.ato ? <Nome>{selecionado.ato}</Nome> : tipoAtoNoIdioma(selecionado.tipo_ato)}; {textoPublicacao(selecionado.data_publicacao)};{" "}
            {tx("vigência a partir de", "in force from")} {vigenciaTexto(selecionado)} ({textoDefasagemEvento(selecionado)}).
          </p>
          <p className="mt-2 flex flex-wrap gap-x-4">
            {/* o ato tem item na lista curta (Entender); o registro de bandeiras só aparece na lista completa (Analisar) */}
            <a href={origemEvento(selecionado) === "ato" ? `#resumo-${selecionado.id}` : `#evento-${selecionado.id}`} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
              {tx("Ver o evento na lista", "See the event in the list")}
            </a>
            <button type="button" onClick={() => selecionar(null)} className="rotulo inline-flex min-h-[44px] items-center text-carvao-muted underline underline-offset-4 hover:text-carvao">
              {tx("Remover seleção", "Clear selection")}
            </button>
          </p>
        </div>
      )}

      {recorte}
      {notas}

      {r.eventos.length > 0 && (
        <section aria-labelledby="lista-curta-titulo" className="space-y-6 border-t border-linha pt-6" data-lista-curta="">
          <div>
            {tx(
              <h3 id="lista-curta-titulo" className="ed-h3 font-serif text-carvao">
                Quais foram os eventos mais recentes?
              </h3>,
              <h3 id="lista-curta-titulo" className="ed-h3 font-serif text-carvao">
                What were the most recent events?
              </h3>,
            )}
            <p className="mt-1 max-w-prose2 text-sm leading-relaxed text-carvao-muted" data-sem-impacto="">
              {tx(
                "Do evento mais recente ao mais antigo. Sem impacto estimado nesta fonte: o observatório não estima o efeito de nenhum evento. O efeito que o próprio ato declara, o dispositivo e as conferências estão na lista completa, em Analisar. Os resumos são do observatório, escritos a partir do texto do ato: não substituem o texto oficial e não são parecer jurídico.",
                "From the most recent event to the oldest. No impact estimated in this source: the observatory does not estimate the effect of any event. The effect declared by the act itself, the provision and the checks are in the full list, under Analyze. The summaries are the observatory's, written from the text of the act: they do not replace the official text and are not legal advice.",
              )}
            </p>
          </div>

          {atos.length > 0 && (
            <div>
              <h4 className="rotulo text-mineral">
                {tx("Atos e leis lidos no texto", "Acts and laws read in full text")} ({atos.length})
              </h4>
              <ol aria-label={tx("Atos e leis no recorte", "Acts and laws in the selection")} className="ml-1.5 mt-2 border-l border-linha">
                {atos.map((e, k) => {
                  const sel = selecionado?.id === e.id;
                  const ano = rotuloAno(e);
                  const anterior = k > 0 ? rotuloAno(atos[k - 1]) : null;
                  return (
                    <li key={e.id} id={`resumo-${e.id}`} data-resumo-evento={e.id} className="relative scroll-mt-28 pb-6 pl-6 last:pb-1">
                      <span aria-hidden="true" className={`absolute -left-[6px] top-1.5 h-[11px] w-[11px] rounded-full border-2 ${sel ? "border-energia-dark bg-energia" : "border-energia bg-superficie"}`} />
                      {ano !== anterior && (
                        <p aria-hidden="true" className="rotulo mb-1 text-mineral">
                          {ano}
                        </p>
                      )}
                      <article aria-labelledby={`resumo-${e.id}-titulo`} className={sel ? "bg-energia-fundo p-3" : undefined}>
                        <h5 id={`resumo-${e.id}-titulo`} className="font-serif text-lg leading-snug text-carvao">
                          <TrechoPortugues regiao="regulacao-evento-titulo">{e.titulo}</TrechoPortugues>
                        </h5>
                        <p className="mt-0.5 text-sm text-carvao-muted [overflow-wrap:anywhere]">{atoOuTipo(e)}</p>
                        <p className="mt-0.5 text-sm tabular-nums text-carvao">
                          {e.data_publicacao ? (
                            <>
                              {tx("Publicação", "Publication")} <time dateTime={e.data_publicacao}>{dataBR(e.data_publicacao)}</time>
                            </>
                          ) : (
                            <span className="italic text-carvao-muted">{tx("Publicação não informada pela fonte", "Publication not reported by the source")}</span>
                          )}
                          {tx("; vigência a partir de ", "; in force from ")}
                          <time dateTime={e.vigencia_inicio}>{vigenciaTexto(e)}</time>
                        </p>
                        <p className="mt-1.5 max-w-prose2 text-sm leading-relaxed text-carvao">
                          <TrechoPortugues regiao="regulacao-evento-resumo">{resumoCurtoEvento(e, datasLegiveis)}</TrechoPortugues>
                        </p>
                        <p className="mt-1 text-sm text-carvao-muted">
                          {tx("Painéis ligados:", "Linked panels:")} {linksPaineis(e)}
                        </p>
                        <button
                          type="button"
                          aria-pressed={sel}
                          onClick={() => selecionar(sel ? null : e.id)}
                          className="rotulo mt-1 inline-flex min-h-[44px] items-center text-carvao-muted underline underline-offset-4 hover:text-carvao"
                        >
                          {sel ? tx("Remover seleção", "Clear selection") : tx("Destacar no gráfico", "Highlight in the chart")}
                        </button>
                      </article>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {registros.length > 0 && (
            <div>
              <h4 className="rotulo text-mineral">
                {tx("Registros do conjunto de dados de bandeiras", "Records from the tariff flag dataset")} ({registros.length})
              </h4>
              <p className="mt-1 max-w-prose2 text-sm leading-relaxed text-carvao-muted" data-vazios-registros="">
                {textoVaziosRegistros(registros)}
              </p>
              <ul aria-label={tx("Registros de bandeiras por tipo de ato", "Tariff flag records by type of act")} className="mt-2 grid gap-3 md:grid-cols-2">
                {grupos.map((gr) => (
                  <li key={gr.tipo} data-grupo-registros={gr.tipo} className="min-w-0 border border-linha bg-superficie p-4 text-sm">
                    <p className="rotulo text-energia-dark">{tipoAtoNoIdioma(gr.tipo)}</p>
                    <p className="mt-1 font-serif text-base leading-snug text-carvao">
                      {gr.n} {tx(pl(gr.n, "registro", "registros"), pl(gr.n, "record", "records"))}:{" "}
                      <TrechoPortugues regiao="regulacao-registro-titulos">{gr.titulos.join("; ")}</TrechoPortugues>
                    </p>
                    <p className="mt-1 tabular-nums text-carvao-muted">
                      {gr.n === 1
                        ? tx(`Em ${vigenciaTexto(gr.ultimo)}.`, `In ${vigenciaTexto(gr.ultimo)}.`)
                        : tx(`De ${vigenciaTexto(gr.primeiro)} a ${vigenciaTexto(gr.ultimo)}.`, `From ${vigenciaTexto(gr.primeiro)} to ${vigenciaTexto(gr.ultimo)}.`)}
                    </p>
                    {gr.ultimo.vigencia_grao === "mes" && (
                      <p className="mt-1 text-carvao-muted">{tx("Vigência conhecida só pelo mês: a fonte não informa o dia.", "Validity known only by month: the source does not report the day.")}</p>
                    )}
                    {gr.ultimo.vigencia_grao === "dia" && (
                      <p className="mt-1.5 leading-relaxed text-carvao">
                        {gr.n === 1 ? tx("O registro", "The record") : tx("O mais recente", "The most recent")}
                        {gr.ultimo.ato ? (
                          <>
                            {" ("}
                            <Nome>{gr.ultimo.ato}</Nome>
                            {")"}
                          </>
                        ) : (
                          ""
                        )}
                        : <TrechoPortugues regiao="regulacao-registro-resumo">{resumoCurtoEvento(gr.ultimo, datasLegiveis)}</TrechoPortugues>
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-2 max-w-prose2 text-sm text-carvao-muted">
                {tx(
                  `As ${registros.length} datas, com o valor de cada patamar, estão na lista completa, em Analisar.`,
                  `The ${registros.length} dates, with the value of each level, are in the full list, under Analyze.`,
                )}
              </p>
            </div>
          )}
        </section>
      )}

      {r.eventos.length > 0 && (
        <div data-nivel="analisar" id="lista-completa" className="space-y-4 border-t border-linha pt-6">
          <h3 className="ed-h3 font-serif text-carvao">
            {tx("Lista completa: cada evento com dispositivo, efeito declarado e evidência", "Full list: each event with provision, declared effect and evidence")}
          </h3>
          <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
            {tx("Sem impacto estimado nesta fonte, em nenhum dos eventos.", "No impact estimated in this source, for any of the events.")}{" "}
            {registros.length > 0
              ? tx(
                  `${textoVaziosRegistros(registros)} Por isso esses campos não aparecem nos cartões dos registros.`,
                  `${textoVaziosRegistros(registros)} That is why these fields do not appear on the record cards.`,
                )
              : ""}
          </p>
          <ol aria-label={tx("Eventos da linha do tempo no recorte", "Timeline events in the selection")} className="ml-1.5 border-l border-linha">
            {r.eventos.map((e, k) => {
              const ano = rotuloAno(e);
              const anoAnterior = k === 0 ? null : rotuloAno(r.eventos[k - 1]);
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
                      {ROTULO_ORIGEM_EVENTO[origemEvento(e)]} · {orgaoNoIdioma(e.orgao)}
                    </p>
                    <h4 id={`evento-${e.id}-titulo`} className="mt-0.5 font-serif text-lg leading-snug text-carvao">
                      <TrechoPortugues regiao="regulacao-evento-titulo">{e.titulo}</TrechoPortugues>
                    </h4>
                    <dl className="mt-1.5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-0.5 text-sm [&_dd]:[overflow-wrap:anywhere]">
                      <dt className="text-carvao-muted">{tx("Ato", "Act")}</dt>
                      <dd className="text-carvao">{atoOuTipo(e)}</dd>
                      {(e.data_publicacao || origemEvento(e) === "ato") && (
                        <>
                          <dt className="text-carvao-muted">{tx("Publicação", "Publication")}</dt>
                          <dd className="tabular-nums text-carvao">
                            {e.data_publicacao ? (
                              <time dateTime={e.data_publicacao}>{dataBR(e.data_publicacao)}</time>
                            ) : (
                              <span className="italic text-mineral">{tx("não informada pela fonte", "not reported by the source")}</span>
                            )}
                          </dd>
                        </>
                      )}
                      <dt className="text-carvao-muted">{tx("Vigência", "Validity")}</dt>
                      <dd className="tabular-nums text-carvao">
                        {tx("a partir de ", "from ")}
                        <time dateTime={e.vigencia_inicio}>{vigenciaTexto(e)}</time>
                        <span className="block text-xs text-carvao-muted">{textoDefasagemEvento(e)}</span>
                      </dd>
                      <dt className="text-carvao-muted">{tx("Dispositivo", "Provision")}</dt>
                      <dd className="text-carvao">
                        <TrechoPortugues regiao="regulacao-evento-dispositivo">{e.dispositivo}</TrechoPortugues>
                      </dd>
                      <dt className="text-carvao-muted">{tx("Painéis ligados", "Linked panels")}</dt>
                      <dd className="text-carvao">{linksPaineis(e)}</dd>
                    </dl>
                    <div className="mt-2 space-y-1.5 text-sm leading-relaxed">
                      <p className="text-carvao-muted">
                        <span className="rotulo mr-1.5 text-mineral">{tx("Resumo do observatório", "Observatory summary")}</span>
                        <TrechoPortugues regiao="regulacao-evento-resumo">{datasLegiveis(e.resumo)}</TrechoPortugues>
                      </p>
                      {e.efeito_declarado && (
                        <p className="text-carvao">
                          <span className="rotulo mr-1.5 text-mineral">{tx("Efeito declarado pelo ato", "Effect declared by the act")}</span>
                          <TrechoPortugues regiao="regulacao-evento-efeito">
                            <q>{e.efeito_declarado}</q>
                          </TrechoPortugues>
                        </p>
                      )}
                      {e.impacto_estimado && (
                        <p className="text-carvao-muted">
                          <span className="rotulo mr-1.5 text-mineral">{tx("Impacto estimado", "Estimated impact")}</span>
                          <TrechoPortugues regiao="regulacao-evento-impacto">{e.impacto_estimado}</TrechoPortugues>
                        </p>
                      )}
                    </div>
                    <details className="mt-2 text-sm" open={sel}>
                      <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-carvao-muted underline underline-offset-4">
                        {tx("Evidência: trecho literal, conferências e documento", "Evidence: literal passage, checks and document")}
                      </summary>
                      <div className="mt-1 space-y-1.5 border-l-2 border-linha pl-3 text-carvao-muted">
                        <p>
                          <span className="text-carvao">{tx("Onde foi lido:", "Where it was read:")}</span> {ROTULO_NIVEL_EVENTO[e.nivel_conferencia] ?? e.nivel_conferencia}
                          {e.trecho_confere === null
                            ? tx("; conferência do trecho não executada", "; passage check not run")
                            : e.trecho_confere
                              ? tx("; trecho encontrado no documento guardado", "; passage found in the stored document")
                              : tx("; trecho não encontrado no documento", "; passage not found in the document")}
                          .
                        </p>
                        {e.conferencia_publicacao && (
                          <p>
                            <span className="text-carvao">{tx("Data de publicação conferida:", "Publication date checked:")}</span>{" "}
                            {e.conferencia_publicacao.resultado === "aprovado" ? tx("aprovada", "passed") : e.conferencia_publicacao.resultado};{" "}
                            <TrechoPortugues regiao="regulacao-evento-conferencia">{e.conferencia_publicacao.detalhe}</TrechoPortugues>.
                          </p>
                        )}
                        <p>
                          <span className="text-carvao">{tx("Regra de vigência:", "Validity rule:")}</span>{" "}
                          <TrechoPortugues regiao="regulacao-evento-vigencia">
                            <q>{e.vigencia_regra}</q>
                          </TrechoPortugues>
                          {e.vigencia_calculada ? tx(" (data calculada pela LC nº 95/1998, art. 8º, § 1º)", " (date computed under LC nº 95/1998, art. 8º, § 1º)") : ""}
                        </p>
                        {e.trecho && e.origem === "conjunto_de_dados" && e.url_oficial && (
                          <p>
                            <span className="text-carvao">{tx("Registro no conjunto de dados:", "Record in the dataset:")}</span>{" "}
                            <TrechoPortugues regiao="regulacao-evento-registro">
                              <LiteralFonte classe="registro-composto-bandeiras" origem={e.url_oficial}>
                                {e.trecho}
                              </LiteralFonte>
                            </TrechoPortugues>
                          </p>
                        )}
                        {e.trecho && !(e.origem === "conjunto_de_dados" && e.url_oficial) && (
                          <p>
                            <span className="text-carvao">{tx("Trecho:", "Passage:")}</span>{" "}
                            <TrechoPortugues regiao="regulacao-evento-trecho">
                              <q>
                                <code className="font-sans">{e.trecho}</code>
                              </q>
                            </TrechoPortugues>
                          </p>
                        )}
                        {e.deliberacao && (
                          <p>
                            {tx(
                              `Deliberado na reunião ${textoReuniao(e.deliberacao.reuniao)} da Diretoria da ANEEL, em ${dataBR(e.deliberacao.data)}.`,
                              `Decided at ANEEL Board meeting ${textoReuniao(e.deliberacao.reuniao)}, on ${dataBR(e.deliberacao.data)}.`,
                            )}
                          </p>
                        )}
                        {e.observacoes.map((o) => (
                          <p key={o}>
                            <TrechoPortugues regiao="regulacao-evento-observacao">{o}</TrechoPortugues>
                          </p>
                        ))}
                        <p className="flex flex-wrap gap-x-4">
                          {e.url_oficial && (
                            <a href={e.url_oficial} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 [overflow-wrap:anywhere]">
                              {tx("Endereço oficial do documento", "Official address of the document")}
                              {abreNovaAba}
                            </a>
                          )}
                          {e.copia_publica && (
                            <a href={e.copia_publica} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 [overflow-wrap:anywhere]">
                              {tx("Cópia pública conferida por sha256", "Public copy checked by sha256")}
                              {abreNovaAba}
                            </a>
                          )}
                        </p>
                        {e.sha256 && <p className="text-xs [overflow-wrap:anywhere]">sha256 {codigo(e.sha256, idioma)}</p>}
                      </div>
                    </details>
                    <button
                      type="button"
                      aria-pressed={sel}
                      onClick={() => selecionar(sel ? null : e.id)}
                      className="rotulo mt-1 inline-flex min-h-[44px] items-center text-carvao-muted underline underline-offset-4 hover:text-carvao"
                    >
                      {sel ? tx("Remover seleção", "Clear selection") : tx("Destacar no gráfico e na tabela", "Highlight in the chart and the table")}
                    </button>
                  </article>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <TabelaInterativa
        titulo={tx("Eventos da linha do tempo no recorte (tabela equivalente)", "Timeline events in the selection (equivalent table)")}
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
        semLinhas={tx("Nenhum evento no recorte atual.", "No event in the current selection.")}
        nota={tx(
          "Mesmas linhas, na mesma ordem, do gráfico e da lista. Sem impacto estimado nesta fonte: a coluna de impacto fica vazia em todos os eventos, porque o observatório não estima efeito de norma.",
          "Same rows, in the same order, as the chart and the list. No impact estimated in this source: the impact column is empty for every event, as the observatory does not estimate the effect of rules.",
        )}
      />
    </div>
  );
}
