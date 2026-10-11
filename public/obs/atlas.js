/* Atlas do crédito: apresentação progressiva do mapa existente.
 * Não altera gold, filtros, rotas, forecasts ou scores. O laboratório usa apenas
 * hipóteses locais do visitante e nunca grava em state.data ou localStorage.
 */
(() => {
  'use strict';
  const FORMAT = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
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
  const POSITIONS = [[50, 10], [81, 27], [83, 59], [65, 86], [31, 86], [16, 59], [19, 27]];
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

  // Valores em milhões de reais; PD e recuperação em porcentagem.
  // Não é provisão contábil, capital regulatório ou um modelo calibrado.
  function lossScenario(ead, pd, recovery) {
    if (![ead, pd, recovery].every(Number.isFinite) || ead < 0 || pd < 0 || pd > 100 || recovery < 0 || recovery > 100) return null;
    const lgd = 100 - recovery;
    return { lgd, loss: ead * (pd / 100) * (lgd / 100), rate: pd * (lgd / 100) };
  }

  function metrics(mapa, meta) {
    const definitions = [
      { label: 'Saldo das operações', source: 'BCB · SGS 20539', value: meta.carteira_conceitos?.sgs?.v, ref: meta.carteira_conceitos?.sgs?.ref, def: meta.carteira_conceitos?.sgs?.def, format: v => `R$ ${FORMAT.format(v)} bi` },
      { label: 'Sedes em funcionamento', source: 'BCB · Unicad', value: meta.if_contagens?.cadastro_sedes?.n, ref: meta.if_contagens?.cadastro_sedes?.ref, def: meta.if_contagens?.cadastro_sedes?.def, format: v => FORMAT.format(v) },
      { label: 'Inadimplência · conceito SCR', source: 'BCB · SCR.data', value: meta.inad_conceitos?.scr?.v, ref: meta.inad_conceitos?.scr?.ref, def: meta.inad_conceitos?.scr?.def, format: v => `${FORMAT.format(v)}%` },
    ];
    const wrap = node('section', 'atlas-metrics'); wrap.setAttribute('aria-label', 'Indicadores do crédito com períodos próprios');
    definitions.forEach(d => {
      const item = node('div', 'atlas-metric'); const valid = Number.isFinite(d.value);
      item.append(node('p', 'atlas-metric-label', d.label), node('p', 'atlas-metric-value', valid ? d.format(d.value) : '—'), node('p', 'atlas-source', `${d.source} · ${d.ref || 'data não disponível'}`));
      if (!valid) item.append(node('p', 'atlas-source', 'Indicador não disponível nesta publicação da base.'));
      const detail = node('details', 'atlas-definition');
      detail.append(node('summary', '', 'Conceito e fonte'), node('p', '', d.def || 'Definição não disponível nesta publicação.'), link('Metodologia e fontes ↗', '/observatorio/methodology'));
      item.append(detail); wrap.append(item);
    });
    const coverage = mapa.querySelector('.obs-metrics');
    (coverage || mapa.querySelector('.obs-hero')).after(wrap);
    if (coverage) { coverage.classList.add('atlas-coverage'); wrap.after(coverage); }
  }

  function orbit(mapa, flow, cards) {
    const atlas = node('div', 'credit-atlas'); const wheel = node('div', 'atlas-wheel');
    wheel.setAttribute('role', 'group'); wheel.setAttribute('aria-label', 'Selecione uma das sete etapas do crédito');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 420 420'); svg.setAttribute('aria-hidden', 'true'); svg.classList.add('atlas-orbit');
    const spokes = [];
    const shape = (tag, attributes) => { const n = document.createElementNS(svg.namespaceURI, tag); Object.entries(attributes).forEach(([k, v]) => n.setAttribute(k, v)); svg.append(n); return n; };
    [84, 128].forEach(r => shape('circle', { cx: '210', cy: '206', r: String(r), class: 'atlas-orbit-ring' }));
    POSITIONS.forEach(([x, y]) => {
      const tx = x * 4.2, ty = y * 4.2 - 12, dx = tx - 210, dy = ty - 206, distance = Math.hypot(dx, dy);
      spokes.push(shape('line', { x1: String(210 + dx / distance * 62), y1: String(206 + dy / distance * 62), x2: String(tx), y2: String(ty), class: 'atlas-spoke' }));
    });
    const center = node('div', 'atlas-center'); const numeral = node('strong', '', '01'); const name = node('span', '', STAGES[0][0]);
    center.append(node('small', '', 'O ciclo do crédito'), numeral, name, node('em', '', 'Explore as etapas ao redor'));
    const panel = node('div', 'atlas-panels'); panel.setAttribute('aria-live', 'polite');
    const buttons = cards.map((card, i) => {
      const b = button('', () => select(i)); b.className = 'atlas-stage-button';
      b.style.setProperty('--atlas-x', POSITIONS[i][0] + '%'); b.style.setProperty('--atlas-y', POSITIONS[i][1] + '%');
      b.setAttribute('aria-controls', `atlas-stage-${i + 1}`);
      b.append(node('span', 'atlas-stage-number', String(i + 1)), node('span', 'atlas-stage-name', card.querySelector('h4').textContent));
      card.id = `atlas-stage-${i + 1}`; card.classList.add('atlas-panel'); card.setAttribute('role', 'region');
      const heading = card.querySelector('h4'); heading.id = `atlas-stage-title-${i + 1}`; card.setAttribute('aria-labelledby', heading.id);
      card.querySelector('.mapa-num')?.remove();
      card.prepend(subtitle(`Etapa ${String(i + 1).padStart(2, '0')} · ${STAGES[i][0]}`));
      const diagram = node('div', 'atlas-diagram'); diagram.append(subtitle(STAGES[i][1]));
      const diagramFlow = node('div', 'atlas-diagram-flow'); const inputs = node('div', 'atlas-diagram-inputs');
      STAGES[i][2].forEach(t => inputs.append(node('span', '', t)));
      const target = node('div', 'atlas-diagram-target', STAGES[i][3]); target.append(node('small', '', STAGES[i][4]));
      const arrow = node('span', 'atlas-diagram-arrow', i === 0 ? '→' : '·'); arrow.setAttribute('aria-hidden', 'true');
      diagramFlow.append(inputs, arrow, target);
      diagram.append(diagramFlow, node('p', 'atlas-diagram-note', 'Esquema conceitual, sem proporções quantitativas.'));
      card.querySelector('ul').before(diagram); panel.append(card); wheel.append(b); return b;
    });
    function select(index) {
      buttons.forEach((b, i) => { b.setAttribute('aria-pressed', String(i === index)); cards[i].hidden = i !== index; spokes[i].classList.toggle('is-active', i === index); });
      numeral.textContent = String(index + 1).padStart(2, '0'); name.textContent = STAGES[index][0];
    }
    wheel.append(svg, center); atlas.append(wheel, panel); flow.replaceWith(atlas); select(0);
    // Buttons remain mounted, preserving focus; native Tab, Enter and Space work.
    wheel.addEventListener('keydown', e => {
      const i = buttons.indexOf(e.target); if (i < 0) return;
      const target = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (i + 1) % buttons.length : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (i + buttons.length - 1) % buttons.length : e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : -1;
      if (target < 0) return; e.preventDefault(); select(target); buttons[target].focus();
    });
    const note = node('p', 'atlas-note', 'A ordem é didática, não causal. Regras, pagamentos e conduta atravessam todo o processo.');
    atlas.after(note);
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
    grid.append(controls, result);
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

  function enhance(mapa, meta = {}) {
    const flow = mapa.querySelector('.mapa-fluxo'); const cards = flow ? Array.from(flow.querySelectorAll('.mapa-no')) : [];
    if (mapa.querySelector('.credit-atlas') || cards.length !== STAGES.length || !mapa.querySelector('.obs-hero')) return;
    mapa.classList.add('has-credit-atlas');
    metrics(mapa, meta); orbit(mapa, flow, cards);
    const cycle = mapa.querySelector('#mp-ciclo'); cycle.after(laboratory(), concepts());
    readingPaths(mapa);
    // Preserve the full searchable catalogue, data definitions and source tables.
    const index = mapa.querySelector('#mp-perguntas'), paths = mapa.querySelector('#mp-trilhas');
    if (index && paths) {
      const disclosure = node('details', 'atlas-catalogue'); const summary = node('summary', '', 'Todos os painéis, por pergunta');
      paths.after(disclosure); disclosure.append(summary, index);
      mapa.querySelectorAll('a[href="#mp-perguntas"]').forEach(a => a.addEventListener('click', () => { disclosure.open = true; }));
    }
  }
  window.CreditAtlas = Object.freeze({ enhance, lossScenario });
})();
