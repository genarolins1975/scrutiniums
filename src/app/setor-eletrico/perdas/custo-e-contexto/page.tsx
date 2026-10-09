import type { Metadata } from "next";
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
import { PERGUNTA_ABERTURA, PERGUNTA_CUSTO, PerdasNavegacao, PerdasSeguir, Recorte, ReferenciaPerdas, Resposta } from "@/components/energia/PerdasPainel";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { integra, lerGold } from "@/lib/energia/gold";
import { dataBR, mesAno, num } from "@/lib/energia/formato";
import type { PerdasGold } from "@/lib/energia/tipos-perdas";
import { linhasContexto, linhasCusto, pontosAssociacao, respostaAssociacao, respostaCusto, rotuloDistribuidora, vereditoAssociacao, vereditoCusto } from "@/lib/energia/perdas";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Perdas: custo na tarifa e contexto territorial",
  description:
    "Componentes de perdas técnicas, não técnicas e na Rede Básica na tarifa residencial B1 de cada distribuidora, com a vigência conferida, e a associação descritiva entre renda da área e perdas, com a fonte da ANEEL e do IBGE.",
  alternates: { canonical: "/setor-eletrico/perdas/custo-e-contexto" },
};

export default function PerdasCustoContextoPage() {
  const g = lerGold<PerdasGold>("perdas.json");
  if (!integra(g)) {
    return (
      <>
        <CabecalhoEnergia atual="perdas" />
        <main id="conteudo" tabIndex={-1} className="ed-pagina py-14">
          <Indisponivel titulo="Perdas indisponíveis" motivo={g?.motivo ?? "Os dados processados de perdas não foram gerados nesta publicação."} />
        </main>
      </>
    );
  }

  const rotulos = Object.fromEntries(g.distribuidoras.map((d) => [d.cnpj, rotuloDistribuidora(d)]));
  const ids = g.distribuidoras.map((d) => d.cnpj);
  const versao = `SAMP até ${mesAno(g.referencia.ultima_competencia)}, publicado em ${dataBR(g.gerado_em)}`;
  const custo = linhasCusto(g.distribuidoras);
  const bloqueioRegulatorio = g.bloqueios.find((b) => b.item.includes("P057")) ?? null;
  const assoc = g.associacao;
  // anos lidos da gold: arquivos de componentes tarifárias lidos, Censo e relação que desenha o território
  const pt = g.proveniencia.tarifa.periodo_referencia;
  const anosTarifa = `${pt.inicio.slice(0, 4)} a ${pt.fim.slice(0, 4)}`;
  const censo = g.proveniencia.contexto.periodo_referencia.inicio.slice(0, 4);
  const anoRelacaoAssoc = assoc.ano_relacao ?? assoc.ano_perdas;
  const nVigentes = custo.filter((l) => l.situacao === "vigente").length;

  const oQueMudouCusto = (
    <>
      {custo.filter((l) => l.situacao === "vigencia_encerrada" && l.ativa).length} distribuidoras ativas só têm processo com vigência encerrada no arquivo da fonte em{" "}
      {dataBR(g.referencia.tarifa_consultada_em)}: a tarifa em vigor delas é desconhecida até a próxima publicação e elas não entram no gráfico. Outras{" "}
      {custo.filter((l) => l.situacao === "vigencia_encerrada" && !l.ativa).length} têm o último processo encerrado, e a série delas no SAMP também terminou.
    </>
  );
  const comoInterpretarCusto = (
    <>
      Valores por MWh, nominais e sem tributos, das componentes de perdas técnicas, não técnicas e na Rede Básica da tarifa B1 convencional, na base econômica do arquivo de componentes tarifárias (base de
      cálculo tarifário, não a tarifa de aplicação que aparece na conta; o arquivo para baixar traz as duas bases); a participação divide a soma delas pela tarifa da mesma base (TUSD + TE). É o nível reconhecido
      por MWh, não o custo das perdas reais nem o total em reais.
    </>
  );
  const naoConcluirCusto = (
    <>
      Quanto cada distribuidora recebe em reais pelas perdas: o valor reconhecido por processo não está em base aberta acessível (bloqueio abaixo) e nenhum número aqui é multiplicado por
      mercado ou por tarifa cheia. Que a tarifa de uma distribuidora com vigência encerrada continue a mesma.
    </>
  );
  const oQueMudouContexto = (
    <>
      A associação usa as perdas de {assoc.ano_perdas} e o território da relação de {anoRelacaoAssoc} com a renda do Censo {censo}, para que as três grandezas descrevam o mesmo ano; não muda
      a cada publicação do SAMP.
    </>
  );
  const comoInterpretarContexto = (
    <>
      Cada ponto é uma concessionária: renda média domiciliar per capita dos municípios da área, ponderada pelos moradores, contra a taxa do mesmo ano. A associação é medida pelo ρ de Spearman, que compara a ordem das áreas por renda com a ordem por taxa de perdas e não supõe
      relação linear; não há reta desenhada.
    </>
  );
  const naoConcluirContexto = (
    <>
      Que a renda cause perdas; que as famílias de uma área sejam responsáveis pelas perdas não técnicas; que a média da área descreva cada município ou cada família (a desigualdade interna fica
      escondida).
    </>
  );

  return (
    <>
      <CabecalhoEnergia atual="perdas" />
      <MarcaVisita secao="energia:perdas:custo" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          siglas={["SAMP", "TUSD", "TE", "ANEEL", "IBGE"]}
          rotulo="Perdas de energia"
          titulo={PERGUNTA_CUSTO}
          lead={
            <>
              As perdas reconhecidas no processo tarifário entram na tarifa de quem consome na área. A página mostra quanto isso pesa na tarifa residencial, em R$/MWh e em % da tarifa, e que características das áreas
              aparecem ao lado das perdas, sem atribuir causa.
            </>
          }
          recorte={
            <>
              Tarifa B1 vigente em {dataBR(g.referencia.tarifa_consultada_em)} · {num(nVigentes, 0)} distribuidoras · R$/MWh sem tributos · renda do Censo {censo}
            </>
          }
          fonte="ANEEL, Componentes Tarifárias; IBGE, Censo"
          limite="Os valores de tarifa são os da base econômica do arquivo de componentes tarifárias, uma base de cálculo tarifário: não são a tarifa que aparece na conta."
          referencia={<ReferenciaPerdas g={g} />}
        >
          As perdas reconhecidas no processo tarifário entram na tarifa de quem consome na área: o consumidor regular paga pela parte das{" "}
          <Termo slug="perdas-tecnicas">técnicas</Termo> e das <Termo slug="perdas-nao-tecnicas">não técnicas</Termo> que a ANEEL reconhece na tarifa. Esta página mostra quanto isso pesa na tarifa residencial e que
          características das áreas aparecem ao lado das perdas, sem atribuir causa.
        </CabecalhoModulo>
        <PerdasNavegacao atual="custo" />

        <ModoProfundidade>
          <PerdasLevaEscolha />
          <Bloco id="custo">
            <PainelEvidencia
              id="painel-custo"
              pergunta="Quanto da tarifa residencial remunera as perdas?"
              subtitulo={`Componentes de perdas na tarifa residencial B1, base econômica · R$/MWh sem tributos · vigência conferida em ${dataBR(g.referencia.tarifa_consultada_em)}`}
              natureza="OBSERVADO"
              proveniencia={g.proveniencia.tarifa}
              porQueImporta={<>É a parte da tarifa residencial que remunera as perdas reconhecidas no processo tarifário de cada distribuidora: o consumidor regular paga por ela.</>}
              oQueMudou={oQueMudouCusto}
              comoInterpretar={comoInterpretarCusto}
              naoConcluir={naoConcluirCusto}
              naoConcluirNoCorpo
            >
              <div className="space-y-6">
                <Resposta id="custo" veredito={vereditoCusto(custo, g.referencia.tarifa_consultada_em)}>
                  {respostaCusto(custo, g.referencia.tarifa_consultada_em)}
                </Resposta>
                <PerdasCusto linhas={custo} urlEvidencias={g.series.evidencias_tarifa} ids={ids} rotulos={rotulos} consultadaEm={g.referencia.tarifa_consultada_em} anosArquivos={anosTarifa} versao={versao} />
                <Recorte
                  periodo={custo.length ? `processos tarifários de ${dataBR(custo.map((l) => l.inicio).sort()[0])} até a consulta em ${dataBR(g.referencia.tarifa_consultada_em)}` : `nenhum processo na consulta de ${dataBR(g.referencia.tarifa_consultada_em)}`}
                  universo={`${custo.length} distribuidoras com tarifa residencial B1 nos arquivos de componentes tarifárias`}
                  unidade="R$/MWh nominais, sem tributos, na base econômica"
                />
                {bloqueioRegulatorio && (
                  <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted" data-bloqueio="custo-total">
                    O custo total reconhecido em reais por processo não está disponível, pela mesma razão da comparação com a referência regulatória (explicada no{" "}
                    <a href="/setor-eletrico/perdas/regulatorio#regulatorio" className="text-energia-dark underline underline-offset-4 hover:text-carvao">
                      painel Realizado e regulatório
                    </a>
                    ).
                    <span data-nivel="analisar">
                      {" "}
                      Evidência e endereços tentados no bloco &quot;Como esses números foram conferidos?&quot;, no nível Auditar. Dependência: {bloqueioRegulatorio.dependencia.replace(/aos hosts acima/, "aos endereços tentados")}
                    </span>
                  </p>
                )}
                <NotasDoPainel nome="custo na tarifa" oQueMudou={oQueMudouCusto} comoInterpretar={comoInterpretarCusto} naoConcluir={naoConcluirCusto} />
                <PerdasSeguir
                  ancora="custo"
                  proxima={{ pergunta: "Que características das áreas aparecem associadas às perdas?", href: "#contexto" }}
                  downloads={[{ rotulo: "Componentes de perdas na tarifa B1 (CSV)", url: "/energia/series/perdas_tarifa_b1.csv" }]}
                />
              </div>
            </PainelEvidencia>
          </Bloco>

          <Bloco id="contexto">
            <PainelEvidencia
              id="painel-contexto"
              pergunta="Que características das áreas aparecem associadas às perdas?"
              subtitulo={`Renda média dos municípios da área (Censo ${censo}) e perdas de ${assoc.ano_perdas} · concessionárias`}
              natureza="CALCULADO"
              proveniencia={g.proveniencia.contexto}
              complementares={[{ rotulo: "Área de atuação por municípios", p: g.proveniencia.territorio }]}
              porQueImporta={<>Ajuda a ler as diferenças entre áreas sem atribuir a elas uma causa: a própria ANEEL usa características socioeconômicas das áreas ao calcular as referências de perdas não técnicas.</>}
              oQueMudou={oQueMudouContexto}
              comoInterpretar={comoInterpretarContexto}
              naoConcluir={naoConcluirContexto}
              naoConcluirNoCorpo
            >
              <div className="space-y-6">
                <Resposta
                  id="contexto"
                  veredito={vereditoAssociacao(assoc)}
                  prova={g.evidencias.associacao ? <ComproveNumero evidencia={g.evidencias.associacao} rotulo="Comprove a associação da taxa de perdas totais com a renda" /> : undefined}
                >
                  {respostaAssociacao(assoc)}
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
                <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted">{assoc.leitura}</p>
                <Recorte
                  periodo={`${assoc.ano_perdas} (perdas), relação de ${anoRelacaoAssoc} (território); Censo de ${censo}`}
                  universo={`${assoc.n_taxa_total} concessionárias com ${assoc.ano_perdas} completo e sem alerta; ${assoc.n_pnt_bt} delas com a separação fechando`}
                  unidade={`R$ de ${censo} por mês; % da energia injetada; % do mercado de baixa tensão`}
                />
                <NotasDoPainel nome="contexto das áreas" oQueMudou={oQueMudouContexto} comoInterpretar={comoInterpretarContexto} naoConcluir={naoConcluirContexto} />
                <PerdasSeguir
                  ancora="contexto"
                  proxima={{ pergunta: PERGUNTA_ABERTURA, href: "/setor-eletrico/perdas" }}
                  downloads={[{ rotulo: "Contexto social por distribuidora (CSV)", url: "/energia/series/perdas_contexto_social.csv" }]}
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
