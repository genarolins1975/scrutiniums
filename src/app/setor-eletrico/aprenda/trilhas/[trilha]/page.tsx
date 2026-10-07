import { LegendaDeSiglas } from "@/components/energia/CabecalhoModulo";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AprendaProva } from "@/components/energia/AprendaProva";
import { SimulacaoConta, SimulacaoLiquidacao } from "@/components/energia/AprendaSimulacao";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { conceito } from "@/lib/energia/conteudo/conceitos";
import { provaDoPasso } from "@/lib/energia/conteudo/provas";
import { TRILHAS_APRENDA, trilha as acharTrilha, type PassoTrilha } from "@/lib/energia/conteudo/trilhas";
import { TIPOS_LIGACAO, type TipoLigacao } from "@/lib/energia/mapa";

/**
 * P066, trilha do Aprenda: passos com verbetes conferidos, um número real com a ficha de
 * prova e o link ao painel (com ?volta= para o caminho de volta), a ligação tipificada com
 * o passo seguinte (a forma do traço muda com o tipo, como no mapa do setor), um exemplo
 * sintético rotulado e o que o percurso não permite concluir.
 */
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return TRILHAS_APRENDA.map((t) => ({ trilha: t.id }));
}

export function generateMetadata({ params }: { params: { trilha: string } }): Metadata {
  const t = acharTrilha(params.trilha);
  if (!t) return {};
  return {
    title: `${t.titulo} · Trilhas do Aprenda`,
    description: `${t.pergunta} ${t.resumo}`,
    alternates: { canonical: `/setor-eletrico/aprenda/trilhas/${t.id}` },
  };
}

function Traco({ tipo }: { tipo: TipoLigacao }) {
  return (
    <svg aria-hidden="true" width="14" height="100%" viewBox="0 0 14 100" preserveAspectRatio="none" className="h-full min-h-[4.5rem] shrink-0">
      <line x1="7" y1="0" x2="7" y2="100" stroke="var(--cor-energia)" strokeWidth="2" strokeDasharray={TIPOS_LIGACAO[tipo].traco || undefined} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Amostra({ tipo }: { tipo: TipoLigacao }) {
  return (
    <svg aria-hidden="true" width="44" height="10" viewBox="0 0 44 10" className="shrink-0">
      <line x1="0" y1="5" x2="44" y2="5" stroke="var(--cor-energia)" strokeWidth="2" strokeDasharray={TIPOS_LIGACAO[tipo].traco || undefined} />
    </svg>
  );
}

function Passo({ trilhaId, passo, ordem, total }: { trilhaId: string; passo: PassoTrilha; ordem: number; total: number }) {
  const prova = provaDoPasso(passo.prova);
  return (
    <li id={`passo-${passo.id}`} className="scroll-mt-4" data-passo={passo.id}>
      <article aria-labelledby={`t-${passo.id}`} className="border border-linha bg-superficie p-5 md:p-6">
        <p className="rotulo text-mineral">
          Passo {ordem} de {total}
        </p>
        <h2 id={`t-${passo.id}`} className="mt-1 font-serif text-2xl text-carvao">
          {passo.titulo}
        </h2>
        {passo.conceitos.length > 0 && (
          <ul aria-label="Verbetes deste passo" className="mt-3 flex flex-wrap gap-2">
            {passo.conceitos.map((s) => {
              const c = conceito(s);
              return c ? (
                <li key={s}>
                  <Link href={`/setor-eletrico/aprenda/${s}`} className="rotulo inline-flex min-h-[44px] items-center border border-linha px-3 text-carvao hover:border-energia">
                    {c.sigla ?? c.nome}
                  </Link>
                </li>
              ) : null;
            })}
          </ul>
        )}
        <p className="mt-4 max-w-prose2 leading-relaxed text-carvao">{passo.texto}</p>
        <div className="mt-4">
          <p className="rotulo mb-2 text-mineral">O número no observatório</p>
          <AprendaProva prova={prova} volta={`trilha:${trilhaId}:${passo.id}`} />
        </div>
      </article>
      {passo.ligacao && (
        <div className="flex gap-4 py-2 pl-6" data-ligacao={passo.ligacao.tipo}>
          <Traco tipo={passo.ligacao.tipo} />
          <p className="self-center py-3 text-sm leading-relaxed text-carvao-muted">
            <span className="rotulo mr-2 text-carvao">{TIPOS_LIGACAO[passo.ligacao.tipo].rotulo}</span>
            {passo.ligacao.texto}
          </p>
        </div>
      )}
    </li>
  );
}

export default function TrilhaPage({ params }: { params: { trilha: string } }) {
  const t = acharTrilha(params.trilha);
  if (!t) notFound();
  const tipos = Array.from(new Set(t.passos.flatMap((p) => (p.ligacao ? [p.ligacao.tipo] : []))));
  const outra = TRILHAS_APRENDA.find((x) => x.id !== t.id);
  return (
    <>
      <CabecalhoEnergia atual="aprenda" />
      <MarcaVisita secao="energia:aprenda:trilhas" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6 pb-16">
        <nav aria-label="Trilha de navegação" className="pt-8 text-sm text-mineral">
          <Link href="/setor-eletrico/aprenda" className="inline-flex min-h-[44px] items-center underline underline-offset-4">
            Aprenda
          </Link>{" "}
          ·{" "}
          <Link href="/setor-eletrico/aprenda/trilhas" className="inline-flex min-h-[44px] items-center underline underline-offset-4">
            Trilhas
          </Link>
        </nav>
        <header className="pb-6 pt-2">
          <p className="rotulo text-mineral">Trilha</p>
          <h1 className="mt-2 font-serif text-[clamp(2rem,4.4vw,3rem)] leading-tight text-carvao">{t.titulo}</h1>
          <p className="mt-3 max-w-prose2 font-serif text-xl leading-relaxed text-carvao">{t.pergunta}</p>
          <p className="mt-3 max-w-prose2 leading-relaxed text-carvao-muted">{t.resumo}</p>
          <LegendaDeSiglas
            siglas={params.trilha === "agua-operacao-preco" ? ["ENA", "EAR", "MWmed", "CMO", "PLD"] : ["CDE", "TUSD", "TE", "SIN", "BPC"]}
          />
        </header>

        <nav aria-label="Passos da trilha" className="border-y border-linha py-4">
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            {t.passos.map((p, i) => (
              <li key={p.id} className="flex items-center gap-2">
                <a href={`#passo-${p.id}`} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
                  {i + 1}. {p.titulo}
                </a>
                {i < t.passos.length - 1 && <span aria-hidden="true" className="text-mineral">→</span>}
              </li>
            ))}
          </ol>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-carvao-muted" aria-label="Tipos de ligação nesta trilha">
            {tipos.map((x) => (
              <span key={x} className="inline-flex items-center gap-2">
                <Amostra tipo={x} />
                <span>
                  <strong className="font-medium text-carvao">{TIPOS_LIGACAO[x].rotulo}</strong>: {TIPOS_LIGACAO[x].definicao}
                </span>
              </span>
            ))}
          </div>
        </nav>

        <ol className="mt-8 max-w-4xl" aria-label={`Passos: ${t.titulo}`}>
          {t.passos.map((p, i) => (
            <Passo key={p.id} trilhaId={t.id} passo={p} ordem={i + 1} total={t.passos.length} />
          ))}
        </ol>

        <section aria-labelledby="sintetico" className="mt-12 max-w-4xl">
          <h2 id="sintetico" className="rotulo mb-3 text-mineral">
            Experimente com valores hipotéticos
          </h2>
          {t.simulacao === "liquidacao" ? <SimulacaoLiquidacao /> : <SimulacaoConta />}
        </section>

        <section aria-labelledby="nao-conclua" className="mt-10 max-w-4xl border-l-2 border-energia pl-4">
          <h2 id="nao-conclua" className="rotulo text-mineral">
            O que esta trilha não permite concluir
          </h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-carvao">
            {t.naoConclua.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>

        <nav aria-label="Continuar" className="mt-10 flex flex-wrap gap-x-8 gap-y-2 border-t border-linha pt-6 text-sm">
          {outra && (
            <Link href={`/setor-eletrico/aprenda/trilhas/${outra.id}`} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
              Outra trilha: {outra.titulo}
            </Link>
          )}
          <Link href="/setor-eletrico/aprenda" className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
            Todos os verbetes
          </Link>
        </nav>
      </main>
    </>
  );
}
