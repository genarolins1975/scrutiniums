import Link from "next/link";

export type OpcaoRecorte = { rotulo: string; href: string; atual: boolean };

/**
 * Escolha de um recorte que vive na URL, como links lado a lado dentro de Controles: o servidor lê o parâmetro e a página já sai no
 * recorte pedido, sem JavaScript. A opção em vigor leva aria-current e o filete de seleção; cada link tem 44 px de altura.
 */
export function OpcoesRecorte({ rotulo, opcoes }: Readonly<{ rotulo: string; opcoes: readonly OpcaoRecorte[] }>) {
  return (
    <nav aria-label={rotulo} className="min-w-0">
      <p className="rotulo text-mineral">{rotulo}</p>
      <ul className="mt-1 flex flex-wrap gap-x-1 gap-y-1">
        {opcoes.map((o) => (
          <li key={o.href}>
            <Link
              href={o.href}
              prefetch={false}
              scroll={false}
              aria-current={o.atual ? "true" : undefined}
              className={`inline-flex min-h-[44px] items-center border px-4 text-sm transition-colors duration-150 ${
                o.atual ? "border-carvao bg-carvao text-marfim" : "border-linha bg-superficie text-carvao hover:border-carvao"
              }`}
            >
              {o.rotulo}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
