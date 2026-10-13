import {describe,it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {DIMENSOES,GRUPOS,estadoCatalogo} from '@/lib/eficiencia/dimensoes';
import {AtlasCidadao} from '@/components/eficiencia/AtlasCidadao';

describe('Catálogo do Atlas',()=>{
  it('ficha acompanha a busca quando o capítulo anterior fica fora dos resultados',()=>{
    const {visible,dimension}=estadoCatalogo('justiça','Todas','educacao');
    expect(visible.map(d=>d.id)).toContain('justica');
    expect(dimension?.id).toBe('justica');
    expect(visible).toContain(dimension);
  });
  it.each(GRUPOS)('a ficha pertence à área %s',grupo=>{
    const {visible,dimension}=estadoCatalogo('',grupo,'educacao');
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.every(d=>d.grupo===grupo)).toBe(true);
    expect(dimension?.grupo).toBe(grupo);
  });
  it('a busca alcança recursos, acesso e resultados, ignorando acentos',()=>{
    expect(estadoCatalogo('fiscalizacao','Todas','educacao').visible.map(d=>d.id)).toContain('ambiente');
    expect(estadoCatalogo('regularizacao fundiaria','Todas','educacao').dimension?.id).toBe('habitacao');
    expect(estadoCatalogo('aposentadorias','Todas','educacao').dimension?.id).toBe('previdencia');
  });
  it('sem resultado não mostra ficha residual; limpar recupera a seleção',()=>{
    expect(estadoCatalogo('zzzinexistente','Todas','saude')).toEqual({visible:[],dimension:null});
    expect(estadoCatalogo('','Todas','saude').dimension?.id).toBe('saude');
    for(const d of DIMENSOES)expect(estadoCatalogo('',d.grupo,d.id).dimension?.id).toBe(d.id);
  });
  it('acesso de cobertura no estado inicial aponta ao capítulo, sem alterar o panorama',()=>{
    const html=renderToStaticMarkup(createElement(AtlasCidadao));
    expect(html).toContain('href="#cobertura-educacao"');
    expect(html).toContain('Consultar cobertura e fontes de Educação');
    expect(html).toContain('A vida no território, lado a lado.');
    expect(html).toContain('Aprendizagem · Saeb');
  });
});
