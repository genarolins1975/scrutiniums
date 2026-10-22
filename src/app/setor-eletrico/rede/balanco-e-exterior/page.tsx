import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { Numero } from "@/components/energia/Numero";
import { RedeBalanco } from "@/components/energia/RedeBalanco";
import { RedeContaRegiao } from "@/components/energia/RedeContaRegiao";
import { ParaLer } from "@/components/energia/Didatica";
import { RedeAviso, RedeCapitulos, RedeDatas, RedeDicionarios, RedeIndisponivel, RedeNavegacao, RedeRegras, RedeSeguir } from "@/components/energia/RedePagina";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, horaLocal, mesAno, num } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import { tx } from "@/lib/energia/idioma";
import {
  colunasCobertura,
  colunasIdentidades,
  datasLegiveis,
  frasesA05,
  linhasCobertura,
  linhasIdentidades,
  paraTabela,
  perguntaPainel,
  provenienciaLegivel,
  rotaPainel,
  rotulosRegra,
  semCaminhosInternos,
  situacaoAtualidade,
  textoCobertura,
  textoConferenciaSilver,
  textoIdentidadesItaipu,
  textoMudancaBalanco,
} from "@/lib/energia/rede";
import type { ConferenciaDegrauMmgd, GoldRedeDetalhe } from "@/lib/energia/tipos-rede";

export const dynamic = "force-static";
/** Descrição com a data da quebra lida da gold (nenhuma data escrita à mão). */
function metadadosDaPagina(): Metadata {
  const g = lerGold<GoldRedeDetalhe>("rede_detalhe.json");
  const q = integra(g) ? g.balanco.quebras.find((x) => x.id === "mmgd_2023") : undefined;
  return {
    title: tx("Rede: balanço de energia, resíduos e intercâmbio com outros países", "Grid: energy balance, residuals and interchange with other countries"),
    description: tx(
      `Identidades do balanço de energia do ONS conferidas hora a hora (geração, carga, intercâmbio, fronteiras e exterior), resíduos sinalizados sem causa atribuída,${q ? ` quebra da MMGD estimada em ${dataBR(q.dia)},` : ""} exportação e importação com Argentina, Uruguai e Paraguai e geração de Itaipu.`,
      `ONS energy balance identities checked hour by hour (generation, load, interchange, boundaries and exterior), residuals flagged with no cause attributed,${q ? ` the estimated MMGD break on ${dataBR(q.dia)},` : ""} exports and imports with Argentina, Uruguay and Paraguay and Itaipu generation.`,
    ),
    alternates: { canonical: "/setor-eletrico/rede/balanco-e-exterior" },
  };
}

export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/rede/balanco-e-exterior", metadadosDaPagina(), anterior);
}

const fonteBalanco = () =>
  tx(
    "ONS, Balanço de Energia nos Subsistemas e intercâmbios (releitura do módulo Rede)",
    "ONS, Energy Balance in the Subsystems and interchanges (Grid module re-read)",
  );

function conferido(x: ConferenciaDegrauMmgd | { erro: string } | null): x is ConferenciaDegrauMmgd {
  return !!x && !("erro" in x);
}

export default function RedeBalancoPage() {
  const g = lerGold<GoldRedeDetalhe>("rede_detalhe.json");
  if (!integra(g)) return <RedeIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;
  const FONTE = fonteBalanco();
  const ROTULO_REGRA = rotulosRegra();
  const b = g.balanco;
  const a = g.achados.A05;
  const ev = g.evidencias;
  const atual = situacaoAtualidade(g.referencia.dia, g.gerado_em);
  const versao = g.referencia.dia;
  const periodo = { inicio: g.cobertura.inicio, fim: g.cobertura.fim };
  const downloads = g.downloads.filter((d) => /balanco|exterior/.test(d.url));
  const q = b.quebras[0];
  const dic = g.achados.dicionarios;
  // horas conferidas de cada conta da faixa: o denominador das contagens de resíduo, lido das mesmas identidades da tabela
  const horasDa = (id: string) => b.identidades.find((x) => x.id === id)?.horas ?? null;
  const horasSin = horasDa("balanco.SIN");
  const horasSul = horasDa("perimetro.S");
  const idSin = b.identidades.find((x) => x.id === "balanco.SIN") ?? null;
  const anosResiduoSin = idSin ? Object.keys(idSin.horas_residuo_por_ano ?? {}).sort() : [];
  const ultimaHoraExterior = (["ARGENTINA", "URUGUAI", "PARAGUAI"] as const)
    .map((p) => g.exterior.por_pais[p]?.ultima_hora)
    .filter((h): h is string => !!h)
    .sort()
    .at(-1);
  const mesesExterior = g.exterior.resumo_12m.ARGENTINA?.meses ?? null;
  const periodoTexto = tx(`${dataBR(periodo.inicio)} a ${dataBR(periodo.fim)}`, `${dataBR(periodo.inicio)} to ${dataBR(periodo.fim)}`);
  const fonteExterior = tx("ONS, Intercâmbio do SIN com Outros Países", "ONS, SIN Interchange with Other Countries");
  const oQueMudou = (
    <>
      {atual.texto} {textoMudancaBalanco(b)}
      <span data-nivel="analisar">
        {" "}
        {tx("Estado da verificação do balanço", "Status of the balance check")}: <TrechoPortugues regiao="estado do achado A05">{a.status}</TrechoPortugues>.
      </span>
    </>
  );
  const comoInterpretar = (
    <>
      <TrechoPortugues regiao="perímetro do achado A05">{a.perimetro}</TrechoPortugues> <TrechoPortugues regiao="sinais do achado A05">{a.sinais}</TrechoPortugues>{" "}
      {tx(
        <>
          Uma conta fecha numa hora quando a diferença fica em até {num(b.tolerancia_mwmed, 1)} MWmed. Desde {dataBR(q?.dia)} a geração solar e a carga do
          balanço incluem a MMGD estimada pelo ONS, sem a parcela separada.
        </>,
        <>
          An account closes in an hour when the difference stays within {num(b.tolerancia_mwmed, 1)} MWavg. Since {dataBR(q?.dia)} the solar generation and the load of the
          balance include the MMGD estimated by ONS, without the share separated.
        </>,
      )}
    </>
  );
  const naoConcluir = tx(
    <>
      A causa dos resíduos: a fonte não a informa, e nenhuma das contas tem termo de perdas. Também não se separa, no balanço, o que é medição do que é estimativa da MMGD desde{" "}
      {dataBR(q?.dia)}, nem se comparam geração e carga mensais dos dois lados dessa data.
    </>,
    <>
      The cause of the residuals: the source does not state it, and none of the accounts has a losses term. Nor does the balance separate what is measurement from what is the
      MMGD estimate since {dataBR(q?.dia)}, nor are monthly generation and load compared on the two sides of that date.
    </>,
  );

  return (
    <>
      <header><CabecalhoPlataforma colecao="energia" destinoConta="/setor-eletrico" navegacao="setor-eletrico" idiomas /></header>
      <MarcaVisita secao="energia:rede" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          siglas={["MWmed", "SIN", "ONS", "CCEE", "MMGD"]}
          rotulo={tx("Rede · Balanço e exterior", "Grid · Balance and exterior")}
          titulo={perguntaPainel("p029")}
          lead={
            idSin && horasSin
              ? tx(
                  `Quase sempre. No SIN, geração menos carga bateu com o intercâmbio em ${num(horasSin - idSin.horas_residuo, 0)} de ${num(horasSin, 0)} horas conferidas, de ${periodoTexto}${anosResiduoSin.length ? `; as ${num(idSin.horas_residuo, 0)} horas que não fecham estão em ${anosResiduoSin.join(", ")}` : ""}, e a fonte não informa o motivo. Resíduo é a diferença que sobra quando a conta não fecha.`,
                  `Almost always. In the SIN, generation minus load matched the interchange in ${num(horasSin - idSin.horas_residuo, 0)} of ${num(horasSin, 0)} hours checked, from ${periodoTexto}${anosResiduoSin.length ? `; the ${num(idSin.horas_residuo, 0)} hours that do not close are in ${anosResiduoSin.join(", ")}` : ""}, and the source does not state why. A residual is the difference left over when the account does not close.`,
                )
              : tx(
                  "Em cada região, geração menos carga deve igualar o intercâmbio, e o intercâmbio, os fluxos das fronteiras e do exterior. Resíduo é a diferença que sobra quando a conta não fecha.",
                  "In each region, generation minus load should equal the interchange, and the interchange should equal the flows of the boundaries and the exterior. A residual is the difference left over when the account does not close.",
                )
          }
          recorte={tx(`${periodoTexto}, hora a hora · SIN e subsistemas · horas e MWh`, `${periodoTexto}, hour by hour · SIN and subsystems · hours and MWh`)}
          fonte={tx("ONS, Balanço de Energia nos Subsistemas, intercâmbios e Itaipu", "ONS, Energy Balance in the Subsystems, interchanges and Itaipu")}
          referencia={tx(
            <>
              ONS, balanço de energia, intercâmbios e Itaipu, de {dataBR(periodo.inicio)} a {dataBR(periodo.fim)}; processado em {carimbo(g.gerado_em)}.
            </>,
            <>
              ONS, energy balance, interchanges and Itaipu, from {dataBR(periodo.inicio)} to {dataBR(periodo.fim)}; processed on {carimbo(g.gerado_em)}.
            </>,
          )}
          datas={
            <RedeDatas
              itens={[
                { rotulo: tx("Balanço de energia", "Energy balance"), texto: tx(`até ${dataBR(periodo.fim)}`, `through ${dataBR(periodo.fim)}`), natureza: g.proveniencia.balanco.natureza },
                {
                  rotulo: tx("Intercâmbio com outros países", "Interchange with other countries"),
                  texto: ultimaHoraExterior ? tx(`até ${horaLocal(ultimaHoraExterior)}`, `through ${horaLocal(ultimaHoraExterior)}`) : null,
                  natureza: g.proveniencia.exterior.natureza,
                },
              ]}
            />
          }
          metricas={
            <FaixaMetricas
              colunas={3}
              rotulo={tx("Horas com resíduo no SIN e no Sul, e saldo do intercâmbio internacional", "Hours with a residual in the SIN and the South, and international interchange net flow")}
              nota={tx(
                "Valores do SIN e do Sul e do intercâmbio internacional, fixos: a região escolhida abaixo muda só a resposta, as barras e a série mensal. Resíduo não tem causa atribuída pela fonte.",
                "Values for the SIN, the South and the international interchange, fixed: the region chosen below only changes the answer, the bars and the monthly series. The source attributes no cause to a residual.",
              )}
            >
              <Numero
                variante="faixa"
                rotulo={tx("Horas em que geração menos carga não fecha com o intercâmbio, SIN", "Hours in which generation minus load does not close with the interchange, SIN")}
                natureza="CALCULADO"
                evidencia={ev.a05_balanco_sin ?? null}
                casas={0}
                periodo={periodoTexto}
                cor="var(--cor-energia)"
                nota={
                  horasSin !== null
                    ? tx(`De ${num(horasSin, 0)} horas conferidas. Causa não informada pela fonte.`, `Out of ${num(horasSin, 0)} hours checked. Cause not stated by the source.`)
                    : tx("Causa não informada pela fonte.", "Cause not stated by the source.")
                }
                endereco={`${rotaPainel("p029")}#p029`}
              />
              <Numero
                variante="faixa"
                rotulo={tx("Horas em que o intercâmbio do Sul não fecha com fronteira e exterior", "Hours in which the South interchange does not close with boundary and exterior")}
                natureza="CALCULADO"
                evidencia={ev.a05_perimetro_sul ?? null}
                casas={0}
                periodo={periodoTexto}
                cor="var(--serie-sm-s)"
                nota={tx(
                  `Intercâmbio do Sul no balanço contra a fronteira com o Sudeste/Centro-Oeste somada a Argentina e Uruguai${horasSul !== null ? `; de ${num(horasSul, 0)} horas conferidas` : ""}.`,
                  `South interchange in the balance against the boundary with the Southeast/Center-West plus Argentina and Uruguay${horasSul !== null ? `; out of ${num(horasSul, 0)} hours checked` : ""}.`,
                )}
                endereco={`${rotaPainel("p029")}#p029`}
              />
              <Numero
                variante="faixa"
                rotulo={tx("Saldo do intercâmbio internacional em 12 meses (positivo = exportação)", "International interchange net flow over 12 months (positive = export)")}
                natureza="CALCULADO"
                evidencia={ev.exterior_12m ?? null}
                casas={0}
                periodo={mesesExterior ? tx(`${mesAno(mesesExterior[0])} a ${mesAno(mesesExterior[1])}`, `${mesAno(mesesExterior[0])} to ${mesAno(mesesExterior[1])}`) : undefined}
                cor="var(--serie-5)"
                nota={tx("Soma de Argentina e Uruguai; o Paraguai não tem hora publicada no período.", "Sum of Argentina and Uruguay; Paraguay has no hour published in the period.")}
                endereco={`${rotaPainel("p029")}#p029`}
              />
            </FaixaMetricas>
          }
        >
          {tx(
            <>
              O ONS publica, hora a hora, a geração, a carga e o <Termo slug="intercambio">intercâmbio</Termo> de cada região do <Termo slug="sin">SIN</Termo>, e publica à parte o fluxo
              de cada fronteira e o intercâmbio com outros países. Se os números forem consistentes, geração menos carga é igual ao intercâmbio da região, e o intercâmbio da
              região é igual aos fluxos que cruzam as suas fronteiras, com outros países incluídos quando for o caso (o observatório chama esta segunda conta de perímetro).
              O painel faz as duas contas hora a hora e mostra em que horas sobra uma diferença maior que {num(b.tolerancia_mwmed, 1)} MWmed, o resíduo, sem atribuí-lo a perdas
              nem a outra causa.
            </>,
            <>
              ONS publishes, hour by hour, the generation, the load and the <Termo slug="intercambio">interchange</Termo> of each region of the <Termo slug="sin">SIN</Termo>, and
              publishes separately the flow of each boundary and the interchange with other countries. If the numbers are consistent, generation minus load equals the
              interchange of the region, and the interchange of the region equals the flows that cross its boundaries, with other countries included where applicable (the
              observatory calls this second account the perimeter). The panel does both accounts hour by hour and shows in which hours a difference greater than{" "}
              {num(b.tolerancia_mwmed, 1)} MWavg is left over, the residual, without attributing it to losses or to any other cause.
            </>,
          )}
        </CabecalhoModulo>
        <RedeNavegacao atual="p029" />
        <ParaLer
          id="para-ler-balanco"
          itens={[
            {
              termo: tx("Balanço de energia", "Energy balance"),
              definicao: tx(
                "A conta que o ONS publica para cada região, hora a hora: quanto as usinas geraram, quanto foi consumido (a carga) e quanto entrou ou saiu pelas linhas (o intercâmbio).",
                "The account ONS publishes for each region, hour by hour: how much the plants generated, how much was consumed (the load) and how much came in or went out over the lines (the interchange).",
              ),
            },
            {
              termo: tx("Conta 1: balanço interno", "Account 1: internal balance"),
              definicao: tx(
                "Geração menos carga menos intercâmbio, no mesmo arquivo do ONS. Se a região gerou mais do que consumiu, a sobra tem de ter saído pelas linhas.",
                "Generation minus load minus interchange, in the same ONS file. If the region generated more than it consumed, the surplus must have left over the lines.",
              ),
            },
            {
              termo: tx("Conta 2: perímetro", "Account 2: perimeter"),
              definicao: tx(
                "O intercâmbio do balanço contra o que o ONS publica, em outro arquivo, para cada fronteira e para os países vizinhos. É conferir a mesma energia por dois caminhos.",
                "The balance interchange against what ONS publishes, in another file, for each boundary and for the neighboring countries. It checks the same energy along two paths.",
              ),
            },
            {
              termo: tx("Resíduo e tolerância", "Residual and tolerance"),
              definicao: tx(
                `Resíduo é o que sobra quando uma conta não fecha. Numa hora, a página só conta resíduo acima de ${num(b.tolerancia_mwmed, 1)} MWmed, porque os arquivos arredondam cada parcela; abaixo disso, a conta fecha.`,
                `A residual is what is left when an account does not close. In an hour, the page only counts a residual above ${num(b.tolerancia_mwmed, 1)} MWavg, because the files round each part; below that, the account closes.`,
              ),
            },
            {
              termo: tx("Exterior", "Exterior"),
              definicao: tx(
                "A energia trocada com Argentina, Uruguai e Paraguai. Positivo é exportação. Hora sem dado publicado fica como ausência, nunca como zero.",
                "The energy exchanged with Argentina, Uruguay and Paraguay. Positive is export. An hour without published data stays as missing, never as zero.",
              ),
            },
            {
              termo: tx("MWmed numa hora e MWh", "MWavg in an hour and MWh"),
              definicao: tx(
                "Cada valor horário vem em MWmed; durante uma hora, 1 MWmed entrega 1 MWh. As somas do mês, no gráfico de resíduo e no exemplo abaixo, estão em MWh.",
                "Each hourly value comes in MWavg; over one hour, 1 MWavg delivers 1 MWh. The month's sums, in the residual chart and in the example below, are in MWh.",
              ),
            },
          ]}
        />
        <ModoProfundidade>
          <Bloco id="balanco">
            <PainelEvidencia
              id="p029"
              pergunta={tx("As contas do balanço, conferidas hora a hora", "The balance accounts, checked hour by hour")}
              subtitulo={tx(
                "Contas do balanço conferidas hora a hora, resíduos e intercâmbio internacional · horas e MWh",
                "Balance accounts checked hour by hour, residuals and international interchange · hours and MWh",
              )}
              natureza="CALCULADO"
              porQueImporta={tx(
                <>
                  Se o intercâmbio de uma região não fecha com as fronteiras, ou geração menos carga não fecha com o intercâmbio, comparações entre regiões e com o SIN herdam a
                  diferença. Saber onde e quando isso acontece evita atribuir a perdas ou ao exterior o que a fonte não explica.
                </>,
                <>
                  If the interchange of a region does not close with the boundaries, or generation minus load does not close with the interchange, comparisons between regions
                  and with the SIN inherit the difference. Knowing where and when this happens avoids attributing to losses or to the exterior what the source does not explain.
                </>,
              )}
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={provenienciaLegivel(g.proveniencia.balanco)}
              complementares={[{ rotulo: tx("Intercâmbio internacional por país", "International interchange by country"), p: provenienciaLegivel(g.proveniencia.exterior) }]}
            >
              <div className="space-y-6">
                {atual.defasada && <RedeAviso tipo="alerta">{atual.texto}</RedeAviso>}
                <RedeBalanco
                  balanco={{ identidades: b.identidades, mensal: b.mensal, quebras: b.quebras, tolerancia_mwmed: b.tolerancia_mwmed, faixas_mwmed: b.faixas_mwmed }}
                  exterior={{ meses: g.exterior.meses, por_pais: g.exterior.por_pais, resumo_12m: g.exterior.resumo_12m, itaipu: g.exterior.itaipu }}
                  periodo={periodo}
                  fonte={FONTE}
                  versao={versao}
                  notas={<NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />}
                  aposPrincipal={
                    <>
                      <RedeContaRegiao b={b} />
                      <RedeCapitulos atual="p029" />
                    </>
                  }
                />

                <SecaoDoPainel id="a05" nivel="analisar" titulo={tx("O balanço dos intercâmbios, identidade por identidade", "The interchange balance, identity by identity")}>
                  <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-carvao" data-textos="a05">
                    {frasesA05(a).map((t) => (
                      <li key={t}>
                        <TrechoPortugues regiao="achado A05 da rede">{t}</TrechoPortugues>
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm text-carvao-muted">
                    <TrechoPortugues regiao="achado A05 da rede">{datasLegiveis(a.exterior)}</TrechoPortugues>{" "}
                    <TrechoPortugues regiao="achado A05 da rede">{datasLegiveis(a.perdas)}</TrechoPortugues>
                  </p>
                </SecaoDoPainel>

                {q && (
                  <SecaoDoPainel
                    id="quebra-mmgd"
                    nivel="auditar"
                    titulo={tx(`Quebra metodológica de ${dataBR(q.dia)}: MMGD estimada no balanço`, `Methodological break of ${dataBR(q.dia)}: estimated MMGD in the balance`)}
                  >
                    <p className="text-sm text-carvao-muted">
                      <TrechoPortugues regiao="quebra metodológica do balanço">{semCaminhosInternos(q.descricao)}</TrechoPortugues>
                    </p>
                    <p className="text-sm text-carvao-muted [overflow-wrap:anywhere]">
                      {tx("Declaração do ONS", "ONS statement")} (<Nome>{q.declaracao.conjunto}</Nome>,{" "}
                      <a href={q.declaracao.url} className="text-energia-dark underline underline-offset-4">
                        {tx("descrição do conjunto", "dataset description")}
                      </a>
                      {q.declaracao.capturado_em ? tx(`, capturada em ${carimbo(q.declaracao.capturado_em)}`, `, captured on ${carimbo(q.declaracao.capturado_em)}`) : ""}): &ldquo;
                      <TrechoPortugues regiao="declaração do ONS">{q.declaracao.trecho}</TrechoPortugues>&rdquo; (
                      {q.declaracao.confere === true
                        ? tx("conferido literalmente", "checked word for word")
                        : q.declaracao.confere === false
                          ? tx("não encontrado na captura", "not found in the capture")
                          : tx("descrição não capturada", "description not captured")}
                      ).{" "}
                      <TrechoPortugues regiao="observação sobre a declaração do ONS">{q.declaracao.observacao}</TrechoPortugues>
                    </p>
                    {conferido(q.conferencia_arquivo) ? (
                      <p className="text-sm text-carvao-muted">
                        {tx(
                          <>
                            No arquivo {q.conferencia_arquivo.arquivo} (sha256 {q.conferencia_arquivo.sha256.slice(0, 12)}…), a geração solar do SIN às 12h passa de{" "}
                            {num(q.conferencia_arquivo.solar_12h_dia_anterior_mwmed, 3)} MWmed em {dataBR(q.conferencia_arquivo.dia_anterior)} para{" "}
                            {num(q.conferencia_arquivo.solar_12h_dia_mwmed, 3)} MWmed em {dataBR(q.conferencia_arquivo.dia)}; a energia solar do dia, de{" "}
                            {num(q.conferencia_arquivo.solar_mwh_dia_anterior, 0)} para {num(q.conferencia_arquivo.solar_mwh_dia, 0)} MWh. O balanço fecha em{" "}
                            {q.conferencia_arquivo.horas_balanco_fecha_dia_anterior} e {q.conferencia_arquivo.horas_balanco_fecha_dia} das 24 horas dos dois dias. Regra de detecção do degrau: {semCaminhosInternos(q.regra_degrau)}.{" "}
                            {semCaminhosInternos(q.efeito)}
                          </>,
                          <>
                            In the file {q.conferencia_arquivo.arquivo} (sha256 {q.conferencia_arquivo.sha256.slice(0, 12)}…), SIN solar generation at 12:00 goes from{" "}
                            {num(q.conferencia_arquivo.solar_12h_dia_anterior_mwmed, 3)} MWavg on {dataBR(q.conferencia_arquivo.dia_anterior)} to{" "}
                            {num(q.conferencia_arquivo.solar_12h_dia_mwmed, 3)} MWavg on {dataBR(q.conferencia_arquivo.dia)}; the solar energy of the day, from{" "}
                            {num(q.conferencia_arquivo.solar_mwh_dia_anterior, 0)} to {num(q.conferencia_arquivo.solar_mwh_dia, 0)} MWh. The balance closes in{" "}
                            {q.conferencia_arquivo.horas_balanco_fecha_dia_anterior} and {q.conferencia_arquivo.horas_balanco_fecha_dia} of the 24 hours of the two days. Step detection
                            rule: <TrechoPortugues regiao="regra de detecção do degrau">{semCaminhosInternos(q.regra_degrau)}</TrechoPortugues>.{" "}
                            <TrechoPortugues regiao="efeito da quebra">{semCaminhosInternos(q.efeito)}</TrechoPortugues>
                          </>,
                        )}
                      </p>
                    ) : (
                      <p className="text-sm text-carvao-muted">
                        {tx(
                          <>
                            Conferência no arquivo original não executada nesta publicação
                            {q.conferencia_arquivo && "erro" in q.conferencia_arquivo ? ` (${q.conferencia_arquivo.erro})` : ""}. {semCaminhosInternos(q.efeito)}
                          </>,
                          <>
                            Check against the original file not run in this release
                            {q.conferencia_arquivo && "erro" in q.conferencia_arquivo ? ` (${q.conferencia_arquivo.erro})` : ""}.{" "}
                            <TrechoPortugues regiao="efeito da quebra">{semCaminhosInternos(q.efeito)}</TrechoPortugues>
                          </>,
                        )}
                      </p>
                    )}
                  </SecaoDoPainel>
                )}

                <SecaoDoPainel id="identidades" nivel="auditar" titulo={tx("As onze identidades conferidas", "The eleven identities checked")}>
                  <RedeRegras regras={(["balanco", "tolerancia_balanco"] as const).map((k) => ({ rotulo: ROTULO_REGRA[k], texto: g.regras[k] }))} />
                  <TabelaInterativa
                    titulo={tx("Todas as identidades, todas as regiões", "All identities, all regions")}
                    colunas={colunasIdentidades(b)}
                    linhas={paraTabela(linhasIdentidades(b.identidades))}
                    chaveLinha="id"
                    colunaRotulo="identidade"
                    fonte={FONTE}
                    versao={versao}
                    nomeArquivo="rede-identidades"
                    chaveUrl="ids"
                  />
                </SecaoDoPainel>

                <SecaoDoPainel
                  id="cobertura-exterior"
                  nivel="auditar"
                  titulo={tx("Cobertura das fontes e conferência com o outro coletor", "Source coverage and check against the other collector")}
                >
                  <p className="text-sm text-carvao-muted">{textoCobertura(tx("Exterior", "Exterior"), g.cobertura.exterior, g.cobertura)}</p>
                  <TabelaInterativa
                    titulo={tx("Dias sem as 24 horas no intercâmbio internacional", "Days without all 24 hours in the international interchange")}
                    colunas={colunasCobertura()}
                    linhas={paraTabela(linhasCobertura(g.cobertura.exterior))}
                    chaveLinha="id"
                    colunaRotulo="dia" // i18n: dado
                    fonte={fonteExterior}
                    versao={versao}
                    nomeArquivo="rede-cobertura-exterior"
                    chaveUrl="cobx"
                    semLinhas={tx("Todos os dias têm as 24 horas de Argentina e Uruguai.", "Every day has all 24 hours for Argentina and Uruguay.")}
                  />
                  <p className="text-sm text-carvao-muted">{textoCobertura(tx("Balanço", "Balance"), g.cobertura.balanco, g.cobertura)}</p>
                  <p className="text-sm text-carvao-muted">
                    {textoConferenciaSilver(tx("Intercâmbio do balanço", "Balance interchange"), g.conferencia_silver_principal?.ons_rede_balanco)}
                  </p>
                  <p className="text-sm text-carvao-muted">{textoIdentidadesItaipu(g.exterior.itaipu_identidades)}</p>
                </SecaoDoPainel>

                <SecaoDoPainel id="dicionarios" nivel="auditar" titulo={tx("Dicionários de dados do ONS: sinal e definições", "ONS data dictionaries: sign and definitions")}>
                  <RedeDicionarios dicionarios={[dic.ons_rede_balanco, dic.ons_rede_intercambio_internacional, dic.ons_rede_itaipu].filter(Boolean)} />
                </SecaoDoPainel>

                <RedeSeguir ancora="p029" proximo={{ href: `${rotaPainel("p030")}#p030`, pergunta: perguntaPainel("p030") }} downloads={downloads} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
