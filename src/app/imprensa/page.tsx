import type { Metadata } from "next";
import Link from "next/link";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import { BotaoLink } from "@/components/home/BotaoLink";
import { LINKEDIN_URL } from "@/lib/contato";

/**
 * Página para a imprensa: números citáveis dos dois painéis de maior
 * interesse público (bets e fraudes financeiras), cada um com fonte
 * primária, grau de evidência (A–E), data de referência e link para o
 * documento original — mais a instrução de citação.
 *
 * Estática por construção: os números vêm dos arquivos gold no momento do
 * build, que o pipeline diário reescreve. Nenhum número é literal no código;
 * quando a fonte publicar um dado novo, a curadoria atualiza o gold e esta
 * página muda junto.
 */
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Para a imprensa — números citáveis com fonte primária",
  description:
    "Bets e fraudes financeiras no Brasil em números verificáveis: cada dado com fonte primária, grau de evidência e data de referência, prontos para citação.",
  alternates: { canonical: "/imprensa" },
  openGraph: {
    title: "Scrutiniums para a imprensa",
    description:
      "Números citáveis sobre apostas online e fraudes financeiras, com fonte primária e grau de evidência declarados.",
    type: "website",
  },
};

/* eslint-disable @typescript-eslint/no-explicit-any -- leitura de gold JSON sem tipos gerados */
function lerGold(nome: string): any {
  try {
    return JSON.parse(
      readFileSync(join(process.cwd(), "public", "obs", "data", "gold", `${nome}.json`), "utf-8"),
    );
  } catch {
    return null;
  }
}

type ItemSintese = {
  id: string;
  rotulo: string;
  exibir: string;
  unidade: string;
  conceito: string;
  data_ref: string;
  nivel: string;
  fonte: string;
  url: string;
  nota?: string;
};

type Painel = {
  slug: string;
  titulo: string;
  subtitulo: string;
  rotaPainel: string;
  itens: ItemSintese[];
  niveis: Record<string, { rotulo: string; descricao: string }>;
  corte?: string;
};

function carregarPaineis(): Painel[] {
  const out: Painel[] = [];
  for (const [slug, rota] of [
    ["bets", "/observatorio/bets-financial-risk"],
    ["fraudes", "/observatorio/financial-fraud"],
  ] as const) {
    const g = lerGold(slug);
    if (!g?.sintese?.length) continue;
    out.push({
      slug,
      titulo: g.titulo,
      subtitulo: g.subtitulo,
      rotaPainel: rota,
      itens: g.sintese,
      niveis: g.niveis ?? {},
      corte: g.corte_pesquisa,
    });
  }
  return out;
}

export default function ImprensaPage() {
  const paineis = carregarPaineis();
  const niveis = paineis[0]?.niveis ?? {};

  return (
    <>
      <PublicHeader />
      <main>
        {/* ---------------- proposta ---------------- */}
        <section aria-labelledby="titulo" className="border-b border-linha bg-marfim">
          <div className="mx-auto max-w-page px-6 pb-16 pt-14 md:pb-20 md:pt-20">
            <p className="rotulo text-mineral">Para a imprensa</p>
            <h1
              id="titulo"
              className="mt-6 max-w-4xl font-serif text-[clamp(2rem,4.8vw,3.4rem)] leading-[1.09] tracking-[-0.015em] text-carvao"
            >
              Números citáveis, com a <span className="text-bronze">fonte primária</span> ao lado
            </h1>
            <p className="mt-7 max-w-prose2 text-base leading-relaxed text-carvao-muted md:text-lg">
              O debate sobre apostas online e fraudes financeiras está cheio de números sem
              origem. Os painéis abaixo reúnem o que as fontes primárias de fato publicaram —
              cada dado com o documento original, o grau de evidência e a data de referência.
              Todos os painéis do Observatório são abertos, sem cadastro.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-4">
              <BotaoLink href="/observatorio">Explorar o Observatório</BotaoLink>
              <Link
                href="/metodologia"
                className="rotulo inline-flex min-h-[44px] items-center text-carvao-muted underline decoration-linha underline-offset-8 transition-colors hover:text-bronze"
              >
                Metodologia completa
              </Link>
            </div>
          </div>
        </section>

        {/* ---------------- painéis com números citáveis ---------------- */}
        {paineis.map((p, idx) => (
          <section
            key={p.slug}
            aria-labelledby={`painel-${p.slug}`}
            className={`border-b border-linha ${idx % 2 === 0 ? "bg-papel" : "bg-marfim"}`}
          >
            <div className="mx-auto max-w-page px-6 py-16 md:py-20">
              <h2 id={`painel-${p.slug}`} className="font-serif text-3xl tracking-[-0.012em] text-carvao">
                {p.titulo}
              </h2>
              <p className="mt-4 max-w-prose2 text-sm leading-relaxed text-carvao-muted">{p.subtitulo}</p>
              <div className="mt-12 grid gap-x-10 gap-y-12 md:grid-cols-2">
                {p.itens.map((n) => (
                  <article key={n.id}>
                    <p className="font-serif text-[2rem] leading-none tracking-[-0.02em] text-carvao">
                      {n.exibir}
                    </p>
                    <h3 className="mt-3 text-sm font-medium text-carvao">{n.rotulo}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-carvao-muted">{n.conceito}</p>
                    <p className="rotulo mt-3 text-mineral">
                      nível {n.nivel}
                      {niveis[n.nivel] ? ` · ${niveis[n.nivel].rotulo.toLowerCase()}` : ""} · {n.data_ref}
                    </p>
                    <p className="mt-1 text-xs text-carvao-muted">
                      <a
                        href={n.url}
                        rel="noopener noreferrer"
                        target="_blank"
                        className="underline decoration-linha underline-offset-4 hover:text-bronze"
                      >
                        {n.fonte} — documento original
                      </a>
                    </p>
                  </article>
                ))}
              </div>
              <p className="mt-12">
                <Link
                  href={p.rotaPainel}
                  className="rotulo inline-flex min-h-[44px] items-center text-carvao underline decoration-linha underline-offset-8 transition-colors hover:text-bronze"
                >
                  Ver o painel completo, com séries e limitações →
                </Link>
              </p>
              {p.corte && (
                <p className="rotulo mt-4 text-mineral">
                  data de corte da curadoria: {p.corte} · números novos entram quando a fonte primária publica
                </p>
              )}
            </div>
          </section>
        ))}

        {/* ---------------- hierarquia de evidências ---------------- */}
        {Object.keys(niveis).length > 0 && (
          <section aria-labelledby="niveis" className="border-b border-linha bg-papel">
            <div className="mx-auto max-w-page px-6 py-16 md:py-20">
              <h2 id="niveis" className="font-serif text-3xl tracking-[-0.012em] text-carvao">
                O que significa o grau de evidência
              </h2>
              <p className="mt-4 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                Nem todo número publicado tem o mesmo peso. Cada dado dos painéis carrega um
                nível de A a E — e a recomendação editorial é simples: cite o nível junto com o
                número.
              </p>
              <dl className="mt-12 grid gap-x-10 gap-y-8 md:grid-cols-2">
                {Object.entries(niveis).map(([letra, n]) => (
                  <div key={letra}>
                    <dt className="font-serif text-lg text-carvao">
                      {letra} — {n.rotulo}
                    </dt>
                    <dd className="mt-2 text-sm leading-relaxed text-carvao-muted">{n.descricao}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>
        )}

        {/* ---------------- como citar e contato ---------------- */}
        <section aria-labelledby="citar" className="bg-marfim">
          <div className="mx-auto max-w-page px-6 py-16 md:py-20">
            <h2 id="citar" className="font-serif text-3xl tracking-[-0.012em] text-carvao">
              Como citar
            </h2>
            <p className="mt-6 max-w-prose2 text-base leading-relaxed text-carvao">
              «Observatório Brasileiro de Crédito / Scrutiniums (scrutiniums.com), a partir de
              [fonte primária]» — a fonte primária de cada número está declarada ao lado dele.
              O uso é livre e gratuito; pedimos apenas o link para o painel citado, para que o
              leitor encontre o contexto e as limitações do dado.
            </p>
            <p className="mt-8 text-sm text-carvao-muted">
              Dúvidas, checagens ou pedidos de dados:{" "}
              <a
                href={LINKEDIN_URL}
                rel="noopener noreferrer"
                target="_blank"
                className="underline decoration-linha underline-offset-4 hover:text-bronze"
              >
                contato via LinkedIn
              </a>
              .
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
