import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import Link from "@/components/i18n/LinkIdioma";
import { Nome } from "@/components/i18n/Nome";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { EmpresasComparador, EmpresasIndiceDistribuidoras } from "@/components/energia/EmpresasDistribuidoras";
import {
  EmpresasComoLer,
  EmpresasDatas,
  EmpresasIndisponivel,
  EmpresasNavegacao,
  EmpresasRecorte,
  EmpresasSeguir,
} from "@/components/energia/EmpresasPagina";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import {
  COLUNAS_DISTRIBUIDORAS,
  ancoraPainel,
  dadosComparacao,
  dataTexto,
  downloadsDe,
  entidadesDistribuidoras,
  inteiro,
  linhasDistribuidoras,
  padraoComparacao,
  painel,
  pctTexto,
  referenciaPerdasNacional,
  respostaDistribuidoras,
  rotaEntidade,
  semNomesDeCampo,
  vereditoDistribuidoras,
} from "@/lib/energia/empresas";
import { carimbo } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import { DESTINOS_NAVEGACAO } from "@/lib/energia/navegacao";
import { comValorExibido, type Evidencia } from "@/lib/energia/evidencia";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { CAMPOS_SERIE, DEFINICAO_EMPRESAS_EN, SERIE_EVOLUCAO_EN, comCodigos, comNomes, traduzir, universoPerdas } from "@/lib/energia/i18n/empresas-leiloes";
import { SIGLAS, SIGLAS_IDIOMAS } from "@/lib/energia/siglas";
import type { EmpresasGold } from "@/lib/energia/tipos-empresas";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/empresas/distribuidoras", {
    title: tx("Como a distribuidora atende sua área? Índice e comparador", "How does the distribution utility serve its area? Index and comparison tool"),
    description: tx(
      "Índice das distribuidoras pelo CNPJ, com perdas (SAMP), continuidade (DEC e FEC diante do limite) e tarifa residencial B1 copiadas dos módulos de origem, comparador de até quatro e link para a ficha de cada uma.",
      "Index of distribution utilities by CNPJ, with losses (SAMP), continuity (DEC and FEC against the limit) and the B1 residential tariff copied from the source modules, a comparison tool for up to four and a link to each one's profile.",
    ),
    alternates: { canonical: "/setor-eletrico/empresas/distribuidoras" },
  }, anterior);
}

export default function PaginaP037() {
  const g = lerGold<EmpresasGold>("empresas.json");
  if (!integra(g)) return <EmpresasIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const d = g.distribuidoras;
  const prov = g.proveniencia;
  const golds = d.golds_origem;
  // referência nacional de perdas: a da gold de Perdas, só quando é do mesmo ano das perdas por distribuidora
  const evTaxaNacional = lerGold<{ evidencias?: { taxa_nacional?: Evidencia } }>("perdas.json")?.evidencias?.taxa_nacional ?? null;
  const anoPerdas = d.indice.find((x) => x.perdas?.ano)?.perdas?.ano ?? null;
  const anoQualidade = d.indice.find((x) => x.qualidade?.ano)?.qualidade?.ano ?? null;
  const refPerdas = referenciaPerdasNacional(evTaxaNacional, anoPerdas);
  // a taxa nacional aparece com duas casas, como a legenda do gráfico de perdas e as perdas de cada distribuidora
  const evTaxaNacional2 = evTaxaNacional ? comValorExibido(evTaxaNacional, pctTexto(evTaxaNacional.valor_calculo, 2)) : null;
  const perdasDestino = DESTINOS_NAVEGACAO.find((x) => x.slug === "perdas");
  const dataIndice = dataTexto(g.gerado_em.slice(0, 10));
  // data do arquivo de tarifas da base publicada de Conta de luz: a vigência de cada tarifa é decidida nessa data
  const dataTarifas = lerGold<{ data_referencia?: string }>("conta.json")?.data_referencia ?? null;
  const semDado = tx("sem dado", "no data");
  const anoPerdasTexto = anoPerdas ?? semDado;
  const anoQualidadeTexto = anoQualidade ?? semDado;
  const serie = (x: string) => traduzir(SERIE_EVOLUCAO_EN, x);

  const oQueMudou = tx(
    <>
      As bases publicadas de origem foram geradas em {carimbo(golds["perdas.json"].gerado_em)} (Perdas), {carimbo(golds["qualidade.json"].gerado_em)} (Qualidade) e {carimbo(golds["conta.json"].gerado_em)}{" "}
      (Conta de luz). A evolução de cada distribuidora (perdas em {inteiro(d.resumo.com_evolucao.perdas)}, continuidade em {inteiro(d.resumo.com_evolucao.qualidade)} e tarifa em{" "}
      {inteiro(d.resumo.com_evolucao.tarifa)}) está na ficha.
    </>,
    <>
      The source published databases were generated on {carimbo(golds["perdas.json"].gerado_em)} (Losses), {carimbo(golds["qualidade.json"].gerado_em)} (Quality of supply) and{" "}
      {carimbo(golds["conta.json"].gerado_em)} (Electricity bill). Each distribution utility&apos;s evolution (losses for {inteiro(d.resumo.com_evolucao.perdas)}, continuity for{" "}
      {inteiro(d.resumo.com_evolucao.qualidade)} and tariff for {inteiro(d.resumo.com_evolucao.tarifa)}) is in the profile.
    </>,
  );
  const comoInterpretar = <>{semNomesDeCampo(traduzir(DEFINICAO_EMPRESAS_EN, d.pares))}</>;
  const naoConcluir = tx(
    <>
      Não se conclui eficiência nem culpa: perdas, continuidade e tarifa dependem da área atendida (densidade, clima, renda, rede herdada). Anos de referência diferentes não se comparam. A tarifa B1
      residencial não é a conta inteira (tributos e bandeiras ficam fora). O ramo declarado no cadastro de agentes não define distribuidora.
    </>,
    <>
      Neither efficiency nor fault can be concluded: losses, continuity and tariff depend on the area served (density, climate, income, inherited grid). Different reference years are not compared. The
      B1 residential tariff is not the whole bill (taxes and tariff flags are left out). The line of business declared in the agent registry does not define a distribution utility.
    </>,
  );

  return (
    <>
      <CabecalhoEnergia atual="empresas" />
      <MarcaVisita secao="energia:empresas-distribuidoras" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <EmpresasNavegacao atual="p037" />
        <CabecalhoModulo
          rotulo={tx("Empresas", "Companies")}
          siglas={["SAMP", "DEC", "FEC", "TE", "TUSD", "ANEEL"]}
          titulo={painel("p037").pergunta}
          lead={tx(
            `Perdas, continuidade e tarifa residencial de cada distribuidora, pelo CNPJ (${SIGLAS.CNPJ}) das bases reguladas da ANEEL (${SIGLAS.ANEEL}).`,
            `Losses, continuity and residential tariff of each distribution utility, by the CNPJ (${SIGLAS_IDIOMAS.en.CNPJ}) in the regulated databases of ANEEL (${SIGLAS_IDIOMAS.en.ANEEL}).`,
          )}
          recorte={tx(
            `Perdas de ${anoPerdasTexto} · continuidade de ${anoQualidadeTexto} · tarifa vigente na data do arquivo de tarifas · % da energia injetada, horas, interrupções e R$/MWh`,
            `Losses for ${anoPerdasTexto} · continuity for ${anoQualidadeTexto} · tariff in force on the date of the tariff file · % of injected energy, hours, interruptions and R$/MWh`,
          )}
          fonte={tx("ANEEL, bases de perdas, continuidade e tarifas, copiadas dos módulos de origem", "ANEEL, loss, continuity and tariff databases, copied from the source modules")}
          referencia={tx(
            <>
              Perdas de {anoPerdasTexto} e continuidade de {anoQualidadeTexto}, copiadas da base publicada de Perdas, gerada em {carimbo(golds["perdas.json"].gerado_em)}, e da de Qualidade,
              gerada em {carimbo(golds["qualidade.json"].gerado_em)}; tarifas da base publicada de Conta de luz, gerada em {carimbo(golds["conta.json"].gerado_em)}. Processado em{" "}
              {carimbo(g.gerado_em)}.
            </>,
            <>
              Losses for {anoPerdasTexto} and continuity for {anoQualidadeTexto}, copied from the Losses published database, generated on {carimbo(golds["perdas.json"].gerado_em)}, and from the
              Quality of supply one, generated on {carimbo(golds["qualidade.json"].gerado_em)}; tariffs from the Electricity bill published database, generated on{" "}
              {carimbo(golds["conta.json"].gerado_em)}. Processed on {carimbo(g.gerado_em)}.
            </>,
          )}
          datas={
            <EmpresasDatas
              itens={[
                { rotulo: tx("Índice pelo CNPJ", "Index by CNPJ"), texto: tx(`de ${dataIndice}`, `as of ${dataIndice}`), natureza: prov.distribuidoras.natureza },
                {
                  rotulo: tx("Perdas", "Losses"),
                  texto: tx(`${anoPerdasTexto}, base publicada de Perdas`, `${anoPerdasTexto}, Losses published database`),
                  natureza: prov.distribuidoras_perdas?.natureza ?? "CALCULADO",
                },
                {
                  rotulo: tx("Continuidade", "Continuity"),
                  texto: tx(`${anoQualidadeTexto}, base publicada de Qualidade`, `${anoQualidadeTexto}, Quality of supply published database`),
                  natureza: prov.distribuidoras_qualidade?.natureza ?? "OBSERVADO",
                },
                {
                  rotulo: tx("Tarifa B1", "B1 tariff"),
                  texto: tx(
                    `vigente na data do arquivo de tarifas${dataTarifas ? ` (${dataTexto(dataTarifas)})` : ""}, base publicada de Conta de luz`,
                    `in force on the date of the tariff file${dataTarifas ? ` (${dataTexto(dataTarifas)})` : ""}, Electricity bill published database`,
                  ),
                  natureza: prov.distribuidoras_tarifa?.natureza ?? "OBSERVADO",
                },
              ]}
            />
          }
          metricas={
            <FaixaMetricas
              colunas={4}
              rotulo={tx("Indicadores das distribuidoras", "Distribution utility indicators")}
              nota={tx(
                "Contagens do índice inteiro e referência nacional, fixas: não mudam com a comparação escolhida.",
                "Counts of the whole index and national reference, fixed: they do not change with the chosen comparison.",
              )}
            >
              <Numero
                variante="faixa"
                rotulo={tx("Distribuidoras pelo CNPJ", "Distribution utilities by CNPJ")}
                natureza={prov.distribuidoras.natureza}
                valor={d.resumo.distribuidoras}
                formato="num"
                casas={0}
                unidade={tx("distribuidoras", "distribution utilities")}
                periodo={tx(`índice de ${dataIndice}`, `index as of ${dataIndice}`)}
                nota={tx(
                  `${inteiro(d.resumo.ativas)} ativas; ${inteiro(d.resumo.concessionarias)} concessionárias e ${inteiro(d.resumo.permissionarias)} permissionárias.`,
                  `${inteiro(d.resumo.ativas)} active; ${inteiro(d.resumo.concessionarias)} concession holders and ${inteiro(d.resumo.permissionarias)} permit holders.`,
                )}
              />
              {evTaxaNacional2 && refPerdas ? (
                <Numero
                  variante="faixa"
                  rotulo={tx("Referência: perdas, Brasil", "Reference: losses, Brazil")}
                  natureza={prov.distribuidoras_perdas?.natureza ?? "CALCULADO"}
                  evidencia={evTaxaNacional2}
                  formato="pct"
                  casas={2}
                  unidade={tx("da energia injetada", "of injected energy")}
                  nota={tx("Concessionárias em conjunto: somas, não média das taxas.", "Concession holders taken together: sums, not the average of the rates.")}
                  endereco={ancoraPainel("p037")}
                />
              ) : (
                <Numero
                  variante="faixa"
                  rotulo={tx("Referência: perdas totais na distribuição, Brasil", "Reference: total distribution losses, Brazil")}
                  natureza="CALCULADO"
                  valor={null}
                  motivoAusencia={tx(
                    "A base publicada de Perdas não publica a taxa nacional do mesmo ano das perdas por distribuidora.",
                    "The Losses published database does not publish the national rate for the same year as the losses by distribution utility.",
                  )}
                />
              )}
              <Numero
                variante="faixa"
                rotulo={tx("Com continuidade publicada", "With published continuity")}
                natureza={prov.distribuidoras_qualidade?.natureza ?? "OBSERVADO"}
                valor={d.resumo.com_qualidade}
                formato="num"
                casas={0}
                unidade={tx("distribuidoras", "distribution utilities")}
                periodo={tx(`DEC e FEC de ${anoQualidadeTexto}`, `DEC and FEC for ${anoQualidadeTexto}`)}
                nota={tx("Cada uma com o limite que a ANEEL fixa para ela.", "Each one with the limit ANEEL sets for it.")}
              />
              <Numero
                variante="faixa"
                rotulo={tx("Com tarifa residencial vigente", "With a residential tariff in force")}
                natureza={prov.distribuidoras_tarifa?.natureza ?? "OBSERVADO"}
                valor={d.resumo.com_tarifa_vigente}
                formato="num"
                casas={0}
                unidade={tx("distribuidoras", "distribution utilities")}
                periodo={tx(
                  `tarifa B1 no arquivo de tarifas de ${dataTarifas ? dataTexto(dataTarifas) : "data sem registro"}`,
                  `B1 tariff in the tariff file of ${dataTarifas ? dataTexto(dataTarifas) : "unrecorded date"}`,
                )}
              />
            </FaixaMetricas>
          }
        >
          {tx(
            <>
              O índice de todas as distribuidoras, identificadas pelo CNPJ que as próprias bases reguladas publicam, com as perdas, a continuidade do serviço e a tarifa residencial de cada uma, um comparador de
              até quatro e a ficha completa de cada distribuidora, com a evolução própria e os pares. Os números são cópia das páginas de Perdas, Qualidade e Conta de luz, sem recálculo.
            </>,
            <>
              The index of all distribution utilities, identified by the CNPJ that the regulated databases themselves publish, with each one&apos;s losses, service continuity and residential tariff, a
              comparison tool for up to four and the full profile of each distribution utility, with its own evolution and its peers. The numbers are copied from the Losses, Quality of supply and
              Electricity bill pages, without recalculation.
            </>,
          )}
        </CabecalhoModulo>

        <ModoProfundidade>
          <Bloco id="distribuidoras">
            <PainelEvidencia
              id="p037"
              pergunta={tx("Como se comparam as distribuidoras escolhidas?", "How do the chosen distribution utilities compare?")}
              subtitulo={tx(
                "Distribuidoras pelo CNPJ: perdas, continuidade, tarifa residencial e controle · %, horas, interrupções, R$/MWh",
                "Distribution utilities by CNPJ: losses, continuity, residential tariff and control · %, hours, interruptions, R$/MWh",
              )}
              porQueImporta={tx(
                <>
                  A distribuidora é a empresa com que o consumidor lida: quem leva a energia, quanto se perde no caminho (<Termo slug="perdas-de-energia">perdas</Termo>), quanto tempo e quantas vezes falta
                  luz (<Termo slug="dec">DEC</Termo> e <Termo slug="fec">FEC</Termo>) e quanto custa a <Termo slug="tarifa-te-tusd">tarifa</Termo>. A ficha junta esses números, que estão em bases
                  diferentes da ANEEL, pela mesma identidade.
                </>,
                <>
                  The distribution utility is the company consumers deal with: who delivers the energy, how much is lost along the way (<Termo slug="perdas-de-energia">losses</Termo>), how long and how
                  often the power goes out (<Termo slug="dec">DEC</Termo> and <Termo slug="fec">FEC</Termo>) and how much the <Termo slug="tarifa-te-tusd">tariff</Termo> costs. The profile brings these
                  numbers, which are in different ANEEL databases, together under the same identity.
                </>,
              )}
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={prov.distribuidoras}
              complementares={[
                ...(prov.distribuidoras_perdas ? [{ rotulo: tx("Perdas totais (base publicada de Perdas)", "Total losses (Losses published database)"), p: prov.distribuidoras_perdas }] : []),
                ...(prov.distribuidoras_pnt ? [{ rotulo: tx("Perdas não técnicas (estimadas pela fonte)", "Non-technical losses (estimated by the source)"), p: prov.distribuidoras_pnt }] : []),
                ...(prov.distribuidoras_qualidade
                  ? [{ rotulo: tx("DEC e FEC (base publicada de Qualidade)", "DEC and FEC (Quality of supply published database)"), p: prov.distribuidoras_qualidade }]
                  : []),
                ...(prov.distribuidoras_tarifa ? [{ rotulo: tx("Tarifa B1 (base publicada de Conta de luz)", "B1 tariff (Electricity bill published database)"), p: prov.distribuidoras_tarifa }] : []),
              ]}
            >
              <div className="space-y-6">
                <EmpresasComparador
                  entidades={entidadesDistribuidoras(d.indice)}
                  padrao={padraoComparacao(d.indice)}
                  comparacao={dadosComparacao(
                    d.indice,
                    d.indice.map((x) => x.slug),
                  )}
                  referenciaPerdas={refPerdas}
                />
                {/* a faixa já traz os números; a resposta vem depois das figuras, para o comparador começar na primeira tela */}
                <RespostaCurta id="p037" veredito={vereditoDistribuidoras(d, refPerdas?.valor ?? null, anoPerdas)} depois>
                  {respostaDistribuidoras(d)}
                </RespostaCurta>
                <EmpresasComoLer />
                <EmpresasRecorte
                  periodo={tx(
                    <>
                      Perdas de {anoPerdasTexto} e continuidade de {anoQualidadeTexto} (ano de referência de cada módulo); tarifas vigentes na data do arquivo de tarifas da ANEEL
                    </>,
                    <>
                      Losses for {anoPerdasTexto} and continuity for {anoQualidadeTexto} (reference year of each module); tariffs in force on the date of ANEEL&apos;s tariff file
                    </>,
                  )}
                  universo={tx(
                    <>
                      {inteiro(d.resumo.distribuidoras)} distribuidoras com CNPJ no SAMP ({SIGLAS.SAMP}), nos indicadores de continuidade ou nas tarifas ({inteiro(d.resumo.ativas)} ativas)
                      {evTaxaNacional2 && refPerdas ? `; referência nacional de perdas: ${evTaxaNacional2.universo}` : ""}
                    </>,
                    <>
                      {inteiro(d.resumo.distribuidoras)} distribution utilities with CNPJ in SAMP ({SIGLAS_IDIOMAS.en.SAMP}), in the continuity indicators or in the tariffs ({inteiro(d.resumo.ativas)}{" "}
                      active)
                      {evTaxaNacional2 && refPerdas ? `; national loss reference: ${universoPerdas(evTaxaNacional2.universo)}` : ""}
                    </>,
                  )}
                  unidade={tx(
                    "% da energia injetada; horas e interrupções por unidade consumidora; R$/MWh sem tributos",
                    "% of injected energy; hours and interruptions per consumer unit; R$/MWh before taxes",
                  )}
                />
                <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />

                <SecaoDoPainel
                  id="indice"
                  titulo={tx("Qual é a distribuidora, e onde está a ficha dela?", "Which distribution utility is it, and where is its profile?")}
                  lead={tx(
                    `As ${inteiro(d.resumo.distribuidoras)} distribuidoras pelo CNPJ, com os números de referência de cada módulo de origem. Escolha uma linha para ver o resumo e abrir a ficha.`,
                    `The ${inteiro(d.resumo.distribuidoras)} distribution utilities by CNPJ, with the reference numbers of each source module. Choose a row to see the summary and open the profile.`,
                  )}
                >
                  <EmpresasIndiceDistribuidoras
                    entidades={entidadesDistribuidoras(d.indice)}
                    padrao={padraoComparacao(d.indice)}
                    linhas={linhasDistribuidoras(d.indice)}
                    fonte={tx(
                      "ANEEL, SAMP, indicadores de continuidade e tarifas de aplicação (pelas bases publicadas dos módulos de origem)",
                      "ANEEL, SAMP, continuity indicators and applied tariffs (through the published databases of the source modules)",
                    )}
                    versao={g.gerado_em.slice(0, 10)}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="fichas" titulo={tx("Todas as fichas e de onde vem a evolução de cada uma", "All profiles and where each one's evolution comes from")} nivel="analisar">
                  <nav aria-label={tx("Fichas das distribuidoras", "Distribution utility profiles")}>
                    <ul className="grid grid-cols-2 gap-x-4 text-sm sm:grid-cols-3 lg:grid-cols-5">
                      {d.indice
                        .slice()
                        .sort((x, y) => x.sigla.localeCompare(y.sigla, "pt-BR"))
                        .map((x) => (
                          <li key={x.slug}>
                            <Link href={rotaEntidade(x.slug)} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
                              <Nome>{x.sigla}</Nome>
                              {x.ativa ? "" : tx(" (inativa)", " (inactive)")}
                            </Link>
                          </li>
                        ))}
                    </ul>
                  </nav>
                  <ul className="space-y-1 text-sm text-carvao-muted">
                    {(["perdas", "qualidade", "tarifa"] as const).map((m) => {
                      const s = d.series_evolucao[m];
                      return (
                        <li key={m}>
                          <span className="font-medium text-carvao">{{ perdas: tx("Perdas", "Losses"), qualidade: tx("Continuidade", "Continuity"), tarifa: tx("Tarifa B1", "B1 tariff") }[m]}:</span>{" "}
                          {s ? (
                            <>
                              <a href={s.url} className="underline underline-offset-4 hover:text-carvao">
                                {s.url.split("/").pop()}
                              </a>{" "}
                              ({comCodigos(serie(s.chave), idiomaEnergia(), CAMPOS_SERIE)}; {tx("unidade", "unit")} {typeof s.unidade === "string" ? serie(s.unidade) : Object.values(s.unidade).map(serie).join(", ")})
                            </>
                          ) : (
                            tx("a base publicada de origem não publica a série nesta publicação", "the source published database does not publish the series in this release")
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </SecaoDoPainel>

                <SecaoDoPainel id="regra-universo" titulo={tx("Regra do universo e identidade", "Universe rule and identity")} nivel="auditar">
                  <p className="text-sm text-carvao-muted">{comNomes(traduzir(DEFINICAO_EMPRESAS_EN, d.regra_universo))}</p>
                  <p className="text-sm text-carvao-muted">
                    {tx(
                      <>
                        {inteiro(d.resumo.conflitos_classificacao)} conflitos de classificação entre SAMP e continuidade; {inteiro(d.resumo.sem_uf)} distribuidoras sem conjunto elétrico vigente ficam sem UF (a
                        área oficial vem da relação conjunto × município publicada pelo módulo Perdas, sem replicar taxas por município). Os números são cópia da base publicada de origem pelo CNPJ, sem
                        recálculo, com a natureza e a unidade de origem (selos acima).
                      </>,
                      <>
                        {inteiro(d.resumo.conflitos_classificacao)} classification conflicts between SAMP and continuity; {inteiro(d.resumo.sem_uf)} distribution utilities without a current electrical
                        set have no state (the official area comes from the set × municipality relation published by the Losses module, without replicating rates by municipality). The numbers are copied
                        from the source published database by CNPJ, without recalculation, with the source&apos;s nature and unit (badges above).
                      </>,
                    )}
                  </p>
                  <p className="text-sm text-carvao-muted">
                    {tx("Colunas do índice, como na exportação:", "Index columns, as in the export:")} {COLUNAS_DISTRIBUIDORAS.map((x) => x.rotulo).join("; ")}.
                  </p>
                </SecaoDoPainel>

                <EmpresasSeguir
                  ancora="p037"
                  proximo={{ href: perdasDestino?.href ?? "/setor-eletrico/perdas", pergunta: perdasDestino?.pergunta ?? tx("Onde a energia se perde?", "Where is energy lost?") }}
                  downloads={downloadsDe(g.downloads, ["/energia/series/empresas_distribuidoras.csv"])}
                />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
