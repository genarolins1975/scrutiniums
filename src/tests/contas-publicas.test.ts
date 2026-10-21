import {describe,it,expect} from 'vitest';
import {CAPITULOS,INDICADORES,FONTES} from '../lib/contas-publicas/catalogo';
import {razao,desvioPercentual,compararRecortes} from '../lib/contas-publicas/metricas';
describe('contratos de Contas Públicas',()=>{
 it('preserva zero observado e distingue ausência e inelegibilidade',()=>{
  expect(razao(0,10)).toEqual({valor:0,status:'calculado'});
  expect(razao(null,10).status).toBe('ausente');
  expect(razao(10,0).status).toBe('inelegivel');
  expect(razao(10,-1).status).toBe('inelegivel');
  expect(razao(NaN,2).status).toBe('inelegivel');
  expect(razao(Infinity,2).status).toBe('inelegivel');
  expect(razao(Number.MAX_VALUE,0.01).status).toBe('inelegivel');
 });
 it('mantém sinal e superação sem truncar em 100%',()=>{
  expect(desvioPercentual(80,100)).toEqual({valor:-20,status:'calculado'});
  expect(razao(125,100)).toEqual({valor:125,status:'calculado'});
  expect(desvioPercentual(null,100).status).toBe('ausente');
  expect(desvioPercentual(10,0).status).toBe('inelegivel');
 });
 it('recusa operação direta entre recortes incompatíveis',()=>{
  const r={perimetro:'União',periodo:'2025',unidade:'BRL nominal',estagio:'liquidado',classificacao:'funcional-v1'};
  expect(compararRecortes(r,{...r}).comparavel).toBe(true);
  expect(compararRecortes(r,{...r,perimetro:'Governo Geral',estagio:'pago'}).divergencias).toEqual(['perimetro','estagio']);
  expect(compararRecortes({...r,unidade:''},{...r,unidade:''}).comparavel).toBe(false);
 });
 it('não deixa capítulo sem indicadores ou fonte sem destino',()=>{
  expect(new Set(INDICADORES.map(i=>i.id)).size).toBe(INDICADORES.length);
  for(const c of CAPITULOS)expect(INDICADORES.some(i=>i.capitulo===c.id)).toBe(true);
  for(const i of INDICADORES){expect(CAPITULOS.some(c=>c.id===i.capitulo)).toBe(true);expect(new URL(FONTES[i.fonte].url).protocol).toBe('https:');expect(['aguardando-integracao','integracao-parcial']).toContain(i.status);expect(i.ressalva.length).toBeGreaterThan(10)}
 });
});

import {DADOS,CAMPOS_FISCAIS,fiscalAcumulado,bilhoes} from '../lib/contas-publicas/dados';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
describe('dados oficiais e limites de comparação',()=>{
 it('concilia cada mês: receita menos repartição, saldo e componentes exclusivos',()=>{
  for(const r of DADOS.rtnMensal){
   expect(r.receitaTotal-r.transferencias).toBeCloseTo(r.receitaLiquida,5);
   expect(r.receitaLiquida-r.despesa).toBeCloseTo(r.resultado,5);
   expect(r.previdencia+r.pessoal+r.outrasObrigatorias+r.programacaoFinanceira).toBeCloseTo(r.despesa,5);
  }
 });
 it('confere a soma dos meses contra a tabela anual independente da fonte',()=>{
  for(const r of DADOS.rtnAnual){const soma=fiscalAcumulado(Number(r.periodo),12);expect(soma).not.toBeNull();for(const k of CAMPOS_FISCAIS)expect(soma![k]).toBeCloseTo(r[k],5)}
 });
 it('não transforma ano parcial em ano completo nem meses ausentes em zero',()=>{
  expect(fiscalAcumulado(2026,12)).toBeNull();expect(fiscalAcumulado(2026,8)).toBeNull();
  expect(fiscalAcumulado(2019,7)).toBeNull();expect(fiscalAcumulado(2026,0)).toBeNull();expect(fiscalAcumulado(2026,1.5)).toBeNull();
  expect(fiscalAcumulado(2026,7)).not.toBeNull();expect(fiscalAcumulado(2025,7)).not.toBeNull();
  expect(fiscalAcumulado(2025,7)!.despesa).not.toEqual(fiscalAcumulado(2025,12)!.despesa);
 });
 it('mantém unidade, sinal e valor de controle da tabela anual de 2025',()=>{
  const r=DADOS.rtnAnual.find(r=>r.periodo==='2025')!;
  expect(r.resultado).toBeCloseTo(-61694.308980989066,5);
  expect(bilhoes(r.resultado,'milhoes')).toBe('-61,7');
  expect(bilhoes(1_000_000_000)).toBe('1,0');
 });
 it('reconcilia esferas e grupos com resíduos explícitos, sem ajustar a fonte',()=>{
  for(const b of DADOS.orcamento){expect(b.esferas.map(e=>e.codigo).sort()).toEqual(['10','20']);
   for(const k of ['inicial','atualizada','empenhado','liquidado','pago'] as const){
    expect(b.esferas.reduce((s,r)=>s+r[k],0)).toBe(b.total[k]);
    expect(b.total[k]-b.grupos.reduce((s,r)=>s+r[k],0)).toBe(b.residuosEsferasMenosGND[k]);
    expect(Math.abs(b.residuosEsferasMenosGND[k])).toBeLessThanOrEqual(5);
   }
   expect(b.grupos.some(g=>g.codigo==='2')).toBe(true);expect(b.grupos.some(g=>g.codigo==='6')).toBe(true);
  }
 });
 it('preserva os hashes dos arquivos SIOP e cobertura de todos os estágios',()=>{
  for(const [file,hash] of Object.entries(DADOS.sha256)){if(file==='rtn.xlsx')continue;
   const bytes=readFileSync(`data/contas-publicas/fontes/${file}`);
   expect(createHash('sha256').update(bytes).digest('hex')).toBe(hash);
   if(file.startsWith('gnd'))for(const r of JSON.parse(bytes.toString()).results.bindings){
    for(const key of ['cobertura','coberturaAtualizada','coberturaEmpenhado','coberturaLiquidado','coberturaPago'])expect(r[key].value).toBe(r.itens.value);
   }
  }
 });
});

describe('entrada das Contas Públicas Federais (banca de 19/10/2026, achado A4)',()=>{
 it('o percurso da gestão só leva a capítulos com dados; etapa sem dados aparece como em preparação, sem link',async()=>{
  const {createElement}=await import('react');
  const {renderToStaticMarkup}=await import('react-dom/server');
  const {coberturaCapitulo}=await import('../lib/contas-publicas/cobertura');
  const {default:Pagina}=await import('../app/contas-publicas/page');
  const html=renderToStaticMarkup(createElement(Pagina));
  const ciclo=html.slice(html.indexOf('class="cp-cycle"'),html.indexOf('</div>',html.indexOf('class="cp-cycle"')+20));
  const destinos=[...ciclo.matchAll(/href="\/contas-publicas\/([a-z-]+)"/g)].map(m=>m[1]);
  expect(destinos.length).toBeGreaterThan(0);
  for(const id of destinos){const c=coberturaCapitulo(id as (typeof CAPITULOS)[number]['id']);expect(c.observados.length+c.complementares.length,id).toBeGreaterThan(0);}
  for(const etapa of ['Planejar','Executar','Entregar','Prestar contas'])expect(html).toContain(`<strong>${etapa}</strong>`);
  const semDados=['Planejar','Executar','Entregar','Prestar contas'].filter(e=>!CAPITULOS.some(c=>c.etapa===e&&destinos.includes(c.id)));
  for(const e of semDados)expect(ciclo).toContain(`aria-label="${e}: em preparação, ainda sem dados"`);
 });
});
