import { TextoDoLeitor } from "@/components/energia/TextoDoLeitor";
import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import Link from "@/components/i18n/LinkIdioma";
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { AoAparecer } from "@/components/energia/AoAparecer";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { DadosCatalogo, DadosRecursosCcee } from "@/components/energia/DadosCatalogo";
import { DadosEscada } from "@/components/energia/DadosEscada";
import { DadosAviso, DadosCapitulos, DadosIndisponivel, DadosLimitacoes, DadosResposta, DadosSeguir, ReferenciaDados } from "@/components/energia/DadosPainel";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { Numero } from "@/components/energia/Numero";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, num } from "@/lib/energia/formato";
import { tx } from "@/lib/energia/idioma";
import { LICENCA_EN, rotuloDado, traduzido } from "@/lib/energia/i18n/regulacao-dados-metodo";
import { COLUNAS_ARQUIVO, DATASETS_INTEGRADOS, catalogoDados } from "@/lib/energia/datasets";
import { CSV_DADOS, ESTADOS_ESCADA, ROTULO_ESTADO_DADOS, compactarLinhas, linhasCatalogo, respostaCatalogo, resumoCatalogo, uni } from "@/lib/energia/dados";
import { contextoDoCatalogo, diaEmBrasilia, rotuloDoArquivo } from "@/lib/energia/dados-ficha";
import { agruparRessalvas, conciliarCatalogoEIntegracoes, ressalvaParaLeitor, textoConciliacao, textoMudancaCatalogo, vereditoCatalogo } from "@/lib/energia/dados-leitor";
import { provenienciaDados, publicacaoDados } from "@/lib/energia/dados-servidor";

export const dynamic = "force-static";

export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/dados", {
    title: tx("Dados do setor elétrico: encontre a fonte e reproduza o número", "Power sector data: find the source and reproduce the number"),
    description: tx(
      "Catálogo pesquisável dos dados abertos do setor elétrico (ONS, ANEEL, CCEE e outros), com o estado mais avançado de cada conjunto, o histórico de estados, o período dos dados, o uso declarado, os descontinuados e o estado de cada arquivo da CCEE.",
      "Searchable catalog of open power sector data (ONS, ANEEL, CCEE and others), with the most advanced state of each dataset, the history of states, the data period, the declared use, the discontinued datasets and the state of each CCEE file.",
    ),
    alternates: { canonical: "/setor-eletrico/dados" },
  }, anterior);
}

/** Campos de cada linha do catálogo, na ordem em que viajam para o navegador (as chaves vão uma vez, não uma por linha). */
const CHAVES_DO_CATALOGO = [
  "id",
  "n",
  "titulo",
  "orgao",
  "tema",
  "estado",
  "etapas",
  "verificado",
  "integrado",
  "validado",
  "publicado",
  "uso",
  "ressalva",
  "descontinuado",
  "frequencia",
  "periodo",
  "modificado",
  "recursos",
  "acessados",
  "ficha",
  "slug",
  "baixar", // i18n: dado
  "url",
  "formatos",
];

/** Licença do portal: em inglês, a forma da tabela exata ou, sem entrada, o texto da fonte marcado como trecho em português. */
function Licenca({ valor }: { valor: string }) {
  if (traduzido(LICENCA_EN, valor)) return <>{rotuloDado(LICENCA_EN, valor)}</>;
  return <TrechoPortugues regiao="dados-licenca">{valor}</TrechoPortugues>;
}

export default function DadosCatalogoPage() {
  const cat = catalogoDados();
  const pub = publicacaoDados();
  if (!cat || !pub) return <DadosIndisponivel />;

  const r = resumoCatalogo(cat);
  const prov = provenienciaDados(pub.proveniencia.catalogo);
  const porId = new Map(cat.entradas.map((e) => [e.id, e]));
  // o catálogo dá o mesmo endereço de ficha a conjuntos que um módulo integra juntos: a ficha vale para todos eles
  const fichas = new Set(DATASETS_INTEGRADOS.filter((d) => porId.has(d.catalogoId)).map((d) => d.slug));
  const linhas = linhasCatalogo(cat, contextoDoCatalogo(cat, pub, fichas));
  const matriz = compactarLinhas(linhas, CHAVES_DO_CATALOGO);
  const baixaveis = Array.from(new Set(cat.entradas.filter((e) => e.slug && fichas.has(e.slug)).flatMap((e) => e.downloads ?? [])));
  const rotulosDosArquivos = Object.fromEntries(baixaveis.map((u) => [u, rotuloDoArquivo(u, COLUNAS_ARQUIVO[u])]));
  const nomesPortais = Object.entries(cat.portais);
  // o dia de cada coleta no horário de Brasília, no formato do idioma da página
  const dias = Array.from(new Set(nomesPortais.map(([, p]) => p.colhido_em).filter((x): x is string => !!x).map((x) => diaEmBrasilia(x))));
  const acessados = (o: string) => (cat.recursos[o]?.total ?? 0) - (cat.recursos[o]?.por_estado.CATALOGADO ?? 0);
  const portaisComRecursos = Object.entries(cat.recursos);
  // arquivos de cada portal por etapa, em % do total do portal; as etapas são cumulativas, então as barras são comparações e não partes de um total
  const dadosRecursos = portaisComRecursos.map(([o, x]) => ({
    orgao: o,
    rotulo: tx(`${o} (${num(x.total, 0)} arquivos)`, `${o} (${num(x.total, 0)} files)`),
    acessados: (100 * acessados(o)) / (x.total || 1),
    publicados: (100 * (x.por_estado.PUBLICADO ?? 0)) / (x.total || 1),
  }));
  const semArquivoIsolado = ESTADOS_ESCADA.filter((s) => s !== "CATALOGADO" && !portaisComRecursos.some(([, x]) => (x.por_estado[s] ?? 0) > 0)).map((s) => ROTULO_ESTADO_DADOS[s].toLowerCase());
  const versao = cat.gerado_em;
  const evPublicados = pub.evidencias.conjuntos_publicados;
  const conciliacao = conciliarCatalogoEIntegracoes(cat, pub);
  const ENDERECO = "https://scrutiniums.com/setor-eletrico/dados#catalogo";
  // a mesma ressalva em vários conjuntos aparece uma vez, no texto; a lista traz só o que é específico de cada um
  const gruposRessalva = agruparRessalvas(r.usadasAbaixo, (e) => e.titulo);
  const ressalvaComum = gruposRessalva[0] && gruposRessalva[0].titulos.length > 1 ? gruposRessalva[0] : null;
  const semColeta = tx("sem coleta", "not collected");
  // cada portal com o carimbo da coleta (ou a falta dela), no idioma da página
  const coletas = (separador: string) => nomesPortais.map(([o, p]) => `${o}${separador}${p.colhido_em ? carimbo(p.colhido_em) : semColeta}`).join("; ");
  const oQueMudou = (
    <>
      {textoMudancaCatalogo(cat)}
      <span data-nivel="analisar">
        {" "}
        {tx(
          `Listagens colhidas em ${coletas(", ")}. O catálogo se atualiza a cada coleta automática, e esta página mostra a de ${carimbo(cat.gerado_em)}. A coleta da CCEE usa o mesmo cliente do PLD horário.`,
          `Listings collected on ${coletas(", ")}. The catalog is updated at each automatic collection, and this page shows the one of ${carimbo(cat.gerado_em)}. The CCEE collection uses the same client as the hourly PLD.`,
        )}
      </span>
    </>
  );
  const comoInterpretar = tx(
    <>
      O estado de cada conjunto é o mais avançado que ele alcançou, de catalogado a publicado, e o histórico completo está no detalhe. As etapas são cumulativas: a contagem de cada uma inclui as seguintes, então os números não se somam. Uso declarado é outro eixo
      (indicador, modelo, conferência, contexto, histórico) e não substitui o estado.
    </>,
    <>
      The state of each dataset is the most advanced one it reached, from cataloged to published, and the full history is in the detail. The stages are cumulative: the count of each one includes the following ones, so the numbers do not add up. Declared use is
      another axis (indicator, model, check, context, history) and does not replace the state.
    </>,
  );
  const naoConcluir = tx(
    <>
      Que um conjunto publicado esteja atualizado: a atualidade é medida na página de saúde. Que catalogado signifique dado bom: é existência na listagem e licença. Que a contagem de recursos verificados represente a cobertura da fonte: só {num(acessados("ONS"), 0)} dos{" "}
      {num(cat.recursos.ONS?.total ?? 0, 0)} arquivos do ONS foram acessados pelo observatório. Que o catálogo contenha tudo o que é público: ele reúne as listagens de três portais, as fontes que os módulos usam e entradas cadastradas à mão.
    </>,
    <>
      That a published dataset is up to date: timeliness is measured on the health page. That cataloged means good data: it is presence in the listing and a license. That the count of verified resources represents the coverage of the source: only{" "}
      {num(acessados("ONS"), 0)} of the {num(cat.recursos.ONS?.total ?? 0, 0)} ONS files were accessed by the observatory. That the catalog contains everything that is public: it brings together the listings of three portals, the sources the modules use and
      manually registered entries.
    </>,
  );

  return (
    <>
      <header><CabecalhoPlataforma colecao="energia" destinoConta="/setor-eletrico" navegacao="setor-eletrico" idiomas /></header>
      <MarcaVisita secao="energia:dados" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          siglas={["ONS", "ANEEL", "CCEE"]}
          titulo={tx("Encontre a fonte e reproduza o número", "Find the source and reproduce the number")}
          lead={tx(
            "Pesquise os conjuntos de dados abertos que o observatório conhece, veja até onde cada um chegou e baixe os arquivos. O catálogo reúne o que foi encontrado nas listagens do ONS, da ANEEL e da CCEE e o que os módulos usam: não lista tudo o que é público.",
            "Search the open datasets the observatory knows, see how far each one has come and download the files. The catalog brings together what was found in the ONS, ANEEL and CCEE listings and what the modules use: it does not list everything that is public.",
          )}
          recorte={tx(
            `${num(r.total, 0)} conjuntos de ${r.orgaos} órgãos · listagens colhidas em ${dias.length ? dias.join(" e ") : "data não registrada"}`,
            `${num(r.total, 0)} datasets from ${r.orgaos} bodies · listings collected on ${dias.length ? dias.join(" and ") : "date not recorded"}`,
          )}
          fonte={tx("ONS, ANEEL e CCEE (dados abertos), registros dos módulos e cadastro manual", "ONS, ANEEL and CCEE (open data), module registers and manual entries")}
          referencia={
            <ReferenciaDados
              processadoEm={cat.gerado_em}
              referencia={dataBR(pub.referencia.hoje)}
              extra={tx(
                <>Listagens oficiais colhidas em {coletas(" ")}.</>,
                <>Official listings collected on {coletas(" ")}.</>,
              )}
            />
          }
          metricas={
            <FaixaMetricas
              colunas={4}
              rotulo={tx("Indicadores do catálogo", "Catalog indicators")}
              nota={tx("Medidas do catálogo inteiro: não mudam com a busca nem com os filtros da lista.", "Measures of the whole catalog: they do not change with the search or the list filters.")}
            >
              <Numero
                variante="faixa"
                rotulo={tx("Conjuntos no catálogo", "Datasets in the catalog")}
                natureza="CALCULADO"
                valor={r.total}
                casas={0}
                unidade={tx("conjuntos", "datasets")}
                periodo={dataBR(cat.gerado_em.slice(0, 10))}
                endereco={ENDERECO}
              />
              <Numero
                variante="faixa"
                rotulo={tx("Com recurso verificado ou além", "With resource verified or beyond")}
                natureza="CALCULADO"
                valor={r.cumulativo["RECURSO VERIFICADO"]}
                casas={0}
                unidade={tx("conjuntos", "datasets")}
                periodo={dataBR(cat.gerado_em.slice(0, 10))}
                nota={tx("Etapa cumulativa: inclui os integrados e os publicados.", "Cumulative stage: includes the integrated and the published ones.")}
                endereco={ENDERECO}
              />
              <Numero
                variante="faixa"
                rotulo={tx("Publicados no observatório", "Published in the observatory")}
                natureza="CALCULADO"
                evidencia={evPublicados ?? null}
                valor={r.cumulativo.PUBLICADO}
                casas={0}
                unidade={tx("conjuntos", "datasets")}
                nota={tx("Não atesta atualização: veja Saúde e revisões.", "Does not attest that it is up to date: see Health and revisions.")}
                motivoAusencia={tx("O catálogo não foi gerado.", "The catalog was not generated.")}
                endereco={ENDERECO}
              />
              <Numero
                variante="faixa"
                rotulo={tx("Descontinuados pela fonte", "Discontinued by the source")}
                natureza="CALCULADO"
                valor={r.descontinuados}
                casas={0}
                unidade={tx(uni(r.descontinuados, "conjunto", "conjuntos"), uni(r.descontinuados, "dataset", "datasets"))}
                periodo={dataBR(cat.gerado_em.slice(0, 10))}
                nota={
                  r.descontinuadasPublicadas.length
                    ? tx(`${r.descontinuadasPublicadas.length} segue publicado, como histórico.`, `${r.descontinuadasPublicadas.length} remains published, as history.`)
                    : tx("Nenhum segue publicado.", "None remains published.")
                }
                endereco={ENDERECO}
              />
            </FaixaMetricas>
          }
        >
          {tx(
            <>
              Catalogar é registrar que um conjunto existe, com seus metadados oficiais. Verificar o recurso é acessar um arquivo. Integrar é coletá-lo e guardar a cópia original com a impressão digital do arquivo. Validar é conferir a captura sem checagem reprovada. Publicar é
              alimentar uma base publicada e íntegra. Cada conjunto mostra até onde chegou, com a evidência de cada etapa, e o uso que o observatório faz dele fica à parte. As regras de cada indicador estão na{" "}
              <Link href="/setor-eletrico/metodologia" className="text-energia-dark underline underline-offset-4">
                Metodologia
              </Link>
              .
            </>,
            <>
              Cataloging is recording that a dataset exists, with its official metadata. Verifying the resource is accessing a file. Integrating is collecting it and storing the original copy with the file fingerprint. Validating is checking the capture with no failed
              check. Publishing is feeding a published and intact base. Each dataset shows how far it has come, with the evidence of each stage, and the use the observatory makes of it is kept apart. The rules of each indicator are in the{" "}
              <Link href="/setor-eletrico/metodologia" className="text-energia-dark underline underline-offset-4">
                Methodology
              </Link>
              .
            </>,
          )}
        </CabecalhoModulo>

        <ModoProfundidade>
          <Bloco id="catalogo">
            <PainelEvidencia
              id="painel-catalogo"
              pergunta={tx("Quais conjuntos existem, e até onde cada um chegou?", "Which datasets exist, and how far has each one come?")}
              subtitulo={tx(
                `${num(r.total, 0)} conjuntos · estado mais avançado de cada um · busca, filtros e arquivos para baixar`,
                `${num(r.total, 0)} datasets · most advanced state of each one · search, filters and files to download`,
              )}
              proveniencia={prov}
              porQueImporta={tx(
                <>
                  Um conjunto citado na página de um indicador pode estar apenas catalogado, ou integrado e ainda sem validação. O estado mostra onde cada um está e impede que catalogar passe por usar: o estado de um conjunto nunca sobe sem a evidência da etapa.
                </>,
                <>
                  A dataset cited on the page of an indicator may be only cataloged, or integrated and not yet validated. The state shows where each one is and keeps cataloging from passing for using: the state of a dataset never rises without the evidence of the stage.
                </>,
              )}
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
            >
              <div className="space-y-6">
                <DadosCatalogo
                  matriz={matriz}
                  portais={cat.portais}
                  versao={versao}
                  rotulosDosArquivos={rotulosDosArquivos}
                  arquivoCompleto={{ rotulo: tx("Catálogo completo com a descrição (CSV)", "Complete catalog with the description (CSV)"), url: CSV_DADOS.catalogo.url }}
                  tituloTabela={tx("Tabela completa do catálogo, com todas as colunas", "Complete catalog table, with all the columns")}
                  apoioTabela={tx(
                    "A mesma busca e os mesmos filtros da lista, com todas as colunas para ordenar e comparar. O recorte escolhido na lista aparece aqui, e a tabela baixa o recorte em CSV ou XLSX.",
                    "The same search and the same filters as the list, with all the columns to sort and compare. The selection chosen in the list appears here, and the table downloads the selection as CSV or XLSX.",
                  )}
                >
                  <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />

                    <DadosResposta
                    depois
                    painel="P067"
                    veredito={vereditoCatalogo(r)}
                    prova={evPublicados ? <ComproveNumero evidencia={evPublicados} rotulo={tx("Comprove os conjuntos publicados", "Check the published datasets")} endereco={ENDERECO} /> : undefined}
                  >
                    {respostaCatalogo(r)}
                    </DadosResposta>

                    <DadosCapitulos atual="catalogo" />

                    <SecaoDoPainel id="conjuntos-e-integracoes" titulo={tx("Por que o catálogo e a Saúde contam números diferentes?", "Why do the catalog and Health count different numbers?")}>
                      <DadosAviso>
                        <p>{textoConciliacao(conciliacao)}</p>
                      </DadosAviso>
                    </SecaoDoPainel>

                  {r.usadasAbaixo.length > 0 && (
                      <SecaoDoPainel id="em-uso-abaixo" titulo={tx("Quais conjuntos estão em uso, mas abaixo de publicado?", "Which datasets are in use, but below published?")}>
                        <DadosAviso>
                          <p>
                          {tx(
                            `${r.usadasAbaixo.length === 1 ? "Este conjunto alimenta" : `Estes ${r.usadasAbaixo.length} conjuntos alimentam`} uma base publicada, mas o estado calculado pelo observatório não passou de recurso verificado: o observatório abriu um arquivo do conjunto e conferiu o formato e o cabeçalho, mas ainda não guarda o histórico dos dados. Por isso o conjunto não conta como publicado, mesmo que o módulo declare o uso.`,
                            `${r.usadasAbaixo.length === 1 ? "This dataset feeds" : `These ${r.usadasAbaixo.length} datasets feed`} a published base, but the state computed by the observatory did not go beyond resource verified: the observatory opened a file of the dataset and checked the format and the header, but does not yet store the history of the data. So the dataset does not count as published, even if the module declares the use.`,
                          )}
                          {ressalvaComum ? (
                            <>
                              {tx(` Em ${ressalvaComum.titulos.length} deles a ressalva do catálogo é a mesma: `, ` In ${ressalvaComum.titulos.length} of them the catalog caveat is the same: `)}
                              <TrechoPortugues regiao="dados-ressalva">{`${ressalvaComum.texto.charAt(0).toLowerCase()}${ressalvaComum.texto.slice(1)}`}</TrechoPortugues>
                            </>
                          ) : (
                            ""
                          )}
                          </p>
                          <ul className="mt-2 space-y-1.5" data-lista="em-uso-abaixo">
                          {r.usadasAbaixo.map((e) => {
                            const ressalva = ressalvaParaLeitor((e.ressalvas ?? []).join(" "));
                            const igualAComum = !!ressalvaComum && ressalva === ressalvaComum.texto;
                            return (
                                <li key={e.id} className="leading-relaxed">
                                  <strong className="font-medium text-carvao">
                                    <Nome>{e.titulo}</Nome>
                                  </strong>{" "}
                                  ({e.orgao}, {ROTULO_ESTADO_DADOS[e.estado].toLowerCase()})
                                  {igualAComum ? "" : ressalva ? (
                                    <>
                                      {": "}
                                      <TrechoPortugues regiao="dados-ressalva">{ressalva}</TrechoPortugues>
                                    </>
                                  ) : (
                                    tx(`: usado em ${e.usado_em.join(", ")}`, `: used in ${e.usado_em.join(", ")}`)
                                  )}
                                </li>
                            );
                          })}
                          </ul>
                        </DadosAviso>
                      </SecaoDoPainel>
                  )}


                </DadosCatalogo>

                <SecaoDoPainel id="etapas-do-catalogo" nivel="analisar" titulo={tx("O que cada etapa exige", "What each stage requires")}>
                  <DadosEscada cat={cat} resumo={r} />
                </SecaoDoPainel>

                <SecaoDoPainel id="recurso-a-recurso" nivel="analisar" titulo={tx("Recurso a recurso: até onde chegou cada arquivo, por órgão", "Resource by resource: how far each file has come, by body")}>
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    <TrechoPortugues regiao="dados-regra-recurso">{cat.regra_recurso}</TrechoPortugues>
                  </p>
                  <GraficoBarras
                    titulo={tx(
                      "Arquivos de cada portal que o observatório acessou e que alimentam bases publicadas (% do total do portal)",
                      "Files of each portal that the observatory accessed and that feed published bases (% of the portal total)",
                    )}
                    dados={dadosRecursos}
                    chaveCategoria="orgao"
                    chaveRotulo="rotulo"
                    series={[
                      { id: "acessados", rotulo: tx("Acessados pelo observatório (recurso verificado ou além)", "Accessed by the observatory (resource verified or beyond)"), cor: "var(--escala-seq-2)" },
                      { id: "publicados", rotulo: tx("Publicados (alimentam uma base)", "Published (feed a base)"), cor: "var(--escala-seq-5)" },
                    ]}
                    unidade="%"
                    casas={1}
                    orientacao="horizontal"
                    rotulosValor
                    alturaCategoria={72}
                  />
                  <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted">
                    {tx(
                      "As duas barras de cada portal não se somam: os arquivos publicados já estão entre os acessados. O estado de um arquivo herda o da integração que o capturou com impressão digital (publicado, nos arquivos que alimentam uma base); o lido só por requisição parcial está em recurso verificado; os demais, em catalogado.",
                      "The two bars of each portal do not add up: the published files are already among the accessed ones. The state of a file inherits that of the integration that captured it with a fingerprint (published, for the files that feed a base); one read only by partial request is at resource verified; the others, at cataloged.",
                    )}
                    {semArquivoIsolado.length
                      ? tx(
                          ` Nenhum arquivo tem ${semArquivoIsolado.join(" nem ")} como estado mais avançado: a captura e a base publicada saem da mesma execução.`,
                          ` No file has ${semArquivoIsolado.join(" or ")} as its most advanced state: the capture and the published base come from the same run.`,
                        )
                      : ""}
                  </p>
                  <AoAparecer
                    espera={tx(
                      "A tabela dos 733 arquivos da CCEE é lida do CSV publicado quando esta seção aparece na tela.",
                      "The table of the 733 CCEE files is read from the published CSV when this section appears on screen.",
                    )}
                    botao={tx("Ler a tabela da CCEE agora", "Read the CCEE table now")}
                  >
                    <DadosRecursosCcee url={CSV_DADOS.recursosCcee.url} versao={versao} />
                  </AoAparecer>
                </SecaoDoPainel>

                <SecaoDoPainel id="descontinuados-lista" nivel="analisar" titulo={tx("Descontinuados identificados pela fonte", "Discontinued datasets identified by the source")}>
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    {tx(
                      <>
                        O pipeline marca como descontinuado o conjunto cujo título ou nome diz isso, ou cuja frequência declarada é &quot;Sem atualização&quot;, e escreve a evidência. A marca não apaga o conjunto: o estado da escada continua valendo, e a ficha diz o uso.
                      </>,
                      <>
                        The pipeline marks as discontinued the dataset whose title or name says so, or whose declared frequency is <TrechoPortugues regiao="dados-frequencia">&quot;Sem atualização&quot;</TrechoPortugues> (no update), and writes down the evidence. The mark
                        does not erase the dataset: the ladder state still applies, and the record states the use.
                      </>,
                    )}
                  </p>
                  <ul className="divide-y divide-linha border border-linha text-sm" data-lista="descontinuados">
                    {pub.catalogo.descontinuados_lista.map((d) => (
                      <li key={d.id} className="px-3 py-2 leading-relaxed">
                        <strong className="font-medium text-carvao">
                          <Nome>{d.titulo}</Nome>
                        </strong>
                        <span className="ml-2 text-xs text-mineral">{ROTULO_ESTADO_DADOS[d.estado]}</span>
                        <span className="block text-carvao-muted">
                          {tx("Critério:", "Criterion:")} {d.motivo ? <TrechoPortugues regiao="dados-descontinuacao">{d.motivo}</TrechoPortugues> : tx("não informado", "not reported")}. {tx("Evidência:", "Evidence:")}{" "}
                          {d.evidencia ? <TrechoPortugues regiao="dados-descontinuacao">{d.evidencia}</TrechoPortugues> : tx("não informada", "not reported")}.
                        </span>
                      </li>
                    ))}
                  </ul>
                </SecaoDoPainel>

                <SecaoDoPainel id="catalogo-auditoria" nivel="auditar" titulo={tx("Fontes das listagens e regras do catálogo", "Sources of the listings and catalog rules")}>
                  <div className="tabela-scroll" tabIndex={0} role="region" aria-label={tx("Portais consultados (tabela rolável)", "Portals consulted (scrollable table)")}>
                    <table className="w-full min-w-[40rem] border-collapse text-xs">
                      <caption className="sr-only">{tx("Portais consultados para montar o catálogo", "Portals consulted to build the catalog")}</caption>
                      <thead>
                        <tr className="text-left text-mineral">
                          {tx(
                            ["Portal", "Endereço da listagem", "Colhido em", "Conjuntos", "Arquivos", "Licença mais frequente"],
                            ["Portal", "Listing address", "Collected on", "Datasets", "Files", "Most frequent license"],
                          ).map((c) => (
                            <th key={c} scope="col" className="border-b border-linha px-2 py-2 font-medium">
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {nomesPortais.map(([o, p]) => (
                          <tr key={o} className="border-b border-linha align-top">
                            <td className="px-2 py-1.5 text-carvao">{o}</td>
                            <td className="break-all px-2 py-1.5 text-carvao-muted">{p.url ?? p.origem}</td>
                            <td className="px-2 py-1.5 text-carvao-muted">
                              {p.colhido_em ? (
                                carimbo(p.colhido_em)
                              ) : p.erro ? (
                                <>
                                  {tx("sem coleta:", "not collected:")} <TrechoPortugues regiao="dados-erro-coleta">{p.erro}</TrechoPortugues>
                                </>
                              ) : (
                                semColeta
                              )}
                            </td>
                            <td className="px-2 py-1.5 tabular-nums text-carvao-muted">{num(p.conjuntos, 0)}</td>
                            <td className="px-2 py-1.5 tabular-nums text-carvao-muted">{p.recursos !== undefined ? num(p.recursos, 0) : tx("não contados", "not counted")}</td>
                            <td className="px-2 py-1.5 text-carvao-muted">{p.licenca ? <Licenca valor={p.licenca} /> : tx("não informada", "not reported")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <dl className="grid gap-x-8 gap-y-3 text-sm md:grid-cols-2">
                    <div>
                      <dt className="rotulo text-mineral">{tx("Eixo do estado", "State axis")}</dt>
                      <dd className="mt-0.5 leading-relaxed text-carvao-muted">
                        <TrechoPortugues regiao="dados-eixos">{cat.eixos.estado}</TrechoPortugues>
                      </dd>
                    </div>
                    <div>
                      <dt className="rotulo text-mineral">{tx("Eixo do uso", "Use axis")}</dt>
                      <dd className="mt-0.5 leading-relaxed text-carvao-muted">
                        <TrechoPortugues regiao="dados-eixos">{cat.eixos.uso}</TrechoPortugues>
                      </dd>
                    </div>
                    <div className="md:col-span-2">
                      <dt className="rotulo text-mineral">{tx("Como o arquivo do catálogo é compactado", "How the catalog file is compacted")}</dt>
                      <dd className="mt-0.5 leading-relaxed text-carvao-muted">
                        <TrechoPortugues regiao="dados-compactacao">{cat.compactacao}</TrechoPortugues>
                      </dd>
                    </div>
                  </dl>
                </SecaoDoPainel>

                <DadosLimitacoes
                  itens={[
                    tx(
                      <>A frequência declarada é o texto da fonte, sem correção; vários conjuntos do ONS trazem a rotina do portal (por exemplo, o horário da atualização) e não uma cadência de novos períodos.</>,
                      <>The declared frequency is the source&apos;s text, uncorrected; several ONS datasets show the portal routine (for example, the time of the update) and not a cadence of new periods.</>,
                    ),
                    tx(
                      <>O estado de recurso, a escada e as datas valem para a execução de {carimbo(cat.gerado_em)}. Conjuntos integrados depois dessa execução só aparecem aqui na próxima.</>,
                      <>The resource state, the ladder and the dates apply to the run of {carimbo(cat.gerado_em)}. Datasets integrated after that run only appear here in the next one.</>,
                    ),
                    ...prov.limitacoes.map((l) => (
                      <TrechoPortugues key={l} regiao="dados-limitacoes">
                        <TextoDoLeitor texto={l} />
                      </TrechoPortugues>
                    )),
                  ]}
                />
                <DadosSeguir
                  ancora="painel-catalogo"
                  proximo={{ href: "/setor-eletrico/dados/saude", pergunta: tx("O que atrasou ou mudou?", "What was delayed or changed?") }}
                  downloads={[CSV_DADOS.catalogo, CSV_DADOS.recursosCcee, CSV_DADOS.recursosAneel, CSV_DADOS.recursosOns]}
                />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
