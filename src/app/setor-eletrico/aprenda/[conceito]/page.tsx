import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { LegendaDeSiglas } from "@/components/energia/CabecalhoModulo";
import { AprendaProva } from "@/components/energia/AprendaProva";
import { CONCEITOS, conceito, type FonteOficial } from "@/lib/energia/conteudo/conceitos";
import { EXEMPLO_SINTETICO, UNIDADE, contrastesDe } from "@/lib/energia/conteudo/complementos";
import { provaDoVerbete } from "@/lib/energia/conteudo/provas";
import { hrefPasso, passosComVerbete } from "@/lib/energia/conteudo/trilhas";
import { dataBR } from "@/lib/energia/formato";
import { siglasNoTexto } from "@/lib/energia/siglas";
import { AVISO_SINTETICO, ROTULO_SINTETICO } from "@/lib/energia/sintetico";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { AbreDetalhesAoImprimir } from "@/components/energia/AbreDetalhesAoImprimir";

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
      <h2 className="rotulo !text-[0.8rem] text-mineral">{rotulo}</h2>
      <div className="mt-2 max-w-prose2 leading-relaxed text-carvao md:mt-0">{children}</div>
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
  // o exemplo já leva ao painel (e a "Ver no painel" aparece nele): o mesmo destino não é oferecido de novo no fim da página
  const destinoDoExemplo = prova ? (prova.tipo === "evidencia" ? prova.dado.painel.href : prova.href) : null;
  const outrosPaineis = c.vejaNoPortal.filter((v) => v.href !== destinoDoExemplo);
  // siglas do texto principal (sem as da fonte citada, que o leitor abre se quiser) que o texto não expande
  const siglas = conferido
    ? siglasNoTexto(
        [c.emUmaFrase, c.porQueImporta, c.comoEMedidoResumo, c.comoEMedido, unidade, ...(c.limitacoes ?? []), ...(prova?.tipo === "evidencia" ? [prova.dado.evidencia.indicador, prova.dado.leitura, prova.dado.complemento ?? ""] : [])]
          .filter(Boolean)
          .join(" "),
        8,
      ).filter((x) => x !== c.sigla)
    : [];
  // o mesmo documento citado em mais de um trecho aparece uma só vez; cada trecho (e a sua leitura) fica embaixo dele
  const fontesAgrupadas = c.fontes.reduce<{ chave: string; orgao: string; documento: string; url: string; trechos: FonteOficial[] }[]>((acc, f) => {
    const chave = `${f.orgao}|${f.url}|${f.documento}`;
    const g = acc.find((x) => x.chave === chave);
    if (g) g.trechos.push(f);
    else acc.push({ chave, orgao: f.orgao, documento: f.documento, url: f.url, trechos: [f] });
    return acc;
  }, []);
  return (
    <>
      <CabecalhoEnergia atual="aprenda" />
      <MarcaVisita secao="energia:aprenda" />
      <AbreDetalhesAoImprimir />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6 pb-16">
        <nav aria-label="Localização" className="pt-8 text-sm text-mineral">
          <Link href="/setor-eletrico/aprenda" className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center underline underline-offset-4">Aprenda</Link> · {c.grupo}
        </nav>
        <header className="pb-6 pt-4">
          <h1 className="font-serif text-[clamp(2rem,4.4vw,3rem)] leading-tight text-carvao">
            {c.sigla && c.sigla.toLowerCase() !== c.nome.toLowerCase() ? (
              <>
                <span>{c.sigla}</span>
                <span className="text-carvao-muted">: {c.nome}</span>
              </>
            ) : (
              <span>{c.nome}</span>
            )}
          </h1>
          <p className="mt-3 flex flex-wrap items-center gap-3 text-sm text-mineral">
            {c.estado === "CONFERIDO" ? (
              <>
                <span className="rotulo text-sucesso">● conferido na fonte primária em {dataBR(c.conferidoEm)}</span>
                {c.revisadoEm && c.revisadoEm !== c.conferidoEm && <span className="rotulo">revisado em {dataBR(c.revisadoEm)}</span>}
                {c.ressalva && <span className="rotulo text-aviso" data-ressalva="true">◐ com ressalva: {c.ressalva}</span>}
              </>
            ) : (
              <span className="rotulo text-aviso">○ verbete em preparação</span>
            )}
          </p>
          <LegendaDeSiglas siglas={siglas} />
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
              {c.emPalavrasSimples ? (
                <>
                  <p className="rotulo text-mineral">Em palavras simples</p>
                  <p className="mt-1 font-serif text-xl leading-relaxed" data-palavras-simples="true">{c.emPalavrasSimples}</p>
                  <p className="rotulo mt-4 text-mineral">Texto da fonte</p>
                  <p className="mt-1 text-base leading-relaxed text-carvao-muted">{c.emUmaFrase}</p>
                </>
              ) : (
                <p className="font-serif text-xl leading-relaxed">{c.emUmaFrase}</p>
              )}
            </Campo>
            <Campo rotulo={sintetico ? "Exemplo sintético" : "Exemplo real"} id="exemplo">
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
            <Campo rotulo="Por que importa">{c.porQueImporta}</Campo>
            <Campo rotulo="Como é medido">
              {c.comoEMedidoResumo ? (
                <>
                  <p>{c.comoEMedidoResumo}</p>
                  <details className="mt-2">
                    <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-sm text-energia-dark underline underline-offset-4">Detalhe técnico: a norma, as fontes e o cálculo do observatório</summary>
                    <div className="mt-1 space-y-3 text-sm text-carvao-muted">
                      {c.comoEMedido?.split("\n\n").map((par) => <p key={par.slice(0, 40)}>{par}</p>)}
                    </div>
                  </details>
                </>
              ) : (
                c.comoEMedido?.split("\n\n").map((par) => <p key={par.slice(0, 40)} className="mb-3 last:mb-0">{par}</p>)
              )}
              {unidade && (
                <p className="mt-3 text-sm text-carvao-muted" data-unidade="true">
                  <span className="rotulo text-mineral">Unidade: </span>
                  {unidade}
                </p>
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
                          <span className="inline-flex min-h-[44px] items-center">{x.rotulo.charAt(0).toUpperCase() + x.rotulo.slice(1)}</span>
                        )}
                      </p>
                      <p className="text-base leading-relaxed">{x.texto}</p>
                    </li>
                  ))}
                </ul>
              </Campo>
            )}
          </>
        )}
        <Campo rotulo="Relações">
          <ul className={c.relacoesNotas ? "space-y-2" : "flex flex-wrap gap-2"}>
            {c.relacoes.map((r) => {
              const rc = conceito(r);
              const nota = c.relacoesNotas?.[r];
              return rc ? (
                <li key={r} className={nota ? "flex flex-wrap items-center gap-x-3 gap-y-1" : undefined}>
                  <Link href={`/setor-eletrico/aprenda/${r}`} className="inline-flex min-h-[44px] items-center gap-2 border border-linha px-3 text-carvao hover:border-energia">
                    <span className="rotulo">{rc.sigla ?? rc.nome}</span>
                    {rc.sigla && rc.sigla.toLowerCase() !== rc.nome.toLowerCase() && <span className="text-sm text-carvao-muted">{rc.nome}</span>}
                  </Link>
                  {nota && <span className="min-w-0 flex-1 basis-64 text-sm leading-relaxed text-carvao-muted">{nota}</span>}
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
              {fontesAgrupadas.map((g) => (
                <li key={g.chave}>
                  <p className="text-sm">
                    <strong className="font-medium">{g.orgao}</strong>
                    <a href={g.url} target="_blank" rel="noopener noreferrer" className="block py-3 leading-snug text-energia-dark underline underline-offset-4 [overflow-wrap:anywhere]">
                      {g.documento}&nbsp;<span aria-hidden="true">↗</span>
                    </a>
                  </p>
                  {g.trechos.map((f) => (
                    <div key={f.trecho ?? f.parafrase ?? g.chave}>
                      {f.parafrase && <p className="mt-2 pl-4 text-sm text-carvao">{f.parafrase}</p>}
                      {f.trecho && (
                        <details className="mt-1 pl-4 text-sm">
                          <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-energia-dark underline underline-offset-4">Trecho literal do documento</summary>
                          <blockquote className="border-l-2 border-linha pl-4 text-carvao-muted">“{f.trecho}”</blockquote>
                        </details>
                      )}
                    </div>
                  ))}
                </li>
              ))}
            </ul>
            {conferido && (
              <p className="mt-4 text-sm text-mineral">
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
        {c.detalheDaConferencia && c.detalheDaConferencia.length > 0 && (
          <Campo rotulo="Detalhe da conferência">
            <details>
              <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-sm text-energia-dark underline underline-offset-4">O que a conferência encontrou na fonte</summary>
              <ul className="mt-1 list-disc space-y-1.5 pl-5 text-sm text-carvao-muted">
                {c.detalheDaConferencia.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </details>
          </Campo>
        )}
        {outrosPaineis.length > 0 && (
          <Campo rotulo="Veja no painel">
            <ul className="space-y-1">
              {outrosPaineis.map((v) => (
                <li key={v.href}>
                  <Link href={v.href} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">{v.rotulo}</Link>
                </li>
              ))}
            </ul>
          </Campo>
        )}
      </main>
    </>
  );
}
