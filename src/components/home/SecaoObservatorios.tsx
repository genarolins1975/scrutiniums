import Link from "next/link";
import { DOMINIOS, type Dominio } from "@/lib/dominios";

const ACENTO: Record<Dominio["acento"], { filete: string; texto: string; chip: string; hover: string }> = {
  bronze: {
    filete: "bg-bronze",
    texto: "text-bronze-dark",
    chip: "border-bronze/40 text-bronze-dark",
    hover: "hover:border-bronze",
  },
  energia: {
    filete: "bg-energia",
    texto: "text-energia-dark",
    chip: "border-energia/40 text-energia-dark",
    hover: "hover:border-energia",
  },
};

/**
 * "Uma plataforma. Dois observatórios.": a arquitetura de marca em uma dobra.
 * Dois cards editoriais do mesmo registro (src/lib/dominios.ts), cada um com o
 * acento do seu domínio; nenhum catálogo de funcionalidades.
 */
export function SecaoObservatorios() {
  return (
    <section id="observatorios" aria-labelledby="observatorios-titulo" className="border-b border-linha bg-papel">
      <div className="mx-auto max-w-page px-6 py-20 md:py-28">
        <p className="rotulo text-mineral">Arquitetura da plataforma</p>
        <h2
          id="observatorios-titulo"
          className="mt-6 max-w-3xl font-serif text-[clamp(2rem,4.6vw,3.2rem)] leading-[1.1] text-carvao"
        >
          Uma plataforma. Dois observatórios.
        </h2>
        <p className="mt-6 max-w-prose2 leading-relaxed text-carvao-muted md:text-lg">
          A Scrutiniums organiza dados públicos, registros oficiais e séries setoriais para transformar
          informação dispersa em conhecimento verificável. Hoje, essa infraestrutura sustenta dois
          observatórios independentes: Crédito e Setor Elétrico.
        </p>

        <ul className="mt-14 grid gap-6 lg:grid-cols-2">
          {DOMINIOS.map((d, i) => {
            const a = ACENTO[d.acento];
            return (
              <li key={d.id}>
                <article
                  aria-labelledby={`obs-${d.id}-titulo`}
                  className={`group relative flex h-full flex-col border border-linha bg-superficie p-8 transition-colors md:p-10 ${a.hover}`}
                >
                  <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-[3px] ${a.filete}`} />
                  <p className="rotulo text-mineral">
                    Observatório {String(i + 1).padStart(2, "0")} · domínio {d.nomeCurto}
                  </p>
                  <h3 id={`obs-${d.id}-titulo`} className="mt-5 font-serif text-2xl leading-snug text-carvao md:text-[1.75rem]">
                    {d.nome}
                  </h3>
                  <p className={`mt-5 font-serif text-lg italic leading-relaxed ${a.texto}`}>{d.pergunta}</p>
                  <p className="mt-5 flex-1 text-sm leading-relaxed text-carvao-muted md:text-base">{d.descricao}</p>
                  <ul className="mt-7 flex flex-wrap gap-2" aria-label="Temas">
                    {d.chips.map((c) => (
                      <li key={c} className={`rotulo border px-2.5 py-1 ${a.chip}`}>
                        {c}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={d.rotaRaiz}
                    className="rotulo mt-9 inline-flex min-h-[44px] items-center gap-2 self-start border border-carvao px-5 text-carvao transition-colors hover:bg-carvao hover:text-marfim"
                  >
                    {d.cta} <span aria-hidden="true">→</span>
                  </Link>
                </article>
              </li>
            );
          })}
        </ul>
        <p className="rotulo mt-10 text-mineral">
          Mesma conta · mesmo método · mesma estrutura de fontes e evidências
        </p>
      </div>
    </section>
  );
}
