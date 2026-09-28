import Link from "next/link";
import type { ReactNode } from "react";
import type { Dominio } from "@/lib/dominios";
import type { Amostra } from "@/lib/amostras";

const ACENTO: Record<Dominio["acento"], { filete: string; texto: string; hover: string; borda: string }> = {
  bronze: { filete: "bg-bronze", texto: "text-bronze-dark", hover: "hover:border-bronze focus-within:border-bronze", borda: "border-bronze" },
  energia: { filete: "bg-energia", texto: "text-energia-dark", hover: "hover:border-energia focus-within:border-energia", borda: "border-energia" },
};

/**
 * Painel visual de um observatório: a miniatura viva no alto, o nome, a
 * pergunta que o observatório responde e as perguntas que o portal responde:
 * as três primeiras sempre visíveis, as demais num controle "mais N perguntas"
 * no desktop (funciona com toque e teclado) e sempre visíveis no celular. A
 * ação fica alinhada ao pé do painel. Um único painel serve à home (com link) e à tela de escolha
 * (com o formulário de entrada e as amostras vivas).
 */
export function PainelObservatorio({
  dominio,
  miniatura,
  perguntas,
  amostras,
  acao,
  numero,
}: {
  dominio: Dominio;
  miniatura: ReactNode;
  perguntas: { texto: string; href: string }[];
  amostras?: Amostra[];
  /** Área de ação: link (home) ou formulário (escolha). */
  acao: ReactNode;
  numero: string;
}) {
  const a = ACENTO[dominio.acento];
  return (
    <article aria-labelledby={`painel-${dominio.id}-titulo`} className={`group relative flex h-full flex-col border border-linha bg-superficie transition-colors ${a.hover}`}>
      <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-[3px] ${a.filete}`} />
      <div className="border-b border-linha bg-papel px-5 pb-3 pt-5 md:px-7">{miniatura}</div>
      <div className="flex flex-1 flex-col px-5 py-6 md:px-7">
        <p className="rotulo text-mineral">
          Observatório {numero} · {dominio.nomeCurto}
        </p>
        <h3 id={`painel-${dominio.id}-titulo`} className="mt-3 font-serif text-2xl leading-snug text-carvao md:text-[1.75rem]">
          {dominio.nome}
        </h3>
        <p className={`mt-3 font-serif text-lg italic leading-relaxed ${a.texto}`}>{dominio.pergunta}</p>

        {amostras && amostras.length > 0 && (
          <dl className="mt-5 grid grid-cols-1 gap-3 border-t border-linha pt-4 sm:grid-cols-3">
            {amostras.map((s) => (
              <div key={s.rotulo}>
                <dt className="text-xs text-mineral">{s.rotulo}</dt>
                <dd className="mt-0.5 font-serif text-xl leading-tight tabular-nums text-carvao">{s.valor}</dd>
                <dd className="text-[0.7rem] leading-snug text-mineral">{s.nota}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="mt-5">
          <p className="rotulo text-mineral">Perguntas que este observatório responde</p>
          <ul className="mt-2 space-y-1.5 text-sm leading-snug text-carvao">
            {perguntas.slice(0, 3).map((p) => (
              <li key={p.href} className="flex gap-2">
                <span aria-hidden="true" className={a.texto}>
                  →
                </span>
                <Link href={p.href} className="underline decoration-linha underline-offset-4 hover:decoration-current">
                  {p.texto}
                </Link>
              </li>
            ))}
          </ul>
          {perguntas.length > 3 && (
            <>
              <ul className="mt-1.5 space-y-1.5 text-sm leading-snug text-carvao lg:hidden">
                {perguntas.slice(3).map((p) => (
                  <li key={p.href} className="flex gap-2">
                    <span aria-hidden="true" className={a.texto}>
                      →
                    </span>
                    <Link href={p.href} className="underline decoration-linha underline-offset-4 hover:decoration-current">
                      {p.texto}
                    </Link>
                  </li>
                ))}
              </ul>
              <details className="hidden lg:block">
                <summary className="rotulo inline-flex min-h-[44px] cursor-pointer list-none items-center gap-1 text-mineral hover:text-carvao [&::-webkit-details-marker]:hidden">
                  <span aria-hidden="true">+</span> mais {perguntas.length - 3} perguntas
                </summary>
                <ul className="mt-1 space-y-1.5 text-sm leading-snug text-carvao">
                  {perguntas.slice(3).map((p) => (
                    <li key={p.href} className="flex gap-2">
                      <span aria-hidden="true" className={a.texto}>
                        →
                      </span>
                      <Link href={p.href} className="underline decoration-linha underline-offset-4 hover:decoration-current">
                        {p.texto}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            </>
          )}
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-linha pt-5">{acao}</div>
      </div>
    </article>
  );
}
