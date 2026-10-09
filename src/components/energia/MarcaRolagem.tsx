"use client";

import { useEffect } from "react";

/**
 * Marca com data-rolavel="sim" ou "nao" cada contêiner de tabela rolável (div.tabela-scroll) conforme ele rola de fato na horizontal. A sombra
 * de borda do contêiner (globals.css) só aparece quando a marca é "sim": antes ela era pintada em todo contêiner e, onde o fundo não era o da
 * superfície, deixava uma mancha branca nas duas bordas de uma tabela que não rolava. Um observador de tamanho acompanha a largura da janela e
 * a do conteúdo; um observador de mutação pega as tabelas montadas depois (sob demanda, filtros, mudança de nível). Sem JavaScript, não há sombra.
 */
export function MarcaRolagem() {
  useEffect(() => {
    const marcar = (el: HTMLElement) => {
      el.dataset.rolavel = el.scrollWidth > el.clientWidth + 2 ? "sim" : "nao";
    };
    const alvos = new WeakMap<Element, HTMLElement>();
    const ro = new ResizeObserver((entradas) => {
      for (const e of entradas) {
        const el = alvos.get(e.target);
        if (el) marcar(el);
      }
    });
    const varrer = () => {
      document.querySelectorAll<HTMLElement>("div.tabela-scroll").forEach((el) => {
        if (alvos.has(el)) return;
        alvos.set(el, el);
        ro.observe(el);
        const conteudo = el.firstElementChild;
        if (conteudo) {
          alvos.set(conteudo, el);
          ro.observe(conteudo);
        }
        marcar(el);
      });
    };
    varrer();
    const mo = new MutationObserver(varrer);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, []);
  return null;
}
