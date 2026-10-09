import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { InclusaoIndisponivel, InclusaoNavegacao, InclusaoRecorte, InclusaoSeguir } from "@/components/energia/InclusaoPagina";
import { InclusaoOrcamentoPainel } from "@/components/energia/InclusaoOrcamento";
import { OrcamentoComoInterpretar, OrcamentoNaoConcluir, OrcamentoPorQueImporta } from "@/components/energia/InclusaoTextos";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, num } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import {
  classesRenda,
  codigoUf,
  destaquesRendaPof,
  FONTE_POF,
  inteiro,
  minusculaInicial,
  mudancaOrcamento,
  nomePof,
  orcamentoBase,
  periodoPof,
  pctTexto,
  respostaOrcamento,
  rotaPainel,
  textoPofHistorica,
  vereditoOrcamento,
} from "@/lib/energia/inclusao";
import type { ColunaTabela } from "@/lib/energia/tabela";
import type { InclusaoGold } from "@/lib/energia/tipos-inclusao";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Peso da energia no orçamento das famílias (POF 2017-2018)",
  description:
    "Participação da energia elétrica na despesa total e na renda das famílias por classe de rendimento, Brasil e grandes regiões, e por UF no total, a partir dos microdados da POF 2017-2018 com pesos, estratos e coeficiente de variação.",
  alternates: { canonical: "/setor-eletrico/inclusao-energetica/orcamento" },
};

const COLUNAS_CONF_POF: ColunaTabela[] = [
  { id: "classe", rotulo: "Classe de rendimento", tipo: "texto" },
  { id: "energia_sidra", rotulo: "Energia, tabela 6715", tipo: "numero", unidade: "R$", casas: 2 },
  { id: "energia_micro", rotulo: "Energia, microdados", tipo: "numero", unidade: "R$", casas: 4 },
  { id: "distribuicao_sidra", rotulo: "Distribuição, tabela 6715", tipo: "percentual", casas: 1 },
  { id: "razao_medias_micro", rotulo: "Razão de médias, microdados", tipo: "percentual", casas: 4 },
  { id: "cv_ibge", rotulo: "CV publicado", tipo: "percentual", casas: 1 },
  { id: "cv_micro", rotulo: "CV refeito", tipo: "percentual", casas: 2 },
];

const COLUNAS_SENS: ColunaTabela[] = [
  { id: "classe", rotulo: "Classe de rendimento", tipo: "texto" },
  { id: "media", rotulo: "Média das participações na renda", tipo: "percentual", casas: 2 },
  { id: "mediana", rotulo: "Mediana", tipo: "percentual", casas: 2 },
  { id: "sem", rotulo: "Média sem famílias com energia acima da renda", tipo: "percentual", casas: 2 },
  { id: "n", rotulo: "Famílias da amostra com energia acima da renda", tipo: "numero", casas: 0 },
  { id: "peso", rotulo: "Peso dessas famílias", tipo: "percentual", casas: 3 },
  { id: "tres", rotulo: "Três maiores parcelas da média", tipo: "numero", unidade: "p.p.", casas: 3 },
];

export default function OrcamentoPage() {
  const g = lerGold<InclusaoGold>("inclusao.json");
  if (!integra(g)) return <InclusaoIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const o = g.orcamento;
  const pofTotal = o.linhas.find((l) => l.territorio === "BR" && l.classe === "7999");
  const periodo = periodoPof(o);
  // unidade dos valores em reais como a proveniência a publica (a parte antes de "; %", com a data de referência dos preços)
  const unidadeReais = o.proveniencia.microdados.unidade.split(";")[0].trim();
  const anoPublicacao = g.gerado_em.slice(0, 4);
  const baseClasses = orcamentoBase(o, (l) => !codigoUf(l.territorio));
  const baseUfs = orcamentoBase(o, (l) => !!codigoUf(l.territorio));
  const classeBaixa = classesRenda(o)[0];
  const destaques = destaquesRendaPof(baseClasses);
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
          siglas={["POF", "IBGE", "SIDRA"]}
          rotulo="Inclusão energética"
          titulo="Peso da energia no orçamento das famílias"
          lead="Quanto da despesa e da renda das famílias vai para a energia elétrica, por faixa de renda, na Pesquisa de Orçamentos Familiares (POF) 2017-2018. Cada estimativa traz a sua precisão."
          recorte={`${periodo} · Brasil, grandes regiões e UF · famílias, % da despesa total e da renda`}
          fonte="IBGE, POF 2017-2018 (microdados e tabela 6715)"
          referencia={
            <>
              IBGE, Pesquisa de Orçamentos Familiares ({nomePof(o)}): microdados<span data-nivel="analisar"> ({o.proveniencia.microdados.fonte.recurso})</span> e tabela 6715 do SIDRA. Estatística histórica, sem atualização
              modelada. Processado em {carimbo(g.gerado_em)}.
            </>
          }
          metricas={
            <FaixaMetricas colunas={5} rotulo="Peso da energia no orçamento das famílias" nota={textoPofHistorica(o, anoPublicacao)}>
              <Numero
                variante="faixa"
                rotulo="Razão de médias, todas as famílias"
                natureza="ESTIMADO"
                evidencia={o.evidencias.razao_medias_brasil}
                formato="pct"
                casas={1}
                unidade="da despesa total"
                periodo={periodoMedidas}
                cor="var(--cor-energia)"
                endereco={`${rotaPainel("p061")}#p061`}
              />
              {destaques.baixa && (
                <Numero
                  variante="faixa"
                  rotulo={`Razão de médias, faixa de renda ${minusculaInicial(destaques.baixa.rotulo)}`}
                  natureza="ESTIMADO"
                  valor={destaques.baixa.valor}
                  formato="pct"
                  casas={1}
                  unidade="da despesa total"
                  periodo={periodoMedidas}
                  motivoAusencia="Estimativa suprimida pela precisão."
                />
              )}
              {destaques.alta && (
                <Numero
                  variante="faixa"
                  rotulo={`Razão de médias, faixa de renda ${minusculaInicial(destaques.alta.rotulo)}`}
                  natureza="ESTIMADO"
                  valor={destaques.alta.valor}
                  formato="pct"
                  casas={1}
                  unidade="da despesa total"
                  periodo={periodoMedidas}
                  motivoAusencia="Estimativa suprimida pela precisão."
                />
              )}
              <Numero
                variante="faixa"
                rotulo="Média das participações na despesa, todas as famílias"
                natureza="ESTIMADO"
                evidencia={o.evidencias.media_razoes_desp_brasil}
                formato="pct"
                casas={1}
                unidade="da despesa total"
                periodo={periodoMedidas}
                endereco={`${rotaPainel("p061")}#p061`}
              />
              <Numero
                variante="faixa"
                rotulo={`Média das participações na renda, faixa de renda ${classeBaixa ? minusculaInicial(classeBaixa.rotulo) : "mais baixa"}`}
                natureza="ESTIMADO"
                evidencia={o.evidencias.media_razoes_renda_classe_baixa}
                formato="pct"
                casas={1}
                unidade="da renda"
                periodo={periodoMedidas}
                nota={
                  classeBaixa && o.sensibilidade_media_razoes_renda[classeBaixa.codigo]
                    ? `Mediana ${pctTexto(o.sensibilidade_media_razoes_renda[classeBaixa.codigo].mediana_renda_pct, 2)}: a média é sensível às famílias que declaram renda menor que a despesa com energia.`
                    : undefined
                }
                endereco={`${rotaPainel("p061")}#p061`}
              />
            </FaixaMetricas>
          }
        />
        <ModoProfundidade>
          <Bloco id="orcamento">
            <PainelEvidencia
              id="p061"
              pergunta={o.pergunta}
              subtitulo={`Energia elétrica na despesa total e na renda das famílias, por classe de rendimento · ${nomePof(o)} · %`}
              natureza="ESTIMADO"
              porQueImporta={<OrcamentoPorQueImporta />}
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={o.proveniencia.microdados}
              complementares={[{ rotulo: "Tabela 6715 (SIDRA)", p: o.proveniencia.sidra }]}
            >
              <div className="space-y-6">
                <InclusaoOrcamentoPainel
                  classes={baseClasses}
                  ufs={baseUfs}
                  fonte={FONTE_POF}
                  periodo={periodo}
                  unidadeReais={unidadeReais}
                  resposta={
                    <RespostaCurta id="p061" veredito={vereditoOrcamento(o)}>
                      {respostaOrcamento(o)}
                    </RespostaCurta>
                  }
                  recorte={
                    <InclusaoRecorte
                      periodo={`${periodo}; ${o.referencia}`}
                      universo={
                        <>
                          {inteiro(pofTotal?.n_amostra)} famílias na amostra, que representam {inteiro(pofTotal?.familias)} famílias; Brasil e grandes regiões por classe; UF só no total
                        </>
                      }
                      unidade={`% da despesa total ou da renda; ${unidadeReais}`}
                    />
                  }
                  notas={<NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />}
                />

                <SecaoDoPainel id="conferencia-6715" nivel="auditar" titulo="Conferência com a tabela 6715 e sensibilidade da média na renda">
                  <p className="text-sm text-carvao-muted">
                    {o.conferencia.comparacoes} comparações entre os microdados refeitos e a tabela 6715: despesa média com energia dentro de {num(o.conferencia.energia_max_diferenca_reais, 3)}{" "}
                    real em {o.conferencia.energia_ate_1_centavo}; distribuição dentro de {num(o.conferencia.distribuicao_max_diferenca_pp, 3)} ponto percentual em{" "}
                    {o.conferencia.distribuicao_ate_arredondamento}; CV a até {num(o.conferencia.cv_max_diferenca_pp, 2)} ponto. Tolerâncias: {o.conferencia.tolerancias.medias};{" "}
                    {o.conferencia.tolerancias.distribuicao}; {o.conferencia.tolerancias.cv}.
                  </p>
                  <TabelaInterativa
                    titulo="Brasil por classe: tabela 6715 e microdados"
                    colunas={COLUNAS_CONF_POF}
                    linhas={o.conferencia.comparacoes_brasil.map((x) => ({
                      id: x.classe,
                      classe: o.classes.find((cl) => cl.codigo === x.classe)?.rotulo ?? x.classe,
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
                    titulo="Média das participações na renda: mediana e sensibilidade, Brasil"
                    colunas={COLUNAS_SENS}
                    linhas={o.classes
                      .filter((cl) => o.sensibilidade_media_razoes_renda[cl.codigo])
                      .map((cl) => {
                        const s = o.sensibilidade_media_razoes_renda[cl.codigo];
                        return {
                          id: cl.codigo,
                          classe: cl.rotulo,
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
                      Microdados: {inteiro(o.diagnostico_microdados.familias)} famílias;{" "}
                      {Object.entries(o.diagnostico_microdados.registros)
                        .map(([r, d]) => `${r}: ${inteiro(d.linhas_usadas)} linhas usadas, ${inteiro(d.codigos_fora_do_tradutor)} códigos fora do tradutor`)
                        .join("; ")}
                      .
                    </p>
                  )}
                </SecaoDoPainel>

                <InclusaoSeguir ancora="p061" proximo={{ href: rotaPainel("p062"), pergunta: g.acesso.pergunta }} downloads={[]} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
