import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { Termo } from "@/components/evidencia/Termo";
import { PerdasCusto } from "@/components/energia/PerdasCusto";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { PerdasContexto } from "@/components/energia/PerdasContexto";
import { PerdasAuditoria } from "@/components/energia/PerdasAuditoria";
import { PerdasNavegacao, ReferenciaPerdas, RodapePainel, Recorte, Resposta } from "@/components/energia/PerdasPainel";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { integra, lerGold } from "@/lib/energia/gold";
import { dataBR, mesAno } from "@/lib/energia/formato";
import type { PerdasGold } from "@/lib/energia/tipos-perdas";
import { linhasContexto, linhasCusto, pontosAssociacao, respostaAssociacao, respostaCusto, rotuloDistribuidora } from "@/lib/energia/perdas";

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
        <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6 py-14">
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

  return (
    <>
      <CabecalhoEnergia atual="perdas" />
      <MarcaVisita secao="energia:perdas:custo" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6">
        <CabecalhoModulo siglas={["SAMP", "TUSD", "TE"]}
          rotulo="Perdas de energia · custo e contexto"
          titulo="Qual é a dimensão econômica e territorial das perdas?"
          referencia={<ReferenciaPerdas g={g} />}
        >
          As perdas reconhecidas no processo tarifário entram na tarifa de quem consome na área: o consumidor regular paga pela parte que a ANEEL considera eficiente das{" "}
          <Termo slug="perdas-tecnicas">técnicas</Termo> e das <Termo slug="perdas-nao-tecnicas">não técnicas</Termo>. Esta página mostra quanto isso pesa na tarifa residencial e que
          características das áreas aparecem ao lado das perdas, sem atribuir causa.
        </CabecalhoModulo>
        <PerdasNavegacao atual="custo" />

        <ModoProfundidade>
          <Bloco id="custo">
            <PainelEvidencia
              id="painel-custo"
              pergunta="Qual é a dimensão econômica das perdas na tarifa?"
              subtitulo={`Componentes de perdas na tarifa residencial B1 · R$/MWh sem tributos · vigência conferida em ${dataBR(g.referencia.tarifa_consultada_em)}`}
              natureza="OBSERVADO"
              proveniencia={g.proveniencia.tarifa}
              porQueImporta={<>É a parte da tarifa residencial que remunera as perdas reconhecidas no processo tarifário de cada distribuidora: o consumidor regular paga por ela.</>}
              oQueMudou={
                <>
                  {custo.filter((l) => l.situacao === "vigencia_encerrada" && l.ativa).length} distribuidoras ativas só têm processo com vigência encerrada no arquivo da fonte em{" "}
                  {dataBR(g.referencia.tarifa_consultada_em)}: a tarifa em vigor delas é desconhecida até a próxima publicação e elas não entram no gráfico. Outras{" "}
                  {custo.filter((l) => l.situacao === "vigencia_encerrada" && !l.ativa).length} têm o último processo encerrado porque a série delas no SAMP também terminou.
                </>
              }
              comoInterpretar={
                <>
                  Valores por MWh, nominais e sem tributos, das componentes de perdas técnicas, não técnicas e na Rede Básica da tarifa B1 convencional; a participação divide a soma delas pela tarifa (TUSD +
                  TE). É o nível reconhecido por MWh, não o custo das perdas reais nem o total em reais.
                </>
              }
              naoConcluir={
                <>
                  Quanto cada distribuidora recebe em reais pelas perdas: o valor reconhecido por processo não está em base aberta acessível (bloqueio abaixo) e nenhum número aqui é multiplicado por
                  mercado ou por tarifa cheia. Que a tarifa de uma distribuidora com vigência encerrada continue a mesma.
                </>
              }
            >
              <Resposta>{respostaCusto(custo, g.referencia.tarifa_consultada_em)}</Resposta>
              <Recorte
                periodo={custo.length ? `processos tarifários de ${dataBR(custo.map((l) => l.inicio).sort()[0])} até a consulta em ${dataBR(g.referencia.tarifa_consultada_em)}` : `nenhum processo na consulta de ${dataBR(g.referencia.tarifa_consultada_em)}`}
                universo={`${custo.length} distribuidoras com tarifa residencial B1 nos arquivos de componentes tarifárias`}
                unidade="R$/MWh nominais, sem tributos"
              />
              <PerdasCusto linhas={custo} urlEvidencias={g.series.evidencias_tarifa} ids={ids} rotulos={rotulos} consultadaEm={g.referencia.tarifa_consultada_em} anosArquivos={anosTarifa} versao={versao} />
              {bloqueioRegulatorio && (
                <p className="mt-3 max-w-prose2 text-xs leading-relaxed text-carvao-muted" data-bloqueio="custo-total">
                  Custo total reconhecido em reais por processo: bloqueado pela mesma razão da referência regulatória (evidência e endereços tentados no{" "}
                  <a href="/setor-eletrico/perdas/regulatorio#regulatorio" className="text-energia-dark underline underline-offset-4 hover:text-carvao">
                    painel Realizado e regulatório
                  </a>{" "}
                  e no bloco &quot;Como esses números foram conferidos?&quot;, no nível Auditar). Dependência: {bloqueioRegulatorio.dependencia.replace(/aos hosts acima/, "aos endereços tentados")}
                </p>
              )}
              <RodapePainel
                ancora="custo"
                proxima={{ pergunta: "Que características das áreas aparecem associadas às perdas?", href: "#contexto" }}
                downloads={[{ rotulo: "Componentes de perdas na tarifa B1 (CSV)", url: "/energia/series/perdas_tarifa_b1.csv" }]}
              />
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
              oQueMudou={
                <>
                  A associação usa as perdas de {assoc.ano_perdas} e o território da relação de {anoRelacaoAssoc} com a renda do Censo {censo}, para que as três grandezas descrevam o mesmo ano; não muda
                  a cada publicação do SAMP.
                </>
              }
              comoInterpretar={
                <>
                  Cada ponto é uma concessionária: renda média domiciliar per capita dos municípios da área, ponderada pelos moradores, contra a taxa do mesmo ano. O ρ de Spearman compara postos e não supõe
                  relação linear; não há reta desenhada.
                </>
              }
              naoConcluir={
                <>
                  Que a renda cause perdas; que as famílias de uma área sejam responsáveis pelas perdas não técnicas; que a média da área descreva cada município ou cada família (a desigualdade interna fica
                  escondida).
                </>
              }
            >
              <Resposta prova={g.evidencias.associacao ? <ComproveNumero evidencia={g.evidencias.associacao} rotulo="Comprove o ρ da taxa de perdas totais" /> : undefined}>
                {respostaAssociacao(assoc)}
              </Resposta>
              <Recorte
                periodo={`${assoc.ano_perdas} (perdas), relação de ${anoRelacaoAssoc} (território); Censo de ${censo}`}
                universo={`${assoc.n_taxa_total} concessionárias com ${assoc.ano_perdas} completo e sem alerta; ${assoc.n_pnt_bt} delas com a separação fechando`}
                unidade={`R$ de ${censo} por mês; % da energia injetada; % do mercado de baixa tensão`}
              />
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
              <p className="mt-3 max-w-prose2 text-xs leading-relaxed text-carvao-muted">{assoc.leitura}</p>
              <RodapePainel
                ancora="contexto"
                proxima={{ pergunta: "Onde estão as perdas e como evoluíram? Volte ao mapa", href: "/setor-eletrico/perdas" }}
                downloads={[{ rotulo: "Contexto social por distribuidora (CSV)", url: "/energia/series/perdas_contexto_social.csv" }]}
              />
            </PainelEvidencia>
          </Bloco>

          <PerdasAuditoria g={g} />
        </ModoProfundidade>
      </main>
    </>
  );
}
