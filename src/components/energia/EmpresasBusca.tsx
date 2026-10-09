"use client";

import Link from "@/components/energia/LinkSemPrefetch";
import { useId, useMemo, useState } from "react";
import type { EntidadeEmpresa } from "@/lib/energia/empresas";
import { num } from "@/lib/energia/formato";
import { buscarEntidades } from "@/lib/energia/tabela";

/**
 * Busca de uma empresa pela abertura de Empresas: nome, sigla, CNPJ (com ou sem pontuação) ou código da CVM. Cada resultado leva
 * ao que é útil sobre a empresa, e não a um relatório de cobertura: a ficha da distribuidora (perdas, continuidade, tarifa, controle
 * e demonstrações), as demonstrações da companhia na CVM já com ela escolhida ou a árvore de controle do grupo.
 *
 * A lista de entidades vem pronta do servidor (uma por CNPJ, com os destinos), a busca é local, ignora acento e caixa e mostra até
 * seis resultados; a contagem fica numa região viva. Empresas fora das listas estão na busca da árvore de controle, que lê o arquivo
 * inteiro da cadeia societária.
 */
const MAXIMO = 6;

export function EmpresasBusca({
  entidades,
  hrefArvore,
  total,
}: {
  entidades: EntidadeEmpresa[];
  /** Busca da árvore de controle, que cobre todas as empresas do grafo societário. */
  hrefArvore: string;
  /** Quantas empresas a busca cobre (texto de ajuda). */
  total: number;
}) {
  const id = useId();
  const [texto, setTexto] = useState("");
  const consulta = texto.trim();
  const r = useMemo(() => (consulta.length >= 2 ? buscarEntidades(entidades, consulta, MAXIMO) : null), [entidades, consulta]);

  return (
    <div role="search" data-busca-empresa="" className="space-y-2">
      <label htmlFor={id} className="block text-sm text-carvao-muted">
        Nome, sigla ou CNPJ
      </label>
      <input
        id={id}
        type="search"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Por exemplo: CEMIG, 17.155.730/0001-64 ou Itaipu"
        className="min-h-[44px] w-full max-w-xl border border-linha bg-superficie px-3 text-carvao"
        autoComplete="off"
        aria-describedby={`${id}-ajuda`}
      />
      <p id={`${id}-ajuda`} role="status" aria-live="polite" className="text-xs leading-relaxed text-carvao-muted">
        {r
          ? r.total
            ? `${r.total} ${r.total === 1 ? "empresa encontrada" : "empresas encontradas"}${r.total > r.itens.length ? `; mostrando ${r.itens.length}, refine a busca` : ""}.`
            : "Nenhuma empresa com esse nome, sigla ou CNPJ entre as listadas. Para outras empresas do grafo societário, use a busca da árvore de controle."
          : consulta.length === 1
            ? "Digite ao menos duas letras ou dois números."
            : `Entre ${num(total, 0)} empresas: distribuidoras, companhias abertas, maiores donos de usinas e grupos de controle. O resultado abre a ficha da distribuidora, as demonstrações da companhia na CVM ou a árvore de controle do grupo.`}
      </p>
      {r && r.itens.length > 0 && (
        <ul className="divide-y divide-linha border-y border-linha">
          {r.itens.map((e) => (
            <li key={e.id} className="py-2">
              <p className="text-base leading-snug text-carvao">{e.rotulo}</p>
              <p className="text-xs leading-relaxed text-carvao-muted">{e.detalhe}</p>
              <ul className="mt-0.5 flex flex-wrap gap-x-5">
                {e.destinos.map((d) => (
                  <li key={d.href}>
                    <Link href={d.href} className="inline-flex min-h-[44px] items-center text-sm text-energia-dark underline underline-offset-4 hover:text-carvao">
                      {d.rotulo}
                      <span className="sr-only"> de {e.rotulo}</span>
                      <span aria-hidden="true" className="ml-1.5">
                        →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      {r && (
        <p className="text-sm">
          <Link href={hrefArvore} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
            Buscar outra empresa na árvore de controle, que cobre todo o grafo societário
          </Link>
        </p>
      )}
    </div>
  );
}
