import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it, vi} from 'vitest';
import fonte from '@/lib/contas-publicas/snapshots/funcoes.json';
import {
  ANOS, ANO_CORRENTE, AREA_PADRAO, ESTAGIOS_AREA, ESTAGIOS_INCOMPLETOS, ROTA_AREAS, composicao, conciliacaoGrupos, emCem, encerrado,
  hrefRecorte, lerRecorte, linhasDownload, parcelaDe, parcelasEscolhiveis, serie, subfuncoesDaParcela, tipoParcela, ultimoEncerrado,
} from '@/lib/contas-publicas/areas';
import {DADOS} from '@/lib/contas-publicas/dados';
import {numero} from '@/lib/contas-publicas/formato';
import {ehRotaPublica} from '@/lib/rotasPublicas';

/**
 * Painel "Para onde vai o dinheiro federal, por área?" (/contas-publicas/por-area): a classificação funcional do SIOP,
 * com a dívida e os demais Encargos Especiais fora das áreas, ausência nunca como zero e o recorte na URL.
 */
vi.mock('next/navigation', async () => ({
  ...(await vi.importActual<typeof import('next/navigation')>('next/navigation')),
  usePathname: () => ROTA_AREAS,
  useRouter: () => ({push: () => undefined, prefetch: () => undefined, replace: () => undefined}),
  useSearchParams: () => new URLSearchParams(),
}));

const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), 'utf-8');
const ANO = 2025;

describe('base por função: o que a fonte trouxe', () => {
  it('série contínua de 2000 ao ano corrente, cinco estágios, R$ correntes e o perímetro dos dois orçamentos', () => {
    expect(ANOS[0]).toBe(2000);
    expect(ANOS).toEqual(Array.from({length: ANO_CORRENTE - 1999}, (_, i) => 2000 + i));
    expect(fonte.colunas).toEqual(['ano', 'funcao', 'subfuncao', 'rp', ...ESTAGIOS_AREA]);
    expect(fonte.unidade).toBe('R$ correntes');
    expect(fonte.perimetro).toContain('esferas 10 e 20');
    // o último exercício encerrado é o de 2025; o ano corrente fica parcial
    expect(ultimoEncerrado()).toBe(ANO);
    expect(encerrado(ANO_CORRENTE)).toBe(false);
  });

  it('o total pago por função é o mesmo do painel de execução (consulta por esfera), no mesmo exercício', () => {
    const b = DADOS.orcamento.find((o) => o.ano === ANO)!;
    const c = composicao(ANO, 'pago', 'total')!;
    // mesma tolerância do importador: R$ 5 ou um décimo de bilionésimo do total, o maior (a fonte soma em ponto flutuante)
    const tol = (v: number) => Math.max(fonte.validacao.toleranciaReais, fonte.validacao.toleranciaRelativa * Math.abs(v));
    expect(Math.abs(c.total - b.total.pago)).toBeLessThanOrEqual(tol(b.total.pago));
    for (const e of ESTAGIOS_AREA) {
      const v = (b.total as Record<string, number>)[e];
      expect(Math.abs(composicao(ANO, e, 'total')!.total - v), e).toBeLessThanOrEqual(tol(v));
    }
  });

  it('estágio incompleto na fonte (2014, autorizado) é ausência, nunca zero', () => {
    expect(ESTAGIOS_INCOMPLETOS).toEqual([{ano: 2014, estagio: 'atualizada'}]);
    expect(composicao(2014, 'atualizada')).toBeNull();
    expect(composicao(2014, 'pago')).not.toBeNull();
    const ponto = serie('f10', 'atualizada').find((p) => p.ano === 2014)!;
    expect(ponto).toMatchObject({valor: null, parcela: null, total: null});
    expect(linhasDownload().filter((l) => l.ano === 2014).every((l) => l.atualizada === null)).toBe(true);
  });
});

describe('parcelas: a dívida e os encargos fora das áreas', () => {
  it('Encargos Especiais vira quatro parcelas fora das áreas; reserva também; as 27 funções são as áreas', () => {
    expect(parcelaDe('28', '841')).toBe('divida-refinanciamento');
    expect(parcelaDe('28', '844')).toBe('divida-servico');
    expect(parcelaDe('28', '845')).toBe('transferencias');
    expect(parcelaDe('28', '847')).toBe('transferencias');
    expect(parcelaDe('28', '846')).toBe('outros-encargos');
    expect(parcelaDe('99', '999')).toBe('reserva');
    expect(parcelaDe('12', '847')).toBe('f12');
    expect(tipoParcela('reserva')).toBe('reserva');
    const areas = parcelasEscolhiveis().filter((p) => p.tipo === 'area').map((p) => p.id);
    expect(areas).toHaveLength(27);
    expect(areas.every((id) => /^f(0[1-9]|1\d|2[0-7])$/.test(id))).toBe(true);
  });

  it('cada R$ 100 fecha em R$ 100,0 e a soma das parcelas é o total, em todo exercício e estágio completos', () => {
    for (const ano of ANOS) {
      for (const e of ESTAGIOS_AREA) {
        for (const base of ['total', 'primaria'] as const) {
          const c = composicao(ano, e, base);
          if (!c) continue;
          const itens = emCem(c)!;
          expect(Math.round(itens.reduce((s, p) => s + p.cem, 0) * 10), `${ano} ${e} ${base}`).toBe(1000);
        }
      }
    }
  });

  it('a dívida são as subfunções 841 a 844; a base primária a exclui e exclui as operações financeiras', () => {
    const c = composicao(ANO, 'pago', 'total')!;
    const divida = c.parcelas.filter((p) => p.tipo === 'divida');
    expect(divida.map((p) => p.id)).toEqual(['divida-refinanciamento', 'divida-servico']);
    const linhas = linhasDownload().filter((l) => l.ano === ANO && l.funcao === '28' && ['841', '842', '843', '844'].includes(l.subfuncao));
    expect(divida.reduce((s, p) => s + p.valor, 0)).toBeCloseTo(linhas.reduce((s, l) => s + (l.pago ?? 0), 0), 0);
    const p = composicao(ANO, 'pago', 'primaria')!;
    expect(p.parcelas.some((x) => x.tipo === 'divida')).toBe(false);
    const primaria = linhasDownload().filter((l) => l.ano === ANO && l.rp !== '0').reduce((s, l) => s + (l.pago ?? 0), 0);
    expect(p.total).toBeCloseTo(primaria, 0);
    // a reserva não tem execução: sai da régua do pago e aparece no autorizado
    expect(c.parcelas.some((x) => x.id === 'reserva')).toBe(false);
    expect(composicao(ANO, 'atualizada', 'total')!.parcelas.some((x) => x.id === 'reserva')).toBe(true);
  });

  it('a conciliação com a régua por grupo de despesa da entrada é exata e explicável', () => {
    const k = conciliacaoGrupos(ANO)!;
    const b = DADOS.orcamento.find((o) => o.ano === ANO)!;
    expect(k.grupos).toBe(b.grupos.filter((g) => g.codigo === '2' || g.codigo === '6').reduce((s, g) => s + g.pago, 0));
    // juros e amortização fora de 841 a 844 (conferido no SIOP: todos em 28.846 em 2025) não passam de Outros encargos
    const outros = composicao(ANO, 'pago', 'total')!.parcelas.find((p) => p.id === 'outros-encargos')!;
    expect(k.diferenca).toBeGreaterThan(0);
    expect(k.diferenca).toBeLessThanOrEqual(outros.valor);
    expect(conciliacaoGrupos(2010)).toBeNull();
  });

  it('subfunções da área escolhida somam a área', () => {
    const c = composicao(ANO, 'pago', 'total')!;
    for (const id of ['f10', 'f12', 'transferencias', 'outros-encargos'] as const) {
      const soma = subfuncoesDaParcela(id, ANO).reduce((s, l) => s + (l.valores.pago ?? 0), 0);
      expect(soma, id).toBeCloseTo(c.parcelas.find((p) => p.id === id)!.valor, 0);
    }
  });

  it('a série tem um ponto por exercício, com o ano corrente parcial', () => {
    const s = serie('f09');
    expect(s.map((p) => p.ano)).toEqual(ANOS);
    expect(s.filter((p) => p.parcial).map((p) => p.ano)).toEqual([ANO_CORRENTE]);
    expect(s.every((p) => p.parcela === null || (p.parcela >= 0 && p.parcela <= 100))).toBe(true);
  });
});

describe('recorte na URL', () => {
  it('valor fora da lista volta ao padrão; o padrão sai do endereço', () => {
    expect(lerRecorte({})).toEqual({ano: ANO, estagio: 'pago', base: 'total', area: AREA_PADRAO});
    expect(lerRecorte({ano: '1999', estagio: 'x', base: 'y', area: 'f28'})).toEqual({ano: ANO, estagio: 'pago', base: 'total', area: AREA_PADRAO});
    expect(lerRecorte({ano: '2014', estagio: 'empenhado', base: 'primaria', area: 'f12'})).toEqual({ano: 2014, estagio: 'empenhado', base: 'primaria', area: 'f12'});
    expect(hrefRecorte(lerRecorte({}))).toBe(ROTA_AREAS);
    expect(hrefRecorte(lerRecorte({}), {area: 'f12'}, 'serie')).toBe(`${ROTA_AREAS}?area=f12#serie`);
  });
});

describe('a página', () => {
  const pagina = async (q: Record<string, string> = {}) => {
    const {default: Page} = await import('@/app/contas-publicas/por-area/page');
    return renderToStaticMarkup(createElement(Page, {searchParams: q}));
  };

  it('primeira tela: a pergunta, cada R$ 100 do último exercício encerrado com a dívida à parte, valores, ano e fonte', async () => {
    const html = await pagina();
    expect(html).toContain('<h1>Para onde vai o dinheiro federal, por área?</h1>');
    expect(html).toContain(`De cada R$ 100 pagos em ${ANO}, quanto foi para cada área?`);
    const itens = emCem(composicao(ANO, 'pago', 'total')!)!;
    const divida = itens.filter((p) => p.tipo === 'divida').reduce((s, p) => s + p.cem, 0);
    expect(html).toContain(`R$ ${numero(divida)} foram para a dívida pública`);
    expect(html).toContain('Previdência Social');
    expect(html).toContain('SIOP, dados abertos');
    expect(html).toMatch(/Base atualizada em \d{2}\/\d{2}\/\d{4}; captura em \d{2}\/\d{2}\/\d{4}/);
    expect(html).toContain('sem correção pela inflação');
    expect(html).toContain('Por que o painel usa o valor pago');
    expect(html).not.toMatch(/NaN|undefined|Infinity|—/);
  });

  it('as seções seguem a ordem pedida, com o artefato didático, a série, o detalhe e o método recolhido no fim', async () => {
    const html = await pagina();
    const ordem = ['id="cem"', 'id="estagios"', 'id="serie"', 'id="subfuncoes"', 'id="metodo"'].map((m) => html.indexOf(m));
    expect(ordem.every((i) => i > 0)).toBe(true);
    expect([...ordem].sort((a, b) => a - b)).toEqual(ordem);
    expect(html).toContain('Do orçamento ao pagamento');
    expect(html).toContain('Modelo didático');
    expect(html).toMatch(/<details class="cp-method-fold"><summary id="metodo-titulo">Método, fontes, notas e downloads/);
    const metodo = html.slice(html.indexOf('id="metodo"'));
    expect(metodo).toContain('/contas-publicas/por-area/funcoes.csv');
    expect(metodo).toContain('/contas-publicas/funcoes.json');
    expect(metodo).toContain('Portaria SOF/ME nº 2.520');
  });

  it('o recorte da URL muda a página: área, estágio, base e ano; estágio ausente diz não informado', async () => {
    const saude = await pagina({area: 'f12'});
    expect(saude).toContain('Dentro de Educação: em que o dinheiro foi aplicado?');
    expect(saude).toContain('Como mudou a parte de Educação desde 2000?');
    const primaria = await pagina({base: 'primaria'});
    expect(primaria).toContain('Só a despesa primária');
    const ausente = await pagina({ano: '2014', estagio: 'atualizada'});
    expect(ausente).toContain('Não informado: o SIOP não traz o estágio autorizado completo para 2014');
    expect(ausente).not.toMatch(/NaN|undefined|Infinity/);
    const reserva = await pagina({area: 'reserva'});
    expect(reserva).toContain('A reserva de contingência não é executada');
  });

  it('contrato editorial: sem julgamento e com o limite dito', async () => {
    const html = (await pagina()).toLowerCase();
    for (const proibido of ['gasta demais', 'gasta de menos', 'gasta pouco', 'desperdiça', 'ineficiente', 'gestão ruim']) expect(html, proibido).not.toContain(proibido);
    expect(html).toContain('o que esta página não permite concluir');
    expect(html).toContain('não mede eficiência');
  });
});

describe('acesso, navegação e coleta', () => {
  it('o painel, o CSV e o JSON exigem conta', () => {
    for (const r of [ROTA_AREAS, `${ROTA_AREAS}/funcoes.csv`, '/contas-publicas/funcoes.json']) expect(ehRotaPublica(r), r).toBe(false);
  });

  it('entra na navegação do módulo, no registro, na vitrine, na busca e na telemetria; a lacuna vira caminho', async () => {
    // navegação da coleção (NavegacaoColecao, Iniciativa 2): a lista sai do catálogo único, não do layout
    const {navegacaoDaColecao} = await import('@/lib/observatorios/navegacaoColecao');
    expect(navegacaoDaColecao('federais').itens.map((i) => i.href)).toContain(ROTA_AREAS);
    const {paineis} = await import('@/lib/observatorios/registro');
    expect(paineis().some((p) => p.rota === ROTA_AREAS && p.observatorio === 'contas-publicas')).toBe(true);
    expect(ler('src/lib/vitrine.ts')).toContain('PAINEL_AREAS.href');
    expect(ler('src/components/contas-publicas/IndiceFederal.tsx')).toContain('PAINEL_AREAS');
    const {VIEW_SECTIONS} = await import('@/lib/telemetry');
    expect(VIEW_SECTIONS).toContain('contas:por-area');
    const {portas} = await import('@/lib/perguntas/portas');
    const porta = portas().find((p) => p.id === 'contas-publicas')!;
    expect(porta.caminhos.map((c) => c.href)).toContain(ROTA_AREAS);
    expect(porta.lacunas.join(' ')).not.toMatch(/por área/);
    const rotas = JSON.parse(ler('src/lib/uso/rotas-do-app.json')) as string[];
    expect(rotas).toContain(ROTA_AREAS);
  });

  it('a coleta semanal roda o importador por função e publica o snapshot e as respostas do SIOP', () => {
    const cfg = JSON.parse(ler('config/atualizacao/contas-publicas.json'));
    const siop = cfg.grupos.find((g: {id: string}) => g.id === 'siop');
    expect(siop.coleta).toContainEqual(['python3', 'scripts/contas-publicas/importar-funcoes.py', '--recentes']);
    expect(siop.caminhos).toContain('src/lib/contas-publicas/snapshots/funcoes.json');
    expect(cfg.codigo).toContain('scripts/contas-publicas/funcoes.rq');
    // os testes que retêm a publicação incluem o importador (Python) e este arquivo (vitest)
    expect(cfg.testes.some((t: {comando: string[]}) => t.comando.includes('scripts/contas-publicas'))).toBe(true);
    expect(cfg.testes.some((t: {comando: string[]}) => t.comando.includes('src/tests/contas-publicas'))).toBe(true);
  });
});

describe("série com ano sem dado (achado da revisão de 20/10/2026)", () => {
  it("a linha se parte no ano sem dado em vez de ligar os vizinhos", async () => {
    const { LinhaParcela } = await import("@/components/contas-publicas/areas/GraficosArea");
    const pontos = [2012, 2013, 2014, 2015, 2016].map((ano) => ({ ano, valor: ano === 2014 ? null : 1e9, total: ano === 2014 ? null : 1e10, parcela: ano === 2014 ? null : 10, parcial: false }));
    const html = renderToStaticMarkup(createElement(LinhaParcela, { pontos, nome: "Saúde", unidade: "R$ de cada R$ 100" }));
    const d = html.match(/<path d="([^"]+)"/)![1];
    expect(d.match(/M/g)).toHaveLength(2);
    expect(d.match(/L/g)).toHaveLength(2);
  });
});
