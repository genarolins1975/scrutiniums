import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeaderView } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import { PageTitle } from "@/components/ui/SectionHeading";
import { Sparkline } from "@/components/dados/GraficoSerie";
import { fmtDelta, fmtRefMes, fmtValor, indicadoresPublicos } from "@/lib/dadosPublicos";

/**
 * Camada pública: números-síntese do crédito com selo e fonte, congelados no
 * build (o pipeline diário commita o gold e redeploya). Sem JavaScript de
 * dados no cliente e sem exigência de cadastro: é a superfície citável.
 */
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Dados do crédito no Brasil",
  description:
    "Inadimplência, juros médios, spread bancário, saldo e concessões de crédito, endividamento e comprometimento de renda das famílias. Dados oficiais do Banco Central, atualizados diariamente, com fonte e série declaradas.",
  alternates: { canonical: "/dados" },
};

export default function DadosPage() {
  const inds = indicadoresPublicos();
  const refMax = inds.map((i) => i.ref).sort().at(-1);
  return (
    <div className="flex min-h-screen flex-col bg-marfim">
      <PublicHeaderView />
      <main className="mx-auto w-full max-w-page flex-1 px-6 py-14">
        <PageTitle
          label="Dados abertos"
          title="O crédito no Brasil em números"
          description="Os indicadores centrais do mercado de crédito, direto das séries oficiais do Banco Central. Cada número traz fonte, código da série e período de referência; nenhum é estimado ou interpolado."
        />
        <p className="rotulo mt-6 text-mineral">
          Referência mais recente: {refMax ? fmtRefMes(refMax) : "–"} · fonte: BCB/SGS · atualização diária
          · <Link href="/resumo" className="text-bronze underline underline-offset-4 hover:text-carvao">resumo diário</Link>
          · <Link href="/observatorio/methodology" className="text-bronze underline underline-offset-4 hover:text-carvao">metodologia</Link>
        </p>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {inds.map((i) => (
            <Link
              key={i.slug}
              href={`/dados/${i.slug}`}
              className="group border border-linha bg-papel p-6 transition-colors hover:border-bronze"
            >
              <p className="rotulo text-mineral">{i.tituloCurto}</p>
              <p className="mt-3 font-serif text-3xl text-carvao">{fmtValor(i, i.valor)}</p>
              <p className="mt-1 text-sm text-carvao-muted">
                {i.delta1m != null && i.delta1m !== 0 ? `${fmtDelta(i, i.delta1m)} vs. mês anterior` : "estável no mês"}
              </p>
              <Sparkline serie={i.serie} titulo={i.tituloCurto} />
              <p className="mt-3 text-xs text-mineral">
                <span className="border border-linha px-1.5 py-0.5 uppercase tracking-wide">dado observado</span>
                {" "}· {i.fonte} {i.serieCodigo} · ref. {fmtRefMes(i.ref)}
              </p>
              <p className="rotulo mt-4 text-bronze group-hover:underline">ver série e método →</p>
            </Link>
          ))}
        </div>

        <div className="mt-14 border border-linha bg-papel p-8">
          <h2 className="font-serif text-2xl text-carvao">A análise completa é gratuita</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-carvao-muted">
            O Observatório Brasileiro de Crédito abre estes números por instituição financeira, por
            modalidade e por estado: taxas de juros de cada banco em 20 modalidades, comparador de
            instituições, sinais antecedentes e alertas com regra publicada. O cadastro é a única exigência.
          </p>
          <div className="mt-5 flex flex-wrap gap-4">
            <Link
              href="/cadastro"
              className="rotulo inline-flex min-h-[44px] items-center border border-carvao px-5 text-carvao hover:bg-carvao hover:text-marfim"
            >
              Criar acesso gratuito
            </Link>
            <Link
              href="/observatorio/methodology"
              className="rotulo inline-flex min-h-[44px] items-center text-carvao-muted hover:text-bronze"
            >
              Como calculamos →
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
