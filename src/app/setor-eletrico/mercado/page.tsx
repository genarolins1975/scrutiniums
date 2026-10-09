import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { MercadoTabelasSobDemanda } from "@/components/energia/MercadoTabelasSobDemanda";
import {
  MercadoAusencias,
  MercadoAviso,
  MercadoCapitulos,
  MercadoDefinicoes,
  MercadoIndisponivel,
  MercadoLimitacoes,
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
import { catalogoDados } from "@/lib/energia/datasets";
import { carimbo, dataBR, mesAno, num, pct } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import {
  COLUNAS_DISTRIBUIDORAS,
  CSV_MERCADO,
  NOME_SUBSISTEMA,
  ROTULO_RESULTADO,
  TITULO_PAGINA_MERCADO,
  anoClasseCompleto,
  barrasClasse,
  barrasUf,
  itensAusentesMercado,
  linhasCatalogoMercado,
  linhasDistribuidoras,
  notaDoisUniversos,
  painelMercado,
  provenienciasLegiveis,
  resumoCatalogoMercado,
  serieAmbientesCcee,
  serieComparacaoUniversos,
  serieLivreEpe,
  serieLivreEpeAnual,
  textoContratosAusentes,
  textoFontesPublicadas,
  textoPeriodoMes,
  textoRazaoUniversos,
  textoVariacaoPp,
  textoVariacaoVerbo,
  vereditoLivreRegulado,
} from "@/lib/energia/mercado";
import type { MercadoGold } from "@/lib/energia/tipos-mercado";
import { datasLegiveis } from "@/lib/energia/visao";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Mercado de energia: livre e regulado",
  description:
    "Quanto do consumo de energia elétrica está no mercado livre e quanto no regulado, em três universos com perímetros diferentes (EPE, CCEE e SAMP), com a fonte e as conferências de cada número e o que o observatório ainda não mostra sobre contratos.",
  alternates: { canonical: "/setor-eletrico/mercado" },
};

export default function MercadoPage() {
  const g = lerGold<MercadoGold>("mercado.json");
  if (!integra(g)) return <MercadoIndisponivel motivo={g?.motivo} />;

  const p = painelMercado(g, "P032");
  const prov = provenienciasLegiveis(g);
  const lr = g.livre_regulado;
  const k = lr.kpis;
  const kEpe = k.participacao_livre_12m;
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
  const entradasCatalogo = catalogoDados()?.entradas ?? [];
  const catalogo = resumoCatalogoMercado(entradasCatalogo);
  const contratos = textoContratosAusentes(catalogo);
  const ausentes = [...(contratos ? [{ id: "contratos", titulo: "Contratos de energia", texto: contratos, paineis: ["P032"] }] : []), ...itensAusentesMercado(g)];
  const nota = notaDoisUniversos(g);
  const razao = textoRazaoUniversos(g);

  const oQueMudou = kEpe ? (
    <>
      Na EPE, a participação de 12 meses foi de {pct(kEpe.valor_pct, 1)} até {mesAno(kEpe.periodo.fim)}
      {kEpe.anterior_pct !== null ? <>, contra {pct(kEpe.anterior_pct, 1)} nos 12 meses anteriores ({textoVariacaoPp(kEpe.valor_pct, kEpe.anterior_pct)?.replace("p.p.", "pontos percentuais")})</> : null}.
      {kAcl?.variacao_acl_ultimo_mes && (
        <>
          {" "}
          Na CCEE, o consumo do ACL de {mesAno(kAcl.variacao_acl_ultimo_mes.mes)} {textoVariacaoVerbo(kAcl.variacao_acl_ultimo_mes.sem_exportacao_pct, 1)} contra o mesmo mês do ano anterior, sem a
          exportação.
        </>
      )}
    </>
  ) : (
    <>Sem janela de 12 meses completa na EPE nesta atualização.</>
  );
  const comoInterpretar = (
    <>
      Três universos convivem e nenhum é a carga do ONS. A EPE mede o consumo na rede (cativo e livre) informado pelos agentes. A CCEE mede o consumo contabilizado no centro de gravidade de cada
      submercado, já com 50% das perdas da rede básica (nota 6 do InfoMercado Nº 229, boletim mensal da CCEE). As bases diferem e as participações não se comparam ponto a ponto: a diferença entre a CCEE e a
      EPE não foi decomposta{razao ? `, e ${razao}` : ""}. O SAMP da ANEEL mede o faturado por distribuidora e deixa fora o consumidor livre ligado direto à rede básica. Cada participação divide a soma da energia do livre pela soma da energia total, nunca é média de percentuais.
    </>
  );
  const naoConcluir = (
    <>
      Que o livre tenha energia mais barata ou mais cara: o observatório não publica preço de contrato. Que a diferença entre a EPE e a CCEE seja erro de uma delas: os perímetros são diferentes. Que a
      migração de um mês explique a variação da participação, que também muda com o consumo de quem já estava em cada ambiente.
    </>
  );

  return (
    <>
      <CabecalhoEnergia atual="mercado" />
      <MarcaVisita secao="energia:mercado" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          siglas={["ACR", "ACL", "CCEE", "PLD", "MRE", "EPE", "GSF", "ESS", "ANEEL", "SIN", "MWmed", "ONS", "SAMP"]}
          rotulo="Mercado de energia"
          titulo={TITULO_PAGINA_MERCADO["livre-regulado"]}
          lead="Parte do consumo compra energia da distribuidora, no Ambiente de Contratação Regulada (ACR); outra parte contrata no mercado livre, o Ambiente de Contratação Livre (ACL). A Câmara de Comercialização de Energia Elétrica (CCEE) liquida o que difere do medido."
          recorte={versao}
          fonte="EPE, Empresa de Pesquisa Energética; CCEE; ANEEL, Agência Nacional de Energia Elétrica (SAMP)"
          referencia={<ReferenciaMercado g={g} />}
          metricas={
            <div id="resumo">
              <FaixaMetricas
                colunas={4}
                rotulo="O mercado em quatro números"
                nota={
                  <>
                    {nota && <span data-nota="dois-universos">{nota}</span>} As janelas de 12 meses são fixas: o período escolhido no gráfico abaixo não as muda.
                  </>
                }
              >
                <Numero
                  variante="faixa"
                  rotulo="Mercado livre no consumo na rede (EPE)"
                  natureza="CALCULADO"
                  evidencia={kEpe?.evidencia ?? null}
                  formato="pct"
                  casas={1}
                  unidade="%"
                  periodo={kEpe ? textoPeriodoMes(kEpe.periodo) : undefined}
                  cor="var(--cor-energia)"
                  variacao={
                    kEpe?.anterior_pct !== null && kEpe?.anterior_pct !== undefined
                      ? { valor: kEpe.valor_pct - kEpe.anterior_pct, casas: 1, sufixo: " pontos percentuais", referencia: "contra os 12 meses anteriores" }
                      : undefined
                  }
                  motivoAusencia="A EPE não publicou os 12 meses da janela."
                  endereco="https://scrutiniums.com/setor-eletrico/mercado#resumo"
                />
                <Numero
                  variante="faixa"
                  rotulo="ACL no consumo contabilizado (CCEE)"
                  natureza="CALCULADO"
                  evidencia={kAcl?.evidencia ?? null}
                  formato="pct"
                  casas={1}
                  unidade="%"
                  periodo={kAcl ? textoPeriodoMes(kAcl.periodo) : undefined}
                  cor="var(--serie-comp-1)"
                  nota={kAcl?.com_exportacao_pct !== null && kAcl?.com_exportacao_pct !== undefined ? <>sem a exportação; {pct(kAcl.com_exportacao_pct, 1)} com ela</> : undefined}
                  motivoAusencia="A CCEE não publicou os 12 meses da janela."
                  endereco="https://scrutiniums.com/setor-eletrico/mercado#resumo"
                />
                <Numero
                  variante="faixa"
                  rotulo="GSF, ajuste do MRE"
                  natureza="CALCULADO"
                  evidencia={kGsf?.evidencia ?? null}
                  formato="pct"
                  casas={1}
                  unidade="%"
                  periodo={kGsf ? mesAno(kGsf.mes) : undefined}
                  cor="var(--serie-hidraulica)"
                  nota={<>geração das hidrelétricas do Mecanismo de Realocação de Energia (MRE) sobre a garantia física ajustada</>}
                  motivoAusencia="A CCEE não publicou o mês."
                  endereco="https://scrutiniums.com/setor-eletrico/mercado#resumo"
                />
                <Numero
                  variante="faixa"
                  rotulo="Encargos de serviços do sistema (ESS)"
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
              </FaixaMetricas>
            </div>
          }
        >
          Parte do consumo compra energia da distribuidora a tarifa regulada (<Termo slug="acr">ACR</Termo>); a outra parte contrata no mercado livre (<Termo slug="acl">ACL</Termo>). As diferenças entre o contratado e o
          medido são liquidadas na CCEE ao <Termo slug="pld">PLD</Termo>, as hidrelétricas dividem o risco hidrológico no <Termo slug="mre">MRE</Termo> e os custos de operar o sistema entram como encargos (
          <Termo slug="ess">ESS</Termo>). Esta página mostra quanto do consumo está no mercado livre; as outras três tratam dos agentes e da migração, do ajuste das hidrelétricas (MRE e GSF) e dos encargos.
        </CabecalhoModulo>

        <ModoProfundidade>
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
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
            >
              <div className="space-y-6">
                <GraficoLinhas
                  chaveUrl="liv"
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
                <MercadoRecorte
                  periodo={
                    <>
                      EPE de {mesAno(lr.epe_mensal_desde)} a {mesAno(lr.epe_ultimo_mes)} (desde 2004 no arquivo para baixar e na série anual); CCEE de{" "}
                      {textoPeriodoMes({ inicio: lr.ccee_mensal[0]?.mes ?? lr.epe_ultimo_mes, fim: lr.ccee_mensal.at(-1)?.mes ?? lr.epe_ultimo_mes })}
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
                <GraficoBarras
                  titulo="Consumo contabilizado pela CCEE por ambiente, mês a mês"
                  dados={serieAmbientesCcee(g)}
                  chaveCategoria="mes"
                  chaveRotulo="rotulo"
                  series={[
                    { id: "acr", rotulo: "ACR (distribuidoras)", cor: "var(--serie-3)" },
                    { id: "acl", rotulo: "ACL", cor: "var(--serie-comp-1)" },
                    { id: "exportacao", rotulo: "Exportação (fora do ACL)", cor: "var(--serie-referencia)" },
                  ]}
                  unidade="MWmed"
                  casas={0}
                  empilhado
                  altura={300}
                />
                {ultimoCcee && (
                  <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted">
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
                <MercadoResposta painel="P032" veredito={vereditoLivreRegulado(g)}>
                  {p?.resposta ?? "Sem resposta nesta atualização: a participação de 12 meses não pôde ser calculada com a base publicada."}
                </MercadoResposta>
                <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />

                <SecaoDoPainel
                  id="uf-classe"
                  titulo="Onde o mercado livre pesa mais?"
                  lead="Participação do mercado livre no consumo na rede (EPE) por estado, nos últimos 12 meses, e por classe de consumo, no último ano completo."
                >
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
                    referencias={kEpe ? [{ valor: kEpe.valor_pct, rotulo: "Brasil, 12 meses" }] : []}
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
                </SecaoDoPainel>

                <MercadoAusencias
                  id="ainda-nao"
                  titulo="O que o observatório ainda não mostra sobre o mercado?"
                  lead={<>{textoFontesPublicadas(catalogo)} O que segue é dado que a fonte não publica, que está atrás de login ou que o observatório verificou e ainda não integrou.</>}
                  itens={ausentes}
                />

                <SecaoDoPainel id="livre-analise" nivel="analisar" titulo="Os dois universos lado a lado, por ano, subsistema e distribuidora">
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
                </SecaoDoPainel>

                <SecaoDoPainel id="livre-auditoria" nivel="auditar" titulo="Conferências, estado do painel, fontes no catálogo e acesso à CCEE">
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
                  <TabelaDados
                    titulo="Fontes do módulo no catálogo do observatório: publicadas nestas páginas e conjuntos de contratos ainda não integrados"
                    colunas={["Órgão", "Conjunto", "Estado no catálogo", "Onde aparece"]}
                    linhas={linhasCatalogoMercado(entradasCatalogo)}
                    casas={[null, null, null, null]}
                    limite={60}
                  />
                  <MercadoPendenciasAuditoria g={g} />
                  <div className="space-y-2 text-sm leading-relaxed text-carvao-muted" data-acesso-ccee={decisao.situacao}>
                    <p className="rotulo text-mineral">Acesso ao portal da CCEE</p>
                    <p>{datasLegiveis(g.acesso_ccee.observacao)}</p>
                    <p>
                      Decisão registrada em {dataBR(decisao.registrada_em)}
                      {decisao.decidida_em ? <> e tomada em {dataBR(decisao.decidida_em)}</> : null}: {decisao.resposta ?? "pendente."} Coleta neste ambiente: {decisao.coleta_neste_ambiente}.
                    </p>
                    <p>
                      {g.ccee_conjuntos.length} conjuntos abertos da CCEE alimentam o módulo; {g.ccee_conjuntos.filter((c) => c.ultima_tentativa_ok).length} responderam na última tentativa
                      {g.ccee_conjuntos[0]?.ultima_tentativa ? <> ({carimbo(g.ccee_conjuntos.map((c) => c.ultima_tentativa ?? "").sort().at(-1))})</> : null}.
                    </p>
                  </div>
                  <MercadoDefinicoes g={g} chaves={["acl", "acr", "exportacao", "unidade_consumidora", "pld"]} />
                </SecaoDoPainel>

                {p && <MercadoLimitacoes painel={p} />}
                <SeguirPainel
                  ancora="livre-regulado"
                  proximo={{ href: "/setor-eletrico/mercado/agentes", pergunta: TITULO_PAGINA_MERCADO.agentes }}
                  downloads={[CSV_MERCADO.nacional, CSV_MERCADO.ccee, CSV_MERCADO.consumo, CSV_MERCADO.uf, CSV_MERCADO.distribuidorasAno, CSV_MERCADO.distribuidorasMes]}
                />
              </div>
            </PainelEvidencia>
          </Bloco>

          <Bloco id="outras-perguntas">
            <MercadoCapitulos g={g} atual="livre-regulado" />
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
