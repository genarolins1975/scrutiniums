import { dividaPrimaria, execucaoPrimaria, primarios, snapshot } from './dados';

/** Parcelas exclusivas da receita corrente; CE-14 mantém seu contrato original. */
export const CAMPOS_RECEITA = {
 'REC-TRIBUTARIA':'tributaria',
 'REC-CONTRIBUICOES':'contribuicoes',
 'CE-14':'transferencias_correntes',
 'REC-DEMAIS':'demais_correntes_agrupadas',
} as const;

export const CONTAS_DESPESA = {
 'DESP-PESSOAL':'PessoalEEncargosSociais',
 'DESP-JUROS':'JurosEEncargosDaDivida',
 'DESP-OUTRAS':'OutrasDespesasCorrentes',
 'DESP-INVESTIMENTOS':'Investimentos',
 'DESP-INVERSOES':'InversoesFinanceiras',
 'DESP-AMORTIZACAO':'AmortizacaoDaDivida',
} as const;
export const MEDIDAS = [
 { id:'REC-TRIBUTARIA', nome:'Impostos, taxas e contribuições de melhoria · participação na receita corrente', formula:'Receita tributária arrecadada / receitas correntes arrecadadas × 100', janela:'RREO · acumulado do 6º bimestre', ressalva:'Composição da receita corrente, sem receitas de capital. A participação não mede, isoladamente, autonomia ou eficiência.' },
 { id:'REC-CONTRIBUICOES', nome:'Contribuições · participação na receita corrente', formula:'Receita de contribuições arrecadada / receitas correntes arrecadadas × 100', janela:'RREO · acumulado do 6º bimestre', ressalva:'Categoria própria do RREO, distinta das contribuições de melhoria incluídas na receita tributária. Maior participação não é sinal automático de desempenho.' },
 { id:'REC-DEMAIS', nome:'Demais receitas correntes agrupadas · participação na receita corrente', formula:'(Receitas correntes − tributária − contribuições − transferências correntes) / receitas correntes × 100', janela:'RREO · acumulado do 6º bimestre', ressalva:'Residual que reúne receitas patrimoniais, agropecuárias, industriais, de serviços e outras correntes. Não corresponde somente à conta Outras Receitas Correntes.' },
 { id:'CE-04', nome:'Execução atualizada', formula:'Despesa liquidada / dotação atualizada × 100', janela:'RREO · acumulado do 6º bimestre', ressalva:'Executar mais não demonstra maior qualidade ou eficiência.' },
 { id:'CE-01', nome:'Erro da receita', formula:'(Receita arrecadada / previsão inicial − 1) × 100', janela:'RREO · acumulado do 6º bimestre', ressalva:'O sinal mostra receita acima ou abaixo da previsão. A magnitude não avalia a qualidade dos serviços.' },
 { id:'CE-05', nome:'Liquidação de empenhos', formula:'Despesa liquidada / empenhada × 100', janela:'RREO · acumulado do 6º bimestre', ressalva:'Liquidação é um estágio contábil; não substitui a verificação da entrega física.' },
 { id:'CE-06', nome:'Pagamento do exercício', formula:'Despesa paga / liquidada × 100', janela:'RREO · acumulado do 6º bimestre', ressalva:'Não inclui pagamentos de restos de exercícios anteriores.' },
 { id:'CE-10', nome:'Margem corrente', formula:'(Receitas correntes − despesas correntes liquidadas) / receitas correntes × 100', janela:'RREO · acumulado do 6º bimestre', ressalva:'É uma diferença contábil entre receitas arrecadadas e despesas liquidadas; não é caixa livre, resultado primário ou nota de eficiência.' },
 { id:'CE-14', nome:'Participação das transferências correntes', formula:'Transferências correntes / receitas correntes × 100', janela:'RREO · acumulado do 6º bimestre', ressalva:'Mostra a composição do financiamento. Transferências não são classificadas automaticamente como boas ou ruins; receitas correntes não equivalem à RCL.' },
 { id:'CE-11', nome:'Dívida líquida / RCL ajustada', formula:'DCL / RCL ajustada para endividamento × 100', janela:'RGF · 2025 Q3 ou 2026 Q1', ressalva:'Valores negativos são preservados. A relação não mede eficiência da gestão.' },
 { id:'DESP-PESSOAL', nome:'Pessoal e encargos · participação na despesa', formula:'Valor liquidado em pessoal e encargos / despesa total liquidada × 100', janela:'RREO · acumulado do 6º bimestre', ressalva:'Composição da despesa; maior participação não significa maior eficiência. Não equivale à despesa com pessoal usada nos limites legais da LRF.' },
 { id:'DESP-JUROS', nome:'Juros da dívida · participação na despesa', formula:'Valor liquidado em juros da dívida / despesa total liquidada × 100', janela:'RREO · acumulado do 6º bimestre', ressalva:'Composição da despesa; maior participação não significa maior eficiência. Não inclui amortização do principal.' },
 { id:'DESP-OUTRAS', nome:'Outras despesas correntes · participação na despesa', formula:'Valor liquidado em outras despesas correntes / despesa total liquidada × 100', janela:'RREO · acumulado do 6º bimestre', ressalva:'Composição da despesa; maior participação não significa maior eficiência. A categoria reúne despesas de naturezas distintas.' },
 { id:'DESP-INVESTIMENTOS', nome:'Investimentos · participação na despesa', formula:'Valor liquidado em investimentos / despesa total liquidada × 100', janela:'RREO · acumulado do 6º bimestre', ressalva:'Composição da despesa; maior participação não significa maior eficiência. Não comprova conclusão ou qualidade de obras.' },
 { id:'DESP-INVERSOES', nome:'Inversões financeiras · participação na despesa', formula:'Valor liquidado em inversões financeiras / despesa total liquidada × 100', janela:'RREO · acumulado do 6º bimestre', ressalva:'Composição da despesa; maior participação não significa maior eficiência. Não equivale à categoria contábil de investimentos.' },
 { id:'DESP-AMORTIZACAO', nome:'Amortização da dívida · participação na despesa', formula:'Valor liquidado em amortização da dívida / despesa total liquidada × 100', janela:'RREO · acumulado do 6º bimestre', ressalva:'Composição da despesa; maior participação não significa maior eficiência. Corresponde ao principal; os juros estão em outra categoria.' },
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
  const campoReceita=indicador in CAMPOS_RECEITA ? CAMPOS_RECEITA[indicador as keyof typeof CAMPOS_RECEITA] : null;
  const conta=indicador in CONTAS_DESPESA ? CONTAS_DESPESA[indicador as keyof typeof CONTAS_DESPESA] : campoReceita && campoReceita!=='demais_correntes_agrupadas' ? primarios.campos_financiamento[campoReceita].cod_conta : null;
  const parte=indicador in CONTAS_DESPESA ? r?.composicao_despesa.partes.find(p=>p.conta===conta) : undefined;
  const numerador=campoReceita ? r?.financiamento.valores[campoReceita]??null : parte?.valor??null;
  const denominador=campoReceita ? r?.financiamento.valores.receitas_correntes??null : parte ? r!.valores.liquidada : null;
  const valor=campoReceita ? numerador!==null&&denominador!==null&&denominador>0 ? 100*numerador/denominador : null : indicador in CONTAS_DESPESA ? parte?.percentual ?? null : indicador==='CE-11' ? d?.valores.percentual_declarado ?? null : r?.indicadores[indicador as keyof NonNullable<typeof r>['indicadores']] ?? null;
  const f=(indicador==='CE-11' ? d : r)?.fontes[0];
  return {numerador,denominador,conta,campoReceita,uf:u.uf,nome:u.nome,regiao:u.regiao,valor,fonte:f?.url??null,arquivo:f?.arquivo??null,sha256:f?.sha256??null};
 });
 const validos=linhas.filter(l=>l.valor!==null), referencia=mediana(validos.map(l=>l.valor!));
 return {linhas,referencia,elegiveis:validos.length,universo:universo.length};
}
export function csvComparacao(ano:number,indicador:Medida,regiao='Todas',incluirDF=false) {
 const c=comparar(ano,indicador,regiao,incluirDF), cell=(v:unknown)=>'"'+String(v??'').replaceAll('"','""')+'"';
 const linhas=[['UF','ente','regiao','ano','indicador','valor_pct','mediana_nao_ponderada_pct','diferenca_pp','situacao','fonte','arquivo','sha256','categoria_liquidada_BRL','total_liquidado_BRL','cod_conta','categoria_arrecadada_BRL','receitas_correntes_BRL','campo_receita','formula_medida'],...c.linhas.map(l=>[l.uf,l.nome,l.regiao,ano,indicador,l.valor,c.referencia,l.valor!==null&&c.referencia!==null?l.valor-c.referencia:null,l.valor===null?'sem_observacao_conferida':'fonte_primaria_conferida',l.fonte,l.arquivo,l.sha256,l.campoReceita?null:l.numerador,l.campoReceita?null:l.denominador,l.conta,l.campoReceita?l.numerador:null,l.campoReceita?l.denominador:null,l.campoReceita,MEDIDAS.find(m=>m.id===indicador)!.formula])];
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
