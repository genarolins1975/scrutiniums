import {describe,it,expect} from 'vitest';
import {createElement,isValidElement,Children,type ReactNode,type ReactElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import data from '@/lib/eficiencia/panorama-atlas.json';
import {PanoramaTerritorial,panoramaDistribution} from '@/components/eficiencia/PanoramaTerritorial';

type ControlProps={children?:ReactNode;onClick?:()=>void;'aria-label'?:string;'aria-disabled'?:boolean;'aria-pressed'?:boolean};
function controls(node:ReactNode):ReactElement<ControlProps>[] {
  return Children.toArray(node).flatMap(child=>isValidElement<ControlProps>(child)?[child,...controls(child.props.children)]:[]);
}

describe('Distribuição das capitais no panorama',()=>{
  it('escolha pela tabela envia a capital correta e atualiza os quatro temas',()=>{
    const choices:string[]=[];
    const tree=PanoramaTerritorial({place:'2611606',reference:'4106902',onEducation:()=>{},onReference:id=>choices.push(id)});
    const buttons=controls(tree).filter(node=>node.type==='button');
    expect(buttons).toHaveLength(104);
    for(const city of data.cities){
      const cityButtons=buttons.filter(node=>node.props['aria-label']===`Comparar Recife com ${city.name}`);
      expect(cityButtons).toHaveLength(4);
      choices.length=0;cityButtons.forEach(node=>node.props.onClick!());
      if(['2611606','4106902'].includes(city.id))expect(choices).toEqual([]);
      else expect(choices).toEqual([city.id,city.id,city.id,city.id]);
      const updated=controls(PanoramaTerritorial({place:'2611606',reference:city.id,onEducation:()=>{},onReference:()=>{}})).filter(node=>node.type==='button'&&node.props['aria-pressed']);
      expect(updated).toHaveLength(4);
      expect(updated.every(node=>node.props['aria-label']===`Comparar Recife com ${city.name}`)).toBe(true);
    }
  });
  it('sem ação fornecida mantém tabela de leitura sem botões inoperantes',()=>{
    const tree=PanoramaTerritorial({place:'2611606',reference:'4106902',onEducation:()=>{}});
    expect(controls(tree).filter(node=>node.type==='button')).toHaveLength(0);
    const html=renderToStaticMarkup(tree);
    expect(html).toContain('role="status"');
    expect(html).not.toContain('Escolha outra capital pelo nome');
  });
  it.each(data.metrics)('$id preserva todas as capitais, valores e escala',metric=>{
    const {points,rows,axisY}=panoramaDistribution(metric);
    expect(rows).toHaveLength(26);
    expect(points).toHaveLength(metric.reference.count);
    expect(rows.map(r=>r.name)).toEqual([...rows.map(r=>r.name)].sort((a,b)=>a.localeCompare(b,'pt-BR')));
    for(const p of points){
      expect(p.value).toBe(metric.observations.find(o=>o.territory===p.id)!.value);
      expect(p.x).toBeGreaterThanOrEqual(32);expect(p.x).toBeLessThanOrEqual(368);
      expect(p.y).toBeLessThan(axisY);
      for(const other of points.filter(q=>q.id!==p.id&&q.y===p.y))expect(Math.abs(p.x-other.x)).toBeGreaterThanOrEqual(14);
    }
  });
  it('empates permanecem visíveis, inclusive zero e seleção coincidente',()=>{
    const metric=structuredClone(data.metrics[0]);
    metric.observations.forEach(o=>{o.value=0;});
    const result=panoramaDistribution(metric);
    expect(result.points).toHaveLength(26);
    expect(new Set(result.points.map(p=>p.y)).size).toBe(26);
    expect(result.points.every(p=>p.x===32)).toBe(true);
    const html=renderToStaticMarkup(createElement(PanoramaTerritorial,{place:'2611606',reference:'2611606',onEducation:()=>{}}));
    expect(html).toContain('Território selecionado');expect(html).toContain('Comparador selecionado');
    expect(html).not.toContain('NaN');
  });
  it('ausência e inelegibilidade não viram pontos no zero',()=>{
    const metric=structuredClone(data.metrics[0]);
    metric.observations[0].eligible=false;
    metric.observations.splice(1,1);
    const {rows,points}=panoramaDistribution(metric);
    expect(rows).toHaveLength(26);expect(points).toHaveLength(24);
    expect(rows.filter(r=>r.value===null)).toHaveLength(2);
  });
  it('tabela equivalente mantém 104 observações, seleções, notas e CSV',()=>{
    const html=renderToStaticMarkup(createElement(PanoramaTerritorial,{place:'2611606',reference:'4106902',onEducation:()=>{}}));
    expect(html.match(/Comparar as 26 capitais/g)).toHaveLength(4);
    expect(html.match(/Território selecionado/g)).toHaveLength(4);
    expect(html.match(/Comparador selecionado/g)).toHaveLength(4);
    for(const city of data.cities)expect(html).toContain(city.name);
    expect(html).toContain('a altura não representa outra medida');
    expect(html).toContain('panorama-capitais.csv');
    expect(html).toContain('Capacidade teórica');
    expect(html).toContain('não formam uma nota');
  });
});
