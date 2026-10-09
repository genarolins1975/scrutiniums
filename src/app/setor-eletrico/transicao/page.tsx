import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TransicaoCapitulos, TransicaoDatas, TransicaoIndisponivel, TransicaoNavegacao, TransicaoRecorte, TransicaoSeguir } from "@/components/energia/TransicaoPagina";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import {
  GRANDEZAS,
  LIGACAO_GERACAO,
  PERGUNTA_TRANSICAO,
  conectadaNoAnoDeReferencia,
  dadosFatorAnual,
  data,
  inteiro,
  kgPorMwh,
  linhasAnualCobertas,
  mes,
  mudancaEmissoes,
  mudancaMmgdAno,
  notaAnosDaCapacidade,
  pctTexto,
  periodoFatorAnual,
  perguntaPainel,
  primeiroAnoCoberto,
  referenciaAnual,
  respostaEmissoes,
  respostaMmgd,
  respostaOns,
  rotaPainel,
  vereditoEmissoes,
  vereditoMmgd,
  vereditoOns,
} from "@/lib/energia/transicao";
import type { GoldTransicao } from "@/lib/energia/tipos-transicao";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Transição e ambiente: geração distribuída e emissões",
  description:
    "Como a matriz está mudando: capacidade de micro e minigeração distribuída adicionada por ano (cadastro da ANEEL) e intensidade das emissões da geração no SIN (fator médio do MCTI) em séries separadas, a energia que a MMGD entrega ao SIN (estimativa do ONS) e um painel completo para cada pergunta.",
  alternates: { canonical: "/setor-eletrico/transicao" },
};

/** Painéis de outros módulos que continuam a mesma narrativa, com a pergunta de cada um. */
const LIGACOES = [
  { href: "/setor-eletrico/carga/perfil-horario#p026", rotulo: "Carga: MMGD e perfil horário", texto: "Qual parcela da carga é estimada e quando ocorre o pico? A mesma estimativa de MMGD do ONS, hora a hora." },
  { href: LIGACAO_GERACAO.href, rotulo: "Geração: matriz efetiva", texto: `${LIGACAO_GERACAO.pergunta} A composição da geração do SIN por fonte, segundo o ONS; o fator médio do MCTI também se refere à geração no SIN.` },
  { href: "/setor-eletrico/expansao", rotulo: "Expansão", texto: "O que está sendo construído e quando pode entrar? A geração centralizada que se soma à distribuída." },
];

/**
 * Abertura da Transição e ambiente: dois visuais separados, a capacidade de MMGD adicionada por ano (cadastro da ANEEL, em MW) e a
 * intensidade das emissões do SIN (fator médio do MCTI, em tCO2/MWh), sem afirmar que a primeira explica a segunda e sem emissões
 * evitadas, porque não há contrafactual. As três perguntas das páginas vêm depois, cada uma com a resposta curta, a grandeza e a
 * unidade que usa e o caminho para o painel completo. Os números são agregados por território; nenhum titular de unidade aparece.
 */
export default function TransicaoPage() {
  const g = lerGold<GoldTransicao>("transicao.json");
  if (!integra(g)) return <TransicaoIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const m = g.mmgd;
  const o = g.ons_mmgd;
  const e = g.emissoes;
  const conectada = conectadaNoAnoDeReferencia(m);
  const mesOns = o?.ultimo_mes_completo ?? null;
  const periodoFator = e ? periodoFatorAnual(e) : null;
  const anual = linhasAnualCobertas(m);
  const primeiroCoberto = primeiroAnoCoberto(m.controles.cobertura_das_series.inicio_declarado);
  const oQueMudou = (
    <>
      {mudancaMmgdAno(m)} {e ? mudancaEmissoes(e) : ""}
    </>
  );
  const comoInterpretar = (
    <>
      Cada gráfico tem a sua escala, o seu período e a sua fonte. A capacidade adicionada é a potência instalada que entrou no cadastro da ANEEL em cada ano, em MW, e não é energia gerada. O
      fator de emissão é a média anual de CO2 da geração despachada no SIN, publicada pelo MCTI, em tCO2/MWh: só CO2 da operação das usinas.
    </>
  );
  const naoConcluir = (
    <>
      Que a capacidade adicionada explique a mudança das emissões, nem emissões evitadas: nenhuma das duas séries traz o que teria ocorrido sem a outra. Também não compara CO2 da operação com
      CO2 equivalente de ciclo de vida, nem capacidade (MW) com energia (MWh).
    </>
  );
  const respostas = {
    p063: <RespostaCurta id="p063" tamanho="sm" veredito={vereditoMmgd(m)}>{respostaMmgd(m)}</RespostaCurta>,
    ons: o ? <RespostaCurta id="ons" tamanho="sm" veredito={vereditoOns(o) || respostaOns(o)}>{respostaOns(o)}</RespostaCurta> : null,
    p064: e ? <RespostaCurta id="p064" tamanho="sm" veredito={vereditoEmissoes(e) || respostaEmissoes(e)}>{respostaEmissoes(e)}</RespostaCurta> : null,
  };

  return (
    <>
      <CabecalhoEnergia atual="transicao" />
      <MarcaVisita secao="energia:transicao" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          siglas={["MMGD", "MWmed", "SIN", "ANEEL", "ONS", "MCTI", "IBGE"]}
          titulo={PERGUNTA_TRANSICAO}
          lead="Capacidade de geração distribuída adicionada por ano e intensidade das emissões do SIN."
          recorte={`MMGD até ${data(m.data_cadastro)} · energia estimada até ${mes(mesOns?.m)} · emissões anuais até ${e?.ultimo_ano?.ano ?? "sem dado"}`}
          fonte="ANEEL, ONS e MCTI"
          referencia={
            <>
              Cadastro de MMGD da ANEEL de {data(m.data_cadastro)}; estimativa do ONS até {data(o?.fim_serie)}; fatores de emissão do MCTI até {mes(e?.ultimo_mes?.m)}. Processado em{" "}
              {carimbo(g.gerado_em)}.
            </>
          }
          datas={
            <TransicaoDatas
              itens={[
                { rotulo: "Cadastro de MMGD (ANEEL)", texto: `até ${data(m.data_cadastro)}`, natureza: "OBSERVADO" },
                { rotulo: "MMGD estimada (ONS)", texto: o ? `${data(o.inicio_serie)} a ${data(o.fim_serie)}` : "sem dado nesta publicação", natureza: "ESTIMADO" },
                { rotulo: "Fator de emissão (MCTI)", texto: e ? `mensal até ${mes(e.ultimo_mes?.m)}, anual até ${e.ultimo_ano?.ano ?? "sem dado"}` : "sem dado nesta publicação", natureza: "ESTIMADO" },
              ]}
            />
          }
          metricas={
            <FaixaMetricas
              colunas={4}
              rotulo="Indicadores da transição"
              nota="Cada medida na sua unidade: MW (ANEEL), MWmed (ONS) e tCO2/MWh (MCTI). Não se somam nem se convertem."
            >
              <Numero
                variante="faixa"
                rotulo="MMGD cadastrada"
                natureza="OBSERVADO"
                evidencia={m.evidencias.potencia}
                casas={1}
                unidade="MW"
                periodo={`cadastro de ${data(m.data_cadastro)}`}
                cor="var(--serie-solar)"
                nota="Capacidade instalada, não energia gerada."
                endereco={`${rotaPainel("p063")}#p063`}
              />
              <Numero
                variante="faixa"
                rotulo={`MMGD conectada em ${conectada?.ano ?? "sem dado"}`}
                natureza="OBSERVADO"
                valor={conectada?.potencia_mw ?? null}
                casas={1}
                unidade="MW"
                periodo="ano completo, pela data de conexão"
                cor="var(--serie-solar)"
                nota="Capacidade adicionada no ano."
                motivoAusencia="Sem o último ano completo nesta publicação."
              />
              <Numero
                variante="faixa"
                rotulo="MMGD estimada no SIN"
                natureza="ESTIMADO"
                evidencia={o?.evidencia ?? null}
                casas={1}
                unidade="MWmed"
                periodo={mesOns ? `${mes(mesOns.m)}, mês completo` : undefined}
                cor="var(--cor-carvao)"
                nota={mesOns ? `${pctTexto(mesOns.participacao_carga_global_sin_pct, 2)} da carga global do SIN. Estimativa do ONS, não medição.` : undefined}
                motivoAusencia="Nenhum mês com os quatro submercados completos nesta publicação."
                endereco={`${rotaPainel("ons")}#ons`}
              />
              <Numero
                variante="faixa"
                rotulo={`Fator de emissão de CO2 em ${e?.ultimo_ano?.ano ?? "sem dado"}`}
                natureza="ESTIMADO"
                evidencia={e?.evidencia ?? null}
                casas={4}
                unidade="tCO2/MWh"
                periodo="média anual da geração no SIN"
                cor="var(--serie-termica)"
                nota={e?.ultimo_ano ? `${kgPorMwh(e.ultimo_ano.valor)}; só CO2 da operação das usinas.` : undefined}
                motivoAusencia="Nenhum ano completo publicado nesta versão."
                endereco={`${rotaPainel("p064")}#p064`}
              />
            </FaixaMetricas>
          }
        >
          Três perguntas, cada uma com a sua fonte e a sua unidade: onde a micro e minigeração distribuída cresce, quanta energia ela entrega ao sistema e quanto CO2 a geração emite
          por MWh. Os números são agregados por território; nenhum titular de unidade aparece aqui.
        </CabecalhoModulo>
        <TransicaoNavegacao atual="sintese" />

        <ModoProfundidade>
          <Bloco id="transicao">
            <PainelEvidencia
              id="panorama"
              pergunta="Capacidade adicionada e intensidade das emissões, em séries separadas"
              subtitulo="MMGD conectada por ano (cadastro da ANEEL, MW) e fator médio de emissão de CO2 do SIN por ano (MCTI, tCO2/MWh)"
              porQueImporta={
                <>
                  A micro e minigeração distribuída muda o que entra no sistema, e o fator de emissão diz quanto CO2 a geração emitiu por MWh. São duas séries, com fontes e unidades próprias,
                  mostradas lado a lado e lidas cada uma no seu eixo.
                </>
              }
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={m.proveniencia.cadastro}
              complementares={e ? [{ rotulo: "Fator médio de emissão (MCTI)", p: e.proveniencia.medio }] : []}
            >
              <div className="space-y-6">
                <div className="grid gap-x-10 gap-y-8 lg:grid-cols-2">
                  <div className="min-w-0 space-y-3">
                    <h3 className="sr-only">Capacidade de MMGD adicionada por ano</h3>
                    <GraficoBarras
                      titulo={`Potência de MMGD conectada por ano de conexão, Brasil (cadastro de ${data(m.data_cadastro)})`}
                      dados={anual}
                      chaveCategoria="id"
                      chaveRotulo="rotulo"
                      series={[{ id: "potencia_mw", rotulo: "Potência conectada no ano", cor: "var(--serie-solar)" }]}
                      unidade="MW"
                      casas={1}
                      altura={280}
                    />
                    <p className="text-xs leading-relaxed text-carvao-muted">{notaAnosDaCapacidade(m)}</p>
                  </div>
                  {e ? (
                    <div className="min-w-0 space-y-3">
                      <h3 className="sr-only">Intensidade de emissões da geração no SIN</h3>
                      <GraficoBarras
                        titulo="Fator médio anual de emissão de CO2 do SIN"
                        dados={dadosFatorAnual(e)}
                        chaveCategoria="id"
                        chaveRotulo="rotulo"
                        series={[{ id: "medio", rotulo: "Fator médio anual", cor: "var(--serie-termica)" }]}
                        unidade="tCO2/MWh"
                        casas={4}
                        referencias={referenciaAnual(e)}
                        altura={280}
                      />
                      <p className="text-xs leading-relaxed text-carvao-muted">
                        {periodoFator ? `Média anual de ${periodoFator.inicio} a ${periodoFator.fim}; o ano corrente não tem fator anual.` : ""} A linha tracejada é o último ano publicado.
                      </p>
                    </div>
                  ) : (
                    <p className="border border-dashed border-mineral bg-papel px-4 py-3 text-sm text-carvao">
                      Os fatores de emissão do MCTI não foram montados nesta publicação ({g.pendencias.join(" ") || "sem motivo registrado"}); nenhum fator é estimado no lugar do oficial.
                    </p>
                  )}
                </div>
                <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                  Os dois gráficos descrevem séries distintas, com períodos e universos próprios. A leitura conjunta não atribui a mudança das emissões à MMGD, e nenhuma emissão evitada é calculada.
                </p>
                <TransicaoRecorte
                  periodo={
                    <>
                      Capacidade: {anual[0]?.ano ?? primeiroCoberto} a {anual.at(-1)?.ano ?? "sem dado"} (o último ano vai até {data(m.data_cadastro)}); emissões: {periodoFator?.inicio ?? "sem dado"} a{" "}
                      {periodoFator?.fim ?? "sem dado"}
                    </>
                  }
                  universo={
                    <>
                      MMGD: {inteiro(m.resumo.unidades)} unidades no cadastro da ANEEL, no Brasil; emissões: geração despachada no SIN, sem sistemas isolados
                    </>
                  }
                  unidade="MW de potência instalada (capacidade, não energia); tCO2/MWh (só CO2 da operação, não CO2 equivalente)"
                />
                <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />

                <TransicaoCapitulos
                  itens={[
                    {
                      id: "p063",
                      resposta: respostas.p063,
                      grandeza: GRANDEZAS[0],
                      contexto: (
                        <>
                          Cadastro vigente em {data(m.data_cadastro)}, por UF, município, distribuidora e perfil; conexões por ano e mês, com os meses depois de {mes(m.corte_provisorio)}{" "}
                          provisórios; população estimada pelo IBGE para {m.ano_populacao ?? "sem dado"}.
                        </>
                      ),
                      limite: "quanta energia cada lugar gera, nem a renda de quem tem o sistema: o cadastro mede capacidade, e o crédito pode ser usado em outro município.",
                      href: `${rotaPainel("p063")}#p063`,
                    },
                    ...(o && respostas.ons
                      ? [
                          {
                            id: "ons" as const,
                            resposta: respostas.ons,
                            grandeza: GRANDEZAS[1],
                            contexto: (
                              <>
                                Carga verificada do ONS de {data(o.inicio_serie)} a {data(o.fim_serie)}, por submercado e no SIN, em MWmed e em participação na carga global.
                              </>
                            ),
                            limite: "que o valor seja medido (é estimativa da fonte), nem nada fora do SIN; e não se soma à capacidade cadastrada.",
                            href: `${rotaPainel("ons")}#ons`,
                          },
                        ]
                      : []),
                    ...(e && respostas.p064
                      ? [
                          {
                            id: "p064" as const,
                            resposta: respostas.p064,
                            grandeza: GRANDEZAS[2],
                            contexto: (
                              <>
                                Fator médio do MCTI, mensal até {mes(e.ultimo_mes?.m)} e anual até {e.ultimo_ano?.ano ?? "sem dado"}, só CO2, geração no SIN; fatores do MDL em séries separadas.
                              </>
                            ),
                            limite: "o efeito de consumir ou economizar um MWh a mais (o fator médio não é marginal), emissões em CO2 equivalente, nem intensidade por hora ou por município.",
                            href: `${rotaPainel("p064")}#p064`,
                          },
                        ]
                      : []),
                  ]}
                />
                {!o && (
                  <p className="border border-dashed border-mineral bg-papel px-4 py-3 text-sm text-carvao">
                    A estimativa de MMGD do ONS não foi montada nesta publicação ({g.pendencias.join(" ") || "sem motivo registrado"}); nenhum valor de energia é estimado no lugar.
                  </p>
                )}
                {!e && (
                  <p className="border border-dashed border-mineral bg-papel px-4 py-3 text-sm text-carvao">
                    Os fatores de emissão do MCTI não foram montados nesta publicação ({g.pendencias.join(" ") || "sem motivo registrado"}); nenhum fator é estimado no lugar do oficial.
                  </p>
                )}

                <SecaoDoPainel id="ligacoes" titulo="A mesma narrativa em outros painéis">
                  <ul className="grid gap-x-8 gap-y-4 md:grid-cols-3">
                    {LIGACOES.map((l) => (
                      <li key={l.href} className="border-l-2 border-linha pl-4 text-sm">
                        <Link href={l.href} className="inline-flex min-h-[44px] items-center font-medium text-energia-dark underline underline-offset-4 hover:text-carvao">
                          {l.rotulo}
                        </Link>
                        <p className="leading-relaxed text-carvao-muted">{l.texto}</p>
                      </li>
                    ))}
                  </ul>
                </SecaoDoPainel>

                <div id="arquivos" className="scroll-mt-28">
                  <TransicaoSeguir
                    ancora="panorama"
                    href={`${rotaPainel("p063")}#p063`}
                    pergunta={perguntaPainel("p063")}
                    downloads={g.downloads}
                  />
                  <p className="max-w-prose2 pb-1 pt-1 text-xs text-carvao-muted">CSV com ponto e vírgula, ponto decimal e campo vazio para ausência; o JSON municipal é lido pelo mapa sob demanda.</p>
                </div>
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
