import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { conceito } from "@/lib/energia/conteudo/conceitos";
import { TRILHAS_APRENDA } from "@/lib/energia/conteudo/trilhas";
import { TIPOS_LIGACAO } from "@/lib/energia/mapa";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Trilhas do Aprenda: dos conceitos aos números",
  description:
    "Dois percursos que ligam conceitos a números publicados: água, operação e preço; custo, tarifa e orçamento. Cada passo traz o verbete, um número do observatório com o link ao painel (e a ficha Comprove, quando o painel a publica) e o tipo de ligação com o passo seguinte.",
  alternates: { canonical: "/setor-eletrico/aprenda/trilhas" },
};

export default function TrilhasPage() {
  return (
    <>
      <CabecalhoEnergia atual="aprenda" />
      <MarcaVisita secao="energia:aprenda:trilhas" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6 pb-16">
        <nav aria-label="Trilha de navegação" className="pt-8 text-sm text-mineral">
          <Link href="/setor-eletrico/aprenda" className="inline-flex min-h-[44px] items-center underline underline-offset-4">
            Aprenda
          </Link>
        </nav>
        <CabecalhoModulo siglas={["ENA", "EAR", "CMO", "PLD", "TE", "TUSD"]} rotulo="Trilhas" titulo="Como ligar conceitos aos números?">
          Cada trilha percorre verbetes conferidos na ordem em que um afeta o outro. Em cada passo há um número publicado pelo observatório, com o link ao painel e a
          ficha Comprove quando o painel a publica, e o tipo da ligação com o passo seguinte. Do painel, um botão traz o leitor de volta ao passo. No fim, um exemplo sintético, com valores
          hipotéticos, mostra a conta que liga os conceitos.
        </CabecalhoModulo>
        <ul className="grid gap-4 md:grid-cols-2">
          {TRILHAS_APRENDA.map((t) => (
            <li key={t.id}>
              <Link href={`/setor-eletrico/aprenda/trilhas/${t.id}`} className="flex h-full flex-col border border-linha bg-superficie p-6 transition-colors hover:border-energia">
                <span className="font-serif text-2xl text-carvao">{t.titulo}</span>
                <span className="mt-2 leading-relaxed text-carvao">{t.pergunta}</span>
                <span className="mt-3 text-sm leading-relaxed text-carvao-muted">
                  {t.passos.length} passos:{" "}
                  {t.passos
                    .map((p) => p.conceitos.map((s) => conceito(s)?.sigla ?? conceito(s)?.nome).filter(Boolean)[0] ?? p.titulo.toLowerCase())
                    .join(" → ")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <section aria-labelledby="tipos" className="mt-10 border-t border-linha pt-6">
          <h2 id="tipos" className="rotulo text-mineral">
            Tipos de ligação
          </h2>
          <ul className="mt-3 grid gap-2 text-sm text-carvao-muted md:grid-cols-2">
            {(Object.keys(TIPOS_LIGACAO) as (keyof typeof TIPOS_LIGACAO)[]).map((x) => (
              <li key={x} className="flex items-center gap-3">
                <svg aria-hidden="true" width="44" height="10" viewBox="0 0 44 10" className="shrink-0">
                  <line x1="0" y1="5" x2="44" y2="5" stroke="var(--cor-energia)" strokeWidth="2" strokeDasharray={TIPOS_LIGACAO[x].traco || undefined} />
                </svg>
                <span>
                  <strong className="font-medium text-carvao">{TIPOS_LIGACAO[x].rotulo}</strong>: {TIPOS_LIGACAO[x].definicao}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-carvao-muted">
            As mesmas ligações aparecem no{" "}
            <Link href="/setor-eletrico#mapa-conceitual" className="text-energia-dark underline underline-offset-4">
              mapa conceitual do setor
            </Link>
            .
          </p>
        </section>
      </main>
    </>
  );
}
