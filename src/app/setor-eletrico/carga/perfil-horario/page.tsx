import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { CargaDatas, CargaFontes, CargaIndisponivel, CargaNavegacao, CargaSeguir } from "@/components/energia/CargaPagina";
import { CargaPerfil } from "@/components/energia/CargaPerfil";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { Numero } from "@/components/energia/Numero";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { SeloNatureza, textoNatureza } from "@/components/evidencia/SeloNatureza";
import { Termo } from "@/components/evidencia/Termo";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import {
  entreHoras,
  nomeRegiao,
  perguntaPainel,
  picoModalDoAno,
  rotaPainel,
  rotuloHora,
  semTiposDeGeracao,
  separaCampoDaSerie,
  situacaoAtualidade,
  textoAtualidadeHoraria,
  textoDiferencaHoraria,
  textoGlobalContraDiaria,
} from "@/lib/energia/carga";
import { carimbo, dataBR, num, plural } from "@/lib/energia/formato";
import { gold, integra, lerGold } from "@/lib/energia/gold";
import { COMPONENTE_API_CARGA_EN, SERIE_API_CARGA_EN, rotuloDaGold } from "@/lib/energia/i18n/agua-carga-rede";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import type { ColunaTabela } from "@/lib/energia/tabela";
import type { Natureza } from "@/lib/energia/tipos";
import type { CargaDetalheGold } from "@/lib/energia/tipos-carga";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/carga/perfil-horario", {
    title: tx("Carga: MMGD e perfil horário", "Load: MMGD and hourly profile"),
    description: tx(
      "Curva de carga horária do ONS, hora do pico por ano, perfil típico por mês e tipo de dia e a decomposição da carga verificada em carga global, MMGD estimada e carga líquida de MMGD, sem misturar os dois produtos do ONS.",
      "ONS hourly load curve, peak hour by year, typical profile by month and type of day and the breakdown of the verified load into global load, estimated MMGD and load net of MMGD, without mixing the two ONS products.",
    ),
    alternates: { canonical: "/setor-eletrico/carga/perfil-horario" },
  }, anterior);
}

const fonteCurva = () => tx("ONS, Curva de Carga Horária", "ONS, Hourly Load Curve");
const fonteApi = () => tx("ONS, Carga de Energia Verificada (API)", "ONS, Verified Energy Load (API)");

const rotuloConceito = (): Record<string, string> => ({
  carga_curva: tx("Carga da curva horária", "Load in the hourly curve"),
  carga_global: tx("Carga global", "Global load"),
  mmgd: "MMGD",
  carga_liquida: tx("Carga líquida de MMGD", "Load net of MMGD"),
  dupla_contagem: tx("Por que não somar nem subtrair", "Why not add or subtract"),
});

const colunasCompatAno = (): ColunaTabela[] => [
  { id: "regiao", rotulo: tx("Região", "Region"), tipo: "texto", categorica: true },
  { id: "ano", rotulo: tx("Ano", "Year"), tipo: "texto" }, // i18n: dado
  { id: "horas", rotulo: tx("Horas comparadas", "Hours compared"), tipo: "numero", casas: 0 },
  { id: "global_mwmed", rotulo: tx("Carga global (API)", "Global load (API)"), tipo: "numero", unidade: tx("MWmed", "MWavg"), casas: 0 },
  { id: "curva_mwmed", rotulo: tx("Curva de carga", "Load curve"), tipo: "numero", unidade: tx("MWmed", "MWavg"), casas: 0 },
  { id: "diferenca_pct", rotulo: tx("Global acima da curva", "Global above the curve"), tipo: "percentual", casas: 2 },
];
const colunasCompatHora = (): ColunaTabela[] => [
  { id: "hora", rotulo: tx("Hora (início)", "Hour (start)"), tipo: "numero", casas: 0 },
  { id: "horas", rotulo: tx("Horas comparadas", "Hours compared"), tipo: "numero", casas: 0 },
  { id: "diferenca_mwmed", rotulo: tx("Global menos curva", "Global minus curve"), tipo: "numero", unidade: tx("MWmed", "MWavg"), casas: 0 },
  { id: "diferenca_pct", rotulo: tx("Global acima da curva", "Global above the curve"), tipo: "percentual", casas: 2 },
];
const colunasA11 = (): ColunaTabela[] => [
  { id: "d", rotulo: tx("Dia", "Day"), tipo: "data" },
  { id: "carga_menos_global", rotulo: tx("Carga diária menos carga global (API)", "Daily load minus global load (API)"), tipo: "numero", unidade: tx("MWmed", "MWavg"), casas: 0 },
  { id: "meio_dia_curva_menos_global", rotulo: tx("Curva menos carga global às 12h", "Curve minus global load at 12:00"), tipo: "numero", unidade: tx("MWmed", "MWavg"), casas: 0 },
  { id: "mmgd_meio_dia", rotulo: tx("MMGD da API às 12h", "API MMGD at 12:00"), tipo: "numero", unidade: tx("MWmed", "MWavg"), casas: 0 },
  { id: "solar_balanco", rotulo: tx("Geração solar do balanço", "Solar generation in the balance"), tipo: "numero", unidade: tx("MWmed", "MWavg"), casas: 0 },
];

/** Natureza do componente em minúsculas, no idioma (o rótulo é o do selo de natureza). */
const naturezaMinuscula = (n: string) => tx(n.toLowerCase(), textoNatureza(n as Natureza, "en").rotulo.toLowerCase());

export default function PerfilHorarioPage() {
  const g = lerGold<CargaDetalheGold>("carga_detalhe.json");
  if (!integra(g)) return <CargaIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const idioma = idiomaEnergia();
  const FONTE_CURVA = fonteCurva();
  const FONTE_API = fonteApi();
  const ROTULO_CONCEITO = rotuloConceito();
  const p = g.p026;
  const a11 = g.a11_carga;
  const ev = g.evidencias;
  const atual = situacaoAtualidade(p.ultimo_dia, g.gerado_em);
  const natSeries = g.proveniencia.api.natureza_por_serie;
  const ultimoAno = p.compatibilidade.por_ano.filter((x) => x.sm === "SIN").at(-1);
  const downloads = g.downloads.filter((d) => /horaria|pico|perfil|verificada/.test(d.url));
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- campos retirados do que vai ao cliente
  const { compatibilidade: _c, conceitos: _k, ...p026Cliente } = p;
  // hora do pico do dia provado na ficha, lida da mesma série de picos (nunca do texto da ficha)
  const picoEv = p.picos_90d.find((x) => x.d === ev.p026_pico_sin?.periodo?.fim && x.hora !== null) ?? null;
  // hora em que o pico do dia caiu mais vezes no último ano, lida das mesmas contagens do mapa de calor
  const modal = picoModalDoAno(p, "SIN");
  // a ficha prova o pico do dia que ela escolheu; se a série vai além dele, o último dia publicado e o pico dele ficam ditos junto do cartão
  const ultimoPico = p.picos_90d.length ? p.picos_90d[p.picos_90d.length - 1] : null;
  const alemDaFicha = picoEv && ultimoPico && ultimoPico.d > picoEv.d && ultimoPico.hora !== null ? ultimoPico : null;
  // onde a carga global da API se afasta da curva, lido da tabela por hora (nunca escrito à mão)
  const porHora = p.compatibilidade.por_hora_sin_365d;
  const diferencaCurva = textoDiferencaHoraria(porHora);
  // média mensal da carga global (carga verificada) ao lado da Carga de Energia Diária da página Carga, o outro produto do ONS
  const diaria = gold.carga();
  const globalContraDiaria = integra(diaria) ? textoGlobalContraDiaria(p, diaria.mensal) : "";
  const oQueMudou = (
    <>
      {atual.texto} {textoAtualidadeHoraria(p)}
    </>
  );
  const comoInterpretar = tx(
    <>
      Carga global, MMGD e carga líquida vêm da mesma API e fecham por identidade da fonte (global = líquida + MMGD, conferida em cada meia hora). A curva de carga é
      outro produto, que já inclui uma MMGD estimada sem separá-la; ela aparece em gráfico próprio, alinhado pelo cursor. Hora é a hora local de início; o pico é o
      maior valor horário do dia (empate: a primeira hora). Dia sem as 24 horas não tem pico.
    </>,
    <>
      Global load, MMGD and net load come from the same API and close by an identity of the source (global = net + MMGD, checked every half hour). The load curve is
      another product, which already includes an estimated MMGD without separating it; it appears in its own chart, aligned by the cursor. Hour is the local start hour;
      the peak is the highest hourly value of the day (tie: the first hour). A day without all 24 hours has no peak.
    </>,
  );
  const naoConcluir = tx(
    <>
      A MMGD é estimativa do ONS, não medição: a micro e minigeração não é supervisionada. A parcela de MMGD dentro da curva e da carga diária não é publicada, então
      não se sabe quanto do pico da curva é MMGD. A carga global da API não substitui a curva{diferencaCurva ? ` (${diferencaCurva})` : ""}.
    </>,
    <>
      MMGD is an ONS estimate, not a measurement: micro and mini distributed generation is not supervised. The MMGD share inside the curve and the daily load is not
      published, so it is not known how much of the curve peak is MMGD. The API global load does not replace the curve{diferencaCurva ? ` (${diferencaCurva})` : ""}.
    </>,
  );

  return (
    <>
      <CabecalhoEnergia atual="carga" />
      <MarcaVisita secao="energia:carga" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          rotulo={tx("Carga · MMGD e perfil horário", "Load · MMGD and hourly profile")}
          siglas={["MWmed", "MMGD", "SIN", "ONS", "CCEE"]}
          titulo={perguntaPainel("p026")}
          lead={tx(
            "A que horas a carga chega ao pico e quanto dela o ONS estima como micro e minigeração distribuída (MMGD). Os dois produtos de carga do ONS têm definições diferentes.",
            "At what time the load reaches its peak and how much of it ONS estimates as micro and mini distributed generation (MMGD). The two ONS load products have different definitions.",
          )}
          recorte={tx(`hora a hora até ${dataBR(p.ultimo_dia)} · SIN e subsistemas · MWmed e %`, `hour by hour through ${dataBR(p.ultimo_dia)} · SIN and subsystems · MWavg and %`)}
          fonte={tx("ONS, Curva de Carga Horária e Carga de Energia Verificada", "ONS, Hourly Load Curve and Verified Energy Load")}
          referencia={tx(
            <>
              ONS, Curva de Carga Horária e Carga de Energia Verificada, até {dataBR(p.ultimo_dia)}; processado em {carimbo(g.gerado_em)}.
            </>,
            <>
              ONS, Hourly Load Curve and Verified Energy Load, through {dataBR(p.ultimo_dia)}; processed on {carimbo(g.gerado_em)}.
            </>,
          )}
          datas={
            <CargaDatas
              itens={[
                { rotulo: tx("Curva de carga horária", "Hourly load curve"), dia: p.ultimo_dia_curva, natureza: "OBSERVADO" },
                { rotulo: tx("Carga verificada", "Verified load"), dia: p.ultimo_dia_api, natureza: "OBSERVADO" },
              ]}
            />
          }
          metricas={
            <FaixaMetricas
              colunas={3}
              rotulo={tx("Indicadores da MMGD e do pico no SIN", "MMGD and peak indicators in the SIN")}
              nota={tx("Valores do SIN, fixos: a região escolhida abaixo não os altera.", "SIN values, fixed: the region chosen below does not change them.")}
            >
              <Numero
                variante="faixa"
                rotulo={tx("Parcela da carga global do SIN atendida por MMGD, último mês completo", "Share of the SIN global load met by MMGD, last complete month")}
                natureza="ESTIMADO"
                evidencia={ev.p026_mmgd_mes}
                formato="pct"
                casas={1}
                cor="var(--serie-solar)"
                nota={tx("Estimativa do ONS sobre a carga global da carga verificada, não sobre a curva.", "ONS estimate on the global load of the verified load, not on the curve.")}
                endereco={`${rotaPainel("p026")}#p026`}
              />
              <Numero
                variante="faixa"
                rotulo={tx("Pico horário da curva de carga do SIN no dia", "Hourly peak of the SIN load curve on the day")}
                natureza="OBSERVADO"
                evidencia={ev.p026_pico_sin}
                casas={0}
                cor="var(--cor-energia-dark)"
                nota={
                  <>
                    {picoEv?.hora != null
                      ? tx(
                          `Às ${rotuloHora(picoEv.hora)} de ${dataBR(picoEv.d)}; a curva inclui MMGD estimada, não separada.`,
                          `At ${rotuloHora(picoEv.hora)} on ${dataBR(picoEv.d)}; the curve includes estimated MMGD, not separated.`,
                        )
                      : tx("Inclui MMGD estimada, não separada.", "Includes estimated MMGD, not separated.")}
                    {alemDaFicha
                      ? tx(
                          ` A série vai até ${dataBR(alemDaFicha.d)}, com pico de ${num(alemDaFicha.pico, 0)} MWmed às ${rotuloHora(alemDaFicha.hora as number)}.`,
                          ` The series runs through ${dataBR(alemDaFicha.d)}, with a peak of ${num(alemDaFicha.pico, 0)} MWavg at ${rotuloHora(alemDaFicha.hora as number)}.`,
                        )
                      : ""}
                  </>
                }
                endereco={`${rotaPainel("p026")}#p026`}
              />
              {modal && (
                <Numero
                  variante="faixa"
                  rotulo={tx(
                    `Dias de ${modal.ano} em que o pico da curva de carga do SIN caiu entre ${rotuloHora(modal.curva.hora)} e ${rotuloHora((modal.curva.hora + 1) % 24)}`,
                    `Days of ${modal.ano} on which the SIN load curve peak fell between ${rotuloHora(modal.curva.hora)} and ${rotuloHora((modal.curva.hora + 1) % 24)}`,
                  )}
                  natureza="CALCULADO"
                  valor={modal.curva.dias}
                  formato="num"
                  casas={0}
                  unidade={tx("dias", "days")}
                  periodo={tx(`de ${num(modal.dias, 0)} dias, até ${dataBR(p.ultimo_dia_curva)}`, `of ${num(modal.dias, 0)} days, through ${dataBR(p.ultimo_dia_curva)}`)}
                  cor="var(--cor-energia)"
                  nota={
                    modal.liquida
                      ? tx(
                          `Na carga líquida de MMGD: ${plural(modal.liquida.dias, "dia", "dias")} ${entreHoras(modal.liquida.hora)}.`,
                          `In the load net of MMGD: ${plural(modal.liquida.dias, "day", "days")} ${entreHoras(modal.liquida.hora)}.`,
                        )
                      : undefined
                  }
                />
              )}
            </FaixaMetricas>
          }
        >
          {tx(
            <>
              A que horas o sistema demanda mais energia, e quanto da carga é atendido por micro e minigeração distribuída (<Termo slug="geracao-distribuida">MMGD</Termo>),
              segundo a estimativa do ONS. O ONS publica dois produtos de carga com definições diferentes: a <Termo slug="curva-de-carga">curva de carga horária</Termo> e a
              carga verificada, com a <Termo slug="carga-global">carga global</Termo> e a <Termo slug="carga-liquida-de-mmgd">carga líquida de MMGD</Termo>. Esta página mostra os
              dois lado a lado e nunca soma nem subtrai um do outro.
            </>,
            <>
              At what time the system demands the most energy, and how much of the load is met by micro and mini distributed generation (
              <Termo slug="geracao-distribuida">MMGD</Termo>), according to the ONS estimate. ONS publishes two load products with different definitions: the{" "}
              <Termo slug="curva-de-carga">hourly load curve</Termo> and the verified load, with the <Termo slug="carga-global">global load</Termo> and the{" "}
              <Termo slug="carga-liquida-de-mmgd">load net of MMGD</Termo>. This page shows the two side by side and never adds or subtracts one from the other.
            </>,
          )}
        </CabecalhoModulo>
        <CargaNavegacao atual="p026" />
        <ModoProfundidade>
          <Bloco id="perfil">
            <PainelEvidencia
              id="p026"
              pergunta={tx("Um dia típico: carga global, MMGD e carga líquida", "A typical day: global load, MMGD and net load")}
              subtitulo={tx(
                "Carga horária da curva e da carga verificada; MMGD estimada e carga líquida de MMGD · MWmed e %",
                "Hourly load from the curve and from the verified load; estimated MMGD and load net of MMGD · MWavg and %",
              )}
              natureza="OBSERVADO"
              porQueImporta={tx(
                <>
                  A MMGD reduz a energia que o sistema precisa entregar nas horas de sol, e o pico da carga líquida se desloca para o começo da noite. Saber que parte da carga é
                  estimada evita ler a MMGD como medição.
                </>,
                <>
                  MMGD reduces the energy the system needs to deliver in the sunny hours, and the net load peak shifts to the early evening. Knowing which part of the load is
                  estimated avoids reading MMGD as a measurement.
                </>,
              )}
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={g.proveniencia.api}
              complementares={[{ rotulo: tx("Curva de carga horária", "Hourly load curve"), p: g.proveniencia.curva }]}
            >
              <div className="space-y-6">
                {atual.defasada && (
                  <p role="alert" className="border-l-2 border-aviso pl-3 text-sm text-carvao">
                    {atual.texto}
                  </p>
                )}
                <CargaPerfil
                  p026={p026Cliente}
                  fonteCurva={FONTE_CURVA}
                  fonteApi={FONTE_API}
                  versao={p.ultimo_dia}
                  regimes={g.regimes}
                  diferencaCurva={diferencaCurva}
                  globalContraDiaria={globalContraDiaria}
                  notas={<NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />}
                  aposNotas={
                    <SecaoDoPainel id="conceitos" titulo={tx("Que carga é cada série?", "Which load is each series?")}>
                      <dl className="grid gap-3 text-sm md:grid-cols-2" data-conceitos="p026">
                        {Object.entries(p.conceitos).map(([k, texto]) => {
                          const { texto: leitura, tipos } = semTiposDeGeracao(texto);
                          return (
                            <div key={k} className="border-l-2 border-linha pl-3">
                              <dt className="font-medium text-carvao">{ROTULO_CONCEITO[k] ?? k}</dt>
                              <dd className="mt-1 leading-relaxed text-carvao-muted">
                                <TrechoPortugues regiao="conceito da carga">{leitura}</TrechoPortugues>
                                {tipos.length > 0 && (
                                  <span data-nivel="analisar">
                                    {" "}
                                    {tx("Classes da fonte", "Source classes")}: <TrechoPortugues regiao="classes da fonte">{tipos.join("; ")}</TrechoPortugues>.
                                  </span>
                                )}
                              </dd>
                            </div>
                          );
                        })}
                      </dl>
                      <ul className="space-y-2 text-sm text-carvao-muted">
                        {natSeries.map((s) => {
                          const { nome, campo } = separaCampoDaSerie(s.rotulo);
                          const { texto: leitura, tipos } = semTiposDeGeracao(s.descricao);
                          const componentes = s.componentes
                            .map((c) => `${rotuloDaGold(COMPONENTE_API_CARGA_EN, c.descricao, idioma)} (${naturezaMinuscula(c.natureza)})`)
                            .join("; ");
                          return (
                            <li key={s.serie} className="flex flex-wrap items-center gap-2">
                              <SeloNatureza natureza={s.natureza} />
                              <span>
                                <span className="text-carvao">{rotuloDaGold(SERIE_API_CARGA_EN, nome, idioma)}</span>
                                {campo && (
                                  <span data-nivel="analisar">
                                    {" "}
                                    ({tx("campo", "field")} {campo})
                                  </span>
                                )}
                                : <TrechoPortugues regiao="descrição da série da carga verificada">{leitura}</TrechoPortugues>
                                {s.componentes.length ? tx(` Componente: ${componentes}.`, ` Component: ${componentes}.`) : ""}
                                {tipos.length > 0 && (
                                  <span data-nivel="analisar">
                                    {" "}
                                    {tx("Classes da fonte", "Source classes")}: <TrechoPortugues regiao="classes da fonte">{tipos.join("; ")}</TrechoPortugues>.
                                  </span>
                                )}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </SecaoDoPainel>
                  }
                />

                <SecaoDoPainel
                  id="a11"
                  nivel="analisar"
                  titulo={tx(
                    `Quando a MMGD entrou na carga: declarada para ${dataBR(a11.declarado)}, observada nos dados em ${dataBR(a11.observado_carga)}`,
                    `When MMGD entered the load: declared for ${dataBR(a11.declarado)}, observed in the data on ${dataBR(a11.observado_carga)}`,
                  )}
                >
                  <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-carvao" data-textos="a11">
                    {a11.textos.map((t) => (
                      <li key={t}>
                        <TrechoPortugues regiao="achado A11 da carga">{t}</TrechoPortugues>
                      </li>
                    ))}
                  </ul>
                  <GraficoLinhas
                    titulo={tx(
                      "Degraus em torno da data declarada: carga menos carga global, às 12h e no dia",
                      "Steps around the declared date: load minus global load, at 12:00 and over the day",
                    )}
                    dados={a11.dias}
                    chaveX="d"
                    series={[
                      { id: "meio_dia_curva_menos_global", rotulo: tx("Curva menos carga global, às 12h", "Curve minus global load, at 12:00"), sigla: tx("12h", "12:00"), cor: "var(--cor-energia)" }, // i18n: dado
                      { id: "carga_menos_global", rotulo: tx("Carga diária menos carga global", "Daily load minus global load"), sigla: tx("Dia", "Day"), cor: "var(--serie-referencia)", tracejada: true },
                      { id: "mmgd_meio_dia", rotulo: tx("MMGD da API às 12h", "API MMGD at 12:00"), sigla: "MMGD", cor: "var(--serie-solar)" },
                    ]}
                    unidade={tx("MWmed", "MWavg")}
                    casas={0}
                    marcos={[
                      { x: a11.declarado, rotulo: tx(`declarada (${dataBR(a11.declarado)})`, `declared (${dataBR(a11.declarado)})`) },
                      ...(a11.observado_carga && a11.observado_carga !== a11.declarado
                        ? [{ x: a11.observado_carga, rotulo: tx(`observada (${dataBR(a11.observado_carga)})`, `observed (${dataBR(a11.observado_carga)})`) }]
                        : []),
                    ]}
                    legendaInterativa
                  />
                  <p className="text-sm text-carvao-muted">
                    {tx("Regra", "Rule")}: <TrechoPortugues regiao="regra do achado A11">{a11.regra}</TrechoPortugues>
                  </p>
                  <TabelaInterativa
                    titulo={tx("Tabela equivalente: as séries diárias em torno da data declarada", "Equivalent table: the daily series around the declared date")}
                    colunas={colunasA11()}
                    linhas={a11.dias.map((d) => ({ ...d, id: d.d }))}
                    chaveLinha="id"
                    colunaRotulo="d"
                    fonte={tx(
                      "ONS (carga diária, curva horária, carga verificada e balanço de energia)",
                      "ONS (daily load, hourly curve, verified load and energy balance)",
                    )}
                    versao={a11.declarado}
                    nomeArquivo="carga-a11-inclusao-mmgd"
                    chaveUrl="a11"
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="compatibilidade" nivel="auditar" titulo={tx("Compatibilidade entre a carga global da API e a curva", "Compatibility between the API global load and the curve")}>
                  <p className="text-sm text-carvao-muted">
                    <TrechoPortugues regiao="conclusão da compatibilidade">{p.compatibilidade.conclusao}</TrechoPortugues>
                    {ultimoAno && ultimoAno.diferenca_pct !== null
                      ? tx(
                          ` Em ${ultimoAno.ano}, no SIN, a carga global ficou ${num(Math.abs(ultimoAno.diferenca_pct), 2)}% ${ultimoAno.diferenca_pct >= 0 ? "acima" : "abaixo"} da curva nas mesmas ${num(ultimoAno.horas, 0)} horas.`,
                          ` In ${ultimoAno.ano}, in the SIN, the global load was ${num(Math.abs(ultimoAno.diferenca_pct), 2)}% ${ultimoAno.diferenca_pct >= 0 ? "above" : "below"} the curve over the same ${num(ultimoAno.horas, 0)} hours.`,
                        )
                      : ""}
                  </p>
                  <TabelaInterativa
                    titulo={tx("Carga global da API contra a curva, mesmas horas, por ano", "API global load against the curve, same hours, by year")}
                    colunas={colunasCompatAno()}
                    linhas={p.compatibilidade.por_ano.map((x) => ({ ...x, id: `${x.sm}:${x.ano}`, regiao: nomeRegiao(x.sm), ano: String(x.ano) }))}
                    chaveLinha="id"
                    colunaRotulo="ano" // i18n: dado
                    fonte={`${FONTE_API}; ${FONTE_CURVA}`}
                    versao={p.ultimo_dia}
                    nomeArquivo="carga-compatibilidade-anual"
                    chaveUrl="compat"
                  />
                  <TabelaInterativa
                    titulo={tx(
                      `SIN, últimos ${plural(Math.max(0, ...porHora.map((x) => x.horas)), "dia", "dias")}: diferença por hora do dia`,
                      `SIN, last ${plural(Math.max(0, ...porHora.map((x) => x.horas)), "day", "days")}: difference by hour of the day`,
                    )}
                    colunas={colunasCompatHora()}
                    linhas={p.compatibilidade.por_hora_sin_365d.map((x) => ({ ...x, id: String(x.hora) }))}
                    chaveLinha="id"
                    colunaRotulo="hora"
                    fonte={`${FONTE_API}; ${FONTE_CURVA}`}
                    versao={p.ultimo_dia}
                    nomeArquivo="carga-compatibilidade-hora"
                    chaveUrl="compath"
                  />
                  <CargaFontes fontes={g.fontes.filter((f) => f.id === "curva" || f.id === "api")} />
                </SecaoDoPainel>

                <CargaSeguir ancora="p026" proximo={{ href: `${rotaPainel("p027")}#p027`, pergunta: perguntaPainel("p027") }} downloads={downloads} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
