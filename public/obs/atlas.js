/* Atlas do crédito: apresentação progressiva do mapa existente.
 * Não altera gold, filtros, rotas, forecasts ou scores. O laboratório usa apenas
 * hipóteses locais do visitante e nunca grava em state.data ou localStorage.
 */
(() => {
  'use strict';
  const fixed = (v, digits = 2) => v.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const STAGES = [
    ['Origem dos recursos', 'Mecanismo de captação bancária', ['Depósitos', 'Títulos emitidos', 'Outras captações'], 'Funding bancário', 'Recursos para a intermediação'],
    ['Quem empresta', 'Lentes para examinar instituições', ['Capital e resultado', 'Rede e pessoas', 'Entrada e saída do SFN'], 'Instituições', 'Comparar o mesmo perímetro'],
    ['Produto e preço', 'Dimensões da operação', ['Modalidade e finalidade', 'Taxa de juros', 'Prazo e garantias'], 'Contrato de crédito', 'Preço e estrutura da operação'],
    ['Pessoas e território', 'Recortes de exploração', ['Famílias e empresas', 'Estados e municípios', 'Moradia, renda e emprego'], 'Acesso ao crédito', 'Perfil e distribuição territorial'],
    ['Pulso e cenários', 'Três horizontes de análise', ['Presente: estoque e concessões', 'Sinais antecedentes', 'Cenários condicionais'], 'Leitura do ciclo', 'Observação não é previsão'],
    ['Cobrança e recuperação', 'Possíveis tratamentos da dívida', ['Renegociação', 'Cobrança judicial', 'Recuperação e falência'], 'Tratamento da dívida', 'Caminhos dependem do caso'],
    ['Regras e conduta', 'Camada transversal às demais etapas', ['Regulação e supervisão', 'Pagamentos e Open Finance', 'Conduta e proteção do cliente'], 'Todo o processo', 'Da captação à recuperação'],
  ];
  const LABELS = ['Recursos', 'Instituições', 'Produtos e preços', 'Pessoas e territórios', 'Ciclo e perspectivas', 'Atraso e recuperação', 'Regras e conduta'];
  const QUESTIONS = ['Como os bancos captam recursos?', 'Quem empresta e com qual estrutura?', 'Quanto custa cada modalidade?', 'Quem toma crédito e onde?', 'O que cresce e o que atrasa?', 'Como a dívida é tratada?', 'Quais regras protegem o cliente?'];
  function node(tag, className, text) {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function button(text, action) {
    const b = node('button', '', text); b.type = 'button'; b.addEventListener('click', action); return b;
  }
  function link(text, href) { const a = node('a', '', text); a.href = href; return a; }
  function subtitle(text) { return node('p', 'atlas-eyebrow', text); }

  function artifact(index) {
    const visual = node('span', 'atlas-artifact'); visual.setAttribute('aria-hidden', 'true');
    const image = node('img');
    image.alt = ''; image.width = 440; image.height = 440;
    image.loading = 'lazy'; image.decoding = 'async';
    image.sizes = '(max-width: 650px) 100vw, (max-width: 1100px) 40vw, 300px';
    image.srcset = `/obs/arte/etapa-${index}-240-v1.webp 240w, /obs/arte/etapa-${index}-440-v1.webp 440w`;
    image.src = `/obs/arte/etapa-${index}-440-v1.webp`;
    visual.append(image);
    return visual;
  }
  function visualHero(mapa) {
    const hero = mapa.querySelector('.obs-hero:not([data-credito-abertura])');
    const orientation = node('details', 'atlas-orientation'); orientation.append(node('summary', '', 'Sobre o observatório, caminhos e fontes'));
    // o rótulo de contexto da plataforma (Iniciativa 2 do parecer de UX de 23/10/2026) fica acima do título da gravura, no lugar do
    // nome antigo escrito à mão; sem ele (fora da aplicação), o nome da coleção
    const rotulo = hero.querySelector('[data-rotulo-contexto]'); const rotuloCasca = rotulo ? rotulo.closest('.casca') || rotulo : null; if (rotuloCasca) rotuloCasca.remove();
    const oldTitle = hero.querySelector('h1'); const oldLabel = node('p', 'atlas-eyebrow', oldTitle.textContent); oldTitle.replaceWith(oldLabel);
    orientation.append(...hero.childNodes); hero.after(orientation);
    const existente = mapa.querySelector('[data-credito-abertura]');
    const abertura = existente || document.getElementById('credito-abertura').content.firstElementChild.cloneNode(true);
    if (!existente && rotulo) abertura.querySelector('[data-abertura-rotulo]').replaceChildren(rotulo);
    hero.replaceWith(abertura);
    const metric = mapa.querySelector('.atlas-metrics'); abertura.after(metric);
    metric.after(node('p', 'atlas-period-note', 'Cada medida tem seu próprio universo e período. Estoque não é concessão; inadimplência observada não é PD.'));
    const coverage = mapa.querySelector('.atlas-coverage'); if (coverage) orientation.append(coverage);
    const meta = mapa.querySelector('.obs-map-meta'); if (meta) orientation.append(meta);
    const guide = mapa.querySelector('.guia-leitura'); if (guide) orientation.append(guide);
  }
  function illustratedDoors() {
    const section = node('section', 'atlas-doors'); section.setAttribute('aria-label', 'Instituições e território');
    [['Como as instituições se comparam?', 'Selecione instituições e indicadores de balanço. Compare séries e dispersões no mesmo período e perímetro do IF.data.', 'Abrir o comparador ↗', '/observatorio/compare'], ['Como está o crédito na minha região?', 'Compare saldo, inadimplência e perfis dos tomadores nas 27 UFs, com dados do SCR. A página informa o período e a cobertura de cada medida.', 'Explorar território ↗', '/observatorio/states']].forEach(([title, desc, action, href], i) => {
      const a = link('', href); const copy = node('div'); copy.append(node('h3', '', title), node('p', '', desc), node('span', '', action));
      const art = artifact(i ? 3 : 1); art.classList.add('atlas-door-art');
      a.append(art, copy); section.append(a);
    }); return section;
  }

  // Valores em milhões de reais; PD e recuperação em porcentagem.
  // Não é provisão contábil, capital regulatório ou um modelo calibrado.
  function lossScenario(ead, pd, recovery) {
    if (![ead, pd, recovery].every(Number.isFinite) || ead < 0 || pd < 0 || pd > 100 || recovery < 0 || recovery > 100) return null;
    const lgd = 100 - recovery;
    return { lgd, loss: ead * (pd / 100) * (lgd / 100), rate: pd * (lgd / 100) };
  }

  function metrics(mapa, meta) {
    let wrap = mapa.querySelector('.atlas-metrics');
    if (!wrap) {
      const template = document.createElement('template');
      template.innerHTML = window.CascaCredito.htmlResumoCredito(meta);
      wrap = template.content.firstElementChild;
    }
    const coverage = mapa.querySelector('.obs-metrics');
    (coverage || mapa.querySelector('.obs-hero')).after(wrap);
    if (coverage) { coverage.classList.add('atlas-coverage'); wrap.after(coverage); }
  }

  function orbit(mapa, flow, cards) {
    const atlas = node('div', 'credit-atlas'); const wheel = node('div', 'atlas-wheel');
    wheel.setAttribute('role', 'group'); wheel.setAttribute('aria-label', 'Selecione uma das sete etapas do crédito');
    const panel = node('div', 'atlas-panels'); panel.id = 'atlas-analise'; wheel.id = 'atlas-etapas';
    const buttons = cards.map((card, i) => {
      const b = button('', () => {
        select(i);
        if (window.matchMedia('(max-width: 760px)').matches) {
          const h = cards[i].querySelector('h3'); h.focus({ preventScroll: true }); panel.scrollIntoView({ block: 'start' });
        }
      }); b.className = 'atlas-stage-button';
      b.id = `credito-etapa-${i + 1}`;
      b.append(artifact(i));
      b.setAttribute('aria-controls', `atlas-stage-${i + 1}`);
      b.append(node('span', 'atlas-stage-number', String(i + 1).padStart(2, '0')), node('span', 'atlas-stage-name', LABELS[i]), node('span', 'atlas-stage-question', QUESTIONS[i]));
      card.id = `atlas-stage-${i + 1}`; card.classList.add('atlas-panel'); card.setAttribute('role', 'region');
      const oldHeading = card.querySelector('h4'); const heading = node('h3', '', oldHeading.textContent); oldHeading.replaceWith(heading); heading.tabIndex = -1; heading.id = `atlas-stage-title-${i + 1}`; card.setAttribute('aria-labelledby', heading.id);
      card.querySelector('.mapa-num')?.remove();
      card.prepend(subtitle(`Etapa ${String(i + 1).padStart(2, '0')} · ${STAGES[i][0]}`));
      const diagram = node('div', 'atlas-diagram'); diagram.append(subtitle(STAGES[i][1]));
      const diagramFlow = node('div', 'atlas-diagram-flow'); const inputs = node('div', 'atlas-diagram-inputs');
      STAGES[i][2].forEach(t => inputs.append(node('span', '', t)));
      const target = node('div', 'atlas-diagram-target', STAGES[i][3]); target.append(node('small', '', STAGES[i][4]));
      const arrow = node('span', 'atlas-diagram-arrow', i === 0 ? '→' : '·'); arrow.setAttribute('aria-hidden', 'true');
      diagramFlow.append(inputs, arrow, target);
      diagram.append(diagramFlow, node('p', 'atlas-diagram-note', 'Esquema conceitual, sem proporções quantitativas.'));
      const explanation = node('details', 'atlas-stage-explanation'); explanation.append(node('summary', '', 'Entender os conceitos desta etapa'), diagram);
      const back = link('Escolher outra etapa ↑', '#atlas-etapas'); back.className = 'atlas-back';
      card.append(explanation, back); panel.append(card); wheel.append(b); return b;
    });
    function select(index, sync = true) {
      if (sync) history.replaceState(history.state, '', '#credito-etapa-' + (index + 1));
      buttons.forEach((b, i) => { b.setAttribute('aria-pressed', String(i === index)); cards[i].hidden = i !== index; });

    }
    const intro = node('div', 'atlas-cycle-intro'); intro.append(subtitle('Explore o ciclo do crédito'), node('h2', '', 'Do funding à recuperação.'), node('p', '', 'Sete etapas para entender o crédito. Escolha uma para explorar.'));
    atlas.append(intro, wheel, panel); flow.replaceWith(atlas);
    const initial = /^#credito-etapa-([1-7])$/.exec(location.hash);
    select(initial ? Number(initial[1]) - 1 : 0, false);
    if (initial) requestAnimationFrame(() => atlas.scrollIntoView({ block: 'start' }));
    // Buttons remain mounted, preserving focus; native Tab, Enter and Space work.
    wheel.addEventListener('keydown', e => {
      const i = buttons.indexOf(e.target); if (i < 0) return;
      const target = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (i + 1) % buttons.length : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (i + buttons.length - 1) % buttons.length : e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : -1;
      if (target < 0) return; e.preventDefault(); select(target); buttons[target].focus();
    });
    const note = node('p', 'atlas-note', 'A ordem é didática, não causal. Regras, pagamentos e conduta atravessam todo o processo.');
    note.textContent += ' Ilustrações conceituais geradas por IA, sem proporções quantitativas.'; atlas.append(note);
  }

  function laboratory() {
    const lab = node('section', 'atlas-lab'); lab.id = 'atlas-laboratorio'; lab.setAttribute('aria-labelledby', 'atlas-lab-title');
    const head = node('div', 'atlas-lab-head'); const titleBlock = node('div');
    const title = node('h3', '', 'E se o risco da carteira mudar?'); title.id = 'atlas-lab-title';
    titleBlock.append(subtitle('Do conceito ao mecanismo'), title, node('p', 'atlas-lab-intro', 'Mova as hipóteses e acompanhe como exposição, probabilidade de default e recuperação compõem a perda esperada.'));
    head.append(titleBlock, node('span', 'atlas-demo-label', 'Laboratório ilustrativo'));
    const grid = node('div', 'atlas-lab-grid'); const controls = node('div', 'atlas-lab-controls');
    const definitions = [
      ['ead', 'Exposição no default · EAD', 20, 300, 10, 100, 'Em milhões de reais. Exposição constante no horizonte do exercício.'],
      ['pd', 'Probabilidade de default · 12 meses', 0.5, 15, 0.5, 4, 'Hipótese de PD; não é a taxa de inadimplência observada no SCR.'],
      ['recovery', 'Recuperação após o default', 0, 90, 5, 55, 'LGD = 1 − recuperação. Sem custos ou desconto temporal.'],
    ];
    const inputs = {}, outputs = {};
    definitions.forEach(([key, labelText, min, max, step, value, help]) => {
      const row = node('div', 'atlas-lab-control'); const label = node('label', '', labelText); label.htmlFor = `atlas-${key}`;
      const output = node('output'); output.htmlFor = `atlas-${key}`; outputs[key] = output; label.append(output);
      const input = node('input'); input.type = 'range'; input.id = `atlas-${key}`; Object.assign(input, { min, max, step, value }); inputs[key] = input;
      const hint = node('p', 'atlas-control-hint', help); hint.id = `atlas-${key}-hint`; input.setAttribute('aria-describedby', hint.id);
      row.append(label, input, hint); controls.append(row);
    });
    const presets = node('div', 'atlas-presets');
    presets.append(button('Restaurar referência', () => { inputs.ead.value = 100; inputs.pd.value = 4; inputs.recovery.value = 55; update(); }), button('Testar PD de 8%', () => { inputs.pd.value = 8; update(); }), button('Testar recuperação de 75%', () => { inputs.recovery.value = 75; update(); })); controls.append(presets);
    const result = node('div', 'atlas-result'); result.setAttribute('aria-live', 'polite'); result.setAttribute('aria-atomic', 'true');
    const value = node('p', 'atlas-loss'); const rate = node('p', 'atlas-loss-caption');
    const track = node('div', 'atlas-loss-track'); track.setAttribute('role', 'img'); const fill = node('i'); track.append(fill);
    const scale = node('div', 'atlas-loss-scale'); scale.append(node('span', '', '0%'), node('span', '', 'Escala fixa · 15%'));
    const formula = node('p', 'atlas-formula'); const delta = node('p', 'atlas-delta');
    result.append(subtitle('Perda esperada · 12 meses'), value, rate, track, scale, formula, delta);
    const art = artifact(7); art.classList.add('atlas-portfolio');
    grid.append(controls, art, result);
    const compare = node('div', 'atlas-lab-compare'); compare.append(subtitle('Comparação sincronizada · perda / exposição'));
    const refs = {};
    [['reference', 'Referência'], ['current', 'Sua hipótese']].forEach(([key, label]) => {
      const row = node('div', `atlas-compare-row ${key}`); const bar = node('div', 'atlas-compare-track'); const mark = node('i'); const val = node('span', 'atlas-compare-value');
      bar.append(mark); row.append(node('span', '', label), bar, val); compare.append(row); refs[key] = { mark, val };
    });
    const reference = lossScenario(100, 4, 55);
    refs.reference.mark.style.width = reference.rate / 15 * 100 + '%'; refs.reference.val.textContent = fixed(reference.rate) + '%';
    compare.append(node('p', 'atlas-lab-note', 'Barras partem de zero e usam o mesmo máximo de 15%. Referência fixa: EAD de R$ 100 milhões, PD de 4% e recuperação de 55%. Cenários hipotéticos, sem calibração com os dados do Observatório. Modelo de um período; não estima provisão contábil, capital regulatório ou previsão.'));
    function update() {
      const ead = Number(inputs.ead.value), pd = Number(inputs.pd.value), recovery = Number(inputs.recovery.value);
      const scenario = lossScenario(ead, pd, recovery); if (!scenario) return;
      outputs.ead.textContent = `R$ ${fixed(ead, 0)} mi`; outputs.pd.textContent = `${fixed(pd, 1)}%`; outputs.recovery.textContent = `${fixed(recovery, 0)}%`;
      value.textContent = `R$ ${fixed(scenario.loss)} ${scenario.loss === 1 ? 'milhão' : 'milhões'}`;
      rate.textContent = `${fixed(scenario.rate)}% da exposição no exercício`;
      fill.style.width = scenario.rate / 15 * 100 + '%'; track.setAttribute('aria-label', `Perda esperada de ${fixed(scenario.rate)}% da exposição. Escala de zero a quinze por cento.`);
      formula.textContent = `EAD ${fixed(ead, 0)} mi × PD ${fixed(pd, 1)}% × LGD ${fixed(scenario.lgd, 0)}% = ${fixed(scenario.loss)} mi`;
      const difference = scenario.loss - reference.loss;
      delta.textContent = Math.abs(difference) < 1e-9 ? 'Mesma perda do cenário de referência.' : `${difference > 0 ? '+' : '−'} R$ ${fixed(Math.abs(difference))} milhões frente à referência.`;
      refs.current.mark.style.width = scenario.rate / 15 * 100 + '%'; refs.current.val.textContent = `${fixed(scenario.rate)}%`;
    }
    Object.values(inputs).forEach(input => input.addEventListener('input', update));
    lab.append(head, grid, compare); update(); return lab;
  }

  function concepts() {
    const section = node('section', 'atlas-concepts'); section.setAttribute('aria-labelledby', 'atlas-concepts-title');
    const intro = node('div'); const title = node('h3', '', 'Escolha a régua antes de comparar.'); title.id = 'atlas-concepts-title';
    intro.append(subtitle('Uma chave para ler os números'), title);
    const controls = node('div', 'atlas-concept-buttons'); controls.setAttribute('role', 'group'); controls.setAttribute('aria-label', 'Conceitos do crédito');
    const detail = node('div', 'atlas-concept-detail'); detail.setAttribute('aria-live', 'polite');
    const heading = node('h4'), description = node('p'); detail.append(heading, description);
    const data = [
      ['Estoque', 'Uma fotografia da carteira.', 'Saldo das operações em uma data. Não é o valor emprestado apenas naquele mês.'],
      ['Fluxo', 'O movimento durante um período.', 'Concessões medem operações contratadas no período e podem incluir renovações e renegociações. Não se somam diretamente ao saldo.'],
      ['Inadimplência', 'Uma proporção com definição própria.', 'Critério de atraso, numerador e universo dependem da fonte. Uma taxa observada de inadimplência não equivale à PD do laboratório.'],
    ];
    const buttons = data.map(([label], i) => { const b = button(label, () => select(i)); controls.append(b); return b; });
    function select(i) { buttons.forEach((b, j) => b.setAttribute('aria-pressed', String(i === j))); heading.textContent = data[i][1]; description.textContent = data[i][2]; }
    intro.append(controls); section.append(intro, detail); select(0); return section;
  }

  function readingPaths(mapa) {
    const section = mapa.querySelector('#mp-trilhas'), grid = section?.querySelector('.grid'); if (!grid) return;
    const cards = Array.from(grid.children); const controls = node('div', 'atlas-profiles'); controls.setAttribute('role', 'group'); controls.setAttribute('aria-label', 'Perfil de leitura');
    const buttons = cards.map((card, i) => {
      card.id = `atlas-profile-${i}`;
      const b = button(card.querySelector('h4').textContent, () => select(i)); b.setAttribute('aria-controls', card.id); controls.append(b); return b;
    });
    function select(i) { cards.forEach((card, j) => { card.hidden = i !== j; buttons[j].setAttribute('aria-pressed', String(i === j)); }); }
    grid.classList.add('atlas-profile-grid'); grid.before(controls); select(0);
  }

  function enhance(mapa, meta = {}, destinations = {}) {
    const flow = mapa.querySelector('.mapa-fluxo'); const cards = flow ? Array.from(flow.querySelectorAll('.mapa-no')) : [];
    if (mapa.querySelector('.credit-atlas') || cards.length !== STAGES.length || !mapa.querySelector('.obs-hero')) return;
    mapa.classList.add('has-credit-atlas');
    metrics(mapa, meta); visualHero(mapa); orbit(mapa, flow, cards);
    const cycle = mapa.querySelector('#mp-ciclo'); cycle.classList.add('atlas-visual-cycle'); cycle.after(illustratedDoors(), laboratory(), concepts());
    readingPaths(mapa);
    // Explain every stage destination before navigation, using the canonical page guide.
    mapa.querySelectorAll('.atlas-panel li > a').forEach(a => {
      const info = destinations[new URL(a.href).pathname];
      if (info) a.append(node('span', 'atlas-destination-question', info));
    });
    // Preserve the full searchable catalogue, data definitions and source tables.
    const index = mapa.querySelector('#mp-perguntas'), paths = mapa.querySelector('#mp-trilhas');
    if (index && paths) {
      const disclosure = node('details', 'atlas-catalogue'); const summary = node('summary', '', 'Todos os painéis, por pergunta');
      paths.after(disclosure); disclosure.append(summary, index);
      mapa.querySelectorAll('a[href="#mp-perguntas"]').forEach(a => a.addEventListener('click', () => { disclosure.open = true; }));
      if (location.hash === '#mp-perguntas') disclosure.open = true;
    }
  }
  window.CreditAtlas = Object.freeze({ enhance, lossScenario });
})();

