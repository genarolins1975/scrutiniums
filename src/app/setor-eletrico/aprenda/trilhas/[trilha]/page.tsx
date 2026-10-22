import type { Metadata, ResolvingMetadata } from "next";
import { caminhoComParametros, metadadosEnergia } from "@/lib/energia/metadados-idioma";
import Link from "@/components/i18n/LinkIdioma";
import { notFound } from "next/navigation";
import { AprendaCabecalho, AprendaNavegacao, ROTA_APRENDA, ROTA_TRILHAS } from "@/components/energia/AprendaPagina";
import { AprendaProva } from "@/components/energia/AprendaProva";
import { SimulacaoConta, SimulacaoLiquidacao } from "@/components/energia/AprendaSimulacao";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { destinoNoPainel } from "@/lib/energia/conteudo/aprenda-indice";
import { conceito } from "@/lib/energia/conteudo/conceitos";
import { provaDoPasso } from "@/lib/energia/conteudo/provas";
import { TRILHAS_APRENDA, trilhasAprenda, trilha as acharTrilha, type PassoTrilha } from "@/lib/energia/conteudo/trilhas";
import { plural } from "@/lib/energia/formato";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { textoLigacao } from "@/lib/energia/i18n/aprenda";
import { TIPOS_LIGACAO, type TipoLigacao } from "@/lib/energia/mapa";

/**
 * P066, trilha do Aprenda: passos com verbetes conferidos, um número real com a ficha de
 * prova e o link ao painel (com ?volta= para o caminho de volta), a ligação tipificada com
 * o passo seguinte (a forma do traço muda com o tipo, como no mapa do setor), um exemplo
 * sintético rotulado e o que o percurso não permite concluir.
 *
 * Página filha do Aprenda: a faixa das seções do módulo no alto, a pergunta da trilha e a resposta curta na abertura, o percurso (os
 * passos em ordem, com os tipos de ligação) e depois cada passo, com o texto ao lado do número que o ilustra.
 */
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return TRILHAS_APRENDA.map((t) => ({ trilha: t.id }));
}

function metadadosDaPagina({ params }: { params: { trilha: string } }): Metadata {
  const t = acharTrilha(params.trilha);
  if (!t) return {};
  return {
    title: tx(`${t.titulo} · Trilhas do Aprenda`, `${t.titulo} · Learning paths`),
    description: `${t.pergunta} ${t.resumo}`,
    alternates: { canonical: `/setor-eletrico/aprenda/trilhas/${t.id}` },
  };
}

export async function generateMetadata(props: { params: { trilha: string } }, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia(caminhoComParametros("/setor-eletrico/aprenda/trilhas/[trilha]", props.params), metadadosDaPagina(props), anterior);
}

function Traco({ tipo }: { tipo: TipoLigacao }) {
  return (
    <svg aria-hidden="true" width="14" height="100%" viewBox="0 0 14 100" preserveAspectRatio="none" className="h-full min-h-[3.25rem] shrink-0">
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

/** Um passo: à esquerda o que ele ensina (título, verbetes, texto); à direita o número publicado que o ilustra, com a ficha e o link ao painel. */
function Passo({ trilhaId, passo, ordem, total, defineTipo }: { trilhaId: string; passo: PassoTrilha; ordem: number; total: number; defineTipo: boolean }) {
  const prova = provaDoPasso(passo.prova);
  const nota = passo.nota?.(prova) ?? null;
  // sem número publicado, o passo ainda leva ao painel de origem
  const verbeteDoPasso = passo.prova.tipo === "verbete" ? conceito(passo.prova.slug) : undefined;
  const alternativa = passo.prova.tipo === "evidencia" ? passo.prova.painel : verbeteDoPasso ? destinoNoPainel(verbeteDoPasso) : null;
  const ligacao = passo.ligacao ? textoLigacao(passo.ligacao.tipo, idiomaEnergia()) : null;
  return (
    <li id={`passo-${passo.id}`} className="scroll-mt-6" data-passo={passo.id}>
      <article aria-labelledby={`t-${passo.id}`} className="border-t border-linha py-6 md:grid md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-x-10">
        <div>
          <p className="rotulo text-mineral">{tx(`Passo ${ordem} de ${total}`, `Step ${ordem} of ${total}`)}</p>
          <h2 id={`t-${passo.id}`} className="ed-h2 mt-1 font-serif text-carvao">
            {passo.titulo}
          </h2>
          {passo.conceitos.length > 0 && (
            <ul aria-label={tx("Verbetes deste passo", "Entries in this step")} className="mt-3 flex flex-wrap gap-2">
              {passo.conceitos.map((s) => {
                const c = conceito(s);
                return c ? (
                  <li key={s}>
                    <Link href={`${ROTA_APRENDA}/${s}`} className="inline-flex min-h-[44px] items-center gap-2 border border-linha px-3 text-carvao hover:border-energia">
                      <span className={c.sigla ? "rotulo" : "text-sm"}>{c.sigla ?? c.nome}</span>
                      {c.sigla && c.sigla.toLowerCase() !== c.nome.toLowerCase() && <span className="text-sm text-carvao-muted">{c.nome}</span>}
                    </Link>
                  </li>
                ) : null;
              })}
            </ul>
          )}
          <p className="mt-4 max-w-prose2 leading-relaxed text-carvao">{passo.texto}</p>
        </div>
        <div className="mt-5 min-w-0 md:mt-0">
          <p className="rotulo mb-2 text-mineral">{tx("O número no observatório", "The number in the observatory")}</p>
          <AprendaProva prova={prova} volta={`trilha:${trilhaId}:${passo.id}`} alternativa={alternativa} />
          {nota && (
            <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao" data-nota-passo={passo.id}>
              {nota}
            </p>
          )}
        </div>
      </article>
      {passo.ligacao && (
        <div className="flex gap-4 py-1 pl-6" data-ligacao={passo.ligacao.tipo}>
          <Traco tipo={passo.ligacao.tipo} />
          <div className="self-center py-2 text-sm leading-relaxed text-carvao-muted">
            <p>
              <span className="rotulo mr-2 text-carvao">{ligacao?.rotulo}</span>
              {passo.ligacao.texto}
            </p>
            {/* o tipo de ligação é definido onde aparece pela primeira vez, ao lado do traço que o representa */}
            {defineTipo && (
              <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs" data-tipo-ligacao={passo.ligacao.tipo}>
                <Amostra tipo={passo.ligacao.tipo} />
                <span>
                  <strong className="font-medium text-carvao">{ligacao?.rotulo}</strong>: {ligacao?.definicao}
                </span>
              </p>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

export default function TrilhaPage({ params }: { params: { trilha: string } }) {
  const t = acharTrilha(params.trilha);
  if (!t) notFound();
  // o passo cuja ligação é a primeira de um tipo define o tipo; as seguintes só o nomeiam
  const vistos = new Set<TipoLigacao>();
  const definem = new Set<string>();
  for (const p of t.passos) {
    if (p.ligacao && !vistos.has(p.ligacao.tipo)) {
      vistos.add(p.ligacao.tipo);
      definem.add(p.id);
    }
  }
  const outra = trilhasAprenda().find((x) => x.id !== t.id);
  const verbetes = new Set(t.passos.flatMap((p) => p.conceitos)).size;
  // o exemplo sintético fica logo depois do passo que ele explica; os passos seguintes continuam a numeração
  const idxSimulacao = Math.max(0, t.passos.findIndex((p) => p.id === t.simulacaoApos));
  const antes = t.passos.slice(0, idxSimulacao + 1);
  const depois = t.passos.slice(idxSimulacao + 1);
  return (
    <>
      <header><CabecalhoPlataforma colecao="energia" destinoConta="/setor-eletrico" navegacao="setor-eletrico" idiomas /></header>
      <MarcaVisita secao="energia:aprenda:trilhas" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina pb-16" data-tipo-pagina="trilha">
        <AprendaNavegacao atual="trilhas" neta />
        <AprendaCabecalho
          rotulo={tx("Trilha", "Learning path")}
          titulo={t.titulo}
          lead={t.pergunta}
          contexto={
            <>
              <span>
                {tx(
                  `${plural(t.passos.length, "passo", "passos")} · ${plural(verbetes, "verbete", "verbetes")} · órgão, conjunto e data de cada número na ficha do passo`,
                  `${plural(t.passos.length, "step", "steps")} · ${plural(verbetes, "entry", "entries")} · body, dataset and date of each number in the step's record`,
                )}
              </span>
            </>
          }
          siglas={params.trilha === "agua-operacao-preco" ? ["ENA", "EAR", "MWmed", "CMO", "PLD"] : ["CDE", "TUSD", "TE", "SIN", "BPC"]}
        />
        <p className="mt-4 max-w-prose2 leading-relaxed text-carvao" data-resposta-curta="">
          {t.resumo}
        </p>

        <nav aria-label={tx("Passos da trilha", "Steps of the learning path")} className="mt-6 border-y border-linha py-1" data-percurso="">
          <ol className="flex flex-wrap items-center gap-x-1 text-sm sm:gap-x-2">
            {t.passos.map((p, i) => (
              <li key={p.id} className="flex items-center gap-1 sm:gap-2">
                {/* no celular o passo é só o número (o título está logo abaixo); o nome acessível traz sempre "n. título" */}
                <a
                  href={`#passo-${p.id}`}
                  className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 max-sm:min-w-[44px] max-sm:justify-center max-sm:border max-sm:border-linha max-sm:no-underline"
                >
                  <span>{i + 1}</span>
                  <span className="max-sm:sr-only">. {p.titulo}</span>
                </a>
                {i < t.passos.length - 1 && (
                  <span aria-hidden="true" className="hidden text-mineral sm:inline">
                    →
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>

        <ol className="mt-4" aria-label={tx(`Passos 1 a ${idxSimulacao + 1}: ${t.titulo}`, `Steps 1 to ${idxSimulacao + 1}: ${t.titulo}`)}>
          {antes.map((p, i) => (
            <Passo key={p.id} trilhaId={t.id} passo={p} ordem={i + 1} total={t.passos.length} defineTipo={definem.has(p.id)} />
          ))}
        </ol>

        <section aria-labelledby="sintetico" className="my-8" data-simulacao-apos={t.simulacaoApos}>
          <h2 id="sintetico" className="ed-h2 font-serif text-carvao">
            {tx("Experimente com valores hipotéticos", "Try it with hypothetical values")}
          </h2>
          <div className="mt-3">{t.simulacao === "liquidacao" ? <SimulacaoLiquidacao /> : <SimulacaoConta />}</div>
        </section>

        {depois.length > 0 && (
          <ol start={idxSimulacao + 2} aria-label={tx(`Passos ${idxSimulacao + 2} a ${t.passos.length}: ${t.titulo}`, `Steps ${idxSimulacao + 2} to ${t.passos.length}: ${t.titulo}`)}>
            {depois.map((p, i) => (
              <Passo key={p.id} trilhaId={t.id} passo={p} ordem={idxSimulacao + 2 + i} total={t.passos.length} defineTipo={definem.has(p.id)} />
            ))}
          </ol>
        )}

        <section aria-labelledby="nao-conclua" className="mt-10 max-w-4xl border-l-2 border-energia pl-4">
          <h2 id="nao-conclua" className="ed-h2 font-serif text-carvao">
            {tx("O que esta trilha não permite concluir", "What this learning path does not allow you to conclude")}
          </h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-carvao">
            {t.naoConclua.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>

        <nav aria-label={tx("Continuar", "Continue")} className="mt-10 flex flex-wrap gap-x-8 gap-y-0 border-t border-linha pt-2 text-sm">
          {outra && (
            <Link href={`${ROTA_TRILHAS}/${outra.id}`} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
              {tx("Outra trilha:", "Another learning path:")} {outra.titulo}
            </Link>
          )}
          <Link href={ROTA_TRILHAS} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
            {tx("Todas as trilhas", "All learning paths")}
          </Link>
          <Link href={ROTA_APRENDA} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
            {tx("Todos os verbetes", "All entries")}
          </Link>
        </nav>
      </main>
    </>
  );
}
