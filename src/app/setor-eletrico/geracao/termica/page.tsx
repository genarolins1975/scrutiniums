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
import { GeracaoTermica } from "@/components/energia/GeracaoTermica";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { Numero } from "@/components/energia/Numero";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { GeracaoTabelaSobDemanda } from "@/components/energia/GeracaoTabelasSobDemanda";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, mesAno, num } from "@/lib/energia/formato";
import {
  COR_COMBUSTIVEL,
  combustiveisCvu,
  curtoCombustivel,
  downloadsDoPainel,
  emPortugues,
  explicacaoDoMotivo,
  linhasCvuMensal,
  inflexibilidadeSemNuclear,
  diasDoBalancoForaDoPadrao,
  mwmed,
  notaCrescimentoUniverso,
  notaCvuZero,
  notaNaoClassificado,
  painelPublicado,
  perguntaPainel,
  rotaPainel,
  rotuloOrigemCombustivel,
  rotuloRegraGeracao,
  situacaoMensal,
  somaTermicaDaMatriz,
  textoCvu,
  textoDiasDoBalancoForaDoPadrao,
  textoMudancaMensal,
  textoSemComparacaoMensal,
  textoTermica7d,
  type TermicaCliente,
} from "@/lib/energia/geracao";
import { gold, integra, lerGold } from "@/lib/energia/gold";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { nomeNo, nomesNo, rotuloGoldNo } from "@/lib/energia/i18n/geracao";
import type { GoldGeracaoDetalhe } from "@/lib/energia/tipos-geracao";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/geracao/termica", {
    title: tx("Geração: quanto as térmicas geraram e por que foram acionadas", "Generation: how much thermal plants generated and why they were dispatched"),
    description: tx(
      "Geração térmica verificada do SIN por motivo de despacho do ONS (inflexibilidade, ordem de mérito, unit commitment, exportação, razão elétrica e outros) e por combustível, as usinas com mais geração e suas parcelas, o CVU da semana operativa vigente e a participação térmica da semana em contexto.",
      "Verified SIN thermal generation by ONS dispatch reason (inflexibility, merit order, unit commitment, export, electrical reason and others) and by fuel, the plants with the most generation and their portions, the CVU for the current operating week, and the week's thermal share in context.",
    ),
    alternates: { canonical: "/setor-eletrico/geracao/termica" },
  }, anterior);
}

export default function GeracaoTermicaPage() {
  const g = lerGold<GoldGeracaoDetalhe>("geracao_detalhe.json");
  if (!integra(g) || !g.termica) {
    return (
      <GeracaoIndisponivel
        motivo={
          (g as { motivo?: string } | null)?.motivo ??
          (g ? tx("A térmica por motivo de despacho não está na base publicada nesta atualização.", "Thermal generation by dispatch reason is not in the published dataset in this update.") : undefined)
        }
      />
    );
  }
  const idioma = idiomaEnergia();
  const FONTE = tx("ONS, Geração Térmica por Motivo de Despacho", "ONS, thermal generation by dispatch reason dataset");
  const FONTE_CVU = tx("ONS, CVU das Usinas Térmicas", "ONS, thermal plant CVU dataset");
  const NOME_CONJUNTO = tx("a térmica por motivo de despacho", "thermal generation by dispatch reason");
  const CURTO_COMBUSTIVEL = curtoCombustivel();
  const ROTULO_ORIGEM_COMBUSTIVEL = rotuloOrigemCombustivel();
  const ROTULO_REGRA = rotuloRegraGeracao();
  const UNIDADE = mwmed();
  const t = g.termica;
  const ev = g.evidencias;
  const op = gold.geracao();
  const ctx = integra(op) ? op.termica_contexto : null;
  const atual = situacaoMensal(t.ultimo_mes_completo, g.gerado_em, NOME_CONJUNTO);
  const exp = (id: Parameters<typeof explicacaoDoMotivo>[1]) => {
    const e = explicacaoDoMotivo(t.motivos, id);
    return e ? ` (${e})` : "";
  };
  const semNuc = inflexibilidadeSemNuclear(t.ultimos_12m);
  const versao = t.ultimo_mes_completo;
  const u = t.ultimos_12m;
  const periodo12 = tx(`${mesAno(u.inicio)} a ${mesAno(u.fim)}`, `${mesAno(u.inicio)} to ${mesAno(u.fim)}`);
  const { cvu: cvuDados, universo, identidade, mapa_combustivel: mapa, ...cliente } = t;
  const termicaCliente: TermicaCliente = cliente;
  const cvuMensal = cvuDados ? linhasCvuMensal(cvuDados, combustiveisCvu(cvuDados)) : [];
  const sin12 = g.matriz.janelas.SIN["12m"];
  const somaMatriz = somaTermicaDaMatriz(sin12);
  const anomalos = diasDoBalancoForaDoPadrao(g.matriz.reconciliacao_balanco);
  const crescimento = notaCrescimentoUniverso(universo);
  const linkMatriz = (
    <Link href={`${rotaPainel("p021")}#composicao`} className="text-energia-dark underline underline-offset-4">
      {tx("matriz efetiva", "effective mix")}
    </Link>
  );
  const notasUniverso = (
    <ul className="space-y-1 text-xs leading-relaxed text-carvao-muted" data-notas-universo="p022">
      <li>{notaNaoClassificado(u)}</li>
      <li>
        {tx(
          "Combustível: até 2025 vem do CEG da usina em outros conjuntos do ONS; desde 2026, do campo do próprio conjunto de térmica por motivo, e os 12 meses misturam os dois métodos.",
          "Fuel: up to 2025 it comes from the plant's CEG in other ONS datasets; since 2026, from the field of the thermal by dispatch reason dataset itself, and the 12 months mix the two methods.",
        )}
      </li>
      {crescimento && <li>{crescimento}</li>}
      {sin12 && somaMatriz !== null && u.total_mwmed !== null && (
        <li>
          {tx(
            <>
              Este total, {num(u.total_mwmed, 0)} MWmed, não é o da {linkMatriz}
              : aqui são as térmicas despachadas pelo ONS, com a nuclear, nos 12 meses completos de {periodo12}; lá, as categorias térmicas da Geração por Usina, sem as térmicas Tipo III, em 365 dias de {dataBR(sin12.inicio)} a {dataBR(sin12.fim)}, {num(somaMatriz, 0)} MWmed.
            </>,
            <>
              This total, {num(u.total_mwmed, 0)} MWavg, is not that of the {linkMatriz}
              : here it is the thermal plants dispatched by the ONS, including nuclear, over the 12 complete months of {periodo12}; there, the thermal categories of the ONS generation by plant dataset, without the Type III thermal plants, over 365 days from {dataBR(sin12.inicio)} to {dataBR(sin12.fim)}, {num(somaMatriz, 0)} MWavg.
            </>,
          )}
        </li>
      )}
    </ul>
  );
  const serie7d = ctx && integra(op) && op.serie_termica_7d?.length ? op.serie_termica_7d.map((p) => ({ ...p, mediana: ctx.mediana_365d, p10: ctx.p10_365d, p90: ctx.p90_365d })) : [];

  const mudanca = textoMudancaMensal({
    nome: tx("a geração das térmicas despachadas", "the generation of dispatched thermal plants"),
    unidade: UNIDADE,
    casas: 0,
    meses: t.mensal_sin.meses,
    valores: t.mensal_sin.total_mwmed,
    mes: t.ultimo_mes_completo,
  });
  const oQueMudou = (
    <>
      {mudanca} {textoSemComparacaoMensal(t.ultimo_mes_completo, g.gerado_em, NOME_CONJUNTO)}
    </>
  );
  const comoInterpretar = tx(
    <>
      A geração verificada de cada usina é dividida pelos motivos que o ONS publica, sem dupla contagem: a inflexibilidade embutida na ordem de mérito conta como inflexibilidade, e o mérito conta só
      acima dela. A soma dos motivos fecha com a geração verificada a menos de uma parcela não classificada, publicada com sinal. Combustível é outra dimensão: as barras empilham os motivos dentro de
      cada combustível.
      {semNuc && (
        <>
          {" "}
          A nuclear é {num(semNuc.nuclearInflexivelPct, 1)}% inflexível e responde por {num(semNuc.nuclearNaInflexibilidadePct, 1)}% de toda a inflexibilidade; sem ela, a inflexibilidade é{" "}
          {num(semNuc.semNuclearPct, 1)}% da geração térmica.
        </>
      )}
    </>,
    <>
      The verified generation of each plant is split by the reasons the ONS publishes, without double counting: the inflexibility embedded in the merit order counts as inflexibility, and merit counts only
      above it. The sum of the reasons matches verified generation except for an unclassified portion, published with its sign. Fuel is another dimension: the bars stack the reasons within
      each fuel.
      {semNuc && (
        <>
          {" "}
          Nuclear is {num(semNuc.nuclearInflexivelPct, 1)}% inflexible and accounts for {num(semNuc.nuclearNaInflexibilidadePct, 1)}% of all inflexibility; without it, inflexibility is{" "}
          {num(semNuc.semNuclearPct, 1)}% of thermal generation.
        </>
      )}
    </>,
  );
  const naoConcluir = tx(
    <>
      O motivo é a classificação do ONS; não é inferido do PLD nem do CMO, e o CVU é custo declarado para a programação, não custo realizado. A participação das térmicas não diz se o despacho foi
      caro ou barato para o consumidor. Usinas com o mesmo número de CEG só são tratadas como a mesma usina quando o ONS publica um elo entre elas; nunca por semelhança de nome.
    </>,
    <>
      The reason is the ONS classification; it is not inferred from the PLD or the CMO, and the CVU is a cost declared for scheduling, not a realized cost. The thermal share does not say whether dispatch was
      expensive or cheap for the consumer. Plants with the same CEG number are only treated as the same plant when the ONS publishes a link between them; never by name similarity.
    </>,
  );
  const origens = Object.entries(mapa.por_origem)
    .map(([k, n]) => `${ROTULO_ORIGEM_COMBUSTIVEL[k] ?? k} ${num(n, 0)}`)
    .join("; ");
  const naoIdentificadas = mapa.nao_identificadas.map((x) => x.nome ?? x.id).join(", ");
  const variasChaves = identidade.usinas_com_mais_de_uma_chave.map((x) => `${x.nome ?? x.usina} (${x.chaves.join(", ")})`).join("; ");
  // em inglês, as mesmas listas com cada nome de usina marcado como nome próprio
  const naoIdentificadasNo = nomesNo(mapa.nao_identificadas.map((x) => x.nome ?? x.id), idioma);
  const variasChavesEn = identidade.usinas_com_mais_de_uma_chave.map((x, i) => (
    <span key={`${x.usina}-${i}`}>
      {i > 0 ? "; " : ""}
      {nomeNo(x.nome ?? x.usina, idioma)} ({x.chaves.join(", ")})
    </span>
  ));

  return (
    <>
      <header><CabecalhoPlataforma colecao="energia" destinoConta="/setor-eletrico" navegacao="setor-eletrico" idiomas /></header>
      <MarcaVisita secao="energia:geracao" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <GeracaoNavegacao atual="p022" />
        <CabecalhoModulo
          siglas={["MWmed", "SIN", "CEG", "PLD", "CMO", "ONS"]}
          rotulo={tx("Geração", "Generation")}
          titulo={perguntaPainel("p022")}
          lead={tx(
            "A geração das térmicas despachadas pelo ONS, separada por combustível e por motivo de despacho, e o custo variável declarado para a semana operativa.",
            "The generation of thermal plants dispatched by the ONS, split by fuel and by dispatch reason, and the variable cost declared for the operating week.",
          )}
          recorte={tx(`${periodo12} (12 meses completos) · térmicas despachadas pelo ONS · GWh, MWmed e %`, `${periodo12} (12 complete months) · thermal plants dispatched by the ONS · GWh, MWavg and %`)}
          fonte={FONTE}
          referencia={tx(
            <>
              {FONTE}, até {mesAno(t.ultimo_mes_completo)} (último mês completo); {FONTE_CVU}, semana vigente; processado em {carimbo(g.gerado_em)}.
            </>,
            <>
              {FONTE}, up to {mesAno(t.ultimo_mes_completo)} (latest complete month); {FONTE_CVU}, current week; processed on {carimbo(g.gerado_em)}.
            </>,
          )}
          datas={
            <GeracaoDatas
              itens={[
                {
                  rotulo: tx("Térmica por motivo e combustível", "Thermal by reason and fuel"),
                  texto: tx(`até ${mesAno(t.ultimo_mes_completo)} (último mês completo)`, `up to ${mesAno(t.ultimo_mes_completo)} (latest complete month)`),
                  natureza: "CALCULADO",
                },
                ...(cvuDados
                  ? [
                      {
                        rotulo: tx("CVU declarado", "Declared CVU"),
                        texto: tx(
                          `semana de ${dataBR(cvuDados.semana.inicio)} a ${cvuDados.semana.fim ? dataBR(cvuDados.semana.fim) : "data não informada"}`,
                          `week from ${dataBR(cvuDados.semana.inicio)} to ${cvuDados.semana.fim ? dataBR(cvuDados.semana.fim) : "an unreported date"}`,
                        ),
                        natureza: "OBSERVADO" as const,
                      },
                    ]
                  : []),
                ...(ctx && integra(op)
                  ? [
                      {
                        rotulo: tx("Participação térmica de 7 dias (Balanço de Energia)", "7-day thermal share (ONS energy balance)"),
                        texto: tx(`até ${dataBR(op.dia_referencia)}`, `up to ${dataBR(op.dia_referencia)}`),
                        natureza: "CALCULADO" as const,
                      },
                    ]
                  : []),
              ]}
            />
          }
          metricas={
            <FaixaMetricas
              colunas={semNuc ? 3 : 2}
              rotulo={tx("Indicadores da geração térmica, 12 meses completos", "Thermal generation indicators, 12 complete months")}
              nota={tx(
                `Inflexibilidade: geração declarada pelo agente ou acima do despachado, inclusive a embutida na ordem de mérito.${semNuc ? " A nuclear é quase toda inflexível; a terceira medida a exclui." : ""}`,
                `Inflexibility: generation declared by the agent or above the dispatched amount, including that embedded in the merit order.${semNuc ? " Nuclear is almost entirely inflexible; the third measure excludes it." : ""}`,
              )}
            >
              <Numero
                variante="faixa"
                rotulo={tx("Geração das térmicas despachadas pelo ONS, inclusive a nuclear", "Generation of thermal plants dispatched by the ONS, including nuclear")}
                natureza="CALCULADO"
                evidencia={ev.termica_12m_total}
                casas={0}
                periodo={periodo12}
                cor="var(--serie-termica)"
                endereco={`${rotaPainel("p022")}#p022`}
              />
              <Numero
                variante="faixa"
                rotulo={tx("Parcela por inflexibilidade", "Share due to inflexibility")}
                natureza="CALCULADO"
                evidencia={ev.termica_12m_inflexibilidade}
                formato="pct"
                casas={1}
                unidade={tx("da geração térmica verificada", "of verified thermal generation")}
                periodo={periodo12}
                cor="var(--serie-sm-se)"
                endereco={`${rotaPainel("p022")}#p022`}
              />
              {semNuc && (
                <Numero
                  variante="faixa"
                  rotulo={tx("Inflexibilidade sem a nuclear", "Inflexibility without nuclear")}
                  natureza="CALCULADO"
                  valor={semNuc.semNuclearPct}
                  formato="pct"
                  casas={1}
                  unidade={tx("da geração térmica sem a nuclear", "of thermal generation without nuclear")}
                  periodo={periodo12}
                  cor="var(--serie-sm-se)"
                />
              )}
            </FaixaMetricas>
          }
        >
          {tx(
            <>
              O ONS publica, para cada usina térmica e cada hora, quanto foi gerado e por qual motivo: ordem de mérito, inflexibilidade{exp("inflexibilidade")}, razão elétrica{exp("razao_eletrica")}, unit commitment{exp("unit_commitment")},
              exportação e outros. Este painel separa a geração por combustível e por motivo, sem inferir o motivo do preço, e mostra o{" "}
              <Termo slug="cvu">Custo Variável Unitário</Termo> declarado para a semana operativa vigente.
            </>,
            <>
              For each thermal plant and each hour, the ONS publishes how much was generated and for which reason: merit order, inflexibility{exp("inflexibilidade")}, electrical reason{exp("razao_eletrica")}, unit commitment{exp("unit_commitment")},
              export and others. This panel splits generation by fuel and by reason, without inferring the reason from the price, and shows the{" "}
              <Termo slug="cvu">Unit Variable Cost (CVU)</Termo> declared for the current operating week.
            </>,
          )}
        </CabecalhoModulo>
        <ModoProfundidade>
          <Bloco id="despacho">
            <PainelEvidencia
              id="p022"
              pergunta={tx("Geração térmica por combustível e motivo de despacho", "Thermal generation by fuel and dispatch reason")}
              subtitulo={tx("Geração térmica por combustível e motivo de despacho · GWh, MWmed e %", "Thermal generation by fuel and dispatch reason · GWh, MWavg and %")}
              natureza="CALCULADO"
              porQueImporta={tx(
                <>
                  Térmica gerando por inflexibilidade é diferente de térmica gerando por ser a opção de menor custo (ordem de mérito) ou por necessidade da rede (razão
                  elétrica). O motivo muda a leitura do custo da operação e do uso da água nos reservatórios.
                </>,
                <>
                  A thermal plant generating due to inflexibility is different from one generating because it is the lowest-cost option (merit order) or because the grid needs it (electrical
                  reason). The reason changes how the cost of operation and the use of water in the reservoirs are read.
                </>,
              )}
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={g.proveniencia.termica!}
              complementares={[
                ...(g.proveniencia.cvu ? [{ rotulo: tx("CVU da semana operativa", "CVU for the operating week"), p: g.proveniencia.cvu }] : []),
                ...(integra(op) && op.proveniencia.termica_7d ? [{ rotulo: tx("Participação térmica de 7 dias (Balanço)", "7-day thermal share (energy balance)"), p: op.proveniencia.termica_7d }] : []),
              ]}
            >
              <div className="space-y-6">
                {atual.defasada && <GeracaoAviso tipo="alerta">{atual.texto}</GeracaoAviso>}
                <GeracaoTermica
                  termica={termicaCliente}
                  fonte={FONTE}
                  versao={versao}
                  notas={<NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />}
                  notasUniverso={notasUniverso}
                  contextoSemana={
                    <SecaoDoPainel
                      id="termica"
                      titulo={
                        ctx && integra(op)
                          ? tx(`A participação térmica nos 7 dias até ${dataBR(op.dia_referencia)}, em contexto`, `The thermal share in the 7 days up to ${dataBR(op.dia_referencia)}, in context`)
                          : tx("A participação térmica de 7 dias, em contexto", "The 7-day thermal share, in context")
                      }
                    >
                      {ctx && integra(op) ? (
                        <>
                          <p className="text-sm leading-relaxed text-carvao">{textoTermica7d(ctx)}</p>
                          <p className="text-sm text-carvao-muted">
                            {tx(
                              <>
                                Base diferente da do motivo de despacho: o Balanço de Energia do ONS, até {dataBR(op.dia_referencia)}, com a nuclear entre as térmicas e sem separar
                                combustível. O percentil compara a semana com as {num(ctx.n_janelas, 0)} janelas de 7 dias do ano anterior e vai de 0 (entre as menores participações) a 100 (entre as maiores); a faixa usual é do 10º ao 90º percentil dessas janelas, que reúnem todas as estações do ano, não só esta época.
                              </>,
                              <>
                                A different base from the dispatch reason: the ONS energy balance, up to {dataBR(op.dia_referencia)}, with nuclear among the thermal plants and without separating
                                fuel. The percentile compares the week with the {num(ctx.n_janelas, 0)} 7-day windows of the previous year and goes from 0 (among the lowest shares) to 100 (among the highest); the usual range is the 10th to 90th percentile of those windows, which cover every season of the year, not only this time of year.
                              </>,
                            )}
                            {anomalos.length > 0 && <> {textoDiasDoBalancoForaDoPadrao(anomalos)}</>}
                          </p>
                          {serie7d.length > 0 && (
                            <GraficoLinhas
                              titulo={tx(
                                "Participação térmica em janelas móveis de 7 dias, último ano, com a mediana e a faixa usual do ano anterior",
                                "Thermal share in 7-day rolling windows, last year, with the median and the usual range of the previous year",
                              )}
                              dados={serie7d}
                              chaveX="d"
                              series={[
                                { id: "termica_7d", rotulo: tx("Térmica, 7 dias", "Thermal, 7 days"), cor: "var(--serie-termica)", espessura: 2.5 },
                                { id: "mediana", rotulo: tx("Mediana do ano anterior", "Median of the previous year"), sigla: tx("Mediana", "Median"), cor: "var(--serie-referencia)", tracejada: true },
                              ]}
                              banda={{ inferior: "p10", superior: "p90", rotulo: tx("10º a 90º percentil", "10th to 90th percentile") }}
                              unidade="%"
                              casas={1}
                            />
                          )}
                        </>
                      ) : (
                        <GeracaoAviso>
                          {tx(
                            <>
                              Os dados de operação da geração (Balanço de Energia) não estão íntegros nesta publicação; a participação térmica de 7 dias não é mostrada até a próxima
                              publicação válida.
                            </>,
                            <>
                              The generation operation data (energy balance) are not complete in this release; the 7-day thermal share is not shown until the next
                              valid release.
                            </>,
                          )}
                        </GeracaoAviso>
                      )}
                    </SecaoDoPainel>
                  }
                />

                {cvuDados && (
                  <SecaoDoPainel nivel="analisar" id="cvu" titulo={tx("Custo Variável Unitário declarado para a semana operativa vigente", "Unit Variable Cost (CVU) declared for the current operating week")}>
                    <p className="text-sm text-carvao-muted">{textoCvu(cvuDados)}</p>
                    <p className="text-sm text-carvao-muted" data-nota="cvu-zero">
                      {notaCvuZero(cvuDados)}
                    </p>
                    <GeracaoTabelaSobDemanda tabela="cvu-combustivel" versao={versao} />
                    <GraficoLinhas
                      chaveUrl="cvu"
                      titulo={tx("Mediana mensal do CVU por combustível", "Monthly median CVU by fuel")}
                      dados={cvuMensal}
                      chaveX="m"
                      formatoX="mes"
                      series={combustiveisCvu(cvuDados).map((c) => ({ id: c, rotulo: CURTO_COMBUSTIVEL[c], cor: COR_COMBUSTIVEL[c] }))}
                      unidade="R$/MWh"
                      casas={0}
                      zeroNoEixo
                      legendaInterativa
                      zoom
                    />
                    <GeracaoTabelaSobDemanda tabela="cvu-mensal" versao={versao} />
                    <GeracaoTabelaSobDemanda tabela="cvu-usinas" versao={versao} />
                  </SecaoDoPainel>
                )}

                <SecaoDoPainel nivel="auditar" id="universo-termica" titulo={tx("Universo: a térmica por motivo contra a Geração por Usina", "Universe: thermal by dispatch reason against the generation by plant dataset")}>
                  <p className="text-sm text-carvao-muted">
                    <TrechoPortugues regiao="geracao-termica-universo-regra">{emPortugues(universo.regra)}</TrechoPortugues>
                  </p>
                  <GeracaoTabelaSobDemanda tabela="universo-termica" versao={versao} />
                  <p className="text-sm text-carvao-muted">
                    {tx(
                      <>
                        Combustível de {num(mapa.usinas, 0)} usinas, pela autoridade publicada: {origens}
                        .{" "}
                        {mapa.nao_identificadas.length
                          ? `Sem combustível identificado: ${naoIdentificadas}, com ${num(mapa.nao_identificadas_mwh_12m, 1)} MWh nos 12 meses (${num(mapa.nao_identificadas_pct_12m, 3)}% da energia térmica).`
                          : "Todas com combustível identificado."}
                      </>,
                      <>
                        Fuel of {num(mapa.usinas, 0)} plants, by the published authority: {origens}
                        .{" "}
                        {mapa.nao_identificadas.length
                          ? <>No identified fuel: {naoIdentificadasNo}, with {num(mapa.nao_identificadas_mwh_12m, 1)} MWh over the 12 months ({num(mapa.nao_identificadas_pct_12m, 3)}% of thermal energy).</>
                          : "All with an identified fuel."}
                      </>,
                    )}
                  </p>
                  <p className="text-sm text-carvao-muted">
                    <TrechoPortugues regiao="geracao-termica-identidade-regra">{emPortugues(identidade.regra)}</TrechoPortugues>{" "}
                    {identidade.usinas_com_mais_de_uma_chave.length
                      ? tx(<>{`Usinas com mais de uma chave na fonte: ${variasChaves}.`}</>, <>Plants with more than one key in the source: {variasChavesEn}.</>)
                      : ""}
                  </p>
                  <p className="text-sm text-carvao-muted">
                    {tx(
                      <>Células negativas na fonte (motivos ou total), mantidas como publicadas e contadas: {num(t.controles.valores_negativos_na_fonte, 0)}.</>,
                      <>Negative cells in the source (reasons or total), kept as published and counted: {num(t.controles.valores_negativos_na_fonte, 0)}.</>,
                    )}
                  </p>
                </SecaoDoPainel>

                <SecaoDoPainel nivel="auditar" id="regras-termica" titulo={tx("Regras e limitações", "Rules and limitations")}>
                  <GeracaoRegras regras={[{ rotulo: ROTULO_REGRA.termica, texto: g.regras.termica }, { rotulo: ROTULO_REGRA.janelas, texto: g.regras.janelas }]} />
                  <GeracaoFrases itens={[...(g.proveniencia.termica?.limitacoes ?? []), ...(g.proveniencia.cvu?.limitacoes ?? [])]} daFonte />
                  <div className="space-y-2" data-dicionario-de-campos="motivos">
                    <p className="rotulo text-mineral">{tx("Dicionário: a coluna do arquivo do ONS que traz cada motivo", "Dictionary: the column of the ONS file that carries each reason")}</p>
                    <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                      {t.motivos.map((mo) => (
                        <div key={mo.id} className="contents">
                          <dt className="text-carvao">{rotuloGoldNo(mo.rotulo, idioma, "geracao-motivo-rotulo")}</dt>
                          <dd className="font-mono text-xs text-carvao-muted [overflow-wrap:anywhere]">{mo.campo}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </SecaoDoPainel>

                <GeracaoSeguir ancora="p022" proximo={painelPublicado("p023") ? { href: `${rotaPainel("p023")}#p023`, pergunta: perguntaPainel("p023") } : null} downloads={downloadsDoPainel(g.downloads, "p022")} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
