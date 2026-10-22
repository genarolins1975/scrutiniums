import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import { AguaAviso, AguaDatas, AguaFontes, AguaIndisponivel, AguaNavegacao, AguaParteAusente, AguaRegras, AguaSeguir } from "@/components/energia/AguaPagina";
import { AguaPontes } from "@/components/energia/AguaPontes";
import { AguaReservatorios } from "@/components/energia/AguaReservatorios";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { Numero } from "@/components/energia/Numero";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { comNomes, UnidadeMwmes } from "@/components/energia/AguaLegenda";
import { Unidade } from "@/components/evidencia/Unidade";
import { Nome } from "@/components/i18n/Nome";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import {
  colunasDecomposicaoSubsistemas,
  entidadesEar,
  linhasDecomposicaoSubsistemas,
  nomeProprio,
  nomesProprios,
  perguntaPainel,
  revisoesCapturaUnica,
  rotaPainel,
  situacaoAtualidade,
  textoFechamento,
  textoMudancaDecomposicao,
  textoPartesDaEar,
  textoSemCadastro,
} from "@/lib/energia/agua";
import { carimbo, dataBR } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import type { AguaDetalheGold } from "@/lib/energia/tipos-agua";
import { tx } from "@/lib/energia/idioma";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/agua-e-clima/reservatorios", {
    title: tx("Água e clima: por que o armazenamento mudou", "Water and climate: why storage changed"),
    description: tx(
      "Variação da energia armazenada de cada subsistema decomposta por reservatório e balanço hídrico de 30 dias de cada reservatório do ONS, com afluência, defluência, turbinamento, vertimento, transferência e resíduo explícito.",
      "Change in each subsystem's stored energy broken down by reservoir, and the 30-day water balance of each ONS reservoir, with inflow, outflow, turbined and spilled flow, transfer and an explicit residual.",
    ),
    alternates: { canonical: "/setor-eletrico/agua-e-clima/reservatorios" },
  }, anterior);
}

const fonte = () =>
  tx(
    "ONS, Dados Hidráulicos por Reservatório (base diária) e Reservatórios (cadastro)",
    "ONS, daily hydraulic data by reservoir and reservoir register",
  );

export default function ReservatoriosPage() {
  const g = lerGold<AguaDetalheGold>("agua_detalhe.json");
  if (!integra(g)) return <AguaIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const r = g.reservatorios;
  const ev = g.evidencias;
  const prov = g.proveniencia;
  const atual = situacaoAtualidade(g.dias_referencia.reservatorios, g.gerado_em, 3, tx("o ONS publica os dados hidráulicos do dia anterior", "ONS publishes the previous day's hydraulic data"));
  const downloads = g.downloads.filter((d) => /agua_reservatorios|agua_capacidade/.test(d.url));
  const fimEar = r?.decomposicao_ear[0]?.fim ?? null;
  // nomes legíveis dos reservatórios sem cadastro quando estão na lista; os demais ficam com o identificador do ONS
  const semCadastroNomes = r?.sem_cadastro.map((id) => {
    const x = r.lista.find((y) => y.id === id);
    return x ? `${nomeProprio(x.nome)} (${id})` : id;
  });
  const oQueMudou = (
    <>
      {atual.texto} {r ? textoMudancaDecomposicao(r.decomposicao_ear) : ""}
    </>
  );
  const comoInterpretar = tx(
    <>
      A decomposição é uma identidade contábil: a variação do subsistema é a soma das variações dos reservatórios que contam nele (a parte própria de cada um, nas usinas do
      subsistema dele, e a parte a jusante, nas usinas de outro subsistema), com o resíduo publicado. A conta de cada reservatório é variação observada do volume = afluência −
      defluência + resíduo, em hm³, com o volume útil do cadastro do ONS. A energia natural afluente (ENA) e a geração hidráulica aparecem como contexto: não fecham a conta com a
      EAR.
    </>,
    <>
      The breakdown is an accounting identity: the change of the subsystem is the sum of the changes of the reservoirs that count in it (each one&apos;s own part, in the plants of
      its own subsystem, and its downstream part, in the plants of another subsystem), with the published residual. Each reservoir&apos;s balance is observed change in volume =
      inflow − outflow + residual, in hm³, with the useful volume from the ONS register. Natural inflow energy (ENA) and hydro generation appear as context: they do not balance
      against the EAR.
    </>,
  );
  const naoConcluir = tx(
    <>
      A afluência publicada pelo ONS é, na maioria dos reservatórios, calculada pela própria conta da água: resíduo perto de zero não confirma medição de vazão. A variação da EAR não
      se explica só pela ENA, e nenhuma conta é fechada por ajuste: o resíduo fica visível. O ONS não diz se a defluência publicada inclui as outras estruturas; o observatório deduz
      isso dos dados de cada reservatório, e a dedução pode mudar sem aviso. A janela é única, de 30 dias, e a publicação não traz a faixa usual da data para o volume nem para a
      conta de cada reservatório: a página não diz se uma queda é comum para a época.
    </>,
    <>
      The inflow published by ONS is, in most reservoirs, calculated from the water balance itself: a residual close to zero does not confirm a flow measurement. The change in EAR is
      not explained by the ENA alone, and no balance is closed by adjustment: the residual remains visible. ONS does not say whether the published outflow includes the other
      structures; the observatory infers this from each reservoir&apos;s data, and the inference may change without notice. There is a single 30-day window, and the release does not
      include the usual range for the date for the volume or for each reservoir&apos;s balance: the page does not say whether a fall is common for the season.
    </>,
  );
  const qualidade = r ? (
    <SecaoDoPainel
      id="qualidade"
      titulo={tx("A conta da água fecha porque a afluência sai dela?", "Does the water balance close because the inflow comes from it?")}
      lead={tx(
        `Dos ${r.n_reservatorios} reservatórios dos dados hidráulicos do ONS, ${r.n_com_balanco} têm conta de 30 dias, e em ${r.n_fecham_por_construcao} deles a afluência publicada sai da própria conta da água: o resíduo perto de zero é esperado nesses e não prova a vazão. A lista desta página é menor, os reservatórios com EAR máxima positiva.`,
        `Of the ${r.n_reservatorios} reservoirs in the ONS hydraulic data, ${r.n_com_balanco} have a 30-day balance, and in ${r.n_fecham_por_construcao} of them the published inflow comes from the water balance itself: a residual close to zero is expected in those and does not prove the flow. This page's list is smaller: the reservoirs with a positive maximum EAR.`,
      )}
    >
      <FaixaMetricas colunas={2} rotulo={tx("Qualidade da conta da água dos reservatórios", "Quality of the reservoirs' water balance")}>
        <Numero
          variante="faixa"
          rotulo={tx("Reservatórios com conta da água de 30 dias", "Reservoirs with a 30-day water balance")}
          natureza="CALCULADO"
          valor={r.n_com_balanco}
          formato="num"
          casas={0}
          unidade={tx(`de ${r.n_reservatorios} nos dados hidráulicos`, `of ${r.n_reservatorios} in the hydraulic data`)}
          periodo={tx(`${dataBR(r.inicio)} a ${dataBR(r.fim)}`, `${dataBR(r.inicio)} to ${dataBR(r.fim)}`)}
        />
        <Numero
          variante="faixa"
          rotulo={tx("Reservatórios em que a afluência sai da própria conta da água", "Reservoirs where the inflow comes from the water balance itself")}
          natureza="CALCULADO"
          evidencia={ev.fecham_por_construcao}
          revisoes={revisoesCapturaUnica()}
          valor={r.n_fecham_por_construcao}
          formato="num"
          casas={0}
          unidade={tx(`de ${r.n_com_balanco} com conta`, `of ${r.n_com_balanco} with a balance`)}
          periodo={r.periodo_fecham_por_construcao ?? undefined}
          nota={tx("Nesses, a conta fecha sempre: o fechamento não é prova independente.", "In those, the balance always closes: the closure is not independent proof.")}
          endereco={`${rotaPainel("p020")}#qualidade`}
        />
      </FaixaMetricas>
    </SecaoDoPainel>
  ) : null;

  return (
    <>
      <header><CabecalhoPlataforma colecao="energia" destinoConta="/setor-eletrico" navegacao="setor-eletrico" idiomas /></header>
      <MarcaVisita secao="energia:agua-e-clima" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <AguaNavegacao atual="p020" />
        <CabecalhoModulo
          rotulo={tx("Água e clima", "Water and climate")}
          siglas={["EAR", "ENA", "MWmed", "ONS"]}
          titulo={perguntaPainel("p020")}
          lead={tx(
            "A variação de 30 dias da energia armazenada (EAR) de cada subsistema, repartida por reservatório, e a conta da água de cada um: mostra onde o armazenamento subiu ou caiu.",
            "The 30-day change in stored energy (EAR) of each subsystem, split by reservoir, and the water balance of each one: it shows where storage rose or fell.",
          )}
          limite={tx(
            "A decomposição mostra onde a energia variou, não por que: vazão, operação e consumo não são separados aqui. Os dados dos últimos dias são provisórios, e o ONS os revisa depois.",
            "The breakdown shows where the energy changed, not why: flow, operation and consumption are not separated here. The data for the last few days are provisional, and ONS revises them later.",
          )}
          recorte={
            r
              ? tx(`EAR até ${dataBR(fimEar)} · balanço até ${dataBR(r.fim)} · MWmês e hm³`, `EAR through ${dataBR(fimEar)} · balance through ${dataBR(r.fim)} · MWmonth and hm³`)
              : undefined
          }
          fonte={tx("ONS, EAR e dados hidráulicos por reservatório", "ONS, EAR and hydraulic data by reservoir")}
          referencia={tx(
            <>
              ONS, EAR Diário por Reservatório e Dados Hidráulicos por Reservatório, até {dataBR(g.dias_referencia.reservatorios)}; processado em {carimbo(g.gerado_em)}.
            </>,
            <>
              ONS, <Nome>EAR Diário por Reservatório</Nome> and <Nome>Dados Hidráulicos por Reservatório</Nome> (daily EAR and hydraulic data by reservoir), through{" "}
              {dataBR(g.dias_referencia.reservatorios)};
              processed on {carimbo(g.gerado_em)}.
            </>,
          )}
          datas={
            <AguaDatas
              itens={[
                { rotulo: tx("EAR por reservatório (energia derivada pelo ONS)", "EAR by reservoir (energy derived by ONS)"), dia: fimEar, natureza: "OBSERVADO" },
                {
                  rotulo: tx("Dados hidráulicos (afluência e defluência derivadas pelo ONS)", "Hydraulic data (inflow and outflow derived by ONS)"),
                  dia: g.dias_referencia.reservatorios,
                  natureza: "OBSERVADO",
                },
              ]}
            />
          }
        >
          {tx(
            <>
              A <Termo slug="ear">EAR</Termo> de um subsistema é a soma da energia guardada em cada reservatório, em <Unidade u="MWmês" />. {r ? textoPartesDaEar(r.decomposicao_ear, r.lista) : textoPartesDaEar([], [])}{" "}
              Esta página mostra quais reservatórios explicam a variação de 30 dias e, em cada um, a conta da água, em hm³ (milhões de metros cúbicos): o que entrou (afluência), o que
              saiu (defluência, pelas turbinas, pelos vertedouros e por outras estruturas) e o resíduo, a diferença que sobra quando a conta não fecha.
            </>,
            <>
              The <Termo slug="ear">EAR</Termo> (stored energy) of a subsystem is the sum of the energy held in each reservoir, in <UnidadeMwmes />.{" "}
              {comNomes(r ? textoPartesDaEar(r.decomposicao_ear, r.lista) : textoPartesDaEar([], []), nomesProprios((r?.lista ?? []).map((x) => x.nome), (r?.decomposicao_ear ?? []).flatMap((d) => [...d.maiores_quedas, ...d.maiores_altas].map((x) => x.nome ?? x.cod))))} This page shows which reservoirs explain the 30-day change and, in each one, the water
              balance, in hm³ (millions of cubic meters): what came in (inflow), what went out (outflow, through the turbines, the spillways and other structures) and the residual, the
              difference left over when the balance does not close.
            </>,
          )}
        </CabecalhoModulo>
        <ModoProfundidade>
          <Bloco id="reservatorios">
            <PainelEvidencia
              id="p020"
              pergunta={tx("Quais reservatórios pesaram na variação da energia armazenada?", "Which reservoirs weighed on the change in stored energy?")}
              subtitulo={tx(
                "Variação da EAR por reservatório, em MWmês, e a conta da água de cada um (valores derivados pelo ONS)",
                "Change in EAR by reservoir, in MWmonth, and the water balance of each one (values derived by ONS)",
              )}
              natureza="CALCULADO"
              porQueImporta={tx(
                <>
                  Saber que a EAR caiu não diz onde nem por quê. A soma reservatório por reservatório localiza a queda, e o balanço de cada um mostra se a água saiu pelas
                  turbinas, pelos vertedouros ou se a afluência diminuiu, com o resíduo à vista.
                </>,
                <>
                  Knowing that the EAR fell does not say where or why. The reservoir-by-reservoir sum locates the fall, and the balance of each one shows whether the water went out
                  through the turbines, through the spillways or whether the inflow decreased, with the residual in view.
                </>,
              )}
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={prov.balanco!}
              complementares={prov.capacidade ? [{ rotulo: tx("EAR por reservatório (decomposição)", "EAR by reservoir (breakdown)"), p: prov.capacidade }] : []}
            >
              <div className="space-y-6">
                {atual.defasada && <AguaAviso tipo="alerta">{atual.texto}</AguaAviso>}
                {r ? (
                  <AguaReservatorios
                    lista={r.lista}
                    decomposicao={r.decomposicao_ear}
                    janela={{ inicio: r.inicio, fim: r.fim, periodo_fecham_por_construcao: r.periodo_fecham_por_construcao }}
                    armazenamento={entidadesEar(g.armazenamento)}
                    urlSeries={r.series_45d.arquivo}
                    diasSeries={r.series_45d.dias}
                    fonte={fonte()}
                    versao={r.fim}
                    notas={<NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />}
                    qualidade={qualidade}
                    semCadastro={r.sem_cadastro}
                    evidenciaResiduo={ev.balanco_maior_reservatorio}
                    enderecoBalanco={`${rotaPainel("p020")}#balanco`}
                  />
                ) : (
                  <>
                    <AguaParteAusente
                      titulo={tx("Reservatórios indisponíveis nesta publicação", "Reservoirs unavailable in this release")}
                      motivo={
                        g.pendencias.some((p) => /reservat/i.test(p)) ? (
                          <TrechoPortugues regiao="agua-pendencia">{g.pendencias.filter((p) => /reservat/i.test(p)).join("; ")}</TrechoPortugues>
                        ) : (
                          tx(
                            "O bloco de reservatórios não foi construído nesta execução; nenhum número de reserva é exibido.",
                            "The reservoirs block was not built in this run; no fallback figure is shown.",
                          )
                        )
                      }
                    />
                    <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />
                  </>
                )}

                {r && (
                  <SecaoDoPainel
                    id="decomposicao"
                    nivel="analisar"
                    titulo={tx("Os quatro subsistemas: variação da EAR, soma dos reservatórios e contexto", "The four subsystems: change in EAR, sum of the reservoirs and context")}
                  >
                    <TabelaInterativa
                      titulo={tx("Decomposição da variação de 30 dias da EAR por subsistema", "Breakdown of the 30-day change in EAR by subsystem")}
                      colunas={colunasDecomposicaoSubsistemas()}
                      linhas={linhasDecomposicaoSubsistemas(r.decomposicao_ear)}
                      chaveLinha="id"
                      colunaRotulo="sm"
                      fonte={tx(
                        "ONS, EAR Diário por Reservatório e por Subsistema; ENA Diário por Subsistema; Balanço de Energia",
                        "ONS, daily EAR by reservoir and by subsystem; daily ENA by subsystem; energy balance",
                      )}
                      versao={r.decomposicao_ear[0]?.fim ?? r.fim}
                      nomeArquivo="agua-decomposicao-subsistemas"
                      nota={tx(
                        "ENA e geração hidráulica são médias da mesma janela, mostradas como contexto: estão em MWmed e não fecham balanço com a variação da EAR em MWmês.",
                        "ENA and hydro generation are averages over the same window, shown as context: they are in MWavg and do not balance against the change in EAR in MWmonth.",
                      )}
                    />
                    <p className="max-w-prose2 text-sm leading-relaxed text-carvao" data-texto="fechamento">
                      {textoFechamento(r)}
                    </p>
                  </SecaoDoPainel>
                )}

                {r && (
                  <SecaoDoPainel id="regras-p020" nivel="auditar" titulo={tx("Regras, cobertura, fontes e arquivos", "Rules, coverage, sources and files")}>
                    <AguaRegras regras={g.regras} chaves={["balanco_reservatorio", "decomposicao_ear", "capacidade"]} />
                    <p className="text-sm text-carvao-muted">{comNomes(textoSemCadastro(semCadastroNomes ?? []), nomesProprios(r.lista.map((x) => x.nome)))}</p>
                    <p className="text-sm text-carvao-muted">
                      <TrechoPortugues regiao="agua-criterio-lista">{r.criterio_lista}</TrechoPortugues>.
                    </p>
                    <AguaFontes provs={[prov.balanco, prov.capacidade]} />
                  </SecaoDoPainel>
                )}

                <AguaPontes
                  itens={[
                    {
                      slug: "geracao",
                      assunto: tx(
                        "Quanto cada fonte gerou, a hidrelétrica inclusive: outro painel, com outra fonte de dados.",
                        "How much each source generated, hydropower included: another panel, with another data source.",
                      ),
                    },
                    { slug: "pld", assunto: tx("O PLD por submercado: outro painel, com outra fonte de dados.", "The spot price (PLD) by submarket: another panel, with another data source.") },
                    {
                      slug: "conta-de-luz",
                      assunto: tx(
                        "Tarifas e componentes da conta de luz por distribuidora: outro painel, com outra fonte de dados.",
                        "Tariffs and components of the electricity bill by distribution utility: another panel, with another data source.",
                      ),
                    },
                  ]}
                />

                <AguaSeguir ancora="p020" proximo={{ href: `${rotaPainel("p017")}#p017`, pergunta: perguntaPainel("p017") }} downloads={downloads} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
