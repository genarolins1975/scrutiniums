import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import { tx } from "@/lib/energia/idioma";
import Link from "@/components/i18n/LinkIdioma";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { Histograma } from "@/components/energia/Histograma";
import { LeiloesAlternar } from "@/components/energia/LeiloesOpcoes";
import { FrasesCitaveis, LeiloesIndisponivel, ListaRegras } from "@/components/energia/LeiloesPagina";
import { NavegacaoLocal } from "@/components/energia/NavegacaoLocal";
import { Numero } from "@/components/energia/Numero";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaDados } from "@/components/energia/TabelaDados";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia, type ProvenienciaComplementar } from "@/components/evidencia/PainelEvidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { montaHistograma } from "@/lib/energia/distribuicao";
import { carimbo, dataBR, mesAno, num, pct } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import { comNomes, regraLeilao, regraLeilaoTraduzida } from "@/lib/energia/i18n/empresas-leiloes";
import { PAGINAS_LEILOES, ROTA_LEILOES, ROTA_LEILOES_TRANSMISSAO, fonteTransmissao, frasesTransmissao } from "@/lib/energia/leiloes";
import type { ExpansaoGold } from "@/lib/energia/tipos-expansao";
import type { LeiloesGold } from "@/lib/energia/tipos-leiloes";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/leiloes/transmissao", {
    title: tx("Leilões de transmissão: receita contratada corrigida pelo IPCA e deságio por lote", "Transmission auctions: contracted revenue adjusted by the IPCA and discount by lot"),
    description: tx(
      "Os leilões de linhas e subestações da ANEEL desde 1999: receita anual permitida (RAP) contratada por ano em reais da época e corrigida pelo IPCA, deságio de cada lote, lotes sem vencedor, extensão de linhas e quem venceu.",
      "ANEEL's transmission line and substation auctions since 1999: allowed annual revenue (RAP) contracted per year in reais of the time and adjusted by the IPCA, the discount of each lot, lots without a winner, line length and who won.",
    ),
    alternates: { canonical: ROTA_LEILOES_TRANSMISSAO },
  }, anterior);
}

const link = "text-energia-dark underline underline-offset-4 hover:text-carvao";

/** Regra da gold no idioma da página; sem forma inglesa, o trecho sai marcado como só em português. */
function Regra({ texto, regiao }: { texto: string; regiao: string }) {
  return regraLeilaoTraduzida(texto) ? <>{comNomes(regraLeilao(texto))}</> : <TrechoPortugues regiao={regiao}>{texto}</TrechoPortugues>;
}

export default function LeiloesTransmissaoPage() {
  const g = lerGold<LeiloesGold>("leiloes.json");
  if (!integra(g)) return <LeiloesIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;
  const exp = lerGold<ExpansaoGold>("expansao.json");
  const lei = integra(exp) ? exp.transmissao.leiloes : null;
  const t = g.transmissao;
  const ipca = mesAno(g.referencias.ipca_ate);
  const semData = tx("sem data", "no date");
  const periodo = tx(
    `${t.periodo.inicio?.slice(0, 4) ?? semData} a ${t.periodo.fim?.slice(0, 4) ?? semData}`,
    `${t.periodo.inicio?.slice(0, 4) ?? semData} to ${t.periodo.fim?.slice(0, 4) ?? semData}`,
  );
  const ult = t.por_ano.at(-1);
  const totalReal = t.por_ano.reduce((s, x) => s + (x.rap_vencedora_real_rs_mi ?? 0), 0);
  const hist = montaHistograma(t.desagios, { largura: 5 });
  const frases = frasesTransmissao(g);
  const porAnoExp = new Map((lei?.por_ano ?? []).map((x) => [x.ano, x]));
  const FONTE_TRANSMISSAO = fonteTransmissao();
  const rsMi = tx("R$ milhões", "R$ million");

  const oQueMudou = ult
    ? tx(
        <>
          O último ano com leilão no arquivo é {ult.ano}: {num(ult.lotes_contratados, 0)} lotes contratados, RAP de R$ {num(ult.rap_vencedora_real_rs_mi, 1)} milhões em
          reais de {ipca} e deságio agregado de {pct(ult.desagio_agregado_pct, 2)}. O arquivo termina em {dataBR(t.periodo.fim)}.
        </>,
        <>
          The latest year with an auction in the file is {ult.ano}: {num(ult.lotes_contratados, 0)} lots contracted, a RAP of R$ {num(ult.rap_vencedora_real_rs_mi, 1)} million
          in reais of {ipca} and an aggregate discount of {pct(ult.desagio_agregado_pct, 2)}. The file ends on {dataBR(t.periodo.fim)}.
        </>,
      )
    : tx(<>Sem lote contratado no arquivo.</>, <>No lot contracted in the file.</>);
  const comoInterpretar = tx(
    <>
      A RAP é a receita anual que a transmissora vencedora recebe para construir, operar e manter as instalações; vence quem pede a menor. O
      deságio de cada lote é a redução da RAP vencedora sobre a RAP do edital. Valores da época corrigidos pelo IPCA do mês do leilão até {ipca}.
    </>,
    <>
      The RAP is the annual revenue the winning transmission company receives to build, operate and maintain the facilities; whoever asks for the lowest
      wins. The discount of each lot is the reduction of the winning RAP from the tender RAP. Values of the time adjusted by the IPCA from the auction month
      up to {ipca}.
    </>,
  );
  const naoConcluir = tx(
    <>
      Que deságio alto significa obra mais barata ou mais eficiente: lotes têm extensões, tensões e riscos diferentes, e a RAP do edital é uma
      estimativa regulatória. Que a RAP do leilão é a receita vigente: ela é reajustada e revista pela ANEEL. Que não houve leilão depois de{" "}
      {dataBR(t.periodo.fim)}: o arquivo aberto termina aí.
    </>,
    <>
      That a high discount means a cheaper or more efficient project: lots have different lengths, voltages and risks, and the tender RAP is a regulatory
      estimate. That the auction RAP is the current revenue: it is adjusted and reviewed by ANEEL. That no auction took place after{" "}
      {dataBR(t.periodo.fim)}: the open file ends there.
    </>,
  );
  const complementares: ProvenienciaComplementar[] = [{ rotulo: tx("Correção pelo IPCA", "IPCA adjustment"), p: g.proveniencia.preco_real }];

  return (
    <>
      <CabecalhoEnergia atual="leiloes" />
      <MarcaVisita secao="energia:leiloes" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <NavegacaoLocal rotulo={tx("Páginas de leilões", "Auction pages")} itens={PAGINAS_LEILOES.map((p) => ({ ...p }))} atual="transmissao" />
        <CabecalhoModulo
          siglas={["ANEEL", "RAP", "IPCA", "SIGET", "EPE"]}
          rotulo={tx("Preços e mercado · Leilões · Transmissão", "Prices and market · Auctions · Transmission")}
          titulo={tx("Quanto os leilões de transmissão contrataram, corrigido pelo IPCA", "How much the transmission auctions contracted, adjusted by the IPCA")}
          lead={tx(
            <>
              Linhas e subestações são concedidas em leilão: vence quem aceita a menor receita anual (RAP) para construir e operar a instalação. Esta
              página corrige a RAP de cada lote pelo IPCA e mostra o deságio lote a lote.
            </>,
            <>
              Lines and substations are granted by auction: whoever accepts the lowest annual revenue (RAP) to build and operate the facility wins. This page
              adjusts the RAP of each lot by the IPCA and shows the discount lot by lot.
            </>,
          )}
          recorte={tx(`${periodo} · ${num(t.lotes_contratados, 0)} lotes contratados · R$ milhões e %`, `${periodo} · ${num(t.lotes_contratados, 0)} lots contracted · R$ million and %`)}
          fonte={`${FONTE_TRANSMISSAO}; IBGE, IPCA`}
          limite={tx(
            `O arquivo aberto termina no leilão de ${dataBR(t.periodo.fim)}; anos posteriores aparecem como ausência.`,
            `The open file ends with the auction of ${dataBR(t.periodo.fim)}; later years appear as missing.`,
          )}
          referencia={tx(
            <>
              {FONTE_TRANSMISSAO}, como lido pelo módulo Expansão (arquivo até {dataBR(t.periodo.fim)}); IPCA do IBGE até {ipca}. Processado em {carimbo(g.gerado_em)}.
            </>,
            <>
              {FONTE_TRANSMISSAO}, as read by the Expansion module (file up to {dataBR(t.periodo.fim)}); IBGE IPCA up to {ipca}. Processed on {carimbo(g.gerado_em)}.
            </>,
          )}
          metricas={
            <FaixaMetricas
              colunas={4}
              rotulo={tx("Leilões de transmissão na base da ANEEL", "Transmission auctions in the ANEEL database")}
              nota={tx(`Período: ${periodo}. Reais de ${ipca}.`, `Period: ${periodo}. Reais of ${ipca}.`)}
            >
              <Numero
                variante="faixa"
                rotulo={tx("Lotes contratados", "Lots contracted")}
                natureza="OBSERVADO"
                valor={t.lotes_contratados}
                casas={0}
                unidade={lei ? tx(`de ${num(lei.lotes, 0)} ofertados`, `of ${num(lei.lotes, 0)} offered`) : tx("lotes", "lots")}
                periodo={periodo}
              />
              <Numero
                variante="faixa"
                rotulo={tx("Soma das RAPs anuais contratadas", "Sum of the annual RAPs contracted")}
                natureza="CALCULADO"
                valor={totalReal}
                casas={0}
                unidade={tx(`R$ milhões de ${ipca} por ano`, `R$ million of ${ipca} per year`)}
                periodo={periodo}
              />
              <Numero variante="faixa" rotulo={tx("Deságio mediano por lote", "Median discount per lot")} natureza="CALCULADO" valor={t.desagio_lotes.mediana} formato="pct" casas={1} periodo={periodo} />
              <Numero
                variante="faixa"
                rotulo={tx(`Deságio agregado em ${ult?.ano ?? "sem ano"}`, `Aggregate discount in ${ult?.ano ?? "no year"}`)}
                natureza="CALCULADO"
                valor={ult?.desagio_agregado_pct ?? null}
                formato="pct"
                casas={1}
                periodo={ult?.ano ?? ""}
              />
            </FaixaMetricas>
          }
        >
          {tx(
            <>
              A leitura do arquivo, as obras em andamento e os contratos de concessão estão em{" "}
              <Link href="/setor-eletrico/expansao/geracao-e-transmissao#p042" className={link}>
                Expansão, geração e transmissão
              </Link>
              ; esta página acrescenta a correção pelo IPCA e o deságio de cada lote. Os leilões de geração estão na{" "}
              <Link href={ROTA_LEILOES} className={link}>
                página do ACR
              </Link>
              .
            </>,
            <>
              The reading of the file, the works in progress and the concession contracts are in{" "}
              <Link href="/setor-eletrico/expansao/geracao-e-transmissao#p042" className={link}>
                Expansion, generation and transmission
              </Link>
              ; this page adds the IPCA adjustment and the discount of each lot. Generation auctions are on the{" "}
              <Link href={ROTA_LEILOES} className={link}>
                ACR page
              </Link>
              .
            </>,
          )}
        </CabecalhoModulo>

        <ModoProfundidade>
          <Bloco id="transmissao">
            <PainelEvidencia
              id="painel-leiloes-transmissao"
              pergunta={tx("Leilões de transmissão: receita contratada, deságio e lotes sem vencedor", "Transmission auctions: contracted revenue, discount and lots without a winner")}
              subtitulo={tx("RAP vencedora em R$ milhões (da época e corrigida pelo IPCA), deságio em %, lotes", "Winning RAP in R$ million (of the time and adjusted by the IPCA), discount in %, lots")}
              natureza="CALCULADO"
              porQueImporta={tx(
                <>
                  A RAP das transmissoras é paga por geradores e consumidores pelo uso da rede e entra na conta de luz. Os leilões definem quanto
                  custará cada linha nova por décadas.
                </>,
                <>
                  The transmission companies&apos; RAP is paid by generators and consumers for the use of the grid and goes into the electricity bill. The
                  auctions set how much each new line will cost for decades.
                </>,
              )}
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={g.proveniencia.transmissao}
              complementares={complementares}
            >
              <div className="space-y-10">
                <SecaoDoPainel id="como-funciona" titulo={tx("Como funciona um leilão de transmissão", "How a transmission auction works")}>
                  <ol className="grid gap-3 md:grid-cols-4">
                    {[
                      [tx("Planejamento", "Planning"), tx("A EPE e o ONS indicam as obras de rede necessárias; o lote reúne linhas e subestações.", "The EPE and the ONS identify the grid works needed; a lot groups lines and substations.")],
                      [tx("Edital", "Tender"), tx("A ANEEL publica o lote com a RAP máxima, o prazo de obra e as exigências técnicas.", "ANEEL publishes the lot with the maximum RAP, the construction deadline and the technical requirements.")],
                      [tx("Leilão", "Auction"), tx("Vence quem pede a menor RAP. Deságio = 1 − RAP vencedora ÷ RAP do edital.", "Whoever asks for the lowest RAP wins. Discount = 1 − winning RAP ÷ tender RAP.")],
                      [
                        tx("Contrato", "Contract"),
                        tx(
                          "A vencedora assina o contrato de concessão, constrói e passa a receber a RAP quando a instalação entra em operação.",
                          "The winner signs the concession contract, builds and starts receiving the RAP when the facility enters operation.",
                        ),
                      ],
                    ].map(([a, b], i) => (
                      <li key={a} className="border-t-2 border-carvao bg-superficie px-3 py-2">
                        <span className="rotulo text-mineral">{i + 1}</span>
                        <p className="font-medium text-carvao">{a}</p>
                        <p className="mt-1 text-xs leading-relaxed text-carvao-muted">{b}</p>
                      </li>
                    ))}
                  </ol>
                </SecaoDoPainel>

                <SecaoDoPainel id="quanto" titulo={tx("Receita anual contratada por ano", "Annual revenue contracted per year")} lead={tx("Soma da RAP vencedora dos lotes contratados no ano.", "Sum of the winning RAP of the lots contracted in the year.")}>
                  <LeiloesAlternar
                    rotulo={tx("Reais", "Reais")}
                    nome="leiloes-t-rap"
                    opcoes={[
                      ["real", tx(`de ${ipca}`, `of ${ipca}`)],
                      ["nominal", tx("da época", "of the time")],
                    ]}
                    conteudo={{
                      real: (
                        <GraficoBarras
                          titulo={tx(`RAP vencedora contratada por ano do leilão, R$ milhões de ${ipca}`, `Winning RAP contracted by auction year, R$ million of ${ipca}`)}
                          dados={t.por_ano.map((x) => ({ ano: x.ano, rap: x.rap_vencedora_real_rs_mi }))}
                          chaveCategoria="ano" // i18n: dado
                          series={[{ id: "rap", rotulo: tx("RAP vencedora", "Winning RAP"), cor: "var(--cor-energia)" }]} // i18n: dado
                          unidade={rsMi}
                          casas={0}
                          altura={300}
                        />
                      ),
                      nominal: (
                        <GraficoBarras
                          titulo={tx("RAP vencedora contratada por ano do leilão, R$ milhões da época", "Winning RAP contracted by auction year, R$ million of the time")}
                          dados={t.por_ano.map((x) => ({ ano: x.ano, rap: x.rap_vencedora_rs_mi }))}
                          chaveCategoria="ano" // i18n: dado
                          series={[{ id: "rap", rotulo: tx("RAP vencedora", "Winning RAP"), cor: "var(--serie-referencia)" }]}
                          unidade={rsMi}
                          casas={0}
                          altura={300}
                        />
                      ),
                    }}
                  />
                  <TabelaDados
                    titulo={tx("Leilões de transmissão por ano", "Transmission auctions per year")}
                    colunas={[
                      tx("Ano", "Year"),
                      tx("Lotes contratados", "Lots contracted"),
                      tx("Lotes sem vencedor", "Lots without a winner"),
                      tx("km de linhas", "km of lines"),
                      tx("RAP da época (R$ mi)", "RAP of the time (R$ mn)"),
                      tx(`RAP de ${ipca} (R$ mi)`, `RAP of ${ipca} (R$ mn)`),
                      tx(`Investimento previsto de ${ipca} (R$ mi)`, `Planned investment of ${ipca} (R$ mn)`),
                      tx("Deságio agregado (%)", "Aggregate discount (%)"),
                    ]}
                    linhas={t.por_ano.map((x) => [
                      x.ano,
                      x.lotes_contratados,
                      porAnoExp.get(x.ano)?.lotes_sem_vencedor ?? null,
                      porAnoExp.get(x.ano)?.km ?? null,
                      x.rap_vencedora_rs_mi,
                      x.rap_vencedora_real_rs_mi,
                      x.investimento_real_rs_mi,
                      x.desagio_agregado_pct,
                    ])}
                    casas={[null, 0, 0, 1, 1, 1, 1, 2]}
                    limite={40}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="desagio" titulo={tx("Deságio de cada lote", "Discount of each lot")} lead={tx("Quanto a RAP vencedora ficou abaixo da RAP do edital, lote a lote.", "How far the winning RAP fell below the tender RAP, lot by lot.")}>
                  <Histograma
                    titulo={tx(`Deságio por lote contratado, ${periodo}`, `Discount per contracted lot, ${periodo}`)}
                    dados={hist}
                    rotuloX={tx("Deságio sobre a RAP do edital", "Discount below the tender RAP")}
                    unidade="%"
                    casas={1}
                    contagem={tx({ singular: "lote", plural: "lotes" }, { singular: "lot", plural: "lots" })}
                    periodo={periodo}
                    nota={tx(
                      `${num(t.lotes_desagio_zero, 0)} lotes saíram pela RAP do edital (deságio zero). ${t.regra_desagio}`,
                      `${num(t.lotes_desagio_zero, 0)} ${t.lotes_desagio_zero === 1 ? "lot was" : "lots were"} awarded at the tender RAP (zero discount). ${regraLeilao(t.regra_desagio)}`,
                    )}
                  />
                  <GraficoLinhas
                    titulo={tx("Deságio por ano: mediana dos lotes, faixa do 1º ao 3º quartil e agregado pela RAP", "Discount per year: median of the lots, 1st to 3rd quartile band and aggregate by RAP")}
                    dados={t.por_ano.map((x) => ({ ano: x.ano, mediana: x.desagio_mediano_lote_pct, p25: x.desagio_p25_pct, p75: x.desagio_p75_pct, agregado: x.desagio_agregado_pct }))}
                    chaveX="ano" // i18n: dado
                    formatoX="texto"
                    series={[
                      { id: "mediana", rotulo: tx("Mediana dos lotes", "Median of the lots"), cor: "var(--cor-energia)" }, // i18n: dado
                      { id: "agregado", rotulo: tx("Agregado pela RAP", "Aggregate by RAP"), cor: "var(--serie-referencia)", tracejada: true },
                    ]}
                    banda={{ inferior: "p25", superior: "p75", rotulo: tx("1º ao 3º quartil dos lotes", "1st to 3rd quartile of the lots") }}
                    unidade="%"
                    casas={1}
                    zeroNoEixo
                    altura={300}
                  />
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    {tx(
                      "Anos com poucos lotes têm faixa estreita ou de um ponto só. O arquivo não traz o número de proponentes de cada lote.",
                      "Years with few lots have a narrow band or a single point. The file does not include the number of bidders for each lot.",
                    )}
                  </p>
                </SecaoDoPainel>

                <SecaoDoPainel id="quem" titulo={tx("Quem venceu", "Who won")} lead={tx("Vencedores como publicados pela ANEEL, pelo número de lotes.", "Winners as published by ANEEL, by number of lots.")}>
                  <TabelaDados
                    titulo={tx("Vencedores com mais lotes contratados", "Winners with the most lots contracted")}
                    colunas={[tx("Vencedor publicado", "Published winner"), tx("Lotes", "Lots"), tx(`RAP vencedora de ${ipca} (R$ mi por ano)`, `Winning RAP of ${ipca} (R$ mn per year)`)]}
                    idiomaTexto={["nome"]}
                    linhas={t.vencedores.map((x) => [x.nome ?? tx("sem nome", "unnamed"), x.lotes, x.rap_vencedora_real_rs_mi])}
                    casas={[null, 0, 1]}
                  />
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    {tx(
                      <>
                        Nome como publicado no arquivo, sem CNPJ: consórcios e grafias diferentes da mesma empresa ficam separados ({num(t.vencedores_distintos, 0)} grafias distintas). Caracteres
                        trocados por &ldquo;?&rdquo; vêm do próprio arquivo.
                      </>,
                      <>
                        Name as published in the file, without CNPJ: consortia and different spellings of the same company stay separate ({num(t.vencedores_distintos, 0)} distinct spellings).
                        Characters replaced by &ldquo;?&rdquo; come from the file itself.
                      </>,
                    )}
                  </p>
                </SecaoDoPainel>

                {frases.length > 0 && (
                  <SecaoDoPainel id="citar" titulo={tx("Números para citar", "Numbers to cite")} lead={tx("Frases calculadas da base publicada, com data e fonte.", "Sentences calculated from the published database, with date and source.")}>
                    <FrasesCitaveis frases={frases} rotulo={tx("Frases citáveis sobre os leilões de transmissão", "Citable sentences about the transmission auctions")} />
                  </SecaoDoPainel>
                )}

                <SecaoDoPainel id="notas" titulo={tx("Leitura e downloads", "Reading and downloads")}>
                  <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />
                  <ul className="space-y-1 text-sm">
                    <li>
                      <a href="/energia/series/leiloes_transmissao_real.csv" className={link} download>
                        {tx("Leilões de transmissão por ano, corrigidos pelo IPCA (CSV)", "Transmission auctions per year, adjusted by the IPCA (CSV)")}
                      </a>
                    </li>
                    <li>
                      <a href="/energia/series/expansao_leiloes_transmissao.csv" className={link} download>
                        {tx("Lotes de transmissão, um por linha (CSV do módulo Expansão)", "Transmission lots, one per row (Expansion module CSV)")}
                      </a>
                    </li>
                  </ul>
                </SecaoDoPainel>

                <SecaoDoPainel nivel="auditar" id="regras" titulo={tx("Regras e cobertura", "Rules and coverage")}>
                  <ListaRegras
                    itens={[
                      [tx("Deságio", "Discount"), <Regra key="desagio" texto={t.regra_desagio} regiao="transmissao-regra-desagio" />],
                      [tx("Correção pelo IPCA", "IPCA adjustment"), <Regra key="real" texto={t.regra_real} regiao="transmissao-regra-real" />],
                      [
                        tx("Lotes sem vencedor", "Lots without a winner"),
                        lei?.regra_sem_vencedor ? <Regra key="sem-vencedor" texto={lei.regra_sem_vencedor} regiao="transmissao-regra-sem-vencedor" /> : tx("sem regra publicada nesta atualização", "no rule published in this update"),
                      ],
                      [
                        tx("Arquivo", "File"),
                        tx(
                          `Lotes de ${t.periodo.inicio ? dataBR(t.periodo.inicio) : "sem data"} a ${dataBR(t.periodo.fim)}; ${num(t.lotes_com_rap, 0)} de ${num(t.lotes_contratados, 0)} lotes contratados com as duas RAPs.`,
                          `Lots from ${t.periodo.inicio ? dataBR(t.periodo.inicio) : "no date"} to ${dataBR(t.periodo.fim)}; ${num(t.lotes_com_rap, 0)} of ${num(t.lotes_contratados, 0)} contracted lots with both RAPs.`,
                        ),
                      ],
                    ]}
                  />
                  {lei && lei.desagio_inconsistente_total > 0 && (
                    <p className="text-sm text-carvao-muted">
                      {tx(
                        <>
                          {lei.desagio_inconsistente_total} lotes têm deságio publicado diferente do calculado pelas RAPs (
                          {lei.desagio_inconsistente.map((x) =>
                            // i18n: dado (forma portuguesa do tx)
                            `${x.lote}: ${num(x.desagio_fonte_pct, 2)}% publicado, ${num(x.desagio_calculado_pct, 2)}% pelas RAPs`).join("; ")}); esta página usa o calculado.
                        </>,
                        <>
                          {lei.desagio_inconsistente_total} {lei.desagio_inconsistente_total === 1 ? "lot has" : "lots have"} a published discount different from the one calculated from the RAPs (
                          {lei.desagio_inconsistente.map((x) => `${x.lote}: ${num(x.desagio_fonte_pct, 2)}% published, ${num(x.desagio_calculado_pct, 2)}% from the RAPs`).join("; ")}); this page uses the calculated one.
                        </>,
                      )}
                    </p>
                  )}
                </SecaoDoPainel>
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
