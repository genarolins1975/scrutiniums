import {describe, it, expect} from 'vitest';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {amplitude, goldSeguranca, indicador, linhasNacionais, pacoteEstados, serieBR, serieUF, ultimoIndice, ultimoIndiceSimFinal} from '@/lib/eficiencia/seguranca/dados';
import {ehRotaPublica} from '@/lib/rotasPublicas';
import {paineis} from '@/lib/observatorios/registro';
import {portas} from '@/lib/perguntas/portas';
import type {SerieUF} from '@/lib/eficiencia/seguranca/tipos';

/**
 * Painel Segurança pública por UF (Onda 3 da banca de 19/10/2026): contrato da gold gerada por pipeline/seguranca e
 * critério de aceite "nenhum valor escrito à mão no código".
 */
const raiz = process.cwd();
const g = goldSeguranca();
const ler = (p: string) => readFileSync(join(raiz, p), 'utf-8');

describe('Segurança pública: contrato da gold', () => {
  it('27 UFs, anos contínuos, indicadores das quatro fontes', () => {
    expect(g.ufs).toHaveLength(27);
    expect(g.anos).toEqual(Array.from({length: g.anos.length}, (_, k) => g.anos[0] + k));
    expect(new Set(g.indicadores.map((i) => i.fonte))).toEqual(new Set(['sinesp', 'sim', 'siconfi']));
    expect(new Set(g.indicadores.map((i) => i.id)).size).toBe(g.indicadores.length);
    for (const i of g.indicadores) for (const u of g.ufs) expect(g.series[i.id][u.sigla], `${i.id} ${u.sigla}`).toBeDefined();
    expect(g.hash_dados).toMatch(/^[0-9a-f]{64}$/);
  });

  it('a taxa é a contagem sobre a população do mesmo ano, e ausência nunca vira zero', () => {
    for (const i of g.indicadores.filter((x) => x.denominador && !('pct' in g.series[x.id].BR))) {
      for (const u of g.ufs) {
        const s = serieUF(g, i.id, u.sigla);
        g.anos.forEach((a, k) => {
          if (s.situacao[k] === 'incompleto' || s.situacao[k] === 'sem_registro') {
            expect(s.n[k], `${i.id} ${u.sigla} ${a}`).toBeNull();
            expect(s.motivo[k], `${i.id} ${u.sigla} ${a}`).toBeTruthy();
          }
          if (s.n[k] === null) { expect(s.taxa?.[k]).toBeNull(); return; }
          const pop = g.populacao[u.sigla][i.denominador === 'mulheres' ? 'mulheres' : 'total'][k];
          expect(Math.abs((s.taxa?.[k] as number) - (s.n[k] as number) / pop * i.escala), `${i.id} ${u.sigla} ${a}`).toBeLessThan(0.006);
        });
      }
    }
  });

  it('o Brasil soma as UFs com dado e declara quantas entraram', () => {
    for (const i of g.indicadores.filter((x) => !('pct' in g.series[x.id].BR))) {
      const br = serieBR(g, i.id);
      g.anos.forEach((_, k) => {
        const ok = g.ufs.filter((u) => serieUF(g, i.id, u.sigla).situacao[k] === 'ok');
        expect(br.cobertura[k]).toBe(ok.length);
        if (br.n[k] !== null) {
          expect(br.n[k] as number).toBeCloseTo(ok.reduce((s, u) => s + (serieUF(g, i.id, u.sigla).n[k] as number), 0), 1);
          expect(br.situacao[k]).toBe(ok.length === 27 ? 'ok' : 'parcial');
        }
      });
    }
  });

  it('fontes com data de captura, situação do SIM e anos completos do Sinesp', () => {
    for (const f of [g.fontes.sinesp, g.fontes.sim, g.fontes.siconfi, g.fontes.ibge]) expect(f.capturado_em).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(g.anos).toContain(g.fontes.sim.final_ate);
    expect(Object.values(g.fontes.sim.situacao).every((s) => s === 'final' || s === 'preliminar')).toBe(true);
    for (const a of g.fontes.sinesp.anos) expect(g.fontes.sinesp.arquivos[String(a)].meses).toBe(12);
    expect(g.fontes.sinesp.abrangencia).toBe('Estadual');
  });

  it('o CSV publicado traz os mesmos números da gold', () => {
    const csv = ler('public/eficiencia/seguranca-publica/gold/taxas-por-uf.csv');
    const k = ultimoIndice(g, 'homicidio');
    const linha = csv.split('\r\n').find((l) => l.startsWith(`homicidio;`) && l.includes(`;Brasil;${g.anos[k]};`));
    expect(linha).toContain(`;${serieBR(g, 'homicidio').n[k]};vítimas;`);
  });
});

describe('Segurança pública: o que a página mostra', () => {
  it('a comparação por UF leva todas as UFs e os indicadores com série por UF', () => {
    const p = pacoteEstados(g);
    expect(p.ufs).toHaveLength(27);
    expect(p.indicadores.map((i) => i.id)).toContain('homicidio');
    expect(p.indicadores.map((i) => i.id)).toContain('agressoes');
    expect(p.indicadores.map((i) => i.id)).not.toContain('indeterminadas_pct');
    for (const i of p.indicadores) expect(Object.keys(p.series[i.id]).sort()).toEqual([...g.ufs.map((u) => u.sigla), 'BR'].sort());
  });

  it('a abertura usa o último ano com as 27 UFs e o último ano final do SIM', () => {
    const k = ultimoIndice(g, 'homicidio');
    expect(serieBR(g, 'homicidio').situacao[k]).toBe('ok');
    expect(g.anos[ultimoIndiceSimFinal(g)]).toBe(g.fontes.sim.final_ate);
    const amp = amplitude(g, 'homicidio', k);
    expect(amp.max.taxa).toBeGreaterThanOrEqual(amp.min.taxa);
    expect(amp.comparadas).toBe(serieBR(g, 'homicidio').comparadas?.[k]);
  });

  it('cada grupo nacional mostra o ano, a cobertura e a variação só com as 27 UFs nos dois anos', () => {
    for (const grupo of ['letalidade', 'mulheres', 'patrimonio', 'resposta'] as const) {
      const linhas = linhasNacionais(g, grupo);
      expect(linhas.length, grupo).toBeGreaterThan(0);
      for (const l of linhas) {
        expect(g.anos).toContain(l.ano);
        if (l.variacao !== null) expect(l.cobertura).toBe(27);
      }
    }
    expect(indicador(g, 'feminicidio').denominador).toBe('mulheres');
    expect(indicador(g, 'armas').denominador).toBeNull();
  });

  it('nenhum número do painel escrito à mão: anos, valores e datas vêm da gold', () => {
    const arquivos = [
      'src/app/eficiencia-estatal/seguranca-publica/[[...painel]]/page.tsx',
      'src/app/eficiencia-estatal/seguranca-publica/layout.tsx',
      ...readdirSync(join(raiz, 'src/components/eficiencia/seguranca')).map((f) => `src/components/eficiencia/seguranca/${f}`),
      'src/lib/eficiencia/seguranca/dados.ts',
      'src/lib/eficiencia/seguranca/formato.ts',
    ];
    for (const a of arquivos) {
      const texto = ler(a).replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '');
      expect(texto, `${a}: ano escrito à mão`).not.toMatch(/(?<![\w.-])(19|20)\d{2}(?![\w-])/);
      expect(texto, `${a}: valor com separador de milhar escrito à mão`).not.toMatch(/\d{1,3}\.\d{3}(?!\d)/);
      expect(texto, `${a}: valor em reais escrito à mão`).not.toMatch(/R\$\s?\d/);
      expect(texto, `${a}: data escrita à mão`).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
    }
    expect(existsSync(join(raiz, 'public/eficiencia/seguranca-publica/snapshot.json'))).toBe(false);
  });
});

describe('Segurança pública: navegação e acesso', () => {
  it('a comparação por estado vem logo depois do panorama, segue com conta e está no registro', () => {
    // Iniciativa 2: as abas moram na lista única dos temas (src/lib/eficiencia/temas.ts) e chegam à navegação da coleção, que leva
    // o selo "com conta" em cada destino numa página aberta
    const temas = ler('src/lib/eficiencia/temas.ts');
    expect(temas.indexOf('["estados", "Por estado"]')).toBeGreaterThan(temas.indexOf('seguranca: separar('));
    expect(temas.indexOf('["estados", "Por estado"]')).toBeLessThan(temas.indexOf('["letalidade"'));
    expect(ler('src/app/eficiencia-estatal/seguranca-publica/layout.tsx')).toContain('navegacao="seguranca"');
    expect(ler('src/components/layout/NavegacaoColecaoCliente.tsx')).toContain('<SeloComConta href={p.href} />');
    expect(ehRotaPublica('/eficiencia-estatal/seguranca-publica/estados')).toBe(false);
    expect(ehRotaPublica('/eficiencia-estatal/seguranca-publica')).toBe(false);
    expect(ehRotaPublica('/eficiencia-estatal/seguranca-publica/metodos')).toBe(true);
    expect(ehRotaPublica('/eficiencia/seguranca-publica/gold/seguranca.json')).toBe(false);
    expect(paineis().some((p) => p.rota === '/eficiencia-estatal/seguranca-publica/estados' && p.observatorio === 'servicos-publicos')).toBe(true);
  });

  it('a camada aberta troca a lacuna pelo caminho para a comparação por estado', () => {
    const p = portas().find((x) => x.id === 'servicos-publicos')!;
    expect(p.lacunas.join(' ')).not.toMatch(/Violência comparável/);
    expect(p.caminhos.map((c) => c.href)).toContain('/eficiencia-estatal/seguranca-publica/estados');
    expect(p.metodos.map((m) => m.href)).toContain('/eficiencia-estatal/seguranca-publica/metodos');
  });

  it('a série de uma UF tem um valor por ano da gold', () => {
    const s = g.series.homicidio.SP as SerieUF;
    expect(s.n).toHaveLength(g.anos.length);
    expect(s.posicao).toHaveLength(g.anos.length);
  });
});
