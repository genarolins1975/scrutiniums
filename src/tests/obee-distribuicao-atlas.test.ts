import {describe,it,expect} from 'vitest';
import {createElement,isValidElement,Children,type ReactNode,type ReactElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {montarRetrato} from '@/lib/eficiencia/entrada';
import {faixa,mediana,type Medida} from '@/lib/eficiencia/entrada-nucleo';
import {PerguntasCapital} from '@/components/eficiencia/entrada/PerguntasCapital';

type ControlProps={children?:ReactNode;onClick?:()=>void;'aria-disabled'?:boolean};
function controls(node:ReactNode):ReactElement<ControlProps>[] {
  return Children.toArray(node).flatMap(child=>isValidElement<ControlProps>(child)?[child,...controls(child.props.children)]:[]);
}
const retrato=montarRetrato();
const medidas=[...retrato.condicoes,...retrato.recursos];
const a=retrato.capitais.find(c=>c.id==='2611606')!,b=retrato.capitais.find(c=>c.id==='4106902')!;
const props=(onReference:(id:string)=>void)=>({id:'perguntas',eyebrow:'01',titulo:'Sete perguntas',texto:'',medidas:retrato.condicoes,a,b,capitais:retrato.capitais,onReference});

describe('Faixa das 26 capitais na entrada',()=>{
  it.each(medidas.map(m=>[m.id,m] as const))('%s preserva capitais elegíveis, valores, escala e mediana',(_,m)=>{
    const f=faixa(m);
    const elegiveis=Object.entries(m.valores).filter(([,v])=>v.valor!==null&&!v.foraDaComparacao);
    expect(f.pontos).toHaveLength(elegiveis.length);
    for(const p of f.pontos){
      expect(p.valor).toBe(m.valores[p.id].valor);
      expect(p.x).toBeGreaterThanOrEqual(12);expect(p.x).toBeLessThanOrEqual(388);
      for(const q of f.pontos.filter(q=>q.id!==p.id&&q.trilha===p.trilha))expect(Math.abs(p.x-q.x)).toBeGreaterThanOrEqual(11);
    }
    expect(f.mediana).toBe(mediana(elegiveis.map(([,v])=>v.valor!)));
  });

  it('as condições usam as 26 capitais e a mediana simples, sem ponderação populacional',()=>{
    for(const m of retrato.condicoes){
      const v=Object.values(m.valores).map(x=>x.valor!).sort((x,y)=>x-y);
      expect(v).toHaveLength(26);
      expect(faixa(m).mediana).toBe((v[12]+v[13])/2);
    }
  });

  it('empates permanecem visíveis, inclusive zero',()=>{
    const m:Medida=structuredClone(retrato.condicoes[0]);
    for(const k of Object.keys(m.valores))m.valores[k]={valor:0};
    const f=faixa(m);
    expect(f.pontos).toHaveLength(26);
    expect(new Set(f.pontos.map(p=>p.trilha)).size).toBe(26);
    expect(new Set(f.pontos.map(p=>p.x)).size).toBe(1);
    expect(f.mediana).toBe(0);
  });

  it('ausência e inelegibilidade não viram pontos nem entram na mediana',()=>{
    const m:Medida=structuredClone(retrato.condicoes[0]);
    const [x,y]=Object.keys(m.valores);
    m.valores[x]={valor:null};m.valores[y]={valor:m.valores[y].valor,foraDaComparacao:'Perímetro distinto'};
    const f=faixa(m);
    expect(f.pontos).toHaveLength(24);
    expect(f.pontos.some(p=>p.id===x||p.id===y)).toBe(false);
    const html=renderToStaticMarkup(createElement(PerguntasCapital,{...props(()=>{}),medidas:[m],a:retrato.capitais.find(c=>c.id===x)!,b:retrato.capitais.find(c=>c.id===y)!}));
    expect(html).toContain('Não disponível');expect(html).toContain('Diferença indisponível');
    expect(html).toContain('Perímetro distinto; valor exibido, fora da faixa e da mediana.');
    expect(html).toContain('Diferença indisponível: valor fora da comparação');
    expect(html).not.toContain('NaN');
  });

  it('valor fora da comparação aparece, mas não gera diferença (Macapá, Saúde 2025)',()=>{
    const saude=retrato.recursos.find(m=>m.id==='saude_despesa')!;
    expect(saude.valores['1600303'].foraDaComparacao).toBeTruthy();
    const macapa=retrato.capitais.find(c=>c.id==='1600303')!;
    const html=renderToStaticMarkup(createElement(PerguntasCapital,{...props(()=>{}),medidas:[saude],a:macapa,b}));
    expect(html).toContain('R$ 1.011,42');
    expect(html).toContain('Diferença indisponível: valor fora da comparação');
    expect(html).not.toMatch(/−R\$ [\d.]+,\d{2}<\/p>|\+R\$ [\d.]+,\d{2} <span>/);
  });

  it('a tabela equivalente traz as 26 capitais e troca o comparador pelo nome',()=>{
    const escolhas:string[]=[];
    const botoes=controls(PerguntasCapital(props(id=>escolhas.push(id)))).filter(n=>n.type==='button');
    expect(botoes).toHaveLength(26);
    botoes.forEach(n=>n.props.onClick!());
    expect(escolhas).toHaveLength(24);
    expect(escolhas).not.toContain(a.id);expect(escolhas).not.toContain(b.id);
    const html=renderToStaticMarkup(createElement(PerguntasCapital,props(()=>{})));
    for(const c of retrato.capitais)expect(html).toContain(c.nome);
    expect(html).toContain('Selecionada');expect(html).toContain('Comparador');
    expect(html).toContain('Mediana das capitais');
  });
});
