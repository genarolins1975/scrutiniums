import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { Termo } from "@/components/evidencia/Termo";
import { Numero } from "@/components/energia/Numero";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { TabelaDados } from "@/components/energia/TabelaDados";
import { PerdasExplorador } from "@/components/energia/PerdasExplorador";
import { PerdasAuditoria } from "@/components/energia/PerdasAuditoria";
import { PerdasLinkConsulta } from "@/components/energia/PerdasLinkConsulta";
import { LINK_PERDAS, PAGINAS_PERDAS, PERGUNTA_REGULATORIO, PerdasNavegacao, ReferenciaPerdas, RodapePainel, Recorte, Resposta } from "@/components/energia/PerdasPainel";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { integra, lerGold } from "@/lib/energia/gold";
import { dataBR, mesAno, num } from "@/lib/energia/formato";
import type { PerdasGold } from "@/lib/energia/tipos-perdas";
import {
  ANO_LEIAUTE_SAMP,
  anosSerieNacional,
  fraseMudanca,
  leve,
  linhaNacional,
  linhasCusto,
  linhasNacionais,
  linhasRegulatorio,
  pctOu,
  periodosDisponiveis,
  respostaEvolucao,
  respostaGeral,
  serieNacional,
  variacaoMesmas,
  vereditoComposicao,
  vereditoCusto,
  vereditoEvolucao,
  vereditoGeral,
  vereditoRegulatorio,
} from "@/lib/energia/perdas";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Perdas de energia na distribuição",
  description:
    "Onde se perde energia em cada distribuidora, quanto e como evoluiu: mapa das áreas de atuação, taxa com denominador explícito, comparação de até quatro distribuidoras e a série anual do SAMP, com a fonte da ANEEL.",
  alternates: { canonical: "/setor-eletrico/perdas" },
};

export default function PerdasPage() {
  const g = lerGold<PerdasGold>("perdas.json");
  if (!integra(g)) {
    return (
      <>
        <CabecalhoEnergia atual="perdas" />
        <main id="conteudo" tabIndex={-1} className="ed-pagina py-14">
          <Indisponivel titulo="Perdas indisponíveis" motivo={g?.motivo ?? "Os dados processados de perdas não foram gerados nesta publicação."} />
        </main>
      </>
    );
  }

  const ref = g.referencia.ano;
  const ev = g.evidencias;
  const nac = linhaNacional(g, ref);
  const acumConc = g.acumulado?.agregados.find((a) => a.universo === "concessionarias") ?? null;
  const versao = `SAMP até ${mesAno(g.referencia.ultima_competencia)}, publicado em ${dataBR(g.gerado_em)}`;
  const bloqueioGeometria = g.bloqueios.find((b) => b.item.includes("P055")) ?? null;
  // o item do bloqueio entra no meio da frase: sem o ID do painel e com inicial minúscula
  const itemGeometria = bloqueioGeometria ? bloqueioGeometria.item.replace(/ \(P055\)$/, "").replace(/^./, (c) => c.toLowerCase()) : "";
  const mesFimAcum = g.acumulado ? mesAno(`${g.acumulado.ano}-${String(g.acumulado.mes_fim).padStart(2, "0")}`) : null;
  const periodos = periodosDisponiveis(g);
  const rotuloAcumulado = periodos.find((p) => p.tipo === "acumulado")?.rotulo ?? null;
  // anos da série e do mapa lidos da gold, nunca escritos à mão
  const anos = anosSerieNacional(g.nacional);
  const inicioSerie = anos?.inicio ?? ref;
  const periodoMapa = `${inicioSerie} a ${ref}${g.acumulado ? ` e ${g.acumulado.ano} até ${mesFimAcum}` : ""}`;
  // vereditos das outras páginas, para a abertura dizer o essencial de cada painel (a resposta completa fica em cada página)
  const outras = [
    { pagina: PAGINAS_PERDAS[1], pergunta: "Qual parte das perdas é técnica e qual é não técnica?", resposta: vereditoComposicao(g) },
    { pagina: PAGINAS_PERDAS[2], pergunta: PERGUNTA_REGULATORIO, resposta: vereditoRegulatorio(linhasRegulatorio(g.distribuidoras)) },
    { pagina: PAGINAS_PERDAS[3], pergunta: "Qual é a dimensão econômica e territorial das perdas?", resposta: vereditoCusto(linhasCusto(g.distribuidoras), g.referencia.tarifa_consultada_em) },
  ];

  return (
    <>
      <CabecalhoEnergia atual="perdas" />
      <MarcaVisita secao="energia:perdas" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo siglas={["SAMP", "MMGD", "REN", "ANEEL", "IBGE"]}
          rotulo="Perdas de energia"
          titulo="Onde se perde energia, quanto e com que efeito econômico?"
          referencia={<ReferenciaPerdas g={g} />}
        >
          Parte da energia que entra na rede de cada distribuidora não chega a ser entregue como consumo medido: são as <Termo slug="perdas-de-energia">perdas</Termo>. Uma parte vem da física das
          redes (<Termo slug="perdas-tecnicas">perdas técnicas</Termo>); outra, de furto, fraude e erros de medição e faturamento (<Termo slug="perdas-nao-tecnicas">perdas não técnicas</Termo>). Aqui estão
          volume, taxa, trajetória, composição, o percentual técnico regulatório e o custo das perdas na tarifa de cada distribuidora.
        </CabecalhoModulo>
        <PerdasNavegacao atual="mapa" />

        <ModoProfundidade>
          <Bloco id="resumo">
            <section aria-labelledby="perdas-resumo" className="border border-linha bg-superficie px-5 py-6 md:px-8">
              <h2 id="perdas-resumo" className="font-serif text-xl text-carvao md:text-2xl">
                Quanto se perde na distribuição?
              </h2>
              <div className="mt-3">
                <RespostaCurta id="geral" veredito={vereditoGeral(g)}>
                  {respostaGeral(g)}
                </RespostaCurta>
              </div>
              {g.referencia.aviso_parcial && <p className="mt-2 max-w-prose2 text-xs leading-relaxed text-carvao-muted">{g.referencia.aviso_parcial}</p>}
              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Numero
                  rotulo={`Perdas totais das concessionárias, ${ref}`}
                  natureza="CALCULADO"
                  evidencia={ev.taxa_nacional}
                  formato="pct"
                  casas={2}
                  unidade="%"
                  periodo={String(ref)}
                  variacao={
                    nac?.mesmas_ano_anterior
                      ? { valor: variacaoMesmas(nac.mesmas_ano_anterior.taxa_total_pct), casas: 2, sufixo: " p.p.", referencia: `contra ${ref - 1}, nas mesmas ${nac.mesmas_ano_anterior.n_total} concessionárias` }
                      : undefined
                  }
                  nota={<>da energia injetada de referência</>}
                  endereco="https://scrutiniums.com/setor-eletrico/perdas#resumo"
                />
                <Numero
                  rotulo={`Energia perdida pelas concessionárias, ${ref}`}
                  natureza="OBSERVADO"
                  evidencia={ev.perdas_nacional}
                  valor={ev.perdas_nacional.valor_calculo === null ? null : ev.perdas_nacional.valor_calculo / 1e6}
                  unidade="TWh"
                  casas={1}
                  periodo={String(ref)}
                  nota={nac ? <>soma das perdas medidas das {num(nac.n_distribuidoras, 0)} concessionárias válidas</> : <>sem soma nacional publicada para {ref}</>}
                  endereco="https://scrutiniums.com/setor-eletrico/perdas#resumo"
                />
                <Numero
                  rotulo={`Não técnicas sobre a baixa tensão, ${ref}`}
                  natureza="ESTIMADO"
                  evidencia={ev.pnt_bt_nacional}
                  formato="pct"
                  casas={2}
                  unidade="%"
                  periodo={String(ref)}
                  nota={
                    nac ? (
                      <>
                        só {nac.n_com_pnt_bt} de {nac.n_distribuidoras} concessionárias ({pctOu(nac.cobertura_bt_pct, 1)} do mercado de baixa tensão) publicaram a separação fechando
                      </>
                    ) : undefined
                  }
                  endereco="https://scrutiniums.com/setor-eletrico/perdas#resumo"
                />
                <Numero
                  rotulo={rotuloAcumulado ? `Perdas totais, ${rotuloAcumulado}` : "Acumulado do ano aberto"}
                  natureza="CALCULADO"
                  evidencia={ev.acumulado}
                  formato="pct"
                  casas={2}
                  unidade="%"
                  motivoAusencia="Sem recorte do ano aberto publicado por ao menos 90% das distribuidoras."
                  variacao={
                    acumConc
                      ? { valor: variacaoMesmas([acumConc.anterior.taxa_total_pct, acumConc.atual.taxa_total_pct]), casas: 2, sufixo: " p.p.", referencia: `contra o mesmo período de ${(g.acumulado?.ano ?? ref + 1) - 1}, nas mesmas ${acumConc.n_distribuidoras}` }
                      : undefined
                  }
                  nota={<>ano aberto: não compete com anos completos</>}
                  endereco="https://scrutiniums.com/setor-eletrico/perdas#resumo"
                />
              </div>
            </section>
          </Bloco>

          <Bloco id="mapa">
            <PainelEvidencia
              id="painel-mapa"
              pergunta="Onde estão as perdas e como evoluíram?"
              subtitulo={`Perdas por área de distribuidora · taxa, volume, técnicas, não técnicas e variação · ${periodoMapa}`}
              natureza="CALCULADO"
              proveniencia={g.proveniencia.taxas}
              complementares={[
                { rotulo: "Perdas totais em energia", p: g.proveniencia.volumes },
                { rotulo: "Área de atuação por municípios", p: g.proveniencia.territorio },
              ]}
              porQueImporta={
                <>
                  Energia perdida é custo: a ANEEL reconhece na tarifa um nível de perdas considerado eficiente para cada distribuidora e limita o repasse do que passa dele. Onde a taxa é alta, a mesma
                  rede precisa de mais energia para entregar o mesmo consumo.
                </>
              }
              oQueMudou={
                nac?.mesmas_ano_anterior?.taxa_total_pct && nac.mesmas_ano_anterior.taxa_total_pct[0] !== null && nac.mesmas_ano_anterior.taxa_total_pct[1] !== null ? (
                  <>
                    Nas mesmas {nac.mesmas_ano_anterior.n_total} concessionárias, a taxa agregada {fraseMudanca(nac.mesmas_ano_anterior.taxa_total_pct[0], nac.mesmas_ano_anterior.taxa_total_pct[1])} de {ref - 1}{" "}
                    para {ref}.
                    {acumConc && acumConc.atual.taxa_total_pct !== null && acumConc.anterior.taxa_total_pct !== null && (
                      <> No acumulado de {g.acumulado!.ano} até {mesFimAcum}, a taxa {fraseMudanca(acumConc.anterior.taxa_total_pct, acumConc.atual.taxa_total_pct)} contra o mesmo período do ano anterior.</>
                    )}
                  </>
                ) : (
                  <>Sem comparação nas mesmas distribuidoras para {ref}.</>
                )
              }
              comoInterpretar={
                <>
                  Cada área tem a cor do valor da distribuidora inteira: o mapa não mostra perda por município. A taxa compara distribuidoras de tamanhos diferentes; o volume mostra onde a energia perdida
                  se concentra. O denominador é a energia injetada de referência (desde {ANO_LEIAUTE_SAMP}, fornecida + irregular + perdas, porque a linha publicada deixou de fechar o balanço). Hachura cruzada é valor
                  publicado fora da comparação (ano incompleto ou alerta físico), com o motivo na tabela; hachura simples é ausência. As áreas vêm da relação de municípios mais recente: em anos anteriores, quem absorveu outra distribuidora depois aparece com o território atual, e o aviso abaixo do mapa diz quem.
                </>
              }
              naoConcluir={
                <>
                  Que a perda de um município seja a da distribuidora: a área é o conjunto de municípios inteiros ligados pela relação oficial, sem polígono de concessão. Que perda não técnica seja furto;
                  que a distribuidora esteja acima ou abaixo da meta regulatória; que o acumulado do ano aberto valha pelo ano inteiro.
                </>
              }
              extraFonte={<>Malha municipal: IBGE.</>}
            >
              <PerdasExplorador
                distribuidoras={g.distribuidoras.map(leve)}
                periodos={periodos}
                anoRef={ref}
                nacional={g.nacional}
                acumulado={g.acumulado}
                urls={{ anual: g.series.anual, municipios: g.series.municipios, evidencias: g.series.evidencias }}
                versao={versao}
                anoRelacao={g.mapa.ano_relacao}
              />
              <div className="mt-4 flex flex-wrap items-center gap-x-6 text-sm text-carvao-muted">
                <span>Agregados nacionais:</span>
                <ComproveNumero evidencia={ev.taxa_nacional} rotulo={`Comprove a taxa de ${ref}`} />
                <ComproveNumero evidencia={ev.perdas_nacional} rotulo={`Comprove o volume de ${ref}`} />
                {ev.acumulado && <ComproveNumero evidencia={ev.acumulado} rotulo="Comprove o acumulado do ano aberto" />}
              </div>
              {bloqueioGeometria && (
                <p className="mt-3 max-w-prose2 text-xs leading-relaxed text-carvao-muted" data-bloqueio="geometria">
                  Limitação: o {itemGeometria} não está acessível ao observatório. A área é desenhada pelos municípios do IBGE ligados à
                  distribuidora pela relação oficial da ANEEL; limites dentro de municípios compartilhados e a área em km² da concessão não podem ser lidos aqui.
                  <span data-nivel="analisar"> Evidência da coleta: {bloqueioGeometria.evidencia}</span>
                </p>
              )}
              <RodapePainel
                ancora="mapa"
                proxima={{ pergunta: "Qual parte dessas perdas é técnica e qual é não técnica?", href: "/setor-eletrico/perdas/composicao" }}
                downloads={[
                  { rotulo: "Por distribuidora e ano (CSV)", url: "/energia/series/perdas_distribuidoras.csv" },
                  { rotulo: "Municípios e distribuidoras (CSV)", url: "/energia/series/perdas_municipios.csv" },
                ]}
              />
            </PainelEvidencia>
          </Bloco>

          <Bloco id="evolucao">
            <PainelEvidencia
              id="painel-evolucao"
              pergunta={`Como a taxa de perdas das concessionárias evoluiu desde ${inicioSerie}?`}
              subtitulo="Perdas totais das concessionárias · % da energia injetada de referência · anos completos"
              natureza="CALCULADO"
              proveniencia={g.proveniencia.taxas}
              porQueImporta={<>A série longa separa tendência de oscilação de um ano e mostra a quebra de {ANO_LEIAUTE_SAMP}, quando o SAMP mudou de leiaute.</>}
              oQueMudou={
                <>
                  {nac && nac.taxa_total_pct !== null ? `Em ${ref}, ${num(nac.taxa_total_pct, 2)}% em ${nac.n_distribuidoras} concessionárias somadas.` : `Sem soma em ${ref}.`} Cada linha da tabela diz se o
                  conjunto de distribuidoras é o mesmo do ano anterior; a variação se lê na coluna das mesmas distribuidoras.
                </>
              }
              comoInterpretar={
                <>
                  Taxa agregada = 100 × soma das perdas ÷ soma da energia injetada das concessionárias com os 12 meses e sem alerta, nunca média de percentuais. Quando o universo muda, a diferença entre dois
                  anos mistura composição e variação. A marca de {ANO_LEIAUTE_SAMP} indica o leiaute novo do SAMP, com outro denominador.
                </>
              }
              naoConcluir={<>Que a queda ou a alta de um ano para o outro seja da mesma rede: distribuidoras entram, saem e são incorporadas, e {ANO_LEIAUTE_SAMP} trouxe um denominador novo.</>}
            >
              <Resposta id="evolucao" veredito={vereditoEvolucao(g.nacional)} prova={<ComproveNumero evidencia={ev.taxa_nacional} rotulo={`Comprove a taxa de ${ref}`} />}>
                {respostaEvolucao(g.nacional, ref)}
              </Resposta>
              <Recorte periodo={`${inicioSerie} a ${ref}, anos completos`} universo="concessionárias com os 12 meses e sem alerta físico em cada ano" unidade="% da energia injetada de referência" />
              <GraficoLinhas
                titulo="Taxa de perdas totais das concessionárias por ano"
                dados={serieNacional(g.nacional)}
                chaveX="ano"
                formatoX="texto"
                series={[{ id: "taxa", rotulo: "Concessionárias", cor: "var(--cor-energia)", espessura: 2.5 }]}
                unidade="%"
                casas={2}
                zeroNoEixo
                marcos={[{ x: String(ANO_LEIAUTE_SAMP), rotulo: `${ANO_LEIAUTE_SAMP}: leiaute da REN 1.003/2022` }]}
                altura={280}
              />
              <TabelaDados
                titulo="Série nacional das concessionárias"
                colunas={["Ano", "Somadas", "Com dado", "Perdas (GWh)", "Injetada (GWh)", "Taxa (%)", "Mesmo universo do ano anterior", "Nas mesmas do ano anterior (n)", "Fora da soma"]}
                linhas={linhasNacionais(g.nacional)}
                casas={[0, 0, 0, 0, 0, 2, null, null, null]}
                limite={40}
                csv="/energia/series/perdas_nacional.csv"
              />
              <RodapePainel
                ancora="evolucao"
                proxima={{ pergunta: "Como cada distribuidora evoluiu? Compare até quatro no mapa", href: "#mapa" }}
                downloads={[{ rotulo: "Série nacional por universo (CSV)", url: "/energia/series/perdas_nacional.csv" }]}
              />
            </PainelEvidencia>
          </Bloco>

          <Bloco id="outras-perguntas">
            <section aria-labelledby="perdas-outras" className="border border-linha bg-superficie px-5 py-6 md:px-8">
              <h2 id="perdas-outras" className="font-serif text-xl text-carvao md:text-2xl">
                As outras perguntas sobre perdas
              </h2>
              <ul className="mt-4 grid gap-4 lg:grid-cols-3">
                {outras.map((o) => (
                  <li key={o.pagina.id} className="flex flex-col border border-linha bg-papel px-4 py-4">
                    <p className="rotulo text-mineral">{o.pagina.rotulo}</p>
                    <h3 className="mt-1 font-serif text-lg leading-snug text-carvao">{o.pergunta}</h3>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-carvao-muted">{o.resposta}</p>
                    <PerdasLinkConsulta href={o.pagina.href} className={LINK_PERDAS}>
                      Abrir o painel {o.pagina.rotulo.toLowerCase()}
                    </PerdasLinkConsulta>
                  </li>
                ))}
              </ul>
            </section>
          </Bloco>

          <PerdasAuditoria g={g} />
        </ModoProfundidade>
      </main>
    </>
  );
}
