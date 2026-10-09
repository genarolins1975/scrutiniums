import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import {
  MercadoAusencias,
  MercadoAviso,
  MercadoDefinicoes,
  MercadoIndisponivel,
  MercadoLimitacoes,
  MercadoNavegacao,
  MercadoPendenciasAuditoria,
  MercadoRecorte,
  MercadoResposta,
  MercadoVerificacoes,
  ReferenciaMercado,
} from "@/components/energia/MercadoPainel";
import { Numero } from "@/components/energia/Numero";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { SeguirPainel } from "@/components/energia/SeguirPainel";
import { TabelaDados } from "@/components/energia/TabelaDados";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { integra, lerGold } from "@/lib/energia/gold";
import { dataBR, mesAno, num, pct } from "@/lib/energia/formato";
import {
  COLUNAS_GSF,
  COLUNAS_INFOMERCADO,
  CSV_MERCADO,
  ROTULO_RESULTADO,
  TITULO_PAGINA_MERCADO,
  barrasRiscoHidrologico,
  barrasSubmercadosGsf,
  itensAusentesMercado,
  linhasGsf,
  linhasInfoMercado,
  notaGsfDozeMeses,
  painelMercado,
  provenienciasLegiveis,
  reaisCurto,
  serieGeracaoGarantia,
  serieGsf,
  textoPeriodoMes,
  vereditoGsf,
} from "@/lib/energia/mercado";
import type { MercadoGold } from "@/lib/energia/tipos-mercado";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Mercado de energia: MRE e GSF",
  description:
    "Como foi o ajuste da garantia física das hidrelétricas do MRE: GSF mês a mês, geração e garantia física em colunas separadas, risco hidrológico alocado às distribuidoras na Conta Bandeira e a conferência com o InfoMercado da CCEE.",
  alternates: { canonical: "/setor-eletrico/mercado/mre-e-gsf" },
};

export default function MercadoMreGsfPage() {
  const g = lerGold<MercadoGold>("mercado.json");
  if (!integra(g)) return <MercadoIndisponivel motivo={g?.motivo} />;

  const p = painelMercado(g, "P034");
  const prov = provenienciasLegiveis(g);
  const m = g.mre_gsf;
  const k = m.kpis;
  const versao = `CCEE até ${g.referencias.ccee_ultimo_mes_gsf ? mesAno(g.referencias.ccee_ultimo_mes_gsf) : "sem mês"}, publicado em ${dataBR(g.gerado_em)}`;
  const anual = m.anual;
  const vDiv = p?.verificacoes.find((v) => v.nome.startsWith("GSF de 12 meses"));
  const alt = k.gsf_12m?.alternativas;
  const gfFora = m.identidade_gf.filter((x) => Math.abs(x.diferenca_mwmed) > 1);
  const rh = barrasRiscoHidrologico(g);
  const ausentes = itensAusentesMercado(g).filter((i) => i.paineis.includes("P034"));

  const oQueMudou =
    k.gsf_ultimo_mes && k.gsf_12m ? (
      <>
        O GSF foi de {pct(k.gsf_ultimo_mes.valor_pct, 1)} em {mesAno(k.gsf_ultimo_mes.mes)} e de {pct(k.gsf_12m.valor_pct, 1)} nos 12 meses até {mesAno(k.gsf_12m.periodo.fim)}.
        {anual.filter((a) => a.completo).length > 0 && <> Nos anos completos da série: {anual.filter((a) => a.completo).map((a) => `${a.ano}, ${pct(a.gsf_pct, 1)}`).join("; ")}.</>}
      </>
    ) : (
      <>Sem GSF publicado nesta atualização.</>
    );
  const comoInterpretar = (
    <>
      GSF do mês = geração das usinas do MRE ÷ garantia física modulada e ajustada pelo fator de disponibilidade, a razão que reproduz o fator publicado pela CCEE no InfoMercado. O de 12 meses divide a
      soma da geração dos 12 meses pela soma da garantia física dos 12 meses (MWh); não é a média dos fatores mensais. Geração e garantia física aparecem em colunas separadas, nunca somadas.
    </>
  );
  const naoConcluir = (
    <>
      A exposição financeira de nenhuma usina ou agente: o GSF é do conjunto do MRE. Que o GSF baixo seja só falta de chuva: o despacho centralizado e a geração de outras fontes também mudam a geração
      hidrelétrica. Que o número de 12 meses do InfoMercado e o daqui medem a mesma coisa: a divergência está publicada abaixo.
    </>
  );

  return (
    <>
      <CabecalhoEnergia atual="mercado" />
      <MarcaVisita secao="energia:mercado:mre-gsf" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <MercadoNavegacao atual="mre-gsf" />
        <CabecalhoModulo
          siglas={["MRE", "GSF", "EPE", "CCEE", "SAMP", "ANEEL", "ACR", "SIN", "MWmed", "ACL", "MME"]}
          rotulo="Mercado de energia"
          titulo={TITULO_PAGINA_MERCADO["mre-gsf"]}
          lead="As hidrelétricas do Mecanismo de Realocação de Energia (MRE) dividem o risco de gerar menos que a garantia física. O GSF (Generation Scaling Factor, o fator de ajuste do MRE) mede, no conjunto, quanto foi gerado em relação a ela."
          recorte={versao}
          fonte="CCEE, Câmara de Comercialização de Energia Elétrica; ANEEL, Conta Bandeira (risco hidrológico)"
          referencia={<ReferenciaMercado g={g} />}
          metricas={
            <FaixaMetricas
              colunas={3}
              rotulo="GSF do mês, GSF de 12 meses e risco hidrológico do ACR"
              nota={
                <>
                  <span className="block">{notaGsfDozeMeses(g)}</span>
                  {k.risco_hidrologico_acr_12m && (
                    <span className="mt-2 block">
                      O risco hidrológico do ACR é o que recai sobre o consumidor cativo (usinas em cotas, usinas que repactuaram o risco com a ANEEL e Itaipu), no valor bruto, antes de descontar a previsão na
                      tarifa e o prêmio de risco; a tabela anual, no modo Analisar, mostra as deduções. A janela termina em {mesAno(prov.risco_hidrologico_acr.periodo_referencia.fim)}, o último mês da
                      Conta Bandeira que a ANEEL publicou.
                    </span>
                  )}
                </>
              }
            >
              <Numero
                variante="faixa"
                rotulo="GSF do mês"
                natureza="CALCULADO"
                evidencia={k.gsf_ultimo_mes?.evidencia ?? null}
                formato="pct"
                casas={1}
                unidade="%"
                periodo={k.gsf_ultimo_mes ? mesAno(k.gsf_ultimo_mes.mes) : undefined}
                cor="var(--serie-hidraulica)"
                nota={k.gsf_ultimo_mes ? <>para cada 100 MWh de garantia física ajustada, as hidrelétricas do MRE geraram {num(k.gsf_ultimo_mes.valor_pct, 1)} MWh</> : undefined}
                motivoAusencia="A CCEE não publicou o mês."
                endereco="https://scrutiniums.com/setor-eletrico/mercado/mre-e-gsf#mre-gsf"
              />
              <Numero
                variante="faixa"
                rotulo="GSF de 12 meses"
                natureza="CALCULADO"
                evidencia={k.gsf_12m?.evidencia ?? null}
                formato="pct"
                casas={1}
                unidade="%"
                periodo={k.gsf_12m ? textoPeriodoMes(k.gsf_12m.periodo) : undefined}
                cor="var(--serie-hidraulica)"
                motivoAusencia="A CCEE não publicou os 12 meses da janela."
                endereco="https://scrutiniums.com/setor-eletrico/mercado/mre-e-gsf#mre-gsf"
              />
              <Numero
                variante="faixa"
                rotulo="Risco hidrológico do ACR, 12 meses"
                natureza="CALCULADO"
                evidencia={k.risco_hidrologico_acr_12m?.evidencia ?? null}
                valor={k.risco_hidrologico_acr_12m ? k.risco_hidrologico_acr_12m.valor_rs / 1e9 : null}
                unidade="R$ bilhões"
                casas={2}
                periodo={k.risco_hidrologico_acr_12m ? textoPeriodoMes(k.risco_hidrologico_acr_12m.periodo) : undefined}
                motivoAusencia="A ANEEL não publicou os 12 meses da janela."
                endereco="https://scrutiniums.com/setor-eletrico/mercado/mre-e-gsf#mre-gsf"
              />
            </FaixaMetricas>
          }
        >
          As hidrelétricas do <Termo slug="mre">MRE</Termo> dividem entre si o risco de gerar menos que a garantia física, porque quem decide quanto cada uma gera é o despacho centralizado. O{" "}
          <Termo slug="gsf">GSF</Termo> mede, no conjunto, quanto foi gerado em relação à garantia física ajustada; abaixo de 100%, as hidrelétricas do mecanismo geraram, juntas, menos que a{" "}
          <Termo slug="garantia-fisica">garantia física</Termo>, e os documentos do MME registram que isso expôs agentes hidrelétricos a valores elevados de PLD. Mais abaixo, a Conta Bandeira da ANEEL mostra o
          risco hidrológico alocado às distribuidoras.
        </CabecalhoModulo>

        <ModoProfundidade>
          <Bloco id="mre-gsf">
            <PainelEvidencia
              id="painel-mre-gsf"
              pergunta="Quanto as hidrelétricas geraram da garantia física?"
              subtitulo={`GSF · % da garantia física ajustada · mensal desde ${mesAno(m.mensal[0]?.mes ?? "2023-05")}`}
              natureza="CALCULADO"
              proveniencia={prov.gsf}
              complementares={[{ rotulo: "Risco hidrológico do ACR (Conta Bandeira)", p: prov.risco_hidrologico_acr }]}
              porQueImporta={
                <>
                  Quando o GSF fica abaixo de 100%, as hidrelétricas do MRE geram, juntas, menos que a garantia física, e os documentos do MME registram a exposição a PLD elevado. Os valores da Conta
                  Bandeira, mais abaixo, são o risco hidrológico que a ANEEL publica como alocado às distribuidoras (cotas, repactuadas e Itaipu); o painel não verificou em norma como esse custo chega à
                  tarifa, e por isso não o afirma.
                </>
              }
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
            >
              <div className="space-y-6">
                <GraficoLinhas
                  titulo="GSF, fator de ajuste do MRE, mês a mês"
                  dados={serieGsf(g)}
                  chaveX="mes"
                  formatoX="mes"
                  series={[
                    { id: "gsf", rotulo: "GSF", cor: "var(--serie-hidraulica)", espessura: 2.5 },
                    { id: "cem", rotulo: "100%: geração igual à garantia física", cor: "var(--serie-referencia)", tracejada: true },
                  ]}
                  unidade="%"
                  casas={1}
                  zeroNoEixo
                  altura={280}
                />
                <MercadoRecorte
                  periodo={<>{textoPeriodoMes({ inicio: m.mensal[0]?.mes ?? "", fim: m.mensal.at(-1)?.mes ?? "" })}, mês a mês</>}
                  universo="usinas participantes do MRE contabilizadas pela CCEE (SIN)"
                  unidade="% (GSF); MW médios (geração e garantia física)"
                />
                <GraficoLinhas
                  titulo="Geração do MRE e garantia física ajustada, mês a mês"
                  dados={serieGeracaoGarantia(g)}
                  chaveX="mes"
                  formatoX="mes"
                  series={[
                    { id: "geracao", rotulo: "Geração das usinas do MRE", cor: "var(--serie-hidraulica)" },
                    { id: "garantia", rotulo: "Garantia física ajustada", cor: "var(--serie-referencia)", tracejada: true },
                  ]}
                  unidade="MWmed"
                  casas={0}
                  zeroNoEixo
                  altura={260}
                />
                <TabelaDados
                  titulo="GSF por ano"
                  colunas={["Ano", "Meses", "GSF (%)", "Situação"]}
                  linhas={anual.map((a) => [a.ano, a.meses, a.gsf_pct, a.completo ? "ano completo" : `parcial, ${textoPeriodoMes({ inicio: a.inicio, fim: a.fim })}`])}
                  casas={[null, 0, 2, null]}
                />
                <MercadoResposta painel="P034" veredito={vereditoGsf(g)}>
                  {p?.resposta ?? "Sem resposta nesta atualização: o GSF não pôde ser calculado com a base publicada."}
                </MercadoResposta>
                <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />

                {m.submercados_ultimo_mes.mes && (
                  <SecaoDoPainel
                    id="mre-submercados"
                    titulo="Em que submercados a geração ficou abaixo da garantia?"
                    lead="Geração do MRE e garantia física sazonalizada de cada submercado no último mês publicado."
                  >
                    <GraficoBarras
                      titulo={`Geração do MRE e garantia física sazonalizada por submercado, ${mesAno(m.submercados_ultimo_mes.mes)}`}
                      dados={barrasSubmercadosGsf(g)}
                      chaveCategoria="id"
                      chaveRotulo="rotulo"
                      series={[
                        { id: "geracao", rotulo: "Geração do MRE", cor: "var(--serie-hidraulica)" },
                        { id: "garantia", rotulo: "Garantia física sazonalizada", cor: "var(--serie-referencia)" },
                      ]}
                      unidade="MWmed"
                      casas={0}
                      orientacao="horizontal"
                      alturaCategoria={56}
                    />
                    <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted">
                      Por submercado, a garantia física sazonalizada não é o denominador do GSF (que usa a garantia modulada e ajustada pela disponibilidade): a comparação mostra onde a geração ficou
                      abaixo ou acima, não o fator de cada submercado.
                    </p>
                  </SecaoDoPainel>
                )}

                <SecaoDoPainel
                  id="mre-risco"
                  titulo="Quanto do risco hidrológico a ANEEL aloca às distribuidoras?"
                  lead="Risco hidrológico do ACR por ano e por origem, na Conta Bandeira da ANEEL, em R$ bilhões. A tabela com as deduções e a de cada mês estão em Analisar."
                >
                  <GraficoBarras
                    titulo="Risco hidrológico do ACR por ano, por origem (Conta Bandeira)"
                    dados={rh}
                    chaveCategoria="ano"
                    chaveRotulo="rotulo"
                    series={[
                      { id: "itaipu", rotulo: "Itaipu", cor: "var(--serie-1)" },
                      { id: "repactuadas", rotulo: "Repactuadas (Lei 13.203/2015)", cor: "var(--serie-2)" },
                      { id: "ccgf", rotulo: "Cotas de garantia física", cor: "var(--serie-3)" },
                    ]}
                    unidade="R$ bilhões"
                    casas={2}
                    empilhado
                    altura={280}
                  />
                </SecaoDoPainel>

                <MercadoAusencias id="ainda-nao" titulo="O que esta página ainda não mostra?" itens={ausentes} />

                <SecaoDoPainel id="mre-analise" nivel="analisar" titulo="Deduções do risco hidrológico e o GSF mês a mês em tabela">
                  <TabelaDados
                    titulo="Risco hidrológico do ACR e o que já estava coberto na tarifa (R$ milhões)"
                    colunas={["Ano", "Meses", "Itaipu", "Repactuadas", "Cotas", "Bruto", "Previsão na tarifa", "Prêmio de risco", "Cotas e repactuadas líquido"]}
                    linhas={m.risco_hidrologico_acr.anual.map((a) => [
                      a.ano,
                      a.meses,
                      a.rh_itaipu === null ? null : a.rh_itaipu / 1e6,
                      a.rh_repactuadas === null ? null : a.rh_repactuadas / 1e6,
                      a.rh_ccgf === null ? null : a.rh_ccgf / 1e6,
                      a.rh_bruto === null ? null : a.rh_bruto / 1e6,
                      a.previsao_rh === null ? null : a.previsao_rh / 1e6,
                      a.premio_risco === null ? null : a.premio_risco / 1e6,
                      a.rh_ccgf_repactuadas_liquido === null ? null : a.rh_ccgf_repactuadas_liquido / 1e6,
                    ])}
                    casas={[null, 0, 1, 1, 1, 1, 1, 1, 1]}
                    csv={CSV_MERCADO.contaBandeira.url}
                  />
                  <p className="text-xs leading-relaxed text-carvao-muted">
                    Previsão e prêmio de risco entram negativos porque a ANEEL os deduz do custo bruto: a previsão é a de risco hidrológico considerada nos processos tarifários das distribuidoras, e o prêmio
                    é o das usinas repactuadas (dicionário da Conta Bandeira da ANEEL). O bruto soma Itaipu, repactuadas e cotas. O ano com menos de 12 meses é parcial.
                  </p>
                  <TabelaInterativa
                    titulo="GSF, geração e garantia física por mês"
                    colunas={COLUNAS_GSF}
                    linhas={linhasGsf(g)}
                    chaveLinha="id"
                    colunaRotulo="mes"
                    fonte="CCEE, MRE_MENSAL, GERACAO_SUBMERCADO e GARANTIA_FISICA_SAZO_MRE_SUBMERCADO"
                    versao={versao}
                    nomeArquivo="mercado-gsf"
                    chaveUrl="gsf"
                    ordemInicial={{ coluna: "mes", direcao: "desc" }}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="mre-auditoria" nivel="auditar" titulo="Conferência com o InfoMercado, pendências e definições testadas">
                  {p && <MercadoVerificacoes painel={p} />}
                  {vDiv && vDiv.resultado !== "aprovado" && (
                    <MercadoAviso>
                      O InfoMercado publica um &quot;ajuste médio do MRE nos últimos doze meses&quot; que nenhuma definição testada reproduz.
                      {alt && (
                        <>
                          {" "}
                          Para a janela de {k.gsf_12m ? textoPeriodoMes(k.gsf_12m.periodo) : "12 meses"}: razão de energias {pct(k.gsf_12m?.valor_pct, 2)} (a adotada), média simples dos fatores mensais{" "}
                          {pct(alt.media_simples_pct, 2)}, razão sobre a garantia física sazonalizada {pct(alt.razao_gf_sazonalizada_pct, 2)} e acumulado do ano {pct(alt.acumulado_ano_pct, 2)}.
                        </>
                      )}{" "}
                      A divergência fica publicada como ressalva, sem ajuste para coincidir.
                    </MercadoAviso>
                  )}
                  <TabelaInterativa
                    titulo="GSF calculado × fator publicado no InfoMercado da CCEE"
                    colunas={COLUNAS_INFOMERCADO}
                    linhas={linhasInfoMercado(m.reconciliacao_infomercado)}
                    chaveLinha="id"
                    colunaRotulo="medida"
                    fonte="CCEE, InfoMercado mensal (PDF) e conjuntos abertos"
                    versao={versao}
                    nomeArquivo="mercado-infomercado-gsf"
                    chaveUrl="im"
                  />
                  <p className="text-sm leading-relaxed text-carvao-muted">
                    Garantia física por submercado somada × total do MRE: {m.identidade_gf.length - gfFora.length} de {m.identidade_gf.length} meses com diferença de até 1 MW médio
                    {gfFora.length ? ` (fora: ${gfFora.map((x) => `${mesAno(x.mes)}, ${num(x.diferenca_mwmed, 1)}`).join("; ")})` : ""}. Resultado das conferências com o InfoMercado:{" "}
                    {m.reconciliacao_infomercado.filter((c) => c.resultado === "aprovado").length} {ROTULO_RESULTADO.aprovado} e{" "}
                    {m.reconciliacao_infomercado.filter((c) => c.resultado !== "aprovado").length} {ROTULO_RESULTADO.ressalva}. Risco hidrológico do ACR em 12 meses:{" "}
                    {reaisCurto(k.risco_hidrologico_acr_12m?.valor_rs)}.
                  </p>
                  <MercadoPendenciasAuditoria g={{ pendencias: g.pendencias.filter((x) => x.paineis.includes("P034")), bloqueios: g.bloqueios.filter((x) => x.paineis.includes("P034")) }} />
                  <p className="text-sm leading-relaxed text-carvao-muted" data-definicoes-operacionais="true">
                    As três definições abaixo são operacionais: o observatório as escreveu para ler este painel. Não são a definição regulatória nem foram conferidas em norma (as Leis nº 12.783/2013 e
                    nº 13.203/2015 e as Regras de Comercialização da CCEE não foram lidas). A leitura conferida de MRE e de GSF, com o trecho literal das fontes e o que não foi lido, está nos verbetes do
                    Aprenda.
                  </p>
                  <MercadoDefinicoes g={g} chaves={["mre", "gsf", "risco_hidrologico_acr"]} />
                </SecaoDoPainel>

                {p && <MercadoLimitacoes painel={p} />}
                <SeguirPainel
                  ancora="mre-gsf"
                  proximo={{ href: "/setor-eletrico/mercado/encargos", pergunta: TITULO_PAGINA_MERCADO.encargos }}
                  downloads={[CSV_MERCADO.ccee, CSV_MERCADO.contaBandeira]}
                />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
