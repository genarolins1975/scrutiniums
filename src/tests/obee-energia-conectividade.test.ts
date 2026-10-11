import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {dadosEnergia,internet,numero} from '@/lib/eficiencia/energia/dados';
import {GET} from '@/app/eficiencia-estatal/energia-conectividade/dados.csv/route';
describe('OBEE: reutilização dos contratos do Setor Elétrico',()=>{
 it('preserva agregados, períodos e exclusões sem nova ponderação',()=>{const q=JSON.parse(readFileSync('public/energia/gold/qualidade.json','utf8'));const atual=dadosEnergia();expect(atual.qualidade.brasil).toEqual(q.brasil);expect(atual.qualidade.parcial).toEqual(q.parcial);expect(atual.qualidade.distribuidoras).toEqual(q.distribuidoras);});
 it('preserva ausências e arredondamento amostral',()=>{expect(numero(null)).toBe('Não disponível');expect(numero(0)).toBe('0,0');const registros=dadosEnergia().inclusao.acesso.pnad_serie;expect(registros.some(r=>r.domicilios_sem_energia_estado==='menos_de_1_mil'&&r.domicilios_sem_energia_mil===null)).toBe(true);});
 it('converte R$/MWh em custo sem confundir com fatura',()=>{const tarifas=dadosEnergia().conta.tarifas.vigentes;expect(tarifas.length).toBeGreaterThan(0);for(const t of tarifas){expect(t.total).toBeCloseTo(t.te+t.tusd,2);expect(t.inicio<=t.fim).toBe(true);}expect(1000*tarifas[0].total/1000).toBe(tarifas[0].total);});
 it('exporta todo o recorte de internet com universo, fonte e período',async()=>{const r=GET();const csv=await r.text();expect(r.headers.get('content-type')).toContain('text/csv');expect(csv.trim().split('\r\n')).toHaveLength(internet.registros.length+1);for(const row of internet.registros)expect(csv).toContain(row.territorio+';'+internet.ano);expect(csv).toContain(internet.fonte);expect(csv).toContain(internet.universo);});
});
