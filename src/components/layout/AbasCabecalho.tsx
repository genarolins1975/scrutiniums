import Link from "next/link";
import { N_ABAS_OBSERVATORIOS, navCabecalho } from "@/components/layout/navCabecalho";
import { prefetchDoLink } from "@/lib/rotasPublicas";
import type { Idioma } from "@/lib/idioma";

/**
 * Abas do cabeçalho público. Os seis observatórios levam às páginas abertas,
 * com o mesmo destino para quem tem conta e para quem não tem: não há consulta
 * de sessão no navegador. `soObservatorios` deixa de fora as abas que não são
 * observatório (Imprensa), para o seletor de observatórios do celular.
 */
export function AbasCabecalho({ className, idioma = "pt", soObservatorios = false }: { className: string; idioma?: Idioma; soObservatorios?: boolean }) {
  return (
    <>
      {navCabecalho(idioma).slice(0, soObservatorios ? N_ABAS_OBSERVATORIOS : undefined).map((item) => (
        <Link key={item.label} href={item.href} prefetch={prefetchDoLink(item.href)} className={className}>
          {item.label}
        </Link>
      ))}
    </>
  );
}
