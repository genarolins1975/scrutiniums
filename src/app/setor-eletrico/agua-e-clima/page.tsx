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
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { gold, integra } from "@/lib/energia/gold";
import { dataBR, pct, rotuloRegra, sinal } from "@/lib/energia/formato";
import { ROTULO_FAIXA_USUAL, sin } from "@/lib/energia/leituras";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Água e clima: reservatórios e afluências",
  description:
    "Energia armazenada (EAR) e energia natural afluente (ENA) por subsistema, comparadas ao padrão histórico de cada data, com dados do ONS e regra publicada.",
  alternates: { canonical: "/setor-eletrico/agua-e-clima" },
};

const SERIES_SM = [
  { id: "SE", rotulo: "Sudeste/Centro-Oeste", sigla: "SE/CO", cor: "var(--serie-sm-se)" },
  { id: "S", rotulo: "Sul", sigla: "S", cor: "var(--serie-sm-s)" },
  { id: "NE", rotulo: "Nordeste", sigla: "NE", cor: "var(--serie-sm-ne)" },
  { id: "N", rotulo: "Norte", sigla: "N", cor: "var(--serie-sm-n)" },
];

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
  const bandas = new Map(h.bandas_ear.map((b) => [b.md as string, b as Record<string, number | null>]));
  const ultAno = h.serie_ear.slice(-365).map((p) => {
    const md = p.d.slice(5, 10) === "02-29" ? "02-28" : p.d.slice(5, 10);
    const b = bandas.get(md);
    return { d: p.d, SIN: p.SIN ?? null, p10: b?.SIN_p10 ?? null, p50: b?.SIN_p50 ?? null, p90: b?.SIN_p90 ?? null };
  });
  const ena = h.serie_ena.map((p) => ({ ...p, ref100: 100 }));
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
        <ModoProfundidade>
          <Bloco id="ear">
            <PainelEvidencia
              id="ear-sin"
              pergunta={`O SIN guarda ${pct(s.ear.valor)} da energia armazenável máxima, ${ROTULO_FAIXA_USUAL[s.ear.faixa ?? "dentro"]}`}
              subtitulo="EAR do SIN · % da EAR máxima · últimos 12 meses e faixa histórica da data"
              natureza="CALCULADO"
              porQueImporta={<>Mostra quanto da capacidade de armazenamento do sistema interligado está ocupado, em energia, segundo a definição do ONS.</>}
              oQueMudou={<>Em 7 dias, {sinal(s.ear.variacao_7d_pp)} <Unidade u="p.p." />; em 30 dias, {sinal(s.ear.variacao_30d_pp)} p.p. Desvio frente à mediana da data: {sinal(s.ear.desvio_mediana_pp)} p.p.</>}
              comoInterpretar={<>A área sombreada é a faixa do 10º ao 90º percentil do mesmo dia do calendário nos anos completos desde 2001; a linha tracejada é a mediana.</>}
              naoConcluir={<>O agregado do SIN é dominado pelo Sudeste/Centro-Oeste, que concentra a maior capacidade. Um SIN confortável pode esconder um subsistema apertado.</>}
              proveniencia={h.proveniencia.ear_sin}
              complementares={[{ rotulo: "Sobre a faixa histórica", p: h.proveniencia.padrao }]}
            >
              <GraficoLinhas
                titulo="EAR do SIN nos últimos 12 meses com a faixa histórica da data"
                dados={ultAno}
                chaveX="d"
                series={[
                  { id: "SIN", rotulo: "EAR do SIN", cor: "var(--cor-energia)", espessura: 2.5 },
                  { id: "p50", rotulo: "Mediana histórica", cor: "var(--serie-referencia)", tracejada: true },
                ]}
                banda={{ inferior: "p10", superior: "p90", rotulo: "10º a 90º percentil" }}
                unidade="%"
              />
            </PainelEvidencia>
          </Bloco>

          <Bloco id="padrao">
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
              <GraficoLinhas titulo="EAR por subsistema nos últimos 3 anos" dados={h.serie_ear} chaveX="d" series={SERIES_SM} unidade="%" />
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
              />
              <TabelaDados
                titulo="ENA de 30 dias por subsistema"
                colunas={["Subsistema", "ENA 30 dias (% MLT)", "10º percentil", "90º percentil", "Percentil"]}
                linhas={h.subsistemas.map((x) => [x.nome, x.ena.pct_mlt_30d, x.ena.p10_30d, x.ena.p90_30d, x.ena.percentil_30d_mesma_janela])}
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
              oQueMudou={<>Último mês: {h.mensal_ear.at(-1)?.m.replace("-", "/")} (parcial se o mês não terminou).</>}
              comoInterpretar={<>Médias mensais dos valores diários publicados pelo ONS; o SIN é calculado pela soma das EAR sobre a soma das máximas.</>}
              naoConcluir={<>A EAR máxima mudou ao longo do período: percentuais de décadas diferentes não medem o mesmo volume.</>}
              proveniencia={h.proveniencia.ear_mensal ?? h.proveniencia.ear}
            >
              <GraficoLinhas
                titulo="EAR média mensal desde 2000"
                dados={h.mensal_ear}
                chaveX="m"
                formatoX="mes"
                series={[...SERIES_SM, { id: "SIN", rotulo: "SIN", cor: "var(--cor-energia)", espessura: 2.5 }]}
                unidade="%"
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
