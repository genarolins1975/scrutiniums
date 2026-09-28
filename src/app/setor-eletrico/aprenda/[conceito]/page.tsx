import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { CONCEITOS, conceito } from "@/lib/energia/conteudo/conceitos";
import { exemploDe } from "@/lib/energia/conteudo/exemplos";
import { dataBR } from "@/lib/energia/formato";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return CONCEITOS.map((c) => ({ conceito: c.slug }));
}

export function generateMetadata({ params }: { params: { conceito: string } }): Metadata {
  const c = conceito(params.conceito);
  if (!c) return {};
  const nome = c.sigla ? `${c.sigla}: ${c.nome}` : c.nome;
  return {
    title: `${nome} · Aprenda`,
    description: c.estado === "CONFERIDO" ? c.emUmaFrase : `Verbete em preparação: ${c.nome}. Fonte primária a conferir.`,
    alternates: { canonical: `/setor-eletrico/aprenda/${c.slug}` },
    // verbete em preparação não tem definição publicada: não deve ser indexado
    ...(c.estado === "PENDENTE" ? { robots: { index: false, follow: true } } : {}),
  };
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-linha py-6 md:grid md:grid-cols-[12rem_1fr] md:gap-8">
      <h2 className="rotulo text-mineral">{rotulo}</h2>
      <div className="mt-2 leading-relaxed text-carvao md:mt-0">{children}</div>
    </section>
  );
}

export default function ConceitoPage({ params }: { params: { conceito: string } }) {
  const c = conceito(params.conceito);
  if (!c) notFound();
  const ex = c.estado === "CONFERIDO" ? exemploDe(c.slug) : null;
  return (
    <>
      <CabecalhoEnergia atual="aprenda" />
      <main className="mx-auto max-w-page px-6 pb-16">
        <nav aria-label="Trilha" className="pt-8 text-sm text-mineral">
          <Link href="/setor-eletrico/aprenda" className="underline underline-offset-4">Aprenda</Link> · {c.grupo}
        </nav>
        <header className="pb-6 pt-4">
          <h1 className="font-serif text-[clamp(2rem,4.4vw,3rem)] leading-tight text-carvao">
            {c.sigla && <span className="mr-3">{c.sigla}</span>}
            <span className={c.sigla ? "text-carvao-muted" : ""}>{c.nome}</span>
          </h1>
          <p className="mt-3 flex flex-wrap items-center gap-3 text-xs text-mineral">
            {c.estado === "CONFERIDO" ? (
              <span className="rotulo text-sucesso">● conferido na fonte primária em {dataBR(c.conferidoEm)}</span>
            ) : (
              <span className="rotulo text-aviso">○ verbete em preparação</span>
            )}
          </p>
        </header>

        {c.estado === "PENDENTE" ? (
          <div role="status" className="border border-dashed border-mineral bg-papel p-6">
            <p className="text-carvao">
              A definição deste conceito ainda não foi conferida na fonte primária e por isso não é publicada. A plataforma não escreve definições de memória.
            </p>
            <p className="mt-3 text-sm text-carvao-muted">Fonte primária planejada: {c.fontePlanejada}</p>
            {c.fontes.length > 0 && (
              <p className="mt-2 text-sm text-carvao-muted">
                Conjunto de dados relacionado:{" "}
                <a href={c.fontes[0].url} target="_blank" rel="noopener noreferrer" className="text-energia-dark underline underline-offset-4">{c.fontes[0].documento}</a>
              </p>
            )}
          </div>
        ) : (
          <>
            <Campo rotulo="Em uma frase">
              <p className="font-serif text-xl leading-relaxed">{c.emUmaFrase}</p>
            </Campo>
            <Campo rotulo="Por que importa">{c.porQueImporta}</Campo>
            <Campo rotulo="Como é medido">{c.comoEMedido}</Campo>
            <Campo rotulo="Exemplo real">
              {ex ? (
                <p>
                  {ex.texto} <span className="ml-1 align-middle"><SeloNatureza natureza={ex.natureza} /></span>{" "}
                  <Link href={ex.href} className="text-sm text-energia-dark underline underline-offset-4">ver no portal</Link>
                </p>
              ) : (
                <p className="text-carvao-muted">Exemplo com dado integrado ainda não disponível para este conceito.</p>
              )}
            </Campo>
          </>
        )}
        <Campo rotulo="Relações">
          <ul className="flex flex-wrap gap-2">
            {c.relacoes.map((r) => {
              const rc = conceito(r);
              return rc ? (
                <li key={r}>
                  <Link href={`/setor-eletrico/aprenda/${r}`} className="rotulo inline-flex min-h-[40px] items-center border border-linha px-3 text-carvao hover:border-energia">
                    {rc.sigla ?? rc.nome}
                  </Link>
                </li>
              ) : null;
            })}
          </ul>
        </Campo>
        {c.fontes.length > 0 && (
          <Campo rotulo="Fonte oficial">
            <ul className="space-y-4">
              {c.fontes.map((f) => (
                <li key={f.url + f.documento}>
                  <p className="text-sm">
                    <strong className="font-medium">{f.orgao}</strong>:{" "}
                    <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-energia-dark underline underline-offset-4">{f.documento}</a>
                  </p>
                  {f.trecho && <blockquote className="mt-2 border-l-2 border-linha pl-4 text-sm text-carvao-muted">“{f.trecho}”</blockquote>}
                </li>
              ))}
            </ul>
          </Campo>
        )}
        {c.limitacoes && c.limitacoes.length > 0 && (
          <Campo rotulo="O que não se pode concluir">
            <ul className="list-disc space-y-1.5 pl-5">
              {c.limitacoes.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </Campo>
        )}
        <Campo rotulo="Veja no portal">
          <ul className="space-y-1">
            {c.vejaNoPortal.map((v) => (
              <li key={v.href}>
                <Link href={v.href} className="text-energia-dark underline underline-offset-4">{v.rotulo}</Link>
              </li>
            ))}
          </ul>
        </Campo>
      </main>
    </>
  );
}
