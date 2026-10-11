import {describe,it,expect} from 'vitest';
import {dados,brasil} from '@/lib/eficiencia/habitacao/dados';
import {MEDIDAS,valor,csv,pct} from '@/lib/eficiencia/habitacao/modelo';
describe('Habitação: estimativas, universos e divergências preservadas',()=>{
 it('mantém níveis territoriais separados',()=>{expect(dados.territorios).toHaveLength(33);expect(dados.territorios.filter(r=>r.tipo==='UF')).toHaveLength(27);expect(dados.territorios.filter(r=>r.tipo==='Região')).toHaveLength(5);});
 it('confere o total e o denominador nacional',()=>{expect(Math.round(brasil.deficit)).toBe(5773983);expect(brasil.inadequados).toBe(27861107);expect(valor(brasil,MEDIDAS.deficit[0],'relativo')).toBeCloseTo(7.405671664875386,8);});
 it('não trata ônus como percentual de todos os inquilinos',()=>{expect(MEDIDAS.aluguel[0].denominador).toBe('deficit');expect(valor(brasil,MEDIDAS.aluguel[0],'relativo')).toBeGreaterThan(62);});
 it('preserva divergências PI e CE e usa total da tabela de renda',()=>{const pi=dados.territorios.find(r=>r.id==='PI')!,ce=dados.territorios.find(r=>r.id==='CE')!;expect(pi.rendaTotal-pi.deficit).toBeCloseTo(545.811612,4);expect(ce.rendaTotal-ce.deficit).toBeCloseTo(-545.811612,4);expect(valor(pi,MEDIDAS.renda[0],'relativo')).toBe(100*pi.renda1/pi.rendaTotal);});
 it('não substitui total fundiário por casos exclusivos',()=>{expect(brasil.fundiaria).toBe(3250536);expect(Math.round(brasil.fundiariaExclusiva)).toBe(2153611);const m=MEDIDAS.inadequacao.find(m=>m.id==='fundiaria')!;expect(m.denominador).toBe('urbanosDuraveis');expect(valor(brasil,m,'relativo')).toBeLessThan(5);});
 it('componentes de inadequação podem se sobrepor',()=>{expect(brasil.infraestrutura+brasil.edilicia+brasil.fundiaria).toBeGreaterThan(brasil.inadequados);expect(brasil.urbanosDuraveis).not.toBe(brasil.domicilios);});
 it('valores nulos não viram zero quando denominador é inválido',()=>{expect(pct(10,0)).toBeNull();expect(valor({...brasil,domicilios:0},MEDIDAS.deficit[0],'relativo')).toBeNull();});
 it('exporta com precisão, escape e ausência distinta de zero',()=>{expect(csv(['A'],[[null],[0],['a"b']])).toBe('\ufeff"A"\r\n""\r\n"0"\r\n"a""b"');});
 it('mantém localização da evidência por campo',()=>{for(const r of dados.territorios){expect(r.origem.deficit).toMatch(/Deficit_habitacional!C\d+:F\d+/);expect(r.origem.fundiaria).toContain('tabela 30');}});
 it('originais têm hashes e URLs públicas',()=>{expect(dados.fontes).toHaveLength(4);for(const f of dados.fontes){expect(f.sha256).toMatch(/^[a-f0-9]{64}$/);expect(f.url).toMatch(/^https:/);}});
});
