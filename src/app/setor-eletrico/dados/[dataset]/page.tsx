import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { LegendaDeSiglas } from "@/components/energia/LegendaSiglas";
import { gold } from "@/lib/energia/gold";
import { carimbo, dataBR } from "@/lib/energia/formato";
import { COLUNAS_ARQUIVO, DATASETS_INTEGRADOS, datasetPorSlug, urlDoConjunto } from "@/lib/energia/datasets";
import { descricaoLegivel, fraseFrequencia, linhasIntegracao, partirLicenca, pelo, refLegivel, situacaoDoConjunto } from "@/lib/energia/dados";
import { publicacaoDados } from "@/lib/energia/dados-servidor";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return DATASETS_INTEGRADOS.map((d) => ({ dataset: d.slug }));
}

export function generateMetadata({ params }: { params: { dataset: string } }): Metadata {
  const d = datasetPorSlug(params.dataset);
  const e = gold.catalogo()?.entradas.find((x) => x.id === d?.catalogoId);
  if (!d || !e) return {};
  return {
    title: `${e.titulo} (${e.orgao}) · dados`,
    description: `Metadados, capturas com sha256, transformações, downloads e forma de citação do conjunto ${e.titulo} (${e.orgao}) integrado ao Observatório do Setor Elétrico.`,
    alternates: { canonical: `/setor-eletrico/dados/${d.slug}` },
  };
}

/** Data do metadado da fonte (ISO em UTC, às vezes sem o "Z") no horário de Brasília. */
function dataFonte(iso: string | null | undefined): string {
  if (!iso) return "não informada";
  const comFuso = /Z$|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`;
  return Number.isNaN(new Date(comFuso).getTime()) ? iso : carimbo(comFuso);
}

export default function DatasetPage({ params }: { params: { dataset: string } }) {
  const d = datasetPorSlug(params.dataset);
  const cat = gold.catalogo();
  const meta = gold.meta();
  const e = cat?.entradas.find((x) => x.id === d?.catalogoId);
  if (!d || !e) notFound();
  const f = meta?.fontes[d.interno];
  // a gold meta.json cobre só parte das fontes; as integrações de publicacao.json trazem a captura e a atualidade de cada conjunto
  const pub = publicacaoDados();
  const integr = (pub?.conjuntos ?? []).filter((c) => c.id.endsWith(`/${d.interno}`));
  const ultimaCaptura = f?.ultima_captura ?? integr.map((c) => c.capturas.ultima).filter((x): x is string => !!x).sort().at(-1) ?? null;
  // todas as vintages, inclusive as substituídas; publicações antigas da gold só trazem as vigentes
  // último período que o conjunto cobre, segundo a atualidade medida na publicação; sem integração, o motivo
  const periodos = integr.map((c) => c.atualidade.ultimo_periodo).filter((x): x is string => !!x).sort();
  const referenciaDoConjunto = periodos.length ? `último período disponível ${refLegivel(periodos[periodos.length - 1])}` : integr.length ? "sem período registrado para este conjunto" : "conjunto sem integração: sem período medido";
  const situacao = integr.length ? situacaoDoConjunto(integr[0]) : null;
  const desc = descricaoLegivel(e.descricao);
  const licencaBruta = e.licenca ?? (cat?.portais[e.orgao] as { licenca?: string | null } | undefined)?.licenca ?? "não informada";
  const licenca = partirLicenca(licencaBruta);
  const frequencia = fraseFrequencia(integr.flatMap((c) => c.frequencia?.cadencias ?? []).filter((c, i, a) => a.indexOf(c) === i));
  const capturas = f?.historico?.length ? f.historico : (f?.capturas ?? []).map((x) => ({ ...x, vigente: true }));
  return (
    <>
      <CabecalhoEnergia atual="dados" />
      <MarcaVisita secao="energia:dados" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6 pb-16">
        <nav aria-label="Trilha" className="pt-8 text-sm text-mineral">
          <Link href="/setor-eletrico/dados" className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center underline underline-offset-4">Dados</Link> · {e.orgao}
        </nav>
        <header className="pb-6 pt-4">
          <p className="rotulo text-mineral">{e.orgao} · {e.estado}</p>
          <h1 className="mt-2 font-serif text-[clamp(1.8rem,4vw,2.6rem)] leading-tight text-carvao [overflow-wrap:break-word]">{e.titulo.split("_").map((parte, i, todas) => (i < todas.length - 1 ? <span key={i}>{parte}_<wbr /></span> : parte))}</h1>
          <p className="mt-3 max-w-prose2 text-base leading-relaxed text-carvao">
            Conjunto de dados abertos publicado {pelo(e.orgao)} {e.orgao}.{frequencia ? ` ${frequencia}` : ""} O observatório o usa em: {d.paginas.map((p) => p.rotulo).join(", ")}.
          </p>
          {desc.texto && <p className="mt-3 max-w-prose2 whitespace-pre-line text-sm leading-relaxed text-carvao-muted">{desc.texto}</p>}
          {desc.cortada && (
            <p className="mt-2 text-xs text-mineral" data-descricao-cortada="true">
              O catálogo guarda só o começo da descrição da fonte; o texto completo está na página oficial do conjunto, abaixo.
            </p>
          )}
          <LegendaDeSiglas />
        </header>

        {situacao && (
          <aside
            aria-label="Situação dos dados"
            data-alerta={situacao.alerta ? "true" : undefined}
            className={`mb-6 border p-4 ${situacao.alerta ? "border-aviso bg-superficie" : "border-linha bg-superficie"}`}
          >
            <p className={`rotulo ${situacao.alerta ? "text-aviso" : "text-mineral"}`}>Situação dos dados</p>
            <p className="mt-1 font-serif text-lg text-carvao">{situacao.titulo}</p>
            {situacao.texto && <p className="mt-1 text-sm leading-relaxed text-carvao-muted">{situacao.texto}</p>}
          </aside>
        )}

        <dl className="grid gap-px border border-linha bg-linha md:grid-cols-2">
          {[
            ["Página oficial do conjunto", <a key="u" href={urlDoConjunto(e) ?? undefined} target="_blank" rel="noopener noreferrer" className="break-all text-energia-dark underline underline-offset-4">{urlDoConjunto(e)} ↗</a>],
            ["Licença", licenca.curta],
            ["Formatos publicados", (e.formatos ?? []).join(", ") || "não informado"],
            ["Usado nas páginas", d.paginas.map((p) => p.rotulo).join(", ") + ((e.modelos ?? []).length ? ` · modelos ${(e.modelos ?? []).join(", ")}` : "")],
            ["Data de referência", referenciaDoConjunto],
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
                  <span className="block">{q.descricao}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <details className="mt-8 border border-linha bg-superficie p-6" data-detalhes-tecnicos="true">
          <summary className="cursor-pointer font-serif text-xl text-carvao">Detalhes técnicos da coleta e das capturas</summary>
          <dl className="mt-4 grid gap-px border border-linha bg-linha md:grid-cols-2">
            {[
              ...(integr.length ? [["Atualidade e coleta (publicação de " + dataBR(pub!.referencia.hoje) + ")", <span key="a">{integr.map((c) => linhasIntegracao(c).join(" ")).join(" ")}</span>] as [string, React.ReactNode]] : []),
              ...(f?.snapshot ? [["Snapshot", f.snapshot] as [string, React.ReactNode]] : []),
              ...(f?.snapshot_sha256 ? [["sha256 do snapshot", <span key="s" className="break-all font-mono text-xs">{f.snapshot_sha256}</span>] as [string, React.ReactNode]] : []),
              ...(f?.ultima_tentativa ? [["Última tentativa de coleta direta", `${carimbo(f.ultima_tentativa.tentado_em)} · ${f.ultima_tentativa.ok ? "ok" : "falhou"} · ${f.ultima_tentativa.detalhe.replace(/\d{4,}/g, (n) => Number(n).toLocaleString("pt-BR"))}`] as [string, React.ReactNode]] : []),
            ].map(([k, v]) => (
              <div key={String(k)} className="min-w-0 bg-superficie p-4 md:col-span-2">
                <dt className="rotulo text-mineral">{k}</dt>
                <dd className="mt-1 text-sm text-carvao [overflow-wrap:anywhere]">{v}</dd>
              </div>
            ))}
          </dl>
          <h2 className="mt-6 font-serif text-lg text-carvao">Capturas guardadas</h2>
          <p className="mt-1 text-sm text-carvao-muted">Cada arquivo baixado com conteúdo novo é guardado sem alteração; um download idêntico a um já guardado não cria registro novo. A tabela lista todas as capturas, inclusive as que uma captura posterior do mesmo arquivo substituiu.</p>
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
                      <td className="break-all px-2 py-1.5 font-mono text-[0.68rem] text-mineral">{cpt.sha256}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {typeof f?.recapturas_sem_mudanca === "number" && (
            <p className="mt-3 text-xs text-carvao-muted">
              {f.recapturas_sem_mudanca === 0
                ? "Nenhum download posterior de arquivo já integrado foi registrado no log de coletas."
                : `${f.recapturas_sem_mudanca} ${f.recapturas_sem_mudanca === 1 ? "download posterior veio idêntico" : "downloads posteriores vieram idênticos"} a vintages já integradas (log de coletas); por isso não aparecem como linhas novas.`}
            </p>
          )}
        </details>

        <section className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-2">
          <div className="min-w-0 border border-linha bg-superficie p-6 [overflow-wrap:anywhere]">
            <h2 className="font-serif text-xl text-carvao">Arquivos para baixar</h2>
            <ul className="mt-3 space-y-1 text-sm">
              {d.downloads.map((u) => (
                <li key={u}>
                  <a href={u} download className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">{u.split("/").pop()}</a>
                  {COLUNAS_ARQUIVO[u] && (
                    <details className="text-xs leading-relaxed text-carvao-muted">
                      <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-carvao-muted underline underline-offset-4">Colunas do arquivo</summary>
                      <span className="block pb-2">{COLUNAS_ARQUIVO[u]}</span>
                    </details>
                  )}
                </li>
              ))}
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
              {e.orgao}. <em>{e.titulo}</em>. Dados abertos, {/^licen/i.test(licenca.curta) ? "" : "licença "}{licenca.curta === "não informada" ? "informada na fonte" : licenca.curta.replace(/\.$/, "")}. Integrado e processado por Scrutiniums,
              Observatório Brasileiro do Setor Elétrico, captura de {ultimaCaptura ? carimbo(ultimaCaptura).slice(0, 10) : "data não informada"}{f?.snapshot ? <>, snapshot {f.snapshot}</> : null}. Disponível em: https://scrutiniums.com/setor-eletrico/dados/{d.slug}. Acesso em: [data do seu acesso].
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
