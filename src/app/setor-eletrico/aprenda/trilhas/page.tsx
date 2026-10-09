import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { AprendaNavegacao, ROTA_TRILHAS } from "@/components/energia/AprendaPagina";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { conceito } from "@/lib/energia/conteudo/conceitos";
import { TRILHAS_APRENDA } from "@/lib/energia/conteudo/trilhas";
import { plural } from "@/lib/energia/formato";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Trilhas do Aprenda: dos conceitos aos números",
  description:
    "Dois percursos que ligam conceitos a números publicados: água, operação e preço; custo, tarifa e orçamento. Cada passo traz o verbete, um número do observatório com o link ao painel (e a ficha Comprove, quando o painel a publica) e o tipo de ligação com o passo seguinte.",
  alternates: { canonical: "/setor-eletrico/aprenda/trilhas" },
};

/**
 * Índice das trilhas: o que é uma trilha, o que cada uma traz por passo e a lista das trilhas, cada uma com a pergunta que responde e os
 * verbetes dos seus passos, na ordem. Página filha do Aprenda: leva a faixa das seções do módulo e a pergunta no título.
 */
export default function TrilhasPage() {
  const passos = TRILHAS_APRENDA.reduce((n, t) => n + t.passos.length, 0);
  return (
    <>
      <CabecalhoEnergia atual="aprenda" />
      <MarcaVisita secao="energia:aprenda:trilhas" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina pb-16" data-tipo-pagina="trilhas">
        <AprendaNavegacao atual="trilhas" />
        <CabecalhoModulo recolher={false}
          rotulo="Aprenda"
          titulo="Como ligar conceitos aos números?"
          lead="Resposta curta: uma trilha é um percurso em ordem por verbetes conferidos, em que cada passo traz um número publicado pelo observatório e diz como ele se liga ao passo seguinte."
          recorte={`${plural(TRILHAS_APRENDA.length, "trilha", "trilhas")} · ${plural(passos, "passo", "passos")}`}
          fonte="órgão, conjunto e data de cada número, na ficha do passo"
        />
        <dl className="mt-4 grid gap-x-10 gap-y-3 border-y border-linha py-4 md:grid-cols-3" data-como-funciona="">
          <div>
            <dt className="rotulo text-mineral">Um número por passo</dt>
            <dd className="mt-1 text-sm leading-relaxed text-carvao-muted">Cada passo tem o link ao painel e a ficha Comprove quando o painel a publica.</dd>
          </div>
          <div>
            <dt className="rotulo text-mineral">Volta ao passo</dt>
            <dd className="mt-1 text-sm leading-relaxed text-carvao-muted">Do painel, um botão traz o leitor de volta ao passo de onde ele veio.</dd>
          </div>
          <div>
            <dt className="rotulo text-mineral">Exemplo sintético</dt>
            <dd className="mt-1 text-sm leading-relaxed text-carvao-muted">No fim, um exemplo sintético, com valores hipotéticos, mostra a conta que liga os conceitos.</dd>
          </div>
        </dl>
        <ul className="mt-8 grid gap-x-12 gap-y-10 md:grid-cols-2">
          {TRILHAS_APRENDA.map((t) => (
            <li key={t.id}>
              <article aria-labelledby={`trilha-${t.id}`} className="flex h-full flex-col">
                <p className="rotulo text-mineral">{plural(t.passos.length, "passo", "passos")}</p>
                <h2 id={`trilha-${t.id}`} className="ed-h2 mt-1 font-serif text-carvao">
                  <Link href={`${ROTA_TRILHAS}/${t.id}`} className="hover:text-energia-dark">
                    {t.titulo}
                  </Link>
                </h2>
                <p className="mt-2 max-w-prose2 leading-relaxed text-carvao">{t.pergunta}</p>
                <ol className="mt-3 space-y-0.5 text-sm leading-relaxed text-carvao-muted" aria-label={`Passos de ${t.titulo}`}>
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
                  Abrir a trilha <span className="sr-only">{t.titulo}</span>
                  <span aria-hidden="true" className="ml-1.5">
                    →
                  </span>
                </Link>
              </article>
            </li>
          ))}
        </ul>
        <p className="mt-10 max-w-prose2 border-t border-linha pt-6 text-sm leading-relaxed text-carvao-muted">
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
