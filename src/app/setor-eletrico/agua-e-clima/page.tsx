import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { Termo } from "@/components/evidencia/Termo";
import { Unidade } from "@/components/evidencia/Unidade";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { TabelaDados } from "@/components/energia/TabelaDados";
import { MapaVivo, type CamadaMapa } from "@/components/energia/MapaVivo";
import { ColunasReservatorio, type ItemReservatorio } from "@/components/energia/ColunasReservatorio";
import { MetricaHero } from "@/components/energia/MetricaHero";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { gold, integra } from "@/lib/energia/gold";
import { dataBR, mesAno, num, pct, rotuloRegra, sinal } from "@/lib/energia/formato";
import { ROTULO_FAIXA_USUAL, sin } from "@/lib/energia/leituras";
import type { Submercado } from "@/lib/energia/tipos";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Água e clima: reservatórios e afluências",
  description:
    "Energia armazenada (EAR) e energia natural afluente (ENA) por subsistema, no mapa, em colunas de reservatório e na curva sazonal do ano contra a faixa histórica de cada data, com dados do ONS e regra publicada.",
  alternates: { canonical: "/setor-eletrico/agua-e-clima" },
};

const SERIES_SM = [
  { id: "SE", rotulo: "Sudeste/Centro-Oeste", sigla: "SE/CO", cor: "var(--serie-sm-se)" },
  { id: "S", rotulo: "Sul", sigla: "S", cor: "var(--serie-sm-s)" },
  { id: "NE", rotulo: "Nordeste", sigla: "NE", cor: "var(--serie-sm-ne)" },
  { id: "N", rotulo: "Norte", sigla: "N", cor: "var(--serie-sm-n)" },
];
const SMS: Submercado[] = ["N", "NE", "SE", "S"];

export default function AguaPage() {
  const h = gold.hidrologia();
  if (!integra(h)) {
    return (
      <>
        <CabecalhoEnergia atual="agua-e-clima" />
        <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6 py-14">
          <Indisponivel titulo="Hidrologia indisponível" motivo={h?.motivo ?? "Os dados processados de hidrologia não foram gerados nesta publicação."} />
        </main>
      </>
    );
  }
  const s = sin(h.subsistemas)!;
  const se = h.subsistemas.find((x) => x.sm === "SE")!;
  const por = Object.fromEntries(h.subsistemas.map((x) => [x.sm, x]));
  const bandas = new Map(h.bandas_ear.map((b) => [b.md as string, b as Record<string, number | null>]));
  const ultAno = h.serie_ear.slice(-365).map((p) => {
    const md = p.d.slice(5, 10) === "02-29" ? "02-28" : p.d.slice(5, 10);
    const b = bandas.get(md);
    return { d: p.d, SIN: p.SIN ?? null, p10: b?.SIN_p10 ?? null, p50: b?.SIN_p50 ?? null, p90: b?.SIN_p90 ?? null };
  });
  const ena = h.serie_ena.map((p) => ({ ...p, ref100: 100 }));

  // curva sazonal: o ano corrente e o anterior contra a faixa histórica de cada dia do calendário
  const anoAtual = h.dia_referencia_ear.slice(0, 4);
  const anoAnterior = String(Number(anoAtual) - 1);
  const porDia = new Map(h.serie_ear.map((p) => [p.d, p.SIN ?? null]));
  const sazonal = h.bandas_ear.map((b) => {
    const md = b.md as string;
    return {
      md,
      atual: md <= h.dia_referencia_ear.slice(5, 10) ? (porDia.get(`${anoAtual}-${md}`) ?? null) : null,
      anterior: porDia.get(`${anoAnterior}-${md}`) ?? null,
      p10: (b.SIN_p10 as number | null) ?? null,
      p50: (b.SIN_p50 as number | null) ?? null,
      p90: (b.SIN_p90 as number | null) ?? null,
    };
  });

  const itensReservatorio: ItemReservatorio[] = (["N", "NE", "SE", "S", "SIN"] as const).map((sm) => {
    const x = por[sm];
    return { sm, nome: x.nome, valor: x.ear.valor, p10: x.ear.p10, p50: x.ear.mediana_historica, p90: x.ear.p90, percentil: x.ear.percentil_na_data, faixa: x.ear.faixa, variacao30pp: x.ear.variacao_30d_pp, natureza: x.ear.natureza };
  });

  const camadas: CamadaMapa[] = [
    {
      id: "ear",
      rotulo: "EAR",
      icone: "agua",
      tom: "agua",
      titulo: `Energia armazenada em ${dataBR(h.dia_referencia_ear)}, em % da EAR máxima`,
      valores: Object.fromEntries(SMS.map((sm) => [sm, por[sm].ear.valor !== null ? { valor: pct(por[sm].ear.valor), sub: por[sm].ear.faixa ? ROTULO_FAIXA_USUAL[por[sm].ear.faixa!].replace(" para a data", "") : undefined, intensidade: (por[sm].ear.valor as number) / 100 } : { valor: "sem dado", intensidade: null }])),
      legenda: "Cor: EAR em % da capacidade máxima de armazenamento (mais escuro, mais cheio). O SIN é calculado pela plataforma: soma das EAR sobre soma das máximas.",
      referencia: `EAR diária por subsistema (ONS) · ${dataBR(h.dia_referencia_ear)} · SIN ${pct(s.ear.valor)}`,
      href: "#reservatorios",
      hrefRotulo: "Ver as colunas de reservatório",
      detalhes: Object.fromEntries(
        SMS.map((sm) => {
          const x = por[sm];
          return [sm, [`EAR: ${pct(x.ear.valor)}; mediana da data ${pct(x.ear.mediana_historica)}; faixa usual ${pct(x.ear.p10)} a ${pct(x.ear.p90)}.`, `Percentil na data: ${num(x.ear.percentil_na_data, 1)}. Em 30 dias: ${sinal(x.ear.variacao_30d_pp)} p.p.`]];
        }),
      ),
    },
    {
      id: "ena",
      rotulo: "ENA",
      icone: "clima",
      tom: "agua",
      titulo: `Afluência acumulada em 30 dias até ${dataBR(h.dia_referencia_ena)}, em % da média de longo termo`,
      valores: Object.fromEntries(SMS.map((sm) => [sm, por[sm].ena.pct_mlt_30d !== null ? { valor: pct(por[sm].ena.pct_mlt_30d, 1), sub: `da MLT${por[sm].ena.faixa_30d && por[sm].ena.faixa_30d !== "dentro" ? `, ${por[sm].ena.faixa_30d} da faixa usual` : ""}`, intensidade: Math.min(1, (por[sm].ena.pct_mlt_30d as number) / 200) } : { valor: "sem dado", intensidade: null }])),
      legenda: "Cor: ENA de 30 dias em % da MLT (100% = média de longo termo; a cor satura em 200%). Faixa usual: entre o 10º e o 90º percentil da mesma janela nos anos desde 2001.",
      referencia: `ENA diária por subsistema (ONS), acumulado de 30 dias calculado pela plataforma · até ${dataBR(h.dia_referencia_ena)} · SIN ${pct(s.ena.pct_mlt_30d, 1)} da MLT`,
      href: "#ena",
      hrefRotulo: "Ver a série da ENA",
      detalhes: Object.fromEntries(
        SMS.map((sm) => {
          const x = por[sm];
          return [sm, [`ENA de 30 dias: ${pct(x.ena.pct_mlt_30d, 1)} da MLT; faixa usual ${pct(x.ena.p10_30d, 1)} a ${pct(x.ena.p90_30d, 1)}; percentil ${num(x.ena.percentil_30d_mesma_janela, 1)}.`, `ENA do dia ${dataBR(x.ena.dia)}: ${pct(x.ena.pct_mlt_dia, 1)} da MLT.`]];
        }),
      ),
    },
  ];

  return (
    <>
      <CabecalhoEnergia atual="agua-e-clima" />
      <MarcaVisita secao="energia:agua-e-clima" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6">
        <CabecalhoModulo
          rotulo="Água e clima"
          titulo="Quanta energia está guardada nos reservatórios, e quanta água está chegando?"
          referencia={<>EAR e ENA do ONS até {dataBR(h.dia_referencia_ear)} · padrão histórico com anos completos desde 2001</>}
        >
          A <Termo slug="ear">EAR</Termo> mede a energia associada à água guardada nos reservatórios; a <Termo slug="ena">ENA</Termo> mede, em
          energia, as vazões naturais que chegam a eles. As duas séries são publicadas pelo ONS; como entram na formação do preço é matéria dos
          modelos oficiais, cuja conferência documental está pendente nesta fase.
        </CabecalhoModulo>

        {/* resposta curta */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="border border-linha bg-superficie p-5">
            <MetricaHero
              icone="agua"
              rotulo={`Energia armazenada · SIN · ${dataBR(s.ear.dia)}`}
              valor={pct(s.ear.valor)}
              unidade="da EAR máxima"
              natureza="CALCULADO"
              variacao={`${sinal(s.ear.variacao_30d_pp)} p.p. em 30 dias`}
              sparkline={ultAno.map((p) => p.SIN)}
              referencia={s.ear.mediana_historica}
              faixa={{ inferior: ultAno.map((p) => p.p10), superior: ultAno.map((p) => p.p90) }}
              cor="var(--serie-hidraulica)"
              contexto={<>{ROTULO_FAIXA_USUAL[s.ear.faixa ?? "dentro"].replace(/^./, (c) => c.toUpperCase())}: mediana {pct(s.ear.mediana_historica)}, faixa de {pct(s.ear.p10)} a {pct(s.ear.p90)} (percentil {num(s.ear.percentil_na_data, 1)}). A linha mostra os últimos 12 meses sobre a faixa histórica.</>}
              tamanho="medio"
            />
          </div>
          <div className="border border-linha bg-superficie p-5">
            <MetricaHero
              icone="clima"
              rotulo={`Afluência em 30 dias · SIN · até ${dataBR(s.ena.dia)}`}
              valor={pct(s.ena.pct_mlt_30d, 1)}
              unidade="da média de longo termo"
              natureza="CALCULADO"
              variacao={s.ena.faixa_30d ? ROTULO_FAIXA_USUAL[s.ena.faixa_30d].replace(" para a data", "") : undefined}
              sparkline={h.serie_ena.slice(-120).map((p) => p.SIN ?? null)}
              referencia={100}
              cor="var(--serie-hidraulica)"
              contexto={<>Faixa usual da mesma janela nos anos desde 2001: {pct(s.ena.p10_30d, 1)} a {pct(s.ena.p90_30d, 1)} da MLT (percentil {num(s.ena.percentil_30d_mesma_janela, 1)}). A linha mostra a ENA diária dos últimos 120 dias, com 100% da MLT tracejado.</>}
              tamanho="medio"
            />
          </div>
        </div>

        {/* hero: mapa hidrológico */}
        <section id="mapa" aria-labelledby="mapa-h" className="scroll-mt-24 pt-8">
          <h2 id="mapa-h" className="sr-only">
            Mapa da água
          </h2>
          <div className="border border-linha bg-superficie p-4 md:p-6">
            <MapaVivo camadas={camadas} />
          </div>
          <p className="mt-2 text-xs text-mineral">
            O mapa mostra os quatro subsistemas do ONS. Bacias, reservatórios individuais e chuva não estão integrados nesta fase: os conjuntos por bacia, por reservatório e por REE estão catalogados em Dados.
          </p>
        </section>

        <ModoProfundidade>
          <Bloco id="reservatorios">
            <PainelEvidencia
              id="ear-colunas"
              pergunta="Quanto temos, e quanto normalmente teríamos nesta data?"
              subtitulo={`EAR por subsistema e SIN · % da EAR máxima · ${dataBR(h.dia_referencia_ear)} contra o padrão histórico da data`}
              porQueImporta={<>Cada coluna é um reservatório equivalente: a altura é a capacidade máxima, o preenchimento é a EAR do dia, e os traços marcam onde a EAR esteve no mesmo dia do calendário nos anos anteriores. De relance, separa o que é da estação do que é incomum.</>}
              oQueMudou={<>{h.subsistemas.filter((x) => x.sm !== "SIN").map((x) => `${x.nome}: ${pct(x.ear.valor)} (${sinal(x.ear.variacao_30d_pp)} p.p. em 30 dias)`).join("; ")}.{h.desvio_principal ? ` Maior desvio frente à mediana da data: ${h.desvio_principal.nome} (${sinal(h.desvio_principal.desvio_pp)} p.p.).` : ""}</>}
              comoInterpretar={<>&quot;Fora da faixa usual&quot; significa abaixo do 10º ou acima do 90º percentil da data. O percentil é a posição do valor de hoje entre os valores do mesmo dia nos anos anteriores.</>}
              naoConcluir={<>O percentil mede posição histórica, não risco de desabastecimento. A capacidade máxima de cada subsistema mudou ao longo das décadas, e o SIN é dominado pelo Sudeste/Centro-Oeste.</>}
              proveniencia={h.proveniencia.ear}
              complementares={[
                { rotulo: "Sobre a mediana, os percentis e a posição", p: h.proveniencia.padrao },
                { rotulo: "Sobre a EAR do SIN", p: h.proveniencia.ear_sin },
              ]}
            >
              <ColunasReservatorio itens={itensReservatorio} dia={dataBR(h.dia_referencia_ear)} />
            </PainelEvidencia>
          </Bloco>

          <Bloco id="ear">
            <PainelEvidencia
              id="ear-sin"
              pergunta={`O ano ${anoAtual} contra a história: onde a EAR do SIN está em relação ao usual de cada dia do calendário`}
              subtitulo="EAR do SIN · % da EAR máxima · janeiro a dezembro, ano atual e anterior sobre a faixa histórica"
              natureza="CALCULADO"
              porQueImporta={<>A leitura sazonal mostra o ciclo do ano inteiro de uma vez: o enchimento na estação chuvosa, o esvaziamento na seca e se este ano está seguindo, acima ou abaixo do padrão dos anos anteriores.</>}
              oQueMudou={<>Em 7 dias, {sinal(s.ear.variacao_7d_pp)} <Unidade u="p.p." />; em 30 dias, {sinal(s.ear.variacao_30d_pp)} p.p. Desvio frente à mediana da data: {sinal(s.ear.desvio_mediana_pp)} p.p.</>}
              comoInterpretar={<>A área sombreada é a faixa do 10º ao 90º percentil do mesmo dia do calendário nos anos completos desde 2001; a linha tracejada é a mediana. A linha azul é {anoAtual} até {dataBR(h.dia_referencia_ear)}; a cinza, {anoAnterior}.</>}
              naoConcluir={<>O agregado do SIN é dominado pelo Sudeste/Centro-Oeste, que concentra a maior capacidade. Um SIN confortável pode esconder um subsistema apertado. A faixa não é previsão do resto do ano.</>}
              proveniencia={h.proveniencia.ear_sin}
              complementares={[{ rotulo: "Sobre a faixa histórica", p: h.proveniencia.padrao }]}
            >
              <GraficoLinhas
                titulo={`EAR do SIN em ${anoAtual} e ${anoAnterior} sobre a faixa histórica de cada dia do calendário`}
                dados={sazonal}
                chaveX="md"
                formatoX="md"
                series={[
                  { id: "atual", rotulo: `EAR do SIN em ${anoAtual}`, sigla: anoAtual, cor: "var(--serie-hidraulica)", espessura: 2.5 },
                  { id: "anterior", rotulo: `EAR do SIN em ${anoAnterior}`, sigla: anoAnterior, cor: "var(--cor-mineral)", espessura: 1.5 },
                  { id: "p50", rotulo: "Mediana histórica", cor: "var(--serie-referencia)", tracejada: true },
                ]}
                banda={{ inferior: "p10", superior: "p90", rotulo: "10º a 90º percentil (2001 a ano anterior)" }}
                unidade="%"
                casas={1}
                ensina={{ texto: "EAR: energia associada à água guardada nos reservatórios, em % da capacidade máxima de armazenamento.", fonte: "ONS", href: "/setor-eletrico/aprenda/ear", hrefRotulo: "Entenda EAR" }}
              />
            </PainelEvidencia>
          </Bloco>

          <Bloco id="padrao" nivel="analisar">
            <PainelEvidencia
              id="ear-subsistemas"
              pergunta={h.desvio_principal ? `O maior desvio frente à mediana da data está no ${h.desvio_principal.nome}` : "Como cada subsistema se compara ao padrão da data"}
              subtitulo="EAR por subsistema · % da EAR máxima · últimos 3 anos"
              porQueImporta={<>Cada subsistema tem reservatórios, chuvas e capacidade próprios. A comparação com a própria história da data separa sazonalidade de anomalia.</>}
              oQueMudou={<>{h.subsistemas.filter((x) => x.sm !== "SIN").map((x) => `${x.nome}: ${pct(x.ear.valor)} (${sinal(x.ear.variacao_30d_pp)} p.p. em 30 dias)`).join("; ")}.</>}
              comoInterpretar={<>A tabela abaixo mostra o valor do dia, a mediana, o 10º e o 90º percentil da data e a posição percentual. &quot;Fora da faixa usual&quot; significa abaixo do 10º ou acima do 90º percentil.</>}
              naoConcluir={<>O percentil mede posição histórica, não risco de desabastecimento. A capacidade máxima de cada subsistema mudou ao longo das décadas.</>}
              proveniencia={h.proveniencia.ear}
              complementares={[
                { rotulo: "Sobre a mediana, os percentis e a posição", p: h.proveniencia.padrao },
                { rotulo: "Sobre a EAR do SIN", p: h.proveniencia.ear_sin },
              ]}
            >
              <div className="grid gap-4 md:grid-cols-2">
                {SERIES_SM.map((sm) => (
                  <div key={sm.id} className="min-w-0 border border-linha p-3">
                    <p className="rotulo mb-1 text-mineral">{sm.rotulo}</p>
                    <GraficoLinhas titulo={`EAR do ${sm.rotulo} nos últimos 3 anos`} dados={h.serie_ear.map((p) => ({ d: p.d, v: p[sm.id as Submercado] ?? null }))} chaveX="d" series={[{ id: "v", rotulo: sm.rotulo, sigla: sm.sigla, cor: sm.cor }]} unidade="%" altura={170} yDominio={[0, 100]} rotulosDiretos={false} />
                  </div>
                ))}
              </div>
              <div className="tabela-scroll mt-5" tabIndex={0} role="region" aria-label="EAR por subsistema contra o padrão histórico da data (tabela rolável)">
                <table className="w-full min-w-[40rem] border-collapse text-sm tabular-nums">
                  <caption className="sr-only">EAR por subsistema contra o padrão histórico da data</caption>
                  <thead>
                    <tr className="text-left text-xs text-mineral">
                      {[
                        ["Subsistema", null],
                        ["EAR", "OBSERVADO"],
                        ["Mediana da data", "CALCULADO"],
                        ["10º a 90º percentil", "CALCULADO"],
                        ["Percentil", "CALCULADO"],
                        ["Leitura", null],
                      ].map(([c, n]) => (
                        <th key={c} scope="col" className="border-b border-linha px-2 py-2 font-medium">
                          <span className="flex flex-wrap items-center gap-1.5">
                            {c}
                            {n && <SeloNatureza natureza={n as "OBSERVADO" | "CALCULADO"} compacto />}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {h.subsistemas.map((x) => (
                      <tr key={x.sm} className="border-b border-linha">
                        <th scope="row" className="px-2 py-2 text-left font-normal text-carvao">
                          {x.nome} {x.sm === "SIN" && <SeloNatureza natureza="CALCULADO" />}
                        </th>
                        <td className="px-2 py-2">{pct(x.ear.valor)}</td>
                        <td className="px-2 py-2">{pct(x.ear.mediana_historica)}</td>
                        <td className="px-2 py-2">{pct(x.ear.p10)} a {pct(x.ear.p90)}</td>
                        <td className="px-2 py-2">{x.ear.percentil_na_data?.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) ?? "–"}</td>
                        <td className="px-2 py-2">{x.ear.faixa ? ROTULO_FAIXA_USUAL[x.ear.faixa] : "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </PainelEvidencia>
          </Bloco>

          <Bloco id="ena">
            <PainelEvidencia
              id="ena-sm"
              pergunta={`Quanta água está chegando? No Sudeste/Centro-Oeste, ${pct(se.ena.pct_mlt_30d, 1)} da média de longo termo em 30 dias`}
              subtitulo="ENA bruta por subsistema · % da MLT · últimos 18 meses"
              porQueImporta={<>A ENA expressa em energia as vazões naturais que chegam aos reservatórios; o ONS a indica como insumo de estudos energéticos e da projeção do custo marginal de operação. Acima de 100% da <Termo slug="mlt">MLT</Termo>, a ENA está acima da média de longo termo usada pelo ONS como referência.</>}
              oQueMudou={<>ENA de 30 dias: {h.subsistemas.map((x) => `${x.nome} ${pct(x.ena.pct_mlt_30d, 1)}${x.ena.faixa_30d && x.ena.faixa_30d !== "dentro" ? ` (${x.ena.faixa_30d} da faixa usual)` : ""}`).join("; ")}.</>}
              comoInterpretar={<>A série diária oscila muito; o acumulado de 30 dias, calculado como soma da ENA sobre soma da MLT, suaviza. A faixa usual compara com a mesma janela nos anos desde 2001.</>}
              naoConcluir={<>A ENA mede afluência natural, não armazenamento: este painel não calcula quanto dela vira EAR (a documentação do ONS sobre o balanço hídrico dos reservatórios não foi conferida nesta fase). O período de referência da MLT não é informado pelo ONS.</>}
              proveniencia={h.proveniencia.ena30}
              complementares={[{ rotulo: "Sobre a ENA diária (gráfico)", p: h.proveniencia.ena }]}
            >
              <GraficoLinhas
                titulo="ENA bruta por subsistema em % da MLT, últimos 18 meses"
                dados={ena}
                chaveX="d"
                series={[...SERIES_SM, { id: "ref100", rotulo: "100% da MLT", cor: "var(--serie-referencia)", tracejada: true, espessura: 1 }]}
                unidade="% MLT"
                casas={0}
                ensina={{ texto: "ENA: energia produzível a partir das vazões naturais aos reservatórios, em % da média de longo termo (MLT).", fonte: "ONS", href: "/setor-eletrico/aprenda/ena", hrefRotulo: "Entenda ENA" }}
              />
              <TabelaDados
                titulo="ENA de 30 dias por subsistema"
                colunas={["Subsistema", "ENA 30 dias (% MLT)", "10º percentil", "90º percentil", "Percentil"]}
                linhas={h.subsistemas.map((x) => [x.nome, x.ena.pct_mlt_30d, x.ena.p10_30d, x.ena.p90_30d, x.ena.percentil_30d_mesma_janela])}
                casas={[null, 1, 1, 1, 1]}
              />
            </PainelEvidencia>
          </Bloco>

          <Bloco nivel="analisar">
            <PainelEvidencia
              id="ear-longo"
              pergunta="Como a EAR se comportou nas últimas décadas?"
              subtitulo="EAR média mensal por subsistema e SIN · % da EAR máxima · desde 2000"
              natureza="CALCULADO"
              porQueImporta={<>O histórico longo mostra ciclos de anos secos e úmidos que uma janela curta não revela.</>}
              oQueMudou={<>{(() => {
                const u = h.mensal_ear.at(-1);
                if (!u) return "Série mensal sem dado.";
                const parcial = h.dia_referencia_ear.slice(0, 7) === u.m;
                return `Último mês da série: ${mesAno(`${u.m}-01`)}${parcial ? `, parcial, com dados até ${dataBR(h.dia_referencia_ear)}` : ""}; EAR média do SIN de ${pct(u.SIN)} da EAR máxima.`;
              })()}</>}
              comoInterpretar={<>Médias mensais dos valores diários publicados pelo ONS; o SIN é calculado pela soma das EAR sobre a soma das máximas. As marcas assinalam meses documentados em que a EAR do SIN ficou muito baixa, conforme a própria série.</>}
              naoConcluir={<>A EAR máxima mudou ao longo do período: percentuais de décadas diferentes não medem o mesmo volume. As marcas não atribuem motivo aos valores baixos.</>}
              proveniencia={h.proveniencia.ear_mensal ?? h.proveniencia.ear}
            >
              <GraficoLinhas
                titulo="EAR média mensal desde 2000"
                dados={h.mensal_ear}
                chaveX="m"
                formatoX="mes"
                series={[...SERIES_SM, { id: "SIN", rotulo: "SIN", cor: "var(--serie-hidraulica)", espessura: 2.5 }]}
                unidade="%"
                marcos={(() => {
                  // meses em que a EAR do SIN ficou no menor valor de cada década, lidos da própria série (sem atribuir motivo)
                  const out: { x: string; rotulo: string; descricao: string }[] = [];
                  for (const dec of ["200", "201", "202"]) {
                    const pts = h.mensal_ear.filter((p) => p.m.startsWith(dec) && typeof p.SIN === "number") as { m: string; SIN: number }[];
                    if (!pts.length) continue;
                    const mn = pts.reduce((a, b) => (b.SIN < a.SIN ? b : a));
                    out.push({ x: mn.m, rotulo: `${mesAno(`${mn.m}-01`)}: ${pct(mn.SIN)}`, descricao: `menor EAR média mensal do SIN da década, ${pct(mn.SIN)} da máxima` });
                  }
                  return out;
                })()}
              />
            </PainelEvidencia>
          </Bloco>

          <Bloco nivel="auditar">
            <div className="border border-linha bg-superficie p-6">
              <h2 className="font-serif text-xl text-carvao">Regras, fonte e downloads</h2>
              <dl className="mt-4 grid gap-4 md:grid-cols-2">
                {Object.entries(h.regras).map(([k, v]) => (
                  <div key={k}>
                    <dt className="rotulo text-mineral">{rotuloRegra(k)}</dt>
                    <dd className="mt-1 text-sm text-carvao">{v}</dd>
                  </div>
                ))}
              </dl>
              {h.fonte_notas.ear && (
                <blockquote className="mt-5 border-l-2 border-linha pl-4 text-sm text-carvao-muted">
                  <p className="rotulo mb-1 text-mineral">Descrição do ONS (EAR)</p>
                  {h.fonte_notas.ear.split("\n")[2] ?? h.fonte_notas.ear}
                </blockquote>
              )}
              <ul className="mt-5 space-y-1 text-sm">
                {h.downloads.map((d) => (
                  <li key={d.url}><a href={d.url} download className="text-energia-dark underline underline-offset-4">{d.rotulo}</a></li>
                ))}
              </ul>
            </div>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
