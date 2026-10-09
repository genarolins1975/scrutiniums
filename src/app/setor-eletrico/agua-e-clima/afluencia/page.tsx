import type { Metadata } from "next";
import { AguaAfluencia } from "@/components/energia/AguaAfluencia";
import { AguaAviso, AguaDatas, AguaFontes, AguaIndisponivel, AguaNavegacao, AguaRegras, AguaSeguir } from "@/components/energia/AguaPagina";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { PequenosMultiplos } from "@/components/energia/PequenosMultiplos";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import {
  COLUNAS_CAPTURAS,
  COLUNAS_MLT_ANOS,
  COLUNAS_PMO,
  COLUNAS_REVISOES_CAPTURAS,
  COLUNAS_REVISOES_MLT,
  COLUNAS_UNIDADE,
  COR_REGIAO,
  CURTO_REGIAO,
  NOME_REGIAO,
  REGRA_CAPTURA_ENA,
  REGRA_FAIXA_ENA,
  SUBSISTEMAS,
  anoInicial,
  entidadesEna,
  linhasCapturas,
  linhasMltAnos,
  linhasPmo,
  linhasRevisoesCapturas,
  linhasRevisoesMlt,
  linhasUnidade,
  listaMeses,
  listaTexto,
  mesesSemPmo,
  nomeProprio,
  perguntaPainel,
  rotaPainel,
  serieDiferencaMlt,
  serieMltImplicita,
  serieMltJanJul,
  serieMltMensal,
  serieRegioes,
  situacaoAtualidade,
  textoConferenciaBacias,
  textoMltNaoConcluir,
  textoMudancaAfluencia,
  textoMudancaMltNoMes,
  textoRevisoesCapturas,
  textosMlt,
} from "@/lib/energia/agua";
import { carimbo, dataBR, num } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import type { AguaDetalheGold } from "@/lib/energia/tipos-agua";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Água e clima: a água que chega aos reservatórios",
  description:
    "Energia natural afluente (ENA) de 30 dias em % da MLT por subsistema, REE e bacia do ONS, como razão de somas, contra a faixa da mesma janela nos anos anteriores, e a versão da MLT do conjunto aberto comparada com a do PMO.",
  alternates: { canonical: "/setor-eletrico/agua-e-clima/afluencia" },
};

const FONTE = "ONS, ENA Diário por Subsistema, por REE e por Bacia (captura mais recente de cada ano)";

export default function AfluenciaPage() {
  const g = lerGold<AguaDetalheGold>("agua_detalhe.json");
  if (!integra(g)) return <AguaIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const f = g.afluencia;
  const ev = g.evidencias;
  const prov = g.proveniencia;
  const entidades = entidadesEna(f);
  const atual = situacaoAtualidade(g.dias_referencia.ena, g.gerado_em, 3, "o ONS publica a ENA do dia anterior");
  const versao = g.dias_referencia.ena;
  // o arquivo diário de 2000 em diante é a base da faixa: o CSV do painel começa em 2022, então a base entra à parte
  const downloads = [
    ...g.downloads.filter((d) => /agua_subsistemas_diario|agua_ear_recortes|agua_mlt_mudancas/.test(d.url)),
    { rotulo: "ENA diária por subsistema e SIN, série completa, a base da faixa usual (CSV)", url: "/energia/series/ena_diario.csv" },
  ];
  const conf = f.conferencia_bacias_sin;
  const implicita = serieMltImplicita(f.mlt);
  const desdeImplicita = anoInicial(implicita[0]?.x);
  const semPmo = mesesSemPmo(f.mlt);
  const mudancaNoMes = textoMudancaMltNoMes(f.mlt);
  const oQueMudou = (
    <>
      {atual.texto} {textoMudancaAfluencia(entidades)}
    </>
  );
  const comoInterpretar = (
    <>
      A ENA é a energia produzível a partir das vazões naturais que chegam aos reservatórios; o ONS a deriva da vazão natural reconstituída, e ela não é uma medição direta. 100% é
      a MLT dos mesmos dias. A ENA de 30 dias é a soma da ENA dividida pela soma da MLT vigente em cada dia, nunca a média dos percentuais diários; o SIN soma as ENA e as MLT
      dos quatro subsistemas. A faixa usual vai do 10º ao 90º percentil da mesma janela de 30 dias nos anos da base (mínimo de 5 anos).
    </>
  );
  const naoConcluir = (
    <>
      Afluência alta não quer dizer reservatório cheio: o armazenamento depende também de quanto se gera, verte e transfere (painel de reservatórios). O percentual da MLT é outra
      régua que o da energia armazenada (EAR), e os dois não se comparam. {textoMltNaoConcluir(f.mlt)}
    </>
  );

  return (
    <>
      <CabecalhoEnergia atual="agua-e-clima" />
      <MarcaVisita secao="energia:agua-e-clima" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <AguaNavegacao atual="p018" />
        <CabecalhoModulo
          rotulo="Água e clima"
          siglas={["ENA", "MLT", "REE", "SIN", "MWmed", "EAR", "ONS", "PMO"]}
          titulo={perguntaPainel("p018")}
          lead="A energia natural afluente (ENA) de 30 dias, em % da média de longo termo (MLT)."
          recorte={`Até ${dataBR(g.dias_referencia.ena)} · SIN, REE e bacias · % da MLT`}
          fonte="ONS, ENA Diário"
          referencia={
            <>
              ONS, ENA Diário por Subsistema, por REE e por Bacia, até {dataBR(g.dias_referencia.ena)}; MLT do Relatório Executivo do PMO; processado em {carimbo(g.gerado_em)}.
            </>
          }
          datas={<AguaDatas itens={[{ rotulo: "ENA, derivada pelo ONS das vazões naturais reconstituídas", dia: g.dias_referencia.ena, natureza: "OBSERVADO" }]} />}
        >
          A <Termo slug="ena">ENA</Termo> converte em energia as vazões naturais que chegam aos reservatórios. Em % da <Termo slug="mlt">MLT</Termo>, ela diz se a água que chega está acima ou
          abaixo da média de longo termo usada pelo ONS. Para isso, a página soma 30 dias de ENA e 30 dias de MLT antes de dividir, compara o resultado com a mesma janela dos anos
          anteriores e mostra que a própria MLT muda de versão.
        </CabecalhoModulo>
        <ModoProfundidade>
          <Bloco id="ena">
            <PainelEvidencia
              id="p018"
              pergunta="Cada região frente à mediana da mesma janela"
              subtitulo="ENA de 30 dias em % da MLT, contra a faixa da mesma janela"
              natureza="CALCULADO"
              porQueImporta={
                <>
                  A água que chega é a energia que poderá ser guardada ou gerada nas próximas semanas. Somar 30 dias suaviza a oscilação diária, e a comparação com a mesma
                  janela de outros anos separa a estação chuvosa de uma afluência fora do comum.
                </>
              }
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={prov.ena_30d!}
              complementares={[
                ...(prov.ena_30d_ree ? [{ rotulo: "ENA de 30 dias por REE", p: prov.ena_30d_ree }] : []),
                ...(prov.ena_30d_bacia ? [{ rotulo: "ENA de 30 dias por bacia", p: prov.ena_30d_bacia }] : []),
                ...(prov.mlt ? [{ rotulo: "Mudanças da MLT por usina", p: prov.mlt }] : []),
              ]}
            >
              <div className="space-y-6">
                {atual.defasada && <AguaAviso tipo="alerta">{atual.texto}</AguaAviso>}
                <AguaAfluencia
                  entidades={entidades}
                  serie={serieRegioes(f.serie_30d_semanal)}
                  passoDias={f.serie_30d_semanal.passo_dias}
                  reeNovos={f.ree_novos_por_data}
                  fonte={FONTE}
                  versao={versao}
                  notas={<NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />}
                  evidencias={{ ena30d: ev.ena_30d_sin, enaArm30d: ev.ena_arm_30d_sin }}
                  revisoes={f.revisoes_entre_capturas_30d}
                  enderecoMedidas={`${rotaPainel("p018")}#p018`}
                />

                <SecaoDoPainel
                  id="mlt"
                  titulo="Qual MLT? A referência muda de versão"
                  lead="A MLT é o 100% desta página. As figuras mostram quanto a MLT dos arquivos abertos do ONS difere da publicada no relatório mensal do Programa Mensal de Operação (PMO) e como a MLT implícita de cada subsistema variou."
                >
                  <GraficoLinhas
                    titulo="Diferença da MLT do conjunto aberto contra a do PMO no início de cada mês, por subsistema, em %"
                    dados={serieDiferencaMlt(f.mlt)}
                    chaveX="m"
                    formatoX="mes"
                    series={SUBSISTEMAS.map((sm) => ({ id: sm, rotulo: NOME_REGIAO[sm], sigla: CURTO_REGIAO[sm], cor: COR_REGIAO[sm] }))}
                    banda={{ inferior: "tol_inf", superior: "tol_sup", rotulo: `Tolerância de ${num(f.mlt.pmo.tolerancia_pct, 2)}% (o PMO publica MWmed inteiros)` }}
                    unidade="%"
                    casas={2}
                    zeroNoEixo
                    altura={260}
                  />
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted" data-texto="mlt-lacuna">
                    Positivo: a MLT do conjunto aberto é maior que a do PMO. Fora da faixa de tolerância, as duas diferem.
                    {semPmo.length > 0 ? ` Sem relatório do PMO coletado em ${listaMeses(semPmo)}: nesses meses não há comparação, e as linhas são interrompidas.` : ""} {mudancaNoMes}
                  </p>
                  {ev.mlt_pmo_vs_aberto && (
                    <p className="text-sm text-carvao">
                      Diferença entre a MLT do conjunto aberto e a do PMO no Sudeste/Centro-Oeste, no mês mais recente:{" "}
                      <ComproveNumero variante="valor" evidencia={ev.mlt_pmo_vs_aberto} />
                    </p>
                  )}
                  <PequenosMultiplos
                    titulo={`MLT implícita de cada subsistema no dia 15 de janeiro e no dia 15 de julho${desdeImplicita ? `, desde ${desdeImplicita}` : ""}`}
                    dados={serieMltJanJul(f.mlt)}
                    chaveX="x"
                    formatoX="texto"
                    unidade="MWmed"
                    casas={0}
                    escala="livre"
                    colunas={4}
                    nivelTitulo={4}
                    paineis={SUBSISTEMAS.map((sm) => ({
                      id: sm,
                      titulo: NOME_REGIAO[sm],
                      series: [
                        // o rótulo leva o subsistema: a legenda da grade lista as oito linhas, cada uma na cor do seu subsistema
                        { id: `${sm}_1`, rotulo: `${CURTO_REGIAO[sm]}, 15 de janeiro`, cor: COR_REGIAO[sm], espessura: 2 },
                        { id: `${sm}_7`, rotulo: `${CURTO_REGIAO[sm]}, 15 de julho`, cor: COR_REGIAO[sm], tracejada: true, espessura: 2 },
                      ],
                    }))}
                  />
                  <p className="text-sm text-carvao-muted">
                    Linha contínua: 15 de janeiro; linha tracejada: 15 de julho. MLT implícita = ENA ÷ (% da MLT ÷ 100), lida dos próprios arquivos. Ela cresce com a entrada de
                    usinas e muda quando o ONS troca a versão da referência; janeiro e julho mostram a estação chuvosa e a seca, e cada degrau é uma mudança de versão.{" "}
                    {f.mlt.anos_regra}.
                  </p>
                </SecaoDoPainel>

                <SecaoDoPainel id="mlt-detalhes" nivel="analisar" titulo="Como a MLT do PMO, a do conjunto aberto e as mudanças por usina se comparam">
                  <GraficoLinhas
                    titulo="MLT do Sudeste/Centro-Oeste no PMO e no conjunto aberto, mês a mês"
                    dados={serieMltMensal(f.mlt, "SE")}
                    chaveX="m"
                    formatoX="mes"
                    series={[
                      { id: "pmo", rotulo: "MLT do PMO (relatório do mês)", cor: "var(--cor-previsto)" },
                      { id: "inicio", rotulo: "Conjunto aberto, início do mês", cor: "var(--serie-sm-se)" },
                      { id: "fim", rotulo: "Conjunto aberto, fim do mês", cor: "var(--serie-referencia)", tracejada: true },
                    ]}
                    unidade="MWmed"
                    casas={0}
                  />
                  <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-carvao" data-textos="mlt">
                    {textosMlt(f.mlt, g.dias_referencia.ena.slice(0, 4)).map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                  <TabelaInterativa
                    titulo="MLT mensal do PMO contra a MLT implícita do conjunto aberto, por subsistema"
                    colunas={COLUNAS_PMO}
                    linhas={linhasPmo(f.mlt)}
                    chaveLinha="id"
                    colunaRotulo="mes"
                    fonte="ONS, Relatório Executivo do PMO (tabela MLT das ENAs) e ENA Diário por Subsistema"
                    versao={versao}
                    nomeArquivo="agua-mlt-pmo"
                    chaveUrl="pmo"
                    ordemInicial={{ coluna: "mes", direcao: "desc" }}
                    nota={`Tolerância de ${num(f.mlt.pmo.tolerancia_pct, 2)}%: o PMO publica MWmed inteiros. Relatórios coletados: ${f.mlt.pmo.relatorios.length}.`}
                  />
                  <TabelaInterativa
                    titulo="Mudanças da MLT de usinas existentes fora do dia 1º"
                    colunas={COLUNAS_REVISOES_MLT}
                    linhas={linhasRevisoesMlt(f.mlt)}
                    chaveLinha="id"
                    colunaRotulo="data"
                    fonte="ONS, ENA Diário por Reservatório"
                    versao={versao}
                    nomeArquivo="agua-mlt-revisoes"
                    nota="Comparação por igualdade com a MLT vigente na mesma data 1 e 2 anos antes; a lista por usina está no CSV de mudanças da MLT."
                  />
                  <TabelaInterativa
                    titulo="MLT do fim de janeiro e de julho comparada com a do ano anterior, por usina"
                    colunas={COLUNAS_MLT_ANOS}
                    linhas={linhasMltAnos(f.mlt)}
                    chaveLinha="id"
                    colunaRotulo="ano"
                    fonte="ONS, ENA Diário por Reservatório"
                    versao={versao}
                    nomeArquivo="agua-mlt-anos"
                    ordemInicial={{ coluna: "ano", direcao: "desc" }}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="unidade" nivel="auditar" titulo="Unidade, capturas e conferências">
                  <p className="text-sm leading-relaxed text-carvao-muted">
                    Os dicionários do ONS chamam de MWmês as colunas de ENA por subsistema, REE e bacia, e de MWmed as por reservatório. A soma das usinas reproduz o
                    subsistema nas mesmas colunas: é a mesma unidade, MWmed (média do dia).
                  </p>
                  <TabelaInterativa
                    titulo="Soma da ENA das usinas contra a ENA do subsistema"
                    colunas={COLUNAS_UNIDADE}
                    linhas={linhasUnidade(f.mlt)}
                    chaveLinha="id"
                    colunaRotulo="sm"
                    fonte="ONS, ENA Diário por Reservatório e por Subsistema"
                    versao={versao}
                    nomeArquivo="agua-ena-unidade"
                    nota="O dia de exemplo é o mais recente comparado, não o dia da maior diferença. Esta publicação não informa em que anos a soma das usinas difere do subsistema nem o dia da maior diferença."
                  />
                  {conf && (
                    <p className="text-sm text-carvao-muted" data-texto="conferencia-bacias">
                      {textoConferenciaBacias(conf)}
                    </p>
                  )}
                  {f.ree_novos_por_data.length > 0 && (
                    <p className="text-sm text-carvao-muted">
                      REE que aparecem no arquivo de ENA depois do início do conjunto:{" "}
                      {listaTexto(f.ree_novos_por_data.map((x) => `${listaTexto(x.novos.map(nomeProprio))} em ${dataBR(x.data)}`))}; a faixa desses REE usa só anos do
                      perímetro atual.
                    </p>
                  )}
                  <p className="text-sm text-carvao-muted">{textoRevisoesCapturas(f.revisoes_entre_capturas_30d)}</p>
                  <TabelaInterativa
                    titulo="Revisões do ONS na ENA nos últimos 30 dias entre a captura anterior e a recaptura"
                    colunas={COLUNAS_REVISOES_CAPTURAS}
                    linhas={linhasRevisoesCapturas(f.revisoes_entre_capturas_30d)}
                    chaveLinha="id"
                    colunaRotulo="sm"
                    fonte="ONS, ENA Diário por Subsistema (duas capturas)"
                    versao={versao}
                    nomeArquivo="agua-ena-revisoes-capturas"
                    semLinhas="Nenhuma revisão entre as capturas."
                  />
                  <TabelaInterativa
                    titulo="Captura usada em cada ano"
                    colunas={COLUNAS_CAPTURAS}
                    linhas={linhasCapturas(f.captura_por_ano)}
                    chaveLinha="id"
                    colunaRotulo="ano"
                    fonte="ONS, ENA Diário por Subsistema"
                    versao={versao}
                    nomeArquivo="agua-ena-capturas"
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="regras-p018" nivel="auditar" titulo="Regras, fontes e arquivos">
                  <AguaRegras regras={{ ...g.regras, faixa_sazonal: REGRA_FAIXA_ENA, captura: REGRA_CAPTURA_ENA }} chaves={["ena_30d", "mlt", "faixa_sazonal", "captura"]} />
                  <AguaFontes provs={[prov.ena_30d, prov.ena_30d_ree, prov.ena_30d_bacia, prov.mlt]} />
                </SecaoDoPainel>

                <AguaSeguir ancora="p018" proximo={{ href: `${rotaPainel("p019")}#p019`, pergunta: perguntaPainel("p019") }} downloads={downloads} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
