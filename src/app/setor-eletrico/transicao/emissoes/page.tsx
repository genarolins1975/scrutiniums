import type { Metadata, ResolvingMetadata } from "next";
import type { ReactNode } from "react";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { TransicaoCompararAnos, TransicaoFatorMensal } from "@/components/energia/TransicaoEmissoes";
import {
  TransicaoAnalise,
  TransicaoAuditoria,
  TransicaoAviso,
  TransicaoDatas,
  TransicaoDocumento,
  TransicaoIndisponivel,
  TransicaoNavegacao,
  NotaGold,
  TransicaoRecorte,
  TransicaoSeguir,
  TransicaoTabela,
} from "@/components/energia/TransicaoPagina";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { carimbo } from "@/lib/energia/formato";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { NOTA_TRANSICAO_EN, SERIE_MCTI_EN, rotuloDado } from "@/lib/energia/i18n/expansao-transicao-territorio";
import { integra, lerGold } from "@/lib/energia/gold";
import {
  FONTE_MCTI,
  colunasFatorAnual,
  colunasFatorMensal,
  fonteTransicao,
  ligacaoGeracao,
  semDado,
  anosDoFatorMensal,
  dadosFatorAnual,
  dadosFatorMensal,
  dadosMargemOperacao,
  dadosMdlAnual,
  data,
  estadoAcessoMcti,
  fator,
  fatorAnualDoAnoAnterior,
  fatorDoMesmoMesDoAnoAnterior,
  inteiro,
  kgPorMwh,
  linhasFatorAnual,
  linhasFatorMensal,
  mes,
  mudancaEmissoes,
  numTexto,
  pctTexto,
  periodoFatorAnual,
  perguntaPainel,
  referenciaAnual,
  respostaEmissoes,
  rotaPainel,
  vereditoEmissoes,
} from "@/lib/energia/transicao";
import type { GoldTransicao } from "@/lib/energia/tipos-transicao";
import { datasLegiveis } from "@/lib/energia/visao";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/transicao/emissoes", {
    title: tx("Emissões: como varia a intensidade de CO2 da geração no SIN", "Emissions: how the CO2 intensity of generation in the SIN varies"),
    description: tx(
      "Fator médio de emissão de CO2 do SIN publicado pelo MCTI, mensal e anual, com a quebra de base declarada pela fonte, comparação de anos mês a mês, os fatores do MDL em séries separadas e as revisões e divergências registradas na leitura das planilhas.",
      "Average CO2 emission factor of the SIN published by the MCTI, monthly and annual, with the database break declared by the source, a month-by-month comparison of years, the CDM factors in separate series and the revisions and divergences recorded when reading the spreadsheets.",
    ),
    alternates: { canonical: "/setor-eletrico/transicao/emissoes" },
  }, anterior);
}

/**
 * P064, emissões: o fator médio oficial do MCTI (inventários), mensal e anual, sem
 * cálculo da plataforma; os fatores do MDL em séries separadas e rotuladas; a
 * quebra de jan/2025 declarada pela fonte; e, no modo Auditar, revisões,
 * divergências e descartes da leitura das planilhas. Nenhuma intensidade horária ou
 * municipal: a fonte não publica, e nada é derivado do fator nacional mensal.
 */
export default function EmissoesPage() {
  const g = lerGold<GoldTransicao>("transicao.json");
  if (!integra(g)) return <TransicaoIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;
  const e = g.emissoes;
  const downloads = (urls: string[]) => g.downloads.filter((d) => urls.includes(d.url));

  if (!e) {
    return (
      <>
        <CabecalhoEnergia atual="transicao" />
        <main id="conteudo" tabIndex={-1} className="ed-pagina">
          <TransicaoNavegacao atual="p064" />
          <CabecalhoModulo siglas={["MCTI"]} rotulo={tx("Transição e ambiente", "Transition and environment")} titulo={perguntaPainel("p064")} />
          <div className="py-6">
            <Indisponivel
              titulo={tx("Fatores de emissão do MCTI ausentes nesta publicação", "MCTI emission factors missing in this release")}
              motivo={tx(
                `O bloco de emissões não foi montado nesta execução (${g.pendencias.join(" ") || "sem motivo registrado"}). Nenhum fator é estimado no lugar do oficial; a última publicação válida é mantida pela sentinela quando existe.`,
                `The emissions block was not assembled in this run (${g.pendencias.join(" ") || "no reason recorded"}). No factor is estimated in place of the official one; the last valid release is kept by the sentinel when there is one.`,
              )}
            />
          </div>
        </main>
      </>
    );
  }

  const acesso = estadoAcessoMcti(e.acesso);
  const quebra = e.quebras[0] ?? null;
  const anual = linhasFatorAnual(e);
  const anos = anosDoFatorMensal(e);
  const padraoAnos = anos.slice(-3);
  const primeiroMes = e.medio_mensal[0]?.m ?? null;
  const periodoAnual = periodoFatorAnual(e);
  const docFatorMedio = e.documentos.find((d) => /Fator médio/i.test(d.titulo)) ?? null;
  const docMargem = e.documentos.find((d) => /Margem de operação/i.test(d.titulo)) ?? null;
  const anoAnterior = fatorAnualDoAnoAnterior(e);
  const mesAnterior = fatorDoMesmoMesDoAnoAnterior(e);
  const oQueMudou = mudancaEmissoes(e);
  const idioma = idiomaEnergia();
  const sd = semDado();
  const notaGold = (texto: string, regiao: string, tabela?: Readonly<Record<string, string>>): ReactNode => <NotaGold texto={texto} regiao={regiao} tabela={tabela} />;
  const comoInterpretar = tx(
    <>
      Fator médio = emissões de CO2 da geração despachada no SIN ÷ energia gerada no SIN, calculado e publicado pelo MCTI; a plataforma não recalcula nada. O anual é
      publicado pela fonte e fica perto da média dos meses (controle na coluna &ldquo;Anual × meses&rdquo; da tabela anual). {g.regras.fator_medio_nao_marginal}
    </>,
    <>
      Average factor = CO2 emissions of the generation dispatched in the SIN ÷ energy generated in the SIN, calculated and published by the MCTI; the platform recalculates nothing. The
      annual factor is published by the source and stays close to the average of the months (check in the &ldquo;Annual × months&rdquo; column of the annual table).{" "}
      {notaGold(g.regras.fator_medio_nao_marginal, "transicao-regra")}
    </>,
  );
  const naoConcluir = tx(
    <>
      O efeito de consumir ou economizar um MWh a mais (o fator médio não é marginal); emissões em CO2 equivalente ou de ciclo de vida (só CO2 da operação); intensidade
      por hora, por município ou por distribuidora. {g.regras.sem_intensidade_local}
      {quebra ? ` Comparações que atravessam ${mes(quebra.data)} misturam bases de usinas diferentes.` : ""}
    </>,
    <>
      The effect of consuming or saving one more MWh (the average factor is not marginal); emissions in CO2 equivalent or over the life cycle (only operational CO2); intensity
      by hour, by municipality or by distribution utility. {notaGold(g.regras.sem_intensidade_local, "transicao-regra")}
      {quebra ? ` Comparisons that cross ${mes(quebra.data)} mix different plant databases.` : ""}
    </>,
  );

  return (
    <>
      <CabecalhoEnergia atual="transicao" />
      <MarcaVisita secao="energia:transicao-emissoes" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <TransicaoNavegacao atual="p064" />
        <CabecalhoModulo
          siglas={["MCTI", "SIN", "MDL"]}
          rotulo={tx("Transição e ambiente", "Transition and environment")}
          titulo={perguntaPainel("p064")}
          lead={tx(
            "Quantas toneladas de CO2 a geração do SIN emite, em média, por MWh, ano a ano e mês a mês, como o MCTI publica. É CO2 da operação das usinas, não CO2 equivalente.",
            "How many tonnes of CO2 SIN generation emits, on average, per MWh, year by year and month by month, as the MCTI publishes. It is CO2 from the plants' operation, not CO2 equivalent.",
          )}
          recorte={tx(
            `Anual de ${periodoAnual?.inicio ?? "sem dado"} a ${periodoAnual?.fim ?? "sem dado"} · mensal de ${mes(primeiroMes)} a ${mes(e.ultimo_mes?.m)} · tCO2/MWh`,
            `Annual from ${periodoAnual?.inicio ?? sd} to ${periodoAnual?.fim ?? sd} · monthly from ${mes(primeiroMes)} to ${mes(e.ultimo_mes?.m)} · tCO2/MWh`,
          )}
          fonte={tx("MCTI, fatores de emissão de CO2 da geração no SIN", "MCTI, CO2 emission factors of generation in the SIN")}
          referencia={tx(
            <>
              Fator médio do MCTI de {mes(primeiroMes)} a {mes(e.ultimo_mes?.m)} (mensal) e de {e.medio_anual[0]?.ano ?? "sem dado"} a {e.ultimo_ano?.ano ?? "sem dado"} (anual)
              <span data-nivel="auditar">, planilha {e.ultimo_mes?.arquivo ?? "sem dado"}</span>; listagem da página do MCTI capturada em {carimbo(e.pagina_vigente?.listagem_capturada_em)}. Processado em{" "}
              {carimbo(g.gerado_em)}.
            </>,
            <>
              MCTI average factor from {mes(primeiroMes)} to {mes(e.ultimo_mes?.m)} (monthly) and from {e.medio_anual[0]?.ano ?? sd} to {e.ultimo_ano?.ano ?? sd} (annual)
              <span data-nivel="auditar">, spreadsheet {e.ultimo_mes?.arquivo ?? sd}</span>; MCTI page listing captured on {carimbo(e.pagina_vigente?.listagem_capturada_em)}. Processed on{" "}
              {carimbo(g.gerado_em)}.
            </>,
          )}
          datas={
            <TransicaoDatas
              itens={[
                {
                  rotulo: tx("Fator médio mensal", "Monthly average factor"),
                  texto: tx(`${mes(primeiroMes)} a ${mes(e.ultimo_mes?.m)}`, `${mes(primeiroMes)} to ${mes(e.ultimo_mes?.m)}`),
                  natureza: "ESTIMADO",
                },
                {
                  rotulo: tx("Fator médio anual", "Annual average factor"),
                  texto: tx(`${periodoAnual?.inicio ?? "sem dado"} a ${periodoAnual?.fim ?? "sem dado"}`, `${periodoAnual?.inicio ?? sd} to ${periodoAnual?.fim ?? sd}`),
                  natureza: "ESTIMADO",
                },
                {
                  rotulo: tx("Página do MCTI", "MCTI page"),
                  texto: tx(`listagem capturada em ${carimbo(e.pagina_vigente?.listagem_capturada_em)}`, `listing captured on ${carimbo(e.pagina_vigente?.listagem_capturada_em)}`),
                  natureza: "OBSERVADO",
                },
              ]}
            />
          }
          metricas={
            <FaixaMetricas
              colunas={4}
              rotulo={tx("Indicadores do fator de emissão", "Emission factor indicators")}
              nota={tx(
                "tCO2/MWh é a tonelada de CO2 por MWh gerado no SIN: só CO2 da operação, não CO2 equivalente nem de ciclo de vida.",
                "tCO2/MWh is the tonne of CO2 per MWh generated in the SIN: only operational CO2, neither CO2 equivalent nor life-cycle.",
              )}
            >
              <Numero
                variante="faixa"
                rotulo={tx(`Fator médio anual de ${e.ultimo_ano?.ano ?? "sem dado"}`, `Annual average factor for ${e.ultimo_ano?.ano ?? sd}`)}
                natureza="ESTIMADO"
                evidencia={e.evidencia}
                casas={4}
                unidade="tCO2/MWh"
                periodo={tx("ano completo", "full year")}
                cor="var(--serie-termica)"
                nota={tx(`Em kg: ${kgPorMwh(e.ultimo_ano?.valor)}.`, `In kg: ${kgPorMwh(e.ultimo_ano?.valor)}.`)}
                motivoAusencia={tx("Nenhum ano completo publicado nesta versão.", "No full year published in this version.")}
                endereco={`${rotaPainel("p064")}#p064`}
              />
              {anoAnterior && (
                <Numero
                  variante="faixa"
                  rotulo={tx(`Fator médio anual de ${anoAnterior.ano}`, `Annual average factor for ${anoAnterior.ano}`)}
                  natureza="ESTIMADO"
                  valor={anoAnterior.valor}
                  casas={4}
                  unidade="tCO2/MWh"
                  periodo={tx("ano completo", "full year")}
                  cor="var(--serie-referencia)"
                  nota={
                    anoAnterior.mesmaBase
                      ? tx("Mesma base de usinas do último ano.", "Same plant database as the last year.")
                      : tx(
                          `Base anterior a ${mes(quebra?.data)}: comparar com ${e.ultimo_ano?.ano} mistura bases.`,
                          `Database prior to ${mes(quebra?.data)}: comparing with ${e.ultimo_ano?.ano} mixes databases.`,
                        )
                  }
                />
              )}
              <Numero
                variante="faixa"
                rotulo={tx(`Fator médio do último mês (${mes(e.ultimo_mes?.m)})`, `Average factor of the last month (${mes(e.ultimo_mes?.m)})`)}
                natureza="ESTIMADO"
                evidencia={e.evidencia_mensal}
                casas={4}
                unidade="tCO2/MWh"
                cor="var(--serie-termica)"
                nota={tx(
                  `Mês isolado, não o fator anual. Em kg: ${kgPorMwh(e.ultimo_mes?.valor)}.`,
                  `A single month, not the annual factor. In kg: ${kgPorMwh(e.ultimo_mes?.valor)}.`,
                )}
                motivoAusencia={tx("Nenhum mês publicado nesta versão.", "No month published in this version.")}
                endereco={`${rotaPainel("p064")}#p064`}
              />
              {mesAnterior && (
                <Numero
                  variante="faixa"
                  rotulo={tx(`Fator médio de ${mes(mesAnterior.m)}`, `Average factor for ${mes(mesAnterior.m)}`)}
                  natureza="ESTIMADO"
                  valor={mesAnterior.valor}
                  casas={4}
                  unidade="tCO2/MWh"
                  periodo={tx("mesmo mês do ano anterior", "same month of the previous year")}
                  cor="var(--serie-referencia)"
                  nota={
                    mesAnterior.mesmaBase
                      ? tx("Mesma sazonalidade e base de usinas.", "Same seasonality and plant database.")
                      : tx(
                          `Base anterior a ${mes(quebra?.data)}: comparar com o último mês mistura bases.`,
                          `Database prior to ${mes(quebra?.data)}: comparing with the last month mixes databases.`,
                        )
                  }
                />
              )}
            </FaixaMetricas>
          }
        >
          {tx(
            <>
              O <Termo slug="fator-de-emissao">fator médio de emissão</Termo> serve para contabilizar as emissões da eletricidade consumida e não é o efeito de consumir ou economizar um MWh a mais.
            </>,
            <>
              The <Termo slug="fator-de-emissao">average emission factor</Termo> serves to account for the emissions of the electricity consumed and is not the effect of consuming or saving one
              more MWh.
            </>,
          )}
        </CabecalhoModulo>
        <ModoProfundidade>
          <Bloco id="emissoes">
            <PainelEvidencia
              id="p064"
              pergunta={tx("O fator médio ano a ano e mês a mês", "The average factor year by year and month by month")}
              subtitulo={tx("Fator médio de emissão de CO2 do SIN (inventários, MCTI) · tCO2/MWh", "Average CO2 emission factor of the SIN (inventories, MCTI) · tCO2/MWh")}
              natureza="ESTIMADO"
              porQueImporta={tx(
                <>
                  O <Termo slug="fator-de-emissao">fator médio de emissão</Termo> diz quanto CO2 a geração do SIN emitiu por MWh no período. É o número que empresas e governos usam para contabilizar as emissões da eletricidade
                  que consomem. Como é a média de todas as usinas em operação, muda com a composição da geração de cada mês.
                </>,
                <>
                  The <Termo slug="fator-de-emissao">average emission factor</Termo> says how much CO2 SIN generation emitted per MWh in the period. It is the number companies and governments use to
                  account for the emissions of the electricity they consume. Since it is the average of all plants in operation, it changes with each month&apos;s generation mix.
                </>,
              )}
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={e.proveniencia.medio}
              complementares={[{ rotulo: tx("Fatores do MDL (margens)", "CDM factors (margins)"), p: e.proveniencia.mdl }]}
            >
              <div className="space-y-6">
                {acesso.defasada && (
                  <TransicaoAviso rotulo={tx("Fonte possivelmente defasada", "Source possibly out of date")} alerta>
                    {acesso.texto}
                  </TransicaoAviso>
                )}
                <GraficoBarras
                  titulo={tx("Fator médio anual de emissão de CO2 do SIN", "Annual average CO2 emission factor of the SIN")}
                  dados={dadosFatorAnual(e)}
                  chaveCategoria="id"
                  chaveRotulo="rotulo"
                  series={[{ id: "medio", rotulo: tx("Fator médio anual", "Annual average factor"), cor: "var(--serie-termica)" }]}
                  unidade="tCO2/MWh"
                  casas={4}
                  referencias={referenciaAnual(e)}
                  altura={300}
                />
                {/* a faixa de cima já traz os números e o aviso da quebra de base; a resposta vem depois do gráfico para que ele comece na primeira tela */}
                <RespostaCurta id="p064" depois veredito={vereditoEmissoes(e) || respostaEmissoes(e)}>
                  {respostaEmissoes(e)}
                </RespostaCurta>
                {quebra && (
                  <TransicaoAviso rotulo={tx(`Quebra de ${mes(quebra.data)}`, `Break of ${mes(quebra.data)}`)}>
                    {tx(
                      <>
                        {quebra.descricao}
                        {quebra.no_dado ? ` No dado: ${quebra.no_dado.descricao}, ${numTexto(quebra.no_dado.energia_2024_mwh, 0)} MWh no ano anterior e ${numTexto(quebra.no_dado.energia_2025_mwh, 0)} MWh no ano da quebra (${pctTexto(quebra.no_dado.variacao_pct, 1)}).` : ""}
                      </>,
                      <>
                        {notaGold(quebra.descricao, "transicao-quebra")}
                        {quebra.no_dado ? (
                          <>
                            {" "}
                            In the data: {notaGold(quebra.no_dado.descricao, "transicao-quebra")}, {numTexto(quebra.no_dado.energia_2024_mwh, 0)} MWh in the previous year and{" "}
                            {numTexto(quebra.no_dado.energia_2025_mwh, 0)} MWh in the year of the break ({pctTexto(quebra.no_dado.variacao_pct, 1)}).
                          </>
                        ) : null}
                      </>,
                    )}
                  </TransicaoAviso>
                )}
                <TransicaoFatorMensal
                  dados={dadosFatorMensal(e)}
                  marcos={quebra ? [{ x: quebra.data, rotulo: tx("Base de usinas ampliada (MCTI)", "Plant database expanded (MCTI)") }] : []}
                />
                <TabelaInterativa
                  titulo={tx("Fator médio anual e fatores do MDL por ano", "Annual average factor and CDM factors by year")}
                  colunas={colunasFatorAnual()}
                  linhas={anual}
                  chaveLinha="id"
                  colunaRotulo="ano" // i18n: dado
                  fonte={fonteTransicao(FONTE_MCTI)}
                  versao={e.ultimo_mes?.m ?? g.gerado_em.slice(0, 10)}
                  nomeArquivo="transicao-mcti-fatores-anuais"
                  chaveUrl="em.tab" // i18n: dado
                  ordemInicial={{ coluna: "ano", direcao: "desc" }} // i18n: dado
                  dicaBusca={tx("Ano", "Year")}
                  nota={tx(
                    `Valores como o MCTI publica, com 4 casas. As colunas do MDL servem só a projetos de MDL e não substituem o fator médio. O controle compara o anual publicado com a média simples dos 12 meses${e.evidencia?.reconciliacao?.tolerancia ? ` (tolerância de ${e.evidencia.reconciliacao.tolerancia})` : ""}.`,
                    `Values as the MCTI publishes them, with 4 decimal places. The CDM columns only serve CDM projects and do not replace the average factor. The check compares the published annual factor with the simple average of the 12 months${e.evidencia?.reconciliacao?.tolerancia ? ` (tolerance of ${e.evidencia.reconciliacao.tolerancia})` : ""}.`,
                  )}
                />
                <TransicaoRecorte
                  periodo={tx(
                    <>
                      Mensal de {mes(primeiroMes)} a {mes(e.ultimo_mes?.m)}; anual de {e.medio_anual[0]?.ano ?? "sem dado"} a {e.ultimo_ano?.ano ?? "sem dado"} (o ano corrente não tem
                      fator anual)
                    </>,
                    <>
                      Monthly from {mes(primeiroMes)} to {mes(e.ultimo_mes?.m)}; annual from {e.medio_anual[0]?.ano ?? sd} to {e.ultimo_ano?.ano ?? sd} (the current year has no annual
                      factor)
                    </>,
                  )}
                  universo={tx(
                    "Geração despachada no SIN (sistemas isolados e geração fora do despacho do ONS ficam fora)",
                    "Generation dispatched in the SIN (isolated systems and generation outside ONS dispatch are left out)",
                  )}
                  unidade={tx(`${e.unidade}, ${e.gas}: não é CO2 equivalente`, `${e.unidade}, ${rotuloDado(e.gas, NOTA_TRANSICAO_EN, idioma)}: not CO2 equivalent`)}
                />
                <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />
                <TransicaoAviso rotulo={tx("Fator médio, não marginal", "Average factor, not marginal")}>
                  {tx(
                    <>
                      {docFatorMedio ? `Nas palavras do MCTI: "${docFatorMedio.trecho}" ` : ""}
                      Para o efeito de uma decisão de consumo, o fator relevante seria marginal, e os fatores de margem do MCTI são de uso exclusivo em projetos de MDL.
                    </>,
                    <>
                      {docFatorMedio ? (
                        <>
                          In the MCTI&apos;s words: &quot;<TrechoPortugues regiao="transicao-mcti-trecho">{docFatorMedio.trecho}</TrechoPortugues>&quot;{" "}
                        </>
                      ) : null}
                      For the effect of a consumption decision, the relevant factor would be marginal, and the MCTI margin factors are for exclusive use in CDM projects.
                    </>,
                  )}
                </TransicaoAviso>
                {!acesso.defasada && (
                  <p className="text-xs text-carvao-muted">
                    {acesso.texto}
                    {acesso.detalhe && <span data-nivel="auditar">{tx(` Listagem: ${acesso.detalhe}.`, ` Listing: ${acesso.detalhe}.`)}</span>}
                  </p>
                )}

                <SecaoDoPainel id="mes-a-mes" titulo={tx("Como os meses de anos diferentes se comparam?", "How do the months of different years compare?")}>
                  <TransicaoCompararAnos medioMensal={e.medio_mensal} anos={anos} padrao={padraoAnos} />
                  <p className="max-w-prose2 text-sm text-carvao-muted">
                    {tx(
                      <>
                        Mesma escala para todos os anos escolhidos. Mês ainda não publicado fica em branco, nunca em zero.
                        {quebra ? ` Anos a partir de ${quebra.data.slice(0, 4)} estão na base ampliada de usinas.` : ""}
                      </>,
                      <>
                        Same scale for all the chosen years. A month not yet published is left blank, never zero.
                        {quebra ? ` Years from ${quebra.data.slice(0, 4)} on are in the expanded plant database.` : ""}
                      </>,
                    )}
                  </p>
                </SecaoDoPainel>

                <TransicaoAnalise titulo={tx("Fator médio mensal, tabela completa", "Monthly average factor, full table")}>
                  <TabelaInterativa
                    titulo={tx("Fator médio mensal", "Monthly average factor")}
                    colunas={colunasFatorMensal()}
                    linhas={linhasFatorMensal(e)}
                    chaveLinha="id"
                    colunaRotulo="m"
                    fonte={fonteTransicao(FONTE_MCTI)}
                    versao={e.ultimo_mes?.m ?? g.gerado_em.slice(0, 10)}
                    nomeArquivo="transicao-mcti-fator-medio-mensal"
                    chaveUrl="em.mtab" // i18n: dado
                    ordemInicial={{ coluna: "m", direcao: "desc" }}
                    dicaBusca={tx("Mês (08/2025) ou ano", "Month (08/2025) or year")}
                  />
                </TransicaoAnalise>

                <TransicaoAnalise titulo={tx("Fatores do MDL: outra pergunta, outra série", "CDM factors: another question, another series")}>
                  <p className="max-w-prose2 text-sm text-carvao-muted">
                    {tx(
                      "As margens de operação e de construção estimam a emissão deslocada na margem do sistema, para calcular reduções de emissões de projetos de MDL. Ficam em séries separadas e não substituem o fator médio.",
                      "The operating and build margins estimate the emission displaced at the margin of the system, to calculate emission reductions of CDM projects. They stay in separate series and do not replace the average factor.",
                    )}
                  </p>
                  {docMargem && <TransicaoDocumento doc={docMargem} />}
                  <GraficoLinhas
                    titulo={tx("Margem de operação pela análise de despacho (MDL), por mês", "Operating margin by dispatch analysis (CDM), by month")}
                    dados={dadosMargemOperacao(e)}
                    chaveX="m"
                    formatoX="mes"
                    series={[
                      {
                        id: "om",
                        rotulo: tx("Margem de operação (despacho)", "Operating margin (dispatch)"),
                        sigla: tx("Margem de operação", "Operating margin"),
                        cor: "var(--serie-3)",
                      },
                    ]}
                    unidade="tCO2/MWh"
                    casas={4}
                    zeroNoEixo
                    zoom
                    marcos={quebra ? [{ x: quebra.data, rotulo: tx("Base de usinas ampliada (MCTI)", "Plant database expanded (MCTI)") }] : []}
                    altura={260}
                    sincronizarCursor={false}
                  />
                  <GraficoLinhas
                    titulo={tx(
                      "Margem de construção e margem de operação pelo método simples ajustado (MDL), por ano",
                      "Build margin and operating margin by the simple adjusted method (CDM), by year",
                    )}
                    dados={dadosMdlAnual(e)}
                    chaveX="ano" // i18n: dado
                    formatoX="texto"
                    series={[
                      { id: "bm", rotulo: tx("Margem de construção", "Build margin"), sigla: tx("Construção", "Build"), cor: "var(--serie-4)" },
                      {
                        id: "sa",
                        rotulo: tx("Margem de operação, simples ajustado", "Operating margin, simple adjusted"),
                        sigla: tx("Simples ajustado", "Simple adjusted"),
                        cor: "var(--serie-5)",
                        tracejada: true,
                      },
                    ]}
                    unidade="tCO2/MWh"
                    casas={4}
                    zeroNoEixo
                    altura={260}
                    sincronizarCursor={false}
                  />
                </TransicaoAnalise>

                <TransicaoAnalise titulo={tx("Por que não há intensidade horária, municipal nem estimativa própria", "Why there is no hourly or municipal intensity nor an in-house estimate")}>
                  <p className="max-w-prose2 text-sm text-carvao-muted">
                    {tx(
                      <>
                        {g.regras.sem_intensidade_local} {e.estimativa_propria.publicada ? "" : e.estimativa_propria.motivo}
                      </>,
                      <>
                        {notaGold(g.regras.sem_intensidade_local, "transicao-regra")} {e.estimativa_propria.publicada ? "" : notaGold(e.estimativa_propria.motivo, "transicao-estimativa")}
                      </>,
                    )}
                  </p>
                </TransicaoAnalise>

                <TransicaoAuditoria titulo={tx("Quebra, revisões e divergências da fonte", "Break, revisions and divergences of the source")}>
                  {quebra && <TransicaoDocumento doc={quebra.documento} />}
                  <TabelaInterativa
                    titulo={tx("Revisões declaradas pela fonte (valor anterior e corrigido)", "Revisions declared by the source (previous and corrected value)")}
                    colunas={[
                      { id: "serie", rotulo: tx("Série", "Series"), tipo: "texto", categorica: true },
                      { id: "periodo", rotulo: tx("Período", "Period"), tipo: "texto" },
                      { id: "anterior", rotulo: tx("Publicação anterior", "Previous release"), tipo: "numero", unidade: "tCO2/MWh", casas: 4 },
                      { id: "atual", rotulo: tx("Publicação corrigida", "Corrected release"), tipo: "numero", unidade: "tCO2/MWh", casas: 4 },
                      { id: "arquivo", rotulo: tx("Planilha", "Spreadsheet"), tipo: "texto", categorica: true },
                    ]}
                    linhas={e.revisoes_declaradas_pela_fonte.map((x, i) => ({
                      id: `${x.serie}-${x.periodo}-${i}`,
                      serie: rotuloDado(x.serie.replace(/_/g, " "), SERIE_MCTI_EN, idioma),
                      periodo: x.periodo,
                      anterior: x.anterior,
                      atual: x.atual,
                      arquivo: x.arquivo,
                    }))}
                    chaveLinha="id"
                    colunaRotulo="periodo"
                    fonte={fonteTransicao(FONTE_MCTI)}
                    versao={e.ultimo_mes?.m ?? g.gerado_em.slice(0, 10)}
                    nomeArquivo="transicao-mcti-revisoes"
                    chaveUrl="em.rev" // i18n: dado
                    ordemInicial={{ coluna: "periodo", direcao: "desc" }}
                    dicaBusca={tx("Período ou planilha", "Period or spreadsheet")}
                    semLinhas={tx("A fonte não declarou revisões nas planilhas lidas.", "The source declared no revisions in the spreadsheets read.")}
                  />
                  <TransicaoTabela
                    titulo={tx(
                      "Mesmo período com valor diferente na página vigente e no site anterior do MCTI (vale a vigente)",
                      "Same period with a different value on the current page and on the previous MCTI website (the current one prevails)",
                    )}
                    colunas={tx(["Série", "Período", "Página vigente", "Site anterior"], ["Series", "Period", "Current page", "Previous website"])}
                    numericas={[2, 3]}
                    linhas={e.divergencias_entre_publicacoes.map((x) => [rotuloDado(x.rotulo, SERIE_MCTI_EN, idioma), datasLegiveis(x.periodo), fator(x.valor_vigente), fator(x.valor_site_anterior)])}
                  />
                  {e.conflitos_entre_arquivos.length > 0 ? (
                    <TransicaoTabela
                      titulo={tx("Arquivos da mesma origem com valores diferentes (vale o mais recente)", "Files from the same origin with different values (the most recent prevails)")}
                      colunas={tx(["Série", "Período", "Valores", "Vigente"], ["Series", "Period", "Values", "Current"])}
                      linhas={e.conflitos_entre_arquivos.map((x) => [
                        rotuloDado(x.rotulo, SERIE_MCTI_EN, idioma),
                        x.periodo,
                        x.valores.map((v) => `${v.recurso}: ${fator(v.valor)}`).join("; "),
                        x.recurso_vigente,
                      ])}
                    />
                  ) : (
                    <p className="text-sm text-carvao-muted">{tx("Nenhum conflito entre arquivos da mesma origem nesta leitura.", "No conflict between files from the same origin in this reading.")}</p>
                  )}
                  <TransicaoTabela
                    titulo={tx("Valores descartados na leitura", "Values discarded when reading")}
                    colunas={tx(["Data na planilha", "Valor", "Motivo", "Planilha"], ["Date in the spreadsheet", "Value", "Reason", "Spreadsheet"])}
                    numericas={[1]}
                    linhas={e.descartes.map((x) => [datasLegiveis(x.data), fator(x.valor), tx<ReactNode>(x.motivo, notaGold(x.motivo, "transicao-descarte")), x.arquivo])}
                  />
                  <ul className="list-disc space-y-1 pl-5 text-sm text-carvao-muted">
                    {e.problemas_de_leitura.map((x) => (
                      <li key={x.texto}>
                        <TrechoPortugues regiao="transicao-mcti-leitura">{x.texto}</TrechoPortugues> ({x.arquivo})
                      </li>
                    ))}
                  </ul>
                  <p className="max-w-prose2 text-sm text-carvao-muted">
                    {tx(
                      <>
                        Consistência interna: {e.consistencia_diaria_mensal.descricao}; {inteiro(e.consistencia_diaria_mensal.meses_comparados)} meses, maior diferença de{" "}
                        {fator(e.consistencia_diaria_mensal.maior_diferenca_absoluta)} tCO2/MWh em {mes(e.consistencia_diaria_mensal.mes_da_maior_diferenca)}. É um controle de leitura das
                        planilhas, não um recálculo do MCTI: a diferença fica registrada sem ajuste e sem causa atribuída, e nenhum dos dois valores é alterado.
                      </>,
                      <>
                        Internal consistency: {notaGold(e.consistencia_diaria_mensal.descricao, "transicao-consistencia")}; {inteiro(e.consistencia_diaria_mensal.meses_comparados)} months,
                        largest difference of {fator(e.consistencia_diaria_mensal.maior_diferenca_absoluta)} tCO2/MWh in {mes(e.consistencia_diaria_mensal.mes_da_maior_diferenca)}. It is a check
                        on the reading of the spreadsheets, not a recalculation by the MCTI: the difference is recorded without adjustment and without an attributed cause, and neither value is
                        changed.
                      </>,
                    )}
                  </p>
                </TransicaoAuditoria>

                <TransicaoAuditoria titulo={tx("Acesso à fonte e planilhas lidas", "Access to the source and spreadsheets read")}>
                  <p className="max-w-prose2 text-sm text-carvao-muted">
                    {tx(
                      <>
                        {acesso.texto} Origens dos valores: {e.acesso.familias_usadas.join(", ") || "sem registro"}. Alternativa registrada: {e.acesso.alternativa}.{" "}
                        {e.acesso.bloqueios_registrados.length
                          ? `Bloqueios registrados: ${e.acesso.bloqueios_registrados.map((b) => `${carimbo(b.tentado_em)} (${b.detalhe})`).join("; ")}.`
                          : "Nenhum bloqueio registrado nas tentativas guardadas."}
                      </>,
                      <>
                        {acesso.texto} Origins of the values:{" "}
                        {e.acesso.familias_usadas.map((f) => rotuloDado(f, NOTA_TRANSICAO_EN, idioma)).join(", ") || tx("sem registro", "no record")}. Recorded alternative:{" "}
                        {notaGold(e.acesso.alternativa, "transicao-acesso")}.{" "}
                        {e.acesso.bloqueios_registrados.length ? (
                          <>
                            Recorded blocks:{" "}
                            {e.acesso.bloqueios_registrados.map((b, i) => (
                              <span key={b.tentado_em}>
                                {i > 0 ? "; " : ""}
                                {carimbo(b.tentado_em)} (<TrechoPortugues regiao="transicao-acesso">{b.detalhe}</TrechoPortugues>)
                              </span>
                            ))}
                            .
                          </>
                        ) : (
                          tx("Nenhum bloqueio registrado nas tentativas guardadas.", "No block recorded in the stored attempts.")
                        )}
                      </>,
                    )}
                  </p>
                  {e.pagina_vigente && (
                    <>
                      <TransicaoTabela
                        titulo={tx(
                          `Planilhas visíveis na página vigente (listagem de ${data(e.pagina_vigente.listagem_capturada_em)})`,
                          `Spreadsheets visible on the current page (listing of ${data(e.pagina_vigente.listagem_capturada_em)})`,
                        )}
                        colunas={tx(["Título na página", "Arquivo"], ["Title on the page", "File"])}
                        linhas={e.pagina_vigente.planilhas.map((p) => [
                          p.titulo ? tx<ReactNode>(p.titulo, <Nome>{p.titulo}</Nome>) : tx("sem título", "untitled"),
                          <a key={p.url} href={p.url} className="break-all text-energia-dark underline underline-offset-4 hover:text-carvao">
                            {p.arquivo}
                          </a>,
                        ])}
                      />
                      {e.pagina_vigente.links_ocultos_ignorados.length > 0 && (
                        <p className="max-w-prose2 text-sm text-carvao-muted">
                          {tx(
                            `Âncoras sem texto, invisíveis ao leitor, ignoradas: ${e.pagina_vigente.links_ocultos_ignorados.join(", ")}.`,
                            `Anchors without text, invisible to the reader, ignored: ${e.pagina_vigente.links_ocultos_ignorados.join(", ")}.`,
                          )}
                        </p>
                      )}
                    </>
                  )}
                  {e.notas_da_fonte.length > 0 && (
                    <details className="text-sm">
                      <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-carvao-muted underline underline-offset-4 hover:text-carvao">
                        {tx(`Notas da fonte nas planilhas (${e.notas_da_fonte.length})`, `Source notes in the spreadsheets (${e.notas_da_fonte.length})`)}
                      </summary>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-carvao-muted">
                        {e.notas_da_fonte.map((x, i) => (
                          <li key={i}>
                            <TrechoPortugues regiao="transicao-mcti-nota">{x.texto}</TrechoPortugues> ({x.arquivo})
                          </li>
                        ))}
                        {e.notas_margem_construcao.map((x, i) => (
                          <li key={`bm-${i}`}>
                            <TrechoPortugues regiao="transicao-mcti-nota">{x.texto}</TrechoPortugues> ({x.arquivo})
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </TransicaoAuditoria>

                <TransicaoSeguir
                  ancora="p064"
                  href={ligacaoGeracao().href}
                  pergunta={ligacaoGeracao().pergunta}
                  downloads={downloads(["/energia/series/transicao_mcti_fatores.csv", "/energia/series/transicao_mcti_om_diario.csv"])}
                />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
