/** Contrato de comparação: escores WJP, sem misturar unidades CNJ/CEPEJ. */
export const COLUNAS_INTERNACIONAIS = [
  'f_7', 'f_7_1', 'f_7_2', 'f_7_3', 'f_7_4', 'f_7_5', 'f_7_6', 'f_7_7',
  'f_8', 'f_8_1', 'f_8_2', 'f_8_3', 'f_8_4', 'f_8_5', 'f_8_6', 'f_8_7',
] as const;
export type IndicadorInternacional = typeof COLUNAS_INTERNACIONAIS[number];
export type GrupoReferencia = 'regiao' | 'renda' | 'mundo' | 'selecionados';
export type PaisInternacional = {iso3:string;nome:string;nomeFonte:string;regiao:string;renda:string|null;escores:(number|null)[]};
export type FonteInternacional = {nome:string;url:string;arquivoUrl:string;sha256:string;commit:string;verificadoEm:string;metodo:string;metodoUrl:string;notaEdicao:string;notaRenda:string};
export type DadosInternacionais = {
  versao:string;edicao:string;fonte:FonteInternacional;colunas:string[];
  definicoesFonte:Record<string,string>;paises:PaisInternacional[];
  cobertura:{paises:number;edicoes:string[];unidade:string;historicoObservacoes:number;ausenciasUltimaEdicao:number};
};
export type HistoricoInternacional = {versao:string;edicoes:string[];colunas:string[];observacoes:{iso3:string;edicao:string;escores:(number|null)[]}[]};

type Definicao = {titulo:string;pergunta:string;grupo:'civil'|'criminal';nota:string};
export const INDICADORES_INTERNACIONAIS:Record<IndicadorInternacional,Definicao> = {
  f_7:{titulo:'Justiça civil · índice composto',pergunta:'Como a Justiça civil funciona no conjunto?',grupo:'civil',nota:'Fator 7 oficial do WJP. Reúne sete dimensões; não é uma nova nota criada pelo observatório.'},
  f_7_1:{titulo:'Acesso e custo para a pessoa',pergunta:'É possível buscar uma solução e arcar com seu custo?',grupo:'civil',nota:'WJP 7.1: acesso e possibilidade de pagar pela Justiça civil. Não mede gasto público por habitante ou percentual de pessoas atendidas.'},
  f_7_2:{titulo:'Ausência de discriminação',pergunta:'As pessoas encontram tratamento sem discriminação?',grupo:'civil',nota:'WJP 7.2: ausência de discriminação na Justiça civil, conforme os instrumentos do índice.'},
  f_7_3:{titulo:'Ausência de corrupção',pergunta:'O caminho pela Justiça civil está livre de corrupção?',grupo:'civil',nota:'WJP 7.3: ausência de corrupção na Justiça civil. Não equivale a contagem de denúncias ou condenações.'},
  f_7_4:{titulo:'Ausência de influência governamental indevida',pergunta:'A Justiça civil atua sem influência indevida do governo?',grupo:'civil',nota:'WJP 7.4: influência governamental indevida na Justiça civil; não mede toda a independência judicial.'},
  f_7_5:{titulo:'Resposta sem demora excessiva',pergunta:'A resposta chega sem demora excessiva?',grupo:'civil',nota:'WJP 7.5: demora excessiva na Justiça civil. É um escore de experiências e percepções, não meses de duração observada.'},
  f_7_6:{titulo:'Cumprimento efetivo das decisões',pergunta:'A decisão produz cumprimento na prática?',grupo:'civil',nota:'WJP 7.6: cumprimento na Justiça civil. Não é a taxa administrativa de decisões cumpridas nem percentual de valores pagos.'},
  f_7_7:{titulo:'Soluções alternativas de conflitos',pergunta:'Há alternativas acessíveis, imparciais e efetivas?',grupo:'civil',nota:'WJP 7.7: acesso, imparcialidade e efetividade de mecanismos alternativos de solução de conflitos. Não é a taxa de conciliação do CNJ.'},
  f_8:{titulo:'Justiça criminal · índice composto',pergunta:'Como funciona o sistema de Justiça criminal?',grupo:'criminal',nota:'Fator 8 oficial do WJP. Abrange investigação, julgamento, execução penal e garantias; seus resultados não são atribuíveis somente aos tribunais.'},
  f_8_1:{titulo:'Efetividade da investigação criminal',pergunta:'As investigações conseguem dar uma resposta?',grupo:'criminal',nota:'WJP 8.1: sistema de investigação criminal, com atores além do Judiciário.'},
  f_8_2:{titulo:'Julgamento criminal oportuno e efetivo',pergunta:'O julgamento criminal é oportuno e efetivo?',grupo:'criminal',nota:'WJP 8.2: julgamento criminal; não equivale a duração média em meses nem ao número de condenações.'},
  f_8_3:{titulo:'Sistema correcional e reincidência',pergunta:'O sistema correcional contribui para reduzir condutas criminais?',grupo:'criminal',nota:'WJP 8.3: efetividade do sistema correcional. Não é uma taxa de reincidência calculada de registros individuais.'},
  f_8_4:{titulo:'Imparcialidade do sistema criminal',pergunta:'O sistema criminal trata as pessoas com imparcialidade?',grupo:'criminal',nota:'WJP 8.4: imparcialidade da cadeia de Justiça criminal, sem controle causal próprio por perfil de casos.'},
  f_8_5:{titulo:'Sistema criminal sem corrupção',pergunta:'O sistema criminal está livre de corrupção?',grupo:'criminal',nota:'WJP 8.5: ausência de corrupção no sistema criminal.'},
  f_8_6:{titulo:'Sistema criminal sem influência governamental indevida',pergunta:'O sistema criminal atua sem influência governamental indevida?',grupo:'criminal',nota:'WJP 8.6: ausência de influência governamental indevida no sistema criminal.'},
  f_8_7:{titulo:'Devido processo e direitos da pessoa acusada',pergunta:'As garantias da pessoa acusada são respeitadas?',grupo:'criminal',nota:'WJP 8.7: devido processo e direitos da pessoa acusada; rapidez e garantias devem ser examinadas em conjunto.'},
};
export const GRUPOS_INTERNACIONAIS:Record<GrupoReferencia,string>={
  regiao:'América Latina e Caribe',renda:'Mesma faixa de renda do Brasil',mundo:'Todos os países e jurisdições',selecionados:'Apenas os países selecionados',
};
export const JORNADA_SOCIAL = [
  {id:'f_7_1',tema:'acesso',titulo:'Conseguir acessar',texto:'Informação, assistência e custo que a pessoa consegue suportar.'},
  {id:'f_7_5',tema:'tempo',titulo:'Receber uma resposta',texto:'Uma solução em tempo útil, sem perder as garantias do processo.'},
  {id:'f_7_6',tema:'entrega',titulo:'Ver a decisão cumprida',texto:'O direito reconhecido precisa se traduzir em cumprimento.'},
  {id:'f_7_2',tema:'comparar',titulo:'Ter tratamento igual',texto:'A experiência não pode depender de discriminação ou influência indevida.'},
] as const;

export function escore(pais:PaisInternacional,indicador:IndicadorInternacional):number|null {
  const valor=pais.escores[COLUNAS_INTERNACIONAIS.indexOf(indicador)];
  return typeof valor==='number'&&Number.isFinite(valor)?valor:null;
}
export function medianaEscores(valores:(number|null)[]):number|null {
  const rows=valores.filter((v):v is number=>v!==null&&Number.isFinite(v)).sort((a,b)=>a-b);
  const half=Math.floor(rows.length/2);
  return !rows.length?null:rows.length%2?rows[half]:(rows[half-1]+rows[half])/2;
}
export function paisesReferencia(paises:PaisInternacional[],grupo:GrupoReferencia,selecionados:string[]):PaisInternacional[] {
  const brasil=paises.find(p=>p.iso3==='BRA');
  if(!brasil)return [];
  return paises.filter(p=>p.iso3!=='BRA'&&(grupo==='mundo'||grupo==='regiao'&&p.regiao===brasil.regiao||grupo==='renda'&&brasil.renda!==null&&p.renda===brasil.renda||grupo==='selecionados'&&selecionados.includes(p.iso3)));
}
export function referenciaIndicador(paises:PaisInternacional[],indicador:IndicadorInternacional){
  const valores=paises.map(p=>escore(p,indicador));
  return {mediana:medianaEscores(valores),cobertos:valores.filter(v=>v!==null).length,total:paises.length};
}
export function diferencasCivis(brasil:PaisInternacional,referencias:PaisInternacional[]){
  return COLUNAS_INTERNACIONAIS.filter(i=>i.startsWith('f_7_')).map(indicador=>{
    const valor=escore(brasil,indicador),ref=referenciaIndicador(referencias,indicador);
    return {indicador,brasil:valor,...ref,distancia:valor!==null&&ref.mediana!==null?ref.mediana-valor:null};
  });
}
export function maiorDistanciaCivil(brasil:PaisInternacional,referencias:PaisInternacional[]){
  return diferencasCivis(brasil,referencias).filter(r=>r.distancia!==null&&r.distancia>0).sort((a,b)=>b.distancia!-a.distancia!)[0]??null;
}
/** Não une pontos por cima de uma edição ausente, nem duplica 2017–2018. */
export function segmentosHistoricos(historico:HistoricoInternacional,iso3:string,indicador:IndicadorInternacional){
  const mapa=new Map(historico.observacoes.filter(r=>r.iso3===iso3).map(r=>[r.edicao,r]));
  const segmentos:{edicao:string;anoFinal:number;valor:number}[][]=[];
  let atual:typeof segmentos[number]=[];
  for(const edicao of historico.edicoes){
    const linha=mapa.get(edicao),v=linha?.escores[COLUNAS_INTERNACIONAIS.indexOf(indicador)];
    if(typeof v!=='number'||!Number.isFinite(v)){
      if(atual.length)segmentos.push(atual);atual=[];continue;
    }
    atual.push({edicao,anoFinal:Number(edicao.split('-').at(-1)),valor:v});
  }
  if(atual.length)segmentos.push(atual);
  return segmentos;
}
