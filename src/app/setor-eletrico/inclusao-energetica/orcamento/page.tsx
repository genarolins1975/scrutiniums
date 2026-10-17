import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { InclusaoIndisponivel, InclusaoNavegacao, InclusaoRecorte, InclusaoSeguir } from "@/components/energia/InclusaoPagina";
import { InclusaoOrcamentoPainel } from "@/components/energia/InclusaoOrcamento";
import { InclusaoPorBasePof } from "@/components/energia/InclusaoPorEstado";
import { OrcamentoComoInterpretar, OrcamentoFaixa, OrcamentoNaoConcluir, OrcamentoPorQueImporta, OrcamentoResposta } from "@/components/energia/InclusaoTextos";
import { Numero } from "@/components/energia/Numero";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, num } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { dadoNo, dadoTexto } from "@/lib/energia/i18n/conta-inclusao";
import {
  classesRenda,
  codigoUf,
  fontesInclusao,
  inteiro,
  minusculaInicial,
  mudancaOrcamento,
  nomePof,
  orcamentoBase,
  periodoPof,
  pctTexto,
  rotaPainel,
} from "@/lib/energia/inclusao";
import type { ColunaTabela } from "@/lib/energia/tabela";
import type { InclusaoGold } from "@/lib/energia/tipos-inclusao";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/inclusao-energetica/orcamento", {
    title: tx("Peso da energia no orçamento das famílias (POF 2017-2018)", "Weight of energy in family budgets (POF 2017-2018)"),
    description: tx(
      "Participação da energia elétrica na despesa total e na renda das famílias por classe de rendimento, Brasil e grandes regiões, e por UF no total, a partir dos microdados da POF 2017-2018 com pesos, estratos e coeficiente de variação.",
      "Share of electricity in families' total expense and income by income class, Brazil and major regions, and by state in total, from the POF 2017-2018 (IBGE household budget survey) microdata with weights, strata and coefficient of variation.",
    ),
    alternates: { canonical: "/setor-eletrico/inclusao-energetica/orcamento" },
  }, anterior);
}

function colunasConfPof(): ColunaTabela[] {
  return [
    { id: "classe", rotulo: tx("Classe de rendimento", "Income class"), tipo: "texto" },
    { id: "energia_sidra", rotulo: tx("Energia, tabela 6715", "Energy, table 6715"), tipo: "numero", unidade: "R$", casas: 2 },
    { id: "energia_micro", rotulo: tx("Energia, microdados", "Energy, microdata"), tipo: "numero", unidade: "R$", casas: 4 },
    { id: "distribuicao_sidra", rotulo: tx("Distribuição, tabela 6715", "Distribution, table 6715"), tipo: "percentual", casas: 1 },
    { id: "razao_medias_micro", rotulo: tx("Razão de médias, microdados", "Ratio of averages, microdata"), tipo: "percentual", casas: 4 },
    { id: "cv_ibge", rotulo: tx("CV publicado", "Published CV"), tipo: "percentual", casas: 1 },
    { id: "cv_micro", rotulo: tx("CV refeito", "Recomputed CV"), tipo: "percentual", casas: 2 },
  ];
}

function colunasSens(): ColunaTabela[] {
  return [
    { id: "classe", rotulo: tx("Classe de rendimento", "Income class"), tipo: "texto" },
    { id: "media", rotulo: tx("Média das participações na renda", "Average share of income"), tipo: "percentual", casas: 2 },
    { id: "mediana", rotulo: tx("Mediana", "Median"), tipo: "percentual", casas: 2 },
    { id: "sem", rotulo: tx("Média sem famílias com energia acima da renda", "Average without families with energy above income"), tipo: "percentual", casas: 2 }, // i18n: dado
    { id: "n", rotulo: tx("Famílias da amostra com energia acima da renda", "Sample families with energy above income"), tipo: "numero", casas: 0 },
    { id: "peso", rotulo: tx("Peso dessas famílias", "Weight of these families"), tipo: "percentual", casas: 3 },
    { id: "tres", rotulo: tx("Três maiores parcelas da média", "Three largest contributions to the average"), tipo: "numero", unidade: "p.p.", casas: 3 },
  ];
}

export default function OrcamentoPage() {
  const g = lerGold<InclusaoGold>("inclusao.json");
  if (!integra(g)) return <InclusaoIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const idioma = idiomaEnergia();
  const FONTE_POF = fontesInclusao().pof;
  const o = g.orcamento;
  const pofTotal = o.linhas.find((l) => l.territorio === "BR" && l.classe === "7999");
  const periodo = periodoPof(o);
  // unidade dos valores em reais como a proveniência a publica (a parte antes de "; %", com a data de referência dos preços)
  const unidadeReais = dadoTexto(o.proveniencia.microdados.unidade.split(";")[0].trim(), idioma);
  const anoPublicacao = g.gerado_em.slice(0, 4);
  const baseClasses = orcamentoBase(o, (l) => !codigoUf(l.territorio));
  const baseUfs = orcamentoBase(o, (l) => !!codigoUf(l.territorio));
  const classeBaixa = classesRenda(o)[0];
  const periodoMedidas = `POF ${periodo}`;
  const oQueMudou = mudancaOrcamento(o);
  const comoInterpretar = <OrcamentoComoInterpretar o={o} />;
  const naoConcluir = <OrcamentoNaoConcluir o={o} anoPublicacao={anoPublicacao} />;

  return (
    <>
      <CabecalhoEnergia atual="inclusao-energetica" />
      <MarcaVisita secao="energia:inclusao-orcamento" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <InclusaoNavegacao atual="p061" />
        <CabecalhoModulo
          siglas={["UF", "IBGE", "SIDRA"]}
          rotulo={tx("Inclusão energética", "Energy inclusion")}
          titulo={tx("Peso da energia no orçamento das famílias", "Weight of energy in family budgets")}
          lead={tx(
            "Quanto da despesa e da renda das famílias vai para a energia elétrica, por faixa de renda, na Pesquisa de Orçamentos Familiares (POF) 2017-2018. Cada estimativa traz a sua precisão.",
            "How much of families' expense and income goes to electricity, by income bracket, in the Pesquisa de Orçamentos Familiares (POF, IBGE's household budget survey) 2017-2018. Each estimate comes with its precision.",
          )}
          recorte={tx(
            `${periodo} · Brasil, grandes regiões e UF · famílias, % da despesa total e da renda`,
            `${periodo} · Brazil, major regions and states · families, % of total expense and of income`,
          )}
          fonte={FONTE_POF}
          referencia={tx(
            <>
              IBGE, Pesquisa de Orçamentos Familiares ({nomePof(o)}): microdados<span data-nivel="analisar"> ({o.proveniencia.microdados.fonte.recurso})</span> e tabela 6715 do SIDRA. Estatística histórica, sem atualização
              modelada. Processado em {carimbo(g.gerado_em)}.
            </>,
            <>
              IBGE, Pesquisa de Orçamentos Familiares ({nomePof(o)}): microdata<span data-nivel="analisar"> ({o.proveniencia.microdados.fonte.recurso})</span> and SIDRA table 6715. Historical statistic,
              without a modeled update. Processed on {carimbo(g.gerado_em)}.
            </>,
          )}
          metricas={
            <InclusaoPorBasePof
              variantes={{
                despesa: <OrcamentoFaixa o={o} base="despesa" anoPublicacao={anoPublicacao} />,
                renda: <OrcamentoFaixa o={o} base="renda" anoPublicacao={anoPublicacao} />,
              }}
            />
          }
        />
        <ModoProfundidade>
          <Bloco id="orcamento">
            <PainelEvidencia
              id="p061"
              pergunta={dadoTexto(o.pergunta, idioma)}
              subtitulo={tx(
                `Energia elétrica na despesa total e na renda das famílias, por classe de rendimento · ${nomePof(o)} · %`,
                `Electricity in families' total expense and income, by income class · ${nomePof(o)} · %`,
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
                <InclusaoOrcamentoPainel
                  classes={baseClasses}
                  ufs={baseUfs}
                  fonte={FONTE_POF}
                  periodo={periodo}
                  unidadeReais={unidadeReais}
                  medidas={
                    <FaixaMetricas colunas={2} rotulo={tx("Média das participações, família a família", "Average of shares, family by family")}>
                      <Numero
                        variante="faixa"
                        rotulo={tx("Média das participações na despesa, todas as famílias", "Average share of expense, all families")}
                        natureza="ESTIMADO"
                        evidencia={o.evidencias.media_razoes_desp_brasil}
                        formato="pct"
                        casas={1}
                        unidade={tx("da despesa total", "of total expense")}
                        periodo={periodoMedidas}
                        cor="var(--serie-comp-2)"
                        endereco={`${rotaPainel("p061")}#p061`}
                      />
                      <Numero
                        variante="faixa"
                        rotulo={tx(
                          `Média das participações na renda, faixa de renda ${classeBaixa ? minusculaInicial(classeBaixa.rotulo) : "mais baixa"}`,
                          `Average share of income, income bracket ${classeBaixa ? minusculaInicial(dadoTexto(classeBaixa.rotulo, idioma)) : "lowest"}`,
                        )}
                        natureza="ESTIMADO"
                        evidencia={o.evidencias.media_razoes_renda_classe_baixa}
                        formato="pct"
                        casas={1}
                        unidade={tx("da renda", "of income")}
                        periodo={periodoMedidas}
                        cor="var(--serie-referencia)"
                        nota={
                          classeBaixa && o.sensibilidade_media_razoes_renda[classeBaixa.codigo]
                            ? tx(
                                `Mediana ${pctTexto(o.sensibilidade_media_razoes_renda[classeBaixa.codigo].mediana_renda_pct, 2)}: a média é sensível às famílias que declaram renda menor que a despesa com energia.`,
                                `Median ${pctTexto(o.sensibilidade_media_razoes_renda[classeBaixa.codigo].mediana_renda_pct, 2)}: the average is sensitive to families that declare income lower than their electricity expense.`,
                              )
                            : undefined
                        }
                        endereco={`${rotaPainel("p061")}#p061`}
                      />
                    </FaixaMetricas>
                  }
                  resposta={<InclusaoPorBasePof variantes={{ despesa: <OrcamentoResposta o={o} base="despesa" />, renda: <OrcamentoResposta o={o} base="renda" /> }} />}
                  recorte={
                    <InclusaoRecorte
                      periodo={`${periodo}; ${dadoTexto(o.referencia, idioma)}`}
                      universo={tx(
                        <>
                          {inteiro(pofTotal?.n_amostra)} famílias na amostra, que representam {inteiro(pofTotal?.familias)} famílias; Brasil e grandes regiões por classe; UF só no total
                        </>,
                        <>
                          {inteiro(pofTotal?.n_amostra)} families in the sample, representing {inteiro(pofTotal?.familias)} families; Brazil and major regions by class; states in total only
                        </>,
                      )}
                      unidade={tx(`% da despesa total ou da renda; ${unidadeReais}`, `% of total expense or of income; ${unidadeReais}`)}
                    />
                  }
                  notas={<NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />}
                />

                <SecaoDoPainel
                  id="conferencia-6715"
                  nivel="auditar" // i18n: dado
                  titulo={tx("Conferência com a tabela 6715 e sensibilidade da média na renda", "Check against table 6715 and sensitivity of the average in income")}
                >
                  <p className="text-sm text-carvao-muted">
                    {tx(
                      <>
                        {o.conferencia.comparacoes} comparações entre os microdados refeitos e a tabela 6715: despesa média com energia dentro de {num(o.conferencia.energia_max_diferenca_reais, 3)}{" "}
                        real em {o.conferencia.energia_ate_1_centavo}; distribuição dentro de {num(o.conferencia.distribuicao_max_diferenca_pp, 3)} ponto percentual em{" "}
                        {o.conferencia.distribuicao_ate_arredondamento}; CV a até {num(o.conferencia.cv_max_diferenca_pp, 2)} ponto. Tolerâncias: {o.conferencia.tolerancias.medias};{" "}
                        {o.conferencia.tolerancias.distribuicao}; {o.conferencia.tolerancias.cv}.
                      </>,
                      <>
                        {o.conferencia.comparacoes} comparisons between the recomputed microdata and table 6715: average electricity expense within{" "}
                        {num(o.conferencia.energia_max_diferenca_reais, 3)} real in {o.conferencia.energia_ate_1_centavo}; distribution within{" "}
                        {num(o.conferencia.distribuicao_max_diferenca_pp, 3)} percentage point in {o.conferencia.distribuicao_ate_arredondamento}; CV within{" "}
                        {num(o.conferencia.cv_max_diferenca_pp, 2)} point. Tolerances: {dadoNo(o.conferencia.tolerancias.medias, "tolerancia-pof", idioma)};{" "}
                        {dadoNo(o.conferencia.tolerancias.distribuicao, "tolerancia-pof", idioma)}; {dadoNo(o.conferencia.tolerancias.cv, "tolerancia-pof", idioma)}.
                      </>,
                    )}
                  </p>
                  <TabelaInterativa
                    titulo={tx("Brasil por classe: tabela 6715 e microdados", "Brazil by class: table 6715 and microdata")}
                    colunas={colunasConfPof()}
                    linhas={o.conferencia.comparacoes_brasil.map((x) => ({
                      id: x.classe,
                      classe: dadoTexto(o.classes.find((cl) => cl.codigo === x.classe)?.rotulo ?? x.classe, idioma),
                      energia_sidra: x.energia_sidra,
                      energia_micro: x.energia_micro,
                      distribuicao_sidra: x.distribuicao_sidra,
                      razao_medias_micro: x.razao_medias_micro,
                      cv_ibge: x.cv_ibge,
                      cv_micro: x.cv_micro,
                    }))}
                    chaveLinha="id"
                    colunaRotulo="classe"
                    fonte={FONTE_POF}
                    versao={o.referencia}
                    nomeArquivo="inclusao-pof-conferencia-6715"
                    chaveUrl="pof.conf"
                  />
                  <TabelaInterativa
                    titulo={tx("Média das participações na renda: mediana e sensibilidade, Brasil", "Average share of income: median and sensitivity, Brazil")}
                    colunas={colunasSens()}
                    linhas={o.classes
                      .filter((cl) => o.sensibilidade_media_razoes_renda[cl.codigo])
                      .map((cl) => {
                        const s = o.sensibilidade_media_razoes_renda[cl.codigo];
                        return {
                          id: cl.codigo,
                          classe: dadoTexto(cl.rotulo, idioma),
                          media: s.media_razoes_renda_pct,
                          mediana: s.mediana_renda_pct,
                          sem: s.media_sem_energia_acima_da_renda_pct,
                          n: s.familias_amostra_energia_acima_da_renda,
                          peso: s.peso_energia_acima_da_renda_pct,
                          tres: s.tres_maiores_contribuicoes_pp,
                        };
                      })}
                    chaveLinha="id"
                    colunaRotulo="classe"
                    fonte={FONTE_POF}
                    versao={o.referencia}
                    nomeArquivo="inclusao-pof-sensibilidade-renda"
                    chaveUrl="pof.sens"
                  />
                  {o.diagnostico_microdados && (
                    <p className="text-sm text-carvao-muted">
                      {tx(`Microdados: ${inteiro(o.diagnostico_microdados.familias)} famílias;`, `Microdata: ${inteiro(o.diagnostico_microdados.familias)} families;`)}{" "}
                      {Object.entries(o.diagnostico_microdados.registros)
                        .map(([r, d]) =>
                          tx(
                            `${r}: ${inteiro(d.linhas_usadas)} linhas usadas, ${inteiro(d.codigos_fora_do_tradutor)} códigos fora do tradutor`,
                            `${r}: ${inteiro(d.linhas_usadas)} rows used, ${inteiro(d.codigos_fora_do_tradutor)} codes outside the translator`,
                          ),
                        )
                        .join("; ")}
                      .
                    </p>
                  )}
                </SecaoDoPainel>

                <InclusaoSeguir ancora="p061" proximo={{ href: rotaPainel("p062"), pergunta: dadoTexto(g.acesso.pergunta, idioma) }} downloads={[]} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
