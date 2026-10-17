"use client";

import { useMemo, type ReactNode } from "react";
import { AguaEscolha, AguaLista } from "@/components/energia/AguaControles";
import { AguaLegenda } from "@/components/energia/AguaLegenda";
import { Nome } from "@/components/i18n/Nome";
import { AguaRestaurar } from "@/components/energia/AguaRestaurar";
import { AguaTabela } from "@/components/energia/AguaTabela";
import { Comparador } from "@/components/energia/Comparador";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { GraficoPontos } from "@/components/energia/GraficoPontos";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import {
  COR_REGIAO,
  CURTO_REGIAO,
  NOME_REGIAO,
  REGIOES,
  SUBSISTEMAS,
  TIPOS_RECORTE,
  colunasAfluencia,
  curtoRegiao,
  evidenciaEnaArmazenavel,
  itensPontosAfluencia,
  linhasAfluencia,
  motivoSemEna30d,
  nomeRegiao,
  notaEnaArmazenavel,
  notaEnaDoDia,
  periodoBase,
  recorteEscolhido,
  recortePadraoEna,
  respostaAfluencia,
  rotuloTipoRecorte,
  textoEnaProvisoria,
  textoFaixaJanela,
  textoMedianaEMlt,
  textoPasso,
  textoReeNovos,
  textoRevisoesFicha,
  vereditoAfluencia,
  type EntidadeEna,
  type PontoRegioes,
  type TipoRecorte,
} from "@/lib/energia/agua";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import type { Evidencia } from "@/lib/energia/evidencia";
import { formatos } from "@/lib/energia/formato";
import { porIdioma } from "@/lib/energia/idioma";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import type { Idioma } from "@/lib/idioma";
import { LIMITE_COMPARACAO } from "@/lib/energia/tabela";
import type { Regiao } from "@/lib/energia/tipos";
import type { AguaRevisaoCaptura } from "@/lib/energia/tipos-agua";

/**
 * P018, afluência: tipo de recorte (?rec=), recorte escolhido (?ent=), regiões no
 * gráfico semanal (?sms=, até quatro) e o intervalo do gráfico (?de=, ?ate=) ficam na
 * URL. A resposta, os pontos pareados, a tabela equivalente, a exportação e os números
 * de destaque usam as mesmas linhas (itensPontosAfluencia, linhasAfluencia e os campos
 * da mesma entidade). A ENA de 30 dias é a razão de somas publicada na gold; nada é
 * recalculado aqui.
 *
 * Composição (redesenho): a resposta e os controles abrem o painel e a figura principal
 * (pontos pareados de cada recorte contra a mediana da janela) vem logo depois, com o
 * recorte como legenda; os números do recorte escolhido ficam logo abaixo da figura (a
 * faixa acompanha a seleção, e a ficha de prova só existe para o recorte da gold, o SIN);
 * a tabela equivalente fica recolhida; as notas do painel vêm junto da figura; a
 * evolução em 30 dias é uma seção visível com pergunta própria.
 */
const ESQUEMA = {
  rec: campo(tiposUrl.opcao(TIPOS_RECORTE), "subsistema"),
  ent: campo(tiposUrl.texto({ max: 60 }), ""),
  sms: campo(tiposUrl.lista(tiposUrl.opcao(REGIOES), { max: LIMITE_COMPARACAO }), [...SUBSISTEMAS] as Regiao[]),
  de: campo(tiposUrl.data(), ""),
  ate: campo(tiposUrl.data(), ""),
};

const opcoesTipo = (idioma: Idioma) => TIPOS_RECORTE.map((t) => ({ id: t, rotulo: rotuloTipoRecorte(t, idioma) }));

// o universo dos REE cita os REE novos publicados na gold (datas e nomes não ficam escritos aqui); a sigla SIN e o REE vêm por extenso no uso
const universo = (tipo: TipoRecorte, reeNovos: readonly { data: string; novos: string[] }[], idioma: Idioma): string =>
  porIdioma(idioma, {
    pt: `${universoBase(tipo, reeNovos, "pt")}. A ENA é derivada pelo ONS (vazão natural reconstituída, convertida em energia), não é medição direta`,
    en: `${universoBase(tipo, reeNovos, "en")}. The ENA is derived by ONS (reconstructed natural flow, converted into energy); it is not a direct measurement`,
  });

const universoBase = (tipo: TipoRecorte, reeNovos: readonly { data: string; novos: string[] }[], idioma: Idioma): string =>
  tipo === "subsistema"
    ? porIdioma(idioma, {
        pt: "Subsistemas do Sistema Interligado Nacional (SIN); o SIN soma as ENA e as MLT dos quatro, dia a dia",
        en: "Subsystems of the National Interconnected System (SIN); the SIN adds up the ENAs and MLTs of the four, day by day",
      })
    : tipo === "ree"
      ? porIdioma(idioma, {
          pt: `Reservatórios equivalentes de energia (REE) do ONS (perímetro atual${textoReeNovos(reeNovos, "pt")})`,
          en: `ONS equivalent energy reservoirs (REE) (current perimeter${textoReeNovos(reeNovos, "en")})`,
        })
      : porIdioma(idioma, {
          pt: "Bacias hidroenergéticas do ONS, mais os grupos de afluências que o ONS publica agrupados (“Outras do Sul” e “Outras do Sudeste”), sem MLT",
          en: "ONS hydro-energy basins, plus the groups of inflows that ONS publishes grouped (“Outras do Sul” and “Outras do Sudeste”, other South and other Southeast basins), without an MLT",
        });

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/**
 * Números do recorte escolhido: a ENA de 30 dias em % da MLT, a mediana da mesma janela, a ENA do dia em MWmed e, nos subsistemas, a ENA
 * armazenável. Os valores são os campos da própria entidade (os mesmos do gráfico, da tabela e da resposta), a faixa nunca calcula. A ficha
 * "Comprove este número" é a do SIN, a única que a gold publica: outro recorte não a mostra. Os últimos dias são ditos provisórios, e a ficha
 * traz as revisões que a tabela de revisões da página mostra. A ENA armazenável é dita em % da MLT da ENA bruta (o ONS não publica uma MLT
 * própria da armazenável), na nota do número e na ficha. Os dois "normais" (a MLT, 100%, e a mediana da janela) ficam lado a lado na nota.
 */
export function MedidasAfluencia({
  e,
  revisoes,
  evidencias,
  endereco,
}: {
  e: EntidadeEna;
  revisoes: AguaRevisaoCaptura[];
  evidencias?: { ena30d?: Evidencia | null; enaArm30d?: Evidencia | null };
  endereco?: string;
}) {
  const idioma = useIdioma();
  const tx = useTx();
  const f = formatos(idioma);
  // a ficha de prova é a do SIN: só ele a tem
  const ehSin = e.tipo === "subsistema" && e.id === "SIN";
  const comArmazenavel = e.pct_mlt_arm_30d !== undefined;
  const revisoesFicha = textoRevisoesFicha(revisoes, idioma);
  const daMlt = tx("da MLT", "of MLT");
  const janela = tx(`30 dias até ${f.dataBR(e.dia)}`, `30 days through ${f.dataBR(e.dia)}`);
  const medianaMlt = textoMedianaEMlt(e, idioma);
  return (
    <div data-medidas-recorte="" className="space-y-2">
      <p className="rotulo text-mineral">{tx(`Números do recorte escolhido: ${e.rotulo}`, `Figures for the chosen area: ${e.rotulo}`)}</p>
      <FaixaMetricas
        colunas={comArmazenavel ? 4 : 3}
        rotulo={tx(`Indicadores da afluência: ${e.rotulo}`, `Inflow indicators: ${e.rotulo}`)}
        nota={
          <div className="space-y-1.5 text-sm">
            <p>{textoEnaProvisoria(revisoes, idioma)}</p>
            {medianaMlt && <p data-texto="mediana-e-mlt">{medianaMlt}</p>}
          </div>
        }
      >
        <Numero
          variante="faixa"
          rotulo={tx("ENA bruta de 30 dias", "30-day gross ENA")}
          natureza="CALCULADO"
          evidencia={ehSin ? evidencias?.ena30d : undefined}
          revisoes={ehSin ? revisoesFicha : undefined}
          valor={e.pct_mlt_30d}
          formato="pct"
          casas={1}
          unidade={daMlt}
          periodo={janela}
          cor="var(--cor-energia)"
          motivoAusencia={cap(motivoSemEna30d(e, idioma))}
          endereco={endereco}
        />
        <Numero
          variante="faixa"
          rotulo={tx("Mediana da mesma janela", "Median of the same window")}
          natureza="CALCULADO"
          valor={e.p50_30d}
          formato="pct"
          casas={1}
          unidade={daMlt}
          periodo={e.faixa_30d && e.periodo_base ? tx(`mesma janela em ${periodoBase(e.periodo_base, "pt")}`, `same window in ${periodoBase(e.periodo_base, "en")}`) : undefined}
          cor="var(--serie-referencia)"
          motivoAusencia={cap(textoFaixaJanela(e, idioma))}
        />
        <Numero
          variante="faixa"
          rotulo={tx("ENA do dia", "ENA on the day")}
          natureza="CALCULADO"
          valor={e.ena_mwmed_dia}
          formato="num"
          casas={0}
          unidade={tx("MWmed", "MWavg")}
          periodo={f.dataBR(e.dia)}
          nota={notaEnaDoDia(e, idioma) ?? undefined}
          motivoAusencia={tx("Sem ENA do dia nesta publicação.", "No ENA for the day in this release.")}
        />
        {comArmazenavel && (
          <Numero
            variante="faixa"
            rotulo={tx("ENA armazenável de 30 dias", "30-day storable ENA")}
            natureza="CALCULADO"
            evidencia={ehSin && evidencias?.enaArm30d ? evidenciaEnaArmazenavel(evidencias.enaArm30d) : undefined}
            revisoes={ehSin ? revisoesFicha : undefined}
            valor={e.pct_mlt_arm_30d ?? null}
            formato="pct"
            casas={1}
            unidade={daMlt}
            periodo={janela}
            motivoAusencia={tx("Sem ENA armazenável de 30 dias completa nesta publicação.", "No complete 30-day storable ENA in this release.")}
            nota={notaEnaArmazenavel(idioma)}
            endereco={endereco}
          />
        )}
      </FaixaMetricas>
    </div>
  );
}

export function AguaAfluencia({
  entidades,
  serie,
  passoDias,
  reeNovos,
  fonte,
  versao,
  notas,
  evidencias,
  revisoes,
  enderecoMedidas,
}: {
  entidades: EntidadeEna[];
  /** ENA de 30 dias (% da MLT) em pontos regulares (passoDias) nos últimos meses publicados, por região. */
  serie: PontoRegioes[];
  passoDias: number;
  /** REE que aparecem depois do início do conjunto (gold: afluencia.ree_novos_por_data). */
  reeNovos: { data: string; novos: string[] }[];
  fonte: string;
  versao: string;
  /** Notas do painel (NotasDoPainel: o que mudou, como interpretar e o que não é possível concluir), logo depois da figura principal e da tabela. */
  notas?: ReactNode;
  /** Fichas de prova do SIN (ENA bruta e armazenável de 30 dias): aparecem só quando o recorte escolhido é o SIN. */
  evidencias?: { ena30d?: Evidencia | null; enaArm30d?: Evidencia | null };
  /** Revisões do ONS entre as duas capturas mais recentes (a mesma lista da tabela de revisões, em Auditar). */
  revisoes: AguaRevisaoCaptura[];
  /** Página e âncora dos números, repassadas à citação da ficha. */
  enderecoMedidas?: string;
}) {
  const idioma = useIdioma();
  const tx = useTx();
  const f = formatos(idioma);
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const tipo = v.rec as TipoRecorte;
  const padrao = useMemo(() => recortePadraoEna(entidades, tipo), [entidades, tipo]);
  const e = recorteEscolhido(entidades, tipo, v.ent || padrao, padrao);
  const doTipo = useMemo(() => entidades.filter((x) => x.tipo === tipo), [entidades, tipo]);
  const linhas = useMemo(() => linhasAfluencia(doTipo, idioma), [doTipo, idioma]);
  const itens = useMemo(() => itensPontosAfluencia(doTipo, idioma), [doTipo, idioma]);
  const colunas = useMemo(() => colunasAfluencia(idioma), [idioma]);
  const regioes = v.sms as Regiao[];
  const dados = useMemo(() => serie.map((p) => ({ ...p, ref100: 100 })), [serie]);
  const intervalo = v.de && v.ate ? { inicio: v.de, fim: v.ate } : null;
  const selecionar = (id: string | null) => id && definir({ ent: id === padrao ? "" : id });
  const inicio = serie[0]?.d;
  const fim = serie[serie.length - 1]?.d;
  const rotuloTipo = rotuloTipoRecorte(tipo, idioma);
  const pm = tx("% da MLT", "% of MLT");
  const semDado = tx("Recorte sem dado nesta publicação.", "Area with no data in this release.");

  return (
    <div className="space-y-6">
      <div className="grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <RespostaCurta id="p018" vivo veredito={e ? vereditoAfluencia(e, idioma) : semDado}>
          {e ? respostaAfluencia(e, idioma) : semDado}
        </RespostaCurta>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <AguaEscolha legenda={tx("Recorte", "Area")} opcoes={opcoesTipo(idioma)} valor={tipo} onEscolher={(x) => definir({ rec: x, ent: "" })} />
          <AguaLista
            rotulo={tipo === "subsistema" ? tx("Subsistema", "Subsystem") : tipo === "ree" ? "REE" : tx("Bacia", "Basin")}
            opcoes={doTipo.map((x) => ({ id: x.id, rotulo: x.rotulo }))}
            valor={e?.id ?? padrao}
            onEscolher={(x) => selecionar(x)}
          />
          <AguaRestaurar />
        </div>
      </div>

      <GraficoPontos
        titulo={tx(`ENA de 30 dias de cada recorte (${rotuloTipo}) e a mediana da mesma janela`, `30-day ENA of each area (${rotuloTipo}) and the median of the same window`)}
        itens={itens}
        unidade={pm}
        unidadeDiferenca={tx("p.p.", "pp")}
        casas={1}
        rotuloValor={tx("ENA de 30 dias", "30-day ENA")}
        rotuloReferencia={tx("Mediana da mesma janela nos anos da base", "Median of the same window in the baseline years")}
        corValor="var(--cor-energia)" // i18n: dado
        corReferencia="var(--serie-referencia)"
        selecionado={e?.id ?? null}
        onSelecionar={selecionar}
        ordemInicial={{ por: "valor", direcao: "desc" }} // i18n: dado
        chaveUrl="pts"
      />

      <AguaLegenda
        periodo={
          e ? tx(`30 dias até ${f.dataBR(e.dia)}; ${textoFaixaJanela(e, "pt")}`, `30 days through ${f.dataBR(e.dia)}; ${textoFaixaJanela(e, "en")}`) : tx("sem janela", "no window")
        }
        universo={universo(tipo, reeNovos, idioma)}
        unidade={tx(
          "% da MLT: a soma da ENA bruta dos 30 dias dividida pela soma da MLT vigente em cada dia (cada dia em MWmed, o megawatt médio, a potência média do dia). Percentil: a posição da ENA entre as dos mesmos dias de anos anteriores. p.p.: ponto percentual, a diferença entre dois percentuais",
          "% of MLT: the sum of the gross ENA over the 30 days divided by the sum of the MLT in force on each day (each day in MWavg, average megawatts, the average power over the day). Percentile: the position of the ENA among those of the same days in previous years. pp: percentage point, the difference between two percentages",
        )}
      />

      {e && <MedidasAfluencia e={e} revisoes={revisoes} evidencias={evidencias} endereco={enderecoMedidas} />}

      <AguaTabela
        titulo={tx(`Tabela equivalente: ENA de 30 dias, ${rotuloTipo}`, `Equivalent table: 30-day ENA, ${rotuloTipo}`)}
        colunas={colunas}
        linhas={linhas}
        chaveLinha="id"
        colunaRotulo="rotulo"
        fonte={fonte}
        versao={versao}
        nomeArquivo={`agua-afluencia-${tipo}`}
        selecionado={e?.id ?? null}
        onSelecionar={selecionar}
        chaveUrl="afl"
        recolher
        nota={tx<ReactNode>(
          "Sem ENA de 30 dias: falta ENA em algum dia da janela, ou não há MLT; os grupos “Outras do Sul” e “Outras do Sudeste”, que o ONS publica agrupados, não têm MLT. Com menos de 5 anos na base, não há faixa.",
          <>
            No 30-day ENA: ENA is missing on some day of the window, or there is no MLT; the groups “<Nome>Outras do Sul</Nome>” and “<Nome>Outras do Sudeste</Nome>”, which ONS
            publishes grouped, have no MLT. With fewer than 5 years in the baseline, there is no range.
          </>,
        )}
      />

      {notas}

      <SecaoDoPainel
        id="evolucao"
        titulo={
          inicio && fim
            ? tx(
                `Como a ENA de 30 dias evoluiu de ${f.mesAno(inicio.slice(0, 7))} a ${f.mesAno(fim.slice(0, 7))}?`,
                `How did the 30-day ENA evolve from ${f.mesAno(inicio.slice(0, 7))} to ${f.mesAno(fim.slice(0, 7))}?`,
              )
            : tx("Como a ENA de 30 dias evoluiu?", "How did the 30-day ENA evolve?")
        }
      >
        <Comparador
          rotulo={tx(`Regiões no gráfico (até ${LIMITE_COMPARACAO})`, `Regions in the chart (up to ${LIMITE_COMPARACAO})`)}
          entidades={REGIOES.map((r) => ({ id: r, rotulo: nomeRegiao(r, idioma), sinonimos: idioma === "en" ? [curtoRegiao(r, "en"), NOME_REGIAO[r], CURTO_REGIAO[r]] : [CURTO_REGIAO[r]] }))}
          selecionadas={regioes}
          onMudar={(ids) => definir({ sms: ids as Regiao[] })}
          dicaBusca={tx("Buscar, por exemplo SIN, Sul, Nordeste", "Search, for example SIN, South, Northeast")}
          vazio={tx("Nenhuma região escolhida. Escolha até quatro para ver a ENA de 30 dias na mesma escala.", "No region chosen. Choose up to four to see the 30-day ENA on the same scale.")}
        >
          {() => null}
        </Comparador>
        {regioes.length > 0 && (
          <GraficoLinhas
            titulo={tx(`ENA bruta de 30 dias em % da MLT, ${textoPasso(passoDias, "pt")}`, `30-day gross ENA in % of MLT, ${textoPasso(passoDias, "en")}`)}
            dados={dados}
            chaveX="d"
            series={[
              ...regioes.map((r) => ({ id: r, rotulo: nomeRegiao(r, idioma), sigla: curtoRegiao(r, idioma), cor: COR_REGIAO[r] })),
              { id: "ref100", rotulo: tx("100% da MLT", "100% of MLT"), cor: "var(--serie-referencia)", tracejada: true, espessura: 1 },
            ]}
            unidade={pm}
            casas={1}
            zoom
            intervalo={intervalo}
            onIntervalo={(i) => definir({ de: i?.inicio ?? "", ate: i?.fim ?? "" })}
          />
        )}
        <p className="text-sm text-carvao-muted">
          {tx(
            <>
              Cada ponto é a janela de 30 dias que termina naquele dia. A linha de 100% é a própria MLT, que muda de versão: em comparações longas, o percentual mistura
              versões da referência (a seção sobre a MLT, mais abaixo, e as comparações de Analisar tratam disso). A faixa usual de cada data, do 10º ao 90º percentil, não é
              publicada para esta série: só a da janela mais recente existe, no gráfico de pontos, na tabela e no texto, e o gráfico não diz se cada semana esteve fora do usual. A
              escolha das regiões é independente do recorte da figura principal: trocar uma não troca a outra.
            </>,
            <>
              Each point is the 30-day window ending on that day. The 100% line is the MLT itself, which changes version: in long comparisons, the percentage mixes versions of the
              reference (the section on the MLT, further down, and the comparisons under Analyze deal with this). The usual range for each date, from the 10th to the 90th percentile,
              is not published for this series: only that of the most recent window exists, in the dot chart, in the table and in the text, and the chart does not say whether each
              week was outside the usual. The choice of regions is independent of the area in the main figure: changing one does not change the other.
            </>,
          )}
        </p>
      </SecaoDoPainel>
    </div>
  );
}
