"use client";

import { SeloProntidao } from "@/components/observatorios/SeloProntidao";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, type ComponentProps, type MouseEvent, type ReactNode } from "react";
import { ACENTO } from "@/components/home/acentos";
import { SeloComConta } from "@/components/acesso/SeloComConta";
import { AtivoVisivel } from "@/components/layout/AtivoVisivel";
import { DetalhesFechaveis } from "@/components/layout/DetalhesFechaveis";
import { hrefNoIdioma } from "@/lib/i18n-href";
import type { Idioma } from "@/lib/idioma";
import { prefetchDoLink } from "@/lib/rotasPublicas";
import { destinoAtual, dividirItens, type AtalhosNav, type NavegacaoDaColecao, type PaginaNav } from "@/lib/observatorios/navegacaoPura";

const tx = (pt: string, en: string, idioma: Idioma) => (idioma === "en" ? en : pt);

/** Parâmetros do recorte que um clique leva à página seguinte (`levar` do catálogo); vazio quando a coleção não tem. */
const LevarContexto = createContext<readonly string[]>([]);

const ROTULO_ATALHO: Record<keyof AtalhosNav, [string, string]> = {
  dados: ["Dados", "Data"],
  metodo: ["Método", "Method"],
  glossario: ["Glossário", "Glossary"],
};

/**
 * Corpo da navegação de coleção (NavegacaoColecao, que o monta no servidor). O destino atual se resolve aqui, a cada
 * navegação, porque a navegação muitas vezes mora num layout que o Next não refaz entre páginas irmãs; no HTML do servidor
 * vale o endereço da renderização (`caminho`), então a primeira tela já sai marcada, inclusive sem JavaScript.
 */
export function NavegacaoColecaoCliente({
  nav,
  caminho,
  atual: atualFixo,
  idioma,
  acoes,
}: {
  nav: NavegacaoDaColecao;
  caminho: string | null;
  atual?: string;
  idioma: Idioma;
  acoes?: ReactNode;
}) {
  const navegador = usePathname();
  const atual = destinoAtual(nav, atualFixo ?? navegador ?? caminho);
  const { aVista, mais } = dividirItens(nav.itens, atual.item);
  const corrente = atual.item >= 0 ? nav.itens[atual.item] : null;
  const subpaginas = corrente?.subpaginas?.length ? corrente.subpaginas : null;
  const filete = ACENTO[nav.acento].filete;
  const h = (href: string) => hrefNoIdioma(href, idioma);
  const atalhos = (["dados", "metodo", "glossario"] as const).filter((k) => nav.atalhos[k]);
  const idLinha1 = `nav-colecao-${nav.id}`;
  const idLinha2 = `nav-colecao-${nav.id}-paginas`;
  const rotulo =
    nav.tipo === "colecao"
      ? tx(`Navegação da coleção ${nav.nome}`, `${nav.nome} collection navigation`, idioma)
      : nav.tipo === "observatorio"
        ? tx(`Navegação do observatório ${nav.nome}`, `${nav.nome} observatory navigation`, idioma)
        : tx("Navegação da conta", "Account navigation", idioma);

  const atalho = (k: keyof AtalhosNav, extra = "") => {
    const href = nav.atalhos[k] as string;
    return (
      <Destino
        key={k}
        p={{ rotulo: tx(ROTULO_ATALHO[k][0], ROTULO_ATALHO[k][1], idioma), href, publicado: true }}
        href={h(href)}
        ativo={atual.atalho === k && !atual.abaixoDoAtalho}
        grupoAtivo={atual.atalho === k && !!atual.abaixoDoAtalho}
        filete={filete}
        idioma={idioma}
        className={extra}
      />
    );
  };

  return (
    <LevarContexto.Provider value={nav.levar ?? []}>
    <nav aria-label={rotulo} className="nav-colecao border-b border-linha bg-superficie" data-nav-colecao={nav.id}>
      {/* -ml-3: o texto do primeiro item fica na margem da barra e da trilha (o item tem 12 px de respiro) */}
      <div className="nav-colecao-caixa flex items-stretch gap-x-2">
        <ul id={idLinha1} className="nav-colecao-faixa -ml-3 flex min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {aVista.map(({ item, i }) => (
            <li key={item.href || item.rotulo} className="shrink-0">
              <Destino p={item} href={h(item.href)} ativo={atual.item === i && atual.sub === null} grupoAtivo={atual.item === i && atual.sub !== null} filete={filete} idioma={idioma} />
            </li>
          ))}
          {/* no celular nada se esconde em "Mais": a faixa rola, e os atalhos vêm no fim dela */}
          {mais.map(({ item, i }) => (
            <li key={`m-${item.href || item.rotulo}`} className="shrink-0 sm:hidden">
              <Destino p={item} href={h(item.href)} ativo={atual.item === i} filete={filete} idioma={idioma} />
            </li>
          ))}
          {atalhos.map((k) => (
            <li key={`a-${k}`} className="shrink-0 sm:hidden">
              {atalho(k)}
            </li>
          ))}
          {/* as ações (o "Sair" da conta) também vêm no fim da faixa no celular, sem uma linha só para elas */}
          {acoes && <li className="flex shrink-0 sm:hidden">{acoes}</li>}
          {nav.estado && (
            <li className="flex shrink-0 items-center sm:hidden">
              <span className="px-3"><SeloProntidao valor={nav.estado} idioma={idioma === "en" ? "en" : "pt"} /></span>
            </li>
          )}
        </ul>
        {mais.length > 0 && (
          <DetalhesFechaveis className="group relative hidden shrink-0 sm:block">
            <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 whitespace-nowrap px-3 text-sm text-carvao-muted hover:text-carvao [&::-webkit-details-marker]:hidden">
              {tx("Mais", "More", idioma)}
              <span aria-hidden="true" className="text-xs motion-safe:transition-transform motion-safe:duration-150 group-open:rotate-180">
                ▾
              </span>
            </summary>
            <ul className="absolute right-0 top-full z-40 mt-px hidden w-72 border border-linha bg-superficie py-1 shadow-[0_8px_24px_rgba(26,29,33,0.12)] group-open:block">
              {mais.map(({ item, i }) => (
                <li key={item.href || item.rotulo}>
                  <Destino p={item} href={h(item.href)} ativo={atual.item === i} filete={filete} idioma={idioma} noMenu />
                </li>
              ))}
            </ul>
          </DetalhesFechaveis>
        )}
        {nav.estado && <span className="hidden shrink-0 self-center px-2 sm:inline"><SeloProntidao valor={nav.estado} idioma={idioma === "en" ? "en" : "pt"} /></span>}
        {(atalhos.length > 0 || acoes) && (
          <div className="-mr-3 hidden shrink-0 items-stretch gap-x-1 border-l border-linha pl-2 sm:flex">
            {atalhos.map((k) => atalho(k))}
            {acoes}
          </div>
        )}
      </div>
      {subpaginas && corrente && (
        <div className="border-t border-linha bg-papel">
          <div className="nav-colecao-caixa">
            <ul id={idLinha2} aria-label={tx(`Páginas de ${corrente.rotulo}`, `Pages in ${corrente.rotulo}`, idioma)} className="nav-colecao-faixa -ml-3 flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {subpaginas.map((s, j) => (
                <li key={s.href} className="shrink-0">
                  <Destino p={s} href={h(s.href)} ativo={atual.sub === j} filete={filete} idioma={idioma} menor />
                </li>
              ))}
            </ul>
          </div>
          <AtivoVisivel alvo={idLinha2} chave={`${atual.item}:${atual.sub}`} />
        </div>
      )}
      <AtivoVisivel alvo={idLinha1} chave={`${atual.item}:${atual.atalho}`} />
    </nav>
    </LevarContexto.Provider>
  );
}

/** Um destino: link com o filete do acento quando é o atual; sem página, texto "em preparação". */
function Destino({
  p,
  href,
  ativo,
  grupoAtivo = false,
  filete,
  idioma = "pt",
  noMenu = false,
  menor = false,
  className = "",
}: {
  p: PaginaNav;
  href: string;
  ativo: boolean;
  grupoAtivo?: boolean;
  filete: string;
  idioma?: Idioma;
  noMenu?: boolean;
  menor?: boolean;
  className?: string;
}) {
  const levar = useContext(LevarContexto);
  const altura = menor ? "min-h-[44px] sm:min-h-[40px]" : "min-h-[44px]";
  const base = noMenu ? `flex ${altura} w-full items-center gap-2 px-4 text-sm` : `relative flex ${altura} items-center gap-1 whitespace-nowrap px-3 text-sm`;
  if (!p.publicado)
    return (
      <span className={`${base} text-mineral ${className}`}>
        {p.rotulo}
        <SeloProntidao valor="preparacao" idioma={idioma === "en" ? "en" : "pt"} />
      </span>
    );
  const marcado = ativo || grupoAtivo;
  const props = {
    href,
    prefetch: prefetchDoLink(p.href),
    "aria-current": ativo ? ("page" as const) : undefined,
    "data-atual": marcado ? "" : undefined,
    className: `${base} motion-safe:transition-colors motion-safe:duration-150 ${marcado ? "text-carvao" : "text-carvao-muted hover:text-carvao"} ${noMenu && ativo ? "bg-papel" : noMenu ? "hover:bg-papel" : ""} ${className}`,
  };
  const corpo = (
    <>
      {p.rotulo}
      {grupoAtivo && <span className="sr-only">{tx(" (grupo da página atual)", " (group of the current page)", idioma)}</span>}
      <SeloComConta href={p.href} />
      {marcado && !noMenu && <span aria-hidden="true" className={`absolute inset-x-3 bottom-0 h-0.5 ${filete}`} />}
    </>
  );
  return levar.length ? (
    <LinkComRecorte levar={levar} {...props}>
      {corpo}
    </LinkComRecorte>
  ) : (
    <Link {...props}>{corpo}</Link>
  );
}

/**
 * Link de uma coleção com `levar`: o recorte (capital, UF, nível) acompanha o leitor de uma aba a outra. Sem JavaScript, ou
 * com Ctrl/Cmd, o link leva à página sem recorte, que abre no padrão dela.
 */
function LinkComRecorte({ levar, href, ...resto }: { levar: readonly string[]; href: string; children: ReactNode } & Omit<ComponentProps<typeof Link>, "href">) {
  const router = useRouter();
  const comRecorte = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const agora = new URLSearchParams(window.location.search);
    const q = new URLSearchParams();
    for (const k of levar) {
      const v = agora.get(k);
      if (v) q.set(k, v);
    }
    if (!q.size) return;
    e.preventDefault();
    router.push(`${href}?${q.toString()}`);
  };
  return <Link href={href} onClick={comRecorte} {...resto} />;
}
