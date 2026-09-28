import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { gold } from "@/lib/energia/gold";
import { carimbo, dataBR } from "@/lib/energia/formato";
import { COLUNAS_ARQUIVO, DATASETS_INTEGRADOS, datasetPorSlug } from "@/lib/energia/datasets";
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
  // todas as vintages, inclusive as substituídas; publicações antigas da gold só trazem as vigentes
  const capturas = f?.historico?.length ? f.historico : (f?.capturas ?? []).map((x) => ({ ...x, vigente: true }));
  return (
    <>
      <CabecalhoEnergia atual="dados" />
      <MarcaVisita secao="energia:dados" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6 pb-16">
        <nav aria-label="Trilha" className="pt-8 text-sm text-mineral">
          <Link href="/setor-eletrico/dados" className="inline-flex min-h-[44px] items-center underline underline-offset-4">Dados</Link> · {e.orgao}
        </nav>
        <header className="pb-6 pt-4">
          <p className="rotulo text-mineral">{e.orgao} · {e.estado}</p>
          <h1 className="mt-2 font-serif text-[clamp(1.8rem,4vw,2.6rem)] leading-tight text-carvao">{e.titulo}</h1>
          <p className="mt-3 max-w-prose2 whitespace-pre-line text-sm leading-relaxed text-carvao-muted">{e.descricao}</p>
        </header>
        <dl className="grid gap-px border border-linha bg-linha md:grid-cols-2">
          {[
            ["Página oficial do conjunto", <a key="u" href={e.url} target="_blank" rel="noopener noreferrer" className="break-all text-energia-dark underline underline-offset-4">{e.url} ↗</a>],
            ["Licença", e.licenca ?? "não informada"],
            ["Última modificação de metadados na fonte", dataFonte(e.modificado_na_fonte)],
            ["Formatos publicados", e.formatos.join(", ") || "não informado"],
            ["Usado nas páginas", d.paginas.map((p) => p.rotulo).join(", ") + (e.modelos.length ? ` · modelos ${e.modelos.join(", ")}` : "")],
            ["Última captura", f?.ultima_captura ? carimbo(f.ultima_captura) : "sem captura"],
            ["Snapshot", f?.snapshot ?? "–"],
            ["sha256 do snapshot", <span key="s" className="break-all font-mono text-xs">{f?.snapshot_sha256 ?? "–"}</span>],
            ["Última tentativa de coleta direta", f?.ultima_tentativa ? `${carimbo(f.ultima_tentativa.tentado_em)} · ${f.ultima_tentativa.ok ? "ok" : "falhou"} · ${f.ultima_tentativa.detalhe}` : "não registrada nesta publicação"],
          ].map(([k, v], i, lista) => (
            <div key={String(k)} className={`min-w-0 bg-superficie p-4 ${lista.length % 2 === 1 && i === lista.length - 1 ? "md:col-span-2" : ""}`}>
              <dt className="rotulo text-mineral">{k}</dt>
              <dd className="mt-1 text-sm text-carvao [overflow-wrap:anywhere]">{v}</dd>
            </div>
          ))}
        </dl>

        {e.quebras.length > 0 && (
          <section className="mt-8 border border-linha bg-superficie p-6">
            <h2 className="font-serif text-xl text-carvao">Mudanças metodológicas declaradas pela fonte</h2>
            <ul className="mt-3 space-y-2 text-sm text-carvao">
              {e.quebras.map((q) => (
                <li key={q.data}><strong className="font-medium">{dataBR(q.data)}:</strong> {q.descricao}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-8 border border-linha bg-superficie p-6">
          <h2 className="font-serif text-xl text-carvao">Capturas integradas (vintages)</h2>
          <p className="mt-1 text-sm text-carvao-muted">Cada arquivo baixado com conteúdo novo é uma vintage imutável; download idêntico a uma vintage existente não gera linha nova. A tabela lista todas as vintages, inclusive as substituídas por captura posterior do mesmo arquivo. Os valores das vintages ficam no histórico do pipeline (cache da automação e cópia durável), usado para reconstituir o que se sabia em cada data, e não são publicados no portal.</p>
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
          {typeof f?.recapturas_sem_mudanca === "number" && (
            <p className="mt-3 text-xs text-carvao-muted">
              {f.recapturas_sem_mudanca === 0
                ? "Nenhum download posterior de arquivo já integrado foi registrado no log de coletas."
                : `${f.recapturas_sem_mudanca} ${f.recapturas_sem_mudanca === 1 ? "download posterior veio idêntico" : "downloads posteriores vieram idênticos"} a vintages já integradas (log de coletas); por isso não aparecem como linhas novas.`}
            </p>
          )}
        </section>

        <section className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="border border-linha bg-superficie p-6">
            <h2 className="font-serif text-xl text-carvao">Downloads e páginas</h2>
            <ul className="mt-3 space-y-1 text-sm">
              {d.downloads.map((u) => (
                <li key={u}>
                  <a href={u} download className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">{u.split("/").pop()}</a>
                  {COLUNAS_ARQUIVO[u] && <span className="block text-xs leading-relaxed text-carvao-muted">{COLUNAS_ARQUIVO[u]}</span>}
                </li>
              ))}
              {d.paginas.map((p) => (
                <li key={p.href}><Link href={p.href} className="text-carvao underline underline-offset-4">{p.rotulo}</Link></li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-mineral">CSV com separador ponto e vírgula e ponto decimal; campo vazio significa ausência, nunca zero.</p>
          </div>
          <div className="border border-linha bg-superficie p-6">
            <h2 className="font-serif text-xl text-carvao">Como citar</h2>
            <p className="mt-3 text-sm leading-relaxed text-carvao">
              {e.orgao}. <em>{e.titulo}</em>. Dados abertos, licença {e.licenca ?? "informada na fonte"}. Integrado e processado por Scrutiniums,
              Observatório Brasileiro do Setor Elétrico, captura de {f?.ultima_captura ? dataBR(f.ultima_captura) : "data não informada"}, snapshot{" "}
              {f?.snapshot ?? "–"}. Disponível em: https://scrutiniums.com/setor-eletrico/dados/{d.slug}. Acesso em: [data do seu acesso].
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
