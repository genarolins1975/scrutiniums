import {describe,it,expect,vi} from 'vitest';
// A página importa módulos marcados com server-only; no teste, o marcador não tem efeito.
vi.mock('server-only',()=>({}));
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {DIMENSOES} from '@/lib/eficiencia/dimensoes';
import PaginaEntradaEficiencia from '@/app/eficiencia-estatal/page';

describe('Matriz de cobertura da entrada',()=>{
  const html=renderToStaticMarkup(createElement(PaginaEntradaEficiencia));
  it('traz os 16 temas, com ficha para cada painel publicado',()=>{
    for(const d of DIMENSOES)expect(html).toContain(`id="cobertura-${d.id}"`);
    expect(html.match(/Painel publicado/g)).toHaveLength(13);
    expect(html.match(/Em desenvolvimento/g)).toHaveLength(3);
    for(const t of ['O que não inclui','Última captura de dados','Até onde cada tema chega.','Aprendizagem · Saeb'])expect(html).toContain(t);
    expect(html).toContain('href="/eficiencia-estatal/saude-capitais/comparar"');
  });
  it('cada nível territorial declarado tem marca e texto para leitor de tela',()=>{
    expect(html.match(/: sim\./g)!.length).toBeGreaterThan(0);
    expect((html.match(/: sim\./g)!.length)+(html.match(/: não\./g)!.length)).toBe(16*6);
    expect(html).toContain('Tem indicador no índice de resultados v4, 26 capitais, 2022: sim.');
  });
});
