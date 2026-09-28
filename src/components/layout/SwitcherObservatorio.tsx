import Link from "next/link";
import { DOMINIOS, type DominioId } from "@/lib/dominios";

/**
 * Switcher discreto de observatório ("Crédito ▾" / "Setor Elétrico ▾").
 * <details> nativo: funciona sem JavaScript, abre por teclado e toque, e fecha
 * com Esc nos navegadores atuais. Troca de observatório sem novo login: a
 * sessão e as preferências são da plataforma.
 */
export function SwitcherObservatorio({
  atual,
  onDark = false,
}: {
  atual: DominioId | null;
  onDark?: boolean;
}) {
  const corrente = DOMINIOS.find((d) => d.id === atual);
  const rotulo = corrente ? corrente.nomeCurto : "Observatórios";
  const cor = onDark ? "text-marfim" : "text-carvao";
  return (
    <details className="group relative">
      <summary
        className={`rotulo flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 ${cor} hover:text-energia-dark [&::-webkit-details-marker]:hidden`}
        aria-label={`Observatório atual: ${rotulo}. Trocar de observatório`}
      >
        {rotulo}
        <span aria-hidden="true" className="text-[0.7em] transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="absolute left-0 z-40 mt-1 hidden w-[min(18rem,calc(100vw-2rem))] border border-linha bg-superficie p-2 shadow-[0_8px_24px_rgba(26,29,33,0.12)] group-open:block">
        <p className="rotulo px-3 pb-1 pt-2 text-mineral">Observatórios</p>
        <ul>
          {DOMINIOS.map((d) => (
            <li key={d.id}>
              <Link
                href={d.rotaRaiz}
                aria-current={d.id === atual ? "page" : undefined}
                className="flex min-h-[44px] flex-col justify-center px-3 py-2 hover:bg-papel"
              >
                <span className="flex items-center gap-2 text-sm text-carvao">
                  <span
                    aria-hidden="true"
                    className={`inline-block h-2 w-2 ${d.acento === "energia" ? "bg-energia" : "bg-bronze"}`}
                  />
                  {d.nome}
                  {d.id === atual && <span className="sr-only"> (atual)</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/app/observatorios" className="rotulo mt-1 flex min-h-[44px] items-center border-t border-linha px-3 text-mineral hover:text-carvao">
          Escolher na minha conta →
        </Link>
      </div>
    </details>
  );
}
