/**
 * Núcleo do piloto v2 SEM dados. Pode ser importado por componentes cliente:
 * o snapshot chega por prop, lido no servidor apenas quando o preview está
 * habilitado. Importar o JSON aqui o colocaria no bundle público de produção.
 */
import type snapshotType from '../../../docs/obee/resultados/piloto-2022-v2.json';

export type PilotSnapshot = typeof snapshotType;
export type PilotRow = PilotSnapshot['rows'][number];
export type PilotDimension = keyof PilotRow['raw_values'];
export const pilotDimensions: {id:PilotDimension; name:string; unit:string; note:string; source:string}[] = [
 {id:'educacao',name:'Educação',unit:'%',note:'Frequência escolar de 4 a 5 anos. Inclui redes públicas e privadas.',source:'https://sidra.ibge.gov.br/tabela/10056'},
 {id:'trabalho',name:'Condições materiais',unit:'R$',note:'Renda domiciliar por pessoa, mediana. Reais nominais de julho de 2022.',source:'https://sidra.ibge.gov.br/tabela/10295'},
 {id:'mobilidade',name:'Mobilidade',unit:'%',note:'Mais de uma hora até o trabalho, no universo de deslocamentos do Censo.',source:'https://sidra.ibge.gov.br/tabela/10330'},
 {id:'saneamento',name:'Saneamento',unit:'%',note:'Rede geral/pluvial ou fossa ligada à rede, mais fossa séptica/filtro não ligada. Não mede tratamento.',source:'https://sidra.ibge.gov.br/tabela/6805'},
 {id:'seguranca',name:'Violência letal',unit:'por 100 mil',note:'Homicídios registrados e ocultos estimados. Depende do modelo da fonte.',source:'https://repositorio.ipea.gov.br/bitstream/11058/14031/5/AtlasViolencia2024_Retrato_dos_municipios_brasileros.pdf'},
];
export const pilotNumber = (n:number|null, digits=1) => n===null?'Indisponível':n.toLocaleString('pt-BR',{minimumFractionDigits:digits,maximumFractionDigits:digits});
export function pilotPreviewEnabled(environment:string|undefined,nodeEnvironment:string|undefined){
 return environment==='preview'||(!environment&&nodeEnvironment==='development');
}

export type PilotScenario = {id:string;label:string;assumption:string;difference:number};
export const pilotSign = (value:number) => Math.abs(value)<=1e-9?0:Math.sign(value);
export function summarizePilotScenarios(baseline:number,scenarios:PilotScenario[]){
 if(!scenarios.length||!Number.isFinite(baseline)||scenarios.some(s=>!Number.isFinite(s.difference)))throw new Error('Invalid paired scenarios');
 const signs=scenarios.map(s=>pilotSign(s.difference)),original=pilotSign(baseline);
 const above=signs.filter(s=>s>0).length,below=signs.filter(s=>s<0).length,ties=signs.filter(s=>s===0).length;
 const reversed=original!==0&&signs.includes(-original);
 const label=original===0?(above||below?'Empate de referência desfeito':'Empate mantido'):reversed?'Há inversão da ordem':ties?'A diferença chega a empate':'Ordem mantida';
 return {label,above,below,ties,reversed,lower:Math.min(...scenarios.map(s=>s.difference)),upper:Math.max(...scenarios.map(s=>s.difference)),scenarios};
}
/** Funções do piloto ligadas a um snapshot explícito. */
export function createPilot(snapshot:PilotSnapshot){
 const pilotRow = (id:string) => snapshot.rows.find(row=>row.id===id);
 function pilotCsv(){
  const header=['version','reference_year','id','name','pilot_five_score','weight_sensitivity_lower','weight_sensitivity_upper','extended_six_score','health_status',...pilotDimensions.flatMap(d=>[d.id+'_raw',d.id+'_percentile',d.id+'_unit',d.id+'_weight'])];
  const rows=snapshot.rows.map(r=>[snapshot.version,2022,r.id,r.name,r.pilot_five.score,...r.weight_sensitivity_range,'','not_eligible',...pilotDimensions.flatMap(d=>[r.raw_values[d.id],r.indicator_scores[d.id],d.unit,0.2])]);
  return [header,...rows].map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n')+'\r\n';
 }
 /** Additive accounting of the frozen basket, not a causal attribution. */
 function pilotGap(place:string,reference:string){
  const a=pilotRow(place),b=pilotRow(reference);
  if(!a||!b)return null;
  const components=pilotDimensions.map(d=>{
   const weight=snapshot.reference.basket.find(m=>m.id===d.id)!.weight;
   return {id:d.id,name:d.name,weight,points:weight*(a.indicator_scores[d.id]-b.indicator_scores[d.id])};
  });
  return {components,total:a.pilot_five.score-b.pilot_five.score};
 }

 function pilotStability(place:string,reference:string){
  const a=pilotRow(place),b=pilotRow(reference);
  if(!a||!b)return null;
  const baseline=a.pilot_five.score-b.pilot_five.score;
  const seen=new Set<string>();
  const weights:PilotScenario[]=[];
  snapshot.sensitivity.weights.forEach((w,index)=>{
   const key=pilotDimensions.map(d=>w[d.id].toFixed(12)).join('|');
   if(seen.has(key))return;seen.add(key);
   weights.push({id:`weights-${index}`,label:`Pesos ${weights.length+1}`,assumption:pilotDimensions.map(d=>`${d.name}: ${pilotNumber(w[d.id]*100,2)}%`).join(' · '),difference:a.weight_scenarios[index]-b.weight_scenarios[index]});
  });
  const removal=pilotDimensions.map(d=>({id:`without-${d.id}`,label:`Sem ${d.name}`,assumption:'Quatro indicadores; pesos restantes renormalizados.',difference:a.leave_one_out[d.id]-b.leave_one_out[d.id]}));
  const definitions=([{id:'network_only',label:'Saneamento: apenas rede'},{id:'registered_only',label:'Violência: apenas registros'}] as const).map(d=>({id:d.id,label:d.label,assumption:'Uma definição alternativa por vez; demais dimensões preservadas.',difference:a.definition_sensitivity[d.id]-b.definition_sensitivity[d.id]}));
  return {baseline,families:[
   {id:'weights',name:'Mudança de pesos',note:'31 combinações distintas após normalização dos 32 cenários de ±20%.',...summarizePilotScenarios(baseline,weights)},
   {id:'removal',name:'Retirada de dimensão',note:'Cinco hipóteses: retirar um indicador por vez.',...summarizePilotScenarios(baseline,removal)},
   {id:'definitions',name:'Definições alternativas',note:'Duas hipóteses: saneamento apenas rede; homicídios apenas registrados.',...summarizePilotScenarios(baseline,definitions)}
  ]};
 }
 return {pilotoResultados:snapshot,pilotRow,pilotCsv,pilotGap,pilotStability};
}
