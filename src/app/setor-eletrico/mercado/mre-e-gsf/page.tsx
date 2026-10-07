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
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
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
  COLUNAS_GSF,
  COLUNAS_INFOMERCADO,
  CSV_MERCADO,
  ROTULO_RESULTADO,
  barrasRiscoHidrologico,
  barrasSubmercadosGsf,
  linhasGsf,
  linhasInfoMercado,
  painelMercado,
  provenienciasLegiveis,
  reaisCurto,
  serieGeracaoGarantia,
  serieGsf,
  textoPeriodoMes,
} from "@/lib/energia/mercado";
import type { MercadoGold } from "@/lib/energia/tipos-mercado";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Mercado de energia: MRE e GSF",
  description:
    "Como foi o ajuste da garantia física das hidrelétricas do MRE: GSF mês a mês, geração e garantia física em colunas separadas, risco hidrológico que recai sobre o consumidor cativo e a conferência com o InfoMercado da CCEE.",
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

  return (
    <>
      <CabecalhoEnergia atual="mercado" />
      <MarcaVisita secao="energia:mercado:mre-gsf" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6">
        <CabecalhoModulo rotulo="Mercado de energia" titulo="Como foi o ajuste da garantia física das hidrelétricas do MRE?" referencia={<ReferenciaMercado g={g} />}>
          As hidrelétricas do <Termo slug="mre">MRE</Termo> dividem entre si o risco de gerar menos que a garantia física, porque quem decide quanto cada uma gera é o despacho centralizado. O{" "}
          <Termo slug="gsf">GSF</Termo> mede, no conjunto, quanto foi gerado em relação à garantia física ajustada; abaixo de 100%, a diferença fica exposta ao mercado de curto prazo. Parte desse risco
          recai sobre o consumidor cativo e aparece na Conta Bandeira.
        </CabecalhoModulo>
        <MercadoNavegacao atual="mre-gsf" />

        <ModoProfundidade>
          <Bloco id="mre-gsf">
            <PainelEvidencia
              id="painel-mre-gsf"
              pergunta={p?.pergunta ?? "Como foi o ajuste da garantia física das hidrelétricas do MRE?"}
              subtitulo={`GSF · % da garantia física ajustada · mensal desde ${mesAno(m.mensal[0]?.mes ?? "2023-05")}`}
              natureza="CALCULADO"
              proveniencia={prov.gsf}
              complementares={[{ rotulo: "Risco hidrológico do ACR (Conta Bandeira)", p: prov.risco_hidrologico_acr }]}
              porQueImporta={
                <>
                  Quando o GSF fica abaixo de 100%, as hidrelétricas do MRE precisam comprar no mercado de curto prazo a diferença entre o que venderam e o que geraram. Nas usinas em regime de cotas,
                  nas repactuadas e em Itaipu, esse custo é repassado ao consumidor cativo pela tarifa.
                </>
              }
              oQueMudou={
                k.gsf_ultimo_mes && k.gsf_12m ? (
                  <>
                    O GSF foi de {pct(k.gsf_ultimo_mes.valor_pct, 1)} em {mesAno(k.gsf_ultimo_mes.mes)} e de {pct(k.gsf_12m.valor_pct, 1)} nos 12 meses até {mesAno(k.gsf_12m.periodo.fim)}.
                    {anual.filter((a) => a.completo).length > 0 && (
                      <> Nos anos completos da série: {anual.filter((a) => a.completo).map((a) => `${a.ano}, ${pct(a.gsf_pct, 1)}`).join("; ")}.</>
                    )}
                  </>
                ) : (
                  <>Sem GSF publicado nesta atualização.</>
                )
              }
              comoInterpretar={
                <>
                  GSF do mês = geração das usinas do MRE ÷ garantia física modulada e ajustada pelo fator de disponibilidade, a razão que reproduz o fator publicado pela CCEE no InfoMercado. O de 12
                  meses é razão de somas em energia (MWh), não média dos fatores mensais. Geração e garantia física aparecem em colunas separadas, nunca somadas.
                </>
              }
              naoConcluir={
                <>
                  A exposição financeira de nenhuma usina ou agente: o GSF é do conjunto do MRE. Que o GSF baixo seja só falta de chuva: o despacho centralizado e a geração de outras fontes também
                  mudam a geração hidrelétrica. Que o número de 12 meses do InfoMercado e o daqui medem a mesma coisa: a divergência está publicada abaixo.
                </>
              }
            >
              <MercadoResposta
                painel="P034"
                prova={
                  <>
                    {k.gsf_ultimo_mes && <ComproveNumero evidencia={k.gsf_ultimo_mes.evidencia} rotulo="Comprove o GSF do mês" />}
                    {k.gsf_12m && <ComproveNumero evidencia={k.gsf_12m.evidencia} rotulo="Comprove o GSF de 12 meses" />}
                  </>
                }
              >
                {p?.resposta ?? "Sem resposta nesta atualização: o GSF não pôde ser calculado com a base publicada."}
              </MercadoResposta>
              <div className="mb-5 grid gap-4 sm:grid-cols-3">
                <Numero
                  rotulo="GSF do mês"
                  natureza="CALCULADO"
                  evidencia={k.gsf_ultimo_mes?.evidencia ?? null}
                  formato="pct"
                  casas={1}
                  unidade="%"
                  periodo={k.gsf_ultimo_mes ? mesAno(k.gsf_ultimo_mes.mes) : undefined}
                  tamanho="medio"
                  motivoAusencia="A CCEE não publicou o mês."
                  endereco="https://scrutiniums.com/setor-eletrico/mercado/mre-e-gsf#mre-gsf"
                />
                <Numero
                  rotulo="GSF de 12 meses"
                  natureza="CALCULADO"
                  evidencia={k.gsf_12m?.evidencia ?? null}
                  formato="pct"
                  casas={1}
                  unidade="%"
                  periodo={k.gsf_12m ? textoPeriodoMes(k.gsf_12m.periodo) : undefined}
                  nota={<>razão de somas em energia</>}
                  tamanho="medio"
                  motivoAusencia="A CCEE não publicou os 12 meses da janela."
                  endereco="https://scrutiniums.com/setor-eletrico/mercado/mre-e-gsf#mre-gsf"
                />
                <Numero
                  rotulo="Risco hidrológico do ACR, 12 meses"
                  natureza="CALCULADO"
                  evidencia={k.risco_hidrologico_acr_12m?.evidencia ?? null}
                  valor={k.risco_hidrologico_acr_12m ? k.risco_hidrologico_acr_12m.valor_rs / 1e9 : null}
                  unidade="R$ bilhões"
                  casas={2}
                  periodo={k.risco_hidrologico_acr_12m ? textoPeriodoMes(k.risco_hidrologico_acr_12m.periodo) : undefined}
                  nota={<>Itaipu, repactuadas e cotas, antes da cobertura já concedida na tarifa</>}
                  tamanho="medio"
                  motivoAusencia="A ANEEL não publicou os 12 meses da janela."
                  endereco="https://scrutiniums.com/setor-eletrico/mercado/mre-e-gsf#mre-gsf"
                />
              </div>
              <MercadoRecorte
                periodo={<>{textoPeriodoMes({ inicio: m.mensal[0]?.mes ?? "", fim: m.mensal.at(-1)?.mes ?? "" })}, mês a mês</>}
                universo="usinas participantes do MRE contabilizadas pela CCEE (SIN)"
                unidade="% (GSF); MW médios (geração e garantia física)"
              />
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

              <MercadoAnalise titulo="Submercados e risco hidrológico do consumidor cativo" id="mre-analise">
                {m.submercados_ultimo_mes.mes && (
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
                )}
                <p className="text-xs leading-relaxed text-carvao-muted">
                  Por submercado, a garantia física sazonalizada não é o denominador do GSF (que usa a garantia modulada e ajustada pela disponibilidade): a comparação mostra onde a geração ficou abaixo
                  ou acima, não o fator de cada submercado.
                </p>
                <GraficoBarras
                  titulo="Risco hidrológico do ACR por ano, por origem (Conta Bandeira)"
                  dados={rh}
                  chaveCategoria="ano"
                  chaveRotulo="rotulo"
                  series={[
                    { id: "itaipu", rotulo: "Itaipu", cor: "var(--serie-1)" },
                    { id: "repactuadas", rotulo: "Repactuadas (Lei 13.203/2015)", cor: "var(--serie-hidraulica)" },
                    { id: "ccgf", rotulo: "Cotas de garantia física", cor: "var(--serie-3)" },
                  ]}
                  unidade="R$ bilhões"
                  casas={2}
                  empilhado
                  altura={280}
                />
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
                  Previsão e prêmio de risco vêm negativos na Conta Bandeira porque já foram concedidos na tarifa; o bruto soma Itaipu, repactuadas e cotas. O ano com menos de 12 meses é parcial.
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
              </MercadoAnalise>

              <MercadoAuditoria titulo="Conferência com o InfoMercado e definições testadas" id="mre-auditoria">
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
                <MercadoDefinicoes g={g} chaves={["mre", "gsf", "risco_hidrologico_acr"]} />
              </MercadoAuditoria>

              {p && <MercadoLimitacoes painel={p} />}
              <MercadoSeguir
                ancora="mre-gsf"
                proximo={{ href: "/setor-eletrico/mercado/encargos", pergunta: "Quais custos públicos aparecem na liquidação do mercado de curto prazo?" }}
                downloads={[CSV_MERCADO.ccee, CSV_MERCADO.contaBandeira]}
              />
            </PainelEvidencia>
          </Bloco>

          <Bloco id="outras-perguntas">
            <MercadoOutrasPerguntas g={g} atual="mre-gsf" />
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
