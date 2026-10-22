import Link from "next/link";
import type { ReactNode } from "react";
import { PublicHeaderView } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import { PageTitle } from "@/components/ui/SectionHeading";
import { constituicaoPublica, constituicaoPublicaEn } from "@/lib/governanca";
import { TEXTOS_GOVERNANCA } from "@/i18n/paginas/governanca";
import { hrefNoIdioma } from "@/lib/i18n-href";
import type { Idioma } from "@/lib/idioma";

/**
 * Constituição editorial publicada a partir de docs/CONSTITUICAO.md, com as
 * omissões declaradas em src/lib/governanca.ts; em inglês, da tradução de
 * cortesia docs/CONSTITUICAO.en.md.
 */
const code = "rounded-sm bg-marfim px-1 font-mono text-[0.85em] text-carvao";

/** Negrito e código em linha, os dois únicos realces que a Constituição usa. */
function emLinha(texto: string): ReactNode[] {
  return texto.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i} className="font-semibold text-carvao">{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`")) return <code key={i} className={code}>{p.slice(1, -1)}</code>;
    return p;
  });
}

export function GovernancaConteudo({ idioma }: { idioma: Idioma }) {
  const t = TEXTOS_GOVERNANCA[idioma];
  const h = (href: string) => hrefNoIdioma(href, idioma);
  const corpo = (idioma === "pt" ? constituicaoPublica() : constituicaoPublicaEn()).filter((b) => b.tipo !== "titulo");
  return (
    <div className="flex min-h-screen flex-col bg-papel">
      <PublicHeaderView idioma={idioma} />
      <main className="mx-auto w-full max-w-page flex-1 px-6 py-14">
        <nav aria-label={t.trilha} className="rotulo text-mineral">
          <Link href={h("/sobre")} className="hover:text-bronze">{t.sobre}</Link> / {t.titulo}
        </nav>
        <PageTitle
          label={t.rotulo}
          title={t.tituloPagina}
          description={t.descricao}
        />
        <p className="mt-4 max-w-prose2 text-sm text-mineral">{t.nota}</p>
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
          {t.vejaAntes} <Link href={`${h("/sobre")}#correcao`} className="text-bronze underline underline-offset-4">{t.politicaLink}</Link> {t.vejaMeio}{" "}
          <Link href={h("/sobre/erros")} className="text-bronze underline underline-offset-4">{t.registroLink}</Link>.
        </p>
      </main>
      <Footer idioma={idioma} />
    </div>
  );
}
