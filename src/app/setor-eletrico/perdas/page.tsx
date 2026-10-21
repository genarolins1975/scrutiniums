import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { Termo } from "@/components/evidencia/Termo";
import { Numero } from "@/components/energia/Numero";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { TabelaDados } from "@/components/energia/TabelaDados";
import { PerdasExplorador } from "@/components/energia/PerdasExplorador";
import { PerdasAuditoria } from "@/components/energia/PerdasAuditoria";
import { PerdasLevaEscolha } from "@/components/energia/PerdasLevaEscolha";
import { PerdasCapitulos, PerdasSeguir, Recorte, ReferenciaPerdas, Resposta, SeparacaoMetricas, perguntaPerdas } from "@/components/energia/PerdasPainel";
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { TEXTOS_PERDAS_EN, marcarNomes, traducaoExata, traduzOuMarca } from "@/lib/energia/i18n/qualidade-perdas";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { integra, lerGold } from "@/lib/energia/gold";
import { dataBR, mesAno, num } from "@/lib/energia/formato";
import type { PerdasGold } from "@/lib/energia/tipos-perdas";
import {
  ANO_LEIAUTE_SAMP,
  anosSerieNacional,
  faixaComparacao,
  fraseMudanca,
  leve,
  linhaNacional,
  linhasNacionais,
  periodosDisponiveis,
  recortesDoPeriodo,
  respostaEvolucao,
  respostaGeral,
  rotuloDistribuidora,
  serieNacional,
  textoNumero,
  valoresDoPeriodo,
  variacaoMesmas,
  vereditoComposicao,
  vereditoEvolucao,
  vereditoGeral,
  medidas,
} from "@/lib/energia/perdas";

export const dynamic = "force-static";

export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/perdas", {
    title: tx("Perdas de energia na distribuição", "Energy losses in distribution"),
    description: tx(
      "Onde a energia se perde: taxa e energia perdida das concessionárias somadas e de cada distribuidora, cada uma com o denominador explícito, mapa das áreas de atuação, comparação de até quatro distribuidoras e a série anual do SAMP, com a fonte da ANEEL.",
      "Where energy is lost: rate and lost energy of the concession holders combined and of each distribution utility, each with an explicit denominator, map of the service areas, comparison of up to four distribution utilities and the annual SAMP series, with ANEEL as the source.",
    ),
    alternates: { canonical: "/setor-eletrico/perdas" },
  }, anterior);
}

export default function PerdasPage() {
  const g = lerGold<PerdasGold>("perdas.json");
  const idioma = idiomaEnergia();
  if (!integra(g)) {
    return (
      <>
        <CabecalhoEnergia atual="perdas" />
        <main id="conteudo" tabIndex={-1} className="ed-pagina py-14">
          <Indisponivel
            titulo={tx("Perdas indisponíveis", "Losses unavailable")}
            motivo={
              g?.motivo
                ? tx(<>{g.motivo}</>, <TrechoPortugues regiao="perdas-motivo">{g.motivo}</TrechoPortugues>)
                : tx("Os dados processados de perdas não foram gerados nesta publicação.", "The processed loss data were not generated in this release.")
            }
          />
        </main>
      </>
    );
  }

  const ref = g.referencia.ano;
  const ev = g.evidencias;
  const nac = linhaNacional(g, ref);
  const acumConc = g.acumulado?.agregados.find((a) => a.universo === "concessionarias") ?? null;
  const versao = tx(
    `SAMP até ${mesAno(g.referencia.ultima_competencia)}, publicado em ${dataBR(g.gerado_em)}`,
    `SAMP up to ${mesAno(g.referencia.ultima_competencia)}, published on ${dataBR(g.gerado_em)}`,
  );
  const bloqueioGeometria = g.bloqueios.find((b) => b.item.includes("P055")) ?? null;
  // o item do bloqueio entra no meio da frase: sem o ID do painel e com inicial minúscula
  const meioDeFrase = (t: string) => t.replace(/ \(P055\)$/, "").replace(/^./, (c) => c.toLowerCase());
  const itemGeometriaEn = bloqueioGeometria ? traducaoExata(bloqueioGeometria.item, TEXTOS_PERDAS_EN) : null;
  const itemGeometria = bloqueioGeometria
    ? tx(
        <>{meioDeFrase(bloqueioGeometria.item)}</>,
        itemGeometriaEn ? <>{meioDeFrase(itemGeometriaEn)}</> : <TrechoPortugues regiao="bloqueio-item">{meioDeFrase(bloqueioGeometria.item)}</TrechoPortugues>,
      )
    : "";
  const MEDIDAS = medidas(idioma);
  const mesFimAcum = g.acumulado ? mesAno(`${g.acumulado.ano}-${String(g.acumulado.mes_fim).padStart(2, "0")}`) : null;
  const periodos = periodosDisponiveis(g);
  const pRef = periodos.find((p) => p.referencia) ?? periodos[0];
  const rotuloAcumulado = periodos.find((p) => p.tipo === "acumulado")?.rotulo ?? null;
  // anos da série e do mapa lidos da gold, nunca escritos à mão
  const anos = anosSerieNacional(g.nacional);
  const inicioSerie = anos?.inicio ?? ref;
  const periodoMapa = tx(
    `${inicioSerie} a ${ref}${g.acumulado ? ` e ${g.acumulado.ano} até ${mesFimAcum}` : ""}`,
    `${inicioSerie} to ${ref}${g.acumulado ? ` and ${g.acumulado.ano} up to ${mesFimAcum}` : ""}`,
  );

  // a faixa entre distribuidoras no ano de referência: os mesmos valores, a mesma regra e o mesmo seletor que o mapa, a figura e a tabela
  const leves = g.distribuidoras.map(leve);
  const rotulos = Object.fromEntries(leves.map((d) => [d.cnpj, rotuloDistribuidora(d)]));
  const grupos = Object.fromEntries(leves.map((d) => [d.cnpj, d.grupo]));
  const recortesRef = recortesDoPeriodo(leves, pRef, null);
  const faixaRef = recortesRef ? faixaComparacao(valoresDoPeriodo(leves, recortesRef, "taxa", pRef), rotulos, grupos) : null;
  const mesmas = nac?.mesmas_ano_anterior ?? null;
  const parTaxa = mesmas?.taxa_total_pct ?? null;

  const oQueMudou = tx(
    <>
      {parTaxa && parTaxa[0] !== null && parTaxa[1] !== null ? (
        <>
          Nas mesmas {mesmas!.n_total} concessionárias, a taxa agregada {fraseMudanca(parTaxa[0], parTaxa[1])} de {ref - 1} para {ref}.
          {acumConc && acumConc.atual.taxa_total_pct !== null && acumConc.anterior.taxa_total_pct !== null && (
            <> No acumulado de {g.acumulado!.ano} até {mesFimAcum}, a taxa {fraseMudanca(acumConc.anterior.taxa_total_pct, acumConc.atual.taxa_total_pct)} contra o mesmo período do ano anterior.</>
          )}
        </>
      ) : (
        <>Sem comparação nas mesmas distribuidoras para {ref}.</>
      )}
    </>,
    <>
      {parTaxa && parTaxa[0] !== null && parTaxa[1] !== null ? (
        <>
          In the same {mesmas!.n_total} concession holders, the aggregate rate {fraseMudanca(parTaxa[0], parTaxa[1])} from {ref - 1} to {ref}.
          {acumConc && acumConc.atual.taxa_total_pct !== null && acumConc.anterior.taxa_total_pct !== null && (
            <>
              {" "}
              In the year to date of {g.acumulado!.ano} up to {mesFimAcum}, the rate {fraseMudanca(acumConc.anterior.taxa_total_pct, acumConc.atual.taxa_total_pct)} against the same period of the previous year.
            </>
          )}
        </>
      ) : (
        <>No comparison in the same distribution utilities for {ref}.</>
      )}
    </>,
  );
  const comoInterpretar = tx(
    <>
      Cada barra conta as distribuidoras, concessionárias e permissionárias, cuja medida cai na faixa; as faixas são as mesmas do mapa e da tabela. A taxa é a perda total dividida pela energia injetada
      de referência da própria distribuidora (desde {ANO_LEIAUTE_SAMP}, fornecida + irregular + perdas: a linha publicada deixou de fechar o balanço). O agregado das concessionárias é outra conta, a soma das
      perdas dividida pela soma da energia injetada, nunca a média das taxas. A mediana é simples entre as distribuidoras, sem ponderar pelo tamanho.
    </>,
    <>
      Each bar counts the distribution utilities, concession holders and permit holders, whose measure falls in the range; the ranges are the same as in the map and the table. The rate is the total loss divided by
      the reference injected energy of the distribution utility itself (since {ANO_LEIAUTE_SAMP}, supplied + irregular + losses: the published line no longer closed the balance). The aggregate of the concession
      holders is another calculation, the sum of the losses divided by the sum of the injected energy, never the average of the rates. The median is a simple one across distribution utilities, not weighted by size.
    </>,
  );
  const naoConcluir = tx(
    <>
      Que os extremos sejam metas, resultado de eficiência ou ordem de desempenho: as redes diferem em tamanho, território e perfil de consumo. Que a perda de um município seja a da distribuidora: o mapa colore
      a área inteira. Que perda não técnica seja furto: inclui erros de medição, leitura e faturamento. Que a distribuidora esteja acima ou abaixo da meta regulatória. Que o acumulado do ano aberto valha pelo ano inteiro.
    </>,
    <>
      That the extremes are targets, an efficiency result or a performance ranking: grids differ in size, territory and consumption profile. That the loss of a municipality is that of the distribution utility: the
      map colors the whole area. That non-technical loss is theft: it includes metering, reading and billing errors. That the distribution utility is above or below the regulatory target. That the year to date of
      the open year stands for the whole year.
    </>,
  );

  const oQueMudouEvolucao = tx(
    <>
      {nac && nac.taxa_total_pct !== null ? `Em ${ref}, ${num(nac.taxa_total_pct, 2)}% em ${nac.n_distribuidoras} concessionárias somadas.` : `Sem soma em ${ref}.`} Cada linha da tabela diz se o
      conjunto de distribuidoras é o mesmo do ano anterior; a variação se lê na coluna das mesmas distribuidoras.
    </>,
    <>
      {nac && nac.taxa_total_pct !== null ? `In ${ref}, ${num(nac.taxa_total_pct, 2)}% in ${nac.n_distribuidoras} concession holders combined.` : `No sum in ${ref}.`} Each table row says whether the group
      of distribution utilities is the same as in the previous year; the change is read in the column of the same distribution utilities.
    </>,
  );
  const comoInterpretarEvolucao = tx(
    <>
      Taxa agregada = 100 × soma das perdas ÷ soma da energia injetada das concessionárias com os 12 meses e sem alerta, nunca média de percentuais. Quando o universo muda, a diferença entre dois
      anos mistura composição e variação. A marca de {ANO_LEIAUTE_SAMP} indica o leiaute novo do SAMP, com outro denominador.
    </>,
    <>
      Aggregate rate = 100 × sum of losses ÷ sum of injected energy of the concession holders with the 12 months and no alert, never an average of percentages. When the universe changes, the difference between two
      years mixes composition and change. The {ANO_LEIAUTE_SAMP} mark indicates the new SAMP layout, with another denominator.
    </>,
  );
  const naoConcluirEvolucao = tx(
    <>Que a queda ou a alta de um ano para o outro seja da mesma rede: distribuidoras entram, saem e são incorporadas, e {ANO_LEIAUTE_SAMP} trouxe um denominador novo.</>,
    <>That the fall or rise from one year to the next is of the same grid: distribution utilities enter, leave and are absorbed, and {ANO_LEIAUTE_SAMP} brought a new denominator.</>,
  );

  return (
    <>
      <CabecalhoEnergia atual="perdas" />
      <MarcaVisita secao="energia:perdas" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          siglas={["SAMP", "MMGD", "REN", "ANEEL", "IBGE"]}
          titulo={perguntaPerdas("mapa")}
          lead={tx(
            <>
              <Termo slug="perdas-de-energia">Perda</Termo> é a energia que entra na rede e não chega como consumo medido. Aqui, a taxa e o volume das concessionárias somadas e de cada distribuidora.
            </>,
            <>
              <Termo slug="perdas-de-energia">Loss</Termo> is the energy that enters the grid and does not arrive as metered consumption. Here, the rate and the volume of the concession holders combined and of each
              distribution utility.
            </>,
          )}
          recorte={tx(
            <>
              {ref}, ano completo
              {nac ? ` · ${num(nac.n_distribuidoras, 0)} concessionárias somadas` : ""}
              {faixaRef ? ` e ${num(faixaRef.n, 0)} distribuidoras comparadas` : ""} · % da energia injetada de referência e TWh
            </>,
            <>
              {ref}, complete year
              {nac ? ` · ${num(nac.n_distribuidoras, 0)} concession holders combined` : ""}
              {faixaRef ? ` and ${num(faixaRef.n, 0)} distribution utilities compared` : ""} · % of reference injected energy and TWh
            </>,
          )}
          fonte={tx(
            <>ANEEL, SAMP Balanço</>,
            <>
              ANEEL, <Nome>SAMP Balanço</Nome>
            </>,
          )}
          referencia={<ReferenciaPerdas g={g} />}
          metricas={
            <div id="resumo" className="scroll-mt-28">
              <FaixaMetricas colunas={4} rotulo={tx("Perdas das concessionárias e faixa entre as distribuidoras comparáveis", "Losses of the concession holders and range across comparable distribution utilities")}>
                <Numero
                  variante="faixa"
                  rotulo={tx(`Perdas totais das concessionárias, ${ref}`, `Total losses of the concession holders, ${ref}`)}
                  natureza="CALCULADO"
                  evidencia={ev.taxa_nacional}
                  formato="pct"
                  casas={2}
                  unidade={tx("% da energia injetada", "% of injected energy")}
                  periodo={nac ? tx(`${ref} · ${num(nac.n_distribuidoras, 0)} concessionárias`, `${ref} · ${num(nac.n_distribuidoras, 0)} concession holders`) : String(ref)}
                  nota={
                    nac && nac.injetada_mwh !== null
                      ? tx(
                          <>
                            Denominador: energia injetada de referência, {num(nac.injetada_mwh / 1e6, 1)} TWh. A taxa pode diferir da que a ANEEL divulga no relatório, que pode usar outra energia injetada.
                          </>,
                          <>
                            Denominator: reference injected energy, {num(nac.injetada_mwh / 1e6, 1)} TWh. The rate can differ from the one ANEEL publishes in its report, which can use another injected energy.
                          </>,
                        )
                      : undefined
                  }
                  cor="var(--cor-energia)"
                  endereco="https://scrutiniums.com/setor-eletrico/perdas#resumo"
                />
                <Numero
                  variante="faixa"
                  rotulo={tx(`Energia perdida, ${ref}`, `Lost energy, ${ref}`)}
                  natureza="OBSERVADO"
                  evidencia={ev.perdas_nacional}
                  valor={ev.perdas_nacional.valor_calculo === null ? null : ev.perdas_nacional.valor_calculo / 1e6}
                  unidade="TWh"
                  casas={1}
                  periodo={nac ? tx(`${ref} · as mesmas ${num(nac.n_distribuidoras, 0)} concessionárias`, `${ref} · the same ${num(nac.n_distribuidoras, 0)} concession holders`) : String(ref)}
                  nota={nac ? undefined : tx(<>sem soma nacional publicada para {ref}</>, <>no national sum published for {ref}</>)}
                  cor="var(--cor-energia)"
                  endereco="https://scrutiniums.com/setor-eletrico/perdas#resumo"
                />
                <Numero
                  variante="faixa"
                  rotulo={tx("Variação da taxa de perdas", "Change in the loss rate")}
                  natureza="CALCULADO"
                  valor={variacaoMesmas(parTaxa)}
                  formato="variacao"
                  casas={2}
                  unidade="p.p."
                  periodo={
                    mesmas
                      ? tx(`${ref} contra ${ref - 1} · as mesmas ${num(mesmas.n_total, 0)} concessionárias`, `${ref} against ${ref - 1} · the same ${num(mesmas.n_total, 0)} concession holders`)
                      : undefined
                  }
                  motivoAusencia={tx(`Sem comparação nas mesmas concessionárias para ${ref}.`, `No comparison in the same concession holders for ${ref}.`)}
                  cor="var(--cor-energia)"
                />
                <Numero
                  variante="faixa"
                  rotulo={tx(`Mediana simples das distribuidoras, ${ref}`, `Simple median of the distribution utilities, ${ref}`)}
                  natureza="CALCULADO"
                  valor={faixaRef?.mediana ?? null}
                  formato="pct"
                  casas={2}
                  unidade={tx("% da energia injetada", "% of injected energy")}
                  periodo={faixaRef ? tx(`${ref} · ${num(faixaRef.n, 0)} distribuidoras comparáveis`, `${ref} · ${num(faixaRef.n, 0)} comparable distribution utilities`) : String(ref)}
                  motivoAusencia={tx("Nenhuma distribuidora com valor comparável no ano.", "No distribution utility with a comparable value in the year.")}
                  nota={
                    faixaRef?.minimo && faixaRef.maximo
                      ? tx(
                          <>
                            Faixa observada: {textoNumero(faixaRef.minimo.v, MEDIDAS.taxa)} a {textoNumero(faixaRef.maximo.v, MEDIDAS.taxa)}.
                          </>,
                          <>
                            Observed range: {textoNumero(faixaRef.minimo.v, MEDIDAS.taxa)} to {textoNumero(faixaRef.maximo.v, MEDIDAS.taxa)}.
                          </>,
                        )
                      : undefined
                  }
                  cor="var(--serie-referencia)"
                />
              </FaixaMetricas>
            </div>
          }
        >
          {tx(
            <>
              Parte da energia que entra na rede de cada distribuidora não chega a ser entregue como consumo medido: são as <Termo slug="perdas-de-energia">perdas</Termo>. Uma parte é a das{" "}
              <Termo slug="perdas-tecnicas">perdas técnicas</Termo>, ligada à física das redes; a outra, as <Termo slug="perdas-nao-tecnicas">perdas não técnicas</Termo>, é a diferença entre a perda total e a técnica
              e inclui furto, fraude e erros de medição e faturamento. Aqui estão volume, taxa, trajetória, composição, o percentual técnico regulatório e o custo das perdas na tarifa de cada distribuidora.
            </>,
            <>
              Part of the energy that enters each distribution utility&apos;s grid is not delivered as metered consumption: these are the <Termo slug="perdas-de-energia">losses</Termo>. One part is the{" "}
              <Termo slug="perdas-tecnicas">technical losses</Termo>, linked to the physics of the grids; the other, the <Termo slug="perdas-nao-tecnicas">non-technical losses</Termo>, is the difference between
              the total loss and the technical loss and includes theft, fraud and metering and billing errors. Here are the volume, rate, trajectory, composition, the regulatory technical percentage and the cost of
              losses in the tariff of each distribution utility.
            </>,
          )}
        </CabecalhoModulo>

        <ModoProfundidade>
          <PerdasLevaEscolha />
          <Bloco id="mapa">
            <PainelEvidencia
              id="painel-mapa"
              pergunta={tx("Como variam as perdas entre as distribuidoras?", "How do losses vary across distribution utilities?")}
              subtitulo={tx(
                `Perdas por área de distribuidora · taxa, volume, técnicas, não técnicas e variação · ${periodoMapa}`,
                `Losses by distribution utility area · rate, volume, technical, non-technical and change · ${periodoMapa}`,
              )}
              natureza="CALCULADO"
              proveniencia={g.proveniencia.taxas}
              complementares={[
                { rotulo: tx("Perdas totais em energia", "Total losses in energy"), p: g.proveniencia.volumes },
                { rotulo: tx("Área de atuação por municípios", "Service area by municipality"), p: g.proveniencia.territorio },
              ]}
              porQueImporta={tx(
                <>
                  A energia perdida entra no custo da distribuidora: a ANEEL reconhece na tarifa um nível de perdas para cada uma e limita o repasse do que passa dele. Com taxa maior, a mesma rede precisa de mais energia para
                  entregar o mesmo consumo.
                </>,
                <>
                  The lost energy enters the cost of the distribution utility: ANEEL recognizes in the tariff a level of losses for each one and limits the pass-through of anything above it. With a higher rate, the same grid
                  needs more energy to deliver the same consumption.
                </>,
              )}
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              extraFonte={tx(<>Malha municipal: IBGE.</>, <>Municipal boundaries: IBGE.</>)}
            >
              <PerdasExplorador
                distribuidoras={leves}
                periodos={periodos}
                anoRef={ref}
                nacional={g.nacional}
                acumulado={g.acumulado}
                urls={{ anual: g.series.anual, municipios: g.series.municipios, evidencias: g.series.evidencias }}
                versao={versao}
                anoRelacao={g.mapa.ano_relacao}
                respostaGeral={
                  <RespostaCurta id="geral" veredito={marcarNomes(vereditoGeral(g), Object.values(rotulos), idioma)} depois>
                    {marcarNomes(respostaGeral(g), Object.values(rotulos), idioma)}
                  </RespostaCurta>
                }
                notas={<NotasDoPainel nome={tx("comparação entre distribuidoras", "comparison across distribution utilities")} oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />}
                aposPrincipal={<PerdasCapitulos />}
                limitacaoMapa={
                  <>
                    {bloqueioGeometria && (
                      <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted" data-bloqueio="geometria">
                        {tx(
                          <>
                            Limitação: o {itemGeometria} não está acessível ao observatório. A área é desenhada pelos municípios do IBGE ligados à distribuidora pela relação oficial da ANEEL; limites dentro de municípios
                            compartilhados e a área em km² da concessão não podem ser lidos aqui.
                          </>,
                          <>
                            Limitation: the {itemGeometria} is not accessible to the observatory. The area is drawn by the IBGE municipalities linked to the distribution utility by ANEEL&apos;s official relation; boundaries
                            within shared municipalities and the concession area in km² cannot be read here.
                          </>,
                        )}
                        <span data-nivel="analisar">
                          {" "}
                          {tx("Evidência da coleta:", "Collection evidence:")} {traduzOuMarca(bloqueioGeometria.evidencia, TEXTOS_PERDAS_EN, idioma, "bloqueio-evidencia")}
                        </span>
                      </p>
                    )}
                  </>
                }
              />
              <PerdasSeguir
                ancora="mapa"
                proxima={{ pergunta: perguntaPerdas("composicao"), href: "/setor-eletrico/perdas/composicao" }}
                downloads={[
                  { rotulo: tx("Por distribuidora e ano (CSV)", "By distribution utility and year (CSV)"), url: "/energia/series/perdas_distribuidoras.csv" },
                  { rotulo: tx("Municípios e distribuidoras (CSV)", "Municipalities and distribution utilities (CSV)"), url: "/energia/series/perdas_municipios.csv" },
                ]}
              />
            </PainelEvidencia>
          </Bloco>

          <Bloco id="evolucao">
            <PainelEvidencia
              id="painel-evolucao"
              pergunta={tx(`Como a taxa de perdas das concessionárias evoluiu desde ${inicioSerie}?`, `How has the loss rate of the concession holders evolved since ${inicioSerie}?`)}
              subtitulo={tx(
                "Perdas totais das concessionárias · % da energia injetada de referência · anos completos",
                "Total losses of the concession holders · % of reference injected energy · complete years",
              )}
              natureza="CALCULADO"
              proveniencia={g.proveniencia.taxas}
              porQueImporta={tx(
                <>A série longa separa tendência de oscilação de um ano e mostra a quebra de {ANO_LEIAUTE_SAMP}, quando o SAMP mudou de leiaute.</>,
                <>The long series separates a trend from a one-year fluctuation and shows the {ANO_LEIAUTE_SAMP} break, when SAMP changed its layout.</>,
              )}
              oQueMudou={oQueMudouEvolucao}
              comoInterpretar={comoInterpretarEvolucao}
              naoConcluir={naoConcluirEvolucao}
              naoConcluirNoCorpo
            >
              <div className="grid gap-x-10 gap-y-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
                <Resposta id="evolucao" veredito={vereditoEvolucao(g.nacional)} prova={<ComproveNumero evidencia={ev.taxa_nacional} rotulo={tx(`Comprove a taxa de ${ref}`, `Check the ${ref} rate`)} />}>
                  {respostaEvolucao(g.nacional, ref)}
                </Resposta>
                <Numero
                  variante="faixa"
                  rotulo={rotuloAcumulado ? tx(`Perdas totais, ${rotuloAcumulado}`, `Total losses, ${rotuloAcumulado}`) : tx("Acumulado do ano aberto", "Year to date of the open year")}
                  natureza="CALCULADO"
                  evidencia={ev.acumulado}
                  formato="pct"
                  casas={2}
                  unidade={tx("% da energia injetada de referência", "% of reference injected energy")}
                  motivoAusencia={tx("Sem recorte do ano aberto publicado por ao menos 90% das distribuidoras.", "No open-year selection published by at least 90% of the distribution utilities.")}
                  variacao={
                    acumConc
                      ? {
                          valor: variacaoMesmas([acumConc.anterior.taxa_total_pct, acumConc.atual.taxa_total_pct]),
                          casas: 2,
                          sufixo: " p.p.",
                          referencia: tx(
                            `contra o mesmo período de ${(g.acumulado?.ano ?? ref + 1) - 1}, nas mesmas ${acumConc.n_distribuidoras} concessionárias`,
                            `against the same period of ${(g.acumulado?.ano ?? ref + 1) - 1}, in the same ${acumConc.n_distribuidoras} concession holders`,
                          ),
                        }
                      : undefined
                  }
                  nota={tx(
                    <>
                      Ano aberto: não compete com os anos completos do gráfico.
                      {mesFimAcum ? ` O recorte termina em ${mesFimAcum}, o último mês que ao menos 90% das distribuidoras válidas em ${ref} já publicaram sem lacuna desde janeiro.` : ""}
                    </>,
                    <>
                      Open year: it does not compete with the complete years in the chart.
                      {mesFimAcum ? ` The selection ends in ${mesFimAcum}, the last month that at least 90% of the valid distribution utilities in ${ref} have published with no gap since January.` : ""}
                    </>,
                  )}
                  cor="var(--serie-referencia)"
                  endereco="https://scrutiniums.com/setor-eletrico/perdas#evolucao"
                />
              </div>
              {g.referencia.aviso_parcial && (
                <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted">{traduzOuMarca(g.referencia.aviso_parcial, TEXTOS_PERDAS_EN, idioma, "aviso-parcial")}</p>
              )}
              <GraficoLinhas
                titulo={tx("Taxa de perdas totais das concessionárias por ano", "Total loss rate of the concession holders by year")}
                dados={serieNacional(g.nacional)}
                chaveX="ano" // i18n: dado
                formatoX="texto"
                series={[{ id: "taxa", rotulo: tx("Concessionárias", "Concession holders"), cor: "var(--cor-energia)", espessura: 2.5 }]} // i18n: dado
                unidade="%"
                casas={2}
                zeroNoEixo
                marcos={[{ x: String(ANO_LEIAUTE_SAMP), rotulo: tx(`${ANO_LEIAUTE_SAMP}: leiaute da REN 1.003/2022`, `${ANO_LEIAUTE_SAMP}: layout of REN 1.003/2022`) }]}
                altura={280}
              />
              <Recorte
                periodo={tx(`${inicioSerie} a ${ref}, anos completos; o ano aberto fica à parte`, `${inicioSerie} to ${ref}, complete years; the open year is kept apart`)}
                universo={tx("concessionárias com os 12 meses e sem alerta físico em cada ano", "concession holders with the 12 months and no physical alert in each year")}
                unidade={tx("% da energia injetada de referência", "% of reference injected energy")}
              />
              <TabelaDados
                titulo={tx("Série nacional das concessionárias", "National series of the concession holders")}
                colunas={tx(
                  ["Ano", "Somadas", "Com dado", "Perdas (GWh)", "Injetada (GWh)", "Taxa (%)", "Mesmo universo do ano anterior", "Nas mesmas do ano anterior (n)", "Fora da soma"],
                  ["Year", "Combined", "With data", "Losses (GWh)", "Injected (GWh)", "Rate (%)", "Same universe as the previous year", "In the same as the previous year (n)", "Excluded from the sum"],
                )}
                linhas={linhasNacionais(g.nacional)}
                casas={[0, 0, 0, 0, 0, 2, null, null, null]}
                limite={40}
                csv="/energia/series/perdas_nacional.csv"
              />
              <NotasDoPainel nome={tx("evolução da taxa das concessionárias", "evolution of the concession holders' rate")} oQueMudou={oQueMudouEvolucao} comoInterpretar={comoInterpretarEvolucao} naoConcluir={naoConcluirEvolucao} />
              <PerdasSeguir
                ancora="evolucao"
                proxima={{ pergunta: tx("Como cada distribuidora evoluiu? Compare até quatro", "How has each distribution utility evolved? Compare up to four"), href: "#perdas-comparar" }}
                downloads={[{ rotulo: tx("Série nacional por universo (CSV)", "National series by universe (CSV)"), url: "/energia/series/perdas_nacional.csv" }]}
              />
            </PainelEvidencia>
          </Bloco>

          <Bloco id="separacao">
            <SecaoDoPainel
              id="perdas-separacao"
              titulo={tx("Quanto da perda é estimado como técnica e como não técnica?", "How much of the loss is estimated as technical and as non-technical?")}
              lead={vereditoComposicao(g)}
            >
              <SeparacaoMetricas g={g} endereco="https://scrutiniums.com/setor-eletrico/perdas#separacao" />
            </SecaoDoPainel>
          </Bloco>

          <PerdasAuditoria g={g} />
        </ModoProfundidade>
      </main>
    </>
  );
}
