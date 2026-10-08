import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { conceito } from "@/lib/energia/conteudo/conceitos";
import { TRILHAS_APRENDA } from "@/lib/energia/conteudo/trilhas";

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
        <p className="mt-10 border-t border-linha pt-6 text-sm leading-relaxed text-carvao-muted">
          O tipo de cada ligação entre os passos (fluxo físico, decisão de operação, regra de mercado, componente de custo ou associação analítica) vem explicado na página de cada trilha, só com os tipos que ela usa. As mesmas ligações aparecem no{" "}
          <Link href="/setor-eletrico#mapa-conceitual" className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
            mapa conceitual do setor
          </Link>
          .
        </p>
      </main>
    </>
  );
}
