import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoPontos } from "@/components/energia/GraficoPontos";
import { Numero } from "@/components/energia/Numero";
import { RegulacaoLimites } from "@/components/energia/RegulacaoLimites";
import {
  FichaDoAto,
  RegulacaoAviso,
  RegulacaoCapitulos,
  RegulacaoDatas,
  RegulacaoIndisponivel,
  RegulacaoLinkExterno,
  RegulacaoNavegacao,
  RegulacaoRecorte,
} from "@/components/energia/RegulacaoPagina";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { SeguirPainel } from "@/components/energia/SeguirPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, num } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import {
  ALCANCE_LIMITE,
  COLUNAS_ATOS,
  COLUNAS_BANDEIRAS,
  COLUNAS_CONFERENCIAS_DETALHE,
  COLUNAS_CONTAGEM_CONFERENCIAS,
  COLUNAS_PROCEDIMENTOS,
  COR_LIMITE,
  NOME_LIMITE,
  CAMPOS_LIMITE,
  ROTA_REGULACAO,
  SERIES_PROCEDIMENTOS,
  anosLimites,
  atosDoAno,
  avisoToleranciaIpca,
  contagemProcedimentos,
  downloadsDoPainel,
  limitesVigentes,
  linhasAtos,
  linhasBandeiras,
  linhasConferenciasDetalhe,
  linhasContagemConferencias,
  linhasLimites,
  linhasProcedimentos,
  oQueMudouLimites,
  paresRegraIpca,
  perguntaPainel,
  proximoPainel,
  respostaLimites,
  respostaP044,
  respostaProcedimentos,
  rotaPainel,
  rotuloDownload,
  semTravessao,
  textoAtosDoAno,
  textoConferenciaAcionamento,
  textoVigenciaCurta,
  vereditoLimites,
  vereditoP044,
  vigenteEm,
} from "@/lib/energia/regulacao";
import type { ColunaTabela } from "@/lib/energia/tabela";
import type { GoldRegulacao } from "@/lib/energia/tipos-regulacao";
import { snapshotLegivel } from "@/lib/energia/visao";
import { tx } from "@/lib/energia/idioma";
import { PATAMAR_EN, codigo, comNomes, marcado, rotuloDado } from "@/lib/energia/i18n/regulacao-dados-metodo";
import type { ReactNode } from "react";
import Link from "@/components/i18n/LinkIdioma";
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/regulacao", {
    title: tx("Regulação: limites do PLD e regras de preço por período", "Regulation: PLD limits and price rules by period"),
    description: tx(
      "Piso, teto estrutural e teto horário do PLD de cada ano com o ato da ANEEL que os fixou, a publicação no Diário Oficial separada da vigência, as conferências no texto do ato e pelo IPCA, os adicionais das bandeiras tarifárias e as versões vigentes do PRODIST e do PRORET.",
      "Floor, structural ceiling and hourly ceiling of the PLD for each year with the ANEEL act that set them, publication in the Official Gazette kept apart from validity, the checks against the text of the act and the IPCA, the tariff flag surcharges and the versions of PRODIST and PRORET in force.",
    ),
    alternates: { canonical: ROTA_REGULACAO },
  }, anterior);
}

const fonteLimites = () => tx("ANEEL, atos de limites do PLD (texto do ato ou documento oficial do processo)", "ANEEL, PLD limit acts (text of the act or official document of the proceeding)");
/** Painel do PLD que cruza estes limites com o preço observado (horas no piso e nos tetos). */
const ROTA_PLD_LIMITES = "/setor-eletrico/pld/limites";

function colunasAcionamento(): ColunaTabela[] {
  return [
    { id: "patamar", rotulo: tx("Patamar", "Level"), tipo: "texto", categorica: true },
    { id: "rs_mwh", rotulo: tx("Valor no recurso Acionamento", "Value in the Acionamento resource"), tipo: "numero", unidade: "R$/MWh", casas: 2 },
    { id: "inicio", rotulo: tx("Primeiro mês", "First month"), tipo: "data" },
    { id: "fim", rotulo: tx("Último mês", "Last month"), tipo: "data" },
    { id: "meses", rotulo: tx("Meses", "Months"), tipo: "numero", casas: 0 },
    { id: "motivo", rotulo: tx("Por que não há resolução", "Why there is no resolution"), tipo: "texto", categorica: true },
  ];
}

const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export default function RegulacaoPage() {
  const g = lerGold<GoldRegulacao>("regulacao.json");
  if (!integra(g)) return <RegulacaoIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const L = g.limites_pld;
  const linhas = linhasLimites(g);
  const anos = anosLimites(g);
  const vig = vigenteEm(L.vigencias, g.data_referencia);
  const anoPadrao = linhas.find((l) => l.inicio === vig?.inicio)?.id ?? linhas[linhas.length - 1]?.id ?? "";
  const respostas = Object.fromEntries(linhas.map((l) => [l.id, respostaLimites(g, l.ano)]));
  const vereditos = Object.fromEntries(linhas.map((l) => [l.id, vereditoLimites(g, l.ano)]));
  const detalhes = Object.fromEntries(
    linhas.map((l) => [
      l.id,
      atosDoAno(g, l.ano).map((a) => <FichaDoAto key={a.ato} a={a} />),
    ]),
  );
  const ev = g.evidencias.limites;
  const regra = g.regras_limites;
  const proc = g.procedimentos;
  const band = g.bandeiras;
  const pendencias = L.pendencias;
  const proximo = proximoPainel("p044");
  const versao = g.data_referencia;
  const ipca = paresRegraIpca(g);
  const avisoIpca = avisoToleranciaIpca(g);
  const semPublicacao = Array.from(new Set(L.atos.filter((a) => !a.data_publicacao).map((a) => a.ano)));
  // anos em que nenhum ato foi lido no texto: o valor veio de documento oficial do mesmo processo
  const anosSemTexto = Array.from(new Set(L.atos.filter((a) => a.nivel_conferencia !== "texto_do_ato").map((a) => a.ano))).sort((a, b) => a - b);
  const { limites } = limitesVigentes(g);
  const atosMaisRecente = L.atos.slice().sort((a, b) => (b.data_publicacao ?? b.vigencia_inicio).localeCompare(a.data_publicacao ?? a.vigencia_inicio))[0];
  const dataRef = dataBR(g.data_referencia);

  const oQueMudou = <>{comNomes(oQueMudouLimites(g))}</>;
  const comoInterpretar = tx(
    <>
      O teto horário limita cada hora; o teto estrutural limita a média diária dos preços horários, e a CCEE (Câmara de Comercialização de Energia Elétrica) ajusta o dia
      quando a média passa dele; o piso vale para todas as horas. Os valores são os escritos no ato, conferidos no PDF guardado; quando o texto do ato não está acessível,
      o valor foi lido em voto ou nota técnica do mesmo processo e isso aparece em cada ato.
    </>,
    <>
      The hourly ceiling caps each hour; the structural ceiling caps the daily average of hourly prices, and the CCEE (Electric Energy Trading Chamber) adjusts the day when
      the average goes above it; the floor applies to every hour. The values are those written in the act, checked in the stored PDF; when the text of the act is not
      accessible, the value was read in a vote or technical note of the same proceeding, and this is shown for each act.
    </>,
  );
  const naoConcluir = tx(
    <>
      Os valores são nominais: a diferença entre anos inclui a inflação, já que os tetos são atualizados pelo IPCA, e não mede aumento real. O menor PLD observado nunca
      substitui o piso: sem ato, o campo fica vazio. Esta página não diz quantas horas o PLD ficou no piso ou nos tetos: isso está em{" "}
      <Link href={ROTA_PLD_LIMITES} className="text-energia-dark underline underline-offset-4">
        limites, piso e tetos do PLD
      </Link>
      . A versão que a página oficial do PRODIST ou do PRORET publica não prova que ela é a vigente quando há ato posterior que aprova outra.
      {semPublicacao.length
        ? ` A publicação no DOU de ${semPublicacao.join(", ")} não foi conferida, porque o extrato do ato não está acessível: a data fica vazia, nunca com a data de captura.`
        : ""}{" "}
      A leitura dos atos é do observatório: não é parecer jurídico, e o texto oficial de cada ato está em Analisar.
    </>,
    <>
      The values are nominal: the difference between years includes inflation, since the ceilings are updated by the IPCA, and does not measure a real increase. The lowest
      PLD observed never replaces the floor: without an act, the field stays empty. This page does not say how many hours the PLD stayed at the floor or the ceilings: that
      is in{" "}
      <Link href={ROTA_PLD_LIMITES} className="text-energia-dark underline underline-offset-4">
        PLD limits, floor and ceilings
      </Link>
      . The version published on the official PRODIST or PRORET page does not prove it is the one in force when a later act approves another.
      {semPublicacao.length
        ? ` Publication in the DOU for ${semPublicacao.join(", ")} was not checked, as the summary of the act is not accessible: the date stays empty, never filled with the capture date.`
        : ""}{" "}
      The reading of the acts is the observatory&apos;s: it is not legal advice, and the official text of each act is under Analyze.
    </>,
  );

  return (
    <>
      <header><CabecalhoPlataforma colecao="energia" destinoConta="/setor-eletrico" navegacao="setor-eletrico" idiomas /></header>
      <MarcaVisita secao="energia:regulacao" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <RegulacaoNavegacao atual="p044" />
        <CabecalhoModulo
          siglas={["PLD", "DOU", "ANEEL", "CCEE", "PRODIST", "PRORET", "REN", "REH"]}
          titulo={perguntaPainel("p044")}
          lead={tx(
            "O piso e os dois tetos do Preço de Liquidação das Diferenças (PLD) em cada ano, com o ato da ANEEL que os fixou e as datas de publicação e de vigência separadas.",
            "The floor and the two ceilings of the spot price (PLD) in each year, with the ANEEL act that set them and the publication and validity dates kept apart.",
          )}
          recorte={tx(
            `Vigência em ${dataRef} · limites de ${anos[0]} a ${anos[anos.length - 1]} · R$/MWh nominais`,
            `In force on ${dataRef} · limits from ${anos[0]} to ${anos[anos.length - 1]} · nominal R$/MWh`,
          )}
          fonte={tx("ANEEL, Agência Nacional de Energia Elétrica, atos anuais de limites do PLD", "ANEEL, Brazilian Electricity Regulatory Agency, annual PLD limit acts")}
          referencia={tx(
            <>
              ANEEL, atos de limites do PLD, recursos de bandeiras tarifárias e páginas oficiais do PRODIST e do PRORET; data de referência {dataRef}; processado em{" "}
              {carimbo(g.gerado_em)}.
            </>,
            <>
              ANEEL, PLD limit acts, tariff flag resources and the official PRODIST and PRORET pages; reference date {dataRef}; processed on {carimbo(g.gerado_em)}.
            </>,
          )}
          datas={
            <RegulacaoDatas
              itens={[
                {
                  rotulo: tx("Limites do PLD", "PLD limits"),
                  texto: tx(
                    `${atosMaisRecente ? `ato mais recente publicado em ${dataBR(atosMaisRecente.data_publicacao ?? atosMaisRecente.vigencia_inicio)}; ` : ""}atos conferidos em ${dataBR(L.conferido_em)}`,
                    `${atosMaisRecente ? `most recent act published on ${dataBR(atosMaisRecente.data_publicacao ?? atosMaisRecente.vigencia_inicio)}; ` : ""}acts checked on ${dataBR(L.conferido_em)}`,
                  ),
                  natureza: "OBSERVADO",
                },
                { rotulo: tx("Bandeiras", "Tariff flags"), texto: tx(`adicionais gerados pela ANEEL em ${dataBR(band.gerado_pela_fonte_em)}`, `surcharges generated by ANEEL on ${dataBR(band.gerado_pela_fonte_em)}`), natureza: "OBSERVADO" },
                { rotulo: tx("PRODIST e PRORET", "PRODIST and PRORET"), texto: tx(`páginas verificadas em ${carimbo(proc.verificado_em.prodist)}`, `pages verified on ${carimbo(proc.verificado_em.prodist)}`), natureza: "OBSERVADO" },
              ]}
            />
          }
          metricas={
            <FaixaMetricas
              colunas={3}
              rotulo={tx(`Limites do PLD vigentes em ${dataRef}`, `PLD limits in force on ${dataRef}`)}
              nota={
                <>
                  {tx(`Valores vigentes em ${dataRef}; não mudam com o ano escolhido no gráfico.`, `Values in force on ${dataRef}; they do not change with the year chosen in the chart.`)}{" "}
                  {limites.length ? comNomes(textoAtosDoAno(g, vig?.ano ?? 0)) : ""}
                </>
              }
            >
              {CAMPOS_LIMITE.map((c) => {
                const l = limites.find((x) => x.campo === c);
                return ev[c] && l ? (
                  <Numero
                    key={c}
                    variante="faixa"
                    rotulo={NOME_LIMITE[c]}
                    natureza="OBSERVADO"
                    evidencia={ev[c]}
                    formato="reais"
                    casas={2}
                    periodo={textoVigenciaCurta(l.inicio, l.fim)}
                    cor={COR_LIMITE[c]}
                    nota={maiuscula(`${ALCANCE_LIMITE[c]}.`)}
                    endereco={`${ROTA_REGULACAO}#p044`}
                  />
                ) : (
                  <Numero
                    key={c}
                    variante="faixa"
                    rotulo={NOME_LIMITE[c]}
                    natureza="OBSERVADO"
                    valor={null}
                    cor={COR_LIMITE[c]}
                    motivoAusencia={tx(`Sem ato em vigor que fixe este limite em ${dataRef}.`, `No act in force sets this limit on ${dataRef}.`)}
                  />
                );
              })}
            </FaixaMetricas>
          }
        >
          {tx(
            <>
              Esta página responde quais regras de preço valem em cada período e qual ato as fixou, com a data em que o ato saiu no Diário Oficial e a data em que começou a valer
              em campos separados. Ela parte dos <Termo slug="limites-do-pld">limites</Termo> do <Termo slug="pld">PLD</Termo>, que a página do preço usa para dizer se um valor
              está no piso ou no teto. As outras duas páginas são a linha do tempo do que mudou e as consultas abertas e a agenda da ANEEL.
            </>,
            <>
              This page answers which price rules apply in each period and which act set them, with the date the act appeared in the Official Gazette and the date it took
              effect in separate fields. It starts from the <Termo slug="limites-do-pld">limits</Termo> of the <Termo slug="pld">PLD</Termo>, which the price page uses to say whether
              a value is at the floor or the ceiling. The other two pages are the timeline of what changed and ANEEL&apos;s open consultations and agenda.
            </>,
          )}
        </CabecalhoModulo>
        <ModoProfundidade>
          <Bloco id="limites">
            <PainelEvidencia
              id="p044"
              pergunta={tx("Quais são os limites de cada ano e qual ato os fixou?", "What are the limits of each year, and which act set them?")}
              subtitulo={tx(
                "Limites do PLD por ano, adicionais das bandeiras e versões do PRODIST e do PRORET · R$/MWh nominais",
                "PLD limits by year, tariff flag surcharges and PRODIST and PRORET versions · nominal R$/MWh",
              )}
              natureza="OBSERVADO"
              porQueImporta={
                tx(
                  <>
                    O piso e os tetos dizem até onde o PLD pode ir em cada hora e em cada dia; sem eles, um PLD no piso parece só um preço baixo. Saber qual ato vale, e desde
                    quando, evita aplicar o limite de um ano a outro e confundir a data em que a regra foi publicada com a data em que passou a valer.
                  </>,
                  <>
                    The floor and the ceilings say how far the PLD can go in each hour and each day; without them, a PLD at the floor looks like just a low price. Knowing which
                    act applies, and since when, avoids applying one year&apos;s limit to another and confusing the date a rule was published with the date it took effect.
                  </>,
                )
              }
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={g.proveniencia.limites}
              complementares={[
                { rotulo: tx("Adicionais das bandeiras tarifárias", "Tariff flag surcharges"), p: g.proveniencia.bandeiras },
                { rotulo: tx("Versões do PRODIST e do PRORET", "PRODIST and PRORET versions"), p: g.proveniencia.procedimentos },
              ]}
            >
              <div className="space-y-6">
                <RegulacaoLimites
                  linhas={linhas}
                  anoPadrao={anoPadrao}
                  respostas={respostas}
                  vereditos={vereditos}
                  detalhes={detalhes}
                  fonte={fonteLimites()}
                  versao={versao}
                  legendaFigura={tx(
                    <>
                      Cada grupo de barras é um ano; as três barras partem do zero, então a altura compara valores. Escolha um ano no gráfico, na tabela ou no seletor para ver os
                      atos dele.
                    </>,
                    <>
                      Each group of bars is a year; the three bars start at zero, so height compares values. Choose a year in the chart, the table or the selector to see its acts.
                    </>,
                  )}
                  avisos={
                    <div className="space-y-3">
                      {anosSemTexto.length > 0 && (
                        <RegulacaoAviso>
                          {tx(
                            `Os valores de ${anosSemTexto.join(" e ")} foram lidos em documento oficial do mesmo processo, porque o texto do ato não estava acessível. O detalhe de cada limitação está em Analisar.`,
                            `The values for ${anosSemTexto.join(" and ")} were read in an official document of the same proceeding, as the text of the act was not accessible. The detail of each limitation is under Analyze.`,
                          )}
                        </RegulacaoAviso>
                      )}
                      {g.limites_em_revisao && g.limites_em_revisao.length > 0 && (
                        <RegulacaoAviso>
                          {tx("Em revisão na Agenda Regulatória: ", "Under review on the regulatory agenda: ")}
                          {g.limites_em_revisao.map((a, i) => (
                            <span key={a.codigo}>
                              {i > 0 ? "; " : ""}
                              {a.codigo}, <TrechoPortugues regiao="regulacao-agenda-atividade">{semTravessao(a.atividade.replace(/\.$/, ""))}</TrechoPortugues>
                              {tx(`, prevista para ${a.ano_previsto}`, `, planned for ${a.ano_previsto}`)}
                            </span>
                          ))}
                          {tx(". O ano é previsão da ANEEL.", ". The year is an ANEEL forecast.")}{" "}
                          <Link href={`${rotaPainel("p046")}#agenda`} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
                            {tx("Ver a agenda inteira", "See the whole agenda")}
                          </Link>
                        </RegulacaoAviso>
                      )}
                      {pendencias.length > 0 && (
                        <div data-nivel="analisar">
                          <RegulacaoAviso>
                            {tx("Limitação declarada:", "Declared limitation:")}{" "}
                            <TrechoPortugues regiao="regulacao-limites-pendencias">{pendencias.map((p) => `${p.ano}: ${p.item} ${p.situacao}; ${p.efeito}`).join(" ")}</TrechoPortugues>
                          </RegulacaoAviso>
                        </div>
                      )}
                    </div>
                  }
                  resposta={
                    <RespostaCurta id="p044" depois veredito={vereditoP044(g)}>
                      {comNomes(respostaP044(g))}
                    </RespostaCurta>
                  }
                  recorte={
                    <RegulacaoRecorte
                      periodo={
                        tx(
                          <>
                            {anos.length ? `${anos[0]} a ${anos[anos.length - 1]}, por ano civil de vigência` : "sem ato integrado"}; bandeiras de {dataBR(band.vigencias[0]?.vigencia_inicio ?? null)} em
                            diante
                          </>,
                          <>
                            {anos.length ? `${anos[0]} to ${anos[anos.length - 1]}, by calendar year of validity` : "no integrated act"}; tariff flags from{" "}
                            {dataBR(band.vigencias[0]?.vigencia_inicio ?? null)} onward
                          </>,
                        )
                      }
                      universo={tx(
                        "Limites do PLD fixados pela ANEEL para todos os submercados; adicionais das bandeiras; módulos do PRODIST e submódulos do PRORET",
                        "PLD limits set by ANEEL for all submarkets; tariff flag surcharges; PRODIST modules and PRORET submodules",
                      )}
                      unidade={tx("R$/MWh nominais, como escritos nos atos", "Nominal R$/MWh, as written in the acts")}
                    />
                  }
                  notas={<NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />}
                  aposPrincipal={<RegulacaoCapitulos />}
                />

                <SecaoDoPainel
                  id="bandeiras"
                  titulo={tx("Quanto cada bandeira tarifária acrescenta à tarifa, e desde quando?", "How much does each tariff flag add to the tariff, and since when?")}
                  lead={
                    <>
                      {tx(
                        <>
                          Quanto cada patamar de <Termo slug="bandeira-tarifaria">bandeira</Termo> acrescenta à tarifa, por resolução, em R$/MWh. O fim de cada valor é a véspera do valor
                          seguinte do mesmo patamar, salvo quando o recurso de acionamento mensal mostra outro valor antes (fim conhecido só pelo mês) ou o patamar foi extinto.
                        </>,
                        <>
                          How much each <Termo slug="bandeira-tarifaria">tariff flag</Termo> level adds to the tariff, by resolution, in R$/MWh. The end of each value is the day before the
                          next value of the same level, unless the monthly activation resource shows another value earlier (end known only by month) or the level was discontinued.
                        </>,
                      )}{" "}
                      {textoConferenciaAcionamento(band.conferencia_acionamento)}
                    </>
                  }
                >
                  <GraficoBarras
                    titulo={tx("Adicional de cada patamar, desde a vigência de cada resolução", "Surcharge of each level, from the validity of each resolution")}
                    dados={linhasBandeiras(g)}
                    chaveCategoria="id"
                    chaveRotulo="rotulo"
                    // i18n: dado
                    series={[{ id: "rs_mwh", rotulo: tx("Adicional", "Surcharge"), cor: "var(--cor-energia)" }]}
                    unidade="R$/MWh"
                    casas={2}
                    orientacao="horizontal"
                    rotulosValor
                    alturaMaxima={520}
                  />
                  <TabelaInterativa
                    titulo={tx("Vigências dos adicionais das bandeiras", "Periods in force of the tariff flag surcharges")}
                    colunas={COLUNAS_BANDEIRAS}
                    linhas={linhasBandeiras(g)}
                    chaveLinha="id"
                    colunaRotulo="patamar"
                    fonte={tx("ANEEL, Bandeiras Tarifárias (recursos Adicional e Acionamento)", "ANEEL, tariff flag dataset (Adicional and Acionamento resources)")}
                    versao={band.acionamento_gerado_pela_fonte_em ?? versao}
                    nomeArquivo="regulacao-bandeiras-adicionais"
                    chaveUrl="band"
                    nota={tx(
                      `Recurso Adicional gerado pela ANEEL em ${dataBR(band.gerado_pela_fonte_em)}; recurso Acionamento com ${band.acionamento_meses} meses (${dataBR(band.acionamento_periodo?.inicio ?? null)} a ${dataBR(band.acionamento_periodo?.fim ?? null)}). A data de publicação das resoluções não é informada pela fonte.`,
                      `Adicional resource generated by ANEEL on ${dataBR(band.gerado_pela_fonte_em)}; Acionamento resource with ${band.acionamento_meses} months (${dataBR(band.acionamento_periodo?.inicio ?? null)} to ${dataBR(band.acionamento_periodo?.fim ?? null)}). The publication date of the resolutions is not reported by the source.`,
                    )}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel
                  id="procedimentos"
                  titulo={tx("Que versões do PRODIST e do PRORET as páginas oficiais publicam?", "Which PRODIST and PRORET versions do the official pages publish?")}
                  lead={
                    <>
                      {tx(
                        "PRODIST é o conjunto de Procedimentos de Distribuição de Energia Elétrica no Sistema Elétrico Nacional e PRORET, o de Procedimentos de Regulação Tarifária.",
                        "PRODIST is the set of Electricity Distribution Procedures in the National Electric System, and PRORET the set of Tariff Regulation Procedures.",
                      )}{" "}
                      <span data-resposta-procedimentos="">{marcado(respostaProcedimentos(proc), proc.itens.map((i) => `${i.conjunto} ${i.modulo}`))}</span>
                    </>
                  }
                >
                  <GraficoBarras
                    titulo={tx("Itens por conjunto e resultado da conferência", "Items by set and check result")}
                    dados={contagemProcedimentos(proc.itens)}
                    chaveCategoria="id"
                    chaveRotulo="conjunto"
                    series={SERIES_PROCEDIMENTOS}
                    unidade={tx("itens", "items")}
                    casas={0}
                    orientacao="horizontal"
                    empilhado
                    rotulosValor
                  />
                  <TabelaInterativa
                    titulo={tx("Módulos do PRODIST e submódulos do PRORET", "PRODIST modules and PRORET submodules")}
                    colunas={COLUNAS_PROCEDIMENTOS}
                    linhas={linhasProcedimentos(proc.itens)}
                    chaveLinha="id"
                    colunaRotulo="modulo"
                    fonte={tx("ANEEL, páginas oficiais do PRODIST e do PRORET, atas da Diretoria e Resoluções Normativas lidas", "ANEEL, official PRODIST and PRORET pages, Board minutes and normative resolutions read")}
                    versao={(proc.verificado_em.prodist ?? versao).slice(0, 10)}
                    nomeArquivo="regulacao-procedimentos"
                    chaveUrl="proc"
                    dicaBusca={tx("Módulo, título ou ato", "Module, title or act")}
                    nota={tx(
                      <>
                        Páginas verificadas em {carimbo(proc.verificado_em.prodist)} (PRODIST) e {carimbo(proc.verificado_em.proret)} (PRORET). O conteúdo dos módulos não foi lido: os PDFs
                        estão num servidor da ANEEL que bloqueia acesso automatizado. <RegulacaoLinkExterno href={proc.paginas.PRODIST}>Página do PRODIST</RegulacaoLinkExterno>;{" "}
                        <RegulacaoLinkExterno href={proc.paginas.PRORET}>página do PRORET</RegulacaoLinkExterno>.
                      </>,
                      <>
                        Pages verified on {carimbo(proc.verificado_em.prodist)} (PRODIST) and {carimbo(proc.verificado_em.proret)} (PRORET). The content of the modules was not read: the PDFs
                        are on an ANEEL server that blocks automated access. <RegulacaoLinkExterno href={proc.paginas.PRODIST}>PRODIST page</RegulacaoLinkExterno>;{" "}
                        <RegulacaoLinkExterno href={proc.paginas.PRORET}>PRORET page</RegulacaoLinkExterno>.
                      </>,
                    )}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="regra" nivel="analisar" titulo={tx("A regra dos limites e como os atos a aplicam", "The rule for the limits and how the acts apply it")}>
                  {regra ? (
                    <div className="space-y-2 text-sm leading-relaxed text-carvao-muted">
                      <p>
                        <span className="text-carvao">
                          <Nome>{regra.ato}</Nome>
                        </span>
                        , <TrechoPortugues regiao="regulacao-regra-dispositivo">{regra.dispositivo}</TrechoPortugues>
                        {tx(`; vigência desde ${dataBR(regra.vigencia_inicio)}.`, `; in force since ${dataBR(regra.vigencia_inicio)}.`)}{" "}
                        <TrechoPortugues regiao="regulacao-regra-resumo">{regra.resumo}</TrechoPortugues>
                      </p>
                      <p className="text-carvao" data-pratica-dos-atos="">
                        <TrechoPortugues regiao="regulacao-regra-pratica">{regra.pratica_dos_atos.texto}</TrechoPortugues>
                      </p>
                      <details>
                        <summary className="inline-flex min-h-[44px] cursor-pointer items-center underline underline-offset-4">{tx("Trecho literal da resolução", "Literal passage of the resolution")}</summary>
                        <p className="border-l-2 border-linha pl-3">
                          <TrechoPortugues regiao="regulacao-regra-trecho">
                            <q>{regra.trecho}</q>
                          </TrechoPortugues>
                        </p>
                      </details>
                      {regra.url_oficial && (
                        <RegulacaoLinkExterno href={regra.url_oficial} bloco>
                          {tx("Texto da resolução no endereço oficial da ANEEL", "Text of the resolution at ANEEL's official address")}
                        </RegulacaoLinkExterno>
                      )}
                    </div>
                  ) : (
                    <RegulacaoAviso>
                      {tx(
                        "A resolução que regula os limites não foi lida nesta publicação; a regra fica sem descrição em vez de escrita de memória.",
                        "The resolution that regulates the limits was not read in this publication; the rule is left without a description instead of being written from memory.",
                      )}
                    </RegulacaoAviso>
                  )}
                  <div>
                    <p className="rotulo text-mineral">{tx("Limites em revisão na Agenda Regulatória", "Limits under review on the regulatory agenda")}</p>
                    {g.limites_em_revisao === null ? (
                      <p className="mt-1 text-sm text-carvao-muted">
                        {tx(
                          "A Agenda Regulatória não foi lida nesta publicação; as atividades que tratam dos limites do PLD ficam sem informação.",
                          "The regulatory agenda was not read in this publication; the activities dealing with the PLD limits are left without information.",
                        )}
                      </p>
                    ) : g.limites_em_revisao.length ? (
                      <ul className="mt-1 space-y-1 text-sm text-carvao">
                        {g.limites_em_revisao.map((a) => (
                          <li key={a.codigo}>
                            <span className="tabular-nums">{a.codigo}</span>: <TrechoPortugues regiao="regulacao-agenda-atividade">{a.atividade}</TrechoPortugues>{" "}
                            {tx(`Prevista para ${a.ano_previsto}.`, `Planned for ${a.ano_previsto}.`)}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-sm text-carvao-muted">{tx("Nenhuma atividade da agenda trata dos limites do PLD.", "No agenda activity deals with the PLD limits.")}</p>
                    )}
                  </div>
                </SecaoDoPainel>

                <SecaoDoPainel id="atos" nivel="auditar" titulo={tx("Todos os atos de limites, com documento, página e sha256", "All limit acts, with document, page and sha256")}>
                  <TabelaInterativa
                    titulo={tx("Atos de limites do PLD", "PLD limit acts")}
                    colunas={COLUNAS_ATOS}
                    linhas={linhasAtos(g)}
                    chaveLinha="id"
                    colunaRotulo="ato"
                    fonte={fonteLimites()}
                    versao={L.conferido_em}
                    nomeArquivo="regulacao-limites-pld-atos"
                    chaveUrl="atos"
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="conferencias" nivel="auditar" titulo={tx("Conferências executadas a cada publicação", "Checks run at each publication")}>
                  <TabelaInterativa
                    titulo={tx("Resultado das conferências por tipo", "Check results by type")}
                    colunas={COLUNAS_CONTAGEM_CONFERENCIAS}
                    linhas={linhasContagemConferencias(g)}
                    chaveLinha="id"
                    colunaRotulo="conferencia"
                    fonte={tx("Conferências do observatório sobre os atos da ANEEL e o IPCA do IBGE", "Observatory checks on ANEEL acts and IBGE's IPCA")}
                    versao={L.conferido_em}
                    nomeArquivo="regulacao-conferencias-contagem"
                    chaveUrl="cconf"
                  />
                  {ipca.length > 0 && (
                    <GraficoPontos
                      titulo={tx("Teto publicado e teto refeito pelo encadeamento do IPCA", "Published ceiling and ceiling recomputed by IPCA chaining")}
                      itens={ipca}
                      unidade="R$/MWh"
                      casas={2}
                      rotuloValor={tx("Publicado no ato", "Published in the act")}
                      rotuloReferencia={tx("Teto do ano anterior × IPCA de novembro", "Previous year's ceiling × November IPCA")}
                      unidadeDiferenca="R$/MWh"
                    />
                  )}
                  {avisoIpca && <RegulacaoAviso>{avisoIpca}</RegulacaoAviso>}
                  <TabelaInterativa
                    titulo={tx("Conferências numéricas, uma por ato, ano e campo", "Numerical checks, one per act, year and field")}
                    colunas={COLUNAS_CONFERENCIAS_DETALHE}
                    linhas={linhasConferenciasDetalhe(g)}
                    chaveLinha="id"
                    colunaRotulo="ato"
                    fonte={tx("Conferências do observatório sobre os atos da ANEEL e o IPCA do IBGE", "Observatory checks on ANEEL acts and IBGE's IPCA")}
                    versao={L.conferido_em}
                    nomeArquivo="regulacao-conferencias-detalhe"
                    chaveUrl="conf"
                  />
                  {L.metodo && (
                    <p className="text-sm leading-relaxed text-carvao-muted">
                      <TrechoPortugues regiao="regulacao-limites-metodo">{L.metodo}</TrechoPortugues>
                    </p>
                  )}
                </SecaoDoPainel>

                <SecaoDoPainel id="bandeiras-acionamento" nivel="auditar" titulo={tx("Valores do recurso Acionamento sem resolução no recurso Adicional", "Acionamento resource values with no resolution in the Adicional resource")}>
                  <TabelaInterativa
                    titulo={tx("Valores vistos só no recurso Acionamento", "Values seen only in the Acionamento resource")}
                    colunas={colunasAcionamento()}
                    linhas={band.acionamentos_sem_resolucao.map((x) => ({
                      id: `${x.patamar}:${x.inicio}`,
                      patamar: rotuloDado(PATAMAR_EN, x.patamar),
                      rs_mwh: x.rs_mwh,
                      inicio: x.inicio,
                      fim: x.fim,
                      meses: x.meses,
                      motivo: x.motivo === "valor_diferente" ? tx("há resolução no mês, com outro valor", "there is a resolution in the month, with another value") : tx("nenhuma resolução cobre o mês", "no resolution covers the month"),
                    }))}
                    chaveLinha="id"
                    colunaRotulo="patamar"
                    fonte={tx("ANEEL, Bandeiras Tarifárias (recurso Acionamento)", "ANEEL, tariff flag dataset (Acionamento resource)")}
                    versao={band.acionamento_gerado_pela_fonte_em ?? versao}
                    nomeArquivo="regulacao-bandeiras-acionamento-sem-resolucao"
                    chaveUrl="acion"
                    semLinhas={tx("Todos os meses acionados têm resolução correspondente.", "Every activated month has a matching resolution.")}
                    nota={<TrechoPortugues regiao="regulacao-acionamento-regra">{band.conferencia_acionamento.regra}</TrechoPortugues>}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="bloqueios" nivel="auditar" titulo={tx("Fontes bloqueadas e o que foi feito", "Blocked sources and what was done")}>
                  <ul className="space-y-2 text-sm text-carvao-muted">
                    {L.bloqueios.map((b) => (
                      <li key={b.fonte} className="[overflow-wrap:anywhere]">
                        <span className="text-carvao">
                          <TrechoPortugues regiao="regulacao-bloqueio-fonte">{b.fonte}</TrechoPortugues>
                        </span>{" "}
                        {tx(`(verificado em ${dataBR(b.verificado_em)}):`, `(verified on ${dataBR(b.verificado_em)}):`)}{" "}
                        <TrechoPortugues regiao="regulacao-bloqueio-resposta">{b.resposta}</TrechoPortugues>. {tx("Conduta:", "Action taken:")}{" "}
                        <TrechoPortugues regiao="regulacao-bloqueio-conduta">{b.conduta}</TrechoPortugues>.
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm text-carvao-muted [overflow-wrap:anywhere]">
                    {tx("Curadoria versionada", "Versioned curation")} {g.curadoria.snapshot.id ? marcado(snapshotLegivel(g.curadoria.snapshot.id)) : tx("sem identificador", "no identifier")} (sha256{" "}
                    {g.curadoria.snapshot.sha256 ? codigo(g.curadoria.snapshot.sha256) : tx("não informado", "not reported")}):{" "}
                    {marcado(
                      g.curadoria.arquivos
                        .map((a) => tx(`${a.arquivo} (sha256 ${a.sha256.slice(0, 12)}…, registrado em ${carimbo(a.registrado_em)})`, `${a.arquivo} (sha256 ${a.sha256.slice(0, 12)}…, recorded on ${carimbo(a.registrado_em)})`))
                        .join("; "),
                    )}
                    .
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-carvao-muted">
                    {g.limitacoes.map((t) => (
                      <li key={t}>
                        <TrechoPortugues regiao="regulacao-limitacoes">{t}</TrechoPortugues>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-mineral">
                    {tx<ReactNode>(
                      `${num(L.atos.length, 0)} atos; conferências refeitas em ${dataBR(L.conferido_em)}. Para reproduzir: python3 pipeline/energia/executar_modulo.py regulacao --sem-coleta.`,
                      // o comando é identificador, não prosa
                      <>
                        {num(L.atos.length, 0)} acts; checks redone on {dataBR(L.conferido_em)}. To reproduce: {codigo("python3 pipeline/energia/executar_modulo.py regulacao --sem-coleta")}.
                      </>,
                    )}
                  </p>
                </SecaoDoPainel>

                <SeguirPainel
                  ancora="p044"
                  proximo={{ href: `${proximo.rota}#${proximo.id}`, pergunta: proximo.pergunta }}
                  downloads={downloadsDoPainel(g, "p044").map((d) => ({ ...d, rotulo: rotuloDownload(d.rotulo) }))}
                />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
