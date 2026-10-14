import {describe,it,expect,vi} from 'vitest';
// A página importa módulos marcados com server-only; no teste, o marcador não tem efeito.
vi.mock('server-only',()=>({}));
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import data from '@/lib/eficiencia/panorama-atlas.json';
import frequency from '@/lib/eficiencia/frequencia-escolar.json';
import {montarRetrato} from '@/lib/eficiencia/entrada';
import {hrefPainel,diferenca} from '@/lib/eficiencia/entrada-nucleo';
import PaginaEntradaEficiencia from '@/app/eficiencia-estatal/page';

const retrato=montarRetrato();

describe('Panorama municipal do Atlas',()=>{
  it('preserva as 104 observações dos quatro contratos e seus hashes',()=>{
    const health=JSON.parse(readFileSync('public/eficiencia/gold/saude_capitais.json','utf8'));
    const work=JSON.parse(gunzipSync(Buffer.from(readFileSync('public/eficiencia/trabalho-renda/snapshot.payload.gz.b64','utf8'),'base64')).toString());
    const mobility=JSON.parse(readFileSync('data/eficiencia_mobilidade/gold.json','utf8'));
    for(const m of data.metrics){
      expect(createHash('sha256').update(readFileSync(m.sourcePath)).digest('hex')).toBe(m.sourceHash);
      expect(m.observations).toHaveLength(26);expect(new Set(m.observations.map(o=>o.territory)).size).toBe(26);
      for(const o of m.observations){
        // A conferência parte das observações originais dos capítulos, não do gerador do resumo.
        const expected=m.id==='educacao'?frequency.observations.find(r=>r.territory===o.territory&&r.age==='47813')?.value:
          m.id==='saude'?health.observacoes.find((r:{indicador:string;ente:number;ano:number})=>r.indicador==='sau.aps.cobertura_potencial'&&String(r.ente)===o.territory&&r.ano===2025)?.valor:
          m.id==='trabalho'?work.observacoes.find((r:{indicadorId:string;territorioId:string;sexo:string;grupo:string;periodo:string})=>r.indicadorId==='renda-mediana'&&r.territorioId===o.territory&&r.sexo==='total'&&r.grupo==='Total'&&r.periodo==='2022')?.valor:
          mobility.observations.find((r:{metric:string;territory:string;period:string})=>r.metric==='censo.tempo.longo'&&r.territory===o.territory&&r.period==='2022')?.value;
        expect(o.value).toBe(expected??null);
        if(m.id==='mobilidade'&&o.value!==null)expect(o.value).toBeCloseTo(100*o.numerator!/o.denominator!,10);
      }
    }
  });
  it('referência usa só capitais elegíveis no mesmo indicador, sem média de população',()=>{
    for(const m of data.metrics){
      const values=m.observations.filter(o=>o.eligible&&o.value!==null).map(o=>o.value!).sort((a,b)=>a-b);
      expect(m.reference.count).toBe(values.length);
      expect(m.reference.value).toBe((values[12]+values[13])/2);
      expect(m.reference.method).toContain('Não é meta');
      expect(m.scaleMax).toBeGreaterThanOrEqual(Math.max(...values));
    }
    expect(data.metrics.find(m=>m.id==='saude')!.scaleMax).toBeGreaterThan(100);
  });
  it('a entrada usa os mesmos valores do panorama nas medidas em comum',()=>{
    const pares:[string,string][]=[['educacao','educacao'],['trabalho','trabalho'],['mobilidade','mobilidade']];
    for(const [panorama,condicao] of pares){
      const m=data.metrics.find(x=>x.id===panorama)!,c=retrato.condicoes.find(x=>x.id===condicao)!;
      for(const o of m.observations)expect(c.valores[o.territory].valor).toBe(o.value);
    }
    const aps=data.metrics.find(x=>x.id==='saude')!,r=retrato.recursos.find(x=>x.id==='aps')!;
    for(const o of aps.observations)expect(r.valores[o.territory].valor).toBe(o.eligible?o.value:null);
  });
  it('zero, ausência e inelegibilidade têm comportamentos distintos na diferença',()=>{
    expect(diferenca(0,1,'%')).toBe('−1,0 p.p.');
    expect(diferenca(null,1,'%')).toBe('Diferença indisponível');
    expect(diferenca(2,2,'R$')).toBe('R$ 0,00');
  });
  it('CSV mantém todos os territórios, precisão e estados',()=>{
    const csv=readFileSync('public/eficiencia/atlas/panorama-capitais.csv','utf8');
    expect(csv.trim().split('\n')).toHaveLength(105);
    for(const m of data.metrics)for(const o of m.observations){
      const name=data.cities.find(c=>c.id===o.territory)!.name;
      const row=csv.split('\n').find(line=>line.startsWith(`${o.territory},${name},${m.chapter},`))!;
      const match=row.match(/,([^,]*),(True|False),(observado|OBSERVADO),/)!;
      expect(Number(match[1])).toBe(o.value);expect(match[2]).toBe(o.eligible?'True':'False');expect(match[3]).toBe(o.state);
      expect(csv).toContain(m.sourceHash);
    }
  });
  it('aprofundamento preserva parâmetros suportados pelos capítulos',()=>{
    const painel=(id:string)=>[...retrato.condicoes,...retrato.recursos].find(m=>m.id===id)!.painel!;
    expect(painel('educacao').href).toBe('#atlas-comparacao');
    const h=new URL(hrefPainel(painel('aps'),'2611606','4106902'),'https://example.test');
    expect(h.searchParams.get('med')).toBe('cobertura_aps');expect(h.searchParams.get('ano')).toBe('2025');
    const saude=data.metrics.find(m=>m.id==='saude')!;
    expect(h.searchParams.get('cap')).toBe(saude.territoryKeys!['2611606']);
    expect(h.searchParams.get('vs')).toBe(saude.territoryKeys!['4106902']);
    expect(hrefPainel(painel('trabalho'),'2611606','4106902')).toContain('ter=2611606&med=renda-mediana&per=2022');
    expect(hrefPainel(painel('mobilidade'),'2611606','4106902')).toContain('territorio=2611606');
  });
  it('entrada apresenta limites materiais, fontes e a faixa do índice de resultados',()=>{
    const html=renderToStaticMarkup(createElement(PaginaEntradaEficiencia));
    for(const text of ['Capacidade teórica','redes pública e privada','Reais nominais de julho de 2022','Não mede tratamento','Índice de resultados · referência 2022','Aprendizagem · Saeb','Sete perguntas sobre a vida em Recife','Até onde cada tema chega.'])expect(html).toContain(text);
    for(const m of [...retrato.condicoes,...retrato.recursos])expect(html).toContain(m.fonteUrl.replaceAll('&','&amp;'));
    expect(html).not.toContain('escore validado:');expect(html).not.toContain('NaN');expect(html).not.toContain('undefined');
  });
});
