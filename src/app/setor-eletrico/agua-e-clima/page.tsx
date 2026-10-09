import type { Metadata } from "next";
import { AguaArmazenamento } from "@/components/energia/AguaArmazenamento";
import {
  AguaAnalise,
  AguaAuditoria,
  AguaAviso,
  AguaCapitulos,
  AguaDatas,
  AguaFontes,
  AguaIndisponivel,
  AguaNavegacao,
  AguaParteAusente,
  AguaRegras,
  AguaSeguir,
} from "@/components/energia/AguaPagina";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { Numero } from "@/components/energia/Numero";
import { RedirecionaAncoraAntiga } from "@/components/energia/RedirecionaAncoraAntiga";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { Unidade } from "@/components/evidencia/Unidade";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import {
  ANCORAS_AFLUENCIA,
  COLUNAS_CAPTURAS,
  COLUNAS_EVENTOS,
  COLUNAS_FIM_DE_ANO,
  COLUNAS_QUEBRA_REE,
  COLUNAS_RESERVATORIOS_POR_ANO,
  COLUNAS_RESUMO,
  COLUNAS_REVISOES_CAPTURAS,
  REVISOES_CAPACIDADE,
  TEXTO_TIPOS_DE_EVENTO,
  anoInicial,
  entidadesEar,
  linhasCapturas,
  linhasEventos,
  linhasFimDeAno,
  linhasQuebraRee,
  linhasReservatoriosPorAno,
  linhasResumo,
  linhasRevisoesCapturas,
  periodoBase,
  perguntaPainel,
  respostaCapacidade,
  rotaPainel,
  serieMensalEar,
  serieRegioes,
  situacaoAtualidade,
  textoJanelasDaVariacao,
  textoMesParcial,
  textoMudancaArmazenamento,
  textoQuebraRee,
  textoReconciliacaoEar,
  textoResumo,
  textoRevisoesCapturas,
  textoRevisoesFichaEar,
  textoToleranciaEventos,
} from "@/lib/energia/agua";
import { carimbo, dataBR } from "@/lib/energia/formato";
import { gold, integra, lerGold } from "@/lib/energia/gold";
import type { AguaDetalheGold } from "@/lib/energia/tipos-agua";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Água e clima: energia armazenada nos reservatórios",
  description:
    "Energia armazenada (EAR) do SIN, dos subsistemas, dos REE e das bacias do ONS, em MWmês e em % da capacidade, contra a faixa do mesmo dia nos anos anteriores, com as mudanças de capacidade e a reconciliação entre os recortes.",
  alternates: { canonical: "/setor-eletrico/agua-e-clima" },
};

const FONTE = "ONS, EAR Diário por Subsistema, por REE e por Bacia (captura mais recente de cada ano)";
const URLS_P017 = ["agua_subsistemas_diario", "agua_ear_recortes_diario", "agua_ear_recortes_mensal", "agua_capacidade_eventos"];

export default function AguaPage() {
  const g = lerGold<AguaDetalheGold>("agua_detalhe.json");
  if (!integra(g)) return <AguaIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;
  // resumo de operação (hidrologia.json): só para a conferência do modo Auditar; os números
  // desta página vêm todos de agua_detalhe.json
  const hid = gold.hidrologia();
  const h = integra(hid) ? hid : null;

  const a = g.armazenamento;
  const ev = g.evidencias;
  const prov = g.proveniencia;
  const entidades = entidadesEar(a);
  const sin = entidades.find((x) => x.tipo === "subsistema" && x.id === "SIN") ?? null;
  const atual = situacaoAtualidade(g.dias_referencia.ear, g.gerado_em, 3, "o ONS publica a EAR do dia anterior");
  const versao = g.dias_referencia.ear;
  const downloads = [
    ...g.downloads.filter((d) => URLS_P017.some((u) => d.url.includes(u))),
    // a série diária completa, em %, que dá a faixa de cada data: o diário do painel começa depois (a base da faixa não cabe nele)
    { rotulo: "EAR diária por subsistema e SIN em % da EAR máxima, série completa, a base da faixa usual (CSV)", url: "/energia/series/ear_diario.csv" },
  ];
  const rec = g.reconciliacao_ear;
  const quebra = a.quebras_perimetro_ree[0] ?? null;
  const decomposicoes = g.reservatorios.decomposicao_ear;
  // as fichas da EAR dizem o que a tabela de revisões da própria página mostra
  const revisoesEar = textoRevisoesFichaEar(rec.revisoes_entre_capturas_30d);
  // ano inicial da contagem de capacidade e base da faixa do SIN: lidos da gold, não escritos aqui
  const desdeCap = anoInicial(a.capacidade.inicio);
  const oQueMudouAgua = (
    <>
                      {atual.texto} {textoMudancaArmazenamento(entidades)} {textoJanelasDaVariacao(sin?.dia ?? null, decomposicoes)}
                    </>
  );
  const comoInterpretarAgua = (
    <>
                      A área sombreada vai do 10º ao 90º percentil do mesmo dia do calendário nos anos completos da base: fora dela, a EAR está entre os 10% de anos
                      mais baixos ou mais altos da data. O SIN é a soma das energias dividida pela soma das capacidades, nunca a média dos percentuais. Com menos de
                      5 anos na base não há faixa, e recorte sem armazenamento (só usinas a fio d&apos;água) aparece como não se aplica.
                    </>
  );
  const naoConcluirAgua = (
    <>
                      A posição na faixa não mede risco de desabastecimento nem diz qual será o preço. A EAR máxima mudou ao longo da base, então a faixa em %
                      compara capacidades diferentes (a faixa em MWmês está na tabela). Um SIN dentro da faixa pode esconder um subsistema ou uma bacia apertada. A
                      variação da EAR não se explica só pela ENA: a conta por reservatório está no painel de reservatórios.
                    </>
  );
  const baseSin = a.subsistemas.find((s) => s.sm === "SIN")?.periodo_base ?? null;

  return (
    <>
      <CabecalhoEnergia atual="agua-e-clima" />
      <MarcaVisita secao="energia:agua-e-clima" />
      <RedirecionaAncoraAntiga ancoras={ANCORAS_AFLUENCIA} destino={rotaPainel("p018")} />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          siglas={["SIN", "REE", "PLD", "ONS"]}
          titulo={perguntaPainel("p017")}
          lead="O armazenamento de cada região frente à capacidade e à mediana da mesma data nos anos anteriores."
          recorte={sin?.dia ? `${dataBR(sin.dia)} · SIN e subsistemas · % da EAR máxima e MWmês` : undefined}
          fonte="ONS, energia armazenada (EAR) e afluente (ENA)"
          referencia={
            <>
              ONS (EAR, ENA e dados hidráulicos), NASA POWER (chuva e temperatura estimadas) e ECMWF pelo Open-Meteo (previsão); processado em{" "}
              {carimbo(g.gerado_em)}.
            </>
          }
          datas={
            <AguaDatas
              itens={[
                { rotulo: "EAR", dia: g.dias_referencia.ear, natureza: "OBSERVADO" },
                { rotulo: "ENA", dia: g.dias_referencia.ena, natureza: "OBSERVADO" },
                { rotulo: "Reservatórios", dia: g.dias_referencia.reservatorios, natureza: "OBSERVADO" },
                { rotulo: "Chuva por satélite", dia: g.dias_referencia.precipitacao, natureza: "ESTIMADO" },
                { rotulo: "Temperatura de reanálise", dia: g.dias_referencia.temperatura, natureza: "ESTIMADO" },
              ]}
            />
          }
          metricas={
            <FaixaMetricas colunas={4} rotulo="Indicadores do armazenamento no SIN">
              <Numero
                variante="faixa"
                rotulo="Armazenamento no SIN"
                natureza="CALCULADO"
                evidencia={ev.ear_sin}
                formato="pct"
                casas={1}
                unidade="da EAR máxima"
                cor="var(--cor-energia)"
                endereco={`${rotaPainel("p017")}#p017`}
              />
              {sin && sin.p50 !== null && (
                <Numero
                  variante="faixa"
                  rotulo="Mediana da mesma data"
                  natureza="CALCULADO"
                  valor={sin.p50}
                  formato="pct"
                  casas={1}
                  unidade="da EAR máxima"
                  periodo={`mesmo dia do ano em ${periodoBase(sin.periodo_base)}`}
                  cor="var(--serie-referencia)"
                />
              )}
              <Numero
                variante="faixa"
                rotulo="Energia armazenada no SIN"
                natureza="CALCULADO"
                evidencia={ev.ear_sin_mwmes}
                formato="num"
                casas={0}
                unidade="MWmês"
                cor="var(--cor-energia)"
                endereco={`${rotaPainel("p017")}#p017`}
              />
              {sin && sin.variacao_30d_pp !== null && (
                <Numero
                  variante="faixa"
                  rotulo="Variação em 30 dias"
                  natureza="CALCULADO"
                  valor={sin.variacao_30d_pp}
                  formato="num"
                  casas={1}
                  unidade="p.p. da EAR máxima"
                  periodo={sin.dia ? `30 dias até ${dataBR(sin.dia)}` : undefined}
                />
              )}
            </FaixaMetricas>
          }
        >
          A <Termo slug="ear">EAR</Termo> é a energia que a água guardada nos reservatórios produziria nas usinas, em <Unidade u="MWmês" />; a{" "}
          <Termo slug="ena">ENA</Termo> é a energia das vazões naturais que chegam a eles, comparada com a <Termo slug="mlt">MLT</Termo>. As quatro páginas
          respondem, nesta ordem: quanto está guardado, se a água que chega está acima do normal, como chuva e temperatura se relacionam com a água e com a
          demanda, e por que o armazenamento mudou, reservatório por reservatório.
        </CabecalhoModulo>
        <AguaNavegacao atual="p017" />
        <ModoProfundidade>
          <Bloco id="ear">
            <PainelEvidencia
              id="p017"
              pergunta="Cada região frente à mediana da mesma data"
              subtitulo="EAR do SIN, dos subsistemas, dos REE e das bacias · MWmês e % da EAR máxima · faixa do mesmo dia nos anos da base"
              natureza="CALCULADO"
              porQueImporta={
                <>
                  A EAR diz quanta energia o sistema tem guardada em água. Em MWmês ela mostra o tamanho do estoque; em % da EAR máxima, quão cheio está cada
                  recorte. Comparar com o mesmo dia de anos anteriores separa a estação do ano de uma situação fora do comum.
                </>
              }
              oQueMudou={oQueMudouAgua}
              comoInterpretar={comoInterpretarAgua}
              naoConcluir={naoConcluirAgua}
              naoConcluirNoCorpo
              proveniencia={prov.ear_sin!}
              complementares={[
                ...(prov.ear_ree ? [{ rotulo: "EAR por REE", p: prov.ear_ree }] : []),
                ...(prov.ear_bacia ? [{ rotulo: "EAR por bacia", p: prov.ear_bacia }] : []),
                ...(prov.capacidade ? [{ rotulo: "Mudanças de capacidade", p: prov.capacidade }] : []),
              ]}
            >
              <div className="space-y-6">
                {atual.defasada && <AguaAviso tipo="alerta">{atual.texto}</AguaAviso>}
                <div id="padrao" className="scroll-mt-28">
                  <AguaArmazenamento
                    entidades={entidades}
                    diaria={serieRegioes(a.serie_diaria_mwmes)}
                    mensal={serieMensalEar(a.serie_mensal_mwmes)}
                    textoMensal={textoMesParcial(a.serie_mensal_mwmes)}
                    fonte={FONTE}
                    versao={versao}
                    notas={<NotasDoPainel oQueMudou={oQueMudouAgua} comoInterpretar={comoInterpretarAgua} naoConcluir={naoConcluirAgua} />}
                    aposPrincipal={<AguaCapitulos />}
                    destaquesHistoria={
                      <Numero
                        variante="faixa"
                        rotulo={`Mudanças da capacidade de armazenamento (EAR máxima)${desdeCap ? ` desde ${desdeCap}` : ""}`}
                        natureza="CALCULADO"
                        evidencia={ev.capacidade}
                        formato="num"
                        casas={0}
                        unidade="mudanças"
                        cor="var(--serie-referencia)"
                        nota={
                          a.capacidade.eventos_fechados === a.capacidade.n_eventos
                            ? "Cada mudança é um dia em que a EAR máxima de um subsistema mudou. Todas foram atribuídas a reservatórios, e a diferença que sobra em cada uma (o resíduo) está publicada."
                            : `Cada mudança é um dia em que a EAR máxima de um subsistema mudou. ${a.capacidade.eventos_fechados} de ${a.capacidade.n_eventos} foram atribuídas a reservatórios dentro da tolerância; a diferença que sobra em cada uma (o resíduo) está publicada.`
                        }
                        endereco={`${rotaPainel("p017")}#capacidade`}
                      />
                    }
                  />
                </div>

                <AguaAnalise id="capacidade" titulo={`Mudanças da capacidade de armazenamento${desdeCap ? ` desde ${desdeCap}` : ""}`}>
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao" data-resposta="p017-capacidade">
                    {respostaCapacidade(a.capacidade, a.dia)}
                  </p>
                  {ev.capacidade && <ComproveNumero evidencia={ev.capacidade} />}
                  <TabelaInterativa
                    titulo="Dias em que a EAR máxima de um subsistema mudou, com os reservatórios que explicam a mudança"
                    colunas={COLUNAS_EVENTOS}
                    linhas={linhasEventos(a.capacidade.eventos)}
                    chaveLinha="id"
                    colunaRotulo="data"
                    fonte="ONS, EAR Diário por Reservatório e por Subsistema"
                    versao={versao}
                    nomeArquivo="agua-capacidade-eventos"
                    chaveUrl="cap"
                    ordemInicial={{ coluna: "data", direcao: "desc" }}
                    nota="Tolerância do resíduo: 10 MWmês até 2017 (valores inteiros na fonte) e 0,05 MWmês desde 2018. A lista completa de reservatórios de cada evento está no CSV."
                  />
                  <TabelaInterativa
                    titulo="EAR máxima no último dia de cada ano, por subsistema e SIN"
                    colunas={COLUNAS_FIM_DE_ANO}
                    linhas={linhasFimDeAno(a.capacidade)}
                    chaveLinha="id"
                    colunaRotulo="ano"
                    fonte="ONS, EAR Diário por Subsistema"
                    versao={versao}
                    nomeArquivo="agua-ear-maxima-fim-de-ano"
                    ordemInicial={{ coluna: "ano", direcao: "desc" }}
                    nota="O último ano é parcial: o dia usado é o último publicado."
                  />
                </AguaAnalise>

                {quebra && (
                  <AguaAnalise id="perimetro-ree" titulo="A reconfiguração dos REE no fim de 2017">
                    <p className="max-w-prose2 text-sm leading-relaxed text-carvao" data-texto="quebra-ree">
                      {textoQuebraRee(quebra)}
                    </p>
                    <TabelaInterativa
                      titulo={`EAR máxima de cada REE antes e depois de ${dataBR(quebra.data)}`}
                      colunas={COLUNAS_QUEBRA_REE}
                      linhas={linhasQuebraRee(quebra)}
                      chaveLinha="id"
                      colunaRotulo="nome"
                      fonte="ONS, EAR Diário por REE"
                      versao={quebra.data}
                      nomeArquivo="agua-ree-reconfiguracao"
                    />
                  </AguaAnalise>
                )}

                <AguaAuditoria id="reconciliacao" titulo="O mesmo SIN por caminhos diferentes, e as capturas usadas">
                  <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-carvao-muted" data-textos="reconciliacao">
                    {textoReconciliacaoEar(rec).map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                  {ev.ear_sin_mwmes && <ComproveNumero evidencia={ev.ear_sin_mwmes} rotulo="Comprove a soma do SIN" />}
                  <TabelaInterativa
                    titulo="Anos e subsistemas em que a soma dos reservatórios difere do subsistema além da tolerância"
                    colunas={COLUNAS_RESERVATORIOS_POR_ANO}
                    linhas={linhasReservatoriosPorAno(rec)}
                    chaveLinha="id"
                    colunaRotulo="ano"
                    fonte="ONS, EAR Diário por Reservatório e por Subsistema"
                    versao={versao}
                    nomeArquivo="agua-reconciliacao-reservatorios"
                    semLinhas="Nenhum ano fora da tolerância."
                    nota="Causa não identificada; o dado do ONS não é corrigido. A diferença aparece também como ressalva da publicação."
                  />
                  <p className="text-sm text-carvao-muted">{textoRevisoesCapturas(rec.revisoes_entre_capturas_30d)}</p>
                  <TabelaInterativa
                    titulo="Revisões do ONS nos últimos 30 dias entre a captura anterior e a recaptura"
                    colunas={COLUNAS_REVISOES_CAPTURAS}
                    linhas={linhasRevisoesCapturas(rec.revisoes_entre_capturas_30d)}
                    chaveLinha="id"
                    colunaRotulo="sm"
                    fonte="ONS, EAR Diário por Subsistema (duas capturas)"
                    versao={versao}
                    nomeArquivo="agua-ear-revisoes-capturas"
                    semLinhas="Nenhuma revisão entre as capturas."
                  />
                  <TabelaInterativa
                    titulo="Captura usada em cada ano"
                    colunas={COLUNAS_CAPTURAS}
                    linhas={linhasCapturas(rec.captura_por_ano)}
                    chaveLinha="id"
                    colunaRotulo="ano"
                    fonte="ONS, EAR Diário por Subsistema"
                    versao={versao}
                    nomeArquivo="agua-ear-capturas"
                  />
                  {g.ressalvas.length > 0 && (
                    <div>
                      <p className="rotulo text-mineral">Ressalvas desta publicação</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-carvao-muted">
                        {g.ressalvas.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </AguaAuditoria>

                <AguaAuditoria id="regras-p017" titulo="Regras, fontes e arquivos">
                  <AguaRegras regras={g.regras} chaves={["ear_agregada", "ear_absoluta", "faixa_sazonal", "nao_se_aplica", "capacidade", "captura"]} />
                  <AguaFontes provs={[prov.ear_sin, prov.ear_ree, prov.ear_bacia, prov.capacidade]} />
                </AguaAuditoria>

                <AguaSeguir
                  ancora="p017"
                  proximo={{
                    href: `${rotaPainel("p018")}#p018`,
                    pergunta: perguntaPainel("p018"),
                  }}
                  downloads={downloads}
                />
              </div>
            </PainelEvidencia>
          </Bloco>

          <Bloco id="resumo-operacao" nivel="auditar">
            {h ? (
              <PainelEvidencia
                id="conferencia-resumo"
                nivel="auditar"
                pergunta="Por que a Visão geral e o PLD podem mostrar outro número de EAR e de ENA?"
                subtitulo="Resumo de operação (hidrologia.json) e esta página, cada um com o seu dia · % da EAR máxima e % da MLT"
                natureza="CALCULADO"
                porQueImporta={
                  <>Quem chega da Visão geral ou do PLD encontra aqui a mesma grandeza; esta conferência mostra de onde vem cada número e o dia de cada um.</>
                }
                oQueMudou={<>{textoResumo(h, g.dias_referencia.ear, g.dias_referencia.ena, baseSin)}</>}
                comoInterpretar={
                  <>Cada linha traz o valor do resumo e o desta página com o dia de cada um. Nenhuma diferença é calculada: dias diferentes não se subtraem.</>
                }
                naoConcluir={
                  <>
                    Uma diferença entre as duas publicações não indica erro de cálculo: a captura e o dia de referência podem ser outros, e o ONS revisa os dias
                    recentes.
                  </>
                }
                proveniencia={h.proveniencia.ena30}
                complementares={[
                  { rotulo: "EAR do SIN no resumo", p: h.proveniencia.ear_sin },
                  {
                    rotulo: "Faixa histórica do resumo",
                    p: h.proveniencia.padrao,
                  },
                  {
                    rotulo: "EAR mensal do resumo",
                    p: h.proveniencia.ear_mensal ?? h.proveniencia.ear,
                  },
                ]}
              >
                <TabelaInterativa
                  titulo="EAR e ENA de 30 dias no resumo de operação e nesta página"
                  colunas={COLUNAS_RESUMO}
                  linhas={linhasResumo(h, a, g.afluencia)}
                  chaveLinha="id"
                  colunaRotulo="regiao"
                  fonte="hidrologia.json (silver principal) e agua_detalhe.json (captura mais recente de cada ano), ONS"
                  versao={versao}
                  nomeArquivo="agua-conferencia-resumo"
                />
              </PainelEvidencia>
            ) : (
              <AguaParteAusente titulo="Conferência com o resumo de operação" motivo={textoResumo(null, g.dias_referencia.ear, g.dias_referencia.ena, baseSin)} />
            )}
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
