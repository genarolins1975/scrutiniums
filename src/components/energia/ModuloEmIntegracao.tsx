import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { EsquemaConceitual, type LinhaEsquema } from "@/components/energia/EsquemaConceitual";
import { PipelineEstados } from "@/components/energia/PipelineEstados";
import { IconeSetor, type TipoIcone } from "@/components/energia/IconeSetor";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { gold } from "@/lib/energia/gold";
import { CONCEITOS } from "@/lib/energia/conteudo/conceitos";

/**
 * Módulo ainda sem dados integrados: o esquema conceitual do que o módulo vai
 * mostrar (atores, etapas ou categorias, sem números), as perguntas como
 * roteiro, a esteira de integração das fontes catalogadas e o que falta.
 * Nenhum número do setor, nenhum gráfico de exemplo: ausência declarada.
 */
export function ModuloEmIntegracao({
  atual,
  secao,
  rotulo,
  titulo,
  icone,
  escopo,
  perguntas,
  temas,
  orgaos,
  pendencias,
  destaque,
  conceitos,
  esquema,
}: {
  atual: string;
  secao: string;
  rotulo: string;
  titulo: string;
  icone?: TipoIcone;
  escopo: string;
  perguntas: string[];
  temas: string[];
  orgaos?: string[];
  pendencias: string[];
  conceitos?: { slug: string; rotulo: string }[];
  /** Ligação com conteúdo já publicado em outro módulo. */
  destaque?: React.ReactNode;
  /** Infográfico estrutural do módulo (esquema, sem dado). */
  esquema?: { titulo: string; linhas: LinhaEsquema[]; nota: string };
}) {
  const cat = gold.catalogo();
  const relacionadosTodos = (cat?.entradas ?? []).filter((e) => temas.includes(e.tema) && (!orgaos || orgaos.includes(e.orgao)) && !e.descontinuado);
  // só o que ainda não foi integrado: fonte já usada em indicador aparece no próprio módulo
  const relacionados = relacionadosTodos.filter((e) => !e.estado.startsWith("UTILIZADO")).slice(0, 14);
  return (
    <>
      <CabecalhoEnergia atual={atual} />
      <MarcaVisita secao={secao} />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6 pb-16">
        <CabecalhoModulo rotulo={`${rotulo} · em integração`} titulo={titulo}>
          {escopo}
        </CabecalhoModulo>
        <div role="status" className="grid gap-4 border border-dashed border-mineral bg-papel p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:p-6">
          <div>
            <p className="rotulo flex items-center gap-2 text-carvao">
              {icone && <IconeSetor tipo={icone} tamanho={15} />} Módulo em integração
            </p>
            <p className="mt-2 max-w-prose2 text-carvao">
              Ainda não há dados integrados neste módulo. Por regra da plataforma, nenhum número, gráfico ou exemplo aparece antes de a fonte ser
              coletada automaticamente, guardada em cópia original conferível, validada e documentada com a origem de cada valor.
            </p>
            {destaque && <div className="mt-3 max-w-prose2 text-carvao">{destaque}</div>}
          </div>
          <p className="text-sm text-carvao-muted md:max-w-[16rem]">
            {relacionadosTodos.length} {relacionadosTodos.length === 1 ? "conjunto catalogado neste tema" : "conjuntos catalogados neste tema"}, {relacionadosTodos.filter((e) => e.estado !== "CATALOGADO").length} além de catalogado.
          </p>
        </div>

        {esquema && (
          <section aria-labelledby="esquema-h" className="mt-10">
            <p className="rotulo text-mineral">Como o módulo vai se organizar</p>
            <h2 id="esquema-h" className="mt-2 font-serif text-2xl leading-snug text-carvao md:text-3xl">
              {esquema.titulo}
            </h2>
            <p className="mt-2 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
              Esquema da estrutura, sem números. Cada caixa diz se a sua definição já está conferida em fonte primária, se o verbete está em preparação ou se é leitura usual do setor.
            </p>
            <div className="mt-5">
              <EsquemaConceitual titulo={esquema.titulo} linhas={esquema.linhas} nota={esquema.nota} />
            </div>
          </section>
        )}

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <section aria-labelledby="perguntas-h" className="border border-linha bg-superficie p-6">
            <h2 id="perguntas-h" className="font-serif text-xl text-carvao">Perguntas que este módulo vai responder</h2>
            <ol className="mt-4 space-y-3">
              {perguntas.map((p, i) => (
                <li key={p} className="flex gap-3 text-sm leading-relaxed text-carvao">
                  <span aria-hidden="true" className="font-serif text-lg leading-none text-energia">
                    {i + 1}
                  </span>
                  <span>{p}</span>
                </li>
              ))}
            </ol>
          </section>
          <section aria-labelledby="pendencias-h" className="border border-linha bg-superficie p-6">
            <h2 id="pendencias-h" className="font-serif text-xl text-carvao">O que falta</h2>
            <ul className="mt-4 space-y-3">
              {pendencias.map((p) => (
                <li key={p} className="flex gap-3 text-sm leading-relaxed text-carvao">
                  <span aria-hidden="true" className="mt-1 inline-block h-2.5 w-2.5 shrink-0 border border-carvao" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
            {conceitos && conceitos.length > 0 && (
              <>
                <p className="rotulo mt-5 text-mineral">Verbetes relacionados</p>
                <ul className="mt-1 text-sm">
                  {conceitos.map((c) => {
                    const v = CONCEITOS.find((x) => x.slug === c.slug);
                    return (
                      <li key={c.slug}>
                        <Link href={`/setor-eletrico/aprenda/${c.slug}`} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
                          {v && v.nome !== c.rotulo ? `${c.rotulo}: ${v.nome}` : c.rotulo}
                        </Link>
                        {v?.estado === "PENDENTE" && <span className="text-mineral"> · verbete em preparação, nome ainda sem conferência na fonte primária</span>}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>
        </div>

        <section aria-labelledby="catalogo-h" className="mt-10">
          <h2 id="catalogo-h" className="font-serif text-2xl text-carvao">Fontes catalogadas relacionadas</h2>
          <p className="mt-1 max-w-prose2 text-sm text-carvao-muted">
            Registradas no catálogo com os metadados oficiais da fonte. A esteira mostra em que degrau da integração cada conjunto deste tema está; só conjuntos no degrau de uso alimentam números.
          </p>
          {cat && relacionadosTodos.length > 0 && (
            <div className="mt-4">
              <PipelineEstados cat={cat} entradas={relacionadosTodos} compacto />
            </div>
          )}
          {relacionados.length ? (
            <ul className="mt-4 divide-y divide-linha border border-linha bg-superficie px-5">
              {relacionados.map((e) => (
                <li key={e.id} className="grid gap-1 py-3 md:grid-cols-[6rem_1fr_auto] md:items-baseline md:gap-4">
                  <span className="rotulo text-mineral">{e.orgao}</span>
                  <span className="text-sm text-carvao">
                    {e.titulo}
                    <span className="ml-2 rotulo !text-[0.62rem] text-mineral">{e.estado}</span>
                    {!e.metadados_verificados && <span className="ml-2 text-xs text-aviso">metadados a conferir</span>}
                  </span>
                  <a href={e.url} target="_blank" rel="noopener noreferrer" className="rotulo inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
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
