import Link from "next/link";
import { Numero } from "@/components/observatorios/EntradaObservatorio";
import type { FrenteTerritorio } from "@/lib/observatorios/entradas/territorio";

/**
 * Modelo didático "onde a mudança aparece": as três frentes em que a
 * plataforma mede mudanças no território. Agrupa medições; não atribui causa
 * ao clima nem liga uma frente à outra.
 */
export function FrentesTerritorio({ frentes }: Readonly<{ frentes: FrenteTerritorio[] }>) {
  return (
    <section aria-labelledby="frentes-titulo" className="border-y border-linha bg-marfim">
      <div className="mx-auto max-w-page px-6 py-14 md:py-16">
        <p className="rotulo text-mineral">Modelo didático</p>
        <h2 id="frentes-titulo" className="mt-3 max-w-3xl font-serif text-[clamp(1.6rem,3vw,2.1rem)] leading-tight text-carvao">
          Onde a mudança aparece
        </h2>
        <p className="mt-4 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
          Três frentes em que o território é medido: a floresta, as cidades e a água. O modelo agrupa onde as mudanças são
          registradas; ele não atribui causa ao clima, e as frentes não se somam. Emissões pelo inventário oficial e
          desastres da Defesa Civil ainda não estão integrados.
        </p>
        <ol className="mt-10 grid gap-px border border-linha bg-linha lg:grid-cols-3">
          {frentes.map((f, i) => (
            <li key={f.id} className="flex flex-col bg-papel p-5">
              <p className="rotulo flex items-baseline gap-2 text-mineral">
                <span className="tabular-nums text-carvao">{String(i + 1).padStart(2, "0")}</span>
                {f.titulo}
              </p>
              <h3 className="mt-2 font-serif text-xl leading-snug text-carvao">{f.pergunta}</h3>
              <p className="mt-2 text-sm leading-relaxed text-carvao-muted">{f.texto}</p>
              <ul className="mt-4 space-y-3">
                {f.numeros.map((n) => (
                  <li key={n.rotulo} className="border-t border-linha pt-3">
                    <span className="block text-xs leading-snug text-carvao-muted">{n.rotulo}</span>
                    <span className="mt-1 block"><Numero n={n} /></span>
                    {n.nota && <span className="mt-1 block text-xs leading-relaxed text-mineral">{n.nota}</span>}
                  </li>
                ))}
              </ul>
              <ul className="mt-auto pt-4 text-sm">
                {f.paineis.map((p) => (
                  <li key={p.href}>
                    <Link href={p.href} prefetch={false} className="inline-flex min-h-[44px] items-center text-carvao underline decoration-linha underline-offset-4">{p.titulo}</Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** Método e fontes da entrada do Território e Clima. */
export function MetodoTerritorio() {
  return (
    <>
      <p>
        Desmatamento: PRODES do INPE, ano de agosto a julho; a taxa da Amazônia Legal e o incremento mapeado do Cerrado
        são medidas diferentes. Fogo: focos de calor do satélite de referência do Programa Queimadas do INPE. Cidades e água: SINISA do Ministério das Cidades, declarado por municípios e
        prestadores que responderam a cada módulo. Reservatórios: ONS.
      </p>
      <p>
        Os números são lidos das mesmas bases na publicação do site; quando uma base não pode ser lida, o número aparece
        como indisponível, nunca como zero.
      </p>
      <ul className="flex flex-wrap gap-x-6 gap-y-2">
        <li><Link href="/agronegocio/metodologia" className="inline-flex min-h-[44px] items-center text-carvao underline decoration-linha underline-offset-4">Agronegócio: método</Link></li>
        <li><Link href="/saneamento/metodologia" className="inline-flex min-h-[44px] items-center text-carvao underline decoration-linha underline-offset-4">Saneamento: método</Link></li>
        <li><Link href="/perguntas/territorio-e-clima" className="inline-flex min-h-[44px] items-center text-carvao underline decoration-linha underline-offset-4">Resumo aberto do observatório</Link></li>
      </ul>
    </>
  );
}
