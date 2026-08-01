import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicHeaderView } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import { GraficoLinha } from "@/components/dados/GraficoSerie";
import {
  INDICADORES,
  fmtDelta,
  fmtRefMes,
  fmtValor,
  indicadorPorSlug,
  indicadoresPublicos,
} from "@/lib/dadosPublicos";

/**
 * SEO programático: uma página pública por indicador, estática no build,
 * com valor atual no título (a consulta típica é "inadimplência hoje",
 * "spread bancário atual"). Dados idênticos aos da área logada, sem camada
 * extra de cálculo.
 */
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return INDICADORES.map((i) => ({ slug: i.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const i = indicadorPorSlug(params.slug);
  if (!i) return {};
  return {
    title: `${i.titulo}: ${fmtValor(i, i.valor)} (${fmtRefMes(i.ref)})`,
    description: `${i.definicao} Valor atual: ${fmtValor(i, i.valor)} na referência ${fmtRefMes(i.ref)}. Fonte: ${i.fonte}, série ${i.serieCodigo}, com metodologia e limitações declaradas.`,
    alternates: { canonical: `/dados/${i.slug}` },
  };
}

export default function IndicadorPage({ params }: { params: { slug: string } }) {
  const i = indicadorPorSlug(params.slug);
  if (!i) notFound();
  const outros = indicadoresPublicos().filter((o) => o.slug !== i.slug);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: i.titulo,
    description: i.definicao,
    url: `https://scrutiniums.com/dados/${i.slug}`,
    creator: { "@type": "Organization", name: "Banco Central do Brasil" },
    publisher: { "@type": "Organization", name: "Scrutiniums", url: "https://scrutiniums.com" },
    temporalCoverage: `${i.primeiraRef.slice(0, 7)}/${i.ref.slice(0, 7)}`,
    identifier: `BCB/SGS ${i.serieCodigo}`,
    isAccessibleForFree: true,
    license: "https://www.bcb.gov.br/acessoinformacao/dadosabertos",
  };
  const fmtEixo = (v: number) => fmtValor(i, v).replace(" a.a.", "");
  return (
    <div className="flex min-h-screen flex-col bg-marfim">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PublicHeaderView />
      <main className="mx-auto w-full max-w-page flex-1 px-6 py-14">
        <nav aria-label="Trilha" className="rotulo text-mineral">
          <Link href="/dados" className="hover:text-bronze">Dados abertos</Link> / {i.tituloCurto}
        </nav>
        <h1 className="mt-4 max-w-3xl font-serif text-3xl text-carvao md:text-4xl">{i.titulo}</h1>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <section className="border border-linha bg-papel p-8">
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
              <p className="font-serif text-5xl text-carvao">{fmtValor(i, i.valor)}</p>
              <p className="text-sm text-carvao-muted">
                referência {fmtRefMes(i.ref)}
                {i.delta1m != null ? ` · ${fmtDelta(i, i.delta1m)} no mês` : ""}
                {i.delta12m != null ? ` · ${fmtDelta(i, i.delta12m)} em 12 meses` : ""}
              </p>
            </div>
            <p className="mt-2 text-xs text-mineral">
              <span className="border border-linha px-1.5 py-0.5 uppercase tracking-wide">dado observado</span>
              {" "}· {i.fonte} série {i.serieCodigo} · sem estimativa ou interpolação
            </p>
            <GraficoLinha serie={i.serie} titulo={i.titulo} fmt={fmtEixo} />
            <p className="mt-2 text-xs text-mineral">
              Série desde {fmtRefMes(i.primeiraRef)} · {i.nObs} observações mensais · gráfico limitado aos últimos 12 anos
            </p>
          </section>

          <aside className="border border-linha bg-papel p-8">
            <h2 className="rotulo text-mineral">Fonte e método</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div><dt className="rotulo text-mineral">Fonte</dt><dd className="mt-0.5 text-carvao-muted">{i.fonte} — série {i.serieCodigo}</dd></div>
              <div><dt className="rotulo text-mineral">Conjunto</dt><dd className="mt-0.5 text-carvao-muted">{i.metodologia}</dd></div>
              <div><dt className="rotulo text-mineral">Unidade</dt><dd className="mt-0.5 text-carvao-muted">{i.unidade}</dd></div>
              <div><dt className="rotulo text-mineral">Frequência</dt><dd className="mt-0.5 text-carvao-muted">{i.frequencia}</dd></div>
              <div><dt className="rotulo text-mineral">Cobertura</dt><dd className="mt-0.5 text-carvao-muted">{fmtRefMes(i.primeiraRef)} a {fmtRefMes(i.ref)}</dd></div>
            </dl>
            <p className="mt-5 text-xs leading-relaxed text-mineral">
              Republicado dos dados abertos do Banco Central com atribuição; a defasagem de divulgação
              é da própria fonte.
            </p>
          </aside>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <section className="border border-linha bg-papel p-6">
            <h2 className="rotulo text-mineral">O que mede</h2>
            <p className="mt-3 text-sm leading-relaxed text-carvao-muted">{i.definicao}</p>
          </section>
          <section className="border border-linha bg-papel p-6">
            <h2 className="rotulo text-mineral">Como interpretar</h2>
            <p className="mt-3 text-sm leading-relaxed text-carvao-muted">{i.comoLer}</p>
          </section>
          <section className="border border-linha bg-papel p-6">
            <h2 className="rotulo text-mineral">Limitações declaradas</h2>
            <p className="mt-3 text-sm leading-relaxed text-carvao-muted">{i.limitacoes}</p>
          </section>
        </div>

        <div className="mt-10 border border-linha bg-papel p-8">
          <h2 className="font-serif text-2xl text-carvao">Vá além do número agregado</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-carvao-muted">
            No Observatório, este indicador abre por segmento, por modalidade, por instituição
            financeira e por estado, com projeções, sinais antecedentes e alertas de regra publicada.
            Acesso gratuito; o cadastro é a única exigência.
          </p>
          <Link
            href="/cadastro"
            className="rotulo mt-5 inline-flex min-h-[44px] items-center border border-carvao px-5 text-carvao hover:bg-carvao hover:text-marfim"
          >
            Criar acesso gratuito
          </Link>
        </div>

        <nav aria-label="Outros indicadores" className="mt-10">
          <p className="rotulo text-mineral">Outros indicadores públicos</p>
          <div className="mt-3 flex flex-wrap gap-3">
            {outros.map((o) => (
              <Link
                key={o.slug}
                href={`/dados/${o.slug}`}
                className="rotulo inline-flex min-h-[40px] items-center border border-linha bg-papel px-4 text-carvao-muted hover:border-bronze hover:text-bronze"
              >
                {o.tituloCurto}: {fmtValor(o, o.valor)}
              </Link>
            ))}
          </div>
        </nav>
      </main>
      <Footer />
    </div>
  );
}
