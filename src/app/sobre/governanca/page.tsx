import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PublicHeaderView } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import { PageTitle } from "@/components/ui/SectionHeading";
import { constituicaoPublica } from "@/lib/governanca";

/**
 * Constituição editorial publicada a partir de docs/CONSTITUICAO.md, com as
 * omissões declaradas em src/lib/governanca.ts.
 */
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Governança editorial",
  description:
    "A Constituição editorial que rege as notas do Observatório Brasileiro de Crédito: origem dos números, classes de afirmação, temas vedados, revisão independente, erro e errata.",
  alternates: { canonical: "/sobre/governanca" },
};

const code = "rounded-sm bg-marfim px-1 font-mono text-[0.85em] text-carvao";

/** Negrito e código em linha, os dois únicos realces que a Constituição usa. */
function emLinha(texto: string): ReactNode[] {
  return texto.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i} className="font-semibold text-carvao">{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`")) return <code key={i} className={code}>{p.slice(1, -1)}</code>;
    return p;
  });
}

export default function GovernancaPage() {
  const corpo = constituicaoPublica().filter((b) => b.tipo !== "titulo");
  return (
    <div className="flex min-h-screen flex-col bg-marfim">
      <PublicHeaderView />
      <main className="mx-auto w-full max-w-page flex-1 px-6 py-14">
        <nav aria-label="Trilha" className="rotulo text-mineral">
          <Link href="/sobre" className="hover:text-bronze">Sobre</Link> / Governança editorial
        </nav>
        <PageTitle
          label="Institucional"
          title="Constituição editorial"
          description="Regras que valem para as notas do Observatório Brasileiro de Crédito, escritas por agentes e verificadas por código. Os números dos painéis vêm do pipeline, não das notas."
        />
        <p className="mt-4 max-w-prose2 text-sm text-mineral">
          Texto publicado a partir do arquivo em vigor no repositório. Única diferença em relação a ele: no Art. 5, os nomes das
          entidades em que o responsável ocupa cargos foram omitidos.
        </p>
        <div className="mt-10 max-w-prose2 space-y-4 text-carvao-muted">
          {corpo.map((b, i) => {
            if (b.tipo === "artigo") {
              return <h2 key={i} id={b.id} className="pt-6 font-serif text-2xl text-carvao">{b.texto}</h2>;
            }
            if (b.tipo === "lista") {
              const Tag = b.ordenada ? "ol" : "ul";
              return (
                <Tag key={i} className={`${b.ordenada ? "list-decimal" : "list-disc"} space-y-2 pl-5`}>
                  {b.itens.map((it, j) => <li key={j}>{emLinha(it)}</li>)}
                </Tag>
              );
            }
            if (b.tipo === "paragrafo") return <p key={i}>{emLinha(b.texto)}</p>;
            return null;
          })}
        </div>
        <p className="mt-12 max-w-prose2 text-sm text-mineral">
          Veja também a <Link href="/sobre#correcao" className="text-bronze underline underline-offset-4">política de correção</Link> e o{" "}
          <Link href="/sobre/erros" className="text-bronze underline underline-offset-4">registro público de erros</Link>.
        </p>
      </main>
      <Footer />
    </div>
  );
}
