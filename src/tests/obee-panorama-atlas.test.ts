import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import data from '@/lib/eficiencia/panorama-atlas.json';
import frequency from '@/lib/eficiencia/frequencia-escolar.json';
import {PanoramaTerritorial,panoramaPair,panoramaDetailHref} from '@/components/eficiencia/PanoramaTerritorial';
import {AtlasCidadao} from '@/components/eficiencia/AtlasCidadao';

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
  it.each(data.cities)('seleção de $name atualiza os quatro temas',city=>{
    const other=data.cities.find(c=>c.id!==city.id)!;
    const html=renderToStaticMarkup(createElement(PanoramaTerritorial,{place:city.id,reference:other.id,onEducation:()=>{}}));
    for(const m of data.metrics){
      const pair=panoramaPair(city.id,other.id,m);
      expect(pair.a).toBe(m.observations.find(o=>o.territory===city.id)!.value);
      expect(pair.difference).toBeCloseTo(pair.a!-pair.b!,10);
    }
    expect(html).toContain(city.name);expect(html).not.toContain('NaN');
  });
  it('zero, ausência e inelegibilidade têm comportamentos distintos',()=>{
    const metric=structuredClone(data.metrics[0]);metric.observations[0].value=0;
    expect(panoramaPair(metric.observations[0].territory,'4106902',metric).a).toBe(0);
    metric.observations[0].eligible=false;
    expect(panoramaPair(metric.observations[0].territory,'4106902',metric).difference).toBeNull();
    expect(panoramaPair('ausente','4106902',metric).a).toBeNull();
    const html=renderToStaticMarkup(createElement(PanoramaTerritorial,{place:'ausente',reference:'4106902',onEducation:()=>{}}));
    expect(html).toContain('Não disponível');expect(html).toContain('Diferença indisponível');expect(html).not.toContain('NaN');
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
    const urls=data.metrics.map(m=>panoramaDetailHref(m,'2611606','4106902'));
    expect(urls[0]).toBe('#atlas-comparacao');
    const h=new URL(urls[1],'https://example.test');
    expect(h.searchParams.get('med')).toBe('cobertura_aps');expect(h.searchParams.get('ano')).toBe('2025');
    expect(h.searchParams.get('cap')).toBe(data.metrics[1].territoryKeys!['2611606']);
    expect(h.searchParams.get('vs')).toBe(data.metrics[1].territoryKeys!['4106902']);
    expect(urls[2]).toContain('ter=2611606&med=renda-mediana&per=2022');
    expect(urls[3]).toContain('territorio=2611606');
  });
  it('entrada apresenta limites materiais e a faixa do índice de resultados',()=>{
    const html=renderToStaticMarkup(createElement(AtlasCidadao));
    for(const text of ['Capacidade teórica','Inclui redes públicas e privadas','Reais nominais de julho de 2022','o resíduo não é redistribuído','Índice de resultados · 2022','Aprendizagem · Saeb','A vida no território, lado a lado.'])expect(html).toContain(text);
    for(const m of data.metrics)expect(html).toContain(m.sourceUrl.replaceAll('&','&amp;'));
    expect(html).not.toContain('escore validado:');
  });
});
