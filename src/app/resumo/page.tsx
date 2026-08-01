import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeaderView } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import { PageTitle } from "@/components/ui/SectionHeading";
import {
  fmtDelta,
  fmtRefMes,
  fmtValor,
  indicadoresPublicos,
  resumoDiario,
  type MudancaResumo,
} from "@/lib/dadosPublicos";

/**
 * Relatório diário com URL estável: o conteúdo muda a cada execução do
 * pipeline, o endereço nunca. Diagnóstico determinístico auditável (frase
 * montada por regras, nunca texto livre) + principais mudanças com fonte
 * e série citadas. Página citável por jornalistas e analistas.
 */
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Resumo diário do crédito",
  description:
    "O estado do mercado de crédito brasileiro em uma página: diagnóstico determinístico, principais mudanças do mês e números centrais com fonte oficial declarada. URL estável, conteúdo atualizado diariamente.",
  alternates: { canonical: "/resumo" },
};

function nbr(v: number, dec = 2) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function LinhaMudanca({ m, pior }: { m: MudancaResumo; pior: boolean }) {
  const pp = m.unidade === "%" || m.unidade === "p.p.";
  const mi = m.unidade === "R$ milhões";
  // valores monetários em R$ tri/bi; índices e taxas com 2 casas
  const val = (v: number) => (mi ? (v >= 1e6 ? `R$ ${nbr(v / 1e6)} tri` : `R$ ${nbr(v / 1e3, 1)} bi`) : nbr(v));
  const delta = mi
    ? `${m.delta1m > 0 ? "+" : "-"}R$ ${nbr(Math.abs(m.delta1m) / 1e3, 1)} bi`
    : `${m.delta1m > 0 ? "+" : ""}${nbr(m.delta1m)}${pp ? " p.p." : " pt"}`;
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-linha py-3 last:border-b-0">
      <span className="text-sm text-carvao">
        {m.indicador}
        <span className="ml-2 text-xs text-mineral">{m.fonte} {m.serie}</span>
      </span>
      <span className="text-sm">
        <span className="text-carvao-muted">{val(m.anterior)} → {val(m.atual)}</span>
        <span className={`ml-3 font-medium ${pior ? "text-erro" : "text-sucesso"}`}>{delta}</span>
      </span>
    </li>
  );
}

export default function ResumoPage() {
  const r = resumoDiario();
  const inds = indicadoresPublicos();
  if (!r) {
    return (
      <div className="flex min-h-screen flex-col bg-marfim">
        <PublicHeaderView />
        <main className="mx-auto w-full max-w-page flex-1 px-6 py-14">
          <PageTitle label="Resumo diário" title="Resumo indisponível" description="O diagnóstico do dia não pôde ser gerado. Os números-síntese seguem disponíveis em Dados abertos." />
          <Link href="/dados" className="rotulo mt-6 inline-flex text-bronze hover:underline">Ver dados abertos →</Link>
        </main>
        <Footer />
      </div>
    );
  }
  return (
    <div className="flex min-h-screen flex-col bg-marfim">
      <PublicHeaderView />
      <main className="mx-auto w-full max-w-page flex-1 px-6 py-14">
        <PageTitle
          label="Resumo diário"
          title="O crédito no Brasil hoje"
          description="Uma página, atualizada todos os dias no mesmo endereço, com o essencial do mercado de crédito: diagnóstico, principais mudanças e números centrais — sempre com fonte, série e referência declaradas."
        />
        <p className="rotulo mt-6 text-mineral">
          Processado em {r.geradoEm.slice(0, 16).replace("T", " ")} UTC · referência {fmtRefMes(r.refDiagnostico)} · confiança {r.confianca}
        </p>

        <section className="mt-10 border border-linha bg-papel p-8">
          <h2 className="rotulo text-mineral">Diagnóstico</h2>
          <p className="mt-4 max-w-3xl font-serif text-2xl leading-snug text-carvao md:text-3xl">{r.frase}</p>
          <p className="mt-4 text-xs leading-relaxed text-mineral">
            <span className="border border-linha px-1.5 py-0.5 uppercase tracking-wide">dado calculado</span>
            {" "}· IBCC {nbr(r.ibcc.atual, 1)} (percentil histórico {nbr(r.ibcc.percentil, 0)};
            {" "}{r.ibcc.delta1m != null ? `${r.ibcc.delta1m > 0 ? "+" : ""}${nbr(r.ibcc.delta1m)} pt no mês` : ""}
            {r.ibcc.delta12m != null ? `; ${r.ibcc.delta12m > 0 ? "+" : ""}${nbr(r.ibcc.delta12m)} pt em 12 meses` : ""}) · {r.metodo}
          </p>
        </section>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <section className="border border-linha bg-papel p-8">
            <h2 className="rotulo text-erro">Principais deteriorações do mês</h2>
            <ul className="mt-2">
              {r.deterioracoes.map((m) => <LinhaMudanca key={m.indicador} m={m} pior />)}
            </ul>
          </section>
          <section className="border border-linha bg-papel p-8">
            <h2 className="rotulo text-sucesso">Principais melhoras do mês</h2>
            <ul className="mt-2">
              {r.melhoras.map((m) => <LinhaMudanca key={m.indicador} m={m} pior={false} />)}
            </ul>
          </section>
        </div>

        <section className="mt-6 border border-linha bg-papel p-8">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="rotulo text-mineral">Números centrais</h2>
            <Link href="/dados" className="rotulo text-bronze hover:underline">todas as séries e métodos →</Link>
          </div>
          <div className="mt-6 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
            {inds.map((i) => (
              <Link key={i.slug} href={`/dados/${i.slug}`} className="group">
                <p className="rotulo text-mineral">{i.tituloCurto}</p>
                <p className="mt-1 font-serif text-2xl text-carvao group-hover:text-bronze">{fmtValor(i, i.valor)}</p>
                <p className="text-xs text-mineral">
                  {i.delta1m != null && i.delta1m !== 0 ? `${fmtDelta(i, i.delta1m)} no mês · ` : ""}ref. {fmtRefMes(i.ref)}
                </p>
              </Link>
            ))}
          </div>
          <p className="mt-6 text-xs text-mineral">
            Fonte: BCB/SGS (dados observados, sem estimativa ou interpolação) · classificação de mudanças
            pela direção econômica de cada indicador, normalizada pelo desvio histórico.
          </p>
        </section>

        <div className="mt-10 border border-linha bg-papel p-8">
          <h2 className="font-serif text-2xl text-carvao">A análise completa, todos os dias</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-carvao-muted">
            No Observatório este resumo vira análise: abertura por instituição, modalidade e estado,
            projeções com banda declarada, comparador de bancos e alertas com regra publicada.
            Gratuito; o cadastro é a única exigência.
          </p>
          <Link
            href="/cadastro"
            className="rotulo mt-5 inline-flex min-h-[44px] items-center border border-carvao px-5 text-carvao hover:bg-carvao hover:text-marfim"
          >
            Criar acesso gratuito
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
