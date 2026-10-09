import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
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
import { PerdasLevaEscolha } from "@/components/energia/PerdasLevaEscolha";
import { NotasDoPainelNomeadas, PERGUNTA_ABERTURA, PERGUNTA_COMPOSICAO, PerdasCapitulos, PerdasSeguir, Recorte, ReferenciaPerdas, Resposta, SeparacaoMetricas } from "@/components/energia/PerdasPainel";
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
  MEDIDAS,
} from "@/lib/energia/perdas";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Perdas de energia na distribuição",
  description:
    "Onde a energia se perde: taxa e energia perdida das concessionárias somadas e de cada distribuidora, cada uma com o denominador explícito, mapa das áreas de atuação, comparação de até quatro distribuidoras e a série anual do SAMP, com a fonte da ANEEL.",
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
  const pRef = periodos.find((p) => p.referencia) ?? periodos[0];
  const rotuloAcumulado = periodos.find((p) => p.tipo === "acumulado")?.rotulo ?? null;
  // anos da série e do mapa lidos da gold, nunca escritos à mão
  const anos = anosSerieNacional(g.nacional);
  const inicioSerie = anos?.inicio ?? ref;
  const periodoMapa = `${inicioSerie} a ${ref}${g.acumulado ? ` e ${g.acumulado.ano} até ${mesFimAcum}` : ""}`;

  // a faixa entre distribuidoras no ano de referência: os mesmos valores, a mesma regra e o mesmo seletor que o mapa, a figura e a tabela
  const leves = g.distribuidoras.map(leve);
  const rotulos = Object.fromEntries(leves.map((d) => [d.cnpj, rotuloDistribuidora(d)]));
  const grupos = Object.fromEntries(leves.map((d) => [d.cnpj, d.grupo]));
  const recortesRef = recortesDoPeriodo(leves, pRef, null);
  const faixaRef = recortesRef ? faixaComparacao(valoresDoPeriodo(leves, recortesRef, "taxa", pRef), rotulos, grupos) : null;
  const mesmas = nac?.mesmas_ano_anterior ?? null;
  const parTaxa = mesmas?.taxa_total_pct ?? null;

  const oQueMudou = (
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
    </>
  );
  const comoInterpretar = (
    <>
      Cada barra conta as distribuidoras, concessionárias e permissionárias, cuja medida cai na faixa; as faixas são as mesmas do mapa e da tabela. A taxa é a perda total dividida pela energia injetada
      de referência da própria distribuidora (desde {ANO_LEIAUTE_SAMP}, fornecida + irregular + perdas: a linha publicada deixou de fechar o balanço). O agregado das concessionárias é outra conta, a soma das
      perdas dividida pela soma da energia injetada, nunca a média das taxas. A mediana é simples entre as distribuidoras, sem ponderar pelo tamanho.
    </>
  );
  const naoConcluir = (
    <>
      Que os extremos sejam metas, resultado de eficiência ou ordem de desempenho: as redes diferem em tamanho, território e perfil de consumo. Que a perda de um município seja a da distribuidora: o mapa colore
      a área inteira. Que perda não técnica seja furto: inclui erros de medição, leitura e faturamento. Que a distribuidora esteja acima ou abaixo da meta regulatória. Que o acumulado do ano aberto valha pelo ano inteiro.
    </>
  );

  const oQueMudouEvolucao = (
    <>
      {nac && nac.taxa_total_pct !== null ? `Em ${ref}, ${num(nac.taxa_total_pct, 2)}% em ${nac.n_distribuidoras} concessionárias somadas.` : `Sem soma em ${ref}.`} Cada linha da tabela diz se o
      conjunto de distribuidoras é o mesmo do ano anterior; a variação se lê na coluna das mesmas distribuidoras.
    </>
  );
  const comoInterpretarEvolucao = (
    <>
      Taxa agregada = 100 × soma das perdas ÷ soma da energia injetada das concessionárias com os 12 meses e sem alerta, nunca média de percentuais. Quando o universo muda, a diferença entre dois
      anos mistura composição e variação. A marca de {ANO_LEIAUTE_SAMP} indica o leiaute novo do SAMP, com outro denominador.
    </>
  );
  const naoConcluirEvolucao = <>Que a queda ou a alta de um ano para o outro seja da mesma rede: distribuidoras entram, saem e são incorporadas, e {ANO_LEIAUTE_SAMP} trouxe um denominador novo.</>;

  return (
    <>
      <CabecalhoEnergia atual="perdas" />
      <MarcaVisita secao="energia:perdas" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          siglas={["SAMP", "MMGD", "REN", "ANEEL", "IBGE"]}
          titulo={PERGUNTA_ABERTURA}
          lead={
            <>
              <Termo slug="perdas-de-energia">Perda</Termo> é a energia que entra na rede da distribuidora e não chega como consumo medido. Aqui, a taxa e o volume das concessionárias somadas e de cada
              distribuidora.
            </>
          }
          recorte={
            <>
              {ref}, ano completo
              {nac ? ` · ${num(nac.n_distribuidoras, 0)} concessionárias no agregado` : ""}
              {faixaRef ? ` e ${num(faixaRef.n, 0)} distribuidoras na comparação` : ""} · % da energia injetada de referência e TWh
            </>
          }
          fonte="ANEEL, SAMP Balanço"
          referencia={<ReferenciaPerdas g={g} />}
          metricas={
            <div id="resumo" className="scroll-mt-28">
              <FaixaMetricas colunas={4} rotulo="Perdas das concessionárias e faixa entre as distribuidoras comparáveis">
                <Numero
                  variante="faixa"
                  rotulo={`Perdas totais das concessionárias, ${ref}`}
                  natureza="CALCULADO"
                  evidencia={ev.taxa_nacional}
                  formato="pct"
                  casas={2}
                  unidade="% da energia injetada"
                  periodo={nac ? `${ref} · ${num(nac.n_distribuidoras, 0)} concessionárias` : String(ref)}
                  cor="var(--cor-energia)"
                  endereco="https://scrutiniums.com/setor-eletrico/perdas#resumo"
                />
                <Numero
                  variante="faixa"
                  rotulo={`Energia perdida pelas concessionárias, ${ref}`}
                  natureza="OBSERVADO"
                  evidencia={ev.perdas_nacional}
                  valor={ev.perdas_nacional.valor_calculo === null ? null : ev.perdas_nacional.valor_calculo / 1e6}
                  unidade="TWh"
                  casas={1}
                  periodo={nac ? `${ref} · as mesmas ${num(nac.n_distribuidoras, 0)} concessionárias` : String(ref)}
                  nota={nac ? undefined : <>sem soma nacional publicada para {ref}</>}
                  cor="var(--cor-energia)"
                  endereco="https://scrutiniums.com/setor-eletrico/perdas#resumo"
                />
                <Numero
                  variante="faixa"
                  rotulo="Variação da taxa nas mesmas concessionárias"
                  natureza="CALCULADO"
                  valor={variacaoMesmas(parTaxa)}
                  formato="variacao"
                  casas={2}
                  unidade="p.p."
                  periodo={mesmas ? `${ref} contra ${ref - 1} · as mesmas ${num(mesmas.n_total, 0)} concessionárias` : undefined}
                  motivoAusencia={`Sem comparação nas mesmas concessionárias para ${ref}.`}
                  cor="var(--cor-energia)"
                />
                <Numero
                  variante="faixa"
                  rotulo={`Mediana simples das distribuidoras, ${ref}`}
                  natureza="CALCULADO"
                  valor={faixaRef?.mediana ?? null}
                  formato="pct"
                  casas={2}
                  unidade="% da energia injetada"
                  periodo={faixaRef ? `${ref} · ${num(faixaRef.n, 0)} distribuidoras comparáveis` : String(ref)}
                  motivoAusencia="Nenhuma distribuidora com valor comparável no ano."
                  nota={
                    faixaRef?.minimo && faixaRef.maximo ? (
                      <>
                        Faixa observada: {textoNumero(faixaRef.minimo.v, MEDIDAS.taxa)} a {textoNumero(faixaRef.maximo.v, MEDIDAS.taxa)}.
                      </>
                    ) : undefined
                  }
                  cor="var(--serie-referencia)"
                />
              </FaixaMetricas>
            </div>
          }
        >
          Parte da energia que entra na rede de cada distribuidora não chega a ser entregue como consumo medido: são as <Termo slug="perdas-de-energia">perdas</Termo>. Uma parte é a das{" "}
          <Termo slug="perdas-tecnicas">perdas técnicas</Termo>, ligada à física das redes; a outra, as <Termo slug="perdas-nao-tecnicas">perdas não técnicas</Termo>, é a diferença entre a perda total e a técnica
          e inclui furto, fraude e erros de medição e faturamento. Aqui estão volume, taxa, trajetória, composição, o percentual técnico regulatório e o custo das perdas na tarifa de cada distribuidora.
        </CabecalhoModulo>

        <ModoProfundidade>
          <PerdasLevaEscolha />
          <Bloco id="mapa">
            <PainelEvidencia
              id="painel-mapa"
              pergunta="Como variam as perdas entre as distribuidoras?"
              subtitulo={`Perdas por área de distribuidora · taxa, volume, técnicas, não técnicas e variação · ${periodoMapa}`}
              natureza="CALCULADO"
              proveniencia={g.proveniencia.taxas}
              complementares={[
                { rotulo: "Perdas totais em energia", p: g.proveniencia.volumes },
                { rotulo: "Área de atuação por municípios", p: g.proveniencia.territorio },
              ]}
              porQueImporta={
                <>
                  A energia perdida entra no custo da distribuidora: a ANEEL reconhece na tarifa um nível de perdas para cada uma e limita o repasse do que passa dele. Com taxa maior, a mesma rede precisa de mais energia para
                  entregar o mesmo consumo.
                </>
              }
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              extraFonte={<>Malha municipal: IBGE.</>}
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
                  <RespostaCurta id="geral" veredito={vereditoGeral(g)}>
                    {respostaGeral(g)}
                  </RespostaCurta>
                }
                notas={<NotasDoPainelNomeadas painel="comparação entre distribuidoras" oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />}
                aposPrincipal={<PerdasCapitulos />}
                limitacaoMapa={
                  <>
                    {bloqueioGeometria && (
                      <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted" data-bloqueio="geometria">
                        Limitação: o {itemGeometria} não está acessível ao observatório. A área é desenhada pelos municípios do IBGE ligados à distribuidora pela relação oficial da ANEEL; limites dentro de municípios
                        compartilhados e a área em km² da concessão não podem ser lidos aqui.
                        <span data-nivel="analisar"> Evidência da coleta: {bloqueioGeometria.evidencia}</span>
                      </p>
                    )}
                  </>
                }
              />
              <PerdasSeguir
                ancora="mapa"
                proxima={{ pergunta: PERGUNTA_COMPOSICAO, href: "/setor-eletrico/perdas/composicao" }}
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
              oQueMudou={oQueMudouEvolucao}
              comoInterpretar={comoInterpretarEvolucao}
              naoConcluir={naoConcluirEvolucao}
              naoConcluirNoCorpo
            >
              <div className="grid gap-x-10 gap-y-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
                <Resposta id="evolucao" veredito={vereditoEvolucao(g.nacional)} prova={<ComproveNumero evidencia={ev.taxa_nacional} rotulo={`Comprove a taxa de ${ref}`} />}>
                  {respostaEvolucao(g.nacional, ref)}
                </Resposta>
                <Numero
                  variante="faixa"
                  rotulo={rotuloAcumulado ? `Perdas totais, ${rotuloAcumulado}` : "Acumulado do ano aberto"}
                  natureza="CALCULADO"
                  evidencia={ev.acumulado}
                  formato="pct"
                  casas={2}
                  unidade="% da energia injetada de referência"
                  motivoAusencia="Sem recorte do ano aberto publicado por ao menos 90% das distribuidoras."
                  variacao={
                    acumConc
                      ? { valor: variacaoMesmas([acumConc.anterior.taxa_total_pct, acumConc.atual.taxa_total_pct]), casas: 2, sufixo: " p.p.", referencia: `contra o mesmo período de ${(g.acumulado?.ano ?? ref + 1) - 1}, nas mesmas ${acumConc.n_distribuidoras} concessionárias` }
                      : undefined
                  }
                  nota={<>Ano aberto: não compete com os anos completos do gráfico.</>}
                  cor="var(--serie-referencia)"
                  endereco="https://scrutiniums.com/setor-eletrico/perdas#evolucao"
                />
              </div>
              {g.referencia.aviso_parcial && <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted">{g.referencia.aviso_parcial}</p>}
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
              <Recorte
                periodo={`${inicioSerie} a ${ref}, anos completos; o ano aberto fica à parte`}
                universo="concessionárias com os 12 meses e sem alerta físico em cada ano"
                unidade="% da energia injetada de referência"
              />
              <TabelaDados
                titulo="Série nacional das concessionárias"
                colunas={["Ano", "Somadas", "Com dado", "Perdas (GWh)", "Injetada (GWh)", "Taxa (%)", "Mesmo universo do ano anterior", "Nas mesmas do ano anterior (n)", "Fora da soma"]}
                linhas={linhasNacionais(g.nacional)}
                casas={[0, 0, 0, 0, 0, 2, null, null, null]}
                limite={40}
                csv="/energia/series/perdas_nacional.csv"
              />
              <NotasDoPainelNomeadas painel="evolução da taxa das concessionárias" oQueMudou={oQueMudouEvolucao} comoInterpretar={comoInterpretarEvolucao} naoConcluir={naoConcluirEvolucao} />
              <PerdasSeguir
                ancora="evolucao"
                proxima={{ pergunta: "Como cada distribuidora evoluiu? Compare até quatro", href: "#perdas-comparar" }}
                downloads={[{ rotulo: "Série nacional por universo (CSV)", url: "/energia/series/perdas_nacional.csv" }]}
              />
            </PainelEvidencia>
          </Bloco>

          <Bloco id="separacao">
            <SecaoDoPainel id="perdas-separacao" titulo="Quanto da perda é estimado como técnica e como não técnica?" lead={vereditoComposicao(g)}>
              <SeparacaoMetricas g={g} endereco="https://scrutiniums.com/setor-eletrico/perdas#separacao" />
            </SecaoDoPainel>
          </Bloco>

          <PerdasAuditoria g={g} />
        </ModoProfundidade>
      </main>
    </>
  );
}
