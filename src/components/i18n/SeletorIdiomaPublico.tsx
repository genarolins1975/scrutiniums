"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { pt } from "@/i18n/pt";
import { en } from "@/i18n/en";
import type { Idioma } from "@/lib/idioma";
import { parDeIdioma, traducaoPublicada } from "@/lib/i18n-rotas";
import { urlDaPagina } from "@/lib/i18n-url";

type LeituraUrl = { pathname: string | null; href: string | null };

/** Links disponíveis no SSR; a URL real acrescenta query e fragmento no navegador. */
export function SeletorIdiomaPublico({ idioma = "pt" }: { idioma?: Idioma } = {}) {
  const pathname = usePathname();
  const linkPt = useRef<HTMLAnchorElement>(null);
  const linkEn = useRef<HTMLAnchorElement>(null);
  const [leitura, setLeitura] = useState<LeituraUrl | null>(null);

  const sincronizar = useCallback(() => {
    const { href, origin } = window.location;
    // search/hash separados perderiam os delimitadores vazios de ?, # e ?#.
    const relativo = href.startsWith(origin + "/") ? href.slice(origin.length) : null;
    const par = relativo === null || !traducaoPublicada(relativo) ? null : parDeIdioma(relativo);
    const destinos = {
      pt: par && relativo !== null ? urlDaPagina(relativo, "pt") : null,
      en: par && relativo !== null ? urlDaPagina(relativo, "en") : null,
    };
    // A ação nativa lê o atributo imediatamente, antes de um novo commit React.
    for (const [ref, destino] of [[linkPt, destinos.pt], [linkEn, destinos.en]] as const) {
      if (destino !== null) ref.current?.setAttribute("href", destino);
      else ref.current?.removeAttribute("href");
    }
    setLeitura((anterior) => anterior?.pathname === pathname && anterior.href === relativo
      ? anterior : { pathname, href: relativo });
    return destinos.pt !== null && destinos.en !== null;
  }, [pathname]);

  useEffect(() => {
    sincronizar();
    const eventos = ["popstate", "hashchange", "pageshow"] as const;
    for (const evento of eventos) window.addEventListener(evento, sincronizar);
    return () => {
      for (const evento of eventos) window.removeEventListener(evento, sincronizar);
    };
  }, [sincronizar]);

  function escolher(idioma: Idioma) {
    if (!sincronizar()) return;
    try {
      const secure = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `scrutiniums_idioma=${idioma}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    } catch {
      // A preferência é opcional; cookie bloqueado não impede o link nativo.
    }
  }

  // Uma leitura da página anterior nunca substitui o pathname da nova navegação.
  const atual = leitura?.pathname === pathname ? leitura : null;
  const origem = atual ? atual.href : pathname;
  const par = origem && traducaoPublicada(origem) ? parDeIdioma(origem) : null;
  const destinos = par ? {
    pt: atual ? urlDaPagina(origem ?? "", "pt") : par.pt,
    en: atual ? urlDaPagina(origem ?? "", "en") : par.en,
  } : null;
  if (!destinos?.pt || !destinos.en) return null;
  // rótulos no idioma do cabeçalho que contém o seletor (em inglês só quando o cabeçalho é traduzido)
  const rotulos = idioma === "en"
    ? { portugues: en["idioma.portugues"].texto, ingles: en["idioma.ingles"].texto, seletor: en["idioma.seletor"].texto }
    : { portugues: pt["idioma.portugues"], ingles: pt["idioma.ingles"], seletor: pt["idioma.seletor"] };
  const links = [
    { idioma: "pt", href: destinos.pt, ref: linkPt, rotulo: rotulos.portugues },
    { idioma: "en", href: destinos.en, ref: linkEn, rotulo: rotulos.ingles },
  ] as const;

  return (
    <div role="group" aria-label={rotulos.seletor} className="flex min-w-0 max-w-full basis-full flex-wrap items-center gap-x-3 sm:ml-auto sm:basis-auto">
      <span aria-hidden="true" className="rotulo text-carvao">{rotulos.seletor}</span>
      {links.map(({ idioma, href, ref, rotulo }) => (
        <a
          key={idioma}
          ref={ref}
          href={href}
          hrefLang={idioma === "pt" ? "pt-BR" : "en"}
          className="rotulo inline-flex min-h-[44px] min-w-[44px] items-center justify-center px-1 text-carvao underline underline-offset-4 hover:text-carvao focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carvao"
          onFocus={sincronizar}
          onPointerEnter={sincronizar}
          onPointerDown={sincronizar}
          onContextMenu={sincronizar}
          onClick={(evento) => {
            if (evento.button === 0) escolher(idioma);
            else sincronizar();
          }}
          onAuxClick={(evento) => {
            if (evento.button === 1) escolher(idioma);
            else sincronizar();
          }}
        >
          {rotulo}
        </a>
      ))}
    </div>
  );
}
