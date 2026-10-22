import Link from "next/link";
import { SeloComConta } from "@/components/acesso/SeloComConta";
import { prefetchDoLink } from "@/lib/rotasPublicas";
import type { GrupoObservatorio, Resultado } from "@/lib/busca/buscar";
import type { TipoEntrada } from "@/lib/busca/tipos";

/** O que é o destino, em uma palavra, antes do resumo. */
const ROTULO_TIPO: Record<TipoEntrada, string> = {
  consulta: "Consulta do seu caso",
  pergunta: "Pergunta",
  colecao: "Coleção",
  pagina: "Página",
  metodo: "Método e conceitos",
  verbete: "Verbete",
  observatorio: "Observatório",
};

/**
 * Resultados da busca da plataforma, agrupados por observatório e coleção: título, o que o destino é e o resumo em uma linha,
 * com o selo "com conta" nos destinos fechados quando não há sessão. Página prevista aparece como "ainda sem página", sem
 * link. Sem estado próprio: serve à página /buscar (servidor) e à lista do campo de busca da barra (BuscaPlataforma), que
 * passa `opcao` para dar a cada item o papel de opção da listbox e marcar a ativa.
 */
export function ListaResultados({
  grupos,
  comSessao,
  opcao,
}: {
  grupos: GrupoObservatorio[];
  /** true: ninguém precisa do selo. false ou null (sessão ainda desconhecida no navegador): o selo decide sozinho. */
  comSessao: boolean | null;
  /** Na listbox do campo: id e estado de cada opção, pela ordem de tela. */
  opcao?: { id: (n: number) => string; ativa: number; aoEscolher?: (r: Resultado) => void };
}) {
  let n = -1;
  // ids dos títulos únicos na página: o campo da barra e o de /buscar podem listar o mesmo observatório ao mesmo tempo
  const prefixo = opcao ? opcao.id(0).replace(/-op-0$/, "") : "busca";
  return (
    <div className="busca-resultados">
      {grupos.map((g) => (
        // na listbox do campo, cada observatório é um grupo de opções (o título não vira cabeçalho dentro da lista)
        <section
          key={g.observatorio.id}
          role={opcao ? "group" : undefined}
          aria-labelledby={`${prefixo}-obs-${g.observatorio.id}`}
          className="border-t border-linha pt-4 first:border-t-0 first:pt-0"
        >
          <h3 id={`${prefixo}-obs-${g.observatorio.id}`} role={opcao ? "presentation" : undefined} className="rotulo text-mineral">
            {g.observatorio.nome}
          </h3>
          {g.colecoes.map((c) => (
            <div key={c.colecao?.id ?? "_"} className="mt-2">
              {c.colecao && <p className="text-xs text-carvao-muted">{c.colecao.nome}</p>}
              <ul role={opcao ? "presentation" : undefined} className="mt-1">
                {c.resultados.map((r) => {
                  n += 1;
                  const atual = n;
                  const ativa = opcao?.ativa === atual;
                  const corpo = (
                    <>
                      <span className="block text-base leading-snug text-carvao">
                        {r.titulo}
                        {r.href && !comSessao && <SeloComConta href={r.href} />}
                      </span>
                      <span className="mt-0.5 block truncate text-sm text-carvao-muted">
                        <span className="text-mineral">{ROTULO_TIPO[r.tipo]}</span>
                        {r.situacao === "parcial" && <span className="text-mineral"> · cobertura parcial</span>}
                        {r.resumo && <> · {r.resumo}</>}
                      </span>
                    </>
                  );
                  return (
                    <li
                      key={r.id}
                      id={opcao?.id(atual)}
                      role={opcao ? "option" : undefined}
                      aria-selected={opcao ? ativa : undefined}
                      data-ativa={ativa ? "" : undefined}
                    >
                      {r.href ? (
                        <Link
                          href={r.href}
                          prefetch={prefetchDoLink(r.href)}
                          tabIndex={opcao ? -1 : undefined}
                          onClick={opcao?.aoEscolher ? () => opcao.aoEscolher!(r) : undefined}
                          className={`-mx-2 block min-h-[44px] px-2 py-2 motion-safe:transition-colors motion-safe:duration-100 hover:bg-papel ${ativa ? "bg-papel" : ""}`}
                        >
                          {corpo}
                        </Link>
                      ) : (
                        <span className="-mx-2 block min-h-[44px] px-2 py-2 text-carvao-muted">
                          <span className="block text-base leading-snug">
                            {r.titulo} <span className="text-xs text-mineral">ainda sem página</span>
                          </span>
                          {r.resumo && <span className="mt-0.5 block truncate text-sm">{r.resumo}</span>}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
