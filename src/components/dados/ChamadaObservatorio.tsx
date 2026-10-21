import Link from "next/link";
import { ACESSO } from "@/lib/acesso";

/**
 * Chamada ao fim das páginas públicas do crédito: o caminho principal é abrir o
 * Observatório (painéis com conta gratuita); a conta aparece pelo que de fato oferece. O texto
 * de acesso vem de src/lib/acesso.ts, nunca escrito à mão na página.
 */
export function ChamadaObservatorio({ titulo, texto, extra }: { titulo: string; texto: string; extra?: React.ReactNode }) {
  return (
    <div className="mt-10 border border-linha bg-papel p-8">
      <h2 className="font-serif text-2xl text-carvao">{titulo}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-carvao-muted">
        {texto} {ACESSO.leitura}
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <Link
          href="/observatorio"
          className="rotulo inline-flex min-h-[44px] items-center border border-carvao px-5 text-carvao hover:bg-carvao hover:text-marfim"
        >
          Abrir o Observatório
        </Link>
        <Link href="/cadastro" className="rotulo inline-flex min-h-[44px] items-center text-carvao-muted hover:text-bronze">
          {ACESSO.ctaConta}
        </Link>
        {extra}
      </div>
      <p className="mt-3 max-w-2xl text-xs leading-relaxed text-mineral">{ACESSO.conta}</p>
    </div>
  );
}
