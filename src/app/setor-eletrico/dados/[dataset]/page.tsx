import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { gold } from "@/lib/energia/gold";
import { carimbo, dataBR } from "@/lib/energia/formato";
import { DATASETS_INTEGRADOS, datasetPorSlug } from "@/lib/energia/datasets";

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

export default function DatasetPage({ params }: { params: { dataset: string } }) {
  const d = datasetPorSlug(params.dataset);
  const cat = gold.catalogo();
  const meta = gold.meta();
  const e = cat?.entradas.find((x) => x.id === d?.catalogoId);
  if (!d || !e) notFound();
  const f = meta?.fontes[d.interno];
  return (
    <>
      <CabecalhoEnergia atual="dados" />
      <main className="mx-auto max-w-page px-6 pb-16">
        <nav aria-label="Trilha" className="pt-8 text-sm text-mineral">
          <Link href="/setor-eletrico/dados" className="underline underline-offset-4">Dados</Link> · {e.orgao}
        </nav>
        <header className="pb-6 pt-4">
          <p className="rotulo text-mineral">{e.orgao} · {e.estado}</p>
          <h1 className="mt-2 font-serif text-[clamp(1.8rem,4vw,2.6rem)] leading-tight text-carvao">{e.titulo}</h1>
          <p className="mt-3 max-w-prose2 whitespace-pre-line text-sm leading-relaxed text-carvao-muted">{e.descricao}</p>
        </header>
        <dl className="grid gap-px border border-linha bg-linha md:grid-cols-2">
          {[
            ["Página oficial do conjunto", <a key="u" href={e.url} target="_blank" rel="noopener noreferrer" className="text-energia-dark underline underline-offset-4">{e.url} ↗</a>],
            ["Licença", e.licenca ?? "não informada"],
            ["Última modificação de metadados na fonte", e.modificado_na_fonte ?? "não informada"],
            ["Formatos publicados", e.formatos.join(", ") || "não informado"],
            ["Usado em", e.usado_em.join(", ") + (e.modelos.length ? ` · modelos ${e.modelos.join(", ")}` : "")],
            ["Última captura", f?.ultima_captura ? carimbo(f.ultima_captura) : "sem captura"],
            ["Snapshot", f?.snapshot ?? "–"],
            ["sha256 do snapshot", <span key="s" className="break-all font-mono text-xs">{f?.snapshot_sha256 ?? "–"}</span>],
            ["Última tentativa de coleta direta", f?.ultima_tentativa ? `${carimbo(f.ultima_tentativa.tentado_em)} · ${f.ultima_tentativa.ok ? "ok" : "falhou"} · ${f.ultima_tentativa.detalhe}` : "não registrada nesta publicação"],
          ].map(([k, v]) => (
            <div key={String(k)} className="bg-superficie p-4">
              <dt className="rotulo text-mineral">{k}</dt>
              <dd className="mt-1 text-sm text-carvao">{v}</dd>
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
          <p className="mt-1 text-sm text-carvao-muted">Cada arquivo baixado é uma vintage imutável. Uma revisão da fonte vira vintage nova; a anterior continua disponível para reconstituir o que se sabia em cada data.</p>
          <div className="tabela-scroll mt-4">
            <table className="w-full min-w-[44rem] border-collapse text-xs">
              <caption className="sr-only">Capturas por recurso</caption>
              <thead>
                <tr className="text-left text-mineral">
                  {["Recurso", "Capturado em", "Publicado pela fonte (metadado)", "Origem", "sha256"].map((c) => (
                    <th key={c} scope="col" className="border-b border-linha px-2 py-2 font-medium">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(f?.capturas ?? []).map((cpt) => (
                  <tr key={cpt.recurso} className="border-b border-linha">
                    <td className="px-2 py-1.5 text-carvao">{cpt.recurso}</td>
                    <td className="px-2 py-1.5 text-carvao">{carimbo(cpt.capturado_em)}</td>
                    <td className="px-2 py-1.5 text-carvao-muted">{cpt.publicado_em ?? "não informado"}</td>
                    <td className="px-2 py-1.5 text-carvao-muted">{cpt.origem === "seed" ? "captura primária versionada" : "coleta direta"}</td>
                    <td className="break-all px-2 py-1.5 font-mono text-[0.68rem] text-mineral">{cpt.sha256}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="border border-linha bg-superficie p-6">
            <h2 className="font-serif text-xl text-carvao">Downloads e páginas</h2>
            <ul className="mt-3 space-y-1 text-sm">
              {d.downloads.map((u) => (
                <li key={u}><a href={u} download className="text-energia-dark underline underline-offset-4">{u.split("/").pop()}</a></li>
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
