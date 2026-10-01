import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { Termo } from "@/components/evidencia/Termo";
import { PerdasRegulatorio } from "@/components/energia/PerdasRegulatorio";
import { PerdasAuditoria } from "@/components/energia/PerdasAuditoria";
import { PerdasNavegacao, ReferenciaPerdas, RodapePainel, Recorte, Resposta } from "@/components/energia/PerdasPainel";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { integra, lerGold } from "@/lib/energia/gold";
import { dataBR, mesAno, num } from "@/lib/energia/formato";
import type { PerdasGold } from "@/lib/energia/tipos-perdas";
import { linhasRegulatorio, respostaRegulatorio, rotuloDistribuidora, segmentosPorDistribuidora } from "@/lib/energia/perdas";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Perdas: realizado e referência regulatória",
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
        <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6 py-14">
          <Indisponivel titulo="Perdas indisponíveis" motivo={g?.motivo ?? "Os dados processados de perdas não foram gerados nesta publicação."} />
        </main>
      </>
    );
  }

  const rotulos = Object.fromEntries(g.distribuidoras.map((d) => [d.cnpj, rotuloDistribuidora(d)]));
  const ids = g.distribuidoras.map((d) => d.cnpj);
  const versao = `SAMP até ${mesAno(g.referencia.ultima_competencia)}, gold de ${dataBR(g.gerado_em)}`;
  const regulatorio = linhasRegulatorio(g.distribuidoras);
  const bloqueioRegulatorio = g.bloqueios.find((b) => b.item.includes("P057")) ?? null;
  const segmentos = segmentosPorDistribuidora(g.distribuidoras);
  // quantos trechos a gold traz por distribuidora (os demais ficam no CSV), lido dos dados
  const maxTrechos = Math.max(0, ...Object.values(segmentos).map((s) => s.length));

  return (
    <>
      <CabecalhoEnergia atual="perdas" />
      <MarcaVisita secao="energia:perdas:regulatorio" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6">
        <CabecalhoModulo
          rotulo="Perdas de energia · realizado e regulatório"
          titulo="Quanto o realizado diverge da referência regulatória?"
          referencia={<ReferenciaPerdas g={g} />}
        >
          A ANEEL define, a cada revisão tarifária, os <Termo slug="percentual-regulatorio-de-perdas">percentuais regulatórios</Termo> de perdas técnicas e não técnicas que a tarifa reconhece.
          Comparar a perda realizada com eles diz quanto da perda a tarifa cobre; a referência de perdas não técnicas não está no portal de dados abertos e os endereços da ANEEL que a publicam
          recusaram o acesso automatizado, e a página mostra o que dá para medir e o que está bloqueado.
        </CabecalhoModulo>
        <PerdasNavegacao atual="regulatorio" />

        <ModoProfundidade>
          <Bloco id="regulatorio">
            <PainelEvidencia
              id="painel-regulatorio"
              pergunta="Quanto o realizado diverge da referência regulatória?"
              subtitulo="Percentual técnico regulatório implícito no SAMP · % da energia injetada publicada · trechos de 6 meses ou mais"
              natureza="ESTIMADO"
              proveniencia={g.proveniencia.tecnica_regulatoria}
              porQueImporta={
                <>
                  A ANEEL define, em cada revisão tarifária, os percentuais regulatórios de perdas técnicas e não técnicas que a tarifa reconhece. A distância entre o realizado e esses percentuais diz quanto
                  da perda real a tarifa cobre.
                </>
              }
              oQueMudou={
                <>
                  {regulatorio.filter((l) => l.troca_pp !== null && l.resolucao).length} distribuidoras têm o trecho mais recente iniciado numa troca que coincide com o início de vigência de uma resolução
                  homologatória; o mais recente termina em {mesAno(regulatorio.map((l) => l.fim).sort().at(-1) ?? g.referencia.ultima_competencia)}.
                </>
              }
              comoInterpretar={
                <>
                  O percentual é inferido da própria série do SAMP: onde a razão técnica ÷ injetada publicada fica constante por 6 meses ou mais, ela revela o percentual aplicado pela fonte. Losango vazado é
                  o trecho anterior; círculo, o mais recente; a diferença é a mudança do parâmetro entre processos, não desempenho da distribuidora.
                </>
              }
              naoConcluir={
                <>
                  Que a distribuidora esteja acima ou abaixo da meta regulatória de perdas: a referência de não técnicas não está em base aberta. Que o percentual técnico seja perda física medida. Que a
                  perda reconhecida deva ser zero: a ANEEL reconhece um nível eficiente de perdas técnicas em toda rede.
                </>
              }
            >
              {bloqueioRegulatorio && (
                <div className="mb-5 border border-erro bg-papel px-4 py-3 text-sm text-carvao" data-bloqueio="regulatorio">
                  <p className="rotulo text-erro">Bloqueado em parte: comparação do realizado com a referência regulatória</p>
                  <p className="mt-1 leading-relaxed">
                    {bloqueioRegulatorio.item}. Evidência: {bloqueioRegulatorio.evidencia}
                  </p>
                  <p className="mt-1 leading-relaxed">Dependência: {bloqueioRegulatorio.dependencia}</p>
                  <details className="mt-1">
                    <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-carvao-muted underline underline-offset-4">
                      Endereços tentados ({bloqueioRegulatorio.tentativas.length})
                    </summary>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-xs break-all text-carvao-muted">
                      {bloqueioRegulatorio.tentativas.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  </details>
                </div>
              )}
              <Resposta>{respostaRegulatorio(regulatorio, !!bloqueioRegulatorio)}</Resposta>
              <Recorte
                periodo={`trechos de ${mesAno(g.proveniencia.tecnica_regulatoria.periodo_referencia.inicio)} a ${mesAno(g.proveniencia.tecnica_regulatoria.periodo_referencia.fim)}; até ${num(maxTrechos, 0)} mais recentes de cada distribuidora (os demais no CSV)`}
                universo={`${regulatorio.length} distribuidoras com ao menos um trecho de 6 meses ou mais`}
                unidade="% da energia injetada publicada"
              />
              <PerdasRegulatorio
                linhas={regulatorio}
                urlEvidencias={g.series.evidencias_tecnica}
                segmentos={segmentos}
                ids={ids}
                rotulos={rotulos}
                versao={versao}
              />
              <RodapePainel
                ancora="regulatorio"
                proxima={{ pergunta: "Quanto as perdas pesam na tarifa residencial?", href: "/setor-eletrico/perdas/custo-e-contexto" }}
                downloads={[{ rotulo: "Percentual técnico regulatório implícito (CSV)", url: "/energia/series/perdas_tecnicas_regulatorias.csv" }]}
              />
            </PainelEvidencia>
          </Bloco>

          <PerdasAuditoria g={g} />
        </ModoProfundidade>
      </main>
    </>
  );
}
