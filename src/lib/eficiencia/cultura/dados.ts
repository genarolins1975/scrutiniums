import snapshot from '../../../../public/eficiencia/cultura/snapshot.json';
export const base = snapshot;
export type Estimativa = typeof base.tic[number];
export const ROTA = '/eficiencia-estatal/cultura';
export const n = (v: number, d = 1) => v.toLocaleString('pt-BR', {minimumFractionDigits:d, maximumFractionDigits:d});
export const normaliza = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
export const fichas = base.catalogo.filter(i=>i.fontes.includes('tic'));
export function seleciona(aba:string, categoria:string, busca='') {
  const termos=normaliza(busca).trim().split(/\s+/).filter(Boolean);
  return base.tic.filter(r=>r.aba===aba&&r.categoria===categoria&&termos.every(t=>normaliza(r.tipo).includes(t)));
}
export function csvTic(linhas:Estimativa[]) {
  const q=(v:unknown)=>'"'+String(v??'').replace(/"/g,'""')+'"';
  return ['tipo;indicador;categoria;estimativa_percentual;margem_pp;confianca;ano;universo;fonte;aba;linha;coluna', ...linhas.map(r=>[r.tipo,fichas.find(f=>f.localizacao_registro.startsWith(r.aba+';'))?.nome,r.categoria,r.valor,r.margem,'95%',2024,'Total do mesmo tipo de equipamento no cadastro oficial; inclui públicos e privados',base.fontes[0].url,r.aba,r.origem.linha,r.origem.coluna].map(q).join(';'))].join('\r\n');
}
export function download(texto:string,nome:string,tipo='text/csv;charset=utf-8') {
  const url=URL.createObjectURL(new Blob(['\uFEFF',texto],{type:tipo}));
  const a=document.createElement('a');a.href=url;a.download=nome;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
