import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { VisualConceito } from "@/components/energia/VisualConceito";
import { CONCEITOS, conceito } from "@/lib/energia/conteudo/conceitos";
import { exemploDe } from "@/lib/energia/conteudo/exemplos";
import { dataBR } from "@/lib/energia/formato";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";

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

function Campo({ rotulo, children, id }: { rotulo: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-linha py-6 md:grid md:grid-cols-[12rem_1fr] md:gap-8">
      <h2 className="rotulo text-mineral">{rotulo}</h2>
      <div className="mt-2 leading-relaxed text-carvao md:mt-0">{children}</div>
    </section>
  );
}

/**
 * Microaula: cabe em uma tela. Em uma frase; Veja (o mini visual ligado ao dado
 * real); Hoje (o exemplo real com selo por número); Por que importa; Relacionado
 * a; Aprofundar (como é medido, fonte oficial com trecho, limitações, onde ver
 * no portal). Verbete pendente não publica definição.
 */
export default function ConceitoPage({ params }: { params: { conceito: string } }) {
  const c = conceito(params.conceito);
  if (!c) notFound();
  const ex = c.estado === "CONFERIDO" ? exemploDe(c.slug) : null;
  const visual = c.estado === "CONFERIDO" ? VisualConceito({ slug: c.slug }) : null;
  const relacionados = c.relacoes.map((r) => conceito(r)).filter((x): x is NonNullable<typeof x> => !!x);
  return (
    <>
      <CabecalhoEnergia atual="aprenda" />
      <MarcaVisita secao="energia:aprenda" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6 pb-16">
        <nav aria-label="Trilha" className="pt-8 text-sm text-mineral">
          <Link href="/setor-eletrico/aprenda" className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center underline underline-offset-4">Aprenda</Link> · {c.grupo} · microaula
        </nav>
        <header className="pb-6 pt-2">
          <h1 className="font-serif text-[clamp(2rem,4.4vw,3rem)] leading-tight text-carvao">
            {c.sigla && (
              <>
                <span className="mr-3">{c.sigla}</span>
              </>
            )}
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
          <div className="grid gap-6 border-t border-linha pt-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div>
              <h2 className="rotulo text-mineral">Em uma frase</h2>
              <p className="mt-2 font-serif text-2xl leading-snug text-carvao">{c.emUmaFrase}</p>
              <h2 className="rotulo mt-6 text-mineral">Hoje</h2>
              {ex ? (
                <p className="mt-2 leading-relaxed text-carvao">
                  {ex.partes.map((pt, i) => (
                    <span key={i}>
                      {pt.texto}
                      {pt.natureza && (
                        <span className="mx-1 align-middle">
                          <SeloNatureza natureza={pt.natureza} />
                        </span>
                      )}
                    </span>
                  ))}{" "}
                  <Link href={ex.href} className="text-sm text-energia-dark underline underline-offset-4">ver no portal</Link>
                </p>
              ) : (
                <p className="mt-2 text-carvao-muted">Exemplo com dado integrado ainda não disponível para este conceito.</p>
              )}
            </div>
            <div className="border border-linha bg-superficie p-4">
              <h2 className="rotulo text-mineral">Veja</h2>
              {visual ? (
                <>
                  <div className="mt-2">{visual.figura}</div>
                  <p className="mt-2 text-xs leading-relaxed text-mineral">{visual.legenda}</p>
                </>
              ) : (
                <p className="mt-2 text-sm text-carvao-muted">Sem visual ligado a dado integrado para este conceito nesta fase.</p>
              )}
            </div>
          </div>
        )}

        {c.estado === "CONFERIDO" && <Campo rotulo="Por que importa">{c.porQueImporta}</Campo>}
        <Campo rotulo="Relacionado a">
          <ul className="flex flex-wrap gap-2">
            {relacionados.map((rc) => (
              <li key={rc.slug}>
                <Link href={`/setor-eletrico/aprenda/${rc.slug}`} className="rotulo inline-flex min-h-[44px] items-center gap-1.5 border border-linha px-3 text-carvao hover:border-energia">
                  {rc.sigla ?? rc.nome}
                  {rc.estado === "PENDENTE" && <span aria-hidden="true" className="text-aviso">○</span>}
                </Link>
              </li>
            ))}
            {relacionados.length === 0 && <li className="text-sm text-mineral">Sem relações registradas.</li>}
          </ul>
        </Campo>

        <section id="aprofundar" className="scroll-mt-24 border-t border-linha pt-6">
          <h2 className="font-serif text-xl text-carvao">Aprofundar</h2>
          {c.estado === "CONFERIDO" && <Campo rotulo="Como é medido">{c.comoEMedido}</Campo>}
          {c.fontes.length > 0 && (
            <Campo rotulo="Fonte oficial">
              <ul className="space-y-4">
                {c.fontes.map((f) => (
                  <li key={f.url + f.documento}>
                    <p className="text-sm">
                      <strong className="font-medium">{f.orgao}</strong>
                      <a href={f.url} target="_blank" rel="noopener noreferrer" className="block py-3 leading-snug text-energia-dark underline underline-offset-4 [overflow-wrap:anywhere]">
                        {f.documento} <span aria-hidden="true">↗</span>
                      </a>
                    </p>
                    {f.trecho && <blockquote className="mt-2 border-l-2 border-linha pl-4 text-sm text-carvao-muted">“{f.trecho}”</blockquote>}
                    {f.parafrase && <p className="mt-2 pl-4 text-sm text-carvao">{f.parafrase}</p>}
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
              <li>
                <Link href="/setor-eletrico/aprenda/como-funciona" className="text-energia-dark underline underline-offset-4">Como funciona o sistema elétrico brasileiro (infográfico)</Link>
              </li>
            </ul>
          </Campo>
        </section>
      </main>
    </>
  );
}
