import Link from "@/components/i18n/LinkIdioma";
import { Fragment, type ReactNode } from "react";
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { AprendaCabecalho, AprendaNavegacao, ROTA_APRENDA } from "@/components/energia/AprendaPagina";
import { AprendaProva } from "@/components/energia/AprendaProva";
import { destinoNoPainel } from "@/lib/energia/conteudo/aprenda-indice";
import { EXEMPLO_SINTETICO_IDIOMAS, UNIDADE_IDIOMAS, contrastesDe } from "@/lib/energia/conteudo/complementos";
import { conceito, type Conceito, type FonteOficial } from "@/lib/energia/conteudo/conceitos";
import { perguntaPratica } from "@/lib/energia/conteudo/perguntas-praticas";
import { provaDoVerbete } from "@/lib/energia/conteudo/provas";
import { hrefPasso, passosComVerbete } from "@/lib/energia/conteudo/trilhas";
import { dataBR } from "@/lib/energia/formato";
import { listaPorExtenso } from "@/lib/energia/navegacao";
import { siglasNoTexto } from "@/lib/energia/siglas";
import { AVISO_SINTETICO, ROTULO_SINTETICO } from "@/lib/energia/sintetico";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { rotuloGrupoConceito } from "@/lib/energia/i18n/aprenda";

/**
 * Texto do acervo com nome próprio português dentro da forma inglesa (título de página ou de conjunto da fonte, escrito entre « »):
 * o trecho vira <Nome> entre aspas, para o leitor de tela e o tradutor do navegador o lerem como português. A forma portuguesa do
 * acervo não usa « », e sai como está.
 */
export function comNomes(texto: string | null | undefined): ReactNode {
  if (!texto || !texto.includes("«")) return texto ?? null;
  return texto.split(/«([^»]+)»/).map((parte, i) =>
    i % 2 === 1 ? (
      <Fragment key={i}>
        “<Nome>{parte}</Nome>”
      </Fragment>
    ) : (
      parte
    ),
  );
}

/** "a, b e c" na página portuguesa; "a, b and c" na inglesa. */
function lista(itens: string[]): string {
  if (itens.length <= 1) return itens[0] ?? "";
  return tx(listaPorExtenso(itens), `${itens.slice(0, -1).join(", ")} and ${itens[itens.length - 1]}`);
}

/**
 * Um campo da ficha do verbete: o rótulo em caixa alta e o conteúdo logo abaixo. Em tela larga (1024 px em diante) o texto corre numa
 * coluna e o exemplo fica ao lado, na outra (a pergunta, a definição e o número à vista juntos); os campos seguintes se agrupam em pares
 * (o que não confundir e o que não concluir; as relações e os caminhos), e o que fica sozinho na linha ocupa a largura toda (`largo`).
 * Em tela estreita, e para quem navega por teclado ou leitor de tela, vale a ordem do documento: definição, exemplo, por que importa,
 * como é medido. `lugar` só posiciona o campo na grade e nunca troca essa ordem.
 */
function Campo({ rotulo, id, children, largo = false, lugar = "" }: { rotulo: string; id?: string; children: ReactNode; largo?: boolean; lugar?: string }) {
  return (
    <section id={id} className={`min-w-0 scroll-mt-6 border-t border-linha py-6 ${largo ? "lg:col-span-2" : ""} ${lugar}`}>
      <h2 className="rotulo text-mineral">{rotulo}</h2>
      <div className="mt-2 max-w-prose2 leading-relaxed text-carvao">{children}</div>
    </section>
  );
}

/**
 * A ficha de um verbete (a abertura, a definição, o exemplo e o resto), no `<main>` da página. Recebe o verbete inteiro, e não só o
 * endereço, para a mesma ficha poder ser desenhada em teste com um verbete em preparação ou sem pergunta escrita.
 */
export function AprendaVerbete({ c }: { c: Conceito }) {
  const idioma = idiomaEnergia();
  const conferido = c.estado === "CONFERIDO";
  const prova = conferido ? provaDoVerbete(c.slug) : null;
  const sintetico = conferido && !prova ? EXEMPLO_SINTETICO_IDIOMAS[idioma][c.slug] : undefined;
  const contrastes = conferido ? contrastesDe(c.slug) : [];
  const nasTrilhas = conferido ? passosComVerbete(c.slug) : [];
  const unidade = conferido ? UNIDADE_IDIOMAS[idioma][c.slug] : undefined;
  const pergunta = conferido ? perguntaPratica(c.slug) : null;
  // o exemplo já leva ao painel (e a "Ver no painel" aparece nele): o mesmo destino não é oferecido de novo no fim da página
  const destinoDoExemplo = prova ? (prova.tipo === "evidencia" ? prova.dado.painel.href : prova.href) : null;
  const outrosPaineis = c.vejaNoPortal.filter((v) => v.href !== destinoDoExemplo);
  const limitacoes = c.limitacoes ?? [];
  const relacoes = c.relacoes.filter((r) => conceito(r));
  // órgãos da fonte em forma curta para a linha de contexto: "MME, GT Modernização do Setor Elétrico (coordenação da CCEE)" vira MME, "MME e EPE" (ou "MME and EPE") vira dois
  const temMedida = !!(c.comoEMedido || c.comoEMedidoResumo || unidade);
  const orgaos = Array.from(new Set(c.fontes.flatMap((f) => f.orgao.replace(/\s*\(.*$/, "").split(",")[0].split(/\s+(?:e|and)\s+/).map((o) => o.trim()))));
  const comSigla = !!c.sigla && c.sigla.toLowerCase() !== c.nome.toLowerCase();
  // siglas do texto principal (sem as da fonte citada, que o leitor abre se quiser) que o texto não expande
  const siglas = conferido
    ? siglasNoTexto(
        [c.emUmaFrase, c.porQueImporta, c.comoEMedidoResumo, c.comoEMedido, unidade, ...limitacoes, ...(prova?.tipo === "evidencia" ? [prova.dado.evidencia.indicador, prova.dado.leitura, prova.dado.complemento ?? ""] : [])]
          .filter(Boolean)
          .join(" "),
        8,
      ).filter((x) => x !== c.sigla)
    : [];
  // o mesmo documento citado em mais de um trecho aparece uma só vez; cada trecho (e a sua leitura) fica embaixo dele
  const fontesAgrupadas = c.fontes.reduce<{ chave: string; orgao: string; documento: string; url: string; trechos: FonteOficial[] }[]>((acc, f) => {
    const chave = `${f.orgao}|${f.url}|${f.documento}`;
    const g = acc.find((x) => x.chave === chave);
    if (g) g.trechos.push(f);
    else acc.push({ chave, orgao: f.orgao, documento: f.documento, url: f.url, trechos: [f] });
    return acc;
  }, []);

  const campoContrastes = contrastes.length > 0 && (
    <Campo rotulo={tx("Não confundir com", "Not to be confused with")} id="nao-confundir" largo={limitacoes.length === 0}>
      <ul className="space-y-4">
        {contrastes.map((x) => (
          <li key={x.com}>
            <p className="font-medium">
              {x.href ? (
                <Link href={x.href} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
                  {x.rotulo}
                </Link>
              ) : (
                <span className="inline-flex min-h-[44px] items-center">{x.rotulo.charAt(0).toUpperCase() + x.rotulo.slice(1)}</span>
              )}
            </p>
            <p className="text-base leading-relaxed">{comNomes(x.texto)}</p>
          </li>
        ))}
      </ul>
    </Campo>
  );
  const campoLimitacoes = limitacoes.length > 0 && (
    <Campo rotulo={tx("O que não se pode concluir", "What cannot be concluded")} largo={contrastes.length === 0}>
      <ul className="list-disc space-y-1.5 pl-5">
        {limitacoes.map((l) => (
          <li key={l}>{comNomes(l)}</li>
        ))}
      </ul>
    </Campo>
  );
  const campoTrilhas = nasTrilhas.length > 0 && (
    <Campo rotulo={tx("Nas trilhas", "In the learning paths")}>
      <ul className="space-y-1">
        {nasTrilhas.map(({ trilha: t, passo, ordem }) => (
          <li key={`${t.id}-${passo.id}`}>
            <Link href={hrefPasso(t.id, passo.id)} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
              {tx(`${t.titulo}, passo ${ordem}: ${passo.titulo.toLowerCase()}`, `${t.titulo}, step ${ordem}: ${passo.titulo.toLowerCase()}`)}
            </Link>
          </li>
        ))}
      </ul>
    </Campo>
  );
  const campoPaineis = outrosPaineis.length > 0 && (
    <Campo rotulo={tx("Veja no painel", "See in the panel")}>
      <ul className="space-y-1">
        {outrosPaineis.map((v) => (
          <li key={v.href}>
            <Link href={v.href} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
              {v.rotulo}
            </Link>
          </li>
        ))}
      </ul>
    </Campo>
  );
  const camposDeCaminho = campoTrilhas || campoPaineis ? (
    <div className="min-w-0">
      {campoTrilhas}
      {campoPaineis}
    </div>
  ) : null;
  const campoRelacoes = relacoes.length > 0 && (
    <Campo rotulo={tx("Relações", "Related entries")} largo={!camposDeCaminho}>
      <ul className={c.relacoesNotas ? "space-y-2" : "flex flex-wrap gap-2"}>
        {relacoes.map((r) => {
          const rc = conceito(r)!;
          const nota = c.relacoesNotas?.[r];
          return (
            <li key={r} className={nota ? "flex flex-wrap items-center gap-x-3 gap-y-1" : undefined}>
              <Link href={`${ROTA_APRENDA}/${r}`} className="inline-flex min-h-[44px] items-center gap-2 border border-linha px-3 text-carvao hover:border-energia">
                <span className="rotulo">{rc.sigla ?? rc.nome}</span>
                {rc.sigla && rc.sigla.toLowerCase() !== rc.nome.toLowerCase() && <span className="text-sm text-carvao-muted">{rc.nome}</span>}
              </Link>
              {nota && <span className="min-w-0 flex-1 basis-64 text-sm leading-relaxed text-carvao-muted">{comNomes(nota)}</span>}
            </li>
          );
        })}
      </ul>
    </Campo>
  );

  return (
    <main id="conteudo" tabIndex={-1} className="ed-pagina pb-16" data-tipo-pagina="verbete" data-verbete={c.slug}>
      <AprendaNavegacao atual="verbetes" neta />
      <AprendaCabecalho
        rotulo={tx(`Verbete · ${c.grupo}`, `Entry · ${rotuloGrupoConceito(c.grupo, "en")}`)}
        titulo={
          comSigla ? (
            <>
              <span>{c.sigla}</span>
              <span className="sr-only">: </span>
              <span className="mt-1 block text-[0.55em] leading-snug text-carvao-muted">{c.nome}</span>
            </>
          ) : (
            <span>{c.nome}</span>
          )
        }
        lead={pergunta ?? undefined}
        contexto={
          <>
            {conferido ? (
              <>
                <span className="font-medium text-sucesso">
                  {tx(`● conferido na fonte primária em ${dataBR(c.conferidoEm)}`, `● checked against the primary source on ${dataBR(c.conferidoEm)}`)}
                </span>
                {c.revisadoEm && c.revisadoEm !== c.conferidoEm && <span>{tx(`revisado em ${dataBR(c.revisadoEm)}`, `revised on ${dataBR(c.revisadoEm)}`)}</span>}
                {c.ressalva && (
                  <span className="font-medium text-aviso" data-ressalva="true">
                    {tx("◐ com ressalva:", "◐ with caveat:")} {comNomes(c.ressalva)}
                  </span>
                )}
              </>
            ) : (
              <span className="font-medium text-aviso">{tx("○ verbete em preparação", "○ entry in preparation")}</span>
            )}
            {conferido && orgaos.length > 0 && <span>{tx(`Fonte: ${lista(orgaos)}`, `Source: ${lista(orgaos)}`)}</span>}
          </>
        }
        siglas={siglas}
      />

      {c.estado === "PENDENTE" ? (
        <div role="status" className="mt-6 max-w-prose2 border border-dashed border-mineral bg-papel p-6">
          <p className="text-carvao">
            {tx(
              "A definição deste conceito ainda não foi conferida na fonte primária e por isso não é publicada. A plataforma não escreve definições de memória.",
              "The definition of this concept has not yet been checked against the primary source and is therefore not published. The platform does not write definitions from memory.",
            )}
          </p>
          <details className="mt-3 text-sm text-carvao-muted">
            <summary className="inline-flex min-h-[44px] cursor-pointer items-center underline underline-offset-4">
              {tx("Como a definição será conferida", "How the definition will be checked")}
            </summary>
            <p className="mt-1">
              {tx("Fonte primária planejada:", "Planned primary source:")} {comNomes(c.fontePlanejada)}
            </p>
          </details>
          {c.fontes.length > 0 && (
            <p className="mt-2 text-sm text-carvao-muted">
              {tx("Conjunto de dados relacionado:", "Related dataset:")}{" "}
              <a href={c.fontes[0].url} target="_blank" rel="noopener noreferrer" className="text-energia-dark underline underline-offset-4">
                {comNomes(c.fontes[0].documento)}
              </a>
            </p>
          )}
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-x-12 lg:grid-cols-2">
        {conferido && (
          <>
            <Campo rotulo={tx("Em uma frase", "In one sentence")} lugar="lg:col-start-1 lg:row-start-1">
              {c.emPalavrasSimples ? (
                <>
                  <p className="rotulo text-mineral">{tx("Em palavras simples", "In plain words")}</p>
                  <p className="mt-1 font-serif text-xl leading-relaxed" data-palavras-simples="true">
                    {comNomes(c.emPalavrasSimples)}
                  </p>
                  <p className="rotulo mt-4 text-mineral">{tx("Texto da fonte", "Source text")}</p>
                  <p className="mt-1 text-base leading-relaxed text-carvao-muted">{comNomes(c.emUmaFrase)}</p>
                </>
              ) : (
                <p className="font-serif text-xl leading-relaxed">{comNomes(c.emUmaFrase)}</p>
              )}
            </Campo>
            <Campo rotulo={sintetico ? tx("Exemplo sintético", "Synthetic example") : tx("Exemplo real", "Real example")} id="exemplo" lugar={temMedida ? "lg:col-start-2 lg:row-span-3 lg:row-start-1" : "lg:col-start-2 lg:row-span-2 lg:row-start-1"}>
              {prova ? (
                <AprendaProva prova={prova} volta={`verbete:${c.slug}`} />
              ) : sintetico ? (
                <div data-sintetico="true" className="border-2 border-dashed border-mineral bg-papel">
                  <p className="border-b border-dashed border-mineral px-4 py-2 text-sm">
                    <span className="rotulo mr-3 text-carvao">{tx(ROTULO_SINTETICO, "Synthetic example")}</span>
                    <span className="text-carvao-muted">
                      {tx(AVISO_SINTETICO, "Hypothetical values, chosen for teaching. They are not observatory data and do not enter any indicator.")}
                    </span>
                  </p>
                  <p className="p-4">{sintetico}</p>
                </div>
              ) : (
                <AprendaProva prova={null} volta={`verbete:${c.slug}`} alternativa={destinoNoPainel(c)} />
              )}
            </Campo>
            <Campo rotulo={tx("Por que importa", "Why it matters")} lugar="lg:col-start-1 lg:row-start-2">
              {comNomes(c.porQueImporta)}
            </Campo>
            {temMedida && (
              <Campo rotulo={tx("Como é medido", "How it is measured")} lugar="lg:col-start-1 lg:row-start-3">
                {c.comoEMedidoResumo ? (
                  <>
                    <p>{comNomes(c.comoEMedidoResumo)}</p>
                    <details className="mt-2">
                      <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-sm text-energia-dark underline underline-offset-4">
                        {tx("Detalhe técnico: a norma, as fontes e o cálculo do observatório", "Technical detail: the norm, the sources and the observatory's calculation")}
                      </summary>
                      <div className="mt-1 space-y-3 text-sm text-carvao-muted">
                        {c.comoEMedido?.split("\n\n").map((par) => <p key={par.slice(0, 40)}>{comNomes(par)}</p>)}
                      </div>
                    </details>
                  </>
                ) : (
                  c.comoEMedido?.split("\n\n").map((par) => (
                    <p key={par.slice(0, 40)} className="mb-3 last:mb-0">
                      {comNomes(par)}
                    </p>
                  ))
                )}
                {unidade && (
                  <p className="mt-3 text-sm text-carvao-muted" data-unidade="true">
                    <span className="rotulo text-mineral">{tx("Unidade: ", "Unit: ")}</span>
                    {unidade}
                  </p>
                )}
              </Campo>
            )}
          </>
        )}
        {campoContrastes}
        {campoLimitacoes}
        {campoRelacoes}
        {camposDeCaminho}
        {c.fontes.length > 0 && (
          <Campo rotulo={tx("Fonte oficial", "Official source")} largo>
            <ul className="space-y-4">
              {fontesAgrupadas.map((g) => (
                <li key={g.chave}>
                  <p className="text-sm">
                    <strong className="font-medium">{g.orgao}</strong>
                    <a href={g.url} target="_blank" rel="noopener noreferrer" className="block py-3 leading-snug text-energia-dark underline underline-offset-4 [overflow-wrap:anywhere]">
                      {comNomes(g.documento)}&nbsp;<span aria-hidden="true">↗</span>
                    </a>
                  </p>
                  {g.trechos.map((f) => (
                    <div key={f.trecho ?? f.parafrase ?? g.chave}>
                      {f.parafrase && <p className="mt-2 pl-4 text-sm text-carvao">{comNomes(f.parafrase)}</p>}
                      {f.trecho && (
                        <details className="mt-1 pl-4 text-sm">
                          <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-energia-dark underline underline-offset-4">
                            {tx("Trecho literal do documento", "Literal excerpt from the document")}
                          </summary>
                          <blockquote className="border-l-2 border-linha pl-4 text-carvao-muted">
                            {f.trechoEmIngles ? <span lang="en">“{f.trecho}”</span> : <TrechoPortugues regiao={`trecho-${c.slug}`}>“{f.trecho}”</TrechoPortugues>}
                          </blockquote>
                        </details>
                      )}
                    </div>
                  ))}
                </li>
              ))}
            </ul>
            {conferido && (
              <p className="mt-4 text-sm text-mineral">
                {tx(`Documentos acessados e texto conferido em ${dataBR(c.conferidoEm)}`, `Documents accessed and text checked on ${dataBR(c.conferidoEm)}`)}
                {c.revisadoEm && c.revisadoEm !== c.conferidoEm ? tx(`; texto revisado em ${dataBR(c.revisadoEm)}`, `; text revised on ${dataBR(c.revisadoEm)}`) : ""}.
              </p>
            )}
          </Campo>
        )}
        {c.detalheDaConferencia && c.detalheDaConferencia.length > 0 && (
          <Campo rotulo={tx("Detalhe da conferência", "Check details")} largo>
            <details>
              <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-sm text-energia-dark underline underline-offset-4">
                {tx("O que a conferência encontrou na fonte", "What the check found in the source")}
              </summary>
              <ul className="mt-1 list-disc space-y-1.5 pl-5 text-sm text-carvao-muted">
                {c.detalheDaConferencia.map((d) => (
                  <li key={d}>{comNomes(d)}</li>
                ))}
              </ul>
            </details>
          </Campo>
        )}
      </div>
    </main>
  );
}
