import Link from "next/link";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { DESTINOS_NAVEGACAO } from "@/lib/energia/navegacao";

/**
 * Ligações de assunto com outros painéis do observatório (geração, carga, preço de curto prazo, conta de luz, conferência da ENA), no fim
 * das páginas de Água e clima. São ligações neutras: dizem de que cada painel trata, sem dizer que um número explica ou causa o outro. O
 * nome e o endereço vêm do registro de destinos da navegação (os mesmos do menu e do mapa); o `assunto` é a frase que a página escreve.
 */
export type PonteAgua = {
  slug: string;
  /** Endereço mais específico que o do módulo (um painel, uma âncora). */
  href?: string;
  /** Nome do link, quando o do destino no registro é largo demais para o que a ligação aponta (por exemplo, uma seção de outra página do módulo). */
  rotulo?: string;
  /** De que o painel trata, em uma frase, sem relação de causa. */
  assunto: string;
};

export function AguaPontes({ itens, id = "pontes" }: { itens: readonly PonteAgua[]; id?: string }) {
  const lista = itens
    .map((i) => {
      const d = DESTINOS_NAVEGACAO.find((x) => x.slug === i.slug && x.publicado);
      return d ? { slug: i.slug, rotulo: i.rotulo ?? d.rotulo, href: i.href ?? d.href, assunto: i.assunto } : null;
    })
    .filter((x): x is { slug: string; rotulo: string; href: string; assunto: string } => x !== null);
  if (!lista.length) return null;
  return (
    <SecaoDoPainel
      id={id}
      titulo="Onde o mesmo assunto aparece em outros painéis?"
      lead="Ligações de assunto: os números são de painéis diferentes, e esta página não diz que um explica o outro."
    >
      <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2" data-pontes="">
        {lista.map((i) => (
          <li key={`${i.slug}:${i.href}`} className="min-w-0 text-sm leading-snug text-carvao-muted">
            <Link href={i.href} prefetch={false} className="inline-flex min-h-[44px] items-center text-base text-energia-dark underline underline-offset-4 hover:text-carvao">
              {i.rotulo}
            </Link>
            <span className="block">{i.assunto}</span>
          </li>
        ))}
      </ul>
    </SecaoDoPainel>
  );
}
