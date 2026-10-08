import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco } from "@/components/energia/CabecalhoModulo";
import { PldHistorico } from "@/components/energia/PldHistorico";
import { PldAuditoria, PldAviso, PldCabecalho, PldControles, PldIndisponivel, PldNavegacao, PldSeguir } from "@/components/energia/PldPagina";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, horaLocal, mesAno, num } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import {
  COLUNAS_PERIMETROS,
  COLUNAS_REVISOES_CARGA,
  SUBMERCADOS,
  atualidadePld,
  linhasPerimetros,
  linhasRevisoesCarga,
  marcosPerimetro,
  perguntaPainel,
  proximoPainel,
  textoComparabilidade,
  textoSensibilidadePeso,
} from "@/lib/energia/pld";
import { fichasPld } from "@/lib/energia/pld-arquivos";
import type { PldDetalheGold } from "@/lib/energia/tipos-pld";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "PLD: histórico e distribuição",
  description:
    "O PLD do dia comparado com o mesmo mês e a mesma semana de anos anteriores, médias mensais temporal e ponderadas pela carga com o perímetro do peso declarado, moeda constante, distribuição por regime anual de limites, perfil hora × mês e mapa hora × dia.",
  alternates: { canonical: "/setor-eletrico/pld/historico" },
};

const FONTE = "CCEE, PLD horário por submercado; ONS, Balanço de Energia e Carga Verificada; IBGE, IPCA";

export default function PldHistoricoPage() {
  const g = lerGold<PldDetalheGold>("pld_detalhe.json");
  if (!integra(g)) return <PldIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;
  const h = g.historico;
  const pond = h.ponderacao;
  const atual = atualidadePld(g.referencia.dia, g.gerado_em);
  const versao = g.referencia.dia;
  const mesFichas = pond.sensibilidade_peso?.mes ?? null;
  const fichas = mesFichas ? fichasPld(g.evidencias.arquivo, SUBMERCADOS.flatMap((sm) => [`ponderada_${mesFichas}_${sm}`, `ponderada_sem_mmgd_${mesFichas}_${sm}`])) : {};
  const anoRef = Number(g.referencia.dia.slice(0, 4));
  const retiradas = [...pond.horas_retiradas, ...pond.peso_sem_mmgd.horas_retiradas];

  return (
    <>
      <CabecalhoEnergia atual="pld" />
      <MarcaVisita secao="energia:pld" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6">
        <PldCabecalho siglas={["MMGD", "IPCA", "CCEE", "ONS", "IBGE"]}
          titulo="Histórico e distribuição"
          referencia={
            <>
              CCEE (PLD até {horaLocal(g.referencia.ultima_hora_pld)}), ONS (carga do balanço até {g.referencia.ultima_hora_carga ? horaLocal(g.referencia.ultima_hora_carga) : "sem dado"}) e IBGE
              (IPCA até {g.referencia.ultimo_mes_ipca ? mesAno(g.referencia.ultimo_mes_ipca) : "sem dado"}); processado em {carimbo(g.gerado_em)}.
            </>
          }
        >
          O mesmo <Termo slug="pld">PLD</Termo> pode parecer alto ou baixo conforme a régua: o mesmo mês de anos anteriores, a média de todas as horas ou a média que pesa mais as
          horas de maior consumo. Este painel mostra as réguas lado a lado, cada uma com o nome.
        </PldCabecalho>
        <PldNavegacao atual="p011" />
        <ModoProfundidade>
          <Bloco id="historico">
            <PainelEvidencia
              id="p011"
              pergunta={perguntaPainel("p011")}
              subtitulo="Média diária frente ao mesmo mês e à mesma semana de anos anteriores; médias mensais temporal e ponderadas pela carga · R$/MWh"
              porQueImporta={
                <>
                  O PLD tem forte componente sazonal (chuva e reservatórios) e regimes de limites que mudam a cada ano. Comparar com a mesma época de anos anteriores evita chamar de
                  alto um preço comum para o mês, e separar a média temporal da ponderada pela carga evita misturar duas perguntas diferentes.
                </>
              }
              oQueMudou={
                <>
                  {atual.texto} {pond.sensibilidade_peso ? textoSensibilidadePeso(pond.sensibilidade_peso) : ""}
                </>
              }
              comoInterpretar={
                <>
                  O percentil diz em que posição a média do dia fica entre as médias diárias do mesmo mês (e da mesma semana do ano, na numeração ISO) nos anos anteriores: 50 é o meio. A média temporal
                  dá o mesmo peso a cada hora; a ponderada pela carga dá mais peso às horas de maior consumo. A ponderada pelo balanço muda de base dentro da série (as marcas no
                  gráfico mostram quando); a ponderada sem MMGD usa a mesma base em toda a série.
                </>
              }
              naoConcluir={
                <>
                  Percentil alto não é previsão de queda, nem baixo de alta. A série começa em 2021: são no máximo cinco anos anteriores, cada um com piso e tetos próprios. A média
                  ponderada usa a carga do sistema publicada pelo ONS, não o consumo contabilizado pela CCEE, e não é o preço pago por nenhum consumidor.
                </>
              }
              proveniencia={g.proveniencia.historico_mensal}
              complementares={[
                { rotulo: "Sobre o peso: carga do balanço", p: g.proveniencia.peso_carga_balanco },
                ...(g.proveniencia.peso_carga_sem_mmgd ? [{ rotulo: "Sobre o peso: carga sem MMGD", p: g.proveniencia.peso_carga_sem_mmgd }] : []),
                { rotulo: "Sobre os percentis sazonais", p: g.proveniencia.sazonal },
                { rotulo: "Sobre a distribuição e os mapas", p: g.proveniencia.distribuicao },
              ]}
            >
              <div className="space-y-6">
                {atual.defasada && <PldAviso tipo="alerta">{atual.texto}</PldAviso>}
                {g.referencia.ultima_hora_carga && g.referencia.ultima_hora_carga < g.referencia.ultima_hora_pld && (
                  <div data-nivel="analisar">
                    <PldAviso>
                      A carga do balanço do ONS vai até {horaLocal(g.referencia.ultima_hora_carga)} e a carga verificada sem MMGD até{" "}
                      {pond.peso_sem_mmgd.ultima_hora ? horaLocal(pond.peso_sem_mmgd.ultima_hora) : "sem dado"}; o PLD, até {horaLocal(g.referencia.ultima_hora_pld)}. No mês em curso, as
                      ponderadas usam só as horas com carga publicada (coluna &ldquo;mesmas horas&rdquo; da tabela) e podem mudar com as próximas publicações e revisões do ONS.
                    </PldAviso>
                  </div>
                )}
                <PldHistorico
                  h={{
                    mensal: h.mensal,
                    sazonal_mes: h.sazonal_mes,
                    posicao_referencia: h.posicao_referencia,
                    mes_corrente: h.mes_corrente,
                    regimes: h.regimes,
                    perfil_hora_mes: h.perfil_hora_mes,
                    hora_dia: h.hora_dia,
                    deflator: h.deflator,
                  }}
                  marcos={marcosPerimetro(h)}
                  mesFichas={mesFichas}
                  fichas={fichas}
                  anoReferencia={anoRef}
                  diaReferencia={g.referencia.dia}
                  fonte={FONTE}
                  versao={versao}
                />

                <PldAuditoria id="peso" titulo="O peso da média ponderada: perímetro, quebras e conferência">
                  <p className="text-sm leading-relaxed text-carvao">Peso da ponderada pelo balanço: {pond.peso.replace(" (ver perimetros)", " (tabela de perímetros abaixo)")}.</p>
                  <p className="text-sm leading-relaxed text-carvao">Peso da ponderada sem MMGD: {pond.peso_sem_mmgd.disponivel ? pond.peso_sem_mmgd.peso : `indisponível (${pond.peso_sem_mmgd.motivo ?? "sem motivo publicado"})`}.</p>
                  <p className="text-sm leading-relaxed text-carvao-muted" data-textos="comparabilidade">{textoComparabilidade(h)}</p>
                  <p className="text-sm leading-relaxed text-carvao-muted">{pond.ressalva}</p>
                  <TabelaInterativa
                    titulo="Perímetros da carga do balanço declarados pelo ONS e a conferência contra a carga verificada"
                    colunas={COLUNAS_PERIMETROS}
                    linhas={linhasPerimetros(h)}
                    chaveLinha="id"
                    colunaRotulo="perimetro"
                    fonte="ONS, descrição do conjunto Carga de Energia; API de carga verificada"
                    versao={versao}
                    nomeArquivo="pld-perimetros-carga"
                  />
                  <ul className="list-disc space-y-1 pl-5 text-sm text-carvao-muted">
                    {pond.quebras.map((q) => (
                      <li key={q.data}>
                        {dataBR(q.data)} ({q.de} para {q.para}): {q.descricao} {q.inicio_observado_no_balanco ? `Início observado no dado horário: ${dataBR(q.inicio_observado_no_balanco)}. ` : ""}
                        {q.nota}
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm text-carvao-muted">
                    Conferência mês a mês: {pond.conferencia_perimetro.disponivel ? `${num(pond.conferencia_perimetro.meses_divergentes.length, 0)} meses-subsistema divergentes do perímetro declarado. ` : `indisponível (${pond.conferencia_perimetro.motivo}). `}
                    {pond.conferencia_perimetro.metodo}
                  </p>
                  <p className="text-xs text-carvao-muted">{pond.fonte_perimetro.nota}</p>
                </PldAuditoria>

                <PldAuditoria id="revisoes" titulo="Revisões da carga e o efeito na ponderada">
                  <p className="text-sm text-carvao-muted">{pond.controle_fisico}</p>
                  {retiradas.length > 0 ? (
                    <PldAviso tipo="alerta">
                      Horas retiradas do peso por carga menor ou igual a zero: {retiradas.map((r) => `${r.sm} em ${mesAno(r.mes)}, ${num(r.horas, 0)} horas`).join("; ")}.
                    </PldAviso>
                  ) : (
                    <p className="text-sm text-carvao-muted">Nenhuma hora retirada do peso na publicação vigente.</p>
                  )}
                  <TabelaInterativa
                    titulo="Revisões da carga do balanço entre capturas, por subsistema e mês"
                    colunas={COLUNAS_REVISOES_CARGA}
                    linhas={linhasRevisoesCarga(h)}
                    chaveLinha="id"
                    colunaRotulo="mes"
                    fonte="ONS, Balanço de Energia nos Subsistemas (capturas do observatório)"
                    versao={versao}
                    nomeArquivo="pld-revisoes-carga"
                    semLinhas="Nenhuma revisão da carga detectada entre as capturas integradas."
                  />
                </PldAuditoria>

                <PldAuditoria id="deflator" titulo="Moeda constante">
                  <p className="text-sm text-carvao-muted">
                    {h.deflator.indice}. {h.deflator.regra} Mês-base: {h.deflator.mes_base ? mesAno(h.deflator.mes_base) : "sem índice"}
                    {h.deflator.indice_base !== null ? ` (índice ${num(h.deflator.indice_base, 2)})` : ""}. O IPCA mede preços ao consumidor; a moeda constante é perspectiva
                    adicional, não substitui o valor nominal.
                  </p>
                </PldAuditoria>

                <PldAuditoria id="controles" titulo="Controles automáticos da construção">
                  <PldControles controles={g.controles.filter((x) => /carga|Perímetro|peso/i.test(x.nome))} />
                </PldAuditoria>

                <PldSeguir ancora="p011" proximo={proximoPainel("p011")} downloads={g.downloads.filter((d) => /mensal|sazonal|hora_dia|cmo_horario/.test(d.url))} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
