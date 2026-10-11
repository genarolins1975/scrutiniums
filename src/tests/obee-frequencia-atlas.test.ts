import {describe,it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {FrequenciaEscolar} from '@/components/eficiencia/FrequenciaEscolar';
import {AtlasCidadao} from '@/components/eficiencia/AtlasCidadao';
import dados from '@/lib/eficiencia/frequencia-escolar.json';

describe('Frequência escolar no Atlas',()=>{
  it('preserva 108 valores da fonte e integridade dos originais',()=>{
    expect(dados.observations).toHaveLength(108);
    for(const source of dados.sources){
      const raw=readFileSync('docs/obee/calibracao/evidencias/'+source.file);
      expect(createHash('sha256').update(raw).digest('hex')).toBe(source.sha256);
      if(source.file.includes('metadados'))continue;
      const [header,...rows]=JSON.parse(raw.toString()) as Record<string,string>[];
      const codeKey=Object.keys(header).find(k=>header[k]===(source.file.includes('capitais')?'Município (Código)':'Brasil (Código)'))!;
      const ageKey=Object.keys(header).find(k=>header[k]==='Grupo de idade (Código)')!;
      for(const row of rows){const found=dados.observations.find(o=>o.territory===row[codeKey]&&o.age===row[ageKey]);expect(found?.raw).toBe(row.V);expect(found?.value).toBe(Number(row.V));}
    }
  });
  it('CSV inclui todas as idades e territórios sem arredondar os valores',()=>{
    const csv=readFileSync('public/eficiencia/atlas/frequencia-escolar-2022.csv','utf8');
    expect(csv.trim().split('\n')).toHaveLength(109);
    for(const row of dados.observations)expect(csv).toContain([row.territory,row.name,2022,dados.ages.find(a=>a.id===row.age)!.label,row.raw,dados.role].join(','));
  });
  it.each(dados.ages)('gráfico e tabela compartilham o recorte $label',age=>{
    const html=renderToStaticMarkup(createElement(FrequenciaEscolar,{place:'2611606',reference:'4106902',age:age.id,onAgeChange:()=>{}}));
    for(const territory of ['2611606','4106902','1']){
      const row=dados.observations.find(r=>r.age===age.id&&r.territory===territory)!;
      expect(html).toContain(`width:${row.value}%`);
      expect(html).toContain(`<td>${row.value.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>`);
    }
    expect(html).toContain('Inclui redes públicas e privadas');expect(html).toContain('Brasil é a taxa nacional');expect(html).toContain('100%');
  });
  it('entrada mantém agregado indisponível e oferece os dois indicadores',()=>{
    const html=renderToStaticMarkup(createElement(AtlasCidadao));
    expect(html).toContain('Em construção');expect(html).toContain('Aprendizagem · Saeb');expect(html).toContain('Frequência escolar');
  });
  it('ausência não desenha uma barra como zero',()=>{
    const html=renderToStaticMarkup(createElement(FrequenciaEscolar,{place:'inexistente',reference:'4106902',age:'47813',onAgeChange:()=>{}}));
    expect(html).toContain('Comparação indisponível');expect(html).toContain('Não disponível');expect(html).not.toContain('width:0%');
  });
});
