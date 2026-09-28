import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { CONCEITOS, GRUPOS } from "@/lib/energia/conteudo/conceitos";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Aprenda: base de conhecimento do setor elétrico",
  description:
    "PLD, CMO, EAR, ENA, submercado, carga, intercâmbio, NEWAVE, DECOMP, DESSEM e outros conceitos, cada um com fonte oficial, como é medido, exemplo real e limitações.",
  alternates: { canonical: "/setor-eletrico/aprenda" },
};

export default function AprendaPage() {
  const conferidos = CONCEITOS.filter((c) => c.estado === "CONFERIDO").length;
  return (
    <>
      <CabecalhoEnergia atual="aprenda" />
      <MarcaVisita secao="energia:aprenda" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6 pb-16">
        <CabecalhoModulo rotulo="Aprenda" titulo="Como funciona o sistema elétrico brasileiro, conceito a conceito">
          Cada verbete diz, em uma frase, o que é; por que importa; como é medido; um exemplo real do sistema; as relações com outros conceitos; a
          fonte oficial; e o que não se pode concluir. {conferidos} de {CONCEITOS.length} verbetes estão conferidos na fonte primária; os demais
          aparecem como em preparação, sem definição, até a conferência.
        </CabecalhoModulo>
        {GRUPOS.map((g) => (
          <section key={g} aria-labelledby={`g-${g}`} className="border-t border-linha py-8">
            <h2 id={`g-${g}`} className="rotulo text-mineral">{g}</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {CONCEITOS.filter((c) => c.grupo === g).map((c) => (
                <li key={c.slug}>
                  <Link href={`/setor-eletrico/aprenda/${c.slug}`} className="group flex h-full flex-col border border-linha bg-superficie p-5 transition-colors hover:border-energia">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="font-serif text-lg text-carvao">{c.sigla ?? c.nome}</span>
                      {c.estado === "PENDENTE" && <span className="rotulo !text-[0.62rem] text-aviso">em preparação</span>}
                    </span>
                    {c.sigla && <span className="text-sm text-mineral">{c.nome}</span>}
                    <span className="mt-2 text-sm leading-relaxed text-carvao-muted">
                      {c.estado === "CONFERIDO" ? c.emUmaFrase : `Fonte primária a conferir: ${c.fontePlanejada}`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </>
  );
}
