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
import { carimbo, dataBR, mesAno, num, pct } from "@/lib/energia/formato";
import { datasLegiveis } from "@/lib/energia/visao";
import {
  COLUNAS_DISTRIBUIDORAS,
  CSV_MERCADO,
  NOME_SUBSISTEMA,
  ROTULO_RESULTADO,
  anoClasseCompleto,
  barrasClasse,
  barrasUf,
  linhasDistribuidoras,
  painelMercado,
  provenienciasLegiveis,
  serieAmbientesCcee,
  serieComparacaoUniversos,
  serieLivreEpe,
  serieLivreEpeAnual,
  textoPeriodoMes,
  textoVariacaoPp,
} from "@/lib/energia/mercado";
import type { MercadoGold } from "@/lib/energia/tipos-mercado";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Mercado de energia: livre e regulado",
  description:
    "Quanto do consumo de energia elétrica está no mercado livre e quanto no regulado, em três universos com perímetros diferentes (EPE, CCEE e SAMP), com a fonte e as conferências de cada número.",
  alternates: { canonical: "/setor-eletrico/mercado" },
};

export default function MercadoPage() {
  const g = lerGold<MercadoGold>("mercado.json");
  if (!integra(g)) return <MercadoIndisponivel motivo={g?.motivo} />;

  const p = painelMercado(g, "P032");
  const prov = provenienciasLegiveis(g);
  const lr = g.livre_regulado;
  const k = lr.kpis;
  const kAcl = k.participacao_acl_ccee_12m;
  const kGsf = g.mre_gsf.kpis.gsf_ultimo_mes;
  const kEss = g.encargos.kpis.ess_12m;
  const versao = `EPE até ${mesAno(lr.epe_ultimo_mes)}, CCEE até ${g.referencias.ccee_ultimo_mes_consumo ? mesAno(g.referencias.ccee_ultimo_mes_consumo) : "sem mês"}, publicado em ${dataBR(g.gerado_em)}`;
  const anoClasse = anoClasseCompleto(g);
  const uf = barrasUf(g);
  const preliminares = lr.epe_anos_preliminares;
  const ultimoCcee = lr.ccee_mensal.at(-1);
  const consol = lr.reconciliacao.mme_consolidacao_anual.at(-1);
  const planilha = lr.reconciliacao.epe_planilha;
  const identidadeFora = lr.ccee_identidade_classes.filter((x) => !x.ok);
  const decisao = g.acesso_ccee.decisao;
  const sampComparaveis = lr.samp_nacional_mensal.filter((s) => s.comparavel);
  const sampUltimo = sampComparaveis.at(-1);

  return (
    <>
      <CabecalhoEnergia atual="mercado" />
      <MarcaVisita secao="energia:mercado" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6">
        <CabecalhoModulo siglas={["PLD", "SIN", "MWmed"]} rotulo="Mercado de energia" titulo="Como a energia é contratada, alocada e liquidada?" referencia={<ReferenciaMercado g={g} />}>
          Parte do consumo compra energia da distribuidora a tarifa regulada (<Termo slug="acr">ACR</Termo>); a outra parte contrata no mercado livre (<Termo slug="acl">ACL</Termo>). As diferenças
          entre o contratado e o medido são liquidadas na CCEE ao <Termo slug="pld">PLD</Termo>, as hidrelétricas dividem o risco hidrológico no <Termo slug="mre">MRE</Termo> e os custos de operar o sistema
          entram como encargos (<Termo slug="ess">ESS</Termo>). Quatro painéis respondem a quatro perguntas, cada número com a fonte e a conferência com a publicação oficial.
        </CabecalhoModulo>
        <MercadoNavegacao atual="livre-regulado" />

        <ModoProfundidade>
          <Bloco id="resumo">
            <section aria-labelledby="mercado-resumo" className="border border-linha bg-superficie px-5 py-6 md:px-8">
              <h2 id="mercado-resumo" className="font-serif text-xl text-carvao md:text-2xl">
                O mercado em quatro números
              </h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Numero
                  rotulo="Mercado livre no consumo na rede (EPE), 12 meses"
                  natureza="CALCULADO"
                  evidencia={k.participacao_livre_12m?.evidencia ?? null}
                  formato="pct"
                  casas={1}
                  unidade="%"
                  periodo={k.participacao_livre_12m ? textoPeriodoMes(k.participacao_livre_12m.periodo) : undefined}
                  variacao={
                    k.participacao_livre_12m?.anterior_pct !== null && k.participacao_livre_12m?.anterior_pct !== undefined
                      ? { valor: k.participacao_livre_12m.valor_pct - k.participacao_livre_12m.anterior_pct, casas: 1, sufixo: " p.p.", referencia: "contra os 12 meses anteriores" }
                      : undefined
                  }
                  motivoAusencia="A EPE não publicou os 12 meses da janela."
                  endereco="https://scrutiniums.com/setor-eletrico/mercado#resumo"
                />
                <Numero
                  rotulo="ACL no consumo contabilizado (CCEE), 12 meses"
                  natureza="CALCULADO"
                  evidencia={kAcl?.evidencia ?? null}
                  formato="pct"
                  casas={1}
                  unidade="%"
                  periodo={kAcl ? textoPeriodoMes(kAcl.periodo) : undefined}
                  nota={kAcl?.com_exportacao_pct !== null && kAcl?.com_exportacao_pct !== undefined ? <>sem a exportação; {pct(kAcl.com_exportacao_pct, 1)} com ela</> : undefined}
                  motivoAusencia="A CCEE não publicou os 12 meses da janela."
                  endereco="https://scrutiniums.com/setor-eletrico/mercado#resumo"
                />
                <Numero
                  rotulo="GSF, fator de ajuste do MRE"
                  natureza="CALCULADO"
                  evidencia={kGsf?.evidencia ?? null}
                  formato="pct"
                  casas={1}
                  unidade="%"
                  periodo={kGsf ? mesAno(kGsf.mes) : undefined}
                  nota={<>geração das hidrelétricas do MRE sobre a garantia física ajustada</>}
                  motivoAusencia="A CCEE não publicou o mês."
                  endereco="https://scrutiniums.com/setor-eletrico/mercado#resumo"
                />
                <Numero
                  rotulo="Encargos de serviços do sistema, 12 meses"
                  natureza="CALCULADO"
                  evidencia={kEss?.evidencia ?? null}
                  valor={kEss ? kEss.valor_rs / 1e9 : null}
                  unidade="R$ bilhões"
                  casas={2}
                  periodo={kEss ? textoPeriodoMes(kEss.periodo) : undefined}
                  nota={<>por mês de competência, soma dos nove tipos</>}
                  motivoAusencia="A CCEE não publicou os 12 meses da janela."
                  endereco="https://scrutiniums.com/setor-eletrico/mercado#resumo"
                />
              </div>
            </section>
          </Bloco>

          <Bloco id="livre-regulado">
            <PainelEvidencia
              id="painel-livre-regulado"
              pergunta={p?.pergunta ?? "Como se distribui o consumo entre o mercado livre e o regulado?"}
              subtitulo={`Participação do livre no consumo · % · EPE desde ${lr.epe_mensal_desde.slice(0, 4)} e CCEE desde ${mesAno(lr.ccee_mensal[0]?.mes ?? "2023-05")}`}
              natureza="CALCULADO"
              proveniencia={prov.consumo_epe}
              complementares={[
                { rotulo: "Consumo contabilizado pela CCEE", p: prov.consumo_ccee },
                { rotulo: "Mercado faturado das distribuidoras (SAMP)", p: prov.distribuidoras_samp },
              ]}
              porQueImporta={
                <>
                  O consumidor livre compra energia em contrato bilateral e paga à distribuidora só o uso da rede; o cativo paga a energia na tarifa regulada. Quanto maior a parte livre, menor o mercado
                  sobre o qual a distribuidora reparte os custos da energia que contratou em leilão.
                </>
              }
              oQueMudou={
                k.participacao_livre_12m ? (
                  <>
                    Na EPE, a participação de 12 meses foi de {pct(k.participacao_livre_12m.valor_pct, 1)} até {mesAno(k.participacao_livre_12m.periodo.fim)}
                    {k.participacao_livre_12m.anterior_pct !== null ? <>, contra {pct(k.participacao_livre_12m.anterior_pct, 1)} nos 12 meses anteriores ({textoVariacaoPp(k.participacao_livre_12m.valor_pct, k.participacao_livre_12m.anterior_pct)})</> : null}.
                    {kAcl?.variacao_acl_ultimo_mes && (
                      <>
                        {" "}
                        Na CCEE, o consumo do ACL de {mesAno(kAcl.variacao_acl_ultimo_mes.mes)} variou {num(kAcl.variacao_acl_ultimo_mes.sem_exportacao_pct, 1)}% contra o mesmo mês do ano anterior, sem a
                        exportação.
                      </>
                    )}
                  </>
                ) : (
                  <>Sem janela de 12 meses completa na EPE nesta atualização.</>
                )
              }
              comoInterpretar={
                <>
                  Três universos convivem e nenhum é a carga do ONS. A EPE mede o consumo na rede (cativo e livre) informado pelos agentes. A CCEE mede o consumo contabilizado no centro de gravidade de
                  cada submercado, com as perdas da rede básica rateadas, e por isso a participação do ACL na CCEE é menor que a do livre na EPE. O SAMP da ANEEL mede o faturado por distribuidora e deixa
                  fora o consumidor livre ligado direto à rede básica. Cada participação é razão de somas em energia, nunca média de percentuais.
                </>
              }
              naoConcluir={
                <>
                  Que o livre tenha energia mais barata ou mais cara: o observatório não publica preço de contrato. Que a diferença entre a EPE e a CCEE seja erro de uma delas: os perímetros são
                  diferentes. Que a migração de um mês explique a variação da participação, que também muda com o consumo de quem já estava em cada ambiente.
                </>
              }
            >
              <MercadoResposta
                painel="P032"
                prova={
                  <>
                    {k.participacao_livre_12m && <ComproveNumero evidencia={k.participacao_livre_12m.evidencia} rotulo="Comprove a participação na EPE" />}
                    {kAcl && <ComproveNumero evidencia={kAcl.evidencia} rotulo="Comprove a participação na CCEE" />}
                  </>
                }
              >
                {p?.resposta ?? "Sem resposta nesta atualização: a participação de 12 meses não pôde ser calculada com a base publicada."}
              </MercadoResposta>
              <MercadoRecorte
                periodo={
                  <>
                    EPE de {mesAno(lr.epe_mensal_desde)} a {mesAno(lr.epe_ultimo_mes)} (desde 2004 no CSV e na série anual); CCEE de {textoPeriodoMes({ inicio: lr.ccee_mensal[0]?.mes ?? lr.epe_ultimo_mes, fim: lr.ccee_mensal.at(-1)?.mes ?? lr.epe_ultimo_mes })}
                  </>
                }
                universo="consumo na rede (EPE, Brasil); consumo contabilizado no mercado de curto prazo (CCEE, SIN)"
                unidade="% do consumo do universo; MW médios na CCEE"
              />
              {preliminares.length > 0 && (
                <MercadoAviso>
                  A EPE marca como preliminares os dados de {preliminares.join(", ")}: os meses desses anos podem ser revistos na próxima publicação, e a revisão fica registrada no histórico de capturas.
                </MercadoAviso>
              )}
              <GraficoLinhas
                titulo="Participação do mercado livre no consumo na rede, mês a mês (EPE)"
                dados={serieLivreEpe(g)}
                chaveX="mes"
                formatoX="mes"
                series={[{ id: "livre", rotulo: "Livre no consumo na rede", cor: "var(--cor-energia)", espessura: 2.5 }]}
                unidade="%"
                casas={1}
                zeroNoEixo
                zoom
                altura={280}
              />
              <GraficoBarras
                titulo="Consumo contabilizado pela CCEE por ambiente, mês a mês"
                dados={serieAmbientesCcee(g)}
                chaveCategoria="mes"
                chaveRotulo="rotulo"
                series={[
                  { id: "acr", rotulo: "ACR (distribuidoras)", cor: "var(--serie-3)" },
                  { id: "acl", rotulo: "ACL", cor: "var(--cor-energia)" },
                  { id: "exportacao", rotulo: "Exportação (fora do ACL)", cor: "var(--serie-referencia)" },
                ]}
                unidade="MWmed"
                casas={0}
                empilhado
                altura={300}
              />
              {ultimoCcee && (
                <p className="mt-2 text-xs leading-relaxed text-carvao-muted">
                  Em {mesAno(ultimoCcee.mes)}: ACR {num(ultimoCcee.acr_mwmed, 0)} MW médios, ACL {num(ultimoCcee.acl_mwmed, 0)} e exportação {num(ultimoCcee.exportacao_mwmed, 0)}; o ACL teve{" "}
                  {pct(ultimoCcee.acl_pct, 2)} do consumo sem a exportação e {pct(ultimoCcee.acl_com_exportacao_pct, 2)} com ela.
                </p>
              )}
              <TabelaDados
                titulo="Consumo contabilizado pela CCEE por ambiente"
                colunas={["Mês", "ACR (MWmed)", "ACL (MWmed)", "Exportação (MWmed)", "ACL sem exportação (%)", "ACL com exportação (%)"]}
                linhas={lr.ccee_mensal.map((m) => [mesAno(m.mes), m.acr_mwmed, m.acl_mwmed, m.exportacao_mwmed, m.acl_pct, m.acl_com_exportacao_pct])}
                casas={[null, 1, 1, 1, 2, 2]}
                limite={48}
                csv={CSV_MERCADO.ccee.url}
              />

              <MercadoAnalise titulo="Os dois universos lado a lado, por UF, classe e distribuidora" id="livre-analise">
                <GraficoLinhas
                  titulo="Participação do livre: EPE (consumo na rede) e CCEE (consumo contabilizado)"
                  dados={serieComparacaoUniversos(g)}
                  chaveX="mes"
                  formatoX="mes"
                  series={[
                    { id: "epe", rotulo: "EPE, livre no consumo na rede", cor: "var(--cor-energia)" },
                    { id: "ccee", rotulo: "CCEE, ACL sem a exportação", cor: "var(--serie-comp-1)", tracejada: true },
                  ]}
                  unidade="%"
                  casas={1}
                  altura={260}
                />
                <GraficoLinhas
                  titulo={`Participação do livre por ano desde ${serieLivreEpeAnual(g)[0]?.ano ?? "2004"} (EPE, anos completos)`}
                  dados={serieLivreEpeAnual(g)}
                  chaveX="ano"
                  formatoX="texto"
                  series={[{ id: "livre", rotulo: "Livre no consumo na rede", cor: "var(--cor-energia)", espessura: 2.5 }]}
                  unidade="%"
                  casas={1}
                  zeroNoEixo
                  altura={240}
                />
                <GraficoBarras
                  titulo={`Participação do livre por UF, 12 meses até ${lr.epe_ultimo_mes_uf ? mesAno(lr.epe_ultimo_mes_uf) : "o último mês publicado"}`}
                  dados={uf}
                  chaveCategoria="uf"
                  series={[{ id: "livre", rotulo: "Livre no consumo na rede", cor: "var(--cor-energia)" }]}
                  unidade="%"
                  casas={1}
                  orientacao="horizontal"
                  alturaCategoria={28}
                  alturaMaxima={760}
                  referencias={k.participacao_livre_12m ? [{ valor: k.participacao_livre_12m.valor_pct, rotulo: "Brasil, 12 meses" }] : []}
                />
                {anoClasse && (
                  <GraficoBarras
                    titulo={`Participação do livre por classe de consumo, ${anoClasse}`}
                    dados={barrasClasse(g, anoClasse)}
                    chaveCategoria="classe"
                    series={[{ id: "livre", rotulo: "Livre no consumo da classe", cor: "var(--cor-energia)" }]}
                    unidade="%"
                    casas={1}
                    orientacao="horizontal"
                    alturaCategoria={44}
                    rotulosValor
                  />
                )}
                <TabelaDados
                  titulo="Livre e cativo por subsistema da EPE, 12 meses"
                  colunas={["Subsistema", "Cativo (GWh)", "Livre (GWh)", "Livre (%)", "Unidades livres"]}
                  linhas={lr.epe_subsistema_12m.map((s) => [NOME_SUBSISTEMA[s.chave] ?? s.chave, s.cativo_mwh === null ? null : s.cativo_mwh / 1e3, s.livre_mwh === null ? null : s.livre_mwh / 1e3, s.livre_pct, s.livre_uc])}
                  casas={[null, 0, 0, 2, 0]}
                  csv={CSV_MERCADO.consumo.url}
                />
                <TabelaInterativa
                  titulo={`As ${lr.distribuidoras.na_gold} distribuidoras com mais energia livre faturada em ${lr.distribuidoras.ano ?? "ano não publicado"} (SAMP)`}
                  colunas={COLUNAS_DISTRIBUIDORAS}
                  linhas={linhasDistribuidoras(g)}
                  chaveLinha="id"
                  colunaRotulo="sigla"
                  fonte="ANEEL, SAMP (mercado faturado por distribuidora)"
                  versao={versao}
                  nomeArquivo="mercado-distribuidoras"
                  chaveUrl="dist"
                  ordemInicial={{ coluna: "livre_gwh", direcao: "desc" }}
                  nota={`${lr.distribuidoras.criterio}; ${lr.distribuidoras.total} distribuidoras no ano. O faturado da distribuidora não inclui o consumidor livre ligado direto à rede básica.`}
                />
              </MercadoAnalise>

              <MercadoAuditoria titulo="Conferências, estado do painel e acesso à CCEE" id="livre-auditoria">
                {p && <MercadoVerificacoes painel={p} />}
                <p className="text-sm leading-relaxed text-carvao-muted">
                  Planilha formatada da EPE × tabela longa dos dados abertos: {num(planilha.comparacoes, 0)} comparações, {num(planilha.falhas, 0)} acima da tolerância ({planilha.tolerancia}); resultado{" "}
                  {ROTULO_RESULTADO[planilha.resultado]}.
                  {consol && (
                    <>
                      {" "}
                      Consolidação anual do MME para {consol.ano}: ACL com {pct(consol.mme_acl_pct, 1)} de {num(consol.mme_consumo_gwh, 0)} GWh; EPE com {pct(consol.epe_livre_pct, 2)} de{" "}
                      {num(consol.epe_total_gwh, 0)} GWh ({num(consol.diferenca_pp, 2)} p.p.): {ROTULO_RESULTADO[consol.resultado ?? "ressalva"]}, divergência publicada pela fonte e mantida à vista.
                    </>
                  )}{" "}
                  Identidade das classes da CCEE com o conjunto por ambiente: {lr.ccee_identidade_classes.length - identidadeFora.length} de {lr.ccee_identidade_classes.length} meses dentro de 5 MW
                  médios{identidadeFora.length ? ` (fora: ${identidadeFora.map((x) => mesAno(x.mes)).join(", ")})` : ""}.
                </p>
                <TabelaDados
                  titulo="Consumo por ambiente no boletim do MME × EPE (GWh)"
                  colunas={["Edição", "Mês", "Ambiente", "Medida", "MME (GWh)", "EPE (GWh)", "Diferença (GWh)", "Resultado"]}
                  linhas={lr.reconciliacao.mme.map((r) => [mesAno(r.edicao), mesAno(r.mes), r.ambiente, r.medida === "mes" ? "mês" : "12 meses", r.mme_gwh, r.epe_gwh, r.diferenca_gwh, r.resultado ? ROTULO_RESULTADO[r.resultado] : "sem conferência"])}
                  casas={[null, null, null, null, 0, 1, 1, null]}
                  limite={40}
                  csv={CSV_MERCADO.nacional.url}
                />
                <TabelaDados
                  titulo="Consumo na rede (EPE) sobre a carga do boletim do MME"
                  colunas={["Mês", "Carga (GWh)", "Perdas e diferenças (GWh)", "Consumo EPE (GWh)", "Consumo sobre carga (%)"]}
                  linhas={lr.carga_contexto.map((c) => [mesAno(c.mes), c.carga_gwh, c.perdas_diferencas_gwh, c.consumo_epe_gwh, c.consumo_sobre_carga_pct])}
                  casas={[null, 0, 0, 1, 1]}
                />
                <p className="text-sm leading-relaxed text-carvao-muted">
                  SAMP: {sampComparaveis.length} de {lr.samp_nacional_mensal.length} meses desde {mesAno(lr.samp_nacional_mensal_desde)} são comparáveis com a EPE
                  {sampUltimo ? <> (o último é {mesAno(sampUltimo.mes)}, com {pct(sampUltimo.samp_sobre_epe_uc_pct, 1)} das unidades livres da EPE)</> : null}; os demais têm distribuidora sem linhas do
                  mercado livre, linhas repetidas do mês anterior ou menos distribuidoras que o usual, e ficam fora da comparação.
                </p>
                <MercadoTabelasSobDemanda conjunto="livre-auditoria" versao={versao} downloads={[CSV_MERCADO.nacional, CSV_MERCADO.ccee]} />
                <div className="space-y-2 text-sm leading-relaxed text-carvao-muted" data-acesso-ccee={decisao.situacao}>
                  <p className="rotulo text-mineral">Acesso ao portal da CCEE</p>
                  <p>{datasLegiveis(g.acesso_ccee.observacao)}</p>
                  <p>
                    Decisão registrada em {dataBR(decisao.registrada_em)}
                    {decisao.decidida_em ? <> e tomada em {dataBR(decisao.decidida_em)}</> : null}: {decisao.resposta ?? "pendente."} Coleta neste ambiente: {decisao.coleta_neste_ambiente}.
                  </p>
                  <p>
                    {g.ccee_conjuntos.length} conjuntos abertos da CCEE alimentam o módulo;{" "}
                    {g.ccee_conjuntos.filter((c) => c.ultima_tentativa_ok).length} responderam na última tentativa
                    {g.ccee_conjuntos[0]?.ultima_tentativa ? <> ({carimbo(g.ccee_conjuntos.map((c) => c.ultima_tentativa ?? "").sort().at(-1))})</> : null}.
                  </p>
                </div>
                <MercadoDefinicoes g={g} chaves={["acl", "acr", "exportacao", "unidade_consumidora", "pld"]} />
              </MercadoAuditoria>

              {p && <MercadoLimitacoes painel={p} />}
              <MercadoSeguir
                ancora="livre-regulado"
                proximo={{ href: "/setor-eletrico/mercado/agentes", pergunta: "Quem participa do mercado e como a composição mudou?" }}
                downloads={[CSV_MERCADO.nacional, CSV_MERCADO.ccee, CSV_MERCADO.consumo, CSV_MERCADO.uf, CSV_MERCADO.distribuidorasAno, CSV_MERCADO.distribuidorasMes]}
              />
            </PainelEvidencia>
          </Bloco>

          <Bloco id="outras-perguntas">
            <MercadoOutrasPerguntas g={g} atual="livre-regulado" />
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
