import type { ComponentProps } from "react";
import LinkIdioma from "@/components/i18n/LinkIdioma";

/**
 * Link interno sem pré-busca em segundo plano. O `Link` do Next pede em segundo plano a página de cada link que entra na janela; em páginas
 * com dezenas de links (o mapa da inicial, a lista de regras, o catálogo, as distribuidoras) isso chegava a 47 pedidos e 1,4 MB transferidos
 * só ao rolar, bem mais do que a tarefa de quem lê pede. Aqui a página de destino só é buscada no clique. Páginas com poucos links de
 * navegação continuam com o `Link` padrão. Conserva o idioma da página (LinkIdioma).
 */
export default function Link(props: ComponentProps<typeof LinkIdioma>) {
  return <LinkIdioma prefetch={false} {...props} />;
}
