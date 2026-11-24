import Link from "next/link";
import { LINK } from "./comum";

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
    <form method="get" action={acao} role="search" aria-label="Busca por marca ou grupo" className="max-w-2xl" data-busca-grupos="">
      {Object.entries(outros).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <label htmlFor="busca-marca" className="block text-sm font-medium text-carvao">
        De quem é esta marca?
      </label>
      <div className="mt-1.5 flex gap-2">
        <input
          id="busca-marca"
          type="search"
          name="q"
          defaultValue={atual}
          maxLength={60}
          autoComplete="off"
          enterKeyHint="search"
          placeholder="Digite uma marca ou um grupo"
          className="block min-h-[44px] w-full min-w-0 border border-carvao-muted bg-superficie px-3 text-base text-carvao placeholder:text-mineral"
        />
        <button
          type="submit"
          className="inline-flex min-h-[44px] shrink-0 items-center border border-carvao bg-carvao px-5 text-sm font-medium text-papel transition-[background-color,transform] duration-150 ease-out motion-safe:active:scale-[0.97] [@media(hover:hover)]:hover:bg-carvao-soft"
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
