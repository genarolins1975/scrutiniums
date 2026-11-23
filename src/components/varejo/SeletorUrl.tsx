import Link from "next/link";

export type OpcaoUrl = { valor: string; rotulo: string; href: string };

/**
 * Seletor de recorte que vive na URL: cada opção é um link para o mesmo endereço com o parâmetro trocado. O servidor lê o
 * parâmetro e a página inteira (título do bloco, frase, gráfico e tabela) sai no recorte pedido; o link copiado reproduz a
 * seleção, voltar de outra página a preserva, e funciona sem JavaScript. A opção em vigor leva aria-current.
 */
export function SeletorUrl({ id, rotulo, opcoes, atual }: Readonly<{ id: string; rotulo: string; opcoes: readonly OpcaoUrl[]; atual: string }>) {
  return (
    <div className="flex min-w-0 flex-col items-start">
      <span id={id} className="block text-sm text-carvao-muted">
        {rotulo}
      </span>
      <div role="group" aria-labelledby={id} className="mt-1 inline-flex max-w-full flex-wrap border border-linha bg-superficie">
        {opcoes.map((o, i) => {
          const ativo = o.valor === atual;
          return (
            <Link
              key={o.valor}
              href={o.href}
              scroll={false}
              prefetch={false}
              aria-current={ativo ? "true" : undefined}
              className={`inline-flex min-h-[44px] items-center px-3 text-sm transition-colors duration-150 ease-out motion-safe:active:scale-[0.97] ${i > 0 ? "border-l border-linha" : ""} ${
                ativo ? "bg-carvao font-medium text-papel" : "text-carvao [@media(hover:hover)]:hover:bg-marfim"
              }`}
            >
              {o.rotulo}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
