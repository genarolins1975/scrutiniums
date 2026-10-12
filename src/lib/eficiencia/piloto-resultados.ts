import snapshot from '../../../docs/obee/resultados/piloto-2022-v2.json';

export const pilotoResultados = snapshot;
export type PilotRow = typeof snapshot.rows[number];
export type PilotDimension = keyof PilotRow['raw_values'];
export const pilotDimensions: {id:PilotDimension; name:string; unit:string; note:string; source:string}[] = [
 {id:'educacao',name:'Educação',unit:'%',note:'Frequência escolar de 4 a 5 anos. Inclui redes públicas e privadas.',source:'https://sidra.ibge.gov.br/tabela/10056'},
 {id:'trabalho',name:'Condições materiais',unit:'R$',note:'Renda domiciliar por pessoa, mediana. Reais nominais de julho de 2022.',source:'https://sidra.ibge.gov.br/tabela/10295'},
 {id:'mobilidade',name:'Mobilidade',unit:'%',note:'Mais de uma hora até o trabalho, no universo de deslocamentos do Censo.',source:'https://sidra.ibge.gov.br/tabela/10330'},
 {id:'saneamento',name:'Saneamento',unit:'%',note:'Rede geral/pluvial ou fossa ligada à rede, mais fossa séptica/filtro não ligada. Não mede tratamento.',source:'https://sidra.ibge.gov.br/tabela/6805'},
 {id:'seguranca',name:'Violência letal',unit:'por 100 mil',note:'Homicídios registrados e ocultos estimados. Depende do modelo da fonte.',source:'https://repositorio.ipea.gov.br/bitstream/11058/14031/5/AtlasViolencia2024_Retrato_dos_municipios_brasileros.pdf'},
];
export const pilotNumber = (n:number|null, digits=1) => n===null?'Indisponível':n.toLocaleString('pt-BR',{minimumFractionDigits:digits,maximumFractionDigits:digits});
export const pilotRow = (id:string) => snapshot.rows.find(row=>row.id===id);
export function pilotCsv(){
 const header=['version','reference_year','id','name','pilot_five_score','weight_sensitivity_lower','weight_sensitivity_upper','extended_six_score','health_status',...pilotDimensions.flatMap(d=>[d.id+'_raw',d.id+'_percentile',d.id+'_unit',d.id+'_weight'])];
 const rows=snapshot.rows.map(r=>[snapshot.version,2022,r.id,r.name,r.pilot_five.score,...r.weight_sensitivity_range,'','not_eligible',...pilotDimensions.flatMap(d=>[r.raw_values[d.id],r.indicator_scores[d.id],d.unit,0.2])]);
 return [header,...rows].map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n')+'\r\n';
}
export function pilotPreviewEnabled(environment:string|undefined,nodeEnvironment:string|undefined){
 return environment==='preview'||(!environment&&nodeEnvironment==='development');
}
