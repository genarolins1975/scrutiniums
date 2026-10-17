import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import Link from "@/components/i18n/LinkIdioma";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { AprendaNavegacao, ROTA_TRILHAS } from "@/components/energia/AprendaPagina";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { conceito } from "@/lib/energia/conteudo/conceitos";
import { trilhasAprenda } from "@/lib/energia/conteudo/trilhas";
import { plural } from "@/lib/energia/formato";
import { tx } from "@/lib/energia/idioma";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/aprenda/trilhas", {
    title: tx("Trilhas do Aprenda: dos conceitos aos números", "Learning paths: from power sector concepts to the numbers"),
    description: tx(
      "Dois percursos que ligam conceitos a números publicados: água, operação e preço; custo, tarifa e orçamento. Cada passo traz o verbete, um número do observatório com o link ao painel (e a ficha Comprove, quando o painel a publica) e o tipo de ligação com o passo seguinte.",
      "Two learning paths that link Brazilian power sector concepts to published numbers: water, operation and price; cost, tariff and budget. Each step brings the entry, an observatory number with the link to the panel (and the Check this number record, when the panel publishes it) and the type of link to the next step.",
    ),
    alternates: { canonical: "/setor-eletrico/aprenda/trilhas" },
  }, anterior);
}

/**
 * Índice das trilhas: o que é uma trilha, o que cada uma traz por passo e a lista das trilhas, cada uma com a pergunta que responde e os
 * verbetes dos seus passos, na ordem. Página filha do Aprenda: leva a faixa das seções do módulo e a pergunta no título.
 */
export default function TrilhasPage() {
  const TRILHAS_APRENDA = trilhasAprenda();
  const passos = TRILHAS_APRENDA.reduce((n, t) => n + t.passos.length, 0);
  return (
    <>
      <CabecalhoEnergia atual="aprenda" />
      <MarcaVisita secao="energia:aprenda:trilhas" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina pb-16" data-tipo-pagina="trilhas">
        <AprendaNavegacao atual="trilhas" />
        <CabecalhoModulo recolher={false}
          rotulo={tx("Aprenda", "Learn")}
          titulo={tx("Como ligar conceitos aos números?", "How do concepts connect to the numbers?")}
          lead={tx(
            "Resposta curta: uma trilha é um percurso em ordem por verbetes conferidos, em que cada passo traz um número publicado pelo observatório e diz como ele se liga ao passo seguinte.",
            "Short answer: a learning path is an ordered route through checked entries, in which each step brings a number published by the observatory and says how it links to the next step.",
          )}
          recorte={tx(
            `${plural(TRILHAS_APRENDA.length, "trilha", "trilhas")} · ${plural(passos, "passo", "passos")}`,
            `${plural(TRILHAS_APRENDA.length, "learning path", "learning paths")} · ${plural(passos, "step", "steps")}`,
          )}
          fonte={tx("órgão, conjunto e data de cada número, na ficha do passo", "body, dataset and date of each number, in the step's record")}
        />
        <dl className="mt-4 grid gap-x-10 gap-y-3 border-y border-linha py-4 md:grid-cols-3" data-como-funciona="">
          <div>
            <dt className="rotulo text-mineral">{tx("Um número por passo", "One number per step")}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-carvao-muted">
              {tx("Cada passo tem o link ao painel e a ficha Comprove quando o painel a publica.", "Each step has the link to the panel and the Check this number record when the panel publishes it.")}
            </dd>
          </div>
          <div>
            <dt className="rotulo text-mineral">{tx("Volta ao passo", "Back to the step")}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-carvao-muted">
              {tx("Do painel, um botão traz o leitor de volta ao passo de onde ele veio.", "From the panel, a button brings the reader back to the step they came from.")}
            </dd>
          </div>
          <div>
            <dt className="rotulo text-mineral">{tx("Exemplo sintético", "Synthetic example")}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-carvao-muted">
              {tx("No fim, um exemplo sintético, com valores hipotéticos, mostra a conta que liga os conceitos.", "At the end, a synthetic example, with hypothetical values, shows the calculation that links the concepts.")}
            </dd>
          </div>
        </dl>
        <ul className="mt-8 grid gap-x-12 gap-y-10 md:grid-cols-2">
          {TRILHAS_APRENDA.map((t) => (
            <li key={t.id}>
              <article aria-labelledby={`trilha-${t.id}`} className="flex h-full flex-col">
                <p className="rotulo text-mineral">{tx(plural(t.passos.length, "passo", "passos"), plural(t.passos.length, "step", "steps"))}</p>
                <h2 id={`trilha-${t.id}`} className="ed-h2 mt-1 font-serif text-carvao">
                  <Link href={`${ROTA_TRILHAS}/${t.id}`} className="hover:text-energia-dark">
                    {t.titulo}
                  </Link>
                </h2>
                <p className="mt-2 max-w-prose2 leading-relaxed text-carvao">{t.pergunta}</p>
                <ol className="mt-3 space-y-0.5 text-sm leading-relaxed text-carvao-muted" aria-label={tx(`Passos de ${t.titulo}`, `Steps of ${t.titulo}`)}>
                  {t.passos.map((p, i) => {
                    const c = conceito(p.conceitos[0] ?? "");
                    return (
                      <li key={p.id}>
                        {i + 1}. {c ? (c.sigla && c.sigla.toLowerCase() !== c.nome.toLowerCase() ? `${c.sigla}, ${c.nome}` : c.nome) : p.titulo}
                      </li>
                    );
                  })}
                </ol>
                <Link
                  href={`${ROTA_TRILHAS}/${t.id}`}
                  className="mt-auto inline-flex min-h-[44px] items-center pt-2 text-sm text-energia-dark underline underline-offset-4 hover:text-carvao"
                >
                  {tx("Abrir a trilha", "Open the learning path")} <span className="sr-only">{t.titulo}</span>
                  <span aria-hidden="true" className="ml-1.5">
                    →
                  </span>
                </Link>
              </article>
            </li>
          ))}
        </ul>
        <p className="mt-10 max-w-prose2 border-t border-linha pt-6 text-sm leading-relaxed text-carvao-muted">
          {tx(
            "O tipo de cada ligação entre os passos (fluxo físico, decisão de operação, regra de mercado, componente de custo ou associação analítica) vem explicado na página de cada trilha, só com os tipos que ela usa. As mesmas ligações aparecem no",
            "The type of each link between the steps (physical flow, operating decision, market rule, cost component or analytical association) is explained on the page of each learning path, only with the types it uses. The same links appear in the",
          )}{" "}
          <Link href="/setor-eletrico#mapa-conceitual" className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
            {tx("mapa conceitual do setor", "concept map of the sector")}
          </Link>
          .
        </p>
      </main>
    </>
  );
}
