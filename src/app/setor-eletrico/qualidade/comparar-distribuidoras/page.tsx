import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { marcarNomes } from "@/lib/energia/i18n/qualidade-perdas";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { Histograma } from "@/components/energia/Histograma";
import { Numero } from "@/components/energia/Numero";
import { QualidadeAviso, QualidadeIndisponivel, QualidadeNavegacao, QualidadePar, QualidadeRecorte } from "@/components/energia/QualidadePagina";
import { URL_SERIE_QUALIDADE, avisosFecDaPagina, semRazaoFecDaPagina, textosDaGold } from "@/components/energia/QualidadeServidor";
import { QualidadeComparador } from "@/components/energia/QualidadeComparador";
import { QualidadeLimites } from "@/components/energia/QualidadeLimites";
import { QualidadeTabela } from "@/components/energia/QualidadeTabela";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { SeguirPainel } from "@/components/energia/SeguirPainel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { QualidadeLevaEscolha } from "@/components/energia/QualidadeLevaEscolha";
import { carimbo, dataBR, num, pct } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import {
  avisoDefasagem,
  classificacaoNoIdioma,
  definicaoConjuntoCurta,
  downloadsDoPainel,
  histogramaDeFaixas,
  hrefPainelQualidade,
  itensLimites,
  limpaProveniencia,
  linhasHistoricoConjuntos,
  maioresDistribuidoras,
  metricasAbertura,
  mudancaP052,
  painelQualidade,
  paginasQualidade,
  recorteColunas,
  respostaP052,
  rotuloDistribuidora,
  tabelaQualidade,
  textoAtualidade,
  textoContagemFec,
  textoDivergenciasDgc,
  textoUniversosConjuntos,
  vereditoP052,
  type IdTabela,
} from "@/lib/energia/qualidade";
import type { QualidadeGold } from "@/lib/energia/tipos-qualidade";

/**
 * Comparar distribuidoras (P052): cada distribuidora e cada conjunto diante do próprio limite. Saiu da entrada de Qualidade no
 * diagnóstico de layout de 20/10/2026 (item 6), onde era o maior capítulo (8,7 mil px no celular): a entrada responde ao leitor pelo
 * município, e quem quer comparar empresas chega aqui com a escolha no endereço (?dist=). O conteúdo, as tabelas, os downloads e as
 * provas são os mesmos do painel; nada foi cortado.
 */

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/qualidade/comparar-distribuidoras", {
    title: tx("Comparar distribuidoras: falta de luz diante do próprio limite", "Compare distribution utilities: power cuts against their own limit"),
    description: tx(
      "DEC e FEC de cada distribuidora e de cada conjunto diante do limite regulatório do mesmo ano (ANEEL), a distribuição dos conjuntos, a série anual e a reconciliação do DGC do ranking.",
      "DEC and FEC of each distribution utility and each consumer set against the regulatory limit of the same year (ANEEL), the distribution of the consumer sets, the annual series and the reconciliation of the ranking's DGC.",
    ),
    alternates: { canonical: "/setor-eletrico/qualidade/comparar-distribuidoras" },
  }, anterior);
}

export default function CompararDistribuidorasPage() {
  const g = lerGold<QualidadeGold>("qualidade.json");
  if (!integra(g)) return <QualidadeIndisponivel motivo={g?.motivo} />;

  const ref = g.ano_referencia;
  const c = g.conjuntos;
  const idioma = idiomaEnergia();
  const prov = Object.fromEntries(Object.entries(g.proveniencia).map(([k, x]) => [k, limpaProveniencia(x)])) as QualidadeGold["proveniencia"];
  const { regras } = textosDaGold(g);
  const m = metricasAbertura(g);
  const avisos = avisosFecDaPagina(g);
  const semRazaoFec = semRazaoFecDaPagina(g);
  const contagemFec = textoContagemFec(g, semRazaoFec);
  const defasagem = avisoDefasagem(prov.conjuntos.publicado_pela_fonte_em, g.gerado_em);
  const histConjuntos = linhasHistoricoConjuntos(g.conjuntos);
  const histUcs = recorteColunas(histConjuntos, ["ano", "pct_ucs_acima", "pct_acima"]); // i18n: dado
  const histRazoes = recorteColunas(histConjuntos, ["ano", "razao_p50", "razao_p90"]); // i18n: dado
  const entidades = g.distribuidoras
    .map((d) => ({
      id: d.cnpj,
      rotulo: rotuloDistribuidora(d),
      detalhe: [d.nome_comercial, d.classificacao ? classificacaoNoIdioma(d.classificacao) : null].filter(Boolean).join(", ") || undefined,
      sinonimos: [d.cnpj],
    }))
    .sort((x, y) => x.rotulo.localeCompare(y.rotulo, "pt-BR"));
  const maiores = maioresDistribuidoras(g);
  const histRazao = histogramaDeFaixas(c.histograma_razao_dec, c.quantis_razao_dec);
  const ultimaFaixaRazao = c.histograma_razao_dec.at(-1) ?? null;
  const n = (id: IdTabela) => tabelaQualidade(id, g).linhas.length;
  const p052 = painelQualidade("p052");
  const p053 = painelQualidade("p053");
  const pagina = paginasQualidade().find((p) => p.id === "comparar")!;
  // o mesmo universo da entrada: distribuidoras com DEC anual no ano de referência
  const distComDec = g.distribuidoras.filter((d) => d.dec !== null).length;

  const comoInterpretarP052 = (
    <>
      {tx(
        "No gráfico de pontos, o círculo é o apurado e o losango o limite agregado da distribuidora (limites dos conjuntos ponderados pelas UCs médias do ano); a diferença está escrita.",
        "In the dot chart, the circle is the assessed value and the diamond the distribution utility's aggregate limit (limits of the consumer sets weighted by the average UCs of the year); the difference is stated.",
      )}{" "}
      {regras.limite_centesimos}
      {tx(" No histograma, à direita de 1 está o que passou do limite.", " In the histogram, what exceeded the limit is to the right of 1.")}
    </>
  );
  const naoConcluirP052 = (
    <>
      {tx(
        "Abaixo do limite agregado não quer dizer que todos os conjuntos da distribuidora ficaram abaixo, nem que nenhum consumidor teve o limite individual violado. Limites diferem entre conjuntos e anos: uma razão menor não compara áreas com limites diferentes. A razão do Brasil não é um limite oficial nacional.",
        "Below the aggregate limit does not mean that all of the distribution utility's consumer sets were below it, nor that no consumer had an individual limit violated. Limits differ between consumer sets and years: a lower ratio does not compare areas with different limits. Brazil's ratio is not an official national limit.",
      )}
    </>
  );

  return (
    <>
      <header><CabecalhoPlataforma colecao="energia" destinoConta="/setor-eletrico" navegacao="setor-eletrico" idiomas /></header>
      <MarcaVisita secao="energia:qualidade" />
      <QualidadeLevaEscolha />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          rotulo={tx("Qualidade do serviço · Comparar distribuidoras", "Quality of supply · Compare distribution utilities")}
          siglas={["DEC", "FEC", "UC", "DGC", "ANEEL"]}
          titulo={pagina.pergunta}
          lead={tx(
            "Cada área tem um limite próprio de horas e de vezes sem luz por ano, fixado pela ANEEL. Esta página põe cada distribuidora e cada conjunto diante do seu limite, ano a ano, e mostra quantos passaram dele.",
            "Each area has its own limit of hours and times without power per year, set by ANEEL. This page sets each distribution utility and each consumer set against its own limit, year by year, and shows how many exceeded it.",
          )}
          recorte={tx(`${c.ano} · ${distComDec} distribuidoras e ${num(c.com_limite, 0)} conjuntos · razão apurado ÷ limite`, `${c.ano} · ${distComDec} distribution utilities and ${num(c.com_limite, 0)} consumer sets · assessed ÷ limit ratio`)}
          fonte={tx("ANEEL, indicadores coletivos de continuidade e limites", "ANEEL, collective continuity indicators and limits")}
          limite={tx(
            "o que cada consumidor viveu: abaixo do limite agregado, parte dos conjuntos e das unidades pode ter passado do próprio limite.",
            "what each consumer experienced: below the aggregate limit, some consumer sets and units may have exceeded their own limit.",
          )}
          referencia={tx(
            <>
              {textoAtualidade(g)} Indicadores publicados pela ANEEL em {dataBR(prov.conjuntos.publicado_pela_fonte_em?.slice(0, 10) ?? null)}; processado em {carimbo(g.gerado_em)}.
            </>,
            <>
              {textoAtualidade(g)} Indicators published by ANEEL on {dataBR(prov.conjuntos.publicado_pela_fonte_em?.slice(0, 10) ?? null)}; processed on {carimbo(g.gerado_em)}.
            </>,
          )}
          metricas={
            <>
              {defasagem && <QualidadeAviso>{defasagem}</QualidadeAviso>}
              <FaixaMetricas colunas={2} rotulo={tx("Conjuntos e unidades acima do limite", "Consumer sets and units above the limit")}>
                <Numero
                  variante="faixa"
                  rotulo={tx("Conjuntos acima do limite de DEC", "Consumer sets above the DEC limit")}
                  natureza="CALCULADO"
                  valor={m.conjuntos.pct}
                  formato="pct"
                  casas={1}
                  unidade={tx("dos conjuntos", "of the consumer sets")}
                  periodo={String(m.conjuntos.ano)}
                  evidencia={g.evidencias.conjuntos_acima_limite ?? null}
                  nota={
                    <>
                      {tx(
                        <>
                          {num(m.conjuntos.acima, 0)} de {num(m.conjuntos.comLimite, 0)} conjuntos. {definicaoConjuntoCurta()}
                        </>,
                        <>
                          {num(m.conjuntos.acima, 0)} of {num(m.conjuntos.comLimite, 0)} consumer sets. {definicaoConjuntoCurta()}
                        </>,
                      )}
                      {m.conjuntos.pctAnterior !== null && tx(` Em ${m.conjuntos.anoAnterior}: ${pct(m.conjuntos.pctAnterior, 1)}.`, ` In ${m.conjuntos.anoAnterior}: ${pct(m.conjuntos.pctAnterior, 1)}.`)}
                    </>
                  }
                  cor="var(--serie-referencia)"
                />
                <Numero
                  variante="faixa"
                  rotulo={tx("Unidades consumidoras nesses conjuntos", "Consumer units in those consumer sets")}
                  natureza="CALCULADO"
                  valor={c.pct_ucs_acima_limite_dec}
                  formato="pct"
                  casas={1}
                  unidade={tx("das UCs", "of the UCs")}
                  periodo={String(c.ano)}
                  motivoAusencia={tx("Unidades por conjunto não publicadas para o ano.", "Units per consumer set not published for the year.")}
                  nota={tx(
                    "Leitura principal: a parte das unidades consumidoras que está em conjuntos acima do limite. Um conjunto pequeno pesa menos que um grande.",
                    "Main reading: the share of consumer units in consumer sets above the limit. A small consumer set weighs less than a large one.",
                  )}
                  cor="var(--cor-energia)"
                />
              </FaixaMetricas>
            </>
          }
        >
          {tx(
            <>
              A ANEEL fixa limites de <Termo slug="dec">DEC</Termo> (horas sem luz por unidade consumidora) e de <Termo slug="fec">FEC</Termo> (vezes) para cada{" "}
              <Termo slug="conjunto-eletrico">conjunto elétrico</Termo>. O limite agregado da distribuidora pondera os limites dos conjuntos pelas unidades de cada um. A duração, as
              compensações e o atendimento estão na entrada de Qualidade.
            </>,
            <>
              ANEEL sets <Termo slug="dec">DEC</Termo> (hours without power per consumer unit) and <Termo slug="fec">FEC</Termo> (times) limits for each{" "}
              <Termo slug="conjunto-eletrico">consumer set</Termo>. The distribution utility&apos;s aggregate limit weights the consumer sets&apos; limits by the units of each one.
              Duration, compensation payments and customer service are on the Quality of supply entry page.
            </>,
          )}
        </CabecalhoModulo>
        <QualidadeNavegacao atual="comparar" />

        <ModoProfundidade>
          {/* ---------------- P052 ---------------- */}
          <Bloco id={p052.ancora}>
            <PainelEvidencia
              id={p052.id}
              pergunta={p052.titulo}
              subtitulo={tx("DEC e FEC apurados diante do limite regulatório do mesmo ano · razão apurado ÷ limite", "Assessed DEC and FEC against the regulatory limit of the same year · assessed ÷ limit ratio")}
              natureza="CALCULADO"
              porQueImporta={
                <>
                  {tx(
                    <>
                      A ANEEL fixa limites de DEC e de FEC para cada <Termo slug="conjunto-eletrico">conjunto</Termo> com a periodicidade das revisões tarifárias. Segundo a ANEEL, o
                      descumprimento traz consequências à distribuidora, como plano de resultados e limitação de proventos aos acionistas, e o ranking da continuidade parte da distância ao
                      limite: ela mostra quem está perto, quem passou e por quanto.
                    </>,
                    <>
                      ANEEL sets DEC and FEC limits for each <Termo slug="conjunto-eletrico">consumer set</Termo> at the frequency of the tariff reviews. According to ANEEL, non-compliance
                      has consequences for the distribution utility, such as a results plan and a limit on payouts to shareholders, and the continuity ranking starts from the distance to the
                      limit: it shows who is close, who exceeded it and by how much.
                    </>,
                  )}
                </>
              }
              oQueMudou={mudancaP052(c)}
              comoInterpretar={comoInterpretarP052}
              naoConcluir={naoConcluirP052}
              naoConcluirNoCorpo
              proveniencia={prov.limites}
              complementares={[{ rotulo: tx("Ranking da continuidade (DGC publicado)", "Continuity ranking (published DGC)"), p: prov.ranking }]}
            >
              <div className="space-y-6">
                <RespostaCurta id={p052.id} veredito={vereditoP052(g)}>
                  {respostaP052(g)}{" "}
                  {marcarNomes(contagemFec, [...(semRazaoFec?.acima ?? []).flatMap((x) => [x.nome, x.sigla]), ...(semRazaoFec?.porDistribuidora ?? []).map((x) => x.sigla)], idioma)}
                </RespostaCurta>

                <QualidadeLimites
                  ano={ref}
                  itens={itensLimites(g)}
                  avisosFec={avisos}
                  totalLinhas={n("limites")}
                  urlSerie={URL_SERIE_QUALIDADE}
                />

                <QualidadeRecorte
                  periodo={tx(
                    <>
                      Ano de apuração {c.ano}, com o limite do mesmo ano; histórico de {c.historico[0]?.ano ?? c.ano} a {c.ano}
                    </>,
                    <>
                      Assessment year {c.ano}, with the limit of the same year; history from {c.historico[0]?.ano ?? c.ano} to {c.ano}
                    </>,
                  )}
                  universo={tx(
                    <>
                      {num(c.com_limite, 0)} conjuntos com 12 meses e limite; {g.distribuidoras.length} distribuidoras com indicadores de continuidade ({g.distribuidoras.filter((d) => d.dec === null).length} sem valor anual); as encerradas ou absorvidas, listadas em Perdas e em Minha região, não têm
                    </>,
                    <>
                      {num(c.com_limite, 0)} consumer sets with 12 months and a limit; {g.distribuidoras.length} distribution utilities with continuity indicators ({g.distribuidoras.filter((d) => d.dec === null).length} with no annual value); those that closed or were absorbed, listed in Losses and in My region, have none
                    </>,
                  )}
                  unidade={tx(
                    <>
                      horas (DEC), interrupções (FEC) e razão apurado ÷ limite (adimensional). DGC, o desempenho global de continuidade: média simples de DEC ÷ limite e FEC ÷ limite, calculada
                      aqui e publicada no ranking da ANEEL, lado a lado na tabela.
                    </>,
                    <>
                      hours (DEC), interruptions (FEC) and assessed ÷ limit ratio (dimensionless). DGC, the overall continuity performance: simple average of DEC ÷ limit and FEC ÷ limit,
                      calculated here and published in the ANEEL ranking, side by side in the table.
                    </>,
                  )}
                />

                <NotasDoPainel oQueMudou={mudancaP052(c)} comoInterpretar={comoInterpretarP052} naoConcluir={naoConcluirP052} />

                <SecaoDoPainel
                  id="comparar-distribuidoras"
                  titulo={tx("Como cada distribuidora se compara com o próprio limite, ano a ano?", "How does each distribution utility compare with its own limit, year by year?")}
                  lead={tx(
                    `Sem escolha no link, entram as quatro maiores distribuidoras em UCs em ${ref}. A linha tracejada é o limite de cada ano; os painéis usam a mesma escala, e com mais de uma distribuidora dá para trocar para a escala própria. Incorporações mudam a área da distribuidora e aparecem na nota do painel.`,
                    `With no choice in the link, the four largest distribution utilities by UCs in ${ref} are shown. The dashed line is the limit of each year; the panels use the same scale, and with more than one distribution utility you can switch to each panel's own scale. Mergers change the distribution utility's area and appear in the panel note.`,
                  )}
                >
                  <QualidadeComparador entidades={entidades} padrao={maiores} urlSerie={URL_SERIE_QUALIDADE} avisosFec={avisos} />
                </SecaoDoPainel>

                <SecaoDoPainel
                  id="distribuicao-dos-conjuntos"
                  titulo={tx("Como os conjuntos se distribuem diante do limite? A média esconde as caudas", "How are the consumer sets distributed against the limit? The average hides the tails")}
                >
                  <Histograma
                    titulo={tx(`Conjuntos por razão DEC ÷ limite, ${c.ano}`, `Consumer sets by DEC ÷ limit ratio, ${c.ano}`)}
                    dados={histRazao}
                    rotuloX={tx("DEC apurado ÷ limite do conjunto", "Assessed DEC ÷ limit of the consumer set")}
                    unidade={tx("vezes o limite", "times the limit")}
                    casas={2}
                    contagem={tx({ singular: "conjunto", plural: "conjuntos" }, { singular: "consumer set", plural: "consumer sets" })}
                    periodo={String(c.ano)}
                    valorAtual={{ valor: 1, rotulo: tx("Limite", "Limit") }}
                    cor="var(--cor-energia)"
                    nota={tx(
                      `P10 a P90 são percentis: P90 é a razão abaixo da qual ficam 90% dos conjuntos. Com faixas de larguras diferentes, a altura da barra é densidade, não contagem.${
                        ultimaFaixaRazao && ultimaFaixaRazao.ate === null && c.quantis_razao_dec.max !== null
                          ? ` A última faixa é aberta na fonte (${num(ultimaFaixaRazao.de, 2)} vezes o limite ou mais) e é desenhada até o máximo (${num(c.quantis_razao_dec.max, 2)}).`
                          : ""
                      } ${num(c.iguais_limite_dec, 0)} conjuntos com DEC igual ao limite não contam como acima.`,
                      `P10 to P90 are percentiles: P90 is the ratio below which 90% of the consumer sets lie. With bins of different widths, bar height is density, not count.${
                        ultimaFaixaRazao && ultimaFaixaRazao.ate === null && c.quantis_razao_dec.max !== null
                          ? ` The last bin is open in the source (${num(ultimaFaixaRazao.de, 2)} times the limit or more) and is drawn up to the maximum (${num(c.quantis_razao_dec.max, 2)}).`
                          : ""
                      } ${num(c.iguais_limite_dec, 0)} consumer sets with DEC equal to the limit do not count as above.`,
                    )}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="ano-a-ano" titulo={tx("Quantos conjuntos passaram do limite, ano a ano?", "How many consumer sets exceeded the limit, year by year?")} lead={textoUniversosConjuntos(g)}>
                  <QualidadePar>
                    <GraficoLinhas
                      titulo={tx(`Unidades consumidoras e conjuntos acima do limite de DEC, ${c.historico[0]?.ano ?? ""} a ${c.ano}`, `Consumer units and consumer sets above the DEC limit, ${c.historico[0]?.ano ?? ""} to ${c.ano}`)}
                      dados={histUcs}
                      chaveX="ano" // i18n: dado
                      formatoX="texto"
                      series={[
                        { id: "pct_ucs_acima", rotulo: tx("% das unidades consumidoras (leitura principal)", "% of consumer units (main reading)"), sigla: "UCs", cor: "var(--cor-energia)" }, // i18n: dado
                        { id: "pct_acima", rotulo: tx("% dos conjuntos", "% of consumer sets"), sigla: tx("Conjuntos", "Clusters"), cor: "var(--serie-sm-se)" },
                      ]}
                      unidade="%"
                      casas={1}
                      zeroNoEixo
                    />
                    <GraficoLinhas
                      titulo={tx("Razão DEC ÷ limite dos conjuntos: mediana e percentil 90", "DEC ÷ limit ratio of the consumer sets: median and 90th percentile")}
                      dados={histRazoes}
                      chaveX="ano" // i18n: dado
                      formatoX="texto"
                      series={[
                        { id: "razao_p50", rotulo: tx("Mediana dos conjuntos", "Median of the consumer sets"), sigla: tx("Mediana", "Median"), cor: "var(--cor-energia)" }, // i18n: dado
                        { id: "razao_p90", rotulo: tx("Percentil 90 dos conjuntos", "90th percentile of the consumer sets"), sigla: "P90", cor: "var(--serie-termica)" },
                      ]}
                      unidade={tx("vezes o limite", "times the limit")}
                      casas={3}
                      zeroNoEixo
                    />
                  </QualidadePar>
                </SecaoDoPainel>

                <SecaoDoPainel
                  id="matriz-limite-razao"
                  nivel="analisar"
                  titulo={tx("Limite apertado ou folgado: faixa do limite × distância a ele", "Tight or loose limit: limit band × distance to it")}
                >
                  <QualidadeTabela tabela="matriz" titulo={tx(`Conjuntos por faixa de limite de DEC e por razão DEC ÷ limite, ${c.ano}`, `Consumer sets by DEC limit band and by DEC ÷ limit ratio, ${c.ano}`)} linhas={n("matriz")} chaveUrl="tmat" />
                </SecaoDoPainel>

                <SecaoDoPainel id="pontas" nivel="analisar" titulo={tx("As pontas: os conjuntos mais distantes do limite e os de maior DEC", "The tails: the consumer sets furthest from the limit and those with the highest DEC")}>
                  <QualidadeTabela tabela="cauda-razao" titulo={tx(`Conjuntos com maior razão DEC ÷ limite, ${c.ano}`, `Consumer sets with the highest DEC ÷ limit ratio, ${c.ano}`)} linhas={n("cauda-razao")} chaveUrl="tcr" />
                  <QualidadeTabela tabela="cauda-dec" titulo={tx(`Conjuntos com maior DEC, ${c.ano}`, `Consumer sets with the highest DEC, ${c.ano}`)} linhas={n("cauda-dec")} chaveUrl="tcd" />
                </SecaoDoPainel>

                <SecaoDoPainel id="dgc" nivel="auditar" titulo={tx("DGC calculado × DGC publicado no ranking da ANEEL", "Calculated DGC × DGC published in the ANEEL ranking")}>
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    {regras.limite}
                    {tx(
                      " Tolerância de 0,01, a precisão do DGC publicado. Posição no ranking e DGC publicado são da ANEEL; o DGC calculado é do observatório.",
                      " Tolerance of 0.01, the precision of the published DGC. Ranking position and published DGC come from ANEEL; the calculated DGC is the observatory's.",
                    )}
                  </p>
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted" data-texto="divergencias-dgc">
                    {marcarNomes(
                      textoDivergenciasDgc(g),
                      g.reconciliacao.dgc.flatMap((r) => r.divergentes.map((d) => d.sigla_ranking ?? d.empresa)),
                      idioma,
                    )}
                  </p>
                  <QualidadeTabela tabela="dgc" titulo={tx("Reconciliação do DGC por ano", "DGC reconciliation by year")} linhas={n("dgc")} chaveUrl="tdgc" />
                </SecaoDoPainel>

                <SeguirPainel ancora={p052.ancora} downloads={downloadsDoPainel(g, "p052")} proximo={{ href: hrefPainelQualidade("p053", "comparar"), pergunta: p053.descricao }} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
