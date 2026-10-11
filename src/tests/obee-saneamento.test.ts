import {describe,it,expect} from 'vitest';
import {indicadores,valores,fontes,brasil} from '@/lib/eficiencia/saneamento/dados';
import {ordenar,csv,formatar} from '@/lib/eficiencia/saneamento/modelo';
describe('Saneamento: contratos e universos SINISA 2025',()=>{
 it('preserva 33 territórios nos consolidados e 6 nos relatórios',()=>{for(const m of indicadores){const rs=valores.filter(r=>r.indicador===m.id);expect(rs).toHaveLength(['residuos','drenagem'].includes(m.grupo)?6:33);expect(new Set(rs.map(r=>r.id)).size).toBe(rs.length);}});
 it('não confunde Sergipe e Sudeste',()=>{const rs=valores.filter(r=>r.indicador==='IAG0001');expect(rs.find(r=>r.id==='SE')?.nome).toBe('Sergipe');expect(rs.find(r=>r.id==='R-SE')?.nome).toBe('Sudeste');});
 it('preserva referências publicadas e diferentes denominadores de esgoto',()=>{expect(brasil('IAG0001')).toBe(84.14);expect(brasil('IES0001')).toBe(62.3);expect(brasil('IES2003')).toBe(51.78);expect(brasil('IES2004')).toBe(85.16);});
 it('associa corretamente Nordeste e Centro-Oeste no gráfico original de destinação',()=>{expect(valores.find(r=>r.indicador==='IRS3002'&&r.id==='R-NE')?.valor).toBe(33.1);expect(valores.find(r=>r.indicador==='IRS3002'&&r.id==='R-CO')?.valor).toBe(48.7);});
 it('risco regional fecha com o total nacional sem confundir ocorrência',()=>{expect(valores.filter(r=>r.indicador==='DOM_RISCO'&&r.tipo==='Região').reduce((a,r)=>a+r.valor!,0)).toBe(2694600);});
 it('expõe e usa os denominadores financeiros próprios',()=>{for(const r of valores.filter(r=>r.indicador.endsWith('_HAB'))){if(r.valor!==null)expect(r.valor).toBeCloseTo(r.numerador!/r.denominador!,8)}expect(valores.find(r=>r.indicador==='ES_DESPESA_HAB'&&r.id==='BR')?.denominador).toBe(188255906);expect(brasil('AG_DESPESA')).toBe(70556553250.28);});
 it('não trunca percentuais maiores que 100',()=>{expect(valores.find(r=>r.indicador==='IAG2003'&&r.id==='PR')?.valor).toBeGreaterThan(100);});
 it('mantém ausência e zero distintos e ordena ausências por último',()=>{const a=valores[0];expect(ordenar([{...a,id:'x',valor:null},{...a,id:'y',valor:0}],'menor')[0].id).toBe('y');expect(formatar(null,indicadores[0])).toBe('Não informado');expect(formatar(0,indicadores[0])).toBe('0,00%');expect(csv(['v'],[[null],[0]])).toBe('\ufeff"v"\r\n""\r\n"0"');});
 it('todos os registros têm fonte e localizador',()=>{for(const m of indicadores)expect(fontes.some(f=>f.id===m.fonte)).toBe(true);for(const r of valores)expect(r.origem.length).toBeGreaterThan(10);for(const f of fontes)expect(f.sha256).toMatch(/^[a-f0-9]{64}$/);});
});
