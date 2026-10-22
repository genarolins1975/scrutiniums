import { semCodigosDePergunta } from "@/lib/energia/bastidor";
import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { Termo } from "@/components/evidencia/Termo";
import { PerdasRegulatorio } from "@/components/energia/PerdasRegulatorio";
import { PerdasAuditoria } from "@/components/energia/PerdasAuditoria";
import { PerdasLevaEscolha } from "@/components/energia/PerdasLevaEscolha";
import { EstadoDaComparacao, PerdasNavegacao, PerdasSeguir, Recorte, ReferenciaPerdas, Resposta, perguntaPerdas, type ItemEstadoComparacao } from "@/components/energia/PerdasPainel";
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { TEXTOS_PERDAS_EN, marcarNomes, traducaoExata, traduzOuMarca } from "@/lib/energia/i18n/qualidade-perdas";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { integra, lerGold } from "@/lib/energia/gold";
import { dataBR, mesAno, num } from "@/lib/energia/formato";
import type { PerdasGold } from "@/lib/energia/tipos-perdas";
import { linhasRegulatorio, perimetroRegulatorio, respostaRegulatorio, rotuloDistribuidora, segmentosPorDistribuidora, vereditoRegulatorio } from "@/lib/energia/perdas";

export const dynamic = "force-static";

export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/perdas/regulatorio", {
    title: tx("Perdas: percentual técnico regulatório por distribuidora", "Losses: regulatory technical percentage by distribution utility"),
    description: tx(
      "Percentual técnico regulatório implícito no SAMP por distribuidora, trecho a trecho, com a resolução homologatória associada, e o bloqueio da comparação com a referência de perdas não técnicas, com evidência.",
      "Implicit regulatory technical percentage in SAMP by distribution utility, segment by segment, with the associated ratification resolution, and the blocked comparison with the non-technical loss reference, with evidence.",
    ),
    alternates: { canonical: "/setor-eletrico/perdas/regulatorio" },
  }, anterior);
}

export default function PerdasRegulatorioPage() {
  const g = lerGold<PerdasGold>("perdas.json");
  const idioma = idiomaEnergia();
  if (!integra(g)) {
    return (
      <>
        <header><CabecalhoPlataforma colecao="energia" destinoConta="/setor-eletrico" navegacao="setor-eletrico" idiomas /></header>
        <main id="conteudo" tabIndex={-1} className="ed-pagina py-14">
          <Indisponivel
            titulo={tx("Perdas indisponíveis", "Losses unavailable")}
            motivo={
              g?.motivo
                ? tx(<>{g.motivo}</>, <TrechoPortugues regiao="perdas-motivo">{g.motivo}</TrechoPortugues>)
                : tx("Os dados processados de perdas não foram gerados nesta publicação.", "The processed loss data were not generated in this release.")
            }
          />
        </main>
      </>
    );
  }

  const rotulos = Object.fromEntries(g.distribuidoras.map((d) => [d.cnpj, rotuloDistribuidora(d)]));
  const ids = g.distribuidoras.map((d) => d.cnpj);
  const versao = tx(
    `SAMP até ${mesAno(g.referencia.ultima_competencia)}, publicado em ${dataBR(g.gerado_em)}`,
    `SAMP up to ${mesAno(g.referencia.ultima_competencia)}, published on ${dataBR(g.gerado_em)}`,
  );
  const regulatorio = linhasRegulatorio(g.distribuidoras);
  const perimetro = perimetroRegulatorio(regulatorio, g.distribuidoras.length);
  const bloqueioRegulatorio = g.bloqueios.find((b) => b.item.includes("P057")) ?? null;
  const segmentos = segmentosPorDistribuidora(g.distribuidoras);
  // quantos trechos a gold traz por distribuidora (os demais ficam no CSV), lido dos dados
  const maxTrechos = Math.max(0, ...Object.values(segmentos).map((s) => s.length));
  // a data da recusa vem da evidência da coleta (dd/mm/aaaa); o código da resposta e o desafio do navegador ficam em Analisar
  const dataRecusa = bloqueioRegulatorio ? /(\d{2}\/\d{2}\/\d{4})/.exec(bloqueioRegulatorio.evidencia)?.[1] ?? null : null;
  const refTecnica = g.proveniencia.tecnica_regulatoria.periodo_referencia;
  // na rota inglesa, a data da recusa vai para o formato do idioma (dd/mm/aaaa vira data ISO antes de formatar)
  const dataRecusaTexto = dataRecusa ? tx(dataRecusa, dataBR(dataRecusa.split("/").reverse().join("-"))) : null;
  const daGold = (t: string, regiao: string) => traduzOuMarca(t, TEXTOS_PERDAS_EN, idioma, regiao);
  const itemBloqueio = (item: string) => {
    const en = traducaoExata(item, TEXTOS_PERDAS_EN);
    return tx(<>{semCodigosDePergunta(item)}</>, en ? <>{semCodigosDePergunta(en)}</> : <TrechoPortugues regiao="bloqueio-item">{semCodigosDePergunta(item)}</TrechoPortugues>);
  };

  // as três comparações que a página poderia fazer, cada uma com o estado e a razão (perímetro, elegibilidade e bloqueio à vista)
  const comparacoes: ItemEstadoComparacao[] = [
    {
      id: "tecnico-entre-trechos",
      comparacao: tx("Mudança do percentual técnico entre trechos", "Change of the technical percentage between segments"),
      estado: "disponivel",
      motivo: tx(
        <>
          {num(perimetro.comTrecho, 0)} de {num(perimetro.total, 0)} distribuidoras têm ao menos um trecho de 6 meses ou mais em que a razão entre a perda técnica e a energia injetada publicada fica constante: essa razão revela
          o percentual aplicado pela fonte, inferido pelo observatório e não lido do ato homologatório.
          {perimetro.fimMaisAntigo && perimetro.fimMaisRecente
            ? ` O trecho mais recente de cada uma termina em mês diferente, de ${mesAno(perimetro.fimMaisAntigo)} a ${mesAno(perimetro.fimMaisRecente)}: o período de cada ponto está na dica e na tabela.`
            : ""}
        </>,
        <>
          {num(perimetro.comTrecho, 0)} of {num(perimetro.total, 0)} distribution utilities have at least one segment of 6 months or more in which the ratio between the technical loss and the published injected energy stays
          constant: this ratio reveals the percentage applied by the source, inferred by the observatory and not read from the ratification act.
          {perimetro.fimMaisAntigo && perimetro.fimMaisRecente
            ? ` The latest segment of each one ends in a different month, from ${mesAno(perimetro.fimMaisAntigo)} to ${mesAno(perimetro.fimMaisRecente)}: the period of each point is in the tooltip and in the table.`
            : ""}
        </>,
      ),
    },
    {
      id: "tecnico-realizado",
      comparacao: tx(
        "Perda técnica informada no SAMP contra o percentual técnico regulatório homologado",
        "Technical loss reported in SAMP against the ratified regulatory technical percentage",
      ),
      estado: "indisponivel",
      motivo: tx(
        <>O percentual técnico homologado de cada concessionária não está em base aberta acessível ao observatório. A perda técnica do SAMP é a informada no balanço de energia, uma estimativa e não uma medição, e pode diferir do percentual homologado: sem a referência, a página não diz quanto.</>,
        <>
          The ratified technical percentage of each concession holder is not in an open database accessible to the observatory. The SAMP technical loss is the one reported in the energy balance, an estimate and not a
          measurement, and it can differ from the ratified percentage: without the reference, the page does not say by how much.
        </>,
      ),
    },
    ...(bloqueioRegulatorio
      ? [
          {
            id: "nao-tecnica-realizada",
            comparacao: tx("Perda não técnica realizada contra a referência regulatória", "Actual non-technical loss against the regulatory reference"),
            estado: "indisponivel" as const,
            dados: { "data-bloqueio": "regulatorio" },
            motivo: tx(
              <>
                {itemBloqueio(bloqueioRegulatorio.item)}: o relatório da ANEEL traz esses valores só em figuras, sem tabela, e os endereços da ANEEL que os publicam recusaram o acesso do observatório
                {dataRecusaTexto ? ` em ${dataRecusaTexto}` : ""}. Por isso a comparação do realizado com a referência regulatória não é feita, e nenhum valor de reserva é mostrado. O limite de perdas não técnicas está explicado em{" "}
                <Termo slug="percentual-regulatorio-de-perdas">percentual regulatório de perdas</Termo>, e a conferência com o relatório da ANEEL está no nível Auditar.
              </>,
              <>
                {itemBloqueio(bloqueioRegulatorio.item)}: the ANEEL report gives these values only in figures, with no table, and the ANEEL addresses that publish them refused the observatory&apos;s access
                {dataRecusaTexto ? ` on ${dataRecusaTexto}` : ""}. For this reason the comparison of the actual value with the regulatory reference is not made, and no fallback value is shown. The non-technical loss limit
                is explained in <Termo slug="percentual-regulatorio-de-perdas">regulatory loss percentage</Termo>, and the check against the ANEEL report is at the Audit level.
              </>,
            ),
            detalhe: (
              <>
                <p>
                  {tx("Evidência:", "Evidence:")} {daGold(bloqueioRegulatorio.evidencia, "bloqueio-evidencia")}
                </p>
                <p>
                  {tx("Dependência:", "Dependency:")} {daGold(bloqueioRegulatorio.dependencia, "bloqueio-dependencia")}
                </p>
                <details>
                  <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-carvao-muted underline underline-offset-4">
                    {tx(<>Endereços tentados ({bloqueioRegulatorio.tentativas.length})</>, <>Addresses tried ({bloqueioRegulatorio.tentativas.length})</>)}
                  </summary>
                  {/* endereços e notas da coleta, como a gold registrou (só em português) */}
                  <TrechoPortugues regiao="bloqueio-tentativas" como="div">
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-xs break-all text-carvao-muted">
                      {bloqueioRegulatorio.tentativas.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  </TrechoPortugues>
                </details>
              </>
            ),
          },
        ]
      : []),
  ];

  const oQueMudou = tx(
    <>
      {num(perimetro.comResolucao, 0)} distribuidoras têm o trecho mais recente iniciado numa troca que coincide com o início de vigência de uma resolução homologatória; o mais recente termina em{" "}
      {mesAno(perimetro.fimMaisRecente ?? g.referencia.ultima_competencia)}.
    </>,
    <>
      {num(perimetro.comResolucao, 0)} distribution utilities have their latest segment starting at a change that coincides with the effective start of a ratification resolution; the latest one ends in{" "}
      {mesAno(perimetro.fimMaisRecente ?? g.referencia.ultima_competencia)}.
    </>,
  );
  const comoInterpretar = tx(
    <>
      O percentual é inferido da própria série do SAMP: onde a razão técnica ÷ injetada publicada fica constante por 6 meses ou mais, ela revela o percentual aplicado pela fonte. Losango vazado é
      o trecho anterior; círculo, o mais recente; a diferença é a mudança do parâmetro entre processos, não desempenho da distribuidora. No gráfico e na tabela, &quot;referência&quot; quer dizer o trecho
      anterior da própria distribuidora, e não uma meta regulatória.
    </>,
    <>
      The percentage is inferred from the SAMP series itself: where the technical ÷ published injected ratio stays constant for 6 months or more, it reveals the percentage applied by the source. The hollow diamond is the
      previous segment; the circle, the latest; the difference is the change of the parameter between processes, not the performance of the distribution utility. In the chart and the table, &quot;reference&quot; means the
      previous segment of the distribution utility itself, and not a regulatory target.
    </>,
  );
  const naoConcluir = tx(
    <>
      Que a distribuidora esteja acima ou abaixo da meta regulatória de perdas: a referência de não técnicas não está em base aberta. Que o percentual técnico seja perda física medida. Que a
      perda reconhecida deva ser zero: a ANEEL reconhece perdas técnicas em toda rede, e elas são inevitáveis no transporte da energia.
    </>,
    <>
      That the distribution utility is above or below the regulatory loss target: the non-technical reference is not in an open database. That the technical percentage is a measured physical loss. That the recognized
      loss should be zero: ANEEL recognizes technical losses in every grid, and they are unavoidable in transporting energy.
    </>,
  );

  return (
    <>
      <header><CabecalhoPlataforma colecao="energia" destinoConta="/setor-eletrico" navegacao="setor-eletrico" idiomas /></header>
      <MarcaVisita secao="energia:perdas:regulatorio" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          siglas={["SAMP", "ANEEL", "IBGE"]}
          rotulo={tx("Perdas de energia", "Energy losses")}
          titulo={perguntaPerdas("regulatorio")}
          lead={tx(
            <>
              A ANEEL define, a cada revisão tarifária, os <Termo slug="percentual-regulatorio-de-perdas">percentuais regulatórios</Termo> de perdas técnicas e não técnicas que a tarifa reconhece. A página mostra como o percentual
              técnico mudou de um processo para o seguinte e diz o que não pode ser comparado com a perda realizada.
            </>,
            <>
              At each tariff review, ANEEL sets the <Termo slug="percentual-regulatorio-de-perdas">regulatory percentages</Termo> of technical and non-technical losses that the tariff recognizes. The page shows how the
              technical percentage changed from one process to the next and says what cannot be compared with the actual loss.
            </>,
          )}
          recorte={tx(
            <>
              Trechos de {mesAno(refTecnica.inicio)} a {mesAno(refTecnica.fim)} · {num(perimetro.comTrecho, 0)} distribuidoras · % da energia injetada publicada
            </>,
            <>
              Segments from {mesAno(refTecnica.inicio)} to {mesAno(refTecnica.fim)} · {num(perimetro.comTrecho, 0)} distribution utilities · % of published injected energy
            </>,
          )}
          fonte={tx(
            <>ANEEL, SAMP Balanço e Componentes Tarifárias</>,
            <>
              ANEEL, <Nome>SAMP Balanço</Nome> and <Nome>Componentes Tarifárias</Nome>
            </>,
          )}
          referencia={<ReferenciaPerdas g={g} />}
        >
          {tx(
            "A ANEEL define, a cada revisão tarifária, os percentuais regulatórios de perdas técnicas e não técnicas que a tarifa reconhece. Esta página mostra como o percentual técnico mudou de um processo tarifário para o seguinte, em cada distribuidora. Ela não compara a perda realizada com a referência regulatória.",
            "At each tariff review, ANEEL sets the regulatory percentages of technical and non-technical losses that the tariff recognizes. This page shows how the technical percentage changed from one tariff process to the next, in each distribution utility. It does not compare the actual loss with the regulatory reference.",
          )}
        </CabecalhoModulo>
        <PerdasNavegacao atual="regulatorio" />

        <ModoProfundidade>
          <PerdasLevaEscolha />
          <Bloco id="regulatorio">
            <PainelEvidencia
              id="painel-regulatorio"
              pergunta={tx("O percentual técnico de cada distribuidora, trecho a trecho", "The technical percentage of each distribution utility, segment by segment")}
              subtitulo={tx(
                "Percentual técnico regulatório implícito no SAMP · % da energia injetada publicada · trechos de 6 meses ou mais",
                "Implicit regulatory technical percentage in SAMP · % of published injected energy · segments of 6 months or more",
              )}
              natureza="ESTIMADO"
              proveniencia={g.proveniencia.tecnica_regulatoria}
              porQueImporta={tx(
                <>
                  A ANEEL define, em cada revisão tarifária, os percentuais regulatórios de perdas técnicas e não técnicas que a tarifa reconhece. Comparar o realizado com esses percentuais mostraria quanto da perda real a
                  tarifa reconhece; nesta publicação só o percentual técnico é observável, e a comparação com o realizado não é feita.
                </>,
                <>
                  At each tariff review, ANEEL sets the regulatory percentages of technical and non-technical losses that the tariff recognizes. Comparing the actual value with these percentages would show how much of the real
                  loss the tariff recognizes; in this release only the technical percentage is observable, and the comparison with the actual value is not made.
                </>,
              )}
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
            >
              <div className="space-y-6">
                <Resposta id="regulatorio" veredito={vereditoRegulatorio(regulatorio)}>
                  {marcarNomes(respostaRegulatorio(regulatorio), Object.values(rotulos), idioma)}
                </Resposta>
                <PerdasRegulatorio
                  linhas={regulatorio}
                  urlEvidencias={g.series.evidencias_tecnica}
                  segmentos={segmentos}
                  ids={ids}
                  rotulos={rotulos}
                  versao={versao}
                  aposFigura={<EstadoDaComparacao titulo={tx("O que esta página compara e o que não compara", "What this page compares and what it does not")} itens={comparacoes} />}
                />
                <Recorte
                  periodo={tx(
                    `trechos de ${mesAno(refTecnica.inicio)} a ${mesAno(refTecnica.fim)}; até ${num(maxTrechos, 0)} mais recentes de cada distribuidora (os demais no CSV)`,
                    `segments from ${mesAno(refTecnica.inicio)} to ${mesAno(refTecnica.fim)}; up to the ${num(maxTrechos, 0)} most recent of each distribution utility (the others in the CSV)`,
                  )}
                  universo={tx(`${regulatorio.length} distribuidoras com ao menos um trecho de 6 meses ou mais`, `${regulatorio.length} distribution utilities with at least one segment of 6 months or more`)}
                  unidade={tx("% da energia injetada publicada", "% of published injected energy")}
                />
                <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />
                <PerdasSeguir
                  ancora="regulatorio"
                  proxima={{ pergunta: perguntaPerdas("custo"), href: "/setor-eletrico/perdas/custo-e-contexto" }}
                  downloads={[{ rotulo: tx("Percentual técnico regulatório implícito (CSV)", "Implicit regulatory technical percentage (CSV)"), url: "/energia/series/perdas_tecnicas_regulatorias.csv" }]}
                />
              </div>
            </PainelEvidencia>
          </Bloco>

          <PerdasAuditoria g={g} />
        </ModoProfundidade>
      </main>
    </>
  );
}
