import Link from 'next/link';
import type {NumeroProps} from '@/components/painel';
import {dadosAssistencia} from '@/lib/eficiencia/assistencia/dados';
import {dataBr} from '@/lib/eficiencia/formato';
import {provenienciaObee} from '@/lib/eficiencia/proveniencia';
import {FiguraSuas} from './FiguraSuas';

/** Resumo de cada território só para as medidas pedidas: o que vai ao navegador. */
function recorteDasMedidas(ids:string[]){const g=dadosAssistencia();return Object.fromEntries(Object.entries(g.stats).map(([s,v])=>[s,Object.fromEntries(ids.map(id=>[id,v.metrics[id]]))]))}

/** Unidade do catálogo em palavras de leitor (o catálogo usa códigos curtos). */
const UNIDADE:Record<string,string>={binario:'% das respostas observadas',contagem:'contagem declarada pela unidade',dias:'dias'};

/** Fonte curta das páginas da Assistência social: os números, a abertura e a figura citam a mesma captura do Censo SUAS. */
export const FONTE_SUAS='MDS, Censo SUAS 2025';

/**
 * As respostas da rede no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026), para todas as páginas da Assistência social:
 * a FiguraSuas do kit, com a proveniência de cada medida montada da ficha do catálogo e do manifesto da captura (o arquivo oficial de
 * onde a variável foi lida, a data da captura, a fórmula, as ausências e as limitações declaradas). Substitui a DistribuicaoSuas, com
 * os mesmos números e as mesmas frases, desde que as seis páginas do tema migraram.
 */
export function FiguraSuasDoPainel({ids,rota}:{ids:string[];rota:string}){
  const g=dadosAssistencia();
  const metrics=ids.map(id=>g.catalog.find(c=>c.id===id)!);
  const proveniencias=Object.fromEntries(metrics.map(m=>{
    // o registro começa pelo arquivo baixado ("1_CRAS.zip / ..."): é ele que dá a página oficial da medida
    const f=g.manifest.sources.find(s=>m.record.startsWith(s.file))??g.manifest.sources[0];
    const [orgao,dataset]=m.source.split(' / ');
    return [m.id,provenienciaObee({indicador:`${m.kind} · ${m.name}`,natureza:'CALCULADO',orgao:orgao??m.source,dataset:dataset??m.source,recurso:m.record,url:f.url,unidade:UNIDADE[m.unit]??m.unit,frequencia:m.frequency,inicio:String(g.year),fim:String(g.year),capturadoEm:g.manifest.captured_at,formula:m.formula,transformacoes:[`Numerador: ${m.numerator}.`,`Denominador: ${m.denominator}.`,`Ausências: ${m.missing}.`],limitacoes:[m.limitations,m.breaks,`Universo: ${m.universe}.`],notas:m.definition})];
  }));
  return <FiguraSuas metrics={metrics} ufs={g.ufs} rota={rota} proveniencias={proveniencias} download={{href:'/eficiencia/assistencia-social/unidades.csv',rotulo:'Baixar recorte nacional completo, todas as variáveis (CSV)'}} stats={recorteDasMedidas(ids)}/>;
}

/**
 * O que cada número da faixa resume, para uma medida do Censo SUAS no Brasil: a resposta escolhida (nas perguntas de categoria, as
 * unidades que a deram), a soma declarada (contagens) ou a mediana (dias). São os mesmos resumos que a FiguraSuas desenha para o Brasil;
 * contagem, soma e mediana são feitas pelo OBEE sobre os registros do Censo, por isso a natureza é calculada.
 */
export type NumeroSuas={id:string;rotulo:string;resposta?:string;nota?:string};

export function numerosSuas(pedidos:readonly NumeroSuas[]):NumeroProps[]{
  const g=dadosAssistencia();
  const b=g.stats.Brasil.metrics;
  const fmt=(v:number,casas=0)=>v.toLocaleString('pt-BR',{maximumFractionDigits:casas});
  return pedidos.map(({id,rotulo,resposta,nota}):NumeroProps=>{
    const f=g.catalog.find(c=>c.id===id)!;
    const s=b[id];
    const base={rotulo,periodo:f.period,recorte:'Brasil',fonte:FONTE_SUAS,natureza:'CALCULADO' as const};
    const cobertura=`${fmt(s.observed)} de ${fmt(s.total)} unidades com resposta observada.`;
    if(resposta){
      const c=s.categories.find(x=>x.label===resposta);
      return c?{...base,valor:c.count,formato:'inteiro',unidade:`de ${fmt(s.observed)} unidades`,nota:`${fmt(c.percent,1)}% das respostas observadas. ${nota??''}`.trim()}:{...base,valor:null,unidade:'unidades',motivoAusencia:`A resposta "${resposta}" não aparece no resumo desta publicação.`};
    }
    if(f.unit==='dias')return s.median===null?{...base,valor:null,unidade:'dias',motivoAusencia:'Nenhuma unidade informou a espera neste recorte.'}:{...base,valor:s.median,formato:'inteiro',unidade:'dias (mediana)',nota:`${cobertura} ${nota??''}`.trim()};
    return s.sum===null?{...base,valor:null,unidade:'declarados',motivoAusencia:'Nenhuma unidade informou a contagem neste recorte.'}:{...base,valor:s.sum,formato:'inteiro',unidade:'soma declarada',nota:`Soma de ${fmt(s.observed)} unidades com resposta. ${nota??''}`.trim()};
  });
}

/** Fontes, datas e siglas da abertura: a captura do Censo SUAS e as siglas que a página usa. */
export function FontesSuas({siglas,extra}:{siglas:readonly [string,string][];extra?:React.ReactNode}){
  const g=dadosAssistencia();
  return <>
    <p>Censo SUAS {g.year}, publicado pelo Ministério do Desenvolvimento e Assistência Social (MDS); capturado em {dataBr(g.manifest.captured_at)}. {extra}</p>
    <p>{siglas.map(([s,n],i)=><span key={s}>{i>0&&' '}<span className="font-medium">{s}:</span> {n}.</span>)}</p>
  </>;
}

/** O método da página: a ficha de cada medida (definição, universo, período, fórmula, ausências, série e registro), os arquivos lidos e os caminhos para os dados. */
export function MetodoSuas({ids,extra}:{ids:readonly string[];extra?:React.ReactNode}){
  const g=dadosAssistencia();
  const ficha=(id:string)=>g.catalog.find(c=>c.id===id)!;
  return <>
    {ids.map(id=>{const f=ficha(id);return <div key={id}>
      <p className="font-medium text-carvao">{f.kind} · {f.name}</p>
      <p>{f.definition}{/[.?!]$/.test(f.definition)?'':'.'} Universo: {f.universe}. Período: {f.period}. Fórmula: {f.formula}. Ausências: {f.missing}. Série: {f.breaks}. Registro: {f.record}.</p>
    </div>;})}
    {extra}
    <p>Arquivos oficiais lidos: {g.manifest.sources.map(s=><a key={s.file} href={s.url} className="mr-3 inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4">{s.file}</a>)} Capturados em {dataBr(g.manifest.captured_at)}.</p>
    <p>Todas as observações de todas as unidades e o dicionário completo estão em <Link href="/eficiencia-estatal/assistencia-social/metodos" className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4">Dados e métodos</Link> e na <Link href="/eficiencia-estatal/assistencia-social/dados" className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4">consulta por unidade</Link>.</p>
  </>;
}
