import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { Numero } from "@/components/energia/Numero";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { TabelaDados } from "@/components/energia/TabelaDados";
import { MercadoTabelasSobDemanda } from "@/components/energia/MercadoTabelasSobDemanda";
import {
  MercadoAnalise,
  MercadoAuditoria,
  MercadoAviso,
  MercadoDefinicoes,
  MercadoIndisponivel,
  MercadoLimitacoes,
  MercadoNavegacao,
  MercadoOutrasPerguntas,
  MercadoRecorte,
  MercadoResposta,
  MercadoSeguir,
  MercadoVerificacoes,
  ReferenciaMercado,
} from "@/components/energia/MercadoPainel";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { integra, lerGold } from "@/lib/energia/gold";
import { dataBR, mesAno, num, pct } from "@/lib/energia/formato";
import {
  CSV_MERCADO,
  ROTULO_RESULTADO,
  URL_DETALHE_MERCADO,
  lacunasLiquidacao,
  notaEssMme,
  painelMercado,
  provenienciasLegiveis,
  reaisCurto,
  serieEer,
  serieEss,
  serieInadimplencia,
  serieLiquidacao,
  textoPeriodoMes,
  vereditoEncargos,
} from "@/lib/energia/mercado";
import type { MercadoGold } from "@/lib/energia/tipos-mercado";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Mercado de energia: encargos e liquidação",
  description:
    "Quais custos públicos aparecem na liquidação do mercado de curto prazo: encargos de serviços do sistema por tipo, encargo de energia de reserva, liquidação e inadimplência, com os meses sem dado rotulados e a conferência com o MME e o InfoMercado.",
  alternates: { canonical: "/setor-eletrico/mercado/encargos" },
};

export default function MercadoEncargosPage() {
  const g = lerGold<MercadoGold>("mercado.json");
  if (!integra(g)) return <MercadoIndisponivel motivo={g?.motivo} />;

  const p = painelMercado(g, "P035");
  const prov = provenienciasLegiveis(g);
  const e = g.encargos;
  const k = e.kpis;
  // últimas três liquidações informadas: o percentual de inadimplência depende do valor não pago e do valor a liquidar, e cada um se move por conta própria
  const liqs = e.liquidacao_mensal.filter((x) => x.situacao === "liquidada" && x.inadimplencia !== null && x.a_liquidar !== null).slice(-3);
  const ultimaLiq = liqs.at(-1);
  const inad = k.inadimplencia_ultimo_mes;
  const contextoInad =
    inad && ultimaLiq && ultimaLiq.mes === inad.mes && liqs.length === 3
      ? ` São ${reaisCurto(ultimaLiq.inadimplencia)} sobre ${reaisCurto(ultimaLiq.a_liquidar)} a liquidar. De ${mesAno(liqs[0].mes)} a ${mesAno(ultimaLiq.mes)}, o valor não pago ficou entre ${reaisCurto(Math.min(...liqs.map((x) => x.inadimplencia as number)))} e ${reaisCurto(Math.max(...liqs.map((x) => x.inadimplencia as number)))} e o valor a liquidar passou de ${reaisCurto(liqs[0].a_liquidar)} para ${reaisCurto(ultimaLiq.a_liquidar)}, e é por isso que o percentual sobe.`
      : "";
  const versao = `CCEE até ${g.referencias.ccee_ultimo_mes_consumo ? mesAno(g.referencias.ccee_ultimo_mes_consumo) : "sem mês"}, publicado em ${dataBR(g.gerado_em)}`;
  const lacunas = lacunasLiquidacao(g);
  const zeros = e.controles_pagamento.series.pagamento_ess ?? [];
  const resumoMme = e.mme.reconciliacao_ccee_resumo;
  const consol = e.mme.consolidacao_anual.at(-1);
  const ultimaEdicao = e.mme.edicoes.at(-1);

  return (
    <>
      <CabecalhoEnergia atual="mercado" />
      <MarcaVisita secao="energia:mercado:encargos" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo siglas={["CCEE", "MME", "EPE", "GSF", "SAMP", "ANEEL", "REN", "MRE", "SIN", "PLD", "ACL", "ACR"]} rotulo="Mercado de energia" titulo="Quais custos públicos aparecem na liquidação do mercado de curto prazo?" referencia={<ReferenciaMercado g={g} />}>
          Operar o sistema com segurança tem custos que não estão no preço da energia: geração fora da ordem de mérito, serviços ancilares, energia de reserva. Eles viram encargos (
          <Termo slug="ess">ESS</Termo> e EER), apurados pela CCEE no mês de competência e pagos depois, na liquidação do mercado de curto prazo. O observatório não publica preço de contrato: só o que a CCEE e o MME publicam.
        </CabecalhoModulo>
        <MercadoNavegacao atual="encargos" />

        <ModoProfundidade>
          <Bloco id="encargos">
            <PainelEvidencia
              id="painel-encargos"
              pergunta={p?.pergunta ?? "Quais custos públicos aparecem na liquidação do mercado de curto prazo?"}
              subtitulo={`ESS e EER · R$ milhões por mês de competência · liquidação e inadimplência · desde ${mesAno(e.ess_mensal[0]?.mes ?? "2023-07")}`}
              natureza="CALCULADO"
              proveniencia={prov.encargos_ccee}
              complementares={[{ rotulo: "Encargos no boletim do MME", p: prov.encargos_mme }]}
              porQueImporta={
                <>
                  Os encargos cobrem custos de serviços do sistema prestados aos usuários do SIN. Para o ESS de restrição de operação de eólicas e fotovoltaicas, o pagamento é proporcional ao consumo; a regra de rateio dos demais encargos e do encargo de energia de reserva não foi lida. Um mês de muita geração fora da ordem de mérito por restrição elétrica aparece aqui antes de chegar à conta de luz.
                  <span data-nivel="analisar" className="block pt-1">
                    Fundamentos: Decreto nº 5.163/2004, art. 59 (custos dos serviços do sistema); REN ANEEL nº 1.030/2022, art. 16, § 1º (pagamento proporcional ao consumo).
                  </span>
                </>
              }
              oQueMudou={
                k.ess_12m && k.eer_12m ? (
                  <>
                    Nos 12 meses até {mesAno(k.ess_12m.periodo.fim)}, o ESS somou {reaisCurto(k.ess_12m.valor_rs)} e o encargo de energia de reserva {reaisCurto(k.eer_12m.valor_rs)}.
                    {k.inadimplencia_ultimo_mes?.valor_pct !== null && k.inadimplencia_ultimo_mes?.valor_pct !== undefined && (
                      <> Na liquidação de {mesAno(k.inadimplencia_ultimo_mes.mes)}, o valor registrado como inadimplência pela CCEE foi de {pct(k.inadimplencia_ultimo_mes.valor_pct, 1)} do valor a liquidar.{contextoInad} Os comunicados da CCEE sobre a liquidação não foram consultados, e o valor efetivamente inadimplente pode diferir do valor não pago.</>
                    )}
                  </>
                ) : (
                  <>Sem soma de 12 meses nesta atualização.</>
                )
              }
              comoInterpretar={
                <>
                  Competência é o mês da contabilização; pagamento é a liquidação financeira, que sai depois e passa pelo alívio com recursos do próprio mercado. As barras somam os tipos de ESS do
                  mês; a resposta da demanda vem de conjunto próprio da CCEE e fica fora da soma. A restrição de operação reúne três encargos: <Termo slug="constrained-off">constrained-off</Termo>, constrained-on e unit commitment. Mês sem barra é ausência, com o motivo escrito: nunca zero.
                </>
              }
              naoConcluir={
                <>
                  O preço da energia nos contratos: o observatório não publica preço de contrato, e o PLD não é preço de contrato. Que inadimplência alta signifique perda
                  definitiva: o valor não pago numa liquidação pode ser pago depois. Que o pagamento publicado como zero em sequência seja zero.
                </>
              }
            >
              <MercadoResposta
                painel="P035"
                veredito={vereditoEncargos(g)}
                prova={
                  <>
                    {k.ess_12m && <ComproveNumero evidencia={k.ess_12m.evidencia} rotulo="Comprove o ESS" />}
                    {k.eer_12m && <ComproveNumero evidencia={k.eer_12m.evidencia} rotulo="Comprove o EER" />}
                    {k.inadimplencia_ultimo_mes && <ComproveNumero evidencia={k.inadimplencia_ultimo_mes.evidencia} rotulo="Comprove a inadimplência" />}
                  </>
                }
              >
                {p?.resposta ?? "Sem resposta nesta atualização: os encargos não puderam ser somados com a base publicada."}
              </MercadoResposta>
              <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Numero
                  rotulo="ESS, 12 meses"
                  natureza="CALCULADO"
                  evidencia={k.ess_12m?.evidencia ?? null}
                  valor={k.ess_12m ? k.ess_12m.valor_rs / 1e9 : null}
                  unidade="R$ bilhões"
                  casas={2}
                  periodo={k.ess_12m ? textoPeriodoMes(k.ess_12m.periodo) : undefined}
                  tamanho="medio"
                  motivoAusencia="A CCEE não publicou os 12 meses da janela."
                  endereco="https://scrutiniums.com/setor-eletrico/mercado/encargos#encargos"
                />
                <Numero
                  rotulo="Encargo de energia de reserva, 12 meses"
                  natureza="CALCULADO"
                  evidencia={k.eer_12m?.evidencia ?? null}
                  valor={k.eer_12m ? k.eer_12m.valor_rs / 1e9 : null}
                  unidade="R$ bilhões"
                  casas={2}
                  periodo={k.eer_12m ? textoPeriodoMes(k.eer_12m.periodo) : undefined}
                  tamanho="medio"
                  motivoAusencia="A CCEE não publicou os 12 meses da janela."
                  endereco="https://scrutiniums.com/setor-eletrico/mercado/encargos#encargos"
                />
                <Numero
                  rotulo="Inadimplência na liquidação"
                  natureza="CALCULADO"
                  evidencia={k.inadimplencia_ultimo_mes?.evidencia ?? null}
                  valor={k.inadimplencia_ultimo_mes?.valor_pct ?? null}
                  formato="pct"
                  casas={1}
                  unidade="%"
                  periodo={k.inadimplencia_ultimo_mes ? mesAno(k.inadimplencia_ultimo_mes.mes) : undefined}
                  nota={<>do valor a liquidar no mês</>}
                  tamanho="medio"
                  motivoAusencia="A CCEE não informou a liquidação do mês."
                  endereco="https://scrutiniums.com/setor-eletrico/mercado/encargos#encargos"
                />
                <Numero
                  rotulo="ESS no boletim do MME, ano corrente"
                  natureza="OBSERVADO"
                  evidencia={k.ess_mme_ano?.evidencia ?? null}
                  valor={k.ess_mme_ano ? k.ess_mme_ano.valor_mil_rs / 1e3 : null}
                  unidade="R$ milhões"
                  casas={1}
                  periodo={k.ess_mme_ano ? textoPeriodoMes(k.ess_mme_ano.periodo) : undefined}
                  nota={k.ess_mme_ano ? <>edição de {mesAno(k.ess_mme_ano.edicao)}, com a resposta da demanda</> : undefined}
                  tamanho="medio"
                  motivoAusencia="Sem edição do boletim no ano corrente."
                  endereco="https://scrutiniums.com/setor-eletrico/mercado/encargos#encargos"
                />
              </div>
              {notaEssMme(g) && (
                <p className="mb-5 max-w-prose2 text-sm leading-relaxed text-carvao-muted" data-nota="ess-mme">
                  {notaEssMme(g)}
                </p>
              )}
              <MercadoRecorte
                periodo={<>competência de {textoPeriodoMes({ inicio: e.ess_mensal[0]?.mes ?? "", fim: e.ess_mensal.at(-1)?.mes ?? "" })}; liquidação de {textoPeriodoMes({ inicio: e.liquidacao_mensal[0]?.mes ?? "", fim: e.liquidacao_mensal.at(-1)?.mes ?? "" })}</>}
                universo="mercado de curto prazo contabilizado pela CCEE (SIN)"
                unidade="R$ milhões nominais por mês; % do valor a liquidar"
              />
              <GraficoBarras
                titulo="Encargos de serviços do sistema por grupo, mês de competência"
                dados={serieEss(g)}
                chaveCategoria="mes"
                chaveRotulo="rotulo"
                series={[
                  { id: "restricao", rotulo: "Restrição de operação", cor: "var(--serie-termica)" },
                  { id: "ancilares", rotulo: "Serviços ancilares", cor: "var(--serie-2)" },
                  { id: "outros", rotulo: "Segurança energética, deslocamento hidráulico, importação e reserva", cor: "var(--serie-hidraulica)" },
                ]}
                unidade="R$ milhões"
                casas={1}
                empilhado
                altura={300}
              />
              <GraficoBarras
                titulo="Liquidação do mercado de curto prazo: liquidado e inadimplência"
                dados={serieLiquidacao(g)}
                chaveCategoria="mes"
                chaveRotulo="rotulo"
                series={[
                  { id: "liquidado", rotulo: "Liquidado", cor: "var(--cor-energia)" },
                  { id: "inadimplencia", rotulo: "Inadimplência", cor: "var(--serie-termica)" },
                ]}
                unidade="R$ milhões"
                casas={1}
                empilhado
                altura={300}
              />
              {lacunas.length > 0 && (
                <MercadoAviso>
                  <span data-lacunas="liquidacao">
                    Meses sem barra na liquidação: {lacunas.map((l) => `${mesAno(l.mes)}, ${l.motivo}`).join("; ")}.
                  </span>
                </MercadoAviso>
              )}
              <TabelaDados
                titulo="Encargos por mês de competência (R$ milhões)"
                colunas={["Mês", "ESS (nove tipos)", "Restrição de operação", "Serviços ancilares", "Resposta da demanda", "EER"]}
                linhas={e.ess_mensal.map((x) => {
                  const eer = e.eer_mensal.find((y) => y.mes === x.mes);
                  return [mesAno(x.mes), x.total === null ? null : x.total / 1e6, x.restricao_operacao === null ? null : x.restricao_operacao / 1e6, x.servicos_ancilares === null ? null : x.servicos_ancilares / 1e6, x.resposta_demanda === null ? null : x.resposta_demanda / 1e6, eer?.encargo_energia_reserva === null || eer === undefined ? null : eer.encargo_energia_reserva / 1e6];
                })}
                casas={[null, 1, 1, 1, 1, 1]}
                limite={40}
                csv={CSV_MERCADO.ccee.url}
              />

              <MercadoAnalise titulo="Energia de reserva, inadimplência e pagamento" id="encargos-analise">
                <GraficoBarras
                  titulo="Encargo de energia de reserva, mês de competência"
                  dados={serieEer(g)}
                  chaveCategoria="mes"
                  chaveRotulo="rotulo"
                  series={[{ id: "eer", rotulo: "Encargo de energia de reserva", cor: "var(--serie-eolica)" }]}
                  unidade="R$ milhões"
                  casas={1}
                  altura={260}
                />
                <GraficoLinhas
                  titulo="Inadimplência sobre o valor a liquidar, mês a mês"
                  dados={serieInadimplencia(g)}
                  chaveX="mes"
                  formatoX="mes"
                  series={[{ id: "inadimplencia", rotulo: "Inadimplência", cor: "var(--serie-termica)", espessura: 2.5 }]}
                  unidade="%"
                  casas={1}
                  zeroNoEixo
                  altura={240}
                />
                {zeros.length > 0 && (
                  <MercadoAviso>
                    <span data-zeros="pagamento_ess">
                      Pagamento de ESS publicado como zero de {mesAno(zeros[0].inicio)} a {mesAno(zeros[0].fim)} ({zeros[0].meses} meses seguidos) com encargo positivo na competência: o zero não é
                      confirmado por publicação independente e aparece como nulo, com a situação escrita.
                    </span>
                  </MercadoAviso>
                )}
                <MercadoTabelasSobDemanda conjunto="encargos-analise" versao={versao} downloads={[CSV_MERCADO.ccee]} />
                <TabelaDados
                  titulo="Componentes do ACR na Conta Bandeira por ano (R$ milhões, soma nacional)"
                  colunas={["Ano", "Meses", "ESS e EER", "Ressarcimento CONER", "Resultado no MCP", "CCEAR por disponibilidade", "Receita faturada das bandeiras", "Repasse à Conta Bandeira"]}
                  linhas={e.acr_conta_bandeira_anual.map((a) => [
                    a.ano,
                    a.meses,
                    a.ess_eer === null ? null : a.ess_eer / 1e6,
                    a.ressarcimento_coner === null ? null : a.ressarcimento_coner / 1e6,
                    a.resultado_mcp === null ? null : a.resultado_mcp / 1e6,
                    a.ccear_d === null ? null : a.ccear_d / 1e6,
                    a.receita_faturada_bandeiras === null ? null : a.receita_faturada_bandeiras / 1e6,
                    a.repasse_conta_bandeira === null ? null : a.repasse_conta_bandeira / 1e6,
                  ])}
                  casas={[null, 0, 1, 1, 1, 1, 1, 1]}
                  csv={CSV_MERCADO.contaBandeira.url}
                />
              </MercadoAnalise>

              <MercadoAuditoria titulo="Conferência com o MME e o InfoMercado" id="encargos-auditoria">
                {p && <MercadoVerificacoes painel={p} />}
                <p className="text-sm leading-relaxed text-carvao-muted">
                  ESS por tipo e mês × boletim de monitoramento do MME: {resumoMme.tipos.aprovados} de {resumoMme.tipos.conferidos} conferências dentro da tolerância ({resumoMme.tolerancia}); resposta da
                  demanda: {resumoMme.resposta_demanda.aprovados} de {resumoMme.resposta_demanda.conferidos}.
                  {consol && (
                    <>
                      {" "}
                      Consolidação anual de {consol.ano}: o MME publica R$ {num(consol.mme_bilhoes_rs, 1)} bilhão
                      {consol.mme_variacao_pct !== null ? <> e variação de {num(consol.mme_variacao_pct, 0)}% sobre {consol.ano_base}</> : null}; a soma do conjunto aberto dá {reaisCurto(consol.ccee_rs)}
                      {consol.ccee_variacao_pct !== null ? <> e {num(consol.ccee_variacao_pct, 1)}%</> : null}: {ROTULO_RESULTADO[consol.resultado]} ({consol.tolerancia}).
                    </>
                  )}
                  {ultimaEdicao && (
                    <>
                      {" "}
                      Última edição mensal integrada: {mesAno(ultimaEdicao.edicao)}
                      {ultimaEdicao.pagina_encargos ? <>, tabela de encargos na página {ultimaEdicao.pagina_encargos}</> : null}.
                    </>
                  )}
                </p>
                {resumoMme.fora_da_tolerancia.length > 0 && (
                  <TabelaDados
                    titulo="Conferências com o MME fora da tolerância (mil R$)"
                    colunas={["Tipo", "Mês", "Edição", "MME", "CCEE", "Diferença", "Resultado"]}
                    linhas={resumoMme.fora_da_tolerancia.map((x) => [x.tipo.replace(/_/g, " "), mesAno(x.mes), mesAno(x.edicao), x.mme_mil_rs, x.ccee_mil_rs, x.diferenca_mil_rs, x.resultado ? ROTULO_RESULTADO[x.resultado] : "sem conferência"])}
                    casas={[null, null, null, 0, 1, 1, null]}
                  />
                )}
                {e.mme.revisoes.length > 0 && (
                  <TabelaDados
                    titulo="Valores revistos entre edições do boletim do MME (mil R$)"
                    colunas={["Tipo", "Mês", "Edição anterior", "Valor anterior", "Edição seguinte", "Valor seguinte", "Diferença", "Nota"]}
                    linhas={e.mme.revisoes.map((r) => [r.tipo.replace(/_/g, " "), mesAno(r.mes), mesAno(r.edicao_anterior), r.valor_anterior_mil_rs, mesAno(r.edicao_posterior), r.valor_posterior_mil_rs, r.diferenca_mil_rs, r.nota ?? null])}
                    casas={[null, null, null, 0, null, 0, 0, null]}
                    csv={CSV_MERCADO.encargosMme.url}
                  />
                )}
                <MercadoTabelasSobDemanda conjunto="encargos-auditoria" versao={versao} downloads={[CSV_MERCADO.ccee]} />
                <p className="text-sm leading-relaxed text-carvao-muted">
                  O resultado do mercado de curto prazo por submercado, a Conta Bandeira por mês e a lista completa da conferência com o MME estão no{" "}
                  <a href={URL_DETALHE_MERCADO} download className="text-energia-dark underline underline-offset-4">
                    arquivo de detalhe do módulo (JSON)
                  </a>
                  .
                </p>
                <MercadoDefinicoes g={g} chaves={["ess", "eer", "competencia_pagamento_reprocessamento", "pld"]} />
              </MercadoAuditoria>

              {p && <MercadoLimitacoes painel={p} />}
              <MercadoSeguir
                ancora="encargos"
                proximo={{ href: "/setor-eletrico/mercado", pergunta: "Como se distribui o consumo entre o mercado livre e o regulado?" }}
                downloads={[CSV_MERCADO.ccee, CSV_MERCADO.encargosMme, CSV_MERCADO.contaBandeira]}
              />
            </PainelEvidencia>
          </Bloco>

          <Bloco id="outras-perguntas">
            <MercadoOutrasPerguntas g={g} atual="encargos" />
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
