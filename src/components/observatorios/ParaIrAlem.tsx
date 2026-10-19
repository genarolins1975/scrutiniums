"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SeloComConta } from "@/components/acesso/SeloComConta";
import type { MapaParaIrAlem } from "@/lib/observatorios/mapaParaIrAlem";

/** Painel dono do endereço: ele mesmo ou o painel mais próximo acima dele (como donoDaRota). */
function dono(mapa: MapaParaIrAlem, caminho: string) {
  const porRota = new Map(mapa.paineis.map((p) => [p.rota, p]));
  let atual = caminho.length > 1 && caminho.endsWith("/") ? caminho.slice(0, -1) : caminho;
  atual = atual.replace(/^\/en(?=\/)/, "");
  while (atual) {
    const p = porRota.get(atual);
    if (p) return p;
    const corte = atual.lastIndexOf("/");
    if (corte <= 0) return null;
    atual = atual.slice(0, corte);
  }
  return null;
}

/**
 * Bloco "Para ir além" no fim dos painéis: o observatório e a coleção do
 * painel corrente, as outras coleções do mesmo observatório e os observatórios
 * em que ele também aparece como atalho. Navegação complementar, montada no
 * navegador depois do carregamento; o conteúdo do painel não depende dele.
 * Numa consulta aberta, destino que pede conta leva o selo "com conta" antes do clique.
 */
export function ParaIrAlem({ mapa }: Readonly<{ mapa: MapaParaIrAlem }>) {
  const caminho = usePathname();
  const [pronto, setPronto] = useState(false);
  useEffect(() => setPronto(true), []);
  if (!pronto || !caminho) return null;
  const p = dono(mapa, caminho);
  if (!p) return null;
  const o = mapa.observatorios.find((x) => x.id === p.observatorio);
  if (!o) return null;
  const colecao = o.colecoes.find((c) => c.id === p.colecao);
  const outras = o.colecoes.filter((c) => c.id !== p.colecao);
  const tambem = mapa.atalhos.filter((a) => a.rota === p.rota).flatMap((a) => {
    const ox = mapa.observatorios.find((x) => x.id === a.observatorio);
    const cx = ox?.colecoes.find((c) => c.id === a.colecao);
    return ox && cx ? [{ observatorio: ox, colecao: cx }] : [];
  });
  return (
    <aside aria-labelledby="para-ir-alem" className="border-t border-linha bg-papel">
      <div className="mx-auto max-w-page px-6 py-8">
        <h2 id="para-ir-alem" className="rotulo text-mineral">Para ir além</h2>
        <p className="mt-3 text-sm leading-relaxed text-carvao">
          Este painel está no{" "}
          <Link href={o.destino} prefetch={false} className="underline decoration-linha underline-offset-4 hover:decoration-carvao">{o.nome}<SeloComConta href={o.destino} /></Link>
          {colecao && <>, coleção {colecao.nome}</>}.
        </p>
        {outras.length > 0 && (
          <p className="mt-2 text-sm leading-relaxed text-carvao-muted">
            No mesmo observatório:{" "}
            {outras.map((c, i) => (
              <span key={c.id}>
                {i > 0 && " · "}
                <Link href={c.href} prefetch={false} className="inline-flex min-h-[44px] items-center text-carvao underline decoration-linha underline-offset-4">{c.nome}<SeloComConta href={c.href} /></Link>
              </span>
            ))}
          </p>
        )}
        {tambem.length > 0 && (
          <p className="mt-1 text-sm leading-relaxed text-carvao-muted">
            Também aparece em:{" "}
            {tambem.map((t, i) => (
              <span key={t.observatorio.id}>
                {i > 0 && " · "}
                <Link href={t.observatorio.destino} prefetch={false} className="inline-flex min-h-[44px] items-center text-carvao underline decoration-linha underline-offset-4">{t.observatorio.nome}<SeloComConta href={t.observatorio.destino} /></Link>
                {", "}{t.colecao.nome}
              </span>
            ))}
          </p>
        )}
      </div>
    </aside>
  );
}
