/* Camada de apresentação: nenhum cálculo, consulta ou contrato de dados é alterado. */
(() => {
  const main = document.getElementById('main');
  if (!main) return;
  const normaliza = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  function mapaEntrada(mapa) {
    if (!mapa.querySelector('.pagehead') || mapa.querySelector('.obs-hero')) return;
    const hero = document.createElement('section');
    hero.className = 'obs-hero obs-credit-hero';
    hero.setAttribute('aria-labelledby', 'obs-credit-titulo');
    hero.innerHTML = `<div><p class="obs-eyebrow">Painel geral · Crédito brasileiro</p><h1 id="obs-credit-titulo">O crédito, das instituições à vida das pessoas.</h1><p>Recursos, preços e riscos. Entenda como o dinheiro chega a famílias, empresas e territórios, com dados abertos e método verificável.</p><a class="obs-primary" href="/observatorio/overview">Abrir visão geral ↗</a></div><nav aria-label="Por onde começar no Crédito"><p class="obs-eyebrow">Escolha sua pergunta</p><a href="/observatorio/credit">Como está o ciclo do crédito?<span>Estoque, concessões, juros e inadimplência.</span></a><a href="/observatorio/institutions">Quem oferece e a que condições?<span>Instituições, produtos, preços e comparações.</span></a><a href="#mp-perguntas">Onde encontro o dado que preciso?<span>O índice completo, por pergunta e tema.</span></a></nav>`;
    const faixa = document.createElement('dl');
    faixa.className = 'obs-metrics';
    const valores = [
      [String(document.querySelectorAll('#tabs button[data-view]:not([data-view="mapa"])').length), 'páginas temáticas', 'Índice completo de análise'],
      [String(mapa.querySelectorAll('.mapa-no').length), 'etapas do ciclo', 'Do funding à cobrança'],
      [String(mapa.querySelectorAll('.mapa-trilha').length), 'trilhas de leitura', 'Percursos por perfil'],
      [String(mapa.querySelectorAll('#mp-fontes tbody tr').length), 'famílias de fontes', 'Período próprio em cada medida'],
    ];
    for (const [n, rotulo, detalhe] of valores) {
      const item = document.createElement('div');
      for (const [tag, text] of [['dd', n], ['dt', rotulo], ['dd', detalhe]]) { const node = document.createElement(tag); node.textContent = text; item.append(node); }
      faixa.append(item);
    }
    mapa.prepend(hero, faixa);
    mapa.querySelector('.pagehead').classList.add('obs-map-meta');
    const indice = mapa.querySelector('#mp-perguntas');
    if (indice) {
      const search = document.createElement('div');
      search.className = 'obs-index-search';
      search.innerHTML = `<label for="obs-credit-busca">Buscar por assunto ou pergunta</label><div><input id="obs-credit-busca" type="search" placeholder="Ex.: juros, moradia, municípios…"><button type="button">Limpar busca</button></div><p role="status" aria-live="polite"></p>`;
      const rows = Array.from(indice.querySelectorAll('.mapa-perg > div'));
      const status = search.querySelector('[role="status"]');
      const input = search.querySelector('input');
      const filtrar = () => {
        const termos = normaliza(input.value).trim().split(/\s+/).filter(Boolean);
        let n = 0;
        for (const row of rows) { row.hidden = !termos.every(t => normaliza(row.textContent).includes(t)); if (!row.hidden) n++; }
        for (const card of indice.querySelectorAll('.grid > .card')) card.hidden = !Array.from(card.querySelectorAll('.mapa-perg > div')).some(row => !row.hidden);
        status.textContent = n ? `${n} de ${rows.length} perguntas disponíveis` : 'Nenhuma pergunta encontrada. Tente outro assunto ou limpe a busca.';
      };
      input.addEventListener('input', filtrar);
      search.querySelector('button').addEventListener('click', () => { input.value = ''; filtrar(); input.focus(); });
      indice.querySelector('.sechead').after(search);
      filtrar();
    }
  }
  function atualizar() {
    observer.disconnect();
    try {
      for (const head of main.querySelectorAll('.view:not(#view-mapa) .pagehead h2')) {
        const titulo = document.createElement('h1'); titulo.className = head.className;
        titulo.append(...head.childNodes); head.replaceWith(titulo);
      }
      for (const tabela of main.querySelectorAll('.tblwrap')) {
        if ((tabela.scrollWidth > tabela.clientWidth + 1 || tabela.scrollHeight > tabela.clientHeight + 1) && !tabela.hasAttribute('tabindex')) {
          tabela.tabIndex = 0;
          tabela.setAttribute('role', 'region');
          const titulo = tabela.closest('.card')?.querySelector('h4')?.textContent.trim();
          tabela.setAttribute('aria-label', `Tabela rolável${titulo ? ': ' + titulo : ''}. Use as setas para percorrer.`);
        }
      }
      const mapa = document.getElementById('view-mapa');
      if (mapa) mapaEntrada(mapa);
    } finally { observer.observe(main, { childList: true, subtree: true }); }
  }
  const observer = new MutationObserver(atualizar);
  window.addEventListener('resize', atualizar);
  atualizar();
})();
