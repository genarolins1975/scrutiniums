import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { Termo } from "@/components/evidencia/Termo";
import { Unidade } from "@/components/evidencia/Unidade";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { HeatmapCalendario, resumoHeatmap } from "@/components/energia/HeatmapCalendario";
import { mediaMovel } from "@/lib/energia/series";
import { MapaBrasil } from "@/components/energia/MapaBrasil";
import { MetricaHero } from "@/components/energia/MetricaHero";
import { IconeSetor } from "@/components/energia/IconeSetor";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { gold, integra } from "@/lib/energia/gold";
import { dataBR, mesAno, num, pct, sinal } from "@/lib/energia/formato";
import type { Submercado } from "@/lib/energia/tipos";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Carga e consumo: quando e onde o Brasil consome eletricidade",
  description:
    "Carga de energia diária do SIN e dos subsistemas (ONS) em calendário de calor, comparação com o ano anterior dentro do mesmo regime metodológico, subsistemas lado a lado e histórico desde 2000 com as mudanças de método marcadas.",
  alternates: { canonical: "/setor-eletrico/carga" },
};

const SERIES = [
  { id: "SE", rotulo: "Sudeste/Centro-Oeste", sigla: "SE/CO", cor: "var(--serie-sm-se)" },
  { id: "S", rotulo: "Sul", sigla: "S", cor: "var(--serie-sm-s)" },
  { id: "NE", rotulo: "Nordeste", sigla: "NE", cor: "var(--serie-sm-ne)" },
  { id: "N", rotulo: "Norte", sigla: "N", cor: "var(--serie-sm-n)" },
];
const SMS: Submercado[] = ["N", "NE", "SE", "S"];
const DIA_LONGO: Record<string, string> = { seg: "segundas", ter: "terças", qua: "quartas", qui: "quintas", sex: "sextas", sáb: "sábados", dom: "domingos" };

export default function CargaPage() {
  const c = gold.carga();
  if (!integra(c)) {
    return (
      <>
        <CabecalhoEnergia atual="carga" />
        <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6 py-14">
          <Indisponivel titulo="Carga indisponível" motivo={c?.motivo ?? "Os dados processados de carga não foram gerados nesta publicação."} />
        </main>
      </>
    );
  }
  const sin = c.subsistemas.find((s) => s.sm === "SIN")!;
  const por = Object.fromEntries(c.subsistemas.map((s) => [s.sm, s]));
  const marcos = [
    { x: "2021-03-01", rotulo: "mar/21: inclui usinas não despachadas", descricao: c.regimes[1]?.descricao },
    { x: "2023-04-29", rotulo: "29/04/23: inclui estimativa de MMGD", descricao: c.regimes[2]?.descricao },
  ];
  const ultimoAno = c.serie.slice(-365).map((p) => ({ d: p.d, v: p.SIN ?? null }));
  const r = resumoHeatmap(ultimoAno);
  const anoPassado = c.serie.slice(-730, -365);
  // média móvel de 7 dias (calculada pela plataforma) para ler a comparação anual sem o serrilhado semanal
  const atual7 = mediaMovel(ultimoAno.map((p) => p.v));
  const anterior7 = mediaMovel(anoPassado.map((p) => p.SIN ?? null));
  return (
    <>
      <CabecalhoEnergia atual="carga" />
      <MarcaVisita secao="energia:carga" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6">
        <CabecalhoModulo rotulo="Carga e consumo" titulo="Quanto o sistema está consumindo?" referencia={<>Carga de Energia Diária (ONS) até {dataBR(c.dia_referencia)}</>}>
          A <Termo slug="carga">carga</Termo> é a energia atendida no sistema interligado, publicada pelo ONS por subsistema. O ONS mudou o que a série inclui em 2021 e em 2023;
          as comparações desta página respeitam essas quebras. Valores em <Unidade u="MWmed" />.
        </CabecalhoModulo>

        {/* resposta curta */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="border border-linha bg-superficie p-5 md:col-span-2">
            <MetricaHero
              icone="carga"
              rotulo={`Carga do SIN · ${dataBR(c.dia_referencia)}`}
              valor={num(sin.dia, 0)}
              unidade="MWmed"
              natureza="CALCULADO"
              variacao={sin.ult7?.variacao_pct !== null && sin.ult7 ? `${sinal(sin.ult7.variacao_pct)}% nos últimos 7 dias sobre os mesmos dias de ${sin.ult7.fim_anterior.slice(0, 4)}` : "sem comparação anual homogênea"}
              sparkline={c.serie.slice(-90).map((p) => p.SIN ?? null)}
              cor="var(--cor-energia)"
              contexto={<>Soma dos quatro subsistemas. Maior carga diária dos últimos 12 meses: {num(sin.max_12m.valor, 0)} MWmed em {dataBR(sin.max_12m.dia)}. A linha mostra os últimos 90 dias.</>}
              tamanho="medio"
            />
          </div>
          <div className="border border-linha bg-superficie p-5">
            <MetricaHero
              icone="carga"
              rotulo="Últimos 30 dias"
              valor={sin.ult30 ? num(sin.ult30.media, 0) : "–"}
              unidade="MWmed em média"
              natureza="CALCULADO"
              variacao={sin.ult30?.variacao_pct !== null && sin.ult30 ? `${sinal(sin.ult30.variacao_pct)}% sobre os mesmos dias de ${sin.ult30.fim_anterior.slice(0, 4)}` : "sem comparação homogênea"}
              contexto={sin.ult30 ? <>De {dataBR(sin.ult30.inicio)} a {dataBR(sin.ult30.fim)}, contra {num(sin.ult30.media_ano_anterior, 0)} MWmed de {dataBR(sin.ult30.inicio_anterior)} a {dataBR(sin.ult30.fim_anterior)}, no mesmo regime metodológico.</> : undefined}
              tamanho="medio"
            />
          </div>
        </div>

        {/* hero: calendário de calor */}
        <section id="calendario" aria-labelledby="calendario-h" className="scroll-mt-24 pt-10">
          <p className="rotulo flex items-center gap-2 text-mineral">
            <IconeSetor tipo="carga" tamanho={15} /> Visual principal
          </p>
          <h2 id="calendario-h" className="mt-2 font-serif text-2xl leading-snug text-carvao md:text-3xl">
            Quando o Brasil consome mais eletricidade?
          </h2>
          <div className="mt-5 border border-linha bg-superficie p-4 md:p-6">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="min-w-0">
                <HeatmapCalendario dados={ultimoAno} titulo="Carga diária do SIN nos últimos 12 meses" unidade="MWmed" cor="var(--cor-energia)" />
              </div>
              <div className="text-sm leading-relaxed text-carvao">
                <p className="rotulo text-mineral">Leitura a partir da série</p>
                {r.diaMaisAlto && r.diaMaisBaixo && (
                  <p className="mt-2 font-serif text-lg leading-snug text-carvao">
                    Nos últimos 12 meses, a carga média por dia da semana foi mais alta às {DIA_LONGO[r.diaMaisAlto]} e mais baixa aos {DIA_LONGO[r.diaMaisBaixo]}: a diferença entre os dois é de{" "}
                    {num((r.mediaPorDia.find((d) => d.dia === r.diaMaisAlto)?.media ?? 0) - (r.mediaPorDia.find((d) => d.dia === r.diaMaisBaixo)?.media ?? 0), 0)} MWmed.
                  </p>
                )}
                {r.maior && r.menor && (
                  <p className="mt-2">
                    Maior dia: {num(r.maior.v as number, 0)} MWmed em {dataBR(r.maior.d)}. Menor dia: {num(r.menor.v as number, 0)} MWmed em {dataBR(r.menor.d)}.
                  </p>
                )}
                <p className="mt-2 text-xs text-mineral">
                  Descrição do que a série mostra, sem atribuir motivo: temperatura, feriados e calendário não são ajustados. A curva horária da carga (madrugada, manhã, tarde e noite) depende do balanço horário do ONS, cuja carga por hora ainda não está integrada; o perfil horário disponível hoje é o da geração, na página Geração.
                </p>
              </div>
            </div>
          </div>
        </section>

        <ModoProfundidade>
          <Bloco id="comparacao">
            <PainelEvidencia
              id="carga-sin"
              pergunta={
                sin.ult7?.variacao_pct !== null && sin.ult7
                  ? `Carga do SIN ${num(Math.abs(sin.ult7.variacao_pct ?? 0))}% ${(sin.ult7.variacao_pct ?? 0) >= 0 ? "acima" : "abaixo"} da mesma semana de ${sin.ult7.fim_anterior.slice(0, 4)}`
                  : "Carga do SIN no último ano"
              }
              subtitulo="Carga do SIN · média móvel de 7 dias em MWmed · últimos 12 meses sobre os 12 meses anteriores, alinhados pelo dia do ano"
              natureza="CALCULADO"
              porQueImporta={<>Comparar o ano com o anterior, dia a dia, separa o padrão sazonal (verão mais alto, inverno mais baixo) do que mudou de um ano para o outro.</>}
              oQueMudou={<>Últimos 30 dias: {sin.ult30?.variacao_pct !== null && sin.ult30 ? `${sinal(sin.ult30.variacao_pct)}% sobre os mesmos dias do ano anterior` : "sem comparação homogênea"}. Maior carga diária em 12 meses: {num(sin.max_12m.valor, 0)} MWmed em {dataBR(sin.max_12m.dia)}.</>}
              comoInterpretar={<>Cada ponto é a média dos 7 dias até aquela data, calculada pela plataforma para tirar o serrilhado semanal; a série diária está na tabela. A linha cinza é o mesmo dia do calendário do ano anterior. A comparação anual só é mostrada quando os dois períodos estão no mesmo regime metodológico do ONS, em vigor desde 29/04/2023 (inclui a estimativa de micro e minigeração distribuída, MMGD).</>}
              naoConcluir={<>A carga não é ajustada por temperatura, feriados ou dias úteis; variação de carga não mede, sozinha, atividade econômica. Desde 29/04/2023 a série inclui uma estimativa de MMGD feita pelo ONS com dados meteorológicos previstos.</>}
              proveniencia={c.proveniencia.sin}
            >
              <GraficoLinhas
                titulo="Carga do SIN, média móvel de 7 dias: últimos 12 meses e os 12 meses anteriores"
                dados={ultimoAno.map((p, i) => ({ d: p.d, atual: atual7[i], anterior: anterior7[i], diario: p.v }))}
                chaveX="d"
                series={[
                  { id: "atual", rotulo: "Últimos 12 meses", sigla: "atual", cor: "var(--cor-energia)", espessura: 2.2 },
                  { id: "anterior", rotulo: "12 meses anteriores (mesmo dia do calendário)", sigla: "ano anterior", cor: "var(--cor-mineral)", espessura: 1.4 },
                ]}
                unidade="MWmed"
                casas={0}
                ensina={{ texto: "Carga: energia atendida no sistema interligado, em MWmed (energia do dia dividida por 24 horas).", fonte: "ONS", href: "/setor-eletrico/aprenda/carga", hrefRotulo: "Entenda carga" }}
              />
            </PainelEvidencia>
          </Bloco>

          <Bloco id="subsistemas">
            <PainelEvidencia
              id="carga-sm"
              pergunta="Onde o Brasil consome eletricidade?"
              subtitulo="Carga diária por subsistema · MWmed · últimos 12 meses, cada região na sua escala"
              natureza="CALCULADO"
              porQueImporta={<>O Sudeste/Centro-Oeste concentra a maior parte da carga; ver as quatro regiões lado a lado, cada uma na própria escala, mostra onde a carga variou mais em proporção.</>}
              oQueMudou={<>Média dos últimos 7 dias comparada à dos mesmos dias do ano anterior: {c.subsistemas.filter((s) => s.sm !== "SIN").map((s) => `${s.nome} ${s.ult7?.variacao_pct !== null && s.ult7 ? `${sinal(s.ult7.variacao_pct)}%` : "sem comparação"}`).join("; ")}.</>}
              comoInterpretar={<>Escalas diferentes por painel: compare a forma da trajetória, não a altura. O mapa mostra a parcela de cada região na carga do SIN no dia de referência.</>}
              naoConcluir={<>Crescimento regional de carga pode refletir mudança de metodologia ou de fronteira de medição; o ONS descreve as mudanças no conjunto de dados.</>}
              proveniencia={c.proveniencia.carga}
            >
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
                <div className="min-w-0">
                  <MapaBrasil
                    titulo={`Carga de cada subsistema em ${dataBR(c.dia_referencia)}`}
                    tom="carga"
                    valores={Object.fromEntries(SMS.map((sm) => [sm, por[sm] ? { valor: `${num(por[sm].dia / 1000, 1)} GWmed`, sub: `${pct((100 * por[sm].dia) / sin.dia, 0)} do SIN`, intensidade: por[sm].dia / sin.dia / 0.6 } : { valor: "sem dado", intensidade: null }]))}
                    legenda="Cor: parcela da carga do SIN (mais escuro, maior). 1 GWmed = 1.000 MWmed."
                    lista="abaixo"
                    detalhes={Object.fromEntries(
                      SMS.map((sm) => {
                        const s = por[sm];
                        return [
                          sm,
                          s ? (
                            <ul key={sm} className="space-y-1">
                              <li>Carga do dia: {num(s.dia, 0)} MWmed.</li>
                              <li>{s.ult7?.variacao_pct !== null && s.ult7 ? `Últimos 7 dias: ${sinal(s.ult7.variacao_pct)}% sobre os mesmos dias de ${s.ult7.fim_anterior.slice(0, 4)}.` : "Sem comparação anual homogênea."}</li>
                              <li>Maior carga em 12 meses: {num(s.max_12m.valor, 0)} MWmed em {dataBR(s.max_12m.dia)}.</li>
                            </ul>
                          ) : (
                            <p key={sm}>Sem dado.</p>
                          ),
                        ];
                      }),
                    )}
                  />
                </div>
                <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                  {SERIES.map((s) => {
                    const sub = por[s.id];
                    return (
                      <div key={s.id} className="min-w-0 border border-linha p-3">
                        <p className="rotulo text-mineral">{s.rotulo}</p>
                        <p className="text-xs text-carvao-muted">
                          {sub?.ult7?.variacao_pct !== null && sub?.ult7 ? `${sinal(sub.ult7.variacao_pct)}% em 7 dias sobre ${sub.ult7.fim_anterior.slice(0, 4)}` : "sem comparação homogênea"}
                        </p>
                        <GraficoLinhas titulo={`Carga diária do ${s.rotulo}, últimos 12 meses`} dados={c.serie.slice(-365).map((p) => ({ d: p.d, v: p[s.id as Submercado] ?? null }))} chaveX="d" series={[{ id: "v", rotulo: s.rotulo, sigla: s.sigla, cor: s.cor }]} unidade="MWmed" casas={0} altura={150} rotulosDiretos={false} />
                      </div>
                    );
                  })}
                </div>
              </div>
            </PainelEvidencia>
          </Bloco>

          <Bloco nivel="analisar">
            <PainelEvidencia
              id="carga-3anos"
              pergunta="Como a carga se comportou nos últimos 3 anos, região a região?"
              subtitulo="Carga diária por subsistema · MWmed · últimos 3 anos, na mesma régua"
              porQueImporta={<>Na mesma escala, as regiões mostram o seu peso relativo e as trajetórias comparáveis.</>}
              oQueMudou={<>Média dos últimos 7 dias comparada à dos mesmos dias do ano anterior: {c.subsistemas.filter((s) => s.sm !== "SIN").map((s) => `${s.nome} ${s.ult7?.variacao_pct !== null && s.ult7 ? `${sinal(s.ult7.variacao_pct)}%` : "sem comparação"}`).join("; ")}.</>}
              comoInterpretar={<>Mesma régua para os quatro subsistemas: compare trajetórias e níveis. {c.serie[0] && c.serie[0].d >= "2023-04-29" ? "Todo o período está no regime atual do ONS." : "As linhas verticais marcam as mudanças de regime dentro do período."}</>}
              naoConcluir={<>Crescimento regional de carga pode refletir mudança de metodologia ou de fronteira de medição.</>}
              proveniencia={c.proveniencia.carga}
            >
              <GraficoLinhas titulo="Carga diária por subsistema" dados={c.serie} chaveX="d" series={SERIES} unidade="MWmed" casas={0} zeroNoEixo marcos={marcos} />
            </PainelEvidencia>
          </Bloco>

          <Bloco nivel="analisar">
            <PainelEvidencia
              id="carga-longa"
              pergunta="A carga desde 2000, com as quebras metodológicas marcadas"
              subtitulo="Carga média mensal do SIN · MWmed"
              natureza="CALCULADO"
              porQueImporta={<>O histórico longo mostra crescimento e quedas da carga em escala de décadas.</>}
              oQueMudou={
                <>
                  Último mês da série: {c.mensal.at(-1) ? mesAno(`${c.mensal.at(-1)!.m}-01`) : "sem dado"}
                  {c.mensal.at(-1) && c.mensal.at(-1)!.m === c.dia_referencia.slice(0, 7) ? `, parcial até ${dataBR(c.dia_referencia)} (${c.mensal.at(-1)!.dias} dias)` : ", completo"}.
                </>
              }
              comoInterpretar={<>As linhas verticais marcam as mudanças de conteúdo da série, com a descrição do ONS na dica; não compare níveis através delas como se fossem a mesma medida.</>}
              naoConcluir={<>A série anterior a 2021 não inclui geração não despachada nem MMGD; o salto após as quebras não é, por si, aumento de consumo.</>}
              proveniencia={c.proveniencia.mensal ?? c.proveniencia.sin}
            >
              <GraficoLinhas
                titulo="Carga média mensal do SIN desde 2000"
                dados={c.mensal}
                chaveX="m"
                formatoX="mes"
                series={[{ id: "SIN", rotulo: "SIN", cor: "var(--cor-energia)" }]}
                unidade="MWmed"
                casas={0}
                marcos={[
                  { x: "2021-03", rotulo: "mar/21", descricao: c.regimes[1]?.descricao },
                  { x: "2023-05", rotulo: "mai/23", descricao: c.regimes[2]?.descricao },
                ]}
              />
            </PainelEvidencia>
          </Bloco>

          <Bloco nivel="auditar">
            <div className="border border-linha bg-superficie p-6">
              <h2 className="font-serif text-xl text-carvao">Regimes metodológicos declarados pelo ONS</h2>
              <ul className="mt-3 space-y-2 text-sm text-carvao">
                {c.regimes.map((rg) => (
                  <li key={rg.inicio}>
                    <strong className="font-medium">{dataBR(rg.inicio)} a {rg.fim ? dataBR(rg.fim) : "hoje"}:</strong> {rg.descricao}
                  </li>
                ))}
              </ul>
              {c.fonte_notas && <blockquote className="mt-4 border-l-2 border-linha pl-4 text-sm text-carvao-muted">{c.fonte_notas.split("\n")[2] ?? c.fonte_notas}</blockquote>}
              <ul className="mt-4 space-y-1 text-sm">
                {c.downloads.map((d) => (
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
