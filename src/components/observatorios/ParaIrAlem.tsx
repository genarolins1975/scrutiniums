"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SeloComConta } from "@/components/acesso/SeloComConta";
import { Nome } from "@/components/i18n/Nome";
import { hrefNoIdioma } from "@/lib/i18n-href";
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
 * em que ele também aparece como atalho. Vem já no HTML do servidor (Iniciativa 2 do parecer de UX de 21/10/2026: antes só
 * aparecia depois de montar no navegador); o navegador só refaz o bloco a cada navegação, porque ele mora num layout que o
 * Next não refaz entre páginas irmãs, e acrescenta o selo, que depende da sessão.
 * Numa consulta aberta, destino que pede conta leva o selo "com conta" antes do clique.
 */
export function ParaIrAlem({ mapa }: Readonly<{ mapa: MapaParaIrAlem }>) {
  const caminho = usePathname();
  if (!caminho) return null;
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
  // na irmã inglesa (/en) o bloco fala inglês; os nomes do registro ficam em português, marcados (Nome), e os links levam à
  // irmã /en só onde há tradução publicada
  const en = caminho === "/en" || caminho.startsWith("/en/");
  const t = (pt: string, ing: string) => (en ? ing : pt);
  const h = (href: string) => hrefNoIdioma(href, en ? "en" : "pt");
  const link = "inline-flex min-h-[44px] items-center text-carvao underline decoration-linha underline-offset-4";
  return (
    <aside aria-labelledby="para-ir-alem" className="border-t border-linha bg-papel">
      <div className="mx-auto max-w-page px-6 py-8">
        <h2 id="para-ir-alem" className="rotulo text-mineral">{t("Para ir além", "Further reading")}</h2>
        <p className="mt-3 text-sm leading-relaxed text-carvao">
          {t("Este painel está no ", "This panel belongs to the ")}
          <Link href={h(o.destino)} prefetch={false} className="underline decoration-linha underline-offset-4 hover:decoration-carvao"><Nome>{o.nome}</Nome><SeloComConta href={o.destino} /></Link>
          {colecao && <>{t(", coleção ", ", collection ")}<Nome>{colecao.nome}</Nome></>}.
        </p>
        {outras.length > 0 && (
          <p className="mt-2 text-sm leading-relaxed text-carvao-muted">
            {t("No mesmo observatório: ", "In the same observatory: ")}
            {outras.map((c, i) => (
              <span key={c.id}>
                {i > 0 && " · "}
                <Link href={h(c.href)} prefetch={false} className={link}><Nome>{c.nome}</Nome><SeloComConta href={c.href} /></Link>
              </span>
            ))}
          </p>
        )}
        {tambem.length > 0 && (
          <p className="mt-1 text-sm leading-relaxed text-carvao-muted">
            {t("Também aparece em: ", "Also listed in: ")}
            {tambem.map((x, i) => (
              <span key={x.observatorio.id}>
                {i > 0 && " · "}
                <Link href={h(x.observatorio.destino)} prefetch={false} className={link}><Nome>{x.observatorio.nome}</Nome><SeloComConta href={x.observatorio.destino} /></Link>
                {", "}<Nome>{x.colecao.nome}</Nome>
              </span>
            ))}
          </p>
        )}
      </div>
    </aside>
  );
}
