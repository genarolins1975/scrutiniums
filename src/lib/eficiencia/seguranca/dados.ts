import snapshot from '../../../../public/eficiencia/seguranca-publica/snapshot.json';

export type Grupo = 'letalidade' | 'mulheres' | 'patrimonio' | 'resposta';
export type Indicador = {id:string; titulo:string; grupo:string; valor:number; variacao:number; unidade:string; pagina:number; ressalva:string|null};
export const base = snapshot;
export const indicadores: Indicador[] = snapshot.indicadores;
export const grupos: Record<Grupo,{titulo:string; pergunta:string; nota:string}> = {
  letalidade: {titulo:'Violência letal',pergunta:'Quais mortes são registradas?',nota:'Categorias apresentadas separadamente. Homicídio doloso, mortes por intervenção e mortes a esclarecer não formam aqui uma soma de mortes violentas intencionais. Registros policiais não equivalem às causas de morte do SIM.'},
  mulheres: {titulo:'Violência contra mulheres',pergunta:'O que os registros mostram sobre a violência contra mulheres?',nota:'Feminicídio é uma classificação específica. Não equivale a todo homicídio de mulher. Violência sexual registrada não mede toda a vitimização: acesso à denúncia e classificação influenciam os registros.'},
  patrimonio: {titulo:'Crimes patrimoniais',pergunta:'Como variaram os crimes patrimoniais registrados?',nota:'Ocorrências não equivalem a vítimas únicas. A variação dos registros depende também da denúncia e da classificação. O recorte cobre veículos, carga e instituições financeiras; não todo crime patrimonial.'},
  resposta: {titulo:'Busca e atividade policial',pergunta:'Que atividades e registros de busca são contabilizados?',nota:'Localizações podem se referir a desaparecimentos de outros anos. Dividir localizados por desaparecidos não produz taxa de resolução. Apreensões e prisões medem atividade registrada, não qualidade ou eficiência.'},
};
export function numero(n:number){return n.toLocaleString('pt-BR');}
export function percentual(n:number){return `${n>0?'+':''}${n.toLocaleString('pt-BR',{maximumFractionDigits:2})}%`;}
export function seleciona(grupo:Grupo,busca='',ordem='titulo'){
  const termo=busca.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  return indicadores.filter(i=>i.grupo===grupo&&i.titulo.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(termo)).sort((a,b)=>ordem==='valor'?b.valor-a.valor:ordem==='variacao'?b.variacao-a.variacao:a.titulo.localeCompare(b.titulo,'pt-BR'));
}
export function csv(linhas:Indicador[]){
  const cell=(v:unknown)=>`"${String(v??'').replace(/"/g,'""')}"`;
  return '\ufeff'+[['indicador','ano','territorio','valor','unidade','variacao_percentual_publicada_vs_2024','cobertura','fonte','pagina','extraido_em','verificado_em'],...linhas.map(i=>[i.titulo,base.referencia,'Brasil',i.valor,i.unidade,String(i.variacao).replace('.',','),i.ressalva??'Total Brasil publicado pela fonte; não é auditoria de completude',base.url,i.pagina,base.extraidoEm,base.verificadoEm])].map(r=>r.map(cell).join(';')).join('\r\n');
}
