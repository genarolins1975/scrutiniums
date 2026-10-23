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
    hero.innerHTML = `<div><p class="obs-eyebrow">Painel geral · Crédito brasileiro</p><h1 id="obs-credit-titulo">Crédito no Brasil: volume, custo e risco.</h1><p>Acompanhe o crédito a famílias e empresas, compare instituições e explore diferenças entre regiões. Cada painel informa a fonte, o período e os limites dos dados.</p><a class="obs-primary" href="/observatorio/overview">Abrir visão geral ↗</a></div><nav aria-label="Por onde começar no Crédito"><p class="obs-eyebrow">Escolha sua pergunta</p><a href="/observatorio/credit">Como está o ciclo do crédito?<span>Estoque, concessões, juros e inadimplência.</span></a><a href="/observatorio/institutions">Quem oferece e a que condições?<span>Instituições, produtos, preços e comparações.</span></a><a href="#mp-perguntas">Onde encontro o dado que preciso?<span>O índice completo, por pergunta e tema.</span></a></nav>`;
    const faixa = document.createElement('dl');
    faixa.className = 'obs-metrics';
    const valores = [
      // o app.js conta as páginas dos grupos do Crédito ao desenhar o Início do painel (a barra lateral, de onde vinha a conta, saiu)
      [mapa.dataset.paginas || String(mapa.querySelectorAll('#mp-perguntas .mapa-perg > div').length), 'páginas temáticas', 'Índice completo de análise'],
      [String(mapa.querySelectorAll('.mapa-no').length), 'etapas do ciclo', 'Do funding à cobrança'],
      [String(mapa.querySelectorAll('.mapa-trilha').length), 'trilhas de leitura', 'Percursos por perfil'],
      [String(mapa.querySelectorAll('#mp-fontes tbody tr').length), 'famílias de fontes', 'Período próprio em cada medida'],
    ];
    for (const [n, rotulo, detalhe] of valores) {
      const item = document.createElement('div');
      for (const [tag, text] of [['dd', n], ['dt', rotulo], ['dd', detalhe]]) { const node = document.createElement(tag); node.textContent = text; item.append(node); }
      faixa.append(item);
    }
    // o rótulo de contexto da plataforma ("Observatório da Economia · Crédito e sistema financeiro · Início do painel"), que o
    // app.js põe no cabeçalho da página, sobe para o lugar do rótulo escrito à mão acima do título (Iniciativa 2 do parecer de UX
    // de 23/10/2026); sem ele (embed), fica o de sempre
    const rotulo = mapa.querySelector('.pagehead [data-rotulo-contexto]');
    if (rotulo) hero.querySelector('.obs-eyebrow').replaceWith(rotulo.closest('.casca') || rotulo);
    mapa.prepend(hero, faixa);
    mapa.querySelector('.pagehead').classList.add('obs-map-meta');
    const indice = mapa.querySelector('#mp-perguntas');
    if (indice) {
      const search = document.createElement('div');
      search.className = 'obs-index-search';
      search.innerHTML = `<label for="obs-credit-busca">Buscar por assunto ou pergunta</label><div><input id="obs-credit-busca" type="search" placeholder="Ex.: juros, moradia, municípios…"><button type="button">Limpar busca</button></div><p role="status" aria-live="polite"></p>`;
      const rows = Array.from(indice.querySelectorAll('.mapa-perg > div'));
      for (const card of indice.querySelectorAll('.grid > .card')) {
        const titulo = card.querySelector('h4');
        const lista = card.querySelector('.mapa-perg');
        if (!titulo || !lista) continue;
        const detalhes = document.createElement('details'); detalhes.className = 'obs-index-group';
        const resumo = document.createElement('summary');
        const contador = document.createElement('span'); contador.className = 'obs-index-count';
        contador.textContent = `${lista.children.length} perguntas`;
        const seta = document.createElement('span'); seta.className = 'obs-index-arrow'; seta.textContent = '▾'; seta.setAttribute('aria-hidden', 'true');
        resumo.append(titulo, contador, seta); detalhes.append(resumo, lista); card.append(detalhes);
      }
      const status = search.querySelector('[role="status"]');
      const input = search.querySelector('input');
      const filtrar = () => {
        const termos = normaliza(input.value).trim().split(/\s+/).filter(Boolean);
        let n = 0;
        for (const row of rows) { row.hidden = !termos.every(t => normaliza(row.textContent).includes(t)); if (!row.hidden) n++; }
        for (const card of indice.querySelectorAll('.grid > .card')) {
          card.hidden = !Array.from(card.querySelectorAll('.mapa-perg > div')).some(row => !row.hidden);
          const detalhes = card.querySelector('.obs-index-group');
          if (detalhes) detalhes.open = termos.length > 0 && !card.hidden;
        }
        status.textContent = n ? `${n} de ${rows.length} perguntas disponíveis` : 'Nenhuma pergunta encontrada. Tente outro assunto ou limpe a busca.';
      };
      input.addEventListener('input', filtrar);
      search.querySelector('button').addEventListener('click', () => { input.value = ''; filtrar(); input.focus(); });
      indice.querySelector('.sechead').after(search);
      filtrar();
    }
  }
  /* Diagnóstico de layout de 20/10/2026, item 2: o número vem antes do método. A caixa de leitura que o cabeçalho
     comum escreve logo abaixo do título desce para depois do primeiro bloco de números da aba (a abertura padrão,
     com placar e síntese, ou a primeira faixa de números, .kpirow ou .pan-kpi), desde que nenhum título de seção
     fique entre os dois. Quando a síntese vem logo depois da faixa (Pix, Panorama), a caixa desce também abaixo dela.
     O aviso de fonte em pane continua acima dos números: é ressalva sobre eles. Sem bloco de números, nada muda. */
  function guiaDepoisDosNumeros(view) {
    const guia = view.querySelector('.guia-leitura');
    if (!guia) return;
    const depois = el => guia.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING;
    // em ordem de documento: a abertura padrão vem antes da faixa de números que ela contém
    const bloco = Array.from(view.querySelectorAll('.abertura, .kpirow, .pan-kpi')).find(el => depois(el) && !el.closest('.card, details'));
    if (!bloco) return;
    const entre = Array.from(view.querySelectorAll('h3')).some(h => depois(h) && (h.compareDocumentPosition(bloco) & Node.DOCUMENT_POSITION_FOLLOWING));
    if (entre) return;
    let ancora = bloco;
    while (ancora.nextElementSibling?.matches('.pan-sintese, .pan-sintese + .src')) ancora = ancora.nextElementSibling;
    ancora.after(guia);
  }
  function indiceDaPagina(view) {
    if (view.id === 'view-mapa' || !view.querySelector('.pagehead')) return;
    const titulos = Array.from(view.querySelectorAll('h3')).filter(h =>
      !h.closest('.card, .guia, .obs-page-index, details') && h.textContent.trim());
    const anterior = view.querySelector('.obs-page-index');
    const assinatura = titulos.map(h => h.textContent.trim()).join('|');
    if (anterior?.dataset.assinatura === assinatura) return;
    anterior?.remove();
    if (titulos.length < 4) return;
    const indice = document.createElement('details');
    indice.className = 'obs-page-index'; indice.dataset.assinatura = assinatura;
    const summary = document.createElement('summary');
    summary.textContent = `Nesta página · ${titulos.length} seções`;
    const nav = document.createElement('nav'); nav.setAttribute('aria-label', 'Seções desta página');
    titulos.forEach((h, i) => {
      if (!h.id) h.id = `${view.id}-secao-${i + 1}`;
      const link = document.createElement('a');
      link.href = '#' + h.id;
      // Os selos e controles permanecem no título original, fora do índice.
      const texto = h.cloneNode(true);
      texto.querySelectorAll('.seal, .chip, button, select, .fav-star').forEach(n => n.remove());
      link.textContent = texto.textContent.trim();
      link.addEventListener('click', event => {
        event.preventDefault(); h.tabIndex = -1;
        h.scrollIntoView({ block: 'start' }); h.focus({ preventScroll: true });
      });
      nav.append(link);
    });
    indice.append(summary, nav);
    (view.querySelector('.guia-leitura') || view.querySelector('.pagehead')).after(indice);
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
      for (const view of main.querySelectorAll('.view.active')) { guiaDepoisDosNumeros(view); indiceDaPagina(view); }
      const mapa = document.getElementById('view-mapa');
      if (mapa) {
        mapaEntrada(mapa);
        // The core owns the data; the atlas only reads its published metadata.
        window.CreditAtlas?.enhance(mapa, typeof state === 'undefined' ? {} : state.data.meta || {},
          typeof GUIA === 'undefined' || typeof ROUTES === 'undefined' ? {} : Object.fromEntries(Object.entries(GUIA).filter(([v]) => ROUTES[v]).map(([v, g]) => ['/observatorio' + ROUTES[v], g.q])));
      }
    } finally { observer.observe(main, { childList: true, subtree: true }); }
  }
  const observer = new MutationObserver(atualizar);
  window.addEventListener('resize', atualizar);
  atualizar();
})();


