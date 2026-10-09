import { semCodigosDePergunta } from "@/lib/energia/bastidor";
import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { Termo } from "@/components/evidencia/Termo";
import { PerdasRegulatorio } from "@/components/energia/PerdasRegulatorio";
import { PerdasAuditoria } from "@/components/energia/PerdasAuditoria";
import { PerdasLevaEscolha } from "@/components/energia/PerdasLevaEscolha";
import { EstadoDaComparacao, PERGUNTA_CUSTO, PERGUNTA_REGULATORIO, PerdasNavegacao, PerdasSeguir, Recorte, ReferenciaPerdas, Resposta, type ItemEstadoComparacao } from "@/components/energia/PerdasPainel";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { integra, lerGold } from "@/lib/energia/gold";
import { dataBR, mesAno, num } from "@/lib/energia/formato";
import type { PerdasGold } from "@/lib/energia/tipos-perdas";
import { linhasRegulatorio, perimetroRegulatorio, respostaRegulatorio, rotuloDistribuidora, segmentosPorDistribuidora, vereditoRegulatorio } from "@/lib/energia/perdas";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Perdas: percentual técnico regulatório por distribuidora",
  description:
    "Percentual técnico regulatório implícito no SAMP por distribuidora, trecho a trecho, com a resolução homologatória associada, e o bloqueio da comparação com a referência de perdas não técnicas, com evidência.",
  alternates: { canonical: "/setor-eletrico/perdas/regulatorio" },
};

export default function PerdasRegulatorioPage() {
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
  const regulatorio = linhasRegulatorio(g.distribuidoras);
  const perimetro = perimetroRegulatorio(regulatorio, g.distribuidoras.length);
  const bloqueioRegulatorio = g.bloqueios.find((b) => b.item.includes("P057")) ?? null;
  const segmentos = segmentosPorDistribuidora(g.distribuidoras);
  // quantos trechos a gold traz por distribuidora (os demais ficam no CSV), lido dos dados
  const maxTrechos = Math.max(0, ...Object.values(segmentos).map((s) => s.length));
  // a data da recusa vem da evidência da coleta (dd/mm/aaaa); o código da resposta e o desafio do navegador ficam em Analisar
  const dataRecusa = bloqueioRegulatorio ? /(\d{2}\/\d{2}\/\d{4})/.exec(bloqueioRegulatorio.evidencia)?.[1] ?? null : null;
  const refTecnica = g.proveniencia.tecnica_regulatoria.periodo_referencia;

  // as três comparações que a página poderia fazer, cada uma com o estado e a razão (perímetro, elegibilidade e bloqueio à vista)
  const comparacoes: ItemEstadoComparacao[] = [
    {
      id: "tecnico-entre-trechos",
      comparacao: "Mudança do percentual técnico entre trechos",
      estado: "disponivel",
      motivo: (
        <>
          {num(perimetro.comTrecho, 0)} de {num(perimetro.total, 0)} distribuidoras têm ao menos um trecho de 6 meses ou mais em que a razão entre a perda técnica e a energia injetada publicada fica constante: essa razão revela
          o percentual aplicado pela fonte, inferido pelo observatório e não lido do ato homologatório.
          {perimetro.fimMaisAntigo && perimetro.fimMaisRecente
            ? ` O trecho mais recente de cada uma termina em mês diferente, de ${mesAno(perimetro.fimMaisAntigo)} a ${mesAno(perimetro.fimMaisRecente)}: o período de cada ponto está na dica e na tabela.`
            : ""}
        </>
      ),
    },
    {
      id: "tecnico-realizado",
      comparacao: "Perda técnica realizada contra o percentual regulatório",
      estado: "nao-se-aplica",
      motivo: <>A perda técnica do SAMP é o próprio percentual regulatório do processo tarifário aplicado à energia injetada publicada, e não uma medição: a diferença entre as duas seria zero por construção.</>,
    },
    ...(bloqueioRegulatorio
      ? [
          {
            id: "nao-tecnica-realizada",
            comparacao: "Perda não técnica realizada contra a referência regulatória",
            estado: "indisponivel" as const,
            dados: { "data-bloqueio": "regulatorio" },
            motivo: (
              <>
                {semCodigosDePergunta(bloqueioRegulatorio.item)}: o relatório da ANEEL traz esses valores só em figuras, sem tabela, e os endereços da ANEEL que os publicam recusaram o acesso do observatório
                {dataRecusa ? ` em ${dataRecusa}` : ""}. Por isso a comparação do realizado com a referência regulatória não é feita, e nenhum valor de reserva é mostrado. O limite de perdas não técnicas está explicado em{" "}
                <Termo slug="percentual-regulatorio-de-perdas">percentual regulatório de perdas</Termo>, e a conferência com o relatório da ANEEL está no nível Auditar.
              </>
            ),
            detalhe: (
              <>
                <p>Evidência: {bloqueioRegulatorio.evidencia}</p>
                <p>Dependência: {bloqueioRegulatorio.dependencia}</p>
                <details>
                  <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-carvao-muted underline underline-offset-4">Endereços tentados ({bloqueioRegulatorio.tentativas.length})</summary>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-xs break-all text-carvao-muted">
                    {bloqueioRegulatorio.tentativas.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </details>
              </>
            ),
          },
        ]
      : []),
  ];

  const oQueMudou = (
    <>
      {num(perimetro.comResolucao, 0)} distribuidoras têm o trecho mais recente iniciado numa troca que coincide com o início de vigência de uma resolução homologatória; o mais recente termina em{" "}
      {mesAno(perimetro.fimMaisRecente ?? g.referencia.ultima_competencia)}.
    </>
  );
  const comoInterpretar = (
    <>
      O percentual é inferido da própria série do SAMP: onde a razão técnica ÷ injetada publicada fica constante por 6 meses ou mais, ela revela o percentual aplicado pela fonte. Losango vazado é
      o trecho anterior; círculo, o mais recente; a diferença é a mudança do parâmetro entre processos, não desempenho da distribuidora. No gráfico e na tabela, &quot;referência&quot; quer dizer o trecho
      anterior da própria distribuidora, e não uma meta regulatória.
    </>
  );
  const naoConcluir = (
    <>
      Que a distribuidora esteja acima ou abaixo da meta regulatória de perdas: a referência de não técnicas não está em base aberta. Que o percentual técnico seja perda física medida. Que a
      perda reconhecida deva ser zero: a ANEEL reconhece perdas técnicas em toda rede, e elas são inevitáveis no transporte da energia.
    </>
  );

  return (
    <>
      <CabecalhoEnergia atual="perdas" />
      <MarcaVisita secao="energia:perdas:regulatorio" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          siglas={["SAMP", "ANEEL", "IBGE"]}
          rotulo="Perdas de energia"
          titulo={PERGUNTA_REGULATORIO}
          lead={
            <>
              A ANEEL define, a cada revisão tarifária, os <Termo slug="percentual-regulatorio-de-perdas">percentuais regulatórios</Termo> de perdas técnicas e não técnicas que a tarifa reconhece. A página mostra como o percentual
              técnico mudou de um processo para o seguinte e diz o que não pode ser comparado com a perda realizada.
            </>
          }
          recorte={
            <>
              Trechos de {mesAno(refTecnica.inicio)} a {mesAno(refTecnica.fim)} · {num(perimetro.comTrecho, 0)} distribuidoras · % da energia injetada publicada
            </>
          }
          fonte="ANEEL, SAMP Balanço e Componentes Tarifárias"
          referencia={<ReferenciaPerdas g={g} />}
        >
          A ANEEL define, a cada revisão tarifária, os percentuais regulatórios de perdas técnicas e não técnicas que a tarifa reconhece. Esta página mostra como o percentual técnico mudou de um processo tarifário para
          o seguinte, em cada distribuidora. Ela não compara a perda realizada com a referência regulatória.
        </CabecalhoModulo>
        <PerdasNavegacao atual="regulatorio" />

        <ModoProfundidade>
          <PerdasLevaEscolha />
          <Bloco id="regulatorio">
            <PainelEvidencia
              id="painel-regulatorio"
              pergunta="O percentual técnico de cada distribuidora, trecho a trecho"
              subtitulo="Percentual técnico regulatório implícito no SAMP · % da energia injetada publicada · trechos de 6 meses ou mais"
              natureza="ESTIMADO"
              proveniencia={g.proveniencia.tecnica_regulatoria}
              porQueImporta={
                <>
                  A ANEEL define, em cada revisão tarifária, os percentuais regulatórios de perdas técnicas e não técnicas que a tarifa reconhece. Comparar o realizado com esses percentuais mostraria quanto da perda real a
                  tarifa reconhece; nesta publicação só o percentual técnico é observável, e a comparação com o realizado não é feita.
                </>
              }
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
            >
              <div className="space-y-6">
                <Resposta id="regulatorio" veredito={vereditoRegulatorio(regulatorio)}>
                  {respostaRegulatorio(regulatorio)}
                </Resposta>
                <PerdasRegulatorio
                  linhas={regulatorio}
                  urlEvidencias={g.series.evidencias_tecnica}
                  segmentos={segmentos}
                  ids={ids}
                  rotulos={rotulos}
                  versao={versao}
                  aposFigura={<EstadoDaComparacao titulo="O que esta página compara e o que não compara" itens={comparacoes} />}
                />
                <Recorte
                  periodo={`trechos de ${mesAno(refTecnica.inicio)} a ${mesAno(refTecnica.fim)}; até ${num(maxTrechos, 0)} mais recentes de cada distribuidora (os demais no CSV)`}
                  universo={`${regulatorio.length} distribuidoras com ao menos um trecho de 6 meses ou mais`}
                  unidade="% da energia injetada publicada"
                />
                <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />
                <PerdasSeguir
                  ancora="regulatorio"
                  proxima={{ pergunta: PERGUNTA_CUSTO, href: "/setor-eletrico/perdas/custo-e-contexto" }}
                  downloads={[{ rotulo: "Percentual técnico regulatório implícito (CSV)", url: "/energia/series/perdas_tecnicas_regulatorias.csv" }]}
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
