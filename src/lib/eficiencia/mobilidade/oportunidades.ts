import {csvCelula, primeiro, type Parametros} from './modelo';
export const MODOS_AOP = {public_transport:'Transporte público',walk:'A pé',bicycle:'Bicicleta',car:'Automóvel'} as const;
export type ModoAop=keyof typeof MODOS_AOP;
export const HORARIOS_AOP={'1':'Pico','0':'Fora do pico',na:'Sem distinção de horário'} as const;
export type HorarioAop=keyof typeof HORARIOS_AOP;
export type GrupoAop={group:string;mean:number|null;numerator:number|null;coveredPopulation:number;totalPopulation:number;coveredCells:number;totalCells:number;zeroPopulation:number;zeroShare:number|null;coverage:number|null;missingWeightCells:number};
export type RegistroAop={city:string;mode:ModoAop;peak:HorarioAop;metric:string;unmatchedCells:number;groups:GrupoAop[]};
export type FonteAop={arquivo:string;type:string;city:string;year:string;mode:string;url:string;sha256:string;capturado_em:string;estado:string;linhas:number};
export type BaseAop={schemaVersion:number;referenceYear:number;populationYear:number;seedSha256:string;metrics:{id:string;opportunity:string;minutes:number;unit:string}[];cities:{id:string;name:string;abbrev:string}[];records:RegistroAop[];sources:FonteAop[];notes:string[];populationRows:number;accessRows:number};
export function recorteAop(g:BaseAop,p:Parametros){
 const avisos:string[]=[];
 const modo=primeiro(p.modo),mode:ModoAop=Object.prototype.hasOwnProperty.call(MODOS_AOP,modo)?modo as ModoAop:'public_transport';
 if(modo&&modo!==mode)avisos.push('Modo solicitado não reconhecido. Exibindo transporte público.');
 const pedido=primeiro(p.indicador),metric=g.metrics.find(m=>m.id===pedido)??g.metrics[0];
 if(pedido&&pedido!==metric.id)avisos.push('Indicador solicitado não reconhecido. Exibindo '+metric.opportunity+' em '+metric.minutes+' minutos.');
 const ativo=mode==='walk'||mode==='bicycle',horario=primeiro(p.pico);
 const peak:HorarioAop=ativo?'na':horario==='0'?'0':'1';
 if(horario&&(!['0','1','na'].includes(horario)||(!ativo&&horario==='na')))avisos.push('Horário solicitado não reconhecido. Foi aplicado o horário indicado nos controles.');
 const pedidoCidade=primeiro(p.cidade),city=g.cities.find(c=>c.id===pedidoCidade)??null;
 if(pedidoCidade&&!city)avisos.push('Cidade solicitada fora da cobertura. Exibindo todas as cidades da base.');
 const registros=g.records.filter(r=>r.mode===mode&&r.peak===peak&&r.metric===metric.id);
 const rows=g.cities.filter(c=>!city||c.id===city.id).map(c=>({city:c,record:registros.find(r=>r.city===c.id)??null}));
 rows.sort((a,b)=>a.city.name.localeCompare(b.city.name,'pt-BR'));
 return {mode,peak,metric,city,rows,avisos};
}
export const rotuloGrupoAop=(id:string)=>id==='all'?'Todas as áreas':id==='unknown'?'Sem decil válido':`Decil ${id}${id==='1'?' · menor renda':id==='10'?' · maior renda':''}`;
export function fontesAop(g:BaseAop,record:RegistroAop){const c=g.cities.find(c=>c.id===record.city)!;return g.sources.filter(s=>s.city===c.abbrev&&(s.type==='population'||(s.type==='access'&&s.mode===record.mode)));}
export function* csvAop(g:BaseAop,records:RegistroAop[]=g.records){
 yield '\uFEFF'+['codigo_ibge','cidade','modo','horario','indicador','oportunidade','minutos','ano_acessibilidade','ano_populacao','grupo_renda_area','media_oportunidades','numerador_ponderado','populacao_coberta','populacao_referencia','cobertura_pct','populacao_com_zero_oportunidades','zero_pct_dentre_cobertos','celulas_cobertas','celulas_referencia','celulas_sem_peso','celulas_sem_correspondencia','fontes','hashes_fontes','capturas_utc'].map(csvCelula).join(';')+'\r\n';
 const cities=new Map(g.cities.map(c=>[c.id,c])),metrics=new Map(g.metrics.map(m=>[m.id,m]));
 for(const r of records){const c=cities.get(r.city)!,m=metrics.get(r.metric)!,sources=fontesAop(g,r);for(const x of r.groups)yield [c.id,c.name,MODOS_AOP[r.mode],HORARIOS_AOP[r.peak],m.id,m.opportunity,m.minutes,g.referenceYear,g.populationYear,rotuloGrupoAop(x.group),x.mean,x.numerator,x.coveredPopulation,x.totalPopulation,x.coverage,x.zeroPopulation,x.zeroShare,x.coveredCells,x.totalCells,x.missingWeightCells,r.unmatchedCells,sources.map(s=>s.url).join(' | '),sources.map(s=>s.sha256).join(' | '),sources.map(s=>s.capturado_em).join(' | ')].map(csvCelula).join(';')+'\r\n';}
}
export function validarAop(g:BaseAop){
 if(g.schemaVersion!==1||!g.cities.length||!g.records.length||!g.metrics.length||g.referenceYear!==2019||g.populationYear!==2010)throw new Error('Edição AOP incompatível');
 const cidades=new Set(g.cities.map(c=>c.id)),indicadores=new Set(g.metrics.map(m=>m.id)),seen=new Set<string>();
 for(const r of g.records){const key=[r.city,r.mode,r.peak,r.metric].join('|');if(seen.has(key)||!cidades.has(r.city)||!indicadores.has(r.metric)||!(r.mode in MODOS_AOP)||!(r.peak in HORARIOS_AOP))throw new Error('Chave AOP inválida');seen.add(key);
  if(fontesAop(g,r).length!==2)throw new Error('Linhagem AOP incompleta');
  if(r.groups.length!==12||new Set(r.groups.map(x=>x.group)).size!==12||!['all','unknown',...Array.from({length:10},(_,i)=>String(i+1))].every(k=>r.groups.some(x=>x.group===k)))throw new Error('Grupos de renda incompletos');
  for(const x of r.groups){if(x.coveredPopulation<0||x.coveredPopulation>x.totalPopulation+1e-6||x.zeroPopulation<0||x.zeroPopulation>x.coveredPopulation+1e-6)throw new Error('Denominador AOP inválido');
   for(const n of [x.mean,x.numerator,x.coverage,x.zeroShare])if(n!==null&&(!Number.isFinite(n)||n<0))throw new Error('Valor AOP inválido');
   if(!x.coveredPopulation){if(x.mean!==null||x.numerator!==null||x.zeroShare!==null)throw new Error('Ausência AOP com valor');}
   else if(x.mean===null||x.numerator===null||Math.abs(x.mean-x.numerator/x.coveredPopulation)>1e-7)throw new Error('Média AOP divergente');
   if(x.zeroShare!==null&&(x.zeroShare>100||Math.abs(x.zeroShare-100*x.zeroPopulation/x.coveredPopulation)>1e-7))throw new Error('Fração sem acesso divergente');
   if(x.coverage!==null&&Math.abs(x.coverage-100*x.coveredPopulation/x.totalPopulation)>1e-7)throw new Error('Cobertura AOP divergente');
  }
 }
}
