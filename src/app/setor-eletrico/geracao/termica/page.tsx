import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import {
  GeracaoAnalise,
  GeracaoAuditoria,
  GeracaoAviso,
  GeracaoFrases,
  GeracaoIndisponivel,
  GeracaoNavegacao,
  GeracaoRegras,
  GeracaoSeguir,
} from "@/components/energia/GeracaoPagina";
import { GeracaoTermica } from "@/components/energia/GeracaoTermica";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { Numero } from "@/components/energia/Numero";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, mesAno, num } from "@/lib/energia/formato";
import {
  COLUNAS_CVU_COMBUSTIVEL,
  COLUNAS_CVU_USINAS,
  COLUNAS_UNIVERSO_TERMICA,
  COR_COMBUSTIVEL,
  CURTO_COMBUSTIVEL,
  ROTULO_ORIGEM_COMBUSTIVEL,
  ROTULO_REGRA,
  combustiveisCvu,
  downloadsDoPainel,
  linhasCvuCombustivel,
  linhasCvuMensal,
  linhasCvuUsinas,
  linhasUniversoTermica,
  paraTabela,
  perguntaPainel,
  rotaPainel,
  situacaoMensal,
  textoCvu,
  textoTermica7d,
  type TermicaCliente,
} from "@/lib/energia/geracao";
import { gold, integra, lerGold } from "@/lib/energia/gold";
import type { GoldGeracaoDetalhe } from "@/lib/energia/tipos-geracao";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Geração: quanto as térmicas geraram e por que foram acionadas",
  description:
    "Geração térmica verificada do SIN por motivo de despacho do ONS (inflexibilidade, ordem de mérito, unit commitment, exportação, razão elétrica e outros) e por combustível, as usinas com mais geração e suas parcelas, o CVU da semana operativa vigente e a participação térmica da semana em contexto.",
  alternates: { canonical: "/setor-eletrico/geracao/termica" },
};

const FONTE = "ONS, Geração Térmica por Motivo de Despacho";
const FONTE_CVU = "ONS, CVU das Usinas Térmicas";

export default function GeracaoTermicaPage() {
  const g = lerGold<GoldGeracaoDetalhe>("geracao_detalhe.json");
  if (!integra(g) || !g.termica) return <GeracaoIndisponivel motivo={(g as { motivo?: string } | null)?.motivo ?? (g ? "A térmica por motivo de despacho não foi publicada nesta gold." : undefined)} />;
  const t = g.termica;
  const ev = g.evidencias;
  const op = gold.geracao();
  const ctx = integra(op) ? op.termica_contexto : null;
  const atual = situacaoMensal(t.ultimo_mes_completo, g.gerado_em, "a térmica por motivo de despacho");
  const versao = t.ultimo_mes_completo;
  const { cvu: cvuDados, universo, identidade, mapa_combustivel: mapa, ...cliente } = t;
  const termicaCliente: TermicaCliente = cliente;
  const cvuMensal = cvuDados ? linhasCvuMensal(cvuDados, combustiveisCvu(cvuDados)) : [];
  const serie7d = ctx && integra(op) && op.serie_termica_7d?.length ? op.serie_termica_7d.map((p) => ({ ...p, mediana: ctx.mediana_365d, p10: ctx.p10_365d, p90: ctx.p90_365d })) : [];

  return (
    <>
      <CabecalhoEnergia atual="geracao" />
      <MarcaVisita secao="energia:geracao" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-4 sm:px-6">
        <CabecalhoModulo
          rotulo="Geração · Despacho térmico"
          titulo={perguntaPainel("p022")}
          referencia={
            <>
              {FONTE}, até {mesAno(t.ultimo_mes_completo)} (último mês completo); {FONTE_CVU}, semana vigente; processado em {carimbo(g.gerado_em)}.
            </>
          }
        >
          O ONS publica, para cada usina térmica e cada hora, quanto foi gerado e por qual motivo: ordem de mérito, inflexibilidade declarada pelo agente, razão elétrica,
          exportação e outros. Este painel separa a geração por combustível e por motivo, sem inferir o motivo do preço, e mostra o{" "}
          <Termo slug="cvu">Custo Variável Unitário</Termo> declarado para a semana operativa vigente.
        </CabecalhoModulo>
        <GeracaoNavegacao atual="p022" />
        <ModoProfundidade>
          <Bloco id="despacho">
            <PainelEvidencia
              id="p022"
              pergunta={perguntaPainel("p022")}
              subtitulo="Geração térmica por combustível e motivo de despacho · GWh, MWmed e %"
              natureza="CALCULADO"
              porQueImporta={
                <>
                  Térmica gerando por inflexibilidade é diferente de térmica gerando por ser a opção de menor custo (ordem de mérito) ou por necessidade da rede (razão
                  elétrica). O motivo muda a leitura do custo da operação e do uso da água nos reservatórios.
                </>
              }
              oQueMudou={<>{atual.texto}</>}
              comoInterpretar={
                <>
                  A geração verificada de cada usina é dividida pelos motivos que o ONS publica, sem dupla contagem: a inflexibilidade embutida na ordem de mérito conta
                  como inflexibilidade, e o mérito conta só acima dela. A soma dos motivos fecha com a geração verificada a menos de uma parcela não classificada, publicada
                  com sinal. Combustível é outra dimensão: as barras empilham os motivos dentro de cada combustível.
                </>
              }
              naoConcluir={
                <>
                  O motivo é a classificação do ONS; não é inferido do PLD nem do CMO, e o CVU é custo declarado para a programação, não custo realizado. A participação
                  das térmicas não diz se o despacho foi caro ou barato para o consumidor. Usinas com o mesmo número de CEG só são tratadas como a mesma usina quando o
                  ONS publica um elo entre elas; nunca por semelhança de nome.
                </>
              }
              proveniencia={g.proveniencia.termica!}
              complementares={[
                ...(g.proveniencia.cvu ? [{ rotulo: "CVU da semana operativa", p: g.proveniencia.cvu }] : []),
                ...(integra(op) && op.proveniencia.termica_7d ? [{ rotulo: "Participação térmica de 7 dias (Balanço)", p: op.proveniencia.termica_7d }] : []),
              ]}
            >
              <div className="space-y-6">
                {atual.defasada && <GeracaoAviso tipo="alerta">{atual.texto}</GeracaoAviso>}
                <GeracaoTermica
                  termica={termicaCliente}
                  fonte={FONTE}
                  versao={versao}
                  destaques={
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Numero rotulo="Geração térmica despachada pelo ONS, 12 meses completos" natureza="CALCULADO" evidencia={ev.termica_12m_total} casas={0} tamanho="medio" cor="var(--serie-termica)" endereco={`${rotaPainel("p022")}#p022`} />
                      <Numero
                        rotulo="Parcela da geração térmica por inflexibilidade declarada pelo agente, 12 meses"
                        natureza="CALCULADO"
                        evidencia={ev.termica_12m_inflexibilidade}
                        formato="pct"
                        casas={1}
                        unidade="%"
                        tamanho="medio"
                        cor="var(--serie-sm-se)"
                        nota="Inclui a inflexibilidade embutida no despacho por ordem de mérito, como o dicionário do ONS descreve."
                        endereco={`${rotaPainel("p022")}#p022`}
                      />
                    </div>
                  }
                />

                <div id="termica" className="scroll-mt-28 space-y-4 border-t border-linha pt-5">
                  <h3 className="font-serif text-lg text-carvao">A participação térmica desta semana em contexto</h3>
                  {ctx && integra(op) ? (
                    <>
                      <p className="text-sm leading-relaxed text-carvao">{textoTermica7d(ctx)}</p>
                      <p className="text-sm text-carvao-muted">
                        Base diferente da do motivo de despacho: o Balanço de Energia do ONS, até {dataBR(op.dia_referencia)}, com a nuclear entre as térmicas e sem separar
                        combustível. O percentil compara a semana com as {num(ctx.n_janelas, 0)} janelas de 7 dias do ano anterior.
                      </p>
                      {serie7d.length > 0 && (
                        <GraficoLinhas
                          titulo="Participação térmica em janelas móveis de 7 dias, último ano, com a mediana e a faixa usual do ano anterior"
                          dados={serie7d}
                          chaveX="d"
                          series={[
                            { id: "termica_7d", rotulo: "Térmica, 7 dias", cor: "var(--serie-termica)", espessura: 2.5 },
                            { id: "mediana", rotulo: "Mediana do ano anterior", sigla: "Mediana", cor: "var(--serie-referencia)", tracejada: true },
                          ]}
                          banda={{ inferior: "p10", superior: "p90", rotulo: "10º a 90º percentil" }}
                          unidade="%"
                          casas={1}
                        />
                      )}
                    </>
                  ) : (
                    <GeracaoAviso>
                      A gold de operação da geração (Balanço de Energia) não está íntegra nesta publicação; a participação térmica de 7 dias não é mostrada até a próxima
                      publicação válida.
                    </GeracaoAviso>
                  )}
                </div>

                {cvuDados && (
                  <GeracaoAnalise id="cvu" titulo="Custo Variável Unitário declarado para a semana operativa vigente">
                    <p className="text-sm text-carvao-muted">{textoCvu(cvuDados)}</p>
                    <TabelaInterativa
                      titulo="CVU por combustível na semana vigente: mínimo, quartis e máximo das parcelas"
                      colunas={COLUNAS_CVU_COMBUSTIVEL}
                      linhas={paraTabela(linhasCvuCombustivel(cvuDados))}
                      chaveLinha="id"
                      colunaRotulo="combustivel"
                      fonte={FONTE_CVU}
                      versao={cvuDados.semana.inicio}
                      nomeArquivo="geracao-cvu-combustivel"
                      chaveUrl="cvc"
                      nota="Custo declarado considerado no Programa Mensal da Operação, não custo realizado nem preço. Uma usina com várias parcelas tem um CVU por parcela."
                    />
                    <GraficoLinhas
                      titulo="Mediana mensal do CVU por combustível"
                      dados={cvuMensal}
                      chaveX="m"
                      formatoX="mes"
                      series={combustiveisCvu(cvuDados).map((c) => ({ id: c, rotulo: CURTO_COMBUSTIVEL[c], cor: COR_COMBUSTIVEL[c] }))}
                      unidade="R$/MWh"
                      casas={0}
                      zeroNoEixo
                      legendaInterativa
                      zoom
                    />
                    <TabelaInterativa
                      titulo="Tabela equivalente: mediana mensal do CVU por combustível"
                      colunas={[{ id: "m", rotulo: "Mês", tipo: "texto" }, ...combustiveisCvu(cvuDados).map((c) => ({ id: c, rotulo: CURTO_COMBUSTIVEL[c], tipo: "numero" as const, unidade: "R$/MWh", casas: 2 }))]}
                      linhas={paraTabela(cvuMensal)}
                      chaveLinha="id"
                      colunaRotulo="m"
                      fonte={FONTE_CVU}
                      versao={cvuDados.semana.inicio}
                      nomeArquivo="geracao-cvu-mediana-mensal"
                      chaveUrl="cvm"
                      ordemInicial={{ coluna: "m", direcao: "desc" }}
                      nota="Mediana das parcelas com CVU em cada mês (moeda corrente, sem correção). Mês sem parcela do combustível fica vazio."
                    />
                    <TabelaInterativa
                      titulo={`CVU de cada usina na semana de ${dataBR(cvuDados.semana.inicio)} a ${dataBR(cvuDados.semana.fim)}`}
                      colunas={COLUNAS_CVU_USINAS}
                      linhas={paraTabela(linhasCvuUsinas(cvuDados))}
                      chaveLinha="id"
                      colunaRotulo="nome"
                      fonte={FONTE_CVU}
                      versao={cvuDados.semana.inicio}
                      nomeArquivo="geracao-cvu-usinas-semana"
                      chaveUrl="cvu"
                      ordemInicial={{ coluna: "cvu", direcao: "desc" }}
                      dicaBusca="Nome ou código do ONS"
                      nota={`Código do ONS ligado à usina da térmica por motivo pela união dos códigos de todas as suas parcelas; código ligado a mais de uma usina fica sem par (${cvuDados.cobertura.codigos_ambiguos.length} nesta semana). Linhas repetidas idênticas na fonte: ${num(cvuDados.controles.linhas_repetidas_identicas, 0)}, contadas uma vez.`}
                    />
                  </GeracaoAnalise>
                )}

                <GeracaoAuditoria id="universo-termica" titulo="Universo: a térmica por motivo contra a Geração por Usina">
                  <p className="text-sm text-carvao-muted">{universo.regra}</p>
                  <TabelaInterativa
                    titulo="Mês a mês, as mesmas usinas nos dois conjuntos do ONS"
                    colunas={COLUNAS_UNIVERSO_TERMICA}
                    linhas={paraTabela(linhasUniversoTermica({ universo }))}
                    chaveLinha="id"
                    colunaRotulo="mes"
                    fonte="ONS, Geração Térmica por Motivo de Despacho e Geração por Usina"
                    versao={versao}
                    nomeArquivo="geracao-termica-universo"
                    chaveUrl="ut"
                  />
                  <p className="text-sm text-carvao-muted">
                    Combustível de {num(mapa.usinas, 0)} usinas, pela autoridade publicada:{" "}
                    {Object.entries(mapa.por_origem)
                      .map(([k, n]) => `${ROTULO_ORIGEM_COMBUSTIVEL[k] ?? k} ${num(n, 0)}`)
                      .join("; ")}
                    .{" "}
                    {mapa.nao_identificadas.length
                      ? `Sem combustível identificado: ${mapa.nao_identificadas.map((x) => x.nome ?? x.id).join(", ")}, com ${num(mapa.nao_identificadas_mwh_12m, 1)} MWh nos 12 meses (${num(mapa.nao_identificadas_pct_12m, 3)}% da energia térmica).`
                      : "Todas com combustível identificado."}
                  </p>
                  <p className="text-sm text-carvao-muted">
                    {identidade.regra}{" "}
                    {identidade.usinas_com_mais_de_uma_chave.length
                      ? `Usinas com mais de uma chave na fonte: ${identidade.usinas_com_mais_de_uma_chave.map((x) => `${x.nome ?? x.usina} (${x.chaves.join(", ")})`).join("; ")}.`
                      : ""}
                  </p>
                  <p className="text-sm text-carvao-muted">
                    Células negativas na fonte (motivos ou total), mantidas como publicadas e contadas: {num(t.controles.valores_negativos_na_fonte, 0)}.
                  </p>
                </GeracaoAuditoria>

                <GeracaoAuditoria id="regras-termica" titulo="Regras e limitações">
                  <GeracaoRegras regras={[{ rotulo: ROTULO_REGRA.termica, texto: g.regras.termica }, { rotulo: ROTULO_REGRA.janelas, texto: g.regras.janelas }]} />
                  <GeracaoFrases itens={[...(g.proveniencia.termica?.limitacoes ?? []), ...(g.proveniencia.cvu?.limitacoes ?? [])]} />
                  <ul className="space-y-1 text-sm text-carvao-muted">
                    {t.motivos.map((mo) => (
                      <li key={mo.id}>
                        <span className="text-carvao">{mo.rotulo}</span>: campo {mo.campo} da fonte.
                      </li>
                    ))}
                  </ul>
                </GeracaoAuditoria>

                <GeracaoSeguir ancora="p022" proximo={{ href: `${rotaPainel("p023")}#p023`, pergunta: perguntaPainel("p023") }} downloads={downloadsDoPainel(g.downloads, "p022")} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
