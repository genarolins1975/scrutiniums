import {describe,it,expect} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import data from '../../public/eficiencia/judiciario/snapshot.json';
import manifest from '../../public/eficiencia/judiciario/manifesto.json';
import {medianaDasMedias,csvJudiciario,BASE_JUDICIARIO,CAPITULOS} from '@/lib/eficiencia/judiciario/modelo';
import {indicadoresJudiciario} from '@/lib/eficiencia/judiciario/indicadores';
import {ehRotaPublica} from '@/lib/rotasPublicas';
describe('Judiciário: universos e definições',()=>{
 it('não apresenta três ramos como todo o Judiciário',()=>{
  expect(data.ramos).toHaveLength(3);
  expect(data.ramos.reduce((a,r)=>a+r.pendentes,0)).toBe(74_400_000);
  expect(data.nacional.pendentesMilhoes).toBe(75.5);
  expect(data.cobertura.tribunaisFederais).toBe(6);
  expect(data.cobertura.tribunaisTrabalho).toBe(24);
 });
 it('mantém todos os tribunais cobertos e médias publicadas',()=>{
  expect(data.tribunais).toHaveLength(57);
  expect(new Set(data.tribunais.map(t=>t.id)).size).toBe(57);
  expect(data.tribunais.find(t=>t.id==='tjsp')).toMatchObject({tempoBaixados:47,idadePendentes:58,ano:2025});
  expect(data.tribunais.filter(t=>t.ramo==='estadual')).toHaveLength(27);
  expect(data.tribunais.filter(t=>t.ramo!=='estadual').every(t=>t.uf===null)).toBe(true);
  expect(data.tribunais.find(t=>t.id==='trf3')).toMatchObject({tempoBaixados:46,idadePendentes:61,ipcJus:80});
  expect(data.tribunais.find(t=>t.id==='trt3')).toMatchObject({tempoBaixados:8,idadePendentes:21,ipcJus:100});
 });
 it('calcula mediana entre médias sem ponderação inventada',()=>{
  expect(medianaDasMedias([8,1,4])).toBe(4);
  expect(medianaDasMedias([1,2,9,10])).toBe(5.5);
  expect(medianaDasMedias([])).toBeNull();
  expect(medianaDasMedias([NaN])).toBeNull();
 });
 it('preserva ausências e zero e protege texto de planilha',()=>{
  const content=csvJudiciario(['Nome','Valor'],[['Ausente',null],['Zero',0],['=SUM(A1:A2)',7],['Nome; "citado"',8]]);
  expect(content).toContain('"Ausente";""');
  expect(content).toContain('"Zero";"0"');
  expect(content).toContain('"\'=SUM(A1:A2)"');
  expect(content).toContain('"Nome; ""citado"""');
  expect(csvJudiciario(['Diferença'],[[-2]])).toContain('"-2"');
 });
 it('fornece passaportes e estados materiais sem criar indicadores ausentes',()=>{
  for(const i of indicadoresJudiciario) for(const [key,value] of Object.entries(i)) expect(value,`${i.id}.${key}`).not.toBe('');
  expect(indicadoresJudiciario.find(i=>i.id==='efetividade')?.estado).toBe('NAO_MENSURAVEL');
  expect(indicadoresJudiciario.find(i=>i.id==='despesa')?.estado).toBe('OBSERVADO');
  expect(indicadoresJudiciario.find(i=>i.id==='atendimentoAproximado')?.estado).toBe('APROXIMADO');
  expect(data.unidades.tempoBaixados).toBe('meses');
 });
 it('reproduz custo por habitante e acervo parado como publicados, sem atribuir valor regional à UF',()=>{
  expect(data.porHabitante).toMatchObject({valor:771.48,semInativos:653.38,pib:1.3,pagina:64});
  const tjs=data.tribunais.filter(t=>t.ramo==='estadual');
  expect(tjs.every(t=>typeof t.despesaPorHabitante==='number'&&t.despesaPorHabitanteSemInativos!<=t.despesaPorHabitante!)).toBe(true);
  expect(data.tribunais.filter(t=>t.ramo!=='estadual').every(t=>t.despesaPorHabitante===null)).toBe(true);
  expect(data.acervo.suspensos).toMatchObject({processosMilhoes:16.4,percentualPendentes:21.7});
  expect(data.acervo.execucaoFiscal).toMatchObject({percentualPendentes:22,congestionamento:72.4});
 });
 it('entrada responde por perguntas, com as duas medidas de tempo juntas e sem ilustração decorativa',()=>{
  const entrada=readFileSync('src/app'+BASE_JUDICIARIO+'/page.tsx','utf8');
  expect(entrada).not.toContain('judiciario-por-dentro.webp');
  expect(entrada).toContain('HalteresTribunais');
  expect(entrada).toContain('PerguntasJudiciario');
  const comparador=readFileSync('src/components/eficiencia/judiciario/Exploradores.tsx','utf8');
  expect(comparador).toContain('HalteresTribunais');
  expect(readFileSync('src/components/eficiencia/judiciario/EntradaInternacional.tsx','utf8')).not.toContain("'PRT'");
 });
 it('segunda onda: execução, recorribilidade, série e criminal como publicados',()=>{
  const tjam=data.tribunais.find(t=>t.id==='tjam')!;
  expect(tjam.historico.map(h=>[h.ano,h.tempoBaixados,h.idadePendentes])).toEqual([[2021,16,39],[2022,17,42],[2023,14,40],[2024,16,52],[2025,47,24]]);
  expect(data.tribunais.every(t=>t.historico.at(-1)!.tempoBaixados===t.tempoBaixados)).toBe(true);
  expect(data.tribunais.find(t=>t.id==='trf6')!.historico[0].tempoBaixados).toBeNull();
  expect(data.tribunais.filter(t=>t.ramo!=='estadual').every(t=>t.justicaGratuita===null)).toBe(true);
  expect(data.criminal.execucoesPenaisPendentesMilhoes).toBe(2.6);
  expect(data.magistrados.porCemMil).toBe(8.95);
  expect(CAPITULOS.map(c=>c[0])).toEqual(expect.arrayContaining(['consistencia','criminal']));
 });
 it('laboratório de consistência usa só a conta binomial',async()=>{
  const {limitesAcaso}=await import('@/components/eficiencia/judiciario/Consistencia');
  const [a,b]=limitesAcaso(0.5,400,1.96);
  expect(a).toBeCloseTo(0.451,3);expect(b).toBeCloseTo(0.549,3);
  expect(limitesAcaso(0.9,20,3.09)[1]).toBe(1);
 });
 it('confere os checksums dos downloads publicados',()=>{
  for(const [file,hash] of Object.entries(manifest.arquivos)){
   const bytes=readFileSync(join(process.cwd(),'public/eficiencia/judiciario',file));
   expect(createHash('sha256').update(bytes).digest('hex'),file).toBe(hash);
  }
 });
 it('preserva a autenticação de painéis, fichas e arquivos',()=>{
  for(const path of [BASE_JUDICIARIO,...CAPITULOS.filter(c=>c[0]!=='metodos').map(c=>BASE_JUDICIARIO+'/'+c[0]),BASE_JUDICIARIO+'/tribunais/tjsp','/eficiencia/judiciario/snapshot.json']) expect(ehRotaPublica(path),path).toBe(false);
  expect(ehRotaPublica(BASE_JUDICIARIO+'/metodos')).toBe(true);
 });
 it('todos os destinos e downloads têm implementação',()=>{
  expect(existsSync('src/app'+BASE_JUDICIARIO+'/page.tsx')).toBe(true);
  expect(existsSync('src/app'+BASE_JUDICIARIO+'/[capitulo]/page.tsx')).toBe(true);
  expect(existsSync('src/app'+BASE_JUDICIARIO+'/tribunais/[id]/page.tsx')).toBe(true);
  for(const name of ['snapshot.json','manifesto.json','ramos.csv','tribunais.csv','tribunais-historico.csv']) expect(existsSync('public/eficiencia/judiciario/'+name)).toBe(true);
 });
});
