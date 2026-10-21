import {describe,it,expect} from 'vitest';
import {dadosMobilidade} from '../lib/eficiencia/mobilidade/dados';
const {base:g}=dadosMobilidade();
const tempos=['19429','79189','79190','19431','19432','79191','79192'];
const modos=['79193','79194','79195','79196','79197','79198','79207','79208','79209','79210','79211','79212','79213','79214'];
const porLocal=new Map(g.territories.map(t=>[t.id,new Map<string,typeof g.observations[number]>()]));
for(const o of g.observations)porLocal.get(o.territory)!.set(o.metric,o);
describe('Censo integrado: composição, resíduos e denominadores',()=>{
 it('tem Brasil, UFs e municípios sem simular contemporaneidade',()=>{expect(g.territories.filter(t=>t.level==='brasil')).toHaveLength(1);expect(g.territories.filter(t=>t.level==='uf')).toHaveLength(27);expect(g.territories.filter(t=>t.level==='municipio').length).toBeGreaterThan(5500);expect(g.metrics.filter(m=>m.id.startsWith('censo.')).every(m=>m.period==='2022')).toBe(true);});
 it('preserva parcelas e separa diferenças calculadas',()=>{for(const rows of porLocal.values()){for(const [group,cats]of [['tempo',tempos],['modos',modos]] as const){const r=rows.get('censo.'+group+'.residuo');if(r?.value==null)continue;const leaves=cats.map(c=>rows.get('censo.'+group+'.'+c));expect(leaves.every(o=>o?.state==='observado')).toBe(true);expect(leaves.reduce((s,o)=>s+o!.numerator!,0)+r.numerator!).toBe(r.denominator);}}});
 it('mais de uma hora não aloca o resíduo',()=>{for(const rows of porLocal.values()){const r=rows.get('censo.tempo.longo');if(r?.value==null)continue;const parts=['19432','79191','79192'].map(c=>rows.get('censo.tempo.'+c));expect(parts.reduce((s,o)=>s+o!.numerator!,0)).toBe(r.numerator);expect(100*r.numerator!/r.denominator!).toBeCloseTo(r.value,8);}});
 it('fontes compostas preservam também as partes originais',()=>{expect(g.sources.some(s=>s.arquivo==='censo_2022_537_parte_1.json')).toBe(true);expect(g.sources.some(s=>s.arquivo==='censo_2022_2088_parte_3.json')).toBe(true);expect(g.metrics.filter(m=>m.id.endsWith('.residuo')).every(m=>m.definition.includes('não é uma categoria do IBGE'))).toBe(true);});
});
