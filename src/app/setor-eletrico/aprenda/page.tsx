import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { CONCEITOS, GRUPOS } from "@/lib/energia/conteudo/conceitos";
import { TRILHAS_APRENDA } from "@/lib/energia/conteudo/trilhas";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Aprenda: base de conhecimento do setor elétrico",
  description:
    "PLD, CMO, EAR, ENA, tarifa, perdas, DEC e FEC, Tarifa Social, fator de emissão e outros conceitos, cada um com fonte oficial e data de conferência, unidade, exemplo real com a ficha Comprove, o que não confundir e trilhas que ligam os conceitos aos números.",
  alternates: { canonical: "/setor-eletrico/aprenda" },
};

/** Identificador de âncora do grupo: sem acento, espaço nem maiúscula. */
const idGrupo = (g: string) =>
  g
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");

export default function AprendaPage() {
  const conferidos = CONCEITOS.filter((c) => c.estado === "CONFERIDO").length;
  const comRessalva = CONCEITOS.filter((c) => c.estado === "CONFERIDO" && c.ressalva).length;
  return (
    <>
      <CabecalhoEnergia atual="aprenda" />
      <MarcaVisita secao="energia:aprenda" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6 pb-16">
        <CabecalhoModulo siglas={["MWmed", "DIC", "FIC", "CCEE", "ONS", "ANEEL"]} rotulo="Aprenda" titulo="Como funciona o sistema elétrico brasileiro, conceito a conceito">
          Cada verbete diz, em uma frase, o que é; por que importa; como é medido; um exemplo do sistema, ligado ao painel onde o número aparece; com o
          que não confundir; as relações com outros conceitos e a fonte oficial com a data de conferência. Quando se aplicam, trazem também a unidade e o
          que não se pode concluir.{" "}
          {conferidos === CONCEITOS.length
            ? `Os ${CONCEITOS.length} verbetes estão conferidos na fonte primária${comRessalva ? `; ${comRessalva} deles trazem uma ressalva declarada no próprio verbete, porque a fonte que define o termo não foi lida ou não o define` : ""}.`
            : `${conferidos} de ${CONCEITOS.length} verbetes estão conferidos na fonte primária; os demais aparecem como em preparação, sem definição, com o que já foi consultado e o que falta.`}
        </CabecalhoModulo>
        <section aria-labelledby="trilhas" className="border-t border-linha py-8">
          <h2 id="trilhas" className="rotulo text-mineral">
            Trilhas: dos conceitos aos números
          </h2>
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {TRILHAS_APRENDA.map((t) => (
              <li key={t.id}>
                <Link href={`/setor-eletrico/aprenda/trilhas/${t.id}`} className="flex h-full flex-col border border-energia bg-superficie p-5 transition-colors hover:bg-papel">
                  <span className="font-serif text-xl text-carvao">{t.titulo}</span>
                  <span className="mt-1 text-sm leading-relaxed text-carvao-muted">
                    {t.pergunta} {t.passos.length} passos, com o número de cada um no observatório e um exemplo sintético.
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <nav aria-label="Grupos de verbetes" className="border-t border-linha py-6">
          <p className="rotulo text-mineral">Ir para o grupo</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {GRUPOS.map((g) => (
              <li key={g}>
                <a href={`#g-${idGrupo(g)}`} className="rotulo inline-flex min-h-[44px] items-center border border-linha px-3 text-carvao hover:border-energia">
                  {g}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        {GRUPOS.map((g) => (
          <section key={g} aria-labelledby={`g-${idGrupo(g)}`} className="scroll-mt-4 border-t border-linha py-8">
            <h2 id={`g-${idGrupo(g)}`} className="rotulo text-mineral">{g}</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {CONCEITOS.filter((c) => c.grupo === g).map((c) => (
                <li key={c.slug}>
                  <Link href={`/setor-eletrico/aprenda/${c.slug}`} className="group flex h-full flex-col border border-linha bg-superficie p-5 transition-colors hover:border-energia">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="font-serif text-lg text-carvao">{c.sigla ?? c.nome}</span>
                      {c.estado === "PENDENTE" && <span className="rotulo !text-[0.62rem] text-aviso">em preparação</span>}
                      {c.estado === "CONFERIDO" && c.ressalva && <span className="rotulo !text-[0.62rem] text-aviso">com ressalva</span>}
                    </span>
                    {c.sigla && c.sigla.toLowerCase() !== c.nome.toLowerCase() && <span className="text-sm text-mineral">{c.nome}</span>}
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
