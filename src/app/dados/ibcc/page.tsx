import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicHeaderView } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import { GraficoLinha } from "@/components/dados/GraficoSerie";
import { SeloFrescor } from "@/components/dados/SeloFrescor";
import { CitarIncorporar } from "@/components/dados/CitarIncorporar";
import { codigoIncorporar } from "@/lib/citacao";
import { fmtPercentil, fmtRefMes, fmtSinal, geradoEmPublicado } from "@/lib/dadosPublicos";
import { ROTULOS_COMPONENTES, REGRAS_NOTA, ibccPublico, notaMensalIbcc } from "@/lib/ibcc";
import { Trilha } from "@/components/layout/Trilha";

/**
 * Página estável do IBCC, o indicador bandeira do resumo: valor, percentil,
 * série, componentes, nota mensal por regras e metodologia. Endereço fixo, para
 * citação; o conteúdo muda a cada publicação.
 */
export const dynamic = "force-static";

const n1 = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function generateMetadata(): Metadata {
  const d = ibccPublico();
  const valor = d ? `${n1(d.atual.valor)} em ${fmtRefMes(d.atual.ref)}` : "indisponível";
  return {
    title: "IBCC: Índice Brasileiro de Condições de Crédito",
    description: `Índice de condições de crédito do Brasil, calculado sobre séries oficiais do Banco Central: ${valor}, com percentil histórico, componentes, nota mensal por regras e metodologia aberta.`,
    alternates: { canonical: "/dados/ibcc" },
  };
}

export default function IbccPage() {
  const d = ibccPublico();
  if (!d) notFound();
  const nota = notaMensalIbcc(d);
  const comps = Object.entries(d.atual.contribuicoes).map(([k, v]) => ({
    k,
    v,
    dm: d.anterior && typeof d.anterior.contribuicoes[k] === "number" ? v - d.anterior.contribuicoes[k] : null,
  }));
  return (
    <div className="flex min-h-screen flex-col bg-papel">
      <PublicHeaderView />
      <main className="mx-auto w-full max-w-page flex-1 px-6 py-14">
        <Trilha rota="/observatorio" extras={[{ titulo: "Dados abertos", href: "/dados" }, { titulo: "IBCC" }]} />
        <h1 className="mt-4 max-w-3xl font-serif text-3xl text-carvao md:text-4xl">Índice Brasileiro de Condições de Crédito (IBCC)</h1>
        <SeloFrescor geradoEm={geradoEmPublicado()} className="mt-4" />

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <section className="border border-linha bg-papel p-8">
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
              <p className="font-serif text-5xl text-carvao">{n1(d.atual.valor)}</p>
              <p className="text-sm text-carvao-muted">
                referência {fmtRefMes(d.atual.ref)} · percentil histórico {fmtPercentil(d.percentil)} · fase: {d.fase}
              </p>
            </div>
            <p className="mt-2 text-xs text-mineral">
              <span className="border border-linha px-1.5 py-0.5 uppercase tracking-wide">dado calculado</span>
              {" "}· sobre séries do BCB/SGS · base 100 = média histórica
            </p>
            <GraficoLinha serie={d.serie.map((p) => ({ ref: p.ref, v: p.valor }))} titulo="IBCC" fmt={n1} />
            <p className="mt-2 text-xs text-mineral">
              Série desde {fmtRefMes(d.serie[0].ref)} · {d.serie.length} observações mensais ·{" "}
              <a href="/obs/data/gold/ibcc.json" className="text-bronze underline underline-offset-4">dados em JSON</a>
            </p>
            <CitarIncorporar
              dados={{
                titulo: "Índice Brasileiro de Condições de Crédito (IBCC)",
                fonte: "Scrutiniums, calculado sobre séries do BCB/SGS e do IBGE",
                referencia: fmtRefMes(d.atual.ref),
                natureza: "dado calculado",
                processadoEm: geradoEmPublicado(),
                caminho: "/dados/ibcc",
              }}
              incorporar={codigoIncorporar("ibcc", "Índice Brasileiro de Condições de Crédito (IBCC)", "/dados/ibcc")}
            />
          </section>

          <aside className="border border-linha bg-papel p-8">
            <h2 className="rotulo text-mineral">Componentes em {fmtRefMes(d.atual.ref)}</h2>
            <table className="mt-4 w-full text-sm">
              <caption className="sr-only">Contribuição de cada componente ao IBCC, em pontos, e variação no mês</caption>
              <thead>
                <tr className="text-left text-xs text-mineral">
                  <th scope="col" className="pb-2 font-normal">Componente</th>
                  <th scope="col" className="pb-2 text-right font-normal">Pontos</th>
                  <th scope="col" className="pb-2 text-right font-normal">No mês</th>
                </tr>
              </thead>
              <tbody>
                {comps.map((c) => (
                  <tr key={c.k} className="border-t border-linha">
                    <th scope="row" className="py-2 text-left font-normal text-carvao-muted">{ROTULOS_COMPONENTES[c.k] ?? c.k}</th>
                    <td className="py-2 text-right tabular-nums text-carvao">{fmtSinal(c.v)}</td>
                    <td className="py-2 text-right tabular-nums text-carvao-muted">{c.dm == null ? "sem dado" : fmtSinal(c.dm, 2, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </aside>
        </div>

        <section aria-labelledby="nota" className="mt-6 border border-linha bg-papel p-8">
          <h2 id="nota" className="font-serif text-2xl text-carvao">{nota.titulo}</h2>
          <p className="mt-1 text-xs text-mineral">
            <span className="border border-linha px-1.5 py-0.5 uppercase tracking-wide">dado calculado</span>
            {" "}· frases montadas por regras determinísticas, não por texto livre
          </p>
          <div className="mt-4 max-w-3xl space-y-3 text-base leading-relaxed text-carvao">
            {nota.paragrafos.map((t) => <p key={t}>{t}</p>)}
          </div>
          <details className="mt-6 text-sm text-carvao-muted">
            <summary className="cursor-pointer rotulo text-mineral">Regras da nota</summary>
            <ol className="mt-3 list-decimal space-y-1 pl-5">
              {REGRAS_NOTA.map((r) => <li key={r}>{r}</li>)}
            </ol>
          </details>
        </section>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <section className="border border-linha bg-papel p-6">
            <h2 className="rotulo text-mineral">Metodologia</h2>
            <p className="mt-3 text-sm leading-relaxed text-carvao-muted">{d.metodo}</p>
            <p className="mt-3 text-sm leading-relaxed text-carvao-muted">
              Componentes e séries: {Object.values(ROTULOS_COMPONENTES).join(", ")}. Detalhe completo em{" "}
              <Link href="/observatorio/methodology" className="text-bronze underline underline-offset-4">metodologia e fontes</Link>.
            </p>
          </section>
          <section className="border border-linha bg-papel p-6">
            <h2 className="rotulo text-mineral">Limitações declaradas</h2>
            <p className="mt-3 text-sm leading-relaxed text-carvao-muted">{d.limitacoes}</p>
          </section>
        </div>

        <p className="mt-10 text-sm text-carvao-muted">
          O IBCC abre o <Link href="/resumo" className="text-bronze underline underline-offset-4">resumo do crédito</Link>, que também
          pode ser recebido por e-mail ou RSS.
        </p>
      </main>
      <Footer />
    </div>
  );
}
