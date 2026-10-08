import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { AbreDetalhesAoImprimir } from "@/components/energia/AbreDetalhesAoImprimir";
import { AprendaIndice, type GrupoIndice } from "@/components/energia/AprendaIndice";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { CONCEITOS, GRUPOS } from "@/lib/energia/conteudo/conceitos";
import { TRILHAS_APRENDA } from "@/lib/energia/conteudo/trilhas";
import { AVISO_SINTETICO, ROTULO_SINTETICO } from "@/lib/energia/sintetico";

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
  const grupos: GrupoIndice[] = GRUPOS.map((g) => ({
    id: `g-${idGrupo(g)}`,
    nome: g,
    itens: CONCEITOS.filter((c) => c.grupo === g).map((c) => ({
      slug: c.slug,
      titulo: c.sigla ?? c.nome,
      subtitulo: c.sigla && c.sigla.toLowerCase() !== c.nome.toLowerCase() ? c.nome : undefined,
      texto: c.estado === "CONFERIDO" ? (c.emPalavrasSimples ?? c.emUmaFrase ?? "") : `Fonte primária a conferir: ${c.fontePlanejada}`,
      selo: c.estado === "PENDENTE" ? ("em preparação" as const) : c.ressalva ? ("com ressalva" as const) : undefined,
    })),
  }));
  const conferidos = CONCEITOS.filter((c) => c.estado === "CONFERIDO").length;
  const comRessalva = CONCEITOS.filter((c) => c.estado === "CONFERIDO" && c.ressalva).length;
  return (
    <>
      <CabecalhoEnergia atual="aprenda" />
      <MarcaVisita secao="energia:aprenda" />
      <AbreDetalhesAoImprimir />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6 pb-16">
        <CabecalhoModulo recolher={false} rotulo="Aprenda" titulo="O que significam os conceitos e como se ligam aos números?">
          Os verbetes cobrem os conceitos que aparecem nos painéis deste observatório, não todo o vocabulário do setor. Comece por uma trilha, que liga os conceitos aos números, ou procure um termo.
        </CabecalhoModulo>
        <section aria-labelledby="trilhas" className="border-t border-linha py-8">
          <h2 id="trilhas" className="rotulo text-mineral">
            Trilhas: dos conceitos aos números
          </h2>
          <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
            Uma trilha é um percurso em ordem pelos verbetes: cada passo traz um número publicado pelo observatório e diz como ele se liga ao passo seguinte. No fim, há um {ROTULO_SINTETICO.toLowerCase()}. {AVISO_SINTETICO}
          </p>
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
        <section aria-labelledby="como-ler" className="border-t border-linha py-8">
          <h2 id="como-ler" className="rotulo text-mineral">
            Como ler um verbete
          </h2>
          <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
            Cada verbete diz, em uma frase, o que é; mostra um exemplo do sistema, ligado ao painel onde o número aparece; e explica por que importa e como é medido.
            Quando se aplicam, traz também a unidade, o que não confundir, as relações com outros conceitos, a fonte oficial com a data de conferência e o que não se pode concluir.{" "}
            {conferidos === CONCEITOS.length
              ? `Os ${CONCEITOS.length} verbetes estão conferidos na fonte primária${comRessalva ? `; ${comRessalva} deles trazem uma ressalva declarada no próprio verbete, porque a fonte que define o termo não foi lida ou não o define` : ""}.`
              : `${conferidos} de ${CONCEITOS.length} verbetes estão conferidos na fonte primária; os demais aparecem como em preparação, sem definição, com o que já foi consultado e o que falta.`}
          </p>
        </section>
        <AprendaIndice grupos={grupos} />
      </main>
    </>
  );
}
