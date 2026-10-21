import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {valor} from '@/lib/eficiencia/mobilidade/modelo';

/**
 * Item 10 do diagnóstico de layout de 20/10/2026: os temas da Eficiência Estatal usam um só subcabeçalho (caminho e abas,
 * no molde da Saúde nas capitais), abrem com uma pergunta e não numeram capítulos; reais vêm com o símbolo antes do número.
 */
const ler = (p: string) => readFileSync(p, 'utf8');
const TEMAS: [string, string][] = [
  ['seguranca-publica', 'src/app/eficiencia-estatal/seguranca-publica/layout.tsx'],
  ['habitacao', 'src/app/eficiencia-estatal/habitacao/layout.tsx'],
  ['assistencia-social', 'src/app/eficiencia-estatal/assistencia-social/layout.tsx'],
  ['cultura', 'src/app/eficiencia-estatal/cultura/layout.tsx'],
  ['mobilidade-transporte', 'src/app/eficiencia-estatal/mobilidade-transporte/[[...painel]]/page.tsx'],
  ['energia-conectividade', 'src/app/eficiencia-estatal/energia-conectividade/[[...painel]]/page.tsx'],
  ['meio-ambiente-clima', 'src/app/eficiencia-estatal/meio-ambiente-clima/[[...painel]]/page.tsx'],
];
const SLOGANS = ['Criar. Preservar. Participar.', 'Chegar aonde precisa', 'Energia que chega. Conexão que permite participar.', 'Ambiente saudável. Territórios preparados.'];

describe('temas da Eficiência Estatal: um só subcabeçalho', () => {
  it.each(TEMAS)('%s usa o cabeçalho comum com o tema, sem voltar ao link solto nem a uma barra de abas própria', (_tema, arquivo) => {
    const fonte = ler(arquivo);
    expect(fonte).toContain('<CabecalhoEntrada tema=');
    expect(fonte).not.toMatch(/Panorama do OBEE|Todas as áreas do OBEE/);
    expect(fonte).not.toMatch(/<nav aria-label=/);
  });
  it('a mobilidade não desenha mais navegação dentro do painel', () => {
    for (const f of ['src/components/eficiencia/mobilidade/PainelMobilidade.tsx', 'src/components/eficiencia/mobilidade/PainelOportunidades.tsx']) {
      expect(ler(f), f).not.toMatch(/Panorama do OBEE|<nav /);
    }
  });
  it('as abas marcam a visão atual por aria-current e levam o selo "com conta"', () => {
    const nav = ler('src/components/eficiencia/NavegacaoTemaObee.tsx');
    expect(nav).toContain('aria-current={atual(c) ? "page" : undefined}');
    expect(nav.match(/<SeloComConta href=\{href\(c\)\} \/>/g)).toHaveLength(2);
  });
});

describe('temas da Eficiência Estatal: pergunta, sem numeração, reais no padrão brasileiro', () => {
  it('nenhum panorama abre com os slogans de antes', () => {
    const fontes = [...TEMAS.map(([, f]) => f), 'src/app/eficiencia-estatal/cultura/[[...painel]]/page.tsx', 'src/lib/eficiencia/mobilidade/modelo.ts'].map(ler).join('\n');
    for (const s of SLOGANS) expect(fontes).not.toContain(s);
  });
  it('habitação, cultura e segurança não numeram capítulos (01, 02...)', () => {
    expect(ler('src/components/eficiencia/habitacao/Editoria.tsx')).not.toContain('{numero} / Habitação');
    expect(ler('src/app/eficiencia-estatal/cultura/[[...painel]]/page.tsx')).not.toMatch(/0\{i\+1\}/);
    expect(ler('src/app/eficiencia-estatal/seguranca-publica/[[...painel]]/page.tsx')).not.toContain("padStart(2, '0')");
  });
  it('reais vêm com o símbolo antes do número', () => {
    expect(valor(5, 'R$')).toBe('R$ 5,00');
    expect(valor(1234.5, 'R$')).toBe('R$ 1.234,50');
    expect(valor(null, 'R$')).toBe('Não disponível');
    expect(valor(42.1, '%')).toBe('42,1%');
  });
  it('cultura, energia e meio ambiente têm um gráfico de dado real na abertura', () => {
    expect(ler('src/app/eficiencia-estatal/cultura/[[...painel]]/page.tsx')).toContain("r.aba==='B10'&&r.categoria==='Sim'");
    expect(ler('src/app/eficiencia-estatal/energia-conectividade/[[...painel]]/page.tsx').match(/<FiguraDec anual=\{q\.brasil\.anual\}\/>/g)).toHaveLength(2);
    expect(ler('src/app/eficiencia-estatal/meio-ambiente-clima/[[...painel]]/page.tsx')).toContain('<FiguraRegioes/>');
  });
});
