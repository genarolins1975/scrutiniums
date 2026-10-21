import type { Metadata, ResolvingMetadata } from "next";
import type { ReactNode } from "react";
import { caminhoComParametros, metadadosEnergia } from "@/lib/energia/metadados-idioma";
import Link from "@/components/i18n/LinkIdioma";
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { notFound } from "next/navigation";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { DadosArquivos, itensDeArquivos } from "@/components/energia/DadosArquivos";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { gold } from "@/lib/energia/gold";
import { capturasDoConjunto } from "@/lib/energia/capturas-servidor";
import { carimbo, dataBR, plural } from "@/lib/energia/formato";
import { tx } from "@/lib/energia/idioma";
import { LICENCA_EN, PAINEIS_EN, codigo, identificadorDaFicha, marcado, rotuloDado, traduzido } from "@/lib/energia/i18n/regulacao-dados-metodo";
import { COLUNAS_ARQUIVO, DATASETS_INTEGRADOS, catalogoDados, datasetPorSlug, urlDoConjunto } from "@/lib/energia/datasets";
import { CSV_DADOS, DEFINICAO_ETAPA_LEITOR, ROTULO_ESTADO_DADOS, ROTULO_PAPEL, linhasIntegracao, refLegivel, rotuloTema, situacaoDoConjunto } from "@/lib/energia/dados";
import {
  criterioDaSituacao,
  descricaoDoArquivo,
  diaEmBrasilia,
  eApenasPaginaInicial,
  escolheDescricao,
  fraseAbertura,
  fraseFormatos,
  fraseReferencia,
  licencaDoLeitor,
  licencaParaCitacao,
  nomeDoConjunto,
  nomesLegiveisDosTitulos,
  notasDeQuebraPosterior,
  quebrasPosteriores,
  rotuloDoLinkOficial,
  rotuloDoArquivo,
  trocaIdentificadores,
} from "@/lib/energia/dados-ficha";
import { separaIdentificadores } from "@/lib/energia/dados-leitor";
import { descricoesCompletas, manifestoDados, metricasPublicadas, publicacaoDados } from "@/lib/energia/dados-servidor";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  // alguns conjuntos que um módulo integra juntos dividem o mesmo endereço de ficha: um caminho por ficha
  return DATASETS_INTEGRADOS.filter((d, i, todas) => todas.findIndex((x) => x.slug === d.slug) === i).map((d) => ({ dataset: d.slug }));
}

function metadadosDaPagina({ params }: { params: { dataset: string } }): Metadata {
  const d = datasetPorSlug(params.dataset);
  const e = catalogoDados()?.entradas.find((x) => x.id === d?.catalogoId);
  if (!d || !e) return {};
  const pub = publicacaoDados();
  const { nome } = nomeDoConjunto(e, (pub?.conjuntos ?? []).filter((c) => c.id.endsWith(`/${d.interno}`)));
  // o head não aceita a marca de nome: em inglês, o conjunto é identificado pelo endereço da ficha, não pelo nome português
  return {
    title: tx(`${nome} (${e.orgao}) · dados`, `${e.orgao} dataset ${identificadorDaFicha(d.slug)} · data`),
    description: tx(
      `Origem, atualidade, licença, arquivos para baixar e forma de citação do conjunto ${nome} (${e.orgao}) usado pelo Observatório do Setor Elétrico.`,
      `Origin, timeliness, license, files to download and citation form of an open dataset published by ${e.orgao} and used by the Power Sector Observatory; dataset record /en/setor-eletrico/dados/${d.slug}.`,
    ),
    alternates: { canonical: `/setor-eletrico/dados/${d.slug}` },
  };
}

export async function generateMetadata(props: { params: { dataset: string } }, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia(caminhoComParametros("/setor-eletrico/dados/[dataset]", props.params), metadadosDaPagina(props), anterior);
}

/** Data do metadado da fonte (ISO em UTC, às vezes sem o "Z") no horário de Brasília. */
function dataFonte(iso: string | null | undefined): string {
  if (!iso) return tx("não informada", "not reported");
  // o catálogo guarda a data de modificação sem hora: sem hora, a data fica como está (sem inventar horário nem trocar o dia)
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return dataBR(iso);
  const comFuso = /Z$|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`;
  return Number.isNaN(new Date(comFuso).getTime()) ? iso : carimbo(comFuso);
}

export default function DatasetPage({ params }: { params: { dataset: string } }) {
  const d = datasetPorSlug(params.dataset);
  const cat = catalogoDados();
  const meta = gold.meta();
  const e = cat?.entradas.find((x) => x.id === d?.catalogoId);
  if (!d || !e || !cat) notFound();
  const f = meta?.fontes[d.interno];
  // a gold meta.json cobre só parte das fontes; as integrações de publicacao.json trazem a captura e a atualidade de cada conjunto
  const pub = publicacaoDados();
  const manifesto = manifestoDados();
  const integr = (pub?.conjuntos ?? []).filter((c) => c.id.endsWith(`/${d.interno}`));
  const ultimaCaptura = f?.ultima_captura ?? integr.map((c) => c.capturas.ultima).filter((x): x is string => !!x).sort().at(-1) ?? null;
  const situacao = integr.length ? situacaoDoConjunto(integr[0]) : null;
  const criterio = integr.length && pub ? criterioDaSituacao(integr[0], pub.regras.sla, pub.referencia.hoje) : "";
  const nome = nomeDoConjunto(e, integr);
  const descricao = escolheDescricao(e.descricao, descricoesCompletas().get(e.id));
  const licencaInformada = e.licenca ?? cat.portais[e.orgao]?.licenca ?? null;
  const licencaBruta = licencaInformada ?? "não informada"; // i18n: dado (valor interno; a tela diz "não informada" no idioma da página)
  const licenca = licencaDoLeitor(licencaBruta);
  // nome da licença na tela: forma inglesa da tabela exata; sem entrada, o texto da fonte marcado como trecho em português
  const nomeDaLicenca = (t: string) =>
    licencaInformada === null ? tx("não informada", "not reported") : traduzido(LICENCA_EN, t) ? rotuloDado(LICENCA_EN, t) : <TrechoPortugues regiao="ficha-licenca">{t}</TrechoPortugues>;
  const oficial = urlDoConjunto(e);
  const paginaInicial = eApenasPaginaInicial(oficial);
  const cadencias = integr.flatMap((c) => c.frequencia?.cadencias ?? []).filter((c, i, a) => a.indexOf(c) === i);
  // divergência entre o resumo de meta.json e o CSV de capturas é falha de contrato que os testes retêm antes
  // da publicação; aqui ela não derruba o build do site inteiro (review #283): a ficha diz que o histórico
  // ficou indisponível, sem mostrar amostra como se fosse o total
  let capturas: ReturnType<typeof capturasDoConjunto> = [];
  let capturasIndisponiveis = false;
  try {
    capturas = capturasDoConjunto(f, d.interno);
  } catch {
    capturasIndisponiveis = true;
  }
  const notasDeQuebra = integr.length ? notasDeQuebraPosterior(e.quebras, integr[0]) : [];
  const quebrasEn = integr.length ? quebrasPosteriores(e.quebras, integr[0]) : [];
  // indicadores publicados que listam este conjunto entre as fontes (metricas.json)
  const indicadores = metricasPublicadas()
    .filter((m) => m.fontes.includes(d.interno))
    .map((m) => m.titulo)
    .filter((t, i, a) => a.indexOf(t) === i);
  // outras fichas que oferecem o mesmo arquivo para baixar: o arquivo é uma tabela derivada que reúne mais de um conjunto
  const outrasFichas = (url: string) =>
    DATASETS_INTEGRADOS.filter((x) => x.slug !== d.slug && x.downloads.includes(url)).map((x) => {
      const ex = cat.entradas.find((y) => y.id === x.catalogoId);
      return ex ? nomeDoConjunto(ex, (pub?.conjuntos ?? []).filter((c) => c.id.endsWith(`/${x.interno}`))).nome : x.slug;
    });
  const paraCitar = licencaParaCitacao(licenca.nome);
  const nomesDosTitulos = nomesLegiveisDosTitulos(cat.entradas, pub?.conjuntos ?? []);
  // o catálogo dá o mesmo endereço a conjuntos que um módulo integra juntos: a ficha vale para todos eles
  const companheiros = cat.entradas.filter((x) => x.slug === d.slug && x.id !== e.id);
  const periodo = integr[0]?.atualidade.ultimo_periodo
    ? tx(`dados até ${refLegivel(integr[0].atualidade.ultimo_periodo)}`, `data up to ${refLegivel(integr[0].atualidade.ultimo_periodo)}`)
    : tx("período dos dados não medido", "data period not measured");
  const paginasNoIdioma = d.paginas.map((p) => ({ ...p, rotulo: rotuloDado(PAINEIS_EN, p.rotulo) }));
  const arquivos = itensDeArquivos(
    d.downloads.map((u) => ({ rotulo: rotuloDoArquivo(u, COLUNAS_ARQUIVO[u]), url: u })),
    { pub, manifesto, dicionario: COLUNAS_ARQUIVO },
  ).map((a) => {
    const outras = outrasFichas(a.url);
    return {
      ...a,
      descricaoPt: tx(null, descricaoDoArquivo(a.url, COLUNAS_ARQUIVO[a.url])),
      origemDosLiterais: urlDoConjunto(e) ?? undefined,
      aviso:
        outras.length > 0 ? (
          <span className="block text-xs text-carvao-muted" data-arquivo-compartilhado="true">
            {tx(`Reúne dados também de ${plural(outras.length, "outro conjunto", "outros conjuntos")}.`, `Also brings together data from ${plural(outras.length, "other dataset", "other datasets")}.`)}
            <span data-nivel="analisar">
              {" "}
              {outras.map((o, i) => (
                <span key={o}>
                  {i > 0 ? "; " : ""}
                  <Nome>{o}</Nome>
                </span>
              ))}
              .
            </span>
          </span>
        ) : undefined,
    };
  });

  return (
    <>
      <CabecalhoEnergia atual="dados" />
      <MarcaVisita secao="energia:dados" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina pb-16">
        <nav aria-label={tx("Trilha", "Breadcrumb")} className="pt-8 text-sm text-mineral">
          <Link href="/setor-eletrico/dados" className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center underline underline-offset-4">
            {tx("Dados", "Data")}
          </Link>{" "}
          · {e.orgao}
        </nav>
        <CabecalhoModulo
          rotulo={`${e.orgao}${e.tema === "outros" ? "" : ` · ${rotuloTema(e.tema)}`}`}
          // o título é o nome oficial do conjunto: em inglês, marcado como nome e precedido do que ele é
          titulo={tx<ReactNode>(nome.nome, <>Dataset: <Nome>{nome.nome}</Nome></>)}
          lead={marcado(fraseAbertura({ orgao: e.orgao, cadencias, paginas: paginasNoIdioma }))}
          recorte={tx(
            `${periodo} · última captura ${ultimaCaptura ? carimbo(ultimaCaptura) : "sem registro"} · etapa no catálogo: ${ROTULO_ESTADO_DADOS[e.estado].toLowerCase()}`,
            `${periodo} · latest capture ${ultimaCaptura ? carimbo(ultimaCaptura) : "no record"} · stage in the catalog: ${ROTULO_ESTADO_DADOS[e.estado].toLowerCase()}`,
          )}
          fonte={tx(`${e.orgao}, dados abertos`, `${e.orgao}, open data`)}
        />

        <ModoProfundidade>
          <Bloco id="ficha">
            <h2 className="sr-only">{tx("Ficha do conjunto", "Dataset record")}</h2>
            <div className="space-y-8">
              {situacao && (
                <aside
                  aria-label={tx("Situação dos dados", "Status of the data")}
                  data-alerta={situacao.alerta ? "true" : undefined}
                  className={`border-l-2 pl-4 ${situacao.alerta ? "border-aviso" : "border-energia-soft"}`}
                >
                  <p className={`rotulo ${situacao.alerta ? "text-aviso" : "text-mineral"}`}>{tx("Situação dos dados", "Status of the data")}</p>
                  <p className="mt-1 font-serif text-lg text-carvao">{situacao.titulo}</p>
                  {situacao.texto && <p className="mt-1 max-w-prose2 text-sm leading-relaxed text-carvao-muted">{marcado(situacao.texto)}</p>}
                  {criterio && (
                    <p className="mt-2 max-w-prose2 text-sm leading-relaxed text-carvao-muted" data-criterio="true">
                      {criterio}
                    </p>
                  )}
                </aside>
              )}

              <div>
                <dl className="grid gap-x-8 gap-y-4 md:grid-cols-2">
                  {[
                    [
                      tx("Página oficial do conjunto", "Official page of the dataset"),
                      <span key="u">
                        {oficial ? (
                          <>
                            <a href={oficial} target="_blank" rel="noopener noreferrer" className="text-energia-dark underline underline-offset-4">
                              {rotuloDoLinkOficial(oficial, e.orgao)} ↗
                            </a>
                            <span className="mt-1 block break-all text-xs text-mineral" data-nivel="analisar">
                              {oficial}
                            </span>
                          </>
                        ) : (
                          tx("não informada", "not reported")
                        )}
                        {paginaInicial && (
                          <span className="mt-1 block" data-pagina-inicial="true">
                            {tx(
                              "Este endereço é a página inicial do portal: o catálogo não guarda um link direto para o conjunto.",
                              "This address is the home page of the portal: the catalog does not store a direct link to the dataset.",
                            )}
                          </span>
                        )}
                      </span>,
                    ],
                    [
                      tx("Licença", "License"),
                      <span key="l">
                        {nomeDaLicenca(licenca.nome)}
                        {licenca.baseLegal && (
                          <span data-nivel="analisar">
                            {" "}
                            ({tx("base legal:", "legal basis:")} <Nome>{licenca.baseLegal}</Nome>)
                          </span>
                        )}
                      </span>,
                    ],
                    [tx("Formatos publicados", "Published formats"), fraseFormatos(e.formatos, oficial)],
                    [tx("Data de referência", "Reference date"), fraseReferencia(integr[0], integr.length > 0)],
                    [tx("Última captura", "Latest capture"), ultimaCaptura ? carimbo(ultimaCaptura) : tx("sem captura", "no capture")],
                    [tx("Última modificação de metadados na fonte", "Latest metadata modification at the source"), dataFonte(e.modificado_na_fonte)],
                  ].map(([k, v]) => (
                    <div key={String(k)} className="min-w-0 border-t border-linha pt-3">
                      <dt className="rotulo text-mineral">{k}</dt>
                      <dd className="mt-1 text-sm text-carvao [overflow-wrap:anywhere]">{v}</dd>
                    </div>
                  ))}
                </dl>
                {licenca.nota && (
                  <p className="mt-3 text-xs leading-relaxed text-mineral">
                    {tx("Observação sobre a licença:", "Note on the license:")} <TrechoPortugues regiao="ficha-licenca">{licenca.nota}</TrechoPortugues>
                  </p>
                )}
              </div>

              <SecaoDoPainel id="arquivos" titulo={tx("Quais arquivos posso baixar?", "Which files can I download?")}>
                {arquivos.length > 0 ? (
                  <>
                    <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted" data-tabelas-derivadas="true">
                      {tx(
                        "São tabelas derivadas: o observatório as monta e publica a partir dos dados deste conjunto, e algumas reúnem também dados de outros conjuntos. Por isso o nome do arquivo não repete o título do conjunto. Os formatos publicados, acima, são os da fonte; aqui o observatório oferece só as suas tabelas.",
                        "These are derived tables: the observatory builds and publishes them from the data of this dataset, and some also bring together data from other datasets. That is why the file name does not repeat the dataset title. The published formats, above, are those of the source; here the observatory offers only its own tables.",
                      )}
                    </p>
                    <DadosArquivos itens={arquivos} />
                    <p className="text-xs text-mineral">
                      {tx("CSV com separador ponto e vírgula e ponto decimal; campo vazio significa ausência, nunca zero.", "CSV with semicolon separator and decimal point; an empty field means absence, never zero.")}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-carvao-muted" data-sem-arquivos="true">
                    {tx("O observatório não publica tabela derivada deste conjunto: os dados originais estão na página oficial.", "The observatory does not publish a derived table of this dataset: the original data are on the official page.")}
                  </p>
                )}
                <div>
                  <h4 className="text-sm font-medium text-carvao">{tx("Páginas do observatório que usam este conjunto", "Observatory pages that use this dataset")}</h4>
                  <ul className="mt-1 flex flex-wrap gap-x-6 text-sm">
                    {paginasNoIdioma.map((p) => (
                      <li key={p.href}>
                        <Link href={p.href} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
                          {marcado(p.rotulo)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </SecaoDoPainel>

              {e.quebras.length > 0 && (
                <SecaoDoPainel id="mudancas-metodologicas" titulo={tx("Mudanças metodológicas", "Methodological changes")}>
                  <p className="max-w-prose2 text-sm text-carvao-muted">
                    {tx(
                      "Cada item diz a origem: declarada na descrição do conjunto pela fonte, ou identificada pela Scrutiniums no próprio dado, sem documento da fonte que a confirme.",
                      "Each item states its origin: declared by the source in the dataset description, or identified by Scrutiniums in the data itself, without a source document confirming it.",
                    )}
                  </p>
                  <ul className="space-y-2 text-sm text-carvao">
                    {e.quebras.map((q) => {
                      const partes = separaIdentificadores(trocaIdentificadores(q.descricao, nomesDosTitulos));
                      return (
                        <li key={`${q.data}-${q.origem ?? "FONTE"}`}>
                          <strong className="font-medium">{dataBR(q.data)}</strong>
                          <span className="rotulo ml-2 text-mineral">
                            {q.origem === "PLATAFORMA" ? tx("identificada pela Scrutiniums no dado", "identified by Scrutiniums in the data") : tx("declarada pela fonte", "declared by the source")}
                          </span>
                          <span className="block">
                            <TrechoPortugues regiao="ficha-quebra">{partes.texto}</TrechoPortugues>
                            {partes.tecnico && <span data-nivel="analisar"> {partes.tecnico}</span>}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  {notasDeQuebra.map((n, i) => (
                    <p key={n} className="border-l-2 border-aviso pl-3 text-sm leading-relaxed text-carvao" data-quebra-posterior="true">
                      {tx<ReactNode>(
                        n,
                        // a descrição da mudança é texto da fonte ou do catálogo, em português: fica marcada dentro da frase inglesa
                        quebrasEn[i] ? (
                          <>
                            The change of {dataBR(quebrasEn[i].data)} (<TrechoPortugues regiao="ficha-quebra">{quebrasEn[i].descricao}</TrechoPortugues>) is later than the latest
                            period available, {quebrasEn[i].ultimo}: the data available do not yet reflect this change.
                          </>
                        ) : (
                          n
                        ),
                      )}
                    </p>
                  ))}
                </SecaoDoPainel>
              )}

              {companheiros.length > 0 && (
                <SecaoDoPainel id="outros-conjuntos-da-ficha" titulo={tx("Outros conjuntos desta ficha", "Other datasets in this record")}>
                  <div data-companheiros="true" className="space-y-2">
                    <p className="max-w-prose2 text-sm text-carvao-muted">
                      {tx(
                        `O catálogo registra ${plural(companheiros.length, "outro conjunto", "outros conjuntos")} com o mesmo endereço de ficha, porque um mesmo módulo do observatório os integra juntos. O que esta ficha diz da coleta vale para o grupo.`,
                        `The catalog records ${plural(companheiros.length, "other dataset", "other datasets")} with the same record address, as a single module of the observatory integrates them together. What this record says about the collection applies to the group.`,
                      )}
                    </p>
                    <ul className="space-y-1 text-sm text-carvao">
                      {companheiros.map((x) => (
                        <li key={x.id}>
                          <strong className="font-medium">
                            <Nome>{nomeDoConjunto(x, (pub?.conjuntos ?? []).filter((c) => (x.integracoes ?? []).some((i) => i.id === c.id))).nome}</Nome>
                          </strong>{" "}
                          ({x.orgao}){" "}
                          {urlDoConjunto(x) && (
                            <a href={urlDoConjunto(x) ?? undefined} target="_blank" rel="noopener noreferrer" className="text-energia-dark underline underline-offset-4">
                              {tx("página oficial ↗", "official page ↗")}
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </SecaoDoPainel>
              )}

              <SecaoDoPainel id="como-citar" titulo={tx("Como citar", "How to cite")}>
                <p className="max-w-prose2 text-sm leading-relaxed text-carvao [overflow-wrap:anywhere]">
                  {e.orgao}.{" "}
                  <em>
                    <Nome>{nome.nome}</Nome>
                  </em>
                  .{" "}
                  {tx(
                    <>
                      Dados abertos, {/^licen/i.test(paraCitar) ? "" : "licença "}
                      {paraCitar === "não informada" ? "informada na fonte" : paraCitar.replace(/\.$/, "")}. Integrado e processado por Scrutiniums, Observatório Brasileiro do Setor Elétrico, captura de {ultimaCaptura ? diaEmBrasilia(ultimaCaptura) : "data não informada"}
                    </>,
                    <>
                      Open data, {/^licen/i.test(paraCitar) ? "" : "license "}
                      {paraCitar === "não informada" ? "stated at the source" : nomeDaLicenca(paraCitar.replace(/\.$/, ""))}. Integrated and processed by Scrutiniums, Brazilian Power Sector Observatory, capture of {ultimaCaptura ? diaEmBrasilia(ultimaCaptura) : "date not reported"}
                    </>,
                  )}
                  {f?.snapshot ? <span data-nivel="analisar">, snapshot {codigo(f.snapshot)}</span> : null}.{" "}
                  {tx(
                    <>Disponível em: https://scrutiniums.com/setor-eletrico/dados/{d.slug}. Acesso em: [data do seu acesso].</>,
                    // o endereço vai inteiro num só texto (o slug sozinho não é prosa) e aponta a ficha inglesa
                    <>{`Available at: https://scrutiniums.com/en/setor-eletrico/dados/${d.slug}. Accessed on: [date of your access].`}</>,
                  )}
                </p>
                {nome.tituloNaFonte && (
                  <p className="text-xs leading-relaxed text-mineral" data-nivel="analisar">
                    {tx("Título na fonte:", "Title at the source:")} <Nome>{nome.tituloNaFonte}</Nome>.
                  </p>
                )}
              </SecaoDoPainel>

              <SecaoDoPainel id="conjunto-na-fonte" nivel="analisar" titulo={tx("O conjunto na fonte e na coleta", "The dataset at the source and in the collection")}>
                <dl className="grid gap-x-8 gap-y-3 text-sm md:grid-cols-2">
                  {nome.tituloNaFonte && (
                    <div className="min-w-0 md:col-span-2" data-titulo-na-fonte="true">
                      <dt className="rotulo text-mineral">{tx("Título na fonte", "Title at the source")}</dt>
                      <dd className="mt-0.5 text-carvao-muted [overflow-wrap:anywhere]">
                        <Nome>{nome.tituloNaFonte}</Nome>
                        {nome.motivo === "grafia"
                          ? tx(
                              ". A fonte grafa esse título sem acento; o observatório mostra a grafia corrigida no título da página e na citação.",
                              ". The source spells this title without accents; the observatory shows the corrected spelling in the page title and in the citation.",
                            )
                          : nome.motivo === "identificador"
                            ? tx(
                                ". O título publicado pela fonte é um identificador técnico; a página usa o nome que o módulo do observatório dá ao conjunto.",
                                ". The title published by the source is a technical identifier; the page uses the name the observatory module gives the dataset.",
                              )
                            : nome.motivo === "separador"
                              ? tx(". O observatório troca o travessão do título por dois-pontos.", ". The observatory replaces the dash in the title with a colon.")
                              : tx(". O observatório omite do título o nome técnico da consulta.", ". The observatory omits the technical name of the query from the title.")}
                      </dd>
                    </div>
                  )}
                  <div className="min-w-0 md:col-span-2" data-descricao={descricao.origem}>
                    <dt className="rotulo text-mineral">{tx("Descrição publicada pela fonte", "Description published by the source")}</dt>
                    <dd className="mt-0.5 leading-relaxed text-carvao-muted">
                      <span className="whitespace-pre-line">
                        {descricao.texto !== null ? (
                          <TrechoPortugues regiao="ficha-descricao">{descricao.texto}</TrechoPortugues>
                        ) : (
                          tx("O catálogo não guarda descrição para este conjunto.", "The catalog does not store a description for this dataset.")
                        )}
                      </span>
                      {descricao.origem === "csv" && (
                        <p className="mt-1 text-xs text-mineral" data-descricao-completa="true">
                          {tx("Texto completo, de", "Full text, from")}{" "}
                          <a href={CSV_DADOS.catalogo.url} download className="underline underline-offset-4">
                            dados_catalogo.csv
                          </a>
                          {tx("; o catálogo da página guarda só o começo.", "; the page catalog stores only the beginning.")}
                        </p>
                      )}
                      {descricao.cortada && (
                        <p className="mt-1 text-xs text-mineral" data-descricao-cortada="true">
                          {tx(
                            "O catálogo guarda só o começo da descrição da fonte; o texto completo está na página oficial do conjunto.",
                            "The catalog stores only the beginning of the source description; the full text is on the official page of the dataset.",
                          )}
                        </p>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="rotulo text-mineral">{tx("Etapa no catálogo", "Stage in the catalog")}</dt>
                    <dd className="mt-0.5 text-carvao-muted">
                      {ROTULO_ESTADO_DADOS[e.estado]}. {DEFINICAO_ETAPA_LEITOR[e.estado]}
                    </dd>
                  </div>
                  <div>
                    <dt className="rotulo text-mineral">{tx("Uso declarado", "Declared use")}</dt>
                    <dd className="mt-0.5 text-carvao-muted">
                      {(e.papeis ?? []).map((p) => ROTULO_PAPEL[p] ?? p).join(", ") || ROTULO_PAPEL.indicador}
                      {(e.modelos ?? []).length ? tx(` · modelos ${(e.modelos ?? []).join(", ")}`, ` · models ${(e.modelos ?? []).join(", ")}`) : ""}
                    </dd>
                  </div>
                  <div>
                    <dt className="rotulo text-mineral">{tx("Frequência declarada pela fonte (texto original)", "Frequency declared by the source (original text)")}</dt>
                    <dd className="mt-0.5 text-carvao-muted">
                      {e.frequencia_declarada ? <TrechoPortugues regiao="ficha-frequencia">{e.frequencia_declarada}</TrechoPortugues> : tx("não declarada", "not declared")}
                    </dd>
                  </div>
                  <div>
                    <dt className="rotulo text-mineral">{tx("Indicadores publicados que usam este conjunto", "Published indicators that use this dataset")}</dt>
                    <dd className="mt-0.5 text-carvao-muted" data-indicadores="true">
                      {indicadores.length ? (
                        <ul className="list-disc pl-5">
                          {indicadores.map((t) => (
                            <li key={t}>
                              <TrechoPortugues regiao="ficha-indicador">{t}</TrechoPortugues>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        tx("nenhum: o conjunto não entra no cálculo de indicador publicado", "none: the dataset does not enter the calculation of any published indicator")
                      )}
                    </dd>
                  </div>
                  {integr.length > 0 && pub && (
                    <div className="min-w-0 md:col-span-2">
                      <dt className="rotulo text-mineral">{tx(`Atualidade e coleta (publicação de ${dataBR(pub.referencia.hoje)})`, `Timeliness and collection (publication of ${dataBR(pub.referencia.hoje)})`)}</dt>
                      <dd className="mt-0.5 text-carvao-muted [overflow-wrap:anywhere]">{marcado(integr.map((c) => linhasIntegracao(c).join(" ")).join(" "))}</dd>
                    </div>
                  )}
                  {f?.ultima_tentativa && (
                    <div className="min-w-0 md:col-span-2">
                      <dt className="rotulo text-mineral">{tx("Última tentativa de coleta direta", "Latest direct collection attempt")}</dt>
                      <dd className="mt-0.5 text-carvao-muted [overflow-wrap:anywhere]">
                        {`${carimbo(f.ultima_tentativa.tentado_em)} · ${f.ultima_tentativa.ok ? "ok" : tx("falhou", "failed")} · `}
                        {/* o detalhe é texto do pipeline, em português: os números grandes levam o ponto de milhar brasileiro do próprio trecho */}
                        <TrechoPortugues regiao="ficha-tentativa">{f.ultima_tentativa.detalhe.replace(/\d{4,}/g, (n) => Number(n).toLocaleString("pt-BR"))}</TrechoPortugues>
                      </dd>
                    </div>
                  )}
                </dl>
              </SecaoDoPainel>

              <SecaoDoPainel id="capturas-guardadas" nivel="auditar" titulo={tx("Capturas guardadas e impressão digital", "Stored captures and fingerprint")}>
                <div data-detalhes-tecnicos="true" className="space-y-3">
                  {(f?.snapshot || f?.snapshot_sha256) && (
                    <dl className="grid gap-x-8 gap-y-3 md:grid-cols-2">
                      {f?.snapshot && (
                        <div className="min-w-0 md:col-span-2">
                          <dt className="rotulo text-mineral">{tx("Snapshot", "Snapshot")}</dt>
                          <dd className="mt-1 text-sm text-carvao [overflow-wrap:anywhere]">{codigo(f.snapshot)}</dd>
                        </div>
                      )}
                      {f?.snapshot_sha256 && (
                        <div className="min-w-0 md:col-span-2">
                          <dt className="rotulo text-mineral">{tx("sha256 do snapshot", "sha256 of the snapshot")}</dt>
                          <dd className="mt-1 break-all font-mono text-xs text-carvao">{codigo(f.snapshot_sha256)}</dd>
                        </div>
                      )}
                    </dl>
                  )}
                  {(f?.snapshots_familias?.length ?? 0) > 1 && (
                    <div className="space-y-3" data-snapshots-familias="true">
                      <p className="max-w-prose2 text-sm text-carvao-muted">
                        {tx("As contagens distinguem famílias de armazenamento. Uma mesma captura pode ter registros em mais de uma família; cada versão é identificada abaixo.", "Counts distinguish storage families. The same capture can have records in more than one family; each version is identified below.")}
                      </p>
                      {f!.snapshots_familias!.map((s) => (
                        <dl key={s.familia} className="border-l border-linha pl-3 text-xs text-carvao-muted [overflow-wrap:anywhere]">
                          <dt>{tx("Família", "Family")}</dt><dd>{codigo(s.familia)}</dd>
                          <dt>{tx("Snapshot", "Snapshot")}</dt><dd>{s.snapshot ? codigo(s.snapshot) : tx("não informado", "not reported")}</dd>
                          <dt>sha256</dt><dd>{s.snapshot_sha256 ? codigo(s.snapshot_sha256) : tx("não informado", "not reported")}</dd>
                          <dt>{tx("Downloads idênticos posteriores", "Later identical downloads")}</dt>
                          <dd>{s.recapturas_sem_mudanca ?? tx("não informados", "not reported")}</dd>
                          <dt>{tx("Última tentativa de coleta direta", "Latest direct collection attempt")}</dt>
                          <dd data-tentativa-familia={s.familia}>
                            {s.ultima_tentativa ? <>
                              {`${carimbo(s.ultima_tentativa.tentado_em)} · ${s.ultima_tentativa.ok ? "ok" : tx("falhou", "failed")} · `}
                              <TrechoPortugues regiao="ficha-tentativa-familia">{s.ultima_tentativa.detalhe}</TrechoPortugues>
                            </> : tx("não registrada", "not recorded")}
                          </dd>
                        </dl>
                      ))}
                    </div>
                  )}
                  <p className="max-w-prose2 text-sm text-carvao-muted">
                    {tx(
                      "Cada família registra as versões capturadas de cada recurso. Uma recaptura idêntica não cria uma versão nova nessa família. A tabela inclui versões vigentes e substituídas.",
                      "Each family records the captured versions of each resource. An identical recapture does not create a new version within that family. The table includes current and replaced versions.",
                    )}
                  </p>
                  {f?.resumo_capturas && !capturasIndisponiveis && (
                    <p className="max-w-prose2 text-sm text-carvao-muted" data-resumo-capturas="true">
                      {tx(
                        `${plural(f.resumo_capturas.total_historico, "registro de captura", "registros de captura")}, dos quais ${plural(f.resumo_capturas.total_capturas, "vigente", "vigentes")}.`,
                        `${plural(f.resumo_capturas.total_historico, "capture record", "capture records")}; current: ${f.resumo_capturas.total_capturas}.`,
                      )}
                      {f.resumo_capturas.primeira && f.resumo_capturas.ultima && <> {tx(
                        `Capturas de ${carimbo(f.resumo_capturas.primeira)} a ${carimbo(f.resumo_capturas.ultima)}.`,
                        `Captures from ${carimbo(f.resumo_capturas.primeira)} to ${carimbo(f.resumo_capturas.ultima)}.`,
                      )}</>}{" "}
                      <a className="underline underline-offset-4" href={f.historico_csv} download>
                        {tx("Baixar histórico completo de todos os conjuntos (CSV)", "Download full history of all datasets (CSV)")}
                      </a>
                    </p>
                  )}
                  {capturasIndisponiveis ? (
                    <p className="border border-linha bg-papel p-3 text-sm text-carvao" data-capturas-indisponiveis="true">
                      {tx(
                        "O histórico de capturas deste conjunto está indisponível nesta publicação: o resumo e o arquivo completo não conferem. Nenhuma lista parcial é mostrada no lugar.",
                        "The capture history of this dataset is unavailable in this release: the summary and the full file do not match. No partial list is shown instead.",
                      )}
                    </p>
                  ) : capturas.length === 0 ? (
                    <p className="border border-linha bg-papel p-3 text-sm text-carvao" data-sem-capturas="true">
                      {ultimaCaptura
                        ? tx(
                            `A lista de capturas arquivo a arquivo deste conjunto não é publicada nesta página. O catálogo registra a última captura em ${carimbo(ultimaCaptura)}.`,
                            `The file-by-file list of captures of this dataset is not published on this page. The catalog records the latest capture on ${carimbo(ultimaCaptura)}.`,
                          )
                        : tx(
                            "Este conjunto ainda não tem captura registrada: o arquivo não foi baixado com conteúdo, ou o conjunto é consultado no portal da fonte sem cópia local.",
                            "This dataset has no capture recorded yet: the file was not downloaded with content, or the dataset is consulted on the source portal without a local copy.",
                          )}
                    </p>
                  ) : (
                    <div className="tabela-scroll" tabIndex={0} role="region" aria-label={tx("Capturas do conjunto (tabela rolável)", "Captures of the dataset (scrollable table)")}>
                      <table className="w-full min-w-[60rem] border-collapse text-xs">
                        <caption className="sr-only">{tx("Todos os registros de captura, por família e recurso", "All capture records, by family and resource")}</caption>
                        <thead>
                          <tr className="text-left text-mineral">
                            {tx(
                              ["Família", "Recurso", "Capturado em", "Publicado pela fonte (metadado)", "Origem", "Situação na família", "sha256"],
                              ["Family", "Resource", "Captured on", "Published by the source (metadata)", "Origin", "Status within the family", "sha256"],
                            ).map((c) => (
                              <th key={c} scope="col" className="border-b border-linha px-2 py-2 font-medium">
                                {c}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {capturas.map((cpt) => (
                            <tr key={`${cpt.familia}:${cpt.recurso}:${cpt.sha256}`} className="border-b border-linha">
                              <td className="px-2 py-1.5 text-carvao">{codigo(cpt.familia ?? "energia")}</td>
                              <td className="px-2 py-1.5 text-carvao">{codigo(cpt.recurso)}</td>
                              <td className="px-2 py-1.5 text-carvao">{carimbo(cpt.capturado_em)}</td>
                              <td className="px-2 py-1.5 text-carvao-muted">{dataFonte(cpt.publicado_em)}</td>
                              <td className="px-2 py-1.5 text-carvao-muted">{["seed", "seed_versionado"].includes(cpt.origem)
                                ? tx("captura primária versionada", "versioned primary capture")
                                : cpt.origem === "coleta_direta" ? tx("coleta direta", "direct collection")
                                : cpt.origem ? codigo(cpt.origem) : tx("não informada", "not reported")}</td>
                              <td className="px-2 py-1.5 text-carvao-muted">{cpt.vigente ? tx("vigente", "current") : tx("substituída", "replaced")}</td>
                              <td className="break-all px-2 py-1.5 font-mono text-xs text-mineral">{codigo(cpt.sha256)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {/* todas as vintages, inclusive as substituídas; publicações antigas da gold só trazem as vigentes (f?.historico) */}
                  {typeof f?.recapturas_sem_mudanca === "number" && (
                    <p className="text-xs text-carvao-muted">
                      {f.recapturas_sem_mudanca === 0
                        ? tx("Nenhum download posterior de arquivo já integrado foi registrado no log de coletas.", "No later download of an already integrated file was recorded in the collection log.")
                        : tx(
                            `${f.recapturas_sem_mudanca} ${f.recapturas_sem_mudanca === 1 ? "download posterior veio idêntico" : "downloads posteriores vieram idênticos"} a vintages já integradas (log de coletas); por isso não aparecem como linhas novas.`,
                            `${f.recapturas_sem_mudanca} ${f.recapturas_sem_mudanca === 1 ? "later download came back identical" : "later downloads came back identical"} to vintages already integrated (collection log); so they do not appear as new rows.`,
                          )}
                    </p>
                  )}
                </div>
              </SecaoDoPainel>
            </div>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
