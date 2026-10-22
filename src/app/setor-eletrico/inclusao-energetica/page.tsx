import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import Link from "@/components/i18n/LinkIdioma";
import type { ReactNode } from "react";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { InclusaoCapitulos, InclusaoDatas, InclusaoIndisponivel, InclusaoRecorte, InclusaoSeguir } from "@/components/energia/InclusaoPagina";
import { OrcamentoComoInterpretar, OrcamentoNaoConcluir, OrcamentoPorQueImporta, TarifaSocialRegraVigente } from "@/components/energia/InclusaoTextos";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { comNomes, dadoTexto } from "@/lib/energia/i18n/conta-inclusao";
import { Nome } from "@/components/i18n/Nome";
import {
  codigoUf,
  dadosClassesPof,
  datasMedidas,
  destaquesRendaPof,
  inteiro,
  mes,
  mudancaOrcamento,
  nomePof,
  numTexto,
  orcamentoBase,
  periodoPof,
  respostaAcesso,
  respostaCobertura,
  respostaOrcamento,
  respostaTarifaSocial,
  rotaPainel,
  textoPofHistorica,
  vereditoAcesso,
  vereditoCobertura,
  vereditoOrcamento,
  vereditoTarifaSocial,
} from "@/lib/energia/inclusao";
import type { InclusaoGold } from "@/lib/energia/tipos-inclusao";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/inclusao-energetica", {
    title: tx("Inclusão energética: Tarifa Social, cobertura, orçamento e acesso", "Energy inclusion: Tarifa Social, coverage, budget and access"),
    description: tx(
      "Síntese da inclusão energética: peso da energia no orçamento das famílias por faixa de renda (POF 2017-2018), Tarifa Social (ANEEL, SCS e Beneficiários da CDE), cobertura potencial contra o Cadastro Único (proxy declarada) e acesso à energia, sistemas isolados e Luz para Todos, cada medida com a sua unidade e a sua data.",
      "Energy inclusion overview: weight of energy in family budgets by income bracket (POF 2017-2018, IBGE household budget survey), Tarifa Social (social electricity tariff; ANEEL, SCS and CDE Beneficiaries), potential coverage against the Cadastro Único (federal social registry; stated proxy) and access to energy, isolated systems and Luz para Todos (rural electrification program), each measure with its own unit and date.",
    ),
    alternates: { canonical: "/setor-eletrico/inclusao-energetica" },
  }, anterior);
}

/**
 * Síntese da Inclusão energética. A pergunta é social: para quem a energia pesa mais. A figura principal é a despesa com energia por
 * faixa de renda, com a idade da pesquisa dita junto do valor. Benefício e acesso vêm depois, cada medida com a unidade, a data e a
 * fonte próprias (UC do SCS, faturas da CDE, famílias do Cadastro Único, domicílios da PNAD, pessoas do PASI): nenhuma data genérica
 * vale para todas. A definição de cada unidade fica junto da medida que a usa. As quatro respostas curtas, os números com a sua
 * ficha de prova e os links para os painéis completos continuam, e os arquivos do módulo ficam no rodapé.
 */

/** Rótulo de linha do "O que não é possível concluir" de cada bloco, com a mesma forma das notas do painel principal. */
function Limite({ children }: { children: ReactNode }) {
  return (
    <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
      <span className="rotulo mr-2 text-mineral">{tx("O que não é possível concluir", "What cannot be concluded")}</span>
      {children}
    </p>
  );
}

export default function InclusaoEnergeticaPage() {
  const g = lerGold<InclusaoGold>("inclusao.json");
  if (!integra(g)) return <InclusaoIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const idioma = idiomaEnergia();
  const semDado = tx("sem dado", "no data");
  const t = g.tarifa_social;
  const c = g.cobertura;
  const o = g.orcamento;
  const a = g.acesso;
  const si = a.sistemas_isolados;
  const lpt = a.universalizacao.luz_para_todos;
  const geracaoScs = t.diagnostico_scs?.data_geracao.at(-1) ?? null;
  const mesMapa = t.mes_mapa ?? t.mes_referencia;
  const k = t.kpis;
  const periodo = periodoPof(o);
  const anoPublicacao = g.gerado_em.slice(0, 4);
  const baseClasses = orcamentoBase(o, (l) => !codigoUf(l.territorio));
  const destaques = destaquesRendaPof(baseClasses);
  const periodoMedidas = `POF ${periodo}`;
  const pofTotal = o.linhas.find((l) => l.territorio === "BR" && l.classe === "7999");
  const oQueMudou = mudancaOrcamento(o);
  const comoInterpretar = <OrcamentoComoInterpretar o={o} />;
  const naoConcluir = <OrcamentoNaoConcluir o={o} anoPublicacao={anoPublicacao} />;
  const brPnad = a.pnad_serie.find((l) => l.territorio === "BR" && l.ano === a.ano_referencia && l.situacao === "total");
  const familiasAtualizadas = c.brasil?.familias_atualizadas ?? null;

  return (
    <>
      <header><CabecalhoPlataforma colecao="energia" destinoConta="/setor-eletrico" navegacao="setor-eletrico" idiomas /></header>
      <MarcaVisita secao="energia:inclusao-energetica" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          siglas={["IBGE", "ANEEL", "UF", "SIDRA", "DMR", "EPE", "MME", "SIN"]}
          titulo={tx("Para quem a energia pesa mais?", "For whom does energy weigh the most?")}
          lead={tx(
            "Quanto a energia elétrica pesa na despesa das famílias de cada faixa de renda (Pesquisa de Orçamentos Familiares, POF 2017-2018), e o que a Tarifa Social e o acesso à energia medem.",
            "How much electricity weighs in the expense of families in each income bracket (IBGE's Household Budget Survey, POF 2017-2018), and what the Tarifa Social (social electricity tariff) and access to energy measure.",
          )}
          recorte={tx(
            `${periodoMedidas} · Brasil, famílias por faixa de renda · % da despesa total`,
            `${periodoMedidas} · Brazil, families by income bracket · % of total expense`,
          )}
          fonte={tx(
            "IBGE, POF 2017-2018 e Pesquisa Nacional por Amostra de Domicílios (PNAD) Contínua; ANEEL, Tarifa Social",
            "IBGE, POF 2017-2018 and Continuous National Household Sample Survey (Continuous PNAD); ANEEL, Tarifa Social",
          )}
          referencia={tx(
            <>
              SCS da ANEEL até {mes(g.referencias.scs_ultimo_mes_no_arquivo)} (arquivo gerado pela fonte em {dataBR(geracaoScs)}); Beneficiários da CDE até {mes(g.referencias.cde_mes_mais_recente)}; Cadastro Único,
              do Ministério do Desenvolvimento e Assistência Social (MDS), de {mes(c.brasil?.mes)}; {nomePof(o)}; PNAD Contínua {a.ano_referencia}; ciclo {si?.ciclo ?? "sem dado"} do Portal de Acompanhamento e
              Informações dos Sistemas Isolados (PASI), da EPE; Luz para Todos, do MME, até {mes(lpt?.ultimo_mes)}. Processado em {carimbo(g.gerado_em)}.
            </>,
            <>
              ANEEL&rsquo;s SCS up to {mes(g.referencias.scs_ultimo_mes_no_arquivo)} (file generated by the source on {dataBR(geracaoScs)}); CDE Beneficiaries up to{" "}
              {mes(g.referencias.cde_mes_mais_recente)}; Cadastro Único, from the Ministry of Development and Social Assistance (MDS), of {mes(c.brasil?.mes)}; {nomePof(o)}; Continuous PNAD{" "}
              {a.ano_referencia}; cycle {si?.ciclo ?? semDado} of EPE&rsquo;s <Nome>Portal de Acompanhamento e Informações dos Sistemas Isolados</Nome> (PASI, isolated systems portal); Luz para Todos,
              from the MME, up to {mes(lpt?.ultimo_mes)}. Processed on {carimbo(g.gerado_em)}.
            </>,
          )}
          datas={<InclusaoDatas itens={datasMedidas(g)} />}
          metricas={
            <FaixaMetricas colunas={3} rotulo={tx("Peso da energia na despesa das famílias", "Weight of energy in family expense")} nota={textoPofHistorica(o, anoPublicacao)}>
              <Numero
                variante="faixa"
                rotulo={tx("Energia na despesa total, todas as famílias", "Energy in total expense, all families")}
                natureza="ESTIMADO"
                evidencia={o.evidencias.razao_medias_brasil}
                formato="pct"
                casas={1}
                unidade={tx("da despesa total", "of total expense")}
                periodo={periodoMedidas}
                cor="var(--cor-energia)"
                endereco={`${rotaPainel("p061")}#p061`}
              />
              {destaques.baixa && (
                <Numero
                  variante="faixa"
                  rotulo={tx("Energia na despesa total, menor faixa de renda", "Energy in total expense, lowest income bracket")}
                  natureza="ESTIMADO"
                  valor={destaques.baixa.valor}
                  formato="pct"
                  casas={1}
                  unidade={tx("da despesa total", "of total expense")}
                  recorte={dadoTexto(destaques.baixa.rotulo, idioma)}
                  periodo={periodoMedidas}
                  motivoAusencia={tx("Estimativa suprimida pela precisão.", "Estimate suppressed due to precision.")}
                />
              )}
              {destaques.alta && (
                <Numero
                  variante="faixa"
                  rotulo={tx("Energia na despesa total, maior faixa de renda", "Energy in total expense, highest income bracket")}
                  natureza="ESTIMADO"
                  valor={destaques.alta.valor}
                  formato="pct"
                  casas={1}
                  unidade={tx("da despesa total", "of total expense")}
                  recorte={dadoTexto(destaques.alta.rotulo, idioma)}
                  periodo={periodoMedidas}
                  motivoAusencia={tx("Estimativa suprimida pela precisão.", "Estimate suppressed due to precision.")}
                />
              )}
            </FaixaMetricas>
          }
        >
          {tx(
            <>
              Quatro perguntas, cada uma com a sua fonte e a sua unidade: para quem a conta de luz pesa mais no orçamento, quanto a Tarifa Social alcança, quantas faturas há para cada 100 famílias
              do Cadastro Único (uma proxy) e quem ainda não tem acesso adequado. Os números são agregados: nenhum beneficiário individual aparece aqui.
            </>,
            <>
              Four questions, each with its own source and unit: for whom the electricity bill weighs most in the budget, how far the Tarifa Social reaches, how many bills there are for every
              100 Cadastro Único families (a proxy) and who still lacks adequate access. The figures are aggregated: no individual beneficiary appears here.
            </>,
          )}
        </CabecalhoModulo>

        <ModoProfundidade>
          <PainelEvidencia
            id="sintese-p061"
            pergunta={tx("Quanto da despesa vai para a energia, em cada faixa de renda?", "How much of the expense goes to energy, in each income bracket?")}
            subtitulo={tx(
              `Energia elétrica na despesa total das famílias, por faixa de renda · ${nomePof(o)}, ${periodo} · razão de médias`,
              `Electricity in families' total expense, by income bracket · ${nomePof(o)}, ${periodo} · ratio of averages`,
            )}
            natureza="ESTIMADO"
            porQueImporta={<OrcamentoPorQueImporta />}
            oQueMudou={oQueMudou}
            comoInterpretar={comoInterpretar}
            naoConcluir={naoConcluir}
            naoConcluirNoCorpo
            proveniencia={o.proveniencia.microdados}
            complementares={[{ rotulo: tx("Tabela 6715 (SIDRA)", "Table 6715 (SIDRA)"), p: o.proveniencia.sidra }]}
          >
            <div className="space-y-6">
              <div>
                <RespostaCurta id="p061" veredito={vereditoOrcamento(o)}>
                  {comNomes(respostaOrcamento(o), idioma)}
                </RespostaCurta>
              </div>
              <GraficoBarras
                titulo={tx(
                  `Energia elétrica na despesa total das famílias, por faixa de renda, Brasil (${nomePof(baseClasses)})`,
                  `Electricity in families' total expense, by income bracket, Brazil (${nomePof(baseClasses)})`,
                )}
                dados={dadosClassesPof(baseClasses, "BR", "despesa")}
                chaveCategoria="id"
                chaveRotulo="rotulo"
                series={[{ id: "razao_medias_pct", rotulo: tx("Razão de médias", "Ratio of averages"), cor: "var(--cor-energia)" }]} // i18n: dado
                unidade="%"
                casas={1}
                orientacao="horizontal"
                rotulosValor
                referencias={
                  destaques.total !== null ? [{ valor: destaques.total, rotulo: tx("Razão de médias, todas as famílias (Brasil)", "Ratio of averages, all families (Brazil)") }] : []
                }
              />
              <InclusaoRecorte
                periodo={`${periodo}; ${dadoTexto(o.referencia, idioma)}`}
                universo={tx(
                  <>
                    {inteiro(pofTotal?.n_amostra)} famílias na amostra, que representam {inteiro(pofTotal?.familias)} famílias; Brasil, faixas de renda
                  </>,
                  <>
                    {inteiro(pofTotal?.n_amostra)} families in the sample, representing {inteiro(pofTotal?.familias)} families; Brazil, income brackets
                  </>,
                )}
                unidade={tx(
                  "% da despesa total, razão de médias; faixas em reais da data de referência da pesquisa",
                  "% of total expense, ratio of averages; brackets in reais at the survey's reference date",
                )}
              />
              <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />
              <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                {tx(
                  `Por região, por limiar de ${o.limiares_pct.map((x) => `${x.toLocaleString("pt-BR")}%`).join(", ")} da renda e da despesa e por UF, no`,
                  `By region, by threshold of ${o.limiares_pct.map((x) => `${x.toLocaleString("en-US")}%`).join(", ")} of income and expense and by state, in the`,
                )}{" "}
                <Link href={rotaPainel("p061")} className="text-energia-dark underline underline-offset-4 hover:text-carvao">
                  {tx("painel completo de orçamento", "full budget panel")}
                </Link>
                .
              </p>
            </div>
          </PainelEvidencia>

          <section id="beneficio-e-acesso" aria-labelledby="beneficio-e-acesso-titulo" className="scroll-mt-28 space-y-6 border-t border-linha pt-6">
            <header>
              <h2 id="beneficio-e-acesso-titulo" className="ed-h2 font-serif text-carvao">
                {tx("Benefício e acesso, cada medida na sua unidade e na sua data", "Benefit and access, each measure in its own unit and date")}
              </h2>
              <p className="mt-2 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                {tx(
                  "Unidade consumidora, fatura, família, domicílio e pessoa não se somam nem se substituem: cada fonte conta uma delas e tem o seu calendário.",
                  "Consumer unit, bill, family, household and person do not add up or replace each other: each source counts one of them and has its own calendar.",
                )}
              </p>
            </header>

            <SecaoDoPainel
              id="sintese-p059"
              titulo={dadoTexto(t.pergunta, idioma)}
              lead={comNomes(
                tx(
                  "A Tarifa Social é um desconto na conta de luz de famílias de baixa renda e de quem recebe o Benefício de Prestação Continuada (BPC).",
                  "The Tarifa Social is a discount on the electricity bill of low-income families and of those who receive the Benefício de Prestação Continuada (BPC, continuous cash benefit).",
                ),
                idioma,
              )}
            >
              <div>
                <RespostaCurta id="p059" veredito={vereditoTarifaSocial(t)}>
                  {comNomes(respostaTarifaSocial(t), idioma)}
                </RespostaCurta>
              </div>
              <FaixaMetricas colunas={2} rotulo={tx("Tarifa Social: unidades consumidoras e faturas", "Tarifa Social: consumer units and bills")}>
                <Numero
                  variante="faixa"
                  rotulo={tx("UC com Tarifa Social (SCS)", "Consumer units with Tarifa Social (SCS)")}
                  natureza="OBSERVADO"
                  evidencia={k.uc_tsee.evidencia}
                  casas={0}
                  unidade={tx("UC", "consumer units")}
                  cor="var(--cor-energia)"
                  nota={tx(
                    <>
                      UC, unidade consumidora: o ponto de ligação com conta própria. É a unidade do Sistema de Controle de Subvenções e Programas Sociais (SCS), em que a distribuidora pede o reembolso do desconto. {t.distribuidoras.length} distribuidoras;
                      último mês completo do SCS.
                    </>,
                    <>
                      Consumer unit (UC): the connection point with its own account. It is the unit of the <Nome>Sistema de Controle de Subvenções e Programas Sociais</Nome> (SCS, subsidy and social program
                      control system), in which the distribution utility requests reimbursement of the discount. {t.distribuidoras.length} distribution utilities; latest complete SCS month.
                    </>,
                  )}
                  endereco={`${rotaPainel("p059")}#p059`}
                />
                <Numero
                  variante="faixa"
                  rotulo={tx("Faturas com desconto (Beneficiários da CDE)", "Bills with a discount (CDE Beneficiaries)")}
                  natureza="CALCULADO"
                  evidencia={k.faturas_cde_mapa?.evidencia ?? null}
                  casas={0}
                  unidade={tx("faturas", "bills")}
                  cor="var(--serie-referencia)"
                  motivoAusencia={tx("Nenhum arquivo da CDE com todas as distribuidoras.", "No CDE file with all distribution utilities.")}
                  nota={tx(
                    "Fatura: cada conta emitida com desconto no mês. É a unidade dos arquivos de Beneficiários da Conta de Desenvolvimento Energético (CDE); uma UC pode ter mais de uma fatura no arquivo.",
                    "Bill: each account issued with a discount in the month. It is the unit of the beneficiaries files of the Energy Development Account (CDE); a consumer unit may have more than one bill in the file.",
                  )}
                  endereco={`${rotaPainel("p059")}#p059`}
                />
              </FaixaMetricas>
              <TarifaSocialRegraVigente t={t} />
              <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                {tx(
                  <>
                    SCS de {mes(t.serie_mensal[0]?.m)} a {mes(t.serie_mensal.at(-1)?.m)}, em UC; arquivos da CDE até {mes(g.referencias.cde_mes_mais_recente)}, em faturas, com o último mês completo em{" "}
                    {mes(mesMapa)}.
                  </>,
                  <>
                    SCS from {mes(t.serie_mensal[0]?.m)} to {mes(t.serie_mensal.at(-1)?.m)}, in consumer units; CDE files up to {mes(g.referencias.cde_mes_mais_recente)}, in bills, with the
                    latest complete month in {mes(mesMapa)}.
                  </>,
                )}
              </p>
              <Limite>
                {tx(
                  "número de famílias ou de pessoas beneficiadas: UC e fatura são unidades da conta, e a DMR não é o desconto de cada família.",
                  "the number of families or people benefited: consumer units and bills are units of the electricity account, and the DMR is not each family's discount.",
                )}
              </Limite>
            </SecaoDoPainel>

            <SecaoDoPainel id="sintese-p060" titulo={tx("Faturas por 100 famílias do Cadastro Único: o que a proxy mede", "Bills per 100 Cadastro Único families: what the proxy measures")}>
              <p className="inline-flex items-center gap-2 border border-carvao px-3 py-1 text-sm text-carvao">
                <span className="rotulo">{tx("Proxy", "Proxy")}</span>
                <span>{tx("medida indireta, com denominador elegível só pelo critério de renda", "indirect measure, with a denominator eligible only by the income criterion")}</span>
              </p>
              <div>
                <RespostaCurta id="p060" veredito={vereditoCobertura(c)}>
                  {comNomes(respostaCobertura(c), idioma)}
                </RespostaCurta>
              </div>
              <FaixaMetricas colunas={2} rotulo={tx("Cobertura potencial da Tarifa Social (proxy)", "Potential coverage of the Tarifa Social (proxy)")}>
                <Numero
                  variante="faixa"
                  rotulo={tx("Faturas por 100 famílias do Cadastro Único (proxy)", "Bills per 100 Cadastro Único families (proxy)")}
                  natureza="CALCULADO"
                  evidencia={c.brasil?.evidencia ?? null}
                  casas={1}
                  unidade={tx("faturas por 100 famílias", "bills per 100 families")}
                  cor="var(--serie-comp-2)"
                  motivoAusencia={tx("Sem cruzamento entre faturas e Cadastro Único nesta publicação.", "No cross-match between bills and the Cadastro Único in this publication.")}
                  nota={tx(
                    <>
                      Denominador: famílias do Cadastro Único com renda por pessoa até meio salário mínimo e cadastro atualizado ({inteiro(familiasAtualizadas)} em {mes(c.brasil?.mes)}). Família é a
                      unidade do Cadastro Único e da POF; pode não ser a titular da conta de luz da casa em que mora.
                    </>,
                    <>
                      Denominator: Cadastro Único families with income per person up to half a minimum wage and an updated record ({inteiro(familiasAtualizadas)} in {mes(c.brasil?.mes)}). The
                      family is the unit of the Cadastro Único and of the POF; it may not hold the electricity bill of the home where it lives.
                    </>,
                  )}
                  endereco={`${rotaPainel("p060")}#p060`}
                />
              </FaixaMetricas>
              <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                {tx(
                  <>
                    Faturas da CDE e famílias do Cadastro Único com renda por pessoa até meio salário mínimo, no mesmo mês ({mes(c.brasil?.mes)}), por UF e município. Com todas as famílias
                    cadastradas nessa renda, a razão é {numTexto(c.brasil?.razao_cadastradas_pct, 1)}.
                  </>,
                  <>
                    CDE bills and Cadastro Único families with income per person up to half a minimum wage, in the same month ({mes(c.brasil?.mes)}), by state and municipality. With all
                    families registered at this income, the ratio is {numTexto(c.brasil?.razao_cadastradas_pct, 1)}.
                  </>,
                )}
              </p>
              <Limite>
                {tx(
                  <>a resposta à pergunta “{c.pergunta}”: a razão não conta famílias fora do benefício; fatura não é família, e o numerador inclui critérios que o denominador não tem.</>,
                  <>
                    the answer to the question &ldquo;{dadoTexto(c.pergunta, idioma)}&rdquo;: the ratio does not count families outside the benefit; a bill is not a family, and the
                    numerator includes criteria the denominator does not have.
                  </>,
                )}
              </Limite>
            </SecaoDoPainel>

            <SecaoDoPainel id="sintese-p062" titulo={dadoTexto(a.pergunta, idioma)}>
              <div>
                <RespostaCurta id="p062" veredito={vereditoAcesso(a)}>
                  {comNomes(respostaAcesso(a), idioma)}
                </RespostaCurta>
              </div>
              <FaixaMetricas colunas={3} rotulo={tx("Acesso à energia, sistemas isolados e Luz para Todos", "Access to energy, isolated systems and Luz para Todos")}>
                <Numero
                  variante="faixa"
                  rotulo={tx("Domicílios sem energia elétrica de nenhuma fonte (PNAD Contínua)", "Households without electricity from any source (Continuous PNAD)")}
                  natureza="ESTIMADO"
                  evidencia={a.evidencia_sem_energia}
                  casas={0}
                  unidade={tx("mil domicílios", "thousand households")}
                  cor="var(--cor-energia)"
                  motivoAusencia={tx("Sem estimativa da PNAD nesta publicação.", "No PNAD estimate in this publication.")}
                  nota={tx(
                    <>
                      Domicílio: a unidade da PNAD Contínua e do Luz para Todos, a moradia, com ou sem ligação à rede.
                      {brPnad ? ` Entre os ligados à rede geral, ${numTexto(brPnad.pct_integral_entre_rede, 1)}% têm fornecimento em tempo integral.` : ""}
                    </>,
                    <>
                      Household: the unit of the Continuous PNAD and of Luz para Todos, the dwelling, with or without a grid connection.
                      {brPnad ? ` Among those connected to the general grid, ${numTexto(brPnad.pct_integral_entre_rede, 1)}% have full-time supply.` : ""}
                    </>,
                  )}
                  endereco={`${rotaPainel("p062")}#p062`}
                />
                <Numero
                  variante="faixa"
                  rotulo={tx(`Pessoas em localidades isoladas (ciclo ${si?.ciclo ?? "sem dado"})`, `People in isolated localities (cycle ${si?.ciclo ?? semDado})`)}
                  natureza="OBSERVADO"
                  evidencia={si?.evidencia_populacao ?? null}
                  casas={0}
                  unidade={tx("pessoas", "people")}
                  cor="var(--serie-termica)"
                  motivoAusencia={tx("PASI não processado nesta publicação.", "PASI not processed in this publication.")}
                  nota={comNomes(
                    tx(
                      "Pessoa: a população das localidades isoladas, informada pelas distribuidoras ao Portal de Acompanhamento e Informações dos Sistemas Isolados (PASI), da EPE.",
                      "Person: the population of the isolated localities, reported by the distribution utilities to EPE's Portal de Acompanhamento e Informações dos Sistemas Isolados (PASI, isolated systems portal).",
                    ),
                    idioma,
                  )}
                  endereco={`${rotaPainel("p062")}#p062`}
                />
                <Numero
                  variante="faixa"
                  rotulo={tx("Domicílios atendidos pelo Luz para Todos (MME)", "Households served by Luz para Todos (MME)")}
                  natureza="OBSERVADO"
                  evidencia={lpt?.evidencia_total ?? null}
                  casas={0}
                  unidade={tx("domicílios", "households")}
                  cor="var(--serie-referencia)"
                  motivoAusencia={tx("Arquivo do MME não processado nesta publicação.", "MME file not processed in this publication.")}
                  nota={tx(
                    "Ligações feitas pelo programa, não pessoas nem UC com benefício; ligação feita não mede a qualidade do fornecimento depois dela.",
                    "Connections made by the program, not people or consumer units with a benefit; a connection made does not measure the quality of supply after it.",
                  )}
                  endereco={`${rotaPainel("p062")}#p062`}
                />
              </FaixaMetricas>
              <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                {tx(
                  `PNAD Contínua de ${a.pnad_serie[0]?.ano} a ${a.ano_referencia}; PASI ciclo ${si?.ciclo ?? "sem dado"}; Luz para Todos até ${mes(lpt?.ultimo_mes)}.`,
                  `Continuous PNAD from ${a.pnad_serie[0]?.ano} to ${a.ano_referencia}; PASI cycle ${si?.ciclo ?? semDado}; Luz para Todos up to ${mes(lpt?.ultimo_mes)}.`,
                )}
              </p>
              <Limite>
                {tx(
                  "qualidade do serviço a partir da ligação feita; e a carga do SIN não mede acesso: os sistemas isolados ficam fora dela.",
                  "the quality of service from the connection made; and the SIN load does not measure access: isolated systems are outside it.",
                )}
              </Limite>
            </SecaoDoPainel>
          </section>

          <InclusaoCapitulos />

          <InclusaoSeguir
            ancora="sintese-p061"
            downloads={g.downloads.map((d) => ({ ...d, rotulo: dadoTexto(d.rotulo, idioma) }))}
            extra={
              <p className="max-w-prose2 pb-2 text-xs leading-relaxed text-carvao-muted">
                {tx(
                  "Arquivos do módulo: CSV com ponto e vírgula, ponto decimal e campo vazio para ausência; os JSON são lidos pelos gráficos sob demanda.",
                  "Module files: CSV with semicolons, decimal point and an empty field for missing values; the JSON files are read by the charts on demand.",
                )}
              </p>
            }
          />
        </ModoProfundidade>
      </main>
    </>
  );
}
