import type { ReactNode } from "react";
import { AtalhoLeitura } from "@/components/energia/LeiturasIntegradas";
import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import Link from "@/components/i18n/LinkIdioma";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { GraficoLivreUf } from "@/components/energia/GraficoLivreUf";
import { MercadoTabelasSobDemanda } from "@/components/energia/MercadoTabelasSobDemanda";
import {
  MercadoAusencias,
  MercadoAviso,
  MercadoCapitulos,
  MercadoCatalogo,
  MercadoDefinicoes,
  MercadoIndisponivel,
  MercadoLimitacoes,
  MercadoPendenciasAuditoria,
  MercadoRecorte,
  MercadoResposta,
  MercadoVerificacoes,
  ReferenciaMercado,
  TextoGold,
} from "@/components/energia/MercadoPainel";
import { Nome } from "@/components/i18n/Nome";
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
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { CLASSES_MERCADO_EN, CRITERIOS_MERCADO_EN, PERGUNTAS_MERCADO_EN, TOLERANCIAS_MERCADO_EN, rotuloCategoria, traducaoExata } from "@/lib/energia/i18n/mercado-preco";
import {
  colunasDistribuidoras,
  CSV_MERCADO,
  nomeSubsistema,
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
import { barrasUfVolume, partesContrasteUf, partesUfsSemJanela, type ParteTexto } from "@/lib/energia/mercado-uf";
import { NOME_UF } from "@/lib/energia/expansao";
import type { MercadoGold } from "@/lib/energia/tipos-mercado";
import { datasLegiveis } from "@/lib/energia/visao";

export const dynamic = "force-static";

export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/mercado", {
    title: tx("Mercado de energia: livre e regulado", "Energy market: free and regulated"),
    description: tx(
      "Quanto do consumo de energia elétrica está no mercado livre e quanto no regulado, em três universos com perímetros diferentes (EPE, CCEE e SAMP), com a fonte e as conferências de cada número e o que o observatório ainda não mostra sobre contratos.",
      "How much electricity consumption is in the free market and how much in the regulated market, in three universes with different perimeters (EPE, CCEE and SAMP), with the source and checks for each number and what the observatory does not yet show about contracts.",
    ),
    alternates: { canonical: "/setor-eletrico/mercado" },
  }, anterior);
}

/** Frase em partes com nome de UF: em inglês o nome do estado sai marcado como nome próprio. */
function FrasePartes({ partes }: { partes: ParteTexto[] }) {
  return (
    <>
      {partes.map((p, i) => (typeof p === "string" ? <span key={i}>{p}</span> : <Nome key={i}>{NOME_UF[p.uf] ?? p.uf}</Nome>))}
    </>
  );
}

export default function MercadoPage() {
  const idioma = idiomaEnergia();
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
  const versao = tx(
    `EPE até ${mesAno(lr.epe_ultimo_mes)}, CCEE até ${g.referencias.ccee_ultimo_mes_consumo ? mesAno(g.referencias.ccee_ultimo_mes_consumo) : "sem mês"}, publicado em ${dataBR(g.gerado_em)}`,
    `EPE to ${mesAno(lr.epe_ultimo_mes)}, CCEE to ${g.referencias.ccee_ultimo_mes_consumo ? mesAno(g.referencias.ccee_ultimo_mes_consumo) : "no month"}, published on ${dataBR(g.gerado_em)}`,
  );
  const anoClasse = anoClasseCompleto(g);
  const uf = barrasUf(g);
  const ufVolume = barrasUfVolume(g);
  // em português a frase sai como texto único (igual à de antes); em inglês, com o nome da UF marcado
  const partesContraste = partesContrasteUf(g);
  const partesSemJanela = partesUfsSemJanela(g);
  const contrasteUf = partesContraste && (idioma === "en" ? <FrasePartes partes={partesContraste} /> : partesContraste.map((x) => (typeof x === "string" ? x : NOME_UF[x.uf] ?? x.uf)).join(""));
  const ufSemJanela = partesSemJanela && (idioma === "en" ? <FrasePartes partes={partesSemJanela} /> : partesSemJanela.map((x) => (typeof x === "string" ? x : NOME_UF[x.uf] ?? x.uf)).join(""));
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
  const ausentes = [...(contratos ? [{ id: "contratos", titulo: tx("Contratos de energia", "Energy contracts"), texto: contratos, paineis: ["P032"] }] : []), ...itensAusentesMercado(g)];
  const pergunta = p?.pergunta ? traducaoExata(PERGUNTAS_MERCADO_EN, p.pergunta, idioma) ?? p.pergunta : null;
  const nota = notaDoisUniversos(g);
  const razao = textoRazaoUniversos(g);

  const oQueMudou = kEpe ? (
    tx(
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
      </>,
      <>
        At EPE, the 12-month share was {pct(kEpe.valor_pct, 1)} to {mesAno(kEpe.periodo.fim)}
        {kEpe.anterior_pct !== null ? <>, compared with {pct(kEpe.anterior_pct, 1)} in the previous 12 months ({textoVariacaoPp(kEpe.valor_pct, kEpe.anterior_pct)?.replace("pp", "percentage points")})</> : null}.
        {kAcl?.variacao_acl_ultimo_mes && (
          <>
            {" "}
            At CCEE, ACL consumption in {mesAno(kAcl.variacao_acl_ultimo_mes.mes)} {textoVariacaoVerbo(kAcl.variacao_acl_ultimo_mes.sem_exportacao_pct, 1)} compared with the same month of the previous year, excluding exports.
          </>
        )}
      </>,
    )
  ) : (
    <>{tx("Sem janela de 12 meses completa na EPE nesta atualização.", "No complete 12-month window at EPE in this update.")}</>
  );
  const comoInterpretar = tx(
    <>
      Três universos convivem e nenhum é a carga do ONS. A EPE mede o consumo na rede (cativo e livre) informado pelos agentes. A CCEE mede o consumo contabilizado no centro de gravidade de cada
      submercado, já com 50% das perdas da rede básica (nota 6 do InfoMercado Nº 229, boletim mensal da CCEE). As bases diferem e as participações não se comparam ponto a ponto: a diferença entre a CCEE e a
      EPE não foi decomposta{razao ? `, e ${razao}` : ""}. O SAMP da ANEEL mede o faturado por distribuidora e deixa fora o consumidor livre ligado direto à rede básica. Cada participação divide a soma da energia do livre pela soma da energia total, nunca é média de percentuais.
    </>,
    <>
      Three universes coexist and none of them is the ONS load. EPE measures grid consumption (captive and free) reported by agents. CCEE measures the consumption accounted at the center of gravity of each
      submarket, already including 50% of basic network losses (note 6 of InfoMercado No. 229, CCEE&apos;s monthly bulletin). The bases differ and the shares cannot be compared point by point: the difference between CCEE and
      EPE has not been broken down{razao ? `, and ${razao}` : ""}. ANEEL&apos;s SAMP measures what each distribution utility billed and excludes free consumers connected directly to the basic network. Each share divides the sum of free-market energy by the sum of total energy; it is never an average of percentages.
    </>,
  );
  const naoConcluir = tx(
    <>
      Que o livre tenha energia mais barata ou mais cara: o observatório não publica preço de contrato. Que a diferença entre a EPE e a CCEE seja erro de uma delas: os perímetros são diferentes. Que a
      migração de um mês explique a variação da participação, que também muda com o consumo de quem já estava em cada ambiente.
    </>,
    <>
      That free-market energy is cheaper or more expensive: the observatory does not publish contract prices. That the difference between EPE and CCEE is an error in one of them: the perimeters are different. That
      one month&apos;s migration explains the change in the share, which also changes with the consumption of those who were already in each environment.
    </>,
  );

  return (
    <>
      <CabecalhoEnergia atual="mercado" />
      <MarcaVisita secao="energia:mercado" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          siglas={["ACR", "ACL", "CCEE", "PLD", "MRE", "EPE", "GSF", "ESS", "ANEEL", "SIN", "MWmed", "ONS", "SAMP"]}
          rotulo={tx("Mercado de energia", "Energy market")}
          titulo={TITULO_PAGINA_MERCADO["livre-regulado"]}
          lead={tx<ReactNode>(
            "Parte do consumo compra energia da distribuidora, no Ambiente de Contratação Regulada (ACR); outra parte contrata no mercado livre, o Ambiente de Contratação Livre (ACL). A Câmara de Comercialização de Energia Elétrica (CCEE) liquida as diferenças entre a energia contratada e a verificada.",
            <>
              Part of consumption buys energy from the distribution utility, in the regulated contracting environment (ACR); another part contracts in the free market, the free contracting environment (ACL). The electric energy trading chamber (<Nome>Câmara de Comercialização de Energia Elétrica</Nome>, CCEE) settles the differences between contracted and verified energy.
            </>,
          )}
          recorte={versao}
          fonte={tx("EPE, Empresa de Pesquisa Energética; CCEE; ANEEL, Agência Nacional de Energia Elétrica (SAMP)", "EPE (Energy Research Office); CCEE; ANEEL (National Electric Energy Agency) (SAMP)")}
          referencia={<ReferenciaMercado g={g} />}
          metricas={
            <div id="resumo">
              <FaixaMetricas
                colunas={4}
                rotulo={tx("O mercado em quatro números", "The market in four numbers")}
                nota={
                  <>
                    {nota && <span data-nota="dois-universos">{nota}</span>} {tx("As janelas de 12 meses são fixas: o período escolhido no gráfico abaixo não as muda.", "The 12-month windows are fixed: the period chosen in the chart below does not change them.")}
                  </>
                }
              >
                <Numero
                  variante="faixa"
                  rotulo={tx("Mercado livre no consumo na rede (EPE)", "Free market in grid consumption (EPE)")}
                  natureza="CALCULADO"
                  evidencia={kEpe?.evidencia ?? null}
                  formato="pct"
                  casas={1}
                  unidade="%"
                  periodo={kEpe ? textoPeriodoMes(kEpe.periodo) : undefined}
                  cor="var(--cor-energia)"
                  variacao={
                    kEpe?.anterior_pct !== null && kEpe?.anterior_pct !== undefined
                      ? { valor: kEpe.valor_pct - kEpe.anterior_pct, casas: 1, sufixo: tx(" pontos percentuais", " percentage points"), referencia: tx("contra os 12 meses anteriores", "versus the previous 12 months") }
                      : undefined
                  }
                  motivoAusencia={tx("A EPE não publicou os 12 meses da janela.", "EPE did not publish the 12 months of the window.")}
                  endereco="https://scrutiniums.com/setor-eletrico/mercado#resumo"
                />
                <Numero
                  variante="faixa"
                  rotulo={tx("ACL no consumo contabilizado (CCEE)", "ACL in accounted consumption (CCEE)")}
                  natureza="CALCULADO"
                  evidencia={kAcl?.evidencia ?? null}
                  formato="pct"
                  casas={1}
                  unidade="%"
                  periodo={kAcl ? textoPeriodoMes(kAcl.periodo) : undefined}
                  cor="var(--serie-comp-1)"
                  nota={kAcl?.com_exportacao_pct !== null && kAcl?.com_exportacao_pct !== undefined ? tx(<>sem a exportação; {pct(kAcl.com_exportacao_pct, 1)} com ela</>, <>excluding exports; {pct(kAcl.com_exportacao_pct, 1)} including them</>) : undefined}
                  motivoAusencia={tx("A CCEE não publicou os 12 meses da janela.", "CCEE did not publish the 12 months of the window.")}
                  endereco="https://scrutiniums.com/setor-eletrico/mercado#resumo"
                />
                <Numero
                  variante="faixa"
                  rotulo={tx("GSF, ajuste do MRE", "GSF, MRE adjustment")}
                  natureza="CALCULADO"
                  evidencia={kGsf?.evidencia ?? null}
                  formato="pct"
                  casas={1}
                  unidade="%"
                  periodo={kGsf ? mesAno(kGsf.mes) : undefined}
                  cor="var(--serie-hidraulica)"
                  nota={tx(<>geração das hidrelétricas do Mecanismo de Realocação de Energia (MRE) sobre a garantia física ajustada</>, <>generation of the hydropower plants in the Energy Reallocation Mechanism (MRE) over the adjusted physical guarantee</>)}
                  motivoAusencia={tx("A CCEE não publicou o mês.", "CCEE did not publish the month.")}
                  endereco="https://scrutiniums.com/setor-eletrico/mercado#resumo"
                />
                <Numero
                  variante="faixa"
                  rotulo={tx("Encargos de serviços do sistema (ESS)", "System service charges (ESS)")}
                  natureza="CALCULADO"
                  evidencia={kEss?.evidencia ?? null}
                  valor={kEss ? kEss.valor_rs / 1e9 : null}
                  unidade={tx("R$ bilhões", "R$ billion")}
                  casas={2}
                  periodo={kEss ? textoPeriodoMes(kEss.periodo) : undefined}
                  nota={tx(<>por mês de competência, soma dos nove tipos</>, <>by accounting month, sum of the nine types</>)}
                  motivoAusencia={tx("A CCEE não publicou os 12 meses da janela.", "CCEE did not publish the 12 months of the window.")}
                  endereco="https://scrutiniums.com/setor-eletrico/mercado#resumo"
                />
              </FaixaMetricas>
            </div>
          }
        >
          {tx(
            <>
              Parte do consumo compra energia da distribuidora a tarifa regulada (<Termo slug="acr">ACR</Termo>); a outra parte contrata no mercado livre (<Termo slug="acl">ACL</Termo>). As diferenças entre o contratado e o
              medido são liquidadas na CCEE ao <Termo slug="pld">PLD</Termo>, as hidrelétricas dividem o risco hidrológico no <Termo slug="mre">MRE</Termo> e os custos de operar o sistema entram como encargos (
              <Termo slug="ess">ESS</Termo>). Esta página mostra quanto do consumo está no mercado livre; as outras três tratam dos agentes e da migração, do ajuste das hidrelétricas (MRE e GSF) e dos encargos.
              O que as distribuidoras compraram nos leilões do ACR, a que preço e de quem está em{" "}
              <Link href="/setor-eletrico/leiloes" className="text-energia-dark underline underline-offset-4 hover:text-carvao">
                Leilões
              </Link>
              .
            </>,
            <>
              Part of consumption buys energy from the distribution utility at the regulated tariff (<Termo slug="acr">ACR</Termo>); the other part contracts in the free market (<Termo slug="acl">ACL</Termo>). Differences between contracted and
              metered energy are settled at CCEE at the spot price (<Termo slug="pld">PLD</Termo>), hydropower plants share hydrological risk in the <Termo slug="mre">MRE</Termo> and the costs of operating the system come in as charges (
              <Termo slug="ess">ESS</Termo>). This page shows how much of consumption is in the free market; the other three cover agents and migration, the hydropower adjustment (MRE and GSF) and charges.
              What distribution utilities bought in ACR auctions, at what price and from whom is in{" "}
              <Link href="/setor-eletrico/leiloes" className="text-energia-dark underline underline-offset-4 hover:text-carvao">
                Auctions
              </Link>
              .
            </>,
          )}
        </CabecalhoModulo>

        <AtalhoLeitura
          href="/setor-eletrico/mercado/comercializacao"
          titulo={tx("Como a operação física se conecta aos contratos?", "How does physical operation connect to contracts?")}
          texto={tx("Entenda a comercialização e experimente o efeito dos horários na liquidação.", "Understand energy trading and test the effect of hours on settlement.")}
        />
        <ModoProfundidade>
          <Bloco id="livre-regulado">
            <PainelEvidencia
              id="painel-livre-regulado"
              pergunta={pergunta ?? tx("Como se distribui o consumo entre o mercado livre e o regulado?", "How is consumption split between the free and the regulated market?")}
              subtitulo={tx(
                `Participação do livre no consumo · % · EPE desde ${lr.epe_mensal_desde.slice(0, 4)} e CCEE desde ${mesAno(lr.ccee_mensal[0]?.mes ?? "2023-05")}`,
                `Free-market share of consumption · % · EPE since ${lr.epe_mensal_desde.slice(0, 4)} and CCEE since ${mesAno(lr.ccee_mensal[0]?.mes ?? "2023-05")}`,
              )}
              natureza="CALCULADO"
              proveniencia={prov.consumo_epe}
              complementares={[
                { rotulo: tx("Consumo contabilizado pela CCEE", "Consumption accounted by CCEE"), p: prov.consumo_ccee },
                { rotulo: tx("Mercado faturado das distribuidoras (SAMP)", "Billed market of distribution utilities (SAMP)"), p: prov.distribuidoras_samp },
              ]}
              porQueImporta={
                tx(
                  <>
                    O consumidor livre compra energia em contrato bilateral e paga à distribuidora só o uso da rede; o cativo paga a energia na tarifa regulada. Quanto maior a parte livre, menor o mercado
                    sobre o qual a distribuidora reparte os custos da energia que contratou em leilão.
                  </>,
                  <>
                    The free consumer buys energy under a bilateral contract and pays the distribution utility only for grid use; the captive consumer pays for energy at the regulated tariff. The larger the free share, the smaller the market
                    over which the distribution utility spreads the costs of the energy it contracted at auction.
                  </>,
                )
              }
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
            >
              <div className="space-y-6">
                <GraficoLinhas
                  chaveUrl="liv"
                  titulo={tx("Participação do mercado livre no consumo na rede, mês a mês (EPE)", "Free-market share of grid consumption, month by month (EPE)")}
                  dados={serieLivreEpe(g)}
                  chaveX="mes"
                  formatoX="mes"
                  series={[{ id: "livre", rotulo: tx("Livre no consumo na rede", "Free market in grid consumption"), cor: "var(--cor-energia)", espessura: 2.5 }]} // i18n: dado
                  unidade="%"
                  casas={1}
                  zeroNoEixo
                  zoom
                  altura={280}
                />
                <MercadoRecorte
                  periodo={
                    tx(
                      <>
                        EPE de {mesAno(lr.epe_mensal_desde)} a {mesAno(lr.epe_ultimo_mes)} (desde 2004 no arquivo para baixar e na série anual); CCEE de{" "}
                        {textoPeriodoMes({ inicio: lr.ccee_mensal[0]?.mes ?? lr.epe_ultimo_mes, fim: lr.ccee_mensal.at(-1)?.mes ?? lr.epe_ultimo_mes })}
                      </>,
                      <>
                        EPE from {mesAno(lr.epe_mensal_desde)} to {mesAno(lr.epe_ultimo_mes)} (since 2004 in the download file and in the annual series); CCEE from{" "}
                        {textoPeriodoMes({ inicio: lr.ccee_mensal[0]?.mes ?? lr.epe_ultimo_mes, fim: lr.ccee_mensal.at(-1)?.mes ?? lr.epe_ultimo_mes })}
                      </>,
                    )
                  }
                  universo={tx("consumo na rede (EPE, Brasil); consumo contabilizado no mercado de curto prazo (CCEE, SIN)", "grid consumption (EPE, Brazil); consumption accounted in the short-term market (CCEE, SIN)")}
                  unidade={tx("% do consumo do universo; MW médios na CCEE", "% of the universe's consumption; MWavg at CCEE")}
                />
                {preliminares.length > 0 && (
                  <MercadoAviso>
                    {tx(
                      `A EPE marca como preliminares os dados de ${preliminares.join(", ")}: os meses desses anos podem ser revistos na próxima publicação, e a revisão fica registrada no histórico de capturas.`,
                      `EPE marks the data for ${preliminares.join(", ")} as preliminary: the months of those years can be revised in the next publication, and the revision is recorded in the capture history.`,
                    )}
                  </MercadoAviso>
                )}
                <GraficoBarras
                  titulo={tx("Consumo contabilizado pela CCEE por ambiente, mês a mês", "Consumption accounted by CCEE by environment, month by month")}
                  dados={serieAmbientesCcee(g)}
                  chaveCategoria="mes"
                  chaveRotulo="rotulo"
                  series={[
                    { id: "acr", rotulo: tx("ACR (distribuidoras)", "ACR (distribution utilities)"), cor: "var(--serie-3)" },
                    { id: "acl", rotulo: "ACL", cor: "var(--serie-comp-1)" },
                    { id: "exportacao", rotulo: tx("Exportação (fora do ACL)", "Exports (outside the ACL)"), cor: "var(--serie-referencia)" },
                  ]}
                  unidade={tx("MWmed", "MWavg")}
                  casas={0}
                  empilhado
                  altura={300}
                />
                {ultimoCcee && (
                  <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted">
                    {tx(
                      <>
                        Em {mesAno(ultimoCcee.mes)}: ACR {num(ultimoCcee.acr_mwmed, 0)} MW médios, ACL {num(ultimoCcee.acl_mwmed, 0)} e exportação {num(ultimoCcee.exportacao_mwmed, 0)}; o ACL teve{" "}
                        {pct(ultimoCcee.acl_pct, 2)} do consumo sem a exportação e {pct(ultimoCcee.acl_com_exportacao_pct, 2)} com ela.
                      </>,
                      <>
                        In {mesAno(ultimoCcee.mes)}: ACR {num(ultimoCcee.acr_mwmed, 0)} MWavg, ACL {num(ultimoCcee.acl_mwmed, 0)} and exports {num(ultimoCcee.exportacao_mwmed, 0)}; the ACL had{" "}
                        {pct(ultimoCcee.acl_pct, 2)} of consumption excluding exports and {pct(ultimoCcee.acl_com_exportacao_pct, 2)} including them.
                      </>,
                    )}
                  </p>
                )}
                <TabelaDados
                  titulo={tx("Consumo contabilizado pela CCEE por ambiente", "Consumption accounted by CCEE by environment")}
                  colunas={tx(["Mês", "ACR (MWmed)", "ACL (MWmed)", "Exportação (MWmed)", "ACL sem exportação (%)", "ACL com exportação (%)"], ["Month", "ACR (MWavg)", "ACL (MWavg)", "Exports (MWavg)", "ACL excluding exports (%)", "ACL including exports (%)"])}
                  linhas={lr.ccee_mensal.map((m) => [mesAno(m.mes), m.acr_mwmed, m.acl_mwmed, m.exportacao_mwmed, m.acl_pct, m.acl_com_exportacao_pct])}
                  casas={[null, 1, 1, 1, 2, 2]}
                  limite={48}
                  csv={CSV_MERCADO.ccee.url}
                />
                <MercadoResposta painel="P032" veredito={vereditoLivreRegulado(g)}>
                  {p?.resposta ?? tx("Sem resposta nesta atualização: a participação de 12 meses não pôde ser calculada com a base publicada.", "No answer in this update: the 12-month share could not be calculated with the published database.")}
                </MercadoResposta>
                <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />

                <SecaoDoPainel
                  id="uf-classe"
                  titulo={tx("Onde o mercado livre pesa mais?", "Where does the free market weigh most?")}
                  lead={tx(
                    "Participação do mercado livre no consumo na rede (EPE) por estado, nos últimos 12 meses, com a opção de ver o volume de energia, e por classe de consumo, no último ano completo.",
                    "Free-market share of grid consumption (EPE) by state, over the last 12 months, with the option to see the energy volume, and by consumption class, in the last complete year.",
                  )}
                >
                  <GraficoLivreUf
                    janela={lr.epe_ultimo_mes_uf ? mesAno(lr.epe_ultimo_mes_uf) : tx("o último mês publicado", "the last month published")}
                    participacao={uf}
                    volume={ufVolume}
                    referencias={kEpe ? [{ valor: kEpe.valor_pct, rotulo: tx(`Brasil, 12 meses até ${mesAno(kEpe.periodo.fim)}`, `Brazil, 12 months to ${mesAno(kEpe.periodo.fim)}`) }] : []}
                  />
                  {(contrasteUf || ufSemJanela) && (
                    <div className="max-w-prose2 space-y-1 text-xs leading-relaxed text-carvao-muted" data-nota-uf="">
                      {contrasteUf && <p>{contrasteUf}</p>}
                      {ufSemJanela && <p>{ufSemJanela}</p>}
                    </div>
                  )}
                  {anoClasse && (
                    <GraficoBarras
                      titulo={tx(`Participação do livre por classe de consumo, ${anoClasse}`, `Free-market share by consumption class, ${anoClasse}`)}
                      dados={barrasClasse(g, anoClasse).map((x) => ({ ...x, classe: rotuloCategoria(CLASSES_MERCADO_EN, x.classe, idioma) }))}
                      chaveCategoria="classe"
                      series={[{ id: "livre", rotulo: tx("Livre no consumo da classe", "Free market in the class's consumption"), cor: "var(--cor-energia)" }]} // i18n: dado
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
                  titulo={tx("O que o observatório ainda não mostra sobre o mercado?", "What does the observatory not yet show about the market?")}
                  lead={
                    <>
                      {textoFontesPublicadas(catalogo)}{" "}
                      {tx(
                        "O que segue é dado que a fonte não publica, que está atrás de login ou que o observatório verificou e ainda não integrou.",
                        "What follows is data that the source does not publish, that is behind a login, or that the observatory has verified and not yet integrated.",
                      )}
                    </>
                  }
                  itens={ausentes}
                />

                <SecaoDoPainel id="livre-analise" nivel="analisar" titulo={tx("Os dois universos lado a lado, por ano, subsistema e distribuidora", "The two universes side by side, by year, subsystem and distribution utility")}>
                  <GraficoLinhas
                    titulo={tx("Participação do livre: EPE (consumo na rede) e CCEE (consumo contabilizado)", "Free-market share: EPE (grid consumption) and CCEE (accounted consumption)")}
                    dados={serieComparacaoUniversos(g)}
                    chaveX="mes"
                    formatoX="mes"
                    series={[
                      { id: "epe", rotulo: tx("EPE, livre no consumo na rede", "EPE, free market in grid consumption"), cor: "var(--cor-energia)" }, // i18n: dado
                      { id: "ccee", rotulo: tx("CCEE, ACL sem a exportação", "CCEE, ACL excluding exports"), cor: "var(--serie-comp-1)", tracejada: true },
                    ]}
                    unidade="%"
                    casas={1}
                    altura={260}
                  />
                  <GraficoLinhas
                    titulo={tx(`Participação do livre por ano desde ${serieLivreEpeAnual(g)[0]?.ano ?? "2004"} (EPE, anos completos)`, `Free-market share by year since ${serieLivreEpeAnual(g)[0]?.ano ?? "2004"} (EPE, complete years)`)}
                    dados={serieLivreEpeAnual(g)}
                    chaveX="ano" // i18n: dado
                    formatoX="texto"
                    series={[{ id: "livre", rotulo: tx("Livre no consumo na rede", "Free market in grid consumption"), cor: "var(--cor-energia)", espessura: 2.5 }]} // i18n: dado
                    unidade="%"
                    casas={1}
                    zeroNoEixo
                    altura={240}
                  />
                  <TabelaDados
                    titulo={tx("Livre e cativo por subsistema da EPE, 12 meses", "Free and captive by EPE subsystem, 12 months")}
                    colunas={tx(["Subsistema", "Cativo (GWh)", "Livre (GWh)", "Livre (%)", "Unidades livres"], ["Subsystem", "Captive (GWh)", "Free (GWh)", "Free (%)", "Free consumer units"])}
                    linhas={lr.epe_subsistema_12m.map((s) => [nomeSubsistema(s.chave), s.cativo_mwh === null ? null : s.cativo_mwh / 1e3, s.livre_mwh === null ? null : s.livre_mwh / 1e3, s.livre_pct, s.livre_uc])}
                    casas={[null, 0, 0, 2, 0]}
                    csv={CSV_MERCADO.consumo.url}
                  />
                  <TabelaInterativa
                    titulo={tx(
                      `As ${lr.distribuidoras.na_gold} distribuidoras com mais energia livre faturada em ${lr.distribuidoras.ano ?? "ano não publicado"} (SAMP)`,
                      `The ${lr.distribuidoras.na_gold} distribution utilities with the most free-market energy billed in ${lr.distribuidoras.ano ?? "year not published"} (SAMP)`,
                    )}
                    colunas={colunasDistribuidoras()}
                    linhas={linhasDistribuidoras(g)}
                    chaveLinha="id"
                    colunaRotulo="sigla"
                    fonte={tx("ANEEL, SAMP (mercado faturado por distribuidora)", "ANEEL, SAMP (billed market by distribution utility)")}
                    versao={versao}
                    nomeArquivo="mercado-distribuidoras"
                    chaveUrl="dist"
                    ordemInicial={{ coluna: "livre_gwh", direcao: "desc" }}
                    nota={tx(
                      `${lr.distribuidoras.criterio}; ${lr.distribuidoras.total} distribuidoras no ano. O faturado da distribuidora não inclui o consumidor livre ligado direto à rede básica.`,
                      `${traducaoExata(CRITERIOS_MERCADO_EN, lr.distribuidoras.criterio, idioma) ?? lr.distribuidoras.criterio}; ${lr.distribuidoras.total} distribution utilities in the year. What the distribution utility billed does not include free consumers connected directly to the basic network.`,
                    )}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="livre-auditoria" nivel="auditar" titulo={tx("Conferências, estado do painel, fontes no catálogo e acesso à CCEE", "Checks, panel status, sources in the catalog and access to CCEE")}>
                  {p && <MercadoVerificacoes painel={p} />}
                  <p className="text-sm leading-relaxed text-carvao-muted">
                    {tx(
                      <>
                        Planilha formatada da EPE × tabela longa dos dados abertos: {num(planilha.comparacoes, 0)} comparações, {num(planilha.falhas, 0)} acima da tolerância ({planilha.tolerancia}); resultado{" "}
                        {ROTULO_RESULTADO[planilha.resultado]}.
                      </>,
                      <>
                        EPE formatted spreadsheet × long open-data table: {num(planilha.comparacoes, 0)} comparisons, {num(planilha.falhas, 0)} above the tolerance ({traducaoExata(TOLERANCIAS_MERCADO_EN, planilha.tolerancia, idioma) ?? <TextoGold regiao="mercado-tolerancia">{planilha.tolerancia}</TextoGold>}); result{" "}
                        {ROTULO_RESULTADO[planilha.resultado]}.
                      </>,
                    )}
                    {consol &&
                      tx(
                        <>
                          {" "}
                          Consolidação anual do MME para {consol.ano}: ACL com {pct(consol.mme_acl_pct, 1)} de {num(consol.mme_consumo_gwh, 0)} GWh; EPE com {pct(consol.epe_livre_pct, 2)} de{" "}
                          {num(consol.epe_total_gwh, 0)} GWh ({num(consol.diferenca_pp, 2)} p.p.): {ROTULO_RESULTADO[consol.resultado ?? "ressalva"]}, divergência publicada pela fonte e mantida à vista.
                        </>,
                        <>
                          {" "}
                          MME annual consolidation for {consol.ano}: ACL with {pct(consol.mme_acl_pct, 1)} of {num(consol.mme_consumo_gwh, 0)} GWh; EPE with {pct(consol.epe_livre_pct, 2)} of{" "}
                          {num(consol.epe_total_gwh, 0)} GWh ({num(consol.diferenca_pp, 2)} pp): {ROTULO_RESULTADO[consol.resultado ?? "ressalva"]}, a divergence published by the source and kept in view.
                        </>,
                      )}{" "}
                    {tx(
                      <>
                        Identidade das classes da CCEE com o conjunto por ambiente: {lr.ccee_identidade_classes.length - identidadeFora.length} de {lr.ccee_identidade_classes.length} meses dentro de 5 MW
                        médios{identidadeFora.length ? ` (fora: ${identidadeFora.map((x) => mesAno(x.mes)).join(", ")})` : ""}.
                      </>,
                      <>
                        Identity between CCEE classes and the dataset by environment: {lr.ccee_identidade_classes.length - identidadeFora.length} of {lr.ccee_identidade_classes.length} months within 5
                        MWavg{identidadeFora.length ? ` (outside: ${identidadeFora.map((x) => mesAno(x.mes)).join(", ")})` : ""}.
                      </>,
                    )}
                  </p>
                  <TabelaDados
                    titulo={tx("Consumo por ambiente no boletim do MME × EPE (GWh)", "Consumption by environment in the MME bulletin × EPE (GWh)")}
                    colunas={tx(["Edição", "Mês", "Ambiente", "Medida", "MME (GWh)", "EPE (GWh)", "Diferença (GWh)", "Resultado"], ["Edition", "Month", "Environment", "Measure", "MME (GWh)", "EPE (GWh)", "Difference (GWh)", "Result"])}
                    linhas={lr.reconciliacao.mme.map((r) => [mesAno(r.edicao), mesAno(r.mes), r.ambiente, r.medida === "mes" ? tx("mês", "month") : tx("12 meses", "12 months"), r.mme_gwh, r.epe_gwh, r.diferenca_gwh, r.resultado ? ROTULO_RESULTADO[r.resultado] : tx("sem conferência", "not checked")])}
                    casas={[null, null, null, null, 0, 1, 1, null]}
                    limite={40}
                    csv={CSV_MERCADO.nacional.url}
                  />
                  <TabelaDados
                    titulo={tx("Consumo na rede (EPE) sobre a carga do boletim do MME", "Grid consumption (EPE) over the MME bulletin load")}
                    colunas={tx(["Mês", "Carga (GWh)", "Perdas e diferenças (GWh)", "Consumo EPE (GWh)", "Consumo sobre carga (%)"], ["Month", "Load (GWh)", "Losses and differences (GWh)", "EPE consumption (GWh)", "Consumption over load (%)"])}
                    linhas={lr.carga_contexto.map((c) => [mesAno(c.mes), c.carga_gwh, c.perdas_diferencas_gwh, c.consumo_epe_gwh, c.consumo_sobre_carga_pct])}
                    casas={[null, 0, 0, 1, 1]}
                  />
                  <p className="text-sm leading-relaxed text-carvao-muted">
                    {tx(
                      <>
                        SAMP: {sampComparaveis.length} de {lr.samp_nacional_mensal.length} meses desde {mesAno(lr.samp_nacional_mensal_desde)} são comparáveis com a EPE
                        {sampUltimo ? <> (o último é {mesAno(sampUltimo.mes)}, com {pct(sampUltimo.samp_sobre_epe_uc_pct, 1)} das unidades livres da EPE)</> : null}; os demais têm distribuidora sem linhas do
                        mercado livre, linhas repetidas do mês anterior ou menos distribuidoras que o usual, e ficam fora da comparação.
                      </>,
                      <>
                        SAMP: {sampComparaveis.length} of {lr.samp_nacional_mensal.length} months since {mesAno(lr.samp_nacional_mensal_desde)} are comparable with EPE
                        {sampUltimo ? <> (the latest is {mesAno(sampUltimo.mes)}, with {pct(sampUltimo.samp_sobre_epe_uc_pct, 1)} of EPE&apos;s free consumer units)</> : null}; the others have a distribution utility with no free-market
                        rows, rows repeated from the previous month or fewer distribution utilities than usual, and are excluded from the comparison.
                      </>,
                    )}
                  </p>
                  <MercadoTabelasSobDemanda conjunto="livre-auditoria" versao={versao} downloads={[CSV_MERCADO.nacional, CSV_MERCADO.ccee].map((d) => ({ ...d }))} />
                  <MercadoCatalogo
                    titulo={tx("Fontes do módulo no catálogo do observatório: publicadas nestas páginas e conjuntos de contratos ainda não integrados", "Module sources in the observatory catalog: published on these pages and contract datasets not yet integrated")}
                    colunas={tx(["Órgão", "Conjunto", "Estado no catálogo", "Onde aparece"], ["Body", "Dataset", "Status in the catalog", "Where it appears"])}
                    linhas={linhasCatalogoMercado(entradasCatalogo)}
                    limite={60}
                  />
                  <MercadoPendenciasAuditoria g={g} />
                  <div className="space-y-2 text-sm leading-relaxed text-carvao-muted" data-acesso-ccee={decisao.situacao}>
                    <p className="rotulo text-mineral">{tx("Acesso ao portal da CCEE", "Access to the CCEE portal")}</p>
                    <p>
                      <TextoGold regiao="mercado-acesso-ccee">{datasLegiveis(g.acesso_ccee.observacao)}</TextoGold>
                    </p>
                    <p>
                      {tx(
                        <>
                          Decisão registrada em {dataBR(decisao.registrada_em)}
                          {decisao.decidida_em ? <> e tomada em {dataBR(decisao.decidida_em)}</> : null}:
                        </>,
                        <>
                          Decision recorded on {dataBR(decisao.registrada_em)}
                          {decisao.decidida_em ? <> and taken on {dataBR(decisao.decidida_em)}</> : null}:
                        </>,
                      )}{" "}
                      {decisao.resposta ? <TextoGold regiao="mercado-acesso-ccee">{decisao.resposta}</TextoGold> : tx("pendente.", "pending.")} {tx("Coleta neste ambiente:", "Collection in this environment:")}{" "}
                      <TextoGold regiao="mercado-acesso-ccee">{decisao.coleta_neste_ambiente}</TextoGold>.
                    </p>
                    <p>
                      {tx(
                        <>
                          {g.ccee_conjuntos.length} conjuntos abertos da CCEE alimentam o módulo; {g.ccee_conjuntos.filter((c) => c.ultima_tentativa_ok).length} responderam na última tentativa
                          {g.ccee_conjuntos[0]?.ultima_tentativa ? <> ({carimbo(g.ccee_conjuntos.map((c) => c.ultima_tentativa ?? "").sort().at(-1))})</> : null}.
                        </>,
                        <>
                          {g.ccee_conjuntos.length} open CCEE datasets feed the module; {g.ccee_conjuntos.filter((c) => c.ultima_tentativa_ok).length} responded on the last attempt
                          {g.ccee_conjuntos[0]?.ultima_tentativa ? <> ({carimbo(g.ccee_conjuntos.map((c) => c.ultima_tentativa ?? "").sort().at(-1))})</> : null}.
                        </>,
                      )}
                    </p>
                  </div>
                  <MercadoDefinicoes g={g} chaves={["acl", "acr", "exportacao", "unidade_consumidora", "pld"]} />
                </SecaoDoPainel>

                {p && <MercadoLimitacoes painel={p} />}
                <SeguirPainel
                  ancora="livre-regulado"
                  proximo={{ href: "/setor-eletrico/mercado/agentes", pergunta: TITULO_PAGINA_MERCADO.agentes }}
                  downloads={[CSV_MERCADO.nacional, CSV_MERCADO.ccee, CSV_MERCADO.consumo, CSV_MERCADO.uf, CSV_MERCADO.distribuidorasAno, CSV_MERCADO.distribuidorasMes].map((d) => ({ ...d }))}
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
