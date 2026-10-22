import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { InclusaoBaseLegal } from "@/components/energia/InclusaoTextos";
import { InclusaoDatas, InclusaoIndisponivel, InclusaoNavegacao, InclusaoRecorte, InclusaoSeguir } from "@/components/energia/InclusaoPagina";
import { InclusaoCoberturaUf, InclusaoMunicipiosCobertura, InclusaoSerieCobertura } from "@/components/energia/InclusaoCobertura";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, num } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { comNomes, dadoNo, dadoTexto } from "@/lib/energia/i18n/conta-inclusao";
import { Nome } from "@/components/i18n/Nome";
import {
  datasMedidas,
  fontesInclusao,
  inteiro,
  linhasHistogramaMunicipios,
  mes,
  mudancaCobertura,
  respostaCobertura,
  rotaPainel,
  vereditoCobertura,
} from "@/lib/energia/inclusao";
import type { InclusaoGold } from "@/lib/energia/tipos-inclusao";
import type { GoldRegulacao } from "@/lib/energia/tipos-regulacao";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/inclusao-energetica/cobertura", {
    title: tx("Cobertura potencial da Tarifa Social (proxy)", "Potential coverage of the Tarifa Social (proxy)"),
    description: tx(
      "Faturas com Tarifa Social por 100 famílias do Cadastro Único com renda por pessoa até meio salário mínimo, por UF e município, com a faixa de sensibilidade ao denominador e a regra de elegibilidade vigente. Proxy declarada, não taxa de cobertura.",
      "Bills with the Tarifa Social (social electricity tariff) per 100 Cadastro Único (federal social registry) families with income per person up to half a minimum wage, by state and municipality, with the sensitivity band to the denominator and the current eligibility rule. A stated proxy, not a coverage rate.",
    ),
    alternates: { canonical: "/setor-eletrico/inclusao-energetica/cobertura" },
  }, anterior);
}

export default function CoberturaPage() {
  const g = lerGold<InclusaoGold>("inclusao.json");
  if (!integra(g)) return <InclusaoIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;
  const regGold = lerGold<GoldRegulacao>("regulacao.json");
  const reg = integra(regGold) ? regGold : null;

  const idioma = idiomaEnergia();
  const FONTE_COB = fontesInclusao().cob;
  const c = g.cobertura;
  const b = c.brasil;
  const mesMapa = g.tarifa_social.mes_mapa ?? g.tarifa_social.mes_referencia;
  const mesCob = b?.mes ?? mesMapa;
  const dist = c.distribuicao_municipal;
  const downloads = (urls: string[]) => g.downloads.filter((d) => urls.includes(d.url)).map((d) => ({ ...d, rotulo: dadoTexto(d.rotulo, idioma) }));
  const evidenciaFaturas = g.tarifa_social.kpis.faturas_cde_mapa?.evidencia ?? null;
  const oQueMudou = mudancaCobertura(c);
  const comoInterpretar = tx(
    <>
      Razão = 100 × faturas com desconto ÷ famílias do Cadastro Único com renda por pessoa até meio salário mínimo, no mesmo mês. O denominador com cadastro atualizado segue o requisito da
      concessão; com todas as cadastradas, a razão cai. As duas formam uma faixa de sensibilidade à definição do denominador. {c.faixa_de_sensibilidade}
    </>,
    <>
      Ratio = 100 × bills with a discount ÷ Cadastro Único families with income per person up to half a minimum wage, in the same month. The denominator with an updated record follows
      the granting requirement; with all registered families, the ratio falls. The two form a sensitivity band to the definition of the denominator.{" "}
      {dadoNo(c.faixa_de_sensibilidade, "faixa-sensibilidade", idioma)}
    </>,
  );
  const naoConcluir = tx(
    <>
      Não é a proporção de famílias elegíveis atendidas e não diz quantas famílias estão fora: fatura não é família, a família pode não ser titular da conta, o numerador inclui quem recebe o
      Benefício de Prestação Continuada (BPC) ou usa equipamento médico (o que permite à razão passar de 100 sem erro de cálculo) e famílias sem ligação à rede contam só no denominador. A pergunta &ldquo;{c.pergunta}&rdquo; não
      tem resposta nesta razão.
    </>,
    <>
      It is not the proportion of eligible families served and does not say how many families are left out: a bill is not a family, the family may not hold the account, the numerator
      includes those who receive the <Nome>Benefício de Prestação Continuada</Nome> (BPC, continuous cash benefit) or use medical equipment (which lets the ratio exceed 100 without a calculation
      error) and families without a grid connection count only in the denominator. The question &ldquo;{dadoTexto(c.pergunta, idioma)}&rdquo; has no answer in this ratio.
    </>,
  );

  return (
    <>
      <header><CabecalhoPlataforma colecao="energia" destinoConta="/setor-eletrico" navegacao="setor-eletrico" idiomas /></header>
      <MarcaVisita secao="energia:inclusao-cobertura" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <InclusaoNavegacao atual="p060" />
        <CabecalhoModulo
          siglas={["UF", "ANEEL", "IBGE", "UC", "SCS"]}
          rotulo={tx("Inclusão energética", "Energy inclusion")}
          titulo={tx("Cobertura potencial da Tarifa Social", "Potential coverage of the Tarifa Social")}
          lead={tx(
            "Faturas com Tarifa Social para cada 100 famílias do Cadastro Único com renda por pessoa até meio salário mínimo. É uma aproximação de cobertura, não uma taxa de famílias atendidas: fatura não é família.",
            "Bills with the Tarifa Social (social electricity tariff) for every 100 Cadastro Único (federal social registry) families with income per person up to half a minimum wage. It is an approximation of coverage, not a rate of families served: a bill is not a family.",
          )}
          recorte={tx(
            `${mes(mesCob)} · ${c.ufs.length} UF e municípios · faturas por 100 famílias`,
            `${mes(mesCob)} · ${c.ufs.length} states and municipalities · bills per 100 families`,
          )}
          fonte={comNomes(
            tx(
              "ANEEL, Beneficiários da Conta de Desenvolvimento Energético (CDE); Ministério do Desenvolvimento e Assistência Social (MDS), Cadastro Único no serviço MI Social",
              "ANEEL, Beneficiários da Conta de Desenvolvimento Energético (beneficiaries of the Energy Development Account, CDE); Ministry of Development and Social Assistance (MDS), Cadastro Único in the MI Social service",
            ),
            idioma,
          )}
          referencia={tx(
            <>
              Faturas com desconto dos arquivos de Beneficiários da CDE de {mes(g.tarifa_social.mes_mapa)}; Cadastro Único, no serviço MI Social, de {mes(b?.mes)}; série nacional com o SCS até{" "}
              {mes(c.serie_mensal_ultimo?.m)}. Regra de elegibilidade conferida em {dataBR(c.regra_elegibilidade.consultado_em)}. Processado em {carimbo(g.gerado_em)}.
            </>,
            <>
              Bills with a discount from the CDE Beneficiaries files of {mes(g.tarifa_social.mes_mapa)}; Cadastro Único, in the MI Social service, of {mes(b?.mes)}; national series with
              the SCS up to {mes(c.serie_mensal_ultimo?.m)}. Eligibility rule checked on {dataBR(c.regra_elegibilidade.consultado_em)}. Processed on {carimbo(g.gerado_em)}.
            </>,
          )}
          datas={<InclusaoDatas itens={datasMedidas(g).filter((d) => d.id === "cde" || d.id === "cadunico" || d.id === "scs")} />}
          metricas={
            <FaixaMetricas
              colunas={4}
              rotulo={tx("Indicadores da cobertura potencial", "Potential coverage indicators")}
              nota={tx(
                "A razão é 100 × faturas ÷ famílias, no mesmo mês. Fatura e família são unidades diferentes e o denominador usa só o critério de renda: é uma proxy, e não a proporção de famílias atendidas.",
                "The ratio is 100 × bills ÷ families, in the same month. Bill and family are different units and the denominator uses only the income criterion: it is a proxy, not the proportion of families served.",
              )}
            >
              <Numero
                variante="faixa"
                rotulo={tx("Faturas por 100 famílias, cadastro atualizado (proxy)", "Bills per 100 families, updated record (proxy)")}
                natureza="CALCULADO"
                evidencia={b?.evidencia ?? null}
                casas={1}
                unidade={tx("por 100 famílias", "per 100 families")}
                cor="var(--cor-energia)"
                motivoAusencia={tx("Sem cruzamento nesta publicação.", "No cross-match in this publication.")}
                endereco={`${rotaPainel("p060")}#p060`}
              />
              <Numero
                variante="faixa"
                rotulo={tx("Faturas por 100 famílias, todas as cadastradas (proxy)", "Bills per 100 families, all registered (proxy)")}
                natureza="CALCULADO"
                valor={b?.razao_cadastradas_pct ?? null}
                casas={1}
                unidade={tx("por 100 famílias", "per 100 families")}
                periodo={b ? mes(b.mes) : undefined}
                cor="var(--serie-referencia)"
                motivoAusencia={tx("Sem cruzamento nesta publicação.", "No cross-match in this publication.")}
              />
              <Numero
                variante="faixa"
                rotulo={tx("Numerador: faturas com desconto (CDE)", "Numerator: bills with a discount (CDE)")}
                natureza="CALCULADO"
                evidencia={evidenciaFaturas}
                casas={0}
                unidade={tx("faturas", "bills")}
                cor="var(--serie-comp-2)"
                motivoAusencia={tx("Nenhum arquivo da CDE com todas as distribuidoras.", "No CDE file with all distribution utilities.")}
                endereco={`${rotaPainel("p059")}#p059`}
              />
              <Numero
                variante="faixa"
                rotulo={tx("Denominador: famílias até ½ salário mínimo, cadastro atualizado", "Denominator: families up to ½ minimum wage, updated record")}
                natureza="CALCULADO"
                valor={b?.familias_atualizadas ?? null}
                casas={0}
                unidade={tx("famílias", "families")}
                periodo={b ? mes(b.mes) : undefined}
                cor="var(--serie-comp-3)"
                nota={
                  b
                    ? tx(
                        `Com todas as famílias cadastradas nessa renda, o denominador é ${inteiro(b.familias_cadastradas)}.`,
                        `With all families registered at this income, the denominator is ${inteiro(b.familias_cadastradas)}.`,
                      )
                    : undefined
                }
                motivoAusencia={tx("Sem cruzamento nesta publicação.", "No cross-match in this publication.")}
              />
            </FaixaMetricas>
          }
        />
        <ModoProfundidade>
          <Bloco id="cobertura">
            <PainelEvidencia
              id="p060"
              pergunta={tx("Faturas por 100 famílias do Cadastro Único, UF a UF", "Bills per 100 Cadastro Único families, state by state")}
              subtitulo={tx(
                "Numerador: faturas com Tarifa Social · denominador: famílias do Cadastro Único até ½ salário mínimo · proxy",
                "Numerator: bills with Tarifa Social · denominator: Cadastro Único families up to ½ minimum wage · proxy",
              )}
              natureza="CALCULADO"
              porQueImporta={tx(
                <>
                  Comparar quem recebe o desconto da <Termo slug="tarifa-social">Tarifa Social</Termo> com as famílias que o critério de renda alcança mostra onde o benefício pode estar abaixo ou acima do
                  que o cadastro sugere. Como as bases públicas contam coisas diferentes, a comparação só pode ser uma proxy, e é publicada como tal.
                </>,
                <>
                  Comparing who receives the <Termo slug="tarifa-social">Tarifa Social</Termo> discount with the families the income criterion reaches shows where the benefit may be below
                  or above what the registry suggests. As the public databases count different things, the comparison can only be a proxy, and it is published as such.
                </>,
              )}
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={c.proveniencia.cobertura}
            >
              <div className="space-y-6">
                <p className="inline-flex items-center gap-2 border border-carvao px-3 py-1 text-sm text-carvao">
                  <span className="rotulo">{tx("Proxy", "Proxy")}</span>
                  <span>{tx("medida indireta, com denominador elegível só pelo critério de renda", "indirect measure, with a denominator eligible only by the income criterion")}</span>
                </p>
                <InclusaoCoberturaUf
                  ufs={c.ufs}
                  mes={mesCob}
                  fonte={FONTE_COB}
                  resposta={
                    <RespostaCurta id="p060" veredito={vereditoCobertura(c, idioma)}>
                      {comNomes(respostaCobertura(c, idioma), idioma)}
                    </RespostaCurta>
                  }
                  recorte={
                    <InclusaoRecorte
                      periodo={tx(
                        <>
                          Mapa e UF em {mes(b?.mes)}; série nacional de {c.serie_mensal_meses} meses até {mes(c.serie_mensal_ultimo?.m)}
                        </>,
                        <>
                          Map and states in {mes(b?.mes)}; national series of {c.serie_mensal_meses} months up to {mes(c.serie_mensal_ultimo?.m)}
                        </>,
                      )}
                      universo={tx(
                        <>
                          {c.ufs.length} UF; {dist ? `${inteiro(dist.municipios)} municípios na distribuição (${dist.base_pequena_excluidos} fora por base pequena)` : "municípios sem dado"}
                        </>,
                        <>
                          {c.ufs.length} states;{" "}
                          {dist ? `${inteiro(dist.municipios)} municipalities in the distribution (${dist.base_pequena_excluidos} excluded for a small base)` : "municipalities with no data"}
                        </>,
                      )}
                      unidade={tx("faturas (ou UC na série do SCS) por 100 famílias", "bills (or consumer units in the SCS series) per 100 families")}
                    />
                  }
                  notas={<NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />}
                />

                {b && (
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    {tx("As famílias cadastradas de cada município estão no", "The registered families of each municipality are in the")}{" "}
                    <a href="/energia/series/inclusao_municipios.csv" download className="text-energia-dark underline underline-offset-4 hover:text-carvao">
                      {tx("arquivo de municípios (CSV)", "municipalities file (CSV)")}
                    </a>
                    {tx(
                      `, que soma o total nacional de ${inteiro(b.familias_cadastradas)} famílias.`,
                      `, which adds up to the national total of ${inteiro(b.familias_cadastradas)} families.`,
                    )}
                  </p>
                )}

                {dist && (
                  <SecaoDoPainel id="municipios-distribuicao" titulo={tx("Como a razão se distribui entre os municípios?", "How is the ratio distributed across municipalities?")}>
                    <GraficoBarras
                      titulo={tx(
                        `Municípios por faixa de faturas por 100 famílias atualizadas, ${mes(b?.mes)}`,
                        `Municipalities by band of bills per 100 updated families, ${mes(b?.mes)}`,
                      )}
                      dados={linhasHistogramaMunicipios(dist, idioma)}
                      chaveCategoria="id"
                      chaveRotulo="faixa"
                      series={[{ id: "municipios", rotulo: tx("Municípios", "Municipalities"), cor: "var(--cor-energia)" }]} // i18n: dado
                      unidade={tx("municípios", "municipalities")}
                      casas={0}
                      rotulosValor
                      altura={280}
                    />
                    <p className="max-w-prose2 text-sm text-carvao-muted">
                      {tx(
                        <>
                          Faixas de larguras diferentes (a primeira vai de {num(dist.histograma[0]?.de, 0)} a {num(dist.histograma[0]?.ate, 0)}). Quantis: P10 {num(dist.quantis.p10, 1)}, P25{" "}
                          {num(dist.quantis.p25, 1)}, mediana {num(dist.quantis.p50, 1)}, P75 {num(dist.quantis.p75, 1)}, P90 {num(dist.quantis.p90, 1)}. {inteiro(dist.base_pequena_excluidos)} municípios
                          ficam fora por base pequena; {inteiro(dist.acima_de_100)} passam de 100.
                        </>,
                        <>
                          Bands of different widths (the first runs from {num(dist.histograma[0]?.de, 0)} to {num(dist.histograma[0]?.ate, 0)}). Quantiles: P10 {num(dist.quantis.p10, 1)}, P25{" "}
                          {num(dist.quantis.p25, 1)}, median {num(dist.quantis.p50, 1)}, P75 {num(dist.quantis.p75, 1)}, P90 {num(dist.quantis.p90, 1)}. {inteiro(dist.base_pequena_excluidos)}{" "}
                          municipalities are excluded for a small base; {inteiro(dist.acima_de_100)} exceed 100.
                        </>,
                      )}
                    </p>
                  </SecaoDoPainel>
                )}

                <SecaoDoPainel
                  id="serie"
                  titulo={tx("A razão ao longo do tempo (numerador do SCS, meses completos)", "The ratio over time (SCS numerator, complete months)")}
                  lead={tx(
                    `Série com UC do SCS no numerador; o ponto de ${mes(b?.mes)} acima usa faturas da CDE. Meses incompletos do SCS ficam fora da série.`,
                    `Series with SCS consumer units in the numerator; the ${mes(b?.mes)} point above uses CDE bills. Incomplete SCS months are left out of the series.`,
                  )}
                >
                  <InclusaoSerieCobertura url={c.serie_mensal_json} unidade={tx("UC por 100 famílias", "consumer units per 100 families")} />
                </SecaoDoPainel>

                <SecaoDoPainel id="municipios" nivel="analisar" titulo={tx("Por município", "By municipality")}>
                  <InclusaoMunicipiosCobertura csvUrl="/energia/series/inclusao_municipios.csv" mes={mesCob} fonte={FONTE_COB} />
                </SecaoDoPainel>

                <SecaoDoPainel
                  id="regra-elegibilidade"
                  nivel="auditar" // i18n: dado
                  titulo={tx("Regra de elegibilidade e por que a medida é proxy", "Eligibility rule and why the measure is a proxy")}
                >
                  <p className="text-sm text-carvao-muted">
                    {tx(`Conferida em ${dataBR(c.regra_elegibilidade.consultado_em)} na página da ANEEL (`, `Checked on ${dataBR(c.regra_elegibilidade.consultado_em)} on ANEEL's page (`)}
                    <a href={c.regra_elegibilidade.fonte} className="break-all text-energia-dark underline underline-offset-4">
                      {c.regra_elegibilidade.fonte}
                    </a>
                    {tx("). Base legal: ", "). Legal basis: ")}
                    {dadoNo(c.regra_elegibilidade.base_legal, "base-legal-elegibilidade", idioma)}
                    <InclusaoBaseLegal reg={reg} className="mt-2" />
                  </p>
                  <ul className="space-y-1 text-sm text-carvao">
                    {c.regra_elegibilidade.criterios.map((cr) => (
                      <li key={cr.id}>
                        <strong className="font-medium">{tx(`Critério ${cr.id}`, `Criterion ${cr.id}`)}</strong> (
                        {cr.no_denominador ? tx("no denominador", "in the denominator") : tx("fora do denominador", "outside the denominator")}):{" "}
                        {dadoNo(cr.texto, "criterio-elegibilidade", idioma)}
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm text-carvao-muted">
                    {tx("Requisitos: ", "Requirements: ")}
                    {tx(
                      c.regra_elegibilidade.requisitos.join(" "),
                      c.regra_elegibilidade.requisitos.map((r) => dadoTexto(r, idioma)).join(" "),
                    )}
                  </p>
                  <p className="text-sm text-carvao-muted">
                    {tx("Vigência: ", "In force: ")}
                    {dadoNo(c.regra_elegibilidade.vigencia, "vigencia-elegibilidade", idioma)}
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-carvao-muted">
                    {c.regra_elegibilidade.por_que_proxy.map((x) => (
                      <li key={x}>{dadoNo(x, "por-que-proxy", idioma)}</li>
                    ))}
                  </ul>
                </SecaoDoPainel>

                <InclusaoSeguir
                  ancora="p060"
                  proximo={{ href: rotaPainel("p061"), pergunta: dadoTexto(g.orcamento.pergunta, idioma) }}
                  downloads={downloads(["/energia/series/inclusao_municipios.csv", "/energia/series/inclusao_cobertura_mensal.csv"])}
                />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
