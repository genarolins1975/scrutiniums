import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { PldCmo } from "@/components/energia/PldCmo";
import { PldAviso, PldControles, PldIndisponivel, PldNavegacao, PldPassagem, PldSeguir, PldTextoGold } from "@/components/energia/PldPagina";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, horaLocal, num, reais } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import { tx } from "@/lib/energia/idioma";
import {
  colunasCobertura,
  nomeSm,
  SUBMERCADOS,
  atualidadePld,
  linhasCobertura,
  marcosSemanais,
  notaHorasEntreLimites,
  perguntaPainel,
  proximoPainel,
  partesDistanciaSemanal,
} from "@/lib/energia/pld";
import { fichasPld, horarioRecentePld } from "@/lib/energia/pld-arquivos";
import type { ColunaTabela } from "@/lib/energia/tabela";
import type { PldDetalheGold } from "@/lib/energia/tipos-pld";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/pld/cmo-e-formacao", {
    title: tx("PLD: CMO e formação de preço", "PLD: CMO and price formation"),
    description: tx(
      "CMO semanal do DECOMP, CMO semi-horário do DESSEM e PLD horário como três produtos separados, alinhados na mesma semana operativa e na mesma hora, com o momento do cálculo de cada um, a relação por ano e a sequência de CMO zero conferida no arquivo original.",
      "Weekly DECOMP marginal operating cost (CMO), half-hourly DESSEM CMO and hourly spot price (PLD) as three separate products, aligned on the same operating week and the same hour, with the calculation time of each, the relation by year and the sequence of zero CMO checked in the original file.",
    ),
    alternates: { canonical: "/setor-eletrico/pld/cmo-e-formacao" },
  }, anterior);
}

function fonte(): string {
  return tx(
    "ONS, CMO Semanal (DECOMP) e CMO Semi-Horário (DESSEM); CCEE, PLD horário por submercado",
    "ONS, Weekly CMO (DECOMP) and Half-Hourly CMO (DESSEM); CCEE, hourly PLD by submarket",
  );
}

function colunasConvencao(): ColunaTabela[] {
  return [
    { id: "sm", rotulo: tx("Submercado", "Submarket"), tipo: "texto" },
    { id: "semanas", rotulo: tx("Semanas comparadas", "Weeks compared"), tipo: "numero", casas: 0 },
    { id: "corr_fim", rotulo: tx("Correlação com a semana que termina na data", "Correlation with the week ending on the date"), tipo: "numero", casas: 3 },
    { id: "corr_seg", rotulo: tx("Correlação com a semana seguinte", "Correlation with the following week"), tipo: "numero", casas: 3 },
    { id: "horas", rotulo: tx("Horas na conferência da meia hora", "Hours in the half-hour check"), tipo: "numero", casas: 0 },
    { id: "erro_ini", rotulo: tx("Erro médio, instante = início", "Average error, instant = start"), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "erro_fim", rotulo: tx("Erro médio, instante = fim", "Average error, instant = end"), tipo: "numero", unidade: "R$/MWh", casas: 2 },
  ];
}

function colunasSequencias(): ColunaTabela[] {
  return [
    { id: "sm", rotulo: tx("Subsistema", "Subsystem"), tipo: "texto", categorica: true },
    { id: "inicio", rotulo: tx("Primeira semana (sexta)", "First week (Friday)"), tipo: "data" },
    { id: "fim", rotulo: tx("Última semana (sexta)", "Last week (Friday)"), tipo: "data" },
    { id: "semanas", rotulo: tx("Semanas", "Weeks"), tipo: "numero", casas: 0 },
  ];
}

function colunasA02Arquivos(): ColunaTabela[] {
  return [
    { id: "recurso", rotulo: tx("Arquivo", "File"), tipo: "texto", idiomaTexto: "nome" },
    { id: "formas", rotulo: tx("Forma do zero no texto", "Form of the zero in the text"), tipo: "texto" },
    { id: "semanas", rotulo: tx("Semanas da sequência no arquivo", "Weeks of the sequence in the file"), tipo: "numero", casas: 0 },
    { id: "zeradas", rotulo: tx("Linhas zeradas", "Zeroed rows"), tipo: "numero", casas: 0 },
    { id: "esperadas", rotulo: tx("Linhas esperadas", "Expected rows"), tipo: "numero", casas: 0 },
    { id: "parquet", rotulo: tx("Células iguais ao Parquet oficial", "Cells equal to the official Parquet"), tipo: "texto" },
    { id: "sha256", rotulo: tx("sha256 do CSV", "CSV sha256"), tipo: "texto" },
  ];
}

export default function PldCmoPage() {
  const FONTE = fonte();
  const g = lerGold<PldDetalheGold>("pld_detalhe.json");
  if (!integra(g)) return <PldIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;
  const c = g.cmo_pld;
  const a02 = g.achados.A02;
  const a03 = g.achados.A03;
  const fichas = fichasPld(g.evidencias.arquivo, [...SUBMERCADOS.flatMap((sm) => [`pld_semana_${sm}`, `dessem_semana_${sm}`]), "a02_zeros"]);
  const rec = horarioRecentePld(g.horario_recente.url);
  const horario = rec ? { t: rec.t, pld: rec.pld, cmo: rec.cmo_dessem } : null;
  const marcos = marcosSemanais(a02, c.semanal.fim);
  const atual = atualidadePld(g.referencia.dia, g.gerado_em);
  const versao = g.referencia.dia;
  const fontesPorId = new Map(g.conceito.fontes_textuais.map((f) => [f.id, f]));
  const ref = c.semana_referencia;
  const controles = g.controles.filter((x) => /CMO|meia hora|semanal|Equival|S3/i.test(x.nome));
  const downloads = g.downloads.filter((d) => /cmo_semanal|cmo_horario|horario_recente/.test(d.url));
  const n = c.semanal.fim.length;
  const limitesDisponiveis = g.limites.disponivel ? g.limites : null;
  const notasEntreLimites = Object.fromEntries(SUBMERCADOS.map((sm) => [sm, notaHorasEntreLimites(c, limitesDisponiveis, sm)]));
  const distanciaSemanal = partesDistanciaSemanal(ref);
  const seqZeros = a02.sequencia_comum_mais_longa;
  const notaMarcos = seqZeros ? (
    <>
      {tx(
        `A marca vertical indica a maior sequência, comum aos quatro subsistemas, de semanas seguidas com CMO semanal zero publicado pelo ONS: ${num(seqZeros.semanas, 0)} semanas, de ${dataBR(seqZeros.inicio)} a ${dataBR(seqZeros.fim)} (datas das sextas-feiras que encerram as semanas). A fonte não informa o motivo dos zeros, e esta página não atribui causa.`,
        `The vertical mark shows the longest sequence, common to the four subsystems, of consecutive weeks with zero weekly CMO published by ONS: ${num(seqZeros.semanas, 0)} weeks, from ${dataBR(seqZeros.inicio)} to ${dataBR(seqZeros.fim)} (dates of the Fridays that close the weeks). The source does not report the reason for the zeros, and this page does not attribute one.`,
      )}
    </>
  ) : null;
  // os quatro submercados da semana de referência lado a lado, com a distância entre eles escrita
  const quatroSubmercados = ref ? (
    <SecaoDoPainel
      id="quatro-submercados"
      titulo={tx("Os quatro submercados na mesma semana", "The four submarkets in the same week")}
      lead={tx(`Semana operativa de ${dataBR(ref.inicio)} a ${dataBR(ref.fim)}, em R$/MWh nominais.`, `Operating week from ${dataBR(ref.inicio)} to ${dataBR(ref.fim)}, in nominal R$/MWh.`)}
    >
      <div
        className="tabela-scroll"
        tabIndex={0}
        role="region"
        aria-label={tx("Os três valores da semana de referência nos quatro submercados (tabela rolável)", "The three values of the reference week in the four submarkets (scrollable table)")}
      >
        <table className="w-full border-collapse text-sm tabular-nums sm:min-w-[28rem]">
          <caption className="sr-only">
            {tx(
              "CMO semanal do DECOMP, média do CMO do DESSEM e média do PLD na semana de referência, por submercado, R$/MWh",
              "Weekly DECOMP CMO, average DESSEM CMO and average PLD in the reference week, by submarket, R$/MWh",
            )}
          </caption>
          <thead>
            <tr className="border-b border-linha text-left text-xs text-mineral">
              <th scope="col" className="py-2 pr-3 font-normal">
                {tx("Submercado", "Submarket")}
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-normal">
                {tx("CMO semanal (DECOMP)", "Weekly CMO (DECOMP)")}
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-normal">
                {tx("Média do DESSEM", "DESSEM average")}
              </th>
              <th scope="col" className="py-2 text-right font-normal">
                {tx("Média do PLD", "PLD average")}
              </th>
            </tr>
          </thead>
          <tbody>
            {ref.por_sm.map((x) => (
              <tr key={x.sm} className="border-b border-linha">
                <th scope="row" className="py-2 pr-3 text-left font-normal text-carvao">
                  {nomeSm(x.sm)}
                </th>
                <td className="py-2 pr-3 text-right">{reais(x.decomp)}</td>
                <td className="py-2 pr-3 text-right">{reais(x.dessem)}</td>
                <td className="py-2 text-right">{reais(x.pld)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {distanciaSemanal && (
        <div className="max-w-prose2 text-sm leading-relaxed text-carvao-muted" data-texto="distancia-semanal">
          <p className="text-carvao">{distanciaSemanal.introducao}</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {distanciaSemanal.itens.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <p className="mt-2">{distanciaSemanal.ressalva}</p>
        </div>
      )}
    </SecaoDoPainel>
  ) : null;

  const oQueMudou = (
    <>
      {atual.texto}{" "}
      {ref
        ? tx(
            `A semana de referência é a última semana operativa completa nos três produtos (${dataBR(ref.inicio)} a ${dataBR(ref.fim)}).`,
            `The reference week is the latest operating week complete in all three products (${dataBR(ref.inicio)} to ${dataBR(ref.fim)}).`,
          )
        : tx("Nenhuma semana completa nos três produtos.", "No complete week in all three products.")}
    </>
  );
  const comoInterpretar = (
    <>
      {tx(
        "O CMO é o custo, por unidade de energia produzida, para atender ao incremento de uma unidade de carga no sistema interligado. Compare só o que está no mesmo intervalo: o valor semanal do DECOMP contra as médias do DESSEM (336 meias horas) e do PLD (168 horas) da mesma semana de sábado a sexta; o PLD de uma hora contra o CMO do DESSEM da mesma hora. O DECOMP é um valor do modelo para a semana inteira, não uma média de horas. As diferenças são escritas em R$/MWh, nunca como razão.",
        "The CMO is the cost, per unit of energy produced, of meeting an increase of one unit of load in the interconnected system. Compare only what covers the same interval: the weekly DECOMP value against the DESSEM averages (336 half hours) and the PLD averages (168 hours) of the same Saturday-to-Friday week; the PLD of one hour against the DESSEM CMO of the same hour. DECOMP is a model value for the whole week, not an average of hours. Differences are written in R$/MWh, never as a ratio.",
      )}
    </>
  );
  const naoConcluir = (
    <>
      {tx(
        "Os dados não dizem por que o PLD difere do CMO: os conjuntos do ONS não identificam deck, versão nem revisão do modelo de cada valor, e a descrição pública da CCEE não detalha a configuração da sua execução. Diferença entre produtos não é erro de nenhum deles. No piso e nos tetos, o PLD é o limite do ato e a diferença mede o limite.",
        "The data do not say why the PLD differs from the CMO: the ONS datasets do not identify the model deck, version or revision of each value, and the CCEE public description does not detail the configuration of its run. A difference between products is not an error in any of them. At the floor and caps, the PLD is the act's limit and the difference measures the limit.",
      )}
    </>
  );

  return (
    <>
      <CabecalhoEnergia atual="pld" />
      <MarcaVisita secao="energia:pld" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          siglas={["CMO", "ONS", "CCEE"]}
          rotulo={tx("Preço de Liquidação das Diferenças", "Spot price (PLD)")}
          titulo={perguntaPainel("p009")}
          lead={
            <>
              {tx(
                <>
                  O <Termo slug="cmo">custo marginal de operação</Termo> (CMO) que o ONS publica por semana (modelo <Termo slug="decomp">DECOMP</Termo>) e por meia hora (modelo{" "}
                  <Termo slug="dessem">DESSEM</Termo>) e o PLD que a CCEE calcula para cada hora: três produtos diferentes, comparados só no mesmo intervalo.
                </>,
                <>
                  The <Termo slug="cmo">marginal operating cost</Termo> (CMO) that ONS publishes by week (<Termo slug="decomp">DECOMP</Termo> model) and by half hour (
                  <Termo slug="dessem">DESSEM</Termo> model), and the spot price (PLD) that CCEE calculates for each hour: three different products, compared only over the same interval.
                </>,
              )}
            </>
          }
          recorte={
            ref
              ? tx(
                  `semana operativa de ${dataBR(ref.inicio)} a ${dataBR(ref.fim)} · quatro submercados · R$/MWh nominais`,
                  `operating week from ${dataBR(ref.inicio)} to ${dataBR(ref.fim)} · four submarkets · nominal R$/MWh`,
                )
              : tx("quatro submercados · R$/MWh nominais", "four submarkets · nominal R$/MWh")
          }
          fonte={tx("ONS (CMO) e CCEE (PLD)", "ONS (CMO) and CCEE (PLD)")}
          referencia={
            <>
              {tx(
                `ONS (CMO semanal até a semana de ${dataBR(g.referencia.ultima_semana_decomp)}; CMO semi-horário até ${horaLocal(g.referencia.ultima_meia_hora_cmo)}) e CCEE (PLD até ${horaLocal(g.referencia.ultima_hora_pld)}); processado em ${carimbo(g.gerado_em)}.`,
                `ONS (weekly CMO through the week of ${dataBR(g.referencia.ultima_semana_decomp)}; half-hourly CMO through ${horaLocal(g.referencia.ultima_meia_hora_cmo)}) and CCEE (PLD through ${horaLocal(g.referencia.ultima_hora_pld)}); processed on ${carimbo(g.gerado_em)}.`,
              )}
            </>
          }
        >
          {tx(
            <>
              O <Termo slug="cmo">custo marginal de operação</Termo> (CMO) é o custo, por unidade de energia produzida, para atender ao incremento de uma unidade de carga no
              sistema interligado; segundo a CCEE, é a base do PLD. O ONS publica dois CMOs: o do modelo <Termo slug="decomp">DECOMP</Termo>, por semana operativa, e o do modelo{" "}
              <Termo slug="dessem">DESSEM</Termo>, por meia hora e para cada barra do sistema. A CCEE calcula o PLD de cada hora com os próprios processamentos. Esta página põe os
              três valores lado a lado, só no mesmo intervalo.
            </>,
            <>
              The <Termo slug="cmo">marginal operating cost</Termo> (CMO) is the cost, per unit of energy produced, of meeting an increase of one unit of load in the interconnected
              system; according to CCEE, it is the basis of the PLD. ONS publishes two CMOs: the one from the <Termo slug="decomp">DECOMP</Termo> model, by operating week, and the
              one from the <Termo slug="dessem">DESSEM</Termo> model, by half hour and for each bus of the system. CCEE calculates the PLD for each hour with its own runs. This page
              puts the three values side by side, only over the same interval.
            </>,
          )}
        </CabecalhoModulo>
        <PldNavegacao atual="p009" />
        <ModoProfundidade>
          <Bloco id="cmo-e-formacao">
            <PainelEvidencia
              id="p009"
              pergunta={tx("Os três valores na mesma semana operativa", "The three values in the same operating week")}
              subtitulo={tx("CMO do DECOMP, CMO do DESSEM e PLD, por semana e por hora · R$/MWh", "DECOMP CMO, DESSEM CMO and PLD, by week and by hour · R$/MWh")}
              porQueImporta={tx(
                "Pela norma, o PLD tem como base o custo marginal de operação e é limitado por piso e tetos. Ver o quanto o PLD se afasta do CMO publicado pelo ONS, no mesmo intervalo, mostra o que a série pública do operador permite (e o que não permite) dizer sobre a formação do preço.",
                "Under the rules, the PLD is based on the marginal operating cost and is bounded by a floor and caps. Seeing how far the PLD moves from the CMO published by ONS, over the same interval, shows what the operator's public series allows (and does not allow) us to say about price formation.",
              )}
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={g.proveniencia.comparacao_semanal}
              complementares={[
                { rotulo: tx("Sobre o CMO semi-horário (DESSEM)", "On the half-hourly CMO (DESSEM)"), p: g.proveniencia.cmo_semi_horario },
                { rotulo: tx("Sobre o CMO na hora", "On the hourly CMO"), p: g.proveniencia.cmo_horario },
                { rotulo: tx("Sobre a relação por ano", "On the relation by year"), p: g.proveniencia.relacao_pld_cmo },
              ]}
            >
              <div className="space-y-6">
                {atual.defasada && <PldAviso tipo="alerta">{atual.texto}</PldAviso>}
                <PldCmo
                  c={{ semanal: c.semanal, semana_referencia: c.semana_referencia, relacao_anual: c.relacao_anual }}
                  horario={horario}
                  marcos={marcos}
                  fichas={fichas}
                  fonte={FONTE}
                  versao={versao}
                  notasEntreLimites={notasEntreLimites}
                  quatroSubmercados={quatroSubmercados}
                  notaMarcos={notaMarcos}
                  regimes={limitesDisponiveis?.regimes ?? []}
                  notas={<NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />}
                  avisoGrafico={
                    <PldAviso>
                      {tx(
                        `O gráfico tem as últimas ${num(n, 0)} semanas; o CSV semanal tem as ${num(c.semanal_recorte.semanas_no_csv, 0)} desde 2021.`,
                        `The chart has the last ${num(n, 0)} weeks; the weekly CSV has the ${num(c.semanal_recorte.semanas_no_csv, 0)} since 2021.`,
                      )}
                      <span data-nivel="analisar">
                        {" "}
                        {tx(
                          `O CSV foi conferido célula a célula contra a base publicada (${num(c.equivalencia_csv.celulas, 0)} células, ${num(c.equivalencia_csv.divergentes, 0)} divergentes).`,
                          `The CSV was checked cell by cell against the published base (${num(c.equivalencia_csv.celulas, 0)} cells, ${num(c.equivalencia_csv.divergentes, 0)} divergent).`,
                        )}
                      </span>
                    </PldAviso>
                  }
                />

                <SecaoDoPainel id="nao-equivalencia" titulo={tx("O que diferencia o CMO do DECOMP, o CMO do DESSEM e o PLD?", "What distinguishes the DECOMP CMO, the DESSEM CMO and the PLD?")}>
                  <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-carvao" data-textos="nao-equivalencia">
                    {c.nao_equivalencia.map((t) => (
                      <li key={t}>
                        <PldTextoGold texto={t} regiao="pld-cmo" />
                      </li>
                    ))}
                  </ul>
                </SecaoDoPainel>

                <SecaoDoPainel id="produtos" titulo={tx("Três produtos, três momentos de cálculo", "Three products, three calculation times")} nivel="analisar">
                  <div className="grid gap-x-8 gap-y-6 lg:grid-cols-3">
                    {c.produtos.map((p) => (
                      <article key={p.id} className="min-w-0 border-l-2 border-linha pl-4 text-sm [overflow-wrap:anywhere]">
                        <h4 className="font-serif text-lg text-carvao">
                          <PldTextoGold texto={p.rotulo} regiao="pld-cmo" />
                        </h4>
                        <p className="mt-1 text-xs text-mineral">
                          <Nome>{p.orgao}</Nome>; {tx("modelo:", "model:")} <PldTextoGold texto={p.modelo} regiao="pld-cmo" />
                        </p>
                        <dl className="mt-3 space-y-2 text-carvao-muted">
                          <div>
                            <dt className="rotulo text-mineral">{tx("Intervalo de cada valor", "Interval of each value")}</dt>
                            <dd className="text-carvao">
                              <PldTextoGold texto={p.resolucao} regiao="pld-cmo" />
                            </dd>
                          </div>
                          <div>
                            <dt className="rotulo text-mineral">{tx("Grão geográfico", "Geographic grain")}</dt>
                            <dd>
                              <PldTextoGold texto={p.grao_geografico} regiao="pld-cmo" />
                            </dd>
                          </div>
                          <div>
                            <dt className="rotulo text-mineral">{tx("Quando é calculado", "When it is calculated")}</dt>
                            <dd>
                              {p.momento_do_calculo ? (
                                <PldTextoGold texto={p.momento_do_calculo} regiao="pld-cmo" />
                              ) : (
                                <>
                                  {tx("Não conferido:", "Not checked:")}{" "}
                                  {p.momento_do_calculo_motivo ? <PldTextoGold texto={p.momento_do_calculo_motivo} regiao="pld-cmo" /> : tx("sem motivo publicado", "no reason published")}
                                </>
                              )}
                            </dd>
                          </div>
                          <div>
                            <dt className="rotulo text-mineral">{tx("Unidade no dicionário", "Unit in the dictionary")}</dt>
                            <dd>
                              {p.unidade_no_dicionario ?? tx("não informada", "not reported")}
                              {p.unidade_patamares_no_dicionario ? tx(`; patamares em ${p.unidade_patamares_no_dicionario}`, `; load levels in ${p.unidade_patamares_no_dicionario}`) : ""}
                            </dd>
                          </div>
                          <div>
                            <dt className="rotulo text-mineral">{tx("Deck e versão", "Deck and version")}</dt>
                            <dd>
                              <PldTextoGold texto={p.deck_versao} regiao="pld-cmo" />
                            </dd>
                          </div>
                        </dl>
                        <a href={p.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
                          {tx("Conjunto de dados", "Dataset")}
                        </a>
                      </article>
                    ))}
                  </div>
                </SecaoDoPainel>

                <SecaoDoPainel id="a02" titulo={tx("A sequência de semanas com CMO semanal igual a zero", "The sequence of weeks with weekly CMO equal to zero")} nivel="analisar">
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao" data-textos="a02">
                    {a02.texto ? (
                      <TrechoPortugues regiao="pld-a02">{a02.texto}</TrechoPortugues>
                    ) : (
                      <>
                        {tx("Situação:", "Status:")} <TrechoPortugues regiao="pld-a02">{a02.status}</TrechoPortugues>.
                      </>
                    )}
                  </p>
                  {fichas.a02_zeros && (
                    <p className="text-sm">
                      <ComproveNumero evidencia={fichas.a02_zeros} endereco="/setor-eletrico/pld/cmo-e-formacao#a02" />
                    </p>
                  )}
                  {a02.observacao_formato && (
                    <p className="text-xs text-carvao-muted">
                      <TrechoPortugues regiao="pld-a02">{a02.observacao_formato}</TrechoPortugues>
                    </p>
                  )}
                  <TabelaInterativa
                    titulo={tx(
                      "Sequências de 4 semanas seguidas ou mais com CMO semanal zero, por subsistema (desde 2005)",
                      "Sequences of 4 or more consecutive weeks with zero weekly CMO, by subsystem (since 2005)",
                    )}
                    colunas={colunasSequencias()}
                    linhas={SUBMERCADOS.flatMap((sm) => a02.sequencias_por_sm[sm].map((s) => ({ id: `${sm}:${s.inicio}`, sm: nomeSm(sm), inicio: s.inicio, fim: s.fim, semanas: s.semanas })))}
                    chaveLinha="id"
                    colunaRotulo="inicio"
                    fonte={tx("ONS, CMO Semanal (DECOMP), arquivos originais", "ONS, Weekly CMO (DECOMP), original files")}
                    versao={versao}
                    nomeArquivo="pld-a02-sequencias"
                    chaveUrl="a02"
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="a02-arquivos" titulo={tx("Os zeros no arquivo original do ONS", "The zeros in the original ONS file")} nivel="auditar">
                  <TabelaInterativa
                    titulo={tx("Arquivos anuais do CMO semanal relidos (CSV e Parquet oficiais)", "Annual weekly CMO files reread (official CSV and Parquet)")}
                    colunas={colunasA02Arquivos()}
                    linhas={a02.arquivos.map((f) => ({
                      id: f.recurso,
                      recurso: f.recurso,
                      formas: f.formas_do_zero.join(", "),
                      semanas: f.semanas_no_trecho,
                      zeradas: f.linhas_zeradas_no_trecho,
                      esperadas: f.linhas_esperadas_no_trecho,
                      parquet:
                        f.parquet.celulas !== null
                          ? tx(`${num(f.parquet.celulas_iguais, 0)} de ${num(f.parquet.celulas, 0)}`, `${num(f.parquet.celulas_iguais, 0)} of ${num(f.parquet.celulas, 0)}`)
                          : (f.parquet.erro ?? tx("sem conferência", "no check")),
                      sha256: f.sha256,
                    }))}
                    chaveLinha="id"
                    colunaRotulo="recurso"
                    fonte={tx("ONS, CMO Semanal (DECOMP)", "ONS, Weekly CMO (DECOMP)")}
                    versao={versao}
                    nomeArquivo="pld-a02-arquivos"
                  />
                  <p className="text-sm text-carvao-muted">
                    {tx(
                      `A base publicada pelo observatório contra a releitura do arquivo original: ${num(a02.reconciliacao_silver_principal.iguais, 0)} semanas-subsistema iguais, ${num(a02.reconciliacao_silver_principal.diferentes, 0)} diferentes.`,
                      `The base published by the observatory against the rereading of the original file: ${num(a02.reconciliacao_silver_principal.iguais, 0)} subsystem-weeks equal, ${num(a02.reconciliacao_silver_principal.diferentes, 0)} different.`,
                    )}{" "}
                    <TrechoPortugues regiao="pld-a02">{a02.reconciliacao_silver_principal.nota}</TrechoPortugues>
                  </p>
                  {a02.dicionario_permite && (
                    <p className="text-sm text-carvao-muted">
                      {tx("Dicionário do ONS (PDF):", "ONS dictionary (PDF):")}{" "}
                      {Object.entries(a02.dicionario_permite)
                        .map(([campo, p]) => `${campo} ${p.zerado ? tx("admite zero", "accepts zero") : tx("não admite zero", "does not accept zero")}`)
                        .join("; ")}
                      .
                    </p>
                  )}
                </SecaoDoPainel>

                <SecaoDoPainel id="a03" titulo={tx("Unidade do CMO semanal", "Unit of the weekly CMO")} nivel="auditar">
                  <p className="text-sm leading-relaxed text-carvao">
                    <TrechoPortugues regiao="pld-a03">{a03.decisao}</TrechoPortugues>
                  </p>
                  <p className="text-sm text-carvao-muted">
                    {tx(
                      `Dicionário: média semanal em ${a03.unidade_media_semanal_no_dicionario ?? "unidade não informada"}; patamares em ${a03.unidade_patamares_no_dicionario ?? "unidade não informada"}; semi-horário em ${a03.unidade_semi_horario_no_dicionario ?? "unidade não informada"}.`,
                      `Dictionary: weekly average in ${a03.unidade_media_semanal_no_dicionario ?? "unit not reported"}; load levels in ${a03.unidade_patamares_no_dicionario ?? "unit not reported"}; half-hourly in ${a03.unidade_semi_horario_no_dicionario ?? "unit not reported"}.`,
                    )}{" "}
                    <TrechoPortugues regiao="pld-a03">{a03.verificacao.leitura}</TrechoPortugues>{" "}
                    {tx(
                      `(${num(a03.verificacao.media_entre_min_e_max_dos_patamares, 0)} de ${num(a03.verificacao.semanas_subsistema, 0)} semanas-subsistema).`,
                      `(${num(a03.verificacao.media_entre_min_e_max_dos_patamares, 0)} of ${num(a03.verificacao.semanas_subsistema, 0)} subsystem-weeks).`,
                    )}
                  </p>
                </SecaoDoPainel>

                <SecaoDoPainel id="alinhamento" titulo={tx("Alinhamento: convenções conferidas nos dados", "Alignment: conventions checked in the data")} nivel="auditar">
                  <ul className="list-disc space-y-1 pl-5 text-sm text-carvao-muted">
                    <li>
                      <TrechoPortugues regiao="pld-alinhamento">{c.alinhamento.hora}</TrechoPortugues>
                    </li>
                    <li>
                      <TrechoPortugues regiao="pld-alinhamento">{c.alinhamento.semana}</TrechoPortugues>
                    </li>
                    <li>
                      <TrechoPortugues regiao="pld-alinhamento">{g.achados.A01.regra}</TrechoPortugues>
                    </li>
                  </ul>
                  <TabelaInterativa
                    titulo={tx("Conferência da data da semana e do instante da meia hora", "Check of the week date and of the half-hour instant")}
                    colunas={colunasConvencao()}
                    linhas={SUBMERCADOS.map((sm) => ({
                      id: sm,
                      sm: nomeSm(sm),
                      semanas: c.alinhamento.convencao_semana[sm].semanas,
                      corr_fim: c.alinhamento.convencao_semana[sm].corr_semana_que_termina_na_data,
                      corr_seg: c.alinhamento.convencao_semana[sm].corr_semana_seguinte,
                      horas: c.alinhamento.convencao_meia_hora[sm].horas,
                      erro_ini: c.alinhamento.convencao_meia_hora[sm].erro_abs_medio_inicio,
                      erro_fim: c.alinhamento.convencao_meia_hora[sm].erro_abs_medio_fim,
                    }))}
                    chaveLinha="id"
                    colunaRotulo="sm"
                    fonte={FONTE}
                    versao={versao}
                    nomeArquivo="pld-convencoes"
                    nota={
                      <>
                        {tx("Meia hora:", "Half hour:")} <PldTextoGold texto={c.alinhamento.convencao_meia_hora.SE.filtro} regiao="pld-alinhamento" />.
                      </>
                    }
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="cobertura" titulo={tx("Cobertura do CMO semi-horário publicado pelo ONS", "Coverage of the half-hourly CMO published by ONS")} nivel="auditar">
                  <TabelaInterativa
                    titulo={tx("Meias horas esperadas e publicadas por ano", "Half hours expected and published by year")}
                    colunas={colunasCobertura()}
                    linhas={linhasCobertura(g.cobertura.cmo_semi_horario)}
                    chaveLinha="id"
                    colunaRotulo="ano" // i18n: dado
                    fonte={tx("ONS, CMO Semi-Horário (DESSEM)", "ONS, Half-Hourly CMO (DESSEM)")}
                    versao={versao}
                    nomeArquivo="pld-cobertura-dessem"
                    nota={tx(
                      "Dia sem nenhuma meia hora publicada fica sem CMO na hora e fora das médias semanais; nunca é preenchido.",
                      "A day with no half hour published has no hourly CMO and is left out of the weekly averages; it is never filled in.",
                    )}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="normas-produtos" titulo={tx("Passagens que sustentam a descrição de cada produto", "Passages that support the description of each product")} nivel="auditar">
                  {c.produtos.map((p) => (
                    <div key={p.id} className="space-y-2">
                      <p className="rotulo text-mineral">
                        <PldTextoGold texto={p.rotulo} regiao="pld-cmo" />
                      </p>
                      {p.fontes_normativas
                        .map((id) => fontesPorId.get(id))
                        .filter((f): f is NonNullable<typeof f> => !!f && !!f.texto)
                        .map((f) => (
                          <PldPassagem key={f.id} p={f} />
                        ))}
                    </div>
                  ))}
                </SecaoDoPainel>

                <SecaoDoPainel id="controles" titulo={tx("Controles automáticos da construção", "Automatic build checks")} nivel="auditar">
                  <PldControles controles={controles} />
                </SecaoDoPainel>

                <PldSeguir ancora="p009" proximo={proximoPainel("p009")} downloads={downloads} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
