"use client";

import { useEffect } from "react";

/**
 * Libera o conteúdo depois que o painel leu o recorte da URL. O HTML estático traz o recorte padrão; um link com recorte
 * (?cap=…&med=…) só mostra os números pedidos depois da hidratação. Até lá o script do layout esconde o conteúdo, para que
 * ninguém leia, nem copie, o número do recorte errado. Sem JavaScript o script não roda e o recorte padrão fica à vista,
 * com o aviso do rodapé do painel.
 */
export function LiberaRecorte() {
  useEffect(() => {
    document.documentElement.removeAttribute("data-recorte");
  }, []);
  return null;
}

/** Parâmetros que mudam o que o painel mostra; qualquer outro (utm_*, âncoras) não esconde nada. */
export const PARAMETROS_DO_RECORTE = ["cap", "reg", "med", "ano", "etapa", "moeda", "disc", "vis", "ord", "eixo", "grp", "dest", "vc", "ot", "od"];

/** Script embutido: marca o recorte pendente antes da primeira pintura e libera por prazo, se a hidratação falhar. */
export const SCRIPT_RECORTE = `(function(){try{var q=location.search;if(!q)return;var p=new URLSearchParams(q);var ks=${JSON.stringify(PARAMETROS_DO_RECORTE)};for(var i=0;i<ks.length;i++){if(p.has(ks[i])){document.documentElement.setAttribute("data-recorte","pendente");setTimeout(function(){document.documentElement.removeAttribute("data-recorte")},5000);return}}}catch(e){}})();`;
