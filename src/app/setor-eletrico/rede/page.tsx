import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata, ResolvingMetadata } from "next";
import Link from "@/components/i18n/LinkIdioma";
import { ModeloDidatico, ParaLer } from "@/components/energia/Didatica";
import { HorasDoDia, type SerieHoras } from "@/components/energia/HorasDoDia";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { CursorSincronizado } from "@/components/energia/CursorSincronizado";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { Numero } from "@/components/energia/Numero";
import { RedeCirculacao } from "@/components/energia/RedeCirculacao";
import { RedeAviso, RedeCapitulos, RedeDatas, RedeIndisponivel, RedeRecorte, RedeRegras, RedeSeguir } from "@/components/energia/RedePagina";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { Unidade } from "@/components/evidencia/Unidade";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, horaLocal, mesAno, num, plural } from "@/lib/energia/formato";
import { gold, integra, lerGold } from "@/lib/energia/gold";
import { tx } from "@/lib/energia/idioma";
import {
  COR_PAR,
  FRONTEIRAS,
  PONTAS,
  colunasCobertura,
  colunasEsquemaNacional,
  colunasUltimoAno,
  curtoFronteira,
  entreFronteira,
  linhasCobertura,
  linhasEsquemaNacional,
  linhasUltimoAno,
  medidasFronteiras30d,
  nomeFronteira,
  nomeSm,
  paraTabela,
  perguntaPainel,
  provenienciaLegivel,
  rotaPainel,
  rotulosRegra,
  situacaoAtualidade,
  textoCobertura,
  textoConferenciaSilver,
  textoOrientacaoArquivos,
  textoSentidoSaldo,
} from "@/lib/energia/rede";
import { textoAmplitude, textoFluxos30d } from "@/lib/energia/resumos";
import type { ColunaTabela } from "@/lib/energia/tabela";
import type { SubsistemaOuSin, GoldRedeDetalhe, JanelaHorariaRede } from "@/lib/energia/tipos-rede";

export const dynamic = "force-static";
/** Descrição com o início do histórico lido da gold (nenhuma data escrita à mão). */
function metadadosDaPagina(): Metadata {
  const g = lerGold<GoldRedeDetalhe>("rede_detalhe.json");
  const inicio = integra(g) && g.circulacao.mensal.meses.length ? mesAno(g.circulacao.mensal.meses[0]) : null;
  const desde = inicio ? tx(` desde ${inicio}`, ` since ${inicio}`) : "";
  return {
    title: tx("Rede: como a energia circula entre as regiões", "Grid: how energy flows between regions"),
    description: tx(
      `Energia em cada sentido e saldo de cada fronteira entre subsistemas (ONS), por dia e por hora, com o programa e o PLD da mesma hora (CCEE), exportação e importação brutas por subsistema e histórico mensal${desde}.`,
      `Energy in each direction and net flow of each boundary between subsystems (ONS), by day and by hour, with the schedule and the PLD of the same hour (CCEE), gross exports and imports by subsystem and monthly history${desde}.`,
    ),
    alternates: { canonical: "/setor-eletrico/rede" },
  };
}

export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/rede", metadadosDaPagina(), anterior);
}

/** A janela horária publicada (a mesma que a escala Hora baixa no navegador), lida no servidor para o modelo didático; null se faltar. */
function lerJanelaHoraria(url: string): JanelaHorariaRede | null {
  try {
    const j = JSON.parse(readFileSync(join(process.cwd(), "public", url.replace(/^\/+/, "")), "utf-8")) as JanelaHorariaRede;
    return j?.disponivel && Array.isArray(j.horas) && j.horas.length ? j : null;
  } catch {
    return null;
  }
}

const fonteRede = () => tx("ONS, Intercâmbios Entre Subsistemas (releitura do módulo Rede)", "ONS, Interchanges Between Subsystems (Grid module re-read)");
const colunasSaldos = (): ColunaTabela[] => [
  { id: "nome", rotulo: tx("Subsistema", "Subsystem"), tipo: "texto" },
  { id: "dia", rotulo: tx("Saldo no dia (positivo = exporta)", "Net on the day (positive = exports)"), tipo: "numero", unidade: tx("MWmed", "MWavg"), casas: 0 }, // i18n: dado
  { id: "media_30d", rotulo: tx("Média de 30 dias", "30-day average"), tipo: "numero", unidade: tx("MWmed", "MWavg"), casas: 0 },
];

export default function RedePage() {
  const g = lerGold<GoldRedeDetalhe>("rede_detalhe.json");
  if (!integra(g)) return <RedeIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;
  const FONTE = fonteRede();
  const ROTULO_REGRA = rotulosRegra();
  const r = gold.rede();
  const pld = gold.pld();
  const c = g.circulacao;
  const ev = g.evidencias;
  const atual = situacaoAtualidade(g.referencia.dia, g.gerado_em);
  const versao = g.referencia.dia;
  const downloads = [
    ...g.downloads.filter((d) => /fronteiras_diario|subsistemas_diario|horario_20/.test(d.url)),
    { rotulo: tx("Janela horária de 7 dias (JSON)", "7-day hourly window (JSON)"), url: c.janela_horaria.url },
  ];
  const resumo = c.resumo_30d;
  const janela30 = resumo[0];
  // as mesmas linhas nos dois gráficos e na tabela equivalente do último ano
  const ultimoAno = integra(r) ? linhasUltimoAno(r.serie_fluxos, r.serie_amplitude_pld) : [];
  // a faixa da abertura lê o mesmo resumo de 30 dias do gráfico dos dois sentidos, da tabela e da exportação
  const medidas = medidasFronteiras30d(resumo);
  // abertura: a fronteira com o maior saldo em 30 dias, lida do mesmo resumo da faixa
  const maior = resumo.length ? resumo.reduce((x, y) => (Math.abs(y.liquido_mwh) > Math.abs(x.liquido_mwh) ? y : x)) : null;
  const maiorSentido = maior ? textoSentidoSaldo(maior.par, maior.liquido_mwh) : null;
  const comVolta = resumo.filter((x) => x.contra_saldo_mwh > 0).length;
  // artefato: a janela horária publicada (mesmo arquivo da escala Hora), por fronteira e dia, com as somas da gold diária
  const janelaHoraria = lerJanelaHoraria(c.janela_horaria.url);
  const seriesHoras: SerieHoras[] = janelaHoraria
    ? FRONTEIRAS.map((par) => {
        const [de, para] = PONTAS[par];
        const dias = [...new Set(janelaHoraria.horas.map((h) => h.slice(0, 10)))];
        return {
          id: par,
          rotulo: curtoFronteira(par),
          positivo: `${nomeSm(de)} → ${nomeSm(para)}`,
          negativo: `${nomeSm(para)} → ${nomeSm(de)}`,
          de: nomeSm(de),
          para: nomeSm(para),
          dias: dias.map((dia) => {
            const horas: (number | null)[] = Array.from({ length: 24 }, () => null);
            janelaHoraria.horas.forEach((h, i) => {
              if (h.startsWith(dia)) horas[Number(h.slice(11, 13))] = janelaHoraria.fluxo[par]?.[i] ?? null;
            });
            const k = c.diario.dias.indexOf(dia);
            const pp = c.diario.por_par[par];
            const totais = k >= 0 && pp.canonico_mwh[k] !== null && pp.inverso_mwh[k] !== null ? { positivo: pp.canonico_mwh[k] as number, negativo: pp.inverso_mwh[k] as number } : null;
            return { dia, horas, totais };
          }),
        };
      })
    : [];
  const ultimoDiaHoras = seriesHoras[0]?.dias[seriesHoras[0].dias.length - 1]?.dia;
  // fronteira inicial: a que mais escondeu energia no último dia da janela
  const kUltimo = ultimoDiaHoras ? c.diario.dias.indexOf(ultimoDiaHoras) : -1;
  const serieInicialHoras =
    kUltimo >= 0 ? FRONTEIRAS.reduce((x, y) => ((c.diario.por_par[y].contra_saldo_mwh[kUltimo] ?? 0) > (c.diario.por_par[x].contra_saldo_mwh[kUltimo] ?? 0) ? y : x)) : FRONTEIRAS[0];
  const fonteIntercambios = tx("ONS, Intercâmbios Entre Subsistemas", "ONS, Interchanges Between Subsystems");
  const fontePld = tx("ONS, Intercâmbios Entre Subsistemas; CCEE, PLD horário", "ONS, Interchanges Between Subsystems; CCEE, hourly PLD");
  const semFluxo30 = tx("Sem fluxo publicado na janela de 30 dias.", "No flow published in the 30-day window.");
  const oQueMudou = <>{atual.texto}</>;
  const comoInterpretar = tx(
    <>
      Cada fronteira tem um sentido positivo no nome (Norte → Nordeste, Norte → Sudeste/Centro-Oeste, Nordeste → Sudeste/Centro-Oeste e Sul → Sudeste/Centro-Oeste);
      saldo negativo é energia no sentido contrário. Energia escondida pelo saldo é o menor dos dois sentidos. Cada valor horário em MWmed vale a mesma quantidade em MWh. Na
      escala horária, o PLD de cada região é o da mesma hora do fluxo. O esquema mostra as fronteiras e o sentido, sem posição geográfica.
    </>,
    <>
      Each boundary has a positive direction in its name (North → Northeast, North → Southeast/Center-West, Northeast → Southeast/Center-West and South →
      Southeast/Center-West); a negative net flow is energy in the opposite direction. Energy hidden by the net flow is the smaller of the two directions. Each hourly value in
      MWavg equals the same quantity in MWh. On the hourly scale, the PLD of each region is that of the same hour as the flow. The schematic shows the boundaries and the
      direction, without geographic position.
    </>,
  );
  const naoConcluir = tx(
    <>
      Que alguma fronteira estava no limite ou congestionada: os limites operativos e as suas vigências não são públicos, e nem a espessura da seta nem a diferença de preço
      demonstram saturação. O fluxo de cada linha de transmissão também não é publicado: sentidos opostos em linhas diferentes da mesma fronteira, na mesma hora, não aparecem.
    </>,
    <>
      That any boundary was at its limit or congested: the operating limits and their validity periods are not public, and neither the arrow thickness nor the price difference
      shows saturation. The flow of each transmission line is not published either: opposite directions on different lines of the same boundary, in the same hour, do not
      appear.
    </>,
  );

  return (
    <>
      <header><CabecalhoPlataforma colecao="energia" destinoConta="/setor-eletrico" navegacao="setor-eletrico" idiomas /></header>
      <MarcaVisita secao="energia:rede" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          siglas={["SIN", "PLD", "ONS", "CCEE", "MWh", "MWmed"]}
          titulo={perguntaPainel("p028")}
          lead={
            maior && maiorSentido && janela30
              ? tx(
                  `Nos ${janela30.dias} dias até ${dataBR(janela30.fim)}, a maior entrega entre regiões foi ${maiorSentido}: ${num(Math.abs(maior.liquido_mwh), 0)} MWh de saldo. Em ${comVolta} das quatro fronteiras a energia também passou no sentido contrário, e o saldo mostra só a diferença entre os dois sentidos.`,
                  `Over the ${janela30.dias} days through ${dataBR(janela30.fim)}, the largest delivery between regions was ${maiorSentido}: ${num(Math.abs(maior.liquido_mwh), 0)} MWh of net flow. At ${comVolta} of the four boundaries energy also passed in the opposite direction, and the net flow shows only the difference between the two directions.`,
                )
              : tx(
                  "Para onde a energia foi em cada uma das quatro fronteiras entre subsistemas, e quanta passou em cada sentido. O saldo é só a diferença entre os dois sentidos.",
                  "Where energy went at each of the four boundaries between subsystems, and how much passed in each direction. The net flow is only the difference between the two directions.",
                )
          }
          recorte={tx(
            `${janela30 ? `${plural(janela30.dias, "dia", "dias")}, de ${dataBR(janela30.inicio)} a ${dataBR(janela30.fim)}` : "janela de 30 dias"} · quatro fronteiras · MWh e MWmed`,
            `${janela30 ? `${plural(janela30.dias, "day", "days")}, from ${dataBR(janela30.inicio)} to ${dataBR(janela30.fim)}` : "30-day window"} · four boundaries · MWh and MWavg`,
          )}
          fonte={fontePld}
          referencia={tx(
            <>
              ONS, intercâmbios entre subsistemas e com outros países, até {horaLocal(g.referencia.ultima_hora_fluxo)}; PLD horário da CCEE até{" "}
              {g.referencia.ultima_hora_pld ? horaLocal(g.referencia.ultima_hora_pld) : "sem dado"}. Processado em {carimbo(g.gerado_em)}.
            </>,
            <>
              ONS, interchanges between subsystems and with other countries, through {horaLocal(g.referencia.ultima_hora_fluxo)}; CCEE hourly PLD through{" "}
              {g.referencia.ultima_hora_pld ? horaLocal(g.referencia.ultima_hora_pld) : "no data"}. Processed on {carimbo(g.gerado_em)}.
            </>,
          )}
          datas={
            <RedeDatas
              itens={[
                {
                  rotulo: tx("Fluxo entre subsistemas", "Flow between subsystems"),
                  texto: tx(`até ${horaLocal(g.referencia.ultima_hora_fluxo)}`, `through ${horaLocal(g.referencia.ultima_hora_fluxo)}`),
                  natureza: g.proveniencia.fluxo.natureza,
                },
                {
                  rotulo: tx("PLD horário", "Hourly PLD"),
                  texto: g.referencia.ultima_hora_pld ? tx(`até ${horaLocal(g.referencia.ultima_hora_pld)}`, `through ${horaLocal(g.referencia.ultima_hora_pld)}`) : null,
                  natureza: g.proveniencia.pld_na_hora.natureza,
                },
                ...(integra(r)
                  ? [
                      {
                        rotulo: tx("Série diária do último ano", "Daily series for the last year"),
                        texto: tx(`até ${dataBR(r.dia_referencia)}`, `through ${dataBR(r.dia_referencia)}`),
                        natureza: r.proveniencia.fluxo.natureza,
                      },
                    ]
                  : []),
              ]}
            />
          }
          metricas={
            <FaixaMetricas
              colunas={4}
              rotulo={tx(
                `Saldo de cada fronteira em ${janela30 ? plural(janela30.dias, "dia", "dias") : "30 dias"}`,
                `Net flow of each boundary over ${janela30 ? plural(janela30.dias, "day", "days") : "30 days"}`,
              )}
              nota={tx(
                "O saldo é a diferença entre a energia que passou em cada sentido; abaixo de cada saldo, o que passou no sentido contrário. Saldo alto não indica fronteira no limite: os limites operativos não são públicos.",
                "The net flow is the difference between the energy that passed in each direction; below each net flow, what passed in the opposite direction. A high net flow does not indicate a boundary at its limit: the operating limits are not public.",
              )}
            >
              {medidas.map((m) => (
                <Numero
                  key={m.par}
                  variante="faixa"
                  rotulo={m.rotulo}
                  natureza="CALCULADO"
                  valor={m.valor}
                  formato="num"
                  casas={0}
                  unidade="MWh"
                  periodo={m.periodo}
                  cor={COR_PAR[m.par]}
                  nota={m.nota}
                  motivoAusencia={semFluxo30}
                />
              ))}
            </FaixaMetricas>
          }
        >
          {tx(
            <>
              A energia passa de uma região para outra pelas linhas de transmissão de fronteira. O ONS publica, hora a hora, o <Termo slug="intercambio">intercâmbio</Termo>{" "}
              verificado em quatro fronteiras entre <Termo slug="submercado">subsistemas</Termo> e, desde {dataBR(g.programado.inicio)}, também o programado. Os limites operativos
              de cada fronteira não são públicos; por isso nenhum painel diz que a rede estava no limite. Fluxo em <Unidade u="MWmed" />, energia em MWh; num valor horário, os dois
              números são iguais.
            </>,
            <>
              Energy passes from one region to another over the boundary transmission lines. ONS publishes, hour by hour, the verified{" "}
              <Termo slug="intercambio">interchange</Termo> at four boundaries between <Termo slug="submercado">subsystems</Termo> and, since {dataBR(g.programado.inicio)}, the
              scheduled one as well. The operating limits of each boundary are not public; that is why no panel says the grid was at its limit. Flow in <Unidade u="MWmed" />,
              energy in MWh; for an hourly value, the two numbers are equal.
            </>,
          )}
        </CabecalhoModulo>
        <ParaLer
          id="para-ler-rede"
          itens={[
            {
              termo: tx("Subsistema e fronteira", "Subsystem and boundary"),
              definicao: tx(
                <>
                  O ONS divide a rede interligada em quatro <Termo slug="submercado">subsistemas</Termo>: Sudeste/Centro-Oeste, Sul, Nordeste e Norte. Fronteira é o conjunto de
                  linhas de transmissão que liga dois deles; a página acompanha quatro fronteiras.
                </>,
                <>
                  ONS divides the interconnected grid into four <Termo slug="submercado">subsystems</Termo>: Southeast/Center-West, South, Northeast and North. A boundary is the set
                  of transmission lines linking two of them; the page follows four boundaries.
                </>,
              ),
            },
            {
              termo: <Termo slug="intercambio">{tx("Intercâmbio", "Interchange")}</Termo>,
              definicao: tx(
                "A energia que atravessa uma fronteira, medida pelo ONS hora a hora: é o que uma região manda para a outra quando gera mais do que consome naquela hora.",
                "The energy that crosses a boundary, measured by ONS hour by hour: it is what one region sends to another when it generates more than it consumes in that hour.",
              ),
            },
            {
              termo: tx("Fluxo bruto e saldo", "Gross flow and net flow"),
              definicao: tx(
                "Na mesma fronteira a energia pode ir num sentido em algumas horas e voltar em outras. Fluxo bruto é o total de cada sentido; saldo é a diferença entre eles. Um saldo pequeno pode esconder muita energia indo e voltando.",
                "At the same boundary, energy can go one way in some hours and come back in others. Gross flow is the total in each direction; net flow is the difference between them. A small net flow can hide a lot of energy going back and forth.",
              ),
              exemplo: (() => {
                const x = maior ? resumo.find((y) => y.contra_saldo_mwh === Math.max(...resumo.map((z) => z.contra_saldo_mwh))) : null;
                if (!x || x.contra_saldo_mwh <= 0 || !janela30) return undefined;
                const [a2, b2] = PONTAS[x.par];
                return tx(
                  `Em ${janela30.dias} dias, ${num(x.canonico_mwh, 0)} MWh foram do ${nomeSm(a2, "pt")} para o ${nomeSm(b2, "pt")} e ${num(x.inverso_mwh, 0)} MWh voltaram: saldo de ${num(Math.abs(x.liquido_mwh), 0)} MWh.`,
                  `Over ${janela30.dias} days, ${num(x.canonico_mwh, 0)} MWh went from the ${nomeSm(a2, "en")} to the ${nomeSm(b2, "en")} and ${num(x.inverso_mwh, 0)} MWh came back: a net flow of ${num(Math.abs(x.liquido_mwh), 0)} MWh.`,
                );
              })(),
            },
            {
              termo: tx("MWmed e MWh numa hora", "MWavg and MWh in one hour"),
              definicao: tx(
                <>
                  O fluxo de cada hora vem em <Unidade u="MWmed" />, a potência média da hora. Durante uma hora, 1 MWmed entrega 1 MWh: por isso o valor horário é o mesmo número
                  nas duas unidades, e a energia do dia é a soma das 24 horas.
                </>,
                <>
                  The flow of each hour comes in <Unidade u="MWmed" />, the average power of the hour. Over one hour, 1 MWavg delivers 1 MWh: that is why the hourly value is the
                  same number in both units, and the day&apos;s energy is the sum of the 24 hours.
                </>,
              ),
            },
            {
              termo: tx("Sentido do nome", "Direction of the name"),
              definicao: tx(
                "Cada fronteira tem um sentido de referência no nome (Norte → Nordeste, Norte → Sudeste/Centro-Oeste, Nordeste → Sudeste/Centro-Oeste, Sul → Sudeste/Centro-Oeste). Valor positivo é energia nesse sentido; negativo, no contrário. O nome não diz para onde a energia foi: os cartões dizem.",
                "Each boundary has a reference direction in its name (North → Northeast, North → Southeast/Center-West, Northeast → Southeast/Center-West, South → Southeast/Center-West). A positive value is energy in that direction; negative, in the opposite one. The name does not say where energy went: the cards do.",
              ),
            },
            {
              termo: tx("Limite de transmissão", "Transmission limit"),
              definicao: tx(
                <>
                  Cada fronteira tem um limite operativo de quanto pode passar, que muda com a configuração da rede. O ONS não publica esses limites em dados abertos, então nenhuma
                  página diz se a fronteira estava no limite; o que se sabe sobre restrições está em{" "}
                  <Link href={rotaPainel("p030")} className="text-energia-dark underline underline-offset-4">
                    Restrições publicadas
                  </Link>
                  .
                </>,
                <>
                  Each boundary has an operating limit on how much can pass, which changes with the grid configuration. ONS does not publish these limits as open data, so no page says
                  whether the boundary was at its limit; what is known about constraints is on{" "}
                  <Link href={rotaPainel("p030")} className="text-energia-dark underline underline-offset-4">
                    Published restrictions
                  </Link>
                  .
                </>,
              ),
            },
          ]}
        />
        <ModoProfundidade>
          <Bloco id="circulacao">
            <PainelEvidencia
              id="p028"
              pergunta={tx("O saldo de cada fronteira, por dia e por hora", "The net flow of each boundary, by day and by hour")}
              subtitulo={tx(
                "Energia em cada sentido, saldo por fronteira e subsistema, por dia e por hora · MWh e MWmed",
                "Energy in each direction, net flow by boundary and subsystem, by day and by hour · MWh and MWavg",
              )}
              natureza="CALCULADO"
              porQueImporta={tx(
                <>
                  O saldo de um dia diz para onde a energia foi no total; a energia em cada sentido mostra quanto passou nos dois sentidos ao longo das horas. Um saldo pequeno
                  pode esconder muita energia indo e voltando, e é isso que separa uma fronteira de fluxo estável de uma que muda de sentido.
                </>,
                <>
                  The net flow of a day says where energy went in total; the energy in each direction shows how much passed both ways over the hours. A small net flow can hide a
                  lot of energy going back and forth, and that is what separates a boundary with stable flow from one that changes direction.
                </>,
              )}
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={provenienciaLegivel(g.proveniencia.fluxo)}
              complementares={[
                { rotulo: tx("Exportação e importação por subsistema", "Exports and imports by subsystem"), p: provenienciaLegivel(g.proveniencia.subsistemas) },
                { rotulo: tx("PLD nas duas pontas na mesma hora", "PLD at both ends in the same hour"), p: provenienciaLegivel(g.proveniencia.pld_na_hora) },
              ]}
            >
              <div className="space-y-6">
                {atual.defasada && <RedeAviso tipo="alerta">{atual.texto}</RedeAviso>}
                <RedeCirculacao
                  circulacao={{ diario: c.diario, resumo_30d: c.resumo_30d, mensal: c.mensal, subsistemas_diario: c.subsistemas_diario, janela_horaria: c.janela_horaria }}
                  fonte={FONTE}
                  versao={versao}
                  notas={<NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />}
                  aposPrincipal={
                    <>
                      {seriesHoras.length > 0 && (
                        <ModeloDidatico
                          id="ida-e-volta"
                          nivelTitulo={3}
                          titulo={tx("Ida e volta numa fronteira: o fluxo hora a hora e o saldo do dia", "There and back at a boundary: the flow hour by hour and the day's net flow")}
                          intro={tx(
                            <>
                              Cada barra é uma hora de um dia real. Acima do zero, a energia foi no sentido do nome da fronteira; abaixo, no contrário. Some as barras de cima e as de
                              baixo: são a energia de cada sentido. O saldo do dia é a diferença entre as duas somas, e o menor dos dois sentidos é a energia que o saldo esconde.
                            </>,
                            <>
                              Each bar is one hour of a real day. Above zero, energy went in the direction of the boundary&apos;s name; below, in the opposite direction. Add up the
                              bars above and those below: they are the energy in each direction. The day&apos;s net flow is the difference between the two sums, and the smaller of the
                              two directions is the energy the net flow hides.
                            </>,
                          )}
                          deixaDeFora={[
                            tx(
                              "Cada fronteira soma várias linhas de transmissão: se, na mesma hora, uma linha leva energia para um lado e outra para o outro, as duas se anulam antes de chegar a este número.",
                              "Each boundary adds up several transmission lines: if, in the same hour, one line carries energy one way and another the other way, they cancel out before reaching this figure.",
                            ),
                            tx(
                              "O limite de cada fronteira não é público: a altura da barra não diz quão perto do limite a fronteira estava.",
                              "Each boundary's limit is not public: the height of the bar does not say how close to the limit the boundary was.",
                            ),
                            tx(
                              "Não mostra por que a energia mudou de sentido (carga, chuva, vento, sol ou decisão de operação); a página não atribui causa.",
                              "It does not show why energy changed direction (load, rain, wind, sun or an operating decision); the page does not attribute a cause.",
                            ),
                          ]}
                          fonte={tx(
                            `ONS, Intercâmbios Entre Subsistemas, ${seriesHoras[0].dias.length} dias, de ${dataBR(seriesHoras[0].dias[0].dia)} a ${dataBR(seriesHoras[0].dias[seriesHoras[0].dias.length - 1].dia)}, hora a hora; as somas de cada sentido são as da série diária desta página.`,
                            `ONS, Interchanges Between Subsystems, ${seriesHoras[0].dias.length} days, from ${dataBR(seriesHoras[0].dias[0].dia)} to ${dataBR(seriesHoras[0].dias[seriesHoras[0].dias.length - 1].dia)}, hour by hour; the sums of each direction are those of this page's daily series.`,
                          )}
                        >
                          <HorasDoDia id="rede-horas" modo="fluxo" series={seriesHoras} serieInicial={serieInicialHoras} rotuloSerie={tx("Fronteira", "Boundary")} />
                        </ModeloDidatico>
                      )}
                      <RedeCapitulos />
                    </>
                  }
                  escondida={
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {FRONTEIRAS.map((par) => (
                        <Numero
                          key={par}
                          // a fronteira sem sentido no rótulo ("entre Norte e Nordeste"): o sentido do saldo vem na nota, para o nome não parecer o sentido do fluxo
                          rotulo={tx(`Energia escondida pelo saldo de 30 dias, ${entreFronteira(par, "pt")}`, `Energy hidden by the 30-day net flow, ${entreFronteira(par, "en")}`)}
                          natureza="CALCULADO"
                          evidencia={ev[`contra_saldo_30d.${par}`] ?? null}
                          casas={0}
                          tamanho="medio"
                          cor={COR_PAR[par]}
                          motivoAusencia={semFluxo30}
                          nota={(() => {
                            const x = resumo.find((y) => y.par === par);
                            if (!x) return undefined;
                            // o título usa o sentido do nome da fronteira; a nota diz o sentido que o saldo teve, para o zero não parecer ausência de fluxo
                            const sentido = textoSentidoSaldo(par, x.liquido_mwh);
                            const contra = x.liquido_mwh >= 0 ? x.horas_inverso : x.horas_canonico;
                            return contra === 0
                              ? tx(
                                  `Fluxo sempre ${sentido ?? "no mesmo sentido"} nas ${num(x.horas, 0)} horas: nada passou no sentido contrário.`,
                                  `Flow always ${sentido ?? "in the same direction"} over the ${num(x.horas, 0)} hours: nothing passed in the opposite direction.`,
                                )
                              : tx(
                                  `${num(contra, 0)} de ${num(x.horas, 0)} horas no sentido contrário ao saldo${sentido ? ` (saldo ${sentido})` : ""}.`,
                                  `${num(contra, 0)} of ${num(x.horas, 0)} hours in the direction opposite to the net flow${sentido ? ` (net flow ${sentido})` : ""}.`,
                                );
                          })()}
                          endereco={`${rotaPainel("p028")}#p028`}
                        />
                      ))}
                    </div>
                  }
                />

                <SecaoDoPainel id="p028-regras" nivel="auditar" titulo={tx("Regras de leitura publicadas com os dados", "Reading rules published with the data")}>
                  <RedeRegras
                    regras={(["orientacao", "energia", "bruto_liquido", "nulo", "pld", "limites"] as const).map((k) => ({ rotulo: ROTULO_REGRA[k], texto: g.regras[k] }))} // i18n: dado
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="p028-fonte" nivel="auditar" titulo={tx("Como cada arquivo anual do ONS publica as fronteiras", "How each annual ONS file publishes the boundaries")}>
                  <p className="text-sm text-carvao-muted">
                    {textoOrientacaoArquivos(g.esquema_fonte)}{" "}
                    {tx(
                      <>
                        O módulo converte cada linha para a orientação do nome da fronteira, verificado e programado com o mesmo
                        sinal. O dicionário do conjunto não descreve a mudança.
                      </>,
                      <>
                        The module converts each row to the orientation of the boundary name, verified and scheduled with the same sign. The dataset dictionary does not describe
                        the change.
                      </>,
                    )}
                  </p>
                  <TabelaInterativa
                    titulo={tx("Arquivos do conjunto Intercâmbios Entre Subsistemas", "Files of the Interchanges Between Subsystems dataset")}
                    colunas={colunasEsquemaNacional()}
                    linhas={paraTabela(linhasEsquemaNacional(g.esquema_fonte))}
                    chaveLinha="id"
                    colunaRotulo="recurso"
                    fonte={fonteIntercambios}
                    versao={versao}
                    nomeArquivo="rede-esquema-fonte"
                    chaveUrl="esq"
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="p028-cobertura" nivel="auditar" titulo={tx("Cobertura e conferência com o outro coletor", "Coverage and check against the other collector")}>
                  <p className="text-sm text-carvao-muted">{textoCobertura(tx("Fronteiras", "Boundaries"), g.cobertura.fronteiras, g.cobertura)}</p>
                  <TabelaInterativa
                    titulo={tx("Dias sem as 24 horas nas fronteiras", "Days without all 24 hours at the boundaries")}
                    colunas={colunasCobertura()}
                    linhas={paraTabela(linhasCobertura(g.cobertura.fronteiras))}
                    chaveLinha="id"
                    colunaRotulo="dia" // i18n: dado
                    fonte={fonteIntercambios}
                    versao={versao}
                    nomeArquivo="rede-cobertura-fronteiras"
                    chaveUrl="cob"
                    semLinhas={tx("Todos os dias têm as 24 horas nas quatro fronteiras.", "Every day has all 24 hours at the four boundaries.")}
                  />
                  <p className="text-sm text-carvao-muted">{textoConferenciaSilver(tx("Fronteiras", "Boundaries"), g.conferencia_silver_principal?.ons_rede_intercambio_nacional)}</p>
                </SecaoDoPainel>

                <RedeSeguir ancora="p028" proximo={{ href: `${rotaPainel("p029")}#p029`, pergunta: perguntaPainel("p029") }} downloads={downloads} />
              </div>
            </PainelEvidencia>
          </Bloco>

          {integra(r) && (
            <Bloco id="ultimo-ano" nivel="analisar">
              <PainelEvidencia
                id="fluxo-e-preco"
                pergunta={tx(
                  "Como o fluxo diário e a diferença entre os preços evoluíram no último ano?",
                  "How have the daily flow and the difference between prices evolved over the last year?",
                )}
                subtitulo={tx(
                  `Fluxo médio diário por fronteira (MWmed) e diferença entre o maior e o menor PLD médio diário (R$/MWh), até ${dataBR(r.dia_referencia)}`,
                  `Average daily flow by boundary (MWavg) and difference between the highest and the lowest daily average PLD (R$/MWh), through ${dataBR(r.dia_referencia)}`,
                )}
                natureza="CALCULADO"
                porQueImporta={tx(
                  <>
                    Um ano de dias mostra como o sentido e o volume dos fluxos variam ao longo das estações e em que dias os preços médios das regiões se separaram, no
                    mesmo eixo de datas. A página não atribui essas variações a causas.
                  </>,
                  <>
                    A year of days shows how the direction and volume of the flows vary across the seasons and on which days the average prices of the regions diverged, on the
                    same date axis. The page does not attribute these variations to causes.
                  </>,
                )}
                oQueMudou={
                  <>
                    {textoFluxos30d(r)} {textoAmplitude(r.resumo_amplitude)}
                  </>
                }
                comoInterpretar={tx(
                  <>
                    Os dois gráficos têm o mesmo eixo de dias e a mesma cruz. A diferença de preço usa o PLD médio de cada dia: separações de poucas horas podem sumir na
                    média, e a escala horária do painel acima mostra o preço da mesma hora. A tabela traz também o saldo de cada região no balanço de energia do ONS no último dia.
                  </>,
                  <>
                    The two charts share the same day axis and the same crosshair. The price difference uses the average PLD of each day: separations of a few hours can vanish in
                    the average, and the hourly scale of the panel above shows the price of the same hour. The table also shows the net flow of each region in the ONS energy
                    balance on the last day.
                  </>,
                )}
                naoConcluir={tx(
                  <>Qual fronteira causou a separação de preços, nem se alguma estava no limite: os limites operativos não são públicos.</>,
                  <>Which boundary caused the price separation, or whether any was at its limit: the operating limits are not public.</>,
                )}
                proveniencia={r.proveniencia.fluxo}
                complementares={[
                  { rotulo: tx("Diferença entre o maior e o menor PLD médio diário", "Difference between the highest and the lowest daily average PLD"), p: r.proveniencia.amplitude },
                  ...(integra(pld) ? [{ rotulo: tx("Sobre o PLD médio diário", "About the daily average PLD"), p: pld.proveniencia.diario }] : []),
                  ...(r.proveniencia.saldos ? [{ rotulo: tx("Saldo de cada região no balanço do ONS", "Net flow of each region in the ONS balance"), p: r.proveniencia.saldos }] : []),
                ]}
              >
                <div className="space-y-6">
                  <RedeAviso>
                    {tx(
                      <>
                        Série da rotina diária de operação do observatório (outro coletor), com referência até {dataBR(r.dia_referencia)} para o fluxo e até{" "}
                        {dataBR(r.ultimo_dia_pld)} para o PLD; o painel acima usa a releitura do módulo, até {dataBR(g.referencia.dia)}.
                      </>,
                      <>
                        Series from the observatory&apos;s daily operations routine (another collector), with reference through {dataBR(r.dia_referencia)} for the flow and through{" "}
                        {dataBR(r.ultimo_dia_pld)} for the PLD; the panel above uses the module re-read, through {dataBR(g.referencia.dia)}.
                      </>,
                    )}
                  </RedeAviso>
                  <RedeRecorte
                    periodo={
                      ultimoAno.length
                        ? tx(
                            `${dataBR(ultimoAno[0].d)} a ${dataBR(ultimoAno[ultimoAno.length - 1].d)}, por dia`,
                            `${dataBR(ultimoAno[0].d)} to ${dataBR(ultimoAno[ultimoAno.length - 1].d)}, by day`,
                          )
                        : tx("sem dias publicados", "no days published")
                    }
                    universo={tx(
                      "As quatro fronteiras entre subsistemas (fluxo) e os quatro submercados (PLD)",
                      "The four boundaries between subsystems (flow) and the four submarkets (PLD)",
                    )}
                    unidade={tx(
                      "MWmed (fluxo médio do dia); R$/MWh (diferença entre PLDs médios do dia)",
                      "MWavg (average flow of the day); R$/MWh (difference between daily average PLDs)",
                    )}
                  />
                  <CursorSincronizado>
                    <GraficoLinhas
                      titulo={tx("Fluxo médio diário por fronteira (positivo no sentido do nome)", "Average daily flow by boundary (positive in the direction of the name)")}
                      dados={ultimoAno}
                      chaveX="d"
                      formatoX="data"
                      series={FRONTEIRAS.map((p) => ({ id: p, rotulo: nomeFronteira(p), sigla: curtoFronteira(p), cor: COR_PAR[p] }))}
                      unidade={tx("MWmed", "MWavg")}
                      casas={0}
                      zeroNoEixo
                      legendaInterativa
                    />
                    <GraficoLinhas
                      titulo={tx(
                        "Diferença entre o maior e o menor PLD médio diário dos quatro submercados",
                        "Difference between the highest and the lowest daily average PLD of the four submarkets",
                      )}
                      dados={ultimoAno}
                      chaveX="d"
                      formatoX="data"
                      series={[{ id: "amplitude", rotulo: tx("Maior menos menor PLD médio", "Highest minus lowest average PLD"), cor: "var(--cor-energia)" }]} // i18n: dado
                      unidade="R$/MWh"
                      casas={2}
                      zeroNoEixo
                    />
                  </CursorSincronizado>
                  <TabelaInterativa
                    titulo={tx("Tabela equivalente: fluxo médio e diferença de preço por dia", "Equivalent table: average flow and price difference by day")}
                    colunas={colunasUltimoAno()}
                    linhas={paraTabela(ultimoAno)}
                    chaveLinha="id"
                    colunaRotulo="d"
                    fonte={fontePld}
                    versao={r.dia_referencia}
                    nomeArquivo="rede-fluxo-e-preco-ultimo-ano"
                    chaveUrl="ano" // i18n: dado
                    ordemInicial={{ coluna: "d", direcao: "desc" }}
                  />
                  <TabelaInterativa
                    titulo={tx(
                      `Saldo de cada região no balanço de energia do ONS em ${dataBR(r.dia_referencia_liquido)}`,
                      `Net flow of each region in the ONS energy balance on ${dataBR(r.dia_referencia_liquido)}`,
                    )}
                    colunas={colunasSaldos()}
                    linhas={r.liquido_subsistemas.map((l) => ({
                      id: l.sm,
                      nome: l.sm in { SE: 1, S: 1, NE: 1, N: 1, SIN: 1 } ? nomeSm(l.sm as SubsistemaOuSin) : l.nome,
                      dia: l.dia,
                      media_30d: l.media_30d,
                    }))}
                    chaveLinha="id"
                    colunaRotulo="nome"
                    fonte={tx("ONS, Balanço de Energia nos Subsistemas", "ONS, Energy Balance in the Subsystems")}
                    versao={r.dia_referencia_liquido ?? r.dia_referencia}
                    nomeArquivo="rede-saldos-balanco"
                    chaveUrl="sal"
                    nota={tx(
                      "O saldo do balanço é conferido hora a hora com as fronteiras e o exterior no painel Balanço e exterior.",
                      "The balance net flow is checked hour by hour against the boundaries and the exterior in the Balance and exterior panel.",
                    )}
                  />
                </div>
              </PainelEvidencia>
            </Bloco>
          )}
        </ModoProfundidade>
      </main>
    </>
  );
}
