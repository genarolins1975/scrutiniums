import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import Link from "@/components/i18n/LinkIdioma";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import {
  GeracaoAviso,
  GeracaoDatas,
  GeracaoFrases,
  GeracaoIndisponivel,
  GeracaoNavegacao,
  GeracaoRegras,
  GeracaoSeguir,
} from "@/components/energia/GeracaoPagina";
import { GeracaoRestricoes, GeracaoRestricoesAnalise, type RestricaoAnaliseCliente, type RestricaoCliente } from "@/components/energia/GeracaoRestricoes";
import { Numero } from "@/components/energia/Numero";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { Nome } from "@/components/i18n/Nome";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, mesAno, num, plural } from "@/lib/energia/formato";
import {
  FONTES_RESTRICAO,
  colunasDetalhe,
  curtoRazao,
  downloadsDoPainel,
  linhasDetalhe,
  nomeFonteRestricao,
  paraTabela,
  perguntaPainel,
  rotaPainel,
  rotuloRegraGeracao,
  situacaoMensal,
  textoControlesRestricao,
  textoMudancaMensal,
  textoSemComparacaoMensal,
  type FonteRestricao,
} from "@/lib/energia/geracao";
import { integra, lerGold } from "@/lib/energia/gold";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { rotuloGold, rotuloGoldNo } from "@/lib/energia/i18n/geracao";
import type { GoldGeracaoDetalhe, Restricao } from "@/lib/energia/tipos-geracao";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/geracao/restricoes", {
    title: tx("Geração: quanta geração eólica e solar foi restringida", "Generation: how much wind and solar generation was restricted"),
    description: tx(
      "Energia eólica e fotovoltaica não gerada por limitação do ONS, estimada sobre a geração de referência, por razão oficial (energética, confiabilidade, elétrica, parecer de acesso), por usina com mapa e por mês, com a taxa sobre a geração possível e o maior corte simultâneo em MW.",
      "Wind and photovoltaic energy not generated due to ONS limitation, estimated against the reference generation, by official reason (energy, reliability, electrical, access opinion), by plant with a map and by month, with the rate over possible generation and the largest simultaneous cut in MW.",
    ),
    alternates: { canonical: "/setor-eletrico/geracao/restricoes" },
  }, anterior);
}

/** Cor de identificação de cada fonte na faixa de métricas (o marcador antes do rótulo, nunca a cor do texto). */
const COR_FONTE: Record<FonteRestricao, string> = { eolica: "var(--serie-eolica)", solar: "var(--serie-solar)" };

export default function GeracaoRestricoesPage() {
  const g = lerGold<GoldGeracaoDetalhe>("geracao_detalhe.json");
  const rs = integra(g) ? g.restricoes : null;
  const restricoes: Partial<Record<FonteRestricao, Restricao>> = {};
  if (rs?.eolica) restricoes.eolica = rs.eolica;
  if (rs?.solar) restricoes.solar = rs.solar;
  const fontes = FONTES_RESTRICAO.filter((f) => restricoes[f]);
  if (!integra(g) || !fontes.length) {
    return (
      <GeracaoIndisponivel
        motivo={
          (g as { motivo?: string } | null)?.motivo ??
          (g ? tx("As restrições de eólicas e fotovoltaicas não estão na base publicada nesta atualização.", "Wind and photovoltaic restrictions are not in the published dataset in this update.") : undefined)
        }
      />
    );
  }
  const idioma = idiomaEnergia();
  const FONTE = tx("ONS, Restrição de Operação por Constrained-off de Usinas Eólicas e Fotovoltaicas", "ONS, operating restriction (constrained-off) of wind and photovoltaic plants dataset");
  const NOME_CONJUNTO = tx("as restrições de eólicas e fotovoltaicas", "wind and photovoltaic restrictions");
  const NOME_FONTE_RESTRICAO = nomeFonteRestricao();
  const CURTO_RAZAO = curtoRazao();
  const ROTULO_REGRA = rotuloRegraGeracao();
  const ev = g.evidencias;
  const principal = restricoes[fontes[0]]!;
  // cada componente cliente recebe só o que desenha (seção 5.1 do contrato: props pequenas)
  const painel: Partial<Record<FonteRestricao, RestricaoCliente>> = {};
  const analise: Partial<Record<FonteRestricao, RestricaoAnaliseCliente>> = {};
  for (const f of fontes) {
    const { fonte, primeiro_mes, ultimo_mes_completo, mensal_sin, ultimos_12m, usinas_12m, usinas_12m_resumo, diario_recente, descricoes_ultimo_mes } = restricoes[f]!;
    painel[f] = { fonte, primeiro_mes, ultimo_mes_completo, mensal_sin, ultimos_12m, usinas_12m, usinas_12m_resumo };
    analise[f] = { fonte, ultimos_12m, diario_recente, descricoes_ultimo_mes };
  }
  const ultimoMes = fontes.map((f) => restricoes[f]!.ultimo_mes_completo).filter((x): x is string => !!x).sort()[0] ?? null;
  const atual = situacaoMensal(ultimoMes, g.gerado_em, NOME_CONJUNTO);
  const versao = ultimoMes ?? g.dia_referencia;
  const prov = fontes[0] === "eolica" ? g.proveniencia.restricao_eolica : g.proveniencia.restricao_solar;
  const provSolar = fontes[0] === "eolica" ? g.proveniencia.restricao_solar : undefined;
  const u12 = principal.ultimos_12m;
  const ultimoDia = principal.diario_recente.dias.at(-1) ?? g.dia_referencia;
  const mesUltimo = ultimoMes ? mesAno(ultimoMes) : tx("mês não publicado", "month not published");

  // o que mudou: a energia não gerada de cada fonte no último mês completo, contra o mês anterior e o mesmo mês de um ano antes
  const mudancas = fontes
    .map((f) => {
      const r = restricoes[f]!;
      return textoMudancaMensal({
        nome: tx(`a energia não gerada estimada das ${NOME_FONTE_RESTRICAO[f].toLowerCase()}`, `the estimated energy not generated by ${NOME_FONTE_RESTRICAO[f].toLowerCase()} plants`),
        unidade: "GWh",
        casas: 0,
        meses: r.mensal_sin.meses,
        valores: r.mensal_sin.energia_nao_gerada_total_mwh.map((x) => (x === null ? null : x / 1000)),
        mes: r.ultimo_mes_completo,
      });
    })
    .filter((x) => x);
  const oQueMudou = (
    <>
      {mudancas.join(" ")} {textoSemComparacaoMensal(ultimoMes, g.gerado_em, NOME_CONJUNTO)}
    </>
  );
  const retratoPotencia = g.capacidade?.retrato;
  const potenciaOperacao = retratoPotencia
    ? {
        data: retratoPotencia.data,
        eolica: retratoPotencia.por_categoria.find((x) => x.categoria === "eolica")?.mw ?? null,
        solar: retratoPotencia.por_categoria.find((x) => x.categoria === "solar_centralizada")?.mw ?? null,
      }
    : undefined;
  const comoInterpretar = tx(
    <>
      Energia não gerada = geração de referência estimada pelo ONS menos a verificada, só nas meias horas em que o ONS limitou a usina. Taxa = não gerada ÷ (verificada + não gerada), nas mesmas
      usinas e meses: é o denominador documentado, não a capacidade instalada. O maior corte simultâneo é a soma dos cortes de todas as usinas numa mesma meia hora; mede potência, não energia, e
      não se soma ao longo do mês.
    </>,
    <>
      Energy not generated = reference generation estimated by the ONS minus the verified generation, only in the half hours in which the ONS limited the plant. Rate = not generated ÷ (verified + not generated), in the same
      plants and months: it is the documented denominator, not the installed capacity. The largest simultaneous cut is the sum of the cuts of all plants in the same half hour; it measures capacity, not energy, and
      is not added up over the month.
    </>,
  );
  const linkVerbete = (
    <Link href="/setor-eletrico/aprenda/constrained-off" className="text-energia-dark underline underline-offset-4">
      Constrained-off
    </Link>
  );
  const naoConcluir = tx(
    <>
      Que a usina estava indisponível ou que faltou vento ou sol: meia hora sem limitação do ONS não entra, mesmo que a usina tenha gerado abaixo da referência. Que a energia não gerada foi medida: a
      referência é estimativa do ONS. Que a usina no mapa é o lugar onde o corte foi decidido: a marca é a usina afetada, não o ponto da rede que limitou. Que toda razão dá direito a compensação: pela
      norma lida (REN ANEEL nº 1.030/2022, em cópia de 08/01/2025), só a razão de indisponibilidade externa dá direito a <Termo slug="ess">ESS</Termo>, como diz o verbete{" "}
      {linkVerbete}
      ; alterações posteriores indicadas em fontes secundárias (Lei 15.269/2025; Portaria Normativa MME 140/2026) não foram verificadas aqui.
    </>,
    <>
      That the plant was unavailable or that there was a lack of wind or sun: a half hour without an ONS limitation is not counted, even if the plant generated below the reference. That the energy not generated was measured: the
      reference is an ONS estimate. That the plant on the map is the place where the cut was decided: the marker is the affected plant, not the grid point that imposed the limit. That every reason gives the right to compensation: under the
      regulation read (ANEEL normative resolution (REN) No. 1.030/2022, in a copy dated {dataBR("2025-01-08")}), only the external unavailability reason gives the right to the <Termo slug="ess">ESS</Termo>, as the entry{" "}
      {linkVerbete}
      {" "}explains; later changes indicated in secondary sources (<Nome>Lei 15.269/2025</Nome>; <Nome>Portaria Normativa MME 140/2026</Nome>) were not verified here.
    </>,
  );

  return (
    <>
      <header><CabecalhoPlataforma colecao="energia" destinoConta="/setor-eletrico" navegacao="setor-eletrico" idiomas /></header>
      <MarcaVisita secao="energia:geracao" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <GeracaoNavegacao atual="p023" />
        <CabecalhoModulo
          siglas={["SIN", "MMGD", "ONS", "ANEEL", "REN", "ESS", "IBGE"]}
          rotulo={tx("Geração", "Generation")}
          titulo={perguntaPainel("p023")}
          lead={tx(
            <>
              A energia que usinas eólicas e fotovoltaicas deixaram de gerar por limitação do ONS (<Termo slug="constrained-off">constrained-off</Termo>), estimada sobre a geração de referência, e o maior
              corte simultâneo em MW.
            </>,
            <>
              The energy that wind and photovoltaic plants did not generate due to ONS limitation (an operating restriction, <Termo slug="constrained-off">constrained-off</Termo>), estimated against the reference generation, and the largest
              simultaneous cut in MW.
            </>,
          )}
          recorte={
            u12
              ? tx(
                  `${mesAno(u12.inicio)} a ${mesAno(u12.fim)} (12 meses completos) · eólicas e fotovoltaicas despachadas ou programadas pelo ONS · GWh, % e MW`,
                  `${mesAno(u12.inicio)} to ${mesAno(u12.fim)} (12 complete months) · wind and photovoltaic plants dispatched or scheduled by the ONS · GWh, % and MW`,
                )
              : undefined
          }
          fonte={FONTE}
          referencia={tx(
            <>
              {FONTE}, até {mesUltimo} (último mês completo) e dias até {dataBR(ultimoDia)}; processado em {carimbo(g.gerado_em)}.
            </>,
            <>
              {FONTE}, up to {mesUltimo} (latest complete month) and days up to {dataBR(ultimoDia)}; processed on {carimbo(g.gerado_em)}.
            </>,
          )}
          datas={
            <GeracaoDatas
              itens={[
                {
                  rotulo: tx("Energia não gerada, por mês", "Energy not generated, by month"),
                  texto: tx(`até ${mesUltimo} (último mês completo)`, `up to ${mesUltimo} (latest complete month)`),
                  natureza: "ESTIMADO",
                },
                { rotulo: tx("Energia não gerada, por dia", "Energy not generated, by day"), texto: tx(`até ${dataBR(ultimoDia)}`, `up to ${dataBR(ultimoDia)}`), natureza: "ESTIMADO" },
              ]}
            />
          }
          metricas={
            <FaixaMetricas
              colunas={fontes.length > 1 ? 4 : 2}
              rotulo={tx("Energia não gerada e taxa de restrição, 12 meses completos", "Energy not generated and restriction rate, 12 complete months")}
              nota={tx(
                "Denominador: geração verificada mais a não gerada estimada, nas mesmas usinas e meses. Energia e taxa são estimativas do ONS, não medição.",
                "Denominator: verified generation plus the estimated energy not generated, in the same plants and months. Energy and rate are ONS estimates, not measurements.",
              )}
            >
              {fontes.flatMap((f) => {
                const energia = ev[`restricao_${f}_12m_energia`];
                const nome = NOME_FONTE_RESTRICAO[f].toLowerCase();
                return [
                  <Numero
                    key={`${f}-energia`}
                    variante="faixa"
                    rotulo={tx(`Energia não gerada, ${nome}`, `Energy not generated, ${nome}`)}
                    natureza="ESTIMADO"
                    evidencia={energia}
                    valor={energia?.valor_calculo != null ? (energia.valor_calculo as number) / 1e3 : null}
                    unidade="GWh"
                    casas={0}
                    cor={COR_FONTE[f]}
                    endereco={`${rotaPainel("p023")}#p023`}
                  />,
                  <Numero
                    key={`${f}-taxa`}
                    variante="faixa"
                    rotulo={tx(`Taxa de restrição, ${nome}`, `Restriction rate, ${nome}`)}
                    natureza="ESTIMADO"
                    evidencia={ev[`restricao_${f}_12m_taxa`]}
                    formato="pct"
                    casas={1}
                    unidade={tx("da geração possível", "of possible generation")}
                    cor={COR_FONTE[f]}
                    endereco={`${rotaPainel("p023")}#p023`}
                  />,
                ];
              })}
            </FaixaMetricas>
          }
        >
          {tx(
            <>
              O ONS limita a geração de usinas eólicas e fotovoltaicas (o que ele chama de <Termo slug="constrained-off">constrained-off</Termo>) e registra a razão de cada limitação em quatro códigos oficiais: elétrica (indisponibilidade externa),
              confiabilidade, energética e parecer de acesso. Este painel estima quanto deixou de ser gerado nessas limitações e separa duas grandezas que costumam ser confundidas:
              a energia não gerada ao longo do tempo (GWh) e o maior corte simultâneo num instante (MW). Restrição não é indisponibilidade da usina nem falta de vento ou de sol.{" "}
              Para entender o fenômeno com laboratórios interativos e o efeito para o setor, veja{" "}
              <Link href="/setor-eletrico/geracao/curtailment" className="text-energia-dark underline underline-offset-4">
                Curtailment
              </Link>
              .
            </>,
            <>
              The ONS limits the generation of wind and photovoltaic plants (what it calls <Termo slug="constrained-off">constrained-off</Termo>) and records the reason for each limitation in four official codes: electrical (external unavailability),
              reliability, energy and access opinion. This panel estimates how much went ungenerated in these limitations and separates two quantities that are often confused:
              the energy not generated over time (GWh) and the largest simultaneous cut at one instant (MW). A restriction is neither plant unavailability nor a lack of wind or sun.{" "}
              To understand the phenomenon with interactive labs and the effect on the sector, see{" "}
              <Link href="/setor-eletrico/geracao/curtailment" className="text-energia-dark underline underline-offset-4">
                Curtailment
              </Link>
              .
            </>,
          )}
        </CabecalhoModulo>
        <ModoProfundidade>
          <Bloco id="restricoes">
            <PainelEvidencia
              id="p023"
              pergunta={tx("Energia não gerada por razão oficial do ONS", "Energy not generated by official ONS reason")}
              subtitulo={tx("Energia não gerada por restrição do ONS · GWh, % da geração possível e MW", "Energy not generated due to ONS restriction · GWh, % of possible generation and MW")}
              natureza="ESTIMADO"
              porQueImporta={tx(
                <>
                  A energia não gerada mostra quanto da oferta eólica e solar ficou sem uso por decisão da operação, e a razão registrada pelo ONS diz qual tipo de limite
                  prevaleceu em cada caso. Com a expansão dessas fontes, a parcela restringida é um dado central para quem acompanha a operação e o planejamento.
                </>,
                <>
                  The energy not generated shows how much of the wind and solar supply went unused by operational decision, and the reason recorded by the ONS says which type of limit
                  prevailed in each case. As these sources expand, the restricted share is a central figure for those who follow operation and planning.
                </>,
              )}
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={prov!}
              complementares={provSolar ? [{ rotulo: tx("Restrições das fotovoltaicas", "Photovoltaic restrictions"), p: provSolar }] : []}
            >
              <div className="space-y-6">
                {atual.defasada && <GeracaoAviso tipo="alerta">{atual.texto}</GeracaoAviso>}
                <GeracaoRestricoes
                  restricoes={painel}
                  fonte={FONTE}
                  versao={versao}
                  notas={<NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />}
                  rotulosRazao={Object.fromEntries(g.razoes.map((z) => [z.id, rotuloGold(z.rotulo, idioma, CURTO_RAZAO[z.id])]))}
                  potenciaOperacao={potenciaOperacao}
                />

                <SecaoDoPainel
                  nivel="analisar"
                  id="analise-restricoes"
                  titulo={tx("Razões, origem, subsistemas, os últimos dias e o detalhamento publicado pelo ONS", "Reasons, origin, subsystems, the latest days and the detail published by the ONS")}
                >
                  <GeracaoRestricoesAnalise restricoes={analise} fonte={FONTE} versao={versao} />
                </SecaoDoPainel>

                {fontes.map((f) => {
                  const r = restricoes[f]!;
                  const primeiroGnra = r.gnra.primeiro_mes_com_campo ? mesAno(r.gnra.primeiro_mes_com_campo) : tx("mês não informado", "month not reported");
                  return (
                    <SecaoDoPainel
                      nivel="auditar"
                      key={f}
                      id={`auditoria-${f}`}
                      titulo={tx(
                        `${NOME_FONTE_RESTRICAO[f]}: controles da importação e conferência com o detalhamento por usina`,
                        `${NOME_FONTE_RESTRICAO[f]}: import checks and comparison with the by-plant detail`,
                      )}
                    >
                      <GeracaoFrases itens={textoControlesRestricao(r)} />
                      <p className="text-sm text-carvao-muted">
                        {tx(
                          <>
                            Campo GNRa (geração não realizada apurada) presente em {num(r.gnra.meses_com_campo, 0)} meses desde{" "}
                            {primeiroGnra}; maior diferença mensal entre o campo e a regra:{" "}
                            {num(r.gnra.maior_diferenca_mensal_mwh, 1)} MWh.
                          </>,
                          <>
                            GNRa field (assessed unrealized generation) present in {plural(r.gnra.meses_com_campo, "month", "months")} since {primeiroGnra}; largest monthly difference between the field and the rule:{" "}
                            {num(r.gnra.maior_diferenca_mensal_mwh, 1)} MWh.
                          </>,
                        )}
                      </p>
                      {r.detalhe && r.detalhe.length > 0 && (
                        <TabelaInterativa
                          chaveUrl={`det-${f}`}
                          titulo={tx(
                            `Detalhamento por usina dos meses mais recentes contra o arquivo principal, ${NOME_FONTE_RESTRICAO[f].toLowerCase()}`,
                            `By-plant detail of the most recent months against the main file, ${NOME_FONTE_RESTRICAO[f].toLowerCase()}`,
                          )}
                          colunas={colunasDetalhe().map((c) => (c.id === "mes" ? { ...c, id: "id", tipo: "data" as const } : c))}
                          linhas={paraTabela(linhasDetalhe(r))}
                          chaveLinha="id"
                          colunaRotulo="id"
                          fonte={tx(`${FONTE} (detalhamento por usina)`, `${FONTE} (by-plant detail)`)}
                          versao={versao}
                          nomeArquivo={`geracao-restricao-detalhe-${f}`}
                          nota={tx(
                            "O ONS publica o detalhamento por usina só para os meses mais recentes; a diferença compara as mesmas usinas e conjuntos nos dois arquivos.",
                            "The ONS publishes the by-plant detail only for the most recent months; the difference compares the same plants and plant clusters in the two files.",
                          )}
                        />
                      )}
                    </SecaoDoPainel>
                  );
                })}

                <SecaoDoPainel nivel="auditar" id="regras-restricao" titulo={tx("Regras e limitações", "Rules and limitations")}>
                  <GeracaoRegras regras={[{ rotulo: ROTULO_REGRA.restricao, texto: g.regras.restricao }]} />
                  <GeracaoFrases
                    itens={[...(g.proveniencia.restricao_eolica?.limitacoes ?? []), ...(g.proveniencia.restricao_solar?.limitacoes ?? []).filter((x) => !(g.proveniencia.restricao_eolica?.limitacoes ?? []).includes(x))]}
                    daFonte
                  />
                  <ul className="space-y-1 text-sm text-carvao-muted">
                    {g.razoes.map((z) => (
                      <li key={z.id}>
                        <span className="text-carvao">{CURTO_RAZAO[z.id]}</span>: {rotuloGoldNo(z.rotulo, idioma, "geracao-razao-rotulo")}.
                      </li>
                    ))}
                  </ul>
                  {restricoes.solar && (
                    <p className="text-sm text-carvao-muted">
                      {tx(
                        `A série das fotovoltaicas começa em ${mesAno(restricoes.solar.primeiro_mes)}: antes disso o ONS não publicava o conjunto.`,
                        `The photovoltaic series starts in ${mesAno(restricoes.solar.primeiro_mes)}: before that the ONS did not publish the dataset.`,
                      )}
                    </p>
                  )}
                </SecaoDoPainel>

                <GeracaoSeguir ancora="p023" proximo={{ href: `${rotaPainel("p024")}#p024`, pergunta: perguntaPainel("p024") }} downloads={downloadsDoPainel(g.downloads, "p023")} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
