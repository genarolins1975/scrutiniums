import {fichaDaFigura} from '@/lib/eficiencia/fichaDaFigura';
import type {Natureza,Proveniencia} from '@/lib/painel/tipos';
import {dadosJustica as d} from './dados';

/**
 * Proveniência das figuras do Acesso à Justiça no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026). As duas fontes do
 * snapshot (a Pesquisa Nacional da Defensoria Pública e o Justiça em Números do CNJ) trazem nome, endereço do arquivo baixado, SHA-256,
 * referência e localizadores; a captura é a do snapshot. O montador é o mesmo dos outros temas do OBEE (fichaDaFigura): licença não
 * registrada fica dita como tal, e nada além do que o snapshot guarda entra na ficha.
 */
export const FONTE_DEFENSORIA='Pesquisa Nacional da Defensoria Pública 2025';
export const FONTE_CNJ='CNJ, Justiça em Números 2026';
const ORGAO={defensoria:['Pesquisa Nacional da Defensoria Pública','Bases de dados da edição 2025'],cnj:['CNJ','Justiça em Números 2026']} as const;

export function fichaJustica(fonte:'defensoria'|'cnj',o:{indicador:string;natureza:Natureza;unidade:string;inicio:string;fim:string;recurso:string;limitacoes:string[];formula?:string;transformacoes?:string[]}):Proveniencia{
 const f=d.fontes.find(x=>x.id===fonte)!;
 return fichaDaFigura({indicador:o.indicador,natureza:o.natureza,orgao:ORGAO[fonte][0],conjunto:ORGAO[fonte][1],recurso:o.recurso+'. Localizadores: '+f.localizadores,url:f.url,unidade:o.unidade,
  frequencia:fonte==='cnj'?'Anual (edição do Justiça em Números)':'Edição da pesquisa',referencia:{inicio:o.inicio,fim:o.fim},capturadoEm:d.capturadoEm,sha256:f.sha256,snapshot:'public/eficiencia/justica/snapshot.json',
  versao:'snapshot do Acesso à Justiça, versão '+d.versao,formula:o.formula??null,transformacoes:o.transformacoes,limitacoes:o.limitacoes,notas:f.nome+'. '+f.referencia+'.'});
}
