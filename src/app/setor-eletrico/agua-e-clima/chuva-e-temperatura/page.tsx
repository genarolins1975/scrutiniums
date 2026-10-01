import type { Metadata } from "next";
import Link from "next/link";
import { AguaClima } from "@/components/energia/AguaClima";
import {
  AguaAnalise,
  AguaAuditoria,
  AguaAviso,
  AguaFontes,
  AguaIndisponivel,
  AguaNavegacao,
  AguaParteAusente,
  AguaRegras,
  AguaSeguir,
} from "@/components/energia/AguaPagina";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { Numero } from "@/components/energia/Numero";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import {
  COLUNAS_COBERTURA_CHUVA,
  COLUNAS_COBERTURA_TEMPERATURA,
  COLUNAS_VALIDACAO,
  baciaPadraoChuva,
  linhasCoberturaChuva,
  linhasCoberturaTemperatura,
  linhasValidacao,
  notaAnomaliaTemperatura,
  notaChuvaBacia,
  periodoBase,
  periodoValidacao,
  perguntaPainel,
  rotaPainel,
  rotuloRecorte,
  situacaoAtualidade,
  textoCobertura,
  textoValidacao,
} from "@/lib/energia/agua";
import { carimbo, dataBR } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import type { Natureza } from "@/lib/energia/tipos";
import type { AguaDetalheGold } from "@/lib/energia/tipos-agua";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Água e clima: chuva, temperatura e previsão",
  description:
    "Chuva estimada por satélite em cada bacia do ONS e temperatura de reanálise por subsistema, contra a média climatológica dos mesmos dias, com mapa por bacia, cobertura da grade, conferência com estações e a previsão de uma rodada do ECMWF separada da estimativa.",
  alternates: { canonical: "/setor-eletrico/agua-e-clima/chuva-e-temperatura" },
};

const URL_GEO_BACIAS = "/energia/series/agua_bacias_geo.json";

export default function ClimaPage() {
  const g = lerGold<AguaDetalheGold>("agua_detalhe.json");
  if (!integra(g)) return <AguaIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const c = g.clima;
  const ev = g.evidencias;
  const prov = g.proveniencia;
  const atualChuva = situacaoAtualidade(g.dias_referencia.precipitacao, g.gerado_em, 21, "o IMERG chega ao NASA POWER com cerca de duas semanas de atraso");
  const atualTemp = situacaoAtualidade(g.dias_referencia.temperatura, g.gerado_em, 7, "a reanálise chega ao NASA POWER com alguns dias de atraso");
  const downloads = g.downloads.filter((d) => /clima_diario|agua_temperatura|agua_precipitacao|agua_previsao|agua_clima_pontos|agua_bacias_geo/.test(d.url));
  const baciaPadrao = c ? baciaPadraoChuva(g.armazenamento.bacias, c.precipitacao_bacias) : "";
  const bPadrao = c?.precipitacao_bacias.find((b) => b.bacia === baciaPadrao) ?? null;
  const tSin = c?.temperatura.find((t) => t.recorte === "SIN") ?? null;
  const pendPrev = g.pendencias.filter((p) => /previs/i.test(p));
  // base climatológica e período da conferência com estações: lidos da gold, não escritos aqui
  const baseTxt = c ? periodoBase(c.base_climatologica) : null;
  const perVal = c ? periodoValidacao(c.validacao_estacoes) : null;
  const separacao: { rotulo: string; natureza: Natureza; texto: string }[] = c
    ? [
        { rotulo: "Observação", natureza: "OBSERVADO", texto: c.separacao.observacao },
        { rotulo: "Estimativa", natureza: "ESTIMADO", texto: c.separacao.estimativa },
        { rotulo: "Previsão", natureza: "PREVISTO", texto: c.separacao.previsao },
        { rotulo: "Cenário", natureza: "CENARIO", texto: c.separacao.cenario },
      ]
    : [];

  return (
    <>
      <CabecalhoEnergia atual="agua-e-clima" />
      <MarcaVisita secao="energia:agua-e-clima" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6">
        <CabecalhoModulo
          rotulo="Água e clima"
          titulo="Chuva, temperatura e clima"
          referencia={
            <>
              NASA POWER (IMERG e MERRA-2), chuva até {dataBR(g.dias_referencia.precipitacao)} e temperatura até {dataBR(g.dias_referencia.temperatura)}; ECMWF IFS pelo
              Open-Meteo (previsão); contornos de bacia do ONS; processado em {carimbo(g.gerado_em)}.
            </>
          }
        >
          A chuva nas bacias alimenta a afluência dos reservatórios, e a temperatura acompanha a demanda por energia. Esta página mostra a chuva estimada por satélite
          (<Termo slug="imerg">IMERG</Termo>) em cada bacia do ONS e a temperatura estimada por reanálise (<Termo slug="merra-2">MERRA-2</Termo>) em cada subsistema,
          contra a média dos mesmos dias{baseTxt ? ` em ${baseTxt}` : ""}, e separa estimativa, observação, previsão e cenário.
        </CabecalhoModulo>
        <AguaNavegacao atual="p019" />
        <ModoProfundidade>
          <Bloco id="clima">
            <PainelEvidencia
              id="p019"
              pergunta={perguntaPainel("p019")}
              subtitulo={`Chuva por bacia (mm e anomalia em %) e temperatura por subsistema (°C) · estimativas contra ${baseTxt ?? "a climatologia publicada"} · previsão em bloco separado`}
              natureza="ESTIMADO"
              porQueImporta={
                <>
                  Chuva nas cabeceiras vira vazão nos rios e afluência aos reservatórios, com atraso que depende da bacia e do solo; a temperatura costuma andar junto com a
                  demanda por energia, associação que o painel de carga mede. Ver as duas por bacia e por subsistema, com a mesma base histórica, situa a
                  água que chega e o clima em que a demanda acontece.
                </>
              }
              oQueMudou={
                <>
                  {atualChuva.texto} {atualTemp.texto}
                </>
              }
              comoInterpretar={
                <>
                  A anomalia de chuva é a chuva do período dividida pela média dos mesmos dias{baseTxt ? ` em ${baseTxt}` : ""}, menos um; a de temperatura é a diferença em °C. No período seco,
                  médias de poucos milímetros produzem percentuais grandes: o mapa usa classes fixas e a tabela traz os milímetros. A correlação entre chuva e ENA é associação
                  descritiva.
                </>
              }
              naoConcluir={
                <>
                  Chuva por satélite e temperatura de reanálise são estimativas, não medições de estação (o INMET não respondeu nas tentativas de coleta). Chuva acima da média não
                  garante afluência acima da média, e a correlação não identifica causa. A previsão é de um único modelo e de uma rodada, sem avaliação de acerto ainda, e nenhum
                  cenário climático de longo prazo é apresentado.
                </>
              }
              proveniencia={prov.precipitacao!}
              complementares={[
                ...(prov.temperatura ? [{ rotulo: "Temperatura por subsistema", p: prov.temperatura }] : []),
                ...(prov.previsao ? [{ rotulo: "Previsão (uma rodada)", p: prov.previsao }] : []),
              ]}
            >
              <div className="space-y-6">
                {atualChuva.defasada && <AguaAviso tipo="alerta">{atualChuva.texto}</AguaAviso>}
                {atualTemp.defasada && <AguaAviso tipo="alerta">{atualTemp.texto}</AguaAviso>}
                {c ? (
                  <>
                    <dl className="grid gap-px border border-linha bg-linha sm:grid-cols-2" data-separacao="p019">
                      {separacao.map((x) => (
                        <div key={x.rotulo} className="bg-superficie px-4 py-3">
                          <dt className="flex flex-wrap items-center gap-2">
                            <span className="rotulo text-mineral">{x.rotulo}</span>
                            <SeloNatureza natureza={x.natureza} compacto />
                          </dt>
                          <dd className="mt-1 text-sm leading-relaxed text-carvao-muted">{x.texto}</dd>
                        </div>
                      ))}
                    </dl>
                    <AguaClima
                      precipitacao={c.precipitacao_bacias}
                      temperatura={c.temperatura}
                      previsao={c.previsao}
                      base={c.base_climatologica}
                      baciaPadrao={baciaPadrao}
                      urlGeo={URL_GEO_BACIAS}
                      fonteChuva="NASA POWER (IMERG), média por bacia do ONS calculada pelo observatório"
                      fonteTemperatura="NASA POWER (MERRA-2 e GEOS-IT), média por subsistema calculada pelo observatório"
                      versaoChuva={g.dias_referencia.precipitacao ?? g.gerado_em}
                      versaoTemperatura={g.dias_referencia.temperatura ?? g.gerado_em}
                      motivoSemPrevisao={
                        pendPrev.length
                          ? `Sem previsão publicada: ${pendPrev.join("; ")}. A previsão nunca é substituída por uma rodada velha nem pela média.`
                          : "Sem previsão publicada nesta execução: nenhuma rodada com menos de 48 horas e com todos os recortes completos. A previsão nunca é substituída por uma rodada velha nem pela média."
                      }
                      destaques={
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Numero
                            rotulo="Anomalia da temperatura do SIN em 30 dias"
                            natureza="ESTIMADO"
                            evidencia={ev.temperatura_sin_30d}
                            formato="num"
                            casas={1}
                            unidade="°C"
                            tamanho="medio"
                            cor="var(--serie-termica)"
                            nota={tSin ? notaAnomaliaTemperatura(tSin, c.base_climatologica) : undefined}
                            endereco={`${rotaPainel("p019")}#temperatura`}
                          />
                          <Numero
                            rotulo={`Chuva de 30 dias, ${bPadrao ? rotuloRecorte("bacia", bPadrao.bacia) : "sem bacia"} (a de maior EAR máxima)`}
                            natureza="ESTIMADO"
                            evidencia={ev.precipitacao_maior_bacia_30d}
                            formato="num"
                            casas={1}
                            unidade="mm"
                            tamanho="medio"
                            cor="var(--serie-hidraulica)"
                            nota={bPadrao ? notaChuvaBacia(bPadrao, c.base_climatologica) : undefined}
                            endereco={`${rotaPainel("p019")}#p019`}
                          />
                        </div>
                      }
                    />
                    <p className="text-sm text-carvao-muted">
                      A relação entre temperatura e carga é medida no painel de carga, com a sua própria série de temperatura (NASA POWER nas capitais, ponderadas pela
                      população; outra seleção de células, então os graus não são os desta página):{" "}
                      <Link href="/setor-eletrico/carga/clima-e-calendario#p027" className="text-energia-dark underline underline-offset-4">
                        quanto da variação da carga é compatível com clima e calendário
                      </Link>
                      . A chuva se compara com a afluência:{" "}
                      <Link href={`${rotaPainel("p018")}#p018`} className="text-energia-dark underline underline-offset-4">
                        a água que chega está acima do normal?
                      </Link>
                    </p>
                  </>
                ) : (
                  <AguaParteAusente
                    titulo="Chuva e temperatura indisponíveis nesta publicação"
                    motivo={g.pendencias.filter((p) => /clima/i.test(p)).join("; ") || "O bloco de clima não foi construído nesta execução; nenhum número de reserva é exibido."}
                  />
                )}

                {c && (
                  <AguaAnalise id="cobertura" titulo="Cobertura da grade, agregação espacial e conferência com estações">
                    <p className="max-w-prose2 text-sm leading-relaxed text-carvao" data-texto="cobertura">
                      {textoCobertura(c)}
                    </p>
                    <TabelaInterativa
                      titulo="Pontos de grade por bacia e polígonos do ONS que compõem cada uma"
                      colunas={COLUNAS_COBERTURA_CHUVA}
                      linhas={linhasCoberturaChuva(c.cobertura_precipitacao)}
                      chaveLinha="id"
                      colunaRotulo="rotulo"
                      fonte="NASA POWER (IMERG) e contornos das bacias do ONS"
                      versao={g.dias_referencia.precipitacao ?? g.gerado_em}
                      nomeArquivo="agua-cobertura-chuva"
                      nota="Grade de 1°, adensada para 0,5°, 0,25° e 0,1° enquanto o polígono tiver menos de 5 pontos. A lista de pontos está no manifesto espacial (CSV)."
                    />
                    <TabelaInterativa
                      titulo="Células de temperatura por UF e a população que representam"
                      colunas={COLUNAS_COBERTURA_TEMPERATURA}
                      linhas={linhasCoberturaTemperatura(c.cobertura_temperatura)}
                      chaveLinha="id"
                      colunaRotulo="uf"
                      fonte="NASA POWER (MERRA-2); IBGE, sedes municipais e Censo 2022"
                      versao={g.dias_referencia.temperatura ?? g.gerado_em}
                      nomeArquivo="agua-cobertura-temperatura"
                      nota="Células mais populosas até metade da população da UF (no máximo 6). O mapeamento UF para subsistema é o de 2026 e vale para toda a série."
                    />
                    <p className="text-sm text-carvao-muted" data-texto="validacao">
                      {textoValidacao(c.validacao_estacoes)}
                    </p>
                    <TabelaInterativa
                      titulo={`IMERG contra estações por bacia${perVal ? `, ${perVal}` : ""}`}
                      colunas={COLUNAS_VALIDACAO}
                      linhas={linhasValidacao(c.validacao_estacoes)}
                      chaveLinha="id"
                      colunaRotulo="rotulo"
                      fonte={`ONS, Precipitação Diária Observada${perVal ? ` (${perVal})` : ""}; NASA POWER (IMERG)`}
                      versao={c.validacao_estacoes.periodo?.fim ?? g.gerado_em}
                      nomeArquivo="agua-validacao-imerg-estacoes"
                    />
                  </AguaAnalise>
                )}

                <AguaAuditoria id="regras-p019" titulo="Regras, fontes e arquivos">
                  <AguaRegras regras={g.regras} chaves={["precipitacao", "temperatura", "anomalia", "previsao"]} />
                  <AguaFontes provs={[prov.precipitacao, prov.temperatura, prov.previsao]} />
                  {g.pendencias.length > 0 && (
                    <div>
                      <p className="rotulo text-mineral">Partes não construídas nesta execução</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-carvao-muted">
                        {g.pendencias.map((p) => (
                          <li key={p}>{p}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </AguaAuditoria>

                <AguaSeguir ancora="p019" proximo={{ href: `${rotaPainel("p020")}#p020`, pergunta: perguntaPainel("p020") }} downloads={downloads} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
