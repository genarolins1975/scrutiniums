/** Resolve apenas âncoras do documento atual, preservando links externos e modificadores. */
export function ancoraDoDocumento(href: string, atual: string): string | null {
  const origem = new URL(atual);
  const destino = new URL(href, origem);
  return destino.origin === origem.origin && destino.pathname === origem.pathname && destino.search === origem.search
    ? destino.hash || null : null;
}

/** Inclui cliques repetidos no mesmo hash, que não disparam hashchange. */
export function observarAncoras(abrir: (hash: string) => void) {
  const atualizar = () => abrir(window.location.hash);
  const clicar = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
    if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
    const hash = ancoraDoDocumento(link.href, window.location.href);
    if (hash) abrir(hash);
  };
  atualizar();
  window.addEventListener('hashchange', atualizar);
  window.addEventListener('popstate', atualizar);
  document.addEventListener('click', clicar);
  return () => {
    window.removeEventListener('hashchange', atualizar);
    window.removeEventListener('popstate', atualizar);
    document.removeEventListener('click', clicar);
  };
}

export function guardarAncora(hash: string) {
  window.history.replaceState(window.history.state, '', hash);
}
