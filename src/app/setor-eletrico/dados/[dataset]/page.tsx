import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { LegendaDeSiglas } from "@/components/energia/LegendaSiglas";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { gold } from "@/lib/energia/gold";
import { carimbo, dataBR, plural } from "@/lib/energia/formato";
import { COLUNAS_ARQUIVO, DATASETS_INTEGRADOS, catalogoDados, datasetPorSlug, urlDoConjunto } from "@/lib/energia/datasets";
import { CSV_DADOS, DEFINICAO_ETAPA_LEITOR, ROTULO_ESTADO_DADOS, ROTULO_PAPEL, linhasIntegracao, rotuloTema, situacaoDoConjunto } from "@/lib/energia/dados";
import {
  criterioDaSituacao,
  eApenasPaginaInicial,
  escolheDescricao,
  formatoDoArquivo,
  fraseAbertura,
  fraseFormatos,
  fraseReferencia,
  licencaDoLeitor,
  licencaParaCitacao,
  nomeDoArquivo,
  nomeDoConjunto,
  nomesLegiveisDosTitulos,
  notasDeQuebraPosterior,
  rotuloDoLinkOficial,
  rotuloDoArquivo,
  trocaIdentificadores,
} from "@/lib/energia/dados-ficha";
import { separaIdentificadores } from "@/lib/energia/dados-leitor";
import { descricoesCompletas, metricasPublicadas, publicacaoDados } from "@/lib/energia/dados-servidor";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  // alguns conjuntos que um módulo integra juntos dividem o mesmo endereço de ficha: um caminho por ficha
  return DATASETS_INTEGRADOS.filter((d, i, todas) => todas.findIndex((x) => x.slug === d.slug) === i).map((d) => ({ dataset: d.slug }));
}

export function generateMetadata({ params }: { params: { dataset: string } }): Metadata {
  const d = datasetPorSlug(params.dataset);
  const e = catalogoDados()?.entradas.find((x) => x.id === d?.catalogoId);
  if (!d || !e) return {};
  const pub = publicacaoDados();
  const { nome } = nomeDoConjunto(e, (pub?.conjuntos ?? []).filter((c) => c.id.endsWith(`/${d.interno}`)));
  return {
    title: `${nome} (${e.orgao}) · dados`,
    description: `Origem, atualidade, licença, arquivos para baixar e forma de citação do conjunto ${nome} (${e.orgao}) usado pelo Observatório do Setor Elétrico.`,
    alternates: { canonical: `/setor-eletrico/dados/${d.slug}` },
  };
}

/** Data do metadado da fonte (ISO em UTC, às vezes sem o "Z") no horário de Brasília. */
function dataFonte(iso: string | null | undefined): string {
  if (!iso) return "não informada";
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
  const integr = (pub?.conjuntos ?? []).filter((c) => c.id.endsWith(`/${d.interno}`));
  const ultimaCaptura = f?.ultima_captura ?? integr.map((c) => c.capturas.ultima).filter((x): x is string => !!x).sort().at(-1) ?? null;
  const situacao = integr.length ? situacaoDoConjunto(integr[0]) : null;
  const criterio = integr.length && pub ? criterioDaSituacao(integr[0], pub.regras.sla, pub.referencia.hoje) : "";
  const nome = nomeDoConjunto(e, integr);
  const descricao = escolheDescricao(e.descricao, descricoesCompletas().get(e.id));
  const licencaBruta = e.licenca ?? cat.portais[e.orgao]?.licenca ?? "não informada";
  const licenca = licencaDoLeitor(licencaBruta);
  const oficial = urlDoConjunto(e);
  const paginaInicial = eApenasPaginaInicial(oficial);
  const cadencias = integr.flatMap((c) => c.frequencia?.cadencias ?? []).filter((c, i, a) => a.indexOf(c) === i);
  const capturas = f?.historico?.length ? f.historico : (f?.capturas ?? []).map((x) => ({ ...x, vigente: true }));
  const notasDeQuebra = integr.length ? notasDeQuebraPosterior(e.quebras, integr[0]) : [];
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

  return (
    <>
      <CabecalhoEnergia atual="dados" />
      <MarcaVisita secao="energia:dados" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina pb-16">
        <nav aria-label="Trilha" className="pt-8 text-sm text-mineral">
          <Link href="/setor-eletrico/dados" className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center underline underline-offset-4">Dados</Link> · {e.orgao}
        </nav>
        <header className="pb-6 pt-4">
          <p className="rotulo text-mineral">{e.orgao}{e.tema === "outros" ? "" : ` · ${rotuloTema(e.tema)}`}</p>
          <h1 className="mt-2 font-serif text-[clamp(1.8rem,4vw,2.6rem)] leading-tight text-carvao [overflow-wrap:break-word]">{nome.nome}</h1>
          <p className="mt-3 max-w-prose2 text-base leading-relaxed text-carvao">{fraseAbertura({ orgao: e.orgao, cadencias, paginas: d.paginas })}</p>
          <LegendaDeSiglas />
        </header>

        <ModoProfundidade>
          {situacao && (
            <aside
              aria-label="Situação dos dados"
              data-alerta={situacao.alerta ? "true" : undefined}
              className={`mb-6 border p-4 ${situacao.alerta ? "border-aviso bg-superficie" : "border-linha bg-superficie"}`}
            >
              <p className={`rotulo ${situacao.alerta ? "text-aviso" : "text-mineral"}`}>Situação dos dados</p>
              <p className="mt-1 font-serif text-lg text-carvao">{situacao.titulo}</p>
              {situacao.texto && <p className="mt-1 text-sm leading-relaxed text-carvao-muted">{situacao.texto}</p>}
              {criterio && <p className="mt-2 text-sm leading-relaxed text-carvao-muted" data-criterio="true">{criterio}</p>}
            </aside>
          )}

          <dl className="grid gap-px border border-linha bg-linha md:grid-cols-2">
            {[
              [
                "Página oficial do conjunto",
                <span key="u">
                  {oficial ? (
                    <>
                      <a href={oficial} target="_blank" rel="noopener noreferrer" className="text-energia-dark underline underline-offset-4">{rotuloDoLinkOficial(oficial, e.orgao)} ↗</a>
                      <span className="mt-1 block break-all text-xs text-mineral" data-nivel="analisar">{oficial}</span>
                    </>
                  ) : (
                    "não informada"
                  )}
                  {paginaInicial && (
                    <span className="mt-1 block" data-pagina-inicial="true">
                      Este endereço é a página inicial do portal: o catálogo não guarda um link direto para o conjunto.
                    </span>
                  )}
                </span>,
              ],
              [
                "Licença",
                <span key="l">
                  {licenca.nome}
                  {licenca.baseLegal && <span data-nivel="analisar"> (base legal: {licenca.baseLegal})</span>}
                </span>,
              ],
              ["Formatos publicados", fraseFormatos(e.formatos, oficial)],
              ["Data de referência", fraseReferencia(integr[0], integr.length > 0)],
              ["Última captura", ultimaCaptura ? carimbo(ultimaCaptura) : "sem captura"],
              ["Última modificação de metadados na fonte", dataFonte(e.modificado_na_fonte)],
            ].map(([k, v], i, lista) => (
              <div key={String(k)} className={`min-w-0 bg-superficie p-4 ${lista.length % 2 === 1 && i === lista.length - 1 ? "md:col-span-2" : ""}`}>
                <dt className="rotulo text-mineral">{k}</dt>
                <dd className="mt-1 text-sm text-carvao [overflow-wrap:anywhere]">{v}</dd>
              </div>
            ))}
          </dl>
          {licenca.nota && <p className="mt-2 text-xs leading-relaxed text-mineral">Observação sobre a licença: {licenca.nota}</p>}

          {e.quebras.length > 0 && (
            <section className="mt-8 border border-linha bg-superficie p-6">
              <h2 className="font-serif text-xl text-carvao">Mudanças metodológicas</h2>
              <p className="mt-1 text-sm text-carvao-muted">
                Cada item diz a origem: declarada na descrição do conjunto pela fonte, ou identificada pela Scrutiniums no próprio dado, sem documento da
                fonte que a confirme.
              </p>
              <ul className="mt-3 space-y-2 text-sm text-carvao">
                {e.quebras.map((q) => (
                  <li key={`${q.data}-${q.origem ?? "FONTE"}`}>
                    <strong className="font-medium">{dataBR(q.data)}</strong>
                    <span className="rotulo ml-2 text-mineral">{q.origem === "PLATAFORMA" ? "identificada pela Scrutiniums no dado" : "declarada pela fonte"}</span>
                    <span className="block">
                      {separaIdentificadores(trocaIdentificadores(q.descricao, nomesDosTitulos)).texto}
                      {separaIdentificadores(trocaIdentificadores(q.descricao, nomesDosTitulos)).tecnico && (
                        <span data-nivel="analisar"> {separaIdentificadores(trocaIdentificadores(q.descricao, nomesDosTitulos)).tecnico}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              {notasDeQuebra.map((n) => (
                <p key={n} className="mt-3 border-l-2 border-aviso pl-3 text-sm leading-relaxed text-carvao" data-quebra-posterior="true">
                  {n}
                </p>
              ))}
            </section>
          )}

          {companheiros.length > 0 && (
            <section className="mt-8 border border-linha bg-superficie p-6" data-companheiros="true">
              <h2 className="font-serif text-xl text-carvao">Outros conjuntos desta ficha</h2>
              <p className="mt-1 text-sm text-carvao-muted">O catálogo registra {plural(companheiros.length, "outro conjunto", "outros conjuntos")} com o mesmo endereço de ficha, porque um mesmo módulo do observatório os integra juntos. O que esta ficha diz da coleta vale para o grupo.</p>
              <ul className="mt-3 space-y-1 text-sm text-carvao">
                {companheiros.map((x) => (
                  <li key={x.id}>
                    <strong className="font-medium">{nomeDoConjunto(x, (pub?.conjuntos ?? []).filter((c) => (x.integracoes ?? []).some((i) => i.id === c.id))).nome}</strong> ({x.orgao}){" "}
                    {urlDoConjunto(x) && (
                      <a href={urlDoConjunto(x) ?? undefined} target="_blank" rel="noopener noreferrer" className="text-energia-dark underline underline-offset-4">
                        página oficial ↗
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section data-nivel="analisar" aria-labelledby="sobre-h" className="mt-8 space-y-4 border border-linha bg-superficie p-6">
            <h2 id="sobre-h" className="font-serif text-xl text-carvao">O conjunto na fonte e na coleta</h2>
            <dl className="grid gap-x-8 gap-y-3 text-sm md:grid-cols-2">
              {nome.tituloNaFonte && (
                <div className="min-w-0 md:col-span-2" data-titulo-na-fonte="true">
                  <dt className="rotulo text-mineral">Título na fonte</dt>
                  <dd className="mt-0.5 text-carvao-muted [overflow-wrap:anywhere]">
                    {nome.tituloNaFonte}
                    {nome.motivo === "grafia"
                      ? ". A fonte grafa esse título sem acento; o observatório mostra a grafia corrigida no título da página e na citação."
                      : nome.motivo === "identificador"
                        ? ". O título publicado pela fonte é um identificador técnico; a página usa o nome que o módulo do observatório dá ao conjunto."
                        : nome.motivo === "separador"
                          ? ". O observatório troca o travessão do título por dois-pontos."
                          : ". O observatório omite do título o nome técnico da consulta."}
                  </dd>
                </div>
              )}
              <div className="min-w-0 md:col-span-2" data-descricao={descricao.origem}>
                <dt className="rotulo text-mineral">Descrição publicada pela fonte</dt>
                <dd className="mt-0.5 leading-relaxed text-carvao-muted">
                  <span className="whitespace-pre-line">{descricao.texto ?? "O catálogo não guarda descrição para este conjunto."}</span>
                  {descricao.origem === "csv" && (
                    <p className="mt-1 text-xs text-mineral" data-descricao-completa="true">
                      Texto completo, de <a href={CSV_DADOS.catalogo.url} download className="underline underline-offset-4">dados_catalogo.csv</a>; o catálogo da página guarda só o começo.
                    </p>
                  )}
                  {descricao.cortada && (
                    <p className="mt-1 text-xs text-mineral" data-descricao-cortada="true">
                      O catálogo guarda só o começo da descrição da fonte; o texto completo está na página oficial do conjunto.
                    </p>
                  )}
                </dd>
              </div>
              <div>
                <dt className="rotulo text-mineral">Etapa no catálogo</dt>
                <dd className="mt-0.5 text-carvao-muted">
                  {ROTULO_ESTADO_DADOS[e.estado]}. {DEFINICAO_ETAPA_LEITOR[e.estado]}
                </dd>
              </div>
              <div>
                <dt className="rotulo text-mineral">Uso declarado</dt>
                <dd className="mt-0.5 text-carvao-muted">
                  {(e.papeis ?? []).map((p) => ROTULO_PAPEL[p] ?? p).join(", ") || "indicador"}
                  {(e.modelos ?? []).length ? ` · modelos ${(e.modelos ?? []).join(", ")}` : ""}
                </dd>
              </div>
              <div>
                <dt className="rotulo text-mineral">Frequência declarada pela fonte (texto original)</dt>
                <dd className="mt-0.5 text-carvao-muted">{e.frequencia_declarada ?? "não declarada"}</dd>
              </div>
              <div>
                <dt className="rotulo text-mineral">Indicadores publicados que usam este conjunto</dt>
                <dd className="mt-0.5 text-carvao-muted" data-indicadores="true">
                  {indicadores.length ? (
                    <ul className="list-disc pl-5">
                      {indicadores.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  ) : (
                    "nenhum: o conjunto não entra no cálculo de indicador publicado"
                  )}
                </dd>
              </div>
              {integr.length > 0 && pub && (
                <div className="min-w-0 md:col-span-2">
                  <dt className="rotulo text-mineral">Atualidade e coleta (publicação de {dataBR(pub.referencia.hoje)})</dt>
                  <dd className="mt-0.5 text-carvao-muted [overflow-wrap:anywhere]">{integr.map((c) => linhasIntegracao(c).join(" ")).join(" ")}</dd>
                </div>
              )}
              {f?.ultima_tentativa && (
                <div className="min-w-0 md:col-span-2">
                  <dt className="rotulo text-mineral">Última tentativa de coleta direta</dt>
                  <dd className="mt-0.5 text-carvao-muted [overflow-wrap:anywhere]">{`${carimbo(f.ultima_tentativa.tentado_em)} · ${f.ultima_tentativa.ok ? "ok" : "falhou"} · ${f.ultima_tentativa.detalhe.replace(/\d{4,}/g, (n) => Number(n).toLocaleString("pt-BR"))}`}</dd>
                </div>
              )}
            </dl>
          </section>

          <section data-nivel="auditar" data-detalhes-tecnicos="true" aria-labelledby="capturas-h" className="mt-8 border border-linha bg-superficie p-6">
            <h2 id="capturas-h" className="font-serif text-xl text-carvao">Capturas guardadas e impressão digital</h2>
            {(f?.snapshot || f?.snapshot_sha256) && (
              <dl className="mt-4 grid gap-px border border-linha bg-linha md:grid-cols-2">
                {f?.snapshot && (
                  <div className="min-w-0 bg-superficie p-4 md:col-span-2">
                    <dt className="rotulo text-mineral">Snapshot</dt>
                    <dd className="mt-1 text-sm text-carvao [overflow-wrap:anywhere]">{f.snapshot}</dd>
                  </div>
                )}
                {f?.snapshot_sha256 && (
                  <div className="min-w-0 bg-superficie p-4 md:col-span-2">
                    <dt className="rotulo text-mineral">sha256 do snapshot</dt>
                    <dd className="mt-1 break-all font-mono text-xs text-carvao">{f.snapshot_sha256}</dd>
                  </div>
                )}
              </dl>
            )}
            <p className="mt-3 text-sm text-carvao-muted">Cada arquivo baixado com conteúdo novo é guardado sem alteração; um download idêntico a um já guardado não cria registro novo. A tabela lista todas as capturas, inclusive as que uma captura posterior do mesmo arquivo substituiu.</p>
            {capturas.length === 0 ? (
              <p className="mt-4 border border-linha bg-papel p-3 text-sm text-carvao" data-sem-capturas="true">
                {ultimaCaptura
                  ? `A lista de capturas arquivo a arquivo deste conjunto não é publicada nesta página. O catálogo registra a última captura em ${carimbo(ultimaCaptura)}.`
                  : "Este conjunto ainda não tem captura registrada: o arquivo não foi baixado com conteúdo, ou o conjunto é consultado no portal da fonte sem cópia local."}
              </p>
            ) : (
              <div className="tabela-scroll mt-4" tabIndex={0} role="region" aria-label="Capturas do conjunto (tabela rolável)">
                <table className="w-full min-w-[50rem] border-collapse text-xs">
                  <caption className="sr-only">Todas as capturas integradas, por recurso</caption>
                  <thead>
                    <tr className="text-left text-mineral">
                      {["Recurso", "Capturado em", "Publicado pela fonte (metadado)", "Origem", "Situação", "sha256"].map((c) => (
                        <th key={c} scope="col" className="border-b border-linha px-2 py-2 font-medium">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {capturas.map((cpt) => (
                      <tr key={`${cpt.recurso}:${cpt.sha256}`} className="border-b border-linha">
                        <td className="px-2 py-1.5 text-carvao">{cpt.recurso}</td>
                        <td className="px-2 py-1.5 text-carvao">{carimbo(cpt.capturado_em)}</td>
                        <td className="px-2 py-1.5 text-carvao-muted">{dataFonte(cpt.publicado_em)}</td>
                        <td className="px-2 py-1.5 text-carvao-muted">{cpt.origem === "seed" ? "captura primária versionada" : "coleta direta"}</td>
                        <td className="px-2 py-1.5 text-carvao-muted">{cpt.vigente ? "vigente" : "substituída"}</td>
                        <td className="break-all px-2 py-1.5 font-mono text-xs text-mineral">{cpt.sha256}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {/* todas as vintages, inclusive as substituídas; publicações antigas da gold só trazem as vigentes (f?.historico) */}
            {typeof f?.recapturas_sem_mudanca === "number" && (
              <p className="mt-3 text-xs text-carvao-muted">
                {f.recapturas_sem_mudanca === 0
                  ? "Nenhum download posterior de arquivo já integrado foi registrado no log de coletas."
                  : `${f.recapturas_sem_mudanca} ${f.recapturas_sem_mudanca === 1 ? "download posterior veio idêntico" : "downloads posteriores vieram idênticos"} a vintages já integradas (log de coletas); por isso não aparecem como linhas novas.`}
              </p>
            )}
          </section>

          <section className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-2">
            <div className="min-w-0 border border-linha bg-superficie p-6 [overflow-wrap:anywhere]">
              <h2 className="font-serif text-xl text-carvao">Arquivos para baixar</h2>
              <p className="mt-2 text-sm leading-relaxed text-carvao-muted" data-tabelas-derivadas="true">
                São tabelas derivadas: o observatório as monta e publica a partir dos dados deste conjunto, e algumas reúnem também dados de outros conjuntos. Por isso o nome do arquivo não repete o título do conjunto. Os formatos publicados, acima, são os da fonte; aqui o observatório oferece só as suas tabelas.
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                {d.downloads.map((u) => {
                  const outras = outrasFichas(u);
                  return (
                    <li key={u}>
                      <a href={u} download className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
                        {rotuloDoArquivo(u, COLUNAS_ARQUIVO[u])} ({formatoDoArquivo(u)})
                      </a>
                      <span className="block text-xs text-mineral" data-nivel="analisar">
                        Arquivo {nomeDoArquivo(u)}
                      </span>
                      {outras.length > 0 && (
                        <span className="block text-xs text-carvao-muted" data-arquivo-compartilhado="true">
                          Reúne dados também de {plural(outras.length, "outro conjunto", "outros conjuntos")}.
                          <span data-nivel="analisar"> {outras.join("; ")}.</span>
                        </span>
                      )}
                      {COLUNAS_ARQUIVO[u] && (
                        <details data-nivel="analisar" className="text-xs leading-relaxed text-carvao-muted">
                          <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-carvao-muted underline underline-offset-4">Colunas do arquivo</summary>
                          <span className="block pb-2">{COLUNAS_ARQUIVO[u]}</span>
                        </details>
                      )}
                    </li>
                  );
                })}
              </ul>
              <h3 className="mt-4 text-sm font-medium text-carvao">Páginas do observatório que usam este conjunto</h3>
              <ul className="mt-1 space-y-1 text-sm">
                {d.paginas.map((p) => (
                  <li key={p.href}><Link href={p.href} className="inline-flex min-h-[44px] items-center text-carvao underline underline-offset-4">{p.rotulo}</Link></li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-mineral">CSV com separador ponto e vírgula e ponto decimal; campo vazio significa ausência, nunca zero.</p>
            </div>
            <div className="min-w-0 border border-linha bg-superficie p-6 [overflow-wrap:anywhere]">
              <h2 className="font-serif text-xl text-carvao">Como citar</h2>
              <p className="mt-3 text-sm leading-relaxed text-carvao">
                {e.orgao}. <em>{nome.nome}</em>. Dados abertos, {/^licen/i.test(paraCitar) ? "" : "licença "}{paraCitar === "não informada" ? "informada na fonte" : paraCitar.replace(/\.$/, "")}. Integrado e processado por Scrutiniums,
                Observatório Brasileiro do Setor Elétrico, captura de {ultimaCaptura ? carimbo(ultimaCaptura).slice(0, 10) : "data não informada"}
                {f?.snapshot ? <span data-nivel="analisar">, snapshot {f.snapshot}</span> : null}. Disponível em: https://scrutiniums.com/setor-eletrico/dados/{d.slug}. Acesso em: [data do seu acesso].
              </p>
              {nome.tituloNaFonte && (
                <p className="mt-2 text-xs leading-relaxed text-mineral" data-nivel="analisar">
                  Título na fonte: {nome.tituloNaFonte}.
                </p>
              )}
            </div>
          </section>
        </ModoProfundidade>
      </main>
    </>
  );
}
