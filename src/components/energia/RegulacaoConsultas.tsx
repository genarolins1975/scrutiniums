"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { RegulacaoFaixas } from "@/components/energia/RegulacaoFaixas";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { dataBR } from "@/lib/energia/formato";
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
const NOME_MODALIDADE: Record<(typeof MODALIDADES)[number], string> = { "": "Todas", cp: "Consultas públicas", ap: "Audiências públicas" };

export function RegulacaoConsultas({
  consultas,
  dataServidor,
  fonte,
  versao,
  inicioHistorico = null,
  depoisDaResposta = null,
  recorte = null,
  notas = null,
}: {
  consultas: Pick<Consultas, "itens" | "janela_dias" | "decisoes_sem_resultado_formal" | "atas_deliberadas_ate" | "atas_ate" | "atas_geradas_em" | "data_referencia">;
  /** Data do build (nunca anterior à data de referência da gold); o navegador troca pela de hoje. */
  dataServidor: string;
  fonte: string;
  versao: string;
  /** Ano de início do histórico no CSV, lido da proveniência da gold (null sem a data). */
  inicioHistorico?: string | null;
  /** Onde contribuir: entra logo depois do veredito, para que a resposta seja a primeira coisa do painel. */
  depoisDaResposta?: ReactNode;
  /** Período, universo e unidade como legenda, depois da figura e da tabela. */
  recorte?: ReactNode;
  /** Notas do painel (NotasDoPainel), logo depois da figura principal, da tabela e do recorte. */
  notas?: ReactNode;
}) {
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

  return (
    <div className="space-y-6">
      <RespostaCurta id="p046" vivo veredito={vereditoConsultas(consultas, hoje)}>
        <span data-resposta-hoje={hoje}>{respostaConsultas(consultas, hoje)}</span>
      </RespostaCurta>
      {hoje !== consultas.data_referencia && (
        <p className="border-l-2 border-mineral pl-3 text-sm leading-relaxed text-carvao-muted" data-recalculo="">
          Situação recalculada para {dataBR(hoje)} pela mesma regra do observatório. O número com a ficha Comprove acima se refere a {dataBR(consultas.data_referencia)}, a data de
          referência da publicação. {textoMudancaDeAbertas(consultas.itens, consultas.data_referencia, hoje)}
        </p>
      )}
      {depoisDaResposta}
      <p role={defas.defasada ? "alert" : undefined} className={`border-l-2 pl-3 text-sm leading-relaxed ${defas.defasada ? "border-aviso text-carvao" : "border-mineral text-carvao-muted"}`} data-defasagem-atas={defas.dias ?? ""}>
        {defas.defasada ? "Fonte defasada: " : ""}
        As atas integradas trazem resultados deliberados até a reunião de {dataBR(consultas.atas_deliberadas_ate ?? null)} (pauta registrada até {dataBR(consultas.atas_ate ?? null)}), no
        arquivo gerado pela ANEEL em {dataBR(consultas.atas_geradas_em ?? null)}
        {defas.dias !== null ? `, ${defas.dias} ${defas.dias === 1 ? "dia" : "dias"} antes de ${dataBR(hoje)}` : ""}. Resultado deliberado depois disso não aparece: uma
        consulta encerrada pode já ter sido decidida.
      </p>

      <div role="group" aria-label="Filtros das consultas" className="space-y-2 border-b border-linha pb-3">
        <fieldset className="flex flex-wrap items-center gap-x-4">
          <legend className="rotulo float-left mr-3 text-mineral">Situação em {dataBR(hoje)}</legend>
          {situacoesComConsulta.map((s) => (
            <label key={s} className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-carvao">
              <input type="checkbox" checked={sit.has(s)} onChange={() => alternar(s)} className="h-4 w-4 accent-energia" />
              {ROTULO_CURTO_SITUACAO[s]} <span className="tabular-nums text-mineral">({contagem[s]})</span>
            </label>
          ))}
        </fieldset>
        {situacoesSemConsulta.length > 0 && (
          <p className="text-xs text-carvao-muted" data-situacoes-vazias="">
            Sem consultas nesta data em: {situacoesSemConsulta.map((s) => ROTULO_CURTO_SITUACAO[s]).join("; ")}.
          </p>
        )}
        <fieldset className="flex flex-wrap items-center gap-x-4">
          <legend className="rotulo float-left mr-3 text-mineral">Modalidade</legend>
          {MODALIDADES.map((m) => (
            <label key={m || "todas"} className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-carvao">
              <input type="radio" name="regulacao-modalidade" checked={v.mod === m} onChange={() => definir({ mod: m })} className="h-4 w-4 accent-energia" />
              {NOME_MODALIDADE[m]}
            </label>
          ))}
        </fieldset>
        <div className="flex flex-wrap items-center gap-x-4">
          <p className="text-sm text-carvao-muted" aria-live="polite" data-estado-filtro="">
            Mostrando {visiveis.length} de {naData.length} consultas {textoJanela(consultas.janela_dias)}
            {filtroPadrao ? " (padrão: todas as ainda não decididas)" : ""}.
          </p>
          <button
            type="button"
            aria-disabled={filtroPadrao}
            onClick={() => !filtroPadrao && definir({ sit: SITUACOES_PADRAO, mod: "" })}
            className={`rotulo inline-flex min-h-[44px] items-center border px-3 ${!filtroPadrao ? "border-carvao-muted text-carvao hover:border-carvao" : "cursor-default border-linha text-mineral"}`}
          >
            Voltar ao padrão
          </button>
        </div>
      </div>

      <RegulacaoFaixas
        titulo={`Janelas de contribuição das consultas, com a data de ${dataBR(hoje)} como referência`}
        faixas={faixas}
        referencias={[{ data: hoje, rotulo: "data de leitura" }]}
        selecionado={selecionada?.id ?? null}
        onSelecionar={selecionar}
        vazio="Nenhuma consulta no recorte atual. Marque outras situações ou volte ao padrão."
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
              fim calculado do início e da duração
            </li>
            <li data-legenda-siglas="">CP: consulta pública; AP: audiência pública</li>
          </ul>
        }
      />

      {selecionada && (
        <section className="space-y-2 border border-energia bg-superficie p-4 text-sm" data-consulta-selecionada={selecionada.id} aria-labelledby="consulta-selecionada-titulo">
          <p className="rotulo text-energia-dark">{ROTULO_CURTO_SITUACAO[selecionada.situacao_na_data]} em {dataBR(hoje)}</p>
          <h4 id="consulta-selecionada-titulo" className="font-serif text-lg text-carvao">
            {selecionada.rotulo}
          </h4>
          <p className="text-carvao">{temaCurto(selecionada.tema)}</p>
          <p className="text-carvao-muted">
            Processo {selecionada.processos.join(", ")}
            {selecionada.relator ? `; relator ${selecionada.relator}` : ""}. Abertura deliberada em {dataBR(selecionada.deliberacao_abertura.data)}, na reunião{" "}
            {textoReuniao(selecionada.deliberacao_abertura.reuniao)}.
          </p>
          {selecionada.numero_suspeito && (
            <p className="text-carvao-muted">
              Número conferido: a ata registra {selecionada.numero_na_ata}; {selecionada.motivo_numero_suspeito ?? "número marcado como suspeito"}.
            </p>
          )}
          <div className="tabela-scroll" tabIndex={0} role="region" aria-label={`Fases de ${selecionada.rotulo} (rolável)`}>
            <table className="w-full min-w-[36rem] text-left text-xs">
              <caption className="sr-only">Fases deliberadas de {selecionada.rotulo}</caption>
              <thead>
                <tr className="border-b border-linha text-mineral">
                  <th scope="col" className="py-1 pr-3 font-normal">Fase</th>
                  <th scope="col" className="py-1 pr-3 font-normal">Deliberação</th>
                  <th scope="col" className="py-1 pr-3 font-normal">Início</th>
                  <th scope="col" className="py-1 pr-3 font-normal">Fim</th>
                  <th scope="col" className="py-1 pr-3 font-normal">Duração declarada</th>
                  <th scope="col" className="py-1 pr-3 font-normal">Sessão</th>
                  <th scope="col" className="py-1 font-normal">Expressão lida na ata</th>
                </tr>
              </thead>
              <tbody>
                {selecionada.fases.map((f, i) => (
                  <tr key={`${i}:${f.fase}:${f.data_deliberacao}`} className={`border-b border-linha align-top ${f === faseAtual(selecionada) ? "text-carvao" : "text-carvao-muted"}`}>
                    <th scope="row" className="py-1 pr-3 font-normal">
                      {f.fase}
                      {f === faseAtual(selecionada) ? " (atual)" : ""}
                    </th>
                    <td className="py-1 pr-3 tabular-nums">{dataBR(f.data_deliberacao)}</td>
                    <td className="py-1 pr-3 tabular-nums">{f.inicio ? dataBR(f.inicio) : "não informado"}</td>
                    <td className="py-1 pr-3 tabular-nums">{f.fim ? `${dataBR(f.fim)}${f.fim_calculado ? " (calculado)" : ""}` : "não informado"}</td>
                    <td className="py-1 pr-3 tabular-nums">{f.duracao_dias !== null ? `${f.duracao_dias} dias` : "não informada"}</td>
                    <td className="py-1 pr-3 tabular-nums">{f.sessao ? dataBR(f.sessao) : "não se aplica ou não informada"}</td>
                    <td className="py-1">{f.trecho_periodo ? <q>{f.trecho_periodo}</q> : "sem período escrito"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selecionada.resultado ? (
            <p className="text-carvao-muted">
              Resultado {selecionada.resultado.decidido ? "deliberado" : `levado à reunião sem decisão (${selecionada.resultado.resultado_julgamento || "sem registro do julgamento"})`} em{" "}
              {dataBR(selecionada.resultado.data)}, reunião {textoReuniao(selecionada.resultado.reuniao)}
              {selecionada.resultado.ato
                ? `: ${selecionada.resultado.ato}`
                : selecionada.resultado.ato_suspeito
                  ? `: a ata registra "${selecionada.resultado.ato_na_ata ?? "sem registro"}", número fora da faixa do tipo, não exibido como ato (${selecionada.resultado.motivo_ato_suspeito ?? "motivo não informado"})`
                  : ""}
              . Forma: {ROTULO_FORMA_RESULTADO[selecionada.resultado.forma]}; vínculo{" "}
              {selecionada.resultado.vinculo === "numero_citado" ? "pelo número citado na ata" : selecionada.resultado.vinculo === "processo" ? "pelo número do processo" : "pelo processo e pelo módulo aprovado"}.
            </p>
          ) : (
            <p className="text-carvao-muted">Sem resultado levado à reunião pública da Diretoria nas atas integradas.</p>
          )}
          {selecionada.agenda_codigos.length > 0 && (
            <p className="text-carvao-muted">
              Atividade da Agenda Regulatória citada na ata: {selecionada.agenda_codigos.join(", ")} (
              <a href="#agenda" className="text-energia-dark underline underline-offset-4">
                ver na agenda
              </a>
              ).
            </p>
          )}
          <button type="button" onClick={() => selecionar(null)} className="rotulo inline-flex min-h-[44px] items-center text-carvao-muted underline underline-offset-4 hover:text-carvao">
            Remover seleção
          </button>
        </section>
      )}

      <TabelaInterativa
        titulo={`Consultas e audiências públicas no recorte, situação em ${dataBR(hoje)} (tabela equivalente)`}
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
        semLinhas="Nenhuma consulta no recorte atual."
        nota={`Mesmas linhas, na mesma ordem, do gráfico. Data vazia quer dizer que a ata não a escreve; a situação dessas consultas não é derivável e nunca aparece como aberta. O histórico completo${inicioHistorico ? `, desde ${inicioHistorico},` : ""} está no CSV do painel.`}
      />

      {recorte}
      {notas}

      {(consultas.decisoes_sem_resultado_formal ?? []).length > 0 && (
        <section aria-labelledby="sem-resultado-formal-titulo" className="space-y-2 border-t border-linha pt-6" data-decisoes-sem-resultado="" data-nivel="analisar">
          <h3 id="sem-resultado-formal-titulo" className="ed-h3 font-serif text-carvao">
            Quais decisões de abertura ainda não têm resultado formal na ata (fora da contagem)?
          </h3>
          <ul className="space-y-2 text-sm text-carvao-muted">
            {(consultas.decisoes_sem_resultado_formal ?? []).map((d) => {
              const s = situacaoSeConfirmada(d, hoje);
              return (
                <li key={`${d.data}:${d.processos.join(",")}`} className="border-l-2 border-linha pl-3">
                  <span className="text-carvao">{temaCurto(d.assunto)}</span> Pauta de {dataBR(d.data)}, reunião {textoReuniao(d.reuniao)}, processo {d.processos.join(", ")}.{" "}
                  {d.inicio && d.fim ? `Período escrito na decisão: ${dataBR(d.inicio)} a ${dataBR(d.fim)}.` : "Sem período escrito na decisão."}{" "}
                  {s ? `Se a ata confirmar, em ${dataBR(hoje)} estaria: ${ROTULO_CURTO_SITUACAO[s].toLowerCase()}.` : ""}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
