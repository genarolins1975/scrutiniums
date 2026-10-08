import type { Metadata } from "next";
import { AguaAfluencia } from "@/components/energia/AguaAfluencia";
import { AguaAnalise, AguaAuditoria, AguaAviso, AguaFontes, AguaIndisponivel, AguaNavegacao, AguaRegras, AguaSeguir } from "@/components/energia/AguaPagina";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { Numero } from "@/components/energia/Numero";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
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
  SUBSISTEMAS,
  anoInicial,
  entidadesEna,
  linhasCapturas,
  linhasMltAnos,
  linhasPmo,
  linhasRevisoesCapturas,
  linhasRevisoesMlt,
  linhasUnidade,
  listaTexto,
  nomeProprio,
  perguntaPainel,
  rotaPainel,
  serieMltImplicita,
  serieRegioes,
  situacaoAtualidade,
  textoConferenciaBacias,
  textoMltNaoConcluir,
  textoMudancaAfluencia,
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
  const downloads = g.downloads.filter((d) => /agua_subsistemas_diario|agua_ear_recortes|agua_mlt_mudancas/.test(d.url));
  const sin = entidades.find((e) => e.id === "SIN");
  const conf = f.conferencia_bacias_sin;
  const mltSe = f.mlt.pmo.comparacao.filter((c) => c.sm === "SE");
  const implicita = serieMltImplicita(f.mlt);
  const desdeImplicita = anoInicial(implicita[0]?.x);

  return (
    <>
      <CabecalhoEnergia atual="agua-e-clima" />
      <MarcaVisita secao="energia:agua-e-clima" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6">
        <CabecalhoModulo siglas={["ENA", "MLT", "REE", "SIN", "MWmed", "EAR", "ONS"]}
          rotulo="Água e clima"
          titulo="Afluência"
          referencia={
            <>
              ONS, ENA Diário por Subsistema, por REE e por Bacia, até {dataBR(g.dias_referencia.ena)}; MLT do Relatório Executivo do PMO; processado em {carimbo(g.gerado_em)}.
            </>
          }
        >
          {perguntaPainel("p018")} A <Termo slug="ena">ENA</Termo> converte em energia as vazões naturais que chegam aos reservatórios. Em % da <Termo slug="mlt">MLT</Termo>, ela
          diz se a água que chega está acima ou abaixo da média de longo termo usada pelo ONS. Para isso, a página soma 30 dias de ENA e 30 dias de MLT antes de dividir, compara
          o resultado com a mesma janela dos anos anteriores e mostra que a própria MLT muda de versão.
        </CabecalhoModulo>
        <AguaNavegacao atual="p018" />
        <ModoProfundidade>
          <Bloco id="ena">
            <PainelEvidencia
              id="p018"
              pergunta={perguntaPainel("p018")}
              subtitulo="ENA bruta de 30 dias por subsistema, REE e bacia · % da MLT (razão de somas) · faixa da mesma janela nos anos da base"
              natureza="CALCULADO"
              porQueImporta={
                <>
                  A água que chega é a energia que poderá ser guardada ou gerada nas próximas semanas. Somar 30 dias suaviza a oscilação diária, e a comparação com a mesma
                  janela de outros anos separa a estação chuvosa de uma afluência fora do comum.
                </>
              }
              oQueMudou={
                <>
                  {atual.texto} {textoMudancaAfluencia(entidades)}
                </>
              }
              comoInterpretar={
                <>
                  100% é a MLT dos mesmos dias. A ENA de 30 dias é a soma da ENA dividida pela soma da MLT vigente em cada dia, nunca a média dos percentuais diários; o SIN soma
                  as ENA e as MLT dos quatro subsistemas. A faixa usual vai do 10º ao 90º percentil da mesma janela de 30 dias nos anos da base (mínimo de 5 anos).
                </>
              }
              naoConcluir={
                <>
                  Afluência alta não quer dizer reservatório cheio: o armazenamento depende também de quanto se gera, verte e transfere (painel de reservatórios).{" "}
                  {textoMltNaoConcluir(f.mlt)}
                </>
              }
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
                  destaques={
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Numero
                        rotulo="ENA bruta de 30 dias do SIN"
                        natureza="CALCULADO"
                        evidencia={ev.ena_30d_sin}
                        formato="pct"
                        casas={1}
                        unidade="da MLT"
                        tamanho="medio"
                        cor="var(--cor-energia)"
                        endereco={`${rotaPainel("p018")}#p018`}
                      />
                      <Numero
                        rotulo="ENA armazenável de 30 dias do SIN, mesma regra"
                        natureza="CALCULADO"
                        evidencia={ev.ena_arm_30d_sin}
                        valor={sin?.pct_mlt_arm_30d ?? null}
                        formato="pct"
                        casas={1}
                        unidade="da MLT armazenável"
                        periodo={sin ? `30 dias até ${dataBR(sin.dia)}` : undefined}
                        motivoAusencia="Sem ENA armazenável de 30 dias completa nesta publicação."
                        tamanho="medio"
                        cor="var(--serie-referencia)"
                        nota="Mesma razão de somas, com a ENA e a MLT armazenáveis publicadas pelo ONS para os subsistemas."
                        endereco={`${rotaPainel("p018")}#p018`}
                      />
                    </div>
                  }
                />

                <AguaAnalise id="mlt" titulo="Qual MLT? A referência muda de versão">
                  <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-carvao" data-textos="mlt">
                    {textosMlt(f.mlt, g.dias_referencia.ena.slice(0, 4)).map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                  {ev.mlt_pmo_vs_aberto && (
                    <p className="text-sm text-carvao">
                      Diferença entre a MLT do conjunto aberto e a do PMO no Sudeste/Centro-Oeste, no mês mais recente:{" "}
                      <ComproveNumero variante="valor" evidencia={ev.mlt_pmo_vs_aberto} />
                    </p>
                  )}
                  <GraficoLinhas
                    titulo="MLT do Sudeste/Centro-Oeste no PMO e no conjunto aberto, mês a mês"
                    dados={mltSe.map((c) => ({ m: c.mes, pmo: c.pmo_mwmed, inicio: c.aberto_inicio_mwmed, fim: c.aberto_fim_mwmed }))}
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
                  <GraficoLinhas
                    titulo={`MLT implícita de cada subsistema no dia 15 de janeiro e de julho${desdeImplicita ? `, desde ${desdeImplicita}` : ""}`}
                    dados={implicita}
                    chaveX="x"
                    formatoX="mes"
                    series={SUBSISTEMAS.map((sm) => ({ id: sm, rotulo: NOME_REGIAO[sm], sigla: CURTO_REGIAO[sm], cor: COR_REGIAO[sm] }))}
                    unidade="MWmed"
                    casas={0}
                  />
                  <p className="text-sm text-carvao-muted">
                    MLT implícita = ENA ÷ (% da MLT ÷ 100), lida dos próprios arquivos. Ela cresce com a entrada de usinas e muda quando o ONS troca a versão da referência; janeiro
                    e julho mostram a estação chuvosa e a seca. {f.mlt.anos_regra}.
                  </p>
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
                </AguaAnalise>

                <AguaAuditoria id="unidade" titulo="Unidade, capturas e conferências">
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
                </AguaAuditoria>

                <AguaAuditoria id="regras-p018" titulo="Regras, fontes e arquivos">
                  <AguaRegras regras={g.regras} chaves={["ena_30d", "mlt", "faixa_sazonal", "captura"]} />
                  <AguaFontes provs={[prov.ena_30d, prov.ena_30d_ree, prov.ena_30d_bacia, prov.mlt]} />
                </AguaAuditoria>

                <AguaSeguir ancora="p018" proximo={{ href: `${rotaPainel("p019")}#p019`, pergunta: perguntaPainel("p019") }} downloads={downloads} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
