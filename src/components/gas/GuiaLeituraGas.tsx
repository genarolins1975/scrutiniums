import { LEITURAS_GAS } from "@/lib/gas/leitura";

export function GuiaLeituraGas({ slug }: { slug: string }) {
  const guia = LEITURAS_GAS[slug];
  if (!guia) return null;
  return <div className="mt-6 grid gap-4 border-t border-linha pt-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
    <aside className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
      <p className="rotulo text-gas-dark">{guia.titulo}</p>
      <p className="mt-2">{guia.texto}</p>
    </aside>
    <nav aria-label="Nesta página" className="border-l-2 border-gas pl-4">
      <p className="rotulo text-gas-dark">Explore a pergunta</p>
      <ul>{guia.atalhos.map(([id, texto]) => <li key={id}><a href={`#${id}`} className="inline-flex min-h-[44px] items-center text-sm text-gas-dark underline underline-offset-4">{texto}</a></li>)}</ul>
    </nav>
  </div>;
}

/**
 * Só os atalhos da página ("Explore a pergunta"), para o molde de painel: a navegação local fica logo depois dos números, e o texto do
 * guia vai para as notas de leitura (ParaLer), porque nada além do recorte e do limite vem antes dos números.
 */
export function AtalhosGas({ slug }: { slug: string }) {
  const guia = LEITURAS_GAS[slug];
  if (!guia) return null;
  return <nav aria-label="Nesta página" className="mt-8 border-l-2 border-gas pl-4">
    <p className="rotulo text-gas-dark">Explore a pergunta</p>
    <ul className="flex flex-wrap gap-x-6">{guia.atalhos.map(([id, texto]) => <li key={id}><a href={`#${id}`} className="inline-flex min-h-[44px] items-center text-sm text-gas-dark underline underline-offset-4">{texto}</a></li>)}</ul>
  </nav>;
}
