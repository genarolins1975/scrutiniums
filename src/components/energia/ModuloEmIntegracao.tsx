import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { gold } from "@/lib/energia/gold";

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
}) {
  const cat = gold.catalogo();
  const relacionados = (cat?.entradas ?? [])
    // só o que ainda não foi integrado: fonte já usada em indicador aparece no próprio módulo
    .filter((e) => temas.includes(e.tema) && (!orgaos || orgaos.includes(e.orgao)) && !e.descontinuado && !e.estado.startsWith("UTILIZADO"))
    .slice(0, 14);
  return (
    <>
      <CabecalhoEnergia atual={atual} />
      <MarcaVisita secao={secao} />
      <main className="mx-auto max-w-page px-6 pb-16">
        <CabecalhoModulo rotulo={`${rotulo} · em integração`} titulo={titulo}>
          {escopo}
        </CabecalhoModulo>
        <div role="status" className="border border-dashed border-mineral bg-papel p-6">
          <p className="rotulo text-carvao">Módulo em integração</p>
          <p className="mt-2 max-w-prose2 text-carvao">
            Ainda não há dados integrados neste módulo. Por regra da plataforma, nenhum número, gráfico ou exemplo aparece antes de a fonte estar
            no pipeline com captura, sha256, validação e proveniência.
          </p>
        </div>
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section aria-labelledby="perguntas-h" className="border border-linha bg-superficie p-6">
            <h2 id="perguntas-h" className="font-serif text-xl text-carvao">Perguntas que este módulo vai responder</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-carvao">
              {perguntas.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="pendencias-h" className="border border-linha bg-superficie p-6">
            <h2 id="pendencias-h" className="font-serif text-xl text-carvao">O que falta</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-carvao">
              {pendencias.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            {conceitos && conceitos.length > 0 && (
              <p className="mt-4 text-sm text-carvao-muted">
                Verbetes relacionados:{" "}
                {conceitos.map((c, i) => (
                  <span key={c.slug}>
                    {i > 0 && " · "}
                    <Link href={`/setor-eletrico/aprenda/${c.slug}`} className="text-energia-dark underline underline-offset-4">{c.rotulo}</Link>
                  </span>
                ))}
              </p>
            )}
          </section>
        </div>
        <section aria-labelledby="catalogo-h" className="mt-8 border border-linha bg-superficie p-6">
          <h2 id="catalogo-h" className="font-serif text-xl text-carvao">Fontes catalogadas relacionadas</h2>
          <p className="mt-1 text-sm text-carvao-muted">Registradas no catálogo com metadados da fonte; ainda não integradas ao pipeline.</p>
          {relacionados.length ? (
            <ul className="mt-4 divide-y divide-linha">
              {relacionados.map((e) => (
                <li key={e.id} className="grid gap-1 py-3 md:grid-cols-[6rem_1fr_auto] md:items-baseline md:gap-4">
                  <span className="rotulo text-mineral">{e.orgao}</span>
                  <span className="text-sm text-carvao">
                    {e.titulo}
                    {!e.metadados_verificados && <span className="ml-2 text-xs text-aviso">metadados a conferir</span>}
                  </span>
                  <a href={e.url} target="_blank" rel="noopener noreferrer" className="rotulo text-energia-dark underline underline-offset-4">
                    fonte ↗
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-mineral">Nenhuma fonte catalogada neste tema ainda.</p>
          )}
          <Link href="/setor-eletrico/dados" className="rotulo mt-4 inline-flex min-h-[44px] items-center text-carvao underline underline-offset-4">
            Catálogo completo →
          </Link>
        </section>
      </main>
    </>
  );
}
