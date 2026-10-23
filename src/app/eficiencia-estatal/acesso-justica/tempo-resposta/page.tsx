import type {Metadata} from 'next';
import Link from 'next/link';
import {PainelPrincipal} from '@/components/observatorios/PainelPrincipal';
import {Comparador,type Medida} from '@/components/eficiencia/justica/Exploradores';
import {FiguraAnalitica,PaginaPainel,TabelaDados} from '@/components/painel';
import {dadosJustica as d} from '@/lib/eficiencia/justica/dados';
import {FONTE_CNJ,fichaJustica} from '@/lib/eficiencia/justica/molde';
import {duracao,ROTA_JUSTICA} from '@/lib/eficiencia/justica/modelo';
import {TEMAS_EFICIENCIA} from '@/lib/eficiencia/temas';
export const dynamic='force-static';
export const metadata:Metadata={title:'Tempo e resposta judicial',alternates:{canonical:ROTA_JUSTICA+'/tempo-resposta'}};
const medidas:Medida[]=[{id:'baixados',nome:'Tempo dos processos baixados',unidade:'meses',formato:'meses',referencia:32,referenciaNome:'Justiça Estadual',nota:'Média entre o início e a primeira baixa dos processos baixados em 2025. Uma baixa em determinada fase não equivale necessariamente à solução definitiva de todo o conflito.'},{id:'pendentes',nome:'Tempo dos processos pendentes',unidade:'meses',formato:'meses',referencia:44,referenciaNome:'Justiça Estadual',nota:'Idade média do acervo ainda pendente em 31/12/2025. Não é previsão do tempo restante. O conjunto de processos é diferente daquele usado no tempo dos baixados.'}];
/**
 * Tempo e resposta judicial no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026). O aviso de painel principal (esta página
 * é cópia do Judiciário) fica logo depois dos números; a comparação dos 27 tribunais é a figura; a tabela dos universos nacionais passa
 * à TabelaDados, à vista; a nota final vira o limite e fica inteira no método.
 */
export default function Pagina(){const ano=String(d.cnj.ano);
 const ficha=fichaJustica('cnj',{indicador:'Duração média dos processos baixados e idade média dos pendentes, por Tribunal de Justiça',natureza:'OBSERVADO',unidade:'meses',inicio:ano,fim:ano,recurso:'Relatório integral em PDF, figura 285, p. 333',transformacoes:['Valores convertidos de anos e meses para meses.'],limitacoes:['A composição do acervo, a matéria e a fase processual influenciam os tempos.','A referência é o agregado estadual publicado pelo CNJ, não a média simples dos tribunais.']});
 const universos:[string,number,number][]=[['Todos os processos',d.cnj.tempoBaixados,d.cnj.tempoPendentes],['Execuções fiscais',d.cnj.tempoBaixadosFiscal,d.cnj.tempoPendentesFiscal],['Sem execuções fiscais',d.cnj.tempoBaixadosSemFiscal,d.cnj.tempoPendentesSemFiscal]];
 const fonte=<>Fonte: <a className="underline underline-offset-4" href={d.fontes.find(f=>f.id==='cnj')!.url+'#page=24'}>{FONTE_CNJ} · ano-base {ano} · p. 24</a>.</>;
 return <PaginaPainel rota={ROTA_JUSTICA+'/tempo-resposta'} principal={false}
  abertura={{grupo:TEMAS_EFICIENCIA.justica.nome,acento:'obee',titulo:'Quanto tempo leva a resposta judicial?',
   lead:'Duração média e volume de processos descrevem partes diferentes do funcionamento da Justiça. A composição do acervo, a matéria e a fase processual influenciam os tempos.',
   recorte:{periodo:'ano-base '+ano,universo:'Judiciário e 27 tribunais estaduais',unidade:'meses e processos',fonte:FONTE_CNJ},
   limite:'a eficiência de um tribunal: a comparação não controla a composição do acervo, e o tempo médio não informa a mediana, a dispersão nem a espera de uma pessoa específica.'}}
  numeros={[
   {rotulo:'Casos novos no ano',valor:d.cnj.novosMilhoes,formato:'decimal',casas:1,unidade:'milhões de processos',periodo:ano,fonte:FONTE_CNJ+', p. 23',natureza:'OBSERVADO',nota:'Fluxo processual, incluindo recursos e execuções; não representa pessoas únicas.'},
   {rotulo:'Processos baixados no ano',valor:d.cnj.baixadosMilhoes,formato:'decimal',casas:1,unidade:'milhões de processos',periodo:ano,fonte:FONTE_CNJ+', p. 23',natureza:'OBSERVADO',nota:'Saídas contabilizadas no período; podem se referir a casos iniciados em anos anteriores.'},
   {rotulo:'Processos pendentes ao fim do ano',valor:d.cnj.pendentesMilhoes,formato:'decimal',casas:1,unidade:'milhões de processos',periodo:'dezembro de '+ano,fonte:FONTE_CNJ+', p. 22',natureza:'OBSERVADO',nota:'Estoque em dezembro; não deve ser somado aos fluxos anuais.'},
  ]}
  notaNumeros="Volumes arredondados como publicados no sumário; estoque na p. 22."
  navegacaoLocal={<PainelPrincipal rota="/eficiencia-estatal/acesso-justica/tempo-resposta"/>}
  figuras={<FiguraAnalitica id="tribunais" pergunta="Compare os 27 tribunais estaduais" subtitulo={`Duração dos baixados ou idade dos pendentes · meses · 27 Tribunais de Justiça, ${ano}`} natureza="OBSERVADO" idioma="pt" proveniencia={ficha}
   comoInterpretar="Mesma medida, mesmo ano e mesmo ramo de Justiça. A referência é o agregado estadual publicado pelo CNJ, não a média simples dos tribunais."
   naoConcluir="A comparação não identifica isoladamente a eficiência de um tribunal: a composição do acervo, a matéria e a fase processual influenciam os tempos, e a média não é o prazo de um caso."
   tabela={{naFigura:'logo abaixo das barras, com a duração exata de cada tribunal na medida escolhida.'}}>
   <Comparador linhas={d.tribunais.map(t=>({id:t.uf,nome:t.tribunal,valores:{baixados:t.baixados,pendentes:t.pendentes}}))} medidas={medidas} titulo="Duração por tribunal" fonte="CNJ 2026, figura 285, página 333" periodo="2025"/>
  </FiguraAnalitica>}
  tabelas={<TabelaDados recolhida={false} id="execucao-fiscal" tituloVisivel="A execução fiscal muda a leitura do tempo." lead="Recortes nacionais publicados pelo CNJ. As médias abaixo pertencem a conjuntos diferentes; não são etapas consecutivas para somar."
   titulo="Tempos por universo processual · Judiciário" colunas={['Universo · Judiciário','Baixados em '+ano,'Pendentes em dezembro']} linhas={universos.map(([t,a,b])=>[t,duracao(a),duracao(b)])} limite={universos.length} nota={fonte}/>}
  metodo={<><p>O tempo médio não informa a mediana, a dispersão nem a espera de uma pessoa específica. Os dados aqui publicados não acompanham a fila para obter assistência jurídica antes do ingresso no Judiciário.</p><p>{FONTE_CNJ}: volumes arredondados como publicados no sumário (p. 23), estoque na p. 22; tempos dos tribunais da figura 285 (p. 333), convertidos de anos e meses para meses; universos nacionais na p. 24.</p><p>Fontes, recortes, hashes e arquivos em <Link className="underline" href={ROTA_JUSTICA+'/dados'}>Dados e métodos</Link>.</p></>}
 />;}
