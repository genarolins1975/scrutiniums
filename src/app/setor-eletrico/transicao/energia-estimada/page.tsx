import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { Numero } from "@/components/energia/Numero";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { TransicaoConferencia2023, TransicaoOnsMensal } from "@/components/energia/TransicaoOns";
import {
  TransicaoAnalise,
  TransicaoAuditoria,
  TransicaoAviso,
  TransicaoDocumento,
  TransicaoIndisponivel,
  TransicaoNavegacao,
  TransicaoRecorte,
  TransicaoSeguir,
  TransicaoTabela,
} from "@/components/energia/TransicaoPagina";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import {
  COLUNAS_PARES,
  FONTE_ONS,
  PERGUNTA_A11,
  PERGUNTA_ONS,
  dadosConferencia,
  dadosRazaoCapacidade,
  data,
  dataIncorporacao,
  inteiro,
  linhasOnsAnual,
  linhasPares,
  mes,
  mudancaOns,
  numTexto,
  pctTexto,
  perguntaPainel,
  respostaOns,
  rotaPainel,
  trechosConferencia,
} from "@/lib/energia/transicao";
import type { GoldTransicao } from "@/lib/energia/tipos-transicao";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Energia da MMGD estimada pelo ONS e a entrada no Balanço de Energia",
  description:
    "Quanta energia a micro e minigeração distribuída entrega ao SIN segundo a estimativa do ONS (MWmed e participação na carga global, por submercado e mês), a razão rotulada com a capacidade cadastrada e a conferência da incorporação da MMGD ao Balanço de Energia (achado A11).",
  alternates: { canonical: "/setor-eletrico/transicao/energia-estimada" },
};

/**
 * P063, segunda parte: a energia de MMGD estimada pelo ONS (MWmed, só SIN), em
 * painel próprio para nunca ser somada à capacidade cadastrada da ANEEL, e a
 * conferência do achado A11 (o degrau da solar e da carga do Balanço de Energia
 * quando a MMGD passou a compor esses dados). Leitura da gold transicao.json.
 */
export default function EnergiaEstimadaPage() {
  const g = lerGold<GoldTransicao>("transicao.json");
  if (!integra(g)) return <TransicaoIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const m = g.mmgd;
  const o = g.ons_mmgd;
  const downloads = (urls: string[]) => g.downloads.filter((d) => urls.includes(d.url));
  // primeiro dia depois da incorporação declarada pelo ONS, como a conferência publicada o traz (nunca escrito à mão)
  const dataA11 = o ? dataIncorporacao(o.conferencia_quebra_2023) : null;
  // dias de cada média da solar na tabela de resumo (a gold publica as médias; os dias saem da janela publicada)
  const trechos = o ? trechosConferencia(o.conferencia_quebra_2023) : { antes: null, depois: null };
  const rotuloTrecho = (t: { inicio: string; fim: string; dias: number } | null) => (t ? `de ${data(t.inicio)} a ${data(t.fim)}, ${t.dias} dias` : "dias sem dado");

  return (
    <>
      <CabecalhoEnergia atual="transicao" />
      <MarcaVisita secao="energia:transicao-energia-estimada" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6">
        <CabecalhoModulo
          rotulo="Transição e ambiente"
          titulo="Energia da micro e minigeração distribuída no SIN"
          referencia={
            <>
              Carga verificada do ONS de {data(o?.inicio_serie)} a {data(o?.fim_serie)}; capacidade cadastrada na ANEEL de {data(m.data_cadastro)}, só na razão rotulada. Processado em{" "}
              {carimbo(g.gerado_em)}.
            </>
          }
        >
          O cadastro da ANEEL mede capacidade; esta página mostra a energia que o ONS estima para a MMGD no SIN, em MWmed, e confere o que mudou nos dados do ONS quando essa
          estimativa passou a compor a geração e a carga do Balanço de Energia.
        </CabecalhoModulo>
        <TransicaoNavegacao atual="ons" />
        <ModoProfundidade>
          <Bloco id="energia-estimada">
            {o ? (
              <PainelEvidencia
                id="ons"
                pergunta={PERGUNTA_ONS}
                subtitulo="MMGD estimada pelo ONS na carga verificada · MWmed, TWh e % da carga global, só SIN"
                natureza="ESTIMADO"
                porQueImporta={
                  <>
                    O cadastro diz quanta capacidade existe; esta estimativa diz quanta energia ela entrega ao SIN. É a parcela da carga que o ONS atribui à MMGD, separada da
                    parcela supervisionada e da medida para faturamento, e que entrou nos dados de geração e carga do Balanço de Energia.
                  </>
                }
                oQueMudou={mudancaOns(o, m.corte_provisorio)}
                comoInterpretar={
                  <>
                    Energia de cada meia hora = valor publicado × 0,5 h; MWmed do período = energia ÷ horas cobertas, nunca média de médias. SIN = soma dos quatro submercados nos dias
                    em que os quatro têm as 24 horas. Participação = 100 × energia de MMGD ÷ energia da carga global, mesmos intervalos.
                  </>
                }
                naoConcluir={
                  <>
                    Que esse seja o valor medido: o ONS chama o dado de estimado e os documentos consultados não descrevem o método. Nada sobre sistemas isolados (fora do SIN) nem
                    sobre município ou UF. A razão com a capacidade cadastrada não é fator de capacidade: compara perímetros diferentes (SIN e Brasil).
                  </>
                }
                proveniencia={o.proveniencia.estimativa}
                complementares={[{ rotulo: "Razão com a capacidade cadastrada", p: o.proveniencia.razao }]}
              >
                <div className="space-y-6">
                  <p className="max-w-prose2 text-base leading-relaxed text-carvao" data-resposta="ons">
                    {respostaOns(o)}
                  </p>
                  <TransicaoRecorte
                    periodo={
                      <>
                        {data(o.inicio_serie)} a {data(o.fim_serie)}; último mês completo {mes(o.ultimo_mes_completo?.m)}
                      </>
                    }
                    universo="SIN: os quatro submercados da carga verificada (sistemas isolados ficam fora)"
                    unidade="MWmed (energia do período ÷ horas), TWh e % da carga global"
                  />
                  <div className="grid gap-4 md:grid-cols-2">
                    <Numero
                      rotulo="MMGD estimada no SIN, último mês completo"
                      natureza="ESTIMADO"
                      evidencia={o.evidencia}
                      casas={1}
                      unidade="MWmed"
                      tamanho="medio"
                      motivoAusencia="Nenhum mês com os quatro submercados completos nesta publicação."
                      nota={`${pctTexto(o.ultimo_mes_completo?.participacao_carga_global_sin_pct, 2)} da carga global do SIN no mês. Estimativa da fonte.`}
                      endereco={`${rotaPainel("ons")}#ons`}
                    />
                    <TransicaoAviso rotulo="Estimativa da fonte">
                      {g.regras.cadastro_x_estimativa} O ONS publica a MMGD como parcela estimada da carga, separada da parcela supervisionada e da medida para faturamento.
                    </TransicaoAviso>
                  </div>
                  <TransicaoOnsMensal mensal={o.mensal} fonte={FONTE_ONS} versao={o.fim_serie} />

                  <TransicaoAnalise titulo="Por ano">
                    <GraficoBarras
                      titulo="MMGD estimada no SIN por ano (anos incompletos marcados)"
                      dados={linhasOnsAnual(o.anual)}
                      chaveCategoria="id"
                      chaveRotulo="rotulo"
                      series={[{ id: "mmgd_sin_mwmed", rotulo: "MMGD estimada no SIN", cor: "var(--serie-solar)" }]}
                      unidade="MWmed"
                      casas={0}
                      altura={260}
                    />
                    <TransicaoTabela
                      titulo="MMGD estimada no SIN por ano"
                      colunas={["Ano", "MWmed", "TWh", "% da carga global", "Dias completos", "Situação"]}
                      numericas={[1, 2, 3, 4]}
                      linhas={linhasOnsAnual(o.anual).map((a) => [String(a.ano), numTexto(a.mmgd_sin_mwmed, 0), numTexto(a.mmgd_sin_twh, 2), pctTexto(a.participacao_carga_global_pct, 2), inteiro(a.dias_completos), a.situacao])}
                    />
                  </TransicaoAnalise>

                  <TransicaoAnalise titulo="Energia estimada sobre capacidade cadastrada (razão rotulada)">
                    {dadosRazaoCapacidade(o.mensal).length > 0 ? (
                      <GraficoLinhas
                        titulo="Razão entre a MMGD estimada no SIN e a capacidade cadastrada no Brasil, por mês"
                        dados={dadosRazaoCapacidade(o.mensal)}
                        chaveX="m"
                        formatoX="mes"
                        series={[{ id: "razao", rotulo: "Estimativa ÷ capacidade (não é fator de capacidade)", sigla: "Razão", cor: "var(--cor-carvao)" }]}
                        unidade="%"
                        casas={1}
                        zeroNoEixo
                        altura={240}
                      />
                    ) : (
                      <p className="text-sm text-carvao-muted">Nenhum mês com a razão publicada nesta versão.</p>
                    )}
                    <p className="max-w-prose2 text-sm text-carvao-muted">
                      Só em mês completo do ONS e não provisório no cadastro. Herda as limitações das duas fontes e o descasamento de perímetro; serve para ver ordem de grandeza, não
                      para medir o desempenho dos sistemas.
                    </p>
                  </TransicaoAnalise>

                  <TransicaoAuditoria titulo="Validações e documentos da fonte">
                    <TransicaoTabela
                      titulo="Domínio da participação e dos dias"
                      colunas={["Regra", "Verificado", "Resultado"]}
                      linhas={[
                        [o.validacoes.participacao_dominio.regra, `${inteiro(o.validacoes.participacao_dominio.meses_verificados)} meses e ${inteiro(o.validacoes.participacao_dominio.anos_verificados)} anos; ${inteiro(o.validacoes.participacao_dominio.violacoes)} violações`, o.validacoes.participacao_dominio.resultado],
                        [o.validacoes.dias_fora_do_dominio.regra, `${inteiro(o.validacoes.dias_fora_do_dominio.dias)} dias`, `${o.validacoes.dias_fora_do_dominio.resultado}; ${o.validacoes.dias_fora_do_dominio.tratamento}`],
                      ]}
                    />
                    {o.documentos.map((d) => (
                      <TransicaoDocumento key={d.url} doc={d} />
                    ))}
                  </TransicaoAuditoria>

                  <TransicaoSeguir
                    ancora="ons"
                    href={`${rotaPainel("ons")}#a11`}
                    pergunta={PERGUNTA_A11}
                    downloads={downloads(["/energia/series/transicao_ons_mmgd_mensal.csv", "/energia/series/transicao_ons_mmgd_diario.csv"])}
                  />
                </div>
              </PainelEvidencia>
            ) : (
              <Indisponivel
                titulo="Estimativa de MMGD do ONS ausente nesta publicação"
                motivo={`O bloco do ONS não foi montado nesta execução (${g.pendencias.join(" ") || "sem motivo registrado"}). O cadastro da ANEEL, na página da MMGD no território, não depende dele; nenhum valor de energia é estimado no lugar.`}
              />
            )}
          </Bloco>

          {o && (
            <Bloco id="achado-a11">
              <PainelEvidencia
                id="a11"
                nivel="analisar"
                pergunta={PERGUNTA_A11}
                subtitulo="Balanço de Energia do SIN e MMGD estimada, MWmed por dia"
                natureza="CALCULADO"
                porQueImporta={
                  <>
                    A solar do SIN dá um salto em {data(dataA11)} nos dados do ONS. Se o salto for lido como crescimento da geração, qualquer comparação que atravesse essa data
                    superestima a expansão solar. A conferência separa o que a fonte declara do que aparece no dado.
                  </>
                }
                oQueMudou={
                  <>
                    Degrau da solar de {numTexto(o.conferencia_quebra_2023.degrau_solar_mwmed, 0)} MWmed de um dia para o outro; MMGD estimada de{" "}
                    {numTexto(o.conferencia_quebra_2023.mmgd_ons_no_dia_mwmed, 0)} MWmed no dia, {numTexto(o.conferencia_quebra_2023.diferenca_degrau_solar_e_mmgd_mwmed, 0)} MWmed acima do
                    degrau, diferença que a fonte não explica.
                  </>
                }
                comoInterpretar={
                  <>
                    {o.conferencia_quebra_2023.regra_pares}. A carga &ldquo;mostra degrau&rdquo; quando a mediana das diferenças dela chega à metade da mediana da MMGD estimada nos mesmos
                    dias.
                  </>
                }
                naoConcluir={
                  <>
                    A causa da diferença entre o degrau e a estimativa, nem o motivo de a carga não mostrar degrau do mesmo tamanho: a fonte não publica explicação. Comparações que
                    atravessam {data(dataA11)} na solar e na carga do balanço misturam critérios diferentes.
                  </>
                }
                proveniencia={o.proveniencia.estimativa}
              >
                <div className="space-y-6">
                  <p className="max-w-prose2 text-base leading-relaxed text-carvao" data-resposta="a11">
                    {o.conferencia_quebra_2023.leitura}
                  </p>
                  <TransicaoRecorte
                    periodo={
                      <>
                        {data(o.conferencia_quebra_2023.janela.inicio)} a {data(o.conferencia_quebra_2023.janela.fim)}
                      </>
                    }
                    universo="SIN (Balanço de Energia nos Subsistemas e carga verificada)"
                    unidade="MWmed, média de cada dia"
                  />
                  <TransicaoDocumento doc={o.conferencia_quebra_2023.documento} />
                  <TransicaoConferencia2023
                    dias={dadosConferencia(o.conferencia_quebra_2023)}
                    marco={dataA11 ? { x: dataA11, rotulo: "MMGD incorporada ao balanço (ONS)" } : null}
                    captura={o.proveniencia.estimativa.capturado_em ? carimbo(o.proveniencia.estimativa.capturado_em) : "sem dado"}
                  />
                  <TransicaoTabela
                    titulo="Resumo da conferência"
                    colunas={["Medida", "MWmed"]}
                    numericas={[1]}
                    linhas={[
                      ["Degrau da solar de um dia para o outro", numTexto(o.conferencia_quebra_2023.degrau_solar_mwmed, 0)],
                      [`MMGD estimada em ${data(dataA11)}`, numTexto(o.conferencia_quebra_2023.mmgd_ons_no_dia_mwmed, 0)],
                      [`Média da solar antes da incorporação (${rotuloTrecho(trechos.antes)})`, numTexto(o.conferencia_quebra_2023.solar_media_7d_antes, 0)],
                      [`Média da solar a partir da incorporação (${rotuloTrecho(trechos.depois)})`, numTexto(o.conferencia_quebra_2023.solar_media_depois, 0)],
                      [`Mediana das diferenças na solar (${o.conferencia_quebra_2023.pares_na_mediana} pares)`, numTexto(o.conferencia_quebra_2023.mediana_diferenca_solar_mwmed, 0)],
                      [`Mediana das diferenças na carga (${o.conferencia_quebra_2023.pares_na_mediana} pares)`, numTexto(o.conferencia_quebra_2023.mediana_diferenca_carga_mwmed, 0)],
                      ["Mediana da MMGD estimada nos mesmos dias", numTexto(o.conferencia_quebra_2023.mediana_mmgd_ons_mwmed, 0)],
                    ]}
                  />
                  <TabelaInterativa
                    titulo="Cada dia contra o mesmo dia da semana 14 dias antes"
                    colunas={COLUNAS_PARES}
                    linhas={linhasPares(o.conferencia_quebra_2023)}
                    chaveLinha="id"
                    colunaRotulo="d"
                    fonte="ONS, Balanço de Energia nos Subsistemas e Carga de Energia Verificada"
                    versao={o.conferencia_quebra_2023.janela.fim}
                    nomeArquivo="transicao-conferencia-quebra-2023"
                    chaveUrl="ons.pares"
                    ordemInicial={{ coluna: "d", direcao: "asc" }}
                    nota="Médias de 24 horas de cada dia. Pares com feriado nacional ficam fora da mediana."
                  />
                  <TransicaoSeguir
                    ancora="a11"
                    href={`${rotaPainel("p064")}#p064`}
                    pergunta={perguntaPainel("p064")}
                    downloads={downloads(["/energia/series/transicao_ons_mmgd_diario.csv"])}
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
