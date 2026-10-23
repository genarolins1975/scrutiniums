import type {Natureza,NumeroProps,Proveniencia} from '@/lib/painel/tipos';
import {fichaDaFigura} from '@/lib/eficiencia/fichaDaFigura';
import {brasil,captura,edicao,fontes,indicador,referenciaAno} from './dados';
import type {Indicador} from './modelo';

/**
 * Natureza de uma medida do SINISA lida pelo OBEE: o indicador publicado pela fonte é observado; a razão por residente (sufixo _HAB) é
 * calculada pelo OBEE sobre os totais da planilha financeira (a nota de cada medida diz isso).
 */
export const naturezaSaneamento=(m:Indicador):Natureza=>m.id.endsWith('_HAB')?'CALCULADO':'OBSERVADO';

/**
 * Ficha "Sobre este dado" de uma figura do SINISA no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026), a mesma dos capítulos
 * de medida do Meio ambiente e clima: o Ministério das Cidades como órgão, a edição e a referência, o arquivo lido com o SHA-256 do snapshot
 * e a captura. Quando as medidas vêm de mais de um arquivo (água e esgoto, nos recursos), cada arquivo vai citado com o próprio hash e a
 * ficha não escolhe um deles como "o" hash; a licença não está registrada no snapshot e fica dita como tal.
 */
export function fichaSaneamento(ids:readonly string[],natureza:Natureza='OBSERVADO'):Proveniencia{
 const medidas=ids.map(indicador);const ano=String(referenciaAno);
 const usadas=[...new Set(medidas.map(m=>m.fonte))].map(id=>fontes.find(f=>f.id===id)!);const f=usadas[0];const uma=usadas.length===1;
 return fichaDaFigura({indicador:medidas.map(m=>m.nome).join('; '),natureza,orgao:'Ministério das Cidades',conjunto:edicao+', referência '+ano,
  recurso:uma?f.arquivo:usadas.map(u=>u.arquivo+' (SHA-256 '+u.sha256+')').join('; '),url:f.url,
  unidade:[...new Set(medidas.map(m=>m.unidade))].join('; '),frequencia:'Anual (edição do SINISA)',referencia:{inicio:ano,fim:ano},capturadoEm:captura,sha256:uma?f.sha256:null,snapshot:'public/eficiencia/saneamento/snapshot.json',
  versao:'snapshot do saneamento, '+edicao,formula:medidas.map(m=>m.id+': '+m.formula).join('\n'),limitacoes:medidas.map(m=>m.nome+': '+m.nota)});
}

/**
 * Um número do Brasil na faixa do molde (NumeroIndicador), com a mesma precisão de formatar(): percentuais com as casas da fonte, contagens
 * de domicílios e municípios sem casas, o resto com as casas da fonte e a unidade ao lado. Ausência é ausência, com o motivo.
 */
export function numeroSaneamento(id:string,nota:string):NumeroProps{
 const m=indicador(id);const v=brasil(id);const base={rotulo:m.nome,unidade:m.unidade,periodo:String(referenciaAno),recorte:'Brasil',fonte:edicao,natureza:naturezaSaneamento(m),nota};
 if(v===null)return {...base,valor:null,motivoAusencia:'O '+edicao+' não publica este indicador para o Brasil nesta edição.'};
 return m.unidade==='%'?{...base,valor:v,formato:'percentual',casas:m.casas}:{...base,valor:v,formato:'decimal',casas:['domicílios','municípios'].includes(m.unidade)?0:m.casas};
}
