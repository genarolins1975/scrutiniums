import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { Numero } from "@/components/energia/Numero";
import { RedeAuditoria, RedeAviso, RedeDicionarios, RedeDocumentos, RedeIndisponivel, RedeNavegacao, RedeRegras, RedeSeguir } from "@/components/energia/RedePagina";
import { RedeRestricoes } from "@/components/energia/RedeRestricoes";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, mesAno, num, rotuloRegra } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import { COLUNAS_BUSCA, linhasBuscaLimites, mesesEntre, perguntaPainel, rotaPainel, situacaoAtualidade } from "@/lib/energia/rede";
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

  return (
    <>
      <CabecalhoEnergia atual="rede" />
      <MarcaVisita secao="energia:rede" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-4 sm:px-6">
        <CabecalhoModulo
          rotulo="Rede · Restrições publicadas"
          titulo={perguntaPainel("p030")}
          referencia={
            <>
              ONS, indicador ATLS até {r.atls.ultimo_mes ? mesAno(r.atls.ultimo_mes) : "sem dado"} e interrupções de carga até {dataBR(r.interrupcoes.fim)}; processado em{" "}
              {carimbo(g.gerado_em)}.
            </>
          }
        >
          A pergunta original era se o fluxo de cada fronteira chegou ao seu limite. Os limites operativos de intercâmbio e as suas vigências não são públicos em formato que
          permita comparar com o fluxo de cada hora, então este painel responde a pergunta que os dados públicos sustentam: quando o ONS publicou evidência de limitação, pelo tempo
          em que fluxos acompanhados ficaram acima do limite e pelos cortes de carga.
        </CabecalhoModulo>
        <RedeNavegacao atual="p030" />
        <ModoProfundidade>
          <Bloco id="restricoes">
            <PainelEvidencia
              id="p030"
              pergunta={perguntaPainel("p030")}
              subtitulo="Horas acima do limite sistêmico (ATLS) e cortes de carga · horas e MWh"
              natureza="CALCULADO"
              porQueImporta={
                <>
                  O <Termo slug="atls">ATLS</Termo> mede, mês a mês, quanto tempo cada fluxo acompanhado pelo ONS passou fora da faixa de segurança recomendada; o corte de carga
                  mede energia que deixou de chegar ao consumidor. São as evidências públicas de limitação que existem sem os limites de cada fronteira.
                </>
              }
              oQueMudou={
                <>
                  {atual.texto}{" "}
                  {defasagemAtls !== null
                    ? `O ATLS é mensal: o último mês publicado (${mesAno(r.atls.ultimo_mes!)}) está ${defasagemAtls === 1 ? "um mês" : `${defasagemAtls} meses`} antes do mês do processamento.`
                    : "O arquivo do ATLS não trouxe mês publicado."}
                </>
              }
              comoInterpretar={
                <>
                  O ONS publica o ATLS como fração do tempo dentro da faixa e as horas fora dela; o painel soma as horas dos 12 meses publicados mais recentes. Pelo Submódulo 9.1
                  dos Procedimentos de Rede: {trechosSubmodulo.map((t) => `“${t}”`).join("; ")}. As siglas dos fluxos são do ONS; a definição aparece só quando conferida em
                  documento público.
                </>
              }
              naoConcluir={
                <>
                  Quanto de cada fronteira estava ocupado: nenhum percentual de utilização é calculado, e capacidade nominal de linha não substitui limite de transferência entre
                  regiões. O ATLS não diz o valor do limite nem a folga; um corte de carga não prova limite de intercâmbio.
                </>
              }
              proveniencia={g.proveniencia.atls}
              complementares={[{ rotulo: "Interrupções de carga e energia não suprida", p: g.proveniencia.interrupcoes }]}
            >
              <div className="space-y-6">
                {atual.defasada && <RedeAviso tipo="alerta">{atual.texto}</RedeAviso>}
                <div className="space-y-3 border border-dashed border-linha p-4">
                  <p className="rotulo text-mineral">Limites operativos de intercâmbio: bloqueio documentado (achado A06)</p>
                  <p className="text-sm leading-relaxed text-carvao">{r.limites.conclusao}</p>
                  <p className="text-sm text-carvao-muted">Estado do achado: {a6.status}.</p>
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

                <RedeRestricoes
                  restricoes={{ atls: r.atls, interrupcoes: r.interrupcoes }}
                  evidencias={evAtls}
                  fonteAtls="ONS, Indicadores de confiabilidade da rede básica: ATLS"
                  fonteInterrupcoes="ONS, Interrupção de Carga"
                  versao={versao}
                  destaques={
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Numero
                        rotulo="Energia não suprida em cortes de carga, 12 meses"
                        natureza="CALCULADO"
                        evidencia={ev.ens_12m ?? null}
                        casas={1}
                        tamanho="medio"
                        cor="var(--cor-energia)"
                        nota={`${num(r.interrupcoes.ultimos_12_meses.registros, 0)} registros em ${num(r.interrupcoes.ultimos_12_meses.perturbacoes, 0)} perturbações.`}
                        endereco={`${rotaPainel("p030")}#p030`}
                      />
                    </div>
                  }
                />

                <RedeAuditoria id="documentos" titulo="Documentos públicos do ONS: trechos conferidos">
                  <p className="text-sm text-carvao-muted">
                    Direitos reservados ao ONS: só trechos citados, cada um conferido literalmente no arquivo baixado. O limite citado no relatório técnico depende da
                    configuração da rede e não é série com vigência; por isso não é comparado com o fluxo de nenhuma hora.
                  </p>
                  <RedeDocumentos documentos={[r.documentos.ons_submodulo_9_1, r.documentos.ons_pel_2019_2020, r.documentos.ons_rt_dpl_0131_2023]} />
                </RedeAuditoria>

                <RedeAuditoria id="dicionarios-restricoes" titulo="Dicionários de dados: ATLS, interrupções e intercâmbio">
                  <p className="text-sm text-carvao-muted">
                    O dicionário do ATLS diz que o valor vem em percentual, mas o arquivo traz fração de 0 a 1 (maior valor lido {num(r.atls.maior_valor_lido, 3)}, menor{" "}
                    {num(r.atls.menor_valor_lido, 3)}); a gold publica as horas, que não dependem dessa leitura.
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
                </RedeAuditoria>

                <RedeAuditoria id="metodologia-a06" titulo="Correção pedida na página de metodologia">
                  <p className="text-sm text-carvao-muted">{a6.correcao_metodologia}</p>
                  <RedeRegras regras={[{ rotulo: rotuloRegra("limites"), texto: g.regras.limites }]} />
                </RedeAuditoria>

                <RedeSeguir ancora="p030" proximo={{ href: `${rotaPainel("p031")}#p031`, pergunta: perguntaPainel("p031") }} downloads={downloads} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
