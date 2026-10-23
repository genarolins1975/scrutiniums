import Link from "next/link";
import { SeloComConta } from "@/components/acesso/SeloComConta";
import { prefetchDoLink } from "@/lib/rotasPublicas";
import type { IndiceBusca } from "@/lib/busca/tipos";

/**
 * Estado vazio da busca quando nada casa (ciclo 2 da busca, bloco 4; diagnóstico de 23/10/2026, achado A5): a busca diz a
 * verdade sobre a cobertura em vez de "Nenhum resultado", e oferece os seis observatórios com a pergunta de cada um, lidos do
 * índice (o mesmo registro da barra), com o selo "com conta" no fechado para quem não tem sessão. A frase é a decidida pelo dono
 * em 23/10/2026 ("A Scrutiniums ainda não cobre…"). Sem estado próprio: serve ao campo (BuscaPlataforma) e à página /buscar.
 */
export function NaoCobre({ termo, indice, comSessao, classe }: { termo: string; indice: IndiceBusca; comSessao: boolean | null; classe?: string }) {
  const observatorios = indice.entradas.filter((e) => e.tipo === "observatorio" && e.href);
  return (
    <div className={classe} data-busca-nao-cobre="">
      <p>
        A Scrutiniums ainda não cobre <q>{termo}</q>. Veja o que cada observatório responde:
      </p>
      <ul className="mt-2">
        {observatorios.map((o) => (
          <li key={o.id}>
            <Link href={o.href!} prefetch={prefetchDoLink(o.href!)} className="-mx-2 block min-h-[44px] px-2 py-2 hover:bg-papel">
              <span className="block text-base leading-snug text-carvao">
                {o.titulo}
                {!comSessao && <SeloComConta href={o.href!} />}
              </span>
              {o.resumo && <span className="mt-0.5 block text-sm text-carvao-muted">{o.resumo}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
