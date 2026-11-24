import Link from "next/link";
import type { ReactNode } from "react";
import { LINK } from "./comum";
import { LogoEmpresa } from "./LogoEmpresa";

/**
 * Busca por marca ou grupo, na URL (`?q=`): um formulário GET, que funciona sem JavaScript e deixa o link copiável. Os demais
 * parâmetros do recorte (segmento, ordenação) seguem em campos ocultos. O servidor responde logo abaixo, com o grupo dono da
 * marca; aqui só o campo, o botão e alguns exemplos que já são links.
 */
export function BuscaGrupos({ acao, atual, outros, exemplos }: Readonly<{
  acao: string;
  atual: string;
  outros: Readonly<Record<string, string>>;
  exemplos: readonly { rotulo: string; href: string }[];
}>) {
  return (
    <form method="get" action={acao} role="search" aria-label="Busca por marca ou grupo" className="max-w-3xl" data-busca-grupos="">
      {Object.entries(outros).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <label htmlFor="busca-marca" className="t-h3 block text-carvao">
        De quem é esta marca?
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="busca-marca"
          type="search"
          name="q"
          defaultValue={atual}
          maxLength={60}
          autoComplete="off"
          enterKeyHint="search"
          placeholder="Digite uma marca ou um grupo"
          className="block min-h-[56px] w-full min-w-0 border border-carvao bg-superficie px-4 text-lg text-carvao placeholder:text-mineral"
        />
        <button
          type="submit"
          className="inline-flex min-h-[56px] shrink-0 items-center border border-carvao bg-carvao px-6 text-base font-medium text-papel transition-[background-color,transform] duration-150 ease-out motion-safe:active:scale-[0.97] [@media(hover:hover)]:hover:bg-carvao-soft"
        >
          Buscar
        </button>
      </div>
      {exemplos.length > 0 && (
        <p className="t-meta mt-2 text-carvao-muted">
          Por exemplo:{" "}
          {exemplos.map((x, i) => (
            <span key={x.rotulo}>
              {i > 0 && ", "}
              <Link href={x.href} prefetch={false} scroll={false} className={`inline-flex min-h-[32px] items-center ${LINK}`}>
                {x.rotulo}
              </Link>
            </span>
          ))}
          .
        </p>
      )}
    </form>
  );
}

/**
 * O resultado da busca como uma cadeia que se lê da esquerda para a direita: a marca do letreiro (etiqueta), o traço "pertence a" e o
 * grupo que a opera, com o logo (ou a placa com o nome), a posição no ranking e o link da ficha. Uma linha por grupo; no celular a
 * cadeia desce na vertical, com o mesmo traço. Quando a busca casou pelo nome do grupo, a etiqueta da marca não aparece.
 */
export function CadeiaDaMarca({ slug, grupo, bandeiras, href, posicao, detalhe }: Readonly<{
  slug: string;
  grupo: string;
  bandeiras: readonly string[];
  href: string;
  /** "2º no ranking de vendas de 2025" ou o motivo de estar fora dele. */
  posicao: string;
  /** Linha de apoio: o controlador registrado na ficha. */
  detalhe: ReactNode;
}>) {
  return (
    <li className="flex flex-col gap-x-0 gap-y-1 border-t border-linha py-4 md:flex-row md:items-center" data-achado={slug}>
      {bandeiras.length > 0 ? (
        <>
          <p className="min-w-0 md:max-w-[22rem]">
            <span className="sr-only">{bandeiras.length === 1 ? "Marca: " : "Marcas: "}</span>
            <span className="inline-block border border-carvao bg-superficie px-3 py-2 font-serif text-xl leading-tight text-carvao">{bandeiras.join(", ")}</span>
          </p>
          <p className="flex items-center gap-2 pl-4 text-xs text-carvao-muted md:w-28 md:shrink-0 md:flex-col md:gap-0.5 md:pl-0 md:text-center" aria-hidden="true">
            <span className="block h-5 w-px bg-carvao md:hidden" />
            <span>{bandeiras.length === 1 ? "é marca de" : "são marcas de"}</span>
            <span className="hidden h-px w-full bg-carvao md:block" />
            <span className="hidden md:block">&nbsp;</span>
          </p>
          <span className="sr-only">{bandeiras.length === 1 ? "é marca de" : "são marcas de"}</span>
        </>
      ) : (
        <p className="rotulo text-mineral md:w-28 md:shrink-0">Grupo</p>
      )}
      <div className="flex min-w-0 items-center gap-4 md:pl-0">
        <LogoEmpresa slug={slug} nome={grupo} tamanho="m" decorativo semLogo="placa" />
        <p className="min-w-0">
          <Link href={href} prefetch={false} className={`inline-flex min-h-[44px] items-center font-serif text-xl leading-tight text-carvao ${LINK}`}>
            {grupo}
            <span className="sr-only">: abrir a ficha</span>
          </Link>
          <span className="t-meta block text-carvao">{posicao}</span>
          <span className="t-meta block text-carvao-muted">{detalhe}</span>
        </p>
      </div>
    </li>
  );
}
