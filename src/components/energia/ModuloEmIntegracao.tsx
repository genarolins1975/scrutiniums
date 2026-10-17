import Link from "@/components/i18n/LinkIdioma";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { gold } from "@/lib/energia/gold";
import { conceitos as verbetes } from "@/lib/energia/conteudo/conceitos";
import { Nome } from "@/components/i18n/Nome";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";

/**
 * Módulo ainda sem dados integrados: escopo, perguntas que vai responder,
 * datasets catalogados relacionados e o que falta. Nenhum número, nenhum
 * gráfico de exemplo: ausência declarada.
 */
export function ModuloEmIntegracao({
  atual,
  secao,
  rotulo,
  titulo,
  escopo,
  perguntas,
  temas,
  orgaos,
  pendencias,
  destaque,
  conceitos,
}: {
  atual: string;
  secao: string;
  rotulo: string;
  titulo: string;
  escopo: string;
  perguntas: string[];
  temas: string[];
  orgaos?: string[];
  pendencias: string[];
  conceitos?: { slug: string; rotulo: string }[];
  /** Ligação com conteúdo já publicado em outro módulo. */
  destaque?: React.ReactNode;
}) {
  const en = idiomaEnergia() === "en";
  const cat = gold.catalogo();
  const relacionados = (cat?.entradas ?? [])
    // só o que ainda não foi integrado: fonte já usada em indicador aparece no próprio módulo
    .filter((e) => temas.includes(e.tema) && (!orgaos || orgaos.includes(e.orgao)) && !e.descontinuado && !e.estado.startsWith("UTILIZADO"))
    .slice(0, 14);
  return (
    <>
      <CabecalhoEnergia atual={atual} />
      <MarcaVisita secao={secao} />
      <main id="conteudo" tabIndex={-1} className="ed-pagina pb-16">
        <CabecalhoModulo recolher={false} rotulo={tx(`${rotulo} · em integração`, `${rotulo} · in integration`)} titulo={titulo}>
          {escopo}
        </CabecalhoModulo>
        <div role="status" className="border border-dashed border-mineral bg-papel p-6">
          <p className="rotulo text-carvao">{tx("Módulo em integração", "Module in integration")}</p>
          <p className="mt-2 max-w-prose2 text-carvao">
            {tx(
              <>
                Ainda não há dados integrados neste módulo. Por regra da plataforma, nenhum número, gráfico ou exemplo aparece antes de a fonte ser
                coletada automaticamente, guardada em cópia original conferível, validada e documentada com a origem de cada valor.
              </>,
              <>
                There is no integrated data in this module yet. By platform rule, no number, chart or example appears before the source is collected
                automatically, stored as a verifiable original copy, validated and documented with the origin of each value.
              </>,
            )}
          </p>
          {destaque && <div className="mt-3 max-w-prose2 text-carvao">{destaque}</div>}
        </div>
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section aria-labelledby="perguntas-h" className="border border-linha bg-superficie p-6">
            <h2 id="perguntas-h" className="font-serif text-xl text-carvao">{tx("Perguntas que este módulo vai responder", "Questions this module will answer")}</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-carvao">
              {perguntas.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="pendencias-h" className="border border-linha bg-superficie p-6">
            <h2 id="pendencias-h" className="font-serif text-xl text-carvao">{tx("O que falta", "What is missing")}</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-carvao">
              {pendencias.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            {conceitos && conceitos.length > 0 && (
              <>
                <p className="mt-4 text-sm text-carvao-muted">{tx("Verbetes relacionados:", "Related entries:")}</p>
                <ul className="mt-1 text-sm">
                  {conceitos.map((c) => {
                    const v = verbetes().find((x) => x.slug === c.slug);
                    return (
                      <li key={c.slug}>
                        <Link href={`/setor-eletrico/aprenda/${c.slug}`} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
                          {v && v.nome !== c.rotulo ? (
                            <>
                              {c.rotulo}: {v.nome}
                            </>
                          ) : (
                            c.rotulo
                          )}
                        </Link>
                        {v?.estado === "PENDENTE" && (
                          <span className="text-mineral">
                            {tx(" · verbete em preparação, nome ainda sem conferência na fonte primária", " · entry in preparation, name not yet checked against the primary source")}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>
        </div>
        <section aria-labelledby="catalogo-h" className="mt-8 border border-linha bg-superficie p-6">
          <h2 id="catalogo-h" className="font-serif text-xl text-carvao">{tx("Fontes catalogadas relacionadas", "Related cataloged sources")}</h2>
          <p className="mt-1 text-sm text-carvao-muted">
            {tx(
              "Registradas no catálogo com os metadados oficiais da fonte; ainda não coletadas pela plataforma.",
              "Recorded in the catalog with the official metadata of the source; not yet collected by the platform.",
            )}
          </p>
          {relacionados.length ? (
            <ul className="mt-4 divide-y divide-linha">
              {relacionados.map((e) => (
                <li key={e.id} className="grid gap-1 py-3 md:grid-cols-[6rem_1fr_auto] md:items-baseline md:gap-4">
                  <span className="rotulo text-mineral">{e.orgao}</span>
                  <span className="text-sm text-carvao">
                    {en ? <Nome>{e.titulo}</Nome> : e.titulo}
                    {!e.metadados_verificados && <span className="ml-2 text-xs text-aviso">{tx("metadados a conferir", "metadata to be checked")}</span>}
                  </span>
                  <a href={e.url} target="_blank" rel="noopener noreferrer" className="rotulo inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
                    {tx("fonte ↗", "source ↗")}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-mineral">{tx("Nenhuma fonte catalogada neste tema ainda.", "No source cataloged for this topic yet.")}</p>
          )}
          <Link href="/setor-eletrico/dados" className="rotulo mt-4 inline-flex min-h-[44px] items-center text-carvao underline underline-offset-4">
            {tx("Catálogo completo →", "Full catalog →")}
          </Link>
        </section>
      </main>
    </>
  );
}
