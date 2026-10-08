"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";

export type ItemIndice = {
  slug: string;
  titulo: string;
  subtitulo?: string;
  texto: string;
  selo?: "em preparação" | "com ressalva";
};
export type GrupoIndice = { id: string; nome: string; itens: ItemIndice[] };

const ESQUEMA = { q: campo(tiposUrl.texto({ max: 80 }), "", { param: "q", historico: "replace" }) };

const normaliza = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

function Cartao({ i }: { i: ItemIndice }) {
  return (
    <Link href={`/setor-eletrico/aprenda/${i.slug}`} className="group flex h-full flex-col border border-linha bg-superficie p-5 transition-colors hover:border-energia">
      <span className="flex items-baseline justify-between gap-3">
        <span className="font-serif text-lg text-carvao">{i.titulo}</span>
        {i.selo && <span className="rotulo !text-[0.62rem] text-aviso">{i.selo}</span>}
      </span>
      {i.subtitulo && <span className="text-sm text-mineral">{i.subtitulo}</span>}
      <span className="mt-2 text-sm leading-relaxed text-carvao-muted">{i.texto}</span>
    </Link>
  );
}

/**
 * Índice dos verbetes: busca por sigla, nome ou texto (guardada em ?q=, para o resultado ser um link) e, sem busca, os grupos
 * recolhidos, cada um com a contagem. A página de 48 cartões abertos tinha 14 telas a 390 px; com os grupos fechados o leitor
 * escolhe o grupo ou digita o termo. Todo cartão está no HTML (os grupos são <details>), então a leitura sem JavaScript,
 * a busca do navegador e a impressão (que abre os grupos) não perdem nenhum verbete. #g-<grupo> abre o grupo.
 */
export function AprendaIndice({ grupos }: { grupos: GrupoIndice[] }) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const termo = normaliza(v.q).trim();
  const todos = useMemo(() => grupos.flatMap((g) => g.itens.map((i) => ({ ...i, grupo: g.nome }))), [grupos]);
  const achados = useMemo(
    () => (termo.length >= 2 ? todos.filter((i) => normaliza(`${i.titulo} ${i.subtitulo ?? ""} ${i.slug} ${i.texto}`).includes(termo)) : null),
    [todos, termo],
  );

  // link com #g-<grupo>: abre o grupo e leva até ele
  useEffect(() => {
    const abre = () => {
      const el = document.getElementById(window.location.hash.slice(1));
      if (el instanceof HTMLDetailsElement) {
        el.open = true;
        el.scrollIntoView();
      }
    };
    abre();
    window.addEventListener("hashchange", abre);
    return () => window.removeEventListener("hashchange", abre);
  }, []);

  return (
    <div>
      <div className="border-t border-linha py-6">
        <label htmlFor="aprenda-busca" className="rotulo block text-mineral">
          Procurar um termo
        </label>
        <input
          id="aprenda-busca"
          type="search"
          value={v.q}
          onChange={(e) => definir({ q: e.target.value })}
          placeholder="Sigla, nome ou palavra: PLD, garantia física, perdas"
          autoComplete="off"
          spellCheck={false}
          aria-describedby="aprenda-busca-contagem"
          className="mt-1 block min-h-[44px] w-full max-w-xl border border-linha bg-superficie px-3 text-sm text-carvao placeholder:text-mineral hover:border-energia"
        />
        <p id="aprenda-busca-contagem" role="status" className="mt-2 text-sm text-carvao-muted">
          {achados
            ? achados.length === 0
              ? "Nenhum verbete tem esse termo no nome, na sigla ou no texto."
              : `${achados.length} ${achados.length === 1 ? "verbete" : "verbetes"} com esse termo.`
            : `${todos.length} verbetes em ${grupos.length} grupos. Abra um grupo ou procure o termo.`}
        </p>
      </div>
      {achados ? (
        achados.length > 0 && (
          <ul className="grid gap-3 border-t border-linha py-6 sm:grid-cols-2 lg:grid-cols-3">
            {achados.map((i) => (
              <li key={i.slug}>
                <Cartao i={i} />
              </li>
            ))}
          </ul>
        )
      ) : (
        grupos.map((g) => (
          <details key={g.id} id={g.id} className="scroll-mt-4 border-t border-linha">
            <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-4 py-2 [&::-webkit-details-marker]:hidden">
              <span className="min-w-0">
                <h2 className="rotulo text-mineral">{g.nome}</h2>
                <span className="block text-sm leading-snug text-carvao-muted" data-previa="true">
                  {g.itens.map((i) => i.titulo).join(", ")}
                </span>
              </span>
              <span className="shrink-0 whitespace-nowrap text-sm text-carvao-muted">
                {g.itens.length} {g.itens.length === 1 ? "verbete" : "verbetes"} <span aria-hidden="true">▾</span>
              </span>
            </summary>
            <ul className="grid gap-3 pb-6 pt-2 sm:grid-cols-2 lg:grid-cols-3">
              {g.itens.map((i) => (
                <li key={i.slug}>
                  <Cartao i={i} />
                </li>
              ))}
            </ul>
          </details>
        ))
      )}
    </div>
  );
}
