"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { RegulacaoFaixas } from "@/components/energia/RegulacaoFaixas";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { formatos } from "@/lib/energia/formato";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import { FASE_EN, comNomes, rotuloDado } from "@/lib/energia/i18n/regulacao-dados-metodo";
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import {
  COLUNAS_CONSULTAS,
  LEGENDA_SITUACAO,
  ORDEM_SITUACAO,
  ROTULO_CURTO_SITUACAO,
  ROTULO_FORMA_RESULTADO,
  SITUACOES_PADRAO,
  consultasNaData,
  contarSituacoes,
  defasagemAtas,
  faixasConsultas,
  linhasConsultas,
  ordenarConsultas,
  respostaConsultas,
  situacaoSeConfirmada,
  temaCurto,
  textoJanela,
  textoMudancaDeAbertas,
  textoReuniao,
  vereditoConsultas,
} from "@/lib/energia/regulacao";
import { faseAtual, hojeBrasilia, type Consultas, type SituacaoConsulta } from "@/lib/energia/tipos-regulacao";

/**
 * P046, consultas e audiências públicas da ANEEL. A situação de cada consulta é
 * recalculada pela regra do pipeline (situacaoConsulta) na data em que a página é
 * lida: o HTML sai com a data do build e, já no navegador, passa à data do dia no
 * horário de Brasília. Assim uma consulta vencida nunca continua aparecendo como
 * aberta, mesmo que a página estática tenha sido gerada dias antes.
 *
 * Recorte na URL: situações (`?sit=`, padrão: tudo o que ainda não foi decidido),
 * modalidade (`?mod=`) e a consulta escolhida (`?cp=`); o voltar desfaz. O gráfico
 * das janelas de contribuição, o detalhe e a tabela equivalente usam a mesma lista
 * filtrada e ordenada.
 */
const MODALIDADES = ["", "cp", "ap"] as const;
function nomeModalidade(m: (typeof MODALIDADES)[number], tx: <T>(pt: T, en: T) => T): string {
  if (m === "cp") return tx("Consultas públicas", "Public consultations");
  if (m === "ap") return tx("Audiências públicas", "Public hearings");
  return tx("Todas", "All");
}

export function RegulacaoConsultas({
  consultas,
  dataServidor,
  fonte,
  versao,
  cartao = null,
  ondeContribuir = null,
  legendaFigura = null,
  recorte = null,
  notas = null,
}: {
  consultas: Pick<Consultas, "itens" | "janela_dias" | "decisoes_sem_resultado_formal" | "atas_deliberadas_ate" | "atas_ate" | "atas_geradas_em" | "data_referencia">;
  /** Data do build (nunca anterior à data de referência da gold); o navegador troca pela de hoje. */
  dataServidor: string;
  fonte: string;
  versao: string;
  /** Número da data de referência com a ficha de prova (Numero), ao lado do veredito. */
  cartao?: ReactNode;
  /** Onde contribuir: fica logo abaixo do gráfico, com o que a figura mostra e a data das atas. */
  ondeContribuir?: ReactNode;
  /** O que a figura mostra do universo e onde baixar o resto (histórico completo), logo abaixo dela. */
  legendaFigura?: ReactNode;
  /** Período, universo e unidade como legenda, depois da figura e da tabela. */
  recorte?: ReactNode;
  /** Notas do painel (NotasDoPainel), logo depois da figura principal, da tabela e do recorte. */
  notas?: ReactNode;
}) {
  const tx = useTx();
  const idioma = useIdioma();
  const { dataBR } = formatos(idioma);
  const [hoje, setHoje] = useState(dataServidor);
  useEffect(() => {
    const h = hojeBrasilia();
    if (h > dataServidor) setHoje(h);
  }, [dataServidor]);

  const ids = useMemo(() => consultas.itens.map((c) => c.id), [consultas.itens]);
  const esquema = useMemo(
    () => ({
      sit: campo(tiposUrl.lista(tiposUrl.opcao(ORDEM_SITUACAO), { max: ORDEM_SITUACAO.length }), SITUACOES_PADRAO, { param: "sit" }),
      mod: campo(tiposUrl.opcao(MODALIDADES), "", { param: "mod" }),
      cp: campo(tiposUrl.opcao(["", ...ids]), "", { param: "cp" }),
    }),
    [ids.join(",")], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const [v, definir] = useEstadoUrl(esquema);

  const naData = useMemo(() => consultasNaData(consultas.itens, hoje), [consultas.itens, hoje]);
  const doModo = naData.filter((c) => (v.mod === "cp" ? c.modalidade === "Consulta Pública" : v.mod === "ap" ? c.modalidade === "Audiência Pública" : true));
  const contagem = contarSituacoes(doModo);
  const sit = new Set<SituacaoConsulta>(v.sit);
  // situação sem nenhuma consulta no recorte não ganha caixa: marcá-la não mudaria nada; ela é dita numa linha
  const situacoesComConsulta = ORDEM_SITUACAO.filter((s) => contagem[s] > 0);
  const situacoesSemConsulta = ORDEM_SITUACAO.filter((s) => contagem[s] === 0);
  const visiveis = ordenarConsultas(doModo.filter((c) => sit.has(c.situacao_na_data)));
  const faixas = faixasConsultas(visiveis);
  const linhas = linhasConsultas(visiveis);
  const selecionada = visiveis.find((c) => c.id === v.cp) ?? null;
  const selecionar = (id: string | null) => definir({ cp: id ?? "" });
  const defas = defasagemAtas(consultas, hoje);
  const filtroPadrao = v.mod === "" && v.sit.length === SITUACOES_PADRAO.length && SITUACOES_PADRAO.every((s) => sit.has(s));

  function alternar(s: SituacaoConsulta) {
    const novo = new Set(sit);
    if (novo.has(s)) novo.delete(s);
    else novo.add(s);
    definir({ sit: ORDEM_SITUACAO.filter((x) => novo.has(x)) });
  }

  const notaAtas = (
    <p
      role={defas.defasada ? "alert" : undefined}
      className={`border-l-2 pl-3 text-sm leading-relaxed ${defas.defasada ? "border-aviso text-carvao" : "border-mineral text-carvao-muted"}`}
      data-defasagem-atas={defas.dias ?? ""}
    >
      {defas.defasada ? tx("Fonte defasada: ", "Source out of date: ") : ""}
      {tx(
        <>
          As atas integradas trazem resultados deliberados até a reunião de {dataBR(consultas.atas_deliberadas_ate ?? null)} (pauta registrada até {dataBR(consultas.atas_ate ?? null)}), no
          arquivo gerado pela ANEEL em {dataBR(consultas.atas_geradas_em ?? null)}
          {defas.dias !== null ? `, ${defas.dias} ${defas.dias === 1 ? "dia" : "dias"} antes de ${dataBR(hoje)}` : ""}. Resultado deliberado depois disso não aparece: uma
          consulta encerrada pode já ter sido decidida.
        </>,
        <>
          The integrated minutes carry results decided up to the meeting of {dataBR(consultas.atas_deliberadas_ate ?? null)} (agenda recorded up to {dataBR(consultas.atas_ate ?? null)}), in
          the file generated by ANEEL on {dataBR(consultas.atas_geradas_em ?? null)}
          {defas.dias !== null ? `, ${defas.dias} ${defas.dias === 1 ? "day" : "days"} before ${dataBR(hoje)}` : ""}. A result decided after that does not appear: a closed
          consultation may already have been decided.
        </>,
      )}
    </p>
  );

  return (
    <div className="space-y-6">
      {/* a resposta à esquerda e, ao lado, o número com a ficha de prova e onde contribuir: o gráfico começa mais perto do topo */}
      <div className="grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start" data-abertura-painel="">
        <div className="space-y-3">
          <RespostaCurta id="p046" vivo veredito={vereditoConsultas(consultas, hoje)}>
            <span data-resposta-hoje={hoje}>{comNomes(respostaConsultas(consultas, hoje), idioma)}</span>
          </RespostaCurta>
          {hoje !== consultas.data_referencia && (
            <p className="border-l-2 border-mineral pl-3 text-sm leading-relaxed text-carvao-muted" data-recalculo="">
              {tx(
                <>Situação recalculada para {dataBR(hoje)} pela mesma regra do observatório; o número com a ficha Comprove é o da data de referência.</>,
                <>Status recomputed for {dataBR(hoje)} by the same observatory rule; the number with the Check card is that of the reference date.</>,
              )}{" "}
              {comNomes(textoMudancaDeAbertas(consultas.itens, consultas.data_referencia, hoje), idioma)}
            </p>
          )}
        </div>
        {cartao && <div className="lg:border-l lg:border-linha lg:pl-6">{cartao}</div>}
      </div>
      {defas.defasada && notaAtas}

      <div role="group" aria-label={tx("Filtros das consultas", "Consultation filters")} className="space-y-1 border-b border-linha pb-3">
        <fieldset className="flex flex-wrap items-center gap-x-3.5 max-sm:gap-x-2">
          <legend className="rotulo mr-3 text-mineral sm:float-left">{tx("Situação", "Status")}</legend>
          {situacoesComConsulta.map((s) => (
            <label key={s} className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-carvao max-sm:basis-[calc(50%-0.25rem)]">
              <input type="checkbox" checked={sit.has(s)} onChange={() => alternar(s)} className="h-4 w-4 accent-energia" />
              {ROTULO_CURTO_SITUACAO[s]} <span className="tabular-nums text-mineral">({contagem[s]})</span>
            </label>
          ))}
        </fieldset>
        {situacoesSemConsulta.length > 0 && (
          <p className="text-xs text-carvao-muted" data-situacoes-vazias="">
            {tx("Sem consultas nesta data em", "No consultations on this date in")}: {situacoesSemConsulta.map((s) => ROTULO_CURTO_SITUACAO[s]).join("; ")}.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-6">
          <fieldset className="flex flex-wrap items-center gap-x-4">
            <legend className="rotulo float-left mr-3 text-mineral">{tx("Modalidade", "Type")}</legend>
            {MODALIDADES.map((m) => (
              <label key={m || "todas"} className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-carvao">
                <input type="radio" name="regulacao-modalidade" checked={v.mod === m} onChange={() => definir({ mod: m })} className="h-4 w-4 accent-energia" />
                {nomeModalidade(m, tx)}
              </label>
            ))}
          </fieldset>
          <div className="flex flex-wrap items-center gap-x-4">
            <p className="text-sm text-carvao-muted" aria-live="polite" data-estado-filtro="">
              {tx(
                <>
                  Em {dataBR(hoje)}, mostrando {visiveis.length} de {naData.length} consultas {textoJanela(consultas.janela_dias)}
                  {filtroPadrao ? " (padrão: todas as ainda não decididas)" : ""}.
                </>,
                <>
                  On {dataBR(hoje)}, showing {visiveis.length} of {naData.length} consultations {textoJanela(consultas.janela_dias)}
                  {filtroPadrao ? " (default: all not yet decided)" : ""}.
                </>,
              )}
            </p>
            <button
              type="button"
              aria-disabled={filtroPadrao}
              onClick={() => !filtroPadrao && definir({ sit: SITUACOES_PADRAO, mod: "" })}
              className={`rotulo inline-flex min-h-[44px] items-center border px-3 ${!filtroPadrao ? "border-carvao-muted text-carvao hover:border-carvao" : "cursor-default border-linha text-mineral"}`}
            >
              {tx("Voltar ao padrão", "Back to default")}
            </button>
          </div>
        </div>
      </div>

      <RegulacaoFaixas
        titulo={tx(`Janelas de contribuição das consultas, com a data de ${dataBR(hoje)} como referência`, `Contribution windows of the consultations, with ${dataBR(hoje)} as reference`)}
        faixas={faixas}
        referencias={[{ data: hoje, rotulo: tx("data de leitura", "reading date") }]}
        selecionado={selecionada?.id ?? null}
        onSelecionar={selecionar}
        vazio={tx("Nenhuma consulta no recorte atual. Marque outras situações ou volte ao padrão.", "No consultation in the current selection. Tick other statuses or go back to the default.")}
        legenda={
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
            {LEGENDA_SITUACAO.map((l) => (
              <li key={l.situacao} className="inline-flex items-center gap-1.5">
                <svg width="22" height="10" aria-hidden="true">
                  <line x1="1" x2="21" y1="5" y2="5" stroke={l.cor} strokeWidth={l.traco === "fino" ? 2 : 6} strokeOpacity={l.traco === "fino" ? 0.9 : 0.45} strokeDasharray={l.traco === "tracejado" ? "6 4" : undefined} />
                </svg>
                {l.rotulo}
              </li>
            ))}
            <li className="inline-flex items-center gap-1.5">
              <svg width="14" height="14" aria-hidden="true">
                <circle cx="7" cy="7" r="5" fill="var(--cor-superficie)" stroke="var(--cor-carvao-muted)" strokeWidth="2" />
              </svg>
              {tx("fim calculado do início e da duração", "end computed from the start and the duration")}
            </li>
            <li data-legenda-siglas="">{tx("CP: consulta pública; AP: audiência pública", "CP: public consultation; AP: public hearing")}</li>
          </ul>
        }
      />

      {(legendaFigura || ondeContribuir || !defas.defasada) && (
        <div className="max-w-prose2 space-y-3 text-sm leading-relaxed text-carvao-muted">
          {legendaFigura && <p data-legenda-figura="">{legendaFigura}</p>}
          {ondeContribuir}
          {!defas.defasada && notaAtas}
        </div>
      )}

      {selecionada && (
        <section className="space-y-2 border border-energia bg-superficie p-4 text-sm" data-consulta-selecionada={selecionada.id} aria-labelledby="consulta-selecionada-titulo">
          <p className="rotulo text-energia-dark">
            {ROTULO_CURTO_SITUACAO[selecionada.situacao_na_data]} {tx("em", "on")} {dataBR(hoje)}
          </p>
          <h3 id="consulta-selecionada-titulo" className="font-serif text-lg text-carvao">
            <Nome>{selecionada.rotulo}</Nome>
          </h3>
          <p className="text-carvao">
            <TrechoPortugues regiao="regulacao-consulta-tema">{temaCurto(selecionada.tema)}</TrechoPortugues>
          </p>
          <p className="text-carvao-muted">
            {tx("Processo", "Proceeding")} {selecionada.processos.join(", ")}
            {selecionada.relator ? (
              <>
                {tx("; relator ", "; rapporteur ")}
                <Nome>{selecionada.relator}</Nome>
              </>
            ) : (
              ""
            )}
            .{" "}
            {tx(
              <>
                Abertura deliberada em {dataBR(selecionada.deliberacao_abertura.data)}, na reunião {textoReuniao(selecionada.deliberacao_abertura.reuniao)}.
              </>,
              <>
                Opening decided on {dataBR(selecionada.deliberacao_abertura.data)}, at meeting {textoReuniao(selecionada.deliberacao_abertura.reuniao)}.
              </>,
            )}
          </p>
          {selecionada.numero_suspeito && (
            <p className="text-carvao-muted">
              {tx("Número conferido: a ata registra", "Number checked: the minutes record")} {selecionada.numero_na_ata};{" "}
              {selecionada.motivo_numero_suspeito ? (
                <TrechoPortugues regiao="regulacao-consulta-numero">{selecionada.motivo_numero_suspeito}</TrechoPortugues>
              ) : (
                tx("número marcado como suspeito", "number flagged as suspect")
              )}
              .
            </p>
          )}
          <div className="tabela-scroll" tabIndex={0} role="region" aria-label={tx(`Fases de ${selecionada.rotulo} (rolável)`, `Phases of ${selecionada.rotulo} (scrollable)`)}>
            <table className="w-full min-w-[36rem] text-left text-xs">
              <caption className="sr-only">
                {tx("Fases deliberadas de", "Phases decided for")} <Nome>{selecionada.rotulo}</Nome>
              </caption>
              <thead>
                <tr className="border-b border-linha text-mineral">
                  <th scope="col" className="py-1 pr-3 font-normal">{tx("Fase", "Phase")}</th>
                  <th scope="col" className="py-1 pr-3 font-normal">{tx("Deliberação", "Decision")}</th>
                  <th scope="col" className="py-1 pr-3 font-normal">{tx("Início", "Start")}</th>
                  <th scope="col" className="py-1 pr-3 font-normal">{tx("Fim", "End")}</th>
                  <th scope="col" className="py-1 pr-3 font-normal">{tx("Duração declarada", "Declared duration")}</th>
                  <th scope="col" className="py-1 pr-3 font-normal">{tx("Sessão", "Session")}</th>
                  <th scope="col" className="py-1 font-normal">{tx("Expressão lida na ata", "Wording read in the minutes")}</th>
                </tr>
              </thead>
              <tbody>
                {selecionada.fases.map((f, i) => (
                  <tr key={`${i}:${f.fase}:${f.data_deliberacao}`} className={`border-b border-linha align-top ${f === faseAtual(selecionada) ? "text-carvao" : "text-carvao-muted"}`}>
                    <th scope="row" className="py-1 pr-3 font-normal">
                      {rotuloDado(FASE_EN, f.fase, idioma)}
                      {f === faseAtual(selecionada) ? tx(" (atual)", " (current)") : ""}
                    </th>
                    <td className="py-1 pr-3 tabular-nums">{dataBR(f.data_deliberacao)}</td>
                    <td className="py-1 pr-3 tabular-nums">{f.inicio ? dataBR(f.inicio) : tx("não informado", "not reported")}</td>
                    <td className="py-1 pr-3 tabular-nums">{f.fim ? `${dataBR(f.fim)}${f.fim_calculado ? tx(" (calculado)", " (computed)") : ""}` : tx("não informado", "not reported")}</td>
                    <td className="py-1 pr-3 tabular-nums">
                      {f.duracao_dias !== null ? tx(`${f.duracao_dias} dias`, `${f.duracao_dias} ${f.duracao_dias === 1 ? "day" : "days"}`) : tx("não informada", "not reported")}
                    </td>
                    <td className="py-1 pr-3 tabular-nums">{f.sessao ? dataBR(f.sessao) : tx("não se aplica ou não informada", "not applicable or not reported")}</td>
                    <td className="py-1">
                      {f.trecho_periodo ? (
                        <TrechoPortugues regiao="regulacao-consulta-periodo">
                          <q>{f.trecho_periodo}</q>
                        </TrechoPortugues>
                      ) : (
                        tx("sem período escrito", "no period written")
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selecionada.resultado ? (
            <p className="text-carvao-muted">
              {tx("Resultado", "Result")}{" "}
              {selecionada.resultado.decidido ? (
                tx("deliberado", "decided")
              ) : (
                <>
                  {tx("levado à reunião sem decisão", "taken to a meeting without a decision")} (
                  {selecionada.resultado.resultado_julgamento ? (
                    <TrechoPortugues regiao="regulacao-consulta-julgamento">{selecionada.resultado.resultado_julgamento}</TrechoPortugues>
                  ) : (
                    tx("sem registro do julgamento", "no record of the ruling")
                  )}
                  )
                </>
              )}{" "}
              {tx("em", "on")} {dataBR(selecionada.resultado.data)}, {tx("reunião", "meeting")} {textoReuniao(selecionada.resultado.reuniao)}
              {selecionada.resultado.ato ? (
                <>
                  : <Nome>{selecionada.resultado.ato}</Nome>
                </>
              ) : selecionada.resultado.ato_suspeito ? (
                tx(
                  <>
                    : a ata registra &quot;{selecionada.resultado.ato_na_ata ?? "sem registro"}&quot;, número fora da faixa do tipo, não exibido como ato (
                    {selecionada.resultado.motivo_ato_suspeito ?? "motivo não informado"})
                  </>,
                  <>
                    : the minutes record &quot;<Nome>{selecionada.resultado.ato_na_ata ?? "no record"}</Nome>&quot;, a number outside the range for the type, not shown as an act (
                    {selecionada.resultado.motivo_ato_suspeito ? (
                      <TrechoPortugues regiao="regulacao-consulta-ato-suspeito">{selecionada.resultado.motivo_ato_suspeito}</TrechoPortugues>
                    ) : (
                      "reason not reported"
                    )}
                    )
                  </>,
                )
              ) : (
                ""
              )}
              . {tx("Forma", "Form")}: {ROTULO_FORMA_RESULTADO[selecionada.resultado.forma]}; {tx("vínculo", "link")}{" "}
              {selecionada.resultado.vinculo === "numero_citado"
                ? tx("pelo número citado na ata", "through the number cited in the minutes")
                : selecionada.resultado.vinculo === "processo"
                  ? tx("pelo número do processo", "through the proceeding number")
                  : tx("pelo processo e pelo módulo aprovado", "through the proceeding and the approved module")}
              .
            </p>
          ) : (
            <p className="text-carvao-muted">{tx("Sem resultado levado à reunião pública da Diretoria nas atas integradas.", "No result taken to a public Board meeting in the integrated minutes.")}</p>
          )}
          {selecionada.agenda_codigos.length > 0 && (
            <p className="text-carvao-muted">
              {tx("Atividade da Agenda Regulatória citada na ata", "Regulatory agenda activity cited in the minutes")}: {selecionada.agenda_codigos.join(", ")} (
              <a href="#agenda" className="text-energia-dark underline underline-offset-4">
                {tx("ver na agenda", "see in the agenda")}
              </a>
              ).
            </p>
          )}
          <button type="button" onClick={() => selecionar(null)} className="rotulo inline-flex min-h-[44px] items-center text-carvao-muted underline underline-offset-4 hover:text-carvao">
            {tx("Remover seleção", "Clear selection")}
          </button>
        </section>
      )}

      <TabelaInterativa
        titulo={tx(`Consultas e audiências públicas no recorte, situação em ${dataBR(hoje)} (tabela equivalente)`, `Public consultations and hearings in the selection, status on ${dataBR(hoje)} (equivalent table)`)}
        colunas={COLUNAS_CONSULTAS}
        linhas={linhas}
        chaveLinha="id"
        colunaRotulo="rotulo"
        fonte={fonte}
        versao={versao}
        nomeArquivo="regulacao-consultas"
        chaveUrl="cpt"
        selecionado={selecionada?.id ?? null}
        onSelecionar={selecionar}
        semLinhas={tx("Nenhuma consulta no recorte atual.", "No consultation in the current selection.")}
        nota={tx(
          "Mesmas linhas, na mesma ordem, do gráfico. Data vazia quer dizer que a ata não a escreve; a situação dessas consultas não é derivável e nunca aparece como aberta.",
          "Same rows, in the same order, as the chart. An empty date means the minutes do not write it; the status of these consultations cannot be derived and never shows as open.",
        )}
      />

      {recorte}
      {notas}

      {(consultas.decisoes_sem_resultado_formal ?? []).length > 0 && (
        <section aria-labelledby="sem-resultado-formal-titulo" className="space-y-2 border-t border-linha pt-6" data-decisoes-sem-resultado="" data-nivel="analisar">
          <h3 id="sem-resultado-formal-titulo" className="ed-h3 font-serif text-carvao">
            {tx("Quais decisões de abertura ainda não têm resultado formal na ata (fora da contagem)?", "Which opening decisions have no formal result in the minutes yet (left out of the count)?")}
          </h3>
          <ul className="space-y-2 text-sm text-carvao-muted">
            {(consultas.decisoes_sem_resultado_formal ?? []).map((d) => {
              const s = situacaoSeConfirmada(d, hoje);
              return (
                <li key={`${d.data}:${d.processos.join(",")}`} className="border-l-2 border-linha pl-3">
                  <span className="text-carvao">
                    <TrechoPortugues regiao="regulacao-decisao-assunto">{temaCurto(d.assunto)}</TrechoPortugues>
                  </span>{" "}
                  {tx(
                    `Pauta de ${dataBR(d.data)}, reunião ${textoReuniao(d.reuniao)}, processo ${d.processos.join(", ")}.`,
                    `Agenda of ${dataBR(d.data)}, meeting ${textoReuniao(d.reuniao)}, proceeding ${d.processos.join(", ")}.`,
                  )}{" "}
                  {d.inicio && d.fim
                    ? tx(`Período escrito na decisão: ${dataBR(d.inicio)} a ${dataBR(d.fim)}.`, `Period written in the decision: ${dataBR(d.inicio)} to ${dataBR(d.fim)}.`)
                    : tx("Sem período escrito na decisão.", "No period written in the decision.")}{" "}
                  {s
                    ? tx(`Se a ata confirmar, em ${dataBR(hoje)} estaria: ${ROTULO_CURTO_SITUACAO[s].toLowerCase()}.`, `If the minutes confirm it, on ${dataBR(hoje)} it would be: ${ROTULO_CURTO_SITUACAO[s].toLowerCase()}.`)
                    : ""}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
