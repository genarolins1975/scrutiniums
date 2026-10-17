"use client";

import { useMemo, type ReactNode } from "react";
import { Comparador } from "@/components/energia/Comparador";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { Numero } from "@/components/energia/Numero";
import { RedeEscolha } from "@/components/energia/RedeControles";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { Nome } from "@/components/i18n/Nome";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import type { Evidencia } from "@/lib/energia/evidencia";
import { formatos } from "@/lib/energia/formato";
import { UNIDADE_ATLS_EN, rotuloDaGold } from "@/lib/energia/i18n/agua-carga-rede";
import {
  COR_COMPARACAO,
  COR_SM,
  REGIOES_BALANCO,
  colunasAtls,
  colunasInterrupcoesAno,
  colunasPerturbacoes,
  curtoSm,
  fluxoEscolhido,
  fluxosAtivos,
  inicioArquivoAtls,
  listaTexto,
  linhasAtls,
  linhasInterrupcoesAno,
  linhasPerturbacoes,
  nomeFluxo,
  nomeSm,
  paraTabela,
  respostaRestricoes,
  serieAtls,
  vereditoRestricoes,
} from "@/lib/energia/rede";
import { LIMITE_COMPARACAO } from "@/lib/energia/tabela";
import type { RestricoesRede, SubsistemaOuSin } from "@/lib/energia/tipos-rede";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import type { Idioma } from "@/lib/idioma";

/**
 * P030, restrições publicadas. O recorte fica na URL: fluxo do ATLS escolhido (?fl=),
 * fluxos comparados no histórico (?fls=, até quatro), região das interrupções (?smi=)
 * e intervalo do histórico mensal (?de=, ?ate=); busca, ordem, filtros e página de cada
 * tabela também (prefixos at, atm, at.h, int, mp, pr). Escolher um fluxo na barra ou na
 * tabela muda a ficha de prova, a definição e o histórico juntos.
 *
 * Pergunta própria (Anexo A, P030): sem limites operativos públicos (achado A06), o
 * painel mostra a evidência publicada de limitação, que é o tempo acima do limite
 * sistêmico (ATLS) e os cortes de carga. Nenhum percentual de utilização é calculado.
 */
const ESQUEMA = {
  fl: campo(tiposUrl.texto({ max: 20 }), ""),
  fls: campo(tiposUrl.lista(tiposUrl.texto({ max: 20 }), { max: LIMITE_COMPARACAO }), [] as string[]),
  smi: campo(tiposUrl.opcao(REGIOES_BALANCO), "SIN"),
  de: campo(tiposUrl.mes(), ""),
  ate: campo(tiposUrl.mes(), ""),
};

const opcoesRegiao = (idioma: Idioma) => REGIOES_BALANCO.map((sm) => ({ id: sm, rotulo: sm === "SE" ? curtoSm("SE", idioma) : nomeSm(sm, idioma), detalhe: nomeSm(sm, idioma) }));

export function RedeRestricoes({
  restricoes,
  evidencias,
  fonteAtls,
  fonteInterrupcoes,
  versao,
  limites,
  limitesDetalhe,
  notas,
  aposPrincipal,
  titulosDocumentos,
  criterioCorte,
}: {
  restricoes: Pick<RestricoesRede, "atls" | "interrupcoes">;
  /** Título de cada documento do ONS pelo identificador que a gold usa em documento_definicao. */
  titulosDocumentos: Record<string, string>;
  /** Critério de corte citado na descrição do conjunto de interrupções (trecho conferido na gold), ou null. */
  criterioCorte?: string | null;
  /** Fichas de prova das horas de 12 meses por fluxo (chave atls_12m.<fluxo>). */
  evidencias: Record<string, Evidencia>;
  fonteAtls: string;
  fonteInterrupcoes: string;
  versao: string;
  /** Bloco do estado bloqueado (limites operativos sem fonte aberta), ao lado do veredito: sempre à vista. */
  limites?: ReactNode;
  /** O que a busca pelos limites encontrou (tabela), em Analisar, em largura inteira logo depois do veredito. */
  limitesDetalhe?: ReactNode;
  /** Notas do painel (NotasDoPainel: o que mudou e a ressalva essencial), logo depois da figura principal e do histórico. */
  notas?: ReactNode;
  /** Conteúdo depois das notas (os capítulos do módulo), antes das seções complementares. */
  aposPrincipal?: ReactNode;
}) {
  const idioma = useIdioma();
  const tx = useTx();
  const { dataBR, mesAno, num, plural } = formatos(idioma);
  const r = restricoes;
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const ativos = useMemo(() => fluxosAtivos(r.atls), [r.atls]);
  const escolhido = fluxoEscolhido(r.atls, v.fl);
  // as linhas dos fluxos publicados no último mês: o gráfico, a tabela e a exportação recebem esta mesma variável; `nome_grafico` só serve ao eixo
  // das barras (a sigla sem definição pública leva asterisco, com a legenda sob o gráfico) e a tabela não o usa
  const semDefinicao = useMemo(() => new Set(r.atls.fluxos.filter((f) => !f.definicao).map((f) => f.fluxo)), [r.atls.fluxos]);
  const linhasAtivos = useMemo(
    () => linhasAtls(ativos, idioma).map((l) => ({ ...l, nome_grafico: semDefinicao.has(l.fluxo) ? `${l.nome}*` : l.nome })),
    [ativos, semDefinicao, idioma],
  );
  const linhasTodos = useMemo(() => linhasAtls(r.atls.fluxos, idioma), [r.atls.fluxos, idioma]);
  const conhecidos = new Set(r.atls.fluxos.map((f) => f.fluxo));
  const comparados = (v.fls as string[]).filter((f) => conhecidos.has(f));
  const noHistorico = comparados.length ? comparados : escolhido ? [escolhido.fluxo] : [];
  // nome legível de cada sigla do ONS (a definição conferida; sem ela, a própria sigla)
  const nomes = new Map(r.atls.fluxos.map((f) => [f.fluxo, nomeFluxo(f, idioma)]));
  const nomeDe = (sigla: string) => nomes.get(sigla) ?? sigla;
  const fluxosHistorico = r.atls.fluxos.filter((f) => noHistorico.includes(f.fluxo));
  const serie = useMemo(() => serieAtls(fluxosHistorico), [fluxosHistorico]);
  const smi = v.smi as SubsistemaOuSin;
  const anual = useMemo(() => linhasInterrupcoesAno(r.interrupcoes, smi, idioma), [r.interrupcoes, smi, idioma]);
  const intervalo = v.de && v.ate ? { inicio: v.de, fim: v.ate } : null;
  const selecionar = (id: string | null) => definir({ fl: id ?? "" });
  const semDefinicaoNoGrafico = linhasAtivos.some((l) => semDefinicao.has(l.fluxo));
  const ev = escolhido ? evidencias[`atls_12m.${escolhido.fluxo}`] : undefined;
  const ultimo = r.atls.ultimo_mes;
  const inicioArquivo = inicioArquivoAtls(r.atls);
  const parciais = anual.filter((l) => l.parcial === tx("sim", "yes")).map((l) => l.id);
  const nomeRegiao = smi === "SIN" ? "SIN" : nomeSm(smi, idioma);
  const listaParciais = listaTexto(parciais, idioma);
  const nomesHistorico = noHistorico.map(nomeDe).join(", ");
  const documento = escolhido?.documento_definicao ? titulosDocumentos[escolhido.documento_definicao] : undefined;

  return (
    <div className="space-y-6">
      <div className="grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:items-start">
        <RespostaCurta id="p030" veredito={vereditoRestricoes(r, idioma)}>
          {respostaRestricoes(r, idioma)}
        </RespostaCurta>
        {limites}
      </div>
      {limitesDetalhe}

      <GraficoBarras
        titulo={tx(
          `Horas acima do limite em 12 meses, fluxos publicados em ${ultimo ? mesAno(ultimo) : "último mês"}`,
          `Hours above the limit in 12 months, flows published in ${ultimo ? mesAno(ultimo) : "the last month"}`,
        )}
        dados={paraTabela(linhasAtivos)}
        chaveCategoria="id"
        chaveRotulo="nome_grafico"
        series={[{ id: "horas_12m", rotulo: tx("Horas acima do limite", "Hours above the limit"), cor: "var(--cor-energia)" }]} // i18n: dado
        unidade="h"
        casas={1}
        orientacao="horizontal"
        rotulosValor
        selecionado={escolhido?.fluxo ?? null}
        onSelecionar={selecionar}
      />
      {semDefinicaoNoGrafico && (
        <p className="max-w-prose2 text-sm text-carvao-muted">
          {tx(
            "* Sigla do ONS sem definição em documento público conferido; as demais aparecem com o nome que o documento dá ao fluxo.",
            "* ONS code with no definition in a checked public document; the others appear with the name the document gives the flow.",
          )}
        </p>
      )}
      <TabelaInterativa
        titulo={tx("Tabela equivalente: fluxos publicados no último mês", "Equivalent table: flows published in the last month")}
        colunas={colunasAtls(idioma)}
        linhas={paraTabela(linhasAtivos)}
        chaveLinha="id"
        colunaRotulo="nome"
        fonte={fonteAtls}
        versao={versao}
        nomeArquivo="rede-atls-12-meses"
        chaveUrl="at"
        selecionado={escolhido?.fluxo ?? null}
        onSelecionar={selecionar}
        nota={tx(
          "Definição só quando conferida literalmente em documento público do ONS; as demais siglas ficam sem definição. A correspondência entre siglas do ATLS e as fronteiras do conjunto de intercâmbio não é direta e não é feita.",
          "A definition only when checked word for word in a public ONS document; the other codes stay without a definition. The match between ATLS codes and the boundaries of the interchange dataset is not direct and is not made.",
        )}
      />

      {escolhido && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[minmax(0,20rem)_1fr]">
            <Numero
              rotulo={tx(`Horas acima do limite em 12 meses, ${nomeFluxo(escolhido, "pt")}`, `Hours above the limit in 12 months, ${nomeFluxo(escolhido, "en")}`)}
              natureza="CALCULADO"
              valor={ev ? undefined : (escolhido.ultimos_12_meses?.horas_violacao ?? null)}
              evidencia={ev ?? null}
              casas={1}
              unidade="h"
              periodo={
                escolhido.ultimos_12_meses
                  ? tx(
                      `${mesAno(escolhido.ultimos_12_meses.inicio)} a ${mesAno(escolhido.ultimos_12_meses.fim)}`,
                      `${mesAno(escolhido.ultimos_12_meses.inicio)} to ${mesAno(escolhido.ultimos_12_meses.fim)}`,
                    )
                  : undefined
              }
              tamanho="medio"
              motivoAusencia={tx("Sem mês publicado na janela.", "No month published in the window.")}
              nota={
                [
                  escolhido.ativo
                    ? ""
                    : tx(
                        `Fluxo encerrado: último mês publicado ${escolhido.fim ? mesAno(escolhido.fim) : "sem dado"}; a janela é a dos seus 12 últimos meses.`,
                        `Discontinued flow: last month published ${escolhido.fim ? mesAno(escolhido.fim) : "no data"}; the window is its last 12 months.`,
                      ),
                  ev
                    ? ""
                    : tx(
                        "Sem ficha Comprove nesta publicação (a ficha comprova só os fluxos publicados no último mês); o valor é a soma das linhas mensais do arquivo do ATLS para download.",
                        "No evidence card in this release (the card only proves the flows published in the last month); the value is the sum of the monthly rows of the ATLS file for download.",
                      ),
                ]
                  .filter(Boolean)
                  .join(" ") || undefined
              }
            />
            <div className="space-y-2 text-sm text-carvao-muted">
              <p>
                <span className="text-carvao">{nomeFluxo(escolhido, idioma)}</span>
                {escolhido.definicao
                  ? tx<ReactNode>(
                      ` (sigla do ONS: ${escolhido.fluxo}): definição conferida em ${documento || "documento público do ONS"}.`,
                      <>
                        {` (ONS code: ${escolhido.fluxo}): definition checked in `}
                        {documento ? <Nome>{documento}</Nome> : "a public ONS document"}.
                      </>,
                    )
                  : tx(
                      ": sem definição em documento público conferido; a sigla é publicada como o ONS a escreve.",
                      ": no definition in a checked public document; the code is published as ONS writes it.",
                    )}
              </p>
              <p>
                {tx(
                  <>
                    No arquivo de {escolhido.inicio ? mesAno(escolhido.inicio) : "sem início"} a {escolhido.fim ? mesAno(escolhido.fim) : "sem fim"}: {escolhido.meses_com_violacao} de{" "}
                    {escolhido.meses} meses com alguma hora acima do limite.
                  </>,
                  <>
                    In the file from {escolhido.inicio ? mesAno(escolhido.inicio) : "no start"} to {escolhido.fim ? mesAno(escolhido.fim) : "no end"}: {escolhido.meses_com_violacao} of{" "}
                    {escolhido.meses} months with some hour above the limit.
                  </>,
                )}
                {escolhido.conferencias.meses_denominador_diferente_do_calendario.length
                  ? tx(
                      ` Em ${plural(escolhido.conferencias.meses_denominador_diferente_do_calendario.length, "mês", "meses")} (${listaTexto(escolhido.conferencias.meses_denominador_diferente_do_calendario.map((x) => mesAno(x)), "pt")}) o período de observação implícito no ATLS publicado difere das horas do calendário (registrado, sem causa atribuída).`,
                      ` In ${plural(escolhido.conferencias.meses_denominador_diferente_do_calendario.length, "month", "months")} (${listaTexto(escolhido.conferencias.meses_denominador_diferente_do_calendario.map((x) => mesAno(x)), "en")}) the observation period implied by the published ATLS differs from the calendar hours (recorded, with no cause attributed).`,
                    )
                  : ""}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <Comparador
          rotulo={tx(
            `Fluxos no histórico (até ${LIMITE_COMPARACAO}); sem escolha, o fluxo selecionado acima`,
            `Flows in the history (up to ${LIMITE_COMPARACAO}); with no choice, the flow selected above`,
          )}
          entidades={r.atls.fluxos.map((f) => ({
            id: f.fluxo,
            rotulo: nomeFluxo(f, idioma),
            detalhe: f.definicao ? f.fluxo : f.ativo ? tx("publicado no último mês", "published in the last month") : tx("encerrado", "discontinued"),
            sinonimos: [f.fluxo],
          }))}
          selecionadas={comparados}
          onMudar={(ids) => definir({ fls: ids })}
          dicaBusca={tx("Buscar por nome ou sigla do ONS, por exemplo RSUL", "Search by name or ONS code, for example RSUL")}
          vazio={
            escolhido
              ? tx(
                  `Mostrando ${nomeFluxo(escolhido, "pt")}. Escolha até quatro fluxos para comparar na mesma escala.`,
                  `Showing ${nomeFluxo(escolhido, "en")}. Choose up to four flows to compare on the same scale.`,
                )
              : tx("Escolha até quatro fluxos.", "Choose up to four flows.")
          }
        >
          {() => null}
        </Comparador>
        {serie.length ? (
          <GraficoLinhas
            titulo={tx(`Horas acima do limite por mês: ${nomesHistorico}`, `Hours above the limit by month: ${nomesHistorico}`)}
            dados={serie}
            chaveX="m"
            formatoX="mes"
            series={noHistorico.map((f, i) => ({ id: f, rotulo: nomeDe(f), sigla: f, cor: COR_COMPARACAO[i % COR_COMPARACAO.length] }))}
            unidade="h"
            casas={1}
            zeroNoEixo
            zoom
            intervalo={intervalo}
            onIntervalo={(i) => definir({ de: i?.inicio ?? "", ate: i?.fim ?? "" })}
          />
        ) : (
          <p className="border-l-2 border-mineral pl-3 text-sm text-carvao-muted">
            {tx(
              <>
                {nomesHistorico}: sem mês publicado desde o início da série mensal desta página; o histórico completo
                {inicioArquivo ? `, desde ${mesAno(inicioArquivo)},` : ""} está no arquivo do ATLS para download.
              </>,
              <>
                {nomesHistorico}: no month published since the start of this page&apos;s monthly series; the full history
                {inicioArquivo ? `, since ${mesAno(inicioArquivo)},` : ""} is in the ATLS file for download.
              </>,
            )}
          </p>
        )}
        <TabelaInterativa
          titulo={tx(`Tabela equivalente: horas acima do limite por mês (${nomesHistorico})`, `Equivalent table: hours above the limit by month (${nomesHistorico})`)}
          colunas={[{ id: "m", rotulo: tx("Mês", "Month"), tipo: "data" as const }, ...noHistorico.map((f) => ({ id: f, rotulo: nomeDe(f), tipo: "numero" as const, unidade: "h", casas: 1 }))]}
          linhas={paraTabela(serie)}
          chaveLinha="id"
          colunaRotulo="m"
          fonte={fonteAtls}
          versao={versao}
          nomeArquivo={`rede-atls-mensal-${noHistorico.join("-")}`}
          chaveUrl="atm"
          ordemInicial={{ coluna: "m", direcao: "desc" }}
          semLinhas={tx("Nenhum mês publicado na série da gold para os fluxos escolhidos.", "No month published in the gold series for the chosen flows.")}
          nota={tx(
            "Mês sem publicação do fluxo fica vazio (ausência), distinto de zero hora acima do limite.",
            "A month without publication of the flow stays empty (missing), distinct from zero hours above the limit.",
          )}
        />
      </div>

      <dl data-recorte-painel="" className="grid gap-x-6 gap-y-1 border-t border-linha pt-3 text-xs text-carvao-muted sm:grid-cols-3">
        <div className="min-w-0">
          <dt className="rotulo text-mineral">{tx("Período", "Period")}</dt>
          <dd className="mt-0.5">
            {tx(
              <>
                ATLS: {ativos[0]?.ultimos_12_meses ? `${mesAno(ativos[0].ultimos_12_meses.inicio)} a ${mesAno(ativos[0].ultimos_12_meses.fim)}` : "sem janela"} (mensal, último mês{" "}
                {ultimo ? mesAno(ultimo) : "sem dado"}); interrupções: {dataBR(r.interrupcoes.ultimos_12_meses.inicio)} a {dataBR(r.interrupcoes.ultimos_12_meses.fim)}
              </>,
              <>
                ATLS: {ativos[0]?.ultimos_12_meses ? `${mesAno(ativos[0].ultimos_12_meses.inicio)} to ${mesAno(ativos[0].ultimos_12_meses.fim)}` : "no window"} (monthly, last month{" "}
                {ultimo ? mesAno(ultimo) : "no data"}); interruptions: {dataBR(r.interrupcoes.ultimos_12_meses.inicio)} to {dataBR(r.interrupcoes.ultimos_12_meses.fim)}
              </>,
            )}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="rotulo text-mineral">{tx("Universo", "Scope")}</dt>
          <dd className="mt-0.5">
            {tx(
              <>
                Fluxos sistêmicos que o ONS acompanha no ATLS ({ativos.length} publicados no último mês, {r.atls.fluxos.length} no histórico); perturbações com corte de carga
                registradas pelo ONS
              </>,
              <>
                System flows that ONS tracks in the ATLS ({ativos.length} published in the last month, {r.atls.fluxos.length} in the history); disturbances with load cuts recorded
                by ONS
              </>,
            )}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="rotulo text-mineral">{tx("Unidade", "Unit")}</dt>
          <dd className="mt-0.5">{tx("Horas acima do limite (h); energia não suprida em MWh", "Hours above the limit (h); energy not supplied in MWh")}</dd>
        </div>
      </dl>

      {notas}

      {aposPrincipal}

      <SecaoDoPainel id="cortes-de-carga" titulo={tx("Quanta energia deixou de ser entregue em cortes de carga, por ano?", "How much energy went undelivered in load cuts, by year?")}>
        <RedeEscolha legenda={tx("Região", "Region")} opcoes={opcoesRegiao(idioma)} valor={smi} onEscolher={(x) => definir({ smi: x })} />
        <GraficoBarras
          // o último ano, parcial, tem a mesma cor das barras dos anos completos e o eixo pode omitir o rótulo dele: a figura diz isso no título
          titulo={tx(
            `Energia não suprida em cortes de carga por ano, ${nomeRegiao}${parciais.length ? ` (${listaParciais} ${parciais.length === 1 ? "é parcial" : "são parciais"}, ${parciais.length === 1 ? "a última barra" : "as últimas barras"})` : ""}`,
            `Energy not supplied in load cuts by year, ${nomeRegiao}${parciais.length ? ` (${listaParciais} ${parciais.length === 1 ? "is partial" : "are partial"}, ${parciais.length === 1 ? "the last bar" : "the last bars"})` : ""}`,
          )}
          dados={paraTabela(anual)}
          chaveCategoria="id"
          chaveRotulo="ano" // i18n: dado
          series={[{ id: "ens_mwh", rotulo: tx("Energia não suprida", "Energy not supplied"), cor: COR_SM[smi] }]}
          unidade="MWh"
          casas={1}
        />
        <p className="text-sm text-carvao-muted">
          {parciais.length
            ? tx(
                `${listaParciais} ${parciais.length === 1 ? "é parcial e não se compara" : "são parciais e não se comparam"} com anos completos. `,
                `${listaParciais} ${parciais.length === 1 ? "is partial and is not comparable" : "are partial and are not comparable"} with complete years. `,
              )
            : ""}
          {tx(
            "Um corte de carga registrado não prova limite de intercâmbio, e este painel não atribui causa aos registros.",
            "A recorded load cut does not prove an interchange limit, and this panel attributes no cause to the records.",
          )}
        </p>
        <TabelaInterativa
          titulo={tx(`Tabela equivalente: cortes de carga por ano, ${nomeRegiao}`, `Equivalent table: load cuts by year, ${nomeRegiao}`)}
          colunas={colunasInterrupcoesAno(idioma)}
          linhas={paraTabela(anual)}
          chaveLinha="id"
          colunaRotulo="ano" // i18n: dado
          fonte={fonteInterrupcoes}
          versao={versao}
          nomeArquivo={`rede-interrupcoes-${smi}`}
          chaveUrl="int"
          ordemInicial={{ coluna: "ano", direcao: "desc" }} // i18n: dado
        />
      </SecaoDoPainel>

      <SecaoDoPainel id="perturbacoes" nivel="analisar" titulo={tx("Perturbações: as maiores e as mais recentes", "Disturbances: the largest and the most recent")}>
        <TabelaInterativa
          titulo={tx(
            `As ${r.interrupcoes.maiores_perturbacoes.length} perturbações com mais energia não suprida desde ${dataBR(r.interrupcoes.inicio)}`,
            `The ${r.interrupcoes.maiores_perturbacoes.length} disturbances with the most energy not supplied since ${dataBR(r.interrupcoes.inicio)}`,
          )}
          colunas={colunasPerturbacoes(idioma)}
          linhas={paraTabela(linhasPerturbacoes(r.interrupcoes.maiores_perturbacoes, idioma))}
          chaveLinha="id"
          colunaRotulo="cod_perturbacao"
          fonte={fonteInterrupcoes}
          versao={versao}
          nomeArquivo="rede-maiores-perturbacoes"
          chaveUrl="mp"
          ordemInicial={{ coluna: "ens_mwh", direcao: "desc" }}
        />
        <TabelaInterativa
          titulo={tx(
            `As ${r.interrupcoes.perturbacoes_recentes.length} perturbações mais recentes, até ${dataBR(r.interrupcoes.fim)}`,
            `The ${r.interrupcoes.perturbacoes_recentes.length} most recent disturbances, through ${dataBR(r.interrupcoes.fim)}`,
          )}
          colunas={colunasPerturbacoes(idioma)}
          linhas={paraTabela(linhasPerturbacoes(r.interrupcoes.perturbacoes_recentes, idioma))}
          chaveLinha="id"
          colunaRotulo="cod_perturbacao"
          fonte={fonteInterrupcoes}
          versao={versao}
          nomeArquivo="rede-perturbacoes-recentes"
          chaveUrl="pr"
          ordemInicial={{ coluna: "inicio", direcao: "desc" }}
          nota={tx(
            `${num(r.interrupcoes.registros_abaixo_de_100mw, 0)} dos ${num(r.interrupcoes.registros, 0)} registros têm carga interrompida abaixo de 100 MW${criterioCorte ? `, embora a descrição do conjunto diga “${criterioCorte}”` : ""}; os registros são publicados como vieram.`,
            `${num(r.interrupcoes.registros_abaixo_de_100mw, 0)} of the ${num(r.interrupcoes.registros, 0)} records have interrupted load below 100 MW${criterioCorte ? `, although the dataset description says, in Portuguese, “${criterioCorte}”` : ""}; the records are published as they came.`,
          )}
        />
      </SecaoDoPainel>

      <SecaoDoPainel
        id="atls-todos-os-fluxos"
        nivel="auditar"
        titulo={tx("Todos os fluxos do arquivo do ATLS, inclusive os encerrados", "All flows in the ATLS file, including the discontinued ones")}
      >
        <TabelaInterativa
          titulo={tx("Fluxos do ATLS no arquivo do ONS", "ATLS flows in the ONS file")}
          colunas={colunasAtls(idioma)}
          linhas={paraTabela(linhasTodos)}
          chaveLinha="id"
          colunaRotulo="fluxo"
          fonte={fonteAtls}
          versao={versao}
          nomeArquivo="rede-atls-fluxos"
          chaveUrl="at.h"
          selecionado={escolhido?.fluxo ?? null}
          onSelecionar={selecionar}
          nota={tx(
            `Unidade publicada: ${r.atls.unidade_publicada}. Fluxo encerrado tem a janela de 12 meses terminada no seu último mês publicado.`,
            `Published unit: ${rotuloDaGold(UNIDADE_ATLS_EN, r.atls.unidade_publicada, "en")}. A discontinued flow has its 12-month window ending in its last published month.`,
          )}
        />
      </SecaoDoPainel>
    </div>
  );
}
