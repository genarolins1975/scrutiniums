import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { RegulacaoLinhaTempo } from "@/components/energia/RegulacaoLinhaTempo";
import { RegulacaoDatas, RegulacaoIndisponivel, RegulacaoNavegacao, RegulacaoRecorte } from "@/components/energia/RegulacaoPagina";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { SeguirPainel } from "@/components/energia/SeguirPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import {
  FILTRO_LINHA_TEMPO_PADRAO,
  ROTULO_NIVEL_EVENTO,
  contagemPaineisAfetados,
  contagemPorOrigem,
  defasagemDias,
  downloadsDoPainel,
  filtrarLinhaTempo,
  origemEvento,
  perguntaPainel,
  proximoPainel,
  respostaLinhaTempo,
  rotaPainel,
  rotuloCurtoEvento,
  rotuloDownload,
  vereditoLinhaTempo,
} from "@/lib/energia/regulacao";
import type { ColunaTabela } from "@/lib/energia/tabela";
import type { GoldRegulacao } from "@/lib/energia/tipos-regulacao";
import { tx } from "@/lib/energia/idioma";
import { comNomes } from "@/lib/energia/i18n/regulacao-dados-metodo";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/regulacao/linha-do-tempo", {
    title: tx("Regulação: linha do tempo das mudanças de regra no setor elétrico", "Regulation: timeline of rule changes in the power sector"),
    description: tx(
      "Atos, leis e mudanças das bandeiras tarifárias com a data de publicação separada do início de vigência, o dispositivo de origem, o efeito declarado pelo próprio ato e os painéis ligados, sem estimar impacto nem sugerir causa.",
      "Acts, laws and tariff flag changes with the publication date kept apart from the start of validity, the originating provision, the effect declared by the act itself and the linked panels, without estimating impact or suggesting cause.",
    ),
    alternates: { canonical: rotaPainel("p045") },
  }, anterior);
}

function colunasPublicacao(): ColunaTabela[] {
  return [
    { id: "ato", rotulo: tx("Ato", "Act"), tipo: "texto" },
    { id: "data_publicacao", rotulo: tx("Publicação na gold", "Publication in the gold file"), tipo: "data" },
    { id: "resultado", rotulo: tx("Conferência", "Check"), tipo: "texto", categorica: true },
    { id: "detalhe", rotulo: tx("Como foi conferida", "How it was checked"), tipo: "texto" },
    // i18n: dado
    { id: "fonte", rotulo: tx("Fonte da conferência", "Source of the check"), tipo: "texto" },
  ];
}

export default function LinhaDoTempoPage() {
  const g = lerGold<GoldRegulacao>("regulacao.json");
  if (!integra(g)) return <RegulacaoIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const T = g.linha_do_tempo;
  // a mesma ordem do recorte padrão do componente (vigência mais recente primeiro), para que
  // "o evento mais recente" da resposta e do "O que mudou" não dependa da ordem do arquivo
  const eventos = filtrarLinhaTempo(T.eventos, FILTRO_LINHA_TEMPO_PADRAO).eventos;
  const vigencias = eventos.map((e) => e.vigencia_inicio).sort();
  const { atos, registros } = contagemPorOrigem(eventos);
  const quem = contagemPaineisAfetados(eventos);
  const comDefasagem = eventos
    .filter((e) => origemEvento(e) === "ato")
    .map((e) => ({ id: e.id, rotulo: rotuloCurtoEvento(e), dias: defasagemDias(e) }))
    .filter((x) => x.dias !== null);
  const semPublicacao = eventos.filter((e) => origemEvento(e) === "ato" && !e.data_publicacao);
  const proximo = proximoPainel("p045");
  const versao = T.conferido_em;
  const fonte = tx(
    "ANEEL, Congresso Nacional, Presidência da República e MME (atos lidos no texto) e ANEEL, Bandeiras Tarifárias",
    "ANEEL, National Congress, Presidency of the Republic and MME (acts read in full text) and ANEEL, Bandeiras Tarifárias dataset",
  );

  const oQueMudou = tx(
    <>
      O evento mais recente é &ldquo;{eventos[0]?.titulo}&rdquo;, com vigência a partir de {dataBR(eventos[0]?.vigencia_inicio ?? null)}. A lista foi conferida em {dataBR(T.conferido_em)} e não
      inclui o que foi publicado depois disso. É uma seleção editorial de marcos que mudam a leitura dos painéis, não um repositório de todos os atos.
    </>,
    <>
      The most recent event is &ldquo;<TrechoPortugues regiao="regulacao-evento-titulo">{eventos[0]?.titulo}</TrechoPortugues>&rdquo;, in force from {dataBR(eventos[0]?.vigencia_inicio ?? null)}. The list
      was checked on {dataBR(T.conferido_em)} and does not include what was published after that. It is an editorial selection of milestones that change how the panels are read, not a
      repository of every act.
    </>,
  );
  const comoInterpretar = tx(
    <>
      O círculo vazado é a publicação no Diário Oficial; o cheio, o início de vigência; o traço entre eles é a espera até a regra valer. O resumo é texto do observatório, conferido no
      documento; o efeito declarado, que está em Analisar, é o que o ato diz de si mesmo, citado literalmente; o impacto estimado fica vazio. Os painéis ligados são aqueles em que a regra
      muda a leitura do número; a ligação vem da curadoria do ato, não de estimativa de efeito. Filtre por painel ligado ou por origem para separar atos lidos de registros do conjunto de
      dados; em Analisar, o período vale para a data que você escolher (publicação ou vigência), e eventos sem essa data ficam fora do recorte, com a contagem dita.
    </>,
    <>
      The hollow circle is publication in the Official Gazette; the filled one, the start of validity; the line between them is the wait until the rule applies. The summary is
      observatory text, checked against the document; the declared effect, under Analyze, is what the act says about itself, quoted literally; the estimated impact stays empty. The linked
      panels are those where the rule changes how the number is read; the link comes from the curation of the act, not from an effect estimate. Filter by linked panel or by origin to
      separate acts read from dataset records; under Analyze, the period applies to the date you choose (publication or validity), and events without that date are left out of the
      selection, with the count stated.
    </>,
  );
  const naoConcluir = tx(
    <>
      Uma data desta lista perto de um movimento num gráfico não é evidência de causa. O observatório não estima o efeito das normas aqui, nem quanto uma norma mudou a conta de alguém, e
      os resumos não são parecer jurídico. A ausência de um ato aqui não quer dizer que nada mudou: a lista não é completa. Eventos de bandeira vêm do conjunto de dados da ANEEL, sem
      leitura do ato nem data de publicação.
    </>,
    <>
      A date on this list close to a movement in a chart is not evidence of cause. The observatory does not estimate the effect of rules here, nor how much a rule changed anyone&apos;s bill,
      and the summaries are not legal advice. The absence of an act here does not mean nothing changed: the list is not complete. Tariff flag events come from the ANEEL dataset, without
      reading the act and without a publication date.
    </>,
  );

  return (
    <>
      <CabecalhoEnergia atual="regulacao" />
      <MarcaVisita secao="energia:regulacao" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <RegulacaoNavegacao atual="p045" />
        <CabecalhoModulo
          rotulo={tx("Regulação", "Regulation")}
          siglas={["PLD", "REN", "REH", "DOU", "CDE", "PRODIST", "ANEEL", "MME"]}
          titulo={perguntaPainel("p045")}
          lead={tx("Atos e leis que mudam a leitura dos painéis, com a publicação separada da vigência.", "Acts and laws that change how the panels are read, with publication kept apart from validity.")}
          recorte={tx(
            `${eventos.length} eventos · vigências de ${vigencias.length ? dataBR(vigencias[0]) : "sem eventos"} a ${vigencias.length ? dataBR(vigencias[vigencias.length - 1]) : "sem eventos"}`,
            `${eventos.length} events · in force from ${vigencias.length ? dataBR(vigencias[0]) : "no events"} to ${vigencias.length ? dataBR(vigencias[vigencias.length - 1]) : "no events"}`,
          )}
          fonte={tx(
            "ANEEL, Congresso Nacional, Presidência da República e Ministério de Minas e Energia (MME)",
            "ANEEL, National Congress, Presidency of the Republic and Ministry of Mines and Energy (MME)",
          )}
          referencia={tx(
            <>
              Atos lidos no texto e conferidos em {dataBR(T.conferido_em)}; bandeiras do conjunto de dados da ANEEL; processado em {carimbo(g.gerado_em)}.
            </>,
            <>
              Acts read in full text and checked on {dataBR(T.conferido_em)}; tariff flags from the ANEEL dataset; processed on {carimbo(g.gerado_em)}.
            </>,
          )}
          datas={
            <RegulacaoDatas
              itens={[
                { rotulo: tx("Atos e leis", "Acts and laws"), texto: tx(`lidos no texto e conferidos em ${dataBR(T.conferido_em)}`, `read in full text and checked on ${dataBR(T.conferido_em)}`), natureza: "OBSERVADO" },
                {
                  rotulo: tx("Registros de bandeiras", "Tariff flag records"),
                  texto: tx(`conjunto de dados da ANEEL gerado em ${dataBR(g.bandeiras.gerado_pela_fonte_em)}`, `ANEEL dataset generated on ${dataBR(g.bandeiras.gerado_pela_fonte_em)}`),
                  natureza: "OBSERVADO",
                },
              ]}
            />
          }
        >
          {tx(
            <>
              O que mudou nas regras que os painéis do observatório usam, desde quando vale e em quais painéis a leitura muda. Cada ato traz a data em que passou a valer, o resumo do observatório e
              os painéis ligados; a data de publicação no Diário Oficial, o dispositivo, o efeito que o próprio ato declara e as conferências estão em Analisar.
            </>,
            <>
              What changed in the rules the observatory&apos;s panels use, since when it applies and in which panels the reading changes. Each act carries the date it took effect, the
              observatory summary and the linked panels; the publication date in the Official Gazette, the provision, the effect the act itself declares and the checks are under Analyze.
            </>,
          )}
        </CabecalhoModulo>
        <ModoProfundidade>
          <Bloco id="linha-do-tempo">
            <PainelEvidencia
              id="p045"
              pergunta={tx("Publicação e início da vigência de cada evento", "Publication and start of validity of each event")}
              subtitulo={tx(
                "Atos, leis e registros de bandeiras com data de publicação e de vigência, resumo e painéis ligados · data",
                "Acts, laws and tariff flag records with publication and validity dates, summary and linked panels · date",
              )}
              natureza="OBSERVADO"
              porQueImporta={
                tx(
                  <>
                    Uma série muda de leitura quando a regra muda: a Tarifa Social, o cálculo das perdas, o PLD horário e as bandeiras alteram o que um número significa. Saber a data
                    exata em que a regra passou a valer evita atribuir à norma o que aconteceu antes dela, ou o contrário.
                  </>,
                  <>
                    A series reads differently when the rule changes: the Tarifa Social (social electricity tariff), the calculation of losses, the hourly PLD and the tariff flags change
                    what a number means. Knowing the exact date a rule took effect avoids attributing to the rule what happened before it, or the reverse.
                  </>,
                )
              }
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={g.proveniencia.linha_do_tempo}
              complementares={[{ rotulo: tx("Adicionais das bandeiras tarifárias", "Tariff flag surcharges"), p: g.proveniencia.bandeiras }]}
            >
              <div className="space-y-6">
                <RespostaCurta id="p045" veredito={vereditoLinhaTempo(eventos, eventos.length, "vigencia", T.conferido_em)}>
                  {comNomes(respostaLinhaTempo(eventos, eventos.length))}
                </RespostaCurta>

                <RegulacaoLinhaTempo
                  eventos={eventos}
                  paineis={T.paineis}
                  fonte={fonte}
                  versao={versao}
                  recorte={
                    <RegulacaoRecorte
                      periodo={
                        vigencias.length
                          ? tx(`vigências de ${dataBR(vigencias[0])} a ${dataBR(vigencias[vigencias.length - 1])}`, `in force from ${dataBR(vigencias[0])} to ${dataBR(vigencias[vigencias.length - 1])}`)
                          : tx("sem eventos", "no events")
                      }
                      universo={tx(
                        `${eventos.length} eventos: ${atos} atos e leis lidos no texto e ${registros} registros do conjunto de dados de bandeiras`,
                        `${eventos.length} events: ${atos} acts and laws read in full text and ${registros} records from the tariff flag dataset`,
                      )}
                      unidade={tx("evento datado (publicação e início de vigência)", "dated event (publication and start of validity)")}
                    />
                  }
                  notas={<NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />}
                />

                <SecaoDoPainel
                  id="defasagem"
                  titulo={tx("Quanto tempo passa entre a publicação e a vigência?", "How much time passes between publication and validity?")}
                  lead={
                    <>
                      {tx(
                        "Dias entre a publicação no Diário Oficial e o início de vigência de cada ato lido. Zero é vigência na data da publicação.",
                        "Days between publication in the Official Gazette and the start of validity of each act read. Zero is validity on the publication date.",
                      )}
                      {semPublicacao.length
                        ? comNomes(
                            tx(
                              ` ${semPublicacao.length === 1 ? "Fica de fora 1 ato" : `Ficam de fora ${semPublicacao.length} atos`} sem data de publicação conferida (${semPublicacao.map((e) => e.ato ?? e.titulo).join("; ")}).`,
                              ` ${semPublicacao.length === 1 ? "1 act is" : `${semPublicacao.length} acts are`} left out with no checked publication date (${semPublicacao.map((e) => e.ato ?? e.titulo).join("; ")}).`,
                            ),
                          )
                        : ""}
                    </>
                  }
                >
                  <GraficoBarras
                    titulo={tx("Dias entre publicação e vigência, por ato", "Days between publication and validity, by act")}
                    dados={comDefasagem}
                    chaveCategoria="id"
                    chaveRotulo="rotulo"
                    // i18n: dado
                    series={[{ id: "dias", rotulo: tx("Dias até a vigência", "Days until validity"), cor: "var(--cor-energia-dark)" }]}
                    unidade={tx("dias", "days")}
                    casas={0}
                    orientacao="horizontal"
                    rotulosValor
                  />
                </SecaoDoPainel>

                <SecaoDoPainel
                  id="quem-e-afetado"
                  titulo={tx("Em que painéis a leitura muda?", "In which panels does the reading change?")}
                  lead={tx(
                    "Um evento pode estar ligado a mais de um painel, por isso a soma das barras passa do número de eventos. Os painéis vêm da curadoria de cada ato, não de inferência sobre efeito.",
                    "An event can be linked to more than one panel, so the sum of the bars exceeds the number of events. The panels come from the curation of each act, not from an inference about effect.",
                  )}
                >
                  <GraficoBarras
                    titulo={tx("Eventos da linha do tempo por painel ligado", "Timeline events by linked panel")}
                    dados={quem.map((q) => ({ id: q.href, rotulo: q.rotulo, n: q.n }))}
                    chaveCategoria="id"
                    chaveRotulo="rotulo"
                    // i18n: dado
                    series={[{ id: "n", rotulo: tx("Eventos", "Events"), cor: "var(--cor-energia)" }]}
                    unidade={tx("eventos", "events")}
                    casas={0}
                    orientacao="horizontal"
                    rotulosValor
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="conferencia-publicacao" nivel="auditar" titulo={tx("Data de publicação conferida por caminho independente", "Publication date checked by an independent path")}>
                  <p className="max-w-prose2 text-sm text-carvao-muted">
                    {tx(
                      "Leis e medida provisória: data da publicação original nos metadados abertos do Senado. Atos da ANEEL: data escrita no próprio PDF guardado. Divergência reprova a publicação da gold.",
                      "Laws and provisional measure: original publication date in the Senate's open metadata. ANEEL acts: date written in the stored PDF itself. A mismatch fails the gold publication.",
                    )}
                  </p>
                  <TabelaInterativa
                    titulo={tx("Conferência da data de publicação dos atos lidos", "Check of the publication date of the acts read")}
                    colunas={colunasPublicacao()}
                    linhas={eventos
                      .filter((e) => origemEvento(e) === "ato")
                      .map((e) => ({
                        id: e.id,
                        ato: e.ato ?? e.titulo,
                        data_publicacao: e.data_publicacao,
                        resultado: e.conferencia_publicacao
                          ? e.conferencia_publicacao.resultado === "aprovado"
                            ? tx("aprovada", "passed")
                            : e.conferencia_publicacao.resultado
                          : tx("sem conferência", "no check"),
                        detalhe: e.conferencia_publicacao?.detalhe ?? (e.data_publicacao ? null : tx("sem data de publicação: nada a conferir", "no publication date: nothing to check")),
                        fonte: e.conferencia_publicacao?.fonte ?? null,
                      }))}
                    chaveLinha="id"
                    colunaRotulo="ato"
                    fonte={tx("Senado Federal (metadados abertos) e ANEEL (texto dos atos)", "Federal Senate (open metadata) and ANEEL (text of the acts)")}
                    versao={versao}
                    nomeArquivo="regulacao-conferencia-publicacao"
                    chaveUrl="pub"
                  />
                  <ul className="space-y-1 text-sm text-carvao-muted">
                    {Object.entries(
                      eventos.reduce<Record<string, number>>((acc, e) => {
                        const k = ROTULO_NIVEL_EVENTO[e.nivel_conferencia] ?? e.nivel_conferencia;
                        acc[k] = (acc[k] ?? 0) + 1;
                        return acc;
                      }, {}),
                    ).map(([k, n]) => (
                      <li key={k}>
                        {k.charAt(0).toUpperCase() + k.slice(1)}: {n} {n === 1 ? tx("evento", "event") : tx("eventos", "events")}
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm leading-relaxed text-carvao-muted">
                    <TrechoPortugues regiao="regulacao-linha-tempo-nota">{T.nota}</TrechoPortugues>
                  </p>
                </SecaoDoPainel>

                <SeguirPainel
                  ancora="p045"
                  proximo={{ href: `${proximo.rota}#${proximo.id}`, pergunta: proximo.pergunta }}
                  downloads={downloadsDoPainel(g, "p045").map((d) => ({ ...d, rotulo: rotuloDownload(d.rotulo) }))}
                />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
