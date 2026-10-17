import Link from "next/link";
import { DOMINIOS, type DominioId } from "@/lib/dominios";
import { DetalhesFechaveis } from "@/components/layout/DetalhesFechaveis";
import { Nome } from "@/components/i18n/Nome";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { hrefNoIdioma } from "@/lib/i18n-href";

const PONTO: Record<(typeof DOMINIOS)[number]["acento"], string> = { bronze: "bg-bronze", energia: "bg-energia", obee: "bg-obee", gas: "bg-gas" };

/**
 * Switcher discreto de observatório ("Crédito ▾" / "Setor Elétrico ▾" / "Eficiência Estatal ▾").
 * <details> nativo: funciona sem JavaScript e abre por teclado e toque; com
 * JavaScript, fecha com Esc, com clique fora e quando o foco sai do menu. Troca de observatório sem novo login: a
 * sessão e as preferências são da plataforma.
 */
export function SwitcherObservatorio({
  atual,
  onDark = false,
}: {
  atual: DominioId | null;
  onDark?: boolean;
}) {
  // idioma pelo endereço (vale em qualquer observatório); nomes de observatório são nomes próprios e ficam em português, marcados
  const idioma = idiomaEnergia();
  const corrente = DOMINIOS.find((d) => d.id === atual);
  const rotulo = corrente ? corrente.nomeCurto : tx("Observatórios", "Observatories", idioma);
  const cor = onDark ? "text-marfim" : "text-carvao";
  return (
    <DetalhesFechaveis className="group relative">
      <summary
        className={`rotulo flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 ${cor} hover:text-energia-dark [&::-webkit-details-marker]:hidden`}
        aria-label={tx(`Observatório atual: ${rotulo}. Trocar de observatório`, `Current observatory: ${rotulo}. Switch observatory`, idioma)}
      >
        {corrente ? <Nome>{rotulo}</Nome> : rotulo}
        <span aria-hidden="true" className="text-[0.7em] transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      {/* no celular o menu ocupa a largura útil (fixo, 1rem de margem) para não sair da tela */}
      <div className="fixed inset-x-4 z-40 mt-1 hidden border sm:absolute sm:inset-x-auto sm:left-0 sm:w-[18rem] border-linha bg-superficie p-2 shadow-[0_8px_24px_rgba(26,29,33,0.12)] group-open:block">
        <p className="rotulo px-3 pb-1 pt-2 text-mineral">{tx("Observatórios", "Observatories", idioma)}</p>
        <ul>
          {DOMINIOS.map((d) => (
            <li key={d.id}>
              <Link
                href={hrefNoIdioma(d.rotaRaiz, idioma)}
                aria-current={d.id === atual ? "true" : undefined}
                className="flex min-h-[44px] flex-col justify-center px-3 py-2 hover:bg-papel"
              >
                <span className="flex items-center gap-2 text-sm text-carvao">
                  <span
                    aria-hidden="true"
                    className={`inline-block h-2 w-2 ${PONTO[d.acento]}`}
                  />
                  <Nome>{d.nome}</Nome>
                  {d.id === atual && <span className="sr-only">{tx(" (atual)", " (current)", idioma)}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/app/observatorios" className="rotulo mt-1 flex min-h-[44px] items-center border-t border-linha px-3 text-mineral hover:text-carvao">
          {tx("Escolher na minha conta →", "Choose in my account →", idioma)}
        </Link>
      </div>
    </DetalhesFechaveis>
  );
}
