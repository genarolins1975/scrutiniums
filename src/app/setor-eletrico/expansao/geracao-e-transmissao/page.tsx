import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import Link from "@/components/i18n/LinkIdioma";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { ExpansaoMapaRede } from "@/components/energia/ExpansaoMapas";
import {
  ExpansaoAnalise,
  ExpansaoAuditoria,
  ExpansaoAusencia,
  ExpansaoDatas,
  ExpansaoIndisponivel,
  ExpansaoLimitacoes,
  ExpansaoNavegacao,
  ExpansaoNota,
  ExpansaoRecorte,
  ExpansaoSeguir,
  ExpansaoTabelaSimples,
  tamanhoPublicado,
} from "@/components/energia/ExpansaoPagina";
import { ExpansaoGeracaoRedeUf } from "@/components/energia/ExpansaoTransmissao";
import { CursorSincronizado } from "@/components/energia/CursorSincronizado";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import { tx } from "@/lib/energia/idioma";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { FONTE_MW_LIBERADA_EN, SEM_VENCEDOR_EN, rotuloDado } from "@/lib/energia/i18n/expansao-transicao-territorio";
import {
  colunasContratosAno,
  colunasContratosRecentes,
  colunasDesvioObras,
  colunasLeiloes,
  colunasObrasSituacao,
  colunasPrazosVencidos,
  colunasRedeTensao,
  fonteExpansao,
  semDado,
  DOWNLOADS_PAINEL,
  FONTE_EPE_REDE,
  FONTE_LEILOES,
  FONTE_LIBERACOES,
  FONTE_RALIE,
  FONTE_SIGET,
  dadosSerieKm,
  dadosSerieMva,
  dadosSerieMw,
  dataTexto,
  diasTexto,
  downloadsDe,
  inteiro,
  kmTexto,
  linhasContratosAno,
  linhasContratosRecentes,
  linhasDesvioObras,
  linhasGeracaoRedeUf,
  linhasLeiloes,
  linhasObrasSituacao,
  linhasPrazosVencidos,
  linhasRedeTensao,
  mudancaTransmissao,
  mvaTexto,
  painel,
  respostaTransmissao,
  vereditoTransmissao,
  provenienciasDoLeitor,
} from "@/lib/energia/expansao";
import type { ExpansaoGold } from "@/lib/energia/tipos-expansao";
import { datasLegiveis } from "@/lib/energia/visao";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/expansao/geracao-e-transmissao", {
    title: tx("Geração e transmissão: a expansão vem acompanhada de rede?", "Generation and transmission: does the expansion come with grid?"),
    description: tx(
      "Geração em implantação (RALIE) e obras de transmissão (SIGET) por UF lado a lado, linhas existentes e planejadas da EPE no mapa, leilões de transmissão, contratos de concessão e a série anual de MW liberados, km e MVA energizados, sem somar unidades diferentes.",
      "Generation under implementation (RALIE) and transmission works (SIGET) by state side by side, existing and planned EPE lines on the map, transmission auctions, concession contracts and the annual series of MW released, km and MVA energized, without adding different units.",
    ),
    alternates: { canonical: "/setor-eletrico/expansao/geracao-e-transmissao" },
  }, anterior);
}

const URL_REDE = "/energia/series/expansao_rede_epe.json";

export default function GeracaoTransmissaoPage() {
  const g = lerGold<ExpansaoGold>("expansao.json");
  if (!integra(g)) return <ExpansaoIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const t = g.transmissao;
  const o = t.obras;
  const l = t.leiloes;
  const ca = t.contratos_assinados;
  const rede = t.rede_epe;
  const p = provenienciasDoLeitor(g);
  const ev = g.evidencias;
  const pp = painel("p042");
  const serie = [...t.serie_anual].sort((a, b) => a.ano.localeCompare(b.ano));
  const capturaEpe = dataTexto(g.referencias.rede_epe_capturada_em);
  const dataSiget = dataTexto(o.data_referencia);
  const dataRalie = dataTexto(g.estagios.ralie.data_ralie);
  const marcosParciais = serie.filter((x) => x.ano_parcial).map((x) => ({ x: x.ano, rotulo: tx("ano parcial", "partial year") }));
  const complementares = [
    { rotulo: tx("Leilões de transmissão", "Transmission auctions"), p: p.leiloes },
    { rotulo: tx("Contratos de concessão", "Concession contracts"), p: p.contratos_transmissao },
    ...(p.rede_epe ? [{ rotulo: tx("Rede da EPE", "EPE grid"), p: p.rede_epe }] : []),
    { rotulo: tx("Geração em implantação", "Generation under implementation"), p: p.ralie },
  ];
  const oQueMudou = mudancaTransmissao(g);
  const comoInterpretar = tx(<>{g.regras.transmissao}</>, <TrechoPortugues regiao="expansao-regra-transmissao">{g.regras.transmissao}</TrechoPortugues>);
  const naoConcluir = tx(
    <>
      Se a rede é suficiente para a geração de uma UF: a capacidade de escoamento depende do desenho da rede (topologia) e dos limites dela, não de km ou MVA.
      Também não liga obra de transmissão a usina específica: a EPE e o SIGET não têm chave comum, e o vínculo publicado é territorial.
    </>,
    <>
      Whether the grid is enough for a state&apos;s generation: the capacity to carry it depends on the grid&apos;s design (topology) and its limits, not on km or MVA. Nor does it link a
      transmission work to a specific plant: EPE and SIGET have no common key, and the published link is territorial.
    </>,
  );
  const semVencedor = Object.entries(l.sem_vencedor_por_rotulo)
    .map(([k, n]) => tx(`${k.toLocaleLowerCase("pt-BR")} ${inteiro(n)}`, `${rotuloDado(k, SEM_VENCEDOR_EN, "en")} ${inteiro(n)}`))
    .join("; ");
  const fonteMw = serie.at(-1)?.fonte_mw_geracao_liberada;

  return (
    <>
      <CabecalhoEnergia atual="expansao" />
      <MarcaVisita secao="energia:expansao-geracao-e-transmissao" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <ExpansaoNavegacao atual="p042" />
        <CabecalhoModulo
          siglas={["RALIE", "RAP", "ANEEL", "EPE", "IBGE", "ONS"]}
          rotulo={tx("Expansão", "Expansion")}
          titulo={pp.pergunta}
          lead={tx(
            "Compare, por estado e por ano, a potência das usinas, a extensão das linhas e a capacidade de transformação. MW, quilômetros e MVA medem coisas diferentes: as séries ficam lado a lado, sem serem somadas.",
            "Compare, by state and by year, the capacity of the plants, the length of the lines and the transformation capacity. MW, kilometers and MVA measure different things: the series stay side by side, without being added.",
          )}
          recorte={tx(`RALIE de ${dataRalie} · SIGET de ${dataSiget} · MW, km e MVA`, `RALIE of ${dataRalie} · SIGET of ${dataSiget} · MW, km and MVA`)}
          fonte={tx("ANEEL, RALIE, SIGET e leilões; EPE, rede de transmissão", "ANEEL, RALIE, SIGET and auctions; EPE, transmission grid")}
          referencia={tx(
            <>
              SIGET da ANEEL de {dataSiget}; RALIE de {dataRalie}; leilões de transmissão de {dataTexto(l.periodo.inicio)} a {dataTexto(l.periodo.fim)}{" "}
              (arquivo publicado em {dataTexto(l.publicado_em)}); linhas da EPE capturadas em {capturaEpe}. Processado em {carimbo(g.gerado_em)}.
            </>,
            <>
              ANEEL&apos;s SIGET of {dataSiget}; RALIE of {dataRalie}; transmission auctions from {dataTexto(l.periodo.inicio)} to {dataTexto(l.periodo.fim)} (file published on{" "}
              {dataTexto(l.publicado_em)}); EPE lines captured on {capturaEpe}. Processed on {carimbo(g.gerado_em)}.
            </>,
          )}
          datas={
            <ExpansaoDatas
              itens={[
                { rotulo: "RALIE", texto: tx(`fotografia de ${dataRalie}`, `snapshot of ${dataRalie}`), natureza: "OBSERVADO" },
                { rotulo: "SIGET", texto: tx(`até ${dataSiget}`, `through ${dataSiget}`), natureza: "OBSERVADO" },
                { rotulo: tx("Leilões de transmissão", "Transmission auctions"), texto: tx(`até ${dataTexto(l.ultimo_leilao.data)}`, `through ${dataTexto(l.ultimo_leilao.data)}`), natureza: "OBSERVADO" },
                { rotulo: tx("Linhas da EPE", "EPE lines"), texto: tx(`capturadas em ${capturaEpe}`, `captured on ${capturaEpe}`), natureza: "OBSERVADO" },
              ]}
            />
          }
          metricas={
            <FaixaMetricas
              colunas={4}
              rotulo={tx("Indicadores de geração e transmissão", "Generation and transmission indicators")}
              nota={tx("MW, km e MVA medem coisas diferentes: lado a lado, sem soma nem divisão.", "MW, km and MVA measure different things: side by side, neither added nor divided.")}
            >
              <Numero
                variante="faixa"
                rotulo={tx("Linhas novas em obras em andamento", "New lines in works in progress")}
                natureza="CALCULADO"
                evidencia={ev.transmissao_em_andamento ?? null}
                casas={1}
                periodo={tx(`SIGET de ${dataSiget}`, `SIGET of ${dataSiget}`)}
                cor="var(--serie-comp-2)"
                nota={tx(`${inteiro(o.em_andamento.empreendimentos)} empreendimentos em andamento.`, `${inteiro(o.em_andamento.empreendimentos)} projects in progress.`)}
                endereco="/setor-eletrico/expansao/geracao-e-transmissao#p042"
                motivoAusencia={tx("Sem o SIGET nesta publicação.", "No SIGET in this release.")}
              />
              <Numero
                variante="faixa"
                rotulo={tx("Transformação nova em obras", "New transformation in works")}
                natureza="CALCULADO"
                valor={o.em_andamento.mva_tr_novos}
                casas={0}
                unidade="MVA"
                periodo={tx(`SIGET de ${dataSiget}`, `SIGET of ${dataSiget}`)}
                cor="var(--serie-comp-1)"
                nota={tx("Sem o transformador reserva.", "Without the spare transformer.")}
              />
              <Numero
                variante="faixa"
                rotulo={tx("Geração em implantação (RALIE)", "Generation under implementation (RALIE)")}
                natureza="CALCULADO"
                evidencia={ev.ralie_em_implantacao ?? null}
                casas={1}
                unidade="MW"
                periodo={tx(`RALIE de ${dataRalie}`, `RALIE of ${dataRalie}`)}
                cor="var(--cor-energia)" // i18n: dado
                endereco="/setor-eletrico/expansao/geracao-e-transmissao#p042"
                motivoAusencia={tx("Sem a fotografia do RALIE nesta publicação.", "No RALIE snapshot in this release.")}
              />
              <Numero
                variante="faixa"
                rotulo={tx(
                  `Extensão leiloada em ${l.ultimo_leilao.data?.slice(0, 4) ?? "último ano do arquivo aberto"}`,
                  `Length auctioned in ${l.ultimo_leilao.data?.slice(0, 4) ?? "the last year of the open file"}`,
                )}
                natureza="CALCULADO"
                evidencia={ev.leiloes_ultimo_ano ?? null}
                casas={1}
                periodo={tx("último ano do arquivo aberto", "last year of the open file")}
                cor="var(--serie-comp-3)"
                nota={tx("Anos depois do último leilão: ausência na fonte, não anos sem leilão.", "Years after the last auction: missing in the source, not years without an auction.")}
                endereco="/setor-eletrico/expansao/geracao-e-transmissao#p042"
                motivoAusencia={tx("Sem o arquivo de leilões nesta publicação.", "No auctions file in this release.")}
              />
            </FaixaMetricas>
          }
        >
          {tx(
            <>
              A geração vem do RALIE, em MW. A rede vem do SIGET (obras, em km de circuito e MVA), dos leilões de transmissão (km e R$ nominais) e da rede da EPE (km de traçado). A RAP
              dos leilões corrigida pelo IPCA e o deságio de cada lote estão em{" "}
              <Link href="/setor-eletrico/leiloes/transmissao" className="text-energia-dark underline underline-offset-4 hover:text-carvao">
                Leilões, transmissão
              </Link>
              .
            </>,
            <>
              Generation comes from the RALIE, in MW. The grid comes from the SIGET (works, in circuit km and MVA), from the transmission auctions (km and nominal R$) and from the EPE grid
              (route km). The auctions&apos; RAP (annual permitted revenue) adjusted by the IPCA and the discount of each lot are in{" "}
              <Link href="/setor-eletrico/leiloes/transmissao" className="text-energia-dark underline underline-offset-4 hover:text-carvao">
                Auctions, transmission
              </Link>
              .
            </>,
          )}
        </CabecalhoModulo>
        <ModoProfundidade>
          <Bloco id="geracao-e-transmissao">
            <PainelEvidencia
              id="p042"
              pergunta={tx("Geração e rede por UF, lado a lado", "Generation and grid by state, side by side")}
              subtitulo={tx(
                "Geração em implantação, obras e leilões de transmissão e rede planejada, por UF e por ano · MW, km e MVA em separado",
                "Generation under implementation, transmission works and auctions and the planned grid, by state and by year · MW, km and MVA separately",
              )}
              porQueImporta={tx(
                <>
                  Geração sem rede para escoar fica parada ou é cortada; rede sem geração custa à tarifa sem uso. Ver as duas expansões no mesmo território e no mesmo tempo mostra onde
                  elas andam juntas e onde uma vai à frente da outra.
                </>,
                <>
                  Generation without a grid to carry it sits idle or is curtailed; a grid without generation costs the tariff without use. Seeing both expansions in the same territory and
                  at the same time shows where they move together and where one gets ahead of the other.
                </>,
              )}
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={p.obras}
              complementares={complementares}
            >
              <div className="space-y-6">
                <RespostaCurta id="p042" veredito={vereditoTransmissao(g) || respostaTransmissao(g)}>
                  {respostaTransmissao(g)}
                </RespostaCurta>
                <ExpansaoGeracaoRedeUf
                  linhas={linhasGeracaoRedeUf(g)}
                  datas={{ ralie: dataRalie, siget: dataSiget, epe: capturaEpe }}
                  fonte={`${fonteExpansao(FONTE_RALIE)}; ${fonteExpansao(FONTE_SIGET)}; ${fonteExpansao(FONTE_EPE_REDE)}`}
                />
                <ExpansaoRecorte
                  periodo={tx(
                    <>
                      SIGET de {dataSiget}; RALIE de {dataRalie}; série anual de {serie[0]?.ano} a {serie.at(-1)?.ano}; leilões até {dataTexto(l.ultimo_leilao.data)}
                    </>,
                    <>
                      SIGET of {dataSiget}; RALIE of {dataRalie}; annual series from {serie[0]?.ano} to {serie.at(-1)?.ano}; auctions through {dataTexto(l.ultimo_leilao.data)}
                    </>,
                  )}
                  universo={tx(
                    <>
                      Empreendimentos de transmissão cadastrados no SIGET; usinas em implantação no RALIE; {inteiro(t.geracao_e_rede_por_uf.length)} UF; {inteiro(l.lotes)} lotes de leilão desde{" "}
                      {l.periodo.inicio?.slice(0, 4)}
                    </>,
                    <>
                      Transmission projects registered in the SIGET; plants under implementation in the RALIE; {inteiro(t.geracao_e_rede_por_uf.length)} states; {inteiro(l.lotes)} auction lots since{" "}
                      {l.periodo.inicio?.slice(0, 4)}
                    </>,
                  )}
                  unidade={tx(
                    "MW (geração, RALIE); km de circuito (linhas em obra e energizadas, SIGET: cada circuito de linha dupla conta); km de traçado (rede da EPE, geometria do mapa); MVA (transformação nova, sem o reserva); R$ milhões nominais (investimento previsto dos leilões); sempre separados",
                    "MW (generation, RALIE); circuit km (lines under construction and energized, SIGET: each circuit of a double line counts); route km (EPE grid, map geometry); MVA (new transformation, without the spare); nominal R$ million (planned investment of the auctions); always separate",
                  )}
                />
                <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />

                <SecaoDoPainel id="ano-a-ano" titulo={tx("O que entrou em operação, ano a ano: geração, linhas e transformação", "What entered operation, year by year: generation, lines and transformation")}>
                  <CursorSincronizado>
                    <GraficoLinhas
                      titulo={tx(
                        `Geração liberada para operação comercial por ano, ${serie[0]?.ano} a ${serie.at(-1)?.ano} (MW)`,
                        `Generation released for commercial operation by year, ${serie[0]?.ano} to ${serie.at(-1)?.ano} (MW)`,
                      )}
                      dados={dadosSerieMw(serie)}
                      chaveX="id"
                      formatoX="texto"
                      series={[{ id: "mw", rotulo: tx("Liberado (resumo anual oficial)", "Released (official annual summary)"), sigla: tx("Liberado", "Released"), cor: "var(--cor-energia)" }]} // i18n: dado
                      marcos={marcosParciais}
                      unidade="MW"
                      casas={1}
                      zeroNoEixo
                      altura={260}
                    />
                    <GraficoLinhas
                      titulo={tx(
                        "Linhas de transmissão por ano: energizadas, contratadas em leilão e em contratos assinados (km)",
                        "Transmission lines by year: energized, contracted at auction and in signed contracts (km)",
                      )}
                      dados={dadosSerieKm(serie)}
                      chaveX="id"
                      formatoX="texto"
                      series={[
                        { id: "energizados", rotulo: tx("Energizadas (SIGET, km de circuito)", "Energized (SIGET, circuit km)"), sigla: tx("Energizadas", "Energized"), cor: "var(--cor-energia)" }, // i18n: dado
                        { id: "leilao", rotulo: tx("Contratadas em leilão (km do lote)", "Contracted at auction (lot km)"), sigla: tx("Leilão", "Auction"), cor: "var(--serie-comp-3)", tracejada: true },
                        { id: "contratos", rotulo: tx("Em contratos assinados no ano (SIGET)", "In contracts signed in the year (SIGET)"), sigla: tx("Contratos", "Contracts"), cor: "var(--escala-seq-3)" },
                      ]}
                      marcos={marcosParciais}
                      unidade="km" // i18n: dado
                      casas={1}
                      zeroNoEixo
                      legendaInterativa
                      altura={280}
                    />
                    <GraficoLinhas
                      titulo={tx(
                        "Transformação por ano: energizada, contratada em leilão e em contratos assinados (MVA)",
                        "Transformation by year: energized, contracted at auction and in signed contracts (MVA)",
                      )}
                      dados={dadosSerieMva(serie)}
                      chaveX="id"
                      formatoX="texto"
                      series={[
                        { id: "energizados", rotulo: tx("Energizada (SIGET, sem o reserva)", "Energized (SIGET, without the spare)"), sigla: tx("Energizada", "Energized"), cor: "var(--cor-energia)" }, // i18n: dado
                        { id: "leilao", rotulo: tx("Contratada em leilão (como publicada)", "Contracted at auction (as published)"), sigla: tx("Leilão", "Auction"), cor: "var(--serie-comp-3)", tracejada: true },
                        { id: "contratos", rotulo: tx("Em contratos assinados no ano (SIGET)", "In contracts signed in the year (SIGET)"), sigla: tx("Contratos", "Contracts"), cor: "var(--escala-seq-3)" },
                      ]}
                      marcos={marcosParciais}
                      unidade="MVA"
                      casas={0}
                      zeroNoEixo
                      legendaInterativa
                      altura={280}
                    />
                  </CursorSincronizado>
                  <ExpansaoNota>
                    {tx(
                      <>
                        Três painéis, um por grandeza, com o cursor sincronizado pelo ano; dentro de cada painel, linhas separadas e nunca somadas: energizado, contratado em leilão e
                        contratado no SIGET são momentos diferentes do mesmo tipo de obra, não partes de um total. Lacuna na linha é ausência na fonte; zero é zero. O ano parcial está
                        marcado. <span data-nivel="analisar">{l.nota_mva}</span>
                      </>,
                      <>
                        Three panels, one per quantity, with the cursor synchronized by year; within each panel, separate lines that are never added: energized, contracted at auction and
                        contracted in the SIGET are different moments of the same kind of work, not parts of a total. A gap in the line is missing data in the source; zero is zero. The partial
                        year is marked.{" "}
                        <span data-nivel="analisar">
                          <TrechoPortugues regiao="expansao-nota-mva">{l.nota_mva}</TrechoPortugues>
                        </span>
                      </>,
                    )}
                  </ExpansaoNota>
                  <ExpansaoAusencia titulo={tx("Leilões depois do arquivo aberto: ausência na fonte", "Auctions after the open file: missing in the source")}>
                    <p>
                      {tx(
                        <>
                          O recurso aberto de resultados de leilões da ANEEL (publicado em {dataTexto(l.publicado_em)}) termina no leilão {l.ultimo_leilao.leilao ?? "sem dado"} ({dataTexto(l.ultimo_leilao.data)}).
                          Os anos seguintes aparecem como ausência, não como anos sem leilão.{" "}
                          <span data-nivel="auditar">
                            A planilha mais recente para a qual a página de relatórios da ANEEL aponta exige um desafio anti-robô para ser baixada, e esse bloqueio não foi contornado.
                          </span>
                        </>,
                        <>
                          ANEEL&apos;s open resource of auction results (published on {dataTexto(l.publicado_em)}) ends at auction {l.ultimo_leilao.leilao ?? semDado()} (
                          {dataTexto(l.ultimo_leilao.data)}). The following years appear as missing data, not as years without an auction.{" "}
                          <span data-nivel="auditar">
                            The most recent spreadsheet that ANEEL&apos;s reports page points to requires an anti-bot challenge to be downloaded, and that block was not bypassed.
                          </span>
                        </>,
                      )}
                    </p>
                    <p>
                      {tx(
                        <>
                          Alternativa usada: os contratos de concessão do SIGET, com a data de assinatura, cobrem o período seguinte, sem RAP nem deságio ({inteiro(ca?.depois_do_ultimo_leilao_do_arquivo.contratos.length)} contratos
                          assinados depois do último leilão do arquivo, na tabela do modo Analisar). Depende de a ANEEL atualizar o recurso aberto.
                        </>,
                        <>
                          Alternative used: the SIGET concession contracts, with the signature date, cover the following period, without RAP or discount (
                          {inteiro(ca?.depois_do_ultimo_leilao_do_arquivo.contratos.length)} contracts signed after the last auction in the file, in the Analyze mode table). It depends on ANEEL
                          updating the open resource.
                        </>,
                      )}
                    </p>
                  </ExpansaoAusencia>
                </SecaoDoPainel>

                <SecaoDoPainel id="mapa-rede" titulo={tx("Onde estão as linhas existentes e planejadas?", "Where are the existing and planned lines?")}>
                  {rede ? (
                    <>
                      <ExpansaoMapaRede url={URL_REDE} tamanho={tamanhoPublicado(URL_REDE)} captura={capturaEpe} fonte={fonteExpansao(FONTE_EPE_REDE)} />
                      <ExpansaoNota>
                        {tx(
                          <>
                            {rede.nota_data} {rede.definicao_km} Existente: {inteiro(rede.existente.linhas)} linhas, {kmTexto(rede.existente.km_geometria)}; planejada: {inteiro(rede.planejada.linhas)} linhas,{" "}
                            {kmTexto(rede.planejada.km_geometria)}, com ano de operação de {rede.planejada.ano_min ?? "sem dado"} a {rede.planejada.ano_max ?? "sem dado"}.
                          </>,
                          <>
                            <TrechoPortugues regiao="expansao-rede-nota">
                              {rede.nota_data} {rede.definicao_km}
                            </TrechoPortugues>{" "}
                            Existing: {inteiro(rede.existente.linhas)} lines, {kmTexto(rede.existente.km_geometria)}; planned: {inteiro(rede.planejada.linhas)} lines,{" "}
                            {kmTexto(rede.planejada.km_geometria)}, with year of operation from {rede.planejada.ano_min ?? "no data"} to {rede.planejada.ano_max ?? "no data"}.
                          </>,
                        )}
                      </ExpansaoNota>
                      <GraficoBarras
                        titulo={tx("Linhas planejadas pela EPE por ano previsto de operação (km de traçado)", "Lines planned by EPE by forecast year of operation (route km)")}
                        dados={rede.planejada.por_ano.map((a) => ({
                          id: a.ano === null ? "sem-ano" : String(a.ano),
                          ano: a.ano === null ? tx("ano não informado", "year not reported") : String(a.ano),
                          km: a.km,
                          linhas: a.linhas,
                        }))}
                        chaveCategoria="id"
                        chaveRotulo="ano" // i18n: dado
                        series={[{ id: "km", rotulo: tx("Planejada", "Planned"), cor: "var(--escala-seq-3)" }]}
                        unidade="km" // i18n: dado
                        casas={1}
                        altura={260}
                      />
                      <TabelaInterativa
                        titulo={tx(`Linhas da EPE por tensão, capturadas em ${capturaEpe}`, `EPE lines by voltage, captured on ${capturaEpe}`)}
                        colunas={colunasRedeTensao()}
                        linhas={linhasRedeTensao(g)}
                        chaveLinha="id"
                        colunaRotulo="tensao"
                        fonte={fonteExpansao(FONTE_EPE_REDE)}
                        versao={capturaEpe}
                        nomeArquivo="expansao-rede-epe-tensao"
                        chaveUrl="tra.ten"
                      />
                    </>
                  ) : (
                    <ExpansaoAusencia titulo={tx("Geometria das linhas ausente nesta publicação", "Line geometry missing in this release")}>
                      <p>
                        {tx(
                          "As camadas do WebMap da EPE não estão no bronze desta publicação; a tabela por UF acima segue com as obras do SIGET.",
                          "The EPE WebMap layers are not in this release's bronze layer; the table by state above continues with the SIGET works.",
                        )}
                      </p>
                    </ExpansaoAusencia>
                  )}
                  <ExpansaoAusencia titulo={tx("Geometria da ANEEL (SIGEL) e vínculo por empreendimento", "ANEEL geometry (SIGEL) and link by project")}>
                    <p>
                      {tx(
                        "O SIGEL da ANEEL, que publicaria a geometria das instalações de transmissão, não respondeu às tentativas de acesso. A geometria vem do WebMap da EPE, que não tem chave comum com o SIGET nem com os leilões: as obras em andamento ficam territorializadas pela UF das subestações, e a rede da EPE fica ao lado, por UF, sem ligação por empreendimento.",
                        "ANEEL's SIGEL, which would publish the geometry of the transmission facilities, did not respond to the access attempts. The geometry comes from the EPE WebMap, which has no common key with the SIGET or the auctions: the works in progress are placed by the state of the substations, and the EPE grid sits alongside, by state, with no link by project.",
                      )}
                    </p>
                  </ExpansaoAusencia>
                </SecaoDoPainel>

                <ExpansaoAnalise titulo={tx("Obras de transmissão no SIGET", "Transmission works in the SIGET")} id="obras">
                  <TabelaInterativa
                    titulo={tx(`Empreendimentos por situação, SIGET de ${dataSiget}`, `Projects by status, SIGET of ${dataSiget}`)}
                    colunas={colunasObrasSituacao()}
                    linhas={linhasObrasSituacao(g)}
                    chaveLinha="id"
                    colunaRotulo="situacao"
                    fonte={fonteExpansao(FONTE_SIGET)}
                    versao={dataSiget}
                    nomeArquivo="expansao-obras-situacao"
                    chaveUrl="tra.sit"
                    nota={tx(<>{o.regra_mva_reserva}</>, <TrechoPortugues regiao="expansao-regra-reserva">{o.regra_mva_reserva}</TrechoPortugues>)}
                  />
                  <ExpansaoNota>
                    {tx(
                      <>
                        Em andamento: {inteiro(o.em_andamento.empreendimentos)} empreendimentos, {inteiro(o.em_andamento.com_prazo_legal_vencido)} com o prazo vigente do ato legal vencido (
                        {kmTexto(o.em_andamento.km_prazo_vencido)} e {mvaTexto(o.em_andamento.mva_prazo_vencido)}; mediana de {diasTexto(o.em_andamento.mediana_dias_desde_prazo_legal)} desde o prazo). O prazo
                        vigente já incorpora revisões por ato posterior: vencido não quer dizer atrasado em relação ao contrato original, que o arquivo aberto não traz.
                      </>,
                      <>
                        In progress: {inteiro(o.em_andamento.empreendimentos)} projects, {inteiro(o.em_andamento.com_prazo_legal_vencido)} with the current deadline of the legal act expired (
                        {kmTexto(o.em_andamento.km_prazo_vencido)} and {mvaTexto(o.em_andamento.mva_prazo_vencido)}; median of {diasTexto(o.em_andamento.mediana_dias_desde_prazo_legal)} since the
                        deadline). The current deadline already includes revisions by later acts: expired does not mean delayed relative to the original contract, which the open file does not include.
                      </>,
                    )}
                  </ExpansaoNota>
                  <TabelaInterativa
                    titulo={tx(`Empreendimentos em andamento com o prazo vigente vencido, SIGET de ${dataSiget}`, `Projects in progress with the current deadline expired, SIGET of ${dataSiget}`)}
                    colunas={colunasPrazosVencidos()}
                    linhas={linhasPrazosVencidos(g)}
                    chaveLinha="id"
                    colunaRotulo="nome"
                    fonte={fonteExpansao(FONTE_SIGET)}
                    versao={dataSiget}
                    nomeArquivo="expansao-obras-prazo-vencido"
                    chaveUrl="tra.ven"
                    ordemInicial={{ coluna: "dias", direcao: "desc" }} // i18n: dado
                    nota={tx(
                      "Reforço com reator ou capacitor (Mvar) não soma km nem MVA; aparece com zero nas duas colunas.",
                      "Reinforcement with a reactor or capacitor (Mvar) adds neither km nor MVA; it appears with zero in both columns.",
                    )}
                  />
                  <GraficoBarras
                    titulo={tx(
                      "Empreendimentos que entraram depois do prazo vigente, por ano da entrada (% dos empreendimentos)",
                      "Projects that came online after the current deadline, by year of entry (% of projects)",
                    )}
                    dados={linhasDesvioObras(g)}
                    chaveCategoria="id"
                    chaveRotulo="ano" // i18n: dado
                    series={[
                      { id: "pct_depois", rotulo: tx("Depois do prazo vigente", "After the current deadline"), cor: "var(--escala-div-neg-1)" },
                      { id: "pct_iguais", rotulo: tx("Data efetiva igual ao prazo (sinal de prazo revisto)", "Actual date equal to the deadline (sign of a revised deadline)"), cor: "var(--cor-mineral)" },
                    ]}
                    unidade="%"
                    casas={1}
                    altura={260}
                  />
                  <TabelaInterativa
                    titulo={tx("Desvio da entrada das obras em relação ao prazo vigente, por ano (não é atraso)", "Deviation of the works' entry from the current deadline, by year (not a delay)")}
                    colunas={colunasDesvioObras()}
                    linhas={linhasDesvioObras(g)}
                    chaveLinha="id"
                    colunaRotulo="ano" // i18n: dado
                    fonte={fonteExpansao(FONTE_SIGET)}
                    versao={dataSiget}
                    nomeArquivo="expansao-obras-desvio-prazo"
                    chaveUrl="tra.dsv"
                    nota={tx(<>{o.desvio_prazo_vigente_por_ano.definicao}</>, <TrechoPortugues regiao="expansao-desvio-obras">{o.desvio_prazo_vigente_por_ano.definicao}</TrechoPortugues>)}
                  />
                </ExpansaoAnalise>

                <ExpansaoAnalise titulo={tx("Leilões e contratos de concessão", "Auctions and concession contracts")} id="leiloes">
                  <TabelaInterativa
                    titulo={tx(`Leilões de transmissão por ano, ${dataTexto(l.periodo.inicio)} a ${dataTexto(l.periodo.fim)}`, `Transmission auctions by year, ${dataTexto(l.periodo.inicio)} to ${dataTexto(l.periodo.fim)}`)}
                    colunas={colunasLeiloes()}
                    linhas={linhasLeiloes(l.por_ano)}
                    chaveLinha="id"
                    colunaRotulo="ano" // i18n: dado
                    fonte={fonteExpansao(FONTE_LEILOES)}
                    versao={dataTexto(l.publicado_em)}
                    nomeArquivo="expansao-leiloes-transmissao-ano"
                    chaveUrl="tra.lei"
                    ordemInicial={{ coluna: "ano", direcao: "desc" }} // i18n: dado
                    nota={tx(
                      <>{`${l.regra_sem_vencedor} ${l.regra_zero} Deságio agregado = 100 × (1 − RAP vencedora ÷ RAP do edital) nos lotes com as duas; ${inteiro(l.desagio_inconsistente_total)} lotes com deságio publicado divergente do calculado pela RAP ficam listados no modo Auditar.`}</>,
                      <>
                        <TrechoPortugues regiao="expansao-regras-leiloes">
                          {l.regra_sem_vencedor} {l.regra_zero}
                        </TrechoPortugues>{" "}
                        Aggregate discount = 100 × (1 − winning RAP ÷ tender RAP) in the lots with both; {inteiro(l.desagio_inconsistente_total)} lots with a published discount different from the one
                        calculated from the RAP are listed in Audit mode.
                      </>,
                    )}
                  />
                  <GraficoBarras
                    titulo={tx("Investimento previsto nos lotes contratados por ano do leilão (R$ milhões nominais)", "Planned investment in the contracted lots by auction year (nominal R$ million)")}
                    dados={linhasLeiloes(l.por_ano)}
                    chaveCategoria="id"
                    chaveRotulo="ano" // i18n: dado
                    series={[{ id: "investimento", rotulo: tx("Investimento previsto no edital", "Planned investment in the tender"), cor: "var(--serie-comp-2)" }]}
                    unidade={tx("R$ milhões", "R$ million")}
                    casas={1}
                    altura={260}
                  />
                  <ExpansaoNota>
                    {tx(
                      "Reais nominais da data de cada leilão, sem correção: os anos não se comparam em valor real. Investimento previsto no edital, não realizado.",
                      "Nominal reais as of the date of each auction, not adjusted: the years are not comparable in real terms. Investment planned in the tender, not realized.",
                    )}
                  </ExpansaoNota>
                  {ca && (
                    <>
                      <TabelaInterativa
                        titulo={tx(
                          `Contratos de concessão de transmissão por ano de assinatura, SIGET de ${dataTexto(ca.data_referencia)}`,
                          `Transmission concession contracts by year of signature, SIGET of ${dataTexto(ca.data_referencia)}`,
                        )}
                        colunas={colunasContratosAno()}
                        linhas={linhasContratosAno(g)}
                        chaveLinha="id"
                        colunaRotulo="ano" // i18n: dado
                        fonte={fonteExpansao(FONTE_SIGET)}
                        versao={dataTexto(ca.data_referencia)}
                        nomeArquivo="expansao-contratos-transmissao-ano"
                        chaveUrl="tra.con"
                        ordemInicial={{ coluna: "ano", direcao: "desc" }} // i18n: dado
                        nota={tx(
                          <>{`${ca.regra} ${ca.nota_zero}`}</>,
                          <TrechoPortugues regiao="expansao-regra-contratos">
                            {ca.regra} {ca.nota_zero}
                          </TrechoPortugues>,
                        )}
                      />
                      <TabelaInterativa
                        titulo={tx(
                          `Contratos assinados depois do último leilão do arquivo aberto (${datasLegiveis(ca.depois_do_ultimo_leilao_do_arquivo.ultimo_leilao ?? "sem dado")})`,
                          `Contracts signed after the last auction of the open file (${ca.depois_do_ultimo_leilao_do_arquivo.ultimo_leilao ? dataTexto(ca.depois_do_ultimo_leilao_do_arquivo.ultimo_leilao) : "no data"})`,
                        )}
                        colunas={colunasContratosRecentes()}
                        linhas={linhasContratosRecentes(g)}
                        chaveLinha="id"
                        colunaRotulo="numero"
                        fonte={fonteExpansao(FONTE_SIGET)}
                        versao={dataTexto(ca.data_referencia)}
                        nomeArquivo="expansao-contratos-recentes"
                        chaveUrl="tra.rec"
                        ordemInicial={{ coluna: "assinatura", direcao: "desc" }}
                        nota={tx("Contrato sem empreendimento cadastrado no SIGET tem km e MVA sem dado, não zero.", "A contract without a project registered in the SIGET has no data for km and MVA, not zero.")}
                      />
                    </>
                  )}
                </ExpansaoAnalise>

                <ExpansaoAuditoria titulo={tx("Regras, conferências e limitações", "Rules, checks and limitations")} id="auditoria-transmissao">
                  <ExpansaoNota>
                    <TrechoPortugues regiao="expansao-definicao-km">{o.definicao_km}</TrechoPortugues>
                  </ExpansaoNota>
                  <ExpansaoNota>
                    {tx(
                      <>
                        Módulos listados em mais de um empreendimento contam uma vez ({inteiro(o.modulos_em_mais_de_um_empreendimento.modulos_lt)} módulos de linha e {inteiro(o.modulos_em_mais_de_um_empreendimento.modulos_tr)} de
                        transformação; {o.modulos_em_mais_de_um_empreendimento.regra}). Módulos de linha com extensão fora do limite físico: {inteiro(o.modulos_lt_fora_do_limite)}.
                      </>,
                      <>
                        Modules listed in more than one project count once ({inteiro(o.modulos_em_mais_de_um_empreendimento.modulos_lt)} line modules and{" "}
                        {inteiro(o.modulos_em_mais_de_um_empreendimento.modulos_tr)} transformation modules;{" "}
                        <TrechoPortugues regiao="expansao-regra-modulos">{o.modulos_em_mais_de_um_empreendimento.regra}</TrechoPortugues>). Line modules with a length outside the physical limit:{" "}
                        {inteiro(o.modulos_lt_fora_do_limite)}.
                      </>,
                    )}
                  </ExpansaoNota>
                  <ExpansaoTabelaSimples
                    titulo={tx("Lotes com deságio publicado divergente do calculado pela RAP", "Lots with a published discount different from the one calculated from the RAP")}
                    cabecalho={tx(["Leilão e lote", "Deságio publicado (%)", "Deságio pela RAP (%)"], ["Auction and lot", "Published discount (%)", "Discount from the RAP (%)"])}
                    linhas={l.desagio_inconsistente.map((d) => [
                      d.lote,
                      d.desagio_fonte_pct === null ? semDado() : d.desagio_fonte_pct.toLocaleString(tx("pt-BR", "en-US")),
                      d.desagio_calculado_pct === null ? semDado() : d.desagio_calculado_pct.toLocaleString(tx("pt-BR", "en-US")),
                    ])}
                  />
                  <ExpansaoNota>
                    {tx(
                      <>
                        Lotes sem vencedor por motivo: {semVencedor}. Lotes contratados com km não informado:{" "}
                        {inteiro(l.lotes_km_nao_informado)}; com MVA não informado: {inteiro(l.lotes_mva_nao_informado)}. Série de MW liberados: {fonteMw ?? "sem dado"} ({FONTE_LIBERACOES}).
                      </>,
                      <>
                        Lots without a winner by reason: {semVencedor}. Contracted lots with km not reported: {inteiro(l.lotes_km_nao_informado)}; with MVA not reported:{" "}
                        {inteiro(l.lotes_mva_nao_informado)}. Series of MW released:{" "}
                        {fonteMw ? (FONTE_MW_LIBERADA_EN[fonteMw] ?? <TrechoPortugues regiao="expansao-fonte-mw">{fonteMw}</TrechoPortugues>) : "no data"} ({fonteExpansao(FONTE_LIBERACOES)}).
                      </>,
                    )}
                  </ExpansaoNota>
                  {rede && (
                    <ExpansaoNota>
                      {tx(
                        <>
                          Rede da EPE: contagem informada pelo serviço {inteiro(rede.existente.contagem_informada)} e {inteiro(rede.planejada.contagem_informada)} feições, recebidas {inteiro(rede.existente.linhas)} e{" "}
                          {inteiro(rede.planejada.linhas)}; geometria generalizada a {rede.generalizacao_grau.toLocaleString("pt-BR")} grau; km fora de qualquer UF {kmTexto(rede.existente.km_fora_de_uf)} (existente) e{" "}
                          {kmTexto(rede.planejada.km_fora_de_uf)} (planejada); campo de extensão da fonte fora de escala em {inteiro(rede.planejada.campo_extensao_fora_de_escala.linhas)} linhas planejadas. sha256 das camadas:{" "}
                          <span className="break-all">{rede.existente.sha256}</span> e <span className="break-all">{rede.planejada.sha256}</span>.
                        </>,
                        <>
                          EPE grid: count reported by the service {inteiro(rede.existente.contagem_informada)} and {inteiro(rede.planejada.contagem_informada)} features, received{" "}
                          {inteiro(rede.existente.linhas)} and {inteiro(rede.planejada.linhas)}; geometry generalized to {rede.generalizacao_grau.toLocaleString("en-US")} degree; km outside any state{" "}
                          {kmTexto(rede.existente.km_fora_de_uf)} (existing) and {kmTexto(rede.planejada.km_fora_de_uf)} (planned); source length field out of scale in{" "}
                          {inteiro(rede.planejada.campo_extensao_fora_de_escala.linhas)} planned lines. sha256 of the layers: <span className="break-all">{rede.existente.sha256}</span> and{" "}
                          <span className="break-all">{rede.planejada.sha256}</span>.
                        </>,
                      )}
                    </ExpansaoNota>
                  )}
                  <p className="rotulo text-mineral">{tx("Limitações declaradas na proveniência", "Limitations declared in the provenance")}</p>
                  <ExpansaoLimitacoes itens={[...p.obras.limitacoes, ...p.leiloes.limitacoes, ...p.contratos_transmissao.limitacoes, ...(p.rede_epe?.limitacoes ?? [])]} />
                </ExpansaoAuditoria>

                <ExpansaoSeguir id="p042" downloads={downloadsDe(g, DOWNLOADS_PAINEL.p042)} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
