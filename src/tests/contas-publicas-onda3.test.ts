import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it, vi} from 'vitest';
import {CAPITULOS, CAPITULOS_EM_PREPARACAO, CAPITULOS_PUBLICADOS, INDICADORES, PAINEIS_COM_DADOS, PAINEIS_NAVEGACAO} from '@/lib/contas-publicas/catalogo';
import {COBERTURA, coberturaCapitulo} from '@/lib/contas-publicas/cobertura';
import {ANOS_LIQUIDADO_IGUAL, exercicio} from '@/lib/contas-publicas/areas';
import {PRIMEIRO_ANO_PLANO, anoPlano, creditosPlano, desvioPlano, seriePlano} from '@/lib/contas-publicas/planejamento';
import {DIVIDA, PRIMEIRO_ANO_EMENDAS, rigidez, serieAnualDivida, serieRigidez, ultimoMesDivida} from '@/lib/contas-publicas/riscos';
import {BASE_BENEFICIOS, BENEFICIOS, SERIE_BENEFICIOS, principaisModalidades} from '@/lib/contas-publicas/beneficios';
import {paineis} from '@/lib/observatorios/registro';
import {ehRotaPublica} from '@/lib/rotasPublicas';

/**
 * Onda 3 do roteiro (docs/BANCA_2026-10-19.md): "Contas federais: os capítulos restantes com dado ou retirados da
 * navegação até ter dado. Nenhum capítulo 'Em desenvolvimento' na navegação." Três capítulos ganharam dado
 * (planejamento, benefícios e riscos); os demais ficam registrados no catálogo, fora da navegação.
 */
vi.mock('next/navigation', async () => ({
  ...(await vi.importActual<typeof import('next/navigation')>('next/navigation')),
  usePathname: () => '/contas-publicas',
  useRouter: () => ({push: () => undefined, prefetch: () => undefined, replace: () => undefined}),
  useSearchParams: () => new URLSearchParams(),
  notFound: () => { throw new Error('NEXT_NOT_FOUND'); },
}));

const ids = (l: readonly {id: string}[]) => l.map((c) => c.id).sort();

describe('catálogo: com dados ou fora da navegação', () => {
  it('todo capítulo tem uma situação, e a lista da navegação é exatamente a dos capítulos com dados', () => {
    for (const c of CAPITULOS) expect(['com-dados', 'em-preparacao']).toContain(c.situacao);
    expect(PAINEIS_COM_DADOS.map(([id]) => id).sort()).toEqual(ids(CAPITULOS_PUBLICADOS));
    expect(CAPITULOS_PUBLICADOS.length + CAPITULOS_EM_PREPARACAO.length).toBe(CAPITULOS.length);
    expect(ids(COBERTURA)).toEqual(ids(CAPITULOS_PUBLICADOS));
  });
  it('capítulo com dados tem recorte observado; em preparação não tem nenhum e diz o que falta', () => {
    for (const c of CAPITULOS_PUBLICADOS) {
      const k = coberturaCapitulo(c.id);
      expect(k.observados.length + k.complementares.length, c.id).toBeGreaterThan(0);
    }
    for (const c of CAPITULOS_EM_PREPARACAO) {
      const k = coberturaCapitulo(c.id);
      expect(k.observados.length + k.complementares.length, c.id).toBe(0);
      expect(c.pendencia.length, c.id).toBeGreaterThan(40);
      // o desenho continua registrado: pergunta, limite e indicadores propostos
      expect(INDICADORES.some((i) => i.capitulo === c.id), c.id).toBe(true);
    }
  });
  it('os três capítulos novos têm indicador com recorte observado e a ficha aponta para o painel', async () => {
    const {FichaIndicador} = await import('@/components/contas-publicas/FichaIndicador');
    for (const id of ['planejamento', 'beneficios', 'riscos']) expect(coberturaCapitulo(id as 'riscos').observados.length, id).toBeGreaterThan(0);
    for (const i of INDICADORES.filter((x) => x.status === 'integracao-parcial')) {
      const html = renderToStaticMarkup(createElement(FichaIndicador, {indicador: i}));
      expect(html, i.id).not.toContain('undefined');
      expect(html, i.id).toMatch(/href="\/contas-publicas\/[a-z-]+(#[a-z-]+)?"/);
    }
  });
});

describe('navegação: nenhum capítulo em desenvolvimento', () => {
  it('só os capítulos com dados têm rota; os em preparação respondem 404', async () => {
    const pagina = await import('@/app/contas-publicas/[capitulo]/page');
    expect(pagina.dynamicParams).toBe(false);
    expect(pagina.generateStaticParams().map((p) => p.capitulo).sort()).toEqual(ids(CAPITULOS_PUBLICADOS));
    for (const c of CAPITULOS_EM_PREPARACAO) expect(() => pagina.default({params: {capitulo: c.id}}), c.id).toThrow('NEXT_NOT_FOUND');
  });
  it('cada capítulo com dados abre com painel, sem "Em desenvolvimento" nem "método proposto"', async () => {
    const {default: Pagina} = await import('@/app/contas-publicas/[capitulo]/page');
    for (const c of CAPITULOS_PUBLICADOS) {
      const html = renderToStaticMarkup(Pagina({params: {capitulo: c.id}}));
      expect(html, c.id).toContain('Dados disponíveis');
      expect(html, c.id).not.toMatch(/Em desenvolvimento|método proposto|Conhecer a proposta/);
      for (const e of CAPITULOS_EM_PREPARACAO) expect(html, `${c.id} → ${e.id}`).not.toContain(`href="/contas-publicas/${e.id}"`);
      expect(html, c.id).not.toContain('NaN');
    }
  });
  it('o Panorama responde na primeira tela e deixa os complementos para o fim (diagnóstico de 20/10/2026, item 9)', async () => {
    const {default: Pagina} = await import('@/app/contas-publicas/[capitulo]/page');
    const {DADOS, fiscalAcumulado} = await import('@/lib/contas-publicas/dados');
    const {moeda} = await import('@/lib/contas-publicas/formato');
    const html = renderToStaticMarkup(Pagina({params: {capitulo: 'panorama'}}));
    const [anoRef, mesRef] = DADOS.referenciaRTN.split('-').map(Number);
    const ano = mesRef === 12 ? anoRef : anoRef - 1;
    const v = fiscalAcumulado(ano, 12)!;
    const resumo = html.indexOf('id="resumo-fiscal"');
    expect(resumo).toBeGreaterThan(html.indexOf('</h1>'));
    expect(resumo).toBeLessThan(html.indexOf('cp-chapter-tools'));
    const trecho = html.slice(resumo, html.indexOf('cp-chapter-tools'));
    for (const n of [v.receitaLiquida, v.despesa, Math.abs(v.resultado)]) expect(trecho).toContain(moeda(n, 'milhoes'));
    expect(trecho).toContain('Fonte: Tesouro Nacional');
    expect(trecho).toContain('não atesta cumprimento da meta fiscal');
    expect(html).not.toContain('Complemento deste capítulo');
    expect(html.indexOf('id="complementos-capitulo"')).toBeGreaterThan(html.indexOf('id="fiscal-observado"'));
    for (const c of CAPITULOS_PUBLICADOS.filter((c) => c.id !== 'panorama')) expect(renderToStaticMarkup(Pagina({params: {capitulo: c.id}})), c.id).not.toContain('id="resumo-fiscal"');
  });
  it('a entrada, o mapa do observatório e a navegação entre painéis não levam a capítulo em preparação', async () => {
    const {default: Entrada} = await import('@/app/contas-publicas/page');
    const html = renderToStaticMarkup(createElement(Entrada));
    const rotas = paineis().map((p) => p.rota);
    for (const c of CAPITULOS_EM_PREPARACAO) {
      expect(html, c.id).not.toContain(`href="/contas-publicas/${c.id}"`);
      expect(rotas, c.id).not.toContain(`/contas-publicas/${c.id}`);
      expect(PAINEIS_NAVEGACAO.map(([h]) => h), c.id).not.toContain(`/contas-publicas/${c.id}`);
    }
    for (const c of CAPITULOS_PUBLICADOS) expect(rotas, c.id).toContain(`/contas-publicas/${c.id}`);
    expect(html).not.toMatch(/Em desenvolvimento|método proposto/);
    // as quatro etapas do percurso levam a capítulos com dados
    const ciclo = html.slice(html.indexOf('class="cp-cycle"'));
    expect(ciclo).not.toContain('Em preparação');
    for (const destino of ['panorama', 'execucao', 'metas', 'riscos']) expect(ciclo).toContain(`href="/contas-publicas/${destino}"`);
  });
  it('o método diz, numa linha e sem data, quais capítulos estão fora da navegação', async () => {
    const {default: Metodo} = await import('@/app/contas-publicas/metodologia/page');
    const html = renderToStaticMarkup(createElement(Metodo));
    expect(html).toContain('fora da navegação');
    for (const c of CAPITULOS_EM_PREPARACAO) expect(html).toContain(c.titulo);
    const trecho = html.slice(html.indexOf('id="em-preparacao"'), html.indexOf('id="referencias"'));
    expect(trecho).not.toMatch(/\b20\d\d\b|em breve|próxim/i);
  });
});

describe('plano e execução (SIOP)', () => {
  const serie = seriePlano();
  it('começa no primeiro ano com liquidado separado do empenhado', () => {
    expect(ANOS_LIQUIDADO_IGUAL).toContain(PRIMEIRO_ANO_PLANO - 1);
    expect(ANOS_LIQUIDADO_IGUAL).not.toContain(PRIMEIRO_ANO_PLANO);
    expect(serie[0].ano).toBe(PRIMEIRO_ANO_PLANO);
  });
  it('o total por exercício reconcilia com a consulta independente por esfera', () => {
    for (const a of serie) {
      const t = exercicio(a.ano)!.total;
      for (const k of ['inicial', 'atualizada', 'liquidado'] as const) {
        if (t[k] === null) { expect(a.total[k]).toBeNull(); continue; }
        expect(Math.abs((a.total[k] as number) - (t[k] as number)), `${a.ano} ${k}`).toBeLessThanOrEqual(Math.max(5, Math.abs(t[k] as number) * 1e-10) + 20);
        expect(a.primaria[k] as number).toBeLessThanOrEqual(a.total[k] as number);
      }
    }
  });
  it('ano em curso não tem desvio; estágio ausente na fonte continua ausente, nunca zero', () => {
    const curso = serie.find((a) => !a.encerrado);
    if (curso) { expect(desvioPlano(curso, 'primaria').status).toBe('inelegivel'); expect(curso.funcoes).toEqual([]); }
    const fechado = serie.filter((a) => a.encerrado).at(-1)!;
    expect(desvioPlano(fechado, 'primaria').status).toBe('calculado');
    expect(fechado.funcoes.length).toBeGreaterThan(20);
    expect(fechado.funcoes.some((f) => f.codigo === '99' || f.codigo === '98')).toBe(false);
    const a2014 = anoPlano(2014)!;
    expect(a2014.total.atualizada).toBeNull();
    expect(creditosPlano(a2014, 'total').status).toBe('ausente');
  });
  it('a página mostra lei original, autorizado e liquidado com unidade, período e fonte', async () => {
    const {PainelPlanejamento} = await import('@/components/contas-publicas/PainelPlanejamento');
    const html = renderToStaticMarkup(createElement(PainelPlanejamento, {anos: serie}));
    for (const t of ['Lei original', 'Autorizado no fim do ano', 'Liquidado', 'R$ correntes', 'SIOP', `${PRIMEIRO_ANO_PLANO} a`, 'reserva de contingência']) expect(html, t).toContain(t);
    if (serie.some((a) => !a.encerrado)) expect(html).toContain('Sem desvio');
    expect(html).not.toContain('NaN');
  });
});

describe('sustentabilidade e riscos: rigidez (SIOP) e dívida bruta (Banco Central)', () => {
  const r = serieRigidez();
  it('obrigatória é parte da primária; emendas sem marca própria antes de 2014 não viram zero', () => {
    expect(PRIMEIRO_ANO_EMENDAS).toBe(2014);
    for (const a of r) {
      expect(a.inicial, String(a.ano)).not.toBeNull();
      const p = a.inicial!;
      expect(p.obrigatoria).toBeLessThanOrEqual(p.primaria);
      expect(rigidez(p).valor!).toBeGreaterThan(50);
      if (a.ano < PRIMEIRO_ANO_EMENDAS) expect(p.emendas).toBeNull();
      else expect(p.emendas).toEqual(expect.any(Number));
      if (a.ano < PRIMEIRO_ANO_PLANO || !a.encerrado) expect(a.liquidado).toBeNull();
      else expect(a.liquidado).not.toBeNull();
    }
  });
  it('dívida: meses consecutivos desde dezembro de 2006, em R$ e % do PIB, com o mês mais recente à parte', () => {
    const reg = DIVIDA.registros;
    expect(reg[0].periodo).toBe('2006-12');
    for (let i = 1; i < reg.length; i++) {
      const [a, m] = reg[i - 1].periodo.split('-').map(Number), [b, n] = reg[i].periodo.split('-').map(Number);
      expect(b * 12 + n - (a * 12 + m), reg[i].periodo).toBe(1);
    }
    const anual = serieAnualDivida();
    expect(anual.at(-1)!.periodo).toBe(ultimoMesDivida().periodo);
    expect(anual.filter((p) => p.fimDeAno).every((p) => p.periodo.endsWith('-12'))).toBe(true);
  });
  it('os dois painéis declaram perímetros diferentes e não somam as medidas', async () => {
    const {PainelRigidez} = await import('@/components/contas-publicas/PainelRiscos');
    const {PainelDivida} = await import('@/components/contas-publicas/PainelDivida');
    const {FONTE_RIGIDEZ} = await import('@/lib/contas-publicas/riscos');
    const a = renderToStaticMarkup(createElement(PainelRigidez, {anos: r, fonte: FONTE_RIGIDEZ}));
    const b = renderToStaticMarkup(createElement(PainelDivida));
    expect(a).toContain('Sem marca própria');
    expect(a).toContain('% da despesa primária');
    expect(a).toContain('Não mede qualidade do gasto');
    expect(b).toContain('governo geral');
    expect(b).toContain('% do PIB');
    expect(b).toContain('Os valores não se somam');
    expect(b).toContain('/contas-publicas/divida.json');
    for (const h of [a, b]) expect(h).not.toContain('NaN');
  });
});

describe('gastos tributários (Receita Federal)', () => {
  it('estimativa de dados efetivos separada da projeção, com somas conferidas', () => {
    expect(SERIE_BENEFICIOS.map((s) => s.natureza)).toEqual(['efetivo', 'efetivo', 'efetivo', 'projecao', 'projecao', 'projecao']);
    expect(BASE_BENEFICIOS.natureza).toBe('efetivo');
    expect(Math.abs(BENEFICIOS.tributos.reduce((s, t) => s + t.valor, 0) - BENEFICIOS.total)).toBeLessThanOrEqual(1);
    expect(Math.abs(BENEFICIOS.funcoes.reduce((s, t) => s + t.valor, 0) - BENEFICIOS.total)).toBeLessThanOrEqual(1);
    const m = principaisModalidades(10);
    expect(Math.abs(m.top.reduce((s, x) => s + x.valor, 0) + m.demais.valor - BENEFICIOS.total)).toBeLessThanOrEqual(1);
    // o total de 2023 da série (quadro XXVI) é o do quadro VI, a menos do arredondamento da planilha
    expect(Math.abs(BASE_BENEFICIOS.valor - BENEFICIOS.total)).toBeLessThanOrEqual(1);
  });
  it('a página diz que é estimativa, não despesa paga, e marca a projeção', async () => {
    const {PainelBeneficios} = await import('@/components/contas-publicas/PainelBeneficios');
    const html = renderToStaticMarkup(createElement(PainelBeneficios));
    for (const t of ['não uma despesa paga', 'projeção', 'Receita Federal', '% do PIB', 'R$ correntes', '07/04/2026', '/contas-publicas/beneficios.json']) expect(html, t).toContain(t);
    expect(html).not.toContain('NaN');
  });
  it('os painéis e os downloads novos ficam com conta', () => {
    for (const r of ['/contas-publicas/beneficios.json', '/contas-publicas/divida.json', '/contas-publicas/riscos', '/contas-publicas/beneficios', '/contas-publicas/planejamento']) expect(ehRotaPublica(r), r).toBe(false);
  });
});
