import Link from "next/link";
import type { ReactNode } from "react";
import type { FiguraDeIndicador } from "@/lib/varejo/dados";
import { dataBr, textoCurado } from "@/lib/varejo/formato";
import { NOME_CURTO_ATIVIDADE } from "@/lib/varejo/paginas";
import type { FonteCuradoria, SegmentoCuradoria } from "@/lib/varejo/tipos";
import { LINK } from "./comum";
import { BarrasRotuladas } from "./figuras/BarrasRotuladas";

const EQUIVALENCIA: Record<SegmentoCuradoria["equivalencia"], string> = {
  direta: "Equivalência direta com a pesquisa do IBGE",
  parcial: "Equivalência parcial com a pesquisa do IBGE",
  sem_equivalencia: "Sem atividade equivalente na pesquisa do IBGE",
};

const TIPO: Record<string, string> = { nacional: "rede nacional", regional: "rede regional", independentes: "lojas independentes" };

const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

function Fonte({ f }: Readonly<{ f: FonteCuradoria }>) {
  const titulo = texto(f.titulo) ?? texto(f.nome);
  if (!titulo) return null;
  const url = texto(f.url);
  const consulta = texto(f.consultado_em);
  return (
    <li>
      {url ? (
        <a href={url} rel="noopener noreferrer" target="_blank" className={LINK}>
          {titulo}
        </a>
      ) : (
        titulo
      )}
      {f.pagina ? `, ${/^\d/.test(String(f.pagina)) ? "página " : ""}${f.pagina}` : ""}
      {texto(f.periodo) ? `. Período: ${f.periodo}` : ""}
      {consulta ? `. Consultado em ${/^\d{4}-\d{2}-\d{2}/.test(consulta) ? dataBr(`${consulta.slice(0, 10)}T12:00:00Z`) : consulta}` : ""}.
    </li>
  );
}

/** Pictogramas da ficha: traço único de 1,5 px, na cor do texto, desenhados para o assunto (a compra, a loja, a procura, o preço). */
const PICTOGRAMA: Record<string, ReactNode> = {
  compra: (
    <>
      <path d="M3 4.5h2.4l2.1 10h10.2l2-7.2H6.6" />
      <circle cx="9.3" cy="18.6" r="1.3" />
      <circle cx="16.8" cy="18.6" r="1.3" />
    </>
  ),
  loja: (
    <>
      <path d="M4.2 10.2V20h15.6v-9.8" />
      <path d="M3 9.6 4.6 4h14.8L21 9.6a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0Z" />
      <path d="M10 20v-5.5h4V20" />
    </>
  ),
  procura: (
    <>
      <path d="M4 19.5h16" />
      <path d="m5 15 4-4 3.2 3 6-7" />
      <path d="M14.8 7h3.4v3.4" />
    </>
  ),
  preco: (
    <>
      <path d="M3.5 12.2V4.5h7.7l9.3 9.3-7.7 7.7-9.3-9.3Z" />
      <circle cx="7.8" cy="8.8" r="1.3" />
    </>
  ),
};

function Pictograma({ nome }: Readonly<{ nome: keyof typeof PICTOGRAMA }>) {
  return (
    <svg viewBox="0 0 24 24" width={28} height={28} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className="shrink-0 text-gas">
      {PICTOGRAMA[nome]}
    </svg>
  );
}

/** Posição do fim da primeira frase (o espaço depois do ponto); sem segunda frase, o comprimento do texto. */
function corteDaFrase(t: string): number {
  const corte = t.search(/(?<=[.!?])\s/);
  return corte > 0 ? corte : t.length;
}

/** A primeira frase em destaque e o resto em seguida: o texto é o da curadoria, inteiro; muda só a hierarquia. */
function EmDuasVozes({ texto: t }: Readonly<{ texto: string }>) {
  const corte = corteDaFrase(t);
  const primeira = t.slice(0, corte);
  const resto = t.slice(corte + 1);
  return (
    <>
      <span className="block text-base leading-snug text-carvao">{primeira}</span>
      {resto && <span className="mt-1.5 block text-sm leading-relaxed text-carvao-muted">{resto}</span>}
    </>
  );
}

const GLIFO: Record<SegmentoCuradoria["equivalencia"], string> = { direta: "bg-carvao", parcial: "bg-[linear-gradient(90deg,var(--cor-carvao)_50%,transparent_50%)]", sem_equivalencia: "" };

function FiguraDoIndicador({ f, titulo }: Readonly<{ f: FiguraDeIndicador; titulo: string }>) {
  const anos = Array.from(new Set(f.linhas.map((l) => l.periodo)));
  return (
    <figure data-figura-indicador="" className="min-w-0">
      <figcaption className="t-meta text-carvao-muted">
        {titulo}, {f.unidade}
        {anos.length === 1 ? `, ${anos[0]}` : ""}
      </figcaption>
      <div className="mt-2">
        <BarrasRotuladas
          titulo={`${titulo}, ${f.unidade}`}
          casas={f.casas}
          larguraDoNome="12rem"
          linhas={f.linhas.map((l) => ({ id: l.id, nome: l.nome, valor: l.valor, referencia: l.referencia, nota: [anos.length > 1 ? l.periodo : null, l.estimado ? "venda estimada pela fonte" : null].filter(Boolean).join(", ") || undefined }))}
        />
      </div>
      <p className="mt-2 text-xs leading-snug text-mineral">Fonte: {f.fonte}.</p>
    </figure>
  );
}

/**
 * A ficha de um segmento empresarial da curadoria (pipeline/varejo/curadoria/segmentos.json), em forma de ficha visual: a
 * equivalência com a pesquisa do IBGE dita antes de tudo; o que se vende como abertura; quem compra, por onde se vende, o que move a
 * procura e onde se forma a margem em quatro quadros com pictograma, a primeira frase em destaque; o indicador operacional com
 * figura, quando a fórmula da curadoria usa só o que as golds trazem (`indicadorDoSegmento`), e a taxa de margem da pesquisa anual
 * (`taxaDeMargemDoSegmento`); quem concorre, por alcance, com link para a ficha do grupo quando ela existe; e as fontes do texto.
 * O texto é o da curadoria, inteiro, escrito a partir de documentos públicos; campo que ela não preencheu não aparece.
 */
export function SegmentoCurado({ s, hrefDe, indicador = null, margem = null }: Readonly<{
  s: SegmentoCuradoria;
  /** Endereço da ficha do grupo (ou do comparador, para companhia aberta sem ficha) de um concorrente; null quando não há página. */
  hrefDe?: (slug: string | null | undefined) => string | null;
  /** O indicador operacional calculado e a taxa de margem do segmento na pesquisa anual; null quando não há dado estruturado. */
  indicador?: FiguraDeIndicador | null;
  margem?: FiguraDeIndicador | null;
}>) {
  const quadros: [keyof typeof PICTOGRAMA, string, string | null][] = [
    ["compra", "Quem compra", texto(s.quem_compra)],
    ["loja", "Por onde se vende", texto(s.canais)],
    ["procura", "O que move a procura", texto(s.o_que_determina_a_demanda)],
    ["preco", "Onde se forma a margem", texto(s.onde_se_forma_a_margem)],
  ];
  const concorrentes = (s.concorrentes ?? []).filter((c) => texto(c.nome));
  const porTipo = (["nacional", "regional", "independentes"] as const).map((t) => [t, concorrentes.filter((c) => c.tipo === t)] as const);
  const semTipo = concorrentes.filter((c) => !c.tipo || !TIPO[c.tipo]);
  const io = s.indicador_operacional;
  const atividades = (s.atividades_pmc ?? []).map((a) => NOME_CURTO_ATIVIDADE[a] ?? a);
  const vende = texto(s.o_que_se_vende);
  const mesmaFigura = indicador !== null && margem !== null && indicador.titulo === margem.titulo;
  const nomeConcorrente = (c: (typeof concorrentes)[number]) =>
    hrefDe?.(c.slug) ? (
      <Link href={hrefDe(c.slug)!} prefetch={false} className={LINK} data-concorrente-com-pagina={c.slug ?? ""}>
        {c.nome}
      </Link>
    ) : (
      c.nome
    );
  return (
    <article data-segmento-curado={s.slug} className="border-t-[3px] border-carvao pt-5">
      <header className="grid gap-x-12 gap-y-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <h3 className="t-h3 text-carvao">{s.nome}</h3>
        <div>
          <p className="t-meta flex items-start gap-2 text-carvao">
            <span aria-hidden="true" className={`mt-1 h-3 w-3 shrink-0 rounded-full border border-carvao ${GLIFO[s.equivalencia] ?? ""}`} />
            <span>
              <span className="font-medium">{EQUIVALENCIA[s.equivalencia] ?? "Equivalência não informada"}.</span>{" "}
              {atividades.length > 0 ? <>Atividades da pesquisa mensal ligadas a este segmento: {atividades.join("; ").toLowerCase()}.</> : <>A pesquisa mensal de comércio não mede este segmento.</>}
            </span>
          </p>
          {texto(s.nota_equivalencia) && (
            <details className="mt-1">
              <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-sm text-carvao-muted underline underline-offset-4 hover:text-carvao">Como o segmento corresponde à pesquisa do IBGE</summary>
              <p className="t-meta max-w-prose2 pb-2 text-carvao-muted">{s.nota_equivalencia}</p>
            </details>
          )}
        </div>
      </header>

      {vende && (
        <p className="mt-5 max-w-4xl" data-o-que-se-vende="">
          <span className="rotulo block text-mineral">O que se vende</span>
          <span className="mt-2 block font-serif text-xl leading-snug text-carvao">{vende.slice(0, corteDaFrase(vende))}</span>
          {corteDaFrase(vende) < vende.length && <span className="mt-2 block max-w-prose2 text-sm leading-relaxed text-carvao-muted">{vende.slice(corteDaFrase(vende) + 1)}</span>}
        </p>
      )}

      <ul className="mt-6 grid gap-px border border-linha bg-linha md:grid-cols-2">
        {quadros
          .filter(([, , v]) => v)
          .map(([icone, rotulo, v]) => (
            <li key={rotulo} className="flex gap-4 bg-papel p-4 sm:p-5">
              <Pictograma nome={icone} />
              <div className="min-w-0">
                <h4 className="rotulo text-mineral">{rotulo}</h4>
                <p className="mt-2">
                  <EmDuasVozes texto={v!} />
                </p>
              </div>
            </li>
          ))}
      </ul>

      {io && texto(io.nome) && (
        <section className="mt-8 grid gap-x-12 gap-y-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]" data-indicador-operacional="">
          <div>
            <h4 className="rotulo text-mineral">Indicador para acompanhar</h4>
            <p className="mt-2 font-serif text-xl leading-snug text-carvao">{io.nome}</p>
            {texto(io.por_que) && <p className="mt-2 text-sm leading-relaxed text-carvao">{io.por_que}</p>}
            {texto(io.formula) && <p className="t-meta mt-2 text-carvao-muted">Fórmula: {textoCurado(io.formula)}.</p>}
          </div>
          {indicador ? (
            <FiguraDoIndicador f={indicador} titulo={indicador.titulo} />
          ) : (
            <p className="t-meta self-center border-l border-linha pl-4 text-carvao-muted" data-indicador-sem-figura="">
              Esta publicação não traz os valores deste indicador em forma de série ou de tabela; as fontes do texto, abaixo, dizem onde cada empresa o divulga.
            </p>
          )}
        </section>
      )}

      {margem && !mesmaFigura && (
        <section className="mt-8 grid gap-x-12 gap-y-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]" data-margem-do-segmento="">
          <div>
            <h4 className="rotulo text-mineral">A margem na pesquisa anual</h4>
            <p className="mt-2 text-sm leading-relaxed text-carvao">
              Quanto o comércio acrescenta ao preço de compra da mercadoria, nos grupos da pesquisa anual do IBGE ligados a este segmento, ao lado do comércio varejista inteiro. Mede todas as empresas do grupo, grandes e pequenas.
            </p>
          </div>
          <FiguraDoIndicador f={margem} titulo={margem.titulo} />
        </section>
      )}

      {concorrentes.length > 0 && (
        <section className="mt-8">
          <h4 className="rotulo text-mineral">Quem concorre</h4>
          <div className="mt-3 grid gap-x-10 gap-y-4 md:grid-cols-3">
            {porTipo
              .filter(([, lista]) => lista.length > 0)
              .map(([t, lista]) => (
                <div key={t} className="border-t border-linha pt-2">
                  <p className="t-meta text-carvao-muted">{t === "nacional" ? "Redes nacionais" : t === "regional" ? "Redes regionais" : "Lojas independentes"}</p>
                  <ul className="mt-1 space-y-1 text-sm leading-snug text-carvao">
                    {lista.map((c) => (
                      <li key={c.nome}>{nomeConcorrente(c)}</li>
                    ))}
                  </ul>
                </div>
              ))}
            {semTipo.length > 0 && (
              <div className="border-t border-linha pt-2">
                <p className="t-meta text-carvao-muted">Outros</p>
                <ul className="mt-1 space-y-1 text-sm leading-snug text-carvao">
                  {semTipo.map((c) => (
                    <li key={c.nome}>{nomeConcorrente(c)}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}
      {(s.fontes ?? []).length > 0 && (
        <details className="mt-4">
          <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-carvao-muted underline underline-offset-4 hover:text-carvao">Fontes deste texto ({s.fontes!.length})</summary>
          <ul className="t-meta mt-1 max-w-prose2 list-disc space-y-1.5 pl-5 text-carvao-muted">
            {s.fontes!.map((f, i) => (
              <Fonte key={i} f={f} />
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}

/** Estado "em apuração": a curadoria do segmento ainda não chegou. Diz o que falta e o que continua utilizável. */
export function SegmentoEmApuracao({ atividade }: Readonly<{ atividade: string }>) {
  return (
    <p className="t-meta max-w-prose2 border-t border-linha pt-4 text-carvao-muted" data-segmento-em-apuracao="">
      A descrição do segmento empresarial ligado a {atividade.toLowerCase()} (o que se vende, quem compra, canais, margem e concorrentes) está em apuração e ainda não foi publicada. As séries do IBGE acima não dependem dela.
    </p>
  );
}
