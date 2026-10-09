import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { InclusaoCapitulos, InclusaoDatas, InclusaoIndisponivel, InclusaoRecorte, InclusaoSeguir } from "@/components/energia/InclusaoPagina";
import { OrcamentoComoInterpretar, OrcamentoNaoConcluir, OrcamentoPorQueImporta } from "@/components/energia/InclusaoTextos";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
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
export const metadata: Metadata = {
  title: "Inclusão energética: Tarifa Social, cobertura, orçamento e acesso",
  description:
    "Síntese da inclusão energética: peso da energia no orçamento das famílias por faixa de renda (POF 2017-2018), Tarifa Social (ANEEL, SCS e Beneficiários da CDE), cobertura potencial contra o Cadastro Único (proxy declarada) e acesso à energia, sistemas isolados e Luz para Todos, cada medida com a sua unidade e a sua data.",
  alternates: { canonical: "/setor-eletrico/inclusao-energetica" },
};

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
      <span className="rotulo mr-2 text-mineral">O que não é possível concluir</span>
      {children}
    </p>
  );
}

export default function InclusaoEnergeticaPage() {
  const g = lerGold<InclusaoGold>("inclusao.json");
  if (!integra(g)) return <InclusaoIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

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
      <CabecalhoEnergia atual="inclusao-energetica" />
      <MarcaVisita secao="energia:inclusao-energetica" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          siglas={["IBGE", "ANEEL", "UF", "SIDRA", "DMR", "EPE", "MME", "SIN"]}
          titulo="Para quem a energia pesa mais?"
          lead="Quanto a energia elétrica pesa na despesa das famílias de cada faixa de renda (Pesquisa de Orçamentos Familiares, POF 2017-2018), e o que a Tarifa Social e o acesso à energia medem."
          recorte={`${periodoMedidas} · Brasil, famílias por faixa de renda · % da despesa total`}
          fonte="IBGE, POF 2017-2018 e Pesquisa Nacional por Amostra de Domicílios (PNAD) Contínua; ANEEL, Tarifa Social"
          referencia={
            <>
              SCS da ANEEL até {mes(g.referencias.scs_ultimo_mes_no_arquivo)} (arquivo gerado pela fonte em {dataBR(geracaoScs)}); Beneficiários da CDE até {mes(g.referencias.cde_mes_mais_recente)}; Cadastro Único,
              do Ministério do Desenvolvimento e Assistência Social (MDS), de {mes(c.brasil?.mes)}; {nomePof(o)}; PNAD Contínua {a.ano_referencia}; ciclo {si?.ciclo ?? "sem dado"} do Portal de Acompanhamento e
              Informações dos Sistemas Isolados (PASI), da EPE; Luz para Todos, do MME, até {mes(lpt?.ultimo_mes)}. Processado em {carimbo(g.gerado_em)}.
            </>
          }
          datas={<InclusaoDatas itens={datasMedidas(g)} />}
          metricas={
            <FaixaMetricas colunas={3} rotulo="Peso da energia na despesa das famílias" nota={textoPofHistorica(o, anoPublicacao)}>
              <Numero
                variante="faixa"
                rotulo="Energia na despesa total, todas as famílias"
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
                  rotulo="Energia na despesa total, menor faixa de renda"
                  natureza="ESTIMADO"
                  valor={destaques.baixa.valor}
                  formato="pct"
                  casas={1}
                  unidade="da despesa total"
                  periodo={`${destaques.baixa.rotulo} · ${periodoMedidas}`}
                  motivoAusencia="Estimativa suprimida pela precisão."
                />
              )}
              {destaques.alta && (
                <Numero
                  variante="faixa"
                  rotulo="Energia na despesa total, maior faixa de renda"
                  natureza="ESTIMADO"
                  valor={destaques.alta.valor}
                  formato="pct"
                  casas={1}
                  unidade="da despesa total"
                  periodo={`${destaques.alta.rotulo} · ${periodoMedidas}`}
                  motivoAusencia="Estimativa suprimida pela precisão."
                />
              )}
            </FaixaMetricas>
          }
        >
          Quatro perguntas, cada uma com a sua fonte e a sua unidade: para quem a conta de luz pesa mais no orçamento, quanto a Tarifa Social alcança, quantas faturas há para cada 100 famílias
          do Cadastro Único (uma proxy) e quem ainda não tem acesso adequado. Os números são agregados: nenhum beneficiário individual aparece aqui.
        </CabecalhoModulo>

        <ModoProfundidade>
          <PainelEvidencia
            id="sintese-p061"
            pergunta="Quanto da despesa vai para a energia, em cada faixa de renda?"
            subtitulo={`Energia elétrica na despesa total das famílias, por faixa de renda · ${nomePof(o)}, ${periodo} · razão de médias`}
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
              <div>
                <RespostaCurta id="p061" veredito={vereditoOrcamento(o)}>
                  {respostaOrcamento(o)}
                </RespostaCurta>
              </div>
              <GraficoBarras
                titulo={`Energia elétrica na despesa total das famílias, por faixa de renda, Brasil (${nomePof(baseClasses)})`}
                dados={dadosClassesPof(baseClasses, "BR", "despesa")}
                chaveCategoria="id"
                chaveRotulo="rotulo"
                series={[{ id: "razao_medias_pct", rotulo: "Razão de médias", cor: "var(--cor-energia)" }]}
                unidade="%"
                casas={1}
                orientacao="horizontal"
                rotulosValor
                referencias={destaques.total !== null ? [{ valor: destaques.total, rotulo: "Razão de médias, todas as famílias (Brasil)" }] : []}
              />
              <InclusaoRecorte
                periodo={`${periodo}; ${o.referencia}`}
                universo={
                  <>
                    {inteiro(pofTotal?.n_amostra)} famílias na amostra, que representam {inteiro(pofTotal?.familias)} famílias; Brasil, faixas de renda
                  </>
                }
                unidade="% da despesa total, razão de médias; faixas em reais da data de referência da pesquisa"
              />
              <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />
              <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                Por região, por limiar de {o.limiares_pct.map((x) => `${x.toLocaleString("pt-BR")}%`).join(", ")} da renda e da despesa e por UF, no{" "}
                <Link href={rotaPainel("p061")} className="text-energia-dark underline underline-offset-4 hover:text-carvao">
                  painel completo de orçamento
                </Link>
                .
              </p>
            </div>
          </PainelEvidencia>

          <section id="beneficio-e-acesso" aria-labelledby="beneficio-e-acesso-titulo" className="scroll-mt-28 space-y-6 border-t border-linha pt-6">
            <header>
              <h2 id="beneficio-e-acesso-titulo" className="ed-h2 font-serif text-carvao">
                Benefício e acesso, cada medida na sua unidade e na sua data
              </h2>
              <p className="mt-2 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                Unidade consumidora, fatura, família, domicílio e pessoa não se somam nem se substituem: cada fonte conta uma delas e tem o seu calendário.
              </p>
            </header>

            <SecaoDoPainel id="sintese-p059" titulo={t.pergunta}>
              <div>
                <RespostaCurta id="p059" veredito={vereditoTarifaSocial(t)}>
                  {respostaTarifaSocial(t)}
                </RespostaCurta>
              </div>
              <FaixaMetricas colunas={2} rotulo="Tarifa Social: unidades consumidoras e faturas">
                <Numero
                  variante="faixa"
                  rotulo="UC com Tarifa Social (SCS)"
                  natureza="OBSERVADO"
                  evidencia={k.uc_tsee.evidencia}
                  casas={0}
                  unidade="UC"
                  cor="var(--cor-energia)"
                  nota={
                    <>
                      UC, unidade consumidora: o ponto de ligação com conta própria. É a unidade do Sistema de Controle de Subvenções e Programas Sociais (SCS), em que a distribuidora pede o reembolso do desconto. {t.distribuidoras.length} distribuidoras;
                      último mês completo do SCS.
                    </>
                  }
                  endereco={`${rotaPainel("p059")}#p059`}
                />
                <Numero
                  variante="faixa"
                  rotulo="Faturas com desconto (Beneficiários da CDE)"
                  natureza="CALCULADO"
                  evidencia={k.faturas_cde_mapa?.evidencia ?? null}
                  casas={0}
                  unidade="faturas"
                  cor="var(--serie-referencia)"
                  motivoAusencia="Nenhum arquivo da CDE com todas as distribuidoras."
                  nota="Fatura: cada conta emitida com desconto no mês. É a unidade dos arquivos de Beneficiários da Conta de Desenvolvimento Energético (CDE); uma UC pode ter mais de uma fatura no arquivo."
                  endereco={`${rotaPainel("p059")}#p059`}
                />
              </FaixaMetricas>
              <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                SCS de {mes(t.serie_mensal[0]?.m)} a {mes(t.serie_mensal.at(-1)?.m)}, em UC; arquivos da CDE até {mes(g.referencias.cde_mes_mais_recente)}, em faturas, com o último mês completo em{" "}
                {mes(mesMapa)}.
              </p>
              <Limite>número de famílias ou de pessoas beneficiadas: UC e fatura são unidades da conta, e a DMR não é o desconto de cada família.</Limite>
            </SecaoDoPainel>

            <SecaoDoPainel id="sintese-p060" titulo="Faturas por 100 famílias do Cadastro Único: o que a proxy mede">
              <p className="inline-flex items-center gap-2 border border-carvao px-3 py-1 text-sm text-carvao">
                <span className="rotulo">Proxy</span>
                <span>medida indireta, com denominador elegível só pelo critério de renda</span>
              </p>
              <div>
                <RespostaCurta id="p060" veredito={vereditoCobertura(c)}>
                  {respostaCobertura(c)}
                </RespostaCurta>
              </div>
              <FaixaMetricas colunas={2} rotulo="Cobertura potencial da Tarifa Social (proxy)">
                <Numero
                  variante="faixa"
                  rotulo="Faturas por 100 famílias do Cadastro Único (proxy)"
                  natureza="CALCULADO"
                  evidencia={c.brasil?.evidencia ?? null}
                  casas={1}
                  unidade="faturas por 100 famílias"
                  cor="var(--serie-comp-2)"
                  motivoAusencia="Sem cruzamento entre faturas e Cadastro Único nesta publicação."
                  nota={
                    <>
                      Denominador: famílias do Cadastro Único com renda por pessoa até meio salário mínimo e cadastro atualizado ({inteiro(familiasAtualizadas)} em {mes(c.brasil?.mes)}). Família é a
                      unidade do Cadastro Único e da POF; pode não ser a titular da conta de luz da casa em que mora.
                    </>
                  }
                  endereco={`${rotaPainel("p060")}#p060`}
                />
              </FaixaMetricas>
              <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                Faturas da CDE e famílias do Cadastro Único com renda por pessoa até meio salário mínimo, no mesmo mês ({mes(c.brasil?.mes)}), por UF e município. Com todas as famílias
                cadastradas nessa renda, a razão é {numTexto(c.brasil?.razao_cadastradas_pct, 1)}.
              </p>
              <Limite>
                a resposta à pergunta “{c.pergunta}”: a razão não conta famílias fora do benefício; fatura não é família, e o numerador inclui critérios que o denominador não tem.
              </Limite>
            </SecaoDoPainel>

            <SecaoDoPainel id="sintese-p062" titulo={a.pergunta}>
              <div>
                <RespostaCurta id="p062" veredito={vereditoAcesso(a)}>
                  {respostaAcesso(a)}
                </RespostaCurta>
              </div>
              <FaixaMetricas colunas={3} rotulo="Acesso à energia, sistemas isolados e Luz para Todos">
                <Numero
                  variante="faixa"
                  rotulo="Domicílios sem energia elétrica de nenhuma fonte (PNAD Contínua)"
                  natureza="ESTIMADO"
                  evidencia={a.evidencia_sem_energia}
                  casas={0}
                  unidade="mil domicílios"
                  cor="var(--cor-energia)"
                  motivoAusencia="Sem estimativa da PNAD nesta publicação."
                  nota={
                    <>
                      Domicílio: a unidade da PNAD Contínua e do Luz para Todos, a moradia, com ou sem ligação à rede.
                      {brPnad ? ` Entre os ligados à rede geral, ${numTexto(brPnad.pct_integral_entre_rede, 1)}% têm fornecimento em tempo integral.` : ""}
                    </>
                  }
                  endereco={`${rotaPainel("p062")}#p062`}
                />
                <Numero
                  variante="faixa"
                  rotulo={`Pessoas em localidades isoladas (ciclo ${si?.ciclo ?? "sem dado"})`}
                  natureza="OBSERVADO"
                  evidencia={si?.evidencia_populacao ?? null}
                  casas={0}
                  unidade="pessoas"
                  cor="var(--serie-termica)"
                  motivoAusencia="PASI não processado nesta publicação."
                  nota="Pessoa: a população das localidades isoladas, informada pelas distribuidoras ao Portal de Acompanhamento e Informações dos Sistemas Isolados (PASI), da EPE."
                  endereco={`${rotaPainel("p062")}#p062`}
                />
                <Numero
                  variante="faixa"
                  rotulo="Domicílios atendidos pelo Luz para Todos (MME)"
                  natureza="OBSERVADO"
                  evidencia={lpt?.evidencia_total ?? null}
                  casas={0}
                  unidade="domicílios"
                  cor="var(--serie-referencia)"
                  motivoAusencia="Arquivo do MME não processado nesta publicação."
                  nota="Ligações feitas pelo programa, não pessoas nem UC com benefício; ligação feita não mede a qualidade do fornecimento depois dela."
                  endereco={`${rotaPainel("p062")}#p062`}
                />
              </FaixaMetricas>
              <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                PNAD Contínua de {a.pnad_serie[0]?.ano} a {a.ano_referencia}; PASI ciclo {si?.ciclo ?? "sem dado"}; Luz para Todos até {mes(lpt?.ultimo_mes)}.
              </p>
              <Limite>qualidade do serviço a partir da ligação feita; e a carga do SIN não mede acesso: os sistemas isolados ficam fora dela.</Limite>
            </SecaoDoPainel>
          </section>

          <InclusaoCapitulos />

          <InclusaoSeguir
            ancora="sintese-p061"
            downloads={g.downloads}
            extra={
              <p className="max-w-prose2 pb-2 text-xs leading-relaxed text-carvao-muted">
                Arquivos do módulo: CSV com ponto e vírgula, ponto decimal e campo vazio para ausência; os JSON são lidos pelos gráficos sob demanda.
              </p>
            }
          />
        </ModoProfundidade>
      </main>
    </>
  );
}
