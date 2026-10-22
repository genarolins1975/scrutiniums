import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { PublicHeaderView } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import { ListaResultados } from "@/components/busca/ListaResultados";
import { MedeBusca } from "@/components/busca/MedeBusca";
import { SeloComConta } from "@/components/acesso/SeloComConta";
import { buscar } from "@/lib/busca/buscar";
import { indiceDeBusca } from "@/lib/busca/indice";
import { EXEMPLO_DO_CAMPO } from "@/lib/busca/exemplos";
import { inventario } from "@/lib/observatorios/inventario";
import { prefetchDoLink } from "@/lib/rotasPublicas";
import { getSessionUser } from "@/lib/session";

/**
 * Busca da plataforma sem JavaScript e página de resultados (Iniciativa 3 do parecer de UX de 21/10/2026). Aberta, fora do
 * sitemap e não indexada: o formulário da barra envia para cá (GET /buscar?q=) e a página renderiza no servidor os mesmos
 * resultados do campo, com o selo "com conta" nos destinos fechados para quem não tem sessão. Sem termo, é o diretório das
 * 28 coleções. Mostra títulos, resumos e endereços, nunca dado de painel.
 */
export const metadata: Metadata = {
  title: "Buscar",
  description: "Busca nas coleções, páginas, perguntas, consultas e verbetes da Scrutiniums.",
  robots: { index: false, follow: true },
};

async function temSessao(): Promise<boolean> {
  if (!cookies().has("scrutiniums_session")) return false;
  try {
    return (await getSessionUser())?.onboardingStatus === "COMPLETE";
  } catch {
    return false;
  }
}

export default async function BuscarPage({ searchParams }: { searchParams: { q?: string | string[] } }) {
  const q = (Array.isArray(searchParams.q) ? searchParams.q[0] : searchParams.q ?? "").slice(0, 120).trim();
  const comSessao = await temSessao();
  const indice = indiceDeBusca();
  const resposta = q ? buscar(indice, q) : null;

  return (
    <div className="flex min-h-screen flex-col bg-papel">
      {/* a sessão já lida acima vale para o cabeçalho: uma consulta ao banco por página */}
      <PublicHeaderView authenticated={comSessao} />
      <main id="conteudo" className="mx-auto w-full max-w-page flex-1 px-4 py-10 sm:px-6 md:py-14">
        <h1 className="font-serif text-3xl leading-tight text-carvao md:text-4xl">{q ? <>Resultados para <q>{q}</q></> : "Buscar na Scrutiniums"}</h1>
        <form action="/buscar" method="get" role="search" className="mt-6 flex max-w-2xl border border-carvao bg-superficie">
          <label htmlFor="buscar-q" className="sr-only">
            Buscar na Scrutiniums
          </label>
          <input
            id="buscar-q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder={EXEMPLO_DO_CAMPO}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            className="min-h-[48px] min-w-0 flex-1 bg-transparent px-4 text-base text-carvao placeholder:text-mineral focus:outline-none"
          />
          <button type="submit" className="min-h-[48px] shrink-0 bg-carvao px-5 text-sm font-medium text-marfim hover:bg-carvao/90">
            Buscar
          </button>
        </form>

        {resposta ? (
          <section aria-live="polite" className="mt-8 max-w-3xl">
            <MedeBusca termo={q} />
            {resposta.resultados.length === 0 ? (
              <p className="text-base text-carvao">
                Nenhum resultado para <q>{q}</q>. Tente outra palavra, o nome de uma fonte (ONS, IBGE, ANP) ou{" "}
                <Link href="/buscar" className="underline decoration-linha underline-offset-4 hover:decoration-carvao">
                  veja as coleções
                </Link>
                .
              </p>
            ) : (
              <>
                <p className="mb-6 text-sm text-carvao-muted">
                  {resposta.cortado ? `Os ${resposta.resultados.length} primeiros resultados` : `${resposta.resultados.length} ${resposta.resultados.length === 1 ? "resultado" : "resultados"}`}
                  {!comSessao && " · os marcados com o cadeado pedem a conta gratuita"}
                </p>
                <ListaResultados grupos={resposta.grupos} comSessao={comSessao} />
              </>
            )}
          </section>
        ) : (
          <Diretorio comSessao={comSessao} />
        )}
      </main>
      <Footer />
    </div>
  );
}

/** Sem termo: as 28 coleções, por observatório, cada uma com as suas páginas (o diretório da área logada, sem o filtro). */
function Diretorio({ comSessao }: { comSessao: boolean }) {
  const obs = inventario();
  const link = "underline decoration-linha underline-offset-4 hover:decoration-carvao";
  return (
    <div className="mt-10 grid gap-x-10 gap-y-10 md:grid-cols-2 xl:grid-cols-3">
      {obs.map((o) => (
        <section key={o.id} aria-labelledby={`dir-${o.id}`} className="border-t-2 border-carvao pt-4">
          <h2 id={`dir-${o.id}`} className="font-serif text-2xl text-carvao">
            {o.nomeCurto}
          </h2>
          <p className="mt-1 text-sm text-carvao-muted">{o.pergunta}</p>
          <ul className="mt-4 space-y-4">
            {o.colecoes.map((c) => (
              <li key={c.id}>
                <Link href={c.href} prefetch={prefetchDoLink(c.href)} className={`inline-flex min-h-[44px] items-center text-base text-carvao ${link}`}>
                  {c.nome}
                  {!comSessao && <SeloComConta href={c.href} />}
                </Link>
                {c.paginas.length > 0 && (
                  <p className="text-sm leading-relaxed text-carvao-muted">
                    {c.paginas.map((p, i) => (
                      <span key={p.rota ?? p.titulo}>
                        {i > 0 && <span aria-hidden="true"> · </span>}
                        {p.rota ? (
                          <Link href={p.rota} prefetch={prefetchDoLink(p.rota)} className={link}>
                            {p.titulo}
                            {p.situacao === "parcial" && " (parcial)"}
                            {!comSessao && <SeloComConta href={p.rota} />}
                          </Link>
                        ) : (
                          <span className="text-mineral">{p.titulo} (ainda sem página)</span>
                        )}
                      </span>
                    ))}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
