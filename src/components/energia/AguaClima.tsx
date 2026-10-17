"use client";

import { useMemo, type ReactNode } from "react";
import { AguaEscolha, AguaLista } from "@/components/energia/AguaControles";
import { AguaLegenda, comNomes } from "@/components/energia/AguaLegenda";
import { AguaMapaBacias } from "@/components/energia/AguaMapaBacias";
import { AguaRestaurar } from "@/components/energia/AguaRestaurar";
import { AguaTabela } from "@/components/energia/AguaTabela";
import { Comparador } from "@/components/energia/Comparador";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { Numero } from "@/components/energia/Numero";
import { PequenosMultiplos } from "@/components/energia/PequenosMultiplos";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { SobreEsteDado } from "@/components/evidencia/SobreEsteDado";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import {
  CORES_ANOMALIA,
  COR_REGIAO,
  NOME_REGIAO,
  REGIOES,
  classificacaoChuva,
  colunasChuva,
  colunasPrevisaoChuva,
  colunasPrevisaoTemperatura,
  colunasTemperatura,
  curtoRegiao,
  dadosChuvaMes,
  doRegiao,
  evidenciaComNome,
  evidenciaTemperaturaComMedias,
  linhasChuva,
  linhasMultiplosChuva,
  linhasPrevisaoChuva,
  linhasPrevisaoTemperatura,
  linhasTemperatura,
  marcaPreliminarSerie,
  mediaDiariaImerg,
  mesExtenso,
  mesPreliminar,
  ehGrupoOns,
  nomeProprio,
  nomesProprios,
  nomeRegiao,
  notaAnomaliaTemperatura,
  notaChuvaBacia,
  notaChuvaMes,
  periodoBase,
  periodosMapa,
  respostaChuva,
  respostaChuvaMes,
  respostaPrevisao,
  respostaTemperatura,
  resumoPreliminarChuva,
  resumoPreliminarTemperatura,
  rotuloPeriodoMapa,
  rotuloRecorte,
  rotuloRodada,
  serieDiariaTemperatura,
  serieMensalChuva,
  serieMensalTemperatura,
  seriePrevisao,
  textoAssociacao,
  textoClasseCentralEViesImerg,
  textoMesesAcimaDaMedia,
  textoPreliminarChuva,
  textoPreliminarTemperatura,
  textoRevisoesFichaClima,
  textoUltimoMesFinalChuva,
  textoUltimoMesFinalTemperatura,
  valoresMapaChuva,
  vereditoAssociacao,
  vereditoChuva,
  vereditoChuvaMes,
  vereditoTemperatura,
} from "@/lib/energia/agua";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import type { Evidencia } from "@/lib/energia/evidencia";
import { formatos } from "@/lib/energia/formato";
import { porIdioma } from "@/lib/energia/idioma";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { modeloPrevisao } from "@/lib/energia/i18n/agua-carga-rede";
import { LIMITE_COMPARACAO } from "@/lib/energia/tabela";
import type { Proveniencia, Regiao } from "@/lib/energia/tipos";
import type { AguaClima as DadosClima, AguaPrecipitacaoBacia, AguaPrevisao, AguaTemperatura } from "@/lib/energia/tipos-agua";

/**
 * P019, chuva, temperatura e clima: bacia escolhida (?bac=), período do mapa (?per=, a
 * janela de 30 dias ou um dos 12 meses completos), recorte da temperatura (?rt=) e
 * bacias comparadas (?cmp=, até quatro) ficam na URL. Mapa, tabela equivalente,
 * resposta, números de destaque e histórico da bacia usam a mesma seleção; o mapa e a
 * tabela usam os mesmos valores (valoresMapaChuva e linhasChuva sobre o mesmo período).
 * Estimativa (satélite e reanálise) e previsão (uma rodada de um modelo) ficam em
 * blocos separados, cada um com o seu selo; nenhum cenário é desenhado.
 *
 * Composição (redesenho): o mapa das bacias é a figura principal, logo depois da resposta
 * (milímetros e percentil primeiro, com a cautela ao lado) e dos controles, com o recorte
 * como legenda e a tabela equivalente; as notas do painel e a separação entre observação,
 * estimativa, previsão e cenário vêm junto dele; os números de destaque acompanham a bacia,
 * o período e o recorte de temperatura escolhidos; a chuva mês a mês, a comparação entre bacias,
 * a temperatura e a previsão são seções visíveis com pergunta própria, cada uma com o seu
 * veredito, o seu controle e o seu recorte. Janelas preliminares (IMERG Late e GEOS-IT) dizem
 * que são preliminares, com a recomendação da fonte, e aparecem marcadas nos gráficos.
 */
const ESQUEMA = {
  bac: campo(tiposUrl.texto({ max: 40 }), ""),
  per: campo(tiposUrl.texto({ max: 7 }), "30d"),
  rt: campo(tiposUrl.opcao(REGIOES), "SIN"),
  cmp: campo(tiposUrl.lista(tiposUrl.texto({ max: 40 }), { max: LIMITE_COMPARACAO }), ["GRANDE", "PARANAIBA", "SAO FRANCISCO", "TOCANTINS"]),
};

/**
 * As duas medidas de 30 dias que acompanham a escolha: a chuva da bacia e do período do mapa (os milímetros, com o percentil e a cautela na
 * nota) e a anomalia da temperatura do recorte escolhido. Os valores são os campos da própria bacia e do próprio recorte (os mesmos do mapa, da
 * tabela e da resposta). A ficha de prova é a da bacia padrão em 30 dias e a do SIN, as únicas que a gold publica; o nome e o valor da ficha são os
 * do cartão.
 */
export function MedidasClima({
  bacia,
  nomeBacia,
  per,
  base,
  temp,
  baciaPadrao,
  evidencias,
  endereco,
  corteImergFinal,
  corteMerra2,
}: {
  bacia: AguaPrecipitacaoBacia;
  nomeBacia: string;
  per: string;
  base: string;
  temp: AguaTemperatura | null;
  baciaPadrao: string;
  evidencias?: { chuva30d?: Evidencia | null; temperaturaSin30d?: Evidencia | null };
  endereco?: string;
  /** Último dia com IMERG Final e com MERRA-2: com eles, a linha "Revisões" da ficha diz que a troca do produto preliminar pelo final é uma revisão certa. */
  corteImergFinal?: string;
  corteMerra2?: string;
}) {
  const idioma = useIdioma();
  const tx = useTx();
  const f = formatos(idioma);
  const ehMes = per !== "30d";
  const mes = ehMes ? dadosChuvaMes(bacia, per) : null;
  const valorChuva = ehMes ? (mes?.mm ?? null) : bacia.mm_30d;
  const chuvaPadrao = bacia.bacia === baciaPadrao && !ehMes;
  return (
    <FaixaMetricas colunas={2} rotulo={tx("Medidas de chuva e de temperatura estimadas", "Estimated rainfall and temperature measures")}>
      <Numero
        variante="faixa"
        rotulo={tx(`${ehMes ? "Chuva do mês" : "Chuva de 30 dias"}, ${nomeBacia}`, `${ehMes ? "Rainfall for the month" : "30-day rainfall"}, ${nomeBacia}`)}
        nomesNoRotulo={[nomeBacia]}
        natureza="ESTIMADO"
        evidencia={
          chuvaPadrao && evidencias?.chuva30d
            ? evidenciaComNome(evidencias.chuva30d, tx(`Chuva de 30 dias, ${nomeBacia}`, `30-day rainfall, ${nomeBacia}`), `${f.num(valorChuva, 1)} mm`)
            : undefined
        }
        revisoes={chuvaPadrao && corteImergFinal ? textoRevisoesFichaClima(bacia.dia, corteImergFinal, { preliminar: "IMERG Late", final: "IMERG Final" }, 30, idioma) : undefined}
        valor={valorChuva}
        formato="num"
        casas={1}
        unidade="mm" // i18n: dado
        periodo={ehMes ? mesExtenso(per, idioma) : tx(`30 dias até ${f.dataBR(bacia.dia)}`, `30 days through ${f.dataBR(bacia.dia)}`)}
        cor="var(--serie-hidraulica)"
        nota={ehMes ? notaChuvaMes(bacia, per, base, idioma) : notaChuvaBacia(bacia, base, idioma)}
        motivoAusencia={tx("Sem estimativa de chuva nesta publicação: algum dia ficou abaixo de 80% de cobertura.", "No rainfall estimate in this release: some day fell below 80% coverage.")}
        endereco={endereco}
      />
      {temp && (
        <Numero
          variante="faixa"
          rotulo={tx(`Anomalia da temperatura, ${NOME_REGIAO[temp.recorte]}, em 30 dias`, `Temperature anomaly, ${nomeRegiao(temp.recorte, "en")}, over 30 days`)}
          natureza="ESTIMADO"
          evidencia={temp.recorte === "SIN" && evidencias?.temperaturaSin30d ? evidenciaTemperaturaComMedias(evidencias.temperaturaSin30d, temp, base, idioma) : undefined}
          revisoes={temp.recorte === "SIN" && corteMerra2 ? textoRevisoesFichaClima(temp.dia, corteMerra2, { preliminar: "GEOS-IT", final: "MERRA-2" }, 30, idioma) : undefined}
          valor={temp.anomalia_30d_c}
          formato="num"
          casas={1}
          unidade="°C"
          periodo={tx(`30 dias até ${f.dataBR(temp.dia)}`, `30 days through ${f.dataBR(temp.dia)}`)}
          cor="var(--serie-termica)"
          nota={`${notaAnomaliaTemperatura(temp, base, idioma)}${temp.preliminar_30d ? tx(" A janela é preliminar.", " The window is preliminary.") : ""}`}
          motivoAusencia={tx("Sem temperatura de 30 dias nesta publicação.", "No 30-day temperature in this release.")}
          endereco={endereco}
        />
      )}
    </FaixaMetricas>
  );
}

export function AguaClima({
  precipitacao,
  temperatura,
  previsao,
  provPrevisao,
  validacao,
  base,
  baciaPadrao,
  urlGeo,
  fonteChuva,
  fonteTemperatura,
  versaoChuva,
  versaoTemperatura,
  corteImergFinal,
  corteMerra2,
  evidencias,
  enderecoMedidas,
  notaSemContorno,
  inicioCsvDiario,
  notas,
  aposNotas,
  fecho,
  motivoSemPrevisao,
}: {
  precipitacao: AguaPrecipitacaoBacia[];
  temperatura: AguaTemperatura[];
  previsao: AguaPrevisao | null;
  /** Proveniência da previsão: a ficha dela mora na seção da previsão, e não no cabeçalho do mapa (que só tem estimativa). */
  provPrevisao?: Proveniencia | null;
  /** Conferência do IMERG com estações: o erro conhecido entra na nota do mapa, diante da classe central. */
  validacao?: DadosClima["validacao_estacoes"];
  base: string;
  baciaPadrao: string;
  urlGeo: string;
  fonteChuva: string;
  fonteTemperatura: string;
  versaoChuva: string;
  versaoTemperatura: string;
  /** Último dia com IMERG Final (depois dele, IMERG Late) e último dia com MERRA-2 (depois dele, GEOS-IT), lidos da gold. */
  corteImergFinal: string;
  corteMerra2: string;
  /** Fichas de prova da gold: a chuva da bacia padrão em 30 dias e a temperatura do SIN. Só aparecem quando a seleção é essa. */
  evidencias?: { chuva30d?: Evidencia | null; temperaturaSin30d?: Evidencia | null };
  /** Página e âncora dos números de destaque, repassadas à citação da ficha. */
  enderecoMedidas?: string;
  /** Frase das bacias do ONS que ficam sem chuva estimada por não terem contorno no mapa. */
  notaSemContorno?: string;
  /** Ano em que começa o CSV diário público de chuva (lido do rótulo do arquivo na gold), para dizer que a média da base não se reproduz só com ele. */
  inicioCsvDiario?: string | null;
  /** Notas do painel (NotasDoPainel: o que mudou, como interpretar e o que não é possível concluir), logo depois do mapa e da tabela. */
  notas?: ReactNode;
  /** Seção que vem logo depois dos números de destaque: o que é observação, estimativa, previsão e cenário. */
  aposNotas?: ReactNode;
  /** Último item visível em Entender: onde a relação com a demanda e com a afluência é medida. */
  fecho?: ReactNode;
  motivoSemPrevisao: ReactNode;
}) {
  const idioma = useIdioma();
  const tx = useTx();
  const f = formatos(idioma);
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const periodos = useMemo(() => periodosMapa(precipitacao), [precipitacao]);
  const per = periodos.includes(v.per) ? v.per : "30d";
  const ehMes = per !== "30d";
  const bacia = precipitacao.find((b) => b.bacia === v.bac) ?? precipitacao.find((b) => b.bacia === baciaPadrao) ?? precipitacao[0] ?? null;
  const rt = v.rt as Regiao;
  const temp = temperatura.find((t) => t.recorte === rt) ?? temperatura.find((t) => t.recorte === "SIN") ?? null;
  const dia30 = precipitacao[0]?.dia ?? null;
  const valores = useMemo(() => valoresMapaChuva(precipitacao, per), [precipitacao, per]);
  const classes = useMemo(() => classificacaoChuva(valores, idioma), [valores, idioma]);
  const linhas = useMemo(() => linhasChuva(precipitacao, per, idioma), [precipitacao, per, idioma]);
  const nomes = useMemo(() => Object.fromEntries(precipitacao.map((b) => [b.bacia, rotuloRecorte("bacia", b.bacia, idioma)])), [precipitacao, idioma]);
  // nomes próprios das bacias, para marcar em <Nome> nas frases montadas em agua.ts (página inglesa)
  const nomesBacias = useMemo(() => nomesProprios(precipitacao.map((b) => b.bacia)), [precipitacao]);
  const historico = useMemo(() => (bacia ? serieMensalChuva(bacia) : []), [bacia]);
  const escolhidas = useMemo(
    () => (v.cmp as string[]).map((id) => precipitacao.find((b) => b.bacia === id)).filter((b): b is AguaPrecipitacaoBacia => !!b),
    [v.cmp, precipitacao],
  );
  const multiplos = useMemo(() => linhasMultiplosChuva(escolhidas), [escolhidas]);
  const tDiaria = useMemo(() => (temp ? serieDiariaTemperatura(temp) : []), [temp]);
  const tMensal = useMemo(() => (temp ? serieMensalTemperatura(temp) : []), [temp]);
  const linhasTemp = useMemo(() => linhasTemperatura(temperatura, idioma), [temperatura, idioma]);
  const prev = useMemo(() => (previsao && bacia ? seriePrevisao(previsao, bacia.bacia) : []), [previsao, bacia]);
  const selecionar = (id: string | null) => id && definir({ bac: id === baciaPadrao ? "" : id });
  const assoc = bacia ? textoAssociacao(bacia, idioma) : null;
  // base, janelas e períodos dos títulos saem da gold (tamanho das séries publicadas), nunca de número escrito aqui
  const baseTxt = periodoBase(base, idioma);
  const baseAssoc = periodoBase(precipitacao.find((b) => b.associacao_ena?.periodo)?.associacao_ena?.periodo ?? base, idioma);
  const mesesHistorico = f.plural(historico.length, tx("mês completo", "complete month"), tx("meses completos", "complete months"));
  const mesesMultiplos = f.plural(multiplos.length, tx("mês completo", "complete month"), tx("meses completos", "complete months"));

  const viesImerg = validacao ? textoClasseCentralEViesImerg(validacao, idioma) : "";
  const mediaImerg = previsao && bacia ? mediaDiariaImerg(previsao, bacia.bacia) : null;
  const mes = bacia && ehMes ? dadosChuvaMes(bacia, per) : null;
  // a cautela fica numa frase junto da resposta; a explicação inteira (produto da base, recomendação da fonte) abre logo abaixo
  const resumoChuva = bacia
    ? ehMes
      ? mes?.preliminar
        ? tx("O mês tem dias do IMERG Late (preliminar).", "The month has IMERG Late days (preliminary).")
        : ""
      : resumoPreliminarChuva(bacia.dia, corteImergFinal, 30, idioma)
    : "";
  const prelimChuva = bacia
    ? ehMes
      ? mes?.preliminar
        ? tx(
            "O mês tem dias do IMERG Late, sem calibração por pluviômetros, e a média do mês é de produto final.",
            "The month has IMERG Late days, not calibrated against rain gauges, and the month average is from the final product.",
          )
        : ""
      : [textoPreliminarChuva(bacia.dia, corteImergFinal, 30, idioma), textoPreliminarChuva(bacia.dia, corteImergFinal) ? textoUltimoMesFinalChuva(bacia, base, idioma) : ""]
          .filter(Boolean)
          .join(" ")
    : "";
  const resumoTemp = temp ? resumoPreliminarTemperatura(temp.dia, corteMerra2, 30, idioma) : "";
  const prelimTemp = temp
    ? [textoPreliminarTemperatura(temp.dia, corteMerra2, 30, idioma), textoPreliminarTemperatura(temp.dia, corteMerra2) ? textoUltimoMesFinalTemperatura(temp, corteMerra2, base, idioma) : ""]
        .filter(Boolean)
        .join(" ")
    : "";
  const marcaTemp = useMemo(
    () => marcaPreliminarSerie(tDiaria.map((p) => p.d), corteMerra2, porIdioma(idioma, { pt: "GEOS-IT a partir daqui (preliminar)", en: "GEOS-IT from here on (preliminary)" })),
    [tDiaria, corteMerra2, idioma],
  );
  const semChuva = tx("Sem estimativa de chuva por bacia nesta publicação.", "No rainfall estimate by basin in this release.");
  const semTemp = tx("Sem temperatura estimada nesta publicação.", "No estimated temperature in this release.");
  const periodoMapa = rotuloPeriodoMapa(per, dia30, idioma);
  const doRecorteTemp = temp ? doRegiao(temp.recorte, idioma) : "";

  return (
    <div className="space-y-6">
      <div className="grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="flex flex-col gap-3">
          <RespostaCurta id="p019" vivo veredito={!bacia ? semChuva : ehMes ? vereditoChuvaMes(bacia, per, idioma) : vereditoChuva(bacia, idioma)}>
            {!bacia ? semChuva : comNomes(ehMes ? respostaChuvaMes(bacia, per, base, idioma) : respostaChuva(bacia, base, idioma), nomesBacias, idioma)}
          </RespostaCurta>
          {bacia && (
            <details data-cautela="chuva" className="max-w-prose2 border-l-2 border-aviso pl-3 text-sm leading-relaxed text-carvao-muted">
              <summary className="min-h-[44px] cursor-pointer py-1">
                {resumoChuva}
                {tx(
                  " Com média de poucos milímetros, o percentual de anomalia cresce muito: leia os milímetros e o percentil.",
                  " With an average of only a few millimeters, the anomaly percentage grows a lot: read the millimeters and the percentile.",
                )}{" "}
                {prelimChuva && <span className="text-energia-dark underline underline-offset-4">{tx("Por que a janela é preliminar", "Why the window is preliminary")}</span>}
              </summary>
              {prelimChuva && <p className="pb-2">{prelimChuva}</p>}
            </details>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <AguaLista
            rotulo={tx("Bacia", "Basin")}
            // em inglês, a opção é o nome da bacia, marcado como nome próprio (o rótulo da lista já diz "Basin"); os grupos do ONS dizem o que agrupam
            opcoes={precipitacao.map((b) =>
              ehGrupoOns(b.bacia) ? { id: b.bacia, rotulo: nomes[b.bacia] } : { id: b.bacia, rotulo: tx(nomes[b.bacia], nomeProprio(b.bacia, "en")), nome: true },
            )}
            valor={bacia?.bacia ?? ""}
            onEscolher={(x) => selecionar(x)}
          />
          <AguaLista
            rotulo={tx("Período do mapa", "Map period")}
            opcoes={periodos.map((p) => ({ id: p, rotulo: rotuloPeriodoMapa(p, dia30, idioma) }))}
            valor={per}
            onEscolher={(x) => definir({ per: x })}
          />
          <AguaRestaurar />
        </div>
      </div>

      <AguaMapaBacias
        titulo={tx("Chuva estimada por bacia contra a média dos mesmos dias, em %", "Estimated rainfall by basin against the average of the same days, in %")}
        fonteGeometria={urlGeo}
        valores={valores}
        classificacao={classes}
        cores={CORES_ANOMALIA}
        unidade={tx("% da média", "% of average")}
        casas={1}
        nomes={nomes}
        selecionado={bacia?.bacia ?? null}
        onSelecionar={selecionar}
        periodo={periodoMapa}
        nota={tx(
          `Anomalia = chuva do período ÷ média dos mesmos dias (ou do mesmo mês) em ${baseTxt} − 1. No período seco, médias pequenas geram percentuais grandes: confira os milímetros na tabela.${viesImerg ? ` ${viesImerg}` : ""}`,
          `Anomaly = rainfall for the period ÷ average of the same days (or of the same month) in ${baseTxt} − 1. In the dry season, small averages produce large percentages: check the millimeters in the table.${viesImerg ? ` ${viesImerg}` : ""}`,
        )}
        notaSemContorno={notaSemContorno}
      />

      <AguaLegenda
        periodo={tx(`Chuva: ${periodoMapa}; média da base em ${baseTxt}`, `Rainfall: ${periodoMapa}; baseline average in ${baseTxt}`)}
        universo={tx<ReactNode>(
          "Chuva estimada por satélite (IMERG, produto de chuva da NASA: a versão Final é calibrada por pluviômetros, e a Late, dos dias mais recentes, não é): média dos pontos de grade dentro do contorno de cada bacia do Operador Nacional do Sistema Elétrico (ONS), ponderada pela área",
          <>
            Satellite-estimated rainfall (IMERG, NASA&apos;s rainfall product: the Final version is calibrated against rain gauges, and the Late version, for the most recent days, is
            not): average of the grid points inside the outline of each basin of the national grid operator (<Nome>Operador Nacional do Sistema Elétrico</Nome>, ONS), weighted by
            area
          </>,
        )}
        unidade={tx(
          "mm de chuva acumulada; anomalia em % da média da base; percentil: a posição da chuva entre as dos mesmos dias de anos anteriores",
          "mm of accumulated rainfall; anomaly in % of the baseline average; percentile: the position of the rainfall among those of the same days in previous years",
        )}
      />

      <AguaTabela
        titulo={tx(`Tabela equivalente ao mapa: chuva por bacia, ${periodoMapa}`, `Table equivalent to the map: rainfall by basin, ${periodoMapa}`)}
        colunas={colunasChuva(idioma)}
        linhas={linhas}
        chaveLinha="id"
        colunaRotulo="rotulo"
        fonte={fonteChuva}
        versao={versaoChuva}
        nomeArquivo={`agua-chuva-bacias-${per}`}
        selecionado={bacia?.bacia ?? null}
        onSelecionar={selecionar}
        chaveUrl="chu"
        nota={tx<ReactNode>(
          `Percentil e cobertura só na janela de 30 dias. A correlação com a ENA é associação descritiva (${baseAssoc}), não causa.${
            bacia && !ehMes && bacia.media_30d_base !== null
              ? ` A média de ${nomes[bacia.bacia]}, ${f.num(bacia.media_30d_base, 1)} mm, usa ${baseTxt}${inicioCsvDiario ? `, mas o CSV diário público começa em ${inicioCsvDiario}` : ""}: ela não se reproduz só com esse arquivo.`
              : ""
          }`,
          comNomes(
            `Percentile and coverage only for the 30-day window. The correlation with ENA is a descriptive association (${baseAssoc}), not a cause.${
              bacia && !ehMes && bacia.media_30d_base !== null
                ? ` The average for the ${nomes[bacia.bacia]}, ${f.num(bacia.media_30d_base, 1)} mm, uses ${baseTxt}${inicioCsvDiario ? `, but the public daily CSV starts in ${inicioCsvDiario}` : ""}: it cannot be reproduced from that file alone.`
                : ""
            }`,
            nomesBacias,
            idioma,
          ),
        )}
      />

      {notas}

      {bacia && (
        <SecaoDoPainel
          id="medidas"
          titulo={tx("Quanto a chuva e a temperatura escolhidas se afastam da média?", "How far do the chosen rainfall and temperature depart from the average?")}
          lead={tx(
            "A chuva é a da bacia e do período escolhidos no mapa; a temperatura é a do recorte escolhido na seção de temperatura. As duas são estimativas, com datas e fontes próprias, e não equivalem à afluência nem ao armazenamento.",
            "The rainfall is that of the basin and period chosen on the map; the temperature is that of the area chosen in the temperature section. Both are estimates, with their own dates and sources, and are not equivalent to inflow or storage.",
          )}
        >
          <MedidasClima
            bacia={bacia}
            nomeBacia={nomes[bacia.bacia]}
            per={per}
            base={base}
            temp={temp}
            baciaPadrao={baciaPadrao}
            evidencias={evidencias}
            endereco={enderecoMedidas}
            corteImergFinal={corteImergFinal}
            corteMerra2={corteMerra2}
          />
        </SecaoDoPainel>
      )}

      {aposNotas}

      {bacia && (
        <SecaoDoPainel id="historico" titulo={tx("Como a chuva de cada mês se compara com a média do mês?", "How does each month's rainfall compare with the month average?")}>
          <GraficoLinhas
            titulo={tx(`${nomes[bacia.bacia]}: chuva em cada um dos últimos ${mesesHistorico} e a média do mesmo mês`, `${nomes[bacia.bacia]}: rainfall in each of the last ${mesesHistorico} and the average of the same month`)}
            nomesNoTitulo={[nomes[bacia.bacia]]}
            dados={historico}
            chaveX="m"
            formatoX="mes"
            series={[
              { id: "mm", rotulo: tx("Chuva estimada no mês", "Estimated rainfall in the month"), cor: "var(--serie-hidraulica)", espessura: 2.5 },
              { id: "media", rotulo: tx(`Média do mês em ${periodoBase(base, "pt")}`, `Month average in ${periodoBase(base, "en")}`), cor: "var(--serie-referencia)", tracejada: true },
            ]}
            banda={{ inferior: "p10", superior: "p90", rotulo: tx("10º a 90º percentil do mês", "10th to 90th percentile for the month") }}
            marcos={bacia.mensal.preliminar_desde ? [{ x: bacia.mensal.preliminar_desde, rotulo: tx("dias do IMERG Late a partir daqui", "IMERG Late days from here on") }] : []}
            unidade="mm" // i18n: dado
            casas={1}
            zeroNoEixo
          />
          {bacia.mensal.preliminar_desde && (
            <p className="text-sm text-carvao-muted">
              {tx(
                `Desde ${f.mesAno(bacia.mensal.preliminar_desde)} os meses têm dias do IMERG Late (preliminar, sem calibração por pluviômetros): a marca vertical do gráfico mostra onde começam.`,
                `Since ${f.mesAno(bacia.mensal.preliminar_desde)} the months have IMERG Late days (preliminary, not calibrated against rain gauges): the vertical mark on the chart shows where they begin.`,
              )}
            </p>
          )}
          {assoc && (
            <RespostaCurta id="p019-associacao" vivo depois tamanho="sm" veredito={vereditoAssociacao(bacia, idioma) ?? assoc}>
              {comNomes(assoc, nomesBacias, idioma)}
            </RespostaCurta>
          )}
        </SecaoDoPainel>
      )}

      <SecaoDoPainel id="comparar-bacias" nivel="analisar" titulo={tx("Como a chuva mensal se compara entre bacias?", "How does monthly rainfall compare across basins?")}>
        <Comparador
          rotulo={tx(`Bacias comparadas (até ${LIMITE_COMPARACAO})`, `Basins compared (up to ${LIMITE_COMPARACAO})`)}
          entidades={precipitacao.map((b) => ({ id: b.bacia, rotulo: nomes[b.bacia], sinonimos: [b.bacia], nome: true }))}
          selecionadas={escolhidas.map((b) => b.bacia)}
          onMudar={(ids) => definir({ cmp: ids })}
          dicaBusca={tx("Buscar, por exemplo Grande, Paranaíba, São Francisco", "Search, for example Grande, Paranaíba, Tocantins")}
          vazio={tx("Nenhuma bacia escolhida. Escolha até quatro para ver a chuva mensal e a média na mesma escala.", "No basin chosen. Choose up to four to see monthly rainfall and the average on the same scale.")}
        >
          {() => null}
        </Comparador>
        {escolhidas.length > 0 && (
          <PequenosMultiplos
            titulo={tx(`Chuva mensal estimada e média do mês, últimos ${mesesMultiplos}`, `Estimated monthly rainfall and month average, last ${mesesMultiplos}`)}
            dados={multiplos}
            chaveX="m"
            formatoX="mes"
            unidade="mm" // i18n: dado
            casas={1}
            zeroNoEixo
            colunas={escolhidas.length >= 4 ? 4 : escolhidas.length >= 3 ? 3 : 2}
            nivelTitulo={4}
            paineis={escolhidas.map((b) => ({
              id: b.bacia,
              titulo: nomes[b.bacia],
              tituloEhNome: true,
              // a mesma grandeza tem a mesma cor e o mesmo rótulo em todos os painéis e na seção da bacia (chuva estimada no mês); o nome da bacia é o título do painel
              series: [
                { id: b.bacia, rotulo: tx("Chuva no mês", "Rainfall in the month"), cor: "var(--serie-hidraulica)", espessura: 2 },
                { id: `${b.bacia}·media`, rotulo: tx("Média do mês", "Month average"), cor: "var(--serie-referencia)", tracejada: true, espessura: 1 },
              ],
            }))}
          />
        )}
      </SecaoDoPainel>

      <SecaoDoPainel
        id="temperatura"
        titulo={tx("Como a temperatura estimada se compara com a média dos mesmos dias?", "How does the estimated temperature compare with the average of the same days?")}
        lead={tx(
          "O recorte da temperatura se escolhe aqui e não depende da bacia do mapa; os dois entram juntos nos números de destaque, acima.",
          "The temperature area is chosen here and does not depend on the basin on the map; both enter together in the highlight figures, above.",
        )}
      >
        <div className="grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="flex flex-col gap-3">
            <RespostaCurta id="p019-temperatura" vivo depois veredito={temp ? vereditoTemperatura(temp, idioma) : semTemp}>
              {temp ? respostaTemperatura(temp, base, idioma) : semTemp}
            </RespostaCurta>
            {prelimTemp && (
              <details data-cautela="temperatura" className="max-w-prose2 border-l-2 border-aviso pl-3 text-sm leading-relaxed text-carvao-muted">
                <summary className="min-h-[44px] cursor-pointer py-1">
                  {resumoTemp} <span className="text-energia-dark underline underline-offset-4">{tx("Por que a janela é preliminar", "Why the window is preliminary")}</span>
                </summary>
                <p className="pb-2">{prelimTemp}</p>
              </details>
            )}
          </div>
          <AguaEscolha
            legenda={tx("Temperatura (SIN: Sistema Interligado Nacional)", "Temperature (SIN: National Interconnected System)")}
            opcoes={REGIOES.map((r) => ({ id: r, rotulo: nomeRegiao(r, idioma), detalhe: nomeRegiao(r, idioma) }))}
            valor={rt}
            onEscolher={(x) => definir({ rt: x })}
          />
        </div>
        {temp && (
          <>
            <GraficoLinhas
              titulo={tx(
                `Temperatura média diária ${doRecorteTemp} nos últimos ${f.plural(tDiaria.length, "dia", "dias")}, com a faixa do mesmo dia`,
                `Average daily temperature ${doRecorteTemp} over the last ${f.plural(tDiaria.length, "day", "days")}, with the range for the same day`,
              )}
              dados={tDiaria}
              chaveX="d"
              series={[
                { id: "t", rotulo: tx("Média do dia", "Daily average"), cor: COR_REGIAO[temp.recorte], espessura: 2.5 },
                { id: "tmax", rotulo: tx("Média das máximas das células", "Average of the cells' maximums"), cor: "var(--serie-termica)", tracejada: true },
              ]}
              banda={{
                inferior: "p10",
                superior: "p90",
                rotulo: tx(`10º a 90º percentil da média do mesmo dia (${periodoBase(base, "pt")})`, `10th to 90th percentile of the average for the same day (${periodoBase(base, "en")})`),
              }}
              marcos={marcaTemp.marcos}
              unidade="°C"
              casas={1}
            />
            <p className="text-sm text-carvao-muted">
              {marcaTemp.todaPreliminar
                ? tx(
                    `Todos os dias deste gráfico vêm do GEOS-IT, preliminar (o MERRA-2 vai até ${f.dataBR(corteMerra2)}), e a faixa do mesmo dia é do MERRA-2. `,
                    `All days in this chart come from GEOS-IT, preliminary (MERRA-2 runs through ${f.dataBR(corteMerra2)}), and the range for the same day is from MERRA-2. `,
                  )
                : marcaTemp.marcos.length
                  ? tx("A marca vertical mostra onde a temperatura passa a vir do GEOS-IT, preliminar. ", "The vertical mark shows where the temperature starts to come from GEOS-IT, preliminary. ")
                  : ""}
              {tx(
                "A linha tracejada é a média, ponderada pela população, das temperaturas máximas de cada célula, e não a temperatura máxima do recorte.",
                "The dashed line is the population-weighted average of each cell's maximum temperatures, not the maximum temperature of the area.",
              )}
            </p>
            <GraficoBarras
              titulo={tx(
                `Anomalia da temperatura média mensal ${doRecorteTemp}, últimos ${f.plural(tMensal.length, "mês completo", "meses completos")}`,
                `Anomaly of the average monthly temperature ${doRecorteTemp}, last ${f.plural(tMensal.length, "complete month", "complete months")}`,
              )}
              dados={tMensal.map((x) => ({ m: x.m, rotulo: `${f.mesAno(x.m)}${mesPreliminar(x.m, corteMerra2) ? "*" : ""}`, anomalia: x.anomalia }))}
              chaveCategoria="m"
              chaveRotulo="rotulo"
              series={[{ id: "anomalia", rotulo: tx(`Diferença para a média do mês em ${periodoBase(base, "pt")}`, `Difference from the month average in ${periodoBase(base, "en")}`), cor: "var(--serie-termica)" }]}
              unidade="°C"
              casas={2}
            />
            {tMensal.some((x) => mesPreliminar(x.m, corteMerra2)) && (
              <p className="text-sm text-carvao-muted" data-nota="temperatura-preliminar">
                {tx(
                  "* Mês com dias do GEOS-IT (preliminar): a barra mistura MERRA-2 e GEOS-IT e pode mudar quando o MERRA-2 chegar.",
                  "* Month with GEOS-IT days (preliminary): the bar mixes MERRA-2 and GEOS-IT and may change when MERRA-2 arrives.",
                )}
              </p>
            )}
            {textoMesesAcimaDaMedia(temp, base, idioma) && (
              <p className="text-sm text-carvao-muted" data-nota="temperatura-tendencia">
                {textoMesesAcimaDaMedia(temp, base, idioma)}
              </p>
            )}
          </>
        )}
        <AguaLegenda
          periodo={tx(`Temperatura: 30 dias até ${f.dataBR(temp?.dia)}; média da base em ${baseTxt}`, `Temperature: 30 days through ${f.dataBR(temp?.dia)}; baseline average in ${baseTxt}`)}
          universo={tx(
            "Temperatura estimada por reanálise (MERRA-2, da NASA: um modelo da atmosfera ajustado a observações; nos dias mais recentes, GEOS-IT, ainda preliminar): células mais populosas de cada UF, ponderadas pela população, somadas por subsistema",
            "Temperature estimated by reanalysis (NASA's MERRA-2: an atmospheric model adjusted to observations; for the most recent days, GEOS-IT, still preliminary): most populous cells of each state, weighted by population, summed by subsystem",
          )}
          unidade={tx(
            "°C e anomalia em °C; percentil: a posição da temperatura entre as dos mesmos dias de anos anteriores",
            "°C and anomaly in °C; percentile: the position of the temperature among those of the same days in previous years",
          )}
        />
        <AguaTabela
          titulo={tx("Tabela equivalente: temperatura de 30 dias por recorte", "Equivalent table: 30-day temperature by area")}
          colunas={colunasTemperatura(idioma)}
          linhas={linhasTemp}
          chaveLinha="id"
          colunaRotulo="rotulo"
          fonte={fonteTemperatura}
          versao={versaoTemperatura}
          nomeArquivo="agua-temperatura-30d"
          selecionado={rt}
          onSelecionar={(id) => id && definir({ rt: id as Regiao })}
          recolher
        />
      </SecaoDoPainel>

      <div data-natureza="PREVISTO">
        <SecaoDoPainel
          id="previsao"
          tracejada
          titulo={tx("O que a previsão de uma rodada mostra para os próximos dias?", "What does the forecast from one run show for the coming days?")}
          lead={
            <>
              <span className="mr-2 inline-block align-middle">
                <SeloNatureza natureza="PREVISTO" />
              </span>
              {tx(
                <>
                  Previsão meteorológica: uma rodada de um modelo, não observação. O modelo é o IFS, do Centro Europeu de Previsão do Tempo a Médio Prazo (ECMWF). Os dias são dias UTC, o
                  horário universal, três horas à frente de Brasília.
                </>,
                <>
                  Weather forecast: one run of a model, not observation. The model is the IFS, from the European Centre for Medium-Range Weather Forecasts (ECMWF). The days are UTC days,
                  universal time, three hours ahead of Brasília.
                </>,
              )}
            </>
          }
        >
          {previsao ? (
            <>
              <p className="max-w-prose2 text-sm leading-relaxed text-carvao" data-texto="previsao">
                {bacia ? comNomes(respostaPrevisao(previsao, bacia.bacia, idioma), nomesBacias, idioma) : ""}
              </p>
              <p className="text-sm leading-relaxed text-carvao-muted">
                {tx(
                  <>
                    Rodada de {rotuloRodada(previsao.emitida_em, "pt")}, capturada em {f.carimbo(previsao.capturada_em)}
                    {previsao.idade_horas !== null ? `, com ${f.num(previsao.idade_horas, 0)} horas no processamento` : ""}. {previsao.comparabilidade}
                  </>,
                  <>
                    Run of {rotuloRodada(previsao.emitida_em, "en")}, captured on {f.carimbo(previsao.capturada_em)}
                    {previsao.idade_horas !== null ? `, ${f.num(previsao.idade_horas, 0)} hours old at processing` : ""}.{" "}
                    <TrechoPortugues regiao="agua-previsao-comparabilidade">{previsao.comparabilidade}</TrechoPortugues>
                  </>,
                )}
              </p>
              {provPrevisao && <SobreEsteDado p={provPrevisao} rotulo={tx("Sobre a previsão", "About the forecast")} />}
              {bacia && (
                <GraficoBarras
                  titulo={tx(`Chuva prevista por dia na bacia do ${nomeProprio(bacia.bacia, "pt")} (dia UTC)`, `Forecast rainfall by day in the ${nomeProprio(bacia.bacia, "en")} basin (UTC day)`)}
                  nomesNoTitulo={[nomeProprio(bacia.bacia, "en")]}
                  dados={prev.map((p) => ({ d: p.d, rotulo: f.dataBR(p.d), mm: p.mm }))}
                  chaveCategoria="d"
                  chaveRotulo="rotulo"
                  series={[{ id: "mm", rotulo: tx("Chuva prevista", "Forecast rainfall"), cor: "var(--cor-previsto)" }]}
                  referencias={
                    mediaImerg !== null
                      ? [{ valor: mediaImerg, rotulo: tx("Média do IMERG nos mesmos dias, por dia (outro produto: só ordem de grandeza)", "IMERG average for the same days, per day (a different product: order of magnitude only)") }]
                      : []
                  }
                  unidade="mm" // i18n: dado
                  casas={1}
                />
              )}
              <GraficoLinhas
                titulo={tx("Temperatura média prevista por dia (dia UTC), por recorte", "Forecast average temperature by day (UTC day), by area")}
                dados={prev}
                chaveX="d"
                series={REGIOES.map((r) => ({ id: r, rotulo: nomeRegiao(r, idioma), sigla: curtoRegiao(r, idioma), cor: COR_REGIAO[r], tracejada: true }))}
                unidade="°C"
                casas={1}
              />
              <AguaTabela
                titulo={tx("Chuva prevista por bacia e a média IMERG dos mesmos dias", "Forecast rainfall by basin and the IMERG average for the same days")}
                colunas={colunasPrevisaoChuva(idioma)}
                linhas={linhasPrevisaoChuva(previsao, idioma)}
                chaveLinha="id"
                colunaRotulo="rotulo"
                fonte={tx(`${previsao.modelo} (previsão); NASA POWER IMERG (média)`, `${modeloPrevisao(previsao.modelo, "en")} (forecast); NASA POWER IMERG (average)`)}
                versao={previsao.emitida_em}
                nomeArquivo="agua-previsao-chuva"
                selecionado={bacia?.bacia ?? null}
                onSelecionar={selecionar}
              />
              <TabelaInterativa
                titulo={tx("Temperatura média prevista nos 7 primeiros dias e a média MERRA-2 dos mesmos dias", "Forecast average temperature over the first 7 days and the MERRA-2 average for the same days")}
                colunas={colunasPrevisaoTemperatura(idioma)}
                linhas={linhasPrevisaoTemperatura(previsao, idioma)}
                chaveLinha="id"
                colunaRotulo="rotulo"
                fonte={tx(`${previsao.modelo} (previsão); NASA POWER MERRA-2 (média)`, `${modeloPrevisao(previsao.modelo, "en")} (forecast); NASA POWER MERRA-2 (average)`)}
                versao={previsao.emitida_em}
                nomeArquivo="agua-previsao-temperatura"
                recolher
              />
            </>
          ) : (
            <p role="status" className="border border-dashed border-linha bg-superficie px-5 py-4 text-sm text-carvao-muted">
              {motivoSemPrevisao}
            </p>
          )}
        </SecaoDoPainel>
      </div>

      {fecho}
    </div>
  );
}
