import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { Numero } from "@/components/energia/Numero";
import { RedeAviso, RedeCapitulos, RedeDatas, RedeDicionarios, RedeDocumentos, RedeIndisponivel, RedeNavegacao, RedeRegras, RedeSeguir } from "@/components/energia/RedePagina";
import { RedeRestricoes } from "@/components/energia/RedeRestricoes";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, mesAno, num } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import { COLUNAS_BUSCA, ROTULO_REGRA, linhasBuscaLimites, medidasRestricoes, mesesEntre, perguntaPainel, provenienciaLegivel, rotaPainel, situacaoAtualidade } from "@/lib/energia/rede";
import type { GoldRedeDetalhe } from "@/lib/energia/tipos-rede";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Rede: evidência publicada de limitação",
  description:
    "Horas em que fluxos sistêmicos ficaram acima do limite estabelecido (indicador ATLS do ONS), cortes de carga e energia não suprida por ano e por perturbação, e a busca documentada pelos limites operativos de intercâmbio, que não são públicos.",
  alternates: { canonical: "/setor-eletrico/rede/restricoes" },
};

export default function RedeRestricoesPage() {
  const g = lerGold<GoldRedeDetalhe>("rede_detalhe.json");
  if (!integra(g)) return <RedeIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;
  const r = g.restricoes;
  const a6 = g.achados.A06;
  const ev = g.evidencias;
  const atual = situacaoAtualidade(g.referencia.dia, g.gerado_em);
  const versao = g.referencia.dia;
  const downloads = g.downloads.filter((d) => /atls|interrupcoes/.test(d.url));
  const evAtls = Object.fromEntries(Object.entries(ev).filter(([k]) => k.startsWith("atls_12m.")));
  // o ATLS é mensal: defasagem medida em meses entre o último mês publicado e o mês do processamento
  const mesProc = g.gerado_em.slice(0, 7);
  const defasagemAtls = r.atls.ultimo_mes ? mesesEntre(r.atls.ultimo_mes, mesProc) : null;
  // regras de contagem citadas do documento (trechos conferidos no arquivo), nunca reescritas à mão
  const trechosSubmodulo = r.documentos.ons_submodulo_9_1.trechos.filter((t) => t.confere && t.id !== "atls_definicao").map((t) => t.texto);
  // a faixa lê o mesmo arquivo do ATLS do gráfico de barras, da tabela e da exportação
  const m = medidasRestricoes(r);
  const fichaMaisHoras = m.maisHoras ? (ev[`atls_12m.${m.maisHoras.fluxo}`] ?? null) : null;
  const u12 = r.interrupcoes.ultimos_12_meses;
  const oQueMudou = (
    <>
      {atual.texto}{" "}
      {defasagemAtls !== null
        ? `O ATLS é mensal: o último mês publicado (${mesAno(r.atls.ultimo_mes!)}) está ${defasagemAtls === 1 ? "um mês" : `${defasagemAtls} meses`} antes do mês do processamento.`
        : "O arquivo do ATLS não trouxe mês publicado."}
    </>
  );
  const comoInterpretar = (
    <>
      O ONS publica o ATLS como fração do tempo dentro da faixa e as horas fora dela; o painel soma as horas dos 12 meses publicados mais recentes. Pelo Submódulo 9.1 dos
      Procedimentos de Rede: {trechosSubmodulo.map((t) => `“${t}”`).join("; ")}. As siglas dos fluxos são do ONS; a definição aparece só quando conferida em documento público.
    </>
  );
  const naoConcluir = (
    <>
      Quanto de cada fronteira estava ocupado: nenhum percentual de utilização é calculado, e capacidade nominal de linha não substitui limite de transferência entre regiões. O
      ATLS não diz o valor do limite nem a folga; um corte de carga não prova limite de intercâmbio.
    </>
  );

  return (
    <>
      <CabecalhoEnergia atual="rede" />
      <MarcaVisita secao="energia:rede" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          siglas={["SIN", "ONS", "CCEE", "ATLS"]}
          rotulo="Rede · Restrições publicadas"
          titulo={perguntaPainel("p030")}
          lead="Horas em que fluxos acompanhados pelo ONS ficaram acima do limite estabelecido (indicador ATLS, Atendimento aos Limites Sistêmicos) e cortes de carga."
          recorte={`${m.fluxosAcima ? `ATLS de ${m.fluxosAcima.periodo}` : "ATLS"} · cortes de carga de ${dataBR(u12.inicio)} a ${dataBR(u12.fim)} · horas e MWh`}
          fonte="ONS, ATLS e Interrupção de Carga"
          referencia={
            <>
              ONS, indicador ATLS até {r.atls.ultimo_mes ? mesAno(r.atls.ultimo_mes) : "sem dado"} e interrupções de carga até {dataBR(r.interrupcoes.fim)}; processado em{" "}
              {carimbo(g.gerado_em)}.
            </>
          }
          datas={
            <RedeDatas
              itens={[
                { rotulo: "Indicador ATLS (mensal)", texto: r.atls.ultimo_mes ? `até ${mesAno(r.atls.ultimo_mes)}` : null, natureza: g.proveniencia.atls.natureza },
                { rotulo: "Cortes de carga", texto: `até ${dataBR(r.interrupcoes.fim)}`, natureza: g.proveniencia.interrupcoes.natureza },
              ]}
            />
          }
          metricas={
            <FaixaMetricas
              colunas={3}
              rotulo="Fluxos acima do limite em 12 meses e energia não suprida em cortes de carga"
              nota="Horas acima do limite e cortes de carga são as evidências públicas de limitação; nenhum percentual de utilização é calculado, porque os limites operativos de cada fronteira não são públicos."
            >
              {m.fluxosAcima && (
                <Numero
                  variante="faixa"
                  rotulo="Fluxos acompanhados que passaram algum tempo acima do limite em 12 meses"
                  natureza="CALCULADO"
                  valor={m.fluxosAcima.valor}
                  formato="num"
                  casas={0}
                  unidade={`de ${m.fluxosAcima.de} fluxos`}
                  periodo={m.fluxosAcima.periodo}
                  cor="var(--cor-energia)"
                  nota="Fluxos publicados no último mês do arquivo do ATLS."
                />
              )}
              {m.maisHoras && (
                <Numero
                  variante="faixa"
                  rotulo={`Mais horas acima do limite em 12 meses: ${m.maisHoras.nome}`}
                  natureza="CALCULADO"
                  valor={fichaMaisHoras ? undefined : m.maisHoras.horas}
                  evidencia={fichaMaisHoras}
                  casas={1}
                  unidade="h"
                  periodo={m.maisHoras.periodo}
                  cor="var(--cor-energia)"
                  nota={`Sigla do ONS: ${m.maisHoras.fluxo}.`}
                  endereco={`${rotaPainel("p030")}#p030`}
                />
              )}
              <Numero
                variante="faixa"
                rotulo="Energia não suprida em cortes de carga, 12 meses"
                natureza="CALCULADO"
                evidencia={ev.ens_12m ?? null}
                casas={1}
                periodo={`${dataBR(u12.inicio)} a ${dataBR(u12.fim)}`}
                cor="var(--serie-5)"
                nota={`${num(u12.registros, 0)} registros de corte em ${num(u12.perturbacoes, 0)} perturbações (uma perturbação pode ter mais de um registro).`}
                endereco={`${rotaPainel("p030")}#p030`}
              />
            </FaixaMetricas>
          }
        >
          Os limites operativos de intercâmbio e as suas vigências não são públicos em formato que permita compará-los com o fluxo de cada hora; por isso este painel não diz
          se uma fronteira estava no limite. Ele mostra a evidência de limitação que o ONS publica: o tempo em que fluxos acompanhados pelo indicador{" "}
          <Termo slug="atls">ATLS</Termo> (Atendimento aos Limites Sistêmicos) ficaram acima do limite estabelecido, e os cortes de carga, que são registros de interrupção do
          atendimento, com a energia não suprida, isto é, a que deixou de ser entregue.
        </CabecalhoModulo>
        <RedeNavegacao atual="p030" />
        <ModoProfundidade>
          <Bloco id="restricoes">
            <PainelEvidencia
              id="p030"
              pergunta="Horas acima do limite e cortes de carga publicados"
              subtitulo="Horas acima do limite sistêmico (ATLS, Atendimento aos Limites Sistêmicos) e cortes de carga · horas e MWh"
              natureza="CALCULADO"
              porQueImporta={
                <>
                  O <Termo slug="atls">ATLS</Termo> mede, mês a mês, quanto tempo cada fluxo acompanhado pelo ONS passou fora da faixa de segurança recomendada; o corte de carga
                  mede energia que deixou de chegar ao consumidor. São as evidências públicas de limitação que existem sem os limites de cada fronteira.
                </>
              }
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={provenienciaLegivel(g.proveniencia.atls)}
              complementares={[{ rotulo: "Interrupções de carga e energia não suprida", p: provenienciaLegivel(g.proveniencia.interrupcoes) }]}
            >
              <div className="space-y-6">
                {atual.defasada && <RedeAviso tipo="alerta">{atual.texto}</RedeAviso>}
                <RedeRestricoes
                  restricoes={{ atls: r.atls, interrupcoes: r.interrupcoes }}
                  evidencias={evAtls}
                  titulosDocumentos={Object.fromEntries(Object.entries(r.documentos).map(([k, d]) => [k, d.titulo]))}
                  criterioCorte={g.achados.dicionarios.ons_rede_interrupcao_carga?.trechos.find((t) => t.id === "criterio" && t.confere)?.texto ?? null}
                  fonteAtls="ONS, Indicadores de confiabilidade da rede básica: ATLS"
                  fonteInterrupcoes="ONS, Interrupção de Carga"
                  versao={versao}
                  limites={
                    <div className="space-y-2 border border-dashed border-linha p-4">
                      <p className="rotulo text-mineral">Limites operativos de intercâmbio: sem fonte aberta</p>
                      <p className="max-w-prose2 text-sm leading-relaxed text-carvao">{r.limites.conclusao}</p>
                    </div>
                  }
                  limitesDetalhe={
                    <div data-nivel="analisar" className="space-y-3 border-l-2 border-linha pl-4">
                      <p className="text-sm text-carvao-muted">Estado da verificação dos limites operativos: {a6.status}.</p>
                      <TabelaInterativa
                        titulo="Onde os limites foram procurados e o que se encontrou"
                        colunas={COLUNAS_BUSCA}
                        linhas={linhasBuscaLimites(r.limites.busca)}
                        chaveLinha="id"
                        colunaRotulo="onde"
                        fonte="Busca do observatório em fontes públicas do ONS e da CCEE"
                        versao={versao}
                        nomeArquivo="rede-busca-limites"
                        chaveUrl="bl"
                      />
                    </div>
                  }
                  notas={<NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />}
                  aposPrincipal={<RedeCapitulos atual="p030" />}
                />

                <SecaoDoPainel id="documentos" nivel="auditar" titulo="Documentos públicos do ONS: trechos conferidos">
                  <p className="text-sm text-carvao-muted">
                    Direitos reservados ao ONS: só trechos citados, cada um conferido literalmente no arquivo baixado. O limite citado no relatório técnico depende da
                    configuração da rede e não é série com vigência; por isso não é comparado com o fluxo de nenhuma hora.
                  </p>
                  <RedeDocumentos documentos={[r.documentos.ons_submodulo_9_1, r.documentos.ons_pel_2019_2020, r.documentos.ons_rt_dpl_0131_2023]} />
                </SecaoDoPainel>

                <SecaoDoPainel id="dicionarios-restricoes" nivel="auditar" titulo="Dicionários de dados: ATLS, interrupções e intercâmbio">
                  <p className="text-sm text-carvao-muted">
                    Unidade do ATLS lida no arquivo: {r.atls.unidade_publicada} (maior valor lido {num(r.atls.maior_valor_lido, 3)}, menor {num(r.atls.menor_valor_lido, 3)}). O
                    painel usa as horas acima do limite, que não dependem dessa leitura.
                  </p>
                  <RedeDicionarios
                    dicionarios={[g.achados.dicionarios.ons_rede_atls, g.achados.dicionarios.ons_rede_interrupcao_carga, g.achados.dicionarios.ons_rede_intercambio_nacional].filter(Boolean)}
                  />
                  {a6.trecho_dicionario && (
                    <p className="text-sm text-carvao-muted">
                      O dicionário do conjunto de intercâmbio remete a relação das linhas de transmissão de fronteira ao &ldquo;{a6.trecho_dicionario.texto}&rdquo; (
                      {a6.trecho_dicionario.confere ? "trecho conferido" : "trecho não conferido"}), no Portal SINtegre do ONS, de acesso autenticado; nenhum conjunto aberto traz os
                      limites com vigência.
                    </p>
                  )}
                </SecaoDoPainel>

                <SecaoDoPainel id="metodologia-a06" nivel="auditar" titulo="Nota de revisão sobre a página de metodologia">
                  <p className="text-sm text-carvao-muted">{a6.correcao_metodologia}</p>
                  <RedeRegras regras={[{ rotulo: ROTULO_REGRA.limites, texto: g.regras.limites }]} />
                </SecaoDoPainel>

                <RedeSeguir ancora="p030" proximo={{ href: `${rotaPainel("p031")}#p031`, pergunta: perguntaPainel("p031") }} downloads={downloads} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
