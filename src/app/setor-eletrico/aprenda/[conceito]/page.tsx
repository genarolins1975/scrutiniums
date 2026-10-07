import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { AprendaProva } from "@/components/energia/AprendaProva";
import { CONCEITOS, conceito } from "@/lib/energia/conteudo/conceitos";
import { EXEMPLO_SINTETICO, UNIDADE, contrastesDe } from "@/lib/energia/conteudo/complementos";
import { provaDoVerbete } from "@/lib/energia/conteudo/provas";
import { hrefPasso, passosComVerbete } from "@/lib/energia/conteudo/trilhas";
import { dataBR } from "@/lib/energia/formato";
import { AVISO_SINTETICO, ROTULO_SINTETICO } from "@/lib/energia/sintetico";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return CONCEITOS.map((c) => ({ conceito: c.slug }));
}

export function generateMetadata({ params }: { params: { conceito: string } }): Metadata {
  const c = conceito(params.conceito);
  if (!c) return {};
  const nome = c.sigla && c.sigla.toLowerCase() !== c.nome.toLowerCase() ? `${c.sigla}: ${c.nome}` : c.nome;
  return {
    title: `${nome} · Aprenda`,
    description: c.estado === "CONFERIDO" ? c.emUmaFrase : `Verbete em preparação: ${c.nome}. Fonte primária a conferir.`,
    alternates: { canonical: `/setor-eletrico/aprenda/${c.slug}` },
    // verbete em preparação não tem definição publicada: não deve ser indexado
    ...(c.estado === "PENDENTE" ? { robots: { index: false, follow: true } } : {}),
  };
}

function Campo({ rotulo, id, children }: { rotulo: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-4 border-t border-linha py-6 md:grid md:grid-cols-[12rem_1fr] md:gap-8">
      <h2 className="rotulo text-mineral">{rotulo}</h2>
      <div className="mt-2 leading-relaxed text-carvao md:mt-0">{children}</div>
    </section>
  );
}

export default function ConceitoPage({ params }: { params: { conceito: string } }) {
  const c = conceito(params.conceito);
  if (!c) notFound();
  const conferido = c.estado === "CONFERIDO";
  const prova = conferido ? provaDoVerbete(c.slug) : null;
  const sintetico = conferido && !prova ? EXEMPLO_SINTETICO[c.slug] : undefined;
  const contrastes = conferido ? contrastesDe(c.slug) : [];
  const nasTrilhas = conferido ? passosComVerbete(c.slug) : [];
  const unidade = conferido ? UNIDADE[c.slug] : undefined;
  return (
    <>
      <CabecalhoEnergia atual="aprenda" />
      <MarcaVisita secao="energia:aprenda" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6 pb-16">
        <nav aria-label="Trilha" className="pt-8 text-sm text-mineral">
          <Link href="/setor-eletrico/aprenda" className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center underline underline-offset-4">Aprenda</Link> · {c.grupo}
        </nav>
        <header className="pb-6 pt-4">
          <h1 className="font-serif text-[clamp(2rem,4.4vw,3rem)] leading-tight text-carvao">
            {c.sigla && c.sigla.toLowerCase() !== c.nome.toLowerCase() ? (
              <>
                <span className="mr-3">{c.sigla}</span>{" "}
                <span className="text-carvao-muted">{c.nome}</span>
              </>
            ) : (
              <span>{c.nome}</span>
            )}
          </h1>
          <p className="mt-3 flex flex-wrap items-center gap-3 text-xs text-mineral">
            {c.estado === "CONFERIDO" ? (
              <>
                <span className="rotulo text-sucesso">● conferido na fonte primária em {dataBR(c.conferidoEm)}</span>
                {c.revisadoEm && c.revisadoEm !== c.conferidoEm && <span className="rotulo">revisado em {dataBR(c.revisadoEm)}</span>}
              </>
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
            <details className="mt-3 text-sm text-carvao-muted">
              <summary className="inline-flex min-h-[44px] cursor-pointer items-center underline underline-offset-4">Como a definição será conferida</summary>
              <p className="mt-1">Fonte primária planejada: {c.fontePlanejada}</p>
            </details>
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
            {unidade && <Campo rotulo="Unidade">{unidade}</Campo>}
            <Campo rotulo="Exemplo real" id="exemplo">
              {prova ? (
                <AprendaProva prova={prova} volta={`verbete:${c.slug}`} />
              ) : sintetico ? (
                <div data-sintetico="true" className="border-2 border-dashed border-mineral bg-papel">
                  <p className="border-b border-dashed border-mineral px-4 py-2 text-sm">
                    <span className="rotulo mr-3 text-carvao">{ROTULO_SINTETICO}</span>
                    <span className="text-carvao-muted">{AVISO_SINTETICO}</span>
                  </p>
                  <p className="p-4">{sintetico}</p>
                </div>
              ) : (
                <p className="text-carvao-muted">Exemplo com dado integrado ainda não disponível para este conceito.</p>
              )}
            </Campo>
            {contrastes.length > 0 && (
              <Campo rotulo="Não confundir com" id="nao-confundir">
                <ul className="space-y-4">
                  {contrastes.map((x) => (
                    <li key={x.com}>
                      <p className="font-medium">
                        {x.href ? (
                          <Link href={x.href} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
                            {x.rotulo}
                          </Link>
                        ) : (
                          x.rotulo
                        )}
                      </p>
                      <p className="text-sm leading-relaxed">{x.texto}</p>
                    </li>
                  ))}
                </ul>
              </Campo>
            )}
          </>
        )}
        <Campo rotulo="Relações">
          <ul className="flex flex-wrap gap-2">
            {c.relacoes.map((r) => {
              const rc = conceito(r);
              return rc ? (
                <li key={r}>
                  <Link href={`/setor-eletrico/aprenda/${r}`} className="rotulo inline-flex min-h-[44px] items-center border border-linha px-3 text-carvao hover:border-energia">
                    {rc.sigla ?? rc.nome}
                  </Link>
                </li>
              ) : null;
            })}
          </ul>
        </Campo>
        {nasTrilhas.length > 0 && (
          <Campo rotulo="Nas trilhas">
            <ul className="space-y-1">
              {nasTrilhas.map(({ trilha: t, passo, ordem }) => (
                <li key={`${t.id}-${passo.id}`}>
                  <Link href={hrefPasso(t.id, passo.id)} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
                    {t.titulo}, passo {ordem}: {passo.titulo.toLowerCase()}
                  </Link>
                </li>
              ))}
            </ul>
          </Campo>
        )}
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
            {conferido && (
              <p className="mt-4 text-xs text-mineral">
                Documentos acessados e texto conferido em {dataBR(c.conferidoEm)}
                {c.revisadoEm && c.revisadoEm !== c.conferidoEm ? `; texto revisado em ${dataBR(c.revisadoEm)}` : ""}.
              </p>
            )}
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
