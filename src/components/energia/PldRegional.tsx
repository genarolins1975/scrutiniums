"use client";

import { useMemo, type ReactNode } from "react";
import { Comparador } from "@/components/energia/Comparador";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { MapaCalor } from "@/components/energia/MapaCalor";
import { MapaSubmercados } from "@/components/energia/MapaSubmercados";
import { Numero } from "@/components/energia/Numero";
import { PequenosMultiplos } from "@/components/energia/PequenosMultiplos";
import { PldEscolha, PldLista } from "@/components/energia/PldControles";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import type { Evidencia } from "@/lib/energia/evidencia";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { dataBR as dataBRBase, plural as pluralBase } from "@/lib/energia/formato";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import {
  colunasAmplitude,
  colunasFluxos,
  colunasJanelaHoraria,
  colunasMatriz,
  colunasSeparacao,
  COR_SM,
  curtoSm,
  ESCALA_DIFERENCA,
  ESCALA_FRACAO,
  nomeSm,
  PARES,
  SUBMERCADOS,
  curtoPar,
  emPct,
  estadoHora,
  extremosMatriz,
  linhasAmplitude,
  linhasFluxos,
  linhasJanelaHoraria,
  linhasMatrizDoPeriodo,
  linhasSeparacao,
  matrizRegionalDoPeriodo,
  nomePar,
  respostaHora,
  respostaP012,
  rotaPainel,
  rotuloPeriodoRegional,
  serieSeparacaoHoraria,
  textoHora,
  textoMediaDaAmplitude,
  textoQuatroNoPiso,
  vereditoP012,
  type MedidaMatriz,
  type QuatroNoPiso,
} from "@/lib/energia/pld";
import Link from "@/components/i18n/LinkIdioma";
import { LIMITE_COMPARACAO } from "@/lib/energia/tabela";
import type { BlocoRegional, Par, PldHorarioRecenteArquivo } from "@/lib/energia/tipos-pld";

/**
 * P012, diferenças regionais: período (?per=), par em destaque (?par=), pares nos
 * pequenos múltiplos (?pares=, até quatro), medida da matriz (?mat=) e hora do
 * esquema (?h=) ficam na URL; busca, ordem e filtros das tabelas também (prefixos
 * sep, mat.t, amp, flx e hora.t). A hora é uma só para o esquema, a tabela horária e
 * o gráfico das 168 horas: escolher uma linha da tabela muda o esquema e a marca no
 * gráfico, e o voltar do navegador desfaz. Preço e fluxo são sempre da MESMA hora; a
 * leitura é descritiva (sem os limites de intercâmbio, nenhuma hora é chamada de
 * congestionada).
 *
 * Ordem da página: resposta e escolha de período e par, figura principal
 * (horas separadas por par e a matriz de diferenças, as duas no período escolhido), faixa de medidas (depois
 * da figura, para que ela apareça na primeira tela), recorte, tabelas, notas do painel e o perfil
 * horário da separação (só dos últimos 12 meses, e diz isso), visível em Entender. O preço e o fluxo na mesma hora e o sentido do
 * fluxo nas horas separadas ficam em Analisar.
 */
const MEDIDAS_MATRIZ: readonly MedidaMatriz[] = ["dif_media", "frac_separadas"];

export function PldRegional({
  r,
  rec,
  paresPadrao,
  horaInicial,
  fichas,
  ultimaHoraFluxo,
  fonte,
  versao,
  horasAcimaLimiarPaginaPld,
  quatroNoPiso,
  contexto,
  notas,
}: {
  r: BlocoRegional;
  rec: PldHorarioRecenteArquivo | null;
  paresPadrao: Par[];
  horaInicial: string;
  fichas: Record<string, Evidencia>;
  ultimaHoraFluxo: string | null;
  fonte: string;
  versao: string;
  /** Horas dos últimos 30 dias com diferença acima do limiar na página PLD (pld.json), para conferir com a linha "Últimos 30 dias" daqui. */
  horasAcimaLimiarPaginaPld?: number | null;
  /** Horas com os quatro submercados juntos no piso, por ano (gold de limites): em ano de piso, a separação cai por regra. */
  quatroNoPiso?: Record<string, QuatroNoPiso>;
  /** Base normativa da separação (aviso do servidor), depois da figura e das medidas, para a figura abrir a página. */
  contexto?: ReactNode;
  /** Notas do painel (NotasDoPainel), logo depois da figura principal e das tabelas. */
  notas?: ReactNode;
}) {
  const periodos = r.periodos.map((p) => p.id);
  const esquema = useMemo(
    () => ({
      per: campo(tiposUrl.opcao(periodos), periodos.includes("12m") ? "12m" : (periodos[periodos.length - 1] ?? "")),
      par: campo(tiposUrl.opcao(PARES), "SE_S" as Par),
      pares: campo(tiposUrl.lista(tiposUrl.opcao(PARES), { max: LIMITE_COMPARACAO }), paresPadrao),
      mat: campo(tiposUrl.opcao(MEDIDAS_MATRIZ), "frac_separadas" as MedidaMatriz),
      h: campo(tiposUrl.opcao(rec?.t ?? [horaInicial]), horaInicial),
    }),
    // esquema estável no build: depende só dos períodos, das horas e do padrão publicados
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [periodos.join(","), paresPadrao.join(","), horaInicial, rec?.t.length],
  );
  const [v, definir] = useEstadoUrl(esquema);
  const idioma = useIdioma();
  const tx = useTx();
  const dataBR = (iso: string | null | undefined) => dataBRBase(iso, idioma);
  const plural = (n: number, um: string, varios: string) => pluralBase(n, um, varios, idioma);
  const per = v.per as string;
  const par = v.par as Par;
  const pares = v.pares as Par[];
  const mat = v.mat as MedidaMatriz;
  const a = r.amplitude.find((x) => x.periodo === per) ?? null;
  const s = r.separacao.find((x) => x.periodo === per && x.par === par) ?? null;
  const sep = useMemo(() => linhasSeparacao(r, per, idioma), [r, per, idioma]);
  const amp = useMemo(() => linhasAmplitude(r, quatroNoPiso, idioma), [r, quatroNoPiso, idioma]);
  const flx = useMemo(() => linhasFluxos(r, per, idioma), [r, per, idioma]);
  // a matriz e a tabela dela seguem o período escolhido, como as barras por par
  const matriz = useMemo(() => matrizRegionalDoPeriodo(r, mat, per, idioma), [r, mat, per, idioma]);
  const matTabela = useMemo(() => linhasMatrizDoPeriodo(r, per, idioma), [r, per, idioma]);
  const perfil = useMemo(() => serieSeparacaoHoraria(r), [r]);
  const janela = useMemo(() => (rec ? linhasJanelaHoraria(rec) : []), [rec]);
  const hora = rec ? estadoHora(rec, v.h as string) : null;
  const ficha = per === "12m" ? (fichas[`separacao_12m_${par}`] ?? null) : null;
  const endereco = `${rotaPainel("p012")}#p012`;
  const rotuloPer = rotuloPeriodoRegional(r.periodos.find((p) => p.id === per)?.rotulo ?? per, idioma);
  const barras = sep.map((l) => ({ id: l.id as string, rotulo: curtoPar(l.id as Par, idioma), frac: l.frac }));
  const a30 = r.amplitude.find((x) => x.periodo === "30d") ?? null;
  const notaLimiar =
    a30 && typeof horasAcimaLimiarPaginaPld === "number"
      ? horasAcimaLimiarPaginaPld === a30.horas_acima_1
        ? tx(
            `Mesmo limiar da página PLD, que conta ${plural(horasAcimaLimiarPaginaPld, "hora", "horas")} nos últimos 30 dias; escolhendo Últimos 30 dias aqui, a contagem é a mesma.`,
            `Same threshold as the PLD page, which counts ${plural(horasAcimaLimiarPaginaPld, "hour", "hours")} in the last 30 days; choosing Last 30 days here, the count is the same.`,
          )
        : tx(
            `A página PLD conta ${plural(horasAcimaLimiarPaginaPld, "hora", "horas")} nos últimos 30 dias com o mesmo limiar; aqui, Últimos 30 dias dá ${plural(a30.horas_acima_1, "hora", "horas")}.`,
            `The PLD page counts ${plural(horasAcimaLimiarPaginaPld, "hour", "hours")} in the last 30 days with the same threshold; here, Last 30 days gives ${plural(a30.horas_acima_1, "hour", "hours")}.`,
          )
      : tx("Limiar de R$ 1,00/MWh, o mesmo da página PLD.", "Threshold of R$ 1.00/MWh, the same as on the PLD page.");
  const extremos = extremosMatriz(matriz, mat, idioma);
  const mediaDaAmplitude = a ? textoMediaDaAmplitude(a, idioma) : null;
  const avisoQuatroNoPiso = textoQuatroNoPiso(quatroNoPiso?.[per], rotuloPer, idioma);

  return (
    <div className="space-y-6">
      <div className="grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <RespostaCurta id="p012" vivo veredito={vereditoP012(r, per, idioma)}>
          {respostaP012(r, per, idioma)}
        </RespostaCurta>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <PldLista
            rotulo={tx("Período", "Period")}
            opcoes={r.periodos.map((p) => ({ id: p.id, rotulo: rotuloPeriodoRegional(p.rotulo, idioma) }))}
            valor={per}
            onEscolher={(p) => definir({ per: p })}
          />
          <PldLista rotulo={tx("Par em destaque", "Highlighted pair")} opcoes={PARES.map((p) => ({ id: p, rotulo: nomePar(p, idioma) }))} valor={par} onEscolher={(p) => definir({ par: p })} />
        </div>
      </div>

      {avisoQuatroNoPiso && (
        <p className="max-w-prose2 border-l-2 border-mineral pl-3 text-sm leading-relaxed text-carvao-muted" data-texto="quatro-no-piso">
          {avisoQuatroNoPiso}{" "}
          <Link href={`${rotaPainel("p010")}#empates-piso`} className="text-energia-dark underline underline-offset-4">
            {tx("Ver os empates no piso", "See the ties at the floor")}
          </Link>
          .
        </p>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-3">
          <GraficoBarras
            titulo={tx(`Horas separadas por par de submercados, ${rotuloPer} (%)`, `Divergent hours by pair of submarkets, ${rotuloPer} (%)`)}
            dados={barras}
            chaveCategoria="id"
            chaveRotulo="rotulo"
            series={[{ id: "frac", rotulo: tx("horas separadas", "divergent hours"), cor: "var(--cor-energia)" }]} // i18n: dado
            unidade="%"
            casas={1}
            orientacao="horizontal"
            selecionado={par}
            onSelecionar={(id) => id && definir({ par: id as Par })}
          />
        </div>
        <div className="min-w-0 space-y-3">
          <PldEscolha
            legenda={tx(`Matriz do período: ${rotuloPer}`, `Matrix for the period: ${rotuloPer}`)}
            opcoes={[
              { id: "frac_separadas" as MedidaMatriz, rotulo: tx("Horas separadas (%)", "Divergent hours (%)") },
              { id: "dif_media" as MedidaMatriz, rotulo: tx("Diferença média (R$/MWh)", "Average difference (R$/MWh)") },
            ]}
            valor={mat}
            onEscolher={(m) => definir({ mat: m })}
          />
          <MapaCalor
            titulo={
              mat === "dif_media"
                ? tx(`Média de PLD da linha menos PLD da coluna, mesma hora, ${rotuloPer}`, `Average of the row PLD minus the column PLD, same hour, ${rotuloPer}`)
                : tx(`Horas em que o par se separou, ${rotuloPer}`, `Hours in which the pair diverged, ${rotuloPer}`)
            }
            linhas={matriz.eixo}
            colunas={matriz.eixo}
            nomeLinhas={tx("Linha", "Row")}
            nomeColunas={tx("Coluna", "Column")}
            valores={matriz.valores}
            escala={mat === "dif_media" ? ESCALA_DIFERENCA : ESCALA_FRACAO}
            unidade={mat === "dif_media" ? "R$/MWh" : "%"}
            casas={mat === "dif_media" ? 2 : 1}
            nota={tx(
              `Diagonal com borda tracejada: um submercado com ele mesmo não se aplica. Na diferença, positivo é a linha mais cara que a coluna.${extremos ? ` ${extremos}` : ""}`,
              `Diagonal with a dashed border: a submarket against itself does not apply. In the difference, positive means the row is more expensive than the column.${extremos ? ` ${extremos}` : ""}`,
            )}
          />
        </div>
      </div>

      <FaixaMetricas colunas={4} rotulo={tx(`Medidas de separação entre submercados, ${rotuloPer}`, `Measures of divergence between submarkets, ${rotuloPer}`)}>
        <Numero
          variante="faixa"
          rotulo={tx("Horas com os preços separados", "Hours with divergent prices")}
          natureza="CALCULADO"
          valor={emPct(a?.frac_com_separacao)}
          formato="pct"
          casas={1}
          unidade={tx("das horas", "of hours")}
          periodo={rotuloPer}
          motivoAusencia={tx("Sem horas com os quatro submercados no período.", "No hours with all four submarkets in the period.")}
          nota={
            a
              ? tx(
                  `${plural(a.horas_com_separacao, "hora", "horas")} de ${plural(a.horas, "hora", "horas")}.`,
                  `${plural(a.horas_com_separacao, "hour", "hours")} of ${plural(a.horas, "hour", "hours")}.`,
                )
              : undefined
          }
        />
        <Numero
          variante="faixa"
          rotulo={tx("Horas com diferença acima de R$ 1,00/MWh", "Hours with a difference above R$ 1.00/MWh")}
          natureza="CALCULADO"
          valor={a?.horas_acima_1 ?? null}
          formato="num"
          casas={0}
          unidade={tx("horas", "hours")}
          periodo={rotuloPer}
          motivoAusencia={tx("Sem horas no período.", "No hours in the period.")}
          nota={notaLimiar}
        />
        <Numero
          variante="faixa"
          rotulo={tx("Diferença média entre o maior e o menor PLD", "Average difference between the highest and the lowest PLD")}
          natureza="CALCULADO"
          valor={a?.media ?? null}
          formato="reais"
          casas={2}
          unidade="R$/MWh"
          periodo={rotuloPer}
          motivoAusencia={tx("Sem horas no período.", "No hours in the period.")}
          nota={mediaDaAmplitude ?? undefined}
        />
        <Numero
          variante="faixa"
          rotulo={tx(`Horas separadas: ${nomePar(par, "pt")}`, `Divergent hours: ${nomePar(par, idioma)}`)}
          natureza="CALCULADO"
          valor={emPct(s?.frac_separadas)}
          evidencia={ficha}
          formato="pct"
          casas={2}
          unidade={tx("das horas", "of hours")}
          periodo={rotuloPer}
          motivoAusencia={tx("Sem horas com os dois preços no período.", "No hours with both prices in the period.")}
          endereco={endereco}
          nota={
            ficha
              ? undefined
              : tx(
                  "A ficha Comprove é publicada para os últimos 12 meses; os demais períodos estão na tabela e no CSV diário.",
                  "The proof sheet is published for the last 12 months; the other periods are in the table and in the daily CSV.",
                )
          }
        />
      </FaixaMetricas>

      {contexto}

      <dl data-recorte-painel="" className="grid gap-x-6 gap-y-1 border-t border-linha pt-3 text-xs text-carvao-muted sm:grid-cols-3">
        <div>
          <dt className="rotulo text-mineral">{tx("Período", "Period")}</dt>
          <dd className="mt-0.5">
            {rotuloPer}
            {tx(
              `${a ? `, ${dataBR(a.inicio)} a ${dataBR(a.fim)}` : ""}; a matriz segue o período; o perfil horário é dos últimos 12 meses, qualquer que seja o período`,
              `${a ? `, ${dataBR(a.inicio)} to ${dataBR(a.fim)}` : ""}; the matrix follows the period; the hourly profile covers the last 12 months, whatever the period`,
            )}
          </dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">{tx("Universo", "Universe")}</dt>
          <dd className="mt-0.5">
            {tx(
              "Horas com o PLD dos quatro submercados publicado, na mesma hora e na mesma publicação da CCEE",
              "Hours with the PLD of all four submarkets published, in the same hour and in the same CCEE publication",
            )}
          </dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">{tx("Unidade", "Unit")}</dt>
          <dd className="mt-0.5">
            {tx(
              "horas, % das horas e R$/MWh; separação = diferença de mais de R$ 0,01/MWh na mesma hora",
              "hours, % of hours and R$/MWh; divergence = difference of more than R$ 0.01/MWh in the same hour",
            )}
            <span data-nivel="analisar">{tx("; fluxo em MWmed (megawatt médio)", "; flow in MWavg (average megawatts)")}</span>
          </dd>
        </div>
      </dl>

      <TabelaInterativa
        titulo={tx(`Tabela equivalente: separação por par, ${rotuloPer}`, `Equivalent table: divergence by pair, ${rotuloPer}`)}
        colunas={colunasSeparacao(idioma)}
        linhas={sep}
        chaveLinha="id"
        colunaRotulo="par" // i18n: dado
        fonte={fonte}
        versao={versao}
        nomeArquivo={`pld-separacao-${per}`}
        chaveUrl="sep"
        selecionado={par}
        onSelecionar={(id) => id && definir({ par: id as Par })}
        nota={tx(
          "Diferenças de exatamente um centavo ficam contadas à parte e não entram na separação.",
          "Differences of exactly one cent are counted separately and are not included in the divergence.",
        )}
      />
      <TabelaInterativa
        titulo={tx(`Tabela equivalente da matriz: pares ordenados, ${rotuloPer}`, `Equivalent table for the matrix: ordered pairs, ${rotuloPer}`)}
        colunas={colunasMatriz(idioma)}
        linhas={matTabela}
        chaveLinha="id"
        colunaRotulo="a"
        fonte={fonte}
        versao={versao}
        nomeArquivo={`pld-matriz-${per}`}
        chaveUrl="mat.t"
      />

      {notas}

      <SecaoDoPainel
        id="perfil-horario"
        titulo={tx("Em que horas do dia cada par se separa?", "At what hours of the day does each pair diverge?")}
        lead={tx(
          "Fração das horas separadas em cada hora do dia, nos últimos 12 meses (qualquer que seja o Período escolhido acima), na mesma escala.",
          "Share of divergent hours in each hour of the day, over the last 12 months (whatever Period is chosen above), on the same scale.",
        )}
      >
        <Comparador
          rotulo={tx(`Pares nos gráficos (até ${LIMITE_COMPARACAO})`, `Pairs in the charts (up to ${LIMITE_COMPARACAO})`)}
          entidades={PARES.map((p) => ({ id: p, rotulo: nomePar(p, idioma), sinonimos: [curtoPar(p, idioma), nomePar(p, "pt")] }))}
          selecionadas={pares}
          onMudar={(ids) => definir({ pares: ids as Par[] })}
          dicaBusca={tx("Sul, Norte, SE/CO", "South, North, SE/CO")}
          vazio={tx(
            "Nenhum par escolhido. Escolha até quatro para ver o perfil horário da separação na mesma escala.",
            "No pair chosen. Choose up to four to see the hourly divergence profile on the same scale.",
          )}
        >
          {() => null}
        </Comparador>
        {pares.length > 0 && (
          <PequenosMultiplos
            titulo={tx("Fração das horas separadas por hora do dia, por par", "Share of divergent hours by hour of the day, by pair")}
            dados={perfil}
            chaveX="h"
            formatoX="hora"
            unidade="%"
            casas={1}
            zeroNoEixo
            colunas={pares.length > 2 ? 4 : 2}
            paineis={pares.map((p) => ({ id: p, titulo: nomePar(p, idioma) }))}
            cor="var(--cor-energia)"
          />
        )}
        <p className="text-sm leading-relaxed text-carvao-muted">
          {tx(
            "O preço e o fluxo na mesma hora, hora a hora, e o sentido do fluxo nas fronteiras nas horas separadas estão no nível Analisar.",
            "Price and flow in the same hour, hour by hour, and the direction of flow at the borders in divergent hours are in the Analyze level.",
          )}
        </p>
      </SecaoDoPainel>

      <SecaoDoPainel id="hora-a-hora" titulo={tx("Preço e fluxo na mesma hora, últimas 168 horas", "Price and flow in the same hour, last 168 hours")} nivel="analisar">
        {rec && hora ? (
          <>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-x-8 gap-y-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
              <div className="min-w-0 space-y-3">
                <PldLista
                  rotulo={tx("Hora no esquema", "Hour in the diagram")}
                  opcoes={rec.t.map((t) => ({ id: t, rotulo: textoHora(t, idioma) }))}
                  valor={hora.t}
                  onEscolher={(t) => definir({ h: t })}
                />
                <p className="text-xs leading-relaxed text-carvao-muted" data-texto="hora-aberta">
                  {tx(
                    "A hora que abre selecionada é a de maior diferença entre o maior e o menor preço entre as horas com fluxo publicado nas quatro fronteiras (em empate, a mais recente).",
                    "The hour selected on opening is the one with the largest difference between the highest and the lowest price among the hours with flow published at all four borders (on a tie, the most recent).",
                  )}
                </p>
                <p className="max-w-prose2 text-sm leading-relaxed text-carvao" data-resposta="p012-hora" aria-live="polite">
                  {respostaHora(hora, idioma)}
                </p>
                {ultimaHoraFluxo && hora.t > ultimaHoraFluxo && (
                  <p className="text-xs text-carvao-muted">
                    {tx(
                      `O fluxo do ONS integrado vai até ${textoHora(ultimaHoraFluxo, idioma)}; nesta hora o fluxo é ausência, não zero.`,
                      `The integrated ONS flow runs through ${textoHora(ultimaHoraFluxo, idioma)}; in this hour the flow is absent, not zero.`,
                    )}
                  </p>
                )}
              </div>
              <div className="min-w-0">
                <MapaSubmercados
                  fluxos={hora.fluxos}
                  precos={hora.precos}
                  diaFluxo={textoHora(hora.t, idioma)}
                  diaPreco={tx(`${textoHora(hora.t, idioma)} (valor da hora)`, `${textoHora(hora.t, idioma)} (hourly value)`)}
                  idioma={idioma}
                />
              </div>
            </div>
            <GraficoLinhas
              titulo={tx("PLD dos quatro submercados, hora a hora", "PLD of the four submarkets, hour by hour")}
              dados={janela}
              chaveX="t"
              formatoX="hora"
              series={SUBMERCADOS.map((sm) => ({ id: sm, rotulo: nomeSm(sm, idioma), sigla: curtoSm(sm, idioma), cor: COR_SM[sm], tracejada: sm === "S" || sm === "N" }))}
              unidade="R$/MWh"
              casas={2}
              marcos={[{ x: hora.t, rotulo: tx(`hora no esquema: ${textoHora(hora.t, idioma)}`, `hour in the diagram: ${textoHora(hora.t, idioma)}`) }]}
              legendaInterativa
            />
            <TabelaInterativa
              titulo={tx("Tabela equivalente: PLD, diferença e fluxo na mesma hora", "Equivalent table: PLD, difference and flow in the same hour")}
              colunas={colunasJanelaHoraria(idioma)}
              linhas={janela}
              chaveLinha="id"
              colunaRotulo="t"
              fonte={tx("CCEE, PLD horário por submercado; ONS, Intercâmbios entre Subsistemas", "CCEE, hourly PLD by submarket; ONS, Interchanges between Subsystems")}
              versao={versao}
              nomeArquivo="pld-hora-a-hora-168h"
              chaveUrl="hora.t"
              ordemInicial={{ coluna: "t", direcao: "desc" }}
              selecionado={hora.t}
              onSelecionar={(id) => id && definir({ h: id })}
              nota={tx(
                "Fluxo positivo da primeira para a segunda ponta da fronteira, como o ONS publica. Escolher uma linha muda o esquema e a marca do gráfico.",
                "Positive flow runs from the first to the second end of the border, as ONS publishes it. Choosing a row changes the diagram and the mark in the chart.",
              )}
            />
          </>
        ) : (
          <p className="text-sm text-carvao-muted">
            {tx(
              "A janela das últimas 168 horas não está nesta publicação; o histórico diário de separação e fluxo está no CSV diário, em Baixar os dados.",
              "The window of the last 168 hours is not in this publication; the daily history of divergence and flow is in the daily CSV, under Download the data.",
            )}
          </p>
        )}
      </SecaoDoPainel>

      <SecaoDoPainel id="fluxo-nas-horas-separadas" titulo={tx(`Sentido do fluxo nas horas separadas, ${rotuloPer}`, `Direction of flow in divergent hours, ${rotuloPer}`)} nivel="analisar">
        <p className="text-sm leading-relaxed text-carvao-muted">
          {tx(
            "Para cada fronteira, as horas em que os dois submercados vizinhos tinham preços diferentes, contadas pelo sentido do fluxo verificado na mesma hora. É uma associação descritiva: sem os limites de intercâmbio, não se diz se a fronteira estava no limite.",
            "For each border, the hours in which the two neighboring submarkets had different prices, counted by the direction of the flow verified in the same hour. This is a descriptive association: without the interchange limits, it is not possible to say whether the border was at its limit.",
          )}
        </p>
        <TabelaInterativa
          titulo={tx(`Fluxo nas fronteiras nas horas separadas, ${rotuloPer}`, `Flow at the borders in divergent hours, ${rotuloPer}`)}
          colunas={colunasFluxos(idioma)}
          linhas={flx}
          chaveLinha="id"
          colunaRotulo="fronteira"
          fonte={tx("CCEE, PLD horário por submercado; ONS, Intercâmbios entre Subsistemas", "CCEE, hourly PLD by submarket; ONS, Interchanges between Subsystems")}
          versao={versao}
          nomeArquivo={`pld-fluxo-separacao-${per}`}
          chaveUrl="flx"
        />
        <TabelaInterativa
          titulo={tx("Amplitude entre submercados por período", "Spread between submarkets by period")}
          colunas={colunasAmplitude(idioma)}
          linhas={amp}
          chaveLinha="id"
          colunaRotulo="periodo"
          fonte={fonte}
          versao={versao}
          nomeArquivo="pld-amplitude-periodos"
          chaveUrl="amp"
          selecionado={per}
          onSelecionar={(id) => id && definir({ per: id })}
          nota={tx(
            "Ano marcado como parcial ainda está em curso e não se compara a anos completos sem essa ressalva.",
            "A year marked as partial is still in progress and is not comparable to complete years without this caveat.",
          )}
        />
      </SecaoDoPainel>
    </div>
  );
}
