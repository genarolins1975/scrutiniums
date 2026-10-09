import NextLink from "next/link";
import type { ComponentProps } from "react";

/**
 * Link interno sem pré-busca em segundo plano. O `Link` do Next pede em segundo plano a página de cada link que entra na janela; em páginas
 * com dezenas de links (o mapa da inicial, a lista de regras, o catálogo, as distribuidoras) isso chegava a 47 pedidos e 1,4 MB transferidos
 * só ao rolar, bem mais do que a tarefa de quem lê pede. Aqui a página de destino só é buscada no clique. Páginas com poucos links de
 * navegação continuam com o `Link` padrão.
 */
export default function Link(props: ComponentProps<typeof NextLink>) {
  return <NextLink prefetch={false} {...props} />;
}
