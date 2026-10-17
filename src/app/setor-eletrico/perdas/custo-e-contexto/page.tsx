import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { Termo } from "@/components/evidencia/Termo";
import { PerdasCusto } from "@/components/energia/PerdasCusto";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { PerdasContexto } from "@/components/energia/PerdasContexto";
import { PerdasAuditoria } from "@/components/energia/PerdasAuditoria";
import { PerdasLevaEscolha } from "@/components/energia/PerdasLevaEscolha";
import { PerdasNavegacao, PerdasSeguir, Recorte, ReferenciaPerdas, Resposta, perguntaPerdas } from "@/components/energia/PerdasPainel";
import LinkSemPrefetch from "@/components/energia/LinkSemPrefetch";
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { TEXTOS_PERDAS_EN, marcarNomes, traducaoExata, traduzOuMarca } from "@/lib/energia/i18n/qualidade-perdas";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { integra, lerGold } from "@/lib/energia/gold";
import { dataBR, mesAno, num } from "@/lib/energia/formato";
import type { PerdasGold } from "@/lib/energia/tipos-perdas";
import { linhasContexto, linhasCusto, pontosAssociacao, respostaAssociacao, respostaCusto, rotuloDistribuidora, vereditoAssociacao, vereditoCusto } from "@/lib/energia/perdas";

export const dynamic = "force-static";

export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/perdas/custo-e-contexto", {
    title: tx("Perdas: custo na tarifa e contexto territorial", "Losses: cost in the tariff and territorial context"),
    description: tx(
      "Componentes de perdas técnicas, não técnicas e na Rede Básica na tarifa residencial B1 de cada distribuidora, com a vigência conferida, e a associação descritiva entre renda da área e perdas, com a fonte da ANEEL e do IBGE.",
      "Technical, non-technical and basic transmission grid loss components in the B1 residential tariff of each distribution utility, with validity checked, and the descriptive association between area income and losses, with ANEEL and IBGE as sources.",
    ),
    alternates: { canonical: "/setor-eletrico/perdas/custo-e-contexto" },
  }, anterior);
}

export default function PerdasCustoContextoPage() {
  const g = lerGold<PerdasGold>("perdas.json");
  const idioma = idiomaEnergia();
  if (!integra(g)) {
    return (
      <>
        <CabecalhoEnergia atual="perdas" />
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
  // nomes que as frases calculadas citam: distribuidoras e a Rede Básica (nome próprio, marcado na rota inglesa)
  const nomes = [...Object.values(rotulos), "Rede Básica"]; // i18n: dado
  const custo = linhasCusto(g.distribuidoras);
  const bloqueioRegulatorio = g.bloqueios.find((b) => b.item.includes("P057")) ?? null;
  const assoc = g.associacao;
  // anos lidos da gold: arquivos de componentes tarifárias lidos, Censo e relação que desenha o território
  const pt = g.proveniencia.tarifa.periodo_referencia;
  const anosTarifa = tx(`${pt.inicio.slice(0, 4)} a ${pt.fim.slice(0, 4)}`, `${pt.inicio.slice(0, 4)} to ${pt.fim.slice(0, 4)}`);
  const censo = g.proveniencia.contexto.periodo_referencia.inicio.slice(0, 4);
  const anoRelacaoAssoc = assoc.ano_relacao ?? assoc.ano_perdas;
  const nVigentes = custo.filter((l) => l.situacao === "vigente").length;

  const oQueMudouCusto = tx(
    <>
      {custo.filter((l) => l.situacao === "vigencia_encerrada" && l.ativa).length} distribuidoras ativas só têm processo com vigência encerrada no arquivo da fonte em{" "}
      {dataBR(g.referencia.tarifa_consultada_em)}: a tarifa em vigor delas é desconhecida até a próxima publicação e elas não entram no gráfico. Outras{" "}
      {custo.filter((l) => l.situacao === "vigencia_encerrada" && !l.ativa).length} têm o último processo encerrado, e a série delas no SAMP também terminou.
    </>,
    <>
      {custo.filter((l) => l.situacao === "vigencia_encerrada" && l.ativa).length} active distribution utilities only have a process whose validity ended in the source file on{" "}
      {dataBR(g.referencia.tarifa_consultada_em)}: their tariff in force is unknown until the next release and they are not in the chart. Another{" "}
      {custo.filter((l) => l.situacao === "vigencia_encerrada" && !l.ativa).length} have their latest process ended, and their SAMP series has also ended.
    </>,
  );
  const comoInterpretarCusto = tx(
    <>
      Valores por MWh, nominais e sem tributos, das componentes de perdas técnicas, não técnicas e na Rede Básica da tarifa B1 convencional, na base econômica do arquivo de componentes tarifárias (base de
      cálculo tarifário, não a tarifa de aplicação que aparece na conta; o arquivo para baixar traz as duas bases); a participação divide a soma delas pela tarifa da mesma base (TUSD + TE). É o nível reconhecido
      por MWh, não o custo das perdas reais nem o total em reais.
    </>,
    <>
      Values per MWh, nominal and before taxes, of the technical, non-technical and basic transmission grid loss components of the conventional B1 tariff, in the economic base of the tariff component file (the tariff
      calculation base, not the applied tariff that appears on the bill; the download file has both bases); the share divides their sum by the tariff of the same base (TUSD + TE). It is the level recognized per MWh,
      not the cost of the real losses nor the total in reais.
    </>,
  );
  const naoConcluirCusto = tx(
    <>
      Quanto cada distribuidora recebe em reais pelas perdas: o valor reconhecido por processo não está em base aberta acessível (bloqueio abaixo) e nenhum número aqui é multiplicado por
      mercado ou por tarifa cheia. Que a tarifa de uma distribuidora com vigência encerrada continue a mesma.
    </>,
    <>
      How much each distribution utility receives in reais for losses: the value recognized per process is not in an accessible open database (blocked, see below) and no number here is multiplied by market or
      by the full tariff. That the tariff of a distribution utility whose validity has ended remains the same.
    </>,
  );
  const oQueMudouContexto = tx(
    <>
      A associação usa as perdas de {assoc.ano_perdas} e o território da relação de {anoRelacaoAssoc} com a renda do Censo {censo}, para que as três grandezas descrevam o mesmo ano; não muda
      a cada publicação do SAMP.
    </>,
    <>
      The association uses the {assoc.ano_perdas} losses and the territory of the {anoRelacaoAssoc} relation with the income of the {censo} Census, so that the three quantities describe the same year; it does not
      change with each SAMP release.
    </>,
  );
  const comoInterpretarContexto = tx(
    <>
      Cada ponto é uma concessionária: renda média domiciliar per capita dos municípios da área, ponderada pelos moradores, contra a taxa do mesmo ano. A associação é medida pelo ρ de Spearman, que compara a ordem das áreas por renda com a ordem por taxa de perdas e não supõe
      relação linear; não há reta desenhada.
    </>,
    <>
      Each point is a concession holder: average household income per capita of the area&apos;s municipalities, weighted by residents, against the rate of the same year. The association is measured by Spearman&apos;s ρ,
      which compares the order of the areas by income with the order by loss rate and does not assume a linear relation; no line is drawn.
    </>,
  );
  const naoConcluirContexto = tx(
    <>
      Que a renda cause perdas; que as famílias de uma área sejam responsáveis pelas perdas não técnicas; que a média da área descreva cada município ou cada família (a desigualdade interna fica
      escondida).
    </>,
    <>
      That income causes losses; that the households of an area are responsible for non-technical losses; that the area average describes each municipality or each household (the internal inequality stays
      hidden).
    </>,
  );
  const dependenciaBloqueio = (dep: string) => {
    const en = traducaoExata(dep, TEXTOS_PERDAS_EN);
    return tx(
      <>{dep.replace(/aos hosts acima/, "aos endereços tentados")}</>,
      en ? <>{en.replace(/to the hosts above/, "to the addresses tried")}</> : <TrechoPortugues regiao="bloqueio-dependencia">{dep.replace(/aos hosts acima/, "aos endereços tentados")}</TrechoPortugues>,
    );
  };

  return (
    <>
      <CabecalhoEnergia atual="perdas" />
      <MarcaVisita secao="energia:perdas:custo" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          siglas={["SAMP", "TUSD", "TE", "ANEEL", "IBGE"]}
          rotulo={tx("Perdas de energia", "Energy losses")}
          titulo={perguntaPerdas("custo")}
          lead={tx(
            <>
              As perdas reconhecidas no processo tarifário entram na tarifa de quem consome na área. A página mostra quanto isso pesa na tarifa residencial, em R$/MWh e em % da tarifa, e que características das áreas
              aparecem ao lado das perdas, sem atribuir causa.
            </>,
            <>
              The losses recognized in the tariff process enter the tariff of those who consume in the area. The page shows how much this weighs on the residential tariff, in R$/MWh and in % of the tariff, and which
              characteristics of the areas appear alongside the losses, without attributing a cause.
            </>,
          )}
          recorte={tx(
            <>
              Tarifa B1 vigente em {dataBR(g.referencia.tarifa_consultada_em)} · {num(nVigentes, 0)} distribuidoras · R$/MWh sem tributos · renda do Censo {censo}
            </>,
            <>
              B1 tariff in force on {dataBR(g.referencia.tarifa_consultada_em)} · {num(nVigentes, 0)} distribution utilities · R$/MWh before taxes · income from the {censo} Census
            </>,
          )}
          fonte={tx(
            <>ANEEL, Componentes Tarifárias; IBGE, Censo</>,
            <>
              ANEEL, <Nome>Componentes Tarifárias</Nome>; IBGE, Census
            </>,
          )}
          limite={tx(
            "Os valores de tarifa são os da base econômica do arquivo de componentes tarifárias, uma base de cálculo tarifário: não são a tarifa que aparece na conta.",
            "The tariff values are those of the economic base of the tariff component file, a tariff calculation base: they are not the tariff that appears on the bill.",
          )}
          referencia={<ReferenciaPerdas g={g} />}
        >
          {tx(
            <>
              As perdas reconhecidas no processo tarifário entram na tarifa de quem consome na área: o consumidor regular paga pela parte das{" "}
              <Termo slug="perdas-tecnicas">técnicas</Termo> e das <Termo slug="perdas-nao-tecnicas">não técnicas</Termo> que a ANEEL reconhece na tarifa. Esta página mostra quanto isso pesa na tarifa residencial e que
              características das áreas aparecem ao lado das perdas, sem atribuir causa.
            </>,
            <>
              The losses recognized in the tariff process enter the tariff of those who consume in the area: the regular consumer pays for the share of{" "}
              <Termo slug="perdas-tecnicas">technical losses</Termo> and <Termo slug="perdas-nao-tecnicas">non-technical losses</Termo> that ANEEL recognizes in the tariff. This page shows how much this weighs on the
              residential tariff and which characteristics of the areas appear alongside the losses, without attributing a cause.
            </>,
          )}
        </CabecalhoModulo>
        <PerdasNavegacao atual="custo" />

        <ModoProfundidade>
          <PerdasLevaEscolha />
          <Bloco id="custo">
            <PainelEvidencia
              id="painel-custo"
              pergunta={tx("Quanto da tarifa residencial remunera as perdas?", "How much of the residential tariff pays for losses?")}
              subtitulo={tx(
                `Componentes de perdas na tarifa residencial B1, base econômica · R$/MWh sem tributos · vigência conferida em ${dataBR(g.referencia.tarifa_consultada_em)}`,
                `Loss components in the B1 residential tariff, economic base · R$/MWh before taxes · validity checked on ${dataBR(g.referencia.tarifa_consultada_em)}`,
              )}
              natureza="OBSERVADO"
              proveniencia={g.proveniencia.tarifa}
              porQueImporta={tx(
                <>É a parte da tarifa residencial que remunera as perdas reconhecidas no processo tarifário de cada distribuidora: o consumidor regular paga por ela.</>,
                <>It is the part of the residential tariff that pays for the losses recognized in the tariff process of each distribution utility: the regular consumer pays for it.</>,
              )}
              oQueMudou={oQueMudouCusto}
              comoInterpretar={comoInterpretarCusto}
              naoConcluir={naoConcluirCusto}
              naoConcluirNoCorpo
            >
              <div className="space-y-6">
                <Resposta id="custo" veredito={marcarNomes(vereditoCusto(custo, g.referencia.tarifa_consultada_em), nomes, idioma)}>
                  {marcarNomes(respostaCusto(custo, g.referencia.tarifa_consultada_em), nomes, idioma)}
                </Resposta>
                <PerdasCusto linhas={custo} urlEvidencias={g.series.evidencias_tarifa} ids={ids} rotulos={rotulos} consultadaEm={g.referencia.tarifa_consultada_em} anosArquivos={anosTarifa} versao={versao} />
                <Recorte
                  periodo={
                    custo.length
                      ? tx(
                          `processos tarifários de ${dataBR(custo.map((l) => l.inicio).sort()[0])} até a consulta em ${dataBR(g.referencia.tarifa_consultada_em)}`,
                          `tariff processes from ${dataBR(custo.map((l) => l.inicio).sort()[0])} up to the query on ${dataBR(g.referencia.tarifa_consultada_em)}`,
                        )
                      : tx(`nenhum processo na consulta de ${dataBR(g.referencia.tarifa_consultada_em)}`, `no process in the query of ${dataBR(g.referencia.tarifa_consultada_em)}`)
                  }
                  universo={tx(
                    `${custo.length} distribuidoras com tarifa residencial B1 nos arquivos de componentes tarifárias`,
                    `${custo.length} distribution utilities with a B1 residential tariff in the tariff component files`,
                  )}
                  unidade={tx("R$/MWh nominais, sem tributos, na base econômica", "nominal R$/MWh, before taxes, in the economic base")}
                />
                {bloqueioRegulatorio && (
                  <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted" data-bloqueio="custo-total">
                    {tx(
                      "O custo total reconhecido em reais por processo não está disponível, pela mesma razão da comparação com a referência regulatória (explicada no ",
                      "The total cost recognized in reais per process is not available, for the same reason as the comparison with the regulatory reference (explained in the ",
                    )}
                    <LinkSemPrefetch href="/setor-eletrico/perdas/regulatorio#regulatorio" className="text-energia-dark underline underline-offset-4 hover:text-carvao">
                      {tx("painel Realizado e regulatório", "Actual and regulatory panel")}
                    </LinkSemPrefetch>
                    ).
                    <span data-nivel="analisar">
                      {" "}
                      {tx(
                        <>Evidência e endereços tentados no bloco &quot;Como esses números foram conferidos?&quot;, no nível Auditar. Dependência: </>,
                        <>Evidence and addresses tried in the block &quot;How were these numbers checked?&quot;, at the Audit level. Dependency: </>,
                      )}
                      {dependenciaBloqueio(bloqueioRegulatorio.dependencia)}
                    </span>
                  </p>
                )}
                <NotasDoPainel nome={tx("custo na tarifa", "cost in the tariff")} oQueMudou={oQueMudouCusto} comoInterpretar={comoInterpretarCusto} naoConcluir={naoConcluirCusto} />
                <PerdasSeguir
                  ancora="custo"
                  proxima={{ pergunta: tx("Que características das áreas aparecem associadas às perdas?", "Which characteristics of the areas appear associated with losses?"), href: "#contexto" }}
                  downloads={[{ rotulo: tx("Componentes de perdas na tarifa B1 (CSV)", "Loss components in the B1 tariff (CSV)"), url: "/energia/series/perdas_tarifa_b1.csv" }]}
                />
              </div>
            </PainelEvidencia>
          </Bloco>

          <Bloco id="contexto">
            <PainelEvidencia
              id="painel-contexto"
              pergunta={tx("Que características das áreas aparecem associadas às perdas?", "Which characteristics of the areas appear associated with losses?")}
              subtitulo={tx(
                `Renda média dos municípios da área (Censo ${censo}) e perdas de ${assoc.ano_perdas} · concessionárias`,
                `Average income of the area's municipalities (${censo} Census) and ${assoc.ano_perdas} losses · concession holders`,
              )}
              natureza="CALCULADO"
              proveniencia={g.proveniencia.contexto}
              complementares={[{ rotulo: tx("Área de atuação por municípios", "Service area by municipality"), p: g.proveniencia.territorio }]}
              porQueImporta={tx(
                <>Ajuda a ler as diferenças entre áreas sem atribuir a elas uma causa: a própria ANEEL usa características socioeconômicas das áreas ao calcular as referências de perdas não técnicas.</>,
                <>It helps read the differences between areas without attributing a cause to them: ANEEL itself uses socioeconomic characteristics of the areas when calculating the non-technical loss references.</>,
              )}
              oQueMudou={oQueMudouContexto}
              comoInterpretar={comoInterpretarContexto}
              naoConcluir={naoConcluirContexto}
              naoConcluirNoCorpo
            >
              <div className="space-y-6">
                <Resposta
                  id="contexto"
                  veredito={marcarNomes(vereditoAssociacao(assoc), nomes, idioma)}
                  prova={
                    g.evidencias.associacao ? (
                      <ComproveNumero
                        evidencia={g.evidencias.associacao}
                        rotulo={tx("Comprove a associação da taxa de perdas totais com a renda", "Verify the association of the total loss rate with income")}
                      />
                    ) : undefined
                  }
                >
                  {marcarNomes(respostaAssociacao(assoc), nomes, idioma)}
                </Resposta>
                <PerdasContexto
                  pontos={pontosAssociacao(assoc, rotulos)}
                  linhas={linhasContexto(g.distribuidoras)}
                  ids={ids}
                  rotulos={rotulos}
                  ano={assoc.ano_perdas}
                  anoRelacao={anoRelacaoAssoc}
                  anoRelacaoTabela={g.mapa.ano_relacao}
                  censo={censo}
                  rho={{ taxa: assoc.spearman_taxa_total, n_taxa: assoc.n_taxa_total, pnt_bt: assoc.spearman_pnt_bt, n_pnt_bt: assoc.n_pnt_bt }}
                  versao={versao}
                />
                <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted">{traduzOuMarca(assoc.leitura, TEXTOS_PERDAS_EN, idioma, "associacao-leitura")}</p>
                <Recorte
                  periodo={tx(
                    `${assoc.ano_perdas} (perdas), relação de ${anoRelacaoAssoc} (território); Censo de ${censo}`,
                    `${assoc.ano_perdas} (losses), ${anoRelacaoAssoc} relation (territory); ${censo} Census`,
                  )}
                  universo={tx(
                    `${assoc.n_taxa_total} concessionárias com ${assoc.ano_perdas} completo e sem alerta; ${assoc.n_pnt_bt} delas com a separação fechando`,
                    `${assoc.n_taxa_total} concession holders with a complete ${assoc.ano_perdas} and no alert; ${assoc.n_pnt_bt} of them with the separation closing`,
                  )}
                  unidade={tx(
                    `R$ de ${censo} por mês; % da energia injetada; % do mercado de baixa tensão`,
                    `${censo} R$ per month; % of injected energy; % of the low-voltage market`,
                  )}
                />
                <NotasDoPainel nome={tx("contexto das áreas", "context of the areas")} oQueMudou={oQueMudouContexto} comoInterpretar={comoInterpretarContexto} naoConcluir={naoConcluirContexto} />
                <PerdasSeguir
                  ancora="contexto"
                  proxima={{ pergunta: perguntaPerdas("mapa"), href: "/setor-eletrico/perdas" }}
                  downloads={[{ rotulo: tx("Contexto social por distribuidora (CSV)", "Social context by distribution utility (CSV)"), url: "/energia/series/perdas_contexto_social.csv" }]}
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
