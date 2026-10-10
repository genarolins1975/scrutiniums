export const ROTA_MOBILIDADE = '/eficiencia-estatal/mobilidade-transporte';
export const PAGINAS_MOBILIDADE = [
  {slug:'', nome:'Panorama', pergunta:'Chegar aonde precisa', descricao:'Tempo, custo e condições de deslocamento. Conheça as evidências disponíveis e os limites de cada fonte.'},
  {slug:'tempo', nome:'Tempo e deslocamentos', pergunta:'Quanto do dia fica no caminho?', descricao:'Faixas de duração e meio principal de transporte até o trabalho, no universo específico do Censo 2022.'},
  {slug:'transporte', nome:'Transporte e custo', pergunta:'Que transporte está disponível?', descricao:'Tarifa, frota e infraestrutura declaradas pelas prefeituras. Oferta registrada não é garantia de regularidade.'},
  {slug:'acesso', nome:'Acessibilidade física', pergunta:'Quais barreiras físicas a rede declara?', descricao:'Abrigos, rampas e embarque em nível. Esses atributos não medem quantos empregos ou serviços podem ser alcançados.'},
  {slug:'oportunidades', nome:'Acesso a oportunidades', pergunta:'O que cabe no alcance de uma viagem?', descricao:'Empregos, escolas, saúde e assistência alcançáveis em 30 ou 60 minutos. Ipea/AOP 2019, com pesos populacionais de 2010 e diferenças por áreas de renda.'},
  {slug:'seguranca', nome:'Segurança', pergunta:'Qual estrutura de fiscalização é informada?', descricao:'Agentes e equipamentos de fiscalização. Esta edição ainda não mede mortes, lesões ou risco nos deslocamentos.'},
  {slug:'recursos', nome:'Recursos', pergunta:'Como o sistema de ônibus é financiado?', descricao:'Receita tarifária e subsídios declarados, acompanhados por medidas de produção. Não equivalem à despesa orçamentária reconciliada.'},
  {slug:'comparar', nome:'Comparar', pergunta:'Como os territórios se comparam?', descricao:'Compare a mesma medida, fonte, período e nível territorial. As diferenças são descritivas, não notas de gestão.'},
  {slug:'metodos', nome:'Dados e métodos', pergunta:'Entenda e confira os números', descricao:'Definições, cobertura, fontes originais, estados de ausência e exportação integral da edição.'},
] as const;
export type PaginaMobilidade = typeof PAGINAS_MOBILIDADE[number]['slug'];
export type Nivel = 'brasil'|'uf'|'municipio';
export type Parametros = Record<string,string|string[]|undefined>;
export type Medida = {id:string;title:string;section:string;unit:string;period:string;source:string;definition:string;universe:string;warning:string;reference:string;group?:string;column?:string};
export type Territorio = {id:string;name:string;uf:string;level:Nivel};
export type Observacao = {territory:string;metric:string;period:string;value:number|null;state:string;raw:string|number|null;cell:string;numerator?:number|null;denominator?:number|null};
export type Fonte = {arquivo:string;url:string;estado:string;sha256?:string;capturado_em?:string;bytes?:number};
export type BaseMobilidade = {schemaVersion:number;edition:string;metrics:Medida[];territories:Territorio[];observations:Observacao[];sources:Fonte[];gaps:{section:string;reason:string}[]};
export type Linha = Observacao & {local:Territorio};
export const ESTADOS:Record<string,string> = {observado:'Informado',nao_informado:'Não informado',nao_aplicavel:'Não aplicável',nao_disponivel:'Não disponível',suprimido:'Suprimido na fonte',invalido:'Não elegível: valor inconsistente',sinal_convencional:'Sinal convencional da fonte'};
export const primeiro=(v:string|string[]|undefined)=> (Array.isArray(v)?v[0]:v)?.slice(0,160) ?? '';
export const normaliza=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
export const valor=(n:number|null,unidade='')=>n===null?'Não disponível':new Intl.NumberFormat('pt-BR',{maximumFractionDigits:unidade==='R$'?2:unidade==='%'?1:2,minimumFractionDigits:unidade==='R$'?2:0}).format(n)+(unidade==='%'?'%':unidade?' '+unidade:'');
export function mediana(ns:number[]):number|null {if(!ns.length)return null;const a=[...ns].sort((x,y)=>x-y);const i=Math.floor(a.length/2);return a.length%2?a[i]:(a[i-1]+a[i])/2;}
export function validarBase(g:BaseMobilidade):void {
  if(g.schemaVersion!==1||!Array.isArray(g.observations)||!g.metrics.length)throw new Error('Snapshot de mobilidade incompatível');
  const ts=new Set(g.territories.map(t=>t.id)), ms=new Map(g.metrics.map(m=>[m.id,m])), fontes=new Set(g.sources.filter(s=>s.estado==='coletado').map(s=>s.arquivo));
  if(ts.size!==g.territories.length||ms.size!==g.metrics.length)throw new Error('Identificação duplicada');
  for(const m of g.metrics)if(!fontes.has(m.source))throw new Error('Fonte ausente: '+m.id);
  const chaves=new Set<string>();
  for(const o of g.observations){const k=[o.territory,o.metric,o.period].join('|');const m=ms.get(o.metric);if(chaves.has(k)||!ts.has(o.territory)||!m||m.period!==o.period)throw new Error('Chave inválida: '+k);chaves.add(k);if(o.state==='observado'){if(o.value===null||!Number.isFinite(o.value)||o.value<0||(m.unit==='%'&&o.value>100))throw new Error('Valor inválido: '+k);}else if(o.value!==null)throw new Error('Ausência com valor: '+k);}
}
export function linhasDaMedida(g:BaseMobilidade,id:string,p:Parametros={}):Linha[]{
  const m=g.metrics.find(x=>x.id===id);if(!m)return [];
  const locais=new Map(g.territories.map(t=>[t.id,t]));
  const nivel=primeiro(p.nivel)|| (m.reference==='brasil'?'uf':'municipio');
  const uf=primeiro(p.uf), busca=normaliza(primeiro(p.busca));
  const rows: Linha[]=[];
  for(const o of g.observations){if(o.metric!==id)continue;const t=locais.get(o.territory);if(!t||t.level!==nivel||(uf&&t.uf!==uf)||(busca&&!normaliza(t.name+' '+t.uf+' '+t.id).includes(busca)))continue;rows.push({...o,local:t});}
  const ordem=primeiro(p.ordem);rows.sort((a,b)=>{if(ordem==='asc'||ordem==='desc'){if(a.value===null&&b.value!==null)return 1;if(a.value!==null&&b.value===null)return -1;if(a.value!==null&&b.value!==null&&a.value!==b.value)return (a.value-b.value)*(ordem==='desc'?-1:1);}return a.local.name.localeCompare(b.local.name,'pt-BR')||a.local.id.localeCompare(b.local.id);});return rows;
}
export function referencia(g:BaseMobilidade,m:Medida,rows:Linha[]){if(m.reference==='brasil'){const o=g.observations.find(o=>o.metric===m.id&&o.territory==='1');return {nome:'Brasil · agregado nacional',valor:o?.value??null,n:null};}const vals=rows.flatMap(o=>o.value===null?[]:[o.value]);return {nome:'Mediana dos municípios com valor válido neste recorte',valor:mediana(vals),n:vals.length};}
export function hrefRecorte(slug:string,p:Parametros={},alterar:Record<string,string>={}){const q=new URLSearchParams();for(const k of ['medida','uf','busca','nivel','ordem','pagina','territorio']){const v=primeiro(p[k]);if(v)q.set(k,v);}for(const[k,v]of Object.entries(alterar)){if(v)q.set(k,v);else q.delete(k);}return ROTA_MOBILIDADE+(slug?'/'+slug:'')+(q.size?'?'+q.toString():'');}
export function csvCelula(v:unknown):string{let s=v===null||v===undefined?'':String(v);if(typeof v==='string'&&/^[\s]*[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
export function* exportarCSV(g:BaseMobilidade,observacoes:Iterable<Observacao>=g.observations){
  const ts=new Map(g.territories.map(t=>[t.id,t])),ms=new Map(g.metrics.map(m=>[m.id,m])),ss=new Map(g.sources.map(s=>[s.arquivo,s]));
  yield '\uFEFF'+['codigo_ibge','territorio','uf','nivel','indicador','medida','periodo','valor','unidade','estado','numerador','denominador','original','celula_ou_consulta','fonte_url','captura_utc','fonte_sha256'].map(csvCelula).join(';')+'\r\n';
  for(const o of observacoes){const t=ts.get(o.territory)!,m=ms.get(o.metric)!,s=ss.get(m.source)!;yield [t.id,t.name,t.uf,t.level,m.id,m.title,o.period,o.value,m.unit,o.state,o.numerator,o.denominator,o.raw,o.cell,s.url,s.capturado_em,s.sha256].map(csvCelula).join(';')+'\r\n';}
}
