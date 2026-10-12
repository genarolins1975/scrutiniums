import {describe,it,expect} from 'vitest';
import rap from '@/lib/contas-publicas/snapshots/rap.json';
import {somarRAP,porOrigemRAP} from '@/lib/contas-publicas/rap-modelo';
import {METAS,META_INFO,consultarMetas,filtrarMetas} from '@/lib/contas-publicas/metas-dados';
import {estadoMeta} from '@/lib/contas-publicas/metas-modelo';
import {GET} from '@/app/contas-publicas/metas-dados.json/route';
const todos={busca:'',orgao:'',estado:'todos' as const};
describe('RAP conciliado',()=>{
 it('concilia cada posição e órgão sem somar estoques entre datas',()=>{
  for(const periodo of Object.keys(rap.contagemFonte))for(const orgao of Object.keys(rap.orgaos)){
   const rs=rap.registros.filter(r=>r.periodo===periodo&&r.orgao===orgao),s=somarRAP(rs);
   expect(Math.abs(s.inscritos+s.reinscritos-s.pagos-s.cancelados-s.saldo)).toBeLessThan(1);
   expect(Math.abs(porOrigemRAP(rs).reduce((n,r)=>n+r.saldo,0)-s.saldo)).toBeLessThan(.01);
  }
 });
 it('reproduz os dez controles publicados e não inventa fluxos na abertura',()=>{
  expect(rap.conferencia).toHaveLength(10);
  const campos={RP_INSCRITOS_TOTAL:(s:ReturnType<typeof somarRAP>)=>s.inscritos+s.reinscritos,RP_CANCELADOS_TOTAL:(s:ReturnType<typeof somarRAP>)=>s.cancelados,RP_PAGOS_TOTAL:(s:ReturnType<typeof somarRAP>)=>s.pagos,RP_A_PAGAR_TOTAL:(s:ReturnType<typeof somarRAP>)=>s.saldo};
  for(const c of rap.conferencia){const v=campos[c.campo as keyof typeof campos](somarRAP(rap.registros.filter(r=>r.periodo===c.periodo)));expect(Number((v/1e9).toFixed(1))).toBe(c.relatorioBilhoes);expect(Math.abs(v-c.reais)).toBeLessThan(1)}
  expect(rap.conferencia.filter(c=>c.periodo==='000/2026').map(c=>c.campo)).toEqual(['RP_INSCRITOS_TOTAL','RP_A_PAGAR_TOTAL']);
 });
});
describe('universo físico por localizador',()=>{
 it('preserva cobertura, chave única e níveis separados',()=>{
  expect(METAS).toHaveLength(7392);expect(new Set(METAS.map(r=>r.id)).size).toBe(7392);
  expect(META_INFO.contagemFonte.planosOrcamentariosExcluidos).toBe(13857);
  const cobertura:Record<string,number>={};for(const r of METAS)cobertura[r.estado]=(cobertura[r.estado]??0)+1;
  expect(cobertura).toEqual(META_INFO.cobertura);expect(cobertura.calculavel).toBe(4068);
 });
 it('mantém ausências, zeros e metas negativas como situações distintas',()=>{
  expect(METAS.filter(r=>r.realizado===null)).toHaveLength(3246);
  expect(METAS.filter(r=>r.realizado===0)).toHaveLength(1024);
  const negativas=METAS.filter(r=>r.metaAtual!==null&&r.metaAtual<0);expect(negativas).toHaveLength(4);
  for(const r of negativas)expect(r.estado).not.toBe('calculavel');
  const r=METAS.find(r=>r.estado==='calculavel')!;expect(estadoMeta({...r,apuracao:null})).toBe('sem-data');
 });
 it('filtra sem acentos e pagina sem perder ou duplicar registros',()=>{
  expect(filtrarMetas({...todos,busca:'familia'}).map(r=>r.id)).toEqual(filtrarMetas({...todos,busca:'família'}).map(r=>r.id));
  const p1=consultarMetas(todos),p2=consultarMetas(todos,2);expect(p1.registros).toHaveLength(25);expect(p1.registros.some(r=>p2.registros.some(x=>x.id===r.id))).toBe(false);
  expect(consultarMetas({...todos,busca:'inexistente_zzzz'}).registros).toEqual([]);
  expect(consultarMetas(todos,-1).pagina).toBe(1);expect(consultarMetas(todos,Infinity).pagina).toBe(1);
 });
 it('aplica o mesmo filtro ao download completo e recusa estados inválidos',async()=>{
  const q=new URLSearchParams({...todos,busca:'família'});
  const resposta=GET(new Request(`http://localhost/contas-publicas/metas-dados.json?${q}&download=1`));
  expect(resposta.headers.get('content-disposition')).toContain('attachment');
  const d=await resposta.json();expect(d.registros).toHaveLength(filtrarMetas({...todos,busca:'família'}).length);expect(d.registros.length).toBeGreaterThan(25);
  expect(GET(new Request('http://localhost/?estado=__proto__')).status).toBe(400);
 });
});
