import { dividaPrimaria, execucaoPrimaria, snapshot } from './dados';

export const MEDIDAS = [
 { id:'CE-04', nome:'Execução atualizada', formula:'Despesa liquidada / dotação atualizada × 100', janela:'RREO · acumulado do 6º bimestre', ressalva:'Executar mais não demonstra maior qualidade ou eficiência.' },
 { id:'CE-01', nome:'Erro da receita', formula:'(Receita arrecadada / previsão inicial − 1) × 100', janela:'RREO · acumulado do 6º bimestre', ressalva:'O sinal mostra receita acima ou abaixo da previsão. A magnitude não avalia a qualidade dos serviços.' },
 { id:'CE-05', nome:'Liquidação de empenhos', formula:'Despesa liquidada / empenhada × 100', janela:'RREO · acumulado do 6º bimestre', ressalva:'Liquidação é um estágio contábil; não substitui a verificação da entrega física.' },
 { id:'CE-06', nome:'Pagamento do exercício', formula:'Despesa paga / liquidada × 100', janela:'RREO · acumulado do 6º bimestre', ressalva:'Não inclui pagamentos de restos de exercícios anteriores.' },
 { id:'CE-10', nome:'Margem corrente', formula:'(Receitas correntes − despesas correntes liquidadas) / receitas correntes × 100', janela:'RREO · acumulado do 6º bimestre', ressalva:'É uma diferença contábil entre receitas arrecadadas e despesas liquidadas; não é caixa livre, resultado primário ou nota de eficiência.' },
 { id:'CE-14', nome:'Participação das transferências correntes', formula:'Transferências correntes / receitas correntes × 100', janela:'RREO · acumulado do 6º bimestre', ressalva:'Mostra a composição do financiamento. Transferências não são classificadas automaticamente como boas ou ruins; receitas correntes não equivalem à RCL.' },
 { id:'CE-11', nome:'Dívida líquida / RCL ajustada', formula:'DCL / RCL ajustada para endividamento × 100', janela:'RGF · 2025 Q3 ou 2026 Q1', ressalva:'Valores negativos são preservados. A relação não mede eficiência da gestão.' },
] as const;
export type Medida = typeof MEDIDAS[number]['id'];
export const REGIOES = ['Todas',...Array.from(new Set(snapshot.ufs.map(u=>u.regiao))).sort()];
export function mediana(valores:number[]) {
 const v=valores.filter(Number.isFinite).slice().sort((a,b)=>a-b), n=v.length;
 return n ? n%2 ? v[(n-1)/2] : (v[n/2-1]+v[n/2])/2 : null;
}
export function comparar(ano:number, indicador:Medida, regiao='Todas', incluirDF=false) {
 const universo=snapshot.ufs.filter(u=>(incluirDF || u.uf!=='DF') && (regiao==='Todas' || u.regiao===regiao));
 const linhas=universo.map(u=>{
  const d=dividaPrimaria(u.uf,ano), r=execucaoPrimaria(u.uf,ano);
  const valor=indicador==='CE-11' ? d?.valores.percentual_declarado ?? null : r?.indicadores[indicador] ?? null;
  const f=(indicador==='CE-11' ? d : r)?.fontes[0];
  return {uf:u.uf,nome:u.nome,regiao:u.regiao,valor,fonte:f?.url??null,arquivo:f?.arquivo??null,sha256:f?.sha256??null};
 });
 const validos=linhas.filter(l=>l.valor!==null), referencia=mediana(validos.map(l=>l.valor!));
 return {linhas,referencia,elegiveis:validos.length,universo:universo.length};
}
export function csvComparacao(ano:number,indicador:Medida,regiao='Todas',incluirDF=false) {
 const c=comparar(ano,indicador,regiao,incluirDF), cell=(v:unknown)=>'"'+String(v??'').replaceAll('"','""')+'"';
 const linhas=[['UF','ente','regiao','ano','indicador','valor_pct','mediana_nao_ponderada_pct','diferenca_pp','situacao','fonte','arquivo','sha256'],...c.linhas.map(l=>[l.uf,l.nome,l.regiao,ano,indicador,l.valor,c.referencia,l.valor!==null&&c.referencia!==null?l.valor-c.referencia:null,l.valor===null?'sem_observacao_conferida':'fonte_primaria_conferida',l.fonte,l.arquivo,l.sha256])];
 return '\uFEFF'+linhas.map(r=>r.map(cell).join(';')).join('\r\n');
}

export type FiltrosComparacao = { indicador: Medida; regiao: string; df: boolean; ordem: 'uf' | 'valor' };
export function lerFiltrosComparacao(q: { indicador?: string | null; regiao?: string | null; df?: string | null; ordem?: string | null }): FiltrosComparacao {
 return {
  indicador: MEDIDAS.some(m=>m.id===q.indicador) ? q.indicador as Medida : 'CE-04',
  regiao: REGIOES.includes(q.regiao ?? '') ? q.regiao! : 'Todas',
  df: q.df==='1',
  ordem: q.ordem==='valor' ? 'valor' : 'uf',
 };
}
