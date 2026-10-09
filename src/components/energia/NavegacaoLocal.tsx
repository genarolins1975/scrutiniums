import Link from "next/link";

/**
 * Navegação local única de um módulo, em duas formas que nunca aparecem juntas na mesma página.
 *
 * `faixa`: linha de páginas irmãs do módulo, com a atual marcada (`aria-current="page"`), no alto das páginas filhas. É texto com
 * traço embaixo, sem caixas. No celular as páginas quebram linha, duas por linha (a faixa que rola foi lida como "cortada").
 *
 * `capitulos`: nas aberturas, depois da figura principal, as páginas do módulo viram capítulos com o nome, a pergunta que cada um
 * responde e o link. A página atual não entra. Substitui a faixa na abertura, para o mesmo rótulo não aparecer duas vezes
 * (faixa, índice e cartões de destino repetindo os mesmos nomes é o padrão que o redesenho elimina).
 *
 * O destino de cada item vem da lista do módulo (as mesmas que o menu, o mapa e o sitemap leem); nada é inventado aqui.
 */
export type ItemLocal = {
  id: string;
  href: string;
  rotulo: string;
  /** Pergunta ou descrição curta do destino; só a forma `capitulos` a mostra. */
  descricao?: string;
};

export function NavegacaoLocal({
  rotulo,
  itens,
  atual,
  variante = "faixa",
  titulo,
}: {
  /** Nome acessível da navegação (ex.: "Páginas de Água e clima"). */
  rotulo: string;
  itens: readonly ItemLocal[];
  /** `id` do item da página atual. */
  atual: string;
  variante?: "faixa" | "capitulos";
  /** Título visível da seção de capítulos; sem título, a forma `capitulos` leva só o rótulo acessível. */
  titulo?: string;
}) {
  if (variante === "capitulos") {
    const restantes = itens.filter((i) => i.id !== atual);
    if (restantes.length === 0) return null;
    return (
      <nav aria-label={rotulo} data-navegacao-local="capitulos" className="border-t border-linha pt-6">
        {titulo && <h2 className="ed-h3 font-serif text-carvao">{titulo}</h2>}
        <ol className={`grid gap-x-8 gap-y-6 sm:grid-cols-2 ${restantes.length >= 3 ? "lg:grid-cols-3" : ""} ${titulo ? "mt-4" : ""}`}>
          {restantes.map((i) => (
            <li key={i.id} className="min-w-0">
              <Link href={i.href} className="group block">
                <span className="ed-h3 block font-serif text-carvao group-hover:text-energia-dark">{i.rotulo}</span>
                {i.descricao && <span className="mt-1 block text-sm leading-snug text-carvao-muted">{i.descricao}</span>}
                <span className="mt-2 inline-flex min-h-[32px] items-center text-sm text-energia-dark underline underline-offset-4 group-hover:text-carvao">
                  Abrir <span className="sr-only">{i.rotulo}</span>
                  <span aria-hidden="true" className="ml-1.5">
                    →
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </nav>
    );
  }
  return (
    <nav aria-label={rotulo} data-navegacao-local="faixa" className="border-b border-linha">
      <ol className="nav-faixa flex flex-wrap gap-x-6 text-sm">
        {itens.map((i) => {
          const ativo = i.id === atual;
          return (
            <li key={i.id}>
              <Link
                href={i.href}
                aria-current={ativo ? "page" : undefined}
                className={`-mb-px inline-flex min-h-[44px] items-center border-b-2 px-0.5 ${
                  ativo ? "border-energia text-carvao" : "border-transparent text-carvao-muted hover:border-linha hover:text-carvao"
                }`}
              >
                {i.rotulo}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
