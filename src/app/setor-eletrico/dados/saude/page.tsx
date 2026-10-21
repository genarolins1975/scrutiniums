import type { Metadata, ResolvingMetadata } from "next";
import type { ReactNode } from "react";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import Link from "@/components/i18n/LinkIdioma";
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { DadosArquivos, itensDeArquivos } from "@/components/energia/DadosArquivos";
import { DadosCalendario, DadosSaudeTabela } from "@/components/energia/DadosSaude";
import { DadosAuditoria, DadosAviso, DadosIndisponivel, DadosLimitacoes, DadosNavegacao, DadosResposta, DadosSeguir, ReferenciaDados } from "@/components/energia/DadosPainel";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { Numero } from "@/components/energia/Numero";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, num, pct, plural } from "@/lib/energia/formato";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { CSV_DADOS, ROTULO_SITUACAO, conjuntosComRevisao, inicioRegistroCapturas, janelaCalendario, linhasSaude, refLegivel, respostaSaude, resumoSaude, situacaoPorCadencia, uni } from "@/lib/energia/dados";
import {
  conciliarCatalogoEIntegracoes,
  limitacaoInicioDoRegistro,
  limitacaoParaLeitor,
  primeiroDiaComRevisao,
  textoConciliacao,
  avisoDeSinal,
  textoMudancaSaude,
  textoPonteRevisoes,
  textoPrazos,
  tituloCurto,
  vereditoSaude,
} from "@/lib/energia/dados-leitor";
import { COLUNAS_ARQUIVO, catalogoDados } from "@/lib/energia/datasets";
import { nomeDoConjunto } from "@/lib/energia/dados-ficha";
import { codigo, marcado } from "@/lib/energia/i18n/regulacao-dados-metodo";
import { manifestoDados, provenienciaDados, publicacaoDados } from "@/lib/energia/dados-servidor";
import { datasLegiveis } from "@/lib/energia/visao";

export const dynamic = "force-static";

export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/dados/saude", {
    title: tx("Saúde das fontes e revisões: o que atrasou ou mudou nos dados do setor elétrico", "Source health and revisions: what was delayed or changed in power sector data"),
    description: tx(
      "Atualidade de cada conjunto integrado pelo prazo da frequência declarada pela fonte, calendário de capturas, falhas e revisões, completude, último período e magnitude das revisões entre capturas.",
      "Timeliness of each integrated dataset against the deadline of the frequency declared by the source, calendar of captures, failures and revisions, completeness, latest period and size of the revisions between captures.",
    ),
    alternates: { canonical: "/setor-eletrico/dados/saude" },
  }, anterior);
}

/** Texto escrito pelo pipeline (regras, motivos de falha): fica em português, com as datas no formato brasileiro do próprio trecho. */
/** Termo técnico inglês que a gold usa no meio do texto português ("append only"): fica como está, marcado com lang="en". */
const TERMO_INGLES_DA_GOLD = /(\(append only\))/; // i18n: dado

function DaGold({ texto, regiao }: { texto: string; regiao: string }) {
  const partes = datasLegiveis(texto, "pt").split(TERMO_INGLES_DA_GOLD);
  return (
    <TrechoPortugues regiao={regiao}>
      {partes.map((p, i) => (TERMO_INGLES_DA_GOLD.test(p) ? <span key={i} lang="en">{p}</span> : p))}
    </TrechoPortugues>
  );
}

export default function DadosSaudePage() {
  const pub = publicacaoDados();
  if (!pub) return <DadosIndisponivel atual="dados" />;

  const idioma = idiomaEnergia();
  const r = resumoSaude(pub);
  const m = manifestoDados();
  const prov = provenienciaDados(pub.proveniencia.saude);
  const provRev = provenienciaDados(pub.proveniencia.revisoes);
  const linhas = linhasSaude(pub);
  const cadencias = situacaoPorCadencia(pub);
  const revisados = conjuntosComRevisao(pub);
  const mudancasCadastro = pub.conjuntos.filter((c) => (c.revisoes?.registros?.mudancas ?? 0) > 0);
  const evAtrasados = pub.evidencias.conjuntos_atrasados;
  const evRevisao = pub.evidencias.maior_revisao_relativa;
  const janela = pub.referencia.janela_calendario_dias ?? 120;
  const versao = pub.gerado_em;
  const emDia = r.porSituacao["EM DIA"] ?? 0;
  const inicioRegistro = inicioRegistroCapturas(pub.calendario);
  const jan = janelaCalendario(pub.referencia.hoje, janela);
  const ultimaCaptura = pub.conjuntos.map((c) => c.capturas.ultima).filter((x): x is string => !!x).sort().at(-1);
  const cat = catalogoDados();
  const conciliacao = cat ? conciliarCatalogoEIntegracoes(cat, pub) : null;
  const atrasado = r.atrasados[0];
  // a maior revisão relativa, com o número formatado como o do cartão (a gold escreve 20656,6% sem o ponto de milhar)
  const evAtrasadosLegivel = evAtrasados ? { ...evAtrasados, indicador: tx("Integrações com atualização atrasada", "Integrations with a late update") } : undefined;
  const evRevisaoLegivel = evRevisao ? { ...evRevisao, valor_exibido: pct(evRevisao.valor_calculo, 1) } : undefined;
  const maiorRevisao = r.comRevisao.map((c) => ({ c, e: c.revisoes?.maior_rel })).filter((x) => x.e && x.e.relativa_pct !== null).sort((a, b) => (b.e!.relativa_pct ?? 0) - (a.e!.relativa_pct ?? 0))[0];
  const ENDERECO = "https://scrutiniums.com/setor-eletrico/dados/saude#saude";
  const oQueMudou = <>{marcado(textoMudancaSaude(r), r.comRevisao.map((c) => c.titulo))}</>;
  const comoInterpretar = tx(
    <>
      Em dia quer dizer que o período seguinte ao último disponível ainda está dentro do prazo (o fim desse período mais a tolerância da frequência declarada). Sem prazo declarado é a fonte que não declara frequência: o observatório não inventa uma. Revisão é a troca de valor de uma mesma série e
      período entre capturas do mesmo arquivo; a captura anterior continua guardada. Atrasado é a fonte sem período novo, e a causa só é afirmada quando a coleta dá evidência. “Sem dado” indica ausência na fonte, nunca zero; nos arquivos baixados, a ausência é célula vazia.
    </>,
    <>
      Up to date means that the period after the latest one available is still within the deadline (the end of that period plus the tolerance of the declared frequency). No declared deadline is a source that does not declare a frequency: the observatory does not
      invent one. A revision is a change of value of the same series and period between captures of the same file; the previous capture stays stored. Late is a source with no new period, and the reason is only stated when the collection gives evidence. “No data”
      indicates absence at the source, never zero; in the downloaded files, absence is an empty cell.
    </>,
  );
  const naoConcluir = tx(
    <>
      Que uma revisão grande seja erro da fonte ou do observatório: a página mostra o tamanho e as duas capturas, não a causa. Que sem prazo declarado signifique desatualizado. Que a ausência de falha seja saúde da fonte: a primeira captura registrada é de{" "}
      {dataBR(inicioRegistro ?? pub.referencia.hoje)}.
    </>,
    <>
      That a large revision is an error of the source or of the observatory: the page shows the size and the two captures, not the reason. That no declared deadline means out of date. That the absence of failures means source health: the first capture recorded is
      from {dataBR(inicioRegistro ?? pub.referencia.hoje)}.
    </>,
  );
  const arquivos = itensDeArquivos([CSV_DADOS.conjuntos, CSV_DADOS.calendario, CSV_DADOS.revisoes], { pub, manifesto: m, dicionario: COLUNAS_ARQUIVO });
  const nomeCadencia: Record<string, string> = tx(
    { diaria: "diária", semanal: "semanal", quinzenal: "quinzenal", mensal: "mensal", trimestral: "trimestral", anual: "anual" },
    { diaria: "daily", semanal: "weekly", quinzenal: "fortnightly", mensal: "monthly", trimestral: "quarterly", anual: "annual" },
  );
  const dias = (n: number) => tx(plural(n, "dia", "dias"), plural(n, "day", "days"));

  return (
    <>
      <CabecalhoEnergia atual="dados" />
      <MarcaVisita secao="energia:dados:saude" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <DadosNavegacao atual="saude" />
        <CabecalhoModulo
          siglas={["SCS", "ONS"]}
          titulo={tx("O que atrasou ou mudou?", "What was delayed or changed?")}
          lead={tx(
            "Quais integrações passaram do prazo, quando a coleta falhou e quanto os valores guardados mudaram entre capturas. A situação vale para a data de referência dos dados, não para o dia em que você lê.",
            "Which integrations missed their deadline, when the collection failed and how much the stored values changed between captures. The status applies to the reference date of the data, not to the day you read it.",
          )}
          recorte={tx(
            `situação em ${dataBR(r.hoje)} · calendário de ${dataBR(jan.inicio)} a ${dataBR(jan.fim)} (${janela} dias) · ${num(r.integracoes, 0)} integrações de conjuntos`,
            `status on ${dataBR(r.hoje)} · calendar from ${dataBR(jan.inicio)} to ${dataBR(jan.fim)} (${janela} days) · ${num(r.integracoes, 0)} dataset integrations`,
          )}
          fonte={tx("histórico de capturas do observatório", "the observatory's capture history")}
          referencia={
            <ReferenciaDados
              processadoEm={pub.gerado_em}
              referencia={dataBR(pub.referencia.hoje)}
              extra={tx(
                <>Última captura registrada: {ultimaCaptura ? carimbo(ultimaCaptura) : "nenhuma"}.</>,
                <>Latest capture recorded: {ultimaCaptura ? carimbo(ultimaCaptura) : "none"}.</>,
              )}
            />
          }
          metricas={
            <FaixaMetricas
              colunas={4}
              rotulo={tx("Indicadores da saúde das fontes", "Source health indicators")}
              nota={tx("Medidas da publicação inteira: não mudam com a tabela nem com o calendário abaixo.", "Measures of the whole publication: they do not change with the table or the calendar below.")}
            >
              <Numero
                variante="faixa"
                rotulo={tx("Integrações em dia", "Integrations up to date")}
                natureza="CALCULADO"
                valor={emDia}
                casas={0}
                unidade={tx("integrações", "integrations")}
                periodo={dataBR(r.hoje)}
                nota={tx(<>de {num(r.integracoes, 0)} integrações</>, <>of {num(r.integracoes, 0)} integrations</>)}
                endereco={ENDERECO}
              />
              <Numero
                variante="faixa"
                rotulo={tx("Integrações atrasadas", "Late integrations")}
                natureza="CALCULADO"
                evidencia={evAtrasadosLegivel ?? null}
                valor={r.atrasados.length}
                casas={0}
                unidade={tx(uni(r.atrasados.length, "integração", "integrações"), uni(r.atrasados.length, "integration", "integrations"))}
                nota={
                  atrasado ? (
                    <>
                      <Nome>{tituloCurto(atrasado.titulo)}</Nome>
                      {tx(
                        `: ${plural(atrasado.atualidade.dias_atraso ?? 0, "dia", "dias")} além do prazo${atrasado.atualidade.prazo_proximo ? ` de ${dataBR(atrasado.atualidade.prazo_proximo)}` : ""}`,
                        `: ${plural(atrasado.atualidade.dias_atraso ?? 0, "day", "days")} past the deadline${atrasado.atualidade.prazo_proximo ? ` of ${dataBR(atrasado.atualidade.prazo_proximo)}` : ""}`,
                      )}
                    </>
                  ) : undefined
                }
                motivoAusencia={tx("Sem medida de atraso nesta publicação.", "No measure of delay in this publication.")}
                endereco={ENDERECO}
              />
              <Numero
                variante="faixa"
                rotulo={tx("Maior revisão relativa", "Largest relative revision")}
                natureza="CALCULADO"
                evidencia={evRevisaoLegivel ?? null}
                formato="pct"
                casas={1}
                nota={
                  maiorRevisao?.e ? (
                    <>
                      <Nome>{tituloCurto(maiorRevisao.c.titulo)}</Nome>
                      {tx(
                        ` (${maiorRevisao.c.orgao}), de ${num(maiorRevisao.e.de, 1)} para ${num(maiorRevisao.e.para, 1)} entre duas capturas do mesmo arquivo. Uma revisão grande não prova erro.`,
                        ` (${maiorRevisao.c.orgao}), from ${num(maiorRevisao.e.de, 1)} to ${num(maiorRevisao.e.para, 1)} between two captures of the same file. A large revision does not prove an error.`,
                      )}
                      {avisoDeSinal(maiorRevisao.e) ? ` ${avisoDeSinal(maiorRevisao.e)}` : ""}
                    </>
                  ) : (
                    tx(<>entre duas capturas do mesmo arquivo</>, <>between two captures of the same file</>)
                  )
                }
                motivoAusencia={tx("Nenhuma revisão detectada.", "No revision detected.")}
                endereco={ENDERECO}
              />
              <Numero
                variante="faixa"
                rotulo={tx("Integrações com falha de coleta", "Integrations with a collection failure")}
                natureza="CALCULADO"
                valor={r.comFalha.length}
                casas={0}
                unidade={tx(uni(r.comFalha.length, "integração", "integrações"), uni(r.comFalha.length, "integration", "integrations"))}
                periodo={dataBR(r.hoje)}
                nota={tx(
                  <>
                    {num(r.comFalhaRecente, 0)} com falha recente; {num(r.atrasFonte.length, 0)} com arquivo mais novo na fonte
                  </>,
                  <>
                    {num(r.comFalhaRecente, 0)} with a recent failure; {num(r.atrasFonte.length, 0)} with a newer file at the source
                  </>,
                )}
                endereco={ENDERECO}
              />
            </FaixaMetricas>
          }
        >
          {tx(
            <>
              Cada conjunto integrado tem uma frequência de atualização declarada pela fonte e um prazo derivado dela. Esta página mostra quem passou do prazo, quando o observatório baixou os arquivos, quando a coleta falhou e quanto os valores já publicados mudaram entre uma captura e outra. A
              situação vale para a data de referência dos dados, não para o dia em que você lê.
            </>,
            <>
              Each integrated dataset has an update frequency declared by the source and a deadline derived from it. This page shows which ones missed the deadline, when the observatory downloaded the files, when the collection failed and how much the values already
              published changed from one capture to another. The status applies to the reference date of the data, not to the day you read it.
            </>,
          )}
        </CabecalhoModulo>

        <ModoProfundidade>
          <Bloco id="saude">
            <PainelEvidencia
              id="painel-saude"
              pergunta={tx("Como cada integração está frente ao prazo da fonte?", "How does each integration stand against the source deadline?")}
              subtitulo={tx(
                `${num(r.integracoes, 0)} integrações de conjuntos · situação em ${dataBR(r.hoje)} · calendário dos últimos ${janela} dias`,
                `${num(r.integracoes, 0)} dataset integrations · status on ${dataBR(r.hoje)} · calendar of the last ${janela} days`,
              )}
              proveniencia={prov}
              complementares={[{ rotulo: tx("Revisões entre capturas", "Revisions between captures"), p: provRev }]}
              porQueImporta={tx(
                <>
                  Um número publicado só vale tanto quanto o dado de que veio. Se a fonte parou de publicar, ou se revisou valores que já tinham sido usados, o leitor precisa saber antes de comparar períodos ou de citar a série.
                </>,
                <>
                  A published number is only worth as much as the data it came from. If the source stopped publishing, or revised values that had already been used, the reader needs to know before comparing periods or citing the series.
                </>,
              )}
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
            >
              <div className="space-y-6">
                <div>
                  <GraficoBarras
                    titulo={tx(`Situação das integrações por cadência declarada pela fonte, em ${dataBR(r.hoje)}`, `Status of the integrations by cadence declared by the source, on ${dataBR(r.hoje)}`)}
                    dados={cadencias.map((c) => ({ ...c, rotulo: c.tolerancia === null ? tx("Sem cadência", "No cadence") : `${c.rotulo} · ${c.tolerancia} d` }))}
                    chaveCategoria="cadencia"
                    chaveRotulo="rotulo"
                    series={[
                      // i18n: dado
                      { id: "EM DIA", rotulo: ROTULO_SITUACAO["EM DIA"], cor: "var(--escala-seq-4)" },
                      { id: "ATRASADO", rotulo: ROTULO_SITUACAO.ATRASADO, cor: "var(--serie-termica)" },
                      // i18n: dado
                      { id: "SEM DADO", rotulo: ROTULO_SITUACAO["SEM DADO"], cor: "var(--serie-3)" },
                      // i18n: dado
                      { id: "SEM SLA", rotulo: ROTULO_SITUACAO["SEM SLA"], cor: "var(--escala-seq-1)" },
                    ]}
                    unidade={tx("integrações", "integrations")}
                    casas={0}
                    orientacao="horizontal"
                    empilhado
                    rotulosValor
                    alturaCategoria={48}
                  />
                  <div className="mt-3">
                    <DadosAviso>{textoPrazos(pub.regras.sla)}</DadosAviso>
                  </div>
                </div>

                <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />

                <DadosResposta depois painel="P068" veredito={vereditoSaude(r)}>
                  {marcado(respostaSaude(r), r.atrasados.map((c) => c.titulo))}
                </DadosResposta>

                <SecaoDoPainel id="calendario" titulo={tx("Quando a fonte publica e quando o observatório coleta?", "When does the source publish and when does the observatory collect?")}>
                  <DadosCalendario calendario={pub.calendario} hoje={pub.referencia.hoje} janela={janela} />
                </SecaoDoPainel>

                <SecaoDoPainel
                  id="revisoes-analise"
                  titulo={tx("Quais valores a fonte revisou depois de publicá-los?", "Which values did the source revise after publishing them?")}
                  lead={tx(
                    "Revisão é a troca de valor de uma mesma série e período entre capturas consecutivas do mesmo arquivo. A captura anterior continua guardada, então o valor revisado e o anterior podem ser comparados.",
                    "A revision is a change of value of the same series and period between consecutive captures of the same file. The previous capture stays stored, so the revised value and the previous one can be compared.",
                  )}
                >
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted" data-nivel="analisar">
                    <DaGold texto={pub.regras.revisao} regiao="saude-regra-revisao" />
                  </p>
                  <DadosAviso id="ponte-das-revisoes">
                    <p>
                      {textoPonteRevisoes(idioma)}{" "}
                      <Link href="/setor-eletrico/agua-e-clima#reconciliacao" className="text-energia-dark underline underline-offset-4">
                        {tx("Ver as revisões de Água e clima", "See the Water and climate revisions")}
                      </Link>
                      .
                    </p>
                  </DadosAviso>
                  {revisados.length === 0 ? (
                    <p className="text-sm text-carvao-muted">{tx("Nenhuma revisão de valor entre capturas foi detectada nesta publicação.", "No value revision between captures was detected in this publication.")}</p>
                  ) : (
                    <ul className="space-y-4" data-lista="revisoes">
                      {revisados.map((c) => {
                        const rv = c.revisoes!;
                        const ev = rv.maior_rel;
                        return (
                          <li key={c.id} className="border-b border-linha pb-4">
                            <p className="font-medium text-carvao">
                              <Nome>{nomeDoConjunto(c).nome}</Nome>
                            </p>
                            <p className="mt-1 text-sm leading-relaxed text-carvao-muted">
                              {tx(
                                `${num(rv.observacoes ?? 0, 0)} valores revisados (pares de série e período), em ${num(rv.referencias ?? 0, 0)} períodos e ${plural(rv.series ?? 0, "série", "séries")}`,
                                `${num(rv.observacoes ?? 0, 0)} revised values (pairs of series and period), in ${num(rv.referencias ?? 0, 0)} periods and ${plural(rv.series ?? 0, "series", "series")}`,
                              )}
                              {rv.ref_min && rv.ref_max ? tx(`, de ${refLegivel(rv.ref_min)} a ${refLegivel(rv.ref_max)}`, `, from ${refLegivel(rv.ref_min)} to ${refLegivel(rv.ref_max)}`) : ""}.
                            </p>
                            {ev && (
                              <p className="mt-1 text-sm leading-relaxed text-carvao-muted">
                                {tx(
                                  `Maior mudança relativa: de ${num(ev.de, 2)} para ${num(ev.para, 2)} (${ev.relativa_pct === null ? "valor anterior zero" : pct(ev.relativa_pct, 1)}), em ${refLegivel(ev.ref)}. O valor anterior vem da captura de ${carimbo(ev.capturado_de)} e o novo, da captura de ${carimbo(ev.capturado_para)}; as duas continuam guardadas.`,
                                  `Largest relative change: from ${num(ev.de, 2)} to ${num(ev.para, 2)} (${ev.relativa_pct === null ? "previous value zero" : pct(ev.relativa_pct, 1)}), in ${refLegivel(ev.ref)}. The previous value comes from the capture of ${carimbo(ev.capturado_de)} and the new one, from the capture of ${carimbo(ev.capturado_para)}; both are still stored.`,
                                )}
                                {avisoDeSinal(ev) ? ` ${avisoDeSinal(ev)}` : ""}
                              </p>
                            )}
                            {rv.conflitos_entre_recursos && (
                              <p className="mt-1 text-xs leading-relaxed text-mineral">
                                {tx(
                                  `Além disso, ${plural(rv.conflitos_entre_recursos.referencias, "período tem", "períodos têm")} valores diferentes em arquivos diferentes: não é revisão da fonte e fica à parte.`,
                                  `In addition, ${plural(rv.conflitos_entre_recursos.referencias, "period has", "periods have")} different values in different files: this is not a revision by the source and is kept apart.`,
                                )}
                              </p>
                            )}
                            <div className="mt-1 space-y-1 text-xs leading-relaxed text-mineral" data-nivel="analisar">
                              {rv.maior_abs && (
                                <p>
                                  {tx("Maior mudança absoluta: série", "Largest absolute change: series")} <strong className="font-medium text-carvao">{codigo(rv.maior_abs.serie)}</strong>{" "}
                                  {tx(
                                    `em ${refLegivel(rv.maior_abs.ref)}, de ${num(rv.maior_abs.de, 2)} para ${num(rv.maior_abs.para, 2)} (diferença de ${num(rv.maior_abs.diferenca, 2)}, na unidade da série).`,
                                    `in ${refLegivel(rv.maior_abs.ref)}, from ${num(rv.maior_abs.de, 2)} to ${num(rv.maior_abs.para, 2)} (difference of ${num(rv.maior_abs.diferenca, 2)}, in the unit of the series).`,
                                  )}
                                </p>
                              )}
                              {ev && (
                                <p>
                                  {tx("Maior mudança relativa: série", "Largest relative change: series")} <strong className="font-medium text-carvao">{codigo(ev.serie)}</strong>
                                  {tx<ReactNode>(
                                    `, arquivo ${ev.recurso}. Cada captura guarda o original com sha256.`,
                                    <>, file {codigo(ev.recurso)}. Each capture stores the original with sha256.</>,
                                  )}
                                </p>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {mudancasCadastro.length > 0 && (
                    <div>
                      <p className="rotulo text-mineral">{tx("Mudanças em cadastros e atos entre capturas", "Changes in registers and acts between captures")}</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed text-carvao-muted" data-lista="registros">
                        {mudancasCadastro.map((c) => (
                          <li key={c.id}>
                            <Nome>{nomeDoConjunto(c).nome}</Nome>
                            {tx(
                              `: ${plural(c.revisoes!.registros!.mudancas ?? 0, "campo mudou", "campos mudaram")} em ${plural(c.revisoes!.registros!.chaves ?? 0, "chave", "chaves")}.`,
                              `: ${plural(c.revisoes!.registros!.mudancas ?? 0, "field changed", "fields changed")} in ${plural(c.revisoes!.registros!.chaves ?? 0, "key", "keys")}.`,
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </SecaoDoPainel>

                <SecaoDoPainel
                  id="falhas-analise"
                  titulo={tx("O que falhou na coleta?", "What failed in the collection?")}
                  lead={tx(
                    "Uma falha de coleta nunca renova a data do dado: o último período vem do que já foi guardado, e a falha aparece separada, com data e motivo. A captura anterior fica preservada.",
                    "A collection failure never renews the date of the data: the latest period comes from what was already stored, and the failure appears separately, with date and reason. The previous capture is preserved.",
                  )}
                >
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted" data-nivel="analisar">
                    <DaGold texto={pub.regras.falha} regiao="saude-regra-falha" />
                  </p>
                  {r.comFalha.length === 0 ? (
                    <p className="text-sm text-carvao-muted">{tx("Nenhum conjunto registra falha de coleta nesta publicação.", "No dataset records a collection failure in this publication.")}</p>
                  ) : (
                    <ul className="space-y-3" data-lista="falhas">
                      {r.comFalha.map((c) => (
                        <li key={c.id} className="border-b border-linha pb-3 text-sm leading-relaxed text-carvao-muted">
                          <p className="font-medium text-carvao">
                            <Nome>{nomeDoConjunto(c).nome}</Nome>
                          </p>
                          <p>
                            {tx(
                              `${num(c.coleta.falhas, 0)} falhas em ${plural(c.coleta.tentativas, "tentativa", "tentativas")}${c.coleta.falhas_consecutivas ? `, ${c.coleta.falhas_consecutivas} seguidas` : ""}${c.coleta.ultima_falha ? `; a última em ${carimbo(c.coleta.ultima_falha.tentado_em)}` : ""}. Último período disponível: ${c.atualidade.ultimo_periodo ? refLegivel(c.atualidade.ultimo_periodo) : "sem referência"}; última captura com conteúdo: ${c.capturas.ultima ? carimbo(c.capturas.ultima) : "sem captura"}.`,
                              `${num(c.coleta.falhas, 0)} failures in ${plural(c.coleta.tentativas, "attempt", "attempts")}${c.coleta.falhas_consecutivas ? `, ${c.coleta.falhas_consecutivas} in a row` : ""}${c.coleta.ultima_falha ? `; the latest on ${carimbo(c.coleta.ultima_falha.tentado_em)}` : ""}. Latest period available: ${c.atualidade.ultimo_periodo ? refLegivel(c.atualidade.ultimo_periodo) : "no reference"}; latest capture with content: ${c.capturas.ultima ? carimbo(c.capturas.ultima) : "no capture"}.`,
                            )}
                          </p>
                          {c.coleta.ultima_falha && (
                            <p className="text-xs text-mineral [overflow-wrap:anywhere]" data-nivel="analisar">
                              {tx("Motivo registrado:", "Recorded reason:")} <DaGold texto={c.coleta.ultima_falha.detalhe} regiao="saude-motivo-falha" />
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </SecaoDoPainel>

                {conciliacao && (
                  <SecaoDoPainel id="conjuntos-e-integracoes" titulo={tx("Por que a Saúde e o catálogo contam números diferentes?", "Why do Health and the catalog count different numbers?")}>
                    <DadosAviso>
                      <p>{textoConciliacao(conciliacao)}</p>
                    </DadosAviso>
                  </SecaoDoPainel>
                )}

                <SecaoDoPainel id="tabela" titulo={tx("Quais são as integrações, uma a uma?", "What are the integrations, one by one?")}>
                  <DadosSaudeTabela linhas={linhas} versao={versao} />
                </SecaoDoPainel>

                <DadosAuditoria titulo={tx("Regras de atualidade, completude e revisão", "Rules of timeliness, completeness and revision")} id="regras-saude-auditoria">
                  <dl className="space-y-4 text-sm">
                    <div>
                      <dt className="rotulo text-mineral">{tx("SLA e os cinco casos (A a E)", "SLA and the five cases (A to E)")}</dt>
                      <dd className="mt-1 max-w-prose2 leading-relaxed text-carvao-muted">
                        <DaGold texto={pub.regras.sla_texto} regiao="saude-regra-sla" />
                      </dd>
                    </div>
                    <div>
                      <dt className="rotulo text-mineral">{tx("Completude interna e cobertura do último período", "Internal completeness and coverage of the latest period")}</dt>
                      <dd className="mt-1 max-w-prose2 leading-relaxed text-carvao-muted">
                        <DaGold texto={pub.regras.completude.replace("disponível até hoje", "disponível até a data de referência da publicação")} regiao="saude-regra-completude" />
                      </dd>
                    </div>
                    <div>
                      <dt className="rotulo text-mineral">{tx("Captura atrás da fonte", "Capture behind the source")}</dt>
                      <dd className="mt-1 max-w-prose2 leading-relaxed text-carvao-muted">
                        <DaGold texto={pub.regras.captura_atras_da_fonte} regiao="saude-regra-captura" />
                      </dd>
                    </div>
                  </dl>
                  <div className="tabela-scroll" tabIndex={0} role="region" aria-label={tx("Tolerância do SLA por cadência (tabela rolável)", "SLA tolerance by cadence (scrollable table)")}>
                    <table className="w-full min-w-[24rem] border-collapse text-xs">
                      <caption className="sr-only">{tx("Tolerância do SLA por cadência declarada", "SLA tolerance by declared cadence")}</caption>
                      <thead>
                        <tr className="text-left text-mineral">
                          {tx(["Cadência declarada", "Período aproximado", "Tolerância"], ["Declared cadence", "Approximate period", "Tolerance"]).map((h) => (
                            <th key={h} scope="col" className="border-b border-linha px-2 py-2 font-medium">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(pub.regras.sla).map(([k, v]) => (
                          <tr key={k} className="border-b border-linha">
                            <td className="px-2 py-1.5 capitalize text-carvao">{nomeCadencia[k] ?? k}</td>
                            <td className="px-2 py-1.5 tabular-nums text-carvao-muted">{dias(v.periodo_dias_aprox)}</td>
                            <td className="px-2 py-1.5 tabular-nums text-carvao-muted">{dias(v.tolerancia_dias)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DadosAuditoria>

                <DadosLimitacoes
                  itens={[
                    limitacaoInicioDoRegistro(inicioRegistro, primeiroDiaComRevisao(pub.calendario), prov.limitacoes),
                    tx(
                      <>A situação vale para {dataBR(r.hoje)}. Os conjuntos novos e as capturas posteriores só entram na próxima atualização do observatório.</>,
                      <>The status applies to {dataBR(r.hoje)}. New datasets and later captures only come in at the next update of the observatory.</>,
                    ),
                    ...prov.limitacoes
                      .filter((l) => !/reconstru[ií]dos em/.test(l))
                      .map((l) => (
                        <TrechoPortugues key={l} regiao="saude-limitacoes">
                          {limitacaoParaLeitor(l)}
                        </TrechoPortugues>
                      )),
                  ]}
                  tecnicas={prov.limitacoes
                    .filter((l) => limitacaoParaLeitor(l) !== l)
                    .map((l) => (
                      <TrechoPortugues key={l} regiao="saude-limitacoes">
                        {l}
                      </TrechoPortugues>
                    ))}
                />

                <SecaoDoPainel id="arquivos" titulo={tx("Quais arquivos posso baixar?", "Which files can I download?")}>
                  <DadosArquivos itens={arquivos} />
                </SecaoDoPainel>
                <DadosSeguir ancora="painel-saude" proximo={{ href: "/setor-eletrico/dados/reproducao", pergunta: tx("Consigo reproduzir este gráfico?", "Can I reproduce this chart?") }} downloads={[]} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
