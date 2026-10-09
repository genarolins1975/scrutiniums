import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { RedeAviso, RedeCapitulos, RedeDatas, RedeDicionarios, RedeIndisponivel, RedeNavegacao, RedeSeguir } from "@/components/energia/RedePagina";
import { RedeProgramado, RedeProgramadoMetricas } from "@/components/energia/RedeProgramado";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, num } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import { curtoFronteira, ehFronteira, perguntaPainel, provenienciaLegivel, rotaPainel, situacaoAtualidade, textoConferenciaPdo } from "@/lib/energia/rede";
import type { GoldRedeDetalhe } from "@/lib/energia/tipos-rede";

export const dynamic = "force-static";
/** Descrição com o início do programado lido da gold (nenhuma data escrita à mão). */
export function generateMetadata(): Metadata {
  const g = lerGold<GoldRedeDetalhe>("rede_detalhe.json");
  const desde = integra(g) && g.programado.inicio ? `, desde ${dataBR(g.programado.inicio)}` : "";
  return {
    title: "Rede: quanto o fluxo se afastou do programa",
    description: `Intercâmbio verificado contra o programado (ONS) nas quatro fronteiras entre subsistemas e com Argentina e Uruguai${desde}: distribuição dos desvios, horas materiais, sentido oposto ao programa, maiores desvios e dias de programa repetido, com o programa do exterior conferido no PDO das conversoras.`,
    alternates: { canonical: "/setor-eletrico/rede/programado" },
  };
}

const FONTE = "ONS, intercâmbios entre subsistemas e com outros países, verificado e programado (releitura do módulo Rede)";

export default function RedeProgramadoPage() {
  const g = lerGold<GoldRedeDetalhe>("rede_detalhe.json");
  if (!integra(g)) return <RedeIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;
  const p = g.programado;
  const vp = p.versao_programa;
  const ev = g.evidencias;
  const atual = situacaoAtualidade(g.referencia.dia, g.gerado_em);
  const versao = g.referencia.dia;
  const downloads = g.downloads.filter((d) => /programado|pdo/.test(d.url));
  // a data em que o campo programado entrou no conjunto vem do próprio dicionário, nunca escrita à mão
  const versaoProg = g.achados.dicionarios.ons_rede_intercambio_nacional?.versoes.find((x) => /prog/.test(x.descricao)) ?? null;
  const evDesvio = Object.fromEntries(Object.entries(ev).filter(([k]) => k.startsWith("desvio_medio.")));
  const oQueMudou = (
    <>
      {atual.texto}{" "}
      {vp.revisoes_do_programado_entre_capturas === 0
        ? `O programado não mudou entre ${vp.capturas_comparadas ?? "as"} capturas comparadas.`
        : `O programado mudou entre capturas em ${num(vp.revisoes_do_programado_entre_capturas, 0)} valores.`}
    </>
  );
  const comoInterpretar = (
    <>
      Desvio é verificado menos programado, na mesma hora e no mesmo sentido do nome do par; o desvio absoluto ignora o sinal. A faixa mostra a mediana, os percentis 90 e 99 e o
      maior desvio de cada par: no percentil 90, por exemplo, 90% das horas têm desvio absoluto menor ou igual a esse valor. A linha marca o limiar material.
    </>
  );
  const naoConcluir = (
    <>
      Que o desvio foi falha, erro de previsão do ONS ou decisão errada: o programa é fechado antes da operação e a fonte não informa o motivo do afastamento. Também não se sabe
      qual revisão do programa das fronteiras foi publicada, e o histórico começa em {dataBR(p.inicio)}.
    </>
  );

  return (
    <>
      <CabecalhoEnergia atual="rede" />
      <MarcaVisita secao="energia:rede" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          siglas={["MWmed", "PDO", "SIN", "ONS"]}
          rotulo="Rede · Programado e verificado"
          titulo={perguntaPainel("p031")}
          lead="O fluxo medido em cada hora contra o programado antes da operação, nas quatro fronteiras entre subsistemas e nas trocas com Argentina e Uruguai. Desvio é diferença, não falha."
          recorte={`${dataBR(p.inicio)} a ${dataBR(p.fim)}, hora a hora · fronteiras e países · MWmed e MWh`}
          fonte="ONS, intercâmbio verificado e programado"
          referencia={
            <>
              ONS, intercâmbio verificado e programado de {dataBR(p.inicio)} a {dataBR(p.fim)}; processado em {carimbo(g.gerado_em)}.
            </>
          }
          datas={
            <RedeDatas
              itens={[
                { rotulo: "Verificado e programado", texto: `de ${dataBR(p.inicio)} a ${dataBR(p.fim)}`, natureza: g.proveniencia.programado.natureza },
                { rotulo: "Série diária", texto: p.diario.dias.length ? `de ${dataBR(p.diario.dias[0])} a ${dataBR(p.diario.dias[p.diario.dias.length - 1])}` : null, natureza: g.proveniencia.programado.natureza },
              ]}
            />
          }
          metricas={<RedeProgramadoMetricas programado={{ distribuicao: p.distribuicao, limiar_material_mwmed: p.limiar_material_mwmed, inicio: p.inicio, fim: p.fim }} evidencias={evDesvio} />}
        >
          O <Termo slug="intercambio">intercâmbio</Termo> programado é o fluxo que se esperava em cada hora antes da operação; o verificado é o fluxo medido. Os dois estão
          publicados lado a lado de {dataBR(p.inicio)} em diante
          {versaoProg ? ` (o campo do programado entrou na versão ${versaoProg.versao} do dicionário de dados do ONS, de ${versaoProg.data.replaceAll("-", "/")})` : ""}. Este painel mede quanto
          o verificado se afastou do programado em cada fronteira entre regiões e nas trocas com a Argentina e o Uruguai.
        </CabecalhoModulo>
        <RedeNavegacao atual="p031" />
        <ModoProfundidade>
          <Bloco id="programado">
            <PainelEvidencia
              id="p031"
              pergunta="O desvio de cada hora contra o programa"
              subtitulo="Desvio horário entre o intercâmbio verificado e o programado · MWmed por hora e MWh por dia"
              natureza="CALCULADO"
              porQueImporta={
                <>
                  O programa é o fluxo que se esperava em cada fronteira antes da operação; a distância até o verificado mostra quanto a operação real se afastou dele e em quais
                  horas, inclusive quando o fluxo correu no sentido contrário ao programado.
                </>
              }
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={provenienciaLegivel(g.proveniencia.programado)}
            >
              <div className="space-y-6">
                {atual.defasada && <RedeAviso tipo="alerta">{atual.texto}</RedeAviso>}
                <RedeProgramado
                  programado={{
                    distribuicao: p.distribuicao,
                    limiar_material_mwmed: p.limiar_material_mwmed,
                    limiares_sensibilidade_mwmed: p.limiares_sensibilidade_mwmed,
                    justificativa_limiar: p.justificativa_limiar,
                    programa_repetido: p.programa_repetido,
                    diario: p.diario,
                    mensal: p.mensal,
                    maiores_desvios: p.maiores_desvios,
                    maiores_desvios_fora_dos_dias_rotulados: p.maiores_desvios_fora_dos_dias_rotulados,
                    inicio: p.inicio,
                    fim: p.fim,
                  }}
                  evidencias={evDesvio}
                  fonte={FONTE}
                  versao={versao}
                  regraMaterialidade={g.regras.materialidade}
                  notas={<NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />}
                  aposPrincipal={<RedeCapitulos atual="p031" />}
                />

                <SecaoDoPainel id="programa-e-revisao" nivel="analisar" titulo="De onde vem o valor programado">
                  <p className="text-sm leading-relaxed text-carvao-muted">{vp.texto}</p>
                </SecaoDoPainel>

                <SecaoDoPainel id="pdo" nivel="auditar" titulo="Conferência do programa do exterior com o PDO das conversoras">
                  <p className="text-sm text-carvao-muted">{textoConferenciaPdo(p)}</p>
                  <p className="text-sm text-carvao-muted">
                    O PDO publica o valor de cada conversora por meia hora e com a importação positiva; a conferência usa menos a média das duas meias horas. Para as fronteiras entre
                    subsistemas não há programa por fronteira em outro conjunto público para a mesma conferência.
                  </p>
                  <RedeDicionarios dicionarios={[g.achados.dicionarios.ons_rede_pdo_conversoras, g.achados.dicionarios.ons_rede_intercambio_internacional].filter(Boolean)} />
                </SecaoDoPainel>

                <SecaoDoPainel id="maiores-sequencias" nivel="auditar" titulo="Sequências de programa repetido fora dos dias rotulados">
                  <p className="text-sm text-carvao-muted">
                    Maior sequência de horas seguidas com exatamente o mesmo valor programado, fora dos dias rotulados:{" "}
                    {Object.entries(p.programa_repetido.maior_sequencia_fora_dos_dias_rotulados)
                      .map(([k, n]) => `${ehFronteira(k) ? curtoFronteira(k) : k} ${n === null ? "sem dado" : `${n} ${n === 1 ? "hora" : "horas"}`}`)
                      .join("; ")}
                    . A regra rotula a partir de {p.programa_repetido.minimo_horas} horas.
                  </p>
                </SecaoDoPainel>

                <RedeSeguir ancora="p031" proximo={{ href: `${rotaPainel("p028")}#p028`, pergunta: perguntaPainel("p028") }} downloads={downloads} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
