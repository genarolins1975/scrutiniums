"use client";

import { useMemo, type ReactNode } from "react";
import { AguaEscolha, AguaLista } from "@/components/energia/AguaControles";
import { AguaFaixaDaData } from "@/components/energia/AguaFaixaDaData";
import { TextoUnidadeMwmes } from "@/components/energia/AguaLegenda";
import { AguaRestaurar } from "@/components/energia/AguaRestaurar";
import { AguaTabela } from "@/components/energia/AguaTabela";
import { Comparador } from "@/components/energia/Comparador";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { GraficoPontos } from "@/components/energia/GraficoPontos";
import { Numero } from "@/components/energia/Numero";
import { PequenosMultiplos } from "@/components/energia/PequenosMultiplos";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import {
  COR_REGIAO,
  SUBSISTEMAS,
  TIPOS_RECORTE,
  amplitudeCapacidade,
  anoInicial,
  capacidadeMuitoAlterada,
  casasMwmes,
  colunasArmazenamento,
  corDoRecorte,
  curtoRegiao,
  doRecorte,
  itensPontosArmazenamento,
  linhasArmazenamento,
  linhasMultiplos,
  mwmes,
  nomeRegiao,
  opcoesUnidadeEar,
  periodoBase,
  recorteEscolhido,
  recortePadrao,
  respostaArmazenamento,
  rotuloBandaDaFaixa,
  rotuloTipoRecorte,
  serieSemanal,
  textoAmplitude,
  textoBaseDaFaixa,
  textoEarDerivada,
  textoEarProvisoria,
  textoForaDosPontos,
  textoOutraJanelaNaArmazenamento,
  textoPasso,
  textoPesoSubsistemas,
  textoPeriodoDoRecorte,
  vereditoArmazenamento,
  type EntidadeEar,
  type PontoMensalEar,
  type PontoRegioes,
  type TipoRecorte,
  type UnidadeEar,
} from "@/lib/energia/agua";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { formatos } from "@/lib/energia/formato";
import { LIMITE_COMPARACAO } from "@/lib/energia/tabela";
import type { AguaDecomposicaoEar, AguaRevisaoCaptura } from "@/lib/energia/tipos-agua";
import { porIdioma } from "@/lib/energia/idioma";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import type { Idioma } from "@/lib/idioma";

/**
 * P017, armazenamento: tipo de recorte (?rec=), recorte escolhido (?ent=), unidade da figura (?uni=), recortes
 * comparados nos pequenos múltiplos (?cmp=, até quatro), o intervalo do histórico
 * mensal (?de=, ?ate=) e o da série diária em MWmês (?dde=, ?date=) ficam na URL;
 * voltar e avançar refazem o recorte e o zoom. A resposta, os
 * pontos pareados, a faixa da data, os números do recorte, a tabela equivalente e a exportação usam as mesmas linhas
 * (linhasArmazenamento e itensPontosArmazenamento sobre a mesma lista), e a resposta é
 * refeita pela mesma regra quando o recorte muda. O padrão (subsistemas, SIN, % da EAR máxima, os quatro
 * subsistemas na comparação) não é gravado na URL. A ordem dos pontos fica na URL (pts.ord e pts.dir), e o botão "Restaurar padrão"
 * (AguaRestaurar) tira da URL todas as escolhas de uma vez: recorte, unidade, ordem, comparação, intervalos e tabela.
 *
 * A tabela equivalente (AguaTabela) nunca abre sozinha: escolher um recorte no gráfico não muda a altura da página.
 */
const ESQUEMA = {
  rec: campo(tiposUrl.opcao(TIPOS_RECORTE), "subsistema"),
  ent: campo(tiposUrl.texto({ max: 60 }), ""),
  uni: campo(tiposUrl.opcao(["pct", "mwmes"] as const), "pct"),
  cmp: campo(tiposUrl.lista(tiposUrl.texto({ max: 60 }), { max: LIMITE_COMPARACAO }), [...SUBSISTEMAS] as string[]),
  de: campo(tiposUrl.mes(), ""),
  ate: campo(tiposUrl.mes(), ""),
  dde: campo(tiposUrl.data(), ""),
  date: campo(tiposUrl.data(), ""),
};

const opcoesTipo = (idioma: Idioma) => TIPOS_RECORTE.map((t) => ({ id: t, rotulo: rotuloTipoRecorte(t, idioma) }));

const universo = (t: TipoRecorte, idioma: Idioma): string =>
  ({
    subsistema: porIdioma(idioma, {
      pt: "Subsistemas do SIN publicados pelo ONS; o SIN é a soma das EAR dos quatro sobre a soma das EAR máximas, no mesmo dia",
      en: "SIN subsystems published by ONS; the SIN is the sum of the four EARs over the sum of the maximum EARs, on the same day",
    }),
    ree: porIdioma(idioma, {
      pt: "Reservatórios equivalentes de energia (REE) do ONS, cada um com o próprio perímetro e a própria EAR máxima",
      en: "ONS equivalent energy reservoirs (REE), each with its own perimeter and its own maximum EAR",
    }),
    bacia: porIdioma(idioma, {
      pt: "Bacias hidroenergéticas do ONS; bacias só com usinas a fio d'água não têm armazenamento (não se aplica)",
      en: "ONS hydro-energy basins; basins with only run-of-river plants have no storage (not applicable)",
    }),
  })[t];

/**
 * Números do recorte escolhido: a EAR do dia em % da EAR máxima, a mediana da mesma data, a energia armazenada em MWmês e a variação de
 * 30 dias. Os valores são os campos da própria entidade (os mesmos do gráfico, da faixa da data, da tabela e da resposta): a faixa nunca
 * calcula. O SIN é o recorte dos quatro números do alto da página (com as fichas "Comprove este número", as únicas que a gold publica): quando
 * ele é o escolhido, os mesmos cartões não se repetem aqui, e a seção diz de onde vêm os números e guarda a nota de provisório. Outro recorte
 * traz os quatro números dele, sem ficha. Os últimos dias são ditos provisórios, e as duas janelas de 30 dias do mesmo subsistema (esta
 * página e a de reservatórios) são ditas junto dos números.
 */
export function MedidasArmazenamento({ e, revisoes, decomposicoes }: { e: EntidadeEar; revisoes: AguaRevisaoCaptura[]; decomposicoes: AguaDecomposicaoEar[] }) {
  const idioma = useIdioma();
  const tx = useTx();
  const f = formatos(idioma);
  const uMw = tx("MWmês", "MWmonth");
  const ehSin = e.tipo === "subsistema" && e.id === "SIN";
  const amp = capacidadeMuitoAlterada(e) ? amplitudeCapacidade(e) : null;
  const outraJanela = textoOutraJanelaNaArmazenamento(e, decomposicoes, idioma);
  const semFaixa = e.sem_armazenamento
    ? tx("Sem armazenamento (EAR máxima zero): faixa e percentual não se aplicam.", "No storage (maximum EAR of zero): range and percentage do not apply.")
    : tx(
        `Sem faixa do mesmo dia: ${f.plural(e.anos_na_base, "ano", "anos")} na base, menos que os 5 exigidos.`,
        `No range for the same day: ${f.plural(e.anos_na_base, "year", "years")} in the baseline, fewer than the 5 required.`,
      );
  // o SIN é o recorte do alto da página: repetir os mesmos quatro números logo abaixo da figura só somaria 270 px de cartões iguais
  if (ehSin) {
    return (
      <div data-medidas-recorte="" data-igual-ao-alto="" className="border-t border-linha pt-3">
        <div className="max-w-prose2 space-y-1.5 text-sm leading-relaxed text-carvao-muted">
          <p className="rotulo text-mineral">{tx(`Números do recorte escolhido: ${e.rotulo}`, `Figures for the chosen area: ${e.rotulo}`)}</p>
          <p>
            {tx(
              "São os quatro números do alto da página, que ficam sempre no SIN. Escolha outro recorte para ver os dele aqui.",
              "They are the four figures at the top of the page, which always refer to the SIN. Choose another area to see its figures here.",
            )}
          </p>
          <p>{textoEarProvisoria(revisoes, idioma)}</p>
        </div>
      </div>
    );
  }
  return (
    <div data-medidas-recorte="" className="space-y-2">
      <p className="rotulo text-mineral">{tx(`Números do recorte escolhido: ${e.rotulo}`, `Figures for the chosen area: ${e.rotulo}`)}</p>
      <p className="text-sm text-carvao-muted">{tx("Os quatro números do alto da página continuam sendo os do SIN.", "The four figures at the top of the page are still those of the SIN.")}</p>
      <FaixaMetricas
        colunas={4}
        rotulo={tx(`Indicadores do armazenamento: ${e.rotulo}`, `Storage indicators: ${e.rotulo}`)}
        nota={
          <div className="space-y-1.5 text-sm">
            <p>{textoEarProvisoria(revisoes, idioma)}</p>
            {amp && (
              <p data-texto="capacidade-alterada">
                {tx(
                  <>
                    A EAR máxima variou {textoAmplitude(amp.razao, idioma)} na base (de {mwmes(amp.min, idioma)} a {mwmes(amp.max, idioma)} MWmês). Em %, a faixa compara capacidades de tamanhos diferentes; em MWmês, compara a energia
                    de anos com capacidades diferentes. Nas duas unidades, a posição frente à faixa não é dita.
                  </>,
                  <>
                    The maximum EAR varied {textoAmplitude(amp.razao, idioma)} over the baseline (from {mwmes(amp.min, idioma)} to {mwmes(amp.max, idioma)} MWmonth). In %, the range compares capacities of different sizes; in
                    MWmonth, it compares the energy of years with different capacities. In both units, the position against the range is not stated.
                  </>,
                )}
              </p>
            )}
            {outraJanela && <p data-texto="outra-janela">{outraJanela}</p>}
          </div>
        }
      >
        <Numero
          variante="faixa"
          rotulo={tx("EAR do dia", "EAR on the day")}
          natureza="CALCULADO"
          valor={e.ear_pct}
          formato="pct"
          casas={1}
          unidade={tx("da EAR máxima", "of maximum EAR")}
          periodo={e.dia ? f.dataBR(e.dia) : undefined}
          cor={corDoRecorte(e)}
          motivoAusencia={
            e.sem_armazenamento
              ? tx("Sem armazenamento (EAR máxima zero): o percentual não se aplica.", "No storage (maximum EAR of zero): the percentage does not apply.")
              : tx("Sem EAR publicada no dia de referência.", "No EAR published for the reference day.")
          }
        />
        <Numero
          variante="faixa"
          rotulo={tx("Mediana da mesma data", "Median for the same date")}
          natureza="CALCULADO"
          valor={e.p50}
          formato="pct"
          casas={1}
          unidade={tx("da EAR máxima", "of maximum EAR")}
          periodo={e.periodo_base ? tx(`mesmo dia do ano em ${periodoBase(e.periodo_base, "pt")}`, `same day of the year in ${periodoBase(e.periodo_base, "en")}`) : undefined}
          cor="var(--serie-referencia)"
          motivoAusencia={semFaixa}
        />
        <Numero
          variante="faixa"
          rotulo={tx("Energia armazenada", "Stored energy")}
          natureza="CALCULADO"
          valor={e.ear_mwmes}
          formato="num"
          casas={casasMwmes(e.ear_mwmes)}
          unidade={uMw}
          periodo={e.dia ? f.dataBR(e.dia) : undefined}
          cor={corDoRecorte(e)}
          nota={
            e.ear_max_mwmes !== null && !e.sem_armazenamento
              ? tx(`EAR máxima de ${mwmes(e.ear_max_mwmes, "pt")} MWmês`, `Maximum EAR of ${mwmes(e.ear_max_mwmes, "en")} MWmonth`)
              : undefined
          }
          motivoAusencia={tx("Sem EAR publicada no dia de referência.", "No EAR published for the reference day.")}
        />
        <Numero
          variante="faixa"
          rotulo={tx("Variação em 30 dias", "30-day change")}
          natureza="CALCULADO"
          valor={e.variacao_30d_pp}
          formato="num"
          casas={1}
          unidade={tx("p.p. da EAR máxima", "pp of maximum EAR")}
          periodo={e.dia ? tx(`30 dias até ${f.dataBR(e.dia)}`, `30 days through ${f.dataBR(e.dia)}`) : undefined}
          nota={e.variacao_30d_mwmes !== null ? `${f.sinal(e.variacao_30d_mwmes, casasMwmes(e.variacao_30d_mwmes))} ${uMw}` : undefined}
          motivoAusencia={
            e.sem_armazenamento
              ? tx("Sem armazenamento: a variação em p.p. não se aplica.", "No storage: the change in pp does not apply.")
              : tx("Sem variação de 30 dias nesta publicação.", "No 30-day change in this release.")
          }
        />
      </FaixaMetricas>
    </div>
  );
}

export function AguaArmazenamento({
  entidades,
  diaria,
  mensal,
  textoMensal,
  fonte,
  versao,
  notas,
  destaquesHistoria,
  decomposicoes,
  revisoes,
}: {
  entidades: EntidadeEar[];
  /** EAR diária por subsistema e SIN nos últimos dias publicados na gold (MWmês). */
  diaria: PontoRegioes[];
  /** EAR no último dia de cada mês desde o início da série (MWmês), com a EAR máxima do SIN. */
  mensal: PontoMensalEar[];
  textoMensal: string;
  fonte: string;
  versao: string;
  /** Notas do painel (NotasDoPainel: o que mudou e a ressalva essencial), logo depois da figura principal e da tabela. */
  notas?: ReactNode;
  /** Medida que acompanha a história mensal (mudanças da EAR máxima), com a ficha de prova. */
  destaquesHistoria?: ReactNode;
  /** Variação da EAR por reservatório (página de reservatórios): a outra janela de 30 dias do mesmo subsistema. */
  decomposicoes: AguaDecomposicaoEar[];
  /** Revisões do ONS entre as duas capturas mais recentes (a mesma lista da tabela de revisões, em Auditar). */
  revisoes: AguaRevisaoCaptura[];
}) {
  const idioma = useIdioma();
  const tx = useTx();
  const f = formatos(idioma);
  const uMw = tx("MWmês", "MWmonth");
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const tipo = v.rec as TipoRecorte;
  const unidade = v.uni as UnidadeEar;
  const emMw = unidade === "mwmes";
  const padrao = useMemo(() => recortePadrao(entidades, tipo), [entidades, tipo]);
  const e = recorteEscolhido(entidades, tipo, v.ent || padrao, padrao);
  const doTipo = useMemo(() => entidades.filter((x) => x.tipo === tipo), [entidades, tipo]);
  const linhas = useMemo(() => linhasArmazenamento(doTipo, idioma), [doTipo, idioma]);
  const colunas = useMemo(() => colunasArmazenamento(unidade, idioma), [unidade, idioma]);
  const itens = useMemo(() => itensPontosArmazenamento(doTipo, unidade, idioma), [doTipo, unidade, idioma]);
  const semanal = useMemo(() => serieSemanal(e?.semanal ?? null), [e]);
  const comArmazenamento = useMemo(() => entidades.filter((x) => !x.sem_armazenamento && x.semanal), [entidades]);
  const escolhidas = useMemo(
    () => (v.cmp as string[]).map((id) => comArmazenamento.find((x) => x.id === id)).filter((x): x is EntidadeEar => !!x),
    [v.cmp, comArmazenamento],
  );
  const multiplos = useMemo(() => linhasMultiplos(escolhidas), [escolhidas]);
  const intervalo = v.de && v.ate ? { inicio: v.de, fim: v.ate } : null;
  const intervaloDiario = v.dde && v.date ? { inicio: v.dde, fim: v.date } : null;
  // a cor de um recorte é a mesma em todos os gráficos da página: a do subsistema, ou a da energia
  const cor = e ? corDoRecorte(e) : "var(--cor-energia)"; // i18n: dado
  // períodos e passos dos títulos saem das séries publicadas, nunca de número escrito aqui
  const passoMultiplos = escolhidas.find((x) => x.semanal)?.semanal?.passo_dias ?? null;
  const diasDiaria = f.plural(diaria.length, tx("dia", "day"), tx("dias", "days"));
  const anoMensal = anoInicial(mensal[0]?.m);
  const fora = textoForaDosPontos(doTipo, idioma);
  const peso = textoPesoSubsistemas(entidades, idioma);
  const baseDaFaixa = e ? textoBaseDaFaixa(e, idioma) : "";
  const selecionar = (id: string | null) => id && definir({ ent: id === padrao ? "" : id });
  const rotuloTipo = rotuloTipoRecorte(tipo, idioma);
  const semDado = tx("Recorte sem dado nesta publicação.", "Area with no data in this release.");

  return (
    <div className="space-y-6">
      <div className="grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <RespostaCurta id="p017" vivo veredito={e ? vereditoArmazenamento(e, idioma) : semDado}>
          {e ? respostaArmazenamento(e, idioma) : semDado}
        </RespostaCurta>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <AguaEscolha legenda={tx("Recorte", "Area")} opcoes={opcoesTipo(idioma)} valor={tipo} onEscolher={(x) => definir({ rec: x, ent: "" })} />
          <AguaLista
            rotulo={tipo === "subsistema" ? tx("Subsistema", "Subsystem") : tipo === "ree" ? "REE" : tx("Bacia", "Basin")}
            opcoes={doTipo.map((x) => ({ id: x.id, rotulo: x.sem_armazenamento ? tx(`${x.rotulo} (sem armazenamento)`, `${x.rotulo} (no storage)`) : x.rotulo }))}
            valor={e?.id ?? padrao}
            onEscolher={(x) => selecionar(x)}
          />
          <AguaRestaurar />
        </div>
      </div>

      {/* a tabela equivalente da página é a única porta para estes dados: a do próprio gráfico repetiria as mesmas linhas */}
      <div data-grafico-pontos="armazenamento" className="relative [&_details]:hidden">
        {/* a unidade da figura: no cabeçalho dela, à direita do título em tela larga (onde há espaço), e acima dela nas demais */}
        <div className="mb-3 xl:absolute xl:right-0 xl:top-0 xl:z-[1] xl:mb-0">
          <AguaEscolha legenda={tx("Unidade da figura", "Figure unit")} opcoes={opcoesUnidadeEar(idioma)} valor={unidade} onEscolher={(x) => definir({ uni: x })} emLinha />
        </div>
        <GraficoPontos
          titulo={tx(`EAR de cada recorte (${rotuloTipo}) no dia e a mediana da mesma data`, `EAR of each area (${rotuloTipo}) on the day and the median for the same date`)}
          itens={itens}
          unidade={emMw ? uMw : "%"}
          casas={emMw && tipo === "subsistema" ? 0 : 1}
          zeroNoEixo={emMw}
          rotuloValor={tx("EAR do dia", "EAR on the day")}
          rotuloReferencia={tx("Mediana da data nos anos da base", "Median for the date in the baseline years")}
          corValor="var(--cor-energia)" // i18n: dado
          corReferencia="var(--serie-referencia)"
          selecionado={e?.id ?? null}
          onSelecionar={selecionar}
          ordemInicial={{ por: "valor", direcao: "desc" }} // i18n: dado
          chaveUrl="pts"
        />
      </div>
      {fora && (
        <p className="text-sm text-carvao-muted" data-texto="fora-dos-pontos">
          {fora}
        </p>
      )}

      {e && <AguaFaixaDaData e={e} unidade={unidade} />}

      {e && !e.sem_armazenamento && semanal.length > 0 ? (
        <GraficoLinhas
          titulo={tx(
            `EAR ${doRecorte(e.tipo, e.nome, "pt")} no último ano, ${e.semanal ? textoPasso(e.semanal.passo_dias, "pt") : ""}, com a faixa do 10º ao 90º percentil da mesma data`,
            `EAR ${doRecorte(e.tipo, e.nome, "en")} over the last year, ${e.semanal ? textoPasso(e.semanal.passo_dias, "en") : ""}, with the range from the 10th to the 90th percentile for the same date`,
          )}
          dados={semanal}
          chaveX="d"
          series={[{ id: "v", rotulo: e.rotulo, cor, espessura: 2.5 }]}
          banda={{ inferior: "p10", superior: "p90", rotulo: rotuloBandaDaFaixa(e, idioma) }}
          unidade="%"
          casas={1}
        />
      ) : (
        <p role="status" className="border border-dashed border-linha bg-superficie px-5 py-4 text-sm text-carvao-muted">
          {e?.sem_armazenamento
            ? tx(
                "Este recorte não tem armazenamento (EAR máxima zero): não há série em % nem faixa sazonal; a EAR em MWmês, zero, está na tabela.",
                "This area has no storage (maximum EAR of zero): there is no series in % and no seasonal range; the EAR in MWmonth, zero, is in the table.",
              )
            : tx("Sem série do último ano para este recorte nesta publicação.", "No series for the last year for this area in this release.")}
        </p>
      )}
      {e && !e.sem_armazenamento && semanal.length > 0 && (
        <p className="text-sm text-carvao-muted" data-texto="base-da-faixa">
          {baseDaFaixa}
          {emMw
            ? tx(
                " A série do último ano e a faixa de cada data só existem em % da EAR máxima, a única unidade em que são publicadas; em MWmês, a faixa da data de referência está na figura acima.",
                " The series for the last year and the range for each date exist only in % of maximum EAR, the only unit in which they are published; in MWmonth, the range for the reference date is in the figure above.",
              )
            : ""}
        </p>
      )}

      <dl data-recorte-painel="" className="grid gap-x-6 gap-y-1 border-t border-linha pt-3 text-sm text-carvao-muted sm:grid-cols-3">
        <div>
          <dt className="rotulo text-mineral">{tx("Período", "Period")}</dt>
          <dd className="mt-0.5">{e ? textoPeriodoDoRecorte(e, idioma) : tx("sem dia de referência", "no reference day")}</dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">{tx("Universo", "Scope")}</dt>
          <dd className="mt-0.5">
            {universo(tipo, idioma)}. {textoEarDerivada(idioma)}
          </dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">{tx("Unidade", "Unit")}</dt>
          <dd className="mt-0.5">
            <TextoUnidadeMwmes idioma={idioma} />
            {tx(", e % da EAR máxima do próprio recorte; p.p., pontos percentuais: de 60% para 62% são 2 p.p.", ", and % of the area's own maximum EAR; pp, percentage points: from 60% to 62% is 2 pp.")}
          </dd>
        </div>
      </dl>

      {e && <MedidasArmazenamento e={e} revisoes={revisoes} decomposicoes={decomposicoes} />}

      <AguaTabela
        titulo={tx(`Tabela equivalente: ${rotuloTipo}, EAR do dia, faixa da data e variação`, `Equivalent table: ${rotuloTipo}, EAR on the day, range for the date and change`)}
        colunas={colunas}
        linhas={linhas}
        chaveLinha="id"
        colunaRotulo="rotulo"
        fonte={fonte}
        versao={versao}
        nomeArquivo={`agua-armazenamento-${tipo}`}
        selecionado={e?.id ?? null}
        onSelecionar={selecionar}
        chaveUrl="arm"
        nota={tx(
          "Recortes sem armazenamento aparecem com percentual vazio e posição “não se aplica”; com menos de 5 anos na base, não há faixa. Em Analisar, a tabela traz a faixa da data em % e em MWmês, a variação de 30 dias e a EAR máxima da base.",
          "Areas without storage appear with an empty percentage and the position “not applicable”; with fewer than 5 years in the baseline, there is no range. Under Analyze, the table shows the range for the date in % and in MWmonth, the 30-day change and the maximum EAR in the baseline.",
        )}
      />

      {notas}

      <div id="historia" className="scroll-mt-28 space-y-4 border-t border-linha pt-6">
        <h3 className="ed-h3 font-serif text-carvao">
          {tx(
            `${anoMensal ? `Desde ${anoMensal}: e` : "E"}nergia armazenada e capacidade no fim de cada mês`,
            `${anoMensal ? `Since ${anoMensal}: s` : "S"}tored energy and capacity at the end of each month`,
          )}
        </h3>
        {destaquesHistoria}
        <GraficoLinhas
          titulo={tx(
            `EAR do SIN e EAR máxima do SIN no último dia de cada mês${anoMensal ? `, desde ${anoMensal}` : ""}`,
            `SIN EAR and SIN maximum EAR on the last day of each month${anoMensal ? `, since ${anoMensal}` : ""}`,
          )}
          dados={mensal}
          chaveX="m"
          formatoX="mes"
          series={[
            { id: "SIN", rotulo: tx("EAR do SIN", "SIN EAR"), cor: "var(--cor-energia)", espessura: 2.5 }, // i18n: dado
            { id: "SIN_max", rotulo: tx("EAR máxima do SIN (capacidade)", "SIN maximum EAR (capacity)"), cor: "var(--serie-referencia)", tracejada: true },
            ...SUBSISTEMAS.map((sm) => ({ id: sm, rotulo: nomeRegiao(sm, idioma), sigla: curtoRegiao(sm, idioma), cor: COR_REGIAO[sm] })),
          ]}
          ocultasIniciais={[...SUBSISTEMAS]}
          legendaInterativa
          unidade={uMw}
          casas={0}
          zoom
          intervalo={intervalo}
          onIntervalo={(i) => definir({ de: i?.inicio ?? "", ate: i?.fim ?? "" })}
          zeroNoEixo
        />
        <p className="text-sm text-carvao-muted">
          {textoMensal}
          {tx(
            " A EAR máxima cresceu com a entrada de usinas: o mesmo percentual em anos diferentes não mede a mesma energia.",
            " The maximum EAR grew as plants came in: the same percentage in different years does not measure the same energy.",
          )}
        </p>
      </div>

      <div id="comparar" className="scroll-mt-28 space-y-4 border-t border-linha pt-6">
        <h3 className="ed-h3 font-serif text-carvao">{tx("Até quatro recortes na mesma escala", "Up to four areas on the same scale")}</h3>
        <Comparador
          rotulo={tx(`Recortes comparados (até ${LIMITE_COMPARACAO})`, `Areas compared (up to ${LIMITE_COMPARACAO})`)}
          entidades={comArmazenamento.map((x) => ({ id: x.id, rotulo: x.rotulo, detalhe: rotuloTipoRecorte(x.tipo, idioma), sinonimos: [x.nome] }))}
          selecionadas={escolhidas.map((x) => x.id)}
          onMudar={(ids) => definir({ cmp: ids })}
          dicaBusca={tx("Buscar, por exemplo SIN, Sul, REE Paraná, Bacia do Grande", "Search, for example SIN, South, REE Paraná, Grande basin")}
          vazio={tx(
            "Nenhum recorte escolhido. Escolha até quatro para ver a EAR do último ano com a faixa da data, na mesma escala.",
            "No area chosen. Choose up to four to see the EAR for the last year with the range for the date, on the same scale.",
          )}
        >
          {() => null}
        </Comparador>
        {escolhidas.length > 0 && (
          <PequenosMultiplos
            titulo={tx(
              `EAR no último ano (% da EAR máxima)${passoMultiplos ? `, ${textoPasso(passoMultiplos, "pt")}` : ""}, com o 10º e o 90º percentil da data`,
              `EAR over the last year (% of maximum EAR)${passoMultiplos ? `, ${textoPasso(passoMultiplos, "en")}` : ""}, with the 10th and 90th percentiles for the date`,
            )}
            dados={multiplos}
            chaveX="d"
            unidade="%"
            casas={1}
            colunas={escolhidas.length >= 4 ? 4 : escolhidas.length >= 3 ? 3 : 2}
            nivelTitulo={4}
            paineis={escolhidas.map((x) => ({
              id: x.id,
              titulo: x.rotulo,
              nota: x.capacidade_mudou_na_base ? tx("EAR máxima mudou mais de 5% na base", "Maximum EAR changed by more than 5% in the baseline") : undefined,
              // a cor é a do recorte, a mesma dos outros gráficos da página; os rótulos são iguais nos painéis, e a legenda os junta
              series: [
                { id: x.id, rotulo: "EAR", cor: corDoRecorte(x), espessura: 2 },
                { id: `${x.id}·p10`, rotulo: tx("10º percentil da data", "10th percentile for the date"), cor: "var(--serie-referencia)", tracejada: true, espessura: 1 },
                { id: `${x.id}·p90`, rotulo: tx("90º percentil da data", "90th percentile for the date"), cor: "var(--serie-referencia)", tracejada: true, espessura: 1 },
              ],
            }))}
          />
        )}
        <p className="text-sm text-carvao-muted">
          {tx(
            <>
              Esta escolha é independente do recorte da figura principal: trocar um não troca o outro. O percentual de cada painel é da EAR máxima do próprio recorte: a mesma altura em
              dois painéis é o mesmo grau de enchimento, não a mesma energia. A energia de cada recorte em MWmês está na tabela.
            </>,
            <>
              This choice is independent of the area in the main figure: changing one does not change the other. The percentage in each panel is of the area&apos;s own maximum EAR: the same
              height in two panels is the same degree of filling, not the same energy. The energy of each area in MWmonth is in the table.
            </>,
          )}
        </p>
      </div>

      <div data-nivel="analisar" className="space-y-4 border-t border-linha pt-6">
        <h3 className="ed-h3 font-serif text-carvao">{tx(`Energia armazenada nos últimos ${diasDiaria}, em MWmês`, `Stored energy over the last ${diasDiaria}, in MWmonth`)}</h3>
        <GraficoLinhas
          titulo={tx(`EAR diária por subsistema nos últimos ${diasDiaria}`, `Daily EAR by subsystem over the last ${diasDiaria}`)}
          dados={diaria}
          chaveX="d"
          series={SUBSISTEMAS.map((sm) => ({ id: sm, rotulo: nomeRegiao(sm, idioma), sigla: curtoRegiao(sm, idioma), cor: COR_REGIAO[sm] }))}
          unidade={uMw}
          casas={0}
          zoom
          intervalo={intervaloDiario}
          onIntervalo={(i) => definir({ dde: i?.inicio ?? "", date: i?.fim ?? "" })}
          legendaInterativa
        />
        {peso && <p className="text-sm text-carvao-muted">{peso}</p>}
      </div>
    </div>
  );
}
